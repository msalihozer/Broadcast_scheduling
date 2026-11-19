/**
 * @file src/store/slices/adsSlice.js
 * @description Reklam Modülü (Ads Slice) Ana Durum Deposu (Zustand Slice).
 *
 * Modüler Yapı:
 * - Katalog, tarih ve localStorage yedekleme yardımcıları: `./ads/adsCatalogHelpers.js`
 * - 6 aşamalı otomatik reklam yerleştirme motoru, program sponsorluğu çözümleyici ve
 *   kuşak içi firma ayrıştırma / sıra kilitleme algoritması: `./ads/adsPlacementEngine.js`
 *
 * Bu dilim (slice) şu ana sorumlulukları yönetir:
 * 1. Reklam Kataloğu CRUD işlemleri (`companies`, `products`, `materials`) ve MAM Arşiv (`/api/archive/ads`) senkronizasyonu.
 * 2. Yayın Kuşakları (`timeBlocks`) ve Bumper logo ayarları (`adSettings`).
 * 3. Reklam & Sponsorluk Rezervasyonları (`reservations`) ekleme, güncelleme, silme ve tekil rol koruması.
 * 4. Günlük/Haftalık Otomatik ve Manuel Reklam Kuşağı Planlama (`adPlacements`).
 */
import adsData from '../../data/adsData.json';
import adsMedia from '../../data/adsMedia.json';
import { dialog } from '../dialogStore';
import useAdminLogStore from '../adminLogStore';

import {
  ADS_CATALOG_VERSION,
  DEFAULT_TIME_BLOCKS,
  initialSyncedCatalog,
  getMondayOfWeekStr,
  addDaysLocalStr,
  buildAutoSyncedAdsCatalog,
  normalizeAdDurationSeconds,
  buildInitialReservationsAndPlacements,
  saveAdsReservationsBackup,
  loadAdsReservationsBackup
} from './ads/adsCatalogHelpers';

import {
  SINGULAR_SPONSOR_ROLES,
  enforceSingularBumperUniqueness,
  finalizeBucketAdsOrder,
  runAutoPlanAdsForDay,
  executeAddManualAdToBreak
} from './ads/adsPlacementEngine';

// Dış modüllerin geriye dönük uyumluluğu için re-exportlar
export {
  ADS_CATALOG_VERSION,
  getMondayOfWeekStr,
  addDaysLocalStr,
  initialSyncedCatalog,
  buildInitialReservationsAndPlacements,
  saveAdsReservationsBackup,
  loadAdsReservationsBackup,
  SINGULAR_SPONSOR_ROLES,
  enforceSingularBumperUniqueness,
  finalizeBucketAdsOrder
};

const initialBackup = loadAdsReservationsBackup();

export const createAdsSlice = (set, get) => ({
  adsCatalogVersion: ADS_CATALOG_VERSION,
  companies: initialSyncedCatalog.companies,
  products: initialSyncedCatalog.products,
  materials: initialSyncedCatalog.materials,
  reservations: Array.isArray(initialBackup.reservations) ? initialBackup.reservations : [],
  timeBlocks: DEFAULT_TIME_BLOCKS,

  adsSyncInfo: {
    lastSyncedAt: new Date().toISOString(),
    isSyncing: false,
    dbClipsCount: 0,
    sourceCount: (adsMedia || []).length,
    autoMatchedCount: initialSyncedCatalog.materials.length
  },

  adFilters: { companyId: '', productId: '' },
  pendingMaterialProductId: null,
  selectedCompanyDetailId: initialSyncedCatalog.companies[0]?.id || null,
  selectedMaterialDetailId: null,

  setAdFilters: (filters) => set(state => ({
    adFilters: { ...state.adFilters, ...filters }
  })),

  setPendingMaterialProductId: (productId) => set({ pendingMaterialProductId: productId }),
  setSelectedCompanyDetailId: (companyId) => set({ selectedCompanyDetailId: companyId }),
  setSelectedMaterialDetailId: (materialId) => set({ selectedMaterialDetailId: materialId }),

  /**
   * Yerel katalog verilerini ve `localStorage` yedeklerini yükler.
   */
  loadAdsData: () => {
    const state = get();
    const manualCompanies = (state.companies || []).filter(c => c.isManual);
    const manualProducts = (state.products || []).filter(p => p.isManual);
    const manualMaterials = (state.materials || []).filter(m => m.isManual);

    const synced = buildAutoSyncedAdsCatalog({
      baseCompanies: [...manualCompanies, ...(adsData.companies || [])],
      baseProducts: [...manualProducts, ...(adsData.products || [])],
      baseMaterials: [...manualMaterials, ...(adsData.materials || [])],
      adsMediaList: adsMedia || [],
      remoteArchiveAds: []
    });
    const backup = loadAdsReservationsBackup();
    const hasExistingReservations = Array.isArray(state.reservations);
    const hasBackupReservations = Array.isArray(backup.reservations);
    const hasExistingPlacements = state.adPlacements && typeof state.adPlacements === 'object';
    const hasBackupPlacements = backup.adPlacements && typeof backup.adPlacements === 'object';

    const seeded = ((!hasExistingReservations && !hasBackupReservations) || (!hasExistingPlacements && !hasBackupPlacements))
      ? buildInitialReservationsAndPlacements(synced.materials, [])
      : null;

    set({
      adsCatalogVersion: ADS_CATALOG_VERSION,
      companies: synced.companies,
      products: synced.products,
      materials: synced.materials,
      reservations: hasBackupReservations
        ? backup.reservations
        : hasExistingReservations
        ? state.reservations
        : (seeded?.reservations || []),
      adPlacements: hasBackupPlacements
        ? backup.adPlacements
        : hasExistingPlacements
        ? state.adPlacements
        : (seeded?.adPlacements || {}),
      selectedCompanyDetailId: state.selectedCompanyDetailId || synced.companies[0]?.id || null,
      adsSyncInfo: {
        lastSyncedAt: new Date().toISOString(),
        isSyncing: false,
        dbClipsCount: 0,
        sourceCount: (adsMedia || []).length,
        autoMatchedCount: synced.materials.length
      }
    });
  },

  /**
   * Veritabanından (`/api/archive/ads` - MSSQL Kategori 6 Reklam Arşivi) güncel reklam kliplerini çeker
   * ve Firmaları, Ürünleri ve Materyalleri (Klipleri) otomatik olarak günceller.
   */
  syncAdsCatalogFromArchive: async (options = {}) => {
    const { showNotification = false } = options;

    set(state => ({
      adsSyncInfo: { ...state.adsSyncInfo, isSyncing: true }
    }));

    let remoteAds = [];
    let fetchError = null;
    try {
      const res = await fetch('/api/archive/ads');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          remoteAds = data;
        } else if (Array.isArray(data?.ads)) {
          remoteAds = data.ads;
        } else if (Array.isArray(data?.clips)) {
          remoteAds = data.clips;
        }
      } else {
        fetchError = `HTTP ${res.status}`;
      }
    } catch (err) {
      fetchError = err.message;
    }

    const state = get();
    const manualCompanies = (state.companies || []).filter(c => c.isManual);
    const manualProducts = (state.products || []).filter(p => p.isManual);
    const manualMaterials = (state.materials || []).filter(m => m.isManual);

    const synced = buildAutoSyncedAdsCatalog({
      baseCompanies: [...manualCompanies, ...(adsData.companies || [])],
      baseProducts: [...manualProducts, ...(adsData.products || [])],
      baseMaterials: [...manualMaterials, ...(adsData.materials || [])],
      adsMediaList: adsMedia || [],
      remoteArchiveAds: remoteAds
    });

    const backup = loadAdsReservationsBackup();
    const currentReservations = Array.isArray(state.reservations)
      ? state.reservations
      : Array.isArray(backup.reservations)
      ? backup.reservations
      : null;
    const currentPlacements = state.adPlacements && typeof state.adPlacements === 'object'
      ? state.adPlacements
      : backup.adPlacements && typeof backup.adPlacements === 'object'
      ? backup.adPlacements
      : null;

    const seeded = (currentReservations === null || currentPlacements === null)
      ? buildInitialReservationsAndPlacements(synced.materials, [])
      : null;

    const preservedReservations = currentReservations !== null ? currentReservations : (seeded?.reservations || []);
    const preservedPlacements = currentPlacements !== null ? currentPlacements : (seeded?.adPlacements || {});

    set({
      adsCatalogVersion: ADS_CATALOG_VERSION,
      companies: synced.companies,
      products: synced.products,
      materials: synced.materials,
      reservations: preservedReservations,
      adPlacements: preservedPlacements,
      selectedCompanyDetailId:
        synced.companies.some(c => String(c.id) === String(state.selectedCompanyDetailId))
          ? state.selectedCompanyDetailId
          : synced.companies[0]?.id || null,
      adsSyncInfo: {
        lastSyncedAt: new Date().toISOString(),
        isSyncing: false,
        dbClipsCount: remoteAds.length,
        sourceCount: remoteAds.length + (adsMedia || []).length,
        autoMatchedCount: synced.materials.length,
        error: fetchError
      }
    });

    if (showNotification) {
      dialog.success(
        'Veritabanı Liste Güncellemesi Tamamlandı',
        `MAM Veritabanından (${remoteAds.length} reklam klibi) ve yerel katalogdan veriler başarıyla çekilip eşleştirildi:\n\n` +
          `• Toplam Firma: ${synced.companies.length} Firma\n` +
          `• Toplam Ürün / Kampanya: ${synced.products.length} Ürün\n` +
          `• Toplam Materyal (Klip): ${synced.materials.length} Reklam Klibi\n\n` +
          `Tüm klipler en son yüklenenden eskiye doğru sıralandı.`
      );
    }

    return synced;
  },

  regenerateSampleAdPlacements: () => set(state => {
    const seeded = buildInitialReservationsAndPlacements(state.materials, []);
    const userCreatedReservations = (state.reservations || []).filter(
      r => r && !String(r.id).startsWith('res-auto-')
    );
    const nextReservations = [...userCreatedReservations, ...seeded.reservations];
    const nextPlacements = {
      ...seeded.adPlacements,
      ...state.adPlacements
    };
    saveAdsReservationsBackup(nextReservations, nextPlacements);
    return {
      reservations: nextReservations,
      adPlacements: nextPlacements
    };
  }),

  // ============================================================================
  // 1. FİRMA (COMPANY) İŞLEMLERİ
  // ============================================================================
  addCompany: (company) => set(state => {
    const newComp = {
      ...company,
      id: `c-${Date.now()}`,
      name: String(company.name || '').trim().toLocaleUpperCase('tr-TR'),
      productCount: 0,
      materialCount: 0,
      totalDurationSec: 0,
      lastUploadDate: new Date().toISOString().split('T')[0],
      lastUploadTimestamp: new Date().toISOString(),
      isManual: true
    };
    return {
      companies: [newComp, ...state.companies]
    };
  }),

  updateCompany: (id, updatedFields) => set(state => {
    const newName = updatedFields.name ? String(updatedFields.name).trim().toLocaleUpperCase('tr-TR') : undefined;
    return {
      companies: state.companies.map(c =>
        String(c.id) === String(id)
          ? { ...c, ...updatedFields, ...(newName ? { name: newName } : {}), isManual: true }
          : c
      ),
      products: newName
        ? state.products.map(p => (String(p.companyId) === String(id) ? { ...p, companyName: newName } : p))
        : state.products,
      materials: newName
        ? state.materials.map(m => (String(m.companyId) === String(id) ? { ...m, companyName: newName } : m))
        : state.materials
    };
  }),

  removeCompany: (id) => set(state => ({
    companies: state.companies.filter(c => String(c.id) !== String(id)),
    products: state.products.filter(p => String(p.companyId) !== String(id)),
    materials: state.materials.filter(m => String(m.companyId) !== String(id)),
    reservations: state.reservations.filter(r => {
      const prod = state.products.find(p => String(p.id) === String(r.productId));
      return prod ? String(prod.companyId) !== String(id) : String(r.companyId) !== String(id);
    })
  })),

  // ============================================================================
  // 2. ÜRÜN / MARKA (PRODUCT) İŞLEMLERİ
  // ============================================================================
  addProduct: (product) => set(state => {
    const comp = state.companies.find(c => String(c.id) === String(product.companyId));
    const newProd = {
      ...product,
      id: `p-${Date.now()}`,
      companyName: comp?.name || 'GENEL REKLAMVEREN',
      materialCount: 0,
      totalDurationSec: 0,
      lastUploadDate: new Date().toISOString().split('T')[0],
      lastUploadTimestamp: new Date().toISOString(),
      isManual: true
    };
    return {
      products: [newProd, ...state.products],
      companies: state.companies.map(c =>
        String(c.id) === String(product.companyId)
          ? { ...c, productCount: (c.productCount || 0) + 1 }
          : c
      )
    };
  }),

  updateProduct: (id, updatedFields) => set(state => {
    const comp = updatedFields.companyId
      ? state.companies.find(c => String(c.id) === String(updatedFields.companyId))
      : null;
    return {
      products: state.products.map(p =>
        String(p.id) === String(id)
          ? {
              ...p,
              ...updatedFields,
              ...(comp ? { companyName: comp.name } : {}),
              isManual: true
            }
          : p
      ),
      materials: updatedFields.name
        ? state.materials.map(m =>
            String(m.productId) === String(id)
              ? {
                  ...m,
                  productName: updatedFields.name,
                  ...(comp ? { companyId: comp.id, companyName: comp.name } : {})
                }
              : m
          )
        : state.materials
    };
  }),

  removeProduct: (id) => set(state => ({
    products: state.products.filter(p => String(p.id) !== String(id)),
    materials: state.materials.filter(m => String(m.productId) !== String(id)),
    reservations: state.reservations.filter(r => String(r.productId) !== String(id))
  })),

  // ============================================================================
  // 3. MATERYAL / REKLAM KLİBİ (MATERIAL) İŞLEMLERİ
  // ============================================================================
  addMaterial: (material) => set(state => {
    const prod = state.products.find(p => String(p.id) === String(material.productId));
    const comp = state.companies.find(c => String(c.id) === String(material.companyId || prod?.companyId));
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];
    const durSec = normalizeAdDurationSeconds(material.duration, material.clipName);

    const newMat = {
      ...material,
      id: material.clipId ? String(material.clipId) : `m-${Date.now()}`,
      clipId: material.clipId ? String(material.clipId) : `m-${Date.now()}`,
      companyId: comp?.id || material.companyId || '',
      companyName: comp?.name || material.companyName || 'GENEL REKLAMVEREN',
      productId: prod?.id || material.productId || '',
      productName: prod?.name || material.productName || 'Genel Kampanya',
      duration: durSec,
      uploadDate: material.uploadDate || todayStr,
      uploadTimestamp: material.uploadTimestamp || nowIso,
      isManual: true
    };

    return {
      materials: [newMat, ...state.materials]
    };
  }),

  updateMaterial: (id, updatedFields) => set(state => {
    const prod = updatedFields.productId
      ? state.products.find(p => String(p.id) === String(updatedFields.productId))
      : null;
    const comp = (updatedFields.companyId || prod?.companyId)
      ? state.companies.find(c => String(c.id) === String(updatedFields.companyId || prod?.companyId))
      : null;

    return {
      materials: state.materials.map(m =>
        String(m.id) === String(id)
          ? {
              ...m,
              ...updatedFields,
              ...(prod ? { productId: prod.id, productName: prod.name } : {}),
              ...(comp ? { companyId: comp.id, companyName: comp.name } : {}),
              ...(updatedFields.duration !== undefined
                ? { duration: normalizeAdDurationSeconds(updatedFields.duration, updatedFields.clipName || m.clipName) }
                : {}),
              isManual: true
            }
          : m
      )
    };
  }),

  removeMaterial: (id) => set(state => ({
    materials: state.materials.filter(m => String(m.id) !== String(id)),
    reservations: state.reservations.filter(r => String(r.materialId) !== String(id))
  })),

  // ============================================================================
  // 4. YAYIN KUŞAĞI (TIMEBLOCK) İŞLEMLERİ
  // ============================================================================
  addTimeBlock: (block) => set(state => ({
    timeBlocks: [...state.timeBlocks, { ...block, id: `tb-${Date.now()}` }]
  })),
  updateTimeBlock: (id, updatedFields) => set(state => ({
    timeBlocks: state.timeBlocks.map(tb => tb.id === id ? { ...tb, ...updatedFields } : tb)
  })),
  removeTimeBlock: (id) => set(state => ({
    timeBlocks: state.timeBlocks.filter(tb => tb.id !== id)
  })),
  toggleTimeBlockStatus: (id) => set(state => ({
    timeBlocks: state.timeBlocks.map(tb => tb.id === id ? { ...tb, isActive: !tb.isActive } : tb)
  })),

  // ============================================================================
  // 5. REZERVASYON & SPONSORLUK (RESERVATION) İŞLEMLERİ
  // ============================================================================
  addReservation: (reservation) => set(state => {
    const newRes = { ...reservation, id: `res-${Date.now()}`, isManual: true };
    const cleanedExisting = enforceSingularBumperUniqueness(state.reservations, newRes);
    const nextReservations = [newRes, ...cleanedExisting];
    saveAdsReservationsBackup(nextReservations, state.adPlacements);
    useAdminLogStore.getState().addLog({
      category: 'ads',
      panel: 'ads',
      module: 'Reklam Rezervasyon',
      action: 'Yeni Reklam Rezervasyonu Oluşturuldu',
      details: `${reservation.startDate || ''} - ${reservation.endDate || ''} aralığı için yeni reklam rezervasyonu eklendi (${reservation.totalPlannedSpots || 0} spot).`,
      count: Number(reservation.totalPlannedSpots) || 1,
      status: 'success'
    });
    return {
      reservations: nextReservations
    };
  }),

  updateReservation: (id, updatedFields) => set(state => {
    let updatedTarget = null;
    const mapped = state.reservations.map(r => {
      if (r.id === id) {
        updatedTarget = { ...r, ...updatedFields, isManual: true };
        return updatedTarget;
      }
      return r;
    });
    const nextReservations = updatedTarget
      ? enforceSingularBumperUniqueness(mapped, updatedTarget)
      : mapped;
    saveAdsReservationsBackup(nextReservations, state.adPlacements);
    useAdminLogStore.getState().addLog({
      category: 'ads',
      panel: 'ads',
      module: 'Reklam Rezervasyon',
      action: 'Reklam Rezervasyonu Güncellendi',
      details: `Rezervasyon (${id}) bilgileri güncellendi.`,
      target: String(id),
      status: 'success'
    });
    return {
      reservations: nextReservations
    };
  }),

  removeReservation: (id) => set(state => {
    const nextReservations = state.reservations.filter(r => String(r.id) !== String(id));
    const nextAdPlacements = {};
    Object.entries(state.adPlacements || {}).forEach(([dayKey, blocks]) => {
      nextAdPlacements[dayKey] = (blocks || []).map(block => ({
        ...block,
        ads: (block.ads || []).filter(ad => String(ad.reservationId) !== String(id))
      }));
    });
    saveAdsReservationsBackup(nextReservations, nextAdPlacements);
    useAdminLogStore.getState().addLog({
      category: 'ads',
      panel: 'ads',
      module: 'Reklam Rezervasyon',
      action: 'Reklam Rezervasyonu Silindi',
      details: `Rezervasyon (${id}) ve bağlı reklam kuşağı spotları sistemden silindi.`,
      target: String(id),
      status: 'warning'
    });
    return {
      reservations: nextReservations,
      adPlacements: nextAdPlacements
    };
  }),

  clearAllReservations: () => set(state => {
    const nextReservations = [];
    const nextAdPlacements = {};
    Object.entries(state.adPlacements || {}).forEach(([dayKey, blocks]) => {
      nextAdPlacements[dayKey] = (blocks || []).map(block => ({
        ...block,
        ads: []
      }));
    });
    saveAdsReservationsBackup(nextReservations, nextAdPlacements);
    useAdminLogStore.getState().addLog({
      category: 'ads',
      panel: 'ads',
      module: 'Reklam Rezervasyon',
      action: 'Tüm Reklam Rezervasyonları Temizlendi',
      details: 'Sistemdeki tüm rezervasyonlar ve bağlı reklam kuşağı spotları temizlendi.',
      status: 'warning'
    });
    return {
      reservations: nextReservations,
      adPlacements: nextAdPlacements
    };
  }),

  // ============================================================================
  // 6. BUMPER VE LOGO EŞLEŞTİRME AYARLARI
  // ============================================================================
  adSettings: {
    ch_hd: { bumpers: [] },
    ch_way: { bumpers: [] }
  },

  addBumper: (channelId) => set(state => ({
    adSettings: {
      ...state.adSettings,
      [channelId]: {
        ...state.adSettings[channelId],
        bumpers: [...(state.adSettings[channelId]?.bumpers || []), { id: Date.now().toString(), name: '', type: 'in', logoName: '' }]
      }
    }
  })),

  updateBumper: (channelId, bumperId, field, value) => set(state => ({
    adSettings: {
      ...state.adSettings,
      [channelId]: {
        ...state.adSettings[channelId],
        bumpers: state.adSettings[channelId].bumpers.map(b => b.id === bumperId ? { ...b, [field]: value } : b)
      }
    }
  })),

  removeBumper: (channelId, bumperId) => set(state => ({
    adSettings: {
      ...state.adSettings,
      [channelId]: {
        ...state.adSettings[channelId],
        bumpers: state.adSettings[channelId].bumpers.filter(b => b.id !== bumperId)
      }
    }
  })),

  matchAdLogosForReady: () => set(state => {
    const { selectedChannel, selectedDate, days, adSettings } = state;
    const key = `ready-${selectedChannel}-${selectedDate}`;
    const dayData = days[key];
    const bumpers = adSettings[selectedChannel]?.bumpers || [];

    if (!dayData || bumpers.length === 0) return state;

    const newDays = { ...days };
    const newDayData = { ...dayData, variants: { ...dayData.variants } };

    Object.keys(newDayData.variants).forEach(vId => {
      const variant = newDayData.variants[vId];
      const newPrograms = variant.programs.map(prog => {
        const cleanTitle = (prog.title || '').replace(/\.mxf$/i, '').trim();
        const matchedBumper = bumpers.find(b => b.name && b.name.trim() && cleanTitle.toLowerCase().includes(b.name.trim().toLowerCase()));

        if (matchedBumper && matchedBumper.logoName) {
          return { ...prog, logo: matchedBumper.logoName };
        }
        return prog;
      });
      newDayData.variants[vId] = { ...variant, programs: newPrograms };
    });

    newDays[key] = newDayData;
    return { days: newDays };
  }),

  // ============================================================================
  // 7. REKLAM KUŞAĞI YERLEŞİMLERİ & OTOMATİK/MANUEL PLANLAMA
  // ============================================================================
  adPlacements: initialBackup.adPlacements || {},

  /**
   * Seçilen kanal ve başlangıç tarihi için o haftanın Pazartesi-Pazar 7 günlük çerçevesini hazırlar.
   */
  ensureAdsBroadcastWeek: (channelId = 'ch_hd', baseDateStr) => set(state => {
    const mondayStr = getMondayOfWeekStr(baseDateStr);
    const nextDays = { ...state.days };
    let changed = false;

    const SAMPLE_IDS = new Set(['P-101', 'P-102', 'P-103', 'P-104', 'P-105', 'P-106', 'P-107', 'P-108', 'P-109', 'P-110']);

    for (let i = 0; i < 7; i++) {
      const dateStr = addDaysLocalStr(mondayStr, i);
      const readyKey = `ready-${channelId}-${dateStr}`;
      const existing = nextDays[readyKey];
      const existingProgs = existing?.variants?.[existing.activeVariant || 'v1']?.programs || [];

      const isLegacySampleDay = existingProgs.some(p => p && SAMPLE_IDS.has(String(p.id)));

      if (!existing || isLegacySampleDay) {
        nextDays[readyKey] = {
          date: dateStr,
          startTime: 0,
          activeVariant: 'v1',
          sourceList: 'A',
          adsStatus: isLegacySampleDay ? undefined : existing?.adsStatus,
          variants: {
            v1: { programs: [] },
            v2: { programs: [] }
          }
        };
        changed = true;
      }
    }

    return changed ? { days: nextDays } : state;
  }),

  /**
   * Seçili kanal ve gün için hangi yayın listesinin (`Liste A` -> `v1` veya `Liste B` -> `v2`)
   * aktif olarak düzenlendiğini değiştirir.
   */
  switchAdsDayListVariant: (channelId = 'ch_hd', dateStr, listCode = 'A') => set(state => {
    const readyKey = `ready-${channelId}-${dateStr}`;
    const existing = state.days?.[readyKey] || {
      date: dateStr,
      channelId,
      startTime: 0,
      variants: { v1: { programs: [] }, v2: { programs: [] } }
    };
    const nextVariantKey = listCode === 'B' ? 'v2' : 'v1';

    return {
      days: {
        ...state.days,
        [readyKey]: {
          ...existing,
          channelId,
          date: dateStr,
          sourceList: listCode === 'B' ? 'B' : 'A',
          activeVariant: nextVariantKey,
          variants: {
            v1: existing.variants?.v1 || { programs: [] },
            v2: existing.variants?.v2 || { programs: [] },
            ...(existing.variants || {})
          }
        }
      }
    };
  }),

  /**
   * Seçili kanal ve gün için 6 aşamalı Akıllı Otomatik Reklam Yerleştirme Algoritmasını çalıştırır.
   */
  autoPlanAdsForDay: (channelId, date) => set(state => runAutoPlanAdsForDay(state, channelId, date)),

  /**
   * Seçili haftanın (Pazartesi - Pazar) 7 gününün tamamını tek tıkla otomatik doldurur.
   */
  autoPlanAdsForWeek: (channelId = 'ch_hd', startDateStr) => {
    const mondayStr = getMondayOfWeekStr(startDateStr);
    get().ensureAdsBroadcastWeek(channelId, mondayStr);
    for (let i = 0; i < 7; i++) {
      const dateStr = addDaysLocalStr(mondayStr, i);
      get().autoPlanAdsForDay(channelId, dateStr);
    }
  },

  /**
   * Belirli bir reklam kuşağına (Break) manuel olarak reklam/spot ekler.
   */
  addManualAdToBreak: (channelId, date, breakMeta, adPayload) =>
    set(state => executeAddManualAdToBreak(state, channelId, date, breakMeta, adPayload)),

  /**
   * Belirli bir reklam kuşağındaki spotu siler.
   */
  removeAdFromBreak: (channelId, date, blockTimeOrId, adIndex) => set(state => {
    const key = `ready-${channelId}-${date}`;
    const existingBlocks = (state.adPlacements[key] || []).map(b => {
      if (b.blockId === blockTimeOrId || b.time === blockTimeOrId) {
        return {
          ...b,
          ads: (b.ads || []).filter((_, idx) => idx !== adIndex)
        };
      }
      return b;
    });

    const nextAdPlacements = {
      ...state.adPlacements,
      [key]: existingBlocks
    };
    saveAdsReservationsBackup(state.reservations, nextAdPlacements);

    return {
      adPlacements: nextAdPlacements
    };
  }),

  /**
   * Belirli bir reklam kuşağındaki spotun sırasını yukarı (-1) veya aşağı (+1) taşır.
   */
  moveAdInBreak: (channelId, date, blockTimeOrId, adIndex, direction) => set(state => {
    const key = `ready-${channelId}-${date}`;
    const existingBlocks = (state.adPlacements[key] || []).map(b => {
      if (b.blockId === blockTimeOrId || b.time === blockTimeOrId) {
        const nextAds = [...(b.ads || [])];
        const targetIdx = adIndex + direction;
        if (targetIdx < 0 || targetIdx >= nextAds.length) return b;
        const temp = nextAds[adIndex];
        nextAds[adIndex] = nextAds[targetIdx];
        nextAds[targetIdx] = temp;
        return { ...b, ads: nextAds };
      }
      return b;
    });

    const nextAdPlacements = {
      ...state.adPlacements,
      [key]: existingBlocks
    };
    saveAdsReservationsBackup(state.reservations, nextAdPlacements);

    return {
      adPlacements: nextAdPlacements
    };
  }),

  /**
   * Tek bir reklam kuşağının içindeki tüm spotları temizler.
   */
  clearAdBreak: (channelId, date, blockTimeOrId) => set(state => {
    const key = `ready-${channelId}-${date}`;
    const existingBlocks = (state.adPlacements[key] || []).map(b => {
      if (b.blockId === blockTimeOrId || b.time === blockTimeOrId) {
        return { ...b, ads: [] };
      }
      return b;
    });

    const nextAdPlacements = {
      ...state.adPlacements,
      [key]: existingBlocks
    };
    saveAdsReservationsBackup(state.reservations, nextAdPlacements);

    return {
      adPlacements: nextAdPlacements
    };
  })
});
