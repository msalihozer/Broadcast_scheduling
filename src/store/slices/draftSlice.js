/**
 * @file draftSlice.js
 * @description Taslak Planlama (Draft) Durum Dilimi.
 * 
 * Temel Sorumluluklar:
 * 1. 5 dakikalık artışlarla haftalık yayın akışı slotlarının yönetimi (createEmptyDaySlots)
 * 2. Excel haftalık akış dosyasının içe aktarılması (importWeeklyFlow)
 * 3. Slot birleştirme (merge), bölme ve program bloklarını yerleştirme
 * 4. Taslak akışının kesinleştirilip Yayına Hazır (Ready) moduna çekilmesi (pullFromDraftToReady)
 */
import { dialog } from '../dialogStore';
import useAdminLogStore from '../adminLogStore';

const getSlotIndex = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return Math.floor((h * 60 + m) / 5);
};

const createEmptyDaySlots = () => {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) {
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      slots.push({
        time: timeStr,
        type: 'empty',
        duration: 5,
        slots_count: 1,
        isMerged: false,
        parentTime: null,
        programName: null,
        episodeNo: null,
        presenter: null,
        subject: null,
        note: null
      });
    }
  }
  return slots;
};

export const createDraftSlice = (set, get) => ({
  weeklyFlow: {}, // Stores { [dateStr]: FlowSlot[288] }

  /**
   * Initializes flow slots for all 7 days of the week starting at weekStartStr
   */
  initializeWeeklyFlowForWeek: (weekStartStr) => set((state) => {
    const newWeeklyFlow = { ...state.weeklyFlow };
    const baseDate = new Date(weekStartStr);
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      
      if (!newWeeklyFlow[dateStr]) {
        newWeeklyFlow[dateStr] = createEmptyDaySlots();
      }
    }
    return { weeklyFlow: newWeeklyFlow };
  }),

  /**
   * Imports the weekly parsed flow data and expands it into the 288-slot matrix for each day
   */
  importWeeklyFlowData: (parsedFlow) => set((state) => {
    const newWeeklyFlow = { ...state.weeklyFlow };
    
    for (const [dateStr, blocks] of Object.entries(parsedFlow)) {
      const slots = createEmptyDaySlots();
      
      blocks.forEach(block => {
        const startIdx = getSlotIndex(block.time);
        const slotsNeeded = Math.floor(block.duration / 5);
        
        if (startIdx < 0 || startIdx >= 288) return;
        
        // Fill the parent slot
        slots[startIdx] = {
          time: block.time,
          type: block.type,
          duration: block.duration,
          slots_count: slotsNeeded,
          isMerged: false,
          parentTime: null,
          programName: block.programName || (block.type === 'reklam' ? 'Reklam' : null),
          episodeNo: block.episodeNo || null,
          presenter: block.presenter || null,
          subject: block.subject || null,
          note: block.note || null
        };
        
        // Fill the children slots (merged)
        for (let i = 1; i < slotsNeeded; i++) {
          const childIdx = startIdx + i;
          if (childIdx >= 288) break;
          
          slots[childIdx] = {
            time: slots[childIdx].time,
            type: block.type,
            duration: 5,
            slots_count: 1,
            isMerged: true,
            parentTime: block.time,
            programName: null,
            episodeNo: null,
            presenter: null,
            subject: null,
            note: null
          };
        }
      });
      
      newWeeklyFlow[dateStr] = slots;
    }

    useAdminLogStore.getState().addLog({
      category: 'lists',
      panel: 'lists',
      module: 'Taslak Planla',
      action: 'Haftalık Taslak Akışı İçe Aktarıldı',
      details: `${Object.keys(parsedFlow).length} günlük taslak yayın akışı Excel'den içe aktarıldı.`,
      count: Object.keys(parsedFlow).length,
      status: 'success'
    });
    
    return { weeklyFlow: newWeeklyFlow };
  }),

  /**
   * Updates fields of a specific slot (or its parent if it is merged)
   */
  updateFlowSlot: (dateStr, timeStr, updatedFields) => set((state) => {
    const slots = [...(state.weeklyFlow[dateStr] || [])];
    if (slots.length === 0) return state;
    
    const idx = getSlotIndex(timeStr);
    if (idx < 0 || idx >= 288) return state;
    
    let targetIdx = idx;
    if (slots[idx].isMerged && slots[idx].parentTime) {
      targetIdx = getSlotIndex(slots[idx].parentTime);
    }
    
    slots[targetIdx] = {
      ...slots[targetIdx],
      ...updatedFields
    };
    
    useAdminLogStore.getState().addLog({
      category: 'lists',
      panel: 'lists',
      module: 'Taslak Planla',
      action: 'Taslak Slotu Güncellendi',
      details: `${dateStr} (${timeStr}) taslak slotu güncellendi.`,
      target: `${dateStr} ${timeStr}`,
      count: 1,
      status: 'success'
    });

    return {
      weeklyFlow: {
        ...state.weeklyFlow,
        [dateStr]: slots
      }
    };
  }),

  /**
   * Assigns a program from the library to a starting time slot
   */
  assignProgramToSlot: (dateStr, timeStr, program, durationMinutes) => set((state) => {
    const slots = [...(state.weeklyFlow[dateStr] || [])];
    if (slots.length === 0) return state;
    
    const startIdx = getSlotIndex(timeStr);
    const slotsNeeded = Math.max(1, Math.floor(durationMinutes / 5));
    
    if (startIdx < 0 || startIdx + slotsNeeded > 288) {
      dialog.warning('Süre Sınırı', 'Seçilen süre gün sınırını aşıyor.');
      return state;
    }

    // Clear any parents of cells we are about to overwrite
    for (let i = 0; i < slotsNeeded; i++) {
      const idx = startIdx + i;
      if (slots[idx].isMerged && slots[idx].parentTime) {
        // Reset the parent of this cell to empty or shorter duration
        const parentIdx = getSlotIndex(slots[idx].parentTime);
        slots[parentIdx] = {
          ...slots[parentIdx],
          type: 'empty',
          programName: null,
          episodeNo: null,
          presenter: null,
          subject: null,
          duration: 5,
          slots_count: 1
        };
      }
    }

    // Set the main slot
    slots[startIdx] = {
      time: timeStr,
      type: 'program',
      duration: durationMinutes,
      slots_count: slotsNeeded,
      isMerged: false,
      parentTime: null,
      programName: program.title || program.name,
      episodeNo: program.episodeNo || null,
      presenter: program.presenter || null,
      subject: program.subject || null,
      note: null
    };

    // Set the child slots to merged
    for (let i = 1; i < slotsNeeded; i++) {
      const childIdx = startIdx + i;
      slots[childIdx] = {
        time: slots[childIdx].time,
        type: 'program',
        duration: 5,
        slots_count: 1,
        isMerged: true,
        parentTime: timeStr,
        programName: null,
        episodeNo: null,
        presenter: null,
        subject: null,
        note: null
      };
    }

    useAdminLogStore.getState().addLog({
      category: 'lists',
      panel: 'lists',
      module: 'Taslak Planla',
      action: 'Taslak Akışına Program Eklendi',
      details: `${dateStr} (${timeStr}) slotuna "${program.title || program.name}" (${durationMinutes} dk) eklendi.`,
      target: `${dateStr} ${timeStr}`,
      count: 1,
      status: 'success'
    });

    return {
      weeklyFlow: {
        ...state.weeklyFlow,
        [dateStr]: slots
      }
    };
  }),

  /**
   * Assigns a reklam block to a starting time slot
   */
  assignReklamToSlot: (dateStr, timeStr, durationMinutes, note) => set((state) => {
    const slots = [...(state.weeklyFlow[dateStr] || [])];
    if (slots.length === 0) return state;
    
    const startIdx = getSlotIndex(timeStr);
    const slotsNeeded = Math.max(1, Math.floor(durationMinutes / 5));
    
    if (startIdx < 0 || startIdx + slotsNeeded > 288) {
      dialog.warning('Süre Sınırı', 'Seçilen süre gün sınırını aşıyor.');
      return state;
    }

    // Clear overlapping parent cells
    for (let i = 0; i < slotsNeeded; i++) {
      const idx = startIdx + i;
      if (slots[idx].isMerged && slots[idx].parentTime) {
        const parentIdx = getSlotIndex(slots[idx].parentTime);
        slots[parentIdx] = {
          ...slots[parentIdx],
          type: 'empty',
          programName: null,
          episodeNo: null,
          presenter: null,
          subject: null,
          duration: 5,
          slots_count: 1
        };
      }
    }

    slots[startIdx] = {
      time: timeStr,
      type: 'reklam',
      duration: durationMinutes,
      slots_count: slotsNeeded,
      isMerged: false,
      parentTime: null,
      programName: 'Reklam',
      episodeNo: null,
      presenter: null,
      subject: null,
      note: note || `Reklam-${durationMinutes} dk`
    };

    for (let i = 1; i < slotsNeeded; i++) {
      const childIdx = startIdx + i;
      slots[childIdx] = {
        time: slots[childIdx].time,
        type: 'reklam',
        duration: 5,
        slots_count: 1,
        isMerged: true,
        parentTime: timeStr,
        programName: null,
        episodeNo: null,
        presenter: null,
        subject: null,
        note: null
      };
    }

    useAdminLogStore.getState().addLog({
      category: 'lists',
      panel: 'lists',
      module: 'Taslak Planla',
      action: 'Taslak Akışına Reklam Kuşağı Eklendi',
      details: `${dateStr} (${timeStr}) slotuna ${durationMinutes} dk reklam kuşağı eklendi.`,
      target: `${dateStr} ${timeStr}`,
      count: 1,
      status: 'success'
    });

    return {
      weeklyFlow: {
        ...state.weeklyFlow,
        [dateStr]: slots
      }
    };
  }),

  /**
   * Resets a block back to empty 5-minute slots
   */
  clearSlotBlock: (dateStr, timeStr) => set((state) => {
    const slots = [...(state.weeklyFlow[dateStr] || [])];
    if (slots.length === 0) return state;
    
    const idx = getSlotIndex(timeStr);
    if (idx < 0 || idx >= 288) return state;
    
    let targetIdx = idx;
    if (slots[idx].isMerged && slots[idx].parentTime) {
      targetIdx = getSlotIndex(slots[idx].parentTime);
    }
    
    const parentSlot = slots[targetIdx];
    const slotsCount = parentSlot.slots_count || 1;
    
    // Reset all slots in this block back to empty
    for (let i = 0; i < slotsCount; i++) {
      const currentIdx = targetIdx + i;
      if (currentIdx >= 288) break;
      
      slots[currentIdx] = {
        time: slots[currentIdx].time,
        type: 'empty',
        duration: 5,
        slots_count: 1,
        isMerged: false,
        parentTime: null,
        programName: null,
        episodeNo: null,
        presenter: null,
        subject: null,
        note: null
      };
    }
    
    useAdminLogStore.getState().addLog({
      category: 'lists',
      panel: 'lists',
      module: 'Taslak Planla',
      action: 'Taslak Slotu Temizlendi',
      details: `${dateStr} (${timeStr}) taslak slotu temizlendi.`,
      target: `${dateStr} ${timeStr}`,
      count: 1,
      status: 'warning'
    });

    return {
      weeklyFlow: {
        ...state.weeklyFlow,
        [dateStr]: slots
      }
    };
  }),

  /**
   * Clears the weekly flow for all 7 days of the week starting at weekStartStr
   */
  clearWeeklyFlow: (weekStartStr) => set((state) => {
    const newWeeklyFlow = { ...state.weeklyFlow };
    const baseDate = new Date(weekStartStr);
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      
      newWeeklyFlow[dateStr] = createEmptyDaySlots();
    }
    
    return { weeklyFlow: newWeeklyFlow };
  })
});
