/**
 * Kontakte vom Handy abgleichen (Schema 87, Henrik 09.10.2026: „Es soll
 * gefragt werden, ob All Media auf die Kontakte auf dem Handy zugreifen
 * darf.").
 *
 * Gefragt wird an zwei Stellen: auf der Karte vor „Personen, die du kennen
 * könntest" (PersonenVorschlaege.tsx) und unter Einstellungen → Datenschutz →
 * „Kontakte abgleichen". Erst nach dem Antippen von „Erlauben" kommt die
 * Systemfrage von iOS/Android — nie ungefragt beim Start.
 *
 * Was geschieht: nur die Telefonnummern gehen an kontakte_abgleichen() in
 * Supabase. Namen, E-Mails, Adressen bleiben auf dem Handy. Gespeichert
 * wird nur ein Hash jeder Nummer; die Antwort sagt nicht, wer gefunden wurde
 * — das zeigt allein personen_vorschlaege() mit „Aus deinen Kontakten".
 *
 * Die Website kann das Adressbuch nicht lesen. Sie zeigt dieselben
 * Vorschläge (sie liegen im Konto) und kann den Abgleich löschen.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseClient } from '@supabase/supabase-js';
import * as Contacts from 'expo-contacts';

/** Schlüssel in user_settings: 'an', 'aus' oder leer (= noch nicht gefragt). */
export const KONTAKTE_SCHLUESSEL = 'kontakteAbgleich';

/** Wann zuletzt abgeglichen wurde — Supabase nimmt höchstens 5 Abgleiche in 24 h an. */
const ZULETZT = 'all-media.kontakte.zuletzt';
const ABSTAND_MS = 24 * 60 * 60 * 1000;

export type KontakteErgebnis = { ok: true } | { ok: false; meldung: string };

/** Alle Telefonnummern aus dem Adressbuch, ohne Namen. */
async function nummernLesen(): Promise<string[]> {
  const alle = await Contacts.Contact.getAllDetails([Contacts.ContactField.PHONES]);
  const nummern: string[] = [];
  for (const k of alle) for (const t of k.phones ?? []) if (t.number) nummern.push(t.number);
  return nummern;
}

/** Die Nummern hochladen und den Zeitpunkt merken. */
export async function kontakteAbgleichen(supabase: SupabaseClient): Promise<KontakteErgebnis> {
  try {
    const nummern = await nummernLesen();
    const { data, error } = await supabase.rpc('kontakte_abgleichen', { p_nummern: nummern });
    if (error) return { ok: false, meldung: error.message };
    if (!data?.ok) return { ok: false, meldung: data?.meldung ?? 'Der Abgleich hat nicht geklappt' };
    await AsyncStorage.setItem(ZULETZT, String(Date.now()));
    return { ok: true };
  } catch (e: any) {
    return { ok: false, meldung: e?.message ?? 'Die Kontakte ließen sich nicht lesen' };
  }
}

/**
 * Nach der Systemfrage fragen und bei „Ja" sofort abgleichen. iOS fragt nur
 * einmal; wurde früher abgelehnt, hilft nur noch die Einstellungen-App.
 */
export async function kontakteErlauben(supabase: SupabaseClient): Promise<KontakteErgebnis> {
  const { status, canAskAgain } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') {
    return {
      ok: false,
      meldung: canAskAgain
        ? 'Ohne Zugriff auf die Kontakte gibt es keine Vorschläge daraus'
        : 'Der Zugriff ist abgelehnt — du kannst ihn in den Einstellungen deines Handys bei All Media erlauben',
    };
  }
  return kontakteAbgleichen(supabase);
}

/** Beim Öffnen der Vorschläge: neu abgleichen, wenn der letzte Abgleich einen Tag her ist. */
export async function kontakteAbgleichenWennFaellig(supabase: SupabaseClient): Promise<boolean> {
  const { status } = await Contacts.getPermissionsAsync();
  if (status !== 'granted') return false;
  const zuletzt = Number((await AsyncStorage.getItem(ZULETZT)) ?? 0);
  if (Date.now() - zuletzt < ABSTAND_MS) return false;
  return (await kontakteAbgleichen(supabase)).ok;
}

/** Abgleich aus: die gespeicherten Nummern in Supabase löschen. */
export async function kontakteEntfernen(supabase: SupabaseClient): Promise<boolean> {
  await AsyncStorage.removeItem(ZULETZT);
  const { data, error } = await supabase.rpc('kontakte_entfernen');
  return !error && !!data?.ok;
}
