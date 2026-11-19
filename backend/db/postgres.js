/**
 * @file backend/db/postgres.js
 * @description PostgreSQL Bağlantı ve Sorgu Katmanı (.env üzerindeki PG_HOST ve PG_PORT ayarlarını kullanır).
 */
import '../config/envLoader.js';
import pkg from 'pg';
const { Pool } = pkg;

const PRIMARY_PG_HOST = process.env.PG_HOST || '127.0.0.1';
const PG_PORT = parseInt(process.env.PG_PORT || '5432', 10);
const PG_DATABASE = process.env.PG_DATABASE || 'yayin_planlama';
const PG_USER = process.env.PG_USER || 'postgres';
const PG_PASSWORD = process.env.PG_PASSWORD || '';

const pgConfig = {
    host: PRIMARY_PG_HOST,
    port: PG_PORT,
    database: PG_DATABASE,
    user: PG_USER,
    password: PG_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3500,
};

export let pool = new Pool(pgConfig);
let activePgHost = PRIMARY_PG_HOST;
let isConnected = false;

export async function testConnection() {
    try {
        const client = await pool.connect();
        const res = await client.query('SELECT NOW() as current_time');
        client.release();
        isConnected = true;
        console.log(`[POSTGRES] PostgreSQL Bağlantısı Başarılı! (${PG_DATABASE} - ${res.rows[0].current_time})`);
        return true;
    } catch (err) {
        if (activePgHost !== 'localhost' && process.env.PG_ALLOW_LOCAL_FALLBACK !== 'false') {
            try {
                const fallbackPool = new Pool({
                    ...pgConfig,
                    host: 'localhost',
                    password: process.env.PG_LOCAL_PASSWORD || ''
                });
                const client = await fallbackPool.connect();
                await client.query('SELECT NOW()');
                client.release();
                pool = fallbackPool;
                activePgHost = 'localhost';
                isConnected = true;
                console.log(`[POSTGRES] Yerel PostgreSQL (localhost:${PG_PORT}) aktif edildi.`);
                return true;
            } catch (_) {
                // ignore fallback error
            }
        }
        isConnected = false;
        console.warn(`[POSTGRES] PostgreSQL sunucusuna bağlanılamadı: ${err.message}. (JSON yedekleme modu aktif)`);
        return false;
    }
}

export function isPostgresReady() {
    return isConnected;
}

export function getActivePostgresHost() {
    return activePgHost;
}

export async function query(text, params) {
    return pool.query(text, params);
}

// İlk bağlantı kontrolü
testConnection();
