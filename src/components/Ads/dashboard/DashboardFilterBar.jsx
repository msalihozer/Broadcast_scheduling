/**
 * @file src/components/Ads/dashboard/DashboardFilterBar.jsx
 * @description TailAdmin (free-react-tailwind-admin-dashboard v2) Tasarım Sistemine Uygun Global Filtre Çubuğu.
 *
 * Dashboard'un tamamı (8 analitik bölüm + alt operasyon tablosu) bu çubuktaki filtrelere bağlı çalışır:
 * - Platform / Kanal: Tüm Platformlar, Semerkand HD, Semerkand WAY, Dijital Stream
 * - Dönem: Bugün, 7 Gün, 30 Gün, 3 Ay, 1 Yıl, Tüm Dönem
 * - Rezervasyon Durumu: Tümü, Aktif, Onay Bekleyen, Telafi (Makegood), Tamamlanan (Biten), İptal
 * - Sektör & Firma Seçici + Canlı Arama
 */
import React from 'react';
import {
  Tv, Calendar, Filter, Search, X, RotateCcw, Plus, Sparkles, Building2, Layers
} from 'lucide-react';
import {
  DASHBOARD_CHANNEL_OPTIONS,
  DASHBOARD_PERIOD_OPTIONS,
  DASHBOARD_STATUS_OPTIONS
} from './dashboardAnalyticsEngine';

const DashboardFilterBar = ({
  filters,
  onUpdateFilter,
  onResetFilters,
  companies = [],
  sectors = [],
  onOpenNewReservation,
  onNavigateTab,
  activeFiltersCount = 0
}) => {
  const {
    channelFilter = 'all',
    periodFilter = '30d',
    statusFilter = 'all',
    sectorFilter = 'all',
    companyFilter = 'all',
    searchQuery = ''
  } = filters;

  return (
    <div
      className="ta-card"
      style={{
        padding: '18px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}
    >
      {/* 1. ÜST SATIR: SAYFA BAŞLIĞI + DÖNEM SEÇİCİ (BUGÜN / 7G / 30G / 3AY / 1YIL) + AKSİYONLAR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          flexWrap: 'wrap'
        }}
      >
        {/* Sol: TailAdmin Sayfa Başlığı & Platform Seçici */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '700',
                color: 'var(--ads-text-main)',
                letterSpacing: '-0.02em'
              }}
            >
              Reklam &amp; Rezervasyon Genel Bakış
            </h2>
            <div style={{ fontSize: '12.5px', color: 'var(--ads-text-muted)', fontWeight: '500', marginTop: '2px' }}>
              Platform, dönem ve rezervasyon durumlarına göre canlı yayın &amp; gelir analitiği
            </div>
          </div>

          {/* Platform / Kanal Seçici Segmented Control */}
          <div className="ads-saas-pill-group" style={{ marginLeft: '4px' }}>
            {DASHBOARD_CHANNEL_OPTIONS.map(ch => {
              const isSelected = channelFilter === ch.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => onUpdateFilter('channelFilter', ch.id)}
                  className={`ads-saas-pill-btn ${isSelected ? 'active' : ''}`}
                  title={ch.label}
                >
                  <Tv size={13} />
                  <span>{ch.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sağ: Dönem Seçici (Bugün - 7 Gün - 30 Gün - 3 Ay - 1 Yıl - Tümü) ve Butonlar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="ads-saas-pill-group">
            {DASHBOARD_PERIOD_OPTIONS.map(p => {
              const isSelected = periodFilter === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onUpdateFilter('periodFilter', p.id)}
                  className={`ads-saas-pill-btn ${isSelected ? 'active' : ''}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={onResetFilters}
              className="ads-saas-btn ads-saas-btn-danger"
              title="Tüm Dashboard filtrelerini varsayılana sıfırla"
            >
              <RotateCcw size={14} />
              <span>Sıfırla ({activeFiltersCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigateTab && onNavigateTab('planning')}
            className="ads-saas-btn"
          >
            <Sparkles size={14} color="var(--ads-brand)" />
            <span>Kuşak Planlama</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewReservation}
            className="ads-saas-btn primary"
          >
            <Plus size={15} />
            <span>Yeni Rezervasyon</span>
          </button>
        </div>
      </div>

      {/* 2. ALT SATIR: REZERVASYON DURUM FİLTRELERİ + SEKTÖR / FİRMA SEÇİCİ + ARAMA */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          paddingTop: '12px',
          borderTop: '1px solid var(--ads-border)'
        }}
      >
        {/* Durum Hapları: Tümü - Aktif - Onay Bekleyen - Telafi (Makegood) - Tamamlanan - İptal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--ads-text-muted)',
              marginRight: '4px'
            }}
          >
            <Filter size={13} />
            Rezervasyon Durumu:
          </span>

          {DASHBOARD_STATUS_OPTIONS.map(st => {
            const isSelected = statusFilter === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => onUpdateFilter('statusFilter', st.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: isSelected ? '700' : '600',
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                  cursor: 'pointer',
                  border: isSelected ? `1.5px solid ${st.color}` : '1px solid var(--ads-border)',
                  background: isSelected ? st.bg : 'var(--ads-card-subtle)',
                  color: isSelected ? st.color : 'var(--ads-text-sub)',
                  transition: 'all 0.15s ease'
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: st.color
                  }}
                />
                <span>{st.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sağ: Sektör, Firma ve Arama Inputu (TailAdmin Input Stili) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select
            value={sectorFilter}
            onChange={e => onUpdateFilter('sectorFilter', e.target.value)}
            className="ads-saas-select"
          >
            <option value="all">Tüm Sektörler</option>
            {sectors.map(sec => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>

          <select
            value={companyFilter}
            onChange={e => onUpdateFilter('companyFilter', e.target.value)}
            className="ads-saas-select"
            style={{ maxWidth: '210px' }}
          >
            <option value="all">Tüm Firmalar ({companies.length})</option>
            {companies.slice(0, 120).map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--ads-card-bg)',
              border: '1px solid var(--ads-border-strong)',
              borderRadius: '10px',
              padding: '7px 12px',
              minWidth: '230px',
              boxShadow: '0px 1px 2px 0px rgba(16, 24, 40, 0.05)'
            }}
          >
            <Search size={14} color="var(--ads-text-muted)" />
            <input
              type="text"
              placeholder="Firma, kampanya veya klip ara..."
              value={searchQuery}
              onChange={e => onUpdateFilter('searchQuery', e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--ads-text-main)',
                fontFamily: "'Outfit', 'Inter', sans-serif",
                fontSize: '13px',
                fontWeight: '500',
                outline: 'none',
                width: '100%'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onUpdateFilter('searchQuery', '')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--ads-text-muted)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardFilterBar;
