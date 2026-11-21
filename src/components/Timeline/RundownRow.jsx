/**
 * @file RundownRow.jsx
 * @description Yayına Hazır (Ready) ve Liste Kontrol modlarındaki yayın akışı satır bileşeni.
 * 
 * Temel Sorumluluklar:
 * 1. @dnd-kit/sortable ile dikey akış tablosunda sürükle-bırak sıralama
 * 2. Programın yayın durumu rozeti (Hazır, Canlı, Planlandı, Taşma)
 * 3. Kategori rengi, süre, başlangıç ve bitiş zamanı gösterimi
 * 4. Çoklu seçim (Ctrl/Shift) ve klip eşleştirme modalı tetikleyicisi
 */
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, PlaySquare, Type, Wifi, Film, ChevronDown, PlayCircle } from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import useThemeStore from '../../store/themeStore';
import { getCategoryDetails } from '../../utils/categoryColors';
import { resolveProgramLogoForChannel } from '../../store/slices/ads/adsCatalogHelpers';

import { formatTime } from '../../utils/timeFormat';

const getStatusDetails = (program) => {
  if (program && program.publicFileAddress) {
    return { label: 'Hazır', color: 'var(--success)' };
  }

  // Fallback
  let label = 'Hazır';
  let color = 'var(--success)';

  if (program.title?.toLowerCase().includes('canlı')) {
    label = 'Canlı'; color = 'var(--error)';
  } else if (program.title?.toLowerCase().includes('boş')) {
    label = 'Planlandı'; color = 'var(--warning)';
  }
  
  return { label, color };
};

const getTypeIcon = (categoryId, title) => {
  if (title?.toLowerCase().includes('canlı')) return <Wifi size={16} color="var(--text-muted)" />;
  if (title?.toLowerCase().includes('grafik') || title?.toLowerCase().includes('reklam') || title?.toLowerCase().includes('bekleme')) return <Type size={16} color="var(--text-muted)" />;
  return <PlaySquare size={16} color="var(--text-muted)" />;
};

const RundownRow = ({ program, index, channelId, date, variant, isEditing, onFinishEdit, onEditRequest, isLocked, onMatchRequest }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver
  } = useSortable({
    id: program.instanceId,
    data: {
      type: 'timeline_row',
      program,
      channelId,
      date,
      index
    }
  });

  const [editDurationStr, setEditDurationStr] = React.useState(formatTime(program.duration));
  const [editStartStr, setEditStartStr] = React.useState(formatTime(program.startMinute));
  const [editTitleStr, setEditTitleStr] = React.useState(program.title || '');

  React.useEffect(() => {
    if (isEditing) {
      setEditDurationStr(formatTime(program.duration));
      setEditStartStr(formatTime(program.startMinute));
      setEditTitleStr(program.title || '');
    }
  }, [isEditing, program.duration, program.startMinute, program.title]);

  const updateProgramTime = usePlanningStore(state => state.currentMode === 'list-control' ? state.lcUpdateProgramTime : state.updateProgramTime);
  const setSelectedTimelineBlock = usePlanningStore(state => state.setSelectedTimelineBlock);
  const toggleSelection = usePlanningStore(state => state.toggleSelection);
  const selectedInstanceIds = usePlanningStore(state => state.selectedInstanceIds);
  const programsList = usePlanningStore(state => {
    const mode = state.currentMode || 'draft';
    if (mode === 'list-control') {
      return state.listControlDays[`list-control-${channelId}-${date}`]?.variants[variant]?.programs || [];
    }
    return state.days[`${mode}-${channelId}-${date}`]?.variants[variant]?.programs || [];
  });
  
  const timelineColumns = usePlanningStore(state => state.timelineColumns);
  const getColFlexStyle = (colId, fallbackWidth = 100) => {
    const col = timelineColumns.find(c => c.id === colId);
    const w = col ? col.width : fallbackWidth;
    if (w === -1) {
      return { flex: '1 1 200px', minWidth: '140px' };
    }
    return { flex: `0 0 ${w}px`, minWidth: `${w}px` };
  };

  const themeConfig = useThemeStore(state => state.config);
  const isSelected = selectedInstanceIds.includes(program.instanceId);

  const cat = getCategoryDetails(program.categoryId, program.categoryName);
  const isSpecialTemplate = program.id && String(program.id).startsWith('tpl-');
  const isAdRow = Boolean(program.isAdClip || program.isFromAds || String(program.id).toUpperCase() === 'TPL-3' || (program.title || '').toLocaleLowerCase('tr-TR').includes('reklam'));
  const rowColor = isAdRow
    ? (themeConfig?.modules?.['list-control']?.adBlockColor || themeConfig?.specialColors?.adBreakColor || cat.bg)
    : cat.bg;
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeft: isSpecialTemplate ? `6px dashed ${rowColor}` : `4px solid ${rowColor}`,
    borderBottom: isOver ? '2px solid var(--accent-primary)' : '1px solid transparent',
    borderTop: isOver ? '2px solid var(--accent-primary)' : '1px solid transparent',
    background: isSelected ? 'var(--bg-active-row)' : isOver ? 'var(--bg-tertiary)' : (isSpecialTemplate ? `${rowColor}33` : `linear-gradient(to right, ${rowColor}15, transparent 150px)`),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
    boxShadow: isDragging ? '0 10px 20px rgba(0,0,0,0.5)' : 'none',
    textTransform: isSpecialTemplate ? 'uppercase' : 'none',
    letterSpacing: isSpecialTemplate ? '0.5px' : 'normal',
    fontWeight: isSpecialTemplate ? '600' : 'normal',
  };

  const handleSave = () => {
    // Parse duration (HH:mm:ss) into minutes
    const parseTimeStringToMinutes = (timeStr) => {
      const parts = timeStr.split(':').map(Number);
      if (parts.length === 3) {
        return parts[0] * 60 + parts[1] + parts[2] / 60;
      }
      if (parts.length === 4) {
        // HH:mm:ss:ff -> ff (frame/salise) 25 fps üzerinden 40ms = 0.04s
        return parts[0] * 60 + parts[1] + parts[2] / 60 + parts[3] / 1500;
      }
      return 0; // fallback
    };

    const newDuration = parseTimeStringToMinutes(editDurationStr);
    const newStart = parseTimeStringToMinutes(editStartStr);

    // Only pass newStart if it actually changed, so we don't force recalculation from this row unnecessarily if only duration changed.
    const startChanged = Math.abs(newStart - program.startMinute) > 0.01;
    const titleChanged = editTitleStr.trim() !== program.title;

    updateProgramTime(
      channelId, 
      date, 
      variant, 
      program.instanceId, 
      newDuration, 
      startChanged ? newStart : undefined,
      titleChanged ? editTitleStr.trim() : undefined
    );
    if (onFinishEdit) onFinishEdit();
  };

  const handleBlur = (e) => {
    // Odak, row'un dışındaki bir elemente kaydıysa kaydet ve çık
    if (!e.currentTarget.contains(e.relatedTarget)) {
      handleSave();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      if (onFinishEdit) onFinishEdit();
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();

    // Çoklu seçim işlemi
    toggleSelection(program.instanceId, index, e.shiftKey, e.ctrlKey || e.metaKey, programsList);

    // Geriye dönük uyumluluk için (tekil işlem yapan butonlar son seçileni baz alır)
    setSelectedTimelineBlock({
      channelId,
      date,
      variant,
      instanceId: program.instanceId,
      program
    });
  };

  const status = getStatusDetails(program);
  const icon = getTypeIcon(program.categoryId, program.title);

  const formatSeconds = (sec) => {
    if (sec == null || sec === '') return '-';
    const totalSec = Math.round(Number(sec));
    if (isNaN(totalSec)) return '-';
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const adPlacements = usePlanningStore(state => state.adPlacements || {});
  const adSettings = usePlanningStore(state => state.adSettings || {});
  const reservations = usePlanningStore(state => state.reservations || []);
  const materials = usePlanningStore(state => state.materials || []);
  const companies = usePlanningStore(state => state.companies || []);
  const products = usePlanningStore(state => state.products || []);

  const resolvedLogoName = React.useMemo(
    () => program.logo || resolveProgramLogoForChannel(program, channelId, adSettings) || '-',
    [program, channelId, adSettings]
  );

  const isOutroBumperRow =
    (program.isBumperAd && program.bumperType === 'outro') ||
    /reklam_.*_cikis/i.test(String(program.title || ''));
  const isAdLogoActive =
    !isOutroBumperRow &&
    ((program.isBumperAd && program.bumperType === 'intro') ||
      /reklam_.*_giris/i.test(String(program.title || '')) ||
      Boolean(program.isAdClip || program.isFromAds) ||
      String(program.id || '').toUpperCase() === 'TPL-3' ||
      program.type === 'ad_break');
  
  const currentMode = usePlanningStore(state => state.currentMode) || 'draft';
  const dataMode = currentMode;
  const key = `${dataMode}-${channelId}-${date}`;

  const titleLower = (program.title || '').toLocaleLowerCase('tr-TR');
  const isAdBlock = program.id === 'TPL-3' || (program.id && String(program.id).toUpperCase().startsWith('T')) || titleLower.includes('reklam');
  
  const blockPlacements = isAdBlock ? (adPlacements[key]?.find(p => p.blockId === program.instanceId) || null) : null;
  
  // Reklam detaylarını Yayın Planlama (Ready/Draft) modlarında göster.
  const hasAds = currentMode !== 'final' && blockPlacements && blockPlacements.ads && blockPlacements.ads.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'column',
        marginBottom: '4px' // Little spacing between rows
      }}
      {...attributes}
      {...(isLocked ? {} : listeners)}
    >
      <div
        className={`rundown-row ${isSelected ? 'selected' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: program.isFromAds ? 'rgba(234, 179, 8, 0.15)' : undefined,
          border: program.isFromAds ? '1px solid rgba(234, 179, 8, 0.3)' : undefined
        }}
        onClick={handleClick}
        onDoubleClick={() => {
          if (!isLocked && onEditRequest) onEditRequest();
        }}
        onBlur={handleBlur}
      >
        <div style={{ ...getColFlexStyle('index', 60), position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          {index % 3 === 0 ? <ChevronDown size={14} style={{ position: 'absolute', left: '2px' }} /> : <ChevronRight size={14} style={{ position: 'absolute', left: '2px', opacity: 0 }} />}
          <span style={{ fontSize: '12px', fontWeight: '500' }}>{index + 1}</span>
        </div>

        <div style={{ ...getColFlexStyle('start', 100), fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
          {isEditing ? (
            <input
              type="text"
              value={editStartStr}
              onChange={(e) => setEditStartStr(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              style={{ width: '90px', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--accent-primary)', borderRadius: '4px', fontSize: '13px', padding: '4px', textAlign: 'center' }}
            />
          ) : (
            formatTime(program.startMinute)
          )}
        </div>

        <div style={{ ...getColFlexStyle('duration', 90), fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
          {isEditing ? (
            <input
              type="text"
              value={editDurationStr}
              onChange={(e) => setEditDurationStr(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ width: '80px', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--accent-primary)', borderRadius: '4px', fontSize: '13px', padding: '4px', textAlign: 'center' }}
            />
          ) : (
            formatTime(program.duration)
          )}
        </div>

        <div style={{ ...getColFlexStyle('icon', 60), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {program.isFromAds ? (
            <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>R</div>
          ) : icon}
        </div>

        <div style={{ ...getColFlexStyle('title', -1), color: 'var(--text-primary)', fontWeight: program.isFromAds ? '600' : '500', wordBreak: 'break-word', overflowWrap: 'anywhere', textAlign: 'center' }}>
          {isEditing ? (
            <input
              type="text"
              value={editTitleStr}
              onChange={(e) => setEditTitleStr(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ width: '100%', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--accent-primary)', borderRadius: '4px', fontSize: '13px', padding: '4px', textTransform: isSpecialTemplate ? 'uppercase' : 'none', textAlign: 'center' }}
            />
          ) : (
            program.title
          )}
        </div>

        <div style={{ ...getColFlexStyle('id', 100), fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {program.id || '-'}
        </div>

        <div style={{ ...getColFlexStyle('trimIn', 100), fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
          {formatSeconds(program.trimIn)}
        </div>
        <div style={{ ...getColFlexStyle('trimOut', 100), fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
          {formatSeconds(program.trimOut)}
        </div>

        <div
          style={{
            ...getColFlexStyle('logo', 160),
            fontSize: '11.5px',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          title={
            isAdLogoActive
              ? `Reklama Girerken Girecek Logo: ${resolvedLogoName}`
              : `Yayına Girerken Girecek Logo: ${resolvedLogoName}`
          }
        >
          {resolvedLogoName && resolvedLogoName !== '-' ? (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontWeight: 700,
                fontSize: '11px',
                background: isAdLogoActive ? 'rgba(245, 158, 11, 0.14)' : 'rgba(16, 185, 129, 0.14)',
                color: isAdLogoActive ? '#d97706' : '#10b981',
                border: `1px solid ${isAdLogoActive ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {resolvedLogoName}
            </span>
          ) : (
            '-'
          )}
        </div>

        <div style={{ ...getColFlexStyle('category', 120), textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <span style={{
            background: program.isFromAds ? 'rgba(59, 130, 246, 0.1)' : cat.bg,
            color: program.isFromAds ? '#3b82f6' : cat.color,
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '500',
            display: 'inline-block'
          }}>
            {program.isFromAds ? 'Reklam' : cat.name}
          </span>
          
          {onMatchRequest && !program.isMatched && !program.isFromAds && !program.isLive && String(program.id).startsWith('TPL-') === false && (
             <button 
               onClick={(e) => { e.stopPropagation(); onMatchRequest(); }}
               style={{
                 background: 'var(--primary)',
                 color: 'white',
                 border: 'none',
                 borderRadius: '4px',
                 padding: '2px 8px',
                 fontSize: '10px',
                 fontWeight: 'bold',
                 cursor: 'pointer'
               }}
               title="Veritabanından Gerçek Kliple Eşleştir"
             >
               Eşleştir
             </button>
          )}
        </div>

        <div style={{ ...getColFlexStyle('status', 120), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: program.isFromAds ? '#10b981' : status.color }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            {program.isFromAds ? 'Hazır' : status.label}
          </span>
        </div>
      </div>
    </div>
  );
};

export default RundownRow;
