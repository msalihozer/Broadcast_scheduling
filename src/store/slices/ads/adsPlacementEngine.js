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
import { normalizeAdDurationSeconds, saveAdsReservationsBackup } from './adsCatalogHelpers';

export const SINGULAR_SPONSOR_ROLES = ['presents', 'to_be_continued', 'continues', 'presented'];

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
  const opening = [...(bucket.openingPinnedAds || [])];
  const closing = [...(bucket.closingPinnedAds || [])];
  const pool = [...(bucket.middleAds || [])];

  const result = [];
  const usedMatIds = new Set();

  // 1. Açılışta ilk sıraya kilitli reklamları (Sundu / Devam Edecek) ekle
  opening.forEach(ad => {
    const matKey = String(ad.materialId);
    if (usedMatIds.has(matKey)) return;
    if (result.length > 0 && String(result[result.length - 1].companyId) === String(ad.companyId)) {
      return;
    }
    result.push(ad);
    usedMatIds.add(matKey);
  });

  // Kapanışta son sıraya kilitli reklamları (Sunar / Devam Ediyor) hazırla (tekil ve tekrarsız)
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

    // Kalan havuzda hangi firmadan kaç reklam kaldığını say (en çok reklamı olan firmaya öncelik ver ki sıkışmasın)
    const countByComp = {};
    remaining.forEach(ad => {
      const cid = String(ad.companyId || '');
      countByComp[cid] = (countByComp[cid] || 0) + 1;
    });

    // Bir önceki reklamın firmasıyla aynı OLMAYAN adayları bul
    const validIndices = [];
    for (let i = 0; i < remaining.length; i++) {
      if (String(remaining[i].companyId) !== prevCompanyId) {
        validIndices.push(i);
      }
    }

    if (validIndices.length === 0) {
      // Kalan tüm reklamlar son eklenen reklamla aynı firmaya ait; üst üste gelmemesi için eklemeyi durdur
      break;
    }

    // Adaylar arasından:
    // - Önce kuşak içi sponsor reklamlarını (`isSponsorSpot`),
    // - Sonra kalan havuzda en çok reklamı olan firmayı seç
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

  // 3. Eğer son sıradaki `validClosing[0]` ile `result`ın son elemanı aynı firmaysa,
  // `result` içinde yer değiştirilebilecek uygun bir eleman varsa takas et, yoksa son orta elemanı çıkar
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
        // Kapanış sunum bandı (Sunar / Devam Ediyor) önceliklidir; çakışan son orta reklamı kaldır
        result.pop();
      }
    }
  }

  // 4. Son sıra kilitli reklamları (Sunar / Devam Ediyor) en sona ekle
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

  return result;
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

    return {
      idx,
      prog,
      isAdBlock,
      isIntroItem,
      fullSearchText,
      startMin,
      endMin: currentMinutes,
      durMin,
      capacitySec: Math.round(durMin * 60),
      h,
      m,
      timeStr
    };
  });

  // Reklam kuşaklarını ve komşu programlarını (İntro satırlarını şeffaf geçerek) belirle
  const adBreakBuckets = [];
  const bucketByTimelineIdx = new Map();

  timelineItems.forEach((item, idx) => {
    if (!item.isAdBlock) return;

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

    const bucketObj = {
      timelineIdx: idx,
      blockId: item.prog.instanceId || `blk-${date}-${idx}`,
      time: item.timeStr,
      duration: item.durMin,
      capacitySec: Math.max(30, item.capacitySec || 360),
      usedSec: 0,
      timeBlockId: matchedTimeBlock.id,
      timeBlockName: matchedTimeBlock.name,
      prevProgTitle: prevItem ? prevItem.fullSearchText : '',
      nextProgTitle: nextItem ? nextItem.fullSearchText : '',
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

  // Önceliğe göre sırala (Sponsor > Zorunlu 1000 > Yüksek 700 > Normal 400 > Dolgu 100)
  candidates.sort((a, b) => {
    if (a.isSponsor && !b.isSponsor) return -1;
    if (!a.isSponsor && b.isSponsor) return 1;
    return b.priority - a.priority;
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
      targetSlot = 'middle', // 'opening' | 'middle' | 'closing'
      sponsorRole = null,
      sponsorRoleLabel = null,
      lockOrder = null
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

    if (targetSlot === 'middle') {
      const allCurrent = [...bucket.openingPinnedAds, ...bucket.middleAds, ...bucket.closingPinnedAds];
      const sameCompCount = allCurrent.filter(a => String(a.companyId) === String(cand.companyId)).length;
      const otherCompCount = allCurrent.length - sameCompCount;
      if (allCurrent.length > 0 && sameCompCount >= otherCompCount + 1) {
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

  // AŞAMA 1: ÖZEL SUNUM & GEÇİŞ BANTLARI (TEKİL SIRA KİLİTLİ)
  const sponsorCandidates = candidates.filter(c => c.isSponsor && c.sponsorProgramTitle);
  const BUMPER_META = {
    presents: { label: 'Program Öncesi (Sunar)', slot: 'closing', lockOrder: 'last' },
    to_be_continued: { label: 'Program Arası (Devam Edecek)', slot: 'opening', lockOrder: 'first' },
    continues: { label: 'Program Arası (Devam Ediyor)', slot: 'closing', lockOrder: 'last' },
    presented: { label: 'Program Sonrası (Sundu)', slot: 'opening', lockOrder: 'first' }
  };

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
  candidates.forEach(cand => {
    let guard = 0;
    while ((dailyCountMap[cand.itemKey] || 0) < cand.dailyMinSpots && guard < 24) {
      guard++;
      const eligibleBuckets = adBreakBuckets
        .filter(
          b =>
            !b.usedMaterialIds.has(String(cand.materialId)) &&
            !b.usedItemKeys.has(cand.itemKey) &&
            (cand.timeBlockIds.length === 0 || cand.timeBlockIds.includes(b.timeBlockId)) &&
            b.usedSec + cand.durationSec <= b.capacitySec
        )
        .sort((a, b) => a.usedSec / a.capacitySec - b.usedSec / b.capacitySec);

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

  // AŞAMA 4: DENGELİ MAKSİMUM DOLDURMA (`dailyMaxSpots` Sınırına Kadar Round-Robin)
  let placedInRound = true;
  let roundCount = 0;
  while (placedInRound && roundCount < 14) {
    placedInRound = false;
    roundCount++;
    for (const bucket of adBreakBuckets) {
      for (const cand of candidates) {
        if ((dailyCountMap[cand.itemKey] || 0) >= cand.dailyMaxSpots) continue;
        if (tryPlaceCandidateInBucket(cand, bucket)) {
          placedInRound = true;
        }
      }
    }
  }

  // AŞAMA 5: BOŞ KUŞAK GEÇEMEZ GARANTİSİ (Her kuşakta EN AZ 1 reklam bulunması zorunludur)
  const allChannelCandidates = collectCandidateItems(false);
  let fallbackMatCursor = 0;
  adBreakBuckets.forEach(bucket => {
    if (getBucketTotalCount(bucket) > 0) return;

    const sortedPool = [...(candidates.length > 0 ? candidates : allChannelCandidates)].sort(
      (a, b) => (dailyCountMap[a.itemKey] || 0) - (dailyCountMap[b.itemKey] || 0) || b.priority - a.priority
    );

    for (const cand of sortedPool) {
      if (
        tryPlaceCandidateInBucket(cand, bucket, {
          ignoreTimeBlock: true,
          ignoreDailyMax: true,
          ignoreCapacity: true
        })
      ) {
        break;
      }
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
      ads: orderedAds
    };
  });

  const updatedReservations = state.reservations.map(res => {
    const added = addedSpotsByResId[res.id] || 0;
    if (!added) return res;
    return {
      ...res,
      realizedSpots: (Number(res.realizedSpots) || 0) + added
    };
  });

  const nextAdPlacements = {
    ...state.adPlacements,
    [key]: finalPlacements
  };
  saveAdsReservationsBackup(updatedReservations, nextAdPlacements);

  return {
    adPlacements: nextAdPlacements,
    reservations: updatedReservations
  };
}

/**
 * Belirli bir reklam kuşağına (`breakMeta`) manuel olarak reklam/spot ekler.
 * Tekrar eden klip ve üst üste aynı firma kontrollerini uygular.
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

  const blockIdx = existingBlocks.findIndex(
    b => (breakMeta.blockId && b.blockId === breakMeta.blockId) || b.time === breakMeta.time
  );

  if (blockIdx > -1) {
    const targetBlock = existingBlocks[blockIdx];
    const currentAds = [...(targetBlock.ads || [])];

    // KURAL 1: Aynı reklam aynı reklam kuşağında yer alamaz
    if (currentAds.some(a => String(a.materialId) === String(material.id))) {
      dialog.warning(
        'Aynı Reklam Tekrar Edemez',
        `"${material.clipName || material.name}" bu reklam kuşağında (${targetBlock.time}) zaten yer alıyor. Aynı reklam aynı kuşakta birden fazla kez bulunamaz.`
      );
      return state;
    }

    // KURAL 2: Aynı firmanın reklamları üst üste gelemez (ve son sıra kilitli Sunar/Devam Ediyor reklamlarının önüne yerleştirilir)
    const openingPinned = currentAds.filter(a => a.lockOrder === 'first');
    const closingPinned = currentAds.filter(a => a.lockOrder === 'last');
    const middlePool = [...currentAds.filter(a => a.lockOrder !== 'first' && a.lockOrder !== 'last'), newAdEntry];

    const arrangedAds = finalizeBucketAdsOrder({
      openingPinnedAds: openingPinned,
      middleAds: middlePool,
      closingPinnedAds: closingPinned
    });

    if (!arrangedAds.some(a => String(a.materialId) === String(material.id))) {
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
  } else {
    existingBlocks.push({
      blockId: breakMeta.blockId || `blk-${date}-${breakMeta.time}`,
      time: breakMeta.time,
      duration: breakMeta.duration || 6,
      timeBlockId: breakMeta.timeBlockId || 'tb-2',
      timeBlockName: breakMeta.timeBlockName || 'Reklam Kuşağı',
      ads: [newAdEntry]
    });
  }

  const nextAdPlacements = {
    ...state.adPlacements,
    [key]: existingBlocks
  };
  saveAdsReservationsBackup(state.reservations, nextAdPlacements);

  return {
    adPlacements: nextAdPlacements
  };
}

