"""
extract_program_catalog.py - Program Kategorileri Excel Okuyucu, Tarih Temizleyici ve Tekilleştirici

Bu script 'yayinplanlama/&-PROGRAM KATEGORİLERİ- 2026- MART.xls' dosyasındaki programları
okur, isimlerin yanındaki tarih/yıl/sezon ibarelerini temizler, mükerrer kayıtları ve sayfaları tekilleştirir,
bölüm sayılarını birleştirir ve hem src/data hem de backend dizinlerine standart JSON olarak kaydeder.
"""
import sys
import os
import io
import json
import re
import xlrd

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# MAM Resmi Kategorileri
MSSQL_CATEGORIES = {
    1: { 'category': 'Kadın', 'color': '#ec4899', 'badge': 'Kadın', 'id': 1 },
    2: { 'category': 'Haber', 'color': '#ef4444', 'badge': 'Haber', 'id': 2 },
    3: { 'category': 'Tanıtım', 'color': '#14b8a6', 'badge': 'Tanıtım', 'id': 3 },
    4: { 'category': 'Dini', 'color': '#10b981', 'badge': 'Dini', 'id': 4 },
    5: { 'category': 'Çocuk', 'color': '#f59e0b', 'badge': 'Çocuk', 'id': 5 },
    6: { 'category': 'Reklam', 'color': '#eab308', 'badge': 'Reklam', 'id': 6 },
    7: { 'category': 'Jenerik', 'color': '#6366f1', 'badge': 'Jenerik', 'id': 7 },
    8: { 'category': 'Kültürel', 'color': '#3b82f6', 'badge': 'Kültür', 'id': 8 },
    9: { 'category': 'Detay', 'color': '#8b5cf6', 'badge': 'Detay', 'id': 9 },
    10: { 'category': 'Kısa Program', 'color': '#06b6d4', 'badge': 'Kısa', 'id': 10 },
    11: { 'category': 'Ham', 'color': '#64748b', 'badge': 'Ham', 'id': 11 }
}

def norm_str(s):
    return str(s).lower().replace('ı', 'i').replace('i̇', 'i').replace('İ', 'i').replace('I', 'i').replace('ç', 'c').replace('ş', 's').replace('ğ', 'g').replace('ü', 'u').replace('ö', 'o')

def normalize_key(name):
    """Program isimlerini karşılaştırmak için Türkçe karakter toleranslı anahtar üretir."""
    s = name.upper().replace('İ', 'I').replace('ı', 'I').replace('Ş', 'S').replace('Ğ', 'G').replace('Ü', 'U').replace('Ö', 'O').replace('Ç', 'C')
    return re.sub(r'[^A-Z0-9]', '', s)

def clean_program_name(name):
    """Program isimlerindeki tarih, yıl aralığı, sezon ve gereksiz ekleri temizler."""
    name = re.sub(r'[-–—\s]*\b\d{1,2}\s+(?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)(?:\s*(?:[-–—\s/]*\d{2,4}))?[-–—\s]*', ' ', name, flags=re.IGNORECASE)
    name = re.sub(r'[-–—\s/]+(?:19\d\d|20\d\d|101[5-9])(?:[-–—/]\d{2,4})*(?:[-–—/]\d{2,4})*', ' ', name)
    name = re.sub(r'\b(?:19\d\d|20\d\d)\b', ' ', name)
    name = re.sub(r'[-–—\s]+WAY\b', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\bWAY[-–—\s]+', '', name, flags=re.IGNORECASE)
    name = re.sub(r'[-–—\s]+Yeni(?=[-–—\s]|$)', '', name, flags=re.IGNORECASE)
    name = re.sub(r'[-–—\s]+(?:\d+\.\s*)?Sezon(?:\s*[-–—]\s*\d+)?', '', name, flags=re.IGNORECASE)
    if len(name) > 4:
        name = re.sub(r'[-–—\s]+(?:[1-9]|10)\b$', '', name)
    name = re.sub(r'[-–—\s]+$', '', name)
    name = re.sub(r'^[-–—\s]+', '', name)
    name = re.sub(r'\s*[-–—]\s*$', '', name)
    name = re.sub(r'\s+', ' ', name)
    return name.strip()

def get_category_meta(raw_cat, sheet_name):
    r_norm = norm_str(raw_cat)
    s_norm = norm_str(sheet_name)
    
    if 'kisa' in s_norm or 'kisa' in r_norm:
        return 'Kısa Program', '#06b6d4', 'Kısa', 10
    if 'cocuk' in r_norm:
        return 'Çocuk', '#f59e0b', 'Çocuk', 5
    if 'kadin' in r_norm:
        return 'Kadın', '#ec4899', 'Kadın', 1
    if 'cocuk' in s_norm:
        return 'Çocuk', '#f59e0b', 'Çocuk', 5
    if 'kadin' in s_norm:
        return 'Kadın', '#ec4899', 'Kadın', 1
    if 'haber' in r_norm or 'haber' in s_norm:
        return 'Haber', '#ef4444', 'Haber', 2
    if 'tanitim' in r_norm or 'fragman' in r_norm:
        return 'Tanıtım', '#14b8a6', 'Tanıtım', 3
    if 'reklam' in r_norm:
        return 'Reklam', '#eab308', 'Reklam', 6
    if 'jenerik' in r_norm:
        return 'Jenerik', '#6366f1', 'Jenerik', 7
    if 'kultur' in s_norm or 'dizi' in s_norm or 'kultur' in r_norm or 'dizi' in r_norm or 'drama' in r_norm or 'sit-com' in r_norm:
        return 'Kültürel', '#3b82f6', 'Kültür', 8
    if 'dini' in s_norm or 'dini' in r_norm or 'ilim' in r_norm or 'sohbet' in r_norm or 'tasavvuf' in r_norm:
        return 'Dini', '#10b981', 'Dini', 4

    return 'Dini', '#10b981', 'Dini', 4

def extract_catalog(excel_path=None):
    if not excel_path:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        excel_path = os.path.join(base_dir, 'yayinplanlama', '&-PROGRAM KATEGORİLERİ- 2026- MART.xls')
        
    if not os.path.exists(excel_path):
        yayin_dir = os.path.dirname(excel_path)
        for f in os.listdir(yayin_dir):
            if 'KATEGOR' in f.upper() and f.endswith('.xls'):
                excel_path = os.path.join(yayin_dir, f)
                break

    if not os.path.exists(excel_path):
        raise FileNotFoundError(f"Program kategorileri dosyası bulunamadı: {excel_path}")

    wb = xlrd.open_workbook(excel_path)
    raw_items = []
    
    # KADIN-24 ve DİZİ-24 sayfaları ÇOCUK ve KADIN / KÜLTÜR ve DİZİ sayfalarının kopyalarıdır, mükerrerlik olmaması için atlanıyor
    skipped_sheets = ['ÖZET-2026', 'GENEL', 'KADIN-24', 'DİZİ-24']

    for sname in wb.sheet_names():
        if sname in skipped_sheets:
            continue
            
        sh = wb.sheet_by_name(sname)
        start_row = 1
        
        for r in range(start_row, sh.nrows):
            vals = [sh.cell_value(r, c) for c in range(sh.ncols)]
            if not any(vals):
                continue
                
            raw_cat = ''
            p_name = ''
            episodes = 0
            presenter = ''
            
            if sname == 'KULLANILAN':
                p_name = str(vals[0]).strip()
                episodes = vals[2] if len(vals) > 2 and vals[2] != '' else (vals[1] if len(vals) > 1 else 0)
                raw_cat = 'Kullanılan'
            elif sname == 'KISA PROGRAMLAR':
                raw_cat = str(vals[1]).strip() if len(vals) > 1 else 'Kısa'
                p_name = str(vals[2]).strip() if len(vals) > 2 else ''
                episodes = vals[3] if len(vals) > 3 else 0
                presenter = str(vals[4]).strip() if len(vals) > 4 else ''
            else:
                raw_cat = str(vals[0]).strip() if len(vals) > 0 else ''
                p_name = str(vals[1]).strip() if len(vals) > 1 else ''
                episodes = vals[2] if len(vals) > 2 else 0
                presenter = str(vals[3]).strip() if len(vals) > 3 else ''
                
            if not p_name or p_name.lower().strip() in ['toplam', 'bölüm', 'program adı', 'program']:
                continue
                
            try:
                episodes = int(float(episodes))
            except:
                episodes = 0

            raw_items.append({
                'name': p_name.strip(),
                'rawCategory': raw_cat,
                'episodes': episodes,
                'presenter': presenter.strip() if presenter else '',
                'sheet': sname
            })

    # --- TEKİLLEŞTİRME VE TARİH TEMİZLİĞİ ---
    grouped = {}
    for item in raw_items:
        cname = clean_program_name(item['name'])
        key = normalize_key(cname)
        if not key:
            continue
            
        cat, color, badge, cat_id = get_category_meta(item['rawCategory'], item['sheet'])
        
        if key not in grouped:
            grouped[key] = {
                'name': cname,
                'category': cat,
                'categoryId': cat_id,
                'categoryColor': color,
                'categoryBadge': badge,
                'episodes': 0,
                'presenters': [],
                'sheets': [],
                'rawCategory': item['rawCategory'],
                'seen_tuples': set()
            }
        
        g = grouped[key]
        
        # Mükerrer satırları filtrele (aynı sayfa, aynı isim ve bölüm sayısı)
        dedup_tuple = (item['sheet'], item['name'], item['episodes'])
        if dedup_tuple not in g['seen_tuples']:
            g['seen_tuples'].add(dedup_tuple)
            g['episodes'] += item['episodes']

        if item['presenter'] and item['presenter'] not in g['presenters']:
            g['presenters'].append(item['presenter'])
            
        if item['sheet'] not in g['sheets']:
            g['sheets'].append(item['sheet'])

    # Sıralı ve formatlanmış program listesi
    programs = []
    category_counts = {}
    total_episodes = 0
    
    # İsim sırasına göre düzenle
    sorted_items = sorted(grouped.values(), key=lambda x: x['name'])
    
    for idx, g in enumerate(sorted_items):
        total_episodes += g['episodes']
        category_counts[g['category']] = category_counts.get(g['category'], 0) + 1
        
        presenter_str = ', '.join(g['presenters']) if g['presenters'] else ''
        sheet_str = ', '.join(g['sheets']) if g['sheets'] else 'Arşiv'

        programs.append({
            'id': f"cat_prog_{idx+1:04d}",
            'name': g['name'],
            'categoryId': g['categoryId'],
            'category': g['category'],
            'categoryColor': g['categoryColor'],
            'categoryBadge': g['categoryBadge'],
            'episodes': g['episodes'],
            'presenter': presenter_str,
            'sheet': sheet_str,
            'rawCategory': g['rawCategory']
        })

    catalog_data = {
        'totalCount': len(programs),
        'totalEpisodes': total_episodes,
        'categoryCounts': category_counts,
        'sourceFile': os.path.basename(excel_path),
        'updatedAt': '2026-10-27T06:00:00Z',
        'programs': programs
    }

    # src/data ve backend dizinlerine kaydet
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_paths = [
        os.path.join(base_dir, 'src', 'data', 'program_categories_catalog.json'),
        os.path.join(base_dir, 'backend', 'program_categories_catalog.json')
    ]

    for p in target_paths:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(catalog_data, f, ensure_ascii=False, indent=2)

    print(f"Katalog başarıyla güncellendi: {len(programs)} tekil program, {total_episodes} toplam arşiv bölümü.")
    return catalog_data

if __name__ == '__main__':
    extract_catalog()
