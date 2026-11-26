/**
 * @file src/components/Ads/ReservationsTab.jsx
 * @description Yenilenmiş Modern SaaS Temalı Reklam Rezervasyonları ve Çoklu Ürün / Sponsorluk Yönetim Ekranı.
 */
import React, { useState, useMemo, useRef } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  FileText,
  Award,
  Tv,
  Package,
  Film,
  Search,
  Sparkles,
  TrendingUp,
  Layers,
  Play,
  X,
  RefreshCw,
  Download,
  Upload
} from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import {
  saveAdsReservationsBackup,
  loadAdsReservationsBackup
} from '../../store/slices/ads/adsCatalogHelpers';
import AdsReservationForm, { SPONSOR_POSITIONS } from './AdsReservationForm';
import { calculateItemOverageMetrics } from './reservation/reservationConstants';
import useDialogStore from '../../store/dialogStore';
import AdVideoPlayer from './AdVideoPlayer';

const PRIORITIES = {
  '1000': { label: 'Zorunlu', color: '#dc2626', bg: 'rgba(239, 68, 68, 0.14)' },
  '700': { label: 'Yüksek', color: '#d97706', bg: 'rgba(245, 158, 11, 0.14)' },
  '400': { label: 'Normal', color: '#0066ff', bg: 'rgba(0, 102, 255, 0.14)' },
  '100': { label: 'Dolgu', color: '#9333ea', bg: 'rgba(147, 51, 234, 0.14)' }
};

const formatTrDate = (dateStr) => {
  if (!dateStr) return '-';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
};

const ReservationsTab = ({ setActiveTab }) => {
  const {
    reservations = [],
    companies = [],
    products = [],
    materials = [],
    timeBlocks = [],
    channels = [],
    adPlacements = {},
    ramadanConfig = { enabled: true, startDate: '2026-02-18', endDate: '2026-03-19' },
    updateReservation,
    removeReservation,
    clearAllReservations,
    syncAdsStoreWithServer
  } = usePlanningStore();

  const [isServerSyncing, setIsServerSyncing] = useState(false);
  const fileImportRef = useRef(null);

  const handleManualServerSync = async () => {
    if (!syncAdsStoreWithServer) return;
    setIsServerSyncing(true);
    try {
      const localCheck = loadAdsReservationsBackup();
      const localCount = Array.isArray(localCheck?.reservations) ? localCheck.reservations.length : 0;
      const merged = await syncAdsStoreWithServer();
      const serverCount = Array.isArray(merged?.reservations) ? merged.reservations.length : reservations.length;
      useDialogStore
        .getState()
        .showSuccess(
          'Sunucu Veritabanı Eşitlemesi Tamamlandı',
          `Tarayıcı adresi: ${window.location.origin}\n` +
            `Bu tarayıcı hafızasında bulunan rezervasyon: ${localCount} adet\n` +
            `Sunucu veritabanındaki (/api/ads-store) toplam rezervasyon: ${serverCount} adet\n\n` +
            (serverCount === 0
              ? `Not: Eğer rezervasyonlarınız diğer adreste (.80) görünüyorsa, önce .80 sayfasında "Yedek İndir" veya "Sunucuyla Eşitle" butonuna basın.`
              : `Tüm rezervasyonlar sunucu veritabanıyla eşitlendi.`)
        );
    } finally {
      setIsServerSyncing(false);
    }
  };

  // .80 veya herhangi bir tarayıcıdaki tüm rezervasyon, yerleşim, fiyat ve kural verilerini tek tıkla JSON olarak indirir
  const handleExportReservationsJson = () => {
    const state = usePlanningStore.getState();
    const localBackup = loadAdsReservationsBackup();
    const resMap = new Map();
    if (Array.isArray(localBackup?.reservations)) {
      localBackup.reservations.forEach(r => {
        if (r && r.id) resMap.set(String(r.id), r);
      });
    }
    if (Array.isArray(state.reservations)) {
      state.reservations.forEach(r => {
        if (r && r.id) resMap.set(String(r.id), r);
      });
    }
    const exportReservations = Array.from(resMap.values());
    const exportPlacements = {
      ...(localBackup?.adPlacements || {}),
      ...(state.adPlacements || {})
    };

    const payload = {
      exportedAt: new Date().toISOString(),
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      reservations: exportReservations,
      adPlacements: exportPlacements,
      adBreakBumperRules: state.adBreakBumperRules || [],
      adSettings: state.adSettings || {},
      adsPricingConfig: state.adsPricingConfig || {},
      manualCompanies: (state.companies || []).filter(c => c && c.isManual),
      manualProducts: (state.products || []).filter(p => p && p.isManual),
      manualMaterials: (state.materials || []).filter(m => m && m.isManual)
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reklam_rezervasyon_yedek_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // İndirilen JSON yedeğini yükleyip hem mevcut tarayıcıya hem de sunucu veritabanına (/api/ads-store) kaydeder
  const handleImportReservationsJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        const incomingRes = Array.isArray(parsed.reservations)
          ? parsed.reservations
          : Array.isArray(parsed?.state?.reservations)
          ? parsed.state.reservations
          : Array.isArray(parsed)
          ? parsed
          : [];
        const incomingPlacements =
          (parsed.adPlacements && typeof parsed.adPlacements === 'object' ? parsed.adPlacements : null) ||
          (parsed?.state?.adPlacements && typeof parsed.state.adPlacements === 'object'
            ? parsed.state.adPlacements
            : {});

        if (incomingRes.length === 0 && Object.keys(incomingPlacements).length === 0) {
          useDialogStore
            .getState()
            .showAlert('Geçersiz Yedek Dosyası', 'Seçilen dosyada herhangi bir rezervasyon kaydı bulunamadı.');
          return;
        }

        const state = usePlanningStore.getState();
        const resMap = new Map();
        (state.reservations || []).forEach(r => {
          if (r && r.id) resMap.set(String(r.id), r);
        });
        incomingRes.forEach(r => {
          if (r && r.id) resMap.set(String(r.id), r);
        });
        const mergedReservations = Array.from(resMap.values());
        const mergedPlacements = {
          ...(state.adPlacements || {}),
          ...incomingPlacements
        };

        usePlanningStore.setState({
          reservations: mergedReservations,
          adPlacements: mergedPlacements
        });
        saveAdsReservationsBackup(mergedReservations, mergedPlacements);
        if (typeof syncAdsStoreWithServer === 'function') {
          await syncAdsStoreWithServer();
        }

        useDialogStore
          .getState()
          .showSuccess(
            'Rezervasyonlar Başarıyla Yüklendi',
            `${incomingRes.length} adet rezervasyon planı başarıyla içe aktarıldı ve sunucu veritabanına (/api/ads-store) kaydedildi.`
          );
      } catch (err) {
        useDialogStore
          .getState()
          .showAlert('Dosya Okuma Hatası', `Yedek dosyası okunamadı: ${err.message}`);
      } finally {
        if (fileImportRef.current) fileImportRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [defaultSponsorMode, setDefaultSponsorMode] = useState(false);
  const [editingRes, setEditingRes] = useState(null);
  const [previewMaterial, setPreviewMaterial] = useState(null);

  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'standard' | 'sponsor' | 'multi'
  const [channelFilter, setChannelFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const handleDelete = (id) => {
    useDialogStore
      .getState()
      .showConfirm(
        'Rezervasyonu Sil',
        'Bu rezervasyon planını silmek istediğinize emin misiniz?',
        () => removeReservation(id)
      );
  };

  const handleDeleteRowItem = (row) => {
    if (!row) return;
    // Eğer bu rezervasyonun içinde birden fazla reklam (item) varsa sadece bu reklam satırını sil, tek reklam varsa rezervasyonu sil
    const parentRes = reservations.find(r => String(r.id) === String(row.reservationId));
    const parentItems = Array.isArray(parentRes?.items) ? parentRes.items : [];

    if (parentRes && parentItems.length > 1) {
      useDialogStore
        .getState()
        .showConfirm(
          'Reklam Satırını Sil',
          `"${row.companyName}" firmasına ait "${row.materialName || row.productName}" reklamını bu rezervasyon planından kaldırmak istediğinize emin misiniz? (Aynı firmaya ait diğer ${parentItems.length - 1} reklam korunacaktır)`,
          () => {
            const nextItems = parentItems.filter((_, idx) => idx !== row.itemIndex);
            const nextTotalPlanned = nextItems.reduce((s, it) => s + (Number(it.plannedSpots) || 0), 0);
            updateReservation(parentRes.id, {
              ...parentRes,
              items: nextItems,
              totalPlannedSpots: nextTotalPlanned
            });
          }
        );
    } else {
      handleDelete(row.reservationId);
    }
  };

  const getPriorityInfo = (val) => PRIORITIES[String(val)] || PRIORITIES['700'];

  // Her bir reklam klibini (item) kendi bağımsız satırı olarak zenginleştir (aynı firmaya ait olsa bile her reklam ayrı satırda net görünür)
  const enrichedReservationRows = useMemo(() => {
    const rows = [];

    reservations.forEach(res => {
      const items =
        Array.isArray(res.items) && res.items.length > 0
          ? res.items
          : res.companyId || res.materialId
          ? [
              {
                id: `${res.id}-0`,
                companyId: res.companyId,
                productId: res.productId,
                materialId: res.materialId,
                startDate: res.startDate,
                endDate: res.endDate,
                plannedSpots: res.totalPlannedSpots,
                dailyMinSpots: res.dailyMinSpots,
                dailyMaxSpots: res.dailyMaxSpots,
                channelIds: res.channelIds,
                timeBlockIds: res.timeBlockIds,
                timeBlockSpotCounts: res.timeBlockSpotCounts,
                priority: res.priority,
                isSponsor: res.isSponsor,
                sponsorProgramId: res.sponsorProgramId,
                sponsorProgramTitle: res.sponsorProgramTitle,
                sponsorPositions: res.sponsorPositions,
                isRamadanSpecial: res.isRamadanSpecial,
                ramadanTarget: res.ramadanTarget,
                ramadanPositions: res.ramadanPositions,
                spotPrice: res.spotPrice,
                totalBudget: res.toplamTutar || res.totalBudget
              }
            ]
          : [];

      items.forEach((it, idx) => {
        const company = companies.find(c => String(c.id) === String(it.companyId || res.companyId));
        const product = products.find(p => String(p.id) === String(it.productId || res.productId));
        const material = materials.find(m => String(m.id) === String(it.materialId || res.materialId));

        // Bu reklam klibine (materialId + reservationId) ait gerçekleşen spot sayısını ayrı hesapla
        let itemPlacedCount = 0;
        let resTotalPlacedCount = 0;
        Object.values(adPlacements).forEach(blocks => {
          (blocks || []).forEach(block => {
            (block.ads || []).forEach(ad => {
              if (String(ad.reservationId) === String(res.id)) {
                resTotalPlacedCount++;
                if (material && String(ad.materialId) === String(material.id)) {
                  itemPlacedCount++;
                }
              }
            });
          });
        });

        const effectiveRealized =
          items.length === 1
            ? Math.max(Number(res.realizedSpots) || 0, itemPlacedCount || resTotalPlacedCount)
            : itemPlacedCount;

        const itemPlanned =
          Number(it.plannedSpots) ||
          (items.length === 1 ? Number(res.totalPlannedSpots) : Math.round((Number(res.totalPlannedSpots) || 20) / items.length)) ||
          20;

        const itemPriority = it.priority || res.priority || '700';
        const itemIsSponsor = Boolean(it.isSponsor !== undefined ? it.isSponsor : res.isSponsor);
        const itemSponsorProgramTitle = it.sponsorProgramTitle || res.sponsorProgramTitle || '';
        const itemSponsorPositions =
          Array.isArray(it.sponsorPositions) && it.sponsorPositions.length > 0
            ? it.sponsorPositions
            : Array.isArray(res.sponsorPositions) && res.sponsorPositions.length > 0
            ? res.sponsorPositions
            : ['before', 'after'];

        const itemIsRamadanSpecial = Boolean(
          it.isRamadanSpecial !== undefined ? it.isRamadanSpecial : res.isRamadanSpecial
        );
        const itemRamadanTarget = it.ramadanTarget || res.ramadanTarget || 'iftar';
        const itemRamadanPositions =
          Array.isArray(it.ramadanPositions) && it.ramadanPositions.length > 0
            ? it.ramadanPositions
            : Array.isArray(res.ramadanPositions) && res.ramadanPositions.length > 0
            ? res.ramadanPositions
            : ['before', 'middle', 'after'];

        const itemChannelIds =
          Array.isArray(it.channelIds) && it.channelIds.length > 0
            ? it.channelIds
            : Array.isArray(res.channelIds) && res.channelIds.length > 0
            ? res.channelIds
            : ['ch_hd'];

        const itemTimeBlockIds =
          Array.isArray(it.timeBlockIds) && it.timeBlockIds.length > 0
            ? it.timeBlockIds
            : Array.isArray(res.timeBlockIds) && res.timeBlockIds.length > 0
            ? res.timeBlockIds
            : [];

        const itemTimeBlockSpotCounts =
          it.timeBlockSpotCounts && typeof it.timeBlockSpotCounts === 'object'
            ? it.timeBlockSpotCounts
            : res.timeBlockSpotCounts && typeof res.timeBlockSpotCounts === 'object'
            ? res.timeBlockSpotCounts
            : {};

        const itemStartDate = it.startDate || res.startDate;
        const itemEndDate = it.endDate || res.endDate;
        const itemDailyMin = Number(it.dailyMinSpots ?? res.dailyMinSpots ?? 1);
        const itemDailyMax = Number(it.dailyMaxSpots ?? res.dailyMaxSpots ?? 4);
        const clipDurationSec = Math.max(
          1,
          Number(material?.duration) || Number(it.materialDurationSec || res.materialDurationSec) || 25
        );
        const totalPlannedSeconds = itemPlanned * clipDurationSec;
        const effectiveRealizedSeconds = effectiveRealized * clipDurationSec;

        const rawPerSec = Number(it.perSecondPrice || res.perSecondPrice || 0);
        const rawSpot = Number(it.spotPrice || res.spotPrice || 0);
        const itemPerSecondPrice =
          rawPerSec > 0
            ? rawPerSec
            : rawSpot > 0
            ? Math.round((rawSpot / clipDurationSec) * 100) / 100
            : 0;
        const itemSpotPrice =
          rawSpot > 0
            ? rawSpot
            : rawPerSec > 0
            ? Math.round(rawPerSec * clipDurationSec * 100) / 100
            : 0;
        const itemTotalBudget =
          Number(it.totalBudget) > 0
            ? Number(it.totalBudget)
            : itemPerSecondPrice > 0 && rawPerSec > 0
            ? Math.round(totalPlannedSeconds * itemPerSecondPrice * 100) / 100
            : itemSpotPrice > 0
            ? Math.round(itemSpotPrice * itemPlanned * 100) / 100
            : 0;

        const overageInfo = calculateItemOverageMetrics(
          {
            ...res,
            ...it,
            startDate: itemStartDate,
            endDate: itemEndDate,
            plannedSpots: itemPlanned,
            dailyMinSpots: itemDailyMin,
            dailyMaxSpots: itemDailyMax,
            spotPrice: itemSpotPrice,
            totalBudget: itemTotalBudget,
            isRamadanSpecial: itemIsRamadanSpecial
          },
          effectiveRealized,
          ramadanConfig
        );

        rows.push({
          rowKey: `${res.id}__${it.id || idx}__${idx}`,
          reservationId: res.id,
          parentReservation: res,
          itemIndex: idx,
          siblingCount: items.length,
          item: it,
          company,
          companyName: company?.name || '-',
          product,
          productName: product?.name || 'Ürün',
          material,
          materialName: material ? (material.clipName || material.name) : '',
          materialDuration: material?.duration || 0,
          priority: itemPriority,
          isSponsor: itemIsSponsor,
          sponsorProgramTitle: itemSponsorProgramTitle,
          sponsorPositions: itemSponsorPositions,
          isRamadanSpecial: itemIsRamadanSpecial,
          ramadanTarget: itemRamadanTarget,
          ramadanPositions: itemRamadanPositions,
          channelIds: itemChannelIds,
          timeBlockIds: itemTimeBlockIds,
          timeBlockSpotCounts: itemTimeBlockSpotCounts,
          startDate: itemStartDate,
          endDate: itemEndDate,
          dailyMinSpots: itemDailyMin,
          dailyMaxSpots: itemDailyMax,
          perSecondPrice: itemPerSecondPrice,
          spotPrice: itemSpotPrice,
          totalBudget: itemTotalBudget,
          effectiveRealized,
          totalPlanned: itemPlanned,
          clipDurationSec,
          totalPlannedSeconds,
          effectiveRealizedSeconds,
          overageInfo
        });
      });
    });

    return rows;
  }, [reservations, companies, products, materials, adPlacements, ramadanConfig]);

  // Filtrelenmiş reklam rezervasyon satırları (her reklam ayrı satır)
  const filteredReservations = useMemo(() => {
    return enrichedReservationRows.filter(row => {
      if (typeFilter === 'sponsor' && !row.isSponsor) return false;
      if (typeFilter === 'standard' && (row.isSponsor || row.isRamadanSpecial)) return false;
      if (typeFilter === 'ramadan' && !row.isRamadanSpecial) return false;
      if (typeFilter === 'overage' && !row.overageInfo?.hasAnyOverage) return false;
      if (typeFilter === 'multi' && row.siblingCount < 2) return false;

      if (channelFilter !== 'all' && !(row.channelIds || []).includes(channelFilter)) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLocaleLowerCase('tr-TR');
        const hay = `${row.companyName} ${row.parentReservation?.name || ''} ${row.sponsorProgramTitle || ''} ${row.productName} ${row.materialName}`.toLocaleLowerCase('tr-TR');
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [enrichedReservationRows, typeFilter, channelFilter, searchTerm]);

  // KPI özet istatistikleri
  const kpiStats = useMemo(() => {
    const totalRes = enrichedReservationRows.length;
    const sponsorCount = enrichedReservationRows.filter(r => r.isSponsor).length;
    const ramadanCount = enrichedReservationRows.filter(r => r.isRamadanSpecial).length;
    const overageCount = enrichedReservationRows.filter(r => r.overageInfo?.hasAnyOverage).length;
    const totalProductPlans = enrichedReservationRows.length;
    const totalPlannedSpots = enrichedReservationRows.reduce((acc, r) => acc + r.totalPlanned, 0);
    const totalRealizedSpots = enrichedReservationRows.reduce((acc, r) => acc + r.effectiveRealized, 0);

    return {
      totalRes,
      sponsorCount,
      ramadanCount,
      overageCount,
      totalProductPlans,
      totalPlannedSpots,
      totalRealizedSpots
    };
  }, [enrichedReservationRows]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* ÜST 4 KPI ÖZET KARTI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', flexShrink: 0 }}>
        <div className="ads-saas-card" style={{ padding: '12px 16px', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--ads-text-muted)' }}>Aktif Rezervasyon Planı</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--ads-text-main)', marginTop: '2px' }}>
              {kpiStats.totalRes}
            </div>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--ads-brand-soft)', color: 'var(--ads-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={18} />
          </div>
        </div>

        <div className="ads-saas-card" style={{ padding: '12px 16px', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--ads-text-muted)' }}>Planlanan Ürün &amp; Spot Satırı</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--ads-orange)', marginTop: '2px' }}>
              {kpiStats.totalProductPlans} <span style={{ fontSize: '12px', fontWeight: '600' }}>Ürün</span>
            </div>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(234, 88, 12, 0.12)', color: 'var(--ads-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={18} />
          </div>
        </div>

        <div
          onClick={() => setActiveTab && setActiveTab('sponsorships')}
          className="ads-saas-card"
          style={{ padding: '12px 16px', cursor: 'pointer', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--ads-text-muted)' }}>Program Sponsorlukları</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--ads-purple)', marginTop: '2px' }}>
              {kpiStats.sponsorCount} <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-brand)' }}>Sponsorluklara Git &rarr;</span>
            </div>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(147, 51, 234, 0.12)', color: 'var(--ads-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={18} />
          </div>
        </div>

        <div className="ads-saas-card" style={{ padding: '12px 16px', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--ads-text-muted)' }}>Gerçekleşen / Planlanan Spot</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--ads-teal)', marginTop: '2px' }}>
              {kpiStats.totalRealizedSpots} / {kpiStats.totalPlannedSpots}
            </div>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(13, 148, 136, 0.12)', color: 'var(--ads-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={18} />
          </div>
        </div>
      </div>

      {/* FİLTRE VE AKSİYON ÇUBUĞU */}
      <div className="ads-saas-toolbar" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className="ads-saas-pill-group">
            {[
              { id: 'all', label: `Tümü (${enrichedReservationRows.length})` },
              { id: 'standard', label: 'Standart Kuşak' },
              { id: 'sponsor', label: `Sponsorluklar (${kpiStats.sponsorCount})` },
              { id: 'ramadan', label: `Ramazan Özel (${kpiStats.ramadanCount})` },
              { id: 'overage', label: `Aşımlı (- Fark) (${kpiStats.overageCount})` },
              { id: 'multi', label: 'Çoklu Ürünlü Planlar' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`ads-saas-pill-btn ${typeFilter === tab.id ? 'active' : ''}`}
                style={{ padding: '5px 11px', fontSize: '11.5px' }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={channelFilter}
            onChange={e => setChannelFilter(e.target.value)}
            className="ads-saas-select"
            style={{ fontSize: '12px' }}
          >
            <option value="all">Tüm Kanallar</option>
            {channels.map(ch => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
          </select>

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--ads-text-muted)' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Firma, ürün, klip veya program ara..."
              className="ads-saas-input"
              style={{ paddingLeft: '30px', width: '240px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <input
            ref={fileImportRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportReservationsJson}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={handleExportReservationsJson}
            className="ads-saas-btn"
            style={{
              borderColor: 'rgba(37, 99, 235, 0.35)',
              color: '#2563eb',
              background: 'rgba(37, 99, 235, 0.08)'
            }}
            title="Bu tarayıcıdaki tüm rezervasyonları JSON yedek dosyası olarak indir (.80 adresinden indirip seyare.semerkand.com'a yükleyebilirsiniz)"
          >
            <Download size={14} /> Yedek İndir
          </button>
          <button
            type="button"
            onClick={() => fileImportRef.current && fileImportRef.current.click()}
            className="ads-saas-btn"
            style={{
              borderColor: 'rgba(217, 119, 6, 0.35)',
              color: '#d97706',
              background: 'rgba(217, 119, 6, 0.08)'
            }}
            title="İndirdiğiniz rezervasyon JSON yedek dosyasını buraya ve sunucu veritabanına yükle"
          >
            <Upload size={14} /> Yedek Yükle
          </button>
          <button
            type="button"
            onClick={handleManualServerSync}
            disabled={isServerSyncing}
            className="ads-saas-btn"
            style={{
              borderColor: 'rgba(13, 148, 136, 0.35)',
              color: '#0d9488',
              background: 'rgba(13, 148, 136, 0.08)'
            }}
            title=".80 ve seyare.semerkand.com arasındaki rezervasyonları sunucu veritabanı ile şimdi eşitle"
          >
            <RefreshCw size={14} className={isServerSyncing ? 'animate-spin' : ''} />
            {isServerSyncing ? 'Eşitleniyor...' : 'Sunucuyla Eşitle'}
          </button>
          {reservations.length > 0 && (
            <button
              type="button"
              onClick={() => {
                useDialogStore
                  .getState()
                  .showConfirm(
                    'Tüm Rezervasyonları Temizle',
                    'Listedeki tüm rezervasyon planlarını ve bağlı reklam kuşağı spotlarını silmek istediğinize emin misiniz?',
                    () => clearAllReservations && clearAllReservations()
                  );
              }}
              className="ads-saas-btn ads-saas-btn-danger"
              title="Tüm rezervasyonları ve kuşaklardaki yerleşik spotlarını sil"
            >
              <Trash2 size={14} /> Tümünü Temizle
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditingRes(null);
              setDefaultSponsorMode(true);
              setIsFormOpen(true);
            }}
            className="ads-saas-btn"
            style={{
              borderColor: 'rgba(147, 51, 234, 0.35)',
              color: '#9333ea',
              background: 'rgba(147, 51, 234, 0.08)'
            }}
          >
            <Award size={14} /> + Program Sponsorluğu Ekle
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingRes(null);
              setDefaultSponsorMode(false);
              setIsFormOpen(true);
            }}
            className="ads-saas-btn ads-saas-btn-primary"
          >
            <Plus size={14} /> Yeni Rezervasyon Planla
          </button>
        </div>
      </div>

      {/* REZERVASYONLAR TABLOSU */}
      <div className="ads-saas-table-wrap" style={{ flex: 1 }}>
        <div className="ads-saas-table-scroll">
          <table className="ads-saas-table" style={{ minWidth: '1220px' }}>
            <thead>
              <tr>
                <th style={{ width: '115px' }}>Öncelik &amp; Tür</th>
                <th style={{ width: '175px' }}>Firma</th>
                <th style={{ minWidth: '370px', textAlign: 'left', paddingLeft: '16px' }}>
                  Planlanan Ürünler, Materyaller &amp; Tarih Aralığı
                </th>
                <th style={{ width: '215px' }}>Program Sponsorluğu &amp; Konum</th>
                <th style={{ width: '180px' }}>Kanallar &amp; Kuşaklar</th>
                <th style={{ width: '145px' }}>Spot İlerlemesi</th>
                <th style={{ width: '115px' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filteredReservations.map(row => {
                const priorityInfo = getPriorityInfo(row.priority);
                const rowTimeBlocks = (row.timeBlockIds || [])
                  .map(tbId => timeBlocks.find(tb => tb.id === tbId))
                  .filter(Boolean);

                const fixedBlockEntries = Object.entries(row.timeBlockSpotCounts || {}).filter(
                  ([, cnt]) => Number(cnt) > 0
                );
                const hasFixedBlockCounts = fixedBlockEntries.length > 0;
                const fixedDailyTotal = fixedBlockEntries.reduce((s, [, cnt]) => s + (Number(cnt) || 0), 0);

                const pct = Math.min(100, Math.round((row.effectiveRealized / Math.max(1, row.totalPlanned)) * 100));

                return (
                  <tr key={row.rowKey}>
                    {/* 1. Öncelik & Tür (Yalnızca bu reklam klibinin önceliği ve sponsorluk türü) */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                        <span
                          style={{
                            background: priorityInfo.bg,
                            color: priorityInfo.color,
                            padding: '3px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '800'
                          }}
                        >
                          {priorityInfo.label}
                        </span>
                        {row.isSponsor && (
                          <span
                            style={{
                              background: 'rgba(147, 51, 234, 0.14)',
                              color: '#9333ea',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '10px',
                              fontWeight: '800',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <Award size={10} /> Sponsor
                          </span>
                        )}
                        {row.isRamadanSpecial && (
                          <span
                            style={{
                              background: 'linear-gradient(135deg, #d97706, #b45309)',
                              color: '#fff',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '10px',
                              fontWeight: '900',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            Ramazan
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 2. Firma Adı */}
                    <td>
                      <div
                        onClick={() => {
                          if (row.company && setActiveTab) {
                            usePlanningStore.getState().setSelectedCompanyDetailId(row.company.id);
                            setActiveTab('company-details');
                          }
                        }}
                        style={{
                          color: 'var(--ads-brand)',
                          cursor: 'pointer',
                          fontWeight: '800',
                          fontSize: '13px',
                          lineHeight: 1.3
                        }}
                      >
                        {row.companyName}
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                        #{String(row.reservationId).slice(0, 10)}
                        {row.siblingCount > 1 ? ` • Reklam ${row.itemIndex + 1}/${row.siblingCount}` : ''}
                      </div>
                    </td>

                    {/* 3. Tekil Reklam Klibi, Ürün ve Tarih Aralığı (Her reklam ayrı satırda) */}
                    <td style={{ textAlign: 'left', paddingLeft: '16px' }}>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          padding: '9px 12px',
                          borderRadius: '10px',
                          background: 'var(--ads-card-subtle)',
                          border: '1px solid var(--ads-border)'
                        }}
                      >
                        {/* Üst: Ürün Adı, Reklam Klibi Adı ve İzle Butonu */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <Package size={13} color="var(--ads-orange)" style={{ flexShrink: 0 }} />
                              <span style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                                {row.productName}
                              </span>
                            </div>
                            {row.material && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: 'var(--ads-text-sub)', wordBreak: 'break-all' }}>
                                <Film size={12} color="var(--ads-teal)" style={{ flexShrink: 0 }} />
                                <span style={{ fontWeight: '700' }}>
                                  {row.materialName}
                                </span>
                                <span style={{ color: 'var(--ads-text-muted)', fontWeight: '600' }}>
                                  ({row.materialDuration} sn)
                                </span>
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                            {row.material && (
                              <button
                                type="button"
                                onClick={() => setPreviewMaterial(row.material)}
                                className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                                style={{ padding: '3px 9px', fontSize: '11px' }}
                                title="Klibi İzle"
                              >
                                <Play size={11} fill="#ffffff" /> İzle
                              </button>
                            )}
                            {row.channelIds.map(cid => (
                              <span
                                key={cid}
                                style={{
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  padding: '2px 7px',
                                  borderRadius: '5px',
                                  background: cid === 'ch_hd' ? 'rgba(0, 102, 255, 0.12)' : 'rgba(139, 92, 246, 0.14)',
                                  color: cid === 'ch_hd' ? '#0066ff' : '#8b5cf6'
                                }}
                              >
                                {cid === 'ch_hd' ? 'HD' : 'WAY'}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Alt: Tarih Aralığı + Planlanan Spot / Günlük Min-Max veya Kuşak Sabit + Bütçe */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '11px',
                              fontWeight: '800',
                              padding: '3px 9px',
                              borderRadius: '6px',
                              background: 'var(--ads-pill-bar-bg)',
                              border: '1px solid var(--ads-border-strong)',
                              color: 'var(--ads-text-main)',
                              fontFamily: 'monospace'
                            }}
                          >
                            <Calendar size={11} color="var(--ads-brand)" />
                            {formatTrDate(row.startDate)} &ndash; {formatTrDate(row.endDate)}
                          </span>

                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: '800',
                              padding: '3px 9px',
                              borderRadius: '999px',
                              background: hasFixedBlockCounts ? 'rgba(217, 119, 6, 0.14)' : 'var(--ads-brand-soft)',
                              color: hasFixedBlockCounts ? '#b45309' : 'var(--ads-brand)'
                            }}
                          >
                            {hasFixedBlockCounts
                              ? `${row.totalPlanned} Spot • ${row.totalPlannedSeconds.toLocaleString('tr-TR')} sn (Kuşak Sabit: Günlük ${fixedDailyTotal})`
                              : `${row.totalPlanned} Spot • ${row.totalPlannedSeconds.toLocaleString('tr-TR')} sn (Günlük ${row.dailyMinSpots}–${row.dailyMaxSpots})`}
                          </span>

                          {row.totalBudget > 0 && (
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: '800',
                                padding: '3px 9px',
                                borderRadius: '999px',
                                background: 'rgba(13, 148, 136, 0.14)',
                                color: '#0d9488'
                              }}
                              title={`${row.perSecondPrice.toLocaleString('tr-TR')} ₺/sn | ${row.spotPrice.toLocaleString('tr-TR')} ₺/spot`}
                            >
                              {row.perSecondPrice > 0 ? `${row.perSecondPrice.toLocaleString('tr-TR')} ₺/sn • ` : ''}
                              {row.totalBudget.toLocaleString('tr-TR')} ₺
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 4. Yalnızca Bu Reklam Klibine Ait Program Sponsorluğu & Konumu */}
                    <td>
                      {row.isRamadanSpecial && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginBottom: row.isSponsor ? '6px' : 0 }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: '900',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: 'rgba(217, 119, 6, 0.14)',
                              color: '#d97706'
                            }}
                          >
                            {row.ramadanTarget === 'sahur' ? 'Ramazan Sahur' : row.ramadanTarget === 'both' ? 'Sahur & İftar' : 'Ramazan İftar'}
                          </span>
                        </div>
                      )}
                      {row.isSponsor ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: '800', fontSize: '12px', color: 'var(--ads-text-main)' }}>
                            <Tv size={13} color="#9333ea" />
                            <span>{row.sponsorProgramTitle || 'Genel Program Sponsorluğu'}</span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px' }}>
                            {row.sponsorPositions.map(posId => {
                              const pos = SPONSOR_POSITIONS.find(p => p.id === posId);
                              return pos ? (
                                <span
                                  key={posId}
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: '800',
                                    padding: '2px 7px',
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
                      ) : !row.isRamadanSpecial ? (
                        <span style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>Standart Kuşak</span>
                      ) : null}
                    </td>

                    {/* 5. Yalnızca Bu Reklam Klibinin Kanalları ve Kuşakları */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                          {row.channelIds.map(cid => (
                            <span
                              key={cid}
                              style={{
                                fontSize: '10px',
                                fontWeight: '800',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                background: cid === 'ch_hd' ? 'rgba(0, 102, 255, 0.12)' : 'rgba(139, 92, 246, 0.14)',
                                color: cid === 'ch_hd' ? '#0066ff' : '#8b5cf6'
                              }}
                            >
                              {cid === 'ch_hd' ? 'Semerkand HD' : 'Semerkand WAY'}
                            </span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '3px' }}>
                          {rowTimeBlocks.map(tb => {
                            const fixedCnt = Number(row.timeBlockSpotCounts?.[tb.id] || 0);
                            return (
                              <span
                                key={tb.id}
                                className="ads-saas-chip"
                                style={{
                                  padding: '1px 6px',
                                  fontSize: '10px',
                                  borderColor: fixedCnt > 0 ? '#d97706' : undefined,
                                  color: fixedCnt > 0 ? '#b45309' : undefined,
                                  fontWeight: fixedCnt > 0 ? '900' : undefined
                                }}
                              >
                                <Clock size={9} /> {tb.name.split(' ')[0]}{fixedCnt > 0 ? ` (${fixedCnt}x)` : ''}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </td>

                    {/* 6. Yalnızca Bu Reklam Klibinin Kendi Saniye & Spot İlerlemesi */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '135px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: '800' }}>
                          <span style={{ color: row.effectiveRealized > row.totalPlanned ? '#dc2626' : 'var(--ads-brand)' }}>
                            {row.effectiveRealized} / {row.totalPlanned} Spot
                          </span>
                          <span style={{ color: row.effectiveRealized > row.totalPlanned ? '#dc2626' : 'var(--ads-text-muted)', fontSize: '10.5px' }}>
                            %{Math.round((row.effectiveRealized / Math.max(1, row.totalPlanned)) * 100)}
                          </span>
                        </div>
                        <div style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--ads-text-sub)', fontFamily: 'monospace' }}>
                          {row.effectiveRealizedSeconds.toLocaleString('tr-TR')} / {row.totalPlannedSeconds.toLocaleString('tr-TR')} sn
                        </div>
                        <div style={{ height: '6px', background: 'var(--ads-pill-bar-bg)', borderRadius: '999px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: row.effectiveRealized > row.totalPlanned
                                ? '#dc2626'
                                : row.isSponsor
                                ? '#9333ea'
                                : 'var(--ads-brand)',
                              borderRadius: '999px'
                            }}
                          />
                        </div>
                        {row.overageInfo?.hasAnyOverage && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                            {row.overageInfo.spotNegativeBalance < 0 && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: '900',
                                  color: '#dc2626',
                                  background: 'rgba(220, 38, 38, 0.12)',
                                  padding: '2px 6px',
                                  borderRadius: '5px',
                                  textAlign: 'center'
                                }}
                              >
                                {row.overageInfo.spotNegativeBalance} Spot Aşım
                              </span>
                            )}
                            {row.overageInfo.dayNegativeBalance < 0 && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: '900',
                                  color: '#d97706',
                                  background: 'rgba(217, 119, 6, 0.14)',
                                  padding: '2px 6px',
                                  borderRadius: '5px',
                                  textAlign: 'center'
                                }}
                              >
                                {row.overageInfo.dayNegativeBalance} Gün Aşım
                              </span>
                            )}
                            {row.overageInfo.budgetNegativeBalance < 0 && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: '900',
                                  color: '#dc2626',
                                  background: 'rgba(220, 38, 38, 0.12)',
                                  padding: '2px 6px',
                                  borderRadius: '5px',
                                  textAlign: 'center'
                                }}
                              >
                                {row.overageInfo.budgetNegativeBalance.toLocaleString('tr-TR')} ₺
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 7. İşlemler */}
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (row.company && setActiveTab) {
                              usePlanningStore.getState().setSelectedCompanyDetailId(row.company.id);
                              setActiveTab('company-details');
                            }
                          }}
                          className="ads-saas-btn ads-saas-btn-sm"
                          title="Firma Karnesi"
                        >
                          <FileText size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRes(row.parentReservation);
                            setDefaultSponsorMode(Boolean(row.isSponsor));
                            setIsFormOpen(true);
                          }}
                          className="ads-saas-btn ads-saas-btn-sm"
                          title="Planı Düzenle"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRowItem(row)}
                          className="ads-saas-btn ads-saas-btn-sm"
                          style={{ color: '#ef4444' }}
                          title={row.siblingCount > 1 ? 'Bu Reklam Satırını Sil' : 'Rezervasyonu Sil'}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredReservations.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ padding: '44px', color: 'var(--ads-text-muted)' }}>
                    Seçili filtreye uygun rezervasyon planı bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFormOpen && (
        <AdsReservationForm
          onClose={() => {
            setIsFormOpen(false);
            setEditingRes(null);
          }}
          existingData={editingRes}
          defaultSponsorMode={defaultSponsorMode}
        />
      )}

      {previewMaterial && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.78)',
            backdropFilter: 'blur(8px)',
            zIndex: 11000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setPreviewMaterial(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '720px',
              background: 'var(--ads-canvas-bg)',
              border: '1px solid var(--ads-border-strong)',
              borderRadius: '18px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--ads-border)',
                background: 'var(--ads-card-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                  {previewMaterial.name}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)', marginTop: '2px', wordBreak: 'break-all' }}>
                  Tam Klip Adı: <strong style={{ color: 'var(--ads-brand)' }}>{previewMaterial.clipName || previewMaterial.name}</strong> • Süre: <strong>{previewMaterial.duration} sn</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMaterial(null)}
                className="ads-saas-btn ads-saas-btn-sm"
              >
                <X size={16} /> Kapat
              </button>
            </div>

            <div style={{ padding: '18px 20px' }}>
              <AdVideoPlayer material={previewMaterial} autoPlay={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(ReservationsTab);
