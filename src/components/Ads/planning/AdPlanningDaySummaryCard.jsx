/**
 * @file src/components/Ads/planning/AdPlanningDaySummaryCard.jsx
 * @description "Şu Anda Güncellenen Liste" Belirgin Kimlik Banner'ı, Aksiyon Butonları,
 * Kompakt KPI Göstergeleri ve Sade Görünüm Seçici Bar.
 *
 * Hangi kanalın, hangi günün ve hangi listenin (`Liste A` / `Liste B`) düzenlendiğini
 * ve revize durumunu operatöre tek bakışta net olarak gösterir.
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
  Sliders
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { dialog } from '../../../store/dialogStore';
import { formatSecToReadable } from './adPlanningConstants';

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
  onUpdateAutoFillSettings
}) => {
  const [showAutoFillSettings, setShowAutoFillSettings] = useState(false);

  if (!selectedDayInfo) return null;

  const minBreakFillSec = Number(adsAutoFillSettings?.minBreakFillSec ?? 120);
  const uniquenessRule = adsAutoFillSettings?.uniquenessRule || 'same_clip';
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
  const formattedDay = format(parseISO(selectedDayInfo.date), 'd MMMM yyyy, EEEE', { locale: tr });
  const isRevised =
    selectedDayInfo.day?.adsStatus === 'revised' || Boolean(selectedDayInfo.day?.isRevised);
  const revisionCount = Number(selectedDayInfo.day?.revisionCount) || (isRevised ? 1 : 0);
  const isCompleted = selectedDayInfo.day?.adsStatus === 'completed';

  return (
    <div
      className="ta-card"
      style={{
        padding: '18px 20px',
        gap: '14px',
        borderLeft: `6px solid ${
          isRevised ? '#d92d20' : isCompleted ? '#10b981' : isWay ? '#0d9488' : '#465fff'
        }`
      }}
    >
      {/* 1. SATIR: HANGİ KANAL, HANGİ GÜN, HANGİ LİSTE GÜNCELLENİYOR + ANA AKSİYONLAR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          flexWrap: 'wrap'
        }}
      >
        {/* Sol: Belirgin Aktif Çalışma Kimliği */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: '900',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--ads-text-muted)'
              }}
            >
              ŞU ANDA GÜNCELLENEN LİSTE:
            </span>

            {/* Kanal Rozeti */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 11px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '800',
                background: isWay ? 'rgba(13, 148, 136, 0.14)' : 'rgba(70, 95, 255, 0.14)',
                color: isWay ? '#0d9488' : '#465fff',
                border: `1px solid ${isWay ? 'rgba(13, 148, 136, 0.35)' : 'rgba(70, 95, 255, 0.35)'}`
              }}
            >
              {isWay ? <Radio size={13} /> : <Tv size={13} />}
              <span>{channelObj.name}</span>
            </span>

            {/* Liste A / B Rozeti */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 11px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '800',
                background: 'var(--ads-card-subtle)',
                color: 'var(--ads-text-main)',
                border: '1.5px solid var(--ads-border-strong)'
              }}
            >
              <Layers size={13} color="var(--ads-brand)" />
              <span>Liste {activeListCode}</span>
            </span>

            {/* Durum / Revize Rozeti */}
            {isRevised ? (
              <span
                className="ta-badge ta-badge-error"
                style={{ fontSize: '11.5px', padding: '4px 11px', fontWeight: '800' }}
              >
                <AlertTriangle size={13} />
                <span>REVİZE GELDİ {revisionCount > 0 ? `(Revize #${revisionCount})` : ''}</span>
              </span>
            ) : isCompleted ? (
              <span
                className="ta-badge ta-badge-success"
                style={{ fontSize: '11.5px', padding: '4px 11px', fontWeight: '800' }}
              >
                <CheckCircle size={13} />
                <span>Onaylandı &amp; Gönderildi</span>
              </span>
            ) : dayKpiSummary.totalSpots > 0 ? (
              <span
                className="ta-badge ta-badge-brand"
                style={{ fontSize: '11.5px', padding: '4px 11px', fontWeight: '800' }}
              >
                Aktif Planlama
              </span>
            ) : (
              <span
                className="ta-badge ta-badge-warning"
                style={{ fontSize: '11.5px', padding: '4px 11px', fontWeight: '800' }}
              >
                Planlama Bekliyor
              </span>
            )}
          </div>

          {/* Büyük Gün & Tarih Başlığı */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <Calendar size={20} color="var(--ads-brand)" />
            <h2
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '900',
                color: 'var(--ads-text-main)',
                letterSpacing: '-0.02em'
              }}
            >
              {formattedDay}
            </h2>
            {selectedDayInfo.date === todayStr && (
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: '900',
                  padding: '2px 9px',
                  borderRadius: '999px',
                  background: '#10b981',
                  color: '#ffffff'
                }}
              >
                BUGÜNÜN LİSTESİ
              </span>
            )}
          </div>
        </div>

        {/* Sağ: Doğrudan İşlem Butonları */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowAutoFillSettings(prev => !prev)}
            className="ads-saas-btn"
            style={{
              padding: '9px 13px',
              fontSize: '12px',
              fontWeight: '800',
              borderColor: showAutoFillSettings ? 'var(--ads-brand)' : 'var(--ads-border-strong)',
              background: showAutoFillSettings ? 'var(--ads-brand-soft)' : 'var(--ads-card-subtle)',
              color: showAutoFillSettings ? 'var(--ads-brand)' : 'var(--ads-text-main)'
            }}
            title="Otomatik Doldurma Algoritması Ayarları (En Az Kuşak Süresi, Tekillik Kuralı, Varyasyon, Max Spot Kilidi)"
          >
            <Sliders size={14} />
            <span>Otomatik Doldur Ayarları</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onRunAutoPlanDay(selectedDayInfo.channelId, selectedDayInfo.date, selectedDayInfo.key, true)
            }
            className="ads-saas-btn ads-saas-btn-primary"
            style={{ padding: '9px 15px', fontSize: '12.5px' }}
          >
            <Zap size={15} />
            <span>{isRevised ? 'Revize Listeyi Otomatik Doldur' : 'Günü Otomatik Planla'}</span>
          </button>

          {dayKpiSummary.totalSpots > 0 && (
            <button
              type="button"
              onClick={async () => {
                const ok = await dialog.confirm(
                  'Günün Reklam Planını Sıfırla',
                  `${channelObj.name} — ${formattedDay} (Liste ${activeListCode}) tarihli yayın akışındaki tüm reklam yerleşimlerini temizlemek istediğinize emin misiniz?\n` +
                    `Silinecek Spot: ${dayKpiSummary.totalSpots} Spot`,
                  { confirmText: 'Evet, Temizle', isDestructive: true }
                );
                if (ok) {
                  onResetAds(selectedDayInfo.channelId, selectedDayInfo.date);
                }
              }}
              className="ads-saas-btn ads-saas-btn-danger"
              style={{ padding: '9px 13px', fontSize: '12.5px' }}
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
                  `${channelObj.name} — ${formattedDay} (Liste ${activeListCode}) reklam planlamasını onaylayıp Liste Kontrol aşamasına göndermek istediğinize emin misiniz?\n` +
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
              style={{ padding: '9px 15px', fontSize: '12.5px' }}
            >
              <Send size={14} />
              <span>Onayla ve Gönder</span>
            </button>
          )}
        </div>
      </div>

      {/* 1B. OTOMATİK DOLDURMA ALGORİTMASI AYARLARI PANELİ */}
      {showAutoFillSettings && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '12px',
            background: 'var(--ads-card-subtle)',
            border: '1.5px solid var(--ads-brand)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Settings size={16} color="var(--ads-brand)" />
              <span style={{ fontSize: '13px', fontWeight: '900', color: 'var(--ads-text-main)' }}>
                Akıllı Otomatik Reklam Doldurma Algoritması Ayarları
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 9px',
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
              style={{ padding: '6px 12px', fontSize: '11.5px', fontWeight: '800' }}
            >
              <Zap size={13} /> Ayarları Uygula &amp; Şimdi Otomatik Doldur
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {/* 1. Kuşak En Az Doluluk Süresi */}
            <div
              style={{
                flex: '1 1 240px',
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'var(--ads-canvas-bg)',
                border: '1px solid var(--ads-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                  1. Kuşak En Az Doluluk Süresi (Taban)
                </span>
                <span style={{ fontSize: '11.5px', fontWeight: '900', color: 'var(--ads-brand)', fontFamily: 'monospace' }}>
                  {Math.floor(minBreakFillSec / 60)} dk {minBreakFillSec % 60 > 0 ? `${minBreakFillSec % 60} sn` : ''} ({minBreakFillSec} sn)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { sec: 60, label: '1 dk' },
                  { sec: 90, label: '1.5 dk' },
                  { sec: 120, label: '2 dk (Varsayılan)' },
                  { sec: 180, label: '3 dk' },
                  { sec: 240, label: '4 dk' }
                ].map(p => (
                  <button
                    key={p.sec}
                    type="button"
                    onClick={() => onUpdateAutoFillSettings && onUpdateAutoFillSettings({ minBreakFillSec: p.sec })}
                    className={`ads-saas-pill-btn ${minBreakFillSec === p.sec ? 'active' : ''}`}
                    style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '800' }}
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
                  style={{ width: '72px', padding: '4px 6px', fontSize: '11.5px', fontWeight: '800', textAlign: 'center' }}
                  title="Saniye cinsinden en az kuşak doluluk süresi"
                />
                <span style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>sn</span>
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)', lineHeight: 1.35 }}>
                Kuşak boş kalamaz; önce tüm kuşakları en az bu süreye (örn: 2 dk) ulaştırır, kota kalırsa kalan süreyi doldurur.
              </div>
            </div>

            {/* 2. Kuşak İçi Tekrar Kuralı (Aynı Klip / Aynı Firma / İkisi de Geçersiz) */}
            <div
              style={{
                flex: '1.3 1 300px',
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'var(--ads-canvas-bg)',
                border: '1px solid var(--ads-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <span style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                2. Kuşak İçi Tekrar Önleme Kuralı
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  {
                    id: 'same_clip',
                    label: 'Aynı Klip Giremez',
                    desc: 'Aynı reklam klibi bir kuşağa 2. kez giremez (farklı ürünü varsa araya başka firma girerek girebilir)'
                  },
                  {
                    id: 'same_company',
                    label: 'Aynı Firma Giremez (Klip de Giremez)',
                    desc: 'Aynı firmanın hiçbir reklamı aynı kuşağa ikinci kez giremez (kuşak başına firma tekilliği)'
                  },
                  {
                    id: 'none',
                    label: 'İkisi de Geçersiz',
                    desc: 'Tekrar kısıtlaması yok; gerekirse aynı firma veya klip girebilir'
                  }
                ].map(opt => {
                  const active = uniquenessRule === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateAutoFillSettings && onUpdateAutoFillSettings({ uniquenessRule: opt.id })}
                      style={{
                        flex: '1 1 130px',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border: active ? '1.5px solid var(--ads-brand)' : '1px solid var(--ads-border)',
                        background: active ? 'var(--ads-brand-soft)' : 'var(--ads-card-subtle)',
                        color: active ? 'var(--ads-brand)' : 'var(--ads-text-main)',
                        fontSize: '11.5px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                      title={opt.desc}
                    >
                      {active ? '✓ ' : ''}{opt.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)', lineHeight: 1.35 }}>
                Seçili Kural: <strong>{uniquenessLabel}</strong>
              </div>
            </div>

            {/* 3. Kuşak & Gün Varyasyonu ve Öncelik / Kota Kuralları */}
            <div
              style={{
                flex: '1 1 220px',
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'var(--ads-canvas-bg)',
                border: '1px solid var(--ads-border)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '6px'
              }}
            >
              <span style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                3. Kuşak &amp; Gün Dizilim Varyasyonu
              </span>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  color: 'var(--ads-text-main)',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={varyOrderAcrossBreaks}
                  onChange={e =>
                    onUpdateAutoFillSettings &&
                    onUpdateAutoFillSettings({ varyOrderAcrossBreaks: e.target.checked })
                  }
                  style={{ width: '15px', height: '15px', accentColor: 'var(--ads-brand)' }}
                />
                <Shuffle size={13} color="var(--ads-brand)" />
                <span>Her Kuşak ve Her Gün Farklı Dizilim</span>
              </label>
              <div style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)', lineHeight: 1.35 }}>
                Sponsor → Zorunlu (1000) → Yüksek (700) → Normal (400) → Dolgu (100) önceliğiyle, Min/Max spot kotasını aşmadan dağıtır.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. SATIR: KOMPAKT 4'LÜ GÜNLÜK ÖZET GÖSTERGE & GÖRÜNÜM SEÇİCİ */}
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
        {/* 4 Kompakt Özet Kutu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 12px',
              borderRadius: '10px',
              background: 'var(--ads-card-subtle)',
              border: '1px solid var(--ads-border)'
            }}
          >
            <Megaphone size={15} color="var(--ads-brand)" />
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: 'var(--ads-text-muted)', fontWeight: '600' }}>Dolu Kuşak: </span>
              <strong style={{ color: 'var(--ads-text-main)', fontWeight: '800' }}>
                {dayKpiSummary.filledBreaks} / {dayKpiSummary.totalBreaks}
              </strong>
            </div>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 12px',
              borderRadius: '10px',
              background: 'var(--ads-card-subtle)',
              border: '1px solid var(--ads-border)'
            }}
          >
            <Film size={15} color="#4f46e5" />
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: 'var(--ads-text-muted)', fontWeight: '600' }}>Toplam Spot: </span>
              <strong style={{ color: '#4f46e5', fontWeight: '800' }}>{dayKpiSummary.totalSpots} Adet</strong>
            </div>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 12px',
              borderRadius: '10px',
              background: 'var(--ads-card-subtle)',
              border: '1px solid var(--ads-border)'
            }}
          >
            <Clock size={15} color="#0d9488" />
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: 'var(--ads-text-muted)', fontWeight: '600' }}>Kuşak Süresi: </span>
              <strong style={{ color: '#0d9488', fontWeight: '800' }}>
                {formatSecToReadable(dayKpiSummary.totalFilledSec)} / {formatSecToReadable(dayKpiSummary.totalCapacitySec)} (%{dayKpiSummary.overallFillPct})
              </strong>
            </div>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 12px',
              borderRadius: '10px',
              background: 'var(--ads-card-subtle)',
              border: '1px solid var(--ads-border)'
            }}
          >
            <Award size={15} color="#9333ea" />
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: 'var(--ads-text-muted)', fontWeight: '600' }}>Günlük Min. Kota: </span>
              <strong style={{ color: '#9333ea', fontWeight: '800' }}>
                {dayKpiSummary.minTargetMetCount}/{dayKpiSummary.totalEligibleItems} (%{dayKpiSummary.quotaPct})
              </strong>
            </div>
          </div>
        </div>

        {/* Görünüm Seçici (Net ve Basit) */}
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
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              {v.icon}
              <span>{v.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdPlanningDaySummaryCard;
