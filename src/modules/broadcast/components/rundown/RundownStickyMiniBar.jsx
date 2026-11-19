/**
 * @file src/modules/broadcast/components/rundown/RundownStickyMiniBar.jsx
 * @description Kullanıcı yayın akışı listesinde aşağı doğru kaydırdığında (`isScrolledDown === true`)
 * ekranın en üstünde beliren minimal, tek satırlık 24 Saat Doluluk göstergesi ve hızlı ekleme/kaydetme çubuğu.
 */
import React, { memo } from 'react';
import {
  Plus, Sparkles, Megaphone, Save, AlertTriangle, CheckCircle2, AlertCircle
} from 'lucide-react';
import {
  framesToTimecode,
  formatFramesHuman
} from '../../utils/timecodeUtils';
import { parseTimecodeDisplay } from '../../utils/rundownHelpers';

const RundownStickyMiniBar = memo(function RundownStickyMiniBar({
  isScrolledDown = false,
  fillPercentage = 0,
  totalDayUsageFrames = 0,
  remainingFrames = 0,
  nextOverflowFrames = 0,
  programsCount = 0,
  onOpenAddModal,
  onQuickAddFillerSlot,
  onQuickAddAdBreak,
  onSaveSchedule
}) {
  if (!isScrolledDown) return null;

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 35,
      padding: '6px 14px',
      background: 'rgba(15, 23, 42, 0.94)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      flexWrap: 'wrap',
      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.22)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: 'monospace',
          fontSize: '12.5px',
          fontWeight: '900',
          color: '#ffffff',
          background: nextOverflowFrames > 0
            ? '#ef4444'
            : remainingFrames === 0 && programsCount > 0
            ? '#10b981'
            : 'var(--accent-primary)',
          padding: '2px 8px',
          borderRadius: '5px'
        }}>
          Doluluk: %{fillPercentage.toFixed(1)}
        </span>

        {/* İnce Minimal Progress Bar */}
        <div style={{
          width: '120px',
          height: '6px',
          background: 'rgba(255,255,255,0.14)',
          borderRadius: '999px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${fillPercentage}%`,
            height: '100%',
            background: nextOverflowFrames > 0
              ? '#ef4444'
              : fillPercentage >= 99.5
              ? '#10b981'
              : '#3b82f6',
            transition: 'width 0.25s ease'
          }} />
        </div>

        <span style={{ fontSize: '12px', color: '#e2e8f0', fontFamily: 'monospace', fontWeight: '800' }}>
          {parseTimecodeDisplay(framesToTimecode(totalDayUsageFrames)).hhmmss} / 24:00:00
        </span>

        {remainingFrames > 0 ? (
          <span style={{
            fontSize: '11.5px',
            color: '#fbbf24',
            fontWeight: '800',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <AlertTriangle size={12} />
            <span>Eksik: {formatFramesHuman(remainingFrames)}</span>
          </span>
        ) : nextOverflowFrames > 0 ? (
          <span style={{
            fontSize: '11.5px',
            color: '#f87171',
            fontWeight: '800',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <AlertCircle size={12} />
            <span>Fazla: +{formatFramesHuman(nextOverflowFrames)}</span>
          </span>
        ) : programsCount > 0 ? (
          <span style={{
            fontSize: '11.5px',
            color: '#34d399',
            fontWeight: '800',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <CheckCircle2 size={12} />
            <span>24 Saat Tam Dolu</span>
          </span>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          type="button"
          onClick={onOpenAddModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 9px',
            borderRadius: '6px',
            border: '1px solid rgba(59, 130, 246, 0.45)',
            background: 'rgba(59, 130, 246, 0.18)',
            color: '#60a5fa',
            fontSize: '11.5px',
            fontWeight: '800',
            cursor: 'pointer'
          }}
        >
          <Plus size={12} />
          <span>+ Program</span>
        </button>
        <button
          type="button"
          onClick={onQuickAddFillerSlot}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 9px',
            borderRadius: '6px',
            border: '1px solid rgba(139, 92, 246, 0.45)',
            background: 'rgba(139, 92, 246, 0.18)',
            color: '#c4b5fd',
            fontSize: '11.5px',
            fontWeight: '800',
            cursor: 'pointer'
          }}
        >
          <Sparkles size={12} />
          <span>+ Dolgu</span>
        </button>
        <button
          type="button"
          onClick={onQuickAddAdBreak}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 9px',
            borderRadius: '6px',
            border: '1px solid rgba(245, 158, 11, 0.45)',
            background: 'rgba(245, 158, 11, 0.18)',
            color: '#fbbf24',
            fontSize: '11.5px',
            fontWeight: '800',
            cursor: 'pointer'
          }}
        >
          <Megaphone size={12} />
          <span>+ Reklam</span>
        </button>
        <button
          type="button"
          onClick={onSaveSchedule}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 9px',
            borderRadius: '6px',
            border: '1px solid rgba(16, 185, 129, 0.45)',
            background: 'rgba(16, 185, 129, 0.2)',
            color: '#34d399',
            fontSize: '11.5px',
            fontWeight: '800',
            cursor: 'pointer'
          }}
        >
          <Save size={12} />
          <span>Kaydet</span>
        </button>
      </div>
    </div>
  );
});

export default RundownStickyMiniBar;

