/**
 * @file MatchMediaModal.jsx
 * @description Akıştaki bir programa MAM klip eşleştirme modalı.
 * 
 * Temel Sorumluluklar:
 * 1. Seçili programın dbName veya başlığı ile /api/searchClips üzerinden arama yapma
 * 2. MSSQL'deki gerçek dosya ve süreyi (fileId, fileName, duration, trimIn/Out) programa bağlama
 * 3. Çok parçalı (part1, part2) veya revize klipleri seçebilme
 */
import React, { useState, useEffect } from 'react';
import { X, Search, CheckCircle2, AlertCircle, Loader } from 'lucide-react';
import usePlanningStore from '../../store/planningStore';

const MatchMediaModal = ({ program, onClose, onMatch }) => {
  const getInitialQuery = () => {
    if (program?.dbName) {
      return `${program.dbName}${program.episode ? ` ${program.episode}` : ''}`;
    }
    return program?.title || '';
  };

  const [query, setQuery] = useState(getInitialQuery());
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedClips, setSelectedClips] = useState([]);

  useEffect(() => {
    if (query.trim().length > 2) {
      handleSearch(query);
    }
  }, []);

  const handleSearch = async (searchQuery) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/searchClips?query=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (err) {
      console.error('Search error', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelection = (clip) => {
    setSelectedClips(prev => {
      const isSelected = prev.find(p => p.id === clip.id);
      if (isSelected) return prev.filter(p => p.id !== clip.id);
      return [...prev, clip].sort((a, b) => a.title.localeCompare(b.title));
    });
  };

  const handleConfirm = () => {
    if (selectedClips.length > 0) {
      onMatch(selectedClips);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '12px',
        width: '800px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        border: '1px solid var(--border-color)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-secondary)',
          flexShrink: 0
        }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '18px', fontWeight: 'bold' }}>Medya Eşleştir</h3>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Taslak: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{program?.title}</span>
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px'
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
                placeholder="Gerçek klip adını arayın (Örn: Beş Vakit)..."
                style={{
                  width: '100%', padding: '10px 10px 10px 36px',
                  borderRadius: '6px', border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                  fontSize: '14px', outline: 'none'
                }}
              />
            </div>
            <button
              onClick={() => handleSearch(query)}
              disabled={isLoading}
              className="action-btn"
              style={{ background: 'var(--primary)', color: 'white', border: 'none' }}
            >
              Ara
            </button>
          </div>
          <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={14} color="var(--warning)" /> 
            Not: Çoklu part (Part 1, Part 2) olan programları sırasıyla seçin.
          </div>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', background: 'var(--bg-tertiary)', minHeight: 0 }}>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', gap: '8px', color: 'var(--text-secondary)' }}>
              <Loader size={20} className="spin-animation" /> Aranıyor...
            </div>
          ) : results.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
              Sonuç bulunamadı. Farklı kelimelerle arama yapmayı deneyin.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {results.map(clip => {
                const isSelected = selectedClips.some(p => p.id === clip.id);
                const isRevize = clip.title.toLowerCase().includes('rvz') || clip.title.toLowerCase().includes('_y');
                
                return (
                  <div
                    key={clip.id}
                    onClick={() => toggleSelection(clip)}
                    style={{
                      padding: '12px 16px',
                      background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-primary)',
                      border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ 
                      width: '20px', height: '20px', borderRadius: '4px', 
                      border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--text-muted)'}`,
                      background: isSelected ? 'var(--primary)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {isSelected && <CheckCircle2 size={14} color="white" />}
                    </div>
                    
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {clip.title}
                        </h4>
                        {isRevize && (
                          <span style={{ background: 'var(--warning)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '12px', fontWeight: 'bold' }}>
                            REVIZE
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {clip.fileName} • Süre: {clip.duration ? clip.duration.toFixed(2) : 0} dk
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-secondary)',
          flexShrink: 0
        }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Seçilen Klip: <strong>{selectedClips.length}</strong>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} style={{
              padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '500'
            }}>
              İptal
            </button>
            <button 
              onClick={handleConfirm}
              disabled={selectedClips.length === 0}
              style={{
                padding: '8px 24px', borderRadius: '6px', border: 'none',
                background: selectedClips.length > 0 ? 'var(--primary)' : 'var(--bg-tertiary)', 
                color: selectedClips.length > 0 ? 'white' : 'var(--text-muted)', 
                cursor: selectedClips.length > 0 ? 'pointer' : 'not-allowed', 
                fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <CheckCircle2 size={16} /> Eşleştir ve Değiştir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchMediaModal;
