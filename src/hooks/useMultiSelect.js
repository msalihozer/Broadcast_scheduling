/**
 * @file src/hooks/useMultiSelect.js
 * @description Tablo ve listelerde gelişmiş çoklu seçim (Shift + Click aralık seçimi,
 * Ctrl+A tümünü seçme, Escape temizleme, tersine çevirme) sağlayan evrensel hook.
 */
import { useState, useCallback, useRef, useMemo } from 'react';

export function useMultiSelect(items = [], getItemId = (item) => item?.id ?? item?.fileId) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const lastSelectedIndexRef = useRef(null);

  // Bir öğenin seçili olup olmadığını kontrol et
  const isSelected = useCallback((id) => {
    if (id === undefined || id === null) return false;
    return selectedIds.has(id);
  }, [selectedIds]);

  // Tekil öğe veya Shift+Click ile aralık seçimi
  const handleItemSelect = useCallback((item, index, event) => {
    const itemId = getItemId(item);
    if (itemId === undefined || itemId === null) return;

    // Shift tuşu kontrolü (MouseEvent veya React SyntheticEvent)
    const isShift = Boolean(
      event && (
        event.shiftKey === true || 
        event.nativeEvent?.shiftKey === true
      )
    );

    // Shift+Click yapıldığında tarayıcının metin seçmesini engelle
    if (isShift) {
      if (event.preventDefault) event.preventDefault();
      try {
        if (window.getSelection) {
          window.getSelection().removeAllRanges();
        }
      } catch (e) {}
    }

    const anchorIndex = lastSelectedIndexRef.current;

    setSelectedIds(prev => {
      const next = new Set(prev);

      // Shift + Click ile aralık seçimi (anchor mevcutsa)
      if (isShift && anchorIndex !== null && anchorIndex !== undefined) {
        const start = Math.min(anchorIndex, index);
        const end = Math.max(anchorIndex, index);

        for (let i = start; i <= end; i++) {
          const currentItem = items[i];
          if (currentItem) {
            const id = getItemId(currentItem);
            if (id !== undefined && id !== null) {
              next.add(id);
            }
          }
        }
      } else {
        // Normal tıklama veya Shift olmadan: Toggle yap
        if (next.has(itemId)) {
          next.delete(itemId);
        } else {
          next.add(itemId);
        }
      }

      return next;
    });

    // Anchor index'i güncelle
    lastSelectedIndexRef.current = index;
  }, [items, getItemId]);

  // Tümünü seç
  const selectAll = useCallback(() => {
    const next = new Set();
    items.forEach(item => {
      const id = getItemId(item);
      if (id !== undefined && id !== null) next.add(id);
    });
    setSelectedIds(next);
  }, [items, getItemId]);

  // Seçimi temizle
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
    lastSelectedIndexRef.current = null;
  }, []);

  // Seçimi tersine çevir
  const invertSelection = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set();
      items.forEach(item => {
        const id = getItemId(item);
        if (id !== undefined && id !== null && !prev.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [items, getItemId]);

  // Seçili öğelerin nesnelerini döner
  const selectedItems = useMemo(() => {
    return items.filter(item => selectedIds.has(getItemId(item)));
  }, [items, selectedIds, getItemId]);

  // Array formatında ID listesi (API çağrıları için)
  const selectedArray = useMemo(() => {
    return Array.from(selectedIds);
  }, [selectedIds]);

  const selectedCount = selectedIds.size;
  const isAllSelected = items.length > 0 && selectedCount === items.length;
  const isIndeterminate = selectedCount > 0 && selectedCount < items.length;

  return {
    selectedIds,
    selectedArray,
    selectedItems,
    selectedCount,
    isSelected,
    handleItemSelect,
    selectAll,
    deselectAll,
    invertSelection,
    isAllSelected,
    isIndeterminate,
    setSelectedIds
  };
}

export default useMultiSelect;
