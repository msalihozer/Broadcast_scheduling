/**
 * @file src/pages/admin/archive/ArchiveClipsTable.jsx
 * @description Bir programın (veya kategorinin) video kliplerini listeleyen,
 * gelişmiş çoklu seçim (Shift+Click aralık seçimi, Ctrl+A kısayolu, Tersine Çevir),
 * filtreleme, sıralama ve toplu işlemler sunan tablo bileşeni.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { 
  FolderInput, MinusCircle, Trash2, Plus, Edit2, 
  ArrowUpDown, Search, CheckSquare, Square, RefreshCw,
  Clock, Calendar, AlertCircle, Info
} from 'lucide-react';
import { formatTimecode } from '../../../utils/formatTimecode';
import { MSSQL_CATEGORIES } from '../../../utils/categoryColors';
import { filterAndSortBySearchPriority } from '../../../utils/searchRanker';
import { useMultiSelect } from '../../../hooks/useMultiSelect';
import { useAdminLogStore } from '../../../store/adminLogStore';
import MoveClipsModal from './MoveClipsModal';
import AddClipsModal from './AddClipsModal';
import EditClipModal from './EditClipModal';
import ClipDetailMetadataModal from './ClipDetailMetadataModal';

const ArchiveClipsTable = ({ 
  clips = [], 
  catMeta = { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  program = null, // { id, title, categoryId, categoryName }
  onClipsChange = null // callback when clips are moved/added/detached/deleted
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [sortBy, setSortBy] = useState('episode-asc');

  // Modallar
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingClip, setEditingClip] = useState(null);
  const [viewingClip, setViewingClip] = useState(null);

  // Aksiyon yükleniyor durumları
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  const addLog = useAdminLogStore(state => state.addLog);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  // 1. Filtreleme (Bölüm, Not, Klip Adı, ID ve DB Metadata alanları - Öncelikli Arama)
  const filteredClips = useMemo(() => {
    if (!filterQuery.trim()) return clips;
    return filterAndSortBySearchPriority(clips, filterQuery.trim(), {
      primaryFields: [
        (c) => c.name || c.fileName,
        (c) => c.episodeNo != null ? String(c.episodeNo) : ''
      ],
      secondaryFields: [
        (c) => c.note,
        (c) => c.fileId != null ? String(c.fileId) : '',
        (c) => {
          const meta = c.metadataSummary || (!Array.isArray(c.metadata) ? c.metadata : null) || {};
          const rawMetaText = Array.isArray(c.metadata)
            ? c.metadata.map(m => `${m.keyName || ''} ${m.val || ''}`).join(' ')
            : '';
          return [
            meta.bolumAdi,
            meta.konu,
            meta.sunucu,
            meta.konuk,
            meta.yonetmen,
            meta.yapimci,
            meta.kurgucu,
            meta.yayinTarihi,
            rawMetaText
          ].filter(Boolean).join(' ');
        }
      ]
    });
  }, [clips, filterQuery]);

  // 2. Sıralama
  const sortedClips = useMemo(() => {
    if (filterQuery.trim()) {
      return [...filteredClips];
    }
    const list = [...filteredClips];
    list.sort((a, b) => {
      if (sortBy === 'episode-asc') {
        const epA = a.episodeNo != null ? a.episodeNo : 999999;
        const epB = b.episodeNo != null ? b.episodeNo : 999999;
        if (epA !== epB) return epA - epB;
        const ptA = a.partNo != null ? a.partNo : 0;
        const ptB = b.partNo != null ? b.partNo : 0;
        return ptA - ptB;
      }
      if (sortBy === 'episode-desc') {
        const epA = a.episodeNo != null ? a.episodeNo : -1;
        const epB = b.episodeNo != null ? b.episodeNo : -1;
        if (epA !== epB) return epB - epA;
        const ptA = a.partNo != null ? a.partNo : 0;
        const ptB = b.partNo != null ? b.partNo : 0;
        return ptB - ptA;
      }
      if (sortBy === 'date-desc') {
        const dA = a.fileCreateTime ? new Date(a.fileCreateTime).getTime() : 0;
        const dB = b.fileCreateTime ? new Date(b.fileCreateTime).getTime() : 0;
        return dB - dA;
      }
      if (sortBy === 'date-asc') {
        const dA = a.fileCreateTime ? new Date(a.fileCreateTime).getTime() : 0;
        const dB = b.fileCreateTime ? new Date(b.fileCreateTime).getTime() : 0;
        return dA - dB;
      }
      if (sortBy === 'duration-desc') {
        return (b.durationSec || 0) - (a.durationSec || 0);
      }
      if (sortBy === 'duration-asc') {
        return (a.durationSec || 0) - (b.durationSec || 0);
      }
      if (sortBy === 'name-asc') {
        return (a.name || '').localeCompare(b.name || '', 'tr-TR');
      }
      if (sortBy === 'name-desc') {
        return (b.name || '').localeCompare(a.name || '', 'tr-TR');
      }
      return 0;
    });
    return list;
  }, [filteredClips, sortBy]);

  // Evrensel çoklu seçim hook'u
  const {
    selectedIds,
    selectedItems: selectedClipsList,
    selectedCount,
    isSelected,
    handleItemSelect,
    selectAll,
    deselectAll,
    invertSelection,
    isAllSelected
  } = useMultiSelect(sortedClips, (c) => c.fileId);

  // Klavye kısayolları (Ctrl+A ve Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAll();
      } else if (e.key === 'Escape' && selectedCount > 0) {
        e.preventDefault();
        deselectAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectAll, deselectAll, selectedCount]);

  const totalSelectedSeconds = useMemo(() => {
    return selectedClipsList.reduce((acc, c) => acc + (c.durationSec || 0), 0);
  }, [selectedClipsList]);

  // Toplu Programdan Çıkar (Genel Arşiv'e aktar)
  const handleDetachClips = async (clipsToDetach = selectedClipsList) => {
    if (!clipsToDetach || clipsToDetach.length === 0) return;
    const count = clipsToDetach.length;
    const confirmMsg = `${count} adet klibi bu programdan çıkarmak istediğinize emin misiniz?\n\nKlipler silinmeyecek, [${program?.categoryName || 'Kategori'} (Genel / Atanmamış)] listesine aktarılacaktır.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsActionInProgress(true);
      const res = await fetch('/api/archive/clips/detach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: clipsToDetach.map(c => c.fileId),
          targetCategoryId: program?.categoryId
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Klipler çıkarılırken bir hata oluştu.');
      }

      addLog({
        panel: 'mam',
        action: 'Klipleri Programdan Çıkarma',
        details: `"${program?.title || 'Program'}" içerisinden ${count} klip çıkarıldı ve Genel Arşiv'e aktarıldı.`,
        count,
        status: 'success'
      });

      deselectAll();
      if (onClipsChange) onClipsChange();
    } catch (err) {
      console.error('Klip çıkarma hatası:', err);
      alert('Hata: ' + err.message);
    } finally {
      setIsActionInProgress(false);
    }
  };

  // Toplu Silme
  const handleDeleteClips = async (clipsToDelete = selectedClipsList) => {
    if (!clipsToDelete || clipsToDelete.length === 0) return;
    const count = clipsToDelete.length;
    const confirmMsg = `⚠️ DİKKAT: ${count} adet klibi arşivden KALICI OLARAK silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsActionInProgress(true);
      const res = await fetch('/api/archive/clips/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: clipsToDelete.map(c => c.fileId)
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Klipler silinirken hata oluştu.');
      }

      addLog({
        panel: 'mam',
        action: 'Klipleri Kalıcı Silme',
        details: `"${program?.title || 'Program'}" içerisinden ${count} klip arşivden kalıcı olarak silindi.`,
        count,
        status: 'warning'
      });

      deselectAll();
      if (onClipsChange) onClipsChange();
    } catch (err) {
      console.error('Klip silme hatası:', err);
      alert('Hata: ' + err.message);
    } finally {
      setIsActionInProgress(false);
    }
  };

  return (
    <div style={{ padding: '0 22px 20px' }}>
      {/* Üst Araç Çubuğu: Arama, Sıralama, Hızlı Seçim ve "+ Klip Ekle" Butonu */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginTop: '14px',
        marginBottom: '10px',
        flexWrap: 'wrap'
      }}>
        {/* Sol: Hızlı Klip Arama ve Sıralama */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 320px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-primary)',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            flex: '1 1 180px'
          }}>
            <Search size={14} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="Bölüm, not, klip adı veya ID filtrele..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '12px',
                width: '100%'
              }}
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0' }}
              >
                ×
              </button>
            )}
          </div>

          {/* Sıralama Seçenekleri */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--bg-primary)',
            padding: '6px 10px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <ArrowUpDown size={13} color="var(--text-secondary)" />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Sırala:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <option value="episode-asc">Bölüm No (Artan: 1→99)</option>
              <option value="episode-desc">Bölüm No (Azalan: 99→1)</option>
              <option value="date-desc">Kayıt Tarihi (En Yeni)</option>
              <option value="date-asc">Kayıt Tarihi (En Eski)</option>
              <option value="duration-desc">Süre (En Uzun)</option>
              <option value="duration-asc">Süre (En Kısa)</option>
              <option value="name-asc">Klip Adı (A→Z)</option>
              <option value="name-desc">Klip Adı (Z→A)</option>
            </select>
          </div>

          {/* Hızlı Seçim Butonları */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={selectAll}
              disabled={sortedClips.length === 0}
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '5px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
              title="Tüm Klipleri Seç (Ctrl+A)"
            >
              Tümünü Seç
            </button>
            <button
              onClick={deselectAll}
              disabled={selectedCount === 0}
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '5px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                opacity: selectedCount === 0 ? 0.4 : 1
              }}
              title="Seçimi Kaldır (Esc)"
            >
              Temizle
            </button>
            <button
              onClick={invertSelection}
              disabled={sortedClips.length === 0}
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '5px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
              title="Seçimi Tersine Çevir"
            >
              Tersine
            </button>
          </div>
        </div>

        {/* Sağ: "+ Bu Programa Klip Ekle" Butonu */}
        {program && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              border: 'none',
              background: '#10b981',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '700',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.15s'
            }}
          >
            <Plus size={15} />
            <span>+ Bu Programa Klip Ekle</span>
          </button>
        )}
      </div>

      {/* Çoklu Seçim Aksiyon Çubuğu (Seçili klip olduğunda açılır) */}
      {selectedClipsList.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: 'rgba(59, 130, 246, 0.12)',
          border: '1px solid rgba(59, 130, 246, 0.35)',
          borderRadius: '10px',
          padding: '10px 16px',
          marginBottom: '10px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>
              ✓ <strong style={{ color: 'var(--accent-primary)' }}>{selectedClipsList.length}</strong> klip seçildi
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '400', marginLeft: '6px' }}>
                (Shift+Click ile aralık seçebilirsiniz)
              </span>
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} /> Toplam: <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>{formatTimecode(totalSelectedSeconds)}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Başka Programa Taşı */}
            <button
              onClick={() => setIsMoveModalOpen(true)}
              disabled={isActionInProgress}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#3b82f6',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '700'
              }}
              title="Seçilen klipleri başka bir programa aktar"
            >
              <FolderInput size={13} />
              <span>Başka Programa Taşı</span>
            </button>

            {/* Programdan Çıkar */}
            <button
              onClick={() => handleDetachClips()}
              disabled={isActionInProgress}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '700'
              }}
              title="Klipleri bu programdan çıkarıp Genel Arşiv'e aktar"
            >
              <MinusCircle size={13} />
              <span>Programdan Çıkar</span>
            </button>

            {/* Sil */}
            <button
              onClick={() => handleDeleteClips()}
              disabled={isActionInProgress}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '700'
              }}
              title="Klipleri kalıcı olarak arşivden sil"
            >
              <Trash2 size={13} />
              <span>Sil</span>
            </button>

            {/* Seçimi Temizle */}
            <button
              onClick={deselectAll}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600'
              }}
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {/* Tablo */}
      <div style={{
        overflowX: 'auto',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-primary)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '10px 12px', width: '36px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={isAllSelected ? deselectAll : selectAll}
                  style={{ cursor: 'pointer' }}
                  title={isAllSelected ? 'Tüm seçimleri kaldır (Esc)' : 'Tümünü seç (Ctrl+A)'}
                />
              </th>
              <th style={{ padding: '10px 12px', fontWeight: '700', width: '135px' }}>Bölüm / Cüz / Gün</th>
              <th style={{ padding: '10px 12px', fontWeight: '700' }}>Konu / Metadata Bilgileri</th>
              <th style={{ padding: '10px 12px', fontWeight: '700' }}>MAM Klip Adı</th>
              <th style={{ padding: '10px 12px', fontWeight: '700', width: '90px' }}>MAM ID</th>
              <th style={{ padding: '10px 12px', fontWeight: '700', width: '110px' }}>Süre</th>
              <th style={{ padding: '10px 12px', fontWeight: '700', width: '120px' }}>Kayıt Tarihi</th>
              <th style={{ padding: '10px 12px', fontWeight: '700', width: '280px', textAlign: 'center' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {sortedClips.length > 0 ? (
              sortedClips.map((clip, index) => {
                const selected = isSelected(clip.fileId);
                return (
                  <tr
                    key={clip.fileId}
                    onClick={(e) => {
                      if (e.target.closest('button, input, a')) return;
                      handleItemSelect(clip, index, e);
                    }}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: selected ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      userSelect: 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (!selected) e.currentTarget.style.background = 'var(--bg-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      if (!selected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {/* Checkbox */}
                    <td 
                      style={{ padding: '10px 12px', textAlign: 'center', userSelect: 'none' }} 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleItemSelect(clip, index, e);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleItemSelect(clip, index, e);
                        }}
                        onChange={() => {}}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </td>

                    {/* Bölüm / Cüz / Gün & Parça */}
                    <td style={{ padding: '10px 12px', fontWeight: '600' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {(() => {
                          const uType = clip.unitType || program?.unitType || 'bolum';
                          const uLabel = clip.unitLabel || (
                            clip.episodeNo
                              ? (uType === 'cuz' ? `${clip.episodeNo}. Cüz` : uType === 'gun' ? `${clip.episodeNo}. Gün` : `Bölüm ${clip.episodeNo}`)
                              : 'Genel'
                          );
                          const badgeBg = uType === 'cuz'
                            ? 'rgba(16, 185, 129, 0.16)'
                            : uType === 'gun'
                              ? 'rgba(168, 85, 247, 0.16)'
                              : catMeta.bg;
                          const badgeColor = uType === 'cuz'
                            ? '#10b981'
                            : uType === 'gun'
                              ? '#a855f7'
                              : catMeta.color;
                          return (
                            <span style={{
                              background: badgeBg,
                              color: badgeColor,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700'
                            }}>
                              {uLabel}
                            </span>
                          );
                        })()}
                        {clip.partNo && (
                          <span style={{
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '700'
                          }}>
                            P{clip.partNo}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Konu / Metadata Bilgileri */}
                    <td style={{ padding: '10px 12px' }}>
                      {(() => {
                        const meta = clip.metadataSummary || (!Array.isArray(clip.metadata) ? clip.metadata : null) || {};
                        const hasMetaSummary = Object.keys(meta).length > 0;
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {clip.note && (
                              <div>
                                <span style={{
                                  background: 'rgba(245, 158, 11, 0.12)',
                                  color: '#f59e0b',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  display: 'inline-block'
                                }}>
                                  {clip.note}
                                </span>
                              </div>
                            )}
                            {hasMetaSummary && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                                {meta.bolumAdi && meta.bolumAdi !== clip.note && (
                                  <span style={{
                                    background: 'rgba(59, 130, 246, 0.1)',
                                    color: '#3b82f6',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: '600'
                                  }} title="Bölüm Adı (Metadata #23)">
                                    📌 {meta.bolumAdi}
                                  </span>
                                )}
                                {meta.sunucu && (
                                  <span style={{
                                    background: 'rgba(16, 185, 129, 0.12)',
                                    color: '#10b981',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: '600'
                                  }} title="Sunucu (Metadata #14)">
                                    🎙️ Sunucu: {meta.sunucu}
                                  </span>
                                )}
                                {meta.konuk && (
                                  <span style={{
                                    background: 'rgba(168, 85, 247, 0.12)',
                                    color: '#a855f7',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: '600'
                                  }} title="Konuk (Metadata #15)">
                                    👤 Konuk: {meta.konuk}
                                  </span>
                                )}
                                {meta.yonetmen && (
                                  <span style={{
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-secondary)',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: '600'
                                  }} title="Yönetmen (Metadata #9)">
                                    🎬 Yön: {meta.yonetmen}
                                  </span>
                                )}
                                {meta.yapimci && (
                                  <span style={{
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-secondary)',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: '600'
                                  }} title="Yapımcı (Metadata #25)">
                                    🏢 Yapım: {meta.yapimci}
                                  </span>
                                )}
                                {meta.kurgucu && (
                                  <span style={{
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-secondary)',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: '600'
                                  }} title="Kurgucu (Metadata #8)">
                                    ✂️ Kurgu: {meta.kurgucu}
                                  </span>
                                )}
                                {meta.yayinTarihi && (
                                  <span style={{
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-secondary)',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: '600'
                                  }} title="Yayın Tarihi (Metadata #24)">
                                    📅 {meta.yayinTarihi}
                                  </span>
                                )}
                              </div>
                            )}
                            {!clip.note && !hasMetaSummary && (
                              <span style={{ color: 'var(--text-muted)' }}>-</span>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* MAM Klip Adı */}
                    <td style={{ padding: '10px 12px', fontWeight: '500' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingClip(clip);
                          }}
                          style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            color: '#3b82f6',
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                            padding: 0
                          }}
                          title="Klip Detayları, Metadataları ve Video İzleme (ⓘ)"
                        >
                          <Info size={14} />
                        </button>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: 'var(--text-primary)', fontWeight: '700', wordBreak: 'break-word' }}>
                            {clip.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '3px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              {clip.fileName}
                            </span>
                            {(() => {
                              const mamCatId = clip.mamCategoryId || clip.categoryId || program?.mamCategoryId || program?.categoryId;
                              const ourCatId = clip.categoryId || program?.categoryId || mamCatId;
                              const mamCatName = clip.mamCategoryName || MSSQL_CATEGORIES[mamCatId]?.name || `Kat #${mamCatId}`;
                              const ourCatName = clip.categoryName || MSSQL_CATEGORIES[ourCatId]?.name || `Kat #${ourCatId}`;
                              const ourMeta = MSSQL_CATEGORIES[ourCatId] || catMeta;
                              const isDifferent = mamCatId && ourCatId && Number(mamCatId) !== Number(ourCatId);
                              return (
                                <>
                                  {mamCatId && (
                                    <span
                                      style={{
                                        fontSize: '9.5px',
                                        fontWeight: '700',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        background: 'var(--bg-tertiary)',
                                        color: 'var(--text-secondary)',
                                        border: '1px solid var(--border-color)'
                                      }}
                                      title="TV MAM Veritabanından Çekilen Orijinal Kategori"
                                    >
                                      🗄️ MAM DB: #{mamCatId} {mamCatName}
                                    </span>
                                  )}
                                  {ourCatId && (
                                    <span
                                      style={{
                                        fontSize: '9.5px',
                                        fontWeight: '800',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        background: ourMeta.bg || 'rgba(59, 130, 246, 0.14)',
                                        color: ourMeta.color || '#3b82f6',
                                        border: `1px solid ${isDifferent ? (ourMeta.color || '#3b82f6') : (ourMeta.border || 'rgba(59,130,246,0.3)')}`
                                      }}
                                      title="Bizim Planlama Sisteminde Kullandığımız Kategori"
                                    >
                                      🏷️ Bizim: #{ourCatId} {ourCatName}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* MAM ID */}
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      #{clip.fileId}
                    </td>

                    {/* Süre */}
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: '700', color: '#10b981' }}>
                      {clip.durationFormatted || '00.00.00.00'}
                    </td>

                    {/* Kayıt Tarihi */}
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                      {formatDate(clip.fileCreateTime)}
                    </td>

                    {/* İşlemler */}
                    <td style={{ padding: '10px 12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setViewingClip(clip)}
                          style={{
                            background: 'rgba(59, 130, 246, 0.14)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            color: '#3b82f6',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '10.5px',
                            fontWeight: '800'
                          }}
                          title="Klip Detayları, Veritabanı Metadataları ve Canlı Video İzleme"
                        >
                          <Info size={12} />
                          <span>Detay & İzle</span>
                        </button>
                        <button
                          onClick={() => setEditingClip(clip)}
                          style={{
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            padding: '4px 7px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '10.5px',
                            fontWeight: '600'
                          }}
                          title="Klip Bilgilerini Düzenle"
                        >
                          <Edit2 size={12} />
                          <span>Düzenle</span>
                        </button>
                        <button
                          onClick={() => handleDetachClips([clip])}
                          style={{
                            background: 'rgba(245, 158, 11, 0.12)',
                            border: '1px solid rgba(245, 158, 11, 0.35)',
                            color: '#f59e0b',
                            cursor: 'pointer',
                            padding: '4px 7px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '10.5px',
                            fontWeight: '700'
                          }}
                          title="Programdan Çıkar (Genel Arşiv'e aktar)"
                        >
                          <MinusCircle size={12} />
                          <span>Çıkar</span>
                        </button>
                        <button
                          onClick={() => handleDeleteClips([clip])}
                          style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '4px 7px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '10.5px',
                            fontWeight: '700'
                          }}
                          title="Klibi Arşivden Kalıcı Olarak Sil"
                        >
                          <Trash2 size={12} />
                          <span>Sil</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {filterQuery ? 'Filtreye uygun klip bulunamadı.' : 'Bu program altında henüz klip bulunmuyor.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Seçili Klipleri Taşı Modalı */}
      {isMoveModalOpen && (
        <MoveClipsModal
          isOpen={isMoveModalOpen}
          onClose={() => setIsMoveModalOpen(false)}
          selectedClips={selectedClipsList}
          currentProgram={program}
          currentCategory={{ id: program?.categoryId, name: program?.categoryName }}
          onSuccess={() => {
            setIsMoveModalOpen(false);
            addLog({
              panel: 'mam',
              action: 'Klipleri Başka Programa Taşıma',
              details: `"${program?.title || 'Program'}" içerisinden ${selectedClipsList.length} klip başka programa taşındı.`,
              count: selectedClipsList.length,
              status: 'success'
            });
            deselectAll();
            if (onClipsChange) onClipsChange();
          }}
        />
      )}

      {/* Programa Yeni Klip Ekle Modalı */}
      {isAddModalOpen && (
        <AddClipsModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          targetProgram={program}
          program={program}
          onSuccess={() => {
            setIsAddModalOpen(false);
            addLog({
              panel: 'mam',
              action: 'Programa Yeni Klip Ekleme',
              details: `"${program?.title || 'Program'}" içerisine arşivden yeni klipler eklendi.`,
              status: 'success'
            });
            if (onClipsChange) onClipsChange();
          }}
        />
      )}

      {/* Tekil Klip Düzenleme Modalı */}
      {editingClip && (
        <EditClipModal
          isOpen={!!editingClip}
          onClose={() => setEditingClip(null)}
          clip={editingClip}
          onSuccess={() => {
            setEditingClip(null);
            addLog({
              panel: 'mam',
              action: 'Klip Bilgileri Güncelleme',
              details: `"${editingClip?.name}" isimli klibin bölüm/part/not bilgileri güncellendi.`,
              status: 'success'
            });
            if (onClipsChange) onClipsChange();
          }}
        />
      )}

      {/* Klip Detay, Veritabanı Metadataları ve Video İzleme Modalı */}
      {viewingClip && (
        <ClipDetailMetadataModal
          isOpen={!!viewingClip}
          onClose={() => setViewingClip(null)}
          clip={viewingClip}
          program={program}
        />
      )}
    </div>
  );
};

export default ArchiveClipsTable;
