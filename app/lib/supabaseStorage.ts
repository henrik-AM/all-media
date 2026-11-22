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
import { signiereEine, medienServerBasis, medienAnfrage, uploadStandSetzen, uploadIstAktiv } from './medien';
import * as MedienUpload from '../../gemeinsam/upload';


/*
 * Die Ablagen im Eimer `media`. `insights` und `ptt` kamen am 01.09.2026
 * dazu: ein Insight ist weder Nachricht noch Story, und eine
 * Push-to-Talk-Aufnahme gehoert zu einer Community, nicht zu einem Chat.
 * Getrennte Ordner, damit sich Aufraeumen und Ablauffristen spaeter je
 * Gattung regeln lassen.
 */
export type Ordner = 'messages' | 'stories' | 'avatars' | 'posts' | 'insights' | 'ptt' | 'instants';

export interface UploadErgebnis {
  success: boolean;
  sekunden?: number;
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

/** Inhaltssignatur bevorzugen, unbekannte Formate nach Dateiendung einordnen. */
function typVon(dateiname: string, b: Uint8Array): string {
  // iOS behält PNG trotz quality bei; Aufrufer nennen Aufnahmen oft .jpg.
  // Der tatsächliche Inhalt zählt, wie bei der Prüfung auf dem Server.
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return 'image/png';
  const text = (ab: number, bis: number) => String.fromCharCode(...b.slice(ab, bis));
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'image/webp';
  if (text(4, 8) === 'ftyp' && text(8, 12) === 'qt  ') return 'video/quicktime';
  const endung = dateiname.split('.').pop()?.toLowerCase() ?? '';
  if (endung === 'png') return 'image/png';
  if (endung === 'mp4' || endung === 'm4v') return 'video/mp4';
  if (endung === 'mov') return 'video/quicktime';
  if (endung === 'm4a') return 'audio/mp4';
  if (endung === 'webm') return 'video/webm';
  if (endung === 'webp') return 'image/webp';
  return 'image/jpeg';
}

interface HochladeAntwort {
  ok?: boolean;
  error?: string;
  url?: string;
  anzeige: string | null;
  sekunden?: number;
}

async function sendeVideodatei(
  datei: import('expo-file-system').File,
  url: string,
  token: string,
  typ: string,
  signal: AbortSignal,
  melden: (stand: MedienUpload.Stand) => void,
): Promise<HochladeAntwort> {
  const gesamt = datei.size;
  const auftrag = datei.createUploadTask(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': typ },
    mimeType: typ,
    sessionType: 'foreground',
    signal,
  });
  let geladen = 0;
  // Der Listener empfängt native Byte-Ereignisse. onProgress würde zusätzlich
  // nach jeder HTTP-Antwort einen synthetischen 100-%-Wert auslösen.
  const abo = auftrag.addListener('progress', ({ bytesSent }) => {
    if (signal.aborted || bytesSent <= geladen) return;
    geladen = Math.min(gesamt, bytesSent);
    melden({ geladen, gesamt, phase: geladen === gesamt ? 'pruefen' : 'hochladen' });
  });
  try {
    melden({ geladen, gesamt, phase: 'hochladen' });
    const antwort = await auftrag.uploadAsync();
    let daten: HochladeAntwort;
    try {
      daten = JSON.parse(antwort.body);
    } catch {
      throw new Error('Ungültige Serverantwort. Bitte erneut versuchen.');
    }
    if (antwort.status < 200 || antwort.status >= 300 || !daten || daten.ok === false) {
      throw new Error(daten?.error || 'Hochladen fehlgeschlagen. Bitte erneut versuchen.');
    }
    return daten;
  } finally {
    abo.remove();
    auftrag.release();
  }
}

/** Eine Aufnahme über die authentifizierte Medienstelle hochladen. */
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
    // Kamera und Medienauswahl liefern native Videodateien. Nur ihre Signatur
    // lesen, damit auch lange Aufnahmen direkt von der Datei gesendet werden.
    const nativ = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
    const video = ordner === 'posts' && /\.(mp4|mov|m4v|webm)$/i.test(dateiname);
    let datei: import('expo-file-system').File | undefined;
    let inhalt: ArrayBuffer | undefined;
    let typ: string;
    if (nativ && video && /^(file|content):/i.test(quelle)) {
      const { File } = require('expo-file-system') as typeof import('expo-file-system');
      datei = new File(quelle);
      if (!datei.size) throw new Error('Die Aufnahme ließ sich nicht lesen.');
      if (grenze && datei.size > grenze.bytes) throw new Error(grenze.zuGross(datei.size));
      const handle = datei.open();
      try {
        typ = typVon(dateiname, await handle.readBytes(Math.min(12, datei.size)));
      } finally {
        handle.close();
      }
    } else {
      const antwort = await fetch(quelle);
      if (!antwort.ok) throw new Error(`Die Aufnahme ließ sich nicht lesen (${antwort.status})`);
      inhalt = await antwort.arrayBuffer();
      if (grenze && inhalt.byteLength > grenze.bytes) throw new Error(grenze.zuGross(inhalt.byteLength));
      typ = typVon(dateiname, new Uint8Array(inhalt));
    }

    const { data: sitzung } = await client.auth.getSession();
    const token = sitzung.session?.access_token;
    if (!token) throw new Error('Bitte erneut anmelden.');
    if (uploadIstAktiv()) throw new Error('Bitte das laufende Hochladen abwarten oder abbrechen.');
    const steuerung = new AbortController();
    const melden = (stand: MedienUpload.Stand) => uploadStandSetzen({ ...stand, abbrechen: () => steuerung.abort() });
    const url = medienServerBasis() + `/api/hochladen/datei?ordner=${ordner}`;
    let wert: HochladeAntwort;
    try {
      wert = datei
        ? await sendeVideodatei(datei, url, token, typ, steuerung.signal, melden)
        : await MedienUpload.senden({
          url, headers: { Authorization: `Bearer ${token}`, 'Content-Type': typ },
          body: inhalt, signal: steuerung.signal, fortschritt: melden,
        });
      if (steuerung.signal.aborted) {
        const pfad = wert?.url?.split('/storage/v1/object/public/media/')[1];
        if (pfad) await loesche(client, pfad);
        throw new Error('Hochladen abgebrochen.');
      }
    } finally { uploadStandSetzen(null); }
    if (!wert?.url) throw new Error('Die Aufnahme konnte nicht bestätigt werden.');
    if ((await client.auth.getSession()).data.session?.access_token !== token) throw new Error('Das Konto wurde gewechselt.');
    return { success: true, error: null, url: wert.url, anzeige: wert.anzeige, sekunden: wert.sekunden };
  } catch (fehler: any) {
    // Sichtbar machen, nicht verschlucken: genau das Verschweigen hat
    // verborgen, dass nie etwas ankam.
    // Gewollter Abbruch ist kein Fehler (sonst roter Entwicklerhinweis).
    if (fehler?.name !== 'AbortError' && fehler?.message !== 'Hochladen abgebrochen.') console.error('Upload fehlgeschlagen:', fehler?.message ?? fehler);
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

/** Sequenziell statt alle Dateien zugleich im RAM; Fehler/Abbruch stoppt die gesamte Liste. */
export async function ladeMedienlisteHoch(client:SupabaseClient,ich:string,medien:import('../../gemeinsam/karussell').Medium[]) {
 const fertig:import('../../gemeinsam/karussell').Medium[]=[],neu:string[]=[];
 try {
  for(const m of medien){
   if(/^https?:/.test(m.url)){fertig.push({url:m.url,typ:m.typ});continue;}
   const ext=m.mime==='image/png'?'png':m.mime==='image/webp'?'webp':m.mime==='video/quicktime'?'mov':m.mime==='video/webm'?'webm':m.typ==='video'?'mp4':'jpg';
   const hoch=await ladeHoch(client,m.url,'posts',`${ich}-${Date.now()}.${ext}`);
   if(!hoch.success||!hoch.url)throw new Error(hoch.error||'Die Aufnahme ließ sich nicht speichern.');
   neu.push(hoch.url);fertig.push({url:hoch.url,typ:m.typ});
  }
  return fertig;
 } catch(e){
  for(const url of neu)await loesche(client,url.split('/storage/v1/object/public/media/')[1]);
  throw e;
 }
}
