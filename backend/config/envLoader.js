/**
 * @file backend/config/envLoader.js
 * @description Proje kök dizinindeki .env dosyasını harici paket gerektirmeden otomatik okur
 * ve tüm sunucu/veritabanı/medya bağlantı bilgilerini ortam değişkenlerinden (.env) sağlar.
 * Güvenlik gereği kaynak kod içinde hiçbir sabit IP adresi, sunucu adı veya dosya yolu tutulmaz.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');

if (fs.existsSync(ENV_PATH)) {
    try {
        const content = fs.readFileSync(ENV_PATH, 'utf8');
        for (const rawLine of content.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) continue;
            const eqIdx = line.indexOf('=');
            if (eqIdx === -1) continue;
            const key = line.slice(0, eqIdx).trim();
            let val = line.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            if (key && process.env[key] === undefined) {
                process.env[key] = val;
            }
        }
    } catch (err) {
        console.warn('[ENV LOADER] .env dosyası okunamadı:', err.message);
    }
}

export const SERVER_TOPOLOGY = {
    APP_SERVER: {
        hostname: process.env.APP_SERVER_HOSTNAME || 'app-server',
        ip: process.env.APP_SERVER_HOST || '127.0.0.1',
        user: process.env.APP_SERVER_USER || 'root',
        frontendPort: parseInt(process.env.FRONTEND_PORT || '5173', 10),
        backendPort: parseInt(process.env.PORT || '3001', 10)
    },
    BACKUP_SERVER: {
        hostname: process.env.BACKUP_SERVER_HOSTNAME || 'backup-server',
        ip: process.env.BACKUP_SERVER_HOST || '127.0.0.1',
        user: process.env.BACKUP_SERVER_USER || 'root',
        frontendPort: 5173,
        backendPort: 3001
    },
    DB_DOCKER_SERVER: {
        hostname: process.env.PG_HOSTNAME || 'db-server',
        ip: process.env.PG_HOST || '127.0.0.1',
        user: process.env.PG_SERVER_USER || 'postgres',
        postgresPort: parseInt(process.env.PG_PORT || '5432', 10)
    },
    MAM_MSSQL_SERVER: {
        ip: process.env.MSSQL_HOST || '127.0.0.1',
        port: parseInt(process.env.MSSQL_PORT || '1433', 10),
        database: process.env.MSSQL_DATABASE || 'MAM_DB'
    },
    MAM_SMB_STORAGE: {
        ip: process.env.MAM_SMB_HOST || '127.0.0.1',
        domain: process.env.MAM_SMB_DOMAIN || '',
        user: process.env.MAM_SMB_USER || '',
        password: process.env.MAM_SMB_PASSWORD || '',
        highResPath: process.env.MAM_HIGHRES_PATH || '/mnt/media_highres',
        yayinArsivPath: process.env.YAYIN_ARSIV_PATH || '/mnt/media_archive'
    }
};
