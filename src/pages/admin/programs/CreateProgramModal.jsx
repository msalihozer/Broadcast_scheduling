/**
 * @file src/pages/admin/programs/CreateProgramModal.jsx
 * @description Admin Paneli - Programlar ve MAM Arşiv alanlarında yeni bir program başlığı oluşturma
 * ve isteğe bağlı olarak arşivden klip seçip içine bağlama modalı.
 */
import React, { useState, useEffect } from 'react';
import { 
  X, Plus, Search, Filter, RefreshCw, Check, AlertCircle, 
  Tv, Clock, CheckSquare, Square, Info 
} from 'lucide-react';
import { BROADCAST_CATEGORIES, MSSQL_CATEGORIES } from '../../../utils/categoryColors';
import { formatTimecode } from '../../../utils/formatTimecode';
import usePlanningStore from '../../../store/planningStore';
import ClipDetailMetadataModal from '../archive/ClipDetailMetadataModal';

const CreateProgramModal = ({
  isOpen,
  onClose,
  defaultCategoryId = 4,
  onSuccess
}) => {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(defaultCategoryId || 4);
  const [searchQuery, setSearchQuery] = useState('');
  const [clipCategoryFilter, setClipCategoryFilter] = useState('all');
  const [searchResults, setSearchResults] = useState([]);
  const [visibleLimit, setVisibleLimit] = useState(150);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedClipMap, setSelectedClipMap] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [viewingClip, setViewingClip] = useState(null);
  const hiddenCategoryIds = usePlanningStore(state => state.hiddenCategoryIds) || [];
  const hiddenCatSet = new Set((hiddenCategoryIds || []).map(id => Number(id)));
  const visibleBroadcastCategories = Object.entries(BROADCAST_CATEGORIES).filter(([id]) => !hiddenCatSet.has(Number(id)));

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setCategoryId(defaultCategoryId && defaultCategoryId !== 6 && defaultCategoryId !== 11 ? defaultCategoryId : 4);
      setSearchQuery('');
      setClipCategoryFilter('all');
      setSelectedClipMap({});
      setVisibleLimit(150);
      setErrorMsg(null);
    }
  }, [isOpen, defaultCategoryId]);

  // Arşivde canlı klip arama (Sınırsız - tüm eşleşen klipler getirilir)
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
        if (clipCategoryFilter !== 'all') {
          url += `&categoryId=${clipCategoryFilter}`;
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
  }, [searchQuery, clipCategoryFilter, isOpen]);

  if (!isOpen) return null;

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
      setSelectedClipMap(prev => {
        const copy = { ...prev };
        for (const c of searchResults) delete copy[c.fileId];
        return copy;
      });
    } else {
      setSelectedClipMap(prev => {
        const copy = { ...prev };
        for (const c of searchResults) copy[c.fileId] = c;
        return copy;
      });
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('Lütfen yeni program için bir başlık girin.');
      return;
    }

    try {
      setIsSubmitting(true);
      const fileIds = Object.keys(selectedClipMap).map(id => parseInt(id, 10));
      const res = await fetch('/api/archive/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          categoryId: parseInt(categoryId, 10),
          fileIds
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Program oluşturulurken bir hata oluştu.');
      }

      if (onSuccess) {
        onSuccess(data.program, fileIds.length);
      }
      onClose();
    } catch (err) {
      console.error('Program oluşturma hatası:', err);
      setErrorMsg(err.message || 'Program oluşturulurken bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
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
        maxWidth: '840px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        overflow: 'hidden'
      }}>
        {/* Başlık */}
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
              <Tv size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>
                Yeni Program Oluştur & Klip Ekle
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Yeni bir yayın programı başlığı oluşturun ve dilerseniz MAM arşivinden klipleri hemen içine bağlayın.
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
              padding: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Üst Alanı: Program Adı ve Kategori */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '14px'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Program Adı (Başlık):
            </label>
            <input
              type="text"
              placeholder="Ör: Hasbihal, Çerçeve, İlim Dersleri..."
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!searchQuery && e.target.value.trim().length >= 3) {
                  setSearchQuery(e.target.value.trim());
                }
              }}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: '700',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Yayın Kategorisi:
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: '700',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {visibleBroadcastCategories.map(([id, meta]) => (
                <option key={id} value={id}>
                  #{id} {meta.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* İsteğe Bağlı: Arşivden Klip Seçme Arama Çubuğu */}
        <div style={{
          padding: '12px 24px',
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>
            Programa Eklenecek Klipler (İsteğe Bağlı):
          </span>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-secondary)',
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            flex: '1 1 240px'
          }}>
            <Search size={14} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="MAM arşivinde klip adı, konu veya ID ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '12px',
                width: '100%'
              }}
            />
            {isSearching && <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--bg-secondary)',
            padding: '6px 10px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <Filter size={13} color="var(--text-secondary)" />
            <select
              value={clipCategoryFilter}
              onChange={(e) => setClipCategoryFilter(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '11px',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Tüm Kategoriler</option>
              {visibleBroadcastCategories.map(([id, meta]) => (
                <option key={id} value={id}>#{id} {meta.name}</option>
              ))}
            </select>
          </div>

          {searchResults.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAllFound}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: isAllResultsSelected ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-secondary)',
                color: isAllResultsSelected ? '#10b981' : 'var(--text-primary)',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {isAllResultsSelected ? <CheckSquare size={13} /> : <Square size={13} />}
              <span>{isAllResultsSelected ? 'Seçimi Kaldır' : `Tümünü Seç (${searchResults.length})`}</span>
            </button>
          )}
        </div>

        {/* Klip Listesi */}
        <div
          style={{ flex: 1, overflowY: 'auto', padding: '12px 24px', minHeight: '220px' }}
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
              marginBottom: '12px'
            }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {searchResults.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
              {isSearching ? 'Klipler aranıyor...' : 'Eşleşen klip bulunamadı. Programı klipsiz de oluşturup sonradan klip ekleyebilirsiniz.'}
            </div>
          ) : (
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 12px', width: '36px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isAllResultsSelected}
                        onChange={handleSelectAllFound}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ padding: '8px 12px' }}>MAM Klip Adı</th>
                    <th style={{ padding: '8px 12px', width: '110px' }}>Kategori</th>
                    <th style={{ padding: '8px 12px' }}>Mevcut Programı</th>
                    <th style={{ padding: '8px 12px', width: '100px' }}>Süre</th>
                    <th style={{ padding: '8px 12px', width: '90px', textAlign: 'center' }}>Detay</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.slice(0, visibleLimit).map(clip => {
                    const isSelected = !!selectedClipMap[clip.fileId];
                    const catMeta = MSSQL_CATEGORIES[clip.categoryId] || { color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' };
                    return (
                      <tr
                        key={clip.fileId}
                        onClick={() => toggleSelectClip(clip)}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          background: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                          cursor: 'pointer'
                        }}
                      >
                        <td style={{ padding: '8px 12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectClip(clip)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{clip.name}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                            #{clip.fileId} {clip.episodeNo ? `• Bölüm ${clip.episodeNo}` : ''} {clip.note ? `• ${clip.note}` : ''}
                          </div>
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
                            #{clip.categoryId} {catMeta.name}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                          {clip.programTitle || 'Atanmamış'}
                        </td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: '700', color: '#10b981' }}>
                          {formatTimecode(clip.durationSec)}
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
            </div>
          )}
        </div>

        {/* Alt Aksiyon Çubuğu */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px' }}>
            <span>
              Seçilen Klip: <strong style={{ color: '#10b981' }}>{selectedClipsList.length}</strong>
            </span>
            {selectedClipsList.length > 0 && (
              <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> Toplam: <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>{formatTimecode(totalSelectedSeconds)}</strong>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
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
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !title.trim()}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#10b981',
                color: '#fff',
                cursor: !title.trim() ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: !title.trim() ? 0.6 : 1,
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
              }}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Oluşturuluyor...</span>
                </>
              ) : (
                <>
                  <Plus size={15} />
                  <span>
                    {selectedClipsList.length > 0
                      ? `Programı Oluştur ve ${selectedClipsList.length} Klip Ekle`
                      : 'Programı Oluştur'}
                  </span>
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
        />
      )}
    </div>
  );
};

export default CreateProgramModal;

