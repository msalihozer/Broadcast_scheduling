"""
draft_excel_parser.py - Haftalık Taslak Akış Excel Ayrıştırıcısı (Katalog Entegreli)

Bu script '31 AĞUSTOS-6 EYLÜL 2026 AKIŞ.xlsx' ve benzeri haftalık yayın akışı
Excel dosyalarını okur, '&-PROGRAM KATEGORİLERİ- 2026- MART.xls' kataloğundaki
bilgilerle programları hatasız tanır ve 7 günlük 24 saatlik (1440 dk) eksiksiz
akış yapısını JSON formatına dönüştürür.
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
    s = s.replace('İ', 'i').replace('I', 'ı').replace('–', '-').replace('—', '-')
    return s.lower().strip()

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
    'ilim dersleri-tecvid': 'İlim Dersleri- TECVİD',
    'tecvid': 'İlim Dersleri- TECVİD',
    'ilim dersleri': 'İlim Dersleri- TECVİD',
    'hatm-i şerif': 'HATM-İ ŞERİF',
    'hatm-i serif': 'HATM-İ ŞERİF',
    'tefsir-i mevakib': 'TEFSİR-İ MEVAKİB',
    'delail-ül hayrat': 'DELAİL-ÜL HAYRAT',
    'delail-ul hayrat': 'DELAİL-ÜL HAYRAT',
    'neşeli petek': 'NEŞELİ PETEK',
    'neseli petek': 'NEŞELİ PETEK',
    'semerkand sohbetleri': 'SEMERKAND SOHBETLERİ',
    'semerkand sohbet': 'SEMERKAND SOHBETLERİ',
    'hasbihal': 'HASBİHAL',
    'beş vakit bir şehir': 'BEŞ VAKİT BİR ŞEHİR',
    'bes vakit bir sehir': 'BEŞ VAKİT BİR ŞEHİR',
    'yüzyılın alimleri': 'YÜZYILIN ALİMLERİ',
    'yuzyilin alimleri': 'YÜZYILIN ALİMLERİ',
    'kısas-ı enbiya': 'KISAS-I ENBİYA',
    'kisas-i enbiya': 'KISAS-I ENBİYA',
    'hacegan sohbetleri': 'HACEGAN SOHBETLERİ',
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
    'taliü’l – büşra': 'Taliü’l – Büşra',
    'taliu': 'Taliü’l – Büşra',
    'muhtasaru’l – kuduri': 'Muhtasaru’l – Kuduri',
    'muhtasaru': 'Muhtasaru’l – Kuduri',
    'el-yakutu’n-nefis': 'El-Yakutu’n-Nefis',
    'safvetüt- tefasir': 'Safvetüt- Tefasir',
    'safvetut': 'Safvetüt- Tefasir',
    'riyazüs – salihin': 'Riyazüs – Salihin',
    'riyazus': 'Riyazüs – Salihin',
    'minhâcü’s senî': 'Minhâcü’s Senî',
    'minhacu': 'Minhâcü’s Senî',
    'hac rehberi': 'Hac Rehberi'
}

KNOWN_PROGRAM_PREFIXES = [
    'ilim dersleri', 'kisas-i enbiya', 'kısas-ı enbiya', 'cerceve', 'çerçeve',
    'hasbihal', 'bes vakit', 'beş vakit', 'yuzyilin alimleri', 'yüzyılın alimleri',
    'bedesten', 'semerkand sohbet', 'hacegan sohbet', 'hacegan', 'ulu cami',
    'mesneviden dersler', 'mesneviden', 'hattin izinde', 'hattın izinde',
    'son inci', 'taliu', 'taliü', 'muhtasaru', 'el-yakutu', 'safvetut', 'safvetüt',
    'riyazus', 'riyazüs', 'minhacu', 'minhâcü', 'hac rehberi', 'delail', 'hatm-i serif',
    'hatm-i şerif', 'tefsir-i mevakib', 'neseli petek', 'neşeli petek', 'guzergah', 'güzergah',
    'aziz istanbul', 'kasideler', 'kısa prog', 'kisa prog', 'dolgu'
]

CATEGORY_RULES = [
    {
        'category': 'Dini / İlim',
        'color': '#10b981',
        'badge': 'İlim',
        'keywords': ['hatm', 'tefsir', 'tecvid', 'delail', 'kuduri', 'yakut', 'safvet', 'ilmihal', 'ilim', 'son inci', 'hac rehber']
    },
    {
        'category': 'Sohbet / Tasavvuf',
        'color': '#8b5cf6',
        'badge': 'Sohbet',
        'keywords': ['semerkand sohbet', 'hasbihal', 'hacegan', 'mesnevi', 'sohbet', 'minhâcü', 'minhacu', 'riyazüs', 'riyazus', 'taliü', 'taliu']
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
    
    # 1. Önce katalogdan kontrol et
    if t_norm in CATALOG_PROGRAMS:
        p_info = CATALOG_PROGRAMS[t_norm]
        cat = p_info.get('category', 'Genel Yayın')
        # Kategori renklendirmesi
        for r in CATEGORY_RULES:
            if r['category'].lower() in cat.lower():
                return r['category'], r['color'], r['badge']
        return cat, '#3b82f6', cat[:5]
        
    # 2. Anahtar kelimelerden kontrol et
    for rule in CATEGORY_RULES:
        for kw in rule['keywords']:
            if kw in t_norm:
                return rule['category'], rule['color'], rule['badge']
                
    return 'Genel Yayın', '#6b7280', 'Genel'

def is_live_cell_text(text):
    """Metinde 'Canlı' / 'Canlı Yayın' ibaresi olup olmadığını kontrol eder."""
    if not text:
        return False
    c_norm = norm_tr(text)
    return bool(re.search(r'\bcanl[ıi]\b', c_norm))

def clean_program_title(raw_t):
    if not raw_t:
        return ''
    # Önce 'Canlı Yayın' / 'Canlı' ibarelerini temizle
    stripped_raw = re.sub(r'[\(\[\-\–\—\s]*\bcanl[ıi](?:\s+yay[ıi]n)?\b[\)\]\s]*', ' ', str(raw_t), flags=re.IGNORECASE).strip()
    stripped_raw = re.sub(r'[-–—\s]+$', '', stripped_raw).strip()
    norm = norm_tr(stripped_raw).strip()
    
    # Standart sözlük kontrolü
    for k, v in STANDARDIZED_TITLES.items():
        if k in norm:
            return v
            
    # Tire varsa ilk kısmı al (Örn: 'BEDESTEN - 1' -> 'BEDESTEN' veya 'ÖZEL PROGRAM - 12 - Canlı' -> 'ÖZEL PROGRAM')
    if '-' in stripped_raw:
        parts = [p.strip() for p in stripped_raw.split('-') if p.strip()]
        if parts:
            head = parts[0].strip()
            head_norm = norm_tr(head)
            for k, v in STANDARDIZED_TITLES.items():
                if k in head_norm:
                    return v
            return head
        
    # Sondaki bölüm numarasını temizle (Örn: 'Çerçeve 122' -> 'Çerçeve')
    stripped_no_ep = re.sub(r'\s+\d+$', '', stripped_raw).strip()
    return stripped_no_ep or raw_t.strip()

def is_program_cell(cell_val):
    """Bir hücre metninin yeni bir program başlangıcı mı yoksa açıklama/konuk mu olduğunu belirler."""
    if not cell_val:
        return False, None
    c_norm = norm_tr(cell_val)
    
    # Bilinen ön ekler
    for pfx in KNOWN_PROGRAM_PREFIXES:
        if c_norm.startswith(pfx) or pfx in c_norm:
            return True, pfx
            
    # Katalog eşleşmesi
    for cat_n in CATALOG_PROGRAMS:
        if len(cat_n) >= 4 and (c_norm.startswith(cat_n) or cat_n in c_norm):
            return True, cat_n

    # Hücrede 'Canlı' / 'Canlı Yayın' ibaresi varsa katalogda olmasa bile yeni bir canlı yayın programıdır
    if is_live_cell_text(cell_val):
        return True, 'canli_yayin'
            
    return False, None

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
        elif any(char.isdigit() for char in sname) and ('ekim' in norm or 'eylül' in norm or 'ağustos' in norm or 'kasım' in norm or 'mart' in norm or '-' in sname):
            ws_detail = wb[sname]
            
    if ws_detail is None and len(wb.sheetnames) > 0:
        ws_detail = wb.sheetnames[0]
        if isinstance(ws_detail, str):
            ws_detail = wb[ws_detail]
            
    if ws_akis is None and len(wb.sheetnames) > 1:
        ws_akis = wb.sheetnames[1]
        if isinstance(ws_akis, str):
            ws_akis = wb[ws_akis]

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
            '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03',
            '2026-09-04', '2026-09-05', '2026-09-06'
        ]

    result = {}

    # Her gün için detay matrisinden programları tam zamanlı (30 dk slot) oku
    for d_idx, date_key in enumerate(days_dates):
        day_name = DAY_NAMES[d_idx]
        try:
            dt_obj = datetime.datetime.strptime(date_key, '%Y-%m-%d')
            formatted_date = f"{dt_obj.day} {TURKISH_MONTHS.get(dt_obj.month, '')} {dt_obj.year}"
        except:
            formatted_date = date_key

        col_idx = d_idx + 2
        raw_program_blocks = []
        current_block = None

        if ws_detail:
            for r in range(3, ws_detail.max_row + 1):
                t_val = ws_detail.cell(r, 1).value
                t_str = extract_time_str(t_val)
                c_val = ws_detail.cell(r, col_idx).value
                c_str = str(c_val).strip() if c_val else ''

                # Geçerli saat yoksa (özet, istatistik veya boş satırlar) program başlatılamaz
                if not t_str:
                    continue

                is_p, matched_key = is_program_cell(c_str)

                # Özel Durum: Neşeli Petek saatleri (08:30 ve 16:30 60 dk sürer, 09:30 ve 17:30 dolgudur)
                if t_str == '09:30' and not is_p and current_block and 'neşeli' in norm_tr(current_block['raw']):
                    is_p = True
                    c_str = 'Kasideler + Aşr-ı Şerifler'

                if t_str == '17:30' and not is_p and current_block and 'neşeli' in norm_tr(current_block['raw']):
                    is_p = True
                    c_str = 'Kasideler + Aşr-ı Şerifler'

                # Özel Durum: Gece son dilim (23:30)
                if t_str == '23:30' and c_str and not is_p:
                    # 23:00'da başlayan 60 veya 120 dk'lık programların alt satırı (23:30) konuşmacı/detaydır
                    SIXTY_MIN_LATE_PROGRAMS = ['hacegan', 'güzergah', 'guzergah', 'bedesten', 'semerkand sohbet', 'hasbihal', 'kısas', 'kisas', 'çerçeve', 'cerceve']
                    is_current_60min = current_block and any(k in norm_tr(current_block['raw']) for k in SIXTY_MIN_LATE_PROGRAMS)
                    if not is_current_60min:
                        is_p = True

                if is_p:
                    if current_block:
                        current_block['endTime'] = t_str
                        raw_program_blocks.append(current_block)
                    current_block = {
                        'startTime': t_str,
                        'raw': c_str,
                        'details': []
                    }
                elif c_str and current_block:
                    current_block['details'].append(c_str)

            if current_block:
                current_block['endTime'] = '24:00'
                raw_program_blocks.append(current_block)

        # Eğer detay sayfası bulunamadıysa akış sayfasından oku
        if not raw_program_blocks and ws_akis:
            t_col = d_idx * 2 + 1
            p_col = d_idx * 2 + 2
            raw_slots = []
            for r in range(3, ws_akis.max_row + 1):
                t = ws_akis.cell(r, t_col).value
                p = ws_akis.cell(r, p_col).value
                t_str = extract_time_str(t)
                p_str = str(p).strip() if p else ''
                if t_str and p_str:
                    raw_slots.append((t_str, p_str))

            for i, (st, ptitle) in enumerate(raw_slots):
                next_st = raw_slots[i+1][0] if i+1 < len(raw_slots) else "24:00"
                raw_program_blocks.append({
                    'startTime': st,
                    'endTime': next_st,
                    'raw': ptitle,
                    'details': []
                })

        # Program bloklarını zenginleştir ve dönüştür
        progs = []
        for blk in raw_program_blocks:
            st = blk['startTime']
            et = blk['endTime']
            raw_t = blk['raw']
            details = blk['details']
            
            clean_t = clean_program_title(raw_t)
            is_kisa = ('dolgu' in norm_tr(clean_t) or 
                       'kısa prog' in norm_tr(clean_t) or 
                       'kasideler' in norm_tr(clean_t) or 
                       'kaside' in norm_tr(clean_t) or 
                       'aşr-ı şerif' in norm_tr(clean_t))

            is_live = is_live_cell_text(raw_t) or any(is_live_cell_text(d) for d in details)

            episode = ''
            host = ''
            topic = ''

            # Başlıktan Canlı / Canlı Yayın ibaresini arındırıp bölüm no ve ek bilgileri ayıkla
            raw_without_live = re.sub(r'[\(\[\-\–\—\s]*\bcanl[ıi](?:\s+yay[ıi]n)?\b[\)\]\s]*', ' ', str(raw_t), flags=re.IGNORECASE).strip()
            if '-' in raw_without_live:
                parts = [p.strip() for p in raw_without_live.split('-') if p.strip() and not is_live_cell_text(p)]
                if len(parts) >= 2 and parts[1].isdigit():
                    episode = parts[1]
                if len(parts) >= 3:
                    host = parts[2]

            # Regex ile bölüm ara
            if not episode:
                ep_m = re.search(r'(?:[-–]|\b)\s*(\d+)\b', raw_without_live)
                if ep_m:
                    episode = ep_m.group(1)

            # Details dizisinden 'Canlı' tekil etiketini temizle, sunucu, konuk ve konu bilgilerini al
            clean_details = [d.strip() for d in details if d.strip() and norm_tr(d.strip()) not in ('canlı', 'canli', 'canlı yayın', 'canli yayin')]
            if clean_details:
                if not host:
                    host = clean_details[0]
                if len(clean_details) > 1:
                    topic = ' - '.join(clean_details[1:])
                elif not topic and len(clean_details) == 1:
                    if '-' in clean_details[0] and not host:
                        host = clean_details[0]

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
            if channel_name == 'ch_hd':
                with open(os.path.join('src', 'data', 'defaultWeeklySchedule.json'), 'w', encoding='utf-8') as f:
                    json.dump(schedule, f, ensure_ascii=False, indent=2)
        
        print(json.dumps(schedule, ensure_ascii=False))
            
    except Exception as e:
        import traceback
        err_msg = f"{str(e)}\n{traceback.format_exc()}"
        print(json.dumps({'error': err_msg}), file=sys.stderr)
        sys.exit(1)
