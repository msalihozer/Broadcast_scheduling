/**
 * @file src/pages/admin/archive/MamDatabaseSyncPanel.jsx
 * @description MAM Arşiv & Bölümler - Alan 1: Verileri Çektiğimiz TV MAM DB (MSSQL),
 * Canlı Bağlantı Kontrolü, Akıllı Delta Güncelleme Tespiti (Sadece yeni eklenen klipler) ve Senkronizasyon Paneli.
 */
import React from 'react';
import {
  Database, HardDrive, RefreshCw, CheckCircle2, AlertTriangle,
  Wifi, WifiOff, Clock, Eye, Zap, Sparkles
} from 'lucide-react';
import { MSSQL_CATEGORIES } from '../../../utils/categoryColors';

const MamDatabaseSyncPanel = ({
  mamStatus,
  isCheckingStatus,
  checkIntervalMin,
  onChangeCheckInterval,
  autoDeltaSync,
  onToggleAutoDeltaSync,
  onCheckNow,
  onSyncDelta,
  isSyncingDelta,
  onSyncCategory,
  syncingCategoryId,
  isSyncingAll,
  onSyncAll,
  selectedMamCategoryId,
  onSelectMamCategory
}) => {
  const mamConn = mamStatus?.mamConnection || mamStatus?.mssqlConnection || {};
  const ourConn = mamStatus?.ourDbConnection || mamStatus?.postgresConnection || {};
  const summary = mamStatus?.summary || {};
  const categories = mamStatus?.categories || [];
  const newClipsPreview = mamStatus?.newClipsPreview || [];

  const isConnected = Boolean(mamConn.connected);
  const hasUpdates = Boolean(summary.hasAnyUpdates);
  const categoriesWithUpdates = summary.categoriesWithUpdates ?? summary.categoriesWithUpdatesCount ?? 0;
  const totalNewClips = summary.totalNewClips ?? summary.totalDiffCount ?? 0;

  const formatTime = (isoStr) => {
    if (!isoStr) return '-';
    try {
      return new Date(isoStr).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  const formatDateShort = (isoStr) => {
    if (!isoStr) return '-';
    try {
      return new Date(isoStr).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Üst Bilgi & Bağlantı Kartları (3 Sütun) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
        gap: '14px'
      }}>
        {/* 1. TV MAM DB (Kaynak MSSQL) Bağlantı Kartı */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.4)'}`,
          borderRadius: '14px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                background: isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isConnected ? '#10b981' : '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Database size={18} />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  1. Libero TV MAM DB (Kaynak)
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {mamConn.server || 'MAM Sunucusu'} / {mamConn.database || 'MAM_DB'}
                </div>
              </div>
            </div>

            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: '800',
              background: isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: isConnected ? '#10b981' : '#ef4444',
              border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`
            }}>
              {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              <span>{isConnected ? 'Bağlantı Aktif' : 'Bağlantı Yok'}</span>
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '8px',
            borderTop: '1px solid var(--border-color)',
            fontSize: '11.5px',
            color: 'var(--text-secondary)'
          }}>
            <span>
              Yanıt Süresi: <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>
                {mamConn.latencyMs != null ? `${mamConn.latencyMs} ms` : '-'}
              </strong>
            </span>
            <span>
              TV MAM Toplam Klip: <strong style={{ color: 'var(--text-primary)' }}>
                {Number(summary.totalMamClips || 0).toLocaleString('tr-TR')}
              </strong>
            </span>
          </div>

          {mamConn.error && (
            <div style={{
              fontSize: '11px',
              color: '#ef4444',
              background: 'rgba(239, 68, 68, 0.1)',
              padding: '6px 10px',
              borderRadius: '6px'
            }}>
              Hata: {mamConn.error}
            </div>
          )}
        </div>

        {/* 2. Bizim DB (Yerel PostgreSQL) & Akıllı Delta Fark Özeti Kartı */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: `1px solid ${hasUpdates ? 'rgba(245, 158, 11, 0.45)' : 'var(--border-color)'}`,
          borderRadius: '14px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <HardDrive size={18} />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  Akıllı Fark (Delta) Durumu
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Bizim DB'deki Kayıt: <strong>{Number(summary.totalOurClips || summary.totalLocalClips || 0).toLocaleString('tr-TR')}</strong> Klip
                </div>
              </div>
            </div>

            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: '800',
              background: hasUpdates ? 'rgba(245, 158, 11, 0.16)' : 'rgba(16, 185, 129, 0.15)',
              color: hasUpdates ? '#f59e0b' : '#10b981',
              border: `1px solid ${hasUpdates ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.35)'}`
            }}>
              {hasUpdates ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
              <span>
                {hasUpdates
                  ? `${categoriesWithUpdates} Kategoride Yeni Klip Var`
                  : 'Tüm Kategoriler Güncel'}
              </span>
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '8px',
            borderTop: '1px solid var(--border-color)',
            fontSize: '11.5px',
            color: 'var(--text-secondary)'
          }}>
            <span>
              TV MAM'da Yeni Eklenen:{' '}
              <strong style={{ color: totalNewClips > 0 ? '#f59e0b' : '#10b981' }}>
                {totalNewClips > 0 ? `+${totalNewClips} yeni klip bekliyor` : '0 (Yeni klip yok)'}
              </strong>
            </span>
            <span>
              PostgreSQL: <strong style={{ color: ourConn.connected ? '#10b981' : '#ef4444' }}>
                {ourConn.connected ? 'Aktif' : 'Kapalı'}
              </strong>
            </span>
          </div>
        </div>

        {/* 3. Aralıklı Kontrol & Akıllı Delta Eşitleme Ayarları */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={15} color="var(--accent-primary)" />
              <span style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
                Kontrol Sıklığı:
              </span>
              <select
                value={checkIntervalMin}
                onChange={(e) => onChangeCheckInterval(Number(e.target.value))}
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  color: 'var(--text-primary)',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                <option value={0}>Sadece Açılışta / Manuel</option>
                <option value={5}>Her 5 Dakikada Bir</option>
                <option value={15}>Her 15 Dakikada Bir</option>
                <option value={30}>Her 30 Dakikada Bir</option>
              </select>
            </div>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '700',
                color: autoDeltaSync ? '#10b981' : 'var(--text-secondary)'
              }}
              title="TV MAM DB'ye yeni bir klip yüklendiğinde tüm arşivi taramadan sadece yeni eklenen klibi otomatik olarak Bizim DB'ye çeker"
            >
              <input
                type="checkbox"
                checked={autoDeltaSync}
                onChange={(e) => onToggleAutoDeltaSync(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: '#10b981' }}
              />
              <span>Otomatik Çek</span>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Son Kontrol: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {formatTime(mamStatus?.checkedAt || mamConn.checkedAt)}
              </strong>
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <button
                onClick={onCheckNow}
                disabled={isCheckingStatus}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 11px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  cursor: isCheckingStatus ? 'wait' : 'pointer'
                }}
                title="TV MAM DB'de yeni klip var mı şimdi kontrol et"
              >
                <RefreshCw size={13} style={{ animation: isCheckingStatus ? 'spin 1s linear infinite' : 'none' }} />
                <span>{isCheckingStatus ? 'Kontrol Ediliyor...' : 'Şimdi Kontrol Et'}</span>
              </button>

              {hasUpdates && onSyncDelta && (
                <button
                  onClick={() => onSyncDelta(null)}
                  disabled={isSyncingDelta || isSyncingAll}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                    color: '#fff',
                    fontSize: '11.5px',
                    fontWeight: '800',
                    cursor: isSyncingDelta ? 'wait' : 'pointer',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)'
                  }}
                  title="Tüm veritabanını baştan taramadan SADECE yeni eklenen klipleri 1 saniyede çeker"
                >
                  <Zap size={13} />
                  <span>{isSyncingDelta ? 'Yeni Klipler Çekiliyor...' : `Yeni Klipleri Hızlı Çek (+${totalNewClips})`}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TV MAM DB'de Tespit Edilen Yeni Klipler Önizleme Kutusu (Varsa Gösterilir) */}
      {newClipsPreview.length > 0 && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '14px',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="#f59e0b" />
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                TV MAM DB'ye Yeni Eklenen Klipler ({newClipsPreview.length} yeni kayıt tespit edildi)
              </span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                • Tüm arşivi taramaya gerek kalmadan tek tıkla sadece bu yeni klipleri Bizim DB'ye aktarabilirsiniz.
              </span>
            </div>

            <button
              onClick={() => onSyncDelta(null)}
              disabled={isSyncingDelta || isSyncingAll}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: '#10b981',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '800',
                cursor: isSyncingDelta ? 'wait' : 'pointer'
              }}
            >
              <Zap size={14} />
              <span>{isSyncingDelta ? 'Aktarılıyor...' : `Sadece Bu ${newClipsPreview.length} Yeni Klibi Çek`}</span>
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '8px',
            maxHeight: '190px',
            overflowY: 'auto',
            paddingRight: '4px'
          }}>
            {newClipsPreview.map((clip) => {
              const cMeta = MSSQL_CATEGORIES[clip.mamCategoryId] || { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' };
              return (
                <div
                  key={clip.fileId}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '800',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: cMeta.bg,
                      color: cMeta.color
                    }}>
                      #{clip.mamCategoryId} {clip.mamCategoryName}
                    </span>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      ID: #{clip.fileId} • {clip.durationFormatted}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                    {clip.name}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Eklenme: {formatDateShort(clip.fileCreateTime)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kategori Bazlı TV MAM DB <-> Bizim DB Güncelleme Kontrol Tablosu */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '14px',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '12px 18px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
              TV MAM DB Kategori Bazlı Güncelleme & Senkronizasyon Tablosu
            </span>
            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginLeft: '10px' }}>
              (Bizim verdiğimiz özel kategoriler ve program isimleri senkronizasyonda korunur)
            </span>
          </div>

          <button
            onClick={onSyncAll}
            disabled={isSyncingAll || Boolean(syncingCategoryId)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              fontSize: '11.5px',
              fontWeight: '800',
              cursor: isSyncingAll ? 'not-allowed' : 'pointer'
            }}
            title="İhtiyaç halinde 9 kategorinin tamamını baştan sona yeniden tarar"
          >
            <RefreshCw size={13} style={{ animation: isSyncingAll ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isSyncingAll ? 'Tüm Kategoriler Taranıyor...' : 'Tümünü Baştan Tara'}</span>
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', background: 'var(--bg-primary)' }}>
                <th style={{ padding: '10px 14px', fontWeight: '700' }}>TV MAM Kategorisi (Kaynak)</th>
                <th style={{ padding: '10px 14px', fontWeight: '700' }}>TV MAM DB Klip Sayısı</th>
                <th style={{ padding: '10px 14px', fontWeight: '700' }}>Bizim DB'ye Çekilen (MAM Kaynaklı)</th>
                <th style={{ padding: '10px 14px', fontWeight: '700' }}>Bizim Kategorideki Planlama Verisi</th>
                <th style={{ padding: '10px 14px', fontWeight: '700' }}>Son Eklenen Kayıt Tarihi</th>
                <th style={{ padding: '10px 14px', fontWeight: '700' }}>Güncelleme Durumu</th>
                <th style={{ padding: '10px 14px', fontWeight: '700', textAlign: 'right' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const meta = MSSQL_CATEGORIES[cat.categoryId] || {
                  name: cat.categoryName,
                  color: '#3b82f6',
                  bg: 'rgba(59, 130, 246, 0.14)',
                  border: 'rgba(59, 130, 246, 0.35)'
                };
                const isSelected = Number(selectedMamCategoryId) === Number(cat.categoryId);
                const isThisSyncing = Number(syncingCategoryId) === Number(cat.categoryId);
                const newDiff = cat.newClipsDiff ?? cat.diffCount ?? 0;

                return (
                  <tr
                    key={cat.categoryId}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          background: meta.bg,
                          color: meta.color,
                          border: `1px solid ${meta.border}`,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '800',
                          fontFamily: 'monospace'
                        }}>
                          #{cat.categoryId}
                        </span>
                        <span style={{ fontWeight: '800', color: 'var(--text-primary)', fontSize: '13px' }}>
                          {cat.categoryName || meta.name}
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {cat.mamClipCount != null ? `${Number(cat.mamClipCount).toLocaleString('tr-TR')} klip` : '-'}
                    </td>

                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: '700', color: 'var(--text-secondary)' }}>
                      {Number(cat.ourClipCountByMamCategory ?? cat.localSyncedFromMamCount ?? 0).toLocaleString('tr-TR')} klip
                    </td>

                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          color: meta.color,
                          background: meta.bg,
                          padding: '2px 7px',
                          borderRadius: '5px'
                        }}>
                          {Number(cat.ourClipCountByOurCategory ?? cat.ourClipCount ?? 0).toLocaleString('tr-TR')} klip
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          • <strong>{cat.activeProgramsCount ?? cat.ourActiveProgramsCount ?? 0}</strong> aktif / {cat.programsCount ?? cat.ourProgramsCount ?? 0} program
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '10px 14px', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {formatDateShort(cat.mamLatestDate || cat.localLatestDate)}
                    </td>

                    <td style={{ padding: '10px 14px' }}>
                      {cat.hasUpdates ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 9px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: '800',
                          background: 'rgba(245, 158, 11, 0.16)',
                          color: '#f59e0b',
                          border: '1px solid rgba(245, 158, 11, 0.4)'
                        }}>
                          <AlertTriangle size={12} />
                          <span>
                            {newDiff > 0 ? `+${newDiff} Yeni Klip Var` : 'Yeni Kayıt Var'}
                          </span>
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 9px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: '700',
                          background: 'rgba(16, 185, 129, 0.14)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.3)'
                        }}>
                          <CheckCircle2 size={12} />
                          <span>Güncel</span>
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => onSelectMamCategory(cat.categoryId)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 10px',
                            borderRadius: '7px',
                            border: isSelected ? `1px solid ${meta.color}` : '1px solid var(--border-color)',
                            background: isSelected ? meta.bg : 'var(--bg-tertiary)',
                            color: isSelected ? meta.color : 'var(--text-primary)',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                          title="Bu TV MAM kategorisinden çekilen kayıtları aşağıda listele"
                        >
                          <Eye size={12} />
                          <span>{isSelected ? 'Listeleniyor' : 'MAM Kayıtlarını Gör'}</span>
                        </button>

                        {cat.hasUpdates && onSyncDelta ? (
                          <button
                            onClick={() => onSyncDelta(cat.categoryId)}
                            disabled={isSyncingDelta || isThisSyncing || isSyncingAll}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              borderRadius: '7px',
                              border: 'none',
                              background: '#10b981',
                              color: '#fff',
                              fontSize: '11px',
                              fontWeight: '800',
                              cursor: isSyncingDelta ? 'wait' : 'pointer'
                            }}
                            title="Sadece yeni eklenen klipleri hızlı çek"
                          >
                            <Zap size={12} />
                            <span>Yeni Klipleri Çek (+{newDiff})</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onSyncCategory(cat.categoryId)}
                            disabled={isThisSyncing || isSyncingAll}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              borderRadius: '7px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-primary)',
                              color: 'var(--text-primary)',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: isThisSyncing ? 'wait' : 'pointer'
                            }}
                            title="Bu kategorinin tüm kliplerini baştan tara"
                          >
                            <RefreshCw size={12} style={{ animation: isThisSyncing ? 'spin 1s linear infinite' : 'none' }} />
                            <span>{isThisSyncing ? 'Taranıyor...' : 'Tam Tara'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MamDatabaseSyncPanel;
