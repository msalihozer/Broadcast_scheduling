/**
 * @file selectionSlice.js
 * @description Manages user selections in the UI, drag-and-drop previews, and clipboard (copy/paste) functionality.
 */
import { format } from 'date-fns';
import { _recalculateStartTimes, createEmptyDay } from '../storeHelpers';

export const createSelectionSlice = (set, get) => ({
  selectedChannel: 'ch_hd',
  setSelectedChannel: (channelId) => set({ selectedChannel: channelId }),

  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  setSelectedDate: (date) => set({ selectedDate: date }),

  selectedLibraryProgram: null,
  setSelectedLibraryProgram: (program) => set({ selectedLibraryProgram: program }),

  selectedTimelineBlock: null,
  setSelectedTimelineBlock: (block) => set({ selectedTimelineBlock: block }),

  selectedInstanceIds: [],
  lastSelectedIndex: -1,
  
  /**
   * Toggles multiple selections using Shift/Ctrl keys
   */
  toggleSelection: (instanceId, index, isShift, isCtrl, programsList) => set((state) => {
    let newSelected = [...state.selectedInstanceIds];
    
    if (isShift && state.lastSelectedIndex !== -1 && programsList) {
       const start = Math.min(state.lastSelectedIndex, index);
       const end = Math.max(state.lastSelectedIndex, index);
       const rangeIds = programsList.slice(start, end + 1).map(p => p.instanceId);
       
       if (isCtrl) {
         newSelected = [...new Set([...newSelected, ...rangeIds])];
       } else {
         newSelected = rangeIds;
       }
    } else if (isCtrl) {
       if (newSelected.includes(instanceId)) {
         newSelected = newSelected.filter(id => id !== instanceId);
       } else {
         newSelected.push(instanceId);
       }
    } else {
       newSelected = [instanceId];
    }

    return { 
      selectedInstanceIds: newSelected,
      lastSelectedIndex: index
    };
  }),

  isCtrlPressed: false,
  setIsCtrlPressed: (isPressed) => set({ isCtrlPressed: isPressed }),
  setCtrlPressed: (isPressed) => set({ isCtrlPressed: isPressed }), // Alias used in some components

  dragPreview: null,
  setDragPreview: (preview) => set({ dragPreview: preview }),

  // Clipboard operations
  clipboardDay: null,
  clipboardPrograms: [],

  copyDay: (channelId, date) => set((state) => {
    const mode = state.currentMode || 'draft';
    const key = `${mode}-${channelId}-${date}`;
    if (!state.days[key]) return state;
    return { clipboardDay: { ...state.days[key] } };
  }),

  pasteDay: (channelId, date) => {
    get()._saveSnapshot();
    set((state) => {
      if (!state.clipboardDay) return state;
      const mode = state.currentMode || 'draft';
      const key = `${mode}-${channelId}-${date}`;
      const newDay = JSON.parse(JSON.stringify(state.clipboardDay));
      newDay.date = date; // Update date reference
      
      const newDays = { ...state.days, [key]: newDay };
      return { 
        pastStates: [...(state.pastStates || []), { days: state.days, libraryPrograms: state.libraryPrograms }].slice(-30),
        days: newDays 
      };
    });
  },

  copyProgram: (programs) => set({ clipboardPrograms: programs }),

  pasteProgram: (channelId, date, variant, insertIndex = -1) => {
    get()._saveSnapshot();
    const mode = get().currentMode || 'draft'; 
    const key = `${mode}-${channelId}-${date}`;
    
    set((state) => {
      const day = state.days[key] || createEmptyDay(date);
      if (day.isLockedForStage1 || state.clipboardPrograms.length === 0) return state;

      const newProgramsToInsert = state.clipboardPrograms.map(p => ({
        ...p,
        instanceId: `${p.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      }));

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
        currentPrograms.push(...newProgramsToInsert);
      } else {
        currentPrograms.splice(finalIndex, 0, ...newProgramsToInsert);
      }

      const updatedPrograms = _recalculateStartTimes(currentPrograms, day.startTime || 0);

      const newState = {
        pastStates: [...(state.pastStates || []), { days: state.days, libraryPrograms: state.libraryPrograms }].slice(-30),
        days: {
          ...state.days,
          [key]: {
            ...day,
            variants: {
              ...day.variants,
              [variant]: { programs: updatedPrograms }
            }
          }
        }
      };
      
      return newState;
    });
  }
});
