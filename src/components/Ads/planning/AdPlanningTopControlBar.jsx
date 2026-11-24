/**
 * @file src/components/Ads/planning/AdPlanningTopControlBar.jsx
 * @description Günlük Yayın & Reklam Planlama Üst Kontrol Merkezi (`AdPlanningTopControlBar`) ve
 * Sol Gelen Yayın Listeleri & Revize Takip Paneli (`AdPlanningDaysSidebar`).
 *
 * Kullanıcı İsteklerine Göre Yenilenen Mimari:
 * 1. Haftalık tarih gösterimi kaldırılarak doğrudan **Günlük Tarih Seçimi** (Önceki Gün / Tarih Seçici / Sonraki Gün / Bugün) getirildi.
 * 2. **Kanal Seçimi** (`Semerkand HD` ve `Semerkand WAY`) büyük, renk kodlu ve belirgin kart butonlara dönüştürüldü.
 * 3. **Liste Seçim Yeri** (`Liste A - Ana Akış`, `Liste B - Alternatif` ve Kayıtlı/Gelen Liste Seçici) eklendi.
 * 4. Sol panelde **Revize Gelen Listeler**, **Bekleyen Listeler** ve **Günlük Yayın Listeleri** net filtrelerle takip edilir.
 */
import React, { useState } from 'react';
import {
  Tv,
  Radio,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Zap,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  FileCheck2,
  ArrowLeftToLine,
  PanelRightClose
} from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { formatSecToReadable } from './adPlanningConstants';

export const AdPlanningTopControlBar = ({
  channels = [],
  selectedChannel,
  onChannelSelect,
  selectedDate,
  todayStr,
  onSelectDate,
  onJumpToToday,
  activeListCode = 'A',
  onSelectListCode,
  listCounts = { A: { programs: 0, breaks: 0 }, B: { programs: 0, breaks: 0 } },
  allAvailableLists = [],
  onSelectFullListEntry,
  onSyncFromBroadcast,
  revisedListsCount = 0
}) => {
  const formattedSelectedDate = selectedDate
    ? format(parseISO(selectedDate), 'd MMMM yyyy, EEEE', { locale: tr })
    : '';

  const isToday = selectedDate === todayStr;

  const handleStepDay = (deltaDays) => {
    if (!selectedDate) return;
    const nextDateStr = format(addDays(parseISO(selectedDate), deltaDays), 'yyyy-MM-dd');
    onSelectDate(nextDateStr);
  };

  return (
    <div
      className="ta-card"
      style={{
        padding: '18px 22px',
        gap: '16px',
        border: '1px solid var(--ads-border-strong)'
      }}
    >
      {/* ÜST 3 ADIMLI KONTROL FLEX BAR: 1. KANAL -> 2. GÜNLÜK TARİH -> 3. LİSTE SEÇİMİ */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '14px',
          alignItems: 'stretch'
        }}
      >
        {/* ====================================================================
            1. KUTU: BELİRGİN KANAL SEÇİMİ (HANGİ KANAL?)
           ==================================================================== */}
        <div
          style={{
            flex: '1 1 280px',
            minWidth: 0,
            padding: '14px 16px',
            borderRadius: '14px',
            background: 'var(--ads-card-subtle)',
            border: '1px solid var(--ads-border)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '800',
                color: 'var(--ads-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}
            >
              1. Yayın Kanalı Seçimi
            </span>
            <span className="ta-badge ta-badge-brand" style={{ fontSize: '10.5px' }}>
              Aktif: {channels.find(c => String(c.id) === String(selectedChannel))?.name || 'Semerkand HD'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {channels.map(ch => {
              const isSelected = String(selectedChannel) === String(ch.id);
              const isWay = String(ch.id) === 'ch_way';
              const activeBg = isWay
                ? 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)'
                : 'linear-gradient(135deg, #465fff 0%, #3641f5 100%)';
              const activeShadow = isWay
                ? '0 6px 16px rgba(13, 148, 136, 0.28)'
                : '0 6px 16px rgba(70, 95, 255, 0.28)';

              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => onChannelSelect(ch.id)}
                  style={{
                    padding: '11px 14px',
                    borderRadius: '11px',
                    border: isSelected ? '2px solid transparent' : '1.5px solid var(--ads-border-strong)',
                    background: isSelected ? activeBg : 'var(--ads-card-bg)',
                    color: isSelected ? '#ffffff' : 'var(--ads-text-main)',
                    boxShadow: isSelected ? activeShadow : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    textAlign: 'left',
                    transition: 'all 0.16s ease'
                  }}
                >
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '9px',
                      background: isSelected ? 'rgba(255, 255, 255, 0.2)' : 'var(--ads-pill-bar-bg)',
                      color: isSelected ? '#ffffff' : isWay ? '#0d9488' : '#465fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {isWay ? <Radio size={18} /> : <Tv size={18} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: '800', lineHeight: 1.2 }}>
                      {ch.name}
                    </div>
                    <div
                      style={{
                        fontSize: '10.5px',
                        fontWeight: '600',
                        opacity: isSelected ? 0.9 : 0.65,
                        marginTop: '2px'
                      }}
                    >
                      {isSelected ? 'Seçili Kanal' : 'Kanala Geç'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ====================================================================
            2. KUTU: GÜNLÜK TARİH SEÇİMİ (HANGİ GÜN?)
           ==================================================================== */}
        <div
          style={{
            flex: '1.1 1 300px',
            minWidth: 0,
            padding: '14px 16px',
            borderRadius: '14px',
            background: 'var(--ads-card-subtle)',
            border: '1px solid var(--ads-border)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '800',
                color: 'var(--ads-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}
            >
              2. Günlük Yayın Tarihi Seçimi
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isToday ? (
                <span className="ta-badge ta-badge-success" style={{ fontSize: '10.5px' }}>
                  BUGÜN
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onJumpToToday}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    border: '1px solid rgba(70, 95, 255, 0.35)',
                    background: 'var(--ads-brand-soft)',
                    color: 'var(--ads-brand)',
                    fontSize: '10.5px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  Bugüne Dön
                </button>
              )}
            </div>
          </div>

          {/* Günlük Tarih Gezgini: Önceki Gün | Günlük Tarih Seçici | Sonraki Gün */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleStepDay(-1)}
              className="ads-saas-btn"
              style={{ padding: '9px 11px', flexShrink: 0 }}
              title="Önceki Gün (-1 Gün)"
            >
              <ChevronLeft size={16} />
              <span style={{ fontSize: '11.5px', fontWeight: '700' }}>Önceki Gün</span>
            </button>

            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '10px',
                background: 'var(--ads-card-bg)',
                border: '1.5px solid var(--ads-brand)',
                boxShadow: '0 2px 8px rgba(70, 95, 255, 0.1)'
              }}
            >
              <Calendar size={16} color="var(--ads-brand)" style={{ flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => e.target.value && onSelectDate(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    color: 'var(--ads-text-main)',
                    fontSize: '13.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'center'
                  }}
                />
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-brand)' }}>
                  {formattedSelectedDate}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleStepDay(1)}
              className="ads-saas-btn"
              style={{ padding: '9px 11px', flexShrink: 0 }}
              title="Sonraki Gün (+1 Gün)"
            >
              <span style={{ fontSize: '11.5px', fontWeight: '700' }}>Sonraki Gün</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* ====================================================================
            3. KUTU: LİSTE SEÇİM YERİ (LİSTE A / LİSTE B & GELEN LİSTELER)
           ==================================================================== */}
        <div
          style={{
            flex: '1 1 280px',
            minWidth: 0,
            padding: '14px 16px',
            borderRadius: '14px',
            background: 'var(--ads-card-subtle)',
            border: '1px solid var(--ads-border)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '800',
                color: 'var(--ads-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}
            >
              3. Yayın Listesi Seçimi (Liste A / B)
            </span>

            {onSyncFromBroadcast && (
              <button
                type="button"
                onClick={onSyncFromBroadcast}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 9px',
                  borderRadius: '999px',
                  border: '1px solid var(--ads-border-strong)',
                  background: 'var(--ads-card-bg)',
                  color: 'var(--ads-text-sub)',
                  fontSize: '10.5px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
                title="Yayın Planlama ekranındaki güncel akışı bu güne çek"
              >
                <RefreshCw size={11} />
                <span>Yayın Akışından Güncelle</span>
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {['A', 'B'].map(code => {
              const isSelected = activeListCode === code;
              const stats = listCounts[code] || { programs: 0, breaks: 0 };
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => onSelectListCode && onSelectListCode(code)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid var(--ads-brand)' : '1px solid var(--ads-border-strong)',
                    background: isSelected ? 'var(--ads-brand-soft)' : 'var(--ads-card-bg)',
                    color: isSelected ? 'var(--ads-brand)' : 'var(--ads-text-main)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Layers size={14} />
                      <span>Liste {code}</span>
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)', fontWeight: '600', marginTop: '1px' }}>
                      {stats.breaks} Kuşak • {stats.programs} Öğe
                    </div>
                  </div>
                  {isSelected && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 7px',
                        borderRadius: '999px',
                        background: 'var(--ads-brand)',
                        color: '#ffffff'
                      }}
                    >
                      Aktif
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Kayıtlı / Gelen Listelerden Hızlı Atlama Dropdown */}
          {allAvailableLists.length > 0 && (
            <select
              value={`${selectedChannel}__${selectedDate}__${activeListCode}`}
              onChange={e => {
                const [chId, dt, lCode] = e.target.value.split('__');
                if (chId && dt && onSelectFullListEntry) {
                  onSelectFullListEntry(chId, dt, lCode || 'A');
                }
              }}
              className="ads-saas-select"
              style={{ width: '100%', fontSize: '11.5px', padding: '5px 10px', height: '32px' }}
              title="Sistemdeki tüm gelen veya revize listeler arasından doğrudan seçin"
            >
              {allAvailableLists.map(entry => (
                <option key={entry.id} value={`${entry.channelId}__${entry.date}__${entry.listCode}`}>
                  {entry.statusBadgeText} — {entry.channelName} | {entry.formattedDate} | Liste {entry.listCode} ({entry.breaksCount} Kuşak)
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* EĞER SİSTEMDE REVİZE GELEN LİSTE VARSA ÜSTTE DİKKAT ÇEKİCİ UYARI ŞERİDİ */}
      {revisedListsCount > 0 && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '11px',
            background: 'var(--ads-error-soft)',
            border: '1.5px solid rgba(217, 45, 32, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} color="var(--ads-error-text)" />
            <div style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--ads-error-text)' }}>
              <strong>DİKKAT — Revize Gelen Yayın Listesi Var ({revisedListsCount} Adet):</strong>{' '}
              <span style={{ color: 'var(--ads-text-main)', fontWeight: '600' }}>
                Yayın Planlama veya Liste Kontrol tarafından güncellenip tekrar gönderilen revize listelere sol paneldeki{' '}
                <strong>&quot;Revize &amp; Bekleyen&quot;</strong> sekmesinden doğrudan ulaşabilirsiniz.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const AdPlanningDaysSidebar = ({
  allListEntries = [],
  todayStr,
  selectedDayKey,
  selectedChannel,
  selectedDate,
  activeListCode = 'A',
  onSelectFullListEntry,
  onRunAutoPlanDay,
  onWidenRightPanel,
  onCollapseRightPanel,
  isWidened = false
}) => {
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'revised_pending' | 'completed'

  const revisedOrPendingCount = allListEntries.filter(
    item => item.isRevised || item.adsStatus === 'pending' || (item.breaksCount > 0 && item.spotsCount === 0)
  ).length;

  const completedCount = allListEntries.filter(item => item.adsStatus === 'completed').length;

  const filteredEntries = allListEntries.filter(item => {
    if (filterMode === 'revised_pending') {
      return item.isRevised || item.adsStatus === 'pending' || (item.breaksCount > 0 && item.spotsCount === 0);
    }
    if (filterMode === 'completed') {
      return item.adsStatus === 'completed';
    }
    return true;
  });

  return (
    <div
      className="ta-card"
      style={{
        padding: '14px',
        gap: '12px',
        height: 'calc(100vh - 88px)',
        maxHeight: 'calc(100vh - 88px)',
        overflowY: 'auto'
      }}
    >
      {/* Sağ Panel Başlığı & Sola Genişlet / Daralt Kontrolleri */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileCheck2 size={16} color="var(--ads-brand)" />
            <span style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
              Yayın Listeleri ({filteredEntries.length})
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {onWidenRightPanel && (
              <button
                type="button"
                onClick={onWidenRightPanel}
                className="ads-saas-btn ads-saas-btn-sm"
                style={{
                  padding: '3px 7px',
                  fontSize: '10.5px',
                  fontWeight: '800',
                  background: isWidened ? 'var(--ads-brand-soft)' : 'var(--ads-card-subtle)',
                  color: isWidened ? 'var(--ads-brand)' : 'var(--ads-text-main)',
                  borderColor: isWidened ? 'var(--ads-brand)' : 'var(--ads-border)'
                }}
                title="Sağ Paneli Sola Doğru Genişlet / Normal Boyuta Döndür"
              >
                <ArrowLeftToLine size={12} />
                <span>{isWidened ? 'Daralt' : '⬅ Genişlet'}</span>
              </button>
            )}
            {onCollapseRightPanel && (
              <button
                type="button"
                onClick={onCollapseRightPanel}
                className="ads-saas-btn ads-saas-btn-sm"
                style={{ padding: '3px 6px', fontSize: '10.5px' }}
                title="Sağ Paneli Gizle (Orta Paneli Sağa Genişlet)"
              >
                <PanelRightClose size={13} />
              </button>
            )}
          </div>
        </div>

        {/* 3'lü Hızlı Filtre Sekmesi */}
        <div className="ads-saas-pill-group" style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1.25fr 1fr' }}>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`ads-saas-pill-btn ${filterMode === 'all' ? 'active' : ''}`}
            style={{ padding: '5px 6px', fontSize: '11px', justifyContent: 'center' }}
          >
            Tümü ({allListEntries.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('revised_pending')}
            className={`ads-saas-pill-btn ${filterMode === 'revised_pending' ? 'active' : ''}`}
            style={{
              padding: '5px 6px',
              fontSize: '11px',
              justifyContent: 'center',
              color: revisedOrPendingCount > 0 && filterMode !== 'revised_pending' ? 'var(--ads-error-text)' : undefined
            }}
          >
            Revize/Bekleyen ({revisedOrPendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('completed')}
            className={`ads-saas-pill-btn ${filterMode === 'completed' ? 'active' : ''}`}
            style={{ padding: '5px 6px', fontSize: '11px', justifyContent: 'center' }}
          >
            Onaylı ({completedCount})
          </button>
        </div>
      </div>

      {/* Liste Kartları */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredEntries.length === 0 ? (
          <div
            style={{
              padding: '24px 12px',
              textAlign: 'center',
              borderRadius: '10px',
              background: 'var(--ads-card-subtle)',
              border: '1px dashed var(--ads-border)',
              fontSize: '12px',
              color: 'var(--ads-text-muted)'
            }}
          >
            Bu filtrede gösterilecek yayın listesi bulunmuyor.
          </div>
        ) : (
          filteredEntries.map(entry => {
            const isSelected =
              String(entry.channelId) === String(selectedChannel) &&
              entry.date === selectedDate &&
              entry.listCode === activeListCode;
            const isToday = entry.date === todayStr;
            const isWay = String(entry.channelId) === 'ch_way';

            return (
              <div
                key={entry.id}
                onClick={() => onSelectFullListEntry(entry.channelId, entry.date, entry.listCode)}
                style={{
                  padding: '11px 12px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: isSelected
                    ? '2px solid var(--ads-brand)'
                    : entry.isRevised
                    ? '1.5px solid rgba(217, 45, 32, 0.5)'
                    : '1px solid var(--ads-border)',
                  background: isSelected
                    ? 'var(--ads-brand-soft)'
                    : entry.isRevised
                    ? 'var(--ads-error-soft)'
                    : 'var(--ads-card-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '7px',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* 1. Satır: Kanal + Liste A/B + Durum Rozeti */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 7px',
                        borderRadius: '6px',
                        background: isWay ? 'rgba(13, 148, 136, 0.15)' : 'rgba(70, 95, 255, 0.15)',
                        color: isWay ? '#0d9488' : '#465fff'
                      }}
                    >
                      {entry.channelName}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 7px',
                        borderRadius: '6px',
                        background: 'var(--ads-card-bg)',
                        border: '1px solid var(--ads-border)',
                        color: 'var(--ads-text-main)'
                      }}
                    >
                      Liste {entry.listCode}
                    </span>
                    {isToday && (
                      <span
                        style={{
                          fontSize: '9.5px',
                          fontWeight: '900',
                          padding: '1px 6px',
                          borderRadius: '999px',
                          background: '#10b981',
                          color: '#ffffff'
                        }}
                      >
                        BUGÜN
                      </span>
                    )}
                  </div>

                  {/* Durum Rozeti */}
                  {entry.isRevised ? (
                    <span className="ta-badge ta-badge-error" style={{ fontSize: '10px', padding: '2px 7px' }}>
                      REVİZE {entry.revisionCount > 0 ? `#${entry.revisionCount}` : ''}
                    </span>
                  ) : entry.adsStatus === 'completed' ? (
                    <span className="ta-badge ta-badge-success" style={{ fontSize: '10px', padding: '2px 7px' }}>
                      Onaylandı
                    </span>
                  ) : entry.spotsCount > 0 ? (
                    <span className="ta-badge ta-badge-brand" style={{ fontSize: '10px', padding: '2px 7px' }}>
                      Planlandı
                    </span>
                  ) : (
                    <span className="ta-badge ta-badge-warning" style={{ fontSize: '10px', padding: '2px 7px' }}>
                      Bekliyor
                    </span>
                  )}
                </div>

                {/* 2. Satır: Gün & Tarih Başlığı */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                    {entry.formattedDate}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-brand)' }}>
                    %{entry.fillRatio}
                  </span>
                </div>

                {/* 3. Satır: Kuşak & Spot Bilgisi + Doluluk Çubuğu */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--ads-text-muted)', fontWeight: '600' }}>
                    <span>
                      <strong>{entry.breaksCount}</strong> Kuşak • <strong>{entry.spotsCount}</strong> Spot
                    </span>
                    <span>{formatSecToReadable(entry.filledSec)}</span>
                  </div>
                  <div style={{ height: '5px', background: 'var(--ads-pill-bar-bg)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${entry.fillRatio}%`,
                        height: '100%',
                        background: entry.isRevised
                          ? '#d92d20'
                          : entry.adsStatus === 'completed'
                          ? '#10b981'
                          : 'var(--ads-brand)',
                        borderRadius: '999px'
                      }}
                    />
                  </div>
                </div>

                {/* Revize veya Hızlı Otomatik Doldur Butonu */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginTop: '2px' }}>
                  {entry.sentAtFormatted && (
                    <span style={{ fontSize: '10px', color: 'var(--ads-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={10} /> İletim: {entry.sentAtFormatted}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onSelectFullListEntry(entry.channelId, entry.date, entry.listCode);
                      onRunAutoPlanDay(entry.channelId, entry.date, entry.dayKey, true);
                    }}
                    className="ads-saas-btn ads-saas-btn-sm"
                    style={{
                      marginLeft: 'auto',
                      padding: '3px 8px',
                      fontSize: '10.5px',
                      color: entry.isRevised ? 'var(--ads-error-text)' : 'var(--ads-brand)'
                    }}
                  >
                    <Zap size={11} />
                    <span>{entry.isRevised ? 'Revizeyi Doldur' : 'Otomatik Doldur'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
