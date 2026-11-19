/**
 * @file src/store/storeHelpers.js
 * @description Planlama store'u için yardımcı fonksiyonlar:
 * - calculateTotalCount: Bir programın haftalık/toplam tekrar sayısını hesaplar
 * - _recalculateStartTimes: Gün içindeki programların başlangıç dakikalarını sırayla günceller
 * - createEmptyDay: Boş gün şablonu (Varyant A ve B) oluşturur
 * - _propagateOverflows: 24 saati (1440 dk) aşan yayın sarkmalarını ardışık günlere taşır
 */
import { format, addDays, startOfWeek, parseISO } from 'date-fns';

export const calculateTotalCount = (days, programId) => {
  let count = 0;
  Object.values(days).forEach(day => {
    Object.values(day.variants).forEach(variant => {
      count += variant.programs.filter(p => p.id === programId).length;
    });
  });
  return count;
};


export const _recalculateStartTimes = (programs, startTime = 0) => {
  let currentStart = startTime;
  return programs.map(p => {
    const updated = { ...p, startMinute: currentStart };
    currentStart += p.duration;
    return updated;
  });
};

export const createEmptyDay = (dateStr) => ({
  date: dateStr,
  startTime: 0, 
  isLockedForStage1: false,
  activeVariant: 'A',
  variants: {
    'A': { programs: [] },
    'B': { programs: [] }
  }
});
export const _propagateOverflows = (daysObj, currentMode, channelId, startDateStr) => {
  let currentDays = { ...daysObj };
  let currentDate = parseISO(startDateStr);
  let iter = 0;
  let maxIterations = 30;

  while (iter < maxIterations) {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const key = `${currentMode}-${channelId}-${dateStr}`;
    const day = currentDays[key];

    if (!day) break;

    let nextDate = addDays(currentDate, 1);
    let nextDateStr = format(nextDate, 'yyyy-MM-dd');
    let nextKey = `${currentMode}-${channelId}-${nextDateStr}`;
    
    let nextDay = currentDays[nextKey] || createEmptyDay(nextDateStr);
    let needsToPropagate = false;
    let nextDayStartTime = 0;

    const updatedCurrentVariants = {};
    const updatedNextVariants = {};

    for (const vKey of Object.keys(day.variants)) {
      const programs = [...day.variants[vKey].programs];
      let currentStart = day.startTime || 0;
      let overflowIdx = -1;

      for (let i = 0; i < programs.length; i++) {
         if (currentStart >= 1440) {
            overflowIdx = i;
            break;
         }
         currentStart += programs[i].duration;
      }

      let overflowPrograms = [];
      if (currentMode === 'ready' && overflowIdx !== -1) {
         overflowPrograms = programs.splice(overflowIdx);
         overflowPrograms = overflowPrograms.map(p => ({ ...p, isOverflow: true }));
      }

      updatedCurrentVariants[vKey] = { programs };
      
      if (vKey === day.activeVariant) {
         if (currentMode === 'ready' && currentStart > 1440) {
            nextDayStartTime = currentStart - 1440;
         }
      }

      const nextDayPrograms = [...nextDay.variants[vKey].programs];
      const newNextPrograms = [...overflowPrograms, ...nextDayPrograms];
      updatedNextVariants[vKey] = { programs: newNextPrograms };
      
      if (overflowPrograms.length > 0) {
         needsToPropagate = true;
      }
    }

    currentDays[key] = {
      ...day,
      updatedAt: Date.now(),
      variants: updatedCurrentVariants
    };

    if (nextDay.startTime !== nextDayStartTime) {
      needsToPropagate = true;
    }

    if (!needsToPropagate) {
      break;
    }

    for (const vKey of Object.keys(updatedNextVariants)) {
      updatedNextVariants[vKey].programs = _recalculateStartTimes(updatedNextVariants[vKey].programs, nextDayStartTime);
    }

    currentDays[nextKey] = {
      ...nextDay,
      updatedAt: Date.now(),
      startTime: nextDayStartTime,
      variants: updatedNextVariants
    };

    currentDate = nextDate;
    iter++;
  }

  return currentDays;
};

const todayStr = format(new Date(), 'yyyy-MM-dd');

export const CHANNELS = [
  { id: 'ch_hd', name: 'Semerkand HD' },
  { id: 'ch_way', name: 'Semerkand WAY' }
];

