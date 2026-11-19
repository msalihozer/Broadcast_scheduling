/**
 * @file src/modules/broadcast/components/rundown/summary/SummaryDurationBadges.jsx
 * @description Yayın akışı kontrol çubuğunun ortasında yer alan, büyük ve okunaklı
 * 24 saatlik doluluk oranı, toplam süre ve sarkma/eksik süre göstergesi.
 */
import React, { memo } from 'react';
import { Clock, ArrowRight, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import {
  framesToTimecode,
  formatFramesHuman
} from '../../../utils/timecodeUtils';
import { parseTimecodeDisplay } from '../../../utils/rundownHelpers';

const SummaryDurationBadges = memo(function SummaryDurationBadges({
  programsCount = 0,
  fillPercentage = 0,
  totalDayUsageFrames = 0,
  prevOverflowFrames = 0,
  nextOverflowFrames = 0,
  remainingFrames = 0,
  onGoToNextDay
}) {
  const tomorrowStartClock = parseTimecodeDisplay(framesToTimecode(nextOverflowFrames)).hhmmss;
  const totalClock = parseTimecodeDisplay(framesToTimecode(totalDayUsageFrames)).hhmmss;

  const isOverflow = nextOverflowFrames > 0;
  const isComplete = !isOverflow && remainingFrames === 0 && programsCount > 0;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'nowrap',
        gap: '7px',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        padding: '4px 9px',
        borderRadius: '8px',
        fontSize: '12px',
        minWidth: 0
      }}
      title={`Toplam Süre: ${formatFramesHuman(totalDayUsageFrames)} / 24 saat`}
    >
      {/* Doluluk Yüzdesi */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
        <span style={{ fontWeight: '800', color: 'var(--text-secondary)', fontSize: '11.5px' }}>
          Doluluk:
        </span>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '12px',
            fontWeight: '900',
            color: '#ffffff',
            background: isOverflow
              ? '#ef4444'
              : isComplete
              ? '#10b981'
              : 'var(--accent-primary)',
            padding: '1px 6px',
            borderRadius: '5px'
          }}
        >
          %{fillPercentage.toFixed(1)}
        </span>
      </div>

      {/* Toplam Süre */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          borderLeft: '1px solid var(--border-color)',
          paddingLeft: '7px',
          whiteSpace: 'nowrap'
        }}
      >
        <Clock size={13} color="var(--accent-primary)" />
        <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)', fontSize: '12.5px' }}>
          {totalClock}
        </strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700' }}>
          /24:00
        </span>
      </div>

      {/* Varsa Dünden Devir */}
      {prevOverflowFrames > 0 && (
        <span
          style={{
            color: '#d97706',
            fontWeight: '800',
            fontSize: '11.5px',
            borderLeft: '1px solid var(--border-color)',
            paddingLeft: '7px',
            whiteSpace: 'nowrap'
          }}
        >
          Devir: +{formatFramesHuman(prevOverflowFrames)}
        </span>
      )}

      {/* Eksik / Sarkma / Tam Dolu Durumu */}
      {remainingFrames > 0 ? (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            color: '#d97706',
            fontWeight: '800',
            fontSize: '11.5px',
            borderLeft: '1px solid var(--border-color)',
            paddingLeft: '7px',
            whiteSpace: 'nowrap'
          }}
        >
          <AlertTriangle size={12} />
          <span>Eksik: {formatFramesHuman(remainingFrames)}</span>
        </div>
      ) : isOverflow ? (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            borderLeft: '1px solid var(--border-color)',
            paddingLeft: '7px',
            color: '#dc2626',
            fontWeight: '800',
            fontSize: '11.5px',
            whiteSpace: 'nowrap'
          }}
        >
          <AlertCircle size={12} />
          <span>+{formatFramesHuman(nextOverflowFrames)}</span>
          {onGoToNextDay && (
            <button
              type="button"
              onClick={onGoToNextDay}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '1px 6px',
                borderRadius: '5px',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#dc2626',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
              title={`Yarın ${tomorrowStartClock} itibarıyla başlıyor — Ertesi güne git`}
            >
              <span>Yarın</span>
              <ArrowRight size={11} />
            </button>
          )}
        </div>
      ) : isComplete ? (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            borderLeft: '1px solid var(--border-color)',
            paddingLeft: '7px',
            color: '#059669',
            fontWeight: '800',
            fontSize: '11.5px',
            whiteSpace: 'nowrap'
          }}
        >
          <CheckCircle2 size={12} />
          <span>Tam Dolu</span>
        </div>
      ) : null}
    </div>
  );
});

export default SummaryDurationBadges;
