/**
 * @file src/modules/broadcast/store/broadcastStore.js
 * @description Modüler 25 FPS Yayın Planlama (Broadcast Planning) Zustand Store ana giriş dosyası.
 *
 * Mimari Dilimler (Slices):
 * 1. `navigationAndUiSlice.js`      -> Kanal, Tarih, Liste A/B, Görünüm, Yan Panel, Ekleme Konumu (`insertPosition`) ve Undo/Redo
 * 2. `timelineCalculationSlice.js`  -> 25 FPS Timecode (`HH.MM.SS.FF`), Dünden Devir ve Ertesi Güne Sarkma (Overflow) hesaplamaları
 * 3. `programCrudSlice.js`          -> Program, Klip, İntro, Canlı Yayın, Dolgu Kuşağı ve Reklam Kuşağı CRUD & Sıralama işlemleri
 * 4. `clipboardAndSyncSlice.js`     -> Pano (Kopyala/Yapıştır: En Üst, Seçilenin Altı, En Alt, Tümünü Değiştir), Taslak Aktarımı ve Reklam/Kayıt Senkronizasyonu
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  BROADCAST_CHANNELS,
  formatFramesHuman,
  renumberAdBreaksInList
} from './broadcastStoreHelpers';
import { createNavigationAndUiSlice } from './slices/navigationAndUiSlice';
import { createTimelineCalculationSlice } from './slices/timelineCalculationSlice';
import { createProgramCrudSlice } from './slices/programCrudSlice';
import { createClipboardAndSyncSlice } from './slices/clipboardAndSyncSlice';
import { pushAdsStoreToServer } from '../../../store/slices/ads/adsCatalogHelpers';

export { BROADCAST_CHANNELS, formatFramesHuman, renumberAdBreaksInList };

let isApplyingRemoteBroadcastDays = false;
let broadcastSyncTimer = null;

export function applyServerBroadcastDaysToStore(serverBroadcastDays = {}, deletedDayKeys = []) {
  if (!serverBroadcastDays || typeof serverBroadcastDays !== 'object') return;
  const currentDays = useBroadcastStore.getState().days || {};
  const deletedSet = new Set(Array.isArray(deletedDayKeys) ? deletedDayKeys.map(String) : []);
  let hasChanges = false;
  const nextDays = { ...currentDays };

  // Silinmiş günleri yerel broadcastStore'dan da kaldır
  if (deletedSet.size > 0) {
    Object.keys(nextDays).forEach(k => {
      if (deletedSet.has(String(k))) {
        delete nextDays[k];
        hasChanges = true;
      }
    });
  }

  Object.entries(serverBroadcastDays).forEach(([dayKey, serverDay]) => {
    if (deletedSet.has(String(dayKey))) return;
    if (!serverDay || typeof serverDay !== 'object') return;
    const localDay = currentDays[dayKey];
    const localTime = Number(localDay?.updatedAt || localDay?.savedAt || 0) || (localDay?.updatedAt ? new Date(localDay.updatedAt).getTime() : 0);
    const serverTime = Number(serverDay?.updatedAt || serverDay?.savedAt || 0) || (serverDay?.updatedAt ? new Date(serverDay.updatedAt).getTime() : 0);
    const localCount =
      (localDay?.variants?.A?.programs?.length || 0) +
      (localDay?.variants?.B?.programs?.length || 0);
    const serverCount =
      (serverDay?.variants?.A?.programs?.length || 0) +
      (serverDay?.variants?.B?.programs?.length || 0);

    if (!localDay || serverTime > localTime || (localCount === 0 && serverCount > 0)) {
      nextDays[dayKey] = serverDay;
      hasChanges = true;
    }
  });

  if (hasChanges) {
    isApplyingRemoteBroadcastDays = true;
    try {
      useBroadcastStore.setState({ days: nextDays });
    } finally {
      setTimeout(() => {
        isApplyingRemoteBroadcastDays = false;
      }, 50);
    }
  }
}

const useBroadcastStore = create(
  persist(
    (set, get) => ({
      ...createNavigationAndUiSlice(set, get),
      ...createTimelineCalculationSlice(set, get),
      ...createProgramCrudSlice(set, get),
      ...createClipboardAndSyncSlice(set, get)
    }),
    {
      name: 'broadcast_planning_v3',
      partialize: (state) => ({
        days: state.days,
        selectedChannel: state.selectedChannel,
        selectedDate: state.selectedDate,
        activeList: state.activeList,
        viewMode: state.viewMode,
        insertPosition: state.insertPosition,
        adBreakDefaultSettings: state.adBreakDefaultSettings,
        introDefaultSettings: state.introDefaultSettings,
        isDraftSidebarOpen: state.isDraftSidebarOpen,
        activeSidebarTab: state.activeSidebarTab,
        clipboardItems: state.clipboardItems,
        clipboardMeta: state.clipboardMeta,
        clipboardHistory: Array.isArray(state.clipboardHistory)
          ? state.clipboardHistory.slice(0, 5)
          : []
      })
    }
  )
);

// Yayın Planlama (BroadcastStore) üzerinde yapılan her değişikliği (.80 IP <-> seyare.semerkand.com eşitliği için) sunucuya otomatik kaydet
let prevDaysRef = useBroadcastStore.getState().days;
useBroadcastStore.subscribe((state) => {
  if (isApplyingRemoteBroadcastDays) return;
  if (state.days !== prevDaysRef) {
    const changedDays = {};
    const nowMs = Date.now();
    Object.entries(state.days || {}).forEach(([k, v]) => {
      if (v && v !== prevDaysRef?.[k]) {
        changedDays[k] = {
          ...v,
          updatedAt: nowMs
        };
      }
    });
    prevDaysRef = state.days;

    if (Object.keys(changedDays).length > 0) {
      if (broadcastSyncTimer) clearTimeout(broadcastSyncTimer);
      broadcastSyncTimer = setTimeout(() => {
        pushAdsStoreToServer({ broadcastDays: changedDays });
      }, 350);
    }
  }
});

export default useBroadcastStore;
