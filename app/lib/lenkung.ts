/**
 * „Feed steuern" (Kasten 24) — Lesen und Schreiben in Supabase.
 *
 * Die Einträge stehen in `feed_lenkung` (Schema 82), „Kein Interesse" in
 * `kein_interesse` (Schema 55). Gewichtet wird in gemeinsam/lenkung.js +
 * gemeinsam/rang.js, aufgerufen aus `ladeBeitraege` (lib/daten.ts).
 *
 * Gegenstück der Website: die Routen /api/lenkung… in web/server/app.js.
 * Beide schreiben dieselben Zeilen in dieselbe Tabelle.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { LenkungArt, LenkungEintrag, LenkungRichtung } from '../../gemeinsam/lenkung';

const Lenkung = require('../../gemeinsam/lenkung') as typeof import('../../gemeinsam/lenkung');

export interface KeinInteresseEintrag {
  postId: string;
  kind: string;
  /** Beschreibung oder Titel, gekürzt — wie die Zeile in der Liste steht. */
  titel: string;
  /** Kennung des Verfassers — „me" beim eigenen, wie die Nutzerliste. */
  verfasser: string;
  wann: string;
}

export interface LenkungStand {
  eintraege: (LenkungEintrag & { id: string })[];
  keinInteresse: KeinInteresseEintrag[];
}

/*
 * Die Einträge für den Rang lädt `ladeLenkung` in lib/daten.ts — dort, wo
 * auch gerankt wird (siehe Kommentar am Import dort).
 */

function kurz(text: string, laenge = 60) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > laenge ? t.slice(0, laenge - 1) + '…' : t;
}

/** Alles, was die Einstellungsseite zeigt — frisch bei jedem Öffnen. */
export async function lenkungStand(client: SupabaseClient, ichId: string): Promise<LenkungStand> {
  const [eintraege, kein] = await Promise.all([
    client
      .from('feed_lenkung')
      .select('id, art, wert, anzeige, richtung, created_at')
      .eq('user_id', ichId)
      .order('created_at', { ascending: false }),
    client
      .from('kein_interesse')
      .select('post_id, created_at, posts!post_id(id, kind, title, description, user_id)')
      .eq('user_id', ichId)
      .order('created_at', { ascending: false }),
  ]);
  if (eintraege.error) throw eintraege.error;
  if (kein.error) throw kein.error;

  return {
    eintraege: Lenkung.sortiert((eintraege.data ?? []) as (LenkungEintrag & { id: string })[]),
    keinInteresse: ((kein.data ?? []) as any[]).map((z) => {
      const p = Array.isArray(z.posts) ? z.posts[0] : z.posts;
      return {
        postId: z.post_id,
        kind: p?.kind ?? 'post',
        // Ein Beitrag, den RLS nicht mehr herausgibt (privat geworden,
        // gelöscht wird er per cascade), steht ohne Text da statt gar nicht —
        // sonst ließe sich die Zeile nie zurücknehmen.
        titel: kurz(p?.description || p?.title || '') || 'Beitrag nicht mehr sichtbar',
        verfasser: p?.user_id === ichId ? 'me' : p?.user_id ?? '',
        wann: z.created_at,
      };
    }),
  };
}

/**
 * Einen Eintrag setzen. Gibt es den Gegenstand schon, wird nur die Richtung
 * umgestellt (eine Zeile je Gegenstand — `feed_lenkung_einmal`).
 */
export async function lenkungSetzen(
  client: SupabaseClient,
  ichId: string,
  e: { art: LenkungArt; wert: string; anzeige?: string; richtung: LenkungRichtung }
): Promise<LenkungEintrag & { id: string }> {
  const wert = Lenkung.normalisieren(e.art, e.wert);
  if (!wert) throw new Error('Diese Eingabe lässt sich nicht als ' + Lenkung.artName(e.art) + ' verwenden');
  if (e.richtung !== 'mehr' && e.richtung !== 'weniger') throw new Error('Unbekannte Richtung');
  const { data, error } = await client
    .from('feed_lenkung')
    .upsert(
      {
        user_id: ichId,
        art: e.art,
        wert,
        anzeige: String(e.anzeige || wert).slice(0, 120),
        richtung: e.richtung,
      },
      { onConflict: 'user_id,art,wert' }
    )
    .select('id, art, wert, anzeige, richtung, created_at')
    .single();
  if (error) throw error;
  return data as LenkungEintrag & { id: string };
}

/**
 * Einen Eintrag entfernen. Ein von RLS abgelehntes DELETE meldet Erfolg mit
 * null Zeilen — deshalb wird gezählt, was wirklich weg ist.
 */
export async function lenkungEntfernen(client: SupabaseClient, ichId: string, id: string) {
  const { data, error } = await client
    .from('feed_lenkung')
    .delete()
    .eq('user_id', ichId)
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Der Eintrag ließ sich nicht entfernen');
  return true;
}

/** „Kein Interesse" zurücknehmen — der Beitrag darf wieder in den Feed. */
export async function keinInteresseZuruecknehmen(client: SupabaseClient, ichId: string, postId: string) {
  const { data, error } = await client
    .from('kein_interesse')
    .delete()
    .eq('user_id', ichId)
    .eq('post_id', postId)
    .select('post_id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('„Kein Interesse" ließ sich nicht zurücknehmen');
  return true;
}

/** „Feed zurücksetzen" — was genau passiert, steht in Lenkung.RESET_TEXT. */
export async function feedZuruecksetzen(client: SupabaseClient) {
  const { data, error } = await client.rpc('feed_zuruecksetzen');
  if (error) throw error;
  return data as { ok: boolean; eintraege: number; kein_interesse: number; seit: string };
}
