/**
 * @file src/components/Ads/ReservationsTab.jsx
 * @description Yenilenmiş Modern SaaS Temalı Reklam Rezervasyonları ve Çoklu Ürün / Sponsorluk Yönetim Ekranı.
 */
import React, { useState, useMemo } from 'react';
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
  X
} from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
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
    removeReservation,
    clearAllReservations
  } = usePlanningStore();

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

  const getPriorityInfo = (val) => PRIORITIES[String(val)] || PRIORITIES['700'];

  // Her rezervasyonun zenginleştirilmiş görünüm verisi
  const enrichedReservations = useMemo(() => {
    return reservations.map(res => {
      const items =
        Array.isArray(res.items) && res.items.length > 0
          ? res.items
          : res.companyId
          ? [
              {
                companyId: res.companyId,
                productId: res.productId,
                materialId: res.materialId,
                startDate: res.startDate,
                endDate: res.endDate,
                plannedSpots: res.totalPlannedSpots
              }
            ]
          : [];

      const firstItem = items[0] || {};
      const company = companies.find(c => String(c.id) === String(res.companyId || firstItem.companyId));

      let realizedCount = Number(res.realizedSpots) || 0;
      let placedCount = 0;
      Object.values(adPlacements).forEach(blocks => {
        (blocks || []).forEach(block => {
          (block.ads || []).forEach(ad => {
            if (String(ad.reservationId) === String(res.id)) {
              placedCount++;
            }
          });
        });
      });

      const effectiveRealized = Math.max(realizedCount, placedCount);
      const totalPlanned =
        Number(res.totalPlannedSpots) ||
        items.reduce((sum, it) => sum + (Number(it.plannedSpots) || 0), 0) ||
        20;

      const isRamadanSpecial = Boolean(res.isRamadanSpecial || items.some(it => it.isRamadanSpecial));
      const overageInfo = calculateItemOverageMetrics(
        {
          ...res,
          plannedSpots: totalPlanned,
          dailyMinSpots: res.dailyMinSpots || firstItem.dailyMinSpots || 1,
          dailyMaxSpots: res.dailyMaxSpots || firstItem.dailyMaxSpots || 4,
          spotPrice: res.spotPrice || firstItem.spotPrice || 0,
          totalBudget: res.toplamTutar || firstItem.totalBudget || 0,
          isRamadanSpecial
        },
        effectiveRealized,
        ramadanConfig
      );

      return {
        ...res,
        items,
        company,
        companyName: company?.name || '-',
        effectiveRealized,
        totalPlanned,
        isRamadanSpecial,
        overageInfo
      };
    });
  }, [reservations, companies, adPlacements, ramadanConfig]);

  // Filtrelenmiş rezervasyonlar
  const filteredReservations = useMemo(() => {
    return enrichedReservations.filter(res => {
      if (typeFilter === 'sponsor' && !res.isSponsor) return false;
      if (typeFilter === 'standard' && (res.isSponsor || res.isRamadanSpecial)) return false;
      if (typeFilter === 'ramadan' && !res.isRamadanSpecial) return false;
      if (typeFilter === 'overage' && !res.overageInfo?.hasAnyOverage) return false;
      if (typeFilter === 'multi' && (res.items?.length || 0) < 2) return false;

      if (
        channelFilter !== 'all' &&
        !(res.channelIds || []).includes(channelFilter) &&
        !(res.items || []).some(it => (it.channelIds || []).includes(channelFilter))
      ) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLocaleLowerCase('tr-TR');
        const productNames = (res.items || [])
          .map(it => products.find(p => String(p.id) === String(it.productId))?.name || '')
          .join(' ');
        const materialNames = (res.items || [])
          .map(it => materials.find(m => String(m.id) === String(it.materialId))?.name || '')
          .join(' ');
        const hay = `${res.companyName} ${res.name || ''} ${res.sponsorProgramTitle || ''} ${productNames} ${materialNames}`.toLocaleLowerCase('tr-TR');
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [enrichedReservations, typeFilter, channelFilter, searchTerm, products, materials]);

  // KPI özet istatistikleri
  const kpiStats = useMemo(() => {
    const totalRes = enrichedReservations.length;
    const sponsorCount = enrichedReservations.filter(r => r.isSponsor).length;
    const ramadanCount = enrichedReservations.filter(r => r.isRamadanSpecial).length;
    const overageCount = enrichedReservations.filter(r => r.overageInfo?.hasAnyOverage).length;
    const totalProductPlans = enrichedReservations.reduce((acc, r) => acc + (r.items?.length || 1), 0);
    const totalPlannedSpots = enrichedReservations.reduce((acc, r) => acc + r.totalPlanned, 0);
    const totalRealizedSpots = enrichedReservations.reduce((acc, r) => acc + r.effectiveRealized, 0);

    return {
      totalRes,
      sponsorCount,
      ramadanCount,
      overageCount,
      totalProductPlans,
      totalPlannedSpots,
      totalRealizedSpots
    };
  }, [enrichedReservations]);

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
              { id: 'all', label: `Tümü (${enrichedReservations.length})` },
              { id: 'standard', label: 'Standart Kuşak' },
              { id: 'sponsor', label: `Sponsorluklar (${kpiStats.sponsorCount})` },
              { id: 'ramadan', label: `🌙 Ramazan Özel (${kpiStats.ramadanCount})` },
              { id: 'overage', label: `⚠️ Aşımlı (- Fark) (${kpiStats.overageCount})` },
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              {filteredReservations.map(res => {
                const priorityInfo = getPriorityInfo(res.priority);
                const resTimeBlocks = (res.timeBlockIds || [])
                  .map(tbId => timeBlocks.find(tb => tb.id === tbId))
                  .filter(Boolean);

                const pct = Math.min(100, Math.round((res.effectiveRealized / Math.max(1, res.totalPlanned)) * 100));

                return (
                  <tr key={res.id}>
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
                        {res.isSponsor && (
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
                        {res.isRamadanSpecial && (
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
                            🌙 Ramazan
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div
                        onClick={() => {
                          if (res.company && setActiveTab) {
                            usePlanningStore.getState().setSelectedCompanyDetailId(res.company.id);
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
                        {res.companyName}
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                        #{String(res.id).slice(0, 10)}
                      </div>
                    </td>

                    {/* Aynı Firmaya Ait Birden Fazla Ürün, Kanal, Kuşak, Tarih ve Ücret Planı */}
                    <td style={{ textAlign: 'left', paddingLeft: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {res.items.map((it, idx) => {
                          const p = products.find(x => String(x.id) === String(it.productId));
                          const m = materials.find(x => String(x.id) === String(it.materialId));
                          const itemStart = it.startDate || res.startDate;
                          const itemEnd = it.endDate || res.endDate;
                          const itemSpots = it.plannedSpots || res.totalPlanned;
                          const itemChannels =
                            Array.isArray(it.channelIds) && it.channelIds.length > 0
                              ? it.channelIds
                              : res.channelIds || ['ch_hd'];
                          const itemBudget =
                            Number(it.totalBudget) > 0
                              ? Number(it.totalBudget)
                              : Number(it.spotPrice) > 0
                              ? Number(it.spotPrice) * Number(itemSpots)
                              : 0;

                          return (
                            <div
                              key={it.id || idx}
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
                              {/* 1. Satır: Ürün Adı, Klip Tam Adı ve İzle Butonu */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <Package size={13} color="var(--ads-orange)" style={{ flexShrink: 0 }} />
                                    <span style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                                      {p ? p.name : 'Ürün'}
                                    </span>
                                  </div>
                                  {m && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: 'var(--ads-text-sub)', wordBreak: 'break-all' }}>
                                      <Film size={12} color="var(--ads-teal)" style={{ flexShrink: 0 }} />
                                      <span style={{ fontWeight: '700' }}>
                                        {m.clipName || m.name}
                                      </span>
                                      <span style={{ color: 'var(--ads-text-muted)', fontWeight: '600' }}>
                                        ({m.duration} sn)
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                  {m && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewMaterial(m)}
                                      className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                                      style={{ padding: '3px 9px', fontSize: '11px' }}
                                      title="Klibi İzle"
                                    >
                                      <Play size={11} fill="#ffffff" /> İzle
                                    </button>
                                  )}
                                  {itemChannels.map(cid => (
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

                              {/* 2. Satır: Belirgin Tarih Aralığı Rozeti + Planlanan Spot & Günlük Min/Max + Bütçe */}
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
                                  {formatTrDate(itemStart)} &ndash; {formatTrDate(itemEnd)}
                                </span>

                                <span
                                  style={{
                                    fontSize: '10.5px',
                                    fontWeight: '800',
                                    padding: '3px 9px',
                                    borderRadius: '999px',
                                    background: 'var(--ads-brand-soft)',
                                    color: 'var(--ads-brand)'
                                  }}
                                >
                                  {itemSpots} Spot (Günlük {it.dailyMinSpots || res.dailyMinSpots || 1}–{it.dailyMaxSpots || res.dailyMaxSpots || 4})
                                </span>

                                {itemBudget > 0 && (
                                  <span
                                    style={{
                                      fontSize: '10.5px',
                                      fontWeight: '800',
                                      padding: '3px 9px',
                                      borderRadius: '999px',
                                      background: 'rgba(13, 148, 136, 0.14)',
                                      color: '#0d9488'
                                    }}
                                  >
                                    {itemBudget.toLocaleString('tr-TR')} ₺
                                  </span>
                                )}

                                {it.isSponsor && it.sponsorProgramTitle && (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '10.5px',
                                      fontWeight: '800',
                                      padding: '3px 9px',
                                      borderRadius: '999px',
                                      background: 'rgba(147, 51, 234, 0.14)',
                                      color: '#9333ea'
                                    }}
                                  >
                                    <Award size={11} />
                                    {it.sponsorProgramTitle} (
                                    {(it.sponsorPositions || [])
                                      .map(posId => SPONSOR_POSITIONS.find(sp => sp.id === posId)?.shortLabel)
                                      .filter(Boolean)
                                      .join(', ')}
                                    )
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    {/* Program Sponsorluğu & Konumu */}
                    <td>
                      {res.isRamadanSpecial && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginBottom: res.isSponsor ? '6px' : 0 }}>
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
                            {res.ramadanTarget === 'sahur' ? '🌙 Ramazan Sahur' : res.ramadanTarget === 'both' ? '🌙+🕌 Sahur & İftar' : '🕌 Ramazan İftar'}
                          </span>
                        </div>
                      )}
                      {res.isSponsor ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: '800', fontSize: '12px', color: 'var(--ads-text-main)' }}>
                            <Tv size={13} color="#9333ea" />
                            <span>{res.sponsorProgramTitle || 'Genel Program Sponsorluğu'}</span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px' }}>
                            {(res.sponsorPositions && res.sponsorPositions.length > 0
                              ? res.sponsorPositions
                              : ['before', 'after']
                            ).map(posId => {
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
                      ) : !res.isRamadanSpecial ? (
                        <span style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>Standart Kuşak</span>
                      ) : null}
                    </td>

                    {/* Kanallar ve Kuşaklar */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                          {(res.channelIds || ['ch_hd']).map(cid => (
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
                          {resTimeBlocks.map(tb => (
                            <span key={tb.id} className="ads-saas-chip" style={{ padding: '1px 6px', fontSize: '10px' }}>
                              <Clock size={9} /> {tb.name.split(' ')[0]}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>

                    {/* Spot İlerlemesi & Eksi (-) Aşım Gösterimi */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '125px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: '800' }}>
                          <span style={{ color: res.effectiveRealized > res.totalPlanned ? '#dc2626' : 'var(--ads-brand)' }}>
                            {res.effectiveRealized} / {res.totalPlanned}
                          </span>
                          <span style={{ color: res.effectiveRealized > res.totalPlanned ? '#dc2626' : 'var(--ads-text-muted)', fontSize: '10.5px' }}>
                            %{Math.round((res.effectiveRealized / Math.max(1, res.totalPlanned)) * 100)}
                          </span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--ads-pill-bar-bg)', borderRadius: '999px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: res.effectiveRealized > res.totalPlanned
                                ? '#dc2626'
                                : res.isSponsor
                                ? '#9333ea'
                                : 'var(--ads-brand)',
                              borderRadius: '999px'
                            }}
                          />
                        </div>
                        {res.overageInfo?.hasAnyOverage && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                            {res.overageInfo.spotNegativeBalance < 0 && (
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
                                {res.overageInfo.spotNegativeBalance} Spot Aşım
                              </span>
                            )}
                            {res.overageInfo.dayNegativeBalance < 0 && (
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
                                {res.overageInfo.dayNegativeBalance} Gün Aşım
                              </span>
                            )}
                            {res.overageInfo.budgetNegativeBalance < 0 && (
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
                                {res.overageInfo.budgetNegativeBalance.toLocaleString('tr-TR')} ₺
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* İşlemler */}
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (res.company && setActiveTab) {
                              usePlanningStore.getState().setSelectedCompanyDetailId(res.company.id);
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
                            setEditingRes(res);
                            setDefaultSponsorMode(Boolean(res.isSponsor));
                            setIsFormOpen(true);
                          }}
                          className="ads-saas-btn ads-saas-btn-sm"
                          title="Planı Düzenle"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(res.id)}
                          className="ads-saas-btn ads-saas-btn-sm"
                          style={{ color: '#ef4444' }}
                          title="Sil"
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
