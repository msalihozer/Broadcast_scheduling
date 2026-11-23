/**
 * @file DraftPlanningModule.jsx
 * @description Taslak Planlama (Draft) Modülü Ana Koordinatör Bileşeni.
 * 
 * Modüler Yapı:
 * - useDraftSchedule: Kanal yönetimi, backend senkronizasyonu, undo (Ctrl+Z) ve CRUD
 * - useDraftSelection: Seçim durumları, çoklu seçim ve Shift + Tıklama aralık seçimi
 * - useDraftClipboard: Kopyalama (Ctrl+C) ve Yapıştırma (Ctrl+V) mantığı
 * - useDraftExcelImport: Excel dosyalarından haftalık ve tek günlük akış aktarımı
 * - useDraftKeyboardShortcuts: Kısayol yöneticisi (Ctrl+S, Ctrl+C, Ctrl+V, Ctrl+Z, Del vb.)
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { AlertCircle, Check, Search, X } from 'lucide-react';

import { AVAILABLE_PRESETS } from './constants/draftPresets';
import {
  useDraftSchedule,
  useDraftSelection,
  useDraftClipboard,
  useDraftExcelImport,
  useDraftKeyboardShortcuts
} from './hooks';

import DraftHeader from './components/DraftHeader';
import DraftDayFilter from './components/DraftDayFilter';
import DraftGridView from './components/DraftGridView';
import DraftRundownTable from './components/DraftRundownTable';
import DraftProgramModal from './components/DraftProgramModal';
import DraftCalendarNavigator from './components/DraftCalendarNavigator';
import DraftExcelImportModal from './components/DraftExcelImportModal';
import DraftBulkActionBar from './components/DraftBulkActionBar';
import DraftShortcutsModal from './components/DraftShortcutsModal';
import DraftReportsModal from './components/DraftReportsModal';
import DraftLibrarySidebar from './components/DraftLibrarySidebar';
import DraftAddScheduleModal from './components/DraftAddScheduleModal';
import DraftSendToBroadcastModal from './components/DraftSendToBroadcastModal';
import { useNavigate } from 'react-router-dom';

export { AVAILABLE_PRESETS };

const DraftPlanningModule = () => {
  // 1. Planlama ve Yayın Akışı Durum Yönetimi (Hook)
  const {
    selectedChannel,
    setSelectedChannel,
    channels,
    currentChannel,
    scheduleData,
    setScheduleData,
    saveStatus,
    setSaveStatus,
    toastNotification,
    showToast,
    undo,
    allDaysKeys,
    activeDaysKeys,
    selectedDayKey,
    setSelectedDayKey,
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    filterProgram,
    dateRangeLabel,
    availableDaysList,
    recalculateDayTimes,
    handleSaveSchedule,
    handleDeleteProgram,
    handleDeleteSelectedPrograms,
    handleDuplicateProgram,
    handleDuplicateSelectedPrograms,
    handleReorderPrograms,
    handleMoveProgramOrder,
    handleUpdateProgram,
    handleToggleOption,
    handleClearSchedule,
    handleRestoreDefault,
    handlePrevWeek,
    handleNextWeek,
    handleSelectWeek,
    handleSelectDay,
    handleSwitchPreset,
    allSchedulesMap,
    createEmptyWeek,
    hasPrograms,
    schedulesByChannel,
    setSchedulesByChannel
  } = useDraftSchedule();

  // Her kanal için aktif haftada liste yüklü olup olmadığını hesapla (Yüklü değilse turuncu gösterilir)
  const channelHasListMap = useMemo(() => {
    const map = {};
    (channels || []).forEach(ch => {
      const chMap = schedulesByChannel?.[ch.id] || {};
      const hasAnyInWeek = (allDaysKeys || []).some(dKey => {
        const dayProgs = chMap[dKey]?.programs;
        return Array.isArray(dayProgs) && dayProgs.length > 0;
      });
      map[ch.id] = hasAnyInWeek;
    });
    return map;
  }, [channels, schedulesByChannel, allDaysKeys]);

  // 2. Program Seçimi ve Shift + Tıklama Yönetimi (Hook)
  const {
    selectedProgramIds,
    setSelectedProgramIds,
    setSelectedProgramMap,
    selectedProgram,
    setSelectedProgram,
    selectedList,
    lastClickedRef,
    handleToggleSelectProgram,
    handleSelectAllDay,
    selectAllVisible,
    handleClearSelection
  } = useDraftSelection(scheduleData, showToast);

  // 3. Kopyalama (Ctrl+C) ve Yapıştırma (Ctrl+V) Yönetimi (Hook)
  const { copySelected, pasteFromClipboard } = useDraftClipboard({
    scheduleData,
    setScheduleData,
    recalculateDayTimes,
    selectedList,
    selectedDayKey,
    allDaysKeys,
    setSelectedProgramIds,
    setSelectedProgramMap,
    showToast,
    lastClickedRef
  });

  // Modal Açılış Durumları
  const navigate = useNavigate();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);
  const [addScheduleModalData, setAddScheduleModalData] = useState(null);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [sendModalPreselectedDayKey, setSendModalPreselectedDayKey] = useState(null);
  const [sendModalPreselectedPrograms, setSendModalPreselectedPrograms] = useState(null);

  const handleOpenSendModal = useCallback((dayKey = null, programs = null) => {
    setSendModalPreselectedDayKey(dayKey);
    setSendModalPreselectedPrograms(programs);
    setIsSendModalOpen(true);
  }, []);

  // Raporları ayrı pencerede (/draft-reports) aç; tarayıcı popup engellerse modal olarak aç
  const handleOpenReportsWindow = useCallback(() => {
    try {
      const weekParam = allDaysKeys?.[0] || '';
      const url = `/draft-reports?channel=${encodeURIComponent(selectedChannel)}&week=${encodeURIComponent(weekParam)}`;
      const win = window.open(
        url,
        'TaslakRaporlarPenceresi',
        'width=1540,height=940,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
      );
      if (win) {
        win.focus();
        return;
      }
    } catch (e) {}
    setIsReportsOpen(true);
  }, [selectedChannel, allDaysKeys]);

  // Üst Header (TopNavbar) içindeki Kısayollar ve Raporlar butonlarını dinle
  useEffect(() => {
    const onOpenShortcutsEvent = () => setIsShortcutsOpen(true);
    const onOpenReportsEvent = () => handleOpenReportsWindow();
    const onToggleLibraryEvent = () => setIsLibraryOpen(prev => !prev);
    window.addEventListener('draft:open-shortcuts', onOpenShortcutsEvent);
    window.addEventListener('draft:open-reports', onOpenReportsEvent);
    window.addEventListener('draft:toggle-library', onToggleLibraryEvent);
    return () => {
      window.removeEventListener('draft:open-shortcuts', onOpenShortcutsEvent);
      window.removeEventListener('draft:open-reports', onOpenReportsEvent);
      window.removeEventListener('draft:toggle-library', onToggleLibraryEvent);
    };
  }, [handleOpenReportsWindow]);

  // 4. Excel İçe Aktarma Yönetimi (Hook)
  const {
    isImportModalOpen,
    setIsImportModalOpen,
    isImporting,
    handleExecuteImport
  } = useDraftExcelImport({
    channels,
    setSchedulesByChannel,
    setSaveStatus,
    createEmptyWeek,
    setSelectedDayKey,
    handleSelectWeek,
    showToast
  });

  // Seçili gündeki mevcut programlara göre sıradaki uygun başlangıç dakikasını hesapla
  const resolveDefaultSlotMinuteForDay = useCallback((dateKey, targetSlotMinute = null, targetProgIndex = null) => {
    if (targetSlotMinute !== null && targetSlotMinute !== undefined) {
      return targetSlotMinute;
    }
    const dayProgs = scheduleData?.[dateKey]?.programs || [];
    if (targetProgIndex !== null && targetProgIndex !== undefined && dayProgs[targetProgIndex]) {
      const targetProg = dayProgs[targetProgIndex];
      if (typeof targetProg.startMinute === 'number') return targetProg.startMinute;
      if (targetProg.startTime) {
        const [h, m] = targetProg.startTime.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      }
    }
    if (dayProgs.length > 0) {
      const lastProg = dayProgs[dayProgs.length - 1];
      let endMin = lastProg.endMinute;
      if (typeof endMin !== 'number' && lastProg.endTime) {
        const [eh, em] = lastProg.endTime.split(':').map(Number);
        endMin = (eh || 0) * 60 + (em || 0);
      }
      if (typeof endMin === 'number' && endMin < 1440) {
        return endMin;
      }
    }
    return 0;
  }, [scheduleData]);

  // Sol Kütüphaneden sürükle-bırak yapıldığında veya boş kuşağa tıklanıp eklendiğinde açılan akıllı modal tetikleyicisi
  const handleOpenAddScheduleModal = useCallback(({
    programData = null,
    targetDays,
    targetSlotMinute = null,
    targetProgIndex = null
  }) => {
    const resolvedDateKey = (targetDays && targetDays[0]) || (selectedDayKey && selectedDayKey !== 'all' ? selectedDayKey : allDaysKeys[0]);
    const resolvedMinute = resolveDefaultSlotMinuteForDay(resolvedDateKey, targetSlotMinute, targetProgIndex);
    setAddScheduleModalData({
      program: programData || null,
      dateKey: resolvedDateKey,
      slotMinute: resolvedMinute,
      progIndex: targetProgIndex
    });
  }, [selectedDayKey, allDaysKeys, resolveDefaultSlotMinuteForDay]);

  // Sol panelden doğrudan "+ Ekle" tıklandığında aç
  const handleOpenAddModalFromSidebar = useCallback((prog) => {
    if (!prog) return;
    const resolvedDateKey = selectedDayKey && selectedDayKey !== 'all' ? selectedDayKey : allDaysKeys[0];
    const resolvedMinute = resolveDefaultSlotMinuteForDay(resolvedDateKey, null, null);
    setAddScheduleModalData({
      program: prog,
      dateKey: resolvedDateKey,
      slotMinute: resolvedMinute,
      progIndex: null
    });
  }, [selectedDayKey, allDaysKeys, resolveDefaultSlotMinuteForDay]);

  // Akıllı Modaldan Onay Alındığında (Çoklu gün ve ardışık bölüm artışı destekli)
  const handleConfirmAddSchedule = useCallback((configs) => {
    if (!configs || configs.length === 0) return;

    const TR_DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const getDayName = (dateStr) => {
      try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          return TR_DAYS[d.getDay()];
        }
      } catch (e) {}
      return 'Gün';
    };

    setScheduleData(prev => {
      const nextSchedule = { ...prev };

      configs.forEach(cfg => {
        const dateKey = cfg.dateKey;
        const existingDay = nextSchedule[dateKey] || {
          date: dateKey,
          dayName: getDayName(dateKey),
          programs: []
        };
        const currentProgs = [...(existingDay.programs || [])];

        let insertIdx = currentProgs.length;
        if (cfg.targetProgIndex !== null && cfg.targetProgIndex !== undefined && cfg.targetProgIndex >= 0 && cfg.targetProgIndex <= currentProgs.length) {
          insertIdx = cfg.targetProgIndex;
        } else if (cfg.targetSlotMinute !== null && cfg.targetSlotMinute !== undefined) {
          const found = currentProgs.findIndex(p => {
            let sm = p.startMinute;
            if (typeof sm !== 'number' && p.startTime) {
              const [h, m] = p.startTime.split(':').map(Number);
              sm = (h || 0) * 60 + (m || 0);
            }
            return (sm || 0) >= cfg.targetSlotMinute;
          });
          insertIdx = found !== -1 ? found : currentProgs.length;
        }

        // Önceki programın bitiş dakikasını bul; eğer kullanıcı ileri bir boş saate (örn: 06:00) tıkladıysa o saate sabitle
        let prevEndMin = 0;
        if (insertIdx > 0 && currentProgs[insertIdx - 1]) {
          const prevP = currentProgs[insertIdx - 1];
          if (typeof prevP.endMinute === 'number') {
            prevEndMin = prevP.endMinute;
          } else if (prevP.endTime) {
            const [eh, em] = prevP.endTime.split(':').map(Number);
            prevEndMin = (eh || 0) * 60 + (em || 0);
          }
        }

        const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
        const newProgram = {
          ...cfg.programData,
          id: `prog_${dateKey}_${uniqueSuffix}`,
          instanceId: `inst_${dateKey}_${uniqueSuffix}`
        };

        if (
          typeof cfg.targetSlotMinute === 'number' &&
          cfg.targetSlotMinute > prevEndMin
        ) {
          newProgram.anchorStartMinute = cfg.targetSlotMinute;
        }

        currentProgs.splice(insertIdx, 0, newProgram);

        nextSchedule[dateKey] = {
          ...existingDay,
          programs: recalculateDayTimes(currentProgs)
        };
      });

      return nextSchedule;
    }, `${configs[0]?.programData?.title} ${configs.length} güne eklendi`);

    const count = configs.length;
    const title = configs[0]?.programData?.title || 'Program';
    showToast(`"${title}" ${count === 1 ? 'akışa' : `${count} güne`} başarıyla eklendi.`, 'success', 2500);
  }, [setScheduleData, recalculateDayTimes, showToast]);

  // 5. Global Klavye Kısayolları (Ctrl+S, Ctrl+C, Ctrl+V, Ctrl+Z, Delete vb.)
  useDraftKeyboardShortcuts({
    handleSaveSchedule,
    copySelected,
    pasteFromClipboard,
    undo,
    selectedProgramIds,
    selectedList,
    handleDeleteSelectedPrograms,
    handleClearSelection,
    selectAllVisible,
    activeDaysKeys,
    allDaysKeys,
    setViewMode,
    setSelectedDayKey,
    setIsShortcutsOpen,
    setIsImportModalOpen,
    setIsCalendarOpen,
    setIsQuotaModalOpen: setIsReportsOpen,
    setSelectedProgram,
    isShortcutsOpen,
    isQuotaModalOpen: isReportsOpen,
    isCalendarOpen,
    isImportModalOpen,
    selectedProgram
  });

  return (
    <div style={{
      width: '100%',
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)'
    }}>
      {/* 1. ÜST KONTROL & BİLGİ ALANI */}
      <div style={{
        padding: '16px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <DraftHeader
          currentChannel={currentChannel}
          channels={channels}
          selectedChannel={selectedChannel}
          onSelectChannel={setSelectedChannel}
          channelHasListMap={channelHasListMap}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          isImporting={isImporting}
          dateRangeLabel={dateRangeLabel}
          onClearSchedule={handleClearSchedule}
          hasPrograms={hasPrograms}
          selectedDayKey={selectedDayKey}
          onOpenCalendar={() => setIsCalendarOpen(true)}
          onPrevWeek={handlePrevWeek}
          onNextWeek={handleNextWeek}
          onOpenImportModal={() => setIsImportModalOpen(true)}
          onSaveSchedule={handleSaveSchedule}
          saveStatus={saveStatus}
          isLibraryOpen={isLibraryOpen}
          onToggleLibrary={() => setIsLibraryOpen(prev => !prev)}
          onOpenSendModal={() => handleOpenSendModal(selectedDayKey !== 'all' ? selectedDayKey : null, null)}
          onOpenReports={handleOpenReportsWindow}
        />

        <DraftDayFilter
          scheduleData={scheduleData}
          selectedDayKey={selectedDayKey}
          onSelectDay={setSelectedDayKey}
          dateRangeLabel={dateRangeLabel}
        />

        {/* Günlerin Altında Ortada Sabitlenmiş Arama Alanı */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '7px 14px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <Search size={14} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Program adı, sunucu, bölüm veya saat ara..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: 600,
                outline: 'none',
                width: '100%'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--text-muted)'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. ANA İÇERİK ALANI (Sol Kütüphane Paneli + Sağ Yayın Akışı) */}
      <div style={{
        width: '100%',
        padding: isLibraryOpen ? '16px 20px 40px 20px' : '16px 16px 40px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: isLibraryOpen ? '16px' : '0px',
        boxSizing: 'border-box'
      }}>
        {/* Sol Kütüphane & Hızlı Dolgu Kuşağı Paneli */}
        <DraftLibrarySidebar
          isOpen={isLibraryOpen}
          onToggle={() => setIsLibraryOpen(prev => !prev)}
          onOpenAddModal={handleOpenAddModalFromSidebar}
        />

        {/* Sağ Yayın Akışı Görünümü */}
        <div style={{ flex: 1, minWidth: 0, width: '100%', overflow: 'hidden' }}>
          {viewMode === 'grid' ? (
            <DraftGridView
              activeDaysKeys={activeDaysKeys}
              scheduleData={scheduleData}
              filterProgram={filterProgram}
              searchQuery={searchQuery}
              selectedProgramIds={selectedProgramIds}
              onSelectProgram={setSelectedProgram}
              onToggleOption={handleToggleOption}
              onToggleSelect={handleToggleSelectProgram}
              onSelectAllDay={handleSelectAllDay}
              onReorderPrograms={handleReorderPrograms}
              onMoveProgramOrder={handleMoveProgramOrder}
              onDuplicateProgram={handleDuplicateProgram}
              onDeleteProgram={handleDeleteProgram}
              onAddLibraryProgram={handleOpenAddScheduleModal}
              isLibraryOpen={isLibraryOpen}
              onSendDayToBroadcast={(dayKey) => handleOpenSendModal(dayKey, null)}
            />
          ) : (
            <DraftRundownTable
              activeDaysKeys={activeDaysKeys}
              scheduleData={scheduleData}
              filterProgram={filterProgram}
              searchQuery={searchQuery}
              selectedProgramIds={selectedProgramIds}
              onSelectProgram={setSelectedProgram}
              onToggleOption={handleToggleOption}
              onToggleSelect={handleToggleSelectProgram}
              onSelectAllDay={handleSelectAllDay}
              onReorderPrograms={handleReorderPrograms}
              onMoveProgramOrder={handleMoveProgramOrder}
              onDuplicateProgram={handleDuplicateProgram}
              onDeleteProgram={handleDeleteProgram}
              onAddLibraryProgram={handleOpenAddScheduleModal}
              isLibraryOpen={isLibraryOpen}
              onSendDayToBroadcast={(dayKey) => handleOpenSendModal(dayKey, null)}
            />
          )}
        </div>
      </div>

      {/* 3. AKILLI AKIŞA EKLEME & BÖLÜM DAĞITIM MODALI */}
      <DraftAddScheduleModal
        isOpen={!!addScheduleModalData}
        onClose={() => setAddScheduleModalData(null)}
        data={addScheduleModalData}
        scheduleData={scheduleData}
        allDaysKeys={allDaysKeys}
        activeDaysKeys={activeDaysKeys}
        onConfirmAdd={handleConfirmAddSchedule}
      />

      {/* 4. PROGRAM DETAY / OPSİYON VE DÜZENLEME MODALI */}
      <DraftProgramModal
        selectedProgram={selectedProgram}
        onClose={() => setSelectedProgram(null)}
        onToggleOption={handleToggleOption}
        onUpdateProgram={handleUpdateProgram}
        onDuplicateProgram={handleDuplicateProgram}
        onDeleteProgram={handleDeleteProgram}
      />

      {/* 4. TAKVİM & HAFTA GEZGİNİ MODALI */}
      <DraftCalendarNavigator
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        currentWeekKeys={allDaysKeys}
        selectedDayKey={selectedDayKey}
        onSelectWeek={handleSelectWeek}
        onSelectDay={handleSelectDay}
        allSchedules={allSchedulesMap}
        availablePresets={AVAILABLE_PRESETS}
        onSwitchPreset={handleSwitchPreset}
      />

      {/* 5. EXCEL İÇE AKTARMA MODALI */}
      <DraftExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        channels={channels}
        activeChannelId={selectedChannel}
        currentWeekStartDate={allDaysKeys[0]}
        onExecuteImport={handleExecuteImport}
        isImporting={isImporting}
      />

      {/* 6. TOPLU İŞLEM ÇUBUĞU (KOPYALAMA & SİLME) */}
      <DraftBulkActionBar
        selectedCount={selectedProgramIds.length}
        selectedList={selectedList}
        availableDays={availableDaysList}
        onClearSelection={handleClearSelection}
        onDeleteSelected={handleDeleteSelectedPrograms}
        onDuplicateSelected={handleDuplicateSelectedPrograms}
        onSendSelectedToBroadcast={(selectedProgs) => handleOpenSendModal(null, selectedProgs)}
      />

      {/* 7. TASLAĞI YAYINA GÖNDERME MODALI */}
      <DraftSendToBroadcastModal
        isOpen={isSendModalOpen}
        onClose={() => {
          setIsSendModalOpen(false);
          setSendModalPreselectedDayKey(null);
          setSendModalPreselectedPrograms(null);
        }}
        selectedChannel={selectedChannel}
        channels={channels}
        currentChannel={currentChannel}
        scheduleData={scheduleData}
        selectedDayKey={selectedDayKey}
        allDaysKeys={allDaysKeys}
        dateRangeLabel={dateRangeLabel}
        preselectedDayKey={sendModalPreselectedDayKey}
        preselectedPrograms={sendModalPreselectedPrograms}
        onSaveSchedule={handleSaveSchedule}
        showToast={showToast}
        navigate={navigate}
      />

      {/* 8. KLAVYE KISAYOLLARI REHBERİ MODALI */}
      <DraftShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* 8. TASLAK YAYIN AKIŞI RAPORLARI MODALI */}
      <DraftReportsModal
        isOpen={isReportsOpen}
        onClose={() => setIsReportsOpen(false)}
        scheduleData={scheduleData}
        allChannelSchedule={schedulesByChannel?.[selectedChannel] || scheduleData}
        selectedChannel={selectedChannel}
        onSelectChannel={setSelectedChannel}
        channels={channels}
        currentChannel={currentChannel}
        dateRangeLabel={dateRangeLabel}
        activeWeekDates={allDaysKeys}
      />

      {/* 9. KAYDETME & BİLGİLENDİRME TOAST BİLDİRİMİ */}
      {toastNotification && (
        <div style={{
          position: 'fixed',
          bottom: '28px',
          right: '28px',
          background: toastNotification.type === 'error'
            ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
            : toastNotification.type === 'info'
            ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
            : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px',
          fontWeight: 700,
          zIndex: 10000,
          pointerEvents: 'none',
          animation: 'fadeInUp 0.2s ease-out'
        }}>
          {toastNotification.type === 'error' ? (
            <AlertCircle size={18} />
          ) : (
            <Check size={18} />
          )}
          <span>{toastNotification.message}</span>
        </div>
      )}
    </div>
  );
};

export default DraftPlanningModule;
