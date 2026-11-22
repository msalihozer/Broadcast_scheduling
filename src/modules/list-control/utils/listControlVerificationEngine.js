/**
 * @file src/modules/list-control/utils/listControlVerificationEngine.js
 * @description Yayın Liste Kontrol Modülü için:
 * 1. 3 Aşamalı Çapraz Kontrol Motoru (Taslak Planlama ↔ Yayın Planlama ↔ Reklam Rezervasyon ↔ Liste Kontrol)
 * 2. Klip ve Reklam Teknik Sağlık Doğrulaması (DB'de var mı? • Dosya yolunda var mı? • Klip bozuk mu?)
 * 3. Hatalar, Sorunlar ve Uyarılar Merkezi Üreticisi
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

  // 1. Taslak Planlamadaki her bir kuşağın listede var olup olmadığını ve Yayın Planlama tarafından değiştirilip değiştirilmediğini kontrol et
  const draftSlotComparison = safeDraftSlots.map((slot, sIdx) => {
    const matchedLcItems = safeLc.filter(
      item => !item.isAdClip && !item.isFromAds && doesDraftSlotMatchRundownItem(slot, item, safeDraftSlots)
    );
    const isAdded = matchedLcItems.length > 0 || isDraftSlotAddedToRundown(slot, safeLc, safeDraftSlots);

    let status = 'missing'; // 'matched' | 'modified_by_broadcast' | 'modified_in_lc' | 'missing'
    let modificationDetail = '';
    const primaryMatch = matchedLcItems[0] || null;

    if (isAdded) {
      status = 'matched';
      if (primaryMatch) {
        const draftEp = slot.episode ? Number(slot.episode) : null;
        const matchMeta = extractClipMeta(primaryMatch.clipName || primaryMatch.title || '');
        const lcEp = primaryMatch.episodeNo ? Number(primaryMatch.episodeNo) : matchMeta.episodeNo;

        const draftDurSec = Number(slot.durationSec) || (Number(slot.duration) || 30) * 60;
        const matchedTotalSec = matchedLcItems.reduce(
          (sum, it) => sum + (Number(it.durationSec) || Math.round((Number(it.duration) || 0) * 60)),
          0
        );

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

  // 2. Liste Kontroldeki her bir satırın aşama kökenini (Taslakta Var / Yayın Planlama Ekledi / Yayın Planlama Değiştirdi / Reklam Rezervasyon / Liste Kontrol) belirle
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
          ? '⚠️ Boş Reklam Kuşağı'
          : item.isBumperAd
          ? `📢 RTÜK ${item.bumperType === 'intro' ? 'Giriş' : 'Çıkış'} Jeneriği`
          : item.isSponsor
          ? '🏆 Sponsor Reklam'
          : '📢 Reklam Rezervasyon',
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

    // Bu klip/program Taslak Planlamadaki herhangi bir kuşakla eşleşiyor mu?
    const matchedDraftSlot = safeDraftSlots.find(slot => doesDraftSlotMatchRundownItem(slot, item, safeDraftSlots));
    const isIntro = Boolean(item.isIntroClip || item.unitType === 'intro' || String(item.categoryName || item.category || '').toLowerCase().includes('jenerik'));

    // Yayın Planlamadaki karşılığını kontrol et
    const matchedBroadcastItem = safeBroadcast.find(
      bp =>
        (bp.fileId && item.fileId && String(bp.fileId) === String(item.fileId)) ||
        (bp.instanceId && bp.instanceId === item.instanceId) ||
        normalizeProgramText(bp.clipName || bp.title || '') === normalizeProgramText(item.clipName || item.title || '')
    );

    if (item.addedInListControl) {
      itemVerificationMap[instId] = {
        originStage: 'list-control',
        badgeLabel: '➕ Liste Kontrolde Eklendi',
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
        badgeLabel: '✏️ Liste Kontrolde Değiştirildi',
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
          badgeLabel: `🔄 Yayın Planlama Değiştirdi (Taslak Bl.${draftEp} → Bl.${itemEp})`,
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
          badgeLabel: '✓ Taslak & Yayın Uyumlu',
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
        badgeLabel: '🎬 Yayın Planlama (İntro / Jenerik)',
        badgeColor: '#6366f1',
        badgeBg: 'rgba(99, 102, 241, 0.12)',
        detailText: 'Yayın Planlama aşamasında otomatik program introsu olarak eklendi',
        isInDraft: false,
        isAddedByBroadcast: true,
        isModifiedByBroadcast: false
      };
    } else {
      // Taslakta yok ama Yayın Planlama tarafından eklenmiş!
      const infoObj = {
        originStage: 'broadcast-added',
        badgeLabel: '➕ Taslakta Yok • Yayın Planlama Ekledi',
        badgeColor: '#7c3aed',
        badgeBg: 'rgba(124, 58, 237, 0.12)',
        detailText: matchedBroadcastItem
          ? 'Taslak listesinde yer almıyor; Yayın Planlama aşamasında akışa eklendi.'
          : 'Taslak listesinde yer almıyor; Yayın Planlama / Akış üzerinden eklendi.',
        isInDraft: false,
        isAddedByBroadcast: true,
        isModifiedByBroadcast: false
      };
      itemVerificationMap[instId] = infoObj;
      addedByBroadcastItems.push({ item, info: infoObj });
    }
  });

  // 3. Reklam Kuşakları Özeti
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
 * 1. DB'de var mı? (`inDatabase`)
 * 2. Dosya yolunda var mı? (`fileExists`)
 * 3. Klip bozuk mu? (`isCorrupted`)
 * kontrollerini gerçekleştirir.
 */
export async function verifyBatchClipsAndAdsHealth(programs = [], { deepProbe = false } = {}) {
  if (!Array.isArray(programs) || programs.length === 0) {
    return {};
  }

  const payloadItems = programs.map(p => ({
    instanceId: p.instanceId,
    id: p.id,
    fileId: p.fileId || null,
    clipId: p.clipId || p.id || null,
    code: p.code || p.fileName || '',
    fileName: p.fileName || p.code || '',
    clipName: p.clipName || p.title || '',
    title: p.title || '',
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
      body: JSON.stringify({ items: payloadItems, deepProbe })
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

  // Sunucuya ulaşılamazsa istemci taraflı hızlı doğrulama fallback'i
  const fallbackMap = {};
  payloadItems.forEach(item => {
    if (item.isEmptyAdBreak) {
      fallbackMap[item.instanceId] = {
        instanceId: item.instanceId,
        inDatabase: false,
        fileExists: false,
        isCorrupted: false,
        status: 'missing',
        dbSource: null,
        resolvedPath: null,
        issues: ['Boş reklam kuşağı — içine reklam spotu yerleştirilmemiş']
      };
      return;
    }
    const rawNum = String(item.fileId || item.clipId || item.id || item.code || '').replace(/\D+/g, '');
    const hasValidId = rawNum.length >= 4 || /\.(mxf|mp4|mov|avi)$/i.test(String(item.code || item.fileName || ''));
    const validDur = Number(item.durationSec) > 0;
    const isCorrupted = !validDur || Boolean(item.isCorruptedSimulated);

    fallbackMap[item.instanceId] = {
      instanceId: item.instanceId,
      inDatabase: hasValidId,
      fileExists: hasValidId,
      isCorrupted,
      status: isCorrupted ? 'corrupted' : hasValidId ? 'healthy' : 'missing',
      dbSource: hasValidId ? (item.isAd ? 'Reklam Kataloğu' : 'MAM Arşiv DB') : null,
      resolvedPath: hasValidId ? (item.code || item.fileName || `${rawNum}.mxf`) : null,
      issues: [
        ...(!hasValidId ? ['DB ve dosya kodu eksik'] : []),
        ...(!validDur ? ['Klip süresi 0 sn veya geçersiz'] : [])
      ]
    };
  });

  return fallbackMap;
}

/**
 * Tüm teknik ve editoryal kontrollerden Uyarılar, Hatalar ve Sorunlar listesini üretir.
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
        severity: 'warning', // 'error' | 'warning' | 'info'
        category: 'draft_missing',
        categoryLabel: 'Taslak Kontrolü',
        title: `Taslakta Planlanan "${slot.title}" Listede Yok`,
        description: `Taslak Planlamada saat ${slot.startTime} için planlanan "${slot.title}"${slot.draftEpisode ? ` (Bölüm ${slot.draftEpisode})` : ''} yayın listesinde bulunamadı.`,
        draftSlot: slot,
        instanceId: null
      });
    });
  }

  // 2. Satır bazlı DB, Dosya Yolu, Bozukluk ve Revize sorunları (Hem Klipler Hem Reklamlar İçin)
  programs.forEach((prog, idx) => {
    const instId = prog.instanceId;
    const health = healthMap[instId];
    const isAd = Boolean(prog.isAdClip || prog.isFromAds);
    const typeText = isAd ? 'Reklam' : 'Program Klibi';
    const clockStr = formatMinuteToClock(prog.startMinute || 0);

    if (prog.isEmptyAdBreak) {
      issues.push({
        id: `issue-empty-break-${instId}`,
        severity: 'error',
        category: 'ad_empty_break',
        categoryLabel: 'Reklam Kuşağı Hatası',
        title: `${clockStr} • Boş Reklam Kuşağı (${prog.parentBreakTitle || prog.title})`,
        description: 'Bu reklam kuşağına hiçbir reklam spotu yerleştirilmemiş. Sol panelden reklam ekleyebilir veya Reklam Rezervasyondan revize isteyebilirsiniz.',
        instanceId: instId,
        rowIndex: idx + 1,
        item: prog
      });
      return;
    }

    if (health) {
      if (!health.inDatabase) {
        issues.push({
          id: `issue-db-${instId}`,
          severity: 'error',
          category: 'db_missing',
          categoryLabel: `${typeText} DB Hatası`,
          title: `${clockStr} • #${idx + 1} "${prog.title}" Veritabanında (DB) Bulunamadı`,
          description: `${typeText} (${prog.code || prog.id || 'Kodsuz'}) MAM / Katalog veritabanında kayıtlı değil.`,
          instanceId: instId,
          rowIndex: idx + 1,
          item: prog
        });
      }
      if (!health.fileExists) {
        issues.push({
          id: `issue-file-${instId}`,
          severity: 'error',
          category: 'file_missing',
          categoryLabel: `${typeText} Dosya Yolu Hatası`,
          title: `${clockStr} • #${idx + 1} "${prog.title}" Fiziksel Dosya Yolunda Yok`,
          description: `${typeText} (${prog.code || prog.fileName || prog.id || 'Dosya Adı Yok'}) medya sunucusu dosya yolunda (/mnt/tv_mam/HighRes veya Arşiv) bulunamadı.`,
          instanceId: instId,
          rowIndex: idx + 1,
          item: prog
        });
      }
      if (health.isCorrupted) {
        issues.push({
          id: `issue-corrupt-${instId}`,
          severity: 'error',
          category: 'corrupted',
          categoryLabel: `${typeText} Bozuk Klip`,
          title: `${clockStr} • #${idx + 1} "${prog.title}" Klip Bozuk / Geçersiz Süre`,
          description: (health.issues && health.issues.join(' • ')) || 'Klip süresi 0 sn, dosya boyutu 0 byte veya video akışı bozuk.',
          instanceId: instId,
          rowIndex: idx + 1,
          item: prog
        });
      }
    }

    if (prog.revisionRequested) {
      issues.push({
        id: `issue-rev-${instId}`,
        severity: 'warning',
        category: 'revision_pending',
        categoryLabel: 'Revize Bekliyor',
        title: `${clockStr} • #${idx + 1} "${prog.title}" İçin Revize İstendi (${prog.revisionTargetLabel || 'İlgili Birim'})`,
        description: `Revize Notu: ${prog.revisionReason || '-'}`,
        instanceId: instId,
        rowIndex: idx + 1,
        item: prog
      });
    }
  });

  // 3. Yayın Planlama tarafından değiştirilen veya taslak dışı eklenenlerin bilgilendirme özeti
  if (stageAnalysis?.modifiedByBroadcastItems?.length > 0) {
    stageAnalysis.modifiedByBroadcastItems.forEach(({ item, info }) => {
      const clockStr = formatMinuteToClock(item.startMinute || 0);
      issues.push({
        id: `issue-bcast-mod-${item.instanceId}`,
        severity: 'info',
        category: 'broadcast_diff',
        categoryLabel: 'Taslak ↔ Yayın Planlama Farkı',
        title: `${clockStr} • "${item.title}" Yayın Planlama Tarafından Değiştirildi`,
        description: info.detailText,
        instanceId: item.instanceId,
        item
      });
    });
  }

  return issues;
}
