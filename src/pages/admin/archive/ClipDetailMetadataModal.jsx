/**
 * @file src/pages/admin/archive/ClipDetailMetadataModal.jsx
 * @description Kliplerin (özellikle Programlar ve MAM Arşiv sekmelerinde) yanındaki "ⓘ" (Information)
 * butonuna tıklandığında açılan; Klip Detayları, MSSQL/PostgreSQL Veritabanı Metadataları, Kategori Şeması
 * ve Canlı Video İzleme (/api/stream + Plyr) özelliklerini sunan kapsamlı bilgi modalı.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Info, Play, Film, Database, Tag, Clock, Calendar,
  Folder, Hash, Layers, RefreshCw, CheckCircle2, AlertCircle, Search
} from 'lucide-react';
import { Plyr } from 'plyr-react';
import 'plyr-react/plyr.css';
import { formatTimecode } from '../../../utils/formatTimecode';
import { MSSQL_CATEGORIES } from '../../../utils/categoryColors';

const DetailRow = ({ label, value, mono = false, highlight = false }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: '135px 1fr',
    gap: '10px',
    padding: '7px 10px',
    borderBottom: '1px solid var(--border-color)',
    alignItems: 'center',
    fontSize: '12px'
  }}>
    <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>{label}:</span>
    <span style={{
      color: highlight ? '#10b981' : 'var(--text-primary)',
      fontWeight: highlight ? '800' : '600',
      fontFamily: mono ? 'monospace' : 'inherit',
      wordBreak: 'break-all'
    }}>
      {value !== null && value !== undefined && value !== '' ? value : '-'}
    </span>
  </div>
);

export default function ClipDetailMetadataModal({
  isOpen = true,
  onClose,
  clip,
  program = null
}) {
  const [loading, setLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [activeMetaTab, setActiveMetaTab] = useState('filled'); // 'filled' | 'schema'
  const [metaSearch, setMetaSearch] = useState('');
  const [isPlayerActive, setIsPlayerActive] = useState(false);

  useEffect(() => {
    if (!isOpen || !clip) {
      setDetailData(null);
      setIsPlayerActive(false);
      return;
    }

    let isMounted = true;
    setMetaSearch('');
    setIsPlayerActive(false);

    const fetchClipFullDetails = async () => {
      try {
        setLoading(true);
        let targetFileId = clip.fileId;

        // Eğer klipte fileId yoksa klip adından MAM arşivinden bulmayı dene
        if (!targetFileId && (clip.name || clip.title)) {
          const searchQ = clip.name || clip.title;
          const searchRes = await fetch(`/api/archive/clips/search?q=${encodeURIComponent(searchQ)}&limit=5`);
          if (searchRes.ok) {
            const searchJson = await searchRes.json();
            const foundList = Array.isArray(searchJson?.clips) ? searchJson.clips : (Array.isArray(searchJson) ? searchJson : []);
            const exact = foundList.find(c => (c.name || '').toLowerCase() === searchQ.toLowerCase()) || foundList[0];
            if (exact?.fileId) {
              targetFileId = exact.fileId;
            }
          }
        }

        if (targetFileId) {
          const res = await fetch(`/api/archive/clip/${targetFileId}/metadata`);
          if (res.ok) {
            const data = await res.json();
            if (isMounted) {
              setDetailData(data);
            }
          }
        }
      } catch (err) {
        console.error('Klip detay ve metadata okuma hatası:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchClipFullDetails();
    return () => {
      isMounted = false;
    };
  }, [isOpen, clip]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const mergedFile = useMemo(() => {
    const apiFile = detailData?.file || {};
    const catId = apiFile.categoryId || clip?.categoryId || program?.categoryId || 4;
    const catMeta = MSSQL_CATEGORIES[catId] || {
      name: apiFile.categoryName || clip?.categoryName || program?.categoryName || `Kategori ${catId}`,
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.15)',
      border: 'rgba(59, 130, 246, 0.35)'
    };

    return {
      fileId: clip?.fileId || apiFile.fileId,
      name: apiFile.name || clip?.name || clip?.title || '',
      fileName: apiFile.fileName || clip?.fileName || '',
      extension: apiFile.extension || clip?.extension || '',
      durationSec: clip?.durationSec || apiFile.durationSec || 0,
      durationFormatted: clip?.durationFormatted || apiFile.durationFormatted || formatTimecode(clip?.durationSec || apiFile.durationSec || 0),
      categoryId: catId,
      categoryName: apiFile.categoryName || clip?.categoryName || program?.categoryName || catMeta.name,
      catMeta,
      programTitle: apiFile.programTitle || program?.title || clip?.programTitle || 'Genel Arşiv',
      episodeNo: clip?.episodeNo ?? apiFile.episodeNo ?? null,
      partNo: clip?.partNo ?? apiFile.partNo ?? null,
      unitType: clip?.unitType || apiFile.unitType || program?.unitType || 'bolum',
      unitLabel: clip?.unitLabel || apiFile.unitLabel || (
        (clip?.episodeNo ?? apiFile.episodeNo) != null
          ? ((clip?.unitType || apiFile.unitType || program?.unitType) === 'cuz'
              ? `${clip?.episodeNo ?? apiFile.episodeNo}. Cüz`
              : (clip?.unitType || apiFile.unitType || program?.unitType) === 'gun'
                ? `${clip?.episodeNo ?? apiFile.episodeNo}. Gün`
                : `Bölüm ${clip?.episodeNo ?? apiFile.episodeNo}`)
          : null
      ),
      note: clip?.note || apiFile.note || '',
      fileCreateTime: apiFile.fileCreateTime || clip?.fileCreateTime || null,
      publicFileAddress: apiFile.publicFileAddress || clip?.publicFileAddress || '',
      fileServerPath: apiFile.fileServerPath || clip?.fileServerPath || '',
      trimIn: apiFile.trimIn ?? clip?.trimIn ?? null,
      trimOut: apiFile.trimOut ?? clip?.trimOut ?? null
    };
  }, [clip, program, detailData]);

  // Klipte dolu olan veritabanı metadataları
  const filledMetadataList = useMemo(() => {
    if (Array.isArray(detailData?.metadata) && detailData.metadata.length > 0) {
      return detailData.metadata;
    }
    if (Array.isArray(clip?.metadata) && clip.metadata.length > 0) {
      return clip.metadata;
    }
    return [];
  }, [detailData, clip]);

  // Kategori şeması listesi
  const categorySchemaList = useMemo(() => {
    if (Array.isArray(detailData?.categorySchema) && detailData.categorySchema.length > 0) {
      return detailData.categorySchema;
    }
    return filledMetadataList;
  }, [detailData, filledMetadataList]);

  // Özetlenmiş editoryal metadata alanları
  const summaryBadges = useMemo(() => {
    const summary = clip?.metadataSummary || {};
    const list = [];
    const findMetaVal = (keyPart) => {
      const m = filledMetadataList.find(item => (item.keyName || '').toLowerCase().includes(keyPart));
      return m?.val || null;
    };

    const bolumAdi = summary.bolumAdi || findMetaVal('bölüm adı') || findMetaVal('bolum adi');
    const bolumNo = summary.bolumNo || findMetaVal('bölüm numarası') || findMetaVal('bölüm no');
    const konu = summary.konu || findMetaVal('konu');
    const sunucu = summary.sunucu || findMetaVal('sunucu');
    const konuk = summary.konuk || findMetaVal('konuk');
    const yonetmen = summary.yonetmen || findMetaVal('yönetmen');
    const yapimci = summary.yapimci || findMetaVal('yapımcı');
    const kurgucu = summary.kurgucu || findMetaVal('kurgucu');
    const yayinTarihi = summary.yayinTarihi || findMetaVal('yayın tarihi');

    if (bolumNo) list.push({ label: 'Bölüm No (#22)', val: bolumNo, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.14)' });
    if (bolumAdi) list.push({ label: 'Bölüm Adı (#23)', val: bolumAdi, color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.14)' });
    if (konu && konu !== bolumAdi) list.push({ label: 'Konu (#47)', val: konu, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)' });
    if (sunucu) list.push({ label: 'Sunucu (#14)', val: sunucu, color: '#10b981', bg: 'rgba(16, 185, 129, 0.14)' });
    if (konuk) list.push({ label: 'Konuk (#15)', val: konuk, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.14)' });
    if (yonetmen) list.push({ label: 'Yönetmen (#9)', val: yonetmen, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.14)' });
    if (yapimci) list.push({ label: 'Yapımcı (#25)', val: yapimci, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.14)' });
    if (kurgucu) list.push({ label: 'Kurgucu (#8)', val: kurgucu, color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.14)' });
    if (yayinTarihi) list.push({ label: 'Yayın Tarihi (#24)', val: yayinTarihi, color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' });

    return list;
  }, [clip, filledMetadataList]);

  const displayedMetadataRows = useMemo(() => {
    const base = activeMetaTab === 'filled' ? filledMetadataList : categorySchemaList;
    if (!metaSearch.trim()) return base;
    const q = metaSearch.toLowerCase().trim();
    return base.filter(
      m =>
        (m.keyName || '').toLowerCase().includes(q) ||
        String(m.val || '').toLowerCase().includes(q) ||
        String(m.metadataId || '').includes(q)
    );
  }, [activeMetaTab, filledMetadataList, categorySchemaList, metaSearch]);

  if (!isOpen || !clip) return null;

  const formatDateFull = (dStr) => {
    if (!dStr) return '-';
    try {
      return new Date(dStr).toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dStr;
    }
  };

  const formatReadableDuration = (sec) => {
    if (!sec || isNaN(sec)) return '0 sn';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const parts = [];
    if (h > 0) parts.push(`${h} sa`);
    if (m > 0) parts.push(`${m} dk`);
    if (s > 0 || parts.length === 0) parts.push(`${s} sn`);
    return parts.join(' ');
  };

  const streamUrl = `/api/stream?id=${mergedFile.fileId || ''}&fileName=${encodeURIComponent(mergedFile.fileName || mergedFile.name || '')}&publicAddress=${encodeURIComponent(mergedFile.publicFileAddress || '')}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10050,
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '18px',
          width: '100%',
          maxWidth: '1080px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden'
        }}
      >
        {/* Üst Başlık */}
        <div style={{
          padding: '16px 22px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)'
            }}>
              <Info size={22} />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: '800',
                  color: 'var(--text-primary)',
                  wordBreak: 'break-word'
                }}>
                  {mergedFile.name}
                </h3>
                <span style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '800',
                  fontFamily: 'monospace'
                }}>
                  MAM ID: #{mergedFile.fileId}
                </span>
                <span style={{
                  background: mergedFile.catMeta.bg,
                  color: mergedFile.catMeta.color,
                  border: `1px solid ${mergedFile.catMeta.border || mergedFile.catMeta.color}`,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '800'
                }}>
                  #{mergedFile.categoryId} {mergedFile.categoryName}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>
                  Program: <strong style={{ color: 'var(--text-primary)' }}>{mergedFile.programTitle}</strong>
                </span>
                {mergedFile.unitLabel && (
                  <span>• <strong style={{ color: '#3b82f6' }}>{mergedFile.unitLabel}</strong></span>
                )}
                {mergedFile.partNo !== null && (
                  <span>• <strong style={{ color: '#f59e0b' }}>Part {mergedFile.partNo}</strong></span>
                )}
                <span>
                  • Süre: <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>{mergedFile.durationFormatted}</strong> ({formatReadableDuration(mergedFile.durationSec)})
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Kapat (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Ana İçerik: Sol (Video İzleme + Klip Detayları) | Sağ (DB Metadatalar & Kategori Şeması) */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 22px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '20px',
          alignItems: 'start'
        }}>
          {/* SOL SÜTUN: Video İzleme + Klip Teknik Detayları */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Video Önizleme / İzleme Kartı */}
            <div style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '10px 14px',
                background: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  <Play size={15} color="#10b981" fill="#10b981" />
                  <span>Klip Video Önizleme & İzleme</span>
                </div>
                {isPlayerActive ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlayerActive(false);
                      setTimeout(() => setIsPlayerActive(true), 80);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                    title="Akışı Yeniden Başlat"
                  >
                    <RefreshCw size={12} />
                    <span>Akışı Yenile</span>
                  </button>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                    İzlemek için video alanına tıklayın
                  </span>
                )}
              </div>

              <div style={{
                width: '100%',
                aspectRatio: '16/9',
                background: '#090d16',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                {isPlayerActive && (mergedFile.fileId || mergedFile.fileName || mergedFile.name) ? (
                  <div style={{ width: '100%', height: '100%' }}>
                    <Plyr
                      source={{
                        type: 'video',
                        sources: [
                          {
                            src: streamUrl,
                            type: 'video/mp4'
                          }
                        ]
                      }}
                      options={{
                        autoplay: true,
                        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
                        duration: mergedFile.durationSec || undefined
                      }}
                    />
                  </div>
                ) : (
                  <div
                    onClick={() => setIsPlayerActive(true)}
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      background: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.16) 0%, rgba(9, 13, 22, 0.96) 75%)',
                      padding: '24px',
                      textAlign: 'center',
                      userSelect: 'none'
                    }}
                    title="Videoyu başlatmak ve FFmpeg akışını çalıştırmak için tıklayın"
                  >
                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 26px rgba(16, 185, 129, 0.45)',
                      border: '2px solid rgba(255,255,255,0.25)'
                    }}>
                      <Play size={28} color="#fff" fill="#fff" style={{ marginLeft: '3px' }} />
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#fff' }}>
                      Videoyu Oynatmak İçin Tıklayın
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.68)', maxWidth: '340px' }}>
                      {mergedFile.name} • {mergedFile.durationFormatted}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Klip Teknik ve Dosya Detayları */}
            <div style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '10px 14px',
                background: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12.5px',
                fontWeight: '800',
                color: 'var(--text-primary)'
              }}>
                <Film size={15} color="#3b82f6" />
                <span>Klip Detay ve Teknik Dosya Bilgileri</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {clip?.order && (
                  <DetailRow label="Yayın Sıra No" value={`#${clip.order}`} mono highlight />
                )}
                {clip?.calculatedStartTime && (
                  <DetailRow
                    label="Planlanan Yayın Saati"
                    value={`${clip.calculatedStartTime} → ${clip.calculatedEndTime || ''}`}
                    mono
                    highlight
                  />
                )}
                <DetailRow label="MAM Dosya ID" value={mergedFile.fileId ? `#${mergedFile.fileId}` : '-'} mono />
                <DetailRow label="MAM Klip Adı" value={mergedFile.name} />
                <DetailRow
                  label="Fiziksel Dosya"
                  value={mergedFile.fileName ? `${mergedFile.fileName}${mergedFile.extension && !mergedFile.fileName.endsWith(mergedFile.extension) ? mergedFile.extension : ''}` : '-'}
                  mono
                />
                <DetailRow label="Bağlı Program" value={mergedFile.programTitle} />
                <DetailRow label="Kategori" value={`#${mergedFile.categoryId} — ${mergedFile.categoryName}`} />
                <DetailRow
                  label={mergedFile.unitType === 'cuz' ? 'Cüz / Parça' : mergedFile.unitType === 'gun' ? 'Gün / Parça' : 'Bölüm / Parça'}
                  value={`${mergedFile.unitLabel || 'Genel / Tekil'}${mergedFile.partNo !== null ? ` • Part ${mergedFile.partNo}` : ''}`}
                />
                <DetailRow label="Bölüm / Özel Not" value={mergedFile.note || '-'} />
                <DetailRow
                  label="Klip Süresi"
                  value={`${mergedFile.durationFormatted} (${formatReadableDuration(mergedFile.durationSec)})`}
                  mono
                  highlight
                />
                <DetailRow label="Kayıt Tarihi" value={formatDateFull(mergedFile.fileCreateTime)} />
                {(mergedFile.trimIn !== null || mergedFile.trimOut !== null) && (
                  <DetailRow label="Trim In / Out" value={`In: ${mergedFile.trimIn ?? 0} — Out: ${mergedFile.trimOut ?? 0}`} mono />
                )}
                {mergedFile.publicFileAddress && (
                  <DetailRow label="Arşiv Dosya Yolu" value={mergedFile.publicFileAddress} mono />
                )}
                {mergedFile.fileServerPath && mergedFile.fileServerPath !== mergedFile.publicFileAddress && (
                  <DetailRow label="Sunucu Yolu" value={mergedFile.fileServerPath} mono />
                )}
              </div>
            </div>
          </div>

          {/* SAĞ SÜTUN: Veritabanı Metadataları & Kategori Şeması */}
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '12px 16px',
              background: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                <Database size={16} color="#a855f7" />
                <span>Veritabanı Metadataları (MSSQL & PG)</span>
                {loading && <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} color="var(--accent-primary)" />}
              </div>

              {/* Sekme Değiştirici: Dolu Metadatalar vs Kategori Şeması */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setActiveMetaTab('filled')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: activeMetaTab === 'filled' ? '1px solid #a855f7' : '1px solid var(--border-color)',
                    background: activeMetaTab === 'filled' ? 'rgba(168, 85, 247, 0.18)' : 'var(--bg-secondary)',
                    color: activeMetaTab === 'filled' ? '#a855f7' : 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Klip Metadataları ({filledMetadataList.length})
                </button>
                {categorySchemaList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveMetaTab('schema')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: activeMetaTab === 'schema' ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                      background: activeMetaTab === 'schema' ? 'rgba(59, 130, 246, 0.18)' : 'var(--bg-secondary)',
                      color: activeMetaTab === 'schema' ? '#3b82f6' : 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Kategori Şeması ({categorySchemaList.length})
                  </button>
                )}
              </div>
            </div>

            {/* Öne Çıkan Editoryal Metadata Rozetleri */}
            {summaryBadges.length > 0 && (
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Öne Çıkan Editoryal & Bölüm Metadataları
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {summaryBadges.map((b, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: b.bg,
                        border: `1px solid ${b.color}40`,
                        borderRadius: '8px',
                        padding: '5px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}
                    >
                      <span style={{ fontSize: '9.5px', fontWeight: '700', color: b.color, opacity: 0.9 }}>
                        {b.label}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>
                        {b.val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata Arama Çubuğu */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '6px 10px'
              }}>
                <Search size={13} color="var(--text-secondary)" />
                <input
                  type="text"
                  placeholder="Metadata alanı veya değer içinde ara..."
                  value={metaSearch}
                  onChange={(e) => setMetaSearch(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    width: '100%'
                  }}
                />
                {metaSearch && (
                  <button
                    type="button"
                    onClick={() => setMetaSearch('')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Metadata Tablosu */}
            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {loading && displayedMetadataRows.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                  <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
                  <div>Veritabanından klip metadataları okunuyor...</div>
                </div>
              ) : displayedMetadataRows.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <AlertCircle size={26} style={{ marginBottom: '8px', opacity: 0.6 }} />
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {metaSearch
                      ? 'Aramaya uygun metadata alanı bulunamadı.'
                      : 'Bu klip için veritabanında kayıtlı metadata alanı bulunmuyor.'}
                  </div>
                  {activeMetaTab === 'filled' && categorySchemaList.length > 0 && !metaSearch && (
                    <button
                      type="button"
                      onClick={() => setActiveMetaTab('schema')}
                      style={{
                        marginTop: '10px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--accent-primary)',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Kategori Metadata Şemasını Gör ({categorySchemaList.length})
                    </button>
                  )}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '8px 14px', fontWeight: '700', width: '190px' }}>Metadata Alanı</th>
                      <th style={{ padding: '8px 14px', fontWeight: '700' }}>Değer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedMetadataRows.map((m, idx) => {
                      const hasVal = m.val !== null && m.val !== undefined && String(m.val).trim() !== '';
                      return (
                        <tr
                          key={`${m.metadataId || idx}-${m.keyName}`}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'
                          }}
                        >
                          <td style={{ padding: '9px 14px', fontWeight: '700', color: 'var(--text-secondary)', verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Tag size={12} color={hasVal ? '#a855f7' : 'var(--text-muted)'} />
                              <span>{m.keyName}</span>
                              {m.metadataId && (
                                <span style={{ fontSize: '10px', fontFamily: 'monospace', opacity: 0.6 }}>
                                  (#{m.metadataId})
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{
                            padding: '9px 14px',
                            fontWeight: hasVal ? '700' : '500',
                            color: hasVal ? 'var(--text-primary)' : 'var(--text-muted)',
                            fontStyle: hasVal ? 'normal' : 'italic',
                            wordBreak: 'break-word'
                          }}>
                            {hasVal ? m.val : 'Belirtilmemiş'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Alt Bar */}
        <div style={{
          padding: '12px 22px',
          background: 'var(--bg-tertiary)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: 'var(--text-secondary)'
        }}>
          <span>
            Toplam <strong>{filledMetadataList.length}</strong> dolu metadata alanı • Kategori Şeması: <strong>{categorySchemaList.length}</strong> alan
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 18px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

