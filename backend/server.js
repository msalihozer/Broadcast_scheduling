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
const MAM_SMB_SHARE_HIGHRES = process.env.MAM_SMB_SHARE_HIGHRES || 'media_highres';
const MAM_SMB_SHARE_ARCHIVE = process.env.MAM_SMB_SHARE_ARCHIVE || 'media_archive';

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

        if (savedCache && savedCache.cacheKey === cacheKey) {
            console.log('[CACHE] Dosya sisteminde değişiklik yok. Hızlı cache yükleniyor...');
            tvMamCache = savedCache.tvMamCache || [];
            tvYayinArsivCache = savedCache.tvYayinArsivCache || [];
            rebuildFastFileLookupMaps();
            console.log(`[CACHE] HighRes: ${tvMamCache.length}, Archive: ${tvYayinArsivCache.length} dosya (Index hazır).`);
            return;
        }

        console.log('[CACHE] Değişiklik tespit edildi. Medya HighRes dizini taranıyor...');
        let scannedMam = [];
        let scannedArsiv = [];
        try {
            scannedMam = await fs.promises.readdir(mamPath, { recursive: true });
            console.log(`[CACHE] HighRes taraması bitti. ${scannedMam.length} dosya bulundu.`);
        } catch (e) { console.error('[CACHE] HighRes okunamadı:', e.message); }
        
        console.log('[CACHE] Medya Archive dizini taranıyor...');
        try {
            scannedArsiv = await fs.promises.readdir(arsivPath, { recursive: true });
            console.log(`[CACHE] Archive taraması bitti. ${scannedArsiv.length} dosya bulundu.`);
        } catch (e) { console.error('[CACHE] Archive okunamadı:', e.message); }

        // Eğer Docker/Linux içinde ağ paylaşımı henüz mount edilmemişse (0 dosya dönerse) mevcut önbelleği koru
        if (scannedMam.length === 0 && scannedArsiv.length === 0 && savedCache && ((savedCache.tvMamCache?.length || 0) > 0 || (savedCache.tvYayinArsivCache?.length || 0) > 0)) {
            console.log('[CACHE] Ağ dizinleri boş veya mount edilmemiş, mevcut önbellek korunuyor...');
            tvMamCache = savedCache.tvMamCache || [];
            tvYayinArsivCache = savedCache.tvYayinArsivCache || [];
            rebuildFastFileLookupMaps();
            console.log(`[CACHE] Korunan önbellek: HighRes: ${tvMamCache.length}, Archive: ${tvYayinArsivCache.length} dosya.`);
            return;
        }

        tvMamCache = scannedMam;
        tvYayinArsivCache = scannedArsiv;
        rebuildFastFileLookupMaps();

        if (tvMamCache.length > 0 || tvYayinArsivCache.length > 0) {
            fs.writeFileSync(CACHE_FILE, JSON.stringify({
                cacheKey,
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

function lookupCachedVideoPath(candidates = []) {
    for (const raw of candidates) {
        if (!raw) continue;
        const base = String(raw).trim().split(/[\\/]/).pop().toLowerCase();
        const stem = base.replace(/\.[^.]+$/, '');
        if (stem && mamByStemMap.has(stem)) return mamByStemMap.get(stem);
        if (base && mamByStemMap.has(base)) return mamByStemMap.get(base);
        if (stem && arsivByStemMap.has(stem)) return arsivByStemMap.get(stem);
        if (base && arsivByStemMap.has(base)) return arsivByStemMap.get(base);

        // Doğrudan kök dizinlerde dosya var mı kontrol et (önbellek taraması bitmemiş olsa bile bulur)
        const directNames = base.includes('.') ? [base, String(raw).trim().split(/[\\/]/).pop()] : [`${stem}.mxf`, `${stem}.MXF`, `${stem}.mp4`, `${stem}.MP4`];
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

function isSafeReachableUncPath(p) {
    if (!p || typeof p !== 'string') return false;
    return MEDIA_EXT_REGEX.test(p);
}

async function resolveFinalVideoAndDbRecord({ id, fileName, clipName, code, publicAddress }) {
    if (mamByStemMap.size === 0 && arsivByStemMap.size === 0 && cacheReadyPromise) {
        await Promise.race([
            cacheReadyPromise,
            new Promise(resolve => setTimeout(resolve, 2500))
        ]);
    }

    const cleanNumericId = id ? String(id).replace(/\D+/g, '') : '';
    let finalVideoPath = lookupCachedVideoPath([cleanNumericId, id, code, fileName, clipName]);
    let dbRecord = null;

    const normalizedPublicAddr = normalizeUncPathForCurrentOs(publicAddress);
    if (!finalVideoPath && isSafeReachableUncPath(normalizedPublicAddr) && fs.existsSync(normalizedPublicAddr)) {
        finalVideoPath = normalizedPublicAddr;
    }

    // 1. PostgreSQL archive_clips kontrolü
    if (cleanNumericId && isPostgresReady()) {
        try {
            const pgRes = await pgQuery(`
                SELECT file_id as "fileId", name, file_name as "fileName", duration_sec as "durationSec", file_create_time as "fileCreateTime"
                FROM archive_clips
                WHERE file_id = $1
                LIMIT 1
            `, [parseInt(cleanNumericId, 10)]);
            const pgRow = pgRes.rows?.[0];
            if (pgRow) {
                dbRecord = {
                    fileId: pgRow.fileId,
                    name: pgRow.name,
                    fileName: pgRow.fileName,
                    durationMs: (Number(pgRow.durationSec) || 0) * 1000,
                    fileCreateTime: pgRow.fileCreateTime
                };
                if (!finalVideoPath) {
                    finalVideoPath = lookupCachedVideoPath([pgRow.fileName, pgRow.name]);
                }
            }
        } catch (_) {}
    }

    // 2. MSSQL Files kontrolü
    if (cleanNumericId && (!finalVideoPath || !dbRecord)) {
        try {
            const pool = await poolPromise;
            if (pool) {
                const dbRes = await pool.request()
                    .input('fileId', sql.Int, parseInt(cleanNumericId, 10))
                    .query(`
                        SELECT TOP 1 fileId, name, fileName, extension, duration, fileCreateTime, publicFileAddress, fileServerPath, trimIn, trimOut
                        FROM Files
                        WHERE fileId = @fileId
                    `);
                const row = dbRes.recordset?.[0];
                if (row) {
                    dbRecord = {
                        fileId: row.fileId,
                        name: row.name,
                        fileName: row.fileName,
                        extension: row.extension,
                        durationMs: Number(row.duration) || dbRecord?.durationMs || 0,
                        fileCreateTime: row.fileCreateTime || dbRecord?.fileCreateTime,
                        publicFileAddress: row.publicFileAddress,
                        fileServerPath: row.fileServerPath,
                        trimIn: row.trimIn,
                        trimOut: row.trimOut
                    };
                    if (!finalVideoPath) {
                        const rowAddr = normalizeUncPathForCurrentOs(row.publicFileAddress);
                        finalVideoPath = lookupCachedVideoPath([
                            row.fileName,
                            row.name,
                            rowAddr
                        ]);
                        if (!finalVideoPath && isSafeReachableUncPath(rowAddr) && fs.existsSync(rowAddr)) {
                            finalVideoPath = rowAddr;
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('[STREAM MSSQL LOOKUP WARN]:', err.message);
        }
    }

    // 3. Kısmi isim eşleşmesi (son çare)
    if (!finalVideoPath) {
        const searchTerms = [code, fileName, clipName, dbRecord?.fileName, dbRecord?.name]
            .filter(Boolean)
            .map(s => String(s).trim().toLowerCase().replace(/\.[^.]+$/, ''))
            .filter(s => s.length >= 4);

        for (const term of searchTerms) {
            const mamHit = tvMamCache.find(f => MEDIA_EXT_REGEX.test(f) && f.toLowerCase().includes(term));
            if (mamHit) {
                finalVideoPath = resolveOsMediaPath(MAM_HIGHRES_ROOT, mamHit);
                break;
            }
            const arsivHit = tvYayinArsivCache.find(f => MEDIA_EXT_REGEX.test(f) && f.toLowerCase().includes(term));
            if (arsivHit) {
                finalVideoPath = resolveOsMediaPath(YAYIN_ARSIV_ROOT, arsivHit);
                break;
            }
        }
    }

    const exists = Boolean(finalVideoPath && fs.existsSync(finalVideoPath));
    return {
        finalVideoPath: exists ? finalVideoPath : null,
        dbRecord
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

// Toplu Medya, Veritabanı ve Dosya Yolu / Bozukluk Kontrol Uç Noktası (Yayın Liste Kontrol Modülü İçin)
app.post('/api/media/verify-batch', async (req, res) => {
    try {
        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        const deepProbe = Boolean(req.body?.deepProbe);

        if (mamByStemMap.size === 0 && arsivByStemMap.size === 0 && cacheReadyPromise) {
            await Promise.race([
                cacheReadyPromise,
                new Promise(resolve => setTimeout(resolve, 2000))
            ]);
        }

        // 1. Tüm sayısal fileId adaylarını ve dosya adı adaylarını topla
        const numericIdsSet = new Set();
        const fileNameSet = new Set();

        items.forEach(item => {
            if (!item) return;
            const rawIds = [item.fileId, item.clipId, item.id, item.code];
            rawIds.forEach(val => {
                if (!val) return;
                const s = String(val).trim();
                const numMatch = s.match(/^(\d{4,10})(?:\.[a-zA-Z0-9]+)?$/);
                if (numMatch) {
                    const n = parseInt(numMatch[1], 10);
                    if (n > 0) numericIdsSet.add(n);
                }
            });
            [item.fileName, item.clipName, item.code, item.title].forEach(fn => {
                if (!fn) return;
                const clean = String(fn).trim().toLowerCase();
                if (clean.length >= 3) {
                    fileNameSet.add(clean);
                    fileNameSet.add(clean.replace(/\.[^.]+$/, ''));
                }
            });
        });

        const dbByFileId = new Map();
        const dbByLowerName = new Map();

        // 2. PostgreSQL archive_clips üzerinden toplu sorgu
        if (isPostgresReady() && (numericIdsSet.size > 0 || fileNameSet.size > 0)) {
            try {
                const numArr = Array.from(numericIdsSet);
                const nameArr = Array.from(fileNameSet).slice(0, 500);
                const pgRes = await pgQuery(`
                    SELECT file_id as "fileId", name, file_name as "fileName", duration_sec as "durationSec", category_id as "categoryId"
                    FROM archive_clips
                    WHERE (cardinality($1::int[]) > 0 AND file_id = ANY($1::int[]))
                       OR (cardinality($2::text[]) > 0 AND (LOWER(file_name) = ANY($2::text[]) OR LOWER(name) = ANY($2::text[])))
                `, [numArr, nameArr]);

                (pgRes.rows || []).forEach(r => {
                    const rec = {
                        fileId: r.fileId,
                        name: r.name,
                        fileName: r.fileName,
                        durationSec: Number(r.durationSec) || 0,
                        categoryId: r.categoryId,
                        source: 'PostgreSQL MAM'
                    };
                    if (r.fileId) dbByFileId.set(String(r.fileId), rec);
                    if (r.fileName) {
                        const fnLow = String(r.fileName).toLowerCase();
                        dbByLowerName.set(fnLow, rec);
                        dbByLowerName.set(fnLow.replace(/\.[^.]+$/, ''), rec);
                    }
                    if (r.name) {
                        dbByLowerName.set(String(r.name).toLowerCase(), rec);
                    }
                });
            } catch (pgErr) {
                console.warn('[VERIFY-BATCH PG WARN]:', pgErr.message);
            }
        }

        // 3. Eğer PG'de bulunamayan sayısal ID'ler varsa ve MSSQL aktifse MSSQL Files tablosundan tamamla
        const missingNumericIds = Array.from(numericIdsSet).filter(n => !dbByFileId.has(String(n)));
        if (missingNumericIds.length > 0 && isMssqlConnected) {
            try {
                const pool = await poolPromise;
                if (pool) {
                    const idListSql = missingNumericIds.slice(0, 200).map(n => parseInt(n, 10)).filter(n => n > 0).join(',');
                    if (idListSql) {
                        const msRes = await pool.request().query(`
                            SELECT fileId, name, fileName, duration, deleted, publicFileAddress
                            FROM Files
                            WHERE fileId IN (${idListSql})
                        `);
                        (msRes.recordset || []).forEach(r => {
                            const rec = {
                                fileId: r.fileId,
                                name: r.name,
                                fileName: r.fileName,
                                durationSec: (Number(r.duration) || 0) / 1000,
                                deleted: Boolean(r.deleted),
                                publicFileAddress: r.publicFileAddress,
                                source: 'MSSQL MAM'
                            };
                            dbByFileId.set(String(r.fileId), rec);
                            if (r.fileName) {
                                const fnLow = String(r.fileName).toLowerCase();
                                dbByLowerName.set(fnLow, rec);
                                dbByLowerName.set(fnLow.replace(/\.[^.]+$/, ''), rec);
                            }
                        });
                    }
                }
            } catch (msErr) {
                console.warn('[VERIFY-BATCH MSSQL WARN]:', msErr.message);
            }
        }

        // 4. Her bir öğe için DB, Dosya Yolu ve Bozukluk kontrolü yap
        const results = {};
        for (const item of items) {
            if (!item) continue;
            const key = item.instanceId || item.id || item.code || item.title;
            if (!key) continue;

            // Canlı yayın veya kuşak başlığı ise medya dosyası gerektirmez
            const isLiveOrStructural =
                item.type === 'live' ||
                item.isLive ||
                item.type === 'ad_break' ||
                String(item.id || '').toUpperCase() === 'TPL-3';

            if (isLiveOrStructural) {
                results[key] = {
                    instanceId: key,
                    isStructural: true,
                    inDatabase: true,
                    fileExists: true,
                    isCorrupted: false,
                    status: 'healthy',
                    dbSource: 'Canlı / Yapısal Kuşak',
                    resolvedPath: 'Canlı Yayın Akışı',
                    issues: []
                };
                continue;
            }

            // Aday ID ve İsimler
            let matchedDb = null;
            const idCandidates = [item.fileId, item.clipId, item.id, item.code];
            let extractedNumericId = '';

            for (const c of idCandidates) {
                if (!c) continue;
                const s = String(c).trim();
                const m = s.match(/^(\d{4,10})(?:\.[a-zA-Z0-9]+)?$/);
                if (m) {
                    if (!extractedNumericId) extractedNumericId = m[1];
                    if (dbByFileId.has(m[1])) {
                        matchedDb = dbByFileId.get(m[1]);
                        break;
                    }
                }
            }

            if (!matchedDb) {
                const nameCandidates = [item.fileName, item.code, item.clipName, item.title];
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

            // Dosya yolu kontrolü (Önbellek indexi + Disk)
            const lookupCandidates = [
                extractedNumericId,
                item.fileId,
                item.clipId,
                item.code,
                item.fileName,
                item.clipName,
                matchedDb?.fileName,
                matchedDb?.name,
                item.id
            ].filter(Boolean);

            const cachedOrDiskPath = lookupCachedVideoPath(lookupCandidates);
            let physicalExists = false;
            let fileSize = null;
            if (cachedOrDiskPath) {
                try {
                    if (fs.existsSync(cachedOrDiskPath)) {
                        physicalExists = true;
                        const st = fs.statSync(cachedOrDiskPath);
                        fileSize = st.size;
                    } else if (mamByStemMap.size > 0 || arsivByStemMap.size > 0) {
                        // Önbellek haritasında kayıtlı (mount geçici kapalıysa bile index'te var)
                        physicalExists = true;
                    }
                } catch (_) {
                    physicalExists = Boolean(cachedOrDiskPath);
                }
            }

            const itemDurationSec = Number(item.durationSec) || (Number(item.duration) || 0) * 60 || matchedDb?.durationSec || 0;
            const hasValidCodeOrId = Boolean(extractedNumericId || matchedDb || (item.code && MEDIA_EXT_REGEX.test(String(item.code))));
            const inDatabase = Boolean(
                matchedDb ||
                (item.isAd && hasValidCodeOrId && (physicalExists || extractedNumericId)) ||
                (extractedNumericId && physicalExists)
            );
            const fileExists = Boolean(cachedOrDiskPath && physicalExists);

            // Klip Bozukluk Kontrolü
            const issues = [];
            let isCorrupted = Boolean(item.isCorruptedSimulated);

            if (!inDatabase) {
                issues.push("Veritabanında (MAM / Katalog DB) klip kaydı bulunamadı");
            }
            if (!fileExists) {
                issues.push("Medya sunucusu dosya yolunda (.mxf / .mp4) fiziksel dosya bulunamadı");
            }
            if (matchedDb?.deleted) {
                isCorrupted = true;
                issues.push("Klip veritabanında silinmiş (deleted=1) olarak işaretli");
            }
            if (itemDurationSec <= 0) {
                isCorrupted = true;
                issues.push("Klip süresi 0 sn veya geçersiz (bozuk zaman kodu)");
            }
            if (fileSize !== null && fileSize <= 1024) {
                isCorrupted = true;
                issues.push(`Dosya boyutu bozuk veya 0 Byte (${fileSize} byte)`);
            }
            if (!hasValidCodeOrId) {
                isCorrupted = true;
                issues.push("Eksik veya hatalı medya klip kodu / FileID");
            }

            if (deepProbe && cachedOrDiskPath && fs.existsSync(cachedOrDiskPath) && !isCorrupted) {
                const probe = await probeMediaFileWithFfprobe(cachedOrDiskPath);
                const hasVideo = Array.isArray(probe?.streams) && probe.streams.some(s => s.codec_type === 'video');
                if (probe && !hasVideo) {
                    isCorrupted = true;
                    issues.push("FFprobe analizinde geçerli video akışı (stream) bulunamadı");
                }
            }

            const status = isCorrupted
                ? 'corrupted'
                : (!inDatabase || !fileExists)
                ? 'missing'
                : 'healthy';

            results[key] = {
                instanceId: key,
                inDatabase,
                fileExists,
                isCorrupted,
                status,
                dbSource: matchedDb?.source || (inDatabase ? (item.isAd ? 'Reklam & MAM Kataloğu' : 'MAM Arşiv Index') : null),
                dbFileId: matchedDb?.fileId || extractedNumericId || null,
                dbDurationSec: matchedDb?.durationSec || itemDurationSec || 0,
                resolvedPath: cachedOrDiskPath || null,
                fileName: cachedOrDiskPath ? path.basename(cachedOrDiskPath) : (matchedDb?.fileName || item.code || item.fileName || null),
                fileSize,
                issues
            };
        }

        res.json({
            success: true,
            checkedAt: new Date().toISOString(),
            totalChecked: items.length,
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
