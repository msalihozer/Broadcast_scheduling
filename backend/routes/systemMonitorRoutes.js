/**
 * @file backend/routes/systemMonitorRoutes.js
 * @description Uygulama, Yedek, Docker PostgreSQL, MAM MSSQL ve Medya Ortak Alan Sunucuları için
 * Canlı İzleme, Otomatik Ayağa Kaldırma (Auto-Watchdog), Veri Yedekleme ve Uzaktan Yeniden Başlatma Router'ı.
 * Tüm IP adresleri, kullanıcı adları ve dizin yolları yalnızca .env (SERVER_TOPOLOGY) üzerinden dinamik okunur.
 */
import express from 'express';
import net from 'net';
import os from 'os';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { exec } from 'child_process';
import { SERVER_TOPOLOGY } from '../config/envLoader.js';
import {
    isPostgresReady,
    getActivePostgresHost,
    testConnection as testPgConnection,
    query as pgQuery
} from '../db/postgres.js';
import {
    getSecurityStatusSummary,
    clearAllSecurityLocks
} from '../middleware/securityMiddleware.js';

const watchdogEvents = [];
let autoRecoveryEnabled = true;
let lastWatchdogCheckAt = null;
let autoRecoveryCount = 0;

let gitAutoPullEnabled = process.platform !== 'win32';
let gitDeployBusy = false;
let gitStatusCache = {
    branch: 'main',
    localCommit: '-',
    remoteCommit: '-',
    lastCommitMessage: '',
    hasUpdate: false,
    lastCheckedAt: null,
    lastDeployedAt: null
};

function logWatchdogEvent(node, action, status = 'info', details = '') {
    const entry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        node,
        action,
        status,
        details
    };
    watchdogEvents.unshift(entry);
    if (watchdogEvents.length > 60) {
        watchdogEvents.length = 60;
    }
    return entry;
}

function checkTcpPort(host, port, timeoutMs = 1800) {
    return new Promise((resolve) => {
        const start = Date.now();
        const socket = new net.Socket();
        let settled = false;

        const finish = (reachable, errorMsg = null) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve({
                host,
                port,
                reachable,
                latencyMs: Date.now() - start,
                error: errorMsg
            });
        };

        socket.setTimeout(timeoutMs);
        socket.once('connect', () => finish(true, null));
        socket.once('timeout', () => finish(false, 'Zaman aşımı (Timeout)'));
        socket.once('error', (err) => finish(false, err.message));

        try {
            socket.connect(port, host);
        } catch (err) {
            finish(false, err.message);
        }
    });
}

async function callRemoteSqlWatchdog(endpoint = '/status', method = 'GET') {
    const sqlHost = SERVER_TOPOLOGY.DB_DOCKER_SERVER.ip;
    const url = `http://${sqlHost}:3005${endpoint}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
        const res = await fetch(url, { method, signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
            return await res.json();
        }
        return { ok: false, error: `HTTP ${res.status}` };
    } catch (err) {
        clearTimeout(timer);
        return { ok: false, error: err.message };
    }
}

function runLocalDockerCommand(cmd, timeout = 15000) {
    return new Promise((resolve) => {
        exec(cmd, { timeout }, (err, stdout, stderr) => {
            if (err) {
                resolve({ ok: false, error: (stderr || err.message || '').trim() });
            } else {
                resolve({ ok: true, output: (stdout || '').trim() });
            }
        });
    });
}

async function refreshGitStatus(fetchRemote = false) {
    try {
        if (fetchRemote) {
            await runLocalDockerCommand('git fetch origin main', 20000);
        }
        const [localRes, remoteRes, msgRes, branchRes] = await Promise.all([
            runLocalDockerCommand('git rev-parse --short HEAD', 5000),
            runLocalDockerCommand('git rev-parse --short origin/main', 5000),
            runLocalDockerCommand('git log -1 --pretty=%s', 5000),
            runLocalDockerCommand('git rev-parse --abbrev-ref HEAD', 5000)
        ]);
        const localCommit = localRes.ok ? localRes.output : '-';
        const remoteCommit = remoteRes.ok ? remoteRes.output : localCommit;
        gitStatusCache = {
            ...gitStatusCache,
            branch: branchRes.ok ? branchRes.output : 'main',
            localCommit,
            remoteCommit,
            lastCommitMessage: msgRes.ok ? msgRes.output : '',
            hasUpdate: Boolean(localCommit !== '-' && remoteCommit !== '-' && localCommit !== remoteCommit),
            lastCheckedAt: new Date().toISOString()
        };
    } catch (_) {}
    return gitStatusCache;
}

async function executeGitPullAndBuild(triggeredBy = 'Otomatik GitHub Güncelleyici') {
    if (gitDeployBusy) {
        return { ok: false, message: 'Şu anda devam eden bir güncelleme/derleme işlemi var.' };
    }
    gitDeployBusy = true;
    try {
        const pullRes = await runLocalDockerCommand('git pull origin main --no-edit', 45000);
        if (!pullRes.ok) {
            logWatchdogEvent('GitHub Auto-Deploy', `${triggeredBy}: git pull hatası`, 'error', pullRes.error);
            return { ok: false, message: `Git pull hatası: ${pullRes.error}` };
        }

        const buildRes = await runLocalDockerCommand('npm run build', 120000);
        await refreshGitStatus(false);
        gitStatusCache.lastDeployedAt = new Date().toISOString();

        if (!buildRes.ok) {
            logWatchdogEvent('GitHub Auto-Deploy', `${triggeredBy}: Kod çekildi ancak derleme uyarısı oluştu`, 'warning', buildRes.error);
            return { ok: false, message: `Kod çekildi fakat derleme hatası: ${buildRes.error}` };
        }

        logWatchdogEvent(
            'GitHub Auto-Deploy',
            `${triggeredBy}: Yeni sürüm (${gitStatusCache.localCommit}) GitHub'dan çekildi ve derlendi`,
            'success',
            gitStatusCache.lastCommitMessage
        );
        return {
            ok: true,
            commit: gitStatusCache.localCommit,
            message: `GitHub güncellemesi (${gitStatusCache.localCommit} - ${gitStatusCache.lastCommitMessage}) başarıyla çekildi ve derlendi!`
        };
    } finally {
        gitDeployBusy = false;
    }
}

export function createSystemMonitorRouter({
    getMssqlStatus,
    reconnectMssql,
    rescanMediaCaches,
    getMediaCacheStats,
    clearApiCache
}) {
    const router = express.Router();

    logWatchdogEvent(
        'Sistem İzleyici',
        'Sunucu & Docker Watchdog izleme servisi başlatıldı',
        'success',
        `Ana Sunucu: ${SERVER_TOPOLOGY.APP_SERVER.hostname} | SQL Docker: ${SERVER_TOPOLOGY.DB_DOCKER_SERVER.hostname}:5432`
    );

    refreshGitStatus(false);

    const backupsDir = path.resolve('backend', 'backups');
    if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
    }

    function listSavedBackups() {
        try {
            if (!fs.existsSync(backupsDir)) return [];
            return fs.readdirSync(backupsDir)
                .filter(f => f.endsWith('.json.gz'))
                .map(f => {
                    const st = fs.statSync(path.join(backupsDir, f));
                    return {
                        fileName: f,
                        sizeKb: Math.round(st.size / 1024),
                        createdAt: st.mtime.toISOString()
                    };
                })
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 20);
        } catch (_) {
            return [];
        }
    }

    async function createFullSystemBackup(triggerLabel = 'Otomatik Yedekleme') {
        if (!isPostgresReady()) {
            await testPgConnection();
        }
        if (!isPostgresReady()) {
            return { ok: false, message: 'PostgreSQL bağlantısı aktif olmadığı için tam yedek alınamadı.' };
        }
        try {
            const [cats, schs, progs, clips, rules, adsStoreRes] = await Promise.all([
                pgQuery('SELECT * FROM categories ORDER BY id'),
                pgQuery('SELECT * FROM schedules ORDER BY channel_id, date_key'),
                pgQuery('SELECT * FROM archive_programs ORDER BY id'),
                pgQuery('SELECT * FROM archive_clips ORDER BY id'),
                pgQuery('SELECT * FROM archive_parsing_rules ORDER BY id'),
                pgQuery('SELECT * FROM ads_persistent_store').catch(() => ({ rows: [] }))
            ]);

            const readJsonSafe = (relPath) => {
                try {
                    const p = path.resolve('backend', 'data', relPath);
                    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
                } catch (_) {}
                return null;
            };

            const now = new Date();
            const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const fileName = `yayin_backup_${stamp}.json.gz`;
            const fullPath = path.join(backupsDir, fileName);

            const payload = {
                backupCreatedAt: now.toISOString(),
                trigger: triggerLabel,
                categories: cats.rows,
                schedules: schs.rows,
                archive_programs: progs.rows,
                archive_clips: clips.rows,
                archive_parsing_rules: rules.rows,
                ads_persistent_store_db: adsStoreRes.rows,
                ads_persistent_store_disk: readJsonSafe('ads_persistent_store.json'),
                managed_users: (readJsonSafe('managed_users.json') || []).map(({ password, ...safe }) => safe),
                role_templates: readJsonSafe('role_templates.json')
            };

            const gz = zlib.gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'), { level: 9 });
            fs.writeFileSync(fullPath, gz);

            const allFiles = fs.readdirSync(backupsDir)
                .filter(f => f.endsWith('.json.gz'))
                .sort()
                .reverse();
            if (allFiles.length > 30) {
                for (const oldFile of allFiles.slice(30)) {
                    try { fs.unlinkSync(path.join(backupsDir, oldFile)); } catch (_) {}
                }
            }

            logWatchdogEvent(
                'Veri Yedekleme',
                `${triggerLabel}: Tam veritabanı yedeği alındı (${fileName} - ${Math.round(gz.length / 1024)} KB)`,
                'success',
                `${schs.rows.length} gün akış, ${progs.rows.length} program, ${clips.rows.length} klip`
            );

            return {
                ok: true,
                fileName,
                sizeKb: Math.round(gz.length / 1024),
                message: `Tam sistem yedeği (${fileName} - ${Math.round(gz.length / 1024)} KB) başarıyla oluşturuldu.`
            };
        } catch (err) {
            logWatchdogEvent('Veri Yedekleme', `Yedekleme hatası: ${err.message}`, 'error');
            return { ok: false, message: err.message };
        }
    }

    setTimeout(() => {
        if (listSavedBackups().length === 0) {
            createFullSystemBackup('İlk Kurulum Otomatik Yedeği');
        }
    }, 8000);
    setInterval(() => {
        createFullSystemBackup('6 Saatlik Periyodik Yedek');
    }, 6 * 60 * 60 * 1000);

    setInterval(async () => {
        if (gitDeployBusy) return;
        const st = await refreshGitStatus(true);
        if (gitAutoPullEnabled && st.hasUpdate) {
            await executeGitPullAndBuild('Otomatik GitHub Watchdog (60sn)');
            if (clearApiCache) clearApiCache();
        }
    }, 60000);

    setInterval(async () => {
        lastWatchdogCheckAt = new Date().toISOString();
        if (!autoRecoveryEnabled) return;

        if (!isPostgresReady()) {
            const reconnected = await testPgConnection();
            if (reconnected) {
                autoRecoveryCount++;
                logWatchdogEvent(
                    SERVER_TOPOLOGY.DB_DOCKER_SERVER.hostname,
                    'PostgreSQL bağlantısı otomatik olarak yeniden kuruldu',
                    'success',
                    `Aktif Host: ${getActivePostgresHost()}:5432`
                );
            } else {
                const remoteRes = await callRemoteSqlWatchdog('/restart', 'POST');
                if (remoteRes?.ok) {
                    autoRecoveryCount++;
                    await testPgConnection();
                    logWatchdogEvent(
                        SERVER_TOPOLOGY.DB_DOCKER_SERVER.hostname,
                        'Düşen Docker PostgreSQL konteyneri Watchdog ajanı ile otomatik ayağa kaldırıldı',
                        'warning',
                        remoteRes.message || 'yayin_planlama_db başlatıldı'
                    );
                }
            }
        }

        const mssqlInfo = getMssqlStatus ? getMssqlStatus() : { connected: true };
        if (!mssqlInfo.connected && typeof reconnectMssql === 'function') {
            const ok = await reconnectMssql();
            if (ok) {
                autoRecoveryCount++;
                logWatchdogEvent(
                    'MAM MSSQL',
                    'MSSQL bağlantı havuzu otomatik olarak yeniden başlatıldı',
                    'success',
                    `${SERVER_TOPOLOGY.MAM_MSSQL_SERVER.database} bağlantısı aktif`
                );
            }
        }
    }, 20000);

    // 1. TÜM SUNUCULARIN VE DOCKER KONTEYNERİNİN CANLI DURUMU
    router.get('/status', async (req, res) => {
        try {
            const appHost = SERVER_TOPOLOGY.APP_SERVER.ip;
            const backupHost = SERVER_TOPOLOGY.BACKUP_SERVER.ip;
            const dbHost = SERVER_TOPOLOGY.DB_DOCKER_SERVER.ip;
            const mssqlHost = SERVER_TOPOLOGY.MAM_MSSQL_SERVER.ip;
            const smbHost = SERVER_TOPOLOGY.MAM_SMB_STORAGE.ip;

            const [
                appBackendTcp,
                appFrontendTcp,
                backupBackendTcp,
                backupSshTcp,
                dbPostgresTcp,
                dbWatchdogInfo,
                mssqlTcp,
                smbTcp
            ] = await Promise.all([
                checkTcpPort(appHost, 3001, 1500),
                checkTcpPort(appHost, 5173, 1500),
                checkTcpPort(backupHost, 3001, 1500),
                checkTcpPort(backupHost, 22, 1500),
                checkTcpPort(dbHost, 5432, 1800),
                callRemoteSqlWatchdog('/status', 'GET'),
                checkTcpPort(mssqlHost, 1433, 1800),
                checkTcpPort(smbHost, 445, 1800)
            ]);

            let pgStats = {
                connected: isPostgresReady(),
                activeHost: getActivePostgresHost(),
                configuredHost: dbHost,
                schedulesCount: 0,
                programsCount: 0,
                clipsCount: 0,
                activeConnections: 0,
                dbSizePretty: '-'
            };

            if (isPostgresReady()) {
                try {
                    const [countsRes, connRes] = await Promise.all([
                        pgQuery(`
                            SELECT
                                (SELECT COUNT(*) FROM schedules)::int AS schedules_count,
                                (SELECT COUNT(*) FROM archive_programs)::int AS programs_count,
                                (SELECT COUNT(*) FROM archive_clips)::int AS clips_count,
                                pg_size_pretty(pg_database_size(current_database())) AS db_size
                        `),
                        pgQuery(`SELECT COUNT(*)::int AS active_conns FROM pg_stat_activity`)
                    ]);
                    if (countsRes.rows?.[0]) {
                        pgStats.schedulesCount = countsRes.rows[0].schedules_count || 0;
                        pgStats.programsCount = countsRes.rows[0].programs_count || 0;
                        pgStats.clipsCount = countsRes.rows[0].clips_count || 0;
                        pgStats.dbSizePretty = countsRes.rows[0].db_size || '-';
                    }
                    if (connRes.rows?.[0]) {
                        pgStats.activeConnections = connRes.rows[0].active_conns || 1;
                    }
                } catch (_) {}
            }

            const totalMemMb = Math.round(os.totalmem() / (1024 * 1024));
            const freeMemMb = Math.round(os.freemem() / (1024 * 1024));
            const usedMemMb = totalMemMb - freeMemMb;
            const memUsagePct = totalMemMb > 0 ? Math.round((usedMemMb / totalMemMb) * 100) : 0;
            const processMemMb = Math.round((process.memoryUsage().rss || 0) / (1024 * 1024));

            const mediaStats = getMediaCacheStats ? getMediaCacheStats() : {};
            const mssqlStatus = getMssqlStatus ? getMssqlStatus() : { connected: false };

            await refreshGitStatus(false);

            res.json({
                timestamp: new Date().toISOString(),
                security: getSecurityStatusSummary(),
                backups: listSavedBackups(),
                gitDeploy: {
                    autoPullEnabled: gitAutoPullEnabled,
                    isDeploying: gitDeployBusy,
                    ...gitStatusCache
                },
                watchdog: {
                    autoRecoveryEnabled,
                    lastCheckAt: lastWatchdogCheckAt || new Date().toISOString(),
                    autoRecoveryCount,
                    events: watchdogEvents
                },
                localHostRuntime: {
                    hostname: os.hostname(),
                    platform: `${os.type()} ${os.release()} (${process.platform})`,
                    nodeVersion: process.version,
                    processUptimeSec: Math.round(process.uptime()),
                    osUptimeSec: Math.round(os.uptime()),
                    cpuCores: os.cpus()?.length || 1,
                    loadAvg: os.loadavg ? os.loadavg().map(n => Math.round(n * 100) / 100) : [0, 0, 0],
                    totalMemMb,
                    usedMemMb,
                    memUsagePct,
                    processMemMb
                },
                nodes: {
                    appServer: {
                        id: 'app_primary',
                        hostname: SERVER_TOPOLOGY.APP_SERVER.hostname,
                        ip: appHost,
                        user: SERVER_TOPOLOGY.APP_SERVER.user,
                        role: 'Frontend (:5173) & Backend API (:3001) Ana Sunucu',
                        backendOnline: true,
                        backendPortReachable: appBackendTcp.reachable,
                        frontendPortReachable: appFrontendTcp.reachable,
                        latencyMs: appBackendTcp.latencyMs
                    },
                    dbDockerServer: {
                        id: 'sql_primary',
                        hostname: SERVER_TOPOLOGY.DB_DOCKER_SERVER.hostname,
                        ip: dbHost,
                        user: SERVER_TOPOLOGY.DB_DOCKER_SERVER.user,
                        role: 'Docker PostgreSQL 16 Veritabanı Sunucusu (:5432)',
                        port5432Reachable: dbPostgresTcp.reachable,
                        latencyMs: dbPostgresTcp.latencyMs,
                        postgres: pgStats,
                        watchdogAgentOnline: Boolean(dbWatchdogInfo?.ok),
                        dockerContainer: dbWatchdogInfo?.container || {
                            exists: pgStats.connected,
                            status: pgStats.connected ? 'running' : 'unreachable',
                            running: pgStats.connected
                        }
                    },
                    backupServer: {
                        id: 'backup_secondary',
                        hostname: SERVER_TOPOLOGY.BACKUP_SERVER.hostname,
                        ip: backupHost,
                        user: SERVER_TOPOLOGY.BACKUP_SERVER.user,
                        role: 'Yedekleme (pg_dump / rsync) & Standby Sunucu',
                        sshReachable: backupSshTcp.reachable,
                        standbyAppRunning: backupBackendTcp.reachable,
                        latencyMs: backupSshTcp.reachable ? backupSshTcp.latencyMs : backupBackendTcp.latencyMs
                    },
                    mamMssqlServer: {
                        id: 'mam_mssql',
                        hostname: SERVER_TOPOLOGY.MAM_MSSQL_SERVER.database,
                        ip: mssqlHost,
                        port: SERVER_TOPOLOGY.MAM_MSSQL_SERVER.port,
                        role: 'MAM MSSQL Arşiv & Klip Veritabanı',
                        portReachable: mssqlTcp.reachable,
                        poolConnected: mssqlStatus.connected,
                        latencyMs: mssqlTcp.latencyMs
                    },
                    smbMediaServer: {
                        id: 'smb_media',
                        hostname: 'Medya Arşiv Depolama (SMB)',
                        ip: smbHost,
                        port: 445,
                        role: `${SERVER_TOPOLOGY.MAM_SMB_STORAGE.highResPath} & ${SERVER_TOPOLOGY.MAM_SMB_STORAGE.yayinArsivPath}`,
                        portReachable: smbTcp.reachable,
                        latencyMs: smbTcp.latencyMs,
                        ...mediaStats
                    }
                }
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/reconnect-postgres', async (req, res) => {
        try {
            const ok = await testPgConnection();
            if (ok) {
                const initSqlPath = path.resolve('backend', 'db', 'init.sql');
                if (fs.existsSync(initSqlPath)) {
                    const sqlText = fs.readFileSync(initSqlPath, 'utf8');
                    await pgQuery(sqlText);
                }
                if (clearApiCache) clearApiCache();
                logWatchdogEvent(
                    SERVER_TOPOLOGY.DB_DOCKER_SERVER.hostname,
                    'PostgreSQL bağlantısı manuel olarak yenilendi ve tablo şemaları doğrulandı',
                    'success',
                    `Aktif Host: ${getActivePostgresHost()}:5432`
                );
                return res.json({
                    ok: true,
                    activeHost: getActivePostgresHost(),
                    message: `PostgreSQL (${getActivePostgresHost()}:5432) bağlantısı başarıyla yenilendi ve tablolar doğrulandı.`
                });
            }
            logWatchdogEvent(
                SERVER_TOPOLOGY.DB_DOCKER_SERVER.hostname,
                'PostgreSQL yeniden bağlanma denemesi başarısız oldu',
                'error',
                'Docker konteynerinin çalıştığından emin olun.'
            );
            res.status(500).json({
                ok: false,
                message: 'PostgreSQL sunucusuna şu an ulaşılamıyor. Docker konteynerini başlatın.'
            });
        } catch (err) {
            res.status(500).json({ ok: false, message: err.message });
        }
    });

    router.post('/restart-sql-docker', async (req, res) => {
        try {
            const remoteRes = await callRemoteSqlWatchdog('/restart', 'POST');
            if (remoteRes?.ok) {
                await new Promise(r => setTimeout(r, 2000));
                await testPgConnection();
                if (clearApiCache) clearApiCache();
                logWatchdogEvent(
                    SERVER_TOPOLOGY.DB_DOCKER_SERVER.hostname,
                    'Docker PostgreSQL (yayin_planlama_db) konteyneri uzaktan yeniden başlatıldı',
                    'success',
                    remoteRes.message || 'Konteyner çalışıyor'
                );
                return res.json({
                    ok: true,
                    message: 'yayin_planlama_db Docker konteyneri başarıyla yeniden başlatıldı!'
                });
            }

            const localRes = await runLocalDockerCommand('docker restart yayin_planlama_db');
            if (localRes.ok) {
                await new Promise(r => setTimeout(r, 1500));
                await testPgConnection();
                if (clearApiCache) clearApiCache();
                logWatchdogEvent(
                    'Docker PostgreSQL',
                    'yayin_planlama_db konteyneri yeniden başlatıldı',
                    'success',
                    localRes.output
                );
                return res.json({
                    ok: true,
                    message: 'yayin_planlama_db Docker konteyneri yeniden başlatıldı ve bağlantı kuruldu.'
                });
            }

            logWatchdogEvent(
                SERVER_TOPOLOGY.DB_DOCKER_SERVER.hostname,
                'Uzaktan Docker restart komutu iletilemedi (Watchdog ajanı henüz kurulmamış)',
                'warning',
                remoteRes?.error || localRes.error
            );
            res.status(400).json({
                ok: false,
                message: 'Veritabanı sunucusu üzerinde Watchdog servisi (Port 3005) henüz aktif değil.'
            });
        } catch (err) {
            res.status(500).json({ ok: false, message: err.message });
        }
    });

    router.post('/reconnect-mssql', async (req, res) => {
        try {
            const ok = typeof reconnectMssql === 'function' ? await reconnectMssql() : false;
            if (clearApiCache) clearApiCache();
            if (ok) {
                logWatchdogEvent(
                    'MAM MSSQL',
                    'MSSQL bağlantı havuzu manuel olarak yeniden başlatıldı',
                    'success',
                    `${SERVER_TOPOLOGY.MAM_MSSQL_SERVER.database} bağlantısı aktif`
                );
                return res.json({
                    ok: true,
                    message: 'MAM MSSQL bağlantı havuzu başarıyla sıfırlandı ve yeniden bağlandı.'
                });
            }
            logWatchdogEvent(
                'MAM MSSQL',
                'MSSQL yeniden bağlanma denemesi başarısız',
                'error',
                'MAM MSSQL sunucusuna erişilemiyor'
            );
            res.status(500).json({
                ok: false,
                message: 'MAM MSSQL sunucusuna şu an erişilemiyor.'
            });
        } catch (err) {
            res.status(500).json({ ok: false, message: err.message });
        }
    });

    router.post('/rescan-media', async (req, res) => {
        try {
            if (typeof rescanMediaCaches === 'function') {
                await rescanMediaCaches();
            }
            const stats = getMediaCacheStats ? getMediaCacheStats() : {};
            logWatchdogEvent(
                'Medya Arşiv Depolama (SMB)',
                'Medya ve video arşiv dizinleri yeniden tarandı',
                'success',
                `MAM: ${stats.cachedMamFiles || 0} dosya | Arşiv: ${stats.cachedArsivFiles || 0} dosya`
            );
            res.json({
                ok: true,
                stats,
                message: `Medya arşiv taraması tamamlandı. (${stats.cachedMamFiles || 0} MAM, ${stats.cachedArsivFiles || 0} Arşiv dosyası)`
            });
        } catch (err) {
            res.status(500).json({ ok: false, message: err.message });
        }
    });

    router.post('/restart-backend', async (req, res) => {
        const { hardExit = false } = req.body || {};
        try {
            if (clearApiCache) clearApiCache();
            await testPgConnection();
            if (typeof reconnectMssql === 'function') {
                await reconnectMssql();
            }
            logWatchdogEvent(
                SERVER_TOPOLOGY.APP_SERVER.hostname,
                hardExit
                    ? 'Backend süreci yeniden başlatılıyor (Systemd tarafından otomatik ayağa kaldırılacak)'
                    : 'Backend servis önbellekleri temizlendi ve tüm veritabanı havuzları yenilendi',
                'warning'
            );

            res.json({
                ok: true,
                message: hardExit
                    ? 'Backend servisi yeniden başlatılıyor... 2-3 saniye içinde otomatik olarak tekrar ayağa kalkacaktır.'
                    : 'Backend API önbelleği temizlendi, PostgreSQL ve MSSQL bağlantı havuzları başarıyla yenilendi.'
            });

            if (hardExit) {
                setTimeout(() => {
                    process.exit(0);
                }, 600);
            }
        } catch (err) {
            res.status(500).json({ ok: false, message: err.message });
        }
    });

    router.post('/toggle-watchdog', (req, res) => {
        autoRecoveryEnabled = !autoRecoveryEnabled;
        logWatchdogEvent(
            'Watchdog',
            `Otomatik Ayağa Kaldırma (Auto-Recovery) ${autoRecoveryEnabled ? 'AÇIK' : 'KAPALI'} konuma getirildi`,
            autoRecoveryEnabled ? 'success' : 'warning'
        );
        res.json({
            ok: true,
            autoRecoveryEnabled
        });
    });

    router.post('/toggle-git-autopull', (req, res) => {
        gitAutoPullEnabled = !gitAutoPullEnabled;
        logWatchdogEvent(
            'GitHub Auto-Deploy',
            `GitHub Otomatik Güncelleme (60sn Auto-Pull) ${gitAutoPullEnabled ? 'AÇIK' : 'KAPALI'} yapıldı`,
            gitAutoPullEnabled ? 'success' : 'warning'
        );
        res.json({
            ok: true,
            autoPullEnabled: gitAutoPullEnabled,
            message: `GitHub Otomatik Güncelleme ${gitAutoPullEnabled ? 'AÇIK (Her 60 saniyede bir yeni commit varsa otomatik çeker ve derler)' : 'KAPALI'}.`
        });
    });

    router.post('/git-pull-deploy', async (req, res) => {
        try {
            await refreshGitStatus(true);
            const result = await executeGitPullAndBuild('Admin Paneli Manuel Güncelleme');
            if (clearApiCache) clearApiCache();
            res.status(result.ok ? 200 : 500).json(result);
        } catch (err) {
            res.status(500).json({ ok: false, message: err.message });
        }
    });

    router.post('/backup-now', async (req, res) => {
        const result = await createFullSystemBackup('Admin Paneli Manuel Yedek');
        res.status(result.ok ? 200 : 500).json(result);
    });

    router.get('/download-backup/:fileName', (req, res) => {
        const safeName = path.basename(String(req.params.fileName || ''));
        const fullPath = path.join(backupsDir, safeName);
        if (!safeName.endsWith('.json.gz') || !fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'Yedek dosyası bulunamadı.' });
        }
        res.download(fullPath, safeName);
    });

    router.post('/clear-security-locks', (req, res) => {
        clearAllSecurityLocks();
        res.json({
            ok: true,
            message: 'Tüm Brute-Force ve DDoS IP kilitleri başarıyla temizlendi.'
        });
    });

    return router;
}
