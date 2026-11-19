/**
 * @file src/modules/broadcast/hooks/useBroadcastKeyboardShortcuts.js
 * @description Yayın Planlama modülünde klavye kısayollarını (taslak planlamadaki gibi) yöneten hook.
 * 
 * Desteklenen Kısayollar:
 * - Ctrl + Z: Son işlemi geri al (Undo)
 * - Ctrl + Y: İleri al (Redo)
 * - Delete / Backspace: Seçili satırı (program/klip/reklam) sil
 * - Alt + Yukarı / Aşağı: Seçili satırı yukarı veya aşağı taşı
 * - Ctrl + C: Seçili satırı kopyala
 * - Ctrl + V: Kopyalananı seçilenin altına yapıştır
 * - R: Reklam Kuşağı Ekleme penceresini aç
 * - 1: Liste A'ya geç
 * - 2: Liste B'ye geç
 * - G: Günlük Görünüme geç
 * - H: Haftalık Görünüme geç
 * - A: Aylık Görünüme geç
 * - T: Taslak / Klip yan panelini aç / kapat
 * - S: Klip arama sekmesini aç
 * - ? veya K: Kısayollar penceresini aç/kapat
 * - Escape: Seçimi iptal et / Modalları kapat
 */
import { useEffect } from 'react';
import useBroadcastStore from '../store/broadcastStore';
import { dialog } from '../../../store/dialogStore';

export function useBroadcastKeyboardShortcuts({
  setIsAdBreakModalOpen,
  setIsShortcutsModalOpen,
  setIsAddProgramModalOpen,
  isAnyModalOpen
}) {
  const {
    selectedChannel,
    selectedDate,
    activeList,
    selectedInstanceId,
    selectedInstanceIds,
    setSelectedInstanceId,
    setSelectedInstanceIds,
    undo,
    redo,
    addAdBreak,
    addFillerSlot,
    removeProgram,
    removePrograms,
    moveProgram,
    copySelectedItem,
    pasteClipboardItem,
    saveDaySchedule,
    setActiveList,
    setViewMode,
    toggleDraftSidebar,
    setActiveSidebarTab
  } = useBroadcastStore();

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl + S (Kaydet) ve Ctrl + Shift + S / Ctrl + Enter (Reklam Rezervasyona İlet) her zaman çalışsın
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('broadcast-open-send-to-ads'));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('broadcast-open-send-to-ads'));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const res = saveDaySchedule(selectedChannel, selectedDate, activeList);
        if (res?.success) {
          const timeStr = new Date(res.savedAt).toLocaleTimeString('tr-TR');
          dialog.success(
            'Yayın Akışı Kaydedildi',
            `Yayın planlama listesi başarıyla kaydedildi.\nTarih: ${selectedDate}\nHedef Liste: Liste ${activeList}\nToplam Öğe: ${res.count} Öğe\nKayıt Saati: ${timeStr}`
          );
        }
        return;
      }

      // Input veya Textarea içindeyken sadece Escape tuşuna izin ver
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.tagName === 'SELECT' ||
        e.target.isContentEditable
      ) {
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      // 0. Ctrl + A: Listedeki Tüm Öğeleri Seç
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        const progs = useBroadcastStore.getState().getRawDayPrograms(selectedChannel, selectedDate, activeList) || [];
        if (progs.length > 0) {
          e.preventDefault();
          const allIds = progs.map(p => p.instanceId);
          setSelectedInstanceIds(allIds);
          setSelectedInstanceId(allIds[allIds.length - 1] || null);
        }
        return;
      }

      // 1. Ctrl + Z: Undo (Geri Al)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      // 2. Ctrl + Y: Redo (İleri Al)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // 3. Ctrl + C: Seçili Öğeyi veya Tüm Seçili Öğeleri Kopyala
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        const hasSelection = (Array.isArray(selectedInstanceIds) && selectedInstanceIds.length > 0) || Boolean(selectedInstanceId);
        if (hasSelection) {
          e.preventDefault();
          copySelectedItem(selectedChannel, selectedDate, activeList);
        }
        return;
      }

      // 4. Ctrl + V: Panodakileri Aynı Listeye veya Başka Listeye Yapıştır
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteClipboardItem(selectedChannel, selectedDate, activeList);
        return;
      }

      // 5. Delete veya Backspace: Seçili Satırı veya Çoklu Seçili Satırları Sil
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const multiIds = Array.isArray(selectedInstanceIds) ? selectedInstanceIds : [];
        if (multiIds.length > 1) {
          e.preventDefault();
          dialog.confirm(
            'Seçili Öğeleri Sil',
            `Seçili ${multiIds.length} öğeyi yayın akışından silmek istediğinize emin misiniz?`,
            {
              isDestructive: true,
              confirmText: `Evet, ${multiIds.length} Öğeyi Sil`,
              cancelText: 'Vazgeç'
            }
          ).then(ok => {
            if (ok) {
              removePrograms(selectedChannel, selectedDate, activeList, multiIds);
              setSelectedInstanceIds([]);
              setSelectedInstanceId(null);
            }
          });
        } else if (selectedInstanceId || multiIds.length === 1) {
          const targetId = selectedInstanceId || multiIds[0];
          e.preventDefault();
          const progs = useBroadcastStore.getState().getRawDayPrograms(selectedChannel, selectedDate, activeList);
          const targetItem = progs.find(p => p.instanceId === targetId);
          const itemName = targetItem?.clipName || targetItem?.title || targetItem?.name || 'Seçili Öğe';
          dialog.confirm(
            'Öğeyi Listeden Sil',
            `"${itemName}" öğesini yayın akışından silmek istediğinize emin misiniz?`,
            {
              isDestructive: true,
              confirmText: 'Evet, Sil',
              cancelText: 'Vazgeç'
            }
          ).then(ok => {
            if (ok) {
              removeProgram(selectedChannel, selectedDate, activeList, targetId);
              setSelectedInstanceIds([]);
              setSelectedInstanceId(null);
            }
          });
        }
        return;
      }

      // 6. Alt + ArrowUp / ArrowDown: Satırı Yukarı / Aşağı Taşı
      if (e.altKey && e.key === 'ArrowUp') {
        if (selectedInstanceId) {
          e.preventDefault();
          moveProgram(selectedChannel, selectedDate, activeList, selectedInstanceId, 'up');
        }
        return;
      }
      if (e.altKey && e.key === 'ArrowDown') {
        if (selectedInstanceId) {
          e.preventDefault();
          moveProgram(selectedChannel, selectedDate, activeList, selectedInstanceId, 'down');
        }
        return;
      }

      // 7. R: Reklam Kuşağını doğrudan akışa ekle (dakika sormadan)
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        addAdBreak(selectedChannel, selectedDate, activeList);
        return;
      }

      // 7b. D: Dolgu Kuşağını doğrudan akışa ekle (seçili satırın altına veya sona)
      if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        addFillerSlot(selectedChannel, selectedDate, activeList, 15, selectedInstanceId);
        return;
      }

      // 7c. P: Program / Klip Ekleme penceresini aç
      if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsAddProgramModalOpen(true);
        return;
      }

      // 8. ? veya K: Kısayol Kılavuzu
      if ((e.key === '?' || e.key.toLowerCase() === 'k') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsShortcutsModalOpen(prev => !prev);
        return;
      }

      // 9. Escape: Seçimi iptal et veya modalleri kapat
      if (e.key === 'Escape') {
        if (isAnyModalOpen) {
          setIsAdBreakModalOpen(false);
          setIsShortcutsModalOpen(false);
          setIsAddProgramModalOpen(false);
        } else if (selectedInstanceId || (Array.isArray(selectedInstanceIds) && selectedInstanceIds.length > 0)) {
          setSelectedInstanceId(null);
          setSelectedInstanceIds([]);
        }
        return;
      }

      // 10. Liste A / B Değişimi: Tuş 1 ve 2
      if (e.key === '1' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setActiveList('A');
        return;
      }
      if (e.key === '2' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setActiveList('B');
        return;
      }

      // 11. Görünümler (G: Günlük, H: Haftalık, A: Aylık)
      if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setViewMode('daily');
        return;
      }
      if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setViewMode('weekly');
        return;
      }
      if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setViewMode('monthly');
        return;
      }

      // 12. T: Taslak Panelini Aç / Kapat
      if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleDraftSidebar();
        return;
      }

      // 13. S: Klip Arama Sekmesini Aç
      if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setActiveSidebarTab('clip_search');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedChannel,
    selectedDate,
    activeList,
    selectedInstanceId,
    selectedInstanceIds,
    isAnyModalOpen,
    undo,
    redo,
    addAdBreak,
    addFillerSlot,
    removeProgram,
    removePrograms,
    moveProgram,
    copySelectedItem,
    pasteClipboardItem,
    saveDaySchedule,
    setSelectedInstanceId,
    setSelectedInstanceIds,
    setActiveList,
    setViewMode,
    toggleDraftSidebar,
    setActiveSidebarTab,
    setIsAdBreakModalOpen,
    setIsShortcutsModalOpen,
    setIsAddProgramModalOpen
  ]);
}
