/**
 * @file backend/routes/draftRoutes.js
 * @description Taslak akış yönetimi (/api/draftSchedule, /api/saveDraftSchedule),
 * Excel içe aktarma (/api/importDraftSchedule, /api/importWeeklyFlow) ve
 * program katalog / eşleştirme (/api/programMappings, /api/programCatalog) uç noktaları.
 */
import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isPostgresReady, query as pgQuery } from '../db/postgres.js';
import {
    getClientIp,
    hashPassword,
    verifyPassword,
    createSignedSessionToken,
    checkLoginBruteForce,
    recordFailedLoginAttempt,
    clearLoginAttempts,
    logSecurityEvent
} from '../middleware/securityMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');

const MAPPINGS_FILE = 'backend_program_mappings.json';
const PYTHON_CMD = process.env.PYTHON_BIN || 'python';

const getStorageFilePath = (channel) => {
    const dataDir = path.resolve(BACKEND_DIR, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    const runtimePath = path.join(dataDir, `draft_schedule_${channel}.json`);
    if (!fs.existsSync(runtimePath)) {
        const sourcePath = path.resolve(BACKEND_DIR, '..', 'src', 'data', `draft_schedule_${channel}.json`);
        if (fs.existsSync(sourcePath)) {
            try {
                fs.copyFileSync(sourcePath, runtimePath);
            } catch (e) {}
        }
    }
    return runtimePath;
};

export function createDraftRouter() {
    const router = express.Router();

    const managedUsersFilePath = () => {
        const dataDir = path.resolve(BACKEND_DIR, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        return path.join(dataDir, 'managed_users.json');
    };

    const initialAdminPw = process.env.ADMIN_INITIAL_PASSWORD || 'admin';

    const defaultAdminOnlyList = [
        {
            id: 'usr_admin',
            name: 'Sistem Yöneticisi',
            username: 'admin',
            email: 'admin@plan.com',
            password: hashPassword(initialAdminPw),
            role: 'base admin',
            isActive: true,
            allowedModules: ['draft', 'ready', 'ads', 'list-control', 'admin'],
            allowedAdminTabs: ['overview', 'server-monitor', 'programs', 'archive-analysis', 'users', 'lists', 'stats', 'ads', 'logs', 'themes', 'settings'],
            updatedAt: '2026-11-19T12:00:00.000Z'
        }
    ];

    const readRawUsersFromDisk = () => {
        const p = managedUsersFilePath();
        if (fs.existsSync(p)) {
            try {
                const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
                if (Array.isArray(parsed) && parsed.length > 0) {
                    let needsSave = false;
                    const normalized = parsed.map(u => {
                        const rawPw = u.password || (u.username === 'admin' ? initialAdminPw : '');
                        if (rawPw && !String(rawPw).startsWith('scrypt$')) {
                            needsSave = true;
                            return { ...u, password: hashPassword(rawPw) };
                        }
                        return u;
                    });
                    if (needsSave) {
                        fs.writeFileSync(p, JSON.stringify(normalized, null, 2), 'utf8');
                    }
                    return normalized;
                }
            } catch (_) {}
        }
        fs.writeFileSync(p, JSON.stringify(defaultAdminOnlyList, null, 2), 'utf8');
        return defaultAdminOnlyList;
    };

    const sanitizeUserForClient = (u) => {
        const { password, ...safe } = u;
        return {
            ...safe,
            hasPassword: Boolean(password)
        };
    };

    // 1. GÜVENLİ KULLANICI LİSTESİ (Tarayıcıya asla şifre veya hash göndermez!)
    router.get('/managedUsers', (req, res) => {
        try {
            const users = readRawUsersFromDisk();
            res.json(users.map(sanitizeUserForClient));
        } catch (err) {
            res.json(defaultAdminOnlyList.map(sanitizeUserForClient));
        }
    });

    // 2. KULLANICI EKLEME / GÜNCELLEME (Yeni şifreleri Scrypt ile tuzlayarak hashler)
    router.post('/managedUsers', express.json(), (req, res) => {
        try {
            const incomingUsers = req.body;
            if (!Array.isArray(incomingUsers) || incomingUsers.length === 0) {
                return res.status(400).json({ error: 'En az 1 yönetici hesabı bulunmalıdır.' });
            }
            const existingUsers = readRawUsersFromDisk();
            const existingById = new Map(existingUsers.map(u => [u.id, u]));

            const finalUsers = incomingUsers.map(u => {
                const prev = existingById.get(u.id);
                let finalPassword = prev?.password || '';
                if (u.password && String(u.password).trim() !== '') {
                    finalPassword = hashPassword(String(u.password).trim());
                } else if (!finalPassword && (u.username === 'admin' || u.email === 'admin@plan.com')) {
                    finalPassword = hashPassword(initialAdminPw);
                }
                return {
                    ...u,
                    password: finalPassword
                };
            });

            const p = managedUsersFilePath();
            fs.writeFileSync(p, JSON.stringify(finalUsers, null, 2), 'utf8');
            res.json({
                success: true,
                count: finalUsers.length,
                users: finalUsers.map(sanitizeUserForClient)
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // 3. GÜVENLİ SUNUCU TARAFLI GİRİŞ (Brute-Force Kilitli + Bot Korumalı + Scrypt Doğrulamalı)
    router.post('/auth/login', express.json(), async (req, res) => {
        const ip = getClientIp(req);
        const { usernameOrEmail, password, botTrap } = req.body || {};

        // Bot / Honeypot tuzağı kontrolü
        if (botTrap && String(botTrap).trim() !== '') {
            logSecurityEvent('BOT_HONEYPOT', ip, usernameOrEmail || 'bot', 'Gizli honeypot alanı doldurulduğu için otomatik bot engellendi.', 'critical');
            return res.status(403).json({ error: 'Otomatik bot isteği engellendi.' });
        }

        const rawInput = String(usernameOrEmail || '').trim().toLowerCase();
        const formattedEmail = rawInput.includes('@') ? rawInput : `${rawInput}@plan.com`;
        const inputUsername = formattedEmail.split('@')[0].toLowerCase().trim();

        // Brute-Force kilit kontrolü (5 hatalı deneme -> 15 dk kilit)
        const lockInfo = checkLoginBruteForce(ip, inputUsername);
        if (lockInfo.locked) {
            return res.status(429).json({
                error: `Çok fazla hatalı giriş denemesi (${lockInfo.attempts} kez). Güvenlik nedeniyle girişiniz ${lockInfo.remainingMin} dakika süreyle kilitlenmiştir.`
            });
        }

        const users = readRawUsersFromDisk();
        const matched = users.find(
            u =>
                String(u.email || '').toLowerCase().trim() === formattedEmail ||
                String(u.username || '').toLowerCase().trim() === inputUsername
        );

        if (!matched || !verifyPassword(password, matched.password)) {
            // Hatalı denemede artan gecikme (Tarpit: Bot hızını yavaşlatır)
            await new Promise(r => setTimeout(r, 450));
            const failInfo = recordFailedLoginAttempt(ip, inputUsername);
            if (failInfo.locked) {
                return res.status(429).json({
                    error: '5 kez hatalı şifre girildiği için hesabınız ve IP adresiniz 15 dakika süreyle kilitlenmiştir.'
                });
            }
            return res.status(401).json({
                error: `Kullanıcı adı veya şifre hatalı. (Kalan deneme hakkınız: ${failInfo.remainingAttempts})`
            });
        }

        if (matched.isActive === false) {
            logSecurityEvent('DISABLED_USER_LOGIN', ip, matched.email, 'Pasif hesap giriş denemesi reddedildi.', 'warning');
            return res.status(403).json({
                error: 'Bu kullanıcı hesabı yönetici tarafından pasif duruma getirilmiştir.'
            });
        }

        clearLoginAttempts(ip, inputUsername);
        const token = createSignedSessionToken(matched);
        logSecurityEvent('LOGIN_SUCCESS', ip, matched.email, `${matched.name} (${matched.role}) güvenli oturum açtı.`, 'info');

        return res.json({
            ok: true,
            token,
            user: sanitizeUserForClient(matched)
        });
    });

    router.get('/programMappings', async (req, res) => {
        try {
            if (isPostgresReady()) {
                const pgRes = await pgQuery('SELECT db_name as "dbName", display_name as "displayName", category FROM program_mappings ORDER BY display_name ASC');
                if (pgRes.rows && pgRes.rows.length > 0) {
                    return res.json(pgRes.rows);
                }
            }
            if (fs.existsSync(MAPPINGS_FILE)) {
                const data = fs.readFileSync(MAPPINGS_FILE, 'utf-8');
                res.json(JSON.parse(data));
            } else {
                res.json([]);
            }
        } catch (err) {
            res.status(500).send(err.message);
        }
    });

    router.post('/programMappings', async (req, res) => {
        try {
            const mappings = req.body;
            if (!Array.isArray(mappings)) {
                return res.status(400).send('Expected an array of mappings');
            }
            if (isPostgresReady()) {
                for (const m of mappings) {
                    if (m.dbName && m.displayName) {
                        await pgQuery(`
                            INSERT INTO program_mappings (db_name, display_name, category)
                            VALUES ($1, $2, $3)
                            ON CONFLICT (db_name, display_name) DO UPDATE 
                            SET category = EXCLUDED.category, updated_at = NOW()
                        `, [m.dbName, m.displayName, m.category || null]);
                    }
                }
                console.log(`[POSTGRES] ${mappings.length} eşleştirme PostgreSQL'e kaydedildi.`);
            }
            fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(mappings, null, 2), 'utf-8');
            res.json({ success: true });
        } catch (err) {
            res.status(500).send(err.message);
        }
    });

    router.post('/importWeeklyFlow', express.json({ limit: '50mb' }), (req, res) => {
        const { filePath, fileBase64 } = req.body;
        let targetPath = filePath || path.resolve(BACKEND_DIR, '..', 'document', '5 dk.lık akış.xlsx');
        
        if (fileBase64) {
            targetPath = path.resolve(BACKEND_DIR, 'temp_uploaded_flow.xlsx');
            try {
                const buffer = Buffer.from(fileBase64, 'base64');
                fs.writeFileSync(targetPath, buffer);
            } catch (e) {
                return res.status(400).send('Dosya verisi yazılamadı: ' + e.message);
            }
        }
        
        const pythonProcess = spawn(PYTHON_CMD, [path.resolve(BACKEND_DIR, 'excel_parser.py'), targetPath]);
        let output = '';
        let errorOutput = '';
        
        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error('[IMPORT] Python error code:', code, errorOutput);
                return res.status(500).send('Excel ayrıştırma hatası: ' + errorOutput);
            }
            try {
                const parsedData = JSON.parse(output);
                res.json(parsedData);
            } catch (e) {
                console.error('[IMPORT] JSON parse error:', e.message, output);
                res.status(500).send('JSON parse hatası: ' + e.message);
            }
        });
    });

    router.post('/importDraftSchedule', express.json({ limit: '50mb' }), (req, res) => {
        const { filePath, fileBase64, autoSave, channel = 'ch_hd' } = req.body;
        let targetPath;
        
        if (fileBase64) {
            targetPath = path.resolve(BACKEND_DIR, 'temp_uploaded_draft.xlsx');
            try {
                const buffer = Buffer.from(fileBase64, 'base64');
                fs.writeFileSync(targetPath, buffer);
            } catch (e) {
                return res.status(400).send('Dosya verisi yazılamadı: ' + e.message);
            }
        } else if (filePath) {
            targetPath = path.isAbsolute(filePath) ? filePath : path.resolve(BACKEND_DIR, '..', filePath);
        } else {
            const yayinDir = path.resolve(BACKEND_DIR, '..', 'yayinplanlama');
            const files = fs.readdirSync(yayinDir);
            const match = files.find(f => f.endsWith('.xlsx'));
            targetPath = match ? path.join(yayinDir, match) : path.join(yayinDir, '27 EKİM-2 KASIM 2025 AKIŞ.xlsx');
        }
        
        const scriptPath = path.resolve(BACKEND_DIR, 'draft_excel_parser.py');
        const args = [scriptPath, targetPath];
        if (autoSave) {
            args.push('--save', '--channel', channel);
        }
        
        const pythonProcess = spawn(PYTHON_CMD, args, { cwd: path.resolve(BACKEND_DIR, '..') });
        let output = '';
        let errorOutput = '';
        
        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error('[IMPORT DRAFT] Python error code:', code, errorOutput);
                return res.status(500).send('Taslak Excel ayrıştırma hatası: ' + errorOutput);
            }
            try {
                const parsedData = JSON.parse(output);
                const targetChannels = Array.isArray(req.body.channels) && req.body.channels.length > 0
                    ? req.body.channels
                    : [channel];

                if (autoSave) {
                    targetChannels.forEach(chId => {
                        const chPath = path.resolve(BACKEND_DIR, '..', 'src', 'data', `draft_schedule_${chId}.json`);
                        try {
                            fs.writeFileSync(chPath, JSON.stringify(parsedData, null, 2), 'utf8');
                        } catch (err) {
                            console.error(`[IMPORT DRAFT] Error saving for channel ${chId}:`, err);
                        }
                    });
                }
                res.json(parsedData);
            } catch (e) {
                console.error('[IMPORT DRAFT] JSON parse error:', e.message, output);
                res.status(500).send('JSON parse hatası: ' + e.message);
            }
        });
    });

    router.get('/draftSchedule', async (req, res) => {
        const channel = req.query.channel || 'ch_hd';
        if (isPostgresReady()) {
            try {
                const result = await pgQuery(`
                    SELECT date_key, day_name, date_display, programs, is_stage1_locked, is_stage2_locked
                    FROM schedules
                    WHERE channel_id = $1
                    ORDER BY date_key ASC
                `, [channel]);
                if (result.rows && result.rows.length > 0) {
                    const scheduleMap = {};
                    for (const row of result.rows) {
                        if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date_key)) continue;
                        scheduleMap[row.date_key] = {
                            date: row.date_display || row.date_key,
                            dayName: row.day_name,
                            programs: row.programs || [],
                            isStage1Locked: row.is_stage1_locked,
                            isStage2Locked: row.is_stage2_locked
                        };
                    }
                    return res.json(scheduleMap);
                }
            } catch (e) {
                console.error('[POSTGRES] Taslak okuma hatası, JSON dosyasına geçiliyor:', e.message);
            }
        }

        const filePath = getStorageFilePath(channel);
        if (fs.existsSync(filePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                return res.json(data);
            } catch (e) {
                console.error('Taslak okuma hatası:', e);
            }
        }

        const defaultPath = path.resolve(BACKEND_DIR, '..', 'src', 'data', 'defaultWeeklySchedule.json');
        if (fs.existsSync(defaultPath)) {
            const data = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
            return res.json(data);
        }
        res.status(404).send('Taslak bulunamadı');
    });

    router.post('/saveDraftSchedule', express.json({ limit: '50mb' }), async (req, res) => {
        const { channel = 'ch_hd', channels = [], schedule } = req.body;
        if (!schedule) {
            return res.status(400).send('Schedule verisi eksik');
        }
        const targetChannels = Array.isArray(channels) && channels.length > 0 ? channels : [channel];
        try {
            if (isPostgresReady()) {
                for (const ch of targetChannels) {
                    for (const [dateKey, dayData] of Object.entries(schedule)) {
                        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
                        if (!dayData || typeof dayData !== 'object') continue;
                        const dayName = dayData.dayName || 'Bilinmeyen Gün';
                        const dateDisplay = dayData.date || dateKey;
                        const programs = Array.isArray(dayData.programs) ? dayData.programs : [];
                        await pgQuery(`
                            INSERT INTO schedules (channel_id, date_key, day_name, date_display, programs, updated_at)
                            VALUES ($1, $2, $3, $4, $5, NOW())
                            ON CONFLICT (channel_id, date_key) DO UPDATE
                            SET day_name = EXCLUDED.day_name,
                                date_display = EXCLUDED.date_display,
                                programs = EXCLUDED.programs,
                                updated_at = NOW()
                        `, [ch, dateKey, dayName, dateDisplay, JSON.stringify(programs)]);
                    }
                }
                console.log(`[POSTGRES] Taslak PostgreSQL'e başarıyla kaydedildi: ${targetChannels.join(', ')}`);
            }

            targetChannels.forEach(ch => {
                const filePath = getStorageFilePath(ch);
                const sourcePath = path.resolve(BACKEND_DIR, '..', 'src', 'data', `draft_schedule_${ch}.json`);

                let existingData = {};
                if (fs.existsSync(filePath)) {
                    try {
                        existingData = JSON.parse(fs.readFileSync(filePath, 'utf8')) || {};
                    } catch (e) {}
                }

                const merged = { ...existingData, ...schedule };
                delete merged.all;
                fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf8');

                try {
                    fs.writeFileSync(sourcePath, JSON.stringify(merged, null, 2), 'utf8');
                } catch (err) {}
            });
            console.log(`[SAVE] Taslak başarıyla diske yazıldı ve senkronize edildi: ${targetChannels.join(', ')}`);
            res.json({ success: true, channels: targetChannels });
        } catch (e) {
            console.error('[SAVE] Hata:', e.message);
            res.status(500).send('Kaydetme hatası: ' + e.message);
        }
    });

    // 4. TASLAK / GÜNLÜK LİSTE SİLME (Hem PostgreSQL schedules tablosundan hem JSON dosyalarından siler)
    router.delete('/draftSchedule', express.json(), async (req, res) => {
        const channel = req.query.channel || req.body?.channel || 'ch_hd';
        const dateKey = req.query.dateKey || req.body?.dateKey;
        if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey))) {
            return res.status(400).json({ error: 'Geçerli bir dateKey (YYYY-AA-GG) gereklidir.' });
        }
        try {
            if (isPostgresReady()) {
                await pgQuery(
                    `DELETE FROM schedules WHERE channel_id = $1 AND date_key = $2`,
                    [channel, dateKey]
                );
            }
            const filePath = getStorageFilePath(channel);
            const sourcePath = path.resolve(BACKEND_DIR, '..', 'src', 'data', `draft_schedule_${channel}.json`);
            [filePath, sourcePath].forEach((p) => {
                if (fs.existsSync(p)) {
                    try {
                        const existing = JSON.parse(fs.readFileSync(p, 'utf8')) || {};
                        if (existing[dateKey]) {
                            delete existing[dateKey];
                            fs.writeFileSync(p, JSON.stringify(existing, null, 2), 'utf8');
                        }
                    } catch (_) {}
                }
            });
            return res.json({ success: true, channel, dateKey });
        } catch (err) {
            console.error('[DELETE SCHEDULE] Hata:', err.message);
            return res.status(500).json({ error: err.message });
        }
    });

    // 5. TEMEL ROL ŞABLONLARI (GET / POST /api/roleTemplates)
    const roleTemplatesFilePath = () => {
        const dataDir = path.resolve(BACKEND_DIR, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        return path.join(dataDir, 'role_templates.json');
    };

    const defaultRoleTemplates = [
        {
            id: 'base admin',
            label: 'Base Admin (Tam Yetkili Kurucu)',
            description: 'Tüm modüller, sunucu yönetimi, veritabanı ve güvenlik ayarlarına tam erişim.',
            color: '#ef4444',
            isSystem: true,
            allowedModules: ['draft', 'ready', 'ads', 'list-control', 'admin'],
            allowedAdminTabs: ['overview', 'server-monitor', 'programs', 'archive-analysis', 'users', 'lists', 'stats', 'ads', 'logs', 'themes', 'settings']
        },
        {
            id: 'admin',
            label: 'Yönetici (Admin)',
            description: 'Tüm yayın planlama modülleri ve yönetim paneli sekmelerine tam erişim.',
            color: '#6366f1',
            isSystem: true,
            allowedModules: ['draft', 'ready', 'ads', 'list-control', 'admin'],
            allowedAdminTabs: ['overview', 'server-monitor', 'programs', 'archive-analysis', 'users', 'lists', 'stats', 'ads', 'logs', 'themes', 'settings']
        },
        {
            id: 'yonetmen',
            label: 'Yayın Yönetmeni',
            description: 'Taslak planlama, yayına hazır liste hazırlama, MAM arşiv ve program yönetimi.',
            color: '#2563eb',
            isSystem: false,
            allowedModules: ['draft', 'ready', 'list-control', 'admin'],
            allowedAdminTabs: ['overview', 'programs', 'archive-analysis', 'lists', 'stats']
        },
        {
            id: 'reklam',
            label: 'Reklam & Rezervasyon Sorumlusu',
            description: 'Reklam kuşakları, spot yerleştirme, firma/marka rezervasyon ve yayın kontrolü.',
            color: '#d97706',
            isSystem: false,
            allowedModules: ['ads', 'list-control', 'admin'],
            allowedAdminTabs: ['overview', 'ads', 'stats']
        },
        {
            id: 'user',
            label: 'Standart Kullanıcı (İzleyici / MCR)',
            description: 'Yalnızca Yayın Kontrol (salt-okunur günlük/haftalık yayın akışı ve PDF çıktı) ekranı.',
            color: '#64748b',
            isSystem: false,
            allowedModules: ['list-control'],
            allowedAdminTabs: []
        }
    ];

    router.get('/roleTemplates', (req, res) => {
        try {
            const p = roleTemplatesFilePath();
            if (fs.existsSync(p)) {
                const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return res.json(parsed);
                }
            }
            fs.writeFileSync(p, JSON.stringify(defaultRoleTemplates, null, 2), 'utf8');
            return res.json(defaultRoleTemplates);
        } catch (err) {
            return res.json(defaultRoleTemplates);
        }
    });

    router.post('/roleTemplates', express.json(), (req, res) => {
        try {
            const templates = req.body;
            if (!Array.isArray(templates) || templates.length === 0) {
                return res.status(400).json({ error: 'Geçerli bir rol şablonu listesi gönderilmelidir.' });
            }
            const p = roleTemplatesFilePath();
            fs.writeFileSync(p, JSON.stringify(templates, null, 2), 'utf8');
            return res.json({ success: true, templates });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });

    // 6. MERKEZİ KULLANICI & SİSTEM DENETİM LOGLARI (GET / POST / DELETE /api/systemLogs)
    const systemLogsFilePath = () => {
        const dataDir = path.resolve(BACKEND_DIR, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        return path.join(dataDir, 'system_logs.json');
    };

    const readSystemLogs = () => {
        const p = systemLogsFilePath();
        if (fs.existsSync(p)) {
            try {
                const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
                if (Array.isArray(parsed)) return parsed;
            } catch (_) {}
        }
        return [];
    };

    router.get('/systemLogs', (req, res) => {
        try {
            const logs = readSystemLogs();
            return res.json(logs);
        } catch (err) {
            return res.json([]);
        }
    });

    router.post('/systemLogs', express.json(), (req, res) => {
        try {
            const entry = req.body;
            if (!entry || typeof entry !== 'object') {
                return res.status(400).json({ error: 'Geçersiz log kaydı.' });
            }
            const ip = getClientIp(req);
            const existing = readSystemLogs();
            const enriched = {
                ...entry,
                id: entry.id || `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                timestamp: entry.timestamp || new Date().toISOString(),
                ip: entry.ip || ip
            };
            const updated = [enriched, ...existing.filter(l => l.id !== enriched.id)].slice(0, 2500);
            fs.writeFileSync(systemLogsFilePath(), JSON.stringify(updated, null, 2), 'utf8');
            return res.json({ success: true, entry: enriched });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });

    router.delete('/systemLogs', (req, res) => {
        try {
            const category = req.query.category || 'all';
            if (category === 'all') {
                fs.writeFileSync(systemLogsFilePath(), JSON.stringify([], null, 2), 'utf8');
            } else {
                const existing = readSystemLogs();
                const filtered = existing.filter(l => (l.category || l.panel) !== category);
                fs.writeFileSync(systemLogsFilePath(), JSON.stringify(filtered, null, 2), 'utf8');
            }
            return res.json({ success: true });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });

    router.get('/programCatalog', (req, res) => {
        try {
            const primaryPath = path.resolve(BACKEND_DIR, 'program_categories_catalog.json');
            const fallbackPath = path.resolve(BACKEND_DIR, '..', 'src', 'data', 'program_categories_catalog.json');
            
            let targetPath = primaryPath;
            if (!fs.existsSync(primaryPath) && fs.existsSync(fallbackPath)) {
                targetPath = fallbackPath;
            }

            if (fs.existsSync(targetPath)) {
                const data = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
                return res.json(data);
            }

            return res.status(404).json({ error: 'Program kataloğu bulunamadı. Lütfen önce yenileyin.' });
        } catch (err) {
            console.error('[CATALOG] Get error:', err);
            res.status(500).json({ error: 'Katalog okunamadı: ' + err.message });
        }
    });

    router.post('/programCatalog/reload', (req, res) => {
        try {
            const scriptPath = path.resolve(BACKEND_DIR, 'extract_program_catalog.py');
            const pythonProcess = spawn('python', [scriptPath], { cwd: path.resolve(BACKEND_DIR, '..') });

            let output = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (d) => { output += d.toString(); });
            pythonProcess.stderr.on('data', (d) => { errorOutput += d.toString(); });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error('[CATALOG RELOAD] Error code:', code, errorOutput);
                    return res.status(500).json({ error: 'Katalog çıkarılırken hata oluştu: ' + errorOutput });
                }

                const primaryPath = path.resolve(BACKEND_DIR, 'program_categories_catalog.json');
                if (fs.existsSync(primaryPath)) {
                    try {
                        const data = JSON.parse(fs.readFileSync(primaryPath, 'utf8'));
                        return res.json({ success: true, message: 'Katalog başarıyla güncellendi.', data });
                    } catch (e) {
                        return res.status(500).json({ error: 'Katalog JSON okunamadı: ' + e.message });
                    }
                }
                res.json({ success: true, message: 'Katalog oluşturuldu fakat dosya okunamadı.' });
            });
        } catch (err) {
            console.error('[CATALOG RELOAD] Exception:', err);
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}

