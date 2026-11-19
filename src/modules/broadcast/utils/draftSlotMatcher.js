/**
 * @file src/modules/broadcast/utils/draftSlotMatcher.js
 * @description Taslak kuşaklarını Admin Panel programlarıyla eşleştirme, klip metadata/bölüm/part ayrıştırma,
 * sabah/akşam tekrarlı kuşakların akışta eklenme durumunu denetleme ve bellek içi (in-memory) klip önbellekleme yardımcıları.
 */

const programClipsMemoryCache = new Map();

/**
 * Türkçe karakter ve noktalama duyarsız metin normalleştirici.
 */
export function normalizeProgramText(str) {
  return String(str || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[âîû]/g, (m) => ({ 'â': 'a', 'î': 'i', 'û': 'u' }[m] || m))
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Klip isminden eksik bölüm (episodeNo) ve parça (partNo) bilgilerini tamamlar.
 */
export function extractClipMeta(clip) {
  let episodeNo = clip.episodeNo;
  let partNo = clip.partNo;
  const rawName = clip.name || clip.fileName || '';

  if (partNo === null || partNo === undefined || partNo === '') {
    const pMatch = rawName.match(/(?:_|^|\s|-)(?:part|p|pt)[_-]?(\d+)(?:[_\s.-]|$)/i);
    if (pMatch) partNo = parseInt(pMatch[1], 10);
  }

  return {
    ...clip,
    episodeNo: episodeNo !== null && episodeNo !== undefined && episodeNo !== '' ? Number(episodeNo) : null,
    partNo: partNo !== null && partNo !== undefined && partNo !== '' ? Number(partNo) : null,
    unitType: clip.unitType || 'bolum',
    unitLabel: clip.unitLabel || (
      episodeNo !== null && episodeNo !== undefined && episodeNo !== ''
        ? (clip.unitType === 'cuz' ? `${episodeNo}. Cüz` : clip.unitType === 'gun' ? `${episodeNo}. Gün` : `Bölüm ${episodeNo}`)
        : null
    )
  };
}

/**
 * Taslak programını Admin Panel -> Programlar (usedPrograms) listesindeki karşılığı ile eşleştirir.
 */
export function findMatchingAdminPrograms(draftItem, usedPrograms = []) {
  if (!draftItem || !Array.isArray(usedPrograms) || usedPrograms.length === 0) return [];

  if (draftItem.programId) {
    const byId = usedPrograms.filter(p => Number(p.id) === Number(draftItem.programId));
    if (byId.length > 0) return byId;
  }

  const rawTitle = draftItem.title || draftItem.name || '';
  const normDraft = normalizeProgramText(rawTitle);
  if (!normDraft) return [];

  if (normDraft.includes('dolgu kusagi') || draftItem.isKisaSlot) {
    const kisaProgs = usedPrograms.filter(p => Number(p.categoryId) === 10);
    if (kisaProgs.length > 0) return kisaProgs;
  }

  const exact = usedPrograms.filter(p => normalizeProgramText(p.title) === normDraft);
  if (exact.length > 0) return exact;

  const containsMatch = usedPrograms.filter(p => {
    const normP = normalizeProgramText(p.title);
    return normP.length >= 4 && (normDraft.includes(normP) || normP.includes(normDraft));
  });
  if (containsMatch.length > 0) return containsMatch;

  const specialAliases = [
    { match: ['kisas', 'enbiya'], target: ['kisas', 'enbiya'] },
    { match: ['ilim', 'dersler'], target: ['ilim', 'dersler'] },
    { match: ['tecvid'], target: ['ilim', 'dersler'] },
    { match: ['taliu', 'busra'], target: ['taliu'] },
    { match: ['taliu', 'bura'], target: ['taliu'] },
    { match: ['kuduri'], target: ['kuduri'] },
    { match: ['yakut'], target: ['yakut'] },
    { match: ['nefis'], target: ['nefis'] },
    { match: ['safvet'], target: ['safvet'] },
    { match: ['tefasir'], target: ['tefasir'] },
    { match: ['riyazus'], target: ['riyazus'] },
    { match: ['salihin'], target: ['salihin'] },
    { match: ['minhac'], target: ['minhac'] },
    { match: ['delail'], target: ['delail'] },
    { match: ['hatm', 'serif'], target: ['hatm', 'serif'] },
    { match: ['mukabele'], target: ['mukabele'] },
    { match: ['mevakib'], target: ['mevakib'] },
    { match: ['bes', 'vakit'], target: ['bes', 'vakit'] },
    { match: ['hacegan'], target: ['hacegan'] },
    { match: ['semerkand', 'sohbet'], target: ['semerkand', 'sohbet'] },
    { match: ['yuzyilin', 'alim'], target: ['yuzyilin', 'alim'] },
    { match: ['mesnevi'], target: ['mesnevi'] },
    { match: ['neseli', 'petek'], target: ['neseli', 'petek'] },
    { match: ['son', 'inci'], target: ['son', 'inci'] },
    { match: ['aziz', 'istanbul'], target: ['aziz', 'istanbul'] },
    { match: ['ulu', 'cami'], target: ['ulu', 'cami'] },
    { match: ['cerceve'], target: ['cerceve'] },
    { match: ['guzergah'], target: ['guzergah'] },
    { match: ['hasbihal'], target: ['hasbihal'] },
    { match: ['bedesten'], target: ['bedesten'] }
  ];

  const aliasMatches = [];
  for (const rule of specialAliases) {
    if (rule.match.every(k => normDraft.includes(k))) {
      const found = usedPrograms.filter(p => {
        const normP = normalizeProgramText(p.title);
        return rule.target.every(t => normP.includes(t));
      });
      for (const prog of found) {
        if (!aliasMatches.some(existing => existing.id === prog.id)) {
          aliasMatches.push(prog);
        }
      }
    }
  }
  if (aliasMatches.length > 0) {
    if (!draftItem.isKisaSlot) {
      const nonKisa = aliasMatches.filter(p => Number(p.categoryId) !== 10);
      if (nonKisa.length > 0) return nonKisa;
    }
    return aliasMatches;
  }

  const stopWords = new Set(['ilim', 'dersleri', 'programi', 'program', 'ozel', 'kusak', 'kusagi', 'yayini', 'bolum', 've', 'ile', 'el']);
  const draftWords = normDraft.split(' ').filter(w => w.length > 3 && !stopWords.has(w));
  if (draftWords.length > 0) {
    const wordMatches = usedPrograms.filter(p => {
      const normP = normalizeProgramText(p.title);
      return draftWords.some(w => normP.includes(w));
    });
    if (wordMatches.length > 0) return wordMatches;
  }

  return [];
}

/**
 * Klip için en doğru tarihi (timestamp) hesaplar.
 */
export function getClipTimestamp(clip) {
  if (clip.fileCreateTime) {
    const t = new Date(clip.fileCreateTime).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  const name = clip.name || clip.fileName || '';

  const ymd = name.match(/_(\d{4})(\d{2})(\d{2})_/);
  if (ymd) {
    const d = new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10));
    return d.getTime();
  }

  const dmy = name.match(/_(\d{2})(\d{2})(\d{2})(?:_|$)/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1;
    let year = parseInt(dmy[3], 10);
    year = year < 50 ? 2000 + year : 1900 + year;
    const d = new Date(year, month, day);
    return d.getTime();
  }

  return clip.fileId ? parseInt(clip.fileId, 10) * 1000 : 0;
}

/**
 * Başlangıç saati ("00:30") ve dakika süresinden bitiş saatini ("02:30") hesaplar.
 */
export function computeDraftEndTime(startTime, durationMin, explicitEndTime) {
  if (explicitEndTime && /^\d{2}:\d{2}$/.test(explicitEndTime)) return explicitEndTime;
  const parts = String(startTime || '00:00').split(':').map(n => parseInt(n, 10) || 0);
  const startTotalMin = (parts[0] * 60) + (parts[1] || 0);
  const endTotalMin = (startTotalMin + (parseInt(durationMin, 10) || 30)) % 1440;
  const hh = String(Math.floor(endTotalMin / 60)).padStart(2, '0');
  const mm = String(endTotalMin % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Saniyeyi okunaklı "27 dk 38 sn" formatına çevirir.
 */
export function formatClipDurationReadable(sec) {
  if (!sec || isNaN(sec)) return '0 dk';
  const totalSec = Math.round(sec);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h} sa ${m} dk${s > 0 ? ` ${s} sn` : ''}`;
  if (m > 0) return `${m} dk${s > 0 ? ` ${s} sn` : ''}`;
  return `${s} sn`;
}

/**
 * Belirli bir taslak kuşağının mevcut yayın akışına (rundown) eklenip eklenmediğini kontrol eder.
 * Doldurulmuş Dolgu Kuşağı kliplerini (`isFillerClip`) ve Reklam Kuşakları (`ad_break`) arasına
 * girmiş programları da doğru şekilde tanır.
 */
export function isDraftSlotAddedToRundown(draftItem, currentRundownPrograms = [], allDraftSlotsForDay = []) {
  if (!draftItem || !Array.isArray(currentRundownPrograms) || currentRundownPrograms.length === 0) {
    return false;
  }

  // İntro kliplerini ve Reklam Kuşaklarını ana program eşleşmesinde hariç tut
  const nonIntroPrograms = currentRundownPrograms.filter(rp => !rp.isIntroClip && rp.type !== 'ad_break');
  if (nonIntroPrograms.length === 0) return false;

  if (draftItem.id) {
    const exactIdMatch = nonIntroPrograms.some(
      rp => rp.draftId && String(rp.draftId) === String(draftItem.id)
    );
    if (exactIdMatch) return true;
  }

  const normDraftTitle = normalizeProgramText(draftItem.title || draftItem.name || '');
  const isDraftFiller = Boolean(
    draftItem.isKisaSlot ||
    normDraftTitle.includes('dolgu kusagi') ||
    normDraftTitle === 'dolgu'
  );

  if (draftItem.startTime && normDraftTitle) {
    const timeAndTitleMatch = nonIntroPrograms.some(rp => {
      if (rp.draftStartTime && rp.draftStartTime === draftItem.startTime) {
        if (isDraftFiller && (rp.type === 'filler_slot' || rp.isFillerClip || rp.category === 'Dolgu Kuşağı')) {
          return true;
        }
        const rpTitleNorm = normalizeProgramText(rp.title || rp.name || '');
        const rpNoteNorm = normalizeProgramText(rp.note || '');
        return rpTitleNorm.includes(normDraftTitle) || normDraftTitle.includes(rpTitleNorm) || rpNoteNorm.includes(normDraftTitle);
      }
      return false;
    });
    if (timeAndTitleMatch) return true;
  }

  // Dolgu Kuşağı özel kontrolü: Kullanıcı Dolgu Kuşağının içine klip doldurduysa (isFillerClip)
  // ve taslakta saatler/ID'ler kaydıysa, akıştaki mevcut dolgu grubu sayısını kontrol et
  const activeDraftIdSet = new Set(
    (allDraftSlotsForDay || []).map(d => (d?.id ? String(d.id) : null)).filter(Boolean)
  );

  if (isDraftFiller) {
    const unmatchedFillerGroups = [];
    const seenFillerGroupKeys = new Set();

    nonIntroPrograms.forEach((rp, idx) => {
      const isRpFiller = Boolean(
        rp.type === 'filler_slot' ||
        rp.isKisaSlot ||
        rp.isFillerClip ||
        rp.category === 'Dolgu Kuşağı' ||
        (rp.note && String(rp.note).startsWith('Dolgu Kuşağı'))
      );
      if (!isRpFiller) return;

      // Eğer bu dolgu grubu taslaktaki BAŞKA bir aktif dolgu kuşağına doğrudan ID ile bağlıysa atla
      if (
        rp.draftId &&
        draftItem.id &&
        String(rp.draftId) !== String(draftItem.id) &&
        activeDraftIdSet.has(String(rp.draftId))
      ) {
        return;
      }

      const gKey = rp.fillerGroupId || (rp.draftId ? `draft_${rp.draftId}` : `f_${idx}`);
      if (!seenFillerGroupKeys.has(gKey)) {
        seenFillerGroupKeys.add(gKey);
        unmatchedFillerGroups.push(rp);
      }
    });

    if (unmatchedFillerGroups.length === 0) return false;

    const unmatchedDraftFillers = (allDraftSlotsForDay || []).filter(d => {
      const nt = normalizeProgramText(d.title || d.name || '');
      const isDF = Boolean(d.isKisaSlot || nt.includes('dolgu kusagi') || nt === 'dolgu');
      if (!isDF) return false;
      return !nonIntroPrograms.some(rp => rp.draftId && d.id && String(rp.draftId) === String(d.id));
    });

    if (unmatchedDraftFillers.length <= 1) {
      return unmatchedFillerGroups.length >= 1;
    }

    const fillerOccurrenceIndex = unmatchedDraftFillers.findIndex(
      d => (d.id && d.id === draftItem.id) || (d.startTime === draftItem.startTime)
    );
    if (fillerOccurrenceIndex === -1) return unmatchedFillerGroups.length >= 1;
    return unmatchedFillerGroups.length > fillerOccurrenceIndex;
  }

  if (!normDraftTitle) return false;

  const matchingOrphanGroups = [];
  let prevGroupMatched = false;

  nonIntroPrograms.forEach(rp => {
    if (
      rp.draftId &&
      draftItem.id &&
      String(rp.draftId) !== String(draftItem.id) &&
      activeDraftIdSet.has(String(rp.draftId))
    ) {
      prevGroupMatched = false;
      return;
    }
    const rpTitleNorm = normalizeProgramText(rp.title || rp.name || '');
    const rpNoteNorm = normalizeProgramText(rp.note || '');
    const isSameProg =
      (rpTitleNorm.length >= 3 && (rpTitleNorm === normDraftTitle || rpTitleNorm.includes(normDraftTitle) || normDraftTitle.includes(rpTitleNorm))) ||
      (rpNoteNorm.length >= 3 && rpNoteNorm.includes(normDraftTitle));

    if (isSameProg) {
      if (!prevGroupMatched) {
        matchingOrphanGroups.push(rp);
      }
      prevGroupMatched = true;
    } else {
      prevGroupMatched = false;
    }
  });

  if (matchingOrphanGroups.length === 0) return false;

  const sameTitleDraftSlots = (allDraftSlotsForDay || []).filter(
    d => normalizeProgramText(d.title || d.name || '') === normDraftTitle &&
      !nonIntroPrograms.some(rp => rp.draftId && String(rp.draftId) === String(d.id))
  );

  if (sameTitleDraftSlots.length <= 1) {
    return matchingOrphanGroups.length >= 1;
  }

  const slotOccurrenceIndex = sameTitleDraftSlots.findIndex(
    d => (d.id && d.id === draftItem.id) || (d.startTime === draftItem.startTime)
  );

  if (slotOccurrenceIndex === -1) return matchingOrphanGroups.length >= 1;
  return matchingOrphanGroups.length > slotOccurrenceIndex;
}

/**
 * İki program başlığının (ör. "Safvetüt- Tefasir" ile "Safvetü't-Tefasir", "El-Yakutu'n-Nefis" ile "Yakutun Nefis",
 * "TEFSİR-İ MEVAKİB" ile "Tefsiri Mevakib", "DELAİL-ÜL HAYRAT" ile "Delailül Hayrat") aynı programa ait olup olmadığını denetler.
 */
function areProgramTitlesEquivalent(draftItem, existingItem) {
  const rawDraft = draftItem?.title || draftItem?.name || '';
  const normDraft = normalizeProgramText(rawDraft);
  if (!normDraft || normDraft.length < 3) return true;

  if (existingItem?.appliedDraftTitle) {
    const normApplied = normalizeProgramText(existingItem.appliedDraftTitle);
    if (normApplied === normDraft) return true;
  }

  const candidateStrings = [
    existingItem?.appliedDraftTitle,
    existingItem?.title,
    existingItem?.name,
    existingItem?.clipName,
    String(existingItem?.note || '').replace(/^Program:\s*/i, '').replace(/^Klip:\s*/i, '').split('•')[0],
    existingItem?.note
  ].filter(Boolean);

  const compactDraft = normDraft.replace(/\s+/g, '');
  const draftTokens = normDraft.split(' ').filter(w => w.length >= 4 && !['bolum', 'part', 'canli', 'yayin', 'program'].includes(w));

  for (const cand of candidateStrings) {
    const normCand = normalizeProgramText(cand);
    if (!normCand || normCand.length < 3) continue;

    if (normCand.includes(normDraft) || normDraft.includes(normCand)) {
      return true;
    }

    const compactCand = normCand.replace(/\s+/g, '');
    if (compactCand.length >= 4 && (compactCand.includes(compactDraft) || compactDraft.includes(compactCand))) {
      return true;
    }

    if (draftTokens.length > 0 && draftTokens.some(tok => normCand.includes(tok) || compactCand.includes(tok))) {
      return true;
    }
  }

  // İlim Dersleri alt dersleri (Tecvid, Kuduri, Taliü'l-Büşra, Yakutu'n-Nefis, Safvetü't-Tefasir vb.) kontrolü
  const ilimSubKeywords = ['ilim', 'tecvid', 'kuduri', 'taliu', 'busra', 'yakut', 'nefis', 'safvet', 'tefasir'];
  const combinedExistingNorm = normalizeProgramText(candidateStrings.join(' '));
  if (
    ilimSubKeywords.some(k => compactDraft.includes(k)) &&
    ilimSubKeywords.some(k => combinedExistingNorm.includes(k))
  ) {
    return true;
  }

  return false;
}

/**
 * Bir taslak kuşağının mevcut yayın akışında (rundown) ekli olmasına rağmen
 * Taslak Planlama modülünde güncellenip güncellenmediğini (bölüm numarası veya program adı değişikliği) denetler.
 */
export function getDraftSlotUpdateStatus(draftItem, currentRundownPrograms = [], dateStr = '') {
  if (!draftItem || !draftItem.id || !Array.isArray(currentRundownPrograms) || currentRundownPrograms.length === 0) {
    return { isUpdatedInDraft: false };
  }

  const normDraftTitle = normalizeProgramText(draftItem.title || draftItem.name || '');
  const isDraftFiller = Boolean(
    draftItem.isKisaSlot ||
    normDraftTitle.includes('dolgu kusagi') ||
    normDraftTitle === 'dolgu'
  );
  const isDraftLive = Boolean(
    draftItem.isLive ||
    (Array.isArray(draftItem.selectedOptions) && draftItem.selectedOptions.some(o => /canl[ıi]/i.test(String(o)))) ||
    /\bcanl[ıi]\b/i.test(`${draftItem.rawTitle || ''} ${draftItem.title || ''} ${draftItem.host || ''}`)
  );
  if (isDraftFiller || isDraftLive) {
    return { isUpdatedInDraft: false };
  }

  const existingItems = currentRundownPrograms.filter(
    p =>
      p.draftId &&
      String(p.draftId) === String(draftItem.id) &&
      !p.isIntroClip &&
      !p.isFillerClip &&
      p.type !== 'filler_slot' &&
      p.type !== 'ad_break'
  );

  if (existingItems.length === 0) {
    return { isUpdatedInDraft: false };
  }

  const firstExisting = existingItems[0];
  if (firstExisting.isLive || firstExisting.type === 'live' || firstExisting.isNotFound) {
    return { isUpdatedInDraft: false };
  }

  const targetInfo = resolveDraftSlotTarget(draftItem, dateStr || draftItem.dateStr || '');
  const titleChanged = !areProgramTitlesEquivalent(draftItem, firstExisting);

  // Gün bazlı programlarda (ör. Delail-ül Hayrat: Pazartesi..Pazar) veya taslakta açıkça bölüm numarası girilmemiş kuşaklarda bölüm farkı uyarısı üretme
  const rawDraftEp = draftItem.episode ?? draftItem.episodeNo ?? null;
  const hasExplicitNumericDraftEp =
    rawDraftEp !== null &&
    rawDraftEp !== undefined &&
    String(rawDraftEp).trim() !== '' &&
    !Number.isNaN(Number(rawDraftEp)) &&
    Number(rawDraftEp) > 0;

  let episodeChanged = false;
  if (
    targetInfo.unitType !== 'gun' &&
    firstExisting.unitType !== 'gun' &&
    hasExplicitNumericDraftEp &&
    targetInfo.targetNo !== null
  ) {
    if (firstExisting.appliedDraftEpisode !== undefined && firstExisting.appliedDraftEpisode !== null) {
      episodeChanged = Number(targetInfo.targetNo) !== Number(firstExisting.appliedDraftEpisode);
    } else if (
      firstExisting.episodeNo !== null &&
      firstExisting.episodeNo !== undefined &&
      Number(firstExisting.episodeNo) > 0
    ) {
      // Eğer taslak kuşağında zaten eşleşmiş klip isimleri kayıtlıysa ve akıştaki klip bunlardan biriyse güncellenmiş sayma
      const matchedNames = Array.isArray(draftItem.matchedClipNames) ? draftItem.matchedClipNames : [];
      const existingClipNorm = normalizeProgramText(firstExisting.clipName || firstExisting.title || '');
      const isAlreadyMatchedClip =
        matchedNames.length > 0 &&
        existingClipNorm &&
        matchedNames.some(cn => normalizeProgramText(cn) === existingClipNorm);

      if (!isAlreadyMatchedClip) {
        episodeChanged = Number(targetInfo.targetNo) !== Number(firstExisting.episodeNo);
      }
    }
  }

  if (titleChanged || episodeChanged) {
    return {
      isUpdatedInDraft: true,
      titleChanged,
      episodeChanged,
      existingEpisodeNo: firstExisting.episodeNo,
      newEpisodeNo: episodeChanged ? targetInfo.targetNo : null,
      existingTitle: firstExisting.title,
      newTitle: draftItem.title || draftItem.name
    };
  }

  return { isUpdatedInDraft: false };
}

/**
 * Klipleri en yeniden en eskiye sıralayan karşılaştırıcı (Timestamp -> FileId -> Bölüm No)
 */
export function compareNewestClips(a, b) {
  const tA = getClipTimestamp(a);
  const tB = getClipTimestamp(b);
  if (tB !== tA) return tB - tA;
  const fA = Number(a?.fileId) || 0;
  const fB = Number(b?.fileId) || 0;
  if (fB !== fA) return fB - fA;
  const eA = a?.episodeNo ?? -1;
  const eB = b?.episodeNo ?? -1;
  return eB - eA;
}

/**
 * Klipleri öncelikle Bölüm / Cüz / Gün (episodeNo) ve Parça (partNo) sırasına göre sıralar.
 * Taslak kuşakta hedef bölüm varsa o bölümün klipleri en üstte (Part 1, Part 2 sırasıyla) yer alır.
 * Aynı bölüm ve part içindeki mükerrer kayıtlar arasında EN SON EKLENEN (en yeni) klip en üstte yer alır.
 */
export function sortSlotClips(clips = [], targetEpisodeNum = null) {
  const enriched = [];
  const seenIds = new Set();

  for (const rawClip of clips) {
    const key = rawClip.fileId || rawClip.name;
    if (seenIds.has(key)) continue;
    seenIds.add(key);
    enriched.push(extractClipMeta(rawClip));
  }

  enriched.sort((a, b) => {
    // 1. Öncelik: Taslak kuşağın hedef bölümü (varsa en üstte)
    if (targetEpisodeNum !== null) {
      const aMatchEp = a.episodeNo === targetEpisodeNum;
      const bMatchEp = b.episodeNo === targetEpisodeNum;
      if (aMatchEp && !bMatchEp) return -1;
      if (!aMatchEp && bMatchEp) return 1;
      if (aMatchEp && bMatchEp) {
        const pA = a.partNo ?? 0;
        const pB = b.partNo ?? 0;
        if (pA !== pB) return pA - pB;
        return compareNewestClips(a, b);
      }
    }

    // 2. Öncelik: Bölüm / Cüz / Gün numarası olanlar olmayanlardan önce gelir
    const aHasEp = a.episodeNo !== null && a.episodeNo !== undefined;
    const bHasEp = b.episodeNo !== null && b.episodeNo !== undefined;
    if (aHasEp && !bHasEp) return -1;
    if (!aHasEp && bHasEp) return 1;

    // 3. Öncelik: Bölüm / Cüz / Gün numarasına göre büyükten küçüğe (en son eklenen bölümler önce)
    if (aHasEp && bHasEp && a.episodeNo !== b.episodeNo) {
      return b.episodeNo - a.episodeNo;
    }

    // 4. Öncelik: Aynı bölüm içindeki Parça (Part 1, Part 2...) sırası
    const pA = a.partNo ?? 0;
    const pB = b.partNo ?? 0;
    if (pA !== pB) return pA - pB;

    // 5. Öncelik: Aynı bölüm/part içinde en son eklenen (en yeni) klip önce gelir
    const newestCmp = compareNewestClips(a, b);
    if (newestCmp !== 0) return newestCmp;

    return String(a.name || '').localeCompare(String(b.name || ''), 'tr');
  });

  return enriched;
}

const TURKISH_WEEKDAY_RULES = [
  { getDayIdx: 1, order: 1, dayName: 'Pazartesi', label: 'Pazartesi Günü', rx: /pazartesi|pzt/i },
  { getDayIdx: 2, order: 2, dayName: 'Salı', label: 'Salı Günü', rx: /sal[ıi]/i },
  { getDayIdx: 3, order: 3, dayName: 'Çarşamba', label: 'Çarşamba Günü', rx: /[cç]ar[sş]amba|crs/i },
  { getDayIdx: 4, order: 4, dayName: 'Perşembe', label: 'Perşembe Günü', rx: /per[sş]embe|prs/i },
  { getDayIdx: 6, order: 6, dayName: 'Cumartesi', label: 'Cumartesi Günü', rx: /cumartesi|cmt/i },
  { getDayIdx: 5, order: 5, dayName: 'Cuma', label: 'Cuma Günü', rx: /cuma(?!rtesi)/i },
  { getDayIdx: 0, order: 7, dayName: 'Pazar', label: 'Pazar Günü', rx: /pazar(?!tesi)/i }
];

/**
 * Bir taslak kuşağının hedeflediği birim türünü (Bölüm / Cüz / Gün) ve hedef numarasını çözümler.
 * - Delail-ül Hayrat -> Gün (1=Pazartesi .. 7=Pazar; kuşağın gün bilgisinden veya yayın tarihinden)
 * - Hatm-i Şerif, Mukabele, Tefsir-i Mevakib -> Cüz (1..30; episode veya host "Cüz - X" bilgisinden)
 * - Diğer tüm programlar -> Bölüm (episode, host veya rawTitle bilgisinden)
 */
export function resolveDraftSlotTarget(slot, dateStr = '') {
  if (!slot) return { unitType: 'bolum', targetNo: null, targetLabel: null, weekdayInfo: null };

  const rawTitle = String(slot.title || slot.name || '').trim();
  const normTitle = normalizeProgramText(rawTitle);
  const hostStr = String(slot.host || '').trim();
  const rawFullTitle = String(slot.rawTitle || '').trim();
  const noteStr = String(slot.note || '').trim();
  const topicStr = String(slot.topic || '').trim();
  const effectiveDate = dateStr || slot.dateStr || '';

  // 1. Delail-ül Hayrat -> Gün (Pazartesi..Pazar)
  if (normTitle.includes('delail') && !normTitle.includes('minhacus')) {
    const combinedText = `${slot.dayName || ''} ${slot.unitLabel || ''} ${hostStr} ${slot.episode || ''} ${noteStr} ${rawFullTitle}`;
    let matchedDay = null;
    for (const w of TURKISH_WEEKDAY_RULES) {
      if (w.rx.test(combinedText)) {
        matchedDay = w;
        break;
      }
    }
    if (!matchedDay && effectiveDate) {
      const parts = String(effectiveDate).split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0])) {
        const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
        const jsDay = dObj.getDay();
        matchedDay = TURKISH_WEEKDAY_RULES.find(w => w.getDayIdx === jsDay) || null;
      }
    }
    return {
      unitType: 'gun',
      targetNo: matchedDay ? matchedDay.order : null,
      targetLabel: matchedDay ? matchedDay.label : null,
      weekdayInfo: matchedDay
    };
  }

  // 2. Hatm-i Şerif, Mukabele, Tefsir-i Mevakib -> Cüz (1..30)
  if (
    slot.unitType === 'cuz' ||
    normTitle.includes('hatm') ||
    normTitle.includes('mukabele') ||
    normTitle.includes('mevakib')
  ) {
    let cuzNo = null;
    const directEp = parseInt(slot.episodeNo ?? slot.episode, 10);
    if (!isNaN(directEp) && directEp >= 1 && directEp <= 30) {
      cuzNo = directEp;
    } else {
      const combined = `${hostStr} ${rawFullTitle} ${noteStr} ${topicStr}`;
      const m =
        combined.match(/(?:c[uü]z|cz)[\s.:_-]*(\d{1,2})/i) ||
        combined.match(/(\d{1,2})[\s._-]*(?:c[uü]z|cz)/i) ||
        hostStr.match(/^\s*(\d{1,2})\s*$/);
      if (m) {
        const parsed = parseInt(m[1], 10);
        if (parsed >= 1 && parsed <= 30) cuzNo = parsed;
      }
    }
    return {
      unitType: 'cuz',
      targetNo: cuzNo,
      targetLabel: cuzNo ? `${cuzNo}. Cüz` : null,
      weekdayInfo: null
    };
  }

  // 3. Diğer tüm programlar -> Bölüm
  let epNo = null;
  const directEp = parseInt(slot.episodeNo ?? slot.episode, 10);
  if (!isNaN(directEp) && directEp > 0) {
    epNo = directEp;
  } else if (/^\s*(\d{1,4})\s*$/.test(hostStr)) {
    epNo = parseInt(hostStr.trim(), 10);
  } else {
    const tailMatch =
      rawFullTitle.match(/(?:[-–]\s*|(?:bölüm|bolum|bl|b)\s*)(\d{1,4})\s*$/i) ||
      rawTitle.match(/(?:[-–]\s*|(?:bölüm|bolum|bl|b)\s*)(\d{1,4})\s*$/i) ||
      noteStr.match(/(?:bölüm|bolum|bl)\s*[:.-]?\s*(\d{1,4})/i);
    if (tailMatch) {
      epNo = parseInt(tailMatch[1], 10);
    }
  }

  return {
    unitType: 'bolum',
    targetNo: epNo,
    targetLabel: epNo ? `Bölüm ${epNo}` : null,
    weekdayInfo: null
  };
}

/**
 * Bir klip dosya adından "_part1", "_p2", "_revize" gibi parça/revizyon eklerini temizleyerek
 * aynı bölümün parçalarını gruplamak için kullanılan kök adı (stem) döndürür.
 */
export function getClipBaseStem(clipName) {
  return normalizeProgramText(
    String(clipName || '')
      .replace(/\.[a-z0-9]{2,4}$/i, '')
      .replace(/(?:_|^|\s|-)(?:part|p|pt)[_-]?\d+[a-z]*(?=[_\s.-]|$)/gi, '')
      .replace(/(?:_|^|\s|-)(?:revize|rev|yeni)(?=[_\s.-]|$)/gi, '')
  );
}

/**
 * Taslak Uygulama ("Akıllı Taslak Uygula") için bir programın klipleri arasından:
 * 1. Öncelikle taslak kuşağında belirtilen Bölüm, Cüz veya Gün (Delail-ül Hayrat için Pazartesi..Pazar) bilgisini baz alır.
 * 2. İlgili Bölüm / Cüz / Gün'e ait birden fazla klip/versiyon varsa (örn. 2020, 2024, 2025 kayıtları) EN YENİ olanını seçer.
 * 3. Seçilen bu Bölüm / Cüz / Gün'ün Part yapısı varsa (Part 1, Part 2, Part 3...), kaç part ise tamamını Part sırasına göre (1, 2, 3...) döndürür.
 * 4. Yalnızca taslak kuşağında hiçbir Bölüm / Cüz / Gün belirtilmemişse programın en yeni bölümünü/klibini seçer.
 */
export function selectSmartClipsForDraftSlot(slot, rawClips = [], dateStr = '') {
  if (!Array.isArray(rawClips) || rawClips.length === 0) return [];

  const enriched = [];
  const seenKeys = new Set();
  for (const rc of rawClips) {
    const key = rc.fileId || rc.name;
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);
    enriched.push(extractClipMeta(rc));
  }

  if (enriched.length === 0) return [];

  // Klipleri en yeniden en eskiye sıralayan karşılaştırıcı (Timestamp -> FileId -> Bölüm No)
  const compareNewest = (a, b) => {
    const tA = getClipTimestamp(a);
    const tB = getClipTimestamp(b);
    if (tB !== tA) return tB - tA;
    const fA = Number(a.fileId) || 0;
    const fB = Number(b.fileId) || 0;
    if (fB !== fA) return fB - fA;
    const eA = a.episodeNo ?? -1;
    const eB = b.episodeNo ?? -1;
    return eB - eA;
  };

  /**
   * Belirli bir Bölüm / Cüz / Gün için filtrelenmiş aday klipler arasından:
   * - Öncelikle klip dosya adı program başlığıyla doğrudan örtüşenleri tercih eder,
   * - Part yapısı varsa her part'ın en yeni versiyonunu alıp Part 1, Part 2... sırasıyla döndürür,
   * - Part yapısı yoksa en yeni tekil klibi döndürür.
   */
  const pickNewestAndAllPartsFromCandidates = (rawCandidates) => {
    if (!rawCandidates || rawCandidates.length === 0) return [];

    let candidates = rawCandidates;
    if (candidates.length > 1 && slot?.title) {
      const slotWords = normalizeProgramText(slot.title)
        .split(' ')
        .filter(w => w.length >= 4 && !['ilim', 'dersleri', 'sohbetleri', 'sohbeti'].includes(w));
      if (slotWords.length > 0) {
        const nameMatched = candidates.filter(c => {
          const cNorm = normalizeProgramText(c.name || c.fileName || '');
          return slotWords.some(w => cNorm.includes(w));
        });
        if (nameMatched.length > 0) {
          candidates = nameMatched;
        }
      }
    }

    const sorted = [...candidates].sort(compareNewest);
    const newest = sorted[0];

    const clipsWithParts = candidates.filter(
      c => c.partNo !== null && c.partNo !== undefined && c.partNo > 0
    );

    // En yeni klip part'lı bir yapıya aitse (veya adaylar part'lardan oluşuyorsa) tüm partları sırayla al
    if (clipsWithParts.length > 0 && (newest.partNo !== null && newest.partNo > 0 || clipsWithParts.length === candidates.length)) {
      const partMap = new Map();
      for (const c of clipsWithParts) {
        const existing = partMap.get(c.partNo);
        if (!existing || compareNewest(c, existing) < 0) {
          partMap.set(c.partNo, c);
        }
      }
      return Array.from(partMap.values()).sort((a, b) => (a.partNo || 0) - (b.partNo || 0));
    }

    return [newest];
  };

  const target = resolveDraftSlotTarget(slot, dateStr);

  // 1. DELAİL-ÜL HAYRAT (Gün bazlı: Pazartesi ise Pazartesi, Salı ise Salı...)
  if (target.unitType === 'gun') {
    if (!target.weekdayInfo) return [];
    const wInfo = target.weekdayInfo;
    const dayMatches = enriched.filter(c => {
      if (c.episodeNo === wInfo.order) return true;
      const text = `${c.name || ''} ${c.fileName || ''} ${c.unitLabel || ''} ${c.note || ''} ${c.topic || ''}`;
      return wInfo.rx.test(text);
    });
    return pickNewestAndAllPartsFromCandidates(dayMatches);
  }

  // 2. CÜZ BAZLI PROGRAMLAR (Hatm-i Şerif, Mukabele, Tefsir-i Mevakib)
  if (target.unitType === 'cuz') {
    if (target.targetNo !== null) {
      const cuzNo = target.targetNo;
      const cuzRx = new RegExp(
        `(?:c[uü]z|cz)[\\s._-]*0*${cuzNo}(?!\\d)|(?<!\\d)0*${cuzNo}[\\s._-]*(?:c[uü]z|cz)`,
        'i'
      );
      const cuzMatches = enriched.filter(c => {
        if (c.episodeNo === cuzNo) return true;
        const text = `${c.name || ''} ${c.fileName || ''} ${c.unitLabel || ''} ${c.note || ''} ${c.topic || ''}`;
        return cuzRx.test(text);
      });
      return pickNewestAndAllPartsFromCandidates(cuzMatches);
    }
  }

  // 3. BÖLÜM BAZLI PROGRAMLAR (Taslakta hedef bölüm numarası varsa o bölümü baz al)
  if (target.targetNo !== null && target.targetNo > 0) {
    const epNo = target.targetNo;
    let epMatches = enriched.filter(c => c.episodeNo === epNo);

    // Eğer episodeNo alanı eşleşmediyse ve taslakta şehir/konu ipucu (host) varsa (Örn: Bilecik, Bursa) kontrol et
    if (epMatches.length === 0 && slot.host && !/^\d+$/.test(String(slot.host).trim())) {
      const normHost = normalizeProgramText(slot.host);
      if (normHost.length >= 4) {
        epMatches = enriched.filter(c => {
          const cText = normalizeProgramText(`${c.name || ''} ${c.topic || ''} ${c.note || ''}`);
          return cText.includes(normHost);
        });
      }
    }

    return pickNewestAndAllPartsFromCandidates(epMatches);
  }

  // 4. Taslakta hiçbir Bölüm / Cüz / Gün numarası belirtilmemişse:
  // Önce host/konu ipucu varsa ona bak, yoksa programın en yeni bölümünü/klibini (ve tüm partlarını) seç
  if (slot.host && !/^\d+$/.test(String(slot.host).trim())) {
    const normHost = normalizeProgramText(slot.host);
    if (normHost.length >= 4) {
      const hostMatches = enriched.filter(c => {
        const cText = normalizeProgramText(`${c.name || ''} ${c.topic || ''} ${c.note || ''}`);
        return cText.includes(normHost);
      });
      if (hostMatches.length > 0) {
        return pickNewestAndAllPartsFromCandidates(hostMatches);
      }
    }
  }

  const sortedByNewest = [...enriched].sort(compareNewest);
  const newestClip = sortedByNewest[0];

  if (newestClip.episodeNo !== null && newestClip.episodeNo !== undefined) {
    const sameEpisodeClips = enriched.filter(c => c.episodeNo === newestClip.episodeNo);
    return pickNewestAndAllPartsFromCandidates(sameEpisodeClips);
  }

  if (newestClip.partNo !== null && newestClip.partNo !== undefined && newestClip.partNo > 0) {
    const targetStem = getClipBaseStem(newestClip.name || newestClip.fileName);
    const sameStemClips = enriched.filter(
      c => c.partNo !== null && c.partNo !== undefined && getClipBaseStem(c.name || c.fileName) === targetStem
    );
    return pickNewestAndAllPartsFromCandidates(sameStemClips.length > 0 ? sameStemClips : [newestClip]);
  }

  return [newestClip];
}

/**
 * Belirli bir program ID'sinin kliplerini bellek önbelleği (cache) üzerinden getirir.
 * Aynı program gün içinde birden fazla kuşakta yer aldığında tekrarlı ağ isteği yapılmasını önler.
 */
export async function fetchProgramClipsCached(programId) {
  const cacheKey = `prog_${programId}`;
  if (programClipsMemoryCache.has(cacheKey)) {
    return programClipsMemoryCache.get(cacheKey);
  }
  const res = await fetch(`/api/archive/program/${programId}/clips`);
  if (!res.ok) return [];
  const data = await res.json();
  const list = Array.isArray(data?.clips) ? data.clips : [];
  programClipsMemoryCache.set(cacheKey, list);
  return list;
}

let cachedIntroClipObj = null;

/**
 * Aktif programlar (usedPrograms) içindeki "İntro" programından (id: 18522 veya başlığı İntro olan)
 * yayın akışında her programdan önce girecek olan İntro klibini getirir.
 */
export async function fetchIntroClipForBroadcast(usedPrograms = []) {
  if (cachedIntroClipObj) return cachedIntroClipObj;

  try {
    let introProgram = null;
    if (Array.isArray(usedPrograms) && usedPrograms.length > 0) {
      introProgram =
        usedPrograms.find(p => normalizeProgramText(p.title) === 'intro') ||
        usedPrograms.find(p => Number(p.id) === 18522) ||
        usedPrograms.find(p => normalizeProgramText(p.title).includes('intro'));
    }

    const introProgId = introProgram ? introProgram.id : 18522;
    const clips = await fetchProgramClipsCached(introProgId);
    if (Array.isArray(clips) && clips.length > 0) {
      const sorted = [...clips].sort(compareNewestClips);
      cachedIntroClipObj = sorted[0];
      return cachedIntroClipObj;
    }
  } catch (err) {
    console.warn('İntro klibi yüklenemedi, varsayılan intro kullanılacak:', err);
  }

  // Fallback (sunucu yanıt vermezse veya arşivde id=18522 boşsa standart Semerkand İntro kaydı)
  return {
    fileId: 725,
    name: 'SEMERKAND_intro_v3_2014',
    fileName: 'SEMERKAND_intro_v3_2014',
    durationSec: 26,
    durationFormatted: '00:00:26:00',
    categoryId: 7,
    categoryName: 'Jenerik'
  };
}

let cachedUsedProgramsList = null;

/**
 * Yayın Planlama klip ve aktif program önbelleklerini temizler.
 * Admin Panelde yeni bir program/klip eklendiğinde veya "Yenile / Eksikleri Kontrol Et" butonuna basıldığında çağrılır.
 */
export function clearBroadcastArchiveCaches() {
  programClipsMemoryCache.clear();
  cachedUsedProgramsList = null;
  cachedIntroClipObj = null;
}

/**
 * Aktif programlar (used-programs) listesini bellek önbelleği ile getirir.
 */
export async function fetchUsedProgramsCached() {
  if (Array.isArray(cachedUsedProgramsList) && cachedUsedProgramsList.length > 0) {
    return cachedUsedProgramsList;
  }
  try {
    const res = await fetch('/api/archive/used-programs');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.programs)) {
        cachedUsedProgramsList = data.programs;
        return cachedUsedProgramsList;
      }
    }
  } catch (e) {
    console.warn('used-programs önbellek isteği başarısız:', e);
  }
  return [];
}

/**
 * Tek bir bölüme ait klipler arasından:
 * - Eğer bölüm part'lı ise (Part 1, Part 2, Part 3...), her part'ın EN SON EKLENEN (en yeni) versiyonunu alır ve Part sırasıyla döndürür.
 * - Part'sız ise EN SON EKLENEN (en yeni) tekil klibi döndürür.
 */
export function deduplicateEpisodeClipsNewest(clips = [], programTitle = '') {
  if (!Array.isArray(clips) || clips.length === 0) return [];
  const enriched = clips.map(extractClipMeta);

  let candidates = enriched;
  if (candidates.length > 1 && programTitle) {
    const slotWords = normalizeProgramText(programTitle)
      .split(' ')
      .filter(w => w.length >= 4 && !['ilim', 'dersleri', 'sohbetleri', 'sohbeti'].includes(w));
    if (slotWords.length > 0) {
      const nameMatched = candidates.filter(c => {
        const cNorm = normalizeProgramText(c.name || c.fileName || '');
        return slotWords.some(w => cNorm.includes(w));
      });
      if (nameMatched.length > 0) {
        candidates = nameMatched;
      }
    }
  }

  const sorted = [...candidates].sort(compareNewestClips);
  const newest = sorted[0];

  const clipsWithParts = candidates.filter(
    c => c.partNo !== null && c.partNo !== undefined && c.partNo > 0
  );

  if (
    clipsWithParts.length > 0 &&
    ((newest.partNo !== null && newest.partNo > 0) || clipsWithParts.length === candidates.length)
  ) {
    const partMap = new Map();
    for (const c of clipsWithParts) {
      const existing = partMap.get(c.partNo);
      if (!existing || compareNewestClips(c, existing) < 0) {
        partMap.set(c.partNo, c);
      }
    }
    return Array.from(partMap.values()).sort((a, b) => (a.partNo || 0) - (b.partNo || 0));
  }

  return [newest];
}

/**
 * Bir programa ait tüm arşiv kliplerini bölüm bazında gruplar,
 * her bölüm için EN SON EKLENEN part'ları seçip bölümün gerçek toplam süresini (Part 1 + Part 2 + ...) hesaplar.
 * Ayrıca en son eklenen bölümü (`latestEpisode`) belirler.
 */
export function computeEpisodeSummariesForProgram(rawClips = [], programTitle = '') {
  if (!Array.isArray(rawClips) || rawClips.length === 0) {
    return { episodes: [], latestEpisode: null };
  }

  const byEp = new Map();
  for (const rc of rawClips) {
    const c = extractClipMeta(rc);
    const epKey = c.episodeNo !== null && c.episodeNo !== undefined ? c.episodeNo : 'Genel';
    if (!byEp.has(epKey)) {
      byEp.set(epKey, []);
    }
    byEp.get(epKey).push(c);
  }

  const episodes = [];
  for (const [epKey, rawGroup] of byEp.entries()) {
    const activeParts = deduplicateEpisodeClipsNewest(rawGroup, programTitle);
    const totalSec = activeParts.reduce((acc, c) => acc + (Number(c.durationSec) || 0), 0);
    const latestTimestamp = activeParts.reduce((maxT, c) => Math.max(maxT, getClipTimestamp(c)), 0);
    const maxFileId = activeParts.reduce((maxF, c) => Math.max(maxF, Number(c.fileId) || 0), 0);
    const firstClip = activeParts[0] || rawGroup[0] || {};

    episodes.push({
      episodeNo: epKey,
      name: firstClip.name || firstClip.fileName || '',
      note: firstClip.note || firstClip.topic || '',
      unitType: firstClip.unitType || 'bolum',
      unitLabel: firstClip.unitLabel || (epKey !== 'Genel' ? `Bölüm ${epKey}` : 'Genel'),
      totalSec,
      durationMin: totalSec > 0 ? Math.max(1, Math.round(totalSec / 60)) : 30,
      durationFormatted: formatClipDurationReadable(totalSec),
      partsCount: activeParts.length,
      clips: activeParts,
      allRawClips: rawGroup,
      latestTimestamp,
      maxFileId
    });
  }

  // Bölümleri en son eklenenden (veya en büyük bölüm numarasından) eskiye doğru sırala
  episodes.sort((a, b) => {
    const aIsNum = typeof a.episodeNo === 'number' && !isNaN(a.episodeNo);
    const bIsNum = typeof b.episodeNo === 'number' && !isNaN(b.episodeNo);
    if (aIsNum && !bIsNum) return -1;
    if (!aIsNum && bIsNum) return 1;
    if (a.latestTimestamp !== b.latestTimestamp) return b.latestTimestamp - a.latestTimestamp;
    if (aIsNum && bIsNum && a.episodeNo !== b.episodeNo) return b.episodeNo - a.episodeNo;
    return b.maxFileId - a.maxFileId;
  });

  const latestEpisode = episodes[0] || null;
  return { episodes, latestEpisode };
}

/**
 * Taslak Planlama akışındaki (Excel'den aktarılan veya mevcut) programları
 * arşiv veritabanındaki karşılıklarıyla eşleştirir:
 * - İlgili bölümün (veya bölüm belirtilmemişse EN SON EKLENEN bölümün) kliplerini bulur
 * - Bölüm Part 1, Part 2... şeklinde parçalıysa tüm partların sürelerini toplar
 * - Programın toplam süresini (`duration`, `episodeTotalSec`, `episodeDurationFormatted`, `partsCount`) günceller
 * - Günün yayın saatlerini (`startTime`, `endTime`) gerçek bölüm sürelerine göre ardışık olarak yerleştirir
 */
export async function enrichDraftScheduleWithArchiveDurations(scheduleMap = {}, usedProgramsArg = null) {
  if (!scheduleMap || typeof scheduleMap !== 'object') return scheduleMap;

  const usedPrograms = Array.isArray(usedProgramsArg) && usedProgramsArg.length > 0
    ? usedProgramsArg
    : await fetchUsedProgramsCached();

  if (!Array.isArray(usedPrograms) || usedPrograms.length === 0) {
    return scheduleMap;
  }

  const enrichedSchedule = {};
  const dayKeys = Object.keys(scheduleMap);

  for (const dayKey of dayKeys) {
    const dayObj = scheduleMap[dayKey];
    if (!dayObj || !Array.isArray(dayObj.programs)) {
      enrichedSchedule[dayKey] = dayObj;
      continue;
    }

    let currentSecCursor = 0;
    const updatedPrograms = [];

    for (let idx = 0; idx < dayObj.programs.length; idx++) {
      const prog = dayObj.programs[idx];
      const isKisa = Boolean(
        prog.isKisaSlot ||
        prog.title === 'Dolgu Kuşağı' ||
        prog.category === 'Dolgu Kuşağı'
      );
      const isLiveSlot = Boolean(
        prog.isLive ||
        prog.isCustomProgram ||
        (Array.isArray(prog.selectedOptions) && prog.selectedOptions.some(o => /canl[ıi]/i.test(String(o)))) ||
        /\bcanl[ıi]\b/i.test(`${prog.rawTitle || ''} ${prog.title || ''} ${prog.host || ''}`)
      );

      let nextProg = { ...prog };

      if (!isKisa && !isLiveSlot) {
        const matchedList = findMatchingAdminPrograms(prog, usedPrograms);
        if (matchedList.length > 0) {
          const matchedProg = matchedList[0];
          const rawClips = await fetchProgramClipsCached(matchedProg.id);
          if (Array.isArray(rawClips) && rawClips.length > 0) {
            const selectedClips = selectSmartClipsForDraftSlot(
              { ...prog, dayName: dayObj.dayName },
              rawClips,
              dayKey
            );

            if (selectedClips.length > 0) {
              const totalEpisodeSec = selectedClips.reduce(
                (acc, c) => acc + (Number(c.durationSec) || 0),
                0
              );

              if (totalEpisodeSec > 0) {
                const durationMin = Math.max(1, Math.round(totalEpisodeSec / 60));
                const firstClip = selectedClips[0];
                const resolvedEp =
                  prog.episode ||
                  (firstClip?.episodeNo !== null && firstClip?.episodeNo !== undefined
                    ? String(firstClip.episodeNo)
                    : '');

                nextProg = {
                  ...nextProg,
                  programId: matchedProg.id,
                  excelSlotDuration: prog.excelSlotDuration || prog.duration || 30,
                  duration: durationMin,
                  episodeTotalSec: totalEpisodeSec,
                  episodeDurationFormatted: formatClipDurationReadable(totalEpisodeSec),
                  partsCount: selectedClips.length,
                  episode: resolvedEp,
                  matchedClipNames: selectedClips.map(c => c.name || c.fileName || '')
                };
              }
            }
          }
        }
      }

      // Saatleri gerçek bölüm süresine göre ardışık yerleştir
      const durMin = Math.max(
        1,
        parseInt(nextProg.duration, 10) ||
          (nextProg.episodeTotalSec && nextProg.episodeTotalSec > 0
            ? Math.round(nextProg.episodeTotalSec / 60)
            : 30)
      );

      let currentMinCursor = Math.round(currentSecCursor / 60);
      if (typeof nextProg.anchorStartMinute === 'number' && nextProg.anchorStartMinute > currentMinCursor) {
        currentMinCursor = nextProg.anchorStartMinute;
        currentSecCursor = currentMinCursor * 60;
      }

      const startMin = currentMinCursor;
      const endMin = Math.min(1440, startMin + durMin);
      currentSecCursor = endMin * 60;
      const effectiveDurMin = Math.max(1, endMin - startMin || durMin);

      const sh = String(Math.floor(startMin / 60)).padStart(2, '0');
      const sm = String(startMin % 60).padStart(2, '0');
      let eh = String(Math.floor(endMin / 60)).padStart(2, '0');
      let em = String(endMin % 60).padStart(2, '0');
      if (endMin >= 1440) {
        eh = '24';
        em = '00';
      }

      updatedPrograms.push({
        ...nextProg,
        order: idx + 1,
        startTime: `${sh}:${sm}`,
        endTime: `${eh}:${em}`,
        startMinute: startMin,
        endMinute: endMin,
        duration: effectiveDurMin
      });
    }

    enrichedSchedule[dayKey] = {
      ...dayObj,
      programs: updatedPrograms
    };
  }

  return enrichedSchedule;
}

/**
 * Yayın akışı tablosunda (rundown) seçilen bir klip/öğenin (`rundownItem`),
 * Günün Taslağı içindeki belirli bir kuşağa (`draftItem`) ait olup olmadığını kontrol eder.
 */
export function doesDraftSlotMatchRundownItem(draftItem, rundownItem) {
  if (!draftItem || !rundownItem) return false;
  if (rundownItem.type === 'ad_break') return false;

  // 1. Doğrudan draftId eşleşmesi (Taslak Uygula veya yan panelden eklenen klipler & introlar)
  if (rundownItem.draftId && draftItem.id) {
    return String(rundownItem.draftId) === String(draftItem.id);
  }

  // 2. Başlangıç saati + başlık/not eşleşmesi
  const normDraftTitle = normalizeProgramText(draftItem.title || draftItem.name || '');
  if (!normDraftTitle) return false;

  const rpTitleNorm = normalizeProgramText(rundownItem.title || rundownItem.name || rundownItem.clipName || '');
  const rpNoteNorm = normalizeProgramText(rundownItem.note || '');

  if (rundownItem.draftStartTime && draftItem.startTime) {
    if (rundownItem.draftStartTime === draftItem.startTime) {
      return (
        rpTitleNorm.includes(normDraftTitle) ||
        normDraftTitle.includes(rpTitleNorm) ||
        rpNoteNorm.includes(normDraftTitle)
      );
    }
    return false;
  }

  // 3. Eğer öğede draftId veya draftStartTime yoksa (manuel veya klip aramadan eklendiyse)
  if (rundownItem.isIntroClip) return false;

  const titleMatch =
    rpTitleNorm.length >= 4 &&
    (rpTitleNorm === normDraftTitle ||
      rpTitleNorm.includes(normDraftTitle) ||
      normDraftTitle.includes(rpTitleNorm));

  const noteMatch = rpNoteNorm.length >= 4 && rpNoteNorm.includes(normDraftTitle);

  return titleMatch || noteMatch;
}



