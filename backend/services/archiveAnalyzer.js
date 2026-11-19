/**
 * @file backend/services/archiveAnalyzer.js
 * @description MSSQL Libero MAM arşivini analiz eden, program başlıkları ve bölümleri altında toplayan
 * ve yerel PostgreSQL'e senkronize eden servis katmanının merkezi giriş noktası (Barrel / Facade).
 *
 * Modüler Alt Servisler:
 * - `./archive/archiveSchemaService.js`   : MSSQL konfigürasyonu, PostgreSQL tablo/indeks şeması garanti fonksiyonları,
 *                                           metadata özet ayrıştırıcısı, toplu klip kaydetme ve program istatistik hesaplama.
 * - `./archive/archiveSyncService.js`     : MSSQL -> PostgreSQL kategori/tüm arşiv senkronizasyonu, metadata eşitleme,
 *                                           hariç tutulan klip temizliği ve Reklam Yönetimi (Kategori 6) arşivi.
 * - `./archive/archiveQueryService.js`    : Yerel PostgreSQL'den hızlı kategori durumu, aktif program listesi ve Türkçe regex aramaları.
 * - `./archive/archiveMutationService.js` : Program aktif/pasif durumu, yeni program oluşturma, program silme ve klip taşıma/düzenleme.
 * - `./archive/archiveRulesService.js`    : Admin Panel ayrıştırma kuralları (CRUD ve arşive güvenli uygulama).
 */

export {
    BROADCAST_CATEGORY_IDS,
    SQL_EXCLUDE_CLIPS_FILTER,
    DEFAULT_PARSING_RULES,
    getActiveParsingRules,
    setActiveParsingRules,
    evaluateCustomParsingRules,
    isExcludedClip,
    toTitleCase,
    parseClipName,
    parseClipWithMetadata,
    parseAdClipName,
    formatSeconds
} from './archiveClipParser.js';

export {
    mssqlConfig,
    ensureParsingRulesTable,
    ensureClipMetadataColumn,
    parseMetadataSummary,
    getCategoryMetadataSchemaMap,
    batchUpsertClips,
    recalculateProgramStats,
    buildTurkishRegexPattern
} from './archive/archiveSchemaService.js';

export {
    syncCategoryArchive,
    syncAllCategoriesArchive,
    purgeExcludedArchiveData,
    syncAllClipsMetadataFromMssql,
    getAdsArchiveFromMssql,
    checkMamDatabaseConnectionAndUpdates,
    syncDeltaUpdatesFromMam
} from './archive/archiveSyncService.js';

export {
    getCategoryArchiveFromDb,
    getUsedProgramsList,
    searchAllArchivePrograms,
    getProgramClipsFromDb,
    getArchiveCategoriesStatus,
    searchAllArchiveClips
} from './archive/archiveQueryService.js';

export {
    updateProgramStatus,
    bulkUpdateProgramStatus,
    bulkUpdateProgramCategory,
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
    deleteOurCategory
} from './archive/archiveMutationService.js';

export {
    getParsingRulesFromDb,
    applyParsingRulesToArchive,
    createParsingRule,
    updateParsingRule,
    deleteParsingRule
} from './archive/archiveRulesService.js';
