/**
 * @file backend/services/archive/archiveMutationService.js
 * @description Program durumlarını (aktif/pasif) değiştirme, yeni program oluşturma,
 * program silme ve klipleri programlar arasında taşıma/düzenleme/silme (CRUD) servisleri.
 */
import { query as pgQuery } from '../../db/postgres.js';
import { recalculateProgramStats } from './archiveSchemaService.js';

/**
 * Programın kullanım durumunu (aktif / pasif) günceller.
 */
export async function updateProgramStatus(programId, isActive) {
    const id = parseInt(programId, 10);
    const active = Boolean(isActive);
    const res = await pgQuery(`
        UPDATE archive_programs
        SET is_active = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, category_id as "categoryId", category_name as "categoryName", title, is_active as "isActive"
    `, [active, id]);
    return res.rows[0];
}

/**
 * Birden fazla programın durumunu toplu günceller.
 */
export async function bulkUpdateProgramStatus(programIds, isActive) {
    if (!Array.isArray(programIds) || programIds.length === 0) return [];
    const active = Boolean(isActive);
    const res = await pgQuery(`
        UPDATE archive_programs
        SET is_active = $1, updated_at = NOW()
        WHERE id = ANY($2::int[])
        RETURNING id, category_id as "categoryId", category_name as "categoryName", title, is_active as "isActive"
    `, [active, programIds]);
    return res.rows;
}

/**
 * Seçilen klipleri başka bir programa taşır veya yeni oluşturulan bir programa aktarır.
 */
export async function reassignClipsToProgram(fileIds, targetProgramId, newProgramTitle = null, targetCategoryId = null) {
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
        throw new Error('Klip ID listesi boş olamaz.');
    }

    const ids = fileIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    if (ids.length === 0) throw new Error('Geçerli klip ID bulunamadı.');

    const currentProgsRes = await pgQuery(`
        SELECT DISTINCT program_id, category_id
        FROM archive_clips
        WHERE file_id = ANY($1::int[])
    `, [ids]);
    const sourceProgramIds = currentProgsRes.rows.map(r => r.program_id);

    let finalProgramId = targetProgramId ? parseInt(targetProgramId, 10) : null;
    let finalCategoryId = targetCategoryId ? parseInt(targetCategoryId, 10) : null;

    if (newProgramTitle && newProgramTitle.trim()) {
        const titleTrimmed = newProgramTitle.trim();
        const catId = finalCategoryId || (currentProgsRes.rows[0]?.category_id || 4);
        
        const catRes = await pgQuery('SELECT name FROM categories WHERE id = $1', [catId]);
        const categoryName = catRes.rows[0]?.name || 'Genel';
        const slug = titleTrimmed.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

        const insertProg = await pgQuery(`
            INSERT INTO archive_programs (category_id, category_name, title, slug, is_active, updated_at)
            VALUES ($1, $2, $3, $4, true, NOW())
            ON CONFLICT (category_id, title) DO UPDATE
            SET is_active = true, updated_at = NOW()
            RETURNING id, category_id as "categoryId", category_name as "categoryName", title
        `, [catId, categoryName, titleTrimmed, slug]);

        finalProgramId = insertProg.rows[0].id;
        finalCategoryId = insertProg.rows[0].categoryId;
    } else {
        const targetProgRes = await pgQuery('SELECT id, category_id as "categoryId", category_name as "categoryName", title FROM archive_programs WHERE id = $1', [finalProgramId]);
        if (targetProgRes.rows.length === 0) {
            throw new Error('Hedef program bulunamadı.');
        }
        finalCategoryId = targetProgRes.rows[0].categoryId;
    }

    await pgQuery(`
        UPDATE archive_programs
        SET is_custom_category = (category_id != COALESCE(mam_category_id, category_id))
        WHERE id = $1
    `, [finalProgramId]);

    await pgQuery(`
        UPDATE archive_clips
        SET program_id = $1, category_id = $2, is_custom_assigned = true
        WHERE file_id = ANY($3::int[])
    `, [finalProgramId, finalCategoryId, ids]);

    const allAffectedProgIds = new Set([...sourceProgramIds, finalProgramId]);
    for (const progId of allAffectedProgIds) {
        if (progId) await recalculateProgramStats(progId);
    }

    const updatedTargetRes = await pgQuery('SELECT id, category_id as "categoryId", category_name as "categoryName", title, total_clips as "totalClips", total_duration_sec as "totalDurationSec" FROM archive_programs WHERE id = $1', [finalProgramId]);

    return {
        success: true,
        reassignedCount: ids.length,
        targetProgram: updatedTargetRes.rows[0]
    };
}

/**
 * Klipleri mevcut programından çıkarır ve 'Genel Arşiv' programına aktarır.
 */
export async function detachClipsFromProgram(fileIds, targetCategoryId = null) {
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
        throw new Error('Klip ID listesi boş olamaz.');
    }
    const ids = fileIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));

    const currentRes = await pgQuery(`
        SELECT file_id, program_id, category_id
        FROM archive_clips
        WHERE file_id = ANY($1::int[])
    `, [ids]);

    const sourceProgramIds = Array.from(new Set(currentRes.rows.map(r => r.program_id)));
    const catId = targetCategoryId || currentRes.rows[0]?.category_id || 4;

    const catRes = await pgQuery('SELECT name FROM categories WHERE id = $1', [catId]);
    const categoryName = catRes.rows[0]?.name || 'Genel';
    const generalTitle = `${categoryName} (Genel / Atanmamış)`;

    const generalProgRes = await pgQuery(`
        INSERT INTO archive_programs (category_id, category_name, title, slug, is_active, updated_at)
        VALUES ($1, $2, $3, 'genel-arsiv', false, NOW())
        ON CONFLICT (category_id, title) DO UPDATE
        SET updated_at = NOW()
        RETURNING id
    `, [catId, categoryName, generalTitle]);
    const generalProgramId = generalProgRes.rows[0].id;

    await pgQuery(`
        UPDATE archive_clips
        SET program_id = $1, category_id = $2
        WHERE file_id = ANY($3::int[])
    `, [generalProgramId, catId, ids]);

    for (const pId of [...sourceProgramIds, generalProgramId]) {
        if (pId) await recalculateProgramStats(pId);
    }

    return { success: true, detachedCount: ids.length, generalProgramId };
}

/**
 * Klipleri arşivden siler.
 */
export async function deleteClipsFromArchive(fileIds) {
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
        throw new Error('Silinecek klip seçilmedi.');
    }
    const ids = fileIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));

    const progsRes = await pgQuery(`
        SELECT DISTINCT program_id FROM archive_clips WHERE file_id = ANY($1::int[])
    `, [ids]);
    const sourceProgIds = progsRes.rows.map(r => r.program_id);

    const delRes = await pgQuery(`
        DELETE FROM archive_clips WHERE file_id = ANY($1::int[]) RETURNING file_id
    `, [ids]);

    for (const pId of sourceProgIds) {
        if (pId) await recalculateProgramStats(pId);
    }

    return { success: true, deletedCount: delRes.rowCount };
}

/**
 * Tekil klip bilgilerini (bölüm no, parça no, özel not, ad, bizim kategorimiz) günceller.
 */
export async function updateClipDetails(fileId, { episodeNo, partNo, note, name, categoryId }) {
    const id = parseInt(fileId, 10);
    const ep = episodeNo !== undefined && episodeNo !== null && episodeNo !== '' ? parseInt(episodeNo, 10) : null;
    const pt = partNo !== undefined && partNo !== null && partNo !== '' ? parseInt(partNo, 10) : null;
    const n = note !== undefined ? String(note).trim() : null;
    const newCatId = categoryId !== undefined && categoryId !== null && categoryId !== '' ? parseInt(categoryId, 10) : null;

    const res = await pgQuery(`
        UPDATE archive_clips
        SET episode_no = $1, part_no = $2, note = $3,
            name = COALESCE($4, name),
            category_id = COALESCE($5, category_id),
            is_custom_assigned = CASE WHEN $5 IS NOT NULL THEN true ELSE COALESCE(is_custom_assigned, false) END
        WHERE file_id = $6
        RETURNING file_id as "fileId", name, episode_no as "episodeNo", part_no as "partNo", note,
                  program_id as "programId", category_id as "categoryId", mam_category_id as "mamCategoryId",
                  mam_category_name as "mamCategoryName", is_custom_assigned as "isCustomAssigned"
    `, [ep, pt, n, name ? String(name).trim() : null, newCatId, id]);

    if (res.rows.length === 0) throw new Error('Klip bulunamadı.');

    if (res.rows[0].programId) {
        await recalculateProgramStats(res.rows[0].programId);
    }

    return res.rows[0];
}

/**
 * Programın başlığını (title), bizim kullandığımız planlama kategorisini (categoryId)
 * veya birim tipini (unitType) günceller. TV MAM DB orijinal kategorisini (mam_category_id) korur.
 */
export async function updateArchiveProgramDetails(programId, { title, categoryId, unitType }) {
    const id = parseInt(programId, 10);
    if (!id || isNaN(id)) throw new Error('Geçersiz program ID.');

    const existingRes = await pgQuery(`
        SELECT id, title, category_id, category_name, mam_category_id, mam_category_name, mam_title, unit_type
        FROM archive_programs
        WHERE id = $1
    `, [id]);

    if (existingRes.rows.length === 0) {
        throw new Error('Program bulunamadı.');
    }

    const existing = existingRes.rows[0];
    const nextTitle = (title !== undefined && String(title).trim() !== '') ? String(title).trim() : existing.title;
    const nextCatId = (categoryId !== undefined && categoryId !== null && !isNaN(parseInt(categoryId, 10)))
        ? parseInt(categoryId, 10)
        : existing.category_id;
    const nextUnitType = unitType || existing.unit_type || 'bolum';

    const catRes = await pgQuery('SELECT name FROM categories WHERE id = $1', [nextCatId]);
    const nextCatName = catRes.rows[0]?.name || existing.category_name || 'Genel';

    // Hedef kategoride aynı isimde başka bir program var mı kontrol et (varsa klipleri birleştir)
    const duplicateRes = await pgQuery(`
        SELECT id FROM archive_programs
        WHERE category_id = $1 AND title = $2 AND id != $3
        LIMIT 1
    `, [nextCatId, nextTitle, id]);

    let finalProgramId = id;

    if (duplicateRes.rows.length > 0) {
        finalProgramId = duplicateRes.rows[0].id;
        await pgQuery(`
            UPDATE archive_clips
            SET program_id = $1, category_id = $2, is_custom_assigned = true
            WHERE program_id = $3
        `, [finalProgramId, nextCatId, id]);

        await pgQuery(`
            UPDATE archive_programs
            SET is_custom_category = true, updated_at = NOW()
            WHERE id = $1
        `, [finalProgramId]);

        await pgQuery('DELETE FROM archive_programs WHERE id = $1', [id]);
        await recalculateProgramStats(finalProgramId);
    } else {
        const mamCatId = existing.mam_category_id || existing.category_id;
        const mamTitle = existing.mam_title || existing.title;
        const isCustom = (nextCatId !== mamCatId) || (nextTitle !== mamTitle);

        await pgQuery(`
            UPDATE archive_programs
            SET title = $1,
                category_id = $2,
                category_name = $3,
                unit_type = $4,
                is_custom_category = $5,
                updated_at = NOW()
            WHERE id = $6
        `, [nextTitle, nextCatId, nextCatName, nextUnitType, isCustom, id]);

        if (nextCatId !== existing.category_id) {
            await pgQuery(`
                UPDATE archive_clips
                SET category_id = $1, is_custom_assigned = true
                WHERE program_id = $2
            `, [nextCatId, id]);
        }

        await recalculateProgramStats(id);
    }

    const updatedRes = await pgQuery(`
        SELECT
            id,
            category_id as "categoryId",
            category_name as "categoryName",
            COALESCE(mam_category_id, category_id) as "mamCategoryId",
            COALESCE(mam_category_name, category_name) as "mamCategoryName",
            COALESCE(mam_title, title) as "mamTitle",
            COALESCE(is_custom_category, false) as "isCustomCategory",
            title,
            slug,
            unit_type as "unitType",
            total_clips as "totalClips",
            episode_count as "episodeCount",
            total_duration_sec as "totalDurationSec",
            avg_duration_sec as "avgDurationSec",
            is_active as "isActive",
            updated_at as "updatedAt"
        FROM archive_programs
        WHERE id = $1
    `, [finalProgramId]);

    return updatedRes.rows[0];
}

/**
 * Manuel yeni program oluşturur (ve isteğe bağlı olarak seçilen klipleri bu programa bağlar).
 */
export async function createArchiveProgram(title, categoryId, fileIds = []) {
    const t = String(title || '').trim();
    if (!t) throw new Error('Program başlığı boş olamaz.');
    const catId = parseInt(categoryId, 10) || 4;
    if (catId === 6 || catId === 11) {
        throw new Error('Ham ve Reklam kategorilerinde program oluşturulamaz.');
    }

    const catRes = await pgQuery('SELECT name FROM categories WHERE id = $1', [catId]);
    const categoryName = catRes.rows[0]?.name || 'Genel';
    const slug = t.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

    const res = await pgQuery(`
        INSERT INTO archive_programs (category_id, category_name, title, slug, is_active, updated_at)
        VALUES ($1, $2, $3, $4, true, NOW())
        ON CONFLICT (category_id, title) DO UPDATE
        SET is_active = true, updated_at = NOW()
        RETURNING id, category_id as "categoryId", category_name as "categoryName", title, is_active as "isActive", total_clips as "totalClips", total_duration_sec as "totalDurationSec"
    `, [catId, categoryName, t, slug]);

    let program = res.rows[0];

    if (Array.isArray(fileIds) && fileIds.length > 0) {
        const reassignRes = await reassignClipsToProgram(fileIds, program.id);
        if (reassignRes?.targetProgram) {
            program = { ...program, ...reassignRes.targetProgram, isActive: true };
        }
    }

    return program;
}

/**
 * Bir programı siler.
 * Varsayılan olarak içindeki klipleri silmez, ilgili kategorinin 'Genel / Atanmamış' havuzuna aktarır.
 * Eğer deleteClips = true gönderilirse içindeki klipleri de arşivden kalıcı olarak siler.
 */
export async function deleteArchiveProgram(programId, deleteClips = false) {
    const id = parseInt(programId, 10);
    if (!id || isNaN(id)) throw new Error('Geçersiz program ID.');

    const progRes = await pgQuery(
        'SELECT id, title, category_id as "categoryId", category_name as "categoryName" FROM archive_programs WHERE id = $1',
        [id]
    );
    if (progRes.rows.length === 0) {
        throw new Error('Silinecek program bulunamadı.');
    }
    const prog = progRes.rows[0];

    const clipsRes = await pgQuery('SELECT file_id FROM archive_clips WHERE program_id = $1', [id]);
    const clipIds = clipsRes.rows.map(r => r.file_id);

    if (clipIds.length > 0) {
        if (deleteClips) {
            await pgQuery('DELETE FROM archive_clips WHERE program_id = $1', [id]);
        } else {
            const isAlreadyGeneral = prog.title.includes('(Genel / Atanmamış)');
            if (isAlreadyGeneral) {
                await pgQuery('DELETE FROM archive_clips WHERE program_id = $1', [id]);
            } else {
                await detachClipsFromProgram(clipIds, prog.categoryId);
            }
        }
    }

    await pgQuery('DELETE FROM archive_programs WHERE id = $1', [id]);

    return {
        success: true,
        deletedProgram: prog,
        affectedClipsCount: clipIds.length,
        clipsDeleted: Boolean(deleteClips)
    };
}

/**
 * Birden fazla programı toplu olarak siler.
 */
export async function bulkDeleteArchivePrograms(programIds, deleteClips = false) {
    if (!Array.isArray(programIds) || programIds.length === 0) {
        throw new Error('Silinecek program seçilmedi.');
    }
    const deleted = [];
    for (const rawId of programIds) {
        try {
            const res = await deleteArchiveProgram(rawId, deleteClips);
            if (res?.deletedProgram) deleted.push(res.deletedProgram);
        } catch (err) {
            console.warn(`[BULK DELETE PROGRAM WARN] ID ${rawId}:`, err.message);
        }
    }
    return {
        success: true,
        count: deleted.length,
        deletedPrograms: deleted
    };
}

/**
 * Birden fazla programın Bizim Kategorisini (Planlama Kategorisini) toplu olarak günceller.
 */
export async function bulkUpdateProgramCategory(programIds, targetCategoryId) {
    if (!Array.isArray(programIds) || programIds.length === 0) {
        throw new Error('Program seçilmedi.');
    }
    const nextCatId = parseInt(targetCategoryId, 10);
    if (!nextCatId || isNaN(nextCatId)) {
        throw new Error('Geçersiz hedef kategori ID.');
    }

    const updatedPrograms = [];
    for (const rawId of programIds) {
        try {
            const updated = await updateArchiveProgramDetails(rawId, { categoryId: nextCatId });
            if (updated) updatedPrograms.push(updated);
        } catch (err) {
            console.warn(`[BULK CATEGORY UPDATE WARN] ID ${rawId}:`, err.message);
        }
    }
    return {
        success: true,
        count: updatedPrograms.length,
        programs: updatedPrograms
    };
}

/**
 * Bizim DB'de tanımlı olan tüm yayın/planlama kategorilerini (program ve klip sayılarıyla) getirir.
 */
export async function getOurCategoriesFromDb() {
    const res = await pgQuery(`
        SELECT 
            c.id,
            c.id as "categoryId",
            c.name,
            c.name as "categoryName",
            COALESCE(c.color, '#3b82f6') as color,
            COALESCE(c.badge, c.name) as badge,
            COUNT(DISTINCT ap.id)::int as "programsCount",
            COUNT(DISTINCT CASE WHEN ap.is_active = true THEN ap.id END)::int as "activeProgramsCount",
            COALESCE(SUM(ap.total_clips), 0)::int as "clipsCount"
        FROM categories c
        LEFT JOIN archive_programs ap ON ap.category_id = c.id
        WHERE c.id NOT IN (6, 11)
        GROUP BY c.id, c.name, c.color, c.badge
        ORDER BY c.id ASC
    `);
    return res.rows;
}

/**
 * Bizim DB'ye yeni bir planlama kategorisi ekler.
 */
export async function createOurCategory({ name, color = '#3b82f6', badge = '' }) {
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('Kategori adı boş olamaz.');
    const cleanColor = String(color || '#3b82f6').trim();
    const cleanBadge = String(badge || cleanName).trim().slice(0, 30);

    const dupRes = await pgQuery(`SELECT id FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1`, [cleanName]);
    if (dupRes.rows.length > 0) {
        throw new Error(`"${cleanName}" adında bir kategori zaten mevcut.`);
    }

    const maxIdRes = await pgQuery(`SELECT GREATEST(COALESCE(MAX(id), 11) + 1, 12) as next_id FROM categories`);
    const nextId = parseInt(maxIdRes.rows[0]?.next_id || 12, 10);

    const insertRes = await pgQuery(`
        INSERT INTO categories (id, name, color, badge, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id, id as "categoryId", name, name as "categoryName", color, badge
    `, [nextId, cleanName, cleanColor, cleanBadge]);

    return insertRes.rows[0];
}

/**
 * Bizim DB'deki mevcut bir kategorinin adını, rengini veya kısa etiketini günceller.
 */
export async function updateOurCategory(categoryId, { name, color, badge }) {
    const id = parseInt(categoryId, 10);
    if (!id || isNaN(id)) throw new Error('Geçersiz kategori ID.');

    const existingRes = await pgQuery(`SELECT id, name, color, badge FROM categories WHERE id = $1`, [id]);
    if (existingRes.rows.length === 0) throw new Error('Kategori bulunamadı.');
    const ex = existingRes.rows[0];

    const nextName = name !== undefined && String(name).trim() !== '' ? String(name).trim() : ex.name;
    const nextColor = color !== undefined && String(color).trim() !== '' ? String(color).trim() : (ex.color || '#3b82f6');
    const nextBadge = badge !== undefined && String(badge).trim() !== '' ? String(badge).trim().slice(0, 30) : (ex.badge || nextName);

    const updateRes = await pgQuery(`
        UPDATE categories
        SET name = $1, color = $2, badge = $3
        WHERE id = $4
        RETURNING id, id as "categoryId", name, name as "categoryName", color, badge
    `, [nextName, nextColor, nextBadge, id]);

    // Bu kategoriyi kullanan programların category_name bilgisini de senkronize et
    await pgQuery(`
        UPDATE archive_programs
        SET category_name = $1, updated_at = NOW()
        WHERE category_id = $2
    `, [nextName, id]);

    return updateRes.rows[0];
}

/**
 * Bizim DB'den bir kategoriyi siler.
 * İçerisinde program veya klip varsa, veri kaybı olmaması için hedef kategoriye (veya kendi orijinal TV MAM kategorisine) aktarır.
 */
export async function deleteOurCategory(categoryId, fallbackCategoryId = null) {
    const id = parseInt(categoryId, 10);
    if (!id || isNaN(id)) throw new Error('Geçersiz kategori ID.');
    if (id === 6 || id === 11) throw new Error('Sistem kategorisi silinemez.');

    const existingRes = await pgQuery(`SELECT id, name FROM categories WHERE id = $1`, [id]);
    if (existingRes.rows.length === 0) throw new Error('Silinecek kategori bulunamadı.');

    // Hedef yedek kategoriyi belirle
    let targetCatId = fallbackCategoryId ? parseInt(fallbackCategoryId, 10) : null;
    if (!targetCatId || targetCatId === id) {
        const altRes = await pgQuery(`SELECT id FROM categories WHERE id NOT IN ($1, 6, 11) ORDER BY id ASC LIMIT 1`, [id]);
        targetCatId = altRes.rows[0]?.id;
    }

    const progsInCat = await pgQuery(`SELECT id, mam_category_id FROM archive_programs WHERE category_id = $1`, [id]);
    let movedProgramsCount = 0;

    for (const p of progsInCat.rows) {
        // Programın orijinal TV MAM kategorisi hala mevcutsa oraya, yoksa yedek kategoriye taşı
        let destCatId = targetCatId;
        if (p.mam_category_id && p.mam_category_id !== id) {
            const checkMamCat = await pgQuery(`SELECT id FROM categories WHERE id = $1`, [p.mam_category_id]);
            if (checkMamCat.rows.length > 0) {
                destCatId = p.mam_category_id;
            }
        }
        if (destCatId) {
            await updateArchiveProgramDetails(p.id, { categoryId: destCatId });
            movedProgramsCount++;
        }
    }

    await pgQuery(`DELETE FROM categories WHERE id = $1`, [id]);

    return {
        success: true,
        deletedCategory: existingRes.rows[0],
        movedProgramsCount
    };
}

