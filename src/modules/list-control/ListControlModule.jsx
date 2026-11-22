/**
 * @file src/modules/list-control/ListControlModule.jsx
 * @description Yayın Liste Kontrol Modülü Ana Çalışma Alanı.
 *
 * Özellikler:
 * 1. Açılış ekranı her zaman **Günlük (Daily)** ve **Bugün (Today)** olarak başlar;
 *    Günlük, Haftalık, Aylık ve Raporlar & Denetim Logları görünümleri arasında geçiş yapılabilir.
 * 2. Reklam Rezervasyondan iletilen listeyi (`listControlDays` / `ready-*` + `adPlacements`) otomatik yükler.
 * 3. Sol panelde Yayın Planlama gibi çalışan (fakat Dolgu Kuşağı ekleme içermeyen) Medya, Bölüm ve Reklam Kütüphanesi yer alır;
 *    sağdaki listeden bir klibe tıklandığında sol panelde o programın tüm bölümleri açılır ve tek tıkla klip/bölüm değiştirilebilir.
 * 4. Klip ve reklam süresi doğrudan satır üzerinden değiştirilebilir; reklam ekleme, değiştirme ve silme yapılabilir.
 * 5. Akıllı Revize İsteme: Klip için Taslak mı Yayın Planlama mı seçtirir; Reklam için doğrudan Reklam Rezervasyona gönderir.
 * 6. 3 Aşamalı Çapraz Kontrol (Taslak ↔ Yayın Planlama ↔ Reklamlar) ve Teknik Sağlık Kontrolü (DB'de var mı? • Dosya yolunda var mı? • Klip bozuk mu?).
 * 7. ⓘ İzle & Bilgi (Video Önizleme + Künye), Uyarı & Sorunlar Alanı, Raporlar ve Kalıcı Denetim Logları.
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
  Film,
  Megaphone,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Send,
  Layers,
  Clock,
  Sparkles,
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

export default function ListControlModule() {
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

  const lcSyncFromAdsOrReady = usePlanningStore(state => state.lcSyncFromAdsOrReady);
  const lcReplaceItem = usePlanningStore(state => state.lcReplaceItem);
  const lcAddProgramToDay = usePlanningStore(state => state.lcAddProgramToDay);
  const lcUpdateItemDurationSec = usePlanningStore(state => state.lcUpdateItemDurationSec);
  const lcMoveProgramUp = usePlanningStore(state => state.lcMoveProgramUp);
  const lcMoveProgramDown = usePlanningStore(state => state.lcMoveProgramDown);
  const lcRemovePrograms = usePlanningStore(state => state.lcRemovePrograms);
  const lcRequestRevision = usePlanningStore(state => state.lcRequestRevision);
  const lcApproveDayList = usePlanningStore(state => state.lcApproveDayList);
  const lcAddAuditLog = usePlanningStore(state => state.lcAddAuditLog);
  const applyChannelLogosToListControl = usePlanningStore(state => state.applyChannelLogosToListControl);

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

  // Seçili satır, filtre, arama ve modal durumları
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [activeFilterCategory, setActiveFilterCategory] = useState('all'); // 'all' | 'clips' | 'ads' | 'broadcast_diff' | 'errors_only' | 'revisions'
  const [rundownSearch, setRundownSearch] = useState('');
  const [previewClip, setPreviewClip] = useState(null);
  const [revisionModalItem, setRevisionModalItem] = useState(null);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);

  // Teknik sağlık haritası (DB • Dosya Yolu • Bozukluk)
  const [healthMap, setHealthMap] = useState({});
  const [verifyingHealth, setVerifyingHealth] = useState(false);
  const [draftVersionTick, setDraftVersionTick] = useState(0);

  const rowRefs = useRef({});

  // Taslak verisini backend'den senkronize et
  useEffect(() => {
    let mounted = true;
    fetchAndSyncDraftSchedule(selectedChannel).then(() => {
      if (mounted) setDraftVersionTick(t => t + 1);
    });
    return () => { mounted = false; };
  }, [selectedChannel]);

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

  // Klipler ve Reklamlar için DB, Dosya Yolu ve Bozukluk Kontrolünü Çalıştır
  const runHealthVerification = useCallback(async (deepProbe = false) => {
    if (!programs || programs.length === 0) {
      setHealthMap({});
      return;
    }
    setVerifyingHealth(true);
    try {
      const results = await verifyBatchClipsAndAdsHealth(programs, { deepProbe });
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
          itemTitle: `${programs.length} Öğe Denetlendi`,
          oldValue: '-',
          newValue: badCount === 0 ? 'Tüm Klipler & Reklamlar Sağlam' : `${badCount} Öğede Hata Tespit Edildi`,
          details: `DB, Dosya Yolu ve Klip Bozukluk taraması tamamlandı. (${programs.length - badCount} Sağlam, ${badCount} Sorunlu)`,
          status: badCount === 0 ? 'success' : 'warning'
        });
      }
    } finally {
      setVerifyingHealth(false);
    }
  }, [programs, selectedChannel, safeDate, lcAddAuditLog]);

  useEffect(() => {
    runHealthVerification(false);
  }, [programs.length, selectedChannel, safeDate]);

  // Birleşik Hatalar, Sorunlar ve Uyarılar Listesi
  const unifiedIssues = useMemo(() => {
    return buildUnifiedIssuesList({
      programs,
      healthMap,
      stageAnalysis
    });
  }, [programs, healthMap, stageAnalysis]);

  // Seçili satır nesnesi ve index'i
  const selectedIndex = useMemo(
    () => programs.findIndex(p => p.instanceId === selectedInstanceId),
    [programs, selectedInstanceId]
  );
  const selectedItem = selectedIndex >= 0 ? programs[selectedIndex] : null;

  // Seçili klibin/reklamın aynı gün içinde başka yerlerdeki tekrarlarını vurgulamak için kod/başlık
  const selectedClipSignature = useMemo(() => {
    if (!selectedItem) return null;
    return String(selectedItem.code || selectedItem.fileId || selectedItem.title || '').trim().toLowerCase();
  }, [selectedItem]);

  // Filtrelenmiş akış satırları
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

  const handleSubmitRevision = ({ item, targetStage, reason }) => {
    const rev = lcRequestRevision({
      channelId: selectedChannel,
      date: safeDate,
      variant: activeVariant,
      item,
      targetStage,
      reason
    });
    useDialogStore.getState().showAlert(
      'Revize Talebi İletildi',
      `"${rev.itemTitle}" için revize talebi [${rev.targetStageLabel}] birimine iletildi ve denetim loglarına kaydedildi.`
    );
  };

  const handleApproveList = () => {
    const errorCount = unifiedIssues.filter(i => i.severity === 'error').length;
    const missingDrafts = stageAnalysis?.missingDraftSlots?.length || 0;
    const notes = `Toplam ${programs.length} satır (${formatSecondsReadable(totalDurationSec)}) kontrol edildi. Kritik Hata: ${errorCount}, Eksik Taslak Kuşağı: ${missingDrafts}.`;
    lcApproveDayList(selectedChannel, safeDate, notes);
    useDialogStore.getState().showAlert(
      'Yayın Listesi Onaylandı',
      `${selectedChannel === 'ch_way' ? 'Semerkand WAY' : 'Semerkand HD'} (${safeDate}) yayın ve reklam listesi kontrol edilerek onaylandı. Liste dönüşüm aşamasına hazırdır.`
    );
  };

  const channelName = selectedChannel === 'ch_way' ? 'Semerkand WAY' : 'Semerkand HD';
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
      {/* 1. ÜST KONTROL VE NAVİGASYON ÇUBUĞU */}
      <div style={{
        padding: '10px 16px',
        background: 'var(--bg-secondary)',
        borderBottom: '1.5px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          {/* Sol: Kanal Seçici + Görünüm Seçici (Günlük [Bugün] / Haftalık / Aylık / Raporlar & Loglar) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Kanal Seçici */}
            <div style={{
              display: 'flex',
              background: 'var(--bg-tertiary)',
              padding: '3px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              gap: '3px'
            }}>
              {channels.map(ch => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setSelectedChannel(ch.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '7px',
                    border: 'none',
                    background: selectedChannel === ch.id ? 'var(--accent-primary)' : 'transparent',
                    color: selectedChannel === ch.id ? '#ffffff' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {ch.name}
                </button>
              ))}
            </div>

            {/* Görünüm Modu Seçici */}
            <div style={{
              display: 'flex',
              background: 'var(--bg-tertiary)',
              padding: '3px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              gap: '3px'
            }}>
              {[
                { id: 'daily', label: '📅 Günlük' },
                { id: 'weekly', label: '🗓️ Haftalık' },
                { id: 'monthly', label: '📆 Aylık' },
                { id: 'reports', label: `📊 Raporlar & Loglar (${listControlLogs.length})` }
              ].map(vm => (
                <button
                  key={vm.id}
                  type="button"
                  onClick={() => setLcViewMode(vm.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '7px',
                    border: 'none',
                    background: lcViewMode === vm.id ? '#2563eb' : 'transparent',
                    color: lcViewMode === vm.id ? '#ffffff' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {vm.label}
                </button>
              ))}
            </div>

            {/* Bugün Hızlı Butonu */}
            <button
              type="button"
              onClick={() => {
                setSelectedDate(todayStr);
                setLcViewMode('daily');
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: safeDate === todayStr ? '1.5px solid #2563eb' : '1px solid var(--border-color)',
                background: safeDate === todayStr ? 'rgba(37, 99, 235, 0.14)' : 'var(--bg-primary)',
                color: safeDate === todayStr ? '#2563eb' : 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Bugün ({format(parseISO(todayStr), 'd MMM', { locale: tr })})
            </button>
          </div>

          {/* Orta: Tarih Gezgini */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                const base = parseISO(safeDate);
                const next = lcViewMode === 'monthly' ? addMonths(base, -1) : addDays(base, lcViewMode === 'weekly' ? -7 : -1);
                setSelectedDate(format(next, 'yyyy-MM-dd'));
              }}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <ChevronLeft size={16} />
            </button>

            <CustomDatePicker selectedDate={safeDate} onDateChange={(d) => setSelectedDate(d)}>
              <div style={{
                padding: '6px 14px',
                borderRadius: '10px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}>
                <Calendar size={14} color="var(--accent-primary)" />
                <span style={{ fontSize: '13.5px', fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                  {format(parseISO(safeDate), 'd MMMM yyyy EEEE', { locale: tr })}
                </span>
                {safeDate === todayStr && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 900,
                    padding: '1px 6px',
                    borderRadius: '999px',
                    background: '#10b981',
                    color: '#ffffff'
                  }}>
                    BUGÜN
                  </span>
                )}
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
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Sağ: Reklam Rezervasyondan Yenile + Logoları İşle + Toplam Süre + Listeyi Onayla */}
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
                padding: '6px 11px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '11.5px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Reklam Rezervasyondan iletilen güncel listeyi yeniden çek"
            >
              <RefreshCw size={13} />
              <span>Reklam Rezervasyondan Çek</span>
            </button>

            {programs.length > 0 && typeof applyChannelLogosToListControl === 'function' && (
              <button
                type="button"
                onClick={() => {
                  applyChannelLogosToListControl(selectedChannel, safeDate);
                  lcAddAuditLog({
                    channelId: selectedChannel,
                    date: safeDate,
                    actionType: 'info',
                    actionLabel: 'Kanal Yayın & Reklam Logoları İşlendi',
                    itemType: 'system',
                    itemTitle: `${channelName} Logoları`,
                    details: `Yayın Logo: ${adSettings?.[selectedChannel]?.broadcastLogoName || 'Varsayılan'} • Reklam Logo: ${adSettings?.[selectedChannel]?.adLogoName || 'Varsayılan'}`,
                    status: 'success'
                  });
                  useDialogStore.getState().showAlert(
                    'Logolar Listeye İşlendi',
                    `${channelName} kanalının Yayına Giriş ve Reklama Giriş logo isimleri listedeki tüm satırlara uygulandı.`
                  );
                }}
                style={{
                  padding: '6px 11px',
                  borderRadius: '8px',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#059669',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Logoları İşle
              </button>
            )}

            <div style={{
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              fontSize: '12px',
              fontFamily: 'monospace',
              fontWeight: 800
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>Toplam: </span>
              <span style={{ color: Math.abs(totalDurationSec - 86400) < 300 ? '#059669' : '#d97706' }}>
                {formatSecondsReadable(totalDurationSec)} / 24 sa
              </span>
            </div>

            <button
              type="button"
              onClick={handleApproveList}
              disabled={programs.length === 0}
              style={{
                padding: '7px 15px',
                borderRadius: '9px',
                border: 'none',
                background: isApproved
                  ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                  : 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 800,
                cursor: programs.length === 0 ? 'not-allowed' : 'pointer',
                opacity: programs.length === 0 ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
              }}
            >
              <Check size={14} />
              <span>{isApproved ? '✓ Liste Onaylandı' : 'Listeyi Onayla'}</span>
            </button>
          </div>
        </div>

        {/* İletilen / Hazır Günler Hızlı Geçiş Şeridi */}
        {availableTransmittedDates.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflowX: 'auto',
            paddingTop: '4px',
            borderTop: '1px dashed var(--border-color)',
            fontSize: '11px'
          }}>
            <span style={{ fontWeight: 800, color: 'var(--text-secondary)', flexShrink: 0 }}>
              Reklam Rezervasyondan İletilen / Hazır Günler:
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
                    padding: '3px 9px',
                    borderRadius: '999px',
                    border: isCurr ? '1.5px solid #2563eb' : '1px solid var(--border-color)',
                    background: isCurr ? 'rgba(37, 99, 235, 0.14)' : 'var(--bg-primary)',
                    color: isCurr ? '#2563eb' : 'var(--text-primary)',
                    fontSize: '11px',
                    fontWeight: isCurr ? 800 : 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <span>{format(parseISO(dStr), 'd MMM EEE', { locale: tr })}</span>
                  {isTod && <strong style={{ color: '#10b981' }}>(Bugün)</strong>}
                  {count > 0 && (
                    <span style={{
                      fontSize: '10px',
                      padding: '0 5px',
                      borderRadius: '999px',
                      background: isCurr ? '#2563eb' : 'var(--bg-tertiary)',
                      color: isCurr ? '#ffffff' : 'var(--text-secondary)'
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. ANA İÇERİK ALANI (GÜNLÜK / HAFTALIK / AYLIK / RAPORLAR & LOGLAR) */}
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
        /* GÜNLÜK (DAILY) ANA KONTROL EKRANI: SOLDA MEDYA/BÖLÜM/REKLAM KÜTÜPHANESİ + SAĞDA UYARILAR VE AKIŞ LİSTESİ */
        <div style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: 'flex',
          overflow: 'hidden'
        }}>
          {/* SOL PANEL: YAYIN PLANLAMA GİBİ ÇALIŞAN MEDYA, BÖLÜM VE REKLAM KÜTÜPHANESİ (DOLGU KUŞAĞI YOK) */}
          <ListControlSidebar
            selectedChannel={selectedChannel}
            selectedDate={safeDate}
            selectedItem={selectedItem}
            selectedIndex={selectedIndex}
            onReplaceSelected={(newPayload) => {
              if (!selectedItem) return;
              lcReplaceItem(selectedChannel, safeDate, activeVariant, selectedItem.instanceId, newPayload);
            }}
            onInsertItem={(newPayload, targetIdx) => {
              lcAddProgramToDay(selectedChannel, safeDate, activeVariant, newPayload, targetIdx);
            }}
            onOpenClipPreview={(clipObj) => setPreviewClip(clipObj)}
          />

          {/* SAĞ PANEL: UYARILAR & 3 AŞAMALI KONTROL MERKEZİ + FLEXBOX YAYIN VE REKLAM LİSTESİ */}
          <div style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Üst Uyarılar, Sorunlar, Taslak/Yayın Planlama/Reklam ve DB/Dosya/Bozukluk Kontrol Paneli */}
            <ListControlWarningsPanel
              stageAnalysis={stageAnalysis}
              healthMap={healthMap}
              programs={programs}
              issues={unifiedIssues}
              verifyingHealth={verifyingHealth}
              onRunDeepHealthCheck={() => runHealthVerification(true)}
              onFocusRow={handleFocusRow}
              onAddMissingDraftSlot={handleAddMissingDraftSlot}
              onRequestRevision={handleOpenRevisionModal}
              activeFilterCategory={activeFilterCategory}
              onSelectFilterCategory={setActiveFilterCategory}
            />

            {/* Akış Filtre & Arama Araç Çubuğu */}
            <div style={{
              padding: '8px 16px',
              background: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: `Tümü (${programs.length})` },
                  {
                    id: 'clips',
                    label: `🎬 Klipler (${programs.filter(p => !p.isAdClip && !p.isFromAds).length})`
                  },
                  {
                    id: 'ads',
                    label: `📢 Reklamlar (${programs.filter(p => p.isAdClip || p.isFromAds).length})`
                  },
                  {
                    id: 'broadcast_diff',
                    label: `🔄 Yayın Planlama Ek/Değişim (${(stageAnalysis?.addedByBroadcastItems?.length || 0) + (stageAnalysis?.modifiedByBroadcastItems?.length || 0)})`
                  },
                  {
                    id: 'errors_only',
                    label: `🔴 Hatalı DB/Dosya/Bozuk (${programs.filter(p => {
                      const h = healthMap[p.instanceId];
                      return (h && (!h.inDatabase || !h.fileExists || h.isCorrupted)) || p.isEmptyAdBreak;
                    }).length})`
                  },
                  {
                    id: 'revisions',
                    label: `⚠️ Revize İstendi (${programs.filter(p => p.revisionRequested).length})`
                  }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFilterCategory(f.id)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '8px',
                      border: activeFilterCategory === f.id ? 'none' : '1px solid var(--border-color)',
                      background: activeFilterCategory === f.id ? 'var(--accent-primary)' : 'var(--bg-primary)',
                      color: activeFilterCategory === f.id ? '#ffffff' : 'var(--text-secondary)',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={13} color="var(--text-muted)" style={{ position: 'absolute', left: '9px', top: '8px' }} />
                  <input
                    type="text"
                    value={rundownSearch}
                    onChange={(e) => setRundownSearch(e.target.value)}
                    placeholder="Listede klip, reklam, firma veya kod ara..."
                    style={{
                      padding: '5px 24px 5px 28px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none',
                      width: '240px'
                    }}
                  />
                  {rundownSearch && (
                    <button
                      type="button"
                      onClick={() => setRundownSearch('')}
                      style={{
                        position: 'absolute',
                        right: '6px',
                        top: '6px',
                        border: 'none',
                        background: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleOpenRevisionModal({
                      title: `${channelName} (${safeDate}) Genel Yayın & Reklam Listesi`,
                      code: safeDate,
                      durationSec: totalDurationSec,
                      isAdClip: false
                    })
                  }
                  style={{
                    padding: '5px 11px',
                    borderRadius: '8px',
                    border: '1px solid rgba(217, 119, 6, 0.45)',
                    background: 'rgba(217, 119, 6, 0.12)',
                    color: '#d97706',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Send size={12} />
                  <span>Genel Revize İste</span>
                </button>
              </div>
            </div>

            {/* ANA AKIŞ LİSTESİ (FLEXBOX SATIRLARI) */}
            <div style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              {programs.length === 0 ? (
                <div style={{
                  margin: 'auto',
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
                    Reklam Rezervasyon modülünden tamamlanıp iletilen listeler burada otomatik olarak açılır.
                    Yukarıdaki <strong>"Reklam Rezervasyondan İletilen / Hazır Günler"</strong> şeridinden hazır bir güne geçebilir,
                    <strong>"Reklam Rezervasyondan Çek"</strong> butonuna tıklayabilir veya sol paneldeki kütüphaneden doğrudan klip ve reklam ekleyebilirsiniz.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
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
                </div>
              ) : filteredProgramsWithIndex.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
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
                      health={healthMap[item.instanceId]}
                      stageInfo={stageAnalysis?.itemVerificationMap?.[item.instanceId]}
                      rowRef={(el) => {
                        if (el) rowRefs.current[item.instanceId] = el;
                      }}
                      onSelectRow={(clickedItem) => setSelectedInstanceId(clickedItem.instanceId)}
                      onUpdateDurationSec={(instId, newSec) =>
                        lcUpdateItemDurationSec(selectedChannel, safeDate, activeVariant, instId, newSec)
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
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. KLİP & REKLAM VİDEO İZLEME VE VERİTABANI KÜNYE MODALI (ⓘ İZLE & BİLGİ) */}
      <ClipDetailMetadataModal
        isOpen={Boolean(previewClip)}
        onClose={() => setPreviewClip(null)}
        clip={previewClip}
      />

      {/* 4. AKILLI REVİZE İSTEME MODALI (KLİP -> TASLAK / YAYIN PLANLAMA SEÇİMİ, REKLAM -> REKLAM REZERVASYON) */}
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
