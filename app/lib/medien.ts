/**
 * Medienadressen unterschreiben.
 *
 * Sicherheitspruefung 04.09.2026 (Fund 4). Gegenstueck zu
 * web/server/medien.js — dieselbe Regel auf beiden Seiten, sonst zeigt die
 * eine Fassung Bilder und die andere leere Kaesten.
 *
 * Der Eimer `media` war oeffentlich: jede hochgeladene Datei war ohne
 * Anmeldung abrufbar, egal wie privat die Zeile dazu war. Jetzt ist er
 * geschlossen, und jede Adresse, die die App anzeigt, wird vorher
 * unterschrieben. Vier Stunden gueltig.
 *
 * Die Zeilen in der Datenbank bleiben unveraendert — dort stehen weiterhin
 * die alten `.../object/public/media/...`-Adressen. Umgeschrieben wird erst
 * beim Anzeigen. Das erspart eine Wanderung ueber den ganzen Bestand, die
 * keinen Rueckweg haette.
 */

import { SupabaseClient } from '@supabase/supabase-js';

const OEFFENTLICH = '/storage/v1/object/public/media/';
const GUELTIG = 4 * 60 * 60;

function istMedienAdresse(wert: unknown): wert is string {
  return typeof wert === 'string' && wert.includes(OEFFENTLICH);
}

function pfadAus(adresse: string): string | null {
  const stelle = adresse.indexOf(OEFFENTLICH);
  if (stelle === -1) return null;
  const rest = adresse.slice(stelle + OEFFENTLICH.length);
  return decodeURIComponent(rest.split(/[?#]/)[0]);
}

function sammle(wert: any, pfade: Set<string>) {
  if (istMedienAdresse(wert)) {
    const p = pfadAus(wert);
    if (p) pfade.add(p);
    return;
  }
  if (Array.isArray(wert)) {
    for (const e of wert) sammle(e, pfade);
    return;
  }
  if (wert && typeof wert === 'object') {
    for (const e of Object.values(wert)) sammle(e, pfade);
  }
}

function ersetze(wert: any, karte: Map<string, string>): any {
  if (istMedienAdresse(wert)) {
    const p = pfadAus(wert);
    return (p && karte.get(p)) || wert;
  }
  if (Array.isArray(wert)) return wert.map((e) => ersetze(e, karte));
  if (wert && typeof wert === 'object') {
    const neu: Record<string, any> = {};
    for (const [schluessel, e] of Object.entries(wert)) neu[schluessel] = ersetze(e, karte);
    return neu;
  }
  return wert;
}

/**
 * Alle Medienadressen in `daten` durch unterschriebene ersetzen.
 *
 * Erst einsammeln, dann in EINEM Aufruf unterschreiben, dann ersetzen — bei
 * zweihundert Beitraegen waere ein Aufruf je Bild zweihundert Anfragen.
 *
 * Schlaegt das Unterschreiben fehl, bleibt die alte Adresse stehen. Sie
 * fuehrt dann ins Leere, aber ein fehlendes Bild ist besser als ein Bildschirm,
 * der gar nicht laedt.
 */
export async function signiereMedien<T>(client: SupabaseClient | null, daten: T): Promise<T> {
  if (!client || daten == null) return daten;

  const pfade = new Set<string>();
  sammle(daten, pfade);
  if (pfade.size === 0) return daten;

  try {
    const { data, error } = await client.storage
      .from('media')
      .createSignedUrls([...pfade], GUELTIG);
    if (error) throw error;

    const karte = new Map<string, string>();
    for (const eintrag of data ?? []) {
      if (eintrag?.signedUrl && !eintrag.error) karte.set(eintrag.path as string, eintrag.signedUrl);
    }
    return ersetze(daten, karte);
  } catch (fehler: any) {
    console.error('Medienadressen unterschreiben fehlgeschlagen:', fehler?.message ?? fehler);
    return daten;
  }
}

/** Eine einzelne Adresse unterschreiben — fuer frisch hochgeladene Dateien. */
export async function signiereEine(
  client: SupabaseClient | null,
  pfad: string
): Promise<string | null> {
  if (!client) return null;
  try {
    const { data, error } = await client.storage.from('media').createSignedUrl(pfad, GUELTIG);
    if (error) throw error;
    return data?.signedUrl ?? null;
  } catch (fehler: any) {
    console.error('Adresse unterschreiben fehlgeschlagen:', fehler?.message ?? fehler);
    return null;
  }
}
