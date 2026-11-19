/**
 * @file src/pages/admin/ListsTab.jsx
 * @description Admin Paneli - Liste Yönetimi ve 4 Aşamalı Yayın Akış Pipeline Takibi.
 * - PostgreSQL (`schedules` tablosu / `/api/draftSchedule`) ve yerel yayın planlama listelerini birleştirir.
 * - Her listenin hangi aşamada olduğunu gösterir:
 *   1. Aşama: Taslak Planlama
 *   2. Aşama: Yayına Hazır (Yayın Planlama Liste A/B)
 *   3. Aşama: Reklam Rezervasyon (Spot & Kuşak Durumu)
 *   4. Aşama: Yayın Kontrol (Nihai Yayın Onayı / MCR)
 * - Tarih Seçimi (Tek Gün, Tarih Aralığı, Tümü), Kanal Filtresi ve Aşama Filtresi sunar.
 * - "Listeyi Gör" ile tüm günlük akış içeriğini modal pencerede gösterir.
 * - "Listeyi Sil" ile listeyi hem PostgreSQL veritabanından hem sistemden siler.
 */
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import usePlanningStore from '../../store/planningStore';
import useAdminLogStore from '../../store/adminLogStore';
import { dialog } from '../../store/dialogStore';
import {
  Search,
  CalendarDays,
  Tv,
  List,
  Eye,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Clock,
  Film,
  Megaphone,
  CheckSquare,
  X,
  Filter
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { formatTotalDuration } from '../../utils/timeFormat';

const STAGE_META = {
  1: {
    step: 1,
    id: 'draft',
    label: '1. Aşama: Taslak Planlama',
    shortLabel: '1. Taslak Planlama',
    color: '#2563eb',
    bg: 'rgba(37, 99, 235, 0.12)',
    icon: <CalendarDays size={13} />
  },
  2: {
    step: 2,
    id: 'ready',
    label: '2. Aşama: Yayına Hazır',
    shortLabel: '2. Yayına Hazır',
    color: '#0ea5e9',
    bg: 'rgba(14, 165, 233, 0.12)',
    icon: <Film size={13} />
  },
  3: {
    step: 3,
    id: 'ads',
    label: '3. Aşama: Reklam Rezervasyon',
    shortLabel: '3. Reklam Rezervasyon',
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.12)',
    icon: <Megaphone size={13} />
  },
  4: {
    step: 4,
    id: 'list-control',
    label: '4. Aşama: Yayın Kontrol (Nihai)',
    shortLabel: '4. Yayın Kontrol',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.14)',
    icon: <CheckSquare size={13} />
  }
};

const ListsTab = () => {
  const days = usePlanningStore(state => state.days || {});
  const listControlDays = usePlanningStore(state => state.listControlDays || {});
  const adPlacements = usePlanningStore(state => state.adPlacements || {});
  const addLog = useAdminLogStore(state => state.addLog);

  const [serverSchedules, setServerSchedules] = useState({ ch_hd: {}, ch_way: {} });
  const [isLoadingServer, setIsLoadingServer] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState('all'); // all | 1 | 2 | 3 | 4
  const [filterChannel, setFilterChannel] = useState('all'); // all | ch_hd | ch_way
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedListModal, setSelectedListModal] = useState(null);
  const itemsPerPage = 50;

  const fetchServerSchedules = useCallback(async () => {
    setIsLoadingServer(true);
    try {
      const [hdRes, wayRes] = await Promise.all([
        fetch('/api/draftSchedule?channel=ch_hd'),
        fetch('/api/draftSchedule?channel=ch_way')
      ]);
      const hdData = hdRes.ok ? await hdRes.json() : {};
      const wayData = wayRes.ok ? await wayRes.json() : {};
      setServerSchedules({
        ch_hd: hdData && typeof hdData === 'object' ? hdData : {},
        ch_way: wayData && typeof wayData === 'object' ? wayData : {}
      });
    } catch (e) {
      console.warn('Sunucu listeleri çekilemedi:', e);
    } finally {
      setIsLoadingServer(false);
    }
  }, []);

  useEffect(() => {
    fetchServerSchedules();
  }, [fetchServerSchedules]);

  // Tüm kaynaklardan (PostgreSQL schedules + Zustand days + adPlacements + listControlDays) birleşik liste haritası
  const unifiedLists = useMemo(() => {
    const map = new Map();

    const ensureEntry = (channelId, dateStr) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) return null;
      const key = `${channelId}__${dateStr}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          channelId,
          channelName: channelId === 'ch_hd' ? 'Semerkand HD' : 'Semerkand WAY',
          dateStr,
          dayName: '',
          draftPrograms: [],
          readyPrograms: [],
          adBreakCount: 0,
          placedAdSpots: 0,
          hasDraft: false,
          hasReady: false,
          hasAds: false,
          hasListControl: false,
          isStage1Locked: false,
          isStage2Locked: false,
          highestStage: 1
        });
      }
      return map.get(key);
    };

    // 1. PostgreSQL / Backend Taslak Listeleri
    ['ch_hd', 'ch_way'].forEach(chId => {
      const chMap = serverSchedules[chId] || {};
      Object.entries(chMap).forEach(([dateKey, dayObj]) => {
        const entry = ensureEntry(chId, dateKey);
        if (!entry || !dayObj) return;
        const progs = Array.isArray(dayObj.programs) ? dayObj.programs : [];
        if (progs.length > 0) {
          entry.hasDraft = true;
          entry.draftPrograms = progs;
        }
        if (dayObj.dayName) entry.dayName = dayObj.dayName;
        if (dayObj.isStage1Locked) entry.isStage1Locked = true;
        if (dayObj.isStage2Locked) entry.isStage2Locked = true;
      });
    });

    // 2. Zustand `days` (draft-* ve ready-*)
    Object.entries(days).forEach(([storageKey, dayData]) => {
      const parts = storageKey.split('-');
      if (parts.length < 5) return;
      const mode = parts[0]; // 'draft' | 'ready'
      const channelId = parts[1];
      const dateStr = parts.slice(2).join('-');
      const entry = ensureEntry(channelId, dateStr);
      if (!entry || !dayData) return;

      const activeVar = dayData.activeVariant || 'v1';
      const variantProgs = dayData.variants?.[activeVar]?.programs || dayData.variants?.v1?.programs || [];

      if (mode === 'draft' && variantProgs.length > 0) {
        entry.hasDraft = true;
        if (entry.draftPrograms.length === 0) entry.draftPrograms = variantProgs;
      }
      if (mode === 'ready' && variantProgs.length > 0) {
        entry.hasReady = true;
        entry.readyPrograms = variantProgs;
      }
      if (dayData.isLockedForStage1) entry.isStage1Locked = true;
      if (dayData.isReadyForBroadcast) {
        entry.hasReady = true;
        entry.isStage2Locked = true;
      }
    });

    // 3. Reklam Rezervasyon Yerleşimleri (`adPlacements`)
    Object.entries(adPlacements).forEach(([placementKey, blocks]) => {
      if (!Array.isArray(blocks) || blocks.length === 0) return;
      const match = placementKey.match(/(ch_hd|ch_way).*?(\d{4}-\d{2}-\d{2})/);
      const channelId = match ? match[1] : 'ch_hd';
      const dateStr = match ? match[2] : (/^\d{4}-\d{2}-\d{2}$/.test(placementKey) ? placementKey : null);
      if (!dateStr) return;
      const entry = ensureEntry(channelId, dateStr);
      if (!entry) return;
      let spots = 0;
      blocks.forEach(b => {
        spots += Array.isArray(b.ads) ? b.ads.length : 0;
      });
      if (spots > 0) {
        entry.hasAds = true;
        entry.adBreakCount = blocks.length;
        entry.placedAdSpots = spots;
      }
    });

    // 4. Yayın Kontrol (`listControlDays`)
    Object.entries(listControlDays).forEach(([lcKey, lcObj]) => {
      const match = lcKey.match(/(ch_hd|ch_way).*?(\d{4}-\d{2}-\d{2})/);
      if (!match || !lcObj) return;
      const entry = ensureEntry(match[1], match[2]);
      if (!entry) return;
      entry.hasListControl = true;
      if (lcObj.isLockedForStage2) entry.isStage2Locked = true;
    });

    // Her listenin aktif program listesini, toplam süresini ve bulunduğu en üst aşamayı hesapla
    return Array.from(map.values())
      .map(item => {
        const activePrograms = item.readyPrograms.length > 0 ? item.readyPrograms : item.draftPrograms;
        const totalPrograms = activePrograms.length;
        const totalDuration = activePrograms.reduce((sum, p) => sum + (Number(p.duration) || 30), 0);

        let highestStage = 1;
        if (item.hasReady || item.isStage1Locked) highestStage = 2;
        if (item.hasAds) highestStage = 3;
        if (item.hasListControl || item.isStage2Locked) highestStage = 4;

        return {
          ...item,
          activePrograms,
          totalPrograms,
          totalDuration,
          highestStage
        };
      })
      .filter(item => item.totalPrograms > 0)
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [serverSchedules, days, adPlacements, listControlDays]);

  // Aşama bazlı özet sayaçlar
  const stageCounts = useMemo(() => {
    const counts = { all: unifiedLists.length, 1: 0, 2: 0, 3: 0, 4: 0 };
    unifiedLists.forEach(item => {
      counts[item.highestStage] = (counts[item.highestStage] || 0) + 1;
    });
    return counts;
  }, [unifiedLists]);

  // Filtreleme (Kanal, Aşama, Tarih Aralığı, Arama)
  const filteredLists = useMemo(() => {
    return unifiedLists.filter(list => {
      if (filterChannel !== 'all' && list.channelId !== filterChannel) return false;
      if (filterStage !== 'all' && Number(list.highestStage) !== Number(filterStage)) return false;
      if (startDate && list.dateStr < startDate) return false;
      if (endDate && list.dateStr > endDate) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLocaleLowerCase('tr-TR');
        const progTitles = (list.activePrograms || []).map(p => p.title || p.name || '').join(' ');
        const hay = `${list.channelName} ${list.dateStr} ${list.dayName} ${progTitles}`.toLocaleLowerCase('tr-TR');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [unifiedLists, filterChannel, filterStage, startDate, endDate, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredLists.length / itemsPerPage));
  const currentData = filteredLists.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStage, filterChannel, startDate, endDate]);

  // LİSTE SİLME (Hem PostgreSQL hem yerel store'dan siler)
  const handleDeleteList = async (list) => {
    const formattedDate = (() => {
      try {
        return format(parseISO(list.dateStr), 'd MMMM yyyy, EEEE', { locale: tr });
      } catch {
        return list.dateStr;
      }
    })();

    const ok = await dialog.confirm(
      'Yayın Listesini Sil',
      `${list.channelName} — ${formattedDate} (${list.totalPrograms} program / kuşak) tarihli yayın listesini kalıcı olarak silmek istediğinize emin misiniz?`,
      { confirmText: 'Evet, Listeyi Sil', isDestructive: true }
    );
    if (!ok) return;

    try {
      await fetch(`/api/draftSchedule?channel=${encodeURIComponent(list.channelId)}&dateKey=${encodeURIComponent(list.dateStr)}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.warn('Sunucudan silme hatası:', e);
    }

    // Zustand store'dan da kaldır
    usePlanningStore.setState(state => {
      const nextDays = { ...(state.days || {}) };
      delete nextDays[`draft-${list.channelId}-${list.dateStr}`];
      delete nextDays[`ready-${list.channelId}-${list.dateStr}`];

      const nextLc = { ...(state.listControlDays || {}) };
      delete nextLc[`list-control-${list.channelId}-${list.dateStr}`];

      return { days: nextDays, listControlDays: nextLc };
    });

    setServerSchedules(prev => {
      const nextCh = { ...(prev[list.channelId] || {}) };
      delete nextCh[list.dateStr];
      return { ...prev, [list.channelId]: nextCh };
    });

    if (selectedListModal?.key === list.key) {
      setSelectedListModal(null);
    }

    addLog({
      category: 'lists',
      panel: 'lists',
      module: 'Liste Yönetimi',
      action: 'Yayın Listesi Silindi',
      details: `${list.channelName} — ${list.dateStr} (${list.totalPrograms} program) listesi veritabanından ve sistemden silindi.`,
      target: `${list.channelName} ${list.dateStr}`,
      count: list.totalPrograms,
      status: 'warning'
    });
  };

  const formatDateLabel = (dateStr) => {
    try {
      return format(parseISO(dateStr), 'd MMMM yyyy, EEEE', { locale: tr });
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ÜST BAŞLIK & YENİLEME */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '18px 22px',
        borderRadius: '16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)'
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <List size={20} color="var(--accent-primary)" />
            Liste Yönetimi &amp; 4 Aşamalı Yayın Süreci Takibi
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Hangi listenin hangi aşamada olduğunu (Taslak → Yayına Hazır → Reklam Rezervasyon → Yayın Kontrol) tarih seçerek görüntüleyin, içeriğini inceleyin veya silin.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchServerSchedules}
          disabled={isLoadingServer}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 14px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '12.5px',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={14} /> {isLoadingServer ? 'Yükleniyor...' : 'PostgreSQL Listelerini Yenile'}
        </button>
      </div>

      {/* 4 AŞAMA PIPELINE ÖZET KARTLARI */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))',
        gap: '12px'
      }}>
        <button
          type="button"
          onClick={() => setFilterStage('all')}
          style={{
            padding: '14px 16px',
            borderRadius: '14px',
            border: filterStage === 'all' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
            background: filterStage === 'all' ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-secondary)',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Tüm Kayıtlı Listeler</span>
          <span style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>{stageCounts.all} Günlük Liste</span>
        </button>

        {Object.values(STAGE_META).map(st => {
          const isSelected = Number(filterStage) === st.step;
          return (
            <button
              key={st.step}
              type="button"
              onClick={() => setFilterStage(isSelected ? 'all' : String(st.step))}
              style={{
                padding: '14px 16px',
                borderRadius: '14px',
                border: isSelected ? `2px solid ${st.color}` : '1px solid var(--border-color)',
                borderLeft: `4px solid ${st.color}`,
                background: isSelected ? st.bg : 'var(--bg-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: st.color }}>
                {st.icon}
                <span>{st.shortLabel}</span>
              </div>
              <span style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>
                {stageCounts[st.step] || 0} Liste
              </span>
            </button>
          );
        })}
      </div>

      {/* FİLTRE ÇUBUĞU: TARİH ARALIĞI + KANAL + AŞAMA + ARAMA */}
      <div style={{
        padding: '14px 18px',
        borderRadius: '14px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Arama */}
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '340px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Tarih, gün, kanal veya program adı ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 34px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              fontSize: '12.5px',
              outline: 'none'
            }}
          />
        </div>

        {/* Tarih Seçimi (Başlangıç - Bitiş) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CalendarDays size={14} color="var(--accent-primary)" /> Tarih Seçimi:
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            title="Başlangıç Tarihi"
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600
            }}
          />
          <span style={{ color: 'var(--text-muted)' }}>—</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            title="Bitiş Tarihi"
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600
            }}
          />
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '7px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Tarihi Temizle
            </button>
          )}
        </div>

        {/* Kanal & Aşama Seçimi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select
            value={filterChannel}
            onChange={e => setFilterChannel(e.target.value)}
            style={{
              padding: '8px 12px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 700,
              outline: 'none'
            }}
          >
            <option value="all">Tüm Kanallar</option>
            <option value="ch_hd">Semerkand HD</option>
            <option value="ch_way">Semerkand WAY</option>
          </select>

          <select
            value={filterStage}
            onChange={e => setFilterStage(e.target.value)}
            style={{
              padding: '8px 12px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 700,
              outline: 'none'
            }}
          >
            <option value="all">Tüm Aşamalar ({stageCounts.all})</option>
            <option value="1">1. Aşama: Taslak Planlama ({stageCounts[1]})</option>
            <option value="2">2. Aşama: Yayına Hazır ({stageCounts[2]})</option>
            <option value="3">3. Aşama: Reklam Rezervasyon ({stageCounts[3]})</option>
            <option value="4">4. Aşama: Yayın Kontrol ({stageCounts[4]})</option>
          </select>
        </div>
      </div>

      {/* LİSTE TABLOSU */}
      <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', fontSize: '12px' }}>
              <th style={{ padding: '14px 16px', fontWeight: '800', color: 'var(--text-secondary)' }}>Kanal</th>
              <th style={{ padding: '14px 16px', fontWeight: '800', color: 'var(--text-secondary)' }}>Yayın Tarihi</th>
              <th style={{ padding: '14px 16px', fontWeight: '800', color: 'var(--text-secondary)' }}>Bulunduğu Aşama &amp; Süreç Adımları</th>
              <th style={{ padding: '14px 16px', fontWeight: '800', color: 'var(--text-secondary)', textAlign: 'center' }}>Program / Kuşak</th>
              <th style={{ padding: '14px 16px', fontWeight: '800', color: 'var(--text-secondary)', textAlign: 'center' }}>Toplam Süre</th>
              <th style={{ padding: '14px 16px', fontWeight: '800', color: 'var(--text-secondary)', textAlign: 'right' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {currentData.map((list) => {
              const stageMeta = STAGE_META[list.highestStage] || STAGE_META[1];
              return (
                <tr
                  key={list.key}
                  style={{ borderBottom: '1px solid var(--border-color)', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        background: list.channelId === 'ch_hd' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(139, 92, 246, 0.12)',
                        color: list.channelId === 'ch_hd' ? '#3b82f6' : '#8b5cf6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Tv size={17} />
                      </div>
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '13.5px', color: 'var(--text-primary)' }}>
                          {list.channelName}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {list.dateStr}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px', color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13.5px' }}>
                      <CalendarDays size={15} color="var(--accent-primary)" />
                      <span>{formatDateLabel(list.dateStr)}</span>
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '11.5px',
                          fontWeight: 800,
                          background: stageMeta.bg,
                          color: stageMeta.color,
                          border: `1px solid ${stageMeta.color}40`
                        }}>
                          {stageMeta.icon}
                          {stageMeta.label}
                        </span>

                        {list.placedAdSpots > 0 && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 800,
                            background: 'rgba(217, 119, 6, 0.14)',
                            color: '#d97706'
                          }}>
                            {list.placedAdSpots} Reklam Spotu
                          </span>
                        )}
                      </div>

                      {/* 4 Aşamalı İlerleme Çubuğu */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', maxWidth: '280px' }}>
                        {[1, 2, 3, 4].map(stepNum => {
                          const reached = list.highestStage >= stepNum;
                          const st = STAGE_META[stepNum];
                          return (
                            <div
                              key={stepNum}
                              title={st.label}
                              style={{
                                flex: 1,
                                height: '5px',
                                borderRadius: '999px',
                                background: reached ? st.color : 'var(--border-color)'
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <span style={{
                      fontSize: '15px',
                      fontWeight: '800',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {list.totalPrograms}
                    </span>
                  </td>

                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {formatTotalDuration(list.totalDuration)}
                    </span>
                  </td>

                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedListModal(list)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '7px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(37, 99, 235, 0.35)',
                          background: 'rgba(37, 99, 235, 0.1)',
                          color: 'var(--accent-primary)',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        <Eye size={14} /> Listeyi Gör
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteList(list)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '7px 11px',
                          borderRadius: '8px',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                        title="Bu listeyi kalıcı olarak sil"
                      >
                        <Trash2 size={14} /> Sil
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {currentData.length === 0 && (
              <tr>
                <td colSpan="6" style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Seçili tarih veya filtre kriterlerine uygun yayın listesi bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SAYFALAMA */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            style={{ padding: '8px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}
          >
            Önceki
          </button>
          <span style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
            Sayfa <strong style={{ color: 'var(--text-primary)' }}>{currentPage}</strong> / {totalPages} (Toplam {filteredLists.length} liste)
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            style={{ padding: '8px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}
          >
            Sonraki
          </button>
        </div>
      )}

      {/* LİSTE İÇERİĞİ GÖRÜNTÜLEME MODALI ("Listeyi Gör") */}
      {selectedListModal && (
        <div
          onClick={() => setSelectedListModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '880px',
              maxHeight: '88vh',
              borderRadius: '18px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Modal Başlık */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              background: 'var(--bg-tertiary)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {selectedListModal.channelName} — {formatDateLabel(selectedListModal.dateStr)}
                  </h3>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    background: STAGE_META[selectedListModal.highestStage]?.bg,
                    color: STAGE_META[selectedListModal.highestStage]?.color
                  }}>
                    {STAGE_META[selectedListModal.highestStage]?.label}
                  </span>
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Toplam {selectedListModal.totalPrograms} Program / Kuşak • Toplam Süre: {formatTotalDuration(selectedListModal.totalDuration)}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleDeleteList(selectedListModal)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 13px',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={14} /> Bu Listeyi Sil
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedListModal(null)}
                  style={{
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Program Tablosu */}
            <div style={{ overflowY: 'auto', padding: '18px 24px', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '11.5px' }}>
                    <th style={{ padding: '10px 8px' }}>#</th>
                    <th style={{ padding: '10px 8px' }}>Saat</th>
                    <th style={{ padding: '10px 8px' }}>Program / Kuşak Adı</th>
                    <th style={{ padding: '10px 8px' }}>Kategori / Tür</th>
                    <th style={{ padding: '10px 8px' }}>Bölüm / Konu</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Süre</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedListModal.activePrograms || []).map((prog, idx) => (
                    <tr
                      key={prog.instanceId || prog.id || idx}
                      style={{ borderBottom: '1px solid var(--border-color)' }}
                    >
                      <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 700 }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-primary)' }}>
                        {prog.startTime || prog.time || '—'}
                      </td>
                      <td style={{ padding: '10px 8px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {prog.title || prog.name || prog.rawTitle || 'İsimsiz Kuşak'}
                      </td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>
                        {prog.category || (prog.isKisaSlot ? 'Dolgu Kuşağı' : 'Program')}
                      </td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>
                        {prog.episodeNumber ? `Bölüm ${prog.episodeNumber}` : (prog.topic || prog.host || '—')}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {prog.duration || 30} dk
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListsTab;
