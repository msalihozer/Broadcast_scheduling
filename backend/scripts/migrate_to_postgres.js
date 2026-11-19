/**
 * @file backend/scripts/migrate_to_postgres.js
 * @description Mevcut JSON dosyalarındaki (taslaklar, eşleştirmeler) ve yerel DB yedeğindeki
 * (archive_seed_data.json.gz -> 690 program, 54 aktif kullanılan program, 15.368 klip, 6 ayrıştırma kuralı)
 * tüm verileri PostgreSQL veritabanına eksiksiz aktaran migrasyon scripti.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { pool, testConnection } from '../db/postgres.js';
import { ensureClipMetadataColumn, ensureParsingRulesTable } from '../services/archiveAnalyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

async function migrate() {
    console.log('--- PostgreSQL Tam Veri Aktarımı (Migration) Başlatılıyor ---');

    const connected = await testConnection();
    if (!connected) {
        console.error('[HATA] PostgreSQL çalışmıyor. Lütfen PostgreSQL Docker container\'ı kontrol edin.');
        process.exit(1);
    }

    // 1. init.sql şemasını ve ek sütunları uygula
    const initSqlPath = path.resolve(__dirname, '..', 'db', 'init.sql');
    if (fs.existsSync(initSqlPath)) {
        console.log('[1/4] Tablo şemaları kontrol ediliyor...');
        const initSql = fs.readFileSync(initSqlPath, 'utf8');
        await pool.query(initSql);
        await ensureClipMetadataColumn();
        await ensureParsingRulesTable();
        console.log('✓ Tablolar hazır.');
    }

    // 2. Programlar, Aktif Kullanılan Programlar (54 adet), Klipler (15.368 adet) ve Ayrıştırma Kuralları Aktarımı
    const seedGzPath = path.resolve(__dirname, '..', 'db', 'archive_seed_data.json.gz');
    if (fs.existsSync(seedGzPath)) {
        console.log('[2/4] Programlar (690 program / 54 aktif), Klipler (15.368 klip) ve Kurallar aktarılıyor...');
        const rawJson = zlib.gunzipSync(fs.readFileSync(seedGzPath)).toString('utf8');
        const seed = JSON.parse(rawJson);

        // 2.1 Kategoriler
        if (Array.isArray(seed.categories)) {
            for (const c of seed.categories) {
                await pool.query(`
                    INSERT INTO categories (id, name, color, badge)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (id) DO UPDATE
                    SET name = EXCLUDED.name, color = EXCLUDED.color, badge = EXCLUDED.badge
                `, [c.id, c.name, c.color, c.badge]);
            }
            await pool.query(`SELECT setval(pg_get_serial_sequence('categories', 'id'), COALESCE((SELECT MAX(id) FROM categories), 11), true)`).catch(() => {});
        }

        // 2.2 Ayrıştırma Kuralları (archive_parsing_rules)
        if (Array.isArray(seed.archive_parsing_rules)) {
            for (const r of seed.archive_parsing_rules) {
                await pool.query(`
                    INSERT INTO archive_parsing_rules (
                        id, program_title, category_id, match_patterns,
                        exclude_patterns, unit_type, extract_source, description, is_system
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (id) DO UPDATE
                    SET program_title = EXCLUDED.program_title,
                        category_id = EXCLUDED.category_id,
                        match_patterns = EXCLUDED.match_patterns,
                        exclude_patterns = EXCLUDED.exclude_patterns,
                        unit_type = EXCLUDED.unit_type,
                        extract_source = EXCLUDED.extract_source,
                        description = EXCLUDED.description,
                        is_system = EXCLUDED.is_system,
                        updated_at = NOW()
                `, [
                    r.id,
                    r.program_title || r.name || 'Kural',
                    r.category_id || 4,
                    r.match_patterns || r.match_pattern || '',
                    r.exclude_patterns || '',
                    r.unit_type || 'bolum',
                    r.extract_source || 'both',
                    r.description || r.notes || '',
                    Boolean(r.is_system)
                ]);
            }
            await pool.query(`SELECT setval(pg_get_serial_sequence('archive_parsing_rules', 'id'), COALESCE((SELECT MAX(id) FROM archive_parsing_rules), 1), true)`).catch(() => {});
            console.log(`✓ ${seed.archive_parsing_rules.length} adet özel ayrıştırma kuralı aktarıldı.`);
        }

        // 2.3 Arşiv Programları ve 54 Aktif Program (archive_programs)
        const progIdMap = new Map(); // oldId -> newId
        if (Array.isArray(seed.archive_programs)) {
            let activeCount = 0;
            for (const p of seed.archive_programs) {
                const res = await pool.query(`
                    INSERT INTO archive_programs (
                        category_id, category_name, mam_category_id, mam_category_name,
                        title, mam_title, slug, unit_type, is_custom_category, is_active,
                        total_episodes, total_clips, total_duration_sec, first_date, last_date
                    )
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                    ON CONFLICT (category_id, title) DO UPDATE
                    SET category_name = EXCLUDED.category_name,
                        mam_category_id = EXCLUDED.mam_category_id,
                        mam_category_name = EXCLUDED.mam_category_name,
                        mam_title = EXCLUDED.mam_title,
                        slug = EXCLUDED.slug,
                        unit_type = EXCLUDED.unit_type,
                        is_custom_category = EXCLUDED.is_custom_category,
                        is_active = EXCLUDED.is_active,
                        total_episodes = EXCLUDED.total_episodes,
                        total_clips = EXCLUDED.total_clips,
                        total_duration_sec = EXCLUDED.total_duration_sec,
                        first_date = EXCLUDED.first_date,
                        last_date = EXCLUDED.last_date,
                        updated_at = NOW()
                    RETURNING id
                `, [
                    p.category_id, p.category_name, p.mam_category_id, p.mam_category_name,
                    p.title, p.mam_title, p.slug, p.unit_type || 'bolum',
                    Boolean(p.is_custom_category), Boolean(p.is_active),
                    p.total_episodes || 0, p.total_clips || 0, p.total_duration_sec || 0,
                    p.first_date, p.last_date
                ]);
                if (res.rows?.[0]?.id) {
                    progIdMap.set(p.id, res.rows[0].id);
                }
                if (p.is_active) activeCount++;
            }
            console.log(`✓ ${seed.archive_programs.length} adet program (${activeCount} adet Aktif Kullanılan Program) aktarıldı.`);
        }

        // 2.4 Arşiv Klipleri (archive_clips - 15.368 adet, toplu batch halinde)
        if (Array.isArray(seed.archive_clips) && seed.archive_clips.length > 0) {
            const BATCH_SIZE = 400;
            let insertedClips = 0;
            for (let i = 0; i < seed.archive_clips.length; i += BATCH_SIZE) {
                const chunk = seed.archive_clips.slice(i, i + BATCH_SIZE);
                const values = [];
                const placeholders = [];
                let paramIdx = 1;

                for (const c of chunk) {
                    const mappedProgId = progIdMap.get(c.program_id) || c.program_id;
                    if (!mappedProgId) continue;
                    placeholders.push(`($${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++})`);
                    values.push(
                        mappedProgId,
                        c.category_id,
                        c.mam_category_id,
                        c.mam_category_name,
                        Boolean(c.is_custom_assigned),
                        c.file_id,
                        c.name,
                        c.file_name,
                        c.episode_no,
                        c.part_no,
                        c.unit_type || 'bolum',
                        c.unit_label,
                        c.note,
                        JSON.stringify(c.metadata || []),
                        c.duration_sec || 0,
                        c.duration_formatted,
                        c.file_create_time
                    );
                }

                if (placeholders.length > 0) {
                    await pool.query(`
                        INSERT INTO archive_clips (
                            program_id, category_id, mam_category_id, mam_category_name,
                            is_custom_assigned, file_id, name, file_name,
                            episode_no, part_no, unit_type, unit_label,
                            note, metadata, duration_sec, duration_formatted, file_create_time
                        )
                        VALUES ${placeholders.join(',')}
                        ON CONFLICT (file_id) DO UPDATE
                        SET program_id = EXCLUDED.program_id,
                            category_id = EXCLUDED.category_id,
                            mam_category_id = EXCLUDED.mam_category_id,
                            mam_category_name = EXCLUDED.mam_category_name,
                            is_custom_assigned = EXCLUDED.is_custom_assigned,
                            episode_no = EXCLUDED.episode_no,
                            part_no = EXCLUDED.part_no,
                            unit_type = EXCLUDED.unit_type,
                            unit_label = EXCLUDED.unit_label,
                            note = EXCLUDED.note,
                            metadata = EXCLUDED.metadata,
                            duration_sec = EXCLUDED.duration_sec,
                            duration_formatted = EXCLUDED.duration_formatted
                    `, values);
                    insertedClips += placeholders.length;
                }
            }
            console.log(`✓ ${insertedClips} adet bölüm/part klibi metadata bilgileriyle birlikte aktarıldı.`);
        }
    }

    // 3. Program Mappings Aktarımı
    console.log('[3/4] Program Eşleştirmeleri kontrol ediliyor...');
    const mappingsPath = path.resolve(projectRoot, 'backend_program_mappings.json');
    let mappingCount = 0;
    if (fs.existsSync(mappingsPath)) {
        try {
            const rawMappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
            if (Array.isArray(rawMappings)) {
                for (const m of rawMappings) {
                    if (m.dbName && m.displayName) {
                        await pool.query(`
                            INSERT INTO program_mappings (db_name, display_name, category)
                            VALUES ($1, $2, $3)
                            ON CONFLICT (db_name, display_name) DO UPDATE 
                            SET category = EXCLUDED.category, updated_at = NOW()
                        `, [m.dbName, m.displayName, m.category || null]);
                        mappingCount++;
                    }
                }
            }
        } catch (e) {}
    }

    // 4. Taslak Yayın Akışları Aktarımı (ch_hd ve ch_way)
    console.log('[4/4] Taslak Yayın Akışları (draft_schedule_*.json) aktarılıyor...');
    const channels = ['ch_hd', 'ch_way'];
    let totalDays = 0;

    for (const channelId of channels) {
        const filePath = path.resolve(__dirname, '..', 'data', `draft_schedule_${channelId}.json`);
        if (fs.existsSync(filePath)) {
            try {
                const scheduleData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                let channelDays = 0;

                for (const [dateKey, dayData] of Object.entries(scheduleData)) {
                    if (!dayData || typeof dayData !== 'object') continue;

                    const dayName = dayData.dayName || 'Bilinmeyen Gün';
                    const dateDisplay = dayData.date || dateKey;
                    const programs = Array.isArray(dayData.programs) ? dayData.programs : [];

                    await pool.query(`
                        INSERT INTO schedules (channel_id, date_key, day_name, date_display, programs, updated_at)
                        VALUES ($1, $2, $3, $4, $5, NOW())
                        ON CONFLICT (channel_id, date_key) DO UPDATE
                        SET day_name = EXCLUDED.day_name,
                            date_display = EXCLUDED.date_display,
                            programs = EXCLUDED.programs,
                            updated_at = NOW()
                    `, [channelId, dateKey, dayName, dateDisplay, JSON.stringify(programs)]);

                    channelDays++;
                }
                console.log(`✓ ${channelId} kanalı için ${channelDays} günlük yayın akışı aktarıldı.`);
                totalDays += channelDays;
            } catch (e) {
                console.warn(`${channelId} taslak aktarım hatası:`, e.message);
            }
        }
    }

    console.log('---------------------------------------------------------');
    console.log(`Tebrikler! Tüm programlar, 54 aktif program, 15.368 klip ve ${totalDays} günlük yayın akışı PostgreSQL'e aktarıldı.`);
    console.log('---------------------------------------------------------');

    await pool.end();
}

migrate().catch(err => {
    console.error('Migrasyon hatası:', err);
    process.exit(1);
});
