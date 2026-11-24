/**
 * @file src/pages/admin/archive/ArchiveAreaAndCategoryBanner.jsx
 * @description MAM Arşiv Analizi Sekmesi içerisindeki iki ana bileşen:
 * 1) `ArchiveAreaSwitcher`: "1. TV MAM DB (Bağlantı & Otomatik Güncelleme Kontrolü)" ile
 *    "2. Bizim DB (Planlama Kategorisi, Program İsmi & Bölümler)" alanları arasında geçiş seçicisi.
 * 2) `ArchiveSelectedCategoryBanner`: Seçili kategorinin ID, isim, DB Metadata şeması ve
 *    "+ Yeni Program Ekle" / "Kategorileri Yönet" hızlı aksiyonlarını barındıran bilgi şeridi.
 */
import React from 'react';
import { Database, Tag, HardDrive, Plus } from 'lucide-react';

/**
 * 1. TV MAM DB ve 2. Bizim DB Alan Seçici Kartları.
 */
export const ArchiveAreaSwitcher = ({
  activeArea,
  onSelectArea,
  isMamConnected,
  mamConnInfo,
  pendingUpdateCategoriesCount,
  totalNewClipsCount,
  totalClipsAllCategories
}) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '12px',
    background: 'var(--bg-secondary)',
    padding: '10px',
    borderRadius: '14px',
    border: '1px solid var(--border-color)'
  }}>
    {/* ALAN 1: Verileri Çektiğimiz TV MAM DB (Bağlantı & Otomatik Güncelleme Kontrolü) */}
    <button
      type="button"
      onClick={() => onSelectArea('mam_db')}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '14px 18px',
        borderRadius: '11px',
        border: activeArea === 'mam_db'
          ? '2px solid #0ea5e9'
          : '1px solid var(--border-color)',
        background: activeArea === 'mam_db'
          ? 'rgba(14, 165, 233, 0.14)'
          : 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: activeArea === 'mam_db' ? '#0ea5e9' : 'rgba(14, 165, 233, 0.15)',
          color: activeArea === 'mam_db' ? '#fff' : '#0ea5e9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Database size={20} />
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: activeArea === 'mam_db' ? '#0ea5e9' : 'var(--text-primary)' }}>
            1. TV MAM DB (Bağlantı & Otomatik Güncelleme Kontrolü)
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Verileri çektiğimiz kaynak MSSQL DB bağlantısı, otomatik yeni klip kontrolü ve kaynak kategoriler
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
        <span style={{
          fontSize: '10.5px',
          fontWeight: '800',
          padding: '3px 8px',
          borderRadius: '999px',
          background: isMamConnected ? 'rgba(16, 185, 129, 0.16)' : 'rgba(239, 68, 68, 0.16)',
          color: isMamConnected ? '#10b981' : '#ef4444',
          border: `1px solid ${isMamConnected ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`
        }}>
          {isMamConnected
            ? `Bağlı (${mamConnInfo?.latencyMs != null ? `${mamConnInfo.latencyMs} ms` : 'Aktif'})`
            : 'Bağlantı Yok'}
        </span>
        {pendingUpdateCategoriesCount > 0 ? (
          <span style={{
            fontSize: '10.5px',
            fontWeight: '800',
            padding: '2px 8px',
            borderRadius: '999px',
            background: 'rgba(245, 158, 11, 0.18)',
            color: '#f59e0b',
            border: '1px solid rgba(245, 158, 11, 0.4)'
          }}>
            +{totalNewClipsCount} Yeni Klip ({pendingUpdateCategoriesCount} Kat.)
          </span>
        ) : (
          <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#10b981' }}>
            Güncel
          </span>
        )}
      </div>
    </button>

    {/* ALAN 2: Bizim DB (Planlama Kategorileri, Program İsmi & Bölümler) */}
    <button
      type="button"
      onClick={() => onSelectArea('our_db')}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '14px 18px',
        borderRadius: '11px',
        border: activeArea === 'our_db'
          ? '2px solid var(--accent-primary)'
          : '1px solid var(--border-color)',
        background: activeArea === 'our_db'
          ? 'rgba(59, 130, 246, 0.14)'
          : 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: activeArea === 'our_db' ? 'var(--accent-primary)' : 'rgba(59, 130, 246, 0.15)',
          color: activeArea === 'our_db' ? '#fff' : 'var(--accent-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Tag size={20} />
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: activeArea === 'our_db' ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
            2. Bizim DB (Planlama Kategorisi, Program İsmi & Bölümler)
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Bizim kullandığımız kategori atamaları (Örn: Dini → Kısa Program), program isimleri ve bölümler
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
        <span style={{
          fontSize: '10.5px',
          fontWeight: '800',
          padding: '3px 8px',
          borderRadius: '999px',
          background: 'rgba(59, 130, 246, 0.16)',
          color: '#3b82f6',
          border: '1px solid rgba(59, 130, 246, 0.35)'
        }}>
          <HardDrive size={10} style={{ display: 'inline', marginRight: '4px' }} />
          Bizim DB
        </span>
        <span style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--text-secondary)' }}>
          {Number(totalClipsAllCategories || 0).toLocaleString('tr-TR')} Klip
        </span>
      </div>
    </button>
  </div>
);

/**
 * Seçili Kategori DB Bilgileri ve Hızlı Aksiyon Şeridi.
 * Not: "+ Yeni Program Ekle" butonu yalnızca Programlar sekmesinde yer alır; MAM Arşiv ekranı sadeleştirilmiştir.
 */
export const ArchiveSelectedCategoryBanner = ({
  activeArea,
  selectedCategoryId,
  currentCatMeta,
  currentCategoryObj,
  archiveData,
  onOpenCategoriesModal
}) => {
  const metadataFields = currentCategoryObj?.metadataFields || archiveData?.metadataFields || [];

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: `1px solid ${currentCatMeta.border || 'var(--border-color)'}`,
      borderRadius: '12px',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '10px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{
          background: activeArea === 'mam_db' ? 'rgba(14, 165, 233, 0.15)' : currentCatMeta.bg,
          color: activeArea === 'mam_db' ? '#0ea5e9' : currentCatMeta.color,
          border: `1px solid ${activeArea === 'mam_db' ? 'rgba(14, 165, 233, 0.4)' : currentCatMeta.border}`,
          padding: '4px 10px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: '800'
        }}>
          {activeArea === 'mam_db'
            ? `TV MAM Kaynak Kategori #${selectedCategoryId}`
            : `Bizim Kategori #${selectedCategoryId}`}
        </span>
        <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
          {currentCategoryObj?.categoryName || currentCatMeta.name}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          • Yeni program ekleme işlemi yalnızca <b>Programlar &amp; Kurallar</b> sekmesinden yapılır.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {onOpenCategoriesModal && (
          <button
            onClick={onOpenCategoriesModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: 'rgba(59, 130, 246, 0.14)',
              color: '#3b82f6',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '11.5px',
              fontWeight: '800'
            }}
            title="Bizim DB için kategorileri ekle, düzenle veya sil"
          >
            <Tag size={13} />
            <span>Kategorileri Yönet</span>
          </button>
        )}

        <span style={{
          fontSize: '11px',
          fontWeight: '700',
          color: currentCatMeta.color,
          background: currentCatMeta.bg,
          padding: '4px 8px',
          borderRadius: '6px'
        }}>
          {metadataFields.length} Metadata Alanı
        </span>
      </div>
    </div>
  );
};

