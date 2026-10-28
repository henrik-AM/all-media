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
import { signiereEine, medienServerBasis, medienAnfrage } from './medien';


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
function typVon(dateiname: string, inhalt: ArrayBuffer): string {
  // iOS behält PNG trotz quality bei; Aufrufer nennen Aufnahmen oft .jpg.
  // Der tatsächliche Inhalt zählt, wie bei der Prüfung auf dem Server.
  const b = new Uint8Array(inhalt);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return 'image/png';
  const text = (ab: number, bis: number) => String.fromCharCode(...b.slice(ab, bis));
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'image/webp';
  if (text(4, 8) === 'ftyp' && text(8, 12) === 'qt  ') return 'video/quicktime';
  const endung = dateiname.split('.').pop()?.toLowerCase() ?? '';
  if (endung === 'png') return 'image/png';
  if (endung === 'mp4') return 'video/mp4';
  if (endung === 'mov') return 'video/quicktime';
  if (endung === 'm4a') return 'audio/mp4';
  if (endung === 'webm') return 'video/webm';
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
  dateiname: string,
  /**
   * Kasten 15: Obergrenze in Bytes. Der Eimer weist größere Dateien ohnehin
   * ab — aber erst nach dem Hochladen und mit einer Meldung, die niemand
   * versteht. `zuGross` ist der Satz, der dann erscheint.
   */
  grenze?: { bytes: number; zuGross: (bytes: number) => string }
): Promise<UploadErgebnis> {
  if (!client) {
    return { success: false, error: 'Nicht angemeldet', url: null, anzeige: null };
  }

  try {
    const antwort = await fetch(quelle);
    if (!antwort.ok) throw new Error(`Die Aufnahme ließ sich nicht lesen (${antwort.status})`);
    const inhalt = await antwort.arrayBuffer();
    if (grenze && inhalt.byteLength > grenze.bytes) throw new Error(grenze.zuGross(inhalt.byteLength));

    const {data}=await client.auth.getSession();
    const token=data.session?.access_token;
    if(!token)throw new Error('Bitte erneut anmelden.');
    const r=await fetch(medienServerBasis()+`/api/hochladen/datei?ordner=${ordner}`,{
      method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':typVon(dateiname, inhalt)},
      body:inhalt,redirect:'error',signal:AbortSignal.timeout(120000),
    });
    const wert=await r.json();
    if((await client.auth.getSession()).data.session?.access_token!==token)throw new Error('Das Konto wurde gewechselt.');
    if(!r.ok||!wert.ok)throw new Error(wert.error||'Upload fehlgeschlagen');
    return {success:true,error:null,url:wert.url,anzeige:wert.anzeige};
  } catch (fehler: any) {
    // Sichtbar machen, nicht verschlucken: genau das Verschweigen hat
    // verborgen, dass nie etwas ankam.
    console.error('Upload fehlgeschlagen:', fehler?.message ?? fehler);
    const text = fehler?.message ?? 'Die Aufnahme ließ sich nicht speichern';
    const error = /fetch failed|failed to fetch|network (request|connection)|load failed/i.test(text)
      ? 'Die Aufnahme ließ sich nicht speichern. Bitte erneut versuchen.' : text;
    return { success: false, error, url: null, anzeige: null };
  }
}

/** Eine hochgeladene Datei wieder entfernen. */
export async function loesche(client: SupabaseClient | null, pfad: string) {
  if (!client) return { success: false, error: 'Nicht angemeldet' };
  try {
    await medienAnfrage(client, '/api/medien/loeschen', {pfad});
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
