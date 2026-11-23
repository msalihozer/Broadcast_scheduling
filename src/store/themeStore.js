/**
 * @file src/store/themeStore.js
 * @description Semerkand TV Kurumsal Kimlik 2026 & Yayın Planlama Merkezi Tema Deposu.
 * Kaynak: 05_Tema/tema_kurumsal_2026.json ve 03_Tasarim_Tokenlari/tokens.json
 */
import { create } from 'zustand';

const THEME_STORAGE_KEY = 'yayin_custom_theme_config_v3_kurumsal2026';

export const FONT_SANS_OPTIONS = [
  {
    id: 'custom_sans_1795439548991',
    label: 'Roboto (Kurumsal 2026) (Özel Yazı Fontu)',
    value: "'Roboto', 'Segoe UI', Arial, sans-serif"
  },
  {
    id: 'roboto',
    label: 'Roboto (Kurumsal Varsayılan)',
    value: "'Roboto', 'Segoe UI', Arial, sans-serif"
  },
  {
    id: 'system',
    label: 'Sistem Fontu (Segoe UI / Arial)',
    value: "'Segoe UI', Roboto, Arial, sans-serif"
  }
];

export const FONT_MONO_OPTIONS = [
  {
    id: 'custom_mono_1795439566952',
    label: 'Roboto Mono (Kurumsal 2026) (Özel Saat & Timecode Fontu)',
    value: "'Roboto Mono', Consolas, monospace"
  },
  {
    id: 'robotomono',
    label: 'Roboto Mono (Kurumsal Saat & Timecode)',
    value: "'Roboto Mono', Consolas, monospace"
  },
  {
    id: 'consolas',
    label: 'Consolas / Klasik Monospace',
    value: "Consolas, 'Courier New', monospace"
  }
];

export const BOX_RADIUS_OPTIONS = [
  { id: '4px', label: 'Keskin (4px - Kurumsal Varsayılan)', value: '4px' },
  { id: '6px', label: 'Panel (6px)', value: '6px' },
  { id: '8px', label: 'Yumuşak (8px)', value: '8px' },
  { id: '12px', label: 'Yuvarlak (12px)', value: '12px' }
];

export const BOX_SIZE_OPTIONS = [
  { id: 'compact', label: 'Kompakt', padding: '4px 6px', rowHeight: 46, scale: 0.94 },
  { id: 'standard', label: 'Standart', padding: '6px 8px', rowHeight: 54, scale: 1.0 },
  { id: 'comfortable', label: 'Ferah', padding: '9px 12px', rowHeight: 64, scale: 1.05 },
  { id: 'large', label: 'Stüdyo Büyük', padding: '12px 14px', rowHeight: 74, scale: 1.12 }
];

export const BOX_SHADOW_OPTIONS = [
  { id: 'none', label: 'Gölgesiz', value: 'none', hoverValue: 'none' },
  { id: 'subtle', label: 'Hafif Kurumsal Gölge', value: '0 1px 0 rgba(10, 16, 29, 0.04)', hoverValue: '0 2px 6px rgba(10, 16, 29, 0.08)' },
  { id: 'medium', label: 'Orta Kart Gölgesi', value: '0 3px 8px -1px rgba(10, 16, 29, 0.08)', hoverValue: '0 6px 14px -2px rgba(10, 16, 29, 0.14)' },
  { id: 'deep', label: 'Derin Stüdyo Gölgesi', value: '0 6px 16px -2px rgba(10, 16, 29, 0.14)', hoverValue: '0 12px 24px -4px rgba(10, 16, 29, 0.22)' }
];

export const DEFAULT_MODULE_BOX_STYLE = {
  boxRadius: '4px',
  boxSize: 'standard',
  cardPadding: '6px 8px',
  rowHeight: 54,
  borderWidth: 1,
  leftAccentWidth: 5,
  boxShadow: 'none',
  cardTintOpacity: 12,
  useCategoryTitleColor: true
};

export const DEFAULT_THEME_CONFIG = {
  typography: {
    fontSansId: 'custom_sans_1795439548991',
    fontSans: "'Roboto', 'Segoe UI', Arial, sans-serif",
    fontMonoId: 'custom_mono_1795439566952',
    fontMono: "'Roboto Mono', Consolas, monospace",
    fontScale: 100,
    timecodeScale: 100,
    customSansFonts: [
      {
        id: 'custom_sans_1795439548991',
        label: 'Roboto (Kurumsal 2026) (Özel Yazı Fontu)',
        value: "'Roboto', 'Segoe UI', Arial, sans-serif",
        googleFontUrl: '/fonts/fonts.css',
        isCustom: true
      }
    ],
    customMonoFonts: [
      {
        id: 'custom_mono_1795439566952',
        label: 'Roboto Mono (Kurumsal 2026) (Özel Saat & Timecode Fontu)',
        value: "'Roboto Mono', Consolas, monospace",
        googleFontUrl: '/fonts/fonts.css',
        isCustom: true
      }
    ]
  },

  categoryColors: {
    1:  { id: 1,  name: 'Kadın',                color: '#c56d3b', titleTextColor: '#94522c', badgeTextColor: '#94522c', badge: 'Kadın' },
    2:  { id: 2,  name: 'Haber',                color: '#142a44', titleTextColor: '#142a44', badgeTextColor: '#142a44', badge: 'Haber' },
    3:  { id: 3,  name: 'Tanıtım',              color: '#0c617c', titleTextColor: '#0c617c', badgeTextColor: '#0c617c', badge: 'Tanıtım' },
    4:  { id: 4,  name: 'Dini / İlim',          color: '#468625', titleTextColor: '#3c721f', badgeTextColor: '#3c721f', badge: 'Dini' },
    5:  { id: 5,  name: 'Çocuk / Gençlik',      color: '#70ac42', titleTextColor: '#49702b', badgeTextColor: '#49702b', badge: 'Çocuk' },
    6:  { id: 6,  name: 'Reklam',               color: '#e8b44c', titleTextColor: '#80632a', badgeTextColor: '#80632a', badge: 'Reklam' },
    7:  { id: 7,  name: 'Jenerik / İntro',      color: '#0a101d', titleTextColor: '#0a101d', badgeTextColor: '#0a101d', badge: 'Jenerik' },
    8:  { id: 8,  name: 'Kültürel / Tarih',     color: '#ed891e', titleTextColor: '#9a5914', badgeTextColor: '#9a5914', badge: 'Kültür' },
    9:  { id: 9,  name: 'Sohbet / Detay',       color: '#058193', titleTextColor: '#046e7d', badgeTextColor: '#046e7d', badge: 'Sohbet' },
    10: { id: 10, name: 'Kısa Program / Dolgu', color: '#109aad', titleTextColor: '#0b6c79', badgeTextColor: '#0b6c79', badge: 'Kısa' },
    11: { id: 11, name: 'Ham',                  color: '#5b5f66', titleTextColor: '#5b5f66', badgeTextColor: '#5b5f66', badge: 'Ham' }
  },

  dayColors: {
    Pazartesi: { line: '#9cc3cf', border: '#9cc3cf', timeBg: '#e7f0f3', headerBg: '#f3f8fa', subHeaderBg: '#e7f0f3', textAccent: '#0c617c' },
    Salı:      { line: '#9cc3cf', border: '#9cc3cf', timeBg: '#e7f0f3', headerBg: '#f3f8fa', subHeaderBg: '#e7f0f3', textAccent: '#0c617c' },
    Çarşamba:  { line: '#9cc3cf', border: '#9cc3cf', timeBg: '#e7f0f3', headerBg: '#f3f8fa', subHeaderBg: '#e7f0f3', textAccent: '#0c617c' },
    Perşembe:  { line: '#9cc3cf', border: '#9cc3cf', timeBg: '#e7f0f3', headerBg: '#f3f8fa', subHeaderBg: '#e7f0f3', textAccent: '#0c617c' },
    Cuma:      { line: '#9cc3cf', border: '#9cc3cf', timeBg: '#e7f0f3', headerBg: '#f3f8fa', subHeaderBg: '#e7f0f3', textAccent: '#0c617c' },
    Cumartesi: { line: '#9cc3cf', border: '#9cc3cf', timeBg: '#e7f0f3', headerBg: '#f3f8fa', subHeaderBg: '#e7f0f3', textAccent: '#0c617c' },
    Pazar:     { line: '#9cc3cf', border: '#9cc3cf', timeBg: '#e7f0f3', headerBg: '#f3f8fa', subHeaderBg: '#e7f0f3', textAccent: '#0c617c' }
  },

  periodColors: {
    night: {
      id: 'night',
      label: 'Gece Yayın Kuşağı',
      shortLabel: 'Gece',
      range: '00:00 - 06:00',
      icon: 'gece',
      color: '#0b2b54',
      bg: 'rgba(11, 43, 84, 0.08)'
    },
    morning: {
      id: 'morning',
      label: 'Sabah Yayın Kuşağı',
      shortLabel: 'Sabah',
      range: '06:00 - 12:00',
      icon: 'sabah',
      color: '#e8b44c',
      bg: 'rgba(232, 180, 76, 0.08)'
    },
    day: {
      id: 'day',
      label: 'Gündüz Yayın Kuşağı',
      shortLabel: 'Öğle',
      range: '12:00 - 18:00',
      icon: 'gunduz',
      color: '#109aad',
      bg: 'rgba(16, 154, 173, 0.08)'
    },
    evening: {
      id: 'evening',
      label: 'Akşam & Prime-Time Kuşağı',
      shortLabel: 'Akşam',
      range: '18:00 - 24:00',
      icon: 'aksam',
      color: '#0c617c',
      bg: 'rgba(12, 97, 124, 0.08)'
    }
  },

  specialColors: {
    adBreakColor: '#e8b44c',
    adBreakEmptyColor: '#ed891e',
    adBreakFilledColor: '#037181',
    adBreakBg: '#fcf6e9',
    fillerSlotColor: '#109aad',
    liveColor: '#dd1c40',
    introColor: '#0a101d',
    clipColor: '#037181'
  },

  modules: {
    draft: {
      id: 'draft',
      label: '1. Taslak Planlama',
      accentColor: '#0c617c',
      moduleColor: '#0c617c',
      fontSansId: 'custom_sans_1795439548991',
      fontMonoId: 'custom_mono_1795439566952',
      fontScale: 100,
      timecodeScale: 100,
      ...DEFAULT_MODULE_BOX_STYLE,
      dayLineWidth: 1,
      showColoredTimeColumn: true
    },
    ready: {
      id: 'ready',
      label: '2. Yayına Hazır',
      accentColor: '#0c617c',
      moduleColor: '#468625',
      fontSansId: 'custom_sans_1795439548991',
      fontMonoId: 'custom_mono_1795439566952',
      fontScale: 100,
      timecodeScale: 100,
      ...DEFAULT_MODULE_BOX_STYLE,
      adBreakColor: '#e8b44c',
      fillerColor: '#109aad',
      liveColor: '#dd1c40',
      showPeriodHeaders: true
    },
    ads: {
      id: 'ads',
      label: '3. Reklam Rezervasyon',
      accentColor: '#0c617c',
      moduleColor: '#e8b44c',
      fontSansId: 'custom_sans_1795439548991',
      fontMonoId: 'custom_mono_1795439566952',
      fontScale: 100,
      timecodeScale: 100,
      ...DEFAULT_MODULE_BOX_STYLE,
      emptyBreakColor: '#ed891e',
      filledBreakColor: '#037181',
      spotBadgeColor: '#037181'
    },
    'list-control': {
      id: 'list-control',
      label: '4. Yayın Kontrol',
      accentColor: '#0c617c',
      moduleColor: '#142a44',
      fontSansId: 'custom_sans_1795439548991',
      fontMonoId: 'custom_mono_1795439566952',
      fontScale: 100,
      timecodeScale: 100,
      ...DEFAULT_MODULE_BOX_STYLE,
      adBlockColor: '#e8b44c',
      programBlockColor: '#0c617c',
      readyBadgeColor: '#037181'
    }
  }
};

/**
 * Hex rengini verilen opaklıkta rgba() metnine çevirir.
 */
export function hexToRgba(hex, alpha = 0.12) {
  if (!hex || typeof hex !== 'string') return `rgba(12, 97, 124, ${alpha})`;
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length !== 6 && cleaned.length !== 3) return `rgba(12, 97, 124, ${alpha})`;
  const full = cleaned.length === 3
    ? cleaned.split('').map(c => c + c).join('')
    : cleaned;
  const num = parseInt(full, 16);
  if (isNaN(num)) return `rgba(12, 97, 124, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getAllSansFonts(config) {
  const custom = Array.isArray(config?.typography?.customSansFonts)
    ? config.typography.customSansFonts
    : [];
  const map = new Map();
  [...FONT_SANS_OPTIONS, ...custom].forEach(f => {
    if (f && f.id) map.set(f.id, f);
  });
  return Array.from(map.values());
}

export function getAllMonoFonts(config) {
  const custom = Array.isArray(config?.typography?.customMonoFonts)
    ? config.typography.customMonoFonts
    : [];
  const map = new Map();
  [...FONT_MONO_OPTIONS, ...custom].forEach(f => {
    if (f && f.id) map.set(f.id, f);
  });
  return Array.from(map.values());
}

function ensureCustomFontLoaded(fontObj) {
  if (typeof document === 'undefined' || !fontObj) return;
  if (fontObj.googleFontUrl && !fontObj.googleFontUrl.includes('fonts.googleapis.com')) {
    const linkId = `custom-font-${fontObj.id}`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = fontObj.googleFontUrl;
      document.head.appendChild(link);
    }
  }
}

function isLegacyBluePurpleTheme(saved) {
  if (!saved || typeof saved !== 'object') return false;
  const draftAcc = String(saved?.modules?.draft?.accentColor || '').toLowerCase();
  const cat4 = String(saved?.categoryColors?.[4]?.color || '').toLowerCase();
  if (draftAcc === '#2563eb' || cat4 === '#10b981') {
    return true;
  }
  return false;
}

function mergeThemeConfig(saved) {
  if (!saved || typeof saved !== 'object' || isLegacyBluePurpleTheme(saved)) {
    return structuredClone(DEFAULT_THEME_CONFIG);
  }

  const merged = structuredClone(DEFAULT_THEME_CONFIG);

  if (saved.typography) {
    Object.assign(merged.typography, saved.typography);
    // Yalnızca Roboto ve Roboto Mono kullan
    merged.typography.fontSans = "'Roboto', 'Segoe UI', Arial, sans-serif";
    merged.typography.fontMono = "'Roboto Mono', Consolas, monospace";
    if (!Array.isArray(merged.typography.customSansFonts)) merged.typography.customSansFonts = DEFAULT_THEME_CONFIG.typography.customSansFonts;
    if (!Array.isArray(merged.typography.customMonoFonts)) merged.typography.customMonoFonts = DEFAULT_THEME_CONFIG.typography.customMonoFonts;
  }
  if (saved.categoryColors) {
    Object.keys(saved.categoryColors).forEach(k => {
      if (merged.categoryColors[k]) {
        Object.assign(merged.categoryColors[k], saved.categoryColors[k]);
      } else {
        merged.categoryColors[k] = {
          titleTextColor: '#0A101D',
          badgeTextColor: '#0A101D',
          ...saved.categoryColors[k]
        };
      }
    });
  }
  if (saved.dayColors) {
    Object.keys(saved.dayColors).forEach(dayKey => {
      if (merged.dayColors[dayKey]) {
        Object.assign(merged.dayColors[dayKey], saved.dayColors[dayKey]);
      }
    });
  }
  if (saved.periodColors) {
    Object.keys(saved.periodColors).forEach(pKey => {
      if (merged.periodColors[pKey]) {
        Object.assign(merged.periodColors[pKey], saved.periodColors[pKey]);
      }
    });
  }
  if (saved.specialColors) {
    Object.assign(merged.specialColors, saved.specialColors);
  }
  if (saved.modules) {
    Object.keys(saved.modules).forEach(mKey => {
      if (merged.modules[mKey]) {
        Object.assign(merged.modules[mKey], DEFAULT_MODULE_BOX_STYLE, saved.modules[mKey]);
      }
    });
  }

  return merged;
}

function loadThemeConfigFromStorage() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw) {
      return mergeThemeConfig(JSON.parse(raw));
    }
  } catch (e) {
    console.warn('Tema ayarları yüklenemedi:', e);
  }
  return structuredClone(DEFAULT_THEME_CONFIG);
}

function saveThemeConfigToStorage(config) {
  try {
    const withTs = { ...config, updatedAt: new Date().toISOString() };
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(withTs));
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      fetch('/api/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeConfig: withTs })
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('Tema ayarları kaydedilemedi:', e);
  }
}

/**
 * Aktif tema ayarlarını DOM köküne (:root) CSS değişkenleri olarak uygular.
 */
export function applyThemeCssVariables(config) {
  if (typeof document === 'undefined' || !config) return;
  const root = document.documentElement;

  const allSans = getAllSansFonts(config);
  const allMono = getAllMonoFonts(config);

  allSans.forEach(ensureCustomFontLoaded);
  allMono.forEach(ensureCustomFontLoaded);

  const fontSansObj = allSans.find(f => f.id === config.typography?.fontSansId) || allSans[0];
  const fontMonoObj = allMono.find(f => f.id === config.typography?.fontMonoId) || allMono[0];

  root.style.setProperty('--font-sans', fontSansObj.value);
  root.style.setProperty('--font-mono', fontMonoObj.value);
  root.style.setProperty('--theme-font-scale', String((config.typography?.fontScale || 100) / 100));
  root.style.setProperty('--theme-timecode-scale', String((config.typography?.timecodeScale || 100) / 100));

  const sp = config.specialColors || DEFAULT_THEME_CONFIG.specialColors;
  root.style.setProperty('--theme-ad-break', sp.adBreakColor);
  root.style.setProperty('--theme-ad-break-empty', sp.adBreakEmptyColor);
  root.style.setProperty('--theme-ad-break-filled', sp.adBreakFilledColor);
  root.style.setProperty('--theme-ad-break-bg', sp.adBreakBg);
  root.style.setProperty('--theme-filler', sp.fillerSlotColor);
  root.style.setProperty('--theme-live', sp.liveColor);
  root.style.setProperty('--theme-intro', sp.introColor);
  root.style.setProperty('--theme-clip', sp.clipColor);

  const pr = config.periodColors || DEFAULT_THEME_CONFIG.periodColors;
  root.style.setProperty('--theme-period-night', pr.night?.color || '#0b2b54');
  root.style.setProperty('--theme-period-morning', pr.morning?.color || '#e8b44c');
  root.style.setProperty('--theme-period-day', pr.day?.color || '#109aad');
  root.style.setProperty('--theme-period-evening', pr.evening?.color || '#0c617c');

  const cats = config.categoryColors || DEFAULT_THEME_CONFIG.categoryColors;
  Object.keys(cats).forEach(id => {
    const c = cats[id]?.color || '#0c617c';
    const titleCol = cats[id]?.titleTextColor || c;
    root.style.setProperty(`--theme-cat-${id}`, c);
    root.style.setProperty(`--theme-cat-${id}-title`, titleCol);
    root.style.setProperty(`--theme-cat-${id}-bg`, hexToRgba(c, 0.12));
    root.style.setProperty(`--theme-cat-${id}-border`, hexToRgba(c, 0.34));
  });

  const mods = config.modules || DEFAULT_THEME_CONFIG.modules;
  root.style.setProperty('--draft-accent', mods.draft?.accentColor || '#0c617c');
  root.style.setProperty('--ready-accent', mods.ready?.accentColor || '#0c617c');
  root.style.setProperty('--ads-brand', mods.ads?.accentColor || '#0c617c');
  root.style.setProperty('--ads-brand-soft', hexToRgba(mods.ads?.accentColor || '#0c617c', 0.12));
  root.style.setProperty('--lc-accent', mods['list-control']?.accentColor || '#0c617c');

  ['draft', 'ready', 'ads', 'list-control'].forEach(modId => {
    const prefix = modId === 'list-control' ? 'lc' : modId;
    const m = mods[modId] || {};
    const shadowOpt = BOX_SHADOW_OPTIONS.find(s => s.id === m.boxShadow) || BOX_SHADOW_OPTIONS[0];
    root.style.setProperty(`--${prefix}-font-sans`, fontSansObj.value);
    root.style.setProperty(`--${prefix}-font-mono`, fontMonoObj.value);
    root.style.setProperty(`--${prefix}-box-radius`, m.boxRadius || '4px');
    root.style.setProperty(`--${prefix}-box-padding`, m.cardPadding || '6px 8px');
    root.style.setProperty(`--${prefix}-box-border-width`, `${m.borderWidth || 1}px`);
    root.style.setProperty(`--${prefix}-box-left-accent`, `${m.leftAccentWidth || 5}px`);
    root.style.setProperty(`--${prefix}-box-shadow`, shadowOpt.value);
    root.style.setProperty(`--${prefix}-box-shadow-hover`, shadowOpt.hoverValue);
  });
}

export const DAY_PALETTE_PRESETS = {
  pastel: {
    label: 'Kurumsal Turkuaz (Varsayılan - 2026)',
    days: DEFAULT_THEME_CONFIG.dayColors
  },
  corporate: {
    label: 'Kurumsal Lacivert & Gece',
    days: {
      Pazartesi: { line: '#9cc3cf', border: '#9cc3cf', timeBg: '#e7f0f3', headerBg: '#f3f8fa', subHeaderBg: '#e7f0f3', textAccent: '#0c617c' },
      Salı:      { line: '#9cc3cf', border: '#9cc3cf', timeBg: '#e7f0f3', headerBg: '#f3f8fa', subHeaderBg: '#e7f0f3', textAccent: '#142a44' },
      Çarşamba:  { line: '#9cc3cf', border: '#9cc3cf', timeBg: '#e7f0f3', headerBg: '#f3f8fa', subHeaderBg: '#e7f0f3', textAccent: '#0c617c' },
      Perşembe:  { line: '#9cc3cf', border: '#9cc3cf', timeBg: '#e7f0f3', headerBg: '#f3f8fa', subHeaderBg: '#e7f0f3', textAccent: '#142a44' },
      Cuma:      { line: '#e8b44c', border: '#e8b44c', timeBg: '#fbefd6', headerBg: '#fcf6e9', subHeaderBg: '#fbefd6', textAccent: '#80632a' },
      Cumartesi: { line: '#9cc3cf', border: '#9cc3cf', timeBg: '#e7f0f3', headerBg: '#f3f8fa', subHeaderBg: '#e7f0f3', textAccent: '#0c617c' },
      Pazar:     { line: '#9cc3cf', border: '#9cc3cf', timeBg: '#e7f0f3', headerBg: '#f3f8fa', subHeaderBg: '#e7f0f3', textAccent: '#0c617c' }
    }
  },
  nature: {
    label: 'Yumuşak Doğa & Toprak Tonları',
    days: {
      Pazartesi: { line: '#468625', border: '#70ac42', timeBg: '#e3efdb', headerBg: '#f4f9f1', subHeaderBg: '#e3efdb', textAccent: '#3c721f' },
      Salı:      { line: '#058193', border: '#109aad', timeBg: '#e7f0f3', headerBg: '#f3f8fa', subHeaderBg: '#e7f0f3', textAccent: '#046e7d' },
      Çarşamba:  { line: '#0c617c', border: '#9cc3cf', timeBg: '#e7f0f3', headerBg: '#f3f8fa', subHeaderBg: '#e7f0f3', textAccent: '#0c617c' },
      Perşembe:  { line: '#70ac42', border: '#70ac42', timeBg: '#e3efdb', headerBg: '#f4f9f1', subHeaderBg: '#e3efdb', textAccent: '#49702b' },
      Cuma:      { line: '#e8b44c', border: '#e8b44c', timeBg: '#fbefd6', headerBg: '#fcf6e9', subHeaderBg: '#fbefd6', textAccent: '#80632a' },
      Cumartesi: { line: '#ed891e', border: '#ed891e', timeBg: '#fbefd6', headerBg: '#fcf6e9', subHeaderBg: '#fbefd6', textAccent: '#9a5914' },
      Pazar:     { line: '#c56d3b', border: '#c56d3b', timeBg: '#fbefd6', headerBg: '#fcf6e9', subHeaderBg: '#fbefd6', textAccent: '#94522c' }
    }
  }
};

const initialConfig = loadThemeConfigFromStorage();
if (typeof window !== 'undefined') {
  applyThemeCssVariables(initialConfig);
}

const useThemeStore = create((set) => ({
  config: initialConfig,

  updateTypography: (partial) => {
    set(state => {
      const next = structuredClone(state.config);
      Object.assign(next.typography, partial);
      const allSans = getAllSansFonts(next);
      const allMono = getAllMonoFonts(next);
      if (partial.fontSansId) {
        const found = allSans.find(f => f.id === partial.fontSansId);
        if (found) next.typography.fontSans = found.value;
      }
      if (partial.fontMonoId) {
        const found = allMono.find(f => f.id === partial.fontMonoId);
        if (found) next.typography.fontMono = found.value;
      }
      saveThemeConfigToStorage(next);
      applyThemeCssVariables(next);
      return { config: next };
    });
  },

  addCustomFont: ({ type = 'sans', name, fontFamily, googleFontUrl = '' }) => {
    if (!name || !fontFamily) return null;
    const cleanName = String(name).trim();
    const cleanFamily = String(fontFamily).trim().replace(/^['"]|['"]$/g, '');
    const id = `custom_${type}_${Date.now()}`;
    const fallback = type === 'mono'
      ? `'${cleanFamily}', 'Roboto Mono', Consolas, monospace`
      : `'${cleanFamily}', 'Roboto', 'Segoe UI', Arial, sans-serif`;

    const newFont = {
      id,
      label: `${cleanName} (Özel ${type === 'mono' ? 'Saat & Timecode' : 'Yazı'} Fontu)`,
      value: fallback,
      googleFontUrl: String(googleFontUrl || '').trim(),
      isCustom: true
    };

    set(state => {
      const next = structuredClone(state.config);
      if (type === 'mono') {
        next.typography.customMonoFonts = [...(next.typography.customMonoFonts || []), newFont];
        next.typography.fontMonoId = newFont.id;
        next.typography.fontMono = newFont.value;
      } else {
        next.typography.customSansFonts = [...(next.typography.customSansFonts || []), newFont];
        next.typography.fontSansId = newFont.id;
        next.typography.fontSans = newFont.value;
      }
      saveThemeConfigToStorage(next);
      applyThemeCssVariables(next);
      return { config: next };
    });
    return newFont;
  },

  removeCustomFont: (fontId) => {
    set(state => {
      const next = structuredClone(state.config);
      next.typography.customSansFonts = (next.typography.customSansFonts || []).filter(f => f.id !== fontId);
      next.typography.customMonoFonts = (next.typography.customMonoFonts || []).filter(f => f.id !== fontId);
      if (next.typography.fontSansId === fontId) {
        next.typography.fontSansId = FONT_SANS_OPTIONS[0].id;
        next.typography.fontSans = FONT_SANS_OPTIONS[0].value;
      }
      if (next.typography.fontMonoId === fontId) {
        next.typography.fontMonoId = FONT_MONO_OPTIONS[0].id;
        next.typography.fontMono = FONT_MONO_OPTIONS[0].value;
      }
      saveThemeConfigToStorage(next);
      applyThemeCssVariables(next);
      return { config: next };
    });
  },

  updateCategoryColor: (catId, colorOrPartial) => {
    set(state => {
      const next = structuredClone(state.config);
      if (!next.categoryColors[catId]) {
        next.categoryColors[catId] = { id: catId, name: `Kategori ${catId}`, color: '#0c617c', titleTextColor: '#0c617c', badgeTextColor: '#0c617c' };
      }
      if (typeof colorOrPartial === 'string') {
        next.categoryColors[catId].color = colorOrPartial;
      } else if (colorOrPartial && typeof colorOrPartial === 'object') {
        Object.assign(next.categoryColors[catId], colorOrPartial);
      }
      saveThemeConfigToStorage(next);
      applyThemeCssVariables(next);
      return { config: next };
    });
  },

  updateDayColor: (dayName, partialDayTheme) => {
    set(state => {
      const next = structuredClone(state.config);
      if (next.dayColors[dayName]) {
        Object.assign(next.dayColors[dayName], partialDayTheme);
      }
      saveThemeConfigToStorage(next);
      applyThemeCssVariables(next);
      return { config: next };
    });
  },

  applyDayPalettePreset: (presetKey) => {
    const preset = DAY_PALETTE_PRESETS[presetKey];
    if (!preset) return;
    set(state => {
      const next = structuredClone(state.config);
      next.dayColors = structuredClone(preset.days);
      saveThemeConfigToStorage(next);
      applyThemeCssVariables(next);
      return { config: next };
    });
  },

  updatePeriodColor: (periodId, partialPeriod) => {
    set(state => {
      const next = structuredClone(state.config);
      if (next.periodColors[periodId]) {
        Object.assign(next.periodColors[periodId], partialPeriod);
      }
      saveThemeConfigToStorage(next);
      applyThemeCssVariables(next);
      return { config: next };
    });
  },

  updateSpecialColors: (partialSpecial) => {
    set(state => {
      const next = structuredClone(state.config);
      Object.assign(next.specialColors, partialSpecial);
      saveThemeConfigToStorage(next);
      applyThemeCssVariables(next);
      return { config: next };
    });
  },

  updateModuleTheme: (moduleId, partialModule) => {
    set(state => {
      const next = structuredClone(state.config);
      if (next.modules[moduleId]) {
        Object.assign(next.modules[moduleId], partialModule);
        if (partialModule.boxSize) {
          const sizeOpt = BOX_SIZE_OPTIONS.find(s => s.id === partialModule.boxSize);
          if (sizeOpt) {
            next.modules[moduleId].cardPadding = sizeOpt.padding;
            next.modules[moduleId].rowHeight = sizeOpt.rowHeight;
          }
        }
      }
      saveThemeConfigToStorage(next);
      applyThemeCssVariables(next);
      return { config: next };
    });
  },

  copyModuleBoxStyleToAll: (sourceModuleId) => {
    set(state => {
      const next = structuredClone(state.config);
      const src = next.modules[sourceModuleId];
      if (!src) return { config: next };
      const sharedKeys = [
        'fontSansId', 'fontMonoId', 'fontScale', 'timecodeScale',
        'boxRadius', 'boxSize', 'cardPadding', 'rowHeight',
        'borderWidth', 'leftAccentWidth', 'boxShadow', 'cardTintOpacity', 'useCategoryTitleColor'
      ];
      ['draft', 'ready', 'ads', 'list-control'].forEach(mId => {
        if (mId === sourceModuleId || !next.modules[mId]) return;
        sharedKeys.forEach(k => {
          if (src[k] !== undefined) next.modules[mId][k] = src[k];
        });
      });
      saveThemeConfigToStorage(next);
      applyThemeCssVariables(next);
      return { config: next };
    });
  },

  resetThemeToDefaults: () => {
    const fresh = structuredClone(DEFAULT_THEME_CONFIG);
    saveThemeConfigToStorage(fresh);
    applyThemeCssVariables(fresh);
    set({ config: fresh });
  },

  saveAndApplyThemeNow: async () => {
    const current = useThemeStore.getState().config;
    const withTs = { ...current, updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(withTs));
    } catch (_) {}
    applyThemeCssVariables(withTs);
    set({ config: withTs });
    try {
      const res = await fetch('/api/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeConfig: withTs })
      });
      return res.ok;
    } catch (_) {
      return false;
    }
  },

  hydrateThemeFromServer: async () => {
    try {
      const res = await fetch('/api/theme');
      if (!res.ok) return;
      const data = await res.json();
      const serverTheme = data?.themeConfig;
      if (serverTheme && typeof serverTheme === 'object' && !isLegacyBluePurpleTheme(serverTheme)) {
        const merged = mergeThemeConfig(serverTheme);
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(merged));
        applyThemeCssVariables(merged);
        set({ config: merged });
      }
    } catch (_) {}
  }
}));

if (typeof window !== 'undefined') {
  setTimeout(() => {
    useThemeStore.getState().hydrateThemeFromServer();
  }, 50);
}

export default useThemeStore;
