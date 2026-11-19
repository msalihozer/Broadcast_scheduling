/**
 * @file backend/services/archive/archiveSyncService.js
 * @description MAM MSSQL veritabanı ile yerel PostgreSQL arasındaki senkronizasyon,
 * metadata eşitleme (`syncAllClipsMetadataFromMssql`), hariç tutulan klip temizliği (`purgeExcludedArchiveData`)
 * ve Reklam Yönetimi arşiv çekimi (`getAdsArchiveFromMssql`) servisleri.
 */
import sql from 'mssql';
import { query as pgQuery, isPostgresReady } from '../../db/postgres.js';
import {
    BROADCAST_CATEGORY_IDS,
    SQL_EXCLUDE_CLIPS_FILTER,
    isExcludedClip,
    parseClipWithMetadata,
    parseAdClipName,
    formatSeconds
} from '../archiveClipParser.js';
import {
    mssqlConfig,
    ensureClipMetadataColumn,
    ensureParsingRulesTable,
    parseMetadataSummary,
    getCategoryMetadataSchemaMap,
    batchUpsertClips
} from './archiveSchemaService.js';
import { applyParsingRulesToArchive } from './archiveRulesService.js';

/**
 * MSSQL'den belirtilen kategorideki klipleri (metadata ve isimlendirme kurallarıyla) çeker ve PostgreSQL'e senkronize eder.
 * Not: Ham (11) ve Reklam (6) kategorileri genel program arşivine çekilmez.
 */
export async function syncCategoryArchive(categoryId) {
    const catId = parseInt(categoryId, 10);
    if (catId === 6 || catId === 11) {
        throw new Error('Ham (11) ve Reklam (6) kategorileri program arşivine çekilmez. Reklam verileri yalnızca Reklam Yönetimi alanında çekilir.');
    }

    console.log(`[ARCHIVE SYNC] Kategori ID ${catId} için MSSQL taraması başlatılıyor...`);

    let mssqlPool;
    try {
        mssqlPool = new sql.ConnectionPool(mssqlConfig);
        await mssqlPool.connect();

        const catRes = await mssqlPool.request().query(`SELECT categoryId, categoryName FROM Categories WHERE categoryId = ${catId}`);
        const categoryName = catRes.recordset[0]?.categoryName || `Kategori ${catId}`;
        const schemaMap = await getCategoryMetadataSchemaMap(mssqlPool);
        const categoryMetadataFields = schemaMap[catId] || [];

        const q = `
            SELECT 
                f.fileId, 
                f.name, 
                f.fileName, 
                f.duration, 
                ROUND(f.duration / 1000.0, 0) as durSec,
                f.fileCreateTime,
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
            WHERE f.deleted = 0
              AND f.categoryId = ${catId}
              ${SQL_EXCLUDE_CLIPS_FILTER}
            ORDER BY f.fileCreateTime DESC
        `;
        const res = await mssqlPool.request().query(q);
        const rawClips = res.recordset || [];

        const grouped = {};
        let validClipsCount = 0;

        for (const row of rawClips) {
            let rawMetaArr = [];
            if (row.metadataJson) {
                try {
                    rawMetaArr = JSON.parse(row.metadataJson);
                } catch (e) {}
            }

            if (isExcludedClip(row.name, row.fileName, rawMetaArr)) {
                continue;
            }

            const { list: cleanMetadata, summary: metaSum } = parseMetadataSummary(rawMetaArr);
            const parsed = parseClipWithMetadata(row.name, catId, metaSum);
            const sec = Math.max(0, parseInt(row.durSec) || 0);
            validClipsCount++;

            if (!grouped[parsed.program]) {
                grouped[parsed.program] = {
                    title: parsed.program,
                    categoryName,
                    clips: [],
                    episodes: new Set(),
                    totalDurationSec: 0,
                    firstDate: row.fileCreateTime,
                    lastDate: row.fileCreateTime
                };
            }

            const p = grouped[parsed.program];
            p.totalDurationSec += sec;
            if (parsed.episode != null) p.episodes.add(parsed.episode);
            if (row.fileCreateTime && (!p.firstDate || row.fileCreateTime < p.firstDate)) p.firstDate = row.fileCreateTime;
            if (row.fileCreateTime && (!p.lastDate || row.fileCreateTime > p.lastDate)) p.lastDate = row.fileCreateTime;

            p.clips.push({
                fileId: row.fileId,
                name: row.name,
                fileName: row.fileName,
                episodeNo: parsed.episode,
                partNo: parsed.part,
                note: parsed.note,
                metadata: cleanMetadata,
                metadataSummary: metaSum,
                durationSec: sec,
                durationFormatted: formatSeconds(sec),
                fileCreateTime: row.fileCreateTime
            });
        }

        if (isPostgresReady()) {
            await ensureClipMetadataColumn();
            const validFileIds = Object.values(grouped).flatMap(g => g.clips.map(c => c.fileId));
            if (validFileIds.length > 0) {
                await pgQuery(
                    `DELETE FROM archive_clips WHERE COALESCE(mam_category_id, category_id) = $1 AND COALESCE(is_custom_assigned, false) = false AND NOT (file_id = ANY($2::int[]))`,
                    [catId, validFileIds]
                );
            }

            const allClipsToInsert = [];

            for (const [title, p] of Object.entries(grouped)) {
                const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

                // Önce bu programın Bizim DB'de (farklı kategoriye taşınmış veya başlığı özelleştirilmiş olarak) zaten var olup olmadığını kontrol et
                const existingProgRes = await pgQuery(`
                    SELECT id, category_id as "categoryId", category_name as "categoryName", title
                    FROM archive_programs
                    WHERE (COALESCE(mam_category_id, category_id) = $1 AND LOWER(COALESCE(mam_title, title)) = LOWER($2))
                       OR (category_id = $1 AND LOWER(title) = LOWER($2))
                    ORDER BY is_active DESC, id ASC
                    LIMIT 1
                `, [catId, title]);

                let programId;
                let effectiveCategoryId = catId;
                let effectiveCategoryName = p.categoryName;

                if (existingProgRes.rows.length > 0) {
                    const ex = existingProgRes.rows[0];
                    programId = ex.id;
                    effectiveCategoryId = ex.categoryId || catId;
                    effectiveCategoryName = ex.categoryName || p.categoryName;

                    await pgQuery(`
                        UPDATE archive_programs
                        SET mam_category_id = $1,
                            mam_category_name = $2,
                            mam_title = COALESCE(mam_title, $3),
                            first_date = COALESCE(LEAST(first_date, $4), $4, first_date),
                            last_date = COALESCE(GREATEST(last_date, $5), $5, last_date),
                            updated_at = NOW()
                        WHERE id = $6
                    `, [catId, p.categoryName, title, p.firstDate, p.lastDate, programId]);
                } else {
                    const progRes = await pgQuery(`
                        INSERT INTO archive_programs (
                            category_id, category_name, mam_category_id, mam_category_name,
                            title, mam_title, slug,
                            total_episodes, total_clips, total_duration_sec,
                            first_date, last_date, updated_at
                        )
                        VALUES ($1, $2, $1, $2, $3, $3, $4, $5, $6, $7, $8, $9, NOW())
                        ON CONFLICT (category_id, title) DO UPDATE
                        SET mam_category_id = COALESCE(archive_programs.mam_category_id, EXCLUDED.mam_category_id),
                            mam_category_name = COALESCE(archive_programs.mam_category_name, EXCLUDED.mam_category_name),
                            mam_title = COALESCE(archive_programs.mam_title, EXCLUDED.mam_title),
                            total_episodes = EXCLUDED.total_episodes,
                            total_clips = EXCLUDED.total_clips,
                            total_duration_sec = EXCLUDED.total_duration_sec,
                            first_date = EXCLUDED.first_date,
                            last_date = EXCLUDED.last_date,
                            updated_at = NOW()
                        RETURNING id, category_id as "categoryId", category_name as "categoryName"
                    `, [catId, p.categoryName, title, slug, p.episodes.size, p.clips.length, p.totalDurationSec, p.firstDate, p.lastDate]);

                    programId = progRes.rows[0].id;
                    effectiveCategoryId = progRes.rows[0].categoryId || catId;
                    effectiveCategoryName = progRes.rows[0].categoryName || p.categoryName;
                }

                for (const c of p.clips) {
                    c.programId = programId;
                    c.categoryId = effectiveCategoryId;
                    c.categoryName = effectiveCategoryName;
                    c.mamCategoryId = catId;
                    c.mamCategoryName = p.categoryName;
                    allClipsToInsert.push(c);
                }
            }

            await batchUpsertClips(allClipsToInsert);

            // Yalnızca aktif olmayan ve klipsiz kalan yetim programları temizle
            await pgQuery(`
                DELETE FROM archive_programs 
                WHERE COALESCE(mam_category_id, category_id) = $1 
                  AND COALESCE(is_active, false) = false
                  AND id NOT IN (SELECT DISTINCT program_id FROM archive_clips WHERE program_id IS NOT NULL)
            `, [catId]);

            await pgQuery(`
                UPDATE archive_programs ap
                SET total_clips = sub.clip_count,
                    total_episodes = sub.ep_count,
                    total_duration_sec = sub.dur_sum
                FROM (
                    SELECT program_id, COUNT(*) as clip_count, COUNT(DISTINCT episode_no) as ep_count, COALESCE(SUM(duration_sec), 0) as dur_sum
                    FROM archive_clips
                    GROUP BY program_id
                ) sub
                WHERE ap.id = sub.program_id
            `);

            console.log(`[ARCHIVE SYNC] Kategori ${catId} (${categoryName}): ${Object.keys(grouped).length} program ve ${allClipsToInsert.length} temiz klip PostgreSQL'e kaydedildi.`);
        }

        return {
            success: true,
            categoryId: catId,
            categoryName,
            metadataFields: categoryMetadataFields,
            totalClips: validClipsCount,
            programsCount: Object.keys(grouped).length,
            programs: Object.values(grouped).map(g => ({
                title: g.title,
                categoryName: g.categoryName,
                totalClips: g.clips.length,
                totalEpisodes: g.episodes.size,
                totalDurationSec: g.totalDurationSec,
                totalDurationFormatted: formatSeconds(g.totalDurationSec),
                firstDate: g.firstDate,
                lastDate: g.lastDate,
                clips: g.clips
            }))
        };
    } catch (err) {
        console.error('[ARCHIVE SYNC ERROR]:', err);
        throw err;
    } finally {
        if (mssqlPool) await mssqlPool.close();
    }
}

/**
 * Tüm yayın kategorilerini (1, 2, 3, 4, 5, 7, 8, 9, 10 - Ham ve Reklam hariç) MSSQL'den okur ve PostgreSQL'e senkronize eder.
 */
export async function syncAllCategoriesArchive(onProgress) {
    console.log('[SYNC ALL] 9 yayın kategorisi (Ham ve Reklam hariç) için arşiv senkronizasyonu başlatılıyor...');
    await purgeExcludedArchiveData();
    const results = [];
    for (let i = 0; i < BROADCAST_CATEGORY_IDS.length; i++) {
        const catId = BROADCAST_CATEGORY_IDS[i];
        try {
            console.log(`[SYNC ALL] (${i + 1}/${BROADCAST_CATEGORY_IDS.length}) Kategori ${catId} senkronize ediliyor...`);
            const res = await syncCategoryArchive(catId);
            results.push({ categoryId: catId, success: true, categoryName: res.categoryName, programsCount: res.programsCount, totalClips: res.totalClips });
            if (onProgress) onProgress(i + 1, BROADCAST_CATEGORY_IDS.length, res);
        } catch (err) {
            console.error(`[SYNC ALL ERROR] Kategori ${catId} hatası:`, err);
            results.push({ categoryId: catId, success: false, error: err.message });
        }
    }
    console.log('[SYNC ALL] Tüm yayın kategorilerinin senkronizasyonu tamamlandı!');
    return results;
}

/**
 * PostgreSQL'deki Ham (11) ve Reklam (6) kayıtlarını, cln/clean/kullanma/iptal klipleri temizler
 * ve mevcut kliplerin metadata tabanlı bölüm/konu bilgilerini günceller.
 */
export async function purgeExcludedArchiveData() {
    if (!isPostgresReady()) return;
    await ensureClipMetadataColumn();
    await ensureParsingRulesTable();
    try {
        const delCatClips = await pgQuery(`DELETE FROM archive_clips WHERE category_id IN (6, 11)`);
        const delCatProgs = await pgQuery(`DELETE FROM archive_programs WHERE category_id IN (6, 11)`);

        const allClipsRes = await pgQuery(`
            SELECT file_id as "fileId", program_id as "programId", category_id as "categoryId",
                   name, file_name as "fileName", episode_no as "episodeNo", part_no as "partNo",
                   note, COALESCE(metadata, '[]'::jsonb) as metadata
            FROM archive_clips
        `);

        const excludedFileIds = [];
        const metadataUpdates = [];

        for (const row of allClipsRes.rows) {
            const rawMeta = Array.isArray(row.metadata) ? row.metadata : [];
            if (isExcludedClip(row.name, row.fileName, rawMeta)) {
                excludedFileIds.push(row.fileId);
                continue;
            }

            if (rawMeta.length > 0) {
                const { summary } = parseMetadataSummary(rawMeta);
                const parsed = parseClipWithMetadata(row.name, row.categoryId, summary);
                const newEp = parsed.episode != null ? parsed.episode : row.episodeNo;
                const newNote = parsed.note || row.note || '';
                if (newEp !== row.episodeNo || newNote !== (row.note || '')) {
                    metadataUpdates.push({ fileId: row.fileId, episodeNo: newEp, note: newNote });
                }
            }
        }

        if (excludedFileIds.length > 0) {
            await pgQuery(`DELETE FROM archive_clips WHERE file_id = ANY($1::int[])`, [excludedFileIds]);
            console.log(`[ARCHIVE PURGE] ${excludedFileIds.length} adet cln/clean/kullanma/ham klip arşivden temizlendi.`);
        }

        if (metadataUpdates.length > 0) {
            const CHUNK = 200;
            for (let i = 0; i < metadataUpdates.length; i += CHUNK) {
                const slice = metadataUpdates.slice(i, i + CHUNK);
                const vals = [];
                const params = [];
                let p = 1;
                for (const u of slice) {
                    vals.push(`($${p}::int, $${p + 1}::int, $${p + 2}::text)`);
                    params.push(u.fileId, u.episodeNo, u.note);
                    p += 3;
                }
                await pgQuery(`
                    UPDATE archive_clips ac
                    SET episode_no = COALESCE(v.ep_no, ac.episode_no),
                        note = CASE WHEN v.note_txt IS NOT NULL AND v.note_txt <> '' THEN v.note_txt ELSE ac.note END
                    FROM (VALUES ${vals.join(', ')}) AS v(file_id, ep_no, note_txt)
                    WHERE ac.file_id = v.file_id
                `, params);
            }
        }

        await pgQuery(`
            DELETE FROM archive_programs
            WHERE COALESCE(is_active, false) = false
              AND id NOT IN (SELECT DISTINCT program_id FROM archive_clips WHERE program_id IS NOT NULL)
        `);

        await pgQuery(`
            UPDATE archive_programs ap
            SET total_clips = sub.clip_count,
                total_episodes = sub.ep_count,
                total_duration_sec = sub.dur_sum
            FROM (
                SELECT program_id, COUNT(*) as clip_count, COUNT(DISTINCT episode_no) as ep_count, COALESCE(SUM(duration_sec), 0) as dur_sum
                FROM archive_clips
                GROUP BY program_id
            ) sub
            WHERE ap.id = sub.program_id
        `);

        if (delCatClips.rowCount > 0 || delCatProgs.rowCount > 0) {
            console.log(`[ARCHIVE PURGE] Ham ve Reklam kategorilerinden ${delCatProgs.rowCount} program ve ${delCatClips.rowCount} klip genel arşivden ayrıldı.`);
        }
    } catch (err) {
        console.warn('[ARCHIVE PURGE WARN]:', err.message);
    }
}

/**
 * MAM MSSQL veritabanındaki FileMetadata ve MetadataFields tablolarını tarayarak
 * tüm kliplerin metadata verilerini doğrudan PostgreSQL archive_clips tablosuna topluca senkronize eder.
 */
export async function syncAllClipsMetadataFromMssql() {
    await ensureClipMetadataColumn();
    let mssqlPool;
    try {
        mssqlPool = new sql.ConnectionPool(mssqlConfig);
        await mssqlPool.connect();

        console.log('[METADATA SYNC] MSSQL FileMetadata tablosundan tüm klip metadataları çekiliyor...');
        const q = `
            SELECT 
                fm.fileId,
                f.name as clipName,
                f.categoryId,
                mf.displayName as keyName,
                LTRIM(RTRIM(COALESCE(fm.stringvalue, CONVERT(varchar, fm.dateValue, 120), CAST(fm.integerValue as varchar)))) as val
            FROM FileMetadata fm
            JOIN MetadataFields mf ON mf.metadataId = fm.metadataId
            JOIN Files f ON f.fileId = fm.fileId AND f.deleted = 0
            WHERE f.categoryId NOT IN (6, 11)
              ${SQL_EXCLUDE_CLIPS_FILTER}
              AND COALESCE(fm.stringvalue, CONVERT(varchar, fm.dateValue, 120), CAST(fm.integerValue as varchar)) IS NOT NULL
              AND LTRIM(RTRIM(COALESCE(fm.stringvalue, CONVERT(varchar, fm.dateValue, 120), CAST(fm.integerValue as varchar)))) <> ''
            ORDER BY fm.fileId ASC, mf.metadataId ASC
        `;

        const res = await mssqlPool.request().query(q);
        const rows = res.recordset || [];

        const byFileId = new Map();
        for (const r of rows) {
            if (!r.val) continue;
            if (!byFileId.has(r.fileId)) {
                byFileId.set(r.fileId, { clipName: r.clipName, categoryId: r.categoryId, list: [] });
            }
            byFileId.get(r.fileId).list.push({ keyName: r.keyName, val: r.val });
        }

        if (isPostgresReady() && byFileId.size > 0) {
            const entries = Array.from(byFileId.entries());
            const CHUNK = 200;
            let updatedClipsCount = 0;

            for (let i = 0; i < entries.length; i += CHUNK) {
                const slice = entries.slice(i, i + CHUNK);
                const valuesSql = [];
                const params = [];
                let pIdx = 1;

                for (const [fileId, item] of slice) {
                    const { list: cleanList, summary } = parseMetadataSummary(item.list);
                    const parsed = parseClipWithMetadata(item.clipName, item.categoryId, summary);
                    const epNo = parsed.episode || summary.bolumNo || null;
                    const epNote = parsed.note || summary.bolumAdi || null;
                    valuesSql.push(`($${pIdx}::int, $${pIdx + 1}::jsonb, $${pIdx + 2}::int, $${pIdx + 3}::text)`);
                    params.push(fileId, JSON.stringify(cleanList), epNo, epNote);
                    pIdx += 4;
                }

                const updateQuery = `
                    UPDATE archive_clips ac
                    SET metadata = v.meta,
                        episode_no = COALESCE(v.ep_no, ac.episode_no),
                        note = CASE WHEN v.ep_title IS NOT NULL AND v.ep_title <> '' THEN v.ep_title ELSE ac.note END
                    FROM (VALUES ${valuesSql.join(', ')}) AS v(file_id, meta, ep_no, ep_title)
                    WHERE ac.file_id = v.file_id
                `;
                const upRes = await pgQuery(updateQuery, params);
                updatedClipsCount += upRes.rowCount || 0;
            }

            await purgeExcludedArchiveData();
            await applyParsingRulesToArchive();

            console.log(`[METADATA SYNC] PostgreSQL'de ${updatedClipsCount} klibin metadata ve bölüm/konu bilgileri güncellendi!`);
            return {
                success: true,
                mssqlClipsWithMetadata: byFileId.size,
                totalMetadataFields: rows.length,
                updatedPostgresClips: updatedClipsCount
            };
        }

        await purgeExcludedArchiveData();
        await applyParsingRulesToArchive();
        return {
            success: true,
            mssqlClipsWithMetadata: byFileId.size,
            totalMetadataFields: rows.length,
            updatedPostgresClips: 0
        };
    } catch (err) {
        console.error('[METADATA SYNC ERROR]:', err);
        throw err;
    } finally {
        if (mssqlPool) await mssqlPool.close();
    }
}

/**
 * YALNIZCA Reklam Yönetimi alanı için Kategori 6 (Reklam) bilgilerini ve reklam spotlarını
 * (metadata bilgileriyle birlikte, cln/clean/kullanma hariç) MSSQL'den çeker.
 */
export async function getAdsArchiveFromMssql(searchQuery = '') {
    let mssqlPool;
    try {
        mssqlPool = new sql.ConnectionPool(mssqlConfig);
        await mssqlPool.connect();

        const schemaMap = await getCategoryMetadataSchemaMap(mssqlPool, true);
        const categoryMetadataFields = schemaMap[6] || [];

        const q = `
            SELECT 
                f.fileId,
                f.name,
                f.fileName,
                f.duration,
                ROUND(f.duration / 1000.0, 0) as durSec,
                f.fileCreateTime,
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
            WHERE f.deleted = 0
              AND f.categoryId = 6
              ${SQL_EXCLUDE_CLIPS_FILTER}
            ORDER BY f.fileCreateTime DESC
        `;

        const res = await mssqlPool.request().query(q);
        const rawAds = res.recordset || [];

        const adsList = [];
        const brandsMap = {};
        let totalDurationSec = 0;

        for (const row of rawAds) {
            let rawMetaArr = [];
            if (row.metadataJson) {
                try {
                    rawMetaArr = JSON.parse(row.metadataJson);
                } catch (e) {}
            }

            if (isExcludedClip(row.name, row.fileName, rawMetaArr)) {
                continue;
            }

            const { list: cleanMetadata, summary: metaSum } = parseMetadataSummary(rawMetaArr);
            const { brand, campaign } = parseAdClipName(row.name, metaSum);
            const sec = Math.max(0, parseInt(row.durSec) || 0);

            if (searchQuery && searchQuery.trim()) {
                const sq = searchQuery.toLocaleLowerCase('tr-TR').trim();
                const hay = `${row.name} ${brand} ${campaign} ${metaSum.ajans || ''} ${metaSum.sirketMarka || ''} ${row.fileId}`.toLocaleLowerCase('tr-TR');
                if (!hay.includes(sq)) continue;
            }

            totalDurationSec += sec;

            const adItem = {
                fileId: row.fileId,
                name: row.name,
                fileName: row.fileName,
                brand,
                campaign,
                durationSec: sec,
                durationFormatted: formatSeconds(sec),
                fileCreateTime: row.fileCreateTime,
                metadata: cleanMetadata,
                metadataSummary: metaSum
            };

            adsList.push(adItem);

            if (!brandsMap[brand]) {
                brandsMap[brand] = {
                    brand,
                    spotsCount: 0,
                    totalClips: 0,
                    totalDurationSec: 0,
                    lastDate: row.fileCreateTime,
                    spots: [],
                    clips: []
                };
            }
            brandsMap[brand].spotsCount += 1;
            brandsMap[brand].totalClips += 1;
            brandsMap[brand].totalDurationSec += sec;
            brandsMap[brand].spots.push(adItem);
            brandsMap[brand].clips.push(adItem);
        }

        const brandGroups = Object.values(brandsMap)
            .map(b => ({
                ...b,
                totalDurationFormatted: formatSeconds(b.totalDurationSec)
            }))
            .sort((a, b) => b.spotsCount - a.spotsCount);

        return {
            success: true,
            category: {
                id: 6,
                categoryId: 6,
                name: 'Reklam',
                categoryName: 'Reklam',
                metadataFields: categoryMetadataFields.map(mf => ({
                    id: mf.metadataId,
                    metadataId: mf.metadataId,
                    name: mf.displayName,
                    displayName: mf.displayName
                }))
            },
            totalAds: adsList.length,
            totalBrands: brandGroups.length,
            totalDurationSec,
            totalDurationFormatted: formatSeconds(totalDurationSec),
            brandGroups,
            ads: adsList,
            clips: adsList
        };
    } catch (err) {
        console.error('[ADS ARCHIVE ERROR]:', err);
        throw err;
    } finally {
        if (mssqlPool) await mssqlPool.close();
    }
}

let sharedStatusPool = null;
async function getSharedMssqlPool() {
    if (sharedStatusPool && sharedStatusPool.connected) {
        return sharedStatusPool;
    }
    try {
        if (sharedStatusPool) {
            try { await sharedStatusPool.close(); } catch (e) {}
        }
    } catch (e) {}
    sharedStatusPool = new sql.ConnectionPool({
        ...mssqlConfig,
        pool: { max: 5, min: 0, idleTimeoutMillis: 60000 },
        connectionTimeout: 5000,
        requestTimeout: 15000
    });
    await sharedStatusPool.connect();
    return sharedStatusPool;
}

/**
 * TV MAM DB (MSSQL) bağlantısını canlı kontrol eder ve Bizim DB (PostgreSQL) ile
 * kategori bazında klip sayılarını, son eklenen klip ID'lerini (Delta) ve yeni eklenen kliplerin önizlemesini karşılaştırır.
 */
export async function checkMamDatabaseConnectionAndUpdates() {
    await ensureClipMetadataColumn();
    const checkedAt = new Date().toISOString();
    const startMs = Date.now();

    const pgConnected = isPostgresReady();
    const localMamByCat = new Map();
    const ourDbByCat = new Map();
    const catNamesMap = new Map();

    if (pgConnected) {
        try {
            const catsRes = await pgQuery(`SELECT id, name FROM categories WHERE id NOT IN (6, 11) ORDER BY id ASC`);
            for (const c of catsRes.rows) {
                catNamesMap.set(Number(c.id), c.name);
            }

            // 1. Kaynak TV MAM kategorisine (mam_category_id) göre yerel DB'deki klip sayıları ve en son çekilen file_id
            const mamOriginRes = await pgQuery(`
                SELECT 
                    COALESCE(mam_category_id, category_id) as "mamCategoryId",
                    COUNT(*) as "clipCount",
                    MAX(file_id) as "maxFileId",
                    MAX(file_create_time) as "latestDate"
                FROM archive_clips
                WHERE COALESCE(mam_category_id, category_id) NOT IN (6, 11)
                GROUP BY COALESCE(mam_category_id, category_id)
            `);
            for (const r of mamOriginRes.rows) {
                localMamByCat.set(Number(r.mamCategoryId), {
                    clipCount: parseInt(r.clipCount || 0, 10),
                    maxFileId: parseInt(r.maxFileId || 0, 10) || 0,
                    latestDate: r.latestDate || null
                });
            }

            // 2. Bizim kullandığımız kategoriye (category_id) göre yerel DB'deki program ve klip sayıları
            const ourCatRes = await pgQuery(`
                SELECT 
                    c.id as "categoryId",
                    c.name as "categoryName",
                    COUNT(DISTINCT ap.id) as "programsCount",
                    COUNT(DISTINCT CASE WHEN ap.is_active = true THEN ap.id END) as "activeProgramsCount",
                    COALESCE(SUM(ap.total_clips), 0) as "ourClipCount"
                FROM categories c
                LEFT JOIN archive_programs ap ON ap.category_id = c.id
                WHERE c.id NOT IN (6, 11)
                GROUP BY c.id, c.name
                ORDER BY c.id ASC
            `);
            for (const r of ourCatRes.rows) {
                ourDbByCat.set(Number(r.categoryId), {
                    programsCount: parseInt(r.programsCount || 0, 10),
                    activeProgramsCount: parseInt(r.activeProgramsCount || 0, 10),
                    ourClipCount: parseInt(r.ourClipCount || 0, 10)
                });
            }
        } catch (err) {
            console.warn('[MAM STATUS PG QUERY WARN]:', err.message);
        }
    }

    let mssqlConnected = false;
    let mssqlLatencyMs = null;
    let mssqlError = null;
    const mamByCat = new Map();
    const newClipsPreview = [];

    try {
        const pool = await getSharedMssqlPool();
        mssqlConnected = true;
        mssqlLatencyMs = Date.now() - startMs;

        // Kategori bazlı localMaxFileId CASE ifadesi oluştur (Sadece gerçekten yeni eklenen klipleri saymak için)
        const caseClauses = BROADCAST_CATEGORY_IDS.map(cid => {
            const maxId = localMamByCat.get(cid)?.maxFileId || 0;
            return `WHEN f.categoryId = ${cid} AND f.fileId > ${maxId} THEN 1`;
        }).join(' ');

        const q = `
            SELECT 
                c.categoryId,
                c.categoryName,
                COUNT(f.fileId) as mamClipCount,
                MAX(f.fileId) as mamMaxFileId,
                MAX(f.fileCreateTime) as mamLatestDate,
                SUM(CASE ${caseClauses} ELSE 0 END) as newClipsCount
            FROM Categories c
            LEFT JOIN Files f ON f.categoryId = c.categoryId
                AND f.deleted = 0
                AND f.duration > 0
                ${SQL_EXCLUDE_CLIPS_FILTER}
            WHERE c.categoryId NOT IN (6, 11)
            GROUP BY c.categoryId, c.categoryName
            ORDER BY c.categoryId ASC
        `;
        const res = await pool.request().query(q);
        const catsWithNewClips = [];

        for (const r of res.recordset || []) {
            const catId = Number(r.categoryId);
            const rawNewCount = parseInt(r.newClipsCount || 0, 10);
            mamByCat.set(catId, {
                categoryId: catId,
                categoryName: r.categoryName,
                mamClipCount: parseInt(r.mamClipCount || 0, 10),
                mamMaxFileId: parseInt(r.mamMaxFileId || 0, 10) || null,
                mamLatestDate: r.mamLatestDate || null,
                newClipsCount: rawNewCount
            });
            if (rawNewCount > 0) {
                catsWithNewClips.push(catId);
            }
        }

        // Eğer yeni eklenen klip varsa, önizleme listesini çek (en fazla 30 yeni klip)
        if (catsWithNewClips.length > 0) {
            const whereOr = catsWithNewClips.map(cid => {
                const maxId = localMamByCat.get(cid)?.maxFileId || 0;
                return `(f.categoryId = ${cid} AND f.fileId > ${maxId})`;
            }).join(' OR ');

            const previewQ = `
                SELECT TOP 30
                    f.fileId,
                    f.name,
                    f.fileName,
                    f.categoryId,
                    c.categoryName,
                    ROUND(f.duration / 1000.0, 0) as durationSec,
                    f.fileCreateTime
                FROM Files f
                LEFT JOIN Categories c ON c.categoryId = f.categoryId
                WHERE f.deleted = 0
                  AND f.duration > 0
                  ${SQL_EXCLUDE_CLIPS_FILTER}
                  AND (${whereOr})
                ORDER BY f.fileId DESC
            `;
            const prevRes = await pool.request().query(previewQ);
            for (const row of prevRes.recordset || []) {
                if (!isExcludedClip(row.name, row.fileName, [])) {
                    const sec = Math.max(0, parseInt(row.durationSec || 0, 10));
                    newClipsPreview.push({
                        fileId: row.fileId,
                        name: row.name,
                        fileName: row.fileName,
                        mamCategoryId: Number(row.categoryId),
                        mamCategoryName: row.categoryName,
                        durationSec: sec,
                        durationFormatted: formatSeconds(sec),
                        fileCreateTime: row.fileCreateTime
                    });
                }
            }
        }
    } catch (err) {
        mssqlConnected = false;
        mssqlError = err.message;
        sharedStatusPool = null;
    }

    const allCatIds = Array.from(new Set([
        ...BROADCAST_CATEGORY_IDS,
        ...mamByCat.keys(),
        ...catNamesMap.keys()
    ])).filter(id => id !== 6 && id !== 11).sort((a, b) => a - b);

    const categoriesComparison = allCatIds.map(catId => {
        const mamInfo = mamByCat.get(catId);
        const localMamInfo = localMamByCat.get(catId) || { clipCount: 0, maxFileId: 0, latestDate: null };
        const ourInfo = ourDbByCat.get(catId) || { programsCount: 0, activeProgramsCount: 0, ourClipCount: 0 };
        const categoryName = mamInfo?.categoryName || catNamesMap.get(catId) || `Kategori ${catId}`;

        const mamClipCount = mamInfo ? mamInfo.mamClipCount : localMamInfo.clipCount;
        const localSyncedFromMamCount = localMamInfo.clipCount;
        const newClipsDiff = mssqlConnected
            ? (localSyncedFromMamCount === 0 ? mamClipCount : (mamInfo?.newClipsCount || 0))
            : 0;
        const hasNewFileId = Boolean(
            mssqlConnected &&
            mamInfo?.mamMaxFileId &&
            (!localMamInfo.maxFileId || mamInfo.mamMaxFileId > localMamInfo.maxFileId)
        );
        const hasUpdates = Boolean(mssqlConnected && (newClipsDiff > 0 || hasNewFileId));

        return {
            categoryId: catId,
            categoryName,
            mamClipCount,
            localSyncedFromMamCount,
            ourClipCountByMamCategory: localSyncedFromMamCount,
            ourClipCount: ourInfo.ourClipCount,
            ourClipCountByOurCategory: ourInfo.ourClipCount,
            programsCount: ourInfo.programsCount,
            ourProgramsCount: ourInfo.programsCount,
            activeProgramsCount: ourInfo.activeProgramsCount,
            ourActiveProgramsCount: ourInfo.activeProgramsCount,
            newClipsDiff,
            diffCount: newClipsDiff,
            hasNewFileId,
            hasUpdates,
            mamMaxFileId: mamInfo?.mamMaxFileId || null,
            localMaxFileId: localMamInfo.maxFileId || null,
            mamLatestDate: mamInfo?.mamLatestDate || null,
            localLatestDate: localMamInfo.latestDate || null
        };
    });

    const totalMamClips = categoriesComparison.reduce((sum, c) => sum + (c.mamClipCount || 0), 0);
    const totalLocalClips = categoriesComparison.reduce((sum, c) => sum + (c.localSyncedFromMamCount || 0), 0);
    const totalNewClips = categoriesComparison.reduce((sum, c) => sum + (c.newClipsDiff || 0), 0);
    const categoriesWithUpdates = categoriesComparison.filter(c => c.hasUpdates);

    const connObj = {
        connected: mssqlConnected,
        server: mssqlConfig.server,
        database: mssqlConfig.database,
        latencyMs: mssqlLatencyMs,
        checkedAt,
        error: mssqlError
    };
    const pgObj = {
        connected: pgConnected,
        database: process.env.PG_DATABASE || 'yayin_planlama'
    };

    return {
        success: true,
        checkedAt,
        mamConnection: connObj,
        mssqlConnection: connObj,
        ourDbConnection: pgObj,
        postgresConnection: pgObj,
        summary: {
            totalMamClips,
            totalOurClips: totalLocalClips,
            totalLocalClips,
            totalNewClips,
            totalDiffCount: totalNewClips,
            hasAnyUpdates: categoriesWithUpdates.length > 0,
            categoriesWithUpdates: categoriesWithUpdates.length,
            categoriesWithUpdatesCount: categoriesWithUpdates.length
        },
        newClipsPreview,
        categories: categoriesComparison
    };
}

/**
 * AKILLI DELTA SENKRONİZASYON:
 * Tüm 15.000+ klibi baştan taramak yerine, yalnızca Bizim DB'de olmayan YENİ EKLENEN (fileId > localMaxFileId)
 * klipleri TV MAM DB'den çeker, programlarına bağlar (bizim özel kategorilerimizi koruyarak) ve kaydeder.
 */
export async function syncDeltaUpdatesFromMam(targetCategoryId = null) {
    if (!isPostgresReady()) {
        throw new Error('PostgreSQL veritabanı hazır değil.');
    }
    await ensureClipMetadataColumn();

    const catIdsToCheck = targetCategoryId
        ? [parseInt(targetCategoryId, 10)].filter(id => id && id !== 6 && id !== 11)
        : BROADCAST_CATEGORY_IDS;

    const maxIdRes = await pgQuery(`
        SELECT 
            COALESCE(mam_category_id, category_id) as "mamCategoryId",
            COALESCE(MAX(file_id), 0) as "maxFileId"
        FROM archive_clips
        WHERE COALESCE(mam_category_id, category_id) = ANY($1::int[])
        GROUP BY COALESCE(mam_category_id, category_id)
    `, [catIdsToCheck]);

    const maxIdByCat = new Map();
    for (const r of maxIdRes.rows) {
        maxIdByCat.set(Number(r.mamCategoryId), parseInt(r.maxFileId || 0, 10));
    }

    const pool = await getSharedMssqlPool();
    let totalNewSynced = 0;
    const syncedCategories = [];
    const affectedProgramIds = new Set();

    for (const catId of catIdsToCheck) {
        const lastMaxFileId = maxIdByCat.get(catId) || 0;
        const catRes = await pool.request().query(`SELECT categoryId, categoryName FROM Categories WHERE categoryId = ${catId}`);
        const categoryName = catRes.recordset[0]?.categoryName || `Kategori ${catId}`;

        const q = `
            SELECT 
                f.fileId, 
                f.name, 
                f.fileName, 
                f.duration, 
                ROUND(f.duration / 1000.0, 0) as durSec,
                f.fileCreateTime,
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
            WHERE f.deleted = 0
              AND f.duration > 0
              AND f.categoryId = ${catId}
              AND f.fileId > ${lastMaxFileId}
              ${SQL_EXCLUDE_CLIPS_FILTER}
            ORDER BY f.fileId ASC
        `;

        const res = await pool.request().query(q);
        const rows = res.recordset || [];
        if (rows.length === 0) continue;

        const clipsToUpsert = [];
        for (const row of rows) {
            let rawMetaArr = [];
            if (row.metadataJson) {
                try { rawMetaArr = JSON.parse(row.metadataJson); } catch (e) {}
            }
            if (isExcludedClip(row.name, row.fileName, rawMetaArr)) continue;

            const { list: cleanMetadata, summary: metaSum } = parseMetadataSummary(rawMetaArr);
            const parsed = parseClipWithMetadata(row.name, catId, metaSum);
            const sec = Math.max(0, parseInt(row.durSec, 10) || 0);
            const title = parsed.program;
            const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

            // Mevcut programı bul (özel kategoriye taşınmış olsa bile mam_category_id + mam_title ile yakala)
            const existingProgRes = await pgQuery(`
                SELECT id, category_id as "categoryId", category_name as "categoryName", title
                FROM archive_programs
                WHERE (COALESCE(mam_category_id, category_id) = $1 AND LOWER(COALESCE(mam_title, title)) = LOWER($2))
                   OR (category_id = $1 AND LOWER(title) = LOWER($2))
                ORDER BY is_active DESC, id ASC
                LIMIT 1
            `, [catId, title]);

            let programId;
            let effectiveCatId = catId;
            let effectiveCatName = categoryName;

            if (existingProgRes.rows.length > 0) {
                const ex = existingProgRes.rows[0];
                programId = ex.id;
                effectiveCatId = ex.categoryId || catId;
                effectiveCatName = ex.categoryName || categoryName;
                await pgQuery(`
                    UPDATE archive_programs
                    SET last_date = COALESCE(GREATEST(last_date, $1), $1, last_date),
                        updated_at = NOW()
                    WHERE id = $2
                `, [row.fileCreateTime, programId]);
            } else {
                const insertProgRes = await pgQuery(`
                    INSERT INTO archive_programs (
                        category_id, category_name, mam_category_id, mam_category_name,
                        title, mam_title, slug,
                        total_episodes, total_clips, total_duration_sec,
                        first_date, last_date, updated_at
                    )
                    VALUES ($1, $2, $1, $2, $3, $3, $4, 1, 1, $5, $6, $6, NOW())
                    ON CONFLICT (category_id, title) DO UPDATE
                    SET last_date = COALESCE(GREATEST(archive_programs.last_date, EXCLUDED.last_date), EXCLUDED.last_date),
                        updated_at = NOW()
                    RETURNING id, category_id as "categoryId", category_name as "categoryName"
                `, [catId, categoryName, title, slug, sec, row.fileCreateTime]);
                programId = insertProgRes.rows[0].id;
                effectiveCatId = insertProgRes.rows[0].categoryId || catId;
                effectiveCatName = insertProgRes.rows[0].categoryName || categoryName;
            }

            affectedProgramIds.add(programId);
            clipsToUpsert.push({
                fileId: row.fileId,
                programId,
                categoryId: effectiveCatId,
                categoryName: effectiveCatName,
                mamCategoryId: catId,
                mamCategoryName: categoryName,
                name: row.name,
                fileName: row.fileName,
                episodeNo: parsed.episode,
                partNo: parsed.part,
                note: parsed.note,
                metadata: cleanMetadata,
                metadataSummary: metaSum,
                durationSec: sec,
                durationFormatted: formatSeconds(sec),
                fileCreateTime: row.fileCreateTime
            });
        }

        if (clipsToUpsert.length > 0) {
            await batchUpsertClips(clipsToUpsert);
            totalNewSynced += clipsToUpsert.length;
            syncedCategories.push({
                categoryId: catId,
                categoryName,
                newClipsAdded: clipsToUpsert.length
            });
        }
    }

    if (affectedProgramIds.size > 0) {
        await pgQuery(`
            UPDATE archive_programs ap
            SET total_clips = sub.clip_count,
                total_episodes = sub.ep_count,
                total_duration_sec = sub.dur_sum,
                updated_at = NOW()
            FROM (
                SELECT program_id, COUNT(*) as clip_count, COUNT(DISTINCT episode_no) as ep_count, COALESCE(SUM(duration_sec), 0) as dur_sum
                FROM archive_clips
                WHERE program_id = ANY($1::int[])
                GROUP BY program_id
            ) sub
            WHERE ap.id = sub.program_id
        `, [Array.from(affectedProgramIds)]);
    }

    return {
        success: true,
        totalNewSynced,
        affectedProgramsCount: affectedProgramIds.size,
        syncedCategories
    };
}

