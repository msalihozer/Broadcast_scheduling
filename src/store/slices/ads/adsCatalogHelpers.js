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
  pushAdsStoreToServer({ adBreakBumperRules: rules });
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

const USER_CHANNEL_LOGO_SETTINGS_STORAGE_KEY = 'yayin_channel_logo_settings_v2';

/**
 * Her kanal (Semerkand HD ve Semerkand WAY) için:
 * - `broadcastLogoName`: Yayına girerken (Program, Canlı Yayın, İntro, Reklam Çıkış vb.) listeye işlenecek logo ismi
 * - `adLogoName`: Reklama girerken (Reklam Giriş jeneriği ve Reklam Kuşağı spotları) listeye işlenecek logo ismi
 * - `bumpers`: Jenerik / Program bazlı özel logo eşleştirme kuralları (Giriş / Çıkış / Özel)
 */
export function buildDefaultChannelLogoSettings() {
  return {
    ch_hd: {
      broadcastLogoName: 'Semerkand_Tv_Logo_Corner',
      adLogoName: 'Semerkand_HD_Reklam_Logo',
      bumpers: [
        { id: 'hd-logo-1', name: 'SEMERKAND_intro_v3_2014', type: 'broadcast_in', logoName: 'Semerkand_Tv_Logo_Corner' },
        { id: 'hd-logo-2', name: 'reklam_dini_giris_2014', type: 'ad_in', logoName: 'Semerkand_HD_Reklam_Logo' },
        { id: 'hd-logo-3', name: 'reklam_dini_cikis_2014', type: 'broadcast_in', logoName: 'Semerkand_Tv_Logo_Corner' },
        { id: 'hd-logo-4', name: 'reklam_bayan_giris_2014', type: 'ad_in', logoName: 'Semerkand_HD_Reklam_Logo' },
        { id: 'hd-logo-5', name: 'reklam_bayan_cikis_2014', type: 'broadcast_in', logoName: 'Semerkand_Tv_Logo_Corner' },
        { id: 'hd-logo-6', name: 'reklam_cocuk_giris_2014', type: 'ad_in', logoName: 'Semerkand_HD_Reklam_Logo' },
        { id: 'hd-logo-7', name: 'reklam_cocuk_cikis_2014', type: 'broadcast_in', logoName: 'Semerkand_Tv_Logo_Corner' },
        { id: 'hd-logo-8', name: 'reklam_kulturel_giris_2014', type: 'ad_in', logoName: 'Semerkand_HD_Reklam_Logo' },
        { id: 'hd-logo-9', name: 'reklam_kulturel_cikis_2014', type: 'broadcast_in', logoName: 'Semerkand_Tv_Logo_Corner' }
      ]
    },
    ch_way: {
      broadcastLogoName: 'Semerkand_Way_Logo_Corner',
      adLogoName: 'Semerkand_WAY_Reklam_Logo',
      bumpers: [
        { id: 'way-logo-1', name: 'SEMERKAND_intro_v3_2014', type: 'broadcast_in', logoName: 'Semerkand_Way_Logo_Corner' },
        { id: 'way-logo-2', name: 'reklam_dini_giris_2014', type: 'ad_in', logoName: 'Semerkand_WAY_Reklam_Logo' },
        { id: 'way-logo-3', name: 'reklam_dini_cikis_2014', type: 'broadcast_in', logoName: 'Semerkand_Way_Logo_Corner' },
        { id: 'way-logo-4', name: 'reklam_bayan_giris_2014', type: 'ad_in', logoName: 'Semerkand_WAY_Reklam_Logo' },
        { id: 'way-logo-5', name: 'reklam_bayan_cikis_2014', type: 'broadcast_in', logoName: 'Semerkand_Way_Logo_Corner' },
        { id: 'way-logo-6', name: 'reklam_cocuk_giris_2014', type: 'ad_in', logoName: 'Semerkand_WAY_Reklam_Logo' },
        { id: 'way-logo-7', name: 'reklam_cocuk_cikis_2014', type: 'broadcast_in', logoName: 'Semerkand_Way_Logo_Corner' },
        { id: 'way-logo-8', name: 'reklam_kulturel_giris_2014', type: 'ad_in', logoName: 'Semerkand_WAY_Reklam_Logo' },
        { id: 'way-logo-9', name: 'reklam_kulturel_cikis_2014', type: 'broadcast_in', logoName: 'Semerkand_Way_Logo_Corner' }
      ]
    }
  };
}

export const DEFAULT_CHANNEL_LOGO_SETTINGS = buildDefaultChannelLogoSettings();

export function saveChannelLogoSettingsBackup(adSettings) {
  try {
    if (typeof window !== 'undefined' && window.localStorage && adSettings && typeof adSettings === 'object') {
      window.localStorage.setItem(USER_CHANNEL_LOGO_SETTINGS_STORAGE_KEY, JSON.stringify(adSettings));
    }
  } catch (e) {}
  pushAdsStoreToServer({ adSettings });
}

export function loadChannelLogoSettingsBackup() {
  const defaults = buildDefaultChannelLogoSettings();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(USER_CHANNEL_LOGO_SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const result = {};
          ['ch_hd', 'ch_way'].forEach(chId => {
            const chSrc = parsed[chId] || {};
            const chDef = defaults[chId];
            result[chId] = {
              broadcastLogoName:
                chSrc.broadcastLogoName !== undefined ? String(chSrc.broadcastLogoName) : chDef.broadcastLogoName,
              adLogoName:
                chSrc.adLogoName !== undefined ? String(chSrc.adLogoName) : chDef.adLogoName,
              bumpers:
                Array.isArray(chSrc.bumpers) && chSrc.bumpers.length > 0
                  ? chSrc.bumpers
                  : chDef.bumpers
            };
          });
          return result;
        }
      }
    }
  } catch (e) {}
  return defaults;
}

/**
 * Yayın Liste Kontrol aşamasında her bir yayın/reklam satırı (`prog`) için
 * kanalın Logo Ayarlarına (`adSettings[channelId]`) göre hangi logonun gireceğini çözümler:
 * 1) Satıra özel tanımlı Jenerik / Program kuralı (`bumpers`) varsa onun `logoName` değerini döndürür.
 * 2) Reklam Çıkış jeneriği (`bumperType === 'outro'` veya `_cikis`) ise yayına geri dönüldüğü için `broadcastLogoName` (Yayına Girerken Logo) döndürür.
 * 3) Reklam Giriş jeneriği (`bumperType === 'intro'` veya `_giris`) veya Reklam Kuşağı spotu (`isAdClip` / `isFromAds`) ise `adLogoName` (Reklama Girerken Logo) döndürür.
 * 4) Normal Program, Canlı Yayın, İntro ve Dolgu klipleri için `broadcastLogoName` (Yayına Girerken Logo) döndürür.
 */
export function resolveProgramLogoForChannel(prog, channelId = 'ch_hd', adSettings = null) {
  if (!prog) return '';
  if (prog.isManualLogo && prog.logo) return prog.logo;

  const settingsPool = adSettings || DEFAULT_CHANNEL_LOGO_SETTINGS;
  const chSettings = settingsPool?.[channelId] || DEFAULT_CHANNEL_LOGO_SETTINGS[channelId] || DEFAULT_CHANNEL_LOGO_SETTINGS.ch_hd;

  const broadcastLogo = String(chSettings?.broadcastLogoName ?? '').trim();
  const adLogo = String(chSettings?.adLogoName ?? '').trim();
  const bumpers = Array.isArray(chSettings?.bumpers) ? chSettings.bumpers : [];

  const rawTitle = String(prog.title || prog.clipName || prog.name || '').replace(/\.(mxf|mp4|mov)$/i, '').trim();
  const titleLower = rawTitle.toLocaleLowerCase('tr-TR');

  // 1. Özel tanımlı jenerik/program logo eşleşmesi kontrolü
  if (titleLower && bumpers.length > 0) {
    const matchedBumper = bumpers.find(
      b => b && b.name && String(b.name).trim() && titleLower.includes(String(b.name).trim().toLocaleLowerCase('tr-TR'))
    );
    if (matchedBumper && matchedBumper.logoName && String(matchedBumper.logoName).trim()) {
      return String(matchedBumper.logoName).trim();
    }
  }

  // 2. Reklam Çıkış Jeneriği -> Yayına girerken girecek logo
  const isOutroBumper =
    (prog.isBumperAd && prog.bumperType === 'outro') ||
    /reklam_.*_cikis/i.test(rawTitle);
  if (isOutroBumper) {
    return broadcastLogo;
  }

  // 3. Reklam Giriş Jeneriği veya Reklam Spotu -> Reklama girerken girecek logo
  const isAdOrIntroBumper =
    (prog.isBumperAd && prog.bumperType === 'intro') ||
    /reklam_.*_giris/i.test(rawTitle) ||
    Boolean(prog.isAdClip || prog.isFromAds) ||
    String(prog.id || '').toUpperCase() === 'TPL-3' ||
    prog.type === 'ad_break';

  if (isAdOrIntroBumper) {
    return adLogo;
  }

  // 4. Yayın / Program / İntro / Canlı Yayın -> Yayına girerken girecek logo
  return broadcastLogo;
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

const USER_ADS_PRICING_CONFIG_STORAGE_KEY = 'yayin_ads_pricing_config_v2';
const USER_DELETED_RESERVATIONS_STORAGE_KEY = 'yayin_ads_deleted_reservation_ids_v1';

export const DEFAULT_ADS_PRICING_CONFIG = {
  defaultSpotPrice: 0,
  defaultPerSecondPrice: 0,
  sponsorSpotPrice: 0,
  channelRates: {
    ch_hd: 0,
    ch_way: 0
  },
  timeBlockRates: {
    'Sabah Kuşağı': 0,
    'Öğle Kuşağı': 0,
    'Akşam (Prime Time)': 0,
    'Gece Kuşağı': 0
  }
};

export function loadAdsPricingConfigBackup() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(USER_ADS_PRICING_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            ...DEFAULT_ADS_PRICING_CONFIG,
            ...parsed,
            channelRates: { ...DEFAULT_ADS_PRICING_CONFIG.channelRates, ...(parsed.channelRates || {}) },
            timeBlockRates: { ...DEFAULT_ADS_PRICING_CONFIG.timeBlockRates, ...(parsed.timeBlockRates || {}) }
          };
        }
      }
    }
  } catch (e) {}
  return { ...DEFAULT_ADS_PRICING_CONFIG };
}

export function saveAdsPricingConfigBackup(config) {
  try {
    if (typeof window !== 'undefined' && window.localStorage && config && typeof config === 'object') {
      window.localStorage.setItem(USER_ADS_PRICING_CONFIG_STORAGE_KEY, JSON.stringify(config));
    }
  } catch (e) {}
  pushAdsStoreToServer({ adsPricingConfig: config });
}

export function loadDeletedReservationIdsBackup() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(USER_DELETED_RESERVATIONS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(String);
      }
    }
  } catch (e) {}
  return [];
}

export function recordDeletedReservationIdBackup(deletedId) {
  try {
    if (typeof window !== 'undefined' && window.localStorage && deletedId) {
      const existing = loadDeletedReservationIdsBackup();
      const next = Array.from(new Set([...existing, String(deletedId)])).slice(-500);
      window.localStorage.setItem(USER_DELETED_RESERVATIONS_STORAGE_KEY, JSON.stringify(next));
      return next;
    }
  } catch (e) {}
  return [];
}

/**
 * Tarayıcıdaki Reklam Rezervasyon, Yerleşim, Giriş/Çıkış Kuralları, Logo ve Fiyatlandırma verilerini
 * arka planda sunucu veritabanına (`POST /api/ads-store`) kaydeder.
 * Bu sayede .80 IP adresi veya seyare.semerkand.com üzerinden bağlanıldığında veriler ortak veritabanında tutulur.
 */
export async function pushAdsStoreToServer(partialPayload = {}) {
  try {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return null;
    const res = await fetch('/api/ads-store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partialPayload)
    });
    if (res.ok) {
      const data = await res.json();
      return data?.store || null;
    }
  } catch (_) {}
  return null;
}

export function writeAdsReservationsLocalCacheOnly(reservations, adPlacements) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (Array.isArray(reservations)) {
        window.localStorage.setItem(USER_RESERVATIONS_STORAGE_KEY, JSON.stringify(reservations));
      }
      if (adPlacements && typeof adPlacements === 'object') {
        window.localStorage.setItem(USER_PLACEMENTS_STORAGE_KEY, JSON.stringify(adPlacements));
      }
    }
  } catch (_) {}
}

/**
 * Kullanıcının oluşturduğu rezervasyonları ve kuşak yerleşimlerini hem `localStorage`'a
 * hem de sunucu veritabanına (`/api/ads-store`) yedekler.
 *
 * @param {Array} reservations - Kayıtlı rezervasyon listesi
 * @param {Object} adPlacements - Gün bazlı reklam kuşağı yerleşim haritası
 * @param {Object} [extraOptions] - Silinen ID veya tam üzerine yazma seçenekleri
 */
export function saveAdsReservationsBackup(reservations, adPlacements, extraOptions = {}) {
  writeAdsReservationsLocalCacheOnly(reservations, adPlacements);

  const deletedReservationIds = loadDeletedReservationIdsBackup();
  pushAdsStoreToServer({
    ...(Array.isArray(reservations) ? { reservations } : {}),
    ...(adPlacements && typeof adPlacements === 'object' ? { adPlacements } : {}),
    deletedReservationIds,
    ...extraOptions
  });
}

/**
 * `localStorage`'da kayıtlı tüm olası anahtarlardaki (`yayin_ads_reservations_v1`,
 * `yayin-planlama-storage`, `yayin_ads_reservations_backup_v4`) rezervasyonları ve reklam yerleşimlerini
 * birleştirerek yükler. Hiçbir yerel verinin gözden kaçmamasını garanti eder.
 */
export function loadAdsReservationsBackup() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const deletedSet = new Set(loadDeletedReservationIdsBackup());
      const resMap = new Map();
      let foundAnyResSource = false;

      const collectReservations = list => {
        if (!Array.isArray(list)) return;
        foundAnyResSource = true;
        list.forEach(r => {
          if (
            r &&
            r.id &&
            !String(r.id).startsWith('res-auto-') &&
            !deletedSet.has(String(r.id))
          ) {
            resMap.set(String(r.id), r);
          }
        });
      };

      // 1. Ana yedek anahtarı (yayin_ads_reservations_v1)
      try {
        const rawV1 = window.localStorage.getItem(USER_RESERVATIONS_STORAGE_KEY);
        if (rawV1 !== null) collectReservations(JSON.parse(rawV1));
      } catch (_) {}

      // 2. V4 yedek anahtarı (yayin_ads_reservations_backup_v4)
      try {
        const rawV4 = window.localStorage.getItem('yayin_ads_reservations_backup_v4');
        if (rawV4 !== null) collectReservations(JSON.parse(rawV4));
      } catch (_) {}

      // 3. Zustand ana persist deposu (yayin-planlama-storage)
      let zustandState = null;
      try {
        const rawZustand = window.localStorage.getItem('yayin-planlama-storage');
        if (rawZustand) {
          const parsedZ = JSON.parse(rawZustand);
          zustandState = parsedZ?.state || parsedZ || null;
          if (Array.isArray(zustandState?.reservations)) {
            collectReservations(zustandState.reservations);
          }
        }
      } catch (_) {}

      const mergedPlacements = {};
      let foundAnyPlaceSource = false;

      const collectPlacements = placeObj => {
        if (!placeObj || typeof placeObj !== 'object') return;
        foundAnyPlaceSource = true;
        Object.entries(placeObj).forEach(([dayKey, blocks]) => {
          if (!Array.isArray(blocks)) return;
          const cleanedBlocks = blocks
            .map(b => ({
              ...b,
              ads: (b.ads || []).filter(ad => ad && !String(ad.reservationId).startsWith('res-auto-'))
            }))
            .filter(b => Array.isArray(b.ads) && b.ads.length > 0);
          if (cleanedBlocks.length > 0) {
            mergedPlacements[dayKey] = cleanedBlocks;
          }
        });
      };

      if (zustandState?.adPlacements) {
        collectPlacements(zustandState.adPlacements);
      }
      try {
        const rawPV4 = window.localStorage.getItem('yayin_ads_placements_backup_v4');
        if (rawPV4 !== null) collectPlacements(JSON.parse(rawPV4));
      } catch (_) {}
      try {
        const rawPV1 = window.localStorage.getItem(USER_PLACEMENTS_STORAGE_KEY);
        if (rawPV1 !== null) collectPlacements(JSON.parse(rawPV1));
      } catch (_) {}

      const reservations = foundAnyResSource ? Array.from(resMap.values()) : null;
      const adPlacements = foundAnyPlaceSource ? mergedPlacements : null;

      return {
        reservations,
        adPlacements
      };
    }
  } catch (e) {}
  return { reservations: null, adPlacements: null };
}

