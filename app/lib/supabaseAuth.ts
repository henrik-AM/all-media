/**
 * Anmelden, registrieren, abmelden.
 *
 * WARUM JEDE FUNKTION EINEN CLIENT BEKOMMT
 *
 * Bis zum 07.09.2026 baute sich jede Funktion hier ihren eigenen Zugang mit
 * `createClient(url, anonKey)`. Das sieht harmlos aus und ist der teuerste
 * Fehler in dieser Datei gewesen: supabase-js legt die Sitzung in dem Client
 * ab, mit dem sie entstanden ist. Der Client, mit dem die App danach
 * arbeitet, steht in `contexts/SupabaseContext.tsx` — ein anderer. Der bekam
 * von der Anmeldung nie etwas mit.
 *
 * Nachgeprüft am 07.09.2026 gegen die echte Datenbank:
 *
 *     Anmeldung über eigenen Client: OK, user=62616c1d-…
 *     Sitzung im App-Client:         FEHLT
 *     App-Client kennt Nutzer:       niemand (anonym)
 *     App-Client liest profiles:     0 Zeilen
 *
 * Null Zeilen, kein Fehler — die Regeln der Datenbank lassen anonyme Zugriffe
 * schlicht nicht zu und antworten mit einer leeren Liste. Wer sich neu
 * anmeldete oder das Konto wechselte, sah danach eine leere App und nirgends
 * einen Grund. Dass es trotzdem lange funktionierte, lag am Schlüsselbund:
 * dort lag noch eine alte, gültige Sitzung aus einer Fassung, die es richtig
 * gemacht hatte, und `autoRefreshToken` hielt sie am Leben.
 *
 * Deshalb baut hier nichts mehr selbst einen Client. Wer eine dieser
 * Funktionen aufruft, reicht den einen Client der App durch — denselben, mit
 * dem hinterher gelesen und geschrieben wird.
 *
 * Dieselbe Falle steht in `lib/supabaseStorage.ts` beschrieben; das war der
 * erste Fund, dieser hier der zweite.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../constants/supabase';

const Passwort = require('../../gemeinsam/passwort') as typeof import('../../gemeinsam/passwort');

/** Die gemeinsame Regel, wortgleich mit der Website. */
export const PASSWORT_REGEL = Passwort.REGEL_TEXT;

/** Gibt null zurueck, wenn das Passwort passt, sonst den Grund auf Deutsch. */
export const passwortPruefen = Passwort.pruefe;

/** Eine englische Meldung aus Supabase auf Deutsch. */
export const uebersetzeFehler = Passwort.uebersetze;

export interface AuthErgebnis {
  success: boolean;
  user: { id: string; email?: string | null } | null;
  error: string | null;
}

export async function signUpWithEmail(
  client: SupabaseClient,
  email: string,
  password: string,
  metadaten?: Record<string, unknown>
): Promise<AuthErgebnis> {
  /*
   * Erst die eigene Regel, dann der Server.
   *
   * Nicht aus Misstrauen gegen Supabase — der prüft ohnehin — sondern wegen
   * der Meldung. Supabase antwortet mit „Password should be at least 10
   * characters. Password should contain at least one character of each:
   * abcdefghijklmnopqrstuvwxyz, …". Das ist richtig und für niemanden
   * lesbar.
   */
  const zuSchwach = Passwort.pruefe(password);
  if (zuSchwach) return { success: false, user: null, error: zuSchwach };

  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: metadaten ? { data: metadaten } : undefined,
    });

    if (error) {
      console.error('Registrierung fehlgeschlagen:', error.message);
      return { success: false, user: null, error: Passwort.uebersetze(error.message) };
    }

    /*
     * Ein Nutzer ohne Sitzung heisst: die E-Mail muss erst bestaetigt werden.
     * Das ist kein Fehler, aber auch kein Konto, mit dem sich schon arbeiten
     * laesst — und genau das hat die App bisher behauptet.
     */
    if (data.user && !data.session) {
      return {
        success: false,
        user: data.user,
        error: 'Fast geschafft — bestätige zuerst die E-Mail, die wir dir geschickt haben.',
      };
    }

    return { success: true, user: data.user, error: null };
  } catch (err: any) {
    console.error('Registrierung fehlgeschlagen:', err?.message ?? err);
    return { success: false, user: null, error: Passwort.uebersetze(err?.message) };
  }
}

export async function signInWithEmail(
  client: SupabaseClient,
  email: string,
  password: string
): Promise<AuthErgebnis> {
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
      console.error('Anmeldung fehlgeschlagen:', error.message);
      return { success: false, user: null, error: Passwort.uebersetze(error.message) };
    }

    return { success: true, user: data.user, error: null };
  } catch (err: any) {
    console.error('Anmeldung fehlgeschlagen:', err?.message ?? err);
    return { success: false, user: null, error: Passwort.uebersetze(err?.message) };
  }
}

export async function signOut(client: SupabaseClient) {
  try {
    await client.auth.signOut();
    return { success: true };
  } catch (err: any) {
    console.error('Abmeldung fehlgeschlagen:', err?.message ?? err);
    return { success: false, error: Passwort.uebersetze(err?.message) };
  }
}

export async function resetPasswordForEmail(client: SupabaseClient | null, email: string) {
  if (!email || !email.trim()) {
    return { success: false, error: 'Bitte gebe eine E-Mail-Adresse ein.' };
  }

  if (!email.includes('@') || email.split('@')[1]?.trim().length === 0) {
    return { success: false, error: 'Bitte gebe eine gültige E-Mail-Adresse ein.' };
  }

  try {
    if (!client) {
      // Mock mode: validiere mit lokalen Test-Accounts
      const validTestEmails = ['test@example.com', 'demo@allmedia.app'];
      if (!validTestEmails.includes(email.toLowerCase())) {
        return { success: false, error: 'Diese E-Mail-Adresse ist nicht registriert.' };
      }
      return { success: true };
    }

    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${SUPABASE_CONFIG.redirectUrl}/reset-password`,
    });

    if (error) {
      console.error('Passwort zuruecksetzen fehlgeschlagen:', error.message);
      const msg = error.message.toLowerCase();
      if (msg.includes('not found') || msg.includes('does not exist')) {
        return { success: false, error: 'Diese E-Mail-Adresse ist nicht registriert.' };
      }
      if (msg.includes('not confirmed') || msg.includes('not verified')) {
        return {
          success: false,
          error: 'Diese E-Mail-Adresse wurde noch nicht bestätigt. Bitte verifiziere deine E-Mail zuerst.',
        };
      }
      return { success: false, error: Passwort.uebersetze(error.message) };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Passwort zuruecksetzen fehlgeschlagen:', err?.message ?? err);
    return { success: false, error: Passwort.uebersetze(err?.message) };
  }
}

/**
 * Das eigene Passwort ändern.
 *
 * Bis zum 07.09.2026 stand hinter „Passwort ändern" in den Einstellungen ein
 * Formular und sonst nichts: es prüfte die Länge, meldete „Passwort geändert"
 * und schickte nichts an Supabase. Beim nächsten Anmelden galt das alte
 * weiter — und wer sein Passwort wechselt, tut das oft genug, weil er glaubt,
 * jemand kennt es.
 *
 * Das bisherige Passwort wird nicht nur der Form halber abgefragt: die
 * Sicherheitsprüfung vom 04.09.2026 hat
 * `security_update_password_require_reauthentication` eingeschaltet. Ohne
 * frische Anmeldung lehnt Supabase die Änderung ab.
 */
export async function passwortAendern(
  client: SupabaseClient,
  email: string,
  bisher: string,
  neu: string
): Promise<{ success: boolean; error: string | null }> {
  const zuSchwach = Passwort.pruefe(neu);
  if (zuSchwach) return { success: false, error: zuSchwach };
  if (bisher === neu) return { success: false, error: 'Das ist dein bisheriges Passwort.' };

  const anmeldung = await signInWithEmail(client, email, bisher);
  if (!anmeldung.success) {
    return { success: false, error: 'Das bisherige Passwort stimmt nicht.' };
  }

  try {
    const { error } = await client.auth.updateUser({ password: neu });
    if (error) {
      console.error('Passwort aendern fehlgeschlagen:', error.message);
      return { success: false, error: Passwort.uebersetze(error.message) };
    }
    return { success: true, error: null };
  } catch (err: any) {
    console.error('Passwort aendern fehlgeschlagen:', err?.message ?? err);
    return { success: false, error: Passwort.uebersetze(err?.message) };
  }
}
