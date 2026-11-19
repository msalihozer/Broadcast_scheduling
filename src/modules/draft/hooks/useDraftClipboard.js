/**
 * @file useDraftClipboard.js
 * @description Taslak Planlama modülü program kuşağı kopyalama (Ctrl+C)
 * ve yapıştırma (Ctrl+V) mantığı hook'u.
 * 
 * Kurallar:
 * 1. Ctrl + C: Seçili program kuşaklarını panoya kopyalar.
 * 2. Ctrl + V:
 *    - Eğer listede bir eleman seçili ise, onun hemen altına yapıştırır.
 *    - Eğer listede hiçbir eleman seçili değil ise, aktif günün en sonuna yapıştırır.
 */
import { useState, useCallback, useRef } from 'react';

export const useDraftClipboard = ({
  scheduleData,
  setScheduleData,
  recalculateDayTimes,
  selectedList,
  selectedDayKey,
  allDaysKeys,
  setSelectedProgramIds,
  setSelectedProgramMap,
  showToast,
  lastClickedRef
}) => {
  // Pano hafızası
  const [clipboard, setClipboard] = useState([]);
  const clipboardRef = useRef([]);

  // Kopyalama (Ctrl + C)
  const copySelected = useCallback((customList = null) => {
    const listToCopy = customList || selectedList;
    if (!listToCopy || listToCopy.length === 0) {
      if (showToast) {
        showToast('Kopyalamak için önce en az bir program kuşağı seçiniz.', 'info', 2000);
      }
      return false;
    }

    const copiedPrograms = [];
    listToCopy.forEach(item => {
      const day = scheduleData?.[item.dateKey];
      const prog = day?.programs?.find(p => p.instanceId === item.instanceId);
      if (prog) {
        // Derin kopya alarak panoya aktar
        copiedPrograms.push(JSON.parse(JSON.stringify(prog)));
      }
    });

    if (copiedPrograms.length === 0) return false;

    setClipboard(copiedPrograms);
    clipboardRef.current = copiedPrograms;

    if (showToast) {
      showToast(`${copiedPrograms.length} program kuşağı panoya kopyalandı (Ctrl+C)`, 'success', 2500);
    }
    return true;
  }, [selectedList, scheduleData, showToast]);

  // Yapıştırma (Ctrl + V)
  const pasteFromClipboard = useCallback(() => {
    const progsToPaste = clipboardRef.current && clipboardRef.current.length > 0
      ? clipboardRef.current
      : clipboard;

    if (!progsToPaste || progsToPaste.length === 0) {
      if (showToast) {
        showToast('Panoda yapıştırılacak program kuşağı bulunmuyor. Önce Ctrl+C ile kopyalayın.', 'info', 2500);
      }
      return false;
    }

    let targetDateKey = null;
    let insertAfterIndex = -1; // -1 ise en sona eklenecek

    // 1. KURAL: Eğer listede eleman seçili ise, onun hemen altına yapıştır
    if (selectedList && selectedList.length > 0) {
      const lastSelectedItem = selectedList[selectedList.length - 1];
      targetDateKey = lastSelectedItem.dateKey;
      const targetDay = scheduleData?.[targetDateKey];
      if (targetDay && targetDay.programs) {
        const foundIdx = targetDay.programs.findIndex(p => p.instanceId === lastSelectedItem.instanceId);
        if (foundIdx !== -1) {
          insertAfterIndex = foundIdx;
        }
      }
    }

    // 2. KURAL: Eğer listede eleman seçili değil ise, aktif günün/filtrenin en sonuna yapıştır
    if (!targetDateKey) {
      if (selectedDayKey !== 'all') {
        targetDateKey = selectedDayKey;
      } else if (lastClickedRef?.current?.dateKey) {
        targetDateKey = lastClickedRef.current.dateKey;
      } else {
        targetDateKey = allDaysKeys?.[0] || '2025-10-27';
      }
      insertAfterIndex = -1; // En alta eklenecek
    }

    const newlyCreatedIds = [];
    const newProgramMap = {};

    setScheduleData(prev => {
      const currentDay = prev[targetDateKey] || {
        date: targetDateKey,
        dayName: 'Gün',
        programs: []
      };

      const dayProgs = [...(currentDay.programs || [])];

      // Kopyalanan her elemana benzersiz yeni id ve instanceId ata
      const clonedProgs = progsToPaste.map((prog, pIdx) => {
        const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}_${pIdx}`;
        const newInstanceId = `inst_${targetDateKey}_${uniqueSuffix}`;
        const newId = `prog_${targetDateKey}_${uniqueSuffix}`;

        newlyCreatedIds.push(newInstanceId);
        newProgramMap[newInstanceId] = targetDateKey;

        return {
          ...prog,
          id: newId,
          instanceId: newInstanceId,
          title: prog.title
        };
      });

      if (insertAfterIndex >= 0 && insertAfterIndex < dayProgs.length) {
        // Seçilen elemanın hemen altına araya ekle
        dayProgs.splice(insertAfterIndex + 1, 0, ...clonedProgs);
      } else {
        // Listenin en sonuna ekle
        dayProgs.push(...clonedProgs);
      }

      return {
        ...prev,
        [targetDateKey]: {
          ...currentDay,
          programs: recalculateDayTimes(dayProgs)
        }
      };
    }, `${progsToPaste.length} Kuşak Yapıştırıldı`);

    // Yapıştırılan yeni elemanları seçili hale getir
    if (setSelectedProgramIds && setSelectedProgramMap) {
      setSelectedProgramIds(newlyCreatedIds);
      setSelectedProgramMap(prev => ({ ...prev, ...newProgramMap }));
    }

    if (showToast) {
      if (insertAfterIndex >= 0) {
        showToast(`${progsToPaste.length} program seçilen kuşağın hemen altına yapıştırıldı (Ctrl+V)`, 'success', 2500);
      } else {
        showToast(`${progsToPaste.length} program günün en sonuna yapıştırıldı (Ctrl+V)`, 'success', 2500);
      }
    }

    return true;
  }, [
    clipboard,
    selectedList,
    scheduleData,
    selectedDayKey,
    allDaysKeys,
    lastClickedRef,
    setScheduleData,
    recalculateDayTimes,
    setSelectedProgramIds,
    setSelectedProgramMap,
    showToast
  ]);

  return {
    clipboard,
    copySelected,
    pasteFromClipboard
  };
};
