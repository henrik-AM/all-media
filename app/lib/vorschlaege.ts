/**
 * „Personen, die du kennen könntest" (Kasten 23, Henrik 06.10.2026).
 *
 * Die Berechnung steht in EINER Supabase-Funktion, `personen_vorschlaege()`
 * (SUPABASE_SCHEMA_85_personen_vorschlaege.sql). Die Website ruft dieselbe
 * Funktion über GET /api/vorschlaege/:bereich (web/server/app.js). Hier wird
 * nichts gerechnet, gefiltert oder erfunden — auch die Begründung kommt
 * wortgleich aus der Datenbank, damit beide Plattformen dasselbe sagen.
 *
 * Folgen läuft über die vorhandene Aktion (ProfilContext.folgenUmschalten →
 * aktionen.folgen). Eigene Datei statt aktionen.ts, damit sich parallele
 * Kästen dort nicht in die Quere kommen.
 */

import { SupabaseClient } from '@supabase/supabase-js';

/** Wo der Abschnitt steht. Nur diese zwei — nirgends sonst (23.4). */
export type VorschlagBereich = 'videos' | 'communitys';

/** Überschrift — wortgleich mit VORSCHLAG_TITEL in web/public/app.js. */
export const VORSCHLAG_TITEL = 'Personen, die du kennen könntest';

export interface Vorschlag {
  id: string;
  name: string;
  handle: string;
  color?: string;
  grund: string;
  punkte: number;
}

/** Wie viele Karten höchstens geladen werden. */
export const VORSCHLAG_ANZAHL = 12;

/**
 * Die Vorschläge aus der Datenbank. Ein Fehler (Schema noch nicht
 * eingespielt, kein Netz) ergibt eine leere Liste — dann blendet der
 * Abschnitt sich aus, statt etwas zu zeigen, das nicht stimmt.
 */
export async function ladeVorschlaege(
  client: SupabaseClient,
  bereich: VorschlagBereich,
  anzahl = VORSCHLAG_ANZAHL
): Promise<Vorschlag[]> {
  const { data, error } = await client.rpc('personen_vorschlaege', {
    p_bereich: bereich,
    p_anzahl: anzahl,
  });
  if (error) {
    console.warn('Vorschläge nicht geladen:', error.message);
    return [];
  }
  return ((data ?? []) as any[]).map((z) => ({
    id: z.id,
    name: z.name ?? '',
    handle: z.handle ?? '',
    color: z.color ?? undefined,
    grund: z.grund ?? '',
    punkte: Number(z.punkte ?? 0),
  }));
}

/**
 * „Entfernen" — dauerhaft (Tabelle vorschlag_entfernt, nur eigene Zeilen).
 * Gibt zurück, ob die Zeile danach wirklich da ist: unter RLS meldet ein
 * abgewiesenes Schreiben sonst womöglich nichts.
 */
export async function vorschlagEntfernen(
  client: SupabaseClient,
  ichId: string,
  zielId: string
): Promise<boolean> {
  const { error } = await client
    .from('vorschlag_entfernt')
    .upsert({ user_id: ichId, ziel_id: zielId }, { onConflict: 'user_id,ziel_id', ignoreDuplicates: true });
  if (error) throw error;
  const { count, error: fehlerLesen } = await client
    .from('vorschlag_entfernt')
    .select('ziel_id', { count: 'exact', head: true })
    .eq('user_id', ichId)
    .eq('ziel_id', zielId);
  if (fehlerLesen) throw fehlerLesen;
  return (count ?? 0) > 0;
}
