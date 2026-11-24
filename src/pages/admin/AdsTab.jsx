/**
 * @file src/pages/admin/AdsTab.jsx
 * @description Admin Paneli - Reklam Yönetimi Sekmesi (Sadece Kategori #6: Reklam verileri).
 * MSSQL Libero MAM arşivindeki Reklam (categoryId = 6) kategorisini, kategori metadata şemasını,
 * şirket/marka gruplarını ve reklam spotlarını listeler. (Clean / Kullanma isimli klipler hariç tutulur.)
 */
import React, { useState, useEffect, useMemo } from 'react';
import { 
  PlaySquare, Clock, Search, RefreshCw, Building2, Tag, 
  FileVideo, ChevronDown, ChevronUp, Hash, Calendar, ShieldCheck, X 
} from 'lucide-react';
import { formatTimecode } from '../../utils/formatTimecode';
import usePlanningStore from '../../store/planningStore';
import { isRamadanFeatureWindowOpen } from '../../components/Ads/reservation/reservationConstants';

const AdsTab = () => {
  const ramadanConfig = usePlanningStore(state => state.ramadanConfig);
  const setRamadanConfig = usePlanningStore(state => state.setRamadanConfig);
  const isRamadanActiveNow = isRamadanFeatureWindowOpen(ramadanConfig);
  const [adsData, setAdsData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('brands'); // 'brands' | 'spots'
  const [expandedBrands, setExpandedBrands] = useState({});
  const [sortBy, setSortBy] = useState('clips-desc');

  const fetchAdsArchive = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/archive/ads');
      if (res.ok) {
        const data = await res.json();
        setAdsData(data);
      }
    } catch (err) {
      console.error('Reklam verileri alınamadı:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdsArchive();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const toggleBrandExpand = (brandName) => {
    setExpandedBrands(prev => ({
      ...prev,
      [brandName]: !prev[brandName]
    }));
  };

  // Filtrelenmiş markalar ve spotlar
  const filteredBrands = useMemo(() => {
    const groups = adsData?.brandGroups || [];
    if (!searchQuery.trim()) {
      const list = [...groups];
      if (sortBy === 'clips-desc') list.sort((a, b) => (b.totalClips || b.spotsCount || 0) - (a.totalClips || a.spotsCount || 0));
      if (sortBy === 'duration-desc') list.sort((a, b) => (b.totalDurationSec || 0) - (a.totalDurationSec || 0));
      if (sortBy === 'name-asc') list.sort((a, b) => a.brand.localeCompare(b.brand, 'tr-TR'));
      return list;
    }

    const q = searchQuery.toLowerCase().trim();
    return groups
      .map(g => {
        const brandMatch = g.brand.toLowerCase().includes(q);
        const rawClips = g.clips || g.spots || [];
        const matchingClips = rawClips.filter(c =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.campaign || '').toLowerCase().includes(q) ||
          (c.fileName || '').toLowerCase().includes(q) ||
          String(c.fileId || '').includes(q)
        );
        if (brandMatch) return { ...g, clips: rawClips, totalClips: rawClips.length };
        if (matchingClips.length > 0) {
          return {
            ...g,
            clips: matchingClips,
            spots: matchingClips,
            totalClips: matchingClips.length,
            spotsCount: matchingClips.length
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [adsData, searchQuery, sortBy]);

  const filteredSpots = useMemo(() => {
    const spots = adsData?.clips || adsData?.ads || [];
    if (!searchQuery.trim()) return spots;
    const q = searchQuery.toLowerCase().trim();
    return spots.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.brand || '').toLowerCase().includes(q) ||
      (c.campaign || '').toLowerCase().includes(q) ||
      (c.fileName || '').toLowerCase().includes(q) ||
      String(c.fileId || '').includes(q)
    );
  }, [adsData, searchQuery]);

  const catInfo = adsData?.category || {
    id: 6,
    name: 'Reklam',
    metadataFields: [
      { id: 46, name: 'Şirket - Marka Adı' },
      { id: 16, name: 'Ajans' },
      { id: 11, name: 'Üretici' },
      { id: 13, name: 'Onay Durumu' },
      { id: 24, name: 'Yayın Tarihi' },
      { id: 42, name: 'İçerik Sorumlusu' }
    ]
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* RAMAZAN ÖZEL PLANLAMA TARİHLERİ & OTOMATİK 2 HAFTA ÖNCEDEN GÖSTERİM AYARI */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          padding: '20px 24px',
          borderRadius: '16px',
          border: '1.5px solid rgba(217, 119, 6, 0.4)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(217, 119, 6, 0.16)',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}
            >
              
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                Ramazan Özel Planlama Tarihleri (Başlangıçtan {ramadanConfig?.leadDays ?? 14} Gün / 2 Hafta Önce Otomatik Açılır)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Tarih girilmediğinde veya Ramazan başlangıcına 2 haftadan fazla süre varken Yayın Planlama ve Reklam ekranlarında <strong>&ldquo;Ramazan Özel&rdquo;</strong> işaretleri gizlenir.
              </div>
            </div>
          </div>

          <span
            style={{
              padding: '5px 12px',
              borderRadius: '999px',
              fontSize: '11.5px',
              fontWeight: '800',
              background: isRamadanActiveNow ? 'rgba(16, 185, 129, 0.14)' : 'rgba(100, 116, 139, 0.15)',
              color: isRamadanActiveNow ? '#10b981' : 'var(--text-secondary)',
              border: `1px solid ${isRamadanActiveNow ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-color)'}`
            }}
          >
            {isRamadanActiveNow ? '● Şu An Yayın & Reklamlarda Aktif' : '○ Şu An Gizli (2 Hafta Kala Açılır)'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '175px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-secondary)' }}>Ramazan Başlangıç Tarihi</label>
            <input
              type="date"
              value={ramadanConfig?.startDate || ''}
              onChange={e => setRamadanConfig({ startDate: e.target.value })}
              style={{
                padding: '8px 11px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: '700'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '175px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-secondary)' }}>Ramazan Bitiş Tarihi</label>
            <input
              type="date"
              value={ramadanConfig?.endDate || ''}
              onChange={e => setRamadanConfig({ endDate: e.target.value })}
              style={{
                padding: '8px 11px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: '700'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '165px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-secondary)' }}>Önceden Gösterim (Gün)</label>
            <input
              type="number"
              min="1"
              max="60"
              value={ramadanConfig?.leadDays ?? 14}
              onChange={e => setRamadanConfig({ leadDays: Math.max(1, parseInt(e.target.value, 10) || 14) })}
              style={{
                padding: '8px 11px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: '700'
              }}
            />
          </div>

          {(ramadanConfig?.startDate || ramadanConfig?.endDate) && (
            <button
              type="button"
              onClick={() => setRamadanConfig({ startDate: '', endDate: '', forceShow: false })}
              style={{
                padding: '8px 13px',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                height: '36px'
              }}
            >
              Tarihleri Temizle (Gizle)
            </button>
          )}
        </div>
      </div>

      {/* Üst Başlık ve Kategori Bilgisi */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        background: 'var(--bg-secondary)',
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        gap: '20px',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <div style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: 'white',
              padding: '8px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <PlaySquare size={22} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
              Reklam Yönetimi
            </h2>
            <span style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '800',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              fontFamily: 'monospace'
            }}>
              Kategori #{catInfo.id} — {catInfo.name}
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '760px', lineHeight: '1.5' }}>
            MSSQL Libero MAM veritabanındaki <strong>Reklam (#6)</strong> kategorisi yalnızca bu alanda çekilir. Clean, cln ve kullanma ibareli dosyalar otomatik filtrelenerek marka ve kampanya bazında gruplandırılır.
          </p>

          {/* Kategori Metadata Alanları Şeması */}
          {catInfo.metadataFields && catInfo.metadataFields.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                Tanımlı Kategori Metadataları ({catInfo.metadataFields.length}):
              </span>
              {catInfo.metadataFields.map(mf => {
                const mId = mf.id || mf.metadataId;
                const mName = mf.name || mf.displayName;
                return (
                  <span
                    key={mId}
                    style={{
                      fontSize: '10px',
                      fontWeight: '600',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    {mName} <span style={{ opacity: 0.6, fontFamily: 'monospace' }}>(#{mId})</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={fetchAdsArchive}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            padding: '10px 16px',
            borderRadius: '10px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: '700'
          }}
        >
          <RefreshCw size={15} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
          <span>DB'den Yenile</span>
        </button>
      </div>

      {/* İstatistik Kartları */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px'
      }}>
        <div style={{
          background: 'var(--bg-secondary)',
          padding: '16px 20px',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            padding: '12px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FileVideo size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>
              Toplam Reklam Spotu
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
              {(adsData?.totalAds || 0).toLocaleString('tr-TR')} Spot
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-secondary)',
          padding: '16px 20px',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            background: 'rgba(59, 130, 246, 0.15)',
            color: '#3b82f6',
            padding: '12px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Building2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>
              Şirket / Marka Grubu
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#3b82f6', marginTop: '2px' }}>
              {(adsData?.totalBrands || 0).toLocaleString('tr-TR')} Marka
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-secondary)',
          padding: '16px 20px',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            padding: '12px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>
              Toplam Reklam Havuzu Süresi
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#10b981', marginTop: '2px', fontFamily: 'monospace' }}>
              {adsData?.totalDurationFormatted || '00.00.00.00'}
            </div>
          </div>
        </div>
      </div>

      {/* Arama ve Görünüm Modu Çubuğu */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'var(--bg-secondary)',
          padding: '10px 16px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          flex: 1,
          minWidth: '260px'
        }}>
          <Search size={16} color="var(--text-secondary)" />
          <input
            type="text"
            placeholder="Marka adı, reklam spotu, kampanya veya MAM ID ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '13px',
              width: '100%'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Görünüm Modu Seçici */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-secondary)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          gap: '4px'
        }}>
          <button
            onClick={() => setViewMode('brands')}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: 'none',
              background: viewMode === 'brands' ? 'var(--accent-primary)' : 'transparent',
              color: viewMode === 'brands' ? '#fff' : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Marka Grupları ({filteredBrands.length})
          </button>
          <button
            onClick={() => setViewMode('spots')}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: 'none',
              background: viewMode === 'spots' ? 'var(--accent-primary)' : 'transparent',
              color: viewMode === 'spots' ? '#fff' : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Tüm Reklam Spotları ({filteredSpots.length})
          </button>
        </div>
      </div>

      {/* İçerik Alanı */}
      {isLoading ? (
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          padding: '60px 20px',
          textAlign: 'center',
          color: 'var(--text-secondary)'
        }}>
          <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }} />
          <div style={{ fontSize: '14px', fontWeight: '700' }}>Reklam arşivi MSSQL veritabanından yükleniyor...</div>
        </div>
      ) : viewMode === 'brands' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredBrands.map(group => {
            const isExpanded = !!expandedBrands[group.brand];
            return (
              <div
                key={group.brand}
                style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden'
                }}
              >
                <div
                  onClick={() => toggleBrandExpand(group.brand)}
                  style={{
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'rgba(239, 68, 68, 0.12)',
                      color: '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '14px'
                    }}>
                      <Building2 size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                        {group.brand}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Kategori #6 (Reklam) • {group.totalClips || group.spotsCount || 0} Reklam Spotu
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#10b981', fontFamily: 'monospace' }}>
                        {group.totalDurationFormatted}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Toplam Süre</div>
                    </div>
                    <button
                      style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <span>Spotlar ({group.totalClips || group.spotsCount || 0})</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 20px 16px 20px', borderTop: '1px solid var(--border-color)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '12px' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px' }}>Kampanya / Spot Detayı</th>
                          <th style={{ padding: '8px 12px' }}>MAM Klip Adı</th>
                          <th style={{ padding: '8px 12px', width: '100px' }}>MAM ID</th>
                          <th style={{ padding: '8px 12px', width: '120px' }}>Süre</th>
                          <th style={{ padding: '8px 12px', width: '120px' }}>Kayıt Tarihi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(group.clips || group.spots || []).map(spot => (
                          <tr key={spot.fileId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '8px 12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                              {spot.campaign || spot.name}
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                              <div>{spot.name}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{spot.fileName}</div>
                            </td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                              #{spot.fileId}
                            </td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: '700', color: '#10b981' }}>
                              {spot.durationFormatted}
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                              {formatDate(spot.fileCreateTime)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 14px' }}>Marka / Şirket</th>
                <th style={{ padding: '10px 14px' }}>Kampanya / Spot</th>
                <th style={{ padding: '10px 14px' }}>MAM Klip Adı</th>
                <th style={{ padding: '10px 14px', width: '90px' }}>MAM ID</th>
                <th style={{ padding: '10px 14px', width: '120px' }}>Süre</th>
                <th style={{ padding: '10px 14px', width: '120px' }}>Kayıt Tarihi</th>
              </tr>
            </thead>
            <tbody>
              {filteredSpots.map(spot => (
                <tr key={spot.fileId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      color: '#ef4444',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700'
                    }}>
                      {spot.brand}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {spot.campaign || spot.name}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                    <div>{spot.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{spot.fileName}</div>
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    #{spot.fileId}
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: '700', color: '#10b981' }}>
                    {spot.durationFormatted}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                    {formatDate(spot.fileCreateTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdsTab;
