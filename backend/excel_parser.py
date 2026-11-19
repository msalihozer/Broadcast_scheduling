"""
excel_parser.py - Semerkand Medya Haftalık Yayın Akışı Excel Ayrıştırıcısı

Bu script, yayın planlama departmanı tarafından hazırlanan standart 5'er dakikalık
haftalık Excel akış şablonlarını (örn: '5 dk.lık akış.xlsx') okur, slotları,
program bloklarını ve reklam kuşaklarını JSON veri formatına dönüştürür.

Kullanım:
    python backend/excel_parser.py <dosya_yolu>
"""
import openpyxl
import datetime
import json
import re
import sys

def parse_excel(file_path):
    wb = openpyxl.load_workbook(file_path, data_only=True)
    sheet = wb.active
    rows = list(sheet.iter_rows(values_only=True))

    # Days are in Row 2, columns index 1 to 7
    days = []
    for col_idx in range(1, 8):
        val = rows[1][col_idx]
        if isinstance(val, datetime.datetime):
            days.append(val.strftime("%Y-%m-%d"))
        else:
            days.append(str(val))

    def format_time(val):
        if isinstance(val, datetime.time):
            return val.strftime("%H:%M")
        elif isinstance(val, datetime.datetime):
            return val.strftime("%H:%M")
        return str(val)

    weekly_flow = {}
    labels_to_skip = {"okuyan", "ses", "cüz", "cuz"}

    for day_idx, day_date in enumerate(days, 1):
        day_slots = []
        current_block = None

        for r_idx in range(2, len(rows)):
            row = rows[r_idx]
            t_val = row[0]
            if t_val is None:
                continue
            t_str = format_time(t_val)
            val = row[day_idx]
            note = row[9]

            # Clean value
            if val is not None:
                val_str = str(val).strip()
                if val_str.lower() == "none" or val_str == "":
                    val = None

            # Check if value is a time separator (e.g., cell has the time value matching the slot)
            is_time_separator = False
            if val is not None:
                if isinstance(val, (datetime.time, datetime.datetime)):
                    is_time_separator = True
                elif re.match(r'^\d{2}:\d{2}(:\d{2})?$', str(val)):
                    is_time_separator = True

            # Check if it is a Reklam
            is_reklam = False
            if val is not None and not is_time_separator:
                if "reklam" in str(val).lower():
                    is_reklam = True
            if note is not None and "reklam" in str(note).lower():
                is_reklam = True

            # A new block starts if:
            # 1. We hit a Reklam
            # 2. We hit a time separator (this starts an empty slot block)
            # 3. We are in a slot immediately after a separator/reklam, and have a new program name.
            # Let's simplify: A new program starts if the cell has a name, and it is not a skip label, and not a number.
            is_new_program = False
            if val is not None and not is_time_separator and not is_reklam:
                val_lower = str(val).lower()
                if val_lower not in labels_to_skip and not re.match(r'^\d+$', str(val)):
                    # Check if previous slot was a separator or reklam, or if we didn't have a program.
                    # Or we just assume any new text that isn't a presenter name starts a program.
                    # To be safe, if we don't have an active program block or if this slot is a ':05' or ':35' slot:
                    is_new_program = True

            if is_time_separator:
                if current_block:
                    day_slots.append(current_block)
                current_block = {
                    "time": t_str,
                    "type": "empty",
                    "duration": 5,
                    "slots_count": 1
                }
            elif is_reklam:
                if current_block:
                    day_slots.append(current_block)
                current_block = {
                    "time": t_str,
                    "type": "reklam",
                    "programName": "Reklam",
                    "duration": 5,
                    "note": note or val,
                    "slots_count": 1
                }
            elif is_new_program:
                # We start a new program block if we are not currently in one,
                # or if the current one is an empty/reklam block,
                # or if we are at a slot ending in :05 or :35.
                t_min = t_str.split(":")[-1]
                should_force_new = t_min in ["05", "35", "40"] or (current_block and current_block["type"] != "program")
                
                if not current_block or should_force_new:
                    if current_block:
                        day_slots.append(current_block)
                    current_block = {
                        "time": t_str,
                        "type": "program",
                        "programName": str(val).strip(),
                        "episodeNo": None,
                        "presenter": None,
                        "subject": None,
                        "duration": 5,
                        "slots_count": 1
                    }
                else:
                    # Append as presenter/subject
                    val_str = str(val).strip()
                    if current_block["presenter"] is None:
                        current_block["presenter"] = val_str
                    elif current_block["subject"] is None:
                        current_block["subject"] = val_str
                    else:
                        current_block["subject"] += " - " + val_str
                    current_block["duration"] += 5
                    current_block["slots_count"] += 1
            else:
                # Value is None, number, or label
                if current_block:
                    current_block["duration"] += 5
                    current_block["slots_count"] += 1
                    if val is not None and current_block["type"] == "program":
                        val_str = str(val).strip()
                        if re.match(r'^\d+$', val_str):
                            current_block["episodeNo"] = val_str
                        elif val_str.lower() not in labels_to_skip:
                            if current_block["presenter"] is None:
                                current_block["presenter"] = val_str
                            else:
                                if current_block["subject"] is None:
                                    current_block["subject"] = val_str
                                else:
                                    current_block["subject"] += " - " + val_str
                else:
                    current_block = {
                        "time": t_str,
                        "type": "empty",
                        "duration": 5,
                        "slots_count": 1
                    }

        if current_block:
            day_slots.append(current_block)

        # Merge contiguous empty slots and reklam blocks
        merged_slots = []
        for slot in day_slots:
            if not merged_slots:
                merged_slots.append(slot)
            else:
                prev = merged_slots[-1]
                if prev["type"] == "empty" and slot["type"] == "empty":
                    prev["duration"] += slot["duration"]
                    prev["slots_count"] += slot["slots_count"]
                elif prev["type"] == "reklam" and slot["type"] == "reklam":
                    prev["duration"] += slot["duration"]
                    prev["slots_count"] += slot["slots_count"]
                    if slot["note"]:
                        prev["note"] = slot["note"]
                else:
                    merged_slots.append(slot)

        weekly_flow[day_date] = merged_slots

    return weekly_flow

if __name__ == "__main__":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
    
    path = r"D:\Projeler\YayınPlanlamaSistemi\document\5 dk.lık akış.xlsx"
    if len(sys.argv) > 1:
        path = sys.argv[1]
    
    try:
        data = parse_excel(path)
        print(json.dumps(data, ensure_ascii=False))
    except Exception as e:
        sys.stderr.write(str(e))
        sys.exit(1)
