/**
 * @file backend/services/archive/archiveSchemaService.js
 * @description MSSQL bağlantı yapılandırması, PostgreSQL tablo/indeks şeması garanti fonksiyonları
 * (`ensureParsingRulesTable`, `ensureClipMetadataColumn`), metadata özet ayrıştırıcısı (`parseMetadataSummary`),
 * toplu klip kaydetme (`batchUpsertClips`) ve program istatistik hesaplayıcısı (`recalculateProgramStats`).
 */
import sql from 'mssql';
import { query as pgQuery } from '../../db/postgres.js';
import {
    BROADCAST_CATEGORY_IDS,
    DEFAULT_PARSING_RULES,
    getActiveParsingRules,
    setActiveParsingRules,
    formatSeconds
} from '../archiveClipParser.js';

export const mssqlConfig = {
    user: process.env.MSSQL_USER || '',
    password: process.env.MSSQL_PASSWORD || '',
    server: process.env.MSSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MSSQL_PORT || '1433', 10),
    database: process.env.MSSQL_DATABASE || 'MAM_DB',
    options: { encrypt: false, trustServerCertificate: true },
    connectionTimeout: parseInt(process.env.MSSQL_CONNECT_TIMEOUT || '5000', 10),
    requestTimeout: parseInt(process.env.MSSQL_REQUEST_TIMEOUT || '60000', 10)
};

let metadataColumnEnsured = false;
let parsingRulesEnsured = false;

/**
 * PostgreSQL `archive_parsing_rules` tablosunu oluşturur, boşsa varsayılan kuralları ekler
 * ve hafızadaki aktif kuralları günceller.
 */
export async function ensureParsingRulesTable(forceReload = false) {
    if (parsingRulesEnsured && !forceReload) return getActiveParsingRules();

    try {
        await pgQuery(`
            CREATE TABLE IF NOT EXISTS archive_parsing_rules (
                id SERIAL PRIMARY KEY,
                program_title VARCHAR(255) NOT NULL,
                category_id INTEGER NOT NULL DEFAULT 4,
                match_patterns TEXT NOT NULL,
                exclude_patterns TEXT DEFAULT '',
                unit_type VARCHAR(32) NOT NULL DEFAULT 'bolum',
                extract_source VARCHAR(32) NOT NULL DEFAULT 'both',
                description TEXT DEFAULT '',
                is_system BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        const countRes = await pgQuery(`SELECT COUNT(*) as cnt FROM archive_parsing_rules`);
        const count = parseInt(countRes.rows[0]?.cnt || '0', 10);

        if (count === 0) {
            for (const r of DEFAULT_PARSING_RULES) {
                await pgQuery(`
                    INSERT INTO archive_parsing_rules (
                        program_title, category_id, match_patterns, exclude_patterns,
                        unit_type, extract_source, description, is_system
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    r.programTitle,
                    r.categoryId,
                    r.matchPatterns,
                    r.excludePatterns || '',
                    r.unitType || 'bolum',
                    r.extractSource || 'both',
                    r.description || '',
                    Boolean(r.isSystem)
                ]);
            }
        }

        const rulesRes = await pgQuery(`
            SELECT 
                id,
                program_title as "programTitle",
                category_id as "categoryId",
                match_patterns as "matchPatterns",
                exclude_patterns as "excludePatterns",
                unit_type as "unitType",
                extract_source as "extractSource",
                description,
                is_system as "isSystem",
                created_at as "createdAt",
                updated_at as "updatedAt"
            FROM archive_parsing_rules
            ORDER BY id ASC
        `);

        setActiveParsingRules(rulesRes.rows);
        parsingRulesEnsured = true;
        return rulesRes.rows;
    } catch (err) {
        console.warn('[PARSING RULES TABLE WARN]:', err.message);
        return getActiveParsingRules();
    }
}

/**
 * PostgreSQL `archive_clips` tablosunda metadata (JSONB), metadata_summary (JSONB), birim (unit_type, unit_label)
 * sütunlarının ve arama indekslerinin varlığını garanti eder.
 */
export async function ensureClipMetadataColumn() {
    await ensureParsingRulesTable();
    if (metadataColumnEnsured) return;
    try {
        await pgQuery(`ALTER TABLE archive_clips ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '[]'::jsonb`);
        await pgQuery(`ALTER TABLE archive_clips ADD COLUMN IF NOT EXISTS metadata_summary JSONB DEFAULT '{}'::jsonb`);
        await pgQuery(`ALTER TABLE archive_clips ADD COLUMN IF NOT EXISTS unit_type VARCHAR(32) DEFAULT 'bolum'`);
        await pgQuery(`ALTER TABLE archive_clips ADD COLUMN IF NOT EXISTS unit_label VARCHAR(100)`);
        await pgQuery(`ALTER TABLE archive_clips ADD COLUMN IF NOT EXISTS mam_category_id INTEGER`);
        await pgQuery(`ALTER TABLE archive_clips ADD COLUMN IF NOT EXISTS mam_category_name VARCHAR(120)`);
        await pgQuery(`ALTER TABLE archive_clips ADD COLUMN IF NOT EXISTS is_custom_assigned BOOLEAN DEFAULT false`);
        await pgQuery(`ALTER TABLE archive_clips ALTER COLUMN note TYPE TEXT`);

        await pgQuery(`ALTER TABLE archive_programs ADD COLUMN IF NOT EXISTS unit_type VARCHAR(32) DEFAULT 'bolum'`);
        await pgQuery(`ALTER TABLE archive_programs ADD COLUMN IF NOT EXISTS mam_category_id INTEGER`);
        await pgQuery(`ALTER TABLE archive_programs ADD COLUMN IF NOT EXISTS mam_category_name VARCHAR(120)`);
        await pgQuery(`ALTER TABLE archive_programs ADD COLUMN IF NOT EXISTS mam_title VARCHAR(255)`);
        await pgQuery(`ALTER TABLE archive_programs ADD COLUMN IF NOT EXISTS is_custom_category BOOLEAN DEFAULT false`);

        await pgQuery(`
            UPDATE archive_programs
            SET mam_category_id = COALESCE(mam_category_id, category_id),
                mam_category_name = COALESCE(mam_category_name, category_name),
                mam_title = COALESCE(mam_title, title)
            WHERE mam_category_id IS NULL OR mam_title IS NULL
        `);
        await pgQuery(`
            UPDATE archive_clips c
            SET mam_category_id = COALESCE(c.mam_category_id, c.category_id),
                mam_category_name = COALESCE(c.mam_category_name, cat.name)
            FROM categories cat
            WHERE (c.mam_category_id IS NULL OR c.mam_category_name IS NULL)
              AND cat.id = COALESCE(c.mam_category_id, c.category_id)
        `);

        await pgQuery(`CREATE INDEX IF NOT EXISTS idx_archive_clips_program_id ON archive_clips(program_id)`);
        await pgQuery(`CREATE INDEX IF NOT EXISTS idx_archive_clips_category_id ON archive_clips(category_id)`);
        await pgQuery(`CREATE INDEX IF NOT EXISTS idx_archive_clips_mam_category_id ON archive_clips(mam_category_id)`);
        await pgQuery(`CREATE INDEX IF NOT EXISTS idx_archive_clips_ep_part ON archive_clips(episode_no, part_no)`);
        await pgQuery(`CREATE INDEX IF NOT EXISTS idx_archive_programs_cat_active ON archive_programs(category_id, is_active)`);
        await pgQuery(`CREATE INDEX IF NOT EXISTS idx_archive_programs_mam_cat ON archive_programs(mam_category_id)`);
        metadataColumnEnsured = true;
    } catch (err) {
        console.warn('[ARCHIVE METADATA COLUMN WARN]:', err.message);
    }
}

/**
 * Ham metadata dizisini ({ keyName, val } veya { key, value }) temizler ve yapılandırılmış özet nesnesine dönüştürür.
 */
export function parseMetadataSummary(metadataArr = []) {
    if (!Array.isArray(metadataArr)) return { list: [], summary: {} };
    const cleanList = [];
    const summary = {};

    for (const item of metadataArr) {
        if (!item) continue;
        const rawKey = item.keyName || item.key || '';
        const rawVal = item.val ?? item.value ?? '';
        const cleanKey = String(rawKey).replace(/[\t\r\n]+/g, '').trim();
        const val = String(rawVal).trim();
        if (!cleanKey || !val) continue;
        cleanList.push({ keyName: cleanKey, val });

        const k = cleanKey.toLocaleLowerCase('tr-TR');
        if (k.includes('bölüm numarası') || k.includes('bolum numarasi')) {
            const n = parseInt(val, 10);
            if (!isNaN(n) && n > 0) summary.bolumNo = n;
        } else if (k.includes('bölüm adı') || k.includes('bolum adi')) {
            summary.bolumAdi = val;
        } else if (k === 'konu') {
            summary.konu = val;
        } else if (k === 'tür' || k === 'tur') {
            summary.tur = val;
        } else if (k === 'sunucu') {
            summary.sunucu = val;
        } else if (k === 'konuk') {
            summary.konuk = val;
        } else if (k === 'yönetmen' || k === 'yonetmen') {
            summary.yonetmen = val;
        } else if (k === 'yapımcı' || k === 'yapimci') {
            summary.yapimci = val;
        } else if (k === 'kurgucu') {
            summary.kurgucu = val;
        } else if (k.includes('yayın tarihi') || k.includes('yayin tarihi')) {
            summary.yayinTarihi = val.replace(/\s+00:00:00$/, '');
        } else if (k.includes('yapım yılı') || k.includes('yapim yili')) {
            summary.yapimYili = val;
        } else if (k.includes('içerik sorumlusu') || k.includes('icerik sorumlusu')) {
            summary.icerikSorumlusu = val;
        } else if (k.includes('kameraman')) {
            summary.kameraman = val;
        } else if (k.includes('şirket') || k.includes('marka adı') || k.includes('marka adi')) {
            summary.sirketMarka = val;
        } else if (k === 'ajans') {
            summary.ajans = val;
        } else if (k === 'üretici' || k === 'uretici') {
            summary.uretici = val;
        } else if (k.includes('onay durumu')) {
            summary.onayDurumu = val;
        } else if (k.includes('video durumu')) {
            summary.videoDurumu = val;
        }
    }

    return { list: cleanList, summary };
}

const DEFAULT_LOCAL_SCHEMA_FIELDS = [
    { metadataId: 23, displayName: 'Bölüm Adı' },
    { metadataId: 22, displayName: 'Bölüm Numarası' },
    { metadataId: 13, displayName: 'Konu' },
    { metadataId: 14, displayName: 'Sunucu' },
    { metadataId: 15, displayName: 'Konuk' },
    { metadataId: 9, displayName: 'Yönetmen' },
    { metadataId: 25, displayName: 'Yapımcı' },
    { metadataId: 8, displayName: 'Kurgucu' },
    { metadataId: 24, displayName: 'Yayın Tarihi' }
];

let categoryMetadataSchemaCache = null;

/**
 * MSSQL'den kategori bazlı metadata şemasını (CategoryMetadata + MetadataFields) getirir.
 * Normal okuma işlemlerinde uzak MSSQL bağlantısı açmamak için allowRemote=false ile yerel önbellekten döner.
 */
export async function getCategoryMetadataSchemaMap(existingPool = null, allowRemote = false) {
    if (categoryMetadataSchemaCache) return categoryMetadataSchemaCache;
    if (!existingPool && !allowRemote) {
        const localMap = {};
        for (const catId of BROADCAST_CATEGORY_IDS) {
            localMap[catId] = DEFAULT_LOCAL_SCHEMA_FIELDS;
        }
        return localMap;
    }
    let pool = existingPool;
    let shouldClose = false;
    try {
        if (!pool) {
            pool = new sql.ConnectionPool(mssqlConfig);
            await pool.connect();
            shouldClose = true;
        }
        const res = await pool.request().query(`
            SELECT cm.categoryId, cm.metadataId, mf.displayName
            FROM CategoryMetadata cm
            JOIN MetadataFields mf ON mf.metadataId = cm.metadataId
            ORDER BY cm.categoryId ASC, cm.metadataId ASC
        `);
        const map = {};
        for (const r of res.recordset || []) {
            if (!map[r.categoryId]) map[r.categoryId] = [];
            map[r.categoryId].push({
                metadataId: r.metadataId,
                displayName: String(r.displayName || '').replace(/[\t\r\n]+/g, '').trim()
            });
        }
        categoryMetadataSchemaCache = map;
        return map;
    } catch (err) {
        console.warn('[CATEGORY METADATA SCHEMA WARN]:', err.message);
        return {};
    } finally {
        if (shouldClose && pool) await pool.close();
    }
}

/**
 * PostgreSQL için toplu (batch) klip kaydetme / güncelleme.
 */
export async function batchUpsertClips(clips) {
    if (!clips || clips.length === 0) return;
    await ensureClipMetadataColumn();
    const CHUNK_SIZE = 120;
    for (let i = 0; i < clips.length; i += CHUNK_SIZE) {
        const chunk = clips.slice(i, i + CHUNK_SIZE);
        const valueClauses = [];
        const params = [];
        let pIdx = 1;
        for (const c of chunk) {
            const uType = c.unitType || 'bolum';
            const uLabel = c.unitLabel || (
                c.episodeNo != null
                    ? (uType === 'cuz' ? `${c.episodeNo}. Cüz` : uType === 'gun' ? `${c.episodeNo}. Gün` : `Bölüm ${c.episodeNo}`)
                    : null
            );
            const mamCatId = c.mamCategoryId || c.categoryId;
            const mamCatName = c.mamCategoryName || c.categoryName || null;
            valueClauses.push(`($${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5}, $${pIdx+6}, $${pIdx+7}, $${pIdx+8}, $${pIdx+9}, $${pIdx+10}, $${pIdx+11}, $${pIdx+12}, $${pIdx+13}, $${pIdx+14}, $${pIdx+15}::jsonb, $${pIdx+16}::jsonb, NOW())`);
            params.push(
                c.programId,
                c.categoryId,
                mamCatId,
                mamCatName,
                c.fileId,
                c.name,
                c.fileName,
                c.episodeNo,
                c.partNo,
                uType,
                uLabel,
                c.note,
                c.durationSec,
                c.durationFormatted || formatSeconds(c.durationSec),
                c.fileCreateTime,
                JSON.stringify(Array.isArray(c.metadata) ? c.metadata : []),
                JSON.stringify(c.metadataSummary || {})
            );
            pIdx += 17;
        }

        const sqlQuery = `
            INSERT INTO archive_clips (
                program_id, category_id, mam_category_id, mam_category_name, file_id, name, file_name,
                episode_no, part_no, unit_type, unit_label, note,
                duration_sec, duration_formatted, file_create_time,
                metadata, metadata_summary, created_at
            )
            VALUES ${valueClauses.join(',\n')}
            ON CONFLICT (file_id) DO UPDATE
            SET program_id = CASE WHEN COALESCE(archive_clips.is_custom_assigned, false) = true THEN archive_clips.program_id ELSE EXCLUDED.program_id END,
                category_id = CASE WHEN COALESCE(archive_clips.is_custom_assigned, false) = true THEN archive_clips.category_id ELSE EXCLUDED.category_id END,
                mam_category_id = COALESCE(EXCLUDED.mam_category_id, archive_clips.mam_category_id, EXCLUDED.category_id),
                mam_category_name = COALESCE(EXCLUDED.mam_category_name, archive_clips.mam_category_name),
                name = EXCLUDED.name,
                file_name = EXCLUDED.file_name,
                episode_no = COALESCE(EXCLUDED.episode_no, archive_clips.episode_no),
                part_no = COALESCE(EXCLUDED.part_no, archive_clips.part_no),
                unit_type = COALESCE(EXCLUDED.unit_type, archive_clips.unit_type, 'bolum'),
                unit_label = COALESCE(EXCLUDED.unit_label, archive_clips.unit_label),
                note = CASE WHEN EXCLUDED.note IS NOT NULL AND EXCLUDED.note <> '' THEN EXCLUDED.note ELSE archive_clips.note END,
                duration_sec = EXCLUDED.duration_sec,
                duration_formatted = EXCLUDED.duration_formatted,
                file_create_time = EXCLUDED.file_create_time,
                metadata = CASE WHEN jsonb_array_length(EXCLUDED.metadata) > 0 THEN EXCLUDED.metadata ELSE COALESCE(archive_clips.metadata, '[]'::jsonb) END,
                metadata_summary = CASE WHEN EXCLUDED.metadata_summary <> '{}'::jsonb THEN EXCLUDED.metadata_summary ELSE COALESCE(archive_clips.metadata_summary, '{}'::jsonb) END
        `;
        await pgQuery(sqlQuery, params);
    }
}

/**
 * Bir programın klip sayısı, bölüm sayısı, toplam süresi ve tarihlerini yeniden hesaplar.
 */
export async function recalculateProgramStats(programId) {
    const id = parseInt(programId, 10);
    if (!id || isNaN(id)) return;
    await pgQuery(`
        UPDATE archive_programs ap
        SET total_clips = COALESCE(sub.clip_count, 0),
            total_duration_sec = COALESCE(sub.dur_sum, 0),
            total_episodes = COALESCE(sub.ep_count, 0),
            first_date = sub.min_date,
            last_date = sub.max_date,
            updated_at = NOW()
        FROM (
            SELECT 
                COUNT(*) as clip_count,
                COALESCE(SUM(duration_sec), 0) as dur_sum,
                COUNT(DISTINCT episode_no) as ep_count,
                MIN(file_create_time) as min_date,
                MAX(file_create_time) as max_date
            FROM archive_clips
            WHERE program_id = $1
        ) sub
        WHERE ap.id = $1
    `, [id]);
}

/**
 * Türkçe karakter duyarsız SQL regex deseni üretir.
 */
export function buildTurkishRegexPattern(token) {
    return String(token || '')
        .toLocaleLowerCase('tr-TR')
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/[cç]/g, '[cç]')
        .replace(/[gğ]/g, '[gğ]')
        .replace(/[sş]/g, '[sş]')
        .replace(/[iı]/g, '[iı]')
        .replace(/[oö]/g, '[oö]')
        .replace(/[uü]/g, '[uü]');
}

