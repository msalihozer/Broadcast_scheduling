/**
 * @file backend/services/archiveClipParser.js
 * @description MAM Arşiv video klip ismi ve metadata ayrıştırıcı (Parser) modülünün merkezi giriş noktası (Barrel / Facade).
 *
 * Modüler Alt Servisler:
 * - `./parser/parserConstants.js`     : Kategori sabitleri (`BROADCAST_CATEGORY_IDS`), SQL filtreleri (`SQL_EXCLUDE_CLIPS_FILTER`),
 *                                       varsayılan kurallar (`DEFAULT_PARSING_RULES`) ve yardımcı fonksiyonlar (`isExcludedClip`, `toTitleCase`, `formatSeconds`).
 * - `./parser/customRuleEvaluator.js` : Admin Panel özel ayrıştırma kurallarını değerlendiren motor (`evaluateCustomParsingRules`, `getActiveParsingRules`, `setActiveParsingRules`).
 * - `./parser/categoryClipParser.js`  : 11 kategori için klip adı, metadata ve reklam spotu ayrıştırıcıları (`parseClipName`, `parseClipWithMetadata`, `parseAdClipName`).
 */

export {
    BROADCAST_CATEGORY_IDS,
    SQL_EXCLUDE_CLIPS_FILTER,
    TURKISH_WEEKDAYS,
    DEFAULT_PARSING_RULES,
    isExcludedClip,
    toTitleCase,
    formatSeconds,
    normalizeForMatch
} from './parser/parserConstants.js';

export {
    getActiveParsingRules,
    setActiveParsingRules,
    evaluateCustomParsingRules
} from './parser/customRuleEvaluator.js';

export {
    parseClipName,
    parseClipWithMetadata,
    parseAdClipName
} from './parser/categoryClipParser.js';
