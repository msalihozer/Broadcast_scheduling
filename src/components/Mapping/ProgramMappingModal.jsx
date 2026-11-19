/**
 * @file ProgramMappingModal.jsx
 * @description Program Eşleştirme (Mapping) Yönetim Modalı.
 * 
 * Amaç:
 * Excel haftalık akışlarından veya serbest metin girişlerinden gelen program isimlerini,
 * MSSQL MAM veritabanındaki resmi program isimleriyle (dbName <-> displayName) eşleştirir.
 * 
 * Veri Kalıcılığı:
 * - Backend: GET/POST /api/programMappings
 * - Dosya: backend_program_mappings.json
 */
import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Trash2, Save, Loader } from 'lucide-react';
import useDialogStore from '../../store/dialogStore';

const ProgramMappingModal = ({ onClose }) => {
  const [mappings, setMappings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dbNameInput, setDbNameInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  
  // Arama state'leri
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchMappings();
  }, []);

  const fetchMappings = async () => {
    try {
      const response = await fetch('/api/programMappings');
      if (response.ok) {
        const data = await response.json();
        setMappings(data);
      }
    } catch (err) {
      console.error('Failed to fetch mappings', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveMappings = async (newMappings) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/programMappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMappings)
      });
      if (response.ok) {
        setMappings(newMappings);
        useDialogStore.getState().showAlert('Başarılı', 'Eşleştirmeler kaydedildi.');
      } else {
        throw new Error('Kaydedilemedi');
      }
    } catch (err) {
      console.error('Failed to save mappings', err);
      useDialogStore.getState().showAlert('Hata', 'Kaydedilirken bir hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMapping = () => {
    if (!dbNameInput.trim() || !displayNameInput.trim()) {
      return useDialogStore.getState().showAlert('Uyarı', 'Veritabanı Adı ve Görünen Ad alanları boş bırakılamaz.');
    }
    
    // Check if exists
    if (mappings.find(m => m.dbName.toLowerCase() === dbNameInput.trim().toLowerCase())) {
      return useDialogStore.getState().showAlert('Uyarı', 'Bu veritabanı adı için zaten bir eşleştirme var.');
    }

    const newMappings = [...mappings, { 
      dbName: dbNameInput.trim(), 
      displayName: displayNameInput.trim() 
    }];
    saveMappings(newMappings);
    setDbNameInput('');
    setDisplayNameInput('');
  };

  const handleRemoveMapping = (dbName) => {
    useDialogStore.getState().showConfirm('Emin misiniz?', 'Bu eşleştirmeyi silmek istediğinize emin misiniz?', () => {
      const newMappings = mappings.filter(m => m.dbName !== dbName);
      saveMappings(newMappings);
    });
  };

  // Dinamik Arama
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.length >= 2) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const response = await fetch(`/api/searchClips?query=${encodeURIComponent(searchTerm)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.slice(0, 50)); // İlk 50 sonucu göster
      }
    } catch (err) {
      console.error("Arama hatası:", err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'var(--bg-primary)', width: '800px', maxWidth: '95vw', height: '600px', maxHeight: '90vh', minHeight: 0, minWidth: 0, borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Program İsim Eşleştirmeleri
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Veritabanındaki fiziksel klip isimlerini, sistemde kullanmak istediğiniz okunaklı isimlerle eşleştirin.
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
          
          {/* Sol Panel: Ekleme Formu ve DB Arama */}
          <div style={{ width: '40%', minWidth: '280px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', overflowY: 'auto', minHeight: 0 }}>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Yeni Eşleştirme Ekle</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Veritabanı Adı (örn: 5vakit1sehir)</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                  <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setDbNameInput(e.target.value); // Arama yaparken db adını da doldur
                    }}
                    placeholder="Veritabanında ara..."
                    style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px 8px 32px', color: 'var(--text-primary)', outline: 'none', fontSize: '13px' }}
                  />
                  {isSearching && <Loader size={14} className="spin-animation" style={{ position: 'absolute', right: '10px', top: '10px', color: 'var(--text-muted)' }} />}
                </div>
              </div>

              {/* Arama Sonuçları Önerileri */}
              {searchResults.length > 0 && (
                <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
                  {searchResults.map(res => (
                    <div 
                      key={res.fileId} 
                      onClick={() => {
                        // Regex: _Blm, _Part, _34 vb kısımları atıp kök adını bulmaya çalış
                        let base = res.name.split(/_blm|_part|_\d/i)[0];
                        setDbNameInput(base);
                        setSearchTerm('');
                        setSearchResults([]);
                      }}
                      style={{ padding: '6px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {res.name}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Görünen Ad (örn: Beş Vakit Bir Şehir)</label>
                <input 
                  type="text" 
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Ekranda görünecek isim"
                  style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)', outline: 'none', fontSize: '13px' }}
                />
              </div>

              <button 
                onClick={handleAddMapping}
                disabled={isSaving}
                style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '6px', padding: '10px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}
              >
                {isSaving ? <Loader size={16} className="spin-animation" /> : <Plus size={16} />}
                Eşleştirme Ekle
              </button>
            </div>
          </div>

          {/* Sağ Panel: Kayıtlı Eşleştirmeler */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', minHeight: 0, minWidth: 0 }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontSize: '14px', fontWeight: 'bold', color: 'var(--text-secondary)', flexShrink: 0 }}>
              Kayıtlı Eşleştirmeler ({mappings.length})
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', minHeight: 0 }}>
              {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader className="spin-animation" /></div>
              ) : mappings.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px', fontSize: '13px' }}>
                  Henüz eşleştirme bulunmuyor. Sol taraftan yeni bir tane ekleyebilirsiniz.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {mappings.map((m, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{m.displayName}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>DB Adı: <span style={{ color: 'var(--accent-primary)' }}>{m.dbName}</span></span>
                      </div>
                      <button 
                        onClick={() => handleRemoveMapping(m.dbName)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '6px', borderRadius: '4px' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        title="Sil"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProgramMappingModal;
