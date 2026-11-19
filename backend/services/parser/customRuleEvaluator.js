/**
 * @file backend/services/parser/customRuleEvaluator.js
 * @description Admin Panel'de tanımlanan ve PostgreSQL `archive_parsing_rules` tablosunda tutulan
 * özel Program Eşleştirme ve Birim (Bölüm / Cüz / Gün) kurallarını değerlendiren modül.
 */
import {
    DEFAULT_PARSING_RULES,
    TURKISH_WEEKDAYS,
    toTitleCase,
    normalizeForMatch
} from './parserConstants.js';

let activeParsingRules = [...DEFAULT_PARSING_RULES];

/**
 * Hafızadaki aktif ayrıştırma kurallarını döndürür.
 */
export function getActiveParsingRules() {
    return activeParsingRules;
}

/**
 * Veritabanından okunan kuralları hafızadaki aktif kurallar listesine yükler.
 */
export function setActiveParsingRules(rules) {
    if (Array.isArray(rules) && rules.length > 0) {
        activeParsingRules = rules.map(r => ({
            id: r.id,
            programTitle: String(r.programTitle || r.program_title || '').trim(),
            categoryId: parseInt(r.categoryId || r.category_id || 4, 10),
            matchPatterns: String(r.matchPatterns ?? r.match_patterns ?? '').trim(),
            excludePatterns: String(r.excludePatterns ?? r.exclude_patterns ?? '').trim(),
            unitType: String(r.unitType || r.unit_type || 'bolum').toLowerCase(),
            extractSource: String(r.extractSource || r.extract_source || 'both').toLowerCase(),
            description: String(r.description || '').trim(),
            isSystem: Boolean(r.isSystem ?? r.is_system)
        }));
    } else {
        activeParsingRules = [...DEFAULT_PARSING_RULES];
    }
}

/**
 * Aktif Program Eşleştirme ve Birim Kurallarını (activeParsingRules) verilen klip ismi ve metadata üzerinde çalıştırır.
 * Eşleşme bulunursa { matched: true, program, episode, part, unitType, unitLabel, note, ruleId } döner.
 */
export function evaluateCustomParsingRules(rawName = '', categoryId = 4, metadataSummary = {}) {
    const cleanRaw = String(rawName || '').trim();
    if (!cleanRaw) return null;

    const catId = parseInt(categoryId, 10) || 4;
    const normName = normalizeForMatch(cleanRaw);
    const bolumAdi = String(metadataSummary?.bolumAdi || '').trim();
    const konuMeta = String(metadataSummary?.konu || '').trim();
    const bolumNoMeta = metadataSummary?.bolumNo ? parseInt(metadataSummary.bolumNo, 10) : null;

    // Parça (Part) tespiti
    let part = null;
    const pMatch = cleanRaw.match(/(?:_|^)(?:part|p|pt)[_-]?(\d+)(?:[_\s]|$)/i) ||
                   cleanRaw.match(/(?:_|^)(?:part|p)(\d+)/i);
    if (pMatch) {
        part = parseInt(pMatch[1], 10);
    }

    const isRevize = /revize/i.test(cleanRaw);

    for (const rule of activeParsingRules) {
        // Kategori kontrolü
        if (rule.categoryId && rule.categoryId > 0 && catId && rule.categoryId !== catId) {
            continue;
        }

        const patterns = String(rule.matchPatterns || '')
            .split(',')
            .map(s => normalizeForMatch(s.trim()))
            .filter(Boolean);

        if (patterns.length === 0) continue;

        const excludes = String(rule.excludePatterns || '')
            .split(',')
            .map(s => normalizeForMatch(s.trim()))
            .filter(Boolean);

        // Hariç tutulan kalıp varsa atla
        if (excludes.some(ex => normName.includes(ex))) {
            continue;
        }

        const matchedPattern = patterns.find(pat => normName.includes(pat));
        if (!matchedPattern) continue;

        const unitType = rule.unitType || 'bolum'; // 'bolum' | 'cuz' | 'gun'
        const extractSource = rule.extractSource || 'both'; // 'filename' | 'metadata' | 'both'
        let episode = null;
        let unitLabel = null;
        let note = '';

        // --- 1. BİRİM TÜRÜ: GÜN ('gun') ---
        if (unitType === 'gun') {
            const searchTarget = extractSource === 'metadata'
                ? `${bolumAdi} ${konuMeta}`
                : extractSource === 'filename'
                    ? cleanRaw
                    : `${cleanRaw} ${bolumAdi} ${konuMeta}`;

            for (const dayDef of TURKISH_WEEKDAYS) {
                if (dayDef.rx.test(searchTarget)) {
                    episode = dayDef.order;
                    unitLabel = dayDef.label;
                    note = isRevize ? `${dayDef.label} (Revize)` : dayDef.label;
                    break;
                }
            }

            if (!unitLabel) {
                const numDayMatch = searchTarget.match(/(\d{1,2})[\s_.-]*g[üu]n/i) ||
                                    searchTarget.match(/g[üu]n[\s_.-]*(\d{1,2})/i);
                if (numDayMatch) {
                    episode = parseInt(numDayMatch[1], 10);
                    unitLabel = `${episode}. Gün`;
                    note = isRevize ? `${unitLabel} (Revize)` : unitLabel;
                }
            }

            if (!note && isRevize) note = 'Revize';
            return {
                matched: true,
                program: rule.programTitle,
                episode,
                part,
                unitType: 'gun',
                unitLabel: unitLabel || 'Gün',
                note,
                ruleId: rule.id
            };
        }

        // --- 2. BİRİM TÜRÜ: CÜZ ('cuz') ---
        if (unitType === 'cuz') {
            let cuzNo = null;

            // Metadata'dan Cüz çekimi
            if (extractSource === 'metadata' || extractSource === 'both') {
                if (bolumAdi) {
                    const mCuz = bolumAdi.match(/(\d{1,2})\.\s*c[üu]z/i) || bolumAdi.match(/c[üu]z[\s_-]*(\d{1,2})/i);
                    if (mCuz) cuzNo = parseInt(mCuz[1], 10);
                }
                if (!cuzNo && bolumNoMeta && bolumNoMeta >= 1 && bolumNoMeta <= 30) {
                    cuzNo = bolumNoMeta;
                }
            }

            // Dosya isminden Cüz çekimi (veya metadata'da bulunamadıysa yedek olarak)
            if (!cuzNo && (extractSource === 'filename' || extractSource === 'both' || !bolumAdi)) {
                const idx = normName.indexOf(matchedPattern);
                const afterPrefix = idx >= 0 ? cleanRaw.slice(idx + matchedPattern.length) : cleanRaw;
                const mFileCuz = cleanRaw.match(/(\d{1,2})[\s_-]*(?:cuz|cz)\b/i) ||
                                 cleanRaw.match(/\b(?:cuz|cz)[\s_-]*(\d{1,2})/i) ||
                                 afterPrefix.match(/^[\s_-]*(\d{1,2})(?:[\s_-]|$)/);
                if (mFileCuz) {
                    const parsed = parseInt(mFileCuz[1], 10);
                    if (parsed >= 1 && parsed <= 30) cuzNo = parsed;
                }
            }

            if (cuzNo) {
                episode = cuzNo;
                unitLabel = `${cuzNo}. Cüz`;
            } else if (/dua/i.test(cleanRaw) || /dua/i.test(bolumAdi)) {
                unitLabel = 'Hatim Duası';
                note = 'Hatim Duası';
            }

            // Metadata Bölüm Adı içinde Sure/Ayet detayı varsa note alanına ekle
            if (bolumAdi) {
                const cleanedBolumAdi = bolumAdi
                    .replace(new RegExp(`^${rule.programTitle}\\s*`, 'i'), '')
                    .replace(/^Tefsiri\s+Mevakib\s*/i, '')
                    .replace(/^\d{1,2}\.\s*C[üu]z\s*/i, '')
                    .trim();
                if (cleanedBolumAdi && cuzNo) {
                    note = `${cuzNo}. Cüz • ${cleanedBolumAdi}`;
                } else if (cleanedBolumAdi) {
                    note = cleanedBolumAdi;
                } else if (cuzNo) {
                    note = `${cuzNo}. Cüz`;
                }
            } else if (cuzNo && !note) {
                note = `${cuzNo}. Cüz`;
            }

            return {
                matched: true,
                program: rule.programTitle,
                episode,
                part,
                unitType: 'cuz',
                unitLabel: unitLabel || (episode ? `${episode}. Cüz` : null),
                note,
                ruleId: rule.id
            };
        }

        // --- 3. BİRİM TÜRÜ: BÖLÜM ('bolum') ---
        let epFromMeta = null;
        if (bolumNoMeta && bolumNoMeta > 0 && bolumNoMeta < 2000) {
            epFromMeta = bolumNoMeta;
        } else if (bolumAdi) {
            const mEp = bolumAdi.match(/(\d{1,4})\.\s*B[öo]l[üu]m/i);
            if (mEp) epFromMeta = parseInt(mEp[1], 10);
        }

        let epFromFilename = null;
        const patIdx = normName.indexOf(matchedPattern);
        const remainder = patIdx >= 0 ? cleanRaw.slice(patIdx + matchedPattern.length) : cleanRaw;
        const remClean = remainder
            .replace(/_(?:201\d|202\d)(?=_|$)/g, '_')
            .replace(/_(?:\d{6}|\d{8})[a-z]*(?=_|$)/gi, '_')
            .replace(/_(?:part|p|pt)[_-]?\d+[a-z]*(?=_|$)/gi, '_');

        const mRemEp = remClean.match(/^[\s_-]*(?:bolum[\s_-]*|b)?(\d{1,4})(?:[\s_-]|$)/i) ||
                       remClean.match(/_(\d{1,3})(?:_|$)/);
        if (mRemEp) {
            const nVal = parseInt(mRemEp[1], 10);
            if (!isNaN(nVal) && nVal > 0 && nVal < 1500) {
                epFromFilename = nVal;
            }
        }

        if (extractSource === 'metadata') {
            episode = epFromMeta ?? epFromFilename;
        } else if (extractSource === 'filename') {
            episode = epFromFilename ?? epFromMeta;
        } else {
            episode = epFromMeta ?? epFromFilename;
        }

        if (episode != null) {
            unitLabel = `Bölüm ${episode}`;
        }

        // Konu / Şehir / Not bilgisi
        if (bolumAdi) {
            const konuMatch = bolumAdi.match(/Konu\s*:\s*(.+)$/i);
            if (konuMatch && konuMatch[1]) {
                note = konuMatch[1].trim();
            } else {
                note = bolumAdi;
            }
        } else if (konuMeta) {
            note = konuMeta;
        } else {
            const tokens = remClean
                .split(/[\s_-]+/)
                .filter(t => t && !/^\d+$/.test(t) && !/^\d{6,8}[a-z]*$/i.test(t) && !/^(?:yeni|yen|y|revize|rolsuz|rolsz|tam|master|mxf|mp4|p\d+|part\d+|pt\d+|bolum|b\d+)$/i.test(t));
            if (tokens.length > 0) {
                note = toTitleCase(tokens.join(' '));
            } else if (isRevize) {
                note = 'Revize';
            }
        }

        return {
            matched: true,
            program: rule.programTitle,
            episode,
            part,
            unitType: 'bolum',
            unitLabel,
            note,
            ruleId: rule.id
        };
    }

    return null;
}

