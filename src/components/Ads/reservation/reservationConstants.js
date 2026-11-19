/**
 * @file src/components/Ads/reservation/reservationConstants.js
 * @description Reklam Rezervasyonu & Program Sponsorluğu Formu için Sabitler, Rol Tanımları ve Hesaplama Yardımcıları.
 *
 * Bu modül aşağıdaki yapıları içerir:
 * 1. `SPONSOR_FLOW_POSITIONS`: 1. Kısım Standart Program Sponsorluğu konumları (`before`, `middle`, `after` — Çoklu Olabilir).
 * 2. `SPONSOR_BUMPER_ROLES`: 2. Kısım Özel Sunum & Geçiş Sponsorlukları (`presents` Sunar, `to_be_continued` Devam Edecek,
 *    `continues` Devam Ediyor, `presented` Sundu — Program Başına Tekil & İlk/Son Sıra Kilitli).
 * 3. `PRIORITY_OPTIONS` ve `PRICING_MODES`: Öncelik seviyeleri (1000, 700, 400, 100) ve 3'lü esnek fiyatlandırma modları.
 * 4. `createEmptyProductPlan`, `calculateRowPricing`, `getFullMaterialDisplayName`, `getBlockTheme`:
 *    Yeni klip kartı şablonu oluşturma ve birim ücret / bütçe / spot adedi hesaplama fonksiyonları.
 */
import React from 'react';
import {
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Hash,
  Calculator,
  Wallet
} from 'lucide-react';

/**
 * 1. Kısım: Standart Program Sponsorluğu Konumları (Çoklu Olabilir)
 */
export const SPONSOR_FLOW_POSITIONS = [
  {
    id: 'before',
    label: 'Program Öncesi',
    shortLabel: 'Program Öncesi',
    positionBadge: 'Programdan Önceki Son Kuşak • Çoklu Olabilir',
    desc: 'Program girmeden yayınlanan son reklam kuşağına reklam eklenir.',
    color: '#0066ff',
    bg: 'rgba(0, 102, 255, 0.12)',
    isSingular: false
  },
  {
    id: 'middle',
    label: 'Program Arası',
    shortLabel: 'Program Arası',
    positionBadge: 'Partlar Arası Mevcut Kuşak(lar) • Çoklu Olabilir',
    desc: 'Program partlar şeklinde ise part bitiminde ve diğer part aralığında mevcut olan reklam kuşağına veya kuşaklarına reklam girilir.',
    color: '#9333ea',
    bg: 'rgba(147, 51, 234, 0.12)',
    isSingular: false
  },
  {
    id: 'after',
    label: 'Program Sonrası',
    shortLabel: 'Program Sonrası',
    positionBadge: 'Son Part Bitişi İlk Kuşak • Çoklu Olabilir',
    desc: 'Program veya programın son partı bitimindeki ilk reklam kuşağında reklam yayınlanır.',
    color: '#0d9488',
    bg: 'rgba(13, 148, 136, 0.12)',
    isSingular: false
  }
];

/**
 * 2. Kısım: Özel Sunum & Geçiş Sponsorlukları (Tekil & İlk/Son Sıra Kilitli)
 */
export const SPONSOR_BUMPER_ROLES = [
  {
    id: 'presents',
    label: 'Program Öncesi (Sunar)',
    shortLabel: 'Program Öncesi (Sunar)',
    positionBadge: 'Programdan Önceki Son Kuşak • EN SON REKLAM (Tekil)',
    desc: 'Program girmeden yayınlanan son reklam kuşağının en son reklamı olarak girer.',
    color: '#e11d48',
    bg: 'rgba(225, 29, 72, 0.12)',
    isSingular: true,
    lockOrder: 'last'
  },
  {
    id: 'to_be_continued',
    label: 'Program Arası (Devam Edecek)',
    shortLabel: 'Program Arası (Devam Edecek)',
    positionBadge: 'Part Bitişi İlk Kuşak • İLK REKLAM (Son Part Hariç Tüm Partlar)',
    desc: 'Programın veya program partının bitişindeki ilk reklam kuşağının ilk reklamı olur. Birden fazla part olabilir, son part hariç hepsi için geçerlidir (Part 1 → İlk Klip, Part 2 → İlk Klip...).',
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.12)',
    isSingular: true,
    lockOrder: 'first'
  },
  {
    id: 'continues',
    label: 'Program Arası (Devam Ediyor)',
    shortLabel: 'Program Arası (Devam Ediyor)',
    positionBadge: 'Diğer Parta Geçilen Son Kuşak • SON KLİP (1→2, 2→3, 3→4...)',
    desc: 'Program veya program partlarının öncesinde yani part aralarında (1\'den 2\'ye, 2\'den 3\'e, 3\'ten 4\'e geçerken) bir part bitiminden diğer parta geçerken girilen son reklam kuşağının son klibi olarak girer.',
    color: '#2563eb',
    bg: 'rgba(37, 99, 235, 0.12)',
    isSingular: true,
    lockOrder: 'last'
  },
  {
    id: 'presented',
    label: 'Program Sonrası (Sundu)',
    shortLabel: 'Program Sonrası (Sundu)',
    positionBadge: 'Son Part Bitişi İlk Kuşak • İLK KLİP (Tekil)',
    desc: 'Program veya partların bitiminde, son partın bitiminden hemen sonra girecek olan ilk reklam kuşağının ilk klibi olarak girer.',
    color: '#059669',
    bg: 'rgba(5, 150, 105, 0.12)',
    isSingular: true,
    lockOrder: 'first'
  }
];

export const SINGULAR_BUMPER_ROLE_IDS = SPONSOR_BUMPER_ROLES.map(r => r.id);

export const SPONSOR_POSITIONS = [
  ...SPONSOR_FLOW_POSITIONS,
  ...SPONSOR_BUMPER_ROLES
];

export const FALLBACK_BROADCAST_PROGRAMS = [
  { id: 'prog-1', title: 'İlim Dersleri- Tecvid', categoryId: 4, categoryName: 'Dini', totalClips: 190, totalEpisodes: 131 },
  { id: 'prog-2', title: 'Çerçeve', categoryId: 8, categoryName: 'Kültürel', totalClips: 84, totalEpisodes: 42 },
  { id: 'prog-3', title: 'Semerkand Sohbetleri', categoryId: 4, categoryName: 'Dini', totalClips: 160, totalEpisodes: 80 },
  { id: 'prog-4', title: 'Siyer-i Nebi', categoryId: 4, categoryName: 'Dini', totalClips: 110, totalEpisodes: 55 },
  { id: 'prog-5', title: '40 Hadis', categoryId: 4, categoryName: 'Dini', totalClips: 80, totalEpisodes: 40 },
  { id: 'prog-6', title: 'Saliha Hanımlar', categoryId: 1, categoryName: 'Kadın', totalClips: 96, totalEpisodes: 48 },
  { id: 'prog-7', title: 'Huzur Pınarı', categoryId: 4, categoryName: 'Dini', totalClips: 120, totalEpisodes: 60 },
  { id: 'prog-8', title: 'Aile Saadeti', categoryId: 1, categoryName: 'Kadın', totalClips: 72, totalEpisodes: 36 },
  { id: 'prog-9', title: 'Mavera', categoryId: 8, categoryName: 'Kültürel', totalClips: 64, totalEpisodes: 32 },
  { id: 'prog-10', title: 'Ana Haber Bülteni', categoryId: 2, categoryName: 'Haber', totalClips: 365, totalEpisodes: 365 }
];

export const PRIORITY_OPTIONS = [
  { value: '1000', label: 'Zorunlu', desc: 'Kesin yayın garantili', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)' },
  { value: '700', label: 'Yüksek', desc: 'Öncelikli yerleşim', color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)' },
  { value: '400', label: 'Normal', desc: 'Standart sıra', color: '#0066ff', bg: 'rgba(0, 102, 255, 0.12)' },
  { value: '100', label: 'Dolgu', desc: 'Boşluk doldurma', color: '#9333ea', bg: 'rgba(147, 51, 234, 0.12)' }
];

export const PRICING_MODES = [
  {
    id: 'spots_only',
    label: 'Sadece Spot Adedi',
    shortDesc: 'Ücret girilmeden',
    icon: Hash
  },
  {
    id: 'by_spot_price',
    label: 'Spot Ücreti İle',
    shortDesc: 'Spot × Birim Ücret = Toplam',
    icon: Calculator
  },
  {
    id: 'by_total_budget',
    label: 'Toplam Tutar İle',
    shortDesc: 'Toplam Bütçe ÷ Spot Ücreti = Spot',
    icon: Wallet
  }
];

/**
 * Bir materyal nesnesinin tam klip ismini (hem temiz başlığını hem de orijinal klip adını) döndürür.
 */
export const getFullMaterialDisplayName = (mat) => {
  if (!mat) return '-';
  const cleanName = String(mat.name || '').trim();
  const rawClip = String(mat.clipName || mat.fileName || '').trim();
  if (rawClip && rawClip.toLocaleLowerCase('tr-TR') !== cleanName.toLocaleLowerCase('tr-TR')) {
    return `${cleanName} — [${rawClip}]`;
  }
  return rawClip || cleanName || 'İsimsiz Klip';
};

/**
 * Yayın kuşağı adına göre görsel ikon ve renk temasını döndürür.
 */
export const getBlockTheme = (tbName = '') => {
  const lower = tbName.toLocaleLowerCase('tr-TR');
  if (lower.includes('sabah')) {
    return {
      icon: React.createElement(Sunrise, { size: 16, color: '#d97706' }),
      accent: '#d97706',
      softBg: 'rgba(245, 158, 11, 0.12)',
      badge: 'Gündüz Başlangıcı'
    };
  }
  if (lower.includes('öğle') || lower.includes('ogle')) {
    return {
      icon: React.createElement(Sun, { size: 16, color: '#0284c7' }),
      accent: '#0284c7',
      softBg: 'rgba(2, 132, 199, 0.12)',
      badge: 'Gün Ortası Kuşağı'
    };
  }
  if (lower.includes('akşam') || lower.includes('aksam') || lower.includes('prime')) {
    return {
      icon: React.createElement(Sunset, { size: 16, color: '#ea580c' }),
      accent: '#ea580c',
      softBg: 'rgba(234, 88, 12, 0.12)',
      badge: 'En Yüksek İzlenme'
    };
  }
  return {
    icon: React.createElement(Moon, { size: 16, color: '#6366f1' }),
    accent: '#6366f1',
    softBg: 'rgba(99, 102, 241, 0.12)',
    badge: 'Gece Yayını'
  };
};

export const getTodayIso = () => new Date().toISOString().split('T')[0];

export const getPlusDaysIso = (days = 6) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

/**
 * Bağımsız bir reklam / klip planı satırı oluşturur.
 */
export const createEmptyProductPlan = (companyId = '', defaults = {}) => ({
  id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  companyId: companyId || '',
  productId: defaults.productId || '',
  materialId: defaults.materialId || '',
  priority: String(defaults.priority || '700'),
  startDate: defaults.startDate || getTodayIso(),
  endDate: defaults.endDate || getPlusDaysIso(6),
  pricingMode: defaults.pricingMode || 'spots_only', // 'spots_only' | 'by_spot_price' | 'by_total_budget'
  plannedSpots: defaults.plannedSpots !== undefined ? defaults.plannedSpots : 20,
  dailyMinSpots: defaults.dailyMinSpots !== undefined ? defaults.dailyMinSpots : 1,
  dailyMaxSpots: defaults.dailyMaxSpots !== undefined ? defaults.dailyMaxSpots : 4,
  spotPrice: defaults.spotPrice !== undefined ? defaults.spotPrice : '',
  totalBudget: defaults.totalBudget !== undefined ? defaults.totalBudget : '',
  channelIds: Array.isArray(defaults.channelIds) && defaults.channelIds.length > 0 ? [...defaults.channelIds] : ['ch_hd'],
  timeBlockIds: Array.isArray(defaults.timeBlockIds) && defaults.timeBlockIds.length > 0 ? [...defaults.timeBlockIds] : ['tb-2', 'tb-3'],
  isSponsor: Boolean(defaults.isSponsor),
  sponsorProgramId: defaults.sponsorProgramId || '',
  sponsorProgramTitle: defaults.sponsorProgramTitle || '',
  sponsorPositions:
    Array.isArray(defaults.sponsorPositions) && defaults.sponsorPositions.length > 0
      ? [...defaults.sponsorPositions]
      : ['before', 'after'],
  programSearch: ''
});

/**
 * Ürün satırının seçili fiyat moduna göre efektif spot sayısını ve toplam tutarını hesaplar.
 */
export const calculateRowPricing = (item) => {
  const mode = item.pricingMode || 'spots_only';
  const rawSpots = Math.max(0, Number(item.plannedSpots) || 0);
  const rawSpotPrice = Math.max(0, Number(item.spotPrice) || 0);
  const rawTotalBudget = Math.max(0, Number(item.totalBudget) || 0);

  if (mode === 'by_spot_price') {
    const computedTotal = Math.round(rawSpots * rawSpotPrice * 100) / 100;
    return {
      effectiveSpots: rawSpots,
      effectiveSpotPrice: rawSpotPrice,
      effectiveTotalBudget: computedTotal
    };
  }

  if (mode === 'by_total_budget') {
    const computedSpots = rawSpotPrice > 0 ? Math.floor(rawTotalBudget / rawSpotPrice) : rawSpots;
    return {
      effectiveSpots: computedSpots,
      effectiveSpotPrice: rawSpotPrice,
      effectiveTotalBudget: rawTotalBudget
    };
  }

  return {
    effectiveSpots: rawSpots,
    effectiveSpotPrice: 0,
    effectiveTotalBudget: 0
  };
};
