/**
 * @file src/components/Ads/ProductsTab.jsx
 * @description Modern SaaS Temalı, O(N) İndeksli ve Sayfalamalı Ürünler & Markalar Sekmesi.
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Package,
  Film,
  Building2,
  Search,
  Calendar,
  FileBarChart2,
  FilterX
} from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import ProductForm from './ProductForm';
import AdsPaginationBar from './AdsPaginationBar';
import useDialogStore from '../../store/dialogStore';

function formatTurkishDate(dateStr = '') {
  if (!dateStr) return '-';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

const ProductsTab = ({ setActiveTab }) => {
  const products = usePlanningStore(state => state.products || []);
  const companies = usePlanningStore(state => state.companies || []);
  const materials = usePlanningStore(state => state.materials || []);
  const adFilters = usePlanningStore(state => state.adFilters || {});
  const removeProduct = usePlanningStore(state => state.removeProduct);
  const setAdFilters = usePlanningStore(state => state.setAdFilters);
  const setSelectedCompanyDetailId = usePlanningStore(state => state.setSelectedCompanyDetailId);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('lastUploadDesc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const rawFilterCompanyId = adFilters?.companyId || '';
  const filterCompanyId = useMemo(() => {
    if (!rawFilterCompanyId) return '';
    return companies.some(c => String(c.id) === String(rawFilterCompanyId)) ? String(rawFilterCompanyId) : '';
  }, [rawFilterCompanyId, companies]);

  const sortedCompanies = useMemo(
    () => [...companies].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr')),
    [companies]
  );

  // O(N) tek geçişli zenginleştirme
  const enrichedProducts = useMemo(() => {
    const compMap = new Map(companies.map(c => [String(c.id), c]));
    const matsByProd = new Map();

    for (let i = 0; i < materials.length; i++) {
      const m = materials[i];
      const pId = String(m.productId || '');
      if (!pId) continue;
      let arr = matsByProd.get(pId);
      if (!arr) {
        arr = [];
        matsByProd.set(pId, arr);
      }
      arr.push(m);
    }

    return products.map(p => {
      const comp = compMap.get(String(p.companyId));
      const pMats = matsByProd.get(String(p.id)) || [];

      let lastUploadDate = p.lastUploadDate || '';
      let lastUploadTimestamp = Number(p.lastUploadTimestamp) || 0;
      let totalDurationSec = 0;
      let latestClipName = '';

      for (let i = 0; i < pMats.length; i++) {
        const m = pMats[i];
        totalDurationSec += Number(m.duration) || 30;
        const ts = Number(m.uploadTimestamp) || Date.parse(`${m.uploadDate || '2024-01-01'}T00:00:00Z`) || 0;
        if (ts >= lastUploadTimestamp) {
          lastUploadTimestamp = ts;
          lastUploadDate = m.uploadDate || lastUploadDate;
          latestClipName = m.name || m.clipName || latestClipName;
        }
      }

      return {
        ...p,
        companyName: comp?.name || p.companyName || 'Genel Reklamveren',
        materialCount: pMats.length || p.materialCount || 0,
        latestClipName: latestClipName || '-',
        totalDurationSec: totalDurationSec || p.totalDurationSec || 0,
        lastUploadDate: lastUploadDate || '2024-01-01',
        lastUploadTimestamp
      };
    });
  }, [products, companies, materials]);

  const filteredAndSorted = useMemo(() => {
    let list = enrichedProducts;

    if (filterCompanyId) {
      list = list.filter(p => String(p.companyId) === String(filterCompanyId));
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLocaleLowerCase('tr-TR').trim();
      list = list.filter(
        p =>
          (p.name || '').toLocaleLowerCase('tr-TR').includes(q) ||
          (p.companyName || '').toLocaleLowerCase('tr-TR').includes(q) ||
          (p.latestClipName || '').toLocaleLowerCase('tr-TR').includes(q)
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
        case 'companyAsc':
          return (
            (a.companyName || '').localeCompare(b.companyName || '', 'tr') ||
            (a.name || '').localeCompare(b.name || '', 'tr')
          );
        case 'nameAsc':
          return (a.name || '').localeCompare(b.name || '', 'tr');
        case 'nameDesc':
          return (b.name || '').localeCompare(a.name || '', 'tr');
        default:
          return 0;
      }
    });

    return sorted;
  }, [enrichedProducts, filterCompanyId, searchTerm, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCompanyId, sortBy, pageSize]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, currentPage, pageSize]);

  const handleDelete = (prod, e) => {
    if (e) e.stopPropagation();
    useDialogStore
      .getState()
      .showConfirm(
        'Ürünü Sil',
        `"${prod.name}" ürününü silmek istediğinize emin misiniz?`,
        () => removeProduct(prod.id)
      );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* MODERN SAAS ÜST ARAÇ ÇUBUĞU */}
      <div className="ads-saas-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
            Ürünler &amp; Markalar
          </span>
          <span className="ads-saas-chip active" style={{ cursor: 'default' }}>
            {filteredAndSorted.length} / {products.length} Ürün
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '200px', maxWidth: '280px', flex: 1 }}>
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
              placeholder="Ürün, marka veya firma adı ara..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="ads-saas-input"
              style={{ width: '100%', paddingLeft: '30px' }}
            />
          </div>

          <select
            value={filterCompanyId}
            onChange={e => setAdFilters({ ...adFilters, companyId: e.target.value, productId: '' })}
            className="ads-saas-select"
            style={{ maxWidth: '210px' }}
          >
            <option value="">Tüm Firmalar ({companies.length})</option>
            {sortedCompanies.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="ads-saas-select"
          >
            <option value="lastUploadDesc">Son Yüklenen</option>
            <option value="lastUploadAsc">En Eski Yüklenen</option>
            <option value="materialsDesc">Materyal Sayısı (Çok → Az)</option>
            <option value="companyAsc">Firma Adı (A → Z)</option>
            <option value="nameAsc">Ürün Adı (A → Z)</option>
            <option value="nameDesc">Ürün Adı (Z → A)</option>
          </select>

          {(filterCompanyId || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setAdFilters({ companyId: '', productId: '' });
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
            setEditingProduct(null);
            setIsFormOpen(true);
          }}
          className="ads-saas-btn ads-saas-btn-primary"
        >
          <Plus size={14} /> Yeni Ürün Ekle
        </button>
      </div>

      {/* MODERN SAAS TABLO + SAYFALAMA */}
      <div className="ads-saas-table-wrap">
        <div className="ads-saas-table-scroll">
          <table className="ads-saas-table" style={{ minWidth: '940px' }}>
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '11%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>#</th>
                <th>Ürün / Kampanya Adı</th>
                <th>Bağlı Firma</th>
                <th>Materyaller (Klipler)</th>
                <th>Son Yükleme</th>
                <th>Süre</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map((p, index) => {
                const rowNumber = (currentPage - 1) * pageSize + index + 1;
                return (
                  <tr
                    key={p.id}
                    onClick={() => {
                      setAdFilters({ companyId: p.companyId, productId: p.id });
                      if (setActiveTab) setActiveTab('materials');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ fontWeight: '700', color: 'var(--ads-text-muted)', fontSize: '11.5px' }}>
                      {rowNumber}
                    </td>

                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', maxWidth: '100%' }}>
                        <div
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '7px',
                            background: 'rgba(245, 158, 11, 0.14)',
                            color: '#d97706',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <Package size={13} />
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
                          title={p.name}
                        >
                          {p.name}
                        </span>
                      </div>
                    </td>

                    <td
                      onClick={e => {
                        e.stopPropagation();
                        setAdFilters({ companyId: p.companyId, productId: '' });
                      }}
                    >
                      <span className="ads-saas-chip" style={{ padding: '3px 9px', fontSize: '11.5px' }}>
                        <Building2 size={11} color="var(--ads-brand)" />
                        {p.companyName}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span className="ads-saas-chip active" style={{ padding: '2px 8px', fontSize: '11px' }}>
                          <Film size={11} />
                          {p.materialCount} Materyal (Klip)
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
                          {p.latestClipName}
                        </span>
                      </div>
                    </td>

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
                        {formatTurkishDate(p.lastUploadDate)}
                      </span>
                    </td>

                    <td style={{ fontWeight: '700', color: 'var(--ads-teal)', fontSize: '12px' }}>
                      {p.totalDurationSec} sn
                    </td>

                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            if (p.companyId) {
                              setSelectedCompanyDetailId(p.companyId);
                              if (setActiveTab) setActiveTab('company-details');
                            }
                          }}
                          className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                          title="Firma Reklam Karnesi"
                        >
                          <FileBarChart2 size={12} /> Rapor
                        </button>

                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setEditingProduct(p);
                            setIsFormOpen(true);
                          }}
                          className="ads-saas-btn ads-saas-btn-sm"
                          style={{ padding: '5px 7px' }}
                          title="Düzenle"
                        >
                          <Edit2 size={12} />
                        </button>

                        <button
                          type="button"
                          onClick={e => handleDelete(p, e)}
                          className="ads-saas-btn ads-saas-btn-sm"
                          style={{ padding: '5px 7px', color: '#ef4444' }}
                          title="Sil"
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
                    Arama kriterlerinize uygun ürün veya marka bulunamadı.
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
          itemLabel="ürün"
        />
      </div>

      {isFormOpen && (
        <ProductForm
          onClose={() => {
            setIsFormOpen(false);
            setEditingProduct(null);
          }}
          existingData={editingProduct}
          defaultCompanyId={filterCompanyId}
        />
      )}
    </div>
  );
};

export default React.memo(ProductsTab);
