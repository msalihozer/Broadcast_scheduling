/**
 * @file src/pages/admin/archive/MoveClipsModal.jsx
 * @description Seçili arşiv kliplerini mevcut başka bir programa aktarma veya yeni bir program başlığı
 * oluşturarak oraya taşıma (/api/archive/clips/reassign) modalı.
 */
import React, { useState, useEffect } from 'react';
import {
  X, Search, FolderInput, Plus, Check, AlertCircle, RefreshCw, Filter, Clock, Hash, FileVideo
} from 'lucide-react';
import { MSSQL_CATEGORIES, BROADCAST_CATEGORIES } from '../../../utils/categoryColors';
import { formatTimecode } from '../../../utils/formatTimecode';

const MoveClipsModal = ({
  isOpen,
  onClose,
  selectedClips = [],
  currentProgramTitle = '',
  onSuccess
}) => {
  const [mode, setMode] = useState('existing'); // 'existing' | 'new'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [searchResults, setSearchResults] = useState([]);
  const [visibleLimit, setVisibleLimit] = useState(150);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTargetProgram, setSelectedTargetProgram] = useState(null);

  // Yeni program oluşturma formu
  const [newTitle, setNewTitle] = useState('');
  const [newCategoryId, setNewCategoryId] = useState(4); // Varsayılan: Dini

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedCategoryFilter('all');
      setSearchResults([]);
      setVisibleLimit(150);
      setSelectedTargetProgram(null);
      setNewTitle('');
      setErrorMsg(null);
      setMode('existing');
    }
  }, [isOpen]);

  // Programları Getir / Canlı Arama (Açılır açılmaz veya arama/kategori değiştikçe)
  useEffect(() => {
    if (!isOpen || mode !== 'existing') return;
    setVisibleLimit(150);
    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        let url = `/api/archive/search?limit=all`;
        if (searchQuery.trim()) {
          url += `&q=${encodeURIComponent(searchQuery.trim())}`;
        }
        if (selectedCategoryFilter !== 'all') {
          url += `&categoryId=${selectedCategoryFilter}`;
        }

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.programs || []);
        }
      } catch (err) {
        console.error('Program arama hatası:', err);
      } finally {
        setIsSearching(false);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategoryFilter, isOpen, mode]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setErrorMsg(null);

    const fileIds = selectedClips.map(c => c.fileId);
    if (fileIds.length === 0) {
      setErrorMsg('Hiç klip seçilmedi.');
      return;
    }

    try {
      setIsSubmitting(true);
      let payload = { fileIds };

      if (mode === 'existing') {
        if (!selectedTargetProgram) {
          setErrorMsg('Lütfen hedef bir program seçin.');
          setIsSubmitting(false);
          return;
        }
        payload.targetProgramId = selectedTargetProgram.id;
      } else {
        if (!newTitle.trim()) {
          setErrorMsg('Lütfen yeni program için bir başlık girin.');
          setIsSubmitting(false);
          return;
        }
        payload.newProgramTitle = newTitle.trim();
        payload.targetCategoryId = parseInt(newCategoryId, 10);
      }

      const res = await fetch('/api/archive/clips/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Klipler taşınırken bir hata oluştu.');
      }

      if (onSuccess) {
        onSuccess(data);
      }
      onClose();
    } catch (err) {
      console.error('Taşıma hatası:', err);
      setErrorMsg(err.message || 'Klipler taşınırken bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
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
        maxWidth: '620px',
        maxHeight: '92vh',
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
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              padding: '8px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FolderInput size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
                Klipleri Başka Programa Taşı
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Seçili <strong>{selectedClips.length}</strong> klip aktarılacak {currentProgramTitle ? `(${currentProgramTitle})` : ''}
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
            <X size={18} />
          </button>
        </div>

        {/* Sekmeler (Mevcut Program / Yeni Program) */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          padding: '0 24px'
        }}>
          <button
            onClick={() => setMode('existing')}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: mode === 'existing' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: mode === 'existing' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Mevcut Programa Aktar
          </button>
          <button
            onClick={() => setMode('new')}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: mode === 'new' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: mode === 'new' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            + Yeni Program Oluştur & Aktar
          </button>
        </div>

        {/* Gövde */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
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
              marginBottom: '16px'
            }}>
              <AlertCircle size={16} flexShrink={0} />
              <span>{errorMsg}</span>
            </div>
          )}

          {mode === 'existing' ? (
            <div>
              {/* Arama & Kategori Filtresi Barı */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--bg-primary)',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  flex: '1 1 240px'
                }}>
                  <Search size={15} color="var(--text-secondary)" />
                  <input
                    type="text"
                    placeholder="Hedef program adıyla filtrele..."
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
                  {isSearching && <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} color="var(--text-secondary)" />}
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0 4px' }}
                    >
                      ×
                    </button>
                  )}
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--bg-primary)',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)'
                }}>
                  <Filter size={13} color="var(--text-secondary)" />
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
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
                    {Object.entries(BROADCAST_CATEGORIES).map(([id, meta]) => (
                      <option key={id} value={id}>
                        #{id} {meta.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Seçilen program gösterimi */}
              {selectedTargetProgram && (
                <div style={{
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '14px',
                  animation: 'fadeIn 0.2s ease-in-out'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: '700', textTransform: 'uppercase' }}>
                      Seçilen Hedef Program
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
                      {selectedTargetProgram.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Kategori: <strong>{selectedTargetProgram.categoryName || MSSQL_CATEGORIES[selectedTargetProgram.categoryId]?.name}</strong></span>
                      <span>•</span>
                      <span>Mevcut Klip: <strong>{selectedTargetProgram.totalClips || 0}</strong></span>
                    </div>
                  </div>
                  <div style={{
                    background: '#3b82f6',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '26px',
                    height: '26px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Check size={16} />
                  </div>
                </div>
              )}

              {/* Program Listesi */}
              <div
                style={{
                  maxHeight: '340px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  background: 'var(--bg-primary)'
                }}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200 && visibleLimit < searchResults.length) {
                    setVisibleLimit(prev => prev + 200);
                  }
                }}
              >
                <div style={{
                  padding: '8px 14px',
                  background: 'var(--bg-tertiary)',
                  borderBottom: '1px solid var(--border-color)',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>Program Başlığı ({searchResults.length} Program Bulundu)</span>
                  <span>Kategori / Süre</span>
                </div>

                {searchResults.length === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {isSearching ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Programlar yükleniyor...</span>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontWeight: '700', marginBottom: '4px' }}>Program bulunamadı</div>
                        <div style={{ fontSize: '11px' }}>
                          Yeni bir program oluşturmak için yukarıdan <strong>"+ Yeni Program Oluştur & Aktar"</strong> sekmesini kullanabilirsiniz.
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  searchResults.slice(0, visibleLimit).map(p => {
                    const isSelected = selectedTargetProgram?.id === p.id;
                    const catMeta = MSSQL_CATEGORIES[p.categoryId] || { color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' };
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedTargetProgram(p)}
                        style={{
                          padding: '11px 16px',
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{
                            fontSize: '13px',
                            fontWeight: '700',
                            color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span>{p.title}</span>
                            {p.isActive && (
                              <span style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                background: '#10b981',
                                display: 'inline-block'
                              }} title="Kullanımda" />
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                            <span style={{
                              background: catMeta.bg,
                              color: catMeta.color,
                              fontSize: '10px',
                              fontWeight: '700',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              {p.categoryName || catMeta.name}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              <FileVideo size={11} style={{ display: 'inline', verticalAlign: '-1px' }} /> {p.totalClips || 0} Klip
                            </span>
                            {p.totalEpisodes > 0 && (
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                <Hash size={11} style={{ display: 'inline', verticalAlign: '-1px' }} /> {p.totalEpisodes} Bölüm
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#10b981', fontFamily: 'monospace' }}>
                              {formatTimecode(p.totalDurationSec)}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                              {p.isActive ? 'Kullanımda' : 'Arşivde'}
                            </div>
                          </div>
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            border: isSelected ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                            background: isSelected ? '#3b82f6' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff'
                          }}>
                            {isSelected && <Check size={12} />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Yeni Program Başlığı:
                </label>
                <input
                  type="text"
                  placeholder="Ör: İlim Dersleri, Tecvid Dersleri..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: '600',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Kategori Seçin:
                </label>
                <select
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: '600',
                    outline: 'none'
                  }}
                >
                  {Object.entries(BROADCAST_CATEGORIES).map(([id, meta]) => (
                    <option key={id} value={id}>
                      #{id} {meta.name} ({meta.type})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}>
                ℹ️ Bu işlem yeni bir program oluşturacak ve seçili <strong>{selectedClips.length}</strong> klibi bu programa aktaracaktır.
              </div>
            </div>
          )}
        </div>

        {/* Alt Butonlar */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
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
            disabled={isSubmitting || (mode === 'existing' && !selectedTargetProgram) || (mode === 'new' && !newTitle.trim())}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--accent-primary)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: (mode === 'existing' && !selectedTargetProgram) || (mode === 'new' && !newTitle.trim()) ? 0.6 : 1,
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
            }}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Taşınıyor...</span>
              </>
            ) : (
              <>
                <FolderInput size={14} />
                <span>{selectedClips.length} Klibi Taşı</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveClipsModal;
