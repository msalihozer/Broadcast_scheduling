import React, { useState, useEffect } from 'react';
import ProgramLibrary from '../Sidebar/ProgramLibrary';
import ReadyPlanningModule from '../../modules/planning';
import WeeklyTimeline from '../Timeline/WeeklyTimeline';
import ItemDetailsPanel from '../Sidebar/ItemDetailsPanel';
import TopNavbar from './TopNavbar';
import usePlanningStore from '../../store/planningStore';
import { 
  DndContext, 
  DragOverlay, 
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { format, parseISO } from 'date-fns';
import { AlertTriangle } from 'lucide-react';

/**
 * @file ReadyLayout.jsx
 * @description Yayına Hazır (Ready) modu için ana UI sarmalayıcı (wrapper).
 * Sol tarafta medya kütüphanesi, sağ tarafta ReadyTimeline içerir.
 */
const ReadyLayout = () => {
  const { 
    selectedDate, 
    selectedChannel,
    channels,
    viewMode,
    addProgramToDay,
    days
  } = usePlanningStore();

  const [activeDragItem, setActiveDragItem] = useState(null);
  const [dragPreviewInfo, setDragPreviewInfo] = useState(null); // { minute, isValid }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event) => {
    setActiveDragItem(event.active.data.current);
  };

  const handleDragMove = (event) => {
    // handled visually by sortable
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveDragItem(null);
    setDragPreviewInfo(null);

    if (!over) return;

    // Library -> RundownTimeline drop
    if (active.data.current?.type === 'library_item') {
      const isOverRow = over.data.current?.type === 'timeline_row';
      const isOverTimeline = over.data.current?.type === 'timeline';

      if (isOverRow || isOverTimeline) {
        const dragData = active.data.current;
        const targetChannelId = selectedChannel;
        const targetDate = selectedDate;
        
        const state = usePlanningStore.getState();
        const targetDay = state.days[`ready-${targetChannelId}-${targetDate}`];
        
        // Calculate insertion index
        let insertIndex = targetDay?.variants[targetDay.activeVariant]?.programs?.length || 0;
        
        if (isOverRow && over.data.current.sortable) {
          insertIndex = over.data.current.sortable.index;
          
          // If dropping below the middle of the item, insert after
          const overRect = event.over.rect;
          const dropY = event.active.rect.current.translated?.top;
          if (dropY && overRect && dropY > overRect.top + (overRect.height / 2)) {
            insertIndex += 1;
          }
        }

        if (targetDay && !targetDay.isLockedForStage1) {
          addProgramToDay(targetChannelId, targetDate, targetDay.activeVariant, dragData.program, insertIndex);
        }
      }
    }

    // TimelineRow -> TimelineRow reorder (Sıralama)
    if (active.data.current?.type === 'timeline_row') {
      const isOverRow = over.data.current?.type === 'timeline_row';
      
      if (isOverRow && active.id !== over.id) {
        const targetChannelId = selectedChannel;
        const targetDate = selectedDate;
        const state = usePlanningStore.getState();
        const targetDay = state.days[`ready-${targetChannelId}-${targetDate}`];
        
        if (targetDay && !targetDay.isLockedForStage1) {
          const oldIndex = active.data.current.index;
          const newIndex = over.data.current.index;
          
          usePlanningStore.getState().reorderProgram(targetChannelId, targetDate, targetDay.activeVariant, oldIndex, newIndex);
        }
      }
    }
  };

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="app-container">
        <TopNavbar />
        
        <div className="main-body">
          <ProgramLibrary />
          
          <div className="main-content">
            {viewMode === 'weekly' ? (
              <WeeklyTimeline date={selectedDate} channelId={selectedChannel} />
            ) : (
              <ReadyPlanningModule date={selectedDate} channelId={selectedChannel} />
            )}
          </div>
          
          <ItemDetailsPanel />
        </div>
      </div>
      
      <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
        {activeDragItem ? (
          <div 
            className="glass" 
            style={{ 
              width: '300px', 
              padding: '12px',
              borderLeft: `4px solid var(--accent-primary)`,
              backgroundColor: 'var(--bg-secondary)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              transform: 'scale(1.05)'
            }}
          >
            <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{activeDragItem.program.title}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{activeDragItem.program.duration} dk</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default ReadyLayout;
