/**
 * @file src/pages/admin/archive/ArchiveClipSearchModal.jsx
 * @description MAM Arşivinde tüm video klipleri arasında anlık arama,
 * çoklu seçim, Shift+Click aralık seçimi ve toplu işlem (taşıma, çıkarma) modalı.
 */
import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Search, Film, Loader2, CheckSquare, Square, 
  Clock, ArrowRightLeft, Trash2, Filter, AlertCircle, Info 
} from 'lucide-react';
import { useMultiSelect } from '../../../hooks/useMultiSelect';
import { useAdminLogStore } from '../../../store/adminLogStore';
import { MSSQL_CATEGORIES, BROADCAST_CATEGORIES } from '../../../utils/categoryColors';
import MoveClipsModal from './MoveClipsModal';
import ClipDetailMetadataModal from './ClipDetailMetadataModal';

export default function ArchiveClipSearchModal({ isOpen, onClose, onClipsModified }) {
  if (!isOpen) return null;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [clips, setClips] = useState([]);
  const [visibleLimit, setVisibleLimit] = useState(150);
  const [isLoading, setIsLoading] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [viewingClip, setViewingClip] = useState(null);
  const searchTimeoutRef = useRef(null);

  const addLog = useAdminLogStore(state => state.addLog);

  // Evrensel çoklu seçim hook'u
  const {
    selectedIds,
    selectedItems,
    selectedCount,
    isSelected,
    handleItemSelect,
    selectAll,
    deselectAll,
    invertSelection,
    isAllSelected,
    setSelectedIds
  } = useMultiSelect(clips, (c) => c.fileId);

  // Canlı arama
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setVisibleLimit(150);

    setIsLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        let url = `/api/archive/clips/search?q=${encodeURIComponent(searchTerm.trim())}&limit=all`;
        if (selectedCategory !== 'all') {
          url += `&categoryId=${selectedCategory}`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setClips(data.clips || []);
        } else {
          setClips([]);
        }
      } catch (err) {
        console.error('Klip arama hatası:', err);
      } finally {
        setIsLoading(false);
      }
    }, 120);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchTerm, selectedCategory]);

  // Klavye kısayolları (Ctrl+A, Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAll();
      } else if (e.key === 'Escape') {
        if (selectedCount > 0) {
          e.preventDefault();
          deselectAll();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectAll, deselectAll, selectedCount, onClose]);

  // Toplu Genel Arşive Çıkar
  const handleBulkDetach = async () => {
    if (selectedCount === 0) return;
    const confirmMsg = `Seçilen ${selectedCount} klibi programından çıkarıp Genel Arşiv'e aktarmak istediğinize emin misiniz?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const fileIds = Array.from(selectedIds);
      const res = await fetch('/api/archive/clips/detach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds })
      });
      if (res.ok) {
        addLog({
          panel: 'mam',
          action: 'Toplu Programdan Çıkarma',
          details: `${selectedCount} klip programından çıkarılıp Genel Arşiv'e aktarıldı.`,
          count: selectedCount,
          status: 'success'
        });
        deselectAll();
        onClipsModified && onClipsModified();
        // Arama sonuçlarını yenile
        setClips(prev => prev.filter(c => !selectedIds.has(c.fileId)));
      }
    } catch (err) {
      console.error('Klip çıkarma hatası:', err);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '920px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(13, 148, 136, 0.15)',
              color: '#0d9488',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Film size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
                MAM Klip Arama ve Toplu Yönetim
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                Tüm arşiv klipleri arasında anlık arama yapın, Shift+Click ile aralık seçin veya topluca işlem uygulayın.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          {/* Arama Input */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '6px 12px',
            flex: 1,
            minWidth: '240px'
          }}>
            <Search size={15} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="Klip adı, dosya adı, MAM ID veya not ara..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '13px',
                width: '100%'
              }}
              autoFocus
            />
            {isLoading && <Loader2 size={14} className="animate-spin" color="var(--accent-primary)" />}
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Kategori Filtresi */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--bg-secondary)',
            padding: '6px 12px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)'
          }}>
            <Filter size={13} color="var(--text-secondary)" />
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <option value="all">Tüm Kategoriler</option>
              {Object.entries(BROADCAST_CATEGORIES).map(([catId, meta]) => (
                <option key={catId} value={catId}>#{catId} {meta.name}</option>
              ))}
            </select>
          </div>

          {/* Hızlı Seçim Araçları */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={selectAll}
              disabled={clips.length === 0}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              title="Tümünü Seç (Ctrl+A)"
            >
              Tümünü Seç
            </button>
            <button
              onClick={deselectAll}
              disabled={selectedCount === 0}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                opacity: selectedCount === 0 ? 0.4 : 1
              }}
              title="Seçimi Temizle (Esc)"
            >
              Temizle
            </button>
            <button
              onClick={invertSelection}
              disabled={clips.length === 0}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              title="Seçimi Tersine Çevir"
            >
              Tersine Çevir
            </button>
          </div>
        </div>

        {/* Çoklu Seçim Eylem Çubuğu (Varsa) */}
        {selectedCount > 0 && (
          <div style={{
            padding: '8px 20px',
            background: 'rgba(59, 130, 246, 0.1)',
            borderBottom: '1px solid rgba(59, 130, 246, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px'
          }}>
            <span style={{ fontWeight: '700', color: 'var(--accent-primary)' }}>
              {selectedCount} klip seçildi (Shift+Click ile aralık seçebilirsiniz)
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setIsMoveModalOpen(true)}
                style={{
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ArrowRightLeft size={12} />
                <span>Başka Programa Taşı</span>
              </button>

              <button
                onClick={handleBulkDetach}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Genel Arşiv'e Çıkar
              </button>
            </div>
          </div>
        )}

        {/* Klipler Listesi Tablosu */}
        <div
          style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 250 && visibleLimit < clips.length) {
              setVisibleLimit(prev => prev + 250);
            }
          }}
        >
          {clips.length === 0 ? (
            <div style={{
              padding: '60px 20px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Film size={36} color="var(--border-color)" />
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {isLoading ? 'Klipler aranıyor...' : 'Eşleşen klip bulunamadı'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Farklı bir anahtar kelime yazabilir veya kategori filtresini değiştirebilirsiniz.
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '8px 12px', width: '36px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={isAllSelected ? deselectAll : selectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: '8px 12px', fontWeight: '700' }}>Klip Adı ({clips.length} Klip)</th>
                  <th style={{ padding: '8px 12px', fontWeight: '700' }}>Bağlı Program</th>
                  <th style={{ padding: '8px 12px', fontWeight: '700', width: '110px' }}>Kategori</th>
                  <th style={{ padding: '8px 12px', fontWeight: '700', width: '90px' }}>Bölüm/Part</th>
                  <th style={{ padding: '8px 12px', fontWeight: '700', width: '110px', textAlign: 'right' }}>Süre</th>
                  <th style={{ padding: '8px 12px', fontWeight: '700', width: '90px', textAlign: 'center' }}>Detay</th>
                </tr>
              </thead>
              <tbody>
                {clips.slice(0, visibleLimit).map((clip, index) => {
                  const selected = isSelected(clip.fileId);
                  const catMeta = MSSQL_CATEGORIES[clip.categoryId] || { name: 'Genel', color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' };

                  return (
                    <tr
                      key={clip.fileId}
                      onClick={(e) => {
                        if (e.target.closest('button, input, a')) return;
                        handleItemSelect(clip, index, e);
                      }}
                      style={{
                        borderBottom: '1px solid var(--border-light)',
                        background: selected ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                        userSelect: 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!selected) e.currentTarget.style.background = 'var(--bg-tertiary)';
                      }}
                      onMouseLeave={(e) => {
                        if (!selected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <td 
                        style={{ padding: '8px 12px', textAlign: 'center', userSelect: 'none' }} 
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

                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{clip.name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ID: {clip.fileId} • {clip.fileName}</div>
                      </td>

                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                        {clip.programTitle || 'Genel Arşiv'}
                      </td>

                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          background: catMeta.bg,
                          color: catMeta.color,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: '700'
                        }}>
                          {catMeta.name}
                        </span>
                      </td>

                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                        {clip.episodeNo ? `Bl.${clip.episodeNo}` : '-'} {clip.partNo ? `P${clip.partNo}` : ''}
                      </td>

                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: '#10b981' }}>
                        {clip.durationFormatted || '00.00.00.00'}
                      </td>

                      <td style={{ padding: '8px 12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setViewingClip(clip)}
                          style={{
                            background: 'rgba(59, 130, 246, 0.14)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            color: '#3b82f6',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '10.5px',
                            fontWeight: '800'
                          }}
                          title="Klip Detayları, Metadataları ve Video İzleme"
                        >
                          <Info size={12} />
                          <span>Detay</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: 'var(--text-secondary)'
        }}>
          <span>Shift tuşuna basılı tutarak iki satıra tıklayıp aralık seçebilirsiniz.</span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Kapat
          </button>
        </div>
      </div>

      {/* Seçili Klipleri Taşıma Modalı */}
      {isMoveModalOpen && (
        <MoveClipsModal
          isOpen={isMoveModalOpen}
          onClose={() => setIsMoveModalOpen(false)}
          selectedClips={selectedItems}
          currentProgram={null}
          currentCategory={MSSQL_CATEGORIES[selectedCategory] || { id: 1, name: 'Genel' }}
          onSuccess={() => {
            setIsMoveModalOpen(false);
            deselectAll();
            onClipsModified && onClipsModified();
          }}
        />
      )}

      {/* Klip Detay, Metadata ve Video İzleme Modalı */}
      {viewingClip && (
        <ClipDetailMetadataModal
          isOpen={!!viewingClip}
          onClose={() => setViewingClip(null)}
          clip={viewingClip}
        />
      )}
    </div>
  );
}
