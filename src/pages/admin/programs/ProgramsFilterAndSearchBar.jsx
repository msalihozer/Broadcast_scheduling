/**
 * @file src/pages/admin/programs/ProgramsFilterAndSearchBar.jsx
 * @description Admin Paneli -> Programlar Sekmesi Arama, Kategori Filtresi, Sıralama
 * ve "Arşivden Program Ara & Kullanıma Aç" Canlı Arama Açılır Menüsü (Dropdown) bileşeni.
 */
import React from 'react';
import {
  Search, Filter, ArrowUpDown, Sparkles, RefreshCw, X, Plus
} from 'lucide-react';
import { MSSQL_CATEGORIES } from '../../../utils/categoryColors';

const ProgramsFilterAndSearchBar = ({
  searchTerm,
  onSearchTermChange,
  categoryFilter,
  onCategoryFilterChange,
  sortBy,
  onSortByChange,
  visibleUsedPrograms,
  ourCategories,
  searchDropdownRef,
  archiveSearchQuery,
  onArchiveSearchQueryChange,
  archiveSearchResults,
  isSearchingArchive,
  isSearchDropdownOpen,
  onSetSearchDropdownOpen,
  togglingProgramId,
  onToggleStatus
}) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      flexWrap: 'wrap'
    }}>
      {/* 1. Kullanılanlar İçi Arama */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'var(--bg-secondary)',
        padding: '10px 16px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        flex: 1,
        minWidth: '260px'
      }}>
        <Search size={16} color="var(--text-secondary)" />
        <input
          type="text"
          placeholder="Kullanılan program listesinde filtrele..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
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
            onClick={() => onSearchTermChange('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* 2. Kategori Filtresi */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'var(--bg-secondary)',
        padding: '8px 12px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)'
      }}>
        <Filter size={14} color="var(--text-secondary)" />
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Kategori:</span>
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
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
          <option value="all" style={{ background: 'var(--bg-secondary)' }}>
            Tüm Kategoriler ({visibleUsedPrograms.length})
          </option>
          {Array.from(new Set(visibleUsedPrograms.map(p => p.categoryId))).map(cId => {
            const dynCat = (ourCategories || []).find(c => Number(c.id) === Number(cId));
            const cName = dynCat?.name || MSSQL_CATEGORIES[cId]?.name || `Kategori ${cId}`;
            const count = visibleUsedPrograms.filter(p => p.categoryId === cId).length;
            return (
              <option key={cId} value={cId} style={{ background: 'var(--bg-secondary)' }}>
                #{cId} {cName} ({count})
              </option>
            );
          })}
        </select>
      </div>

      {/* 3. Sıralama Seçici */}
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
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Sırala:</span>
        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value)}
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
          <option value="category" style={{ background: 'var(--bg-secondary)' }}>Kategoriye Göre</option>
          <option value="name-asc" style={{ background: 'var(--bg-secondary)' }}>İsim (A-Z)</option>
          <option value="clips-desc" style={{ background: 'var(--bg-secondary)' }}>En Çok Klip</option>
          <option value="duration-desc" style={{ background: 'var(--bg-secondary)' }}>En Uzun Süre</option>
        </select>
      </div>

      {/* 4. Sağ: Arşivden Program Ara & Kullanıma Aç Canlı Dropdown */}
      <div ref={searchDropdownRef} style={{ position: 'relative', minWidth: '300px', flex: '1 1 300px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'var(--bg-secondary)',
          padding: '10px 16px',
          borderRadius: '12px',
          border: '1px solid var(--accent-primary)',
          boxShadow: isSearchDropdownOpen ? '0 0 0 2px var(--accent-primary)33' : 'none'
        }}>
          <Sparkles size={16} color="var(--accent-primary)" />
          <input
            type="text"
            placeholder="Arşivden program ara & kullanıma aç..."
            value={archiveSearchQuery}
            onChange={(e) => onArchiveSearchQueryChange(e.target.value)}
            onFocus={() => {
              if (archiveSearchResults.length > 0) onSetSearchDropdownOpen(true);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '13px',
              width: '100%',
              fontWeight: '500'
            }}
          />
          {isSearchingArchive ? (
            <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} color="var(--accent-primary)" />
          ) : archiveSearchQuery ? (
            <button
              onClick={() => {
                onArchiveSearchQueryChange('');
                onSetSearchDropdownOpen(false);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <X size={15} />
            </button>
          ) : null}
        </div>

        {/* Arama Sonuçları Açılır Menüsü */}
        {isSearchDropdownOpen && archiveSearchResults.length > 0 && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            background: 'var(--bg-secondary)',
            borderRadius: '14px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
            zIndex: 999,
            maxHeight: '380px',
            overflowY: 'auto',
            padding: '8px'
          }}>
            <div style={{
              padding: '8px 12px',
              fontSize: '11px',
              fontWeight: '700',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span>Arşivdeki Sonuçlar ({archiveSearchResults.length})</span>
              <span>Durum / İşlem</span>
            </div>

            {archiveSearchResults.map(item => {
              const catMeta = MSSQL_CATEGORIES[item.categoryId] || { color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' };
              const isAlreadyActive = !!item.isActive;

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background 0.15s',
                    gap: '12px'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontWeight: '700',
                        fontSize: '13px',
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {item.title}
                      </span>
                      <span style={{
                        background: catMeta.bg,
                        color: catMeta.color,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        flexShrink: 0
                      }}>
                        {item.categoryName}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {item.totalClips} klip • {item.totalEpisodes ? `${item.totalEpisodes} bölüm • ` : ''}{item.totalDurationFormatted}
                    </div>
                  </div>

                  <button
                    onClick={() => onToggleStatus(item.id, isAlreadyActive, item.title)}
                    disabled={togglingProgramId === item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '700',
                      flexShrink: 0,
                      background: isAlreadyActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: isAlreadyActive ? '#ef4444' : '#10b981',
                      transition: 'all 0.2s'
                    }}
                  >
                    {togglingProgramId === item.id ? (
                      <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : isAlreadyActive ? (
                      <>
                        <X size={12} /> Kullanımdan Kaldır
                      </>
                    ) : (
                      <>
                        <Plus size={12} /> Kullanıma Aç
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgramsFilterAndSearchBar;

