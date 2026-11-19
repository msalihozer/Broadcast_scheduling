/**
 * @file src/components/Ads/AdsPaginationBar.jsx
 * @description Modern SaaS tablo sayfalama çubuğu (binlerce satırın DOM'u kasmasını engeller).
 */
import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const AdsPaginationBar = ({
  totalItems = 0,
  currentPage = 1,
  pageSize = 50,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'kayıt'
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(totalItems, safePage * pageSize);

  // Görünür sayfa numaraları (en fazla 5 buton)
  const pageNumbers = [];
  let startP = Math.max(1, safePage - 2);
  let endP = Math.min(totalPages, startP + 4);
  if (endP - startP < 4) {
    startP = Math.max(1, endP - 4);
  }
  for (let p = startP; p <= endP; p++) {
    pageNumbers.push(p);
  }

  const handlePageSelect = (nextPage) => {
    onPageChange(nextPage);
    requestAnimationFrame(() => {
      const adminScrollEl = document.getElementById('admin-panel-scroll-container');
      if (adminScrollEl) {
        adminScrollEl.scrollTo({ top: 0, behavior: 'smooth' });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  return (
    <div className="ads-saas-pagination">
      <div className="ads-saas-pagination-info">
        Toplam <strong>{totalItems.toLocaleString('tr-TR')}</strong> {itemLabel}tan{' '}
        <strong>
          {startIdx} – {endIdx}
        </strong>{' '}
        arası gösteriliyor
      </div>

      <div className="ads-saas-pagination-controls">
        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '8px' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)' }}>Sayfa başına:</span>
            <select
              value={pageSize}
              onChange={e => onPageSizeChange(Number(e.target.value))}
              className="ads-saas-select"
              style={{ padding: '4px 8px', height: '28px', fontSize: '11.5px' }}
            >
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        )}

        <button
          type="button"
          className="ads-saas-page-btn"
          disabled={safePage <= 1}
          onClick={() => handlePageSelect(1)}
          title="İlk Sayfa"
        >
          <ChevronsLeft size={14} />
        </button>
        <button
          type="button"
          className="ads-saas-page-btn"
          disabled={safePage <= 1}
          onClick={() => handlePageSelect(safePage - 1)}
          title="Önceki Sayfa"
        >
          <ChevronLeft size={14} />
        </button>

        {pageNumbers.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => handlePageSelect(p)}
            className={`ads-saas-page-btn ${p === safePage ? 'active' : ''}`}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          className="ads-saas-page-btn"
          disabled={safePage >= totalPages}
          onClick={() => handlePageSelect(safePage + 1)}
          title="Sonraki Sayfa"
        >
          <ChevronRight size={14} />
        </button>
        <button
          type="button"
          className="ads-saas-page-btn"
          disabled={safePage >= totalPages}
          onClick={() => handlePageSelect(totalPages)}
          title="Son Sayfa"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default React.memo(AdsPaginationBar);

