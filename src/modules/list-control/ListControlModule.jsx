/**
 * @file ListControlModule.jsx
 * @description Yayın Liste Kontrol Modülü Ana Bileşeni.
 * 
 * Sorumluluklar:
 * 1. Reklam ve planlama birimlerinden gelen akışın nihai operasyonel denetimi
 * 2. 2. Aşama Kilidi (Stage 2 Lock) uygulama ve kaldırma
 * 3. Gerçek sürelerin, canlı yayınların ve reklam kuşaklarının kontrolü
 * 4. Playout otomasyonuna gönderilmeye hazır nihai akış listesi görünümü
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import usePlanningStore from '../../store/planningStore';
import RundownRow from '../../components/Timeline/RundownRow';
import ResizableHeaderCell from '../../components/Timeline/ResizableHeaderCell';
import { format, parseISO, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Edit3, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Copy, 
  MoreHorizontal, 
  Search, 
  Filter, 
  LayoutGrid, 
  Save, 
  FolderOpen, 
  Loader, 
  Send, 
  Check, 
  AlertTriangle,
  Info,
  CheckCircle2,
  ChevronUp
} from 'lucide-react';
import { formatTotalDuration } from '../../utils/timeFormat';
import CustomDatePicker from '../../components/CustomDatePicker';
import useDialogStore from '../../store/dialogStore';
import useBroadcastStore from '../broadcast/store/broadcastStore';
import { getDraftProgramsForDay } from '../broadcast/utils/draftDataLoader';
import { isDraftSlotAddedToRundown } from '../broadcast/components/DraftProgramSlotItem';

const ListControlModule = ({ date, channelId }) => {
  const safeDate = date || format(new Date(), 'yyyy-MM-dd');
  const ensureDayExists = usePlanningStore(state => state._ensureDayExists);
  
  useEffect(() => {
    ensureDayExists(channelId, safeDate);
  }, [channelId, safeDate, ensureDayExists]);

  const selectedChannelId = usePlanningStore(state => state.selectedChannel);
  const setSelectedChannel = usePlanningStore(state => state.setSelectedChannel);
  const channels = usePlanningStore(state => state.channels);
  const setSelectedDate = usePlanningStore(state => state.setSelectedDate);
  const setViewMode = usePlanningStore(state => state.setViewMode);
  const currentMode = usePlanningStore(state => state.currentMode) || 'draft';
  const dataMode = currentMode;
  
  const key = `list-control-${selectedChannelId}-${safeDate}`;
  const day = usePlanningStore(state => state.listControlDays[key]);
  
  const finalKey = `final-${selectedChannelId}-${safeDate}`;
  const finalDay = usePlanningStore(state => state.days[finalKey]);
  
  const activeVariant = day?.activeVariant || 'v1';
  const hasTpl3 = day?.variants[activeVariant]?.programs?.some(p => String(p.id).toUpperCase() === 'TPL-3');

  // Geriye dönük uyumluluk: Eğer list-control boşsa VEYA içinde hala TPL-3 blokları varsa (eski veriyse), final'i düzleştirerek kopyala
  useEffect(() => {
    if ((!day || hasTpl3) && finalDay && (finalDay.adsStatus === 'completed' || finalDay.adsStatus === 'sent_to_master')) {
      usePlanningStore.setState(state => {
        const placements = state.adPlacements[`ready-${selectedChannelId}-${safeDate}`] || [];
        const materials = state.materials || [];
        const activeVariant = finalDay.activeVariant || 'v1';
        const finalPrograms = finalDay.variants[activeVariant]?.programs || [];
        
        let allocatedAdDuration = 0;
        const newPrograms = [];
        
        finalPrograms.forEach(prog => {
          if (String(prog.id).toUpperCase() === 'TPL-3') {
            allocatedAdDuration += (parseFloat(prog.duration) || 0);
            
            const bp = placements.find(p => p.blockId === prog.instanceId);
            if (bp && bp.ads) {
              bp.ads.forEach(ad => {
                const material = materials.find(m => String(m.id) === String(ad.materialId));
                newPrograms.push({
                  ...prog,
                  id: material ? (material.clipId || material.code || material.id) : ad.materialId,
                  title: material ? (material.clipName || material.name) : 'Reklam Klibi',
                  duration: (parseFloat(ad.duration) || 0) / 60,
                  instanceId: `ad-${Math.random().toString(36).substr(2, 9)}`,
                  isAdClip: true,
                  isFromAds: true
                });
              });
            }
          } else {
            newPrograms.push({ ...prog });
          }
        });
        
        const newDay = {
          ...finalDay,
          allocatedAdDuration,
          variants: {
            ...finalDay.variants,
            [activeVariant]: {
              ...finalDay.variants[activeVariant],
              programs: newPrograms
            }
          }
        };
        
        return {
          listControlDays: {
            ...state.listControlDays,
            [key]: newDay
          }
        };
      });
    }
  }, [day, finalDay, selectedChannelId, safeDate, key, hasTpl3]);

  const programs = day?.variants[activeVariant]?.programs || [];
  const broadcastRawProgs = useBroadcastStore(state => state.getRawDayPrograms(selectedChannelId, safeDate, 'A'));
  const [showMissingDraftDetails, setShowMissingDraftDetails] = useState(false);

  // Taslak Kontrol Bilgisi: Gelen taslağı inceleyerek eklenmeyen kuşak varsa bilgilendirme amaçlı gösterir
  const draftInspection = useMemo(() => {
    const draftSlots = getDraftProgramsForDay(selectedChannelId, safeDate) || [];
    const targetListToCheck = programs.length > 0 ? programs : (broadcastRawProgs || []);
    const missingSlots = [];
    let addedCount = 0;

    draftSlots.forEach(slot => {
      if (isDraftSlotAddedToRundown(slot, targetListToCheck, draftSlots)) {
        addedCount++;
      } else {
        missingSlots.push(slot);
      }
    });

    return {
      totalDraftSlots: draftSlots.length,
      addedCount,
      missingSlots
    };
  }, [selectedChannelId, safeDate, programs, broadcastRawProgs]);
  const selectedTimelineBlock = usePlanningStore(state => state.selectedTimelineBlock);
  const selectedInstanceIds = usePlanningStore(state => state.selectedInstanceIds);
  
  const timelineColumns = usePlanningStore(state => state.timelineColumns);
  const setColumnWidth = usePlanningStore(state => state.setColumnWidth);
  const gridTemplateColumns = useMemo(() => timelineColumns.map(c => c.width === -1 ? 'auto' : `${c.width}px`).join(' '), [timelineColumns]);

  const { setNodeRef } = useDroppable({
    id: `timeline-${key}`,
    data: { type: 'timeline', date: safeDate, channelId }
  });

  if (!day) return <div style={{ padding: 20 }}>Yükleniyor...</div>;

  const totalDuration = programs.reduce((sum, p) => sum + (parseFloat(p.duration) || 0), 0);

  return (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* Header */}
      <div style={{ padding: '24px 24px 16px 24px', display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0 }}>
        
        <div 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
          onDoubleClick={() => setViewMode('weekly')}
        >
          <ChevronLeft 
            size={20} 
            color="var(--text-muted)" 
            onClick={(e) => { e.stopPropagation(); setSelectedDate(format(addDays(parseISO(safeDate), -1), 'yyyy-MM-dd')); }} 
          />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <CustomDatePicker selectedDate={safeDate} onDateChange={(newDate) => setSelectedDate(newDate)}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase' }}>
                {format(parseISO(safeDate), 'd MMMM yyyy EEEE', { locale: tr })}
              </h2>
            </CustomDatePicker>
          </div>
          <ChevronRight 
            size={20} 
            color="var(--text-muted)" 
            onClick={(e) => { e.stopPropagation(); setSelectedDate(format(addDays(parseISO(safeDate), 1), 'yyyy-MM-dd')); }} 
          />
        </div>

        {/* Action Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Kanal Seçici */}
            <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-color)' }}>
              {channels.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChannel(ch.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: selectedChannelId === ch.id ? 'var(--accent-primary)' : 'transparent',
                    color: selectedChannelId === ch.id ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: selectedChannelId === ch.id ? 700 : 500,
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {ch.name}
                </button>
              ))}
            </div>

            {/* Bilgilendirme Rozeti */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(37, 99, 235, 0.1)',
              border: '1px solid rgba(37, 99, 235, 0.25)',
              color: 'var(--accent-primary)',
              fontSize: '12px',
              fontWeight: 600
            }}>
              <span>Nihai Yayın Listesi Denetimi</span>
            </div>
          </div>

          {/* Sağ Eylemler: Toplam Süre */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              fontSize: '12px'
            }}>
              <span style={{ color: 'var(--text-muted)' }}>Toplam:</span>
              <strong style={{ color: Math.round(totalDuration) === 1440 ? 'var(--success)' : 'var(--warning)', fontFamily: 'monospace' }}>
                {formatTotalDuration(totalDuration)} / 24:00:00
              </strong>
            </div>

            <button
              onClick={() => {
                const extraInfo = draftInspection.missingSlots.length > 0
                  ? `\n\nBilgilendirme: Günün taslağındaki ${draftInspection.totalDraftSlots} kuşaktan ${draftInspection.missingSlots.length} tanesi akışta yer almamaktadır.`
                  : '';
                useDialogStore.getState().showAlert('Başarılı', `Liste kontrolü tamamlandı ve onaylandı.${extraInfo}`);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 16px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--accent-primary)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Check size={14} /> Listeyi Onayla
            </button>
          </div>

        </div>

        {/* Gelen Taslak İnceleme & Bilgilendirme Uyarısı (Zorunlu Değil, Bilgilendirme Amaçlı) */}
        {draftInspection.totalDraftSlots > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '10px',
            background: draftInspection.missingSlots.length === 0
              ? 'rgba(16, 185, 129, 0.1)'
              : 'rgba(245, 158, 11, 0.1)',
            border: draftInspection.missingSlots.length === 0
              ? '1px solid rgba(16, 185, 129, 0.32)'
              : '1px solid rgba(245, 158, 11, 0.35)',
            fontSize: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                {draftInspection.missingSlots.length === 0 ? (
                  <CheckCircle2 size={16} color="#10b981" />
                ) : (
                  <Info size={16} color="#d97706" />
                )}
                <span>
                  <strong style={{ color: draftInspection.missingSlots.length === 0 ? '#059669' : '#d97706' }}>
                    Taslak İnceleme Bilgisi:
                  </strong>{' '}
                  {draftInspection.missingSlots.length === 0 ? (
                    <>
                      Gelen taslaktaki tüm kuşaklar (<strong>{draftInspection.addedCount}/{draftInspection.totalDraftSlots}</strong>) listede yer alıyor.
                    </>
                  ) : (
                    <>
                      Gelen taslaktaki <strong>{draftInspection.totalDraftSlots}</strong> kuşaktan{' '}
                      <strong style={{ color: '#059669' }}>{draftInspection.addedCount}</strong> tanesi eklendi,{' '}
                      <strong style={{ color: '#d97706' }}>{draftInspection.missingSlots.length}</strong> kuşak listede yer almıyor{' '}
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>(Zorunlu değil, bilgilendirme amaçlıdır)</span>.
                    </>
                  )}
                </span>
              </div>

              {draftInspection.missingSlots.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowMissingDraftDetails(prev => !prev)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '7px',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    background: 'var(--bg-primary)',
                    color: '#d97706',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>Eklenmeyen Taslak Kuşakları ({draftInspection.missingSlots.length})</span>
                  {showMissingDraftDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              )}
            </div>

            {showMissingDraftDetails && draftInspection.missingSlots.length > 0 && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                paddingTop: '6px',
                borderTop: '1px dashed var(--border-color)',
                maxHeight: '120px',
                overflowY: 'auto'
              }}>
                {draftInspection.missingSlots.map((slot, sIdx) => (
                  <span
                    key={slot.id || sIdx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderLeft: `3px solid ${slot.categoryColor || '#f59e0b'}`,
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--text-primary)'
                    }}
                  >
                    <strong style={{ fontFamily: 'monospace', color: '#d97706' }}>{slot.startTime}</strong>
                    <span>{slot.title}</span>
                    {slot.episode && <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>(Bl. {slot.episode})</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Main Table Content */}
      <div 
        ref={setNodeRef}
        style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'auto', padding: '0 24px 24px 24px' }}
      >
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
        }}>
          {/* Header Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns,
            background: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase'
          }}>
            {timelineColumns.map(col => (
              <ResizableHeaderCell
                key={col.id}
                column={col}
                onResize={width => setColumnWidth(col.id, width)}
              />
            ))}
          </div>

          {/* Sortable Programs List */}
          <SortableContext items={programs.map(p => p.instanceId)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {programs.map((prog, index) => (
                <RundownRow
                  key={prog.instanceId}
                  program={prog}
                  index={index}
                  date={safeDate}
                  channelId={selectedChannelId}
                  variant={activeVariant}
                  gridTemplateColumns={gridTemplateColumns}
                  timelineColumns={timelineColumns}
                  isListControl={true}
                />
              ))}

              {programs.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Bu gün için henüz onaylanmış nihai liste bulunmuyor.
                </div>
              )}
            </div>
          </SortableContext>
        </div>
      </div>

    </div>
  );
};

export default ListControlModule;
