/**
 * @file src/store/slices/ads/adsPlacementEngine.js
 * @description Akıllı Otomatik Reklam Yerleştirme Motoru, Program Sponsorluğu Çözümleyicisi ve Kuşak Sıralama Algoritması.
 *
 * Bu modül aşağıdaki kritik kuralları ve 6 aşamalı yerleştirme algoritmasını çalıştırır:
 * 1. Tekil Sunum Bantları (`enforceSingularBumperUniqueness`):
 *    Aynı program için 'presents' (Program Öncesi - Sunar), 'to_be_continued' (Program Arası - Devam Edecek),
 *    'continues' (Program Arası - Devam Ediyor) ve 'presented' (Program Sonrası - Sundu) rollerinin
 *    yalnızca tek bir reklam klibinde bulunmasını garanti eder.
 * 2. Kuşak İçi Sıra Kilitleme ve Firma Ayrıştırma (`finalizeBucketAdsOrder`):
 *    - İlk sıra kilitli ('to_be_continued', 'presented') reklamları kuşağın en başına koyar.
 *    - Son sıra kilitli ('presents', 'continues') reklamları kuşağın en sonuna koyar.
 *    - Ortadaki reklamları ise aynı firmanın (`companyId`) iki reklamı kesinlikle üst üste gelmeyecek şekilde dizer.
 * 3. 6 Aşamalı Günlük Otomatik Planlama (`runAutoPlanAdsForDay`):
 *    - Aşama 1: Özel Sunum & Geçiş Sponsorlukları (Tekil & İlk/Son Sıra Kilitli)
 *    - Aşama 2: Standart Program Sponsorlukları (Program Öncesi / Program Arası / Program Sonrası - Çoklu)
 *    - Aşama 3: Günlük Minimum Spot Garantisi (`dailyMinSpots`)
 *    - Aşama 4: Dengeli Maksimum Spot Doldurma (`dailyMaxSpots` - Round-Robin)
 *    - Aşama 5: Boş Kuşak Geçemez Garantisi (0 reklam kalan her kuşağa en az 1 reklam zorunlu atama)
 *    - Aşama 6: Kuşak İçi Sıra Kilitleri ve Firma Ayrıştırması
 * 4. Manuel Reklam Ekleme (`executeAddManualAdToBreak`):
 *    Tekrar eden klip ve üst üste aynı firma kontrolü yaparak kuşağa manuel spot ekler.
 */
import { dialog } from '../../dialogStore';
import {
  normalizeAdDurationSeconds,
  saveAdsReservationsBackup,
  DEFAULT_AD_BREAK_BUMPER_RULES
} from './adsCatalogHelpers';
import { getCategoryDetails } from '../../../utils/categoryColors';

export const SINGULAR_SPONSOR_ROLES = ['presents', 'to_be_continued', 'continues', 'presented'];

function normalizeCatKey(str = '') {
  return String(str || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Bir reklam kuşağından hemen önce yayınlanan programı (`prevProg`) ve kategorisini tespit eder;
 * seçili kanal (`channelId`) ve kategori için tanımlı RTÜK Reklam Giriş (`introBumperAd`) ve
 * Reklam Çıkış (`outroBumperAd`) jenerik kliplerini ve sürelerini döndürür.
 */
export function resolveAdBreakBumpersForPrecedingProgram(state, channelId, prevProg, nextProg = null) {
  const refProg = prevProg || nextProg || null;
  const sourceProgramTitle =
    refProg?.programTitle || refProg?.title || refProg?.name || refProg?.clipName || 'Genel Yayın';

  let rawCatName = String(refProg?.category || refProg?.categoryName || '').trim();
  let rawCatId = Number(refProg?.categoryId) || null;

  // Eğer programda kategori adı 'Programlar', 'Genel' gibi jenerik kalmışsa kütüphaneden veya başlıktan çözümle
  const isGenericCat =
    !rawCatName ||
    ['programlar', 'program', 'genel', 'genelyayin', 'yayin'].includes(normalizeCatKey(rawCatName));

  if (isGenericCat && refProg) {
    const progSearchText = `${refProg.programTitle || ''} ${refProg.title || ''} ${refProg.name || ''} ${refProg.clipName || ''}`.toLocaleLowerCase('tr-TR');
    const libMatch = (state?.libraryPrograms || []).find(
      lp =>
        lp &&
        (String(lp.id) === String(refProg.id) ||
          (lp.title && progSearchText.includes(String(lp.title).toLocaleLowerCase('tr-TR'))))
    );
    if (libMatch && (libMatch.category || libMatch.categoryName || libMatch.categoryId)) {
      rawCatName = libMatch.category || libMatch.categoryName || rawCatName;
      rawCatId = Number(libMatch.categoryId) || rawCatId;
    } else if (/hanım|hanim|bayan|kadın|kadin|aile|mutfak|lezzet|yemek|evimiz/i.test(progSearchText)) {
      rawCatName = 'Kadın';
      rawCatId = 1;
    } else if (/çocuk|cocuk|masal|çizgi|cizgi|minik|şekerağacı|sekeragaci|mavi fidan/i.test(progSearchText)) {
      rawCatName = 'Çocuk';
      rawCatId = 5;
    } else if (/haber|gündem|gundem|bülten|bulten|ajans/i.test(progSearchText)) {
      rawCatName = 'Haber';
      rawCatId = 2;
    } else if (/kültür|kultur|tarih|belgesel|gezi|şehir|sehir|mimari|sanat|edebiyat|mostar/i.test(progSearchText)) {
      rawCatName = 'Kültürel';
      rawCatId = 8;
    } else if (/tanıtım|tanitim|fragman/i.test(progSearchText)) {
      rawCatName = 'Tanıtım';
      rawCatId = 3;
    } else if (/detay/i.test(progSearchText)) {
      rawCatName = 'Detay';
      rawCatId = 9;
    } else if (/kısa|kisa/i.test(progSearchText)) {
      rawCatName = 'Kısa Program';
      rawCatId = 10;
    } else {
      rawCatName = 'Dini';
      rawCatId = 4;
    }
  }

  const catDetails = getCategoryDetails(rawCatId, rawCatName);
  const detectedCategoryName =
    catDetails?.id && catDetails?.name && catDetails.name !== 'Genel Yayın'
      ? catDetails.name
      : rawCatName && !isGenericCat
      ? rawCatName
      : 'Dini';
  const detectedCategoryId = Number(catDetails?.id || rawCatId || 4);
  const normDetected = normalizeCatKey(detectedCategoryName);

  const allRules =
    Array.isArray(state?.adBreakBumperRules) && state.adBreakBumperRules.length > 0
      ? state.adBreakBumperRules
      : DEFAULT_AD_BREAK_BUMPER_RULES;

  const activeChannelRules = allRules.filter(
    r => r && r.isActive !== false && String(r.channelId) === String(channelId)
  );
  const candidateRules =
    activeChannelRules.length > 0
      ? activeChannelRules
      : allRules.filter(r => r && r.isActive !== false);

  let matchedRule = candidateRules.find(r => {
    const byName = (r.categories || []).some(c => {
      const nc = normalizeCatKey(c);
      if (!nc || !normDetected) return false;
      return nc === normDetected || nc.includes(normDetected) || normDetected.includes(nc);
    });
    if (byName) return true;
    const byId = (r.categoryIds || []).some(cid => Number(cid) === detectedCategoryId);
    return byId;
  });

  if (!matchedRule) {
    matchedRule =
      candidateRules.find(r => (r.categories || []).some(c => normalizeCatKey(c) === 'dini')) ||
      candidateRules[0] ||
      DEFAULT_AD_BREAK_BUMPER_RULES[0];
  }

  let introBumperAd = null;
  let outroBumperAd = null;

  if (matchedRule?.introClip) {
    const introSec = Math.max(1, Number(matchedRule.introClip.durationSec) || 9);
    const introMs = Number(matchedRule.introClip.durationMs) || introSec * 1000;
    const clipIdStr = String(matchedRule.introClip.clipId || matchedRule.introClip.id || '3538');
    introBumperAd = {
      reservationId: `rtuk-bumper-intro-${matchedRule.id}`,
      materialId: clipIdStr,
      clipId: clipIdStr,
      name: matchedRule.introClip.name,
      clipName: matchedRule.introClip.name,
      code: matchedRule.introClip.code || `${clipIdStr}.mxf`,
      duration: introSec,
      durationMs: introMs,
      companyId: 'comp-rtuk-bumper-intro',
      companyName: `RTÜK REKLAM GİRİŞ (${detectedCategoryName.toLocaleUpperCase('tr-TR')})`,
      productId: 'prod-rtuk-bumper-intro',
      productName: `Önceki Program: ${sourceProgramTitle} (${detectedCategoryName})`,
      isBumperAd: true,
      bumperType: 'intro',
      bumperCategoryName: detectedCategoryName,
      bumperSourceProgram: sourceProgramTitle,
      lockOrder: 'bumper_intro'
    };
  }

  if (matchedRule?.outroClip) {
    const outroSec = Math.max(1, Number(matchedRule.outroClip.durationSec) || 9);
    const outroMs = Number(matchedRule.outroClip.durationMs) || outroSec * 1000;
    const clipIdStr = String(matchedRule.outroClip.clipId || matchedRule.outroClip.id || '3537');
    outroBumperAd = {
      reservationId: `rtuk-bumper-outro-${matchedRule.id}`,
      materialId: clipIdStr,
      clipId: clipIdStr,
      name: matchedRule.outroClip.name,
      clipName: matchedRule.outroClip.name,
      code: matchedRule.outroClip.code || `${clipIdStr}.mxf`,
      duration: outroSec,
      durationMs: outroMs,
      companyId: 'comp-rtuk-bumper-outro',
      companyName: `RTÜK REKLAM ÇIKIŞ (${detectedCategoryName.toLocaleUpperCase('tr-TR')})`,
      productId: 'prod-rtuk-bumper-outro',
      productName: `Önceki Program: ${sourceProgramTitle} (${detectedCategoryName})`,
      isBumperAd: true,
      bumperType: 'outro',
      bumperCategoryName: detectedCategoryName,
      bumperSourceProgram: sourceProgramTitle,
      lockOrder: 'bumper_outro'
    };
  }

  const totalBumperDurationSec =
    (introBumperAd ? introBumperAd.duration : 0) +
    (outroBumperAd ? outroBumperAd.duration : 0);

  return {
    matchedRule,
    detectedCategoryName,
    detectedCategoryId,
    sourceProgramTitle,
    introBumperAd,
    outroBumperAd,
    totalBumperDurationSec
  };
}

/**
 * Aynı program (`sponsorProgramTitle`) için tekil sunum bantlarının
 * (`presents` / Sunar, `to_be_continued` / Devam Edecek, `continues` / Devam Ediyor, `presented` / Sundu)
 * birden fazla rezervasyonda veya klipte aynı anda bulunmasını engeller.
 *
 * @param {Array} reservationsList - Mevcut tüm rezervasyonlar
 * @param {Object} activeReservation - Yeni eklenen veya güncellenen aktif rezervasyon
 * @returns {Array} Tekil rol çakışmaları temizlenmiş rezervasyon listesi
 */
export function enforceSingularBumperUniqueness(reservationsList, activeReservation) {
  if (!activeReservation) return reservationsList;

  // Aktif rezervasyondaki her bir klibin (veya üst kaydın) hangi program için hangi tekil rolleri talep ettiğini çıkar
  const claimedByProg = new Map(); // progNorm -> Set<roleId>
  const activeItems =
    Array.isArray(activeReservation.items) && activeReservation.items.length > 0
      ? activeReservation.items
      : [activeReservation];

  activeItems.forEach(it => {
    const isSp = it.isSponsor !== undefined ? Boolean(it.isSponsor) : Boolean(activeReservation.isSponsor);
    const progNorm = String(it.sponsorProgramTitle || activeReservation.sponsorProgramTitle || '')
      .trim()
      .toLocaleLowerCase('tr-TR');
    if (!isSp || !progNorm) return;

    const positions = Array.isArray(it.sponsorPositions)
      ? it.sponsorPositions
      : Array.isArray(activeReservation.sponsorPositions)
      ? activeReservation.sponsorPositions
      : [];

    positions.forEach(pos => {
      if (SINGULAR_SPONSOR_ROLES.includes(pos)) {
        if (!claimedByProg.has(progNorm)) claimedByProg.set(progNorm, new Set());
        claimedByProg.get(progNorm).add(pos);
      }
    });
  });

  if (claimedByProg.size === 0) return reservationsList;

  return reservationsList.map(res => {
    if (!res || String(res.id) === String(activeReservation.id)) return res;

    let resChanged = false;
    const nextItems = Array.isArray(res.items)
      ? res.items.map(rItem => {
          const itemIsSp = rItem.isSponsor !== undefined ? Boolean(rItem.isSponsor) : Boolean(res.isSponsor);
          const itemProgNorm = String(rItem.sponsorProgramTitle || res.sponsorProgramTitle || '')
            .trim()
            .toLocaleLowerCase('tr-TR');
          if (!itemIsSp || !claimedByProg.has(itemProgNorm)) return rItem;

          const claimedSet = claimedByProg.get(itemProgNorm);
          const existingPos = Array.isArray(rItem.sponsorPositions)
            ? rItem.sponsorPositions
            : Array.isArray(res.sponsorPositions)
            ? res.sponsorPositions
            : [];
          const filteredPos = existingPos.filter(p => !claimedSet.has(p));
          if (filteredPos.length !== existingPos.length) {
            resChanged = true;
            return {
              ...rItem,
              sponsorPositions: filteredPos
            };
          }
          return rItem;
        })
      : res.items;

    const resProgNorm = String(res.sponsorProgramTitle || '').trim().toLocaleLowerCase('tr-TR');
    const claimedForRoot = claimedByProg.get(resProgNorm);
    const existingPositions = Array.isArray(res.sponsorPositions) ? res.sponsorPositions : [];
    const filteredPositions = claimedForRoot
      ? existingPositions.filter(p => !claimedForRoot.has(p))
      : existingPositions;

    if (filteredPositions.length !== existingPositions.length) {
      resChanged = true;
    }

    if (!resChanged) return res;

    const nextBumperMap = { ...(res.sponsorBumperMap || {}) };
    if (claimedForRoot) {
      claimedForRoot.forEach(roleId => {
        delete nextBumperMap[roleId];
      });
    }

    return {
      ...res,
      items: nextItems,
      sponsorPositions: filteredPositions,
      sponsorBumperMap: nextBumperMap
    };
  });
}

/**
 * Bir reklam kuşağındaki (`bucket`) reklamları:
 * 1. İlk sıra kilitli (`openingPinnedAds`: Devam Edecek / Sundu) en başta,
 * 2. Son sıra kilitli (`closingPinnedAds`: Sunar / Devam Ediyor) en sonda,
 * 3. Kuşak içi (`middleAds`) reklamları ise AYNI FİRMANIN (`companyId`) iki reklamı
 *    kesinlikle arka arkaya (üst üste) gelmeyecek şekilde ayrıştırarak (interleaving) dizer.
 *
 * @param {Object} bucket - Kuşak içindeki `openingPinnedAds`, `middleAds` ve `closingPinnedAds` dizilerini içeren nesne
 * @returns {Array} Kurallara göre sıralanmış nihai reklam listesi
 */
export function finalizeBucketAdsOrder(bucket) {
  const introBumper = bucket.introBumperAd || null;
  const outroBumper = bucket.outroBumperAd || null;
  const opening = [...(bucket.openingPinnedAds || [])].filter(a => !a?.isBumperAd);
  const closing = [...(bucket.closingPinnedAds || [])].filter(a => !a?.isBumperAd);
  const pool = [...(bucket.middleAds || [])].filter(a => !a?.isBumperAd);

  const result = [];
  const usedMatIds = new Set();

  // 1. Açılışta ilk sıraya kilitli sponsor reklamlarını (Sundu / Devam Edecek) ekle (Reklam Giriş jeneriğinin hemen altına gelecek)
  opening.forEach(ad => {
    const matKey = String(ad.materialId);
    if (usedMatIds.has(matKey)) return;
    if (result.length > 0 && String(result[result.length - 1].companyId) === String(ad.companyId)) {
      return;
    }
    result.push(ad);
    usedMatIds.add(matKey);
  });

  // Kapanışta son sıraya kilitli sponsor reklamlarını (Sunar / Devam Ediyor) hazırla (Reklam Çıkış jeneriğinin hemen üstüne gelecek)
  const validClosing = [];
  closing.forEach(ad => {
    const matKey = String(ad.materialId);
    if (usedMatIds.has(matKey)) return;
    if (validClosing.some(c => String(c.materialId) === matKey)) return;
    validClosing.push(ad);
  });

  // 2. Orta havuzdaki reklamları aynı firmanın iki reklamı üst üste gelmeyecek şekilde seçerek diz
  const remaining = pool.filter(ad => !usedMatIds.has(String(ad.materialId)));

  while (remaining.length > 0) {
    const prevCompanyId = result.length > 0 ? String(result[result.length - 1].companyId) : null;

    const countByComp = {};
    remaining.forEach(ad => {
      const cid = String(ad.companyId || '');
      countByComp[cid] = (countByComp[cid] || 0) + 1;
    });

    const validIndices = [];
    for (let i = 0; i < remaining.length; i++) {
      if (String(remaining[i].companyId) !== prevCompanyId) {
        validIndices.push(i);
      }
    }

    if (validIndices.length === 0) {
      break;
    }

    validIndices.sort((idxA, idxB) => {
      const a = remaining[idxA];
      const b = remaining[idxB];
      if (a.isSponsorSpot && !b.isSponsorSpot) return -1;
      if (!a.isSponsorSpot && b.isSponsorSpot) return 1;
      const countDiff = (countByComp[String(b.companyId)] || 0) - (countByComp[String(a.companyId)] || 0);
      if (countDiff !== 0) return countDiff;
      return idxA - idxB;
    });

    const chosenIdx = validIndices[0];
    const [chosenAd] = remaining.splice(chosenIdx, 1);
    const matKey = String(chosenAd.materialId);
    if (!usedMatIds.has(matKey)) {
      result.push(chosenAd);
      usedMatIds.add(matKey);
    }
  }

  // 3. Eğer son sıradaki `validClosing[0]` ile `result`ın son elemanı aynı firmaysa takas et veya çıkar
  if (validClosing.length > 0 && result.length > opening.length) {
    const closingCompId = String(validClosing[0].companyId);
    while (
      result.length > opening.length &&
      String(result[result.length - 1].companyId) === closingCompId
    ) {
      let swapped = false;
      const lastIdx = result.length - 1;
      for (let j = lastIdx - 1; j >= opening.length; j--) {
        const candComp = String(result[j].companyId);
        const leftNeighborComp = j > 0 ? String(result[j - 1].companyId) : null;
        const rightNeighborComp = j + 1 < lastIdx ? String(result[j + 1].companyId) : null;
        const beforeLastComp = lastIdx - 1 !== j ? String(result[lastIdx - 1].companyId) : leftNeighborComp;

        if (
          candComp !== closingCompId &&
          candComp !== beforeLastComp &&
          closingCompId !== leftNeighborComp &&
          closingCompId !== rightNeighborComp
        ) {
          const tmp = result[lastIdx];
          result[lastIdx] = result[j];
          result[j] = tmp;
          swapped = true;
          break;
        }
      }
      if (!swapped) {
        result.pop();
      }
    }
  }

  // 4. Son sıra kilitli sponsor reklamlarını (Sunar / Devam Ediyor) ekle
  validClosing.forEach(ad => {
    const matKey = String(ad.materialId);
    if (usedMatIds.has(matKey)) return;
    if (result.length > 0 && String(result[result.length - 1].companyId) === String(ad.companyId)) {
      if (!result[result.length - 1].lockOrder) {
        result.pop();
      } else {
        return;
      }
    }
    result.push(ad);
    usedMatIds.add(matKey);
  });

  // 5. RTÜK KURALI: Sponsor reklamı olsa bile EN BAŞTA (1. sıra) Reklam Giriş Jeneriği, EN SONDA Reklam Çıkış Jeneriği yer alır!
  const finalOrdered = [];
  if (introBumper) {
    finalOrdered.push(introBumper);
  }
  finalOrdered.push(...result);
  if (outroBumper) {
    finalOrdered.push(outroBumper);
  }

  return finalOrdered;
}

/**
 * Seçili kanal ve gün için 6 aşamalı Akıllı Otomatik Reklam Yerleştirme Algoritmasını çalıştırır.
 *
 * @param {Object} state - Zustand store state nesnesi
 * @param {string} channelId - Kanal kimliği (`ch_hd` veya `ch_way`)
 * @param {string} date - Hedef tarih (`YYYY-MM-DD`)
 * @returns {Object} Güncellenmiş `{ adPlacements, reservations }` durumu veya mevcut `state`
 */
export function runAutoPlanAdsForDay(state, channelId, date) {
  const key = `ready-${channelId}-${date}`;
  const dayData = state.days[key];
  if (!dayData || !dayData.variants) return state;

  const activeVariant = dayData.activeVariant || 'v1';
  const variantData = dayData.variants[activeVariant];
  if (!variantData || !variantData.programs) return state;

  const targetDateObj = new Date(date);
  const targetDayOfWeek = targetDateObj.getDay();

  // 1) Günün tüm programlarını ve reklam kuşaklarını zamanlarıyla çıkar
  let currentMinutes = dayData.startTime || 0;
  const timelineItems = variantData.programs.map((prog, idx) => {
    const startMin = prog.startMinute !== undefined ? prog.startMinute : currentMinutes;
    let durMin = parseFloat(prog.duration || 0);
    const titleLower = (prog.title || '').toLocaleLowerCase('tr-TR');
    const isAdBlock =
      prog.type === 'ad_break' ||
      String(prog.id).toUpperCase() === 'TPL-3' ||
      (prog.id && String(prog.id).toUpperCase().startsWith('T')) ||
      titleLower.includes('reklam kuşağı') ||
      titleLower.includes('reklam kusagi');

    const isIntroItem =
      !isAdBlock &&
      (Boolean(prog.isIntroClip) ||
        prog.unitType === 'intro' ||
        /^intro|jenerik/i.test(String(prog.category || '')));

    if (durMin === 0 && isAdBlock) {
      durMin = 6;
    }
    currentMinutes = startMin + durMin;

    const h = Math.floor(startMin / 60) % 24;
    const m = Math.floor(startMin % 60);
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    const fullSearchText = `${prog.programTitle || ''} ${prog.title || ''} ${prog.name || ''} ${prog.clipName || ''}`
      .toLocaleLowerCase('tr-TR')
      .trim();

    const ramadanProgramType = !isAdBlock && !isIntroItem
      ? (prog.ramadanProgramType ||
          (/sahur/i.test(fullSearchText) ? 'sahur' : /iftar/i.test(fullSearchText) ? 'iftar' : ''))
      : '';

    return {
      idx,
      prog,
      isAdBlock,
      isIntroItem,
      fullSearchText,
      ramadanProgramType,
      ramadanBreakTag: isAdBlock ? (prog.ramadanBreakTag || '') : '',
      startMin,
      endMin: currentMinutes,
      durMin,
      capacitySec: Math.round(durMin * 60),
      h,
      m,
      timeStr
    };
  });

  const existingDayBlocks = state.adPlacements?.[key] || [];
  let adOrdinalCounter = 0;

  // Reklam kuşaklarını ve komşu programlarını (İntro satırlarını şeffaf geçerek) belirle
  const adBreakBuckets = [];
  const bucketByTimelineIdx = new Map();

  timelineItems.forEach((item, idx) => {
    if (!item.isAdBlock) return;
    adOrdinalCounter++;

    let prevItem = null;
    for (let p = idx - 1; p >= 0; p--) {
      if (timelineItems[p].isAdBlock) break;
      if (!timelineItems[p].isIntroItem) {
        prevItem = timelineItems[p];
        break;
      }
    }

    let nextItem = null;
    for (let n = idx + 1; n < timelineItems.length; n++) {
      if (timelineItems[n].isAdBlock) break;
      if (!timelineItems[n].isIntroItem) {
        nextItem = timelineItems[n];
        break;
      }
    }

    const progMinOfDay = item.h * 60 + item.m;
    let matchedTimeBlock = state.timeBlocks.find(tb => {
      if (!tb.isActive) return false;
      if (Array.isArray(tb.days) && tb.days.length > 0 && !tb.days.includes(targetDayOfWeek)) return false;
      const [sh, sm] = (tb.startTime || '00:00').split(':').map(Number);
      const [eh, em] = (tb.endTime || '24:00').split(':').map(Number);
      const startM = sh * 60 + sm;
      const endM = eh * 60 + em;
      return progMinOfDay >= startM && progMinOfDay < endM;
    });

    if (!matchedTimeBlock) {
      matchedTimeBlock = state.timeBlocks[0] || { id: 'tb-2', name: 'Öğle Kuşağı' };
    }

    const blockIdVal = item.prog.instanceId || item.prog.id || `adbreak-${adOrdinalCounter}`;
    const existingMatchedBlock = existingDayBlocks.find(
      eb => eb.blockId === blockIdVal || eb.time === item.timeStr
    );
    const explicitRamadanTag = item.ramadanBreakTag || existingMatchedBlock?.ramadanBreakTag || '';

    // RTÜK KURALI: Önceki programı ve kategorisini tespit et -> Reklam Giriş ve Reklam Çıkış jeneriğini ve süresini kuşağa ayır
    const bumperInfo = resolveAdBreakBumpersForPrecedingProgram(
      state,
      channelId,
      prevItem?.prog || null,
      nextItem?.prog || null
    );

    const bucketObj = {
      timelineIdx: idx,
      blockId: blockIdVal,
      time: item.timeStr,
      duration: item.durMin,
      capacitySec: Math.max(30, item.capacitySec || 360),
      usedSec: bumperInfo.totalBumperDurationSec, // Giriş + Çıkış süresi (örn: 9 + 9 = 18 sn) kapasiteden baştan ayrılır
      timeBlockId: matchedTimeBlock.id,
      timeBlockName: matchedTimeBlock.name,
      ramadanBreakTag: explicitRamadanTag,
      prevProgTitle: prevItem ? prevItem.fullSearchText : '',
      nextProgTitle: nextItem ? nextItem.fullSearchText : '',
      detectedPrevCategory: bumperInfo.detectedCategoryName,
      bumperSourceProgram: bumperInfo.sourceProgramTitle,
      introBumperAd: bumperInfo.introBumperAd, // En başta (1. sırada - sponsor reklamın da önünde)
      outroBumperAd: bumperInfo.outroBumperAd, // En sonda (son sırada - sponsor reklamın da arkasında)
      openingPinnedAds: [], // İlk sıra kilitli: Devam Edecek ('to_be_continued') & Sundu ('presented')
      middleAds: [],        // Kuşak içi sponsorlar ('before', 'middle', 'after') & standart reklamlar
      closingPinnedAds: [], // Son sıra kilitli: Sunar ('presents') & Devam Ediyor ('continues')
      ads: [],
      usedItemKeys: new Set(),
      usedMaterialIds: new Set(),
      usedSingularRoles: new Set() // `${progNorm}::${roleId}`
    };

    adBreakBuckets.push(bucketObj);
    bucketByTimelineIdx.set(idx, bucketObj);
  });

  if (adBreakBuckets.length === 0) return state;

  // 1B) Sahur ve İftar Programlarının Başlangıç Saatlerine Göre Komşu Reklam Kuşaklarını Otomatik Tespit Et
  const autoTagNeighborsForRamadanType = (rType) => {
    const matchingProgs = timelineItems.filter(it => !it.isAdBlock && !it.isIntroItem && it.ramadanProgramType === rType);
    if (matchingProgs.length === 0) return;

    const firstPart = matchingProgs[0];
    const lastPart = matchingProgs[matchingProgs.length - 1];

    // Program başlamadan önceki son reklam kuşağı -> `${rType}_before`
    for (let i = firstPart.idx - 1; i >= 0; i--) {
      if (timelineItems[i].isAdBlock) {
        const b = bucketByTimelineIdx.get(i);
        if (b && !b.ramadanBreakTag) b.ramadanBreakTag = `${rType}_before`;
        break;
      }
      if (!timelineItems[i].isIntroItem) break;
    }

    // Program partları arasındaki reklam kuşakları -> `${rType}_middle`
    for (let p = 0; p < matchingProgs.length - 1; p++) {
      const partA = matchingProgs[p];
      const partB = matchingProgs[p + 1];
      adBreakBuckets.forEach(b => {
        if (b.timelineIdx > partA.idx && b.timelineIdx < partB.idx && !b.ramadanBreakTag) {
          b.ramadanBreakTag = `${rType}_middle`;
        }
      });
    }

    // Program bittikten sonraki ilk reklam kuşağı -> `${rType}_after`
    for (let i = lastPart.idx + 1; i < timelineItems.length; i++) {
      if (timelineItems[i].isAdBlock) {
        const b = bucketByTimelineIdx.get(i);
        if (b && !b.ramadanBreakTag) b.ramadanBreakTag = `${rType}_after`;
        break;
      }
      if (!timelineItems[i].isIntroItem) break;
    }
  };

  autoTagNeighborsForRamadanType('sahur');
  autoTagNeighborsForRamadanType('iftar');

  // Bu günün daha önceki yerleşiminde kullanılan spotları düş ki yeniden planlamada çift sayılmasın
  const prevCountsByResId = {};
  (existingDayBlocks || []).forEach(b => {
    (b.ads || []).forEach(ad => {
      if (ad?.reservationId) {
        prevCountsByResId[ad.reservationId] = (prevCountsByResId[ad.reservationId] || 0) + 1;
      }
    });
  });

  const ramadanCfg = state.ramadanConfig || {
    enabled: true,
    startDate: '2026-02-18',
    endDate: '2026-03-19'
  };
  const hasRamadanTaggedItemsToday =
    adBreakBuckets.some(b => Boolean(b.ramadanBreakTag)) ||
    timelineItems.some(it => Boolean(it.ramadanProgramType));
  const isDateWithinRamadanRange = (() => {
    if (!ramadanCfg.enabled) return hasRamadanTaggedItemsToday;
    if (!ramadanCfg.startDate || !ramadanCfg.endDate) return true;
    const s = new Date(`${ramadanCfg.startDate}T00:00:00`);
    const e = new Date(`${ramadanCfg.endDate}T23:59:59`);
    return (targetDateObj >= s && targetDateObj <= e) || hasRamadanTaggedItemsToday;
  })();

  // 2) Uygun Rezervasyon Kalemlerini (Items) Topla
  const collectCandidateItems = (strictDate = true) => {
    const list = [];
    state.reservations.forEach(res => {
      const resItems =
        Array.isArray(res.items) && res.items.length > 0
          ? res.items
          : res.materialId
          ? [
              {
                id: `${res.id}-default`,
                companyId: res.companyId,
                productId: res.productId,
                materialId: res.materialId,
                startDate: res.startDate,
                endDate: res.endDate,
                plannedSpots: res.totalPlannedSpots || 20,
                dailyMinSpots: res.dailyMinSpots || 1,
                dailyMaxSpots: res.dailyMaxSpots || 4,
                channelIds: res.channelIds,
                timeBlockIds: res.timeBlockIds
              }
            ]
          : [];

      resItems.forEach((it, itemIdx) => {
        const itemChannels =
          Array.isArray(it.channelIds) && it.channelIds.length > 0
            ? it.channelIds
            : res.channelIds || [];
        if (itemChannels.length > 0 && !itemChannels.includes(channelId)) {
          return;
        }

        if (strictDate) {
          const startStr = it.startDate || res.startDate;
          const endStr = it.endDate || res.endDate;
          if (startStr && endStr) {
            const sDate = new Date(startStr);
            sDate.setHours(0, 0, 0, 0);
            const eDate = new Date(endStr);
            eDate.setHours(23, 59, 59, 999);
            if (targetDateObj < sDate || targetDateObj > eDate) {
              return;
            }
          }
        }

        const material = state.materials.find(m => String(m.id) === String(it.materialId));
        if (!material) return;

        const durationSec = normalizeAdDurationSeconds(material.duration, material.clipName);
        const itemBlocks =
          Array.isArray(it.timeBlockIds) && it.timeBlockIds.length > 0
            ? it.timeBlockIds
            : res.timeBlockIds || ['tb-1', 'tb-2', 'tb-3'];

        const itemIsSponsor =
          it.isSponsor !== undefined ? Boolean(it.isSponsor) : Boolean(res.isSponsor);
        const itemIsRamadanSpecial =
          it.isRamadanSpecial !== undefined ? Boolean(it.isRamadanSpecial) : Boolean(res.isRamadanSpecial);
        const itemRamadanTarget =
          it.ramadanTarget || res.ramadanTarget || 'iftar'; // 'sahur' | 'iftar' | 'both'
        const itemRamadanPositions =
          Array.isArray(it.ramadanPositions) && it.ramadanPositions.length > 0
            ? it.ramadanPositions
            : Array.isArray(res.ramadanPositions) && res.ramadanPositions.length > 0
            ? res.ramadanPositions
            : ['before', 'middle', 'after'];

        // KURAL: Ramazan Özel olan rezervasyonlar SADECE Ramazan ayı tarih aralığında (veya Sahur/İftar kuşağı olan günde) değerlendirilir!
        if (itemIsRamadanSpecial && !isDateWithinRamadanRange) {
          return;
        }

        const itemSponsorProgram = String(
          it.sponsorProgramTitle !== undefined ? it.sponsorProgramTitle : res.sponsorProgramTitle || ''
        )
          .toLocaleLowerCase('tr-TR')
          .trim();
        const itemSponsorPositions =
          Array.isArray(it.sponsorPositions) && it.sponsorPositions.length > 0
            ? it.sponsorPositions
            : Array.isArray(res.sponsorPositions) && res.sponsorPositions.length > 0
            ? res.sponsorPositions.filter(posId => {
                if (!SINGULAR_SPONSOR_ROLES.includes(posId)) return true;
                const mappedMat = res.sponsorBumperMap?.[posId];
                if (mappedMat) return String(mappedMat) === String(material.id);
                return itemIdx === 0;
              })
            : ['before', 'after'];

        list.push({
          itemKey: `${res.id}__${it.id || itemIdx}__${material.id}`,
          reservationId: res.id,
          priority: Number(it.priority || res.priority) || 700,
          isSponsor: itemIsSponsor,
          sponsorProgramTitle: itemSponsorProgram,
          sponsorPositions: itemSponsorPositions,
          sponsorBumperMap: res.sponsorBumperMap || {},
          isRamadanSpecial: itemIsRamadanSpecial,
          ramadanTarget: itemRamadanTarget,
          ramadanPositions: itemRamadanPositions,
          allowQuotaOverflow: Boolean(it.allowQuotaOverflow ?? res.allowQuotaOverflow ?? true),
          companyId: it.companyId || res.companyId || material.companyId,
          productId: it.productId || res.productId || material.productId,
          materialId: material.id,
          materialName: material.name,
          durationSec,
          dailyMinSpots: Math.max(0, Number(it.dailyMinSpots ?? res.dailyMinSpots ?? 1)),
          dailyMaxSpots: Math.max(1, Number(it.dailyMaxSpots ?? res.dailyMaxSpots ?? 4)),
          plannedSpots: Math.max(1, Number(it.plannedSpots ?? res.totalPlannedSpots ?? 20)),
          timeBlockIds: itemBlocks
        });
      });
    });
    return list;
  };

  let candidates = collectCandidateItems(true);
  if (candidates.length === 0) {
    candidates = collectCandidateItems(false);
  }

  // Önceliğe göre sırala (Ramazan Özel Sponsor > Sponsor > Ramazan Özel > Zorunlu 1000 > Yüksek 700 > Normal 400 > Dolgu 100)
  candidates.sort((a, b) => {
    const aScore = (a.isRamadanSpecial ? 2000 : 0) + (a.isSponsor ? 1500 : 0) + a.priority;
    const bScore = (b.isRamadanSpecial ? 2000 : 0) + (b.isSponsor ? 1500 : 0) + b.priority;
    return bScore - aScore;
  });

  const dailyCountMap = {};
  const addedSpotsByResId = {};

  const getBucketTotalCount = (bucket) =>
    bucket.openingPinnedAds.length + bucket.middleAds.length + bucket.closingPinnedAds.length;

  const tryPlaceCandidateInBucket = (cand, bucket, options = {}) => {
    const {
      ignoreTimeBlock = false,
      ignoreDailyMax = false,
      ignoreCapacity = false,
      ignoreCompanyBalance = false,
      targetSlot = 'middle', // 'opening' | 'middle' | 'closing'
      sponsorRole = null,
      sponsorRoleLabel = null,
      lockOrder = null,
      isRamadanSpot = false
    } = options;

    const matIdStr = String(cand.materialId);
    if (bucket.usedMaterialIds.has(matIdStr)) return false; // KURAL: Aynı reklam aynı kuşakta yer alamaz
    if (bucket.usedItemKeys.has(cand.itemKey)) return false;

    const currentDaily = dailyCountMap[cand.itemKey] || 0;
    if (!ignoreDailyMax && currentDaily >= cand.dailyMaxSpots) return false;

    if (!ignoreTimeBlock && cand.timeBlockIds.length > 0 && !cand.timeBlockIds.includes(bucket.timeBlockId)) {
      return false;
    }

    if (!ignoreCapacity && bucket.usedSec + cand.durationSec > bucket.capacitySec) {
      return false;
    }

    if (targetSlot === 'middle' && !ignoreCompanyBalance) {
      const allCurrent = [...bucket.openingPinnedAds, ...bucket.middleAds, ...bucket.closingPinnedAds];
      const sameCompCount = allCurrent.filter(a => String(a.companyId) === String(cand.companyId)).length;
      const otherCompCount = allCurrent.length - sameCompCount;
      // Eğer kuşakta en az 2 reklam varsa ve aynı firma diğer tüm firmaların toplamını aşıyorsa üst üste gelmeyi önle
      if (allCurrent.length >= 2 && sameCompCount > otherCompCount) {
        return false;
      }
      if (allCurrent.length === 1 && sameCompCount === 1) {
        return false;
      }
    }

    const adEntry = {
      reservationId: cand.reservationId,
      materialId: cand.materialId,
      duration: cand.durationSec,
      companyId: cand.companyId,
      productId: cand.productId,
      isSponsorSpot: Boolean(cand.isSponsor || sponsorRole),
      isRamadanSpot: Boolean(cand.isRamadanSpecial || isRamadanSpot),
      sponsorRole: sponsorRole || null,
      sponsorRoleLabel: sponsorRoleLabel || null,
      lockOrder: lockOrder || null
    };

    if (targetSlot === 'opening') {
      bucket.openingPinnedAds.push(adEntry);
    } else if (targetSlot === 'closing') {
      bucket.closingPinnedAds.push(adEntry);
    } else {
      bucket.middleAds.push(adEntry);
    }

    bucket.usedSec += cand.durationSec;
    bucket.usedItemKeys.add(cand.itemKey);
    bucket.usedMaterialIds.add(matIdStr);
    dailyCountMap[cand.itemKey] = currentDaily + 1;
    if (cand.reservationId) {
      addedSpotsByResId[cand.reservationId] = (addedSpotsByResId[cand.reservationId] || 0) + 1;
    }
    return true;
  };

  const normalizeProgramMatchKey = (str) =>
    String(str || '')
      .toLocaleLowerCase('tr-TR')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '');

  const resolveProgramBreakTargets = (progNorm) => {
    const targetKey = normalizeProgramMatchKey(progNorm);
    const matchingProgItems = timelineItems.filter(it => {
      if (it.isAdBlock || it.isIntroItem) return false;
      if (it.fullSearchText.includes(progNorm)) return true;
      if (targetKey && normalizeProgramMatchKey(it.fullSearchText).includes(targetKey)) return true;
      return false;
    });
    if (matchingProgItems.length === 0) {
      return {
        openingBreaks: [],
        firstMidBreaks: [],
        allMidBreaks: [],
        lastMidBreaks: [],
        closingBreaks: []
      };
    }

    // Aralarında en fazla 150 dakika olan partları aynı yayın oturumu (session) altında grupla
    const sessions = [];
    let currentSession = [matchingProgItems[0]];
    for (let i = 1; i < matchingProgItems.length; i++) {
      const prevPart = currentSession[currentSession.length - 1];
      const currPart = matchingProgItems[i];
      const gapMin = currPart.startMin - prevPart.endMin;
      if (gapMin <= 150) {
        currentSession.push(currPart);
      } else {
        sessions.push(currentSession);
        currentSession = [currPart];
      }
    }
    sessions.push(currentSession);

    const openingBreaks = [];
    const firstMidBreaks = [];
    const allMidBreaks = [];
    const lastMidBreaks = [];
    const closingBreaks = [];

    sessions.forEach(parts => {
      const firstPart = parts[0];
      const lastPart = parts[parts.length - 1];

      // 1. Program (1. Part) girmeden yayınlanan son reklam kuşağı
      for (let idx = firstPart.idx - 1; idx >= 0; idx--) {
        if (timelineItems[idx].isAdBlock) {
          const b = bucketByTimelineIdx.get(idx);
          if (b && !openingBreaks.includes(b)) openingBreaks.push(b);
          break;
        }
        if (!timelineItems[idx].isIntroItem) break;
      }

      // 2. Ardışık partlar (Part 1 -> Part 2, Part 2 -> Part 3...) arasındaki reklam kuşakları
      for (let p = 0; p < parts.length - 1; p++) {
        const partA = parts[p];
        const partB = parts[p + 1];
        const midBucketsBetween = adBreakBuckets.filter(
          b => b.timelineIdx > partA.idx && b.timelineIdx < partB.idx
        );
        if (midBucketsBetween.length > 0) {
          if (!firstMidBreaks.includes(midBucketsBetween[0])) {
            firstMidBreaks.push(midBucketsBetween[0]);
          }
          const lastInGap = midBucketsBetween[midBucketsBetween.length - 1];
          if (!lastMidBreaks.includes(lastInGap)) {
            lastMidBreaks.push(lastInGap);
          }
          midBucketsBetween.forEach(mb => {
            if (!allMidBreaks.includes(mb)) allMidBreaks.push(mb);
          });
        }
      }

      // 3. Program veya son partın bitiminden hemen sonra girecek ilk reklam kuşağı
      for (let idx = lastPart.idx + 1; idx < timelineItems.length; idx++) {
        if (timelineItems[idx].isAdBlock) {
          const b = bucketByTimelineIdx.get(idx);
          if (b && !closingBreaks.includes(b)) closingBreaks.push(b);
          break;
        }
        if (!timelineItems[idx].isIntroItem) break;
      }
    });

    return {
      openingBreaks,
      firstMidBreaks,
      allMidBreaks,
      lastMidBreaks,
      closingBreaks
    };
  };

  // AŞAMA 0: RAMAZAN ÖZEL (SAHUR VE İFTAR) KUŞAKLARINI ÇÖZÜMLE VE YERLEŞTİR
  const resolveRamadanTargetBreaks = (ramadanTargetType) => {
    const targetTypes = ramadanTargetType === 'both' ? ['sahur', 'iftar'] : [ramadanTargetType || 'iftar'];
    const openingBreaks = [];
    const firstMidBreaks = [];
    const allMidBreaks = [];
    const lastMidBreaks = [];
    const closingBreaks = [];

    targetTypes.forEach(rType => {
      // 1. Önce doğrudan kuşak üzerinde `ramadanBreakTag` ile işaretlenmiş olanları ekle
      adBreakBuckets.forEach(b => {
        if (b.ramadanBreakTag === `${rType}_before` && !openingBreaks.includes(b)) {
          openingBreaks.push(b);
        } else if (b.ramadanBreakTag === `${rType}_middle`) {
          if (!allMidBreaks.includes(b)) allMidBreaks.push(b);
          if (!firstMidBreaks.includes(b)) firstMidBreaks.push(b);
          if (!lastMidBreaks.includes(b)) lastMidBreaks.push(b);
        } else if (b.ramadanBreakTag === `${rType}_after` && !closingBreaks.includes(b)) {
          closingBreaks.push(b);
        }
      });

      // 2. Ayrıca program listesinde `ramadanProgramType === rType` veya başlığında sahur/iftar geçen programların komşu kuşaklarını ekle
      const progTargets = resolveProgramBreakTargets(rType);
      progTargets.openingBreaks.forEach(b => { if (!openingBreaks.includes(b)) openingBreaks.push(b); });
      progTargets.firstMidBreaks.forEach(b => { if (!firstMidBreaks.includes(b)) firstMidBreaks.push(b); });
      progTargets.allMidBreaks.forEach(b => { if (!allMidBreaks.includes(b)) allMidBreaks.push(b); });
      progTargets.lastMidBreaks.forEach(b => { if (!lastMidBreaks.includes(b)) lastMidBreaks.push(b); });
      progTargets.closingBreaks.forEach(b => { if (!closingBreaks.includes(b)) closingBreaks.push(b); });
    });

    return {
      openingBreaks,
      firstMidBreaks,
      allMidBreaks,
      lastMidBreaks,
      closingBreaks
    };
  };

  const BUMPER_META = {
    presents: { label: 'Program Öncesi (Sunar)', slot: 'closing', lockOrder: 'last' },
    to_be_continued: { label: 'Program Arası (Devam Edecek)', slot: 'opening', lockOrder: 'first' },
    continues: { label: 'Program Arası (Devam Ediyor)', slot: 'closing', lockOrder: 'last' },
    presented: { label: 'Program Sonrası (Sundu)', slot: 'opening', lockOrder: 'first' }
  };

  const ramadanCandidates = candidates.filter(c => c.isRamadanSpecial);
  ramadanCandidates.forEach(rc => {
    const rTargets = resolveRamadanTargetBreaks(rc.ramadanTarget);
    const rPositions = Array.isArray(rc.ramadanPositions) && rc.ramadanPositions.length > 0
      ? rc.ramadanPositions
      : (Array.isArray(rc.sponsorPositions) && rc.sponsorPositions.length > 0 ? rc.sponsorPositions : ['before', 'middle', 'after']);
    const rLabelPrefix = rc.ramadanTarget === 'sahur' ? '🌙 Sahur' : rc.ramadanTarget === 'both' ? '🌙+🕌 Ramazan' : '🕌 İftar';

    // Ramazan Özel Tekil Sunum/Geçiş Bantları (Sunar, Devam Edecek, Devam Ediyor, Sundu)
    SINGULAR_SPONSOR_ROLES.forEach(roleId => {
      if (!rPositions.includes(roleId)) return;
      let roleBuckets = [];
      if (roleId === 'presents') roleBuckets = rTargets.openingBreaks;
      else if (roleId === 'to_be_continued') roleBuckets = rTargets.firstMidBreaks;
      else if (roleId === 'continues') roleBuckets = rTargets.lastMidBreaks;
      else if (roleId === 'presented') roleBuckets = rTargets.closingBreaks;

      const meta = BUMPER_META[roleId];
      roleBuckets.forEach(bucket => {
        const singularKey = `ramadan_${rc.ramadanTarget}::${roleId}`;
        if (bucket.usedSingularRoles.has(singularKey)) return;
        const placed = tryPlaceCandidateInBucket(rc, bucket, {
          ignoreTimeBlock: true,
          ignoreDailyMax: true,
          targetSlot: meta.slot,
          sponsorRole: roleId,
          sponsorRoleLabel: `${rLabelPrefix} • ${meta.label}`,
          lockOrder: meta.lockOrder,
          isRamadanSpot: true
        });
        if (placed) bucket.usedSingularRoles.add(singularKey);
      });
    });

    // Ramazan Özel Çoklu Kuşak Spotları (Öncesi, Arası, Sonrası)
    if (rPositions.includes('before')) {
      rTargets.openingBreaks.forEach(bucket => {
        tryPlaceCandidateInBucket(rc, bucket, {
          ignoreTimeBlock: true,
          ignoreDailyMax: true,
          targetSlot: 'middle',
          sponsorRole: 'ramadan_before',
          sponsorRoleLabel: `${rLabelPrefix} Öncesi`,
          isRamadanSpot: true
        });
      });
    }
    if (rPositions.includes('middle')) {
      rTargets.allMidBreaks.forEach(bucket => {
        tryPlaceCandidateInBucket(rc, bucket, {
          ignoreTimeBlock: true,
          ignoreDailyMax: true,
          targetSlot: 'middle',
          sponsorRole: 'ramadan_middle',
          sponsorRoleLabel: `${rLabelPrefix} Arası`,
          isRamadanSpot: true
        });
      });
    }
    if (rPositions.includes('after')) {
      rTargets.closingBreaks.forEach(bucket => {
        tryPlaceCandidateInBucket(rc, bucket, {
          ignoreTimeBlock: true,
          ignoreDailyMax: true,
          targetSlot: 'middle',
          sponsorRole: 'ramadan_after',
          sponsorRoleLabel: `${rLabelPrefix} Sonrası`,
          isRamadanSpot: true
        });
      });
    }
  });

  // AŞAMA 1: ÖZEL SUNUM & GEÇİŞ BANTLARI (TEKİL SIRA KİLİTLİ)
  const sponsorCandidates = candidates.filter(c => c.isSponsor && c.sponsorProgramTitle);

  sponsorCandidates.forEach(cand => {
    const progNorm = cand.sponsorProgramTitle;
    if (!progNorm) return;

    const positions = Array.isArray(cand.sponsorPositions) ? cand.sponsorPositions : [];
    const targets = resolveProgramBreakTargets(progNorm);

    SINGULAR_SPONSOR_ROLES.forEach(roleId => {
      if (!positions.includes(roleId)) return;

      let roleBuckets = [];
      if (roleId === 'presents') roleBuckets = targets.openingBreaks;
      else if (roleId === 'to_be_continued') roleBuckets = targets.firstMidBreaks;
      else if (roleId === 'continues') roleBuckets = targets.lastMidBreaks;
      else if (roleId === 'presented') roleBuckets = targets.closingBreaks;

      const meta = BUMPER_META[roleId];
      roleBuckets.forEach(bucket => {
        const singularKey = `${progNorm}::${roleId}`;
        if (bucket.usedSingularRoles.has(singularKey)) return;

        const placed = tryPlaceCandidateInBucket(cand, bucket, {
          ignoreTimeBlock: true,
          ignoreDailyMax: true,
          targetSlot: meta.slot,
          sponsorRole: roleId,
          sponsorRoleLabel: meta.label,
          lockOrder: meta.lockOrder
        });
        if (placed) {
          bucket.usedSingularRoles.add(singularKey);
        }
      });
    });
  });

  // AŞAMA 2: STANDART PROGRAM SPONSORLUKLARI ('before', 'middle', 'after' — ÇOKLU OLABİLİR)
  sponsorCandidates.forEach(sp => {
    const targets = resolveProgramBreakTargets(sp.sponsorProgramTitle);

    if (sp.sponsorPositions.includes('before')) {
      targets.openingBreaks.forEach(bucket => {
        tryPlaceCandidateInBucket(sp, bucket, {
          ignoreTimeBlock: true,
          ignoreDailyMax: true,
          targetSlot: 'middle',
          sponsorRole: 'before',
          sponsorRoleLabel: 'Program Öncesi'
        });
      });
    }

    if (sp.sponsorPositions.includes('middle')) {
      targets.allMidBreaks.forEach(bucket => {
        tryPlaceCandidateInBucket(sp, bucket, {
          ignoreTimeBlock: true,
          ignoreDailyMax: true,
          targetSlot: 'middle',
          sponsorRole: 'middle',
          sponsorRoleLabel: 'Program Arası'
        });
      });
    }

    if (sp.sponsorPositions.includes('after')) {
      targets.closingBreaks.forEach(bucket => {
        tryPlaceCandidateInBucket(sp, bucket, {
          ignoreTimeBlock: true,
          ignoreDailyMax: true,
          targetSlot: 'middle',
          sponsorRole: 'after',
          sponsorRoleLabel: 'Program Sonrası'
        });
      });
    }
  });

  // AŞAMA 3: GÜNLÜK MİNİMUM SPOT GARANTİSİ (`dailyMinSpots`)
  // Ramazan Özel olanlar yalnızca Ramazan kuşaklarında değerlendirilir; standart olanlar tüm kuşaklara dengeli yayılır
  const standardCandidates = candidates.filter(c => !c.isRamadanSpecial);

  standardCandidates.forEach(cand => {
    let guard = 0;
    while ((dailyCountMap[cand.itemKey] || 0) < cand.dailyMinSpots && guard < 36) {
      guard++;
      const eligibleBuckets = adBreakBuckets
        .filter(
          b =>
            !b.usedMaterialIds.has(String(cand.materialId)) &&
            !b.usedItemKeys.has(cand.itemKey) &&
            (cand.timeBlockIds.length === 0 || cand.timeBlockIds.includes(b.timeBlockId)) &&
            b.usedSec + cand.durationSec <= b.capacitySec
        )
        .sort(
          (a, b) =>
            getBucketTotalCount(a) - getBucketTotalCount(b) ||
            a.usedSec / a.capacitySec - b.usedSec / b.capacitySec
        );

      if (eligibleBuckets.length === 0) break;
      let placedAny = false;
      for (const targetBucket of eligibleBuckets) {
        if (tryPlaceCandidateInBucket(cand, targetBucket)) {
          placedAny = true;
          break;
        }
      }
      if (!placedAny) break;
    }
  });

  // AŞAMA 4A: TÜM 26-30 KUŞAK ARASINDA DENGELİ DOLDURMA (`dailyMaxSpots` Sınırına Kadar)
  // Kuşakları her adımda en az dolu olandan en çok dolu olana sıralayarak paralel doldurur (1 kuşak dolunca durmaz!)
  let placedInRound = true;
  let roundCount = 0;
  while (placedInRound && roundCount < 30) {
    placedInRound = false;
    roundCount++;

    const bucketsSortedByLeastFilled = [...adBreakBuckets].sort(
      (a, b) =>
        getBucketTotalCount(a) - getBucketTotalCount(b) ||
        a.usedSec / a.capacitySec - b.usedSec / b.capacitySec
    );

    for (const bucket of bucketsSortedByLeastFilled) {
      if (bucket.usedSec >= bucket.capacitySec) continue;

      // Eğer bu kuşak Ramazan kuşağı ise önce henüz yerleşmemiş Ramazan Özel adayları da dene
      const poolForBucket = bucket.ramadanBreakTag
        ? [...ramadanCandidates, ...standardCandidates]
        : standardCandidates;

      const sortedPool = [...poolForBucket].sort(
        (a, b) =>
          (dailyCountMap[a.itemKey] || 0) / Math.max(1, a.dailyMaxSpots) -
            (dailyCountMap[b.itemKey] || 0) / Math.max(1, b.dailyMaxSpots) ||
          b.priority - a.priority
      );

      for (const cand of sortedPool) {
        if ((dailyCountMap[cand.itemKey] || 0) >= cand.dailyMaxSpots) continue;
        if (tryPlaceCandidateInBucket(cand, bucket)) {
          placedInRound = true;
          break; // Bu turda bu kuşağa 1 spot eklendi, hemen bir sonraki en az dolu kuşağa geç!
        }
      }
    }
  }

  // AŞAMA 4B: MAKSİMUM KUŞAK KAPASİTESİ DOLDURMA (GÜNLÜK 26-30 KUŞAĞIN HİÇBİRİ SEYREK KALMASIN)
  // Eğer `dailyMaxSpots` sınırına ulaşıldığı halde 26-30 kuşakta hala boş süre kapasitesi varsa,
  // reklamları en az dolu kuşaklardan başlayarak kapasite dolana veya benzersiz adaylar tükenene kadar dağıtmaya devam et.
  let overflowRound = 0;
  let placedInOverflow = true;
  const fallbackAllCandidates = standardCandidates.length > 0
    ? standardCandidates
    : collectCandidateItems(false).filter(c => !c.isRamadanSpecial);

  while (placedInOverflow && overflowRound < 35) {
    placedInOverflow = false;
    overflowRound++;

    const underfilledBuckets = [...adBreakBuckets]
      .filter(b => b.usedSec + 15 <= b.capacitySec)
      .sort(
        (a, b) =>
          a.usedSec / a.capacitySec - b.usedSec / b.capacitySec ||
          getBucketTotalCount(a) - getBucketTotalCount(b)
      );

    if (underfilledBuckets.length === 0) break;

    for (const bucket of underfilledBuckets) {
      const pool = bucket.ramadanBreakTag
        ? [...ramadanCandidates, ...fallbackAllCandidates]
        : fallbackAllCandidates;

      // En az kullanılmış ve en yüksek öncelikli adayı seç
      const sortedCands = [...pool].sort(
        (a, b) =>
          (dailyCountMap[a.itemKey] || 0) - (dailyCountMap[b.itemKey] || 0) ||
          b.priority - a.priority
      );

      let placedOne = false;
      // Önce kendi yayın kuşağı (`timeBlockId`) eşleşenleri dene
      for (const cand of sortedCands) {
        if (
          tryPlaceCandidateInBucket(cand, bucket, {
            ignoreDailyMax: true,
            ignoreTimeBlock: false
          })
        ) {
          placedInOverflow = true;
          placedOne = true;
          break;
        }
      }

      // Kendi saat diliminde aday kalmadıysa ve kuşak hala %65'in altındaysa diğer saat dilimi adaylarıyla destekle
      if (!placedOne && bucket.usedSec / bucket.capacitySec < 0.65) {
        for (const cand of sortedCands) {
          if (
            tryPlaceCandidateInBucket(cand, bucket, {
              ignoreDailyMax: true,
              ignoreTimeBlock: true
            })
          ) {
            placedInOverflow = true;
            break;
          }
        }
      }
    }
  }

  // AŞAMA 5: BOŞ KUŞAK KESİNLİKLE OLAMAZ GARANTİSİ (26-30 Kuşağın Tamamı En Az Birkaç Spot İle Dolu Olmalı)
  const allChannelCandidates = collectCandidateItems(false);
  let fallbackMatCursor = 0;
  adBreakBuckets.forEach(bucket => {
    // Kuşak boşsa veya çok az spot varsa eldeki adaylarla doldur
    const minTargetSpots = Math.min(3, Math.max(1, Math.floor(bucket.capacitySec / 45)));
    if (getBucketTotalCount(bucket) >= minTargetSpots) return;

    const sortedPool = [...(candidates.length > 0 ? candidates : allChannelCandidates)].sort(
      (a, b) => (dailyCountMap[a.itemKey] || 0) - (dailyCountMap[b.itemKey] || 0) || b.priority - a.priority
    );

    for (const cand of sortedPool) {
      if (getBucketTotalCount(bucket) >= minTargetSpots) break;
      if (cand.isRamadanSpecial && !bucket.ramadanBreakTag && !isDateWithinRamadanRange) continue;
      tryPlaceCandidateInBucket(cand, bucket, {
        ignoreTimeBlock: true,
        ignoreDailyMax: true,
        ignoreCapacity: getBucketTotalCount(bucket) === 0
      });
    }

    if (getBucketTotalCount(bucket) === 0 && Array.isArray(state.materials) && state.materials.length > 0) {
      const mat = state.materials[fallbackMatCursor % state.materials.length];
      fallbackMatCursor++;
      if (mat) {
        const durSec = normalizeAdDurationSeconds(mat.duration, mat.clipName);
        bucket.middleAds.push({
          reservationId: `fallback-${mat.id}`,
          materialId: mat.id,
          duration: durSec,
          companyId: mat.companyId,
          productId: mat.productId,
          isSponsorSpot: false,
          sponsorRole: 'fallback',
          sponsorRoleLabel: 'Zorunlu Kuşak Dolgusu'
        });
        bucket.usedSec += durSec;
        bucket.usedMaterialIds.add(String(mat.id));
      }
    }
  });

  // AŞAMA 6: KUŞAK İÇİ SIRA KİLİTLERİNİ VE FİRMA AYRIŞTIRMASINI (ÜST ÜSTE GELMEME KURALINI) UYGULA
  const finalPlacements = adBreakBuckets.map(b => {
    const orderedAds = finalizeBucketAdsOrder(b);
    return {
      blockId: b.blockId,
      time: b.time,
      duration: b.duration,
      timeBlockId: b.timeBlockId,
      timeBlockName: b.timeBlockName,
      ramadanBreakTag: b.ramadanBreakTag || '',
      detectedPrevCategory: b.detectedPrevCategory || 'Dini',
      bumperSourceProgram: b.bumperSourceProgram || '',
      ads: orderedAds
    };
  });

  // Gerçekleşen spot sayısını ve aşım (- eksi fark) değerlerini güncelle (RTÜK Giriş/Çıkış jenerikleri ticari spot sayısına dahil edilmez)
  const finalCountsTodayByResId = {};
  finalPlacements.forEach(fp => {
    (fp.ads || []).forEach(ad => {
      if (ad?.reservationId && !ad.isBumperAd) {
        finalCountsTodayByResId[ad.reservationId] = (finalCountsTodayByResId[ad.reservationId] || 0) + 1;
      }
    });
  });

  const updatedReservations = state.reservations.map(res => {
    const prevToday = prevCountsByResId[res.id] || 0;
    const nowToday = finalCountsTodayByResId[res.id] || 0;
    const netDelta = nowToday - prevToday;
    if (netDelta === 0 && !nowToday) return res;

    const nextRealized = Math.max(0, (Number(res.realizedSpots) || 0) + netDelta);
    const plannedTotal = Math.max(0, Number(res.totalPlannedSpots) || 0);
    const overageSpots = plannedTotal > 0 && nextRealized > plannedTotal ? (nextRealized - plannedTotal) : 0;

    return {
      ...res,
      realizedSpots: nextRealized,
      overageSpots: Math.max(Number(res.overageSpots) || 0, overageSpots)
    };
  });

  const nextAdPlacements = {
    ...state.adPlacements,
    [key]: finalPlacements
  };
  saveAdsReservationsBackup(updatedReservations, nextAdPlacements);

  // Revize veya bekleyen günün kuşağı doldurulduğunda "isRevised" işaretini temizle ve durumunu "planned" yap
  const existingDayObj = state.days?.[key];
  const nextDays = existingDayObj
    ? {
        ...state.days,
        [key]: {
          ...existingDayObj,
          isRevised: false,
          adsStatus: existingDayObj.adsStatus === 'completed' ? 'completed' : 'planned',
          lastPlannedAt: Date.now()
        }
      }
    : state.days;

  return {
    days: nextDays,
    adPlacements: nextAdPlacements,
    reservations: updatedReservations
  };
}

/**
 * Belirli bir reklam kuşağına (`breakMeta`) manuel olarak reklam/spot ekler.
 * Tekrar eden klip, üst üste aynı firma ve RTÜK Reklam Giriş/Çıkış jenerik kilidi kontrollerini uygular.
 */
export function executeAddManualAdToBreak(state, channelId, date, breakMeta, adPayload) {
  const key = `ready-${channelId}-${date}`;
  const existingBlocks = [...(state.adPlacements[key] || [])];
  const material = state.materials.find(m => String(m.id) === String(adPayload.materialId));
  if (!material) return state;

  const adDurationSec = normalizeAdDurationSeconds(material.duration, material.clipName);
  const newAdEntry = {
    reservationId: adPayload.reservationId || `manual-${Date.now()}`,
    materialId: material.id,
    duration: adDurationSec,
    companyId: adPayload.companyId || material.companyId,
    productId: adPayload.productId || material.productId,
    isManualSpot: true
  };

  // Kuşaktan önceki programı bularak RTÜK Reklam Giriş / Çıkış jeneriklerini hazırla
  const resolveBumpersForThisBreak = () => {
    const dayObj = state.days?.[key];
    const activeVar = dayObj?.activeVariant || 'v1';
    const progs = dayObj?.variants?.[activeVar]?.programs || [];
    let currentMin = dayObj?.startTime || 0;
    let targetProgIdx = -1;

    progs.forEach((p, idx) => {
      const sMin = p.startMinute !== undefined ? p.startMinute : currentMin;
      const dMin = parseFloat(p.duration || 0);
      currentMin = sMin + dMin;
      const h = Math.floor(sMin / 60) % 24;
      const m = Math.floor(sMin % 60);
      const tStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (
        (breakMeta.blockId && (p.instanceId === breakMeta.blockId || p.id === breakMeta.blockId)) ||
        tStr === breakMeta.time
      ) {
        targetProgIdx = idx;
      }
    });

    let prevProg = null;
    let nextProg = null;
    if (targetProgIdx > -1) {
      for (let i = targetProgIdx - 1; i >= 0; i--) {
        const cand = progs[i];
        const isAd = cand.type === 'ad_break' || String(cand.id).toUpperCase() === 'TPL-3';
        const isIntro = Boolean(cand.isIntroClip) || cand.unitType === 'intro';
        if (isAd) break;
        if (!isIntro) {
          prevProg = cand;
          break;
        }
      }
      for (let i = targetProgIdx + 1; i < progs.length; i++) {
        const cand = progs[i];
        const isAd = cand.type === 'ad_break' || String(cand.id).toUpperCase() === 'TPL-3';
        const isIntro = Boolean(cand.isIntroClip) || cand.unitType === 'intro';
        if (isAd) break;
        if (!isIntro) {
          nextProg = cand;
          break;
        }
      }
    }
    return resolveAdBreakBumpersForPrecedingProgram(state, channelId, prevProg, nextProg);
  };

  const blockIdx = existingBlocks.findIndex(
    b => (breakMeta.blockId && b.blockId === breakMeta.blockId) || b.time === breakMeta.time
  );

  if (blockIdx > -1) {
    const targetBlock = existingBlocks[blockIdx];
    const currentAds = [...(targetBlock.ads || [])];

    // KURAL 1: Aynı reklam aynı reklam kuşağında yer alamaz
    if (currentAds.some(a => !a.isBumperAd && String(a.materialId) === String(material.id))) {
      dialog.warning(
        'Aynı Reklam Tekrar Edemez',
        `"${material.clipName || material.name}" bu reklam kuşağında (${targetBlock.time}) zaten yer alıyor. Aynı reklam aynı kuşakta birden fazla kez bulunamaz.`
      );
      return state;
    }

    const existingIntroBumper = currentAds.find(a => a.isBumperAd && a.bumperType === 'intro');
    const existingOutroBumper = currentAds.find(a => a.isBumperAd && a.bumperType === 'outro');
    const resolvedBumpers =
      !existingIntroBumper || !existingOutroBumper ? resolveBumpersForThisBreak() : null;
    const introBumper = existingIntroBumper || resolvedBumpers?.introBumperAd || null;
    const outroBumper = existingOutroBumper || resolvedBumpers?.outroBumperAd || null;

    // Eğer kullanıcı belirli bir sıra (Seçilinin Üstüne / Altına veya Sürükle-Bırak hedef sırası) seçtiyse:
    // RTÜK kuralı gereği 1. sıradaki Reklam Giriş'in üstüne ve son sıradaki Reklam Çıkış'ın altına geçemez!
    if (typeof adPayload.insertAtIndex === 'number' && !isNaN(adPayload.insertAtIndex)) {
      let nextAds = [...currentAds];
      if (!existingIntroBumper && introBumper) {
        nextAds.unshift(introBumper);
      }
      if (!existingOutroBumper && outroBumper) {
        nextAds.push(outroBumper);
      }
      const firstIsIntro = nextAds[0]?.isBumperAd && nextAds[0]?.bumperType === 'intro';
      const lastIsOutro =
        nextAds.length > 0 &&
        nextAds[nextAds.length - 1]?.isBumperAd &&
        nextAds[nextAds.length - 1]?.bumperType === 'outro';

      const minIdx = firstIsIntro ? 1 : 0;
      const maxIdx = lastIsOutro ? nextAds.length - 1 : nextAds.length;
      const clampedIdx = Math.max(minIdx, Math.min(maxIdx, Math.round(adPayload.insertAtIndex)));

      nextAds.splice(clampedIdx, 0, newAdEntry);
      existingBlocks[blockIdx] = {
        ...targetBlock,
        ads: nextAds
      };
    } else {
      // KURAL 2: Aynı firmanın reklamları üst üste gelemez ve RTÜK Giriş/Çıkış jenerikleri en başta/en sonda korunur
      const openingPinned = currentAds.filter(a => !a.isBumperAd && a.lockOrder === 'first');
      const closingPinned = currentAds.filter(a => !a.isBumperAd && a.lockOrder === 'last');
      const middlePool = [
        ...currentAds.filter(a => !a.isBumperAd && a.lockOrder !== 'first' && a.lockOrder !== 'last'),
        newAdEntry
      ];

      const arrangedAds = finalizeBucketAdsOrder({
        introBumperAd: introBumper,
        outroBumperAd: outroBumper,
        openingPinnedAds: openingPinned,
        middleAds: middlePool,
        closingPinnedAds: closingPinned
      });

      if (!arrangedAds.some(a => !a.isBumperAd && String(a.materialId) === String(material.id))) {
        dialog.warning(
          'Aynı Firmanın Reklamları Üst Üste Gelemez',
          `Bu kuşakta (${targetBlock.time}) aynı firmanın reklamlarının üst üste gelmemesi için araya başka bir firmanın reklamı gerekmektedir.`
        );
        return state;
      }

      existingBlocks[blockIdx] = {
        ...targetBlock,
        ads: arrangedAds
      };
    }
  } else {
    const bumperInfo = resolveBumpersForThisBreak();
    const initialAds = [];
    if (bumperInfo.introBumperAd) initialAds.push(bumperInfo.introBumperAd);
    initialAds.push(newAdEntry);
    if (bumperInfo.outroBumperAd) initialAds.push(bumperInfo.outroBumperAd);

    existingBlocks.push({
      blockId: breakMeta.blockId || `blk-${date}-${breakMeta.time}`,
      time: breakMeta.time,
      duration: breakMeta.duration || 6,
      timeBlockId: breakMeta.timeBlockId || 'tb-2',
      timeBlockName: breakMeta.timeBlockName || 'Reklam Kuşağı',
      detectedPrevCategory: bumperInfo.detectedCategoryName,
      bumperSourceProgram: bumperInfo.sourceProgramTitle,
      ads: initialAds
    });
  }

  const nextAdPlacements = {
    ...state.adPlacements,
    [key]: existingBlocks
  };

  // Eğer eklenen spot mevcut bir rezervasyona bağlıysa realizedSpots ve overageSpots (- aşım) sayısını güncelle
  let nextReservations = state.reservations;
  if (adPayload.reservationId) {
    nextReservations = (state.reservations || []).map(res => {
      if (String(res.id) !== String(adPayload.reservationId)) return res;
      const nextRealized = (Number(res.realizedSpots) || 0) + 1;
      const plannedTotal = Math.max(0, Number(res.totalPlannedSpots) || 0);
      const overageSpots = plannedTotal > 0 && nextRealized > plannedTotal ? (nextRealized - plannedTotal) : 0;
      const spotPrice = Math.max(0, Number(res.spotPrice) || Number(res.items?.[0]?.spotPrice) || 0);
      const overageBudget = overageSpots > 0 && spotPrice > 0 ? Math.round(overageSpots * spotPrice * 100) / 100 : (Number(res.overageBudget) || 0);
      return {
        ...res,
        realizedSpots: nextRealized,
        overageSpots: Math.max(Number(res.overageSpots) || 0, overageSpots),
        overageBudget
      };
    });
  }

  saveAdsReservationsBackup(nextReservations, nextAdPlacements);

  const existingDayObj = state.days?.[key];
  const nextDays = existingDayObj
    ? {
        ...state.days,
        [key]: {
          ...existingDayObj,
          isRevised: false,
          adsStatus: existingDayObj.adsStatus === 'completed' ? 'completed' : 'planned',
          lastPlannedAt: Date.now()
        }
      }
    : state.days;

  return {
    days: nextDays,
    reservations: nextReservations,
    adPlacements: nextAdPlacements
  };
}

