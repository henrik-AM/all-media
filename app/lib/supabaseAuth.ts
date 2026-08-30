import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../constants/supabase';

export async function signUpWithEmail(email: string, password: string) {
  try {
    const client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    const { data, error } = await client.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error('Supabase signup error:', error);
      return {
        success: false,
        user: null,
        error: error.message || 'Registrierung fehlgeschlagen',
      };
    }

    return { success: true, user: data.user, error: null };
  } catch (err) {
    console.error('Signup error:', err);
    return {
      success: false,
      user: null,
      error: err instanceof Error ? err.message : 'Registrierung fehlgeschlagen',
    };
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
      return { success: false, user: null, error: 'Supabase nicht konfiguriert' };
    }

    const client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Supabase signin error:', error);
      return { success: false, user: null, error: error.message || 'Anmeldung fehlgeschlagen' };
    }

    return { success: true, user: data.user, error: null };
  } catch (err) {
    console.error('Signin error:', err);
    return {
      success: false,
      user: null,
      error: err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen',
    };
  }
}

export async function signOut(client: SupabaseClient) {
  try {
    await client.auth.signOut();
    return { success: true };
  } catch (err) {
    console.error('Signout error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Abmeldung fehlgeschlagen' };
  }
}

export async function resetPasswordForEmail(email: string) {
  if (!email || !email.trim()) {
    return { success: false, error: 'Bitte gebe eine E-Mail-Adresse ein.' };
  }

  if (!email.includes('@') || email.split('@')[1]?.trim().length === 0) {
    return { success: false, error: 'Bitte gebe eine gültige E-Mail-Adresse ein.' };
  }

  try {
    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
      // Mock mode: validiere mit lokalen Test-Accounts
      const validTestEmails = ['test@example.com', 'demo@allmedia.app'];
      if (!validTestEmails.includes(email.toLowerCase())) {
        return { success: false, error: 'Diese E-Mail-Adresse ist nicht registriert.' };
      }
      return { success: true };
    }

    const client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    const { data, error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${SUPABASE_CONFIG.redirectUrl}/reset-password`,
    });

    if (error) {
      console.error('Reset password error:', error);
      const msg = error.message.toLowerCase();
      if (msg.includes('not found') || msg.includes('does not exist')) {
        return { success: false, error: 'Diese E-Mail-Adresse ist nicht registriert.' };
      }
      if (msg.includes('not confirmed') || msg.includes('not verified')) {
        return { success: false, error: 'Diese E-Mail-Adresse wurde noch nicht bestätigt. Bitte verifiziere deine E-Mail zuerst.' };
      }
      return { success: false, error: error.message || 'Fehler beim Zurücksetzen des Passworts' };
    }

    return { success: true };
  } catch (err) {
    console.error('Reset password error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Fehler beim Zurücksetzen des Passworts',
    };
  }
}

