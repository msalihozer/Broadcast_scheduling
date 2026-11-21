import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createUiSlice } from './slices/uiSlice';
import { createSelectionSlice } from './slices/selectionSlice';
import createTimelineSliceDefault, { createTimelineSlice as createTimelineSliceNamed } from './slices/timelineSlice';
import { createHistorySlice } from './slices/historySlice';
import { createDraftSlice } from './slices/draftSlice';
import { createReadySlice } from './slices/readySlice';
import { createAdsSlice, ADS_CATALOG_VERSION, initialSyncedCatalog, loadAdsReservationsBackup, saveAdsReservationsBackup } from './slices/adsSlice';
import { loadChannelLogoSettingsBackup } from './slices/ads/adsCatalogHelpers';
import { createListControlSlice } from './slices/listControlSlice';

const createTimelineSlice = createTimelineSliceNamed || createTimelineSliceDefault;

const CHANNELS = [
  { id: 'ch_hd', name: 'Semerkand HD' },
  { id: 'ch_way', name: 'Semerkand WAY' }
];

const SAMPLE_IDS = new Set(['P-101', 'P-102', 'P-103', 'P-104', 'P-105', 'P-106', 'P-107', 'P-108', 'P-109', 'P-110']);

/**
 * @file planningStore.js
 * @description Ana Zustand Yayın Planlama Store'u.
 * 
 * Durum Dilimleri (Slices Haritası):
 * - createUiSlice: currentMode ('draft' | 'ready' | 'list-control'), viewMode, dragPreview
 * - createSelectionSlice: selectedTimelineBlock, selectedInstanceIds (çoklu seçim), insertPosition
 * - createTimelineSlice: days nesnesi, addProgramToDay, removePrograms, _propagateOverflows
 * - createHistorySlice: pastStates, undo, redo, _saveSnapshot
 * - createDraftSlice: importWeeklyFlow, taslak varyantları (A/B), pullFromDraftToReady
 * - createReadySlice: lockStage1, pullWeekFromDraftToReady
 * - createAdsSlice: companies, products, materials, reservations, timeBlocks
 * - createListControlSlice: listControlDays, lockStage2
 * 
 * Gün Anahtarı Formatı (Storage Key Convention):
 * - `${mode}-${channelId}-${dateStr}` (Örn: "draft-ch_hd-2025-10-27")
 * - `list-control-${channelId}-${dateStr}` (Liste kontrol için)
 */
const usePlanningStore = create(
  persist(
    (set, get) => ({
      channels: CHANNELS,
      libraryPrograms: [],

      // Combine all slices
      ...createUiSlice(set, get),
      ...createSelectionSlice(set, get),
      ...createTimelineSlice(set, get),
      ...createHistorySlice(set, get),
      ...createDraftSlice(set, get),
      ...createReadySlice(set, get),
      ...createAdsSlice(set, get),
      ...createListControlSlice(set, get),
    }),
    {
      name: 'yayin-planlama-storage',
      // We don't want to persist temporary UI states, stale adFilters, or heavy auto-synced arrays
      partialize: (state) => {
        const {
          dragPreview,
          isCtrlPressed,
          pastStates,
          selectedTimelineBlock,
          selectedDate,
          channels,
          currentMode,
          adFilters,
          pendingMaterialProductId,
          selectedMaterialDetailId,
          adsSyncInfo,
          libraryPrograms,
          companies,
          products,
          materials,
          ...rest
        } = state;
        return {
          ...rest,
          manualCompanies: (companies || []).filter(c => c.isManual),
          manualProducts: (products || []).filter(p => p.isManual),
          manualMaterials: (materials || []).filter(m => m.isManual)
        };
      },
      merge: (persistedState, currentState) => {
        const pState = persistedState || {};
        const manualCompanies = Array.isArray(pState.manualCompanies)
          ? pState.manualCompanies
          : Array.isArray(pState.companies)
          ? pState.companies.filter(c => c && c.isManual)
          : [];
        const manualProducts = Array.isArray(pState.manualProducts)
          ? pState.manualProducts
          : Array.isArray(pState.products)
          ? pState.products.filter(p => p && p.isManual)
          : [];
        const manualMaterials = Array.isArray(pState.manualMaterials)
          ? pState.manualMaterials
          : Array.isArray(pState.materials)
          ? pState.materials.filter(m => m && m.isManual)
          : [];

        const mergedCompanies = [
          ...manualCompanies,
          ...initialSyncedCatalog.companies.filter(c => !manualCompanies.some(mc => String(mc.id) === String(c.id)))
        ];
        const mergedProducts = [
          ...manualProducts,
          ...initialSyncedCatalog.products.filter(p => !manualProducts.some(mp => String(mp.id) === String(p.id)))
        ];
        const mergedMaterials = [
          ...manualMaterials,
          ...initialSyncedCatalog.materials.filter(m => !manualMaterials.some(mm => String(mm.id) === String(m.id)))
        ];

        const backup = loadAdsReservationsBackup();
        const rawReservations = Array.isArray(backup.reservations)
          ? backup.reservations
          : Array.isArray(pState.reservations)
          ? pState.reservations
          : [];
        const persistedReservations = rawReservations.filter(
          r => r && !String(r.id).startsWith('res-auto-')
        );

        const rawPlacements = backup.adPlacements && typeof backup.adPlacements === 'object'
          ? backup.adPlacements
          : pState.adPlacements && typeof pState.adPlacements === 'object'
          ? pState.adPlacements
          : {};
        const persistedPlacements = {};
        Object.entries(rawPlacements).forEach(([dayKey, blocks]) => {
          const cleanedBlocks = (blocks || [])
            .map(b => ({
              ...b,
              ads: (b.ads || []).filter(ad => ad && !String(ad.reservationId).startsWith('res-auto-'))
            }))
            .filter(b => Array.isArray(b.ads) && b.ads.length > 0);
          if (cleanedBlocks.length > 0) {
            persistedPlacements[dayKey] = cleanedBlocks;
          }
        });

        // Eski örnek/şablon (P-101..P-110) gün kayıtlarını temizle
        const cleanedDays = {};
        Object.entries(pState.days || {}).forEach(([dayKey, dayObj]) => {
          const progs = dayObj?.variants?.[dayObj?.activeVariant || 'v1']?.programs || [];
          const isSampleDay = progs.some(p => p && SAMPLE_IDS.has(String(p.id)));
          if (!isSampleDay) {
            cleanedDays[dayKey] = dayObj;
          }
        });

        saveAdsReservationsBackup(persistedReservations, persistedPlacements);

        const loadedLogoSettings = loadChannelLogoSettingsBackup();

        return {
          ...currentState,
          ...pState,
          adSettings: loadedLogoSettings,
          days: cleanedDays,
          adsCatalogVersion: ADS_CATALOG_VERSION,
          channels: CHANNELS,
          adFilters: { companyId: '', productId: '' },
          companies: mergedCompanies,
          products: mergedProducts,
          materials: mergedMaterials,
          reservations: persistedReservations,
          adPlacements: persistedPlacements
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.channels = CHANNELS;
          if (!state.companies?.length || !state.products?.length || !state.materials?.length) {
            if (typeof state.loadAdsData === 'function') {
              state.loadAdsData();
            }
          }
          if (typeof state.syncAdsCatalogFromArchive === 'function') {
            setTimeout(() => {
              state.syncAdsCatalogFromArchive({ showNotification: false });
            }, 50);
          }
        }
      }
    }
  )
);

export default usePlanningStore;
