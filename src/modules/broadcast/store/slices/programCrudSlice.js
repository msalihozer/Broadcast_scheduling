/**
 * @file src/modules/broadcast/store/slices/programCrudSlice.js
 * @description Yayın akışı öğelerinin (Program, Klip, İntro, Canlı Yayın, Dolgu Kuşağı, Reklam Kuşağı)
 * eklenmesi, silinmesi, çoğaltılması, taşınması, yeniden sıralanması ve güncellenmesi işlemlerini yöneten Store dilimi.
 * Ekleme ve çoğaltma işlemlerinde En Üst ('top'), Seçilenin Altına ('after_selected') ve En Alt ('bottom') seçeneklerini destekler.
 */
import {
  BROADCAST_FPS,
  timecodeToFrames,
  secondsToTimecode
} from '../../utils/timecodeUtils';
import {
  renumberAdBreaksInList,
  resolveTargetInsertIndex
} from '../broadcastStoreHelpers';
import { getProgramGroupKey } from '../../utils/rundownHelpers';
import { useAdminLogStore } from '../../../../store/adminLogStore';
import { dialog } from '../../../../store/dialogStore';
import usePlanningStore from '../../../../store/planningStore';

/**
 * Yayın öğesi CRUD ve sıralama aksiyonlarını oluşturur.
 */
export const createProgramCrudSlice = (set, get) => ({
  /**
   * Yayın listesine yeni bir Program, Klip, İntro veya Canlı Yayın öğesi ekler.
   * `insertIndex` sayısal indeks veya `'top' | 'after_selected' | 'bottom'` konum modu olabilir.
   */
  addProgram: (channelId, dateStr, listType, programData, insertIndex = -1) => {
    get().pushHistorySnapshot();
    const key = `${channelId}-${dateStr}`;
    const v = listType || get().activeList;
    const currentProgs = [...get().getRawDayPrograms(channelId, dateStr, v)];

    const durationTc = programData.durationTc ||
      (programData.durationFormatted ? programData.durationFormatted :
      (programData.durationSec ? secondsToTimecode(programData.durationSec) :
      (typeof programData.duration === 'string' && programData.duration.includes('.') ? programData.duration :
      secondsToTimecode((programData.duration || 30) * 60))));

    const durationFrames = timecodeToFrames(durationTc);
    const itemType = programData.type || (programData.fileId || programData.clipName ? 'clip' : 'program');

    const rawTitleClean = String(programData.title || programData.name || 'İsimsiz İçerik').replace(/\s*\(Kopya\)\s*$/i, '').trim();
    let finalTitle = rawTitleClean;

    if (itemType === 'ad_break' || /^Reklam Kuşağı(\s+\d+)?$/i.test(rawTitleClean)) {
      let maxAdNum = 0;
      let adBreakCount = 0;
      currentProgs.forEach(p => {
        if (p.type === 'ad_break' || /^Reklam Kuşağı/i.test(p.title || '')) {
          adBreakCount++;
          const m = String(p.title || '').match(/^Reklam Kuşağı\s+(\d+)/i);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxAdNum) maxAdNum = n;
          }
        }
      });
      const nextNum = Math.max(adBreakCount + 1, maxAdNum + 1);
      if (!rawTitleClean || /^Reklam Kuşağı(\s+\d+)?$/i.test(rawTitleClean)) {
        finalTitle = `Reklam Kuşağı ${nextNum}`;
      }
    }

    const instId = `inst_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const isFillerSlotItem = Boolean(programData.isKisaSlot || itemType === 'filler_slot');
    const newProgram = {
      id: programData.id || `item_${Date.now()}`,
      instanceId: instId,
      fillerGroupId: isFillerSlotItem ? (programData.fillerGroupId || instId) : (programData.fillerGroupId || null),
      fillerTargetSec: isFillerSlotItem ? Math.floor(durationFrames / BROADCAST_FPS) : (programData.fillerTargetSec || null),
      draftId: programData.draftId || null,
      draftStartTime: programData.draftStartTime || null,
      type: itemType,
      isIntroClip: Boolean(programData.isIntroClip),
      isLive: Boolean(programData.isLive || itemType === 'live'),
      isKisaSlot: isFillerSlotItem,
      isNotFound: Boolean(programData.isNotFound),
      notFoundReason: programData.notFoundReason || null,
      title: finalTitle,
      name: finalTitle,
      clipName: programData.clipName || programData.fileName || (itemType === 'clip' ? finalTitle : null),
      fileId: programData.fileId || null,
      durationTc: durationTc,
      durationFrames: durationFrames,
      durationSec: Math.floor(durationFrames / BROADCAST_FPS),
      category: programData.category || programData.categoryName || 'Genel',
      categoryColor: programData.categoryColor || '#3b82f6',
      episodeNo: programData.episodeNo || programData.episode || null,
      partNo: programData.partNo || programData.part || null,
      unitType: programData.unitType || 'bolum',
      unitLabel: programData.unitLabel || null,
      host: programData.host || '',
      topic: programData.topic || '',
      note: programData.note || '',
      ramadanProgramType: programData.ramadanProgramType || '',
      ramadanBreakTag: programData.ramadanBreakTag || '',
      isFromDraft: !!programData.isFromDraft || !!programData.draftId,
      addedAt: Date.now()
    };

    const title = finalTitle;

    const targetInsertIndex = resolveTargetInsertIndex(
      currentProgs,
      insertIndex,
      get().insertPosition,
      get().selectedInstanceId
    );

    // Eğer ekleneceği konumun altında sabitlenmiş (isPinnedTime) bir program varsa veya iki sabit program arasına ekleniyorsa,
    // aradaki boşluğun yeni eklenen öğe için yeterli olup olmadığını kontrol et (önceki güne veya sabit programa taşmasını önle)
    const nextPinnedIdx = currentProgs.findIndex((p, i) => i >= targetInsertIndex && Boolean(p.isPinnedTime) && typeof p.pinnedStartFrames === 'number');
    if (nextPinnedIdx !== -1) {
      const nextPinnedProg = currentProgs[nextPinnedIdx];
      const prevOverflow = typeof get().getPreviousDayOverflowFrames === 'function'
        ? get().getPreviousDayOverflowFrames(channelId, dateStr, v)
        : 0;
      let cursorFrames = prevOverflow;
      for (let i = 0; i < nextPinnedIdx; i++) {
        const pr = currentProgs[i];
        const prFrames = Math.max(BROADCAST_FPS, pr.durationFrames || timecodeToFrames(pr.durationTc || '00.30.00.00'));
        if (pr.isPinnedTime && typeof pr.pinnedStartFrames === 'number') {
          cursorFrames = pr.pinnedStartFrames + prFrames;
        } else {
          cursorFrames += prFrames;
        }
      }
      const availableFramesBeforePin = Math.max(0, nextPinnedProg.pinnedStartFrames - cursorFrames);
      if (durationFrames > availableFramesBeforePin) {
        const availMin = Math.floor((availableFramesBeforePin / BROADCAST_FPS) / 60);
        const availSec = Math.round((availableFramesBeforePin / BROADCAST_FPS) % 60);
        const needMin = Math.floor((durationFrames / BROADCAST_FPS) / 60);
        const needSec = Math.round((durationFrames / BROADCAST_FPS) % 60);
        dialog.warning(
          'Sabit Program Öncesinde Yeterli Boşluk Yok',
          `"${nextPinnedProg.title}" programı saat ${nextPinnedProg.pinnedStartTime || ''} konumuna sabitlenmiş durumda.\n\n` +
          `• Sabit program öncesindeki kalan boşluk: ${availMin} dk ${availSec} sn\n` +
          `• Eklemek istediğiniz "${title}" süresi: ${needMin} dk ${needSec} sn\n\n` +
          `Önceki güne veya sabitlenmiş saate taşma yapılamaz. Lütfen daha kısa bir içerik seçin veya sabit programın altına (Alt modunda) ekleyin.`
        );
        return null;
      }
    }

    if (targetInsertIndex >= 0 && targetInsertIndex <= currentProgs.length) {
      currentProgs.splice(targetInsertIndex, 0, newProgram);
    } else {
      currentProgs.push(newProgram);
    }

    const renumberedProgs = renumberAdBreaksInList(currentProgs);

    set(state => ({
      selectedInstanceId: newProgram.instanceId,
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
      module: 'Günlük Yayın Akışı',
      action: itemType === 'clip' ? 'Akışa Klip Eklendi' : 'Akışa Program Eklendi',
      details: `${dateStr} (Liste ${v}) akışına "${finalTitle}" (${durationTc}) eklendi.`,
      count: 1,
      status: 'success'
    });
  },

  /**
   * Varsayılan veya özel ayarlarla Reklam Kuşağı ekler ve listedeki reklam kuşaklarını 1'den başlayarak yeniden numaralandırır.
   */
  addAdBreak: (channelId, dateStr, listType, adBreakData = {}, insertIndex = -1) => {
    get().pushHistorySnapshot();
    const key = `${channelId}-${dateStr}`;
    const v = listType || get().activeList;
    const currentProgs = [...get().getRawDayPrograms(channelId, dateStr, v)];
    const defaultAdSettings = get().adBreakDefaultSettings || {
      durationMinutes: 5,
      durationSeconds: 0,
      durationTc: '00.05.00.00',
      note: 'Ticari Reklam Bloğu'
    };

    const cleanCustomTitle = adBreakData && typeof adBreakData === 'object' && adBreakData.title
      ? String(adBreakData.title).replace(/\s*\(Kopya\)\s*$/i, '').trim()
      : '';
    const title = cleanCustomTitle && !/^Reklam Kuşağı(\s+\d+)?$/i.test(cleanCustomTitle)
      ? cleanCustomTitle
      : 'Reklam Kuşağı';

    const durationTc = (adBreakData && typeof adBreakData === 'object' && adBreakData.durationTc)
      ? adBreakData.durationTc
      : (typeof adBreakData === 'number'
        ? secondsToTimecode(adBreakData * 60)
        : (defaultAdSettings.durationTc || '00.05.00.00'));
    const durationFrames = timecodeToFrames(durationTc);

    const adNote = (adBreakData && typeof adBreakData === 'object' && adBreakData.note !== undefined)
      ? adBreakData.note
      : (defaultAdSettings.note ?? 'Ticari Reklam Bloğu');

    const ramadanBreakTag = (adBreakData && typeof adBreakData === 'object' && adBreakData.ramadanBreakTag !== undefined)
      ? adBreakData.ramadanBreakTag
      : (defaultAdSettings.ramadanBreakTag || '');

    const newAd = {
      id: `ad_${Date.now()}`,
      instanceId: `inst_ad_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: 'ad_break',
      title: title,
      name: title,
      durationTc: durationTc,
      durationFrames: durationFrames,
      durationSec: Math.floor(durationFrames / BROADCAST_FPS),
      category: 'Reklam',
      categoryColor: '#f59e0b',
      note: adNote,
      ramadanBreakTag: ramadanBreakTag,
      addedAt: Date.now()
    };

    const targetInsertIndex = resolveTargetInsertIndex(
      currentProgs,
      insertIndex,
      get().insertPosition,
      get().selectedInstanceId
    );

    // Eğer ekleneceği konumun altında sabitlenmiş (isPinnedTime) bir program varsa veya iki sabit program arasına ekleniyorsa,
    // aradaki boşluğun yeni eklenen öğe için yeterli olup olmadığını kontrol et (önceki güne veya sabit programa taşmasını önle)
    const nextPinnedIdx = currentProgs.findIndex((p, i) => i >= targetInsertIndex && Boolean(p.isPinnedTime) && typeof p.pinnedStartFrames === 'number');
    if (nextPinnedIdx !== -1) {
      const nextPinnedProg = currentProgs[nextPinnedIdx];
      const prevOverflow = typeof get().getPreviousDayOverflowFrames === 'function'
        ? get().getPreviousDayOverflowFrames(channelId, dateStr, v)
        : 0;
      let cursorFrames = prevOverflow;
      for (let i = 0; i < nextPinnedIdx; i++) {
        const pr = currentProgs[i];
        const prFrames = Math.max(BROADCAST_FPS, pr.durationFrames || timecodeToFrames(pr.durationTc || '00.30.00.00'));
        if (pr.isPinnedTime && typeof pr.pinnedStartFrames === 'number') {
          cursorFrames = pr.pinnedStartFrames + prFrames;
        } else {
          cursorFrames += prFrames;
        }
      }
      const availableFramesBeforePin = Math.max(0, nextPinnedProg.pinnedStartFrames - cursorFrames);
      if (durationFrames > availableFramesBeforePin) {
        const availMin = Math.floor((availableFramesBeforePin / BROADCAST_FPS) / 60);
        const availSec = Math.round((availableFramesBeforePin / BROADCAST_FPS) % 60);
        const needMin = Math.floor((durationFrames / BROADCAST_FPS) / 60);
        const needSec = Math.round((durationFrames / BROADCAST_FPS) % 60);
        dialog.warning(
          'Sabit Program Öncesinde Yeterli Boşluk Yok',
          `"${nextPinnedProg.title}" programı saat ${nextPinnedProg.pinnedStartTime || ''} konumuna sabitlenmiş durumda.\n\n` +
          `• Sabit program öncesindeki kalan boşluk: ${availMin} dk ${availSec} sn\n` +
          `• Eklemek istediğiniz "${title}" süresi: ${needMin} dk ${needSec} sn\n\n` +
          `Önceki güne veya sabitlenmiş saate taşma yapılamaz. Lütfen daha kısa bir içerik seçin veya sabit programın altına (Alt modunda) ekleyin.`
        );
        return null;
      }
    }

    if (targetInsertIndex >= 0 && targetInsertIndex <= currentProgs.length) {
      currentProgs.splice(targetInsertIndex, 0, newAd);
    } else {
      currentProgs.push(newAd);
    }

    const renumberedProgs = renumberAdBreaksInList(currentProgs);

    set(state => ({
      selectedInstanceId: newAd.instanceId,
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
      module: 'Günlük Yayın Akışı',
      action: 'Reklam Kuşağı Eklendi',
      details: `${dateStr} (Liste ${v}) akışına "${title}" (${durationTc}) eklendi.`,
      count: 1,
      status: 'success'
    });
  },

  /**
   * Seçili yerleştirme konumuna (En Üst / Seçilenin Altına / En Alt) yeni bir Dolgu Kuşağı satırı ekler.
   */
  addFillerSlot: (channelId, dateStr, listType, durationMinutes = 15, insertAfterInstanceId = null, positionOverride = null) => {
    get().pushHistorySnapshot();
    const key = `${channelId}-${dateStr}`;
    const v = listType || get().activeList;
    const currentProgs = [...get().getRawDayPrograms(channelId, dateStr, v)];
    const durSec = Math.max(60, (Number(durationMinutes) || 15) * 60);
    const durTc = secondsToTimecode(durSec);
    const durFrames = timecodeToFrames(durTc);

    const fillerInstId = `inst_filler_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const newFiller = {
      id: `filler_${Date.now()}`,
      instanceId: fillerInstId,
      fillerGroupId: fillerInstId,
      fillerTargetSec: durSec,
      type: 'filler_slot',
      title: 'Dolgu Kuşağı',
      name: 'Dolgu Kuşağı',
      durationTc: durTc,
      durationFrames: durFrames,
      durationSec: durSec,
      category: 'Dolgu Kuşağı',
      categoryColor: '#8b5cf6',
      isKisaSlot: true,
      note: 'Kısa program veya klip seçmek için tıklayın',
      addedAt: Date.now()
    };

    const targetInsertIndex = resolveTargetInsertIndex(
      currentProgs,
      positionOverride || -1,
      get().insertPosition,
      insertAfterInstanceId || get().selectedInstanceId
    );

    if (targetInsertIndex >= 0 && targetInsertIndex <= currentProgs.length) {
      currentProgs.splice(targetInsertIndex, 0, newFiller);
    } else {
      currentProgs.push(newFiller);
    }

    const renumberedProgs = renumberAdBreaksInList(currentProgs);

    set(state => ({
      selectedInstanceId: newFiller.instanceId,
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

    return newFiller;
  },

  /**
   * Tekil bir yayın öğesini listeden siler.
   */
  removeProgram: (channelId, dateStr, listType, instanceId) => {
    get().pushHistorySnapshot();
    const key = `${channelId}-${dateStr}`;
    const v = listType || get().activeList;
    const existingProgs = get().getRawDayPrograms(channelId, dateStr, v);
    const removedTarget = existingProgs.find(p => p.instanceId === instanceId);
    const currentProgs = renumberAdBreaksInList(
      existingProgs.filter(p => p.instanceId !== instanceId)
    );

    set(state => ({
      selectedInstanceId: state.selectedInstanceId === instanceId ? null : state.selectedInstanceId,
      days: {
        ...state.days,
        [key]: {
          ...state.days[key],
          variants: {
            ...(state.days[key]?.variants || { A: { programs: [] }, B: { programs: [] } }),
            [v]: {
              ...(state.days[key]?.variants?.[v] || {}),
              programs: currentProgs
            }
          }
        }
      }
    }));

    if (removedTarget) {
      useAdminLogStore.getState().addLog({
        category: 'lists',
        module: 'Günlük Yayın Akışı',
        action: 'Akıştan Öğe Silindi',
        details: `${dateStr} (Liste ${v}) akışından "${removedTarget.clipName || removedTarget.title || 'Öğe'}" kaldırıldı.`,
        count: 1,
        status: 'warning'
      });
    }
  },

  /**
   * Çoklu seçilen yayın öğelerini listeden topluca siler.
   */
  removePrograms: (channelId, dateStr, listType, instanceIds = []) => {
    if (!Array.isArray(instanceIds) || instanceIds.length === 0) return;
    get().pushHistorySnapshot();
    const key = `${channelId}-${dateStr}`;
    const v = listType || get().activeList;
    const toDeleteSet = new Set(instanceIds);
    const currentProgs = renumberAdBreaksInList(
      get().getRawDayPrograms(channelId, dateStr, v).filter(p => !toDeleteSet.has(p.instanceId))
    );

    set(state => ({
      selectedInstanceId: toDeleteSet.has(state.selectedInstanceId) ? null : state.selectedInstanceId,
      days: {
        ...state.days,
        [key]: {
          ...state.days[key],
          variants: {
            ...(state.days[key]?.variants || { A: { programs: [] }, B: { programs: [] } }),
            [v]: {
              ...(state.days[key]?.variants?.[v] || {}),
              programs: currentProgs
            }
          }
        }
      }
    }));

    useAdminLogStore.getState().addLog({
      category: 'lists',
      module: 'Günlük Yayın Akışı',
      action: 'Akıştan Toplu Öğe Silindi',
      details: `${dateStr} (Liste ${v}) akışından ${instanceIds.length} adet öğe silindi.`,
      count: instanceIds.length,
      status: 'warning'
    });
  },

  /**
   * Seçili öğeleri klonlayarak belirtilen konuma ('top' = En Üst, 'after_selected' = Seçilenin Altına, 'bottom' = En Alt) çoğaltır.
   */
  duplicatePrograms: (channelId, dateStr, listType, instanceIds = [], positionMode = null) => {
    if (!Array.isArray(instanceIds) || instanceIds.length === 0) return { success: false, count: 0 };
    get().pushHistorySnapshot();
    const key = `${channelId}-${dateStr}`;
    const v = listType || get().activeList;
    const currentProgs = [...get().getRawDayPrograms(channelId, dateStr, v)];
    const toDupSet = new Set(instanceIds);

    const duplicatedItems = [];
    const newInstanceIds = [];
    let lastMatchedIdx = -1;
    currentProgs.forEach((prog, idx) => {
      if (toDupSet.has(prog.instanceId)) {
        lastMatchedIdx = idx;
        const cleanBaseTitle = String(prog.title || prog.name || 'İçerik').replace(/\s*\(Kopya\)\s*$/i, '').trim();
        const newInstId = `inst_dup_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`;
        newInstanceIds.push(newInstId);
        duplicatedItems.push({
          ...prog,
          id: `${prog.id}_dup_${Date.now()}_${idx}`,
          instanceId: newInstId,
          title: cleanBaseTitle,
          name: cleanBaseTitle,
          addedAt: Date.now()
        });
      }
    });

    if (duplicatedItems.length === 0) return { success: false, count: 0 };

    const effectivePos = positionMode && ['top', 'after_selected', 'bottom'].includes(positionMode)
      ? positionMode
      : (get().insertPosition || 'bottom');

    let newProgs = [];
    if (effectivePos === 'top') {
      newProgs = [...duplicatedItems, ...currentProgs];
    } else if (effectivePos === 'after_selected') {
      const insertAt = lastMatchedIdx !== -1 ? lastMatchedIdx + 1 : currentProgs.length;
      newProgs = [...currentProgs];
      newProgs.splice(insertAt, 0, ...duplicatedItems);
    } else {
      newProgs = [...currentProgs, ...duplicatedItems];
    }

    const renumberedProgs = renumberAdBreaksInList(newProgs);

    set(state => ({
      selectedInstanceId: newInstanceIds[newInstanceIds.length - 1] || state.selectedInstanceId,
      days: {
        ...state.days,
        [key]: {
          ...state.days[key],
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

    return {
      success: true,
      count: duplicatedItems.length,
      newInstanceIds,
      position: effectivePos,
      positionMode: effectivePos
    };
  },

  /**
   * Bir yayın öğesini bir satır yukarı ('up') veya aşağı ('down') taşır.
   */
  moveProgram: (channelId, dateStr, listType, instanceId, direction) => {
    get().pushHistorySnapshot();
    const key = `${channelId}-${dateStr}`;
    const v = listType || get().activeList;
    const progs = [...get().getRawDayPrograms(channelId, dateStr, v)];
    const idx = progs.findIndex(p => p.instanceId === instanceId);
    if (idx === -1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= progs.length) return;

    const temp = progs[idx];
    progs[idx] = progs[targetIdx];
    progs[targetIdx] = temp;

    const renumberedProgs = renumberAdBreaksInList(progs);

    set(state => ({
      days: {
        ...state.days,
        [key]: {
          ...state.days[key],
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
  },

  /**
   * Sürükle-bırak (Drag & Drop) ile öğe sıralamasını değiştirir.
   */
  reorderPrograms: (channelId, dateStr, listType, sourceIndex, targetIndex) => {
    if (sourceIndex === targetIndex) return;
    get().pushHistorySnapshot();
    const key = `${channelId}-${dateStr}`;
    const v = listType || get().activeList;
    const progs = [...get().getRawDayPrograms(channelId, dateStr, v)];
    if (sourceIndex < 0 || sourceIndex >= progs.length || targetIndex < 0) return;

    const clampedTarget = Math.min(targetIndex, progs.length - 1);
    if (sourceIndex === clampedTarget) return;

    const [removed] = progs.splice(sourceIndex, 1);
    progs.splice(clampedTarget, 0, removed);

    const renumberedProgs = renumberAdBreaksInList(progs);

    set(state => ({
      days: {
        ...state.days,
        [key]: {
          ...state.days[key],
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
  },

  /**
   * Bir programı/klibi belirli bir giriş saatine (`pinnedStartTime`, `pinnedStartFrames`) sabitler
   * ve listedeki sırasını da otomatik olarak o saate (`06:00:00` vb.) karşılık gelen konuma taşır!
   * - Gün başlangıcından (00:00:00 + dünden devir) önceye taşma yapılmasına izin vermez.
   * - İki sabit program arasına veya başka bir sabit programın üstüne sabitlenirken aradaki boşluk yetersizse
   *   kaç dakikalık boşluk olduğunu belirterek uyarır.
   */
  pinProgramAndReposition: (channelId, dateStr, listType, instanceId, pinnedTimeStr, pinnedStartFrames) => {
    const key = `${channelId}-${dateStr}`;
    const v = listType || get().activeList;
    const rawProgs = [...get().getRawDayPrograms(channelId, dateStr, v)];
    const currentIdx = rawProgs.findIndex(p => p.instanceId === instanceId);
    if (currentIdx === -1) return { success: false };

    const targetProg = rawProgs[currentIdx];
    const targetDurFrames = Math.max(
      BROADCAST_FPS,
      targetProg.durationFrames || timecodeToFrames(targetProg.durationTc || '00.30.00.00')
    );
    const prevOverflow = typeof get().getPreviousDayOverflowFrames === 'function'
      ? get().getPreviousDayOverflowFrames(channelId, dateStr, v)
      : 0;

    if (pinnedStartFrames < prevOverflow) {
      const minStartSec = Math.round(prevOverflow / BROADCAST_FPS);
      const minH = String(Math.floor(minStartSec / 3600)).padStart(2, '0');
      const minM = String(Math.floor((minStartSec % 3600) / 60)).padStart(2, '0');
      return {
        success: false,
        errorTitle: 'Önceki Güne Taşma Yapılamaz',
        errorMessage: `Seçtiğiniz saat (${pinnedTimeStr}), gün başlangıcından (${minH}:${minM}:00) daha önce. Gün önceki güne doğru taşamaz; lütfen ${minH}:${minM}:00 veya sonrası bir saat girin.`
      };
    }

    // Bir programın İntrosu ve çoklu part'ları (Part 1, Part 2...) birbirinden AYRILAMAZ bir bloktur!
    // Ayrıca sabitleme her zaman hedef programın (veya kendisine bağlı intronun/ilk partın) başını baz alır.
    const isIntroItem = (p) => Boolean(
      p && (p.isIntroClip || p.unitType === 'intro' || String(p.category || '').toLowerCase().includes('jenerik') || /^SEMERKAND_intro/i.test(p.title || ''))
    );

    const getLogicalBlockGroupKey = (p, idx) => {
      if (!p) return `single_${idx}`;
      if (p.type === 'ad_break') return `ad_${p.instanceId}`;
      if (p.fillerGroupId) return `filler_${p.fillerGroupId}`;
      if (p.draftId) return `draft_${p.draftId}`;
      return `prog_${getProgramGroupKey(p)}`;
    };

    // Hedef satırın ait olduğu program bloğunun (İntro + Part 1 + Part 2...) başlangıç ve bitiş indekslerini bul
    let targetBlockStart = currentIdx;
    let targetBlockEnd = currentIdx;

    if (isIntroItem(targetProg)) {
      // Kullanıcı doğrudan İntro satırını seçtiyse, hemen altındaki bağlı program/partları da aynı bloğa dahil et
      const introDraftId = targetProg.draftId;
      while (targetBlockEnd + 1 < rawProgs.length) {
        const nextP = rawProgs[targetBlockEnd + 1];
        if (nextP.type === 'ad_break' || isIntroItem(nextP)) break;
        if (introDraftId && nextP.draftId && String(nextP.draftId) === String(introDraftId)) {
          targetBlockEnd++;
        } else if (!introDraftId && targetBlockEnd === currentIdx) {
          targetBlockEnd++;
        } else {
          break;
        }
      }
    } else if (targetProg.type !== 'ad_break') {
      const myKey = getLogicalBlockGroupKey(targetProg, currentIdx);
      while (targetBlockStart - 1 >= 0) {
        const prevP = rawProgs[targetBlockStart - 1];
        if (prevP.type === 'ad_break') break;
        if (isIntroItem(prevP)) {
          // Programın hemen üstündeki intro bu programa aitse bloğun başına dahil et
          if (!prevP.draftId || !targetProg.draftId || String(prevP.draftId) === String(targetProg.draftId)) {
            targetBlockStart--;
          }
          break;
        }
        if (getLogicalBlockGroupKey(prevP, targetBlockStart - 1) === myKey) {
          targetBlockStart--;
        } else {
          break;
        }
      }
      while (targetBlockEnd + 1 < rawProgs.length) {
        const nextP = rawProgs[targetBlockEnd + 1];
        if (nextP.type === 'ad_break' || isIntroItem(nextP)) break;
        if (getLogicalBlockGroupKey(nextP, targetBlockEnd + 1) === myKey) {
          targetBlockEnd++;
        } else {
          break;
        }
      }
    }

    const targetBlockItems = rawProgs.slice(targetBlockStart, targetBlockEnd + 1);
    const targetBlockInstanceIds = new Set(targetBlockItems.map(p => p.instanceId));

    // Eğer kullanıcı program satırını (ör. Hatm-i Şerif) 06:00:00'a sabitlediyse,
    // seçilen satırın tam 06:00:00'da başlamasını sağla (veya üstünde introsu varsa intro onun hemen önünde yer alır)
    const offsetInsideBlock = currentIdx - targetBlockStart;
    let framesBeforeTargetInBlock = 0;
    for (let k = 0; k < offsetInsideBlock; k++) {
      const bp = targetBlockItems[k];
      framesBeforeTargetInBlock += Math.max(BROADCAST_FPS, bp.durationFrames || timecodeToFrames(bp.durationTc || '00.00.26.00'));
    }

    const totalTargetBlockFrames = targetBlockItems.reduce(
      (sum, bp) => sum + Math.max(BROADCAST_FPS, bp.durationFrames || timecodeToFrames(bp.durationTc || '00.30.00.00')),
      0
    );

    // Kalan öğeleri de kendi içlerinde (İntro + Program + Part 1/2) bölünmez bloklar halinde grupla!
    // Böylece hiçbir İntro kendi programından kopup yukarıda tek başına kalmaz!
    const remainingProgs = rawProgs.filter(p => !targetBlockInstanceIds.has(p.instanceId));

    // Başka sabitlenmiş programlarla çakışma kontrolü
    for (const op of remainingProgs) {
      if (op.isPinnedTime && typeof op.pinnedStartFrames === 'number') {
        const opDur = Math.max(BROADCAST_FPS, op.durationFrames || timecodeToFrames(op.durationTc || '00.30.00.00'));
        const opStart = op.pinnedStartFrames;
        const opEnd = opStart + opDur;
        const myStart = pinnedStartFrames;
        const myEnd = pinnedStartFrames + (totalTargetBlockFrames - framesBeforeTargetInBlock);

        if (myStart < opEnd && myEnd > opStart) {
          const gapFrames = Math.max(0, opStart > prevOverflow ? opStart - prevOverflow : 0);
          const gapMin = Math.floor((gapFrames / BROADCAST_FPS) / 60);
          return {
            success: false,
            errorTitle: 'Sabit Program Çakışması / Yetersiz Boşluk',
            errorMessage: `"${op.title}" programı ${op.pinnedStartTime || ''} saatine sabitlenmiş durumda.\nSeçtiğiniz ${pinnedTimeStr} saati ile bu sabit program arasında yeterli boşluk yok (Mevcut boşluk: ${gapMin} dk, Gereken: ${Math.ceil((targetDurFrames / BROADCAST_FPS) / 60)} dk).`
          };
        }
      }
    }

    // Kalan öğeleri mantıksal bloklara (İntro + Program Partları bir arada) ayır
    const blocks = [];
    let idxCursor = 0;
    while (idxCursor < remainingProgs.length) {
      const first = remainingProgs[idxCursor];
      if (first.type === 'ad_break') {
        blocks.push([first]);
        idxCursor++;
        continue;
      }

      const currentBlock = [first];
      let nextCursor = idxCursor + 1;

      if (isIntroItem(first)) {
        // Ardışık birikmiş sahipsiz introlar varsa temizlemek için aynı bloğa topla
        while (nextCursor < remainingProgs.length && isIntroItem(remainingProgs[nextCursor])) {
          nextCursor++;
        }
        // İntrodan sonra gelen programı ve tüm partlarını aynı bloğa bağla
        if (nextCursor < remainingProgs.length && remainingProgs[nextCursor].type !== 'ad_break' && !isIntroItem(remainingProgs[nextCursor])) {
          const progItem = remainingProgs[nextCursor];
          const progKey = getLogicalBlockGroupKey(progItem, nextCursor);
          currentBlock.push(progItem);
          nextCursor++;
          while (nextCursor < remainingProgs.length) {
            const cand = remainingProgs[nextCursor];
            if (cand.type === 'ad_break' || isIntroItem(cand)) break;
            if (getLogicalBlockGroupKey(cand, nextCursor) === progKey) {
              currentBlock.push(cand);
              nextCursor++;
            } else {
              break;
            }
          }
        }
      } else {
        const progKey = getLogicalBlockGroupKey(first, idxCursor);
        while (nextCursor < remainingProgs.length) {
          const cand = remainingProgs[nextCursor];
          if (cand.type === 'ad_break' || isIntroItem(cand)) break;
          if (getLogicalBlockGroupKey(cand, nextCursor) === progKey) {
            currentBlock.push(cand);
            nextCursor++;
          } else {
            break;
          }
        }
      }

      blocks.push(currentBlock);
      idxCursor = nextCursor;
    }

    // Hedef bloğun en başının (varsa introsunun) ihtiyaç duyduğu efektif başlangıç karesi
    const effectiveTargetBlockStartFrames = Math.max(prevOverflow, pinnedStartFrames - framesBeforeTargetInBlock);

    let checkCursor = prevOverflow;
    const beforeItems = [];
    const shiftedAfterItems = [];

    for (const blk of blocks) {
      // Blok içinde sabitlenmiş bir öğe var mı?
      const pinnedInBlk = blk.find(x => x.isPinnedTime && typeof x.pinnedStartFrames === 'number');
      const blkFrames = blk.reduce(
        (sum, x) => sum + Math.max(BROADCAST_FPS, x.durationFrames || timecodeToFrames(x.durationTc || '00.30.00.00')),
        0
      );

      if (pinnedInBlk) {
        if (pinnedInBlk.pinnedStartFrames < effectiveTargetBlockStartFrames) {
          beforeItems.push(...blk);
          checkCursor = Math.max(checkCursor, pinnedInBlk.pinnedStartFrames) + blkFrames;
        } else {
          shiftedAfterItems.push(...blk);
        }
      } else {
        // Blok tamamıyla (İntrosu + tüm partlarıyla) sabitlenen saatten önceye sığıyorsa önceye koy,
        // sığmıyorsa İntrosunu programından KOPARMADAN blok halinde sabit programın altına kaydır!
        if (checkCursor + blkFrames <= effectiveTargetBlockStartFrames) {
          beforeItems.push(...blk);
          checkCursor += blkFrames;
        } else {
          shiftedAfterItems.push(...blk);
        }
      }
    }

    const gapBeforePinnedFrames = Math.max(0, effectiveTargetBlockStartFrames - checkCursor);
    const gapBeforePinnedMin = Math.floor((gapBeforePinnedFrames / BROADCAST_FPS) / 60);
    const gapBeforePinnedSec = Math.round((gapBeforePinnedFrames / BROADCAST_FPS) % 60);

    get().pushHistorySnapshot();
    const updatedTargetBlock = targetBlockItems.map((bp, bIdx) => {
      if (bp.instanceId === instanceId) {
        return {
          ...bp,
          isPinnedTime: true,
          pinnedStartTime: pinnedTimeStr,
          pinnedStartFrames
        };
      }
      // Eğer hedef programın önünde introsu varsa ve aralarında boşluk oluşmaması için introyu da sabitleme bloğunun başına hizala
      if (bIdx === 0 && offsetInsideBlock > 0 && effectiveTargetBlockStartFrames > checkCursor) {
        return {
          ...bp,
          isPinnedTime: false,
          pinnedStartTime: null,
          pinnedStartFrames: null
        };
      }
      return bp;
    });

    const finalOrdered = renumberAdBreaksInList([
      ...beforeItems,
      ...updatedTargetBlock,
      ...shiftedAfterItems
    ]);

    const newIndex = finalOrdered.findIndex(p => p.instanceId === instanceId);

    set(state => ({
      selectedInstanceId: instanceId,
      days: {
        ...state.days,
        [key]: {
          ...state.days[key],
          date: dateStr,
          variants: {
            ...(state.days[key]?.variants || { A: { programs: [] }, B: { programs: [] } }),
            [v]: {
              ...(state.days[key]?.variants?.[v] || {}),
              programs: finalOrdered
            }
          }
        }
      }
    }));

    return {
      success: true,
      newOrder: newIndex + 1,
      gapBeforePinnedMin,
      gapBeforePinnedSec,
      shiftedCount: shiftedAfterItems.length
    };
  },

  /**
   * Tekil bir yayın öğesinin süresini, başlığını, bölüm/part veya not bilgilerini günceller.
   */
  updateProgram: (channelId, dateStr, listType, instanceId, updates) => {
    get().pushHistorySnapshot();
    const key = `${channelId}-${dateStr}`;
    const v = listType || get().activeList;
    const progs = get().getRawDayPrograms(channelId, dateStr, v).map(p => {
      if (p.instanceId === instanceId) {
        let durTc = updates.durationTc || p.durationTc;
        let durFrames = p.durationFrames;
        if (updates.durationTc) {
          durFrames = timecodeToFrames(updates.durationTc);
        }
        return {
          ...p,
          ...updates,
          durationTc: durTc,
          durationFrames: durFrames,
          durationSec: Math.floor(durFrames / BROADCAST_FPS)
        };
      }
      return p;
    });

    set(state => ({
      days: {
        ...state.days,
        [key]: {
          ...state.days[key],
          variants: {
            ...(state.days[key]?.variants || { A: { programs: [] }, B: { programs: [] } }),
            [v]: {
              ...(state.days[key]?.variants?.[v] || {}),
              programs: progs
            }
          }
        }
      }
    }));
  },

  /**
   * Akıllı Taslak Uygulama veya toplu yerleşim sonucunda günün program/klip listesini günceller.
   */
  setDayPrograms: (channelId, dateStr, listType, newPrograms = [], extraMeta = {}) => {
    get().pushHistorySnapshot();
    const key = `${channelId}-${dateStr}`;
    const v = listType || get().activeList;
    const renumbered = renumberAdBreaksInList(newPrograms);

    set(state => {
      const currentDay = state.days[key] || { variants: { A: { programs: [] }, B: { programs: [] } } };
      const currentVariant = currentDay.variants?.[v] || { programs: [] };
      return {
        days: {
          ...state.days,
          [key]: {
            ...currentDay,
            date: dateStr,
            variants: {
              ...(currentDay.variants || { A: { programs: [] }, B: { programs: [] } }),
              [v]: {
                ...currentVariant,
                ...extraMeta,
                programs: renumbered
              }
            }
          }
        }
      };
    });

    return { success: true, count: renumbered.length };
  },

  /**
   * Akıştaki seçili "Dolgu Kuşağı"na bir veya birden fazla klibi yerleştirir.
   * Aynı Dolgu Kuşağına (`fillerGroupId` / `fillerInstanceId`) birden fazla kez ekleme yapılabilir:
   * - İlk eklemede yer tutucu `filler_slot` satırının yerine yerleşir.
   * - Sonraki eklemelerde yalnızca o Dolgu Kuşağına (`fillerGroupId`) ait son klibin hemen altına eklenir; başka kuşağa geçmez.
   */
  replaceFillerSlotWithClips: (channelId, dateStr, listType, fillerInstanceId, clipsToAdd = []) => {
    if (!Array.isArray(clipsToAdd) || clipsToAdd.length === 0 || !fillerInstanceId) {
      return { success: false, count: 0 };
    }
    get().pushHistorySnapshot();
    const key = `${channelId}-${dateStr}`;
    const v = listType || get().activeList;
    const currentProgs = [...get().getRawDayPrograms(channelId, dateStr, v)];

    // 1. Önce doğrudan boş filler_slot satırını veya aynı fillerGroupId'ye sahip mevcut klipleri bul
    const fillerIdx = currentProgs.findIndex(
      p => p.type === 'filler_slot' && (p.instanceId === fillerInstanceId || p.fillerGroupId === fillerInstanceId)
    );
    const fillerItem = fillerIdx !== -1 ? currentProgs[fillerIdx] : null;

    // Eğer bu dolgu kuşağına daha önce klip eklendiyse, aynı fillerGroupId'ye sahip son klibi bul
    let lastGroupClipIdx = -1;
    let referenceGroupItem = fillerItem;
    currentProgs.forEach((p, idx) => {
      const pGroupId = p.fillerGroupId || (p.type === 'filler_slot' ? p.instanceId : null);
      if (
        (pGroupId && pGroupId === fillerInstanceId) ||
        p.instanceId === fillerInstanceId
      ) {
        lastGroupClipIdx = idx;
        if (!referenceGroupItem) referenceGroupItem = p;
      }
    });

    if (fillerIdx === -1 && lastGroupClipIdx === -1) {
      return { success: false, count: 0 };
    }

    const groupId =
      referenceGroupItem?.fillerGroupId ||
      referenceGroupItem?.instanceId ||
      fillerInstanceId;
    const targetSec =
      referenceGroupItem?.fillerTargetSec ||
      referenceGroupItem?.durationSec ||
      900;
    const slotTitle =
      referenceGroupItem?.fillerSlotTitle ||
      referenceGroupItem?.title ||
      'Dolgu Kuşağı';

    const formattedClips = clipsToAdd.map((clip, idx) => {
      const clipSec = clip.durationSec || clip.duration || 180;
      const durTc = clip.durationFormatted || clip.durationTc || secondsToTimecode(clipSec);
      const durFrames = timecodeToFrames(durTc);
      return {
        id: `filler_clip_${clip.fileId || idx}_${Date.now()}_${idx}`,
        instanceId: `inst_fclip_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
        fillerGroupId: groupId,
        fillerTargetSec: targetSec,
        fillerSlotTitle: slotTitle,
        draftId: referenceGroupItem?.draftId || null,
        draftStartTime: referenceGroupItem?.draftStartTime || null,
        type: 'clip',
        title: clip.name || clip.title || 'Kısa Program Klibi',
        name: clip.name || clip.title || 'Kısa Program Klibi',
        clipName: clip.name || clip.clipName || null,
        fileId: clip.fileId || null,
        durationTc: durTc,
        durationFrames: durFrames,
        durationSec: Math.floor(durFrames / BROADCAST_FPS),
        category: 'Dolgu Kuşağı',
        categoryColor: '#109AAD',
        isFillerClip: true,
        episodeNo: clip.episodeNo ?? null,
        partNo: clip.partNo ?? null,
        unitType: clip.unitType || 'bolum',
        unitLabel: clip.unitLabel || null,
        note: `Dolgu Kuşağı • ${clip.programTitle || clip.programName || 'Kısa Program'}${clip.topic ? ` (${clip.topic})` : ''}`,
        isFromDraft: Boolean(referenceGroupItem?.isFromDraft),
        addedAt: Date.now()
      };
    });

    if (fillerIdx !== -1) {
      // İlk ekleme: Boş Dolgu Kuşağı yer tutucusunun yerine klipleri yerleştir
      currentProgs.splice(fillerIdx, 1, ...formattedClips);
    } else if (lastGroupClipIdx !== -1) {
      // Sonraki eklemeler: Aynı Dolgu Kuşağına ait son klibin hemen altına ekle
      currentProgs.splice(lastGroupClipIdx + 1, 0, ...formattedClips);
    }

    const renumbered = renumberAdBreaksInList(currentProgs);

    set(state => {
      const currentDay = state.days[key] || { variants: { A: { programs: [] }, B: { programs: [] } } };
      const currentVariant = currentDay.variants?.[v] || { programs: [] };
      return {
        selectedInstanceId: formattedClips[formattedClips.length - 1]?.instanceId || null,
        days: {
          ...state.days,
          [key]: {
            ...currentDay,
            date: dateStr,
            variants: {
              ...(currentDay.variants || { A: { programs: [] }, B: { programs: [] } }),
              [v]: {
                ...currentVariant,
                programs: renumbered
              }
            }
          }
        }
      };
    });

    return {
      success: true,
      count: formattedClips.length,
      fillerGroupId: groupId
    };
  },

  /**
   * Bir Dolgu Kuşağına (`fillerGroupId`) eklenmiş tekil bir klibi kaldırır.
   * Eğer o Dolgu Kuşağındaki son klip kaldırıldıysa, Dolgu Kuşağı yer tutucu satırını aynı konuma geri koyar.
   */
  removeClipFromFillerGroup: (channelId, dateStr, listType, clipInstanceId) => {
    get().pushHistorySnapshot();
    const key = `${channelId}-${dateStr}`;
    const v = listType || get().activeList;
    const currentProgs = [...get().getRawDayPrograms(channelId, dateStr, v)];
    const targetIdx = currentProgs.findIndex(p => p.instanceId === clipInstanceId);
    if (targetIdx === -1) return { success: false };

    const targetClip = currentProgs[targetIdx];
    const groupId = targetClip.fillerGroupId;

    // Bu grupta başka klip kalıp kalmadığını kontrol et
    const remainingInGroup = groupId
      ? currentProgs.filter(p => p.instanceId !== clipInstanceId && p.fillerGroupId === groupId)
      : [];

    if (groupId && remainingInGroup.length === 0) {
      // Son klip silindiyse boş Dolgu Kuşağı satırını aynı konuma geri koy
      const durSec = targetClip.fillerTargetSec || 900;
      const durTc = secondsToTimecode(durSec);
      const durFrames = timecodeToFrames(durTc);
      const restoredFiller = {
        id: `filler_restored_${Date.now()}`,
        instanceId: groupId,
        fillerGroupId: groupId,
        fillerTargetSec: durSec,
        draftId: targetClip.draftId || null,
        draftStartTime: targetClip.draftStartTime || null,
        type: 'filler_slot',
        title: targetClip.fillerSlotTitle || 'Dolgu Kuşağı',
        name: targetClip.fillerSlotTitle || 'Dolgu Kuşağı',
        durationTc: durTc,
        durationFrames: durFrames,
        durationSec: durSec,
        category: 'Dolgu Kuşağı',
        categoryColor: '#109AAD',
        isKisaSlot: true,
        isFromDraft: Boolean(targetClip.isFromDraft),
        note: 'Kısa program veya klip seçmek için tıklayın',
        addedAt: Date.now()
      };
      currentProgs.splice(targetIdx, 1, restoredFiller);
    } else {
      currentProgs.splice(targetIdx, 1);
    }

    const renumbered = renumberAdBreaksInList(currentProgs);

    set(state => ({
      days: {
        ...state.days,
        [key]: {
          ...state.days[key],
          variants: {
            ...(state.days[key]?.variants || { A: { programs: [] }, B: { programs: [] } }),
            [v]: {
              ...(state.days[key]?.variants?.[v] || {}),
              programs: renumbered
            }
          }
        }
      }
    }));

    return { success: true, fillerGroupId: groupId };
  },

  /**
   * Liste A ile Liste B arasında kopyalama yapar.
   */
  copyList: (channelId, dateStr, fromList, toList) => {
    get().pushHistorySnapshot();
    const key = `${channelId}-${dateStr}`;
    const sourceProgs = get().getRawDayPrograms(channelId, dateStr, fromList);
    const clonedProgs = sourceProgs.map(p => ({
      ...p,
      instanceId: `inst_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    }));

    set(state => ({
      days: {
        ...state.days,
        [key]: {
          ...state.days[key],
          variants: {
            ...(state.days[key]?.variants || { A: { programs: [] }, B: { programs: [] } }),
            [toList]: { programs: clonedProgs }
          }
        }
      }
    }));
  },

  /**
   * Aktif günün listesini tamamen temizler.
   */
  clearList: (channelId, dateStr, listType) => {
    get().pushHistorySnapshot();
    const key = `${channelId}-${dateStr}`;
    const v = listType || get().activeList;

    set(state => ({
      selectedInstanceId: null,
      days: {
        ...state.days,
        [key]: {
          ...state.days[key],
          updatedAt: Date.now(),
          variants: {
            ...(state.days[key]?.variants || { A: { programs: [] }, B: { programs: [] } }),
            [v]: { programs: [], updatedAt: Date.now() }
          }
        }
      }
    }));

    // Ayrıca Reklam Rezervasyon ve Yayın Liste Kontrol modüllerindeki karşılığını ve sunucu deposunu da temizle
    try {
      fetch(`/api/draftSchedule?channel=${encodeURIComponent(channelId)}&dateKey=${encodeURIComponent(dateStr)}`, {
        method: 'DELETE'
      }).catch(() => {});
    } catch (_) {}

    try {
      usePlanningStore.setState(state => {
        const matchesDay = (k) => String(k || '').includes(channelId) && String(k || '').endsWith(dateStr);
        const nextDays = { ...(state.days || {}) };
        Object.keys(nextDays).forEach(k => { if (matchesDay(k)) delete nextDays[k]; });
        const nextLc = { ...(state.listControlDays || {}) };
        Object.keys(nextLc).forEach(k => { if (matchesDay(k)) delete nextLc[k]; });
        const nextPl = { ...(state.adPlacements || {}) };
        Object.keys(nextPl).forEach(k => { if (matchesDay(k)) delete nextPl[k]; });
        return { days: nextDays, listControlDays: nextLc, adPlacements: nextPl };
      });
    } catch (_) {}

    useAdminLogStore.getState().addLog({
      category: 'lists',
      module: 'Günlük Yayın Akışı',
      action: 'Günlük Yayın Listesi Temizlendi',
      details: `${dateStr} (Liste ${v}) yayın akışı tamamen sıfırlandı.`,
      status: 'warning'
    });
  }
});

