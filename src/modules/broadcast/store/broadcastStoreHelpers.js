/**
 * @file src/modules/broadcast/store/broadcastStoreHelpers.js
 * @description Yayın Planlama (Broadcast Store) için ortak sabitler ve saf (pure) yardımcı fonksiyonlar:
 * - Kanal tanımları (`BROADCAST_CHANNELS`)
 * - Reklam kuşaklarının yukarıdan aşağıya doğru otomatik 1'den başlayarak numaralandırılması (`renumberAdBreaksInList`)
 * - Ekleneceği yer (`top` / `after_selected` / `bottom` veya sayısal indeks) hesaplayıcısı (`resolveTargetInsertIndex`)
 * - Taslak kuşaklarını (İntro + Canlı Yayın / Dolgu Kuşağı / Program) yayın akışı formatına dönüştüren yardımcı (`convertDraftSlotsToRundownItems`)
 */
import {
  BROADCAST_FPS,
  timecodeToFrames,
  secondsToTimecode,
  formatFramesHuman
} from '../utils/timecodeUtils';

/**
 * Yayın Planlama modülünde desteklenen TV kanalları.
 */
export const BROADCAST_CHANNELS = [
  { id: 'ch_hd', name: 'Semerkand HD', color: '#0C617C', logo: '' },
  { id: 'ch_way', name: 'Semerkand WAY', color: '#468625', logo: '' }
];

export { formatFramesHuman };

/**
 * Listedeki reklam kuşaklarını yukarıdan aşağıya doğru sırasıyla 1'den başlayarak numaralandırır.
 * (Örn: 17. sıradaki reklam kuşağından önce 4. sıraya yeni reklam kuşağı eklendiğinde
 * 4. sıradaki "Reklam Kuşağı 1", alttaki ise otomatik olarak "Reklam Kuşağı 2" olur.)
 *
 * @param {Array} programs - Ham yayın akışı öğeleri dizisi
 * @returns {Array} Numaralandırılmış yayın akışı öğeleri dizisi
 */
export function renumberAdBreaksInList(programs = []) {
  if (!Array.isArray(programs)) return [];
  let adSeq = 0;
  return programs.map(p => {
    const cleanTitle = String(p.title || p.name || '').replace(/\s*\(Kopya\)\s*$/i, '').trim();
    const isAdBreak = p.type === 'ad_break' || /^Reklam Kuşağı(\s+\d+)?$/i.test(cleanTitle);
    if (!isAdBreak) return p;

    adSeq += 1;
    const isStandardNumberedTitle = !cleanTitle || /^Reklam Kuşağı(\s+\d+)?$/i.test(cleanTitle);
    const nextTitle = isStandardNumberedTitle ? `Reklam Kuşağı ${adSeq}` : cleanTitle;

    if (p.title === nextTitle && p.name === nextTitle && p.type === 'ad_break') {
      return p;
    }
    return {
      ...p,
      type: 'ad_break',
      title: nextTitle,
      name: nextTitle
    };
  });
}

/**
 * Yeni eklenecek öğenin mevcut listedeki hedef indeksini (`0` = En Üst, `selIdx + 1` = Seçilenin Altı, `length` = En Alt) hesaplar.
 *
 * @param {Array} currentProgs - Mevcut program listesi
 * @param {number|string} insertIndexOrMode - Sayısal hedef indeks veya konum modu ('top' | 'after_selected' | 'bottom')
 * @param {string} defaultInsertPosition - Store üzerindeki aktif yerleştirme tercihi
 * @param {string|null} selectedInstanceId - Seçili satırın instanceId değeri
 * @returns {number} Eklenecek dizi indeksi
 */
export function resolveTargetInsertIndex(
  currentProgs = [],
  insertIndexOrMode = -1,
  defaultInsertPosition = 'after_selected',
  selectedInstanceId = null
) {
  if (typeof insertIndexOrMode === 'number' && insertIndexOrMode >= 0) {
    return insertIndexOrMode;
  }

  const posMode =
    typeof insertIndexOrMode === 'string' && ['top', 'after_selected', 'bottom'].includes(insertIndexOrMode)
      ? insertIndexOrMode
      : (defaultInsertPosition || 'after_selected');

  if (posMode === 'top') {
    return 0;
  }
  if (posMode === 'bottom') {
    return currentProgs.length;
  }

  // 'after_selected': Seçili satır varsa hemen altına, yoksa listenin sonuna ekle
  const selIdx = selectedInstanceId
    ? currentProgs.findIndex(p => p.instanceId === selectedInstanceId)
    : -1;
  return selIdx !== -1 ? selIdx + 1 : currentProgs.length;
}

/**
 * Taslak Planlama modülünden gelen kuşak listesini (Excel veya Taslak Kuşakları)
 * Yayın Planlama (25 FPS) akış öğelerine dönüştürür:
 * - Dolgu Kuşağı dışındaki her programdan önce otomatik olarak 1 adet İntro klibi (`SEMERKAND_intro_v3_2014`) ekler.
 * - Canlı Yayın (`isLive`) kuşaklarını canlı yayın rozeti, sunucu/konu ve bölüm bilgisiyle oluşturur.
 * - Dolgu Kuşağı (`isKisaSlot`) satırlarını tıklanabilir yer tutucu olarak oluşturur.
 *
 * @param {Array} draftPrograms - Taslak kuşakları
 * @param {string} channelId - Kanal kimliği
 * @param {string} dateStr - Tarih (YYYY-MM-DD)
 * @returns {Array} Yayın akışı öğeleri
 */
export function convertDraftSlotsToRundownItems(
  draftPrograms = [],
  channelId = 'ch_hd',
  dateStr = '',
  introSettings = null
) {
  const converted = [];
  if (!Array.isArray(draftPrograms)) return converted;
  const shouldInsertIntro = introSettings ? introSettings.autoInsertIntro !== false : true;
  const introName = introSettings?.name || 'SEMERKAND_intro_v3_2014';
  const introFileId = introSettings?.fileId || 725;
  const introSec = introSettings?.durationSec || 26;
  const introTc = introSettings?.durationTc || secondsToTimecode(introSec);
  const introFrames = timecodeToFrames(introTc);

  draftPrograms.forEach((d, idx) => {
    const rawTitle = String(d.title || d.name || 'İsimsiz Program').trim();
    const isFiller = Boolean(d.isKisaSlot || /dolgu\s*ku[sş]a[gğ][ıi]/i.test(rawTitle));
    const isLive = Boolean(
      d.isLive ||
      (Array.isArray(d.selectedOptions) && d.selectedOptions.some(o => /canl[ıi]/i.test(String(o)))) ||
      /\bcanl[ıi]\b/i.test(`${rawTitle} ${d.rawTitle || ''} ${d.host || ''}`)
    );

    const durationMin = parseInt(d.duration, 10) || (isFiller ? 15 : 30);
    const durationSec = d.durationSec || (durationMin * 60);
    const durationTc =
      d.durationFormatted ||
      (typeof d.duration === 'string' && d.duration.includes('.') ? d.duration : secondsToTimecode(durationSec));
    const durationFrames = timecodeToFrames(durationTc);
    const draftIdVal = d.id || `draft_p_${channelId}_${dateStr}_${idx}`;

    // 1. Her programdan önce (Dolgu Kuşağı hariç ve Otomatik İntro açıksa) İntro klibi girer
    if (!isFiller && shouldInsertIntro) {
      converted.push({
        id: `intro_${introFileId}_${Date.now()}_${dateStr}_${idx}`,
        instanceId: `inst_intro_${Date.now()}_${dateStr}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
        draftId: draftIdVal,
        draftStartTime: d.startTime || null,
        type: 'clip',
        isIntroClip: true,
        title: introName,
        name: introName,
        clipName: introName,
        fileId: introFileId,
        durationTc: introTc,
        durationFrames: introFrames,
        durationSec: introSec,
        category: introSettings?.category || 'Jenerik / İntro',
        categoryColor: '#0A101D',
        episodeNo: null,
        partNo: null,
        unitType: 'intro',
        unitLabel: 'İntro',
        note: `İntro • ${rawTitle}`,
        isFromDraft: true,
        addedAt: Date.now()
      });
    }

    const liveDetail = [d.host, d.topic].filter(Boolean).join(' • ') || d.note || '';

    // 2. Program / Canlı Yayın / Dolgu Kuşağı öğesi
    converted.push({
      id: d.id || `prog_${dateStr}_${idx}`,
      instanceId: `inst_sent_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
      draftId: draftIdVal,
      draftStartTime: d.startTime || null,
      type: isFiller ? 'filler_slot' : isLive ? 'live' : (d.type || (d.clipName || d.fileId ? 'clip' : 'program')),
      isKisaSlot: isFiller,
      isLive: isLive,
      title: rawTitle,
      name: d.name || rawTitle,
      clipName: isLive
        ? `${rawTitle}${d.episode ? ` - Bölüm ${d.episode}` : ''}${liveDetail ? ` (${liveDetail})` : ''}`
        : (d.clipName || null),
      fileId: d.fileId || null,
      durationTc: durationTc,
      durationFrames: durationFrames,
      durationSec: Math.floor(durationFrames / BROADCAST_FPS),
      category: isFiller ? 'Dolgu Kuşağı' : isLive ? (d.category || 'Canlı Yayın') : (d.category || 'Genel'),
      categoryColor: isFiller ? '#109AAD' : isLive ? '#DD1C40' : (d.categoryColor || '#0C617C'),
      episodeNo: d.episode || d.episodeNo || null,
      partNo: d.part || d.partNo || null,
      unitType: d.unitType || 'bolum',
      unitLabel: d.unitLabel || (d.episode ? `Bölüm ${d.episode}` : null),
      host: d.host || '',
      topic: d.topic || '',
      note: isFiller
        ? 'Tıklayarak kısa programlar veya tüm programlar arasından klip seçin'
        : (liveDetail || d.note || (isLive ? 'Canlı Yayın' : '')),
      isFromDraft: true,
      addedAt: Date.now()
    });
  });

  return converted;
}

