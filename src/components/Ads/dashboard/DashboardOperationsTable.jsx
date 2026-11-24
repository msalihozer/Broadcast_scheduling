/**
 * @file src/components/Ads/dashboard/DashboardOperationsTable.jsx
 * @description TailAdmin v2 (`Recent Orders` Table Style) — Dashboard Alt Bölüm:
 * Operasyon Ekibinin Doğrudan İşlem Yapabileceği Canlı Operasyon Konsolu Tablosu.
 *
 * Operasyon ekibi bu tablo üzerinden başka bir sekmeye gitmeden doğrudan:
 * 1. Rezervasyon & Kampanya Operasyonları:
 *    - Rezervasyon durumunu (`Aktif`, `Onay Bekleyen`, `Tamamlanan`, `İptal`) canlı değiştirebilir,
 *    - Eksik kalan spotlar için tek tıkla **Makegood (Telafi Yayını)** tanımlayıp kuşaklara dağıtabilir,
 *    - Tahsilat / Ödeme durumunu (`Tam Tahsilat`, `Kısmi %50`, `Bekliyor`) güncelleyebilir,
 *    - Rezervasyonu düzenleme formunda açabilir veya silebilir.
 * 2. Materyal Geçerlilik & Teknik Kontrol Operasyonları:
 *    - Reklam kliplerinin teknik kontrol ve yayın onay durumunu (`Yayına Uygun`, `Onay Bekliyor`, `Teknik Hatalı`, `Süresi Dolan`) değiştirebilir,
 *    - Kullanım geçerlilik bitiş tarihi (`validUntil`) atayabilir ve klibi canlı önizleyebilir.
 */
import React, { useState } from 'react';
import {
  RefreshCw, Play, Edit2, Trash2,
  ShieldCheck, Sparkles, Film, CalendarCheck
} from 'lucide-react';
import { MATERIAL_VALIDITY_STATUSES } from './dashboardAnalyticsEngine';

const STATUS_BADGE_MAP = {
  active: { label: 'Aktif (Yayında)', color: '#039855', bg: 'var(--ads-success-soft)' },
  pending: { label: 'Onay Bekliyor', color: '#dc6803', bg: 'var(--ads-warning-soft)' },
  completed: { label: 'Tamamlandı (Biten)', color: '#026aa2', bg: 'var(--ads-info-soft)' },
  cancelled: { label: 'İptal Edildi', color: '#d92d20', bg: 'var(--ads-error-soft)' }
};

const formatCurrency = (val) => `₺${(Number(val) || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;

const DashboardOperationsTable = ({
  reservations = [],
  materials = [],
  onUpdateReservation,
  onDeleteReservation,
  onEditReservation,
  onScheduleMakegood,
  onAutoDistributeReservation,
  onUpdateMaterial,
  onPreviewMaterial,
  onOpenNewReservation
}) => {
  const [opsMode, setOpsMode] = useState('reservations'); // 'reservations' | 'materials'

  return (
    <div className="ta-card" style={{ gap: '16px' }}>
      {/* ÜST BAŞLIK VE OPERASYON MODU SEÇİCİ */}
      <div
        className="ta-card-header"
        style={{
          flexWrap: 'wrap',
          paddingBottom: '14px',
          borderBottom: '1px solid var(--ads-border)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className="ta-badge ta-badge-brand">
              CANLI OPERASYON KONSOLU
            </span>
            <h3 className="ta-card-title" style={{ fontSize: '16px' }}>
              Operasyon Ekibi Doğrudan İşlem Tablosu
            </h3>
          </div>
          <p className="ta-card-desc" style={{ marginTop: '4px' }}>
            Rezervasyon onayı, Makegood (telafi yayını) ataması, tahsilat girişi, kuşak dağıtımı ve materyal teknik onay işlemlerini satır içinden doğrudan yönetin.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className="ads-saas-pill-group">
            <button
              type="button"
              onClick={() => setOpsMode('reservations')}
              className={`ads-saas-pill-btn ${opsMode === 'reservations' ? 'active' : ''}`}
              style={{ padding: '7px 14px', fontSize: '12px' }}
            >
              <CalendarCheck size={14} style={{ marginRight: '6px', display: 'inline' }} />
              Rezervasyon, Makegood &amp; Tahsilat ({reservations.length})
            </button>

            <button
              type="button"
              onClick={() => setOpsMode('materials')}
              className={`ads-saas-pill-btn ${opsMode === 'materials' ? 'active' : ''}`}
              style={{ padding: '7px 14px', fontSize: '12px' }}
            >
              <Film size={14} style={{ marginRight: '6px', display: 'inline' }} />
              Materyal Teknik Kontrol &amp; Onay ({materials.length})
            </button>
          </div>
        </div>
      </div>

      {/* ==========================================================================
          MOD 1: REZERVASYON, MAKEGOOD (TELAFİ) VE TAHSİLAT OPERASYON TABLOSU
         ========================================================================== */}
      {opsMode === 'reservations' && (
        <div style={{ overflowX: 'auto' }}>
          {reservations.length === 0 ? (
            <div
              style={{
                padding: '38px',
                textAlign: 'center',
                background: 'var(--ads-pill-bar-bg)',
                borderRadius: '14px',
                border: '1px dashed var(--ads-border)'
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--ads-text-main)' }}>
                Seçili filtre kriterlerine uygun rezervasyon kaydı bulunmuyor.
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ads-text-muted)', marginTop: '4px', marginBottom: '14px' }}>
                Yeni bir reklam veya sponsorluk rezervasyonu ekleyerek operasyon tablosundan anlık yönetebilirsiniz.
              </div>
              {onOpenNewReservation && (
                <button
                  type="button"
                  onClick={onOpenNewReservation}
                  className="ads-saas-btn primary"
                  style={{ padding: '8px 16px', fontSize: '12.5px' }}
                >
                  + Yeni Rezervasyon Oluştur
                </button>
              )}
            </div>
          ) : (
            <table className="ta-table">
              <thead>
                <tr>
                  <th>Firma &amp; Kampanya / Klip</th>
                  <th>Kanal &amp; Tarih</th>
                  <th>Rezervasyon Durumu</th>
                  <th>Yayın Kontrolü (Yayın / Plan)</th>
                  <th>Makegood (Telafi Yayını)</th>
                  <th>Gelir &amp; Tahsilat</th>
                  <th style={{ textAlign: 'right' }}>Doğrudan Operasyon</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map(res => {
                  const stBadge = STATUS_BADGE_MAP[res.lifecycleStatus] || STATUS_BADGE_MAP.active;

                  return (
                    <tr key={res.id}>
                      {/* 1. Firma & Kampanya */}
                      <td>
                        <div style={{ fontWeight: '700', color: 'var(--ads-text-main)', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{res.companyName}</span>
                          {res.isSponsor && (
                            <span className="ta-badge ta-badge-brand">
                              Sponsor
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)', marginTop: '2px' }}>
                          {res.productName} • <span style={{ color: 'var(--ads-brand)', fontWeight: '600' }}>{res.sector}</span>
                        </div>
                      </td>

                      {/* 2. Kanal & Tarih */}
                      <td>
                        <div style={{ fontWeight: '600', color: 'var(--ads-text-main)', fontSize: '12.5px' }}>
                          {res.allChannelIds.map(c => (c === 'ch_way' ? 'WAY' : c === 'digital' ? 'Dijital' : 'HD')).join(' + ')}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)', marginTop: '2px' }}>
                          {res.startDate} &rarr; {res.endDate}
                        </div>
                      </td>

                      {/* 3. Rezervasyon Durumu (Doğrudan Seçilebilir Select) */}
                      <td>
                        <select
                          value={res.lifecycleStatus}
                          onChange={e =>
                            onUpdateReservation &&
                            onUpdateReservation(res.id, {
                              status: e.target.value,
                              isCancelled: e.target.value === 'cancelled'
                            })
                          }
                          style={{
                            padding: '5px 10px',
                            borderRadius: '999px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            border: `1px solid ${stBadge.color}40`,
                            background: stBadge.bg,
                            color: stBadge.color,
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          <option value="active">Aktif (Yayında)</option>
                          <option value="pending">Onay Bekliyor</option>
                          <option value="completed">Tamamlandı (Biten)</option>
                          <option value="cancelled">İptal Edildi</option>
                        </select>
                      </td>

                      {/* 4. Yayın Kontrolü (Gerçekleşen / Planlanan Bar) */}
                      <td style={{ minWidth: '170px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: '700', marginBottom: '5px' }}>
                          <span style={{ color: 'var(--ads-text-main)' }}>
                            {res.effectiveRealized} / {res.totalPlanned} Spot
                          </span>
                          <span style={{ color: res.realizationRatePct >= 80 ? 'var(--ads-success-text)' : 'var(--ads-warning-text)' }}>
                            %{res.realizationRatePct}
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', borderRadius: '999px', background: 'var(--ads-border)', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${res.realizationRatePct}%`,
                              height: '100%',
                              background: res.realizationRatePct >= 80 ? '#12b76a' : '#f79009'
                            }}
                          />
                        </div>
                      </td>

                      {/* 5. Makegood (Telafi Yayını) Kontrolü */}
                      <td>
                        {res.makegoodRequiredSpots > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="ta-badge ta-badge-error">
                              {res.makegoodRequiredSpots} Eksik
                            </span>
                            <button
                              type="button"
                              onClick={() => onScheduleMakegood && onScheduleMakegood(res, res.makegoodRequiredSpots)}
                              className="ads-saas-btn"
                              style={{
                                padding: '5px 10px',
                                fontSize: '11px',
                                color: 'var(--ads-brand)',
                                borderColor: 'rgba(70, 95, 255, 0.35)',
                                background: 'var(--ads-brand-soft)'
                              }}
                              title="Eksik kalan spotları telafi (Makegood) olarak planla ve kuşaklara dağıt"
                            >
                              <RefreshCw size={11} /> Telafi Ata (+{res.makegoodRequiredSpots})
                            </button>
                          </div>
                        ) : (
                          <span className="ta-badge ta-badge-success">
                            Telafi Yok {res.makegoodScheduledSpots > 0 ? `(+${res.makegoodScheduledSpots} telafi)` : ''}
                          </span>
                        )}
                      </td>

                      {/* 6. Gelir & Tahsilat */}
                      <td>
                        <div style={{ fontWeight: '700', color: 'var(--ads-text-main)', fontSize: '13px' }}>
                          {formatCurrency(res.plannedRevenue)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                          <span style={{ fontSize: '11px', color: res.remainingReceivable > 0 ? 'var(--ads-warning-text)' : 'var(--ads-success-text)', fontWeight: '600' }}>
                            {res.remainingReceivable > 0
                              ? `Kalan: ${formatCurrency(res.remainingReceivable)}`
                              : 'Tamamı Tahsil Edildi'}
                          </span>
                          {res.remainingReceivable > 0 && onUpdateReservation && (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateReservation(res.id, {
                                  paymentStatus: 'paid',
                                  collectedAmount: res.plannedRevenue
                                })
                              }
                              style={{
                                border: '1px solid rgba(3, 152, 85, 0.3)',
                                background: 'var(--ads-success-soft)',
                                color: 'var(--ads-success-text)',
                                borderRadius: '6px',
                                padding: '2px 7px',
                                fontSize: '10.5px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                              title="Alacağın tamamını tahsil edildi olarak işaretle"
                            >
                              Tahsil Et
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 7. Doğrudan Operasyon Butonları */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {res.materialObj && onPreviewMaterial && (
                            <button
                              type="button"
                              onClick={() => onPreviewMaterial(res.materialObj)}
                              className="ads-saas-btn"
                              style={{ padding: '6px 9px', fontSize: '11.5px' }}
                              title="Reklam Klibini Önizle"
                            >
                              <Play size={12} />
                            </button>
                          )}

                          {onAutoDistributeReservation && (
                            <button
                              type="button"
                              onClick={() => onAutoDistributeReservation(res)}
                              className="ads-saas-btn"
                              style={{ padding: '6px 10px', fontSize: '11.5px', color: 'var(--ads-brand)' }}
                              title="Bu rezervasyonun haftalık kuşaklarını otomatik dağıt"
                            >
                              <Sparkles size={12} /> Dağıt
                            </button>
                          )}

                          {onEditReservation && (
                            <button
                              type="button"
                              onClick={() => onEditReservation(res)}
                              className="ads-saas-btn"
                              style={{ padding: '6px 9px', fontSize: '11.5px' }}
                              title="Rezervasyonu Düzenle"
                            >
                              <Edit2 size={12} />
                            </button>
                          )}

                          {onDeleteReservation && (
                            <button
                              type="button"
                              onClick={() => onDeleteReservation(res.id)}
                              className="ads-saas-btn"
                              style={{ padding: '6px 9px', fontSize: '11.5px', color: 'var(--ads-error-text)' }}
                              title="Rezervasyonu Sil"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ==========================================================================
          MOD 2: MATERYAL TEKNİK KONTROL, YAYIN ONAYI VE KULLANIM TARİHİ TABLOSU
         ========================================================================== */}
      {opsMode === 'materials' && (
        <div style={{ overflowX: 'auto' }}>
          <table className="ta-table">
            <thead>
              <tr>
                <th>Materyal / Klip Adı</th>
                <th>Firma &amp; Kampanya</th>
                <th>Süre (Sn)</th>
                <th>Teknik &amp; Yayın Onay Durumu</th>
                <th>Son Kullanım Tarihi</th>
                <th style={{ textAlign: 'right' }}>Hızlı İşlem</th>
              </tr>
            </thead>
            <tbody>
              {materials.slice(0, 25).map(mat => {
                const vMeta = mat.validityMeta || MATERIAL_VALIDITY_STATUSES.approved;
                return (
                  <tr key={mat.id}>
                    <td>
                      <div style={{ fontWeight: '700', color: 'var(--ads-text-main)', fontSize: '13.5px' }}>
                        {mat.name || mat.clipName}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)', fontFamily: 'monospace' }}>
                        {mat.clipName || mat.fileName || mat.id}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: '600', color: 'var(--ads-text-main)' }}>{mat.companyName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>{mat.productName}</div>
                    </td>

                    <td style={{ fontWeight: '700', fontFamily: 'monospace' }}>
                      {mat.duration || 30} sn
                    </td>

                    <td>
                      <select
                        value={mat.validity || 'approved'}
                        onChange={e =>
                          onUpdateMaterial &&
                          onUpdateMaterial(mat.id, {
                            validityStatus: e.target.value,
                            approvalStatus: e.target.value === 'approved' ? 'approved' : 'pending'
                          })
                        }
                        style={{
                          padding: '5px 10px',
                          borderRadius: '999px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          border: `1px solid ${vMeta.color}40`,
                          background: vMeta.bg,
                          color: vMeta.color,
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        <option value="approved">Yayına Uygun (Onaylı)</option>
                        <option value="pending">Onay Bekliyor</option>
                        <option value="technical_error">Teknik Hatalı (Ses/TC)</option>
                        <option value="expired">Süresi Dolan</option>
                        <option value="missing">Eksik Dosya / Süre</option>
                      </select>
                    </td>

                    <td>
                      <input
                        type="date"
                        value={mat.validUntil || ''}
                        onChange={e =>
                          onUpdateMaterial &&
                          onUpdateMaterial(mat.id, {
                            validUntil: e.target.value
                          })
                        }
                        className="ads-saas-input"
                        style={{
                          padding: '5px 9px',
                          fontSize: '11.5px',
                          width: 'auto'
                        }}
                      />
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {onPreviewMaterial && (
                          <button
                            type="button"
                            onClick={() => onPreviewMaterial(mat)}
                            className="ads-saas-btn"
                            style={{ padding: '6px 10px', fontSize: '11.5px' }}
                          >
                            <Play size={12} /> İzle
                          </button>
                        )}
                        {mat.validity !== 'approved' && onUpdateMaterial && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateMaterial(mat.id, {
                                validityStatus: 'approved',
                                approvalStatus: 'approved',
                                technicalStatus: 'ok'
                              })
                            }
                            className="ads-saas-btn"
                            style={{ padding: '6px 10px', fontSize: '11.5px', color: 'var(--ads-success-text)' }}
                          >
                            <ShieldCheck size={12} /> Teknik Onay Ver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DashboardOperationsTable;
