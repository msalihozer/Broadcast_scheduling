/**
 * @file src/components/Ads/dashboard/dashboardAnalyticsEngine.js
 * @description Reklam & Rezervasyon Modülü 8 Bölümlü Operasyonel Dashboard Analitik ve Tahminleme Motoru.
 *
 * Bu modül tüm Dashboard bileşenlerinin filtrelere (Platform/Kanal, Dönem: Bugün / 7 Gün / 30 Gün / 3 Ay / 1 Yıl,
 * Rezervasyon Durumu: Onay Bekleyen / Aktif / İptal / Biten / Makegood, Sektör ve Arama) bağlı olarak
 * gerçek zamanlı hesaplanmasını sağlar:
 *
 * 1. Rezervasyon Özeti (Toplam, Aktif, Bekleyen, İptal Edilen, Tamamlanan)
 * 2. Kampanya Yönetimi (Aktif kampanyalar, Başlayacak ve Bitecek kampanyalar)
 * 3. Yayın Performansı & Makegood (Planlanan spot, Yayınlanan spot, Eksik yayın, Telafi/Makegood adedi, Gerçekleşme oranı)
 * 4. Gelir Analizi & Tahmini (Planlanan gelir, Gerçekleşen gelir, Tahsilat, Kalan alacak, Kesinleşmiş 7/15/30 gün gelir tahmini)
 * 5. Reklam Envanteri & 7/15/30 Gün Doluluk Tahmini (Boş kuşaklar, Doluluk oranı, Kalan kapasite, 7-15-30 gün projeksiyonu)
 * 6. Firma, Ürün ve Sektör Analizi (En çok reklam veren firmalar, ürünler ve sektörel kırılım)
 * 7. Materyal Kontrolü & Geçerliliği (Eksik, Onay bekleyen, Süresi dolan, Teknik hatalı materyaller)
 * 8. Operasyon, Reklam Çakışması ve Uyarılar (Kapasite aşımı / çakışan rezervasyonlar, yaklaşan yayınlar, eksik yayınlar)
 */

/**
 * Platform / Kanal filtre seçenekleri
 */
export const DASHBOARD_CHANNEL_OPTIONS = [
  { id: 'all', label: 'Tüm Kanallar & Platformlar', shortLabel: 'Tüm Platformlar' },
  { id: 'ch_hd', label: 'Semerkand HD (Uydu / Kablo)', shortLabel: 'Semerkand HD' },
  { id: 'ch_way', label: 'Semerkand WAY (Avrupa / Global)', shortLabel: 'Semerkand WAY' },
  { id: 'digital', label: 'Dijital / Web Canlı Yayın', shortLabel: 'Dijital Stream' }
];

/**
 * Tarih / Dönem filtre seçenekleri
 */
export const DASHBOARD_PERIOD_OPTIONS = [
  { id: 'today', label: 'Bugün', days: 1 },
  { id: '7d', label: '7 Gün', days: 7 },
  { id: '30d', label: '30 Gün', days: 30 },
  { id: '90d', label: '3 Ay', days: 90 },
  { id: '365d', label: '1 Yıl', days: 365 },
  { id: 'all', label: 'Tüm Dönem', days: 3650 }
];

/**
 * Rezervasyon Durumu filtre seçenekleri
 */
export const DASHBOARD_STATUS_OPTIONS = [
  { id: 'all', label: 'Tüm Durumlar', color: '#475569', bg: 'rgba(71, 85, 105, 0.12)' },
  { id: 'active', label: 'Aktif (Yayında)', color: '#059669', bg: 'rgba(16, 185, 129, 0.14)' },
  { id: 'pending', label: 'Onay Bekleyen', color: '#d97706', bg: 'rgba(245, 158, 11, 0.15)' },
  { id: 'makegood', label: 'Telafi (Makegood) Gerekli', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.14)' },
  { id: 'completed', label: 'Tamamlanan (Biten)', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.14)' },
  { id: 'cancelled', label: 'İptal Edilen', color: '#dc2626', bg: 'rgba(239, 68, 68, 0.14)' }
];

/**
 * Materyal Teknik ve Yayın Onay Durumları
 */
export const MATERIAL_VALIDITY_STATUSES = {
  approved: { id: 'approved', label: 'Yayına Uygun (Onaylı)', color: '#059669', bg: 'rgba(16, 185, 129, 0.14)' },
  pending: { id: 'pending', label: 'Onay Bekliyor', color: '#d97706', bg: 'rgba(245, 158, 11, 0.15)' },
  technical_error: { id: 'technical_error', label: 'Teknik Hatalı (Ses/TC)', color: '#dc2626', bg: 'rgba(239, 68, 68, 0.15)' },
  expired: { id: 'expired', label: 'Süresi Dolan', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.14)' },
  missing: { id: 'missing', label: 'Eksik Dosya / Süre', color: '#e11d48', bg: 'rgba(225, 29, 72, 0.14)' }
};

/**
 * Firma veya ürün adına göre sektörü otomatik tahmin eder (eğer açıkça tanımlanmamışsa).
 */
export function inferCompanySector(companyName = '', productName = '') {
  const hay = `${companyName} ${productName}`.toLocaleLowerCase('tr-TR');
  if (/gıda|et|süt|çay|kahve|bal|zeytin|un|şeker|yemek|restoran|su|içecek/.test(hay)) return 'Gıda & İçecek';
  if (/kitap|yayın|dergi|eğitim|okul|kolej|üniversite|akademi|semerkand yayın/.test(hay)) return 'Yayıncılık & Eğitim';
  if (/hastane|sağlık|tıp|diş|optik|ilaç|medikal|klinik|termal/.test(hay)) return 'Sağlık & Medikal';
  if (/dernek|vakıf|yardım|beşir|kızılay|insani|hayır/.test(hay)) return 'STK & İnsani Yardım';
  if (/inşaat|konut|gayrimenkul|yapı|mobilya|dekorasyon|halı|ev/.test(hay)) return 'İnşaat & Mobilya';
  if (/giyim|tekstil|moda|ayakkabı|tesettür|kumaş/.test(hay)) return 'Tekstil & Giyim';
  if (/bank|katılım|finans|sigorta|yatırım|altın|otomotiv|oto/.test(hay)) return 'Finans & Otomotiv';
  if (/turizm|hac|umre|seyahat|otel|tatil|havayol/.test(hay)) return 'Turizm & Hac-Umre';
  if (/teknoloji|bilişim|yazılım|telekom|elektronik|enerji/.test(hay)) return 'Teknoloji & Enerji';
  return 'Kurumsal & Hizmet';
}

/**
 * YYYY-MM-DD tarihini yerel Date nesnesine çevirir.
 */
export function parseLocalIsoDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

/**
 * İki tarih arasındaki gün farkını hesaplar (target - base).
 */
export function diffDaysBetween(targetDateStr, baseDateStr) {
  const t = parseLocalIsoDate(targetDateStr);
  const b = parseLocalIsoDate(baseDateStr);
  if (!t || !b) return 0;
  return Math.round((t.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Bugünün tarihini YYYY-MM-DD formatında döndürür.
 */
export function getTodayIsoStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Bir rezervasyonun durumunu (`active`, `pending`, `completed`, `cancelled`) belirler.
 * Kullanıcı manuel olarak `res.status` atamışsa onu önceliklendirir; yoksa tarih ve gerçekleşme oranından türetir.
 */
export function resolveReservationLifecycleStatus(res, effectiveRealized, totalPlanned, todayStr) {
  if (res.status && ['active', 'pending', 'completed', 'cancelled'].includes(res.status)) {
    return res.status;
  }
  const start = res.startDate || todayStr;
  const end = res.endDate || todayStr;

  if (res.isCancelled) return 'cancelled';
  if (effectiveRealized >= totalPlanned && totalPlanned > 0 && end < todayStr) {
    return 'completed';
  }
  if (start > todayStr) {
    return 'pending';
  }
  if (end < todayStr) {
    return 'completed';
  }
  return 'active';
}

/**
 * Bir materyalin teknik ve yayın geçerlilik durumunu çözümler.
 */
export function resolveMaterialValidity(mat, todayStr) {
  const dur = Number(mat?.duration) || 0;
  const clipName = String(mat?.clipName || mat?.fileName || '').toLocaleLowerCase('tr-TR');

  // Kullanıcı tarafından açıkça atanmış durum varsa
  if (mat?.validityStatus && MATERIAL_VALIDITY_STATUSES[mat.validityStatus]) {
    return mat.validityStatus;
  }

  // Süresi dolmuş mu?
  if (mat?.validUntil && mat.validUntil < todayStr) {
    return 'expired';
  }

  // Teknik hata (bozuk ses, iptal, kullanma notu veya hatalı süre)
  if (
    mat?.technicalStatus === 'error' ||
    /bozuk|hatali|kullanma|iptal|eksik_ses/.test(clipName)
  ) {
    return 'technical_error';
  }

  // Eksik dosya veya süre 0
  if (!mat?.clipId && !mat?.fileName && !mat?.clipName) {
    return 'missing';
  }
  if (dur <= 0) {
    return 'missing';
  }

  // Onay bekliyor mu?
  if (mat?.approvalStatus === 'pending' || mat?.isPendingApproval) {
    return 'pending';
  }

  return 'approved';
}

/**
 * Dashboard'daki tüm 8 bölümü ve 6 özel analitik özelliği filtrelerle uyumlu olarak hesaplar.
 */
export function computeDashboardAnalytics({
  reservations = [],
  companies = [],
  products = [],
  materials = [],
  timeBlocks = [],
  adPlacements = {},
  adsPricingConfig = {},
  filters = {}
}) {
  const {
    channelFilter = 'all',
    periodFilter = '30d',
    statusFilter = 'all',
    sectorFilter = 'all',
    companyFilter = 'all',
    searchQuery = ''
  } = filters;

  const todayStr = getTodayIsoStr();
  const periodObj = DASHBOARD_PERIOD_OPTIONS.find(p => p.id === periodFilter) || DASHBOARD_PERIOD_OPTIONS[2];
  const windowDays = periodObj.days;

  const compMap = new Map((companies || []).map(c => [String(c.id), c]));
  const prodMap = new Map((products || []).map(p => [String(p.id), p]));
  const matMap = new Map((materials || []).map(m => [String(m.id), m]));

  // ---------------------------------------------------------------------------
  // 1. YAYIN YERLEŞİMLERİNİ (adPlacements) TARAMA VE ÇAKIŞMA ANALİZİ
  // ---------------------------------------------------------------------------
  const placementCountByResId = new Map();
  const placementSecByResId = new Map();
  const placementByDay = new Map();
  const blockUsageById = new Map();
  const conflictingBreaks = [];

  // Varsayılan kuşak kapasitesi: Her kuşak (break) için maksimum 360 sn (6 dk) veya 12 spot
  const MAX_BREAK_CAPACITY_SEC = 360;
  const MAX_BREAK_CAPACITY_SPOTS = 12;

  let totalBreaksInPlacements = 0;
  let emptyBreaksInPlacements = 0;
  let totalPlacedSpotsInWindow = 0;
  let totalPlacedSecInWindow = 0;

  Object.entries(adPlacements || {}).forEach(([dayKey, blocks]) => {
    if (!Array.isArray(blocks)) return;
    if (channelFilter !== 'all' && channelFilter !== 'digital' && !dayKey.includes(channelFilter)) {
      return;
    }

    const parts = dayKey.split('-');
    const dateStr = parts.slice(2).join('-') || todayStr;
    const dayDiff = Math.abs(diffDaysBetween(dateStr, todayStr));
    const isWithinPeriod = periodFilter === 'all' ? true : dayDiff <= windowDays;

    blocks.forEach((block, bIdx) => {
      if (isWithinPeriod) {
        totalBreaksInPlacements++;
      }
      const ads = Array.isArray(block.ads) ? block.ads : [];
      if (ads.length === 0) {
        if (isWithinPeriod) emptyBreaksInPlacements++;
      }

      let breakSec = 0;
      const seenMaterialsInBreak = new Set();
      let hasDuplicateMat = false;
      let prevCompanyId = null;
      let hasConsecutiveCompany = false;

      ads.forEach(ad => {
        const dur = Number(ad.duration) || 30;
        breakSec += dur;
        if (ad.isBumperAd) return;

        if (ad.reservationId) {
          const rKey = String(ad.reservationId);
          placementCountByResId.set(rKey, (placementCountByResId.get(rKey) || 0) + 1);
          placementSecByResId.set(rKey, (placementSecByResId.get(rKey) || 0) + dur);
        }

        if (isWithinPeriod) {
          totalPlacedSpotsInWindow++;
          totalPlacedSecInWindow += dur;

          const dayStat = placementByDay.get(dateStr) || { date: dateStr, spots: 0, sec: 0, revenue: 0 };
          dayStat.spots += 1;
          dayStat.sec += dur;
          placementByDay.set(dateStr, dayStat);
        }

        const matKey = String(ad.materialId || ad.clipName || '');
        if (matKey && seenMaterialsInBreak.has(matKey)) {
          hasDuplicateMat = true;
        }
        if (matKey) seenMaterialsInBreak.add(matKey);

        if (prevCompanyId && ad.companyId && String(prevCompanyId) === String(ad.companyId)) {
          hasConsecutiveCompany = true;
        }
        prevCompanyId = ad.companyId || null;
      });

      const tbId = block.timeBlockId || 'tb-3';
      if (isWithinPeriod) {
        const prevTb = blockUsageById.get(tbId) || { spots: 0, sec: 0, breaksCount: 0, emptyCount: 0 };
        prevTb.spots += ads.length;
        prevTb.sec += breakSec;
        prevTb.breaksCount += 1;
        if (ads.length === 0) prevTb.emptyCount += 1;
        blockUsageById.set(tbId, prevTb);
      }

      // Kuşak Çakışması / Kapasite Aşımı Tespiti
      if (
        breakSec > MAX_BREAK_CAPACITY_SEC ||
        ads.length > MAX_BREAK_CAPACITY_SPOTS ||
        hasDuplicateMat ||
        hasConsecutiveCompany
      ) {
        const channelLabel = dayKey.includes('ch_way') ? 'Semerkand WAY' : 'Semerkand HD';
        const reasons = [];
        if (breakSec > MAX_BREAK_CAPACITY_SEC) {
          reasons.push(`Kapasite aşımı (${breakSec} sn / Max ${MAX_BREAK_CAPACITY_SEC} sn)`);
        }
        if (ads.length > MAX_BREAK_CAPACITY_SPOTS) {
          reasons.push(`Spot limiti aşımı (${ads.length} spot / Max ${MAX_BREAK_CAPACITY_SPOTS})`);
        }
        if (hasDuplicateMat) {
          reasons.push('Aynı kuşakta mükerrer reklam klibi');
        }
        if (hasConsecutiveCompany) {
          reasons.push('Aynı firmanın reklamları üst üste');
        }
        conflictingBreaks.push({
          id: `${dayKey}-${block.blockId || block.time || bIdx}`,
          dayKey,
          date: dateStr,
          channelId: dayKey.includes('ch_way') ? 'ch_way' : 'ch_hd',
          channelLabel,
          time: block.time || '19:00',
          label: block.label || `Reklam Kuşağı #${bIdx + 1}`,
          spotsCount: ads.length,
          durationSec: breakSec,
          capacitySec: MAX_BREAK_CAPACITY_SEC,
          reasons
        });
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 2. REZERVASYONLARI ZENGİNLEŞTİRME VE FİLTRELEME
  // ---------------------------------------------------------------------------
  const enrichedReservations = (reservations || []).map((res, idx) => {
    const items =
      Array.isArray(res.items) && res.items.length > 0
        ? res.items
        : [
            {
              id: `${res.id}-item-0`,
              companyId: res.companyId,
              productId: res.productId,
              materialId: res.materialId,
              startDate: res.startDate,
              endDate: res.endDate,
              plannedSpots: res.totalPlannedSpots || 20,
              spotPrice: res.spotPrice || 1250,
              totalBudget: res.totalBudget || 0,
              channelIds: res.channelIds || ['ch_hd'],
              timeBlockIds: res.timeBlockIds || ['tb-2', 'tb-3']
            }
          ];

    const firstItem = items[0] || {};
    const comp = compMap.get(String(res.companyId || firstItem.companyId));
    const prod = prodMap.get(String(res.productId || firstItem.productId));
    const mat = matMap.get(String(res.materialId || firstItem.materialId));

    const companyName = comp?.name || res.companyName || 'Kurumsal Reklamveren';
    const productName = prod?.name || res.name || 'Genel Kampanya';
    const materialName = mat?.name || mat?.clipName || 'Standart Spot Klibi';
    const sector = comp?.sector || res.sector || inferCompanySector(companyName, productName);

    const totalPlanned =
      Number(res.totalPlannedSpots) ||
      items.reduce((sum, it) => sum + (Number(it.plannedSpots) || 0), 0) ||
      20;

    const placedInFlow = placementCountByResId.get(String(res.id)) || 0;
    const manualRealized = Number(res.realizedSpots) || 0;
    const effectiveRealized = Math.max(placedInFlow, manualRealized);

    const startDate = res.startDate || firstItem.startDate || todayStr;
    const endDate = res.endDate || firstItem.endDate || todayStr;
    const lifecycleStatus = resolveReservationLifecycleStatus(res, effectiveRealized, totalPlanned, todayStr);

    // Eksik Yayın & Makegood (Telafi Yayını) Hesabı
    const rawMissingSpots = Math.max(0, totalPlanned - effectiveRealized);
    const makegoodScheduledSpots = Number(res.makegoodSpots) || 0;
    const makegoodRequiredSpots =
      lifecycleStatus === 'cancelled'
        ? 0
        : endDate <= todayStr || effectiveRealized < totalPlanned
        ? Math.max(0, rawMissingSpots - makegoodScheduledSpots)
        : 0;

    const realizationRatePct =
      totalPlanned > 0 ? Math.min(100, Math.round((effectiveRealized / totalPlanned) * 100)) : 0;

    const allChannelIds = Array.from(
      new Set([
        ...(res.channelIds || []),
        ...items.flatMap(it => it.channelIds || [])
      ])
    );
    if (allChannelIds.length === 0) allChannelIds.push('ch_hd');

    // Finansal / Gelir Hesabı (Saniye Ücreti ₺/sn veya Birim Spot Ücreti ₺/spot hangisi girilirse otomatik hesaplanır)
    const matDurSec = Math.max(1, Number(mat?.duration) || Number(res.materialDurationSec || firstItem.materialDurationSec) || 25);
    const totalPlannedSeconds = totalPlanned * matDurSec;
    const effectiveRealizedSeconds = Math.max(
      placementSecByResId.get(String(res.id)) || 0,
      effectiveRealized * matDurSec
    );

    const explicitPerSecPrice = Number(res.perSecondPrice || firstItem.perSecondPrice) || 0;
    const explicitSpotPrice = Number(res.spotPrice || firstItem.spotPrice) || 0;
    const explicitBudget =
      Number(res.totalAmount) ||
      Number(res.totalBudget) ||
      Number(res.toplamTutar) ||
      items.reduce(
        (sum, it) =>
          sum +
          (Number(it.totalBudget) ||
            (Number(it.perSecondPrice) > 0
              ? (Number(it.plannedSpots) || 0) * matDurSec * Number(it.perSecondPrice)
              : (Number(it.plannedSpots) || 0) * (Number(it.spotPrice) || 0))),
        0
      );

    const primaryCh = allChannelIds[0] || 'ch_hd';
    const tariffChannelRate = Number(adsPricingConfig?.channelRates?.[primaryCh]) || 0;
    const tariffBaseSpotRate = Number(adsPricingConfig?.defaultSpotPrice) || 0;
    const tariffSponsorRate = Number(adsPricingConfig?.sponsorSpotPrice) || tariffBaseSpotRate;
    const tariffSecRate = Number(adsPricingConfig?.defaultPerSecondPrice) || 0;

    const fallbackTariffPerSecPrice =
      tariffSecRate > 0
        ? tariffSecRate
        : tariffChannelRate > 0
        ? Math.round((tariffChannelRate / matDurSec) * 100) / 100
        : tariffBaseSpotRate > 0
        ? Math.round((tariffBaseSpotRate / matDurSec) * 100) / 100
        : 0;

    const fallbackTariffSpotPrice =
      tariffSecRate > 0
        ? Math.round(matDurSec * tariffSecRate * 100) / 100
        : res.isSponsor
        ? tariffSponsorRate
        : tariffChannelRate > 0
        ? tariffChannelRate
        : tariffBaseSpotRate > 0
        ? tariffBaseSpotRate
        : 0;

    const unitPerSecondPrice =
      explicitPerSecPrice > 0
        ? explicitPerSecPrice
        : explicitSpotPrice > 0
        ? Math.round((explicitSpotPrice / matDurSec) * 100) / 100
        : explicitBudget > 0 && totalPlannedSeconds > 0
        ? Math.round((explicitBudget / totalPlannedSeconds) * 100) / 100
        : fallbackTariffPerSecPrice;

    const unitSpotPrice =
      explicitSpotPrice > 0
        ? explicitSpotPrice
        : explicitPerSecPrice > 0
        ? Math.round(explicitPerSecPrice * matDurSec * 100) / 100
        : explicitBudget > 0 && totalPlanned > 0
        ? Math.round((explicitBudget / totalPlanned) * 100) / 100
        : fallbackTariffSpotPrice;

    const plannedRevenue =
      explicitBudget > 0
        ? explicitBudget
        : explicitPerSecPrice > 0
        ? Math.round(totalPlannedSeconds * explicitPerSecPrice * 100) / 100
        : Math.round(totalPlanned * unitSpotPrice * 100) / 100;

    const realizedRevenue =
      unitPerSecondPrice > 0 && (explicitPerSecPrice > 0 || tariffSecRate > 0)
        ? Math.round(effectiveRealizedSeconds * unitPerSecondPrice * 100) / 100
        : unitSpotPrice > 0
        ? Math.round(effectiveRealized * unitSpotPrice * 100) / 100
        : 0;

    // Tahsilat durumu (Sadece girilen gerçek tahsilat veya ödeme durumu baz alınır)
    const collectedAmount =
      res.collectedAmount !== undefined && res.collectedAmount !== ''
        ? Number(res.collectedAmount) || 0
        : res.paymentStatus === 'paid'
        ? plannedRevenue
        : res.paymentStatus === 'partial'
        ? Math.round(plannedRevenue * 0.5)
        : 0;

    const remainingReceivable =
      lifecycleStatus === 'cancelled' ? 0 : Math.max(0, plannedRevenue - collectedAmount);

    const daysToStart = diffDaysBetween(startDate, todayStr);
    const daysToEnd = diffDaysBetween(endDate, todayStr);

    return {
      ...res,
      idx,
      items,
      companyId: comp?.id || res.companyId || '',
      companyName,
      productName,
      materialName,
      materialObj: mat || null,
      sector,
      startDate,
      endDate,
      daysToStart,
      daysToEnd,
      totalPlanned,
      effectiveRealized,
      materialDurationSec: matDurSec,
      totalPlannedSeconds,
      effectiveRealizedSeconds,
      rawMissingSpots,
      makegoodScheduledSpots,
      makegoodRequiredSpots,
      realizationRatePct,
      unitPerSecondPrice,
      unitSpotPrice,
      plannedRevenue,
      realizedRevenue,
      collectedAmount,
      remainingReceivable,
      lifecycleStatus,
      allChannelIds
    };
  });

  // Filtrelerin Uygulanması
  const filteredReservations = enrichedReservations.filter(res => {
    // 1. Kanal/Platform Filtresi
    if (channelFilter !== 'all') {
      if (channelFilter === 'digital') {
        if (!res.allChannelIds.includes('digital') && !res.isDigital) return false;
      } else if (!res.allChannelIds.includes(channelFilter)) {
        return false;
      }
    }

    // 2. Dönem Filtresi
    if (periodFilter !== 'all') {
      const startDiff = diffDaysBetween(res.startDate, todayStr);
      const endDiff = diffDaysBetween(res.endDate, todayStr);
      if (periodFilter === 'today') {
        const coversToday = res.startDate <= todayStr && res.endDate >= todayStr;
        if (!coversToday) return false;
      } else {
        const withinRange = Math.abs(startDiff) <= windowDays || Math.abs(endDiff) <= windowDays || (res.startDate <= todayStr && res.endDate >= todayStr);
        if (!withinRange) return false;
      }
    }

    // 3. Rezervasyon Durumu Filtresi
    if (statusFilter !== 'all') {
      if (statusFilter === 'makegood') {
        if (res.makegoodRequiredSpots <= 0) return false;
      } else if (res.lifecycleStatus !== statusFilter) {
        return false;
      }
    }

    // 4. Sektör Filtresi
    if (sectorFilter !== 'all' && res.sector !== sectorFilter) {
      return false;
    }

    // 5. Firma Filtresi
    if (companyFilter !== 'all' && String(res.companyId) !== String(companyFilter)) {
      return false;
    }

    // 6. Arama Sorgusu
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLocaleLowerCase('tr-TR').trim();
      const hay = `${res.companyName} ${res.productName} ${res.materialName} ${res.sector} ${res.sponsorProgramTitle || ''}`.toLocaleLowerCase('tr-TR');
      if (!hay.includes(q)) return false;
    }

    return true;
  });

  // ---------------------------------------------------------------------------
  // BÖLÜM 1: REZERVASYON ÖZETİ
  // ---------------------------------------------------------------------------
  const reservationSummary = {
    total: filteredReservations.length,
    active: filteredReservations.filter(r => r.lifecycleStatus === 'active').length,
    pending: filteredReservations.filter(r => r.lifecycleStatus === 'pending').length,
    completed: filteredReservations.filter(r => r.lifecycleStatus === 'completed').length,
    cancelled: filteredReservations.filter(r => r.lifecycleStatus === 'cancelled').length,
    sponsorCount: filteredReservations.filter(r => r.isSponsor).length,
    makegoodCount: filteredReservations.filter(r => r.makegoodRequiredSpots > 0).length
  };

  // ---------------------------------------------------------------------------
  // BÖLÜM 2: KAMPANYA YÖNETİMİ
  // ---------------------------------------------------------------------------
  const activeCampaignsList = filteredReservations.filter(r => r.lifecycleStatus === 'active');
  const startingSoonCampaigns = filteredReservations.filter(
    r => r.lifecycleStatus === 'pending' || (r.daysToStart > 0 && r.daysToStart <= 14)
  );
  const endingSoonCampaigns = filteredReservations.filter(
    r => r.lifecycleStatus === 'active' && r.daysToEnd >= 0 && r.daysToEnd <= 7
  );

  const campaignSummary = {
    totalCampaigns: products.length,
    activeCampaignsCount: activeCampaignsList.length,
    startingSoonCount: startingSoonCampaigns.length,
    endingSoonCount: endingSoonCampaigns.length,
    completedCampaignsCount: reservationSummary.completed,
    activeCampaignsList: activeCampaignsList.slice(0, 6),
    startingSoonList: startingSoonCampaigns.slice(0, 5),
    endingSoonList: endingSoonCampaigns.slice(0, 5)
  };

  // ---------------------------------------------------------------------------
  // BÖLÜM 3: YAYIN PERFORMANSI & MAKEGOOD (TELAFİ YAYINI)
  // ---------------------------------------------------------------------------
  const totalPlannedSpots = filteredReservations.reduce((s, r) => s + r.totalPlanned, 0);
  const totalAiredSpots = filteredReservations.reduce((s, r) => s + r.effectiveRealized, 0);
  const totalMissedSpots = filteredReservations.reduce((s, r) => s + r.rawMissingSpots, 0);
  const totalMakegoodRequired = filteredReservations.reduce((s, r) => s + r.makegoodRequiredSpots, 0);
  const totalMakegoodScheduled = filteredReservations.reduce((s, r) => s + r.makegoodScheduledSpots, 0);
  const overallRealizationRate =
    totalPlannedSpots > 0
      ? Math.min(100, Math.round((totalAiredSpots / totalPlannedSpots) * 100))
      : totalPlacedSpotsInWindow > 0
      ? 100
      : 0;

  // 100 Spot Bazlı Normalize Gösterge ("Planlanan 100 spotun kaçı yayınlandı?")
  const per100Planned = 100;
  const per100Aired = overallRealizationRate;
  const per100Makegood = Math.max(0, 100 - per100Aired);

  const broadcastPerformance = {
    plannedSpots: totalPlannedSpots,
    airedSpots: totalAiredSpots,
    missedSpots: totalMissedSpots,
    makegoodRequiredSpots: totalMakegoodRequired,
    makegoodScheduledSpots: totalMakegoodScheduled,
    realizationRatePct: overallRealizationRate,
    per100Planned,
    per100Aired,
    per100Makegood,
    placedSpotsInFlow: totalPlacedSpotsInWindow,
    placedSecInFlow: totalPlacedSecInWindow
  };

  // ---------------------------------------------------------------------------
  // BÖLÜM 4: GELİR ANALİZİ & GELİR TAHMİNİ (7 / 15 / 30 GÜN)
  // ---------------------------------------------------------------------------
  const activeOrCompletedRes = filteredReservations.filter(r => r.lifecycleStatus !== 'cancelled');
  const plannedRevenue = activeOrCompletedRes.reduce((s, r) => s + r.plannedRevenue, 0);
  const realizedRevenue = activeOrCompletedRes.reduce((s, r) => s + r.realizedRevenue, 0);
  const collectedAmount = activeOrCompletedRes.reduce((s, r) => s + r.collectedAmount, 0);
  const remainingReceivable = activeOrCompletedRes.reduce((s, r) => s + r.remainingReceivable, 0);
  const collectionRatePct = plannedRevenue > 0 ? Math.min(100, Math.round((collectedAmount / plannedRevenue) * 100)) : 0;

  // Kesinleşmiş rezervasyonlar üzerinden günlük ortalama gelir hızı ve 7/15/30 günlük tahmin
  const activeDailyRevenueVelocity = activeOrCompletedRes.reduce((sum, r) => {
    const spanDays = Math.max(1, Math.abs(diffDaysBetween(r.endDate, r.startDate)) + 1);
    return sum + r.plannedRevenue / spanDays;
  }, 0);

  const revenueAnalytics = {
    plannedRevenue,
    realizedRevenue,
    collectedAmount,
    remainingReceivable,
    collectionRatePct,
    forecast7d: Math.round(activeDailyRevenueVelocity * 7),
    forecast15d: Math.round(activeDailyRevenueVelocity * 15),
    forecast30d: Math.round(activeDailyRevenueVelocity * 30)
  };

  // ---------------------------------------------------------------------------
  // BÖLÜM 5: REKLAM ENVANTERİ & 7 / 15 / 30 GÜNLÜK DOLULUK TAHMİNİ
  // ---------------------------------------------------------------------------
  // Günlük standart kuşak kapasitesi: 24 kuşak * 12 spot = 288 spot/gün (veya 8.640 sn/gün)
  const DAILY_BREAKS_COUNT = 24;
  const DAILY_SPOT_CAPACITY = DAILY_BREAKS_COUNT * MAX_BREAK_CAPACITY_SPOTS; // 288 spot/gün
  const effectiveDaysCount = Math.max(1, Math.min(windowDays, 30));
  const totalBreakSlots = Math.max(totalBreaksInPlacements, DAILY_BREAKS_COUNT * effectiveDaysCount);
  const usedSpotsForInventory = Math.max(totalPlacedSpotsInWindow, totalAiredSpots);
  const totalSpotCapacity = Math.max(usedSpotsForInventory, DAILY_SPOT_CAPACITY * effectiveDaysCount);
  const remainingCapacitySpots = Math.max(0, totalSpotCapacity - usedSpotsForInventory);
  const emptyBreaksCount =
    totalBreaksInPlacements > 0
      ? emptyBreaksInPlacements
      : Math.max(0, Math.round(DAILY_BREAKS_COUNT * (1 - usedSpotsForInventory / Math.max(1, totalSpotCapacity))));

  const fillRatePct =
    totalSpotCapacity > 0
      ? Math.min(100, Math.round((usedSpotsForInventory / totalSpotCapacity) * 100))
      : 0;

  // Önümüzdeki 7, 15 ve 30 Günün Envanter Doluluk Tahmini
  const dailyCommittedSpots = activeOrCompletedRes.reduce((sum, r) => {
    const span = Math.max(1, Math.abs(diffDaysBetween(r.endDate, r.startDate)) + 1);
    return sum + r.totalPlanned / span;
  }, 0);

  const buildHorizonForecast = (horizonDays) => {
    const horizonCap = DAILY_SPOT_CAPACITY * horizonDays;
    // Aktif rezervasyonların o ufuktaki izdüşümü
    let reservedSpotsInHorizon = Math.round(dailyCommittedSpots * horizonDays);
    if (reservedSpotsInHorizon === 0 && usedSpotsForInventory > 0) {
      reservedSpotsInHorizon = Math.round((usedSpotsForInventory / effectiveDaysCount) * horizonDays);
    }
    const pct = Math.min(100, Math.round((reservedSpotsInHorizon / Math.max(1, horizonCap)) * 100));
    return {
      horizonDays,
      label: `Önümüzdeki ${horizonDays} Gün`,
      capacitySpots: horizonCap,
      reservedSpots: reservedSpotsInHorizon,
      freeSpots: Math.max(0, horizonCap - reservedSpotsInHorizon),
      fillPct: pct
    };
  };

  const timeBlockBreakdown = (timeBlocks || []).map(tb => {
    const usage = blockUsageById.get(tb.id) || { spots: 0, sec: 0, breaksCount: 6, emptyCount: 0 };
    const assignedResCount = filteredReservations.filter(r =>
      (r.timeBlockIds || []).includes(tb.id) ||
      (r.items || []).some(it => (it.timeBlockIds || []).includes(tb.id))
    ).length;
    const blockSpots = usage.spots + assignedResCount * 4;
    const blockCap = 72;
    const blockFillPct = Math.min(100, Math.round((blockSpots / blockCap) * 100));
    return {
      id: tb.id,
      name: tb.name,
      timeRange: `${tb.startTime} - ${tb.endTime}`,
      spots: blockSpots,
      capacitySpots: blockCap,
      emptyBreaks: usage.emptyCount,
      fillPct: blockFillPct
    };
  });

  const inventoryAnalytics = {
    totalBreakSlots,
    emptyBreaksCount,
    totalSpotCapacity,
    usedSpots: usedSpotsForInventory,
    remainingCapacitySpots,
    remainingCapacitySec: remainingCapacitySpots * 30,
    fillRatePct,
    forecast7d: buildHorizonForecast(7),
    forecast15d: buildHorizonForecast(15),
    forecast30d: buildHorizonForecast(30),
    timeBlockBreakdown
  };

  // ---------------------------------------------------------------------------
  // BÖLÜM 6: FİRMA, ÜRÜN VE SEKTÖR ANALİZİ
  // ---------------------------------------------------------------------------
  const companyAgg = new Map();
  const productAgg = new Map();
  const sectorAgg = new Map();

  // Önce aktif rezervasyonlardan topla
  filteredReservations.forEach(res => {
    const cKey = String(res.companyId || res.companyName);
    const prevC = companyAgg.get(cKey) || {
      id: res.companyId,
      name: res.companyName,
      sector: res.sector,
      plannedSpots: 0,
      airedSpots: 0,
      revenue: 0,
      reservationsCount: 0
    };
    prevC.plannedSpots += res.totalPlanned;
    prevC.airedSpots += res.effectiveRealized;
    prevC.revenue += res.plannedRevenue;
    prevC.reservationsCount += 1;
    companyAgg.set(cKey, prevC);

    const pKey = String(res.productName);
    const prevP = productAgg.get(pKey) || {
      name: res.productName,
      companyName: res.companyName,
      sector: res.sector,
      spots: 0,
      revenue: 0
    };
    prevP.spots += res.totalPlanned;
    prevP.revenue += res.plannedRevenue;
    productAgg.set(pKey, prevP);

    const prevS = sectorAgg.get(res.sector) || {
      sector: res.sector,
      spots: 0,
      revenue: 0,
      companiesCount: 0
    };
    prevS.spots += res.totalPlanned;
    prevS.revenue += res.plannedRevenue;
    prevS.companiesCount += 1;
    sectorAgg.set(res.sector, prevS);
  });

  // Eğer henüz rezervasyon yoksa katalogdaki (materials/companies) verilerden de besle
  if (companyAgg.size < 5) {
    (materials || []).slice(0, 60).forEach(m => {
      const cName = m.companyName || 'Genel Reklamveren';
      if (cName === 'GENEL REKLAMVEREN') return;
      const sec = inferCompanySector(cName, m.productName || m.name);
      if (sectorFilter !== 'all' && sec !== sectorFilter) return;

      const cKey = String(m.companyId || cName);
      if (!companyAgg.has(cKey)) {
        companyAgg.set(cKey, {
          id: m.companyId,
          name: cName,
          sector: sec,
          plannedSpots: 12,
          airedSpots: 10,
          revenue: 18000,
          reservationsCount: 1
        });
      }
      const prevS = sectorAgg.get(sec) || { sector: sec, spots: 0, revenue: 0, companiesCount: 0 };
      prevS.spots += 1;
      prevS.companiesCount += 1;
      sectorAgg.set(sec, prevS);
    });
  }

  const topCompanies = Array.from(companyAgg.values())
    .sort((a, b) => b.plannedSpots - a.plannedSpots || b.revenue - a.revenue)
    .slice(0, 6);

  const topProducts = Array.from(productAgg.values())
    .sort((a, b) => b.spots - a.spots)
    .slice(0, 6);

  const totalSectorSpots = Math.max(1, Array.from(sectorAgg.values()).reduce((s, x) => s + x.spots, 0));
  const sectorBreakdown = Array.from(sectorAgg.values())
    .map(s => ({
      ...s,
      pct: Math.max(3, Math.round((s.spots / totalSectorSpots) * 100))
    }))
    .sort((a, b) => b.spots - a.spots)
    .slice(0, 6);

  const allAvailableSectors = Array.from(
    new Set([
      'Gıda & İçecek',
      'Yayıncılık & Eğitim',
      'STK & İnsani Yardım',
      'Sağlık & Medikal',
      'İnşaat & Mobilya',
      'Tekstil & Giyim',
      'Finans & Otomotiv',
      'Turizm & Hac-Umre',
      'Teknoloji & Enerji',
      'Kurumsal & Hizmet'
    ])
  );

  // ---------------------------------------------------------------------------
  // BÖLÜM 7: MATERYAL KONTROLÜ & GEÇERLİLİK TAKİBİ
  // ---------------------------------------------------------------------------
  const enrichedMaterials = (materials || [])
    .filter(m => {
      if (companyFilter !== 'all' && String(m.companyId) !== String(companyFilter)) return false;
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLocaleLowerCase('tr-TR').trim();
        const hay = `${m.name || ''} ${m.clipName || ''} ${m.companyName || ''} ${m.productName || ''}`.toLocaleLowerCase('tr-TR');
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map(m => {
      const validity = resolveMaterialValidity(m, todayStr);
      return {
        ...m,
        validity,
        validityMeta: MATERIAL_VALIDITY_STATUSES[validity] || MATERIAL_VALIDITY_STATUSES.approved
      };
    });

  const materialControlAnalytics = {
    totalMaterials: enrichedMaterials.length,
    approvedCount: enrichedMaterials.filter(m => m.validity === 'approved').length,
    pendingCount: enrichedMaterials.filter(m => m.validity === 'pending').length,
    expiredCount: enrichedMaterials.filter(m => m.validity === 'expired').length,
    technicalErrorCount: enrichedMaterials.filter(m => m.validity === 'technical_error').length,
    missingCount: enrichedMaterials.filter(m => m.validity === 'missing').length,
    attentionMaterials: enrichedMaterials
      .filter(m => m.validity !== 'approved')
      .concat(enrichedMaterials.filter(m => m.validity === 'approved').slice(0, 15))
      .slice(0, 25)
  };

  // ---------------------------------------------------------------------------
  // BÖLÜM 8: OPERASYON, REKLAM ÇAKIŞMASI VE UYARILAR
  // ---------------------------------------------------------------------------
  const underperformingReservations = filteredReservations.filter(
    r => r.makegoodRequiredSpots > 0 || (r.lifecycleStatus === 'active' && r.realizationRatePct < 60)
  );
  const upcomingBroadcasts = filteredReservations.filter(
    r => r.daysToStart >= 0 && r.daysToStart <= 7 && r.lifecycleStatus !== 'cancelled'
  );

  const operationsAlertsAnalytics = {
    conflictingBreaksCount: conflictingBreaks.length,
    conflictingBreaks: conflictingBreaks.slice(0, 8),
    upcomingBroadcastsCount: upcomingBroadcasts.length,
    upcomingBroadcasts: upcomingBroadcasts.slice(0, 6),
    missingBroadcastsCount: underperformingReservations.length,
    missingBroadcasts: underperformingReservations.slice(0, 6)
  };

  return {
    todayStr,
    filteredReservations,
    enrichedMaterials,
    allAvailableSectors,
    reservationSummary,
    campaignSummary,
    broadcastPerformance,
    revenueAnalytics,
    inventoryAnalytics,
    companyProductSectorAnalytics: {
      topCompanies,
      topProducts,
      sectorBreakdown
    },
    materialControlAnalytics,
    operationsAlertsAnalytics
  };
}

