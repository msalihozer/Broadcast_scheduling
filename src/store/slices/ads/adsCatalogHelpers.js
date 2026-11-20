/**
 * @file src/store/slices/ads/adsCatalogHelpers.js
 * @description Reklam Modülü (Ads Slice) Katalog, Tarih, Varsayılan Kuşaklar ve LocalStorage Yedekleme Yardımcıları.
 *
 * Bu modül aşağıdaki görevleri üstlenir:
 * 1. Tarih Hesaplamaları (`getMondayOfWeekStr`, `addDaysLocalStr`): Haftalık reklam planlamasında Pazartesi-Pazar
 *    tarih aralıklarını yerel saat dilimine göre hesaplar.
 * 2. Başlangıç Kataloğu (`initialSyncedCatalog`): `adsData.json` ve `adsMedia.json` verilerini birleştirerek
 *    Firmalar (`companies`), Ürünler (`products`) ve Materyalleri (`materials`) senkronize eder.
 * 3. Varsayılan Yayın Kuşakları (`DEFAULT_TIME_BLOCKS`): Sabah, Öğle, Akşam (Prime Time) ve Gece kuşaklarını tanımlar.
 * 4. LocalStorage Yedekleme (`saveAdsReservationsBackup`, `loadAdsReservationsBackup`): Kullanıcının oluşturduğu
 *    reklam rezervasyonlarını ve kuşak yerleşimlerini (`adPlacements`) tarayıcı belleğinde kalıcı olarak saklar.
 */
import adsData from '../../../data/adsData.json';
import adsMedia from '../../../data/adsMedia.json';
import { buildAutoSyncedAdsCatalog, normalizeAdDurationSeconds } from '../../../modules/ads/utils/adsAutoSyncEngine';

export { buildAutoSyncedAdsCatalog, normalizeAdDurationSeconds };

export const ADS_CATALOG_VERSION = 8;

const USER_RESERVATIONS_STORAGE_KEY = 'yayin_ads_reservations_v1';
const USER_PLACEMENTS_STORAGE_KEY = 'yayin_ads_placements_v1';
const USER_BUMPER_RULES_STORAGE_KEY = 'yayin_ads_bumper_rules_v1';

/**
 * Kanal ve Kategori Bazlı Varsayılan Reklam Giriş / Çıkış Jenerik Kuralları.
 * Bir kural birden fazla kategoriye (`categories: ['Dini', ...]`) bağlanabilir ve her kanal (`ch_hd`, `ch_way`) için ayrı tanımlanabilir.
 */
export function buildDefaultAdBreakBumperRules() {
  const baseTemplates = [
    {
      key: 'dini',
      ruleName: 'Dini Programlar Reklam Giriş & Çıkışı',
      categories: ['Dini'],
      categoryIds: [4],
      introClip: {
        clipId: '3538',
        name: 'reklam_dini_giris_2014',
        code: '42N6CUHF.mxf',
        durationSec: 9,
        durationMs: 9040
      },
      outroClip: {
        clipId: '3537',
        name: 'reklam_dini_cikis_2014',
        code: '42N6CUIL.mxf',
        durationSec: 9,
        durationMs: 9040
      }
    },
    {
      key: 'kadin',
      ruleName: 'Kadın & Aile Programları Reklam Giriş & Çıkışı',
      categories: ['Kadın'],
      categoryIds: [1],
      introClip: {
        clipId: '3534',
        name: 'reklam_bayan_giris_2014',
        code: '42N6CUAK.mxf',
        durationSec: 9,
        durationMs: 9040
      },
      outroClip: {
        clipId: '3533',
        name: 'reklam_bayan_cikis_2014',
        code: '42N6CUCG.mxf',
        durationSec: 9,
        durationMs: 9040
      }
    },
    {
      key: 'cocuk',
      ruleName: 'Çocuk & Gençlik Programları Reklam Giriş & Çıkışı',
      categories: ['Çocuk'],
      categoryIds: [5],
      introClip: {
        clipId: '3536',
        name: 'reklam_cocuk_giris_2014',
        code: '42N6CU34.mxf',
        durationSec: 9,
        durationMs: 9040
      },
      outroClip: {
        clipId: '3535',
        name: 'reklam_cocuk_cikis_2014',
        code: '42N6CU62.mxf',
        durationSec: 9,
        durationMs: 9040
      }
    },
    {
      key: 'kulturel_genel',
      ruleName: 'Kültürel, Haber, Detay ve Kısa Programlar Reklam Giriş & Çıkışı',
      categories: ['Kültürel', 'Haber', 'Tanıtım', 'Detay', 'Kısa Program'],
      categoryIds: [8, 2, 3, 9, 10],
      liveProgramNames: [],
      isChannelDefault: false,
      introClip: {
        clipId: '3540',
        name: 'reklam_kulturel_giris_2014',
        code: '42N6CU52.mxf',
        durationSec: 9,
        durationMs: 9040
      },
      outroClip: {
        clipId: '3539',
        name: 'reklam_kulturel_cikis_2014',
        code: '42N6CU1L.mxf',
        durationSec: 9,
        durationMs: 9040
      }
    },
    {
      key: 'live_default_fallback',
      ruleName: 'Canlı Yayın & Kategorisiz Programlar Varsayılan (Default) Giriş & Çıkışı',
      categories: ['Canlı Yayın (Varsayılan)'],
      categoryIds: [],
      liveProgramNames: [],
      isChannelDefault: true,
      introClip: {
        clipId: '3540',
        name: 'reklam_kulturel_giris_2014',
        code: '42N6CU52.mxf',
        durationSec: 9,
        durationMs: 9040
      },
      outroClip: {
        clipId: '3539',
        name: 'reklam_kulturel_cikis_2014',
        code: '42N6CU1L.mxf',
        durationSec: 9,
        durationMs: 9040
      }
    }
  ];

  const channels = ['ch_hd', 'ch_way'];
  const rules = [];
  channels.forEach(chId => {
    baseTemplates.forEach(tpl => {
      rules.push({
        id: `bumper-${chId}-${tpl.key}`,
        channelId: chId,
        ruleName: tpl.ruleName,
        categories: [...(tpl.categories || [])],
        categoryIds: [...(tpl.categoryIds || [])],
        liveProgramNames: [...(tpl.liveProgramNames || [])],
        isChannelDefault: Boolean(tpl.isChannelDefault),
        introClip: { ...tpl.introClip },
        outroClip: { ...tpl.outroClip },
        isActive: true,
        updatedAt: new Date().toISOString()
      });
    });
  });

  return rules;
}

export const DEFAULT_AD_BREAK_BUMPER_RULES = buildDefaultAdBreakBumperRules();

/**
 * `adsMedia.json` içindeki tüm `reklam_*_giris*` ve `reklam_*_cikis*` jenerik kliplerini döndürür.
 */
export function getBumperJingleClipsFromAdsMedia() {
  return (adsMedia || [])
    .filter(item => {
      const n = String(item?.name || '').toLowerCase();
      return (
        n.includes('giris') ||
        n.includes('giriş') ||
        n.includes('cikis') ||
        n.includes('çıkış') ||
        n.includes('jenerik') ||
        /^reklam_/i.test(n)
      );
    })
    .map(item => {
      const durMs = Number(item.duration) > 600 ? Number(item.duration) : (Number(item.duration) || 9) * 1000;
      const durSec = Math.max(1, Math.round(durMs / 1000));
      return {
        id: String(item.id),
        clipId: String(item.id),
        name: item.name,
        clipName: item.name,
        code: item.code || `${item.id}.mxf`,
        duration: durSec,
        durationSec: durSec,
        durationMs: durMs,
        categoryName: 'Reklam Jeneriği (Giriş / Çıkış)',
        companyName: 'SEMERKAND TV JENERİK',
        productName: 'Reklam Giriş / Çıkış Jeneriği',
        isBumperJingle: true
      };
    });
}

export function saveAdBreakBumperRulesBackup(rules) {
  try {
    if (typeof window !== 'undefined' && window.localStorage && Array.isArray(rules)) {
      window.localStorage.setItem(USER_BUMPER_RULES_STORAGE_KEY, JSON.stringify(rules));
    }
  } catch (e) {}
}

export function loadAdBreakBumperRulesBackup() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(USER_BUMPER_RULES_STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const defaults = buildDefaultAdBreakBumperRules();
          const next = parsed.map(r => ({
            ...r,
            liveProgramNames: Array.isArray(r.liveProgramNames) ? r.liveProgramNames : [],
            isChannelDefault: Boolean(r.isChannelDefault)
          }));
          // Her kanal için en az 1 adet Varsayılan (Default) Canlı Yayın & Kategorisiz kuralı bulunmasını garanti et
          ['ch_hd', 'ch_way'].forEach(chId => {
            const hasDefaultForChannel = next.some(
              r => String(r.channelId) === chId && Boolean(r.isChannelDefault)
            );
            if (!hasDefaultForChannel) {
              const defRule = defaults.find(
                d => String(d.channelId) === chId && Boolean(d.isChannelDefault)
              );
              if (defRule) next.push(defRule);
            }
          });
          return next;
        }
      }
    }
  } catch (e) {}
  return null;
}

/**
 * Verilen tarih dizgesinin (`YYYY-MM-DD`) içinde bulunduğu haftanın
 * Pazartesi (`Monday`) gününü yerel saat dilimine göre `YYYY-MM-DD` olarak döndürür.
 *
 * @param {string} [baseDateStr] - Baz alınacak tarih (`YYYY-MM-DD`). Boş ise bugünün tarihi kullanılır.
 * @returns {string} Pazartesi gününün `YYYY-MM-DD` formatındaki tarihi.
 */
export function getMondayOfWeekStr(baseDateStr) {
  let d;
  if (baseDateStr && /^\d{4}-\d{2}-\d{2}$/.test(baseDateStr)) {
    const [y, m, day] = baseDateStr.split('-').map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date();
  }
  const dayOfWeek = d.getDay(); // 0: Pazar, 1: Pazartesi ... 6: Cumartesi
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setDate(d.getDate() + diffToMonday);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Verilen `YYYY-MM-DD` tarihine belirtilen gün sayısını (`offsetDays`) ekleyerek
 * yeni tarihi yerel saat diliminde `YYYY-MM-DD` olarak döndürür.
 *
 * @param {string} baseDateStr - Başlangıç tarihi (`YYYY-MM-DD`)
 * @param {number} offsetDays - Eklenecek/çıkarılacak gün sayısı
 * @returns {string} Hesaplanan `YYYY-MM-DD` tarihi
 */
export function addDaysLocalStr(baseDateStr, offsetDays) {
  const [y, m, day] = baseDateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() + offsetDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Başlangıçta `adsData.json` ve `adsMedia.json` kaynaklarını birleştirerek
 * Firmalar, Ürünler ve Materyalleri otomatik olarak senkronize eder.
 */
export const initialSyncedCatalog = buildAutoSyncedAdsCatalog({
  baseCompanies: adsData.companies || [],
  baseProducts: adsData.products || [],
  baseMaterials: adsData.materials || [],
  adsMediaList: adsMedia || [],
  remoteArchiveAds: []
});

/**
 * Sistem genelinde kullanılan varsayılan reklam yayın kuşakları (TimeBlocks).
 */
export const DEFAULT_TIME_BLOCKS = [
  { id: 'tb-1', name: 'Sabah Kuşağı', startTime: '06:00', endTime: '12:00', days: [1, 2, 3, 4, 5, 6, 0], isActive: true },
  { id: 'tb-2', name: 'Öğle Kuşağı', startTime: '12:00', endTime: '18:00', days: [1, 2, 3, 4, 5, 6, 0], isActive: true },
  { id: 'tb-3', name: 'Akşam (Prime Time)', startTime: '18:00', endTime: '24:00', days: [1, 2, 3, 4, 5, 6, 0], isActive: true },
  { id: 'tb-4', name: 'Gece Kuşağı', startTime: '00:00', endTime: '06:00', days: [1, 2, 3, 4, 5, 6, 0], isActive: true }
];

/**
 * Varsayılan/örnek rezervasyon veya yerleşim üretmez; tamamen boş başlatır.
 */
export function buildInitialReservationsAndPlacements() {
  return {
    reservations: [],
    adPlacements: {}
  };
}

/**
 * Kullanıcının oluşturduğu rezervasyonları ve kuşak yerleşimlerini `localStorage`'a yedekler.
 *
 * @param {Array} reservations - Kayıtlı rezervasyon listesi
 * @param {Object} adPlacements - Gün bazlı reklam kuşağı yerleşim haritası
 */
export function saveAdsReservationsBackup(reservations, adPlacements) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (Array.isArray(reservations)) {
        window.localStorage.setItem(USER_RESERVATIONS_STORAGE_KEY, JSON.stringify(reservations));
      }
      if (adPlacements && typeof adPlacements === 'object') {
        window.localStorage.setItem(USER_PLACEMENTS_STORAGE_KEY, JSON.stringify(adPlacements));
      }
    }
  } catch (e) {
    // ignore storage quota errors
  }
}

/**
 * `localStorage`'da kayıtlı rezervasyonları ve reklam yerleşimlerini yükler.
 * Eski otomatik üretilmiş (`res-auto-*`) kayıtlar varsa temizler.
 */
export function loadAdsReservationsBackup() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const rawRes = window.localStorage.getItem(USER_RESERVATIONS_STORAGE_KEY);
      const rawPlace = window.localStorage.getItem(USER_PLACEMENTS_STORAGE_KEY);
      const parsedRes = rawRes !== null ? JSON.parse(rawRes) : null;
      const parsedPlace = rawPlace !== null ? JSON.parse(rawPlace) : null;

      // Eski otomatik üretilmiş varsayılan (res-auto-*) kayıtları tamamen filtrele
      const reservations = Array.isArray(parsedRes)
        ? parsedRes.filter(r => r && !String(r.id).startsWith('res-auto-'))
        : null;

      let adPlacements = null;
      if (parsedPlace && typeof parsedPlace === 'object') {
        adPlacements = {};
        Object.entries(parsedPlace).forEach(([dayKey, blocks]) => {
          const cleanedBlocks = (blocks || [])
            .map(b => ({
              ...b,
              ads: (b.ads || []).filter(ad => ad && !String(ad.reservationId).startsWith('res-auto-'))
            }))
            .filter(b => Array.isArray(b.ads) && b.ads.length > 0);
          if (cleanedBlocks.length > 0) {
            adPlacements[dayKey] = cleanedBlocks;
          }
        });
      }

      return {
        reservations,
        adPlacements
      };
    }
  } catch (e) {}
  return { reservations: null, adPlacements: null };
}

