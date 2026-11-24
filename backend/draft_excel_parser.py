"""
draft_excel_parser.py - Yapısal (Hücre Kenarlığı / Kutu Çizgisi + AKIŞ Sekmesi + Dinamik DB) Haftalık Taslak Akış Ayrıştırıcısı

Çalışma Mantığı (Sabit İsim Listesine Bağımlı Değildir!):
1. Excel'deki 30 dakikalık detay matrisinde her program kuşağı bir kutu (hücre grubu) olarak çizilmiştir:
   - Yeni bir programın başladığı ilk 30 dakikalık satırın ÜST KENARLIĞI (cell.border.top) veya bir üst hücrenin ALT KENARLIĞI (prev_cell.border.bottom) bulunur.
   - Aynı programın devam eden 30 dakikalık alt satırlarında (konuşmacı, hoca, şehir, konu, dergah vb.) ise aradaki yatay çizgi YOKTUR (border=None).
2. Ayrıca Excel'deki 2. sekme olan 'AKIŞ' sayfasında o günün program başlangıç saatleri yer alır.
3. Bu sayede sisteme daha önce hiç bilinmeyen, yepyeni bir program adı eklense bile:
   - Hücrenin üst ayırıcı çizgisinden (veya AKIŞ sekmesinden / bölüm numarası kalıbından) yeni program olduğu %100 otomatik anlaşılır.
   - Programın adı hiçbir sabit listeye zorlanmadan doğrudan Excel'de yazıldığı şekliyle (sadece sondaki '- BölümNo' ve '- Canlı' kısmı ayrıştırılarak) alınır.
   - Altındaki çizgisiz satırlar ise o programın Sunucu/Konuk/Konu (host & topic) detayı olarak birleştirilir.
"""
import sys
import os
import io
import json
import re
import datetime
import openpyxl

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

TURKISH_MONTHS = {
    1: 'Ocak', 2: 'Şubat', 3: 'Mart', 4: 'Nisan',
    5: 'Mayıs', 6: 'Haziran', 7: 'Temmuz', 8: 'Ağustos',
    9: 'Eylül', 10: 'Ekim', 11: 'Kasım', 12: 'Aralık'
}

DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

def extract_time_str(val):
    if val is None:
        return ''
    if isinstance(val, datetime.time):
        return f"{val.hour:02d}:{val.minute:02d}"
    if isinstance(val, datetime.datetime):
        return f"{val.hour:02d}:{val.minute:02d}"
    s = str(val).strip()
    m = re.search(r'(\d{1,2}):(\d{2})', s)
    if m:
        h = int(m.group(1))
        minute = int(m.group(2))
        return f"{h:02d}:{minute:02d}"
    return ''

def norm_tr(text):
    if not text:
        return ''
    s = str(text)
    s = (s.replace('İ', 'i')
          .replace('I', 'ı')
          .replace('Â', 'a')
          .replace('â', 'a')
          .replace('Î', 'i')
          .replace('î', 'i')
          .replace('Û', 'u')
          .replace('û', 'u')
          .replace('’', "'")
          .replace('‘', "'")
          .replace('`', "'")
          .replace('–', '-')
          .replace('—', '-'))
    s = s.lower()
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def norm_compact(text):
    s = norm_tr(text)
    return re.sub(r"[^a-z0-9ğüşıöç]", "", s)

# Program kataloğunu yalnızca kategori rengi/rozeti eşleştirmesi için yardımcı olarak yükle
CATALOG_PROGRAMS = {}

def load_catalog():
    global CATALOG_PROGRAMS
    if CATALOG_PROGRAMS:
        return CATALOG_PROGRAMS

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cat_paths = [
        os.path.join(base_dir, 'backend', 'program_categories_catalog.json'),
        os.path.join(base_dir, 'src', 'data', 'program_categories_catalog.json')
    ]

    for p in cat_paths:
        if os.path.exists(p):
            try:
                with open(p, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for prog in data.get('programs', []):
                        CATALOG_PROGRAMS[norm_tr(prog['name'])] = prog
                break
            except Exception:
                pass

    return CATALOG_PROGRAMS

load_catalog()

# Yalnızca yazım farkı olan klasik programlarda (örn: Excel'de 'SEMERKAND SOHBETİ' yazılıp arşivde 'SEMERKAND SOHBETLERİ' olması gibi)
# isteğe bağlı kanonik isim eşleştirmesi; burada olmayan TÜM yeni programlar Excel'de yazıldığı orijinal adıyla korunur!
CANONICAL_TITLE_ALIASES = {
    'ilim dersleri- tecvid': 'İlim Dersleri- TECVİD',
    'ilim dersleri - tecvid': 'İlim Dersleri- TECVİD',
    'ilim dersleri-tecvid': 'İlim Dersleri- TECVİD',
    'semerkand sohbeti': 'SEMERKAND SOHBETLERİ',
    'semerkand sohbetleri': 'SEMERKAND SOHBETLERİ',
    'kısas-ı enbiya': 'KISAS-I ENBİYA',
    'kisas-i enbiya': 'KISAS-I ENBİYA',
}

CATEGORY_RULES = [
    {
        'category': 'Dini / İlim',
        'color': '#468625',
        'badge': 'İlim',
        'keywords': ['hatm', 'mukabele', 'tefsir', 'tecvid', 'delail', 'kuduri', 'yakut', 'safvet', 'ilmihal', 'ilim', 'son inci', 'hac rehber', 'akaid', 'fıkıh', 'fikih', 'hadis', 'kur\'an', 'kuran']
    },
    {
        'category': 'Sohbet / Tasavvuf',
        'color': '#058193',
        'badge': 'Sohbet',
        'keywords': ['semerkand sohbet', 'hasbihal', 'hacegan', 'mesnevi', 'sohbet', 'minhac', 'riyaz', 'taliü', 'taliu', 'tasavvuf', 'hikmet', 'irfan']
    },
    {
        'category': 'Kültür / Tarih',
        'color': '#ED891E',
        'badge': 'Kültür',
        'keywords': ['beş vakit', 'bes vakit', 'yüzyıl', 'yuzyil', 'alimler', 'bedesten', 'aziz istanbul', 'ulu cami', 'kısas', 'kisas', 'hattın izinde', 'hattin izinde', 'güzergah', 'guzergah', 'çerçeve', 'cerceve', 'tarih', 'kültür', 'şehir']
    },
    {
        'category': 'Çocuk / Gençlik',
        'color': '#70AC42',
        'badge': 'Çocuk',
        'keywords': ['neşeli petek', 'neseli petek', 'çocuk', 'cocuk', 'genç', 'genc']
    },
    {
        'category': 'Dolgu Kuşağı',
        'color': '#109AAD',
        'badge': 'Dolgu Kuşağı',
        'keywords': ['dolgu', 'kısa prog', 'kaside', 'aşr-ı şerif', 'asr-i serif', 'kasideler']
    }
]

def determine_category(title, is_kisa=False):
    if is_kisa or 'dolgu' in norm_tr(title) or 'kısa prog' in norm_tr(title) or 'kaside' in norm_tr(title):
        return 'Dolgu Kuşağı', '#06b6d4', 'Dolgu Kuşağı'

    t_norm = norm_tr(title)

    for rule in CATEGORY_RULES:
        for kw in rule['keywords']:
            if kw in t_norm:
                return rule['category'], rule['color'], rule['badge']

    if t_norm in CATALOG_PROGRAMS:
        p_info = CATALOG_PROGRAMS[t_norm]
        cat = p_info.get('category', 'Kültür / Tarih')
        for r in CATEGORY_RULES:
            if r['category'].lower() in cat.lower():
                return r['category'], r['color'], r['badge']
        return cat, '#3b82f6', cat[:6]

    return 'Kültür / Tarih', '#3b82f6', 'Program'

def is_live_cell_text(text):
    """Metinde 'Canlı' / 'Canlı Yayın' ibaresi olup olmadığını kontrol eder."""
    if not text:
        return False
    c_norm = norm_tr(text)
    return bool(re.search(r'\bcanl[ıi]\b', c_norm))

def parse_title_episode_and_inline_detail(raw_t, akis_hint=''):
    """
    Herhangi bir program satırını (bilinen veya sisteme yeni eklenmiş yepyeni bir program adını)
    genel kurallarla ayrıştırır:
      1. Varsa 'Canlı' / 'Canlı Yayın' ve 'Tekrar' etiketlerini ayırır.
      2. Sondaki bölüm numarasını ('- 107', '-11', '- 3') ve varsa bölüm numarasından sonraki
         satır içi mekan/detay bilgisini ('ULU CAMİ-9- Akşehir' -> title='ULU CAMİ', ep='9', detail='Akşehir') ayırır.
      3. Programın kendi adındaki tireleri ('El-Yakutu’n-Nefis', 'İlim Dersleri- Tecvid', 'Safvetüt- Tefasir'
         veya gelecekteki 'Yeni-Program Adı - 1') olduğu gibi korur!
    """
    if not raw_t and not akis_hint:
        return '', '', ''

    source_str = str(raw_t or akis_hint).strip()

    # 1. 'Canlı' / 'Canlı Yayın' ve 'Tekrar' ibarelerini temizle
    cleaned = re.sub(r'[\(\[\-\–\—\s]*\bcanl[ıi](?:\s+yay[ıi]n)?\b[\)\]\s]*', ' ', source_str, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r'[\(\[\-\–\—\s]*\btekrar\b[\)\]\s]*', '-', cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r'\s+', ' ', cleaned)
    cleaned = re.sub(r'[-–—\s]+$', '', cleaned).strip()

    episode = ''
    inline_detail = ''
    title_candidate = cleaned

    # 2. Kalıp A: "<Program Adı> - <Bölüm No> - <Mekan/Detay>" (Örn: 'ULU CAMİ-9- Akşehir', 'AZİZ İSTANBUL-36-Eyüp-Karyağdı', 'YENİ BELGESEL - 4 - Bursa')
    m_with_tail = re.match(r'^(.*?)\s*[-–—]\s*(\d{1,4})\s*[-–—]\s*(.+)$', cleaned)
    if m_with_tail:
        head_cand = m_with_tail.group(1).strip(' -–—')
        ep_cand = m_with_tail.group(2).strip()
        tail_cand = m_with_tail.group(3).strip(' -–—')
        if len(head_cand) >= 2 and not head_cand.isdigit():
            title_candidate = head_cand
            episode = ep_cand
            inline_detail = tail_cand
    else:
        # 3. Kalıp B: "<Program Adı> - <Bölüm No>" veya "<Program Adı> <Bölüm No>" (Örn: 'Herhangi Bir Yeni Program - 15', 'El-Yakutu’n-Nefis-11')
        m_trailing_ep = re.match(r'^(.*?)(?:\s*[-–—]\s*|\s+)(\d{1,4})$', cleaned)
        if m_trailing_ep:
            head_cand = m_trailing_ep.group(1).strip(' -–—')
            if len(head_cand) >= 2 and not head_cand.isdigit():
                title_candidate = head_cand
                episode = m_trailing_ep.group(2).strip()

    # 4. Sadece bilinen ufak yazım varyasyonları için (örn. SEMERKAND SOHBETİ -> SEMERKAND SOHBETLERİ) kanonik karşılığı varsa düzelt,
    #    yoksa Excel'de yazılan orijinal program adını HİÇ BOZMADAN olduğu gibi döndür!
    norm_cand = norm_tr(title_candidate)
    if norm_cand in CANONICAL_TITLE_ALIASES:
        return CANONICAL_TITLE_ALIASES[norm_cand], episode, inline_detail

    return (title_candidate or akis_hint or source_str).strip(), episode, inline_detail

def clean_program_title(raw_t, akis_hint=''):
    clean_t, _, _ = parse_title_episode_and_inline_detail(raw_t, akis_hint)
    return clean_t

def has_cell_top_separator(ws, row_idx, col_idx):
    """
    Excel'deki 30 dakikalık detay matrisinde bu hücrenin yeni bir kutu/program başlangıcı
    olup olmadığını Excel'in kendi hücre kenarlığı (border) çizgisinden kontrol eder:
    - Hücrenin üst kenarlığı (border.top.style) varsa VEYA
    - Bir üst satırdaki hücrenin alt kenarlığı (border.bottom.style) varsa -> True döner.
    - Aynı kutunun içindeki 2., 3., 4. alt satırlarda (konuşmacı/konu/mekan) bu çizgi yoktur -> False döner.
    """
    if row_idx <= 3:
        return True
    cell = ws.cell(row_idx, col_idx)
    if cell.border and cell.border.top and cell.border.top.style:
        return True
    prev_cell = ws.cell(row_idx - 1, col_idx)
    if prev_cell.border and prev_cell.border.bottom and prev_cell.border.bottom.style:
        return True
    return False

def looks_like_program_with_episode(cell_str):
    """
    Kenarlık çizgisi unutulmuş olsa bile bir hücrenin '<Program Adı> - <Bölüm No>' formatında
    olup olmadığını yapısal olarak kontrol eder (örn. 'HATTIN İZİNDE - 3').
    Konuşmacı veya konu satırlarını ('Hz.. Muhammed-9', 'Şeyh M. Esat Erbili Hz.-2', 'Mahmud Sami Ramazanoğlu-1', 'Cüz - 9')
    hariç tutar.
    """
    if not cell_str:
        return False
    c_norm = norm_tr(cell_str)
    # Konu/Konuşmacı/Cüz satırı kalıpları
    if re.match(r'^(?:c[üu]z|hz\.|şeyh|seyh|mahmud\s+sami|ses:|kerim\s+öztürk)', c_norm):
        return False
    # Tamamı BÜYÜK HARF olan ve sonunda '- <Sayı>' bulunan program başlığı (örn: 'SON İNCİ - 5', 'MESNEVİDEN DERSLER-10')
    alpha_chars = [ch for ch in cell_str if ch.isalpha()]
    is_all_upper = len(alpha_chars) >= 4 and all(ch.isupper() for ch in alpha_chars)
    has_ep_suffix = bool(re.search(r'[-–—]\s*\d{1,4}(?:\s*[-–—].+)?$', cell_str.strip()))
    return is_all_upper and has_ep_suffix

def parse_draft_excel(file_path):
    if not os.path.exists(file_path):
        import unicodedata
        dir_name = os.path.dirname(file_path) or '.'
        base_name = os.path.basename(file_path)
        norm_target = unicodedata.normalize('NFC', base_name)
        if os.path.exists(dir_name):
            for candidate in os.listdir(dir_name):
                if unicodedata.normalize('NFC', candidate) == norm_target or candidate.lower() == base_name.lower():
                    file_path = os.path.join(dir_name, candidate)
                    break

    wb = openpyxl.load_workbook(file_path, data_only=True)

    ws_akis = None
    ws_detail = None

    for sname in wb.sheetnames:
        norm = sname.lower()
        if 'akış' in norm or 'akis' in norm:
            ws_akis = wb[sname]
        elif any(char.isdigit() for char in sname) and ('ekim' in norm or 'eylül' in norm or 'ağustos' in norm or 'kasım' in norm or 'mart' in norm or 'ocak' in norm or 'şubat' in norm or 'nisan' in norm or 'mayıs' in norm or 'haziran' in norm or 'temmuz' in norm or 'aralık' in norm or '-' in sname):
            ws_detail = wb[sname]

    if ws_detail is None and len(wb.sheetnames) > 0:
        ws_detail = wb[wb.sheetnames[0]]

    if ws_akis is None and len(wb.sheetnames) > 1:
        second_name = wb.sheetnames[1]
        if 'akış' in second_name.lower() or 'akis' in second_name.lower():
            ws_akis = wb[second_name]

    # Tarihleri Al (Row 2)
    days_dates = []
    if ws_detail:
        for col in range(2, 9):
            val = ws_detail.cell(2, col).value
            if isinstance(val, (datetime.datetime, datetime.date)):
                days_dates.append(val.strftime('%Y-%m-%d'))
            elif val:
                days_dates.append(str(val).strip()[:10])

    if len(days_dates) < 7 and ws_akis:
        days_dates = []
        for d_idx in range(7):
            c = d_idx * 2 + 1
            val = ws_akis.cell(2, c).value
            if isinstance(val, (datetime.datetime, datetime.date)):
                days_dates.append(val.strftime('%Y-%m-%d'))

    if len(days_dates) < 7:
        days_dates = [
            '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26',
            '2026-11-27', '2026-11-28', '2026-11-29'
        ]

    result = {}

    for d_idx, date_key in enumerate(days_dates):
        day_name = DAY_NAMES[d_idx]
        try:
            dt_obj = datetime.datetime.strptime(date_key, '%Y-%m-%d')
            formatted_date = f"{dt_obj.day} {TURKISH_MONTHS.get(dt_obj.month, '')} {dt_obj.year}"
        except Exception:
            formatted_date = date_key

        # 1. 'AKIŞ' özet sekmesindeki program başlangıç saatlerini ve başlıklarını oku
        akis_map = {}
        if ws_akis:
            t_col = d_idx * 2 + 1
            p_col = d_idx * 2 + 2
            for r in range(3, ws_akis.max_row + 1):
                t_val = ws_akis.cell(r, t_col).value
                p_val = ws_akis.cell(r, p_col).value
                t_str = extract_time_str(t_val)
                p_str = str(p_val).strip() if p_val else ''
                if t_str and p_str:
                    akis_map[t_str] = p_str

        col_idx = d_idx + 2
        raw_program_blocks = []
        current_block = None

        if ws_detail:
            for r in range(3, ws_detail.max_row + 1):
                t_val = ws_detail.cell(r, 1).value
                t_str = extract_time_str(t_val)
                c_val = ws_detail.cell(r, col_idx).value
                c_str = str(c_val).strip() if c_val else ''

                if not t_str:
                    continue

                akis_title_at_time = akis_map.get(t_str, '')
                has_border_sep = has_cell_top_separator(ws_detail, r, col_idx)

                # YENİ PROGRAM BAŞLANGICI KARAR MEKANİZMASI (Tamamen Yapısal!):
                # 1. Excel'de hücrenin üst ayırıcı kenarlık çizgisi varsa (has_border_sep) ve hücre doluysa -> Yeni Program!
                # 2. Veya AKIŞ sekmesinde bu saatte bir program başlangıcı tanımlıysa -> Yeni Program!
                # 3. Veya hücre çizgisi unutulmuş olsa bile BÜYÜK HARFLİ '<PROGRAM ADI> - <BölümNo>' formatındaysa -> Yeni Program!
                is_p = False
                if c_str and has_border_sep:
                    is_p = True
                elif akis_title_at_time:
                    is_p = True
                elif c_str and looks_like_program_with_episode(c_str):
                    is_p = True

                # Özel Durum: Neşeli Petek / 60 dk çocuk kuşağı sonrası 09:30 ve 17:30 dolgu kuşağı
                if t_str in ('09:30', '17:30') and not is_p and current_block and ('neşeli' in norm_tr(current_block['raw']) or has_border_sep):
                    is_p = True
                    c_str = c_str or 'Kasideler + Aşr-ı Şerifler'

                if is_p:
                    if current_block:
                        current_block['endTime'] = t_str
                        raw_program_blocks.append(current_block)
                    current_block = {
                        'startTime': t_str,
                        'raw': c_str or akis_title_at_time,
                        'akisHint': akis_title_at_time,
                        'details': []
                    }
                elif c_str and current_block:
                    current_block['details'].append(c_str)

            if current_block:
                current_block['endTime'] = '24:00'
                raw_program_blocks.append(current_block)

        # Eğer detay sayfası yoksa doğrudan AKIŞ sayfasından oku
        if not raw_program_blocks and akis_map:
            raw_slots = sorted(akis_map.items(), key=lambda x: x[0])
            for i, (st, ptitle) in enumerate(raw_slots):
                next_st = raw_slots[i + 1][0] if i + 1 < len(raw_slots) else '24:00'
                raw_program_blocks.append({
                    'startTime': st,
                    'endTime': next_st,
                    'raw': ptitle,
                    'akisHint': ptitle,
                    'details': []
                })

        # Program bloklarını zenginleştir ve dönüştür
        progs = []
        for blk in raw_program_blocks:
            st = blk['startTime']
            et = blk['endTime']
            raw_t = blk['raw']
            akis_hint = blk.get('akisHint', '')
            details = blk['details']

            clean_t, episode, inline_detail = parse_title_episode_and_inline_detail(raw_t, akis_hint)

            is_kisa = (
                'dolgu' in norm_tr(clean_t) or
                'kısa prog' in norm_tr(clean_t) or
                'kasideler' in norm_tr(clean_t) or
                'kaside' in norm_tr(clean_t) or
                'aşr-ı şerif' in norm_tr(clean_t)
            )

            is_live = is_live_cell_text(raw_t) or any(is_live_cell_text(d) for d in details)

            host = ''
            topic = ''

            clean_details = [
                d.strip() for d in details
                if d.strip() and norm_tr(d.strip()) not in ('canlı', 'canli', 'canlı yayın', 'canli yayin')
            ]

            # Eğer alt satırların ilki sadece bir sayıysa (örn: KISAS-I ENBİYA alt satırı '68') bu bölüm numarasıdır
            if clean_details and clean_details[0].isdigit():
                if not episode:
                    episode = clean_details[0]
                clean_details = clean_details[1:]

            if inline_detail:
                host = inline_detail

            if clean_details:
                if not host:
                    host = clean_details[0]
                    if len(clean_details) > 1:
                        topic = ' - '.join(clean_details[1:])
                else:
                    topic = ' - '.join(clean_details)

            # Cüz bazlı programlarda alt satırdaki 'Cüz - 9' bilgisinden episode (cüz no) çıkar
            if not episode and ('hatm' in norm_tr(clean_t) or 'mevakib' in norm_tr(clean_t) or 'mukabele' in norm_tr(clean_t) or 'cüz' in norm_tr(host)):
                cuz_search_text = f"{host} {topic} {raw_t}"
                cuz_m = re.search(r'c[üu]z[\s\-:]*(\d{1,2})\b', cuz_search_text, flags=re.IGNORECASE)
                if cuz_m:
                    episode = cuz_m.group(1)

            if is_kisa:
                clean_t = 'Dolgu Kuşağı'
                cat = 'Dolgu Kuşağı'
                col = '#06b6d4'
                bdg = 'Dolgu Kuşağı'
                avail_opts = ['Kısa Program', 'Kaside', 'Aşr-ı Şerif']
                sel_opts = ['Kısa Program', 'Kaside', 'Aşr-ı Şerif']
                if 'kaside' in norm_tr(raw_t) and 'aşr' not in norm_tr(raw_t):
                    sel_opts = ['Kısa Program', 'Kaside']
                top = 'Kullanılabilir Seçenekler: ' + ', '.join(sel_opts)
            else:
                cat, col, bdg = determine_category(clean_t, is_kisa=False)
                avail_opts = ['Bant', 'Canlı', 'Altyazı']
                sel_opts = ['Canlı'] if is_live else ['Bant']
                top = topic

            progs.append({
                'startTime': st,
                'endTime': et,
                'title': clean_t,
                'rawTitle': raw_t,
                'episode': episode,
                'host': host,
                'topic': top,
                'category': cat,
                'categoryColor': col,
                'categoryBadge': bdg,
                'isKisaSlot': is_kisa,
                'isLive': is_live,
                'availableOptions': avail_opts,
                'selectedOptions': sel_opts
            })

        # Süre ve dakika hesapları
        for idx, p in enumerate(progs):
            p['order'] = idx + 1
            p['id'] = f"prog_{date_key}_{idx+1:02d}"
            p['instanceId'] = f"inst_{date_key}_{idx+1:02d}"

            st = p.get('startTime', '00:00')
            et = p.get('endTime', '24:00')
            st_p = st.split(':') if ':' in st else ['0', '0']
            sm = int(st_p[0]) * 60 + int(st_p[1])

            if et == '24:00':
                em = 1440
            elif ':' in et:
                et_p = et.split(':')
                em = int(et_p[0]) * 60 + int(et_p[1])
            else:
                em = min(1440, sm + 30)

            if em <= sm:
                em = min(1440, sm + 30)

            dur = em - sm

            p['startMinute'] = sm
            p['endMinute'] = em
            p['duration'] = dur

        result[date_key] = {
            'date': formatted_date,
            'dayName': day_name,
            'programs': progs
        }

    return result

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Dosya yolu belirtilmedi'}))
        sys.exit(1)

    excel_path = sys.argv[1]
    should_save = '--save' in sys.argv

    try:
        schedule = parse_draft_excel(excel_path)

        if should_save:
            channel_name = 'ch_hd'
            for idx, arg in enumerate(sys.argv):
                if arg == '--channel' and idx + 1 < len(sys.argv):
                    channel_name = sys.argv[idx + 1]
            target_json = os.path.join('src', 'data', f'draft_schedule_{channel_name}.json')
            with open(target_json, 'w', encoding='utf-8') as f:
                json.dump(schedule, f, ensure_ascii=False, indent=2)
            runtime_json = os.path.join('backend', 'data', f'draft_schedule_{channel_name}.json')
            os.makedirs(os.path.dirname(runtime_json), exist_ok=True)
            with open(runtime_json, 'w', encoding='utf-8') as f:
                json.dump(schedule, f, ensure_ascii=False, indent=2)
            if channel_name == 'ch_hd':
                with open(os.path.join('src', 'data', 'defaultWeeklySchedule.json'), 'w', encoding='utf-8') as f:
                    json.dump(schedule, f, ensure_ascii=False, indent=2)

        print(json.dumps(schedule, ensure_ascii=False))

    except Exception as e:
        import traceback
        err_msg = f"{str(e)}\n{traceback.format_exc()}"
        print(json.dumps({'error': err_msg}), file=sys.stderr)
        sys.exit(1)
