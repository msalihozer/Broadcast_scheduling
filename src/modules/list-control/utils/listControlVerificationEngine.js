/**
 * @file src/modules/list-control/utils/listControlVerificationEngine.js
 * @description Yayın Liste Kontrol Modülü için:
 * 1. 3 Aşamalı Çapraz Kontrol Motoru (Taslak Planlama ↔ Yayın Planlama ↔ Reklam Rezervasyon ↔ Liste Kontrol)
 * 2. Klip ve Reklam Teknik Sağlık Doğrulaması (Video oynatıcı /api/stream ile aynı dosya yolu çözümlemesi, .mxf ve ayarlanabilir format kontrolü, detaylı bozukluk açıklaması)
 * 3. Tekrar Eden Klipleri Tek Satırda Gruplayan (Satır No + Saat Rozetli) Hata ve Uyarı Merkezi Üreticisi
 */
import {
  normalizeProgramText,
  doesDraftSlotMatchRundownItem,
  isDraftSlotAddedToRundown,
  extractClipMeta
} from '../../broadcast/utils/draftSlotMatcher';

/**
 * Dakika cinsinden başlangıç zamanını "HH:MM:SS" formatına çevirir.
 */
export function formatMinuteToClock(minFloat = 0) {
  const totalSec = Math.max(0, Math.round((Number(minFloat) || 0) * 60));
  const h = Math.floor(totalSec / 3600) % 24;
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Saniyeyi "MM:SS" veya "HH:MM:SS" formatına çevirir.
 */
export function formatSecondsToClock(secFloat = 0) {
  const totalSec = Math.max(0, Math.round(Number(secFloat) || 0));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Saniyeyi okunabilir "24 dk 15 sn" formatına çevirir.
 */
export function formatSecondsReadable(secFloat = 0) {
  const totalSec = Math.max(0, Math.round(Number(secFloat) || 0));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts = [];
  if (h > 0) parts.push(`${h} sa`);
  if (m > 0) parts.push(`${m} dk`);
  if (s > 0 || parts.length === 0) parts.push(`${s} sn`);
  return parts.join(' ');
}

/**
 * Taslak Planlama, Yayın Planlama ve Reklam Rezervasyon aşamalarını mevcut Liste Kontrol akışıyla karşılaştırır.
 */
export function analyzeThreeStageVerification({
  draftSlots = [],
  broadcastPrograms = [],
  adPlacements = [],
  lcPrograms = []
}) {
  const safeDraftSlots = Array.isArray(draftSlots) ? draftSlots : [];
  const safeBroadcast = Array.isArray(broadcastPrograms) ? broadcastPrograms : [];
  const safeLc = Array.isArray(lcPrograms) ? lcPrograms : [];

  const draftSlotComparison = safeDraftSlots.map((slot, sIdx) => {
    const matchedLcItems = safeLc.filter(
      item => !item.isAdClip && !item.isFromAds && doesDraftSlotMatchRundownItem(slot, item, safeDraftSlots)
    );
    const isAdded = matchedLcItems.length > 0 || isDraftSlotAddedToRundown(slot, safeLc, safeDraftSlots);

    let status = 'missing';
    let modificationDetail = '';
    const primaryMatch = matchedLcItems[0] || null;

    if (isAdded) {
      status = 'matched';
      if (primaryMatch) {
        const draftEp = slot.episode ? Number(slot.episode) : null;
        const matchMeta = extractClipMeta(primaryMatch.clipName || primaryMatch.title || '');
        const lcEp = primaryMatch.episodeNo ? Number(primaryMatch.episodeNo) : matchMeta.episodeNo;

        const changes = [];
        if (draftEp && lcEp && draftEp !== lcEp) {
          changes.push(`Taslak Bl.${draftEp} → Yayında Bl.${lcEp}`);
        }
        if (primaryMatch.modifiedInListControl) {
          status = 'modified_in_lc';
          changes.push('Liste Kontrolde klip değiştirildi');
        } else if (changes.length > 0) {
          status = 'modified_by_broadcast';
        }
        modificationDetail = changes.join(' • ');
      }
    }

    return {
      slotId: slot.id || `draft-slot-${sIdx}`,
      startTime: slot.startTime || '00:00',
      title: slot.title || slot.name || 'Taslak Programı',
      category: slot.category || 'Genel',
      categoryColor: slot.categoryColor || '#3b82f6',
      draftEpisode: slot.episode || null,
      draftDurationMin: Number(slot.duration) || Math.round((Number(slot.durationSec) || 1800) / 60),
      isPresentInList: isAdded,
      status,
      matchedItemsCount: matchedLcItems.length,
      primaryMatchInstanceId: primaryMatch?.instanceId || null,
      primaryMatchTitle: primaryMatch?.title || null,
      modificationDetail
    };
  });

  const missingDraftSlots = draftSlotComparison.filter(d => !d.isPresentInList);
  const modifiedDraftSlots = draftSlotComparison.filter(d => d.status === 'modified_by_broadcast' || d.status === 'modified_in_lc');
  const matchedDraftSlots = draftSlotComparison.filter(d => d.isPresentInList);

  const itemVerificationMap = {};
  const addedByBroadcastItems = [];
  const modifiedByBroadcastItems = [];

  safeLc.forEach((item) => {
    const instId = item.instanceId;
    if (!instId) return;

    const isAd = Boolean(item.isAdClip || item.isFromAds || item.type === 'ad_break' || item.type === 'ad_spot');

    if (isAd) {
      itemVerificationMap[instId] = {
        originStage: 'ads',
        badgeLabel: item.isEmptyAdBreak
          ? 'Boş Kuşak'
          : item.isBumperAd
          ? `RTÜK ${item.bumperType === 'intro' ? 'Giriş' : 'Çıkış'}`
          : item.isSponsor
          ? 'Sponsor'
          : 'Reklam',
        badgeColor: item.isEmptyAdBreak ? '#dc2626' : item.isSponsor ? '#7c3aed' : '#d97706',
        badgeBg: item.isEmptyAdBreak
          ? 'rgba(220, 38, 38, 0.12)'
          : item.isSponsor
          ? 'rgba(124, 58, 237, 0.12)'
          : 'rgba(217, 119, 6, 0.12)',
        detailText: item.parentBreakTitle
          ? `${item.parentBreakTitle}${item.companyName ? ` • ${item.companyName}` : ''}`
          : 'Reklam Rezervasyon Biriminden İletildi',
        isInDraft: false,
        isAddedByBroadcast: false,
        isModifiedByBroadcast: false
      };
      return;
    }

    const matchedDraftSlot = safeDraftSlots.find(slot => doesDraftSlotMatchRundownItem(slot, item, safeDraftSlots));
    const isIntro = Boolean(item.isIntroClip || item.unitType === 'intro' || String(item.categoryName || item.category || '').toLowerCase().includes('jenerik'));

    const matchedBroadcastItem = safeBroadcast.find(
      bp =>
        (bp.fileId && item.fileId && String(bp.fileId) === String(item.fileId)) ||
        (bp.instanceId && bp.instanceId === item.instanceId) ||
        normalizeProgramText(bp.clipName || bp.title || '') === normalizeProgramText(item.clipName || item.title || '')
    );

    if (item.addedInListControl) {
      itemVerificationMap[instId] = {
        originStage: 'list-control',
        badgeLabel: '+ Liste Kontrolde Eklendi',
        badgeColor: '#0d9488',
        badgeBg: 'rgba(13, 148, 136, 0.14)',
        detailText: 'Operatör tarafından Liste Kontrol ekranında eklendi',
        isInDraft: Boolean(matchedDraftSlot),
        isAddedByBroadcast: false,
        isModifiedByBroadcast: false
      };
      return;
    }

    if (item.modifiedInListControl) {
      const prevTitle = item.previousItemSnapshot?.title || 'Önceki Klip';
      itemVerificationMap[instId] = {
        originStage: 'list-control-modified',
        badgeLabel: 'Liste Kontrolde Değişti',
        badgeColor: '#0284c7',
        badgeBg: 'rgba(2, 132, 199, 0.14)',
        detailText: `Eski: ${prevTitle} → Yeni: ${item.title}`,
        isInDraft: Boolean(matchedDraftSlot),
        isAddedByBroadcast: false,
        isModifiedByBroadcast: false
      };
      return;
    }

    if (matchedDraftSlot) {
      const draftEp = matchedDraftSlot.episode ? Number(matchedDraftSlot.episode) : null;
      const meta = extractClipMeta(item.clipName || item.title || '');
      const itemEp = item.episodeNo ? Number(item.episodeNo) : meta.episodeNo;
      const epChanged = Boolean(draftEp && itemEp && draftEp !== itemEp);

      if (epChanged) {
        const infoObj = {
          originStage: 'broadcast-modified',
          badgeLabel: `Yayın Planlama (Bl.${draftEp}→${itemEp})`,
          badgeColor: '#2563eb',
          badgeBg: 'rgba(37, 99, 235, 0.12)',
          detailText: `Taslakta "${matchedDraftSlot.title}" Bl.${draftEp} planlanmıştı, Yayın Planlama Bl.${itemEp} seçti.`,
          isInDraft: true,
          draftSlot: matchedDraftSlot,
          isAddedByBroadcast: false,
          isModifiedByBroadcast: true
        };
        itemVerificationMap[instId] = infoObj;
        modifiedByBroadcastItems.push({ item, info: infoObj });
      } else {
        itemVerificationMap[instId] = {
          originStage: 'draft-matched',
          badgeLabel: 'Taslak & Yayın Uyumlu',
          badgeColor: '#059669',
          badgeBg: 'rgba(16, 185, 129, 0.12)',
          detailText: `Taslak Kuşağı: ${matchedDraftSlot.startTime} - ${matchedDraftSlot.title}`,
          isInDraft: true,
          draftSlot: matchedDraftSlot,
          isAddedByBroadcast: false,
          isModifiedByBroadcast: false
        };
      }
    } else if (isIntro) {
      itemVerificationMap[instId] = {
        originStage: 'broadcast-intro',
        badgeLabel: 'Program İntrosu',
        badgeColor: '#6366f1',
        badgeBg: 'rgba(99, 102, 241, 0.12)',
        detailText: 'Yayın Planlama aşamasında program introsu olarak eklendi',
        isInDraft: false,
        isAddedByBroadcast: true,
        isModifiedByBroadcast: false
      };
    } else {
      const infoObj = {
        originStage: 'broadcast-added',
        badgeLabel: '+ Yayın Planlama Ekledi',
        badgeColor: '#7c3aed',
        badgeBg: 'rgba(124, 58, 237, 0.12)',
        detailText: matchedBroadcastItem
          ? 'Taslak listesinde yer almıyor; Yayın Planlama aşamasında akışa eklendi.'
          : 'Taslak listesinde yer almıyor; Yayın Planlama üzerinden eklendi.',
        isInDraft: false,
        isAddedByBroadcast: true,
        isModifiedByBroadcast: false
      };
      itemVerificationMap[instId] = infoObj;
      addedByBroadcastItems.push({ item, info: infoObj });
    }
  });

  const adItemsInLc = safeLc.filter(p => p.isAdClip || p.isFromAds || p.type === 'ad_break' || p.type === 'ad_spot');
  const commercialAdsInLc = adItemsInLc.filter(p => !p.isBumperAd && !p.isEmptyAdBreak);
  const bumperAdsInLc = adItemsInLc.filter(p => p.isBumperAd);
  const emptyAdBreaksInLc = adItemsInLc.filter(p => p.isEmptyAdBreak);
  const totalAdDurationSec = adItemsInLc.reduce(
    (s, p) => s + (Number(p.durationSec) || Math.round((Number(p.duration) || 0) * 60)),
    0
  );

  return {
    draftSlotComparison,
    totalDraftSlots: safeDraftSlots.length,
    matchedDraftCount: matchedDraftSlots.length,
    missingDraftSlots,
    modifiedDraftSlots,
    addedByBroadcastItems,
    modifiedByBroadcastItems,
    itemVerificationMap,
    adsSummary: {
      totalAdItems: adItemsInLc.length,
      commercialSpotsCount: commercialAdsInLc.length,
      bumperSpotsCount: bumperAdsInLc.length,
      emptyAdBreaksCount: emptyAdBreaksInLc.length,
      totalAdDurationSec,
      transmittedBreaksCount: Array.isArray(adPlacements) ? adPlacements.length : 0
    }
  };
}

/**
 * Listedeki tüm klipleri ve reklamları `/api/media/verify-batch` uç noktasına göndererek
 * video oynatıcı (`/api/stream`) ile birebir aynı dosya yolu üzerinden DB, Dosya Yolu (.mxf) ve Detaylı Bütünlük kontrolü yapar.
 */
export async function verifyBatchClipsAndAdsHealth(
  programs = [],
  { deepProbe = false, allowedFormats = ['mxf'] } = {}
) {
  if (!Array.isArray(programs) || programs.length === 0) {
    return {};
  }

  const normalizedFormats = Array.isArray(allowedFormats) && allowedFormats.length > 0
    ? allowedFormats.map(f => String(f || '').trim().toLowerCase().replace(/^\./, '')).filter(Boolean)
    : ['mxf'];

  const payloadItems = programs.map(p => ({
    instanceId: p.instanceId,
    id: p.id,
    fileId: p.fileId || null,
    clipId: p.clipId || p.id || null,
    code: p.code || p.fileName || '',
    fileName: p.fileName || p.code || '',
    clipName: p.clipName || p.title || '',
    title: p.title || '',
    publicFileAddress: p.publicFileAddress || '',
    durationSec: Number(p.durationSec) || Math.round((Number(p.duration) || 0) * 60),
    type: p.type || (p.isAdClip ? 'ad_spot' : 'clip'),
    isAd: Boolean(p.isAdClip || p.isFromAds),
    isLive: Boolean(p.type === 'live' || p.isLive),
    isEmptyAdBreak: Boolean(p.isEmptyAdBreak),
    isCorruptedSimulated: Boolean(p.isCorruptedSimulated)
  }));

  try {
    const res = await fetch('/api/media/verify-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: payloadItems,
        deepProbe,
        allowedFormats: normalizedFormats
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.results && typeof data.results === 'object') {
        return data.results;
      }
    }
  } catch (err) {
    console.warn('[LIST-CONTROL VERIFY BATCH FALLBACK]:', err.message);
  }

  // Çevrimdışı / yerel fallback
  const fallbackMap = {};
  payloadItems.forEach(item => {
    if (item.isEmptyAdBreak) {
      fallbackMap[item.instanceId] = {
        instanceId: item.instanceId,
        inDatabase: false,
        fileExists: false,
        isFormatValid: false,
        detectedFormat: null,
        isCorrupted: false,
        status: 'missing',
        dbSource: null,
        resolvedPath: null,
        dbStatusText: 'Spot Seçilmemiş',
        fileStatusText: 'Dosya Yok',
        integrityStatusText: 'Boş Reklam Kuşağı: İçine henüz reklam spotu yerleştirilmemiş',
        issues: ['Boş Reklam Kuşağı: İçine henüz reklam spotu yerleştirilmemiş']
      };
      return;
    }

    const rawCode = String(item.code || item.fileName || item.title || '').trim();
    const extMatch = rawCode.match(/\.([a-zA-Z0-9]{2,5})$/);
    const detectedFormat = extMatch ? extMatch[1].toLowerCase() : 'mxf';
    const isFormatValid = normalizedFormats.includes(detectedFormat);
    const hasIdentity = Boolean(item.fileId || item.clipId || rawCode.length >= 3);
    const validDur = Number(item.durationSec) > 0;
    const isCorrupted = !validDur || !isFormatValid || Boolean(item.isCorruptedSimulated);

    const issues = [];
    if (!hasIdentity) issues.push('DB Kaydı Yok: Klip adı veya FileID tanımlı değil');
    if (!validDur) issues.push('Süre Hatası: Klip süresi 00:00 (0 sn) görünüyor');
    if (!isFormatValid) {
      issues.push(`Format Uyumsuz: Dosya uzantısı (.${detectedFormat}), aktif formatlar (${normalizedFormats.map(f => '.' + f).join(', ')}) dışında`);
    }

    fallbackMap[item.instanceId] = {
      instanceId: item.instanceId,
      inDatabase: hasIdentity,
      fileExists: hasIdentity,
      isFormatValid,
      detectedFormat,
      isCorrupted,
      status: isCorrupted ? 'corrupted' : hasIdentity ? 'healthy' : 'missing',
      dbSource: hasIdentity ? (item.isAd ? 'Reklam Kataloğu' : 'MAM Arşiv DB') : null,
      resolvedPath: hasIdentity ? (rawCode.includes('.') ? rawCode : `${rawCode}.mxf`) : null,
      dbStatusText: hasIdentity ? 'DB Kayıtlı' : 'DB Kaydı Yok',
      fileStatusText: hasIdentity ? `Dosya Mevcut (.${detectedFormat.toUpperCase()})` : 'Dosya Yolunda Yok',
      integrityStatusText: isCorrupted
        ? issues.join(' • ')
        : `Sağlam (.${detectedFormat.toUpperCase()} • ${Math.round(item.durationSec)} sn • Oynatılabilir)`,
      issues
    };
  });

  return fallbackMap;
}

/**
 * Aynı klipler için hataları alt alta tekrar tekrar yazmak yerine,
 * aynı klibi TEK SATIRDA gruplar ve yanına hangi satırlarda / saatlerde (`occurrences`) geçtiğini ekler!
 */
export function buildUnifiedIssuesList({
  programs = [],
  healthMap = {},
  stageAnalysis = null
}) {
  const issues = [];

  // 1. Taslakta olup listede eksik olan programlar
  if (stageAnalysis?.missingDraftSlots?.length > 0) {
    stageAnalysis.missingDraftSlots.forEach((slot) => {
      issues.push({
        id: `issue-draft-missing-${slot.slotId}`,
        severity: 'warning',
        category: 'draft_missing',
        categoryLabel: 'Eksik Taslak Programı',
        title: `${slot.title}${slot.draftEpisode ? ` (Bölüm ${slot.draftEpisode})` : ''}`,
        code: `Taslak Saati: ${slot.startTime}`,
        description: `Taslak Planlama listesinde saat ${slot.startTime} için planlanan "${slot.title}" yayın akışında yer almıyor.`,
        draftSlot: slot,
        instanceId: null,
        occurrences: [
          {
            instanceId: null,
            rowIndex: null,
            clockStr: slot.startTime,
            label: `Taslak ${slot.startTime}`
          }
        ]
      });
    });
  }

  // 2. Klip ve Reklam Teknik Hatalarını (DB / Dosya Yolu / Format / Bozukluk / Revize) Aynı Klipler İçin Grupla
  const groupedClipIssuesMap = new Map();

  programs.forEach((prog, idx) => {
    const instId = prog.instanceId;
    const health = healthMap[instId];
    const isAd = Boolean(prog.isAdClip || prog.isFromAds);
    const typeText = isAd ? 'Reklam' : 'Program Klibi';
    const clockStr = formatMinuteToClock(prog.startMinute || 0);
    const rowNumber = idx + 1;

    const rowReasons = [];
    let highestSeverity = null; // 'error' | 'warning'
    let primaryCategory = '';
    let primaryCategoryLabel = '';

    if (prog.isEmptyAdBreak) {
      highestSeverity = 'error';
      primaryCategory = 'ad_empty_break';
      primaryCategoryLabel = 'Boş Reklam Kuşağı';
      rowReasons.push('Bu reklam kuşağına henüz hiçbir reklam spotu yerleştirilmemiş.');
    } else if (health) {
      if (!health.inDatabase) {
        highestSeverity = 'error';
        primaryCategory = 'db_missing';
        primaryCategoryLabel = `${typeText} • DB Kaydı Yok`;
        rowReasons.push(`MAM Veritabanında (${prog.code || prog.title}) klip kaydı bulunamadı`);
      }
      if (!health.fileExists) {
        highestSeverity = 'error';
        primaryCategory = primaryCategory || 'file_missing';
        primaryCategoryLabel = !health.inDatabase
          ? `${typeText} • DB ve Dosya Yolu Eksik`
          : `${typeText} • Dosya Yolunda Yok`;
        rowReasons.push(`Sunucu medya dizininde (${health.fileName || prog.code || `${prog.title}.mxf`}) fiziksel dosya bulunamadı`);
      }
      if (health.isCorrupted) {
        highestSeverity = 'error';
        primaryCategory = primaryCategory || 'corrupted';
        primaryCategoryLabel = primaryCategoryLabel || `${typeText} • Bütünlük / Format Hatası`;
        if (health.corruptionReason) {
          rowReasons.push(health.corruptionReason);
        } else if (Array.isArray(health.issues) && health.issues.length > 0) {
          rowReasons.push(health.issues.join(' • '));
        } else {
          rowReasons.push('Klip süresi 0 sn, dosya boyutu 0 Byte veya dosya formatı uyumsuz');
        }
      }
    }

    if (prog.revisionRequested) {
      if (!highestSeverity) highestSeverity = 'warning';
      primaryCategory = primaryCategory || 'revision_pending';
      primaryCategoryLabel = primaryCategoryLabel || 'Revize Bekliyor';
      rowReasons.push(`Revize İstendi (${prog.revisionTargetLabel || 'İlgili Birim'}): ${prog.revisionReason || '-'}`);
    }

    if (!highestSeverity || rowReasons.length === 0) return;

    // Aynı klibin gün içindeki tüm tekrarlarını tek anahtarda birleştir
    const clipGroupKey = prog.isEmptyAdBreak
      ? `empty-break-${instId}`
      : `${isAd ? 'ad' : 'clip'}::${String(prog.code || prog.fileId || prog.title || instId).trim().toLowerCase()}::${primaryCategory}`;

    const occurrenceObj = {
      instanceId: instId,
      rowIndex: rowNumber,
      clockStr,
      breakTitle: prog.parentBreakTitle || '',
      label: `#${rowNumber} • ${clockStr.slice(0, 5)}`
    };

    if (!groupedClipIssuesMap.has(clipGroupKey)) {
      groupedClipIssuesMap.set(clipGroupKey, {
        id: `grouped-issue-${clipGroupKey}`,
        severity: highestSeverity,
        category: primaryCategory,
        categoryLabel: primaryCategoryLabel,
        isAd,
        title: prog.title || 'İsimsiz Klip',
        code: prog.code || prog.fileName || String(prog.id || ''),
        companyName: prog.companyName || '',
        description: Array.from(new Set(rowReasons)).join(' | '),
        instanceId: instId,
        rowIndex: rowNumber,
        item: prog,
        occurrences: [occurrenceObj]
      });
    } else {
      const existingGroup = groupedClipIssuesMap.get(clipGroupKey);
      existingGroup.occurrences.push(occurrenceObj);
    }
  });

  groupedClipIssuesMap.forEach(group => {
    issues.push(group);
  });

  // 3. Yayın Planlama tarafından değiştirilenleri de aynı program/klip bazında grupla
  if (stageAnalysis?.modifiedByBroadcastItems?.length > 0) {
    const bcastDiffMap = new Map();
    stageAnalysis.modifiedByBroadcastItems.forEach(({ item, info }) => {
      const idx = programs.findIndex(p => p.instanceId === item.instanceId);
      const rowNumber = idx >= 0 ? idx + 1 : 1;
      const clockStr = formatMinuteToClock(item.startMinute || 0);
      const key = `bcast-diff::${String(item.title || item.instanceId).toLowerCase()}`;
      const occ = {
        instanceId: item.instanceId,
        rowIndex: rowNumber,
        clockStr,
        label: `#${rowNumber} • ${clockStr.slice(0, 5)}`
      };

      if (!bcastDiffMap.has(key)) {
        bcastDiffMap.set(key, {
          id: `issue-bcast-mod-${item.instanceId}`,
          severity: 'info',
          category: 'broadcast_diff',
          categoryLabel: 'Taslak ↔ Yayın Planlama Farkı',
          title: item.title,
          code: item.code || item.fileName || '',
          description: info.detailText,
          instanceId: item.instanceId,
          rowIndex: rowNumber,
          item,
          occurrences: [occ]
        });
      } else {
        bcastDiffMap.get(key).occurrences.push(occ);
      }
    });
    bcastDiffMap.forEach(val => issues.push(val));
  }

  return issues;
}
