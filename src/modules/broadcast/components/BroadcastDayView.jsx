/**
 * @file src/modules/broadcast/components/BroadcastDayView.jsx
 * @description Yayın Planlama modülü Günlük Görünüm (Daily View) düzen bileşeni.
 * Sol panelde o günün taslak şablonunu ve MAM klip arama kütüphanesini (BroadcastDraftSidebar),
 * sağ panelde ise frame/timecode hassasiyetli kesin yayın akış tablosunu (BroadcastRundownTable) barındırır.
 */
import React from 'react';
import useBroadcastStore from '../store/broadcastStore';
import BroadcastDraftSidebar from './BroadcastDraftSidebar';
import BroadcastRundownTable from './BroadcastRundownTable';

const BroadcastDayView = ({ 
  onOpenAddModal, 
  onOpenAdModal, 
  onEditProgram, 
  onPullDraft,
  onOpenClipSearch 
}) => {
  const { isDraftSidebarOpen } = useBroadcastStore();

  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      overflow: 'hidden',
      position: 'relative',
      background: 'var(--bg-primary)'
    }}>
      {/* Sol Panel: O Günün Taslak Planı ve Klip Kütüphanesi */}
      {isDraftSidebarOpen && (
        <BroadcastDraftSidebar />
      )}

      {/* Sağ Panel: Kesinleşen Yayın Akışı (Liste A / Liste B) */}
      <BroadcastRundownTable
        onOpenAddModal={onOpenAddModal}
        onOpenAdModal={onOpenAdModal}
        onEditProgram={onEditProgram}
        onPullDraft={onPullDraft}
        onOpenClipSearch={onOpenClipSearch}
      />
    </div>
  );
};

export default BroadcastDayView;
