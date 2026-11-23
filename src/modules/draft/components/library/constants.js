/**
 * @file constants.js
 * @description Taslak Planlama, Yayın Planlama ve Liste Kontrol ortak Kategori & Program Rengi çözümleyicisi.
 * Kurumsal 2026 kuralı: Program kutusu rengi satırda saklanan eski renkten değil,
 * her zaman kategorisine göre temadan (tokens.json -> renk.kategori) okunur.
 */

import useThemeStore from '../../../../store/themeStore';

export const CATEGORY_COLORS = {
  'Kadın': '#C56D3B',
  'Haber': '#142A44',
  'Tanıtım': '#0C617C',
  'Dini': '#468625',
  'Dini / İlim': '#468625',
  'Çocuk': '#70AC42',
  'Çocuk / Gençlik': '#70AC42',
  'Reklam': '#E8B44C',
  'Jenerik': '#0A101D',
  'Jenerik / İntro': '#0A101D',
  'Kültürel': '#ED891E',
  'Kültür / Tarih': '#ED891E',
  'Kültürel / Tarih': '#ED891E',
  'Sohbet': '#058193',
  'Detay': '#058193',
  'Sohbet / Detay': '#058193',
  'Sohbet / Tasavvuf': '#058193',
  'Kısa Program': '#109AAD',
  'Kısa Program / Dolgu': '#109AAD',
  'Dolgu Kuşağı': '#109AAD',
  'Ham': '#5B5F66',
  'Programlar': '#0C617C'
};

// Bilinen program başlıklarından kategori ID çözümlemesi (1..11)
const PROGRAM_TITLE_CATEGORY_MAP = [
  { match: 'hasbihal', catId: 9 },
  { match: 'semerkand sohbetleri', catId: 9 },
  { match: 'hacegan', catId: 9 },
  { match: 'büşra', catId: 9 },
  { match: 'busra', catId: 9 },
  { match: 'akaid', catId: 9 },
  { match: 'kısas-ı enbiya', catId: 8 },
  { match: 'kisas-i enbiya', catId: 8 },
  { match: 'kisasi_enbiya', catId: 8 },
  { match: 'beş vakit bir şehir', catId: 8 },
  { match: 'bes vakit bir sehir', catId: 8 },
  { match: '5vakit1sehir', catId: 8 },
  { match: '5v_1s', catId: 8 },
  { match: 'hattın izinde', catId: 8 },
  { match: 'hattin izinde', catId: 8 },
  { match: 'hattin_izinde', catId: 8 },
  { match: 'yüzyılın alimleri', catId: 8 },
  { match: 'yuzyilin alimleri', catId: 8 },
  { match: 'bedesten', catId: 8 },
  { match: 'aziz istanbul', catId: 8 },
  { match: 'çerçeve', catId: 8 },
  { match: 'cerceve', catId: 8 },
  { match: 'güzergah', catId: 8 },
  { match: 'guzergah', catId: 8 },
  { match: 'ulu cami', catId: 8 },
  { match: 'neşeli petek', catId: 5 },
  { match: 'neseli petek', catId: 5 },
  { match: 'neseli_petek', catId: 5 },
  { match: 'dolgu kuşağı', catId: 10 },
  { match: 'dolgu kusagi', catId: 10 },
  { match: 'ilahiler', catId: 10 },
  { match: 'kaside', catId: 10 },
  { match: 'hicri_aylar', catId: 10 },
  { match: 'hicri aylar', catId: 10 },
  { match: 'esmai_kuran', catId: 10 },
  { match: 'sehirler_', catId: 10 },
  { match: 'semerkand_intro', catId: 7 },
  { match: 'jenerik', catId: 7 },
  { match: 'tecvid', catId: 4 },
  { match: 'ilim dersleri', catId: 4 },
  { match: 'i_dersleri', catId: 4 },
  { match: 'son inci', catId: 4 },
  { match: 's_inci', catId: 4 },
  { match: 'delail', catId: 4 },
  { match: 'hatm-i şerif', catId: 4 },
  { match: 'hatmi şerif', catId: 4 },
  { match: 'hatmiserif', catId: 4 },
  { match: 'mukabele', catId: 4 },
  { match: 'mevakib', catId: 4 },
  { match: 'kuduri', catId: 4 },
  { match: 'minhac', catId: 4 },
  { match: 'riyaz', catId: 4 },
  { match: 'safvet', catId: 4 },
  { match: 'tefasir', catId: 4 },
  { match: 'yakut', catId: 4 },
  { match: 'mesnevi', catId: 4 }
];

export function resolveCategoryId(categoryNameOrProg) {
  let categoryName = '';
  let title = '';
  let explicitCatId = null;

  if (typeof categoryNameOrProg === 'object' && categoryNameOrProg !== null) {
    if (categoryNameOrProg.isKisaSlot || categoryNameOrProg.type === 'filler_slot') return 10;
    if (categoryNameOrProg.isIntroClip || categoryNameOrProg.unitType === 'intro') return 7;
    if (categoryNameOrProg.isAdClip || categoryNameOrProg.type === 'ad_break' || categoryNameOrProg.type === 'ad_spot') return 6;
    explicitCatId = Number(categoryNameOrProg.categoryId || categoryNameOrProg.mamCategoryId);
    categoryName = categoryNameOrProg.category || categoryNameOrProg.categoryName || '';
    title = categoryNameOrProg.title || categoryNameOrProg.name || categoryNameOrProg.clipName || categoryNameOrProg.rawTitle || '';
  } else {
    categoryName = String(categoryNameOrProg || '');
  }

  if (explicitCatId && explicitCatId >= 1 && explicitCatId <= 11) {
    return explicitCatId;
  }

  const normTitle = String(title).toLocaleLowerCase('tr');
  if (normTitle) {
    for (const rule of PROGRAM_TITLE_CATEGORY_MAP) {
      if (normTitle.includes(rule.match)) {
        return rule.catId;
      }
    }
  }

  const raw = String(categoryName).toLocaleLowerCase('tr');
  if (raw.includes('sohbet') || raw.includes('tasavvuf') || raw.includes('detay')) return 9;
  if (raw.includes('dini') || raw.includes('ilim')) return 4;
  if (raw.includes('kültür') || raw.includes('kultur') || raw.includes('tarih')) return 8;
  if (raw.includes('çocuk') || raw.includes('cocuk') || raw.includes('genç') || raw.includes('genc')) return 5;
  if (raw.includes('kısa') || raw.includes('kisa') || raw.includes('dolgu')) return 10;
  if (raw.includes('kadın') || raw.includes('kadin') || raw.includes('aile')) return 1;
  if (raw.includes('haber')) return 2;
  if (raw.includes('tanıtım') || raw.includes('tanitim')) return 3;
  if (raw.includes('jenerik') || raw.includes('intro')) return 7;
  if (raw.includes('reklam')) return 6;
  if (raw.includes('ham')) return 11;

  // Eğer sadece program adı string olarak gönderildiyse
  const normRaw = String(categoryNameOrProg || '').toLocaleLowerCase('tr');
  for (const rule of PROGRAM_TITLE_CATEGORY_MAP) {
    if (normRaw.includes(rule.match)) {
      return rule.catId;
    }
  }

  return 4; // Varsayılan Dini / İlim (#468625)
}

/**
 * Temadaki kategori kutu/şerit rengini döndürür.
 */
export function getCategoryColor(categoryNameOrProg) {
  const customCats = useThemeStore.getState()?.config?.categoryColors || {};
  const catId = resolveCategoryId(categoryNameOrProg);
  return customCats[catId]?.color || '#468625';
}

/**
 * Temadaki kategori başlık yazı rengini (`titleTextColor`) döndürür.
 */
export function getCategoryTitleTextColor(categoryNameOrProg) {
  const customCats = useThemeStore.getState()?.config?.categoryColors || {};
  const catId = resolveCategoryId(categoryNameOrProg);
  return customCats[catId]?.titleTextColor || customCats[catId]?.color || '#3C721F';
}

export const PROGRAM_COLOR_PALETTE = [
  '#468625',
  '#058193',
  '#ED891E',
  '#70AC42',
  '#109AAD',
  '#142A44',
  '#0C617C',
  '#C56D3B',
  '#E8B44C',
  '#0A101D',
  '#5B5F66'
];

/**
 * Her programa kategorisine göre temadaki kurumsal kutu rengini döndürür.
 * Taslak, Ready ve Kontrol'de aynı program aynı kategori renginde görünür.
 */
export function getProgramColor(progOrTitle) {
  if (!progOrTitle) return '#0C617C';

  const themeConfig = useThemeStore.getState()?.config;
  const sp = themeConfig?.specialColors || {};
  const customCats = themeConfig?.categoryColors || {};

  if (typeof progOrTitle === 'object') {
    if (progOrTitle.isKisaSlot || progOrTitle.type === 'filler_slot') {
      return sp.fillerSlotColor || customCats[10]?.color || '#109AAD';
    }
    const isLive = Boolean(
      progOrTitle.isLive ||
      (Array.isArray(progOrTitle.selectedOptions) && progOrTitle.selectedOptions.includes('Canlı')) ||
      /\bcanl[ıi]\b/i.test(`${progOrTitle.rawTitle || ''} ${progOrTitle.title || ''} ${progOrTitle.host || ''}`)
    );
    if (isLive) {
      return sp.liveColor || '#DD1C40';
    }
  }

  return getCategoryColor(progOrTitle);
}

export const DURATION_PRESETS = [
  { min: 15, label: '15 dk' },
  { min: 30, label: '30 dk' },
  { min: 45, label: '45 dk' },
  { min: 60, label: '60 dk' },
  { min: 90, label: '90 dk' },
  { min: 120, label: '120 dk' }
];

export const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const m = i * 30;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
});
