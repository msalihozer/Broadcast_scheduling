/**
 * @file src/modules/broadcast/components/rundown/summary/SummaryActionToolbar.jsx
 * @description Sol tarafta yer alan Konum Seçici (Üst / Seçili Altı / Alt), "+ Ekle" açılır menüsü
 * (Program Ekle, Dolgu Kuşağı Ekle, Reklam Kuşağı Ekle) ve Geri/İleri Al (Undo/Redo) kontrolleri.
 */
import React, { useState, useRef, useEffect, memo } from 'react';
import {
  Plus,
  Megaphone,
  Settings,
  Check,
  Sparkles,
  ChevronDown,
  Film,
  ArrowUpToLine,
  CornerDownRight,
  ArrowDownToLine
} from 'lucide-react';
import { secondsToTimecode } from '../../../utils/timecodeUtils';
import useBroadcastStore from '../../../store/broadcastStore';
import Ikon from '../../../../../components/Ikon';

const SummaryActionToolbar = memo(function SummaryActionToolbar({
  adBreakDefaultSettings,
  insertPosition = 'after_selected',
  setInsertPosition,
  onUpdateAdBreakDefaultSettings,
  onQuickAddAdBreak,
  onQuickAddFillerSlot,
  onOpenAddModal
}) {
  const isDraftSidebarOpen = useBroadcastStore(state => state.isDraftSidebarOpen);
  const toggleDraftSidebar = useBroadcastStore(state => state.toggleDraftSidebar);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [showAdSettingsInline, setShowAdSettingsInline] = useState(false);
  const [adDurMinInput, setAdDurMinInput] = useState(() =>
    String(adBreakDefaultSettings?.durationMinutes ?? 5)
  );
  const [adDurSecInput, setAdDurSecInput] = useState(() =>
    String(adBreakDefaultSettings?.durationSeconds ?? 0)
  );
  const [adNoteInput, setAdNoteInput] = useState(
    () => adBreakDefaultSettings?.note ?? 'Ticari Reklam Bloğu'
  );
  const addMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = e => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target)) {
        setIsAddMenuOpen(false);
        setShowAdSettingsInline(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveAdDefaultSettings = e => {
    e.preventDefault();
    const mins = Math.max(0, parseInt(adDurMinInput, 10) || 0);
    const secs = Math.max(0, Math.min(59, parseInt(adDurSecInput, 10) || 0));
    const totalSec = Math.max(1, mins * 60 + secs);
    onUpdateAdBreakDefaultSettings({
      durationMinutes: mins,
      durationSeconds: secs,
      durationTc: secondsToTimecode(totalSec),
      note: adNoteInput.trim() || 'Ticari Reklam Bloğu'
    });
    setShowAdSettingsInline(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', flexShrink: 0 }}>
      {/* 0. EN SOL: BELİRGİN TASLAK PANELİ AÇ / KAPAT BUTONU */}
      <button
        type="button"
        onClick={toggleDraftSidebar}
        title="Sol Taslak & Klip panelini göster/gizle (Kısayol: T)"
        style={{
          height: '34px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          background: isDraftSidebarOpen ? 'var(--turkuaz, #0C617C)' : '#FFFFFF',
          border: '1.5px solid var(--turkuaz, #0C617C)',
          color: isDraftSidebarOpen ? '#FFFFFF' : 'var(--turkuaz, #0C617C)',
          padding: '0 13px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '12.5px',
          fontWeight: 800,
          whiteSpace: 'nowrap',
          boxShadow: isDraftSidebarOpen ? '0 2px 6px rgba(12, 97, 124, 0.22)' : 'none'
        }}
      >
        <Ikon ad="panel" size={15} />
        <span>{isDraftSidebarOpen ? 'Taslak Paneli Açık' : 'Taslak Paneli'}</span>
      </button>

      {/* 1. SOL: EKLEME YERİ (ÜST / SEÇİLİ ALTI / ALT KONUM SEÇİCİSİ) */}
      {setInsertPosition && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '3px 3px 3px 8px',
            gap: '4px'
          }}
          title="Yeni eklenecek, çoğaltılacak veya yapıştırılacak program/kliplerin listeye yerleşeceği konum"
        >
          <span style={{
            fontSize: '11px',
            fontWeight: 800,
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            marginRight: '2px'
          }}>
            Ekleme Yeri:
          </span>
          {[
            { id: 'top', label: 'Üst', icon: ArrowUpToLine, tip: 'Yeni öğeyi listenin EN ÜSTÜNE (1. sıraya) ekler' },
            { id: 'after_selected', label: 'Seçili Altı', icon: CornerDownRight, tip: 'Yeni öğeyi tabloda SEÇİLİ OLAN SATIRIN HEMEN ALTINA ekler' },
            { id: 'bottom', label: 'Alt', icon: ArrowDownToLine, tip: 'Yeni öğeyi listenin EN ALTINA (son sıraya) ekler' }
          ].map(opt => {
            const Icon = opt.icon;
            const active = insertPosition === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setInsertPosition(opt.id)}
                title={opt.tip}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: 'none',
                  background: active ? 'var(--accent-primary)' : 'transparent',
                  color: active ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s'
                }}
              >
                <Icon size={12} />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 2. "+ EKLE" AÇILIR MENÜ BUTONU (Program Ekle / Dolgu Ekle / Reklam Ekle) */}
      <div ref={addMenuRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setIsAddMenuOpen(prev => !prev)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 10px',
            borderRadius: '8px',
            border: 'none',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: '800',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
          }}
        >
          <Plus size={14} />
          <span>Ekle</span>
          <ChevronDown size={13} />
        </button>

        {isAddMenuOpen && (
          <div
            style={{
              position: 'absolute',
              top: '44px',
              left: 0,
              width: '275px',
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
            {/* Program Ekle */}
            <button
              type="button"
              onClick={() => {
                setIsAddMenuOpen(false);
                if (onOpenAddModal) onOpenAddModal();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: '800',
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Film size={17} color="#10b981" />
                <span>Program / Klip Ekle</span>
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                P
              </span>
            </button>

            {/* Dolgu Kuşağı Ekle */}
            {onQuickAddFillerSlot && (
              <button
                type="button"
                onClick={() => {
                  setIsAddMenuOpen(false);
                  onQuickAddFillerSlot();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Sparkles size={17} color="#8b5cf6" />
                  <span>Dolgu Kuşağı Ekle</span>
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  D
                </span>
              </button>
            )}

            {/* Reklam Kuşağı Ekle + Süre Ayarı */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={() => {
                  setIsAddMenuOpen(false);
                  if (onQuickAddAdBreak) onQuickAddAdBreak();
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Megaphone size={17} color="#f59e0b" />
                  <span>Reklam Ekle ({adBreakDefaultSettings?.durationMinutes ?? 5} dk)</span>
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  R
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAdDurMinInput(String(adBreakDefaultSettings?.durationMinutes ?? 5));
                  setAdDurSecInput(String(adBreakDefaultSettings?.durationSeconds ?? 0));
                  setAdNoteInput(adBreakDefaultSettings?.note ?? 'Ticari Reklam Bloğu');
                  setShowAdSettingsInline(prev => !prev);
                }}
                title="Varsayılan Reklam Süresini Ayarla"
                style={{
                  padding: '9px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: showAdSettingsInline ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Settings size={15} />
              </button>
            </div>

            {showAdSettingsInline && (
              <form
                onSubmit={handleSaveAdDefaultSettings}
                style={{
                  marginTop: '4px',
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                      Dakika
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={adDurMinInput}
                      onChange={e => setAdDurMinInput(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '5px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        fontWeight: '800',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                      Saniye
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={adDurSecInput}
                      onChange={e => setAdDurSecInput(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '5px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        fontWeight: '800',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#f59e0b',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}
                >
                  <Check size={14} /> Süreyi Kaydet
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default SummaryActionToolbar;
