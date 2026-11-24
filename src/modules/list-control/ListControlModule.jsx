/**
 * @file src/modules/list-control/ListControlModule.jsx
 * @description Yayın Liste Kontrol Modülü Ana Çalışma Alanı.
 *
 * Özellikler:
 * 1. Açılış ekranı her zaman **Günlük (Daily)** ve **Bugün (Today)** olarak başlar;
 *    Günlük, Haftalık, Aylık ve Raporlar & Denetim Logları görünümleri arasında geçiş yapılabilir.
 * 2. Sağ çalışma alanı tek bir akıcı kaydırılabilir (scrollable) kapsayıcı içindedir; sayfa her noktadan rahatça aşağı-yukarı kayar.
 * 3. Liste hizalı **Flexbox Tablo** yapısındadır ve hem satırlar arası **Sürükle-Bırak (Drag & Drop)** sıralamayı,
 *    hem de sol kütüphaneden sürüklenen klip/reklamları tabloya bırakarak ekleme/değiştirmeyi destekler.
 * 4. Kliplerin ve reklamların dosya yolu kontrolü, video oynatıcı (`/api/stream`) ile birebir aynı mekanizmayla çalışır.
 * 5. Dosya formatı kontrolü varsayılan `.mxf` olarak çalışır ve Format Ayarlarından yeni formatlar eklenebilir.
 * 6. Tekrar eden kliplerin hataları alt alta yazılmaz; aynı klip tek satırda gruplanıp yanına geçtiği satır numaraları ve saatler yazılır.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { format, parseISO, addDays, addMonths } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Check,
  RefreshCw,
  Search,
  Megaphone,
  Send,
  ArrowUp,
  X
} from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import useDialogStore from '../../store/dialogStore';
import useBroadcastStore from '../broadcast/store/broadcastStore';
import {
  getDraftProgramsForDay,
  fetchAndSyncDraftSchedule
} from '../broadcast/utils/draftDataLoader';
import CustomDatePicker from '../../components/CustomDatePicker';
import ClipDetailMetadataModal from '../../pages/admin/archive/ClipDetailMetadataModal';

import {
  analyzeThreeStageVerification,
  verifyBatchClipsAndAdsHealth,
  buildUnifiedIssuesList,
  formatSecondsReadable
} from './utils/listControlVerificationEngine';
import ListControlSidebar from './components/ListControlSidebar';
import ListControlWarningsPanel from './components/ListControlWarningsPanel';
import ListControlRundownRow from './components/ListControlRundownRow';
import ListControlRevisionModal from './components/ListControlRevisionModal';
import ListControlWeekView from './components/ListControlWeekView';
import ListControlMonthView from './components/ListControlMonthView';
import ListControlReportsLogsView from './components/ListControlReportsLogsView';
import useResponsive from '../../hooks/useResponsive';
import Ikon from '../../components/Ikon';

export default function ListControlModule() {
  const { isMobile, isCompact } = useResponsive();
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const selectedChannel = usePlanningStore(state => state.selectedChannel) || 'ch_hd';
  const setSelectedChannel = usePlanningStore(state => state.setSelectedChannel);
  const channels = usePlanningStore(state => state.channels) || [];
  const selectedDate = usePlanningStore(state => state.selectedDate) || todayStr;
  const setSelectedDate = usePlanningStore(state => state.setSelectedDate);
  const adSettings = usePlanningStore(state => state.adSettings) || {};
  const days = usePlanningStore(state => state.days) || {};
  const adPlacements = usePlanningStore(state => state.adPlacements) || {};
  const listControlDays = usePlanningStore(state => state.listControlDays) || {};
  const listControlLogs = usePlanningStore(state => state.listControlLogs) || [];
  const listControlSettings = usePlanningStore(state => state.listControlSettings) || {
    primaryFormat: 'mxf',
    allowedFormats: ['mxf']
  };
  const lcUpdateFormatSettings = usePlanningStore(state => state.lcUpdateFormatSettings);

  const lcSyncFromAdsOrReady = usePlanningStore(state => state.lcSyncFromAdsOrReady);
  const lcReplaceItem = usePlanningStore(state => state.lcReplaceItem);
  const lcAddProgramToDay = usePlanningStore(state => state.lcAddProgramToDay);
  const lcUpdateItemDurationSec = usePlanningStore(state => state.lcUpdateItemDurationSec);
  const lcMoveProgramUp = usePlanningStore(state => state.lcMoveProgramUp);
  const lcMoveProgramDown = usePlanningStore(state => state.lcMoveProgramDown);
  const lcReorderProgram = usePlanningStore(state => state.lcReorderProgram);
  const lcRemovePrograms = usePlanningStore(state => state.lcRemovePrograms);
  const lcRequestRevision = usePlanningStore(state => state.lcRequestRevision);
  const lcUpdateItemLogoEvent = usePlanningStore(state => state.lcUpdateItemLogoEvent);
  const lcApproveDayList = usePlanningStore(state => state.lcApproveDayList);
  const lcAddAuditLog = usePlanningStore(state => state.lcAddAuditLog);

  // Açılış ekranı her zaman Günlük ('daily') ve Bugün (todayStr) olarak başlar
  const [lcViewMode, setLcViewMode] = useState('daily'); // 'daily' | 'weekly' | 'monthly' | 'reports'
  const didInitTodayRef = useRef(false);

  useEffect(() => {
    if (!didInitTodayRef.current) {
      didInitTodayRef.current = true;
      setLcViewMode('daily');
      setSelectedDate(todayStr);
    }
  }, [todayStr, setSelectedDate]);

  const safeDate = selectedDate || todayStr;
  const lcKey = `list-control-${selectedChannel}-${safeDate}`;
  const readyKey = `ready-${selectedChannel}-${safeDate}`;
  const day = listControlDays[lcKey];
  const readyDay = days[readyKey];
  const activeVariant = day?.activeVariant || 'v1';
  const programs = day?.variants?.[activeVariant]?.programs || [];

  // Seçili satır, sürükle-bırak, filtre, arama ve modal durumları
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 960 : true));
  const [draggedRowIndex, setDraggedRowIndex] = useState(null);
  const [dragOverRowIndex, setDragOverRowIndex] = useState(null);
  const [dropMode, setDropMode] = useState('insert'); // 'insert' | 'replace'
  const [showScrollTopBtn, setShowScrollTopBtn] = useState(false);

  const [activeFilterCategory, setActiveFilterCategory] = useState('all'); // 'all' | 'clips' | 'ads' | 'broadcast_diff' | 'errors_only' | 'revisions'
  const [rundownSearch, setRundownSearch] = useState('');
  const [previewClip, setPreviewClip] = useState(null);
  const [revisionModalItem, setRevisionModalItem] = useState(null);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);

  // Yazı boyutu büyütme / küçültme ölçeği (0.90x - 1.35x arası)
  const [fontScale, setFontScale] = useState(() => {
    try {
      const saved = parseFloat(localStorage.getItem('lc_font_scale_v1'));
      if (saved && saved >= 0.85 && saved <= 1.45) return saved;
    } catch (_) {}
    return 1;
  });

  const handleUpdateFontScale = (nextVal) => {
    const clamped = Number(Math.max(0.9, Math.min(1.35, nextVal)).toFixed(2));
    setFontScale(clamped);
    try {
      localStorage.setItem('lc_font_scale_v1', String(clamped));
    } catch (_) {}
  };

  const activeListName = (day?.sourceList || readyDay?.sourceList) === 'B' || activeVariant === 'v2'
    ? 'Liste B'
    : 'Liste A';

  // Teknik sağlık haritası (DB • Dosya Yolu • Format • Bozukluk)
  const [healthMap, setHealthMap] = useState({});
  const [verifyingHealth, setVerifyingHealth] = useState(false);
  const [draftVersionTick, setDraftVersionTick] = useState(0);

  const rowRefs = useRef({});
  const rightScrollContainerRef = useRef(null);

  const allowedFormats = useMemo(
    () => (Array.isArray(listControlSettings?.allowedFormats) && listControlSettings.allowedFormats.length > 0
      ? listControlSettings.allowedFormats
      : ['mxf']),
    [listControlSettings]
  );

  // Taslak verisini ve sunucu ortak veritabanını (.80 IP <-> seyare.semerkand.com) backend'den senkronize et
  const syncAdsStoreWithServer = usePlanningStore(state => state.syncAdsStoreWithServer);
  useEffect(() => {
    let mounted = true;
    if (typeof syncAdsStoreWithServer === 'function') {
      syncAdsStoreWithServer().then(() => {
        if (mounted && typeof lcSyncFromAdsOrReady === 'function') {
          lcSyncFromAdsOrReady(selectedChannel, safeDate, { forceOverwrite: false, silent: true });
        }
      });
    }
    fetchAndSyncDraftSchedule(selectedChannel).then(() => {
      if (mounted) setDraftVersionTick(t => t + 1);
    });
    return () => { mounted = false; };
  }, [selectedChannel, safeDate, syncAdsStoreWithServer, lcSyncFromAdsOrReady]);

  // Gün veya kanal değiştiğinde Reklam Rezervasyondan iletilen listeyi otomatik senkronize et
  useEffect(() => {
    if (typeof lcSyncFromAdsOrReady === 'function') {
      lcSyncFromAdsOrReady(selectedChannel, safeDate, { forceOverwrite: false, silent: true });
    }
  }, [selectedChannel, safeDate, lcSyncFromAdsOrReady, readyDay?.updatedAt]);

  // Reklam Rezervasyondan iletilmiş veya hazır olan günlerin hızlı geçiş listesi
  const availableTransmittedDates = useMemo(() => {
    const dateSet = new Set([todayStr]);
    const prefixReady = `ready-${selectedChannel}-`;
    const prefixLc = `list-control-${selectedChannel}-`;

    Object.entries(days).forEach(([k, v]) => {
      if (k.startsWith(prefixReady)) {
        const dStr = k.replace(prefixReady, '');
        const progs = v?.variants?.[v?.activeVariant || 'v1']?.programs || [];
        if (progs.length > 0 || v?.adsStatus) dateSet.add(dStr);
      }
    });
    Object.entries(listControlDays).forEach(([k, v]) => {
      if (k.startsWith(prefixLc)) {
        const dStr = k.replace(prefixLc, '');
        const progs = v?.variants?.[v?.activeVariant || 'v1']?.programs || [];
        if (progs.length > 0) dateSet.add(dStr);
      }
    });
    Object.entries(adPlacements).forEach(([k, arr]) => {
      if (k.startsWith(prefixReady) && Array.isArray(arr) && arr.length > 0) {
        dateSet.add(k.replace(prefixReady, ''));
      }
    });

    return Array.from(dateSet).sort();
  }, [selectedChannel, todayStr, days, listControlDays, adPlacements]);

  // 3 Aşamalı Çapraz Kontrol (Taslak Planlama ↔ Yayın Planlama ↔ Reklam Rezervasyon)
  const broadcastRawProgs = useBroadcastStore(state => state.getRawDayPrograms(selectedChannel, safeDate, 'A'));
  const draftSlotsForDay = useMemo(
    () => getDraftProgramsForDay(selectedChannel, safeDate) || [],
    [selectedChannel, safeDate, draftVersionTick]
  );

  const stageAnalysis = useMemo(() => {
    return analyzeThreeStageVerification({
      draftSlots: draftSlotsForDay,
      broadcastPrograms: broadcastRawProgs || [],
      adPlacements: adPlacements[readyKey] || [],
      lcPrograms: programs
    });
  }, [draftSlotsForDay, broadcastRawProgs, adPlacements, readyKey, programs]);

  // Klipler ve Reklamlar için Video Oynatıcı (/api/stream) ile aynı dosya yolundan DB, Dosya Yolu ve Format/Bozukluk Kontrolü
  const runHealthVerification = useCallback(async (deepProbe = false, customFormats = null) => {
    if (!programs || programs.length === 0) {
      setHealthMap({});
      return;
    }
    setVerifyingHealth(true);
    try {
      const fmts = customFormats || allowedFormats;
      const results = await verifyBatchClipsAndAdsHealth(programs, {
        deepProbe,
        allowedFormats: fmts
      });
      setHealthMap(results);

      if (deepProbe && typeof lcAddAuditLog === 'function') {
        const vals = Object.values(results);
        const badCount = vals.filter(r => !r.inDatabase || !r.fileExists || r.isCorrupted).length;
        lcAddAuditLog({
          channelId: selectedChannel,
          date: safeDate,
          actionType: 'health_check',
          actionLabel: 'Teknik Klip & Reklam Kontrolü Tamamlandı',
          itemType: 'system',
          itemTitle: `${programs.length} Öğe Denetlendi (${fmts.map(f => '.' + f.toUpperCase()).join('/')})`,
          oldValue: '-',
          newValue: badCount === 0 ? 'Tüm Klipler & Reklamlar Sağlam' : `${badCount} Satırda Hata Tespit Edildi`,
          details: `Video oynatıcı dosya yolu üzerinden DB, Dosya Yolu ve Format (${fmts.join(', ')}) taraması tamamlandı.`,
          status: badCount === 0 ? 'success' : 'warning'
        });
      }
    } finally {
      setVerifyingHealth(false);
    }
  }, [programs, allowedFormats, selectedChannel, safeDate, lcAddAuditLog]);

  const programsIdentitySignature = useMemo(
    () => programs.map(p => `${p.instanceId}:${p.code || p.id}:${p.durationSec}`).join('|'),
    [programs]
  );

  useEffect(() => {
    runHealthVerification(false);
  }, [programsIdentitySignature, selectedChannel, safeDate, allowedFormats]);

  // Tekrar eden klipleri tek satırda gruplayan ve yanında satır/saat rozetlerini gösteren Hata ve Uyarı Listesi
  const unifiedIssues = useMemo(() => {
    return buildUnifiedIssuesList({
      programs,
      healthMap,
      stageAnalysis
    });
  }, [programs, healthMap, stageAnalysis]);

  const selectedIndex = useMemo(
    () => programs.findIndex(p => p.instanceId === selectedInstanceId),
    [programs, selectedInstanceId]
  );
  const selectedItem = selectedIndex >= 0 ? programs[selectedIndex] : null;

  const selectedClipSignature = useMemo(() => {
    if (!selectedItem) return null;
    return String(selectedItem.code || selectedItem.fileId || selectedItem.title || '').trim().toLowerCase();
  }, [selectedItem]);

  const filteredProgramsWithIndex = useMemo(() => {
    return programs
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => {
        const isAd = Boolean(item.isAdClip || item.isFromAds || item.type === 'ad_break' || item.type === 'ad_spot');
        const h = healthMap[item.instanceId];
        const stageInfo = stageAnalysis?.itemVerificationMap?.[item.instanceId];

        if (activeFilterCategory === 'clips' && isAd) return false;
        if (activeFilterCategory === 'ads' && !isAd) return false;
        if (activeFilterCategory === 'broadcast_diff') {
          if (!stageInfo?.isAddedByBroadcast && !stageInfo?.isModifiedByBroadcast) return false;
        }
        if (activeFilterCategory === 'errors_only') {
          const hasErr = !h?.inDatabase || !h?.fileExists || h?.isCorrupted || item.isEmptyAdBreak;
          if (!hasErr) return false;
        }
        if (activeFilterCategory === 'revisions' && !item.revisionRequested) return false;

        if (rundownSearch.trim()) {
          const q = rundownSearch.toLowerCase().trim();
          return (
            (item.title || '').toLowerCase().includes(q) ||
            String(item.code || item.fileName || item.id || '').toLowerCase().includes(q) ||
            (item.companyName || '').toLowerCase().includes(q) ||
            (item.parentBreakTitle || '').toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [programs, healthMap, stageAnalysis, activeFilterCategory, rundownSearch]);

  const totalDurationSec = useMemo(
    () => programs.reduce((s, p) => s + (Number(p.durationSec) || Math.round((Number(p.duration) || 0) * 60)), 0),
    [programs]
  );

  // Sürükle-Bırak (Drag & Drop) İşleyicileri
  const handleRowDragStart = (e, rowIndex, item) => {
    setDraggedRowIndex(rowIndex);
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ source: 'lc_table_row', fromIndex: rowIndex, instanceId: item.instanceId })
    );
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleRowDragOver = (e, rowIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverRowIndex !== rowIndex) {
      setDragOverRowIndex(rowIndex);
    }
  };

  const handleRowDragLeave = () => {
    setDragOverRowIndex(null);
  };

  const handleRowDrop = (e, targetIndex, targetItem) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverRowIndex(null);

    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const parsed = JSON.parse(raw);

      // 1. Tablo içi satır sıralama (Reorder)
      if (parsed.source === 'lc_table_row' && typeof parsed.fromIndex === 'number') {
        if (parsed.fromIndex !== targetIndex) {
          lcReorderProgram(selectedChannel, safeDate, activeVariant, parsed.fromIndex, targetIndex);
        }
        setDraggedRowIndex(null);
        return;
      }

      // 2. Sol Kütüphaneden (Medya veya Reklam) sürüklenip tabloya bırakılan öğe
      if ((parsed.source === 'lc_library_clip' || parsed.source === 'lc_library_ad') && parsed.payload) {
        if (dropMode === 'replace' && targetItem) {
          lcReplaceItem(selectedChannel, safeDate, activeVariant, targetItem.instanceId, parsed.payload);
        } else {
          lcAddProgramToDay(selectedChannel, safeDate, activeVariant, parsed.payload, targetIndex);
        }
        setDraggedRowIndex(null);
      }
    } catch (_) {
      setDraggedRowIndex(null);
    }
  };

  const handleTableEndDrop = (e) => {
    e.preventDefault();
    setDragOverRowIndex(null);
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if ((parsed.source === 'lc_library_clip' || parsed.source === 'lc_library_ad') && parsed.payload) {
        lcAddProgramToDay(selectedChannel, safeDate, activeVariant, parsed.payload, programs.length);
      }
    } catch (_) {}
  };

  const handleFocusRow = (instanceId) => {
    if (!instanceId) return;
    setActiveFilterCategory('all');
    setRundownSearch('');
    setSelectedInstanceId(instanceId);
    setTimeout(() => {
      const el = rowRefs.current[instanceId];
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
  };

  const handleAddMissingDraftSlot = (draftSlot) => {
    if (!draftSlot) return;
    const durSec = (Number(draftSlot.draftDurationMin) || 30) * 60;
    lcAddProgramToDay(
      selectedChannel,
      safeDate,
      activeVariant,
      {
        id: draftSlot.slotId || `draft-${Date.now()}`,
        title: draftSlot.title,
        clipName: draftSlot.title,
        duration: durSec / 60,
        durationSec: durSec,
        episodeNo: draftSlot.draftEpisode || null,
        categoryName: draftSlot.category || 'Genel',
        categoryColor: draftSlot.categoryColor || '#3b82f6',
        isFromDraft: true,
        type: 'program'
      },
      selectedIndex >= 0 ? selectedIndex + 1 : -1
    );
  };

  const handleOpenRevisionModal = (item) => {
    setRevisionModalItem(item);
    setIsRevisionModalOpen(true);
  };

  const handleSubmitRevision = ({ item, targetStage, reason, isFullDayRevision }) => {
    const rev = lcRequestRevision({
      channelId: selectedChannel,
      date: safeDate,
      variant: activeVariant,
      item,
      targetStage,
      reason,
      isFullDayRevision
    });
    useDialogStore.getState().showAlert(
      isFullDayRevision ? 'Bütün Gün Revizeye Gönderildi' : 'Revize Talebi İletildi',
      `"${rev.itemTitle}" için revize talebi [${rev.targetStageLabel}] birimine iletildi ve denetim loglarına kaydedildi.\n\nRevize Açıklaması: ${rev.reason}`
    );
  };

  const handleApproveList = () => {
    const errorCount = unifiedIssues.filter(i => i.severity === 'error').length;
    const missingDrafts = stageAnalysis?.missingDraftSlots?.length || 0;
    const notes = `Toplam ${programs.length} satır (${formatSecondsReadable(totalDurationSec)}) kontrol edildi. Kritik Hata Grubu: ${errorCount}, Eksik Taslak Kuşağı: ${missingDrafts}.`;
    lcApproveDayList(selectedChannel, safeDate, notes);
    useDialogStore.getState().showAlert(
      'Yayın Listesi Onaylandı',
      `${selectedChannel === 'ch_way' ? 'Semerkand WAY' : 'Semerkand HD'} (${safeDate}) yayın ve reklam listesi kontrol edilerek onaylandı.`
    );
  };

  const channelName = selectedChannel === 'ch_way' ? 'Semerkand WAY' : 'Semerkand HD';
  const defaultBroadcastLogo = adSettings?.[selectedChannel]?.broadcastLogoName || 'Semerkand_Tv_Logo_Corner';
  const defaultAdLogo = adSettings?.[selectedChannel]?.adLogoName || 'Semerkand_HD_Reklam_Logo';
  const isApproved = Boolean(day?.isApprovedInListControl || readyDay?.adsStatus === 'sent_to_master');

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
      overflow: 'hidden'
    }}>
      {/* 1. ÜST ARAÇ ÇUBUĞU (68px Beyaz) VE İKİNCİL ÇUBUK (52px #F5F7F6) */}
      <div style={{
        minHeight: isCompact ? 'auto' : '68px',
        padding: isMobile ? '8px 10px' : '10px 20px',
        background: '#FFFFFF',
        borderBottom: '1px solid var(--border-color, #DCE5E9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: isMobile ? '8px' : '12px',
        flexShrink: 0
      }}>
        {/* SOL GRUP: 34x34 Lacivert (#142A44) İkon Karesi + Başlık + Tarih + Bugün + Kanal + Aktif Liste */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: isMobile ? '8px' : '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '4px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '4px',
              background: 'var(--m-kontrol, #142A44)',
              color: '#FFFFFF',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0
            }}>
              <Ikon ad="kontrol" size={20} />
            </div>
            <h1 style={{
              fontSize: isMobile ? '17px' : '20px',
              fontWeight: 300,
              color: 'var(--text-primary, #0A101D)',
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
              margin: 0
            }}>
              Yayın Liste <b style={{ fontWeight: 700 }}>Kontrol</b>
            </h1>
          </div>

          {/* Tarih Seçici */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: '36px',
            border: '1px solid var(--border-color, #DCE5E9)',
            borderRadius: '4px',
            background: '#FFFFFF',
            overflow: 'hidden'
          }}>
            <button
              type="button"
              onClick={() => {
                const base = parseISO(safeDate);
                const next = lcViewMode === 'monthly' ? addMonths(base, -1) : addDays(base, lcViewMode === 'weekly' ? -7 : -1);
                setSelectedDate(format(next, 'yyyy-MM-dd'));
              }}
              style={{
                width: '32px',
                height: '100%',
                border: 0,
                background: 'transparent',
                color: 'var(--text-secondary, #4B6478)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer'
              }}
            >
              <Ikon ad="sol" size={16} />
            </button>

            <CustomDatePicker selectedDate={safeDate} onDateChange={(d) => setSelectedDate(d)}>
              <div style={{
                height: '36px',
                padding: '0 12px',
                borderLeft: '1px solid var(--border-light, #EBF0F2)',
                borderRight: '1px solid var(--border-light, #EBF0F2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-primary, #0A101D)',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap'
              }}>
                <Ikon ad="hafta" size={15} color="var(--turkuaz, #0C617C)" />
                <span>{format(parseISO(safeDate), 'd MMMM yyyy EEEE', { locale: tr })}</span>
              </div>
            </CustomDatePicker>

            <button
              type="button"
              onClick={() => {
                const base = parseISO(safeDate);
                const next = lcViewMode === 'monthly' ? addMonths(base, 1) : addDays(base, lcViewMode === 'weekly' ? 7 : 1);
                setSelectedDate(format(next, 'yyyy-MM-dd'));
              }}
              style={{
                width: '32px',
                height: '100%',
                border: 0,
                background: 'transparent',
                color: 'var(--text-secondary, #4B6478)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer'
              }}
            >
              <Ikon ad="sag" size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedDate(todayStr);
              setLcViewMode('daily');
            }}
            style={{
              height: '32px',
              padding: '0 10px',
              borderRadius: '4px',
              border: '1px solid var(--turkuaz-100, #CFE1E7)',
              background: 'var(--turkuaz-50, #E7F0F3)',
              color: 'var(--turkuaz, #0C617C)',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Bugün ({format(parseISO(todayStr), 'd MMM', { locale: tr })})
          </button>

          {/* Kanal Seçici */}
          <div style={{
            display: 'inline-flex',
            background: 'var(--bg-primary, #F5F7F6)',
            padding: '2px',
            borderRadius: '4px',
            border: '1px solid var(--border-color, #DCE5E9)',
            gap: '2px'
          }}>
            {channels.map(ch => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setSelectedChannel(ch.id)}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  borderRadius: '3px',
                  border: 0,
                  background: selectedChannel === ch.id ? 'var(--turkuaz, #0C617C)' : 'transparent',
                  color: selectedChannel === ch.id ? '#FFFFFF' : 'var(--text-secondary, #4B6478)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                <Ikon ad="kanal" size={14} />
                <span>{ch.name}</span>
              </button>
            ))}
          </div>

          {/* Aktif Liste Bilgisi */}
          <span style={{
            height: '32px',
            padding: '0 10px',
            borderRadius: '4px',
            background: '#FFFFFF',
            border: '1px solid var(--border-color, #DCE5E9)',
            color: 'var(--text-secondary, #4B6478)',
            fontSize: '11.5px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            whiteSpace: 'nowrap'
          }}>
            <span>Aktif Liste:</span>
            <b style={{ color: 'var(--text-primary, #0A101D)' }}>{activeListName}</b>
          </span>
        </div>

        {/* SAĞ GRUP: Reklam Rezervasyondan Çek + Bütün Günü Revizeye Gönder + Listeyi Onayla */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              const res = lcSyncFromAdsOrReady(selectedChannel, safeDate, { forceOverwrite: true, silent: false });
              if (res.count > 0) {
                useDialogStore.getState().showAlert(
                  'Liste Güncellendi',
                  `${res.source} üzerinden ${res.count} yayın ve reklam satırı Liste Kontrol ekranına yeniden çekildi.`
                );
              } else {
                useDialogStore.getState().showAlert(
                  'Veri Bulunamadı',
                  `Seçili gün (${safeDate}) için Reklam Rezervasyon veya Yayın Planlamada kayıtlı liste bulunamadı.`
                );
              }
            }}
            style={{
              height: '36px',
              padding: '0 12px',
              borderRadius: '4px',
              border: '1px solid var(--border-color, #DCE5E9)',
              background: '#FFFFFF',
              color: 'var(--text-primary, #0A101D)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              whiteSpace: 'nowrap'
            }}
          >
            <Ikon ad="cek" size={15} />
            <span>Reklam Rezervasyondan Çek</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleOpenRevisionModal({
                isFullDayRevision: true,
                title: `${channelName} (${safeDate}) Tüm Gün Yayın & Reklam Listesi`,
                code: safeDate,
                durationSec: totalDurationSec,
                defaultTargetStage: 'broadcast'
              })
            }
            disabled={programs.length === 0}
            style={{
              height: '36px',
              padding: '0 12px',
              borderRadius: '4px',
              border: '1px solid rgba(221, 28, 64, 0.38)',
              background: '#FFFFFF',
              color: 'var(--danger, #DD1C40)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: programs.length === 0 ? 'not-allowed' : 'pointer',
              opacity: programs.length === 0 ? 0.5 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              whiteSpace: 'nowrap'
            }}
          >
            <Ikon ad="revize" size={15} />
            <span>Bütün Günü Revizeye Gönder</span>
          </button>

          <button
            type="button"
            onClick={handleApproveList}
            disabled={programs.length === 0}
            style={{
              height: '36px',
              padding: '0 14px',
              borderRadius: '4px',
              border: isApproved ? '1px solid var(--yesil, #468625)' : '1px solid var(--turkuaz, #0C617C)',
              background: isApproved ? 'var(--yesil, #468625)' : 'var(--turkuaz, #0C617C)',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 700,
              cursor: programs.length === 0 ? 'not-allowed' : 'pointer',
              opacity: programs.length === 0 ? 0.5 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              whiteSpace: 'nowrap'
            }}
          >
            <Ikon ad="tamam" size={15} />
            <span>{isApproved ? 'Onaylandı' : 'Listeyi Onayla'}</span>
          </button>
        </div>
      </div>

      {/* İKİNCİL KONTROL ÇUBUĞU (52px #F5F7F6): Görünüm Modu + Hazır/İletilen Günler + Yazı Boyutu */}
      <div style={{
        minHeight: '52px',
        padding: isMobile ? '6px 10px' : '8px 20px',
        background: 'var(--bg-primary, #F5F7F6)',
        borderBottom: '1px solid var(--border-color, #DCE5E9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', minWidth: 0 }}>
          {/* Görünüm Modu Seçici */}
          <div style={{
            display: 'inline-flex',
            background: '#FFFFFF',
            padding: '2px',
            borderRadius: '4px',
            border: '1px solid var(--border-color, #DCE5E9)',
            gap: '2px'
          }}>
            {[
              { id: 'daily', label: 'Günlük' },
              { id: 'weekly', label: 'Haftalık' },
              { id: 'monthly', label: 'Aylık' },
              { id: 'reports', label: `Raporlar & Loglar (${listControlLogs.length})` }
            ].map(vm => (
              <button
                key={vm.id}
                type="button"
                onClick={() => setLcViewMode(vm.id)}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  borderRadius: '3px',
                  border: 0,
                  background: lcViewMode === vm.id ? 'var(--turkuaz, #0C617C)' : 'transparent',
                  color: lcViewMode === vm.id ? '#FFFFFF' : 'var(--text-secondary, #4B6478)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {vm.label}
              </button>
            ))}
          </div>

          {/* Hazır / İletilen Günler Hızlı Geçiş */}
          {availableTransmittedDates.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              overflowX: 'auto',
              fontSize: '11.5px'
            }}>
              <span style={{ fontWeight: 700, color: 'var(--text-secondary, #4B6478)', flexShrink: 0 }}>
                Hazır / İletilen Günler:
              </span>
              {availableTransmittedDates.map(dStr => {
                const isCurr = dStr === safeDate;
                const isTod = dStr === todayStr;
                const rDay = days[`ready-${selectedChannel}-${dStr}`];
                const lDay = listControlDays[`list-control-${selectedChannel}-${dStr}`];
                const count =
                  lDay?.variants?.[lDay?.activeVariant || 'v1']?.programs?.length ||
                  rDay?.variants?.[rDay?.activeVariant || 'v1']?.programs?.length ||
                  0;
                return (
                  <button
                    key={dStr}
                    type="button"
                    onClick={() => {
                      setSelectedDate(dStr);
                      setLcViewMode('daily');
                    }}
                    style={{
                      height: '28px',
                      padding: '0 10px',
                      borderRadius: '4px',
                      border: isCurr ? '1px solid var(--turkuaz-100, #CFE1E7)' : '1px solid var(--border-color, #DCE5E9)',
                      background: isCurr ? 'var(--turkuaz-50, #E7F0F3)' : '#FFFFFF',
                      color: isCurr ? 'var(--turkuaz, #0C617C)' : 'var(--text-secondary, #4B6478)',
                      fontSize: '11.5px',
                      fontWeight: isCurr ? 700 : 600,
                      cursor: 'pointer',
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>{format(parseISO(dStr), 'd MMM EEE', { locale: tr })}</span>
                    {isTod && <strong style={{ color: 'var(--yesil, #468625)' }}>(Bugün)</strong>}
                    {count > 0 && (
                      <b style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>
                        {count}
                      </b>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Yazı Boyutu Kontrolü */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11.5px',
            fontWeight: 600,
            color: 'var(--text-secondary, #4B6478)'
          }}>
            <Ikon ad="yazi" size={14} />
            <span>Yazı Boyutu:</span>
          </span>
          <div style={{
            display: 'inline-flex',
            background: '#FFFFFF',
            padding: '2px',
            borderRadius: '4px',
            border: '1px solid var(--border-color, #DCE5E9)',
            gap: '2px'
          }}>
            <button
              type="button"
              onClick={() => handleUpdateFontScale(fontScale - 0.08)}
              disabled={fontScale <= 0.9}
              style={{
                height: '28px',
                padding: '0 9px',
                borderRadius: '3px',
                border: 0,
                background: 'transparent',
                color: 'var(--text-secondary, #4B6478)',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: fontScale <= 0.9 ? 'not-allowed' : 'pointer',
                opacity: fontScale <= 0.9 ? 0.45 : 1
              }}
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => handleUpdateFontScale(1)}
              style={{
                height: '28px',
                padding: '0 9px',
                borderRadius: '3px',
                border: 0,
                background: 'var(--turkuaz, #0C617C)',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer'
              }}
            >
              %{Math.round(fontScale * 100)}
            </button>
            <button
              type="button"
              onClick={() => handleUpdateFontScale(fontScale + 0.08)}
              disabled={fontScale >= 1.35}
              style={{
                height: '28px',
                padding: '0 9px',
                borderRadius: '3px',
                border: 0,
                background: 'transparent',
                color: 'var(--text-secondary, #4B6478)',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: fontScale >= 1.35 ? 'not-allowed' : 'pointer',
                opacity: fontScale >= 1.35 ? 0.45 : 1
              }}
            >
              A+
            </button>
          </div>
        </div>
      </div>

      {/* 2. ANA İÇERİK ALANI */}
      {lcViewMode === 'weekly' ? (
        <ListControlWeekView
          selectedChannel={selectedChannel}
          selectedDate={safeDate}
          onSelectDayToDaily={(dStr) => {
            setSelectedDate(dStr);
            setLcViewMode('daily');
          }}
        />
      ) : lcViewMode === 'monthly' ? (
        <ListControlMonthView
          selectedChannel={selectedChannel}
          selectedDate={safeDate}
          onSelectDayToDaily={(dStr) => {
            setSelectedDate(dStr);
            setLcViewMode('daily');
          }}
        />
      ) : lcViewMode === 'reports' ? (
        <ListControlReportsLogsView
          selectedChannel={selectedChannel}
          selectedDate={safeDate}
          programs={programs}
          healthMap={healthMap}
          stageAnalysis={stageAnalysis}
          issues={unifiedIssues}
          onOpenClipPreview={(clipObj) => setPreviewClip(clipObj)}
          onRequestRevision={handleOpenRevisionModal}
        />
      ) : (
        /* GÜNLÜK ANA KONTROL EKRANI: SOLDA MEDYA/BÖLÜM/REKLAM KÜTÜPHANESİ + SAĞDA TEK PARÇA KAYDIRILABİLİR FLEXBOX TABLO ALANI */
        <div style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: 'flex',
          overflow: 'hidden',
          position: 'relative'
        }}>
          {/* SOL PANEL: MEDYA, BÖLÜM VE REKLAM KÜTÜPHANESİ (GİZLENEBİLİR / AÇILABİLİR, SÜRÜKLE-BIRAK DESTEKLİ) */}
          {isLeftSidebarOpen && (
            <ListControlSidebar
              selectedChannel={selectedChannel}
              selectedDate={safeDate}
              selectedItem={selectedItem}
              selectedIndex={selectedIndex}
              onCloseSidebar={() => setIsLeftSidebarOpen(false)}
              onReplaceSelected={(newPayload) => {
                if (!selectedItem) return;
                lcReplaceItem(selectedChannel, safeDate, activeVariant, selectedItem.instanceId, newPayload);
              }}
              onInsertItem={(newPayload, targetIdx) => {
                lcAddProgramToDay(selectedChannel, safeDate, activeVariant, newPayload, targetIdx);
              }}
              onOpenClipPreview={(clipObj) => setPreviewClip(clipObj)}
            />
          )}

          {/* SAĞ PANEL: TEK PARÇA KAYDIRILABİLİR (SCROLLABLE) ÇALIŞMA ALANI */}
          <div
            ref={rightScrollContainerRef}
            onScroll={(e) => {
              const top = e.currentTarget.scrollTop;
              if (top > 220 && !showScrollTopBtn) setShowScrollTopBtn(true);
              else if (top <= 220 && showScrollTopBtn) setShowScrollTopBtn(false);
            }}
            style={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              height: '100%',
              overflowY: 'auto',
              overflowX: 'auto',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}
          >
            {/* Üst Uyarılar, Sorunlar (Aynı Klipler Tek Satırda Gruplanmış) ve Format Ayarları (.mxf) */}
            <ListControlWarningsPanel
              stageAnalysis={stageAnalysis}
              healthMap={healthMap}
              programs={programs}
              issues={unifiedIssues}
              verifyingHealth={verifyingHealth}
              fontScale={fontScale}
              allowedFormats={allowedFormats}
              onUpdateAllowedFormats={(nextFormats) => {
                lcUpdateFormatSettings({ allowedFormats: nextFormats });
              }}
              onRunDeepHealthCheck={() => runHealthVerification(true)}
              onFocusRow={handleFocusRow}
              onAddMissingDraftSlot={handleAddMissingDraftSlot}
              onRequestRevision={handleOpenRevisionModal}
              activeFilterCategory={activeFilterCategory}
              onSelectFilterCategory={setActiveFilterCategory}
            />

            {/* Akış Filtre, Sürükle-Bırak Modu & Arama Çubuğu */}
            <div style={{
              padding: '8px 16px',
              background: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setIsLeftSidebarOpen(prev => !prev)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color, #DCE5E9)',
                    background: isLeftSidebarOpen ? '#FFFFFF' : 'var(--turkuaz, #0C617C)',
                    color: isLeftSidebarOpen ? 'var(--text-primary, #0A101D)' : '#ffffff',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  title="Sol Medya & Reklam Kütüphanesini Gizle / Göster"
                >
                  {isLeftSidebarOpen ? 'Kütüphaneyi Gizle' : 'Kütüphaneyi Aç'}
                </button>
                {[
                  { id: 'all', label: `Tümü (${programs.length})` },
                  {
                    id: 'clips',
                    label: `Klipler (${programs.filter(p => !p.isAdClip && !p.isFromAds).length})`
                  },
                  {
                    id: 'ads',
                    label: `Reklamlar (${programs.filter(p => p.isAdClip || p.isFromAds).length})`
                  },
                  {
                    id: 'broadcast_diff',
                    label: `Yayın Planlama Ek/Değişim (${(stageAnalysis?.addedByBroadcastItems?.length || 0) + (stageAnalysis?.modifiedByBroadcastItems?.length || 0)})`
                  },
                  {
                    id: 'errors_only',
                    label: `Hatalı Satırlar (${programs.filter(p => {
                      const h = healthMap[p.instanceId];
                      return (h && (!h.inDatabase || !h.fileExists || h.isCorrupted)) || p.isEmptyAdBreak;
                    }).length})`
                  },
                  {
                    id: 'revisions',
                    label: `Revize (${programs.filter(p => p.revisionRequested).length})`
                  }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFilterCategory(f.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: activeFilterCategory === f.id ? '1px solid var(--turkuaz, #0C617C)' : '1px solid var(--border-color, #DCE5E9)',
                      background: activeFilterCategory === f.id ? 'var(--turkuaz, #0C617C)' : '#FFFFFF',
                      color: activeFilterCategory === f.id ? '#ffffff' : 'var(--text-secondary, #4B6478)',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Sol Panelden Sürükle-Bırak Davranışı Seçici */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-primary)',
                  padding: '2px',
                  borderRadius: '7px',
                  border: '1px solid var(--border-color)',
                  fontSize: '10.5px',
                  fontWeight: 800
                }}>
                  <span style={{ padding: '2px 6px', color: 'var(--text-muted)' }}>Sürükle-Bırak:</span>
                  <button
                    type="button"
                    onClick={() => setDropMode('insert')}
                    style={{
                      padding: '3px 7px',
                      borderRadius: '5px',
                      border: 'none',
                      background: dropMode === 'insert' ? '#10b981' : 'transparent',
                      color: dropMode === 'insert' ? '#fff' : 'var(--text-secondary)',
                      fontSize: '10.5px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    + Araya Ekle
                  </button>
                  <button
                    type="button"
                    onClick={() => setDropMode('replace')}
                    style={{
                      padding: '3px 7px',
                      borderRadius: '5px',
                      border: 'none',
                      background: dropMode === 'replace' ? '#2563eb' : 'transparent',
                      color: dropMode === 'replace' ? '#fff' : 'var(--text-secondary)',
                      fontSize: '10.5px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Üzerine Bırakınca Değiştir
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <Search size={13} color="var(--text-muted)" style={{ position: 'absolute', left: '8px', top: '7px' }} />
                  <input
                    type="text"
                    value={rundownSearch}
                    onChange={(e) => setRundownSearch(e.target.value)}
                    placeholder="Tabloda klip, reklam, firma veya .mxf ara..."
                    style={{
                      padding: '4px 22px 4px 26px',
                      borderRadius: '7px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '11.5px',
                      outline: 'none',
                      width: '220px'
                    }}
                  />
                  {rundownSearch && (
                    <button
                      type="button"
                      onClick={() => setRundownSearch('')}
                      style={{
                        position: 'absolute',
                        right: '5px',
                        top: '5px',
                        border: 'none',
                        background: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleOpenRevisionModal({
                      isFullDayRevision: true,
                      title: `${channelName} (${safeDate}) Tüm Gün Yayın & Reklam Listesi`,
                      code: safeDate,
                      durationSec: totalDurationSec,
                      defaultTargetStage: 'broadcast'
                    })
                  }
                  style={{
                    padding: '4px 10px',
                    borderRadius: '7px',
                    border: '1px solid rgba(220, 38, 38, 0.45)',
                    background: 'rgba(220, 38, 38, 0.12)',
                    color: '#dc2626',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Send size={11} />
                  <span>Bütün Günü Revizeye Gönder</span>
                </button>
              </div>
            </div>

            {/* LİSTENİN ÜSTÜNDE LACİVERT (#142A44) TOPLAM SÜRE ŞERİDİ (.total) */}
            {programs.length > 0 && (
              <div style={{
                padding: '10px 16px 2px 16px'
              }}>
                <div style={{
                  padding: '11px 16px',
                  borderRadius: '6px',
                  background: 'var(--lacivert, #142A44)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '14px',
                  flexWrap: 'wrap'
                }}>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Ikon ad="saat" size={16} />
                    <span>Liste Toplam Yayın Süresi:</span>
                  </span>
                  <span style={{
                    fontSize: '17px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: '#FFFFFF'
                  }}>
                    {formatSecondsReadable(totalDurationSec)} / 24 sa 00 dk
                  </span>
                  <span style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: '2px',
                    background: 'var(--hardal, #E8B44C)',
                    color: 'var(--gece, #0A101D)',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    %{Math.min(100, Number(((totalDurationSec / 86400) * 100).toFixed(1)))} Dolu
                    {totalDurationSec < 86400
                      ? ` • Kalan: ${formatSecondsReadable(86400 - totalDurationSec)}`
                      : totalDurationSec > 86400
                      ? ` • Fazla: +${formatSecondsReadable(totalDurationSec - 86400)}`
                      : ' • Tam 24 Saat'}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.85)' }}>
                    ({channelName} • {activeListName} • {programs.length} Satır)
                  </span>
                </div>
              </div>
            )}

            {/* FLEXBOX TABLO ALANI */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleTableEndDrop}
              style={{
                padding: '10px 16px 36px 16px',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {programs.length === 0 ? (
                <div style={{
                  margin: '32px auto',
                  maxWidth: '520px',
                  padding: '32px 24px',
                  borderRadius: '16px',
                  background: 'var(--bg-secondary)',
                  border: '1.5px dashed var(--border-color)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <Megaphone size={36} color="var(--accent-primary)" />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)' }}>
                    {format(parseISO(safeDate), 'd MMMM yyyy EEEE', { locale: tr })} Günü İçin İletilen Liste Bekleniyor
                  </h3>
                  <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Reklam Rezervasyon modülünden tamamlanıp iletilen listeler burada otomatik açılır.
                    Yukarıdaki <strong>"Hazır / İletilen Günler"</strong> şeridinden hazır bir güne geçebilir,
                    <strong>"Reklam Rezervasyondan Çek"</strong> butonuna tıklayabilir veya sol panelden sürükleyip bırakarak klip/reklam ekleyebilirsiniz.
                  </p>
                  <button
                    type="button"
                    onClick={() => lcSyncFromAdsOrReady(selectedChannel, safeDate, { forceOverwrite: true, silent: false })}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'var(--accent-primary)',
                      color: '#ffffff',
                      fontSize: '12.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <RefreshCw size={14} />
                    <span>Reklam Rezervasyondan Listeyi Çek</span>
                  </button>
                </div>
              ) : (
                <div style={{
                  border: '1.5px solid var(--border-color)',
                  borderRadius: '12px',
                  background: 'var(--bg-secondary)',
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  WebkitOverflowScrolling: 'touch',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)'
                }}>
                  <div style={{ minWidth: '880px', display: 'flex', flexDirection: 'column' }}>
                  {/* FLEXBOX TABLO BAŞLIĞI (EKRANA TAM SIĞAN 7 SÜTUN) */}
                  <div style={{
                    padding: '8px 12px',
                    background: 'var(--bg-tertiary)',
                    borderBottom: '1.5px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    fontSize: `${(10.5 * fontScale).toFixed(1)}px`,
                    fontWeight: 900,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.2px'
                  }}>
                    <div style={{ width: `${Math.round(54 * fontScale)}px`, flexShrink: 0 }}>SIRA</div>
                    <div style={{ width: `${Math.round(84 * fontScale)}px`, flexShrink: 0 }}>SAAT</div>
                    <div style={{ flex: '2.2 1 170px', minWidth: 0 }}>TÜR • KLİP / REKLAM ADI • ID & DOSYA (.MXF)</div>
                    <div style={{ flex: '1.15 1 130px', minWidth: 0 }}>LOGO GİRİŞ / ÇIKIŞ</div>
                    <div style={{ flex: '2.1 1 195px', minWidth: 0 }}>AŞAMA & TEKNİK KONTROL (DB • HIGHRES .MXF)</div>
                    <div style={{ width: `${Math.round(126 * fontScale)}px`, flexShrink: 0, textAlign: 'center' }}>SÜRE</div>
                    <div style={{ width: `${Math.round(156 * fontScale)}px`, flexShrink: 0, textAlign: 'right' }}>İŞLEMLER</div>
                  </div>

                  {/* FLEXBOX TABLO SATIRLARI */}
                  {filteredProgramsWithIndex.length === 0 ? (
                    <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      Seçili filtre veya arama kriterine uygun satır bulunamadı.
                    </div>
                  ) : (
                    filteredProgramsWithIndex.map(({ item, originalIndex }) => {
                      const isSelected = item.instanceId === selectedInstanceId;
                      const itemSig = String(item.code || item.fileId || item.title || '').trim().toLowerCase();
                      const isSameClipHighlighted =
                        !isSelected &&
                        Boolean(selectedClipSignature && itemSig && itemSig === selectedClipSignature);

                      return (
                        <ListControlRundownRow
                          key={item.instanceId}
                          item={item}
                          index={originalIndex}
                          totalCount={programs.length}
                          isSelected={isSelected}
                          isSameClipHighlighted={isSameClipHighlighted}
                          isDragOver={dragOverRowIndex === originalIndex}
                          health={healthMap[item.instanceId]}
                          stageInfo={stageAnalysis?.itemVerificationMap?.[item.instanceId]}
                          defaultBroadcastLogo={defaultBroadcastLogo}
                          defaultAdLogo={defaultAdLogo}
                          fontScale={fontScale}
                          rowRef={(el) => {
                            if (el) rowRefs.current[item.instanceId] = el;
                          }}
                          onSelectRow={(clickedItem) => setSelectedInstanceId(clickedItem.instanceId)}
                          onUpdateDurationSec={(instId, newSec) =>
                            lcUpdateItemDurationSec(selectedChannel, safeDate, activeVariant, instId, newSec)
                          }
                          onUpdateLogoEvent={(instId, manualEv) =>
                            lcUpdateItemLogoEvent && lcUpdateItemLogoEvent(selectedChannel, safeDate, activeVariant, instId, manualEv)
                          }
                          onMoveUp={(instId) =>
                            lcMoveProgramUp(selectedChannel, safeDate, activeVariant, instId)
                          }
                          onMoveDown={(instId) =>
                            lcMoveProgramDown(selectedChannel, safeDate, activeVariant, instId)
                          }
                          onDeleteRow={(rowItem) =>
                            lcRemovePrograms(selectedChannel, safeDate, activeVariant, [rowItem.instanceId])
                          }
                          onOpenClipPreview={(clipObj) => setPreviewClip(clipObj)}
                          onRequestRevision={handleOpenRevisionModal}
                          onRowDragStart={handleRowDragStart}
                          onRowDragOver={handleRowDragOver}
                          onRowDragLeave={handleRowDragLeave}
                          onRowDrop={handleRowDrop}
                        />
                      );
                    })
                  )}
                  </div>
                </div>
              )}
            </div>

            {/* YÜZEN EN ÜSTE ÇIK BUTONU */}
            {showScrollTopBtn && (
              <button
                type="button"
                onClick={() => {
                  if (rightScrollContainerRef.current) {
                    rightScrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                style={{
                  position: 'fixed',
                  right: '24px',
                  bottom: '24px',
                  padding: '9px 14px',
                  borderRadius: '999px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 8px 24px rgba(37, 99, 235, 0.38)',
                  zIndex: 90
                }}
              >
                <ArrowUp size={14} />
                <span>En Üste Çık</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. KLİP & REKLAM VİDEO İZLEME VE VERİTABANI KÜNYE MODALI (ⓘ İZLE & BİLGİ) */}
      <ClipDetailMetadataModal
        isOpen={Boolean(previewClip)}
        onClose={() => setPreviewClip(null)}
        clip={previewClip}
      />

      {/* 4. AKILLI REVİZE İSTEME MODALI */}
      <ListControlRevisionModal
        isOpen={isRevisionModalOpen}
        onClose={() => {
          setIsRevisionModalOpen(false);
          setRevisionModalItem(null);
        }}
        item={revisionModalItem}
        channelName={channelName}
        selectedDate={safeDate}
        onSubmitRevision={handleSubmitRevision}
      />
    </div>
  );
}
