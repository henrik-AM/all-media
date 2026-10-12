/**
 * Typen zu chatblase.js — Ziehen zum Antworten und die Karte eines geteilten
 * Beitrags, gemeinsam mit der Website (Feedback 28.09., Kasten 4 und 7).
 */
export const ZIEH_SCHWELLE: number;
export const ZIEH_MAX: number;
export const ZIEH_START: number;
export function istZug(dx: number, dy: number): boolean;
export function zugWeg(dx: number): number;
export function ausgeloest(dx: number): boolean;
export function pfeilSichtbar(dx: number): number;

export const BEZUG_WEG: string;
export interface Bezug {
  id: string;
  text: string;
  autor: string;
  /** Das Original ist nicht unter den geladenen Nachrichten. */
  fehlt?: boolean;
}
export function kanalBezug(
  zeile: { reply_to?: string | null } | null | undefined,
  alle: { id: string; sender_id: string; text?: string | null; media_type?: string | null }[] | null | undefined,
  ichId: string,
  namen: Record<string, string> | null | undefined
): Bezug | undefined;

export function fehltSpalte(fehler: { code?: string; message?: string } | null | undefined, spalte?: string): boolean;
export const OHNE_BEZUG: string;

export const GETEILT_WEG: string;
/** Zweite Zeile der Weg-Karte: Merker aus Schema 93 (gelöscht). */
export const GETEILT_GELOESCHT: string;
/** Zweite Zeile der Weg-Karte: Kennung steht, Leseregel gibt ihn nicht heraus. */
export const GETEILT_UNSICHTBAR: string;
export const GETEILT_WEG_SPALTEN: string;
export interface GeteilteKarte {
  id: string;
  /** Beitrag ist gelöscht oder nicht sichtbar — dann fehlen Bild und Text. */
  weg?: boolean;
  /** Nur bei `weg`: warum, soweit ehrlich bekannt. */
  grund?: 'geloescht' | 'unsichtbar';
  kind?: 'post' | 'reel' | 'clip';
  art?: 'post' | 'video';
  /** Kennung des Kontos (posts.user_id bzw. shared_post_konto) — für das Profilbild (7.7). */
  autorId?: string;
  autor?: string;
  handle?: string;
  /** Beständige Adresse des Profilbilds; unterschrieben wird sie beim Laden. */
  autorBild?: string;
  titel?: string;
  beschreibung?: string;
  bild?: string;
}
export interface GeteiltKonto {
  name: string;
  handle: string;
  bild?: string;
}
export interface GeteiltWegZeile {
  id: string;
  shared_post_weg?: string | null;
  shared_post_konto?: string | null;
}
export function geteiltAus(
  sharedPostId: string | null | undefined,
  post: any,
  zeile?: GeteiltWegZeile | null,
  konten?: Record<string, GeteiltKonto> | null
): GeteilteKarte | undefined;
export function geteiltWegGrund(g: GeteilteKarte | null | undefined): string;
export function geteiltBeschriftung(g: GeteilteKarte | null | undefined): string;
export function geteiltWegLaden(
  client: any,
  tabelle: 'messages' | 'community_channel_messages',
  spalte: 'chat_id' | 'channel_id',
  wert: string
): Promise<Record<string, GeteiltWegZeile>>;
export function geteiltKontoIds(zeilen: any[] | null | undefined, weg: Record<string, GeteiltWegZeile> | null | undefined): string[];
export function geteiltKonten(client: any, ids: string[]): Promise<Record<string, GeteiltKonto>>;
export function geteiltVorschau(
  zeile: { shared_post_id?: string | null; shared_post_weg?: string | null } | null | undefined,
  sichtbar: Set<string> | null | undefined
): string | null;
export function geteiltSichtbar(client: any, ids: string[]): Promise<Set<string> | null>;

/** Kasten 28/11.3: Kantenlänge des Profilbilds an der Blase. */
export const PROFILBILD_GROESSE: number;
/** Unterthema immer, Community-Gruppenchat auch, Einzelchat und Messenger nie. */
export function profilbilderImChat(o: { kanal?: boolean; gruppe?: boolean; community?: boolean } | null | undefined): boolean;
/** Absender einer Blase, null für Anruf-/PTT-/Hinweiszeilen. */
export function blasenAbsender(
  m: { anruf?: unknown; pttSitzung?: unknown; hinweis?: unknown } | null | undefined,
  absender: string | null | undefined
): string | null;
/** Bild nur an der letzten Blase einer Folge derselben Person. */
export function profilbildAn(absender: (string | null)[] | null | undefined, i: number): boolean;
