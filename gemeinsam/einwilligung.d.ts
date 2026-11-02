/** Typen zu einwilligung.js. */
export interface OffeneFassung {
  dokument: string;
  version: number;
  art: 'zustimmung' | 'kenntnis';
  bisher: number | null;
}
export interface Kind {
  id: string;
  name: string | null;
  handle: string | null;
  stand: 'frei' | 'wartet' | 'abgelehnt' | 'ohne_datum';
  mindestalter: number;
  grenze_am: string | null;
  entschieden_am: string | null;
  widerrufbar: boolean;
}
export const GRUENDE: Record<string, string>;
export const KNOPF: string;
export const KENNTNIS_ZUSATZ: string;
export const WIDERRUF_KNOPF: string;
export const WIDERRUF_FERTIG: string;
export const KEINE_KINDER: string;
export function grundText(grund: string): string;
export function fehltFunktion(fehler: { code?: string; message?: string } | null | undefined, funktion: string): boolean;
export function blattText(liste: OffeneFassung[]): string;
export function zeilen(liste: OffeneFassung[]): { dokument: string; version: number; titel: string; kenntnis: boolean; neu: boolean }[];
export function offen(client: any): Promise<{ ok: boolean; liste: OffeneFassung[]; fehlt?: boolean; text?: string }>;
export function zustimmen(client: any, liste: OffeneFassung[]): Promise<{ ok: true } | { ok: false; grund?: string; text: string }>;
export function datum(iso: string | null | undefined): string;
export function standText(kind: Kind): string;
export function widerrufHinweis(kind: Kind): string;
export function kinder(client: any): Promise<{ ok: boolean; liste: Kind[]; fehlt?: boolean; text?: string }>;
export function widerrufen(client: any, kindId: string): Promise<{ ok: true; schon: boolean; text: string } | { ok: false; grund: string; text: string }>;
export function elternDokumente(): string[];
export function elternFassungen(): Record<string, { version: number; pruefsumme: string }>;
export function elternZeilen(): { dokument: string; version: number | null; titel: string; kenntnis: boolean }[];
export function elternHinweis(kind: { name?: string | null; handle?: string | null } | null | undefined): string;
export function elternEntscheiden(
  client: any,
  kindId: string,
  zustimmen: boolean,
): Promise<{ ok: true; stand?: string } | { ok: false; grund?: string; text: string }>;
