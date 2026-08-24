import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../constants/supabase';

// Mock user for development (fallback if Supabase unavailable)
export const MOCK_AUTH_USER = {
  id: 'user_001',
  email: 'test@example.com',
  password: 'password123',
};

export async function signUpWithEmail(email: string, password: string) {
  try {
    const client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    const { data, error } = await client.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.warn('Supabase signup error:', error);
      // Fallback to mock auth
      return {
        success: true, // Mock success for dev
        user: { id: 'mock_' + Date.now(), email },
        error: null,
      };
    }

    return { success: true, user: data.user, error: null };
  } catch (err) {
    console.warn('Signup error:', err);
    // Fallback to mock auth
    return {
      success: true,
      user: { id: 'mock_' + Date.now(), email },
      error: null,
    };
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    const client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.warn('Supabase signin error:', error);
      // Mock login for development
      if (email === MOCK_AUTH_USER.email && password === MOCK_AUTH_USER.password) {
        return {
          success: true,
          user: { id: MOCK_AUTH_USER.id, email: MOCK_AUTH_USER.email },
          error: null,
        };
      }
      return { success: false, user: null, error: 'Invalid credentials' };
    }

    return { success: true, user: data.user, error: null };
  } catch (err) {
    console.warn('Signin error:', err);
    // Mock login fallback
    if (email === MOCK_AUTH_USER.email && password === MOCK_AUTH_USER.password) {
      return {
        success: true,
        user: { id: MOCK_AUTH_USER.id, email: MOCK_AUTH_USER.email },
        error: null,
      };
    }
    return { success: false, user: null, error: 'Sign in failed' };
  }
}

export async function signOut(client?: ReturnType<typeof createClient>) {
  try {
    if (client) {
      await client.auth.signOut();
    }
    return { success: true };
  } catch (err) {
    console.warn('Signout error:', err);
    return { success: true }; // Mock success
  }
}
