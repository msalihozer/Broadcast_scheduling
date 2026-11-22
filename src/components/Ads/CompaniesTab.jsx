/**
 * @file src/components/Ads/CompaniesTab.jsx
 * @description Kurumsal Flexbox Tablo Mimarili, O(N) İndeksli ve Sayfalamalı Firmalar Sekmesi.
 * Ekrana %100 sığan esnek (Flex) satır yapısı ve üst özet KPI kartlarıyla tüm firmaları listeler.
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Building2,
  Package,
  Film,
  Search,
  Calendar,
  FileBarChart2,
  Tv,
  Clock
} from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import CompanyForm from './CompanyForm';
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

const CompaniesTab = ({ setActiveTab }) => {
  const companies = usePlanningStore(state => state.companies || []);
  const products = usePlanningStore(state => state.products || []);
  const materials = usePlanningStore(state => state.materials || []);
  const adPlacements = usePlanningStore(state => state.adPlacements || {});
  const removeCompany = usePlanningStore(state => state.removeCompany);
  const setAdFilters = usePlanningStore(state => state.setAdFilters);
  const setSelectedCompanyDetailId = usePlanningStore(state => state.setSelectedCompanyDetailId);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('lastUploadDesc');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'activeBroadcast' | 'multiClip'
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // O(N) Yayın istatistiği haritası
  const broadcastStatsByComp = useMemo(() => {
    const map = new Map();
    const matMap = new Map();
    for (let i = 0; i < materials.length; i++) {
      const m = materials[i];
      matMap.set(String(m.id), m);
      if (m.clipId) matMap.set(String(m.clipId), m);
    }

    Object.values(adPlacements || {}).forEach(blocks => {
      if (!Array.isArray(blocks)) return;
      blocks.forEach(b => {
        (b.ads || []).forEach(ad => {
          if (ad?.isBumperAd) return;
          const mat = matMap.get(String(ad.materialId));
          const cId = String(mat?.companyId || ad.companyId || '');
          if (!cId) return;
          const prev = map.get(cId) || { spots: 0, totalSec: 0 };
          prev.spots += 1;
          prev.totalSec += Number(ad.duration || mat?.duration || 30);
          map.set(cId, prev);
        });
      });
    });
    return map;
  }, [adPlacements, materials]);

  // O(N) Ürün ve Materyal gruplaması
  const enrichedCompanies = useMemo(() => {
    const prodsByComp = new Map();
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const key = String(p.companyId || '');
      if (!key) continue;
      let arr = prodsByComp.get(key);
      if (!arr) {
        arr = [];
        prodsByComp.set(key, arr);
      }
      arr.push(p);
    }

    const matsByComp = new Map();
    for (let i = 0; i < materials.length; i++) {
      const m = materials[i];
      const key = String(m.companyId || '');
      if (!key) continue;
      let arr = matsByComp.get(key);
      if (!arr) {
        arr = [];
        matsByComp.set(key, arr);
      }
      arr.push(m);
    }

    return companies.map(c => {
      const cId = String(c.id);
      const compProds = prodsByComp.get(cId) || [];
      const compMats = matsByComp.get(cId) || [];
      const bStat = broadcastStatsByComp.get(cId) || { spots: 0, totalSec: 0 };

      let lastUploadDate = c.lastUploadDate || '';
      let lastUploadTimestamp = Number(c.lastUploadTimestamp) || 0;
      let totalDurationSec = 0;
      let latestClipName = '';

      for (let i = 0; i < compMats.length; i++) {
        const m = compMats[i];
        totalDurationSec += Number(m.duration) || 30;
        const ts = Number(m.uploadTimestamp) || Date.parse(`${m.uploadDate || '2024-01-01'}T00:00:00Z`) || 0;
        if (ts >= lastUploadTimestamp) {
          lastUploadTimestamp = ts;
          lastUploadDate = m.uploadDate || lastUploadDate;
          latestClipName = m.name || m.clipName || latestClipName;
        }
      }

      const productNamesPreview = compProds
        .slice(0, 2)
        .map(p => p.name)
        .filter(Boolean)
        .join(', ');

      return {
        ...c,
        productCount: compProds.length || c.productCount || 0,
        productNamesPreview: productNamesPreview || 'Genel Ürün',
        materialCount: compMats.length || c.materialCount || 0,
        latestClipName: latestClipName || '-',
        totalDurationSec: totalDurationSec || c.totalDurationSec || 0,
        lastUploadDate: lastUploadDate || '2024-01-01',
        lastUploadTimestamp,
        broadcastSpots: bStat.spots,
        broadcastSec: bStat.totalSec
      };
    });
  }, [companies, products, materials, broadcastStatsByComp]);

  const kpiStats = useMemo(() => {
    const activeInBroadcast = enrichedCompanies.filter(c => c.broadcastSpots > 0).length;
    const multiMatCount = enrichedCompanies.filter(c => c.materialCount >= 2).length;
    return {
      totalCompanies: companies.length,
      activeInBroadcast,
      multiMatCount,
      totalProducts: products.length,
      totalMaterials: materials.length
    };
  }, [enrichedCompanies, companies.length, products.length, materials.length]);

  const filteredAndSorted = useMemo(() => {
    let list = enrichedCompanies;

    if (filterMode === 'activeBroadcast') {
      list = list.filter(c => c.broadcastSpots > 0);
    } else if (filterMode === 'multiClip') {
      list = list.filter(c => c.materialCount >= 2);
    }

    if (searchTerm.trim()) {
      return filterAndSortPrefixFirst(
        list,
        searchTerm,
        c => c?.name || '',
        c => `${c?.shortName || ''} ${c?.productNamesPreview || ''} ${c?.latestClipName || ''}`
      );
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'lastUploadDesc':
          return (
            (b.lastUploadTimestamp || 0) - (a.lastUploadTimestamp || 0) ||
            b.materialCount - a.materialCount ||
            (a.name || '').localeCompare(b.name || '', 'tr')
          );
        case 'lastUploadAsc':
          return (
            (a.lastUploadTimestamp || 0) - (b.lastUploadTimestamp || 0) ||
            (a.name || '').localeCompare(b.name || '', 'tr')
          );
        case 'materialsDesc':
          return b.materialCount - a.materialCount || (a.name || '').localeCompare(b.name || '', 'tr');
        case 'productsDesc':
          return b.productCount - a.productCount || (a.name || '').localeCompare(b.name || '', 'tr');
        case 'spotsDesc':
          return b.broadcastSpots - a.broadcastSpots || b.materialCount - a.materialCount;
        case 'nameAsc':
          return (a.name || '').localeCompare(b.name || '', 'tr');
        case 'nameDesc':
          return (b.name || '').localeCompare(a.name || '', 'tr');
        default:
          return 0;
      }
    });

    return sorted;
  }, [enrichedCompanies, filterMode, searchTerm, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterMode, sortBy, pageSize]);

  const paginatedCompanies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, currentPage, pageSize]);

  const handleDelete = (company, e) => {
    if (e) e.stopPropagation();
    useDialogStore
      .getState()
      .showConfirm(
        'Firmayı Sil',
        `"${company.name}" firmasını silmek istediğinize emin misiniz?`,
        () => removeCompany(company.id)
      );
  };

  const openCompanyDetail = (companyId) => {
    setSelectedCompanyDetailId(companyId);
    if (setActiveTab) setActiveTab('company-details');
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
          <div className="ta-icon-box brand" style={{ width: '42px', height: '42px' }}>
            <Building2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Toplam Firma</div>
            <div style={{ fontSize: '19px', fontWeight: '900', color: 'var(--ads-text-main)' }}>
              {kpiStats.totalCompanies} Firma
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
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Yayında Aktif Firma</div>
            <div style={{ fontSize: '19px', fontWeight: '900', color: '#059669' }}>
              {kpiStats.activeInBroadcast} Firma
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
            <Package size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Kayıtlı Ürünler</div>
            <div style={{ fontSize: '19px', fontWeight: '900', color: '#d97706' }}>
              {kpiStats.totalProducts} Ürün
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
          <div className="ta-icon-box info" style={{ width: '42px', height: '42px' }}>
            <Film size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Kayıtlı Materyaller</div>
            <div style={{ fontSize: '19px', fontWeight: '900', color: '#0284c7' }}>
              {kpiStats.totalMaterials} Materyal
            </div>
          </div>
        </div>
      </div>

      {/* 2. FİLTRE VE ARAMA ARAÇ ÇUBUĞU (FLEXBOX) */}
      <div className="ads-saas-toolbar" style={{ padding: '14px 18px', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '15px', fontWeight: '900', color: 'var(--ads-text-main)' }}>
            Firmalar
          </span>
          <span className="ads-saas-chip active" style={{ cursor: 'default', fontWeight: '800' }}>
            {filteredAndSorted.length} / {companies.length} Firma
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flex: '1 1 420px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '220px', maxWidth: '320px', flex: 1 }}>
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
              placeholder="Firma, ürün veya materyal ara..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="ads-saas-input"
              style={{ width: '100%', paddingLeft: '32px' }}
            />
          </div>

          <div className="ads-saas-pill-group" style={{ padding: '3px' }}>
            {[
              { id: 'all', label: 'Tümü' },
              { id: 'multiClip', label: 'Çoklu Materyal' },
              { id: 'activeBroadcast', label: 'Yayında Olanlar' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={`ads-saas-pill-btn ${filterMode === tab.id ? 'active' : ''}`}
                style={{ padding: '5px 11px', fontSize: '12px' }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="ads-saas-select"
          >
            <option value="lastUploadDesc">Son Yüklenen</option>
            <option value="lastUploadAsc">En Eski Yüklenen</option>
            <option value="materialsDesc">Materyal Sayısı (Çok → Az)</option>
            <option value="productsDesc">Ürün Sayısı (Çok → Az)</option>
            <option value="spotsDesc">En Çok Yayınlanan</option>
            <option value="nameAsc">Firma Adı (A → Z)</option>
            <option value="nameDesc">Firma Adı (Z → A)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingCompany(null);
            setIsFormOpen(true);
          }}
          className="ads-saas-btn ads-saas-btn-primary"
        >
          <Plus size={15} /> Yeni Firma Ekle
        </button>
      </div>

      {/* 3. EKRANA %100 SIĞAN ESNEK (FLEXBOX) KURUMSAL FİRMALAR TABLOSU */}
      <div className="ads-saas-table-wrap" style={{ overflow: 'hidden' }}>
        {/* Flex Tablo Başlığı */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '13px 18px',
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
          <div style={{ width: '42px', flexShrink: 0 }}>#</div>
          <div style={{ flex: '2 1 200px', minWidth: '160px' }}>Firma Adı</div>
          <div style={{ flex: '1.4 1 160px', minWidth: '140px' }}>Ürünler</div>
          <div style={{ flex: '1.5 1 170px', minWidth: '145px' }}>Materyaller</div>
          <div style={{ flex: '0.9 1 105px', minWidth: '95px' }}>Son Yükleme</div>
          <div style={{ flex: '0.9 1 105px', minWidth: '95px' }}>Süre &amp; Yayın</div>
          <div style={{ width: '165px', textAlign: 'right', flexShrink: 0 }}>İşlemler</div>
        </div>

        {/* Flex Tablo Satırları */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {paginatedCompanies.map((c, index) => {
            const rowNumber = (currentPage - 1) * pageSize + index + 1;
            return (
              <div
                key={c.id}
                onClick={() => openCompanyDetail(c.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '13px 18px',
                  borderBottom: '1px solid var(--ads-border)',
                  cursor: 'pointer',
                  flexWrap: 'wrap',
                  transition: 'background 0.14s ease'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ads-row-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Sıra No */}
                <div
                  style={{
                    width: '42px',
                    flexShrink: 0,
                    fontWeight: '800',
                    color: 'var(--ads-text-muted)',
                    fontSize: '12px'
                  }}
                >
                  {rowNumber}
                </div>

                {/* Firma Adı */}
                <div
                  style={{
                    flex: '2 1 200px',
                    minWidth: '160px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '9px',
                      background: 'var(--ads-brand-soft)',
                      color: 'var(--ads-brand)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Building2 size={16} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontWeight: '800',
                        color: 'var(--ads-text-main)',
                        fontSize: '13.5px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={c.name}
                    >
                      {c.name}
                    </div>
                    {c.shortName && c.shortName !== c.name && (
                      <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>{c.shortName}</div>
                    )}
                  </div>
                </div>

                {/* Ürünler */}
                <div
                  onClick={e => {
                    e.stopPropagation();
                    setAdFilters({ companyId: c.id, productId: '' });
                    if (setActiveTab) setActiveTab('products');
                  }}
                  style={{
                    flex: '1.4 1 160px',
                    minWidth: '140px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '3px'
                  }}
                  title="Bu firmanın ürünlerini görüntüle"
                >
                  <span className="ads-saas-chip" style={{ padding: '3px 10px', fontSize: '11.5px', fontWeight: '700' }}>
                    <Package size={12} color="#d97706" />
                    <span>{c.productCount} Ürün</span>
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--ads-text-muted)',
                      maxWidth: '100%',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {c.productNamesPreview}
                  </span>
                </div>

                {/* Materyaller */}
                <div
                  onClick={e => {
                    e.stopPropagation();
                    setAdFilters({ companyId: c.id, productId: '' });
                    if (setActiveTab) setActiveTab('materials');
                  }}
                  style={{
                    flex: '1.5 1 170px',
                    minWidth: '145px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '3px'
                  }}
                  title="Bu firmanın materyallerini görüntüle"
                >
                  <span className="ads-saas-chip active" style={{ padding: '3px 10px', fontSize: '11.5px', fontWeight: '700' }}>
                    <Film size={12} />
                    <span>{c.materialCount} Materyal</span>
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--ads-text-muted)',
                      maxWidth: '100%',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {c.latestClipName}
                  </span>
                </div>

                {/* Son Yükleme */}
                <div style={{ flex: '0.9 1 105px', minWidth: '95px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: 'var(--ads-text-sub)'
                    }}
                  >
                    <Calendar size={13} color="var(--ads-brand)" />
                    <span>{formatTurkishDate(c.lastUploadDate)}</span>
                  </span>
                </div>

                {/* Süre / Yayın */}
                <div style={{ flex: '0.9 1 105px', minWidth: '95px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '800', color: '#0d9488', fontSize: '12.5px' }}>
                    <Clock size={12} />
                    <span>{c.totalDurationSec} sn</span>
                  </div>
                  {c.broadcastSpots > 0 ? (
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#d97706' }}>
                      {c.broadcastSpots} kez yayında
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>Arşivde</span>
                  )}
                </div>

                {/* İşlemler */}
                <div
                  style={{
                    width: '165px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '6px',
                    marginLeft: 'auto'
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => openCompanyDetail(c.id)}
                    className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                    title="Firma Detay Karnesi & Video Önizleme"
                  >
                    <FileBarChart2 size={13} />
                    <span>Detay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingCompany(c);
                      setIsFormOpen(true);
                    }}
                    className="ads-saas-btn ads-saas-btn-sm"
                    style={{ padding: '6px 8px' }}
                    title="Firmayı Düzenle"
                  >
                    <Edit2 size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={e => handleDelete(c, e)}
                    className="ads-saas-btn ads-saas-btn-danger ads-saas-btn-sm"
                    style={{ padding: '6px 8px' }}
                    title="Firmayı Sil"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredAndSorted.length === 0 && (
            <div style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--ads-text-muted)', fontSize: '13.5px' }}>
              Arama kriterlerinize uygun firma bulunamadı.
            </div>
          )}
        </div>

        <AdsPaginationBar
          totalItems={filteredAndSorted.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="firma"
        />
      </div>

      {isFormOpen && (
        <CompanyForm
          onClose={() => {
            setIsFormOpen(false);
            setEditingCompany(null);
          }}
          existingData={editingCompany}
        />
      )}
    </div>
  );
};

export default React.memo(CompaniesTab);
