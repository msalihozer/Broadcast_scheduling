/**
 * @file src/pages/admin/programs/ProgramsHeaderAndStats.jsx
 * @description Admin Paneli -> Programlar Sekmesi Üst Başlık Çubuğu (Aksiyon Butonları)
 * ve 4'lü KPI İstatistik Metrik Kartları (Kullanılan Program, Yayına Hazır Klip, Toplam Süre, Kapsanan Kategori).
 */
import React from 'react';
import {
  Tv, Tag, Sliders, ChevronUp, ChevronDown, Plus,
  ClipboardList, RefreshCw, ShieldCheck, FileVideo, Clock, Layers
} from 'lucide-react';
import { formatTimecode } from '../../../utils/formatTimecode';

const ProgramsHeaderAndStats = ({
  usedProgramsCount,
  stats,
  isLoading,
  isRulesPanelOpen,
  onToggleRulesPanel,
  onOpenCategoriesModal,
  onOpenCreateProgramModal,
  onOpenLogViewerModal,
  onRefreshPrograms
}) => {
  return (
    <>
      {/* Üst Başlık ve Yönetim Butonları */}
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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              padding: '8px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Tv size={22} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
              Programlar
            </h2>
            <span style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '800',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              {usedProgramsCount} Aktif Kullanımda
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '750px', lineHeight: '1.5' }}>
            Yayın akışında aktif olarak kullanılan program serilerinin listesi. Bu alanda yalnızca kullanıma açılmış programlar görüntülenir.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={onOpenCategoriesModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              padding: '10px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '800'
            }}
            title="Bizim DB için kategorileri ekle, düzenle veya sil"
          >
            <Tag size={16} />
            <span>Kategorileri Yönet</span>
          </button>

          <button
            onClick={onToggleRulesPanel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: isRulesPanelOpen ? 'rgba(99, 102, 241, 0.16)' : 'var(--bg-tertiary)',
              color: isRulesPanelOpen ? '#818cf8' : 'var(--text-primary)',
              border: isRulesPanelOpen ? '1px solid rgba(99, 102, 241, 0.45)' : '1px solid var(--border-color)',
              padding: '10px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '700'
            }}
            title="Program Ayrıştırma ve Birim (Bölüm / Cüz / Gün) Kurallarını Yönet"
          >
            <Sliders size={16} />
            <span>Ayrıştırma Kuralları</span>
            {isRulesPanelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <button
            onClick={onOpenCreateProgramModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#10b981',
              color: '#fff',
              border: 'none',
              padding: '10px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '700',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
            }}
            title="Yeni program oluştur ve içerisine arşivden klip ekle"
          >
            <Plus size={16} />
            <span>+ Yeni Program Ekle</span>
          </button>

          <button
            onClick={onOpenLogViewerModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              padding: '10px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600'
            }}
            title="Yapılan tüm işlemlerin denetim günlüğü"
          >
            <ClipboardList size={16} color="var(--accent-primary)" />
            <span>İşlem Geçmişi</span>
          </button>

          <button
            onClick={onRefreshPrograms}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              padding: '10px 16px',
              borderRadius: '10px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: '600'
            }}
          >
            <RefreshCw size={15} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* 4'lü KPI İstatistik Metrik Kartları */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '14px'
      }}>
        <div style={{
          background: 'var(--bg-secondary)',
          padding: '16px 20px',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            padding: '12px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Kullanılan Program
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>
              {usedProgramsCount} Başlık
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-secondary)',
          padding: '16px 20px',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            background: 'rgba(59, 130, 246, 0.15)',
            color: '#3b82f6',
            padding: '12px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FileVideo size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Yayına Hazır Klip
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
              {stats.totalClips.toLocaleString('tr-TR')} Klip
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-secondary)',
          padding: '16px 20px',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            background: 'rgba(168, 85, 247, 0.15)',
            color: '#a855f7',
            padding: '12px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Kullanımdaki Toplam Süre
            </div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px', fontFamily: 'monospace' }}>
              {formatTimecode(stats.totalDurationSec)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              saat.dakika.saniye.salise
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-secondary)',
          padding: '16px 20px',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            padding: '12px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Layers size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Kapsanan Kategori
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
              {stats.uniqueCats} Kategori
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProgramsHeaderAndStats;

