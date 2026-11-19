/**
 * @file src/components/Ads/AdVideoPlayer.jsx
 * @description Reklam ve medya klipleri için yüksek performanslı, kararlı HTML5 H.264 (yuv420p) canlı akış video oynatıcısı.
 * autoPlay={false} olduğunda sunucuda otomatik FFmpeg akışı başlatmaz; kullanıcı "Videoyu Oynat" butonuna tıkladığında başlatır.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Film, RefreshCw, AlertCircle, CheckCircle2, Play } from 'lucide-react';

const AdVideoPlayer = ({ material, autoPlay = false }) => {
  const [isPlaybackStarted, setIsPlaybackStarted] = useState(Boolean(autoPlay));
  const [status, setStatus] = useState(autoPlay ? 'loading' : 'idle'); // 'idle' | 'loading' | 'ready' | 'error'
  const [retryCount, setRetryCount] = useState(0);
  const videoRef = useRef(null);

  const clipId = material?.clipId || material?.id || '';
  const code = material?.code || material?.fileName || '';
  const clipName = material?.clipName || material?.name || '';

  const streamUrl = useMemo(() => {
    if (!clipId && !code && !clipName) return '';
    const params = new URLSearchParams();
    if (clipId) params.set('id', String(clipId));
    if (code) params.set('code', String(code));
    if (code) params.set('fileName', String(code));
    if (clipName) params.set('clipName', String(clipName));
    if (retryCount > 0) params.set('r', String(retryCount));
    return `/api/stream?${params.toString()}`;
  }, [clipId, code, clipName, retryCount]);

  // Materyal değiştiğinde autoPlay kapalıysa otomatik oynatmayı durdur ve bekleme moduna al
  useEffect(() => {
    if (autoPlay) {
      setIsPlaybackStarted(true);
      setStatus('loading');
    } else {
      setIsPlaybackStarted(false);
      setStatus('idle');
    }
  }, [streamUrl, autoPlay]);

  const handleStartPlayback = () => {
    setIsPlaybackStarted(true);
    setStatus('loading');
  };

  if (!material) return null;

  return (
    <div
      style={{
        width: '100%',
        borderRadius: '10px',
        overflow: 'hidden',
        background: '#0b0f19',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        boxShadow: '0 8px 20px -4px rgba(15, 23, 42, 0.25)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Otomatik oynatma kapalıyken gösterilen temiz kapak ekranı */}
        {!isPlaybackStarted && (
          <div
            onClick={handleStartPlayback}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '16px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'radial-gradient(circle at center, rgba(37, 99, 235, 0.18) 0%, rgba(15, 23, 42, 0.92) 75%)'
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'var(--ads-brand, #0066ff)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 20px rgba(0, 102, 255, 0.45)',
                transition: 'transform 0.2s ease'
              }}
            >
              <Play size={22} fill="#ffffff" style={{ marginLeft: '2px' }} />
            </div>
            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#f8fafc', maxWidth: '85%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {clipName || 'Reklam Klibi'}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              Önizlemeyi başlatmak için tıklayın ({material.duration || 0} sn)
            </div>
          </div>
        )}

        {isPlaybackStarted && streamUrl && (
          <video
            ref={videoRef}
            key={streamUrl}
            src={streamUrl}
            controls
            autoPlay
            playsInline
            preload="metadata"
            onLoadedData={() => setStatus('ready')}
            onCanPlay={() => setStatus('ready')}
            onPlaying={() => setStatus('ready')}
            onError={() => setStatus('error')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: status === 'error' ? 'none' : 'block',
              background: '#000'
            }}
          />
        )}

        {isPlaybackStarted && status === 'loading' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(11, 15, 25, 0.72)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: '#e2e8f0',
              pointerEvents: 'none'
            }}
          >
            <RefreshCw size={22} color="#3b82f6" className="spin" />
            <span style={{ fontSize: '12px', fontWeight: '600' }}>Video akışı hazırlanıyor...</span>
          </div>
        )}

        {isPlaybackStarted && status === 'error' && (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              color: '#94a3b8'
            }}
          >
            <AlertCircle size={26} color="#f59e0b" />
            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#f1f5f9' }}>
              Video dosyası arşiv sunucusunda açılamadı
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', maxWidth: '280px' }}>
              Klip (#{clipId}) eski arşiv dizininde yer alıyor olabilir veya sunucu bağlantısı bekleniyor.
            </div>
            <button
              onClick={() => {
                setStatus('loading');
                setRetryCount(c => c + 1);
              }}
              style={{
                marginTop: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(59, 130, 246, 0.45)',
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={12} /> Tekrar Dene
            </button>
          </div>
        )}
      </div>

      {/* Alt Durum Çubuğu */}
      <div
        style={{
          padding: '6px 12px',
          background: '#111827',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#9ca3af'
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: '600', color: '#d1d5db' }}>
          <Film size={12} color="#60a5fa" />
          #{clipId} • {code || clipName}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color:
              status === 'ready'
                ? '#34d399'
                : status === 'error'
                ? '#f87171'
                : status === 'loading'
                ? '#60a5fa'
                : '#94a3b8',
            fontWeight: '700'
          }}
        >
          {status === 'ready' && <CheckCircle2 size={11} />}
          {status === 'ready'
            ? 'Canlı Akış Aktif'
            : status === 'error'
            ? 'Dosya Bulunamadı'
            : status === 'loading'
            ? 'Bağlanıyor...'
            : 'Hazır (Oynatmak İçin Tıklayın)'}
        </span>
      </div>
    </div>
  );
};

export default React.memo(AdVideoPlayer);
