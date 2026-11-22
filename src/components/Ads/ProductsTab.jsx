/**
 * @file src/components/Ads/ProductsTab.jsx
 * @description Kurumsal Flexbox Tablo Mimarili, O(N) İndeksli ve Sayfalamalı Ürünler Sekmesi.
 * Ekrana %100 sığan esnek (Flex) satır yapısı ve üst özet KPI kartlarıyla tüm ürünleri listeler.
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
  FilterX,
  Clock
} from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import ProductForm from './ProductForm';
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

  const kpiStats = useMemo(() => {
    const uniqueCompSet = new Set(enrichedProducts.map(p => String(p.companyId)).filter(Boolean));
    const totalSec = enrichedProducts.reduce((acc, p) => acc + (Number(p.totalDurationSec) || 0), 0);
    return {
      totalProducts: products.length,
      companiesWithProducts: uniqueCompSet.size || companies.length,
      totalMaterials: materials.length,
      totalMinutes: Math.round(totalSec / 60)
    };
  }, [enrichedProducts, products.length, companies.length, materials.length]);

  const filteredAndSorted = useMemo(() => {
    let list = enrichedProducts;

    if (filterCompanyId) {
      list = list.filter(p => String(p.companyId) === String(filterCompanyId));
    }

    if (searchTerm.trim()) {
      return filterAndSortPrefixFirst(
        list,
        searchTerm,
        p => p?.name || '',
        p => `${p?.companyName || ''} ${p?.latestClipName || ''}`
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
          <div className="ta-icon-box warning" style={{ width: '42px', height: '42px' }}>
            <Package size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Toplam Ürün</div>
            <div style={{ fontSize: '19px', fontWeight: '900', color: 'var(--ads-text-main)' }}>
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
          <div className="ta-icon-box brand" style={{ width: '42px', height: '42px' }}>
            <Building2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Bağlı Firma</div>
            <div style={{ fontSize: '19px', fontWeight: '900', color: 'var(--ads-brand)' }}>
              {kpiStats.companiesWithProducts} Firma
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
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Toplam Materyal</div>
            <div style={{ fontSize: '19px', fontWeight: '900', color: '#0284c7' }}>
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
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Toplam Arşiv Süresi</div>
            <div style={{ fontSize: '19px', fontWeight: '900', color: '#059669' }}>
              {kpiStats.totalMinutes} Dakika
            </div>
          </div>
        </div>
      </div>

      {/* 2. FİLTRE VE ARAMA ARAÇ ÇUBUĞU (FLEXBOX) */}
      <div className="ads-saas-toolbar" style={{ padding: '14px 18px', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '15px', fontWeight: '900', color: 'var(--ads-text-main)' }}>
            Ürünler
          </span>
          <span className="ads-saas-chip active" style={{ cursor: 'default', fontWeight: '800' }}>
            {filteredAndSorted.length} / {products.length} Ürün
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flex: '1 1 420px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '210px', maxWidth: '300px', flex: 1 }}>
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
              placeholder="Ürün veya firma adı ara..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="ads-saas-input"
              style={{ width: '100%', paddingLeft: '32px' }}
            />
          </div>

          <select
            value={filterCompanyId}
            onChange={e => setAdFilters({ ...adFilters, companyId: e.target.value, productId: '' })}
            className="ads-saas-select"
            style={{ maxWidth: '220px' }}
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
          <Plus size={15} /> Yeni Ürün Ekle
        </button>
      </div>

      {/* 3. EKRANA %100 SIĞAN ESNEK (FLEXBOX) KURUMSAL ÜRÜNLER TABLOSU */}
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
          <div style={{ flex: '2 1 210px', minWidth: '165px' }}>Ürün Adı</div>
          <div style={{ flex: '1.6 1 180px', minWidth: '150px' }}>Bağlı Firma</div>
          <div style={{ flex: '1.5 1 170px', minWidth: '145px' }}>Materyaller</div>
          <div style={{ flex: '0.9 1 105px', minWidth: '95px' }}>Son Yükleme</div>
          <div style={{ flex: '0.7 1 85px', minWidth: '75px' }}>Toplam Süre</div>
          <div style={{ width: '165px', textAlign: 'right', flexShrink: 0 }}>İşlemler</div>
        </div>

        {/* Flex Tablo Satırları */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {paginatedProducts.map((p, index) => {
            const rowNumber = (currentPage - 1) * pageSize + index + 1;
            return (
              <div
                key={p.id}
                onClick={() => {
                  setAdFilters({ companyId: p.companyId, productId: p.id });
                  if (setActiveTab) setActiveTab('materials');
                }}
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

                {/* Ürün Adı */}
                <div
                  style={{
                    flex: '2 1 210px',
                    minWidth: '165px',
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
                      background: 'rgba(245, 158, 11, 0.14)',
                      color: '#d97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Package size={16} />
                  </div>
                  <span
                    style={{
                      fontWeight: '800',
                      color: 'var(--ads-text-main)',
                      fontSize: '13.5px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={p.name}
                  >
                    {p.name}
                  </span>
                </div>

                {/* Bağlı Firma */}
                <div
                  onClick={e => {
                    e.stopPropagation();
                    setAdFilters({ companyId: p.companyId, productId: '' });
                  }}
                  style={{ flex: '1.6 1 180px', minWidth: '150px' }}
                  title="Bu firmanın tüm ürünlerini filtrele"
                >
                  <span className="ads-saas-chip" style={{ padding: '4px 10px', fontSize: '12px', fontWeight: '700', maxWidth: '100%' }}>
                    <Building2 size={12} color="var(--ads-brand)" style={{ flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.companyName}
                    </span>
                  </span>
                </div>

                {/* Materyaller */}
                <div
                  style={{
                    flex: '1.5 1 170px',
                    minWidth: '145px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '3px'
                  }}
                >
                  <span className="ads-saas-chip active" style={{ padding: '3px 10px', fontSize: '11.5px', fontWeight: '700' }}>
                    <Film size={12} />
                    <span>{p.materialCount} Materyal</span>
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
                    {p.latestClipName}
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
                    <span>{formatTurkishDate(p.lastUploadDate)}</span>
                  </span>
                </div>

                {/* Toplam Süre */}
                <div style={{ flex: '0.7 1 85px', minWidth: '75px', fontWeight: '800', color: '#0d9488', fontSize: '12.5px' }}>
                  {p.totalDurationSec} sn
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
                    onClick={() => {
                      if (p.companyId) {
                        setSelectedCompanyDetailId(p.companyId);
                        if (setActiveTab) setActiveTab('company-details');
                      }
                    }}
                    className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                    title="Firma Detay Karnesi"
                  >
                    <FileBarChart2 size={13} />
                    <span>Rapor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(p);
                      setIsFormOpen(true);
                    }}
                    className="ads-saas-btn ads-saas-btn-sm"
                    style={{ padding: '6px 8px' }}
                    title="Ürünü Düzenle"
                  >
                    <Edit2 size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={e => handleDelete(p, e)}
                    className="ads-saas-btn ads-saas-btn-danger ads-saas-btn-sm"
                    style={{ padding: '6px 8px' }}
                    title="Ürünü Sil"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredAndSorted.length === 0 && (
            <div style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--ads-text-muted)', fontSize: '13.5px' }}>
              Arama kriterlerinize uygun ürün bulunamadı.
            </div>
          )}
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
