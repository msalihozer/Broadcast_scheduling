/**
 * @file src/components/Ads/planning/AdPlanningWorkspaceViews.jsx
 * @description Reklam Kuşak Planlama Çalışma Alanı Görünümleri, Sağ Sabit Hızlı Spot Havuzu (`AdQuickSpotPoolPanel`)
 * ve Hızlı Manuel Spot Ekleme Modalı (`AdManualSpotModal`).
 *
 * Özellikler:
 * 1. Eklenen tüm reklamlar ve yan paneldeki (Rezervasyon / Katalog) tüm reklamlar için tek tıkla "▶ İzle" video kontrol butonu.
 * 2. Sponsor Reklamları (Sunar, Sundu, Devam Edecek, Devam Ediyor, Program Öncesi/Arası/Sonrası) ve
 *    Sponsorlu Programlar için belirgin Mor / Altın (Purple & Gold) renklendirme ve rozetler.
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
  Target,
  Play,
  Award,
  Tv
} from 'lucide-react';
import { PRIORITY_BADGES } from './adPlanningConstants';
import useThemeStore, { hexToRgba } from '../../../store/themeStore';

const resolveAdSponsorInfo = (ad, resObj, brk = null) => {
  const matchedItem = Array.isArray(resObj?.items)
    ? resObj.items.find(it => String(it.materialId) === String(ad.materialId))
    : null;
  const isSponsor = Boolean(
    ad.isSponsorSpot ||
      ad.lockOrder ||
      (ad.sponsorRole && ad.sponsorRole !== 'standard' && ad.sponsorRole !== 'fallback') ||
      matchedItem?.isSponsor ||
      resObj?.isSponsor
  );
  const programTitle =
    ad.sponsorProgramTitle ||
    matchedItem?.sponsorProgramTitle ||
    resObj?.sponsorProgramTitle ||
    (isSponsor ? (brk?.nextProgramTitle || brk?.prevProgramTitle || '') : '');
  const roleLabel =
    ad.sponsorRoleLabel ||
    (ad.lockOrder === 'first'
      ? 'İlk Sıra Sponsor'
      : ad.lockOrder === 'last'
      ? 'Son Sıra Sponsor'
      : 'Program Sponsoru');

  return {
    isSponsor,
    programTitle,
    roleLabel
  };
};

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
  onRemoveAdFromBreak,
  onPreviewMaterial,
  onSetBreakRamadanTag
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
        const isSponsorBreak = Boolean(
          brk.hasSponsorAds || brk.prevProgramIsSponsored || brk.nextProgramIsSponsored
        );

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
                : isSponsorBreak
                ? '1.5px solid rgba(147, 51, 234, 0.55)'
                : '1px solid var(--ads-border)',
              borderLeft: `6px solid ${
                isActiveTarget
                  ? 'var(--ads-brand)'
                  : brk.hasSponsorAds
                  ? '#9333ea'
                  : brk.placedAds.length > 0
                  ? filledBreakColor
                  : emptyBreakColor
              }`,
              background: brk.hasSponsorAds
                ? 'linear-gradient(180deg, rgba(147, 51, 234, 0.05) 0%, var(--ads-card-bg) 100%)'
                : undefined,
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
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

                  {brk.hasSponsorAds && (
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: '900',
                        padding: '3px 9px',
                        borderRadius: '999px',
                        background: 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)',
                        color: '#ffffff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 2px 8px rgba(147, 51, 234, 0.35)'
                      }}
                    >
                      <Award size={12} /> SPONSORLU KUŞAK
                    </span>
                  )}

                  {onSetBreakRamadanTag && (
                    <select
                      value={brk.ramadanBreakTag || ''}
                      onClick={e => e.stopPropagation()}
                      onChange={e => {
                        e.stopPropagation();
                        onSetBreakRamadanTag(brk, e.target.value);
                      }}
                      title="Bu reklam kuşağını Ramazan Özel (Sahur / İftar Öncesi, Arası, Sonrası) olarak işaretle"
                      style={{
                        fontSize: '10.5px',
                        fontWeight: '900',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        outline: 'none',
                        background: (brk.ramadanBreakTag || '').startsWith('sahur')
                          ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                          : (brk.ramadanBreakTag || '').startsWith('iftar')
                          ? 'linear-gradient(135deg, #d97706, #b45309)'
                          : 'var(--ads-card-subtle)',
                        color: brk.ramadanBreakTag ? '#ffffff' : 'var(--ads-text-sub)',
                        border: brk.ramadanBreakTag ? 'none' : '1px dashed var(--ads-border-strong)'
                      }}
                    >
                      <option value="" style={{ background: '#1e293b', color: '#f8fafc' }}>🌙 Ramazan Özel İşaretle...</option>
                      <option value="sahur_before" style={{ background: '#1e293b', color: '#38bdf8' }}>🌙 SAHUR ÖNCESİ KUŞAĞI</option>
                      <option value="sahur_middle" style={{ background: '#1e293b', color: '#38bdf8' }}>🌙 SAHUR ARASI KUŞAĞI</option>
                      <option value="sahur_after" style={{ background: '#1e293b', color: '#38bdf8' }}>🌙 SAHUR SONRASI KUŞAĞI</option>
                      <option value="iftar_before" style={{ background: '#1e293b', color: '#fbbf24' }}>🕌 İFTAR ÖNCESİ KUŞAĞI</option>
                      <option value="iftar_middle" style={{ background: '#1e293b', color: '#fbbf24' }}>🕌 İFTAR ARASI KUŞAĞI</option>
                      <option value="iftar_after" style={{ background: '#1e293b', color: '#fbbf24' }}>🕌 İFTAR SONRASI KUŞAĞI</option>
                    </select>
                  )}
                  {isActiveTarget && (
                    <span className="ta-badge ta-badge-brand" style={{ fontSize: '10.5px' }}>
                      <Target size={11} /> Seçili Hedef Kuşak
                    </span>
                  )}
                </div>

                {/* Komşu Program ve Sponsorlu Program Renkli Gösterimi */}
                {(brk.prevProgramTitle || brk.nextProgramTitle) && (
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '11.5px', color: 'var(--ads-text-muted)' }}>
                    {brk.prevProgramTitle && (
                      <span
                        style={{
                          padding: brk.prevProgramIsSponsored ? '2px 8px' : '0px',
                          borderRadius: '6px',
                          background: brk.prevProgramIsSponsored ? 'rgba(147, 51, 234, 0.14)' : 'transparent',
                          border: brk.prevProgramIsSponsored ? '1px solid rgba(147, 51, 234, 0.4)' : 'none',
                          color: brk.prevProgramIsSponsored ? '#9333ea' : 'var(--ads-text-muted)'
                        }}
                      >
                        {brk.prevProgramIsSponsored ? '🏆 Sponsorlu Önceki Program: ' : 'Önceki Program: '}
                        <strong style={{ color: brk.prevProgramIsSponsored ? '#7e22ce' : 'var(--ads-text-sub)' }}>
                          {brk.prevProgramTitle} {brk.prevProgramStartClock ? `(${brk.prevProgramStartClock})` : ''}
                        </strong>
                        {brk.prevProgramIsSponsored && brk.prevProgramSponsorText ? ` — ${brk.prevProgramSponsorText}` : ''}
                      </span>
                    )}
                    {brk.prevProgramTitle && brk.nextProgramTitle && <span>•</span>}
                    {brk.nextProgramTitle && (
                      <span
                        style={{
                          padding: brk.nextProgramIsSponsored ? '2px 8px' : '0px',
                          borderRadius: '6px',
                          background: brk.nextProgramIsSponsored ? 'rgba(147, 51, 234, 0.14)' : 'transparent',
                          border: brk.nextProgramIsSponsored ? '1px solid rgba(147, 51, 234, 0.4)' : 'none',
                          color: brk.nextProgramIsSponsored ? '#9333ea' : 'var(--ads-text-muted)'
                        }}
                      >
                        {brk.nextProgramIsSponsored ? '🏆 Sponsorlu Sonraki Program: ' : 'Sonraki Program: '}
                        <strong style={{ color: brk.nextProgramIsSponsored ? '#7e22ce' : 'var(--ads-text-sub)' }}>
                          {brk.nextProgramTitle} {brk.nextProgramStartClock ? `(${brk.nextProgramStartClock})` : ''}
                        </strong>
                        {brk.nextProgramIsSponsored && brk.nextProgramSponsorText ? ` — ${brk.nextProgramSponsorText}` : ''}
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
                  const spInfo = resolveAdSponsorInfo(ad, resObj, brk);

                  return (
                    <div
                      key={`${ad.materialId}-${adIdx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        background: spInfo.isSponsor
                          ? 'linear-gradient(90deg, rgba(147, 51, 234, 0.16) 0%, rgba(217, 119, 6, 0.08) 100%)'
                          : 'var(--ads-card-subtle)',
                        border: spInfo.isSponsor
                          ? '1.5px solid #9333ea'
                          : '1px solid var(--ads-border)',
                        borderLeft: spInfo.isSponsor
                          ? '5px solid #9333ea'
                          : '1px solid var(--ads-border)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            background: spInfo.isSponsor
                              ? 'linear-gradient(135deg, #9333ea, #7e22ce)'
                              : 'var(--ads-pill-bar-bg)',
                            color: spInfo.isSponsor ? '#ffffff' : 'var(--ads-text-main)',
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
                            <span
                              style={{
                                fontSize: '12.5px',
                                fontWeight: '800',
                                color: spInfo.isSponsor ? '#7e22ce' : 'var(--ads-text-main)'
                              }}
                            >
                              {mat?.name || 'Reklam Spotu'}
                            </span>
                            {spInfo.isSponsor && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: '900',
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  background: ad.lockOrder
                                    ? 'linear-gradient(135deg, #e11d48, #be123c)'
                                    : 'linear-gradient(135deg, #9333ea, #7e22ce)',
                                  color: '#ffffff',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                🏆 SPONSOR • {spInfo.roleLabel}
                              </span>
                            )}
                            {spInfo.isSponsor && spInfo.programTitle && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: 'rgba(147, 51, 234, 0.14)',
                                  color: '#9333ea',
                                  border: '1px solid rgba(147, 51, 234, 0.35)'
                                }}
                              >
                                📺 Program: {spInfo.programTitle}
                              </span>
                            )}
                            {(ad.isRamadanSpot || resObj?.isRamadanSpecial) && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: '900',
                                  padding: '1px 7px',
                                  borderRadius: '999px',
                                  background: 'linear-gradient(135deg, #d97706, #b45309)',
                                  color: '#fff'
                                }}
                              >
                                🌙 Ramazan Özel
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
                          <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)', marginTop: '2px' }}>
                            <strong>{comp?.name || mat?.companyName || 'Firma'}</strong> • {prod?.name || mat?.productName || 'Ürün'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                        {onPreviewMaterial && (mat || ad.materialId) && (
                          <button
                            type="button"
                            onClick={() => onPreviewMaterial(mat || ad.materialId)}
                            className="ads-saas-btn ads-saas-btn-teal ads-saas-btn-sm"
                            style={{ padding: '4px 9px', fontSize: '11px', fontWeight: '800' }}
                            title="Bu reklam klibini izle (kontrol et)"
                          >
                            <Play size={11} fill="currentColor" /> İzle
                          </button>
                        )}

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
 * Operatör ekran değiştirmeden orta listeden seçtiği kuşağa tek tıkla reklam izleyip ekleyebilir.
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
  onQuickAddSpotToBreak,
  onPreviewMaterial
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
            placeholder="İlk harften firma, ürün veya spot ara..."
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

      {/* 4. Spot Listesi (Her Kartta ▶ İzle ve + Ekle Butonu + Sponsor Renklendirmesi) */}
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
                    border: item.isSponsor ? '1.5px solid #9333ea' : '1px solid var(--ads-border)',
                    borderLeft: item.isSponsor ? '4px solid #9333ea' : undefined,
                    background: item.isSponsor
                      ? 'linear-gradient(90deg, rgba(147, 51, 234, 0.14) 0%, rgba(217, 119, 6, 0.06) 100%)'
                      : 'var(--ads-card-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: '800',
                          color: item.isSponsor ? '#7e22ce' : 'var(--ads-text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '180px'
                        }}
                      >
                        {item.materialName}
                      </span>
                      {item.isSponsor && (
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: '900',
                            padding: '1px 6px',
                            borderRadius: '999px',
                            background: '#9333ea',
                            color: '#fff'
                          }}
                        >
                          🏆 SPONSOR
                        </span>
                      )}
                    </div>
                    {item.isSponsor && item.sponsorProgramTitle && (
                      <div style={{ fontSize: '10px', fontWeight: '800', color: '#9333ea', marginTop: '1px' }}>
                        📺 Program: {item.sponsorProgramTitle}
                      </div>
                    )}
                    <div style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)', marginTop: '1px' }}>
                      <strong>{item.companyName}</strong> • {item.durationSec} sn
                    </div>
                    <div style={{ fontSize: '10px', color: isMaxReached ? '#d97706' : '#0d9488', fontWeight: '700', marginTop: '2px' }}>
                      Bugün: {item.todayPlaced} (Min:{item.dailyMinSpots}/Max:{item.dailyMaxSpots})
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    {onPreviewMaterial && (
                      <button
                        type="button"
                        onClick={() => onPreviewMaterial(item.materialId)}
                        className="ads-saas-btn ads-saas-btn-teal ads-saas-btn-sm"
                        style={{ padding: '5px 7px', fontSize: '10.5px' }}
                        title="Bu reklam klibini izle"
                      >
                        <Play size={11} fill="currentColor" /> İzle
                      </button>
                    )}

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
                      style={{ padding: '5px 8px', fontSize: '11px' }}
                    >
                      <Plus size={12} /> Ekle
                    </button>
                  </div>
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
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--ads-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {mat.name}
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)', marginTop: '1px' }}>
                  <strong>{mat.companyName}</strong> • {mat.duration} sn
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                {onPreviewMaterial && (
                  <button
                    type="button"
                    onClick={() => onPreviewMaterial(mat)}
                    className="ads-saas-btn ads-saas-btn-teal ads-saas-btn-sm"
                    style={{ padding: '5px 7px', fontSize: '10.5px' }}
                    title="Bu reklam klibini izle"
                  >
                    <Play size={11} fill="currentColor" /> İzle
                  </button>
                )}

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
                  style={{ padding: '5px 8px', fontSize: '11px' }}
                >
                  <Plus size={12} /> Ekle
                </button>
              </div>
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
  reservations = [],
  selectedDayInfo,
  onOpenQuickModalBreak,
  onRemoveAdFromBreak,
  onPreviewMaterial
}) => {
  const themeConfig = useThemeStore(state => state.config);
  const emptyBreakColor = themeConfig?.modules?.ads?.emptyBreakColor || themeConfig?.specialColors?.adBreakEmptyColor || '#ea580c';
  const filledBreakColor = themeConfig?.modules?.ads?.filledBreakColor || themeConfig?.specialColors?.adBreakFilledColor || '#0d9488';

  return (
    <div className="ta-card" style={{ padding: '16px', gap: '8px' }}>
      {enrichedTimeline.map(item => {
        const isSponsoredProg = !item.isAdBlock && Boolean(item.isSponsoredProgram);
        const isSponsorBreak = item.isAdBlock && Boolean(item.hasSponsorAds);

        return (
          <div
            key={item.instanceId || item.idx}
            style={{
              display: 'flex',
              border: isSponsoredProg
                ? '2px solid #9333ea'
                : isSponsorBreak
                ? '1.5px solid rgba(147, 51, 234, 0.55)'
                : '1px solid var(--ads-border)',
              borderLeft: item.isAdBlock
                ? `6px solid ${
                    isSponsorBreak
                      ? '#9333ea'
                      : item.placedAds.length > 0
                      ? filledBreakColor
                      : emptyBreakColor
                  }`
                : isSponsoredProg
                ? '6px solid #9333ea'
                : '4px solid var(--ads-brand)',
              borderRadius: '10px',
              background: isSponsoredProg
                ? 'linear-gradient(90deg, rgba(147, 51, 234, 0.16) 0%, rgba(217, 119, 6, 0.06) 100%)'
                : item.isAdBlock
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
                background: isSponsoredProg ? 'rgba(147, 51, 234, 0.12)' : 'var(--ads-card-subtle)',
                borderRight: '1px solid var(--ads-border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'monospace',
                flexShrink: 0
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: '900', color: isSponsoredProg ? '#7e22ce' : 'var(--ads-text-main)' }}>
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
                    <Megaphone size={15} color={isSponsorBreak ? '#9333ea' : '#ea580c'} />
                  ) : isSponsoredProg ? (
                    <Award size={16} color="#9333ea" />
                  ) : (
                    <PlayCircle size={15} color="var(--ads-brand)" />
                  )}
                  <span
                    style={{
                      fontSize: '13.5px',
                      fontWeight: '800',
                      color: item.isAdBlock
                        ? isSponsorBreak
                          ? '#9333ea'
                          : '#ea580c'
                        : isSponsoredProg
                        ? '#7e22ce'
                        : 'var(--ads-text-main)'
                    }}
                  >
                    {item.title}
                  </span>

                  {isSponsoredProg && (
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: '900',
                        padding: '2px 9px',
                        borderRadius: '999px',
                        background: 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)',
                        color: '#ffffff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 2px 8px rgba(147, 51, 234, 0.3)'
                      }}
                    >
                      🏆 SPONSORLU PROGRAM • {item.sponsorSummaryText}
                    </span>
                  )}

                  {isSponsorBreak && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: '900',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: 'rgba(147, 51, 234, 0.16)',
                        color: '#9333ea',
                        border: '1px solid rgba(147, 51, 234, 0.4)'
                      }}
                    >
                      🏆 Sponsor Reklamı İçeriyor
                    </span>
                  )}

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
                    const resObj = reservations.find(r => String(r.id) === String(ad.reservationId));
                    const spInfo = resolveAdSponsorInfo(ad, resObj, item);

                    return (
                      <span
                        key={i}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 10px',
                          borderRadius: '8px',
                          background: spInfo.isSponsor
                            ? 'linear-gradient(90deg, rgba(147, 51, 234, 0.18) 0%, rgba(217, 119, 6, 0.1) 100%)'
                            : 'var(--ads-card-bg)',
                          border: spInfo.isSponsor
                            ? '1.5px solid #9333ea'
                            : '1px solid var(--ads-border)',
                          fontSize: '11.5px',
                          fontWeight: '700'
                        }}
                      >
                        <span style={{ color: spInfo.isSponsor ? '#9333ea' : 'var(--ads-brand)', fontWeight: '900' }}>
                          {i + 1}.
                        </span>
                        {spInfo.isSponsor && (
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontWeight: '900',
                              padding: '1px 6px',
                              borderRadius: '999px',
                              background: '#9333ea',
                              color: '#fff'
                            }}
                          >
                            🏆 {spInfo.roleLabel}
                          </span>
                        )}
                        <span style={{ color: spInfo.isSponsor ? '#7e22ce' : 'var(--ads-text-main)', fontWeight: '800' }}>
                          {mat?.name || 'Spot'}
                        </span>
                        <span style={{ color: 'var(--ads-text-muted)', fontWeight: '500' }}>
                          ({comp?.name} • {ad.duration}sn)
                        </span>
                        {onPreviewMaterial && (mat || ad.materialId) && (
                          <button
                            type="button"
                            onClick={() => onPreviewMaterial(mat || ad.materialId)}
                            style={{
                              background: 'rgba(13, 148, 136, 0.15)',
                              border: '1px solid rgba(13, 148, 136, 0.35)',
                              color: '#0d9488',
                              borderRadius: '5px',
                              padding: '1px 6px',
                              fontSize: '10px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                            title="Reklamı İzle"
                          >
                            <Play size={10} fill="currentColor" /> İzle
                          </button>
                        )}
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
        );
      })}
    </div>
  );
};

export const AdHourlyMatrixView = ({
  adBreaksList = [],
  materials = [],
  reservations = [],
  onOpenQuickModalBreak,
  onPreviewMaterial
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
              <th>Yerleştirilen Reklamlar (Tıklayarak İzleyin)</th>
              <th style={{ textAlign: 'right' }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {adBreaksList.map(brk => (
              <tr
                key={brk.shortTime}
                style={{
                  background: brk.hasSponsorAds ? 'rgba(147, 51, 234, 0.05)' : undefined
                }}
              >
                <td style={{ fontFamily: 'monospace', fontWeight: '900', color: 'var(--ads-brand)', fontSize: '13px' }}>
                  {brk.shortTime}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '700', color: 'var(--ads-text-main)' }}>{brk.title}</span>
                    {brk.hasSponsorAds && (
                      <span
                        style={{
                          fontSize: '9.5px',
                          fontWeight: '900',
                          padding: '1px 6px',
                          borderRadius: '999px',
                          background: '#9333ea',
                          color: '#fff'
                        }}
                      >
                        🏆 Sponsorlu
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>
                    {brk.prevProgramIsSponsored ? '🏆 ' : ''}{brk.prevProgramTitle || '-'} &rarr;{' '}
                    {brk.nextProgramIsSponsored ? '🏆 ' : ''}{brk.nextProgramTitle || '-'}
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {brk.placedAds.map((ad, idx) => {
                      const mat = materials.find(m => String(m.id) === String(ad.materialId));
                      const resObj = reservations.find(r => String(r.id) === String(ad.reservationId));
                      const spInfo = resolveAdSponsorInfo(ad, resObj, brk);
                      return (
                        <span
                          key={idx}
                          onClick={() => onPreviewMaterial && onPreviewMaterial(mat || ad.materialId)}
                          title="Reklamı izlemek için tıklayın"
                          style={{
                            fontSize: '10.5px',
                            fontWeight: '800',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            cursor: onPreviewMaterial ? 'pointer' : 'default',
                            background: spInfo.isSponsor ? 'rgba(147, 51, 234, 0.16)' : 'var(--ads-brand-soft)',
                            color: spInfo.isSponsor ? '#9333ea' : 'var(--ads-brand)',
                            border: spInfo.isSponsor ? '1px solid #9333ea' : '1px solid transparent',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {spInfo.isSponsor && <span>🏆</span>}
                          <span>{mat?.name || 'Spot'} ({ad.duration}sn)</span>
                          {onPreviewMaterial && <Play size={10} fill="currentColor" />}
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
  onPreviewMaterial,
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
          maxWidth: '820px',
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
                  fontWeight: '900',
                  padding: '3px 9px',
                  borderRadius: '7px',
                  background: 'var(--ads-brand-soft)',
                  color: 'var(--ads-brand)'
                }}
              >
                {quickModalBreak.shortTime} Kuşağı
              </span>
              <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                Manuel Reklam Spotu Ekle &amp; Önizle
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
              placeholder="İlk harften firma, ürün veya spot ara..."
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
                    border: item.isSponsor ? '1.5px solid #9333ea' : '1px solid var(--ads-border)',
                    borderLeft: item.isSponsor ? '5px solid #9333ea' : undefined,
                    background: item.isSponsor
                      ? 'linear-gradient(90deg, rgba(147, 51, 234, 0.14) 0%, rgba(217, 119, 6, 0.06) 100%)'
                      : 'var(--ads-card-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: item.isSponsor ? '#7e22ce' : 'var(--ads-text-main)' }}>
                        {item.materialName} ({item.durationSec} sn)
                      </span>
                      {item.isSponsor && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: '900',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: '#9333ea',
                            color: '#fff'
                          }}
                        >
                          🏆 SPONSOR {item.sponsorProgramTitle ? `• ${item.sponsorProgramTitle}` : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)', marginTop: '2px' }}>
                      <strong>{item.companyName}</strong> • {item.productName} • Günlük: {item.todayPlaced} / Min {item.dailyMinSpots} - Max {item.dailyMaxSpots}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {onPreviewMaterial && (
                      <button
                        type="button"
                        onClick={() => onPreviewMaterial(item.materialId)}
                        className="ads-saas-btn ads-saas-btn-teal ads-saas-btn-sm"
                      >
                        <Play size={12} fill="currentColor" /> İzle
                      </button>
                    )}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {onPreviewMaterial && (
                      <button
                        type="button"
                        onClick={() => onPreviewMaterial(mat)}
                        className="ads-saas-btn ads-saas-btn-teal ads-saas-btn-sm"
                      >
                        <Play size={12} fill="currentColor" /> İzle
                      </button>
                    )}
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
