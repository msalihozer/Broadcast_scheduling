/**
 * @file src/components/Ads/planning/AdPlanningDaySummaryCard.jsx
 * @description Kurumsal Yayın & Reklam Planlama Üst Kimlik Kartı, 4'lü Dengeli KPI Göstergeleri,
 * Orta Panel Sağa/Sola Genişletme Kontrolleri ve Otomatik Doldurma Algoritması Ayarları.
 *
 * Kurumsal Revizyon Özellikleri:
 * - Kanal (`SEMERKAND HD` / `SEMERKAND WAY`), Gün/Tarih ve Liste (`LİSTE A` / `LİSTE B`) tek bir köşeye sıkıştırılmadan,
 *   3 parçalı dengeli Flex mimarisiyle büyük ve net tipografiyle (`'Plus Jakarta Sans', 'Inter', system-ui, sans-serif`) sunulur.
 * - Orta paneli hem sola hem sağa (veya tek tıkla tam genişliğe) genişletme butonları yer alır.
 * - Bir reklam klibine tıklandığında o klibin gün içinde kaç kuşakta ve hangi saatlerde yayınlandığını üst barda canlı gösterir.
 */
import React, { useState } from 'react';
import {
  Zap,
  RotateCcw,
  Send,
  CheckCircle,
  Megaphone,
  Film,
  Clock,
  Award,
  LayoutList,
  Layers,
  Table2,
  Tv,
  Radio,
  Calendar,
  AlertTriangle,
  Settings,
  ShieldCheck,
  Shuffle,
  Sliders,
  ArrowLeftToLine,
  ArrowRightToLine,
  Maximize2,
  Minimize2,
  Repeat,
  X
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { dialog } from '../../../store/dialogStore';
import { formatSecToReadable } from './adPlanningConstants';

const CORPORATE_FONT = "'Plus Jakarta Sans', 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif";

const AdPlanningDaySummaryCard = ({
  selectedDayInfo,
  todayStr,
  channels = [],
  activeListCode = 'A',
  dayKpiSummary,
  workspaceView,
  onChangeWorkspaceView,
  adBreaksCount = 0,
  timelineCount = 0,
  onRunAutoPlanDay,
  onResetAds,
  onCompleteAds,
  adsAutoFillSettings = {},
  onUpdateAutoFillSettings,
  isLeftPanelCollapsed = false,
  isRightPanelCollapsed = false,
  onToggleLeftPanel,
  onToggleRightPanel,
  onToggleFullCenter,
  highlightedClipInfo = null,
  onClearHighlightedClip
}) => {
  const [showAutoFillSettings, setShowAutoFillSettings] = useState(false);

  if (!selectedDayInfo) return null;

  const minBreakFillSec = Number(adsAutoFillSettings?.minBreakFillSec ?? 120);
  const uniquenessRule = adsAutoFillSettings?.uniquenessRule || 'same_clip';
  const parsedGap = Number(adsAutoFillSettings?.minBreakGap);
  const minBreakGap = [0, 1, 2, 3].includes(parsedGap) ? parsedGap : 1;
  const strictTimeBlocks = adsAutoFillSettings?.strictTimeBlocks !== false;
  const quotaStrategy = adsAutoFillSettings?.quotaStrategy || 'smart_pacing';
  const varyOrderAcrossBreaks = adsAutoFillSettings?.varyOrderAcrossBreaks !== false;

  const uniquenessLabel =
    uniquenessRule === 'same_company'
      ? 'Aynı Firma Giremez (Klip de Giremez)'
      : uniquenessRule === 'none'
      ? 'İkisi de Geçersiz (Serbest)'
      : 'Aynı Klip Bir Daha Giremez';

  const channelObj = channels.find(c => String(c.id) === String(selectedDayInfo.channelId)) || {
    id: selectedDayInfo.channelId,
    name: selectedDayInfo.channelId === 'ch_way' ? 'Semerkand WAY' : 'Semerkand HD'
  };
  const isWay = String(channelObj.id) === 'ch_way';
  const formattedDateMain = format(parseISO(selectedDayInfo.date), 'd MMMM yyyy', { locale: tr });
  const formattedDayName = format(parseISO(selectedDayInfo.date), 'EEEE', { locale: tr });
  const isRevised =
    selectedDayInfo.day?.adsStatus === 'revised' || Boolean(selectedDayInfo.day?.isRevised);
  const revisionCount = Number(selectedDayInfo.day?.revisionCount) || (isRevised ? 1 : 0);
  const isCompleted = selectedDayInfo.day?.adsStatus === 'completed';
  const isBothCollapsed = isLeftPanelCollapsed && isRightPanelCollapsed;

  const accentColor = isRevised
    ? '#dc2626'
    : isCompleted
    ? '#10b981'
    : isWay
    ? '#0d9488'
    : '#465fff';

  return (
    <div
      className="ta-card"
      style={{
        padding: '20px 22px',
        gap: '16px',
        fontFamily: CORPORATE_FONT,
        borderTop: `4px solid ${accentColor}`,
        boxShadow: '0 6px 22px -6px rgba(16, 24, 40, 0.1)'
      }}
    >
      {/* ======================================================================
          1. KATMAN: DENGELİ KURUMSAL KİMLİK BAŞLIĞI (KANAL + LİSTE | TARİH & DURUM | AKSİYONLAR)
         ====================================================================== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        {/* SOL BLOK: BELİRGİN KANAL VE LİSTE KİMLİĞİ */}
        <div
          style={{
            flex: '1 1 270px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '14px',
            background: isWay
              ? 'linear-gradient(135deg, rgba(13, 148, 136, 0.12) 0%, rgba(15, 118, 110, 0.04) 100%)'
              : 'linear-gradient(135deg, rgba(70, 95, 255, 0.12) 0%, rgba(54, 65, 245, 0.04) 100%)',
            border: `1.5px solid ${isWay ? 'rgba(13, 148, 136, 0.35)' : 'rgba(70, 95, 255, 0.35)'}`
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: isWay
                ? 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)'
                : 'linear-gradient(135deg, #465fff 0%, #3641f5 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isWay
                ? '0 6px 14px rgba(13, 148, 136, 0.3)'
                : '0 6px 14px rgba(70, 95, 255, 0.3)',
              flexShrink: 0
            }}
          >
            {isWay ? <Radio size={22} /> : <Tv size={22} />}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: '800',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--ads-text-muted)'
              }}
            >
              AKTİF KANAL &amp; YAYIN LİSTESİ
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '17px',
                  fontWeight: '900',
                  color: isWay ? '#0d9488' : '#465fff',
                  letterSpacing: '-0.02em'
                }}
              >
                {channelObj.name}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 11px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: '900',
                  background: activeListCode === 'B' ? '#7c3aed' : '#1e293b',
                  color: '#ffffff',
                  letterSpacing: '0.02em'
                }}
              >
                <Layers size={13} />
                <span>LİSTE {activeListCode}</span>
              </span>
            </div>
          </div>
        </div>

        {/* ORTA BLOK: BÜYÜK VE BELİRGİN GÜN / TARİH & DURUM KARTI */}
        <div
          style={{
            flex: '1.2 1 290px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px 18px',
            borderRadius: '14px',
            background: 'var(--ads-card-subtle)',
            border: '1.5px solid var(--ads-border-strong)',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '11px',
                background: 'var(--ads-brand-soft)',
                color: 'var(--ads-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Calendar size={22} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--ads-text-muted)'
                }}
              >
                YAYIN GÜNÜ &amp; TARİHİ
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '19px',
                    fontWeight: '900',
                    color: 'var(--ads-text-main)',
                    letterSpacing: '-0.02em'
                  }}
                >
                  {formattedDateMain}
                </span>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: '800',
                    color: 'var(--ads-brand)'
                  }}
                >
                  • {formattedDayName}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {selectedDayInfo.date === todayStr && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '900',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: '#10b981',
                  color: '#ffffff'
                }}
              >
                BUGÜN
              </span>
            )}

            {isRevised ? (
              <span
                className="ta-badge ta-badge-error"
                style={{ fontSize: '11.5px', padding: '5px 12px', fontWeight: '800' }}
              >
                <AlertTriangle size={13} />
                <span>REVİZE GELDİ {revisionCount > 0 ? `(#${revisionCount})` : ''}</span>
              </span>
            ) : isCompleted ? (
              <span
                className="ta-badge ta-badge-success"
                style={{ fontSize: '11.5px', padding: '5px 12px', fontWeight: '800' }}
              >
                <CheckCircle size={13} />
                <span>Onaylandı &amp; Gönderildi</span>
              </span>
            ) : dayKpiSummary.totalSpots > 0 ? (
              <span
                className="ta-badge ta-badge-brand"
                style={{ fontSize: '11.5px', padding: '5px 12px', fontWeight: '800' }}
              >
                ● Aktif Planlama
              </span>
            ) : (
              <span
                className="ta-badge ta-badge-warning"
                style={{ fontSize: '11.5px', padding: '5px 12px', fontWeight: '800' }}
              >
                Planlama Bekliyor
              </span>
            )}
          </div>
        </div>

        {/* SAĞ BLOK: ANA OPERASYON BUTONLARI */}
        <div
          style={{
            flex: '1 1 320px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
            flexWrap: 'wrap'
          }}
        >
          <button
            type="button"
            onClick={() => setShowAutoFillSettings(prev => !prev)}
            className="ads-saas-btn"
            style={{
              padding: '10px 14px',
              fontSize: '12px',
              fontWeight: '800',
              borderColor: showAutoFillSettings ? 'var(--ads-brand)' : 'var(--ads-border-strong)',
              background: showAutoFillSettings ? 'var(--ads-brand-soft)' : 'var(--ads-card-subtle)',
              color: showAutoFillSettings ? 'var(--ads-brand)' : 'var(--ads-text-main)'
            }}
            title="Otomatik Doldurma Algoritması Ayarları"
          >
            <Sliders size={14} />
            <span>Algoritma Ayarları</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onRunAutoPlanDay(selectedDayInfo.channelId, selectedDayInfo.date, selectedDayInfo.key, true)
            }
            className="ads-saas-btn ads-saas-btn-primary"
            style={{ padding: '10px 16px', fontSize: '12.5px', fontWeight: '800' }}
          >
            <Zap size={15} />
            <span>{isRevised ? 'Revizeyi Otomatik Doldur' : 'Günü Otomatik Planla'}</span>
          </button>

          {dayKpiSummary.totalSpots > 0 && (
            <button
              type="button"
              onClick={async () => {
                const ok = await dialog.confirm(
                  'Günün Reklam Planını Sıfırla',
                  `${channelObj.name} — ${formattedDateMain} ${formattedDayName} (Liste ${activeListCode}) tarihli yayın akışındaki tüm reklam yerleşimlerini temizlemek istediğinize emin misiniz?\n` +
                    `Silinecek Spot: ${dayKpiSummary.totalSpots} Spot`,
                  { confirmText: 'Evet, Temizle', isDestructive: true }
                );
                if (ok) {
                  onResetAds(selectedDayInfo.channelId, selectedDayInfo.date);
                }
              }}
              className="ads-saas-btn ads-saas-btn-danger"
              style={{ padding: '10px 13px', fontSize: '12px', fontWeight: '800' }}
            >
              <RotateCcw size={14} />
              <span>Sıfırla</span>
            </button>
          )}

          {dayKpiSummary.totalSpots > 0 && !isCompleted && (
            <button
              type="button"
              onClick={async () => {
                const ok = await dialog.confirm(
                  'Yayın Listesi Kontrol Onayı',
                  `${channelObj.name} — ${formattedDateMain} ${formattedDayName} (Liste ${activeListCode}) reklam planlamasını onaylayıp Liste Kontrol aşamasına göndermek istediğinize emin misiniz?\n` +
                    `Toplam Kuşak: ${dayKpiSummary.filledBreaks} / ${dayKpiSummary.totalBreaks} Kuşak\n` +
                    `Yerleştirilen Spot: ${dayKpiSummary.totalSpots} Reklam Spotu\n` +
                    `Toplam Reklam Süresi: ${formatSecToReadable(dayKpiSummary.totalFilledSec)}`,
                  { confirmText: 'Evet, Onayla ve Gönder' }
                );
                if (ok) {
                  onCompleteAds(selectedDayInfo.channelId, selectedDayInfo.date);
                }
              }}
              className="ads-saas-btn ads-saas-btn-success"
              style={{ padding: '10px 15px', fontSize: '12.5px', fontWeight: '800' }}
            >
              <Send size={14} />
              <span>Onayla ve Gönder</span>
            </button>
          )}
        </div>
      </div>

      {/* ======================================================================
          1B. OTOMATİK DOLDURMA ALGORİTMASI AYARLARI PANELİ (AÇILIR KUTU)
         ====================================================================== */}
      {showAutoFillSettings && (
        <div
          style={{
            padding: '16px 18px',
            borderRadius: '14px',
            background: 'var(--ads-card-subtle)',
            border: '1.5px solid var(--ads-brand)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Settings size={16} color="var(--ads-brand)" />
              <span style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--ads-text-main)' }}>
                6 Adımlı Akıllı Reklam Doldurma Algoritması Ayarları
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: '800',
                  background: 'rgba(16, 185, 129, 0.14)',
                  color: '#059669',
                  border: '1px solid rgba(16, 185, 129, 0.35)'
                }}
              >
                <ShieldCheck size={12} /> Max Spot Kilidi: Kesinlikle Aşılamaz
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                onRunAutoPlanDay(selectedDayInfo.channelId, selectedDayInfo.date, selectedDayInfo.key, true)
              }
              className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
              style={{ padding: '7px 14px', fontSize: '12px', fontWeight: '800' }}
            >
              <Zap size={13} /> Ayarları Uygula &amp; Şimdi Otomatik Planla
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {/* 1. Kuşak En Az Doluluk Süresi */}
            <div
              style={{
                flex: '1 1 240px',
                padding: '12px',
                borderRadius: '10px',
                background: 'var(--ads-canvas-bg)',
                border: '1px solid var(--ads-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                  1. Kuşak En Az Doluluk Süresi
                </span>
                <span style={{ fontSize: '12px', fontWeight: '900', color: 'var(--ads-brand)', fontFamily: 'monospace' }}>
                  {Math.floor(minBreakFillSec / 60)} dk {minBreakFillSec % 60 > 0 ? `${minBreakFillSec % 60} sn` : ''} ({minBreakFillSec} sn)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { sec: 60, label: '1 dk' },
                  { sec: 90, label: '1.5 dk' },
                  { sec: 120, label: '2 dk' },
                  { sec: 180, label: '3 dk' },
                  { sec: 240, label: '4 dk' }
                ].map(p => (
                  <button
                    key={p.sec}
                    type="button"
                    onClick={() => onUpdateAutoFillSettings && onUpdateAutoFillSettings({ minBreakFillSec: p.sec })}
                    className={`ads-saas-pill-btn ${minBreakFillSec === p.sec ? 'active' : ''}`}
                    style={{ padding: '4px 9px', fontSize: '11px', fontWeight: '800' }}
                  >
                    {p.label}
                  </button>
                ))}
                <input
                  type="number"
                  min={0}
                  max={600}
                  step={10}
                  value={minBreakFillSec}
                  onChange={e =>
                    onUpdateAutoFillSettings &&
                    onUpdateAutoFillSettings({ minBreakFillSec: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="ads-saas-input"
                  style={{ width: '70px', padding: '4px 6px', fontSize: '11.5px', fontWeight: '800', textAlign: 'center' }}
                />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)', lineHeight: 1.35 }}>
                Kuşakların taban doluluk hedefidir; akıllı ortalama hedef içinde öncelikli doldurulur.
              </div>
            </div>

            {/* 2. Kuşak İçi Tekrar Kuralı */}
            <div
              style={{
                flex: '1.2 1 280px',
                padding: '12px',
                borderRadius: '10px',
                background: 'var(--ads-canvas-bg)',
                border: '1px solid var(--ads-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                2. Kuşak İçi Tekrar Önleme Kuralı
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'same_clip', label: 'Aynı Klip Giremez' },
                  { id: 'same_company', label: 'Aynı Firma Giremez' },
                  { id: 'none', label: 'İkisi de Geçersiz' }
                ].map(opt => {
                  const active = uniquenessRule === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateAutoFillSettings && onUpdateAutoFillSettings({ uniquenessRule: opt.id })}
                      style={{
                        flex: '1 1 115px',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border: active ? '1.5px solid var(--ads-brand)' : '1px solid var(--ads-border)',
                        background: active ? 'var(--ads-brand-soft)' : 'var(--ads-card-subtle)',
                        color: active ? 'var(--ads-brand)' : 'var(--ads-text-main)',
                        fontSize: '11.5px',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      {active ? '✓ ' : ''}{opt.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>
                Aktif: <strong>{uniquenessLabel}</strong>
              </div>
            </div>

            {/* 3. Akıllı Ortalama Yayınlanma Sistemi */}
            <div
              style={{
                flex: '1.3 1 300px',
                padding: '12px',
                borderRadius: '10px',
                background: 'var(--ads-canvas-bg)',
                border: '1px solid var(--ads-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                3. Günlük Kota &amp; Akıllı Ortalama Sistemi
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'smart_pacing', label: 'Akıllı Ortalama (Varsayılan)' },
                  { id: 'min_plus_2min', label: 'Min Spot + 2 Dk Taban' },
                  { id: 'up_to_max', label: 'Max Spota Kadar' }
                ].map(opt => {
                  const active = quotaStrategy === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateAutoFillSettings && onUpdateAutoFillSettings({ quotaStrategy: opt.id })}
                      style={{
                        flex: '1 1 120px',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border: active ? '1.5px solid var(--ads-brand)' : '1px solid var(--ads-border)',
                        background: active ? 'var(--ads-brand-soft)' : 'var(--ads-card-subtle)',
                        color: active ? 'var(--ads-brand)' : 'var(--ads-text-main)',
                        fontSize: '11.5px',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      {active ? '✓ ' : ''}{opt.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)', lineHeight: 1.35 }}>
                Spot + Gün + Min/Max + Öncelik + Sponsorluk oranına göre Min ile Max arasında akıllı ortalama hedef belirler.
              </div>
            </div>

            {/* 4. Ardışık Kuşak Aralığı & Yayın Kuşağı Kuralları */}
            <div
              style={{
                flex: '1.2 1 280px',
                padding: '12px',
                borderRadius: '10px',
                background: 'var(--ads-canvas-bg)',
                border: '1px solid var(--ads-border)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                4. Ardışık Kuşak Aralığı &amp; Saat Dilimi
              </span>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {[
                  { gap: 1, label: 'En Az 1 Kuşak Ara Bırak' },
                  { gap: 2, label: 'En Az 2 Kuşak Ara' },
                  { gap: 0, label: 'Ardışık Serbest' }
                ].map(gOpt => {
                  const activeGap = minBreakGap === gOpt.gap;
                  return (
                    <button
                      key={gOpt.gap}
                      type="button"
                      onClick={() => onUpdateAutoFillSettings && onUpdateAutoFillSettings({ minBreakGap: gOpt.gap })}
                      style={{
                        flex: '1 1 85px',
                        padding: '5px 8px',
                        borderRadius: '7px',
                        border: activeGap ? '1.5px solid var(--ads-brand)' : '1px solid var(--ads-border)',
                        background: activeGap ? 'var(--ads-brand-soft)' : 'var(--ads-card-subtle)',
                        color: activeGap ? 'var(--ads-brand)' : 'var(--ads-text-main)',
                        fontSize: '10.5px',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      {activeGap ? '✓ ' : ''}{gOpt.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={strictTimeBlocks}
                    onChange={e => onUpdateAutoFillSettings && onUpdateAutoFillSettings({ strictTimeBlocks: e.target.checked })}
                    style={{ width: '15px', height: '15px', accentColor: 'var(--ads-brand)' }}
                  />
                  <span>Sadece Seçili Yayın Kuşağına Yerleştir</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={varyOrderAcrossBreaks}
                    onChange={e => onUpdateAutoFillSettings && onUpdateAutoFillSettings({ varyOrderAcrossBreaks: e.target.checked })}
                    style={{ width: '15px', height: '15px', accentColor: 'var(--ads-brand)' }}
                  />
                  <Shuffle size={13} color="var(--ads-brand)" />
                  <span>Kuşaklar Arası Farklı Dizilim</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          2. KATMAN: DENGELİ 4'LÜ KURUMSAL KPI GÖSTERGE KARTLARI (FLEX GRID)
         ====================================================================== */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        {/* KPI 1: Dolu Kuşak */}
        <div
          style={{
            flex: '1 1 180px',
            padding: '11px 14px',
            borderRadius: '12px',
            background: 'var(--ads-card-subtle)',
            border: '1px solid var(--ads-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(70, 95, 255, 0.12)',
              color: '#465fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Megaphone size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>
              Dolu Reklam Kuşağı
            </div>
            <div style={{ fontSize: '15.5px', fontWeight: '900', color: 'var(--ads-text-main)', marginTop: '1px' }}>
              {dayKpiSummary.filledBreaks} / {dayKpiSummary.totalBreaks} Kuşak
            </div>
          </div>
        </div>

        {/* KPI 2: Toplam Spot */}
        <div
          style={{
            flex: '1 1 180px',
            padding: '11px 14px',
            borderRadius: '12px',
            background: 'var(--ads-card-subtle)',
            border: '1px solid var(--ads-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(79, 70, 229, 0.12)',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Film size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>
              Yerleşen Toplam Spot
            </div>
            <div style={{ fontSize: '15.5px', fontWeight: '900', color: '#4f46e5', marginTop: '1px' }}>
              {dayKpiSummary.totalSpots} Spot{' '}
              <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>
                (Ort. {dayKpiSummary.avgSpotsPerBreak})
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Kuşak Süresi */}
        <div
          style={{
            flex: '1 1 210px',
            padding: '11px 14px',
            borderRadius: '12px',
            background: 'var(--ads-card-subtle)',
            border: '1px solid var(--ads-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(13, 148, 136, 0.12)',
              color: '#0d9488',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Clock size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>
              Toplam Kuşak Doluluğu
            </div>
            <div style={{ fontSize: '14.5px', fontWeight: '900', color: '#0d9488', marginTop: '1px' }}>
              {formatSecToReadable(dayKpiSummary.totalFilledSec)} / {formatSecToReadable(dayKpiSummary.totalCapacitySec)}{' '}
              <span style={{ fontSize: '12px', fontWeight: '800' }}>(%{dayKpiSummary.overallFillPct})</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Günlük Min Kota */}
        <div
          style={{
            flex: '1 1 180px',
            padding: '11px 14px',
            borderRadius: '12px',
            background: 'var(--ads-card-subtle)',
            border: '1px solid var(--ads-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(147, 51, 234, 0.12)',
              color: '#9333ea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Award size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>
              Günlük Min. Kota
            </div>
            <div style={{ fontSize: '15.5px', fontWeight: '900', color: '#9333ea', marginTop: '1px' }}>
              {dayKpiSummary.minTargetMetCount} / {dayKpiSummary.totalEligibleItems} (%{dayKpiSummary.quotaPct})
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================
          3. KATMAN: GÖRÜNÜM SEÇİCİ + TIKLANAN REKLAM EŞLEŞME BİLDİRİMİ + ORTA PANEL GENİŞLETME
         ====================================================================== */}
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
        {/* Sol: Görünüm Seçici */}
        <div className="ads-saas-pill-group">
          {[
            { id: 'breaks', label: `Reklam Kuşakları (${adBreaksCount})`, icon: <LayoutList size={14} /> },
            { id: 'flow', label: `Tam Yayın Akışı (${timelineCount} Öğe)`, icon: <Layers size={14} /> },
            { id: 'matrix', label: 'Özet Tablo', icon: <Table2 size={14} /> }
          ].map(v => (
            <button
              key={v.id}
              type="button"
              onClick={() => onChangeWorkspaceView(v.id)}
              className={`ads-saas-pill-btn ${workspaceView === v.id ? 'active' : ''}`}
              style={{ padding: '7px 14px', fontSize: '12.5px', fontWeight: '800' }}
            >
              {v.icon}
              <span>{v.label}</span>
            </button>
          ))}
        </div>

        {/* Orta: Tıklanan Reklam Klibinin Diğer Kuşaklardaki Eşleşme Durumu */}
        {highlightedClipInfo && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '999px',
              background: 'rgba(245, 158, 11, 0.14)',
              border: '1.5px solid #f59e0b',
              color: '#b45309',
              fontSize: '12px',
              fontWeight: '800'
            }}
          >
            <Repeat size={14} color="#d97706" />
            <span>
              Vurgulanan Klip: <strong>{highlightedClipInfo.title}</strong> ({highlightedClipInfo.count} Kuşakta:{' '}
              {highlightedClipInfo.breakTimes.join(', ')})
            </span>
            {onClearHighlightedClip && (
              <button
                type="button"
                onClick={onClearHighlightedClip}
                style={{
                  border: 'none',
                  background: 'rgba(217, 119, 6, 0.2)',
                  color: '#92400e',
                  borderRadius: '999px',
                  width: '20px',
                  height: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0
                }}
                title="Klip Vurgusunu Kaldır"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Sağ: Orta Paneli Sola / Sağa / Tam Ekran Genişletme Butonları */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {onToggleLeftPanel && (
            <button
              type="button"
              onClick={onToggleLeftPanel}
              className="ads-saas-btn ads-saas-btn-sm"
              style={{
                padding: '6px 11px',
                fontSize: '11.5px',
                fontWeight: '800',
                background: isLeftPanelCollapsed ? 'var(--ads-brand-soft)' : 'var(--ads-card-subtle)',
                borderColor: isLeftPanelCollapsed ? 'var(--ads-brand)' : 'var(--ads-border-strong)',
                color: isLeftPanelCollapsed ? 'var(--ads-brand)' : 'var(--ads-text-main)'
              }}
              title={isLeftPanelCollapsed ? 'Sol Spot Havuzu Panelini Aç' : 'Orta Paneli Sola Genişlet (Sol Paneli Daralt)'}
            >
              <ArrowLeftToLine size={13} />
              <span>{isLeftPanelCollapsed ? 'Sol Paneli Aç' : '⬅ Sola Genişlet'}</span>
            </button>
          )}

          {onToggleFullCenter && (
            <button
              type="button"
              onClick={onToggleFullCenter}
              className="ads-saas-btn ads-saas-btn-sm"
              style={{
                padding: '6px 11px',
                fontSize: '11.5px',
                fontWeight: '800',
                background: isBothCollapsed ? 'linear-gradient(135deg, #465fff, #7c3aed)' : 'var(--ads-card-subtle)',
                borderColor: isBothCollapsed ? '#465fff' : 'var(--ads-border-strong)',
                color: isBothCollapsed ? '#ffffff' : 'var(--ads-text-main)'
              }}
              title="Orta Paneli Hem Sola Hem Sağa Tam Genişlet / Yan Panelleri Geri Aç"
            >
              {isBothCollapsed ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              <span>{isBothCollapsed ? 'Yan Panelleri Aç' : '⬌ Tam Genişlik'}</span>
            </button>
          )}

          {onToggleRightPanel && (
            <button
              type="button"
              onClick={onToggleRightPanel}
              className="ads-saas-btn ads-saas-btn-sm"
              style={{
                padding: '6px 11px',
                fontSize: '11.5px',
                fontWeight: '800',
                background: isRightPanelCollapsed ? 'var(--ads-brand-soft)' : 'var(--ads-card-subtle)',
                borderColor: isRightPanelCollapsed ? 'var(--ads-brand)' : 'var(--ads-border-strong)',
                color: isRightPanelCollapsed ? 'var(--ads-brand)' : 'var(--ads-text-main)'
              }}
              title={isRightPanelCollapsed ? 'Sağ Yayın Listeleri Panelini Aç' : 'Orta Paneli Sağa Genişlet (Sağ Paneli Daralt)'}
            >
              <span>{isRightPanelCollapsed ? 'Sağ Paneli Aç' : 'Sağa Genişlet ➡'}</span>
              <ArrowRightToLine size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdPlanningDaySummaryCard;
