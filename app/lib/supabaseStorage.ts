/**
 * Dateien in den Speicher von Supabase legen.
 *
 * ZWEI DINGE, DIE HIER FALSCH WAREN (bis 01.09.2026)
 *
 * 1. Der Client war nicht angemeldet. Diese Datei baute sich mit
 *    `createClient(url, anonKey)` einen eigenen — ohne Sitzung, also als
 *    Rolle `anon`. Die Regeln des Speichers gelten aber für `authenticated`.
 *    Jeder Upload lief damit ins Leere.
 *
 * 2. Übergeben wurde `{ uri } as unknown as Blob` — ein Objekt mit einem
 *    Dateipfad, kein Inhalt. supabase-js hat daraus nichts machen können.
 *
 * Beides zusammen hieß: es wurde nie etwas hochgeladen. Aufgefallen ist es
 * nicht, weil der Fehler nur als `console.warn` im Protokoll landete und die
 * Kamera dazu „gespeichert (kein Backend verbunden)" meldete — als wäre das
 * der Normalfall.
 *
 * Jetzt wird der angemeldete Client von außen hereingereicht, und die Datei
 * wird wirklich gelesen.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { signiereEine } from './medien';

const EIMER = 'media';

/*
 * Die Ablagen im Eimer `media`. `insights` und `ptt` kamen am 01.09.2026
 * dazu: ein Insight ist weder Nachricht noch Story, und eine
 * Push-to-Talk-Aufnahme gehoert zu einer Community, nicht zu einem Chat.
 * Getrennte Ordner, damit sich Aufraeumen und Ablauffristen spaeter je
 * Gattung regeln lassen.
 */
export type Ordner = 'messages' | 'stories' | 'avatars' | 'posts' | 'insights' | 'ptt';

export interface UploadErgebnis {
  success: boolean;
  error: string | null;
  /**
   * Die Adresse, die in die DATENBANK gehoert — in der bestaendigen Form
   * `.../object/public/media/<pfad>`.
   *
   * Sie ist seit Fund 4 nicht mehr direkt abrufbar; sie ist der Schluessel,
   * aus dem beim Anzeigen eine unterschriebene Adresse gemacht wird
   * (lib/medien.ts). Wichtig: hier darf NICHT die unterschriebene stehen —
   * die laeuft nach vier Stunden ab, und in der Datenbank waere sie danach
   * dauerhaft tot. Genau dieser Fehler ist beim Umbau zuerst passiert.
   */
  url: string | null;
  /** Zum sofortigen Anzeigen, bevor die Zeile neu geladen wird. Vier Stunden. */
  anzeige: string | null;
}

/** Aus dem Dateinamen den Inhaltstyp ableiten. */
function typVon(dateiname: string): string {
  const endung = dateiname.split('.').pop()?.toLowerCase() ?? '';
  if (endung === 'png') return 'image/png';
  if (endung === 'mp4' || endung === 'mov') return 'video/mp4';
  if (endung === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Eine Aufnahme hochladen.
 *
 * `quelle` ist der Pfad, den die Kamera oder die Bildauswahl liefert
 * (`file://…`). Er wird hier gelesen — in React Native geht das über fetch,
 * einen anderen Weg an den Inhalt gibt es nicht.
 */
export async function ladeHoch(
  client: SupabaseClient | null,
  quelle: string,
  ordner: Ordner,
  dateiname: string
): Promise<UploadErgebnis> {
  if (!client) {
    return { success: false, error: 'Nicht angemeldet', url: null, anzeige: null };
  }

  try {
    const antwort = await fetch(quelle);
    if (!antwort.ok) throw new Error(`Die Aufnahme ließ sich nicht lesen (${antwort.status})`);
    const inhalt = await antwort.arrayBuffer();

    /*
     * Fund 4, Nachtrag: die Dateinamen der Aufrufer sind
     * `<kennung>-<zeitstempel>.jpg` — wer die Kennung kennt, muss nur noch
     * die Millisekunde raten. Solange der Eimer oeffentlich war, war das der
     * Unterschied zwischen "schwer" und "unmoeglich"; jetzt braucht es dafuer
     * zusaetzlich eine gueltige Anmeldung. Ein Zufallsteil macht den Pfad
     * trotzdem unratbar, und er kostet nichts.
     */
    const zufall = Math.random().toString(36).slice(2, 10);
    const punkt = dateiname.lastIndexOf('.');
    const gestreut =
      punkt === -1
        ? `${dateiname}-${zufall}`
        : `${dateiname.slice(0, punkt)}-${zufall}${dateiname.slice(punkt)}`;

    const pfad = `${ordner}/${gestreut}`;
    const { error } = await client.storage.from(EIMER).upload(pfad, inhalt, {
      cacheControl: '3600',
      contentType: typVon(dateiname),
      upsert: false,
    });
    if (error) throw error;

    /*
     * Zwei Adressen, und die Unterscheidung ist der Kern von Fund 4:
     *
     *   url      die bestaendige Form. Sie wandert in die Datenbank. Abrufbar
     *            ist sie nicht mehr — der Eimer ist geschlossen —, aber sie
     *            ueberlebt jeden Ablauf und laesst sich jederzeit neu
     *            unterschreiben.
     *   anzeige  die unterschriebene. Vier Stunden gueltig, gut fuer das Bild,
     *            das sofort erscheinen soll. In die Datenbank gehoert sie
     *            nicht.
     */
    const { data } = client.storage.from(EIMER).getPublicUrl(pfad);
    const anzeige = await signiereEine(client, pfad);
    return { success: true, error: null, url: data.publicUrl, anzeige };
  } catch (fehler: any) {
    // Sichtbar machen, nicht verschlucken: genau das Verschweigen hat
    // verborgen, dass nie etwas ankam.
    console.error('Upload fehlgeschlagen:', fehler?.message ?? fehler);
    return { success: false, error: fehler?.message ?? 'Upload fehlgeschlagen', url: null, anzeige: null };
  }
}

/** Eine hochgeladene Datei wieder entfernen. */
export async function loesche(client: SupabaseClient | null, pfad: string) {
  if (!client) return { success: false, error: 'Nicht angemeldet' };
  try {
    const { error } = await client.storage.from(EIMER).remove([pfad]);
    if (error) throw error;
    return { success: true, error: null };
  } catch (fehler: any) {
    console.error('Löschen fehlgeschlagen:', fehler?.message ?? fehler);
    return { success: false, error: fehler?.message ?? 'Löschen fehlgeschlagen' };
  }
}

/**
 * Die Adresse einer bereits hochgeladenen Datei.
 *
 * Fund 4: heisst nicht mehr `oeffentlicheAdresse`, weil sie es nicht mehr
 * ist. Die Adresse ist vier Stunden gueltig und danach wertlos — genau das
 * ist der Punkt: eine weitergereichte Adresse oeffnet kein fremdes Bild mehr.
 */
export async function adresseVon(
  client: SupabaseClient | null,
  ordner: Ordner,
  dateiname: string
): Promise<string> {
  if (!client) return '';
  return (await signiereEine(client, `${ordner}/${dateiname}`)) ?? '';
}
