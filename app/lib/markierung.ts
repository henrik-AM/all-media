/**
 * Kasten 25: @-Markierungen in der App — was MarkierterText und
 * MarkierungsEingabe gemeinsam brauchen.
 *
 * 1. Wer öffnet ein Profil? Markierter Text steht in Kommentaren,
 *    Chatblasen, Beschreibungen, Storys — an Stellen, die openPublicProfile
 *    aus App.tsx nicht kennen. Statt die Funktion durch jede Ebene zu
 *    reichen, meldet App.tsx sie hier einmal an (`profilOeffnerSetzen`).
 *
 * 2. Welche @-Namen gibt es? Nur echte Namen werden zum Link. Die geladenen
 *    Personen (useDaten().users) reichen meist; was dort fehlt, wird einmal
 *    in der Datenbank nachgeschlagen und hier gemerkt (auch „gibt es nicht",
 *    damit nicht bei jedem Bildaufbau neu gefragt wird).
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { profileZuHandles } from './aktionen';

type Oeffner = (userId: string) => void;
let oeffner: Oeffner | null = null;

export function profilOeffnerSetzen(f: Oeffner | null) {
  oeffner = f;
}

export function profilOeffnen(userId: string) {
  oeffner?.(userId);
}

/** handle (klein, ohne @) → Kennung, oder null für „gibt es nicht". */
const bekannt = new Map<string, string | null>();
const wartend = new Set<string>();
const zuhoerer = new Set<() => void>();

export function handleKennung(handle: string): string | null | undefined {
  return bekannt.get(handle);
}

export function handleMerken(handle: string, id: string | null) {
  bekannt.set(handle, id);
}

export function aufHandlesHoeren(f: () => void) {
  zuhoerer.add(f);
  return () => {
    zuhoerer.delete(f);
  };
}

/** Unbekannte Namen gebündelt nachschlagen; danach zeichnen sich die Texte neu. */
export async function handlesNachschlagen(client: SupabaseClient | null, handles: string[]) {
  const offen = handles.filter((h) => !bekannt.has(h) && !wartend.has(h));
  if (!client || !offen.length) return;
  offen.forEach((h) => wartend.add(h));
  try {
    const profile = await profileZuHandles(client, offen);
    const gefunden = new Map(profile.map((p) => [p.handle.replace(/^@/, '').toLowerCase(), p.id]));
    for (const h of offen) bekannt.set(h, gefunden.get(h) ?? null);
    zuhoerer.forEach((f) => f());
  } catch (e: any) {
    // Ohne Antwort bleiben sie Text; beim nächsten Mal wird neu gefragt.
    console.warn('[markierung] Namen nicht nachgeschlagen:', e?.message ?? e);
  } finally {
    offen.forEach((h) => wartend.delete(h));
  }
}
