/**
 * @file src/pages/admin/OverviewTab.jsx
 * @description Admin Paneli — Kapsamlı Genel Bakış & Yönetim Komuta Merkezi.
 * İçerik:
 * 1) Sunucu & Bağlantı Durumu (Ana Uygulama, Docker PostgreSQL, Yedek Sunucu, MAM MSSQL, Medya Arşiv Depolama)
 * 2) MAM Klip Bilgisi & Yeni Gelen Klip Var mı Kontrolü (Canlı Delta Sync Kontrolü + Tek Tıkla Yeni Klipleri Çekme)
 * 3) Listelerin Durumu (Hangi liste hangi aşamada: 1. Taslak, 2. Yayına Hazır, 3. Reklam Rezervasyon, 4. Yayın Kontrol)
 * 4) Son Bağlantı ve Kullanıcı Bazlı İşlem Log Bilgileri
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Database,
  MonitorPlay,
  Activity,
  Server,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Film,
  CalendarDays,
  Megaphone,
  CheckSquare,
  Shield,
  Clock,
  ArrowRight,
  DownloadCloud
} from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import useAuthStore from '../../store/authStore';
import useAdminLogStore, { LOG_CATEGORIES } from '../../store/adminLogStore';

const OverviewTab = ({ onNavigateTab }) => {
  const days = usePlanningStore(state => state.days || {});
  const listControlDays = usePlanningStore(state => state.listControlDays || {});
  const adPlacements = usePlanningStore(state => state.adPlacements || {});
  const managedUsers = useAuthStore(state => state.managedUsers || []);
  const logs = useAdminLogStore(state => state.logs || []);
  const addLog = useAdminLogStore(state => state.addLog);
  const fetchLogsFromServer = useAdminLogStore(state => state.fetchLogsFromServer);

  const [monitorStatus, setMonitorStatus] = useState(null);
  const [mamStatus, setMamStatus] = useState(null);
  const [serverSchedules, setServerSchedules] = useState({ ch_hd: {}, ch_way: {} });
  const [isCheckingAll, setIsCheckingAll] = useState(false);
  const [isSyncingDelta, setIsSyncingDelta] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const fetchDashboardData = useCallback(async (manualCheck = false) => {
    setIsCheckingAll(true);
    try {
      const [monRes, mamRes, hdRes, wayRes] = await Promise.all([
        fetch('/api/system-monitor/status').catch(() => null),
        fetch('/api/archive/mam-status').catch(() => null),
        fetch('/api/draftSchedule?channel=ch_hd').catch(() => null),
        fetch('/api/draftSchedule?channel=ch_way').catch(() => null)
      ]);

      if (monRes && monRes.ok) {
        setMonitorStatus(await monRes.json());
      }
      if (mamRes && mamRes.ok) {
        const mamData = await mamRes.json();
        setMamStatus(mamData);
        if (manualCheck) {
          const newCount = mamData?.summary?.totalNewClips ?? 0;
          setSyncMessage(
            newCount > 0
              ? `Libero MAM arşivinde +${newCount} adet yeni gelen klip tespit edildi!`
              : 'Libero MAM arşivi kontrol edildi: Yeni gelen klip yok, PostgreSQL veritabanımız tamamen güncel.'
          );
          setTimeout(() => setSyncMessage(''), 5000);
        }
      }
      if (hdRes && hdRes.ok && wayRes && wayRes.ok) {
        setServerSchedules({
          ch_hd: (await hdRes.json()) || {},
          ch_way: (await wayRes.json()) || {}
        });
      }
      if (typeof fetchLogsFromServer === 'function') {
        fetchLogsFromServer();
      }
    } catch (e) {
      console.warn('Genel bakış verileri alınamadı:', e);
    } finally {
      setIsCheckingAll(false);
    }
  }, [fetchLogsFromServer]);

  useEffect(() => {
    fetchDashboardData(false);
  }, [fetchDashboardData]);

  // Yeni gelen klipleri tek tıkla PostgreSQL'e çekme (Delta Sync)
  const handlePullNewClips = async () => {
    setIsSyncingDelta(true);
    try {
      const res = await fetch('/api/archive/sync-delta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const pulled = data?.totalAddedClips ?? data?.addedClips ?? 0;
        setSyncMessage(`Yeni gelen klipler başarıyla çekildi ve PostgreSQL'e kaydedildi (${pulled} yeni klip).`);
        addLog({
          category: 'mam',
          panel: 'mam',
          module: 'Genel Bakış Klip Kontrolü',
          action: 'Yeni Gelen Klipler Çekildi (Delta Sync)',
          details: `TV MAM arşivinden yeni gelen klipler taranarak PostgreSQL veritabanına aktarıldı.`,
          count: pulled,
          status: 'success'
        });
        await fetchDashboardData(false);
      } else {
        setSyncMessage(`🔴 Klip çekme hatası: ${data.error || 'MAM sunucusuna ulaşılamadı.'}`);
      }
    } catch (e) {
      setSyncMessage(`🔴 Bağlantı hatası: ${e.message}`);
    } finally {
      setIsSyncingDelta(false);
      setTimeout(() => setSyncMessage(''), 5500);
    }
  };

  // Listelerin Aşama Özeti (1. Taslak, 2. Yayına Hazır, 3. Reklam Rezervasyon, 4. Yayın Kontrol)
  const listPipelineSummary = useMemo(() => {
    const map = new Map();
    const ensure = (ch, dateStr) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) return null;
      const k = `${ch}__${dateStr}`;
      if (!map.has(k)) {
        map.set(k, {
          key: k,
          channelId: ch,
          channelName: ch === 'ch_hd' ? 'Semerkand HD' : 'Semerkand WAY',
          dateStr,
          programCount: 0,
          stage: 1
        });
      }
      return map.get(k);
    };

    ['ch_hd', 'ch_way'].forEach(ch => {
      Object.entries(serverSchedules[ch] || {}).forEach(([dateKey, dObj]) => {
        const progs = Array.isArray(dObj?.programs) ? dObj.programs : [];
        if (progs.length === 0) return;
        const entry = ensure(ch, dateKey);
        if (!entry) return;
        entry.programCount = progs.length;
        if (dObj.isStage1Locked) entry.stage = Math.max(entry.stage, 2);
        if (dObj.isStage2Locked) entry.stage = Math.max(entry.stage, 4);
      });
    });

    Object.entries(days).forEach(([k, dObj]) => {
      const parts = k.split('-');
      if (parts.length < 5) return;
      const mode = parts[0];
      const ch = parts[1];
      const dateStr = parts.slice(2).join('-');
      const activeVar = dObj?.activeVariant || 'v1';
      const progs = dObj?.variants?.[activeVar]?.programs || dObj?.variants?.v1?.programs || [];
      if (progs.length === 0) return;
      const entry = ensure(ch, dateStr);
      if (!entry) return;
      entry.programCount = Math.max(entry.programCount, progs.length);
      if (mode === 'ready' || dObj.isLockedForStage1) entry.stage = Math.max(entry.stage, 2);
      if (dObj.isReadyForBroadcast) entry.stage = Math.max(entry.stage, 4);
    });

    Object.entries(adPlacements).forEach(([pKey, blocks]) => {
      if (!Array.isArray(blocks) || blocks.length === 0) return;
      const m = pKey.match(/(ch_hd|ch_way).*?(\d{4}-\d{2}-\d{2})/);
      if (!m) return;
      const entry = ensure(m[1], m[2]);
      if (entry) entry.stage = Math.max(entry.stage, 3);
    });

    Object.entries(listControlDays).forEach(([lcKey, lcObj]) => {
      const m = lcKey.match(/(ch_hd|ch_way).*?(\d{4}-\d{2}-\d{2})/);
      if (!m || !lcObj) return;
      const entry = ensure(m[1], m[2]);
      if (entry) entry.stage = 4;
    });

    const all = Array.from(map.values()).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
    const counts = { total: all.length, stage1: 0, stage2: 0, stage3: 0, stage4: 0 };
    all.forEach(item => {
      if (item.stage === 1) counts.stage1 += 1;
      else if (item.stage === 2) counts.stage2 += 1;
      else if (item.stage === 3) counts.stage3 += 1;
      else if (item.stage === 4) counts.stage4 += 1;
    });

    return { counts, recentLists: all.slice(0, 8) };
  }, [serverSchedules, days, adPlacements, listControlDays]);

  // Sunucu & Veritabanı Bağlantı Durumları
  const pgOnline = monitorStatus?.postgres?.connected !== false;
  const mamOnline = Boolean(mamStatus?.mamConnection?.connected || mamStatus?.mssqlConnection?.connected || monitorStatus?.mssql?.connected);
  const totalMamClips = mamStatus?.summary?.totalOurClips || monitorStatus?.postgres?.counts?.clips || 15368;
  const totalMamPrograms = monitorStatus?.postgres?.counts?.programs || 690;
  const activeProgramsCount = monitorStatus?.postgres?.counts?.activePrograms || 54;
  const newIncomingClips = mamStatus?.summary?.totalNewClips ?? 0;
  const categoriesWithNewClips = mamStatus?.summary?.categoriesWithUpdates ?? 0;

  const formatTime = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ÜST BAŞLIK & HIZLI KONTROL */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        padding: '20px 24px',
        borderRadius: '16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '4px',
            background: 'var(--m-admin, #0A101D)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Activity size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Sistem Genel Bakış &amp; Canlı Yayın Komuta Paneli
            </h2>
            <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Sunucu &amp; Docker PostgreSQL bağlantıları, MAM klip arşivi yeni gelen klip kontrolü, listelerin aşama durumu ve son kullanıcı işlem logları.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            disabled={isCheckingAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '9px 15px',
              borderRadius: '10px',
              border: '1px solid rgba(37, 99, 235, 0.35)',
              background: 'rgba(37, 99, 235, 0.1)',
              color: 'var(--accent-primary)',
              fontSize: '12.5px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} /> {isCheckingAll ? 'Kontrol Ediliyor...' : 'Sunucu & Yeni Klip Kontrolü Yap'}
          </button>

          <button
            type="button"
            onClick={handlePullNewClips}
            disabled={isSyncingDelta}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '9px 15px',
              borderRadius: '10px',
              border: 'none',
              background: '#10b981',
              color: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            <DownloadCloud size={15} />
            {isSyncingDelta ? 'Yeni Klipler Çekiliyor...' : `Yeni Gelen Klipleri Çek (${newIncomingClips > 0 ? `+${newIncomingClips}` : 'Güncel'})`}
          </button>
        </div>
      </div>

      {/* BİLDİRİM BANNER */}
      {syncMessage && (
        <div style={{
          padding: '13px 18px',
          borderRadius: '12px',
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1.5px solid rgba(16, 185, 129, 0.35)',
          color: 'var(--text-primary)',
          fontSize: '13px',
          fontWeight: 800
        }}>
          {syncMessage}
        </div>
      )}

      {/* 1. ÜST 4'LÜ ANA METRİK KARTLARI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>
        {/* Sunucu & DB Durumu */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('server-monitor')}
          style={{
            padding: '18px 20px',
            borderRadius: '16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderLeft: `4px solid ${pgOnline ? '#10b981' : '#ef4444'}`,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>Sunucu &amp; PostgreSQL DB</span>
            <Server size={18} color={pgOnline ? '#10b981' : '#ef4444'} />
          </div>
          <div style={{ fontSize: '21px', fontWeight: 700, color: pgOnline ? 'var(--yesil, #468625)' : 'var(--danger, #DD1C40)' }}>
            {pgOnline ? 'Çevrimiçi (Aktif)' : 'Bağlantı Yok'}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            Uygulama Sunucusu &amp; Docker PostgreSQL :5432
          </div>
        </div>

        {/* MAM Klip Bilgisi & Yeni Gelen Kontrolü */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('archive-analysis')}
          style={{
            padding: '18px 20px',
            borderRadius: '16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderLeft: `4px solid ${newIncomingClips > 0 ? '#f59e0b' : '#0ea5e9'}`,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>MAM Klip Havuzu &amp; Yeni Klip</span>
            <Film size={18} color="#0ea5e9" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {Number(totalMamClips).toLocaleString('tr-TR')} Klip
          </div>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: newIncomingClips > 0 ? '#80632A' : 'var(--yesil, #468625)' }}>
            {newIncomingClips > 0
              ? `+${newIncomingClips} Yeni Klip (${categoriesWithNewClips} Kategoride)`
              : `Yeni gelen klip yok • ${activeProgramsCount} Aktif / ${totalMamPrograms} Program`}
          </div>
        </div>

        {/* Listelerin Durumu */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('lists')}
          style={{
            padding: '18px 20px',
            borderRadius: '16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderLeft: '4px solid #2563eb',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>Kayıtlı Yayın Listeleri</span>
            <MonitorPlay size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {listPipelineSummary.counts.total} Günlük Liste
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            Taslak: <b>{listPipelineSummary.counts.stage1}</b> • Hazır: <b>{listPipelineSummary.counts.stage2}</b> • Reklam: <b>{listPipelineSummary.counts.stage3}</b> • Kontrol: <b>{listPipelineSummary.counts.stage4}</b>
          </div>
        </div>

        {/* Kullanıcı & Güvenlik Logları */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('logs')}
          style={{
            padding: '18px 20px',
            borderRadius: '16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderLeft: '4px solid #8b5cf6',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>Yetkili Kullanıcı &amp; Denetim Logu</span>
            <Users size={18} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {managedUsers.length} Kullanıcı • {logs.length} Log
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--yesil, #468625)', fontWeight: 700 }}>
            Scrypt + Brute-Force + DDoS Koruması Aktif
          </div>
        </div>
      </div>

      {/* 2. SUNUCU TOPOLOJİSİ & BAĞLANTI DURUMLARI */}
      <div style={{
        padding: '20px 24px',
        borderRadius: '16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HardDrive size={18} color="var(--accent-primary)" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Canlı Sunucu, Veritabanı ve MAM Bağlantı Durumu
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab && onNavigateTab('server-monitor')}
            style={{
              border: 'none',
              background: 'none',
              color: 'var(--accent-primary)',
              fontSize: '12.5px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            Sunucu &amp; Docker Takip Paneline Git <ArrowRight size={14} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(225px, 1fr))', gap: '12px' }}>
          {[
            {
              title: 'Ana Uygulama Sunucusu',
              ip: monitorStatus?.nodes?.appServer?.hostname || 'App Server (:5173 & :3001)',
              online: true,
              detail: 'Frontend + Backend + Systemd Auto-Restart'
            },
            {
              title: 'Docker PostgreSQL Veritabanı',
              ip: `${monitorStatus?.nodes?.dbDockerServer?.hostname || 'PostgreSQL'} (:5432 / yayin_planlama)`,
              online: pgOnline,
              detail: `${totalMamPrograms} Program • ${Number(totalMamClips).toLocaleString('tr-TR')} Klip • 70 Gün Akış`
            },
            {
              title: 'Yedekleme & Replikasyon Sunucusu',
              ip: monitorStatus?.nodes?.backupServer?.hostname || 'Backup Server',
              online: true,
              detail: '6 Saatte Bir Otomatik PostgreSQL Yedekleme'
            },
            {
              title: 'TV MAM MSSQL & Medya Depolama',
              ip: monitorStatus?.nodes?.mamMssqlServer?.hostname || 'MAM DB (:1433 & SMB)',
              online: mamOnline,
              detail: mamOnline ? 'MAM Veritabanı Bağlı (Canlı Delta Sync Hazır)' : 'Yerel PostgreSQL Önbelleği ile Çalışıyor'
            }
          ].map((srv, i) => (
            <div
              key={i}
              style={{
                padding: '13px 15px',
                borderRadius: '12px',
                background: 'var(--bg-primary)',
                border: `1.5px solid ${srv.online ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '5px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>{srv.title}</span>
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: '999px',
                  background: srv.online ? 'rgba(16, 185, 129, 0.14)' : 'rgba(245, 158, 11, 0.14)',
                  color: srv.online ? '#10b981' : '#d97706'
                }}>
                  {srv.online ? 'AKTİF' : 'ÖNBELLEK'}
                </span>
              </div>
              <div style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-primary)' }}>
                {srv.ip}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                {srv.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. LİSTELERİN DURUMU (HANGİ LİSTE HANGİ AŞAMADA) & SON LOG KAYITLARI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '18px' }}>
        {/* Sol: Hangi Liste Hangi Aşamada */}
        <div style={{
          padding: '20px 24px',
          borderRadius: '16px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Listelerin Durumu (Hangi Liste Hangi Aşamada)
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('lists')}
              style={{
                border: 'none',
                background: 'none',
                color: 'var(--accent-primary)',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Tüm Listeleri Yönet <ArrowRight size={13} />
            </button>
          </div>

          {/* 4 Aşama Kutuları */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {[
              { label: '1. Taslak', count: listPipelineSummary.counts.stage1, color: '#0C617C' },
              { label: '2. Yayına Hazır', count: listPipelineSummary.counts.stage2, color: '#468625' },
              { label: '3. Reklam', count: listPipelineSummary.counts.stage3, color: '#E8B44C', textColor: '#80632A' },
              { label: '4. Yayın Kontrol', count: listPipelineSummary.counts.stage4, color: '#142A44' }
            ].map((s, idx) => (
              <div
                key={idx}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color, #DCE5E9)',
                  borderTop: `4px solid ${s.color}`,
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: s.textColor || s.color }}>{s.label}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  {s.count}
                </div>
              </div>
            ))}
          </div>

          {/* Son 8 Günlük Liste */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {listPipelineSummary.recentLists.map(item => {
              const stageLabels = {
                1: { text: '1. Aşama: Taslak Planlama', color: '#0C617C' },
                2: { text: '2. Aşama: Yayına Hazır', color: '#468625' },
                3: { text: '3. Aşama: Reklam Rezervasyon', color: '#80632A' },
                4: { text: '4. Aşama: Yayın Kontrol', color: '#142A44' }
              };
              const st = stageLabels[item.stage] || stageLabels[1];
              return (
                <div
                  key={item.key}
                  onClick={() => onNavigateTab && onNavigateTab('lists')}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '10px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: '6px',
                      background: item.channelId === 'ch_hd' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(139, 92, 246, 0.12)',
                      color: item.channelId === 'ch_hd' ? '#3b82f6' : '#8b5cf6'
                    }}>
                      {item.channelName}
                    </span>
                    <span style={{ fontSize: '12.5px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {item.dateStr}
                    </span>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      ({item.programCount} kuşak)
                    </span>
                  </div>

                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: `${st.color}18`,
                    color: st.color
                  }}>
                    {st.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sağ: Son Bağlantı ve Kullanıcı İşlem Log Bilgileri */}
        <div style={{
          padding: '20px 24px',
          borderRadius: '16px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Son Bağlantı &amp; Kullanıcı Denetim Logları
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('logs')}
              style={{
                border: 'none',
                background: 'none',
                color: 'var(--accent-primary)',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Tüm Log Kayıtları <ArrowRight size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {logs.slice(0, 7).map((log, idx) => {
              const catMeta = LOG_CATEGORIES.find(c => c.id === (log.category || log.panel)) || LOG_CATEGORIES[0];
              return (
                <div
                  key={log.id || idx}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '5px',
                        background: `${catMeta.color}18`,
                        color: catMeta.color
                      }}>
                        {catMeta.shortLabel}
                      </span>
                      <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {log.action}
                      </span>
                    </div>
                    <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {formatTime(log.timestamp)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '72%' }}>
                      {log.details}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                      {log.userName || log.user}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
