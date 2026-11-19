/**
 * @file src/pages/admin/ServerMonitorTab.jsx
 * @description Admin Paneli — Sunucu, Docker PostgreSQL, Ana Uygulama, Yedek Sunucu,
 * MAM MSSQL ve Medya Arşiv Depolama Canlı Takip, Otomatik Ayağa Kaldırma (Watchdog) ve Uzaktan Restart Merkezi.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Database,
  RefreshCw,
  Power,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HardDrive,
  Activity,
  Clock
} from 'lucide-react';
import { dialog } from '../../store/dialogStore';
import useAdminLogStore from '../../store/adminLogStore';

function formatUptime(totalSec) {
  const sec = Math.max(0, Number(totalSec) || 0);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (d > 0) return `${d} gün ${h} sa ${m} dk`;
  if (h > 0) return `${h} sa ${m} dk ${s} sn`;
  if (m > 0) return `${m} dk ${s} sn`;
  return `${s} sn`;
}

const ServerMonitorTab = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState('');
  const [autoPoll, setAutoPoll] = useState(true);
  const [banner, setBanner] = useState(null);

  const addLog = useAdminLogStore(state => state.addLog);

  const showBanner = (type, message) => {
    setBanner({ type, message });
    setTimeout(() => {
      setBanner(null);
    }, 5000);
  };

  const fetchStatus = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/system-monitor/status');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      if (!silent) {
        showBanner('error', `Sunucu durum bilgisi alınamadı: ${err.message}`);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus(false);
  }, [fetchStatus]);

  useEffect(() => {
    if (!autoPoll) return;
    const timer = setInterval(() => {
      fetchStatus(true);
    }, 8000);
    return () => clearInterval(timer);
  }, [autoPoll, fetchStatus]);

  const handleAction = async (key, endpoint, body = {}, confirmMsg = null) => {
    if (confirmMsg) {
      const ok = await dialog.confirm('Servis İşlemi Onayı', confirmMsg, {
        confirmText: 'Evet, Başlat'
      });
      if (!ok) return;
    }

    setActionBusy(key);
    try {
      const res = await fetch(`/api/system-monitor/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok !== false) {
        showBanner('success', json.message || 'İşlem başarıyla tamamlandı.');
        addLog({
          category: 'system',
          panel: 'system',
          module: 'Sunucu & Docker Takip',
          action: key,
          details: json.message || endpoint,
          status: 'success'
        });
      } else {
        showBanner('error', json.message || json.error || 'İşlem sırasında uyarı oluştu.');
      }
    } catch (err) {
      showBanner('error', `İstek hatası: ${err.message}`);
    } finally {
      setActionBusy('');
      setTimeout(() => fetchStatus(true), 1200);
    }
  };

  const nodes = data?.nodes || {};
  const runtime = data?.localHostRuntime || {};
  const watchdog = data?.watchdog || {};
  const gitDeploy = data?.gitDeploy || {};
  const security = data?.security || {};
  const backups = data?.backups || [];

  const statusBadge = (isOk, okText = 'ÇALIŞIYOR', errText = 'ERİŞİLEMİYOR') => (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '4px 10px',
      borderRadius: '999px',
      fontSize: '11.5px',
      fontWeight: 800,
      background: isOk ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)',
      color: isOk ? '#059669' : '#dc2626',
      border: `1px solid ${isOk ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`
    }}>
      {isOk ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      <span>{isOk ? okText : errText}</span>
    </span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ÜST BAŞLIK & WATCHDOG KONTROL BAR */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '20px 24px',
        borderRadius: '16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #059669 0%, #2563eb 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(5, 150, 105, 0.25)'
          }}>
            <Activity size={23} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Sunucu, Docker &amp; Servis Takip Merkezi (Watchdog)
            </h2>
            <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Uygulama Sunucusu, Yedek Sunucu, Docker PostgreSQL Veritabanı, MAM MSSQL ve Medya Arşiv durumunu izleyin ve düştüğünde tek tıkla ayağa kaldırın.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleAction('Watchdog Durumu Değiştir', 'toggle-watchdog')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '9px 14px',
              borderRadius: '10px',
              border: `1.5px solid ${watchdog.autoRecoveryEnabled !== false ? '#10b981' : '#f59e0b'}`,
              background: watchdog.autoRecoveryEnabled !== false ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              color: watchdog.autoRecoveryEnabled !== false ? '#047857' : '#b45309',
              fontSize: '12.5px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            <ShieldCheck size={16} />
            <span>
              Otomatik Ayağa Kaldırma: {watchdog.autoRecoveryEnabled !== false ? 'AÇIK (20sn)' : 'KAPALI'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAutoPoll(p => !p)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 13px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Clock size={14} color="var(--accent-primary)" />
            <span>Canlı Yenileme: {autoPoll ? 'Aktif (8sn)' : 'Duraklatıldı'}</span>
          </button>

          <button
            type="button"
            onClick={() => fetchStatus(false)}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 15px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--accent-primary)',
              color: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Şimdi Kontrol Et</span>
          </button>
        </div>
      </div>

      {/* BİLDİRİM BANNER */}
      {banner && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '13px 18px',
          borderRadius: '12px',
          background: banner.type === 'error' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
          border: `1.5px solid ${banner.type === 'error' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
          color: banner.type === 'error' ? '#dc2626' : '#047857',
          fontSize: '13px',
          fontWeight: 700
        }}>
          {banner.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{banner.message}</span>
        </div>
      )}

      {/* 1. ANA SUNUCU & DOCKER VERİTABANI KARTLARI (2 BÜYÜK KART) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
        gap: '18px'
      }}>
        {/* KART A: DOCKER POSTGRESQL VERİTABANI SUNUCUSU */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: `2px solid ${nodes.dbDockerServer?.postgres?.connected ? '#10b981' : '#f59e0b'}`,
          borderRadius: '16px',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(37, 99, 235, 0.12)',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Database size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 800 }}>
                    Veritabanı Sunucusu ({nodes.dbDockerServer?.hostname || 'Docker DB'})
                  </h3>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)'
                  }}>
                    Docker PostgreSQL :5432
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Host: <code>{nodes.dbDockerServer?.ip || 'PostgreSQL'}</code> • Konteyner: <code>yayin_planlama_db</code>
                </div>
              </div>
            </div>

            {statusBadge(
              nodes.dbDockerServer?.postgres?.connected,
              `AKTİF (${nodes.dbDockerServer?.postgres?.activeHost || '5432'})`,
              'BAĞLANTI YOK'
            )}
          </div>

          {/* İstatistik Kutucukları */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '10px'
          }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Port 5432 Ping</div>
              <div style={{ fontSize: '14px', fontWeight: 800, marginTop: '3px', fontFamily: 'var(--font-mono)', color: nodes.dbDockerServer?.port5432Reachable ? '#059669' : '#d97706' }}>
                {nodes.dbDockerServer?.port5432Reachable ? `${nodes.dbDockerServer.latencyMs} ms` : 'Kapalı'}
              </div>
            </div>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Kayıtlı Gün Akışı</div>
              <div style={{ fontSize: '14px', fontWeight: 800, marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                {nodes.dbDockerServer?.postgres?.schedulesCount ?? 0} Gün
              </div>
            </div>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Arşiv Klip Sayısı</div>
              <div style={{ fontSize: '14px', fontWeight: 800, marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                {nodes.dbDockerServer?.postgres?.clipsCount ?? 0} Klip
              </div>
            </div>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>DB Boyutu / Bağlantı</div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                {nodes.dbDockerServer?.postgres?.dbSizePretty || '-'} ({nodes.dbDockerServer?.postgres?.activeConnections || 0})
              </div>
            </div>
          </div>

          {/* Aksiyon Butonları */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={actionBusy === 'pg_reconnect'}
              onClick={() => handleAction('pg_reconnect', 'reconnect-postgres')}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(37, 99, 235, 0.35)',
                background: 'rgba(37, 99, 235, 0.1)',
                color: '#2563eb',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} />
              <span>DB Bağlantısını &amp; Tabloları Doğrula</span>
            </button>

            <button
              type="button"
              disabled={actionBusy === 'sql_docker_restart'}
              onClick={() =>
                handleAction(
                  'sql_docker_restart',
                  'restart-sql-docker',
                  {},
                  'yayin_planlama_db Docker PostgreSQL konteyneri yeniden başlatılsın mı?'
                )
              }
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: 'none',
                background: '#059669',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              <Power size={14} />
              <span>Docker Konteynerini Ayağa Kaldır / Restart</span>
            </button>
          </div>
        </div>

        {/* KART B: ANA UYGULAMA SUNUCUSU */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '2px solid #10b981',
          borderRadius: '16px',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Server size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 800 }}>
                    Uygulama Sunucusu ({runtime.hostname || nodes.appServer?.hostname || 'App Server'})
                  </h3>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)'
                  }}>
                    Frontend :5173 &amp; Backend :3001
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Ana Sunucu: <code>{nodes.appServer?.ip || '-'}</code> / Yedek Sunucu: <code>{nodes.backupServer?.ip || '-'}</code>
                </div>
              </div>
            </div>

            {statusBadge(true, 'ÇALIŞIYOR', 'KAPALI')}
          </div>

          {/* Sunucu Kaynakları */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '10px'
          }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Servis Çalışma Süresi</div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '3px', fontFamily: 'var(--font-mono)', color: '#059669' }}>
                {formatUptime(runtime.processUptimeSec)}
              </div>
            </div>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Sunucu RAM</div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                %{runtime.memUsagePct || 0} ({runtime.usedMemMb || 0} MB)
              </div>
            </div>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>CPU Çekirdek / Yük</div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                {runtime.cpuCores || 1} Core ({runtime.loadAvg?.[0] ?? 0})
              </div>
            </div>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Node.js Bellek</div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                {runtime.processMemMb || 0} MB ({runtime.nodeVersion || 'v20'})
              </div>
            </div>
          </div>

          {/* Aksiyon Butonları */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={actionBusy === 'soft_restart'}
              onClick={() => handleAction('soft_restart', 'restart-backend', { hardExit: false })}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#047857',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} />
              <span>Önbelleği &amp; Bağlantı Havuzlarını Yenile</span>
            </button>

            <button
              type="button"
              disabled={actionBusy === 'hard_restart'}
              onClick={() =>
                handleAction(
                  'hard_restart',
                  'restart-backend',
                  { hardExit: true },
                  'Backend servisi tamamen yeniden başlatılsın mı? (Systemd / Watcher servisi 2 saniye içinde otomatik ayağa kaldıracaktır)'
                )
              }
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(225, 29, 72, 0.35)',
                background: 'rgba(225, 29, 72, 0.1)',
                color: '#e11d48',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              <Power size={14} />
              <span>Backend Sürecini Yeniden Başlat (Restart)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. DİĞER BAĞLI SUNUCULAR (YEDEK .81, LİBERO MAM MSSQL, ORTAK ALAN SMB) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
        gap: '16px'
      }}>
        {/* Yedek & Standby Sunucu */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800 }}>
                {nodes.backupServer?.hostname || 'Yedek Sunucu'} ({nodes.backupServer?.ip || '-'})
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Yedek &amp; Standby Sunucu</div>
            </div>
            {statusBadge(
              nodes.backupServer?.sshReachable || nodes.backupServer?.standbyAppRunning,
              nodes.backupServer?.standbyAppRunning ? 'STANDBY AÇIK' : 'AĞDA ERİŞİLEBİLİR',
              'BEKLEMEDE'
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
            <span>SSH (:22): <strong>{nodes.backupServer?.sshReachable ? 'Açık' : 'Kapalı'}</strong></span>
            <span>Uygulama (:3001): <strong>{nodes.backupServer?.standbyAppRunning ? 'Çalışıyor' : 'Pasif'}</strong></span>
            <span>Ping: <strong>{nodes.backupServer?.latencyMs ?? '-'} ms</strong></span>
          </div>
        </div>

        {/* MAM MSSQL */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800 }}>
                MAM MSSQL ({nodes.mamMssqlServer?.hostname || 'MAM DB'})
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>MAM Arşiv Veritabanı (:1433)</div>
            </div>
            {statusBadge(nodes.mamMssqlServer?.poolConnected, `BAĞLI (${nodes.mamMssqlServer?.latencyMs || 0}ms)`, 'BAĞLANTI YOK')}
          </div>
          <button
            type="button"
            disabled={actionBusy === 'mssql_reconnect'}
            onClick={() => handleAction('mssql_reconnect', 'reconnect-mssql')}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={13} />
            <span>MSSQL Bağlantı Havuzunu Yeniden Başlat</span>
          </button>
        </div>

        {/* Medya Arşiv Depolama (SMB) */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800 }}>
                {nodes.smbMediaServer?.hostname || 'Medya Arşiv Depolama (SMB)'}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                MAM: {nodes.smbMediaServer?.cachedMamFiles || 0} • Arşiv: {nodes.smbMediaServer?.cachedArsivFiles || 0} Video
              </div>
            </div>
            {statusBadge(nodes.smbMediaServer?.portReachable, `SMB AÇIK (${nodes.smbMediaServer?.latencyMs || 0}ms)`, 'MOUNT KONTROL')}
          </div>
          <button
            type="button"
            disabled={actionBusy === 'media_rescan'}
            onClick={() => handleAction('media_rescan', 'rescan-media')}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <HardDrive size={13} />
            <span>Ortak Alan Video Dizinlerini Yeniden Tara</span>
          </button>
        </div>
      </div>

      {/* 3. GÜVENLİK KALKANI (WAF / DDOS / BRUTE-FORCE) VE OTOMATİK VERİ YEDEKLEME MERKEZİ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: '18px'
      }}>
        {/* KART C: SİBER GÜVENLİK, BRUTE-FORCE & DDOS KALKANI */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1.5px solid var(--border-color)',
          borderRadius: '16px',
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                Siber Güvenlik, Brute-Force &amp; DDoS Kalkanı
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Scrypt şifre hashleme, 5 hatalı girişte 15 dk IP/Hesap kilidi, Bot Honeypot ve DDoS Rate Limit ({security.maxRequestsPerMinute || 360} istek/dk) aktif.
              </p>
            </div>
            {statusBadge(true, 'KALKAN AKTİF', 'PASİF')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Şifre Koruması</div>
              <div style={{ fontSize: '12.5px', fontWeight: 800, marginTop: '3px', color: '#059669' }}>
                Scrypt + HMAC
              </div>
            </div>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Brute-Force Kilitli</div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '3px', fontFamily: 'var(--font-mono)', color: (security.lockedLogins?.length || 0) > 0 ? '#dc2626' : '#059669' }}>
                {security.lockedLogins?.length || 0} Kayıt
              </div>
            </div>
            <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>DDoS Bloklu IP</div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '3px', fontFamily: 'var(--font-mono)', color: (security.blockedIps?.length || 0) > 0 ? '#dc2626' : '#059669' }}>
                {security.blockedIps?.length || 0} IP
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              Son Güvenlik Olayı: <strong>{security.recentEvents?.[0]?.details || 'Tehdit tespit edilmedi'}</strong>
            </span>
            {((security.lockedLogins?.length || 0) > 0 || (security.blockedIps?.length || 0) > 0) && (
              <button
                type="button"
                onClick={() => handleAction('clear_locks', 'clear-security-locks')}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(225, 29, 72, 0.35)',
                  background: 'rgba(225, 29, 72, 0.1)',
                  color: '#e11d48',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Kilitleri Aç
              </button>
            )}
          </div>
        </div>

        {/* KART D: VERİ YEDEKLİLİĞİ & OTOMATİK YEDEKLEME MERKEZİ */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1.5px solid var(--border-color)',
          borderRadius: '16px',
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                Veri Yedekliliği &amp; Otomatik DB Yedekleme
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Her 6 saatte bir tüm PostgreSQL tabloları (70 gün akış, 690 program, 15.368 klip, kurallar) otomatik yedeklenir.
              </p>
            </div>
            <button
              type="button"
              disabled={actionBusy === 'backup_now'}
              onClick={() => handleAction('backup_now', 'backup-now')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                border: 'none',
                background: '#059669',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <HardDrive size={14} />
              <span>{actionBusy === 'backup_now' ? 'Yedekleniyor...' : 'Şimdi Tam Yedek Al'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '110px', overflowY: 'auto' }}>
            {backups.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0' }}>
                Henüz yedek dosyası oluşturulmadı. &quot;Şimdi Tam Yedek Al&quot; butonuna tıklayabilirsiniz.
              </div>
            ) : (
              backups.slice(0, 4).map(b => (
                <div
                  key={b.fileName}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    fontSize: '11.5px'
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{b.fileName}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{b.sizeKb} KB</span>
                    <a
                      href={`/api/system-monitor/download-backup/${encodeURIComponent(b.fileName)}`}
                      download={b.fileName}
                      style={{
                        color: 'var(--accent-primary)',
                        fontWeight: 800,
                        textDecoration: 'none'
                      }}
                    >
                      İndir
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4. GITHUB OTOMATİK GÜNCELLEME (AUTO-PULL & AUTO-BUILD) MERKEZİ */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: `1.5px solid ${gitDeploy.hasUpdate ? '#f59e0b' : 'var(--border-color)'}`,
        borderRadius: '16px',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                GitHub Otomatik Güncelleme &amp; Canlı Derleme (Auto-Pull &amp; Build)
              </h3>
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(37, 99, 235, 0.12)',
                color: '#2563eb',
                fontFamily: 'var(--font-mono)'
              }}>
                Commit: {gitDeploy.localCommit || '-'} ({gitDeploy.branch || 'main'})
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              Bilgisayarınızdan GitHub’a (<code>msalihozer/Broadcast_scheduling</code>) <code>git push</code> attığınızda Linux sunucu her 60 saniyede bir otomatik kontrol eder, yeni kodu çeker (<code>git pull</code>) ve derler (<code>npm run build</code>).
            </p>
            {gitDeploy.lastCommitMessage && (
              <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Son Commit Mesajı: <strong style={{ color: 'var(--text-primary)' }}>{gitDeploy.lastCommitMessage}</strong>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleAction('git_autopull_toggle', 'toggle-git-autopull')}
              style={{
                padding: '9px 14px',
                borderRadius: '10px',
                border: `1.5px solid ${gitDeploy.autoPullEnabled ? '#10b981' : 'var(--border-color)'}`,
                background: gitDeploy.autoPullEnabled ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-primary)',
                color: gitDeploy.autoPullEnabled ? '#047857' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Otomatik Çekme (60sn): {gitDeploy.autoPullEnabled ? 'AÇIK' : 'KAPALI'}
            </button>

            <button
              type="button"
              disabled={actionBusy === 'git_pull_deploy' || gitDeploy.isDeploying}
              onClick={() => handleAction('git_pull_deploy', 'git-pull-deploy')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '9px 16px',
                borderRadius: '10px',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} />
              <span>
                {actionBusy === 'git_pull_deploy' || gitDeploy.isDeploying
                  ? 'Çekiliyor & Derleniyor...'
                  : "GitHub'dan Şimdi Çek & Derle"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. WATCHDOG OLAY VE OTOMATİK KURTARMA GEÇMİŞİ */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800 }}>
            Watchdog &amp; Servis Müdahale Kayıtları (Otomatik Kurtarma Sayısı: {watchdog.autoRecoveryCount || 0})
          </h3>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Son Kontrol: {watchdog.lastCheckAt ? new Date(watchdog.lastCheckAt).toLocaleTimeString('tr-TR') : '-'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
          {(watchdog.events || []).map(ev => (
            <div
              key={ev.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '9px 14px',
                borderRadius: '10px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderLeft: `4px solid ${
                  ev.status === 'error' ? '#ef4444' : ev.status === 'warning' ? '#f59e0b' : '#10b981'
                }`,
                fontSize: '12.5px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: 'var(--bg-tertiary)',
                  fontSize: '11px'
                }}>
                  {ev.node}
                </span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{ev.action}</span>
                {ev.details && (
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11.5px' }}>({ev.details})</span>
                )}
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {new Date(ev.timestamp).toLocaleString('tr-TR')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ServerMonitorTab;
