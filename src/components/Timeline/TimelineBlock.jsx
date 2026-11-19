/**
 * @file TimelineBlock.jsx
 * @description Zaman çizelgesi üzerinde yer alan tekil program kutusu/bloğu.
 * 
 * Temel Sorumluluklar:
 * 1. Dakika ölçeğine göre (minuteScale) dinamik yükseklik ve konum hesaplama
 * 2. @dnd-kit useDraggable ile serbest zaman çizelgesi üzerinde taşınabilirlik
 * 3. Sağ tık bağlam menüsü (Kopyala, Yapıştır, Süre Güncelle, Sil)
 * 4. Kilitli günlerde (isLocked) düzenlemeyi devre dışı bırakma
 */
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDraggable } from '@dnd-kit/core';
import usePlanningStore from '../../store/planningStore';
import { X, Clock } from 'lucide-react';
import { formatTime, formatDuration } from '../../utils/timeFormat';
import { dialog } from '../../store/dialogStore';

const TimelineBlock = ({ program, isLocked, channelId, date }) => {
  const copyProgram = usePlanningStore(state => state.copyProgram);
  const removePrograms = usePlanningStore(state => state.removePrograms);
  const updateProgramDuration = usePlanningStore(state => state.updateProgramDuration);
  const updateProgramTime = usePlanningStore(state => state.updateProgramTime);
  const updateProgramTitle = usePlanningStore(state => state.updateProgramTitle);
  const activeVariant = usePlanningStore(state => state.days[`${channelId}-${date}`]?.activeVariant);
  const minuteScale = usePlanningStore(state => state.minuteScale);
  const setSelectedTimelineBlock = usePlanningStore(state => state.setSelectedTimelineBlock);
  const selectedTimelineBlock = usePlanningStore(state => state.selectedTimelineBlock);
  const clipboardProgram = usePlanningStore(state => state.clipboardProgram);
  const pasteProgram = usePlanningStore(state => state.pasteProgram);

  const isSelected = selectedTimelineBlock?.instanceId === program.instanceId;
  const isFlexible = ['p-10', 'p-11', 'p-12', 'p-13'].includes(program.id);
  const [contextMenu, setContextMenu] = useState(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    // contextmenu is handled on the window to close the previous menu
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu]);

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLocked) return;
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleTimeClick = (e) => {
    e.stopPropagation();
    if (isLocked) return;
    
    // Sürükleme sırasında tıklamayı yoksaymak için isDragging kontrolü yapılabilir ancak dnd-kit bunu genelde yönetir.
    const newTimeStr = window.prompt(`${program.title} için yeni başlangıç saati (SS:DD formatında):`, formatTime(program.startMinute));
    if (newTimeStr !== null) {
      const parts = newTimeStr.split(':');
      if (parts.length === 2) {
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(h) && !isNaN(m) && h >= 0 && h < 24 && m >= 0 && m < 60) {
          updateProgramTime(channelId, date, activeVariant, program.instanceId, h * 60 + m);
        } else {
          dialog.warning("Geçersiz Saat", "Lütfen geçerli bir saat dilimi girin (00:00 - 23:59).");
        }
      } else {
        dialog.warning("Format Hatası", "Lütfen SS:DD formatında bir saat girin.");
      }
    }
  };

  const currentDuration = program.duration;
  const startRow = Math.floor(program.startMinute) + 1;
  const endRow = Math.ceil(program.startMinute + currentDuration) + 1;
  
  const startTimeStr = formatTime(program.startMinute);
  const endTimeStr = formatTime(program.startMinute + currentDuration);
  
  const isOverrun = (program.startMinute + currentDuration) > 1440;
  
  const exactHeightPx = currentDuration * minuteScale;
  const visualHeight = exactHeightPx;
  const isCompact = visualHeight < 60;
  const isUltraCompact = visualHeight < 30;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: program.instanceId,
    data: {
      type: 'timeline-item',
      program
    },
    disabled: isLocked
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={(e) => {
        if (e.button === 2 || e.nativeEvent.button === 2) {
          e.preventDefault();
          e.stopPropagation();
          if (!isLocked) {
            setContextMenu({ x: e.clientX, y: e.clientY });
          }
        } else if (listeners && listeners.onPointerDown) {
          listeners.onPointerDown(e);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        copyProgram(program);
        setSelectedTimelineBlock({
          channelId,
          date,
          variant: activeVariant,
          instanceId: program.instanceId,
          startMinute: program.startMinute,
          duration: currentDuration,
          endMinute: program.startMinute + currentDuration,
          program: program
        });
      }}
      onContextMenu={handleContextMenu}
      className={`program-block ${isDragging ? 'is-dragging' : ''} ${isSelected ? 'is-selected' : ''}`}
      style={{
        gridRowStart: startRow,
        gridRowEnd: endRow,
        borderLeft: `4px solid ${program.color}`,
        backgroundColor: isOverrun ? 'var(--danger-bg)' : `${program.color}15`,
        border: `1px solid ${program.color}30`,
        borderLeftWidth: '4px',
        borderLeftColor: program.color,
        zIndex: isDragging ? 100 : (contextMenu ? 60 : (isHovered ? 50 : 1)),
        height: `${exactHeightPx}px`,
        boxSizing: 'border-box',
        padding: exactHeightPx < 30 ? '0 4px' : '4px 8px',
        display: 'flex',
        flexDirection: exactHeightPx < 30 ? 'row' : 'column',
        alignItems: exactHeightPx < 30 ? 'center' : 'flex-start',
        justifyContent: exactHeightPx < 30 ? 'flex-start' : 'center',
        gap: '4px',
        overflow: 'hidden',
        boxShadow: isSelected ? `0 0 0 2px var(--accent-primary)` : (isHovered ? `0 2px 8px rgba(0,0,0,0.15)` : undefined),
        transition: 'all 0.1s ease-in-out',
        transform: isHovered && exactHeightPx < 30 ? 'scale(1.02) translateX(4px)' : 'none',
        textAlign: 'left',
        color: 'var(--text-primary)'
      }}
    >
      <div 
        onClick={handleTimeClick}
        title="Başlangıç saatini değiştirmek için tıklayın"
        style={{ fontSize: exactHeightPx < 30 ? '10px' : '11px', fontWeight: 'bold', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
      >
        <Clock size={10} />
        {startTimeStr}
      </div>
      
      <div style={{ fontSize: exactHeightPx < 30 ? '10px' : '12px', fontWeight: 600, width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
        {program.id} - {program.title} {exactHeightPx >= 30 && <><br/><span style={{ opacity: 0.8 }}>{formatDuration(currentDuration)}</span></>}
      </div>

          {!isLocked && isHovered && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                removePrograms(channelId, date, usePlanningStore.getState().days[`${channelId}-${date}`].activeVariant, [program.instanceId], [program.id]);
              }}
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                background: 'rgba(0,0,0,0.5)',
                border: 'none',
                color: 'white',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10
              }}
              title="Programı Sil"
            >
              <X size={12} />
            </button>
          )}
          {isOverrun && (
            <div style={{ fontSize: '10px', color: 'var(--danger)', marginTop: 'auto', fontWeight: 'bold' }}>
              GÜN AŞIMI
            </div>
          )}
      {contextMenu && createPortal(
        <div
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 999999,
            display: 'flex',
            flexDirection: 'column',
            minWidth: '140px'
          }}
        >
          <button 
            style={{ padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', borderRadius: '4px' }}
            onMouseOver={(e) => e.target.style.background = 'var(--bg-tertiary)'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
            onClick={() => {
              setContextMenu(null);
              const newDurationStr = window.prompt(`${program.title} için yeni süreyi (dakika) girin:`, program.duration);
              if (newDurationStr !== null) {
                const newDuration = parseInt(newDurationStr, 10);
                if (!isNaN(newDuration) && newDuration > 0) {
                  updateProgramDuration(channelId, date, activeVariant, program.instanceId, newDuration);
                } else {
                  dialog.warning("Geçersiz Süre", "Geçerli bir dakika girmelisiniz.");
                }
              }
            }}
          >
            Süre Ayarla
          </button>
          <button 
            style={{ padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', borderRadius: '4px' }}
            onMouseOver={(e) => e.target.style.background = 'var(--bg-tertiary)'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
            onClick={() => {
              setContextMenu(null);
              const newTitle = window.prompt(`${program.title} için yeni isim girin:`, program.title);
              if (newTitle !== null && newTitle.trim() !== '') {
                updateProgramTitle(channelId, date, activeVariant, program.instanceId, newTitle.trim());
              }
            }}
          >
            İsim Değiştir
          </button>
          <button 
            style={{ padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', borderRadius: '4px' }}
            onMouseOver={(e) => e.target.style.background = 'var(--bg-tertiary)'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
            onClick={() => {
              setContextMenu(null);
              handleTimeClick({ stopPropagation: () => {} });
            }}
          >
            Başlangıç Saati Ayarla
          </button>
          <button 
            style={{ padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', borderRadius: '4px' }}
            onMouseOver={(e) => e.target.style.background = 'var(--bg-tertiary)'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
            onClick={() => {
              setContextMenu(null);
              copyProgram(program);
            }}
          >
            Kopyala
          </button>
          <button 
            style={{ padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: clipboardProgram ? 'var(--text-primary)' : 'var(--text-muted)', cursor: clipboardProgram ? 'pointer' : 'not-allowed', fontSize: '13px', borderRadius: '4px' }}
            onMouseOver={(e) => { if (clipboardProgram) e.target.style.background = 'var(--bg-tertiary)'; }}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
            disabled={!clipboardProgram}
            onClick={() => {
              setContextMenu(null);
              if (clipboardProgram) {
                pasteProgram(channelId, date, activeVariant, program.startMinute + currentDuration);
              }
            }}
          >
            Sonrasına Yapıştır
          </button>
          <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
          <button 
            style={{ padding: '8px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '13px', borderRadius: '4px' }}
            onMouseOver={(e) => e.target.style.background = 'var(--danger-bg)'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
            onClick={() => {
              setContextMenu(null);
              removeProgram(channelId, date, activeVariant, program.instanceId, program.id);
            }}
          >
            Sil
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TimelineBlock;
