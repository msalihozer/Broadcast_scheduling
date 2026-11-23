/**
 * @file DraftHeader.jsx
 * @description Semerkand TV Kurumsal Kimlik 2026 - Taslak Planlama modülü 68px beyaz araç çubuğu.
 * Sol: 34x34 Derin Turkuaz (#0C617C) ikon karesi + Taslak Planlama başlığı + Kanal seçici + Hafta seçici + Görünüm (Izgara/Tablo).
 * Sağ: Kütüphane, Taslaklar, Excel Akışı Yükle, Raporlar, ⋯ menüsü (Kısayollar, Haftayı/Günü Temizle) ve tek ana aksiyon butonu (Kaydet / Yayına Gönder).
 */
import React, { useState, useRef, useEffect } from 'react';
import usePlanningStore from '../../../store/planningStore';
import useDialogStore from '../../../store/dialogStore';
import useResponsive from '../../../hooks/useResponsive';
import Ikon from '../../../components/Ikon';

const DraftHeader = ({
  channels = [],
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
  const { isMobile, isCompact } = useResponsive();
  const [draftMenuOpen, setDraftMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [isPromptingDraft, setIsPromptingDraft] = useState(false);
  const [newDraftName, setNewDraftName] = useState('');

  const draftMenuRef = useRef(null);
  const moreMenuRef = useRef(null);

  const currentMode = usePlanningStore(state => state.currentMode) || 'draft';
  const drafts = usePlanningStore(state => (state.drafts || []).filter(d => (d.mode || 'draft') === currentMode));
  const saveDraft = usePlanningStore(state => state.saveDraft);
  const applyDraft = usePlanningStore(state => state.applyDraft);
  const deleteDraft = usePlanningStore(state => state.deleteDraft);

  useEffect(() => {
    const handleOutside = (e) => {
      if (draftMenuRef.current && !draftMenuRef.current.contains(e.target)) {
        setDraftMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div style={{
      minHeight: isCompact ? 'auto' : '52px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: isMobile ? '8px' : '12px',
      width: '100%',
      fontFamily: 'var(--font-sans)'
    }}>
      {/* SOL GRUP: Modül İkon Karesi + Başlık + Kanal + Hafta + Görünüm */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: isMobile ? '8px' : '12px'
      }}>
        {/* 34x34 Modül Başlığı */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '4px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '4px',
            background: 'var(--m-taslak, #0C617C)',
            color: '#FFFFFF',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0
          }}>
            <Ikon ad="taslak" size={20} />
          </div>
          <h1 style={{
            fontSize: isMobile ? '17px' : '20px',
            fontWeight: 300,
            color: 'var(--text-primary, #0A101D)',
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
            margin: 0
          }}>
            Taslak <b style={{ fontWeight: 700 }}>Planlama</b>
          </h1>
        </div>

        {/* Kanal Seçici (Segmented) */}
        <div style={{
          display: 'inline-flex',
          border: '1px solid var(--border-color, #DCE5E9)',
          borderRadius: '4px',
          background: 'var(--bg-primary, #F5F7F6)',
          padding: '2px',
          gap: '2px'
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
                  height: '32px',
                  padding: '0 12px',
                  border: 0,
                  background: isActive ? 'var(--turkuaz, #0C617C)' : 'transparent',
                  color: isActive ? '#FFFFFF' : 'var(--text-secondary, #4B6478)',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '3px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit'
                }}
              >
                <Ikon ad="kanal" size={14} />
                <span>{ch.name}</span>
                {!hasChannelList && (
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--hardal, #E8B44C)'
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Hafta / Tarih Seçici */}
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
            onClick={onPrevWeek}
            title="Önceki Hafta"
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

          <button
            type="button"
            onClick={onOpenCalendar}
            title="Takvim ve Hafta Gezginini Aç"
            style={{
              height: '100%',
              padding: '0 12px',
              border: 0,
              borderLeft: '1px solid var(--border-light, #EBF0F2)',
              borderRight: '1px solid var(--border-light, #EBF0F2)',
              background: 'transparent',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-primary, #0A101D)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Ikon ad="hafta" size={15} color="var(--turkuaz, #0C617C)" />
            <span>{dateRangeLabel || '23 - 29 Kasım 2026'}</span>
          </button>

          <button
            type="button"
            onClick={onNextWeek}
            title="Sonraki Hafta"
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

        {/* Görünüm Modu (Izgara / Tablo) */}
        <div style={{
          display: 'inline-flex',
          border: '1px solid var(--border-color, #DCE5E9)',
          borderRadius: '4px',
          background: 'var(--bg-primary, #F5F7F6)',
          padding: '2px',
          gap: '2px'
        }}>
          <button
            type="button"
            onClick={() => onViewModeChange('grid')}
            title="Haftalık Sütun Izgarası Görünümü (G)"
            style={{
              height: '32px',
              padding: '0 12px',
              border: 0,
              background: viewMode === 'grid' ? 'var(--turkuaz, #0C617C)' : 'transparent',
              color: viewMode === 'grid' ? '#FFFFFF' : 'var(--text-secondary, #4B6478)',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '3px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Ikon ad="izgara" size={14} />
            <span>Izgara</span>
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange('rundown')}
            title="Sıralı Rundown Tablosu Görünümü (R)"
            style={{
              height: '32px',
              padding: '0 12px',
              border: 0,
              background: viewMode === 'rundown' ? 'var(--turkuaz, #0C617C)' : 'transparent',
              color: viewMode === 'rundown' ? '#FFFFFF' : 'var(--text-secondary, #4B6478)',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '3px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Ikon ad="tablo" size={14} />
            <span>Tablo</span>
          </button>
        </div>
      </div>

      {/* SAĞ GRUP: İkincil Ghost Butonlar + Tek Ana Aksiyon Butonu */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        {/* Program Kütüphanesi Aç/Kapat */}
        <button
          type="button"
          onClick={onToggleLibrary}
          className="btn ghost"
          title={isLibraryOpen ? 'Program Kütüphanesi panelini gizle' : 'Program Kütüphanesi panelini göster'}
          style={{
            height: '36px',
            padding: '0 12px',
            borderRadius: '4px',
            border: isLibraryOpen ? '1px solid var(--turkuaz, #0C617C)' : '1px solid var(--border-color, #DCE5E9)',
            background: isLibraryOpen ? 'var(--turkuaz-50, #E7F0F3)' : '#FFFFFF',
            color: isLibraryOpen ? 'var(--turkuaz, #0C617C)' : 'var(--text-primary, #0A101D)',
            fontSize: '12px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            cursor: 'pointer'
          }}
        >
          <Ikon ad="panel" size={15} />
          <span>{isLibraryOpen ? 'Kütüphane Açık' : 'Kütüphane'}</span>
        </button>

        {/* Taslaklar Açılır Menüsü */}
        <div ref={draftMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => {
              setDraftMenuOpen(prev => !prev);
              setIsPromptingDraft(false);
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
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              cursor: 'pointer'
            }}
          >
            <Ikon ad="taslaklar" size={15} />
            <span>Taslaklar</span>
          </button>

          {draftMenuOpen && (
            <div style={{
              position: 'absolute',
              top: '42px',
              right: 0,
              background: '#FFFFFF',
              border: '1px solid var(--border-color, #DCE5E9)',
              borderRadius: '6px',
              padding: '8px',
              zIndex: 1000,
              minWidth: '240px',
              boxShadow: 'var(--modal-shadow)'
            }}>
              {!isPromptingDraft ? (
                <button
                  type="button"
                  onClick={() => setIsPromptingDraft(true)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    border: 0,
                    background: 'transparent',
                    borderRadius: '4px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: 'var(--turkuaz, #0C617C)',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <Ikon ad="ekle" size={15} />
                  <span>Mevcut Akışı Taslak Yap</span>
                </button>
              ) : (
                <div style={{ padding: '6px', display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    placeholder="Taslak İsmi"
                    value={newDraftName}
                    onChange={e => setNewDraftName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newDraftName.trim()) {
                        saveDraft(newDraftName.trim());
                        setNewDraftName('');
                        setIsPromptingDraft(false);
                      }
                    }}
                    autoFocus
                    style={{
                      flex: 1,
                      background: 'var(--bg-primary, #F5F7F6)',
                      color: 'var(--text-primary, #0A101D)',
                      border: '1px solid var(--border-color, #DCE5E9)',
                      borderRadius: '4px',
                      padding: '5px 8px',
                      fontSize: '12px'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newDraftName.trim()) {
                        saveDraft(newDraftName.trim());
                        setNewDraftName('');
                        setIsPromptingDraft(false);
                      }
                    }}
                    style={{
                      background: 'var(--turkuaz, #0C617C)',
                      color: '#FFFFFF',
                      border: 0,
                      borderRadius: '4px',
                      padding: '0 10px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Kaydet
                  </button>
                </div>
              )}

              {drafts.length > 0 && (
                <>
                  <div style={{ height: '1px', background: 'var(--border-color, #DCE5E9)', margin: '6px 0' }} />
                  <div style={{ fontSize: '10px', color: 'var(--text-muted, #6A7C88)', padding: '2px 8px 4px', textTransform: 'uppercase', fontWeight: 700 }}>
                    Kayıtlı Taslaklar ({drafts.length}/10)
                  </div>
                  <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    {drafts.map(draft => (
                      <div
                        key={draft.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 8px',
                          borderRadius: '4px'
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            useDialogStore.getState().showConfirm(
                              'Taslağı Uygula',
                              `"${draft.name}" taslağını uygulamak istiyor musunuz? (Mevcut akışın üzerine yazılır)`,
                              () => {
                                applyDraft(draft.id);
                                setDraftMenuOpen(false);
                              }
                            );
                          }}
                          style={{
                            flex: 1,
                            border: 0,
                            background: 'transparent',
                            textAlign: 'left',
                            fontSize: '12.5px',
                            color: 'var(--text-primary, #0A101D)',
                            cursor: 'pointer',
                            padding: '2px 4px'
                          }}
                        >
                          {draft.name}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDraft(draft.id);
                          }}
                          title="Taslağı Sil"
                          style={{
                            border: 0,
                            background: 'transparent',
                            color: 'var(--danger, #DD1C40)',
                            cursor: 'pointer',
                            padding: '2px'
                          }}
                        >
                          <Ikon ad="sil" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Excel Akışı Yükle */}
        <button
          type="button"
          onClick={onOpenImportModal}
          disabled={isImporting}
          title="Haftalık akış Excel dosyasını (.xlsx) yükle (Ctrl+E)"
          style={{
            height: '36px',
            padding: '0 12px',
            borderRadius: '4px',
            border: '1px solid var(--border-color, #DCE5E9)',
            background: '#FFFFFF',
            color: 'var(--text-primary, #0A101D)',
            fontSize: '12px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            cursor: isImporting ? 'wait' : 'pointer',
            opacity: isImporting ? 0.7 : 1
          }}
        >
          <Ikon ad="yukle" size={15} />
          <span>{isImporting ? 'Excel Aktarılıyor...' : 'Excel Akışı Yükle'}</span>
        </button>

        {/* Raporlar */}
        {onOpenReports && (
          <button
            type="button"
            onClick={onOpenReports}
            title="Detaylı Raporlar & Çıktı (PDF / Excel / CSV)"
            style={{
              height: '36px',
              padding: '0 12px',
              borderRadius: '4px',
              border: '1px solid var(--border-color, #DCE5E9)',
              background: '#FFFFFF',
              color: 'var(--text-primary, #0A101D)',
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
        )}

        {/* ⋯ Menüsü (Kısayollar, Haftayı/Günü Temizle) */}
        <div ref={moreMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setMoreMenuOpen(prev => !prev)}
            title="Görünüm, Kısayollar, Haftayı Temizle"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '4px',
              border: '1px solid var(--border-color, #DCE5E9)',
              background: '#FFFFFF',
              color: 'var(--text-primary, #0A101D)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer'
            }}
          >
            <Ikon ad="menu" size={16} />
          </button>

          {moreMenuOpen && (
            <div style={{
              position: 'absolute',
              top: '42px',
              right: 0,
              background: '#FFFFFF',
              border: '1px solid var(--border-color, #DCE5E9)',
              borderRadius: '6px',
              padding: '6px',
              zIndex: 1000,
              minWidth: '210px',
              boxShadow: 'var(--modal-shadow)'
            }}>
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  window.dispatchEvent(new CustomEvent('draft:open-shortcuts'));
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  border: 0,
                  background: 'transparent',
                  borderRadius: '4px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #0A101D)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <Ikon ad="bilgi" size={15} />
                <span>Klavye Kısayolları</span>
              </button>

              {hasPrograms && (
                <>
                  <div style={{ height: '1px', background: 'var(--border-color, #DCE5E9)', margin: '4px 0' }} />
                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onClearSchedule();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      border: 0,
                      background: 'transparent',
                      borderRadius: '4px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      color: 'var(--danger, #DD1C40)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <Ikon ad="sil" size={15} />
                    <span>{selectedDayKey === 'all' ? 'Haftayı Temizle' : 'Günü Temizle'}</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Tek Ana Aksiyon Butonu (Kaydet veya Yayına Gönder) */}
        {saveStatus === 'saving' ? (
          <button
            type="button"
            disabled
            style={{
              height: '36px',
              padding: '0 14px',
              borderRadius: '4px',
              border: '1px solid var(--turkuaz, #0C617C)',
              background: 'var(--turkuaz, #0C617C)',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              opacity: 0.75
            }}
          >
            <span>Kaydediliyor...</span>
          </button>
        ) : saveStatus === 'unsaved' ? (
          <button
            type="button"
            onClick={onSaveSchedule}
            title="Yapılan değişiklikleri kaydet (Ctrl+S)"
            style={{
              height: '36px',
              padding: '0 14px',
              borderRadius: '4px',
              border: '1px solid var(--hardal, #E8B44C)',
              background: 'var(--hardal, #E8B44C)',
              color: 'var(--gece, #0A101D)',
              fontSize: '12px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              cursor: 'pointer'
            }}
          >
            <Ikon ad="tamam" size={15} />
            <span>Kaydet (Ctrl+S)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenSendModal}
            title="Hazırlanan taslak akışını Yayın Planlama ekranına aktar"
            style={{
              height: '36px',
              padding: '0 14px',
              borderRadius: '4px',
              border: '1px solid var(--turkuaz, #0C617C)',
              background: 'var(--turkuaz, #0C617C)',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              cursor: 'pointer'
            }}
          >
            <Ikon ad="gonder" size={15} />
            <span>Yayına Gönder</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default React.memo(DraftHeader);
