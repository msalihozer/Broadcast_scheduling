/**
 * @file backend/middleware/securityMiddleware.js
 * @description Kurumsal Güvenlik Katmanı (WAF, DDoS Rate Limiter, Brute-Force Hesap/IP Kilitleme,
 * Scrypt Şifre Hashleme, HMAC-SHA256 Oturum Token Doğrulama ve HTTP Güvenlik Başlıkları).
 */
import crypto from 'crypto';

const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');

// 1. DDoS & Genel API Rate Limit Hafızası (IP -> { count, windowStart, blockedUntil })
const ipRateMap = new Map();
const MAX_REQUESTS_PER_MINUTE = parseInt(process.env.RATE_LIMIT_PER_MIN || '360', 10);
const DDOS_BLOCK_DURATION_MS = 5 * 60 * 1000; // 5 dakika blok

// 2. Brute-Force (Şifre Deneme) Hafızası (ip_or_user -> { attempts, firstAttemptAt, lockedUntil })
const loginAttemptMap = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 5 hatalı denemede 15 dakika kilit

// 3. Güvenlik Olayları Günlüğü (Admin Panelinde izlenebilir)
const securityEvents = [];

export function logSecurityEvent(type, ip, target, details, severity = 'warning') {
    const entry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        type,
        ip: ip || 'unknown',
        target: target || '-',
        details,
        severity // 'info' | 'warning' | 'critical'
    };
    securityEvents.unshift(entry);
    if (securityEvents.length > 100) {
        securityEvents.length = 100;
    }
    return entry;
}

export function getSecurityStatusSummary() {
    const now = Date.now();
    const lockedLogins = [];
    for (const [key, val] of loginAttemptMap.entries()) {
        if (val.lockedUntil && val.lockedUntil > now) {
            lockedLogins.push({
                key,
                attempts: val.attempts,
                remainingSec: Math.ceil((val.lockedUntil - now) / 1000)
            });
        }
    }

    const blockedIps = [];
    for (const [ip, val] of ipRateMap.entries()) {
        if (val.blockedUntil && val.blockedUntil > now) {
            blockedIps.push({
                ip,
                remainingSec: Math.ceil((val.blockedUntil - now) / 1000)
            });
        }
    }

    return {
        maxRequestsPerMinute: MAX_REQUESTS_PER_MINUTE,
        maxLoginAttempts: MAX_LOGIN_ATTEMPTS,
        lockoutMinutes: LOGIN_LOCKOUT_MS / 60000,
        lockedLogins,
        blockedIps,
        recentEvents: securityEvents.slice(0, 40)
    };
}

export function clearAllSecurityLocks() {
    loginAttemptMap.clear();
    ipRateMap.clear();
    logSecurityEvent('LOCK_RESET', 'Admin', 'Tüm Kilitler', 'Admin tarafından tüm IP ve Brute-Force kilitleri sıfırlandı.', 'info');
}

export function getClientIp(req) {
    const xff = req.headers['x-forwarded-for'];
    if (xff && typeof xff === 'string') {
        return xff.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || req.ip || 'unknown';
}

/**
 * Şifreyi tuzlu (salted) scrypt ile güvenli şekilde hashler.
 * Format: "scrypt$<salt>$<hash>"
 */
export function hashPassword(plainPassword) {
    const clean = String(plainPassword || '');
    if (clean.startsWith('scrypt$')) return clean;
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(clean, salt, 64).toString('hex');
    return `scrypt$${salt}$${derived}`;
}

/**
 * Girilen şifreyi hashlenmiş veya eski düz metin şifreyle zamanlama saldırısına (timing attack) dayanıklı şekilde doğrular.
 */
export function verifyPassword(plainPassword, storedPasswordOrHash) {
    if (!plainPassword || !storedPasswordOrHash) return false;
    const plainStr = String(plainPassword);
    const storedStr = String(storedPasswordOrHash);

    if (storedStr.startsWith('scrypt$')) {
        const parts = storedStr.split('$');
        if (parts.length !== 3) return false;
        const [, salt, originalHash] = parts;
        const derived = crypto.scryptSync(plainStr, salt, 64);
        const origBuf = Buffer.from(originalHash, 'hex');
        if (derived.length !== origBuf.length) return false;
        return crypto.timingSafeEqual(derived, origBuf);
    }

    // Eski düz metin kayıtlarla geriye dönük güvenli karşılaştırma
    const a = Buffer.from(plainStr, 'utf8');
    const b = Buffer.from(storedStr, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

/**
 * HMAC-SHA256 imzalı oturum tokenı üretir (12 saat geçerli).
 */
export function createSignedSessionToken(user) {
    const payload = {
        sub: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        iat: Date.now(),
        exp: Date.now() + 12 * 60 * 60 * 1000
    };
    const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(b64).digest('base64url');
    return `${b64}.${sig}`;
}

export function verifySignedSessionToken(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [b64, sig] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(b64).digest('base64url');
    if (sig !== expectedSig) return null;
    try {
        const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
        if (payload.exp && Date.now() > payload.exp) return null;
        return payload;
    } catch (_) {
        return null;
    }
}

/**
 * Brute-Force kontrolü: IP veya kullanıcı kilitli mi?
 */
export function checkLoginBruteForce(ip, username) {
    const now = Date.now();
    const ipKey = `ip:${ip}`;
    const userKey = `usr:${String(username || '').toLowerCase()}`;

    for (const k of [ipKey, userKey]) {
        const entry = loginAttemptMap.get(k);
        if (entry && entry.lockedUntil && entry.lockedUntil > now) {
            const remainingMin = Math.ceil((entry.lockedUntil - now) / 60000);
            return {
                locked: true,
                remainingMin,
                attempts: entry.attempts
            };
        }
    }
    return { locked: false };
}

export function recordFailedLoginAttempt(ip, username) {
    const now = Date.now();
    const ipKey = `ip:${ip}`;
    const userKey = `usr:${String(username || '').toLowerCase()}`;

    let maxAttempts = 0;
    let justLocked = false;

    for (const k of [ipKey, userKey]) {
        const prev = loginAttemptMap.get(k) || { attempts: 0, firstAttemptAt: now, lockedUntil: null };
        if (now - prev.firstAttemptAt > LOGIN_LOCKOUT_MS) {
            prev.attempts = 0;
            prev.firstAttemptAt = now;
            prev.lockedUntil = null;
        }
        prev.attempts += 1;
        if (prev.attempts > maxAttempts) maxAttempts = prev.attempts;
        if (prev.attempts >= MAX_LOGIN_ATTEMPTS) {
            prev.lockedUntil = now + LOGIN_LOCKOUT_MS;
            justLocked = true;
        }
        loginAttemptMap.set(k, prev);
    }

    if (justLocked) {
        logSecurityEvent(
            'BRUTE_FORCE_LOCKOUT',
            ip,
            username,
            `${MAX_LOGIN_ATTEMPTS} başarısız şifre denemesi nedeniyle IP (${ip}) ve kullanıcı (${username}) 15 dakika süreyle kilitlendi.`,
            'critical'
        );
    } else {
        logSecurityEvent(
            'FAILED_LOGIN',
            ip,
            username,
            `Hatalı giriş denemesi (${maxAttempts}/${MAX_LOGIN_ATTEMPTS}).`,
            'warning'
        );
    }

    return {
        attempts: maxAttempts,
        remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - maxAttempts),
        locked: justLocked
    };
}

export function clearLoginAttempts(ip, username) {
    loginAttemptMap.delete(`ip:${ip}`);
    loginAttemptMap.delete(`usr:${String(username || '').toLowerCase()}`);
}

/**
 * Express için HTTP Güvenlik Başlıkları, WAF (Path Traversal / Bot) ve DDoS Rate Limit Middleware'i.
 */
export function enterpriseSecurityMiddleware(req, res, next) {
    const ip = getClientIp(req);
    const now = Date.now();

    // 1. HTTP Güvenlik Başlıkları (Helmet Eşdeğeri)
    res.removeHeader('X-Powered-By');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // 2. WAF: Path Traversal veya Zararlı Tarayıcı Bot Kontrolü
    const rawUrl = req.originalUrl || req.url || '';
    if (rawUrl.includes('..%2f') || rawUrl.includes('..%5c') || rawUrl.includes('/etc/passwd') || rawUrl.includes('<script')) {
        logSecurityEvent('WAF_BLOCK', ip, rawUrl, 'Şüpheli URL / Path Traversal / XSS girişimi engellendi.', 'critical');
        return res.status(403).json({ error: 'Güvenlik duvarı (WAF) tarafından engellendi.' });
    }

    const ua = String(req.headers['user-agent'] || '').toLowerCase();
    if (/sqlmap|nikto|nmap|masscan|zgrab|gobuster|dirbuster/i.test(ua)) {
        logSecurityEvent('BOT_SCANNER_BLOCK', ip, ua, 'Otomatik zafiyet tarama botu engellendi.', 'critical');
        return res.status(403).json({ error: 'Erişim reddedildi.' });
    }

    // 3. DDoS / Rate Limit Kontrolü (Sadece /api/* istekleri için)
    if (rawUrl.startsWith('/api')) {
        let rate = ipRateMap.get(ip);
        if (!rate) {
            rate = { count: 0, windowStart: now, blockedUntil: null };
            ipRateMap.set(ip, rate);
        }

        if (rate.blockedUntil && rate.blockedUntil > now) {
            const waitSec = Math.ceil((rate.blockedUntil - now) / 1000);
            res.setHeader('Retry-After', String(waitSec));
            return res.status(429).json({
                error: `Çok fazla istek gönderildi (DDoS Koruması). Lütfen ${waitSec} saniye bekleyin.`
            });
        }

        if (now - rate.windowStart > 60000) {
            rate.count = 0;
            rate.windowStart = now;
            rate.blockedUntil = null;
        }

        rate.count += 1;
        if (rate.count > MAX_REQUESTS_PER_MINUTE) {
            rate.blockedUntil = now + DDOS_BLOCK_DURATION_MS;
            logSecurityEvent(
                'DDOS_RATE_LIMIT',
                ip,
                rawUrl,
                `Dakikada ${MAX_REQUESTS_PER_MINUTE} istek sınırı aşıldı (${rate.count} istek). IP 5 dakika süreyle bloklandı.`,
                'critical'
            );
            return res.status(429).json({
                error: 'İstek limiti aşıldı (DDoS Koruması). IP adresiniz geçici olarak kısıtlandı.'
            });
        }
    }

    next();
}
