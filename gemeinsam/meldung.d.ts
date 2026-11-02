/**
 * Typen zu meldung.js — Melden und Moderation (Kasten RS 3, Schema 102).
 */

export type MeldeArt =
  | 'post'
  | 'comment'
  | 'story'
  | 'user'
  | 'message'
  | 'community'
  | 'kanal_nachricht'
  | 'problem';

export type KategorieKey =
  | 'kindesmissbrauch'
  | 'gewalt_drohung'
  | 'hass'
  | 'mobbing'
  | 'sexuell'
  | 'selbstverletzung'
  | 'betrug_spam'
  | 'urheberrecht'
  | 'privatsphaere'
  | 'jugendgefaehrdend'
  | 'falschinfo'
  | 'sonstiges_recht'
  | 'regelverstoss';

export type Massnahme = 'keine' | 'warnen' | 'entfernen' | 'sperren' | 'entfernen_sperren';
export type Grundlage = 'gesetz' | 'regeln';

export interface Kategorie {
  key: KategorieKey;
  name: string;
  erklaerung: string;
  grundlage: Grundlage;
}

/** Was mit einer gemeldeten Nachricht mitgeht (Klartext, bei E2E ihr Sitzungsschlüssel). */
export interface MeldeBeleg {
  text: string;
  sitzung?: string | null;
}

export interface MeldeEingabe {
  art: MeldeArt;
  ziel?: string | null;
  kategorie?: KategorieKey | 'problem' | null;
  begruendung?: string;
  gutglaeubig?: boolean;
  beleg?: MeldeBeleg | null;
}

export interface Hinweis {
  titel: string;
  punkte: string[];
  link?: string;
  notruf?: string;
  telefonseelsorge?: string;
  kummer?: string;
}

export const ARTEN: MeldeArt[];
export const ALTE_ARTEN: MeldeArt[];
export const ART_NAME: Record<MeldeArt, string>;
export const KATEGORIEN: Kategorie[];
export const KATEGORIE_KEYS: KategorieKey[];
export const MIN_BEGRUENDUNG: number;
export const MIN_ENTSCHEIDUNG: number;
export const MAX_BEGRUENDUNG: number;
export const GRUND: Record<string, string>;
export const EINGANG: { meldung: string; problem: string; alterWeg: string };
export const GUTGLAEUBIG: string;
export const NACHRICHT_HINWEIS: string;
export const BESCHWERDESTELLE: string;
export const HINWEIS_KINDESMISSBRAUCH: Hinweis;
export const HINWEIS_SELBSTVERLETZUNG: Hinweis;
export const MASSNAHMEN: { key: Massnahme; name: string }[];
export const LEER: { meine: string; kontostatus: string; moderation: string; beschwerden: string };
export const OHNE_SCHEMA: { meine: string; kontostatus: string; moderation: string };
export const WIDERSPRUCH: {
  knopf: string;
  platzhalter: string;
  gesendet: string;
  fristText: (bis: string | Date) => string;
  abgelaufen: string;
  weitere: string;
};
export const ABLAUF_VERBORGEN: string[];
export const VORLAGEN: Record<string, string>;
export const SPERRDAUERN: { tage: number | null; name: string }[];
export const BELEG: { echt: string; falsch: string; ohne: string; keinSchluessel: string };

export function kategorie(key: string | null | undefined): Kategorie | null;
export function kategorieName(key: string | null | undefined): string;
/** Wie Postgres btrim(): nur Leerzeichen. */
export function btrim(text: string | null | undefined): string;
/** Wie Postgres length(): Zeichen, nicht UTF-16-Einheiten. */
export function zeichen(text: string | null | undefined): number;
/** null = geht durch, sonst der `grund` wie in inhalt_melden(). */
export function pruefen(eingabe: Partial<MeldeEingabe>): string | null;
export function nochZeichen(begruendung: string | null | undefined, kat?: string | null): number;
export function zaehlerText(begruendung: string | null | undefined, kat?: string | null): string;
export function alterGrund(eingabe: Partial<MeldeEingabe>): string;
export function alterWegMoeglich(art: string): boolean;
/** PGRST202 immer; 42883 nur, wenn der Text die gerufene Funktion nennt (Vorgabe 'inhalt_melden'). */
export function fehltFunktion(fehler: { code?: string; message?: string } | null | undefined, funktion?: string): boolean;
export function grundText(grund: string | null | undefined): string;
export function updateText(art: string): string;
export function eingangText(art: string, alterWeg?: boolean): string;
export function hinweisFuer(kat: string | null | undefined): Hinweis | null;
export function titel(art: string): string;
export function platzhalter(art: string, kat?: string | null): string;
export function massnahmeName(key: string | null | undefined): string;
export function massnahmeText(key: string | null | undefined, sperreBis?: string | Date | null): string;
export function statusText(status: string | null | undefined): string;
export function grundlageText(g: string | null | undefined): string;
export function datum(wert: string | Date): string;
export function widerspruchOffen(widerspruchBis: string | Date | null | undefined, jetzt?: string | Date): boolean;
export function beschwerdeText(status: string | null | undefined): string;
export function vorlage(kat: string | null | undefined): string;
export function entscheidungPruefen(e: {
  art?: string;
  kategorie?: string;
  massnahme?: string;
  begruendung?: string;
  grundlage?: string | null;
  norm?: string | null;
  klausel?: number | string | null;
  zielProfil?: string | null;
  bestaetigt?: string | null;
  sperreTage?: number | string | null;
  art18?: boolean | null;
}): string | null;
export const BKA: string;
export const ART18: {
  titel: string;
  punkte: string[];
  link: string;
  label: string;
  platzhalter: string;
  knopf: string;
  vermerkt: string;
  offen: string;
  gespeichert: string;
};
export const ART18_KATEGORIEN: KategorieKey[];
export const MIN_VERMERK: number;
export const BESTAETIGUNG: { label: string; platzhalter: string };
export const MIN_BESTAETIGUNG: number;
export const ZURUECK: { label: string; hinweis: string; liste: string; knopf: string; gesendet: string };
export const NACHTRAG: { titel: string; begruendung: string; knopf: string; gesperrt: string };
export const RICHTLINIEN_ABSCHNITTE: { nr: number; titel: string }[];
export const KLAUSELN: { nr: number; titel: string }[];
export const KLAUSEL_JE_KATEGORIE: Record<KategorieKey, number | null>;
export const NORM: { label: string; platzhalter: (kat?: string | null) => string };
export const NORM_VORSCHLAG: Partial<Record<KategorieKey, string>>;
export const MEDIUM: { knopf: string; hinweis: string; sekunden: number };
export function art18Pflicht(kat: string | null | undefined): boolean;
export function entfernt(massnahme: string | null | undefined): boolean;
export function sperrt(massnahme: string | null | undefined): boolean;
export function vorlageFuer(kat: string | null | undefined, massnahme: string | null | undefined): string;
export function klausel(nr: number | string | null | undefined): { nr: number; titel: string } | null;
export function klauselFuer(kat: string | null | undefined): { nr: number; titel: string } | null;
export function klauselText(nr: number | string | null | undefined): string;
export function normGueltig(norm: string | null | undefined): boolean;
export function begruendungMitGrundlage(e: {
  art?: string;
  massnahme?: string;
  begruendung?: string;
  grundlage?: string | null;
  norm?: string | null;
  klausel?: number | string | null;
}): string;
export function sperreOhneEndeErlaubt(kat: string | null | undefined): boolean;
export function sperrdauernFuer(kat: string | null | undefined): { tage: number | null; name: string }[];
export function mediumZeigbar(m: {
  beleg_verborgen?: boolean;
  kategorie?: string;
  status?: string;
  beleg?: { medium?: boolean } | null;
} | null | undefined): boolean;
export function massnahmenFuer(art: string): { key: Massnahme; name: string }[];
export function dringlichkeit(kat: string | null | undefined): number;
