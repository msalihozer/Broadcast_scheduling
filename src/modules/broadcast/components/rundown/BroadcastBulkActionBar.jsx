/**
 * @file src/modules/broadcast/components/rundown/BroadcastBulkActionBar.jsx
 * @description Yayın akışı tablosunda bir klip/satır seçildiğinde beliren sade "ⓘ" (Klip Bilgileri, Detaylar & Oynatma)
 * ve "📌" (Saate Sabitleme - Otomatik Çıkış Saati Hesaplamalı) alt işlem çubuğu.
 */
import React, { memo, useState, useEffect, useMemo } from 'react';
import { Info, Play, Copy, X, Pin, PinOff, Check, Clock } from 'lucide-react';
import {
  formatFramesHuman,
  parseClockTimeToFrames,
  framesToClockTime
} from '../../utils/timecodeUtils';
import { parseTimecodeDisplay } from '../../utils/rundownHelpers';

const BroadcastBulkActionBar = memo(function BroadcastBulkActionBar({
  selectedProgram,
  selectedCount = 0,
  onBulkCopy,
  onInspectClip,
  onPinProgram,
  onUnpinProgram,
  onClearSelection
}) {
  const [isPinPopoverOpen, setIsPinPopoverOpen] = useState(false);
  const [pinTimeInput, setPinTimeInput] = useState('');

  useEffect(() => {
    setIsPinPopoverOpen(false);
    if (selectedProgram) {
      const startInfo = parseTimecodeDisplay(selectedProgram.calculatedStartTime);
      setPinTimeInput(
        selectedProgram.pinnedStartTime || `${startInfo.hh}:${startInfo.mm}:${startInfo.ss}`
      );
    }
  }, [selectedProgram?.instanceId, selectedProgram?.isPinnedTime, selectedProgram?.pinnedStartTime, selectedProgram?.calculatedStartTime]);

  const previewTimes = useMemo(() => {
    if (!selectedProgram) return null;
    const startFrames = parseClockTimeToFrames(pinTimeInput);
    if (startFrames === null) return null;
    const itemFrames = selectedProgram.durationFrames || 0;
    const endFrames = startFrames + itemFrames;
    const startTc = framesToClockTime(startFrames);
    const endTc = framesToClockTime(endFrames);
    const sDisp = parseTimecodeDisplay(startTc);
    const eDisp = parseTimecodeDisplay(endTc);
    return {
      startFrames,
      startHhMmSs: `${sDisp.hh}:${sDisp.mm}:${sDisp.ss}`,
      endHhMmSs: `${eDisp.hh}:${eDisp.mm}:${eDisp.ss}`
    };
  }, [pinTimeInput, selectedProgram]);

  if (!selectedProgram && selectedCount <= 0) return null;

  // Çoklu Seçim (Ctrl+A vb.) durumunda kompakt Kopyala pili
  if (selectedCount > 1) {
    return (
      <div
        style={{
          position: 'sticky',
          bottom: '14px',
          margin: '12px auto 0 auto',
          zIndex: 100,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--bg-secondary)',
            border: '1.5px solid rgba(59, 130, 246, 0.5)',
            borderRadius: '999px',
            padding: '6px 10px 6px 14px',
            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.38)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--accent-primary)' }}>
            {selectedCount} Öğe Seçili
          </span>

          {onBulkCopy && (
            <button
              type="button"
              onClick={onBulkCopy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--accent-primary)',
                border: 'none',
                color: '#ffffff',
                padding: '5px 12px',
                borderRadius: '999px',
                fontSize: '12.5px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              <Copy size={13} />
              <span>Panoya Kopyala (Ctrl+C)</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClearSelection}
            title="Seçimi Kaldır (Esc)"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  if (!selectedProgram) return null;

  const displayName =
    selectedProgram.clipName ||
    selectedProgram.title ||
    selectedProgram.name ||
    'Seçili Klip';
  const startInfo = parseTimecodeDisplay(selectedProgram.calculatedStartTime);
  const endInfo = parseTimecodeDisplay(selectedProgram.calculatedEndTime);
  const readableDur = formatFramesHuman(selectedProgram.durationFrames);
  const isPinned = Boolean(selectedProgram.isPinnedTime);

  const handleConfirmPin = (e) => {
    if (e) e.preventDefault();
    if (!previewTimes || !onPinProgram) return;
    onPinProgram(
      selectedProgram.instanceId,
      previewTimes.startHhMmSs,
      previewTimes.startFrames
    );
    setIsPinPopoverOpen(false);
  };

  return (
    <div
      style={{
        position: 'sticky',
        bottom: '14px',
        margin: '12px auto 0 auto',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'none'
      }}
    >
      {/* SAAT SABİTLEME GİRİŞ PANELİ (Giriş Saati Girilir -> Çıkış Saati Otomatik Hesaplanır) */}
      {isPinPopoverOpen && (
        <form
          onSubmit={handleConfirmPin}
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            background: 'var(--bg-secondary)',
            border: '2px solid #f59e0b',
            borderRadius: '14px',
            padding: '10px 14px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.42)',
            backdropFilter: 'blur(12px)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d97706', fontWeight: '900', fontSize: '12.5px' }}>
            <Pin size={15} />
            <span>Sabitlenecek Giriş Saati:</span>
          </div>

          <input
            type="text"
            autoFocus
            value={pinTimeInput}
            onChange={(e) => setPinTimeInput(e.target.value)}
            placeholder="Örn: 05:00:00"
            style={{
              width: '98px',
              padding: '5px 9px',
              borderRadius: '8px',
              border: '1.5px solid #f59e0b',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
              fontSize: '13.5px',
              fontWeight: '900',
              textAlign: 'center',
              outline: 'none'
            }}
          />

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.38)',
              padding: '5px 10px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: '800',
              color: 'var(--text-primary)'
            }}
            title="Program/klip süresine göre otomatik hesaplanan çıkış (bitiş) saati"
          >
            <Clock size={13} color="#d97706" />
            <span style={{ color: 'var(--text-secondary)' }}>Çıkış (Otomatik):</span>
            <span style={{ fontFamily: 'monospace', fontWeight: '900', color: '#d97706', fontSize: '13.5px' }}>
              {previewTimes ? previewTimes.endHhMmSs : '--:--:--'}
            </span>
            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              ({readableDur})
            </span>
          </div>

          <button
            type="submit"
            disabled={!previewTimes}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: previewTimes ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' : 'var(--bg-tertiary)',
              color: previewTimes ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              padding: '6px 13px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: '900',
              cursor: previewTimes ? 'pointer' : 'not-allowed',
              boxShadow: previewTimes ? '0 3px 10px rgba(245, 158, 11, 0.35)' : 'none'
            }}
          >
            <Check size={14} />
            <span>Saati Sabitle</span>
          </button>

          {isPinned && onUnpinProgram && (
            <button
              type="button"
              onClick={() => {
                onUnpinProgram(selectedProgram.instanceId);
                setIsPinPopoverOpen(false);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(239, 68, 68, 0.14)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                padding: '5px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              <PinOff size={13} />
              <span>Sabitlemeyi Kaldır</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsPinPopoverOpen(false)}
            title="Kapat"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={13} />
          </button>
        </form>
      )}

      {/* ANA SEÇİLİ ÖĞE ÇUBUĞU */}
      <div
        style={{
          pointerEvents: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--bg-secondary)',
          border: `1.5px solid ${isPinned ? 'rgba(245, 158, 11, 0.65)' : 'rgba(59, 130, 246, 0.5)'}`,
          borderRadius: '999px',
          padding: '6px 10px 6px 8px',
          boxShadow: '0 10px 28px rgba(0, 0, 0, 0.38)',
          backdropFilter: 'blur(10px)'
        }}
      >
        {/* Belirgin "i" İkonu */}
        <button
          type="button"
          onClick={() => onInspectClip && onInspectClip(selectedProgram)}
          title="Seçili klibin bilgilerini, detaylarını ve video oynatıcısını aç"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
            color: '#ffffff',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(37, 99, 235, 0.35)',
            cursor: 'pointer',
            flexShrink: 0,
            padding: 0
          }}
        >
          <Info size={18} />
        </button>

        {/* "i" İşaretinin Hemen Yanında SAAT SABİTLEME (Pin) İkonu */}
        <button
          type="button"
          onClick={() => setIsPinPopoverOpen(prev => !prev)}
          title={
            isPinned
              ? `Bu öğe ${startInfo.hhmm}:${startInfo.ss} saatine sabitlendi (Değiştirmek veya kaldırmak için tıklayın)`
              : 'Bu programı/klibi belirli bir saate sabitle (Üst ve alttaki değişikliklerden etkilenmez)'
          }
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: isPinned || isPinPopoverOpen
              ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)'
              : 'var(--bg-primary)',
            color: isPinned || isPinPopoverOpen ? '#ffffff' : '#d97706',
            border: isPinned || isPinPopoverOpen
              ? 'none'
              : '1.5px solid rgba(245, 158, 11, 0.55)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isPinned || isPinPopoverOpen
              ? '0 3px 10px rgba(245, 158, 11, 0.38)'
              : 'none',
            cursor: 'pointer',
            flexShrink: 0,
            padding: 0,
            transition: 'all 0.15s ease'
          }}
        >
          <Pin size={16} />
        </button>

        {/* Seçili Klip Özeti ve Bilgiler & Oynat Butonu */}
        <button
          type="button"
          onClick={() => onInspectClip && onInspectClip(selectedProgram)}
          title="Seçili klibin bilgilerini, detaylarını ve video oynatıcısını aç"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            background: 'transparent',
            border: 'none',
            padding: '2px 4px',
            cursor: 'pointer',
            color: 'var(--text-primary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
            <span
              style={{
                fontWeight: '800',
                fontSize: '14px',
                color: 'var(--text-primary)',
                maxWidth: '320px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {displayName}
            </span>

            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '13px',
                fontWeight: '800',
                color: isPinned ? '#d97706' : 'var(--accent-primary)',
                background: isPinned ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-primary)',
                border: `1px solid ${isPinned ? 'rgba(245, 158, 11, 0.45)' : 'var(--border-color)'}`,
                padding: '3px 8px',
                borderRadius: '6px'
              }}
            >
              {isPinned ? '📌 ' : ''}{startInfo.hhmm}:{startInfo.ss} → {endInfo.hhmm}:{endInfo.ss} ({readableDur})
            </span>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(16, 185, 129, 0.14)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#10b981',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '12.5px',
                fontWeight: '800'
              }}
            >
              <Play size={12} fill="#10b981" />
              <span>Bilgiler & Oynat</span>
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={onClearSelection}
          title="Seçimi Kaldır (Esc)"
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
});

export default BroadcastBulkActionBar;
