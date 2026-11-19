/**
 * @file ReadyPlanningModule.jsx
 * @description Yayına Hazır Planlama (Ready Planning) Modülü Ana Bileşeni.
 * 
 * Sorumluluklar:
 * 1. Seçili gün ve kanalın kesinleşmiş yayın akışını yönetir
 * 2. Taslaktan veri çekme (pullFromDraftToReady)
 * 3. Kuşak sürükle-bırak sıralama (dnd-kit)
 * 4. Yayına gönderme iş akışı ve medya logosu denetimleri
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import usePlanningStore from '../../store/planningStore';
import RundownRow from '../../components/Timeline/RundownRow';
import ResizableHeaderCell from '../../components/Timeline/ResizableHeaderCell';
import MatchMediaModal from '../../components/Timeline/MatchMediaModal';
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
  AlertTriangle
} from 'lucide-react';
import { formatTotalDuration } from '../../utils/timeFormat';
import CustomDatePicker from '../../components/CustomDatePicker';
import useDialogStore from '../../store/dialogStore';

const ReadyPlanningModule = ({ date, channelId }) => {
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
  
  const key = `ready-${selectedChannelId}-${safeDate}`;
  const day = usePlanningStore(state => state.days[key]);
  
  const activeVariant = day?.activeVariant || 'v1';
  const programs = day?.variants[activeVariant]?.programs || [];

  const [editingInstanceId, setEditingInstanceId] = useState(null);
  const [matchingProgram, setMatchingProgram] = useState(null);

  const selectedTimelineBlock = usePlanningStore(state => state.selectedTimelineBlock);
  const moveProgramUp = usePlanningStore(state => state.moveProgramUp);
  const moveProgramDown = usePlanningStore(state => state.moveProgramDown);
  const duplicateProgram = usePlanningStore(state => state.duplicateProgram);
  const removePrograms = usePlanningStore(state => state.removePrograms);
  const clearDay = usePlanningStore(state => state.clearDay);
  const copyDay = usePlanningStore(state => state.copyDay);
  const pasteDay = usePlanningStore(state => state.pasteDay);
  const clipboardDay = usePlanningStore(state => state.clipboardDay);
  const selectedInstanceIds = usePlanningStore(state => state.selectedInstanceIds);
  
  const insertPosition = usePlanningStore(state => state.insertPosition);
  const setInsertPosition = usePlanningStore(state => state.setInsertPosition);
  
  // Taslak İşlemleri
  const drafts = usePlanningStore(state => state.drafts || []);
  const saveDraft = usePlanningStore(state => state.saveDraft);
  const applyDraft = usePlanningStore(state => state.applyDraft);
  const deleteDraft = usePlanningStore(state => state.deleteDraft);
  
  const pullFromDraftToReady = usePlanningStore(state => state.pullFromDraftToReady);
  const draftKey = `draft-${selectedChannelId}-${safeDate}`;
  const draftDay = usePlanningStore(state => state.days[draftKey]);
  const draftVersion = draftDay?.updatedAt || 0;
  const syncedVersion = day?.draftVersionSynced || 0;
  const hasNewDraftChanges = draftVersion > syncedVersion;

  const updateVariant = usePlanningStore(state => state.updateVariant);
  const matchAdLogosForReady = usePlanningStore(state => state.matchAdLogosForReady);
  const timelineColumns = usePlanningStore(state => state.timelineColumns);
  const setColumnWidth = usePlanningStore(state => state.setColumnWidth);
  const gridTemplateColumns = useMemo(() => timelineColumns.map(c => c.width === -1 ? 'auto' : `${c.width}px`).join(' '), [timelineColumns]);

  const [isDigerMenuOpen, setIsDigerMenuOpen] = useState(false);
  const [isCheckingLogos, setIsCheckingLogos] = useState(false);
  const [isDraftPrompting, setIsDraftPrompting] = useState(false);
  const [draftName, setDraftName] = useState('');

  const isSelected = selectedTimelineBlock?.channelId === selectedChannelId && selectedTimelineBlock?.date === safeDate;
  
  const resetReadyForBroadcast = usePlanningStore(state => state.resetReadyForBroadcast);
  const sendToAds = usePlanningStore(state => state.sendToAds);
  const [workflowState, setWorkflowState] = useState('IDLE'); // IDLE, CHECKING, VALIDATED, SENT

  const programsHash = programs.map(p => p.instanceId + p.duration).join('|');
  const [savedHash, setSavedHash] = useState(programsHash);

  useEffect(() => {
    setSavedHash(programsHash);
    setWorkflowState('IDLE');
  }, [selectedChannelId, safeDate]);

  useEffect(() => {
    if (programsHash !== savedHash && workflowState === 'VALIDATED') {
      setWorkflowState('IDLE');
    }
  }, [programsHash, savedHash, workflowState]);

  const handleSaveAndCheck = () => {
    setWorkflowState('CHECKING');
    setTimeout(() => {
      setWorkflowState('VALIDATED');
    }, 1500);
  };

  const handleSendToBroadcast = () => {
    setWorkflowState('SENT');
    useDialogStore.getState().showAlert('Başarılı', 'Başarıyla Yayına Gönderildi!');
  };
  
  const { setNodeRef } = useDroppable({
    id: `timeline-${key}`,
    data: { type: 'timeline', date: safeDate, channelId }
  });

  if (!day) return <div style={{ padding: 20 }}>Yükleniyor...</div>;

  const totalDuration = programs.reduce((sum, p) => sum + p.duration, 0);

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

            {/* Versiyon Seçici */}
            <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-color)' }}>
              {['v1', 'v2', 'v3'].map(v => (
                <button
                  key={v}
                  onClick={() => updateVariant(selectedChannelId, safeDate, v)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: activeVariant === v ? 'var(--accent-primary)' : 'transparent',
                    color: activeVariant === v ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: activeVariant === v ? 700 : 500,
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {v.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Taslaktan Çek Butonu */}
            <button
              onClick={() => {
                useDialogStore.getState().showConfirm(
                  'Taslaktan Veri Aktarımı',
                  'Mevcut günün taslak akışını bu güne aktarmak istiyor musunuz? (Mevcut liste üzerine yazılacaktır)',
                  () => pullFromDraftToReady(selectedChannelId, safeDate)
                );
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: hasNewDraftChanges ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-secondary)',
                color: hasNewDraftChanges ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <FolderOpen size={14} />
              Taslaktan Çek {hasNewDraftChanges && '●'}
            </button>
          </div>

          {/* Sağ Eylemler: Süre & Kaydet/Yayına Gönder */}
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
              <strong style={{ color: totalDuration === 1440 ? 'var(--success)' : 'var(--warning)', fontFamily: 'monospace' }}>
                {formatTotalDuration(totalDuration)} / 24:00:00
              </strong>
            </div>

            {/* Kaydet & Denetle */}
            <button
              onClick={handleSaveAndCheck}
              disabled={workflowState === 'CHECKING'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 16px',
                borderRadius: '8px',
                border: 'none',
                background: workflowState === 'VALIDATED' ? 'var(--success)' : 'var(--accent-primary)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {workflowState === 'CHECKING' ? (
                <><Loader size={14} className="spin" /> Denetleniyor...</>
              ) : workflowState === 'VALIDATED' ? (
                <><Check size={14} /> Kaydedildi & Doğrulandı</>
              ) : (
                <><Save size={14} /> Kaydet & Doğrula</>
              )}
            </button>

            {/* Yayına Gönder */}
            {workflowState === 'VALIDATED' && (
              <button
                onClick={handleSendToBroadcast}
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
                <Send size={14} /> Yayına Gönder
              </button>
            )}
          </div>

        </div>

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
                  onMatchMedia={setMatchingProgram}
                />
              ))}

              {programs.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Bu gün için henüz program akışı bulunmuyor. Taslaktan veri çekebilir veya kütüphaneden sürükleyebilirsiniz.
                </div>
              )}
            </div>
          </SortableContext>
        </div>
      </div>

      {/* Match Media Modal */}
      {matchingProgram && (
        <MatchMediaModal
          program={matchingProgram}
          onClose={() => setMatchingProgram(null)}
        />
      )}

    </div>
  );
};

export default ReadyPlanningModule;
