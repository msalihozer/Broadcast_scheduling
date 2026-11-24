/**
 * @file src/pages/admin/ProgramsTab.jsx
 * @description Admin Paneli - Yayında Kullanılan (Aktif) Programlar Ana Koordinatör Sekmesi.
 * PostgreSQL arşivinde aktif olarak işaretlenen programların listelenmesi, arşivden hızlı program eklenmesi,
 * çoklu seçimle toplu durum/kategori değiştirme (`ProgramsBatchActionBar`) ve satır içi klip/bölüm yönetimini koordine eder.
 *
 * Modüler Alt Bileşenleri:
 * - `./programs/ProgramsHeaderAndStats.jsx`: Üst başlık barı, aksiyon butonları ve 4'lü KPI istatistik kartları
 * - `./programs/ProgramsFilterAndSearchBar.jsx`: Arama, kategori filtresi, sıralama ve "Arşivden Program Ara & Kullanıma Aç" canlı dropdown
 * - `./programs/UsedProgramsTable.jsx`: Aktif programlar spreadsheet tablosu ve satır içi açılır `ArchiveClipsTable`
 * - `./programs/ProgramsBatchActionBar.jsx`: Çoklu seçim toplu işlem çubuğu
 * - `./programs/ProgramRulesPanel.jsx`: Program ayrıştırma ve birim (Bölüm/Cüz/Gün) kuralları
 * - `./programs/CreateProgramModal.jsx`: Yeni program oluşturma ve klip atama modalı
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MSSQL_CATEGORIES, BROADCAST_CATEGORY_IDS } from '../../utils/categoryColors';
import { getItemSearchRank, filterAndSortBySearchPriority } from '../../utils/searchRanker';
import AddClipsModal from './archive/AddClipsModal';
import { useMultiSelect } from '../../hooks/useMultiSelect';
import { useAdminLogStore } from '../../store/adminLogStore';
import usePlanningStore from '../../store/planningStore';
import AdminLogViewerModal from './components/AdminLogViewerModal';
import OurCategoriesManagerModal from './components/OurCategoriesManagerModal';
import ProgramsBatchActionBar from './programs/ProgramsBatchActionBar';
import CreateProgramModal from './programs/CreateProgramModal';
import ProgramRulesPanel from './programs/ProgramRulesPanel';
import ProgramsHeaderAndStats from './programs/ProgramsHeaderAndStats';
import ProgramsFilterAndSearchBar from './programs/ProgramsFilterAndSearchBar';
import UsedProgramsTable from './programs/UsedProgramsTable';

const ProgramsTab = ({ onNavigateToArchive }) => {
  const [usedPrograms, setUsedPrograms] = useState([]);
  const [ourCategories, setOurCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('category');

  // Modallar ve Log Store
  const [isLogViewerModalOpen, setIsLogViewerModalOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [isCreateProgramModalOpen, setIsCreateProgramModalOpen] = useState(false);
  const [isRulesPanelOpen, setIsRulesPanelOpen] = useState(false);
  const [addingClipsToProgram, setAddingClipsToProgram] = useState(null);
  const [deletingProgramId, setDeletingProgramId] = useState(null);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
  const addLog = useAdminLogStore(state => state.addLog);
  const hiddenCategoryIds = usePlanningStore(state => state.hiddenCategoryIds) || [];
  const hiddenCatSet = useMemo(() => new Set((hiddenCategoryIds || []).map(id => Number(id))), [hiddenCategoryIds]);

  const visibleUsedPrograms = useMemo(
    () => usedPrograms.filter(p => !hiddenCatSet.has(Number(p.categoryId))),
    [usedPrograms, hiddenCatSet]
  );

  // Satır içi klip detayları ve isim düzenleme
  const [expandedClips, setExpandedClips] = useState({});
  const [loadingClipsForProg, setLoadingClipsForProg] = useState({});
  const [editingProgramId, setEditingProgramId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);
  const [togglingProgramId, setTogglingProgramId] = useState(null);

  // Arşivden Hızlı Program Ekleme
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
  const [archiveSearchResults, setArchiveSearchResults] = useState([]);
  const [isSearchingArchive, setIsSearchingArchive] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const searchDropdownRef = useRef(null);

  // Bildirim (Toast)
  const [notification, setNotification] = useState(null);
  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Aktif kullanılan programları ve Bizim DB kategorilerini yükle
  const fetchOurCategories = async () => {
    try {
      const res = await fetch('/api/archive/our-categories');
      if (res.ok) {
        const data = await res.json();
        setOurCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Bizim kategoriler alınamadı:', err);
    }
  };

  const fetchUsedPrograms = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/archive/used-programs');
      if (res.ok) {
        const data = await res.json();
        setUsedPrograms(data.programs || []);
      }
    } catch (err) {
      console.error('Kullanılan programlar alınamadı:', err);
      showToast('Kullanılan programlar sunucudan alınamadı', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOurCategories();
    fetchUsedPrograms();
  }, []);

  // Dropdown dışına tıklandığında arama kutusunu kapat
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Arşiv genelinde arama (Debounced)
  useEffect(() => {
    if (!archiveSearchQuery.trim()) {
      setArchiveSearchResults([]);
      setIsSearchDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingArchive(true);
        const res = await fetch(`/api/archive/search?q=${encodeURIComponent(archiveSearchQuery.trim())}&limit=100`);
        if (res.ok) {
          const data = await res.json();
          const filteredSearch = (data.programs || []).filter(p => !hiddenCatSet.has(Number(p.categoryId)));
          const rankedSearch = filterAndSortBySearchPriority(filteredSearch, archiveSearchQuery.trim(), {
            primaryFields: [(p) => p.title],
            secondaryFields: [(p) => p.categoryName]
          });
          setArchiveSearchResults(rankedSearch);
          setIsSearchDropdownOpen(true);
        }
      } catch (err) {
        console.error('Arşiv arama hatası:', err);
      } finally {
        setIsSearchingArchive(false);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [archiveSearchQuery, hiddenCatSet]);

  // Program Kullanım Durumunu Değiştir (Aç / Kapa)
  const handleToggleStatus = async (programId, currentStatus, programTitle) => {
    const newStatus = !currentStatus;
    try {
      setTogglingProgramId(programId);
      const res = await fetch(`/api/archive/program/${programId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus })
      });

      if (res.ok) {
        showToast(
          newStatus
            ? `"${programTitle || 'Program'}" kullanıma AÇILDI.`
            : `"${programTitle || 'Program'}" kullanımdan kaldırıldı.`
        );

        if (!newStatus) {
          setUsedPrograms(prev => prev.filter(p => p.id !== programId));
        } else {
          fetchUsedPrograms();
        }

        setArchiveSearchResults(prev =>
          prev.map(p => p.id === programId ? { ...p, isActive: newStatus } : p)
        );

        addLog({
          panel: 'programs',
          action: newStatus ? 'Program Kullanıma Açıldı' : 'Program Kullanımdan Kaldırıldı',
          details: `"${programTitle || 'Program'}" (ID: ${programId})`,
          status: 'success'
        });
      } else {
        const err = await res.json();
        showToast(err.error || 'İşlem başarısız', 'error');
        addLog({
          panel: 'programs',
          action: 'Program Durumu Değiştirilemedi',
          details: `Hata: ${err.error || 'Bilinmeyen hata'} (ID: ${programId})`,
          status: 'error'
        });
      }
    } catch (err) {
      showToast('Bağlantı hatası oluştu', 'error');
    } finally {
      setTogglingProgramId(null);
    }
  };

  // Satır içi klip detaylarını yükle / aç-kapa
  const handleToggleClips = async (progId) => {
    if (expandedClips[progId]) {
      setExpandedClips(prev => {
        const copy = { ...prev };
        delete copy[progId];
        return copy;
      });
      return;
    }

    try {
      setLoadingClipsForProg(prev => ({ ...prev, [progId]: true }));
      const res = await fetch(`/api/archive/program/${progId}/clips`);
      if (res.ok) {
        const data = await res.json();
        setExpandedClips(prev => ({ ...prev, [progId]: data.clips || [] }));
      }
    } catch (err) {
      console.error('Klipler alınamadı:', err);
    } finally {
      setLoadingClipsForProg(prev => ({ ...prev, [progId]: false }));
    }
  };

  const handleRefreshClips = async (progId) => {
    try {
      setLoadingClipsForProg(prev => ({ ...prev, [progId]: true }));
      const res = await fetch(`/api/archive/program/${progId}/clips`);
      if (res.ok) {
        const data = await res.json();
        setExpandedClips(prev => ({ ...prev, [progId]: data.clips || [] }));
      }
    } catch (err) {
      console.error('Klipler yenilenemedi:', err);
    } finally {
      setLoadingClipsForProg(prev => ({ ...prev, [progId]: false }));
    }
  };

  // Program adını düzenle
  const handleStartEdit = (prog) => {
    setEditingProgramId(prog.id);
    setEditTitle(prog.title);
  };

  const handleSaveTitle = async (progId) => {
    if (!editTitle || !editTitle.trim()) return;
    try {
      setIsUpdatingTitle(true);
      const res = await fetch(`/api/archive/program/${progId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim() })
      });
      if (res.ok) {
        setUsedPrograms(prev =>
          prev.map(p => p.id === progId ? { ...p, title: editTitle.trim() } : p)
        );
        setEditingProgramId(null);
        showToast('Program başlığı güncellendi.');
        addLog({
          panel: 'programs',
          action: 'Program Başlığı Güncellendi',
          details: `ID: ${progId} -> "${editTitle.trim()}"`,
          status: 'success'
        });
      } else {
        const err = await res.json();
        showToast(err.error || 'Güncelleme başarısız', 'error');
      }
    } catch (err) {
      showToast('Güncelleme sırasında hata oluştu', 'error');
    } finally {
      setIsUpdatingTitle(false);
    }
  };

  // Tekil programın Bizim Kategorisini güncelle
  const handleChangeProgramCategory = async (prog, nextCatId) => {
    try {
      const res = await fetch(`/api/archive/program/${prog.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: nextCatId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const dynNext = ourCategories.find(c => Number(c.id) === Number(nextCatId));
        const nextName = dynNext?.name || MSSQL_CATEGORIES[nextCatId]?.name || `Kategori #${nextCatId}`;
        showToast(`"${prog.title}" Bizim Kategorisi "#${nextCatId} ${nextName}" olarak güncellendi.`);
        fetchUsedPrograms();
        fetchOurCategories();
      }
    } catch (err) {
      showToast('Kategori güncellenemedi', 'error');
    }
  };

  // Filtrelenmiş ve sıralanmış programlar
  const filteredPrograms = useMemo(() => {
    let list = [...visibleUsedPrograms];

    if (categoryFilter !== 'all') {
      const catId = parseInt(categoryFilter, 10);
      list = list.filter(p => p.categoryId === catId);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim();
      const matched = [];
      for (const p of list) {
        const rank = getItemSearchRank(p, q, {
          primaryFields: [(prog) => prog.title],
          secondaryFields: [(prog) => prog.categoryName]
        });
        if (rank.matched) {
          matched.push({ p, rank });
        }
      }
      matched.sort((a, b) => {
        if (a.rank.tier !== b.rank.tier) return a.rank.tier - b.rank.tier;
        if (a.rank.position !== b.rank.position) return a.rank.position - b.rank.position;
        if (sortBy === 'category') return a.p.categoryId - b.p.categoryId || (b.p.totalClips || 0) - (a.p.totalClips || 0);
        if (sortBy === 'clips-desc') return (b.p.totalClips || 0) - (a.p.totalClips || 0);
        if (sortBy === 'duration-desc') return (b.p.totalDurationSec || 0) - (a.p.totalDurationSec || 0);
        return (a.p.title || '').localeCompare(b.p.title || '', 'tr-TR');
      });
      return matched.map(m => m.p);
    }

    if (sortBy === 'category') {
      list.sort((a, b) => a.categoryId - b.categoryId || (b.totalClips || 0) - (a.totalClips || 0));
    } else if (sortBy === 'name-asc') {
      list.sort((a, b) => a.title.localeCompare(b.title, 'tr-TR'));
    } else if (sortBy === 'clips-desc') {
      list.sort((a, b) => (b.totalClips || 0) - (a.totalClips || 0));
    } else if (sortBy === 'duration-desc') {
      list.sort((a, b) => (b.totalDurationSec || 0) - (a.totalDurationSec || 0));
    }

    return list;
  }, [visibleUsedPrograms, categoryFilter, searchTerm, sortBy]);

  // İstatistik özetleri
  const stats = useMemo(() => {
    const totalClips = visibleUsedPrograms.reduce((acc, p) => acc + (p.totalClips || 0), 0);
    const totalDurationSec = visibleUsedPrograms.reduce((acc, p) => acc + (p.totalDurationSec || 0), 0);
    const uniqueCats = new Set(visibleUsedPrograms.map(p => p.categoryId)).size;
    return { totalClips, totalDurationSec, uniqueCats };
  }, [visibleUsedPrograms]);

  // Evrensel çoklu seçim hook'u (Shift+Click aralık seçimi dahil)
  const {
    selectedIds,
    selectedItems,
    selectedCount,
    isSelected,
    handleItemSelect,
    selectAll,
    deselectAll,
    invertSelection,
    isAllSelected
  } = useMultiSelect(filteredPrograms, (p) => p.id);

  // Klavye kısayolları (Ctrl+A ile tümünü seç, Esc ile temizle)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAll();
      } else if (e.key === 'Escape') {
        deselectAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectAll, deselectAll]);

  // Toplu Program Kullanım Durumu Değiştirme (Aç / Kapat)
  const handleBulkStatusChange = async (isActive) => {
    if (selectedCount === 0) return;
    try {
      setIsSubmittingBulk(true);
      const res = await fetch('/api/archive/programs/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programIds: Array.from(selectedIds), isActive })
      });

      if (res.ok) {
        const data = await res.json();
        showToast(
          isActive
            ? `${data.count || selectedCount} program başarıyla kullanıma açıldı.`
            : `${data.count || selectedCount} program kullanımdan kaldırıldı.`
        );

        addLog({
          panel: 'programs',
          action: isActive ? 'Toplu Program Kullanıma Açıldı' : 'Toplu Program Kullanımdan Kaldırıldı',
          details: `${data.count || selectedCount} adet program durumu güncellendi`,
          count: data.count || selectedCount,
          status: 'success'
        });

        deselectAll();
        fetchUsedPrograms();
      } else {
        const err = await res.json();
        showToast(err.error || 'Toplu işlem başarısız oldu', 'error');
        addLog({
          panel: 'programs',
          action: 'Toplu Program Güncelleme Hatası',
          details: err.error || 'Bilinmeyen hata',
          status: 'error'
        });
      }
    } catch (err) {
      console.error('Toplu durum hatası:', err);
      showToast('Sunucu bağlantı hatası', 'error');
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  // Tekil Program Silme
  const handleDeleteProgram = async (prog) => {
    if (!prog?.id) return;
    const confirmMsg = `"${prog.title}" programını silmek istediğinize emin misiniz?\n\nPrograma bağlı ${prog.totalClips || 0} klip silinmeyecek, [${prog.categoryName || 'Kategori'} (Genel / Atanmamış)] listesine aktarılacaktır.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setDeletingProgramId(prog.id);
      const res = await fetch(`/api/archive/program/${prog.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteClips: false })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Program silinemedi');
      }

      setUsedPrograms(prev => prev.filter(p => p.id !== prog.id));
      showToast(`"${prog.title}" programı silindi (${data.detachedCount || 0} klip Genel Arşiv'e aktarıldı).`);
      addLog({
        panel: 'programs',
        action: 'Program Silindi',
        details: `"${prog.title}" (ID: ${prog.id}) silindi, ${data.detachedCount || 0} klip Genel Arşiv'e aktarıldı`,
        count: 1,
        status: 'warning'
      });
    } catch (err) {
      console.error('Program silme hatası:', err);
      showToast(err.message || 'Program silinirken hata oluştu', 'error');
    } finally {
      setDeletingProgramId(null);
    }
  };

  // Seçili Programları Toplu Silme
  const handleBulkDeletePrograms = async () => {
    if (selectedCount === 0) return;
    const confirmMsg = `DİKKAT: Seçili ${selectedCount} adet programı silmek istediğinize emin misiniz?\n\nProgramlara bağlı klipler silinmeyecek, kendi kategorilerindeki (Genel / Atanmamış) listelerine aktarılacaktır.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsSubmittingBulk(true);
      const res = await fetch('/api/archive/programs/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programIds: Array.from(selectedIds),
          deleteClips: false
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Toplu silme işlemi başarısız oldu');
      }

      showToast(`${data.deletedCount || selectedCount} program başarıyla silindi.`);
      addLog({
        panel: 'programs',
        action: 'Toplu Program Silindi',
        details: `${data.deletedCount || selectedCount} adet program silindi`,
        count: data.deletedCount || selectedCount,
        status: 'warning'
      });

      deselectAll();
      fetchUsedPrograms();
    } catch (err) {
      console.error('Toplu program silme hatası:', err);
      showToast(err.message || 'Toplu silme sırasında hata oluştu', 'error');
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Bildirimi */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          background: notification.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
          color: '#fff',
          padding: '14px 20px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          zIndex: 9999,
          fontWeight: '600',
          fontSize: '13px',
          backdropFilter: 'blur(8px)'
        }}>
          <span>{notification.message}</span>
        </div>
      )}

      {/* 1. Üst Başlık ve 4'lü KPI İstatistik Metrik Kartları */}
      <ProgramsHeaderAndStats
        usedProgramsCount={usedPrograms.length}
        stats={stats}
        isLoading={isLoading}
        isRulesPanelOpen={isRulesPanelOpen}
        onToggleRulesPanel={() => setIsRulesPanelOpen(prev => !prev)}
        onOpenCategoriesModal={() => setIsCategoriesModalOpen(true)}
        onOpenCreateProgramModal={() => setIsCreateProgramModalOpen(true)}
        onOpenLogViewerModal={() => setIsLogViewerModalOpen(true)}
        onRefreshPrograms={fetchUsedPrograms}
      />

      {/* 2. Program Ayrıştırma & Birim (Bölüm / Cüz / Gün) Kuralları Paneli */}
      {isRulesPanelOpen && (
        <ProgramRulesPanel
          onRulesApplied={() => {
            fetchUsedPrograms();
            setExpandedClips({});
          }}
        />
      )}

      {/* 3. Arama, Kategori Filtresi ve Arşivden Program Ekleme Çubuğu */}
      <ProgramsFilterAndSearchBar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        visibleUsedPrograms={visibleUsedPrograms}
        ourCategories={ourCategories}
        searchDropdownRef={searchDropdownRef}
        archiveSearchQuery={archiveSearchQuery}
        onArchiveSearchQueryChange={setArchiveSearchQuery}
        archiveSearchResults={archiveSearchResults}
        isSearchingArchive={isSearchingArchive}
        isSearchDropdownOpen={isSearchDropdownOpen}
        onSetSearchDropdownOpen={setIsSearchDropdownOpen}
        togglingProgramId={togglingProgramId}
        onToggleStatus={handleToggleStatus}
      />

      {/* 4. Çoklu Seçim ve Toplu İşlem Kontrol Çubuğu */}
      <ProgramsBatchActionBar
        selectedCount={selectedCount}
        totalCount={filteredPrograms.length}
        isAllSelected={isAllSelected}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        onInvertSelection={invertSelection}
        onBulkActivate={() => handleBulkStatusChange(true)}
        onBulkDeactivate={() => handleBulkStatusChange(false)}
        availableCategories={ourCategories.length > 0 ? ourCategories : BROADCAST_CATEGORY_IDS.map(cid => ({ id: cid, name: MSSQL_CATEGORIES[cid]?.name }))}
        onBulkChangeCategory={async (targetCategoryId) => {
          if (selectedCount === 0 || !targetCategoryId) return;
          try {
            setIsSubmittingBulk(true);
            const res = await fetch('/api/archive/programs/bulk-category', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                programIds: selectedItems.map(p => p.id),
                categoryId: targetCategoryId
              })
            });
            const data = await res.json();
            if (res.ok && data.success) {
              const catObj = ourCategories.find(c => Number(c.id) === Number(targetCategoryId));
              const catLabel = catObj?.name || MSSQL_CATEGORIES[targetCategoryId]?.name || `Kategori #${targetCategoryId}`;
              showToast(`${data.count} programın Bizim Kategorisi "#${targetCategoryId} ${catLabel}" olarak güncellendi.`);
              deselectAll();
              fetchUsedPrograms();
              fetchOurCategories();
            } else {
              showToast(data.error || 'Toplu kategori güncelleme hatası', 'error');
            }
          } catch (err) {
            showToast('Sunucu bağlantı hatası', 'error');
          } finally {
            setIsSubmittingBulk(false);
          }
        }}
        onBulkDelete={handleBulkDeletePrograms}
        isSubmitting={isSubmittingBulk}
      />

      {/* 5. Programlar Tablosu (Excel / Spreadsheet Stili) */}
      <UsedProgramsTable
        isLoading={isLoading}
        filteredPrograms={filteredPrograms}
        ourCategories={ourCategories}
        isAllSelected={isAllSelected}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        isSelected={isSelected}
        onItemSelect={handleItemSelect}
        expandedClips={expandedClips}
        loadingClipsForProg={loadingClipsForProg}
        editingProgramId={editingProgramId}
        editTitle={editTitle}
        isUpdatingTitle={isUpdatingTitle}
        togglingProgramId={togglingProgramId}
        deletingProgramId={deletingProgramId}
        onStartEdit={handleStartEdit}
        onEditTitleChange={setEditTitle}
        onSaveTitle={handleSaveTitle}
        onCancelEdit={() => setEditingProgramId(null)}
        onChangeProgramCategory={handleChangeProgramCategory}
        onToggleStatus={handleToggleStatus}
        onAddClipsToProgram={setAddingClipsToProgram}
        onToggleClips={handleToggleClips}
        onRefreshClips={handleRefreshClips}
        onDeleteProgram={handleDeleteProgram}
        onNavigateToArchive={onNavigateToArchive}
        onRefreshUsedPrograms={fetchUsedPrograms}
      />

      {/* Modallar */}
      <CreateProgramModal
        isOpen={isCreateProgramModalOpen}
        onClose={() => setIsCreateProgramModalOpen(false)}
        onSuccess={(createdProgram, assignedClipsCount) => {
          setIsCreateProgramModalOpen(false);
          fetchUsedPrograms();
          showToast(
            `"${createdProgram?.title || 'Yeni Program'}" oluşturuldu${assignedClipsCount > 0 ? ` ve ${assignedClipsCount} klip eklendi` : ''}.`
          );
          addLog({
            panel: 'programs',
            action: 'Yeni Program Eklendi',
            details: `"${createdProgram?.title}" (${createdProgram?.categoryName}) oluşturuldu${assignedClipsCount > 0 ? `, ${assignedClipsCount} klip atandı` : ''}`,
            count: assignedClipsCount || 1,
            status: 'success'
          });
        }}
      />

      {addingClipsToProgram && (
        <AddClipsModal
          isOpen={!!addingClipsToProgram}
          onClose={() => setAddingClipsToProgram(null)}
          targetProgram={addingClipsToProgram}
          program={addingClipsToProgram}
          onSuccess={() => {
            const progId = addingClipsToProgram.id;
            const progTitle = addingClipsToProgram.title;
            setAddingClipsToProgram(null);
            fetchUsedPrograms();
            if (expandedClips[progId]) {
              handleRefreshClips(progId);
            }
            showToast(`"${progTitle}" programına yeni klipler eklendi.`);
            addLog({
              panel: 'programs',
              action: 'Programa Klip Eklendi',
              details: `"${progTitle}" (ID: ${progId}) programına arşivden klipler eklendi`,
              status: 'success'
            });
          }}
        />
      )}

      <AdminLogViewerModal
        isOpen={isLogViewerModalOpen}
        onClose={() => setIsLogViewerModalOpen(false)}
      />

      <OurCategoriesManagerModal
        isOpen={isCategoriesModalOpen}
        onClose={() => setIsCategoriesModalOpen(false)}
        onCategoriesUpdated={() => {
          fetchOurCategories();
          fetchUsedPrograms();
        }}
      />
    </div>
  );
};

export default ProgramsTab;
