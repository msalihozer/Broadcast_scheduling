/**
 * @file App.jsx
 * @description Uygulamanın ana kök bileşeni.
 * 
 * Temel Sorumluluklar:
 * 1. React Router ile tüm modüllerin rota yönetimi (/login, /, /draft, /ready, /ads, /list-control, /admin, popout'lar)
 * 2. ModeWrapper: Aktif planlama modunu (draft, ready, list-control) senkronize eder
 * 3. Global Klavye Kısayolları (Ctrl+Z Undo, Ctrl+C Kopyala, Ctrl+V Yapıştır, Delete Sil)
 * 4. BroadcastChannel Köprüsü ('yayin-otomasyon-channel'): Popout pencereler ile ana pencere arası anlık veri aktarımı
 * 5. Supabase Oturum Denetimi ve Korumalı Rota Yönlendirmeleri
 */
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DraftLayout from './components/Layout/DraftLayout';
import BroadcastPlanningLayout from './modules/broadcast/BroadcastPlanningLayout';
import Login from './pages/Login';
import LibraryPopout from './pages/LibraryPopout';
import ModuleSelection from './pages/ModuleSelection';
import AdsReservation from './pages/AdsReservation';
import AdminPanel from './pages/AdminPanel';
import DraftPreviewPopout from './pages/DraftPreviewPopout';
import ListControlLayout from './components/Layout/ListControlLayout';
import usePlanningStore from './store/planningStore';
import useAuthStore from './store/authStore';
import './store/themeStore';
import GlobalDialog from './components/GlobalDialog';

// Klavye kısayollarını (Ctrl+Z, Ctrl+C, Ctrl+V, Delete) ve Broadcast köprüsünü yöneten global sarmalayıcı
const ModeWrapper = ({ mode, children }) => {
  // mode prop'u ileride Taslak ('draft') veya Yayına Hazır ('ready') ayrımı için kullanılabilir.
  const pasteProgram = usePlanningStore(state => state.pasteProgram);
  const selectedDate = usePlanningStore(state => state.selectedDate);
  const selectedChannel = usePlanningStore(state => state.selectedChannel);
  const days = usePlanningStore(state => state.days);
  const addProgramToDay = usePlanningStore(state => state.addProgramToDay);
  const setCurrentMode = usePlanningStore(state => state.setCurrentMode);

  useEffect(() => {
    setCurrentMode(mode);
  }, [mode, setCurrentMode]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Input veya Textarea gibi alanlardayken kısayolları yoksay
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault(); // Tarayıcının varsayılan undo işlemini iptal et
        usePlanningStore.getState().undo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const state = usePlanningStore.getState();
        const sc = state.selectedChannel;
        const sd = state.selectedDate || format(new Date(), 'yyyy-MM-dd');
        const currentMode = state.currentMode || 'draft';
        let day;
        if (currentMode === 'list-control') {
          day = state.listControlDays[`list-control-${sc}-${sd}`];
        } else {
          day = state.days[`${currentMode}-${sc}-${sd}`];
        }
        
        if (day) {
          const { selectedTimelineBlock, selectedInstanceIds } = state;
          const programs = day.variants[day.activeVariant]?.programs || [];
          
          if (selectedInstanceIds && selectedInstanceIds.length > 0) {
            const selectedPrograms = programs.filter(p => selectedInstanceIds.includes(p.instanceId));
            state.copyProgram(selectedPrograms);
          } else if (selectedTimelineBlock) {
             state.copyProgram([selectedTimelineBlock.program]);
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const state = usePlanningStore.getState();
        const sc = state.selectedChannel;
        const sd = state.selectedDate || format(new Date(), 'yyyy-MM-dd');
        const currentMode = state.currentMode || 'draft';
        const key = `${currentMode}-${sc}-${sd}`;
        const day = state.days[key];
        if (day && !day.isLockedForStage1) {
          state.pasteProgram(sc, sd, day.activeVariant, -1);
        }
      }

      if (e.key === 'Delete') {
        const state = usePlanningStore.getState();
        const sc = state.selectedChannel;
        const sd = state.selectedDate || format(new Date(), 'yyyy-MM-dd');
        const currentMode = state.currentMode || 'draft';
        
        if (currentMode === 'list-control') {
          const key = `list-control-${sc}-${sd}`;
          const day = state.listControlDays[key];
          if (day && !day.isLockedForStage1) {
            const { selectedTimelineBlock, selectedInstanceIds } = state;
            const programs = day.variants[day.activeVariant]?.programs || [];
            if (selectedInstanceIds && selectedInstanceIds.length > 0) {
              const selectedProgramIds = programs.filter(p => selectedInstanceIds.includes(p.instanceId)).map(p => p.id);
              state.lcRemovePrograms(sc, sd, day.activeVariant, selectedInstanceIds, [...new Set(selectedProgramIds)]);
            } else if (selectedTimelineBlock) {
               state.lcRemovePrograms(sc, sd, day.activeVariant, [selectedTimelineBlock.instanceId], [selectedTimelineBlock.program.id]);
            }
          }
        } else {
          const key = `${currentMode}-${sc}-${sd}`;
          const day = state.days[key];
          
          if (day && !day.isLockedForStage1) {
            const { selectedTimelineBlock, selectedInstanceIds } = state;
            const programs = day.variants[day.activeVariant]?.programs || [];
            
            if (selectedInstanceIds && selectedInstanceIds.length > 0) {
              const selectedProgramIds = programs
                .filter(p => selectedInstanceIds.includes(p.instanceId))
                .map(p => p.id);
              const uniqueProgramIds = [...new Set(selectedProgramIds)];
              state.removePrograms(sc, sd, day.activeVariant, selectedInstanceIds, uniqueProgramIds);
            } else if (selectedTimelineBlock) {
               state.removePrograms(sc, sd, day.activeVariant, [selectedTimelineBlock.instanceId], [selectedTimelineBlock.program.id]);
            }
          }
        }
      }
    };

    const handleMessage = (e) => {
      if (e.data && e.data.type === 'ADD_PROGRAM_FROM_POPOUT') {
        const { program } = e.data;
        const state = usePlanningStore.getState();
        const currentMode = state.currentMode || 'draft';
        
        if (currentMode === 'list-control') {
          const key = `list-control-${state.selectedChannel}-${state.selectedDate}`;
          const targetDay = state.listControlDays[key];
          if (targetDay && !targetDay.isLockedForStage1) {
            state.lcAddProgramToDay(
              state.selectedChannel, 
              state.selectedDate, 
              targetDay.activeVariant, 
              program, 
              -1
            );
          }
        } else {
          const key = `${currentMode}-${state.selectedChannel}-${state.selectedDate}`;
          const targetDay = state.days[key];
          if (targetDay && !targetDay.isLockedForStage1) {
            state.addProgramToDay(
              state.selectedChannel, 
              state.selectedDate, 
              targetDay.activeVariant, 
              program, 
              -1
            );
          }
        }
      }
      
      if (e.data && e.data.type === 'APPLY_DRAFT_DAY') {
        const { channelId, date } = e.data;
        usePlanningStore.getState().pullFromDraftToReady(channelId, date);
      }

      if (e.data && e.data.type === 'APPLY_DRAFT_WEEK') {
        const { channelId, date } = e.data;
        usePlanningStore.getState().pullWeekFromDraftToReady(channelId, date);
      }
    };

    const bc = new BroadcastChannel('yayin-otomasyon-channel');
    bc.onmessage = handleMessage;
    window.addEventListener('message', handleMessage);

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('message', handleMessage);
      bc.close();
    };
  }, [selectedDate, selectedChannel, days, pasteProgram, addProgramToDay]);

  return children;
};

function App() {
  const { session, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Yükleniyor...</div>;
  }

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={session ? <Navigate to="/" /> : <Login />} />
          <Route path="/library-popout" element={session ? <LibraryPopout /> : <Navigate to="/login" />} />
          <Route path="/draft-preview" element={session ? <DraftPreviewPopout /> : <Navigate to="/login" />} />
          <Route path="/" element={session ? <ModuleSelection /> : <Navigate to="/login" />} />
          <Route path="/draft" element={session ? <ModeWrapper mode="draft"><DraftLayout /></ModeWrapper> : <Navigate to="/login" />} />
          <Route path="/ready" element={session ? <BroadcastPlanningLayout /> : <Navigate to="/login" />} />
          <Route path="/ads" element={session ? <AdsReservation /> : <Navigate to="/login" />} />
          <Route path="/list-control" element={session ? <ModeWrapper mode="list-control"><ListControlLayout /></ModeWrapper> : <Navigate to="/login" />} />
          <Route path="/admin" element={session ? <AdminPanel /> : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
      <GlobalDialog />
    </>
  );
}

export default App;
