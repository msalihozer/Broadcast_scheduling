/**
 * @file src/components/Ads/dashboard/DashboardMiddleGridSections.jsx
 * @description TailAdmin v2 — Reklam & Rezervasyon Dashboard 5., 6., 7. ve 8. Bölümleri:
 * - Bölüm 5: Reklam Envanteri & Önümüzdeki 7, 15, 30 Günlük Envanter Doluluk Tahmini
 * - Bölüm 6: Firma, Ürün ve Sektör Analizi (En çok reklam veren firmalar, ürünler ve sektör kırılımı)
 * - Bölüm 7: Materyal Kontrolü & Geçerliliği (Eksik, onay bekleyen, süresi dolan, teknik hatalı materyaller)
 * - Bölüm 8: Operasyon, Reklam Çakışması ve Kritik Uyarılar (Aynı kuşağa kapasite üzeri çakışan rezervasyonlar, yaklaşan ve eksik yayınlar)
 */
import React, { useState } from 'react';
import {
  LayoutGrid, Building2, Film, AlertOctagon, CheckCircle2,
  ArrowUpRight, Check, Wrench
} from 'lucide-react';

const formatCurrencyShort = (val) => {
  const num = Number(val) || 0;
  return `₺${num.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
};

const DashboardMiddleGridSections = ({
  inventoryAnalytics,
  companyProductSectorAnalytics,
  materialControlAnalytics,
  operationsAlertsAnalytics,
  onNavigateTab,
  onSelectCompanyDetail,
  onQuickApproveMaterial,
  onQuickFixConflict,
  onSelectSectorFilter
}) => {
  const [activeEntityTab, setActiveEntityTab] = useState('companies'); // 'companies' | 'products' | 'sectors'

  const { topCompanies = [], topProducts = [], sectorBreakdown = [] } = companyProductSectorAnalytics || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ==========================================================================
          1. SATIR: BÖLÜM 5 (REKLAM ENVANTERİ & 7-15-30 GÜN TAHMİNİ) & BÖLÜM 6 (FİRMA/ÜRÜN/SEKTÖR)
         ========================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
          gap: '20px'
        }}
      >
        {/* BÖLÜM 5: REKLAM ENVANTERİ & 7/15/30 GÜNLÜK ENVANTER TAHMİNİ */}
        <div className="ta-card" style={{ gap: '16px' }}>
          <div className="ta-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                className="ta-icon-box"
                style={{
                  width: '40px',
                  height: '40px',
                  background: 'var(--ads-info-soft)',
                  color: 'var(--ads-info-text)',
                  borderColor: 'transparent'
                }}
              >
                <LayoutGrid size={19} />
              </div>
              <div>
                <h3 className="ta-card-title">
                  5. Reklam Envanteri &amp; 7 / 15 / 30 Günlük Doluluk Tahmini
                </h3>
                <p className="ta-card-desc">
                  Boş reklam kuşakları, doluluk oranı, kalan kapasite ve gelecek dönem envanter projeksiyonu
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('time-blocks')}
              className="ads-saas-btn"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              <span>Kuşaklar</span>
              <ArrowUpRight size={13} />
            </button>
          </div>

          {/* 3 Ana Envanter Özeti */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--ads-pill-bar-bg)', border: '1px solid var(--ads-border)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-sub)' }}>Boş Reklam Kuşağı</div>
              <div style={{ fontSize: '21px', fontWeight: '800', color: inventoryAnalytics.emptyBreaksCount > 0 ? '#dc6803' : '#039855', marginTop: '4px' }}>
                {inventoryAnalytics.emptyBreaksCount} Kuşak
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>
                Toplam {inventoryAnalytics.totalBreakSlots} kuşak içinde
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--ads-brand-soft)', border: '1px solid rgba(70, 95, 255, 0.22)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-brand)' }}>Envanter Doluluk Oranı</div>
              <div style={{ fontSize: '21px', fontWeight: '800', color: 'var(--ads-brand)', marginTop: '4px' }}>
                %{inventoryAnalytics.fillRatePct}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>
                {inventoryAnalytics.usedSpots} / {inventoryAnalytics.totalSpotCapacity} spot dolu
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--ads-success-soft)', border: '1px solid rgba(3, 152, 85, 0.22)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-success-text)' }}>Kalan Reklam Kapasitesi</div>
              <div style={{ fontSize: '21px', fontWeight: '800', color: 'var(--ads-success-text)', marginTop: '4px' }}>
                {inventoryAnalytics.remainingCapacitySpots.toLocaleString('tr-TR')} Spot
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>
                Satılabilir boş envanter
              </div>
            </div>
          </div>

          {/* ÖZEL ÖZELLİK 3: ÖNÜMÜZDEKİ 7, 15 VE 30 GÜNÜN ENVANTER TAHMİNİ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--ads-text-main)' }}>
                Envanter Doluluk Tahmini (7 / 15 / 30 Günlük Projeksiyon)
              </span>
              <span className="ta-badge ta-badge-brand">Kapasite Tahmini</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[inventoryAnalytics.forecast7d, inventoryAnalytics.forecast15d, inventoryAnalytics.forecast30d].map(fc => (
                <div
                  key={fc.horizonDays}
                  style={{
                    padding: '11px 13px',
                    borderRadius: '12px',
                    background: 'var(--ads-pill-bar-bg)',
                    border: '1px solid var(--ads-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700' }}>
                    <span style={{ color: 'var(--ads-text-main)' }}>{fc.label}</span>
                    <span style={{ color: 'var(--ads-brand)' }}>%{fc.fillPct}</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', borderRadius: '999px', background: 'var(--ads-border)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.max(6, fc.fillPct)}%`,
                        height: '100%',
                        background: fc.fillPct > 85 ? '#d92d20' : fc.fillPct > 60 ? '#465fff' : '#12b76a'
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Dolu: {fc.reservedSpots}</span>
                    <span>Boş: {fc.freeSpots} spot</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BÖLÜM 6: FİRMA, ÜRÜN VE SEKTÖR ANALİZİ */}
        <div className="ta-card" style={{ gap: '16px' }}>
          <div className="ta-card-header" style={{ flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                className="ta-icon-box"
                style={{
                  width: '40px',
                  height: '40px',
                  background: 'var(--ads-success-soft)',
                  color: 'var(--ads-success-text)',
                  borderColor: 'transparent'
                }}
              >
                <Building2 size={19} />
              </div>
              <div>
                <h3 className="ta-card-title">
                  6. Firma, Ürün ve Sektör Analizi
                </h3>
                <p className="ta-card-desc">
                  En çok reklam veren firmalar, öne çıkan ürünler ve sektörel dağılım
                </p>
              </div>
            </div>

            <div className="ads-saas-pill-group">
              {[
                { id: 'companies', label: 'En İyi Firmalar' },
                { id: 'products', label: 'En İyi Ürünler' },
                { id: 'sectors', label: 'Sektörler' }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveEntityTab(t.id)}
                  className={`ads-saas-pill-btn ${activeEntityTab === t.id ? 'active' : ''}`}
                  style={{ padding: '5px 11px', fontSize: '11.5px' }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sekme İçeriği */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeEntityTab === 'companies' &&
              topCompanies.map((c, idx) => (
                <div
                  key={c.id || c.name || idx}
                  onClick={() => onSelectCompanyDetail && c.id && onSelectCompanyDetail(c.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 13px',
                    borderRadius: '11px',
                    background: 'var(--ads-pill-bar-bg)',
                    border: '1px solid var(--ads-border)',
                    cursor: c.id ? 'pointer' : 'default'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <span
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '7px',
                        background: 'var(--ads-brand-soft)',
                        color: 'var(--ads-brand)',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--ads-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>
                        {c.sector} • {c.reservationsCount} Kampanya
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <span className="ta-badge ta-badge-success">
                      {c.airedSpots}/{c.plannedSpots} Spot
                    </span>
                    <span style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--ads-text-main)' }}>
                      {formatCurrencyShort(c.revenue)}
                    </span>
                  </div>
                </div>
              ))}

            {activeEntityTab === 'products' &&
              topProducts.map((p, idx) => (
                <div
                  key={p.name || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 13px',
                    borderRadius: '11px',
                    background: 'var(--ads-pill-bar-bg)',
                    border: '1px solid var(--ads-border)'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--ads-text-main)' }}>
                      {idx + 1}. {p.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>
                      {p.companyName} • {p.sector}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="ta-badge ta-badge-brand">{p.spots} Spot</span>
                    <span style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--ads-text-main)' }}>
                      {formatCurrencyShort(p.revenue)}
                    </span>
                  </div>
                </div>
              ))}

            {activeEntityTab === 'sectors' &&
              sectorBreakdown.map(s => (
                <div
                  key={s.sector}
                  onClick={() => onSelectSectorFilter && onSelectSectorFilter(s.sector)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                    padding: '9px 13px',
                    borderRadius: '11px',
                    background: 'var(--ads-pill-bar-bg)',
                    border: '1px solid var(--ads-border)',
                    cursor: 'pointer'
                  }}
                  title="Bu sektöre göre Dashboard'u filtrelemek için tıklayın"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: '700' }}>
                    <span style={{ color: 'var(--ads-text-main)' }}>{s.sector}</span>
                    <span style={{ color: 'var(--ads-brand)' }}>
                      %{s.pct} ({s.spots} spot)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', borderRadius: '999px', background: 'var(--ads-border)', overflow: 'hidden' }}>
                    <div style={{ width: `${s.pct}%`, height: '100%', background: 'var(--ads-brand)' }} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ==========================================================================
          2. SATIR: BÖLÜM 7 (MATERYAL KONTROLÜ & GEÇERLİLİK) & BÖLÜM 8 (OPERASYON VE UYARILAR)
         ========================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
          gap: '20px'
        }}
      >
        {/* BÖLÜM 7: MATERYAL KONTROLÜ & GEÇERLİLİK TAKİBİ */}
        <div className="ta-card" style={{ gap: '16px' }}>
          <div className="ta-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                className="ta-icon-box"
                style={{
                  width: '40px',
                  height: '40px',
                  background: 'var(--ads-warning-soft)',
                  color: 'var(--ads-warning-text)',
                  borderColor: 'transparent'
                }}
              >
                <Film size={19} />
              </div>
              <div>
                <h3 className="ta-card-title">
                  7. Materyal Kontrolü &amp; Geçerlilik Takibi
                </h3>
                <p className="ta-card-desc">
                  Teknik kontrol, yayın onayı, kullanım süresi dolan ve eksik materyaller
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('materials')}
              className="ads-saas-btn"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              <span>Materyaller ({materialControlAnalytics.totalMaterials})</span>
              <ArrowUpRight size={13} />
            </button>
          </div>

          {/* 5 Materyal Durum Kartı */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
            {[
              { label: 'Onaylı', count: materialControlAnalytics.approvedCount, color: '#039855', bg: 'var(--ads-success-soft)' },
              { label: 'Onay Bekleyen', count: materialControlAnalytics.pendingCount, color: '#dc6803', bg: 'var(--ads-warning-soft)' },
              { label: 'Teknik Hatalı', count: materialControlAnalytics.technicalErrorCount, color: '#d92d20', bg: 'var(--ads-error-soft)' },
              { label: 'Süresi Dolan', count: materialControlAnalytics.expiredCount, color: '#465fff', bg: 'var(--ads-brand-soft)' },
              { label: 'Eksik Dosya', count: materialControlAnalytics.missingCount, color: '#e11d48', bg: 'rgba(225, 29, 72, 0.08)' }
            ].map(item => (
              <div
                key={item.label}
                style={{
                  padding: '10px 8px',
                  borderRadius: '11px',
                  background: item.bg,
                  border: `1px solid ${item.color}28`,
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: '700', color: item.color }}>{item.label}</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--ads-text-main)', marginTop: '3px' }}>
                  {item.count}
                </div>
              </div>
            ))}
          </div>

          {/* Hızlı Materyal Onay / Denetim Listesi */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '165px', overflowY: 'auto' }}>
            {materialControlAnalytics.attentionMaterials.slice(0, 4).map(mat => (
              <div
                key={mat.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: 'var(--ads-pill-bar-bg)',
                  border: '1px solid var(--ads-border)',
                  gap: '10px'
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--ads-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {mat.name || mat.clipName}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>
                    {mat.companyName} • {mat.duration || 30} sn {mat.validUntil ? `• Son: ${mat.validUntil}` : ''}
                  </div>
                </div>

                <span
                  className="ta-badge"
                  style={{
                    background: mat.validityMeta.bg,
                    color: mat.validityMeta.color,
                    flexShrink: 0
                  }}
                >
                  {mat.validityMeta.label}
                </span>

                {mat.validity !== 'approved' && onQuickApproveMaterial && (
                  <button
                    type="button"
                    onClick={() => onQuickApproveMaterial(mat.id)}
                    className="ads-saas-btn"
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      color: 'var(--ads-success-text)',
                      borderColor: 'rgba(3, 152, 85, 0.3)'
                    }}
                    title="Teknik kontrolü ve yayın onayını tamamla"
                  >
                    <Check size={12} /> Onayla
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* BÖLÜM 8: OPERASYON, REKLAM ÇAKIŞMASI VE UYARILAR */}
        <div className="ta-card" style={{ gap: '16px' }}>
          <div className="ta-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                className="ta-icon-box"
                style={{
                  width: '40px',
                  height: '40px',
                  background: 'var(--ads-error-soft)',
                  color: 'var(--ads-error-text)',
                  borderColor: 'transparent'
                }}
              >
                <AlertOctagon size={19} />
              </div>
              <div>
                <h3 className="ta-card-title">
                  8. Operasyon, Reklam Çakışması ve Uyarılar
                </h3>
                <p className="ta-card-desc">
                  Kapasite üzeri çakışan kuşaklar, yaklaşan yayınlar ve eksik/makegood uyarıları
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('planning')}
              className="ads-saas-btn"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              <span>Kuşaklara Müdahale Et</span>
              <ArrowUpRight size={13} />
            </button>
          </div>

          {/* 3 Operasyonel Uyarı Sayacı */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div
              style={{
                padding: '11px 13px',
                borderRadius: '11px',
                background: operationsAlertsAnalytics.conflictingBreaksCount > 0 ? 'var(--ads-error-soft)' : 'var(--ads-success-soft)',
                border: `1px solid ${operationsAlertsAnalytics.conflictingBreaksCount > 0 ? 'rgba(217, 45, 32, 0.25)' : 'rgba(3, 152, 85, 0.25)'}`
              }}
            >
              <div style={{ fontSize: '11.5px', fontWeight: '700', color: operationsAlertsAnalytics.conflictingBreaksCount > 0 ? 'var(--ads-error-text)' : 'var(--ads-success-text)' }}>
                Kuşak Çakışması / Aşım
              </div>
              <div style={{ fontSize: '21px', fontWeight: '800', color: 'var(--ads-text-main)', marginTop: '3px' }}>
                {operationsAlertsAnalytics.conflictingBreaksCount} Kuşak
              </div>
            </div>

            <div
              style={{
                padding: '11px 13px',
                borderRadius: '11px',
                background: 'var(--ads-warning-soft)',
                border: '1px solid rgba(220, 104, 3, 0.25)'
              }}
            >
              <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-warning-text)' }}>
                Yaklaşan Yayınlar (7g)
              </div>
              <div style={{ fontSize: '21px', fontWeight: '800', color: 'var(--ads-text-main)', marginTop: '3px' }}>
                {operationsAlertsAnalytics.upcomingBroadcastsCount} Plan
              </div>
            </div>

            <div
              style={{
                padding: '11px 13px',
                borderRadius: '11px',
                background: 'var(--ads-brand-soft)',
                border: '1px solid rgba(70, 95, 255, 0.25)'
              }}
            >
              <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-brand)' }}>
                Eksik Yayın / Telafi
              </div>
              <div style={{ fontSize: '21px', fontWeight: '800', color: 'var(--ads-text-main)', marginTop: '3px' }}>
                {operationsAlertsAnalytics.missingBroadcastsCount} Kampanya
              </div>
            </div>
          </div>

          {/* Canlı Uyarı Akışı */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '165px', overflowY: 'auto' }}>
            {operationsAlertsAnalytics.conflictingBreaks.map(cf => (
              <div
                key={cf.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: 'var(--ads-error-soft)',
                  border: '1px solid rgba(217, 45, 32, 0.25)',
                  gap: '10px'
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--ads-error-text)' }}>
                    {cf.channelLabel} • {cf.date} ({cf.time}) — {cf.label}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ads-text-sub)' }}>
                    {cf.reasons.join(' • ')}
                  </div>
                </div>
                {onQuickFixConflict && (
                  <button
                    type="button"
                    onClick={() => onQuickFixConflict(cf)}
                    className="ads-saas-btn"
                    style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--ads-error-text)' }}
                  >
                    <Wrench size={11} /> Dengele
                  </button>
                )}
              </div>
            ))}

            {operationsAlertsAnalytics.missingBroadcasts.map(mb => (
              <div
                key={mb.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: 'var(--ads-brand-soft)',
                  border: '1px solid rgba(70, 95, 255, 0.22)',
                  gap: '10px'
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--ads-text-main)' }}>
                    {mb.companyName} — {mb.productName}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ads-text-sub)' }}>
                    Planlanan: {mb.totalPlanned} • Yayınlanan: {mb.effectiveRealized} • Telafi Gerekli:{' '}
                    <strong style={{ color: 'var(--ads-brand)' }}>{mb.makegoodRequiredSpots} spot</strong>
                  </div>
                </div>
                <span className="ta-badge ta-badge-brand">
                  %{mb.realizationRatePct}
                </span>
              </div>
            ))}

            {operationsAlertsAnalytics.conflictingBreaks.length === 0 &&
              operationsAlertsAnalytics.missingBroadcasts.length === 0 && (
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '11px',
                    background: 'var(--ads-success-soft)',
                    border: '1px solid rgba(3, 152, 85, 0.25)',
                    color: 'var(--ads-success-text)',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>Seçili filtrelerde kapasite aşımı veya çakışan reklam kuşağı bulunmuyor.</span>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardMiddleGridSections;
