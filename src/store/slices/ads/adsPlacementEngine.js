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
  DEFAULT_AD_BREAK_BUMPER_RULES,
  DEFAULT_ADS_AUTO_FILL_SETTINGS,
  loadAdsAutoFillSettingsBackup,
  saveAdsAutoFillSettingsBackup
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
    .replace(/[âîû]/g, m => ({ 'â': 'a', 'î': 'i', 'û': 'u' }[m] || m))
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Program veya klip başlığından Bölüm, Part, Kısım, (Canlı) ve dosya uzantısı gibi ekleri temizleyerek
 * baz program adını döndürür. Böylece bir canlı yayın 1, 2 veya 3 part olsa dahi tüm partları aynı baz program adıyla eşleşir.
 */
export function extractBaseProgramTitle(progOrTitle) {
  const raw =
    typeof progOrTitle === 'string'
      ? progOrTitle
      : progOrTitle?.appliedDraftTitle ||
        progOrTitle?.programTitle ||
        progOrTitle?.title ||
        progOrTitle?.name ||
        progOrTitle?.clipName ||
        '';

  return String(raw || '')
    .replace(/\.(mxf|mp4|mov|avi)$/i, '')
    .replace(/\((?:canl[ıi]|bant|tekrar|yeni)[^)]*\)/gi, ' ')
    .replace(/\[(?:canl[ıi]|bant|tekrar|yeni)[^\]]*\]/gi, ' ')
    .replace(/(?:^|\s|-|–|•)(?:canl[ıi]\s*yay[ıi]n|canl[ıi])(?:\s|-|–|•|:|$)/gi, ' ')
    .replace(/(?:^|\s|-|_|–|•)(?:b[öo]l[üu]m|blm|ep|episode|c[üu]z|g[üu]n)\s*[-:.#]?\s*\d+/gi, ' ')
    .replace(/\d+\s*\.\s*(?:b[öo]l[üu]m|k[ıi]s[ıi]m|part|c[üu]z|g[üu]n)/gi, ' ')
    .replace(/(?:^|\s|-|_|–|•)(?:part|pt|k[ıi]s[ıi]m|p)\s*[-:.#]?\s*\d+/gi, ' ')
    .replace(/[_-]\d{1,4}(?:[_-]\d{1,2})?$/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[-–•:\s]+|[-–•:\s]+$/g, '')
    .trim();
}

const GENERIC_OR_LIVE_CAT_KEYS = new Set([
  '',
  'programlar',
  'program',
  'genel',
  'genelyayin',
  'yayin',
  'canliyayin',
  'canli',
  'canliyayinozel',
  'ozelyayin',
  'ozelprogram',
  'ozel',
  'canliyayinvarsayilan'
]);

export function isSpecificContentCategory(catName = '') {
  const norm = normalizeCatKey(catName);
  return Boolean(norm && !GENERIC_OR_LIVE_CAT_KEYS.has(norm));
}

/**
 * Bir canlı yayın veya kategorisi belirtilmemiş program için:
 * 1) MAM Arşivinde (`/api/archive/used-programs` -> `state.usedArchivePrograms`) önceki bölümleri var mı?
 * 2) Medya Kütüphanesinde (`state.libraryPrograms`) veya diğer günlerin yayın listelerinde (`state.days`) önceki bölümleri var mı?
 * 3) Bilinen arşiv programları (Çerçeve, Hasbihal, Güzergah, Bedesten, Mevakib, Riyazü's Salihin vb.) içinde önceki bölümü var mı?
 * kontrol ederek varsa kategori bilgisini döndürür. Hiç önceki bölümü yoksa `null` döndürür.
 */
export function detectPreviousEpisodeCategoryForLiveProgram(state, progOrTitle) {
  const baseTitle = extractBaseProgramTitle(progOrTitle);
  const normBase = normalizeCatKey(baseTitle);
  if (!normBase || normBase === 'canliyayinozel' || normBase === 'ozelprogram' || normBase === 'canliyayin') {
    return null;
  }

  // 1. MAM Arşivindeki aktif programlar (usedArchivePrograms) içinde önceki bölümü var mı?
  const archiveProgs = Array.isArray(state?.usedArchivePrograms) ? state.usedArchivePrograms : [];
  for (const ap of archiveProgs) {
    if (!ap) continue;
    const apBase = normalizeCatKey(extractBaseProgramTitle(ap.title || ap.name || ''));
    if (!apBase || apBase.length < 3) continue;
    if (apBase === normBase || (apBase.length >= 4 && (normBase.includes(apBase) || apBase.includes(normBase)))) {
      const catName = ap.categoryName || ap.category || '';
      const catDetails = getCategoryDetails(ap.categoryId, catName);
      const resolvedName =
        catDetails?.id && isSpecificContentCategory(catDetails.name)
          ? catDetails.name
          : isSpecificContentCategory(catName)
          ? catName
          : null;
      if (resolvedName) {
        return {
          categoryName: resolvedName,
          categoryId: Number(catDetails?.id || ap.categoryId || 4),
          matchedProgramTitle: ap.title || ap.name || baseTitle,
          source: 'archive_previous_episodes'
        };
      }
    }
  }

  // 2. Kütüphane programları (libraryPrograms) içinde önceki bölümü var mı?
  const libProgs = Array.isArray(state?.libraryPrograms) ? state.libraryPrograms : [];
  for (const lp of libProgs) {
    if (!lp) continue;
    const lpBase = normalizeCatKey(extractBaseProgramTitle(lp.title || lp.name || ''));
    if (!lpBase || lpBase.length < 3) continue;
    if (lpBase === normBase || (lpBase.length >= 4 && (normBase.includes(lpBase) || lpBase.includes(normBase)))) {
      const catName = lp.category || lp.categoryName || '';
      const catDetails = getCategoryDetails(lp.categoryId, catName);
      const resolvedName =
        catDetails?.id && isSpecificContentCategory(catDetails.name)
          ? catDetails.name
          : isSpecificContentCategory(catName)
          ? catName
          : null;
      if (resolvedName) {
        return {
          categoryName: resolvedName,
          categoryId: Number(catDetails?.id || lp.categoryId || 4),
          matchedProgramTitle: lp.title || lp.name || baseTitle,
          source: 'library_previous_episodes'
        };
      }
    }
  }

  // 3. Yayın Planlama / Taslak geçmiş veya diğer günlerdeki (`state.days`) önceki bölümlerinde kategori bilgisi var mı?
  const daysObj = state?.days || {};
  for (const dayData of Object.values(daysObj)) {
    if (!dayData?.variants) continue;
    for (const varObj of Object.values(dayData.variants)) {
      const progs = varObj?.programs || [];
      for (const p of progs) {
        if (!p || p.type === 'ad_break' || p.isIntroClip) continue;
        const pCat = p.category || p.categoryName || '';
        if (!isSpecificContentCategory(pCat)) continue;
        const pBase = normalizeCatKey(extractBaseProgramTitle(p));
        if (pBase && pBase.length >= 4 && (pBase === normBase || normBase.includes(pBase) || pBase.includes(normBase))) {
          const catDetails = getCategoryDetails(p.categoryId, pCat);
          return {
            categoryName: catDetails?.id && isSpecificContentCategory(catDetails.name) ? catDetails.name : pCat,
            categoryId: Number(catDetails?.id || p.categoryId || 4),
            matchedProgramTitle: extractBaseProgramTitle(p) || baseTitle,
            source: 'schedule_previous_episodes'
          };
        }
      }
    }
  }

  // 4. Bilinen Semerkand TV Arşiv Programları (Çerçeve, Hasbihal vb. önceki bölümleri arşivde kayıtlı programlar)
  const KNOWN_ARCHIVE_PROGRAM_CATEGORIES = [
    { keywords: ['cerceve', 'guzergah', 'bedesten', 'azizistanbul', 'ulucami', 'mostar', 'sehirveinsan', 'mimari', 'belgesel'], categoryName: 'Kültürel', categoryId: 8 },
    { keywords: ['hasbihal', 'semerkandsohbet', 'mevakib', 'tefsir', 'riyazussalihin', 'salihin', 'kuduri', 'yakut', 'safvet', 'tefasir', 'minhac', 'delail', 'hatmiserif', 'mukabele', 'besvakit', 'hacegan', 'yuzyilinalim', 'mesnevi', 'kisasienbiya', 'ilimdersler', 'tecvid', 'taliulbusra', 'nefismuhasebe', 'cumavaaz', 'kandilozel', 'iftar', 'sahur'], categoryName: 'Dini', categoryId: 4 },
    { keywords: ['hanimlar', 'evimiz', 'mutfak', 'bayan', 'kadinveaile'], categoryName: 'Kadın', categoryId: 1 },
    { keywords: ['sekeragaci', 'mavifidan', 'neselipetek', 'soninci'], categoryName: 'Çocuk', categoryId: 5 },
    { keywords: ['anaajans', 'haberbulten', 'gundemozel'], categoryName: 'Haber', categoryId: 2 }
  ];

  for (const entry of KNOWN_ARCHIVE_PROGRAM_CATEGORIES) {
    if (entry.keywords.some(kw => normBase.includes(kw) || kw.includes(normBase))) {
      return {
        categoryName: entry.categoryName,
        categoryId: entry.categoryId,
        matchedProgramTitle: baseTitle,
        source: 'known_archive_program'
      };
    }
  }

  return null;
}

/**
 * Bir reklam kuşağından hemen önce yayınlanan programı (`prevProg`) ve kategorisini tespit eder;
 * seçili kanal (`channelId`) ve kategori / canlı yayın kuralı için tanımlı RTÜK Reklam Giriş (`introBumperAd`) ve
 * Reklam Çıkış (`outroBumperAd`) jenerik kliplerini ve sürelerini döndürür.
 *
 * Canlı Yayın & Kategorisiz Program Çözümleme Sırası:
 * 1) Reklam Giriş & Çıkış alanında canlı yayın program ismi (`liveProgramNames`) olarak tanımlanmışsa
 *    (program kaç part olursa olsun her part için) doğrudan o kuralın giriş ve çıkışı yerleşir.
 * 2) Kural listesine özel eklenmemişse ama programın (örn: Çerçeve, Hasbihal) önceki bölümleri varsa,
 *    önceki bölümlerinden kategori bilgisi otomatik çekilir ve o kategorinin giriş/çıkışı yerleşir.
 * 3) Hem kural listesine eklenmemiş hem de önceki bölümü / kategori bilgisi yoksa,
 *    aktif kanalın Varsayılan (Default) giriş ve çıkışı (varsayılan: `reklam_kulturel_giris_2014` / `reklam_kulturel_cikis_2014`,
 *    her kanal için ayrı ayrı değiştirilebilir) otomatik yerleşir.
 */
export function resolveAdBreakBumpersForPrecedingProgram(state, channelId, prevProg, nextProg = null) {
  const refProg = prevProg || nextProg || null;
  const sourceProgramTitle =
    refProg?.programTitle || refProg?.title || refProg?.name || refProg?.clipName || 'Genel Yayın';
  const baseProgramTitle = extractBaseProgramTitle(refProg || sourceProgramTitle);
  const normBaseTitle = normalizeCatKey(baseProgramTitle);

  const isLiveProg = Boolean(
    refProg?.isLive ||
      refProg?.type === 'live' ||
      /canl[ıi]/i.test(String(refProg?.category || '')) ||
      /canl[ıi]/i.test(String(refProg?.note || '')) ||
      /\bcanl[ıi]\b/i.test(sourceProgramTitle)
  );

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

  // ============================================================================
  // 1. ÖNCELİK: Reklam Giriş & Çıkış alanında Program İsmi (liveProgramNames) ile eşleşen kural
  // (Kaç part olduğu önemli değil, baz program ismiyle her part için geçerli olur)
  // ============================================================================
  let matchedLiveProgramRule = null;
  if (normBaseTitle) {
    matchedLiveProgramRule = candidateRules.find(r =>
      Array.isArray(r.liveProgramNames) &&
      r.liveProgramNames.some(lpName => {
        const normLp = normalizeCatKey(extractBaseProgramTitle(lpName));
        if (!normLp) return false;
        return normLp === normBaseTitle || normBaseTitle.includes(normLp) || normLp.includes(normBaseTitle);
      })
    );
  }

  let matchedRule = null;
  let detectedCategoryName = '';
  let detectedCategoryId = null;
  let resolutionMethod = 'category'; // 'live_rule' | 'previous_episodes' | 'category' | 'channel_default'

  if (matchedLiveProgramRule) {
    matchedRule = matchedLiveProgramRule;
    resolutionMethod = 'live_rule';
    detectedCategoryName = `Canlı Yayın (${baseProgramTitle || sourceProgramTitle})`;
    detectedCategoryId = Number(matchedLiveProgramRule.categoryIds?.[0]) || 8;
  } else {
    // ============================================================================
    // 2. ÖNCELİK: Programın kendi geçerli kategorisi VEYA önceki bölümlerinden kategori tespiti
    // ============================================================================
    let rawCatName = String(refProg?.category || refProg?.categoryName || '').trim();
    let rawCatId = Number(refProg?.categoryId) || null;
    const hasSpecificCatOnProg = isSpecificContentCategory(rawCatName);

    let prevEpisodeInfo = null;
    if (!hasSpecificCatOnProg && refProg) {
      prevEpisodeInfo = detectPreviousEpisodeCategoryForLiveProgram(state, refProg);
      if (prevEpisodeInfo) {
        rawCatName = prevEpisodeInfo.categoryName;
        rawCatId = prevEpisodeInfo.categoryId;
        resolutionMethod = 'previous_episodes';
      }
    }

    if (isSpecificContentCategory(rawCatName)) {
      const catDetails = getCategoryDetails(rawCatId, rawCatName);
      const cleanCatName =
        catDetails?.id && isSpecificContentCategory(catDetails.name)
          ? catDetails.name
          : rawCatName;
      detectedCategoryName =
        resolutionMethod === 'previous_episodes' && isLiveProg
          ? `${cleanCatName} (Önceki Bölümlerden)`
          : cleanCatName;
      detectedCategoryId = Number(catDetails?.id || rawCatId || 4);
      const normDetected = normalizeCatKey(cleanCatName);

      matchedRule = candidateRules.find(r => {
        if (r.isChannelDefault) return false;
        const byName = (r.categories || []).some(c => {
          const nc = normalizeCatKey(c);
          if (!nc || !normDetected) return false;
          return nc === normDetected || nc.includes(normDetected) || normDetected.includes(nc);
        });
        if (byName) return true;
        const byId = (r.categoryIds || []).some(cid => Number(cid) === detectedCategoryId);
        return byId;
      });
    }

    // ============================================================================
    // 3. ÖNCELİK: Kurala eklenmemiş VE önceki bölümü yok / kategori bilgisi alınamıyorsa
    // Kanal Bazlı Varsayılan (Default) Kuralı (reklam_kulturel_giris_2014 / cikis veya kanalın özel default'u)
    // ============================================================================
    if (!matchedRule) {
      const channelDefaultRule =
        candidateRules.find(r => Boolean(r.isChannelDefault)) ||
        allRules.find(r => String(r.channelId) === String(channelId) && Boolean(r.isChannelDefault)) ||
        candidateRules.find(r => (r.categories || []).some(c => normalizeCatKey(c) === 'kulturel')) ||
        DEFAULT_AD_BREAK_BUMPER_RULES.find(
          r => String(r.channelId) === String(channelId) && Boolean(r.isChannelDefault)
        ) ||
        DEFAULT_AD_BREAK_BUMPER_RULES.find(r => Boolean(r.isChannelDefault)) ||
        DEFAULT_AD_BREAK_BUMPER_RULES[0];

      matchedRule = channelDefaultRule;
      resolutionMethod = 'channel_default';
      detectedCategoryName = isLiveProg
        ? 'Canlı Yayın (Varsayılan Default)'
        : detectedCategoryName || 'Varsayılan (Default)';
      detectedCategoryId = 8;
    }
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
    baseProgramTitle,
    isLiveProg,
    resolutionMethod,
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
 * 3. Kuşak içi (`middleAds`) reklamları ise seçili `uniquenessRule` ('same_clip' | 'same_company' | 'none')
 *    ve firma ayrıştırma (interleaving) kurallarına ve kuşak varyasyonuna göre dizer.
 *
 * @param {Object} bucket - Kuşak içindeki `openingPinnedAds`, `middleAds` ve `closingPinnedAds` dizilerini içeren nesne
 * @param {Object} [orderOpts] - `{ uniquenessRule, rotationSeed }`
 * @returns {Array} Kurallara göre sıralanmış nihai reklam listesi
 */
export function finalizeBucketAdsOrder(bucket, orderOpts = {}) {
  const uniquenessRule = orderOpts.uniquenessRule || bucket.uniquenessRule || 'same_clip';
  const rotationSeed = Number(orderOpts.rotationSeed ?? bucket.rotationSeed ?? 0);

  const introBumper = bucket.introBumperAd || null;
  const outroBumper = bucket.outroBumperAd || null;
  const opening = [...(bucket.openingPinnedAds || [])].filter(a => !a?.isBumperAd);
  const closing = [...(bucket.closingPinnedAds || [])].filter(a => !a?.isBumperAd);
  const rawPool = [...(bucket.middleAds || [])].filter(a => !a?.isBumperAd);

  // Kuşaklar arasında aynı dizilimin tekrar etmemesi için orta havuzu deterministik tohumla döndür
  const pool =
    rawPool.length > 1 && rotationSeed > 0
      ? rawPool.map((_, i) => rawPool[(i + (rotationSeed % rawPool.length)) % rawPool.length])
      : rawPool;

  const result = [];
  const usedMatIds = new Set();
  const usedCompanyIds = new Set();

  const canUseAdInThisBreak = ad => {
    const matKey = String(ad.materialId);
    const compKey = String(ad.companyId || '');
    if (uniquenessRule === 'same_company') {
      return !usedCompanyIds.has(compKey) && !usedMatIds.has(matKey);
    }
    if (uniquenessRule === 'same_clip') {
      return !usedMatIds.has(matKey);
    }
    // 'none' -> İkisi de geçersiz (tekrara izin verilir)
    return true;
  };

  const markAdUsed = ad => {
    usedMatIds.add(String(ad.materialId));
    if (ad.companyId) usedCompanyIds.add(String(ad.companyId));
  };

  // 1. Açılışta ilk sıraya kilitli sponsor reklamlarını (Sundu / Devam Edecek) ekle (Reklam Giriş jeneriğinin hemen altına gelecek)
  opening.forEach(ad => {
    if (!canUseAdInThisBreak(ad)) return;
    if (
      uniquenessRule !== 'none' &&
      result.length > 0 &&
      String(result[result.length - 1].companyId) === String(ad.companyId)
    ) {
      return;
    }
    result.push(ad);
    markAdUsed(ad);
  });

  // Kapanışta son sıraya kilitli sponsor reklamlarını (Sunar / Devam Ediyor) hazırla (Reklam Çıkış jeneriğinin hemen üstüne gelecek)
  const validClosing = [];
  closing.forEach(ad => {
    const matKey = String(ad.materialId);
    const compKey = String(ad.companyId || '');
    if (uniquenessRule === 'same_company' && (usedCompanyIds.has(compKey) || validClosing.some(c => String(c.companyId) === compKey))) {
      return;
    }
    if (uniquenessRule === 'same_clip' && (usedMatIds.has(matKey) || validClosing.some(c => String(c.materialId) === matKey))) {
      return;
    }
    validClosing.push(ad);
  });

  // 2. Orta havuzdaki reklamları aynı firmanın iki reklamı üst üste gelmeyecek şekilde seçerek diz
  const remaining = pool.filter(ad => {
    const matKey = String(ad.materialId);
    const compKey = String(ad.companyId || '');
    if (uniquenessRule === 'same_company') {
      return (
        !usedCompanyIds.has(compKey) &&
        !validClosing.some(c => String(c.companyId) === compKey)
      );
    }
    if (uniquenessRule === 'same_clip') {
      return (
        !usedMatIds.has(matKey) &&
        !validClosing.some(c => String(c.materialId) === matKey)
      );
    }
    return true;
  });

  while (remaining.length > 0) {
    const prevCompanyId = result.length > 0 ? String(result[result.length - 1].companyId) : null;
    const prevMatId = result.length > 0 ? String(result[result.length - 1].materialId) : null;

    const countByComp = {};
    remaining.forEach(ad => {
      const cid = String(ad.companyId || '');
      countByComp[cid] = (countByComp[cid] || 0) + 1;
    });

    let validIndices = [];
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      if (!canUseAdInThisBreak(cand)) continue;
      if (String(cand.companyId) !== prevCompanyId) {
        validIndices.push(i);
      }
    }

    // 'none' modunda farklı firma kalmadıysa en azından farklı klip olanı seç, o da yoksa kalanı al
    if (validIndices.length === 0 && uniquenessRule === 'none') {
      for (let i = 0; i < remaining.length; i++) {
        if (String(remaining[i].materialId) !== prevMatId) {
          validIndices.push(i);
        }
      }
      if (validIndices.length === 0) {
        validIndices = remaining.map((_, idx) => idx);
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
    if (canUseAdInThisBreak(chosenAd)) {
      result.push(chosenAd);
      markAdUsed(chosenAd);
    }
  }

  // 3. Eğer son sıradaki `validClosing[0]` ile `result`ın son elemanı aynı firmaysa takas et veya çıkar
  if (validClosing.length > 0 && result.length > opening.length && uniquenessRule !== 'none') {
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
    if (!canUseAdInThisBreak(ad)) return;
    if (
      uniquenessRule !== 'none' &&
      result.length > 0 &&
      String(result[result.length - 1].companyId) === String(ad.companyId)
    ) {
      if (!result[result.length - 1].lockOrder) {
        result.pop();
      } else {
        return;
      }
    }
    result.push(ad);
    markAdUsed(ad);
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
 * ADIM 1: REZERVASYON ANALİZİ VE AKILLI GÜNLÜK ORTALAMA YAYINLANMA HEDEFİ HESAPLAYICI (`computeSmartDailyTarget`)
 *
 * Her bir rezervasyon kalemi için aşağıdaki 6 parametreyi birlikte analiz ederek `0.00 - 1.00` arasında
 * bir Akıllı Yayınlanma Oranı (`compositeRatio`) ve `Min` ile `Max` arasında dengeli bir
 * **Akıllı Günlük Ortalama Spot Hedefi (`smartDailyTarget`)** üretir:
 * 1. `plannedSpots` & `itemRemainingTotal` (Toplam Planlanan ve Kalan Kampanya Spotu)
 * 2. `totalCampaignDays` & `remainingCampaignDays` (Kampanya Toplam ve Kalan Gün Sayısı)
 * 3. `dailyMinSpots` & `dailyMaxSpots` (Günlük Alt ve Üst Spot Sınırları)
 * 4. `priority` (Öncelik: 1000 Zorunlu, 700 Yüksek, 400 Normal, 100 Dolgu)
 * 5. `isSponsor` / `isRamadanSpecial` (Sponsorluk ve Özel Kuşak Durumu)
 * 6. `eligibleBreaksCount` & `minBreakGap` (Rezervasyonun seçili Yayın Kuşaklarına düşen bugünkü kuşak sayısı
 *    ve ardışık kuşak yasağına göre fiziksel yerleşebileceği maksimum kuşak kapasitesi)
 *
 * ÖNEMLİ KURAL: `smart_pacing` (Akıllı Ortalama Yayınlanma) modunda `dailyMaxSpots > dailyMinSpots` olduğunda
 * her seferinde `dailyMaxSpots` (Max) değerine dayamaz; öncelik, gün/spot oranı ve kuşak kapasitesine göre
 * Min ile Max arasında gerçek bir ağırlıklı ortalama hedef üretir.
 */
export function computeSmartDailyTarget({
  plannedSpots = 20,
  itemRemainingTotal = 20,
  startDate = '',
  endDate = '',
  targetDate = '',
  dailyMinSpots = 1,
  dailyMaxSpots = 4,
  priority = 700,
  isSponsor = false,
  isRamadanSpecial = false,
  eligibleBreaksCount = 12,
  totalBreaksToday = 24,
  minBreakGap = 1,
  dayVariationNoise = 0.5 // 0.0 .. 1.0
}) {
  const rawMax = Math.max(1, Number(dailyMaxSpots) || 4);
  const effectiveMax = Math.max(1, Math.min(rawMax, Number(itemRemainingTotal) || rawMax));
  const rawMin = Math.max(0, Number(dailyMinSpots) ?? 1);
  const effectiveMin = Math.min(rawMin, effectiveMax);

  // Kampanya toplam gün ve kalan gün hesabı
  const targetDateObj = targetDate ? new Date(`${targetDate}T12:00:00`) : new Date();
  let totalCampaignDays = 7;
  let remainingCampaignDays = 7;

  if (startDate && endDate) {
    const sObj = new Date(`${startDate}T00:00:00`);
    const eObj = new Date(`${endDate}T23:59:59`);
    if (!isNaN(sObj.getTime()) && !isNaN(eObj.getTime()) && eObj >= sObj) {
      totalCampaignDays = Math.max(1, Math.ceil((eObj.getTime() - sObj.getTime()) / (1000 * 60 * 60 * 24)));
      const fromObj = targetDateObj > sObj ? targetDateObj : sObj;
      remainingCampaignDays = Math.max(1, Math.ceil((eObj.getTime() - fromObj.getTime()) / (1000 * 60 * 60 * 24)));
    }
  } else {
    const midSpot = Math.max(1, (effectiveMin + effectiveMax) / 2);
    totalCampaignDays = Math.max(3, Math.ceil(plannedSpots / midSpot));
    remainingCampaignDays = Math.max(2, Math.ceil(itemRemainingTotal / midSpot));
  }

  // Eğer başlangıç ve bitiş aynı gün girilmiş ama toplam spot yüksekse (örn. 20 spot),
  // tek günde Max'a kilitlememek için sanal kampanya gününü ortalama kapasiteye göre normalize et
  const midDaily = Math.max(1, (effectiveMin + effectiveMax) / 2);
  const realisticDays =
    totalCampaignDays <= 1 && itemRemainingTotal > effectiveMax
      ? Math.max(3, Math.ceil(itemRemainingTotal / midDaily))
      : remainingCampaignDays;

  // 1. Öncelik ve Sponsorluk Ağırlık Oranı (0.15 .. 0.72)
  const prioNum = Number(priority) || 400;
  let priorityRatio = 0.36; // 400 (Normal) -> Min ile Orta arası
  if (prioNum >= 1000) {
    priorityRatio = 0.64; // 1000 (Zorunlu / Kesin) -> Orta-Üst
  } else if (prioNum >= 700) {
    priorityRatio = 0.48; // 700 (Yüksek) -> Tam Ortalama ((Min + Max) / 2)
  } else if (prioNum <= 100) {
    priorityRatio = 0.16; // 100 (Dolgu / Esnek) -> Min veya Min+1
  }
  if (isSponsor || isRamadanSpecial) {
    priorityRatio = Math.min(0.72, priorityRatio + 0.10);
  }

  // 2. Spot Sayısı / Gün Sayısı Kampanya Temposu Oranı (0.00 .. 0.75)
  const dailyPaceAvg = itemRemainingTotal / Math.max(1, realisticDays);
  const span = Math.max(1, effectiveMax - effectiveMin);
  const rawPaceNorm = Math.max(0, Math.min(1, (dailyPaceAvg - effectiveMin) / span));
  const paceRatio = rawPaceNorm * 0.72;

  // 3. Seçili Yayın Kuşağı (TimeBlock) ve En Az 1 Kuşak Aralık (minBreakGap) Fiziksel Kapasite Oranı
  const safeEligibleBreaks = Math.max(1, Number(eligibleBreaksCount) || Math.ceil(totalBreaksToday * 0.5));
  const maxPossibleWithGap = Math.max(
    1,
    Math.ceil(safeEligibleBreaks / Math.max(1, (Number(minBreakGap) || 0) + 1))
  );
  const breakAvailabilityRatio = Math.max(
    0.15,
    Math.min(0.70, maxPossibleWithGap / Math.max(1, effectiveMax * 1.4))
  );

  // 4. Günlük Küçük Varyasyon Salınımı (-0.11 .. +0.11): Her gün birebir aynı sayıda çakılı kalmaması için
  const jitter = (Math.max(0, Math.min(1, Number(dayVariationNoise) || 0.5)) - 0.5) * 0.22;

  // Bileşik Akıllı Oran (0.10 .. 0.78)
  const compositeRatio = Math.max(
    0.10,
    Math.min(0.78, priorityRatio * 0.50 + paceRatio * 0.35 + breakAvailabilityRatio * 0.15 + jitter)
  );
  const smartRatioPct = Math.round(compositeRatio * 100);

  if (effectiveMax <= effectiveMin) {
    return {
      dailyMinSpots: effectiveMin,
      dailyMaxSpots: effectiveMax,
      smartDailyTarget: effectiveMax,
      smartRatioPct,
      compositeRatio,
      dailyPaceAvg: Number(dailyPaceAvg.toFixed(1)),
      totalCampaignDays,
      remainingCampaignDays: realisticDays,
      maxPossibleWithGap
    };
  }

  let calculatedTarget = Math.round(effectiveMin + (effectiveMax - effectiveMin) * compositeRatio);

  // AKILLI TAVAN KORUMASI:
  // Rezervasyonun Min ve Max değerleri farklıysa (örn: Min 1 - Max 4, Min 1 - Max 5, Min 2 - Max 6),
  // her seferinde Max giriş vermemek için akıllı hedefi Max'ın en az 1 altında (Min ile Max arasındaki ortalamada) tut!
  if (effectiveMax - effectiveMin >= 2) {
    calculatedTarget = Math.min(effectiveMax - 1, calculatedTarget);
  } else if (effectiveMax - effectiveMin === 1) {
    // Min: 1, Max: 2 gibi sadece 1 fark olan durumda: Normal/Dolgu reklamlar 1 (Min) alır, Yüksek/Zorunlu olanlar güne göre 1 veya 2 alır
    calculatedTarget = compositeRatio >= 0.52 ? effectiveMax : effectiveMin;
  }

  // Ardışık kuşak boşluğu (minBreakGap) nedeniyle seçili kuşaklara sığabilecek fiziksel sınırı da aşmasın
  calculatedTarget = Math.min(calculatedTarget, maxPossibleWithGap);
  const smartDailyTarget = Math.max(effectiveMin, Math.min(effectiveMax, calculatedTarget));

  return {
    dailyMinSpots: effectiveMin,
    dailyMaxSpots: effectiveMax,
    smartDailyTarget,
    smartRatioPct,
    compositeRatio,
    dailyPaceAvg: Number(dailyPaceAvg.toFixed(1)),
    totalCampaignDays,
    remainingCampaignDays: realisticDays,
    maxPossibleWithGap
  };
}

/**
 * Seçili kanal ve gün için 6 Adımlı Akıllı Otomatik Reklam Yerleştirme Algoritmasını çalıştırır.
 *
 * ADIM 1: Rezervasyon Analizi & Akıllı Oran Hesabı (`computeSmartDailyTarget`)
 *         Spot sayısı + gün sayısı + min spot + max spot + öncelik + sponsorluk + uygun kuşak sayısına bakarak
 *         her reklam için Min ile Max arasında akıllı ortalama yayınlanma hedefi (`smartDailyTarget`) çıkarır.
 * ADIM 2: Kuşak Uygunluk Matrisi & Kısıt Doğrulayıcı (`canPlaceCandidateInBucket`)
 *         - Aynı reklam aynı kuşakta birden fazla kez OLAMAZ.
 *         - Aynı reklam bir sonraki (ardışık) kuşakta GİREMEZ; en az `minBreakGap` (varsayılan 1) kuşak ara bırakır.
 *         - Her reklam yalnızca kendi seçili Yayın Kuşağı (`Sabah`, `Öğle`, `Akşam Prime Time`, `Gece`) içine girer.
 *         - Günlük Max Spot (`dailyMaxSpots`) ve Kalan Toplam Spot kesinlikle AŞILAMAZ.
 * ADIM 3: Ramazan Özel & Program Sponsorlukları (`Sunar`, `Devam Edecek`, `Devam Ediyor`, `Sundu`, `Öncesi/Arası/Sonrası`)
 * ADIM 4: Günlük Minimum Spot Garantisi (`dailyMinSpots`) — Çoklu Kuşak Opsiyonu & İdeal Aralık Seçimiyle
 * ADIM 5: Akıllı Ortalama Hedef Dağılımı (`smartDailyTarget`) — Çoklu Opsiyon Matrisiyle (Max'a dayamadan!)
 * ADIM 6: Kuşak İçi Sıra Kilitleri, RTÜK Giriş/Çıkış Jenerikleri ve Firma Ayrıştırma (`finalizeBucketAdsOrder`)
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

  // Otomatik Doldurma Ayarları (En Az Kuşak Doluluk Süresi, Kuşak İçi Tekillik, Ardışık Kuşak Aralığı, Varyasyon ve Max Spot Kilidi)
  const autoFillCfg = {
    ...DEFAULT_ADS_AUTO_FILL_SETTINGS,
    ...(state.adsAutoFillSettings || loadAdsAutoFillSettingsBackup() || {})
  };
  const minBreakFillSec = Math.max(0, Number(autoFillCfg.minBreakFillSec ?? 120)); // Varsayılan: 120 sn (2 dk)
  const uniquenessRule = ['same_clip', 'same_company', 'none'].includes(autoFillCfg.uniquenessRule)
    ? autoFillCfg.uniquenessRule
    : 'same_clip';
  const parsedGap = Number(autoFillCfg.minBreakGap);
  const minBreakGap = [0, 1, 2, 3].includes(parsedGap) ? parsedGap : 1; // Varsayılan: 1 (En az 1 kuşak ara bırak, ardışık kuşağa giremez)
  const strictTimeBlocks = autoFillCfg.strictTimeBlocks !== false;
  const quotaStrategy = ['smart_pacing', 'min_plus_2min', 'up_to_max'].includes(autoFillCfg.quotaStrategy)
    ? autoFillCfg.quotaStrategy
    : 'smart_pacing';
  const varyOrderAcrossBreaks = autoFillCfg.varyOrderAcrossBreaks !== false;
  const nextVariationCounter = (Number(autoFillCfg.variationCounter) || 1) + 1;

  // Tarih, kanal ve varyasyon sayacından deterministik ama her günde ve her tıklamada farklılaşan 32-bit PRNG tohumu üret
  const hashString32 = (str) => {
    let h = 2166136261 >>> 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  };
  const baseDaySeed = hashString32(`${channelId}__${date}__v${varyOrderAcrossBreaks ? nextVariationCounter : 1}`);
  const pseudoNoise = (a, b = 0, c = 0) => {
    let x = (baseDaySeed ^ Math.imul(a + 1, 374761393) ^ Math.imul(b + 1, 668265263) ^ Math.imul(c + 1, 2147483647)) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  };

  // Bugünkü reklam kuşaklarının Yayın Kuşağı (Sabah / Öğle / Akşam Prime / Gece) bazında dağılımı
  const totalBucketsCount = adBreakBuckets.length;
  const breaksCountByTimeBlockId = {};
  adBreakBuckets.forEach(b => {
    breaksCountByTimeBlockId[b.timeBlockId] = (breaksCountByTimeBlockId[b.timeBlockId] || 0) + 1;
  });

  // Diğer tüm günlerde (bugün hariç) her bir rezervasyon ve materyal kaleminin kaç kez yerleştiğini gerçek zamanlı hesapla
  // Böylece kampanya toplam `plannedSpots` (Max Toplam Spot) kotası da kesinlikle aşılmaz!
  const otherDaysCountByResId = {};
  const otherDaysCountByResMatKey = {};
  Object.entries(state.adPlacements || {}).forEach(([dKey, blocks]) => {
    if (dKey === key || !Array.isArray(blocks)) return;
    blocks.forEach(blk => {
      (blk?.ads || []).forEach(ad => {
        if (!ad || ad.isBumperAd || !ad.reservationId) return;
        const rId = String(ad.reservationId);
        const rmKey = `${rId}__${ad.materialId}`;
        otherDaysCountByResId[rId] = (otherDaysCountByResId[rId] || 0) + 1;
        otherDaysCountByResMatKey[rmKey] = (otherDaysCountByResMatKey[rmKey] || 0) + 1;
      });
    });
  });

  // ============================================================================
  // ADIM 1: REZERVASYON ANALİZİ VE AKILLI GÜNLÜK ORTALAMA HEDEF (`smartDailyTarget`) HESABI
  // ============================================================================
  const collectCandidateItems = (strictDate = true) => {
    const list = [];
    state.reservations.forEach(res => {
      const resTotalPlanned = Math.max(1, Number(res.totalPlannedSpots) || 20);
      const resUsedOtherDays = otherDaysCountByResId[String(res.id)] || 0;
      const resRemainingCampaignTotal = Math.max(0, resTotalPlanned - resUsedOtherDays);
      if (resRemainingCampaignTotal <= 0) {
        return; // Bu rezervasyonun toplam kampanya spotu diğer günlerde tamamen dolmuş -> AŞILAMAZ!
      }

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
                plannedSpots: resTotalPlanned,
                dailyMinSpots: res.dailyMinSpots ?? 1,
                dailyMaxSpots: res.dailyMaxSpots ?? 4,
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

        const startStr = it.startDate || res.startDate;
        const endStr = it.endDate || res.endDate;
        if (strictDate && startStr && endStr) {
          const sDate = new Date(startStr);
          sDate.setHours(0, 0, 0, 0);
          const eDate = new Date(endStr);
          eDate.setHours(23, 59, 59, 999);
          if (targetDateObj < sDate || targetDateObj > eDate) {
            return;
          }
        }

        const material = state.materials.find(m => String(m.id) === String(it.materialId));
        if (!material) return;

        const itemPlannedTotal = Math.max(1, Number(it.plannedSpots ?? res.totalPlannedSpots ?? 20));
        const itemUsedOtherDays = otherDaysCountByResMatKey[`${res.id}__${material.id}`] || 0;
        const itemRemainingTotal = Math.max(
          0,
          Math.min(itemPlannedTotal - itemUsedOtherDays, resRemainingCampaignTotal)
        );
        if (itemRemainingTotal <= 0) {
          return; // Bu ürünün/klibin toplam planlanan spotu dolmuş -> AŞILAMAZ!
        }

        const durationSec = normalizeAdDurationSeconds(material.duration, material.clipName);
        const itemBlocks =
          Array.isArray(it.timeBlockIds) && it.timeBlockIds.length > 0
            ? it.timeBlockIds
            : res.timeBlockIds || ['tb-1', 'tb-2', 'tb-3'];

        // Bu reklamın seçili Yayın Kuşaklarına (Sabah, Öğle, Akşam Prime, Gece) bugün kaç reklam kuşağı düşüyor?
        const eligibleBreaksCount =
          itemBlocks.length > 0
            ? itemBlocks.reduce((acc, tbId) => acc + (breaksCountByTimeBlockId[tbId] || 0), 0)
            : totalBucketsCount;

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

        const candHash = hashString32(`${res.id}__${material.id}`);
        const itemPriority = Number(it.priority || res.priority) || 700;

        // Spot sayısı + gün sayısı + min spot + max spot + öncelik + sponsorluk + uygun kuşak sayısına göre
        // Akıllı Ortalama Yayınlanma Hedefi (smartDailyTarget) hesapla
        const smartMetrics = computeSmartDailyTarget({
          plannedSpots: itemPlannedTotal,
          itemRemainingTotal,
          startDate: startStr,
          endDate: endStr,
          targetDate: date,
          dailyMinSpots: it.dailyMinSpots ?? res.dailyMinSpots ?? 1,
          dailyMaxSpots: it.dailyMaxSpots ?? res.dailyMaxSpots ?? 4,
          priority: itemPriority,
          isSponsor: itemIsSponsor,
          isRamadanSpecial: itemIsRamadanSpecial,
          eligibleBreaksCount: Math.max(1, eligibleBreaksCount),
          totalBreaksToday: totalBucketsCount,
          minBreakGap,
          dayVariationNoise: varyOrderAcrossBreaks ? pseudoNoise(candHash, 7) : 0.5
        });

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
          resRemainingCampaignTotal,
          itemRemainingTotal,
          priority: itemPriority,
          isSponsor: itemIsSponsor,
          sponsorProgramTitle: itemSponsorProgram,
          sponsorPositions: itemSponsorPositions,
          sponsorBumperMap: res.sponsorBumperMap || {},
          isRamadanSpecial: itemIsRamadanSpecial,
          ramadanTarget: itemRamadanTarget,
          ramadanPositions: itemRamadanPositions,
          companyId: it.companyId || res.companyId || material.companyId,
          productId: it.productId || res.productId || material.productId,
          materialId: material.id,
          materialName: material.name,
          durationSec,
          dailyMinSpots: smartMetrics.dailyMinSpots,
          dailyOptimalTarget: smartMetrics.smartDailyTarget,
          smartDailyTarget: smartMetrics.smartDailyTarget,
          smartRatioPct: smartMetrics.smartRatioPct,
          dailyMaxSpots: smartMetrics.dailyMaxSpots,
          remainingCampaignDays: smartMetrics.remainingCampaignDays,
          totalCampaignDays: smartMetrics.totalCampaignDays,
          eligibleBreaksCount: Math.max(1, eligibleBreaksCount),
          plannedSpots: itemPlannedTotal,
          timeBlockIds: itemBlocks,
          candHash
        });
      });
    });
    return list;
  };

  const candidates = collectCandidateItems(true);

  // Önceliğe, akıllı orana ve günlük varyasyona göre sırala (aynı öncelik grubundakiler her gün farklı sırada başlar!)
  candidates.sort((a, b) => {
    const aTier = (a.isRamadanSpecial ? 2000 : 0) + (a.isSponsor ? 1500 : 0) + a.priority;
    const bTier = (b.isRamadanSpecial ? 2000 : 0) + (b.isSponsor ? 1500 : 0) + b.priority;
    if (bTier !== aTier) return bTier - aTier;
    return pseudoNoise(a.candHash, 1) - pseudoNoise(b.candHash, 1);
  });

  const dailyCountMap = {};
  const addedSpotsByResId = {};

  // Her kuşağa sıra numarası (`bucketOrderIdx`), firma tekilliği takibi ve rotasyon tohumu ekle
  adBreakBuckets.forEach((b, bIdx) => {
    b.bucketOrderIdx = bIdx;
    b.usedCompanyIds = new Set();
    b.uniquenessRule = uniquenessRule;
    b.rotationSeed = (baseDaySeed + bIdx * 7) % 97;
  });

  // ============================================================================
  // ADIM 2: KUŞAK UYGUNLUK MATRİSİ, AYNI KUŞAK TEKİLLİĞİ VE ARDIŞIK KUŞAK YASAĞI
  // ============================================================================
  // Bir reklamın o gün içinde yerleştiği TÜM kuşak sıra numaralarını (`bucketOrderIdx`) Set içinde tutar.
  // Böylece kuşaklar hangi sırayla gezilirse gezilsin, Kuşak #k'da olan bir reklam Kuşak #(k-1) veya #(k+1)'e GİREMEZ!
  const placedBucketIndicesByMatId = new Map(); // matIdStr -> Set<number>
  const placedBucketIndicesByItemKey = new Map(); // itemKey -> Set<number>
  const placedTimeBlockCountsByItemKey = new Map(); // itemKey -> Record<timeBlockId, number>

  const getBucketTotalCount = (bucket) =>
    bucket.openingPinnedAds.length + bucket.middleAds.length + bucket.closingPinnedAds.length;

  const getBucketAdsDurationSec = (bucket) =>
    Math.max(0, bucket.usedSec - (Number(bucket.introBumperAd?.duration) || 0) - (Number(bucket.outroBumperAd?.duration) || 0));

  /**
   * KATI KISIT DOĞRULAYICI (`canPlaceCandidateInBucket`):
   * 1. MAX SPOT & ETKİN KOTA KONTROLÜ: `dailyMaxSpots`, `itemRemainingTotal` ve `maxAllowedForStage` kesinlikle aşılamaz.
   * 2. AYNI KUŞAKTA BİRDEN FAZLA OLAMAZ: Aynı reklam klibi (veya `same_company` seçiliyse aynı firma) aynı kuşağa ikinci kez giremez.
   * 3. ARDIŞIK KUŞAK YASAĞI (EN AZ `minBreakGap` KUŞAK ARALIK): Aynı reklam bir önceki veya bir sonraki kuşağa giremez;
   *    yerleştiği herhangi bir kuşakla arasında en az `minBreakGap` (varsayılan 1) tam kuşak boşluk bırakmak zorundadır.
   * 4. HANGİ KUŞAKLARDA GİRECEK (`timeBlockIds`): Reklam yalnızca rezervasyonunda seçilen Yayın Kuşağı (`Sabah`, `Öğle`, `Akşam Prime`, `Gece`) kuşaklarına girer.
   * 5. SÜRE & FİRMA DENGE KONTROLÜ: Kuşak kapasitesini aşamaz ve aynı kuşağa aynı firmanın reklamlarını yığmaz.
   */
  const canPlaceCandidateInBucket = (cand, bucket, options = {}) => {
    const {
      ignoreTimeBlock = false,
      ignoreCapacity = false,
      ignoreCompanyBalance = false,
      allowDuplicateInNoneMode = false,
      targetSlot = 'middle',
      maxAllowedForStage = cand.dailyMaxSpots,
      customBreakGap = minBreakGap
    } = options;

    // 1. KATI MAX SPOT VE AŞAMA HEDEF KOTASI KONTROLÜ
    const currentDaily = dailyCountMap[cand.itemKey] || 0;
    if (currentDaily >= cand.dailyMaxSpots) return false;
    if (currentDaily >= maxAllowedForStage) return false;
    if (currentDaily >= cand.itemRemainingTotal) return false;
    const currentResAdded = addedSpotsByResId[cand.reservationId] || 0;
    if (currentResAdded >= cand.resRemainingCampaignTotal) return false;

    const matIdStr = String(cand.materialId);
    const compIdStr = String(cand.companyId || '');

    // 2. AYNI KUŞAKTA BİRDEN FAZLA OLAMAZ (KUŞAK İÇİ TEKİLLİK KURALI)
    if (uniquenessRule === 'same_company') {
      if (bucket.usedCompanyIds.has(compIdStr)) return false;
      if (bucket.usedMaterialIds.has(matIdStr)) return false;
    } else if (uniquenessRule === 'same_clip') {
      if (bucket.usedMaterialIds.has(matIdStr)) return false;
      if (bucket.usedItemKeys.has(cand.itemKey)) return false;
    } else {
      if (!allowDuplicateInNoneMode && bucket.usedMaterialIds.has(matIdStr)) {
        return false;
      }
    }

    // 3. ARDIŞIK KUŞAK YASAĞI (AYNI REKLAM BİR SONRAKİ / ÖNCEKİ KUŞAKTA GİREMEZ, EN AZ `customBreakGap` KUŞAK ARA BIRAKIR)
    if (customBreakGap > 0) {
      const placedMatSet = placedBucketIndicesByMatId.get(matIdStr);
      if (placedMatSet && placedMatSet.size > 0) {
        for (const placedIdx of placedMatSet) {
          if (Math.abs(bucket.bucketOrderIdx - placedIdx) <= customBreakGap) {
            return false;
          }
        }
      }
      const placedItemSet = placedBucketIndicesByItemKey.get(cand.itemKey);
      if (placedItemSet && placedItemSet.size > 0) {
        for (const placedIdx of placedItemSet) {
          if (Math.abs(bucket.bucketOrderIdx - placedIdx) <= customBreakGap) {
            return false;
          }
        }
      }
    }

    // 4. HANGİ KUŞAKLARDA GİRECEK (YAYIN KUŞAĞI / TIME BLOCK EŞLEŞMESİ)
    if (!ignoreTimeBlock && cand.timeBlockIds.length > 0 && !cand.timeBlockIds.includes(bucket.timeBlockId)) {
      return false;
    }

    // 5. KUŞAK SÜRE KAPASİTESİ KONTROLÜ
    if (!ignoreCapacity && bucket.usedSec + cand.durationSec > bucket.capacitySec) {
      return false;
    }

    // 6. KUŞAK İÇİ FİRMA DENGESİ KONTROLÜ
    if (targetSlot === 'middle' && !ignoreCompanyBalance && uniquenessRule !== 'none') {
      const allCurrent = [...bucket.openingPinnedAds, ...bucket.middleAds, ...bucket.closingPinnedAds];
      const sameCompCount = allCurrent.filter(a => String(a.companyId) === compIdStr).length;
      const otherCompCount = allCurrent.length - sameCompCount;
      if (allCurrent.length >= 2 && sameCompCount > otherCompCount) {
        return false;
      }
      if (allCurrent.length === 1 && sameCompCount === 1) {
        return false;
      }
    }

    return true;
  };

  /**
   * Doğrulanan adayı kuşağa yerleştirir ve yerleştiği kuşak indeksini (`bucket.bucketOrderIdx`)
   * `placedBucketIndicesByMatId` ve `placedBucketIndicesByItemKey` kümelerine kaydeder.
   */
  const tryPlaceCandidateInBucket = (cand, bucket, options = {}) => {
    if (!canPlaceCandidateInBucket(cand, bucket, options)) {
      return false;
    }

    const {
      targetSlot = 'middle', // 'opening' | 'middle' | 'closing'
      sponsorRole = null,
      sponsorRoleLabel = null,
      lockOrder = null,
      isRamadanSpot = false
    } = options;

    const currentDaily = dailyCountMap[cand.itemKey] || 0;
    const currentResAdded = addedSpotsByResId[cand.reservationId] || 0;
    const matIdStr = String(cand.materialId);
    const compIdStr = String(cand.companyId || '');

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
    if (compIdStr) bucket.usedCompanyIds.add(compIdStr);

    dailyCountMap[cand.itemKey] = currentDaily + 1;
    if (cand.reservationId) {
      addedSpotsByResId[cand.reservationId] = currentResAdded + 1;
    }

    if (!placedBucketIndicesByMatId.has(matIdStr)) {
      placedBucketIndicesByMatId.set(matIdStr, new Set());
    }
    placedBucketIndicesByMatId.get(matIdStr).add(bucket.bucketOrderIdx);

    if (!placedBucketIndicesByItemKey.has(cand.itemKey)) {
      placedBucketIndicesByItemKey.set(cand.itemKey, new Set());
    }
    placedBucketIndicesByItemKey.get(cand.itemKey).add(bucket.bucketOrderIdx);

    const prevTbCounts = placedTimeBlockCountsByItemKey.get(cand.itemKey) || {};
    placedTimeBlockCountsByItemKey.set(cand.itemKey, {
      ...prevTbCounts,
      [bucket.timeBlockId]: (prevTbCounts[bucket.timeBlockId] || 0) + 1
    });

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

  // ============================================================================
  // ADIM 3: RAMAZAN ÖZEL VE PROGRAM SPONSORLUKLARININ HEDEF KUŞAKLARA YERLEŞTİRİLMESİ
  // ============================================================================
  const resolveRamadanTargetBreaks = (ramadanTargetType) => {
    const targetTypes = ramadanTargetType === 'both' ? ['sahur', 'iftar'] : [ramadanTargetType || 'iftar'];
    const openingBreaks = [];
    const firstMidBreaks = [];
    const allMidBreaks = [];
    const lastMidBreaks = [];
    const closingBreaks = [];

    targetTypes.forEach(rType => {
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
    const rLabelPrefix = rc.ramadanTarget === 'sahur' ? 'Sahur' : rc.ramadanTarget === 'both' ? 'Ramazan' : 'İftar';

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
          customBreakGap: 0,
          targetSlot: meta.slot,
          sponsorRole: roleId,
          sponsorRoleLabel: `${rLabelPrefix} • ${meta.label}`,
          lockOrder: meta.lockOrder,
          isRamadanSpot: true
        });
        if (placed) bucket.usedSingularRoles.add(singularKey);
      });
    });

    if (rPositions.includes('before')) {
      rTargets.openingBreaks.forEach(bucket => {
        tryPlaceCandidateInBucket(rc, bucket, {
          ignoreTimeBlock: true,
          customBreakGap: 0,
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
          customBreakGap: 0,
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
          customBreakGap: 0,
          targetSlot: 'middle',
          sponsorRole: 'ramadan_after',
          sponsorRoleLabel: `${rLabelPrefix} Sonrası`,
          isRamadanSpot: true
        });
      });
    }
  });

  // 3B: ÖZEL SUNUM & GEÇİŞ BANTLARI (TEKİL SIRA KİLİTLİ — Max Spot Koruyarak)
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
          customBreakGap: 0,
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

  // 3C: STANDART PROGRAM SPONSORLUKLARI ('before', 'middle', 'after' — Max Spot Koruyarak)
  sponsorCandidates.forEach(sp => {
    const targets = resolveProgramBreakTargets(sp.sponsorProgramTitle);

    if (sp.sponsorPositions.includes('before')) {
      targets.openingBreaks.forEach(bucket => {
        tryPlaceCandidateInBucket(sp, bucket, {
          ignoreTimeBlock: true,
          customBreakGap: 0,
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
          customBreakGap: 0,
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
          customBreakGap: 0,
          targetSlot: 'middle',
          sponsorRole: 'after',
          sponsorRoleLabel: 'Program Sonrası'
        });
      });
    }
  });

  const standardCandidates = candidates.filter(c => !c.isRamadanSpecial);

  /**
   * ÇOKLU OPSİYON DEĞERLENDİRİCİ (`evaluateCandidateBucketOption`):
   * Bir aday reklamın (`cand`) girebileceği uygun kuşak opsiyonlarını (`bucket`) 6 farklı boyutta puanlar:
   * 1. Mevcut Yerleşimlere En Yakın Mesafe (`minDistScore`):
   *    Reklamın o gün yerleştiği TÜM diğer kuşaklara olan en kısa mesafesini hesaplar;
   *    gün içine homojen yayılmasını (`idealStride`) ödüllendirir.
   * 2. Yayın Kuşağı (Sabah / Öğle / Akşam / Gece) Çeşitliliği (`timeBlockSpreadBonus`):
   *    Birden fazla saat dilimi seçiliyse tüm spotların sadece Sabah'a yığılmasını önler; henüz girmediği saat dilimine öncelik verir.
   * 3. Kuşak Doluluk Dengesi & 2 Dk Taban İhtiyacı (`breakNeedScore`):
   *    Süresi `minBreakFillSec` (2 dk) altında olan ve daha az spot bulunan kuşaklara öncelik verir.
   * 4. Firma Çeşitliliği (`companyDiversityBonus`):
   *    Kuşak içinde henüz bu firmanın başka reklamı yoksa ek puan verir.
   * 5. Rezervasyon Önceliği & Akıllı Hedef Açığı (`candidateUrgencyScore`):
   *    Zorunlu (1000) > Yüksek (700) > Normal (400) > Dolgu (100) ve `smartDailyTarget` oranına göre puanlar.
   * 6. Günlük / Kuşak Varyasyonu (`noise`):
   *    Her kuşağın ve her günün birbirinin kopyası olmaması için deterministik rotasyon ekler.
   */
  const evaluateCandidateBucketOption = (cand, bucket, activeCapForCand, stepNum = 1) => {
    const usedSecAds = getBucketAdsDurationSec(bucket);
    const currentDaily = dailyCountMap[cand.itemKey] || 0;
    const matIdStr = String(cand.materialId);
    const compIdStr = String(cand.companyId || '');

    // 1. Kuşak Doluluk İhtiyacı
    const under2MinBonus = usedSecAds < minBreakFillSec ? (minBreakFillSec - usedSecAds) * 4.5 : 0;
    const emptinessScore = (1 - bucket.usedSec / Math.max(1, bucket.capacitySec)) * 240;
    const spotCountPenalty = getBucketTotalCount(bucket) * 42;

    // 2. Bu reklamın yerleştiği TÜM diğer kuşaklara olan mesafe (Homojen Yayılım)
    let spacingScore = 180;
    const placedMatSet = placedBucketIndicesByMatId.get(matIdStr);
    if (placedMatSet && placedMatSet.size > 0) {
      let minDist = Infinity;
      for (const idx of placedMatSet) {
        const d = Math.abs(bucket.bucketOrderIdx - idx);
        if (d < minDist) minDist = d;
      }
      const targetSpotsForStride = Math.max(1, activeCapForCand || cand.smartDailyTarget || 2);
      const idealStride = Math.max(
        minBreakGap + 1,
        Math.floor(totalBucketsCount / (targetSpotsForStride + 0.5))
      );
      if (minDist >= idealStride) {
        spacingScore = 320 + Math.min(120, (minDist - idealStride) * 14);
      } else {
        spacingScore = (minDist / Math.max(1, idealStride)) * 220;
      }
    }

    // 3. Yayın Kuşağı (Sabah / Öğle / Akşam / Gece) Dengeli Dağılım Bonusu
    const tbCounts = placedTimeBlockCountsByItemKey.get(cand.itemKey) || {};
    const countInThisTb = tbCounts[bucket.timeBlockId] || 0;
    const timeBlockSpreadBonus = countInThisTb === 0 ? 210 : Math.max(0, 110 - countInThisTb * 55);

    // 4. Firma Çeşitliliği Bonusu
    const companyDiversityBonus = !bucket.usedCompanyIds.has(compIdStr) ? 135 : 0;

    // 5. Adayın Akıllı Hedef Açığı ve Önceliği
    const usageRatio = currentDaily / Math.max(1, activeCapForCand);
    const candidateUrgencyScore =
      (1 - usageRatio) * 340 +
      cand.priority * 0.35 +
      (cand.isSponsor ? 180 : 0);

    // 6. Varyasyon Tohumu
    const noise = varyOrderAcrossBreaks
      ? pseudoNoise(cand.candHash, bucket.bucketOrderIdx + 1, stepNum) * 85
      : 0;

    return (
      under2MinBonus +
      emptinessScore -
      spotCountPenalty +
      spacingScore +
      timeBlockSpreadBonus +
      companyDiversityBonus +
      candidateUrgencyScore +
      noise
    );
  };

  // ============================================================================
  // ADIM 4: GÜNLÜK MİNİMUM SPOT GARANTİSİ (`dailyMinSpots`) — ÇOKLU OPSİYON SEÇİMİYLE
  // Her reklamın Günlük Min Spot (`dailyMinSpots`) alt sınırını, girebileceği uygun kuşak opsiyonlarını
  // karşılaştırıp en ideal aralıklı (`minBreakGap >= 1`) ve en dengeli kuşağa yerleştirerek garanti altına alır.
  // ============================================================================
  let minStageActive = true;
  let minStageStep = 0;
  while (minStageActive && minStageStep < 250) {
    minStageActive = false;
    minStageStep++;

    // Henüz `dailyMinSpots` sayısına ulaşmamış adayları bul
    const candsNeedingMin = standardCandidates.filter(c => {
      const cur = dailyCountMap[c.itemKey] || 0;
      return cur < c.dailyMinSpots && cur < c.dailyMaxSpots && cur < c.itemRemainingTotal;
    });
    if (candsNeedingMin.length === 0) break;

    let bestOption = null;

    for (const cand of candsNeedingMin) {
      for (const bucket of adBreakBuckets) {
        if (
          !canPlaceCandidateInBucket(cand, bucket, {
            ignoreTimeBlock: false,
            maxAllowedForStage: cand.dailyMinSpots
          })
        ) {
          continue;
        }
        const score = evaluateCandidateBucketOption(cand, bucket, cand.dailyMinSpots, minStageStep);
        if (!bestOption || score > bestOption.score) {
          bestOption = { cand, bucket, score };
        }
      }
    }

    // Eğer `strictTimeBlocks === false` ise ve kendi kuşağında yer kalmadıysa esnek kuşak opsiyonlarına bak
    if (!bestOption && !strictTimeBlocks) {
      for (const cand of candsNeedingMin) {
        for (const bucket of adBreakBuckets) {
          if (
            !canPlaceCandidateInBucket(cand, bucket, {
              ignoreTimeBlock: true,
              maxAllowedForStage: cand.dailyMinSpots
            })
          ) {
            continue;
          }
          const score = evaluateCandidateBucketOption(cand, bucket, cand.dailyMinSpots, minStageStep);
          if (!bestOption || score > bestOption.score) {
            bestOption = { cand, bucket, score, ignoreTimeBlock: true };
          }
        }
      }
    }

    if (bestOption) {
      const placed = tryPlaceCandidateInBucket(bestOption.cand, bestOption.bucket, {
        ignoreTimeBlock: Boolean(bestOption.ignoreTimeBlock),
        maxAllowedForStage: bestOption.cand.dailyMinSpots
      });
      if (placed) {
        minStageActive = true;
      }
    }
  }

  // ============================================================================
  // ADIM 5: AKILLI ORTALAMA YAYINLANMA SİSTEMİ (`smartDailyTarget`) — ÇOKLU OPSİYON MATRİSİ
  // Rezervasyonları `dailyMinSpots` seviyesinden kendi hesaplanan Akıllı Ortalama Hedeflerine (`smartDailyTarget`)
  // kadar adım adım yerleştirir:
  // - `'smart_pacing'` (Varsayılan): Her reklam kendi `smartDailyTarget` (Min ile Max arasındaki akıllı ortalama)
  //   değerinde durur; HİÇBİR REKLAMI HER SEFERİNDE MAX SPOTA DAYAMAZ!
  // - `'min_plus_2min'`: Sadece `dailyMinSpots` seviyesinde kalır (yalnızca 2 dk altındaki kuşaklar için `smartDailyTarget`'a kadar destek verir).
  // - `'up_to_max'`: Kullanıcı özellikle Max seçtiyse `dailyMaxSpots` sınırına kadar izin verir.
  // ============================================================================
  const getTargetCapForCandidate = (cand) => {
    if (quotaStrategy === 'up_to_max') {
      return cand.dailyMaxSpots;
    }
    // Hem 'smart_pacing' hem de 'min_plus_2min' için tavan `cand.smartDailyTarget` (Akıllı Ortalama Hedef) değeridir!
    return cand.smartDailyTarget;
  };

  let smartStageActive = true;
  let smartStageStep = 0;
  while (smartStageActive && smartStageStep < 400) {
    smartStageActive = false;
    smartStageStep++;

    // `min_plus_2min` modunda yalnızca 2 dk (`minBreakFillSec`) altındaki kuşaklara bak,
    // `smart_pacing` ve `up_to_max` modlarında ise tüm uygun kuşak opsiyonlarını değerlendir (2 dk altındakiler ekstra puan alır)
    const candidateBuckets =
      quotaStrategy === 'min_plus_2min'
        ? adBreakBuckets.filter(b => getBucketAdsDurationSec(b) < minBreakFillSec && b.usedSec + 10 <= b.capacitySec)
        : adBreakBuckets.filter(b => b.usedSec + 10 <= b.capacitySec);

    if (candidateBuckets.length === 0) break;

    let bestOption = null;

    for (const bucket of candidateBuckets) {
      const poolForBucket = bucket.ramadanBreakTag
        ? [...ramadanCandidates, ...standardCandidates]
        : standardCandidates;

      for (const cand of poolForBucket) {
        const activeCap = getTargetCapForCandidate(cand);
        const cur = dailyCountMap[cand.itemKey] || 0;
        if (cur >= activeCap || cur >= cand.dailyMaxSpots) continue;

        if (
          !canPlaceCandidateInBucket(cand, bucket, {
            ignoreTimeBlock: false,
            maxAllowedForStage: activeCap
          })
        ) {
          continue;
        }

        const score = evaluateCandidateBucketOption(cand, bucket, activeCap, smartStageStep + 100);
        if (!bestOption || score > bestOption.score) {
          bestOption = { cand, bucket, activeCap, score };
        }
      }
    }

    if (bestOption) {
      const placed = tryPlaceCandidateInBucket(bestOption.cand, bestOption.bucket, {
        ignoreTimeBlock: false,
        maxAllowedForStage: bestOption.activeCap
      });
      if (placed) {
        smartStageActive = true;
      }
    }
  }

  // ADIM 5B: TAMAMEN BOŞ (0 SPOT) KALAN KUŞAK VARSA TEK SPOT KORUMASI
  // Kuşakların hiçbirinin 0 ticari reklamla tamamen boş geçmemesi için, eğer 0 spotlu kuşak kaldıysa
  // hala `dailyMaxSpots` altında hakkı olan ve ardışık kuşak yasağını (`minBreakGap`) bozmayan en uygun 1 reklamı ata.
  adBreakBuckets
    .filter(b => getBucketTotalCount(b) === 0 && b.usedSec + 10 <= b.capacitySec)
    .forEach((emptyBucket, ebIdx) => {
      const eligibleForEmpty = standardCandidates
        .filter(c =>
          canPlaceCandidateInBucket(c, emptyBucket, {
            ignoreTimeBlock: !strictTimeBlocks,
            maxAllowedForStage: c.dailyMaxSpots
          })
        )
        .sort(
          (a, b) =>
            evaluateCandidateBucketOption(b, emptyBucket, b.dailyMaxSpots, ebIdx + 300) -
            evaluateCandidateBucketOption(a, emptyBucket, a.dailyMaxSpots, ebIdx + 300)
        );

      if (eligibleForEmpty.length > 0) {
        tryPlaceCandidateInBucket(eligibleForEmpty[0], emptyBucket, {
          ignoreTimeBlock: !strictTimeBlocks,
          maxAllowedForStage: eligibleForEmpty[0].dailyMaxSpots
        });
      }
    });

  // ============================================================================
  // ADIM 6: KUŞAK İÇİ SIRA KİLİTLERİNİ, RTÜK GİRİŞ/ÇIKIŞ JENERİKLERİNİ VE FİRMA AYRIŞTIRMASINI UYGULA
  // ============================================================================
  const finalPlacements = adBreakBuckets.map((b, bIdx) => {
    const orderedAds = finalizeBucketAdsOrder(b, {
      uniquenessRule,
      rotationSeed: varyOrderAcrossBreaks ? (baseDaySeed + bIdx * 11) % 89 : 0
    });
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

  // Gerçekleşen spot sayısını tüm günlerdeki gerçek yerleşim toplamından (`otherDaysCountByResId + finalCountsTodayByResId`)
  // birebir hesapla ki hiçbir zaman sayım kayması olmasın
  const finalCountsTodayByResId = {};
  finalPlacements.forEach(fp => {
    (fp.ads || []).forEach(ad => {
      if (ad?.reservationId && !ad.isBumperAd) {
        finalCountsTodayByResId[ad.reservationId] = (finalCountsTodayByResId[ad.reservationId] || 0) + 1;
      }
    });
  });

  const updatedReservations = state.reservations.map(res => {
    const otherDaysTotal = otherDaysCountByResId[String(res.id)] || 0;
    const nowToday = finalCountsTodayByResId[res.id] || 0;
    const exactRealized = Math.max(0, otherDaysTotal + nowToday);
    const plannedTotal = Math.max(0, Number(res.totalPlannedSpots) || 0);
    const overageSpots = plannedTotal > 0 && exactRealized > plannedTotal ? (exactRealized - plannedTotal) : 0;

    return {
      ...res,
      realizedSpots: exactRealized,
      overageSpots
    };
  });

  const nextAutoFillSettings = {
    ...autoFillCfg,
    variationCounter: nextVariationCounter
  };
  saveAdsAutoFillSettingsBackup(nextAutoFillSettings);

  const nextAdPlacements = {
    ...state.adPlacements,
    [key]: finalPlacements
  };
  saveAdsReservationsBackup(updatedReservations, nextAdPlacements, {
    forceOverwritePlacements: true
  });

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
    reservations: updatedReservations,
    adsAutoFillSettings: nextAutoFillSettings
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
    const autoFillCfg = {
      ...DEFAULT_ADS_AUTO_FILL_SETTINGS,
      ...(state.adsAutoFillSettings || loadAdsAutoFillSettingsBackup() || {})
    };
    const uniquenessRule = autoFillCfg.uniquenessRule || 'same_clip';

    // KURAL 1: Seçili Kuşak İçi Tekrar Önleme Kuralı (`same_clip` | `same_company` | `none`)
    if (
      uniquenessRule === 'same_company' &&
      currentAds.some(a => !a.isBumperAd && String(a.companyId) === String(newAdEntry.companyId))
    ) {
      dialog.warning(
        'Aynı Firma Tekrar Edemez',
        `Otomatik Doldur Ayarlarında "Aynı Firma Giremez" kuralı aktif. Bu kuşakta (${targetBlock.time}) bu firmaya ait bir reklam zaten yer alıyor.`
      );
      return state;
    }

    if (
      uniquenessRule !== 'none' &&
      currentAds.some(a => !a.isBumperAd && String(a.materialId) === String(material.id))
    ) {
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

  saveAdsReservationsBackup(nextReservations, nextAdPlacements, {
    forceOverwritePlacements: true
  });

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

