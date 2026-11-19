/**
 * @file DraftHeader.jsx
 * @description Taslak Planlama modülü kurumsal üst kontrol, aksiyon butonları, arama ve görünüm seçici barı.
 * Kurumsal SaaS tasarım dili (Plus Jakarta Sans & JetBrains Mono, katmanlı gölgeler ve zarif ikon rozetli butonlar).
 */
import React from 'react';
import {
  Calendar,
  Layers,
  Search,
  X,
  Grid3X3,
  ListFilter,
  Upload,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Keyboard,
  Tv,
  Save,
  Check,
  Loader2,
  FolderPlus,
  Send,
  BarChart3
} from 'lucide-react';

const DraftHeader = ({
  currentChannel,
  channels,
  selectedChannel,
  onSelectChannel,
  channelHasListMap = {},
  viewMode,
  onViewModeChange,
  isImporting,
  dateRangeLabel,
  onClearSchedule,
  hasPrograms,
  selectedDayKey,
  onOpenCalendar,
  onPrevWeek,
  onNextWeek,
  onOpenImportModal,
  onSaveSchedule,
  saveStatus = 'saved',
  isLibraryOpen = true,
  onToggleLibrary,
  onOpenSendModal,
  onOpenReports
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      width: '100%',
      fontFamily: 'var(--font-sans)'
    }}>
      {/* 1. SATIR: SOL BAŞLIK | ORTA TARİH/HAFTA SEÇİMİ | SAĞ KANAL & IZGARA/TABLO */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(240px, 1fr) auto minmax(280px, 1fr)',
        alignItems: 'center',
        gap: '14px',
        width: '100%'
      }}>
        {/* Sol: Modül Logosu, Kurumsal Başlık ve Durum Rozeti */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifySelf: 'start', minWidth: 0 }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '11px',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #0ea5e9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 16px -3px rgba(37, 99, 235, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
            flexShrink: 0
          }}>
            <Calendar size={20} color="#ffffff" />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <h1 style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '19px',
                fontWeight: 800,
                margin: 0,
                letterSpacing: '-0.03em',
                color: 'var(--text-primary)'
              }}>
                Taslak Yayın Planlama Stüdyosu
              </h1>

              <span style={{
                fontSize: '10.5px',
                fontWeight: 700,
                padding: '2.5px 9px',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.14) 0%, rgba(37, 99, 235, 0.1) 100%)',
                color: '#0891b2',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Layers size={11} /> Akıllı Süre & Kuşak Motoru
              </span>
            </div>

            <div style={{
              fontSize: '11.5px',
              color: 'var(--text-muted)',
              marginTop: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>Aktif Yayın Kanalı:</span>
              <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                {currentChannel?.name || 'Semerkand HD'}
              </strong>
              <span>•</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600 }}>
                7 Gün × 24 Saat (1440 dk)
              </span>
            </div>
          </div>
        </div>

        {/* Orta: Kurumsal Hafta ve Tarih Gezgini (Tam Ortada Sabit) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          justifySelf: 'center',
          gap: '4px',
          background: 'var(--bg-primary)',
          border: '1.5px solid var(--border-color)',
          borderRadius: '11px',
          padding: '4px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <button
            type="button"
            onClick={onPrevWeek}
            title="Önceki Hafta (7 gün geri git)"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-light)',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ChevronLeft size={16} />
          </button>

          <button
            type="button"
            onClick={onOpenCalendar}
            title="Takvim ve Hafta Gezginini Aç"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              padding: '6px 16px',
              height: '32px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              whiteSpace: 'nowrap'
            }}
          >
            <Calendar size={14} color="var(--accent-primary)" />
            <span style={{ letterSpacing: '-0.01em' }}>{dateRangeLabel || '27 Ekim - 2 Kasım 2025'}</span>
            <ChevronDown size={13} color="var(--text-muted)" />
          </button>

          <button
            type="button"
            onClick={onNextWeek}
            title="Sonraki Hafta (7 gün ileri git)"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-light)',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Sağ: Belirgin Kanal Seçimi (Liste Yüklü Değilse Turuncu) & Izgara / Tablo Seçici */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          justifySelf: 'end',
          gap: '10px',
          flexShrink: 0
        }}>
          {/* Kanal Değiştirici (HD / WAY - Liste yüklü değil ise Turuncu) */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-primary)',
            borderRadius: '12px',
            padding: '4px',
            border: '1.5px solid var(--border-color)',
            gap: '5px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            {channels.map(ch => {
              const isActive = selectedChannel === ch.id;
              const hasChannelList = Boolean(channelHasListMap?.[ch.id]);
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => onSelectChannel(ch.id)}
                  title={
                    hasChannelList
                      ? `${ch.name} — Bu hafta için yayın listesi yüklü`
                      : `${ch.name} — Bu hafta için henüz yayın listesi yüklü değil`
                  }
                  style={{
                    padding: '7px 14px',
                    borderRadius: '9px',
                    border: !hasChannelList
                      ? isActive
                        ? '1.5px solid #c2410c'
                        : '1.5px solid rgba(245, 158, 11, 0.65)'
                      : isActive
                      ? '1.5px solid #1d4ed8'
                      : '1.5px solid transparent',
                    background: !hasChannelList
                      ? isActive
                        ? 'linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)'
                        : 'rgba(245, 158, 11, 0.16)'
                      : isActive
                      ? 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)'
                      : 'var(--bg-secondary)',
                    color: !hasChannelList
                      ? isActive
                        ? '#ffffff'
                        : '#c2410c'
                      : isActive
                      ? '#ffffff'
                      : 'var(--text-primary)',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: isActive
                      ? !hasChannelList
                        ? '0 3px 10px rgba(234, 88, 12, 0.35)'
                        : '0 3px 10px rgba(37, 99, 235, 0.32)'
                      : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Tv size={14} />
                  <span>{ch.name}</span>
                  <span style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: !hasChannelList
                      ? isActive ? '#fef08a' : '#f59e0b'
                      : isActive ? '#34d399' : '#10b981',
                    boxShadow: !hasChannelList
                      ? '0 0 6px rgba(245, 158, 11, 0.8)'
                      : '0 0 5px rgba(16, 185, 129, 0.6)'
                  }} />
                </button>
              );
            })}
          </div>

          {/* Görünüm Modu Seçici (Izgara / Tablo - Sağda Sabit) */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-primary)',
            borderRadius: '11px',
            padding: '4px',
            border: '1.5px solid var(--border-color)',
            gap: '3px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              title="Haftalık Sütun Izgarası Görünümü (G)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                background: viewMode === 'grid' ? 'var(--accent-primary)' : 'transparent',
                color: viewMode === 'grid' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: viewMode === 'grid' ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
                whiteSpace: 'nowrap'
              }}
            >
              <Grid3X3 size={13} />
              <span>Izgara</span>
            </button>

            <button
              type="button"
              onClick={() => onViewModeChange('rundown')}
              title="Sıralı Rundown Tablosu Görünümü (R)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                background: viewMode === 'rundown' ? 'var(--accent-primary)' : 'transparent',
                color: viewMode === 'rundown' ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: viewMode === 'rundown' ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
                whiteSpace: 'nowrap'
              }}
            >
              <ListFilter size={13} />
              <span>Tablo</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. SATIR: KURUMSAL AKSİYON BUTONLARI */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        background: 'var(--bg-primary)',
        padding: '8px 12px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.5)'
      }}>
        {/* Sol Kurumsal Buton Grubu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Program Kütüphanesi Aç/Kapat Butonu */}
          <button
            type="button"
            onClick={onToggleLibrary}
            className="corp-btn"
            title={isLibraryOpen ? 'Program ve Dolgu Kuşağı panelini gizle' : 'Program Kütüphanesi ve Dolgu Kuşağı panelini aç'}
            style={{
              background: isLibraryOpen
                ? 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)'
                : 'var(--bg-secondary)',
              color: isLibraryOpen ? '#ffffff' : 'var(--text-primary)',
              border: isLibraryOpen
                ? '1px solid #312e81'
                : '1px solid var(--border-color)',
              boxShadow: isLibraryOpen
                ? '0 3px 10px rgba(67, 56, 202, 0.28), inset 0 1px 0 rgba(255,255,255,0.2)'
                : 'var(--shadow-sm)'
            }}
          >
            <FolderPlus size={14} color={isLibraryOpen ? '#c7d2fe' : '#4f46e5'} />
            <span>{isLibraryOpen ? 'Kütüphane Açık' : 'Program Kütüphanesi'}</span>
          </button>

          {/* Excel Akışı Yükle Butonu */}
          <button
            type="button"
            onClick={onOpenImportModal}
            disabled={isImporting}
            className="corp-btn"
            title="Haftalık akış Excel dosyasını (.xlsx) yükleyip hedef kanallara aktarır (Ctrl+E)"
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)',
              opacity: isImporting ? 0.7 : 1
            }}
          >
            <span style={{
              width: '20px',
              height: '20px',
              borderRadius: '5px',
              background: 'rgba(16, 185, 129, 0.14)',
              color: '#059669',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Upload size={12} />
            </span>
            <span>{isImporting ? 'Excel Aktarılıyor...' : 'Excel Akışı Yükle'}</span>
          </button>

          {/* Dinamik Kaydet / Yayına Gönder Butonu */}
          {saveStatus === 'saving' ? (
            <button
              type="button"
              disabled
              className="corp-btn"
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)',
                opacity: 0.8
              }}
            >
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Kaydediliyor...</span>
            </button>
          ) : saveStatus === 'unsaved' ? (
            <button
              type="button"
              onClick={onSaveSchedule}
              className="corp-btn"
              title="Yapılan değişiklikleri kaydet (Ctrl+S). Kaydedildikten sonra Yayına Gönder butonu aktif olur."
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#ffffff',
                border: '1px solid #b45309',
                boxShadow: '0 3px 12px rgba(245, 158, 11, 0.35), inset 0 1px 0 rgba(255,255,255,0.25)'
              }}
            >
              <Save size={14} />
              <span>Kaydet (Ctrl+S)</span>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#fef08a',
                boxShadow: '0 0 6px #ffffff'
              }} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenSendModal}
              className="corp-btn"
              title="Akış kaydedildi. Hazırlanan taslak akışını Yayın Planlama ekranına aktar."
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                color: '#ffffff',
                border: '1px solid #1d4ed8',
                boxShadow: '0 3px 12px rgba(37, 99, 235, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.25)'
              }}
            >
              <Send size={13} />
              <span>Yayına Gönder</span>
            </button>
          )}

          {/* Liste Temizleme Butonu */}
          {hasPrograms && (
            <button
              type="button"
              onClick={onClearSchedule}
              className="corp-btn"
              title={selectedDayKey === 'all' ? 'Tüm haftalık akışı temizle' : 'Seçili günün akışını temizle'}
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--danger)',
                border: '1px solid rgba(225, 29, 72, 0.25)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <Trash2 size={13} />
              <span>{selectedDayKey === 'all' ? 'Haftayı Temizle' : 'Günü Temizle'}</span>
            </button>
          )}

          {/* Detaylı Taslak Raporları & Yayın Planlama Karşılaştırma Butonu */}
          {onOpenReports && (
            <button
              type="button"
              onClick={onOpenReports}
              className="corp-btn"
              title="Taslak Planlama Detaylı Raporları, Haftalık/Aylık/Yıllık Analiz, Yayın Planlama Karşılaştırması ve PDF/Excel/CSV Çıktısı"
              style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
                color: '#ffffff',
                border: '1px solid #1e40af',
                boxShadow: '0 3px 10px rgba(30, 58, 138, 0.25)'
              }}
            >
              <BarChart3 size={14} color="#38bdf8" />
              <span>Detaylı Raporlar &amp; Çıktı (PDF / Excel / CSV)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(DraftHeader);
