/**
 * @file src/store/themeStore.js
 * @description Tüm sistem ve 4 ana modül (Taslak Planlama, Yayına Hazır, Reklam Rezervasyon, Yayın Kontrol)
 * için merkezi Tema, Kategori Renkleri, Kategoriye Göre İsim Yazı Rengi, Kutu Yapısı, Kutu Boyutları,
 * Gölgelendirmeler, Gün Renkleri, Kuşak Renkleri, Reklam Kuşağı Rengi ve Yazı/Saat/Timecode Fontları deposu.
 */
import { create } from 'zustand';

const THEME_STORAGE_KEY = 'yayin_custom_theme_config_v2';

export const FONT_SANS_OPTIONS = [
  {
    id: 'jakarta',
    label: 'Plus Jakarta Sans (Kurumsal Varsayılan)',
    value: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  {
    id: 'inter',
    label: 'Inter (Modern Yayın & Tablo)',
    value: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  {
    id: 'outfit',
    label: 'Outfit (TailAdmin & SaaS)',
    value: "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  {
    id: 'roboto',
    label: 'Roboto (Klasik Yayın Otomasyon)',
    value: "'Roboto', 'Segoe UI', Arial, sans-serif"
  },
  {
    id: 'poppins',
    label: 'Poppins (Yumuşak & Geniş)',
    value: "'Poppins', 'Inter', sans-serif"
  },
  {
    id: 'montserrat',
    label: 'Montserrat (Yayın Başlık & Ekran)',
    value: "'Montserrat', 'Inter', sans-serif"
  },
  {
    id: 'system',
    label: 'Sistem Fontu (Segoe UI / San Francisco)',
    value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  }
];

export const FONT_MONO_OPTIONS = [
  {
    id: 'jetbrains',
    label: 'JetBrains Mono (Varsayılan Saat & Timecode)',
    value: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
  },
  {
    id: 'firacode',
    label: 'Fira Code (Yayın Timecode & TC)',
    value: "'Fira Code', 'JetBrains Mono', Consolas, monospace"
  },
  {
    id: 'robotomono',
    label: 'Roboto Mono (Net Dijital Saat & Rakamlar)',
    value: "'Roboto Mono', Consolas, monospace"
  },
  {
    id: 'ibmplexmono',
    label: 'IBM Plex Mono (MCR & Playout Timecode)',
    value: "'IBM Plex Mono', 'JetBrains Mono', Consolas, monospace"
  },
  {
    id: 'consolas',
    label: 'Consolas / Klasik Monospace',
    value: "Consolas, 'Courier New', monospace"
  }
];

export const BOX_RADIUS_OPTIONS = [
  { id: '4px', label: 'Keskin (4px)', value: '4px' },
  { id: '8px', label: 'Kurumsal (8px - Varsayılan)', value: '8px' },
  { id: '12px', label: 'Yumuşak (12px)', value: '12px' },
  { id: '16px', label: 'Yuvarlak (16px)', value: '16px' }
];

export const BOX_SIZE_OPTIONS = [
  { id: 'compact', label: 'Kompakt (Sıkışık Görünüm)', padding: '4px 6px', rowHeight: 48, scale: 0.94 },
  { id: 'standard', label: 'Standart (Kurumsal Dengeli)', padding: '6px 8px', rowHeight: 56, scale: 1.0 },
  { id: 'comfortable', label: 'Ferah (Geniş Kutu & Okunaklı)', padding: '9px 12px', rowHeight: 66, scale: 1.05 },
  { id: 'large', label: 'Stüdyo Büyük (Büyük Kutu & Yazı)', padding: '12px 14px', rowHeight: 76, scale: 1.12 }
];

export const BOX_SHADOW_OPTIONS = [
  { id: 'none', label: 'Gölgesiz (Flat / Düz)', value: 'none', hoverValue: '0 1px 3px rgba(15, 23, 42, 0.06)' },
  { id: 'subtle', label: 'Hafif Kurumsal Gölge', value: '0 1px 2px rgba(15, 23, 42, 0.04)', hoverValue: '0 4px 12px -2px rgba(15, 23, 42, 0.12)' },
  { id: 'medium', label: 'Orta Kart Gölgesi', value: '0 3px 8px -1px rgba(15, 23, 42, 0.10)', hoverValue: '0 8px 18px -3px rgba(15, 23, 42, 0.18)' },
  { id: 'deep', label: 'Derin Stüdyo Gölgesi (3B Kutu)', value: '0 6px 16px -2px rgba(15, 23, 42, 0.16)', hoverValue: '0 12px 24px -4px rgba(15, 23, 42, 0.25)' }
];

export const DEFAULT_MODULE_BOX_STYLE = {
  boxRadius: '8px',
  boxSize: 'standard',      // compact | standard | comfortable | large
  cardPadding: '6px 8px',
  rowHeight: 56,
  borderWidth: 1,           // 1 | 1.5 | 2 (px)
  leftAccentWidth: 3.5,     // 2 | 3.5 | 5 | 6 (px)
  boxShadow: 'subtle',      // none | subtle | medium | deep
  cardTintOpacity: 11,      // %4 - %30
  useCategoryTitleColor: true // Kategoriye göre isim yazı rengini uygula
};

export const DEFAULT_THEME_CONFIG = {
  // 1. Genel & Özel Eklenen Fontlar (Yazı Fontu + Saat ve Timecode Fontu)
  typography: {
    fontSansId: 'jakarta',
    fontSans: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontMonoId: 'jetbrains',
    fontMono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontScale: 100, // %90 - %120
    timecodeScale: 100, // Saat ve Timecode boyutu (%90 - %125)
    customSansFonts: [], // [{ id, label, value, googleFontUrl }]
    customMonoFonts: []  // [{ id, label, value, googleFontUrl }]
  },

  // 2. Program Türü / Kategori Renkleri + Kategoriye Göre İsim Yazı Rengi
  categoryColors: {
    1:  { id: 1,  name: 'Kadın',               color: '#ec4899', titleTextColor: '#9d174d', badgeTextColor: '#be185d', badge: 'Kadın' },
    2:  { id: 2,  name: 'Haber',               color: '#ef4444', titleTextColor: '#991b1b', badgeTextColor: '#b91c1c', badge: 'Haber' },
    3:  { id: 3,  name: 'Tanıtım',             color: '#14b8a6', titleTextColor: '#115e59', badgeTextColor: '#0f766e', badge: 'Tanıtım' },
    4:  { id: 4,  name: 'Dini / İlim',         color: '#10b981', titleTextColor: '#065f46', badgeTextColor: '#047857', badge: 'Dini' },
    5:  { id: 5,  name: 'Çocuk / Gençlik',     color: '#f59e0b', titleTextColor: '#92400e', badgeTextColor: '#b45309', badge: 'Çocuk' },
    6:  { id: 6,  name: 'Reklam',              color: '#eab308', titleTextColor: '#854d0e', badgeTextColor: '#a16207', badge: 'Reklam' },
    7:  { id: 7,  name: 'Jenerik / İntro',     color: '#6366f1', titleTextColor: '#3730a3', badgeTextColor: '#4338ca', badge: 'Jenerik' },
    8:  { id: 8,  name: 'Kültürel / Tarih',    color: '#3b82f6', titleTextColor: '#1e40af', badgeTextColor: '#1d4ed8', badge: 'Kültür' },
    9:  { id: 9,  name: 'Sohbet / Detay',      color: '#8b5cf6', titleTextColor: '#5b21b6', badgeTextColor: '#6d28d9', badge: 'Sohbet' },
    10: { id: 10, name: 'Kısa Program / Dolgu',color: '#06b6d4', titleTextColor: '#155e75', badgeTextColor: '#0e7490', badge: 'Kısa' },
    11: { id: 11, name: 'Ham',                 color: '#64748b', titleTextColor: '#334155', badgeTextColor: '#475569', badge: 'Ham' }
  },

  // 3. Gün Renkleri (Pazartesi - Pazar açık pastel saat sütunu ve sınır çizgileri)
  dayColors: {
    Pazartesi: {
      line: '#7dd3fc',
      border: '#bae6fd',
      timeBg: '#e0f2fe',
      headerBg: '#f0f9ff',
      subHeaderBg: '#e0f2fe',
      textAccent: '#0284c7'
    },
    Salı: {
      line: '#c4b5fd',
      border: '#ddd6fe',
      timeBg: '#ede9fe',
      headerBg: '#f5f3ff',
      subHeaderBg: '#ede9fe',
      textAccent: '#7c3aed'
    },
    Çarşamba: {
      line: '#67e8f9',
      border: '#a5f3fc',
      timeBg: '#cffafe',
      headerBg: '#ecfeff',
      subHeaderBg: '#cffafe',
      textAccent: '#0891b2'
    },
    Perşembe: {
      line: '#86efac',
      border: '#bbf7d0',
      timeBg: '#dcfce7',
      headerBg: '#f0fdf4',
      subHeaderBg: '#dcfce7',
      textAccent: '#16a34a'
    },
    Cuma: {
      line: '#fcd34d',
      border: '#fde68a',
      timeBg: '#fef3c7',
      headerBg: '#fffbeb',
      subHeaderBg: '#fef3c7',
      textAccent: '#d97706'
    },
    Cumartesi: {
      line: '#fda4af',
      border: '#fecdd3',
      timeBg: '#ffe4e6',
      headerBg: '#fff1f2',
      subHeaderBg: '#ffe4e6',
      textAccent: '#e11d48'
    },
    Pazar: {
      line: '#a5b4fc',
      border: '#c7d2fe',
      timeBg: '#e0e7ff',
      headerBg: '#eef2ff',
      subHeaderBg: '#e0e7ff',
      textAccent: '#4f46e5'
    }
  },

  // 4. Kuşak Renkleri (4 Ana Gün Kuşağı: Gece, Sabah, Gündüz, Akşam)
  periodColors: {
    night: {
      id: 'night',
      label: 'Gece Yayın Kuşağı',
      shortLabel: 'Gece',
      range: '00:00 - 06:00',
      icon: '🌙',
      color: '#6366f1',
      bg: '#eef2ff'
    },
    morning: {
      id: 'morning',
      label: 'Sabah Yayın Kuşağı',
      shortLabel: 'Sabah',
      range: '06:00 - 12:00',
      icon: '🌅',
      color: '#f59e0b',
      bg: '#fffbeb'
    },
    day: {
      id: 'day',
      label: 'Gündüz Yayın Kuşağı',
      shortLabel: 'Öğle',
      range: '12:00 - 18:00',
      icon: '☀️',
      color: '#0ea5e9',
      bg: '#f0f9ff'
    },
    evening: {
      id: 'evening',
      label: 'Akşam & Prime-Time Kuşağı',
      shortLabel: 'Akşam',
      range: '18:00 - 24:00',
      icon: '🌆',
      color: '#8b5cf6',
      bg: '#f5f3ff'
    }
  },

  // 5. Reklam Kuşağı ve Özel Akış Öğesi Renkleri
  specialColors: {
    adBreakColor: '#f59e0b',       // Reklam kuşağı ana vurgu rengi
    adBreakEmptyColor: '#ea580c',  // Boş reklam kuşağı vurgu rengi
    adBreakFilledColor: '#0d9488', // Spot yerleştirilmiş dolu reklam kuşağı rengi
    adBreakBg: '#fffbeb',          // Reklam kuşağı arka plan tonu
    fillerSlotColor: '#8b5cf6',    // Dolgu kuşağı rengi
    liveColor: '#ef4444',          // Canlı yayın rengi
    introColor: '#6366f1',         // İntro / Jenerik rengi
    clipColor: '#0d9488'           // Standart MAM klip satır rengi
  },

  // 6. 4 Ana Modül Bazlı Detaylı Görünüm, Kutu Yapısı, Boyut, Gölge ve Font Ayarları
  modules: {
    draft: {
      id: 'draft',
      label: '1. Taslak Planlama',
      accentColor: '#2563eb',
      fontSansId: 'jakarta',
      fontMonoId: 'jetbrains',
      fontScale: 100,
      timecodeScale: 100,
      ...DEFAULT_MODULE_BOX_STYLE,
      dayLineWidth: 2.5,
      showColoredTimeColumn: true
    },
    ready: {
      id: 'ready',
      label: '2. Yayına Hazır (Yayın Planlama)',
      accentColor: '#2563eb',
      fontSansId: 'jakarta',
      fontMonoId: 'jetbrains',
      fontScale: 100,
      timecodeScale: 100,
      ...DEFAULT_MODULE_BOX_STYLE,
      adBreakColor: '#f59e0b',
      fillerColor: '#8b5cf6',
      liveColor: '#ef4444',
      showPeriodHeaders: true
    },
    ads: {
      id: 'ads',
      label: '3. Reklam Rezervasyon',
      accentColor: '#465fff',
      fontSansId: 'outfit',
      fontMonoId: 'jetbrains',
      fontScale: 100,
      timecodeScale: 100,
      ...DEFAULT_MODULE_BOX_STYLE,
      emptyBreakColor: '#ea580c',
      filledBreakColor: '#0d9488',
      spotBadgeColor: '#0d9488'
    },
    'list-control': {
      id: 'list-control',
      label: '4. Yayın Kontrol',
      accentColor: '#2563eb',
      fontSansId: 'jakarta',
      fontMonoId: 'jetbrains',
      fontScale: 100,
      timecodeScale: 100,
      ...DEFAULT_MODULE_BOX_STYLE,
      adBlockColor: '#f59e0b',
      programBlockColor: '#3b82f6',
      readyBadgeColor: '#059669'
    }
  }
};

/**
 * Hex rengini verilen opaklıkta rgba() metnine çevirir.
 */
export function hexToRgba(hex, alpha = 0.15) {
  if (!hex || typeof hex !== 'string') return `rgba(59, 130, 246, ${alpha})`;
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length !== 6 && cleaned.length !== 3) return `rgba(59, 130, 246, ${alpha})`;
  const full = cleaned.length === 3
    ? cleaned.split('').map(c => c + c).join('')
    : cleaned;
  const num = parseInt(full, 16);
  if (isNaN(num)) return `rgba(59, 130, 246, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Kullanıcının eklediği özel fontlarla birlikte tüm Yazı Fontu seçeneklerini döndürür.
 */
export function getAllSansFonts(config) {
  const custom = Array.isArray(config?.typography?.customSansFonts)
    ? config.typography.customSansFonts
    : [];
  return [...FONT_SANS_OPTIONS, ...custom];
}

/**
 * Kullanıcının eklediği özel Saat & Timecode fontlarıyla birlikte tüm Monospace seçeneklerini döndürür.
 */
export function getAllMonoFonts(config) {
  const custom = Array.isArray(config?.typography?.customMonoFonts)
    ? config.typography.customMonoFonts
    : [];
  return [...FONT_MONO_OPTIONS, ...custom];
}

/**
 * Google Fonts URL'sini veya Font adını <head> içerisine dinamik yükler.
 */
function ensureCustomFontLoaded(fontObj) {
  if (typeof document === 'undefined' || !fontObj) return;
  if (fontObj.googleFontUrl) {
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

function mergeThemeConfig(saved) {
  if (!saved || typeof saved !== 'object') return structuredClone(DEFAULT_THEME_CONFIG);

  const merged = structuredClone(DEFAULT_THEME_CONFIG);

  if (saved.typography) {
    Object.assign(merged.typography, saved.typography);
    if (!Array.isArray(merged.typography.customSansFonts)) merged.typography.customSansFonts = [];
    if (!Array.isArray(merged.typography.customMonoFonts)) merged.typography.customMonoFonts = [];
  }
  if (saved.categoryColors) {
    Object.keys(saved.categoryColors).forEach(k => {
      if (merged.categoryColors[k]) {
        Object.assign(merged.categoryColors[k], saved.categoryColors[k]);
      } else {
        merged.categoryColors[k] = {
          titleTextColor: '#1e293b',
          badgeTextColor: '#334155',
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
    const raw = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem('yayin_custom_theme_config_v1');
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
      fetch('/api/ads-store', {
        method: 'POST',
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

  // Özel akış ve reklam kuşağı değişkenleri
  const sp = config.specialColors || DEFAULT_THEME_CONFIG.specialColors;
  root.style.setProperty('--theme-ad-break', sp.adBreakColor);
  root.style.setProperty('--theme-ad-break-empty', sp.adBreakEmptyColor);
  root.style.setProperty('--theme-ad-break-filled', sp.adBreakFilledColor);
  root.style.setProperty('--theme-ad-break-bg', sp.adBreakBg);
  root.style.setProperty('--theme-filler', sp.fillerSlotColor);
  root.style.setProperty('--theme-live', sp.liveColor);
  root.style.setProperty('--theme-intro', sp.introColor);
  root.style.setProperty('--theme-clip', sp.clipColor);

  // Kuşak renkleri
  const pr = config.periodColors || DEFAULT_THEME_CONFIG.periodColors;
  root.style.setProperty('--theme-period-night', pr.night?.color || '#6366f1');
  root.style.setProperty('--theme-period-morning', pr.morning?.color || '#f59e0b');
  root.style.setProperty('--theme-period-day', pr.day?.color || '#0ea5e9');
  root.style.setProperty('--theme-period-evening', pr.evening?.color || '#8b5cf6');

  // Kategori renkleri + Kategoriye göre isim yazı rengi
  const cats = config.categoryColors || DEFAULT_THEME_CONFIG.categoryColors;
  Object.keys(cats).forEach(id => {
    const c = cats[id]?.color || '#3b82f6';
    const titleCol = cats[id]?.titleTextColor || c;
    root.style.setProperty(`--theme-cat-${id}`, c);
    root.style.setProperty(`--theme-cat-${id}-title`, titleCol);
    root.style.setProperty(`--theme-cat-${id}-bg`, hexToRgba(c, 0.15));
    root.style.setProperty(`--theme-cat-${id}-border`, hexToRgba(c, 0.4));
  });

  // Modül bazlı değişkenler (Kutu yapısı, boyutlar, gölgelendirme, fontlar)
  const mods = config.modules || DEFAULT_THEME_CONFIG.modules;
  root.style.setProperty('--draft-accent', mods.draft?.accentColor || '#2563eb');
  root.style.setProperty('--ready-accent', mods.ready?.accentColor || '#2563eb');
  root.style.setProperty('--ads-brand', mods.ads?.accentColor || '#465fff');
  root.style.setProperty('--ads-brand-soft', hexToRgba(mods.ads?.accentColor || '#465fff', 0.12));
  root.style.setProperty('--lc-accent', mods['list-control']?.accentColor || '#2563eb');

  const resolveModSans = (modId) => {
    const fId = mods[modId]?.fontSansId;
    if (!fId || fId === 'inherit') return fontSansObj.value;
    return allSans.find(f => f.id === fId)?.value || fontSansObj.value;
  };
  const resolveModMono = (modId) => {
    const fId = mods[modId]?.fontMonoId;
    if (!fId || fId === 'inherit') return fontMonoObj.value;
    return allMono.find(f => f.id === fId)?.value || fontMonoObj.value;
  };

  ['draft', 'ready', 'ads', 'list-control'].forEach(modId => {
    const prefix = modId === 'list-control' ? 'lc' : modId;
    const m = mods[modId] || {};
    const shadowOpt = BOX_SHADOW_OPTIONS.find(s => s.id === m.boxShadow) || BOX_SHADOW_OPTIONS[1];
    root.style.setProperty(`--${prefix}-font-sans`, resolveModSans(modId));
    root.style.setProperty(`--${prefix}-font-mono`, resolveModMono(modId));
    root.style.setProperty(`--${prefix}-box-radius`, m.boxRadius || '8px');
    root.style.setProperty(`--${prefix}-box-padding`, m.cardPadding || '6px 8px');
    root.style.setProperty(`--${prefix}-box-border-width`, `${m.borderWidth || 1}px`);
    root.style.setProperty(`--${prefix}-box-left-accent`, `${m.leftAccentWidth || 3.5}px`);
    root.style.setProperty(`--${prefix}-box-shadow`, shadowOpt.value);
    root.style.setProperty(`--${prefix}-box-shadow-hover`, shadowOpt.hoverValue);
  });
}

export const DAY_PALETTE_PRESETS = {
  pastel: {
    label: 'Açık Pastel (Göz Yormayan - Varsayılan)',
    days: DEFAULT_THEME_CONFIG.dayColors
  },
  corporate: {
    label: 'Kurumsal Mavi & Arduvaz',
    days: {
      Pazartesi: { line: '#93c5fd', border: '#bfdbfe', timeBg: '#eff6ff', headerBg: '#f8fafc', subHeaderBg: '#eff6ff', textAccent: '#1d4ed8' },
      Salı:      { line: '#cbd5e1', border: '#e2e8f0', timeBg: '#f1f5f9', headerBg: '#ffffff', subHeaderBg: '#f1f5f9', textAccent: '#334155' },
      Çarşamba:  { line: '#7dd3fc', border: '#bae6fd', timeBg: '#e0f2fe', headerBg: '#f8fafc', subHeaderBg: '#e0f2fe', textAccent: '#0369a1' },
      Perşembe:  { line: '#cbd5e1', border: '#e2e8f0', timeBg: '#f1f5f9', headerBg: '#ffffff', subHeaderBg: '#f1f5f9', textAccent: '#334155' },
      Cuma:      { line: '#a5b4fc', border: '#c7d2fe', timeBg: '#e0e7ff', headerBg: '#f8fafc', subHeaderBg: '#e0e7ff', textAccent: '#4338ca' },
      Cumartesi: { line: '#fde68a', border: '#fef08a', timeBg: '#fef9c3', headerBg: '#fffbeb', subHeaderBg: '#fef9c3', textAccent: '#b45309' },
      Pazar:     { line: '#fecdd3', border: '#ffe4e6', timeBg: '#fff1f2', headerBg: '#fff5f5', subHeaderBg: '#fff1f2', textAccent: '#be123c' }
    }
  },
  nature: {
    label: 'Yumuşak Doğa & Toprak Tonları',
    days: {
      Pazartesi: { line: '#86efac', border: '#bbf7d0', timeBg: '#dcfce7', headerBg: '#f0fdf4', subHeaderBg: '#dcfce7', textAccent: '#15803d' },
      Salı:      { line: '#5eead4', border: '#99f6e4', timeBg: '#ccfbf1', headerBg: '#f0fdfa', subHeaderBg: '#ccfbf1', textAccent: '#0f766e' },
      Çarşamba:  { line: '#7dd3fc', border: '#bae6fd', timeBg: '#e0f2fe', headerBg: '#f0f9ff', subHeaderBg: '#e0f2fe', textAccent: '#0369a1' },
      Perşembe:  { line: '#bef264', border: '#d9f99d', timeBg: '#ecfccb', headerBg: '#f7fee7', subHeaderBg: '#ecfccb', textAccent: '#4d7c0f' },
      Cuma:      { line: '#fcd34d', border: '#fde68a', timeBg: '#fef3c7', headerBg: '#fffbeb', subHeaderBg: '#fef3c7', textAccent: '#b45309' },
      Cumartesi: { line: '#fdba74', border: '#fed7aa', timeBg: '#ffedd5', headerBg: '#fff7ed', subHeaderBg: '#ffedd5', textAccent: '#c2410c' },
      Pazar:     { line: '#d8b4fe', border: '#e9d5ff', timeBg: '#f3e8ff', headerBg: '#faf5ff', subHeaderBg: '#f3e8ff', textAccent: '#7e22ce' }
    }
  }
};

const initialConfig = loadThemeConfigFromStorage();
if (typeof window !== 'undefined') {
  applyThemeCssVariables(initialConfig);
}

const useThemeStore = create((set) => ({
  config: initialConfig,

  // Tipografi güncelle
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

  // Yeni Özel Yazı Fontu veya Saat/Timecode Fontu Ekle
  addCustomFont: ({ type = 'sans', name, fontFamily, googleFontUrl = '' }) => {
    if (!name || !fontFamily) return null;
    const cleanName = String(name).trim();
    const cleanFamily = String(fontFamily).trim().replace(/^['"]|['"]$/g, '');
    const id = `custom_${type}_${Date.now()}`;
    const fallback = type === 'mono'
      ? `'${cleanFamily}', 'JetBrains Mono', Consolas, monospace`
      : `'${cleanFamily}', 'Plus Jakarta Sans', 'Inter', sans-serif`;

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
        next.typography.fontSansId = 'jakarta';
        next.typography.fontSans = FONT_SANS_OPTIONS[0].value;
      }
      if (next.typography.fontMonoId === fontId) {
        next.typography.fontMonoId = 'jetbrains';
        next.typography.fontMono = FONT_MONO_OPTIONS[0].value;
      }
      saveThemeConfigToStorage(next);
      applyThemeCssVariables(next);
      return { config: next };
    });
  },

  // Kategori rengi ve kategoriye göre isim yazı rengi güncelle
  updateCategoryColor: (catId, colorOrPartial) => {
    set(state => {
      const next = structuredClone(state.config);
      if (!next.categoryColors[catId]) {
        next.categoryColors[catId] = { id: catId, name: `Kategori ${catId}`, color: '#3b82f6', titleTextColor: '#1e3a8a', badgeTextColor: '#1d4ed8' };
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

  // Gün rengi güncelle
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

  // Hazır gün paleti uygula
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

  // Kuşak (Gece/Sabah/Gündüz/Akşam) rengi güncelle
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

  // Reklam kuşağı ve özel renkleri güncelle
  updateSpecialColors: (partialSpecial) => {
    set(state => {
      const next = structuredClone(state.config);
      Object.assign(next.specialColors, partialSpecial);
      saveThemeConfigToStorage(next);
      applyThemeCssVariables(next);
      return { config: next };
    });
  },

  // Modül özel ayarlarını güncelle (draft, ready, ads, list-control)
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

  // Bir modülün kutu/font ayarlarını 4 modülün tamamına kopyala
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

  // Tüm tema ayarlarını varsayılana sıfırla
  resetThemeToDefaults: () => {
    const fresh = structuredClone(DEFAULT_THEME_CONFIG);
    saveThemeConfigToStorage(fresh);
    applyThemeCssVariables(fresh);
    set({ config: fresh });
  },

  // Sunucu veritabanından (/api/ads-store) tema ayarlarını çek ve uygula
  hydrateThemeFromServer: async () => {
    try {
      const res = await fetch('/api/ads-store');
      if (!res.ok) return;
      const data = await res.json();
      const serverTheme = data?.store?.themeConfig;
      if (serverTheme && typeof serverTheme === 'object') {
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
