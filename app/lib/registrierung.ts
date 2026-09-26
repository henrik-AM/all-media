/**
 * Was ein neues Konto mitbringen muss: Benutzername, Telefonnummer,
 * Geburtsdatum und — unter der Altersgrenze — einen Elternteil.
 *
 * WARUM ES DAS GIBT
 *
 * Neue Konten entstehen in der App an zwei Stellen: im Anmeldebildschirm und
 * unter „Konto wechseln → Neues Konto". Die zweite fragte bis zum 22.09.2026
 * nur Name, E-Mail und Passwort ab — ohne die Telefonnummer, die seit dem
 * 07.09. Pflicht ist, und der Benutzername wurde still aus der E-Mail geraten.
 * Beide Stellen holen die Regeln jetzt von hier; die Website macht dasselbe in
 * web/public/anmeldung.js mit denselben Bausteinen aus gemeinsam/.
 *
 * Die Datenbank entscheidet trotzdem selbst (Schema 34 und 52). Was hier
 * steht, sagt es dem Nutzer nur, solange er es noch beheben kann.
 */

import { useEffect, useRef, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

const Telefon = require('../../gemeinsam/telefon') as typeof import('../../gemeinsam/telefon');
const Benutzername = require('../../gemeinsam/benutzername') as typeof import('../../gemeinsam/benutzername');
const Alter = require('../../gemeinsam/alter') as typeof import('../../gemeinsam/alter');

export { Alter, Benutzername, Telefon };

export interface NeuesKonto {
  name?: string;
  handle: string;
  telefon: string;
  geburtsdatum: string;
  eltern?: string;
}

export type NamensStand =
  | { stand: 'leer' | 'pruefe' }
  | { stand: 'frei'; handle: string }
  | { stand: 'form' | 'vergeben' | 'fehler'; meldung: string };

/**
 * Ist der Benutzername frei? Schon beim Tippen — Henrik 22.09.2026: „du musst
 * aber anzeigen, falls dieser User Name schon vergeben ist."
 *
 * Gefragt wird erst, wenn die Form stimmt, und erst eine halbe Sekunde nach
 * dem letzten Tastendruck: `handle_frei` zählt je Anschluss höchstens dreißig
 * Fragen in der Stunde (Schema 39).
 */
export function useNamensStand(supabase: SupabaseClient | null, eingabe: string): NamensStand {
  const [stand, setStand] = useState<NamensStand>({ stand: 'leer' });
  const zuletzt = useRef('');

  useEffect(() => {
    const name = Benutzername.normal(eingabe);
    zuletzt.current = name;
    if (!name) return setStand({ stand: 'leer' });

    const form = Benutzername.pruefe(name);
    if (form) return setStand({ stand: 'form', meldung: form });
    if (!supabase) return setStand({ stand: 'frei', handle: '@' + name });

    setStand({ stand: 'pruefe' });
    const uhr = setTimeout(async () => {
      const { data, error } = await supabase.rpc('handle_frei', { eingabe: name });
      // Inzwischen weitergetippt: diese Antwort gehört zu einem alten Namen.
      if (zuletzt.current !== name) return;
      if (error) return setStand({ stand: 'fehler', meldung: 'Der Name lässt sich gerade nicht prüfen.' });
      if (data?.frei) return setStand({ stand: 'frei', handle: data.handle });
      setStand({
        stand: data?.grund === 'vergeben' ? 'vergeben' : 'fehler',
        meldung: data?.meldung || 'Dieser Benutzername ist schon vergeben.',
      });
    }, 500);
    return () => clearTimeout(uhr);
  }, [supabase, eingabe]);

  return stand;
}

/** Der Satz unter dem Namensfeld. Leer, solange nichts zu sagen ist. */
export function namensZeile(stand: NamensStand): { text: string; gut: boolean } {
  switch (stand.stand) {
    case 'pruefe':
      return { text: 'Wird geprüft …', gut: true };
    case 'frei':
      return { text: `${stand.handle} ist frei`, gut: true };
    case 'form':
    case 'vergeben':
    case 'fehler':
      return { text: stand.meldung, gut: false };
    default:
      return { text: '', gut: true };
  }
}

/**
 * „24122008" → „24.12.2008" beim Tippen. Die Punkte setzt die App, damit auf
 * der Zifferntastatur niemand nach ihnen suchen muss.
 */
export function datumTippen(text: string): string {
  const z = text.replace(/\D/g, '').slice(0, 8);
  if (z.length <= 2) return z;
  if (z.length <= 4) return `${z.slice(0, 2)}.${z.slice(2)}`;
  return `${z.slice(0, 2)}.${z.slice(2, 4)}.${z.slice(4)}`;
}

/**
 * Alles prüfen, was vor dem Anlegen zu prüfen ist. Gibt null zurück, wenn es
 * passt, sonst den Grund auf Deutsch. Gleiche Reihenfolge wie
 * `registrieren()` in web/public/anmeldung.js.
 */
export async function neuesKontoPruefen(
  supabase: SupabaseClient | null,
  konto: NeuesKonto
): Promise<string | null> {
  const form = Benutzername.pruefe(konto.handle);
  if (form) return form;

  const telefon = Telefon.pruefe(konto.telefon);
  if (telefon) return telefon;

  const datum = Alter.pruefe(konto.geburtsdatum);
  if (datum) return datum;

  const einordnung = Alter.einordnen(konto.geburtsdatum, konto.telefon);
  if (einordnung.stufe === 'verboten') return Alter.hinweis(einordnung);

  // Den Elternteil über seine Nummer, nie über den @-Namen (Schema 58).
  const eltern = Telefon.speicherform(konto.eltern || '');
  if (einordnung.stufe === 'eltern') {
    if (!eltern) return 'Bitte die Telefonnummer deines Elternteils eingeben';
    if (/[a-zA-Z@]/.test(eltern)) return 'Bitte die Telefonnummer deines Elternteils eingeben, nicht den Benutzernamen';
    const elternForm = Telefon.pruefe(eltern);
    if (elternForm) return `${elternForm} (Nummer deines Elternteils)`;
    if (Telefon.vergleichsform(eltern) === Telefon.vergleichsform(konto.telefon)) return 'Das ist deine eigene Nummer';
  }

  if (!supabase) return null;

  // Kurz vor dem Anlegen noch einmal: zwischen Tippen und Absenden kann sich
  // jemand anders denselben Namen genommen haben.
  const { data: name } = await supabase.rpc('handle_frei', { eingabe: Benutzername.normal(konto.handle) });
  if (name && name.frei === false) return name.meldung || 'Dieser Benutzername ist schon vergeben.';

  const { data: nummer } = await supabase.rpc('nummer_frei', { eingabe: Telefon.speicherform(konto.telefon) });
  if (nummer && nummer.frei === false) return nummer.meldung || 'Diese Telefonnummer gehört schon zu einem Konto.';

  // Den Elternteil gibt es, wenn seine Nummer „vergeben" ist. Ob er
  // zustimmen darf (volljährig, selbst freigegeben), entscheidet die Datenbank.
  if (einordnung.stufe === 'eltern') {
    const { data: e } = await supabase.rpc('nummer_frei', { eingabe: eltern });
    if (e?.frei === true) return 'Zu dieser Nummer gibt es bei All Media kein Konto';
  }

  return null;
}

/** Was mit signUp als Registrierungsdaten mitgeht (Schema 34 und 52). */
export function metadatenFuer(konto: NeuesKonto): Record<string, string> {
  const einordnung = Alter.einordnen(konto.geburtsdatum, konto.telefon);
  const daten: Record<string, string> = {
    handle: Benutzername.normal(konto.handle),
    name: konto.name?.trim() || Benutzername.normal(konto.handle),
    phone: Telefon.speicherform(konto.telefon),
    geburtsdatum: einordnung.iso,
  };
  if (einordnung.stufe === 'eltern' && konto.eltern) daten.eltern = Telefon.speicherform(konto.eltern);
  return daten;
}

// ------------------------------------------------ Freigabe nach dem Anlegen --

export type Kontostand = {
  stand: 'frei' | 'wartet' | 'abgelehnt' | 'ohne_datum' | 'abgemeldet';
  land?: string;
  mindestalter?: number;
  eltern?: string | null;
};

export interface Einwilligung {
  kind: string;
  handle: string;
  name: string;
  telefon?: string | null;
  alter: number;
  land: string;
  mindestalter: number;
}

export async function kontostandLaden(supabase: SupabaseClient): Promise<Kontostand | null> {
  const { data, error } = await supabase.rpc('mein_kontostand');
  if (error) {
    console.warn('Kontostand:', error.message);
    return null;
  }
  return data as Kontostand;
}

export async function elternAnfragen(supabase: SupabaseClient, eltern: string) {
  const { data, error } = await supabase.rpc('eltern_anfragen', { p_eltern: Telefon.speicherform(eltern) });
  if (error) return { ok: false, meldung: 'Die Anfrage ist gerade nicht möglich.' };
  return data as { ok: boolean; meldung?: string };
}

export async function geburtsdatumNachtragen(supabase: SupabaseClient, datum: string, eltern?: string) {
  const { data, error } = await supabase.rpc('geburtsdatum_nachtragen', {
    p_datum: Alter.lesen(datum),
    p_eltern: eltern ? Telefon.speicherform(eltern) : null,
  });
  if (error) return { ok: false, meldung: 'Das Speichern ist gerade nicht möglich.' };
  return data as { ok: boolean; meldung?: string };
}

export async function einwilligungenLaden(supabase: SupabaseClient): Promise<Einwilligung[]> {
  const { data, error } = await supabase.rpc('einwilligungen_offen');
  if (error) return [];
  return (data || []) as Einwilligung[];
}

export async function einwilligungEntscheiden(supabase: SupabaseClient, kind: string, zustimmen: boolean) {
  const { data, error } = await supabase.rpc('einwilligung_entscheiden', { p_kind: kind, p_zustimmen: zustimmen });
  if (error) return { ok: false, meldung: 'Die Entscheidung ist gerade nicht möglich.' };
  return data as { ok: boolean; meldung?: string };
}
