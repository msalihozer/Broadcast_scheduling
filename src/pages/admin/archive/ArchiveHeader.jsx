/**
 * @file src/pages/admin/archive/ArchiveHeader.jsx
 * @description MAM Arşiv & Bölüm Analizi modülü üst başlık alanı.
 * PostgreSQL bağlantı/klip sayacı rozetini, genel klip arama modalı tetikleyicisini,
 * tüm kartları açma/kapama, admin işlem geçmişi (loglar) ve 11 kategoriyi toplu senkronize etme butonlarını içerir.
 */
import React from 'react';
import { Film, HardDrive, RefreshCw, Search, ClipboardList, ChevronsUpDown } from 'lucide-react';

const ArchiveHeader = ({ 
  isSyncingAll, 
  isSyncing, 
  onSyncAll, 
  totalClipsCount = 20014,
  onOpenClipSearch,
  onOpenLogViewer,
  onToggleExpandAll,
  allExpanded = false
}) => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      background: 'var(--bg-secondary)',
      padding: '24px',
      borderRadius: '16px',
      border: '1px solid var(--border-color)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      gap: '20px',
      flexWrap: 'wrap'
    }}>
      <div style={{ flex: 1, minWidth: '320px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
            color: 'white',
            padding: '8px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Film size={22} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
            MAM Arşiv & Bölüm Analizi
          </h2>
          <span style={{
            background: 'rgba(16, 185, 129, 0.12)',
            color: '#10b981',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: '700',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <HardDrive size={12} /> Yerel PostgreSQL ({Number(totalClipsCount).toLocaleString('tr-TR')} Klip)
          </span>
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '750px', lineHeight: '1.5' }}>
          MSSQL Libero MAM arşivindeki ham video kliplerini analiz edip düzenli program başlıkları, bölümleri ve süreleri altında toplayan ve yerel PostgreSQL veritabanında kataloglayan analiz modülü.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Klip Arama Butonu */}
        {onOpenClipSearch && (
          <button
            onClick={onOpenClipSearch}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(13, 148, 136, 0.15)',
              color: '#0d9488',
              border: '1px solid rgba(13, 148, 136, 0.35)',
              padding: '10px 14px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '700',
              transition: 'all 0.15s'
            }}
            title="Tüm arşiv klipleri arasında canlı arama yapın"
          >
            <Search size={15} />
            <span>Klip Arama</span>
          </button>
        )}

        {/* Tümünü Aç / Kapat */}
        {onToggleExpandAll && (
          <button
            onClick={onToggleExpandAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              padding: '10px 12px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600'
            }}
            title={allExpanded ? 'Tüm program kartlarını kapat' : 'Tüm program kartlarını aç'}
          >
            <ChevronsUpDown size={15} />
            <span>{allExpanded ? 'Tümünü Kapat' : 'Tümünü Aç'}</span>
          </button>
        )}

        {/* İşlem Geçmişi (Loglar) */}
        {onOpenLogViewer && (
          <button
            onClick={onOpenLogViewer}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              padding: '10px 14px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              transition: 'all 0.15s'
            }}
            title="Admin işlem ve denetim loglarını görüntüle"
          >
            <ClipboardList size={15} color="var(--accent-primary)" />
            <span>İşlem Geçmişi</span>
          </button>
        )}

        {/* Tümünü Senkronize Et */}
        <button
          onClick={onSyncAll}
          disabled={isSyncingAll || isSyncing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            padding: '10px 14px',
            borderRadius: '10px',
            cursor: isSyncingAll ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
          title="9 Yayın Kategorisinin tamamını (Reklam ve Ham hariç) MSSQL'den çekip metadata bilgileriyle PostgreSQL'e günceller"
        >
          <RefreshCw size={15} style={{ animation: isSyncingAll ? 'spin 1s linear infinite' : 'none' }} />
          {isSyncingAll ? 'Senkronize Ediliyor...' : 'Senkronize Et'}
        </button>
      </div>
    </div>
  );
};

export default ArchiveHeader;
