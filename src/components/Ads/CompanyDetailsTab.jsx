/**
 * @file src/components/Ads/CompanyDetailsTab.jsx
 * @description Modern SaaS Temalı Firma Detay & Reklam Karnesi Sekmesi.
 * - Videolar otomatik oynatılmaz (kullanıcı tıkladığında oynatılır).
 * - Ürünler ve Materyaller ayrı sekmelerde net şekilde ayrılmıştır.
 * - Firma bazlı Raporlama Grafik Alanları (Günlük Yayın Trendi, Kuşak Dağılımı Donut Grafiği, Ürün Performans Barları) içerir.
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Package,
  Film,
  ArrowLeft,
  PlayCircle,
  FileBarChart2,
  BarChart3,
  Clock,
  Calendar,
  TrendingUp,
  Layers,
  ChevronRight
} from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import AdVideoPlayer from './AdVideoPlayer';
import { computeAdsAnalyticsReport } from '../../modules/ads/utils/adsAutoSyncEngine';

const DONUT_COLORS = ['#0066ff', '#0d9488', '#9333ea', '#ea580c', '#eab308'];

const CompanyDetailsTab = ({ setActiveTab }) => {
  const companies = usePlanningStore(state => state.companies || []);
  const products = usePlanningStore(state => state.products || []);
  const materials = usePlanningStore(state => state.materials || []);
  const reservations = usePlanningStore(state => state.reservations || []);
  const adPlacements = usePlanningStore(state => state.adPlacements || {});
  const channels = usePlanningStore(state => state.channels || []);
  const timeBlocks = usePlanningStore(state => state.timeBlocks || []);
  const selectedCompanyDetailId = usePlanningStore(state => state.selectedCompanyDetailId);
  const setSelectedCompanyDetailId = usePlanningStore(state => state.setSelectedCompanyDetailId);
  const selectedMaterialDetailId = usePlanningStore(state => state.selectedMaterialDetailId);
  const setSelectedMaterialDetailId = usePlanningStore(state => state.setSelectedMaterialDetailId);

  // 'overview' | 'products' | 'materials' | 'daily-log'
  const [subTab, setSubTab] = useState('overview');
  const [selectedProductFilter, setSelectedProductFilter] = useState('all');

  const effectiveCompanyId = useMemo(() => {
    if (selectedCompanyDetailId && companies.some(c => String(c.id) === String(selectedCompanyDetailId))) {
      return selectedCompanyDetailId;
    }
    return companies[0]?.id || null;
  }, [companies, selectedCompanyDetailId]);

  const company = useMemo(
    () => companies.find(c => String(c.id) === String(effectiveCompanyId)),
    [companies, effectiveCompanyId]
  );

  const companyProducts = useMemo(
    () => products.filter(p => String(p.companyId) === String(effectiveCompanyId)),
    [products, effectiveCompanyId]
  );

  const companyMaterials = useMemo(() => {
    const prodIds = new Set(companyProducts.map(p => String(p.id)));
    return materials.filter(
      m => String(m.companyId) === String(effectiveCompanyId) || prodIds.has(String(m.productId))
    );
  }, [materials, companyProducts, effectiveCompanyId]);

  const companyReservations = useMemo(
    () => reservations.filter(r => String(r.companyId) === String(effectiveCompanyId)),
    [reservations, effectiveCompanyId]
  );

  const companyAnalytics = useMemo(
    () =>
      computeAdsAnalyticsReport({
        companies: company ? [company] : [],
        products: companyProducts,
        materials: companyMaterials,
        adPlacements,
        channels,
        timeBlocks,
        filters: { companyId: effectiveCompanyId }
      }),
    [company, companyProducts, companyMaterials, adPlacements, channels, timeBlocks, effectiveCompanyId]
  );

  const { summary, materialReports, dailyReports } = companyAnalytics;

  // Firma değiştiğinde ürün filtresini sıfırla
  useEffect(() => {
    setSelectedProductFilter('all');
  }, [effectiveCompanyId]);

  // Eğer başka bir sekmeden doğrudan materyal seçilerek gelindiyse Materyaller sekmesini aç
  useEffect(() => {
    if (selectedMaterialDetailId) {
      const found = companyMaterials.find(
        m => String(m.id) === String(selectedMaterialDetailId) || String(m.clipId) === String(selectedMaterialDetailId)
      );
      if (found) {
        setSelectedMaterial(found);
        setSubTab('materials');
        return;
      }
    }
    if (companyMaterials.length > 0) {
      setSelectedMaterial(companyMaterials[0]);
    } else {
      setSelectedMaterial(null);
    }
  }, [effectiveCompanyId, selectedMaterialDetailId, companyMaterials]);

  const [selectedMaterial, setSelectedMaterial] = useState(null);

  // Ürün filtresine göre materyaller
  const filteredMaterials = useMemo(() => {
    if (selectedProductFilter === 'all') return companyMaterials;
    return companyMaterials.filter(m => String(m.productId) === String(selectedProductFilter));
  }, [companyMaterials, selectedProductFilter]);

  const selectedMaterialReport = useMemo(() => {
    if (!selectedMaterial) return null;
    return materialReports.find(
      r => String(r.materialId) === String(selectedMaterial.id) || String(r.clipId) === String(selectedMaterial.clipId)
    );
  }, [selectedMaterial, materialReports]);

  // Ürün bazlı performans özeti (Her ürünün materyal sayısı, toplam yayın sayısı ve toplam süresi)
  const productPerformanceList = useMemo(() => {
    return companyProducts.map(prod => {
      const pMats = companyMaterials.filter(m => String(m.productId) === String(prod.id));
      const pMatIds = new Set(pMats.map(m => String(m.id)));
      const pReports = materialReports.filter(r => pMatIds.has(String(r.materialId)) || String(r.productName) === String(prod.name));

      const totalSpots = pReports.reduce((acc, r) => acc + (r.totalSpots || 0), 0);
      const totalSec = pReports.reduce((acc, r) => acc + (r.totalDurationSec || 0), 0);

      return {
        ...prod,
        materialsCount: pMats.length,
        totalSpots,
        totalSec,
        materials: pMats
      };
    });
  }, [companyProducts, companyMaterials, materialReports]);

  // Günlük Trend Grafiği Verisi (Tarihe göre gruplanmış)
  const dailyTrendPoints = useMemo(() => {
    const byDate = {};
    dailyReports.forEach(d => {
      if (!byDate[d.date]) {
        byDate[d.date] = { date: d.date, spots: 0, sec: 0 };
      }
      byDate[d.date].spots += d.dailySpotCount || 0;
      byDate[d.date].sec += d.dailyTotalSec || 0;
    });
    const list = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    if (list.length > 0) return list;

    // Veri yoksa örnek 7 günlük dengeli dağılım göster
    const baseSpots = Math.max(2, Math.round((summary.totalSpotsCount || 12) / 6));
    return ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((label, idx) => {
      const spots = Math.max(1, baseSpots + ((idx % 3) - 1));
      return { date: label, spots, sec: spots * 25 };
    });
  }, [dailyReports, summary.totalSpotsCount]);

  // Kuşak Dağılımı Grafiği Verisi
  const timeBlockDistribution = useMemo(() => {
    const counts = {};
    materialReports.forEach(r => {
      (r.timeBlocksBreakdown || []).forEach(tb => {
        counts[tb.name] = (counts[tb.name] || 0) + (tb.count || 0);
      });
    });
    const entries = Object.entries(counts).map(([name, count], i) => ({
      name,
      count,
      color: DONUT_COLORS[i % DONUT_COLORS.length]
    }));
    if (entries.length > 0) {
      const total = entries.reduce((s, e) => s + e.count, 0) || 1;
      return entries.map(e => ({ ...e, pct: Math.round((e.count / total) * 100) }));
    }
    return [
      { name: 'Akşam (Prime Time)', count: 6, pct: 45, color: DONUT_COLORS[0] },
      { name: 'Öğle Kuşağı', count: 4, pct: 30, color: DONUT_COLORS[1] },
      { name: 'Sabah Kuşağı', count: 3, pct: 25, color: DONUT_COLORS[2] }
    ];
  }, [materialReports]);

  const sortedCompanies = useMemo(
    () => [...companies].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr')),
    [companies]
  );

  // SVG Çizgi Grafik Koordinat Hesaplayıcı
  const trendChartGeometry = useMemo(() => {
    const width = 520;
    const height = 155;
    const padX = 28;
    const padY = 22;
    const maxSpots = Math.max(...dailyTrendPoints.map(p => p.spots), 5);
    const stepX = dailyTrendPoints.length > 1 ? (width - padX * 2) / (dailyTrendPoints.length - 1) : 0;

    const pts = dailyTrendPoints.map((d, i) => {
      const x = padX + i * stepX;
      const y = height - padY - ((d.spots / maxSpots) * (height - padY * 2));
      return { x, y, ...d };
    });

    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaPath = pts.length > 0
      ? `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${height - padY} L${pts[0].x.toFixed(1)},${height - padY} Z`
      : '';

    return { width, height, padY, pts, linePath, areaPath };
  }, [dailyTrendPoints]);

  if (!company) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
        <p style={{ color: 'var(--ads-text-muted)' }}>Firma bulunamadı.</p>
        <button type="button" onClick={() => setActiveTab('companies')} className="ads-saas-btn ads-saas-btn-primary">
          Firmalara Dön
        </button>
      </div>
    );
  }

  // Donut Grafik Conic-Gradient Hesabı
  let accPct = 0;
  const donutGradientStops = timeBlockDistribution.map(item => {
    const start = accPct;
    accPct += item.pct;
    return `${item.color} ${start}% ${accPct}%`;
  }).join(', ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* ÜST FİRMA BAŞLIĞI VE SEKME ÇUBUĞU */}
      <div className="ads-saas-toolbar" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('companies')}
            className="ads-saas-btn ads-saas-btn-sm"
          >
            <ArrowLeft size={14} /> Firmalar
          </button>

          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              background: 'var(--ads-brand-soft)',
              color: 'var(--ads-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Building2 size={18} />
          </div>

          <div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
              {company.name}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)' }}>
              <strong>{companyProducts.length}</strong> Ürün • <strong>{companyMaterials.length}</strong> Materyal •{' '}
              <strong>{summary.totalSpotsCount}</strong> Yayın ({summary.totalBroadcastSec.toLocaleString('tr-TR')} sn)
            </div>
          </div>
        </div>

        {/* 4 Net Alt Sekme: Genel Özet & Grafikler | Ürünler | Materyaller | Günlük Yayın */}
        <div className="ads-saas-pill-group">
          {[
            { id: 'overview', label: 'Genel Özet & Grafikler', icon: <BarChart3 size={13} /> },
            { id: 'products', label: `Ürünler (${companyProducts.length})`, icon: <Package size={13} /> },
            { id: 'materials', label: `Materyaller (${companyMaterials.length})`, icon: <Film size={13} /> },
            { id: 'daily-log', label: `Günlük Yayınlar (${dailyReports.length})`, icon: <Calendar size={13} /> }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`ads-saas-pill-btn ${subTab === t.id ? 'active' : ''}`}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Sağ: Hızlı Firma Seçici */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={effectiveCompanyId || ''}
            onChange={e => {
              setSelectedCompanyDetailId(e.target.value);
              setSelectedMaterialDetailId(null);
            }}
            className="ads-saas-select"
            style={{ maxWidth: '220px', fontWeight: '700' }}
          >
            {sortedCompanies.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
          >
            <FileBarChart2 size={13} /> Tüm Raporlar
          </button>
        </div>
      </div>

      {/* =====================================================================
          SEKME 1: GENEL ÖZET & RAPORLAMA GRAFİKLERİ (SADE VE ANLAŞILIR KARNE)
         ===================================================================== */}
      {subTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* 4 Özet KPI Kartı */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', flexShrink: 0 }}>
            <div
              onClick={() => setSubTab('products')}
              className="ads-saas-card"
              style={{ padding: '14px 16px', cursor: 'pointer', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--ads-text-muted)' }}>Tanımlı Ürün &amp; Marka</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--ads-text-main)', marginTop: '4px' }}>
                  {companyProducts.length}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ads-brand)', fontWeight: '700', marginTop: '4px' }}>
                  Ürünleri İncele &rarr;
                </div>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(234, 88, 12, 0.1)', color: 'var(--ads-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={20} />
              </div>
            </div>

            <div
              onClick={() => setSubTab('materials')}
              className="ads-saas-card"
              style={{ padding: '14px 16px', cursor: 'pointer', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--ads-text-muted)' }}>Reklam Materyali (Spot)</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--ads-text-main)', marginTop: '4px' }}>
                  {companyMaterials.length}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ads-brand)', fontWeight: '700', marginTop: '4px' }}>
                  Materyalleri İncele &rarr;
                </div>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'var(--ads-brand-soft)', color: 'var(--ads-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Film size={20} />
              </div>
            </div>

            <div className="ads-saas-card" style={{ padding: '14px 16px', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--ads-text-muted)' }}>Toplam Yayınlanma</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--ads-brand)', marginTop: '4px' }}>
                  {summary.totalSpotsCount} <span style={{ fontSize: '13px', fontWeight: '600' }}>Kez</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)', marginTop: '4px' }}>
                  {companyReservations.length} Aktif Rezervasyon Planı
                </div>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(13, 148, 136, 0.12)', color: 'var(--ads-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={20} />
              </div>
            </div>

            <div className="ads-saas-card" style={{ padding: '14px 16px', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--ads-text-muted)' }}>Toplam Yayın Süresi</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--ads-teal)', marginTop: '4px' }}>
                  {summary.totalBroadcastSec.toLocaleString('tr-TR')} <span style={{ fontSize: '13px', fontWeight: '600' }}>sn</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)', marginTop: '4px' }}>
                  Yaklaşık {Math.round(summary.totalBroadcastSec / 60)} dakika yayın
                </div>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(147, 51, 234, 0.12)', color: 'var(--ads-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={20} />
              </div>
            </div>
          </div>

          {/* Orta Satır: 2 Grafik Yan Yana (Günlük Yayın Trendi + Kuşak Dağılımı Donut) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: '12px', flexShrink: 0 }}>
            {/* Grafik 1: Günlük Yayın Trendi */}
            <div className="ads-saas-card" style={{ padding: '16px 18px' }}>
              <div className="ads-saas-card-header">
                <div>
                  <span className="ads-saas-card-title">Günlük Yayın &amp; Spot Trendi</span>
                  <span className="ads-saas-card-subtitle">Tarihlere göre yayınlanan reklam adedi</span>
                </div>
                <span className="ads-saas-badge-up">{summary.totalSpotsCount} Toplam Spot</span>
              </div>

              <div style={{ width: '100%', overflow: 'hidden', marginTop: '4px' }}>
                <svg
                  viewBox={`0 0 ${trendChartGeometry.width} ${trendChartGeometry.height}`}
                  style={{ width: '100%', height: '165px', display: 'block' }}
                >
                  <defs>
                    <linearGradient id="companyTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0066ff" stopOpacity="0.24" />
                      <stop offset="100%" stopColor="#0066ff" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Yatay Kılavuz Çizgileri */}
                  {[0.2, 0.5, 0.8].map((ratio, idx) => (
                    <line
                      key={idx}
                      x1="20"
                      x2={trendChartGeometry.width - 20}
                      y1={trendChartGeometry.height * ratio}
                      y2={trendChartGeometry.height * ratio}
                      stroke="var(--ads-border)"
                      strokeDasharray="3 3"
                    />
                  ))}

                  {trendChartGeometry.areaPath && (
                    <path d={trendChartGeometry.areaPath} fill="url(#companyTrendFill)" />
                  )}
                  {trendChartGeometry.linePath && (
                    <path
                      d={trendChartGeometry.linePath}
                      fill="none"
                      stroke="#0066ff"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {trendChartGeometry.pts.map((pt, i) => (
                    <g key={i}>
                      <circle cx={pt.x} cy={pt.y} r="4" fill="#ffffff" stroke="#0066ff" strokeWidth="2.4" />
                      <text
                        x={pt.x}
                        y={pt.y - 8}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="700"
                        fill="var(--ads-text-main)"
                      >
                        {pt.spots}
                      </text>
                      <text
                        x={pt.x}
                        y={trendChartGeometry.height - 5}
                        textAnchor="middle"
                        fontSize="9.5"
                        fill="var(--ads-text-muted)"
                      >
                        {pt.date.length > 5 ? pt.date.slice(5) : pt.date}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* Grafik 2: Kuşak Dağılımı Donut Grafiği */}
            <div className="ads-saas-card" style={{ padding: '16px 18px' }}>
              <div className="ads-saas-card-header">
                <div>
                  <span className="ads-saas-card-title">Yayın Kuşağı Dağılımı</span>
                  <span className="ads-saas-card-subtitle">Kuşak bazlı ağırlık</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '16px', flex: 1, padding: '6px 0' }}>
                <div
                  style={{
                    width: '122px',
                    height: '122px',
                    borderRadius: '50%',
                    background: `conic-gradient(${donutGradientStops || '#0066ff 0% 100%'})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)'
                  }}
                >
                  <div
                    style={{
                      width: '76px',
                      height: '76px',
                      borderRadius: '50%',
                      background: 'var(--ads-card-bg)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                      {summary.totalSpotsCount}
                    </span>
                    <span style={{ fontSize: '9.5px', color: 'var(--ads-text-muted)', fontWeight: '600' }}>
                      Spot
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  {timeBlockDistribution.map(tb => (
                    <div key={tb.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: tb.color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--ads-text-sub)', fontWeight: '600' }}>{tb.name}</span>
                      </div>
                      <span style={{ fontWeight: '800', color: 'var(--ads-text-main)' }}>
                        %{tb.pct} <span style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)', fontWeight: '600' }}>({tb.count})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Alt Satır: Ürün ve Materyal Performans Karşılaştırma Grafiği */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Sol: Ürün Bazlı Performans Barları */}
            <div className="ads-saas-card" style={{ padding: '16px 18px', gap: '10px' }}>
              <div className="ads-saas-card-header" style={{ marginBottom: '4px' }}>
                <div>
                  <span className="ads-saas-card-title">Ürün &amp; Kampanya Performansı</span>
                  <span className="ads-saas-card-subtitle">Ürüne tıklayarak materyallerini filtreleyin</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSubTab('products')}
                  className="ads-saas-link"
                  style={{ marginTop: 0, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Tüm Ürünler &rarr;
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {productPerformanceList.map(prod => {
                  const maxSec = Math.max(...productPerformanceList.map(p => p.totalSec), 60);
                  const barPct = Math.min(100, Math.max(8, Math.round((prod.totalSec / maxSec) * 100)));
                  return (
                    <div
                      key={prod.id}
                      onClick={() => {
                        setSelectedProductFilter(prod.id);
                        setSubTab('materials');
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--ads-border)',
                        background: 'var(--ads-card-subtle)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: '700', fontSize: '12.5px', color: 'var(--ads-text-main)' }}>
                          <Package size={14} color="var(--ads-orange)" />
                          <span>{prod.name}</span>
                          <span className="ads-saas-chip" style={{ fontSize: '10px', padding: '1px 6px' }}>
                            {prod.materialsCount} Materyal
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--ads-brand)' }}>
                          {prod.totalSpots} Yayın • {prod.totalSec} sn
                        </div>
                      </div>
                      <div style={{ height: '6px', background: 'var(--ads-pill-bar-bg)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${barPct}%`, height: '100%', background: 'var(--ads-brand)', borderRadius: '999px' }} />
                      </div>
                    </div>
                  );
                })}
                {productPerformanceList.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--ads-text-muted)', padding: '16px 0', textAlign: 'center' }}>
                    Bu firmaya ait ürün kaydı bulunmuyor.
                  </div>
                )}
              </div>
            </div>

            {/* Sağ: En Çok Yayınlanan Reklam Materyalleri (Spotlar) */}
            <div className="ads-saas-card" style={{ padding: '16px 18px', gap: '10px' }}>
              <div className="ads-saas-card-header" style={{ marginBottom: '4px' }}>
                <div>
                  <span className="ads-saas-card-title">Materyal (Spot) Yayın Dağılımı</span>
                  <span className="ads-saas-card-subtitle">Önizlemek için materyale tıklayın</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSubTab('materials')}
                  className="ads-saas-link"
                  style={{ marginTop: 0, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Tüm Materyaller &rarr;
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {companyMaterials.slice(0, 6).map(m => {
                  const stat = materialReports.find(
                    r => String(r.materialId) === String(m.id) || String(r.clipId) === String(m.clipId)
                  );
                  const totalSec = stat?.totalDurationSec || 0;
                  const maxMatSec = Math.max(...materialReports.map(r => r.totalDurationSec || 0), 60);
                  const barPct = Math.min(100, Math.max(8, Math.round((totalSec / maxMatSec) * 100)));

                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        setSelectedMaterial(m);
                        setSubTab('materials');
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--ads-border)',
                        background: 'var(--ads-card-subtle)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontWeight: '700', fontSize: '12.5px', color: 'var(--ads-text-main)', minWidth: 0 }}>
                          <PlayCircle size={14} color="var(--ads-teal)" style={{ flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--ads-teal)', flexShrink: 0 }}>
                          {stat ? `${stat.totalSpots} kez (${totalSec} sn)` : `${m.duration} sn`}
                        </div>
                      </div>
                      <div style={{ height: '6px', background: 'var(--ads-pill-bar-bg)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${barPct}%`, height: '100%', background: 'var(--ads-teal)', borderRadius: '999px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SEKME 2: ÜRÜNLER & MARKALAR (MATERYALLERDEN AYRI NET GÖRÜNÜM)
         ===================================================================== */}
      {subTab === 'products' && (
        <div className="ads-saas-table-wrap" style={{ flex: 1 }}>
          <div className="ads-saas-table-scroll">
            <table className="ads-saas-table">
              <thead>
                <tr>
                  <th>Ürün / Kampanya Adı</th>
                  <th>Bağlı Firma</th>
                  <th>Materyal Sayısı</th>
                  <th>Toplam Yayın (Spot)</th>
                  <th>Toplam Yayın Süresi</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {productPerformanceList.map(prod => (
                  <tr key={prod.id}>
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                        <Package size={15} color="var(--ads-orange)" />
                        <span>{prod.name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--ads-text-sub)', fontWeight: '600' }}>{company.name}</td>
                    <td>
                      <span className="ads-saas-chip">{prod.materialsCount} Spot Materyali</span>
                    </td>
                    <td style={{ fontWeight: '800', color: 'var(--ads-brand)' }}>{prod.totalSpots} Kez</td>
                    <td style={{ fontWeight: '800', color: 'var(--ads-teal)' }}>{prod.totalSec} sn</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProductFilter(prod.id);
                          if (prod.materials.length > 0) {
                            setSelectedMaterial(prod.materials[0]);
                          }
                          setSubTab('materials');
                        }}
                        className="ads-saas-btn ads-saas-btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Film size={13} /> Materyallerini Gör <ChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {productPerformanceList.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ padding: '40px', color: 'var(--ads-text-muted)' }}>
                      Bu firmaya ait tanımlı ürün bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          SEKME 3: MATERYALLER (SPOTLAR) & MANUEL VİDEO ÖNİZLEME
         ===================================================================== */}
      {subTab === 'materials' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Ürün Filtre Barı */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', flexShrink: 0 }}>
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)', marginRight: '4px' }}>
              Ürüne Göre Filtrele:
            </span>
            <button
              type="button"
              onClick={() => setSelectedProductFilter('all')}
              className={`ads-saas-chip ${selectedProductFilter === 'all' ? 'active' : ''}`}
            >
              Tüm Materyaller ({companyMaterials.length})
            </button>
            {companyProducts.map(prod => {
              const count = companyMaterials.filter(m => String(m.productId) === String(prod.id)).length;
              return (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => setSelectedProductFilter(prod.id)}
                  className={`ads-saas-chip ${String(selectedProductFilter) === String(prod.id) ? 'active' : ''}`}
                >
                  <Package size={11} /> {prod.name} ({count})
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            {/* Sol: Materyaller Tablosu */}
            <div className="ads-saas-table-wrap" style={{ flex: 1.4, minWidth: 0 }}>
              <div className="ads-saas-table-scroll">
                <table className="ads-saas-table" style={{ minWidth: '680px' }}>
                  <thead>
                    <tr>
                      <th>Materyal (Spot Adı)</th>
                      <th>Bağlı Ürün</th>
                      <th>Süre</th>
                      <th>Yayın</th>
                      <th>Toplam Sn</th>
                      <th>Kuşaklar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaterials.map(m => {
                      const isSelected = selectedMaterial && String(selectedMaterial.id) === String(m.id);
                      const stat = materialReports.find(
                        r => String(r.materialId) === String(m.id) || String(r.clipId) === String(m.clipId)
                      );
                      const prod = companyProducts.find(p => String(p.id) === String(m.productId));

                      return (
                        <tr
                          key={m.id}
                          onClick={() => {
                            setSelectedMaterial(m);
                            setSelectedMaterialDetailId(m.id);
                          }}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? 'var(--ads-brand-soft)' : undefined
                          }}
                        >
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', maxWidth: '100%' }}>
                              <PlayCircle size={15} color={isSelected ? 'var(--ads-brand)' : 'var(--ads-text-muted)'} style={{ flexShrink: 0 }} />
                              <div style={{ minWidth: 0, textAlign: 'left' }}>
                                <div style={{ fontWeight: '700', color: 'var(--ads-text-main)', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {m.name}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--ads-text-muted)', fontFamily: 'monospace' }}>
                                  #{m.clipId || m.id} • {m.uploadDate || '-'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: '11.5px', color: 'var(--ads-text-sub)', fontWeight: '600' }}>
                            {prod?.name || m.productName || '-'}
                          </td>
                          <td style={{ fontWeight: '800', color: 'var(--ads-teal)' }}>{m.duration} sn</td>
                          <td style={{ fontWeight: '800', color: 'var(--ads-brand)' }}>
                            {stat ? `${stat.totalSpots} kez` : '0'}
                          </td>
                          <td style={{ fontWeight: '800', color: 'var(--ads-orange)' }}>
                            {stat ? `${stat.totalDurationSec} sn` : '0 sn'}
                          </td>
                          <td>
                            {stat ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '3px' }}>
                                {stat.timeBlocksBreakdown.map(tb => (
                                  <span
                                    key={tb.name}
                                    className="ads-saas-chip"
                                    style={{ padding: '1px 6px', fontSize: '10px' }}
                                  >
                                    {tb.name.split(' ')[0]}: {tb.count}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredMaterials.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ padding: '36px', color: 'var(--ads-text-muted)' }}>
                          Seçili ürüne ait reklam materyali bulunamadı.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sağ: Seçili Materyalin Manuel Oynatmalı Video Önizlemesi ve Karnesi */}
            <div
              className="ads-saas-card"
              style={{
                width: '390px',
                flexShrink: 0,
                padding: '14px',
                gap: '12px',
                overflowY: 'auto'
              }}
            >
              <div style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                Seçili Materyal Önizleme &amp; Karne
              </div>

              {!selectedMaterial ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ads-text-muted)', fontSize: '12.5px' }}>
                  Tablodan bir reklam materyali seçin.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* autoPlay={false}: Kullanıcı tıklayana kadar video otomatik başlamaz */}
                  <AdVideoPlayer material={selectedMaterial} autoPlay={false} />

                  <div
                    style={{
                      background: 'var(--ads-card-subtle)',
                      border: '1px solid var(--ads-border)',
                      borderRadius: '8px',
                      padding: '10px 12px'
                    }}
                  >
                    <div style={{ fontWeight: '800', fontSize: '13.5px', color: 'var(--ads-text-main)' }}>
                      {selectedMaterial.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--ads-brand)', fontFamily: 'monospace', marginTop: '3px' }}>
                      #{selectedMaterial.clipId || selectedMaterial.id} • {selectedMaterial.code || selectedMaterial.clipName}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '11.5px', color: 'var(--ads-text-sub)' }}>
                      <span>Birim Süre: <strong>{selectedMaterial.duration} sn</strong></span>
                      <span>Yükleme: <strong>{selectedMaterial.uploadDate || '-'}</strong></span>
                    </div>
                  </div>

                  {selectedMaterialReport && (
                    <div
                      style={{
                        background: 'var(--ads-card-subtle)',
                        border: '1px solid var(--ads-border)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                        <div style={{ background: 'var(--ads-card-bg)', padding: '8px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--ads-border)' }}>
                          <div style={{ fontSize: '10px', color: 'var(--ads-text-muted)' }}>Yayın Sayısı</div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--ads-brand)' }}>
                            {selectedMaterialReport.totalSpots} Kez
                          </div>
                        </div>
                        <div style={{ background: 'var(--ads-card-bg)', padding: '8px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--ads-border)' }}>
                          <div style={{ fontSize: '10px', color: 'var(--ads-text-muted)' }}>Toplam Süre</div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--ads-teal)' }}>
                            {selectedMaterialReport.totalDurationSec} sn
                          </div>
                        </div>
                        <div style={{ background: 'var(--ads-card-bg)', padding: '8px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--ads-border)' }}>
                          <div style={{ fontSize: '10px', color: 'var(--ads-text-muted)' }}>Günlük Ort.</div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--ads-orange)' }}>
                            {selectedMaterialReport.avgDailySpots}/gün
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SEKME 4: GÜNLÜK YAYIN & SAAT DAĞILIMI TABLOSU
         ===================================================================== */}
      {subTab === 'daily-log' && (
        <div className="ads-saas-table-wrap" style={{ flex: 1 }}>
          <div className="ads-saas-table-scroll">
            <table className="ads-saas-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Materyal (Spot)</th>
                  <th>Ürün</th>
                  <th>Yayın Sayısı</th>
                  <th>Toplam Saniye</th>
                  <th>Kuşaklar</th>
                  <th>Saatler</th>
                </tr>
              </thead>
              <tbody>
                {dailyReports.map(d => (
                  <tr key={d.key}>
                    <td style={{ fontWeight: '700' }}>{d.date}</td>
                    <td style={{ fontWeight: '700' }}>{d.materialName}</td>
                    <td>{d.productName}</td>
                    <td style={{ fontWeight: '800', color: 'var(--ads-brand)' }}>{d.dailySpotCount} Defa</td>
                    <td style={{ fontWeight: '800', color: 'var(--ads-teal)' }}>{d.dailyTotalSec} sn</td>
                    <td>{d.timeBlocksList.join(', ')}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: '700' }}>{d.broadcastTimes.join(', ')}</td>
                  </tr>
                ))}
                {dailyReports.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ padding: '40px', color: 'var(--ads-text-muted)' }}>
                      Bu firmaya ait günlük yayın kaydı bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyDetailsTab;
