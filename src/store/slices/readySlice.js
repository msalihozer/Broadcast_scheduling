/**
 * @file readySlice.js
 * @description Yayına Hazır (Ready) Durum Dilimi.
 * 
 * Temel Sorumluluklar:
 * 1. pullFromDraftToReady: Taslak günündeki programları Ready akışına aktarır
 * 2. pullWeekFromDraftToReady: Bütün bir haftanın taslağını Ready akışına topluca kopyalar
 * 3. 1. Aşama Kilidi (Stage 1 Lock) uygulanarak taslağın değiştirilmesi engellenir
 */
import { _recalculateStartTimes, _propagateOverflows } from '../storeHelpers';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';

export const createReadySlice = (set, get) => ({
  pullFromDraftToReady: (channelId, date) => set(state => {
    const draftKey = `draft-${channelId}-${date}`;
    const readyKey = `ready-${channelId}-${date}`;
    
    const draftDay = state.days[draftKey];
    if (!draftDay) return state;
    
    const readyDay = state.days[readyKey];
    const newVariants = {};
    
    for (const vKey of Object.keys(draftDay.variants)) {
      const dPrograms = JSON.parse(JSON.stringify(draftDay.variants[vKey].programs));
      
      let existingProgs = [];
      if (readyDay && readyDay.variants[vKey]) {
        existingProgs = readyDay.variants[vKey].programs || [];
      }
      
      // Append draft programs after ALL existing programs
      const combined = [...existingProgs, ...dPrograms];
      // Recalculate start times starting from readyDay.startTime
      const updatedCombined = _recalculateStartTimes(combined, readyDay?.startTime || 0);
      
      newVariants[vKey] = { programs: updatedCombined };
    }
    
    const newState = {
      ...state,
      days: {
        ...state.days,
        [readyKey]: {
          ...JSON.parse(JSON.stringify(draftDay)),
          startTime: readyDay?.startTime || 0,
          variants: newVariants,
          draftVersionSynced: draftDay.updatedAt || Date.now(),
          isReadyForBroadcast: readyDay ? readyDay.isReadyForBroadcast : true
        }
      }
    };
    
    newState.days = _propagateOverflows(newState.days, 'ready', channelId, date);
    
    return newState;
  }),

  pullWeekFromDraftToReady: (channelId, baseDateStr) => set(state => {
    const baseDate = parseISO(baseDateStr);
    const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
    
    let newState = { ...state };
    
    for (let i = 0; i < 7; i++) {
      const currentDate = addDays(weekStart, i);
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      
      const draftKey = `draft-${channelId}-${dateStr}`;
      const readyKey = `ready-${channelId}-${dateStr}`;
      
      const draftDay = newState.days[draftKey];
      if (!draftDay) continue;
      
      const readyDay = newState.days[readyKey];
      const newVariants = {};
      
      for (const vKey of Object.keys(draftDay.variants)) {
        const dPrograms = JSON.parse(JSON.stringify(draftDay.variants[vKey].programs));
        
        let existingProgs = [];
        if (readyDay && readyDay.variants[vKey]) {
          existingProgs = readyDay.variants[vKey].programs || [];
        }
        
        const combined = [...existingProgs, ...dPrograms];
        // We need to _recalculateStartTimes from within the same context, 
        // since we are writing raw JS, let's just do it directly or rely on the helper.
        // The helper _recalculateStartTimes is defined at the top of planningStore.js
        const updatedCombined = _recalculateStartTimes(combined, readyDay?.startTime || 0);
        
        newVariants[vKey] = { programs: updatedCombined };
      }
      
      newState.days = {
        ...newState.days,
        [readyKey]: {
          ...JSON.parse(JSON.stringify(draftDay)),
          startTime: readyDay?.startTime || 0,
          variants: newVariants,
          draftVersionSynced: draftDay.updatedAt || Date.now(),
          isReadyForBroadcast: readyDay ? readyDay.isReadyForBroadcast : true
        }
      };
      
      // Propagate for this specific day
      newState.days = _propagateOverflows(newState.days, 'ready', channelId, dateStr);
    }
    
    return newState;
  }),
});
