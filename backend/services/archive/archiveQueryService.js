/**
 * @file backend/services/archive/archiveQueryService.js
 * @description Yerel PostgreSQL arşiv veritabanından hızlı okuma, kategori durumu,
 * aktif program listesi ve Türkçe karakter duyarsız program/klip arama servisleri.
 */
import sql from 'mssql';
import { query as pgQuery, isPostgresReady } from '../../db/postgres.js';
import {
    SQL_EXCLUDE_CLIPS_FILTER,
    formatSeconds
} from '../archiveClipParser.js';
import {
    mssqlConfig,
    ensureClipMetadataColumn,
    ensureParsingRulesTable,
    getCategoryMetadataSchemaMap,
    buildTurkishRegexPattern
} from './archiveSchemaService.js';
import { syncCategoryArchive } from './archiveSyncService.js';

/**
 * PostgreSQL'den seçilen kategorideki program ve klip arşivini (tekil toplu sorgu ile, N+1 olmadan) getirir.
 */
export async function getCategoryArchiveFromDb(categoryId, isActive = null, filterMode = 'our') {
    const catId = parseInt(categoryId, 10);
    if (catId === 6 || catId === 11) {
        return {
            success: true,
            categoryId: catId,
            categoryName: catId === 6 ? 'Reklam' : 'Ham',
            metadataFields: [],
            totalClips: 0,
            totalDurationSec: 0,
            totalDurationFormatted: '00.00.00.00',
            programsCount: 0,
            activeProgramsCount: 0,
            programs: []
        };
    }

    if (!isPostgresReady()) {
        return syncCategoryArchive(catId);
    }

    await ensureClipMetadataColumn();

    const isMamFilter = filterMode === 'mam';
    let whereClause = isMamFilter
        ? 'WHERE COALESCE(ap.mam_category_id, ap.category_id) = $1 AND COALESCE(ap.mam_category_id, ap.category_id) NOT IN (6, 11)'
        : 'WHERE ap.category_id = $1 AND ap.category_id NOT IN (6, 11)';
    const params = [catId];

    if (isActive === true || isActive === 'true') {
        whereClause += ' AND ap.is_active = true';
    } else if (isActive === false || isActive === 'false') {
        whereClause += ' AND ap.is_active = false';
    }

    const progRes = await pgQuery(`
        SELECT 
            ap.id,
            ap.category_id as "categoryId",
            COALESCE(cat.name, ap.category_name) as "categoryName",
            cat.color as "categoryColor",
            cat.badge as "categoryBadge",
            COALESCE(ap.mam_category_id, ap.category_id) as "mamCategoryId",
            COALESCE(mam_cat.name, ap.mam_category_name, ap.category_name) as "mamCategoryName",
            ap.title,
            COALESCE(ap.mam_title, ap.title) as "mamTitle",
            COALESCE(ap.is_custom_category, false) as "isCustomCategory",
            COALESCE(ap.unit_type, 'bolum') as "unitType",
            ap.total_episodes as "totalEpisodes",
            ap.total_clips as "totalClips",
            ap.total_duration_sec as "totalDurationSec",
            ap.first_date as "firstDate",
            ap.last_date as "lastDate",
            COALESCE(ap.is_active, false) as "isActive"
        FROM archive_programs ap
        LEFT JOIN categories cat ON cat.id = ap.category_id
        LEFT JOIN categories mam_cat ON mam_cat.id = COALESCE(ap.mam_category_id, ap.category_id)
        ${whereClause}
        ORDER BY ap.is_active DESC, ap.total_clips DESC, ap.title ASC
    `, params);

    const schemaMap = await getCategoryMetadataSchemaMap(null, false);
    const categoryMetadataFields = schemaMap[catId] || [];

    const progIds = progRes.rows.map(p => p.id);
    let clipsRows = [];
    if (progIds.length > 0) {
        const clipsRes = await pgQuery(`
            SELECT 
                c.file_id as "fileId",
                c.program_id as "programId",
                c.category_id as "categoryId",
                COALESCE(cat.name, '') as "categoryName",
                COALESCE(c.mam_category_id, c.category_id) as "mamCategoryId",
                COALESCE(mam_cat.name, c.mam_category_name, '') as "mamCategoryName",
                COALESCE(c.is_custom_assigned, false) as "isCustomAssigned",
                c.name,
                c.file_name as "fileName",
                c.episode_no as "episodeNo",
                c.part_no as "partNo",
                COALESCE(c.unit_type, 'bolum') as "unitType",
                c.unit_label as "unitLabel",
                c.note,
                c.duration_sec as "durationSec",
                COALESCE(c.duration_formatted, '00.00.00.00') as "durationFormatted",
                c.file_create_time as "fileCreateTime",
                COALESCE(c.metadata_summary, '{}'::jsonb) as "metadataSummary"
            FROM archive_clips c
            LEFT JOIN categories cat ON cat.id = c.category_id
            LEFT JOIN categories mam_cat ON mam_cat.id = COALESCE(c.mam_category_id, c.category_id)
            WHERE c.program_id = ANY($1::int[])
            ORDER BY c.file_create_time DESC NULLS LAST, c.episode_no DESC NULLS LAST, c.part_no ASC
        `, [progIds]);
        clipsRows = clipsRes.rows;
    }

    const clipsByProgId = new Map();
    for (const c of clipsRows) {
        if (!clipsByProgId.has(c.programId)) {
            clipsByProgId.set(c.programId, []);
        }
        clipsByProgId.get(c.programId).push(c);
    }

    const programs = [];
    for (const prog of progRes.rows) {
        const cleanClips = clipsByProgId.get(prog.id) || [];
        if (cleanClips.length === 0 && !prog.isActive) continue;

        const dominantUnitType =
            (prog.unitType && prog.unitType !== 'bolum' ? prog.unitType : null) ||
            cleanClips.find(c => c.unitType && c.unitType !== 'bolum')?.unitType ||
            'bolum';
        const progDurSec = prog.totalDurationSec || cleanClips.reduce((acc, c) => acc + (c.durationSec || 0), 0);

        programs.push({
            id: prog.id,
            title: prog.title,
            mamTitle: prog.mamTitle,
            categoryId: prog.categoryId,
            categoryName: prog.categoryName,
            mamCategoryId: prog.mamCategoryId,
            mamCategoryName: prog.mamCategoryName,
            isCustomCategory: Boolean(prog.isCustomCategory || prog.categoryId !== prog.mamCategoryId),
            totalEpisodes: prog.totalEpisodes,
            unitType: dominantUnitType,
            totalClips: cleanClips.length,
            totalDurationSec: progDurSec,
            totalDurationFormatted: formatSeconds(progDurSec),
            firstDate: prog.firstDate,
            lastDate: prog.lastDate,
            isActive: prog.isActive,
            clips: cleanClips
        });
    }

    const totalDur = programs.reduce((acc, p) => acc + (p.totalDurationSec || 0), 0);
    const catNameRes = await pgQuery(`SELECT name FROM categories WHERE id = $1`, [catId]);
    const resolvedCatName = catNameRes.rows[0]?.name || programs[0]?.categoryName || `Kategori ${catId}`;

    return {
        success: true,
        categoryId: catId,
        categoryName: resolvedCatName,
        filterMode,
        metadataFields: categoryMetadataFields,
        totalClips: programs.reduce((acc, p) => acc + p.totalClips, 0),
        totalDurationSec: totalDur,
        totalDurationFormatted: formatSeconds(totalDur),
        programsCount: programs.length,
        activeProgramsCount: programs.filter(p => p.isActive).length,
        programs
    };
}

/**
 * Tüm yayın kategorilerinde (Ham ve Reklam hariç) kullanıma açık (aktif) olan programları listeler.
 */
export async function getUsedProgramsList() {
    await ensureClipMetadataColumn();
    const rules = await ensureParsingRulesTable();
    const ruleByTitle = new Map();
    for (const r of rules) {
        if (r.programTitle) {
            ruleByTitle.set(r.programTitle.toLocaleLowerCase('tr-TR'), r);
        }
    }

    const res = await pgQuery(`
        SELECT 
            ap.id,
            ap.category_id as "categoryId",
            COALESCE(cat.name, ap.category_name) as "categoryName",
            cat.color as "categoryColor",
            cat.badge as "categoryBadge",
            COALESCE(ap.mam_category_id, ap.category_id) as "mamCategoryId",
            COALESCE(mam_cat.name, ap.mam_category_name, ap.category_name) as "mamCategoryName",
            ap.title,
            COALESCE(ap.mam_title, ap.title) as "mamTitle",
            COALESCE(ap.unit_type, 'bolum') as "unitType",
            ap.total_episodes as "totalEpisodes",
            ap.total_clips as "totalClips",
            ap.total_duration_sec as "totalDurationSec",
            ap.first_date as "firstDate",
            ap.last_date as "lastDate",
            ap.is_active as "isActive"
        FROM archive_programs ap
        LEFT JOIN categories cat ON cat.id = ap.category_id
        LEFT JOIN categories mam_cat ON mam_cat.id = COALESCE(ap.mam_category_id, ap.category_id)
        WHERE ap.is_active = true
          AND ap.category_id NOT IN (6, 11)
        ORDER BY ap.category_id ASC, ap.total_clips DESC
    `);

    return res.rows.map(p => {
        const matchedRule = ruleByTitle.get((p.title || '').toLocaleLowerCase('tr-TR'));
        return {
            id: p.id,
            title: p.title,
            mamTitle: p.mamTitle,
            categoryId: p.categoryId,
            categoryName: p.categoryName,
            categoryColor: p.categoryColor || null,
            categoryBadge: p.categoryBadge || null,
            mamCategoryId: p.mamCategoryId,
            mamCategoryName: p.mamCategoryName,
            totalEpisodes: p.totalEpisodes,
            totalClips: p.totalClips,
            totalDurationSec: p.totalDurationSec,
            totalDurationFormatted: formatSeconds(p.totalDurationSec),
            firstDate: p.firstDate,
            lastDate: p.lastDate,
            unitType: matchedRule?.unitType || p.unitType || 'bolum',
            extractSource: matchedRule?.extractSource || 'both',
            isActive: true
        };
    });
}

/**
 * Tüm yayın kategorileri genelinde (Ham ve Reklam hariç) doğrudan yerel PostgreSQL'den hızlı program başlığı araması yapar.
 */
export async function searchAllArchivePrograms(query = '', categoryId = null, limit = 'all') {
    await ensureClipMetadataColumn();
    let whereParts = ['category_id NOT IN (6, 11)'];
    let params = [];
    let pIdx = 1;

    if (query && query.trim()) {
        const tokens = query.trim().split(/[\s_\-]+/).filter(Boolean);
        for (const token of tokens) {
            const pattern = buildTurkishRegexPattern(token);
            whereParts.push(`title ~* $${pIdx}`);
            params.push(pattern);
            pIdx++;
        }
    }

    if (categoryId && parseInt(categoryId, 10) > 0) {
        whereParts.push(`category_id = $${pIdx}`);
        params.push(parseInt(categoryId, 10));
        pIdx++;
    }

    const isUnlimited = limit === 'all' || limit === '0' || limit === 0 || limit === null || limit === undefined;
    let limitClause = '';
    if (!isUnlimited) {
        const parsedLimit = parseInt(limit, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
            params.push(Math.min(50000, parsedLimit));
            limitClause = `LIMIT $${pIdx}`;
        }
    }

    const sqlQuery = `
        SELECT 
            id, category_id as "categoryId", category_name as "categoryName",
            title, COALESCE(unit_type, 'bolum') as "unitType",
            total_episodes as "totalEpisodes", total_clips as "totalClips",
            total_duration_sec as "totalDurationSec",
            is_active as "isActive"
        FROM archive_programs
        WHERE ${whereParts.join(' AND ')}
        ORDER BY is_active DESC, total_clips DESC, title ASC
        ${limitClause}
    `;

    const res = await pgQuery(sqlQuery, params);

    return res.rows.map(p => ({
        id: p.id,
        title: p.title,
        categoryId: p.categoryId,
        categoryName: p.categoryName,
        unitType: p.unitType || 'bolum',
        totalEpisodes: p.totalEpisodes,
        totalClips: p.totalClips,
        totalDurationSec: p.totalDurationSec,
        totalDurationFormatted: formatSeconds(p.totalDurationSec),
        isActive: p.isActive
    }));
}

/**
 * Belirli bir programın tüm kliplerini doğrudan yerel PostgreSQL'den getirir.
 */
export async function getProgramClipsFromDb(programId) {
    await ensureClipMetadataColumn();
    const res = await pgQuery(`
        SELECT 
            c.file_id as "fileId", c.name, c.file_name as "fileName",
            c.duration_sec as "durationSec",
            COALESCE(c.duration_formatted, '00.00.00.00') as "durationFormatted",
            c.file_create_time as "fileCreateTime",
            c.episode_no as "episodeNo",
            c.part_no as "partNo",
            COALESCE(c.unit_type, 'bolum') as "unitType",
            c.unit_label as "unitLabel",
            c.note,
            COALESCE(c.metadata, '[]'::jsonb) as metadata,
            COALESCE(c.metadata_summary, '{}'::jsonb) as "metadataSummary",
            c.program_id as "programId",
            c.category_id as "categoryId",
            COALESCE(c.mam_category_id, c.category_id) as "mamCategoryId",
            COALESCE(mam_cat.name, c.mam_category_name, cat.name) as "mamCategoryName",
            COALESCE(c.is_custom_assigned, false) as "isCustomAssigned",
            p.title as "programTitle",
            cat.name as "categoryName",
            cat.color as "categoryColor"
        FROM archive_clips c
        LEFT JOIN archive_programs p ON p.id = c.program_id
        LEFT JOIN categories cat ON cat.id = c.category_id
        LEFT JOIN categories mam_cat ON mam_cat.id = COALESCE(c.mam_category_id, c.category_id)
        WHERE c.program_id = $1
        ORDER BY 
            CASE WHEN c.episode_no IS NULL THEN 999999 ELSE c.episode_no END ASC,
            c.part_no ASC NULLS FIRST,
            c.file_create_time DESC
    `, [programId]);

    return res.rows;
}

/**
 * Yayın kategorilerinin (Ham ve Reklam hariç) durumunu yerel PostgreSQL'den anında getirir.
 */
export async function getArchiveCategoriesStatus(forceMssql = false) {
    await ensureClipMetadataColumn();

    if (!forceMssql && isPostgresReady()) {
        const pgRes = await pgQuery(`
            SELECT 
                c.id as "categoryId",
                c.name as "categoryName",
                c.color,
                c.badge,
                COUNT(ap.id) as "programsCount",
                COUNT(CASE WHEN ap.is_active = true THEN 1 END) as "activeProgramsCount",
                COALESCE(SUM(ap.total_clips), 0) as "syncedClipCount",
                COALESCE(SUM(ap.total_duration_sec), 0) as "totalDurationSec"
            FROM categories c
            LEFT JOIN archive_programs ap ON ap.category_id = c.id
            WHERE c.id NOT IN (6, 11)
            GROUP BY c.id, c.name, c.color, c.badge
            ORDER BY c.id ASC
        `);

        const totalSynced = pgRes.rows.reduce((acc, r) => acc + parseInt(r.syncedClipCount || 0, 10), 0);
        if (totalSynced > 0 || pgRes.rows.length > 0) {
            const schemaMap = await getCategoryMetadataSchemaMap(null, false);
            return pgRes.rows.map(row => {
                const syncedClipCount = parseInt(row.syncedClipCount || 0, 10);
                const programsCount = parseInt(row.programsCount || 0, 10);
                const activeProgramsCount = parseInt(row.activeProgramsCount || 0, 10);
                const totalDurationSec = parseInt(row.totalDurationSec || 0, 10);
                return {
                    id: row.categoryId,
                    categoryId: row.categoryId,
                    name: row.categoryName,
                    categoryName: row.categoryName,
                    color: row.color || '#3b82f6',
                    badge: row.badge || row.categoryName,
                    categoryPath: `/${row.categoryName}`,
                    metadataFields: schemaMap[row.categoryId] || [],
                    mssqlClipCount: syncedClipCount,
                    syncedClipCount,
                    programsCount,
                    activeProgramsCount,
                    totalDurationSec,
                    totalDurationFormatted: formatSeconds(totalDurationSec),
                    isSynced: syncedClipCount > 0 || row.categoryId > 11
                };
            });
        }
    }

    let mssqlPool;
    const catStats = [];
    try {
        mssqlPool = new sql.ConnectionPool(mssqlConfig);
        await mssqlPool.connect();

        const schemaMap = await getCategoryMetadataSchemaMap(mssqlPool, true);

        const mssqlRes = await mssqlPool.request().query(`
            SELECT c.categoryId, c.categoryName, c.categoryPath, COUNT(f.fileId) as clipCount
            FROM Categories c
            LEFT JOIN Files f ON f.categoryId = c.categoryId
              AND f.deleted = 0
              ${SQL_EXCLUDE_CLIPS_FILTER}
            WHERE c.categoryId NOT IN (6, 11)
            GROUP BY c.categoryId, c.categoryName, c.categoryPath
            ORDER BY c.categoryId ASC
        `);

        let pgMap = {};
        if (isPostgresReady()) {
            const pgRes = await pgQuery(`
                SELECT 
                    ap.category_id as "categoryId",
                    COUNT(ap.id) as "programsCount",
                    COUNT(CASE WHEN ap.is_active = true THEN 1 END) as "activeProgramsCount",
                    COALESCE(SUM(ap.total_clips), 0) as "syncedClipCount",
                    COALESCE(SUM(ap.total_duration_sec), 0) as "totalDurationSec"
                FROM archive_programs ap
                WHERE ap.category_id NOT IN (6, 11)
                GROUP BY ap.category_id
            `);
            for (const row of pgRes.rows) {
                pgMap[row.categoryId] = {
                    programsCount: parseInt(row.programsCount, 10),
                    activeProgramsCount: parseInt(row.activeProgramsCount, 10),
                    syncedClipCount: parseInt(row.syncedClipCount, 10),
                    totalDurationSec: parseInt(row.totalDurationSec, 10)
                };
            }
        }

        for (const row of mssqlRes.recordset) {
            const pgData = pgMap[row.categoryId] || { programsCount: 0, activeProgramsCount: 0, syncedClipCount: 0, totalDurationSec: 0 };
            const metadataFields = schemaMap[row.categoryId] || [];
            catStats.push({
                id: row.categoryId,
                categoryId: row.categoryId,
                name: row.categoryName,
                categoryName: row.categoryName,
                categoryPath: row.categoryPath,
                metadataFields,
                mssqlClipCount: row.clipCount,
                syncedClipCount: pgData.syncedClipCount,
                programsCount: pgData.programsCount,
                activeProgramsCount: pgData.activeProgramsCount,
                totalDurationSec: pgData.totalDurationSec,
                totalDurationFormatted: formatSeconds(pgData.totalDurationSec),
                isSynced: pgData.syncedClipCount > 0
            });
        }
    } catch (err) {
        console.error('[ARCHIVE CATS STATUS ERROR]:', err);
        throw err;
    } finally {
        if (mssqlPool) await mssqlPool.close();
    }

    return catStats;
}

/**
 * Tüm arşiv genelinde (Ham ve Reklam hariç) doğrudan yerel PostgreSQL'den hızlı klip araması yapar.
 */
export async function searchAllArchiveClips(query = '', categoryId = null, programId = null, limit = 'all', onlyActivePrograms = false) {
    await ensureClipMetadataColumn();
    let whereParts = ['c.category_id NOT IN (6, 11)'];
    let params = [];
    let pIdx = 1;

    if (onlyActivePrograms) {
        whereParts.push('p.is_active = true');
    }

    if (query && query.trim()) {
        const tokens = query.trim().split(/[\s_\-]+/).filter(Boolean);
        for (const token of tokens) {
            const pattern = buildTurkishRegexPattern(token);
            const isNumeric = /^\d+$/.test(token);
            if (isNumeric) {
                whereParts.push(`(c.name ~* $${pIdx} OR c.file_name ~* $${pIdx} OR c.note ~* $${pIdx} OR c.unit_label ~* $${pIdx} OR p.title ~* $${pIdx} OR c.episode_no = $${pIdx+1} OR CAST(c.file_id AS TEXT) LIKE $${pIdx+2})`);
                params.push(pattern, parseInt(token, 10), `%${token}%`);
                pIdx += 3;
            } else {
                whereParts.push(`(c.name ~* $${pIdx} OR c.file_name ~* $${pIdx} OR c.note ~* $${pIdx} OR c.unit_label ~* $${pIdx} OR p.title ~* $${pIdx})`);
                params.push(pattern);
                pIdx++;
            }
        }
    }

    if (categoryId && parseInt(categoryId, 10) > 0) {
        whereParts.push(`c.category_id = $${pIdx}`);
        params.push(parseInt(categoryId, 10));
        pIdx++;
    }

    if (programId && parseInt(programId, 10) > 0) {
        whereParts.push(`c.program_id = $${pIdx}`);
        params.push(parseInt(programId, 10));
        pIdx++;
    }

    const isUnlimited = limit === 'all' || limit === '0' || limit === 0 || limit === null || limit === undefined;
    let limitClause = '';
    if (!isUnlimited) {
        const parsedLimit = parseInt(limit, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
            params.push(Math.min(50000, parsedLimit));
            limitClause = `LIMIT $${pIdx}`;
        }
    }

    const sqlQuery = `
        SELECT 
            c.file_id as "fileId",
            c.name,
            c.file_name as "fileName",
            c.duration_sec as "durationSec",
            COALESCE(c.duration_formatted, '00.00.00.00') as "durationFormatted",
            c.file_create_time as "fileCreateTime",
            c.episode_no as "episodeNo",
            c.part_no as "partNo",
            COALESCE(c.unit_type, 'bolum') as "unitType",
            c.unit_label as "unitLabel",
            c.note,
            COALESCE(c.metadata_summary, '{}'::jsonb) as "metadataSummary",
            c.program_id as "programId",
            c.category_id as "categoryId",
            COALESCE(c.mam_category_id, c.category_id) as "mamCategoryId",
            COALESCE(mam_cat.name, c.mam_category_name, cat.name) as "mamCategoryName",
            COALESCE(c.is_custom_assigned, false) as "isCustomAssigned",
            p.title as "programTitle",
            cat.name as "categoryName",
            cat.color as "categoryColor"
        FROM archive_clips c
        LEFT JOIN archive_programs p ON p.id = c.program_id
        LEFT JOIN categories cat ON cat.id = c.category_id
        LEFT JOIN categories mam_cat ON mam_cat.id = COALESCE(c.mam_category_id, c.category_id)
        WHERE ${whereParts.join(' AND ')}
        ORDER BY 
            CASE WHEN c.episode_no IS NULL THEN 999999 ELSE c.episode_no END ASC,
            c.part_no ASC NULLS FIRST,
            c.file_create_time DESC,
            c.file_id DESC
        ${limitClause}
    `;

    const res = await pgQuery(sqlQuery, params);
    return res.rows;
}

