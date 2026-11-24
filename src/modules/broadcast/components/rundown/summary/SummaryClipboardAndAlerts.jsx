/**
 * @file src/modules/broadcast/components/rundown/summary/SummaryClipboardAndAlerts.jsx
 * @description Yayın akışı üst özet çubuğunun altında yalnızca gerektiğinde beliren minimal bilgi/işlem şeritleri:
 * - Eklenemeyen Taslak Kuşakları (daraltılabilir tek satırlık şerit)
 * (Not: Pano sembolü ve son 5 işlem geçmişi üst çubukta Günlük/Haftalık/Aylık görünümünün yanına taşındı.)
 */
import React, { useState, memo } from 'react';
import {
  Plus,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SummaryClipboardAndAlerts = memo(function SummaryClipboardAndAlerts({
  statusBanner = null,
  onClearStatusBanner,
  draftControlSummary = { total: 0, addedCount: 0, missingSlots: [] },
  notFoundPrograms = [],
  unaddedReasonsMap = new Map(),
  isSyncingDraftAndArchive = false,
  onSyncAndFillMissingDrafts,
  onQuickAddMissingDraftSlot,
  onQuickAddAllMissingDraftSlots
}) {
  const navigate = useNavigate();
  const [showMissingDraftDetails, setShowMissingDraftDetails] = useState(false);
  const [showNotFoundDetails, setShowNotFoundDetails] = useState(false);

  const hasMissingDrafts =
    draftControlSummary.total > 0 && draftControlSummary.missingSlots.length > 0;
  const hasNotFoundPrograms = Array.isArray(notFoundPrograms) && notFoundPrograms.length > 0;

  if (!statusBanner && !hasMissingDrafts && !hasNotFoundPrograms) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* 1. İŞLEM GERİ BİLDİRİMİ */}
      {statusBanner && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '5px 10px',
            borderRadius: '7px',
            background:
              statusBanner.type === 'warning'
                ? 'rgba(245, 158, 11, 0.14)'
                : statusBanner.type === 'ads'
                ? 'rgba(234, 88, 12, 0.14)'
                : 'rgba(16, 185, 129, 0.14)',
            border:
              statusBanner.type === 'warning'
                ? '1px solid rgba(245, 158, 11, 0.4)'
                : statusBanner.type === 'ads'
                ? '1px solid rgba(234, 88, 12, 0.4)'
                : '1px solid rgba(16, 185, 129, 0.4)',
            fontSize: '12px',
            fontWeight: '700',
            color: 'var(--text-primary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
            <CheckCircle2
              size={14}
              color={
                statusBanner.type === 'warning'
                  ? '#d97706'
                  : statusBanner.type === 'ads'
                  ? '#ea580c'
                  : '#059669'
              }
            />
            <span>{statusBanner.message}</span>
            {statusBanner.type === 'ads' && (
              <button
                type="button"
                onClick={() => navigate('/ads')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  border: 'none',
                  background: '#ea580c',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                <span>Reklam Rezervasyonu Aç</span>
                <ExternalLink size={11} />
              </button>
            )}
          </div>
          {onClearStatusBanner && (
            <button
              type="button"
              onClick={onClearStatusBanner}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: '800',
                fontSize: '12px'
              }}
            >
              X
            </button>
          )}
        </div>
      )}

      {/* 2. BULUNAMAYAN ANCAK LİSTEDE KORUNAN PROGRAMLAR ŞERİDİ */}
      {hasNotFoundPrograms && (
        <div
          style={{
            borderRadius: '7px',
            padding: '5px 10px',
            background: 'rgba(234, 88, 12, 0.1)',
            border: '1px solid rgba(234, 88, 12, 0.38)',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              <AlertTriangle size={14} color="#ea580c" />
              <span style={{ color: '#ea580c', fontWeight: '800' }}>
                Yayın listesinde arşiv karşılığı bulunamayan{' '}
                <strong>{notFoundPrograms.length} program</strong> var (Listeden kaldırılmadı, satırlarında{' '}
                <strong>&quot;Bulunamadı&quot;</strong> olarak işaretlendi)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {onSyncAndFillMissingDrafts && (
                <button
                  type="button"
                  disabled={isSyncingDraftAndArchive}
                  onClick={onSyncAndFillMissingDrafts}
                  title="Program arşivde kullanıma açıldıysa veya yüklendiyse tekrar tarayıp otomatik olarak kliple değiştirir"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 9px',
                    borderRadius: '5px',
                    border: 'none',
                    background: '#ea580c',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: isSyncingDraftAndArchive ? 'wait' : 'pointer'
                  }}
                >
                  <RefreshCw size={11} style={{ animation: isSyncingDraftAndArchive ? 'spin 1s linear infinite' : 'none' }} />
                  <span>{isSyncingDraftAndArchive ? 'Taranıyor...' : 'Tekrar Kontrol Et & Otomatik Ekle'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowNotFoundDetails(prev => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  border: '1px solid rgba(234, 88, 12, 0.4)',
                  background: 'var(--bg-primary)',
                  color: '#ea580c',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                {showNotFoundDetails ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>{showNotFoundDetails ? 'Gizle' : `Detay (${notFoundPrograms.length})`}</span>
              </button>
            </div>
          </div>

          {showNotFoundDetails && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '5px',
                paddingTop: '5px',
                borderTop: '1px dashed rgba(234, 88, 12, 0.3)',
                maxHeight: '100px',
                overflowY: 'auto'
              }}
            >
              {notFoundPrograms.map((item, idx) => (
                <div
                  key={item.instanceId || idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 8px',
                    borderRadius: '5px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderLeft: '3px solid #ea580c',
                    fontSize: '11.5px'
                  }}
                >
                  <span style={{ fontFamily: 'monospace', fontWeight: '900', color: '#ea580c' }}>
                    #{item.order} ({item.draftStartTime || (item.calculatedStartTime || '').slice(0, 5)})
                  </span>
                  <span style={{ fontWeight: '800', color: 'var(--text-primary)' }}>
                    {item.title}
                  </span>
                  {item.notFoundReason && (
                    <span style={{ fontSize: '10.5px', color: '#ea580c', fontWeight: '700' }}>
                      ({item.notFoundReason})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. EKLENEMEYEN TASLAK KUŞAKLARI ŞERİDİ */}
      {hasMissingDrafts && (
        <div
          style={{
            borderRadius: '7px',
            padding: '5px 10px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              <AlertTriangle size={14} color="#d97706" />
              <span style={{ color: '#d97706', fontWeight: '800' }}>
                Taslakta olup listede yer almayan{' '}
                <strong>{draftControlSummary.missingSlots.length} kuşak</strong> var
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <button
                type="button"
                onClick={() => setShowMissingDraftDetails(prev => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  background: 'var(--bg-primary)',
                  color: '#d97706',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                {showMissingDraftDetails ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>
                  {showMissingDraftDetails
                    ? 'Gizle'
                    : `Detay (${draftControlSummary.missingSlots.length})`}
                </span>
              </button>

              {onSyncAndFillMissingDrafts && (
                <button
                  type="button"
                  disabled={isSyncingDraftAndArchive}
                  onClick={onSyncAndFillMissingDrafts}
                  title="Eklenmeyen taslak kuşaklarını arşivden klipleriyle birlikte tarayıp otomatik olarak sırasına ekler"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 9px',
                    borderRadius: '5px',
                    border: 'none',
                    background: '#059669',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: isSyncingDraftAndArchive ? 'wait' : 'pointer'
                  }}
                >
                  <RefreshCw size={11} style={{ animation: isSyncingDraftAndArchive ? 'spin 1s linear infinite' : 'none' }} />
                  <span>Otomatik Tara & Kliple Ekle</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onQuickAddAllMissingDraftSlots(draftControlSummary.missingSlots)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  border: 'none',
                  background: '#f59e0b',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                <Plus size={11} />
                <span>Yer Tutucu Ekle</span>
              </button>
            </div>
          </div>

          {showMissingDraftDetails && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '5px',
                paddingTop: '5px',
                borderTop: '1px dashed rgba(245, 158, 11, 0.3)',
                maxHeight: '100px',
                overflowY: 'auto'
              }}
            >
              {draftControlSummary.missingSlots.map((slot, sIdx) => {
                const reasonKey = slot.id || `${slot.startTime}_${slot.title}`;
                const reasonText = unaddedReasonsMap.get(reasonKey);
                return (
                  <div
                    key={slot.id || sIdx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 8px',
                      borderRadius: '5px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderLeft: `3px solid ${slot.categoryColor || '#f59e0b'}`,
                      fontSize: '11.5px'
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: '900',
                        color: 'var(--accent-primary)'
                      }}
                    >
                      {slot.startTime}
                    </span>
                    <span style={{ fontWeight: '800', color: 'var(--text-primary)' }}>
                      {slot.title}
                    </span>
                    {reasonText && (
                      <span style={{ fontSize: '10.5px', color: '#ef4444', fontWeight: '700' }}>
                        ({reasonText})
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onQuickAddMissingDraftSlot(slot)}
                      style={{
                        background: 'rgba(16, 185, 129, 0.14)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        color: '#059669',
                        borderRadius: '4px',
                        padding: '1px 5px',
                        fontSize: '10.5px',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      + Ekle
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default SummaryClipboardAndAlerts;
