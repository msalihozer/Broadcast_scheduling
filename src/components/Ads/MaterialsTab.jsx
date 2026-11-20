/**
 * @file src/components/Ads/MaterialsTab.jsx
 * @description Modern SaaS Temalı, O(N) İndeksli, Sayfalamalı ve H.264 Canlı Video Oynatıcılı Reklam Materyalleri Sekmesi.
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
  FilterX
} from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import MaterialForm from './MaterialForm';
import AdVideoPlayer from './AdVideoPlayer';
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

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState(null);
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
        productName: prod?.name || m.productName || 'Genel Kampanya',
        uploadDate,
        uploadTimestamp,
        durationSec,
        totalSpots: bStat.spots,
        totalBroadcastSec: bStat.totalSec
      };
    });
  }, [materials, companies, products, broadcastStatsByMat]);

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
        `"${mat.name}" klibini silmek istediğinize emin misiniz?`,
        () => {
          removeMaterial(mat.id);
          if (String(selectedMaterialId) === String(mat.id)) {
            setSelectedMaterialId(null);
          }
        }
      );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* MODERN SAAS ÜST ARAÇ ÇUBUĞU */}
      <div className="ads-saas-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
            Reklam Materyalleri (Spotlar)
          </span>
          <span className="ads-saas-chip active" style={{ cursor: 'default' }}>
            {filteredAndSorted.length} / {materials.length} Klip
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: 1, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '185px', maxWidth: '250px', flex: 1 }}>
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
              placeholder="Materyal, kod, firma ara..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="ads-saas-input"
              style={{ width: '100%', paddingLeft: '30px' }}
            />
          </div>

          <select
            value={filterCompanyId}
            onChange={e => setAdFilters({ companyId: e.target.value, productId: '' })}
            className="ads-saas-select"
            style={{ maxWidth: '175px' }}
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
            style={{ maxWidth: '175px' }}
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
          <Plus size={14} /> Yeni Materyal
        </button>
      </div>

      {/* ANA İÇERİK: TABLO + YAN VİDEO ÖNİZLEME PANELİ */}
      <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0 }}>
        <div className="ads-saas-table-wrap">
          <div className="ads-saas-table-scroll">
            <table className="ads-saas-table" style={{ minWidth: '940px' }}>
              <colgroup>
                <col style={{ width: '8%' }} />
                <col style={{ width: '24%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '11%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Klip ID</th>
                  <th>Materyal / Klip Adı</th>
                  <th>Bağlı Firma</th>
                  <th>Bağlı Ürün</th>
                  <th>Yükleme</th>
                  <th>Süre</th>
                  <th>Yayın</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMaterials.map(m => {
                  const isSelected = String(selectedMaterialId) === String(m.id);
                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSelectedMaterialId(m.id)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'var(--ads-brand-soft)' : undefined
                      }}
                    >
                      <td>
                        <span className="ads-saas-chip active" style={{ padding: '2px 7px', fontFamily: 'monospace' }}>
                          #{m.clipId}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', maxWidth: '100%' }}>
                          <Film size={14} color={isSelected ? 'var(--ads-brand)' : 'var(--ads-text-muted)'} style={{ flexShrink: 0 }} />
                          <div style={{ minWidth: 0, textAlign: 'center' }}>
                            <div
                              style={{
                                fontWeight: '700',
                                color: 'var(--ads-text-main)',
                                fontSize: '12px',
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
                                fontSize: '10px',
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
                      </td>

                      <td>
                        <span
                          onClick={e => {
                            e.stopPropagation();
                            setAdFilters({ companyId: m.companyId, productId: '' });
                          }}
                          className="ads-saas-chip"
                          style={{ padding: '2px 8px', fontSize: '11px', maxWidth: '100%' }}
                        >
                          <Building2 size={11} color="var(--ads-brand)" style={{ flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.companyName}
                          </span>
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11.5px',
                            fontWeight: '600',
                            color: 'var(--ads-text-sub)',
                            maxWidth: '100%'
                          }}
                        >
                          <Package size={11} color="#d97706" style={{ flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.productName}
                          </span>
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            color: 'var(--ads-text-sub)'
                          }}
                        >
                          <Calendar size={11} color="var(--ads-brand)" />
                          {formatTurkishDate(m.uploadDate)}
                        </span>
                      </td>

                      <td style={{ fontWeight: '800', color: 'var(--ads-teal)', fontSize: '12px' }}>
                        {m.durationSec} sn
                      </td>

                      <td style={{ fontWeight: '700', color: 'var(--ads-orange)', fontSize: '11.5px' }}>
                        {m.totalSpots > 0 ? `${m.totalSpots}x` : '-'}
                      </td>

                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedMaterialId(m.id);
                            }}
                            className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                            title="Klibi Oynat"
                          >
                            <PlayCircle size={12} /> Oynat
                          </button>

                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setEditingMaterial(m);
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
                            onClick={e => handleDelete(m, e)}
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
                    <td colSpan="8" style={{ padding: '40px', color: 'var(--ads-text-muted)' }}>
                      Arama kriterlerinize uygun reklam materyali bulunamadı.
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
            itemLabel="materyal"
          />
        </div>

        {/* SAĞ: CANLI H.264 VİDEO OYNATICI VE KÜNYE PANELİ */}
        {selectedMaterial && (
          <div
            className="ads-saas-card"
            style={{
              width: '390px',
              flexShrink: 0,
              padding: '14px',
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
                <Edit2 size={14} /> Klibi Düzenle
              </button>
            </div>

            <div
              style={{
                background: 'var(--ads-card-subtle)',
                border: '1px solid var(--ads-border)',
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
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
                  <div style={{ fontWeight: '800', color: 'var(--ads-teal)' }}>{selectedMaterial.durationSec} Saniye</div>
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
    </div>
  );
};

export default React.memo(MaterialsTab);
