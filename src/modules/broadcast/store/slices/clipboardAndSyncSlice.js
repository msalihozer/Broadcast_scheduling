/**
 * @file src/modules/broadcast/store/slices/clipboardAndSyncSlice.js
 * @description Pano (Kopyala / Yapıştır), Taslak Planlama modülünden akış alma (`pullFromDraft`,
 * `receiveDraftFromPlanner`, `receiveDraftWeekFromPlanner`), Kaydetme (`saveDaySchedule`) ve
 * Reklam Rezervasyona İletme (`sendDayToAdReservation`) işlemlerini yöneten Store dilimi.
 */
import { getDraftProgramsForDay } from '../../utils/draftDataLoader';
import usePlanningStore from '../../../../store/planningStore';
import { pushAdsStoreToServer } from '../../../../store/slices/ads/adsCatalogHelpers';
import { BROADCAST_FPS } from '../../utils/timecodeUtils';
import {
  renumberAdBreaksInList,
  convertDraftSlotsToRundownItems
} from '../broadcastStoreHelpers';
import { useAdminLogStore } from '../../../../store/adminLogStore';

const MAX_CLIPBOARD_HISTORY = 5;

/**
 * Pano, Taslak Aktarımı ve Kayıt/Reklam Senkronizasyonu aksiyonlarını oluşturur.
 */
export const createClipboardAndSyncSlice = (set, get) => ({
  // Pano Durumları (Aktif pano + En son 5 işlemlik geçmiş)
  clipboardItem: null,
  clipboardItems: [],
  clipboardMeta: null,
  clipboardHistory: [],

  /**
   * Seçili satırları veya tüm günün listesini (`instanceIds = []`) panoya kopyalar
   * ve en son 5 işlemi `clipboardHistory` içinde saklar.
   */
  copyProgramsToClipboard: (channelId, dateStr, listType, instanceIds = []) => {
    const v = listType || get().activeList;
    const progs = get().getRawDayPrograms(channelId, dateStr, v);
    if (!Array.isArray(progs) || progs.length === 0) {
      return { success: false, count: 0, isFullList: false };
    }

    let targetItems = [];
    let isFullList = false;

    if (Array.isArray(instanceIds) && instanceIds.length > 0) {
      const idSet = new Set(instanceIds);
      targetItems = progs.filter(p => idSet.has(p.instanceId));
      isFullList = targetItems.length === progs.length;
    } else {
      targetItems = progs;
      isFullList = true;
    }

    if (targetItems.length === 0) {
      return { success: false, count: 0, isFullList: false };
    }

    const clonedForClipboard = JSON.parse(JSON.stringify(targetItems));
    const now = Date.now();
    const firstTitle =
      clonedForClipboard[0]?.clipName ||
      clonedForClipboard[0]?.title ||
      clonedForClipboard[0]?.name ||
      'Yayın Öğesi';

    const summaryLabel = isFullList
      ? `Tam Liste (${clonedForClipboard.length} öğe)`
      : clonedForClipboard.length === 1
      ? firstTitle
      : `${firstTitle} + ${clonedForClipboard.length - 1} öğe`;

    const entryId = `clip_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const meta = {
      id: entryId,
      sourceChannel: channelId,
      sourceDate: dateStr,
      sourceList: v,
      count: clonedForClipboard.length,
      isFullList,
      summaryLabel,
      copiedAt: now
    };

    const newHistoryEntry = {
      id: entryId,
      items: clonedForClipboard,
      meta
    };

    const prevHistory = Array.isArray(get().clipboardHistory) ? get().clipboardHistory : [];
    const dedupedHistory = prevHistory.filter(
      h =>
        !(
          h.meta?.sourceChannel === channelId &&
          h.meta?.sourceDate === dateStr &&
          h.meta?.sourceList === v &&
          h.meta?.count === clonedForClipboard.length &&
          h.meta?.summaryLabel === summaryLabel
        )
    );
    const nextHistory = [newHistoryEntry, ...dedupedHistory].slice(0, MAX_CLIPBOARD_HISTORY);

    set({
      clipboardItems: clonedForClipboard,
      clipboardItem: clonedForClipboard[0] || null,
      clipboardMeta: meta,
      clipboardHistory: nextHistory
    });

    return {
      success: true,
      count: clonedForClipboard.length,
      isFullList,
      meta
    };
  },

  /**
   * Panodaki öğeleri hedef güne/listeye yapıştırır:
   * - `mode === 'top'`: Listenin en üstüne ekler
   * - `mode === 'after_selected'`: Seçili satırın hemen altına ekler (seçim yoksa en alta)
   * - `mode === 'bottom'` (veya `'append'`): Listenin en altına ekler
   * - `mode === 'replace'`: Hedef günün tüm listesini panodaki listeyle değiştirir
   */
  pasteClipboardItems: (channelId, dateStr, listType, mode = null, targetAfterInstanceId = null) => {
    const v = listType || get().activeList;
    const rawClipboard = Array.isArray(get().clipboardItems) && get().clipboardItems.length > 0
      ? get().clipboardItems
      : (get().clipboardItem ? [get().clipboardItem] : []);

    const effectiveMode = mode || get().insertPosition || 'bottom';

    if (rawClipboard.length === 0) {
      return { success: false, count: 0, mode: effectiveMode };
    }

    get().pushHistorySnapshot();
    const key = `${channelId}-${dateStr}`;
    const currentProgs = [...get().getRawDayPrograms(channelId, dateStr, v)];
    const now = Date.now();

    const pastedItems = rawClipboard.map((prog, idx) => {
      const cleanBaseTitle = String(prog.title || prog.name || 'İçerik').replace(/\s*\(Kopya\)\s*$/i, '').trim();
      return {
        ...JSON.parse(JSON.stringify(prog)),
        id: `${prog.id || 'item'}_paste_${now}_${idx}`,
        instanceId: `inst_paste_${now}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
        title: cleanBaseTitle,
        name: cleanBaseTitle,
        addedAt: now
      };
    });

    let nextList = [];
    if (effectiveMode === 'replace') {
      nextList = pastedItems;
    } else if (effectiveMode === 'top') {
      nextList = [...pastedItems, ...currentProgs];
    } else if (effectiveMode === 'after_selected') {
      const refId = targetAfterInstanceId || get().selectedInstanceId;
      const selIdx = refId ? currentProgs.findIndex(p => p.instanceId === refId) : -1;
      if (selIdx !== -1) {
        nextList = [...currentProgs];
        nextList.splice(selIdx + 1, 0, ...pastedItems);
      } else {
        nextList = [...currentProgs, ...pastedItems];
      }
    } else {
      // 'bottom' veya 'append'
      nextList = [...currentProgs, ...pastedItems];
    }

    const renumberedProgs = renumberAdBreaksInList(nextList);

    set(state => ({
      selectedInstanceId: pastedItems[pastedItems.length - 1]?.instanceId || state.selectedInstanceId,
      selectedInstanceIds: pastedItems.map(p => p.instanceId),
      days: {
        ...state.days,
        [key]: {
          ...state.days[key],
          date: dateStr,
          variants: {
            ...(state.days[key]?.variants || { A: { programs: [] }, B: { programs: [] } }),
            [v]: {
              ...(state.days[key]?.variants?.[v] || {}),
              programs: renumberedProgs
            }
          }
        }
      }
    }));

    useAdminLogStore.getState().addLog({
      category: 'lists',
      module: 'Pano & Günlük Akış',
      action: effectiveMode === 'replace' ? 'Panodan Tam Liste Uygulandı' : 'Panodan Öğeler Yapıştırıldı',
      details: `${dateStr} (Liste ${v}) akışına panodan ${pastedItems.length} adet öğe (${effectiveMode}) yapıştırıldı.`,
      count: pastedItems.length,
      status: 'success'
    });

    return {
      success: true,
      count: pastedItems.length,
      mode: effectiveMode,
      newInstanceIds: pastedItems.map(p => p.instanceId)
    };
  },

  selectClipboardHistoryEntry: (entryId) => {
    const history = Array.isArray(get().clipboardHistory) ? get().clipboardHistory : [];
    const target = history.find(h => h.id === entryId);
    if (!target || !Array.isArray(target.items)) return false;

    set({
      clipboardItems: target.items,
      clipboardItem: target.items[0] || null,
      clipboardMeta: target.meta
    });
    return true;
  },

  pasteClipboardHistoryEntry: (entryId, channelId, dateStr, listType, mode = null) => {
    const ok = get().selectClipboardHistoryEntry(entryId);
    if (!ok) return { success: false, count: 0 };
    return get().pasteClipboardItems(channelId, dateStr, listType, mode);
  },

  removeClipboardHistoryEntry: (entryId) => {
    const history = Array.isArray(get().clipboardHistory) ? get().clipboardHistory : [];
    const nextHistory = history.filter(h => h.id !== entryId);
    const activeMetaId = get().clipboardMeta?.id;

    if (nextHistory.length === 0) {
      set({
        clipboardItems: [],
        clipboardItem: null,
        clipboardMeta: null,
        clipboardHistory: []
      });
    } else if (activeMetaId === entryId) {
      const nextActive = nextHistory[0];
      set({
        clipboardItems: nextActive.items,
        clipboardItem: nextActive.items[0] || null,
        clipboardMeta: nextActive.meta,
        clipboardHistory: nextHistory
      });
    } else {
      set({ clipboardHistory: nextHistory });
    }
  },

  clearClipboard: () => set({
    clipboardItems: [],
    clipboardItem: null,
    clipboardMeta: null,
    clipboardHistory: []
  }),

  copySelectedItem: (channelId, dateStr, listType) => {
    const multiIds = Array.isArray(get().selectedInstanceIds) ? get().selectedInstanceIds : [];
    const selId = get().selectedInstanceId;
    const idsToCopy = multiIds.length > 0 ? multiIds : (selId ? [selId] : []);
    if (idsToCopy.length === 0) return { success: false, count: 0 };
    return get().copyProgramsToClipboard(channelId, dateStr, listType, idsToCopy);
  },

  pasteClipboardItem: (channelId, dateStr, listType, mode = null) => {
    return get().pasteClipboardItems(
      channelId,
      dateStr,
      listType,
      mode || get().insertPosition || 'after_selected'
    );
  },

  /**
   * O günün taslağındaki tüm kuşakları aktif listeye çeker (İntro + Canlı Yayın / Dolgu Kuşağı desteğiyle).
   */
  pullFromDraft: (channelId, dateStr, listType) => {
    const draftItems = getDraftProgramsForDay(channelId, dateStr);
    if (draftItems.length === 0) return { success: false, count: 0 };

    return get().receiveDraftFromPlanner({
      channelId,
      dateStr,
      programs: draftItems,
      targetList: listType || get().activeList,
      overwrite: true
    });
  },

  /**
   * Taslak Planlama modülünden gelen tekil gün verisini doğrudan Yayın Planlama akışına yazar.
   */
  receiveDraftFromPlanner: ({ channelId, dateStr, programs = [], targetList = 'A', overwrite = true }) => {
    get().pushHistorySnapshot();
    const key = `${channelId}-${dateStr}`;
    const v = targetList === 'B' ? 'B' : 'A';

    const converted = convertDraftSlotsToRundownItems(
      programs,
      channelId,
      dateStr,
      get().introDefaultSettings
    );
    const currentDay = get().days[key] || { variants: { A: { programs: [] }, B: { programs: [] } } };
    const existingListProgs = currentDay.variants?.[v]?.programs || [];
    const finalProgs = overwrite ? converted : [...existingListProgs, ...converted];

    set(state => ({
      selectedChannel: channelId,
      selectedDate: dateStr,
      activeList: v,
      days: {
        ...state.days,
        [key]: {
          ...currentDay,
          date: dateStr,
          variants: {
            ...(currentDay.variants || { A: { programs: [] }, B: { programs: [] } }),
            [v]: { programs: finalProgs }
          }
        }
      }
    }));

    useAdminLogStore.getState().addLog({
      category: 'lists',
      module: 'Taslak & Yayın Akışı',
      action: 'Günün Taslağı Akışa Aktarıldı',
      details: `${dateStr} (Liste ${v}) için taslaktan ${converted.length} kuşak yayın akışına uygulandı.`,
      count: converted.length,
      status: 'success'
    });

    return { success: true, count: converted.length, dateStr };
  },

  /**
   * Taslak Planlama modülünden gelen çoklu gün / 7 günlük haftalık akışı topluca Yayın Planlama akışına yazar.
   */
  receiveDraftWeekFromPlanner: ({ channelId, weekSchedule = {}, targetList = 'A', overwrite = true, initialDateStr = null }) => {
    get().pushHistorySnapshot();
    const v = targetList === 'B' ? 'B' : 'A';
    const updatedDays = { ...get().days };
    let totalCount = 0;
    let firstDateStr = initialDateStr;

    Object.entries(weekSchedule).forEach(([dateStr, dayObj]) => {
      if (!firstDateStr) firstDateStr = dateStr;
      const rawProgs = Array.isArray(dayObj) ? dayObj : (dayObj?.programs || []);
      const key = `${channelId}-${dateStr}`;

      const converted = convertDraftSlotsToRundownItems(
        rawProgs,
        channelId,
        dateStr,
        get().introDefaultSettings
      );
      totalCount += converted.length;

      const currentDay = updatedDays[key] || { variants: { A: { programs: [] }, B: { programs: [] } } };
      const existingListProgs = currentDay.variants?.[v]?.programs || [];
      const finalProgs = overwrite ? converted : [...existingListProgs, ...converted];

      updatedDays[key] = {
        ...currentDay,
        date: dateStr,
        variants: {
          ...(currentDay.variants || { A: { programs: [] }, B: { programs: [] } }),
          [v]: { programs: finalProgs }
        }
      };
    });

    set(state => ({
      selectedChannel: channelId,
      selectedDate: firstDateStr || state.selectedDate,
      activeList: v,
      days: updatedDays
    }));

    return { success: true, count: totalCount, daysCount: Object.keys(weekSchedule).length };
  },

  /**
   * Günün yayın akışını kaydeder ve ana `usePlanningStore` (`ready-*`) ile liste olarak senkronize eder.
   */
  saveDaySchedule: (channelId, dateStr, listType) => {
    const key = `${channelId}-${dateStr}`;
    const v = listType || get().activeList;
    const computedProgs = get().getComputedDayPrograms(channelId, dateStr, v);
    const prevOverflowFrames = get().getPreviousDayOverflowFrames(channelId, dateStr, v);
    const nextOverflowFrames = get().getDayOverflowFrames(channelId, dateStr, v);
    const now = Date.now();

    set(state => {
      const currentDay = state.days[key] || { variants: { A: { programs: [] }, B: { programs: [] } } };
      const currentVariant = currentDay.variants?.[v] || { programs: [] };
      return {
        days: {
          ...state.days,
          [key]: {
            ...currentDay,
            date: dateStr,
            savedAt: now,
            variants: {
              ...(currentDay.variants || { A: { programs: [] }, B: { programs: [] } }),
              [v]: {
                ...currentVariant,
                savedAt: now
              }
            }
          }
        }
      };
    });

    try {
      const readyKey = `ready-${channelId}-${dateStr}`;
      const startMinOffset = Number(((prevOverflowFrames / BROADCAST_FPS) / 60).toFixed(4));
      let runningMin = startMinOffset;
      const convertedForReady = computedProgs.map((p, idx) => {
        const isAd = p.type === 'ad_break';
        const durSec = Math.max(1, Math.round((p.durationFrames || 0) / BROADCAST_FPS));
        const durMin = isAd
          ? Math.max(1, Math.round(durSec / 60))
          : Number((durSec / 60).toFixed(4));
        const itemObj = {
          order: p.order || idx + 1,
          id: isAd ? 'TPL-3' : (p.fileId || p.id || `prog_${idx}`),
          instanceId: p.instanceId,
          title: p.clipName || p.title || p.name,
          programTitle: p.appliedDraftTitle || p.title || p.name,
          appliedDraftTitle: p.appliedDraftTitle || p.title || p.name,
          name: p.name || p.title,
          clipName: p.clipName || p.title || p.name,
          fileId: p.fileId || null,
          type: p.type,
          duration: durMin,
          durationSec: durSec,
          durationFrames: p.durationFrames || 0,
          durationFormatted: p.durationTc,
          durationTc: p.durationTc,
          startMinute: runningMin,
          calculatedStartTime: p.calculatedStartTime,
          calculatedEndTime: p.calculatedEndTime,
          category: p.category || p.categoryName || (isAd ? 'Reklam' : p.isLive ? 'Canlı Yayın' : 'Dini'),
          categoryName: p.categoryName || p.category || (isAd ? 'Reklam' : p.isLive ? 'Canlı Yayın' : 'Dini'),
          categoryId: p.categoryId || null,
          color: p.categoryColor || (isAd ? '#f59e0b' : '#0d9488'),
          episode: p.episodeNo || null,
          episodeNo: p.episodeNo || null,
          part: p.partNo || null,
          partNo: p.partNo || null,
          unitType: p.unitType || null,
          unitLabel: p.unitLabel || null,
          isIntroClip: Boolean(p.isIntroClip),
          isLive: Boolean(p.isLive),
          isKisaSlot: Boolean(p.isKisaSlot),
          isFillerClip: Boolean(p.isFillerClip),
          isOverflow: Boolean(p.isOverflow),
          note: p.note || ''
        };
        runningMin = Number((runningMin + durMin).toFixed(4));
        return itemObj;
      });

      const planningState = usePlanningStore.getState();
      const existingReadyDay = planningState.days?.[readyKey] || {};
      const existingVariants = existingReadyDay.variants || {};
      const targetVariantKey = v === 'B' ? 'v2' : 'v1';
      const fallbackOtherKey = targetVariantKey === 'v1' ? 'v2' : 'v1';
      const existingOtherVariant = existingVariants[fallbackOtherKey] || { programs: [] };

      const isAlreadyFinalApproved = Boolean(
        existingReadyDay.isFinalApproved ||
        existingReadyDay.isApprovedInListControl ||
        existingReadyDay.adsStatus === 'sent_to_master'
      );

      const updatedReadyDayObj = {
        ...existingReadyDay,
        date: dateStr,
        channelId,
        sourceList: v,
        startTime: startMinOffset,
        prevOverflowFrames,
        nextOverflowFrames,
        activeVariant: targetVariantKey,
        isReadyForBroadcast: true,
        storageStage: isAlreadyFinalApproved ? 'permanent' : 'temporary_staging',
        isTemporaryStaging: !isAlreadyFinalApproved,
        savedAt: now,
        updatedAt: now,
        variants: {
          ...existingVariants,
          [targetVariantKey]: {
            ...(existingVariants[targetVariantKey] || {}),
            sourceList: v,
            savedAt: now,
            programs: convertedForReady
          },
          [fallbackOtherKey]: existingOtherVariant
        }
      };

      usePlanningStore.setState({
        days: {
          ...(planningState.days || {}),
          [readyKey]: updatedReadyDayObj
        }
      });

      const currentBroadcastDayForServer = get().days[key] || {};
      pushAdsStoreToServer({
        restoredDayKeys: [`${channelId}-${dateStr}`],
        planningDays: {
          [readyKey]: updatedReadyDayObj
        },
        broadcastDays: {
          [key]: {
            ...currentBroadcastDayForServer,
            date: dateStr,
            channelId,
            storageStage: isAlreadyFinalApproved ? 'permanent' : 'temporary_staging',
            isTemporaryStaging: !isAlreadyFinalApproved,
            savedAt: now,
            updatedAt: now
          }
        }
      });
    } catch (err) {
      console.warn('PlanningStore save sync warning:', err);
    }

    useAdminLogStore.getState().addLog({
      category: 'lists',
      module: 'Günlük Yayın Akışı',
      action: 'Günlük Yayın Listesi Kaydedildi',
      details: `${dateStr} (Liste ${v}) yayın akışı (${computedProgs.length} öğe) kaydedildi.`,
      count: computedProgs.length,
      status: 'success'
    });

    return { success: true, savedAt: now, count: computedProgs.length };
  },

  /**
   * Günün yayın akışını önce kaydeder, ardından tüm yayın listesini ve Reklam Kuşaklarını
   * Reklam Rezervasyon modülüne (`/ads`) liste olarak iletir.
   * Daha önce iletilmiş bir liste tekrar gönderilirse otomatik olarak "Revize Liste" (`revised`) olarak işaretlenir.
   */
  sendDayToAdReservation: (channelId, dateStr, listType) => {
    const readyKey = `ready-${channelId}-${dateStr}`;
    const preSendState = usePlanningStore.getState();
    const preExistingReadyDay = preSendState.days?.[readyKey] || {};
    const wasAlreadySent = Boolean(
      preExistingReadyDay.sentToAdsAt ||
      preExistingReadyDay.adsStatus === 'completed' ||
      preExistingReadyDay.adsStatus === 'revised' ||
      preExistingReadyDay.adsStatus === 'pending'
    );

    get().saveDaySchedule(channelId, dateStr, listType);

    const key = `${channelId}-${dateStr}`;
    const v = listType || get().activeList;
    const targetVariantKey = v === 'B' ? 'v2' : 'v1';
    const computedProgs = get().getComputedDayPrograms(channelId, dateStr, v);
    const adBreaks = computedProgs.filter(p => p.type === 'ad_break');
    const now = Date.now();

    set(state => {
      const currentDay = state.days[key] || { variants: { A: { programs: [] }, B: { programs: [] } } };
      const currentVariant = currentDay.variants?.[v] || { programs: [] };
      return {
        days: {
          ...state.days,
          [key]: {
            ...currentDay,
            date: dateStr,
            savedAt: now,
            sentToAdsAt: now,
            variants: {
              ...(currentDay.variants || { A: { programs: [] }, B: { programs: [] } }),
              [v]: {
                ...currentVariant,
                savedAt: now,
                sentToAdsAt: now
              }
            }
          }
        }
      };
    });

    try {
      const planningState = usePlanningStore.getState();
      const existingReadyDay = planningState.days?.[readyKey] || {};
      const nextRevisionCount = wasAlreadySent ? (Number(existingReadyDay.revisionCount) || 0) + 1 : 0;
      const nextAdsStatus = wasAlreadySent ? 'revised' : 'pending';

      const updatedSentReadyDay = {
        ...existingReadyDay,
        date: dateStr,
        channelId,
        sourceList: v,
        activeVariant: targetVariantKey,
        adsStatus: nextAdsStatus,
        isRevised: wasAlreadySent,
        revisionCount: nextRevisionCount,
        lastRevisedAt: wasAlreadySent ? now : (existingReadyDay.lastRevisedAt || null),
        isLockedForStage1: true,
        isReadyForBroadcast: true,
        storageStage: 'temporary_staging',
        isTemporaryStaging: true,
        savedAt: now,
        sentToAdsAt: now,
        updatedAt: now
      };

      usePlanningStore.setState({
        days: {
          ...(planningState.days || {}),
          [readyKey]: updatedSentReadyDay
        }
      });

      const currentBroadcastDayForServer = get().days[key] || {};
      pushAdsStoreToServer({
        restoredDayKeys: [`${channelId}-${dateStr}`],
        planningDays: {
          [readyKey]: updatedSentReadyDay
        },
        broadcastDays: {
          [key]: {
            ...currentBroadcastDayForServer,
            date: dateStr,
            channelId,
            storageStage: 'temporary_staging',
            isTemporaryStaging: true,
            savedAt: now,
            sentToAdsAt: now,
            updatedAt: now
          }
        }
      });
    } catch (err) {
      console.warn('AdReservation sync warning:', err);
    }

    useAdminLogStore.getState().addLog({
      category: 'ads',
      module: 'Reklam Rezervasyon & Akış',
      action: 'Yayın Listesi Reklam Rezervasyona Gönderildi',
      details: `${dateStr} (Liste ${v}) akışındaki ${adBreaks.length} adet reklam kuşağı (toplam ${computedProgs.length} yayın öğesi) Reklam Rezervasyon modülüne iletildi.`,
      count: adBreaks.length,
      status: 'success'
    });

    return {
      success: true,
      savedAt: now,
      sentToAdsAt: now,
      sourceList: v,
      totalCount: computedProgs.length,
      adBreakCount: adBreaks.length,
      adBreaks
    };
  }
});

