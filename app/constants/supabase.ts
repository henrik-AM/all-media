// Zugang zur Datenbank. Über app/.env.local überschreibbar (siehe
// .env.example); ohne diese Datei greifen die Standardwerte, damit die App
// auch auf einem frisch geklonten Rechner mit der Datenbank spricht.
//
// Der Schlüssel ist der öffentliche „publishable"-Schlüssel. Er ist dafür
// gemacht, im App-Bundle zu stehen. Geschützt wird die Datenbank durch ihre
// Regeln (Row Level Security), nicht durch Geheimhaltung dieses Schlüssels.
const STANDARD_URL = 'https://ijztosbjfybdgotpdixw.supabase.co';
const STANDARD_KEY = 'sb_publishable_sh_LhLSMkHNZrmmj7XkTtw_QFT1G9Ze';

export const SUPABASE_CONFIG = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL || STANDARD_URL,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || STANDARD_KEY,
  // Ziel der Links aus Bestätigungs- und Passwort-Mails.
  redirectUrl: process.env.EXPO_PUBLIC_REDIRECT_URL || 'https://all-media-website.onrender.com',
};

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
}
