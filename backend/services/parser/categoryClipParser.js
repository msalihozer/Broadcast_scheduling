/**
 * @file backend/services/parser/categoryClipParser.js
 * @description Kategori bazlı (1: Kadın, 2: Haber, 3: Tanıtım, 4: Dini, 5: Çocuk, 6: Reklam,
 * 7: Jenerik, 8: Kültürel, 9: Detay, 10: Kısa Program, 11: Ham) klip ismi ve metadata
 * ayrıştırıcı fonksiyonları (`parseClipName`, `parseClipWithMetadata`, `parseAdClipName`).
 */
import { toTitleCase } from './parserConstants.js';
import { evaluateCustomParsingRules } from './customRuleEvaluator.js';

/**
 * Klip ismini analiz ederek Program Başlığı, Bölüm No, Parça No ve Not çıkarır.
 */
export function parseClipName(rawName, categoryId) {
    let n = (rawName || '').trim();
    const catId = parseInt(categoryId, 10);

    // Önce Admin Panel'de tanımlı özel ayrıştırma kurallarını değerlendir
    const customMatch = evaluateCustomParsingRules(n, catId, {});
    if (customMatch && customMatch.matched) {
        return {
            program: customMatch.program,
            episode: customMatch.episode,
            part: customMatch.part,
            unitType: customMatch.unitType,
            unitLabel: customMatch.unitLabel,
            note: customMatch.note
        };
    }

    let program = 'Genel Arşiv';
    let episode = null;
    let part = null;
    let note = '';
    let unitType = 'bolum';
    let unitLabel = null;

    // 1. Part Tespiti (Tüm Kategoriler İçin Ortak):
    const pMatch = n.match(/(?:_|^)(?:part|p|pt)[_-]?(\d+)(?:[_\s]|$)/i) || 
                   n.match(/(?:_|^)(?:part|p)(\d+)/i);
    if (pMatch) {
        part = parseInt(pMatch[1], 10);
    }

    // 2. Özel Notlar ve Kuşaklar (Tüm Kategoriler İçin Ortak):
    if (/mevlid/i.test(n)) note = 'Mevlid Özel';
    else if (/kandil/i.test(n)) note = 'Kandil Özel';
    else if (/ramazan|rmzn/i.test(n)) note = 'Ramazan Kuşağı';
    else if (/bayram/i.test(n)) note = 'Bayram Özel';
    else if (/canli/i.test(n)) note = 'Canlı Yayın';
    if (/revize/i.test(n)) note = note ? `${note} (Revize)` : 'Revize';

    // 3. Editör ve Arşiv Ön Eklerini Temizle:
    if (/^(?:kullanma|kullanmayin|eski_kullanma)[\s_-]*/i.test(n)) {
        note = note ? `${note} (Arşiv Notu: Kullanma)` : 'Arşiv Notu: Kullanma';
        n = n.replace(/^(?:kullanma|kullanmayin|eski_kullanma)[\s_-]*/i, '');
    }
    if (/^bozuk[\s_-]*ses[\s_-]*/i.test(n)) {
        note = note ? `${note} (Bozuk Ses)` : 'Bozuk Ses';
        n = n.replace(/^bozuk[\s_-]*ses[\s_-]*/i, '');
    }
    if (/^silme[\s_-]*/i.test(n)) {
        n = n.replace(/^silme[\s_-]*/i, '');
    }
    if (/^iptal[\s_-]*/i.test(n)) {
        note = note ? `${note} (İptal)` : 'İptal';
        n = n.replace(/^iptal[\s_-]*/i, '');
    }

    // 1. KADIN
    if (catId === 1) {
        if (n.toLowerCase().startsWith('saliha_hanimlar')) {
            program = 'Saliha Hanımlar';
            const m = n.match(/saliha_hanimlar_(\d+)(?:_(\d+))?(?:yy)?_p(\d+)/i) || n.match(/_(\d+)_/);
            if (m) episode = parseInt(m[1], 10);
            const p = n.match(/_p(\d+)/i);
            if (p) part = parseInt(p[1], 10);
        } else if (n.toLowerCase().startsWith('goz_aydinligi')) {
            program = 'Göz Aydınlığı';
            const m = n.match(/goz_aydinligi_(\d+)/i);
            if (m) episode = parseInt(m[1], 10);
        } else if (n.toLowerCase().startsWith('goznuru') || n.toLowerCase().startsWith('g_nuru')) {
            program = 'Göz Nuru';
            const m = n.match(/(?:g_nuru_|Goznuru_.*?_)(\d+)/i);
            if (m) episode = parseInt(m[1], 10);
            const p = n.match(/_p(\d+)/i);
            if (p) part = parseInt(p[1], 10);
            if (n.includes('Canta')) note = 'Çanta Yapımı';
        } else if (n.toLowerCase().startsWith('h_buyrun') || n.toLowerCase().startsWith('h_b_')) {
            program = 'Hanımlar Buyrun';
            const epMatch = n.match(/_(\d{2,3})_/);
            if (epMatch) episode = parseInt(epMatch[1], 10);
            const partMatch = n.match(/_p(\d+)/i);
            if (partMatch) part = parseInt(partMatch[1], 10);
            if (n.toUpperCase().includes('REGAİB') || n.toUpperCase().includes('REGAIB')) note = 'Regaib Kandili Özel';
            else if (n.toUpperCase().includes('BERAT')) note = 'Berat Kandili Özel';
            else if (n.toLowerCase().includes('fizik_tedavi')) {
                note = 'Fizik Tedavi Kuşağı';
                const ft = n.match(/fizik_tedavi_(\d+)/);
                if (ft) episode = parseInt(ft[1], 10);
            }
        }
        return { program, episode, part, note };
    }

    // 2. HABER
    if (catId === 2) {
        if (/^13_haber/i.test(n)) {
            program = '13 Gün Ortası Haber Bülteni';
            const m = n.match(/13_haber(\d+)/i);
            if (m) episode = parseInt(m[1], 10);
        } else if (/^19_haber/i.test(n)) {
            program = '19 Ana Haber Bülteni';
            const m = n.match(/19_haber(\d+)/i);
            if (m) episode = parseInt(m[1], 10);
        } else if (/hava/i.test(n)) {
            program = 'Hava Durumu';
        } else if (/spor/i.test(n)) {
            program = 'Spor Bülteni';
            const m = n.match(/spor(\d+)/i);
            if (m) episode = parseInt(m[1], 10);
        } else if (/para/i.test(n)) {
            program = 'Ekonomi & Finans';
        } else {
            program = 'Haber Kuşağı';
        }
        return { program, episode, part, note };
    }

    // 3. TANITIM
    if (catId === 3) {
        if (/^tnt_/i.test(n)) {
            const raw = n.replace(/^tnt_/i, '');
            if (/hayirli/i.test(raw)) program = 'Hayırlı İftarlar Tanıtımları';
            else if (/cerceve/i.test(raw)) program = 'Çerçeve Tanıtımları';
            else if (/hasbihal/i.test(raw)) program = 'Hasbihal Tanıtımları';
            else if (/sahur/i.test(raw)) program = 'Sahur Meclisi Tanıtımları';
            else if (/iftar/i.test(raw)) program = 'İftardan Önce Tanıtımları';
            else if (/kisasienbiya/i.test(raw)) program = 'Kısas-ı Enbiya Tanıtımları';
            else if (/ilim|hanefi|ahlak|akaid|tefsir|safii|yakut/i.test(raw)) program = 'İlim Dersleri Tanıtımları';
            else if (/way/i.test(raw)) program = 'Semerkand Way Tanıtımları';
            else if (/acayip/i.test(raw)) program = 'Acayip İstanbul Tanıtımları';
            else {
                const parts = raw.split('_');
                program = `${toTitleCase(parts.slice(0, 2).join(' '))} Tanıtımı`;
            }
            if (/yarin/i.test(n)) note = 'Yarın Tanıtımı';
            else if (/buaksam/i.test(n)) note = 'Bu Akşam Tanıtımı';
            else if (/persembe|cuma|carsamba/i.test(n)) note = 'Haftalık Gün Tanıtımı';
        } else if (/^vtr_/i.test(n)) {
            program = 'Tanıtım ve Kuşak VTR';
            note = n.replace(/^vtr_/i, '').replace(/_\d+$/, '').replace(/_/g, ' ');
        } else if (/afet|bilgi/i.test(n)) {
            program = 'Bilgilendirme ve Duyuru Ekranı';
        } else if (/cenaze|taziye/i.test(n)) {
            program = 'Taziye ve Vefat Duyurusu';
        } else if (/semerkand/i.test(n)) {
            program = 'Kurumsal Tanıtım ve Logo';
        } else {
            program = 'Genel Tanıtımlar';
        }
        return { program, episode, part, note };
    }

    // 4. DİNİ
    if (catId === 4) {
        let clean = n;
        if (/^(?:kullanma|kullanmayin|eski_kullanma)[\s_-]*/i.test(clean)) {
            note = note ? `${note} (Arşiv Notu: Kullanma)` : 'Arşiv Notu: Kullanma';
            clean = clean.replace(/^(?:kullanma|kullanmayin|eski_kullanma)[\s_-]*/i, '');
        }
        if (/^bozuk[\s_-]*ses[\s_-]*/i.test(clean)) {
            note = note ? `${note} (Bozuk Ses)` : 'Bozuk Ses';
            clean = clean.replace(/^bozuk[\s_-]*ses[\s_-]*/i, '');
        }
        if (/^silme[\s_-]*/i.test(clean)) {
            clean = clean.replace(/^silme[\s_-]*/i, '');
        }
        if (/^iptal[\s_-]*/i.test(clean)) {
            note = note ? `${note} (İptal)` : 'İptal';
            clean = clean.replace(/^iptal[\s_-]*/i, '');
        }

        if (!/^(?:40_hadis|40hadis)/i.test(clean)) {
            clean = clean.replace(/^\d{2,3}_/, '');
        }

        const lower = clean.toLowerCase();

        if (lower.startsWith('ilahi') || lower.startsWith('ilahii') || 
            lower.includes('_ilahi_') || lower.includes('_ilahii_') || 
            lower.includes('kaside') || lower.includes('ramazan_ilahisi')) {
            program = 'İlahiler ve Kasideler';
            note = note || toTitleCase(clean.replace(/^ilahi[i]?[\s_-]*/i, '').replace(/_/g, ' '));
        } else if (lower.startsWith('esselam') || lower.includes('naat_esselam') || lower.includes('naat_i_serif') || lower.startsWith('naat')) {
            program = 'Esselam (Naat-ı Şerifler)';
            const epM = clean.match(/(?:esselam|naat)[\s_-]*(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('mukabele') || lower.includes('_mukabele_cuz')) {
            program = 'Mukabele';
            unitType = 'cuz';
            const cuzM = clean.match(/(\d{1,2})[\s_-]?(?:cuz|cz)/i) || clean.match(/cuz[\s_-]?(\d{1,2})/i) || clean.match(/mukabele[\s_-]*(\d{1,2})/i);
            if (cuzM) {
                episode = parseInt(cuzM[1], 10);
                unitLabel = `${episode}. Cüz`;
                note = `${episode}. Cüz`;
            }
        } else if (lower.includes('hatmiserif') || lower.includes('hatmi_serif') || lower.includes('hatim_i_serif') || 
                 lower.startsWith('hatim_cuz') || lower.startsWith('hatim_duas') || lower.includes('hatim_duasi')) {
            program = 'Hatm-i Şerif';
            unitType = 'cuz';
            const cuzM = clean.match(/(\d{1,2})[\s_-]?(?:cuz|cz)/i) || clean.match(/cuz[\s_-]?(\d{1,2})/i);
            if (cuzM) {
                episode = parseInt(cuzM[1], 10);
                unitLabel = `${episode}. Cüz`;
                note = `${episode}. Cüz`;
            } else if (lower.includes('dua')) {
                unitLabel = 'Hatim Duası';
                note = 'Hatim Duası';
            }
        } else if (lower.includes('surelerin_fazileti') || lower.startsWith('surelerin_fazileti')) {
            program = 'Surelerin Fazileti';
            const epM = clean.match(/(?:surelerin_fazileti)[\s_-]+([a-zA-ZçğıöşüÇĞİÖŞÜ-]+)(?:[\s_-]+(\d{1,3}))?/i);
            if (epM) {
                const surah = epM[1].replace(/[-_]/g, ' ');
                note = toTitleCase(surah);
                if (epM[2]) episode = parseInt(epM[2], 10);
            }
        } else if (lower.includes('asr_serif') || lower.includes('asri_serif') || lower.includes('asr-i_serif') || lower.includes('asr_i') || lower.startsWith('asr_')) {
            program = 'Asr-ı Şerif';
        } else if (lower.includes('kisasureler') || lower.includes('kisa_sureler') || lower.includes('rehberkisasureler') || 
                   lower.includes('surelerin_esrari') || lower.startsWith('sureler_') || lower.includes('fetih_suresi')) {
            program = 'Kısa Sureler ve Mealleri';
            note = note || toTitleCase(clean.replace(/.*(?:sureler|esrari)[\s_-]?/i, '').replace(/_/g, ' '));
        } else if (lower.includes('dersimiz_kuran') || lower.includes('ramzan_dersimiz_kuran') || lower.includes('ramazan_dersimiz_kuran')) {
            program = 'Dersimiz Kur\'an (Ramazan)';
            const epM = clean.match(/(?:kuran)[\s_-]+(?:ramzn[\s_-]+)?(\d{1,3})/i) || clean.match(/_(\d{1,3})_/);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('kitabimiz_kuran') || lower.includes('kitabimizkuran')) {
            program = 'Kitabımız Kur\'an';
        } else if (lower.includes('kiraat_imamlarimiz')) {
            program = 'Kıraat İmamlarımız';
        } else if (lower.startsWith('40_hadis') || lower.startsWith('kirk_hadis') || lower.includes('40_hadis')) {
            program = 'Kırk Hadis';
            const epM = clean.match(/(?:40_hadis|hadis)[\s_-]+(\d{1,2})/i);
            if (epM) episode = parseInt(epM[1], 10);
            const topic = clean.replace(/.*(?:40_hadis|hadis)[\s_-]+\d{1,2}[\s_-]*/i, '').replace(/_/g, ' ');
            if (topic) note = toTitleCase(topic);
        } else if (lower.startsWith('ahlak_hadisleri') || lower.includes('ahlak_hadisler')) {
            program = 'Ahlak Hadisleri';
            const epM = clean.match(/ahlak_hadisleri_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
            const topic = clean.replace(/ahlak_hadisleri_\d{1,3}[y]?[\s_-]*/i, '').replace(/_/g, ' ');
            if (topic) note = toTitleCase(topic);
        } else if (lower.startsWith('aile_hadisleri') || lower.includes('aile_hadisler') || lower.includes('aile_hadis')) {
            program = 'Aile Hadisleri';
            const epM = clean.match(/aile_hadisleri_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
            const topic = clean.replace(/aile_hadisleri_\d{1,3}[\s_-]*/i, '').replace(/_/g, ' ');
            if (topic) note = toTitleCase(topic);
        } else if (lower.includes('ramazan_hadis') || lower.includes('ramazann_hadis') || lower.includes('ramazan_20')) {
            program = 'Ramazan Hadisleri';
            const epM = clean.match(/hadis[_-](\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('hadis_suneni_hac') || lower.includes('suneni_hac')) {
            program = 'Hadis-i Şeriflerle Hac';
            const epM = clean.match(/(\d{1,2})/);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('muharrem_hadis')) {
            program = 'Muharrem ve Aşure Özel';
            note = 'Muharrem Hadisleri';
        } else if (lower.includes('p_buyurduki') || lower.includes('peygamberimiz_buyurduki') || lower.includes('peygamberimiz_buyurdu_ki')) {
            program = 'Peygamberimiz Buyurdu ki';
        } else if (lower.includes('riyazus_salihin')) {
            program = 'Riyazüs Salihin (Hadis)';
        } else if (lower.includes('mevlid') || lower.includes('mevlit') || lower.includes('kutlu_dogum') || lower.includes('kutludogum') || lower.includes('k_dogum') || lower.includes('vesiletun_necat') || lower.startsWith('m_kandili')) {
            program = 'Mevlid-i Şerif & Mevlid Kandili';
            if (lower.includes('kurtce')) note = 'Kürtçe Mevlid';
            else if (lower.includes('arapca')) note = 'Arapça Mevlid';
            else if (lower.includes('turkce')) note = 'Türkçe Mevlid';
            else if (lower.includes('tebrik')) note = 'Mevlid Tebriği';
            else if (lower.includes('davet')) note = 'Mevlid Daveti';
        } else if (lower.includes('mirac') || lower.includes('miraç')) {
            program = 'Miraç Kandili Özel';
            if (lower.includes('tebrik')) note = 'Miraç Tebriği';
            else if (lower.includes('edirne')) note = 'Edirne Selimiye Özel';
        } else if (lower.includes('berat')) {
            program = 'Berat Kandili Özel';
            if (lower.includes('tebrik')) note = 'Berat Tebriği';
        } else if (lower.includes('regaib') || lower.includes('ragaib') || lower.includes('regaip')) {
            program = 'Regaib Kandili Özel';
            if (lower.includes('tebrik')) note = 'Regaib Tebriği';
        } else if (lower.includes('kadir_gecesi') || lower.includes('k_gec') || lower.includes('kadirgecesi') || lower.startsWith('kadir_') || lower.includes('kadir_ozel') || lower.startsWith('kadir')) {
            program = 'Kadir Gecesi Özel';
            if (lower.includes('tebrik')) note = 'Kadir Gecesi Tebriği';
        } else if (lower.includes('muharrem') || lower.includes('asure') || lower.includes('aşure')) {
            program = 'Muharrem ve Aşure Özel';
            if (lower.includes('hadis')) note = 'Aşure Hadisleri';
        } else if (lower.includes('uc_aylar') || lower.includes('ucaylar') || lower.includes('3_aylar') || 
                   lower.startsWith('recep') || lower.startsWith('receb') || lower.includes('saban') || 
                   lower.includes('sevval_orucu') || lower.includes('sevval-spot') || lower.includes('buyukler_orucu')) {
            program = 'Üç Aylar ve Mübarek Günler';
        } else if (lower.startsWith('kurban') || lower.startsWith('k_bayram') || lower.startsWith('k_b_ozel') || 
                 lower.includes('kurban_bayram') || lower.includes('kurban_ilmihali') || lower.includes('kurban_ozel') || 
                 lower.includes('k_d_bayram') || lower.includes('bayram_kurban')) {
            if (lower.includes('rehber')) {
                program = 'Kurban Rehberi';
            } else {
                program = 'Kurban ve Kurban Bayramı Özel';
                if (lower.includes('tebrik')) note = 'Kurban Bayramı Tebriği';
                else if (lower.includes('hadis')) note = 'Kurban Hadisleri';
                else if (lower.includes('ayet')) note = 'Kurban Ayetleri';
            }
        } else if (lower.includes('hac_rehberi')) {
            program = 'Hac Rehberi';
        } else if (lower.includes('hac_yolunda') || lower.includes('harameyn_yolunda') || lower.startsWith('h_yolunda')) {
            program = 'Harameyn Yolunda (Hac Yolunda)';
            const epM = clean.match(/(?:yolunda)[\s_-]*(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('hac_gunlugu') || lower.startsWith('h_gunlugu')) {
            program = 'Hac Günlüğü';
            const epM = clean.match(/(?:gunlugu)[\s_-]*(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('hac_sozlugu') || lower.includes('hicazname')) {
            program = 'Hac Sözlüğü ve Hicazname';
        } else if (lower.includes('hac_ozel') || lower.startsWith('h_ozel') || lower.includes('hac_dsf')) {
            program = 'Hac Özel Yayınları';
        } else if (lower.startsWith('kabeye_dogru')) {
            program = 'Kâbe\'ye Doğru';
        } else if (lower.startsWith('medine') || lower.startsWith('mekke') || lower.includes('kabe_ezan')) {
            program = 'Kutsal Topraklar (Mekke & Medine)';
        } else if (lower.includes('bayram_sohbetleri') || lower.includes('bayram_soh')) {
            program = 'Bayram Sohbetleri';
        } else if (lower.includes('bayram_gelince') || lower.includes('bayramola')) {
            program = 'Bayram Gelince';
        } else if (lower.includes('bayram') && (lower.includes('ramazan') || lower.includes('tebrik') || lower.includes('spot') || lower.includes('ozel') || lower.startsWith('bayrami_') || lower.includes('semerkand_way_hayirli_bayramlar'))) {
            program = 'Ramazan Bayramı Özel';
            if (lower.includes('tebrik')) note = 'Bayram Tebriği';
        } else if (lower.startsWith('ramazan_tebrik')) {
            program = 'Ramazan Bayramı Özel';
            note = 'Bayram Tebriği';
        } else if (lower.includes('semerkand_cmt_sohbetleri') || lower.includes('semerkand_sohbetleri') || 
                 lower.includes('cumartesi_sohbetleri') || lower.includes('s_sohbetleri') || lower.startsWith('s_sohbet_') || lower.startsWith('sohbet_37_')) {
            program = 'Semerkand Sohbetleri';
            const epM = clean.match(/(?:sohbetleri|sohbet|cmt_sohbetleri)[\s_-]+(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('rusca_sohbet')) {
            program = 'Rusça Sohbet';
            const epM = clean.match(/rusca_sohbet[\s_-]+(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('bosnakca')) {
            program = 'Boşnakça';
            const epM = clean.match(/bosnakca(?:_hadis)?[\s_-]+(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
            if (lower.includes('hadis')) note = 'Hadis';
        } else if (lower.startsWith('almanca_sohbet')) {
            program = 'Almanca Sohbet';
            const epM = clean.match(/almanca_sohbet[\s_-]+(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('ramazan_sohbet') || lower.includes('ramazam_sohbet')) {
            program = 'Ramazan Sohbetleri';
            const epM = clean.match(/sohbetleri[\s_-]+(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('yuzyilin_alimleri') || lower.includes('yuzyilin_allimleri')) {
            program = 'Yüzyılın Alimleri';
            const epM = clean.match(/(?:alimleri|allimleri)[\s_-]+(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('hasbihal')) {
            program = 'Hasbihal';
            const epM = clean.match(/hasbihal[\s_-]+(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('hacegan_sohbetleri') || lower.startsWith('hacegan')) {
            program = 'Hacegan Sohbetleri';
            const epM = clean.match(/hacegan[\s_-]+(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('sa_yansimalar') || lower.includes('sohbetten_yansimalar')) {
            program = 'Sohbetten Yansımalar';
        } else if (lower.includes('altin_silsile')) {
            program = 'Altın Silsile';
        } else if (lower.includes('gonul_sultanlari') || lower.startsWith('m_haci_bayram') || lower.startsWith('m_necipfazil') || lower.startsWith('mevlanahazretleri')) {
            program = 'Gönül Sultanları';
        } else if (lower.includes('menzilde_bir_sultan') || lower.includes('menzildebirsultan')) {
            program = 'Menzilde Bir Sultan';
        } else if (lower.includes('hadimul_muslimin')) {
            program = 'Hadimü\'l-Müslimin';
        } else if (lower.includes('menkibe') || lower.includes('menkibeler')) {
            program = 'Gönül Menkıbeleri';
        } else if (lower.includes('e_dilinden') || lower.includes('evliya_dilinden')) {
            program = 'Evliya Dilinden Dualar';
        } else if (lower.includes('e_gunluk') || lower.includes('evliya_gunlugu')) {
            program = 'Evliya Günlüğü';
        } else if (lower.includes('esmaul_husna') || lower.includes('esma-ul_husna') || lower.includes('esmai_husna')) {
            program = 'Esmaü\'l-Hüsna';
        } else if (lower.startsWith('mahirabi')) {
            program = 'Mahir Abi ile Sohbetler';
            const epM = clean.match(/mahirabi-(\d+)/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('dr_ahmet_cagil')) {
            program = 'Dr. Ahmet Çağıl Sohbetleri';
        } else if (lower.includes('iftardan_once') || lower.startsWith('i_once') || lower.includes('01_iftardan_once') || lower.startsWith('iftar_once')) {
            program = 'İftardan Önce';
        } else if (lower.includes('sahur_meclisi') || lower.startsWith('s_meclisi')) {
            program = 'Sahur Meclisi';
        } else if (lower.includes('hayirli_iftarlar')) {
            program = 'Hayırlı İftarlar';
        } else if (lower.includes('hayirli_sahurlar')) {
            program = 'Hayırlı Sahurlar';
        } else if (lower.includes('i_sofrasi') || lower.includes('iftar_sofrasi') || lower.startsWith('i_sofras')) {
            program = 'İftar Sofrası';
        } else if (lower.includes('c_kapisi') || lower.includes('cennet_kapisi')) {
            program = 'Cennet Kapısı';
        } else if (lower.includes('m_nebevi') || lower.includes('mescid_i_nebevi')) {
            program = 'Mescid-i Nebevi';
        } else if (lower.includes('sahur_maniler') || lower.includes('sahur_manileri')) {
            program = 'Sahur Manileri';
        } else if (lower.includes('ramazan_manileri') || lower.includes('ramazan_manisi')) {
            program = 'Ramazan Manileri';
        } else if (lower.includes('ramazanname')) {
            program = 'Ramazanname';
            if (lower.includes('karsilama')) note = 'Karşılama';
            else if (lower.includes('merhaba')) note = 'Merhaba';
            else if (lower.includes('ugurlama') || lower.includes('veda')) note = 'Uğurlama / Veda';
            const epM = clean.match(/ramazanname[\s_-]+(\d{1,2})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('ramazan_spot') || lower.includes('ramazan_duadir_spot')) {
            program = 'Ramazan Spotları';
            note = clean.replace(/ramazan_spot[\s_-]*/i, '').replace(/_/g, ' ');
        } else if (lower.includes('ramazan_hatirasi')) {
            program = 'Ramazan Hatırası';
            if (lower.includes('tuncer')) note = 'Serdar Tuncer';
            else if (lower.includes('emrah')) note = 'Emrah Yardımcı';
        } else if (lower.includes('ramazan_kisa_sozler')) {
            program = 'Ramazan Kısa Sözler';
        } else if (lower.includes('ramazan_iklimi')) {
            program = 'Ramazan İklimi';
        } else if (lower.includes('ramazan_itikaf')) {
            program = 'Ramazan İtikaf';
        } else if (lower.includes('ramazan_hacivat')) {
            program = 'Ramazan Hacivat';
        } else if (lower.includes('ramazan_geri_sayim')) {
            program = 'Ramazan Geri Sayım';
        } else if (lower.startsWith('ramazan_serif') || lower.startsWith('ramazani_serif')) {
            program = 'Ramazan-ı Şerif Kuşağı';
        } else if (lower.includes('cuma_hadis') || lower.includes('cuma_tebrik') || lower.startsWith('cuma_')) {
            program = 'Cuma Tebrik ve Hadisleri';
        } else if (lower.includes('ilmihal_ogreniyorum') || lower.includes('ilmihalogreniyorum')) {
            program = 'İlmihal Öğreniyorum';
            note = note || toTitleCase(clean.replace(/.*ogreniyorum[\s_-]?/i, '').replace(/_/g, ' '));
        } else if (lower.includes('ilmihalimiz') || lower.includes('ilmihal_hanefi') || lower.includes('ilmihal') || lower.includes('ilmhal')) {
            program = 'İlmihal Dersleri';
            if (lower.includes('hanefi')) note = 'Hanefi Fıkhı';
        } else if (lower.includes('muhtasarul_kuduri') || lower.includes('kuduri_hanefi')) {
            program = 'Muhtasarul Kuduri (Hanefi Fıkhı)';
        } else if (lower.includes('yakutun_nefis')) {
            program = 'Yakutün Nefis (Şafii Fıkhı)';
        } else if (lower.includes('fikhin_aydinliginda')) {
            program = 'Fıkhın Aydınlığında';
        } else if (lower.includes('minhacus_seni')) {
            program = 'Minhacü\'s-Seni (Tasavvuf)';
        } else if (lower.includes('safvetut_tefasir')) {
            program = 'Safvetü\'t-Tefasir (Tefsir)';
        } else if (lower.includes('taliul_busra')) {
            program = 'Taliu\'l-Büşra (Akaid)';
        } else if (lower.includes('mektubat')) {
            program = 'Mektubat-ı Rabbani';
        } else if (lower.includes('ihya') || lower.includes('imam_gazal')) {
            program = 'İhyau Ulumid-Din';
        } else if (lower.includes('mesnevi_sohbetleri') || lower.includes('mesnevi_dersleri') || /(?:^|_)m_dersler/i.test(lower) || lower.includes('mesneviden')) {
            program = 'Mesneviden Dersler';
        } else if (lower.includes('akaid_dersleri') || lower.startsWith('akaid_') || lower.includes('inanc_esas')) {
            program = 'Akaid Dersleri';
        } else if (lower.includes('delail_hayrat') || lower.includes('delailul_hayrat')) {
            program = 'Delailü\'l-Hayrat';
        } else if (lower.includes('tecvid')) {
            program = 'İlim Dersleri- Tecvid';
        } else if (lower.startsWith('i_dersleri_') || lower.startsWith('ilim_dersleri_')) {
            const branch = lower.replace(/^(?:i|ilim)_dersleri_/, '').split('_')[0];
            program = `İlim Dersleri (${toTitleCase(branch)})`;
        } else if (lower.includes('ezan') || lower.includes('tekbir') || lower.includes('iftar_vakitleri')) {
            program = 'Ezanlar ve Tekbirler';
            note = toTitleCase(clean.replace(/_/g, ' '));
        } else if (lower.startsWith('muhabbetname')) {
            program = 'Muhabbetname';
            if (lower.includes('bayram_ilahileri')) note = 'Bayram İlahileri';
            else if (lower.includes('mekke_medine')) note = 'Mekke & Medine İlahileri';
            else if (lower.includes('farkli_dil')) note = 'Farklı Dillerde';
            else if (lower.includes('bayrami')) note = 'Bayram Özel';
            const epM = clean.match(/muhabbetname[\s_-]+(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('muminlerin_bahari') || lower.startsWith('m_bahari')) {
            program = 'Müminlerin Baharı';
            if (lower.includes('hicret')) note = 'Hicret Özel';
        } else if (lower.includes('hikmetname')) {
            program = 'Hikmetname';
            const epM = clean.match(/hikmetname[\s_-]+(\d{1,2})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('nasihatler') || lower.includes('din_nasihat')) {
            program = 'Nasihatler';
            const epM = clean.match(/(?:nasihatler|nasihat)[\s_-]+(\d{1,2})/i) || clean.match(/_(\d{1,2})_/);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('divan') || lower.startsWith('divandan')) {
            if (lower.includes('divanlararasinda') || lower.includes('divanlar_arasinda')) {
                program = 'Divanlar Arasında';
            } else {
                program = 'Divan';
                if (lower.includes('arapca')) note = 'Arapça Divan';
            }
        } else if (lower.includes('sebi_arus') || lower.includes('sebi_aruz')) {
            program = 'Şeb-i Arus Özel';
        } else if (lower.includes('canakkale') || lower.includes('suheda')) {
            program = 'Çanakkale Şehitleri Özel';
        } else if (lower.includes('fetih_ozel') || lower.includes('istanbul_fethi')) {
            program = 'İstanbul\'un Fethi Özel';
        } else if (lower.includes('huvel_baki') || lower.includes('innalillahi')) {
            program = 'Taziye ve Vefat Ekranı';
        } else if (lower.includes('s_sesleri')) {
            program = 'Semerkand Sesleri';
        } else if (lower.includes('semerkandway_intro') || lower.includes('semerkand_intro') || 
                   lower.includes('semerkand_cingil') || lower.includes('demo_temsilcilik') ||
                   lower.includes('water_grup') || lower.includes('tv_3d_cold') || 
                   lower.includes('dergi_mart') || lower.includes('rtuk_') || lower.includes('rool_')) {
            program = 'Semerkand Tanıtım & Jenerikler';
        } else if (lower.includes('bi_yerde')) {
            program = 'Bir Yerde';
        } else if (lower.includes('diyanet_') || lower.includes('kamuspotu')) {
            program = 'Kamu Spotları';
        } else if (lower.includes('baska_camii')) {
            program = 'Kutsal Topraklar (Mekke & Medine)';
        } else if (lower.includes('fsm_dsf') || lower.includes('marti_dsf') || lower.includes('marti2_dsf')) {
            program = 'Ramazan Spotları';
        } else if (lower.includes('tilavet')) {
            program = 'Kısa Sureler ve Mealleri';
        } else if (lower.includes('kalbin_hast')) {
            program = 'İlim Dersleri (Ahlak)';
        } else if (lower.includes('m_secmeler')) {
            program = 'Gönül Sultanları';
        } else if (lower.includes('hanefi_arkaplan')) {
            program = 'İlmihal Dersleri';
        } else if (lower.includes('hicri_canli')) {
            program = 'Üç Aylar ve Mübarek Günler';
        } else if (lower.includes('haber') || lower.includes('bussines') || lower.includes('spor') || lower.includes('weather') || lower.includes('bbumper')) {
            program = 'Haber & Kuşak Jenerikleri';
        } else if (lower.includes('siyeri_nebi') || lower.includes('siyer_i_nebi') || lower.startsWith('siyer')) {
            program = 'Siyer-i Nebi';
        } else if (lower.includes('devri_saadet') || lower.includes('devr_i_saadet') || lower.includes('s_asri') || lower.includes('saadet_asri')) {
            program = 'Saadet Asrı (Devr-i Saadet)';
        } else if (lower.includes('kisasienbiya') || lower.includes('kisasi_enbiya')) {
            program = 'Kısas-ı Enbiya';
        } else if (lower.includes('ilmi_hayat') || lower.includes('ilm_hayat') || lower.includes('lmi_hayat')) {
            program = 'İlmi Hayat';
        } else if (lower.includes('islam_ahlaki')) {
            program = 'İslam Ahlakı';
        } else if (lower.includes('mirasimizi_koruyoruz')) {
            program = 'Mirasımızı Koruyoruz';
        } else if (lower.startsWith('cerceve')) {
            program = 'Çerçeve';
            const epM = clean.match(/s\d+b(\d+)/i) || clean.match(/_(\d{1,3})/);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('dergah')) {
            program = 'Dergah';
            const epM = clean.match(/dergah[\s_-]+(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('efendimiz')) {
            program = 'Efendimiz';
            const epM = clean.match(/efendimiz[\s_-]+(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('rahle')) {
            program = 'Rahle';
        } else if (lower.includes('drama') || lower.includes('dramalar')) {
            program = 'Dini Dramalar';
        } else if (lower.includes('s_inci') || lower.includes('sozun_incisi') || lower.includes('son_inci')) {
            program = 'Son İnci';
        } else if (lower.startsWith('kisa_soz')) {
            program = 'Kısa Sözler';
        } else if (lower.includes('i_isiginda') || lower.includes('islamin_isiginda')) {
            program = 'İslam\'ın Işığında';
        } else if (lower.includes('soz_veriyorum')) {
            program = 'Söz Veriyorum';
        } else if (lower.includes('kelimati_kudsi') || lower.includes('kelimati_kudsiyye')) {
            program = 'Kelimât-ı Kudsiyye';
        } else if (lower.includes('dervis_ceyizi')) {
            program = 'Derviş Çeyizi';
        } else if (lower.includes('dirilis_kli')) {
            program = 'Diriliş Klipleri';
        } else if (lower.includes('nebilerden_dualar')) {
            program = 'Nebilerden Dualar';
        } else if (lower.includes('aziz_istanbul')) {
            program = 'Aziz İstanbul';
        } else if (lower.includes('neseli_petek')) {
            program = 'Neşeli Petek';
        } else {
            let c = clean;
            c = c.replace(/^\d{6}_/, '');
            const leadM = c.match(/^(\d{1,3})_/);
            if (leadM) {
                episode = parseInt(leadM[1], 10);
                c = c.replace(/^\d{1,3}_/, '');
            }

            const epDateMatch = c.match(/_(\d{1,4})_(?:(?:part|p|pt)\d+_)?(?:\d{6}|\d{8}|\d{4})/i) ||
                                c.match(/_(\d{1,4})_(?:\d{6}|\d{8}|\d{4})/i) ||
                                c.match(/_bolum_(\d+)/i) || 
                                c.match(/_b(\d+)/i);
            if (epDateMatch) {
                episode = parseInt(epDateMatch[1], 10);
                c = c.replace(/_(?:bolum|b|\d{1,4})_.*$/i, '');
            }

            c = c.replace(/_(?:201[0-9]|202[0-9])(?:[_\s]|$)/g, '_')
                 .replace(/_(?:\d{6}|\d{8})(?:[_\s]|$)/g, '_')
                 .replace(/_\d{2}\.\d{2}\.\d{4}/g, '')
                 .replace(/_(?:revize|cln|master|kopya|yeni|y|tam|temiz|mxf|avi|wav)(?:[_\s]|$)/gi, '_')
                 .replace(/_(?:part|p|pt)\d+(?:[_\s]|$)/gi, '_');

            const epTrailing = c.match(/_(\d{1,3})$/);
            if (epTrailing) {
                episode = parseInt(epTrailing[1], 10);
                c = c.replace(/_\d{1,3}$/, '');
            }

            c = c.replace(/_\d{6}$/, '')
                 .replace(/_\d{8}$/, '')
                 .replace(/_\d{4}$/, '')
                 .replace(/_(?:revize|cln|master|kopya|yeni|y|tam|mxf|avi|wav)$/i, '');

            program = toTitleCase(c);
            if (!program || program.trim() === '') {
                program = 'Genel Arşiv';
            }
        }

        return { program, episode, part, note };
    }

    // 5. ÇOCUK
    if (catId === 5) {
        let clean = n;
        const lower = clean.toLowerCase();
        if (lower.includes('neseli_petek') || lower.includes('neselipetek') || lower.includes('m_petek')) {
            program = 'Neşeli Petek';
            if (lower.includes('ramazan')) note = 'Ramazan Özel';
            else if (lower.includes('yazkursu')) note = 'Yaz Kursu';
            else if (lower.includes('ilmihal')) note = 'İlmihal Yarışması';
            else if (lower.includes('siyer')) note = 'Siyer Yarışması';
            const epM = clean.match(/(?:s\d+b|_b|_s\d+_|petek_|\b)(\d{1,3})(?:_|$)/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('btv')) {
            program = 'BTV Çocuk Kuşağı';
            if (lower.includes('haftasonu')) note = 'Hafta Sonu';
            const epM = clean.match(/btv_5(?:_haftasonu)?_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('teneffus')) {
            program = 'Teneffüs';
            const epM = clean.match(/teneffus_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('c_basbasa') || lower.includes('cocuk_basbasa')) {
            program = 'Çocuk Başbaşa';
            const epM = clean.match(/(?:basbasa)_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('y_isleri') || lower.includes('yaz_isleri')) {
            program = 'Yaz İşleri';
            const epM = clean.match(/(?:isleri)_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('cocuklarin_dilinden')) {
            program = 'Çocukların Dilinden';
            const epM = clean.match(/(?:dilinden)_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('hikayeci')) {
            program = 'Hikayeci';
            const epM = clean.match(/hikayeci_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('adim_adim_kuran') || lower.includes('adimadimkuran')) {
            program = 'Adım Adım Kur\'an';
            const epM = clean.match(/kuran_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('edu_yarisma') || lower.includes('haydi_yarisalim')) {
            program = 'Haydi Yarışalım (Edu Yarışma)';
            const epM = clean.match(/(\d{1,3})/);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('guzel_dinimi') || lower.includes('dinimi_ogreniyorum')) {
            program = 'Güzel Dinimi Öğreniyorum';
            const epM = clean.match(/^(\d{1,2})[\s_-]/);
            if (epM) episode = parseInt(epM[1], 10);
            note = toTitleCase(clean.replace(/^\d{1,2}[\s_-]*/, '').replace(/.*ogreniyorum[\s_-]*/i, '').replace(/_/g, ' '));
        } else if (lower.includes('gorsel_hafiza') || lower.includes('edu_gorsel')) {
            program = 'Görsel Hafıza Eğitimi';
        } else if (lower.startsWith('c_aziz_mahmud') || lower.startsWith('c_oruc_reis') || lower.startsWith('c_s_samil')) {
            program = 'Tarihi Çizgi Filmler (Animasyon)';
            note = toTitleCase(clean.replace(/^c_/i, '').replace(/_/g, ' '));
        } else if (lower.includes('benim_guzel')) {
            program = 'Benim Güzel Dünyam';
        } else if (lower.includes('cocukklip') || lower.includes('c_film')) {
            program = 'Çocuk Klipleri ve Çizgi Filmler';
        } else {
            let c = clean.replace(/_\d{6}$/, '').replace(/_(?:p\d+|part\d+)$/i, '');
            const epM = c.match(/_(\d{1,3})$/);
            if (epM) {
                episode = parseInt(epM[1], 10);
                c = c.replace(/_\d{1,3}$/, '');
            }
            program = toTitleCase(c) || 'Çocuk Kuşağı';
        }
        return { program, episode, part, note };
    }

    // 6. REKLAM
    if (catId === 6) {
        let c = n.replace(/^r_/i, '');
        const snMatch = c.match(/_(\d+)sn/i);
        if (snMatch) note = `${snMatch[1]} sn Spot`;
        c = c.replace(/_\d+sn.*$/i, '').replace(/_\d{6}$/, '');

        if (/s-yay|semerkand_yay|semerkand_kitap/i.test(c)) {
            program = 'Semerkand Yayınları Reklamları';
            note = toTitleCase(c.replace(/.*(?:yay|kitap)[_-]?/i, '').replace(/_/g, ' '));
        } else if (/gencokur/i.test(c)) {
            program = 'Genç Okur Dergisi Reklamları';
        } else if (/mostar/i.test(c)) {
            program = 'Mostar Dergisi Reklamları';
        } else if (/sekeragaci/i.test(c)) {
            program = 'Şeker Ağacı Dergisi Reklamları';
        } else if (/mavifidan|esik-yay|esik_yay/i.test(c)) {
            program = 'Mavi Fidan & Eşik Yayınları Reklamları';
        } else if (/aile/i.test(c)) {
            program = 'Semerkand Aile Dergisi Reklamları';
        } else if (/semerkand|dergi/i.test(c)) {
            program = 'Semerkand Dergisi Reklamları';
        } else if (/besir/i.test(c)) {
            program = 'Beşir Derneği Reklamları';
        } else if (/nakis/i.test(c)) {
            program = 'Nakış Gıda Reklamları';
        } else if (/kartvizit/i.test(c)) {
            program = 'Kartvizit ve Seri İlan Kuşağı';
        } else if (/vakif|albaraka|kuveyt/i.test(c)) {
            program = 'Katılım Bankacılığı Reklamları';
        } else if (/taziye/i.test(c)) {
            program = 'Taziye ve Başsağlığı Ekranı';
        } else {
            const brand = c.split('_').slice(0, 2).join(' ');
            program = `${toTitleCase(brand)} Reklamı`;
        }
        return { program, episode, part, note };
    }

    // 7. JENERİK & SPONSORLUK
    if (catId === 7) {
        let c = n.replace(/^s_/i, '');
        if (/sunar/i.test(c)) note = 'Sunar Jeneriği';
        else if (/sundu/i.test(c)) note = 'Sundu Jeneriği';
        else if (/d-edecek|devam.*edecek/i.test(c)) note = 'Devam Edecek';
        else if (/d-ediyor|devam.*ediyor/i.test(c)) note = 'Devam Ediyor';

        c = c.replace(/_(?:SUNAR|SUNDU|D-EDECEK|D-EDIYOR).*$/i, '');

        if (/hayirli_iftarlar/i.test(c)) program = 'Hayırlı İftarlar Sponsorlukları';
        else if (/iftardan_once/i.test(c)) program = 'İftardan Önce Sponsorlukları';
        else if (/sahur/i.test(c)) program = 'Sahur Meclisi Sponsorlukları';
        else if (/saliha/i.test(c)) program = 'Saliha Hanımlar Sponsorlukları';
        else if (/kisasi_enbiya/i.test(c)) program = 'Kısas-ı Enbiya Sponsorlukları';
        else if (/hacegan/i.test(c)) program = 'Hacegan Sohbetleri Sponsorlukları';
        else if (/i-dersleri|fikhin/i.test(c)) program = 'İlim Dersleri Sponsorlukları';
        else if (/regaib|berat|mirac|mevlid|kadir|kurban|bayram/i.test(c)) program = 'Kandil ve Özel Gün Sponsorlukları';
        else if (/hac/i.test(c)) program = 'Hac Özel Sponsorlukları';
        else if (/jenerik|intro/i.test(c)) program = 'Kanal ve Kuşak Jenerikleri';
        else {
            program = `${toTitleCase(c.replace(/_/g, ' '))} Sponsorlukları`;
        }
        return { program, episode, part, note };
    }

    // 8. KÜLTÜREL
    if (catId === 8) {
        let clean = n;
        const lower = clean.toLowerCase();
        if (lower.startsWith('cerceve') || lower.includes('cerceve')) {
            program = 'Çerçeve';
            const sbMatch = clean.match(/s(\d+)b(\d+)/i);
            if (sbMatch) {
                episode = parseInt(sbMatch[2], 10);
                note = `Sezon ${parseInt(sbMatch[1], 10)}`;
            } else {
                const epM = clean.match(/_(\d{1,3})(?:_|$)/);
                if (epM) episode = parseInt(epM[1], 10);
            }
            if (lower.includes('deprem')) note = 'Deprem Özel';
        } else if (lower.startsWith('sor_bakalim') || lower.includes('sor_bakalim')) {
            program = 'Sor Bakalım';
            const epM = clean.match(/sor_bakalim_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('guzergah') || lower.includes('guzergah')) {
            program = 'Güzergah';
            const epM = clean.match(/guzergah_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('meddah') || lower.includes('meddah')) {
            program = 'Meddah';
            const epM = clean.match(/meddah_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('s_ziyade') || lower.includes('seyr_i_ziyade')) {
            program = 'Seyr-i Ziyade';
            const epM = clean.match(/ziyade_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('ramazan_sokagi')) {
            program = 'Ramazan Sokağı';
            const epM = clean.match(/sokagi_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('tarihin_izinde')) {
            program = 'Tarihin İzinde';
            const epM = clean.match(/izinde_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('vakia') || lower.includes('vakia_ysezon')) {
            program = 'Vakıa';
            const epM = clean.match(/vakia(?:_ysezon)?_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('vakanuvis')) {
            program = 'Vakanüvis';
            const epM = clean.match(/vakanuvis_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('aziz_ist') || lower.startsWith('aziz_istanbul')) {
            program = 'Aziz İstanbul';
            const epM = clean.match(/ist(?:anbul)?_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('minyatur')) {
            program = 'Minyatürlerle Tarih';
        } else if (lower.includes('5vakit') || lower.includes('bes_vakit') || lower.includes('beş_vakit')) {
            program = 'Beş Vakit Bir Şehir - Perfore';
            const epM = clean.match(/(\d{1,3})/);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('bedesten')) {
            program = 'Bedesten';
            const epM = clean.match(/bedesten_(\d{1,2})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('ulucami') || lower.includes('ulu_cami') || lower.includes('ulucamii')) {
            program = 'Ulu Cami';
            const epM = clean.match(/ulucami[i]?_(\d{1,2})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('dervis_ceyizi')) {
            program = 'Derviş Çeyizi';
            const epM = clean.match(/ceyizi_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('takvim')) {
            program = 'Takvimden Bir Yaprak';
        } else if (lower.includes('tarih_ne_soyler')) {
            program = 'Tarih Ne Söyler';
            const epM = clean.match(/soyler_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('akil_kari')) {
            program = 'Akıl Kârı';
            const epM = clean.match(/kari_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('zemin')) {
            program = 'Zemin';
            const epM = clean.match(/zemin_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('soze_dair')) {
            program = 'Söze Dair';
            const epM = clean.match(/dair_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('afiyet_olsun')) {
            program = 'Afiyet Olsun';
            const epM = clean.match(/olsun_(\d{1,3})/i);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('acayip_istanbul')) {
            program = 'Acayip İstanbul';
            const epM = clean.match(/bolum(\d+)/i) || clean.match(/_(\d{1,3})_/);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('kaside') || lower.includes('kasideler')) {
            program = 'Kasideler ve İlahiler';
            const epM = clean.match(/(\d{1,3})[\s_-]*kaside/i);
            if (epM) episode = parseInt(epM[1], 10);
            note = toTitleCase(clean.replace(/.*kaside[_-]?/i, '').replace(/_/g, ' '));
        } else {
            let c = clean;
            const epDateMatch = c.match(/_(\d{1,4})_(?:(?:part|p|pt)\d+_)?(?:\d{6}|\d{8}|\d{4})/i) ||
                                c.match(/_bolum_(\d+)/i) || c.match(/_b(\d+)/i);
            if (epDateMatch) {
                episode = parseInt(epDateMatch[1], 10);
                c = c.replace(/_(?:bolum|b|\d{1,4})_.*$/i, '');
            }
            c = c.replace(/_(?:201[0-9]|202[0-9])(?:[_\s]|$)/g, '_')
                 .replace(/_(?:\d{6}|\d{8})(?:[_\s]|$)/g, '_')
                 .replace(/_\d{2}\.\d{2}\.\d{4}/g, '')
                 .replace(/_(?:revize|cln|master|kopya|yeni|y|tam|mxf)(?:[_\s]|$)/gi, '_')
                 .replace(/_(?:part|p|pt)\d+(?:[_\s]|$)/gi, '_');

            const epTrailing = c.match(/_(\d{1,3})$/);
            if (epTrailing) {
                episode = parseInt(epTrailing[1], 10);
                c = c.replace(/_\d{1,3}$/, '');
            }
            program = toTitleCase(c) || 'Kültürel Programlar';
        }
        return { program, episode, part, note };
    }

    // 9. DETAY
    if (catId === 9) {
        let clean = n;
        const lower = clean.toLowerCase();
        if (lower.includes('s_sesleri')) {
            program = 'Semerkand Sesleri';
            note = toTitleCase(clean.replace(/.*sesleri[_-]?/i, '').replace(/_/g, ' '));
        } else if (lower.includes('emsey')) {
            program = 'Sağlık ve Hastane Çekimleri (Emsey)';
        } else if (lower.includes('dsf')) {
            program = 'Semerkand Görsel Arşiv (DSF)';
            note = toTitleCase(clean.replace(/.*dsf[_-]?/i, '').replace(/_/g, ' '));
        } else if (lower.includes('kamera_aktuel') || lower.includes('aktuel')) {
            program = 'Kamera Aktüel Çekimleri';
        } else if (lower.includes('vapur') || lower.includes('sok')) {
            program = 'Şehir ve Doğa Manzaraları';
        } else {
            program = 'Tematik B-Roll ve Görsel Arşiv';
        }
        return { program, episode, part, note };
    }

    // 10. KISA PROGRAM
    if (catId === 10) {
        let clean = n;

        if (/^(?:kullanma|kullanmayin|eski_kullanma)[\s_-]*/i.test(clean)) {
            note = 'Arşiv Notu: Kullanma';
            clean = clean.replace(/^(?:kullanma|kullanmayin|eski_kullanma)[\s_-]*/i, '');
        }
        if (/^hatali[\s_-]*/i.test(clean)) {
            note = note ? `${note} (Hatalı)` : 'Hatalı';
            clean = clean.replace(/^hatali[\s_-]*/i, '');
        }
        if (/^yenisini_koy[\s_-]*/i.test(clean)) clean = clean.replace(/^yenisini_koy[\s_-]*/i, '');
        if (/^azkullan[\s_-]*/i.test(clean)) clean = clean.replace(/^azkullan[\s_-]*/i, '');
        if (/^grafik_hatası[\s_-]*/i.test(clean)) clean = clean.replace(/^grafik_hatası[\s_-]*/i, '');

        const lower = clean.toLowerCase();

        if (lower.includes('iftar_gun') || lower.includes('imsak_gun') || lower.includes('way_iftar') || lower.includes('way_imsak') || lower.startsWith('tnt_hayirli_iftarlar')) {
            program = 'İftar ve İmsak Vakitleri Kuşağı';
            const gunM = clean.match(/gun_(\d+)/i) || clean.match(/iftarlar_(\d+)/i);
            if (gunM) episode = parseInt(gunM[1], 10);
            if (lower.includes('iftar')) note = note || 'İftar Vakti';
            else if (lower.includes('imsak')) note = note || 'İmsak Vakti';
        } else if (lower.includes('hicri_aylar') || lower.startsWith('hicri')) {
            program = 'Hicri Aylar Kuşağı';
            const epM = clean.match(/bolum_(\d+)/i) || clean.match(/_(\d+)(?:_|$)/);
            if (epM) episode = parseInt(epM[1], 10);
            if (lower.includes('ramazan')) note = note || 'Ramazan';
            else if (lower.includes('sevval')) note = note || 'Şevval';
            else if (lower.includes('muharrem')) note = note || 'Muharrem';
            else if (lower.includes('recep')) note = note || 'Recep';
            else if (lower.includes('saban')) note = note || 'Şaban';
        } else if (lower.includes('lugat') || lower.startsWith('kelimeler')) {
            program = 'Lügat (Kelime ve Kavramlar)';
            const epM = clean.match(/_(\d{1,3})(?:_|$)/);
            if (epM) episode = parseInt(epM[1], 10);
            const subWord = clean.replace(/.*(?:lugat|kelimeler)[_-]?/i, '').replace(/_\d+.*$/, '').replace(/_/g, ' ');
            if (subWord.trim()) note = note || toTitleCase(subWord);
        } else if (lower.includes('ahlak_hadis') || lower.includes('ahlak hadis')) {
            program = 'Ahlak Hadisleri (Kısa)';
            const epM = clean.match(/(?:hadisleri|hadis|hadisleri_)[\s_-]*(\d{1,3})/i) || clean.match(/_(\d{1,3})(?:_|$)/);
            if (epM) episode = parseInt(epM[1], 10);
            const sub = clean.replace(/.*(?:hadisleri|hadis)[\s_-]*\d*[\s_-]*/i, '').replace(/_/g, ' ');
            if (sub.trim()) note = note || toTitleCase(sub);
        } else if (lower.includes('aile_hadis') || lower.includes('aile hadis')) {
            program = 'Aile Hadisleri (Kısa)';
            const epM = clean.match(/(?:hadisleri|hadis)[\s_-]*(\d{1,3})/i) || clean.match(/_(\d{1,3})(?:_|$)/);
            if (epM) episode = parseInt(epM[1], 10);
            const sub = clean.replace(/.*(?:hadisleri|hadis)[\s_-]*\d*[\s_-]*/i, '').replace(/_/g, ' ');
            if (sub.trim()) note = note || toTitleCase(sub);
        } else if (lower.includes('minhacus_seni') || lower.includes('minhac')) {
            program = 'Minhacü\'s-Seni (Kısa Kuşak)';
            const epM = clean.match(/seni_(\d+)/i) || clean.match(/_(\d{1,3})(?:_|$)/);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('suleymaniye') || lower.includes('eyupflycam') || lower.includes('ayasofya') || lower.includes('cami_duasi') || lower.includes('cami_cekim')) {
            program = 'Süleymaniye ve Cami Çekimleri';
            note = note || toTitleCase(clean.replace(/_/g, ' '));
        } else if (lower.includes('salavati_serifeler') || lower.includes('salavat')) {
            program = 'Salavat-ı Şerifeler';
            const epM = clean.match(/_(\d{1,3})(?:_|$)/);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('sehirler')) {
            program = 'Şehirler ve Medeniyetler';
            const epM = clean.match(/_(\d{1,3})(?:_|$)/);
            if (epM) episode = parseInt(epM[1], 10);
            if (lower.includes('mekke')) note = note || 'Mekke';
            else if (lower.includes('medine')) note = note || 'Medine';
        } else if (lower.includes('esmai_kuran') || lower.includes('esma')) {
            program = 'Esma-i Kur\'an';
            const epM = clean.match(/_(\d{1,3})(?:_|$)/);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('kurban_rehberi') || lower.startsWith('kurban')) {
            program = 'Kurban Rehberi';
            const epM = clean.match(/_(\d{1,3})(?:_|$)/);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('nasihat')) {
            program = 'Nasihatler';
            const epM = clean.match(/(?:nasihatler|nasihat)[\s_-]*(\d{1,3})/i) || clean.match(/_(\d{1,3})(?:_|$)/);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('munacat') || lower.includes('munaacat')) {
            program = 'Münâcât';
            const epM = clean.match(/(?:munacat|munaacat)[\s_-]*(?:turkce_)?(\d{1,3})/i) || clean.match(/_(\d{1,3})(?:_|$)/);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('bi_yerde') || lower.includes('biyerde')) {
            program = 'Bi\' Yerde';
            note = note || toTitleCase(clean.replace(/^bi_yerde[_-]?/i, '').replace(/_/g, ' '));
        } else if (lower.includes('ramazan') || lower.startsWith('mahya') || lower.includes('elveda_ramazan') || lower.includes('hatira_ramazan')) {
            program = 'Ramazan Kuşağı & Mahyalar';
            if (lower.startsWith('mahya')) {
                const m = clean.match(/mahya(\d+)/i);
                if (m) episode = parseInt(m[1], 10);
                note = note || 'Mahya';
            } else if (lower.includes('hatira_ramazan')) {
                const m = clean.match(/hatira_ramazan_(\d+)/i);
                if (m) episode = parseInt(m[1], 10);
                note = note || 'Hatıra-i Ramazan';
            } else if (lower.includes('elveda')) {
                note = note || 'Elveda Ramazan';
            }
        } else if (lower.includes('dorthalife') || lower.includes('dort_halife')) {
            program = 'Dört Halife';
            const epM = clean.match(/dorthalife_(\d+)/i) || clean.match(/_(\d{1,3})(?:_|$)/);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('benim_duam')) {
            program = 'Benim Duam';
            note = note || toTitleCase(clean.replace(/^benim_duam[_-]?/i, '').replace(/_/g, ' '));
        } else if (lower.includes('ayet_drama')) {
            program = 'Âyet-i Kerîme Dramaları';
            const epM = clean.match(/drama_(\d+)/i) || clean.match(/_(\d{1,3})(?:_|$)/);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.startsWith('naat') || lower.includes('naat_')) {
            program = 'Naatlar ve Kasideler';
            note = note || toTitleCase(clean.replace(/^naat[_-]?/i, '').replace(/_/g, ' '));
        } else if (lower.includes('ezan') || lower.includes('sahur') || lower.includes('sala')) {
            program = 'Ezanlar, Salâlar ve Sahur Kuşağı';
            note = note || toTitleCase(clean.replace(/_/g, ' '));
        } else if (lower.includes('mersiye')) {
            program = 'Mersiyeler ve Ağıtlar';
            note = note || toTitleCase(clean.replace(/.*mersiye[_-]?/i, '').replace(/_/g, ' '));
        } else if (lower.includes('canakkale') || lower.includes('suheda')) {
            program = 'Çanakkale & Şühedâ Özel';
            note = note || toTitleCase(clean.replace(/_/g, ' '));
        } else if (lower.includes('recebi_serif') || lower.startsWith('receb')) {
            program = 'Recep Ayı İlahileri';
            const epM = clean.match(/_(\d{1,3})(?:_|$)/);
            if (epM) episode = parseInt(epM[1], 10);
        } else if (lower.includes('soz_veriyorum') || lower.includes('sozun_dogrusu')) {
            program = 'Söz Veriyorum';
            note = note || toTitleCase(clean.replace(/.*soz_veriyorum[_-]?/i, '').replace(/_/g, ' '));
        } else if (lower.includes('bayram')) {
            program = 'Bayram Sohbetleri ve Tebrikler';
            note = note || toTitleCase(clean.replace(/_/g, ' '));
        } else if (lower.includes('girme_') || lower.includes('kamera_aktuel') || lower.startsWith('girme')) {
            program = 'Kamera Aktüel Çekimleri';
            note = note || toTitleCase(clean.replace(/_/g, ' '));
        } else if (lower.includes('kandil') || lower.includes('mirac') || lower.includes('regaib') || lower.includes('kadir') || lower.includes('cuma') || lower.includes('tesrik')) {
            program = 'Kandil ve Özel Gün Kuşakları';
            note = note || toTitleCase(clean.replace(/_/g, ' '));
        } else {
            program = 'Tematik Kısa Program Kuşakları';
            note = note || toTitleCase(clean.replace(/_/g, ' '));
        }

        return { program, episode, part, note };
    }

    // 11. HAM
    if (catId === 11 || /^ham_/i.test(n)) {
        let clean = n.replace(/^ham_/i, '');
        const lower = clean.toLowerCase();
        if (lower.includes('hayirli_iftarlar')) program = 'Hayırlı İftarlar (Ham)';
        else if (lower.includes('sahur_meclisi')) program = 'Sahur Meclisi (Ham)';
        else if (lower.includes('iftardan_once')) program = 'İftardan Önce (Ham)';
        else if (lower.includes('cerceve')) program = 'Çerçeve (Ham)';
        else if (lower.includes('hasbihal')) program = 'Hasbihal (Ham)';
        else if (lower.includes('kisasi_enbiya')) program = 'Kısas-ı Enbiya (Ham)';
        else if (lower.includes('minhacus_seni')) program = 'Minhacü\'s-Seni (Ham)';
        else if (lower.includes('muhtasarul_kuduri')) program = 'Muhtasarul Kuduri (Ham)';
        else if (lower.includes('safvetut_tefasir')) program = 'Safvetü\'t-Tefasir (Ham)';
        else if (lower.includes('riyazus_salihin')) program = 'Riyazüs Salihin (Ham)';
        else if (lower.includes('taliul_busra')) program = 'Taliu\'l-Büşra (Ham)';
        else if (lower.includes('mukabele') || lower.includes('hatim')) program = 'Mukabele ve Hatim (Ham)';
        else if (lower.includes('yakutun_nefis')) program = 'Yakutün Nefis (Ham)';
        else if (lower.includes('hadis')) program = 'Hadis Serileri (Ham)';
        else if (lower.includes('hadimul_muslimin')) program = 'Hadimü\'l-Müslimin (Ham)';
        else if (lower.includes('kuran_fon')) program = 'Kur\'an Fon Müzikleri (Ham)';
        else if (lower.includes('siyer')) program = 'Siyer-i Nebi (Ham)';
        else if (lower.includes('yolunda')) program = 'Harameyn Yolunda (Ham)';
        else if (lower.includes('hac_rehberi') || lower.includes('hac_')) program = 'Hac Özel (Ham)';
        else if (lower.includes('kadir_gecesi')) program = 'Kadir Gecesi Özel (Ham)';
        else if (lower.includes('mirac_kandili')) program = 'Miraç Kandili (Ham)';
        else if (lower.includes('tedbirden_tefekkure')) program = 'Tedbirden Tefekküre (Ham)';
        else {
            let c = clean.replace(/_\d{6}$/, '').replace(/_(?:p\d+|part\d+|cln|clean)$/i, '');
            const epM = c.match(/_(\d{1,3})$/);
            if (epM) {
                episode = parseInt(epM[1], 10);
                c = c.replace(/_\d{1,3}$/, '');
            }
            const baseName = toTitleCase(c) || 'Ham Çekim';
            program = `${baseName} (Ham)`;
        }
        return { program, episode, part, note };
    }

    // GENEL PROGRAMLAR (FALLBACK)
    let clean = n;
    let isHam = false;

    if (catId === 11 || /^ham_/i.test(clean)) {
        isHam = true;
        clean = clean.replace(/^ham_/i, '');
    }

    const leadingNumMatch = clean.match(/^(\d+)_(Kaside|Program|Ilahi)_/i);
    if (leadingNumMatch) {
        episode = parseInt(leadingNumMatch[1], 10);
        clean = clean.slice(leadingNumMatch[0].length - leadingNumMatch[2].length - 1);
    }

    const partMatch = clean.match(/_(?:part|p|pt)(\d+)/i);
    if (partMatch) {
        part = parseInt(partMatch[1], 10);
        clean = clean.replace(/_(?:part|p|pt)\d+(?:[_\s]|$)/gi, '_');
    }

    const sbMatch = clean.match(/_s(\d+)b(\d+)/i);
    if (sbMatch) {
        episode = parseInt(sbMatch[2], 10);
        note = `Sezon ${parseInt(sbMatch[1], 10)}`;
        clean = clean.replace(/_s\d+b\d+.*$/i, '');
    } else {
        const sMatch = clean.match(/_s(\d+)_(\d+)/i);
        if (sMatch) {
            episode = parseInt(sMatch[2], 10);
            note = `Sezon ${parseInt(sMatch[1], 10)}`;
            clean = clean.replace(/_s\d+_\d+.*$/i, '');
        } else {
            const bolumMatch = clean.match(/_bolum_(\d+)/i) || clean.match(/_b(\d+)/i);
            if (bolumMatch) {
                episode = parseInt(bolumMatch[1], 10);
                clean = clean.replace(/_(?:bolum|b)\d+.*$/i, '');
            } else {
                const epDateMatch = clean.match(/_(\d{1,4})_(?:\d{6}|\d{8}|\d{4})/);
                if (epDateMatch) {
                    episode = parseInt(epDateMatch[1], 10);
                    clean = clean.replace(/_\d{1,4}_(?:\d{6}|\d{8}|\d{4}).*$/, '');
                }
            }
        }
    }

    clean = clean.replace(/_\d{6}$/, '')
                 .replace(/_\d{8}$/, '')
                 .replace(/_\d{4}$/, '')
                 .replace(/_(?:revize|cln|master|kopya|yeni|y|tam)$/i, '');

    program = toTitleCase(clean);
    if (isHam && !program.includes('(Ham)')) {
        program = `${program} (Ham)`;
    }

    if (!program || program.trim() === '') {
        program = 'Genel Arşiv';
    }

    return {
        program,
        episode,
        part,
        unitType,
        unitLabel: unitLabel || (episode != null ? (unitType === 'cuz' ? `${episode}. Cüz` : unitType === 'gun' ? `${episode}. Gün` : `Bölüm ${episode}`) : null),
        note
    };
}

/**
 * Klip ismini VE veritabanındaki FileMetadata alanlarını (Bölüm Adı, Bölüm Numarası, Konu, Tür, Sunucu vb.)
 * birlikte analiz ederek en doğru Program Başlığı, Bölüm/Cüz/Gün No, Parça No, Birim Türü ve Konu/Not bilgisini üretir.
 */
export function parseClipWithMetadata(rawName, categoryId, metadataSummary = {}) {
    // 1. Öncelikle aktif özel kuralları metadata ile birlikte çalıştır
    const customMatch = evaluateCustomParsingRules(rawName, categoryId, metadataSummary);
    if (customMatch && customMatch.matched) {
        return {
            program: customMatch.program,
            episode: customMatch.episode,
            part: customMatch.part,
            unitType: customMatch.unitType,
            unitLabel: customMatch.unitLabel,
            note: customMatch.note,
            ruleId: customMatch.ruleId
        };
    }

    const base = parseClipName(rawName, categoryId);
    let { program, episode, part, unitType = 'bolum', unitLabel = null, note } = base;

    const bolumAdi = String(metadataSummary?.bolumAdi || '').trim();
    const konuMeta = String(metadataSummary?.konu || '').trim();
    const bolumNoMeta = metadataSummary?.bolumNo ? parseInt(metadataSummary.bolumNo, 10) : null;

    // 2. Bölüm Numarasını Metadata'dan Tamamla / Doğrula
    if (bolumNoMeta && bolumNoMeta > 0 && bolumNoMeta < 2000) {
        episode = bolumNoMeta;
    } else if (bolumAdi) {
        const epFromTitle = bolumAdi.match(/(\d{1,4})\.\s*(?:B[öo]l[üu]m|C[üu]z)/i);
        if (epFromTitle) {
            const parsedEp = parseInt(epFromTitle[1], 10);
            if (!isNaN(parsedEp) && parsedEp > 0) {
                episode = parsedEp;
            }
        }
    }

    // 3. Bölüm Adı ve Konu Metadata'sından Program Başlığı ve Konu (Note) Çıkarımı
    if (bolumAdi) {
        const lowerBolum = bolumAdi.toLocaleLowerCase('tr-TR');

        if (lowerBolum.startsWith('hasbihal') || lowerBolum.startsWith('habihal')) {
            program = 'Hasbihal';
        } else if (lowerBolum.includes('muhtasarul kuduri') || lowerBolum.includes('hanefi dersleri')) {
            program = 'Muhtasarul Kuduri (Hanefi Fıkhı)';
        } else if (lowerBolum.includes('riyazüs salihin') || lowerBolum.includes('riyazus salihin')) {
            program = 'Riyazüs Salihin (Hadis)';
        } else if (lowerBolum.includes('minhacüs seni') || lowerBolum.includes('minhacus seni')) {
            program = 'Minhacü\'s-Seni (Tasavvuf)';
        } else if (lowerBolum.includes('safvetüt tefasir') || lowerBolum.includes('safvetut tefasir')) {
            program = 'Safvetü\'t-Tefasir (Tefsir)';
        } else if (lowerBolum.includes('yakutun nefis') || lowerBolum.includes('yakutün nefis')) {
            program = 'Yakutün Nefis (Şafii Fıkhı)';
        } else if (lowerBolum.includes('taliül büşra') || lowerBolum.includes('taliul busra')) {
            program = 'Taliu\'l-Büşra (Akaid)';
        } else if (lowerBolum.includes('tefsiri mevakib')) {
            program = 'Tefsiri Mevakib';
            unitType = 'cuz';
        } else if (lowerBolum.startsWith('hadimül müslimin özel') || lowerBolum.startsWith('hadimul muslimin ozel')) {
            program = 'Hadimü\'l-Müslimin';
            if (!note || !note.includes('Özel')) {
                note = note ? `Özel • ${note}` : 'Özel Bölüm';
            }
        } else if (lowerBolum.startsWith('hadimül müslimin') || lowerBolum.startsWith('hadimul muslimin')) {
            program = 'Hadimü\'l-Müslimin';
        } else if (lowerBolum.startsWith('çerçeve') || lowerBolum.startsWith('cerceve')) {
            program = 'Çerçeve';
        } else if (lowerBolum.startsWith('hac rehberi')) {
            program = 'Hac Rehberi';
        } else if (lowerBolum.startsWith('semerkand sohbetleri')) {
            program = 'Semerkand Sohbetleri';
        } else if (/^\d{1,2}\.\s*c[üu]z\b/i.test(bolumAdi)) {
            program = /mukabele/i.test(rawName || '') ? 'Mukabele' : 'Hatm-i Şerif';
            unitType = 'cuz';
        } else if (program === 'Genel Arşiv' || program === 'Genel Tanıtımlar') {
            const progPrefixMatch = bolumAdi.match(/^([A-Za-zÇĞİÖŞÜçğıöşü\s'-]{3,40}?)(?:\s+\d+\.\s*Sezon)?\s+\d+\.\s*B[öo]l[üu]m/i);
            if (progPrefixMatch && progPrefixMatch[1]) {
                const candidate = progPrefixMatch[1].trim();
                if (!/^(?:konu|bölüm|bolum)$/i.test(candidate)) {
                    program = toTitleCase(candidate);
                }
            }
        }

        const konuMatch = bolumAdi.match(/Konu\s*:\s*(.+)$/i);
        if (konuMatch && konuMatch[1]) {
            const extractedTopic = konuMatch[1].trim();
            const sezonMatch = bolumAdi.match(/(\d+)\.\s*Sezon/i);
            if (sezonMatch) {
                note = `${sezonMatch[1]}. Sezon • ${extractedTopic}`;
            } else {
                note = extractedTopic;
            }
        } else if (!note || note === 'Revize') {
            const cleanedTitle = bolumAdi
                .replace(/^(.*?)(?:\s+\d+\.\s*Sezon)?\s+\d+\.\s*B[öo]l[üu]m\s*/i, '')
                .trim();
            if (cleanedTitle) {
                note = cleanedTitle;
            } else {
                note = bolumAdi;
            }
        }
    } else if (konuMeta && (!note || note === 'Revize')) {
        note = konuMeta;
    }

    if (!unitLabel && episode != null) {
        unitLabel = unitType === 'cuz' ? `${episode}. Cüz` : unitType === 'gun' ? `${episode}. Gün` : `Bölüm ${episode}`;
    }

    return { program, episode, part, unitType, unitLabel, note };
}

/**
 * Kategori 6 (Reklam) altındaki reklam spotlarının adını ve metadata'sını analiz ederek
 * Marka / Kampanya adı ve spot bilgilerini çıkarır.
 */
export function parseAdClipName(rawName = '', metadataSummary = {}) {
    const n = (rawName || '').trim();
    let brand = metadataSummary?.sirketMarka || metadataSummary?.uretici || '';
    let campaign = n;

    let clean = n.replace(/^r[_-]/i, '')
                 .replace(/[_-]\d{6,8}$/i, '')
                 .replace(/[_-]\d{1,3}\s*sn(?:[_-]|$)/gi, '_')
                 .replace(/_/g, ' ')
                 .trim();

    if (clean) {
        campaign = toTitleCase(clean);
    }

    if (!brand) {
        const lower = clean.toLocaleLowerCase('tr-TR');
        if (lower.includes('semerkand')) brand = 'Semerkand Yayınları & Medya';
        else if (lower.includes('aile dergisi') || lower.includes('aile ')) brand = 'Semerkand Aile Dergisi';
        else if (lower.includes('mostar')) brand = 'Mostar Dergisi';
        else if (lower.includes('gencokur') || lower.includes('genç okur')) brand = 'Genç Okur Dergisi';
        else if (lower.includes('sekeragaci') || lower.includes('şekerağacı')) brand = 'Şekerağacı Dergisi';
        else if (lower.includes('mavifidan') || lower.includes('mavi fidan')) brand = 'Mavi Fidan';
        else if (lower.includes('besir') || lower.includes('beşir')) brand = 'Beşir Derneği';
        else if (lower.includes('s-yay') || lower.includes('rahmet') || lower.includes('hayrat') || lower.includes('rabbani')) brand = 'Semerkand Yayınları';
        else {
            const words = campaign.split(/\s+/).slice(0, 2).join(' ');
            brand = words || 'Genel Reklam Spotu';
        }
    }

    return {
        brand,
        campaign: campaign || n
    };
}

