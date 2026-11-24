/**
 * @file src/pages/admin/ArchiveAnalysisTab.jsx
 * @description Admin Paneli - MAM Arşiv & Bölüm Analizi Ana Koordinatör Sekmesi.
 * İçeride iki ayrı alana ayrılır:
 * 1) Verileri Çektiğimiz TV MAM DB (MSSQL Bağlantısı, Otomatik Güncelleme Kontrolü & Kaynak Kategoriler)
 * 2) Bizim DB (Yerel PostgreSQL Planlama Kategorileri, Program İsmi, Aktif/Pasif Durumu & Bölümler)
 *
 * Modüler Alt Bileşenleri:
 * - `./archive/ArchiveHeader.jsx`: Üst başlık barı ve tüm kategorileri senkronize etme kontrolleri
 * - `./archive/ArchiveAreaAndCategoryBanner.jsx`: 2-alan seçicisi (`ArchiveAreaSwitcher`) ve seçili kategori şema şeridi (`ArchiveSelectedCategoryBanner`)
 * - `./archive/MamDatabaseSyncPanel.jsx`: TV MAM DB bağlantı durumu, akıllı delta senkronizasyon ve kaynak kategori tablosu
 * - `./archive/ArchiveCategoryPills.jsx`: Yatay kaydırılabilir kategori seçim butonları ve "Kategorileri Yönet" tetikleyicisi
 * - `./archive/ArchiveMetrics.jsx`: Seçili kategoriye ait 4'lü KPI istatistik kartları
 * - `./archive/ArchiveFilterBar.jsx`: Durum filtresi (Tümü/Aktif/Pasif), arama ve sıralama çubuğu
 * - `./archive/ArchiveProgramCard.jsx`: Tekil program kartı ve açılır `ArchiveClipsTable`
 * - `./archive/ArchivePaginationBar.jsx`: Sayfalama (pagination) çubuğu
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { MSSQL_CATEGORIES } from '../../utils/categoryColors';
import { getItemSearchRank } from '../../utils/searchRanker';
import ArchiveHeader from './archive/ArchiveHeader';
import ArchiveCategoryPills from './archive/ArchiveCategoryPills';
import ArchiveMetrics from './archive/ArchiveMetrics';
import ArchiveFilterBar from './archive/ArchiveFilterBar';
import ArchiveProgramCard from './archive/ArchiveProgramCard';
import MamDatabaseSyncPanel from './archive/MamDatabaseSyncPanel';
import ArchiveClipSearchModal from './archive/ArchiveClipSearchModal';
import { ArchiveAreaSwitcher, ArchiveSelectedCategoryBanner } from './archive/ArchiveAreaAndCategoryBanner';
import ArchivePaginationBar from './archive/ArchivePaginationBar';
import AdminLogViewerModal from './components/AdminLogViewerModal';
import OurCategoriesManagerModal from './components/OurCategoriesManagerModal';
import useAdminLogStore from '../../store/adminLogStore';

const ArchiveAnalysisTab = ({ initialCategoryId = 4, initialSearch = '' }) => {
  // İçerideki İki Ana Alan: 'our_db' (Bizim DB) | 'mam_db' (TV MAM DB)
  const [activeArea, setActiveArea] = useState('our_db');

  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId);
  const [archiveData, setArchiveData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingCategoryId, setSyncingCategoryId] = useState(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [changingCatProgramId, setChangingCatProgramId] = useState(null);
  const [notification, setNotification] = useState(null);

  // TV MAM DB Bağlantı ve Akıllı Delta Güncelleme Kontrolü Durumu
  const [mamStatus, setMamStatus] = useState(null);
  const [isCheckingMamStatus, setIsCheckingMamStatus] = useState(false);
  const [isSyncingDelta, setIsSyncingDelta] = useState(false);
  const [checkIntervalMin, setCheckIntervalMin] = useState(5);
  const [autoDeltaSync, setAutoDeltaSync] = useState(true);

  // Modallar
  const [isClipSearchModalOpen, setIsClipSearchModalOpen] = useState(false);
  const [isLogViewerModalOpen, setIsLogViewerModalOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [deletingProgramId, setDeletingProgramId] = useState(null);

  // Log store
  const addLog = useAdminLogStore(state => state.addLog);

  // Filtreler
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [searchTerm, setSearchTerm] = useState(initialSearch || '');
  const [sortBy, setSortBy] = useState('clips-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;

  // Açılır kartlar
  const [expandedPrograms, setExpandedPrograms] = useState({});
  const [togglingProgramId, setTogglingProgramId] = useState(null);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Kategorilerin durumlarını yükle
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/archive/categories');
      if (res.ok) {
        const data = await res.json();
        if (data.categories) {
          setCategories(data.categories);
        }
      }
    } catch (err) {
      console.error('Kategoriler alınamadı:', err);
    }
  }, []);

  // Seçili kategorinin arşiv programlarını yükle (filterMode: 'our' veya 'mam')
  const fetchCategoryArchive = useCallback(async (catId, currentStatus = statusFilter, currentArea = activeArea) => {
    try {
      setIsLoading(true);
      const filterMode = currentArea === 'mam_db' ? 'mam' : 'our';
      let url = `/api/archive/programs?categoryId=${catId}&filterMode=${filterMode}`;
      if (currentStatus === 'active') url += '&isActive=true';
      else if (currentStatus === 'inactive') url += '&isActive=false';
      else url += '&isActive=all';

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setArchiveData(data);
        setCurrentPage(1);
        setExpandedPrograms({});
      } else {
        const err = await res.json();
        showToast(err.error || 'Arşiv verisi alınamadı', 'error');
      }
    } catch (err) {
      console.error('Arşiv hatası:', err);
      showToast('Arşiv sunucusuna bağlanılamadı', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, activeArea]);

  // Akıllı Delta Senkronizasyon (Sadece yeni eklenen klipleri çeker)
  const handleSyncDelta = useCallback(async (targetCategoryId = null, silent = false) => {
    try {
      setIsSyncingDelta(true);
      const res = await fetch('/api/archive/syncDelta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: targetCategoryId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (!silent || data.totalNewSynced > 0) {
          showToast(
            data.totalNewSynced > 0
              ? `${data.totalNewSynced} yeni klip TV MAM DB'den hızlıca çekildi (${data.affectedProgramsCount} program güncellendi)!`
              : 'Yeni eklenecek klip bulunmadı, tüm kayıtlar güncel.'
          );
        }
        if (data.totalNewSynced > 0) {
          addLog({
            panel: 'mam',
            action: 'Akıllı Delta Güncelleme',
            details: `${data.totalNewSynced} yeni klip çekildi (${(data.syncedCategories || []).map(c => `#${c.categoryId} ${c.categoryName}: +${c.newClipsAdded}`).join(', ')})`,
            count: data.totalNewSynced,
            status: 'success'
          });
        }
        await fetchCategories();
        const statusRes = await fetch('/api/archive/mam-status');
        if (statusRes.ok) {
          setMamStatus(await statusRes.json());
        }
        await fetchCategoryArchive(selectedCategoryId, statusFilter, activeArea);
      } else if (!silent) {
        showToast(data.error || 'Delta güncelleme hatası', 'error');
      }
    } catch (err) {
      if (!silent) showToast('Delta güncelleme sırasında bağlantı hatası', 'error');
    } finally {
      setIsSyncingDelta(false);
    }
  }, [addLog, fetchCategories, fetchCategoryArchive, selectedCategoryId, statusFilter, activeArea]);

  // TV MAM DB Bağlantısı ve Güncelleme Fark Kontrolü
  const fetchMamStatus = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsCheckingMamStatus(true);
      const res = await fetch('/api/archive/mam-status');
      if (res.ok) {
        const data = await res.json();
        setMamStatus(data);
        if (autoDeltaSync && data?.summary?.totalNewClips > 0) {
          handleSyncDelta(null, true);
        }
      }
    } catch (err) {
      console.error('TV MAM DB durumu alınamadı:', err);
    } finally {
      if (!silent) setIsCheckingMamStatus(false);
    }
  }, [autoDeltaSync, handleSyncDelta]);

  useEffect(() => {
    fetchCategories();
    fetchMamStatus(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aralıklı Akıllı Güncelleme Kontrolü
  useEffect(() => {
    if (!checkIntervalMin || checkIntervalMin <= 0) return undefined;
    const interval = setInterval(() => {
      fetchMamStatus(true);
    }, checkIntervalMin * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkIntervalMin, fetchMamStatus]);

  useEffect(() => {
    if (selectedCategoryId) {
      fetchCategoryArchive(selectedCategoryId, statusFilter, activeArea);
    }
  }, [selectedCategoryId, statusFilter, activeArea, fetchCategoryArchive]);

  // Program kullanım durumunu aç / kapat
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
            : `"${programTitle || 'Program'}" kullanımdan KAPATILDI.`
        );

        setArchiveData(prev => {
          if (!prev?.programs) return prev;
          return {
            ...prev,
            programs: prev.programs.map(p => p.id === programId ? { ...p, isActive: newStatus } : p)
          };
        });

        fetchCategories();
        fetchMamStatus(true);

        addLog({
          panel: 'mam',
          action: newStatus ? 'Program Kullanıma Açıldı' : 'Program Kullanımdan Kaldırıldı',
          details: `"${programTitle || 'Program'}" (ID: ${programId})`,
          status: 'success'
        });
      } else {
        const err = await res.json();
        showToast(err.error || 'İşlem başarısız', 'error');
      }
    } catch (err) {
      showToast('Bağlantı hatası', 'error');
    } finally {
      setTogglingProgramId(null);
    }
  };

  // Program başlığını düzenleme
  const handleSaveTitle = async (progId, newTitle) => {
    try {
      const res = await fetch(`/api/archive/program/${progId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
      if (res.ok) {
        const data = await res.json();
        const updatedProg = data.program;
        setArchiveData(prev => {
          if (!prev?.programs) return prev;
          return {
            ...prev,
            programs: prev.programs.map(p => p.id === progId ? { ...p, ...updatedProg, title: newTitle } : p)
          };
        });
        showToast('Program başlığı güncellendi.');
        addLog({
          panel: 'mam',
          action: 'Program Başlığı Güncellendi',
          details: `ID: ${progId} -> "${newTitle}"`,
          status: 'success'
        });
      } else {
        const err = await res.json();
        showToast(err.error || 'Güncelleme başarısız', 'error');
      }
    } catch (err) {
      showToast('Güncelleme sırasında hata oluştu', 'error');
    }
  };

  // Programın "Bizim Kategorimiz" (Planlama Kategorisi) bilgisini değiştirme
  const handleChangeProgramCategory = async (prog, nextCategoryId) => {
    if (!prog?.id || !nextCategoryId) return;
    const targetCatName = MSSQL_CATEGORIES[nextCategoryId]?.name || `Kategori #${nextCategoryId}`;
    const mamCatId = prog.mamCategoryId || prog.categoryId;
    const mamCatName = prog.mamCategoryName || MSSQL_CATEGORIES[mamCatId]?.name || `Kategori #${mamCatId}`;

    try {
      setChangingCatProgramId(prog.id);
      const res = await fetch(`/api/archive/program/${prog.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: nextCategoryId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Kategori güncellenemedi');
      }

      showToast(
        `"${prog.title}" programının Bizim Kategorisi "#${nextCategoryId} ${targetCatName}" olarak güncellendi (TV MAM DB Kategorisi: #${mamCatId} ${mamCatName} korundu).`
      );
      addLog({
        panel: 'mam',
        action: 'Bizim Kategori Değiştirildi',
        details: `"${prog.title}" -> Bizim Kategori: #${nextCategoryId} ${targetCatName} (TV MAM DB: #${mamCatId} ${mamCatName})`,
        status: 'success'
      });

      await fetchCategories();
      await fetchMamStatus(true);
      await fetchCategoryArchive(selectedCategoryId, statusFilter, activeArea);
    } catch (err) {
      showToast(err.message || 'Kategori değiştirilirken hata oluştu', 'error');
    } finally {
      setChangingCatProgramId(null);
    }
  };

  // Tekil Program Silme
  const handleDeleteProgram = async (prog) => {
    if (!prog?.id) return;
    const confirmMsg = `"${prog.title}" programını silmek istediğinize emin misiniz?\n\nPrograma bağlı ${prog.totalClips || 0} klip silinmeyecek, [${prog.categoryName || currentCatMeta.name} (Genel / Atanmamış)] listesine aktarılacaktır.`;
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

      showToast(`"${prog.title}" programı silindi (${data.affectedClipsCount || 0} klip Genel Arşiv'e aktarıldı).`);
      addLog({
        panel: 'mam',
        action: 'Program Silindi',
        details: `"${prog.title}" (ID: ${prog.id}) silindi, ${data.affectedClipsCount || 0} klip Genel Arşiv'e aktarıldı`,
        count: 1,
        status: 'warning'
      });

      fetchCategoryArchive(selectedCategoryId, statusFilter, activeArea);
      fetchCategories();
      fetchMamStatus(true);
    } catch (err) {
      showToast(err.message || 'Program silinirken hata oluştu', 'error');
    } finally {
      setDeletingProgramId(null);
    }
  };

  // Tek kategoriyi MSSQL'den yeniden tara
  const handleSyncCategory = async (targetCatId = selectedCategoryId) => {
    const catIdToSync = Number(targetCatId || selectedCategoryId);
    try {
      setIsSyncing(true);
      setSyncingCategoryId(catIdToSync);
      const res = await fetch('/api/archive/syncCategory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: catIdToSync })
      });
      if (res.ok) {
        const data = await res.json();
        await fetchCategories();
        await fetchMamStatus(true);
        if (catIdToSync === Number(selectedCategoryId)) {
          await fetchCategoryArchive(selectedCategoryId, statusFilter, activeArea);
        }
        showToast(`Kategori ${data.categoryName} senkronize edildi! (${data.totalClips} klip, ${data.programsCount} program)`);
        addLog({
          panel: 'mam',
          action: 'Kategori Senkronize Edildi',
          details: `${data.categoryName} (${data.totalClips} klip, ${data.programsCount} program)`,
          count: data.totalClips,
          status: 'success'
        });
      } else {
        const err = await res.json();
        showToast(err.error || 'Senkronizasyon hatası', 'error');
      }
    } catch (err) {
      showToast('Senkronizasyon işlemi başarısız oldu', 'error');
    } finally {
      setIsSyncing(false);
      setSyncingCategoryId(null);
    }
  };

  // Tüm 9 Yayın Kategorisini Senkronize Et
  const handleSyncAll = async () => {
    try {
      setIsSyncingAll(true);
      showToast('Tüm 9 yayın kategorisi (Ham ve Reklam hariç) taranıyor ve senkronize ediliyor...', 'success');
      const res = await fetch('/api/archive/syncAll', { method: 'POST' });
      if (res.ok) {
        await fetchCategories();
        await fetchMamStatus(true);
        await fetchCategoryArchive(selectedCategoryId, statusFilter, activeArea);
        showToast('9 yayın kategorisinin tamamı başarıyla senkronize edildi!');
        addLog({
          panel: 'mam',
          action: 'Tüm Kategoriler Senkronize Edildi',
          details: '9 Yayın Kategorisi Libero MSSQL üzerinden güncellendi',
          status: 'success'
        });
      } else {
        const err = await res.json();
        showToast(err.error || 'Toplu senkronizasyon hatası', 'error');
      }
    } catch (err) {
      showToast('Toplu senkronizasyon başarısız oldu', 'error');
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Arama ve sıralama filtresi
  const filteredAndSortedPrograms = useMemo(() => {
    if (!archiveData?.programs) return [];
    let list = archiveData.programs;
    const hasSearch = Boolean(searchTerm && searchTerm.trim());

    if (hasSearch) {
      const q = searchTerm.trim();
      const matched = [];
      for (const prog of list) {
        const rank = getItemSearchRank(prog, q, {
          primaryFields: [(p) => p.title, (p) => p.mamTitle],
          secondaryFields: [
            (p) => (p.clips || []).map(c => `${c.name || ''} ${c.note || ''}`).join(' ')
          ]
        });
        if (rank.matched) {
          matched.push({ prog, rank });
        }
      }
      matched.sort((a, b) => {
        if (a.rank.tier !== b.rank.tier) return a.rank.tier - b.rank.tier;
        if (a.rank.position !== b.rank.position) return a.rank.position - b.rank.position;
        if (sortBy === 'clips-desc') return (b.prog.totalClips || 0) - (a.prog.totalClips || 0);
        if (sortBy === 'episodes-desc') return (b.prog.totalEpisodes || 0) - (a.prog.totalEpisodes || 0);
        if (sortBy === 'duration-desc') return (b.prog.totalDurationSec || 0) - (a.prog.totalDurationSec || 0);
        if (sortBy === 'date-desc') return new Date(b.prog.lastDate || 0) - new Date(a.prog.lastDate || 0);
        return (a.prog.title || '').localeCompare(b.prog.title || '', 'tr-TR');
      });
      return matched.map(m => m.prog);
    }

    const sorted = [...list];
    if (sortBy === 'clips-desc') {
      sorted.sort((a, b) => (b.totalClips || 0) - (a.totalClips || 0));
    } else if (sortBy === 'episodes-desc') {
      sorted.sort((a, b) => (b.totalEpisodes || 0) - (a.totalEpisodes || 0));
    } else if (sortBy === 'duration-desc') {
      sorted.sort((a, b) => (b.totalDurationSec || 0) - (a.totalDurationSec || 0));
    } else if (sortBy === 'date-desc') {
      sorted.sort((a, b) => new Date(b.lastDate || 0) - new Date(a.lastDate || 0));
    } else if (sortBy === 'name-asc') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'tr-TR'));
    }

    return sorted;
  }, [archiveData, searchTerm, sortBy]);

  // Sayfalama (Pagination)
  const listTopRef = useRef(null);
  const scrollToTopOfPanel = () => {
    const adminScrollEl = document.getElementById('admin-panel-scroll-container');
    if (adminScrollEl) {
      adminScrollEl.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (listTopRef.current) {
      listTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageChange = (nextPage) => {
    setCurrentPage(nextPage);
    requestAnimationFrame(() => {
      scrollToTopOfPanel();
    });
  };

  const totalPages = Math.ceil(filteredAndSortedPrograms.length / pageSize) || 1;
  const paginatedPrograms = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedPrograms.slice(start, start + pageSize);
  }, [filteredAndSortedPrograms, currentPage, pageSize]);

  // Seçili kategori meta bilgileri ve istatistikleri
  const currentCatMeta = MSSQL_CATEGORIES[selectedCategoryId] || {
    name: `Kategori ${selectedCategoryId}`,
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.15)',
    border: 'rgba(59, 130, 246, 0.4)'
  };

  const currentCategoryObj = categories.find(c => c.categoryId === selectedCategoryId);
  const activeCountInCat = currentCategoryObj?.activeProgramsCount || 0;
  const totalProgramsInCat = currentCategoryObj?.programsCount || 0;
  const inactiveCountInCat = Math.max(0, totalProgramsInCat - activeCountInCat);

  const totalClipsAllCategories = useMemo(() => {
    return categories.reduce((sum, c) => sum + (c.syncedClipCount || c.mssqlClipCount || 0), 0);
  }, [categories]);

  const displayedProgramsCount = statusFilter === 'active'
    ? activeCountInCat
    : statusFilter === 'inactive'
      ? inactiveCountInCat
      : (activeArea === 'mam_db' ? (archiveData?.programsCount || 0) : totalProgramsInCat);

  const totalClipsInCat = currentCategoryObj?.syncedClipCount || currentCategoryObj?.mssqlClipCount || 0;
  const displayedClipsCount = (statusFilter === 'all' && activeArea === 'our_db')
    ? totalClipsInCat
    : (archiveData?.totalClips || 0);

  const totalDurationInCat = currentCategoryObj?.totalDurationSec || 0;
  const displayedDurationSec = (statusFilter === 'all' && activeArea === 'our_db')
    ? (totalDurationInCat || archiveData?.totalDurationSec || 0)
    : (archiveData?.totalDurationSec || archiveData?.programs?.reduce((acc, p) => acc + (p.totalDurationSec || 0), 0) || 0);

  const allExpanded = useMemo(() => {
    if (!paginatedPrograms || paginatedPrograms.length === 0) return false;
    return paginatedPrograms.every(p => !!expandedPrograms[p.id]);
  }, [paginatedPrograms, expandedPrograms]);

  const handleToggleExpandAll = () => {
    if (allExpanded) {
      setExpandedPrograms({});
    } else {
      const next = { ...expandedPrograms };
      paginatedPrograms.forEach(p => {
        next[p.id] = true;
      });
      setExpandedPrograms(next);
    }
  };

  const pendingUpdateCategoriesCount = mamStatus?.summary?.categoriesWithUpdates ?? mamStatus?.summary?.categoriesWithUpdatesCount ?? 0;
  const totalNewClipsCount = mamStatus?.summary?.totalNewClips ?? 0;
  const mamConnInfo = mamStatus?.mamConnection || mamStatus?.mssqlConnection || {};
  const isMamConnected = Boolean(mamConnInfo.connected);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
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

      {/* 1. Üst Başlık Çubuğu */}
      <ArchiveHeader
        isSyncingAll={isSyncingAll}
        isSyncing={isSyncing}
        onSyncAll={handleSyncAll}
        totalClipsCount={totalClipsAllCategories}
        onOpenClipSearch={() => setIsClipSearchModalOpen(true)}
        onOpenLogViewer={() => setIsLogViewerModalOpen(true)}
        onToggleExpandAll={handleToggleExpandAll}
        allExpanded={allExpanded}
      />

      {/* 2. İki Ana Alan Seçicisi: 1. TV MAM DB vs 2. Bizim DB */}
      <ArchiveAreaSwitcher
        activeArea={activeArea}
        onSelectArea={setActiveArea}
        isMamConnected={isMamConnected}
        mamConnInfo={mamConnInfo}
        pendingUpdateCategoriesCount={pendingUpdateCategoriesCount}
        totalNewClipsCount={totalNewClipsCount}
        totalClipsAllCategories={totalClipsAllCategories}
      />

      {/* 3. Alan 1 İçeriği: TV MAM DB Bağlantı ve Akıllı Delta Güncelleme Kontrolü */}
      {activeArea === 'mam_db' && (
        <MamDatabaseSyncPanel
          mamStatus={mamStatus}
          isCheckingStatus={isCheckingMamStatus}
          checkIntervalMin={checkIntervalMin}
          onChangeCheckInterval={setCheckIntervalMin}
          autoDeltaSync={autoDeltaSync}
          onToggleAutoDeltaSync={setAutoDeltaSync}
          onCheckNow={() => fetchMamStatus(false)}
          onSyncDelta={(catId) => handleSyncDelta(catId, false)}
          isSyncingDelta={isSyncingDelta}
          onSyncCategory={(catId) => handleSyncCategory(catId)}
          syncingCategoryId={syncingCategoryId}
          isSyncingAll={isSyncingAll}
          onSyncAll={handleSyncAll}
          selectedMamCategoryId={selectedCategoryId}
          onSelectMamCategory={(catId) => {
            setSelectedCategoryId(catId);
            setSearchTerm('');
          }}
        />
      )}

      {/* 4. Kategori Seçim Çubuğu (Bizim DB Kategorileri) */}
      <ArchiveCategoryPills
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={(catId) => {
          setSelectedCategoryId(catId);
          setSearchTerm('');
        }}
        onManageCategories={() => setIsCategoriesModalOpen(true)}
      />

      {/* 5. Seçili Kategori DB Bilgileri ve Metadata Şeması */}
      <ArchiveSelectedCategoryBanner
        activeArea={activeArea}
        selectedCategoryId={selectedCategoryId}
        currentCatMeta={currentCatMeta}
        currentCategoryObj={currentCategoryObj}
        archiveData={archiveData}
        onOpenCategoriesModal={() => setIsCategoriesModalOpen(true)}
      />

      {/* 6. Kategori Metrikleri */}
      <ArchiveMetrics
        activeProgramsCount={activeCountInCat}
        totalProgramsCount={displayedProgramsCount}
        totalClipsCount={displayedClipsCount}
        totalDurationSec={displayedDurationSec}
        catMeta={currentCatMeta}
        statusFilter={statusFilter}
      />

      {/* 7. Arama, Durum Filtresi ve Sıralama Çubuğu */}
      <ArchiveFilterBar
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        activeCount={activeCountInCat}
        totalCount={totalProgramsInCat}
        inactiveCount={inactiveCountInCat}
        searchTerm={searchTerm}
        onSearchChange={(val) => {
          setSearchTerm(val);
          setCurrentPage(1);
        }}
        sortBy={sortBy}
        onSortChange={(val) => {
          setSortBy(val);
          setCurrentPage(1);
        }}
        onSyncCategory={() => handleSyncCategory(selectedCategoryId)}
        isSyncing={isSyncing}
        isSyncingAll={isSyncingAll}
      />

      {/* 8. Program Kartları Listesi */}
      {isLoading ? (
        <div style={{
          textAlign: 'center',
          padding: '60px',
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)'
        }}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
          <div>Program ve klip arşivi yükleniyor...</div>
        </div>
      ) : filteredAndSortedPrograms.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px',
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)'
        }}>
          <AlertCircle size={36} color="var(--text-secondary)" style={{ marginBottom: '12px' }} />
          <div style={{ fontSize: '16px', fontWeight: '700' }}>
            {statusFilter === 'active'
              ? 'Bu kategoride aktif kullanılan program bulunmuyor.'
              : 'Program bulunamadı.'}
          </div>
          <p style={{ fontSize: '13px', marginTop: '6px', maxWidth: '440px', margin: '6px auto 16px' }}>
            {statusFilter === 'active'
              ? 'Filtreyi "Tüm Arşiv" olarak değiştirip dilediğiniz programı kullanıma açabilirsiniz.'
              : 'Sağ üstteki "Kategoriyi Tara" butonuyla MSSQL veritabanından tazeleyebilirsiniz.'}
          </p>
          {statusFilter !== 'all' && (
            <button
              onClick={() => setStatusFilter('all')}
              style={{
                background: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px'
              }}
            >
              Tüm Arşivi Göster
            </button>
          )}
        </div>
      ) : (
        <div ref={listTopRef} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {paginatedPrograms.map(prog => (
            <ArchiveProgramCard
              key={prog.id || prog.title}
              prog={prog}
              catMeta={currentCatMeta}
              availableCategories={categories}
              isExpanded={!!expandedPrograms[prog.id]}
              onToggleExpand={() => setExpandedPrograms(prev => ({ ...prev, [prog.id]: !prev[prog.id] }))}
              onToggleStatus={handleToggleStatus}
              isToggling={togglingProgramId === prog.id}
              onSaveTitle={handleSaveTitle}
              onChangeCategory={handleChangeProgramCategory}
              isChangingCategory={changingCatProgramId === prog.id}
              onDeleteProgram={handleDeleteProgram}
              isDeleting={deletingProgramId === prog.id}
              onClipsChange={() => {
                fetchCategoryArchive(selectedCategoryId, statusFilter, activeArea);
                fetchCategories();
                fetchMamStatus(true);
              }}
            />
          ))}

          {/* 9. Sayfalama Çubuğu */}
          <ArchivePaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItemsCount={filteredAndSortedPrograms.length}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Modallar */}
      <ArchiveClipSearchModal
        isOpen={isClipSearchModalOpen}
        onClose={() => setIsClipSearchModalOpen(false)}
        onClipsModified={() => {
          fetchCategoryArchive(selectedCategoryId, statusFilter, activeArea);
          fetchCategories();
          fetchMamStatus(true);
        }}
      />

      <AdminLogViewerModal
        isOpen={isLogViewerModalOpen}
        onClose={() => setIsLogViewerModalOpen(false)}
      />

      <OurCategoriesManagerModal
        isOpen={isCategoriesModalOpen}
        onClose={() => setIsCategoriesModalOpen(false)}
        onCategoriesUpdated={() => {
          fetchCategories();
          fetchMamStatus(true);
          fetchCategoryArchive(selectedCategoryId, statusFilter, activeArea);
        }}
      />
    </div>
  );
};

export default ArchiveAnalysisTab;
