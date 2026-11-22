/**
 * @file timelineSlice.js
 * @description Manages the core timeline data model including day variants and rundown modifications.
 */
import { calculateTotalCount, _recalculateStartTimes, createEmptyDay, _propagateOverflows } from '../storeHelpers';
import { dialog } from '../dialogStore';
import useAdminLogStore from '../adminLogStore';
import { resolveProgramLogoForChannel, pushAdsStoreToServer } from './ads/adsCatalogHelpers';

export const createTimelineSlice = (set, get) => ({
  days: {},
  libraryPrograms: [], // Initialized in main store from mock

  /**
   * Helper to safely get a day object (creates if not exists)
   */
  _ensureDayExists: (channelId, dateStr) => {
    const mode = get().currentMode || 'draft'; 
    const key = `${mode}-${channelId}-${dateStr}`;
    const state = get();
    if (!state.days[key]) {
      set((s) => ({
        days: { ...s.days, [key]: createEmptyDay(dateStr) }
      }));
    }
    return key;
  },

  setActiveVariant: (channelId, date, variant) => set((state) => {
    const mode = get().currentMode || 'draft'; 
    const key = `${mode}-${channelId}-${date}`;
    if (!state.days[key]) return state;
    return {
      days: {
        ...state.days,
        [key]: { ...state.days[key], activeVariant: variant }
      }
    };
  }),

  addProgramToDay: (channelId, date, variant, program, insertIndex = -1, providedInstanceId) => {
    get()._saveSnapshot();
    const key = get()._ensureDayExists(channelId, date);
    set((state) => {
      const day = state.days[key];
      if (day.isLockedForStage1) return state;

      const newInstanceId = providedInstanceId || `${program.id}-${Date.now()}`;
      const newProgram = { ...program, instanceId: newInstanceId };
      
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

      if ((get().currentMode || 'draft') === 'draft') {
        const _start = day.startTime || 0;
        const totalDur = updatedPrograms.reduce((sum, p) => sum + p.duration, 0) + _start;
        if (totalDur > 1440) {
           dialog.warning('Süre Sınırı', 'Taslak oluşturmada toplam süre 24 saati (23:59) aşamaz. İşlem iptal edildi.');
           return state;
        }
      }

      const newState = {
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
      
      const newCount = calculateTotalCount(newState.days, program.id);
      newState.libraryPrograms = state.libraryPrograms.map(p => 
        p.id === program.id ? { ...p, toplam_tekrar_sayisi: newCount } : p
      );

      newState.days = _propagateOverflows(newState.days, get().currentMode || 'draft', channelId, date);
      useAdminLogStore.getState().addLog({
        category: 'lists',
        panel: 'lists',
        module: (get().currentMode || 'draft') === 'draft' ? 'Taslak Planla' : 'Yayın Planlama',
        action: 'Günlük Listeye Öğe Eklendi',
        details: `${channelId === 'ch_hd' ? 'Semerkand HD' : 'Semerkand WAY'} (${date} - ${variant}) akışına "${program.title || program.name || program.id}" eklendi.`,
        target: `${channelId}/${date}`,
        count: 1,
        status: 'success'
      });
      return newState;
    });
  },

  replaceProgramWithMatches: (channelId, date, variant, targetInstanceId, matchedClips) => {
    get()._saveSnapshot();
    const key = `ready-${channelId}-${date}`;
    set((state) => {
      const day = state.days[key];
      if (!day) return state;

      let currentPrograms = [...day.variants[variant].programs];
      const targetIndex = currentPrograms.findIndex(p => p.instanceId === targetInstanceId);
      
      if (targetIndex === -1) return state;

      const newProgramsToInsert = matchedClips.map((clip, idx) => ({
        ...currentPrograms[targetIndex],
        id: clip.id,
        title: clip.title,
        duration: clip.duration || 0,
        fileName: clip.fileName,
        instanceId: `${clip.id}-${Date.now()}-${idx}`,
        isMatched: true // Mark as matched so we don't show the match button again
      }));

      // Replace the old program with the new array of programs
      currentPrograms.splice(targetIndex, 1, ...newProgramsToInsert);

      const _start = day.startTime || 0;
      const updatedPrograms = _recalculateStartTimes(currentPrograms, _start);

      const newState = {
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

      newState.days = _propagateOverflows(newState.days, 'ready', channelId, date);
      return newState;
    });
  },

  sendToAds: (channelId, date) => {
    get()._saveSnapshot();
    set((state) => {
      const mode = get().currentMode || 'draft'; 
      const key = `${mode}-${channelId}-${date}`;
      const day = state.days[key];
      if (!day) return state;

      return {
        days: {
          ...state.days,
          [key]: {
            ...day,
            adsStatus: 'pending'
          }
        }
      };
    });
  },

  revokeFromAds: (channelId, date) => {
    get()._saveSnapshot();
    set((state) => {
      const key = `ready-${channelId}-${date}`;
      const day = state.days[key];
      if (!day) return state;

      return {
        days: {
          ...state.days,
          [key]: {
            ...day,
            adsStatus: null
          }
        }
      };
    });
  },

  completeAds: (channelId, date) => {
    get()._saveSnapshot();
    set((state) => {
      const readyKey = `ready-${channelId}-${date}`;
      const finalKey = `final-${channelId}-${date}`;
      const listControlKey = `list-control-${channelId}-${date}`;
      const day = state.days[readyKey];
      if (!day) return state;

      const placements = state.adPlacements[readyKey] || [];
      let allocatedAdDuration = 0;
      const newPrograms = [];
      const materials = get().materials || [];
      const companies = get().companies || [];
      const products = get().products || [];
      
      const activeVariant = day.activeVariant || 'v1';
      const programs = day.variants[activeVariant]?.programs || [];
      let runningMinute = day.startTime || 0;
      let breakCounter = 0;

      programs.forEach((prog, pIdx) => {
        if (String(prog.id).toUpperCase() === 'TPL-4') return;
        const progStartMin = prog.startMinute !== undefined ? prog.startMinute : runningMinute;
        const h = Math.floor(progStartMin / 60) % 24;
        const m = Math.floor(progStartMin % 60);
        const shortTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        runningMinute = progStartMin + (parseFloat(prog.duration) || 0);

        const isAdBreak =
          prog.type === 'ad_break' ||
          String(prog.id).toUpperCase() === 'TPL-3' ||
          (prog.id && String(prog.id).toUpperCase().startsWith('T'));

        if (isAdBreak && !prog.isAdClip) {
          breakCounter++;
          allocatedAdDuration += (parseFloat(prog.duration) || 0);

          const bp =
            placements.find(
              p => (prog.instanceId && p.blockId === prog.instanceId) || p.time === shortTime
            ) || placements[breakCounter - 1];

          const breakLabel = bp?.label || prog.title || `${breakCounter}. Reklam Kuşağı`;
          const breakBlockId = bp?.blockId || prog.instanceId || `break-${breakCounter}`;

          if (bp && Array.isArray(bp.ads) && bp.ads.length > 0) {
            bp.ads.forEach((ad, adIdx) => {
              const material = materials.find(mat => String(mat.id) === String(ad.materialId));
              const company = companies.find(c => String(c.id) === String(ad.companyId || material?.companyId));
              const product = products.find(pr => String(pr.id) === String(ad.productId || material?.productId));
              const adDurSec = Math.max(1, parseFloat(ad.duration) || parseFloat(material?.duration) || 15);
              const durMin = adDurSec / 60;
              const resolvedClipId = material
                ? (material.clipId || material.code || material.id)
                : (ad.clipId || ad.code || ad.materialId);
              const pureNumAd = String(resolvedClipId || '').trim().match(/^(\d{3,10})(?:\.[a-zA-Z0-9]+)?$/);
              const resolvedCode =
                material?.code ||
                ad.code ||
                (resolvedClipId ? `${String(resolvedClipId).replace(/\.[^.]+$/, '')}.mxf` : '');

              newPrograms.push({
                ...prog,
                id: resolvedClipId,
                fileId: pureNumAd ? Number(pureNumAd[1]) : null,
                clipId: resolvedClipId || null,
                code: resolvedCode,
                fileName: resolvedCode,
                materialId: ad.materialId || material?.id || null,
                companyId: ad.companyId || material?.companyId || null,
                companyName: ad.companyName || company?.name || '',
                productId: ad.productId || material?.productId || null,
                productName: ad.productName || product?.name || '',
                title: material
                  ? (material.clipName || material.name)
                  : (ad.clipName || ad.name || ad.materialName || 'Reklam Klibi'),
                clipName: material?.clipName || ad.clipName || ad.name || '',
                duration: durMin,
                durationSec: adDurSec,
                instanceId: `ad-${breakCounter}-${adIdx}-${Math.random().toString(36).substr(2, 6)}`,
                type: 'ad_spot',
                isAdClip: true,
                isBumperAd: Boolean(ad.isBumperAd),
                bumperType: ad.bumperType || null,
                bumperCategoryName: ad.bumperCategoryName || null,
                isSponsor: Boolean(ad.isSponsor || ad.sponsorRole),
                sponsorRole: ad.sponsorRole || null,
                parentBreakId: breakBlockId,
                parentBreakOrder: breakCounter,
                parentBreakTitle: breakLabel,
                adOrderInBreak: adIdx + 1,
                adTotalInBreak: bp.ads.length,
                isFromAds: true,
                stageOrigin: 'ads'
              });
            });
          } else {
            const durMin = parseFloat(prog.duration) || 3;
            newPrograms.push({
              ...prog,
              id: prog.id || `EMPTY-BREAK-${breakCounter}`,
              title: `${breakLabel} (Spot Yerleştirilmemiş Boş Kuşak)`,
              duration: durMin,
              durationSec: Math.round(durMin * 60),
              instanceId: prog.instanceId || `lc-empty-break-${breakCounter}`,
              type: 'ad_break',
              isAdClip: true,
              isFromAds: true,
              isEmptyAdBreak: true,
              parentBreakId: breakBlockId,
              parentBreakOrder: breakCounter,
              parentBreakTitle: breakLabel,
              stageOrigin: 'ads'
            });
          }
        } else {
          const durSec = Math.max(1, Math.round(Number(prog.durationSec) || (parseFloat(prog.duration) || 1) * 60));
          const pureMatch = String(prog.fileId || prog.clipId || prog.id || '').trim().match(/^(\d{3,10})(?:\.[a-zA-Z0-9]+)?$/);
          const pureFileId = pureMatch ? Number(pureMatch[1]) : null;
          const cleanStem = String(prog.code || prog.fileName || (pureFileId ? pureFileId : (prog.clipName || prog.title || ''))).trim().replace(/\.[^.]+$/, '');
          const defaultMxfCode = cleanStem ? `${cleanStem}.mxf` : '';
          newPrograms.push({
            ...prog,
            fileId: pureFileId,
            clipId: prog.clipId || pureFileId || prog.id,
            code: prog.code || prog.fileName || defaultMxfCode,
            fileName: prog.fileName || prog.code || defaultMxfCode,
            duration: durSec / 60,
            durationSec: durSec,
            instanceId: prog.instanceId || `lc-prog-${pIdx}-${Math.random().toString(36).substr(2, 6)}`,
            stageOrigin: prog.isAdClip || prog.isFromAds ? 'ads' : (prog.isFromDraft ? 'draft' : 'broadcast')
          });
        }
      });

      let currentStartMinute = day.startTime || 0;
      newPrograms.forEach(p => {
        p.startMinute = currentStartMinute;
        p.logo = resolveProgramLogoForChannel(p, channelId, state.adSettings);
        currentStartMinute += (parseFloat(p.duration) || 0);
      });

      const listControlDay = {
        ...day,
        isRevised: false,
        adsStatus: 'completed',
        updatedAt: new Date().toISOString(),
        allocatedAdDuration: allocatedAdDuration,
        variants: {
          ...day.variants,
          [activeVariant]: {
            ...day.variants[activeVariant],
            programs: newPrograms
          }
        }
      };

      useAdminLogStore.getState().addLog({
        category: 'ads',
        panel: 'ads',
        module: 'Reklam Rezervasyon',
        action: 'ReklamYerleşimi Tamamlandı (Liste Kontrol\'e Gönderildi)',
        details: `${channelId === 'ch_hd' ? 'Semerkand HD' : 'Semerkand WAY'} (${date}) tarihli reklam yerleşimleri tamamlanıp Yayın Liste Kontrol'e aktarıldı.`,
        target: `${channelId}/${date}`,
        count: newPrograms.length,
        status: 'success'
      });

      const updatedReadyDay = {
        ...day,
        isRevised: false,
        adsStatus: 'completed',
        updatedAt: new Date().toISOString()
      };

      pushAdsStoreToServer({
        planningDays: {
          [readyKey]: updatedReadyDay,
          [finalKey]: updatedReadyDay
        },
        listControlDays: {
          [listControlKey]: listControlDay
        }
      });

      return {
        listControlDays: {
          ...state.listControlDays,
          [listControlKey]: listControlDay
        },
        days: {
          ...state.days,
          [readyKey]: updatedReadyDay,
          [finalKey]: updatedReadyDay
        }
      };
    });
  },

  approveFinal: (channelId, date) => {
    get()._saveSnapshot();
    set((state) => {
      const finalKey = `final-${channelId}-${date}`;
      const day = state.days[finalKey];
      if (!day) return state;

      return {
        days: {
          ...state.days,
          [finalKey]: {
            ...day,
            adsStatus: 'sent_to_master'
          }
        }
      };
    });
  },

  reviseFinal: (channelId, date) => {
    get()._saveSnapshot();
    set((state) => {
      const readyKey = `ready-${channelId}-${date}`;
      const finalKey = `final-${channelId}-${date}`;
      const readyDay = state.days[readyKey];
      
      const newDays = { ...state.days };
      delete newDays[finalKey]; // Delete final state

      if (readyDay) {
        newDays[readyKey] = {
          ...readyDay,
          adsStatus: 'revised'
        };
      }

      const newAdPlacements = { ...(state.adPlacements || {}) };
      delete newAdPlacements[finalKey];

      return {
        days: newDays,
        adPlacements: newAdPlacements
      };
    });
  },



  resetAds: (channelId, date) => {
    get()._saveSnapshot();
    set((state) => {
      const readyKey = `ready-${channelId}-${date}`;
      const finalKey = `final-${channelId}-${date}`;
      const listControlKey = `list-control-${channelId}-${date}`;
      const day = state.days[readyKey];
      if (!day) return state;

      const newAdPlacements = { ...(state.adPlacements || {}) };
      newAdPlacements[readyKey] = [];

      const newDays = { ...state.days };
      delete newDays[finalKey];
      delete newDays[listControlKey];

      const newListControlDays = { ...(state.listControlDays || {}) };
      delete newListControlDays[listControlKey];

      newDays[readyKey] = {
        ...day,
        adsStatus: 'pending',
        updatedAt: Date.now()
      };

      pushAdsStoreToServer({
        adPlacements: { [readyKey]: [] },
        forceOverwritePlacements: true,
        planningDays: { [readyKey]: newDays[readyKey] }
      });

      return {
        adPlacements: newAdPlacements,
        days: newDays,
        listControlDays: newListControlDays
      };
    });
  },

  removePrograms: (channelId, date, variant, instanceIds, programIds) => {
    get()._saveSnapshot();
    set((state) => {
      const mode = get().currentMode || 'draft'; 
      const key = `${mode}-${channelId}-${date}`;
      const day = state.days[key];
      if (!day || day.isLockedForStage1) return state;

      const programs = day.variants[variant].programs.filter(p => !instanceIds.includes(p.instanceId));
      const updatedPrograms = _recalculateStartTimes(programs, day.startTime || 0);

      const newState = {
        days: {
          ...state.days,
          [key]: {
            ...day,
            variants: {
              ...day.variants,
              [variant]: { programs: updatedPrograms }
            }
          }
        },
        selectedInstanceIds: [],
        selectedTimelineBlock: null
      };

      let updatedLibrary = [...state.libraryPrograms];
      programIds.forEach(pId => {
        const newCount = calculateTotalCount(newState.days, pId);
        updatedLibrary = updatedLibrary.map(p => p.id === pId ? { ...p, toplam_tekrar_sayisi: newCount } : p);
      });
      newState.libraryPrograms = updatedLibrary;
      newState.days = _propagateOverflows(newState.days, get().currentMode || 'draft', channelId, date);
      useAdminLogStore.getState().addLog({
        category: 'lists',
        panel: 'lists',
        module: (get().currentMode || 'draft') === 'draft' ? 'Taslak Planla' : 'Yayın Planlama',
        action: 'Günlük Listeden Öğe Silindi',
        details: `${channelId === 'ch_hd' ? 'Semerkand HD' : 'Semerkand WAY'} (${date} - ${variant}) akışından ${instanceIds.length} öğe silindi.`,
        target: `${channelId}/${date}`,
        count: instanceIds.length,
        status: 'warning'
      });
      return newState;
    });
  },

  moveProgramUp: (channelId, date, variant, instanceId) => {
    get()._saveSnapshot();
    set((state) => {
      const mode = get().currentMode || 'draft'; 
      const key = `${mode}-${channelId}-${date}`;
      const day = state.days[key];
      if (!day || day.isLockedForStage1) return state;

      const programs = [...day.variants[variant].programs];
      const index = programs.findIndex(p => p.instanceId === instanceId);
      if (index <= 0) return state;

      const temp = programs[index - 1];
      programs[index - 1] = programs[index];
      programs[index] = temp;

      const updatedPrograms = _recalculateStartTimes(programs, day.startTime || 0);

      const newState = {
        days: {
          ...state.days,
          [key]: {
            ...day,
            variants: { ...day.variants, [variant]: { programs: updatedPrograms } }
          }
        }
      };
      newState.days = _propagateOverflows(newState.days, get().currentMode || 'draft', channelId, date);
      return newState;
    });
  },

  moveProgramDown: (channelId, date, variant, instanceId) => {
    get()._saveSnapshot();
    set((state) => {
      const mode = get().currentMode || 'draft'; 
      const key = `${mode}-${channelId}-${date}`;
      const day = state.days[key];
      if (!day || day.isLockedForStage1) return state;

      const programs = [...day.variants[variant].programs];
      const index = programs.findIndex(p => p.instanceId === instanceId);
      if (index === -1 || index >= programs.length - 1) return state;

      const temp = programs[index + 1];
      programs[index + 1] = programs[index];
      programs[index] = temp;

      const updatedPrograms = _recalculateStartTimes(programs, day.startTime || 0);

      const newState = {
        days: {
          ...state.days,
          [key]: {
            ...day,
            variants: { ...day.variants, [variant]: { programs: updatedPrograms } }
          }
        }
      };
      newState.days = _propagateOverflows(newState.days, get().currentMode || 'draft', channelId, date);
      return newState;
    });
  },

  reorderProgram: (channelId, date, variant, oldIndex, newIndex) => {
    get()._saveSnapshot();
    set((state) => {
      const mode = get().currentMode || 'draft'; 
      const key = `${mode}-${channelId}-${date}`;
      const day = state.days[key];
      if (!day || day.isLockedForStage1) return state;

      const programs = [...day.variants[variant].programs];
      if (oldIndex < 0 || oldIndex >= programs.length || newIndex < 0 || newIndex >= programs.length) return state;

      const [movedItem] = programs.splice(oldIndex, 1);
      programs.splice(newIndex, 0, movedItem);

      const updatedPrograms = _recalculateStartTimes(programs, day.startTime || 0);

      const newState = {
        days: {
          ...state.days,
          [key]: {
            ...day,
            variants: { ...day.variants, [variant]: { programs: updatedPrograms } }
          }
        }
      };
      newState.days = _propagateOverflows(newState.days, get().currentMode || 'draft', channelId, date);
      return newState;
    });
  },

  duplicateProgram: (channelId, date, variant, instanceId) => {
    get()._saveSnapshot();
    set((state) => {
      const mode = get().currentMode || 'draft'; 
      const key = `${mode}-${channelId}-${date}`;
      const day = state.days[key];
      if (!day || day.isLockedForStage1) return state;

      const programs = [...day.variants[variant].programs];
      const index = programs.findIndex(p => p.instanceId === instanceId);
      if (index === -1) return state;

      const programToCopy = programs[index];
      const newProgram = { ...programToCopy, instanceId: `${programToCopy.id}-${Date.now()}` };
      programs.splice(index + 1, 0, newProgram);

      const updatedPrograms = _recalculateStartTimes(programs, day.startTime || 0);

      const newState = {
        days: {
          ...state.days,
          [key]: {
            ...day,
            variants: { ...day.variants, [variant]: { programs: updatedPrograms } }
          }
        }
      };

      newState.libraryPrograms = state.libraryPrograms.map(p => 
        p.id === newProgram.id ? { ...p, toplam_tekrar_sayisi: calculateTotalCount(newState.days, p.id) } : p
      );

      newState.days = _propagateOverflows(newState.days, get().currentMode || 'draft', channelId, date);
      return newState;
    });
  },

  updateProgramTime: (channelId, date, variant, instanceId, newDuration, newStartMinute, newTitle) => {
    get()._saveSnapshot();
    set((state) => {
      const mode = get().currentMode || 'draft'; 
      const key = `${mode}-${channelId}-${date}`;
      const day = state.days[key];
      if (!day || day.isLockedForStage1) return state;

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

      if ((get().currentMode || 'draft') === 'draft') {
        const _start = typeof newDayStartTime !== 'undefined' ? newDayStartTime : (day.startTime || 0);
        const totalDur = updatedPrograms.reduce((sum, p) => sum + p.duration, 0) + _start;
        if (totalDur > 1440) {
           dialog.warning('Süre Sınırı', 'Taslak oluşturmada toplam süre 24 saati (23:59) aşamaz. İşlem iptal edildi.');
           return state;
        }
      }

      const newState = {
        days: {
          ...state.days,
          [key]: {
            ...day,
            startTime: newDayStartTime,
            variants: { ...day.variants, [variant]: { programs: updatedPrograms } }
          }
        }
      };
      newState.days = _propagateOverflows(newState.days, get().currentMode || 'draft', channelId, date);
      return newState;
    });
  },

  clearDay: (channelId, date, variant) => {
    get()._saveSnapshot();
    set((state) => {
      const mode = get().currentMode || 'draft'; 
      const key = `${mode}-${channelId}-${date}`;
      const day = state.days[key];
      if (!day || day.isLockedForStage1) return state;

      const newState = {
        days: {
          ...state.days,
          [key]: {
            ...day,
            variants: { ...day.variants, [variant]: { programs: [] } }
          }
        }
      };

      newState.libraryPrograms = state.libraryPrograms.map(p => ({
        ...p,
        toplam_tekrar_sayisi: calculateTotalCount(newState.days, p.id)
      }));

      newState.days = _propagateOverflows(newState.days, get().currentMode || 'draft', channelId, date);
      useAdminLogStore.getState().addLog({
        category: 'lists',
        panel: 'lists',
        module: (get().currentMode || 'draft') === 'draft' ? 'Taslak Planla' : 'Yayın Planlama',
        action: 'Günlük Liste Temizlendi',
        details: `${channelId === 'ch_hd' ? 'Semerkand HD' : 'Semerkand WAY'} (${date} - ${variant}) akışı tamamen temizlendi.`,
        target: `${channelId}/${date}`,
        status: 'warning'
      });
      return newState;
    });
  },

  lockDay: (channelId, date) => set((state) => {
    const key = `draft-${channelId}-${date}`;
    if (!state.days[key]) return state;
    return {
      days: {
        ...state.days,
        [key]: {
          ...state.days[key],
          isLockedForStage1: true
        }
      }
    };
  })
});

export default createTimelineSlice;

