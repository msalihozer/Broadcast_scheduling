/**
 * @file useDraftKeyboardShortcuts.js
 * @description Taslak Planlama modülü tüm küresel ve yerel klavye kısayollarını dinleyen hook.
 * 
 * Desteklenen Kısayollar:
 * - Ctrl + S: Değişiklikleri diske ve backend veritabanına kaydet
 * - Ctrl + C: Seçili program kuşaklarını kopyala
 * - Ctrl + V: Kopyalananları yapıştır (Seçili varsa altına, yoksa gün sonuna)
 * - Ctrl + Z: Son işlemi geri al (Undo)
 * - Delete / ⌫: Seçili program kuşaklarını sil
 * - Ctrl + A: Görüntülenen tüm programları seç
 * - Ctrl + E: Excel yükleme modalını aç
 * - G / R: Izgara (Grid) ve Rundown modları arası geçiş
 * - 0 / 1-7: Hafta geneli (0) ve gün filtreleri (1: Pzt, 2: Salı... 7: Pazar)
 * - ? veya K: Kısayol kılavuzunu aç / kapat
 * - Esc: Modalları kapat veya seçimleri temizle
 */
import { useEffect } from 'react';
import { dialog } from '../../../store/dialogStore';

export const useDraftKeyboardShortcuts = ({
  handleSaveSchedule,
  copySelected,
  pasteFromClipboard,
  undo,
  selectedProgramIds,
  selectedList,
  handleDeleteSelectedPrograms,
  handleClearSelection,
  selectAllVisible,
  activeDaysKeys,
  allDaysKeys,
  setViewMode,
  setSelectedDayKey,
  setIsShortcutsOpen,
  setIsImportModalOpen,
  setIsCalendarOpen,
  setIsQuotaModalOpen,
  setSelectedProgram,
  isShortcutsOpen,
  isQuotaModalOpen,
  isCalendarOpen,
  isImportModalOpen,
  selectedProgram
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. Ctrl + S / Cmd + S: Akışı Kaydet (Input içindeyken bile çalışır)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveSchedule && handleSaveSchedule();
        return;
      }

      // Input, Textarea veya Select içindeyken diğer kısayolları engelle
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

      // 2. Ctrl + Z / Cmd + Z: Son İşlemi Geri Al (Undo)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo && undo();
        return;
      }

      // 3. Ctrl + C / Cmd + C: Kopyala
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySelected && copySelected();
        return;
      }

      // 4. Ctrl + V / Cmd + V: Yapıştır (Seçilenin altına veya günün sonuna)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteFromClipboard && pasteFromClipboard();
        return;
      }

      // 5. Delete veya Backspace: Seçili Kuşakları Sil
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedProgramIds && selectedProgramIds.length > 0) {
          e.preventDefault();
          dialog.confirm(
            'Seçili Kuşakları Sil',
            `Seçili ${selectedProgramIds.length} program kuşağını akıştan tamamen silmek istediğinize emin misiniz?`,
            { isDestructive: true, confirmText: 'Evet, Sil' }
          ).then(confirmDelete => {
            if (confirmDelete) {
              handleDeleteSelectedPrograms && handleDeleteSelectedPrograms(selectedList);
            }
          });
        }
        return;
      }

      // 6. Ctrl + A / Cmd + A: Görüntülenen tüm programları seç
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAllVisible && selectAllVisible(activeDaysKeys);
        return;
      }

      // 7. Ctrl + E: Excel Yükleme Penceresini Aç
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setIsImportModalOpen && setIsImportModalOpen(true);
        return;
      }

      // 8. Kısayollar Penceresi (? veya K)
      if (e.key === '?' || (e.key.toLowerCase() === 'k' && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        setIsShortcutsOpen && setIsShortcutsOpen(prev => !prev);
        return;
      }

      // 9. Escape: Seçimi temizle veya açık modalleri kapat
      if (e.key === 'Escape') {
        if (isShortcutsOpen) { setIsShortcutsOpen(false); return; }
        if (isQuotaModalOpen) { setIsQuotaModalOpen(false); return; }
        if (isCalendarOpen) { setIsCalendarOpen(false); return; }
        if (isImportModalOpen) { setIsImportModalOpen(false); return; }
        if (selectedProgram) { setSelectedProgram(null); return; }
        if (selectedProgramIds && selectedProgramIds.length > 0) {
          handleClearSelection && handleClearSelection();
          return;
        }
      }

      // 10. Görünüm Değiştirme (G: Grid, R: Rundown)
      if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setViewMode && setViewMode('grid');
        return;
      }
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setViewMode && setViewMode('rundown');
        return;
      }

      // 11. Gün Gezintisi (0: Tüm Hafta, 1-7: Pazartesi - Pazar)
      if (e.key === '0') {
        e.preventDefault();
        setSelectedDayKey && setSelectedDayKey('all');
        return;
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 7) {
        e.preventDefault();
        const targetDateKey = allDaysKeys?.[num - 1];
        if (targetDateKey) {
          setSelectedDayKey && setSelectedDayKey(targetDateKey);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleSaveSchedule,
    copySelected,
    pasteFromClipboard,
    undo,
    selectedProgramIds,
    selectedList,
    handleDeleteSelectedPrograms,
    handleClearSelection,
    selectAllVisible,
    activeDaysKeys,
    allDaysKeys,
    setViewMode,
    setSelectedDayKey,
    setIsShortcutsOpen,
    setIsImportModalOpen,
    setIsCalendarOpen,
    setIsQuotaModalOpen,
    setSelectedProgram,
    isShortcutsOpen,
    isQuotaModalOpen,
    isCalendarOpen,
    isImportModalOpen,
    selectedProgram
  ]);
};
