/**
 * Typen zu profilfelder.js — Felder der Seite „Profil bearbeiten“
 * (Kasten 1.3, Nachtrag 10.10.2026). Gleiche Regel in Schema 88.
 */
export interface ProfilLink {
  url: string;
  titel: string;
}
export const GRENZEN: {
  name: number;
  pronomen: number;
  bio: number;
  links: number;
  titel: number;
  adresse: number;
};
export const TEXTE: {
  seite: string;
  bildBearbeiten: string;
  bildWaehlen: string;
  bildAufnehmen: string;
  bildEntfernen: string;
  name: string;
  benutzername: string;
  pronomen: string;
  bio: string;
  links: string;
  fertig: string;
  abbrechen: string;
  zurueck: string;
  linkHinzufuegen: string;
  linkLoeschen: string;
  adresse: string;
  titel: string;
  adresseBeispiel: string;
  leer: { name: string; benutzername: string; pronomen: string; bio: string; links: string };
  erklaerung: { name: string; benutzername: string; pronomen: string; bio: string; links: string };
  keineLinks: string;
  linksVoll: string;
  linksTitel: string;
  gespeichert: string;
  eigenerName: string;
  nochNichtDa: string;
};
export function namePruefen(eingabe: string): string | null;
export function pronomenPruefen(eingabe: string): string | null;
export function bioPruefen(eingabe: string): string | null;
export function zaehler(eingabe: string, grenze: number): string;
export function adresse(eingabe: string): { url: string; fehler?: undefined } | { fehler: string; url?: undefined };
export function linksPruefen(liste: Array<{ url?: string; titel?: string }>):
  | { links: ProfilLink[]; fehler?: undefined }
  | { fehler: string; links?: undefined };
/** Aus einer Profilzeile: zuerst `links`, sonst der alte Einzellink `link`. */
export function linksAus(zeile: { links?: unknown; link?: string | null } | null | undefined): ProfilLink[];
export function ohneProtokoll(url: string): string;
export function linkText(link: ProfilLink): string;
export function linkZiel(link: ProfilLink): string;
export function weitereText(anzahl: number): string;
export function linksZeile(links: ProfilLink[]): string;
