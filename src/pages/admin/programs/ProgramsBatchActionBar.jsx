/**
 * @file src/pages/admin/programs/ProgramsBatchActionBar.jsx
 * @description Programlar listesi için çoklu seçim, aralık seçimi (Shift+Click)
 * ve toplu işlem (Toplu Kullanıma Aç / Kaldır) kontrol çubuğu.
 */
import React from 'react';
import { 
  CheckSquare, Square, CheckCircle2, XCircle, 
  RefreshCw, Trash2, ArrowUpDown, Command, Tag
} from 'lucide-react';

export default function ProgramsBatchActionBar({
  selectedCount = 0,
  totalCount = 0,
  isAllSelected = false,
  onSelectAll,
  onDeselectAll,
  onInvertSelection,
  onBulkActivate,
  onBulkDeactivate,
  onBulkChangeCategory,
  availableCategories = [],
  onBulkDelete,
  isSubmitting = false
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      background: selectedCount > 0 ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-secondary)',
      border: selectedCount > 0 ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid var(--border-color)',
      padding: '12px 18px',
      borderRadius: '14px',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      flexWrap: 'wrap'
    }}>
      {/* Sol: Seçim butonları ve bilgi */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={isAllSelected ? onDeselectAll : onSelectAll}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: isAllSelected ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
            color: isAllSelected ? '#fff' : 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            padding: '7px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            transition: 'all 0.15s'
          }}
          title={isAllSelected ? 'Seçimi Kaldır (Esc)' : 'Tümünü Seç (Ctrl+A)'}
        >
          {isAllSelected ? <CheckSquare size={14} /> : <Square size={14} />}
          <span>{isAllSelected ? 'Tümünü Bırak' : 'Tümünü Seç'}</span>
        </button>

        <button
          onClick={onInvertSelection}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            padding: '7px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600'
          }}
          title="Seçili olanları kaldır, seçili olmayanları seç"
        >
          <ArrowUpDown size={13} />
          <span>Tersine Çevir</span>
        </button>

        {selectedCount > 0 && (
          <button
            onClick={onDeselectAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: 'none',
              padding: '6px 8px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500'
            }}
            title="Seçimi Temizle (Esc)"
          >
            <Trash2 size={13} />
            <span>Temizle</span>
          </button>
        )}

        <div style={{
          height: '20px',
          width: '1px',
          background: 'var(--border-color)',
          margin: '0 4px'
        }} />

        {/* Seçim Sayaç Rozeti */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          fontWeight: '700',
          color: selectedCount > 0 ? 'var(--accent-primary)' : 'var(--text-secondary)'
        }}>
          <span style={{
            background: selectedCount > 0 ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
            color: selectedCount > 0 ? '#fff' : 'var(--text-secondary)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: '800'
          }}>
            {selectedCount}
          </span>
          <span>/ {totalCount} program seçildi</span>
        </div>

        {/* Kısayol Bilgilendirme Rozeti */}
        <span style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          marginLeft: '6px',
          opacity: 0.8
        }}>
          <Command size={11} /> <strong>Shift + Tık:</strong> Seri Seçim | <strong>Ctrl+A:</strong> Tümü | <strong>Esc:</strong> Temizle
        </span>
      </div>

      {/* Sağ: Toplu Eylemler (Sadece seçim varsa aktif) */}
      {selectedCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {onBulkChangeCategory && availableCategories.length > 0 && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(59, 130, 246, 0.14)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#3b82f6',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '700'
            }}>
              <Tag size={13} />
              <select
                defaultValue=""
                disabled={isSubmitting}
                onChange={(e) => {
                  const nextCatId = parseInt(e.target.value, 10);
                  if (nextCatId) {
                    onBulkChangeCategory(nextCatId);
                    e.target.value = '';
                  }
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#3b82f6',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: isSubmitting ? 'wait' : 'pointer'
                }}
              >
                <option value="" disabled style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                  Seçilenlerin Kategorisini Değiştir ({selectedCount})...
                </option>
                {availableCategories.map(cat => (
                  <option
                    key={cat.id || cat.categoryId}
                    value={cat.id || cat.categoryId}
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  >
                    #{cat.id || cat.categoryId} {cat.name || cat.categoryName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={onBulkActivate}
            disabled={isSubmitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '700',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
              transition: 'transform 0.1s'
            }}
            title="Seçilen programları yayında kullanıma aç"
          >
            {isSubmitting ? (
              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <CheckCircle2 size={14} />
            )}
            <span>Toplu Kullanıma Aç ({selectedCount})</span>
          </button>

          <button
            onClick={onBulkDeactivate}
            disabled={isSubmitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '700',
              transition: 'background 0.15s'
            }}
            title="Seçilen programları kullanımdan kaldır (pasif yap)"
          >
            {isSubmitting ? (
              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <XCircle size={14} />
            )}
            <span>Toplu Kullanımdan Kaldır ({selectedCount})</span>
          </button>

          {onBulkDelete && (
            <button
              onClick={onBulkDelete}
              disabled={isSubmitting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                padding: '8px 14px',
                borderRadius: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: '700',
                transition: 'background 0.15s'
              }}
              title="Seçilen programları sil (İçindeki klipler silinmez, Genel Arşiv'e aktarılır)"
            >
              <Trash2 size={14} />
              <span>Seçilenleri Sil ({selectedCount})</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
