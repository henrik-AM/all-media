/** Typen zu kontaktbild.js — eigenes Kontaktbild und Anzeigename im Messenger (Kasten 7.8, Schema 94). */
export const FOTO_BEARBEITEN: string;
export const AUS_MEDIATHEK: string;
export const AUFNEHMEN: string;
export const ENTFERNEN: string;
export const HINWEIS: string;
export const GESPEICHERT: string;
export const ENTFERNT: string;
export const FEHLT_SCHEMA: string;
export const NICHT_GESPEICHERT: string;
export function adresseGueltig(url: unknown): boolean;
export function ausZeilen(zeilen: { kontakt_id?: string | null; media_url?: string | null }[] | null | undefined): Record<string, string>;
export interface AnzeigeQuelle {
  profil?: { name?: string; avatar?: string | null } | null;
  kontaktBilder?: Record<string, string> | null;
  spitznamen?: Record<string, string> | null;
  messenger?: boolean;
}
export interface Anzeige {
  name: string;
  bild?: string;
  eigenesBild: boolean;
  eigenerName: boolean;
}
export function anzeigeFuer(id: string | null | undefined, quelle?: AnzeigeQuelle | null): Anzeige;
