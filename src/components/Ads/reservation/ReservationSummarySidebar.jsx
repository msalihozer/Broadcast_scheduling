/**
 * @file src/components/Ads/reservation/ReservationSummarySidebar.jsx
 * @description Reklam Rezervasyon Formu Sağ Sütun: Canlı Rezervasyon, Spot, Ücret ve Sponsorluk Özet Kartı.
 *
 * Kullanıcının sol tarafta eklediği her bir reklam/klip planının kanallarını, kuşaklarını,
 * tarih aralıklarını, spot adetlerini, bütçesini ve sponsorluk rollerini canlı olarak özetler.
 */
import React from 'react';
import { Sparkles, Play, CheckCircle2 } from 'lucide-react';
import { SPONSOR_POSITIONS, calculateRowPricing } from './reservationConstants';

const ReservationSummarySidebar = ({
  selectedCompanyObj,
  items = [],
  products = [],
  materials = [],
  timeBlocks = [],
  channels = [],
  summaryStats,
  existingData,
  onPreviewMaterial,
  onSubmit
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'sticky', top: 0 }}>
      <div className="ads-saas-card" style={{ padding: '18px', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
            Planlama Özeti
          </span>
          <Sparkles size={16} color="var(--ads-brand)" />
        </div>

        <div style={{ background: 'var(--ads-card-subtle)', padding: '12px', borderRadius: '10px', border: '1px solid var(--ads-border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)', fontWeight: '700' }}>REKLAMVEREN FİRMA</div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--ads-brand)', marginTop: '2px' }}>
            {selectedCompanyObj?.name || 'Firma Seçilmedi'}
          </div>
        </div>

        {/* Ürün Planları Listesi */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--ads-text-muted)' }}>
            PLANLANAN KLİPLER ({items.length})
          </div>
          {items.map((it, idx) => {
            const p = products.find(x => String(x.id) === String(it.productId));
            const m = materials.find(x => String(x.id) === String(it.materialId));
            const rowCalc = calculateRowPricing(it);
            const chNames = (it.channelIds || [])
              .map(cid => (cid === 'ch_hd' ? 'HD' : cid === 'ch_way' ? 'WAY' : cid))
              .join(' + ');
            const tbNames = (it.timeBlockIds || [])
              .map(tbId => timeBlocks.find(t => t.id === tbId)?.name?.split(' ')[0])
              .filter(Boolean)
              .join(', ');

            return (
              <div
                key={it.id}
                style={{
                  padding: '10px 11px',
                  borderRadius: '9px',
                  background: 'var(--ads-card-subtle)',
                  border: it.isSponsor
                    ? '1.5px solid rgba(147, 51, 234, 0.38)'
                    : '1px solid var(--ads-border)',
                  fontSize: '11.5px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: '800', color: 'var(--ads-text-main)' }}>
                    #{idx + 1} {p?.name || 'Ürün Seçilmedi'}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: '800',
                      padding: '1px 6px',
                      borderRadius: '5px',
                      background: 'var(--ads-brand-soft)',
                      color: 'var(--ads-brand)'
                    }}
                  >
                    {chNames || '-'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <div style={{ color: 'var(--ads-text-sub)', fontSize: '11px', wordBreak: 'break-all' }}>
                    <strong>Klip:</strong> {m ? `${m.clipName || m.name} (${m.duration} sn)` : '-'}
                  </div>
                  {m && (
                    <button
                      type="button"
                      onClick={() => onPreviewMaterial(m)}
                      className="ads-saas-btn ads-saas-btn-sm"
                      style={{ padding: '2px 7px', fontSize: '10px', color: 'var(--ads-brand)', flexShrink: 0 }}
                    >
                      <Play size={10} /> İzle
                    </button>
                  )}
                </div>

                <div style={{ color: 'var(--ads-text-muted)', fontSize: '10.5px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Kuşaklar: <strong>{tbNames || '-'}</strong></span>
                  <span>Günlük: <strong>Min {it.dailyMinSpots || 1} / Max {it.dailyMaxSpots || 4}</strong></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ads-brand)', fontWeight: '700', fontSize: '10.5px', marginTop: '2px' }}>
                  <span>{it.startDate} &rarr; {it.endDate}</span>
                  <span>
                    {rowCalc.effectiveSpots} Spot
                    {it.pricingMode !== 'spots_only' && rowCalc.effectiveTotalBudget > 0
                      ? ` • ${rowCalc.effectiveTotalBudget.toLocaleString('tr-TR')} ₺`
                      : ''}
                  </span>
                </div>

                {it.isSponsor && (
                  <div
                    style={{
                      marginTop: '3px',
                      paddingTop: '5px',
                      borderTop: '1px dashed rgba(147, 51, 234, 0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px'
                    }}
                  >
                    <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#9333ea' }}>
                      Sponsor: {it.sponsorProgramTitle || 'Program Seçilmedi'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                      {(it.sponsorPositions || []).map(posId => {
                        const pos = SPONSOR_POSITIONS.find(sp => sp.id === posId);
                        return pos ? (
                          <span
                            key={posId}
                            style={{
                              fontSize: '9.5px',
                              fontWeight: '800',
                              padding: '1px 6px',
                              borderRadius: '999px',
                              background: pos.bg,
                              color: pos.color
                            }}
                          >
                            {pos.shortLabel}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sayısal Özet */}
        <div style={{ borderTop: '1px solid var(--ads-border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--ads-text-muted)' }}>Genel Tarih Aralığı:</span>
            <strong style={{ color: 'var(--ads-text-main)' }}>
              {summaryStats.minStartDate} / {summaryStats.maxEndDate}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--ads-text-muted)' }}>Kapsanan Kanallar:</span>
            <strong style={{ color: 'var(--ads-text-main)' }}>
              {summaryStats.allChannels
                .map(cid => channels.find(c => c.id === cid)?.name || cid)
                .join(', ') || '-'}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--ads-text-muted)' }}>Toplam Planlanan Spot:</span>
            <strong style={{ color: 'var(--ads-brand)', fontSize: '15px' }}>
              {summaryStats.totalSpots} Spot
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--ads-text-muted)' }}>Toplam Ücret / Bütçe:</span>
            <strong style={{ color: summaryStats.hasAnyPricing ? '#0d9488' : 'var(--ads-text-muted)', fontSize: '14px' }}>
              {summaryStats.hasAnyPricing
                ? `${summaryStats.totalBudget.toLocaleString('tr-TR')} ₺`
                : 'Ücret Girilmedi'}
            </strong>
          </div>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          className="ads-saas-btn ads-saas-btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: '13px', marginTop: '4px' }}
        >
          <CheckCircle2 size={16} />
          {existingData ? 'Rezervasyonu Güncelle' : 'Rezervasyonu Kaydet'}
        </button>
      </div>
    </div>
  );
};

export default ReservationSummarySidebar;

