/**
 * @file src/modules/broadcast/components/DefaultIntroSettingsModal.jsx
 * @description Varsayılan İntro Ayarları ve "Otomatik İntro Yerleştir (Açık / Kapalı)" Modalı.
 * Kullanıcı burada:
 * 1. Otomatik İntro Yerleştirme özelliğini Açık veya Kapalı konuma getirebilir.
 * 2. Standart Varsayılan İntroyu (`SEMERKAND_intro_v3_2014`) seçebilir veya arşivdeki İntro / Jenerik
 *    klipleri arasından başka bir intro klibini varsayılan olarak belirleyebilir.
 */
import React, { useState, useEffect } from 'react';
import {
  X,
  Film,
  Check,
  Search,
  Sparkles,
  Plus,
  RotateCcw,
  RefreshCw,
  Clock
} from 'lucide-react';
import useBroadcastStore from '../store/broadcastStore';
import { secondsToTimecode } from '../utils/timecodeUtils';
import { dialog } from '../../../store/dialogStore';

const STANDARD_DEFAULT_INTRO = {
  fileId: 725,
  name: 'SEMERKAND_intro_v3_2014',
  fileName: 'SEMERKAND_intro_v3_2014',
  durationSec: 26,
  durationTc: '00.00.26.00',
  category: 'Jenerik / İntro'
};

export default function DefaultIntroSettingsModal({ isOpen, onClose }) {
  const {
    selectedChannel,
    selectedDate,
    activeList,
    introDefaultSettings,
    setIntroDefaultSettings,
    addProgram
  } = useBroadcastStore();

  const [autoInsert, setAutoInsert] = useState(
    introDefaultSettings?.autoInsertIntro !== false
  );
  const [selectedIntro, setSelectedIntro] = useState(() => ({
    fileId: introDefaultSettings?.fileId ?? STANDARD_DEFAULT_INTRO.fileId,
    name: introDefaultSettings?.name || STANDARD_DEFAULT_INTRO.name,
    durationSec: introDefaultSettings?.durationSec ?? STANDARD_DEFAULT_INTRO.durationSec,
    durationTc: introDefaultSettings?.durationTc || STANDARD_DEFAULT_INTRO.durationTc,
    category: introDefaultSettings?.category || STANDARD_DEFAULT_INTRO.category
  }));

  const [searchQuery, setSearchQuery] = useState('');
  const [introClips, setIntroClips] = useState([]);
  const [isLoadingClips, setIsLoadingClips] = useState(false);

  useEffect(() => {
    if (isOpen && introDefaultSettings) {
      setAutoInsert(introDefaultSettings.autoInsertIntro !== false);
      setSelectedIntro({
        fileId: introDefaultSettings.fileId ?? STANDARD_DEFAULT_INTRO.fileId,
        name: introDefaultSettings.name || STANDARD_DEFAULT_INTRO.name,
        durationSec: introDefaultSettings.durationSec ?? STANDARD_DEFAULT_INTRO.durationSec,
        durationTc: introDefaultSettings.durationTc || STANDARD_DEFAULT_INTRO.durationTc,
        category: introDefaultSettings.category || STANDARD_DEFAULT_INTRO.category
      });
    }
  }, [isOpen, introDefaultSettings]);

  // İntro / Jenerik kliplerini arşivden yükle veya ara
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    const timer = setTimeout(async () => {
      setIsLoadingClips(true);
      try {
        const q = searchQuery.trim();
        let merged = [];

        if (!q) {
          // Varsayılan olarak İntro programının (id: 18522) ve "intro" aramasının kliplerini getir
          const [progRes, searchRes] = await Promise.all([
            fetch('/api/archive/program/18522/clips').catch(() => null),
            fetch('/api/archive/clips/search?q=intro&limit=40').catch(() => null)
          ]);

          if (progRes && progRes.ok) {
            const pData = await progRes.json();
            if (Array.isArray(pData?.clips)) merged.push(...pData.clips);
          }
          if (searchRes && searchRes.ok) {
            const sData = await searchRes.json();
            if (Array.isArray(sData?.clips)) merged.push(...sData.clips);
          }
        } else {
          const res = await fetch(
            `/api/archive/clips/search?q=${encodeURIComponent(q)}&limit=60`
          );
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data?.clips)) merged.push(...data.clips);
          }
        }

        // Tekilleştir ve standart varsayılan intro her zaman en üstte bulunsun
        const seen = new Set();
        const uniqueList = [];

        const stdIncluded = merged.some(
          c => Number(c.fileId) === STANDARD_DEFAULT_INTRO.fileId || c.name === STANDARD_DEFAULT_INTRO.name
        );
        if (!q && !stdIncluded) {
          uniqueList.push({
            fileId: STANDARD_DEFAULT_INTRO.fileId,
            name: STANDARD_DEFAULT_INTRO.name,
            durationSec: STANDARD_DEFAULT_INTRO.durationSec,
            durationFormatted: STANDARD_DEFAULT_INTRO.durationTc,
            categoryName: 'Varsayılan İntro'
          });
          seen.add(STANDARD_DEFAULT_INTRO.fileId);
        }

        for (const c of merged) {
          const key = c.fileId || c.name;
          if (!key || seen.has(key)) continue;
          seen.add(key);
          uniqueList.push(c);
        }

        if (isMounted) {
          setIntroClips(uniqueList);
        }
      } catch (err) {
        console.warn('İntro klipleri yüklenemedi:', err);
      } finally {
        if (isMounted) {
          setIsLoadingClips(false);
        }
      }
    }, 180);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, searchQuery]);

  if (!isOpen) return null;

  const handlePickClip = clip => {
    const durSec = Math.max(1, Number(clip.durationSec || clip.duration || 26));
    const durTc = secondsToTimecode(durSec);
    const clipName = clip.name || clip.fileName || STANDARD_DEFAULT_INTRO.name;
    setSelectedIntro({
      fileId: clip.fileId || 725,
      name: clipName,
      durationSec: durSec,
      durationTc: durTc,
      category: clip.categoryName || 'Jenerik / İntro'
    });
  };

  const handleResetToStandardDefault = () => {
    setSelectedIntro({ ...STANDARD_DEFAULT_INTRO });
  };

  const saveToStore = () => {
    setIntroDefaultSettings({
      autoInsertIntro: autoInsert,
      fileId: selectedIntro.fileId,
      name: selectedIntro.name,
      fileName: selectedIntro.name,
      durationSec: selectedIntro.durationSec,
      durationTc: selectedIntro.durationTc,
      category: selectedIntro.category || 'Jenerik / İntro'
    });
  };

  const handleSaveSettings = e => {
    e.preventDefault();
    saveToStore();
    onClose();
    dialog.success(
      'Varsayılan İntro Ayarları Kaydedildi',
      `Otomatik İntro Yerleştirme: ${autoInsert ? 'AÇIK' : 'KAPALI'}\nVarsayılan İntro: ${selectedIntro.name} (${selectedIntro.durationSec} sn)`
    );
  };

  const handleSaveAndInsertNow = () => {
    saveToStore();
    addProgram(selectedChannel, selectedDate, activeList, {
      title: selectedIntro.name,
      name: selectedIntro.name,
      clipName: selectedIntro.name,
      fileId: selectedIntro.fileId,
      durationTc: selectedIntro.durationTc,
      durationSec: selectedIntro.durationSec,
      category: selectedIntro.category || 'Jenerik / İntro',
      categoryColor: '#6366f1',
      unitType: 'intro',
      unitLabel: 'İntro',
      note: 'Varsayılan İntro',
      isIntroClip: true,
      type: 'clip'
    });
    onClose();
    dialog.success(
      'İntro Yayın Akışına Eklendi',
      `Seçilen intro klibi (${selectedIntro.name}) yayın listesine eklendi.`
    );
  };

  const isStandardSelected =
    Number(selectedIntro.fileId) === STANDARD_DEFAULT_INTRO.fileId &&
    selectedIntro.name === STANDARD_DEFAULT_INTRO.name;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1.5px solid rgba(99, 102, 241, 0.45)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '580px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 44px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(99, 102, 241, 0.12)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(99, 102, 241, 0.22)',
                color: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Sparkles size={19} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '15.5px',
                  fontWeight: '800',
                  color: 'var(--text-primary)'
                }}
              >
                Varsayılan İntro Ayarları
              </h3>
              <p
                style={{
                  margin: '2px 0 0 0',
                  fontSize: '12px',
                  color: 'var(--text-secondary)'
                }}
              >
                Otomatik intro yerleştirme durumu ve program öncesi girecek varsayılan intro seçimi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            <X size={19} />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSaveSettings}
          style={{
            padding: '18px 20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          {/* 1. OTOMATİK İNTRO YERLEŞTİR (AÇIK / KAPALI BUTONU) */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              background: autoInsert
                ? 'rgba(16, 185, 129, 0.08)'
                : 'rgba(239, 68, 68, 0.08)',
              border: autoInsert
                ? '1.5px solid rgba(16, 185, 129, 0.35)'
                : '1.5px solid rgba(239, 68, 68, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: '800',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px'
                }}
              >
                <span>Otomatik İntro Yerleştir</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '900',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: autoInsert ? '#10b981' : '#ef4444',
                    color: '#ffffff'
                  }}
                >
                  {autoInsert ? 'AÇIK' : 'KAPALI'}
                </span>
              </div>
              <div
                style={{
                  fontSize: '11.5px',
                  color: 'var(--text-secondary)',
                  marginTop: '3px'
                }}
              >
                {autoInsert
                  ? 'Taslak uygularken ve program eklerken her programdan önce seçili intro otomatik eklenir.'
                  : 'Otomatik intro ekleme devre dışı. Programlardan önce otomatik intro yerleştirilmez.'}
              </div>
            </div>

            {/* Açık / Kapalı Seçici */}
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--bg-primary)',
                padding: '4px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                gap: '4px'
              }}
            >
              <button
                type="button"
                onClick={() => setAutoInsert(true)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  background: autoInsert ? '#10b981' : 'transparent',
                  color: autoInsert ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                Açık
              </button>
              <button
                type="button"
                onClick={() => setAutoInsert(false)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  background: !autoInsert ? '#ef4444' : 'transparent',
                  color: !autoInsert ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                Kapalı
              </button>
            </div>
          </div>

          {/* 2. SEÇİLİ VARSAYILAN İNTRO ÖZETİ */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'var(--bg-primary)',
              border: '1.5px solid rgba(99, 102, 241, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: '#6366f1',
                  textTransform: 'uppercase',
                  marginBottom: '3px'
                }}
              >
                Aktif Varsayılan İntro Klibi
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: '800',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all'
                }}
              >
                {selectedIntro.name}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginTop: '4px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  fontWeight: '700'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981' }}>
                  <Clock size={13} />
                  {selectedIntro.durationSec} sn ({selectedIntro.durationTc})
                </span>
                <span>• ID: #{selectedIntro.fileId}</span>
              </div>
            </div>

            {!isStandardSelected && (
              <button
                type="button"
                onClick={handleResetToStandardDefault}
                title="Standart Semerkand İntrosuna Dön"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 11px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                <RotateCcw size={13} />
                <span>Varsayılana Dön</span>
              </button>
            )}
          </div>

          {/* 3. İNTRO SEÇİM LİSTESİ (Varsayılan İntro veya Arşivden İntro Seç) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <label
                style={{
                  fontSize: '12.5px',
                  fontWeight: '800',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Film size={15} color="#6366f1" />
                <span>İntro Klibi Seç (Varsayılan veya Arşivden):</span>
              </label>
            </div>

            {/* Arama Kutusu */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '9px',
                padding: '7px 11px'
              }}
            >
              <Search size={15} color="var(--text-secondary)" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="İntro veya jenerik adı ile ara (Ör: SEMERKAND_intro)..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  width: '100%'
                }}
              />
              {isLoadingClips && <RefreshCw size={14} className="spin" color="var(--text-secondary)" />}
            </div>

            {/* Klip Listesi */}
            <div
              style={{
                maxHeight: '210px',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                background: 'var(--bg-primary)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {introClips.length === 0 ? (
                <div
                  style={{
                    padding: '22px',
                    textAlign: 'center',
                    fontSize: '12.5px',
                    color: 'var(--text-secondary)'
                  }}
                >
                  {isLoadingClips ? 'İntro klipleri yükleniyor...' : 'Eşleşen intro klibi bulunamadı.'}
                </div>
              ) : (
                introClips.map((clip, idx) => {
                  const clipName = clip.name || clip.fileName || 'İntro';
                  const durSec = Math.max(1, Number(clip.durationSec || clip.duration || 26));
                  const isSelected =
                    (clip.fileId && Number(selectedIntro.fileId) === Number(clip.fileId)) ||
                    selectedIntro.name === clipName;
                  const isStd =
                    Number(clip.fileId) === STANDARD_DEFAULT_INTRO.fileId ||
                    clipName === STANDARD_DEFAULT_INTRO.name;

                  return (
                    <div
                      key={clip.fileId || idx}
                      onClick={() => handlePickClip(clip)}
                      style={{
                        padding: '9px 12px',
                        borderBottom: '1px solid var(--border-color)',
                        background: isSelected ? 'rgba(99, 102, 241, 0.14)' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px'
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            flexWrap: 'wrap'
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '12.5px',
                              fontWeight: '800',
                              color: isSelected ? '#6366f1' : 'var(--text-primary)'
                            }}
                          >
                            {clipName}
                          </span>
                          {isStd && (
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: '800',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: 'rgba(99, 102, 241, 0.2)',
                                color: '#6366f1'
                              }}
                            >
                              Varsayılan İntro
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          #{clip.fileId || 725} • {clip.categoryName || 'Jenerik / İntro'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            fontWeight: '800',
                            color: '#10b981'
                          }}
                        >
                          {durSec} sn
                        </span>
                        <span
                          style={{
                            padding: '4px 9px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: '800',
                            background: isSelected ? '#6366f1' : 'var(--bg-secondary)',
                            color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                            border: isSelected ? 'none' : '1px solid var(--border-color)'
                          }}
                        >
                          {isSelected ? 'Seçili' : 'Seç'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Aksiyon Butonları */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              marginTop: '4px',
              flexWrap: 'wrap'
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '12.5px',
                fontWeight: '700'
              }}
            >
              Vazgeç
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleSaveAndInsertNow}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(99, 102, 241, 0.45)',
                  background: 'rgba(99, 102, 241, 0.14)',
                  color: '#6366f1',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Plus size={15} />
                <span>Kaydet ve Şimdi 1 İntro Ekle</span>
              </button>

              <button
                type="submit"
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#6366f1',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 3px 10px rgba(99, 102, 241, 0.35)'
                }}
              >
                <Check size={15} strokeWidth={2.5} />
                <span>Ayarları Kaydet</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

