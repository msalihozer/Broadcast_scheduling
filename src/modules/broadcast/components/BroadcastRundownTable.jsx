/**
 * @file src/modules/broadcast/components/BroadcastRundownTable.jsx
 * @description Yayın Planlama ana akış tablosu koordinatör bileşeni.
 *
 * Modüler Alt Bileşenler ve Kancalar:
 * - `useSmartDraftApplier.js`          -> Akıllı Taslak Uygulama (İntro + Canlı Yayın + Dolgu Kuşağı + Klip/Part eşleştirme)
 * - `RundownStickyMiniBar.jsx`         -> Aşağı kaydırıldığında beliren minimal 24 Saat Doluluk göstergesi
 * - `BroadcastRundownSummaryBar.jsx`   -> Üst özet, aksiyon butonları, Ekleneceği Yer seçicisi, pano ve uyarılar
 * - `RundownEmptyState.jsx`            -> Boş gün karşılama ekranı
 * - `RundownTableHeader.jsx`           -> Tablo sütun başlıkları (# | Yayın Saati | Süre | Klip Adı | Bölüm / Part | Tür | İşlemler)
 * - `BroadcastRundownRow.jsx`          -> Tekil yayın satırı (4 ana kuşak ayracıyla: Gece, Sabah, Gündüz, Akşam)
 * - `BroadcastBulkActionBar.jsx`       -> Seçili satırlar için alt hızlı işlem çubuğu (En Üst / Seçilenin Altı / En Alt destekli)
 * - Tüm silme, ekleme, çoğaltma, yapıştırma, kaydetme ve reklam iletim bildirimleri merkezi `dialog` pop-up sistemiyle gösterilir.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, parseISO, addDays } from 'date-fns';
import { dialog } from '../../../store/dialogStore';
import useBroadcastStore from '../store/broadcastStore';
import usePlanningStore from '../../../store/planningStore';
import { isRamadanFeatureWindowOpen } from '../../../components/Ads/reservation/reservationConstants';
import { getDraftProgramsForDay } from '../utils/draftDataLoader';
import { normalizeProgramText } from '../utils/draftSlotMatcher';
import { filterAndSortBySearchPriority } from '../../../utils/searchRanker';
import {
  BROADCAST_FPS,
  FRAMES_PER_DAY,
  secondsToTimecode,
  normalizeTimecode
} from '../utils/timecodeUtils';
import {
  parseTimecodeDisplay,
  getHourPeriodLabel,
  getProgramGroupKey
} from '../utils/rundownHelpers';
import useSmartDraftApplier from '../hooks/useSmartDraftApplier';
import BroadcastRundownSummaryBar from './rundown/BroadcastRundownSummaryBar';
import RundownStickyMiniBar from './rundown/RundownStickyMiniBar';
import RundownEmptyState from './rundown/RundownEmptyState';
import RundownTableHeader from './rundown/RundownTableHeader';
import BroadcastRundownRow, { isFillerRundownItem, isFillerClipRundownItem } from './rundown/BroadcastRundownRow';
import BroadcastBulkActionBar from './rundown/BroadcastBulkActionBar';
import FillerSlotModal from './FillerSlotModal';
import SendToAdReservationModal from './modals/SendToAdReservationModal';
import ClipDetailMetadataModal from '../../../pages/admin/archive/ClipDetailMetadataModal';

export default function BroadcastRundownTable({
  onOpenAddModal,
  onOpenAdModal,
  onEditProgram
}) {
  const {
    selectedChannel,
    selectedDate,
    setSelectedDate,
    activeList,
    draftVersion,
    selectedInstanceId,
    selectedInstanceIds: selectedIds,
    setSelectedInstanceId,
    setSelectedInstanceIds: setSelectedIds,
    insertPosition,
    setInsertPosition,
    adBreakDefaultSettings,
    updateAdBreakDefaultSettings,
    introDefaultSettings,
    getComputedDayPrograms,
    getPreviousDayOverflowFrames,
    getDayOverflowFrames,
    getDayVariantMeta,
    setDayPrograms,
    replaceFillerSlotWithClips,
    saveDaySchedule,
    sendDayToAdReservation,
    removeProgram,
    removePrograms,
    duplicatePrograms,
    copyProgramsToClipboard,
    pasteClipboardItems,
    clearClipboard,
    clipboardItems,
    clipboardMeta,
    moveProgram,
    reorderPrograms,
    addProgram,
    addFillerSlot,
    addAdBreak,
    updateProgram,
    openFillerInSidebar,
    undo,
    redo,
    historyPast,
    historyFuture,
    clearList
  } = useBroadcastStore();

  const ramadanConfig = usePlanningStore(state => state.ramadanConfig);
  const showRamadanControls = useMemo(
    () => isRamadanFeatureWindowOpen(ramadanConfig, selectedDate),
    [ramadanConfig, selectedDate]
  );

  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [lastClickedIndex, setLastClickedIndex] = useState(null);
  const [listFilterQuery, setListFilterQuery] = useState('');
  const [editingDurationId, setEditingDurationId] = useState(null);
  const [inlineDurationVal, setInlineDurationVal] = useState('');
  const [isScrolledDown, setIsScrolledDown] = useState(false);

  // Klip Detay Modalı, Reklam Rezervasyon Ön Kontrol Modalı ve Senkronizasyon Bildirim Şeridi Durumları
  const [inspectingClipItem, setInspectingClipItem] = useState(null);
  const [isSendToAdsModalOpen, setIsSendToAdsModalOpen] = useState(false);
  const [statusBanner, setStatusBanner] = useState(null);

  const programs = getComputedDayPrograms(selectedChannel, selectedDate, activeList);
  const prevOverflowFrames = getPreviousDayOverflowFrames(selectedChannel, selectedDate, activeList);
  const nextOverflowFrames = getDayOverflowFrames(selectedChannel, selectedDate, activeList);
  const variantMeta = getDayVariantMeta(selectedChannel, selectedDate, activeList);

  const draftSlotsForToday = useMemo(() => {
    return getDraftProgramsForDay(selectedChannel, selectedDate) || [];
  }, [selectedChannel, selectedDate, draftVersion]);

  // Akıllı Taslak Uygulama ve Eksik/Güncellenen Kuşakları Otomatik Tarama Kancası
  const {
    isApplyingDraft,
    isSyncingDraftAndArchive,
    handleApplySmartDraft,
    handleSyncAndFillMissingDrafts
  } = useSmartDraftApplier({
    draftSlotsForToday,
    programsCount: programs.length,
    selectedChannel,
    selectedDate,
    activeList,
    setDayPrograms,
    onSyncBanner: setStatusBanner
  });

  // Sol panelden veya dışarıdan tetiklenen "Yenile & Eksikleri Kontrol Et" olayını dinle
  useEffect(() => {
    const handleTriggerSync = () => {
      handleSyncAndFillMissingDrafts({ silentIfNoChanges: false, autoTriggered: false });
    };
    window.addEventListener('broadcast-trigger-sync-draft', handleTriggerSync);
    return () => window.removeEventListener('broadcast-trigger-sync-draft', handleTriggerSync);
  }, [handleSyncAndFillMissingDrafts]);

  // Minimal kayan doluluk çubuğu için hesaplamalar
  const programsFrames = useMemo(() => {
    return programs.reduce((acc, p) => acc + (p.durationFrames || 0), 0);
  }, [programs]);
  const totalDayUsageFrames = prevOverflowFrames + programsFrames;
  const fillPercentage = Math.min(100, (totalDayUsageFrames / FRAMES_PER_DAY) * 100);
  const remainingFrames = Math.max(0, FRAMES_PER_DAY - totalDayUsageFrames);

  const getPositionLabel = useCallback((pos) => {
    const mode = pos || insertPosition || 'after_selected';
    if (mode === 'top') return 'Listenin En Üstü';
    if (mode === 'bottom') return 'Listenin En Altı';
    return 'Seçili Satırın Altı';
  }, [insertPosition]);

  const handleScrollContainer = useCallback((e) => {
    const top = e.currentTarget.scrollTop;
    setIsScrolledDown(prev => {
      if (top > 110 && !prev) return true;
      if (top <= 80 && prev) return false;
      return prev;
    });
  }, []);

  // Kaydet Butonu İşlevi (Başarı Pop-up'ı ile)
  const handleSaveSchedule = useCallback(() => {
    const res = saveDaySchedule(selectedChannel, selectedDate, activeList);
    if (res.success) {
      const timeStr = new Date(res.savedAt).toLocaleTimeString('tr-TR');
      dialog.success(
        'Yayın Akışı Kaydedildi',
        `Yayın planlama listesi başarıyla kaydedildi.\nTarih: ${selectedDate}\nHedef Liste: Liste ${activeList}\nToplam Öğe: ${res.count} Öğe\nKayıt Saati: ${timeStr}`
      );
    }
  }, [saveDaySchedule, selectedChannel, selectedDate, activeList]);

  // Reklam Rezervasyona İlet Butonu İşlevi (Önce Ön Kontrol ve Zaman Doğrulama Pop-up Modalını Açar)
  const handleSendToAdReservation = useCallback(() => {
    if (programs.length === 0) {
      dialog.warning(
        'Yayın Listesi Boş',
        'Reklam Rezervasyon modülüne iletmek için önce yayın listesine içerik veya taslak eklemelisiniz.'
      );
      return;
    }
    setIsSendToAdsModalOpen(true);
  }, [programs.length]);

  // Kısayol (Ctrl+Shift+S / Ctrl+Enter) ile Reklam Rezervasyona İlet modalını açma dinleyicisi
  useEffect(() => {
    const handleShortcutOpenSendToAds = () => {
      handleSendToAdReservation();
    };
    window.addEventListener('broadcast-open-send-to-ads', handleShortcutOpenSendToAds);
    return () => window.removeEventListener('broadcast-open-send-to-ads', handleShortcutOpenSendToAds);
  }, [handleSendToAdReservation]);

  // Ön Kontrol Modalında Onaylandığında Listeyi Kaydet ve Reklam Rezervasyona İlet
  const handleConfirmSendToAdReservation = useCallback(() => {
    return sendDayToAdReservation(selectedChannel, selectedDate, activeList);
  }, [sendDayToAdReservation, selectedChannel, selectedDate, activeList]);

  // Ertesi Güne Geç
  const handleGoToNextDay = useCallback(() => {
    try {
      const nextDateStr = format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd');
      setSelectedDate(nextDateStr);
    } catch (e) {
      console.error(e);
    }
  }, [selectedDate, setSelectedDate]);

  // Tekil Eksik Taslak Kuşağını Yer Tutucu veya Canlı Yayın Olarak Ekle
  const handleQuickAddMissingDraftSlot = useCallback((draftItem) => {
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

    const shouldInsertIntro = !isFiller && introDefaultSettings?.autoInsertIntro !== false;
    if (shouldInsertIntro) {
      const introName = introDefaultSettings?.name || 'SEMERKAND_intro_v3_2014';
      const introSec = introDefaultSettings?.durationSec || 26;
      addProgram(selectedChannel, selectedDate, activeList, {
        title: introName,
        name: introName,
        clipName: introName,
        fileId: introDefaultSettings?.fileId || 725,
        draftId: draftItem.id,
        draftStartTime: draftItem.startTime || null,
        durationTc: introDefaultSettings?.durationTc || secondsToTimecode(introSec),
        durationSec: introSec,
        category: introDefaultSettings?.category || 'Jenerik / İntro',
        categoryColor: '#6366f1',
        unitType: 'intro',
        unitLabel: 'İntro',
        note: `İntro • ${rawTitle}`,
        isFromDraft: true,
        isIntroClip: true,
        type: 'clip'
      });
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
          ? 'Klip Seç ve Doldur butonuna tıklayarak klip seçin'
          : (liveDetail || draftItem.note || (isLive ? 'Canlı Yayın' : 'Taslaktan Eklendi')),
        isFromDraft: true,
        isKisaSlot: isFiller,
        isLive: isLive,
        type: isFiller ? 'filler_slot' : isLive ? 'live' : 'program'
      },
      shouldInsertIntro ? 'after_selected' : -1
    );

    dialog.success(
      'Taslak Kuşağı Eklendi',
      `Seçilen taslak kuşağı yayın akışına eklendi.\nProgram: ${rawTitle}\nKonum: ${getPositionLabel()}`
    );
  }, [addProgram, selectedChannel, selectedDate, activeList, getPositionLabel, introDefaultSettings]);

  // Tüm Eksik Taslak Kuşaklarını Yer Tutucu Olarak Ekle
  const handleQuickAddAllMissingDraftSlots = useCallback((missingSlots = []) => {
    if (!Array.isArray(missingSlots) || missingSlots.length === 0) return;
    const autoIntroEnabled = introDefaultSettings?.autoInsertIntro !== false;
    missingSlots.forEach(slot => {
      const rawTitle = slot.title || slot.name || 'İsimsiz Program';
      const normTitle = normalizeProgramText(rawTitle);
      const isFiller = Boolean(slot.isKisaSlot || normTitle.includes('dolgu kusagi') || normTitle === 'dolgu');
      const isLive = Boolean(
        slot.isLive ||
        (Array.isArray(slot.selectedOptions) && slot.selectedOptions.some(o => /canl[ıi]/i.test(String(o)))) ||
        /\bcanl[ıi]\b/i.test(`${slot.rawTitle || ''} ${rawTitle} ${slot.host || ''}`)
      );
      const durSec = slot.durationSec || ((slot.duration || (isFiller ? 15 : 30)) * 60);
      const durTc = slot.durationFormatted || secondsToTimecode(durSec);
      const shouldInsertIntro = !isFiller && autoIntroEnabled;

      if (shouldInsertIntro) {
        const introName = introDefaultSettings?.name || 'SEMERKAND_intro_v3_2014';
        const introSec = introDefaultSettings?.durationSec || 26;
        addProgram(selectedChannel, selectedDate, activeList, {
          title: introName,
          name: introName,
          clipName: introName,
          fileId: introDefaultSettings?.fileId || 725,
          draftId: slot.id,
          draftStartTime: slot.startTime || null,
          durationTc: introDefaultSettings?.durationTc || secondsToTimecode(introSec),
          durationSec: introSec,
          category: introDefaultSettings?.category || 'Jenerik / İntro',
          categoryColor: '#6366f1',
          unitType: 'intro',
          unitLabel: 'İntro',
          note: `İntro • ${rawTitle}`,
          isFromDraft: true,
          isIntroClip: true,
          type: 'clip'
        });
      }

      const liveDetail = [slot.host, slot.topic].filter(Boolean).join(' • ') || slot.note || '';
      addProgram(
        selectedChannel,
        selectedDate,
        activeList,
        {
          title: rawTitle,
          name: slot.name || rawTitle,
          clipName: isLive
            ? `${rawTitle}${slot.episode ? ` - Bölüm ${slot.episode}` : ''}${liveDetail ? ` (${liveDetail})` : ''}`
            : null,
          draftId: slot.id,
          draftStartTime: slot.startTime || null,
          durationTc: durTc,
          durationSec: durSec,
          category: isFiller ? 'Dolgu Kuşağı' : isLive ? (slot.category || 'Canlı Yayın') : (slot.category || 'Genel'),
          categoryColor: isFiller ? '#8b5cf6' : isLive ? '#ef4444' : (slot.categoryColor || '#3b82f6'),
          episodeNo: slot.episode || null,
          partNo: slot.part || null,
          host: slot.host || '',
          topic: slot.topic || '',
          note: isFiller
            ? 'Klip Seç ve Doldur butonuna tıklayarak klip seçin'
            : (liveDetail || slot.note || (isLive ? 'Canlı Yayın' : 'Taslaktan Eklendi')),
          isFromDraft: true,
          isKisaSlot: isFiller,
          isLive: isLive,
          type: isFiller ? 'filler_slot' : isLive ? 'live' : 'program'
        },
        shouldInsertIntro ? 'after_selected' : -1
      );
    });

    dialog.success(
      'Eksik Kuşaklar Eklendi',
      `Taslakta bulunan ${missingSlots.length} adet eksik kuşak yayın akışına yerleştirildi.`
    );
  }, [addProgram, selectedChannel, selectedDate, activeList, introDefaultSettings]);

  // Tek Tıkla Varsayılan Reklam Kuşağı Ekle
  const handleQuickAddAdBreak = useCallback(() => {
    addAdBreak(selectedChannel, selectedDate, activeList, adBreakDefaultSettings);
    dialog.success(
      'Reklam Kuşağı Eklendi',
      `Yeni Reklam Kuşağı yayın listesine eklendi.\nSüre: ${adBreakDefaultSettings?.durationMinutes ?? 5} dk ${adBreakDefaultSettings?.durationSeconds ?? 0} sn\nEklendiği Konum: ${getPositionLabel()}`
    );
  }, [addAdBreak, selectedChannel, selectedDate, activeList, adBreakDefaultSettings, getPositionLabel]);

  // Tek Tıkla Dolgu Kuşağı Ekle (Seçili konuma göre En Üst / Seçilenin Altına / En Alt ve Sol Panelde Aç)
  const handleQuickAddFillerSlot = useCallback(() => {
    const newFiller = addFillerSlot(selectedChannel, selectedDate, activeList, 15, selectedInstanceId);
    if (newFiller) {
      openFillerInSidebar(newFiller);
      dialog.success(
        'Dolgu Kuşağı Eklendi',
        `15 dakikalık Dolgu Kuşağı yayın akışına eklendi ve sol panelde Dolgu Kuşağı Doldurma ekranı açıldı.\nEklendiği Konum: ${getPositionLabel()}`
      );
    }
  }, [addFillerSlot, selectedChannel, selectedDate, activeList, selectedInstanceId, getPositionLabel, openFillerInSidebar]);

  const handleStepDurationMinutes = useCallback((e, item, deltaMin) => {
    e.stopPropagation();
    const currentSec = item.durationSec || Math.floor((item.durationFrames || 0) / 25) || 300;
    const nextSec = Math.max(30, currentSec + (deltaMin * 60));
    const nextTc = secondsToTimecode(nextSec);
    updateProgram(selectedChannel, selectedDate, activeList, item.instanceId, {
      durationTc: nextTc
    });
  }, [updateProgram, selectedChannel, selectedDate, activeList]);

  const handleStartInlineDurationEdit = useCallback((e, item) => {
    e.stopPropagation();
    setEditingDurationId(item.instanceId);
    const totalMin = Math.max(1, Math.round((item.durationSec || 300) / 60));
    if (item.type === 'ad_break') {
      setInlineDurationVal(String(totalMin));
    } else {
      setInlineDurationVal(item.durationTc || secondsToTimecode(item.durationSec || 1800));
    }
  }, []);

  const handleSaveInlineDuration = useCallback((item) => {
    const raw = String(inlineDurationVal || '').trim();
    if (!raw) {
      setEditingDurationId(null);
      return;
    }

    let nextTc = item.durationTc;
    if (/^\d+(\.\d+)?$/.test(raw) && !raw.includes(':')) {
      const mins = Math.max(1, parseFloat(raw));
      nextTc = secondsToTimecode(Math.round(mins * 60));
    } else {
      nextTc = normalizeTimecode(raw);
    }

    updateProgram(selectedChannel, selectedDate, activeList, item.instanceId, {
      durationTc: nextTc
    });
    setEditingDurationId(null);
  }, [inlineDurationVal, updateProgram, selectedChannel, selectedDate, activeList]);

  const displayedPrograms = useMemo(() => {
    if (!listFilterQuery.trim()) return programs;
    return filterAndSortBySearchPriority(
      programs,
      listFilterQuery,
      (item) => item.clipName || item.title || item.name || '',
      (item) => {
        const startDisp = parseTimecodeDisplay(item.calculatedStartTime);
        return [item.category, item.note, startDisp.hhmm, startDisp.hhmmss, item.episodeNo ? `Bölüm ${item.episodeNo}` : ''];
      }
    );
  }, [programs, listFilterQuery]);

  const handleDragStart = useCallback((e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(prev => (prev !== index ? index : prev));
  }, []);

  const handleDrop = useCallback((e, targetIndex) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);

    const jsonStr = e.dataTransfer.getData('application/json');
    if (jsonStr) {
      try {
        const payload = JSON.parse(jsonStr);
        if (payload && payload.item) {
          addProgram(selectedChannel, selectedDate, activeList, payload.item, targetIndex);
          setDraggedIndex(null);
          return;
        }
      } catch (err) {
        console.error('Drop parse error:', err);
      }
    }

    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      reorderPrograms(selectedChannel, selectedDate, activeList, draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
  }, [addProgram, reorderPrograms, selectedChannel, selectedDate, activeList, draggedIndex]);

  // Listeyi Temizle (Silme Pop-up Onayı ile)
  const handleClearList = useCallback(async () => {
    if (programs.length === 0) return;
    const ok = await dialog.confirm(
      'Yayın Listesini Temizle',
      `Bu günün akış listesini tamamen temizlemek istediğinize emin misiniz?\nTarih: ${selectedDate}\nHedef Liste: Liste ${activeList}\nSilinecek Öğe Sayısı: ${programs.length} Öğe\n* Bilgi: İşlemi yanlışlıkla yaparsanız Ctrl+Z (Geri Al) ile geri döndürebilirsiniz.`,
      {
        isDestructive: true,
        confirmText: 'Evet, Listeyi Temizle',
        cancelText: 'Vazgeç'
      }
    );
    if (ok) {
      clearList(selectedChannel, selectedDate, activeList);
      setSelectedIds([]);
      dialog.info('Liste Temizlendi', `${selectedDate} (Liste ${activeList}) yayın akışı temizlendi.`);
    }
  }, [programs.length, clearList, selectedChannel, selectedDate, activeList]);

  // Satır Tıklama: Dolgu Kuşağı veya Dolgu Klibi satırına tıklandığında sol panelde doğrudan o Dolgu Kuşağının doldurma panelini açar
  const handleRowClick = useCallback((e, item, index) => {
    if (e.target.closest('button') || e.target.closest('input')) return;

    if (e.shiftKey && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const rangeIds = programs.slice(start, end + 1).map(p => p.instanceId);
      setSelectedIds(prev => Array.from(new Set([...prev, ...rangeIds])));
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedIds(prev =>
        prev.includes(item.instanceId)
          ? prev.filter(id => id !== item.instanceId)
          : [...prev, item.instanceId]
      );
      setLastClickedIndex(index);
    } else {
      setSelectedIds([item.instanceId]);
      setLastClickedIndex(index);
      if (isFillerRundownItem(item) || isFillerClipRundownItem(item)) {
        openFillerInSidebar(item);
      }
    }
    setSelectedInstanceId(item.instanceId);
  }, [lastClickedIndex, programs, setSelectedInstanceId, openFillerInSidebar]);

  const handleToggleRowCheckbox = useCallback((e, instanceId, index) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(instanceId)
        ? prev.filter(id => id !== instanceId)
        : [...prev, instanceId]
    );
    setLastClickedIndex(index);
    setSelectedInstanceId(instanceId);
  }, [setSelectedInstanceId]);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(prev => (prev.length === programs.length ? [] : programs.map(p => p.instanceId)));
  }, [programs]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // Toplu Silme (Silme Pop-up Onayı ile)
  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return;
    const ok = await dialog.confirm(
      'Seçili Öğeleri Sil',
      `Seçili ${selectedIds.length} öğeyi yayın akışından silmek istediğinize emin misiniz?\nTarih: ${selectedDate} (Liste ${activeList})\nSilinecek Öğe: ${selectedIds.length} Adet`,
      {
        isDestructive: true,
        confirmText: `Evet, ${selectedIds.length} Öğeyi Sil`,
        cancelText: 'Vazgeç'
      }
    );
    if (ok) {
      const deletedCount = selectedIds.length;
      removePrograms(selectedChannel, selectedDate, activeList, selectedIds);
      setSelectedIds([]);
      dialog.info('Öğeler Silindi', `Seçili ${deletedCount} öğe yayın akışından kaldırıldı.`);
    }
  }, [selectedIds, removePrograms, selectedChannel, selectedDate, activeList]);

  // Tekil Satır Silme (Silme Pop-up Onayı ile)
  const handleRemoveSingle = useCallback(async (instanceId) => {
    const targetItem = programs.find(p => p.instanceId === instanceId);
    const itemName = targetItem?.clipName || targetItem?.title || targetItem?.name || 'Seçili Öğe';
    const ok = await dialog.confirm(
      'Öğeyi Listeden Sil',
      `"${itemName}" öğesini yayın akışından silmek istediğinize emin misiniz?\nSıra No: #${targetItem?.order || '-'}\nTür: ${targetItem?.category || 'Yayın Öğesi'}`,
      {
        isDestructive: true,
        confirmText: 'Evet, Sil',
        cancelText: 'Vazgeç'
      }
    );
    if (ok) {
      removeProgram(selectedChannel, selectedDate, activeList, instanceId);
      setSelectedIds(prev => prev.filter(id => id !== instanceId));
    }
  }, [programs, removeProgram, selectedChannel, selectedDate, activeList]);

  // Seçili Satırları Kopyala (Bilgi Pop-up'ı ile)
  const handleBulkCopy = useCallback(() => {
    if (selectedIds.length === 0) return;
    const res = copyProgramsToClipboard(selectedChannel, selectedDate, activeList, selectedIds);
    if (res?.success) {
      dialog.info(
        'Panoya Kopyalandı',
        `Seçili öğeler panoya kopyalandı.\nKopyalanan Öğe: ${res.count} Adet\nKaynak: ${selectedDate} (Liste ${activeList})\n* Bilgi: İstediğiniz güne geçip En Üste, Seçilenin Altına, En Alta yapıştırabilir veya Tüm Güne uygulayabilirsiniz.`
      );
    }
  }, [selectedIds, copyProgramsToClipboard, selectedChannel, selectedDate, activeList]);

  // Tüm Listeyi Kopyala (Bilgi Pop-up'ı ile)
  const handleCopyFullList = useCallback(() => {
    const res = copyProgramsToClipboard(selectedChannel, selectedDate, activeList, []);
    if (res?.success) {
      dialog.info(
        'Tüm Liste Panoya Kopyalandı',
        `Günün tüm yayın listesi panoya kopyalandı.\nKopyalanan Öğe: ${res.count} Adet\nKaynak Gün: ${selectedDate} (Liste ${activeList})\n* Bilgi: Başka bir güne geçip "Bu Güne Uygula" veya "Yapıştır" butonlarını kullanabilirsiniz.`
      );
    }
  }, [copyProgramsToClipboard, selectedChannel, selectedDate, activeList]);

  // Seçili Öğeleri Çoğalt (Başarı Pop-up'ı ile)
  const handleBulkDuplicate = useCallback((positionOverride = null) => {
    if (selectedIds.length === 0) return;
    const targetPos =
      typeof positionOverride === 'string'
        ? positionOverride
        : (insertPosition || 'bottom');
    const res = duplicatePrograms(selectedChannel, selectedDate, activeList, selectedIds, targetPos);
    if (res?.success) {
      const posText =
        res.position === 'top'
          ? 'Listenin En Üstü'
          : res.position === 'after_selected'
          ? 'Seçili Öğenin Altı'
          : 'Listenin En Altı';
      dialog.success(
        'Öğeler Çoğaltıldı',
        `Seçili öğeler çoğaltılarak yayın listesine eklendi.\nÇoğaltılan Öğe: ${res.count} Adet\nEklendiği Konum: ${posText}`
      );
    }
  }, [selectedIds, insertPosition, duplicatePrograms, selectedChannel, selectedDate, activeList]);

  // Panodan Yapıştır / Bu Güne Uygula (Pop-up Onayı ve Başarı Bildirimi ile)
  const handlePasteClipboard = useCallback(async (mode = null) => {
    const count = Array.isArray(clipboardItems) ? clipboardItems.length : 0;
    if (count === 0) return;

    const effectiveMode = typeof mode === 'string' ? mode : (insertPosition || 'bottom');

    if (effectiveMode === 'replace' && programs.length > 0) {
      const ok = await dialog.confirm(
        'Listeyi Bu Güne Uygula',
        `Bu gündeki mevcut ${programs.length} öğenin yerine panodaki kopyalanmış listeyi uygulamak istediğinize emin misiniz?\nHedef Gün: ${selectedDate} (Liste ${activeList})\nUygulanacak Öğe: ${count} Adet\n* Bilgi: Mevcut listeyi silmeden eklemek isterseniz "En Üste", "Seçilenin Altına" veya "En Alta Yapıştır" butonlarını kullanabilirsiniz.`,
        {
          confirmText: 'Evet, Tüm Listeyi Değiştir',
          cancelText: 'Vazgeç'
        }
      );
      if (!ok) return;
    }

    const res = pasteClipboardItems(selectedChannel, selectedDate, activeList, effectiveMode, selectedInstanceId);
    if (res?.success) {
      const posText =
        res.mode === 'top'
          ? 'Listenin En Üstü'
          : res.mode === 'after_selected'
          ? 'Seçili Öğenin Altı'
          : 'Listenin En Altı';

      if (effectiveMode === 'replace') {
        dialog.success(
          'Liste Bu Güne Uygulandı',
          `Panodaki yayın listesi başarıyla uygulandı.\nHedef Gün: ${selectedDate} (Liste ${activeList})\nToplam Öğe: ${res.count} Adet`
        );
      } else {
        dialog.success(
          'Panodan Yapıştırıldı',
          `Panodaki öğeler yayın akışına yapıştırıldı.\nEklenen Öğe: ${res.count} Adet\nEklendiği Konum: ${posText}`
        );
      }
    }
  }, [clipboardItems, programs.length, insertPosition, selectedInstanceId, pasteClipboardItems, selectedChannel, selectedDate, activeList]);

  const handleMoveUp = useCallback((instanceId) => {
    moveProgram(selectedChannel, selectedDate, activeList, instanceId, 'up');
  }, [moveProgram, selectedChannel, selectedDate, activeList]);

  const handleMoveDown = useCallback((instanceId) => {
    moveProgram(selectedChannel, selectedDate, activeList, instanceId, 'down');
  }, [moveProgram, selectedChannel, selectedDate, activeList]);

  const handlePinProgram = useCallback((instanceId, pinnedTimeStr, pinnedStartFrames) => {
    if (!instanceId) return;
    updateProgram(selectedChannel, selectedDate, activeList, instanceId, {
      isPinnedTime: true,
      pinnedStartTime: pinnedTimeStr,
      pinnedStartFrames
    });
  }, [updateProgram, selectedChannel, selectedDate, activeList]);

  const handleUnpinProgram = useCallback((instanceId) => {
    if (!instanceId) return;
    updateProgram(selectedChannel, selectedDate, activeList, instanceId, {
      isPinnedTime: false,
      pinnedStartTime: null,
      pinnedStartFrames: null
    });
  }, [updateProgram, selectedChannel, selectedDate, activeList]);

  const handleInspectClip = useCallback((item) => {
    if (!item) return;
    const durationSec = item.durationSec || Math.floor((item.durationFrames || 0) / BROADCAST_FPS) || 0;
    setInspectingClipItem({
      fileId: item.fileId,
      name: item.clipName || item.title || item.name,
      title: item.clipName || item.title || item.name,
      fileName: item.clipName || item.fileName || item.title || item.name,
      durationFormatted: item.durationTc || secondsToTimecode(durationSec),
      durationSec,
      duration: durationSec,
      episodeNo: item.episodeNo,
      partNo: item.partNo,
      unitType: item.unitType,
      unitLabel: item.unitLabel,
      categoryName: item.category,
      note: item.note,
      calculatedStartTime: item.calculatedStartTime,
      calculatedEndTime: item.calculatedEndTime,
      order: item.order,
      programTitle: item.note ? String(item.note).replace(/^Program:\s*/i, '') : item.title
    });
  }, []);

  const selectedProgram = useMemo(() => {
    const activeId =
      (selectedIds && selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null) ||
      selectedInstanceId;
    if (!activeId) return null;
    return programs.find(p => p.instanceId === activeId) || null;
  }, [programs, selectedIds, selectedInstanceId]);

  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      minHeight: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
      background: 'var(--bg-primary)'
    }}>
      {/* AŞAĞI KAYDIRILDIĞINDA DEVREYE GİREN MİNİMAL DOLULUK ÇUBUĞU */}
      <RundownStickyMiniBar
        isScrolledDown={isScrolledDown}
        fillPercentage={fillPercentage}
        totalDayUsageFrames={totalDayUsageFrames}
        remainingFrames={remainingFrames}
        nextOverflowFrames={nextOverflowFrames}
        programsCount={programs.length}
        onOpenAddModal={onOpenAddModal}
        onQuickAddFillerSlot={handleQuickAddFillerSlot}
        onQuickAddAdBreak={handleQuickAddAdBreak}
        onSaveSchedule={handleSaveSchedule}
      />

      {/* ANA KAYDIRILABİLİR (SCROLLABLE) ALAN */}
      <div
        onScroll={handleScrollContainer}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          width: '100%',
          overflowY: 'auto',
          overflowX: 'auto',
          boxSizing: 'border-box'
        }}
        onDragOver={(e) => handleDragOver(e, programs.length)}
        onDrop={(e) => handleDrop(e, programs.length)}
      >
        {/* ÜST ÖZET VE AKSİYON ÇUBUĞU */}
        <BroadcastRundownSummaryBar
          programs={programs}
          draftSlotsForToday={draftSlotsForToday}
          unaddedDraftSlots={variantMeta.unaddedDraftSlots}
          prevOverflowFrames={prevOverflowFrames}
          nextOverflowFrames={nextOverflowFrames}
          activeList={activeList}
          selectedDate={selectedDate}
          adBreakDefaultSettings={adBreakDefaultSettings}
          isApplyingDraft={isApplyingDraft}
          isSyncingDraftAndArchive={isSyncingDraftAndArchive}
          lastDraftAppliedAt={variantMeta.lastDraftAppliedAt}
          lastSavedAt={variantMeta.savedAt}
          lastSentToAdsAt={variantMeta.sentToAdsAt}
          statusBanner={statusBanner}
          onClearStatusBanner={() => setStatusBanner(null)}
          listFilterQuery={listFilterQuery}
          setListFilterQuery={setListFilterQuery}
          historyPastCount={historyPast.length}
          historyFutureCount={historyFuture.length}
          undo={undo}
          redo={redo}
          onApplySmartDraft={handleApplySmartDraft}
          onSyncAndFillMissingDrafts={() => handleSyncAndFillMissingDrafts({ silentIfNoChanges: false, autoTriggered: false })}
          onSaveSchedule={handleSaveSchedule}
          onSendToAdReservation={handleSendToAdReservation}
          onGoToNextDay={handleGoToNextDay}
          onUpdateAdBreakDefaultSettings={updateAdBreakDefaultSettings}
          onQuickAddAdBreak={handleQuickAddAdBreak}
          onQuickAddFillerSlot={handleQuickAddFillerSlot}
          onOpenAddModal={onOpenAddModal}
          onClearList={handleClearList}
          clipboardCount={Array.isArray(clipboardItems) ? clipboardItems.length : 0}
          clipboardMeta={clipboardMeta}
          onCopyFullList={handleCopyFullList}
          onPasteClipboard={handlePasteClipboard}
          onClearClipboard={clearClipboard}
          insertPosition={insertPosition}
          setInsertPosition={setInsertPosition}
          selectedInstanceId={selectedInstanceId}
          selectedProgram={selectedProgram}
          onInspectClip={handleInspectClip}
          onQuickAddMissingDraftSlot={handleQuickAddMissingDraftSlot}
          onQuickAddAllMissingDraftSlots={handleQuickAddAllMissingDraftSlots}
        />

        <div style={{ padding: '12px 14px 28px 14px', boxSizing: 'border-box' }}>
          {programs.length === 0 ? (
            <RundownEmptyState
              selectedDate={selectedDate}
              draftSlotsCount={draftSlotsForToday.length}
              isApplyingDraft={isApplyingDraft}
              clipboardItems={clipboardItems}
              clipboardMeta={clipboardMeta}
              onApplySmartDraft={handleApplySmartDraft}
              onOpenAddModal={onOpenAddModal}
              onQuickAddFillerSlot={handleQuickAddFillerSlot}
              onPasteClipboard={handlePasteClipboard}
            />
          ) : (
            <div style={{
              border: '1.5px solid var(--border-color)',
              borderRadius: '14px',
              background: 'var(--bg-secondary)',
              boxShadow: '0 4px 18px rgba(0,0,0,0.08)',
              width: '100%',
              minWidth: 0,
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              boxSizing: 'border-box'
            }}>
              <div style={{ minWidth: '880px' }}>
                <RundownTableHeader
                  programsCount={programs.length}
                  selectedCount={selectedIds.length}
                  onSelectAll={handleSelectAll}
                />

                {/* Program / Klip / Dolgu Kuşağı / Reklam Satırları */}
                <div>
                  {displayedPrograms.map((item, idx) => {
                  const index = programs.findIndex(p => p.instanceId === item.instanceId);
                  const startInfo = parseTimecodeDisplay(item.calculatedStartTime);
                  const prevItem = idx > 0 ? displayedPrograms[idx - 1] : null;
                  const prevStartInfo = prevItem ? parseTimecodeDisplay(prevItem.calculatedStartTime) : null;

                  // Her saat başı değil, sadece 4 ana kuşak (Gece / Sabah / Gündüz / Akşam) geçişinde ayraç göster
                  const currPeriod = getHourPeriodLabel(startInfo.hourNum);
                  const prevPeriod = prevStartInfo ? getHourPeriodLabel(prevStartInfo.hourNum) : null;
                  const isNewPeriodBlock = !prevPeriod || prevPeriod.id !== currPeriod.id;

                  const currGroupKey = getProgramGroupKey(item);
                  const prevGroupKey = prevItem ? getProgramGroupKey(prevItem) : null;
                  const isNewProgramBoundary = idx > 0 && currGroupKey !== prevGroupKey;

                  return (
                    <BroadcastRundownRow
                      key={item.instanceId}
                      item={item}
                      idx={idx}
                      index={index}
                      totalProgramsCount={programs.length}
                      isSelected={selectedInstanceId === item.instanceId}
                      isMultiSelected={selectedIds.includes(item.instanceId)}
                      isDragOver={dragOverIndex === index}
                      isNewPeriodBlock={isNewPeriodBlock}
                      isNewProgramBoundary={isNewProgramBoundary}
                      isEditingDuration={editingDurationId === item.instanceId}
                      inlineDurationVal={editingDurationId === item.instanceId ? inlineDurationVal : ''}
                      setInlineDurationVal={setInlineDurationVal}
                      setEditingDurationId={setEditingDurationId}
                      handleDragStart={handleDragStart}
                      handleDragOver={handleDragOver}
                      handleDrop={handleDrop}
                      handleRowClick={handleRowClick}
                      handleToggleRowCheckbox={handleToggleRowCheckbox}
                      handleStepDurationMinutes={handleStepDurationMinutes}
                      handleStartInlineDurationEdit={handleStartInlineDurationEdit}
                      handleSaveInlineDuration={handleSaveInlineDuration}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      onEditProgram={onEditProgram}
                      onRemoveProgram={handleRemoveSingle}
                      onOpenFillerModal={(fillerRow) => openFillerInSidebar(fillerRow)}
                      onInspectClip={handleInspectClip}
                      onUnpinProgram={handleUnpinProgram}
                      showRamadanControls={showRamadanControls}
                      onUpdateRamadanMeta={(instanceId, metaUpdates) => {
                        updateProgram(selectedChannel, selectedDate, activeList, instanceId, metaUpdates);
                      }}
                    />
                  );
                })}
                </div>
              </div>
            </div>
          )}

          {/* SEÇİLİ SATIR BİLGİ & OYNATMA (ⓘ) VEYA ÇOKLU SEÇİM KOPYALA/YAPIŞTIR PİLİ */}
          <BroadcastBulkActionBar
            selectedProgram={selectedProgram}
            selectedCount={selectedIds.length}
            onBulkCopy={handleBulkCopy}
            onInspectClip={handleInspectClip}
            onPinProgram={handlePinProgram}
            onUnpinProgram={handleUnpinProgram}
            onClearSelection={() => {
              handleClearSelection();
              setSelectedInstanceId(null);
            }}
          />
        </div>
      </div>

      {/* REKLAM REZERVASYONA İLET ÖN KONTROL VE LİSTE ONAY POP-UP MODALI */}
      <SendToAdReservationModal
        isOpen={isSendToAdsModalOpen}
        onClose={() => setIsSendToAdsModalOpen(false)}
        selectedChannel={selectedChannel}
        selectedDate={selectedDate}
        activeList={activeList}
        programs={programs}
        draftSlotsForToday={draftSlotsForToday}
        prevOverflowFrames={prevOverflowFrames}
        nextOverflowFrames={nextOverflowFrames}
        adBreakDefaultSettings={adBreakDefaultSettings}
        lastSavedAt={variantMeta.savedAt}
        lastSentToAdsAt={variantMeta.sentToAdsAt}
        onSaveSchedule={handleSaveSchedule}
        onQuickAddAdBreak={handleQuickAddAdBreak}
        onConfirmSendToAds={handleConfirmSendToAdReservation}
      />

      {/* KLİP DETAY & METADATA MODALI */}
      {inspectingClipItem && (
        <ClipDetailMetadataModal
          isOpen={Boolean(inspectingClipItem)}
          clip={inspectingClipItem}
          program={{ title: inspectingClipItem.programTitle || 'Yayın Akışı' }}
          onClose={() => setInspectingClipItem(null)}
        />
      )}
    </div>
  );
}
