/**
 * @file src/pages/admin/archive/ArchiveMetrics.jsx
 * @description Seçili arşiv kategorisine ait özet istatistik kartları:
 * Kullanılan (Aktif) Program Sayısı, Toplam Program Başlığı, Toplam Video Klip ve Toplam Arşiv Süresi (HH.MM.SS.FF).
 */
import React from 'react';
import { Layers, FileVideo, Clock, ShieldCheck } from 'lucide-react';
import { formatTimecode } from '../../../utils/formatTimecode';

const ArchiveMetrics = ({ 
  activeProgramsCount, 
  totalProgramsCount, 
  totalClipsCount, 
  totalDurationSec, 
  catMeta,
  statusFilter = 'all'
}) => {
  const formatHourMin = (sec) => {
    if (!sec || isNaN(sec)) return '0 dk';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h.toLocaleString('tr-TR')} sa ${m} dk ${s > 0 ? `${s} sn` : ''}`.trim();
    if (m > 0) return `${m} dk ${s > 0 ? `${s} sn` : ''}`.trim();
    return `${s} sn`;
  };

  const formatExactTime = (sec) => {
    if (!sec || isNaN(sec)) return '00:00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const clipsLabel = statusFilter === 'active' ? 'Yayındaki Klip' : statusFilter === 'inactive' ? 'Kullanım Dışı Klip' : 'Toplam Video Klip';
  const durationLabel = statusFilter === 'active' ? 'Yayındaki Toplam Süre' : statusFilter === 'inactive' ? 'Kullanım Dışı Süre' : 'Toplam Arşiv Süresi';
  const progsLabel = statusFilter === 'active' ? 'Yayındaki Program' : statusFilter === 'inactive' ? 'Kullanım Dışı Program' : 'Toplam Program Başlığı';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '16px'
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        padding: '18px 22px',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          color: '#10b981',
          padding: '12px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <ShieldCheck size={24} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Kullanılan (Aktif) Program
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>
            {Number(activeProgramsCount || 0).toLocaleString('tr-TR')} Program
          </div>
        </div>
      </div>

      <div style={{
        background: 'var(--bg-secondary)',
        padding: '18px 22px',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{
          background: catMeta.bg,
          color: catMeta.color,
          padding: '12px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Layers size={24} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {progsLabel}
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
            {Number(totalProgramsCount || 0).toLocaleString('tr-TR')} Başlık
          </div>
        </div>
      </div>

      <div style={{
        background: 'var(--bg-secondary)',
        padding: '18px 22px',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{
          background: 'rgba(59, 130, 246, 0.15)',
          color: '#3b82f6',
          padding: '12px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <FileVideo size={24} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {clipsLabel}
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
            {Number(totalClipsCount || 0).toLocaleString('tr-TR')} Klip
          </div>
        </div>
      </div>

      <div style={{
        background: 'var(--bg-secondary)',
        padding: '18px 22px',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{
          background: 'rgba(168, 85, 247, 0.15)',
          color: '#a855f7',
          padding: '12px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Clock size={24} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {durationLabel}
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px', fontFamily: 'monospace' }}>
            {formatTimecode(totalDurationSec)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            saat.dakika.saniye.salise
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArchiveMetrics;
