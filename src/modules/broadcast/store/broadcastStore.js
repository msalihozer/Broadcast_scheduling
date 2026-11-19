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

export { BROADCAST_CHANNELS, formatFramesHuman, renumberAdBreaksInList };

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

export default useBroadcastStore;
