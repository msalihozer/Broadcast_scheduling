/**
 * @file DailyTimeline.jsx
 * @description Tekil Gün Zaman Çizelgesi Bileşeni (Timeline View).
 * 
 * Temel Sorumluluklar:
 * 1. 24 saatlik süre cetveli (dakika bazlı görsel ölçekleme)
 * 2. @dnd-kit useDroppable ile zaman çizgisine yeni program sürükleyip bırakma
 * 3. Gün kilidi (isLocked) ve varyant yönetimi (A / B)
 * 4. Toplam yayın süresi ve boşluk/taşma göstergesi
 */
import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDroppable } from '@dnd-kit/core';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import usePlanningStore from '../../store/planningStore';
import { dialog } from '../../store/dialogStore';
import TimelineBlock from './TimelineBlock';
import { Lock, Unlock, Copy, ClipboardPaste, Trash2 } from 'lucide-react';

const formatTime = (minutes) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const formatTotalDuration = (totalMinutes) => {
  if (!totalMinutes) return "00:00:00";
  const totalSeconds = Math.round(totalMinutes * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const DailyTimeline = ({ date, channelId, viewMode }) => {
  const ensureDayExists = usePlanningStore(state => state._ensureDayExists);
  const minuteScale = usePlanningStore(state => state.minuteScale);
  
  useEffect(() => {
    ensureDayExists(channelId, date);
  }, [channelId, date, ensureDayExists]);

  const key = `${channelId}-${date}`;
  const day = usePlanningStore(state => state.days[key]);
  
  const nextDateStr = (() => {
    const [y, m, d] = date.split('-');
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  })();
  const nextKey = `${channelId}-${nextDateStr}`;
  const nextDay = usePlanningStore(state => state.days[nextKey]);

  const dragPreview = usePlanningStore(state => state.dragPreview);
  
  const setActiveVariant = usePlanningStore(state => state.setActiveVariant);
  const copyDay = usePlanningStore(state => state.copyDay);
  const pasteDay = usePlanningStore(state => state.pasteDay);
  const lockDay = usePlanningStore(state => state.lockDay);
  const applyOverrun = usePlanningStore(state => state.applyOverrun);
  const undo = usePlanningStore(state => state.undo);
  const canUndo = usePlanningStore(state => state.pastStates && state.pastStates.length > 0);
  const clipboardDay = usePlanningStore(state => state.clipboardDay);
  const addProgramToDay = usePlanningStore(state => state.addProgramToDay);
  const isCtrlPressed = usePlanningStore(state => state.isCtrlPressed);
  const selectedLibraryProgram = usePlanningStore(state => state.selectedLibraryProgram);
  const setSelectedDate = usePlanningStore(state => state.setSelectedDate);
  const setViewMode = usePlanningStore(state => state.setViewMode);
  const pasteProgram = usePlanningStore(state => state.pasteProgram);
  const clipboardProgram = usePlanningStore(state => state.clipboardProgram);
  const setSelectedTimelineBlock = usePlanningStore(state => state.setSelectedTimelineBlock);
  const clearDay = usePlanningStore(state => state.clearDay);

  const gridRef = useRef(null);
  const [hoverPreview, setHoverPreview] = useState(null);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [showOverrunToast, setShowOverrunToast] = useState(false);
  const [gridContextMenu, setGridContextMenu] = useState(null);

  useEffect(() => {
    if (!gridContextMenu) return;
    const handleClickOutside = () => setGridContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [gridContextMenu]);

  const handleClearDay = async () => {
    if (day.isLockedForStage1) return;
    const ok = await dialog.confirm('Günü Temizle', `${date} tarihli listeyi (mevcut programları) temizlemek istediğinize emin misiniz?`, {
      confirmText: 'Evet, Temizle',
      isDestructive: true
    });
    if (ok) {
      clearDay(channelId, date, activeVariant);
    }
  };

  const handleSave = () => {
    // Zustand persist middleware is auto-saving, we just show a visual confirmation
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 2000);
  };

  const handleApplyOverrun = () => {
    applyOverrun(channelId, date, overrunPrograms);
    setShowOverrunToast(true);
    setTimeout(() => setShowOverrunToast(false), 2000);
  };

  const handleDoubleClick = () => {
    setSelectedDate(date);
    setViewMode('daily');
  };

  const { setNodeRef, isOver } = useDroppable({
    id: `timeline-${key}`,
    data: {
      type: 'timeline',
      date,
      channelId
    },
    disabled: day?.isLockedForStage1
  });

  if (!day) return <div className="day-column glass" style={{ padding: 20 }}>Yükleniyor...</div>;

  const activeVariant = day.activeVariant;
  const programs = day.variants[activeVariant].programs;

  const maxEndMinute = programs.reduce((max, p) => Math.max(max, p.startMinute + p.duration), day.startTime);
  const overrunPrograms = programs
    .filter(p => (p.startMinute + p.duration) > 1440)
    .map(p => ({
      ...p,
      overrunDuration: Math.min(p.duration, (p.startMinute + p.duration) - 1440)
    }));
  const overrunMinutes = overrunPrograms.reduce((sum, p) => sum + p.overrunDuration, 0);

  const isOverrunUpToDate = nextDay && JSON.stringify(nextDay.overrunsFromPreviousDay || []) === JSON.stringify(overrunPrograms);
  const needsOverrunUpdate = (!nextDay && overrunMinutes > 0) || (nextDay && !isOverrunUpToDate);
  const showClearOverrun = needsOverrunUpdate && overrunMinutes === 0 && nextDay?.startTime > 0;

  // Calculate gaps between programs
  const sortedPrograms = [...programs].sort((a, b) => a.startMinute - b.startMinute);
  const gaps = [];
  
  if (sortedPrograms.length > 0) {
    for (let i = 0; i < sortedPrograms.length - 1; i++) {
      const current = sortedPrograms[i];
      const next = sortedPrograms[i + 1];
      const currentEnd = current.startMinute + current.duration;
      
      if (next.startMinute > currentEnd) {
        gaps.push({
          id: `gap-${current.instanceId}-${next.instanceId}`,
          startMinute: currentEnd,
          duration: next.startMinute - currentEnd
        });
      }
    }
  }

  // Generate markers every 15 minutes
  const markers = [];
  for (let i = 0; i < 24; i++) {
    // 00 marker (Hour marker - more prominent)
    markers.push(
      <div 
        key={`marker-${i}`} 
        className="time-marker"
        style={{ 
          top: `${(i * 60) * minuteScale + 24}px`, 
          borderTop: '2px solid rgba(128, 128, 128, 0.5)',
          zIndex: 2
        }}
      >
        <span className="time-badge" style={{ color: 'var(--text-primary)', opacity: 1, fontWeight: 'bold', fontSize: '14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', transform: 'translateY(-50%)', padding: '4px 10px' }}>
          {`${i.toString().padStart(2, '0')}:00`}
        </span>
      </div>
    );

    let subIntervals = viewMode === 'weekly' ? [30] : [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

    subIntervals.forEach(min => {
      let isHalf = min === 30;
      let isQuarter = min === 15 || min === 45;
      let isFive = !isHalf && !isQuarter;

      let borderStyle = isHalf ? '1px dashed rgba(128, 128, 128, 0.4)' 
                      : (isQuarter ? '1px dotted rgba(128, 128, 128, 0.3)' : '1px dotted rgba(128, 128, 128, 0.2)');
      
      let fontSize = isHalf ? '12px' : (isQuarter ? '11px' : '10px');
      let opacity = isHalf ? 0.95 : (isQuarter ? 0.85 : 0.75);
      let fontWeight = isHalf ? 600 : (isQuarter ? 500 : 400);
      
      let showText = true;
      if (isFive && minuteScale < 6) showText = false; // Zoom düşükse 5 dk'lık yazıları gizle
      if (isQuarter && minuteScale < 2) showText = false; // Çok düşük zoomda 15 dk'lıkları gizle

      markers.push(
        <div 
          key={`marker-${i}-${min}`} 
          className="time-marker"
          style={{ 
            top: `${(i * 60 + min) * minuteScale + 24}px`, 
            borderTop: borderStyle,
            zIndex: 1
          }}
        >
          {showText && (
            <span className="time-badge" style={{ fontSize, opacity, fontWeight, color: 'var(--text-muted)', background: 'transparent', border: 'none', transform: 'translateY(-50%)', padding: '2px 8px' }}>
              {`${i.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`}
            </span>
          )}
        </div>
      );
    });
  }

  // Gün sonunu belli eden 23:59 çizgisi
  markers.push(
    <div 
      key={`marker-23-59`} 
      className="time-marker"
      style={{ 
        top: `${1439 * minuteScale + 24}px`, 
        borderTop: '2px solid rgba(128, 128, 128, 0.5)',
        zIndex: 2
      }}
    >
      <span className="time-badge" style={{ color: 'var(--danger)', opacity: 1, fontWeight: 'bold', fontSize: '14px', background: 'var(--danger-bg)', border: '1px solid var(--danger)', transform: 'translateY(-50%)', padding: '4px 10px' }}>
        23:59
      </span>
    </div>
  );

  // Hover and Click handling for Ctrl + Click Quick Placement
  const checkOverlap = (minute, duration) => {
    if (minute < day.startTime) return true;
    const dropEnd = minute + duration;
    for (const p of programs) {
      const pEnd = p.startMinute + p.duration;
      if (minute < pEnd && dropEnd > p.startMinute) {
        return true;
      }
    }
    return false;
  };

  const handleMouseMove = (e) => {
    if (!isCtrlPressed || !selectedLibraryProgram || day.isLockedForStage1) {
      if (hoverPreview) setHoverPreview(null);
      return;
    }

    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    let dropY = e.clientY - rect.top + gridRef.current.scrollTop;
    
    const isFlexible = ['p-10', 'p-11', 'p-12', 'p-13'].includes(selectedLibraryProgram.id);
    const snapInterval = isFlexible ? 1 : 5;
    
    // Grid top calculation includes 24px padding-top
    let rawMinute = Math.max(0, (dropY - 24) / minuteScale);
    let snappedMinute = Math.round(rawMinute / snapInterval) * snapInterval;

    const isOverlap = checkOverlap(snappedMinute, selectedLibraryProgram.duration);

    setHoverPreview({
      minute: snappedMinute,
      duration: selectedLibraryProgram.duration,
      isValid: !isOverlap
    });
  };

  const handleMouseLeave = () => {
    if (hoverPreview) setHoverPreview(null);
  };

  const handleClick = () => {
    if (isCtrlPressed && selectedLibraryProgram && hoverPreview && hoverPreview.isValid && !day.isLockedForStage1) {
      addProgramToDay(channelId, date, activeVariant, selectedLibraryProgram, hoverPreview.minute);
      setHoverPreview(null); // Reset preview immediately after click
    } else {
      setSelectedTimelineBlock(null);
    }
  };

  const handleGridContextMenu = (e) => {
    e.preventDefault();
    if (day.isLockedForStage1) return;

    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    let dropY = e.clientY - rect.top + gridRef.current.scrollTop;
    
    const isFlexible = clipboardProgram && ['p-10', 'p-11', 'p-12', 'p-13'].includes(clipboardProgram.id);
    const snapInterval = isFlexible ? 1 : 5;
    let rawMinute = Math.max(0, (dropY - 24) / minuteScale);
    let snappedMinute = Math.round(rawMinute / snapInterval) * snapInterval;
    
    // Geriye düşmeyi engelle
    snappedMinute = Math.max(day.startTime || 0, snappedMinute);

    setGridContextMenu({
      x: e.clientX,
      y: e.clientY,
      minute: snappedMinute
    });
  };

  // Check if we should render a drop preview highlight block
  const showDropPreview = dragPreview && dragPreview.channelId === channelId && dragPreview.date === date;

  return (
    <div 
      className={`day-column glass ${day.isLockedForStage1 ? 'is-locked' : ''}`}
      style={{ 
        maxWidth: viewMode === 'daily' ? '800px' : '400px',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      <div 
        className="day-header" 
        onDoubleClick={handleDoubleClick}
        title="Günlük görünüme geçmek için çift tıklayın"
        style={{ flexWrap: 'wrap', gap: '12px', cursor: 'pointer' }}
      >
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 600, textTransform: 'capitalize' }}>
            {format(parseISO(date), 'dd MMMM yyyy, EEEE', { locale: tr })}
          </h3>
          
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', marginTop: '4px', marginBottom: '8px' }}>
            Toplam Süre: {formatTotalDuration(programs.reduce((sum, p) => sum + p.duration, 0))}
          </div>

          <div className="day-tabs">
            {Object.keys(day.variants).map(variant => (
              <div 
                key={variant}
                className={`tab ${activeVariant === variant ? 'active' : ''}`}
                onClick={() => setActiveVariant(channelId, date, variant)}
              >
                Alternatif {variant}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={handleClearDay}
            title="Listeyi Temizle"
            style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
          >
            <Trash2 size={16} />
          </button>

          <button 
            onClick={() => copyDay(channelId, date, activeVariant)}
            title="Günü Kopyala"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <Copy size={16} />
          </button>
          
          <button 
            onClick={() => pasteDay(channelId, date, activeVariant)}
            title="Günü Yapıştır"
            disabled={!clipboardDay || day.isLockedForStage1}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: (!clipboardDay || day.isLockedForStage1) ? 'var(--border-color)' : 'var(--text-secondary)', 
              cursor: (!clipboardDay || day.isLockedForStage1) ? 'not-allowed' : 'pointer' 
            }}
          >
            <ClipboardPaste size={16} />
          </button>

          {!day.isLockedForStage1 && canUndo && (
            <button 
              onClick={undo}
              title="Geri Al"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
            >
              Geri Al
            </button>
          )}

          {!day.isLockedForStage1 && (
            <button 
              onClick={handleSave}
              title="Değişiklikleri Kaydet"
              style={{ background: 'var(--success)', border: 'none', color: 'white', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
            >
              Kaydet
            </button>
          )}

          {!day.isLockedForStage1 ? (
            <button 
              onClick={() => lockDay(channelId, date)}
              title="2. Aşamaya Gönder (Kilitle)"
              style={{ background: 'var(--accent-primary)', border: 'none', color: 'white', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
            >
              <Lock size={12} /> Gönder
            </button>
          ) : (
            <div style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
              <Lock size={12} /> Kilitli
            </div>
          )}
        </div>
      </div>

      {showSaveToast && (
        <div style={{ position: 'absolute', top: '16px', right: '16px', background: 'var(--success)', color: 'white', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          Başarıyla Kaydedildi!
        </div>
      )}

      {showOverrunToast && (
        <div style={{ position: 'absolute', top: '56px', right: '16px', background: 'var(--accent-primary)', color: 'white', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          Sonraki güne aktarıldı!
        </div>
      )}

      {/* Up to date info */}
      {overrunMinutes > 0 && !needsOverrunUpdate && (
        <div className="overrun-warning" style={{ background: 'rgba(34, 197, 94, 0.1)', borderColor: 'var(--success)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--success)' }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold' }}>✓ Sonraki güne {overrunMinutes} dakika aktarıldı.</span>
        </div>
      )}

      {/* Needs update */}
      {needsOverrunUpdate && (overrunMinutes > 0 || showClearOverrun) && (
        <div className="overrun-warning" style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          background: showClearOverrun ? 'rgba(245, 158, 11, 0.1)' : undefined, 
          borderColor: showClearOverrun ? '#f59e0b' : undefined, 
          color: showClearOverrun ? '#f59e0b' : undefined 
        }}>
          <span>
            {showClearOverrun ? `Gün aşımı iptal edildi (Güncellenmeyi bekliyor)` : `Gün Aşımı: ${overrunMinutes} dakika`} 
            {overrunMinutes > 0 && nextDay?.startTime > 0 && ` (Değişiklik var, güncellenmeyi bekliyor)`}
          </span>
          <button 
            onClick={handleApplyOverrun}
            style={{ 
              padding: '4px 8px', fontSize: '11px', 
              background: showClearOverrun ? '#f59e0b' : 'var(--danger)', 
              color: showClearOverrun ? '#000' : 'white', 
              border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' 
            }}
          >
            {showClearOverrun ? 'Ertesi Günü Temizle' : 'Sonraki Güne Aktar'}
          </button>
        </div>
      )}


      <div 
        ref={(node) => {
          setNodeRef(node);
          gridRef.current = node;
        }}
        className={`timeline-grid ${isOver ? 'is-over' : ''}`}
        id={`timeline-grid-${key}`}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative', gridTemplateRows: `repeat(1440, ${minuteScale}px)` }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onContextMenu={handleGridContextMenu}
      >
        {markers}

        {/* Program Start/End Reference Lines */}
        {day.variants[day.activeVariant].programs.map(p => {
          const startY = p.startMinute * minuteScale + 24;
          const endY = (p.startMinute + p.duration) * minuteScale + 24;
          return (
            <React.Fragment key={`ref-lines-${p.instanceId}`}>
              <div style={{
                position: 'absolute', top: startY, left: 80, right: 0, height: '1px',
                backgroundColor: 'var(--success)', opacity: 0.8, zIndex: 3, pointerEvents: 'none'
              }} title="Başlangıç" />
              <div style={{
                position: 'absolute', top: endY, left: 80, right: 0, height: '1px',
                backgroundColor: 'var(--danger)', opacity: 0.8, zIndex: 3, pointerEvents: 'none'
              }} title="Bitiş" />
            </React.Fragment>
          );
        })}

        {/* Previous Day Overrun Block (Blocked Area) */}
        {day.startTime > 0 && (
          <div 
            style={{
              gridRowStart: 1,
              gridRowEnd: day.startTime + 1,
              gridColumn: '1 / -1',
              margin: '0 8px 0 80px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              backgroundImage: 'repeating-linear-gradient(45deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.2) 10px, rgba(239, 68, 68, 0.05) 10px, rgba(239, 68, 68, 0.05) 20px)',
              border: '1px solid var(--danger)',
              borderRadius: '6px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--danger)',
              fontSize: '11px',
              fontWeight: 'bold',
              pointerEvents: 'none',
              zIndex: 3,
              padding: '8px',
              textAlign: 'center'
            }}
          >
            {day.overrunsFromPreviousDay ? (
              <>
                <div style={{ marginBottom: '4px', fontSize: '12px' }}>Önceki Günden Sarkan Toplam: {day.startTime} dk</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                  {day.overrunsFromPreviousDay.map(p => (
                    <span key={p.instanceId} style={{ background: 'rgba(239, 68, 68, 0.8)', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>
                      {p.title} ({p.overrunDuration}dk)
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <span>Önceki Günden Sarkan: {day.startTime} dk</span>
            )}
          </div>
        )}
        
        {/* Drop Highlight Block */}
        {showDropPreview && (
          <div 
            style={{
              gridRowStart: dragPreview.minute + 1,
              gridRowEnd: dragPreview.minute + 1 + dragPreview.duration,
              gridColumn: '1 / -1',
              backgroundColor: dragPreview.isValid ? 'rgba(99, 102, 241, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              border: `2px dashed ${dragPreview.isValid ? 'var(--accent-primary)' : 'var(--danger)'}`,
              borderRadius: '6px',
              zIndex: 5,
              margin: '0 8px 0 80px',
              pointerEvents: 'none',
              transition: 'all 0.1s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {!dragPreview.isValid && <span style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '12px' }}>DOLU ALAN</span>}
          </div>
        )}

        {/* Hover Highlight Block (Ctrl + Hover) */}
        {hoverPreview && isCtrlPressed && selectedLibraryProgram && (
          <div 
            style={{
              gridRowStart: hoverPreview.minute + 1,
              gridRowEnd: hoverPreview.minute + 1 + hoverPreview.duration,
              gridColumn: '1 / -1',
              backgroundColor: hoverPreview.isValid ? `${selectedLibraryProgram.color}33` : 'rgba(239, 68, 68, 0.2)',
              border: `2px dashed ${hoverPreview.isValid ? selectedLibraryProgram.color : 'var(--danger)'}`,
              borderRadius: '6px',
              zIndex: 5,
              margin: '0 8px 0 80px',
              pointerEvents: 'none',
              transition: 'all 0.1s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span style={{ fontWeight: 'bold', fontSize: '12px', color: hoverPreview.isValid ? selectedLibraryProgram.color : 'var(--danger)' }}>
              {hoverPreview.isValid ? `${formatTime(hoverPreview.minute)} - ${formatTime(hoverPreview.minute + hoverPreview.duration)}` : 'DOLU ALAN'}
            </span>
          </div>
        )}

        {/* Render Gaps */}
        {gaps.map(gap => (
          <div 
            key={gap.id}
            style={{
              gridRowStart: gap.startMinute + 1,
              gridRowEnd: gap.startMinute + 1 + gap.duration,
              gridColumn: '1 / -1',
              margin: '0 8px 0 80px',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px)',
              border: '1px dashed rgba(255,255,255,0.3)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FBBF24',
              fontSize: '12px',
              fontWeight: 'bold',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
              pointerEvents: 'none',
              zIndex: 10
            }}
          >
            Boşluk: {gap.duration} dk
          </div>
        ))}

        {programs.map((p) => (
          <TimelineBlock 
            key={p.instanceId} 
            program={p} 
            channelId={channelId}
            date={date}
            isLocked={day.isLockedForStage1} 
          />
        ))}
      </div>

      {gridContextMenu && createPortal(
        <div
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
          style={{
            position: 'fixed',
            top: gridContextMenu.y,
            left: gridContextMenu.x,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 999999,
            display: 'flex',
            flexDirection: 'column',
            minWidth: '160px'
          }}
        >
          <div style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>
            Hedef Saat: {formatTime(gridContextMenu.minute)}
          </div>
          <button 
            style={{ padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: !clipboardProgram ? 'var(--text-muted)' : 'var(--text-primary)', cursor: !clipboardProgram ? 'not-allowed' : 'pointer', fontSize: '13px', borderRadius: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
            onMouseOver={(e) => { if (clipboardProgram) e.target.style.background = 'var(--bg-tertiary)'; }}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
            disabled={!clipboardProgram}
            onClick={() => {
              if (clipboardProgram) {
                pasteProgram(channelId, date, activeVariant, gridContextMenu.minute);
              }
              setGridContextMenu(null);
            }}
          >
            {clipboardProgram ? `Yapıştır (${clipboardProgram.title})` : 'Kopyalanan Program Yok'}
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DailyTimeline;
