/**
 * @file src/pages/admin/archive/AddClipsModal.jsx
 * @description Seçili bir arşiv programına, MAM arşivindeki diğer klipleri arayarak ve çoklu seçerek
 * dahil etme (/api/archive/clips/reassign) modalı.
 */
import React, { useState, useEffect } from 'react';
import { 
  X, Search, Plus, Check, AlertCircle, RefreshCw, Filter, Clock, Calendar, CheckSquare, Square, Info
} from 'lucide-react';
import { MSSQL_CATEGORIES, BROADCAST_CATEGORIES } from '../../../utils/categoryColors';
import { formatTimecode } from '../../../utils/formatTimecode';
import usePlanningStore from '../../../store/planningStore';
import ClipDetailMetadataModal from './ClipDetailMetadataModal';

const AddClipsModal = ({
  isOpen,
  onClose,
  targetProgram, // { id, title, categoryId, categoryName }
  onSuccess
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [searchResults, setSearchResults] = useState([]);
  const [visibleLimit, setVisibleLimit] = useState(150);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedClipMap, setSelectedClipMap] = useState({}); // { [fileId]: clip }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [viewingClip, setViewingClip] = useState(null);
  const hiddenCategoryIds = usePlanningStore(state => state.hiddenCategoryIds) || [];
  const hiddenCatSet = new Set((hiddenCategoryIds || []).map(id => Number(id)));
  const visibleBroadcastCategories = Object.entries(BROADCAST_CATEGORIES).filter(([id]) => !hiddenCatSet.has(Number(id)));

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedCategoryFilter('all');
      setSearchResults([]);
      setSelectedClipMap({});
      setVisibleLimit(150);
      setErrorMsg(null);
    }
  }, [isOpen]);

  // Klip Arama (Sınırsız - tüm eşleşen klipler getirilir)
  useEffect(() => {
    if (!isOpen) return;
    setVisibleLimit(150);
    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        let url = `/api/archive/clips/search?limit=all`;
        if (searchQuery.trim()) {
          url += `&q=${encodeURIComponent(searchQuery.trim())}`;
        }
        if (selectedCategoryFilter !== 'all') {
          url += `&categoryId=${selectedCategoryFilter}`;
        }

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const filtered = (data.clips || []).filter(c => !hiddenCatSet.has(Number(c.categoryId)));
          setSearchResults(filtered);
        }
      } catch (err) {
        console.error('Klip arama hatası:', err);
      } finally {
        setIsSearching(false);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategoryFilter, isOpen]);

  if (!isOpen || !targetProgram) return null;

  const selectedClipsList = Object.values(selectedClipMap);
  const totalSelectedSeconds = selectedClipsList.reduce((acc, c) => acc + (c.durationSec || 0), 0);

  const toggleSelectClip = (clip) => {
    setSelectedClipMap(prev => {
      const copy = { ...prev };
      if (copy[clip.fileId]) {
        delete copy[clip.fileId];
      } else {
        copy[clip.fileId] = clip;
      }
      return copy;
    });
  };

  const handleSelectAllFound = () => {
    const allSelected = searchResults.length > 0 && searchResults.every(c => !!selectedClipMap[c.fileId]);
    if (allSelected) {
      // Seçimleri kaldır
      setSelectedClipMap(prev => {
        const copy = { ...prev };
        for (const c of searchResults) {
          delete copy[c.fileId];
        }
        return copy;
      });
    } else {
      // Hepsini seç
      setSelectedClipMap(prev => {
        const copy = { ...prev };
        for (const c of searchResults) {
          copy[c.fileId] = c;
        }
        return copy;
      });
    }
  };

  const handleSubmit = async () => {
    setErrorMsg(null);
    const fileIds = Object.keys(selectedClipMap).map(id => parseInt(id, 10));
    if (fileIds.length === 0) {
      setErrorMsg('Lütfen eklenecek en az bir klip seçin.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/archive/clips/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds,
          targetProgramId: targetProgram.id
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Klipler eklenirken bir hata oluştu.');
      }

      if (onSuccess) {
        onSuccess(data);
      }
      onClose();
    } catch (err) {
      console.error('Klip ekleme hatası:', err);
      setErrorMsg(err.message || 'Klipler eklenirken bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const isAllResultsSelected = searchResults.length > 0 && searchResults.every(c => !!selectedClipMap[c.fileId]);

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
        maxWidth: '850px',
        height: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        overflow: 'hidden'
      }}>
        {/* Üst Başlık */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              padding: '8px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Plus size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>
                Programa Klip Ekle
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Hedef Program: <strong style={{ color: 'var(--accent-primary)' }}>{targetProgram.title}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Arama & Kategori Filtresi Barı */}
        <div style={{
          padding: '16px 24px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          {/* Arama Kutusu */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--bg-primary)',
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            flex: '1 1 300px'
          }}>
            <Search size={16} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="Arşivdeki tüm kliplerde ara (isim, MAM dosya adı, ID)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '13px',
                width: '100%'
              }}
            />
            {isSearching && <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} color="var(--text-secondary)" />}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Kategori Filtresi */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-primary)',
            padding: '8px 12px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)'
          }}>
            <Filter size={14} color="var(--text-secondary)" />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Kategori:</span>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Tüm Yayın Kategorileri ({visibleBroadcastCategories.length} Kategori)</option>
              {visibleBroadcastCategories.map(([id, meta]) => (
                <option key={id} value={id}>
                  #{id} {meta.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tümünü Seç / Kaldır Butonu */}
          {searchResults.length > 0 && (
            <button
              onClick={handleSelectAllFound}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: isAllResultsSelected ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-tertiary)',
                color: isAllResultsSelected ? '#3b82f6' : 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {isAllResultsSelected ? <CheckSquare size={14} /> : <Square size={14} />}
              <span>{isAllResultsSelected ? 'Seçimleri Kaldır' : `Listedekileri Seç (${searchResults.length})`}</span>
            </button>
          )}
        </div>

        {/* Gövde: Klip Listesi */}
        <div
          style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 250 && visibleLimit < searchResults.length) {
              setVisibleLimit(prev => prev + 500);
            }
          }}
        >
          {errorMsg && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '16px 0'
            }}>
              <AlertCircle size={16} flexShrink={0} />
              <span>{errorMsg}</span>
            </div>
          )}

          {searchResults.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {isSearching ? (
                <>
                  <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
                  <div>Klipler aranıyor...</div>
                </>
              ) : (
                <>
                  <Search size={28} style={{ marginBottom: '8px', opacity: 0.5 }} />
                  <div style={{ fontSize: '14px', fontWeight: '700' }}>Klip bulunamadı</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    Yukarıdaki arama kutusuna anahtar kelime yazabilir veya kategoriyi değiştirebilirsiniz.
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ marginTop: '14px', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '10px 12px', width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isAllResultsSelected}
                        onChange={handleSelectAllFound}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ padding: '10px 12px', fontWeight: '700' }}>MAM Klip Adı</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', width: '140px' }}>Kategori</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700' }}>Şu Anki Programı</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', width: '100px' }}>Süre</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', width: '100px' }}>Tarih</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', width: '90px', textAlign: 'center' }}>Detay</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.slice(0, visibleLimit).map(clip => {
                    const isSelected = !!selectedClipMap[clip.fileId];
                    const isAlreadyInTarget = clip.programId === targetProgram.id;
                    const catMeta = MSSQL_CATEGORIES[clip.categoryId] || { color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' };

                    return (
                      <tr
                        key={clip.fileId}
                        onClick={() => !isAlreadyInTarget && toggleSelectClip(clip)}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          background: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                          cursor: isAlreadyInTarget ? 'default' : 'pointer',
                          opacity: isAlreadyInTarget ? 0.6 : 1,
                          transition: 'background 0.15s'
                        }}
                      >
                        <td style={{ padding: '10px 12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isAlreadyInTarget}
                            onChange={() => toggleSelectClip(clip)}
                            style={{ cursor: isAlreadyInTarget ? 'default' : 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontFamily: 'monospace', fontWeight: '700', color: 'var(--text-primary)' }}>
                            {clip.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            ID: #{clip.fileId} {clip.episodeNo ? `• Bölüm ${clip.episodeNo}` : ''} {clip.partNo ? `• P${clip.partNo}` : ''} {clip.note ? `• ${clip.note}` : ''}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            background: catMeta.bg,
                            color: catMeta.color,
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '6px'
                          }}>
                            {clip.categoryName || catMeta.name}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {isAlreadyInTarget ? (
                            <span style={{ color: '#10b981', fontWeight: '700' }}>Zaten Bu Programda</span>
                          ) : (
                            clip.programTitle || 'Atanmamış'
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '700', color: '#10b981', fontFamily: 'monospace' }}>
                          {formatTimecode(clip.durationSec)}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {formatDate(clip.fileCreateTime)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
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
            </div>
          )}
        </div>

        {/* Alt Sabit Çubuk */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
              Seçilen Klip: <strong style={{ color: '#10b981' }}>{selectedClipsList.length}</strong>
            </span>
            {selectedClipsList.length > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={13} /> Toplam Süre: <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>{formatTimecode(totalSelectedSeconds)}</strong>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              İptal
            </button>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || selectedClipsList.length === 0}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#10b981',
                color: '#fff',
                cursor: selectedClipsList.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: selectedClipsList.length === 0 ? 0.6 : 1,
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
              }}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Ekleniyor...</span>
                </>
              ) : (
                <>
                  <Plus size={15} />
                  <span>Seçilen {selectedClipsList.length} Klibi Programa Ekle</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Klip Detay, Metadata ve Video İzleme Modalı */}
      {viewingClip && (
        <ClipDetailMetadataModal
          isOpen={!!viewingClip}
          onClose={() => setViewingClip(null)}
          clip={viewingClip}
          program={targetProgram}
        />
      )}
    </div>
  );
};

export default AddClipsModal;
