/**
 * @file src/pages/admin/archive/ArchiveFilterBar.jsx
 * @description Arşiv programları için kullanım durumu filtresi (Tümü / Sadece Kullanılanlar / Kullanım Dışı),
 * metin arama kutusu, sıralama seçici ve aktif kategoriyi yeniden tarama kontrol çubuğu.
 */
import React from 'react';
import { Search, ArrowUpDown, RefreshCw, X } from 'lucide-react';

const ArchiveFilterBar = ({
  statusFilter,
  onStatusFilterChange,
  activeCount,
  totalCount,
  inactiveCount,
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  onSyncCategory,
  isSyncing,
  isSyncingAll
}) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      flexWrap: 'wrap',
      justifyContent: 'space-between'
    }}>
      {/* Segmented Status Filters */}
      <div style={{
        display: 'flex',
        background: 'var(--bg-secondary)',
        padding: '4px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)'
      }}>
        <button
          onClick={() => onStatusFilterChange('all')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: statusFilter === 'all' ? '700' : '600',
            fontSize: '12px',
            background: statusFilter === 'all' ? 'var(--accent-primary)' : 'transparent',
            color: statusFilter === 'all' ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.15s'
          }}
        >
          <span>Tüm Arşiv ({totalCount})</span>
        </button>

        <button
          onClick={() => onStatusFilterChange('active')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: statusFilter === 'active' ? '700' : '600',
            fontSize: '12px',
            background: statusFilter === 'active' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
            color: statusFilter === 'active' ? '#10b981' : 'var(--text-secondary)',
            transition: 'all 0.15s'
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
          <span>Sadece Kullanılanlar ({activeCount})</span>
        </button>

        <button
          onClick={() => onStatusFilterChange('inactive')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: statusFilter === 'inactive' ? '700' : '600',
            fontSize: '12px',
            background: statusFilter === 'inactive' ? 'var(--bg-tertiary)' : 'transparent',
            color: statusFilter === 'inactive' ? 'var(--text-primary)' : 'var(--text-secondary)',
            transition: 'all 0.15s'
          }}
        >
          <span>Kullanım Dışı ({inactiveCount})</span>
        </button>
      </div>

      {/* Arama, Sıralama ve Kategori Tarama */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 340px' }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'var(--bg-secondary)',
          padding: '10px 16px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)'
        }}>
          <Search size={16} color="var(--text-secondary)" />
          <input
            type="text"
            placeholder="Program adı veya bölüm ismiyle ara..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '13px',
              width: '100%'
            }}
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--bg-secondary)',
          padding: '8px 12px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)'
        }}>
          <ArrowUpDown size={14} color="var(--text-secondary)" />
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: '600',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="clips-desc" style={{ background: 'var(--bg-secondary)' }}>En Çok Klip</option>
            <option value="episodes-desc" style={{ background: 'var(--bg-secondary)' }}>En Çok Bölüm</option>
            <option value="duration-desc" style={{ background: 'var(--bg-secondary)' }}>En Uzun Süre</option>
            <option value="date-desc" style={{ background: 'var(--bg-secondary)' }}>En Yeni Tarih</option>
            <option value="name-asc" style={{ background: 'var(--bg-secondary)' }}>İsim (A-Z)</option>
          </select>
        </div>

        <button
          onClick={onSyncCategory}
          disabled={isSyncing || isSyncingAll}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: isSyncing ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
            color: '#fff',
            border: 'none',
            padding: '9px 14px',
            borderRadius: '10px',
            cursor: isSyncing ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            whiteSpace: 'nowrap'
          }}
        >
          <RefreshCw size={13} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
          {isSyncing ? 'Taranıyor...' : 'Kategoriyi Tara'}
        </button>
      </div>
    </div>
  );
};

export default ArchiveFilterBar;
