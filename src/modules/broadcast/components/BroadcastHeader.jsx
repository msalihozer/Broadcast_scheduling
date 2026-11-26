/**
 * @file src/modules/broadcast/components/BroadcastHeader.jsx
 * @description Yayın Planlama modülü üst kontrol ve navigasyon çubuğu.
 *
 * Yerleşim Düzeni:
 * - Sol Üst: Modüller, Taslak Paneli Aç/Kapat ve Tarih Seçme Alanı (< | Tarih | > | Bugün)
 * - Orta Üst: Üstte Kanal Seçimi (Semerkand HD / Semerkand WAY), hemen altında Liste Seçimi (Liste A / Liste B)
 * - Sağ Üst: Görünüm Seçimi (Günlük / Haftalık / Aylık) ve Çark () İşlemler & Kısayollar Menüsü
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
import useResponsive from '../../../hooks/useResponsive';
import Ikon from '../../../components/Ikon';

const BroadcastHeader = ({ onOpenShortcuts, onOpenAdSettingsModal, onOpenIntroSettingsModal }) => {
  const navigate = useNavigate();
  const { isMobile, isCompact } = useResponsive();
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
        minHeight: isCompact ? 'auto' : '82px',
        background: '#FFFFFF',
        borderBottom: '1px solid var(--border-color, #DCE5E9)',
        padding: isMobile ? '8px 10px' : '10px 20px',
        display: 'grid',
        gridTemplateColumns: isCompact ? '1fr' : '1fr auto 1fr',
        alignItems: 'center',
        gap: isMobile ? '10px' : '16px',
        flexShrink: 0
      }}
    >
      {/* 1. SOL GRUP: 36x36 Yeşil (#468625) İkon Karesi + Başlık */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifySelf: 'start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '4px',
            background: 'var(--m-ready, #468625)',
            color: '#FFFFFF',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0
          }}>
            <Ikon ad="hazir" size={20} />
          </div>
          <h1 style={{
            fontSize: isMobile ? '17px' : '20px',
            fontWeight: 300,
            color: 'var(--text-primary, #0A101D)',
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
            margin: 0
          }}>
            <b style={{ fontWeight: 700 }}>Yayın Planlama</b> (Ready)
          </h1>
        </div>
      </div>

      {/* 2. ORTA GRUP: Üstte Takvim (Bugün), Altında Kanal Seçimi, Onun Altında Liste Seçimi */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5px',
        justifySelf: 'center'
      }}>
        {/* Satır 1: Tarih Seçme Alanı + Bugün */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: '32px',
            border: '1px solid var(--border-color, #DCE5E9)',
            borderRadius: '4px',
            background: '#FFFFFF',
            overflow: 'hidden'
          }}>
            <button
              onClick={() => navigateDay(-1)}
              style={{
                width: '30px',
                height: '100%',
                background: 'transparent',
                border: 0,
                color: 'var(--text-secondary, #4B6478)',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center'
              }}
              title="Önceki Gün"
            >
              <Ikon ad="sol" size={15} />
            </button>

            <div
              style={{
                height: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                borderLeft: '1px solid var(--border-light, #EBF0F2)',
                borderRight: '1px solid var(--border-light, #EBF0F2)',
                padding: '0 10px'
              }}
            >
              <Ikon ad="hafta" size={14} color="var(--turkuaz, #0C617C)" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => e.target.value && setSelectedDate(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary, #0A101D)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                  height: '26px'
                }}
              />
              {dayName && (
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--turkuaz, #0C617C)',
                    borderLeft: '1px solid var(--border-color, #DCE5E9)',
                    paddingLeft: '7px'
                  }}
                >
                  {dayName}
                </span>
              )}
            </div>

            <button
              onClick={() => navigateDay(1)}
              style={{
                width: '30px',
                height: '100%',
                background: 'transparent',
                border: 0,
                color: 'var(--text-secondary, #4B6478)',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center'
              }}
              title="Sonraki Gün"
            >
              <Ikon ad="sag" size={15} />
            </button>
          </div>

          <button
            onClick={goToToday}
            style={{
              height: '32px',
              background: 'var(--turkuaz-50, #E7F0F3)',
              border: '1px solid var(--turkuaz-100, #CFE1E7)',
              color: 'var(--turkuaz, #0C617C)',
              padding: '0 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11.5px',
              fontWeight: 800
            }}
          >
            Bugün
          </button>
        </div>

        {/* Satır 2: Kanal Seçimi (Semerkand HD / Semerkand WAY) */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--bg-primary, #F5F7F6)',
            padding: '2px',
            borderRadius: '4px',
            border: '1px solid var(--border-color, #DCE5E9)',
            gap: '2px'
          }}
        >
          {BROADCAST_CHANNELS.map(ch => {
            const isSelected = selectedChannel === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setSelectedChannel(ch.id)}
                style={{
                  height: '26px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 12px',
                  borderRadius: '3px',
                  border: 0,
                  background: isSelected ? 'var(--turkuaz, #0C617C)' : 'transparent',
                  color: isSelected ? '#FFFFFF' : 'var(--text-secondary, #4B6478)',
                  cursor: 'pointer',
                  fontSize: '11.5px',
                  fontWeight: 700
                }}
              >
                <Ikon ad="kanal" size={13} />
                <span>{ch.name}</span>
              </button>
            );
          })}
        </div>

        {/* Satır 3: Liste Seçimi (Liste A / Liste B) */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
            background: 'var(--bg-primary, #F5F7F6)',
            padding: '2px',
            borderRadius: '4px',
            border: '1px solid var(--border-color, #DCE5E9)'
          }}
        >
          <button
            onClick={() => setActiveList('A')}
            style={{
              height: '24px',
              padding: '0 14px',
              borderRadius: '3px',
              border: 0,
              background: activeList === 'A' ? 'var(--m-ready, #468625)' : 'transparent',
              color: activeList === 'A' ? '#FFFFFF' : 'var(--text-secondary, #4B6478)',
              cursor: 'pointer',
              fontSize: '11.5px',
              fontWeight: 700
            }}
          >
            Liste A
          </button>

          <button
            onClick={() => setActiveList('B')}
            style={{
              height: '24px',
              padding: '0 14px',
              borderRadius: '3px',
              border: 0,
              background: activeList === 'B' ? 'var(--m-ready, #468625)' : 'transparent',
              color: activeList === 'B' ? '#FFFFFF' : 'var(--text-secondary, #4B6478)',
              cursor: 'pointer',
              fontSize: '11.5px',
              fontWeight: 700
            }}
          >
            Liste B
          </button>
        </div>
      </div>

      {/* 3. SAĞ GRUP: Görünüm Modları (Günlük / Haftalık / Aylık) + Raporlar + Pano + Belirgin Ayarlar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCompact ? 'flex-start' : 'flex-end',
          flexWrap: 'wrap',
          gap: isMobile ? '6px' : '8px',
          justifySelf: isCompact ? 'start' : 'end'
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--bg-primary, #F5F7F6)',
            padding: '2px',
            borderRadius: '4px',
            border: '1px solid var(--border-color, #DCE5E9)',
            gap: '2px'
          }}
        >
          {[
            { id: 'daily', label: 'Günlük' },
            { id: 'weekly', label: 'Haftalık' },
            { id: 'monthly', label: 'Aylık' }
          ].map(mode => {
            const active = viewMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id)}
                style={{
                  height: '32px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  borderRadius: '3px',
                  border: 0,
                  background: active ? 'var(--turkuaz, #0C617C)' : 'transparent',
                  color: active ? '#FFFFFF' : 'var(--text-secondary, #4B6478)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 700
                }}
              >
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Raporlar */}
        <button
          type="button"
          onClick={() => setViewMode('reports')}
          style={{
            height: '36px',
            padding: '0 12px',
            borderRadius: '4px',
            border: viewMode === 'reports' ? '1px solid var(--turkuaz, #0C617C)' : '1px solid var(--border-color, #DCE5E9)',
            background: viewMode === 'reports' ? 'var(--turkuaz, #0C617C)' : '#FFFFFF',
            color: viewMode === 'reports' ? '#FFFFFF' : 'var(--text-primary, #0A101D)',
            fontSize: '12px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            cursor: 'pointer'
          }}
        >
          <Ikon ad="rapor" size={15} />
          <span>Raporlar</span>
        </button>

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

        {/* Sağ Üst Belirgin Ayarlar Butonu (Ayarlar, Kısayollar ve Liste İşlemleri) */}
        <div ref={gearMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsGearMenuOpen(prev => !prev)}
            style={{
              height: '36px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              background: isGearMenuOpen ? 'var(--turkuaz, #0C617C)' : 'var(--turkuaz-50, #E7F0F3)',
              border: '1.5px solid var(--turkuaz, #0C617C)',
              color: isGearMenuOpen ? '#FFFFFF' : 'var(--turkuaz, #0C617C)',
              padding: '0 13px',
              borderRadius: '4px',
              fontSize: '12.5px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
            title="Ayarlar, Kısayollar ve Liste İşlemleri"
          >
            <Ikon ad="admin" size={16} />
            <span>Ayarlar</span>
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
