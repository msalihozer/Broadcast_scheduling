/**
 * @file uiSlice.js
 * @description Manages UI-related state such as theme, sidebar width, view modes, and table column widths.
 */
export const createUiSlice = (set, get) => ({
  theme: 'light',
  setTheme: (theme) => set({ theme }),

  sidebarWidth: 320,
  isSidebarOpen: true,
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  showMediaLibrary: true,
  toggleMediaLibrary: () => set((state) => ({ showMediaLibrary: !state.showMediaLibrary })),

  showSpecialTemplates: true,
  setPanelsVisibility: (updater) => set((state) => ({ ...updater })),

  currentMode: 'draft',
  setCurrentMode: (mode) => set({ currentMode: mode }),

  viewMode: 'weekly',
  setViewMode: (mode) => set({ viewMode: mode }),

  insertPosition: 'en_alt',
  setInsertPosition: (pos) => set({ insertPosition: pos }),

  minuteScale: 4,
  setMinuteScale: (scale) => set({ minuteScale: scale }),

  hiddenCategoryIds: [],
  setHiddenCategoryIds: (ids) => set({ hiddenCategoryIds: ids }),

  timelineColumns: [
    { id: 'index', width: 60, label: 'SIRA', resizable: false },
    { id: 'start', width: 100, label: 'BAŞLANGIÇ' },
    { id: 'duration', width: 90, label: 'SÜRE' },
    { id: 'icon', width: 60, label: 'TÜR', resizable: false },
    { id: 'title', width: -1, label: 'PROGRAM ADI' },
    { id: 'id', width: 100, label: 'ID' },
    { id: 'trimIn', width: 100, label: 'TRIM IN' },
    { id: 'trimOut', width: 100, label: 'TRIM OUT' },
    { id: 'logo', width: 160, label: 'LOGO' },
    { id: 'category', width: 120, label: 'KATEGORİ' },
    { id: 'status', width: 120, label: 'DURUM' }
  ],
  setColumnWidth: (id, width) => set(state => ({
    timelineColumns: state.timelineColumns.map(col => col.id === id ? { ...col, width } : col)
  }))
});
