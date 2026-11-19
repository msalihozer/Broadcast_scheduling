/**
 * @file src/components/Ads/planning/AdPlanningWorkspaceViews.jsx
 * @description Reklam Kuşak Planlama Çalışma Alanı Görünümleri, Sağ Sabit Hızlı Spot Havuzu (`AdQuickSpotPoolPanel`)
 * ve Hızlı Manuel Spot Ekleme Modalı (`AdManualSpotModal`).
 *
 * İçerdiği Görünüm Bileşenleri:
 * 1. `AdBreaksListView`: Yukarıdan aşağıya net reklam kuşağı ve spot listesi (`breaks`).
 *    Tıklanan kuşak sağdaki Hızlı Spot Havuzu için "Hedef Kuşak" olarak seçilir.
 * 2. `AdQuickSpotPoolPanel`: Sağ tarafta sabit duran, ekran değiştirmeden seçili kuşağa tek tıkla
 *    rezervasyon veya katalogdan reklam ekleme paneli.
 * 3. `AdBroadcastFlowView`: Programlar ve reklam kuşaklarının birlikte yer aldığı tam yayın akışı (`flow`).
 * 4. `AdHourlyMatrixView`: Kompakt saatlik özet tablo matrisi (`matrix`).
 * 5. `AdManualSpotModal`: Hızlı manuel reklam spotu ekleme pop-up modalı.
 */
import React from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Search,
  Megaphone,
  PlayCircle,
  CheckCircle2,
  X,
  Target
} from 'lucide-react';
import { PRIORITY_BADGES } from './adPlanningConstants';
import useThemeStore, { hexToRgba } from '../../../store/themeStore';

export const AdBreaksListView = ({
  adBreaksList = [],
  selectedDayInfo,
  selectedStudioBreak,
  onSelectStudioBreakTime,
  companies = [],
  products = [],
  materials = [],
  reservations = [],
  onClearAdBreak,
  onOpenQuickModalBreak,
  onMoveAdInBreak,
  onRemoveAdFromBreak
}) => {
  const themeConfig = useThemeStore(state => state.config);
  const emptyBreakColor = themeConfig?.modules?.ads?.emptyBreakColor || themeConfig?.specialColors?.adBreakEmptyColor || '#ea580c';
  const filledBreakColor = themeConfig?.modules?.ads?.filledBreakColor || themeConfig?.specialColors?.adBreakFilledColor || '#0d9488';
  if (adBreaksList.length === 0) {
    return (
      <div
        className="ta-card"
        style={{
          padding: '42px 24px',
          alignItems: 'center',
          textAlign: 'center',
          gap: '10px'
        }}
      >
        <Megaphone size={36} color="var(--ads-text-muted)" />
        <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
          Bu Gün ve Liste İçin Henüz Reklam Kuşağı Bulunmuyor
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--ads-text-muted)', maxWidth: '520px' }}>
          Yayın Planlama ekranından bu günün yayın akışını kaydedip gönderebilir veya üstteki{' '}
          <strong>&quot;Yayın Akışından Güncelle&quot;</strong> butonuna tıklayarak mevcut kuşakları çekebilirsiniz.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {adBreaksList.map((brk, brkIdx) => {
        const isActiveTarget =
          selectedStudioBreak && selectedStudioBreak.shortTime === brk.shortTime;

        return (
          <div
            key={brk.instanceId || brk.shortTime}
            onClick={() => onSelectStudioBreakTime && onSelectStudioBreakTime(brk.shortTime)}
            className="ta-card"
            style={{
              padding: '16px 18px',
              gap: '12px',
              cursor: 'pointer',
              border: isActiveTarget
                ? '2px solid var(--ads-brand)'
                : '1px solid var(--ads-border)',
              borderLeft: `6px solid ${
                isActiveTarget
                  ? 'var(--ads-brand)'
                  : brk.placedAds.length > 0
                  ? filledBreakColor
                  : emptyBreakColor
              }`,
              boxShadow: isActiveTarget
                ? '0 8px 22px -6px rgba(70, 95, 255, 0.2)'
                : undefined,
              transition: 'all 0.15s ease'
            }}
          >
            {/* Kuşak Üst Başlığı */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: isActiveTarget ? 'var(--ads-brand)' : 'var(--ads-pill-bar-bg)',
                      color: isActiveTarget ? '#ffffff' : 'var(--ads-text-sub)'
                    }}
                  >
                    {brkIdx + 1}. Kuşak
                  </span>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '13.5px',
                      fontWeight: '900',
                      padding: '3px 9px',
                      borderRadius: '7px',
                      background: 'var(--ads-brand-soft)',
                      color: 'var(--ads-brand)'
                    }}
                  >
                    {brk.exactStartClock} → {brk.exactEndClock}
                  </span>
                  <span style={{ fontSize: '14.5px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                    {brk.title}
                  </span>
                  <span className="ta-badge ta-badge-info" style={{ fontSize: '10.5px' }}>
                    {brk.timeBlockName}
                  </span>
                  {isActiveTarget && (
                    <span className="ta-badge ta-badge-brand" style={{ fontSize: '10.5px' }}>
                      <Target size={11} /> Seçili Hedef Kuşak
                    </span>
                  )}
                </div>

                {/* Komşu Program Bilgisi */}
                {(brk.prevProgramTitle || brk.nextProgramTitle) && (
                  <div style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)' }}>
                    {brk.prevProgramTitle && (
                      <span>
                        Önceki Program: <strong style={{ color: 'var(--ads-text-sub)' }}>{brk.prevProgramTitle}</strong>
                      </span>
                    )}
                    {brk.prevProgramTitle && brk.nextProgramTitle && <span> • </span>}
                    {brk.nextProgramTitle && (
                      <span>
                        Sonraki Program: <strong style={{ color: 'var(--ads-text-sub)' }}>{brk.nextProgramTitle}</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: 'rgba(13, 148, 136, 0.1)',
                    color: '#0d9488'
                  }}
                >
                  {brk.placedAds.length} Spot
                </span>

                {brk.placedAds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onClearAdBreak(selectedDayInfo.channelId, selectedDayInfo.date, brk.shortTime)}
                    className="ads-saas-btn ads-saas-btn-danger ads-saas-btn-sm"
                    title="Bu kuşağı temizle"
                  >
                    <Trash2 size={13} /> Temizle
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (onSelectStudioBreakTime) onSelectStudioBreakTime(brk.shortTime);
                    onOpenQuickModalBreak(brk);
                  }}
                  className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                >
                  <Plus size={14} /> Spot Ekle
                </button>
              </div>
            </div>

            {/* Kuşak Süre Doluluk Çubuğu */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: '700' }}>
                <span style={{ color: 'var(--ads-text-sub)' }}>
                  Doldurulan Süre: <strong>{brk.filledSec} sn</strong> / {brk.capacitySec} sn ({brk.durationMin} dk)
                </span>
                <span style={{ color: brk.remainingSec > 0 ? '#0d9488' : '#dc2626' }}>
                  Kalan Boş Süre: {brk.remainingSec} sn (%{brk.fillPct} Dolu)
                </span>
              </div>
              <div style={{ height: '6px', background: 'var(--ads-pill-bar-bg)', borderRadius: '999px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${brk.fillPct}%`,
                    height: '100%',
                    background: brk.fillPct > 95 ? '#f59e0b' : 'linear-gradient(90deg, #0d9488 0%, #10b981 100%)',
                    borderRadius: '999px'
                  }}
                />
              </div>
            </div>

            {/* Yerleştirilen Reklam Spotları Listesi */}
            {brk.placedAds.length === 0 ? (
              <div
                onClick={e => {
                  e.stopPropagation();
                  if (onSelectStudioBreakTime) onSelectStudioBreakTime(brk.shortTime);
                  onOpenQuickModalBreak(brk);
                }}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  border: '1.5px dashed var(--ads-border-strong)',
                  background: 'var(--ads-card-subtle)',
                  textAlign: 'center',
                  color: 'var(--ads-text-muted)',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Bu kuşak boş. Sağdaki havuzdan doğrudan ekleyebilir veya <strong>+ Spot Ekle</strong> butonuna tıklayabilirsiniz.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }} onClick={e => e.stopPropagation()}>
                {brk.placedAds.map((ad, adIdx) => {
                  const comp = companies.find(c => String(c.id) === String(ad.companyId));
                  const prod = products.find(p => String(p.id) === String(ad.productId));
                  const mat = materials.find(m => String(m.id) === String(ad.materialId));
                  const resObj = reservations.find(r => String(r.id) === String(ad.reservationId));
                  const prioBadge = PRIORITY_BADGES[resObj?.priority] || null;

                  return (
                    <div
                      key={`${ad.materialId}-${adIdx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        padding: '8px 12px',
                        borderRadius: '9px',
                        background: 'var(--ads-card-subtle)',
                        border: '1px solid var(--ads-border)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                        <span
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '6px',
                            background: 'var(--ads-pill-bar-bg)',
                            color: 'var(--ads-text-main)',
                            fontSize: '11px',
                            fontWeight: '800',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          {adIdx + 1}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                              {mat?.name || 'Reklam Spotu'}
                            </span>
                            {(ad.isSponsorSpot || resObj?.isSponsor) && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  padding: '1px 7px',
                                  borderRadius: '999px',
                                  background: ad.lockOrder ? 'rgba(225, 29, 72, 0.14)' : 'rgba(147, 51, 234, 0.14)',
                                  color: ad.lockOrder ? '#e11d48' : '#9333ea'
                                }}
                              >
                                {ad.sponsorRoleLabel || 'Sponsor'}
                              </span>
                            )}
                            {prioBadge && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  padding: '1px 7px',
                                  borderRadius: '5px',
                                  background: prioBadge.bg,
                                  color: prioBadge.color
                                }}
                              >
                                {prioBadge.label}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)', marginTop: '1px' }}>
                            <strong>{comp?.name || mat?.companyName || 'Firma'}</strong> • {prod?.name || mat?.productName || 'Ürün'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '11.5px',
                            fontWeight: '800',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(13, 148, 136, 0.12)',
                            color: '#0d9488'
                          }}
                        >
                          {ad.duration} sn
                        </span>

                        <button
                          type="button"
                          disabled={adIdx === 0}
                          onClick={() => onMoveAdInBreak(selectedDayInfo.channelId, selectedDayInfo.date, brk.shortTime, adIdx, -1)}
                          className="ads-saas-btn ads-saas-btn-sm"
                          style={{ padding: '4px 6px', opacity: adIdx === 0 ? 0.35 : 1 }}
                          title="Yukarı Taşı"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          disabled={adIdx === brk.placedAds.length - 1}
                          onClick={() => onMoveAdInBreak(selectedDayInfo.channelId, selectedDayInfo.date, brk.shortTime, adIdx, 1)}
                          className="ads-saas-btn ads-saas-btn-sm"
                          style={{ padding: '4px 6px', opacity: adIdx === brk.placedAds.length - 1 ? 0.35 : 1 }}
                          title="Aşağı Taşı"
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveAdFromBreak(selectedDayInfo.channelId, selectedDayInfo.date, brk.shortTime, adIdx)}
                          className="ads-saas-btn ads-saas-btn-danger ads-saas-btn-sm"
                          style={{ padding: '4px 6px' }}
                          title="Spotu Kaldır"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Sağ Sabit Hızlı Reklam / Spot Ekleme Paneli:
 * Operatör ekran değiştirmeden orta listeden seçtiği kuşağa tek tıkla reklam ekleyebilir.
 */
export const AdQuickSpotPoolPanel = ({
  manualSourceTab,
  onChangeManualSourceTab,
  eligibleReservationItemsCount = 0,
  materialsCount = 0,
  manualSearch,
  onChangeManualSearch,
  manualCompanyFilter,
  onChangeManualCompanyFilter,
  companies = [],
  adBreaksList = [],
  selectedStudioBreak,
  onSelectStudioBreakTime,
  filteredPoolReservations = [],
  filteredPoolCatalog = [],
  onQuickAddSpotToBreak
}) => {
  return (
    <div
      className="ta-card"
      style={{
        padding: '15px',
        gap: '12px',
        position: 'sticky',
        top: '12px',
        maxHeight: 'calc(100vh - 110px)',
        overflowY: 'auto'
      }}
    >
      {/* 1. Hedef Kuşak Seçici */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
            Hızlı Reklam / Spot Ekleme Havuzu
          </span>
          {selectedStudioBreak && (
            <span className="ta-badge ta-badge-brand" style={{ fontSize: '10.5px' }}>
              Hedef: {selectedStudioBreak.shortTime}
            </span>
          )}
        </div>

        {adBreaksList.length > 0 && (
          <select
            value={selectedStudioBreak?.shortTime || ''}
            onChange={e => onSelectStudioBreakTime && onSelectStudioBreakTime(e.target.value)}
            className="ads-saas-select"
            style={{ width: '100%', fontSize: '12px', fontWeight: '700' }}
          >
            {adBreaksList.map((b, i) => (
              <option key={b.shortTime} value={b.shortTime}>
                {i + 1}. Kuşak ({b.shortTime}) — {b.placedAds.length} Spot | Kalan: {b.remainingSec} sn
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 2. Kaynak Sekmesi: Rezervasyonlar vs Katalog */}
      <div className="ads-saas-pill-group" style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <button
          type="button"
          onClick={() => onChangeManualSourceTab('reservations')}
          className={`ads-saas-pill-btn ${manualSourceTab === 'reservations' ? 'active' : ''}`}
          style={{ padding: '6px 8px', fontSize: '11px', justifyContent: 'center' }}
        >
          Rezervasyon ({eligibleReservationItemsCount})
        </button>
        <button
          type="button"
          onClick={() => onChangeManualSourceTab('catalog')}
          className={`ads-saas-pill-btn ${manualSourceTab === 'catalog' ? 'active' : ''}`}
          style={{ padding: '6px 8px', fontSize: '11px', justifyContent: 'center' }}
        >
          Tüm Katalog ({materialsCount})
        </button>
      </div>

      {/* 3. Arama ve Firma Filtresi */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--ads-text-muted)' }} />
          <input
            type="text"
            value={manualSearch}
            onChange={e => onChangeManualSearch(e.target.value)}
            placeholder="Firma, ürün veya spot ara..."
            className="ads-saas-input"
            style={{ width: '100%', paddingLeft: '28px', fontSize: '11.5px', height: '32px' }}
          />
        </div>

        <select
          value={manualCompanyFilter}
          onChange={e => onChangeManualCompanyFilter(e.target.value)}
          className="ads-saas-select"
          style={{ width: '100%', fontSize: '11.5px', height: '32px' }}
        >
          <option value="">Tüm Firmalar</option>
          {companies.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* 4. Spot Listesi */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {manualSourceTab === 'reservations' ? (
          filteredPoolReservations.length === 0 ? (
            <div style={{ padding: '18px 10px', textAlign: 'center', fontSize: '11.5px', color: 'var(--ads-text-muted)' }}>
              Bu kanal için eşleşen rezervasyon bulunamadı. &quot;Tüm Katalog&quot; sekmesinden ekleyebilirsiniz.
            </div>
          ) : (
            filteredPoolReservations.map(item => {
              const isMaxReached = item.todayPlaced >= item.dailyMaxSpots;
              return (
                <div
                  key={item.uniqueKey}
                  style={{
                    padding: '9px 11px',
                    borderRadius: '10px',
                    border: '1px solid var(--ads-border)',
                    background: 'var(--ads-card-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--ads-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.materialName}
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)', marginTop: '1px' }}>
                      <strong>{item.companyName}</strong> • {item.durationSec} sn
                    </div>
                    <div style={{ fontSize: '10px', color: isMaxReached ? '#d97706' : '#0d9488', fontWeight: '700', marginTop: '2px' }}>
                      Bugün: {item.todayPlaced} (Min:{item.dailyMinSpots}/Max:{item.dailyMaxSpots})
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!selectedStudioBreak}
                    onClick={() =>
                      selectedStudioBreak &&
                      onQuickAddSpotToBreak(selectedStudioBreak, {
                        reservationId: item.reservationId,
                        materialId: item.materialId,
                        companyId: item.companyId,
                        productId: item.productId
                      })
                    }
                    className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                    style={{ flexShrink: 0, padding: '5px 9px', fontSize: '11px' }}
                  >
                    <Plus size={12} /> Ekle
                  </button>
                </div>
              );
            })
          )
        ) : (
          filteredPoolCatalog.map(mat => (
            <div
              key={mat.id}
              style={{
                padding: '9px 11px',
                borderRadius: '10px',
                border: '1px solid var(--ads-border)',
                background: 'var(--ads-card-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--ads-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {mat.name}
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)', marginTop: '1px' }}>
                  <strong>{mat.companyName}</strong> • {mat.duration} sn
                </div>
              </div>

              <button
                type="button"
                disabled={!selectedStudioBreak}
                onClick={() =>
                  selectedStudioBreak &&
                  onQuickAddSpotToBreak(selectedStudioBreak, {
                    materialId: mat.id,
                    companyId: mat.companyId,
                    productId: mat.productId
                  })
                }
                className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                style={{ flexShrink: 0, padding: '5px 9px', fontSize: '11px' }}
              >
                <Plus size={12} /> Ekle
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const AdBroadcastFlowView = ({
  enrichedTimeline = [],
  materials = [],
  companies = [],
  selectedDayInfo,
  onOpenQuickModalBreak,
  onRemoveAdFromBreak
}) => {
  const themeConfig = useThemeStore(state => state.config);
  const emptyBreakColor = themeConfig?.modules?.ads?.emptyBreakColor || themeConfig?.specialColors?.adBreakEmptyColor || '#ea580c';
  const filledBreakColor = themeConfig?.modules?.ads?.filledBreakColor || themeConfig?.specialColors?.adBreakFilledColor || '#0d9488';

  return (
    <div className="ta-card" style={{ padding: '16px', gap: '8px' }}>
      {enrichedTimeline.map(item => (
        <div
          key={item.instanceId || item.idx}
          style={{
            display: 'flex',
            border: '1px solid var(--ads-border)',
            borderLeft: item.isAdBlock
              ? `5px solid ${item.placedAds.length > 0 ? filledBreakColor : emptyBreakColor}`
              : '4px solid var(--ads-brand)',
            borderRadius: '10px',
            background: item.isAdBlock
              ? item.placedAds.length > 0
                ? hexToRgba(filledBreakColor, 0.06)
                : hexToRgba(emptyBreakColor, 0.07)
              : 'var(--ads-card-bg)',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: '125px',
              padding: '10px 12px',
              background: 'var(--ads-card-subtle)',
              borderRight: '1px solid var(--ads-border)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'monospace',
              flexShrink: 0
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: '900', color: 'var(--ads-text-main)' }}>
              {item.exactStartClock}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>
              → {item.exactEndClock}
            </span>
          </div>

          <div style={{ flex: 1, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--ads-text-muted)' }}>
                  #{item.orderNo}
                </span>
                {item.isAdBlock ? (
                  <Megaphone size={15} color="#ea580c" />
                ) : (
                  <PlayCircle size={15} color="var(--ads-brand)" />
                )}
                <span style={{ fontSize: '13.5px', fontWeight: '800', color: item.isAdBlock ? '#ea580c' : 'var(--ads-text-main)' }}>
                  {item.title}
                </span>
                {item.partNo && (
                  <span className="ta-badge ta-badge-info" style={{ fontSize: '10px' }}>
                    Part {item.partNo}
                  </span>
                )}
                <span style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)', fontWeight: '600' }}>
                  ({item.durationMin} dk)
                </span>
              </div>

              {item.isAdBlock && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-sub)' }}>
                    {item.placedAds.length} Spot • {item.filledSec} / {item.capacitySec} sn
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenQuickModalBreak(item)}
                    className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                  >
                    <Plus size={12} /> Spot Ekle
                  </button>
                </div>
              )}
            </div>

            {item.isAdBlock && item.placedAds.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                {item.placedAds.map((ad, i) => {
                  const mat = materials.find(m => String(m.id) === String(ad.materialId));
                  const comp = companies.find(c => String(c.id) === String(ad.companyId));
                  return (
                    <span
                      key={i}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 9px',
                        borderRadius: '7px',
                        background: 'var(--ads-card-bg)',
                        border: '1px solid var(--ads-border)',
                        fontSize: '11.5px',
                        fontWeight: '700'
                      }}
                    >
                      <span style={{ color: 'var(--ads-brand)' }}>{i + 1}.</span>
                      <span>{mat?.name || 'Spot'}</span>
                      <span style={{ color: 'var(--ads-text-muted)', fontWeight: '500' }}>
                        ({comp?.name} • {ad.duration}sn)
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveAdFromBreak(selectedDayInfo.channelId, selectedDayInfo.date, item.shortTime, i)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                        title="Kaldır"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export const AdHourlyMatrixView = ({
  adBreaksList = [],
  materials = [],
  onOpenQuickModalBreak
}) => {
  return (
    <div className="ta-card" style={{ padding: '0', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="ta-table">
          <thead>
            <tr>
              <th>Saat</th>
              <th>Kuşak Başlığı &amp; Bağlam</th>
              <th>Yayın Kuşağı</th>
              <th>Spot Adedi</th>
              <th>Doldurulan / Kapasite</th>
              <th>Yerleştirilen Reklamlar</th>
              <th style={{ textAlign: 'right' }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {adBreaksList.map(brk => (
              <tr key={brk.shortTime}>
                <td style={{ fontFamily: 'monospace', fontWeight: '900', color: 'var(--ads-brand)', fontSize: '13px' }}>
                  {brk.shortTime}
                </td>
                <td>
                  <div style={{ fontWeight: '700', color: 'var(--ads-text-main)' }}>{brk.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>
                    {brk.prevProgramTitle || '-'} &rarr; {brk.nextProgramTitle || '-'}
                  </div>
                </td>
                <td>
                  <span className="ta-badge ta-badge-info">{brk.timeBlockName}</span>
                </td>
                <td style={{ fontWeight: '700', color: 'var(--ads-brand)' }}>
                  {brk.placedAds.length} Spot
                </td>
                <td>
                  <span style={{ fontWeight: '700', color: '#0d9488' }}>
                    {brk.filledSec} sn / {brk.capacitySec} sn (%{brk.fillPct})
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {brk.placedAds.map((ad, idx) => {
                      const mat = materials.find(m => String(m.id) === String(ad.materialId));
                      return (
                        <span key={idx} className="ta-badge ta-badge-brand" style={{ fontSize: '10.5px' }}>
                          {mat?.name || 'Spot'} ({ad.duration}sn)
                        </span>
                      );
                    })}
                    {brk.placedAds.length === 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>Boş</span>
                    )}
                  </div>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => onOpenQuickModalBreak(brk)}
                    className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                  >
                    <Plus size={12} /> Spot Ekle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const AdManualSpotModal = ({
  quickModalBreak,
  selectedDayInfo,
  adBreaksList = [],
  manualSourceTab,
  onChangeManualSourceTab,
  eligibleReservationItemsCount = 0,
  materialsCount = 0,
  manualSearch,
  onChangeManualSearch,
  filteredPoolReservations = [],
  filteredPoolCatalog = [],
  onQuickAddSpotToBreak,
  onClose
}) => {
  if (!quickModalBreak || !selectedDayInfo) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.62)',
        backdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '18px'
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '780px',
          maxHeight: '85vh',
          background: 'var(--ads-canvas-bg)',
          border: '1px solid var(--ads-border-strong)',
          borderRadius: '20px',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            height: '4px',
            background: 'linear-gradient(135deg, #2563eb 0%, #0d9488 100%)'
          }}
        />

        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--ads-border)',
            background: 'var(--ads-card-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: 900,
                  padding: '3px 9px',
                  borderRadius: '7px',
                  background: 'var(--ads-brand-soft)',
                  color: 'var(--ads-brand)'
                }}
              >
                {quickModalBreak.shortTime} Kuşağı
              </span>
              <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                Manuel Reklam Spotu Ekle
              </h3>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ads-text-muted)', marginTop: '4px' }}>
              {quickModalBreak.title} ({quickModalBreak.timeBlockName}) • Kalan Boş Süre:{' '}
              <strong style={{ color: '#0d9488' }}>
                {adBreaksList.find(b => b.shortTime === quickModalBreak.shortTime)?.remainingSec ?? quickModalBreak.remainingSec} sn
              </strong>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ads-saas-btn ads-saas-btn-sm"
            style={{ padding: '6px' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--ads-border)', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <div className="ads-saas-pill-group">
            <button
              type="button"
              onClick={() => onChangeManualSourceTab('reservations')}
              className={`ads-saas-pill-btn ${manualSourceTab === 'reservations' ? 'active' : ''}`}
            >
              Aktif Rezervasyonlar ({eligibleReservationItemsCount})
            </button>
            <button
              type="button"
              onClick={() => onChangeManualSourceTab('catalog')}
              className={`ads-saas-pill-btn ${manualSourceTab === 'catalog' ? 'active' : ''}`}
            >
              Tüm Reklam Materyalleri ({materialsCount})
            </button>
          </div>

          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--ads-text-muted)' }} />
            <input
              type="text"
              value={manualSearch}
              onChange={e => onChangeManualSearch(e.target.value)}
              placeholder="Firma, ürün veya spot ara..."
              className="ads-saas-input"
              style={{ width: '100%', paddingLeft: '30px' }}
            />
          </div>
        </div>

        <div style={{ padding: '16px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {manualSourceTab === 'reservations'
            ? filteredPoolReservations.map(item => (
                <div
                  key={item.uniqueKey}
                  style={{
                    padding: '11px 14px',
                    borderRadius: '11px',
                    border: '1px solid var(--ads-border)',
                    background: 'var(--ads-card-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                      {item.materialName} ({item.durationSec} sn)
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)', marginTop: '2px' }}>
                      <strong>{item.companyName}</strong> • {item.productName} • Günlük: {item.todayPlaced} / Min {item.dailyMinSpots} - Max {item.dailyMaxSpots}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onQuickAddSpotToBreak(quickModalBreak, {
                        reservationId: item.reservationId,
                        materialId: item.materialId,
                        companyId: item.companyId,
                        productId: item.productId
                      })
                    }
                    className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                  >
                    <Plus size={13} /> Bu Kuşağa Ekle
                  </button>
                </div>
              ))
            : filteredPoolCatalog.map(mat => (
                <div
                  key={mat.id}
                  style={{
                    padding: '11px 14px',
                    borderRadius: '11px',
                    border: '1px solid var(--ads-border)',
                    background: 'var(--ads-card-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                      {mat.name} ({mat.duration} sn)
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)', marginTop: '2px' }}>
                      <strong>{mat.companyName}</strong> • {mat.productName}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onQuickAddSpotToBreak(quickModalBreak, {
                        materialId: mat.id,
                        companyId: mat.companyId,
                        productId: mat.productId
                      })
                    }
                    className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                  >
                    <Plus size={13} /> Bu Kuşağa Ekle
                  </button>
                </div>
              ))}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--ads-border)', background: 'var(--ads-card-subtle)', display: 'flex', justifyContent: 'center' }}>
          <button type="button" onClick={onClose} className="ads-saas-btn ads-saas-btn-primary" style={{ minWidth: '160px' }}>
            <CheckCircle2 size={15} /> Tamam, Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
