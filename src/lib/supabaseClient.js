/**
 * @file src/lib/supabaseClient.js
 * @description Supabase bulut kimlik doğrulama ve veritabanı istemci yapılandırması.
 * Ortam değişkenleri (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) tanımlı değilse çevrimdışı/demo moduna izin verir.
 */
import { createClient } from '@supabase/supabase-js';

// Supabase projenizin URL ve Anon Key bilgilerini buraya veya .env dosyasına eklemeniz gerekiyor.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseUrl !== 'YOUR_SUPABASE_URL' && 
  !supabaseUrl.includes('YOUR_') &&
  !supabaseUrl.includes('placeholder')
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
