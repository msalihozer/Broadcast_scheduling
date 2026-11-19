import React from 'react';
import TopNavbar from './TopNavbar';
import DraftPlanningModule from '../../modules/draft';

/**
 * @file DraftLayout.jsx
 * @description Yeni Taslak Planlama modülü için ana düzen (layout).
 */
const DraftLayout = () => {
  return (
    <div className="app-container draft-app-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', overflow: 'visible', background: 'var(--bg-primary)' }}>
      <TopNavbar />
      <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0, background: 'var(--bg-primary)' }}>
        <DraftPlanningModule />
      </div>
    </div>
  );
};

export default DraftLayout;
