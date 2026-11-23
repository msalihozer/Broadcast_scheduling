import React, { useState } from 'react';
import { Search, X, ChevronDown, Layers } from 'lucide-react';
import { CATEGORY_COLORS } from './constants';
import { LibraryDolguCard } from './LibraryDolguCard';

/**
 * @file LibraryFilters.jsx
 * @description Program Kütüphanesi üst arama kutusu, Canlı/Dolgu hızlı ekleme barı ve belirgin açılır/kapanır kategori listesi.
 */
export const LibraryFilters = ({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  availableCategories = [],
  categoryCounts = {},
  totalCount = 0,
  onDragStartDolgu,
  onOpenAddModal
}) => {
  // Kütüphane açıldığında kategoriler kapalı olarak başlar
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const activeCatColor = selectedCategory === 'all'
    ? 'var(--accent-primary)'
    : (CATEGORY_COLORS[selectedCategory] || 'var(--accent-primary)');

  return (
    <div style={{
      padding: '10px 12px',
      borderBottom: '1.5px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      flexShrink: 0,
      background: 'var(--bg-secondary)'
    }}>
      {/* 1. EN ÜSTTE: Program Arama Kutusu */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        background: 'var(--bg-primary)',
        border: '1.5px solid var(--border-color)',
        borderRadius: '9px',
        padding: '7px 10px'
      }}>
        <Search size={14} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Program veya konu ara..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            border: 'none',
            background: 'transparent',
            fontSize: '12.5px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            width: '100%',
            outline: 'none'
          }}
        />
        {searchQuery && (
          <X
            size={14}
            style={{ cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}
            onClick={() => setSearchQuery('')}
          />
        )}
      </div>

      {/* 2. KATEGORİLERİN ÜSTÜNDE: Dolgu Kuşağı ve Canlı / Özel Program */}
      <LibraryDolguCard
        onDragStart={onDragStartDolgu}
        onOpenAddModal={onOpenAddModal}
      />

      {/* 3. BELİRGİN KATEGORİ SEÇİMİ (Varsayılan Kapalı, Tıklayınca Alt Alta Açılır) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button
          type="button"
          onClick={() => setIsCategoriesOpen(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            cursor: 'pointer',
            padding: '8px 11px',
            borderRadius: '9px',
            border: isCategoriesOpen
              ? '1.5px solid var(--accent-primary)'
              : '1.5px solid var(--border-color)',
            background: isCategoriesOpen
              ? 'rgba(37, 99, 235, 0.08)'
              : 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            userSelect: 'none',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{
            fontSize: '12px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px'
          }}>
            <span style={{
              width: '22px',
              height: '22px',
              borderRadius: '6px',
              background: 'rgba(37, 99, 235, 0.14)',
              color: 'var(--accent-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Layers size={13} />
            </span>
            <span>Kategoriler</span>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px',
              background: activeCatColor,
              color: '#ffffff'
            }}>
              {selectedCategory === 'all' ? `Tümü (${totalCount})` : `${selectedCategory} (${categoryCounts[selectedCategory] || 0})`}
            </span>
          </span>

          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--accent-primary)'
          }}>
            <span>{isCategoriesOpen ? 'Gizle' : 'Seç'}</span>
            <ChevronDown
              size={15}
              style={{
                transform: isCategoriesOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease'
              }}
            />
          </span>
        </button>

        {isCategoriesOpen && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            maxHeight: '210px',
            overflowY: 'auto',
            padding: '4px',
            background: 'var(--bg-primary)',
            borderRadius: '9px',
            border: '1px solid var(--border-color)'
          }}>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setIsCategoriesOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                flexShrink: 0,
                padding: '6px 10px',
                borderRadius: '7px',
                border: selectedCategory === 'all'
                  ? '1.5px solid var(--accent-primary)'
                  : '1px solid var(--border-color)',
                background: selectedCategory === 'all'
                  ? 'var(--accent-primary)'
                  : 'var(--bg-secondary)',
                color: selectedCategory === 'all' ? '#ffffff' : 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.12s ease'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: selectedCategory === 'all' ? '#ffffff' : 'var(--accent-primary)'
                }} />
                <span>Tümü</span>
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '1px 7px',
                borderRadius: '999px',
                background: selectedCategory === 'all' ? 'rgba(255,255,255,0.22)' : 'var(--bg-tertiary)',
                color: selectedCategory === 'all' ? '#ffffff' : 'var(--text-secondary)'
              }}>
                {totalCount}
              </span>
            </button>

            {availableCategories.map(cat => {
              const catColor = CATEGORY_COLORS[cat] || '#0C617C';
              const isSelected = selectedCategory === cat;
              const count = categoryCounts[cat] || 0;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    setIsCategoriesOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    flexShrink: 0,
                    padding: '6px 10px',
                    borderRadius: '7px',
                    border: isSelected ? `1.5px solid ${catColor}` : '1px solid var(--border-color)',
                    background: isSelected ? catColor : 'var(--bg-secondary)',
                    color: isSelected ? '#ffffff' : 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.12s ease'
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: isSelected ? '#ffffff' : catColor
                    }} />
                    <span>{cat}</span>
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '1px 7px',
                    borderRadius: '999px',
                    background: isSelected ? 'rgba(255,255,255,0.22)' : `${catColor}18`,
                    color: isSelected ? '#ffffff' : catColor
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryFilters;
