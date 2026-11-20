/**
 * @file src/components/Ads/CompaniesTab.jsx
 * @description Modern SaaS Temalı, O(N) İndeksli ve Sayfalamalı (Paginated) Reklamveren Firmalar Sekmesi.
 * 828+ firmayı sıfır kasma ile listeler; her firmanın Ürün & Markalarını ve Materyallerini doğrudan gösterir.
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
  FileBarChart2
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

  // O(N) Ürün ve Materyal gruplaması (2.1 milyon döngü yerine tek geçiş)
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
        productNamesPreview: productNamesPreview || 'Genel Kampanya',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* MODERN SAAS ÜST ARAÇ ÇUBUĞU */}
      <div className="ads-saas-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
            Reklamveren Firmalar
          </span>
          <span className="ads-saas-chip active" style={{ cursor: 'default' }}>
            {filteredAndSorted.length} / {companies.length} Firma
          </span>
        </div>

        {/* Arama + Filtre + Sıralama */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '210px', maxWidth: '300px', flex: 1 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--ads-text-muted)'
              }}
            />
            <input
              type="text"
              placeholder="Firma, ürün veya klip ara..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="ads-saas-input"
              style={{ width: '100%', paddingLeft: '30px' }}
            />
          </div>

          <div className="ads-saas-pill-group" style={{ padding: '2px' }}>
            {[
              { id: 'all', label: 'Tümü' },
              { id: 'multiClip', label: 'Çoklu Spot' },
              { id: 'activeBroadcast', label: 'Yayında' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={`ads-saas-pill-btn ${filterMode === tab.id ? 'active' : ''}`}
                style={{ padding: '4px 10px', fontSize: '11.5px' }}
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
          <Plus size={14} /> Yeni Firma Ekle
        </button>
      </div>

      {/* MODERN SAAS TABLO + SAYFALAMA */}
      <div className="ads-saas-table-wrap">
        <div className="ads-saas-table-scroll">
          <table className="ads-saas-table" style={{ minWidth: '960px' }}>
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '21%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '11%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>#</th>
                <th>Firma Adı</th>
                <th>Ürünler &amp; Markalar</th>
                <th>Materyaller (Klipler)</th>
                <th>Son Yükleme</th>
                <th>Süre / Yayın</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCompanies.map((c, index) => {
                const rowNumber = (currentPage - 1) * pageSize + index + 1;
                return (
                  <tr
                    key={c.id}
                    onClick={() => openCompanyDetail(c.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ fontWeight: '700', color: 'var(--ads-text-muted)', fontSize: '11.5px' }}>
                      {rowNumber}
                    </td>

                    {/* Firma Adı */}
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', maxWidth: '100%' }}>
                        <div
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '7px',
                            background: 'var(--ads-brand-soft)',
                            color: 'var(--ads-brand)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <Building2 size={13} />
                        </div>
                        <span
                          style={{
                            fontWeight: '700',
                            color: 'var(--ads-text-main)',
                            fontSize: '12.5px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          title={c.name}
                        >
                          {c.name}
                        </span>
                      </div>
                    </td>

                    {/* Ürünler & Markalar */}
                    <td
                      onClick={e => {
                        e.stopPropagation();
                        setAdFilters({ companyId: c.id, productId: '' });
                        if (setActiveTab) setActiveTab('products');
                      }}
                      title="Bu firmanın ürün ve markalarını aç"
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span className="ads-saas-chip" style={{ padding: '2px 8px', fontSize: '11px' }}>
                          <Package size={11} color="#d97706" />
                          {c.productCount} Ürün / Marka
                        </span>
                        <span
                          style={{
                            fontSize: '10.5px',
                            color: 'var(--ads-text-muted)',
                            maxWidth: '95%',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {c.productNamesPreview}
                        </span>
                      </div>
                    </td>

                    {/* Materyaller */}
                    <td
                      onClick={e => {
                        e.stopPropagation();
                        setAdFilters({ companyId: c.id, productId: '' });
                        if (setActiveTab) setActiveTab('materials');
                      }}
                      title="Bu firmanın reklam kliplerini aç"
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span
                          className="ads-saas-chip active"
                          style={{ padding: '2px 8px', fontSize: '11px' }}
                        >
                          <Film size={11} />
                          {c.materialCount} Materyal (Klip)
                        </span>
                        <span
                          style={{
                            fontSize: '10.5px',
                            color: 'var(--ads-text-muted)',
                            maxWidth: '95%',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {c.latestClipName}
                        </span>
                      </div>
                    </td>

                    {/* Son Yükleme */}
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          color: 'var(--ads-text-sub)'
                        }}
                      >
                        <Calendar size={11} color="var(--ads-brand)" />
                        {formatTurkishDate(c.lastUploadDate)}
                      </span>
                    </td>

                    {/* Süre / Yayın */}
                    <td>
                      <div style={{ fontWeight: '700', color: 'var(--ads-teal)', fontSize: '12px' }}>
                        {c.totalDurationSec} sn
                      </div>
                      {c.broadcastSpots > 0 && (
                        <div style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--ads-orange)' }}>
                          {c.broadcastSpots} yayın
                        </div>
                      )}
                    </td>

                    {/* İşlemler */}
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            openCompanyDetail(c.id);
                          }}
                          className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                          title="Firma Reklam Karnesi & Video Önizleme"
                        >
                          <FileBarChart2 size={12} /> Detay
                        </button>

                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setEditingCompany(c);
                            setIsFormOpen(true);
                          }}
                          className="ads-saas-btn ads-saas-btn-sm"
                          style={{ padding: '5px 7px' }}
                          title="Firmayı Düzenle"
                        >
                          <Edit2 size={12} />
                        </button>

                        <button
                          type="button"
                          onClick={e => handleDelete(c, e)}
                          className="ads-saas-btn ads-saas-btn-sm"
                          style={{ padding: '5px 7px', color: '#ef4444' }}
                          title="Firmayı Sil"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredAndSorted.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ padding: '40px', color: 'var(--ads-text-muted)' }}>
                    Arama kriterlerinize uygun firma bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
