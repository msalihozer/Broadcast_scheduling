/**
 * @file src/modules/broadcast/components/EditBroadcastProgramModal.jsx
 * @description Yayın akışındaki mevcut bir program, klip veya kuşağın başlık, kesin timecode süresi (HH.MM.SS.FF),
 * bölüm numarası, parça (part) numarası ve özel not bilgilerini düzenleme modalı.
 */
import React, { useState, useEffect } from 'react';
import { X, Edit2, Check, Clock } from 'lucide-react';
import useBroadcastStore from '../store/broadcastStore';
import { normalizeTimecode, timecodeToFrames, framesToTimecode } from '../utils/timecodeUtils';

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

  useEffect(() => {
    if (program && isOpen) {
      setTitle(program.title || program.name || '');
      setDurationTc(program.durationTc || (program.durationSec ? framesToTimecode(program.durationSec * 25) : '00.30.00.00'));
      setEpisodeNo(program.episodeNo !== null && program.episodeNo !== undefined ? String(program.episodeNo) : '');
      setPartNo(program.partNo !== null && program.partNo !== undefined ? String(program.partNo) : '');
      setNote(program.note || '');
    }
  }, [program, isOpen]);

  if (!isOpen || !program) return null;

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
      note: note.trim()
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
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        overflow: 'hidden'
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

          <div style={{ marginBottom: '20px' }}>
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
