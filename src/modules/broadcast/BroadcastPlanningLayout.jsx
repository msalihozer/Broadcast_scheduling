/**
 * @file src/modules/broadcast/BroadcastPlanningLayout.jsx
 * @description Kesinleşen Yayın Planlama (Ready / Broadcast) Modülünün Ana Düzen Bileşeni.
 *
 * Temel Sorumluluklar:
 * 1. Üst kontrol çubuğu (BroadcastHeader) ile kanal (Semerkand HD / WAY), Liste (A / B), tarih ve görünüm (Günlük / Haftalık / Aylık) yönetimi.
 * 2. Günlük (BroadcastDayView), Haftalık (BroadcastWeekView) ve Aylık (BroadcastMonthView) akış ekranları arasında geçiş.
 * 3. Program ekleme, reklam kuşağı ekleme, öğe düzenleme ve klavye kısayol modallarının koordinasyonu.
 * 4. useBroadcastKeyboardShortcuts ile global klavye kısayollarının (G, H, A, R, T, Ctrl+C/V/Z, Delete vb.) bağlanması.
 */
import React, { useState, useEffect } from 'react';
import useBroadcastStore from './store/broadcastStore';
import { fetchAndSyncDraftSchedule, updateLiveDraftSchedule } from './utils/draftDataLoader';
import BroadcastHeader from './components/BroadcastHeader';
import BroadcastDayView from './components/BroadcastDayView';
import BroadcastWeekView from './components/BroadcastWeekView';
import BroadcastMonthView from './components/BroadcastMonthView';
import BroadcastReportsView from './components/BroadcastReportsView';
import AddBroadcastProgramModal from './components/AddBroadcastProgramModal';
import EditBroadcastProgramModal from './components/EditBroadcastProgramModal';
import AddAdBreakModal from './components/AddAdBreakModal';
import DefaultIntroSettingsModal from './components/DefaultIntroSettingsModal';
import BroadcastShortcutsModal from './components/BroadcastShortcutsModal';
import { useBroadcastKeyboardShortcuts } from './hooks/useBroadcastKeyboardShortcuts';

const BroadcastPlanningLayout = () => {
  const {
    viewMode,
    selectedChannel,
    selectedDate,
    activeList,
    pullFromDraft,
    addAdBreak,
    setActiveSidebarTab,
    notifyDraftUpdated
  } = useBroadcastStore();

  // Taslak Planlama modülündeki güncellemeleri gerçek zamanlı senkronize et
  useEffect(() => {
    let isMounted = true;

    const syncFromBackend = async () => {
      await fetchAndSyncDraftSchedule(selectedChannel);
      if (isMounted) {
        notifyDraftUpdated(selectedChannel);
      }
    };

    syncFromBackend();

    const handleDraftUpdatedEvent = (e) => {
      const ch = e?.detail?.channelId || selectedChannel;
      notifyDraftUpdated(ch);
    };

    const handleStorageEvent = (e) => {
      if (e.key && e.key.startsWith('draft_schedule_')) {
        const ch = e.key.replace('draft_schedule_', '');
        try {
          if (e.newValue) {
            updateLiveDraftSchedule(ch, JSON.parse(e.newValue));
          }
        } catch (err) {}
        notifyDraftUpdated(ch);
      }
    };

    const handleWindowFocus = () => {
      syncFromBackend();
    };

    window.addEventListener('draft-schedule-updated', handleDraftUpdatedEvent);
    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      isMounted = false;
      window.removeEventListener('draft-schedule-updated', handleDraftUpdatedEvent);
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [selectedChannel, notifyDraftUpdated]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdBreakModalOpen, setIsAdBreakModalOpen] = useState(false);
  const [isIntroSettingsModalOpen, setIsIntroSettingsModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);

  const isAnyModalOpen = isAddModalOpen || isAdBreakModalOpen || isIntroSettingsModalOpen || isShortcutsModalOpen || !!editingProgram;

  // Reklam Kuşağını dakika sormadan doğrudan akışa ekler (sonradan satır üzerinden düzenlenebilir)
  const handleQuickAddAdBreak = () => {
    addAdBreak(selectedChannel, selectedDate, activeList);
  };

  // Klavye Kısayolları Hook'u (Taslak planlamadaki gibi)
  useBroadcastKeyboardShortcuts({
    setIsAdBreakModalOpen,
    setIsShortcutsModalOpen,
    setIsAddProgramModalOpen: setIsAddModalOpen,
    isAnyModalOpen
  });

  const handlePullDraft = () => {
    const res = pullFromDraft(selectedChannel, selectedDate, activeList);
    if (res.success) {
      alert(`✓ O günün taslağındaki ${res.count} program başarıyla Liste ${activeList} akışına aktarıldı.`);
    } else {
      alert('Bu gün için taslakta aktarılacak program bulunamadı.');
    }
  };

  const handleOpenClipSearch = () => {
    setActiveSidebarTab('clip_search');
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      overflow: 'hidden'
    }}>
      {/* Üst Yönetim Çubuğu */}
      <BroadcastHeader
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenAdModal={handleQuickAddAdBreak}
        onOpenAdSettingsModal={() => setIsAdBreakModalOpen(true)}
        onOpenIntroSettingsModal={() => setIsIntroSettingsModalOpen(true)}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        onOpenClipSearch={handleOpenClipSearch}
        onPullDraft={handlePullDraft}
      />

      {/* Ana Görünüm Alanı */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          height: '100%',
          overflowY: viewMode === 'reports' ? 'auto' : 'hidden',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {viewMode === 'daily' && (
          <BroadcastDayView
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onOpenAdModal={handleQuickAddAdBreak}
            onOpenClipSearch={handleOpenClipSearch}
            onEditProgram={(prog) => setEditingProgram(prog)}
            onPullDraft={handlePullDraft}
          />
        )}

        {viewMode === 'weekly' && (
          <BroadcastWeekView />
        )}

        {viewMode === 'monthly' && (
          <BroadcastMonthView />
        )}

        {viewMode === 'reports' && (
          <BroadcastReportsView />
        )}
      </div>

      {/* Program Ekleme Modalı */}
      <AddBroadcastProgramModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Reklam Kuşağı Ekleme Modalı (R) */}
      <AddAdBreakModal
        isOpen={isAdBreakModalOpen}
        onClose={() => setIsAdBreakModalOpen(false)}
      />

      {/* Varsayılan İntro Ayarları Modalı */}
      <DefaultIntroSettingsModal
        isOpen={isIntroSettingsModalOpen}
        onClose={() => setIsIntroSettingsModalOpen(false)}
      />

      {/* Klavye Kısayolları Modalı (? / K) */}
      <BroadcastShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Program / Klip Düzenleme Modalı */}
      <EditBroadcastProgramModal
        isOpen={!!editingProgram}
        onClose={() => setEditingProgram(null)}
        program={editingProgram}
      />
    </div>
  );
};

export default BroadcastPlanningLayout;
