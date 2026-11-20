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

/**
 * Ramazan Özel Rezervasyon & Sponsorluk Hedef Program Seçenekleri
 */
export const RAMADAN_TARGET_OPTIONS = [
  {
    id: 'sahur',
    label: '🌙 Ramazan Sahur Programı',
    shortLabel: '🌙 Sahur Programı',
    desc: 'Sahur programının başlangıç saatine göre Öncesi, Arası ve Sonrası reklam kuşakları',
    color: '#0284c7',
    bg: 'rgba(2, 132, 199, 0.14)'
  },
  {
    id: 'iftar',
    label: '🕌 Ramazan İftar Programı',
    shortLabel: '🕌 İftar Programı',
    desc: 'İftar programının başlangıç saatine göre Öncesi, Arası ve Sonrası reklam kuşakları',
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.14)'
  },
  {
    id: 'both',
    label: '🌙+🕌 Hem Sahur Hem İftar Programları',
    shortLabel: '🌙+🕌 Sahur & İftar',
    desc: 'Günün hem Sahur hem de İftar programı kuşaklarında yayınlanır',
    color: '#059669',
    bg: 'rgba(5, 150, 105, 0.14)'
  }
];

/**
 * Reklam Kuşakları için Ramazan Özel İşaretleme Etiketleri
 */
export const RAMADAN_BREAK_TAGS = [
  { value: '', label: 'Standart Kuşak', shortLabel: 'Standart', color: '#64748b' },
  { value: 'sahur_before', label: '🌙 Ramazan Sahur Öncesi Kuşağı', shortLabel: '🌙 Sahur Öncesi', target: 'sahur', pos: 'before', color: '#0284c7' },
  { value: 'sahur_middle', label: '🌙 Ramazan Sahur Arası Kuşağı', shortLabel: '🌙 Sahur Arası', target: 'sahur', pos: 'middle', color: '#0369a1' },
  { value: 'sahur_after', label: '🌙 Ramazan Sahur Sonrası Kuşağı', shortLabel: '🌙 Sahur Sonrası', target: 'sahur', pos: 'after', color: '#075985' },
  { value: 'iftar_before', label: '🕌 Ramazan İftar Öncesi Kuşağı', shortLabel: '🕌 İftar Öncesi', target: 'iftar', pos: 'before', color: '#d97706' },
  { value: 'iftar_middle', label: '🕌 Ramazan İftar Arası Kuşağı', shortLabel: '🕌 İftar Arası', target: 'iftar', pos: 'middle', color: '#b45309' },
  { value: 'iftar_after', label: '🕌 Ramazan İftar Sonrası Kuşağı', shortLabel: '🕌 İftar Sonrası', target: 'iftar', pos: 'after', color: '#92400e' }
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

/**
 * Admin Panelde girilen Ramazan başlangıç (`startDate`) ve bitiş (`endDate`) tarihine göre
 * seçili günün (veya bugünün) "Ramazan Özel" penceresinde olup olmadığını kontrol eder.
 *
 * KURAL:
 * - Admin panelde Ramazan Başlangıç ve Bitiş tarihi girilmemişse veya `enabled === false` ise: `false` (Görünmez).
 * - Ramazan başlangıç tarihinden `leadDays` (varsayılan 14 gün = 2 hafta) öncesinden başlayıp
 *   Ramazan bitiş tarihine kadar: `true` (Görünür).
 * - `forceShow` açıksa test/ön hazırlık için her zaman `true` döner.
 */
export const isRamadanFeatureWindowOpen = (ramadanConfig = null, referenceDateStr = null) => {
  const cfg = ramadanConfig;
  if (!cfg || !cfg.enabled) return false;
  if (cfg.forceShow) return true;
  if (!cfg.startDate || !cfg.endDate) return false;

  const start = new Date(`${cfg.startDate}T00:00:00`);
  const end = new Date(`${cfg.endDate}T23:59:59`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  const leadDays = Number(cfg.leadDays) > 0 ? Number(cfg.leadDays) : 14;
  const openWindowStart = new Date(start.getTime() - leadDays * 24 * 60 * 60 * 1000);

  const checkDates = [];
  if (referenceDateStr && typeof referenceDateStr === 'string' && referenceDateStr.length >= 10) {
    const refD = new Date(`${referenceDateStr.slice(0, 10)}T12:00:00`);
    if (!Number.isNaN(refD.getTime())) checkDates.push(refD);
  }
  checkDates.push(new Date());

  return checkDates.some(d => d >= openWindowStart && d <= end);
};

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
  isRamadanSpecial: Boolean(defaults.isRamadanSpecial),
  ramadanTarget: defaults.ramadanTarget || 'iftar', // 'sahur' | 'iftar' | 'both'
  ramadanPositions:
    Array.isArray(defaults.ramadanPositions) && defaults.ramadanPositions.length > 0
      ? [...defaults.ramadanPositions]
      : ['before', 'middle', 'after'],
  allowQuotaOverflow: Boolean(defaults.allowQuotaOverflow),
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

/**
 * İki ISO tarih (`YYYY-MM-DD`) arasındaki toplam gün sayısını (dahil) hesaplar.
 */
export const calculateInclusiveDays = (startDate, endDate) => {
  if (!startDate || !endDate) return 1;
  const s = new Date(`${startDate}T00:00:00`);
  const e = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 1;
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diff);
};

/**
 * Bir rezervasyon veya klip satırı için Spot, Gün Süresi ve Fiyat/Bütçe aşım (`-` eksi fark) bilgilerini hesaplar.
 * Aşım olduğunda negatif (`-`) değerlerle ne kadar eksiye / aşıma gidildiğini döndürür.
 */
export const calculateItemOverageMetrics = (item, realizedSpotsInput = null, ramadanConfig = null) => {
  const pricing = calculateRowPricing(item);
  const plannedSpots = Math.max(0, Number(pricing.effectiveSpots ?? item.plannedSpots ?? item.totalPlannedSpots) || 0);
  const realizedSpots = realizedSpotsInput !== null && realizedSpotsInput !== undefined
    ? Math.max(0, Number(realizedSpotsInput) || 0)
    : Math.max(0, Number(item.realizedSpots) || 0);

  const dailyMin = Math.max(0, Number(item.dailyMinSpots) || 0);
  const dailyMax = Math.max(1, Number(item.dailyMaxSpots) || 4);
  const totalDays = calculateInclusiveDays(item.startDate, item.endDate);
  const minRequiredSpotsForDays = dailyMin * totalDays;

  // 1. Spot Sayısı Farkı (Eksi değer = Aşım)
  // Hem gerçekleşen spot > planlanan spot, hem de (gün × günlük min spot) > planlanan spot kontrolü
  const realizedOverPlanned = Math.max(0, realizedSpots - plannedSpots);
  const minRequiredOverPlanned = Math.max(0, minRequiredSpotsForDays - plannedSpots);
  const spotOverageCount = Math.max(realizedOverPlanned, Number(item.overageSpots) || 0);
  const spotNegativeBalance = spotOverageCount > 0 ? -spotOverageCount : (minRequiredOverPlanned > 0 ? -minRequiredOverPlanned : 0);

  // 2. Gün Süresi Farkı (Eksi değer = Gün Aşımı)
  // a) Günlük maks spot ile bile ya da planlanan spotun yettiği gün sayısından fazla gün seçilmişse
  // b) Veya Ramazan Özel seçilmiş ve tarih aralığı Ramazan ayı dışına taşmışsa
  let outOfRamadanDays = 0;
  if (item.isRamadanSpecial && ramadanConfig?.startDate && ramadanConfig?.endDate && item.startDate && item.endDate) {
    const rStart = new Date(`${ramadanConfig.startDate}T00:00:00`);
    const rEnd = new Date(`${ramadanConfig.endDate}T00:00:00`);
    const iStart = new Date(`${item.startDate}T00:00:00`);
    const iEnd = new Date(`${item.endDate}T00:00:00`);
    if (!Number.isNaN(rStart.getTime()) && !Number.isNaN(rEnd.getTime())) {
      if (iStart < rStart) {
        outOfRamadanDays += Math.max(0, Math.round((rStart - iStart) / (1000 * 60 * 60 * 24)));
      }
      if (iEnd > rEnd) {
        outOfRamadanDays += Math.max(0, Math.round((iEnd - rEnd) / (1000 * 60 * 60 * 24)));
      }
    }
  }
  const maxSupportedDaysByMin = dailyMin > 0 && plannedSpots > 0 ? Math.floor(plannedSpots / dailyMin) : totalDays;
  const daysExceedingQuota = dailyMin > 0 && totalDays > maxSupportedDaysByMin ? (totalDays - maxSupportedDaysByMin) : 0;
  const dayOverageCount = Math.max(outOfRamadanDays, daysExceedingQuota, Number(item.overageDays) || 0);
  const dayNegativeBalance = dayOverageCount > 0 ? -dayOverageCount : 0;

  // 3. Fiyat / Bütçe Farkı (Eksi değer = Bütçe Aşımı)
  const spotPrice = Math.max(0, Number(pricing.effectiveSpotPrice ?? item.spotPrice) || 0);
  const plannedBudget = Math.max(0, Number(pricing.effectiveTotalBudget ?? item.totalBudget) || 0);
  const effectiveSpotCountForCost = Math.max(realizedSpots, plannedSpots + minRequiredOverPlanned);
  const actualCost = spotPrice > 0 ? Math.round(effectiveSpotCountForCost * spotPrice * 100) / 100 : 0;
  const rawBudgetOverage = (spotPrice > 0 && plannedBudget > 0 && actualCost > plannedBudget)
    ? Math.round((actualCost - plannedBudget) * 100) / 100
    : (spotPrice > 0 && spotOverageCount > 0 ? Math.round(spotOverageCount * spotPrice * 100) / 100 : 0);
  const budgetOverageAmount = Math.max(rawBudgetOverage, Number(item.overageBudget) || 0);
  const budgetNegativeBalance = budgetOverageAmount > 0 ? -budgetOverageAmount : 0;

  const hasAnyOverage = spotNegativeBalance < 0 || dayNegativeBalance < 0 || budgetNegativeBalance < 0;

  return {
    totalDays,
    plannedSpots,
    realizedSpots,
    minRequiredSpotsForDays,
    spotNegativeBalance,     // Ör: -6 (6 Spot Aşım)
    dayNegativeBalance,      // Ör: -3 (3 Gün Aşım)
    budgetNegativeBalance,   // Ör: -1500 (1.500 ₺ Bütçe Aşımı)
    outOfRamadanDays,
    daysExceedingQuota,
    hasAnyOverage
  };
};
