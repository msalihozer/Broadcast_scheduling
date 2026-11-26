/**
 * @file src/modules/broadcast/components/BroadcastDraftSidebar.jsx
 * @description Günün taslak akışını kuşak dilimlerine (Gece, Sabah, Gündüz, Akşam) ayırarak gösteren,
 * sağ kenarından fareyle sürüklenerek veya tek tıkla genişletilebilen (Resizable),
 * taslak içi canlı arama ve tüm arşivde klip arama sekmesini içeren yan panel koordinatörü.
 *
 * Modüler Alt Bileşenler (`./sidebar/*`):
 * 1. `DraftSidebarTopHeader.jsx`    -> Üst Sekmeler (Günün Taslağı / Program Klipleri), Genişlet/Daralt ve Ekleneceği Yer seçicisi
 * 2. `DraftSidebarFilterHeader.jsx` -> Kanal & Tarih bilgisi, Yenile butonu, canlı arama ve Tümü / Eklenmeyen / Eklenen filtreleri
 * 3. `DraftSidebarEmptyState.jsx`   -> Taslak olmayan günlerde gösterilen bilgi ve hazır taslaklı günler listesi
 * 4. `DraftProgramSlotItem.jsx`     -> Tekil taslak kuşağı ve akıllı bölüm/part/canlı yayın/dolgu kuşağı kartı
 * 5. `BroadcastClipSearchPanel.jsx` -> Tüm MAM arşivinde ve kullanılan programlarda canlı klip arama paneli
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dialog } from '../../../store/dialogStore';
import usePlanningStore from '../../../store/planningStore';
import useThemeStore from '../../../store/themeStore';
import { BROADCAST_CATEGORIES } from '../../../utils/categoryColors';
import useBroadcastStore, { BROADCAST_CHANNELS } from '../store/broadcastStore';
import {
  getDraftProgramsForDay,
  getAvailableDraftDates,
  fetchAndSyncDraftSchedule
} from '../utils/draftDataLoader';
import {
  secondsToTimecode,
  timecodeToFrames,
  BROADCAST_FPS
} from '../utils/timecodeUtils';
import {
  doesDraftSlotMatchRundownItem,
  getDraftSlotUpdateStatus,
  getDraftSlotUniqueKey,
  clearBroadcastArchiveCaches
} from '../utils/draftSlotMatcher';
import { filterAndSortBySearchPriority } from '../../../utils/searchRanker';
import DraftProgramSlotItem, { normalizeProgramText, isDraftSlotAddedToRundown } from './DraftProgramSlotItem';
import BroadcastClipSearchPanel from './BroadcastClipSearchPanel';
import FillerSlotModal from './FillerSlotModal';
import DraftSidebarTopHeader from './sidebar/DraftSidebarTopHeader';
import DraftSidebarFilterHeader from './sidebar/DraftSidebarFilterHeader';
import DraftSidebarEmptyState from './sidebar/DraftSidebarEmptyState';
import useResponsive from '../../../hooks/useResponsive';
import Ikon from '../../../components/Ikon';

const MIN_SIDEBAR_WIDTH = 420;
const DEFAULT_SIDEBAR_WIDTH = 490;
const EXPANDED_SIDEBAR_WIDTH = 680;
const MAX_SIDEBAR_WIDTH = 900;

/**
 * Saate göre günün kuşak dilimi bilgisini döndürür (Gece, Sabah, Gündüz, Akşam).
 */
function getDayPeriodInfo(startTimeStr) {
  const customPeriods = useThemeStore.getState()?.config?.periodColors || {};
  const hour = parseInt(String(startTimeStr || '00:00').split(':')[0], 10) || 0;
  if (hour >= 0 && hour < 6) {
    return { id: 'night', label: 'Gece Yayın Kuşağı', range: '00:00 - 06:00', icon: 'gece', color: customPeriods.night?.color || '#0B2B54', textColor: '#FFFFFF' };
  }
  if (hour >= 6 && hour < 12) {
    return { id: 'morning', label: 'Sabah Yayın Kuşağı', range: '06:00 - 12:00', icon: 'sabah', color: customPeriods.morning?.color || '#E8B44C', textColor: '#0A101D' };
  }
  if (hour >= 12 && hour < 18) {
    return { id: 'day', label: 'Gündüz Yayın Kuşağı', range: '12:00 - 18:00', icon: 'gunduz', color: customPeriods.day?.color || '#109AAD', textColor: '#FFFFFF' };
  }
  return { id: 'evening', label: 'Akşam & Prime-Time Kuşağı', range: '18:00 - 24:00', icon: 'aksam', color: customPeriods.evening?.color || '#0C617C', textColor: '#FFFFFF' };
}

export default function BroadcastDraftSidebar() {
  const { isCompact } = useResponsive();
  const {
    selectedChannel,
    selectedDate,
    setSelectedDate,
    activeList,
    days,
    draftVersion,
    notifyDraftUpdated,
    activeSidebarTab,
    setActiveSidebarTab,
    activeFillerItem,
    openFillerInSidebar,
    closeFillerSidebar,
    toggleDraftSidebar,
    getRawDayPrograms,
    getComputedDayPrograms,
    getDayVariantMeta,
    toggleManualDraftSlotAdded,
    setDayPrograms,
    replaceFillerSlotWithClips,
    removeClipFromFillerGroup,
    addProgram,
    introDefaultSettings,
    selectedInstanceId,
    selectedInstanceIds,
    insertPosition,
    setInsertPosition
  } = useBroadcastStore();

  const [usedPrograms, setUsedPrograms] = useState([]);
  const [draftSearchQuery, setDraftSearchQuery] = useState('');
  const [draftStatusFilter, setDraftStatusFilter] = useState('all'); // 'all' | 'missing' | 'added'
  const slotElementsRef = useRef({});
  const hiddenCategoryIds = usePlanningStore(state => state.hiddenCategoryIds) || [];
  const hiddenCatSet = useMemo(() => new Set((hiddenCategoryIds || []).map(id => Number(id))), [hiddenCategoryIds]);
  const hiddenCatNamesNorm = useMemo(() => {
    const names = [];
    for (const id of hiddenCatSet) {
      const catMeta = BROADCAST_CATEGORIES[id];
      if (catMeta?.name) names.push(normalizeProgramText(catMeta.name));
    }
    return names;
  }, [hiddenCatSet]);

  const visibleUsedPrograms = useMemo(
    () => usedPrograms.filter(p => !hiddenCatSet.has(Number(p.categoryId))),
    [usedPrograms, hiddenCatSet]
  );

  const hiddenProgramTitlesNorm = useMemo(() => {
    const set = new Set();
    usedPrograms.forEach(p => {
      if (hiddenCatSet.has(Number(p.categoryId)) && p.title) {
        set.add(normalizeProgramText(p.title));
      }
    });
    return set;
  }, [usedPrograms, hiddenCatSet]);

  // Genişletilebilir (Resizable) Panel Genişliği
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem('broadcast_draft_sidebar_width'), 10);
      if (!isNaN(saved) && saved >= MIN_SIDEBAR_WIDTH && saved <= MAX_SIDEBAR_WIDTH) {
        return saved;
      }
    } catch (e) {}
    return DEFAULT_SIDEBAR_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);

  useEffect(() => {
    try {
      localStorage.setItem('broadcast_draft_sidebar_width', String(sidebarWidth));
    } catch (e) {}
  }, [sidebarWidth]);

  // Fare ile sağ kenardan sürükleyerek genişletme/daraltma
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const delta = e.clientX - startXRef.current;
      const maxAllowed = Math.min(MAX_SIDEBAR_WIDTH, Math.floor(window.innerWidth * 0.62));
      const nextWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxAllowed, startWidthRef.current + delta));
      setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleToggleWideMode = () => {
    setSidebarWidth(prev => (prev >= EXPANDED_SIDEBAR_WIDTH - 40 ? DEFAULT_SIDEBAR_WIDTH : EXPANDED_SIDEBAR_WIDTH));
  };

  // Admin Panel -> Programlar (Aktif kullanılan programlar) listesini çek
  useEffect(() => {
    let isMounted = true;
    fetch('/api/archive/used-programs')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (isMounted && data && Array.isArray(data.programs)) {
          setUsedPrograms(data.programs);
        }
      })
      .catch(err => console.error('Kullanılan programlar yüklenemedi:', err));
    return () => { isMounted = false; };
  }, [draftVersion]);

  const currentChannelObj = BROADCAST_CHANNELS.find(c => c.id === selectedChannel) || BROADCAST_CHANNELS[0];

  // O güne ait taslak akışını yükle (Sadece o gün için gerçekten taslak varsa gelir; yoksa [] döner)
  const draftPrograms = useMemo(() => {
    return getDraftProgramsForDay(selectedChannel, selectedDate);
  }, [selectedChannel, selectedDate, draftVersion]);

  // Bu kanalda gerçekten taslağı hazırlanmış günlerin listesi
  const availableDraftDates = useMemo(() => {
    return getAvailableDraftDates(selectedChannel);
  }, [selectedChannel, draftVersion]);

  const handleManualRefreshDraft = async () => {
    clearBroadcastArchiveCaches();
    await fetchAndSyncDraftSchedule(selectedChannel);
    notifyDraftUpdated(selectedChannel);
    try {
      const res = await fetch('/api/archive/used-programs');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.programs)) {
          setUsedPrograms(data.programs);
        }
      }
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('broadcast-trigger-sync-draft'));
  };

  // Günün mevcut yayın akışındaki programlar
  const currentRundownPrograms = useMemo(() => {
    return getRawDayPrograms(selectedChannel, selectedDate, activeList) || [];
  }, [selectedChannel, selectedDate, activeList, days, getRawDayPrograms]);

  // Kullanıcının "Ekledim" butonuyla manuel olarak eklenmiş işaretlediği taslak kuşakları
  const manuallyMarkedDraftSlotIds = useMemo(() => {
    if (typeof getDayVariantMeta === 'function') {
      return getDayVariantMeta(selectedChannel, selectedDate, activeList)?.manuallyMarkedDraftSlotIds || [];
    }
    return [];
  }, [selectedChannel, selectedDate, activeList, days, getDayVariantMeta]);

  const handleToggleManualAdded = (draftItem) => {
    if (!draftItem || typeof toggleManualDraftSlotAdded !== 'function') return;
    const slotKey = getDraftSlotUniqueKey(draftItem);
    toggleManualDraftSlotAdded(selectedChannel, selectedDate, activeList, slotKey);
  };

  // Hesaplanmış zaman kodlarıyla günün yayın akışı ve Dolgu Kuşakları listesi
  const computedRundownPrograms = useMemo(() => {
    return getComputedDayPrograms(selectedChannel, selectedDate, activeList) || [];
  }, [selectedChannel, selectedDate, activeList, days, getComputedDayPrograms]);

  // Yayın akışındaki tüm Dolgu Kuşaklarını (hem henüz boş olanları hem de içine klip eklenmiş olanları) kendi fillerGroupId kimliğiyle grupla
  const fillerSlotsInRundown = useMemo(() => {
    const groupsMap = new Map();
    const groupsList = [];
    let currentConsecutiveGroupId = null;

    computedRundownPrograms.forEach((p, idx) => {
      const isFillerRow = p.type === 'filler_slot' || Boolean(p.isKisaSlot);
      const isFillerClipRow =
        !isFillerRow &&
        (Boolean(p.isFillerClip) ||
          p.category === 'Dolgu Kuşağı' ||
          (p.note && String(p.note).startsWith('Dolgu Kuşağı')));

      if (!isFillerRow && !isFillerClipRow) {
        currentConsecutiveGroupId = null;
        return;
      }

      let groupId = p.fillerGroupId || (isFillerRow ? p.instanceId : null);
      if (!groupId) {
        groupId = p.draftId
          ? `filler_draft_${p.draftId}`
          : (currentConsecutiveGroupId || p.instanceId);
      }
      currentConsecutiveGroupId = groupId;

      if (!groupsMap.has(groupId)) {
        const clipSec = isFillerClipRow
          ? (p.durationSec || Math.floor((p.durationFrames || 0) / 25) || 0)
          : 0;
        const groupObj = {
          instanceId: groupId,
          fillerGroupId: groupId,
          draftId: p.draftId || null,
          draftStartTime: p.draftStartTime || null,
          title: p.fillerSlotTitle || (isFillerRow ? p.title : 'Dolgu Kuşağı') || 'Dolgu Kuşağı',
          order: p.order || idx + 1,
          calculatedStartTime: p.calculatedStartTime,
          calculatedEndTime: p.calculatedEndTime,
          durationSec: p.fillerTargetSec || p.durationSec || Math.floor((p.durationFrames || 0) / 25) || 900,
          addedClips: isFillerClipRow ? [p] : [],
          addedDurationSec: clipSec
        };
        groupsMap.set(groupId, groupObj);
        groupsList.push(groupObj);
      } else {
        const existing = groupsMap.get(groupId);
        existing.calculatedEndTime = p.calculatedEndTime;
        if (isFillerClipRow) {
          existing.addedClips.push(p);
          existing.addedDurationSec += (p.durationSec || Math.floor((p.durationFrames || 0) / 25) || 0);
        }
      }
    });

    return groupsList;
  }, [computedRundownPrograms]);

  // Hangi Dolgu Kuşağı seçildiyse SADECE onu aktif tut; başka bir Dolgu Kuşağına otomatik atlama!
  const effectiveFillerItem = useMemo(() => {
    if (activeFillerItem) {
      const targetGroupId = activeFillerItem.fillerGroupId || activeFillerItem.instanceId;
      const found = fillerSlotsInRundown.find(
        f =>
          f.fillerGroupId === targetGroupId ||
          f.instanceId === targetGroupId ||
          (activeFillerItem.instanceId && f.addedClips?.some(c => c.instanceId === activeFillerItem.instanceId)) ||
          (activeFillerItem.draftId && f.draftId && String(f.draftId) === String(activeFillerItem.draftId))
      );
      if (found) return found;
    }
    return fillerSlotsInRundown[0] || null;
  }, [activeFillerItem, fillerSlotsInRundown]);

  const handleConfirmFillerClipsInSidebar = (selectedClips, targetFiller = null) => {
    const fillerTarget = targetFiller || effectiveFillerItem;
    if (!fillerTarget || !Array.isArray(selectedClips) || selectedClips.length === 0) return;

    const targetId = fillerTarget.fillerGroupId || fillerTarget.instanceId;
    const res = replaceFillerSlotWithClips(
      selectedChannel,
      selectedDate,
      activeList,
      targetId,
      selectedClips
    );

    if (res.success && res.fillerGroupId) {
      // Kullanıcı aynı dolgu kuşağına birden fazla ekleme yapabilsin diye seçili kuşağı koru
      openFillerInSidebar({
        ...fillerTarget,
        instanceId: res.fillerGroupId,
        fillerGroupId: res.fillerGroupId
      });
    }
  };

  const handleRemoveFillerClipInSidebar = (clipInstanceId) => {
    if (!clipInstanceId) return;
    removeClipFromFillerGroup(selectedChannel, selectedDate, activeList, clipInstanceId);
  };

  // Yayın akışı tablosunda seçili olan klip/satır
  const selectedRundownItem = useMemo(() => {
    const activeId =
      selectedInstanceId ||
      (Array.isArray(selectedInstanceIds) && selectedInstanceIds.length > 0
        ? selectedInstanceIds[selectedInstanceIds.length - 1]
        : null);
    if (!activeId) return null;
    return currentRundownPrograms.find(p => p.instanceId === activeId) || null;
  }, [currentRundownPrograms, selectedInstanceId, selectedInstanceIds]);

  // Seçili klibin Günün Taslağı içinde eşleştiği kuşaklar
  const matchedDraftSlotsForSelectedClip = useMemo(() => {
    if (!selectedRundownItem || !Array.isArray(draftPrograms) || draftPrograms.length === 0) {
      return [];
    }
    return draftPrograms.filter(slot =>
      doesDraftSlotMatchRundownItem(slot, selectedRundownItem)
    );
  }, [draftPrograms, selectedRundownItem]);

  const handleScrollToDraftSlot = (slot) => {
    if (!slot) return;
    if (draftStatusFilter !== 'all') {
      setDraftStatusFilter('all');
    }
    setTimeout(() => {
      const key = slot.id || `${slot.startTime}_${slot.title}`;
      const el = slotElementsRef.current[key];
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);
  };

  // Yayın akışında bir klip seçildiğinde taslakta karşılığı varsa otomatik olarak o kuşağa kaydır
  useEffect(() => {
    if (activeSidebarTab !== 'draft') return;
    if (matchedDraftSlotsForSelectedClip.length === 0) return;
    const firstSlot = matchedDraftSlotsForSelectedClip[0];
    const key = firstSlot.id || `${firstSlot.startTime}_${firstSlot.title}`;
    const el = slotElementsRef.current[key];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedInstanceId, activeSidebarTab, matchedDraftSlotsForSelectedClip]);

  // Taslak kuşaklarının eklenme ve güncellenme durumu istatistikleri
  const draftCheckStats = useMemo(() => {
    const addedIds = new Set();
    const updatedIds = new Set();
    let addedCount = 0;
    let updatedCount = 0;
    draftPrograms.forEach(item => {
      const slotKey = getDraftSlotUniqueKey(item);
      if (isDraftSlotAddedToRundown(item, currentRundownPrograms, draftPrograms, manuallyMarkedDraftSlotIds)) {
        if (item.id) addedIds.add(item.id);
        if (slotKey) addedIds.add(slotKey);
        addedCount++;
        const upd = getDraftSlotUpdateStatus(item, currentRundownPrograms, selectedDate);
        if (upd.isUpdatedInDraft) {
          if (item.id) updatedIds.add(item.id);
          if (slotKey) updatedIds.add(slotKey);
          updatedCount++;
        }
      }
    });
    return {
      total: draftPrograms.length,
      addedCount,
      missingCount: Math.max(0, draftPrograms.length - addedCount),
      updatedCount,
      addedIds,
      updatedIds
    };
  }, [draftPrograms, currentRundownPrograms, selectedDate, manuallyMarkedDraftSlotIds]);

  // Günün Taslağı içinde canlı arama, kategori gizleme filtresi ve durum filtresi
  const filteredDraftPrograms = useMemo(() => {
    let list = draftPrograms.filter(item => {
      if (item.categoryId && hiddenCatSet.has(Number(item.categoryId))) return false;
      const catNorm = normalizeProgramText(item.category || '');
      if (catNorm && hiddenCatNamesNorm.some(hn => catNorm === hn || catNorm.includes(hn))) return false;
      const titleNorm = normalizeProgramText(item.title || item.name || '');
      if (titleNorm && hiddenProgramTitlesNorm.has(titleNorm)) return false;
      return true;
    });

    if (draftStatusFilter === 'missing') {
      list = list.filter(item => {
        const slotKey = getDraftSlotUniqueKey(item);
        const isAdded = (item.id && draftCheckStats.addedIds.has(item.id)) || (slotKey && draftCheckStats.addedIds.has(slotKey));
        const isUpdated = (item.id && draftCheckStats.updatedIds.has(item.id)) || (slotKey && draftCheckStats.updatedIds.has(slotKey));
        return !isAdded || isUpdated;
      });
    } else if (draftStatusFilter === 'added') {
      list = list.filter(item => {
        const slotKey = getDraftSlotUniqueKey(item);
        return (item.id && draftCheckStats.addedIds.has(item.id)) || (slotKey && draftCheckStats.addedIds.has(slotKey));
      });
    }

    if (!draftSearchQuery.trim()) return list;
    return filterAndSortBySearchPriority(
      list,
      draftSearchQuery,
      (item) => item.title || item.name || '',
      (item) => [item.episode ? `Bölüm ${item.episode}` : '', item.category, item.host, item.topic, item.startTime]
    );
  }, [draftPrograms, draftSearchQuery, draftStatusFilter, draftCheckStats, hiddenCatSet, hiddenCatNamesNorm, hiddenProgramTitlesNorm]);

  // Programdan önce İntro klibi ekleyen yardımcı (Otomatik İntro açıksa ve eklendiyse true döner)
  const prependIntroClipForDraftSlot = (draftItem) => {
    if (!draftItem) return false;
    if (introDefaultSettings?.autoInsertIntro === false) return false;

    const rawTitle = draftItem.title || draftItem.name || '';
    const normTitle = normalizeProgramText(rawTitle);
    const isFiller = Boolean(draftItem.isKisaSlot || normTitle.includes('dolgu kusagi') || normTitle === 'dolgu');
    if (isFiller) return false;

    // Yalnızca kullanıcı "Seçili Satırın Altı" modunda doğrudan bir İntro satırının altına ekleme yapıyorsa mükerrer intro ekleme
    if (insertPosition === 'after_selected' && selectedRundownItem?.isIntroClip) {
      return false;
    }

    const introName = introDefaultSettings?.name || 'SEMERKAND_intro_v3_2014';
    const introFileId = introDefaultSettings?.fileId || 725;
    const introSec = introDefaultSettings?.durationSec || 26;
    const introTc = introDefaultSettings?.durationTc || secondsToTimecode(introSec);
    const introProg =
      usedPrograms.find(p => normalizeProgramText(p.title) === 'intro') ||
      usedPrograms.find(p => Number(p.id) === 18522);

    addProgram(selectedChannel, selectedDate, activeList, {
      title: introName,
      name: introName,
      clipName: introName,
      fileId: introFileId,
      draftId: draftItem.id || null,
      draftStartTime: draftItem.startTime || null,
      durationTc: introTc,
      durationSec: introSec,
      category: introDefaultSettings?.category || introProg?.categoryName || 'Jenerik / İntro',
      categoryColor: '#6366f1',
      episodeNo: null,
      partNo: null,
      unitType: 'intro',
      unitLabel: 'İntro',
      note: `İntro • ${rawTitle}`,
      isFromDraft: true,
      isIntroClip: true,
      type: 'clip'
    });
    return true;
  };

  // Taslakta güncellenen bir kuşağı kullanıcının onayıyla akışta kendi yerinde (İntro + Yeni Partlarıyla, Reklam ve Dolgu kuşaklarını koruyarak) güncelle
  const handleUpdateDraftSlotInRundown = (draftItem, clipsList = []) => {
    if (!draftItem) return;
    const rawTitle = draftItem.title || draftItem.name || 'Program';
    const working = [...(getRawDayPrograms(selectedChannel, selectedDate, activeList) || [])];

    const existingIndices = [];
    working.forEach((p, idx) => {
      if (
        p.draftId &&
        draftItem.id &&
        String(p.draftId) === String(draftItem.id) &&
        !p.isIntroClip &&
        !p.isFillerClip &&
        p.type !== 'filler_slot' &&
        p.type !== 'ad_break' &&
        p.category !== 'Dolgu Kuşağı'
      ) {
        existingIndices.push(idx);
      }
    });

    if (existingIndices.length === 0) {
      if (Array.isArray(clipsList) && clipsList.length > 0) {
        handleAddAllClips(clipsList, draftItem);
      } else {
        handleAddSingleDraftItem(draftItem);
      }
      return;
    }

    const firstIdx = existingIndices[0];
    const hasPrecedingIntro = firstIdx > 0 && Boolean(working[firstIdx - 1]?.isIntroClip);
    const shouldInsertIntro = introDefaultSettings?.autoInsertIntro !== false && !hasPrecedingIntro;

    const newItems = [];
    if (shouldInsertIntro) {
      const introName = introDefaultSettings?.name || 'SEMERKAND_intro_v3_2014';
      const introFileId = introDefaultSettings?.fileId || 725;
      const introSec = introDefaultSettings?.durationSec || 26;
      const introTc = introDefaultSettings?.durationTc || secondsToTimecode(introSec);
      const introFrames = timecodeToFrames(introTc);
      newItems.push({
        id: `intro_${introFileId}_${Date.now()}`,
        instanceId: `inst_intro_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        draftId: draftItem.id || null,
        draftStartTime: draftItem.startTime || null,
        type: 'clip',
        isIntroClip: true,
        title: introName,
        name: introName,
        clipName: introName,
        fileId: introFileId,
        durationTc: introTc,
        durationFrames: introFrames,
        durationSec: Math.floor(introFrames / BROADCAST_FPS),
        category: introDefaultSettings?.category || 'Jenerik / İntro',
        categoryColor: '#6366f1',
        episodeNo: null,
        partNo: null,
        unitType: 'intro',
        unitLabel: 'İntro',
        note: `İntro • ${rawTitle}`,
        isFromDraft: true,
        addedAt: Date.now()
      });
    } else if (hasPrecedingIntro && working[firstIdx - 1]) {
      working[firstIdx - 1] = {
        ...working[firstIdx - 1],
        draftId: draftItem.id || working[firstIdx - 1].draftId,
        draftStartTime: draftItem.startTime || working[firstIdx - 1].draftStartTime,
        note: `İntro • ${rawTitle}`
      };
    }

    if (Array.isArray(clipsList) && clipsList.length > 0) {
      clipsList.forEach((clip, partIdx) => {
        const clipSec = clip.durationSec || clip.duration || 1800;
        const durTc = clip.durationFormatted || secondsToTimecode(clipSec);
        const durFrames = timecodeToFrames(durTc);
        const clipDisplay = clip.name || clip.fileName || rawTitle;
        newItems.push({
          id: `clip_${clip.fileId || partIdx}_${Date.now()}_${partIdx}`,
          instanceId: `inst_clip_${Date.now()}_${partIdx}_${Math.random().toString(36).substr(2, 5)}`,
          draftId: draftItem.id || null,
          draftStartTime: draftItem.startTime || null,
          type: 'clip',
          title: clipDisplay,
          name: clipDisplay,
          clipName: clipDisplay,
          fileId: clip.fileId,
          durationTc: durTc,
          durationFrames: durFrames,
          durationSec: Math.floor(durFrames / BROADCAST_FPS),
          category: clip.categoryName || draftItem.category || 'Programlar',
          categoryColor: clip.categoryColor || draftItem.categoryColor || '#0d9488',
          episodeNo: clip.episodeNo ?? draftItem.episode ?? null,
          partNo: clip.partNo ?? null,
          unitType: clip.unitType || 'bolum',
          unitLabel: clip.unitLabel || null,
          appliedDraftTitle: rawTitle,
          appliedDraftEpisode: draftItem.episode ?? draftItem.episodeNo ?? clip.episodeNo ?? null,
          note: `Program: ${rawTitle}${clip.topic ? ` • ${clip.topic}` : ''}`,
          isFromDraft: true,
          addedAt: Date.now()
        });
      });
    } else {
      const durSec = draftItem.durationSec || ((draftItem.duration || 30) * 60);
      const durTc = draftItem.durationFormatted || secondsToTimecode(durSec);
      const durFrames = timecodeToFrames(durTc);
      newItems.push({
        id: `prog_${draftItem.id || Date.now()}`,
        instanceId: `inst_prog_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        draftId: draftItem.id || null,
        draftStartTime: draftItem.startTime || null,
        type: 'program',
        title: rawTitle,
        name: rawTitle,
        durationTc: durTc,
        durationFrames: durFrames,
        durationSec: Math.floor(durFrames / BROADCAST_FPS),
        category: draftItem.category || 'Programlar',
        categoryColor: draftItem.categoryColor || '#3b82f6',
        episodeNo: draftItem.episode || null,
        appliedDraftTitle: rawTitle,
        appliedDraftEpisode: draftItem.episode ?? draftItem.episodeNo ?? null,
        note: `Program: ${rawTitle}`,
        isFromDraft: true,
        addedAt: Date.now()
      });
    }

    const toRemoveSet = new Set(existingIndices.map(i => working[i]?.instanceId));
    const filtered = working.filter(p => !toRemoveSet.has(p.instanceId));
    const insertAt = Math.min(firstIdx, filtered.length);
    filtered.splice(insertAt, 0, ...newItems);

    setDayPrograms(selectedChannel, selectedDate, activeList, filtered);
    dialog.success(
      'Kuşak Güncellendi',
      `"${rawTitle}" kuşağı güncel taslak bilgisi, İntrosu ve klipleriyle akışta güncellendi (Reklam ve Dolgu kuşaklarınız korundu).`
    );
  };

  // Tekil taslak programını yayına ekle (İntro + Canlı Yayın / Dolgu Kuşağı / Program)
  const handleAddSingleDraftItem = (draftItem) => {
    const rawTitle = draftItem.title || draftItem.name || 'İsimsiz Program';
    const normTitle = normalizeProgramText(rawTitle);
    const isFiller = Boolean(draftItem.isKisaSlot || normTitle.includes('dolgu kusagi') || normTitle === 'dolgu');
    const isLive = Boolean(
      draftItem.isLive ||
      (Array.isArray(draftItem.selectedOptions) && draftItem.selectedOptions.some(o => /canl[ıi]/i.test(String(o)))) ||
      /\bcanl[ıi]\b/i.test(`${draftItem.rawTitle || ''} ${rawTitle} ${draftItem.host || ''}`)
    );
    const durSec = draftItem.durationSec || ((draftItem.duration || (isFiller ? 15 : 30)) * 60);
    const durTc = draftItem.durationFormatted || secondsToTimecode(durSec);

    let introInserted = false;
    if (!isFiller) {
      introInserted = prependIntroClipForDraftSlot(draftItem);
    }

    const liveDetail = [draftItem.host, draftItem.topic].filter(Boolean).join(' • ') || draftItem.note || '';

    addProgram(
      selectedChannel,
      selectedDate,
      activeList,
      {
        title: rawTitle,
        name: draftItem.name || rawTitle,
        clipName: isLive
          ? `${rawTitle}${draftItem.episode ? ` - Bölüm ${draftItem.episode}` : ''}${liveDetail ? ` (${liveDetail})` : ''}`
          : null,
        draftId: draftItem.id,
        draftStartTime: draftItem.startTime || null,
        durationTc: durTc,
        durationSec: durSec,
        category: isFiller ? 'Dolgu Kuşağı' : isLive ? (draftItem.category || 'Canlı Yayın') : (draftItem.category || 'Genel'),
        categoryColor: isFiller ? '#8b5cf6' : isLive ? '#ef4444' : (draftItem.categoryColor || '#3b82f6'),
        episodeNo: draftItem.episode || null,
        partNo: draftItem.part || null,
        host: draftItem.host || '',
        topic: draftItem.topic || '',
        note: isFiller
          ? 'Klip Seç ve Doldur butonuna tıklayarak kısa program veya klip seçebilirsiniz'
          : (liveDetail || draftItem.note || (isLive ? 'Canlı Yayın' : 'Taslaktan Eklendi')),
        isFromDraft: true,
        isKisaSlot: isFiller,
        isLive: isLive,
        type: isFiller ? 'filler_slot' : isLive ? 'live' : 'program'
      },
      introInserted ? 'after_selected' : -1
    );

    const posLabel =
      insertPosition === 'top'
        ? 'Listenin En Üstü'
        : insertPosition === 'after_selected'
        ? 'Seçili Satırın Altı'
        : 'Listenin En Altı';

    dialog.success(
      isFiller ? 'Dolgu Kuşağı Eklendi' : isLive ? 'Canlı Yayın Eklendi' : 'Taslak Kuşağı Eklendi',
      `Taslaktaki kuşak yayın akışına başarıyla eklendi.\nKuşak: ${rawTitle}\nTür: ${isFiller ? 'Dolgu Kuşağı' : isLive ? 'Canlı Yayın' : 'Program'}${introInserted ? '\nİntro: Otomatik Eklendi (26 sn)' : ''}\nEklendiği Konum: ${posLabel}`
    );
  };

  // Klip adıyla yayına ekle
  const handleAddClip = (clip, parentDraftItem, skipAutoIntro = false, forceAfterSelected = false) => {
    let introInserted = false;
    if (!skipAutoIntro && parentDraftItem && (!clip.partNo || Number(clip.partNo) === 1)) {
      introInserted = prependIntroClipForDraftSlot(parentDraftItem);
    }
    const durTc = secondsToTimecode(clip.durationSec || 60);
    const clipDisplay = clip.name || clip.fileName || 'Klip';
    addProgram(
      selectedChannel,
      selectedDate,
      activeList,
      {
        title: clipDisplay,
        name: clipDisplay,
        clipName: clip.name || clip.fileName,
        fileId: clip.fileId,
        draftId: parentDraftItem?.id || null,
        draftStartTime: parentDraftItem?.startTime || null,
        durationTc: durTc,
        durationSec: clip.durationSec || 60,
        category: clip.categoryName || parentDraftItem?.category || 'Genel',
        categoryColor: clip.categoryColor || parentDraftItem?.categoryColor || '#14b8a6',
        episodeNo: clip.episodeNo ?? parentDraftItem?.episode ?? null,
        partNo: clip.partNo || null,
        unitType: clip.unitType || 'bolum',
        unitLabel: clip.unitLabel || null,
        note: clip.note || (parentDraftItem ? `Klip: ${parentDraftItem.title}` : ''),
        isFromDraft: !!parentDraftItem,
        type: 'clip'
      },
      introInserted || forceAfterSelected ? 'after_selected' : -1
    );

    if (!skipAutoIntro && !forceAfterSelected) {
      const posLabel =
        insertPosition === 'top'
          ? 'Listenin En Üstü'
          : insertPosition === 'after_selected'
          ? 'Seçili Satırın Altı'
          : 'Listenin En Altı';
      dialog.success(
        'Klip Yayın Akışına Eklendi',
        `Seçilen klip yayın listesine eklendi.\nKlip Adı: ${clipDisplay}\nSüre: ${durTc}${introInserted ? '\nİntro: Program Öncesi Otomatik Eklendi' : ''}\nEklendiği Konum: ${posLabel}`
      );
    }
  };

  // Bir programın tüm kliplerini (1. parttan önce 1 kez İntro koyarak) klip adlarıyla yayına ekle
  const handleAddAllClips = (clipsList, parentDraftItem) => {
    let introInserted = false;
    if (parentDraftItem) {
      introInserted = prependIntroClipForDraftSlot(parentDraftItem);
    }
    clipsList.forEach((clip, idx) => {
      handleAddClip(clip, parentDraftItem, true, introInserted || idx > 0);
    });
    const posLabel =
      insertPosition === 'top'
        ? 'Listenin En Üstü'
        : insertPosition === 'after_selected'
        ? 'Seçili Satırın Altı'
        : 'Listenin En Altı';
    dialog.success(
      'Tüm Partlar Yayın Akışına Eklendi',
      `Programın tüm klipleri/partları sırasıyla yayın listesine eklendi.\nProgram: ${parentDraftItem?.title || 'Seçili Program'}\nEklenen Klip Sayısı: ${clipsList.length} Adet${introInserted ? ' (+1 İntro)' : ''}\nEklendiği Konum: ${posLabel}`
    );
  };

  const isWide = sidebarWidth >= EXPANDED_SIDEBAR_WIDTH - 40;

  return (
    <>
      {isCompact && (
        <div
          onClick={toggleDraftSidebar}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            zIndex: 1140
          }}
        />
      )}
      <div style={isCompact ? {
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: '420px',
        maxWidth: '92vw',
        height: '100dvh',
        background: 'var(--bg-secondary)',
        borderRight: '2px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        boxShadow: '12px 0 32px rgba(0,0,0,0.38)',
        zIndex: 1180
      } : {
        width: `${sidebarWidth}px`,
        minWidth: `${MIN_SIDEBAR_WIDTH}px`,
        maxWidth: `${MAX_SIDEBAR_WIDTH}px`,
        height: '100%',
        background: 'var(--bg-secondary)',
        borderRight: '2px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        boxShadow: '4px 0 20px rgba(0,0,0,0.12)',
        zIndex: 20,
        position: 'relative',
        transition: isResizing ? 'none' : 'width 0.18s ease'
      }}>
      {/* Üst Sekmeler + Genişlet/Daralt + Ekleneceği Yer Seçicisi */}
      <DraftSidebarTopHeader
        activeSidebarTab={activeSidebarTab}
        setActiveSidebarTab={setActiveSidebarTab}
        draftProgramsCount={draftPrograms.length}
        fillerSlotsCount={fillerSlotsInRundown.length}
        hasActiveFiller={Boolean(effectiveFillerItem)}
        isWide={isWide}
        onToggleWideMode={handleToggleWideMode}
        onCloseSidebar={toggleDraftSidebar}
        insertPosition={insertPosition}
        setInsertPosition={setInsertPosition}
      />

      {/* Sekme 1: Günün Taslağı */}
      {activeSidebarTab === 'draft' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <DraftSidebarFilterHeader
            currentChannelObj={currentChannelObj}
            selectedDate={selectedDate}
            draftProgramsCount={draftPrograms.length}
            filteredDraftCount={filteredDraftPrograms.length}
            draftSearchQuery={draftSearchQuery}
            setDraftSearchQuery={setDraftSearchQuery}
            draftStatusFilter={draftStatusFilter}
            setDraftStatusFilter={setDraftStatusFilter}
            draftCheckStats={draftCheckStats}
            matchedDraftSlotsForSelectedClip={matchedDraftSlotsForSelectedClip}
            onScrollToDraftSlot={handleScrollToDraftSlot}
            onManualRefreshDraft={handleManualRefreshDraft}
          />

          {/* Kuşaklar ve Alt Klipleri Listesi (Zaman Dilimi Kuşak Başlıklarıyla) */}
          <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            {draftPrograms.length === 0 ? (
              <DraftSidebarEmptyState
                selectedDate={selectedDate}
                availableDraftDates={availableDraftDates}
                onSelectDate={setSelectedDate}
              />
            ) : filteredDraftPrograms.length === 0 ? (
              <div style={{
                padding: '24px 16px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                "{draftSearchQuery}" aramasına uygun taslak kuşak bulunamadı.
              </div>
            ) : (
              filteredDraftPrograms.map((item, idx) => {
                const period = getDayPeriodInfo(item.startTime);
                const prevPeriod = idx > 0 ? getDayPeriodInfo(filteredDraftPrograms[idx - 1].startTime) : null;
                const showPeriodHeader = !prevPeriod || prevPeriod.id !== period.id;

                return (
                  <React.Fragment key={item.id || idx}>
                    {showPeriodHeader && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        marginTop: idx === 0 ? '0' : '6px',
                        borderRadius: '4px',
                        background: period.color,
                        color: period.textColor || '#FFFFFF'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 700 }}>
                          <Ikon ad={period.icon} size={15} />
                          <span>{period.label}</span>
                        </div>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          opacity: 0.92
                        }}>
                          {period.range}
                        </span>
                      </div>
                    )}

                    <DraftProgramSlotItem
                      draftItem={item}
                      usedPrograms={visibleUsedPrograms}
                      allDraftPrograms={draftPrograms}
                      manuallyMarkedDraftSlotIds={manuallyMarkedDraftSlotIds}
                      onToggleManualAdded={handleToggleManualAdded}
                      onAddProgram={handleAddSingleDraftItem}
                      onAddClip={handleAddClip}
                      onAddAllClips={handleAddAllClips}
                      onUpdateProgramInRundown={handleUpdateDraftSlotInRundown}
                      currentRundownPrograms={currentRundownPrograms}
                      selectedDate={selectedDate}
                      isSelectedFromRundown={matchedDraftSlotsForSelectedClip.some(
                        m => (m.id && m.id === item.id) || (m.startTime === item.startTime && m.title === item.title)
                      )}
                      selectedRundownItem={selectedRundownItem}
                      slotRef={el => {
                        const key = item.id || `${item.startTime}_${item.title}`;
                        if (el) {
                          slotElementsRef.current[key] = el;
                        }
                      }}
                    />
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Sekme 2: Klip Kütüphanesi & Arama */}
      {activeSidebarTab === 'clip_search' && (
        <BroadcastClipSearchPanel usedPrograms={visibleUsedPrograms} />
      )}

      {/* Sekme 3: Dolgu Kuşağı Doldurma Paneli (Pop-up yerine Sol Panelde açılır; kuşak değişince sıfırlanır) */}
      {activeSidebarTab === 'filler' && (
        <FillerSlotModal
          key={effectiveFillerItem?.fillerGroupId || effectiveFillerItem?.instanceId || 'empty_filler_slot'}
          isOpen={true}
          mode="sidebar"
          fillerItem={effectiveFillerItem}
          fillerSlotsList={fillerSlotsInRundown}
          onSelectFillerSlot={(f) => openFillerInSidebar(f)}
          onClose={closeFillerSidebar}
          onConfirmClips={handleConfirmFillerClipsInSidebar}
          onRemoveAddedClip={handleRemoveFillerClipInSidebar}
        />
      )}

      {/* SAĞ KENAR SÜRÜKLENEBİLİR GENİŞLETME TUTAMACI (RESIZER HANDLE) */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          startXRef.current = e.clientX;
          startWidthRef.current = sidebarWidth;
          setIsResizing(true);
        }}
        title="Sol paneli genişletmek veya daraltmak için sağa/sola sürükleyin"
        style={{
          position: 'absolute',
          top: 0,
          right: '-5px',
          width: '10px',
          height: '100%',
          cursor: 'col-resize',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isResizing ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
          transition: 'background 0.15s'
        }}
        onMouseEnter={(e) => {
          if (!isResizing) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
        }}
        onMouseLeave={(e) => {
          if (!isResizing) e.currentTarget.style.background = 'transparent';
        }}
      >
        <div style={{
          width: '4px',
          height: '44px',
          borderRadius: '999px',
          background: isResizing ? 'var(--accent-primary)' : 'var(--border-color)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
        }} />
      </div>
    </div>
    </>
  );
}
