/**
 * @file src/components/Ads/dashboard/DashboardPricingPanel.jsx
 * @description Reklam & Rezervasyon Dashboard — Doğrudan Spot Adedi, Birim Spot/Saniye Ücreti,
 * Toplam Anlaşılan Bütçe ve Tahsilat Giriş & Yönetim Paneli.
 */
import React, { useState } from 'react';
import {
  Wallet,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Database,
  FileBarChart2
} from 'lucide-react';

const formatCurrency = val =>
  `₺${(Number(val) || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;

const DashboardPricingPanel = ({
  reservations = [],
  adsPricingConfig = {},
  onUpdatePricingConfig,
  onApplyTariffToReservations,
  onUpdateReservation,
  onSyncWithServer,
  onNavigateReports,
  onShowToast
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isSyncingDb, setIsSyncingDb] = useState(false);

  const hdRate = Number(adsPricingConfig?.channelRates?.ch_hd) || 0;
  const wayRate = Number(adsPricingConfig?.channelRates?.ch_way) || 0;
  const sponsorRate = Number(adsPricingConfig?.sponsorSpotPrice) || 0;
  const perSecRate = Number(adsPricingConfig?.defaultPerSecondPrice) || 0;

  const totalPlannedSpotsAll = reservations.reduce((s, r) => s + (Number(r.totalPlanned) || 0), 0);
  const totalRealizedSpotsAll = reservations.reduce((s, r) => s + (Number(r.effectiveRealized) || 0), 0);
  const totalPlannedRevAll = reservations.reduce((s, r) => s + (Number(r.plannedRevenue) || 0), 0);
  const totalRealizedRevAll = reservations.reduce((s, r) => s + (Number(r.realizedRevenue) || 0), 0);
  const totalCollectedAll = reservations.reduce((s, r) => s + (Number(r.collectedAmount) || 0), 0);
  const totalReceivableAll = reservations.reduce((s, r) => s + (Number(r.remainingReceivable) || 0), 0);

  const handleManualServerSync = async () => {
    if (!onSyncWithServer) return;
    setIsSyncingDb(true);
    try {
      await onSyncWithServer();
      if (onShowToast) {
        onShowToast('✅ Rezervasyon, yerleşim ve ücretlendirme verileri sunucu veritabanı ile eşitlendi.');
      }
    } finally {
      setIsSyncingDb(false);
    }
  };

  const handleReservationPricingChange = (res, field, rawVal) => {
    if (!onUpdateReservation) return;
    const numVal = Math.max(0, Number(rawVal) || 0);
    const currentPlanned = Math.max(1, Number(res.totalPlanned) || 1);
    const currentUnit = Number(res.unitSpotPrice) || 0;

    if (field === 'totalPlannedSpots') {
      const nextPlanned = Math.max(1, numVal);
      const nextBudget = currentUnit > 0 ? Math.round(nextPlanned * currentUnit) : Number(res.plannedRevenue) || 0;
      const nextItems = Array.isArray(res.items)
        ? res.items.map((it, idx) =>
            idx === 0
              ? { ...it, plannedSpots: nextPlanned, totalBudget: nextBudget }
              : it
          )
        : res.items;
      onUpdateReservation(res.id, {
        totalPlannedSpots: nextPlanned,
        totalBudget: nextBudget,
        totalAmount: nextBudget,
        toplamTutar: nextBudget,
        items: nextItems
      });
    } else if (field === 'realizedSpots') {
      onUpdateReservation(res.id, {
        realizedSpots: numVal
      });
    } else if (field === 'spotPrice') {
      const nextBudget = Math.round(currentPlanned * numVal);
      const nextItems = Array.isArray(res.items)
        ? res.items.map(it => ({
            ...it,
            spotPrice: numVal,
            totalBudget: Math.round((Number(it.plannedSpots) || currentPlanned) * numVal)
          }))
        : res.items;
      onUpdateReservation(res.id, {
        spotPrice: numVal,
        totalBudget: nextBudget,
        totalAmount: nextBudget,
        toplamTutar: nextBudget,
        items: nextItems
      });
    } else if (field === 'totalBudget') {
      const nextUnit = currentPlanned > 0 ? Math.round(numVal / currentPlanned) : 0;
      const nextItems = Array.isArray(res.items)
        ? res.items.map((it, idx) =>
            idx === 0
              ? { ...it, spotPrice: nextUnit, totalBudget: numVal }
              : it
          )
        : res.items;
      onUpdateReservation(res.id, {
        spotPrice: nextUnit,
        totalBudget: numVal,
        totalAmount: numVal,
        toplamTutar: numVal,
        items: nextItems
      });
    } else if (field === 'collectedAmount') {
      const plannedRev = Number(res.plannedRevenue) || 0;
      const nextStatus =
        numVal >= plannedRev && plannedRev > 0
          ? 'paid'
          : numVal > 0
          ? 'partial'
          : 'unpaid';
      onUpdateReservation(res.id, {
        collectedAmount: numVal,
        paymentStatus: nextStatus
      });
    }
  };

  return (
    <div
      className="ta-card"
      style={{
        border: '1.5px solid rgba(5, 150, 105, 0.35)',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.04) 0%, rgba(37, 99, 235, 0.03) 100%)',
        gap: '14px'
      }}
    >
      {/* ÜST BAŞLIK */}
      <div
        className="ta-card-header"
        style={{
          flexWrap: 'wrap',
          paddingBottom: isOpen ? '12px' : '0',
          borderBottom: isOpen ? '1px solid var(--ads-border)' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #059669, #0284c7)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Wallet size={19} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '2px 9px',
                  borderRadius: '999px',
                  background: 'rgba(16, 185, 129, 0.16)',
                  color: '#059669',
                  fontSize: '10.5px',
                  fontWeight: '900'
                }}
              >
                💰 SPOT &amp; ÜCRETLENDİRME MERKEZİ
              </span>
              <h3 className="ta-card-title" style={{ fontSize: '15.5px', margin: 0 }}>
                Spot Adedi, Birim Ücret, Bütçe ve Tahsilat Veri Girişi (Sunucu Veritabanı Korumalı)
              </h3>
            </div>
            <p className="ta-card-desc" style={{ marginTop: '3px' }}>
              Buradan girdiğiniz tüm rezervasyon, spot ve ücretlendirme verileri sunucu veritabanında (<code>/api/ads-store</code>) kalıcı tutulur; hem IP adresinde hem <strong>seyare.semerkand.com</strong> üzerinde ortak çalışır ve <strong>Raporlar</strong> sekmesine otomatik yansır.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleManualServerSync}
            disabled={isSyncingDb}
            className="ads-saas-btn ads-saas-btn-sm"
            style={{
              borderColor: 'rgba(37, 99, 235, 0.4)',
              color: '#2563eb',
              fontWeight: '800'
            }}
            title="Bu tarayıcıdaki ve sunucu veritabanındaki tüm rezervasyonları çift yönlü eşitle"
          >
            <Database size={13} />
            {isSyncingDb ? 'Veritabanı Eşitleniyor...' : 'Veritabanı İle Eşitle'}
          </button>

          {onNavigateReports && (
            <button
              type="button"
              onClick={() => onNavigateReports('reports')}
              className="ads-saas-btn ads-saas-btn-sm"
              style={{
                borderColor: 'rgba(5, 150, 105, 0.4)',
                color: '#059669',
                fontWeight: '800'
              }}
            >
              <FileBarChart2 size={13} /> Spot &amp; Ücret Raporuna Git
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(prev => !prev)}
            className="ads-saas-btn ads-saas-btn-sm"
            style={{ fontWeight: '800' }}
          >
            {isOpen ? (
              <>
                Gizle <ChevronUp size={14} />
              </>
            ) : (
              <>
                Spot &amp; Ücret Girişini Aç <ChevronDown size={14} />
              </>
            )}
          </button>
        </div>
      </div>

      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 1. VARSAYILAN KANAL & SPONSORLUK BİRİM SPOT / SANİYE TARİFESİ */}
          <div
            style={{
              padding: '14px',
              borderRadius: '12px',
              background: 'var(--ads-card-bg)',
              border: '1px solid var(--ads-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '12.5px', fontWeight: '900', color: 'var(--ads-text-main)' }}>
                  1. Genel Kanal &amp; Sponsorluk Spot / Saniye Birim Ücret Tarifesi (İsteğe Bağlı)
                </span>
                <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)', marginTop: '2px' }}>
                  Standart birim spot veya saniye ücreti belirleyip tek tıkla rezervasyonlara uygulayabilir ya da aşağıdaki tablodan her rezervasyona ayrı ücret girebilirsiniz.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (onApplyTariffToReservations) {
                      onApplyTariffToReservations({ overwriteExisting: false });
                      if (onShowToast) onShowToast('💰 Tarife yalnızca fiyatı girilmemiş rezervasyonlara uygulandı.');
                    }
                  }}
                  className="ads-saas-btn ads-saas-btn-sm"
                  style={{ fontWeight: '800', color: '#059669', borderColor: 'rgba(5, 150, 105, 0.4)' }}
                >
                  <Sparkles size={12} /> Fiyatı Olmayanlara Uygula
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onApplyTariffToReservations) {
                      onApplyTariffToReservations({ overwriteExisting: true });
                      if (onShowToast) onShowToast('💰 Tarife tüm rezervasyonlara uygulandı.');
                    }
                  }}
                  className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                >
                  <RefreshCw size={12} /> Tüm Rezervasyonlara Uygula
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--ads-text-sub)' }}>
                  Semerkand HD Birim Spot Ücreti (₺/Spot)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={hdRate || ''}
                  onChange={e =>
                    onUpdatePricingConfig &&
                    onUpdatePricingConfig({
                      defaultSpotPrice: Number(e.target.value) || 0,
                      channelRates: { ch_hd: Number(e.target.value) || 0 }
                    })
                  }
                  placeholder="0 ₺ (Manuel Giriş)"
                  className="ads-saas-input"
                  style={{ width: '100%', fontWeight: '800' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--ads-text-sub)' }}>
                  Semerkand WAY Birim Spot Ücreti (₺/Spot)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={wayRate || ''}
                  onChange={e =>
                    onUpdatePricingConfig &&
                    onUpdatePricingConfig({
                      channelRates: { ch_way: Number(e.target.value) || 0 }
                    })
                  }
                  placeholder="0 ₺ (Manuel Giriş)"
                  className="ads-saas-input"
                  style={{ width: '100%', fontWeight: '800' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#9333ea' }}>
                  🏆 Sponsorluk Birim Spot Ücreti (₺/Spot)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={sponsorRate || ''}
                  onChange={e =>
                    onUpdatePricingConfig &&
                    onUpdatePricingConfig({
                      sponsorSpotPrice: Number(e.target.value) || 0
                    })
                  }
                  placeholder="0 ₺ (Manuel Giriş)"
                  className="ads-saas-input"
                  style={{ width: '100%', fontWeight: '800' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#0284c7' }}>
                  Saniye Başı Birim Ücret (₺/Saniye)
                </label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={perSecRate || ''}
                  onChange={e =>
                    onUpdatePricingConfig &&
                    onUpdatePricingConfig({
                      defaultPerSecondPrice: Number(e.target.value) || 0
                    })
                  }
                  placeholder="0 ₺/sn"
                  className="ads-saas-input"
                  style={{ width: '100%', fontWeight: '800' }}
                />
              </div>
            </div>
          </div>

          {/* 2. REZERVASYON BAZLI DOĞRUDAN SPOT VE ÜCRETLENDİRME GİRİŞ TABLOSU */}
          <div
            style={{
              borderRadius: '12px',
              background: 'var(--ads-card-bg)',
              border: '1px solid var(--ads-border)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                background: 'var(--ads-card-subtle)',
                borderBottom: '1px solid var(--ads-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}
            >
              <span style={{ fontSize: '12.5px', fontWeight: '900', color: 'var(--ads-text-main)' }}>
                2. Rezervasyon &amp; Kampanya Bazlı Doğrudan Spot ve Ücretlendirme Giriş Tablosu ({reservations.length} Kayıt)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11.5px', fontWeight: '800', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--ads-text-sub)' }}>
                  Toplam Planlanan: <strong>{totalPlannedSpotsAll} Spot</strong> ({formatCurrency(totalPlannedRevAll)})
                </span>
                <span style={{ color: '#0284c7' }}>
                  Yayınlanan: <strong>{totalRealizedSpotsAll} Spot</strong> ({formatCurrency(totalRealizedRevAll)})
                </span>
                <span style={{ color: '#059669' }}>
                  Tahsil Edilen: <strong>{formatCurrency(totalCollectedAll)}</strong>
                </span>
                <span style={{ color: '#d97706' }}>
                  Kalan Alacak: <strong>{formatCurrency(totalReceivableAll)}</strong>
                </span>
              </div>
            </div>

            {reservations.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: '12.5px', color: 'var(--ads-text-muted)' }}>
                Henüz kayıtlı rezervasyon bulunmuyor. Rezervasyon eklendiğinde spot adetlerini ve ücretlerini buradan doğrudan girebilirsiniz.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: '360px', overflowY: 'auto' }}>
                <table className="ta-table">
                  <thead>
                    <tr>
                      <th>Firma &amp; Kampanya / Klip</th>
                      <th>Kanal &amp; Tarih</th>
                      <th style={{ width: '115px' }}>Planlanan Spot</th>
                      <th style={{ width: '115px' }}>Yayınlanan Spot</th>
                      <th style={{ width: '140px' }}>Birim Spot Ücreti (₺)</th>
                      <th style={{ width: '150px' }}>Toplam Tutar / Bütçe (₺)</th>
                      <th style={{ width: '140px' }}>Gerçekleşen Tutar</th>
                      <th style={{ width: '155px' }}>Tahsil Edilen (₺)</th>
                      <th style={{ width: '135px' }}>Kalan Alacak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map(res => (
                      <tr key={`price-row-${res.id}`}>
                        <td>
                          <div style={{ fontWeight: '800', fontSize: '12.5px', color: 'var(--ads-text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span>{res.companyName}</span>
                            {res.isSponsor && (
                              <span style={{ padding: '1px 6px', borderRadius: '999px', background: '#9333ea', color: '#fff', fontSize: '9.5px', fontWeight: '900' }}>
                                🏆 Sponsor
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>
                            {res.productName} • {res.materialName}
                          </div>
                        </td>

                        <td style={{ fontSize: '11.5px' }}>
                          <div style={{ fontWeight: '700', color: 'var(--ads-text-main)' }}>
                            {(res.allChannelIds || ['ch_hd']).map(c => (c === 'ch_way' ? 'WAY' : 'HD')).join(' + ')}
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)', fontFamily: 'monospace' }}>
                            {res.startDate} &rarr; {res.endDate}
                          </div>
                        </td>

                        {/* Planlanan Spot Girişi */}
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={res.totalPlanned ?? ''}
                            onChange={e => handleReservationPricingChange(res, 'totalPlannedSpots', e.target.value)}
                            className="ads-saas-input"
                            style={{ width: '95px', fontWeight: '800', textAlign: 'center' }}
                          />
                        </td>

                        {/* Yayınlanan / Gerçekleşen Spot Girişi */}
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={res.effectiveRealized ?? ''}
                            onChange={e => handleReservationPricingChange(res, 'realizedSpots', e.target.value)}
                            className="ads-saas-input"
                            style={{ width: '95px', fontWeight: '800', textAlign: 'center', color: '#0284c7' }}
                          />
                        </td>

                        {/* Birim Spot Ücreti (₺) */}
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="50"
                            value={res.unitSpotPrice || ''}
                            onChange={e => handleReservationPricingChange(res, 'spotPrice', e.target.value)}
                            placeholder="0 ₺"
                            className="ads-saas-input"
                            style={{ width: '120px', fontWeight: '800' }}
                          />
                        </td>

                        {/* Toplam Tutar / Bütçe (₺) */}
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={res.plannedRevenue || ''}
                            onChange={e => handleReservationPricingChange(res, 'totalBudget', e.target.value)}
                            placeholder="0 ₺"
                            className="ads-saas-input"
                            style={{ width: '130px', fontWeight: '800', color: '#059669' }}
                          />
                        </td>

                        {/* Gerçekleşen Yayın Tutarı */}
                        <td style={{ fontWeight: '800', fontSize: '12.5px', color: '#0284c7', fontFamily: 'monospace' }}>
                          {formatCurrency(res.realizedRevenue)}
                        </td>

                        {/* Tahsil Edilen (₺) */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={res.collectedAmount || ''}
                              onChange={e => handleReservationPricingChange(res, 'collectedAmount', e.target.value)}
                              placeholder="0 ₺"
                              className="ads-saas-input"
                              style={{ width: '105px', fontWeight: '800' }}
                            />
                            {res.plannedRevenue > 0 && res.collectedAmount < res.plannedRevenue && (
                              <button
                                type="button"
                                onClick={() => handleReservationPricingChange(res, 'collectedAmount', res.plannedRevenue)}
                                style={{
                                  padding: '4px 6px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(5, 150, 105, 0.35)',
                                  background: 'rgba(16, 185, 129, 0.14)',
                                  color: '#059669',
                                  cursor: 'pointer'
                                }}
                                title="Tamamını Tahsil Edildi İşaretle"
                              >
                                <CheckCircle2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Kalan Alacak */}
                        <td style={{ fontWeight: '800', fontSize: '12.5px', fontFamily: 'monospace', color: res.remainingReceivable > 0 ? '#d97706' : '#059669' }}>
                          {res.remainingReceivable > 0 ? formatCurrency(res.remainingReceivable) : '✓ Kapandı'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(DashboardPricingPanel);
