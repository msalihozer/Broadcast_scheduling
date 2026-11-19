/**
 * @file src/pages/admin/archive/ArchivePaginationBar.jsx
 * @description MAM Arşiv Analizi Sekmesi alt sayfalama (pagination) çubuğu.
 * Toplam program sayısı, gösterilen aralık ve sayfa geçiş butonlarını sunar.
 */
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const ArchivePaginationBar = ({
  currentPage,
  totalPages,
  pageSize,
  totalItemsCount,
  onPageChange
}) => {
  if (totalPages <= 1) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'var(--bg-secondary)',
      padding: '14px 20px',
      borderRadius: '12px',
      border: '1px solid var(--border-color)',
      marginTop: '6px',
      flexWrap: 'wrap',
      gap: '10px'
    }}>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        Toplam <strong>{totalItemsCount}</strong> programdan{' '}
        <strong>{((currentPage - 1) * pageSize) + 1}</strong> -{' '}
        <strong>{Math.min(currentPage * pageSize, totalItemsCount)}</strong> arası gösteriliyor
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: currentPage === 1 ? 'transparent' : 'var(--bg-tertiary)',
            color: currentPage === 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: '600'
          }}
        >
          <ChevronLeft size={15} /> Önceki
        </button>

        {Array.from({ length: totalPages }, (_, idx) => idx + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
          .map((p, idx, arr) => {
            const prev = arr[idx - 1];
            const showEllipsis = prev && p - prev > 1;
            return (
              <React.Fragment key={p}>
                {showEllipsis && (
                  <span style={{ padding: '0 4px', color: 'var(--text-secondary)', fontSize: '12px' }}>…</span>
                )}
                <button
                  onClick={() => onPageChange(p)}
                  style={{
                    minWidth: '32px',
                    height: '30px',
                    padding: '0 8px',
                    borderRadius: '8px',
                    border: currentPage === p ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    background: currentPage === p ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    color: currentPage === p ? '#fff' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '700'
                  }}
                >
                  {p}
                </button>
              </React.Fragment>
            );
          })}

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: currentPage === totalPages ? 'transparent' : 'var(--bg-tertiary)',
            color: currentPage === totalPages ? 'var(--text-secondary)' : 'var(--text-primary)',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: '600'
          }}
        >
          Sonraki <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default ArchivePaginationBar;

