/**
 * @file src/components/Ads/AdVideoPlayer.jsx
 * @description Reklam ve medya klipleri için ileri-geri sarılabilir (HTTP 206 Byte-Range),
 * kare (frame) hassasiyetinde adım kontrolü (-5sn, -1sn, -1 Kare, +1 Kare, +1sn, +5sn) ve
 * canlı SMPTE Timecode / FPS (25, 30, 50 Kare) göstergeli HTML5 H.264 video oynatıcısı.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Film,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Maximize2
} from 'lucide-react';

export function computeSmpteTimecode(secondsFloat, fps = 25) {
  const safeFps = Math.round(Number(fps) || 25);
  const clampedSec = Math.max(0, Number(secondsFloat) || 0);
  const totalFrames = Math.round(clampedSec * safeFps);
  const frameInSec = totalFrames % safeFps;
  const totalWholeSeconds = Math.floor(totalFrames / safeFps);
  const secs = totalWholeSeconds % 60;
  const mins = Math.floor(totalWholeSeconds / 60) % 60;
  const hours = Math.floor(totalWholeSeconds / 3600);
  const pad = n => String(n).padStart(2, '0');
  return {
    timecode: `${pad(hours)}:${pad(mins)}:${pad(secs)}:${pad(frameInSec)}`,
    shortTimecode: hours > 0 ? `${pad(hours)}:${pad(mins)}:${pad(secs)}:${pad(frameInSec)}` : `${pad(mins)}:${pad(secs)}:${pad(frameInSec)}`,
    totalFrames,
    wholeSeconds: totalWholeSeconds,
    extraFrames: frameInSec
  };
}

const AdVideoPlayer = ({ material, autoPlay = false, mediaInfo = null }) => {
  const [isPlaybackStarted, setIsPlaybackStarted] = useState(Boolean(autoPlay));
  const [status, setStatus] = useState(autoPlay ? 'loading' : 'idle'); // 'idle' | 'loading' | 'ready' | 'error'
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [retryCount, setRetryCount] = useState(0);
  const videoRef = useRef(null);

  const clipId = material?.clipId || material?.materialId || material?.id || '';
  const code = material?.code || material?.fileName || '';
  const clipName = material?.clipName || material?.materialName || material?.name || '';

  const effectiveFps = useMemo(() => {
    const probed = Number(mediaInfo?.fps);
    if (probed > 0) return probed;
    return Number(material?.fps) || 25;
  }, [mediaInfo, material]);

  const fallbackDurationSec = useMemo(() => {
    if (Number(mediaInfo?.durationSecExact) > 0) return Number(mediaInfo.durationSecExact);
    if (Number(material?.durationMs) > 600) return Number(material.durationMs) / 1000;
    const raw = Number(material?.duration || material?.durationSec || 0);
    if (raw > 600) return raw / 1000;
    return raw > 0 ? raw : 30;
  }, [mediaInfo, material]);

  const effectiveDurationSec = videoDuration > 0 ? videoDuration : fallbackDurationSec;

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

  useEffect(() => {
    setCurrentTime(0);
    setVideoDuration(0);
    setIsPlaying(false);
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

  const togglePlayPause = useCallback(() => {
    const v = videoRef.current;
    if (!v) {
      handleStartPlayback();
      return;
    }
    if (v.paused || v.ended) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, []);

  const seekToTime = useCallback(
    targetSec => {
      const v = videoRef.current;
      const maxDur = effectiveDurationSec > 0 ? effectiveDurationSec : 3600;
      const clamped = Math.max(0, Math.min(maxDur, Number(targetSec) || 0));
      setCurrentTime(clamped);
      if (v) {
        try {
          v.currentTime = clamped;
        } catch (_) {}
      }
    },
    [effectiveDurationSec]
  );

  const seekBySeconds = useCallback(
    deltaSec => {
      const v = videoRef.current;
      const base = v ? v.currentTime : currentTime;
      seekToTime(base + deltaSec);
    },
    [currentTime, seekToTime]
  );

  const stepByFrames = useCallback(
    frameDelta => {
      const v = videoRef.current;
      if (v && !v.paused) {
        v.pause();
      }
      const frameStepSec = 1 / Math.max(1, Math.round(effectiveFps));
      const base = v ? v.currentTime : currentTime;
      seekToTime(base + frameDelta * frameStepSec);
    },
    [currentTime, effectiveFps, seekToTime]
  );

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  const cyclePlaybackRate = () => {
    const rates = [0.5, 1, 1.25, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextRate;
    }
  };

  const handleFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen();
    else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen();
  };

  const currentTc = useMemo(() => computeSmpteTimecode(currentTime, effectiveFps), [currentTime, effectiveFps]);
  const totalTc = useMemo(() => computeSmpteTimecode(effectiveDurationSec, effectiveFps), [effectiveDurationSec, effectiveFps]);

  if (!material) return null;

  return (
    <div
      style={{
        width: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        background: '#0b0f19',
        border: '1px solid rgba(148, 163, 184, 0.25)',
        boxShadow: '0 10px 25px -4px rgba(15, 23, 42, 0.35)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* VİDEO GÖRÜNTÜ ALANI */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          background: 'linear-gradient(135deg, #090d16 0%, #1e293b 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
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
              background: 'radial-gradient(circle at center, rgba(37, 99, 235, 0.2) 0%, rgba(15, 23, 42, 0.94) 75%)'
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 22px rgba(37, 99, 235, 0.5)'
              }}
            >
              <Play size={24} fill="#ffffff" style={{ marginLeft: '3px' }} />
            </div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#f8fafc', maxWidth: '88%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {clipName || 'Reklam Klibi'}
            </div>
            <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
              Önizlemeyi başlatmak için tıklayın ({totalTc.wholeSeconds} sn {totalTc.extraFrames > 0 ? `${totalTc.extraFrames} kare` : ''} • {Math.round(effectiveFps)} FPS)
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
            preload="auto"
            onLoadedMetadata={e => {
              const dur = Number(e.currentTarget.duration);
              if (dur > 0 && isFinite(dur)) {
                setVideoDuration(dur);
              }
              setStatus('ready');
            }}
            onLoadedData={() => setStatus('ready')}
            onCanPlay={() => setStatus('ready')}
            onPlay={() => {
              setStatus('ready');
              setIsPlaying(true);
            }}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onTimeUpdate={e => {
              setCurrentTime(e.currentTarget.currentTime || 0);
            }}
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

        {/* ÜST CANLI TIMECODE & FPS ROZETİ */}
        {isPlaybackStarted && status === 'ready' && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              right: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pointerEvents: 'none',
              gap: '8px'
            }}
          >
            <span
              style={{
                padding: '3px 9px',
                borderRadius: '6px',
                background: 'rgba(15, 23, 42, 0.82)',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                color: '#38bdf8',
                fontSize: '11.5px',
                fontWeight: '800',
                fontFamily: 'monospace',
                backdropFilter: 'blur(4px)'
              }}
            >
              TC: {currentTc.timecode} / {totalTc.timecode}
            </span>
            <span
              style={{
                padding: '3px 9px',
                borderRadius: '6px',
                background: 'rgba(15, 23, 42, 0.82)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#34d399',
                fontSize: '11px',
                fontWeight: '800',
                fontFamily: 'monospace',
                backdropFilter: 'blur(4px)'
              }}
            >
              Kare: {currentTc.totalFrames} / {totalTc.totalFrames} • {Math.round(effectiveFps)} FPS
            </span>
          </div>
        )}

        {isPlaybackStarted && status === 'loading' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(11, 15, 25, 0.76)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: '#e2e8f0',
              pointerEvents: 'none'
            }}
          >
            <RefreshCw size={24} color="#3b82f6" className="spin" />
            <span style={{ fontSize: '12.5px', fontWeight: '700' }}>İleri-geri sarılabilir video akışı hazırlanıyor...</span>
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
            <AlertCircle size={28} color="#f59e0b" />
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#f1f5f9' }}>
              Video dosyası arşiv sunucusunda açılamadı
            </div>
            <div style={{ fontSize: '11.5px', color: '#94a3b8', maxWidth: '310px' }}>
              Klip (#{clipId} • {code || clipName}) medya arşiv dizininde bulunamadı veya ağ paylaşımı kontrol ediliyor.
            </div>
            <button
              type="button"
              onClick={() => {
                setStatus('loading');
                setRetryCount(c => c + 1);
              }}
              style={{
                marginTop: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '7px',
                border: '1px solid rgba(59, 130, 246, 0.45)',
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                fontSize: '11.5px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={12} /> Tekrar Dene
            </button>
          </div>
        )}
      </div>

      {/* HASSAS İLERİ-GERİ SARMA (SEEK BAR) VE KARE / SANİYE KONTROL PANELİ */}
      <div
        style={{
          padding: '10px 12px',
          background: '#0f172a',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        {/* İnteraktif Zaman Çubuğu (Scrubber) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '800', color: '#38bdf8', minWidth: '68px' }}>
            {currentTc.timecode}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(0.1, effectiveDurationSec)}
            step={1 / Math.max(1, Math.round(effectiveFps))}
            value={Math.min(currentTime, Math.max(0.1, effectiveDurationSec))}
            onChange={e => {
              if (!isPlaybackStarted) handleStartPlayback();
              seekToTime(parseFloat(e.target.value));
            }}
            style={{
              flex: 1,
              accentColor: '#3b82f6',
              cursor: 'pointer',
              height: '6px'
            }}
            title="İleri veya geri sarmak için sürükleyin"
          />
          <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', color: '#94a3b8', minWidth: '68px', textAlign: 'right' }}>
            {totalTc.timecode}
          </span>
        </div>

        {/* İleri / Geri Sarma ve Kare Adım Butonları */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => seekBySeconds(-5)}
              disabled={!isPlaybackStarted || status !== 'ready'}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                background: 'rgba(30, 41, 59, 0.9)',
                color: '#e2e8f0',
                fontSize: '11px',
                fontWeight: '800',
                cursor: isPlaybackStarted && status === 'ready' ? 'pointer' : 'not-allowed',
                opacity: isPlaybackStarted && status === 'ready' ? 1 : 0.5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title="5 Saniye Geri Sar"
            >
              <SkipBack size={11} /> -5sn
            </button>

            <button
              type="button"
              onClick={() => seekBySeconds(-1)}
              disabled={!isPlaybackStarted || status !== 'ready'}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                background: 'rgba(30, 41, 59, 0.9)',
                color: '#e2e8f0',
                fontSize: '11px',
                fontWeight: '800',
                cursor: isPlaybackStarted && status === 'ready' ? 'pointer' : 'not-allowed',
                opacity: isPlaybackStarted && status === 'ready' ? 1 : 0.5
              }}
              title="1 Saniye Geri Sar"
            >
              -1sn
            </button>

            <button
              type="button"
              onClick={() => stepByFrames(-1)}
              disabled={!isPlaybackStarted || status !== 'ready'}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                background: 'rgba(2, 132, 199, 0.18)',
                color: '#38bdf8',
                fontSize: '11px',
                fontWeight: '800',
                cursor: isPlaybackStarted && status === 'ready' ? 'pointer' : 'not-allowed',
                opacity: isPlaybackStarted && status === 'ready' ? 1 : 0.5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px'
              }}
              title="1 Kare (Frame) Geri"
            >
              <ChevronLeft size={12} /> -1 Kare
            </button>

            <button
              type="button"
              onClick={togglePlayPause}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                background: isPlaying ? '#f59e0b' : '#2563eb',
                color: '#fff',
                fontSize: '11.5px',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              {isPlaying ? <Pause size={12} /> : <Play size={12} fill="#fff" />}
              {isPlaying ? 'Duraklat' : 'Oynat'}
            </button>

            <button
              type="button"
              onClick={() => stepByFrames(1)}
              disabled={!isPlaybackStarted || status !== 'ready'}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                background: 'rgba(2, 132, 199, 0.18)',
                color: '#38bdf8',
                fontSize: '11px',
                fontWeight: '800',
                cursor: isPlaybackStarted && status === 'ready' ? 'pointer' : 'not-allowed',
                opacity: isPlaybackStarted && status === 'ready' ? 1 : 0.5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px'
              }}
              title="1 Kare (Frame) İleri"
            >
              +1 Kare <ChevronRight size={12} />
            </button>

            <button
              type="button"
              onClick={() => seekBySeconds(1)}
              disabled={!isPlaybackStarted || status !== 'ready'}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                background: 'rgba(30, 41, 59, 0.9)',
                color: '#e2e8f0',
                fontSize: '11px',
                fontWeight: '800',
                cursor: isPlaybackStarted && status === 'ready' ? 'pointer' : 'not-allowed',
                opacity: isPlaybackStarted && status === 'ready' ? 1 : 0.5
              }}
              title="1 Saniye İleri Sar"
            >
              +1sn
            </button>

            <button
              type="button"
              onClick={() => seekBySeconds(5)}
              disabled={!isPlaybackStarted || status !== 'ready'}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                background: 'rgba(30, 41, 59, 0.9)',
                color: '#e2e8f0',
                fontSize: '11px',
                fontWeight: '800',
                cursor: isPlaybackStarted && status === 'ready' ? 'pointer' : 'not-allowed',
                opacity: isPlaybackStarted && status === 'ready' ? 1 : 0.5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title="5 Saniye İleri Sar"
            >
              +5sn <SkipForward size={11} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <button
              type="button"
              onClick={cyclePlaybackRate}
              style={{
                padding: '4px 7px',
                borderRadius: '6px',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                background: 'rgba(30, 41, 59, 0.9)',
                color: '#cbd5e1',
                fontSize: '10.5px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
              title="Oynatma Hızı"
            >
              {playbackRate}x
            </button>

            <button
              type="button"
              onClick={toggleMute}
              disabled={!isPlaybackStarted}
              style={{
                padding: '4px 7px',
                borderRadius: '6px',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                background: 'rgba(30, 41, 59, 0.9)',
                color: '#cbd5e1',
                cursor: isPlaybackStarted ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center'
              }}
              title="Sesi Aç / Kapat"
            >
              {isMuted ? <VolumeX size={13} color="#f87171" /> : <Volume2 size={13} />}
            </button>

            <button
              type="button"
              onClick={handleFullscreen}
              disabled={!isPlaybackStarted}
              style={{
                padding: '4px 7px',
                borderRadius: '6px',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                background: 'rgba(30, 41, 59, 0.9)',
                color: '#cbd5e1',
                cursor: isPlaybackStarted ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center'
              }}
              title="Tam Ekran"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>
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
            ? `İleri/Geri Sarılabilir Akış • ${Math.round(effectiveFps)} FPS`
            : status === 'error'
            ? 'Dosya Bulunamadı'
            : status === 'loading'
            ? 'Hazırlanıyor...'
            : 'Hazır'}
        </span>
      </div>
    </div>
  );
};

export default React.memo(AdVideoPlayer);
