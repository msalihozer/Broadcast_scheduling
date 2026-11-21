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
  loadAdsReservationsBackup,
  DEFAULT_AD_BREAK_BUMPER_RULES,
  buildDefaultAdBreakBumperRules,
  getBumperJingleClipsFromAdsMedia,
  saveAdBreakBumperRulesBackup,
  loadAdBreakBumperRulesBackup,
  DEFAULT_CHANNEL_LOGO_SETTINGS,
  buildDefaultChannelLogoSettings,
  saveChannelLogoSettingsBackup,
  loadChannelLogoSettingsBackup,
  resolveProgramLogoForChannel,
  DEFAULT_ADS_PRICING_CONFIG,
  loadAdsPricingConfigBackup,
  saveAdsPricingConfigBackup,
  loadDeletedReservationIdsBackup,
  recordDeletedReservationIdBackup,
  pushAdsStoreToServer,
  writeAdsReservationsLocalCacheOnly
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

const loadSavedRamadanConfig = () => {
  try {
    const raw = localStorage.getItem('yayin_ramadan_config_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    // ignore
  }
  return {
    enabled: true,
    startDate: '',
    endDate: '',
    leadDays: 14,
    forceShow: false,
    allowStandardAdsInRamadanBreaks: true
  };
};

export const createAdsSlice = (set, get) => ({
  adsCatalogVersion: ADS_CATALOG_VERSION,
  companies: initialSyncedCatalog.companies,
  products: initialSyncedCatalog.products,
  materials: initialSyncedCatalog.materials,
  reservations: Array.isArray(initialBackup.reservations) ? initialBackup.reservations : [],
  timeBlocks: DEFAULT_TIME_BLOCKS,
  adBreakBumperRules: loadAdBreakBumperRulesBackup() || DEFAULT_AD_BREAK_BUMPER_RULES,
  adsPricingConfig: loadAdsPricingConfigBackup(),
  usedArchivePrograms: [],
  ramadanConfig: loadSavedRamadanConfig(),

  /**
   * Dashboard ve Raporlar için Spot & Ücretlendirme tarife ayarlarını günceller.
   */
  updateAdsPricingConfig: (updates) => set(state => {
    const cur = state.adsPricingConfig || DEFAULT_ADS_PRICING_CONFIG;
    const nextConfig = {
      ...cur,
      ...updates,
      channelRates: { ...(cur.channelRates || {}), ...(updates.channelRates || {}) },
      timeBlockRates: { ...(cur.timeBlockRates || {}), ...(updates.timeBlockRates || {}) }
    };
    saveAdsPricingConfigBackup(nextConfig);
    return { adsPricingConfig: nextConfig };
  }),

  /**
   * Seçili Spot / Saniye Ücret Tarifesini (`adsPricingConfig`) fiyatı henüz girilmemiş (veya tüm)
   * rezervasyonlara uygular.
   */
  applyPricingTariffToReservations: ({ overwriteExisting = false } = {}) => set(state => {
    const cfg = state.adsPricingConfig || DEFAULT_ADS_PRICING_CONFIG;
    const baseSpotRate = Number(cfg.defaultSpotPrice) || 0;
    const baseSecRate = Number(cfg.defaultPerSecondPrice) || 0;
    const sponsorRate = Number(cfg.sponsorSpotPrice) || baseSpotRate;

    const nextReservations = (state.reservations || []).map(res => {
      const hasExistingPrice = Number(res.spotPrice) > 0 || Number(res.totalBudget) > 0 || Number(res.totalAmount) > 0;
      if (hasExistingPrice && !overwriteExisting) return res;

      const items = Array.isArray(res.items) && res.items.length > 0 ? res.items : [res];
      const plannedSpots = Math.max(
        1,
        Number(res.totalPlannedSpots) ||
          items.reduce((s, it) => s + (Number(it.plannedSpots) || 0), 0) ||
          20
      );
      const firstMat = (state.materials || []).find(
        m => String(m.id) === String(res.materialId || items[0]?.materialId)
      );
      const durSec = Number(firstMat?.duration) || 25;

      const chId = (res.channelIds && res.channelIds[0]) || (items[0]?.channelIds && items[0].channelIds[0]) || 'ch_hd';
      const chRate = Number(cfg.channelRates?.[chId]) || 0;

      let unitSpotPrice = res.isSponsor ? sponsorRate : (chRate > 0 ? chRate : baseSpotRate);
      if (unitSpotPrice <= 0 && baseSecRate > 0) {
        unitSpotPrice = Math.round(durSec * baseSecRate);
      }

      const totalBudget = Math.round(plannedSpots * unitSpotPrice);
      const nextItems = Array.isArray(res.items)
        ? res.items.map(it => {
            const itPlanned = Math.max(1, Number(it.plannedSpots) || plannedSpots);
            return {
              ...it,
              spotPrice: unitSpotPrice,
              totalBudget: Math.round(itPlanned * unitSpotPrice)
            };
          })
        : res.items;

      return {
        ...res,
        spotPrice: unitSpotPrice,
        totalBudget,
        totalAmount: totalBudget,
        toplamTutar: totalBudget,
        items: nextItems,
        updatedAt: new Date().toISOString()
      };
    });

    saveAdsReservationsBackup(nextReservations, state.adPlacements);
    return { reservations: nextReservations };
  }),

  /**
   * Tarayıcıdaki (`localStorage` — örn: .80 IP adresi veya seyare.semerkand.com) rezervasyon,
   * reklam yerleşimi, giriş/çıkış kuralları, kanal logoları ve ücretlendirme verilerini
   * sunucu veritabanı (`/api/ads-store` -> PostgreSQL + `backend/data/ads_persistent_store.json`) ile çift yönlü eşitler.
   */
  syncAdsStoreWithServer: async () => {
    try {
      const state = get();
      const localBackup = loadAdsReservationsBackup();

      // Hem Zustand belleğindeki hem de tüm localStorage anahtarlarındaki rezervasyonları birleştir
      const mergedLocalResMap = new Map();
      if (Array.isArray(localBackup.reservations)) {
        localBackup.reservations.forEach(r => {
          if (r && r.id) mergedLocalResMap.set(String(r.id), r);
        });
      }
      if (Array.isArray(state.reservations)) {
        state.reservations.forEach(r => {
          if (r && r.id) mergedLocalResMap.set(String(r.id), r);
        });
      }
      const localReservations = Array.from(mergedLocalResMap.values());

      const localPlacements = {
        ...(localBackup.adPlacements && typeof localBackup.adPlacements === 'object' ? localBackup.adPlacements : {}),
        ...(state.adPlacements && typeof state.adPlacements === 'object' ? state.adPlacements : {})
      };
      const deletedReservationIds = loadDeletedReservationIdsBackup();

      const manualCompanies = (state.companies || []).filter(c => c && c.isManual);
      const manualProducts = (state.products || []).filter(p => p && p.isManual);
      const manualMaterials = (state.materials || []).filter(m => m && m.isManual);

      const mergedStore = await pushAdsStoreToServer({
        reservations: localReservations,
        deletedReservationIds,
        adPlacements: localPlacements,
        adBreakBumperRules: state.adBreakBumperRules,
        adSettings: state.adSettings,
        adsPricingConfig: state.adsPricingConfig,
        manualCompanies,
        manualProducts,
        manualMaterials
      });

      if (!mergedStore) return null;

      const serverReservations = Array.isArray(mergedStore.reservations)
        ? mergedStore.reservations
        : localReservations;
      const serverPlacements =
        mergedStore.adPlacements && typeof mergedStore.adPlacements === 'object'
          ? mergedStore.adPlacements
          : localPlacements;

      // Yerel önbelleği (yayin_ads_reservations_v1 & yayin_ads_placements_v1) doğrudan güncelle
      writeAdsReservationsLocalCacheOnly(serverReservations, serverPlacements);

      set(cur => ({
        reservations: serverReservations,
        adPlacements: serverPlacements,
        adBreakBumperRules:
          Array.isArray(mergedStore.adBreakBumperRules) && mergedStore.adBreakBumperRules.length > 0
            ? mergedStore.adBreakBumperRules
            : cur.adBreakBumperRules,
        adSettings: mergedStore.adSettings || cur.adSettings,
        adsPricingConfig: mergedStore.adsPricingConfig || cur.adsPricingConfig
      }));

      return mergedStore;
    } catch (_) {
      return null;
    }
  },

  /**
   * MAM Arşivindeki aktif program listesini (`/api/archive/used-programs`) çeker ve store'a (`usedArchivePrograms`) yazar.
   * Bu sayede Çerçeve, Hasbihal gibi canlı yayınların önceki bölümleri olup olmadığı ve hangi kategoride oldukları
   * otomatik olarak tespit edilir.
   */
  syncUsedArchiveProgramsForAds: async () => {
    try {
      const res = await fetch('/api/archive/used-programs');
      if (res.ok) {
        const data = await res.json();
        const progList = Array.isArray(data)
          ? data
          : Array.isArray(data?.programs)
          ? data.programs
          : [];
        if (progList.length > 0) {
          set({ usedArchivePrograms: progList });
        }
      }
    } catch (_) {}
  },

  /**
   * Kanal, kategori, canlı yayın program ismi (`liveProgramNames`) veya kanal varsayılanı (`isChannelDefault`)
   * bazlı Reklam Giriş / Çıkış Jenerik kuralı ekler veya günceller.
   * applyToBothChannels=true ise kuralı hem Semerkand HD (ch_hd) hem de Semerkand WAY (ch_way) için kaydeder.
   * Seçilen kategoriler veya canlı yayın program isimleri aynı kanalda başka bir kuralda varsa
   * çakışmayı önlemek için eski kuraldan otomatik düşülür.
   */
  saveAdBreakBumperRule: (rulePayload) => set(state => {
    const currentRules = Array.isArray(state.adBreakBumperRules) ? [...state.adBreakBumperRules] : [];
    const targetChannels = rulePayload.applyToBothChannels
      ? ['ch_hd', 'ch_way']
      : [rulePayload.channelId || 'ch_hd'];

    const isChannelDefault = Boolean(rulePayload.isChannelDefault);
    const selectedCategories = Array.from(
      new Set((rulePayload.categories || []).map(c => String(c || '').trim()).filter(Boolean))
    );
    const selectedCategoryIds = Array.from(
      new Set((rulePayload.categoryIds || []).map(Number).filter(n => !isNaN(n) && n > 0))
    );
    const selectedLivePrograms = Array.from(
      new Set((rulePayload.liveProgramNames || []).map(p => String(p || '').trim()).filter(Boolean))
    );

    if (!isChannelDefault && selectedCategories.length === 0 && selectedLivePrograms.length === 0) {
      return state;
    }

    let updatedRules = [...currentRules];

    targetChannels.forEach((chId, chIdx) => {
      const existingDefaultForChannel = isChannelDefault
        ? updatedRules.find(r => String(r.channelId) === String(chId) && Boolean(r.isChannelDefault))
        : null;

      const editingId = isChannelDefault
        ? (existingDefaultForChannel?.id || rulePayload.id || `bumper-${chId}-live_default_fallback`)
        : !rulePayload.applyToBothChannels && rulePayload.id
        ? String(rulePayload.id)
        : chIdx === 0 && rulePayload.id && String(rulePayload.channelId) === String(chId)
        ? String(rulePayload.id)
        : null;

      // Aynı kanaldaki diğer kurallardan bu kategorileri ve canlı yayın program isimlerini çıkar (tekillik koruması)
      if (!isChannelDefault) {
        updatedRules = updatedRules
          .map(r => {
            if (String(r.channelId) !== String(chId)) return r;
            if (editingId && String(r.id) === editingId) return r;
            if (r.isChannelDefault) return r;

            const remainingCats = (r.categories || []).filter(
              catName =>
                !selectedCategories.some(
                  sc => sc.toLocaleLowerCase('tr-TR') === String(catName).toLocaleLowerCase('tr-TR')
                )
            );
            const remainingCatIds = (r.categoryIds || []).filter(
              cId => !selectedCategoryIds.includes(Number(cId))
            );
            const remainingLiveProgs = (r.liveProgramNames || []).filter(
              lpName =>
                !selectedLivePrograms.some(
                  sp => sp.toLocaleLowerCase('tr-TR') === String(lpName).toLocaleLowerCase('tr-TR')
                )
            );

            if (remainingCats.length === 0 && remainingLiveProgs.length === 0) return null;
            return {
              ...r,
              categories: remainingCats,
              categoryIds: remainingCatIds,
              liveProgramNames: remainingLiveProgs
            };
          })
          .filter(Boolean);
      }

      const defaultTitleParts = [
        ...selectedCategories,
        ...(selectedLivePrograms.length > 0 ? [`Canlı: ${selectedLivePrograms.join(', ')}`] : [])
      ];

      const ruleObj = {
        id: editingId || `bumper-${chId}-${Date.now()}-${chIdx}`,
        channelId: chId,
        ruleName:
          String(rulePayload.ruleName || '').trim() ||
          (isChannelDefault
            ? 'Canlı Yayın & Kategorisiz Programlar Varsayılan (Default) Giriş & Çıkışı'
            : `${defaultTitleParts.join(' • ')} Reklam Giriş & Çıkışı`),
        categories: isChannelDefault && selectedCategories.length === 0
          ? ['Canlı Yayın (Varsayılan)']
          : selectedCategories,
        categoryIds: selectedCategoryIds,
        liveProgramNames: selectedLivePrograms,
        isChannelDefault,
        introClip: rulePayload.introClip || null,
        outroClip: rulePayload.outroClip || null,
        isActive: rulePayload.isActive !== false,
        updatedAt: new Date().toISOString()
      };

      const existingIdx = editingId
        ? updatedRules.findIndex(r => String(r.id) === editingId)
        : -1;

      if (existingIdx > -1) {
        updatedRules[existingIdx] = ruleObj;
      } else {
        updatedRules.push(ruleObj);
      }
    });

    saveAdBreakBumperRulesBackup(updatedRules);
    return { adBreakBumperRules: updatedRules };
  }),

  deleteAdBreakBumperRule: (ruleId) => set(state => {
    const nextRules = (state.adBreakBumperRules || []).filter(r => String(r.id) !== String(ruleId));
    saveAdBreakBumperRulesBackup(nextRules);
    return { adBreakBumperRules: nextRules };
  }),

  toggleAdBreakBumperRuleActive: (ruleId) => set(state => {
    const nextRules = (state.adBreakBumperRules || []).map(r =>
      String(r.id) === String(ruleId) ? { ...r, isActive: !r.isActive, updatedAt: new Date().toISOString() } : r
    );
    saveAdBreakBumperRulesBackup(nextRules);
    return { adBreakBumperRules: nextRules };
  }),

  copyAdBreakBumperRulesBetweenChannels: (sourceChannelId, targetChannelId) => set(state => {
    if (!sourceChannelId || !targetChannelId || sourceChannelId === targetChannelId) return state;
    const currentRules = state.adBreakBumperRules || [];
    const sourceRules = currentRules.filter(r => String(r.channelId) === String(sourceChannelId));
    const otherRules = currentRules.filter(r => String(r.channelId) !== String(targetChannelId));
    const clonedForTarget = sourceRules.map((r, idx) => ({
      ...r,
      id: `bumper-${targetChannelId}-copy-${Date.now()}-${idx}`,
      channelId: targetChannelId,
      updatedAt: new Date().toISOString()
    }));
    const nextRules = [...otherRules, ...clonedForTarget];
    saveAdBreakBumperRulesBackup(nextRules);
    return { adBreakBumperRules: nextRules };
  }),

  resetAdBreakBumperRulesToDefault: () => set(() => {
    const defaults = buildDefaultAdBreakBumperRules();
    saveAdBreakBumperRulesBackup(defaults);
    return { adBreakBumperRules: defaults };
  }),

  setRamadanConfig: (updates) => set(state => {
    const nextConfig = { ...(state.ramadanConfig || {}), ...updates };
    try {
      localStorage.setItem('yayin_ramadan_config_v2', JSON.stringify(nextConfig));
    } catch (e) {
      // ignore
    }
    return { ramadanConfig: nextConfig };
  }),

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

    // Önce sunucu veritabanıyla (.80 & seyare.semerkand.com ortak /api/ads-store) rezervasyonları eşitle
    let syncedServerStore = null;
    if (typeof get().syncAdsStoreWithServer === 'function') {
      syncedServerStore = await get().syncAdsStoreWithServer();
    }

    const latestState = get();
    const backup = loadAdsReservationsBackup();
    const currentReservations =
      Array.isArray(syncedServerStore?.reservations) && syncedServerStore.reservations.length > 0
        ? syncedServerStore.reservations
        : Array.isArray(latestState.reservations) && latestState.reservations.length > 0
        ? latestState.reservations
        : Array.isArray(backup.reservations)
        ? backup.reservations
        : Array.isArray(latestState.reservations)
        ? latestState.reservations
        : null;
    const currentPlacements =
      syncedServerStore?.adPlacements && Object.keys(syncedServerStore.adPlacements).length > 0
        ? syncedServerStore.adPlacements
        : latestState.adPlacements && Object.keys(latestState.adPlacements).length > 0
        ? latestState.adPlacements
        : backup.adPlacements && typeof backup.adPlacements === 'object'
        ? backup.adPlacements
        : latestState.adPlacements && typeof latestState.adPlacements === 'object'
        ? latestState.adPlacements
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
        synced.companies.some(c => String(c.id) === String(latestState.selectedCompanyDetailId))
          ? latestState.selectedCompanyDetailId
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
    const nowIso = new Date().toISOString();
    const newRes = {
      ...reservation,
      id: reservation.id || `res-${Date.now()}`,
      isManual: true,
      createdAt: reservation.createdAt || nowIso,
      updatedAt: nowIso
    };
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
    const nowIso = new Date().toISOString();
    const mapped = state.reservations.map(r => {
      if (String(r.id) === String(id)) {
        updatedTarget = { ...r, ...updatedFields, isManual: true, updatedAt: nowIso };
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
    recordDeletedReservationIdBackup(id);
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
    (state.reservations || []).forEach(r => {
      if (r?.id) recordDeletedReservationIdBackup(r.id);
    });
    const nextReservations = [];
    const nextAdPlacements = {};
    Object.entries(state.adPlacements || {}).forEach(([dayKey, blocks]) => {
      nextAdPlacements[dayKey] = (blocks || []).map(block => ({
        ...block,
        ads: []
      }));
    });
    saveAdsReservationsBackup(nextReservations, nextAdPlacements, {
      replaceReservations: true,
      forceOverwritePlacements: true
    });
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
  // 6. KANAL BAZLI YAYIN VE REKLAM LOGO AYARLARI (YAYIN LİSTE KONTROL ENTEGRASYONLU)
  // ============================================================================
  adSettings: loadChannelLogoSettingsBackup(),

  /**
   * Kanalın ana "Yayına Girerken Girecek Logo" (`broadcastLogoName`) veya
   * "Reklama Girerken Girecek Logo" (`adLogoName`) ismini günceller.
   * syncBumpers=true ise o kanaldaki aynı türdeki (`broadcast_in` / `ad_in`) kuralların logo ismini de otomatik günceller.
   */
  updateChannelPrimaryLogo: (channelId, field, value, syncBumpers = true) => set(state => {
    const chCurrent = state.adSettings?.[channelId] || DEFAULT_CHANNEL_LOGO_SETTINGS[channelId] || {
      broadcastLogoName: '',
      adLogoName: '',
      bumpers: []
    };
    const oldVal = chCurrent[field] || '';
    const targetType = field === 'adLogoName' ? 'ad_in' : 'broadcast_in';

    const nextBumpers = (chCurrent.bumpers || []).map(b => {
      if (!syncBumpers) return b;
      const bType = b.type === 'in' ? 'ad_in' : b.type === 'out' ? 'broadcast_in' : b.type;
      if (bType === targetType && (!b.logoName || b.logoName === oldVal)) {
        return { ...b, logoName: value };
      }
      return b;
    });

    const nextAdSettings = {
      ...state.adSettings,
      [channelId]: {
        ...chCurrent,
        [field]: value,
        bumpers: nextBumpers
      }
    };
    saveChannelLogoSettingsBackup(nextAdSettings);
    return { adSettings: nextAdSettings };
  }),

  addBumper: (channelId, defaultType = 'broadcast_in') => set(state => {
    const chCurrent = state.adSettings?.[channelId] || DEFAULT_CHANNEL_LOGO_SETTINGS[channelId] || {
      broadcastLogoName: '',
      adLogoName: '',
      bumpers: []
    };
    const defaultLogo =
      defaultType === 'ad_in' || defaultType === 'in'
        ? (chCurrent.adLogoName || '')
        : (chCurrent.broadcastLogoName || '');
    const nextAdSettings = {
      ...state.adSettings,
      [channelId]: {
        ...chCurrent,
        bumpers: [
          ...(chCurrent.bumpers || []),
          { id: `logo-${channelId}-${Date.now()}`, name: '', type: defaultType, logoName: defaultLogo }
        ]
      }
    };
    saveChannelLogoSettingsBackup(nextAdSettings);
    return { adSettings: nextAdSettings };
  }),

  updateBumper: (channelId, bumperId, field, value) => set(state => {
    const chCurrent = state.adSettings?.[channelId] || DEFAULT_CHANNEL_LOGO_SETTINGS[channelId] || { bumpers: [] };
    const nextAdSettings = {
      ...state.adSettings,
      [channelId]: {
        ...chCurrent,
        bumpers: (chCurrent.bumpers || []).map(b => {
          if (b.id !== bumperId) return b;
          const updated = { ...b, [field]: value };
          // Eğer giriş türü (Yayına Girerken / Reklama Girerken) değiştiyse ilgili varsayılan logo ismini öner
          if (field === 'type') {
            if ((value === 'ad_in' || value === 'in') && chCurrent.adLogoName) {
              updated.logoName = chCurrent.adLogoName;
            } else if ((value === 'broadcast_in' || value === 'out') && chCurrent.broadcastLogoName) {
              updated.logoName = chCurrent.broadcastLogoName;
            }
          }
          return updated;
        })
      }
    };
    saveChannelLogoSettingsBackup(nextAdSettings);
    return { adSettings: nextAdSettings };
  }),

  removeBumper: (channelId, bumperId) => set(state => {
    const chCurrent = state.adSettings?.[channelId] || DEFAULT_CHANNEL_LOGO_SETTINGS[channelId] || { bumpers: [] };
    const nextAdSettings = {
      ...state.adSettings,
      [channelId]: {
        ...chCurrent,
        bumpers: (chCurrent.bumpers || []).filter(b => b.id !== bumperId)
      }
    };
    saveChannelLogoSettingsBackup(nextAdSettings);
    return { adSettings: nextAdSettings };
  }),

  resetChannelLogoSettingsToDefault: () => set(() => {
    const defaults = buildDefaultChannelLogoSettings();
    saveChannelLogoSettingsBackup(defaults);
    return { adSettings: defaults };
  }),

  /**
   * Seçili kanal ve günün Yayın Liste Kontrol (`listControlDays`) ve Ready (`days`) listelerindeki
   * tüm satırlara kanalın "Yayına Girerken Logo" ve "Reklama Girerken Logo" isimlerini işler.
   */
  applyChannelLogosToListControl: (channelId, dateStr) => set(state => {
    const targetCh = channelId || state.selectedChannel || 'ch_hd';
    const targetDate = dateStr || state.selectedDate;
    const lcKey = `list-control-${targetCh}-${targetDate}`;
    const readyKey = `ready-${targetCh}-${targetDate}`;

    const nextListControlDays = { ...(state.listControlDays || {}) };
    const lcDay = nextListControlDays[lcKey];
    if (lcDay && lcDay.variants) {
      const updatedVariants = { ...lcDay.variants };
      Object.keys(updatedVariants).forEach(vId => {
        const varObj = updatedVariants[vId];
        if (!varObj || !Array.isArray(varObj.programs)) return;
        updatedVariants[vId] = {
          ...varObj,
          programs: varObj.programs.map(prog => ({
            ...prog,
            logo: resolveProgramLogoForChannel({ ...prog, isManualLogo: false }, targetCh, state.adSettings),
            isManualLogo: false
          }))
        };
      });
      nextListControlDays[lcKey] = {
        ...lcDay,
        variants: updatedVariants
      };
    }

    const nextDays = { ...(state.days || {}) };
    const readyDay = nextDays[readyKey];
    if (readyDay && readyDay.variants) {
      const updatedVariants = { ...readyDay.variants };
      Object.keys(updatedVariants).forEach(vId => {
        const varObj = updatedVariants[vId];
        if (!varObj || !Array.isArray(varObj.programs)) return;
        updatedVariants[vId] = {
          ...varObj,
          programs: varObj.programs.map(prog => ({
            ...prog,
            logo: resolveProgramLogoForChannel({ ...prog, isManualLogo: false }, targetCh, state.adSettings)
          }))
        };
      });
      nextDays[readyKey] = {
        ...readyDay,
        variants: updatedVariants
      };
    }

    return {
      listControlDays: nextListControlDays,
      days: nextDays
    };
  }),

  matchAdLogosForReady: () => set(state => {
    const { selectedChannel, selectedDate, days, adSettings } = state;
    const key = `ready-${selectedChannel}-${selectedDate}`;
    const dayData = days[key];
    if (!dayData) return state;

    const newDays = { ...days };
    const newDayData = { ...dayData, variants: { ...dayData.variants } };

    Object.keys(newDayData.variants).forEach(vId => {
      const variant = newDayData.variants[vId];
      const newPrograms = (variant.programs || []).map(prog => ({
        ...prog,
        logo: resolveProgramLogoForChannel(prog, selectedChannel, adSettings)
      }));
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
   * RTÜK Reklam Giriş (1. sıra) ve Reklam Çıkış (son sıra) jenerikleri kilitlidir.
   */
  moveAdInBreak: (channelId, date, blockTimeOrId, adIndex, direction) => set(state => {
    const key = `ready-${channelId}-${date}`;
    const existingBlocks = (state.adPlacements[key] || []).map(b => {
      if (b.blockId === blockTimeOrId || b.time === blockTimeOrId) {
        const nextAds = [...(b.ads || [])];
        if (nextAds[adIndex]?.isBumperAd) return b;
        const targetIdx = adIndex + direction;
        if (targetIdx < 0 || targetIdx >= nextAds.length) return b;
        if (nextAds[targetIdx]?.isBumperAd) return b;
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
   * Belirli bir reklam kuşağındaki spotu sürükle-bırak ile fromIndex konumundan toIndex konumuna taşır.
   * RTÜK Reklam Giriş (1. sıra) ve Reklam Çıkış (son sıra) jenerikleri sabit kalır.
   */
  reorderAdInBreak: (channelId, date, blockTimeOrId, fromIndex, toIndex) => set(state => {
    const key = `ready-${channelId}-${date}`;
    const existingBlocks = (state.adPlacements[key] || []).map(b => {
      if (b.blockId === blockTimeOrId || b.time === blockTimeOrId) {
        const nextAds = [...(b.ads || [])];
        if (fromIndex < 0 || fromIndex >= nextAds.length) return b;
        if (nextAds[fromIndex]?.isBumperAd) return b;
        const [movedItem] = nextAds.splice(fromIndex, 1);

        const firstIsIntro = nextAds[0]?.isBumperAd && nextAds[0]?.bumperType === 'intro';
        const lastIsOutro =
          nextAds.length > 0 &&
          nextAds[nextAds.length - 1]?.isBumperAd &&
          nextAds[nextAds.length - 1]?.bumperType === 'outro';

        const minIdx = firstIsIntro ? 1 : 0;
        const maxIdx = lastIsOutro ? nextAds.length - 1 : nextAds.length;
        const clampedTarget = Math.max(minIdx, Math.min(maxIdx, toIndex));

        nextAds.splice(clampedTarget, 0, movedItem);
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
  }),

  /**
   * Reklam Planlama ekranından veya yayın akışından belirli bir reklam kuşağını
   * Ramazan Özel (Sahur / İftar Öncesi, Arası, Sonrası) olarak işaretler veya işaretini kaldırır.
   */
  setBreakRamadanTag: (channelId, date, blockTimeOrId, ramadanBreakTag) => set(state => {
    const key = `ready-${channelId}-${date}`;
    const existingBlocks = (state.adPlacements[key] || []).map(b => {
      if (b.blockId === blockTimeOrId || b.time === blockTimeOrId) {
        return { ...b, ramadanBreakTag: ramadanBreakTag || '' };
      }
      return b;
    });

    // Ayrıca days[readyKey] içindeki ad_break program satırını da güncelle
    const dayObj = state.days?.[key];
    let nextDays = state.days;
    if (dayObj && dayObj.variants) {
      const activeVar = dayObj.activeVariant || 'v1';
      const currentProgs = dayObj.variants[activeVar]?.programs || [];
      let adCounter = 0;
      const updatedProgs = currentProgs.map(p => {
        const isAd = p.type === 'ad_break' || (p.title && p.title.toLowerCase().includes('reklam'));
        if (isAd) {
          adCounter++;
          const blockIdCandidate = p.instanceId || p.id || `adbreak-${adCounter}`;
          if (
            blockIdCandidate === blockTimeOrId ||
            p.instanceId === blockTimeOrId ||
            p.id === blockTimeOrId ||
            p.title === blockTimeOrId
          ) {
            return { ...p, ramadanBreakTag: ramadanBreakTag || '' };
          }
        }
        return p;
      });
      nextDays = {
        ...state.days,
        [key]: {
          ...dayObj,
          variants: {
            ...dayObj.variants,
            [activeVar]: {
              ...(dayObj.variants[activeVar] || {}),
              programs: updatedProgs
            }
          }
        }
      };
    }

    const nextAdPlacements = {
      ...state.adPlacements,
      [key]: existingBlocks
    };
    saveAdsReservationsBackup(state.reservations, nextAdPlacements);

    return {
      days: nextDays,
      adPlacements: nextAdPlacements
    };
  })
});
