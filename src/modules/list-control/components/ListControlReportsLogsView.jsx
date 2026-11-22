/**
 * @file src/modules/list-control/components/ListControlReportsLogsView.jsx
 * @description Yayın Liste Kontrol Modülü — Raporlar, Teknik Sağlık Tablosu (DB • Dosya Yolu • Bozukluk)
 * ve Kalıcı Denetim Logları (Audit Logs) Görünümü.
 */
import React, { useState, useMemo } from 'react';
import {
  FileText, Download, Printer, Search, CheckCircle2, AlertTriangle,
  Database, FolderCheck, ShieldAlert, Clock, Filter, Info, Send
} from 'lucide-react';
import {
  exportToCSV,
  exportToExcel,
  exportToPresentationPDF
} from '../../../utils/reportExportUtils';
import usePlanningStore from '../../../store/planningStore';
import {
  formatMinuteToClock,
  formatSecondsReadable
} from '../utils/listControlVerificationEngine';

export default function ListControlReportsLogsView({
  selectedChannel,
  selectedDate,
  programs = [],
  healthMap = {},
  stageAnalysis = null,
  issues = [],
  onOpenClipPreview,
  onRequestRevision
}) {
  const listControlLogs = usePlanningStore(state => state.listControlLogs) || [];
  const [activeSubTab, setActiveSubTab] = useState('audit_report'); // 'audit_report' | 'logs' | 'draft_report'
  const [searchQuery, setSearchQuery] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('all');
  const [onlyCurrentDateLogs, setOnlyCurrentDateLogs] = useState(false);

  const channelName = selectedChannel === 'ch_way' ? 'Semerkand WAY' : 'Semerkand HD';

  const filteredReportRows = useMemo(() => {
    if (!searchQuery.trim()) return programs;
    const q = searchQuery.toLowerCase().trim();
    return programs.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      String(p.code || p.fileName || p.id || '').toLowerCase().includes(q) ||
      (p.companyName || '').toLowerCase().includes(q)
    );
  }, [programs, searchQuery]);

  const filteredLogs = useMemo(() => {
    return listControlLogs.filter(log => {
      if (onlyCurrentDateLogs && log.date !== selectedDate) return false;
      if (logActionFilter !== 'all' && log.actionType !== logActionFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          (log.actionLabel || '').toLowerCase().includes(q) ||
          (log.itemTitle || '').toLowerCase().includes(q) ||
          (log.details || '').toLowerCase().includes(q) ||
          (log.oldValue || '').toLowerCase().includes(q) ||
          (log.newValue || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [listControlLogs, onlyCurrentDateLogs, selectedDate, logActionFilter, searchQuery]);

  const buildExportSections = () => {
    const auditHeaders = [
      'Sıra',
      'Saat',
      'Tür',
      'Klip / Reklam Adı',
      'Klip Kodu / FileID',
      'Süre',
      'Aşama Kaynağı',
      'DB Durumu',
      'Dosya Yolu Durumu',
      'Klip Bütünlüğü',
      'Revize Durumu'
    ];
    const auditRows = programs.map((p, idx) => {
      const h = healthMap[p.instanceId] || {};
      const stageInfo = stageAnalysis?.itemVerificationMap?.[p.instanceId] || {};
      const durSec = Number(p.durationSec) || Math.round((Number(p.duration) || 0) * 60);
      return [
        idx + 1,
        formatMinuteToClock(p.startMinute || 0),
        p.isAdClip || p.isFromAds ? 'Reklam' : 'Program / Klip',
        p.title || '',
        p.code || p.fileName || p.id || '',
        formatSecondsReadable(durSec),
        stageInfo.badgeLabel || (p.isAdClip ? 'Reklam Rezervasyon' : 'Yayın Planlama'),
        h.inDatabase !== false ? 'DB Var' : 'DB Yok',
        h.fileExists !== false ? 'Dosya Mevcut' : 'Dosya Bulunamadı',
        h.isCorrupted ? 'BOZUK' : 'Sağlam',
        p.revisionRequested ? `Revize (${p.revisionTargetLabel || ''}): ${p.revisionReason || ''}` : 'Normal'
      ];
    });

    const draftHeaders = [
      'Taslak Saati',
      'Taslak Programı',
      'Taslak Bölümü',
      'Yayında Var mı?',
      'Eşleşen Parça Sayısı',
      'Değişiklik Notu'
    ];
    const draftRows = (stageAnalysis?.draftSlotComparison || []).map(slot => [
      slot.startTime,
      slot.title,
      slot.draftEpisode || '-',
      slot.isPresentInList ? 'EVET' : 'EKSİK',
      slot.matchedItemsCount,
      slot.modificationDetail || '-'
    ]);

    const logHeaders = [
      'Tarih & Saat',
      'Kanal',
      'Yayın Günü',
      'İşlem',
      'Öğe',
      'Kod',
      'Eski Değer',
      'Yeni Değer',
      'Detay'
    ];
    const logRows = filteredLogs.map(l => [
      l.timestamp ? new Date(l.timestamp).toLocaleString('tr-TR') : '',
      l.channelName || '',
      l.date || '',
      l.actionLabel || '',
      l.itemTitle || '',
      l.itemCode || '',
      l.oldValue || '-',
      l.newValue || '-',
      l.details || ''
    ]);

    return {
      auditHeaders,
      auditRows,
      draftHeaders,
      draftRows,
      logHeaders,
      logRows,
      sections: [
        { title: '1. Klip & Reklam Denetim Tablosu (DB • Dosya Yolu • Bozukluk)', headers: auditHeaders, rows: auditRows },
        { title: '2. Taslak Planlama ↔ Yayın Planlama Karşılaştırma Tablosu', headers: draftHeaders, rows: draftRows },
        { title: '3. Denetim ve İşlem Logları (Audit Logs)', headers: logHeaders, rows: logRows }
      ]
    };
  };

  const handleExportExcel = () => {
    const { sections } = buildExportSections();
    exportToExcel({
      filename: `Liste_Kontrol_Raporu_${selectedChannel}_${selectedDate}`,
      title: `${channelName} (${selectedDate}) — Yayın Liste Kontrol & Denetim Raporu`,
      subtitle: 'Taslak Planlama • Yayın Planlama • Reklam Rezervasyon • DB / Dosya Yolu / Bozukluk Kontrolü',
      kpis: [
        { label: 'Toplam Satır', value: String(programs.length) },
        { label: 'Taslak Uyumu', value: `${stageAnalysis?.matchedDraftCount || 0} / ${stageAnalysis?.totalDraftSlots || 0}` },
        { label: 'Tespit Edilen Uyarı/Hata', value: String(issues.length) },
        { label: 'Kayıtlı İşlem Logu', value: String(filteredLogs.length) }
      ],
      sections
    });
  };

  const handleExportCSV = () => {
    const { auditHeaders, auditRows } = buildExportSections();
    exportToCSV({
      filename: `Liste_Kontrol_Tablosu_${selectedChannel}_${selectedDate}`,
      headers: auditHeaders,
      rows: auditRows
    });
  };

  const handleExportPDF = () => {
    const { sections } = buildExportSections();
    exportToPresentationPDF({
      title: `${channelName} (${selectedDate}) — Yayın Liste Kontrol Raporu`,
      subtitle: 'Nihai Yayın & Reklam Denetimi, Teknik Sağlık (DB • Dosya • Bozukluk) ve İşlem Logları',
      kpis: [
        { label: 'Toplam Satır', value: String(programs.length) },
        { label: 'Taslak Uyumu', value: `${stageAnalysis?.matchedDraftCount || 0} / ${stageAnalysis?.totalDraftSlots || 0}` },
        { label: 'Uyarı / Hata', value: String(issues.length) },
        { label: 'İşlem Logu', value: String(filteredLogs.length) }
      ],
      sections
    });
  };

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px'
    }}>
      {/* Üst Sekmeler & Dışa Aktarım Araç Çubuğu */}
      <div style={{
        padding: '12px 16px',
        borderRadius: '14px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'audit_report', label: `📊 Klip & Reklam Denetim Tablosu (${programs.length})` },
            { id: 'draft_report', label: `📋 Taslak ↔ Yayın Planlama Raporu (${stageAnalysis?.totalDraftSlots || 0})` },
            { id: 'logs', label: `📜 Denetim & İşlem Logları (${listControlLogs.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: activeSubTab === tab.id ? 'none' : '1px solid var(--border-color)',
                background: activeSubTab === tab.id ? 'var(--accent-primary)' : 'var(--bg-primary)',
                color: activeSubTab === tab.id ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '9px' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rapor veya loglarda ara..."
              style={{
                padding: '7px 12px 7px 30px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                outline: 'none',
                width: '210px'
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            style={{
              padding: '7px 13px',
              borderRadius: '8px',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#059669',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={14} />
            <span>Excel İndir (.xls)</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              padding: '7px 13px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileText size={14} />
            <span>CSV İndir</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            style={{
              padding: '7px 13px',
              borderRadius: '8px',
              border: '1px solid rgba(37, 99, 235, 0.4)',
              background: 'rgba(37, 99, 235, 0.12)',
              color: '#2563eb',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Printer size={14} />
            <span>Sunum PDF</span>
          </button>
        </div>
      </div>

      {/* ALT SEKME 1: KLİP & REKLAM DENETİM TABLOSU (FLEXBOX SATIRLARI) */}
      {activeSubTab === 'audit_report' && (
        <div style={{
          borderRadius: '14px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '10px 16px',
            background: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '11px',
            fontWeight: 800,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase'
          }}>
            <span style={{ width: '42px' }}>#</span>
            <span style={{ width: '76px' }}>Saat</span>
            <span style={{ flex: 2, minWidth: '180px' }}>Klip / Reklam Adı & Kodu</span>
            <span style={{ width: '90px' }}>Süre</span>
            <span style={{ flex: 1.3, minWidth: '150px' }}>Aşama Kaynağı</span>
            <span style={{ width: '240px' }}>DB • Dosya Yolu • Bozukluk</span>
            <span style={{ width: '120px', textAlign: 'right' }}>İşlem</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredReportRows.map((prog, idx) => {
              const h = healthMap[prog.instanceId] || { inDatabase: true, fileExists: true, isCorrupted: false };
              const stageInfo = stageAnalysis?.itemVerificationMap?.[prog.instanceId] || {};
              const isAd = Boolean(prog.isAdClip || prog.isFromAds);
              const durSec = Number(prog.durationSec) || Math.round((Number(prog.duration) || 0) * 60);

              return (
                <div
                  key={prog.instanceId || idx}
                  style={{
                    padding: '10px 16px',
                    borderBottom: '1px solid var(--border-color)',
                    background: isAd ? 'rgba(217, 119, 6, 0.04)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                    fontSize: '12px'
                  }}
                >
                  <span style={{ width: '42px', fontWeight: 800, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    #{idx + 1}
                  </span>
                  <span style={{ width: '76px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                    {formatMinuteToClock(prog.startMinute || 0)}
                  </span>
                  <div style={{ flex: 2, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                      {prog.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      Kod: {prog.code || prog.fileName || prog.id || '-'}
                      {prog.companyName ? ` • ${prog.companyName}` : ''}
                    </div>
                  </div>
                  <span style={{ width: '90px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                    {formatSecondsReadable(durSec)}
                  </span>
                  <div style={{ flex: 1.3, minWidth: '150px' }}>
                    <span style={{
                      display: 'inline-block',
                      fontSize: '10.5px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: stageInfo.badgeBg || 'var(--bg-tertiary)',
                      color: stageInfo.badgeColor || 'var(--text-primary)'
                    }}>
                      {stageInfo.badgeLabel || (isAd ? '📢 Reklam Rezervasyon' : '🎬 Yayın Planlama')}
                    </span>
                  </div>
                  <div style={{ width: '240px', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '5px',
                      background: h.inDatabase ? 'rgba(16, 185, 129, 0.14)' : 'rgba(220, 38, 38, 0.15)',
                      color: h.inDatabase ? '#059669' : '#dc2626'
                    }}>
                      {h.inDatabase ? 'DB ✓' : 'DB ✗'}
                    </span>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '5px',
                      background: h.fileExists ? 'rgba(16, 185, 129, 0.14)' : 'rgba(220, 38, 38, 0.15)',
                      color: h.fileExists ? '#059669' : '#dc2626'
                    }}>
                      {h.fileExists ? 'Dosya ✓' : 'Dosya ✗'}
                    </span>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '5px',
                      background: !h.isCorrupted ? 'rgba(16, 185, 129, 0.14)' : 'rgba(220, 38, 38, 0.15)',
                      color: !h.isCorrupted ? '#059669' : '#dc2626'
                    }}>
                      {!h.isCorrupted ? 'Sağlam ✓' : 'Bozuk ⚠️'}
                    </span>
                  </div>
                  <div style={{ width: '120px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => onOpenClipPreview({
                        fileId: prog.fileId || String(prog.id || '').replace(/\D+/g, ''),
                        name: prog.title,
                        fileName: prog.code || prog.fileName,
                        durationSec: durSec
                      })}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      ⓘ İzle
                    </button>
                    <button
                      type="button"
                      onClick={() => onRequestRevision(prog)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(217, 119, 6, 0.4)',
                        background: 'rgba(217, 119, 6, 0.12)',
                        color: '#d97706',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      Revize
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ALT SEKME 2: TASLAK ↔ YAYIN PLANLAMA KARŞILAŞTIRMA RAPORU */}
      {activeSubTab === 'draft_report' && (
        <div style={{
          borderRadius: '14px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: 'var(--text-primary)' }}>
            {channelName} ({selectedDate}) — Taslak Planlama vs Yayın Planlama Karşılaştırma Raporu
          </h3>
          {(stageAnalysis?.draftSlotComparison || []).map(slot => (
            <div
              key={slot.slotId}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                background: slot.isPresentInList ? 'rgba(16, 185, 129, 0.06)' : 'rgba(245, 158, 11, 0.12)',
                border: slot.isPresentInList ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '13px', color: 'var(--text-primary)' }}>
                  {slot.startTime}
                </span>
                <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{slot.title}</strong>
                {slot.draftEpisode && (
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    (Taslak Bölüm: {slot.draftEpisode})
                  </span>
                )}
                {slot.modificationDetail && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'rgba(37, 99, 235, 0.14)',
                    color: '#2563eb'
                  }}>
                    🔄 {slot.modificationDetail}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: '11.5px',
                fontWeight: 900,
                padding: '3px 10px',
                borderRadius: '999px',
                background: slot.isPresentInList ? '#10b981' : '#d97706',
                color: '#ffffff'
              }}>
                {slot.isPresentInList ? `✓ Yayında Mevcut (${slot.matchedItemsCount} Parça)` : '⚠️ Listede Eksik!'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ALT SEKME 3: KALICI DENETİM VE İŞLEM LOGLARI */}
      {activeSubTab === 'logs' && (
        <div style={{
          borderRadius: '14px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <select
                value={logActionFilter}
                onChange={(e) => setLogActionFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 700
                }}
              >
                <option value="all">Tüm İşlem Türleri</option>
                <option value="clip_replace">Klip / Bölüm Değişimleri</option>
                <option value="duration_edit">Süre Güncellemeleri</option>
                <option value="clip_add">Klip Eklemeleri</option>
                <option value="clip_delete">Klip Silmeleri</option>
                <option value="ad_replace">Reklam Değişimleri</option>
                <option value="ad_add">Reklam Eklemeleri</option>
                <option value="ad_delete">Reklam Silmeleri</option>
                <option value="revision_request">Revize Talepleri</option>
                <option value="approve_list">Liste Onayları</option>
                <option value="sync_from_ads">Senkronizasyonlar</option>
              </select>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={onlyCurrentDateLogs}
                  onChange={(e) => setOnlyCurrentDateLogs(e.target.checked)}
                />
                <span>Sadece Seçili Günün ({selectedDate}) Loglarını Göster</span>
              </label>
            </div>

            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Toplam {filteredLogs.length} Log Kaydı
            </span>
          </div>

          {filteredLogs.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px' }}>
              Henüz kayıtlı işlem logu bulunmuyor.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredLogs.map(log => {
                const isWarn = log.status === 'warning' || log.actionType === 'revision_request';
                const isErr = log.status === 'error';
                const badgeColor = isErr ? '#dc2626' : isWarn ? '#d97706' : '#059669';
                return (
                  <div
                    key={log.id}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderLeft: `4px solid ${badgeColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: '240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: 900,
                          padding: '2px 7px',
                          borderRadius: '6px',
                          background: `${badgeColor}20`,
                          color: badgeColor
                        }}>
                          {log.actionLabel}
                        </span>
                        <strong style={{ color: 'var(--text-primary)' }}>{log.itemTitle}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          ({log.channelName} • {log.date})
                        </span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        {log.details}
                      </div>
                      {(log.oldValue || log.newValue) && (
                        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {log.oldValue && <span>Eski: {log.oldValue} </span>}
                          {log.newValue && <strong style={{ color: 'var(--text-primary)' }}>→ Yeni: {log.newValue}</strong>}
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleString('tr-TR') : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
