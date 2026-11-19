// ─────────────────────────────────────────────────────────────────────────────
// Arama Öncelik & Sıralama Algoritması (Search Priority Ranker)
// ─────────────────────────────────────────────────────────────────────────────
// Kullanıcı bir arama yaptığında (örn: "tecvid" veya "t"):
// 1. Öncelik (Tier 0): Tam eşleşme (örn: "tecvid")
// 2. Öncelik (Tier 1): Arama terimi ile doğrudan başlayanlar (örn: "t..." veya "tecvid...")
// 3. Öncelik (Tier 2): İçindeki kelimelerden biri arama terimi ile başlayanlar (örn: "İlim Dersleri- Tecvid")
// 4. Öncelik (Tier 3): Arama terimini kelime ortasında/sonunda içerenler
// 5. Öncelik (Tier 4): İkincil alanlarda (kategori, sunucu, konu, bölüm, not vb.) başlayan veya geçenler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Türkçe karakter duyarlı arama normalizasyonu.
 * Hem Türkçe harfleri koruyarak küçük harfe çevirir, hem de ASCII karşılığını üretir.
 */
export function normalizeSearchTurkish(text = '') {
    return String(text || '')
        .toLocaleLowerCase('tr-TR')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function normalizeSearchAscii(text = '') {
    return normalizeSearchTurkish(text)
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/i̇/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/â/g, 'a')
        .replace(/î/g, 'i')
        .replace(/û/g, 'u');
}

/**
 * Tek bir metin için arama sorgusunun eşleşme derecesini (skorunu) hesaplar.
 * Eşleşme yoksa Infinity döner. Daha düşük skor = Daha yüksek öncelik!
 *
 * @param {string} rawText - Aranacak metin (örn: program veya klip adı)
 * @param {string} rawQuery - Kullanıcının yazdığı arama kelimesi
 * @returns {number} Öncelik skoru (0..3999 arası; eşleşme yoksa Infinity)
 */
export function getTextMatchRank(rawText, rawQuery) {
    const qTr = normalizeSearchTurkish(rawQuery);
    if (!qTr) return 0;
    const qAscii = normalizeSearchAscii(rawQuery);

    const textTr = normalizeSearchTurkish(rawText);
    if (!textTr) return Infinity;
    const textAscii = normalizeSearchAscii(rawText);

    // Yardımcı değerlendirici (hem Türkçe hem ASCII normalize üzerinden en iyi skoru alır)
    const evalPair = (t, q) => {
        if (!t || !q) return Infinity;

        // Tier 0: Tam Eşleşme
        if (t === q) return 0;

        // Tier 1: Metin doğrudan arama ifadesiyle başlıyor (örn: "t" -> "tecvid...", "tecvid" -> "tecvid dersleri")
        if (t.startsWith(q)) {
            return 100 + Math.min(90, t.length - q.length);
        }

        // Kelimelere ayır
        const words = t.split(' ').filter(Boolean);

        // Tier 2: Metin içindeki kelimelerden biri arama ifadesiyle başlıyor
        // (örn: "İlim Dersleri- Tecvid" içinde 3. kelime "tecvid" ile başlıyor)
        const queryWords = q.split(' ').filter(Boolean);
        if (queryWords.length === 1) {
            const wordIdx = words.findIndex((w) => w.startsWith(q));
            if (wordIdx !== -1) {
                const exactWordBonus = words[wordIdx] === q ? 0 : 15;
                return 200 + wordIdx * 10 + exactWordBonus;
            }
        } else {
            // Çok kelimeli sorgu: ardışık kelimeler veya tüm sorgu kelimeleri kelime başlangıcı olarak eşleşiyor mu?
            for (let i = 0; i < words.length; i++) {
                const sliceStr = words.slice(i).join(' ');
                if (sliceStr.startsWith(q)) {
                    return 200 + i * 10;
                }
            }
            const allWordsPrefixMatch = queryWords.every((qw) =>
                words.some((tw) => tw.startsWith(qw))
            );
            if (allWordsPrefixMatch) {
                return 280;
            }
        }

        // Tier 3: Metin arama ifadesini içeriyor (substring)
        const incIdx = t.indexOf(q);
        if (incIdx !== -1) {
            return 300 + Math.min(90, incIdx);
        }

        // Çok kelimeli sorguda tüm kelimeler metin içinde geçiyorsa
        if (queryWords.length > 1 && queryWords.every((qw) => t.includes(qw))) {
            return 395;
        }

        return Infinity;
    };

    const trScore = evalPair(textTr, qTr);
    const asciiScore = evalPair(textAscii, qAscii);
    // Türkçe tam karakter eşleşmesi varsa hafif öncelik ver (+2 fark)
    return Math.min(trScore, asciiScore === Infinity ? Infinity : asciiScore + 2);
}

/**
 * Bir öğenin birincil (başlık/isim) ve ikincil (kategori, sunucu, konu vb.) alanlarına göre
 * toplam öncelik skorunu döner. Eşleşme yoksa Infinity döner.
 */
export function getItemSearchRank(item, query, getPrimaryText, getSecondaryTexts) {
    if (!query || !String(query).trim()) return 0;

    const primaryText = typeof getPrimaryText === 'function'
        ? getPrimaryText(item)
        : (item?.title || item?.name || '');

    const primaryRank = getTextMatchRank(primaryText, query);
    if (primaryRank < 300) {
        // Tam eşleşme, başlangıç eşleşmesi veya kelime başlangıcı eşleşmesi doğrudan kazanır
        return primaryRank;
    }

    let bestSecondaryRank = Infinity;
    if (typeof getSecondaryTexts === 'function') {
        const secList = getSecondaryTexts(item) || [];
        const arr = Array.isArray(secList) ? secList : [secList];
        for (const sec of arr) {
            if (!sec) continue;
            const r = getTextMatchRank(String(sec), query);
            if (r < bestSecondaryRank) {
                bestSecondaryRank = r;
            }
        }
    }

    if (primaryRank !== Infinity) {
        return primaryRank;
    }
    if (bestSecondaryRank !== Infinity) {
        // İkincil alan eşleşmeleri birincil alan eşleşmelerinden sonra gelir (Tier 4: 400+)
        return 400 + bestSecondaryRank;
    }

    return Infinity;
}

/**
 * Verilen listeyi arama sorgusuna göre filtreler ve öncelik algoritmasına göre sıralar:
 * 1) Tam eşleşenler
 * 2) Sorgu harfi/kelimesi ile başlayanlar (örn: "t" -> T ile başlayanlar, "tecvid" -> Tecvid ile başlayanlar)
 * 3) Herhangi bir kelimesi sorgu ile başlayanlar (örn: "İlim Dersleri - Tecvid")
 * 4) Sorguyu içerenler
 * 5) İkincil alanlarda (kategori, konu, sunucu vb.) eşleşenler
 */
export function filterAndSortBySearchPriority(
    items = [],
    query = '',
    getPrimaryText = (item) => item?.title || item?.name || '',
    getSecondaryTexts = null,
    tieBreaker = null
) {
    if (!Array.isArray(items)) return [];
    const trimmed = String(query || '').trim();
    if (!trimmed) return items;

    const scored = [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const rank = getItemSearchRank(item, trimmed, getPrimaryText, getSecondaryTexts);
        if (rank !== Infinity) {
            scored.push({ item, rank, originalIndex: i });
        }
    }

    scored.sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        if (typeof tieBreaker === 'function') {
            const cmp = tieBreaker(a.item, b.item);
            if (cmp !== 0) return cmp;
        }
        const aTitle = String(getPrimaryText(a.item) || '');
        const bTitle = String(getPrimaryText(b.item) || '');
        const alpha = aTitle.localeCompare(bTitle, 'tr-TR', { sensitivity: 'base', numeric: true });
        if (alpha !== 0) return alpha;
        return a.originalIndex - b.originalIndex;
    });

    return scored.map((entry) => entry.item);
}

