/**
 * @file src/modules/broadcast/store/slices/navigationAndUiSlice.js
 * @description Yayın Planlama Store'unun Navigasyon, Arayüz (UI), Varsayılan Reklam Ayarları,
 * Ekleme Konumu (`insertPosition`), Taslak Senkronizasyonu ve Geri Al / İleri Al (Undo/Redo) dilimi.
 */
import { format, parseISO, addDays, subDays } from 'date-fns';
import { getDraftProgramsForDay } from '../../utils/draftDataLoader';
import { timecodeToFrames, secondsToTimecode } from '../../utils/timecodeUtils';

/**
 * Navigasyon, UI, Ekleme Konumu ve Undo/Redo durum ve aksiyonlarını oluşturur.
 */
export const createNavigationAndUiSlice = (set, get) => ({
  // Aktif Kanal, Tarih, Liste (A/B) ve Görünüm Modu
  selectedChannel: 'ch_hd',
  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  activeList: 'A', // 'A' | 'B'
  viewMode: 'daily', // 'daily' | 'weekly' | 'monthly'
  isDraftSidebarOpen: true,
  activeSidebarTab: 'draft', // 'draft' | 'clip_search' | 'filler'
  activeFillerItem: null,
  draftVersion: 0,

  // Reklam Kuşağı Varsayılan Ayarları (Bundan sonra eklenecek tüm reklam kuşakları için geçerli olur)
  adBreakDefaultSettings: {
    durationMinutes: 5,
    durationSeconds: 0,
    durationTc: '00.05.00.00',
    note: 'Ticari Reklam Bloğu'
  },

  setAdBreakDefaultSettings: (newSettings = {}) => set(state => {
    const current = state.adBreakDefaultSettings || {
      durationMinutes: 5,
      durationSeconds: 0,
      durationTc: '00.05.00.00',
      note: 'Ticari Reklam Bloğu'
    };
    const min = newSettings.durationMinutes !== undefined
      ? Math.max(0, Math.min(180, Number(newSettings.durationMinutes) || 0))
      : current.durationMinutes;
    const sec = newSettings.durationSeconds !== undefined
      ? Math.max(0, Math.min(59, Number(newSettings.durationSeconds) || 0))
      : current.durationSeconds;
    const mStr = String(min).padStart(2, '0');
    const sStr = String(sec).padStart(2, '0');
    const computedTc = newSettings.durationTc || `00.${mStr}.${sStr}.00`;
    const note = newSettings.note !== undefined ? String(newSettings.note) : current.note;

    return {
      adBreakDefaultSettings: {
        durationMinutes: min,
        durationSeconds: sec,
        durationTc: computedTc,
        note
      }
    };
  }),

  // updateAdBreakDefaultSettings takma adı (SummaryBar uyumluluğu için)
  updateAdBreakDefaultSettings: (newSettings = {}) => get().setAdBreakDefaultSettings(newSettings),

  // Varsayılan İntro Ayarları ve Otomatik İntro Yerleştirme (Açık / Kapalı)
  introDefaultSettings: {
    autoInsertIntro: true,
    fileId: 725,
    name: 'SEMERKAND_intro_v3_2014',
    fileName: 'SEMERKAND_intro_v3_2014',
    durationSec: 26,
    durationTc: '00.00.26.00',
    category: 'Jenerik / İntro'
  },

  setIntroDefaultSettings: (newSettings = {}) => set(state => {
    const current = state.introDefaultSettings || {
      autoInsertIntro: true,
      fileId: 725,
      name: 'SEMERKAND_intro_v3_2014',
      fileName: 'SEMERKAND_intro_v3_2014',
      durationSec: 26,
      durationTc: '00.00.26.00',
      category: 'Jenerik / İntro'
    };
    const autoInsertIntro = newSettings.autoInsertIntro !== undefined
      ? Boolean(newSettings.autoInsertIntro)
      : current.autoInsertIntro;
    const fileId = newSettings.fileId !== undefined ? newSettings.fileId : current.fileId;
    const name = newSettings.name || newSettings.fileName || current.name || 'SEMERKAND_intro_v3_2014';
    const durationSec = newSettings.durationSec !== undefined
      ? Math.max(1, Number(newSettings.durationSec) || 26)
      : current.durationSec;
    const durationTc = newSettings.durationTc || secondsToTimecode(durationSec);
    const category = newSettings.category || current.category || 'Jenerik / İntro';

    return {
      introDefaultSettings: {
        autoInsertIntro,
        fileId,
        name,
        fileName: name,
        durationSec,
        durationTc,
        category
      }
    };
  }),

  toggleAutoInsertIntro: () => set(state => {
    const current = state.introDefaultSettings || {
      autoInsertIntro: true,
      fileId: 725,
      name: 'SEMERKAND_intro_v3_2014',
      fileName: 'SEMERKAND_intro_v3_2014',
      durationSec: 26,
      durationTc: '00.00.26.00',
      category: 'Jenerik / İntro'
    };
    return {
      introDefaultSettings: {
        ...current,
        autoInsertIntro: !current.autoInsertIntro
      }
    };
  }),

  // Seçili Satır ve Ekleneceği Yer Konumu ('top' = En Üst | 'after_selected' = Seçilenin Altına | 'bottom' = En Alt)
  insertPosition: 'after_selected',
  setInsertPosition: (pos) => set({
    insertPosition: ['top', 'after_selected', 'bottom'].includes(pos) ? pos : 'after_selected'
  }),
  selectedInstanceId: null,
  selectedInstanceIds: [],
  setSelectedInstanceIds: (idsOrUpdater) => set(state => {
    const next = typeof idsOrUpdater === 'function'
      ? idsOrUpdater(state.selectedInstanceIds || [])
      : (Array.isArray(idsOrUpdater) ? idsOrUpdater : []);
    return { selectedInstanceIds: next };
  }),

  // Geri Al / İleri Al Geçmişi (Undo / Redo)
  historyPast: [],
  historyFuture: [],

  // Günlük Veri Sözlüğü: `${channelId}-${dateStr}` => { variants: { A: { programs: [] }, B: { programs: [] } } }
  days: {},

  // Kanal, Tarih ve Liste Seçimi Aksiyonları
  setSelectedChannel: (channelId) => set(state => ({
    selectedChannel: channelId,
    selectedInstanceId: null,
    selectedInstanceIds: [],
    activeFillerItem: null,
    activeSidebarTab: state.activeSidebarTab === 'filler' ? 'draft' : state.activeSidebarTab
  })),
  setSelectedDate: (dateStr) => set(state => ({
    selectedDate: dateStr,
    selectedInstanceId: null,
    selectedInstanceIds: [],
    activeFillerItem: null,
    activeSidebarTab: state.activeSidebarTab === 'filler' ? 'draft' : state.activeSidebarTab
  })),

  navigateDay: (daysCount) => {
    const current = parseISO(get().selectedDate);
    const newDate = daysCount > 0 ? addDays(current, daysCount) : subDays(current, Math.abs(daysCount));
    set(state => ({
      selectedDate: format(newDate, 'yyyy-MM-dd'),
      selectedInstanceId: null,
      selectedInstanceIds: [],
      activeFillerItem: null,
      activeSidebarTab: state.activeSidebarTab === 'filler' ? 'draft' : state.activeSidebarTab
    }));
  },

  goToToday: () => set(state => ({
    selectedDate: format(new Date(), 'yyyy-MM-dd'),
    selectedInstanceId: null,
    selectedInstanceIds: [],
    activeFillerItem: null,
    activeSidebarTab: state.activeSidebarTab === 'filler' ? 'draft' : state.activeSidebarTab
  })),
  setActiveList: (listType) => set(state => ({
    activeList: listType === 'B' ? 'B' : 'A',
    selectedInstanceId: null,
    selectedInstanceIds: [],
    activeFillerItem: null,
    activeSidebarTab: state.activeSidebarTab === 'filler' ? 'draft' : state.activeSidebarTab
  })),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedInstanceId: (instanceId) => set({ selectedInstanceId: instanceId }),

  // Sol Taslak / Klip Arama / Dolgu Kuşağı Paneli Kontrolleri
  toggleDraftSidebar: () => set(state => ({ isDraftSidebarOpen: !state.isDraftSidebarOpen })),
  setDraftSidebarOpen: (isOpen) => set({ isDraftSidebarOpen: Boolean(isOpen) }),
  setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab, isDraftSidebarOpen: true }),
  openFillerInSidebar: (fillerItem) => set({
    activeFillerItem: fillerItem ? { ...fillerItem } : null,
    activeSidebarTab: 'filler',
    isDraftSidebarOpen: true
  }),
  closeFillerSidebar: () => set(state => ({
    activeFillerItem: null,
    activeSidebarTab: state.activeSidebarTab === 'filler' ? 'draft' : state.activeSidebarTab
  })),

  /**
   * Taslak Planlama modülünde yapılan güncellemeleri (bölüm, cüz, süre, başlık veya silinen günler)
   * Yayın Planlama akışındaki yer tutucularla anında senkronize eder.
   */
  notifyDraftUpdated: (updatedChannelId = null) => set(state => {
    const nextDays = { ...state.days };
    let daysChanged = false;

    for (const [dayKey, dayObj] of Object.entries(nextDays)) {
      if (!dayObj || !dayObj.variants) continue;
      const dashIdx = dayKey.indexOf('-');
      if (dashIdx === -1) continue;
      const chId = dayKey.slice(0, dashIdx);
      const dateStr = dayKey.slice(dashIdx + 1);
      if (updatedChannelId && chId !== updatedChannelId) continue;

      const liveDraftSlots = getDraftProgramsForDay(chId, dateStr);
      const nextVariants = { ...dayObj.variants };
      let variantChanged = false;

      ['A', 'B'].forEach(vKey => {
        const varObj = nextVariants[vKey];
        if (!varObj) return;
        const progs = Array.isArray(varObj.programs) ? varObj.programs : [];

        if (liveDraftSlots.length === 0) {
          const hadUnadded = Array.isArray(varObj.unaddedDraftSlots) && varObj.unaddedDraftSlots.length > 0;
          if (hadUnadded) {
            nextVariants[vKey] = {
              ...varObj,
              programs: progs,
              unaddedDraftSlots: []
            };
            variantChanged = true;
          }
        } else if (progs.length > 0) {
          let progListChanged = false;
          const updatedProgs = progs.map(p => {
            if (!p.isFromDraft || p.type !== 'program') return p;
            const matchedSlot = liveDraftSlots.find(s =>
              (p.draftId && s.id === p.draftId) ||
              (p.draftStartTime && s.startTime === p.draftStartTime)
            );
            if (!matchedSlot) return p;

            const newDurSec = matchedSlot.durationSec || ((matchedSlot.duration || 30) * 60);
            const newDurTc = matchedSlot.durationFormatted || secondsToTimecode(newDurSec);
            const newDurFrames = timecodeToFrames(newDurTc);
            const newEp = matchedSlot.episode || null;

            if (
              p.title !== matchedSlot.title ||
              String(p.episodeNo || '') !== String(newEp || '') ||
              p.unitLabel !== matchedSlot.unitLabel ||
              p.durationFrames !== newDurFrames
            ) {
              progListChanged = true;
              return {
                ...p,
                title: matchedSlot.title,
                name: matchedSlot.name || matchedSlot.title,
                episodeNo: newEp,
                unitType: matchedSlot.unitType || p.unitType,
                unitLabel: matchedSlot.unitLabel || p.unitLabel,
                durationTc: newDurTc,
                durationFrames: newDurFrames,
                durationSec: newDurSec,
                note: matchedSlot.note || p.note
              };
            }
            return p;
          });

          if (progListChanged) {
            nextVariants[vKey] = {
              ...varObj,
              programs: updatedProgs
            };
            variantChanged = true;
          }
        }
      });

      if (variantChanged) {
        nextDays[dayKey] = {
          ...dayObj,
          variants: nextVariants
        };
        daysChanged = true;
      }
    }

    return {
      draftVersion: (state.draftVersion || 0) + 1,
      ...(daysChanged ? { days: nextDays } : {})
    };
  }),

  // Geçmişi kaydet (Undo için snapshot alma)
  pushHistorySnapshot: () => {
    const currentDays = JSON.parse(JSON.stringify(get().days));
    set(state => ({
      historyPast: [...state.historyPast.slice(-20), currentDays],
      historyFuture: []
    }));
  },

  // Undo (Geri Al)
  undo: () => {
    const { historyPast, historyFuture, days } = get();
    if (historyPast.length === 0) return;

    const previousDays = historyPast[historyPast.length - 1];
    const newPast = historyPast.slice(0, historyPast.length - 1);

    set({
      days: previousDays,
      historyPast: newPast,
      historyFuture: [JSON.parse(JSON.stringify(days)), ...historyFuture.slice(0, 20)]
    });
  },

  // Redo (İleri Al)
  redo: () => {
    const { historyPast, historyFuture, days } = get();
    if (historyFuture.length === 0) return;

    const nextDays = historyFuture[0];
    const newFuture = historyFuture.slice(1);

    set({
      days: nextDays,
      historyPast: [...historyPast, JSON.parse(JSON.stringify(days))],
      historyFuture: newFuture
    });
  }
});

