/**
 * @file src/modules/broadcast/store/slices/timelineCalculationSlice.js
 * @description 25 FPS Timecode (`HH.MM.SS.FF`) tabanlı zaman çizelgesi, dünden devreden sarkma (`getPreviousDayOverflowFrames`),
 * ertesi güne sarkma (`getDayOverflowFrames`) ve başlangıç/bitiş saatlerini (`getComputedDayPrograms`) hesaplayan Store dilimi.
 */
import { format, parseISO, subDays } from 'date-fns';
import {
  BROADCAST_FPS,
  FRAMES_PER_DAY,
  timecodeToFrames,
  framesToTimecode,
  framesToClockTime,
  secondsToTimecode,
  parseClockTimeToFrames
} from '../../utils/timecodeUtils';
import { renumberAdBreaksInList } from '../broadcastStoreHelpers';

function resolvePinnedStartFrames(p) {
  if (!p || !p.isPinnedTime) return null;
  if (typeof p.pinnedStartFrames === 'number' && !isNaN(p.pinnedStartFrames)) {
    return Math.max(0, Math.round(p.pinnedStartFrames));
  }
  if (p.pinnedStartTime) {
    const parsed = parseClockTimeToFrames(p.pinnedStartTime);
    if (typeof parsed === 'number' && !isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

function computeTimelineEndFrames(progs, initialFrames = 0) {
  let currentFrames = initialFrames;
  for (const p of progs) {
    const itemFrames = Math.max(
      BROADCAST_FPS,
      p.durationFrames || timecodeToFrames(p.durationTc || p.duration || (p.durationSec ? secondsToTimecode(p.durationSec) : '00.30.00.00'))
    );
    const pinnedFrames = resolvePinnedStartFrames(p);
    const startFrames = pinnedFrames !== null ? pinnedFrames : currentFrames;
    currentFrames = startFrames + itemFrames;
  }
  return currentFrames;
}

/**
 * 25 FPS Yayın Zaman Çizelgesi ve Sarkma (Overflow) hesaplama fonksiyonlarını oluşturur.
 */
export const createTimelineCalculationSlice = (set, get) => ({
  /**
   * Belirli bir günün ham program/klip/reklam listesini döndürür.
   */
  getRawDayPrograms: (channelId, dateStr, listType) => {
    const key = `${channelId}-${dateStr}`;
    const day = get().days[key];
    const v = listType || get().activeList;
    return day?.variants?.[v]?.programs || [];
  },

  /**
   * Dünden devreden sarkma süresini kare (frame) cinsinden hesaplar.
   * Dünün programları + dünün başlangıcı > FRAMES_PER_DAY (2,160,000 kare = 24 saat) ise aradaki fark bugüne devreder.
   */
  getPreviousDayOverflowFrames: (channelId, dateStr, listType) => {
    try {
      const current = parseISO(dateStr);
      const yesterdayStr = format(subDays(current, 1), 'yyyy-MM-dd');
      const key = `${channelId}-${yesterdayStr}`;
      const day = get().days[key];
      const v = listType || get().activeList;
      const progs = day?.variants?.[v]?.programs || [];
      if (progs.length === 0) return 0;

      const prevYesterdayOverflow = get().getPreviousDayOverflowFrames(channelId, yesterdayStr, v);
      const totalYesterdayUsage = computeTimelineEndFrames(progs, prevYesterdayOverflow);
      if (totalYesterdayUsage > FRAMES_PER_DAY) {
        return totalYesterdayUsage - FRAMES_PER_DAY;
      }
      return 0;
    } catch (e) {
      return 0;
    }
  },

  /**
   * Bugünün ertesi güne sarkan süresini kare (frame) cinsinden hesaplar.
   */
  getDayOverflowFrames: (channelId, dateStr, listType) => {
    const v = listType || get().activeList;
    const progs = get().getRawDayPrograms(channelId, dateStr, v);
    const prevOverflow = get().getPreviousDayOverflowFrames(channelId, dateStr, v);
    const totalUsage = computeTimelineEndFrames(progs, prevOverflow);
    if (totalUsage > FRAMES_PER_DAY) {
      return totalUsage - FRAMES_PER_DAY;
    }
    return 0;
  },

  /**
   * Günün programlarını 00:00:00:00 (+ dünden devir) başlangıç ve salise/kare doğruluğunda
   * başlangıç/bitiş saatleriyle (`calculatedStartTime`, `calculatedEndTime`) hesaplar.
   * Sabitlenmiş (`isPinnedTime: true`) öğeler üst ve alttaki değişikliklerden etkilenmez, kendi sabit saatinde başlar.
   */
  getComputedDayPrograms: (channelId, dateStr, listType) => {
    const v = listType || get().activeList;
    const rawProgs = renumberAdBreaksInList(get().getRawDayPrograms(channelId, dateStr, v));
    const prevOverflowFrames = get().getPreviousDayOverflowFrames(channelId, dateStr, v);

    let currentTimelineFrames = prevOverflowFrames;
    let cumulativeFrames = prevOverflowFrames;

    return rawProgs.map((p, index) => {
      const itemFrames = Math.max(
        BROADCAST_FPS,
        p.durationFrames || timecodeToFrames(p.durationTc || (p.durationSec ? secondsToTimecode(p.durationSec) : '00.30.00.00'))
      );

      const pinnedFrames = resolvePinnedStartFrames(p);
      const effectiveStartFrames = pinnedFrames !== null ? pinnedFrames : currentTimelineFrames;
      const startClock = framesToClockTime(effectiveStartFrames);
      const endTimelineFrames = effectiveStartFrames + itemFrames;
      const endClock = framesToClockTime(endTimelineFrames);

      const isOverflow = effectiveStartFrames >= FRAMES_PER_DAY;
      const isPartiallyOverflow = !isOverflow && (endTimelineFrames > FRAMES_PER_DAY);

      const durTc = p.durationTc || framesToTimecode(itemFrames);

      currentTimelineFrames = endTimelineFrames;
      cumulativeFrames = endTimelineFrames;

      return {
        ...p,
        order: index + 1,
        durationFrames: itemFrames,
        durationTc: durTc,
        isPinnedTime: pinnedFrames !== null,
        pinnedStartFrames: pinnedFrames,
        calculatedStartTime: startClock,
        calculatedEndTime: endClock,
        isOverflow,
        isPartiallyOverflow
      };
    });
  },

  /**
   * Belirli bir gün ve liste varyantının (A/B) ek durum bilgilerini
   * (kayıt zamanı, reklam iletimi, son taslak uygulama zamanı, eklenemeyen taslak kuşakları) döndürür.
   */
  getDayVariantMeta: (channelId, dateStr, listType) => {
    const key = `${channelId}-${dateStr}`;
    const v = listType || get().activeList;
    const variantObj = get().days[key]?.variants?.[v] || {};
    return {
      savedAt: variantObj.savedAt || null,
      sentToAdsAt: variantObj.sentToAdsAt || null,
      lastDraftAppliedAt: variantObj.lastDraftAppliedAt || null,
      unaddedDraftSlots: Array.isArray(variantObj.unaddedDraftSlots) ? variantObj.unaddedDraftSlots : []
    };
  }
});

