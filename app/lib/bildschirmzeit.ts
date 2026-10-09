/**
 * Eigene Bildschirmzeit — die Aufrufe nach Supabase (Kasten 22).
 *
 * Die Rechnung (welcher Bereich gesperrt ist, Restzeit, Auszeit) steht in
 * gemeinsam/bildschirmzeit.js, damit App und Website gleich rechnen.
 * Entschieden wird in der Datenbank (Schema „bildschirmzeit"): Zählen mit
 * Obergrenze, „15 Min. mehr" einmal am Tag, Entsperrcode als Hash, und dass
 * ein Kind die Limits seiner Eltern nicht lockern darf.
 *
 * Gegenstück auf der Website: /api/bildschirmzeit… in web/server/app.js.
 */
import { SupabaseClient } from '@supabase/supabase-js';

export const Bildschirmzeit = require('../../gemeinsam/bildschirmzeit') as typeof import('../../gemeinsam/bildschirmzeit');
export type BzBereich = import('../../gemeinsam/bildschirmzeit').BzBereich;
export type BzZiel = import('../../gemeinsam/bildschirmzeit').BzZiel;
export type BzFreigabe = import('../../gemeinsam/bildschirmzeit').BzFreigabe;
export type BzRegeln = import('../../gemeinsam/bildschirmzeit').BzRegeln;

export interface BzPerson {
  id: string;
  name: string;
  handle: string;
}

export interface BzStand {
  ok: true;
  ziel: string;
  ich: boolean;
  regeln: unknown;
  zeitzone: string;
  tag: string;
  nutzung: Partial<Record<BzBereich, number>>;
  woche: { tag: string; bereich: string; sekunden: number }[];
  freigaben: BzFreigabe[];
  eltern: BzPerson | null;
  code_gesetzt: boolean;
  /** Welcher Code entsperrt (Schema 87): eigener Entsperrcode oder Spenden-PIN. */
  code_art?: 'eigen' | 'spenden' | null;
  eigener_code: boolean;
  /** Was für das eigene Konto gilt — für die Wahl in den Einstellungen. */
  eigene_art?: 'eigen' | 'spenden';
  kinder: BzPerson[];
}

export interface BzAntwort {
  ok: boolean;
  grund?: string;
  meldung?: string;
  [k: string]: unknown;
}

/** Fehlermeldung für einen abgelehnten Aufruf — gleiche Sätze wie auf der Website. */
export function bzMeldung(a: BzAntwort | null | undefined): string {
  if (!a) return 'Keine Verbindung';
  if (a.meldung) return String(a.meldung);
  switch (a.grund) {
    case 'kein_code':
      return a.eltern
        ? 'Dein Elternteil hat noch keine Spenden-PIN und keinen Entsperrcode festgelegt.'
        : Bildschirmzeit.TEXTE.keinCode;
    case 'nicht_erlaubt':
      return 'Das darfst du für dieses Konto nicht.';
    case 'nicht_angemeldet':
      return 'Dafür musst du angemeldet sein';
    case 'ungueltig':
      return 'Die Angabe ist ungültig.';
    default:
      return 'Das hat nicht geklappt';
  }
}

async function rpc(supabase: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<BzAntwort> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.warn(`${fn}:`, error.message);
    return { ok: false, meldung: 'Die Bildschirmzeit ist gerade nicht erreichbar.' };
  }
  return (data ?? { ok: false }) as BzAntwort;
}

/** Regeln, Nutzung heute, Woche, Freigaben — eigenes Konto oder ein eigenes Kind. */
export async function bzStandLaden(supabase: SupabaseClient, kind?: string | null): Promise<BzStand | null> {
  const a = await rpc(supabase, 'bildschirmzeit_stand', { p_ziel: kind ?? null });
  return a.ok ? (a as unknown as BzStand) : null;
}

export function bzRegelnSetzen(supabase: SupabaseClient, regeln: unknown, kind?: string | null) {
  return rpc(supabase, 'bildschirmzeit_setzen', {
    p_regeln: Bildschirmzeit.normalisieren(regeln),
    p_zeitzone: Bildschirmzeit.geraetezone(),
    p_ziel: kind ?? null,
  });
}

export function bzZaehlen(supabase: SupabaseClient, stuecke: { bereich: string; sekunden: number }[]) {
  return rpc(supabase, 'bildschirmzeit_zaehlen', { p_stuecke: stuecke });
}

export function bzMehr(supabase: SupabaseClient, ziel: BzZiel) {
  return rpc(supabase, 'bildschirmzeit_mehr', { p_ziel: ziel });
}

export function bzEntsperren(supabase: SupabaseClient, ziel: BzZiel, code: string, minuten: number | null) {
  return rpc(supabase, 'bildschirmzeit_entsperren', { p_ziel: ziel, p_code: code, p_minuten: minuten });
}

export function bzElternkontrolleBeenden(supabase: SupabaseClient, kind: string) {
  return rpc(supabase, 'bildschirmzeit_elternkontrolle_beenden', { p_kind: kind });
}

/** Den Sicherheits-/Entsperrcode setzen (Einstellungen → Allgemein). */
export function entsperrcodeSetzen(supabase: SupabaseClient, neu: string, bisher?: string) {
  return rpc(supabase, 'entsperrcode_setzen', { p_neu: neu, p_bisher: bisher || null });
}
/** Den eigenen Code zurücknehmen — danach entsperrt wieder die Spenden-PIN (Schema 87). */
export function entsperrcodeEntfernen(supabase: SupabaseClient, bisher?: string) {
  return rpc(supabase, 'entsperrcode_entfernen', { p_bisher: bisher || null });
}
