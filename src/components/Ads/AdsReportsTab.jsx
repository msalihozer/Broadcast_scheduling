/**
 * @file src/components/Ads/AdsReportsTab.jsx
 * @description Profesyonel Reklam Rezervasyon Raporları Sekmesi.
 * Hangi reklam (materyal) kaç defa, toplam kaç saniye/dakika, günde ortalama/min/maks kaç defa,
 * hangi saatlerde ve hangi kuşaklarda (Sabah, Öğle, Akşam Prime Time, Gece) yayınlandığını
 * detaylı tablolar, grafiksel barlar ve Excel/CSV çıktısı ile sunar.
 */
import React, { useState, useMemo } from 'react';
import {
  FileBarChart2,
  Search,
  Download,
  RotateCcw,
  Film,
  Building2,
  Clock,
  Calendar,
  TrendingUp,
  Layers,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Filter
} from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import { computeAdsAnalyticsReport } from '../../modules/ads/utils/adsAutoSyncEngine';

const KUŞAK_BADGE_STYLES = {
  'Sabah Kuşağı': { bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.35)', color: '#fbbf24' },
  'Öğle Kuşağı': { bg: 'rgba(59, 130, 246, 0.14)', border: 'rgba(59, 130, 246, 0.35)', color: '#60a5fa' },
  'Akşam (Prime Time)': { bg: 'rgba(139, 92, 246, 0.18)', border: 'rgba(139, 92, 246, 0.45)', color: '#c084fc' },
  'Gece Kuşağı': { bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.35)', color: '#34d399' }
};

function formatDurationReadable(totalSec = 0) {
  const sec = Math.max(0, Math.round(Number(totalSec) || 0));
  if (sec < 60) return `${sec} sn`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) {
    return s > 0 ? `${sec} sn (${m} dk ${s} sn)` : `${sec} sn (${m} dk)`;
  }
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${sec.toLocaleString('tr-TR')} sn (${h} sa ${remM} dk)`;
}

const AdsReportsTab = ({ setActiveTab }) => {
  const companies = usePlanningStore(state => state.companies || []);
  const products = usePlanningStore(state => state.products || []);
  const materials = usePlanningStore(state => state.materials || []);
  const adPlacements = usePlanningStore(state => state.adPlacements || {});
  const channels = usePlanningStore(state => state.channels || []);
  const timeBlocks = usePlanningStore(state => state.timeBlocks || []);
  const setSelectedCompanyDetailId = usePlanningStore(state => state.setSelectedCompanyDetailId);
  const setSelectedMaterialDetailId = usePlanningStore(state => state.setSelectedMaterialDetailId);
  const regenerateSampleAdPlacements = usePlanningStore(state => state.regenerateSampleAdPlacements);

  const [reportView, setReportView] = useState('material'); // 'material' | 'daily' | 'company' | 'timeblocks' | 'logs'
  const [filters, setFilters] = useState({
    companyId: '',
    productId: '',
    materialId: '',
    channelId: '',
    timeBlockId: '',
    startDate: '',
    endDate: '',
    searchQuery: ''
  });

  const sortedCompanies = useMemo(
    () => [...companies].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr')),
    [companies]
  );

  const filteredProducts = useMemo(() => {
    const list = filters.companyId
      ? products.filter(p => String(p.companyId) === String(filters.companyId))
      : products;
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));
  }, [products, filters.companyId]);

  const filteredMaterialsList = useMemo(() => {
    let list = materials;
    if (filters.companyId) {
      list = list.filter(m => String(m.companyId) === String(filters.companyId));
    }
    if (filters.productId) {
      list = list.filter(m => String(m.productId) === String(filters.productId));
    }
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));
  }, [materials, filters.companyId, filters.productId]);

  const reportData = useMemo(
    () =>
      computeAdsAnalyticsReport({
        companies,
        products,
        materials,
        adPlacements,
        channels,
        timeBlocks,
        filters
      }),
    [companies, products, materials, adPlacements, channels, timeBlocks, filters]
  );

  const {
    summary,
    materialReports,
    companyReports,
    dailyReports,
    timeBlockReports,
    hourlyReports,
    spotLogs
  } = reportData;

  const resetFilters = () => {
    setFilters({
      companyId: '',
      productId: '',
      materialId: '',
      channelId: '',
      timeBlockId: '',
      startDate: '',
      endDate: '',
      searchQuery: ''
    });
  };

  const openMaterialAndCompanyDetail = (companyId, materialId = null) => {
    if (companyId) setSelectedCompanyDetailId(companyId);
    if (materialId) setSelectedMaterialDetailId(materialId);
    if (setActiveTab) setActiveTab('company-details');
  };

  const handleExportCSV = () => {
    const headers = [
      'Reklam Materyali',
      'Klip Kodu',
      'Klip ID',
      'Firma',
      'Ürün / Kampanya',
      'Birim Süre (sn)',
      'Toplam Yayın (Kaç Defa)',
      'Toplam Süre (Saniye)',
      'Yayınlandığı Gün Sayısı',
      'Günde Ortalama (Spot/Gün)',
      'Min-Maks Günlük Spot',
      'Yayınlandığı Kuşaklar',
      'Yayınlandığı Saatler',
      'İlk Yayın Tarihi',
      'Son Yayın Tarihi'
    ];

    const rows = materialReports.map(m => [
      m.materialName,
      m.clipName,
      `#${m.clipId}`,
      m.companyName,
      m.productName,
      m.unitDurationSec,
      m.totalSpots,
      m.totalDurationSec,
      m.activeDaysCount,
      m.avgDailySpots,
      `${m.minDailySpots}-${m.maxDailySpots}`,
      m.timeBlocksBreakdown.map(tb => `${tb.name} (${tb.count})`).join(' | '),
      m.sortedHours.join(', '),
      m.firstDate,
      m.lastDate
    ]);

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reklam_Rezervasyon_Raporu_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* KOMPAKT SaaS ANALİTİK TOOLBAR */}
      <div className="ads-saas-toolbar" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(0,102,255,0.1)', color: '#0066ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileBarChart2 size={16} />
            </div>
            <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--ads-text)' }}>Medya Takip Raporları</span>
          </div>

          <div className="ads-saas-search">
            <Search size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Spot, klip kodu, firma, saat ara..."
              value={filters.searchQuery}
              onChange={e => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
            />
          </div>

          <select
            className="ads-saas-select"
            value={filters.companyId}
            onChange={e => setFilters(prev => ({ ...prev, companyId: e.target.value, productId: '', materialId: '' }))}
          >
            <option value="">Tüm Firmalar ({companies.length})</option>
            {sortedCompanies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            className="ads-saas-select"
            value={filters.productId}
            onChange={e => setFilters(prev => ({ ...prev, productId: e.target.value, materialId: '' }))}
          >
            <option value="">Tüm Ürünler ({filteredProducts.length})</option>
            {filteredProducts.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            className="ads-saas-select"
            value={filters.timeBlockId}
            onChange={e => setFilters(prev => ({ ...prev, timeBlockId: e.target.value }))}
          >
            <option value="">Tüm Kuşaklar</option>
            <option value="Sabah Kuşağı">Sabah Kuşağı (06-12)</option>
            <option value="Öğle Kuşağı">Öğle Kuşağı (12-18)</option>
            <option value="Akşam (Prime Time)">Prime Time (18-24)</option>
            <option value="Gece Kuşağı">Gece Kuşağı (00-06)</option>
          </select>

          <input
            type="date"
            className="ads-saas-select"
            value={filters.startDate}
            onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            title="Başlangıç Tarihi"
          />
          <input
            type="date"
            className="ads-saas-select"
            value={filters.endDate}
            onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
            title="Bitiş Tarihi"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={resetFilters} className="ads-saas-btn">
            <RotateCcw size={13} /> Sıfırla
          </button>
          <button onClick={handleExportCSV} className="ads-saas-btn primary">
            <Download size={14} /> CSV İndir
          </button>
        </div>
      </div>

      {/* 5 PROFESYONEL KPI ÖZET KARTI */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '10px',
          flexShrink: 0
        }}
      >
        <div className="ads-saas-card" style={{ padding: '12px 14px', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Toplam Yayın</span>
            <CheckCircle2 size={15} color="#0066ff" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--ads-text)' }}>
            {summary.totalSpotsCount.toLocaleString('tr-TR')} <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--ads-text-muted)' }}>Spot ({summary.totalBroadcastDays} gün)</span>
          </div>
        </div>

        <div className="ads-saas-card" style={{ padding: '12px 14px', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Toplam Süre</span>
            <Clock size={15} color="#0d9488" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0d9488' }}>
            {summary.totalBroadcastSec.toLocaleString('tr-TR')} <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--ads-text-muted)' }}>sn ({summary.totalBroadcastMin} dk)</span>
          </div>
        </div>

        <div className="ads-saas-card" style={{ padding: '12px 14px', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Günlük Ortalama</span>
            <Calendar size={15} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#f59e0b' }}>
            {summary.avgSpotsPerDay} <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--ads-text-muted)' }}>Spot/Gün</span>
          </div>
        </div>

        <div className="ads-saas-card" style={{ padding: '12px 14px', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Aktif Spot & Firma</span>
            <Film size={15} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#8b5cf6' }}>
            {summary.activeMaterialsCount} <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--ads-text-muted)' }}>Spot • {summary.activeCompaniesCount} Firma</span>
          </div>
        </div>

        <div className="ads-saas-card" style={{ padding: '12px 14px', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>En Yoğun Kuşak</span>
            <TrendingUp size={15} color="#ec4899" />
          </div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: '#ec4899', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {summary.topTimeBlock ? `${summary.topTimeBlock.timeBlockName} (%${summary.topTimeBlock.sharePercentage})` : '-'}
          </div>
        </div>
      </div>

      {/* RAPOR GÖRÜNÜM SEKMELERİ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div className="ads-saas-pill-group">
          {[
            { id: 'material', label: `Spot Bazlı (${materialReports.length})` },
            { id: 'daily', label: `Günlük & Saat (${dailyReports.length})` },
            { id: 'company', label: `Firma Bazlı (${companyReports.length})` },
            { id: 'timeblocks', label: `Kuşak & Saat Analizi` },
            { id: 'logs', label: `Tüm Spot Kayıtları (${spotLogs.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setReportView(tab.id)}
              className={`ads-saas-pill-btn ${reportView === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. REKLAM (MATERYAL) BAZLI PROFESYONEL RAPOR */}
      {reportView === 'material' && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1250px' }}>
              <thead
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  position: 'sticky',
                  top: 0,
                  zIndex: 2
                }}
              >
                <tr>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    Reklam Materyali (Spot) & Klip Kodu
                  </th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    Firma & Ürün
                  </th>
                  <th style={{ padding: '14px 12px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Spot Süresi
                  </th>
                  <th style={{ padding: '14px 12px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Kaç Defa Yayınlandı
                  </th>
                  <th style={{ padding: '14px 12px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Toplam Kaç Saniye
                  </th>
                  <th style={{ padding: '14px 12px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Günde Kaç Defa
                  </th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    Hangi Kuşaklarda Yayınlandı
                  </th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    Hangi Saatlerde Yayınlandı
                  </th>
                  <th style={{ padding: '14px 14px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Detay
                  </th>
                </tr>
              </thead>
              <tbody>
                {materialReports.map(m => (
                  <tr
                    key={m.materialId}
                    onClick={() => openMaterialAndCompanyDetail(m.companyId, m.materialId)}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139, 92, 246, 0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Materyal Adı & Kodu */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '8px',
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: '#a78bfa',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <Film size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '13.5px' }}>
                            {m.materialName}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                            #{m.clipId} • {m.clipName || 'Klip Kodu Yok'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Firma & Ürün */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '700', color: '#60a5fa', fontSize: '13px' }}>{m.companyName}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{m.productName}</div>
                    </td>

                    {/* Birim Spot Süresi */}
                    <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                      <span
                        style={{
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-color)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontWeight: '700',
                          fontSize: '12px',
                          color: 'var(--text-primary)'
                        }}
                      >
                        {m.unitDurationSec} sn
                      </span>
                    </td>

                    {/* Kaç Defa Yayınlandı */}
                    <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          background: 'rgba(59, 130, 246, 0.14)',
                          border: '1px solid rgba(59, 130, 246, 0.35)',
                          padding: '6px 14px',
                          borderRadius: '8px'
                        }}
                      >
                        <span style={{ fontSize: '16px', fontWeight: '800', color: '#60a5fa' }}>
                          {m.totalSpots} Defa
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {m.activeDaysCount} günde
                        </span>
                      </div>
                    </td>

                    {/* Toplam Kaç Saniye */}
                    <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                      <div style={{ fontWeight: '800', color: '#34d399', fontSize: '14px' }}>
                        {m.totalDurationSec.toLocaleString('tr-TR')} sn
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        ({(m.totalDurationSec / 60).toFixed(1)} dk)
                      </div>
                    </td>

                    {/* Günde Kaç Defa */}
                    <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                      <div style={{ fontWeight: '800', color: '#fbbf24', fontSize: '14px' }}>
                        Günde {m.avgDailySpots} kez
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        (Min: {m.minDailySpots} / Maks: {m.maxDailySpots})
                      </div>
                    </td>

                    {/* Hangi Kuşaklarda Yayınlandı */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {m.timeBlocksBreakdown.map(tb => {
                          const st = KUŞAK_BADGE_STYLES[tb.name] || {
                            bg: 'var(--bg-tertiary)',
                            border: 'var(--border-color)',
                            color: 'var(--text-primary)'
                          };
                          return (
                            <span
                              key={tb.name}
                              style={{
                                background: st.bg,
                                border: `1px solid ${st.border}`,
                                color: st.color,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700'
                              }}
                            >
                              {tb.name}: {tb.count} kez
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Hangi Saatlerde Yayınlandı */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxWidth: '280px' }}>
                        {m.sortedHours.map(h => {
                          const countAtHour = m.hoursCountMap[h] || 1;
                          return (
                            <span
                              key={h}
                              style={{
                                background: 'rgba(15, 23, 42, 0.7)',
                                border: '1px solid rgba(148, 163, 184, 0.25)',
                                color: '#e2e8f0',
                                padding: '2px 7px',
                                borderRadius: '5px',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                fontWeight: '600'
                              }}
                              title={`${h} saatinde toplam ${countAtHour} defa yayınlandı`}
                            >
                              {h} {countAtHour > 1 ? `(x${countAtHour})` : ''}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Detay Butonu */}
                    <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          openMaterialAndCompanyDetail(m.companyId, m.materialId);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 10px',
                          borderRadius: '7px',
                          border: '1px solid rgba(139, 92, 246, 0.4)',
                          background: 'rgba(139, 92, 246, 0.15)',
                          color: '#c084fc',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        İncele <ExternalLink size={13} />
                      </button>
                    </td>
                  </tr>
                ))}

                {materialReports.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Seçilen kriterlere uygun reklam yayın kaydı bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. GÜNLÜK YAYIN DAĞILIM RAPORU (GÜNDE KAÇ DEFA & HANGİ SAATLERDE) */}
      {reportView === 'daily' && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1100px' }}>
              <thead
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  position: 'sticky',
                  top: 0,
                  zIndex: 2
                }}
              >
                <tr>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>Tarih & Kanal</th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>Reklam Materyali</th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>Firma & Ürün</th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    O Gün Kaç Defa Yayınlandı
                  </th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    O Günkü Toplam Süre
                  </th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    O Gün Yayınlandığı Kuşaklar
                  </th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    O Gün Yayınlandığı Saatler (HH:MM)
                  </th>
                </tr>
              </thead>
              <tbody>
                {dailyReports.map(d => (
                  <tr
                    key={d.key}
                    onClick={() => openMaterialAndCompanyDetail(d.companyId, d.materialId)}
                    style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '800', color: 'var(--text-primary)', fontSize: '13.5px' }}>{d.date}</div>
                      <div style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: '600' }}>
                        {d.channelName}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{d.materialName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        #{d.clipId} ({d.unitDurationSec} sn)
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '700', color: '#60a5fa', fontSize: '13px' }}>{d.companyName}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{d.productName}</div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span
                        style={{
                          background: 'rgba(245, 158, 11, 0.16)',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          color: '#fbbf24',
                          padding: '5px 12px',
                          borderRadius: '8px',
                          fontWeight: '800',
                          fontSize: '14px'
                        }}
                      >
                        {d.dailySpotCount} Defa
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '800', color: '#34d399' }}>
                      {formatDurationReadable(d.dailyTotalSec)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {d.timeBlocksList.map(tb => {
                          const st = KUŞAK_BADGE_STYLES[tb] || {
                            bg: 'var(--bg-tertiary)',
                            border: 'var(--border-color)',
                            color: 'var(--text-primary)'
                          };
                          return (
                            <span
                              key={tb}
                              style={{
                                background: st.bg,
                                border: `1px solid ${st.border}`,
                                color: st.color,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700'
                              }}
                            >
                              {tb}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {d.broadcastTimes.map((t, idx) => (
                          <span
                            key={`${t}-${idx}`}
                            style={{
                              background: 'rgba(59, 130, 246, 0.14)',
                              border: '1px solid rgba(59, 130, 246, 0.35)',
                              color: '#93c5fd',
                              padding: '3px 8px',
                              borderRadius: '5px',
                              fontSize: '12px',
                              fontFamily: 'monospace',
                              fontWeight: '700'
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. FİRMA BAZLI RAPOR */}
      {reportView === 'company' && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1050px' }}>
              <thead
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  position: 'sticky',
                  top: 0,
                  zIndex: 2
                }}
              >
                <tr>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>Firma Adı</th>
                  <th style={{ padding: '14px 14px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Aktif Ürün & Spot
                  </th>
                  <th style={{ padding: '14px 14px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Toplam Yayın (Kaç Defa)
                  </th>
                  <th style={{ padding: '14px 14px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Toplam Süre (Kaç Saniye)
                  </th>
                  <th style={{ padding: '14px 14px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Günde Ortalama
                  </th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    Kuşak Dağılımı
                  </th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Firma Detay & Rapor
                  </th>
                </tr>
              </thead>
              <tbody>
                {companyReports.map(c => (
                  <tr
                    key={c.companyId}
                    onClick={() => openMaterialAndCompanyDetail(c.companyId)}
                    style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '8px',
                            background: 'rgba(59, 130, 246, 0.14)',
                            color: '#60a5fa',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Building2 size={16} />
                        </div>
                        <span style={{ fontWeight: '800', color: 'var(--text-primary)', fontSize: '14px' }}>
                          {c.companyName}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 14px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: '600' }}>
                      {c.productsCount} Ürün / {c.materialsCount} Materyal
                    </td>
                    <td style={{ padding: '14px 14px', textAlign: 'center', fontWeight: '800', color: '#60a5fa', fontSize: '15px' }}>
                      {c.totalSpots} Defa
                    </td>
                    <td style={{ padding: '14px 14px', textAlign: 'center', fontWeight: '800', color: '#34d399', fontSize: '14px' }}>
                      {formatDurationReadable(c.totalDurationSec)}
                    </td>
                    <td style={{ padding: '14px 14px', textAlign: 'center', fontWeight: '700', color: '#fbbf24' }}>
                      {c.avgDailySpots} spot / gün ({c.activeDaysCount} gün)
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {c.timeBlocksBreakdown.map(tb => {
                          const st = KUŞAK_BADGE_STYLES[tb.name] || {
                            bg: 'var(--bg-tertiary)',
                            border: 'var(--border-color)',
                            color: 'var(--text-primary)'
                          };
                          return (
                            <span
                              key={tb.name}
                              style={{
                                background: st.bg,
                                border: `1px solid ${st.border}`,
                                color: st.color,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700'
                              }}
                            >
                              {tb.name}: {tb.count}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          openMaterialAndCompanyDetail(c.companyId);
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: '#60a5fa',
                          fontWeight: '700',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Firma Raporuna Git
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. KUŞAK & SAAT DİLİMİ ANALİZİ */}
      {reportView === 'timeblocks' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Sol: Kuşak Bazlı Kartlar */}
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
              Yayın Kuşaklarına Göre Reklam Dağılımı
            </h3>
            {timeBlockReports.map(tb => {
              const st = KUŞAK_BADGE_STYLES[tb.timeBlockName] || {
                bg: 'rgba(139, 92, 246, 0.14)',
                border: 'rgba(139, 92, 246, 0.35)',
                color: '#c084fc'
              };
              return (
                <div
                  key={tb.timeBlockName}
                  style={{
                    background: 'var(--bg-primary)',
                    border: `1px solid ${st.border}`,
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '800', fontSize: '15px', color: st.color }}>{tb.timeBlockName}</span>
                    <span style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text-primary)' }}>
                      {tb.totalSpots} Spot ({formatDurationReadable(tb.totalDurationSec)}) • %{tb.sharePercentage}
                    </span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: '8px',
                      borderRadius: '999px',
                      background: 'var(--bg-tertiary)',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, tb.sharePercentage)}%`,
                        height: '100%',
                        background: st.color,
                        borderRadius: '999px'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <span>
                      {tb.uniqueCompaniesCount} Firma • {tb.uniqueMaterialsCount} Farklı Reklam Spotu
                    </span>
                    <span>Yayın Saatleri: {tb.hoursList.join(', ')}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sağ: Saat Dilimi Yoğunluğu */}
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
              Saat Dilimlerine Göre Yayın Yoğunluğu
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {hourlyReports.map(hr => {
                const maxSpots = Math.max(...hourlyReports.map(x => x.totalSpots), 1);
                const pct = Math.round((hr.totalSpots / maxSpots) * 100);
                return (
                  <div
                    key={hr.hourBucket}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '90px 160px 1fr 130px',
                      alignItems: 'center',
                      gap: '12px',
                      background: 'var(--bg-primary)',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontWeight: '800', color: '#60a5fa', fontSize: '14px' }}>
                      {hr.hourBucket}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                      {hr.timeBlockName}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        height: '8px',
                        borderRadius: '999px',
                        background: 'var(--bg-tertiary)',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                          borderRadius: '999px'
                        }}
                      />
                    </div>
                    <span style={{ textAlign: 'right', fontWeight: '800', fontSize: '13px', color: 'var(--text-primary)' }}>
                      {hr.totalSpots} Spot ({hr.totalDurationSec} sn)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. TÜM SPOT YAYIN KAYITLARI (AS-RUN / PLAN LOG) */}
      {reportView === 'logs' && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
              <thead
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  position: 'sticky',
                  top: 0,
                  zIndex: 2
                }}
              >
                <tr>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Tarih</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Yayın Saati</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Kuşak</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Kanal</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Firma</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Ürün</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Reklam Spotu</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Süre (sn)
                  </th>
                </tr>
              </thead>
              <tbody>
                {spotLogs.map(log => {
                  const st = KUŞAK_BADGE_STYLES[log.timeBlockName] || {
                    bg: 'var(--bg-tertiary)',
                    border: 'var(--border-color)',
                    color: 'var(--text-primary)'
                  };
                  return (
                    <tr
                      key={log.id}
                      onClick={() => openMaterialAndCompanyDetail(log.companyId, log.materialId)}
                      style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--text-primary)' }}>{log.date}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: '800', color: '#60a5fa' }}>
                        {log.time}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            background: st.bg,
                            border: `1px solid ${st.border}`,
                            color: st.color,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}
                        >
                          {log.timeBlockName}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        {log.channelName}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: '#60a5fa' }}>{log.companyName}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{log.productName}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {log.materialName}{' '}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          (#{log.clipId})
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '800', color: '#34d399' }}>
                        {log.durationSec} sn
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdsReportsTab;

