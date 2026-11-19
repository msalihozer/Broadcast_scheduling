/**
 * @file src/components/Ads/dashboard/DashboardTopKpiSections.jsx
 * @description TailAdmin (free-react-tailwind-admin-dashboard v2) Tasarım Sistemine Uygun İlk 4 Ana Bölüm:
 * - Üst 4'lü TailAdmin İmzalı Metrik Kartı (48x48 İkon Kutusu + Büyük Değer + Sağ Alt Yeşil/Kırmızı/Turuncu Yüzde Rozeti)
 * - Bölüm 1: Rezervasyon Özeti (Toplam, Aktif, Onay Bekleyen, İptal Edilen, Tamamlanan)
 * - Bölüm 2: Kampanya Yönetimi (Aktif, Başlayacak ve Bitecek Kampanyalar)
 * - Bölüm 3: Yayın Performansı & Makegood (TailAdmin Yarım Daire Radial Hedef Göstergesi + Planlanan 100 Spot Kontrolü)
 * - Bölüm 4: Gelir Analizi & Kesinleşmiş 7/15/30 Günlük Gelir Tahmini (TailAdmin Bar/Spline Grafik Kartı ile)
 */
import React from 'react';
import {
  CalendarCheck, Clock, CheckCircle2, XCircle, Layers, TrendingUp,
  DollarSign, Wallet, RefreshCw, ArrowUpRight, ArrowDownRight, Megaphone, Radio
} from 'lucide-react';

const formatCurrency = (val) => {
  const num = Number(val) || 0;
  return `₺${num.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
};

const formatTrShortDate = (iso) => {
  if (!iso) return '-';
  const p = String(iso).split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}` : iso;
};

const DashboardTopKpiSections = ({
  reservationSummary,
  campaignSummary,
  broadcastPerformance,
  revenueAnalytics,
  statusFilter,
  onSelectStatusFilter,
  onNavigateTab,
  onScrollToOpsTable
}) => {
  // TailAdmin Yarım Daire (Semi-Circle) Radial Gauge Hesaplaması (Gerçekleşme Oranı %)
  const gaugeRadius = 82;
  const gaugeCircumference = Math.PI * gaugeRadius;
  const ratePct = Math.min(100, Math.max(0, broadcastPerformance.realizationRatePct || 0));
  const gaugeStrokeDashoffset = gaugeCircumference - (ratePct / 100) * gaugeCircumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ==========================================================================
          TAILADMIN İMZALI ÜST 4 KPI METRİK KARTI (EcommerceMetrics Stili)
         ========================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px'
        }}
      >
        {/* KPI 1: Toplam & Aktif Rezervasyon */}
        <div className="ta-card" style={{ justifyContent: 'space-between', gap: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="ta-icon-box brand">
              <CalendarCheck size={22} />
            </div>
            <span className="ta-badge ta-badge-brand">
              {reservationSummary.sponsorCount} Sponsorluk
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '13.5px', fontWeight: '500', color: 'var(--ads-text-muted)' }}>
                Toplam Rezervasyon
              </span>
              <h4
                style={{
                  margin: '6px 0 0',
                  fontSize: '28px',
                  fontWeight: '700',
                  color: 'var(--ads-text-main)',
                  letterSpacing: '-0.02em'
                }}
              >
                {reservationSummary.total}
              </h4>
            </div>
            <span className="ta-badge ta-badge-success">
              <ArrowUpRight size={13} />
              {reservationSummary.active} Aktif
            </span>
          </div>
        </div>

        {/* KPI 2: Yayınlanan / Planlanan Spot & Gerçekleşme */}
        <div className="ta-card" style={{ justifyContent: 'space-between', gap: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="ta-icon-box success">
              <Radio size={22} />
            </div>
            <span className="ta-badge ta-badge-info">
              100 Spotun {broadcastPerformance.per100Aired}&apos;i Yayında
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '13.5px', fontWeight: '500', color: 'var(--ads-text-muted)' }}>
                Yayınlanan / Planlanan Spot
              </span>
              <h4
                style={{
                  margin: '6px 0 0',
                  fontSize: '28px',
                  fontWeight: '700',
                  color: 'var(--ads-text-main)',
                  letterSpacing: '-0.02em'
                }}
              >
                {broadcastPerformance.airedSpots.toLocaleString('tr-TR')}{' '}
                <span style={{ fontSize: '15px', fontWeight: '500', color: 'var(--ads-text-muted)' }}>
                  / {broadcastPerformance.plannedSpots.toLocaleString('tr-TR')}
                </span>
              </h4>
            </div>
            <span className={`ta-badge ${broadcastPerformance.realizationRatePct >= 80 ? 'ta-badge-success' : 'ta-badge-warning'}`}>
              <TrendingUp size={13} />
              %{broadcastPerformance.realizationRatePct}
            </span>
          </div>
        </div>

        {/* KPI 3: Makegood (Telafi Yayını) & Eksik Spot */}
        <div
          className="ta-card"
          onClick={onScrollToOpsTable}
          style={{ justifyContent: 'space-between', gap: '18px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="ta-icon-box warning">
              <RefreshCw size={22} />
            </div>
            <span className="ta-badge ta-badge-warning">
              +{broadcastPerformance.makegoodScheduledSpots} Telafi Atandı
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '13.5px', fontWeight: '500', color: 'var(--ads-text-muted)' }}>
                Makegood (Telafi Bekleyen)
              </span>
              <h4
                style={{
                  margin: '6px 0 0',
                  fontSize: '28px',
                  fontWeight: '700',
                  color: 'var(--ads-text-main)',
                  letterSpacing: '-0.02em'
                }}
              >
                {broadcastPerformance.makegoodRequiredSpots.toLocaleString('tr-TR')}{' '}
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--ads-text-muted)' }}>Spot</span>
              </h4>
            </div>
            <span className={`ta-badge ${broadcastPerformance.makegoodRequiredSpots > 0 ? 'ta-badge-error' : 'ta-badge-success'}`}>
              {broadcastPerformance.makegoodRequiredSpots > 0 ? (
                <>
                  <ArrowDownRight size={13} /> Telafi Planla
                </>
              ) : (
                '✓ Eksik Yok'
              )}
            </span>
          </div>
        </div>

        {/* KPI 4: Planlanan Gelir & Tahsilat */}
        <div className="ta-card" style={{ justifyContent: 'space-between', gap: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="ta-icon-box info">
              <DollarSign size={22} />
            </div>
            <span className="ta-badge ta-badge-success">
              Tahsilat: %{revenueAnalytics.collectionRatePct}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '13.5px', fontWeight: '500', color: 'var(--ads-text-muted)' }}>
                Planlanan Toplam Gelir
              </span>
              <h4
                style={{
                  margin: '6px 0 0',
                  fontSize: '26px',
                  fontWeight: '700',
                  color: 'var(--ads-text-main)',
                  letterSpacing: '-0.02em'
                }}
              >
                {formatCurrency(revenueAnalytics.plannedRevenue)}
              </h4>
            </div>
            <span className="ta-badge ta-badge-brand">
              30G Tahmin: {formatCurrency(revenueAnalytics.forecast30d)}
            </span>
          </div>
        </div>
      </div>

      {/* ==========================================================================
          ORTA SATIR 1: BÖLÜM 1 (REZERVASYON ÖZETİ) & BÖLÜM 2 (KAMPANYA YÖNETİMİ)
         ========================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
          gap: '20px'
        }}
      >
        {/* BÖLÜM 1: REZERVASYON ÖZETİ */}
        <div className="ta-card" style={{ gap: '16px' }}>
          <div className="ta-card-header" style={{ marginBottom: 0 }}>
            <div>
              <div className="ta-card-title">1. Rezervasyon Özeti</div>
              <div className="ta-card-subtitle">
                Toplam, aktif, onay bekleyen, tamamlanan ve iptal edilen rezervasyonlar
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('reservations')}
              className="ads-saas-btn ads-saas-btn-sm"
            >
              <span>Tüm Rezervasyonlar</span>
              <ArrowUpRight size={13} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
            {[
              { id: 'all', label: 'Toplam', count: reservationSummary.total, badgeClass: 'ta-badge-brand', color: '#465fff' },
              { id: 'active', label: 'Aktif', count: reservationSummary.active, badgeClass: 'ta-badge-success', color: '#12b76a' },
              { id: 'pending', label: 'Bekleyen', count: reservationSummary.pending, badgeClass: 'ta-badge-warning', color: '#f79009' },
              { id: 'completed', label: 'Tamamlanan', count: reservationSummary.completed, badgeClass: 'ta-badge-info', color: '#0ba5ec' },
              { id: 'cancelled', label: 'İptal Edilen', count: reservationSummary.cancelled, badgeClass: 'ta-badge-error', color: '#f04438' }
            ].map(item => {
              const isSelected = statusFilter === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectStatusFilter && onSelectStatusFilter(item.id)}
                  style={{
                    padding: '14px 12px',
                    borderRadius: '12px',
                    background: isSelected ? 'var(--ads-brand-soft)' : 'var(--ads-card-subtle)',
                    border: isSelected ? `1.5px solid ${item.color}` : '1px solid var(--ads-border)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--ads-text-muted)' }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: '24px', fontWeight: '700', color: 'var(--ads-text-main)' }}>
                    {item.count}
                  </span>
                  <span className={`ta-badge ${item.badgeClass}`} style={{ width: 'fit-content', fontSize: '10.5px', padding: '1px 7px' }}>
                    {reservationSummary.total > 0 ? `%${Math.round((item.count / reservationSummary.total) * 100)}` : '%0'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* BÖLÜM 2: KAMPANYA YÖNETİMİ */}
        <div className="ta-card" style={{ gap: '16px' }}>
          <div className="ta-card-header" style={{ marginBottom: 0 }}>
            <div>
              <div className="ta-card-title">2. Kampanya Yönetimi</div>
              <div className="ta-card-subtitle">
                Aktif kampanyalar, 14 gün içinde başlayacak ve 7 gün içinde bitecek kampanyalar
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('products')}
              className="ads-saas-btn ads-saas-btn-sm"
            >
              <span>Kampanyalar ({campaignSummary.totalCampaigns})</span>
              <ArrowUpRight size={13} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div
              style={{
                padding: '14px',
                borderRadius: '12px',
                background: 'var(--ads-card-subtle)',
                border: '1px solid var(--ads-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <span className="ta-badge ta-badge-success" style={{ width: 'fit-content' }}>
                Aktif Kampanyalar
              </span>
              <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--ads-text-main)', marginTop: '2px' }}>
                {campaignSummary.activeCampaignsCount}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)' }}>
                {campaignSummary.activeCampaignsList.slice(0, 2).map(c => c.companyName).join(', ') || 'Şu an yayında'}
              </div>
            </div>

            <div
              style={{
                padding: '14px',
                borderRadius: '12px',
                background: 'var(--ads-card-subtle)',
                border: '1px solid var(--ads-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <span className="ta-badge ta-badge-warning" style={{ width: 'fit-content' }}>
                Başlayacak (≤14 Gün)
              </span>
              <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--ads-text-main)', marginTop: '2px' }}>
                {campaignSummary.startingSoonCount}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)' }}>
                {campaignSummary.startingSoonList[0]
                  ? `${campaignSummary.startingSoonList[0].companyName} (${formatTrShortDate(campaignSummary.startingSoonList[0].startDate)})`
                  : 'Planlanan yeni başlangıç'}
              </div>
            </div>

            <div
              style={{
                padding: '14px',
                borderRadius: '12px',
                background: 'var(--ads-card-subtle)',
                border: '1px solid var(--ads-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <span className="ta-badge ta-badge-error" style={{ width: 'fit-content' }}>
                Bitecek (≤7 Gün)
              </span>
              <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--ads-text-main)', marginTop: '2px' }}>
                {campaignSummary.endingSoonCount}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)' }}>
                {campaignSummary.endingSoonList[0]
                  ? `${campaignSummary.endingSoonList[0].companyName} (${formatTrShortDate(campaignSummary.endingSoonList[0].endDate)})`
                  : 'Sözleşme yenileme fırsatı'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================================================
          ORTA SATIR 2: BÖLÜM 3 (TAILADMIN RADIAL GAUGE YAYIN PERFORMANSI) & BÖLÜM 4 (GELİR ANALİZİ)
         ========================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
          gap: '20px'
        }}
      >
        {/* BÖLÜM 3: YAYIN PERFORMANSI & MAKEGOOD (TailAdmin MonthlyTarget Radial Gauge Stili) */}
        <div className="ta-card" style={{ justifyContent: 'space-between', gap: '16px' }}>
          <div className="ta-card-header" style={{ marginBottom: 0 }}>
            <div>
              <div className="ta-card-title">3. Yayın Performansı &amp; Makegood Kontrolü</div>
              <div className="ta-card-subtitle">
                Planlanan 100 spotun kaçının yayınlandığı, eksik yayın ve telafi (makegood) takibi
              </div>
            </div>

            <button
              type="button"
              onClick={onScrollToOpsTable}
              className="ads-saas-btn ads-saas-btn-sm primary"
            >
              <RefreshCw size={12} />
              <span>Makegood Planla</span>
            </button>
          </div>

          {/* TailAdmin Semi-Circle Radial Gauge + 100 Spot Simülasyonu */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '210px 1fr',
              alignItems: 'center',
              gap: '18px',
              background: 'var(--ads-card-subtle)',
              borderRadius: '14px',
              padding: '16px',
              border: '1px solid var(--ads-border)'
            }}
          >
            {/* Yarım Daire Radial Gauge */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <svg width="190" height="110" viewBox="0 0 200 115">
                <path
                  d="M 18 100 A 82 82 0 0 1 182 100"
                  fill="none"
                  stroke="var(--ads-border)"
                  strokeWidth="14"
                  strokeLinecap="round"
                />
                <path
                  d="M 18 100 A 82 82 0 0 1 182 100"
                  fill="none"
                  stroke="#465fff"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={gaugeStrokeDashoffset}
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div style={{ marginTop: '-42px', textAlign: 'center' }}>
                <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--ads-text-main)' }}>
                  %{ratePct}
                </div>
                <span className="ta-badge ta-badge-success" style={{ fontSize: '10.5px', marginTop: '2px' }}>
                  Gerçekleşme Oranı
                </span>
              </div>
            </div>

            {/* Sağ: 100 Spot Kontrolü ve Makegood Özeti */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--ads-text-main)' }}>
                Planlanan her <strong>100 spotun</strong>{' '}
                <strong style={{ color: '#12b76a' }}>{broadcastPerformance.per100Aired} adedi</strong> yayınlandı,{' '}
                <strong style={{ color: '#f04438' }}>{broadcastPerformance.per100Makegood} adedi</strong> telafi bekliyor.
              </div>

              <div
                style={{
                  width: '100%',
                  height: '10px',
                  borderRadius: '999px',
                  background: 'var(--ta-error-bg)',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    width: `${broadcastPerformance.per100Aired}%`,
                    height: '100%',
                    background: '#465fff',
                    borderRadius: '999px',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', paddingTop: '4px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>Planlanan</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--ads-text-main)' }}>
                    {broadcastPerformance.plannedSpots} Spot
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>Yayınlanan</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#12b76a' }}>
                    {broadcastPerformance.airedSpots} Spot
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>Eksik / Telafi</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#f04438' }}>
                    {broadcastPerformance.makegoodRequiredSpots} Spot
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BÖLÜM 4: GELİR ANALİZİ & KESİNLEŞMİŞ GELİR TAHMİNİ */}
        <div className="ta-card" style={{ justifyContent: 'space-between', gap: '16px' }}>
          <div className="ta-card-header" style={{ marginBottom: 0 }}>
            <div>
              <div className="ta-card-title">4. Gelir Analizi &amp; Beklenen Gelir Tahmini</div>
              <div className="ta-card-subtitle">
                Planlanan gelir, gerçekleşen gelir, tahsilat, kalan alacak ve 7/15/30 gün projeksiyonu
              </div>
            </div>
            <span className="ta-badge ta-badge-success">
              Tahsilat: %{revenueAnalytics.collectionRatePct}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {[
              { label: 'Planlanan Gelir', val: revenueAnalytics.plannedRevenue, color: 'var(--ads-text-main)' },
              { label: 'Gerçekleşen Gelir', val: revenueAnalytics.realizedRevenue, color: '#465fff' },
              { label: 'Tahsil Edilen', val: revenueAnalytics.collectedAmount, color: '#12b76a' },
              { label: 'Kalan Alacak', val: revenueAnalytics.remainingReceivable, color: '#f79009' }
            ].map(box => (
              <div
                key={box.label}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'var(--ads-card-subtle)',
                  border: '1px solid var(--ads-border)'
                }}
              >
                <div style={{ fontSize: '11.5px', fontWeight: '500', color: 'var(--ads-text-muted)' }}>
                  {box.label}
                </div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: box.color, marginTop: '6px' }}>
                  {formatCurrency(box.val)}
                </div>
              </div>
            ))}
          </div>

          {/* 7 / 15 / 30 Günlük Gelir Tahmini Barı */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'var(--ads-brand-soft)',
              border: '1px solid rgba(70, 95, 255, 0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: '700', color: 'var(--ads-brand)' }}>
              <Wallet size={16} />
              <span>Kesinleşmiş Rezervasyonlardan Gelir Tahmini:</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12.5px', fontWeight: '700', color: 'var(--ads-text-main)' }}>
              <span>7 Gün: <strong>{formatCurrency(revenueAnalytics.forecast7d)}</strong></span>
              <span>•</span>
              <span>15 Gün: <strong>{formatCurrency(revenueAnalytics.forecast15d)}</strong></span>
              <span>•</span>
              <span>30 Gün: <strong style={{ color: 'var(--ads-brand)' }}>{formatCurrency(revenueAnalytics.forecast30d)}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardTopKpiSections;
