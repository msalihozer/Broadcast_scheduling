/**
 * @file listControlSlice.js
 * @description Yayın Liste Kontrol Durum Dilimi.
 * 
 * Temel Sorumluluklar:
 * 1. listControlDays nesnesi: Liste kontrol ekranına özel gün ve varyant kayıtları
 * 2. lcAddProgramToDay / lcRemovePrograms: Operatör müdahaleleri
 * 3. 2. Aşama Kilidi (Stage 2 Lock): Kesinleşen akışın dondurulması
 */
import { calculateTotalCount, _recalculateStartTimes, createEmptyDay, _propagateOverflows } from '../storeHelpers';
import { pushAdsStoreToServer, resolveProgramLogoForChannel } from './ads/adsCatalogHelpers';

const syncListControlDayToServer = (key, dayObj) => {
  if (!key || !dayObj) return;
  pushAdsStoreToServer({
    listControlDays: {
      [key]: dayObj
    }
  });
};

export const createListControlSlice = (set, get) => ({
  listControlDays: {},

  lcEnsureDayExists: (channelId, dateStr) => {
    const key = `list-control-${channelId}-${dateStr}`;
    const state = get();
    if (!state.listControlDays[key]) {
      set((s) => ({
        listControlDays: { ...s.listControlDays, [key]: createEmptyDay(dateStr) }
      }));
    }
    return key;
  },

  lcAddProgramToDay: (channelId, date, variant, program, insertIndex = -1, providedInstanceId) => {
    get()._saveSnapshot();
    const key = get().lcEnsureDayExists(channelId, date);
    set((state) => {
      const day = state.listControlDays[key];
      if (!day) return state;

      const newInstanceId = providedInstanceId || `${program.id}-${Date.now()}`;
      const newProgram = {
        ...program,
        instanceId: newInstanceId,
        logo: program.logo || resolveProgramLogoForChannel(program, channelId, state.adSettings)
      };
      
      let currentPrograms = [...day.variants[variant].programs];
      
      let finalIndex = insertIndex;
      if (finalIndex === -1) {
         if (state.insertPosition === 'en_ust') {
           finalIndex = 0;
         } else if (state.insertPosition === 'ust') {
           finalIndex = state.lastSelectedIndex !== -1 ? state.lastSelectedIndex : 0;
         } else if (state.insertPosition === 'alt') {
           finalIndex = state.lastSelectedIndex !== -1 ? state.lastSelectedIndex + 1 : currentPrograms.length;
         } else {
           finalIndex = currentPrograms.length;
         }
      }

      if (finalIndex >= currentPrograms.length) {
        currentPrograms.push(newProgram);
      } else {
        currentPrograms.splice(finalIndex, 0, newProgram);
      }
      
      const updatedPrograms = _recalculateStartTimes(currentPrograms, day.startTime || 0);
      const updatedDay = {
        ...day,
        updatedAt: new Date().toISOString(),
        variants: {
          ...day.variants,
          [variant]: { ...day.variants[variant], programs: updatedPrograms }
        }
      };

      syncListControlDayToServer(key, updatedDay);

      const newState = {
        listControlDays: {
          ...state.listControlDays,
          [key]: updatedDay
        }
      };
      
      return newState;
    });
  },

  lcMoveProgramUp: (channelId, date, variant, instanceId) => {
    get()._saveSnapshot();
    set((state) => {
      const key = `list-control-${channelId}-${date}`;
      const day = state.listControlDays[key];
      if (!day) return state;

      const programs = [...day.variants[variant].programs];
      const index = programs.findIndex(p => p.instanceId === instanceId);
      if (index <= 0) return state;

      const temp = programs[index - 1];
      programs[index - 1] = programs[index];
      programs[index] = temp;

      const updatedPrograms = _recalculateStartTimes(programs, day.startTime || 0);
      const updatedDay = {
        ...day,
        updatedAt: new Date().toISOString(),
        variants: { ...day.variants, [variant]: { ...day.variants[variant], programs: updatedPrograms } }
      };
      syncListControlDayToServer(key, updatedDay);

      return {
        listControlDays: {
          ...state.listControlDays,
          [key]: updatedDay
        }
      };
    });
  },

  lcMoveProgramDown: (channelId, date, variant, instanceId) => {
    get()._saveSnapshot();
    set((state) => {
      const key = `list-control-${channelId}-${date}`;
      const day = state.listControlDays[key];
      if (!day) return state;

      const programs = [...day.variants[variant].programs];
      const index = programs.findIndex(p => p.instanceId === instanceId);
      if (index === -1 || index >= programs.length - 1) return state;

      const temp = programs[index + 1];
      programs[index + 1] = programs[index];
      programs[index] = temp;

      const updatedPrograms = _recalculateStartTimes(programs, day.startTime || 0);
      const updatedDay = {
        ...day,
        updatedAt: new Date().toISOString(),
        variants: { ...day.variants, [variant]: { ...day.variants[variant], programs: updatedPrograms } }
      };
      syncListControlDayToServer(key, updatedDay);

      return {
        listControlDays: {
          ...state.listControlDays,
          [key]: updatedDay
        }
      };
    });
  },

  lcReorderProgram: (channelId, date, variant, oldIndex, newIndex) => {
    get()._saveSnapshot();
    set((state) => {
      const key = `list-control-${channelId}-${date}`;
      const day = state.listControlDays[key];
      if (!day) return state;

      const programs = [...day.variants[variant].programs];
      if (oldIndex < 0 || oldIndex >= programs.length || newIndex < 0 || newIndex >= programs.length) return state;

      const [movedItem] = programs.splice(oldIndex, 1);
      programs.splice(newIndex, 0, movedItem);

      const updatedPrograms = _recalculateStartTimes(programs, day.startTime || 0);
      const updatedDay = {
        ...day,
        updatedAt: new Date().toISOString(),
        variants: { ...day.variants, [variant]: { ...day.variants[variant], programs: updatedPrograms } }
      };
      syncListControlDayToServer(key, updatedDay);

      return {
        listControlDays: {
          ...state.listControlDays,
          [key]: updatedDay
        }
      };
    });
  },

  lcDuplicateProgram: (channelId, date, variant, instanceId) => {
    get()._saveSnapshot();
    set((state) => {
      const key = `list-control-${channelId}-${date}`;
      const day = state.listControlDays[key];
      if (!day) return state;

      const programs = [...day.variants[variant].programs];
      const index = programs.findIndex(p => p.instanceId === instanceId);
      if (index === -1) return state;

      const programToCopy = programs[index];
      const newProgram = { ...programToCopy, instanceId: `${programToCopy.id}-${Date.now()}` };
      programs.splice(index + 1, 0, newProgram);

      const updatedPrograms = _recalculateStartTimes(programs, day.startTime || 0);
      const updatedDay = {
        ...day,
        updatedAt: new Date().toISOString(),
        variants: { ...day.variants, [variant]: { ...day.variants[variant], programs: updatedPrograms } }
      };
      syncListControlDayToServer(key, updatedDay);

      return {
        listControlDays: {
          ...state.listControlDays,
          [key]: updatedDay
        }
      };
    });
  },

  lcUpdateProgramTime: (channelId, date, variant, instanceId, newDuration, newStartMinute, newTitle) => {
    get()._saveSnapshot();
    set((state) => {
      const key = `list-control-${channelId}-${date}`;
      const day = state.listControlDays[key];
      if (!day) return state;

      const programs = [...day.variants[variant].programs];
      const index = programs.findIndex(p => p.instanceId === instanceId);
      if (index === -1) return state;

      if (newDuration !== undefined) {
        programs[index].duration = newDuration;
      }
      
      if (newTitle !== undefined) {
        programs[index].title = newTitle;
      }
      
      let updatedPrograms;
      let newDayStartTime = day.startTime;
      
      if (newStartMinute !== undefined) {
         if (index === 0) {
           newDayStartTime = newStartMinute;
         }
         programs[index].startMinute = newStartMinute;
         updatedPrograms = [...programs];
         let currentStart = newStartMinute + updatedPrograms[index].duration;
         for (let i = index + 1; i < updatedPrograms.length; i++) {
             updatedPrograms[i].startMinute = currentStart;
             currentStart += updatedPrograms[i].duration;
         }
      } else {
         updatedPrograms = _recalculateStartTimes(programs, newDayStartTime || 0);
      }

      const updatedDay = {
        ...day,
        startTime: newDayStartTime,
        updatedAt: new Date().toISOString(),
        variants: { ...day.variants, [variant]: { ...day.variants[variant], programs: updatedPrograms } }
      };
      syncListControlDayToServer(key, updatedDay);

      return {
        listControlDays: {
          ...state.listControlDays,
          [key]: updatedDay
        }
      };
    });
  },

  lcRemovePrograms: (channelId, date, variant, instanceIds, programIds) => {
    get()._saveSnapshot();
    set((state) => {
      const key = `list-control-${channelId}-${date}`;
      const day = state.listControlDays[key];
      if (!day) return state;

      const programs = day.variants[variant].programs.filter(p => !instanceIds.includes(p.instanceId));
      const updatedPrograms = _recalculateStartTimes(programs, day.startTime || 0);
      const updatedDay = {
        ...day,
        updatedAt: new Date().toISOString(),
        variants: {
          ...day.variants,
          [variant]: { ...day.variants[variant], programs: updatedPrograms }
        }
      };
      syncListControlDayToServer(key, updatedDay);

      return {
        listControlDays: {
          ...state.listControlDays,
          [key]: updatedDay
        },
        selectedInstanceIds: [],
        selectedTimelineBlock: null
      };
    });
  },

  lcClearDay: (channelId, date, variant) => {
    get()._saveSnapshot();
    set((state) => {
      const key = `list-control-${channelId}-${date}`;
      const day = state.listControlDays[key];
      if (!day) return state;

      const updatedDay = {
        ...day,
        updatedAt: new Date().toISOString(),
        variants: { ...day.variants, [variant]: { ...day.variants[variant], programs: [] } }
      };
      syncListControlDayToServer(key, updatedDay);

      return {
        listControlDays: {
          ...state.listControlDays,
          [key]: updatedDay
        }
      };
    });
  }
});
