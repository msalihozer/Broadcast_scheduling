/**
 * @file useDraftSelection.js
 * @description Taslak Planlama modülü program kuşağı seçimi,
 * çoklu seçim, Shift + Tıklama ile aralık seçimi ve modal seçim durumları hook'u.
 */
import { useState, useCallback, useMemo, useRef } from 'react';

export const useDraftSelection = (scheduleData, showToast) => {
  const [selectedProgramIds, setSelectedProgramIds] = useState([]);
  const [selectedProgramMap, setSelectedProgramMap] = useState({});
  const [selectedProgram, setSelectedProgram] = useState(null); // Modalda açık olan program

  // Shift + Tıklama aralık seçimi için son tıklanan programı hafızada tut
  const lastClickedRef = useRef(null); // { dateKey, instanceId }

  const selectedList = useMemo(() => {
    return selectedProgramIds.map(id => ({
      instanceId: id,
      dateKey: selectedProgramMap[id]
    })).filter(x => x.dateKey);
  }, [selectedProgramIds, selectedProgramMap]);

  // Tekil veya Shift+Tıklama ile Aralık Seçimi
  const handleToggleSelectProgram = useCallback((dateKey, instanceId, e) => {
    if (e) {
      e.stopPropagation();
    }

    const isShiftPressed = e && (e.shiftKey || e.nativeEvent?.shiftKey);
    const dayProgs = scheduleData?.[dateKey]?.programs || [];

    // 1. Shift + Tıklama ile Aralık Seçimi (Aynı günde iki eleman arası)
    if (isShiftPressed && lastClickedRef.current && lastClickedRef.current.dateKey === dateKey) {
      const prevId = lastClickedRef.current.instanceId;
      const idx1 = dayProgs.findIndex(p => (p.instanceId || p.id) === prevId);
      const idx2 = dayProgs.findIndex(p => (p.instanceId || p.id) === instanceId);

      if (idx1 !== -1 && idx2 !== -1) {
        const start = Math.min(idx1, idx2);
        const end = Math.max(idx1, idx2);
        const rangeProgs = dayProgs.slice(start, end + 1);
        const rangeIds = rangeProgs.map(p => p.instanceId || p.id);

        setSelectedProgramMap(prevMap => {
          const nextMap = { ...prevMap };
          rangeIds.forEach(id => {
            nextMap[id] = dateKey;
          });
          return nextMap;
        });

        setSelectedProgramIds(prevIds => {
          const idSet = new Set([...prevIds, ...rangeIds]);
          return Array.from(idSet);
        });

        if (showToast) {
          showToast(`${rangeProgs.length} program aralığı seçildi (Shift + Tıklama)`, 'info', 2000);
        }
        return;
      }
    }

    // 2. Normal Tıklama (Toggle)
    lastClickedRef.current = { dateKey, instanceId };

    setSelectedProgramIds(prev => {
      if (prev.includes(instanceId)) {
        return prev.filter(id => id !== instanceId);
      } else {
        setSelectedProgramMap(m => ({ ...m, [instanceId]: dateKey }));
        return [...prev, instanceId];
      }
    });
  }, [scheduleData, showToast]);

  // Gündeki tüm programları seç / kaldır
  const handleSelectAllDay = useCallback((dateKey) => {
    const day = scheduleData?.[dateKey];
    if (!day) return;
    const dayProgIds = (day.programs || []).map(p => p.instanceId || p.id);
    const allSelected = dayProgIds.length > 0 && dayProgIds.every(id => selectedProgramIds.includes(id));

    if (allSelected) {
      setSelectedProgramIds(prev => prev.filter(id => !dayProgIds.includes(id)));
    } else {
      setSelectedProgramMap(m => {
        const nextMap = { ...m };
        dayProgIds.forEach(id => { nextMap[id] = dateKey; });
        return nextMap;
      });
      setSelectedProgramIds(prev => Array.from(new Set([...prev, ...dayProgIds])));
    }
  }, [scheduleData, selectedProgramIds]);

  // Görüntülenen tüm programları seç (Ctrl + A)
  const selectAllVisible = useCallback((activeDaysKeys) => {
    const allIds = [];
    const nextMap = {};
    activeDaysKeys.forEach(dKey => {
      const day = scheduleData?.[dKey];
      if (day && day.programs) {
        day.programs.forEach(p => {
          const pId = p.instanceId || p.id;
          allIds.push(pId);
          nextMap[pId] = dKey;
        });
      }
    });
    setSelectedProgramIds(allIds);
    setSelectedProgramMap(nextMap);
    if (showToast && allIds.length > 0) {
      showToast(`${allIds.length} program seçildi (Ctrl + A)`, 'info', 2000);
    }
  }, [scheduleData, showToast]);

  // Seçimi temizle
  const handleClearSelection = useCallback(() => {
    setSelectedProgramIds([]);
    setSelectedProgramMap({});
    lastClickedRef.current = null;
  }, []);

  return {
    selectedProgramIds,
    setSelectedProgramIds,
    selectedProgramMap,
    setSelectedProgramMap,
    selectedProgram,
    setSelectedProgram,
    selectedList,
    lastClickedRef,
    handleToggleSelectProgram,
    handleSelectAllDay,
    selectAllVisible,
    handleClearSelection
  };
};
