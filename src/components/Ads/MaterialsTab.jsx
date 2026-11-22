/**
 * @file src/components/Ads/MaterialsTab.jsx
 * @description Kurumsal Flexbox Tablo Mimarili, O(N) İndeksli, Sayfalamalı ve Canlı Video Oynatıcılı Materyaller Sekmesi.
 * Ekrana %100 sığan esnek (Flex) satır yapısı sayesinde yan video önizleme paneli açıkken bile taşma yapmaz.
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Film,
  PlayCircle,
  X,
  Search,
  Building2,
  Package,
  Calendar,
  FileBarChart2,
  FilterX,
  Info,
  Clock,
  Tv
} from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import MaterialForm from './MaterialForm';
import AdVideoPlayer from './AdVideoPlayer';
import AdMaterialDetailModal from './AdMaterialDetailModal';
import AdsPaginationBar from './AdsPaginationBar';
import useDialogStore from '../../store/dialogStore';
import { filterAndSortPrefixFirst } from './reservation/reservationConstants';

function formatTurkishDate(dateStr = '') {
  if (!dateStr) return '-';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

const MaterialsTab = ({ setActiveTab }) => {
  const materials = usePlanningStore(state => state.materials || []);
  const products = usePlanningStore(state => state.products || []);
  const companies = usePlanningStore(state => state.companies || []);
  const adPlacements = usePlanningStore(state => state.adPlacements || {});
  const adFilters = usePlanningStore(state => state.adFilters || {});
  const removeMaterial = usePlanningStore(state => state.removeMaterial);
  const setAdFilters = usePlanningStore(state => state.setAdFilters);
  const setSelectedCompanyDetailId = usePlanningStore(state => state.setSelectedCompanyDetailId);
  const setSelectedMaterialDetailId = usePlanningStore(state => state.setSelectedMaterialDetailId);

  const reservations = usePlanningStore(state => state.reservations || []);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState(null);
  const [detailModalMaterial, setDetailModalMaterial] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDuration, setFilterDuration] = useState('all'); // 'all' | 'short' | 'medium' | 'long'
  const [sortBy, setSortBy] = useState('uploadDateDesc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const rawFilterCompanyId = adFilters?.companyId || '';
  const rawFilterProductId = adFilters?.productId || '';

  const filterCompanyId = useMemo(() => {
    if (!rawFilterCompanyId) return '';
    return companies.some(c => String(c.id) === String(rawFilterCompanyId)) ? String(rawFilterCompanyId) : '';
  }, [rawFilterCompanyId, companies]);

  const filterProductId = useMemo(() => {
    if (!rawFilterProductId) return '';
    return products.some(p => String(p.id) === String(rawFilterProductId)) ? String(rawFilterProductId) : '';
  }, [rawFilterProductId, products]);

  const broadcastStatsByMat = useMemo(() => {
    const map = new Map();
    Object.values(adPlacements || {}).forEach(blocks => {
      if (!Array.isArray(blocks)) return;
      blocks.forEach(b => {
        (b.ads || []).forEach(ad => {
          if (ad?.isBumperAd) return;
          const mId = String(ad.materialId || '');
          if (!mId) return;
          const prev = map.get(mId) || { spots: 0, totalSec: 0 };
          prev.spots += 1;
          prev.totalSec += Number(ad.duration) || 30;
          map.set(mId, prev);
        });
      });
    });
    return map;
  }, [adPlacements]);

  const enrichedMaterials = useMemo(() => {
    const compMap = new Map(companies.map(c => [String(c.id), c]));
    const prodMap = new Map(products.map(p => [String(p.id), p]));

    return materials.map(m => {
      const prod = prodMap.get(String(m.productId));
      const comp = compMap.get(String(m.companyId || prod?.companyId));
      const bStat =
        broadcastStatsByMat.get(String(m.id)) ||
        broadcastStatsByMat.get(String(m.clipId)) || { spots: 0, totalSec: 0 };

      const uploadDate = m.uploadDate || '2024-01-01';
      const uploadTimestamp =
        Number(m.uploadTimestamp) || Date.parse(`${uploadDate}T00:00:00Z`) || 0;
      const durationSec = Math.max(1, Math.round(Number(m.duration) || 30));

      return {
        ...m,
        clipId: m.clipId || m.id,
        companyId: comp?.id || m.companyId || prod?.companyId || '',
        companyName: comp?.name || m.companyName || 'Genel Reklamveren',
        productId: prod?.id || m.productId || '',
        productName: prod?.name || m.productName || 'Genel Ürün',
        uploadDate,
        uploadTimestamp,
        durationSec,
        totalSpots: bStat.spots,
        totalBroadcastSec: bStat.totalSec
      };
    });
  }, [materials, companies, products, broadcastStatsByMat]);

  const kpiStats = useMemo(() => {
    const activeBroadcastMats = enrichedMaterials.filter(m => m.totalSpots > 0).length;
    const totalArchiveSec = enrichedMaterials.reduce((acc, m) => acc + (Number(m.durationSec) || 0), 0);
    const avgDurationSec = enrichedMaterials.length > 0 ? Math.round(totalArchiveSec / enrichedMaterials.length) : 0;
    return {
      totalMaterials: materials.length,
      activeBroadcastMats,
      totalMinutes: Math.round(totalArchiveSec / 60),
      avgDurationSec
    };
  }, [enrichedMaterials, materials.length]);

  const sortedCompanies = useMemo(
    () => [...companies].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr')),
    [companies]
  );

  const availableProducts = useMemo(() => {
    const list = filterCompanyId
      ? products.filter(p => String(p.companyId) === String(filterCompanyId))
      : products;
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));
  }, [products, filterCompanyId]);

  const filteredAndSorted = useMemo(() => {
    let list = enrichedMaterials;

    if (filterCompanyId) {
      list = list.filter(m => String(m.companyId) === String(filterCompanyId));
    }
    if (filterProductId) {
      list = list.filter(m => String(m.productId) === String(filterProductId));
    }
    if (filterDuration === 'short') {
      list = list.filter(m => m.durationSec <= 20);
    } else if (filterDuration === 'medium') {
      list = list.filter(m => m.durationSec > 20 && m.durationSec <= 40);
    } else if (filterDuration === 'long') {
      list = list.filter(m => m.durationSec > 40);
    }

    if (searchTerm.trim()) {
      return filterAndSortPrefixFirst(
        list,
        searchTerm,
        m => m?.name || m?.clipName || '',
        m => `${m?.companyName || ''} ${m?.productName || ''} ${m?.clipName || ''} ${m?.code || ''}`
      );
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'uploadDateDesc':
          return (
            (b.uploadTimestamp || 0) - (a.uploadTimestamp || 0) ||
            (parseInt(b.clipId, 10) || 0) - (parseInt(a.clipId, 10) || 0)
          );
        case 'uploadDateAsc':
          return (
            (a.uploadTimestamp || 0) - (b.uploadTimestamp || 0) ||
            (parseInt(a.clipId, 10) || 0) - (parseInt(b.clipId, 10) || 0)
          );
        case 'durationDesc':
          return b.durationSec - a.durationSec || (a.name || '').localeCompare(b.name || '', 'tr');
        case 'durationAsc':
          return a.durationSec - b.durationSec || (a.name || '').localeCompare(b.name || '', 'tr');
        case 'spotsDesc':
          return b.totalSpots - a.totalSpots || b.totalBroadcastSec - a.totalBroadcastSec;
        case 'nameAsc':
          return (a.name || '').localeCompare(b.name || '', 'tr');
        case 'companyAsc':
          return (a.companyName || '').localeCompare(b.companyName || '', 'tr');
        case 'productAsc':
          return (a.productName || '').localeCompare(b.productName || '', 'tr');
        default:
          return 0;
      }
    });

    return sorted;
  }, [enrichedMaterials, filterCompanyId, filterProductId, filterDuration, searchTerm, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCompanyId, filterProductId, filterDuration, sortBy, pageSize]);

  const paginatedMaterials = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, currentPage, pageSize]);

  const selectedMaterial = useMemo(
    () => enrichedMaterials.find(m => String(m.id) === String(selectedMaterialId)) || null,
    [enrichedMaterials, selectedMaterialId]
  );

  const handleDelete = (mat, e) => {
    if (e) e.stopPropagation();
    useDialogStore
      .getState()
      .showConfirm(
        'Materyali Sil',
        `"${mat.name}" materyalini silmek istediğinize emin misiniz?`,
        () => {
          removeMaterial(mat.id);
          if (String(selectedMaterialId) === String(mat.id)) {
            setSelectedMaterialId(null);
          }
        }
      );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
      {/* 1. ÜST KURUMSAL KPI ÖZET ŞERİDİ (FLEXBOX) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        <div
          className="ta-card"
          style={{
            flex: '1 1 200px',
            padding: '14px 16px',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div className="ta-icon-box info" style={{ width: '42px', height: '42px' }}>
            <Film size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Toplam Materyal</div>
            <div style={{ fontSize: '19px', fontWeight: '900', color: 'var(--ads-text-main)' }}>
              {kpiStats.totalMaterials} Materyal
            </div>
          </div>
        </div>

        <div
          className="ta-card"
          style={{
            flex: '1 1 200px',
            padding: '14px 16px',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div className="ta-icon-box success" style={{ width: '42px', height: '42px' }}>
            <Tv size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Yayında Kullanılan</div>
            <div style={{ fontSize: '19px', fontWeight: '900', color: '#059669' }}>
              {kpiStats.activeBroadcastMats} Materyal
            </div>
          </div>
        </div>

        <div
          className="ta-card"
          style={{
            flex: '1 1 200px',
            padding: '14px 16px',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div className="ta-icon-box brand" style={{ width: '42px', height: '42px' }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Toplam Materyal Süresi</div>
            <div style={{ fontSize: '19px', fontWeight: '900', color: 'var(--ads-brand)' }}>
              {kpiStats.totalMinutes} Dakika
            </div>
          </div>
        </div>

        <div
          className="ta-card"
          style={{
            flex: '1 1 200px',
            padding: '14px 16px',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div className="ta-icon-box warning" style={{ width: '42px', height: '42px' }}>
            <PlayCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Ortalama Materyal Süresi</div>
            <div style={{ fontSize: '19px', fontWeight: '900', color: '#d97706' }}>
              {kpiStats.avgDurationSec} Saniye
            </div>
          </div>
        </div>
      </div>

      {/* 2. FİLTRE VE ARAMA ARAÇ ÇUBUĞU (FLEXBOX) */}
      <div className="ads-saas-toolbar" style={{ padding: '14px 18px', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '15px', fontWeight: '900', color: 'var(--ads-text-main)' }}>
            Materyaller
          </span>
          <span className="ads-saas-chip active" style={{ cursor: 'default', fontWeight: '800' }}>
            {filteredAndSorted.length} / {materials.length} Materyal
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flex: '1 1 520px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '190px', maxWidth: '260px', flex: 1 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '11px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--ads-text-muted)'
              }}
            />
            <input
              type="text"
              placeholder="Materyal, kod, firma ara..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="ads-saas-input"
              style={{ width: '100%', paddingLeft: '32px' }}
            />
          </div>

          <select
            value={filterCompanyId}
            onChange={e => setAdFilters({ companyId: e.target.value, productId: '' })}
            className="ads-saas-select"
            style={{ maxWidth: '185px' }}
          >
            <option value="">Tüm Firmalar ({companies.length})</option>
            {sortedCompanies.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={filterProductId}
            onChange={e => setAdFilters({ ...adFilters, productId: e.target.value })}
            className="ads-saas-select"
            style={{ maxWidth: '185px' }}
          >
            <option value="">Tüm Ürünler ({availableProducts.length})</option>
            {availableProducts.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={filterDuration}
            onChange={e => setFilterDuration(e.target.value)}
            className="ads-saas-select"
          >
            <option value="all">Tüm Süreler</option>
            <option value="short">Kısa (≤ 20 sn)</option>
            <option value="medium">Orta (21-40 sn)</option>
            <option value="long">Uzun (&gt; 40 sn)</option>
          </select>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="ads-saas-select"
          >
            <option value="uploadDateDesc">Son Yüklenen</option>
            <option value="uploadDateAsc">En Eski</option>
            <option value="durationDesc">Süre (Uzun → Kısa)</option>
            <option value="durationAsc">Süre (Kısa → Uzun)</option>
            <option value="spotsDesc">En Çok Yayınlanan</option>
            <option value="nameAsc">Materyal Adı (A → Z)</option>
          </select>

          {(filterCompanyId || filterProductId || filterDuration !== 'all' || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setAdFilters({ companyId: '', productId: '' });
                setFilterDuration('all');
                setSearchTerm('');
              }}
              className="ads-saas-btn ads-saas-btn-sm"
              style={{ color: '#ef4444' }}
            >
              <FilterX size={13} /> Temizle
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingMaterial(null);
            setIsFormOpen(true);
          }}
          className="ads-saas-btn ads-saas-btn-primary"
        >
          <Plus size={15} /> Yeni Materyal
        </button>
      </div>

      {/* 3. ANA İÇERİK: EKRANA %100 SIĞAN ESNEK (FLEXBOX) MATERYALLER TABLOSU + YAN VİDEO ÖNİZLEME PANELİ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
          width: '100%',
          minWidth: 0,
          flexWrap: 'wrap'
        }}
      >
        {/* SOL: ESNEK FLEXBOX TABLO */}
        <div
          className="ads-saas-table-wrap"
          style={{
            flex: '1 1 560px',
            minWidth: 0,
            overflow: 'hidden'
          }}
        >
          {/* Flex Tablo Başlığı */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '13px 16px',
              background: 'var(--ads-card-subtle)',
              borderBottom: '1.5px solid var(--ads-border)',
              fontSize: '11.5px',
              fontWeight: '800',
              color: 'var(--ads-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ width: '68px', flexShrink: 0 }}>Klip ID</div>
            <div style={{ flex: '2 1 190px', minWidth: '150px' }}>Materyal Adı &amp; Kodu</div>
            <div style={{ flex: '1.4 1 140px', minWidth: '120px' }}>Bağlı Firma</div>
            <div style={{ flex: '1.2 1 125px', minWidth: '110px' }}>Bağlı Ürün</div>
            <div style={{ width: '92px', flexShrink: 0 }}>Yükleme</div>
            <div style={{ width: '68px', flexShrink: 0 }}>Süre</div>
            <div style={{ width: '64px', flexShrink: 0 }}>Yayın</div>
            <div style={{ width: '190px', textAlign: 'right', flexShrink: 0, marginLeft: 'auto' }}>İşlemler</div>
          </div>

          {/* Flex Tablo Satırları */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {paginatedMaterials.map(m => {
              const isSelected = String(selectedMaterialId) === String(m.id);
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMaterialId(m.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--ads-border)',
                    cursor: 'pointer',
                    flexWrap: 'wrap',
                    background: isSelected ? 'var(--ads-brand-soft)' : 'transparent',
                    borderLeft: isSelected ? '4px solid var(--ads-brand)' : '4px solid transparent',
                    transition: 'background 0.14s ease'
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--ads-row-hover)';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* Klip ID */}
                  <div style={{ width: '68px', flexShrink: 0 }}>
                    <span
                      className="ads-saas-chip active"
                      style={{ padding: '2px 8px', fontFamily: 'monospace', fontSize: '11.5px', fontWeight: '800' }}
                    >
                      #{m.clipId}
                    </span>
                  </div>

                  {/* Materyal Adı & Kodu */}
                  <div
                    style={{
                      flex: '2 1 190px',
                      minWidth: '150px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '9px'
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: isSelected ? 'var(--ads-brand)' : 'rgba(14, 165, 233, 0.12)',
                        color: isSelected ? '#ffffff' : '#0284c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <Film size={15} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontWeight: '800',
                          color: 'var(--ads-text-main)',
                          fontSize: '13px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                        title={m.name}
                      >
                        {m.name}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--ads-text-muted)',
                          fontFamily: 'monospace',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {m.code}
                      </div>
                    </div>
                  </div>

                  {/* Bağlı Firma */}
                  <div style={{ flex: '1.4 1 140px', minWidth: '120px' }}>
                    <span
                      onClick={e => {
                        e.stopPropagation();
                        setAdFilters({ companyId: m.companyId, productId: '' });
                      }}
                      className="ads-saas-chip"
                      style={{ padding: '3px 9px', fontSize: '11.5px', fontWeight: '700', maxWidth: '100%' }}
                      title={m.companyName}
                    >
                      <Building2 size={11} color="var(--ads-brand)" style={{ flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.companyName}
                      </span>
                    </span>
                  </div>

                  {/* Bağlı Ürün */}
                  <div
                    style={{
                      flex: '1.2 1 125px',
                      minWidth: '110px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: 'var(--ads-text-sub)'
                    }}
                    title={m.productName}
                  >
                    <Package size={12} color="#d97706" style={{ flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.productName}
                    </span>
                  </div>

                  {/* Yükleme */}
                  <div style={{ width: '92px', flexShrink: 0 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        color: 'var(--ads-text-sub)'
                      }}
                    >
                      <Calendar size={11} color="var(--ads-brand)" />
                      <span>{formatTurkishDate(m.uploadDate)}</span>
                    </span>
                  </div>

                  {/* Süre */}
                  <div
                    style={{
                      width: '68px',
                      flexShrink: 0,
                      fontWeight: '900',
                      color: '#0d9488',
                      fontSize: '12.5px',
                      fontFamily: 'monospace'
                    }}
                  >
                    {m.durationSec} sn
                  </div>

                  {/* Yayın */}
                  <div style={{ width: '64px', flexShrink: 0 }}>
                    {m.totalSpots > 0 ? (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: 'rgba(217, 119, 6, 0.14)',
                          color: '#d97706',
                          fontSize: '11px',
                          fontWeight: '800'
                        }}
                      >
                        {m.totalSpots}x
                      </span>
                    ) : (
                      <span style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)' }}>-</span>
                    )}
                  </div>

                  {/* İşlemler */}
                  <div
                    style={{
                      width: '190px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '5px',
                      marginLeft: 'auto'
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setDetailModalMaterial(m)}
                      className="ads-saas-btn ads-saas-btn-sm"
                      style={{
                        padding: '5px 7px',
                        background: 'rgba(37, 99, 235, 0.12)',
                        border: '1px solid rgba(37, 99, 235, 0.35)',
                        color: '#2563eb'
                      }}
                      title="Materyal Detayları, Kare Analizi ve Video Önizleme (ⓘ)"
                    >
                      <Info size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMaterialId(m.id)}
                      className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                      title="Yan Panelde Oynat"
                    >
                      <PlayCircle size={12} />
                      <span>Oynat</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingMaterial(m);
                        setIsFormOpen(true);
                      }}
                      className="ads-saas-btn ads-saas-btn-sm"
                      style={{ padding: '5px 7px' }}
                      title="Materyali Düzenle"
                    >
                      <Edit2 size={12} />
                    </button>

                    <button
                      type="button"
                      onClick={e => handleDelete(m, e)}
                      className="ads-saas-btn ads-saas-btn-danger ads-saas-btn-sm"
                      style={{ padding: '5px 7px' }}
                      title="Materyali Sil"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredAndSorted.length === 0 && (
              <div style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--ads-text-muted)', fontSize: '13.5px' }}>
                Arama kriterlerinize uygun materyal bulunamadı.
              </div>
            )}
          </div>

          <AdsPaginationBar
            totalItems={filteredAndSorted.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="materyal"
          />
        </div>

        {/* SAĞ: CANLI H.264 VİDEO OYNATICI VE KÜNYE PANELİ */}
        {selectedMaterial && (
          <div
            className="ads-saas-card"
            style={{
              flex: '0 1 360px',
              width: '360px',
              maxWidth: '100%',
              position: 'sticky',
              top: '8px',
              padding: '15px',
              gap: '12px',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--ads-text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PlayCircle size={16} color="var(--ads-brand)" />
                Video Önizleme &amp; Künye
              </span>
              <button
                type="button"
                onClick={() => setSelectedMaterialId(null)}
                className="ads-saas-btn ads-saas-btn-sm"
                style={{ padding: '4px 6px' }}
              >
                <X size={14} />
              </button>
            </div>

            <AdVideoPlayer material={selectedMaterial} autoPlay={true} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  if (selectedMaterial.companyId) {
                    setSelectedCompanyDetailId(selectedMaterial.companyId);
                  }
                  setSelectedMaterialDetailId(selectedMaterial.id);
                  if (setActiveTab) setActiveTab('company-details');
                }}
                className="ads-saas-btn ads-saas-btn-primary"
              >
                <FileBarChart2 size={14} /> Firma Raporu
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingMaterial(selectedMaterial);
                  setIsFormOpen(true);
                }}
                className="ads-saas-btn"
              >
                <Edit2 size={14} /> Düzenle
              </button>
            </div>

            <div
              style={{
                background: 'var(--ads-card-subtle)',
                border: '1px solid var(--ads-border)',
                borderRadius: '10px',
                padding: '11px 13px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '12px'
              }}
            >
              <div>
                <div style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
                  Materyal Başlığı
                </div>
                <div style={{ fontWeight: '800', color: 'var(--ads-text-main)', marginTop: '2px' }}>
                  {selectedMaterial.name}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '6px', borderTop: '1px solid var(--ads-border)' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--ads-text-muted)', fontWeight: '700' }}>FİRMA</div>
                  <div style={{ fontWeight: '700', color: 'var(--ads-brand)' }}>{selectedMaterial.companyName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--ads-text-muted)', fontWeight: '700' }}>ÜRÜN</div>
                  <div style={{ fontWeight: '700', color: 'var(--ads-text-main)' }}>{selectedMaterial.productName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--ads-text-muted)', fontWeight: '700' }}>SÜRE</div>
                  <div style={{ fontWeight: '800', color: '#0d9488' }}>{selectedMaterial.durationSec} Saniye</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--ads-text-muted)', fontWeight: '700' }}>YÜKLEME</div>
                  <div style={{ fontWeight: '700', color: 'var(--ads-text-sub)' }}>
                    {formatTurkishDate(selectedMaterial.uploadDate)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isFormOpen && (
        <MaterialForm
          onClose={() => {
            setIsFormOpen(false);
            setEditingMaterial(null);
          }}
          existingData={editingMaterial}
          defaultCompanyId={filterCompanyId}
          defaultProductId={filterProductId}
        />
      )}

      {detailModalMaterial && (
        <AdMaterialDetailModal
          material={detailModalMaterial}
          onClose={() => setDetailModalMaterial(null)}
          companies={companies}
          products={products}
          materials={materials}
          reservations={reservations}
          adPlacements={adPlacements}
        />
      )}
    </div>
  );
};

export default React.memo(MaterialsTab);
