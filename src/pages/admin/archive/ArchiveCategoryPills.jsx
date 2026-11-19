/**
 * @file src/pages/admin/archive/ArchiveCategoryPills.jsx
 * @description MAM Arşiv Analizi sekmesinde yayın kategorilerini (Ham #6 ve Reklam #11 hariç),
 * kategori ID, kategori adı, metadata alan sayısı, yayındaki aktif program sayısı ve
 * senkronize klip sayısını gösteren yatay seçim çubuğu ve "Kategorileri Yönet" tetikleyicisi.
 *
 * Modüler Yapı:
 * - `resolveCategoryPillTheme`: Kategori rengini (özel DB rengi veya MSSQL_CATEGORIES varsayılanı) hesaplar.
 * - `CategoryPillItem`: Tekil kategori seçim hapı (pill) bileşeni.
 * - `ManageCategoriesPillButton`: Bizim DB kategorilerini ekleme/düzenleme/silme modalını açan buton.
 * - `ArchiveCategoryPills`: Ana yatay kaydırılabilir kategori barı.
 */
import React from 'react';
import { Settings } from 'lucide-react';
import { MSSQL_CATEGORIES } from '../../../utils/categoryColors';

/**
 * Bir kategorinin özel rengini veya varsayılan MSSQL kategori temasını çözümler.
 * @param {Object} cat - Kategori nesnesi (`categoryId`, `color` vb.)
 * @returns {{ color: string, bg: string, border: string }}
 */
export const resolveCategoryPillTheme = (cat) => {
  const customColor = cat?.color || MSSQL_CATEGORIES[cat?.categoryId]?.color || '#64748b';
  if (MSSQL_CATEGORIES[cat?.categoryId]) {
    return {
      ...MSSQL_CATEGORIES[cat.categoryId],
      color: customColor,
      bg: `${customColor}24`,
      border: `${customColor}66`
    };
  }
  return {
    color: customColor,
    bg: `${customColor}24`,
    border: `${customColor}66`
  };
};

/**
 * Tekil Kategori Seçim Butonu (Pill).
 * Senkronizasyon durumu noktası, Kategori ID rozeti, kategori adı, aktif program sayısı ve klip sayısını içerir.
 */
export const CategoryPillItem = ({ cat, isSelected, onSelect }) => {
  const meta = resolveCategoryPillTheme(cat);
  const metaCount = Array.isArray(cat.metadataFields) ? cat.metadataFields.length : 0;
  const clipCount = Number(cat.syncedClipCount || cat.mssqlClipCount || 0);

  return (
    <button
      type="button"
      onClick={() => onSelect(cat.categoryId)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        borderRadius: '12px',
        border: isSelected ? `2px solid ${meta.color}` : '1px solid var(--border-color)',
        background: isSelected ? meta.bg : 'var(--bg-secondary)',
        color: isSelected ? meta.color : 'var(--text-secondary)',
        cursor: 'pointer',
        fontWeight: isSelected ? '700' : '500',
        fontSize: '13px',
        whiteSpace: 'nowrap',
        transition: 'all 0.15s ease-in-out',
        boxShadow: isSelected ? `0 4px 14px ${meta.color}25` : 'none'
      }}
      title={`Kategori ID: #${cat.categoryId} • ${cat.categoryName}${metaCount > 0 ? ` • ${metaCount} Metadata Alanı` : ''}`}
    >
      {/* Senkronizasyon Durum Noktası (Yeşil: Senkronize, Turuncu: Bekliyor) */}
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: cat.isSynced ? '#10b981' : '#f59e0b'
        }}
      />

      {/* Kategori ID Rozeti */}
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: '11px',
          fontWeight: '800',
          opacity: 0.75,
          background: 'var(--bg-tertiary)',
          padding: '1px 6px',
          borderRadius: '6px'
        }}
      >
        #{cat.categoryId}
      </span>

      {/* Kategori Adı */}
      <span>{cat.categoryName}</span>

      {/* Yayında Aktif Program Sayısı Rozeti */}
      {cat.activeProgramsCount > 0 && (
        <span
          style={{
            background: '#10b981',
            color: '#fff',
            padding: '2px 7px',
            borderRadius: '10px',
            fontSize: '11px',
            fontWeight: '800'
          }}
          title={`${cat.activeProgramsCount} program yayında aktif`}
        >
          {cat.activeProgramsCount} aktif
        </span>
      )}

      {/* Toplam Senkronize Klip Sayısı Rozeti */}
      <span
        style={{
          background: isSelected ? meta.color : 'var(--bg-tertiary)',
          color: isSelected ? '#fff' : 'var(--text-secondary)',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: '700'
        }}
        title={`Toplam Arşiv Süresi: ${cat.totalDurationFormatted || '00:00:00'}`}
      >
        {clipCount.toLocaleString('tr-TR')} klip
      </span>
    </button>
  );
};

/**
 * "Kategorileri Yönet" Butonu — Bizim DB kategorilerini ekleme, düzenleme ve silme modalını açar.
 */
export const ManageCategoriesPillButton = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '10px 14px',
      borderRadius: '12px',
      border: '1px dashed var(--accent-primary)',
      background: 'rgba(59, 130, 246, 0.1)',
      color: 'var(--accent-primary)',
      cursor: 'pointer',
      fontWeight: '800',
      fontSize: '12.5px',
      whiteSpace: 'nowrap',
      flexShrink: 0
    }}
    title="Bizim DB için kategorileri yönet (Yeni kategori ekle, düzenle veya sil)"
  >
    <Settings size={14} />
    <span>Kategorileri Yönet</span>
  </button>
);

/**
 * Ana Yatay Kategori Seçim Barı Bileşeni.
 */
const ArchiveCategoryPills = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onManageCategories
}) => {
  // Ham (#6) ve Reklam (#11) kategorileri haricindeki tüm resmi ve özel yayın kategorilerini filtrele
  const visibleCategories = (categories || []).filter(
    cat => cat.categoryId !== 6 && cat.categoryId !== 11
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        overflowX: 'auto',
        paddingBottom: '8px',
        scrollbarWidth: 'thin'
      }}
    >
      {visibleCategories.map(cat => (
        <CategoryPillItem
          key={cat.categoryId}
          cat={cat}
          isSelected={selectedCategoryId === cat.categoryId}
          onSelect={onSelectCategory}
        />
      ))}

      {onManageCategories && (
        <ManageCategoriesPillButton onClick={onManageCategories} />
      )}
    </div>
  );
};

export default ArchiveCategoryPills;
