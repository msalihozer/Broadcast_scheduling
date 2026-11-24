/**
 * @file src/modules/broadcast/components/AddBroadcastProgramModal.jsx
 * @description Yayın akışına (Liste A / Liste B) doğrudan MAM arşivinden klip seçerek veya
 * manuel kuşak/program tanımlayarak yeni öğe ekleme modalı.
 */
import React, { useState, useEffect } from 'react';
import { 
  X, Search, Plus, Check, RefreshCw, Filter, Clock, Film, Layers,
  ArrowUpToLine, CornerDownRight, ArrowDownToLine
} from 'lucide-react';
import { MSSQL_CATEGORIES, BROADCAST_CATEGORIES } from '../../../utils/categoryColors';
import { formatTimecode } from '../../../utils/formatTimecode';
import { dialog } from '../../../store/dialogStore';
import usePlanningStore from '../../../store/planningStore';
import { isRamadanFeatureWindowOpen } from '../../../components/Ads/reservation/reservationConstants';
import useBroadcastStore from '../store/broadcastStore';

const AddBroadcastProgramModal = ({ isOpen, onClose }) => {
  const {
    selectedChannel,
    selectedDate,
    activeList,
    selectedInstanceId,
    insertPosition,
    setInsertPosition,
    addProgram
  } = useBroadcastStore();

  const [mode, setMode] = useState('mam'); // 'mam' | 'manual'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const hiddenCategoryIds = usePlanningStore(state => state.hiddenCategoryIds) || [];
  const hiddenCatSet = new Set((hiddenCategoryIds || []).map(id => Number(id)));
  const visibleBroadcastCategories = Object.entries(BROADCAST_CATEGORIES).filter(([id]) => !hiddenCatSet.has(Number(id)));

  // Manuel form state
  const [manualTitle, setManualTitle] = useState('');
  const [manualCategory, setManualCategory] = useState('Dini');
  const [manualDurationMin, setManualDurationMin] = useState(45);
  const [manualEpisode, setManualEpisode] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [ramadanProgramType, setRamadanProgramType] = useState('');
  const ramadanConfig = usePlanningStore(state => state.ramadanConfig);
  const showRamadanControls = isRamadanFeatureWindowOpen(ramadanConfig, selectedDate);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedCategoryFilter('all');
      setSearchResults([]);
      setManualTitle('');
      setManualEpisode('');
      setManualNote('');
      setRamadanProgramType('');
      setMode('mam');
    }
  }, [isOpen]);

  // MAM Arşiv Arama
  useEffect(() => {
    if (!isOpen || mode !== 'mam') return;
    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        let url = `/api/archive/clips/search?limit=all&onlyActivePrograms=true`;
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
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategoryFilter, isOpen, mode]);

  if (!isOpen) return null;

  const getPlacementLabel = () => {
    if (insertPosition === 'top') return 'Listenin En Üstü';
    if (insertPosition === 'after_selected') return selectedInstanceId ? 'Seçili Satırın Altı' : 'Listenin En Altı';
    return 'Listenin En Altı';
  };

  const handleAddClip = (clip) => {
    const durTc = clip.durationFormatted || (clip.durationSec ? `${String(Math.floor(clip.durationSec / 3600)).padStart(2, '0')}.${String(Math.floor((clip.durationSec % 3600) / 60)).padStart(2, '0')}.${String(clip.durationSec % 60).padStart(2, '0')}.00` : '00.30.00.00');
    const clipDisplay = clip.name || clip.fileName || 'Klip';
    const autoDetectedRamadan = ramadanProgramType || (/sahur/i.test(clipDisplay) ? 'sahur' : /iftar/i.test(clipDisplay) ? 'iftar' : '');
    addProgram(selectedChannel, selectedDate, activeList, {
      title: clip.name,
      name: clip.name,
      clipName: clipDisplay,
      durationTc: durTc,
      durationSec: clip.durationSec || 1800,
      category: clip.categoryName || 'Genel',
      categoryColor: clip.categoryColor || '#3b82f6',
      episodeNo: clip.episodeNo || null,
      partNo: clip.partNo || null,
      note: clip.note || '',
      fileId: clip.fileId,
      ramadanProgramType: autoDetectedRamadan,
      type: 'clip'
    });
    onClose();
    dialog.success(
      'Klip Yayın Akışına Eklendi',
      `Seçilen klip yayın listesine başarıyla eklendi.\nKlip Adı: ${clipDisplay}\nSüre: ${durTc}\nEklendiği Konum: ${getPlacementLabel()}`
    );
  };

  const handleAddManual = (e) => {
    e.preventDefault();
    if (!manualTitle.trim()) return;
    const durMin = parseInt(manualDurationMin, 10) || 30;
    const h = Math.floor(durMin / 60);
    const m = durMin % 60;
    const durTc = `${String(h).padStart(2, '0')}.${String(m).padStart(2, '0')}.00.00`;
    const cleanTitle = manualTitle.trim();
    const autoDetectedRamadan = ramadanProgramType || (/sahur/i.test(cleanTitle) ? 'sahur' : /iftar/i.test(cleanTitle) ? 'iftar' : '');

    addProgram(selectedChannel, selectedDate, activeList, {
      title: cleanTitle,
      name: cleanTitle,
      durationTc: durTc,
      durationSec: durMin * 60,
      category: manualCategory,
      categoryColor: '#3b82f6',
      episodeNo: manualEpisode ? parseInt(manualEpisode, 10) : null,
      note: manualNote.trim(),
      ramadanProgramType: autoDetectedRamadan,
      isLive: /canl[ıi]/i.test(manualNote) || Boolean(autoDetectedRamadan),
      type: (/canl[ıi]/i.test(manualNote) || Boolean(autoDetectedRamadan)) ? 'live' : 'program'
    });
    onClose();
    dialog.success(
      'Program Yayın Akışına Eklendi',
      `Manuel program kuşağı yayın listesine başarıyla eklendi.\nProgram Adı: ${cleanTitle}\nSüre: ${durMin} Dakika (${durTc})\nEklendiği Konum: ${getPlacementLabel()}`
    );
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
        maxWidth: '720px',
        maxHeight: '88vh',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              padding: '8px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Plus size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
                Yayın Akışına Program Ekle
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Hedef: <strong>Liste {activeList}</strong> ({selectedDate})
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
            <X size={18} />
          </button>
        </div>

        {/* Sekmeler */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          padding: '0 24px'
        }}>
          <button
            onClick={() => setMode('mam')}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: mode === 'mam' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: mode === 'mam' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            MAM Arşivinden Klip Seç
          </button>
          <button
            onClick={() => setMode('manual')}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: mode === 'manual' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: mode === 'manual' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            + Manuel Kuşak / Program Oluştur
          </button>
        </div>

        {/* Ekleneceği Yer Seçicisi (En Üst / Seçilenin Altına / En Alt) */}
        <div style={{
          padding: '9px 24px',
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)' }}>
            Listeye Ekleneceği Yer:
          </span>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: 'var(--bg-secondary)',
            padding: '4px',
            borderRadius: '9px',
            border: '1px solid var(--border-color)'
          }}>
            {[
              { id: 'top', label: 'En Üst', icon: ArrowUpToLine },
              { id: 'after_selected', label: selectedInstanceId ? 'Seçilenin Altına' : 'Seçilenin Altına (Yoksa Sona)', icon: CornerDownRight },
              { id: 'bottom', label: 'En Alt', icon: ArrowDownToLine }
            ].map(opt => {
              const Icon = opt.icon;
              const active = insertPosition === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setInsertPosition(opt.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: active ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent',
                    background: active ? 'var(--accent-primary)' : 'transparent',
                    color: active ? '#ffffff' : 'var(--text-secondary)',
                    fontSize: '11.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <Icon size={13} />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Gövde */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {mode === 'mam' ? (
            <div>
              {/* Arama ve Filtre */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--bg-primary)',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  flex: '1 1 280px'
                }}>
                  <Search size={15} color="var(--text-secondary)" />
                  <input
                    type="text"
                    placeholder="MAM klip adı, program veya ID ile ara..."
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
                    {visibleBroadcastCategories.map(([id, meta]) => (
                      <option key={id} value={id}>
                        #{id} {meta.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sonuç Listesi */}
              <div style={{
                maxHeight: '340px',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                background: 'var(--bg-primary)'
              }}>
                {searchResults.length === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {isSearching ? 'Klipler aranıyor...' : 'Aramak için anahtar kelime yazın.'}
                  </div>
                ) : (
                  searchResults.map(clip => {
                    const catMeta = MSSQL_CATEGORIES[clip.categoryId] || { color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' };
                    return (
                      <div
                        key={clip.fileId}
                        onClick={() => handleAddClip(clip)}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '12px', color: 'var(--text-primary)' }}>
                            {clip.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                            <span style={{
                              background: catMeta.bg,
                              color: catMeta.color,
                              fontSize: '10px',
                              fontWeight: '700',
                              padding: '1px 6px',
                              borderRadius: '4px'
                            }}>
                              {clip.categoryName || catMeta.name}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              #{clip.fileId} {clip.episodeNo ? `• Bölüm ${clip.episodeNo}` : ''}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#10b981', fontSize: '12px' }}>
                            {formatTimecode(clip.durationSec)}
                          </span>
                          <button
                            style={{
                              background: '#10b981',
                              color: '#fff',
                              border: 'none',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            + Ekle
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleAddManual}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Program / Kuşak Adı:
                </label>
                <input
                  type="text"
                  placeholder="Ör: Ana Haber Bülteni, Mesneviden Dersler..."
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Süre (Dakika):
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={manualDurationMin}
                    onChange={(e) => setManualDurationMin(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Kategori:
                  </label>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  >
                    {Object.values(MSSQL_CATEGORIES).map(cat => (
                      <option key={cat.name} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Bölüm No (Opsiyonel):
                  </label>
                  <input
                    type="number"
                    placeholder="Ör: 45"
                    value={manualEpisode}
                    onChange={(e) => setManualEpisode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Özel Not / Kuşak:
                  </label>
                  <input
                    type="text"
                    placeholder="Ör: Canlı Yayın, Revize..."
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>

              {/* Ramazan Özel Program İşareti (Yalnızca Ramazan tarihine 2 hafta kala veya Ramazan döneminde gösterilir) */}
              {showRamadanControls && (
                <div style={{
                  marginBottom: '16px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: ramadanProgramType ? 'rgba(217, 119, 6, 0.12)' : 'var(--bg-primary)',
                  border: ramadanProgramType ? '1.5px solid #d97706' : '1px solid var(--border-color)'
                }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: ramadanProgramType ? '#d97706' : 'var(--text-primary)', marginBottom: '6px' }}>
                    Ramazan Özel Programı mı? (Sahur / İftar Başlangıç Saati Tespiti İçin):
                  </label>
                  <select
                    value={ramadanProgramType}
                    onChange={(e) => setRamadanProgramType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Normal Program (Ramazan Özel Değil)</option>
                    <option value="sahur">Ramazan Sahur Programı (Canlı / Özel)</option>
                    <option value="iftar">Ramazan İftar Programı (Canlı / Özel)</option>
                  </select>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Seçildiğinde bu programın yayın listesindeki <strong>başlangıç saati</strong> otomatik olarak Sahur/İftar başlangıç saati olarak çekilir ve komşu reklam kuşakları Ramazan Özel olarak değerlendirilir.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#10b981',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '700'
                  }}
                >
                  + Kuşağı Yayına Ekle
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddBroadcastProgramModal;
