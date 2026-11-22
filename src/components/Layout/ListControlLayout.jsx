/**
 * @file src/components/Layout/ListControlLayout.jsx
 * @description Yayın Liste Kontrol Modülü Ana Düzen Sarmalayıcısı.
 * Üstte sistem navigasyonunu (TopNavbar), altta ise tam ekran Flexbox yapısıyla
 * yeni Yayın Liste Kontrol Modülünü (ListControlModule) barındırır.
 */
import React from 'react';
import TopNavbar from './TopNavbar';
import ListControlModule from '../../modules/list-control';

const ListControlLayout = () => {
  return (
    <div
      className="app-container"
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg-primary)'
      }}
    >
      <TopNavbar />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: 'flex',
          overflow: 'hidden'
        }}
      >
        <ListControlModule />
      </div>
    </div>
  );
};

export default ListControlLayout;
