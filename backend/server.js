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
const MAM_HIGHRES_ROOT = process.env.MAM_HIGHRES_PATH || (IS_WINDOWS ? `\\\\${MAM_SMB_HOST}\\${MAM_SMB_SHARE_HIGHRES}` : '/mnt/media_highres');
const YAYIN_ARSIV_ROOT = process.env.YAYIN_ARSIV_PATH || (IS_WINDOWS ? `\\\\${MAM_SMB_HOST}\\${MAM_SMB_SHARE_ARCHIVE}` : '/mnt/media_archive');

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

async function buildFileCaches() {
    try {
        await ensureSmbAuthenticated();
        let savedCache = null;
        if (fs.existsSync(CACHE_FILE)) {
            savedCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
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
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        platform: process.platform,
        topology: SERVER_TOPOLOGY,
        postgres: {
            connected: isPostgresReady(),
            configuredHost: process.env.PG_HOST || '127.0.0.1',
            activeHost: getActivePostgresHost(),
            port: parseInt(process.env.PG_PORT || '5432', 10),
            database: process.env.PG_DATABASE || 'yayin_planlama'
        },
        mssql: {
            connected: isMssqlConnected,
            server: dbConfig.server,
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
    }
    return null;
}

function isSafeReachableUncPath(p) {
    if (!p || typeof p !== 'string') return false;
    return MEDIA_EXT_REGEX.test(p);
}

// Stream endpoint'i: ffmpeg ile mxf dosyasını mp4'e (yuv420p H.264) anlık dönüştürüp gönderir
app.get('/api/stream', async (req, res) => {
    const { id, fileName, clipName, code, publicAddress } = req.query;

    if (cacheReadyPromise) await cacheReadyPromise;

    const cleanNumericId = id ? String(id).replace(/\D+/g, '') : '';
    let finalVideoPath = lookupCachedVideoPath([cleanNumericId, id, code, fileName, clipName]);

    const normalizedPublicAddr = normalizeUncPathForCurrentOs(publicAddress);
    if (!finalVideoPath && isSafeReachableUncPath(normalizedPublicAddr) && fs.existsSync(normalizedPublicAddr)) {
        finalVideoPath = normalizedPublicAddr;
    }

    if (!finalVideoPath && cleanNumericId) {
        try {
            const pool = await poolPromise;
            if (pool) {
                const dbRes = await pool.request()
                    .input('fileId', sql.Int, parseInt(cleanNumericId, 10))
                    .query(`
                        SELECT TOP 1 name, fileName, publicFileAddress
                        FROM Files
                        WHERE fileId = @fileId
                    `);
                const row = dbRes.recordset?.[0];
                if (row) {
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
        } catch (err) {
            console.warn('[STREAM MSSQL LOOKUP WARN]:', err.message);
        }
    }

    if (!finalVideoPath) {
        // Kısmi isim eşleşmesi (son çare)
        const searchTerms = [code, fileName, clipName]
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

    if (!finalVideoPath || !fs.existsSync(finalVideoPath)) {
        return res.status(404).json({ error: 'Video dosyası arşiv sunucusunda bulunamadı', id, fileName });
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Accept-Ranges', 'none');

    console.log(`[STREAM] FFmpeg başlatılıyor (yuv420p): ${finalVideoPath}`);

    const ffmpeg = spawn('ffmpeg', [
        '-hide_banner',
        '-loglevel', 'error',
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
    ]);

    ffmpeg.stdout.pipe(res);

    ffmpeg.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) console.warn(`[FFMPEG WARN]: ${msg}`);
    });

    ffmpeg.on('close', (code) => {
        console.log(`[STREAM] FFmpeg tamamlandı. Kod: ${code}`);
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
