/**
 * @file src/components/Ads/planning/AdPlanningWorkspaceViews.jsx
 * @description Reklam Kuşak Planlama Çalışma Alanı Görünümleri (`AdBreaksListView`, `AdBroadcastFlowView`, `AdHourlyMatrixView`),
 * Sol Sabit Hızlı Spot Havuzu (`AdQuickSpotPoolPanel`) ve Hızlı Manuel Spot Ekleme Modalı (`AdManualSpotModal`).
 *
 * Özellikler:
 * 1. Hem "Reklam Kuşakları" hem de "Tam Yayın Akışı" görünümlerinde reklamlar düzenli, tam genişlikli sıralı liste olarak gösterilir.
 * 2. Seçili reklamın ÜSTÜNE (↑ Üstüne Ekle) veya ALTINA (↓ Altına Ekle) tek tıkla reklam ekleme desteği.
 * 3. Sürükle-Bırak (Drag & Drop):
 *    - Kuşak içindeki reklamları sürükleyip bırakarak sıralarını değiştirme.
 *    - Sol paneldeki reklam havuzundan (Rezervasyon / Tüm Katalog) sürükleyip kuşak içine veya herhangi bir reklamın tam üstüne/altına bırakarak ekleme.
 * 4. Tüm reklamlarda "ⓘ" (Bilgi, Firma, 25/30/50 FPS Kare Analizi ve İleri-Geri Sarılabilir Video Önizleme) butonu.
 * 5. Sponsor Reklamları ve Sponsorlu Programlar için Mor / Altın (Purple & Gold) renklendirme.
 */
import React, { useState } from 'react';
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
  Award,
  Info,
  GripVertical,
  CornerLeftUp,
  CornerLeftDown
} from 'lucide-react';
import { PRIORITY_BADGES } from './adPlanningConstants';
import useThemeStore, { hexToRgba } from '../../../store/themeStore';

const resolveAdSponsorInfo = (ad, resObj, brk = null) => {
  if (ad?.isBumperAd) {
    return {
      isSponsor: false,
      isBumper: true,
      bumperType: ad.bumperType || 'intro',
      bumperCategoryName: ad.bumperCategoryName || brk?.prevProgramCategoryName || 'Dini',
      programTitle: ad.bumperSourceProgram || brk?.prevProgramTitle || '',
      roleLabel:
        ad.bumperType === 'outro'
          ? 'RTÜK Reklam Çıkış (Son Sıra Kilitli)'
          : 'RTÜK Reklam Giriş (İlk Sıra Kilitli)'
    };
  }
  const matchedItem = Array.isArray(resObj?.items)
    ? resObj.items.find(it => String(it.materialId) === String(ad.materialId))
    : null;
  const isSponsor = Boolean(
    ad.isSponsorSpot ||
      ad.lockOrder === 'first' ||
      ad.lockOrder === 'last' ||
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
    isBumper: false,
    programTitle,
    roleLabel
  };
};

/**
 * Hem "Reklam Kuşakları" hem de "Tam Yayın Akışı" görünümlerinde ortak kullanılan:
 * - Düzenli Sıralı Reklam Listesi
 * - Tıklayarak Seçme & Seçilinin Üstüne / Altına Ekleme Hedefi
 * - Kuşak İçi Sürükle-Bırak ile Sıra Değiştirme
 * - Sol Panelden Sürükle-Bırak ile İstediğin Sıranın Üstüne / Altına Ekleme
 */
const AdBreakInteractiveSpotsList = ({
  brk,
  selectedDayInfo,
  companies = [],
  products = [],
  materials = [],
  reservations = [],
  selectedAdTarget,
  onSelectAdTarget,
  insertPositionMode = 'below',
  onChangeInsertPositionMode,
  onSelectStudioBreakTime,
  onOpenQuickModalBreak,
  onMoveAdInBreak,
  onReorderAdInBreak,
  onRemoveAdFromBreak,
  onPreviewMaterial,
  onQuickAddSpotToBreak
}) => {
  const [dragOverState, setDragOverState] = useState(null); // { adIndex: number, position: 'above' | 'below' } | { emptyBreak: true }

  const isBreakSelectedForAd =
    selectedAdTarget && selectedAdTarget.breakTime === brk.shortTime;

  const handleRowDragStart = (e, adIdx, ad, mat) => {
    e.stopPropagation();
    const payload = {
      dragType: 'break-ad-reorder',
      breakTime: brk.shortTime,
      fromIndex: adIdx,
      materialId: ad.materialId,
      title: mat?.name || 'Spot'
    };
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleRowDragOver = (e, adIdx) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const position = offsetY < rect.height / 2 ? 'above' : 'below';
    if (
      !dragOverState ||
      dragOverState.adIndex !== adIdx ||
      dragOverState.position !== position
    ) {
      setDragOverState({ adIndex: adIdx, position });
    }
  };

  const handleRowDrop = (e, adIdx) => {
    e.preventDefault();
    e.stopPropagation();
    const dropPos = dragOverState?.position || 'below';
    setDragOverState(null);

    let rawData = '';
    try {
      rawData = e.dataTransfer.getData('application/json');
    } catch (_) {}
    if (!rawData) return;

    try {
      const parsed = JSON.parse(rawData);
      const targetIndex = dropPos === 'above' ? adIdx : adIdx + 1;

      // 1. Kuşak içi sürükle-bırak ile sıra değiştirme
      if (parsed.dragType === 'break-ad-reorder') {
        if (parsed.breakTime === brk.shortTime && typeof parsed.fromIndex === 'number') {
          let adjustedTarget = targetIndex;
          if (parsed.fromIndex < targetIndex) {
            adjustedTarget = Math.max(0, targetIndex - 1);
          }
          if (adjustedTarget !== parsed.fromIndex && onReorderAdInBreak) {
            onReorderAdInBreak(
              selectedDayInfo.channelId,
              selectedDayInfo.date,
              brk.shortTime,
              parsed.fromIndex,
              adjustedTarget
            );
          }
          if (onSelectAdTarget) {
            onSelectAdTarget({
              breakTime: brk.shortTime,
              adIndex: adjustedTarget,
              adTitle: parsed.title || 'Spot'
            });
          }
        }
        return;
      }

      // 2. Sol panelden (havuzdan) sürükle-bırak ile seçili sıranın üstüne/altına ekleme
      if (parsed.dragType === 'pool-ad-insert' && onQuickAddSpotToBreak) {
        if (onSelectStudioBreakTime) onSelectStudioBreakTime(brk.shortTime);
        onQuickAddSpotToBreak(brk, {
          reservationId: parsed.reservationId,
          materialId: parsed.materialId,
          companyId: parsed.companyId,
          productId: parsed.productId,
          durationSec: parsed.durationSec,
          insertAtIndex: targetIndex
        });
      }
    } catch (_) {}
  };

  const handleEmptyBreakDragOver = e => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragOverState?.emptyBreak) {
      setDragOverState({ emptyBreak: true });
    }
  };

  const handleEmptyBreakDrop = e => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverState(null);

    let rawData = '';
    try {
      rawData = e.dataTransfer.getData('application/json');
    } catch (_) {}
    if (!rawData) return;

    try {
      const parsed = JSON.parse(rawData);
      if (parsed.dragType === 'pool-ad-insert' && onQuickAddSpotToBreak) {
        if (onSelectStudioBreakTime) onSelectStudioBreakTime(brk.shortTime);
        onQuickAddSpotToBreak(brk, {
          reservationId: parsed.reservationId,
          materialId: parsed.materialId,
          companyId: parsed.companyId,
          productId: parsed.productId,
          durationSec: parsed.durationSec,
          insertAtIndex: brk.placedAds.length
        });
      }
    } catch (_) {}
  };

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}
      onClick={e => e.stopPropagation()}
      onDragLeave={e => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setDragOverState(null);
        }
      }}
    >
      {/* Seçili Reklam Varsa Üstte Belirgin "Üstüne / Altına Ekleme" Kontrol Şeridi */}
      {isBreakSelectedForAd && (
        <div
          style={{
            padding: '7px 12px',
            borderRadius: '9px',
            background: 'linear-gradient(90deg, rgba(2, 132, 199, 0.14) 0%, rgba(37, 99, 235, 0.08) 100%)',
            border: '1.5px solid rgba(2, 132, 199, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', fontWeight: '800', color: '#0369a1' }}>
            <Target size={14} color="#0284c7" />
            <span>
              Seçili Reklam: <strong>#{selectedAdTarget.adIndex + 1} {selectedAdTarget.adTitle}</strong>
            </span>
            <span style={{ color: 'var(--ads-text-muted)', fontWeight: '600' }}>
              (Sol panelden eklenecek reklamın konumu:)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onChangeInsertPositionMode && onChangeInsertPositionMode('above')}
              style={{
                padding: '3px 9px',
                borderRadius: '6px',
                border: insertPositionMode === 'above' ? '1.5px solid #0284c7' : '1px solid var(--ads-border)',
                background: insertPositionMode === 'above' ? '#0284c7' : 'var(--ads-card-bg)',
                color: insertPositionMode === 'above' ? '#ffffff' : 'var(--ads-text-main)',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <CornerLeftUp size={12} /> ↑ Seçilinin Üstüne Ekle (#{selectedAdTarget.adIndex + 1})
            </button>

            <button
              type="button"
              onClick={() => onChangeInsertPositionMode && onChangeInsertPositionMode('below')}
              style={{
                padding: '3px 9px',
                borderRadius: '6px',
                border: insertPositionMode === 'below' ? '1.5px solid #0284c7' : '1px solid var(--ads-border)',
                background: insertPositionMode === 'below' ? '#0284c7' : 'var(--ads-card-bg)',
                color: insertPositionMode === 'below' ? '#ffffff' : 'var(--ads-text-main)',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <CornerLeftDown size={12} /> ↓ Seçilinin Altına Ekle (#{selectedAdTarget.adIndex + 2})
            </button>

            <button
              type="button"
              onClick={() => onChangeInsertPositionMode && onChangeInsertPositionMode('end')}
              style={{
                padding: '3px 9px',
                borderRadius: '6px',
                border: insertPositionMode === 'end' ? '1.5px solid #0284c7' : '1px solid var(--ads-border)',
                background: insertPositionMode === 'end' ? '#0284c7' : 'var(--ads-card-bg)',
                color: insertPositionMode === 'end' ? '#ffffff' : 'var(--ads-text-main)',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              Kuşak Sonuna
            </button>

            <button
              type="button"
              onClick={() => onSelectAdTarget && onSelectAdTarget(null)}
              style={{
                padding: '3px 7px',
                borderRadius: '6px',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                fontSize: '10.5px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
              title="Seçimi Kaldır"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {brk.placedAds.length === 0 ? (
        <div
          onDragOver={handleEmptyBreakDragOver}
          onDrop={handleEmptyBreakDrop}
          onClick={e => {
            e.stopPropagation();
            if (onSelectStudioBreakTime) onSelectStudioBreakTime(brk.shortTime);
            onOpenQuickModalBreak(brk);
          }}
          style={{
            padding: '16px',
            borderRadius: '10px',
            border: dragOverState?.emptyBreak
              ? '2px dashed #2563eb'
              : '1.5px dashed var(--ads-border-strong)',
            background: dragOverState?.emptyBreak
              ? 'rgba(37, 99, 235, 0.1)'
              : 'var(--ads-card-subtle)',
            textAlign: 'center',
            color: dragOverState?.emptyBreak ? '#2563eb' : 'var(--ads-text-muted)',
            fontSize: '12px',
            fontWeight: dragOverState?.emptyBreak ? '800' : '600',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {dragOverState?.emptyBreak
            ? '📥 Reklamı Bu Kuşağa Eklemek İçin Bırakın!'
            : 'Bu kuşak boş. Sol paneldeki havuzdan reklam sürükleyip bırakabilir, "+ Ekle" butonuna basabilir veya buraya tıklayabilirsiniz.'}
        </div>
      ) : (
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
          onDragOver={e => e.preventDefault()}
        >
          {brk.placedAds.map((ad, adIdx) => {
            const comp = companies.find(c => String(c.id) === String(ad.companyId));
            const prod = products.find(p => String(p.id) === String(ad.productId));
            const mat = materials.find(m => String(m.id) === String(ad.materialId));
            const resObj = reservations.find(r => String(r.id) === String(ad.reservationId));
            const prioBadge = PRIORITY_BADGES[resObj?.priority] || null;
            const spInfo = resolveAdSponsorInfo(ad, resObj, brk);

            const isRowSelected =
              isBreakSelectedForAd && selectedAdTarget.adIndex === adIdx;

            const isDropAbove =
              dragOverState &&
              dragOverState.adIndex === adIdx &&
              dragOverState.position === 'above';
            const isDropBelow =
              dragOverState &&
              dragOverState.adIndex === adIdx &&
              dragOverState.position === 'below';

            const isIntroBumper = Boolean(spInfo.isBumper && spInfo.bumperType === 'intro');
            const isOutroBumper = Boolean(spInfo.isBumper && spInfo.bumperType === 'outro');
            const matDisplayName = ad.name || ad.clipName || mat?.name || 'Reklam Spotu';

            return (
              <div
                key={`${ad.materialId}-${adIdx}`}
                style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}
              >
                {/* Sürükle-Bırak Üstüne Ekle/Taşı Çizgisi */}
                {isDropAbove && (
                  <div
                    style={{
                      padding: '3px 10px',
                      marginBottom: '3px',
                      borderRadius: '6px',
                      background: 'linear-gradient(90deg, #2563eb, #0284c7)',
                      color: '#ffffff',
                      fontSize: '10.5px',
                      fontWeight: '900',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)'
                    }}
                  >
                    ↑ #{adIdx + 1}. Sıraya Bırak ({matDisplayName} Üstüne)
                  </div>
                )}

                <div
                  draggable={!spInfo.isBumper}
                  onDragStart={e => !spInfo.isBumper && handleRowDragStart(e, adIdx, ad, mat)}
                  onDragOver={e => handleRowDragOver(e, adIdx)}
                  onDrop={e => handleRowDrop(e, adIdx)}
                  onClick={e => {
                    e.stopPropagation();
                    if (onSelectStudioBreakTime) onSelectStudioBreakTime(brk.shortTime);
                    if (onSelectAdTarget) {
                      if (isRowSelected) {
                        onSelectAdTarget(null);
                      } else {
                        onSelectAdTarget({
                          breakTime: brk.shortTime,
                          adIndex: adIdx,
                          adTitle: matDisplayName
                        });
                      }
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '8px 11px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: isRowSelected
                      ? 'linear-gradient(90deg, rgba(2, 132, 199, 0.16) 0%, rgba(37, 99, 235, 0.08) 100%)'
                      : isIntroBumper
                      ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.18) 0%, rgba(13, 148, 136, 0.06) 100%)'
                      : isOutroBumper
                      ? 'linear-gradient(90deg, rgba(217, 119, 6, 0.18) 0%, rgba(245, 158, 11, 0.06) 100%)'
                      : spInfo.isSponsor
                      ? 'linear-gradient(90deg, rgba(147, 51, 234, 0.16) 0%, rgba(217, 119, 6, 0.08) 100%)'
                      : 'var(--ads-card-subtle)',
                    border: isRowSelected
                      ? '2px solid #0284c7'
                      : isIntroBumper
                      ? '1.5px solid #059669'
                      : isOutroBumper
                      ? '1.5px solid #d97706'
                      : spInfo.isSponsor
                      ? '1.5px solid #9333ea'
                      : '1px solid var(--ads-border)',
                    borderLeft: isRowSelected
                      ? '6px solid #0284c7'
                      : isIntroBumper
                      ? '6px solid #059669'
                      : isOutroBumper
                      ? '6px solid #d97706'
                      : spInfo.isSponsor
                      ? '5px solid #9333ea'
                      : '3px solid var(--ads-border-strong)',
                    boxShadow: isRowSelected
                      ? '0 4px 12px rgba(2, 132, 199, 0.2)'
                      : undefined,
                    transition: 'all 0.12s ease'
                  }}
                  title={
                    spInfo.isBumper
                      ? 'RTÜK Zorunlu Reklam Giriş / Çıkış Jeneriği (En Başta ve En Sonda Kilitli)'
                      : 'Seçmek (üstüne/altına reklam eklemek) için tıklayın veya sürükleyip sırasını değiştirin'
                  }
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    {/* Sürükle-Bırak Tutamacı */}
                    <span
                      style={{
                        color: spInfo.isBumper ? (isIntroBumper ? '#059669' : '#d97706') : 'var(--ads-text-muted)',
                        cursor: spInfo.isBumper ? 'default' : 'grab',
                        display: 'inline-flex',
                        alignItems: 'center',
                        flexShrink: 0
                      }}
                      title={spInfo.isBumper ? 'RTÜK Kilitli Sıra' : 'Sürükleyerek sırasını değiştirin'}
                    >
                      <GripVertical size={15} />
                    </span>

                    {/* Sıra Numarası */}
                    <span
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        background: isRowSelected
                          ? '#0284c7'
                          : isIntroBumper
                          ? 'linear-gradient(135deg, #059669, #047857)'
                          : isOutroBumper
                          ? 'linear-gradient(135deg, #d97706, #b45309)'
                          : spInfo.isSponsor
                          ? 'linear-gradient(135deg, #9333ea, #7e22ce)'
                          : 'var(--ads-pill-bar-bg)',
                        color:
                          isRowSelected || spInfo.isBumper || spInfo.isSponsor
                            ? '#ffffff'
                            : 'var(--ads-text-main)',
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

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '12.5px',
                            fontWeight: '800',
                            fontFamily: spInfo.isBumper ? 'monospace' : 'inherit',
                            color: isRowSelected
                              ? '#0369a1'
                              : isIntroBumper
                              ? '#047857'
                              : isOutroBumper
                              ? '#b45309'
                              : spInfo.isSponsor
                              ? '#7e22ce'
                              : 'var(--ads-text-main)'
                          }}
                        >
                          {matDisplayName}
                        </span>

                        {isIntroBumper && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: '900',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: 'linear-gradient(135deg, #059669, #047857)',
                              color: '#ffffff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            🟢 RTÜK REKLAM GİRİŞ (1. SIRA KİLİTLİ) • Kategori: {spInfo.bumperCategoryName}
                          </span>
                        )}

                        {isOutroBumper && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: '900',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: 'linear-gradient(135deg, #d97706, #b45309)',
                              color: '#ffffff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            🟠 RTÜK REKLAM ÇIKIŞ (SON SIRA KİLİTLİ) • Kategori: {spInfo.bumperCategoryName}
                          </span>
                        )}

                        {isRowSelected && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: '900',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: '#0284c7',
                              color: '#ffffff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            🎯 SEÇİLİ ({insertPositionMode === 'above' ? '↑ Üstüne Eklenecek' : insertPositionMode === 'below' ? '↓ Altına Eklenecek' : 'Sona'})
                          </span>
                        )}

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

                        {prioBadge && !spInfo.isBumper && (
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
                        {spInfo.isBumper ? (
                          <span>
                            <strong>{ad.companyName || 'RTÜK REKLAM JENERİĞİ'}</strong> •{' '}
                            {ad.productName || `Önceki Program: ${brk.prevProgramTitle || 'Genel'}`} •{' '}
                            <span style={{ fontFamily: 'monospace' }}>{ad.code || ''}</span>
                          </span>
                        ) : (
                          <span>
                            <strong>{comp?.name || mat?.companyName || ad.companyName || 'Firma'}</strong> •{' '}
                            {prod?.name || mat?.productName || ad.productName || 'Ürün'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sağ Aksiyon Butonları: ⓘ Detay/Önizleme, Süre, ↑ Yukarı, ↓ Aşağı, 🗑 Sil */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}
                    onClick={e => e.stopPropagation()}
                  >
                    {onPreviewMaterial && (mat || ad.materialId || ad.clipId) && (
                      <button
                        type="button"
                        onClick={() =>
                          onPreviewMaterial({
                            ...(mat || {}),
                            ...ad,
                            id: ad.clipId || ad.materialId || mat?.id,
                            clipId: ad.clipId || mat?.clipId || ad.materialId,
                            name: matDisplayName,
                            clipName: ad.clipName || mat?.clipName || matDisplayName,
                            code: ad.code || mat?.code,
                            materialId: ad.materialId || mat?.id,
                            companyId: ad.companyId || mat?.companyId,
                            companyName: ad.companyName || comp?.name || mat?.companyName,
                            productId: ad.productId || mat?.productId,
                            productName: ad.productName || prod?.name || mat?.productName,
                            reservationId: ad.reservationId,
                            isSponsor: spInfo.isSponsor,
                            sponsorProgramTitle: spInfo.programTitle,
                            sponsorTag: spInfo.roleLabel,
                            breakTime: brk.shortTime,
                            breakName: brk.title,
                            orderInBreak: adIdx + 1,
                            prevProgramTitle: brk.prevProgramTitle,
                            nextProgramTitle: brk.nextProgramTitle
                          })
                        }
                        className="ads-saas-btn ads-saas-btn-sm"
                        style={{
                          width: '28px',
                          height: '28px',
                          padding: 0,
                          borderRadius: '8px',
                          background: 'rgba(37, 99, 235, 0.12)',
                          border: '1px solid rgba(37, 99, 235, 0.35)',
                          color: '#2563eb',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Reklam Detayları, Firma, Kare (25/30/50 FPS) ve Video Önizleme (ⓘ)"
                      >
                        <Info size={14} />
                      </button>
                    )}

                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '11.5px',
                        fontWeight: '800',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: isIntroBumper
                          ? 'rgba(16, 185, 129, 0.16)'
                          : isOutroBumper
                          ? 'rgba(217, 119, 6, 0.16)'
                          : 'rgba(13, 148, 136, 0.12)',
                        color: isIntroBumper ? '#059669' : isOutroBumper ? '#d97706' : '#0d9488'
                      }}
                    >
                      {ad.duration} sn
                    </span>

                    {onMoveAdInBreak && !spInfo.isBumper && (
                      <>
                        <button
                          type="button"
                          disabled={adIdx === 0 || (adIdx === 1 && brk.placedAds[0]?.isBumperAd)}
                          onClick={() =>
                            onMoveAdInBreak(selectedDayInfo.channelId, selectedDayInfo.date, brk.shortTime, adIdx, -1)
                          }
                          className="ads-saas-btn ads-saas-btn-sm"
                          style={{
                            padding: '4px 6px',
                            opacity: adIdx === 0 || (adIdx === 1 && brk.placedAds[0]?.isBumperAd) ? 0.35 : 1
                          }}
                          title="Yukarı Taşı (↑)"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          disabled={
                            adIdx === brk.placedAds.length - 1 ||
                            (adIdx === brk.placedAds.length - 2 &&
                              brk.placedAds[brk.placedAds.length - 1]?.isBumperAd)
                          }
                          onClick={() =>
                            onMoveAdInBreak(selectedDayInfo.channelId, selectedDayInfo.date, brk.shortTime, adIdx, 1)
                          }
                          className="ads-saas-btn ads-saas-btn-sm"
                          style={{
                            padding: '4px 6px',
                            opacity:
                              adIdx === brk.placedAds.length - 1 ||
                              (adIdx === brk.placedAds.length - 2 &&
                                brk.placedAds[brk.placedAds.length - 1]?.isBumperAd)
                                ? 0.35
                                : 1
                          }}
                          title="Aşağı Taşı (↓)"
                        >
                          <ArrowDown size={12} />
                        </button>
                      </>
                    )}

                    {onRemoveAdFromBreak && (
                      <button
                        type="button"
                        onClick={() =>
                          onRemoveAdFromBreak(selectedDayInfo.channelId, selectedDayInfo.date, brk.shortTime, adIdx)
                        }
                        className="ads-saas-btn ads-saas-btn-danger ads-saas-btn-sm"
                        style={{ padding: '4px 6px' }}
                        title="Spotu Kaldır"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Sürükle-Bırak Altına Ekle/Taşı Çizgisi */}
                {isDropBelow && (
                  <div
                    style={{
                      padding: '3px 10px',
                      marginTop: '3px',
                      borderRadius: '6px',
                      background: 'linear-gradient(90deg, #2563eb, #0284c7)',
                      color: '#ffffff',
                      fontSize: '10.5px',
                      fontWeight: '900',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)'
                    }}
                  >
                    ↓ #{adIdx + 2}. Sıraya Bırak ({matDisplayName} Altına)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const AdBreaksListView = ({
  adBreaksList = [],
  selectedDayInfo,
  selectedStudioBreak,
  onSelectStudioBreakTime,
  selectedAdTarget,
  onSelectAdTarget,
  insertPositionMode = 'below',
  onChangeInsertPositionMode,
  companies = [],
  products = [],
  materials = [],
  reservations = [],
  onClearAdBreak,
  onOpenQuickModalBreak,
  onMoveAdInBreak,
  onReorderAdInBreak,
  onRemoveAdFromBreak,
  onPreviewMaterial,
  onQuickAddSpotToBreak,
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
                        {brk.prevProgramCategoryName && (
                          <span
                            style={{
                              marginLeft: '6px',
                              fontSize: '10px',
                              fontWeight: '800',
                              padding: '1px 6px',
                              borderRadius: '5px',
                              background: 'rgba(16, 185, 129, 0.14)',
                              color: '#059669',
                              border: '1px solid rgba(16, 185, 129, 0.35)'
                            }}
                            title={`Kategoriye göre RTÜK Reklam Giriş: ${brk.expectedIntroBumperName || '-'} • Çıkış: ${brk.expectedOutroBumperName || '-'}`}
                          >
                            🏷️ {brk.prevProgramCategoryName}
                            {brk.expectedIntroBumperName ? ` → 🟢 ${brk.expectedIntroBumperName}` : ''}
                            {brk.expectedOutroBumperName ? ` / 🟠 ${brk.expectedOutroBumperName}` : ''}
                            {brk.expectedBumperTotalSec ? ` (${brk.expectedBumperTotalSec} sn)` : ''}
                          </span>
                        )}
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

            {/* Ortak İnteraktif Sıralı Spot Listesi (Seçme + Üstüne/Altına Ekleme + Sürükle-Bırak) */}
            <AdBreakInteractiveSpotsList
              brk={brk}
              selectedDayInfo={selectedDayInfo}
              companies={companies}
              products={products}
              materials={materials}
              reservations={reservations}
              selectedAdTarget={selectedAdTarget}
              onSelectAdTarget={onSelectAdTarget}
              insertPositionMode={insertPositionMode}
              onChangeInsertPositionMode={onChangeInsertPositionMode}
              onSelectStudioBreakTime={onSelectStudioBreakTime}
              onOpenQuickModalBreak={onOpenQuickModalBreak}
              onMoveAdInBreak={onMoveAdInBreak}
              onReorderAdInBreak={onReorderAdInBreak}
              onRemoveAdFromBreak={onRemoveAdFromBreak}
              onPreviewMaterial={onPreviewMaterial}
              onQuickAddSpotToBreak={onQuickAddSpotToBreak}
            />
          </div>
        );
      })}
    </div>
  );
};

/**
 * Sol Sabit Hızlı Reklam / Spot Ekleme Paneli:
 * Operatör sol panelden reklamı sürükleyip orta alandaki (Reklam Kuşakları veya Tam Yayın Akışı)
 * herhangi bir reklamın üstüne/altına bırakabilir veya seçili reklamın Üstüne / Altına tek tıkla ekleyebilir.
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
  selectedAdTarget,
  onSelectAdTarget,
  insertPositionMode = 'below',
  onChangeInsertPositionMode,
  filteredPoolReservations = [],
  filteredPoolCatalog = [],
  onQuickAddSpotToBreak,
  onPreviewMaterial
}) => {
  const isSelectedAdInActiveBreak =
    selectedAdTarget &&
    selectedStudioBreak &&
    selectedAdTarget.breakTime === selectedStudioBreak.shortTime;

  const handlePoolItemDragStart = (e, payload) => {
    const dragPayload = {
      dragType: 'pool-ad-insert',
      ...payload
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragPayload));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

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
      {/* 1. Hedef Kuşak & Ekleme Konumu Seçici */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
            Sol Panel • Reklam &amp; Spot Havuzu
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

        {/* Seçili Reklamın Üstüne / Altına Ekleme Durum Kutusu */}
        {isSelectedAdInActiveBreak ? (
          <div
            style={{
              padding: '8px 10px',
              borderRadius: '9px',
              background: 'rgba(2, 132, 199, 0.12)',
              border: '1.5px solid rgba(2, 132, 199, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#0369a1' }}>
                🎯 Seçili: #{selectedAdTarget.adIndex + 1} {selectedAdTarget.adTitle}
              </span>
              <button
                type="button"
                onClick={() => onSelectAdTarget && onSelectAdTarget(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#ef4444',
                  fontSize: '10.5px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Seçimi Kaldır ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.8fr', gap: '4px' }}>
              <button
                type="button"
                onClick={() => onChangeInsertPositionMode && onChangeInsertPositionMode('above')}
                style={{
                  padding: '4px 6px',
                  borderRadius: '6px',
                  border: insertPositionMode === 'above' ? '1.5px solid #0284c7' : '1px solid var(--ads-border)',
                  background: insertPositionMode === 'above' ? '#0284c7' : 'var(--ads-card-bg)',
                  color: insertPositionMode === 'above' ? '#fff' : 'var(--ads-text-main)',
                  fontSize: '10.5px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                ↑ Üstüne (#{selectedAdTarget.adIndex + 1})
              </button>
              <button
                type="button"
                onClick={() => onChangeInsertPositionMode && onChangeInsertPositionMode('below')}
                style={{
                  padding: '4px 6px',
                  borderRadius: '6px',
                  border: insertPositionMode === 'below' ? '1.5px solid #0284c7' : '1px solid var(--ads-border)',
                  background: insertPositionMode === 'below' ? '#0284c7' : 'var(--ads-card-bg)',
                  color: insertPositionMode === 'below' ? '#fff' : 'var(--ads-text-main)',
                  fontSize: '10.5px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                ↓ Altına (#{selectedAdTarget.adIndex + 2})
              </button>
              <button
                type="button"
                onClick={() => onChangeInsertPositionMode && onChangeInsertPositionMode('end')}
                style={{
                  padding: '4px 6px',
                  borderRadius: '6px',
                  border: insertPositionMode === 'end' ? '1.5px solid #0284c7' : '1px solid var(--ads-border)',
                  background: insertPositionMode === 'end' ? '#0284c7' : 'var(--ads-card-bg)',
                  color: insertPositionMode === 'end' ? '#fff' : 'var(--ads-text-main)',
                  fontSize: '10.5px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                Sona
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              background: 'var(--ads-card-subtle)',
              border: '1px dashed var(--ads-border-strong)',
              fontSize: '10.5px',
              color: 'var(--ads-text-muted)',
              lineHeight: 1.35
            }}
          >
            💡 Reklamı fareyle <strong>sürükleyip kuşağa bırakabilir</strong> veya kuşak içinden bir reklama tıklayarak <strong>üstüne / altına</strong> ekleyebilirsiniz.
          </div>
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

      {/* 4. Spot Listesi (Sürükle-Bırak + ⓘ Detay + ↑ Üstüne / ↓ Altına / + Ekle) */}
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
                  draggable
                  onDragStart={e =>
                    handlePoolItemDragStart(e, {
                      reservationId: item.reservationId,
                      materialId: item.materialId,
                      companyId: item.companyId,
                      productId: item.productId,
                      durationSec: item.durationSec,
                      materialName: item.materialName
                    })
                  }
                  style={{
                    padding: '9px 10px',
                    borderRadius: '10px',
                    border: item.isSponsor ? '1.5px solid #9333ea' : '1px solid var(--ads-border)',
                    borderLeft: item.isSponsor ? '4px solid #9333ea' : undefined,
                    background: item.isSponsor
                      ? 'linear-gradient(90deg, rgba(147, 51, 234, 0.14) 0%, rgba(217, 119, 6, 0.06) 100%)'
                      : 'var(--ads-card-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    cursor: 'grab'
                  }}
                  title="Kuşağa sürükleyip bırakabilir veya Ekle butonlarını kullanabilirsiniz"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, flex: 1 }}>
                      <GripVertical size={13} color="var(--ads-text-muted)" style={{ flexShrink: 0 }} />
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
                              maxWidth: '175px'
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
                        <div style={{ fontSize: '10px', color: isMaxReached ? '#d97706' : '#0d9488', fontWeight: '700', marginTop: '1px' }}>
                          Bugün: {item.todayPlaced} (Min:{item.dailyMinSpots}/Max:{item.dailyMaxSpots})
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      {onPreviewMaterial && (
                        <button
                          type="button"
                          onClick={() => onPreviewMaterial(item)}
                          className="ads-saas-btn ads-saas-btn-sm"
                          style={{
                            width: '28px',
                            height: '28px',
                            padding: 0,
                            borderRadius: '8px',
                            background: 'rgba(37, 99, 235, 0.12)',
                            border: '1px solid rgba(37, 99, 235, 0.35)',
                            color: '#2563eb',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Reklam Detayları, Firma, Kare (25/30/50 FPS) ve Video Önizleme (ⓘ)"
                        >
                          <Info size={14} />
                        </button>
                      )}

                      {!isSelectedAdInActiveBreak && (
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
                      )}
                    </div>
                  </div>

                  {/* Seçili reklam varsa doğrudan Üstüne / Altına hızlı ekleme butonları */}
                  {isSelectedAdInActiveBreak && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', paddingTop: '4px', borderTop: '1px dashed var(--ads-border)' }}>
                      <button
                        type="button"
                        onClick={() =>
                          selectedStudioBreak &&
                          onQuickAddSpotToBreak(selectedStudioBreak, {
                            reservationId: item.reservationId,
                            materialId: item.materialId,
                            companyId: item.companyId,
                            productId: item.productId,
                            insertAtIndex: selectedAdTarget.adIndex
                          })
                        }
                        className="ads-saas-btn ads-saas-btn-sm"
                        style={{
                          padding: '4px 6px',
                          fontSize: '10.5px',
                          fontWeight: '800',
                          justifyContent: 'center',
                          background: 'rgba(2, 132, 199, 0.12)',
                          border: '1px solid rgba(2, 132, 199, 0.35)',
                          color: '#0284c7'
                        }}
                      >
                        ↑ Seçilinin Üstüne Ekle
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          selectedStudioBreak &&
                          onQuickAddSpotToBreak(selectedStudioBreak, {
                            reservationId: item.reservationId,
                            materialId: item.materialId,
                            companyId: item.companyId,
                            productId: item.productId,
                            insertAtIndex: selectedAdTarget.adIndex + 1
                          })
                        }
                        className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                        style={{
                          padding: '4px 6px',
                          fontSize: '10.5px',
                          fontWeight: '800',
                          justifyContent: 'center'
                        }}
                      >
                        ↓ Seçilinin Altına Ekle
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : (
          filteredPoolCatalog.map(mat => (
            <div
              key={mat.id}
              draggable
              onDragStart={e =>
                handlePoolItemDragStart(e, {
                  materialId: mat.id,
                  companyId: mat.companyId,
                  productId: mat.productId,
                  durationSec: mat.duration,
                  materialName: mat.name
                })
              }
              style={{
                padding: '9px 10px',
                borderRadius: '10px',
                border: '1px solid var(--ads-border)',
                background: 'var(--ads-card-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                cursor: 'grab'
              }}
              title="Kuşağa sürükleyip bırakabilir veya Ekle butonlarını kullanabilirsiniz"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, flex: 1 }}>
                  <GripVertical size={13} color="var(--ads-text-muted)" style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--ads-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {mat.name}
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)', marginTop: '1px' }}>
                      <strong>{mat.companyName}</strong> • {mat.duration} sn
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  {onPreviewMaterial && (
                    <button
                      type="button"
                      onClick={() => onPreviewMaterial(mat)}
                      className="ads-saas-btn ads-saas-btn-sm"
                      style={{
                        width: '28px',
                        height: '28px',
                        padding: 0,
                        borderRadius: '8px',
                        background: 'rgba(37, 99, 235, 0.12)',
                        border: '1px solid rgba(37, 99, 235, 0.35)',
                        color: '#2563eb',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Reklam Detayları, Firma, Kare (25/30/50 FPS) ve Video Önizleme (ⓘ)"
                    >
                      <Info size={14} />
                    </button>
                  )}

                  {!isSelectedAdInActiveBreak && (
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
                  )}
                </div>
              </div>

              {isSelectedAdInActiveBreak && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', paddingTop: '4px', borderTop: '1px dashed var(--ads-border)' }}>
                  <button
                    type="button"
                    onClick={() =>
                      selectedStudioBreak &&
                      onQuickAddSpotToBreak(selectedStudioBreak, {
                        materialId: mat.id,
                        companyId: mat.companyId,
                        productId: mat.productId,
                        insertAtIndex: selectedAdTarget.adIndex
                      })
                    }
                    className="ads-saas-btn ads-saas-btn-sm"
                    style={{
                      padding: '4px 6px',
                      fontSize: '10.5px',
                      fontWeight: '800',
                      justifyContent: 'center',
                      background: 'rgba(2, 132, 199, 0.12)',
                      border: '1px solid rgba(2, 132, 199, 0.35)',
                      color: '#0284c7'
                    }}
                  >
                    ↑ Seçilinin Üstüne Ekle
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      selectedStudioBreak &&
                      onQuickAddSpotToBreak(selectedStudioBreak, {
                        materialId: mat.id,
                        companyId: mat.companyId,
                        productId: mat.productId,
                        insertAtIndex: selectedAdTarget.adIndex + 1
                      })
                    }
                    className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                    style={{
                      padding: '4px 6px',
                      fontSize: '10.5px',
                      fontWeight: '800',
                      justifyContent: 'center'
                    }}
                  >
                    ↓ Seçilinin Altına Ekle
                  </button>
                </div>
              )}
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
  products = [],
  reservations = [],
  selectedDayInfo,
  selectedStudioBreak,
  onSelectStudioBreakTime,
  selectedAdTarget,
  onSelectAdTarget,
  insertPositionMode = 'below',
  onChangeInsertPositionMode,
  onClearAdBreak,
  onOpenQuickModalBreak,
  onMoveAdInBreak,
  onReorderAdInBreak,
  onRemoveAdFromBreak,
  onPreviewMaterial,
  onQuickAddSpotToBreak
}) => {
  const themeConfig = useThemeStore(state => state.config);
  const emptyBreakColor = themeConfig?.modules?.ads?.emptyBreakColor || themeConfig?.specialColors?.adBreakEmptyColor || '#ea580c';
  const filledBreakColor = themeConfig?.modules?.ads?.filledBreakColor || themeConfig?.specialColors?.adBreakFilledColor || '#0d9488';

  return (
    <div className="ta-card" style={{ padding: '16px', gap: '10px' }}>
      {enrichedTimeline.map(item => {
        const isSponsoredProg = !item.isAdBlock && Boolean(item.isSponsoredProgram);
        const isSponsorBreak = item.isAdBlock && Boolean(item.hasSponsorAds);
        const isActiveTargetBreak =
          item.isAdBlock && selectedStudioBreak && selectedStudioBreak.shortTime === item.shortTime;

        return (
          <div
            key={item.instanceId || item.idx}
            onClick={() => {
              if (item.isAdBlock && onSelectStudioBreakTime) {
                onSelectStudioBreakTime(item.shortTime);
              }
            }}
            style={{
              display: 'flex',
              cursor: item.isAdBlock ? 'pointer' : 'default',
              border: isActiveTargetBreak
                ? '2px solid var(--ads-brand)'
                : isSponsoredProg
                ? '2px solid #9333ea'
                : isSponsorBreak
                ? '1.5px solid rgba(147, 51, 234, 0.55)'
                : '1px solid var(--ads-border)',
              borderLeft: item.isAdBlock
                ? `6px solid ${
                    isActiveTargetBreak
                      ? 'var(--ads-brand)'
                      : isSponsorBreak
                      ? '#9333ea'
                      : item.placedAds.length > 0
                      ? filledBreakColor
                      : emptyBreakColor
                  }`
                : isSponsoredProg
                ? '6px solid #9333ea'
                : '4px solid var(--ads-brand)',
              borderRadius: '12px',
              background: isSponsoredProg
                ? 'linear-gradient(90deg, rgba(147, 51, 234, 0.16) 0%, rgba(217, 119, 6, 0.06) 100%)'
                : item.isAdBlock
                ? item.placedAds.length > 0
                  ? hexToRgba(filledBreakColor, 0.05)
                  : hexToRgba(emptyBreakColor, 0.06)
                : 'var(--ads-card-bg)',
              boxShadow: isActiveTargetBreak
                ? '0 8px 22px -6px rgba(70, 95, 255, 0.2)'
                : undefined,
              overflow: 'hidden',
              transition: 'all 0.15s ease'
            }}
          >
            {/* Sol Saat Sütunu */}
            <div
              style={{
                width: '125px',
                padding: '10px 12px',
                background: isSponsoredProg
                  ? 'rgba(147, 51, 234, 0.12)'
                  : isActiveTargetBreak
                  ? 'var(--ads-brand-soft)'
                  : 'var(--ads-card-subtle)',
                borderRight: '1px solid var(--ads-border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'monospace',
                flexShrink: 0
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: '900',
                  color: isSponsoredProg
                    ? '#7e22ce'
                    : isActiveTargetBreak
                    ? 'var(--ads-brand)'
                    : 'var(--ads-text-main)'
                }}
              >
                {item.exactStartClock}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>
                → {item.exactEndClock}
              </span>
            </div>

            {/* Sağ İçerik Sütunu */}
            <div style={{ flex: 1, padding: '12px 15px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--ads-text-muted)', fontWeight: '700' }}>
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

                  {isActiveTargetBreak && (
                    <span className="ta-badge ta-badge-brand" style={{ fontSize: '10.5px' }}>
                      <Target size={11} /> Seçili Hedef Kuşak
                    </span>
                  )}

                  {item.partNo && (
                    <span className="ta-badge ta-badge-info" style={{ fontSize: '10px' }}>
                      Part {item.partNo}
                    </span>
                  )}
                  {!item.isAdBlock && item.categoryName && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 7px',
                        borderRadius: '6px',
                        background: 'rgba(37, 99, 235, 0.1)',
                        color: '#2563eb'
                      }}
                    >
                      🏷️ {item.categoryName}
                    </span>
                  )}
                  {item.isAdBlock && item.prevProgramCategoryName && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(16, 185, 129, 0.14)',
                        color: '#059669',
                        border: '1px solid rgba(16, 185, 129, 0.35)'
                      }}
                      title={`Önceki program (${item.prevProgramTitle || '-'}) kategorisi: ${item.prevProgramCategoryName}`}
                    >
                      🎬 Önceki Kategori: {item.prevProgramCategoryName}
                      {item.expectedIntroBumperName ? ` • 🟢 ${item.expectedIntroBumperName}` : ''}
                      {item.expectedOutroBumperName ? ` • 🟠 ${item.expectedOutroBumperName}` : ''}
                    </span>
                  )}
                  <span style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)', fontWeight: '600' }}>
                    ({item.durationMin} dk)
                  </span>
                </div>

                {item.isAdBlock && (
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: '800',
                        padding: '3px 9px',
                        borderRadius: '7px',
                        background: 'rgba(13, 148, 136, 0.12)',
                        color: '#0d9488'
                      }}
                    >
                      {item.placedAds.length} Spot • {item.filledSec} / {item.capacitySec} sn
                    </span>

                    {item.placedAds.length > 0 && onClearAdBreak && (
                      <button
                        type="button"
                        onClick={() => onClearAdBreak(selectedDayInfo.channelId, selectedDayInfo.date, item.shortTime)}
                        className="ads-saas-btn ads-saas-btn-danger ads-saas-btn-sm"
                        title="Bu kuşağı temizle"
                      >
                        <Trash2 size={12} /> Temizle
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectStudioBreakTime) onSelectStudioBreakTime(item.shortTime);
                        onOpenQuickModalBreak(item);
                      }}
                      className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                    >
                      <Plus size={12} /> Spot Ekle
                    </button>
                  </div>
                )}
              </div>

              {/* Tam Yayın Akışında Kuşak İçi Reklamlar: Düzenli Sıralı Liste + Seçilinin Üstüne/Altına Ekleme + Sürükle-Bırak */}
              {item.isAdBlock && (
                <AdBreakInteractiveSpotsList
                  brk={item}
                  selectedDayInfo={selectedDayInfo}
                  companies={companies}
                  products={products}
                  materials={materials}
                  reservations={reservations}
                  selectedAdTarget={selectedAdTarget}
                  onSelectAdTarget={onSelectAdTarget}
                  insertPositionMode={insertPositionMode}
                  onChangeInsertPositionMode={onChangeInsertPositionMode}
                  onSelectStudioBreakTime={onSelectStudioBreakTime}
                  onOpenQuickModalBreak={onOpenQuickModalBreak}
                  onMoveAdInBreak={onMoveAdInBreak}
                  onReorderAdInBreak={onReorderAdInBreak}
                  onRemoveAdFromBreak={onRemoveAdFromBreak}
                  onPreviewMaterial={onPreviewMaterial}
                  onQuickAddSpotToBreak={onQuickAddSpotToBreak}
                />
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
              <th>Yerleştirilen Reklamlar (ⓘ Detay &amp; Önizleme)</th>
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
                          onClick={() =>
                            onPreviewMaterial &&
                            onPreviewMaterial({
                              ...(mat || {}),
                              ...ad,
                              materialId: ad.materialId || mat?.id,
                              companyId: ad.companyId || mat?.companyId,
                              productId: ad.productId || mat?.productId,
                              reservationId: ad.reservationId,
                              isSponsor: spInfo.isSponsor,
                              sponsorProgramTitle: spInfo.programTitle,
                              sponsorTag: spInfo.roleLabel,
                              breakTime: brk.shortTime,
                              breakName: brk.title,
                              orderInBreak: idx + 1,
                              prevProgramTitle: brk.prevProgramTitle,
                              nextProgramTitle: brk.nextProgramTitle
                            })
                          }
                          title="Reklam detayları ve video önizleme için tıklayın (ⓘ)"
                          style={{
                            fontSize: '10.5px',
                            fontWeight: '800',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            cursor: onPreviewMaterial ? 'pointer' : 'default',
                            background: spInfo.isBumper
                              ? spInfo.bumperType === 'intro'
                                ? 'rgba(16, 185, 129, 0.16)'
                                : 'rgba(245, 158, 11, 0.16)'
                              : spInfo.isSponsor
                              ? 'rgba(147, 51, 234, 0.16)'
                              : 'var(--ads-brand-soft)',
                            color: spInfo.isBumper
                              ? spInfo.bumperType === 'intro'
                                ? '#059669'
                                : '#d97706'
                              : spInfo.isSponsor
                              ? '#9333ea'
                              : 'var(--ads-brand)',
                            border: spInfo.isBumper
                              ? spInfo.bumperType === 'intro'
                                ? '1px solid #059669'
                                : '1px solid #d97706'
                              : spInfo.isSponsor
                              ? '1px solid #9333ea'
                              : '1px solid transparent',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {spInfo.isBumper ? (
                            <span>{spInfo.bumperType === 'intro' ? '🟢' : '🟠'}</span>
                          ) : (
                            spInfo.isSponsor && <span>🏆</span>
                          )}
                          <span>{ad.name || mat?.name || 'Spot'} ({ad.duration}sn)</span>
                          {onPreviewMaterial && <Info size={11} />}
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
  selectedAdTarget,
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

  const isSelectedAdInModalBreak =
    selectedAdTarget && selectedAdTarget.breakTime === quickModalBreak.shortTime;

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
          maxWidth: '860px',
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
              {isSelectedAdInModalBreak && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    padding: '3px 9px',
                    borderRadius: '999px',
                    background: 'rgba(2, 132, 199, 0.14)',
                    color: '#0284c7',
                    border: '1px solid rgba(2, 132, 199, 0.4)'
                  }}
                >
                  🎯 Seçili Reklam: #{selectedAdTarget.adIndex + 1} {selectedAdTarget.adTitle}
                </span>
              )}
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
                    gap: '10px',
                    flexWrap: 'wrap'
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
                        onClick={() => onPreviewMaterial(item)}
                        className="ads-saas-btn ads-saas-btn-sm"
                        style={{
                          width: '30px',
                          height: '30px',
                          padding: 0,
                          borderRadius: '8px',
                          background: 'rgba(37, 99, 235, 0.12)',
                          border: '1px solid rgba(37, 99, 235, 0.35)',
                          color: '#2563eb',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Reklam Detayları, Firma, Kare (25/30/50 FPS) ve Video Önizleme (ⓘ)"
                      >
                        <Info size={15} />
                      </button>
                    )}

                    {isSelectedAdInModalBreak && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            onQuickAddSpotToBreak(quickModalBreak, {
                              reservationId: item.reservationId,
                              materialId: item.materialId,
                              companyId: item.companyId,
                              productId: item.productId,
                              insertAtIndex: selectedAdTarget.adIndex
                            })
                          }
                          className="ads-saas-btn ads-saas-btn-sm"
                          style={{
                            background: 'rgba(2, 132, 199, 0.12)',
                            border: '1px solid rgba(2, 132, 199, 0.35)',
                            color: '#0284c7',
                            fontWeight: '800'
                          }}
                        >
                          ↑ Seçilinin Üstüne
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onQuickAddSpotToBreak(quickModalBreak, {
                              reservationId: item.reservationId,
                              materialId: item.materialId,
                              companyId: item.companyId,
                              productId: item.productId,
                              insertAtIndex: selectedAdTarget.adIndex + 1
                            })
                          }
                          className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                        >
                          ↓ Seçilinin Altına
                        </button>
                      </>
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
                      <Plus size={13} /> {isSelectedAdInModalBreak ? 'Kuşak Sonuna' : 'Bu Kuşağa Ekle'}
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
                    gap: '10px',
                    flexWrap: 'wrap'
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
                        className="ads-saas-btn ads-saas-btn-sm"
                        style={{
                          width: '30px',
                          height: '30px',
                          padding: 0,
                          borderRadius: '8px',
                          background: 'rgba(37, 99, 235, 0.12)',
                          border: '1px solid rgba(37, 99, 235, 0.35)',
                          color: '#2563eb',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Reklam Detayları, Firma, Kare (25/30/50 FPS) ve Video Önizleme (ⓘ)"
                      >
                        <Info size={15} />
                      </button>
                    )}

                    {isSelectedAdInModalBreak && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            onQuickAddSpotToBreak(quickModalBreak, {
                              materialId: mat.id,
                              companyId: mat.companyId,
                              productId: mat.productId,
                              insertAtIndex: selectedAdTarget.adIndex
                            })
                          }
                          className="ads-saas-btn ads-saas-btn-sm"
                          style={{
                            background: 'rgba(2, 132, 199, 0.12)',
                            border: '1px solid rgba(2, 132, 199, 0.35)',
                            color: '#0284c7',
                            fontWeight: '800'
                          }}
                        >
                          ↑ Seçilinin Üstüne
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onQuickAddSpotToBreak(quickModalBreak, {
                              materialId: mat.id,
                              companyId: mat.companyId,
                              productId: mat.productId,
                              insertAtIndex: selectedAdTarget.adIndex + 1
                            })
                          }
                          className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                        >
                          ↓ Seçilinin Altına
                        </button>
                      </>
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
                      <Plus size={13} /> {isSelectedAdInModalBreak ? 'Kuşak Sonuna' : 'Bu Kuşağa Ekle'}
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
