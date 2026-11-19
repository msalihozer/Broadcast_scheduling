/**
 * @file src/modules/broadcast/components/BroadcastHeader.jsx
 * @description Yayın Planlama modülü üst kontrol ve navigasyon çubuğu.
 *
 * Yerleşim Düzeni:
 * - Sol Üst: Modüller, Taslak Paneli Aç/Kapat ve Tarih Seçme Alanı (< | Tarih | > | Bugün)
 * - Orta Üst: Üstte Kanal Seçimi (Semerkand HD / Semerkand WAY), hemen altında Liste Seçimi (Liste A / Liste B)
 * - Sağ Üst: Görünüm Seçimi (Günlük / Haftalık / Aylık) ve Çark (⚙️) İşlemler & Kısayollar Menüsü
 */
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Trash2,
  CalendarDays,
  CalendarRange,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Keyboard,
  Settings,
  Megaphone,
  Sparkles,
  ClipboardPaste,
  ArrowUpToLine,
  CornerDownRight,
  ArrowDownToLine,
  BarChart3,
  X
} from 'lucide-react';
import useBroadcastStore, { BROADCAST_CHANNELS } from '../store/broadcastStore';
import { dialog } from '../../../store/dialogStore';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

const BroadcastHeader = ({ onOpenShortcuts, onOpenAdSettingsModal, onOpenIntroSettingsModal }) => {
  const navigate = useNavigate();
  const [isGearMenuOpen, setIsGearMenuOpen] = useState(false);
  const [isClipboardOpen, setIsClipboardOpen] = useState(false);
  const gearMenuRef = useRef(null);
  const clipboardMenuRef = useRef(null);

  const {
    selectedChannel,
    setSelectedChannel,
    selectedDate,
    setSelectedDate,
    navigateDay,
    goToToday,
    activeList,
    setActiveList,
    copyList,
    clearList,
    copyProgramsToClipboard,
    pasteClipboardItems,
    pasteClipboardHistoryEntry,
    selectClipboardHistoryEntry,
    removeClipboardHistoryEntry,
    clearClipboard,
    clipboardItems,
    clipboardMeta,
    clipboardHistory,
    introDefaultSettings,
    toggleAutoInsertIntro,
    selectedInstanceId,
    getRawDayPrograms,
    viewMode,
    setViewMode,
    isDraftSidebarOpen,
    toggleDraftSidebar
  } = useBroadcastStore();

  useEffect(() => {
    const handleClickOutside = e => {
      if (gearMenuRef.current && !gearMenuRef.current.contains(e.target)) {
        setIsGearMenuOpen(false);
      }
      if (clipboardMenuRef.current && !clipboardMenuRef.current.contains(e.target)) {
        setIsClipboardOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const dayName = React.useMemo(() => {
    try {
      const d = parseISO(selectedDate);
      return format(d, 'EEEE', { locale: tr });
    } catch (e) {
      return '';
    }
  }, [selectedDate]);

  const currentChannelObj =
    BROADCAST_CHANNELS.find(c => c.id === selectedChannel) || BROADCAST_CHANNELS[0];
  const targetCopyList = activeList === 'A' ? 'B' : 'A';
  const currentPrograms = getRawDayPrograms(selectedChannel, selectedDate, activeList) || [];

  const activeClipboardCount = Array.isArray(clipboardItems) ? clipboardItems.length : 0;
  const recentHistory = Array.isArray(clipboardHistory) ? clipboardHistory.slice(0, 5) : [];
  const hasClipboardData = activeClipboardCount > 0 || recentHistory.length > 0;

  const handlePasteFromHeader = async (mode) => {
    if (activeClipboardCount === 0) return;
    if (mode === 'replace' && currentPrograms.length > 0) {
      const ok = await dialog.confirm(
        'Listeyi Bu Güne Uygula',
        `Mevcut ${currentPrograms.length} öğenin yerine panodaki ${activeClipboardCount} öğeyi uygulamak istiyor musunuz?\nHedef: ${selectedDate} (Liste ${activeList})`,
        {
          confirmText: 'Evet, Uygula',
          cancelText: 'Vazgeç'
        }
      );
      if (!ok) return;
    }
    pasteClipboardItems(selectedChannel, selectedDate, activeList, mode, selectedInstanceId);
    setIsClipboardOpen(false);
  };

  const handlePasteHistoryItem = (entryId, mode = null) => {
    pasteClipboardHistoryEntry(entryId, selectedChannel, selectedDate, activeList, mode);
    setIsClipboardOpen(false);
  };

  const handleCopyListVariant = async () => {
    setIsGearMenuOpen(false);
    const ok = await dialog.confirm(
      `Liste ${activeList} → Liste ${targetCopyList} Kopyalama`,
      `"Liste ${activeList}" akışındaki tüm programları "Liste ${targetCopyList}" içerisine kopyalamak istiyor musunuz?\nTarih: ${selectedDate}\nKanal: ${currentChannelObj.name}`,
      {
        confirmText: `Evet, Liste ${targetCopyList}'ye Kopyala`,
        cancelText: 'Vazgeç'
      }
    );
    if (ok) {
      copyList(selectedChannel, selectedDate, activeList, targetCopyList);
      dialog.success(
        'Liste Kopyalandı',
        `"Liste ${activeList}" içeriği başarıyla "Liste ${targetCopyList}" içerisine kopyalandı.`
      );
    }
  };

  const handleCopyFullListToClipboard = () => {
    setIsGearMenuOpen(false);
    const res = copyProgramsToClipboard(selectedChannel, selectedDate, activeList, []);
    if (res?.success) {
      dialog.info(
        'Tüm Liste Panoya Kopyalandı',
        `Günün tüm yayın listesi (${res.count} öğe) panoya kopyalandı.\nBaşka bir güne geçip yapıştırabilirsiniz.`
      );
    }
  };

  const handleClearCurrentList = async () => {
    setIsGearMenuOpen(false);
    if (currentPrograms.length === 0) return;
    const ok = await dialog.confirm(
      'Yayın Listesini Temizle',
      `"${currentChannelObj.name} - Liste ${activeList}" akışındaki tüm programları (${currentPrograms.length} öğe) silmek istediğinize emin misiniz?\nTarih: ${selectedDate}`,
      {
        isDestructive: true,
        confirmText: 'Evet, Listeyi Temizle',
        cancelText: 'Vazgeç'
      }
    );
    if (ok) {
      clearList(selectedChannel, selectedDate, activeList);
      dialog.info('Liste Temizlendi', `${selectedDate} (Liste ${activeList}) yayın akışı temizlendi.`);
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '10px 18px',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: '16px',
        flexShrink: 0
      }}
    >
      {/* SOL ÜST: Modüller + Taslak Paneli + Tarih Seçme Alanı */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            padding: '8px 12px',
            borderRadius: '9px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            fontSize: '13.5px',
            fontWeight: '700'
          }}
          title="Ana Modül Seçimine Dön"
        >
          <ArrowLeft size={16} />
          <span>Modüller</span>
        </button>

        {viewMode === 'daily' && (
          <button
            onClick={toggleDraftSidebar}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: isDraftSidebarOpen ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-primary)',
              border: isDraftSidebarOpen
                ? '1px solid rgba(59, 130, 246, 0.45)'
                : '1px solid var(--border-color)',
              color: isDraftSidebarOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
              padding: '8px 12px',
              borderRadius: '9px',
              cursor: 'pointer',
              fontSize: '13.5px',
              fontWeight: '800'
            }}
            title="Sol Taslak & Klip panelini göster/gizle (Kısayol: T)"
          >
            {isDraftSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            <span>Taslak Paneli</span>
          </button>
        )}

        {/* Tarih Seçme Alanı (Sol Üstte) */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => navigateDay(-1)}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '8px 10px',
              borderRadius: '9px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center'
            }}
            title="Önceki Gün"
          >
            <ChevronLeft size={17} />
          </button>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              padding: '6px 12px',
              borderRadius: '9px'
            }}
          >
            <Calendar size={16} color="var(--accent-primary)" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => e.target.value && setSelectedDate(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            />
            {dayName && (
              <span
                style={{
                  fontSize: '13.5px',
                  fontWeight: '800',
                  color: 'var(--accent-primary)',
                  borderLeft: '1px solid var(--border-color)',
                  paddingLeft: '8px'
                }}
              >
                {dayName}
              </span>
            )}
          </div>

          <button
            onClick={() => navigateDay(1)}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '8px 10px',
              borderRadius: '9px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center'
            }}
            title="Sonraki Gün"
          >
            <ChevronRight size={17} />
          </button>

          <button
            onClick={goToToday}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '8px 12px',
              borderRadius: '9px',
              cursor: 'pointer',
              fontSize: '13.5px',
              fontWeight: '800'
            }}
          >
            Bugün
          </button>
        </div>
      </div>

      {/* ORTA ÜST: Üstte Kanal Seçimi, Hemen Altında Liste Seçimi */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        {/* Kanal Seçimi */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--bg-primary)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)'
          }}
        >
          {BROADCAST_CHANNELS.map(ch => {
            const isSelected = selectedChannel === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setSelectedChannel(ch.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '6px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isSelected ? 'var(--accent-primary)' : 'transparent',
                  color: isSelected ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '800',
                  transition: 'all 0.15s'
                }}
              >
                <span style={{ fontSize: '15px' }}>{ch.logo}</span>
                <span>{ch.name}</span>
              </button>
            );
          })}
        </div>

        {/* Liste Seçimi (Kanalların Altında) */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: 'var(--bg-primary)',
            padding: '3px 6px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}
        >
          <button
            onClick={() => setActiveList('A')}
            style={{
              padding: '4px 14px',
              borderRadius: '6px',
              border: 'none',
              background: activeList === 'A' ? '#3b82f6' : 'transparent',
              color: activeList === 'A' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '800'
            }}
          >
            Liste A
          </button>

          <button
            onClick={() => setActiveList('B')}
            style={{
              padding: '4px 14px',
              borderRadius: '6px',
              border: 'none',
              background: activeList === 'B' ? '#8b5cf6' : 'transparent',
              color: activeList === 'B' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '800'
            }}
          >
            Liste B
          </button>
        </div>
      </div>

      {/* SAĞ ÜST: Görünüm Modları (Günlük / Haftalık / Aylık) + Pano Sembolü + Çark İşlemler Menüsü */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px'
        }}
      >
        {/* Görünüm Modları */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--bg-primary)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)'
          }}
        >
          {[
            { id: 'daily', label: 'Günlük', icon: Calendar },
            { id: 'weekly', label: 'Haftalık', icon: CalendarDays },
            { id: 'monthly', label: 'Aylık', icon: CalendarRange },
            { id: 'reports', label: 'Raporlar', icon: BarChart3 }
          ].map(mode => {
            const Icon = mode.icon;
            const active = viewMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 13px',
                  borderRadius: '7px',
                  border: 'none',
                  background: active ? 'var(--bg-tertiary)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '13.5px',
                  fontWeight: '800'
                }}
              >
                <Icon size={15} />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Pano Sembolü (Yalnızca Pano Kullanıma Başladığında Görünür, En Fazla Son 5 İşlemi Tutar) */}
        {hasClipboardData && (
          <div ref={clipboardMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsClipboardOpen(prev => !prev)}
              title="Pano ve Son Kopyalananlar (En Son 5 İşlem)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: isClipboardOpen
                  ? 'var(--accent-primary)'
                  : 'rgba(59, 130, 246, 0.14)',
                border: '1.5px solid rgba(59, 130, 246, 0.45)',
                color: isClipboardOpen ? '#ffffff' : 'var(--accent-primary)',
                padding: '7px 11px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '800'
              }}
            >
              <ClipboardPaste size={17} />
              <span>{activeClipboardCount}</span>
            </button>

            {isClipboardOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '44px',
                  right: 0,
                  width: '340px',
                  background: 'var(--bg-primary)',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '10px',
                  boxShadow: '0 14px 32px rgba(0, 0, 0, 0.32)',
                  zIndex: 220,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                {/* Başlık ve Temizle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border-color)',
                    paddingBottom: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ClipboardPaste size={15} color="var(--accent-primary)" />
                    <span style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      Pano ({recentHistory.length}/5 İşlem)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      clearClipboard();
                      setIsClipboardOpen(false);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: '11.5px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    Panoyu Temizle
                  </button>
                </div>

                {/* Aktif Pano Hızlı Yapıştırma Butonları */}
                {activeClipboardCount > 0 && (
                  <div
                    style={{
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '9px',
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px'
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12.5px',
                          fontWeight: '800',
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {clipboardMeta?.summaryLabel || `${activeClipboardCount} Öğe`}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          color: 'var(--accent-primary)',
                          flexShrink: 0
                        }}
                      >
                        {clipboardMeta?.sourceDate
                          ? `${clipboardMeta.sourceDate} • L-${clipboardMeta.sourceList || 'A'}`
                          : `${activeClipboardCount} öğe`}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px' }}>
                      <button
                        type="button"
                        onClick={() => handlePasteFromHeader('top')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          padding: '5px 6px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          fontSize: '11.5px',
                          fontWeight: '800',
                          cursor: 'pointer'
                        }}
                      >
                        <ArrowUpToLine size={12} />
                        <span>En Üste</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePasteFromHeader('after_selected')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          padding: '5px 6px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          fontSize: '11.5px',
                          fontWeight: '800',
                          cursor: 'pointer'
                        }}
                      >
                        <CornerDownRight size={12} />
                        <span>Seçili Altı</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePasteFromHeader('bottom')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          padding: '5px 6px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          fontSize: '11.5px',
                          fontWeight: '800',
                          cursor: 'pointer'
                        }}
                      >
                        <ArrowDownToLine size={12} />
                        <span>En Alta</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePasteFromHeader('replace')}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'var(--accent-primary)',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      Bu Güne / Liste {activeList}'ya Uygula (Tümünü Değiştir)
                    </button>
                  </div>
                )}

                {/* Son 5 Kopyalama Geçmişi */}
                {recentHistory.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '800',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase'
                      }}
                    >
                      Son Kopyalananlar (En Son 5 İşlem)
                    </span>
                    {recentHistory.map(entry => {
                      const isCurrent = clipboardMeta?.id && clipboardMeta.id === entry.id;
                      const timeStr = entry.meta?.copiedAt
                        ? new Date(entry.meta.copiedAt).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : '';
                      return (
                        <div
                          key={entry.id}
                          onClick={() => selectClipboardHistoryEntry(entry.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '6px',
                            padding: '6px 8px',
                            borderRadius: '7px',
                            background: isCurrent ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                            border: isCurrent
                              ? '1px solid rgba(59, 130, 246, 0.45)'
                              : '1px solid var(--border-color)',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                fontSize: '12px',
                                fontWeight: '800',
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {entry.meta?.summaryLabel || `${entry.meta?.count || 1} öğe`}
                            </div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                              {entry.meta?.count || 1} öğe • {entry.meta?.sourceDate || ''}{' '}
                              (Liste {entry.meta?.sourceList || 'A'}) {timeStr ? `• ${timeStr}` : ''}
                            </div>
                          </div>

                          <div
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handlePasteHistoryItem(entry.id)}
                              title={`Liste ${activeList} içine yapıştır`}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '5px',
                                border: 'none',
                                background: 'rgba(16, 185, 129, 0.16)',
                                color: '#10b981',
                                fontSize: '11px',
                                fontWeight: '800',
                                cursor: 'pointer'
                              }}
                            >
                              Yapıştır
                            </button>
                            <button
                              type="button"
                              onClick={() => removeClipboardHistoryEntry(entry.id)}
                              title="Geçmişten kaldır"
                              style={{
                                padding: '4px',
                                borderRadius: '5px',
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                display: 'inline-flex'
                              }}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Sağ Üst Çark (Ayarlar, Kısayollar ve Liste İşlemleri) */}
        <div ref={gearMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsGearMenuOpen(prev => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isGearMenuOpen ? 'var(--accent-primary)' : 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: isGearMenuOpen ? '#ffffff' : 'var(--text-primary)',
              padding: '9px 11px',
              borderRadius: '10px',
              cursor: 'pointer'
            }}
            title="Ayarlar, Kısayollar ve Liste İşlemleri"
          >
            <Settings size={18} />
          </button>

          {isGearMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '44px',
                right: 0,
                width: '260px',
                background: 'var(--bg-primary)',
                border: '1.5px solid var(--border-color)',
                borderRadius: '12px',
                padding: '8px',
                boxShadow: '0 14px 32px rgba(0, 0, 0, 0.28)',
                zIndex: 200,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div
                style={{
                  fontSize: '11.5px',
                  fontWeight: '800',
                  color: 'var(--text-muted)',
                  padding: '4px 10px',
                  textTransform: 'uppercase'
                }}
              >
                Ayarlar & İşlemler
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsGearMenuOpen(false);
                  if (onOpenShortcuts) onOpenShortcuts();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Keyboard size={16} color="var(--accent-primary)" />
                <span>Klavye Kısayolları</span>
              </button>

              {onOpenAdSettingsModal && (
                <button
                  type="button"
                  onClick={() => {
                    setIsGearMenuOpen(false);
                    onOpenAdSettingsModal();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Megaphone size={16} color="#f59e0b" />
                  <span>Varsayılan Reklam Ayarları</span>
                </button>
              )}

              {/* Varsayılan İntro Ayarları & Otomatik İntro Yerleştir Açık/Kapalı */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  padding: '4px',
                  borderRadius: '8px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsGearMenuOpen(false);
                    if (onOpenIntroSettingsModal) onOpenIntroSettingsModal();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    width: '100%',
                    padding: '7px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} color="#6366f1" />
                    <span>Varsayılan İntro Ayarları</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: '800' }}>
                    Seç ▸
                  </span>
                </button>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    borderTop: '1px dashed var(--border-color)',
                    gap: '8px'
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                    Otomatik İntro Yerleştir:
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleAutoInsertIntro()}
                    style={{
                      padding: '3px 10px',
                      borderRadius: '999px',
                      border: 'none',
                      background:
                        introDefaultSettings?.autoInsertIntro !== false
                          ? '#10b981'
                          : 'rgba(239, 68, 68, 0.18)',
                      color:
                        introDefaultSettings?.autoInsertIntro !== false
                          ? '#ffffff'
                          : '#ef4444',
                      fontSize: '11.5px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    {introDefaultSettings?.autoInsertIntro !== false ? 'Açık' : 'Kapalı'}
                  </button>
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />

              <button
                type="button"
                onClick={handleCopyListVariant}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Copy size={16} color="#8b5cf6" />
                <span>
                  Liste {activeList} → Liste {targetCopyList} Aktar
                </span>
              </button>

              {currentPrograms.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleCopyFullListToClipboard}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '13.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Copy size={16} color="#3b82f6" />
                    <span>Günün Listesini Panoya Kopyala</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearCurrentList}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'transparent',
                      color: '#ef4444',
                      fontSize: '13.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Trash2 size={16} color="#ef4444" />
                    <span>Listeyi Temizle ({currentPrograms.length})</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BroadcastHeader;
