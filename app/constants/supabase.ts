// Supabase configuration
// For local development: use Supabase local setup (Docker)
// For cloud: sign up at https://app.supabase.com and add your credentials here

export const SUPABASE_CONFIG = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
};

// For Expo, all env vars must be prefixed with EXPO_PUBLIC_
// This allows runtime access without bundler issues
export const isDevelopment = __DEV__;
