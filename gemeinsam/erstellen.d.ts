/** Typen zu erstellen.js — Community und Unterthema erstellen (Kästen 28/10.2 und 16, Schema 99). */

export const WEBSITE: string;
export const NAME_MAX: number;
export const BIO_MAX: number;
export const LINK_MAX: number;
export const UNTERTHEMEN_MAX: number;
export const CODE_LAENGE: number;
export const FEHLT_SCHEMA: string;
export const SUPABASE_STANDARD: string;
export const FEHLER: {
  einladungWeg: string;
  einladungBlockiert: string;
  einladungNurMitglieder: string;
  bildFremd: string;
};
/** Vollständiger Bildvertrag: eigener Host + Ordner avatars + Dateiname (wie communities_bild_url_check). */
export function bildAdresseGueltig(adresse: unknown, projektUrl?: string | null): boolean;
export const TEXTE: {
  pflichtfeld: string;
  communityName: string;
  unterthemaName: string;
  bild: string;
  bildAendern: string;
  bio: string;
  link: string;
  unterthemen: string;
  unterthemaPlatzhalter: string;
  privatUnterthema: string;
  privatUnterthemaSub: string;
  privatCommunity: string;
  privatCommunitySub: string;
  einladen: string;
  qr: string;
  qrHinweis: string;
  fertig: string;
  schliessen: string;
};

export interface CommunityWerte {
  name: string;
  bio: string;
  link: string;
  unterthemen: string[];
  privat: boolean;
}
export interface UnterthemaWerte {
  name: string;
  bio: string;
  link: string;
  privat: boolean;
}

export function linkSauber(eingabe: string | null | undefined): { link?: string; fehler?: string };
export function unterthemenSauber(namen: readonly string[] | null | undefined): string[];
export function pruefeCommunity(eingabe: {
  name?: string;
  bild?: boolean;
  bio?: string;
  link?: string;
  unterthemen?: readonly string[];
  privat?: boolean;
}): { fehler: string | null; werte?: CommunityWerte };
export function pruefeUnterthema(eingabe: {
  name?: string;
  bio?: string;
  link?: string;
  privat?: boolean;
}): { fehler: string | null; werte?: UnterthemaWerte };
export function neuerCode(bytes: ArrayLike<number>): string;
export function istCode(wert: unknown): boolean;
export function link(code: string, basis?: string | null): string;
export function codeAus(eingabe: string | null | undefined): string | null;
export function teilenText(art: 'community' | 'unterthema', name: string, code: string, basis?: string | null): string;
export function fehltSchema(fehler: { code?: string; message?: string } | null | undefined): boolean;

export interface ErstellenZusatz {
  bild: Record<string, string | null>;
  kanal: Record<string, { id: string; bio?: string; link?: string; privat?: boolean; erstellt_von?: string | null }>;
}
export function zusatzLaden(client: any, ids: readonly string[]): Promise<ErstellenZusatz>;
export function kanalFelder(
  zusatz: ErstellenZusatz | null | undefined,
  kanalId: string,
  ichId?: string | null
): { bio?: string; link?: string; privat?: boolean; eigen?: boolean };
