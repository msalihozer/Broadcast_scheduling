/**
 * @file src/utils/reportExportUtils.js
 * @description Taslak Planlama, Yayın Planlama ve Reklam Rezervasyon Raporları için
 * Profesyonel Sunum PDF (Kurumsal Kapak + KPI Kartları + Tablolar), Excel (.xls) ve CSV (.csv) Çıktı Motoru.
 */

const escapeHtml = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

/**
 * Saniyeyi "X sa Y dk" veya "Y dk Z sn" formatında okunabilir metne çevirir.
 */
export function formatSecondsToHoursMin(totalSeconds = 0) {
  const sec = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (sec === 0) return '0 dk';
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const remSec = sec % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours} sa ${minutes} dk` : `${hours} sa`;
  }
  if (minutes > 0) {
    return remSec > 0 ? `${minutes} dk ${remSec} sn` : `${minutes} dk`;
  }
  return `${remSec} sn`;
}

/**
 * Dakikayı "X sa Y dk" formatına çevirir.
 */
export function formatMinutesToHoursMin(totalMinutes = 0) {
  const mins = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

/**
 * ISO tarihinden (`YYYY-MM-DD`) Hafta (`2026-H45`), Ay (`2026-11 (Kasım 2026)`) ve Yıl (`2026`) etiketlerini döndürür.
 */
const TR_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];
const TR_DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

export function getDatePeriodBuckets(dateStr = '') {
  const TR_SHORT_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  if (!dateStr || typeof dateStr !== 'string' || dateStr.length < 10) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return {
      date: now.toISOString().split('T')[0],
      dayName: TR_DAYS[now.getDay()],
      weekKey: `${y}-H01`,
      weekLabel: `${y} • 1. Hafta`,
      monthKey: `${y}-${String(m + 1).padStart(2, '0')}`,
      monthLabel: `${TR_MONTHS[m]} ${y}`,
      yearKey: String(y)
    };
  }
  const clean = dateStr.slice(0, 10);
  const [yStr, mStr, dStr] = clean.split('-');
  const y = parseInt(yStr, 10) || 2026;
  const m = Math.max(1, Math.min(12, parseInt(mStr, 10) || 1));
  const d = Math.max(1, Math.min(31, parseInt(dStr, 10) || 1));
  const dt = new Date(y, m - 1, d);
  const dayName = TR_DAYS[dt.getDay()] || 'Gün';

  // Pazartesi başlangıçlı (Pazartesi - Pazar) gerçek yayın haftası hesaplama
  const dayOfWeekMondayZero = (dt.getDay() + 6) % 7; // Pazartesi = 0 ... Pazar = 6
  const mondayDate = new Date(y, m - 1, d - dayOfWeekMondayZero);
  const sundayDate = new Date(
    mondayDate.getFullYear(),
    mondayDate.getMonth(),
    mondayDate.getDate() + 6
  );

  // ISO-8601 Hafta Numarası (Perşembe gününe göre)
  const thursdayDate = new Date(
    mondayDate.getFullYear(),
    mondayDate.getMonth(),
    mondayDate.getDate() + 3
  );
  const isoYear = thursdayDate.getFullYear();
  const firstThursday = new Date(isoYear, 0, 4);
  const firstMondayOffset = (firstThursday.getDay() + 6) % 7;
  const firstIsoMonday = new Date(isoYear, 0, 4 - firstMondayOffset);
  const weekNo = Math.max(
    1,
    Math.round((mondayDate - firstIsoMonday) / (7 * 86400000)) + 1
  );

  const monStr = `${String(mondayDate.getDate()).padStart(2, '0')} ${TR_SHORT_MONTHS[mondayDate.getMonth()]}`;
  const sunStr = `${String(sundayDate.getDate()).padStart(2, '0')} ${TR_SHORT_MONTHS[sundayDate.getMonth()]} ${sundayDate.getFullYear()}`;
  const weekMondayIso = `${mondayDate.getFullYear()}-${String(mondayDate.getMonth() + 1).padStart(2, '0')}-${String(mondayDate.getDate()).padStart(2, '0')}`;

  return {
    date: clean,
    dayName,
    weekKey: weekMondayIso,
    weekLabel: `${monStr} – ${sunStr}`,
    weekNo,
    monthKey: `${y}-${String(m).padStart(2, '0')}`,
    monthLabel: `${TR_MONTHS[m - 1]} ${y}`,
    yearKey: String(y)
  };
}

/**
 * UTF-8 BOM destekli CSV (.csv) indirir.
 */
export function exportToCSV({ filename = 'Rapor', headers = [], rows = [] }) {
  const safeFilename = filename.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ_-]/g, '_');
  const csvContent =
    '\uFEFF' +
    [headers, ...rows]
      .map(row =>
        (row || [])
          .map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`)
          .join(';')
      )
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFilename}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Microsoft Excel ile doğrudan renkli, başlıklı ve çoklu tablo/sekme destekli açılabilen `.xls` dosyası indirir.
 *
 * @param {Object} config
 * @param {string} config.filename - Dosya adı
 * @param {string} config.title - Rapor ana başlığı
 * @param {string} config.subtitle - Alt başlık / kapsam bilgisi
 * @param {Array<{label:string, value:string}>} config.kpis - Üst özet KPI kutuları
 * @param {Array<{title:string, headers:Array<string>, rows:Array<Array<any>>}>} config.sections - Rapor tabloları
 */
export function exportToExcel({
  filename = 'Rapor',
  title = 'Kurumsal Yayın Raporu',
  subtitle = '',
  kpis = [],
  sections = []
}) {
  const safeFilename = filename.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ_-]/g, '_');
  const dateStr = new Date().toLocaleString('tr-TR');

  const kpiHtml = kpis.length > 0
    ? `
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse; margin-bottom:16px; font-family:Calibri, Arial, sans-serif;">
        <tr style="background:#1e3a8a; color:#ffffff; font-weight:bold;">
          ${kpis.map(k => `<th style="padding:8px 14px; background:#1e3a8a; color:#ffffff;">${escapeHtml(k.label)}</th>`).join('')}
        </tr>
        <tr>
          ${kpis.map(k => `<td style="padding:8px 14px; font-size:13pt; font-weight:bold; text-align:center; background:#f8fafc;">${escapeHtml(k.value)}</td>`).join('')}
        </tr>
      </table>
    `
    : '';

  const sectionsHtml = sections
    .map(sec => {
      const colCount = Math.max(1, (sec.headers || []).length);
      return `
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse; margin-bottom:20px; width:100%; font-family:Calibri, Arial, sans-serif;">
          <tr>
            <th colspan="${colCount}" style="background:#0f172a; color:#ffffff; font-size:12pt; font-weight:bold; text-align:left; padding:8px 12px;">
              ${escapeHtml(sec.title)}
            </th>
          </tr>
          <tr style="background:#2563eb; color:#ffffff; font-weight:bold;">
            ${(sec.headers || []).map(h => `<th style="background:#2563eb; color:#ffffff; padding:7px 10px;">${escapeHtml(h)}</th>`).join('')}
          </tr>
          ${(sec.rows || [])
            .map(
              (r, idx) => `
              <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f1f5f9'};">
                ${(r || []).map(cell => `<td style="padding:6px 10px;">${escapeHtml(cell)}</td>`).join('')}
              </tr>
            `
            )
            .join('')}
        </table>
      `;
    })
    .join('<br/>');

  const excelDoc = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Rapor</x:Name>
              <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
    </head>
    <body style="font-family:Calibri, Arial, sans-serif;">
      <h2 style="color:#0f172a; margin-bottom:4px;">${escapeHtml(title)}</h2>
      <p style="color:#475569; margin-top:0; font-size:10pt;">${escapeHtml(subtitle)} • Oluşturulma Tarihi: ${escapeHtml(dateStr)}</p>
      ${kpiHtml}
      ${sectionsHtml}
    </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + excelDoc], {
    type: 'application/vnd.ms-excel;charset=utf-8;'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFilename}_${new Date().toISOString().split('T')[0]}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Kurumsal Sunum Formatında PDF Raporu Pencerede Açar ve Yazdır/PDF Kaydet Diyaloğunu Tetikler.
 */
export function exportToPresentationPDF({
  title = 'KURUMSAL YAYIN VE REKLAM ANALİZ SUNUMU',
  subtitle = '',
  badgeText = 'SEMERKAND MEDYA • RESMİ RAPOR SUNUMU',
  accentColor = '#2563eb',
  kpis = [],
  highlightCards = [],
  sections = []
}) {
  const nowStr = new Date().toLocaleString('tr-TR');

  const kpisHtml = kpis.length > 0
    ? `
      <div class="kpi-grid">
        ${kpis
          .map(
            k => `
          <div class="kpi-card">
            <div class="kpi-label">${escapeHtml(k.label)}</div>
            <div class="kpi-val" style="color:${k.color || accentColor}">${escapeHtml(k.value)}</div>
            ${k.sub ? `<div class="kpi-sub">${escapeHtml(k.sub)}</div>` : ''}
          </div>
        `
          )
          .join('')}
      </div>
    `
    : '';

  const highlightsHtml = highlightCards.length > 0
    ? `
      <div class="highlight-grid">
        ${highlightCards
          .map(
            h => `
          <div class="highlight-card">
            <div class="h-title">${escapeHtml(h.title)}</div>
            <div class="h-body">${escapeHtml(h.body)}</div>
          </div>
        `
          )
          .join('')}
      </div>
    `
    : '';

  const sectionsHtml = sections
    .map(
      sec => `
      <div class="section-block">
        <div class="section-header">
          <h3>${escapeHtml(sec.title)}</h3>
          ${sec.description ? `<p>${escapeHtml(sec.description)}</p>` : ''}
        </div>
        <table>
          <thead>
            <tr>
              ${(sec.headers || []).map(h => `<th>${escapeHtml(h)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${
              (sec.rows || []).length === 0
                ? `<tr><td colspan="${Math.max(1, (sec.headers || []).length)}" style="text-align:center; padding:18px; color:#64748b;">Kayıt bulunamadı.</td></tr>`
                : (sec.rows || [])
                    .map(
                      r => `
                  <tr>
                    ${(r || []).map(c => `<td>${escapeHtml(c)}</td>`).join('')}
                  </tr>
                `
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
    `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        * { box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif;
          color: #0f172a;
          background: #f1f5f9;
          margin: 0;
          padding: 0;
          line-height: 1.45;
        }
        .top-bar {
          position: sticky;
          top: 0;
          z-index: 999;
          background: #0f172a;
          color: #fff;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .print-btn {
          background: ${accentColor};
          color: #fff;
          border: none;
          padding: 9px 18px;
          border-radius: 8px;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
        }
        .container {
          max-width: 1200px;
          margin: 20px auto;
          background: #ffffff;
          padding: 28px 34px;
          border-radius: 16px;
          box-shadow: 0 12px 35px rgba(15, 23, 42, 0.08);
        }
        .cover-banner {
          background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, ${accentColor} 100%);
          color: #ffffff;
          padding: 24px 28px;
          border-radius: 14px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        .badge {
          display: inline-block;
          font-size: 10.5px;
          font-weight: 800;
          letter-spacing: 0.7px;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.16);
          margin-bottom: 8px;
        }
        .cover-banner h1 {
          margin: 0 0 6px 0;
          font-size: 21px;
          font-weight: 900;
        }
        .cover-banner p {
          margin: 0;
          font-size: 12.5px;
          opacity: 0.9;
        }
        .meta-box {
          text-align: right;
          font-size: 11px;
          opacity: 0.9;
          white-space: nowrap;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }
        .kpi-card {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 11px;
          padding: 12px 14px;
        }
        .kpi-label {
          font-size: 10.5px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
        }
        .kpi-val {
          font-size: 20px;
          font-weight: 900;
          margin-top: 4px;
        }
        .kpi-sub {
          font-size: 11px;
          color: #475569;
          margin-top: 2px;
        }
        .highlight-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }
        .highlight-card {
          border-left: 4px solid ${accentColor};
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          border-right: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
          padding: 11px 14px;
          border-radius: 8px;
        }
        .h-title {
          font-size: 11.5px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 3px;
        }
        .h-body {
          font-size: 11.5px;
          color: #334155;
        }
        .section-block {
          margin-bottom: 24px;
          page-break-inside: avoid;
        }
        .section-header h3 {
          margin: 0 0 3px 0;
          font-size: 14.5px;
          font-weight: 800;
          color: #0f172a;
          border-left: 4px solid ${accentColor};
          padding-left: 9px;
        }
        .section-header p {
          margin: 0 0 8px 13px;
          font-size: 11.5px;
          color: #64748b;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11.2px;
        }
        th, td {
          border: 1px solid #cbd5e1;
          padding: 7px 9px;
          text-align: left;
          vertical-align: top;
        }
        th {
          background: #0f172a;
          color: #ffffff;
          font-weight: 700;
          font-size: 10.8px;
        }
        tr:nth-child(even) td {
          background: #f8fafc;
        }
        @media print {
          body { background: #fff; }
          .top-bar { display: none !important; }
          .container {
            max-width: 100%;
            margin: 0;
            padding: 0;
            box-shadow: none;
          }
          .cover-banner {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          th {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="top-bar">
        <div>
          <strong>📄 ${escapeHtml(title)}</strong>
          <span style="font-size:12px; color:#94a3b8; margin-left:10px;">Sunum PDF Görünümü</span>
        </div>
        <button class="print-btn" onclick="window.print()">🖨️ PDF Olarak Kaydet / Yazdır (Ctrl+P)</button>
      </div>
      <div class="container">
        <div class="cover-banner">
          <div>
            <div class="badge">${escapeHtml(badgeText)}</div>
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(subtitle)}</p>
          </div>
          <div class="meta-box">
            <div><strong>Rapor Tarihi:</strong> ${escapeHtml(nowStr)}</div>
            <div style="margin-top:4px;"><strong>Format:</strong> Kurumsal Yönetim Sunumu</div>
          </div>
        </div>
        ${kpisHtml}
        ${highlightsHtml}
        ${sectionsHtml}
      </div>
      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 350);
        };
      </script>
    </body>
    </html>
  `;

  const win = window.open('', '_blank');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
  }
}
