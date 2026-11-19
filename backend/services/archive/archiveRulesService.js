/**
 * @file backend/services/archive/archiveRulesService.js
 * @description Admin Panel "Programlar -> Kurallar" bölümü için ayrıştırma kurallarını
 * listeleme, oluşturma, güncelleme, silme ve tüm arşive güvenli biçimde (manuel programları ezmeden)
 * uygulama servisi.
 */
import { query as pgQuery } from '../../db/postgres.js';
import {
    isExcludedClip,
    parseClipWithMetadata,
    formatSeconds
} from '../archiveClipParser.js';
import {
    ensureClipMetadataColumn,
    ensureParsingRulesTable,
    parseMetadataSummary
} from './archiveSchemaService.js';

/**
 * Admin Panel için tüm Program Ayrıştırma ve Birim Kurallarını getirir.
 */
export async function getParsingRulesFromDb() {
    const rules = await ensureParsingRulesTable(true);
    return rules;
}

/**
 * Tüm arşiv kliplerini (`archive_clips`) aktif kurallara (`archive_parsing_rules`) göre yeniden değerlendirir,
 * hedef programları oluşturur/günceller, kliplerin `program_id`, `episode_no`, `unit_type`, `unit_label` ve `note` alanlarını günceller.
 * Not: Yalnızca açık bir kural (`ruleId != null`) eşleştiğinde veya klibin henüz programı yoksa `program_id` değiştirilir;
 * böylece kullanıcının manuel eklediği veya taşıdığı programlar ("İlim Dersleri- Tecvid" vb.) korunur.
 */
export async function applyParsingRulesToArchive() {
    await ensureClipMetadataColumn();
    const rules = await ensureParsingRulesTable(true);

    // Kategori isim haritası
    const catsRes = await pgQuery(`SELECT id, name FROM categories`);
    const catMap = {};
    for (const r of catsRes.rows) {
        catMap[r.id] = r.name;
    }

    // Mevcut programların is_active durumlarını koru
    const existingProgsRes = await pgQuery(`
        SELECT id, category_id as "categoryId", title, is_active as "isActive"
        FROM archive_programs
    `);
    const progIdByKey = new Map();
    const activeByTitle = new Map();
    for (const p of existingProgsRes.rows) {
        progIdByKey.set(`${p.categoryId}::${p.title}`, p.id);
        if (p.isActive) activeByTitle.set(p.title.toLocaleLowerCase('tr-TR'), true);
    }

    // Kuralda geçen tüm hedef programların archive_programs'ta var olduğundan emin ol
    for (const rule of rules) {
        const catId = parseInt(rule.categoryId, 10) || 4;
        const title = String(rule.programTitle || '').trim();
        if (!title) continue;
        const key = `${catId}::${title}`;
        if (!progIdByKey.has(key)) {
            const catName = catMap[catId] || `Kategori ${catId}`;
            const slug = title.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
            const shouldBeActive = true;
            const ins = await pgQuery(`
                INSERT INTO archive_programs (category_id, category_name, title, slug, is_active, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (category_id, title) DO UPDATE
                SET updated_at = NOW()
                RETURNING id
            `, [catId, catName, title, slug, shouldBeActive]);
            progIdByKey.set(key, ins.rows[0].id);
        }
    }

    // Tüm klipleri çek ve yeniden ayrıştır
    const clipsRes = await pgQuery(`
        SELECT 
            file_id as "fileId",
            program_id as "programId",
            category_id as "categoryId",
            name,
            file_name as "fileName",
            duration_sec as "durationSec",
            duration_formatted as "durationFormatted",
            episode_no as "episodeNo",
            part_no as "partNo",
            unit_type as "unitType",
            unit_label as "unitLabel",
            note,
            COALESCE(metadata, '[]'::jsonb) as metadata,
            COALESCE(metadata_summary, '{}'::jsonb) as "metadataSummary"
        FROM archive_clips
        WHERE category_id NOT IN (6, 11)
    `);

    const updates = [];
    const excludedFileIds = [];

    for (const row of clipsRes.rows) {
        const rawMeta = Array.isArray(row.metadata) ? row.metadata : [];
        if (isExcludedClip(row.name, row.fileName, rawMeta)) {
            excludedFileIds.push(row.fileId);
            continue;
        }
        const { summary: metaSum } = parseMetadataSummary(rawMeta);
        const parsed = parseClipWithMetadata(row.name, row.categoryId, metaSum);

        let targetProgId = row.programId;
        const targetTitle = parsed.program;
        const catId = row.categoryId;

        if ((parsed.ruleId != null || !row.programId) && targetTitle && targetTitle !== 'Genel Arşiv') {
            const key = `${catId}::${targetTitle}`;
            if (!progIdByKey.has(key)) {
                const catName = catMap[catId] || `Kategori ${catId}`;
                const slug = targetTitle.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
                const ins = await pgQuery(`
                    INSERT INTO archive_programs (category_id, category_name, title, slug, updated_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    ON CONFLICT (category_id, title) DO UPDATE
                    SET updated_at = NOW()
                    RETURNING id
                `, [catId, catName, targetTitle, slug]);
                progIdByKey.set(key, ins.rows[0].id);
            }
            targetProgId = progIdByKey.get(key);
        }

        const newEp = parsed.ruleId != null ? parsed.episode : (parsed.episode ?? row.episodeNo);
        const newPart = parsed.part ?? row.partNo;
        const newUnitType = parsed.unitType || 'bolum';
        const newUnitLabel = parsed.unitLabel || (
            newEp != null
                ? (newUnitType === 'cuz' ? `${newEp}. Cüz` : newUnitType === 'gun' ? `${newEp}. Gün` : `Bölüm ${newEp}`)
                : null
        );
        const newNote = parsed.ruleId != null ? (parsed.note || '') : (parsed.note || row.note || '');
        const newDurFmt = formatSeconds(row.durationSec);
        const newMetaSumJson = JSON.stringify(metaSum || {});
        const oldMetaSumJson = JSON.stringify(row.metadataSummary || {});

        let newMetaJson = null;
        if (parsed.ruleId != null && rawMeta.length === 0) {
            const synthMeta = [
                { keyName: 'Program Adı', val: targetTitle }
            ];
            if (newUnitType === 'cuz' && newUnitLabel) {
                synthMeta.push({ keyName: 'Bölüm Adı', val: newNote || newUnitLabel });
                if (newEp != null) synthMeta.push({ keyName: 'Bölüm Numarası', val: String(newEp) });
            } else if (newUnitType === 'gun' && newUnitLabel) {
                synthMeta.push({ keyName: 'Bölüm Adı', val: newUnitLabel });
                if (newEp != null) synthMeta.push({ keyName: 'Bölüm Numarası', val: String(newEp) });
            } else if (newUnitType === 'bolum') {
                if (newEp != null) {
                    synthMeta.push({ keyName: 'Bölüm Numarası', val: String(newEp) });
                    synthMeta.push({
                        keyName: 'Bölüm Adı',
                        val: newNote ? `${targetTitle} ${newEp}. Bölüm - ${newNote}` : `${targetTitle} ${newEp}. Bölüm`
                    });
                } else if (newNote) {
                    synthMeta.push({ keyName: 'Bölüm Adı', val: `${targetTitle} - ${newNote}` });
                }
                if (newNote) {
                    synthMeta.push({ keyName: 'Konu', val: newNote });
                }
            }
            newMetaJson = JSON.stringify(synthMeta);
        }

        if (
            targetProgId !== row.programId ||
            newEp !== row.episodeNo ||
            newPart !== row.partNo ||
            newUnitType !== (row.unitType || 'bolum') ||
            newUnitLabel !== (row.unitLabel || null) ||
            newNote !== (row.note || '') ||
            newDurFmt !== (row.durationFormatted || '') ||
            newMetaSumJson !== oldMetaSumJson ||
            newMetaJson !== null
        ) {
            updates.push({
                fileId: row.fileId,
                programId: targetProgId,
                episodeNo: newEp,
                partNo: newPart,
                unitType: newUnitType,
                unitLabel: newUnitLabel,
                note: newNote,
                durFmt: newDurFmt,
                metaSumJson: newMetaSumJson,
                metaJson: newMetaJson
            });
        }
    }

    if (excludedFileIds.length > 0) {
        await pgQuery(`DELETE FROM archive_clips WHERE file_id = ANY($1::int[])`, [excludedFileIds]);
    }

    const CHUNK = 200;
    for (let i = 0; i < updates.length; i += CHUNK) {
        const slice = updates.slice(i, i + CHUNK);
        const vals = [];
        const params = [];
        let p = 1;
        for (const u of slice) {
            vals.push(`($${p}::int, $${p+1}::int, $${p+2}::int, $${p+3}::int, $${p+4}::text, $${p+5}::text, $${p+6}::text, $${p+7}::text, $${p+8}::jsonb, $${p+9}::jsonb)`);
            params.push(u.fileId, u.programId, u.episodeNo, u.partNo, u.unitType, u.unitLabel, u.note, u.durFmt, u.metaSumJson, u.metaJson);
            p += 10;
        }
        await pgQuery(`
            UPDATE archive_clips ac
            SET program_id = v.prog_id,
                episode_no = v.ep_no,
                part_no = v.pt_no,
                unit_type = v.u_type,
                unit_label = v.u_label,
                note = v.note_txt,
                duration_formatted = v.dur_fmt,
                metadata_summary = COALESCE(v.meta_sum_json, ac.metadata_summary, '{}'::jsonb),
                metadata = COALESCE(v.meta_json, ac.metadata)
            FROM (VALUES ${vals.join(', ')}) AS v(file_id, prog_id, ep_no, pt_no, u_type, u_label, note_txt, dur_fmt, meta_sum_json, meta_json)
            WHERE ac.file_id = v.file_id
        `, params);
    }

    // Kuralda tanımlı olan ana programları aktif yap ve unit_type'ını kaydet
    for (const rule of rules) {
        if (rule.programTitle) {
            await pgQuery(`
                UPDATE archive_programs
                SET is_active = true,
                    unit_type = $2
                WHERE title = $1
            `, [rule.programTitle, rule.unitType || 'bolum']);
        }
    }

    // Yalnızca aktif olmayan ve klipsiz kalan eski/yetim programları temizle
    await pgQuery(`
        DELETE FROM archive_programs
        WHERE COALESCE(is_active, false) = false
          AND id NOT IN (SELECT DISTINCT program_id FROM archive_clips WHERE program_id IS NOT NULL)
    `);

    // Tüm programların istatistiklerini güncelle
    await pgQuery(`
        UPDATE archive_programs ap
        SET total_clips = sub.clip_count,
            total_episodes = sub.ep_count,
            total_duration_sec = sub.dur_sum,
            first_date = sub.min_date,
            last_date = sub.max_date,
            updated_at = NOW()
        FROM (
            SELECT 
                program_id,
                COUNT(*) as clip_count,
                COUNT(DISTINCT episode_no) as ep_count,
                COALESCE(SUM(duration_sec), 0) as dur_sum,
                MIN(file_create_time) as min_date,
                MAX(file_create_time) as max_date
            FROM archive_clips
            GROUP BY program_id
        ) sub
        WHERE ap.id = sub.program_id
    `);

    console.log(`[PARSING RULES APPLY] ${rules.length} kural uygulandı; ${updates.length} klibin program/bölüm/cüz/gün bilgisi güncellendi.`);
    return {
        success: true,
        rulesCount: rules.length,
        updatedClipsCount: updates.length
    };
}

/**
 * Yeni Program Ayrıştırma Kuralı ekler ve arşive uygular.
 */
export async function createParsingRule(data = {}) {
    await ensureParsingRulesTable();
    const programTitle = String(data.programTitle || '').trim();
    const categoryId = parseInt(data.categoryId, 10) || 4;
    const matchPatterns = String(data.matchPatterns || '').trim();
    const excludePatterns = String(data.excludePatterns || '').trim();
    const unitType = ['bolum', 'cuz', 'gun'].includes(data.unitType) ? data.unitType : 'bolum';
    const extractSource = ['filename', 'metadata', 'both'].includes(data.extractSource) ? data.extractSource : 'both';
    const description = String(data.description || '').trim();

    if (!programTitle) throw new Error('Program adı zorunludur.');
    if (!matchPatterns) throw new Error('En az bir eşleşme kalıbı (dosya öneki/kelime) girilmelidir.');

    const res = await pgQuery(`
        INSERT INTO archive_parsing_rules (
            program_title, category_id, match_patterns, exclude_patterns,
            unit_type, extract_source, description, is_system, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW())
        RETURNING 
            id,
            program_title as "programTitle",
            category_id as "categoryId",
            match_patterns as "matchPatterns",
            exclude_patterns as "excludePatterns",
            unit_type as "unitType",
            extract_source as "extractSource",
            description,
            is_system as "isSystem"
    `, [programTitle, categoryId, matchPatterns, excludePatterns, unitType, extractSource, description]);

    const applyResult = await applyParsingRulesToArchive();
    return {
        rule: res.rows[0],
        applyResult
    };
}

/**
 * Mevcut bir Program Ayrıştırma Kuralını günceller ve arşive uygular.
 */
export async function updateParsingRule(ruleId, data = {}) {
    await ensureParsingRulesTable();
    const id = parseInt(ruleId, 10);
    if (!id || isNaN(id)) throw new Error('Geçersiz kural ID.');

    const programTitle = String(data.programTitle || '').trim();
    const categoryId = parseInt(data.categoryId, 10) || 4;
    const matchPatterns = String(data.matchPatterns || '').trim();
    const excludePatterns = String(data.excludePatterns || '').trim();
    const unitType = ['bolum', 'cuz', 'gun'].includes(data.unitType) ? data.unitType : 'bolum';
    const extractSource = ['filename', 'metadata', 'both'].includes(data.extractSource) ? data.extractSource : 'both';
    const description = String(data.description || '').trim();

    if (!programTitle) throw new Error('Program adı zorunludur.');
    if (!matchPatterns) throw new Error('En az bir eşleşme kalıbı girilmelidir.');

    const res = await pgQuery(`
        UPDATE archive_parsing_rules
        SET program_title = $1,
            category_id = $2,
            match_patterns = $3,
            exclude_patterns = $4,
            unit_type = $5,
            extract_source = $6,
            description = $7,
            updated_at = NOW()
        WHERE id = $8
        RETURNING 
            id,
            program_title as "programTitle",
            category_id as "categoryId",
            match_patterns as "matchPatterns",
            exclude_patterns as "excludePatterns",
            unit_type as "unitType",
            extract_source as "extractSource",
            description,
            is_system as "isSystem"
    `, [programTitle, categoryId, matchPatterns, excludePatterns, unitType, extractSource, description, id]);

    if (res.rows.length === 0) throw new Error('Kural bulunamadı.');

    const applyResult = await applyParsingRulesToArchive();
    return {
        rule: res.rows[0],
        applyResult
    };
}

/**
 * Bir Program Ayrıştırma Kuralını siler ve arşivi günceller.
 */
export async function deleteParsingRule(ruleId) {
    await ensureParsingRulesTable();
    const id = parseInt(ruleId, 10);
    if (!id || isNaN(id)) throw new Error('Geçersiz kural ID.');

    const delRes = await pgQuery(`
        DELETE FROM archive_parsing_rules
        WHERE id = $1
        RETURNING id, program_title as "programTitle"
    `, [id]);

    if (delRes.rows.length === 0) throw new Error('Silinecek kural bulunamadı.');

    const applyResult = await applyParsingRulesToArchive();
    return {
        deletedRule: delRes.rows[0],
        applyResult
    };
}

