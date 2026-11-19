/**
 * @file backend/routes/archiveRoutes.js
 * @description MAM Arşiv ve Bölüm Analizi API uç noktaları (/api/archive/*).
 */
import express from 'express';
import sql from 'mssql';
import { isPostgresReady, query as pgQuery } from '../db/postgres.js';
import {
    getArchiveCategoriesStatus,
    getCategoryArchiveFromDb,
    syncCategoryArchive,
    syncAllCategoriesArchive,
    updateProgramStatus,
    bulkUpdateProgramStatus,
    bulkUpdateProgramCategory,
    getUsedProgramsList,
    searchAllArchivePrograms,
    getProgramClipsFromDb,
    searchAllArchiveClips,
    reassignClipsToProgram,
    detachClipsFromProgram,
    deleteClipsFromArchive,
    updateClipDetails,
    updateArchiveProgramDetails,
    createArchiveProgram,
    deleteArchiveProgram,
    bulkDeleteArchivePrograms,
    getOurCategoriesFromDb,
    createOurCategory,
    updateOurCategory,
    deleteOurCategory,
    syncAllClipsMetadataFromMssql,
    getAdsArchiveFromMssql,
    checkMamDatabaseConnectionAndUpdates,
    syncDeltaUpdatesFromMam,
    purgeExcludedArchiveData,
    getParsingRulesFromDb,
    createParsingRule,
    updateParsingRule,
    deleteParsingRule,
    applyParsingRulesToArchive
} from '../services/archiveAnalyzer.js';

export function createArchiveRouter(poolPromise) {
    const router = express.Router();

    // 1. Kategoriler ve senkronizasyon durumu (Varsayılan olarak hızlı yerel PostgreSQL okuma)
    router.get('/categories', async (req, res) => {
        try {
            const forceMssql = req.query.refreshMssql === 'true';
            const stats = await getArchiveCategoriesStatus(forceMssql);
            res.json({ success: true, categories: stats });
        } catch (err) {
            console.error('[API ARCHIVE CATEGORIES ERROR]:', err);
            res.status(500).json({ error: 'Kategoriler alınamadı: ' + err.message });
        }
    });

    // 1a. Bizim DB Planlama Kategorileri CRUD (Listele / Ekle / Düzenle / Sil)
    router.get('/our-categories', async (req, res) => {
        try {
            const categories = await getOurCategoriesFromDb();
            res.json({ success: true, categories });
        } catch (err) {
            console.error('[API OUR CATEGORIES GET ERROR]:', err);
            res.status(500).json({ error: 'Bizim kategoriler alınamadı: ' + err.message });
        }
    });

    router.post('/our-categories', async (req, res) => {
        try {
            const category = await createOurCategory(req.body || {});
            res.json({ success: true, category });
        } catch (err) {
            console.error('[API OUR CATEGORIES CREATE ERROR]:', err);
            res.status(400).json({ error: err.message });
        }
    });

    router.put('/our-categories/:id', async (req, res) => {
        try {
            const category = await updateOurCategory(req.params.id, req.body || {});
            res.json({ success: true, category });
        } catch (err) {
            console.error('[API OUR CATEGORIES UPDATE ERROR]:', err);
            res.status(400).json({ error: err.message });
        }
    });

    router.delete('/our-categories/:id', async (req, res) => {
        try {
            const fallbackCategoryId = req.query.fallbackCategoryId || req.body?.fallbackCategoryId || null;
            const result = await deleteOurCategory(req.params.id, fallbackCategoryId);
            res.json(result);
        } catch (err) {
            console.error('[API OUR CATEGORIES DELETE ERROR]:', err);
            res.status(400).json({ error: err.message });
        }
    });

    // 1b. TV MAM DB (MSSQL) bağlantı sağlığı ve Bizim DB ile kategori bazlı güncelleme fark kontrolü
    router.get('/mam-status', async (req, res) => {
        try {
            const status = await checkMamDatabaseConnectionAndUpdates();
            res.json(status);
        } catch (err) {
            console.error('[API ARCHIVE MAM STATUS ERROR]:', err);
            res.status(500).json({ error: 'TV MAM DB kontrol hatası: ' + err.message });
        }
    });

    // 1c. Akıllı Delta Senkronizasyon (Tüm arşivi baştan taramak yerine sadece TV MAM DB'ye yeni eklenen klipleri çeker)
    router.post('/syncDelta', async (req, res) => {
        try {
            const categoryId = req.body?.categoryId ? parseInt(req.body.categoryId, 10) : null;
            const result = await syncDeltaUpdatesFromMam(categoryId);
            res.json(result);
        } catch (err) {
            console.error('[API ARCHIVE SYNC DELTA ERROR]:', err);
            res.status(500).json({ error: 'Akıllı Delta senkronizasyon hatası: ' + err.message });
        }
    });

    // 2. Belirli bir kategorinin programları ve klipleri (Filtre: isActive=true/false/all, filterMode='our'|'mam')
    router.get('/programs', async (req, res) => {
        try {
            const categoryId = parseInt(req.query.categoryId || 1, 10);
            let isActive = null;
            if (req.query.isActive === 'true') isActive = true;
            else if (req.query.isActive === 'false') isActive = false;
            const filterMode = req.query.filterMode === 'mam' ? 'mam' : 'our';

            const data = await getCategoryArchiveFromDb(categoryId, isActive, filterMode);
            res.json(data);
        } catch (err) {
            console.error('[API ARCHIVE PROGRAMS ERROR]:', err);
            res.status(500).json({ error: 'Program arşivi alınamadı: ' + err.message });
        }
    });

    // 2b. Tüm kategorilerde kullanıma açık (aktif) programların listesi
    router.get('/used-programs', async (req, res) => {
        try {
            const programs = await getUsedProgramsList();
            res.json({ success: true, count: programs.length, programs });
        } catch (err) {
            console.error('[API ARCHIVE USED PROGRAMS ERROR]:', err);
            res.status(500).json({ error: 'Kullanılan programlar alınamadı: ' + err.message });
        }
    });

    // 2c. Tüm arşiv genelinde program arama
    router.get('/search', async (req, res) => {
        try {
            const query = req.query.q || '';
            const categoryId = req.query.categoryId ? parseInt(req.query.categoryId, 10) : null;
            const limit = req.query.limit || 'all';
            const programs = await searchAllArchivePrograms(query, categoryId, limit);
            res.json({ success: true, count: programs.length, programs });
        } catch (err) {
            console.error('[API ARCHIVE SEARCH ERROR]:', err);
            res.status(500).json({ error: 'Program arama hatası: ' + err.message });
        }
    });

    // 3. Kategoriyi MSSQL'den yeniden tara ve PostgreSQL'e senkronize et
    router.post('/syncCategory', async (req, res) => {
        try {
            const categoryId = parseInt(req.body.categoryId || 1, 10);
            const data = await syncCategoryArchive(categoryId);
            res.json(data);
        } catch (err) {
            console.error('[API ARCHIVE SYNC ERROR]:', err);
            res.status(500).json({ error: 'Senkronizasyon hatası: ' + err.message });
        }
    });

    // 4. Program başlığını, bizim kullandığımız planlama kategorisini (categoryId) veya birim tipini (unitType) güncelle
    router.put('/program/:id', async (req, res) => {
        try {
            const { id } = req.params;
            if (!isPostgresReady()) {
                return res.status(503).json({ error: 'PostgreSQL veritabanı aktif değil.' });
            }
            const updated = await updateArchiveProgramDetails(id, req.body || {});
            res.json({ success: true, program: updated });
        } catch (err) {
            console.error('[API ARCHIVE UPDATE ERROR]:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // 4a. Programın kliplerini getir
    router.get('/program/:id/clips', async (req, res) => {
        try {
            const { id } = req.params;
            const clips = await getProgramClipsFromDb(id);
            res.json({ success: true, count: clips.length, clips });
        } catch (err) {
            console.error('[API ARCHIVE CLIPS ERROR]:', err);
            res.status(500).json({ error: 'Klipler alınamadı: ' + err.message });
        }
    });

    // 4b. Programın kullanım durumunu (aktif/pasif) aç/kapat
    router.put('/program/:id/status', async (req, res) => {
        try {
            const { isActive } = req.body;
            const { id } = req.params;
            const updated = await updateProgramStatus(id, isActive);
            if (!updated) {
                return res.status(404).json({ error: 'Program bulunamadı.' });
            }
            res.json({ success: true, program: updated });
        } catch (err) {
            console.error('[API ARCHIVE TOGGLE STATUS ERROR]:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // 4c. Toplu program durumu güncelle (Birden fazla programı aktif/pasif yap)
    router.post('/programs/bulk-status', async (req, res) => {
        try {
            const { programIds, isActive } = req.body;
            if (!Array.isArray(programIds)) {
                return res.status(400).json({ error: 'programIds parametresi dizi olmalıdır.' });
            }
            const updated = await bulkUpdateProgramStatus(programIds, isActive);
            res.json({ success: true, count: updated.length, programs: updated });
        } catch (err) {
            console.error('[API ARCHIVE BULK STATUS ERROR]:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // 4d. Toplu program kategorisi güncelle (Seçili programların Bizim Kategorisini topluca değiştir)
    router.post('/programs/bulk-category', async (req, res) => {
        try {
            const { programIds, categoryId } = req.body;
            if (!Array.isArray(programIds) || !categoryId) {
                return res.status(400).json({ error: 'programIds ve categoryId zorunludur.' });
            }
            const result = await bulkUpdateProgramCategory(programIds, categoryId);
            res.json(result);
        } catch (err) {
            console.error('[API ARCHIVE BULK CATEGORY ERROR]:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // 5. Tüm 11 kategoriyi MSSQL'den PostgreSQL'e senkronize et
    router.post('/syncAll', async (req, res) => {
        try {
            const results = await syncAllCategoriesArchive();
            res.json({ success: true, results });
        } catch (err) {
            console.error('[API ARCHIVE SYNC ALL ERROR]:', err);
            res.status(500).json({ error: 'Toplu senkronizasyon hatası: ' + err.message });
        }
    });

    // 6. Arşiv genelinde (veya kategori/program bazlı) klip arama
    router.get('/clips/search', async (req, res) => {
        try {
            const { q, categoryId, programId, limit, onlyActivePrograms } = req.query;
            const clips = await searchAllArchiveClips(
                q,
                categoryId,
                programId,
                limit,
                onlyActivePrograms === 'true'
            );
            res.json({ success: true, count: clips.length, clips });
        } catch (err) {
            console.error('[API ARCHIVE CLIPS SEARCH ERROR]:', err);
            res.status(500).json({ error: 'Klip arama hatası: ' + err.message });
        }
    });

    // 7. Klipleri başka bir programa taşı veya yeni bir programa aktar
    router.post('/clips/reassign', async (req, res) => {
        try {
            const { fileIds, targetProgramId, newProgramTitle, targetCategoryId } = req.body;
            const result = await reassignClipsToProgram(fileIds, targetProgramId, newProgramTitle, targetCategoryId);
            res.json(result);
        } catch (err) {
            console.error('[API ARCHIVE CLIPS REASSIGN ERROR]:', err);
            res.status(500).json({ error: 'Klip taşıma hatası: ' + err.message });
        }
    });

    // 8. Klipleri mevcut programından çıkar (Genel Arşiv'e aktar)
    router.post('/clips/detach', async (req, res) => {
        try {
            const { fileIds, targetCategoryId } = req.body;
            const result = await detachClipsFromProgram(fileIds, targetCategoryId);
            res.json(result);
        } catch (err) {
            console.error('[API ARCHIVE CLIPS DETACH ERROR]:', err);
            res.status(500).json({ error: 'Klip çıkarma hatası: ' + err.message });
        }
    });

    // 9. Klipleri arşivden sil
    router.post('/clips/delete', async (req, res) => {
        try {
            const { fileIds } = req.body;
            const result = await deleteClipsFromArchive(fileIds);
            res.json(result);
        } catch (err) {
            console.error('[API ARCHIVE CLIPS DELETE ERROR]:', err);
            res.status(500).json({ error: 'Klip silme hatası: ' + err.message });
        }
    });

    // 10. Tekil klip bilgilerini (bölüm no, parça no, özel not, ad) güncelle
    router.put('/clip/:fileId', async (req, res) => {
        try {
            const { fileId } = req.params;
            const updated = await updateClipDetails(fileId, req.body);
            res.json({ success: true, clip: updated });
        } catch (err) {
            console.error('[API ARCHIVE CLIP UPDATE ERROR]:', err);
            res.status(500).json({ error: 'Klip güncelleme hatası: ' + err.message });
        }
    });

    // 11. Manuel yeni arşiv programı oluştur (isteğe bağlı klip ID listesi ile)
    router.post('/programs', async (req, res) => {
        try {
            const { title, categoryId, fileIds } = req.body;
            const program = await createArchiveProgram(title, categoryId, fileIds);
            res.json({ success: true, program });
        } catch (err) {
            console.error('[API ARCHIVE CREATE PROGRAM ERROR]:', err);
            res.status(500).json({ error: 'Program oluşturma hatası: ' + err.message });
        }
    });

    // 11b. Tekil programı sil (Klipler Genel Arşiv'e aktarılır veya deleteClips=true ise silinir)
    router.delete('/program/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const deleteClips = req.query.deleteClips === 'true' || Boolean(req.body?.deleteClips);
            const result = await deleteArchiveProgram(id, deleteClips);
            res.json(result);
        } catch (err) {
            console.error('[API ARCHIVE DELETE PROGRAM ERROR]:', err);
            res.status(500).json({ error: 'Program silme hatası: ' + err.message });
        }
    });

    // 11c. Çoklu programı toplu sil
    router.post('/programs/bulk-delete', async (req, res) => {
        try {
            const { programIds, deleteClips } = req.body;
            const result = await bulkDeleteArchivePrograms(programIds, Boolean(deleteClips));
            res.json(result);
        } catch (err) {
            console.error('[API ARCHIVE BULK DELETE PROGRAMS ERROR]:', err);
            res.status(500).json({ error: 'Toplu program silme hatası: ' + err.message });
        }
    });

    // 12. MSSQL FileMetadata tablosundan tüm kliplerin metadatalarını PostgreSQL'e senkronize et
    router.post('/sync-metadata', async (req, res) => {
        try {
            const result = await syncAllClipsMetadataFromMssql();
            res.json(result);
        } catch (err) {
            console.error('[API ARCHIVE SYNC METADATA ERROR]:', err);
            res.status(500).json({ error: 'Metadata senkronizasyon hatası: ' + err.message });
        }
    });

    // 13. Tekil bir klibin tüm detaylarını, kategori metadata şemasını ve veritabanı metadata bilgilerini getir
    router.get('/clip/:fileId/metadata', async (req, res) => {
        try {
            const fileId = parseInt(req.params.fileId, 10);
            if (!fileId || isNaN(fileId)) {
                return res.status(400).json({ error: 'Geçersiz klip ID.' });
            }

            let pgClip = null;
            if (isPostgresReady()) {
                const pgRes = await pgQuery(`
                    SELECT 
                        c.file_id as "fileId",
                        c.name,
                        c.file_name as "fileName",
                        c.episode_no as "episodeNo",
                        c.part_no as "partNo",
                        c.unit_type as "unitType",
                        c.unit_label as "unitLabel",
                        c.note,
                        c.duration_sec as "durationSec",
                        c.duration_formatted as "durationFormatted",
                        c.file_create_time as "fileCreateTime",
                        c.category_id as "categoryId",
                        c.program_id as "programId",
                        p.title as "programTitle",
                        cat.name as "categoryName",
                        COALESCE(c.metadata, '[]'::jsonb) as metadata
                    FROM archive_clips c
                    LEFT JOIN archive_programs p ON p.id = c.program_id
                    LEFT JOIN categories cat ON cat.id = c.category_id
                    WHERE c.file_id = $1
                    LIMIT 1
                `, [fileId]);
                pgClip = pgRes.rows[0] || null;
            }

            let mssqlFile = null;
            let metadataList = Array.isArray(pgClip?.metadata) ? pgClip.metadata : [];
            let categorySchema = [];

            const shouldQueryMssql = !pgClip || req.query.refreshMssql === 'true';

            if (shouldQueryMssql) {
                try {
                    const pool = await poolPromise;
                    if (pool) {
                        const fileRes = await pool.request()
                            .input('fileId', sql.Int, fileId)
                            .query(`
                                SELECT TOP 1
                                    f.fileId,
                                    f.name,
                                    f.fileName,
                                    f.extension,
                                    f.duration,
                                    ROUND(f.duration / 1000.0, 0) as durationSec,
                                    f.categoryId,
                                    c.categoryName,
                                    f.fileCreateTime,
                                    f.publicFileAddress,
                                    f.fileServerPath,
                                    f.trimIn,
                                    f.trimOut
                                FROM Files f
                                LEFT JOIN Categories c ON c.categoryId = f.categoryId
                                WHERE f.fileId = @fileId
                            `);
                        mssqlFile = fileRes.recordset?.[0] || null;

                        const metaRes = await pool.request()
                            .input('fileId', sql.Int, fileId)
                            .query(`
                                SELECT 
                                    mf.metadataId,
                                    mf.displayName as keyName,
                                    LTRIM(RTRIM(COALESCE(fm.stringvalue, CONVERT(varchar, fm.dateValue, 120), CAST(fm.integerValue as varchar)))) as val
                                FROM FileMetadata fm
                                JOIN MetadataFields mf ON mf.metadataId = fm.metadataId
                                WHERE fm.fileId = @fileId
                                  AND COALESCE(fm.stringvalue, CONVERT(varchar, fm.dateValue, 120), CAST(fm.integerValue as varchar)) IS NOT NULL
                                  AND LTRIM(RTRIM(COALESCE(fm.stringvalue, CONVERT(varchar, fm.dateValue, 120), CAST(fm.integerValue as varchar)))) <> ''
                                ORDER BY mf.metadataId ASC
                            `);
                        if (metaRes.recordset && metaRes.recordset.length > 0) {
                            metadataList = metaRes.recordset;
                        }

                        const catId = mssqlFile?.categoryId || pgClip?.categoryId;
                        if (catId) {
                            const schemaRes = await pool.request()
                                .input('categoryId', sql.Int, catId)
                                .query(`
                                    SELECT 
                                        mf.metadataId,
                                        mf.displayName as keyName,
                                        cm.orderBy
                                    FROM CategoryMetadata cm
                                    JOIN MetadataFields mf ON mf.metadataId = cm.metadataId
                                    WHERE cm.categoryId = @categoryId
                                    ORDER BY cm.orderBy ASC, mf.metadataId ASC
                                `);
                            categorySchema = (schemaRes.recordset || []).map(s => {
                                const found = metadataList.find(
                                    m => (m.metadataId && m.metadataId === s.metadataId) ||
                                         (m.keyName && m.keyName.toLowerCase() === s.keyName.toLowerCase())
                                );
                                return {
                                    metadataId: s.metadataId,
                                    keyName: s.keyName,
                                    val: found ? found.val : null
                                };
                            });
                        }
                    }
                } catch (mssqlErr) {
                    console.warn('[CLIP METADATA MSSQL FALLBACK]:', mssqlErr.message);
                }
            } else {
                const defaultSchemaKeys = [
                    { metadataId: 23, keyName: 'Bölüm Adı' },
                    { metadataId: 22, keyName: 'Bölüm Numarası' },
                    { metadataId: 13, keyName: 'Konu' },
                    { metadataId: 14, keyName: 'Sunucu' },
                    { metadataId: 15, keyName: 'Konuk' },
                    { metadataId: 9, keyName: 'Yönetmen' },
                    { metadataId: 25, keyName: 'Yapımcı' },
                    { metadataId: 8, keyName: 'Kurgucu' },
                    { metadataId: 24, keyName: 'Yayın Tarihi' }
                ];
                categorySchema = defaultSchemaKeys.map(s => {
                    const found = metadataList.find(
                        m => (m.keyName || m.key || '').toLowerCase() === s.keyName.toLowerCase()
                    );
                    return {
                        metadataId: s.metadataId,
                        keyName: s.keyName,
                        val: found ? (found.val ?? found.value ?? null) : null
                    };
                });
            }

            const fileDetails = {
                fileId,
                name: mssqlFile?.name || pgClip?.name || '',
                fileName: mssqlFile?.fileName || pgClip?.fileName || '',
                extension: mssqlFile?.extension || '',
                durationMs: mssqlFile?.duration || ((pgClip?.durationSec || 0) * 1000),
                durationSec: pgClip?.durationSec || mssqlFile?.durationSec || 0,
                durationFormatted: pgClip?.durationFormatted || null,
                categoryId: pgClip?.categoryId || mssqlFile?.categoryId || null,
                categoryName: pgClip?.categoryName || mssqlFile?.categoryName || '',
                programId: pgClip?.programId || null,
                programTitle: pgClip?.programTitle || null,
                episodeNo: pgClip?.episodeNo ?? null,
                partNo: pgClip?.partNo ?? null,
                unitType: pgClip?.unitType || 'bolum',
                unitLabel: pgClip?.unitLabel || null,
                note: pgClip?.note || '',
                fileCreateTime: mssqlFile?.fileCreateTime || pgClip?.fileCreateTime || null,
                publicFileAddress: mssqlFile?.publicFileAddress || '',
                fileServerPath: mssqlFile?.fileServerPath || '',
                trimIn: mssqlFile?.trimIn ?? null,
                trimOut: mssqlFile?.trimOut ?? null
            };

            res.json({
                success: true,
                fileId,
                file: fileDetails,
                metadata: metadataList,
                categorySchema
            });
        } catch (err) {
            console.error('[API ARCHIVE CLIP METADATA ERROR]:', err);
            res.status(500).json({ error: 'Klip metadata okuma hatası: ' + err.message });
        }
    });

    // 14. Yalnızca Reklam Yönetimi alanı için Kategori 6 (Reklam) verilerini getir
    router.get('/ads', async (req, res) => {
        try {
            const q = req.query.q || '';
            const data = await getAdsArchiveFromMssql(q);
            res.json(data);
        } catch (err) {
            console.error('[API ARCHIVE ADS ERROR]:', err);
            res.status(500).json({ error: 'Reklam verileri alınamadı: ' + err.message });
        }
    });

    // 15. cln/clean/kullanma/ham verilerini temizle ve metadata bölüm/konu eşleştirmesini yenile
    router.post('/purge', async (req, res) => {
        try {
            await purgeExcludedArchiveData();
            res.json({ success: true });
        } catch (err) {
            console.error('[API ARCHIVE PURGE ERROR]:', err);
            res.status(500).json({ error: 'Temizleme hatası: ' + err.message });
        }
    });

    // 16. Program Eşleştirme ve Birim (Bölüm / Cüz / Gün) Kurallarını Listele
    router.get('/rules', async (req, res) => {
        try {
            const rules = await getParsingRulesFromDb();
            res.json({ success: true, count: rules.length, rules });
        } catch (err) {
            console.error('[API ARCHIVE GET RULES ERROR]:', err);
            res.status(500).json({ error: 'Kurallar alınamadı: ' + err.message });
        }
    });

    // 17. Yeni Program Eşleştirme Kuralı Ekle ve Arşive Uygula
    router.post('/rules', async (req, res) => {
        try {
            const result = await createParsingRule(req.body);
            const rules = await getParsingRulesFromDb();
            res.json({ success: true, ...result, rules });
        } catch (err) {
            console.error('[API ARCHIVE CREATE RULE ERROR]:', err);
            res.status(400).json({ error: err.message });
        }
    });

    // 18. Mevcut Kuralı Güncelle ve Arşive Uygula
    router.put('/rules/:id', async (req, res) => {
        try {
            const result = await updateParsingRule(req.params.id, req.body);
            const rules = await getParsingRulesFromDb();
            res.json({ success: true, ...result, rules });
        } catch (err) {
            console.error('[API ARCHIVE UPDATE RULE ERROR]:', err);
            res.status(400).json({ error: err.message });
        }
    });

    // 19. Kuralı Sil ve Arşivi Güncelle
    router.delete('/rules/:id', async (req, res) => {
        try {
            const result = await deleteParsingRule(req.params.id);
            const rules = await getParsingRulesFromDb();
            res.json({ success: true, ...result, rules });
        } catch (err) {
            console.error('[API ARCHIVE DELETE RULE ERROR]:', err);
            res.status(400).json({ error: err.message });
        }
    });

    // 20. Tüm Kuralları Mevcut Arşive Yeniden Uygula
    router.post('/rules/apply', async (req, res) => {
        try {
            const applyResult = await applyParsingRulesToArchive();
            const rules = await getParsingRulesFromDb();
            res.json({ success: true, ...applyResult, rules });
        } catch (err) {
            console.error('[API ARCHIVE APPLY RULES ERROR]:', err);
            res.status(500).json({ error: 'Kurallar uygulanırken hata oluştu: ' + err.message });
        }
    });

    return router;
}

