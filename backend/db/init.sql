-- ==============================================================================
-- Yayın Planlama Sistemi - Yerel PostgreSQL Başlangıç Şeması
-- ==============================================================================

-- 1. Kanallar Tablosu
CREATE TABLE IF NOT EXISTS channels (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT '#10b981',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Varsayılan Kanalları Ekle
INSERT INTO channels (id, name, color) VALUES
    ('ch_hd', 'Semerkand HD', '#10b981'),
    ('ch_way', 'Semerkand WAY', '#3b82f6')
ON CONFLICT (id) DO NOTHING;

-- 1.1 Kategoriler Tablosu (MAM Veritabanı ile Birebir Uyumlu)
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) NOT NULL,
    badge VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO categories (id, name, color, badge) VALUES
    (1, 'Kadın', '#ec4899', 'Kadın'),
    (2, 'Haber', '#ef4444', 'Haber'),
    (3, 'Tanıtım', '#14b8a6', 'Tanıtım'),
    (4, 'Dini', '#10b981', 'Dini'),
    (5, 'Çocuk', '#f59e0b', 'Çocuk'),
    (6, 'Reklam', '#eab308', 'Reklam'),
    (7, 'Jenerik', '#6366f1', 'Jenerik'),
    (8, 'Kültürel', '#3b82f6', 'Kültür'),
    (9, 'Detay', '#8b5cf6', 'Detay'),
    (10, 'Kısa Program', '#06b6d4', 'Kısa'),
    (11, 'Ham', '#64748b', 'Ham')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color, badge = EXCLUDED.badge;

-- 2. Yayın Akışları / Günlük & Haftalık Planlar
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    channel_id VARCHAR(50) NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    date_key VARCHAR(20) NOT NULL,            -- Örn: '2025-10-27'
    day_name VARCHAR(50) NOT NULL,            -- Örn: 'Pazartesi'
    date_display VARCHAR(100),                -- Örn: '27 Ekim 2025'
    programs JSONB NOT NULL DEFAULT '[]'::jsonb, -- Program blokları listesi
    is_stage1_locked BOOLEAN DEFAULT FALSE,   -- 1. Aşama Kilidi (Taslak Onayı)
    is_stage2_locked BOOLEAN DEFAULT FALSE,   -- 2. Aşama Kilidi (Liste Kontrol / Yayın Onayı)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_channel_date UNIQUE (channel_id, date_key)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_schedules_channel_date ON schedules(channel_id, date_key);
CREATE INDEX IF NOT EXISTS idx_schedules_programs_gin ON schedules USING GIN (programs);

-- 3. Program Başlık Eşleştirme Sözlüğü (Mapping)
CREATE TABLE IF NOT EXISTS program_mappings (
    id SERIAL PRIMARY KEY,
    db_name VARCHAR(255) NOT NULL,            -- MAM / Resmi Veritabanı Adı
    display_name VARCHAR(255) NOT NULL,       -- Akışta / Excel'de Gözüken Başlık
    category VARCHAR(100),                    -- Kategori (Dini, Sohbet vb.)
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_mapping_names UNIQUE (db_name, display_name)
);

CREATE INDEX IF NOT EXISTS idx_mappings_dbname ON program_mappings(db_name);
CREATE INDEX IF NOT EXISTS idx_mappings_displayname ON program_mappings(display_name);

-- 4. Kullanıcılar ve Roller (Yerel Auth Desteği)
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'planner', -- 'admin', 'planner', 'ads', 'operator', 'viewer'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Varsayılan Tek Admin Kullanıcısı (Şifre uygulama ilk açılışta .env ADMIN_INITIAL_PASSWORD üzerinden Scrypt ile oluşturulur)
INSERT INTO app_users (email, password_hash, full_name, role) VALUES
    ('admin@plan.com', 'SCRYPT_MANAGED_BY_APP', 'Sistem Yöneticisi', 'base admin')
ON CONFLICT (email) DO NOTHING;

-- 5. Reklam Kuşakları ve Rezervasyonlar
CREATE TABLE IF NOT EXISTS ad_reservations (
    id SERIAL PRIMARY KEY,
    channel_id VARCHAR(50) NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    date_key VARCHAR(20) NOT NULL,
    break_time VARCHAR(10) NOT NULL,          -- Örn: '14:30'
    company_name VARCHAR(255) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    duration INTEGER NOT NULL DEFAULT 30,     -- Saniye cinsinden
    is_sponsored BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ads_channel_date ON ad_reservations(channel_id, date_key);

-- 6. MAM Arşiv Programları ve Bölüm Klipleri (İki Katmanlı Kategori: TV MAM DB + Bizim Kategori)
CREATE TABLE IF NOT EXISTS archive_programs (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    category_name VARCHAR(100) NOT NULL,
    mam_category_id INTEGER,
    mam_category_name VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    mam_title VARCHAR(255),
    slug VARCHAR(255),
    unit_type VARCHAR(20) DEFAULT 'bolum',
    is_custom_category BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT FALSE,
    total_episodes INTEGER DEFAULT 0,
    total_clips INTEGER DEFAULT 0,
    total_duration_sec INTEGER DEFAULT 0,
    first_date TIMESTAMPTZ,
    last_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_program_cat_title UNIQUE (category_id, title)
);

CREATE INDEX IF NOT EXISTS idx_archive_prog_cat ON archive_programs(category_id);
CREATE INDEX IF NOT EXISTS idx_archive_prog_mam_cat ON archive_programs(mam_category_id);

CREATE TABLE IF NOT EXISTS archive_clips (
    id SERIAL PRIMARY KEY,
    program_id INTEGER NOT NULL REFERENCES archive_programs(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL,
    mam_category_id INTEGER,
    mam_category_name VARCHAR(100),
    is_custom_assigned BOOLEAN DEFAULT FALSE,
    file_id INTEGER UNIQUE NOT NULL,               -- MSSQL Files.fileId
    name VARCHAR(255) NOT NULL,                    -- Ham klip adı (örn: saliha_hanimlar_19_260118_p2)
    file_name VARCHAR(255),                        -- MXF dosya adı (örn: 4T459KOT.mxf)
    episode_no INTEGER,                            -- Bölüm No (örn: 19)
    part_no INTEGER,                               -- Parça No (1, 2, 3, 4 vb.)
    unit_type VARCHAR(20) DEFAULT 'bolum',
    unit_label VARCHAR(50),
    note VARCHAR(255),                             -- Not veya özel başlık (örn: Regaib Kandili Özel)
    metadata JSONB DEFAULT '[]'::jsonb,
    duration_sec INTEGER NOT NULL DEFAULT 0,       -- Saniye cinsinden kesin süre
    duration_formatted VARCHAR(50),                -- '21:27' veya '00:21:27'
    file_create_time TIMESTAMPTZ,                  -- MAM kayıt/çekim tarihi
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_archive_clips_prog ON archive_clips(program_id);
CREATE INDEX IF NOT EXISTS idx_archive_clips_mam_cat ON archive_clips(mam_category_id);
CREATE INDEX IF NOT EXISTS idx_archive_clips_date ON archive_clips(file_create_time DESC);
CREATE INDEX IF NOT EXISTS idx_archive_clips_ep ON archive_clips(program_id, episode_no, part_no);

