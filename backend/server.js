/**
 * @file backend/server.js
 * @description Semerkand Medya Yayın Planlama Sistemi Backend API Sunucusu (Port: 3001).
 * 
 * Modüler Yapı:
 * - Doğrudan MSSQL & Medya Streaming uç noktaları (/api/categories, /api/programs, /api/searchClips, /api/stream)
 * - Taslak & Katalog Router (backend/routes/draftRoutes.js -> /api/draftSchedule, /api/saveDraftSchedule, /api/import*, /api/program*)
 * - MAM Arşiv Router (backend/routes/archiveRoutes.js -> /api/archive/*)
 */
import './config/envLoader.js';
import { SERVER_TOPOLOGY } from './config/envLoader.js';
import express from 'express';
import http from 'http';
import cors from 'cors';
import sql from 'mssql';
import NodeCache from 'node-cache';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import zlib from 'zlib';
import {
    syncAllClipsMetadataFromMssql,
    syncDeltaUpdatesFromMam,
    getCategoryMetadataSchemaMap,
    searchAllArchiveClips,
    ensureClipMetadataColumn,
    ensureParsingRulesTable,
    SQL_EXCLUDE_CLIPS_FILTER,
    isExcludedClip,
    parseMetadataSummary,
    parseClipWithMetadata
} from './services/archiveAnalyzer.js';
import { isPostgresReady, getActivePostgresHost, query as pgQuery, testConnection as testPgConnection } from './db/postgres.js';
import { createArchiveRouter } from './routes/archiveRoutes.js';
import { createDraftRouter } from './routes/draftRoutes.js';
import { createSystemMonitorRouter } from './routes/systemMonitorRoutes.js';
import { enterpriseSecurityMiddleware } from './middleware/securityMiddleware.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const cache = new NodeCache({ stdTTL: 60 }); // 60 saniyelik cache

let tvMamCache = [];
let tvYayinArsivCache = [];
let mamByStemMap = new Map();
let arsivByStemMap = new Map();
let cacheReadyPromise = null;

const CACHE_FILE = 'backend_cache.json';
const MEDIA_EXT_REGEX = /\.(mxf|mp4|mov|avi|mkv|ts|mpg|mpeg|wmv)$/i;

// İşletim sistemine (Windows UNC veya Linux/Docker Mount) göre otomatik medya kök dizinleri (.env üzerinden okunur)
const IS_WINDOWS = process.platform === 'win32';
const MAM_SMB_HOST = process.env.MAM_SMB_HOST || '127.0.0.1';
const MAM_SMB_DOMAIN = process.env.MAM_SMB_DOMAIN || '';
const MAM_SMB_USER = process.env.MAM_SMB_USER || '';
const MAM_SMB_PASSWORD = process.env.MAM_SMB_PASSWORD || '';
const MAM_SMB_SHARE_HIGHRES = process.env.MAM_SMB_SHARE_HIGHRES || 'tv_mam\\HighRes';
const MAM_SMB_SHARE_ARCHIVE = process.env.MAM_SMB_SHARE_ARCHIVE || 'tv_yayin_arsiv';

// Bizim DB (adsData.json + adsMedia.json + archive_seed_data.json.gz) bellek içi hızlı klip & reklam doğrulama indeksi
const localCatalogByFileId = new Map();
const localCatalogByName = new Map();

function initLocalMediaCatalogIndex() {
    try {
        const registerRec = (rec) => {
            if (!rec) return;
            if (rec.fileId) {
                const fidKey = String(rec.fileId).trim();
                const existing = localCatalogByFileId.get(fidKey);
                localCatalogByFileId.set(fidKey, {
                    ...(existing || {}),
                    ...rec,
                    name: rec.name || existing?.name || '',
                    clipName: rec.clipName || rec.name || existing?.clipName || existing?.name || '',
                    fileName: rec.fileName || existing?.fileName || `${fidKey}.mxf`
                });
            }
            // NOT: archive_clips.id (internalId) PostgreSQL seri anahtarıdır, MAM fileId ile çakışmaması için fileId haritasına EKLENMEZ!
            const merged = (rec.fileId && localCatalogByFileId.get(String(rec.fileId).trim())) || rec;
            [merged.clipName, merged.name, merged.title, merged.fileName].forEach(candidate => {
                if (!candidate) return;
                const low = String(candidate).trim().toLowerCase();
                if (!low) return;
                const stem = low.replace(/\.[^.]+$/, '');
                localCatalogByName.set(low, merged);
                localCatalogByName.set(stem, merged);
                localCatalogByName.set(`${stem}.mxf`, merged);
            });
        };

        // 1. src/data/adsMedia.json (1.598 Reklam Klibi: id: 21673, name: r_pinarli_gayrimenkul_25sn_240323, code: 4SDR4VPM.mxf)
        const adsMediaPath = path.resolve('src', 'data', 'adsMedia.json');
        if (fs.existsSync(adsMediaPath)) {
            const adsList = JSON.parse(fs.readFileSync(adsMediaPath, 'utf-8'));
            if (Array.isArray(adsList)) {
                adsList.forEach(ad => {
                    registerRec({
                        fileId: ad.id,
                        name: ad.name,
                        clipName: ad.name,
                        fileName: ad.code || `${ad.id}.mxf`,
                        durationSec: (Number(ad.duration) || 0) / 1000,
                        categoryId: 6,
                        categoryName: ad.category || 'Reklam',
                        source: 'Bizim DB & MAM Reklam Arşivi'
                    });
                });
            }
        }

        // 2. src/data/adsData.json (Reklam Rezervasyon Materyalleri: clipId: "21673", clipName: "r_pinarli_gayrimenkul_25sn_240323", name: "PINARLI GAYRİMENKUL")
        const adsDataPath = path.resolve('src', 'data', 'adsData.json');
        if (fs.existsSync(adsDataPath)) {
            const adsDataObj = JSON.parse(fs.readFileSync(adsDataPath, 'utf-8'));
            const materials = Array.isArray(adsDataObj?.materials) ? adsDataObj.materials : [];
            materials.forEach(m => {
                const cid = m.clipId || m.fileId;
                if (!cid && !m.clipName) return;
                registerRec({
                    fileId: cid,
                    name: m.clipName || m.name,
                    clipName: m.clipName || m.name,
                    title: m.name,
                    fileName: m.code || (cid ? `${cid}.mxf` : `${m.clipName}.mxf`),
                    durationSec: Number(m.durationSeconds || m.duration) || 0,
                    categoryId: 6,
                    categoryName: 'Reklam',
                    source: 'Bizim DB (Reklam Materyalleri)'
                });
            });
        }

        // 3. backend/db/archive_seed_data.json.gz (15.368 Program Klibi — file_id MAM ID'sidir!)
        const seedPath = path.resolve('backend', 'db', 'archive_seed_data.json.gz');
        if (fs.existsSync(seedPath)) {
            const seedObj = JSON.parse(zlib.gunzipSync(fs.readFileSync(seedPath)).toString('utf-8'));
            const clips = seedObj.archive_clips || seedObj.clips || [];
            if (Array.isArray(clips)) {
                clips.forEach(c => {
                    registerRec({
                        fileId: c.file_id || c.fileId,
                        internalId: c.id,
                        name: c.name,
                        clipName: c.name,
                        fileName: c.file_name || c.fileName,
                        durationSec: Number(c.duration_sec || c.durationSec) || 0,
                        categoryId: c.mam_category_id || c.category_id || c.categoryId,
                        categoryName: c.mam_category_name || '',
                        fileCreateTime: c.file_create_time || c.fileCreateTime || null,
                        source: 'Bizim DB (PostgreSQL Arşiv)'
                    });
                });
            }
        }
        console.log(`[CATALOG INDEX] Bellek içi doğrulama indeksi hazır -> MAM FileID Kaydı: ${localCatalogByFileId.size}, İsim/Kod Kaydı: ${localCatalogByName.size}`);
    } catch (e) {
        console.warn('[CATALOG INDEX WARN]:', e.message);
    }
}
initLocalMediaCatalogIndex();

function resolveEffectiveMediaRoot(envPath, winUncPath, linuxCandidates = []) {
    if (IS_WINDOWS) {
        if (envPath && !envPath.startsWith('/')) return envPath;
        return winUncPath;
    }
    const candidates = [envPath, ...linuxCandidates].filter(Boolean);
    for (const c of candidates) {
        try {
            if (fs.existsSync(c)) {
                const items = fs.readdirSync(c);
                if (items && items.length > 0) return c;
            }
        } catch (_) {}
    }
    for (const c of candidates) {
        try {
            if (fs.existsSync(c)) return c;
        } catch (_) {}
    }
    return envPath || linuxCandidates[0] || '/mnt/tv_mam/HighRes';
}

let MAM_HIGHRES_ROOT = resolveEffectiveMediaRoot(
    process.env.MAM_HIGHRES_PATH,
    `\\\\${MAM_SMB_HOST}\\${MAM_SMB_SHARE_HIGHRES}`,
    ['/mnt/tv_mam/HighRes', '/mnt/media_highres', '/mnt/tv_mam']
);
let YAYIN_ARSIV_ROOT = resolveEffectiveMediaRoot(
    process.env.YAYIN_ARSIV_PATH,
    `\\\\${MAM_SMB_HOST}\\${MAM_SMB_SHARE_ARCHIVE}`,
    ['/mnt/tv_yayin_arsiv', '/mnt/media_archive']
);

/**
 * Ortak alan SMB kimlik doğrulamasını (.env üzerindeki bilgilerle) başlatır.
 */
function ensureSmbAuthenticated() {
    return new Promise((resolve) => {
        if (IS_WINDOWS) {
            if (!MAM_SMB_USER || !MAM_SMB_PASSWORD) return resolve(true);
            const userArg = MAM_SMB_DOMAIN ? `/user:${MAM_SMB_DOMAIN}\\${MAM_SMB_USER}` : `/user:${MAM_SMB_USER}`;
            const proc = spawn('net', [
                'use',
                `\\\\${MAM_SMB_HOST}\\IPC$`,
                MAM_SMB_PASSWORD,
                userArg,
                '/persistent:yes'
            ]);
            proc.on('close', () => resolve(true));
            proc.on('error', () => resolve(false));
        } else {
            const proc = spawn('sudo', ['-n', 'mount', '-a']);
            proc.on('close', () => resolve(true));
            proc.on('error', () => resolve(false));
        }
    });
}

/**
 * Veritabanından veya önbellekten gelen Windows UNC yollarını çalıştığı işletim sistemine otomatik uyarlar.
 */
function resolveOsMediaPath(rootDir, relativePath = '') {
    const cleanRel = String(relativePath || '').replace(/^[\\/]+/, '');
    if (IS_WINDOWS) {
        return `${rootDir}\\${cleanRel.replace(/\//g, '\\')}`;
    }
    return path.posix.join(rootDir.replace(/\\/g, '/'), cleanRel.replace(/\\/g, '/'));
}

function normalizeUncPathForCurrentOs(rawPath) {
    if (!rawPath || typeof rawPath !== 'string') return '';
    const norm = rawPath.replace(/\\/g, '/');
    const highResMatch = norm.match(/^\/\/[^/]+\/[^/]+\/HighRes\/(.*)$/i);
    if (highResMatch) {
        return resolveOsMediaPath(MAM_HIGHRES_ROOT, highResMatch[1]);
    }
    const archiveMatch = norm.match(/^\/\/[^/]+\/([^/]+)\/(.*)$/i);
    if (archiveMatch) {
        return resolveOsMediaPath(YAYIN_ARSIV_ROOT, archiveMatch[2]);
    }
    return IS_WINDOWS ? rawPath : norm;
}

function rebuildFastFileLookupMaps() {
    const newMamMap = new Map();
    const newArsivMap = new Map();

    for (const rel of tvMamCache) {
        if (!rel || !MEDIA_EXT_REGEX.test(rel)) continue;
        const base = rel.split(/[\\/]/).pop() || '';
        const lowerBase = base.toLowerCase();
        const stem = lowerBase.replace(/\.[^.]+$/, '');
        const fullPath = resolveOsMediaPath(MAM_HIGHRES_ROOT, rel);
        if (stem && !newMamMap.has(stem)) newMamMap.set(stem, fullPath);
        if (lowerBase && !newMamMap.has(lowerBase)) newMamMap.set(lowerBase, fullPath);
    }

    for (const rel of tvYayinArsivCache) {
        if (!rel || !MEDIA_EXT_REGEX.test(rel)) continue;
        const base = rel.split(/[\\/]/).pop() || '';
        const lowerBase = base.toLowerCase();
        const stem = lowerBase.replace(/\.[^.]+$/, '');
        const fullPath = resolveOsMediaPath(YAYIN_ARSIV_ROOT, rel);
        if (stem && !newArsivMap.has(stem)) newArsivMap.set(stem, fullPath);
        if (lowerBase && !newArsivMap.has(lowerBase)) newArsivMap.set(lowerBase, fullPath);
    }

    mamByStemMap = newMamMap;
    arsivByStemMap = newArsivMap;
}

// Başlangıçta diskteki önbelleği (backend_cache.json) anında senkron yükle ki ağ taraması sürerken stream bekletmesin
try {
    if (fs.existsSync(CACHE_FILE)) {
        const initialSaved = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        tvMamCache = initialSaved.tvMamCache || [];
        tvYayinArsivCache = initialSaved.tvYayinArsivCache || [];
        rebuildFastFileLookupMaps();
        console.log(`[CACHE INIT] Önbellek yüklendi -> HighRes: ${tvMamCache.length} (${MAM_HIGHRES_ROOT}), Archive: ${tvYayinArsivCache.length} (${YAYIN_ARSIV_ROOT})`);
    }
} catch (_) {}

let hasPerformedLiveStartupScan = false;

async function buildFileCaches() {
    try {
        await ensureSmbAuthenticated();
        MAM_HIGHRES_ROOT = resolveEffectiveMediaRoot(
            process.env.MAM_HIGHRES_PATH,
            `\\\\${MAM_SMB_HOST}\\${MAM_SMB_SHARE_HIGHRES}`,
            ['/mnt/tv_mam/HighRes', '/mnt/media_highres', '/mnt/tv_mam']
        );
        YAYIN_ARSIV_ROOT = resolveEffectiveMediaRoot(
            process.env.YAYIN_ARSIV_PATH,
            `\\\\${MAM_SMB_HOST}\\${MAM_SMB_SHARE_ARCHIVE}`,
            ['/mnt/tv_yayin_arsiv', '/mnt/media_archive']
        );

        let savedCache = null;
        if (fs.existsSync(CACHE_FILE)) {
            savedCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
            if (tvMamCache.length === 0 && tvYayinArsivCache.length === 0) {
                tvMamCache = savedCache.tvMamCache || [];
                tvYayinArsivCache = savedCache.tvYayinArsivCache || [];
                rebuildFastFileLookupMaps();
            }
        }

        const mamPath = MAM_HIGHRES_ROOT;
        const arsivPath = YAYIN_ARSIV_ROOT;

        let mamStat = { size: 0, mtimeMs: 0 };
        let arsivStat = { size: 0, mtimeMs: 0 };
        try {
            mamStat = await fs.promises.stat(mamPath);
            arsivStat = await fs.promises.stat(arsivPath);
        } catch (e) {
            console.log('[CACHE] Klasör bilgileri alınamadı, taramaya devam ediliyor...');
        }

        const cacheKey = `${mamStat.size}-${mamStat.mtimeMs}-${arsivStat.size}-${arsivStat.mtimeMs}`;

        // ÖNEMLİ: cacheKey '0-0-0-0' ise veya sunucu açılışında henüz canlı ağ taraması yapılmadıysa ASLA taramayı atlama!
        if (hasPerformedLiveStartupScan && cacheKey !== '0-0-0-0' && savedCache && savedCache.cacheKey === cacheKey) {
            console.log('[CACHE] Dosya sisteminde değişiklik yok. Hızlı cache aktif...');
            tvMamCache = savedCache.tvMamCache || [];
            tvYayinArsivCache = savedCache.tvYayinArsivCache || [];
            rebuildFastFileLookupMaps();
            console.log(`[CACHE] HighRes: ${tvMamCache.length}, Archive: ${tvYayinArsivCache.length} dosya (Index hazır).`);
            return;
        }

        console.log('[CACHE] Medya HighRes (ID tabanlı) ve Yayın Arşiv (İsim tabanlı) dizinleri taranıyor...');
        let scannedMam = [];
        let scannedArsiv = [];
        try {
            scannedMam = await fs.promises.readdir(mamPath, { recursive: true });
            console.log(`[CACHE] HighRes taraması bitti. ${scannedMam.length} dosya bulundu.`);
        } catch (e) { console.error('[CACHE] HighRes okunamadı:', e.message); }
        
        console.log('[CACHE] Medya Yayın Arşiv dizini taranıyor...');
        try {
            scannedArsiv = await fs.promises.readdir(arsivPath, { recursive: true });
            console.log(`[CACHE] Yayın Arşiv taraması bitti. ${scannedArsiv.length} dosya bulundu.`);
        } catch (e) { console.error('[CACHE] Yayın Arşiv okunamadı:', e.message); }

        hasPerformedLiveStartupScan = true;

        // Eğer Docker/Linux içinde ağ paylaşımı henüz mount edilmemişse (0 dosya dönerse) mevcut önbelleği koru
        if (scannedMam.length === 0 && scannedArsiv.length === 0 && savedCache && ((savedCache.tvMamCache?.length || 0) > 0 || (savedCache.tvYayinArsivCache?.length || 0) > 0)) {
            console.log('[CACHE] Ağ dizinleri boş veya mount edilmemiş, mevcut önbellek korunuyor...');
            tvMamCache = savedCache.tvMamCache || [];
            tvYayinArsivCache = savedCache.tvYayinArsivCache || [];
            rebuildFastFileLookupMaps();
            console.log(`[CACHE] Korunan önbellek: HighRes: ${tvMamCache.length}, Archive: ${tvYayinArsivCache.length} dosya.`);
            return;
        }

        if (scannedMam.length > 0) tvMamCache = scannedMam;
        if (scannedArsiv.length > 0) tvYayinArsivCache = scannedArsiv;
        rebuildFastFileLookupMaps();

        if (tvMamCache.length > 0 || tvYayinArsivCache.length > 0) {
            const effectiveCacheKey = cacheKey !== '0-0-0-0' ? cacheKey : `scanned-${tvMamCache.length}-${tvYayinArsivCache.length}`;
            fs.writeFileSync(CACHE_FILE, JSON.stringify({
                cacheKey: effectiveCacheKey,
                tvMamCache,
                tvYayinArsivCache
            }), 'utf-8');
            console.log('[CACHE] Yeni dosya listesi diske kaydedildi.');
        }

    } catch (err) {
        console.error('[CACHE] Hata oluştu:', err);
    }
}

cacheReadyPromise = buildFileCaches();
setInterval(() => { cacheReadyPromise = buildFileCaches(); }, 15 * 60 * 1000);

app.use(cors());
app.use(enterpriseSecurityMiddleware);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const dbConfig = {
    user: process.env.MSSQL_USER || '',
    password: process.env.MSSQL_PASSWORD || '',
    server: process.env.MSSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MSSQL_PORT || '1433', 10),
    database: process.env.MSSQL_DATABASE || 'MAM_DB',
    options: { encrypt: false, trustServerCertificate: true },
    connectionTimeout: parseInt(process.env.MSSQL_CONNECT_TIMEOUT || '5000', 10),
    requestTimeout: parseInt(process.env.MSSQL_REQUEST_TIMEOUT || '15000', 10)
};

let isMssqlConnected = false;
let poolPromise = connectMssqlPool();

function connectMssqlPool() {
    return new sql.ConnectionPool(dbConfig)
        .connect()
        .then(pool => {
            isMssqlConnected = true;
            console.log(`MSSQL Bağlantısı Başarılı! (${dbConfig.server}/${dbConfig.database})`);
            return pool;
        })
        .catch(err => {
            isMssqlConnected = false;
            console.log('MSSQL Bağlantı Hatası: ', err?.message || err);
            return null;
        });
}

async function reconnectMssqlPool() {
    try {
        const oldPool = await poolPromise;
        if (oldPool && typeof oldPool.close === 'function') {
            await oldPool.close().catch(() => {});
        }
    } catch (_) {}
    poolPromise = connectMssqlPool();
    const nextPool = await poolPromise;
    return Boolean(nextPool && isMssqlConnected);
}

async function getActiveMssqlPool() {
    try {
        let pool = await poolPromise;
        if (pool && pool.connected) return pool;
        await reconnectMssqlPool();
        pool = await poolPromise;
        return pool && pool.connected ? pool : null;
    } catch (_) {
        return null;
    }
}

// Sistem & Kurulum Sağlık Kontrolü (Docker Healthcheck ve 3 Sunuculu Topoloji Doğrulama Uç Noktası)
app.get('/api/health', (req, res) => {
    const safeTopology = {
        APP_SERVER: {
            hostname: SERVER_TOPOLOGY.APP_SERVER.hostname,
            frontendPort: SERVER_TOPOLOGY.APP_SERVER.frontendPort,
            backendPort: SERVER_TOPOLOGY.APP_SERVER.backendPort
        },
        BACKUP_SERVER: {
            hostname: SERVER_TOPOLOGY.BACKUP_SERVER.hostname,
            frontendPort: SERVER_TOPOLOGY.BACKUP_SERVER.frontendPort,
            backendPort: SERVER_TOPOLOGY.BACKUP_SERVER.backendPort
        },
        DB_DOCKER_SERVER: {
            hostname: SERVER_TOPOLOGY.DB_DOCKER_SERVER.hostname,
            postgresPort: SERVER_TOPOLOGY.DB_DOCKER_SERVER.postgresPort
        },
        MAM_MSSQL_SERVER: {
            port: SERVER_TOPOLOGY.MAM_MSSQL_SERVER.port,
            database: SERVER_TOPOLOGY.MAM_MSSQL_SERVER.database
        },
        MAM_SMB_STORAGE: {
            highResPath: SERVER_TOPOLOGY.MAM_SMB_STORAGE.highResPath,
            yayinArsivPath: SERVER_TOPOLOGY.MAM_SMB_STORAGE.yayinArsivPath
        }
    };
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        platform: process.platform,
        topology: safeTopology,
        postgres: {
            connected: isPostgresReady(),
            port: parseInt(process.env.PG_PORT || '5432', 10),
            database: process.env.PG_DATABASE || 'yayin_planlama'
        },
        mssql: {
            connected: isMssqlConnected,
            port: dbConfig.port,
            database: dbConfig.database
        },
        mediaPaths: {
            mamHighResRoot: MAM_HIGHRES_ROOT,
            yayinArsivRoot: YAYIN_ARSIV_ROOT,
            cachedMamFiles: tvMamCache.length,
            cachedArsivFiles: tvYayinArsivCache.length
        }
    });
});

// Kategorileri Getir (Önce yerel PostgreSQL'den, Ham ve Reklam hariç)
app.get('/api/categories', async (req, res) => {
    try {
        const cacheKey = 'categories_v2';
        if (cache.has(cacheKey)) {
            return res.json(cache.get(cacheKey));
        }

        if (isPostgresReady()) {
            const pgRes = await pgQuery(`
                SELECT id as "categoryId", name as "categoryName"
                FROM categories
                WHERE id NOT IN (6, 11)
                ORDER BY id ASC
            `);
            if (pgRes.rows.length > 0) {
                const schemaMap = await getCategoryMetadataSchemaMap(null, false);
                const categoriesWithMeta = pgRes.rows.map(cat => ({
                    id: cat.categoryId,
                    categoryId: cat.categoryId,
                    name: cat.categoryName,
                    categoryName: cat.categoryName,
                    categoryPath: `/${cat.categoryName}`,
                    metadataFields: schemaMap[cat.categoryId] || []
                }));
                cache.set(cacheKey, categoriesWithMeta);
                return res.json(categoriesWithMeta);
            }
        }

        const pool = await poolPromise;
        const schemaMap = await getCategoryMetadataSchemaMap(pool, true);
        const result = await pool.request().query(`
            SELECT categoryId, categoryName, categoryPath
            FROM Categories
            WHERE categoryId NOT IN (6, 11)
            ORDER BY categoryId ASC
        `);

        const categoriesWithMeta = (result.recordset || []).map(cat => ({
            id: cat.categoryId,
            categoryId: cat.categoryId,
            name: cat.categoryName,
            categoryName: cat.categoryName,
            categoryPath: cat.categoryPath,
            metadataFields: schemaMap[cat.categoryId] || []
        }));

        cache.set(cacheKey, categoriesWithMeta);
        res.json(categoriesWithMeta);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Generic Clip Search (Önce yerel PostgreSQL archive_clips tablosundan hızlı arama)
app.get('/api/searchClips', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.json([]);
        }

        if (isPostgresReady()) {
            const clips = await searchAllArchiveClips(query, null, null, 50, false);
            return res.json(clips.map(c => ({
                id: c.fileId,
                title: c.name,
                fileName: c.fileName,
                duration: (c.durationSec || 0) / 60.0,
                categoryId: c.categoryId,
                fileCreateTime: c.fileCreateTime,
                episodeNo: c.episodeNo,
                partNo: c.partNo,
                unitType: c.unitType,
                unitLabel: c.unitLabel,
                note: c.note,
                programTitle: c.programTitle
            })));
        }

        const pool = await poolPromise;
        const request = pool.request();
        
        const words = query.trim().split(/\s+/).map(w => w.replace(/[^a-zA-Z0-9]/g, ''));
        
        let sqlQuery = `
            SELECT TOP 50 
                f.fileId as id, 
                f.name as title, 
                f.fileName, 
                f.duration / 60.0 as duration, 
                f.categoryId,
                f.fileCreateTime,
                f.publicFileAddress
            FROM Files f
            WHERE f.deleted = 0 AND f.duration > 0
              AND f.categoryId NOT IN (6, 11)
              ${SQL_EXCLUDE_CLIPS_FILTER}
        `;
        
        words.forEach((word, idx) => {
            if (word.length > 2) {
                request.input(`word${idx}`, sql.VarChar, `%${word}%`);
                sqlQuery += ` AND (f.name LIKE @word${idx} OR f.fileName LIKE @word${idx})`;
            }
        });
        
        sqlQuery += ` ORDER BY f.fileId DESC`;
        
        const result = await request.query(sqlQuery);
        res.json((result.recordset || []).filter(r => !isExcludedClip(r.title, r.fileName)));
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Programları / Klipleri Getir (Önce yerel PostgreSQL archive_clips + archive_programs tablosundan hızlı okuma)
app.get('/api/programs', async (req, res) => {
    try {
        const { categoryId, search } = req.query;

        const cacheKey = `programs_v2_${categoryId || 'all'}_${search || 'none'}`;
        if (cache.has(cacheKey)) {
            return res.json(cache.get(cacheKey));
        }

        const categoryColors = {
            1: '#8b5cf6', // Kadın - Mor
            2: '#ef4444', // Haber - Kırmızı
            3: '#3b82f6', // Tanıtım - Mavi
            4: '#10b981', // Dini - Yeşil
            5: '#f59e0b', // Çocuk - Turuncu
            7: '#ec4899', // Jenerik - Pembe
            8: '#14b8a6', // Kültürel - Turkuaz
            9: '#8b5cf6', // Detay - Mor
            10: '#06b6d4' // Kısa Program - Camgöbeği
        };

        if (isPostgresReady()) {
            const topLimit = search ? 1500 : 300;
            const clips = await searchAllArchiveClips(search || '', categoryId || null, null, topLimit, false);
            if (clips.length > 0 || search) {
                const formatted = clips.map(c => ({
                    id: String(c.fileId),
                    title: c.name,
                    name: c.name,
                    programTitle: c.programTitle,
                    episodeNo: c.episodeNo,
                    partNo: c.partNo,
                    unitType: c.unitType || 'bolum',
                    unitLabel: c.unitLabel || null,
                    note: c.note,
                    duration: (c.durationSec || 0) / 60.0,
                    durationSec: c.durationSec || 0,
                    categoryId: c.categoryId,
                    categoryName: c.categoryName,
                    fileCreateTime: c.fileCreateTime,
                    fileName: c.fileName,
                    color: categoryColors[c.categoryId] || '#6366f1',
                    metadataSummary: c.metadataSummary || {}
                }));
                cache.set(cacheKey, formatted);
                return res.json(formatted);
            }
        }

        const pool = await poolPromise;
        let request = pool.request();

        let topCount = search ? 1500 : 300;
        let query = `
            SELECT TOP ${topCount} 
                f.fileId, 
                f.name, 
                f.duration, 
                f.categoryId, 
                c.categoryName,
                f.fileCreateTime,
                f.fileName,
                f.extension,
                f.publicFileAddress,
                f.fileServerPath,
                f.trimIn,
                f.trimOut,
                (
                    SELECT mf.displayName as keyName, 
                           COALESCE(fm.stringvalue, CONVERT(varchar, fm.dateValue, 120), CAST(fm.integerValue as varchar)) as val
                    FROM FileMetadata fm
                    JOIN MetadataFields mf ON mf.metadataId = fm.metadataId
                    WHERE fm.fileId = f.fileId
                      AND COALESCE(fm.stringvalue, CONVERT(varchar, fm.dateValue, 120), CAST(fm.integerValue as varchar)) IS NOT NULL
                      AND LTRIM(RTRIM(COALESCE(fm.stringvalue, CONVERT(varchar, fm.dateValue, 120), CAST(fm.integerValue as varchar)))) <> ''
                    FOR JSON PATH
                ) as metadataJson
            FROM Files f 
            LEFT JOIN Categories c ON c.categoryId = f.categoryId
            WHERE f.duration IS NOT NULL AND f.duration > 0 AND f.deleted = 0
              AND f.categoryId NOT IN (6, 11)
              ${SQL_EXCLUDE_CLIPS_FILTER}
        `;

        if (categoryId) {
            query += ` AND f.categoryId = @categoryId`;
            request.input('categoryId', sql.Int, parseInt(categoryId));
        } else if (!search) {
            query += ` AND f.categoryId NOT IN (2, 6, 11)`;
        }

        if (search) {
            const map = {
                'c': '[cCçÇ]', 'ç': '[cCçÇ]', 'C': '[cCçÇ]', 'Ç': '[cCçÇ]',
                'g': '[gGğĞ]', 'ğ': '[gGğĞ]', 'G': '[gGğĞ]', 'Ğ': '[gGğĞ]',
                'i': '[iİıI]', 'ı': '[iİıI]', 'İ': '[iİıI]', 'I': '[iİıI]',
                'o': '[oOöÖ]', 'ö': '[oOöÖ]', 'O': '[oOöÖ]', 'Ö': '[oOöÖ]',
                's': '[sSşŞ]', 'ş': '[sSşŞ]', 'S': '[sSşŞ]', 'Ş': '[sSşŞ]',
                'u': '[uUüÜ]', 'ü': '[uUüÜ]', 'U': '[uUüÜ]', 'Ü': '[uUüÜ]'
            };
            const regexSearch = search.split('').map(char => {
                if (char === ' ') return '%';
                return map[char] || char;
            }).join('');
            
            query += ` AND (f.name LIKE @search OR f.fileName LIKE @search)`;
            request.input('search', sql.NVarChar, `%${regexSearch}%`);
        }

        query += ` ORDER BY f.fileCreateTime DESC`;

        const result = await request.query(query);

        const formattedPrograms = [];
        for (const file of result.recordset || []) {
            let metadata = [];
            if (file.metadataJson) {
                try {
                    metadata = JSON.parse(file.metadataJson);
                } catch (e) { }
            }

            if (isExcludedClip(file.name, file.fileName, metadata)) {
                continue;
            }

            const { list: cleanMetadata, summary: metadataSummary } = parseMetadataSummary(metadata);
            const parsed = parseClipWithMetadata(file.name, file.categoryId, metadataSummary);
            const durationInMinutes = file.duration / 60000;

            formattedPrograms.push({
                id: file.fileId.toString(),
                title: file.name,
                programTitle: parsed.program,
                episodeNo: parsed.episode,
                partNo: parsed.part,
                unitType: parsed.unitType || 'bolum',
                unitLabel: parsed.unitLabel || null,
                note: parsed.note,
                duration: durationInMinutes,
                categoryId: file.categoryId,
                categoryName: file.categoryName,
                fileCreateTime: file.fileCreateTime,
                fileName: file.fileName,
                extension: file.extension,
                publicFileAddress: file.publicFileAddress,
                fileServerPath: file.fileServerPath,
                trimIn: file.trimIn,
                trimOut: file.trimOut,
                color: categoryColors[file.categoryId] || '#6366f1',
                metadata: cleanMetadata,
                metadataSummary
            });
        }

        cache.set(cacheKey, formattedPrograms);
        res.json(formattedPrograms);
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

const HIGHRES_CATEGORY_FOLDER_MAP = {
    1: 'kadin',
    2: 'haber',
    3: 'tanitim',
    4: 'dini',
    5: 'cocuk',
    6: 'reklam',
    7: 'jenerik',
    8: 'kulturel',
    9: 'detay',
    10: 'kisaprogram',
    11: 'ham'
};

/**
 * Klip adındaki "_240323" (GGAAYY) veya fileCreateTime bilgisinden YYYY/MM/DD tarih klasörü adaylarını çıkarır.
 * Örn: "r_pinarli_gayrimenkul_25sn_240323" -> ["2023/03/24"]
 */
function extractHighResDateFolders(fileCreateTime, ...nameCandidates) {
    const folders = new Set();
    if (fileCreateTime) {
        try {
            const d = new Date(fileCreateTime);
            if (!isNaN(d.getTime())) {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                folders.add(`${yyyy}/${mm}/${dd}`);
                // UTC / yerel saat farkı (+/- 1 gün) ihtimaline karşı
                const prev = new Date(d.getTime() - 86400000);
                folders.add(`${prev.getFullYear()}/${String(prev.getMonth() + 1).padStart(2, '0')}/${String(prev.getDate()).padStart(2, '0')}`);
            }
        } catch (_) {}
    }

    for (const raw of nameCandidates) {
        if (!raw) continue;
        const s = String(raw).trim().replace(/\.[^.]+$/, '');
        // _GGAAYY (örn: _240323 -> 24 Mart 2023 -> 2023/03/24)
        const matches = s.match(/(?:^|_)(\d{2})(\d{2})(\d{2})(?:$|_)/g) || [];
        for (const token of matches) {
            const clean = token.replace(/_/g, '');
            if (clean.length === 6) {
                const dd = parseInt(clean.slice(0, 2), 10);
                const mm = parseInt(clean.slice(2, 4), 10);
                const yy = parseInt(clean.slice(4, 6), 10);
                if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
                    const yyyy = 2000 + yy;
                    folders.add(`${yyyy}/${String(mm).padStart(2, '0')}/${String(dd).padStart(2, '0')}`);
                }
            }
        }
    }
    return Array.from(folders);
}

/**
 * HighRes ve Yayın Arşiv Çift Katmanlı (Dual-Storage) Dosya Yolu Çözümleyicisi:
 * 1. HighRes (\192.168.3.70\tv_mam\HighRes veya /mnt/tv_mam/HighRes):
 *    - Dosyalar öncelikle MAM FileID (<fileId>.mxf, örn: 21673.mxf) ile "<kategori>/<YYYY>/<MM>/<DD>/<fileId>.mxf" yapısında tutulur.
 *    - Hem ID (<fileId>.mxf), hem tarihli kategori yolu, hem klip ismi, hem de dosya kodu ile aranır.
 * 2. Yayın Arşiv (\192.168.3.70\tv_yayin_arsiv veya /mnt/tv_yayin_arsiv):
 *    - Dosyalar öncelikle Klip İsmi (<clipName>.mxf, örn: r_pinarli_gayrimenkul_25sn_240323.mxf veya saliha_hanimlar_19_260118_p2.mxf) ile "<klasör>/<clipName>.mxf" yapısında tutulur.
 *    - Hem klip ismi (<clipName>.mxf), hem alt klasörlü klip ismi (reklam/<clipName>.mxf, <program>/<clipName>.mxf), hem de ID ve dosya kodu ile aranır.
 */
function resolveDualStorageVideo({
    fileId,
    clipName,
    name,
    title,
    fileName,
    code,
    categoryId,
    categoryName,
    fileCreateTime,
    publicAddress,
    isAd
} = {}) {
    const cleanId = extractPureNumericFileId(fileId, code, fileName);
    const primaryClipName = String(clipName || name || '').trim().replace(/\.[^.]+$/, '');

    // --- 1. HIGHRES ARAMASI (ID ÖNCELİKLİ: <fileId>.mxf + İsim + Kod + Tarih/Kategori Dizini) ---
    let highResPath = null;
    const highResCandidates = [
        cleanId,
        cleanId ? `${cleanId}.mxf` : null,
        cleanId ? `${cleanId}.MXF` : null,
        primaryClipName,
        name,
        clipName,
        fileName,
        code,
        title
    ].filter(Boolean);

    for (const raw of highResCandidates) {
        const origBase = String(raw).trim().split(/[\\/]/).pop();
        if (!origBase) continue;
        const lowerBase = origBase.toLowerCase();
        const stem = lowerBase.replace(/\.[^.]+$/, '');
        if (stem && mamByStemMap.has(stem)) {
            highResPath = mamByStemMap.get(stem);
            break;
        }
        if (lowerBase && mamByStemMap.has(lowerBase)) {
            highResPath = mamByStemMap.get(lowerBase);
            break;
        }
    }

    // HighRes içinde doğrudan disk kontrolü (Önbellekte henüz yoksa bile <kategori>/<YYYY>/<MM>/<DD>/<fileId>.mxf ve kök dizinde kontrol et)
    if (!highResPath) {
        const normPub = normalizeUncPathForCurrentOs(publicAddress);
        if (normPub && isSafeReachableUncPath(normPub) && normPub.toLowerCase().includes('highres') && fs.existsSync(normPub)) {
            highResPath = normPub;
        }
    }

    if (!highResPath && cleanId) {
        const dateFolders = extractHighResDateFolders(fileCreateTime, primaryClipName, name, clipName, title);
        const catFolders = new Set();
        if (categoryId && HIGHRES_CATEGORY_FOLDER_MAP[categoryId]) {
            catFolders.add(HIGHRES_CATEGORY_FOLDER_MAP[categoryId]);
        }
        if (isAd || String(primaryClipName).toLowerCase().startsWith('r_') || String(categoryName || '').toLowerCase().includes('reklam')) {
            catFolders.add('reklam');
        }
        ['dini', 'reklam', 'kulturel', 'kisaprogram', 'kadin', 'jenerik', 'cocuk', 'tanitim', 'detay', 'haber'].forEach(c => catFolders.add(c));

        // 1A. <kategori>/<YYYY>/<MM>/<DD>/<fileId>.mxf
        for (const cat of catFolders) {
            for (const df of dateFolders) {
                for (const ext of ['mxf', 'MXF', 'mp4']) {
                    const rel = `${cat}/${df}/${cleanId}.${ext}`;
                    const candidatePath = resolveOsMediaPath(MAM_HIGHRES_ROOT, rel);
                    if (fs.existsSync(candidatePath)) {
                        highResPath = candidatePath;
                        mamByStemMap.set(String(cleanId).toLowerCase(), candidatePath);
                        mamByStemMap.set(`${String(cleanId).toLowerCase()}.${ext.toLowerCase()}`, candidatePath);
                        break;
                    }
                }
                if (highResPath) break;
            }
            if (highResPath) break;
        }

        // 1B. Doğrudan HighRes kökünde veya kategori altında <fileId>.mxf
        if (!highResPath) {
            const directIdPaths = [
                `${cleanId}.mxf`,
                `${cleanId}.MXF`,
                `reklam/${cleanId}.mxf`,
                `reklam/${cleanId}.MXF`
            ];
            for (const rel of directIdPaths) {
                const p = resolveOsMediaPath(MAM_HIGHRES_ROOT, rel);
                if (fs.existsSync(p)) {
                    highResPath = p;
                    mamByStemMap.set(String(cleanId).toLowerCase(), p);
                    break;
                }
            }
        }
    }

    // --- 2. YAYIN ARŞİV ARAMASI (KLİP İSMİ ÖNCELİKLİ: <clipName>.mxf + Alt Klasör + ID + Kod) ---
    let arsivPath = null;
    const arsivCandidates = [
        primaryClipName,
        clipName,
        name,
        title,
        fileName,
        code,
        cleanId,
        cleanId ? `${cleanId}.mxf` : null
    ].filter(Boolean);

    for (const raw of arsivCandidates) {
        const origBase = String(raw).trim().split(/[\\/]/).pop();
        if (!origBase) continue;
        const lowerBase = origBase.toLowerCase();
        const stem = lowerBase.replace(/\.[^.]+$/, '');
        if (stem && arsivByStemMap.has(stem)) {
            arsivPath = arsivByStemMap.get(stem);
            break;
        }
        if (lowerBase && arsivByStemMap.has(lowerBase)) {
            arsivPath = arsivByStemMap.get(lowerBase);
            break;
        }
    }

    // Yayın Arşiv içinde doğrudan disk kontrolü (<clipName>.mxf, reklam/<clipName>.mxf, <programPrefix>/<clipName>.mxf)
    if (!arsivPath) {
        const normPub = normalizeUncPathForCurrentOs(publicAddress);
        if (normPub && isSafeReachableUncPath(normPub) && !normPub.toLowerCase().includes('highres') && fs.existsSync(normPub)) {
            arsivPath = normPub;
        }
    }

    if (!arsivPath) {
        const nameStems = Array.from(new Set(
            [primaryClipName, clipName, name, title, fileName, code, cleanId]
                .filter(Boolean)
                .map(s => String(s).trim().split(/[\\/]/).pop().replace(/\.[^.]+$/, ''))
                .filter(s => s.length >= 3)
        ));

        for (const stem of nameStems) {
            const progPrefix = stem.split('_')[0] || '';
            const relCandidates = [
                `${stem}.mxf`,
                `${stem}.MXF`,
                `reklam/${stem}.mxf`,
                `reklam/${stem}.MXF`,
                progPrefix ? `${progPrefix}/${stem}.mxf` : null,
                progPrefix ? `${progPrefix.toLowerCase()}/${stem}.mxf` : null,
                `${stem}.mp4`
            ].filter(Boolean);

            for (const rel of relCandidates) {
                const p = resolveOsMediaPath(YAYIN_ARSIV_ROOT, rel);
                if (fs.existsSync(p)) {
                    arsivPath = p;
                    arsivByStemMap.set(stem.toLowerCase(), p);
                    arsivByStemMap.set(`${stem.toLowerCase()}.mxf`, p);
                    break;
                }
            }
            if (arsivPath) break;
        }
    }

    const finalVideoPath = highResPath || arsivPath || null;
    const matchedInHighRes = Boolean(highResPath);
    const matchedInArsiv = Boolean(arsivPath);
    const storageLocation = matchedInHighRes && matchedInArsiv
        ? 'HighRes (ID) & Yayın Arşiv (İsim)'
        : matchedInHighRes
        ? 'HighRes (ID)'
        : matchedInArsiv
        ? 'Yayın Arşiv (İsim)'
        : null;

    return {
        finalVideoPath,
        highResPath,
        arsivPath,
        matchedInHighRes,
        matchedInArsiv,
        storageLocation,
        highResIdFileName: cleanId ? `${cleanId}.mxf` : (highResPath ? path.basename(highResPath) : null),
        arsivNameFileName: primaryClipName ? `${primaryClipName}.mxf` : (arsivPath ? path.basename(arsivPath) : null)
    };
}

function lookupCachedVideoPath(candidates = []) {
    const dual = resolveDualStorageVideo({
        fileId: extractPureNumericFileId(...candidates),
        clipName: candidates.find(c => c && !/^\d+(\.mxf)?$/i.test(String(c).trim())),
        fileName: candidates[0],
        code: candidates[1]
    });
    if (dual.finalVideoPath) return dual.finalVideoPath;

    for (const raw of candidates) {
        if (!raw) continue;
        const origBase = String(raw).trim().split(/[\\/]/).pop();
        if (!origBase) continue;
        const origStem = origBase.replace(/\.[^.]+$/, '');
        const upperStem = origStem.toUpperCase();
        const base = origBase.toLowerCase();
        const stem = base.replace(/\.[^.]+$/, '');

        if (stem && mamByStemMap.has(stem)) return mamByStemMap.get(stem);
        if (base && mamByStemMap.has(base)) return mamByStemMap.get(base);
        if (stem && arsivByStemMap.has(stem)) return arsivByStemMap.get(stem);
        if (base && arsivByStemMap.has(base)) return arsivByStemMap.get(base);

        const directNames = Array.from(new Set([
            origBase,
            base,
            `${origStem}.mxf`,
            `${origStem}.MXF`,
            `${upperStem}.mxf`,
            `${upperStem}.MXF`,
            `${stem}.mxf`,
            `${stem}.MXF`,
            `${origStem}.mp4`,
            `${upperStem}.mp4`,
            `${stem}.mp4`
        ]));

        for (const dName of directNames) {
            if (!dName) continue;
            const p1 = resolveOsMediaPath(MAM_HIGHRES_ROOT, dName);
            if (fs.existsSync(p1)) return p1;
            const p2 = resolveOsMediaPath(YAYIN_ARSIV_ROOT, dName);
            if (fs.existsSync(p2)) return p2;
        }
    }
    return null;
}

function formatMssqlFileName(fileName, extension) {
    const fn = String(fileName || '').trim();
    if (!fn) return '';
    if (/\.[a-zA-Z0-9]{2,5}$/.test(fn)) return fn;
    const ext = String(extension || 'mxf').trim().replace(/^\./, '') || 'mxf';
    return `${fn}.${ext}`;
}

function lookupLocalCatalogRecord(pureNumericId, nameCandidates = []) {
    if (pureNumericId && localCatalogByFileId.has(String(pureNumericId))) {
        return localCatalogByFileId.get(String(pureNumericId));
    }
    for (const nc of nameCandidates) {
        if (!nc) continue;
        const low = String(nc).trim().toLowerCase();
        const stem = low.replace(/\.[^.]+$/, '');
        if (localCatalogByName.has(low)) return localCatalogByName.get(low);
        if (localCatalogByName.has(stem)) return localCatalogByName.get(stem);
    }
    return null;
}

function isSafeReachableUncPath(p) {
    if (!p || typeof p !== 'string') return false;
    return MEDIA_EXT_REGEX.test(p);
}

function extractPureNumericFileId(...candidates) {
    for (const c of candidates) {
        if (!c) continue;
        const s = String(c).trim();
        const m = s.match(/^(\d{3,10})(?:\.[a-zA-Z0-9]+)?$/);
        if (m) return m[1];
    }
    return '';
}

async function resolveFinalVideoAndDbRecord({ id, fileName, clipName, code, publicAddress }) {
    if (mamByStemMap.size === 0 && arsivByStemMap.size === 0 && cacheReadyPromise) {
        await Promise.race([
            cacheReadyPromise,
            new Promise(resolve => setTimeout(resolve, 2500))
        ]);
    }

    const cleanNumericId = extractPureNumericFileId(id, code, fileName);
    const nameCandidates = [clipName, code, fileName, id]
        .filter(Boolean)
        .map(s => String(s).trim().toLowerCase())
        .filter(s => s.length >= 3);
    const stemCandidates = nameCandidates.map(s => s.replace(/\.[^.]+$/, ''));
    const allNameTerms = Array.from(new Set([...nameCandidates, ...stemCandidates]));

    // 0. Önce bellek içi Bizim DB / Reklam Arşivi (adsData.json + adsMedia.json + archive_seed_data) indeksinden MAM FileID (örn. 21673) ve Arşiv Klip İsmini (örn. r_pinarli_gayrimenkul_25sn_240323) bul
    const localRec = lookupLocalCatalogRecord(cleanNumericId, allNameTerms);
    let dbRecord = localRec
        ? {
            fileId: localRec.fileId,
            name: localRec.clipName || localRec.name,
            clipName: localRec.clipName || localRec.name,
            fileName: localRec.fileName,
            categoryId: localRec.categoryId,
            categoryName: localRec.categoryName,
            fileCreateTime: localRec.fileCreateTime,
            durationMs: (Number(localRec.durationSec) || 0) * 1000,
            source: localRec.source
        }
        : null;

    // 1. PostgreSQL archive_clips kontrolü (DİKKAT: Sadece file_id = $1 ile eşleştir, archive_clips.id seri anahtarını MAM fileId ile karıştırma!)
    if (isPostgresReady() && (cleanNumericId || allNameTerms.length > 0)) {
        try {
            const numVal = cleanNumericId ? parseInt(cleanNumericId, 10) : -1;
            const pgRes = await pgQuery(`
                SELECT file_id as "fileId", id as "internalId", name, file_name as "fileName", duration_sec as "durationSec", category_id as "categoryId", file_create_time as "fileCreateTime"
                FROM archive_clips
                WHERE ($1 > 0 AND file_id = $1)
                   OR (cardinality($2::text[]) > 0 AND (
                        LOWER(name) = ANY($2::text[])
                        OR LOWER(file_name) = ANY($2::text[])
                        OR LOWER(REGEXP_REPLACE(file_name, '\\.[^.]+$', '')) = ANY($2::text[])
                   ))
                ORDER BY CASE WHEN file_id = $1 THEN 0 ELSE 1 END, file_id DESC
                LIMIT 1
            `, [numVal, allNameTerms]);
            const pgRow = pgRes.rows?.[0];
            if (pgRow) {
                dbRecord = {
                    fileId: pgRow.fileId,
                    internalId: pgRow.internalId,
                    name: pgRow.name,
                    clipName: pgRow.name,
                    fileName: pgRow.fileName,
                    categoryId: pgRow.categoryId,
                    durationMs: (Number(pgRow.durationSec) || 0) * 1000,
                    fileCreateTime: pgRow.fileCreateTime,
                    source: 'Bizim DB (PostgreSQL)'
                };
            }
        } catch (_) {}
    }

    // 2. HighRes (ID tabanlı: <fileId>.mxf) ve Yayın Arşiv (İsim tabanlı: <clipName>.mxf) üzerinden çift katmanlı arama
    let dualResult = resolveDualStorageVideo({
        fileId: dbRecord?.fileId || cleanNumericId,
        clipName: dbRecord?.clipName || dbRecord?.name || clipName,
        name: dbRecord?.name || clipName,
        title: clipName || fileName,
        fileName: dbRecord?.fileName || fileName,
        code,
        categoryId: dbRecord?.categoryId,
        categoryName: dbRecord?.categoryName,
        fileCreateTime: dbRecord?.fileCreateTime,
        publicAddress
    });
    let finalVideoPath = dualResult.finalVideoPath;

    // 3. MAM MSSQL Files kontrolü (Hem fileId hem de name / fileName ile — Sadece Libero MAM Files tablosunda kesin bulunan sütunları sorgula!)
    if ((!finalVideoPath || !dbRecord) && (cleanNumericId || allNameTerms.length > 0)) {
        try {
            const pool = await getActiveMssqlPool();
            if (pool) {
                const req = pool.request();
                const whereParts = [];
                if (cleanNumericId) {
                    req.input('fileId', sql.Int, parseInt(cleanNumericId, 10));
                    whereParts.push('fileId = @fileId');
                }
                const primaryName = (dbRecord?.name || stemCandidates[0] || nameCandidates[0] || '').toLowerCase();
                if (primaryName && primaryName.length >= 3) {
                    req.input('clipName', sql.NVarChar, primaryName);
                    req.input('clipFileMxf', sql.NVarChar, `${primaryName}.mxf`);
                    whereParts.push('(LOWER(name) = @clipName OR LOWER(fileName) = @clipName OR LOWER(fileName) = @clipFileMxf)');
                }
                if (whereParts.length > 0) {
                    const dbRes = await req.query(`
                        SELECT TOP 1 *
                        FROM Files
                        WHERE ${whereParts.join(' OR ')}
                        ORDER BY fileId DESC
                    `);
                    const row = dbRes.recordset?.[0];
                    if (row) {
                        const fullMssqlFileName = formatMssqlFileName(row.fileName, row.extension);
                        dbRecord = {
                            fileId: row.fileId,
                            name: row.name,
                            clipName: row.name,
                            fileName: fullMssqlFileName || row.fileName,
                            extension: row.extension || 'mxf',
                            categoryId: row.categoryId,
                            deleted: Boolean(row.deleted),
                            durationMs: Number(row.duration) || dbRecord?.durationMs || 0,
                            fileCreateTime: row.fileCreateTime || dbRecord?.fileCreateTime,
                            publicFileAddress: row.publicFileAddress || null,
                            fileServerPath: row.fileServerPath || null,
                            trimIn: row.trimIn,
                            trimOut: row.trimOut,
                            source: 'MAM DB (MSSQL)'
                        };
                        if (!finalVideoPath) {
                            dualResult = resolveDualStorageVideo({
                                fileId: row.fileId,
                                clipName: row.name,
                                name: row.name,
                                fileName: fullMssqlFileName || row.fileName,
                                code,
                                categoryId: row.categoryId,
                                fileCreateTime: row.fileCreateTime,
                                publicAddress: row.publicFileAddress || row.fileServerPath
                            });
                            finalVideoPath = dualResult.finalVideoPath;
                            if (!finalVideoPath && row.publicFileAddress && IS_WINDOWS && fs.existsSync(row.publicFileAddress)) {
                                finalVideoPath = row.publicFileAddress;
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('[STREAM MSSQL LOOKUP WARN]:', err.message);
        }
    }

    // 4. Kısmi isim veya ID eşleşmesi (HighRes içinde ID ile, Yayın Arşiv içinde İsim ile)
    if (!finalVideoPath) {
        const targetId = String(dbRecord?.fileId || cleanNumericId || '').trim().toLowerCase();
        if (targetId && targetId.length >= 3) {
            const mamIdHit = tvMamCache.find(f => {
                if (!MEDIA_EXT_REGEX.test(f)) return false;
                const base = (f.split(/[\\/]/).pop() || '').toLowerCase();
                return base === `${targetId}.mxf` || base.startsWith(`${targetId}.`);
            });
            if (mamIdHit) {
                finalVideoPath = resolveOsMediaPath(MAM_HIGHRES_ROOT, mamIdHit);
                dualResult.highResPath = finalVideoPath;
                dualResult.matchedInHighRes = true;
            }
        }
    }

    if (!finalVideoPath) {
        const rawTerms = [
            dbRecord?.clipName,
            dbRecord?.name,
            clipName,
            dbRecord?.fileName,
            code,
            fileName,
            id
        ]
            .filter(Boolean)
            .map(s => String(s).trim().toLowerCase().replace(/\.[^.]+$/, ''))
            .filter(s => s.length >= 4);

        // Marka / Program kök adı adaylarını da ekle (örn: "r_pinarli_gayrimenkul_25sn_240323" -> "r_pinarli_gayrimenkul")
        const brandPrefixes = rawTerms
            .map(t => t.replace(/[_\s-]+\d+sn.*$/i, '').replace(/[_\s-]+\d{4,8}$/i, '').trim())
            .filter(t => t.length >= 6);
        const searchTerms = Array.from(new Set([...rawTerms, ...brandPrefixes]));

        for (const term of searchTerms) {
            const arsivHit = tvYayinArsivCache.find(f => MEDIA_EXT_REGEX.test(f) && f.toLowerCase().includes(term));
            if (arsivHit) {
                finalVideoPath = resolveOsMediaPath(YAYIN_ARSIV_ROOT, arsivHit);
                dualResult.arsivPath = finalVideoPath;
                dualResult.matchedInArsiv = true;
                break;
            }
            const mamHit = tvMamCache.find(f => MEDIA_EXT_REGEX.test(f) && f.toLowerCase().includes(term));
            if (mamHit) {
                finalVideoPath = resolveOsMediaPath(MAM_HIGHRES_ROOT, mamHit);
                dualResult.highResPath = finalVideoPath;
                dualResult.matchedInHighRes = true;
                break;
            }
        }
    }

    const existsOnDisk = Boolean(finalVideoPath && fs.existsSync(finalVideoPath));
    const existsInIndex = Boolean(finalVideoPath && (mamByStemMap.size > 0 || arsivByStemMap.size > 0));
    return {
        finalVideoPath: (existsOnDisk || existsInIndex) ? finalVideoPath : null,
        existsOnDisk,
        dbRecord,
        dualStorage: dualResult
    };
}

function parseFrameRateString(rateStr) {
    if (!rateStr || typeof rateStr !== 'string') return 25;
    if (rateStr.includes('/')) {
        const [num, den] = rateStr.split('/').map(Number);
        if (num > 0 && den > 0) {
            const raw = num / den;
            if (Math.abs(raw - 25) < 0.5) return 25;
            if (Math.abs(raw - 50) < 0.5) return 50;
            if (Math.abs(raw - 30) < 0.6) return Number(raw.toFixed(2));
            if (Math.abs(raw - 24) < 0.5) return Number(raw.toFixed(2));
            if (Math.abs(raw - 60) < 0.6) return Number(raw.toFixed(2));
            return Number(raw.toFixed(2));
        }
    }
    const parsed = parseFloat(rateStr);
    return parsed > 0 ? Number(parsed.toFixed(2)) : 25;
}

function formatSmpteTimecode(durationMs, fps = 25) {
    const safeFps = Math.round(Number(fps) || 25);
    const totalSecFloat = Math.max(0, (Number(durationMs) || 0) / 1000);
    const totalFrames = Math.round(totalSecFloat * safeFps);
    const frames = totalFrames % safeFps;
    const totalWholeSeconds = Math.floor(totalFrames / safeFps);
    const secs = totalWholeSeconds % 60;
    const mins = Math.floor(totalWholeSeconds / 60) % 60;
    const hours = Math.floor(totalWholeSeconds / 3600);
    const pad = (n) => String(n).padStart(2, '0');
    return {
        timecode: `${pad(hours)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`,
        totalFrames,
        wholeSeconds: totalWholeSeconds,
        extraFrames: frames
    };
}

function probeMediaFileWithFfprobe(filePath) {
    return new Promise((resolve) => {
        if (!filePath) return resolve(null);
        const cacheKey = `ffprobe_${filePath}`;
        if (cache.has(cacheKey)) return resolve(cache.get(cacheKey));

        const proc = spawn('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            filePath
        ]);
        let stdout = '';
        const timer = setTimeout(() => {
            try { proc.kill('SIGKILL'); } catch (_) {}
            resolve(null);
        }, 6000);

        proc.stdout.on('data', d => { stdout += d.toString(); });
        proc.on('error', () => {
            clearTimeout(timer);
            resolve(null);
        });
        proc.on('close', () => {
            clearTimeout(timer);
            try {
                const parsed = JSON.parse(stdout);
                cache.set(cacheKey, parsed, 600);
                resolve(parsed);
            } catch (_) {
                resolve(null);
            }
        });
    });
}

// Medya Teknik Künye & Frame / FPS (25, 30, 50 Kare) Analiz Uç Noktası
app.get('/api/media-info', async (req, res) => {
    try {
        const { id, fileName, clipName, code, publicAddress, durationMs: queryDurationMs } = req.query;
        const { finalVideoPath, dbRecord } = await resolveFinalVideoAndDbRecord({ id, fileName, clipName, code, publicAddress });

        let probeData = null;
        if (finalVideoPath) {
            probeData = await probeMediaFileWithFfprobe(finalVideoPath);
        }

        const streams = Array.isArray(probeData?.streams) ? probeData.streams : [];
        const videoStream = streams.find(s => s.codec_type === 'video') || null;
        const audioStream = streams.find(s => s.codec_type === 'audio') || null;
        const formatObj = probeData?.format || {};

        const fps = videoStream
            ? parseFrameRateString(videoStream.avg_frame_rate && videoStream.avg_frame_rate !== '0/0' ? videoStream.avg_frame_rate : videoStream.r_frame_rate)
            : 25;

        const probeDurationSec = parseFloat(formatObj.duration || videoStream?.duration || '0');
        let durationMs = 0;
        if (probeDurationSec > 0) {
            durationMs = Math.round(probeDurationSec * 1000);
        } else if (dbRecord?.durationMs > 0) {
            durationMs = Math.round(dbRecord.durationMs);
        } else if (Number(queryDurationMs) > 0) {
            const qNum = Number(queryDurationMs);
            durationMs = qNum > 600 ? Math.round(qNum) : Math.round(qNum * 1000);
        }

        const durationSecExact = Number((durationMs / 1000).toFixed(3));
        const tcMain = formatSmpteTimecode(durationMs, fps);
        const nbFramesFromStream = parseInt(videoStream?.nb_frames, 10);
        const totalFrames = nbFramesFromStream > 0 ? nbFramesFromStream : tcMain.totalFrames;

        const tc25 = formatSmpteTimecode(durationMs, 25);
        const tc30 = formatSmpteTimecode(durationMs, 30);
        const tc50 = formatSmpteTimecode(durationMs, 50);

        const roundedFps = Math.round(fps);
        const fpsStandardLabel =
            roundedFps === 25
                ? '25 Kare/sn (25 FPS • PAL TV Yayın Standardı)'
                : roundedFps === 50
                ? '50 Kare/sn (50 FPS • PAL Progressive)'
                : roundedFps === 30
                ? `${fps} Kare/sn (30 FPS • NTSC)`
                : `${fps} Kare/sn (${fps} FPS)`;

        res.json({
            success: true,
            fileFoundOnServer: Boolean(finalVideoPath),
            probedLive: Boolean(probeData && videoStream),
            filePath: finalVideoPath ? path.basename(finalVideoPath) : (code || fileName || dbRecord?.fileName || null),
            fps,
            roundedFps,
            fpsStandardLabel,
            durationMs,
            durationSecExact,
            wholeSeconds: tcMain.wholeSeconds,
            extraFrames: tcMain.extraFrames,
            totalFrames,
            timecode: tcMain.timecode,
            fpsEquivalents: {
                fps25: { fps: 25, totalFrames: tc25.totalFrames, wholeSeconds: tc25.wholeSeconds, extraFrames: tc25.extraFrames, timecode: tc25.timecode },
                fps30: { fps: 30, totalFrames: tc30.totalFrames, wholeSeconds: tc30.wholeSeconds, extraFrames: tc30.extraFrames, timecode: tc30.timecode },
                fps50: { fps: 50, totalFrames: tc50.totalFrames, wholeSeconds: tc50.wholeSeconds, extraFrames: tc50.extraFrames, timecode: tc50.timecode }
            },
            video: {
                width: videoStream?.width || 1920,
                height: videoStream?.height || 1080,
                resolution: videoStream?.width && videoStream?.height ? `${videoStream.width}x${videoStream.height}` : '1920x1080 (Full HD)',
                aspectRatio: videoStream?.display_aspect_ratio || '16:9',
                codec: (videoStream?.codec_name || 'mxf / mpeg2video').toUpperCase(),
                pixFmt: videoStream?.pix_fmt || 'yuv422p',
                fieldOrder: videoStream?.field_order || 'tt',
                bitRateKbps: Math.round((parseInt(formatObj.bit_rate || videoStream?.bit_rate || '0', 10) || 0) / 1000) || null
            },
            audio: {
                codec: audioStream ? (audioStream.codec_name || 'pcm_s16le').toUpperCase() : 'PCM / AAC',
                sampleRate: audioStream?.sample_rate ? `${audioStream.sample_rate} Hz` : '48000 Hz',
                channels: audioStream?.channels || 2
            },
            dbRecord
        });
    } catch (err) {
        console.error('[MEDIA INFO ERROR]:', err);
        res.status(500).json({ error: err.message });
    }
});

// Toplu Medya, Veritabanı ve Dosya Yolu / Format / Bozukluk Kontrol Uç Noktası (Yayın Liste Kontrol Modülü İçin)
// Not: Dosya yolu kontrolü, klibi oynatan (/api/stream) `resolveFinalVideoAndDbRecord` mekanizması ile birebir aynı şekilde çalışır.
app.post('/api/media/verify-batch', async (req, res) => {
    try {
        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        const deepProbe = Boolean(req.body?.deepProbe);
        const rawAllowedFormats = Array.isArray(req.body?.allowedFormats) && req.body.allowedFormats.length > 0
            ? req.body.allowedFormats
            : ['mxf'];
        const allowedFormats = rawAllowedFormats
            .map(f => String(f || '').trim().toLowerCase().replace(/^\./, ''))
            .filter(Boolean);
        if (allowedFormats.length === 0) allowedFormats.push('mxf');

        if (mamByStemMap.size === 0 && arsivByStemMap.size === 0 && cacheReadyPromise) {
            await Promise.race([
                cacheReadyPromise,
                new Promise(resolve => setTimeout(resolve, 2000))
            ]);
        }

        // 1. Önce toplu hızlı DB sorgusu için tüm saf sayısal fileId ve isim adaylarını topla
        const numericIdsSet = new Set();
        const fileNameSet = new Set();

        items.forEach(item => {
            if (!item) return;
            const pureId = extractPureNumericFileId(item.fileId, item.clipId, item.id, item.code);
            if (pureId) {
                const n = parseInt(pureId, 10);
                if (n > 0) numericIdsSet.add(n);
            }
            [item.fileName, item.clipName, item.code, item.title, item.id].forEach(fn => {
                if (!fn) return;
                const clean = String(fn).trim().toLowerCase();
                if (clean.length >= 3 && !clean.startsWith('lc-') && !clean.startsWith('ad-')) {
                    fileNameSet.add(clean);
                    fileNameSet.add(clean.replace(/\.[^.]+$/, ''));
                    fileNameSet.add(`${clean.replace(/\.[^.]+$/, '')}.mxf`);
                }
            });
        });

        const dbByFileId = new Map();
        const dbByLowerName = new Map();

        const registerBatchRec = (rec) => {
            if (!rec) return;
            if (rec.fileId) {
                const fidKey = String(rec.fileId).trim();
                const existing = dbByFileId.get(fidKey);
                dbByFileId.set(fidKey, {
                    ...(existing || {}),
                    ...rec,
                    name: rec.name || existing?.name || '',
                    clipName: rec.clipName || rec.name || existing?.clipName || existing?.name || '',
                    fileName: rec.fileName || existing?.fileName || `${fidKey}.mxf`
                });
            }
            // DİKKAT: PostgreSQL archive_clips.id (internalId) seri anahtarını MAM fileId haritasına EKLEME (örn: id=21673 ile MAM fileId=21673 çakışmasın!)
            const merged = (rec.fileId && dbByFileId.get(String(rec.fileId).trim())) || rec;
            [merged.clipName, merged.name, merged.title, merged.fileName].forEach(candidate => {
                if (!candidate) return;
                const low = String(candidate).trim().toLowerCase();
                if (!low) return;
                const stem = low.replace(/\.[^.]+$/, '');
                dbByLowerName.set(low, merged);
                dbByLowerName.set(stem, merged);
                dbByLowerName.set(`${stem}.mxf`, merged);
            });
        };

        // 2A. Bellek içi Bizim DB & Reklam Kataloğu (adsData.json + adsMedia.json + archive_seed_data) üzerinden anında eşleştir
        numericIdsSet.forEach(num => {
            const found = localCatalogByFileId.get(String(num));
            if (found) registerBatchRec(found);
        });
        fileNameSet.forEach(fn => {
            const found = localCatalogByName.get(fn);
            if (found) registerBatchRec(found);
        });

        // 2B. PostgreSQL archive_clips (Bizim DB) üzerinden toplu sorgu (Sadece MAM file_id = ANY($1) veya klip ismi / dosya adı ile!)
        if (isPostgresReady() && (numericIdsSet.size > 0 || fileNameSet.size > 0)) {
            try {
                const numArr = Array.from(numericIdsSet);
                const nameArr = Array.from(fileNameSet).slice(0, 600);
                const pgRes = await pgQuery(`
                    SELECT file_id as "fileId", id as "internalId", name, file_name as "fileName", duration_sec as "durationSec", category_id as "categoryId", file_create_time as "fileCreateTime"
                    FROM archive_clips
                    WHERE (cardinality($1::int[]) > 0 AND file_id = ANY($1::int[]))
                       OR (cardinality($2::text[]) > 0 AND (
                            LOWER(name) = ANY($2::text[])
                            OR LOWER(file_name) = ANY($2::text[])
                            OR LOWER(REGEXP_REPLACE(file_name, '\\.[^.]+$', '')) = ANY($2::text[])
                       ))
                `, [numArr, nameArr]);

                (pgRes.rows || []).forEach(r => {
                    registerBatchRec({
                        fileId: r.fileId,
                        internalId: r.internalId,
                        name: r.name,
                        clipName: r.name,
                        fileName: r.fileName,
                        durationSec: Number(r.durationSec) || 0,
                        categoryId: r.categoryId,
                        fileCreateTime: r.fileCreateTime,
                        inOurDb: true,
                        source: 'Bizim DB (PostgreSQL)'
                    });
                });
            } catch (pgErr) {
                console.warn('[VERIFY-BATCH PG WARN]:', pgErr.message);
            }
        }

        // 2C. MAM DB (MSSQL Files Tablosu) üzerinden toplu sorgu (Kategori 6 Reklamlar ve tüm yeni klipler dahil!)
        if (numericIdsSet.size > 0 || fileNameSet.size > 0) {
            try {
                const pool = await getActiveMssqlPool();
                if (pool) {
                    const idListSql = Array.from(numericIdsSet)
                        .slice(0, 300)
                        .map(n => parseInt(n, 10))
                        .filter(n => n > 0)
                        .join(',');

                    const unmatchedNames = Array.from(fileNameSet)
                        .filter(fn => !dbByLowerName.has(fn) && !fn.includes("'"))
                        .slice(0, 120);
                    const nameListSql = unmatchedNames.map(fn => `N'${fn.replace(/'/g, "''")}'`).join(',');

                    const whereClauses = [];
                    if (idListSql) whereClauses.push(`fileId IN (${idListSql})`);
                    if (nameListSql) whereClauses.push(`LOWER(name) IN (${nameListSql}) OR LOWER(fileName) IN (${nameListSql})`);

                    if (whereClauses.length > 0) {
                        const msRes = await pool.request().query(`
                            SELECT *
                            FROM Files
                            WHERE ${whereClauses.join(' OR ')}
                        `);
                        (msRes.recordset || []).forEach(r => {
                            const fullFn = formatMssqlFileName(r.fileName, r.extension);
                            const existing = dbByFileId.get(String(r.fileId));
                            registerBatchRec({
                                ...(existing || {}),
                                fileId: r.fileId,
                                name: r.name || existing?.name,
                                clipName: r.name || existing?.clipName || existing?.name,
                                fileName: fullFn || existing?.fileName || r.fileName,
                                categoryId: r.categoryId || existing?.categoryId,
                                fileCreateTime: r.fileCreateTime || existing?.fileCreateTime,
                                durationSec: (Number(r.duration) || 0) / 1000 || existing?.durationSec || 0,
                                deleted: Boolean(r.deleted),
                                publicFileAddress: r.publicFileAddress || null,
                                fileServerPath: r.fileServerPath || null,
                                inMamDb: true,
                                inOurDb: Boolean(existing?.inOurDb || localCatalogByFileId.has(String(r.fileId))),
                                source: existing ? 'Bizim DB & MAM DB' : 'MAM DB (MSSQL)'
                            });
                        });
                    }
                }
            } catch (msErr) {
                console.warn('[VERIFY-BATCH MSSQL WARN]:', msErr.message);
            }
        }

        // 3. Her bir öğe için HighRes (ID tabanlı: <fileId>.mxf) ve Yayın Arşiv (İsim tabanlı: <clipName>.mxf) kontrolü yap
        const results = {};
        for (const item of items) {
            if (!item) continue;
            const key = item.instanceId || item.id || item.code || item.title;
            if (!key) continue;

            const isLiveOrStructural =
                item.type === 'live' ||
                item.isLive ||
                (item.type === 'ad_break' && !item.isEmptyAdBreak) ||
                String(item.id || '').toUpperCase() === 'TPL-3';

            if (isLiveOrStructural) {
                results[key] = {
                    instanceId: key,
                    isStructural: true,
                    inDatabase: true,
                    fileExists: true,
                    isFormatValid: true,
                    detectedFormat: 'live',
                    isCorrupted: false,
                    status: 'healthy',
                    dbSource: 'Canlı Yayın / Kuşak',
                    storageLocation: 'Canlı Yayın',
                    resolvedPath: 'Canlı Yayın Akışı',
                    dbStatusText: 'Canlı Yayın',
                    fileStatusText: 'Canlı Akış',
                    integrityStatusText: 'Sağlam (Canlı Yayın Kuşağı)',
                    issues: []
                };
                continue;
            }

            if (item.isEmptyAdBreak) {
                results[key] = {
                    instanceId: key,
                    inDatabase: false,
                    fileExists: false,
                    isFormatValid: false,
                    detectedFormat: null,
                    isCorrupted: false,
                    status: 'missing',
                    dbSource: null,
                    storageLocation: null,
                    resolvedPath: null,
                    dbStatusText: 'Spot Seçilmemiş',
                    fileStatusText: 'Dosya Yok',
                    integrityStatusText: 'Boş Reklam Kuşağı: Kuşak içine henüz reklam spotu yerleştirilmemiş',
                    issues: ['Boş Reklam Kuşağı: İçine henüz reklam spotu yerleştirilmemiş']
                };
                continue;
            }

            const pureNumericId = extractPureNumericFileId(item.fileId, item.clipId, item.id, item.code);
            let matchedDb = pureNumericId && dbByFileId.has(pureNumericId) ? dbByFileId.get(pureNumericId) : null;

            if (!matchedDb) {
                const nameCandidates = [item.clipName, item.fileName, item.code, item.title, item.id];
                for (const nc of nameCandidates) {
                    if (!nc) continue;
                    const low = String(nc).trim().toLowerCase();
                    const stem = low.replace(/\.[^.]+$/, '');
                    if (dbByLowerName.has(low)) {
                        matchedDb = dbByLowerName.get(low);
                        break;
                    }
                    if (dbByLowerName.has(stem)) {
                        matchedDb = dbByLowerName.get(stem);
                        break;
                    }
                }
            }

            // HighRes (ID tabanlı: <fileId>.mxf) ve Yayın Arşiv (Klip İsmi tabanlı: <clipName>.mxf) Çift Katmanlı Arama:
            let dualStorage = resolveDualStorageVideo({
                fileId: matchedDb?.fileId || pureNumericId,
                clipName: matchedDb?.clipName || matchedDb?.name || item.clipName || item.title,
                name: matchedDb?.name || item.clipName || item.title,
                title: item.title,
                fileName: matchedDb?.fileName || item.fileName || item.code,
                code: item.code || matchedDb?.fileName,
                categoryId: matchedDb?.categoryId,
                categoryName: matchedDb?.categoryName,
                fileCreateTime: matchedDb?.fileCreateTime,
                publicAddress: matchedDb?.publicFileAddress || item.publicFileAddress,
                isAd: item.isAd
            });

            let cachedOrDiskPath = dualStorage.finalVideoPath;

            // Eğer hala bulunamadıysa /api/stream ile birebir aynı resolveFinalVideoAndDbRecord fonksiyonunu çağır
            if (!cachedOrDiskPath || !matchedDb) {
                const resolved = await resolveFinalVideoAndDbRecord({
                    id: matchedDb?.fileId || pureNumericId || item.fileId || item.clipId || item.id,
                    fileName: matchedDb?.fileName || item.fileName || item.code || item.title,
                    clipName: matchedDb?.clipName || matchedDb?.name || item.clipName || item.title,
                    code: matchedDb?.fileName || item.code || item.title,
                    publicAddress: item.publicFileAddress || matchedDb?.publicFileAddress
                });
                if (!cachedOrDiskPath && resolved.finalVideoPath) {
                    cachedOrDiskPath = resolved.finalVideoPath;
                }
                if (resolved.dualStorage) {
                    dualStorage = {
                        ...dualStorage,
                        ...resolved.dualStorage,
                        finalVideoPath: cachedOrDiskPath || resolved.dualStorage.finalVideoPath
                    };
                }
                if (!matchedDb && resolved.dbRecord) {
                    matchedDb = {
                        fileId: resolved.dbRecord.fileId,
                        name: resolved.dbRecord.name,
                        clipName: resolved.dbRecord.clipName || resolved.dbRecord.name,
                        fileName: resolved.dbRecord.fileName,
                        durationSec: (Number(resolved.dbRecord.durationMs) || 0) / 1000,
                        deleted: Boolean(resolved.dbRecord.deleted),
                        publicFileAddress: resolved.dbRecord.publicFileAddress,
                        source: resolved.dbRecord.source || 'Bizim DB & MAM DB'
                    };
                }
            }

            const effectiveFileId = matchedDb?.fileId || pureNumericId || null;
            const effectiveArchiveClipName =
                matchedDb?.clipName ||
                matchedDb?.name ||
                (item.clipName && !/^\d+$/.test(String(item.clipName).trim()) ? item.clipName : null) ||
                item.title ||
                '';

            let physicalExists = false;
            let fileSize = null;
            if (cachedOrDiskPath) {
                try {
                    if (fs.existsSync(cachedOrDiskPath)) {
                        physicalExists = true;
                        const st = fs.statSync(cachedOrDiskPath);
                        fileSize = st.size;
                    } else if (mamByStemMap.size > 0 || arsivByStemMap.size > 0) {
                        physicalExists = true;
                    }
                } catch (_) {
                    physicalExists = Boolean(cachedOrDiskPath);
                }
            } else if (matchedDb && !matchedDb.deleted && (effectiveFileId || effectiveArchiveClipName)) {
                // Klip Bizim DB veya MAM DB'de kayıtlı ve aktif (deleted=0) ise;
                // HighRes (ID tabanlı: <kategori>/<YYYY>/<MM>/<DD>/<fileId>.mxf) ve Yayın Arşiv (İsim tabanlı: <clipName>.mxf) kanonik yolunu oluştur:
                const catFolder = (matchedDb.categoryId && HIGHRES_CATEGORY_FOLDER_MAP[matchedDb.categoryId]) || (item.isAd ? 'reklam' : 'dini');
                const dateFolders = extractHighResDateFolders(matchedDb.fileCreateTime, effectiveArchiveClipName, item.title);
                const datePart = dateFolders[0] || '2026/01/01';
                if (effectiveFileId) {
                    cachedOrDiskPath = resolveOsMediaPath(MAM_HIGHRES_ROOT, `${catFolder}/${datePart}/${effectiveFileId}.mxf`);
                    dualStorage.matchedInHighRes = true;
                    dualStorage.highResPath = cachedOrDiskPath;
                }
                if (effectiveArchiveClipName) {
                    dualStorage.matchedInArsiv = true;
                    dualStorage.arsivPath = resolveOsMediaPath(YAYIN_ARSIV_ROOT, `${catFolder}/${effectiveArchiveClipName.replace(/\.[^.]+$/, '')}.mxf`);
                    if (!cachedOrDiskPath) cachedOrDiskPath = dualStorage.arsivPath;
                }
                dualStorage.storageLocation = dualStorage.matchedInHighRes && dualStorage.matchedInArsiv
                    ? 'HighRes (ID) & Yayın Arşiv (İsim)'
                    : dualStorage.matchedInHighRes
                    ? 'HighRes (ID)'
                    : 'Yayın Arşiv (İsim)';
                physicalExists = true;
            }

            // Dosya uzantısını / formatını tespit et (Varsayılan genel format: .mxf)
            const effectiveFileName = cachedOrDiskPath
                ? path.basename(cachedOrDiskPath)
                : (effectiveFileId ? `${effectiveFileId}.mxf` : (effectiveArchiveClipName ? `${effectiveArchiveClipName}.mxf` : (matchedDb?.fileName || item.code || '')));
            const extMatch = String(effectiveFileName || '').match(/\.([a-zA-Z0-9]+)$/);
            const detectedFormat = extMatch ? extMatch[1].toLowerCase() : (physicalExists || matchedDb ? 'mxf' : '');
            const isFormatValid = !detectedFormat || allowedFormats.includes(detectedFormat);

            const itemDurationSec = Number(item.durationSec) || (Number(item.duration) || 0) * 60 || matchedDb?.durationSec || 0;

            const fileExists = Boolean(cachedOrDiskPath && physicalExists);
            const inDatabase = Boolean(
                matchedDb ||
                (effectiveFileId && fileExists) ||
                (item.isAd && fileExists)
            );

            // Detaylı ve Açıklamalı Hata / Bozukluk Kontrolü
            const issues = [];
            const corruptionReasons = [];
            let isCorrupted = Boolean(item.isCorruptedSimulated);

            if (!inDatabase) {
                issues.push(`DB Kaydı Yok: Bizim DB ve MAM Veritabanında "${item.title || item.code}" kaydı bulunamadı`);
            }
            if (!fileExists) {
                const highResLookedFor = effectiveFileId ? `HighRes ID: ${effectiveFileId}.mxf` : null;
                const arsivLookedFor = effectiveArchiveClipName ? `Yayın Arşiv: ${effectiveArchiveClipName.replace(/\.[^.]+$/, '')}.mxf` : null;
                const lookedLabel = [highResLookedFor, arsivLookedFor].filter(Boolean).join(' veya ') || effectiveFileName;
                issues.push(`Dosya Yolu Eksik: Sunucuda (${lookedLabel}) fiziksel dosya bulunamadı`);
            }
            if (fileExists && !isFormatValid) {
                isCorrupted = true;
                const fmtMsg = `Format Uyumsuz: Dosya formatı (.${detectedFormat}), izin verilen formatlar (${allowedFormats.map(f => '.' + f).join(', ')}) dışında`;
                corruptionReasons.push(fmtMsg);
                issues.push(fmtMsg);
            }
            if (matchedDb?.deleted) {
                isCorrupted = true;
                const delMsg = 'DB Silinmiş Kayıt: Klip MAM veritabanında silinmiş (deleted=1) olarak işaretli';
                corruptionReasons.push(delMsg);
                issues.push(delMsg);
            }
            if (itemDurationSec <= 0) {
                isCorrupted = true;
                const durMsg = 'Süre Hatası: Klip süresi 00:00 (0 sn) görünüyor, zaman kodu geçersiz';
                corruptionReasons.push(durMsg);
                issues.push(durMsg);
            }
            if (fileSize !== null && fileSize <= 1024) {
                isCorrupted = true;
                const sizeMsg = `Dosya Boyutu Hatası: Fiziksel dosya boyutu ${fileSize} Byte (0 Byte / Eksik kopyalanmış dosya)`;
                corruptionReasons.push(sizeMsg);
                issues.push(sizeMsg);
            }

            if (deepProbe && cachedOrDiskPath && fs.existsSync(cachedOrDiskPath) && !isCorrupted) {
                const probe = await probeMediaFileWithFfprobe(cachedOrDiskPath);
                const hasVideo = Array.isArray(probe?.streams) && probe.streams.some(s => s.codec_type === 'video');
                if (probe && !hasVideo) {
                    isCorrupted = true;
                    const streamMsg = 'Video Akışı Hatası: FFprobe analizinde dosya içinde video stream okunamadı';
                    corruptionReasons.push(streamMsg);
                    issues.push(streamMsg);
                }
            }

            const status = isCorrupted
                ? 'corrupted'
                : (!inDatabase || !fileExists)
                ? 'missing'
                : 'healthy';

            const sizeMbText = fileSize && fileSize > 1024 ? ` • ${(fileSize / (1024 * 1024)).toFixed(1)} MB` : '';
            const formatBadge = (detectedFormat || 'mxf').toUpperCase();
            const storageBadge = dualStorage.matchedInHighRes && dualStorage.matchedInArsiv
                ? `HighRes (ID) & Arşiv (İsim) .${formatBadge}`
                : dualStorage.matchedInHighRes
                ? `HighRes (ID: ${effectiveFileId || ''}.${formatBadge})`
                : dualStorage.matchedInArsiv
                ? `Yayın Arşiv (İsim .${formatBadge})`
                : `HighRes / Arşiv .${formatBadge}`;

            const dbStatusText = inDatabase
                ? `DB Kayıtlı (${effectiveFileId ? `#${effectiveFileId}` : 'MAM'})`
                : 'DB Kaydı Bulunamadı';

            const fileStatusText = fileExists
                ? `${storageBadge} ✓`
                : `Dosya Yolunda Yok (${effectiveFileId ? `${effectiveFileId}.mxf` : '.mxf'})`;

            const integrityStatusText = isCorrupted
                ? corruptionReasons.join(' • ') || 'Klip Bütünlük Hatası'
                : !fileExists
                ? 'HighRes (ID) ve Yayın Arşiv (İsim) dizinlerinde dosya bulunamadığı için oynatılamaz'
                : !inDatabase
                ? 'Veritabanı künyesi eksik'
                : `Sağlam (${dualStorage.storageLocation || `.${formatBadge}`} • ${Math.round(itemDurationSec)} sn${sizeMbText} • Oynatılabilir)`;

            results[key] = {
                instanceId: key,
                inDatabase,
                fileExists,
                isFormatValid,
                detectedFormat: detectedFormat || 'mxf',
                isCorrupted,
                status,
                dbSource: matchedDb?.source || (inDatabase ? (item.isAd ? 'Reklam & MAM DB' : 'MAM Arşiv DB') : null),
                dbFileId: effectiveFileId,
                archiveClipName: effectiveArchiveClipName || null,
                highResFileName: effectiveFileId ? `${effectiveFileId}.mxf` : (dualStorage.highResIdFileName || null),
                matchedInHighRes: Boolean(dualStorage.matchedInHighRes),
                matchedInArsiv: Boolean(dualStorage.matchedInArsiv),
                storageLocation: dualStorage.storageLocation,
                dbDurationSec: matchedDb?.durationSec || itemDurationSec || 0,
                resolvedPath: cachedOrDiskPath || null,
                fileName: effectiveFileName || null,
                fileSize,
                dbStatusText,
                fileStatusText,
                integrityStatusText,
                corruptionReason: corruptionReasons.join(' | ') || null,
                issues
            };
        }

        res.json({
            success: true,
            checkedAt: new Date().toISOString(),
            totalChecked: items.length,
            allowedFormats,
            results
        });
    } catch (err) {
        console.error('[VERIFY-BATCH ERROR]:', err);
        res.status(500).json({ error: err.message });
    }
});

const STREAM_CACHE_DIR = path.join(os.tmpdir(), 'yayin_video_stream_cache');
try {
    if (!fs.existsSync(STREAM_CACHE_DIR)) {
        fs.mkdirSync(STREAM_CACHE_DIR, { recursive: true });
    }
} catch (_) {}

const activeTranscodeMap = new Map();

function ensureSeekableMp4Transcoded(sourcePath) {
    let statKey = sourcePath;
    try {
        const st = fs.statSync(sourcePath);
        statKey = `${sourcePath}_${st.size}_${st.mtimeMs}`;
    } catch (_) {}

    const hash = crypto.createHash('md5').update(statKey).digest('hex');
    const cachedMp4Path = path.join(STREAM_CACHE_DIR, `${hash}.mp4`);

    try {
        if (fs.existsSync(cachedMp4Path) && fs.statSync(cachedMp4Path).size > 2048) {
            return Promise.resolve(cachedMp4Path);
        }
    } catch (_) {}

    if (activeTranscodeMap.has(cachedMp4Path)) {
        return activeTranscodeMap.get(cachedMp4Path);
    }

    const tempOutPath = `${cachedMp4Path}.tmp.${process.pid}.mp4`;
    const promise = new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', [
            '-hide_banner',
            '-loglevel', 'error',
            '-y',
            '-i', sourcePath,
            '-map', '0:v:0',
            '-map', '0:a:0?',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-profile:v', 'baseline',
            '-level', '3.1',
            '-preset', 'ultrafast',
            '-crf', '24',
            '-vf', 'scale=640:-2',
            '-g', '25',
            '-c:a', 'aac',
            '-ac', '2',
            '-b:a', '128k',
            '-movflags', '+faststart',
            tempOutPath
        ]);

        ff.on('error', (err) => {
            try { if (fs.existsSync(tempOutPath)) fs.unlinkSync(tempOutPath); } catch (_) {}
            reject(err);
        });

        ff.on('close', (exitCode) => {
            try {
                if (exitCode === 0 && fs.existsSync(tempOutPath) && fs.statSync(tempOutPath).size > 1024) {
                    fs.renameSync(tempOutPath, cachedMp4Path);
                    resolve(cachedMp4Path);
                } else {
                    if (fs.existsSync(tempOutPath)) fs.unlinkSync(tempOutPath);
                    reject(new Error(`FFmpeg exited with code ${exitCode}`));
                }
            } catch (e) {
                reject(e);
            }
        });
    }).finally(() => {
        activeTranscodeMap.delete(cachedMp4Path);
    });

    activeTranscodeMap.set(cachedMp4Path, promise);
    return promise;
}

function serveMp4WithByteRanges(req, res, mp4FilePath) {
    const stat = fs.statSync(mp4FilePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10) || 0;
        const end = parts[1] ? Math.min(parseInt(parts[1], 10), fileSize - 1) : fileSize - 1;

        if (start >= fileSize || start > end) {
            res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
            return res.end();
        }

        const chunkSize = (end - start) + 1;
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', chunkSize);
        const stream = fs.createReadStream(mp4FilePath, { start, end });
        stream.on('error', () => res.end());
        stream.pipe(res);
    } else {
        res.status(200);
        res.setHeader('Content-Length', fileSize);
        const stream = fs.createReadStream(mp4FilePath);
        stream.on('error', () => res.end());
        stream.pipe(res);
    }
}

// Stream endpoint'i: İleri-Geri Sarılabilir (HTTP 206 Byte-Range destekli) H.264 MP4 Video Akışı
app.get('/api/stream', async (req, res) => {
    const { id, fileName, clipName, code, publicAddress, start } = req.query;
    const { finalVideoPath } = await resolveFinalVideoAndDbRecord({ id, fileName, clipName, code, publicAddress });

    if (!finalVideoPath) {
        return res.status(404).json({ error: 'Video dosyası arşiv sunucusunda bulunamadı', id, fileName, code });
    }

    // 1. Eğer dosya zaten doğrudan .mp4 ise veya boyutu <= 350 MB ise (tüm reklamlar ve standart klipler),
    // önbellekteki seekable MP4 üzerinden HTTP 206 Byte-Range ile ileri-geri sarılabilir olarak sun!
    try {
        const sourceStat = fs.statSync(finalVideoPath);
        const isSmallOrMediumClip = sourceStat.size <= 350 * 1024 * 1024;
        if (isSmallOrMediumClip && !start) {
            const seekableMp4 = await ensureSeekableMp4Transcoded(finalVideoPath);
            return serveMp4WithByteRanges(req, res, seekableMp4);
        }
    } catch (transcodeErr) {
        console.warn('[STREAM SEEKABLE CACHE FALLBACK]:', transcodeErr.message);
    }

    // 2. Çok büyük dosyalar (>350 MB) veya anlık pipe fallback için canlı FFmpeg akışı (-ss start destekli)
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Accept-Ranges', 'none');

    const ffArgs = ['-hide_banner', '-loglevel', 'error'];
    const startSec = parseFloat(start || '0');
    if (startSec > 0) {
        ffArgs.push('-ss', String(startSec));
    }
    ffArgs.push(
        '-i', finalVideoPath,
        '-map', '0:v:0',
        '-map', '0:a:0?',
        '-f', 'mp4',
        '-vcodec', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-profile:v', 'baseline',
        '-level', '3.1',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-vf', 'scale=640:-2',
        '-b:v', '900k',
        '-g', '25',
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
        '-acodec', 'aac',
        '-ac', '2',
        '-b:a', '128k',
        'pipe:1'
    );

    const ffmpeg = spawn('ffmpeg', ffArgs);
    ffmpeg.stdout.pipe(res);

    ffmpeg.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) console.warn(`[FFMPEG WARN]: ${msg}`);
    });

    req.on('close', () => {
        if (!ffmpeg.killed) {
            ffmpeg.kill('SIGKILL');
        }
    });
});

// Modüler Router bağlantıları
app.use('/api', createDraftRouter());
app.use('/api/archive', createArchiveRouter(poolPromise));
app.use('/api/system-monitor', createSystemMonitorRouter({
    getMssqlStatus: () => ({ connected: isMssqlConnected, server: dbConfig.server, database: dbConfig.database }),
    reconnectMssql: reconnectMssqlPool,
    rescanMediaCaches: async () => {
        cacheReadyPromise = buildFileCaches();
        await cacheReadyPromise;
    },
    getMediaCacheStats: () => ({
        mamHighResRoot: MAM_HIGHRES_ROOT,
        yayinArsivRoot: YAYIN_ARSIV_ROOT,
        cachedMamFiles: tvMamCache.length,
        cachedArsivFiles: tvYayinArsivCache.length
    }),
    clearApiCache: () => cache.flushAll()
}));

// Derlenmiş Frontend (dist) dosyaları mevcutsa tüm portlardan (3001, 5173 ve 80) doğrudan sun
const distPath = path.resolve('dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get(/^(?!\/api).*/, (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

// Ek portları (5173 ve 80) dinleme yardımcısı (Systemd/Linux üzerinde güvenlik duvarı veya port farkı olmadan erişim sağlar)
function startExtraListener(extraPort) {
    if (extraPort === PORT) return;
    try {
        const extraServer = http.createServer(app);
        extraServer.on('error', (err) => {
            if (err.code !== 'EADDRINUSE' && err.code !== 'EACCES') {
                console.warn(`[PORT ${extraPort} WARN]:`, err.message);
            }
        });
        extraServer.listen(extraPort, '0.0.0.0', () => {
            console.log(`Web Arayüzü & API ayrıca http://0.0.0.0:${extraPort} portunda da yayında`);
        });
    } catch (_) {}
}

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Backend sunucusu http://0.0.0.0:${PORT} (Tüm ağ arayüzleri) portunda çalışıyor`);
    if (process.env.SERVE_STATIC === 'true' || !IS_WINDOWS) {
        startExtraListener(5173);
        startExtraListener(80);
    }
    try {
        if (!isPostgresReady()) {
            await testPgConnection();
        }
        await ensureClipMetadataColumn();
        await ensureParsingRulesTable();
        // Başlangıçta Libero MAM DB'de yeni eklenen klip varsa otomatik olarak Bizim DB'ye çek
        const deltaRes = await syncDeltaUpdatesFromMam();
        if (deltaRes?.totalNewSynced > 0) {
            console.log(`[AUTO DELTA SYNC] Başlangıçta ${deltaRes.totalNewSynced} yeni klip Libero MAM DB'den PostgreSQL'e aktarıldı.`);
        }
    } catch (err) {
        console.warn('[STARTUP SCHEMA/DELTA CHECK WARN]:', err.message);
    }

    // Arka planda her 5 dakikada bir Libero MAM DB'ye yeni eklenen klipleri otomatik kontrol et ve çek
    setInterval(async () => {
        try {
            if (isPostgresReady()) {
                const res = await syncDeltaUpdatesFromMam();
                if (res?.totalNewSynced > 0) {
                    console.log(`[AUTO DELTA SYNC] Arka plan kontrolünde ${res.totalNewSynced} yeni klip PostgreSQL'e aktarıldı.`);
                }
            }
        } catch (err) {
            console.warn('[BACKGROUND DELTA SYNC WARN]:', err.message);
        }
    }, 5 * 60 * 1000);
});
