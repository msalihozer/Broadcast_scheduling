/**
 * @file src/modules/broadcast/components/AddAdBreakModal.jsx
 * @description Reklam Kuşağı Varsayılan Ayarları (Dakika & Açıklama) ve Hızlı Ekleme Modalı (Vanilla CSS).
 * Kullanıcı burada varsayılan dakika/süreyi ve açıklamayı kaydettiğinde, bundan sonra eklenen
 * tüm reklam kuşakları otomatik olarak bu ayarlarla eklenir.
 */
import React, { useState, useEffect } from 'react';
import { X, Megaphone, Clock, Plus, Settings, Check, FileText } from 'lucide-react';
import useBroadcastStore from '../store/broadcastStore';
import { normalizeTimecode } from '../utils/timecodeUtils';

const MAIN_PRESETS = [
  { minutes: 3, label: '3 dk', tc: '00.03.00.00' },
  { minutes: 5, label: '5 dk', tc: '00.05.00.00' },
  { minutes: 7, label: '7 dk', tc: '00.07.00.00' },
  { minutes: 9, label: '9 dk', tc: '00.09.00.00' },
  { minutes: 10, label: '10 dk', tc: '00.10.00.00' }
];

const OTHER_PRESETS = [
  { minutes: 1, label: '1 dk', tc: '00.01.00.00' },
  { minutes: 2, label: '2 dk', tc: '00.02.00.00' },
  { minutes: 12, label: '12 dk', tc: '00.12.00.00' },
  { minutes: 15, label: '15 dk', tc: '00.15.00.00' }
];

export const RAMADAN_BREAK_TAG_OPTIONS = [
  { value: '', label: 'Standart Reklam Kuşağı (Ramazan Özel Değil)', badge: '', color: '#f59e0b' },
  { value: 'sahur_before', label: '🌙 Ramazan Sahur Öncesi Kuşağı', badge: '🌙 SAHUR ÖNCESİ', color: '#0ea5e9' },
  { value: 'sahur_middle', label: '🌙 Ramazan Sahur Arası Kuşağı', badge: '🌙 SAHUR ARASI', color: '#0284c7' },
  { value: 'sahur_after', label: '🌙 Ramazan Sahur Sonrası Kuşağı', badge: '🌙 SAHUR SONRASI', color: '#0369a1' },
  { value: 'iftar_before', label: '🕌 Ramazan İftar Öncesi Kuşağı', badge: '🕌 İFTAR ÖNCESİ', color: '#d97706' },
  { value: 'iftar_middle', label: '🕌 Ramazan İftar Arası Kuşağı', badge: '🕌 İFTAR ARASI', color: '#b45309' },
  { value: 'iftar_after', label: '🕌 Ramazan İftar Sonrası Kuşağı', badge: '🕌 İFTAR SONRASI', color: '#92400e' }
];

export default function AddAdBreakModal({ isOpen, onClose }) {
  const {
    selectedChannel,
    selectedDate,
    activeList,
    adBreakDefaultSettings,
    setAdBreakDefaultSettings,
    addAdBreak
  } = useBroadcastStore();

  const [durationTc, setDurationTc] = useState(adBreakDefaultSettings?.durationTc || '00.05.00.00');
  const [manualMinutes, setManualMinutes] = useState(adBreakDefaultSettings?.durationMinutes ?? 5);
  const [manualSeconds, setManualSeconds] = useState(adBreakDefaultSettings?.durationSeconds ?? 0);
  const [note, setNote] = useState(adBreakDefaultSettings?.note ?? 'Ticari Reklam Bloğu');
  const [ramadanBreakTag, setRamadanBreakTag] = useState(adBreakDefaultSettings?.ramadanBreakTag ?? '');

  useEffect(() => {
    if (isOpen && adBreakDefaultSettings) {
      setDurationTc(adBreakDefaultSettings.durationTc || '00.05.00.00');
      setManualMinutes(adBreakDefaultSettings.durationMinutes ?? 5);
      setManualSeconds(adBreakDefaultSettings.durationSeconds ?? 0);
      setNote(adBreakDefaultSettings.note ?? 'Ticari Reklam Bloğu');
      setRamadanBreakTag(adBreakDefaultSettings.ramadanBreakTag ?? '');
    }
  }, [isOpen, adBreakDefaultSettings]);

  if (!isOpen) return null;

  // Hızlı önayar seçimi
  const handleSelectPreset = (p) => {
    setDurationTc(p.tc);
    setManualMinutes(p.minutes);
    setManualSeconds(0);
  };

  // Manuel dakika / saniye değiştiğinde
  const handleManualTimeChange = (min, sec) => {
    const safeMin = Math.max(0, Math.min(180, min));
    const safeSec = Math.max(0, Math.min(59, sec));
    setManualMinutes(safeMin);
    setManualSeconds(safeSec);
    const mStr = String(safeMin).padStart(2, '0');
    const sStr = String(safeSec).padStart(2, '0');
    setDurationTc(`00.${mStr}.${sStr}.00`);
  };

  const saveSettingsToStore = () => {
    const cleanTc = normalizeTimecode(durationTc);
    setAdBreakDefaultSettings({
      durationMinutes: manualMinutes,
      durationSeconds: manualSeconds,
      durationTc: cleanTc,
      note: note.trim() || 'Ticari Reklam Bloğu',
      ramadanBreakTag: ramadanBreakTag || ''
    });
    return cleanTc;
  };

  // Sadece varsayılan ayarları kaydet (Bundan sonra eklenecekler için geçerli olur)
  const handleSaveSettingsOnly = (e) => {
    e.preventDefault();
    saveSettingsToStore();
    onClose();
  };

  // Ayarları kaydet ve hemen şimdi de 1 reklam kuşağı ekle
  const handleSaveAndAddNow = () => {
    const cleanTc = saveSettingsToStore();
    addAdBreak(selectedChannel, selectedDate, activeList, {
      durationTc: cleanTc,
      note: note.trim() || 'Ticari Reklam Bloğu',
      ramadanBreakTag: ramadanBreakTag || ''
    });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid rgba(245, 158, 11, 0.45)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '500px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.45)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(245, 158, 11, 0.12)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.22)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Settings size={19} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                Reklam Kuşağı Varsayılan Ayarları
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                Bundan sonra ekleyeceğiniz tüm reklam kuşakları için geçerli süre (dk) ve açıklama
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveSettingsOnly} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Bilgilendirme Kutusu */}
          <div style={{
            padding: '10px 12px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            fontSize: '11.5px',
            color: 'var(--text-secondary)',
            lineHeight: 1.45
          }}>
            <strong style={{ color: '#d97706' }}>Not:</strong> Burada belirlediğiniz <strong>Süre (Dakika)</strong> ve <strong>Açıklama</strong> kaydedildiğinde, üst bardaki <strong>+ Reklam Kuşağı</strong> butonuna her bastığınızda reklam kuşakları otomatik olarak bu ayarlarla eklenecek ve listedeki sırasına göre yukarıdan aşağıya <strong>Reklam Kuşağı 1, 2, 3...</strong> şeklinde numaralandırılacaktır.
          </div>

          {/* 1. Varsayılan Süre (Dakika) Alanı */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Clock size={14} color="#f59e0b" />
                <span>Varsayılan Reklam Süresi (Dakika):</span>
              </label>
              <span style={{ fontSize: '11.5px', fontFamily: 'monospace', color: '#d97706', fontWeight: '800' }}>
                {durationTc} (HH.MM.SS.FF)
              </span>
            </div>

            {/* Hızlı Süre Seçimi: 3, 5, 7, 9, 10 dk */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Hızlı Dakika Seçimi:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                {MAIN_PRESETS.map((p, idx) => {
                  const isActive = manualMinutes === p.minutes && manualSeconds === 0;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        fontFamily: 'monospace',
                        fontWeight: '800',
                        cursor: 'pointer',
                        background: isActive ? '#f59e0b' : 'var(--bg-tertiary)',
                        color: isActive ? '#000' : 'var(--text-primary)',
                        border: isActive ? '1.5px solid #f59e0b' : '1px solid var(--border-color)',
                        boxShadow: isActive ? '0 2px 8px rgba(245, 158, 11, 0.35)' : 'none',
                        transition: 'all 0.15s',
                        textAlign: 'center'
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Diğer Önayarlar (1 dk, 2 dk, 12 dk, 15 dk) */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                {OTHER_PRESETS.map((p, idx) => {
                  const isActive = manualMinutes === p.minutes && manualSeconds === 0;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      style={{
                        flex: 1,
                        padding: '5px 6px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        fontWeight: '700',
                        cursor: 'pointer',
                        background: isActive ? '#f59e0b' : 'var(--bg-primary)',
                        color: isActive ? '#000' : 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                        transition: 'all 0.15s'
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Manuel Dakika / Saniye Stepper Alanı */}
            <div style={{
              marginTop: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                Özel Dakika / Saniye:
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Dakika */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => handleManualTimeChange(manualMinutes - 1, manualSeconds)}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '5px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '13px'
                    }}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={manualMinutes}
                    onChange={e => handleManualTimeChange(parseInt(e.target.value, 10) || 0, manualSeconds)}
                    style={{
                      width: '48px',
                      textAlign: 'center',
                      padding: '4px 2px',
                      borderRadius: '5px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: '#f59e0b',
                      fontWeight: '900',
                      fontFamily: 'monospace',
                      fontSize: '13px'
                    }}
                  />
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: '700' }}>dk</span>
                  <button
                    type="button"
                    onClick={() => handleManualTimeChange(manualMinutes + 1, manualSeconds)}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '5px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '13px'
                    }}
                  >
                    +
                  </button>
                </div>

                {/* Saniye */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => handleManualTimeChange(manualMinutes, manualSeconds - 5)}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '5px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '13px'
                    }}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={manualSeconds}
                    onChange={e => handleManualTimeChange(manualMinutes, parseInt(e.target.value, 10) || 0)}
                    style={{
                      width: '44px',
                      textAlign: 'center',
                      padding: '4px 2px',
                      borderRadius: '5px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: '#f59e0b',
                      fontWeight: '900',
                      fontFamily: 'monospace',
                      fontSize: '13px'
                    }}
                  />
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: '700' }}>sn</span>
                  <button
                    type="button"
                    onClick={() => handleManualTimeChange(manualMinutes, manualSeconds + 5)}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '5px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '13px'
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Varsayılan Açıklama Alanı */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>
              <FileText size={14} color="#f59e0b" />
              <span>Varsayılan Açıklama / Not:</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ör: Ticari Reklam Bloğu, Sponsorlu Kuşak, Tanıtım Bloğu..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: '600',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 3. Ramazan Özel Reklam Kuşağı İşareti */}
          <div style={{
            padding: '10px 12px',
            borderRadius: '10px',
            background: ramadanBreakTag ? 'rgba(217, 119, 6, 0.12)' : 'var(--bg-primary)',
            border: ramadanBreakTag ? '1.5px solid #d97706' : '1px solid var(--border-color)'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '800', color: ramadanBreakTag ? '#d97706' : 'var(--text-primary)', marginBottom: '6px' }}>
              <span>🌙 Ramazan Özel Kuşak İşaretlemesi (Opsiyonel):</span>
            </label>
            <select
              value={ramadanBreakTag}
              onChange={e => setRamadanBreakTag(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {RAMADAN_BREAK_TAG_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '5px', lineHeight: 1.35 }}>
              Kuşağı eklerken veya eklendikten sonra doğrudan listeden <strong>Sahur / İftar (Öncesi, Arası, Sonrası)</strong> olarak işaretleyebilirsiniz.
            </div>
          </div>

          {/* Aksiyon Butonları */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
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
                onClick={handleSaveAndAddNow}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(245, 158, 11, 0.45)',
                  background: 'rgba(245, 158, 11, 0.14)',
                  color: '#d97706',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Plus size={15} />
                <span>Kaydet ve Şimdi 1 Ekle</span>
              </button>

              <button
                type="submit"
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#f59e0b',
                  color: '#000',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontWeight: '900',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)'
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
