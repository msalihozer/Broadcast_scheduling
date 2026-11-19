/**
 * @file ItemDetailsPanel.jsx
 * @description Seçili program klibinin detay paneli ve video oynatıcı arayüzü.
 * 
 * Temel Sorumluluklar:
 * 1. Seçili klibin teknik ve editoryal metaverilerini gösterme (Süre, Kategori, Trim In/Out, MAM ID)
 * 2. Backend FFmpeg stream hattı (/api/stream) üzerinden Plyr oynatıcı ile anlık canlı önizleme
 * 3. Paneli daraltma / genişletme (katlanabilir yan panel)
 */
import React, { useState, useEffect } from 'react';
import usePlanningStore from '../../store/planningStore';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { Plyr } from 'plyr-react';
import 'plyr-react/plyr.css';

import { formatTime } from '../../utils/timeFormat';

const getCategoryName = (categoryId) => {
  switch (categoryId) {
    case 2: return 'Haber';
    case 6: return 'Reklam';
    case 1: return 'Program';
    case 3: return 'Spor';
    case 5: return 'Hava Durumu';
    default: return 'Diğer';
  }
};

const DetailRow = ({ label, value, isBadge }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'flex-start', fontSize: '13px', padding: '6px 0' }}>
    <div style={{ color: 'var(--text-muted)' }}>{label}</div>
    <div style={{ color: 'var(--text-secondary)' }}>
      {isBadge ? (
        <span style={{ background: '#2563eb', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
          {value}
        </span>
      ) : (
        value
      )}
    </div>
  </div>
);

const Accordion = ({ title }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: '1px solid var(--border-color)' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}
      >
        <span>{title}</span>
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>
      {open && (
        <div style={{ padding: '0 16px 12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
          Detaylar eklenecek...
        </div>
      )}
    </div>
  );
};

const ItemDetailsPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPlayerActive, setIsPlayerActive] = useState(false);
  const selectedBlock = usePlanningStore(state => state.selectedTimelineBlock);

  useEffect(() => {
    setIsPlayerActive(false);
  }, [selectedBlock?.program?.id]);

  if (!isOpen) {
    return (
      <div
        onClick={() => setIsOpen(true)}
        style={{ width: '32px', background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', cursor: 'pointer', color: 'var(--text-muted)' }}
      >
        <ChevronLeft size={20} />
        <div style={{ writingMode: 'vertical-rl', marginTop: '16px', letterSpacing: '2px', fontSize: '12px', fontWeight: 'bold' }}>DETAYLAR</div>
      </div>
    );
  }

  if (!selectedBlock) return (
    <div style={{ width: 'var(--right-panel-width)', background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
      Öğe seçilmedi
    </div>
  );

  const { program } = selectedBlock;
  const canStream = !program.id.toString().startsWith('tpl-') && !program.id.toString().startsWith('sp_') && (program.publicFileAddress || program.id);

  return (
    <div style={{
      width: 'var(--right-panel-width)',
      background: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      flexShrink: 0,
      overflowY: 'auto'
    }}>
      <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-primary)', flexShrink: 0 }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>Öğe Detayları</h3>
        <ChevronRight size={16} color="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={() => setIsOpen(false)} />
      </div>

      <div style={{ padding: '0 16px 16px 16px' }}>
        {/* Video Player: Yalnızca videoya tıklandığında FFmpeg başlatılır */}
        <div style={{ 
          width: '100%', 
          aspectRatio: '16/9', 
          background: '#090d16', 
          borderRadius: '8px', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          marginBottom: '20px',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid var(--border-color)'
        }}>
          {canStream ? (
            isPlayerActive ? (
              <div style={{ width: '100%', height: '100%' }}>
                <Plyr
                  source={{
                    type: 'video',
                    sources: [
                      {
                        src: `/api/stream?id=${program.id}&fileName=${encodeURIComponent(program.fileName || '')}&publicAddress=${encodeURIComponent(program.publicFileAddress || '')}`,
                        type: 'video/mp4',
                      }
                    ],
                  }}
                  options={{
                    autoplay: true,
                    controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
                    duration: program.duration * 60,
                  }}
                />
              </div>
            ) : (
              <div
                onClick={() => setIsPlayerActive(true)}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  background: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.16) 0%, rgba(9, 13, 22, 0.96) 75%)',
                  padding: '16px',
                  textAlign: 'center',
                  userSelect: 'none'
                }}
                title="Videoyu başlatmak için tıklayın"
              >
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 6px 18px rgba(16, 185, 129, 0.4)'
                }}>
                  <Play size={22} color="#fff" fill="#fff" style={{ marginLeft: '2px' }} />
                </div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#fff' }}>
                  Videoyu Oynatmak İçin Tıklayın
                </div>
              </div>
            )
          ) : (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
              <div style={{ fontSize: '13px' }}>Önizleme Yok</div>
              <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.6 }}>({program.title})</div>
            </div>
          )}
        </div>

        {/* Details Table */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <DetailRow label="ID" value={program.id} />
          <DetailRow label="Başlık" value={program.title} />
          <DetailRow label="Tür" value={program.type || "Video"} />
          <DetailRow label="Oluşturulma" value={program.fileCreateTime ? new Date(program.fileCreateTime).toLocaleString('tr-TR') : '-'} />
          <DetailRow label="Dosya" value={program.fileName || (program.title.toLowerCase().replace(/ /g, '-') + '.mxf')} />
          <DetailRow label="Süre" value={formatTime(program.duration)} />
          {program.trimIn != null && <DetailRow label="Trim In" value={program.trimIn} />}
          {program.trimOut != null && <DetailRow label="Trim Out" value={program.trimOut} />}
          <DetailRow label="Başlangıç" value={formatTime(program.startMinute)} />
          <DetailRow label="Bitiş" value={formatTime((program.startMinute || 0) + (program.duration || 0))} />
          <DetailRow label="Kategori" value={program.categoryName || getCategoryName(program.categoryId)} isBadge />
          <DetailRow label="Açıklama" value={program.description || 'Açıklama bulunmuyor.'} />
          
          {program.metadata && program.metadata.length > 0 && (
            <>
              <div style={{ padding: '8px 0', marginTop: '8px', borderTop: '1px solid var(--border-color)', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                Metadatalar
              </div>
              {program.metadata.map((meta, idx) => (
                <DetailRow key={idx} label={meta.keyName} value={meta.val || '-'} />
              ))}
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 'auto' }}>
        <Accordion title="Gelişmiş Ayarlar" />
        <Accordion title="Klip Notları" />
        <Accordion title="Etiketler" />
      </div>
    </div>
  );
};

export default ItemDetailsPanel;
