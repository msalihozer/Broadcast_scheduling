/**
 * @file constants.js
 * @description Taslak Planlama Program Kütüphanesi sabitleri ve renk paleti.
 */

import useThemeStore from '../../../../store/themeStore';

export const CATEGORY_COLORS = {
  'Dini': '#10b981',
  'Dini / İlim': '#10b981',
  'Sohbet': '#8b5cf6',
  'Sohbet / Tasavvuf': '#8b5cf6',
  'Kültürel': '#3b82f6',
  'Kültür / Tarih': '#3b82f6',
  'Çocuk': '#f59e0b',
  'Çocuk / Gençlik': '#f59e0b',
  'Kısa Program': '#06b6d4',
  'Dolgu Kuşağı': '#06b6d4',
  'Programlar': '#6366f1'
};

/**
 * Admin Panel -> Temalar alanındaki kategori renklerini dikkate alarak kategori rengini döndürür.
 */
export function getCategoryColor(categoryName) {
  const customCats = useThemeStore.getState()?.config?.categoryColors || {};
  const raw = String(categoryName || '').toLocaleLowerCase('tr-TR');
  if (raw.includes('dini') || raw.includes('ilim')) return customCats[4]?.color || '#10b981';
  if (raw.includes('sohbet') || raw.includes('tasavvuf') || raw.includes('detay')) return customCats[9]?.color || '#8b5cf6';
  if (raw.includes('kültür') || raw.includes('kultur') || raw.includes('tarih')) return customCats[8]?.color || '#3b82f6';
  if (raw.includes('çocuk') || raw.includes('cocuk') || raw.includes('genç') || raw.includes('genc')) return customCats[5]?.color || '#f59e0b';
  if (raw.includes('kısa') || raw.includes('kisa') || raw.includes('dolgu')) return customCats[10]?.color || '#06b6d4';
  if (raw.includes('kadın') || raw.includes('kadin') || raw.includes('aile')) return customCats[1]?.color || '#ec4899';
  if (raw.includes('haber')) return customCats[2]?.color || '#ef4444';
  if (raw.includes('tanıtım') || raw.includes('tanitim')) return customCats[3]?.color || '#14b8a6';
  if (raw.includes('jenerik') || raw.includes('intro')) return customCats[7]?.color || '#6366f1';
  if (raw.includes('reklam')) return customCats[6]?.color || '#eab308';
  return CATEGORY_COLORS[categoryName] || customCats[8]?.color || '#3b82f6';
}

/**
 * Kategoriye göre program ismi yazı rengini (`titleTextColor`) döndürür.
 */
export function getCategoryTitleTextColor(categoryNameOrProg) {
  const customCats = useThemeStore.getState()?.config?.categoryColors || {};
  const categoryName = typeof categoryNameOrProg === 'object'
    ? (categoryNameOrProg?.category || categoryNameOrProg?.categoryName || '')
    : (categoryNameOrProg || '');
  const raw = String(categoryName).toLocaleLowerCase('tr-TR');
  if (raw.includes('dini') || raw.includes('ilim')) return customCats[4]?.titleTextColor || null;
  if (raw.includes('sohbet') || raw.includes('tasavvuf') || raw.includes('detay')) return customCats[9]?.titleTextColor || null;
  if (raw.includes('kültür') || raw.includes('kultur') || raw.includes('tarih')) return customCats[8]?.titleTextColor || null;
  if (raw.includes('çocuk') || raw.includes('cocuk') || raw.includes('genç') || raw.includes('genc')) return customCats[5]?.titleTextColor || null;
  if (raw.includes('kısa') || raw.includes('kisa') || raw.includes('dolgu')) return customCats[10]?.titleTextColor || null;
  if (raw.includes('kadın') || raw.includes('kadin') || raw.includes('aile')) return customCats[1]?.titleTextColor || null;
  if (raw.includes('haber')) return customCats[2]?.titleTextColor || null;
  if (raw.includes('tanıtım') || raw.includes('tanitim')) return customCats[3]?.titleTextColor || null;
  if (raw.includes('jenerik') || raw.includes('intro')) return customCats[7]?.titleTextColor || null;
  if (raw.includes('reklam')) return customCats[6]?.titleTextColor || null;
  return null;
}

// Her programa özel göz yormayan, yumuşak (soft/muted) kurumsal renk paleti
export const PROGRAM_COLOR_PALETTE = [
  '#3b82f6', // Soft Blue
  '#8b5cf6', // Soft Violet
  '#10b981', // Soft Emerald
  '#f59e0b', // Soft Amber
  '#ec4899', // Soft Pink
  '#06b6d4', // Soft Cyan
  '#6366f1', // Soft Indigo
  '#14b8a6', // Soft Teal
  '#f97316', // Soft Coral
  '#a855f7', // Soft Purple
  '#0ea5e9', // Soft Sky
  '#84cc16', // Soft Lime
  '#f43f5e', // Soft Rose
  '#64748b', // Soft Slate
  '#22c55e', // Soft Green
  '#eab308', // Soft Gold
  '#d946ef', // Soft Orchid
  '#0284c7', // Muted Ocean
  '#059669', // Muted Mint
  '#7c3aed'  // Muted Lavender
];

// Sık kullanılan programlar için yumuşak ve birbirinden rahat ayrılan sabit renkler
const NAMED_PROGRAM_COLORS = [
  { match: 'tecvid', color: '#0ea5e9' },              // Soft Sky
  { match: 'ilim dersleri', color: '#0ea5e9' },       // Soft Sky
  { match: 'beş vakit bir şehir', color: '#ec4899' }, // Soft Rose/Pink
  { match: 'bes vakit bir sehir', color: '#ec4899' },
  { match: 'hattın izinde', color: '#8b5cf6' },       // Soft Violet
  { match: 'hattin izinde', color: '#8b5cf6' },
  { match: 'büşra', color: '#10b981' },               // Soft Emerald
  { match: 'akaid', color: '#10b981' },
  { match: 'yüzyılın alimleri', color: '#f59e0b' },   // Soft Amber
  { match: 'yuzyilin alimleri', color: '#f59e0b' },
  { match: 'bedesten', color: '#06b6d4' },            // Soft Cyan
  { match: 'kuduri', color: '#6366f1' },              // Soft Indigo
  { match: 'semerkand sohbetleri', color: '#22c55e' },// Soft Green
  { match: 'güzergah', color: '#f97316' },            // Soft Orange
  { match: 'guzergah', color: '#f97316' },
  { match: 'tefasir', color: '#a855f7' },             // Soft Purple
  { match: 'safvet', color: '#a855f7' },
  { match: 'son inci', color: '#f43f5e' },            // Soft Coral Rose
  { match: 'mesneviden', color: '#14b8a6' },          // Soft Teal
  { match: 'ulu cami', color: '#3b82f6' },            // Soft Blue
  { match: 'riyaz', color: '#84cc16' },               // Soft Olive/Lime
  { match: 'kısas-ı enbiya', color: '#3b82f6' },      // Soft Blue
  { match: 'kisas-i enbiya', color: '#3b82f6' },
  { match: 'çerçeve', color: '#6366f1' },             // Soft Indigo
  { match: 'cerceve', color: '#6366f1' },
  { match: 'hasbihal', color: '#d946ef' },            // Soft Orchid
  { match: 'hacegan', color: '#14b8a6' },             // Soft Teal
  { match: 'hatm-i şerif', color: '#10b981' },        // Soft Emerald
  { match: 'mukabele', color: '#059669' }             // Soft Mint
];

/**
 * Her programa kendi adına göre benzersiz ve tutarlı bir renk döndürür.
 * Aynı program haftanın hangi gününde olursa olsun aynı renkte görünür;
 * farklı programlar birbirinden net biçimde ayrılır.
 */
export function getProgramColor(progOrTitle) {
  if (!progOrTitle) return '#2563eb';

  if (typeof progOrTitle === 'object') {
    if (progOrTitle.isKisaSlot) return '#0891b2';
    const isLive = Boolean(
      progOrTitle.isLive ||
      (Array.isArray(progOrTitle.selectedOptions) && progOrTitle.selectedOptions.includes('Canlı')) ||
      /\bcanl[ıi]\b/i.test(`${progOrTitle.rawTitle || ''} ${progOrTitle.title || ''} ${progOrTitle.host || ''}`)
    );
    if (isLive) return '#e11d48';
    if (progOrTitle.programColor) return progOrTitle.programColor;
  }

  const rawTitle = typeof progOrTitle === 'string'
    ? progOrTitle
    : (progOrTitle.title || progOrTitle.name || progOrTitle.rawTitle || '');

  const normalized = String(rawTitle)
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return '#2563eb';

  for (const item of NAMED_PROGRAM_COLORS) {
    if (normalized.includes(item.match)) {
      return item.color;
    }
  }

  // Diğer tüm programlar için isimden deterministik renk seçimi
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % PROGRAM_COLOR_PALETTE.length;
  return PROGRAM_COLOR_PALETTE[idx];
}

export const DURATION_PRESETS = [
  { min: 15, label: '15 dk' },
  { min: 30, label: '30 dk' },
  { min: 45, label: '45 dk' },
  { min: 60, label: '60 dk' },
  { min: 90, label: '90 dk' },
  { min: 120, label: '120 dk' }
];

// 48 Standart 30 Dakikalık Zaman Dilimleri
export const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const m = i * 30;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
});
