/**
 * @file src/components/Ads/MediaTab.jsx
 * @description Modern SaaS Temalı, Sayfalamalı ve H.264 Canlı Video Önizlemeli Medya Kütüphanesi Sekmesi.
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  PlayCircle,
  Film,
  X,
  Building2,
  Package,
  Calendar,
  ExternalLink
} from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import AdVideoPlayer from './AdVideoPlayer';
import AdsPaginationBar from './AdsPaginationBar';

function formatTurkishDate(dateStr = '') {
  if (!dateStr) return '-';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

const MediaTab = ({ setActiveTab }) => {
  const companies = usePlanningStore(state => state.companies || []);
  const products = usePlanningStore(state => state.products || []);
  const materials = usePlanningStore(state => state.materials || []);
  const adPlacements = usePlanningStore(state => state.adPlacements || {});
  const setSelectedCompanyDetailId = usePlanningStore(state => state.setSelectedCompanyDetailId);
  const setSelectedMaterialDetailId = usePlanningStore(state => state.setSelectedMaterialDetailId);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCompanyId, setFilterCompanyId] = useState('');
  const [filterProductId, setFilterProductId] = useState('');
  const [filterDuration, setFilterDuration] = useState('all');
  const [sortBy, setSortBy] = useState('uploadDateDesc');
  const [previewMedia, setPreviewMedia] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const broadcastStatsByMatId = useMemo(() => {
    const map = new Map();
    Object.values(adPlacements || {}).forEach(dayBlocks => {
      if (!Array.isArray(dayBlocks)) return;
      dayBlocks.forEach(block => {
        (block.ads || []).forEach(ad => {
          const mId = String(ad.materialId);
          const prev = map.get(mId) || { spots: 0, totalSec: 0 };
          prev.spots += 1;
          prev.totalSec += Number(ad.duration) || 0;
          map.set(mId, prev);
        });
      });
    });
    return map;
  }, [adPlacements]);

  const enrichedMediaList = useMemo(() => {
    const compMap = new Map(companies.map(c => [String(c.id), c]));
    const prodMap = new Map(products.map(p => [String(p.id), p]));

    return materials.map(m => {
      const prod = prodMap.get(String(m.productId));
      const comp = compMap.get(String(m.companyId || prod?.companyId));
      const bStat =
        broadcastStatsByMatId.get(String(m.id)) ||
        broadcastStatsByMatId.get(String(m.clipId)) || { spots: 0, totalSec: 0 };

      const uploadDate = m.uploadDate || '2024-06-01';
      const uploadTimestamp = Number(m.uploadTimestamp) || Date.parse(`${uploadDate}T00:00:00Z`) || 0;

      return {
        ...m,
        companyId: comp?.id || m.companyId || '',
        companyName: comp?.name || m.companyName || 'Genel Reklamveren',
        productId: prod?.id || m.productId || '',
        productName: prod?.name || m.productName || 'Genel Kampanya',
        uploadDate,
        uploadTimestamp,
        durationSec: Number(m.duration) || 30,
        broadcastSpots: bStat.spots,
        broadcastTotalSec: bStat.totalSec
      };
    });
  }, [materials, companies, products, broadcastStatsByMatId]);

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

  const filteredAndSortedMedia = useMemo(() => {
    let list = enrichedMediaList;

    if (filterCompanyId) {
      list = list.filter(item => String(item.companyId) === String(filterCompanyId));
    }
    if (filterProductId) {
      list = list.filter(item => String(item.productId) === String(filterProductId));
    }
    if (filterDuration === 'short') {
      list = list.filter(item => item.durationSec <= 20);
    } else if (filterDuration === 'medium') {
      list = list.filter(item => item.durationSec > 20 && item.durationSec <= 40);
    } else if (filterDuration === 'long') {
      list = list.filter(item => item.durationSec > 40);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLocaleLowerCase('tr-TR').trim();
      list = list.filter(item => {
        const hay = `${item.name} ${item.clipName} ${item.code} ${item.companyName} ${item.productName} ${item.clipId} ${item.uploadDate}`.toLocaleLowerCase('tr-TR');
        return hay.includes(q);
      });
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'uploadDateDesc':
          return (
            (b.uploadTimestamp || 0) - (a.uploadTimestamp || 0) ||
            (b.uploadDate || '').localeCompare(a.uploadDate || '')
          );
        case 'uploadDateAsc':
          return (
            (a.uploadTimestamp || 0) - (b.uploadTimestamp || 0) ||
            (a.uploadDate || '').localeCompare(b.uploadDate || '')
          );
        case 'companyAsc':
          return (a.companyName || '').localeCompare(b.companyName || '', 'tr');
        case 'productAsc':
          return (a.productName || '').localeCompare(b.productName || '', 'tr');
        case 'materialAsc':
          return (a.name || '').localeCompare(b.name || '', 'tr');
        case 'durationDesc':
          return b.durationSec - a.durationSec;
        case 'durationAsc':
          return a.durationSec - b.durationSec;
        case 'spotsDesc':
          return b.broadcastSpots - a.broadcastSpots || b.broadcastTotalSec - a.broadcastTotalSec;
        default:
          return 0;
      }
    });

    return sorted;
  }, [enrichedMediaList, filterCompanyId, filterProductId, filterDuration, searchTerm, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCompanyId, filterProductId, filterDuration, sortBy, pageSize]);

  const paginatedMedia = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedMedia.slice(start, start + pageSize);
  }, [filteredAndSortedMedia, currentPage, pageSize]);

  const navigateToDetailPage = (item) => {
    if (item.companyId) {
      setSelectedCompanyDetailId(item.companyId);
    }
    setSelectedMaterialDetailId(item.id);
    if (setActiveTab) {
      setActiveTab('company-details');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* MODERN SAAS ÜST ARAÇ ÇUBUĞU */}
      <div className="ads-saas-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
            Medya Kütüphanesi
          </span>
          <span className="ads-saas-chip active" style={{ cursor: 'default' }}>
            {filteredAndSortedMedia.length} / {enrichedMediaList.length} Klip
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
              placeholder="Firma, ürün, materyal veya kod ara..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="ads-saas-input"
              style={{ width: '100%', paddingLeft: '30px' }}
            />
          </div>

          <select
            value={filterCompanyId}
            onChange={e => {
              setFilterCompanyId(e.target.value);
              setFilterProductId('');
            }}
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
            onChange={e => setFilterProductId(e.target.value)}
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
            <option value="short">≤ 20 sn</option>
            <option value="medium">21 - 40 sn</option>
            <option value="long">&gt; 40 sn</option>
          </select>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="ads-saas-select"
          >
            <option value="uploadDateDesc">Yükleme: Yeni → Eski</option>
            <option value="uploadDateAsc">Yükleme: Eski → Yeni</option>
            <option value="spotsDesc">En Çok Yayınlanan</option>
            <option value="companyAsc">Firma: A → Z</option>
            <option value="productAsc">Ürün: A → Z</option>
            <option value="materialAsc">Materyal: A → Z</option>
            <option value="durationDesc">Süre: Uzun → Kısa</option>
          </select>
        </div>
      </div>

      {/* ANA İÇERİK: TABLO + SAĞ VİDEO ÖNİZLEME PANELİ */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div className="ads-saas-table-wrap" style={{ flex: 1, minWidth: 0 }}>
          <div className="ads-saas-table-scroll">
            <table className="ads-saas-table" style={{ minWidth: '940px' }}>
              <colgroup>
                <col style={{ width: '8%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Klip ID</th>
                  <th>Materyal / Klip Adı</th>
                  <th>Firma</th>
                  <th>Ürün</th>
                  <th>Yükleme</th>
                  <th>Süre</th>
                  <th>Yayın</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMedia.map(item => {
                  const isPreviewing = previewMedia && String(previewMedia.id) === String(item.id);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setPreviewMedia(item)}
                      style={{
                        cursor: 'pointer',
                        background: isPreviewing ? 'var(--ads-brand-soft)' : undefined
                      }}
                    >
                      <td>
                        <span className="ads-saas-chip active" style={{ padding: '2px 7px', fontFamily: 'monospace' }}>
                          #{item.clipId || item.id}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', maxWidth: '100%' }}>
                          <Film size={14} color={isPreviewing ? 'var(--ads-brand)' : 'var(--ads-text-muted)'} style={{ flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: '700',
                                color: 'var(--ads-text-main)',
                                fontSize: '12px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                              title={item.name}
                            >
                              {item.name}
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
                              {item.code}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          onClick={e => {
                            e.stopPropagation();
                            setFilterCompanyId(item.companyId);
                          }}
                          className="ads-saas-chip"
                          style={{ padding: '2px 8px', fontSize: '11px', maxWidth: '100%' }}
                        >
                          <Building2 size={11} color="var(--ads-brand)" style={{ flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.companyName}
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
                            {item.productName}
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
                          {formatTurkishDate(item.uploadDate)}
                        </span>
                      </td>

                      <td style={{ fontWeight: '800', color: 'var(--ads-teal)', fontSize: '12px' }}>
                        {item.durationSec} sn
                      </td>

                      <td style={{ fontWeight: '700', color: 'var(--ads-orange)', fontSize: '11.5px' }}>
                        {item.broadcastSpots > 0 ? `${item.broadcastSpots}x` : '-'}
                      </td>

                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setPreviewMedia(item);
                            }}
                            className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                          >
                            <PlayCircle size={12} /> Önizle
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              navigateToDetailPage(item);
                            }}
                            className="ads-saas-btn ads-saas-btn-sm"
                            style={{ padding: '5px 7px' }}
                            title="Firma Detay Raporu"
                          >
                            <ExternalLink size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredAndSortedMedia.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ padding: '40px', color: 'var(--ads-text-muted)' }}>
                      Arama kriterlerinize uygun medya klibi bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <AdsPaginationBar
            totalItems={filteredAndSortedMedia.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="medya klibi"
          />
        </div>

        {/* SAĞ: CANLI VİDEO ÖNİZLEME KARTI */}
        {previewMedia && (
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
                <Film size={16} color="var(--ads-brand)" />
                Video Önizleme &amp; Künye
              </span>
              <button
                type="button"
                onClick={() => setPreviewMedia(null)}
                className="ads-saas-btn ads-saas-btn-sm"
                style={{ padding: '4px 6px' }}
              >
                <X size={14} />
              </button>
            </div>

            <AdVideoPlayer material={previewMedia} autoPlay={true} />

            <div
              style={{
                background: 'var(--ads-card-subtle)',
                border: '1px solid var(--ads-border)',
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '12px'
              }}
            >
              <div>
                <div style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)', fontWeight: '700' }}>MATERYAL ADI</div>
                <div style={{ fontWeight: '800', color: 'var(--ads-text-main)', marginTop: '2px' }}>
                  {previewMedia.name}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '6px', borderTop: '1px solid var(--ads-border)' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--ads-text-muted)', fontWeight: '700' }}>FİRMA</div>
                  <div style={{ fontWeight: '700', color: 'var(--ads-brand)' }}>{previewMedia.companyName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--ads-text-muted)', fontWeight: '700' }}>ÜRÜN</div>
                  <div style={{ fontWeight: '700', color: 'var(--ads-text-main)' }}>{previewMedia.productName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--ads-text-muted)', fontWeight: '700' }}>SÜRE</div>
                  <div style={{ fontWeight: '800', color: 'var(--ads-teal)' }}>{previewMedia.durationSec} Saniye</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--ads-text-muted)', fontWeight: '700' }}>YÜKLEME</div>
                  <div style={{ fontWeight: '700', color: 'var(--ads-text-sub)' }}>
                    {formatTurkishDate(previewMedia.uploadDate)}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigateToDetailPage(previewMedia)}
              className="ads-saas-btn ads-saas-btn-primary"
              style={{ width: '100%' }}
            >
              Firma Detay &amp; Reklam Raporuna Git <ExternalLink size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(MediaTab);
