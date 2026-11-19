/**
 * @file src/modules/broadcast/components/sidebar/DraftSidebarEmptyState.jsx
 * @description Seçili tarihte (`selectedDate`) henüz taslak akış bulunmadığında sol panelde gösterilen
 * bilgilendirme, "Taslağı Hazır Olan Günler" hızlı geçiş listesi ve "Taslak Planlamaya Git" butonunu
 * barındıran alt bileşen.
 */
import React, { memo } from 'react';
import { FileSpreadsheet, Calendar, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DraftSidebarEmptyState = memo(function DraftSidebarEmptyState({
  selectedDate = '',
  availableDraftDates = [],
  onSelectDate
}) {
  const navigate = useNavigate();

  return (
    <div style={{
      padding: '26px 16px',
      textAlign: 'center',
      color: 'var(--text-secondary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '10px'
    }}>
      <FileSpreadsheet size={38} color="var(--border-color)" />
      <span style={{ fontSize: '14.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
        {selectedDate} günü için taslak akış bulunmuyor
      </span>
      <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', maxWidth: '340px', lineHeight: 1.5 }}>
        Bu tarihe ait Taslak Planlama modülünde oluşturulmuş veya gönderilmiş bir taslak yok. Taslak Planlamadan bu gün için akış hazırlayabilir ya da aşağıdan taslağı hazır olan bir güne geçebilirsiniz.
      </span>

      {availableDraftDates.length > 0 && (
        <div style={{
          width: '100%',
          marginTop: '8px',
          padding: '12px',
          borderRadius: '10px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '800',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Calendar size={14} color="var(--accent-primary)" />
            <span>Taslağı Hazır Olan Günler ({availableDraftDates.length} Gün):</span>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            maxHeight: '210px',
            overflowY: 'auto'
          }}>
            {availableDraftDates.map(d => (
              <button
                key={d.dateStr}
                type="button"
                onClick={() => onSelectDate(d.dateStr)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: '7px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span>
                  <strong style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{d.dateStr}</strong>
                  {d.dayName ? ` • ${d.dayName}` : ''}
                </span>
                <span style={{
                  background: 'rgba(59, 130, 246, 0.14)',
                  color: 'var(--accent-primary)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: '800'
                }}>
                  {d.count} Kuşak
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate('/draft')}
        style={{
          marginTop: '6px',
          padding: '9px 14px',
          borderRadius: '8px',
          background: 'rgba(59, 130, 246, 0.15)',
          color: 'var(--accent-primary)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          fontSize: '13px',
          fontWeight: '800',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        <ExternalLink size={14} />
        <span>Taslak Planlamaya Git</span>
      </button>
    </div>
  );
});

export default DraftSidebarEmptyState;
