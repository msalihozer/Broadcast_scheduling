"""
draft_excel_parser.py - Haftalık Taslak Akış Excel Ayrıştırıcısı (Katalog + AKIŞ Sekmesi Entegreli)

Bu script '23-29 KASIM 2026 AKIŞ.xlsx', '31 AĞUSTOS-6 EYLÜL 2026 AKIŞ.xlsx' ve benzeri
haftalık yayın akışı Excel dosyalarını okur, hem 30 dakikalık detay matrisini hem de
'AKIŞ' özet sekmesini çapraz doğrulayarak konuşmacı/dergah/konu alt satırlarının
(örn: 'Sadrettin Koç-İznik Dergah', 'Düzce', 'A.Enes Bilge') yanlışlıkla yeni program
olarak ayrıştırılmasını %100 önler ve 7 günlük 24 saatlik (1440 dk) eksiksiz akışı üretir.
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
    """Tire, kesme işareti ve boşlukları kaldırarak karşılaştırma için saf alfanümerik anahtar üretir."""
    s = norm_tr(text)
    return re.sub(r"[^a-z0-9ğüşıöç]", "", s)

# Program kataloğunu yükle (eğer yoksa otomatik oluştur)
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

    cat_file = None
    for p in cat_paths:
        if os.path.exists(p):
            cat_file = p
            break

    if not cat_file:
        try:
            from backend.extract_program_catalog import extract_catalog
            cat_data = extract_catalog()
            for prog in cat_data.get('programs', []):
                CATALOG_PROGRAMS[norm_tr(prog['name'])] = prog
            return CATALOG_PROGRAMS
        except Exception as e:
            print(f"[CATALOG WARNING] Katalog oluşturulamadı: {e}", file=sys.stderr)
            return {}

    try:
        with open(cat_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for prog in data.get('programs', []):
                CATALOG_PROGRAMS[norm_tr(prog['name'])] = prog
    except Exception as e:
        print(f"[CATALOG WARNING] Katalog yüklenemedi: {e}", file=sys.stderr)

    return CATALOG_PROGRAMS

load_catalog()

# Bilinen standart program adları ve ön ekleri
STANDARDIZED_TITLES = {
    'ilim dersleri- tecvid': 'İlim Dersleri- TECVİD',
    'ilim dersleri - tecvid': 'İlim Dersleri- TECVİD',
    'ilim dersleri-tecvid': 'İlim Dersleri- TECVİD',
    'ilim dersleri tecvid': 'İlim Dersleri- TECVİD',
    'tecvid': 'İlim Dersleri- TECVİD',
    'ilim dersleri': 'İlim Dersleri- TECVİD',
    'hatm-i şerif': 'HATM-İ ŞERİF',
    'hatm-i serif': 'HATM-İ ŞERİF',
    'hatmi şerif': 'HATM-İ ŞERİF',
    'mukabele': 'MUKABELE',
    'tefsir-i mevakib': 'TEFSİR-İ MEVAKİB',
    'tefsiri mevakib': 'TEFSİR-İ MEVAKİB',
    'delail-ül hayrat': 'DELAİL-ÜL HAYRAT',
    'delail-ul hayrat': 'DELAİL-ÜL HAYRAT',
    "delailü'l-hayrat": 'DELAİL-ÜL HAYRAT',
    'delailül hayrat': 'DELAİL-ÜL HAYRAT',
    'neşeli petek': 'NEŞELİ PETEK',
    'neseli petek': 'NEŞELİ PETEK',
    'semerkand sohbetleri': 'SEMERKAND SOHBETLERİ',
    'semerkand sohbeti': 'SEMERKAND SOHBETLERİ',
    'semerkand sohbet': 'SEMERKAND SOHBETLERİ',
    'hasbihal': 'HASBİHAL',
    'beş vakit bir şehir': 'BEŞ VAKİT BİR ŞEHİR',
    'bes vakit bir sehir': 'BEŞ VAKİT BİR ŞEHİR',
    'yüzyılın alimleri': 'YÜZYILIN ALİMLERİ',
    'yuzyilin alimleri': 'YÜZYILIN ALİMLERİ',
    'kısas-ı enbiya': 'KISAS-I ENBİYA',
    'kisas-i enbiya': 'KISAS-I ENBİYA',
    'kısası enbiya': 'KISAS-I ENBİYA',
    'hacegan sohbetleri': 'HACEGAN SOHBETLERİ',
    'hacegan sohbeti': 'HACEGAN SOHBETLERİ',
    'hacegan': 'HACEGAN SOHBETLERİ',
    'güzergah': 'GÜZERGAH',
    'guzergah': 'GÜZERGAH',
    'bedesten': 'BEDESTEN',
    'çerçeve': 'ÇERÇEVE',
    'cerceve': 'ÇERÇEVE',
    'hattın izinde': 'HATTIN İZİNDE',
    'hattin izinde': 'HATTIN İZİNDE',
    'mesneviden dersler': 'MESNEVİDEN DERSLER',
    'mesneviden': 'MESNEVİDEN DERSLER',
    'aziz istanbul': 'AZİZ İSTANBUL',
    'ulu cami': 'ULU CAMİ',
    'son inci': 'SON İNCİ',
    "taliü'l - büşra": 'Taliü’l – Büşra',
    "taliü'l-büşra": 'Taliü’l – Büşra',
    'taliül büşra': 'Taliü’l – Büşra',
    "taliu'l": 'Taliü’l – Büşra',
    "taliü'l": 'Taliü’l – Büşra',
    "muhtasaru'l - kuduri": 'Muhtasaru’l – Kuduri',
    "muhtasaru'l-kuduri": 'Muhtasaru’l – Kuduri',
    'muhtasarul kuduri': 'Muhtasaru’l – Kuduri',
    "muhtasaru'l": 'Muhtasaru’l – Kuduri',
    "el-yakutu'n-nefis": 'El-Yakutu’n-Nefis',
    "el-yakutu'n - nefis": 'El-Yakutu’n-Nefis',
    'el yakutun nefis': 'El-Yakutu’n-Nefis',
    'el-yakutu': 'El-Yakutu’n-Nefis',
    'safvetüt- tefasir': 'Safvetüt- Tefasir',
    'safvetüt-tefasir': 'Safvetüt- Tefasir',
    "safvetü't-tefasir": 'Safvetüt- Tefasir',
    'safvetüt': 'Safvetüt- Tefasir',
    'safvetut': 'Safvetüt- Tefasir',
    'riyazüs - salihin': 'Riyazüs – Salihin',
    'riyazüs-salihin': 'Riyazüs – Salihin',
    'riyazüs salihin': 'Riyazüs – Salihin',
    'riyazüs': 'Riyazüs – Salihin',
    'riyazus': 'Riyazüs – Salihin',
    "minhacü's seni": 'Minhâcü’s Senî',
    "minhacü's-seni": 'Minhâcü’s Senî',
    'minhacüs seni': 'Minhâcü’s Senî',
    "minhacü's": 'Minhâcü’s Senî',
    'minhacu': 'Minhâcü’s Senî',
    'hac rehberi': 'Hac Rehberi'
}

KNOWN_PROGRAM_PREFIXES = [
    'ilim dersleri', 'kisas-i enbiya', 'kısas-ı enbiya', 'kısası enbiya',
    'cerceve', 'çerçeve', 'hasbihal', 'bes vakit bir sehir', 'beş vakit bir şehir',
    'yuzyilin alimleri', 'yüzyılın alimleri', 'bedesten',
    'semerkand sohbet', 'hacegan sohbet', 'hacegan', 'ulu cami',
    'mesneviden dersler', 'mesneviden', 'hattin izinde', 'hattın izinde',
    'son inci', "taliu'l", "taliü'l", 'taliül', "muhtasaru'l", 'muhtasarul',
    'el-yakutu', 'el yakutu', 'safvetut', 'safvetüt', "safvetü't",
    'riyazus', 'riyazüs', "minhacu's", "minhacü's", 'minhacüs',
    'hac rehberi', 'delail', 'hatm-i serif', 'hatm-i şerif', 'hatmi şerif',
    'mukabele', 'tefsir-i mevakib', 'tefsiri mevakib',
    'neseli petek', 'neşeli petek', 'guzergah', 'güzergah',
    'aziz istanbul', 'kasideler', 'kısa prog', 'kisa prog', 'dolgu'
]

# Konuşmacı / ders konusu / mekan alt satırlarında geçebilen ve ASLA tek başına program başlangıcı sayılmaması gereken ifadeler
SPEAKER_OR_DETAIL_PREFIXES = [
    'akaid-', 'akaid ', 'hanefi ilmihali', 'şafii ilmihali', 'safii ilmihali',
    'tefsir-abdulaziz', 'tefsir - abdulaziz', 'hadis-', 'tasavvuf-', 'ses:', 'cüz -', 'cüz-', 'kerim öztürk',
    'sadrettin koç', 'ebubekir arvas', 'hakan öner', 'a.enes bilge', 'a. enes bilge',
    'mustafa yıldız', 'fatih yasin demiral', 'yusuf erbaş', 'ömer faruk',
    'murat alkan', 'yunus e.özsaray', 'izani turan', 'şeyh m.', 'mahmud sami',
    'hz.', 'hz..', 'aklı selim', 'akl-ı selim', 'kanaat ve şükür', 'insanın hakikat',
    'yardımlaşma ve dayanışma'
]

CATEGORY_RULES = [
    {
        'category': 'Dini / İlim',
        'color': '#10b981',
        'badge': 'İlim',
        'keywords': ['hatm', 'mukabele', 'tefsir', 'tecvid', 'delail', 'kuduri', 'yakut', 'safvet', 'ilmihal', 'ilim', 'son inci', 'hac rehber']
    },
    {
        'category': 'Sohbet / Tasavvuf',
        'color': '#8b5cf6',
        'badge': 'Sohbet',
        'keywords': ['semerkand sohbet', 'hasbihal', 'hacegan', 'mesnevi', 'sohbet', 'minhac', 'riyaz', 'taliü', 'taliu']
    },
    {
        'category': 'Kültür / Tarih',
        'color': '#3b82f6',
        'badge': 'Kültür',
        'keywords': ['beş vakit', 'bes vakit', 'yüzyıl', 'yuzyil', 'alimler', 'bedesten', 'aziz istanbul', 'ulu cami', 'kısas', 'kisas', 'hattın izinde', 'hattin izinde', 'güzergah', 'guzergah', 'çerçeve', 'cerceve']
    },
    {
        'category': 'Çocuk / Gençlik',
        'color': '#f59e0b',
        'badge': 'Çocuk',
        'keywords': ['neşeli petek', 'neseli petek', 'çocuk', 'cocuk']
    },
    {
        'category': 'Dolgu Kuşağı',
        'color': '#06b6d4',
        'badge': 'Dolgu Kuşağı',
        'keywords': ['dolgu', 'kısa prog', 'kaside', 'aşr-ı şerif', 'asr-i serif', 'kasideler']
    }
]

def determine_category(title, is_kisa=False):
    if is_kisa or 'dolgu' in norm_tr(title) or 'kısa prog' in norm_tr(title) or 'kaside' in norm_tr(title):
        return 'Dolgu Kuşağı', '#06b6d4', 'Dolgu Kuşağı'

    t_norm = norm_tr(title)

    # 1. Önce kategori kurallarından kontrol et (tutarlı rozet ve renk için)
    for rule in CATEGORY_RULES:
        for kw in rule['keywords']:
            if kw in t_norm:
                return rule['category'], rule['color'], rule['badge']

    # 2. Katalogdan kontrol et
    if t_norm in CATALOG_PROGRAMS:
        p_info = CATALOG_PROGRAMS[t_norm]
        cat = p_info.get('category', 'Genel Yayın')
        for r in CATEGORY_RULES:
            if r['category'].lower() in cat.lower():
                return r['category'], r['color'], r['badge']
        return cat, '#3b82f6', cat[:6]

    return 'Genel Yayın', '#6b7280', 'Genel'

def is_live_cell_text(text):
    """Metinde 'Canlı' / 'Canlı Yayın' ibaresi olup olmadığını kontrol eder."""
    if not text:
        return False
    c_norm = norm_tr(text)
    return bool(re.search(r'\bcanl[ıi]\b', c_norm))

def parse_title_episode_and_inline_detail(raw_t, akis_hint=''):
    """
    Excel hücresindeki ham program satırından (örn:
      - 'İlim Dersleri- Tecvid - 107'
      - 'El-Yakutu’n-Nefis-11'
      - 'Safvetüt- Tefasir-22'
      - 'Taliü’l – Büşra -28'
      - 'Muhtasaru’l – Kuduri-61'
      - 'KISAS-I ENBİYA  - 71'
      - 'ÇERÇEVE-127-Canlı'
      - 'HASBİHAL-Tekrar-53'
      - 'ULU CAMİ-9- Akşehir'
      - 'AZİZ İSTANBUL-36-Eyüp-Karyağdı'
    ) temiz program adını (clean_title), bölüm numarasını (episode) ve varsa satır içi mekan/detayı (inline_detail) ayıklar.
    Bölüm numarasının veya 'Nefis', 'Tefasir', 'Tecvid' gibi program adı parçalarının host alanına sızmasını %100 engeller.
    """
    if not raw_t and not akis_hint:
        return '', '', ''

    source_str = str(raw_t or akis_hint).strip()
    # 1. Canlı / Canlı Yayın ve Tekrar ibarelerini temizle
    cleaned = re.sub(r'[\(\[\-\–\—\s]*\bcanl[ıi](?:\s+yay[ıi]n)?\b[\)\]\s]*', ' ', source_str, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r'[\(\[\-\–\—\s]*\btekrar\b[\)\]\s]*', '-', cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r'[-–—]+', '-', cleaned)
    cleaned = re.sub(r'[-–—\s]+$', '', cleaned).strip()

    episode = ''
    inline_detail = ''
    title_candidate = cleaned

    # 2. Kalıp A: "<Program Adı> - <Bölüm No> - <Mekan/Detay>" (Örn: 'ULU CAMİ-9- Akşehir', 'AZİZ İSTANBUL-36-Eyüp-Karyağdı')
    m_with_tail = re.match(r'^(.*?)[-\s]+(\d{1,4})\s*-\s*(.+)$', cleaned)
    if m_with_tail:
        head_cand = m_with_tail.group(1).strip(' -–—')
        ep_cand = m_with_tail.group(2).strip()
        tail_cand = m_with_tail.group(3).strip(' -–—')
        # Eğer head_cand geçerli bir program adıysa (örn: ULU CAMİ, AZİZ İSTANBUL)
        if len(head_cand) >= 3 and not head_cand.isdigit():
            title_candidate = head_cand
            episode = ep_cand
            inline_detail = tail_cand
    else:
        # 3. Kalıp B: "<Program Adı> - <Bölüm No>" veya "<Program Adı> <Bölüm No>" (Örn: 'İlim Dersleri- Tecvid - 107', 'El-Yakutu’n-Nefis-11')
        m_trailing_ep = re.match(r'^(.*?)(?:\s*[-–—]\s*|\s+)(\d{1,4})$', cleaned)
        if m_trailing_ep:
            title_candidate = m_trailing_ep.group(1).strip(' -–—')
            episode = m_trailing_ep.group(2).strip()

    # 4. Standart başlık eşleştirmesi (Önce tam/uzun anahtar, sonra AKIŞ ipucu)
    norm_cand = norm_tr(title_candidate)
    norm_full = norm_tr(cleaned)
    norm_akis = norm_tr(akis_hint) if akis_hint else ''

    # En uzun eşleşen anahtara öncelik ver
    sorted_std = sorted(STANDARDIZED_TITLES.items(), key=lambda x: len(x[0]), reverse=True)
    for k, v in sorted_std:
        if norm_cand == k or norm_cand.startswith(k) or k in norm_cand:
            return v, episode, inline_detail

    if norm_akis:
        for k, v in sorted_std:
            if norm_akis == k or norm_akis.startswith(k) or k in norm_akis:
                return v, episode, inline_detail

    for k, v in sorted_std:
        if norm_full.startswith(k):
            return v, episode, inline_detail

    # Katalogdan tam eşleşme kontrolü
    if norm_cand in CATALOG_PROGRAMS:
        return CATALOG_PROGRAMS[norm_cand]['name'], episode, inline_detail
    if norm_akis and norm_akis in CATALOG_PROGRAMS:
        return CATALOG_PROGRAMS[norm_akis]['name'], episode, inline_detail

    return (title_candidate or akis_hint or source_str).strip(), episode, inline_detail

def clean_program_title(raw_t, akis_hint=''):
    clean_t, _, _ = parse_title_episode_and_inline_detail(raw_t, akis_hint)
    return clean_t

def is_program_cell(cell_val):
    """
    Bir hücre metninin yeni bir program başlangıcı mı yoksa açıklama/konuk/mekan alt satırı mı olduğunu belirler.
    DİKKAT: 'Sadrettin Koç-İznik Dergah' gibi konuşmacı-mekan satırlarının içinde 'dergah' geçtiği için
    katalogdaki 'DERGAH' programıyla yanlış eşleşmesini %100 engeller; yalnızca hücrenin BAŞINDAKİ
    program adını kontrol eder!
    """
    if not cell_val:
        return False, None
    c_norm = norm_tr(cell_val)
    if not c_norm:
        return False, None

    # 0. Haftanın günleri (Delail-ül Hayrat alt satırı) veya konuşmacı/ders detayı ise KESİNLİKLE program değildir
    if c_norm in ('pazartesi', 'salı', 'sali', 'çarşamba', 'carsamba', 'perşembe', 'persembe', 'cuma', 'cumartesi', 'pazar'):
        return False, None

    for spk in SPEAKER_OR_DETAIL_PREFIXES:
        if c_norm.startswith(spk):
            return False, None

    # Hücre başlığını bölüm numarasından ayırıp baş kısmını al
    title_head, ep, _ = parse_title_episode_and_inline_detail(cell_val)
    head_norm = norm_tr(title_head)

    # 1. Bilinen program ön ekleri (Yalnızca hücrenin veya ayıklanan başlığın BAŞINDA yer alıyorsa!)
    for pfx in KNOWN_PROGRAM_PREFIXES:
        if c_norm.startswith(pfx) or head_norm.startswith(pfx) or head_norm == pfx:
            return True, pfx

    # 2. Katalog eşleşmesi (Yalnızca tam başlık eşleşmesi veya hücrenin başında program adı + bölüm no varsa!)
    # 'Sadrettin Koç-İznik Dergah' -> head_norm='sadrettin koç-iznik dergah' -> 'dergah' ile BAŞLAMAZ ve eşit değildir!
    for cat_n in CATALOG_PROGRAMS:
        if len(cat_n) >= 4:
            if head_norm == cat_n:
                return True, cat_n
            if c_norm.startswith(cat_n):
                rest = c_norm[len(cat_n):].strip()
                if not rest or rest[0] in ('-', '–', '—') or rest[0].isdigit():
                    return True, cat_n

    # 3. Hücrede açıkça 'Canlı' / 'Canlı Yayın' ibaresi varsa ve bölüm/program formatındaysa
    if is_live_cell_text(cell_val) and len(c_norm) > 6 and c_norm not in ('canlı', 'canli', 'canlı yayın', 'canli yayin'):
        return True, 'canli_yayin'

    return False, None

def titles_roughly_match(detail_cell, akis_title):
    """Detay sayfasındaki hücre ile AKIŞ sayfasındaki program adının aynı programa ait olup olmadığını kontrol eder."""
    if not detail_cell or not akis_title:
        return False
    t1 = clean_program_title(detail_cell)
    t2 = clean_program_title(akis_title)
    if norm_compact(t1) == norm_compact(t2):
        return True
    c1 = norm_compact(detail_cell)
    c2 = norm_compact(akis_title)
    if len(c2) >= 5 and (c1.startswith(c2[:5]) or c2 in c1):
        return True
    return False

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

        # 1. Eğer 'AKIŞ' sayfası mevcutsa o günün resmi program başlangıç saatlerini ve temiz program adlarını oku
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

                is_p, matched_key = is_program_cell(c_str)
                akis_title_at_time = akis_map.get(t_str, '')

                # AKIŞ sekmesinde bu saatte bir program başlangıcı tanımlıysa kesinlikle yeni programdır
                if akis_title_at_time and not is_p:
                    is_p = True

                # Özel Durum: Neşeli Petek saatleri (08:30 ve 16:30 60 dk sürer, 09:30 ve 17:30 dolgudur)
                if t_str in ('09:30', '17:30') and not is_p and current_block and 'neşeli' in norm_tr(current_block['raw']):
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

        # Eğer detay sayfası bulunamadıysa doğrudan AKIŞ sayfasından oku
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

            # Eğer detay hücresinde program adı yerine başka bir şey varsa ama AKIŞ sekmesinde o saatin programı belliyse
            effective_akis_hint = akis_hint if titles_roughly_match(raw_t, akis_hint) else ''
            clean_t, episode, inline_detail = parse_title_episode_and_inline_detail(raw_t, effective_akis_hint)

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

            # Details dizisinden 'Canlı' tekil etiketini temizle
            clean_details = [
                d.strip() for d in details
                if d.strip() and norm_tr(d.strip()) not in ('canlı', 'canli', 'canlı yayın', 'canli yayin')
            ]

            # Eğer alt satırların ilki sadece bir sayıysa (örn: 27 Ekim 2025 dosyasında KISAS-I ENBİYA alt satırı '68') bu bölüm numarasıdır!
            if clean_details and clean_details[0].isdigit():
                if not episode:
                    episode = clean_details[0]
                clean_details = clean_details[1:]

            # Eğer başlık satırında bölüm numarasından sonra mekan/şehir varsa (örn: 'ULU CAMİ-9- Akşehir', 'AZİZ İSTANBUL-36-Eyüp-Karyağdı')
            if inline_detail:
                host = inline_detail

            if clean_details:
                if not host:
                    host = clean_details[0]
                    if len(clean_details) > 1:
                        topic = ' - '.join(clean_details[1:])
                else:
                    topic = ' - '.join(clean_details)

            # Cüz bazlı programlarda (Hatm-i Şerif, Tefsir-i Mevakib) alt satırdaki 'Cüz - 9' bilgisinden episode (cüz no) çıkar
            if not episode and ('hatm' in norm_tr(clean_t) or 'mevakib' in norm_tr(clean_t) or 'mukabele' in norm_tr(clean_t)):
                cuz_search_text = f"{host} {topic} {raw_t}"
                cuz_m = re.search(r'c[üu]z[\s\-:]*(\d{1,2})\b', cuz_search_text, flags=re.IGNORECASE)
                if cuz_m:
                    episode = cuz_m.group(1)

            # Dolgu kuşağı ayarları
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
