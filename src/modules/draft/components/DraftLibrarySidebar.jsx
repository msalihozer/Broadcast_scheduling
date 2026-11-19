/**
 * @file DraftLibrarySidebar.jsx
 * @description Taslak Planlama sol paneli: Kullanılan Programlar Kütüphanesi & Hızlı Kuşak Ekleme.
 * 
 * Kullanıcı isteği doğrultusunda tamamen sadeleştirildi:
 * - Sol panelde sadece aktif programlar, kategori rozeti ve bölüm sayısı listelenir.
 * - Sürükle-bırak yapıldığında veya "Ekle" butonuna tıklandığında akıllı DraftAddScheduleModal açılır.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  LibraryHeader,
  LibraryClosedButton,
  LibraryDolguCard,
  LibraryFilters,
  LibraryProgramItem,
  CATEGORY_COLORS
} from './library';
import { filterAndSortBySearchPriority } from '../../../utils/searchRanker';

const DraftLibrarySidebar = ({
  isOpen = true,
  onToggle,
  onOpenAddModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [programs, setPrograms] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Kullanılan programları API'den yükle
  useEffect(() => {
    let isMounted = true;
    const loadPrograms = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/archive/used-programs');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.programs) {
            setPrograms(data.programs);
          }
        }
      } catch (err) {
        console.error('[LIBRARY] Programlar yüklenemedi:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadPrograms();
    return () => { isMounted = false; };
  }, []);

  // 2. Kategori ve Arama Filtrelemesi (Öncelik Algoritması: Başlayan -> Kelime Başlangıcı -> İçeren)
  const filteredPrograms = useMemo(() => {
    let list = programs;
    if (selectedCategory !== 'all') {
      list = list.filter(p => p.categoryName === selectedCategory || (selectedCategory === 'Dini' && p.categoryName?.includes('Dini')));
    }
    if (searchQuery.trim()) {
      list = filterAndSortBySearchPriority(
        list,
        searchQuery,
        (p) => p.title || p.name || '',
        (p) => [p.categoryName, p.host]
      );
    }
    return list;
  }, [programs, selectedCategory, searchQuery]);

  // Kategoriler listesi ve her kategorideki program sayısı
  const { availableCategories, categoryCounts } = useMemo(() => {
    const counts = {};
    programs.forEach(p => {
      if (p.categoryName) {
        counts[p.categoryName] = (counts[p.categoryName] || 0) + 1;
      }
    });
    return {
      availableCategories: Object.keys(counts),
      categoryCounts: counts
    };
  }, [programs]);

  // Sürükleme Başlangıcı (Matrise bırakıldığında matristeki slot bilgisiyle birlikte modal açılır)
  const handleItemDragStart = (e, prog) => {
    const catName = prog.categoryName || 'Genel';
    const payload = {
      isLibraryItem: true,
      programData: {
        id: prog.id,
        title: prog.title || prog.name || 'Program',
        episode: '',
        duration: prog.categoryId === 10 ? 30 : 60,
        category: catName,
        categoryColor: CATEGORY_COLORS[catName] || '#3b82f6',
        categoryBadge: catName,
        host: prog.host || '',
        topic: '',
        isKisaSlot: prog.categoryId === 10,
        totalEpisodes: prog.totalEpisodes,
        totalClips: prog.totalClips
      }
    };
    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'all';
  };

  const handleDolguDragStart = (e) => {
    const payload = {
      isLibraryItem: true,
      programData: {
        title: 'Dolgu Kuşağı',
        episode: '',
        duration: 30,
        category: 'Dolgu Kuşağı',
        categoryColor: '#06b6d4',
        categoryBadge: 'Dolgu Kuşağı',
        host: '',
        topic: 'Kısa Program, Kaside, Aşr-ı Şerif',
        isKisaSlot: true,
        availableOptions: ['Kısa Program', 'Kaside', 'Aşr-ı Şerif'],
        selectedOptions: ['Kısa Program', 'Kaside', 'Aşr-ı Şerif']
      }
    };
    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'all';
  };

  // Panel kapalıysa hiçbir şey render etme (Kullanıcı isteğiyle buton kaldırıldı, üst bardaki 'Program Kütüphanesi' butonundan açılır)
  if (!isOpen) {
    return null;
  }

  return (
    <div style={{
      width: '360px',
      minWidth: '340px',
      maxWidth: '380px',
      background: 'var(--bg-secondary)',
      border: '2px solid var(--border-color)',
      borderRadius: '16px',
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - var(--header-height, 60px) - 28px)',
      maxHeight: 'calc(100vh - var(--header-height, 60px) - 28px)',
      position: 'sticky',
      top: 'calc(var(--header-height, 60px) + 14px)',
      zIndex: 40,
      boxShadow: '0 12px 36px rgba(0, 0, 0, 0.14)',
      overflow: 'hidden',
      userSelect: 'none',
      flexShrink: 0
    }}>
      {/* 1. BAŞLIK VE KAPATMA BUTONU */}
      <LibraryHeader programCount={programs.length} onToggle={onToggle} />

      {/* 2. EN ÜSTTE: PROGRAM ARAMA + CANLI/DOLGU + BELİRGİN KAPALI KATEGORİLER */}
      <LibraryFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        availableCategories={availableCategories}
        categoryCounts={categoryCounts}
        totalCount={programs.length}
        onDragStartDolgu={handleDolguDragStart}
        onOpenAddModal={onOpenAddModal}
      />

      {/* 3. PROGRAMLAR LİSTESİ (KAYDIRILABİLİR ANA ALAN) */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
      }}>
        {isLoading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
            Program kütüphanesi yükleniyor...
          </div>
        ) : filteredPrograms.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
            Aramaya uygun program bulunamadı.
          </div>
        ) : (
          filteredPrograms.map(prog => {
            const catColor = CATEGORY_COLORS[prog.categoryName] || '#3b82f6';
            return (
              <LibraryProgramItem
                key={prog.id}
                prog={prog}
                catColor={catColor}
                onDragStartItem={handleItemDragStart}
                onOpenAddModal={onOpenAddModal}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default React.memo(DraftLibrarySidebar);
