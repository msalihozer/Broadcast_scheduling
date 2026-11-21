/**
 * @file src/modules/broadcast/components/EditBroadcastProgramModal.jsx
 * @description Yayın akışındaki mevcut bir program, klip veya kuşağın başlık, kesin timecode süresi (HH.MM.SS.FF),
 * bölüm numarası, parça (part) numarası ve özel not bilgilerini düzenleme modalı.
 */
import React, { useState, useEffect } from 'react';
import { X, Edit2, Check, Clock } from 'lucide-react';
import useBroadcastStore from '../store/broadcastStore';
import usePlanningStore from '../../../store/planningStore';
import { isRamadanFeatureWindowOpen } from '../../../components/Ads/reservation/reservationConstants';
import { normalizeTimecode, timecodeToFrames, framesToTimecode } from '../utils/timecodeUtils';
import { RAMADAN_BREAK_TAG_OPTIONS } from './AddAdBreakModal';

const EditBroadcastProgramModal = ({ isOpen, onClose, program }) => {
  const {
    selectedChannel,
    selectedDate,
    activeList,
    updateProgram
  } = useBroadcastStore();

  const [title, setTitle] = useState('');
  const [durationTc, setDurationTc] = useState('00.30.00.00');
  const [episodeNo, setEpisodeNo] = useState('');
  const [partNo, setPartNo] = useState('');
  const [note, setNote] = useState('');
  const [ramadanProgramType, setRamadanProgramType] = useState('');
  const [ramadanBreakTag, setRamadanBreakTag] = useState('');
  const ramadanConfig = usePlanningStore(state => state.ramadanConfig);
  const showRamadanControls = isRamadanFeatureWindowOpen(ramadanConfig, selectedDate);

  useEffect(() => {
    if (program && isOpen) {
      setTitle(program.title || program.name || '');
      setDurationTc(program.durationTc || (program.durationSec ? framesToTimecode(program.durationSec * 25) : '00.30.00.00'));
      setEpisodeNo(program.episodeNo !== null && program.episodeNo !== undefined ? String(program.episodeNo) : '');
      setPartNo(program.partNo !== null && program.partNo !== undefined ? String(program.partNo) : '');
      setNote(program.note || '');
      setRamadanProgramType(program.ramadanProgramType || '');
      setRamadanBreakTag(program.ramadanBreakTag || '');
    }
  }, [program, isOpen]);

  if (!isOpen || !program) return null;

  const isAdBreak = program.type === 'ad_break';

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanTc = normalizeTimecode(durationTc);
    const durFrames = timecodeToFrames(cleanTc);

    updateProgram(selectedChannel, selectedDate, activeList, program.instanceId, {
      title: title.trim(),
      name: title.trim(),
      durationTc: cleanTc,
      durationFrames: durFrames,
      durationSec: Math.floor(durFrames / 25),
      episodeNo: episodeNo !== '' ? parseInt(episodeNo, 10) : null,
      partNo: partNo !== '' ? parseInt(partNo, 10) : null,
      note: note.trim(),
      ramadanProgramType: isAdBreak ? '' : ramadanProgramType,
      ramadanBreakTag: isAdBreak ? ramadanBreakTag : ''
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
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '480px',
        maxHeight: 'calc(100vh - 32px)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        overflowY: 'auto'
      }}>
        {/* Başlık */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit2 size={16} color="var(--accent-primary)" />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
              Yayın Öğesini Düzenle
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Başlık / Ad:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={13} color="#10b981" />
                <span>Süre (Saat.Dakika.Saniye.Salise):</span>
              </label>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#10b981' }}>HH.MM.SS.FF</span>
            </div>
            <input
              type="text"
              value={durationTc}
              onChange={(e) => setDurationTc(e.target.value)}
              placeholder="00.30.00.00"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: '#10b981',
                fontSize: '14px',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Bölüm No:
              </label>
              <input
                type="number"
                value={episodeNo}
                onChange={(e) => setEpisodeNo(e.target.value)}
                placeholder="Ör: 67"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Parça (Part) No:
              </label>
              <input
                type="number"
                value={partNo}
                onChange={(e) => setPartNo(e.target.value)}
                placeholder="Ör: 1"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Not / Açıklama:
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ör: Özel yayın, Canlı, vb."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Ramazan Özel Program / Kuşak İşaretlemesi (Yalnızca Ramazan tarihine 2 hafta kala veya Ramazan döneminde gösterilir) */}
          {showRamadanControls && (
            <div style={{
              marginBottom: '20px',
              padding: '10px 12px',
              borderRadius: '10px',
              background: (ramadanProgramType || ramadanBreakTag) ? 'rgba(217, 119, 6, 0.12)' : 'var(--bg-primary)',
              border: (ramadanProgramType || ramadanBreakTag) ? '1.5px solid #d97706' : '1px solid var(--border-color)'
            }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: (ramadanProgramType || ramadanBreakTag) ? '#d97706' : 'var(--text-primary)', marginBottom: '6px' }}>
                {isAdBreak ? '🌙 Ramazan Özel Reklam Kuşağı İşareti:' : '🌙 Ramazan Özel Program Türü (Sahur / İftar):'}
              </label>
              {isAdBreak ? (
                <select
                  value={ramadanBreakTag}
                  onChange={(e) => setRamadanBreakTag(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {RAMADAN_BREAK_TAG_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={ramadanProgramType}
                  onChange={(e) => setRamadanProgramType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">Normal Program (Ramazan Özel Değil)</option>
                  <option value="sahur">🌙 Ramazan Sahur Programı (Başlangıç Saati Referansı)</option>
                  <option value="iftar">🕌 Ramazan İftar Programı (Başlangıç Saati Referansı)</option>
                </select>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              Vazgeç
            </button>
            <button
              type="submit"
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--accent-primary)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Check size={16} />
              <span>Kaydet</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditBroadcastProgramModal;
