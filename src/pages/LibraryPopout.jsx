/**
 * @file src/pages/LibraryPopout.jsx
 * @description Çoklu monitör (Pop-out) kullanımı için bağımsız Medya/Program Kütüphanesi penceresi (/library-popout).
 */
import React, { useEffect } from 'react';
import ProgramLibrary from '../components/Sidebar/ProgramLibrary';

const LibraryPopout = () => {
  useEffect(() => {
    document.title = "Medya Kütüphanesi - Popout";
    
    // Basit bir stil ayarı
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.background = 'var(--bg-primary)';

    return () => {
      document.body.style.margin = '';
      document.body.style.padding = '';
      document.body.style.overflow = '';
      document.body.style.background = '';
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden' }}>
      {/* Genişliği %100 yaparak tüm pencereyi kaplamasını sağladık */}
      <div style={{ flex: 1, height: '100%', minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <ProgramLibrary isPopout={true} />
      </div>
    </div>
  );
};

export default LibraryPopout;
