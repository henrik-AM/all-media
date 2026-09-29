/** Typen zu zahlung.js. */
export type AnbieterId = 'paypal' | 'apple_pay' | 'google_pay' | 'karte';
export interface Umgebung {
  os: 'ios' | 'android' | 'web';
  browser?: 'safari' | 'chrome' | 'andere';
}
export interface MethodeZeile {
  anbieter: AnbieterId;
  anzeigename: string;
  letzte4: string | null;
  ablauf_monat: number | null;
  ablauf_jahr: number | null;
  paypal_maskiert: string | null;
}
export interface Zahlungsmethode extends MethodeZeile {
  id: string;
  standard: boolean;
  created_at?: string;
}
export interface MethodeEingabe {
  anzeigename?: string;
  email?: string;
  letzte4?: string;
  ablauf?: string;
}

export const CODE_MIN: number;
export const CODE_MAX: number;
export const CODE_REGEL_TEXT: string;
/** Ohne Leerzeichen und Bindestriche, in Großbuchstaben — wie spendencode_normal. */
export function codeNormal(eingabe: string): string;
/** Gibt null zurueck, wenn die Form passt, sonst den Grund auf Deutsch. */
export function codePruefe(eingabe: string): string | null;
export const MIN_CENT: number;
export const MAX_CENT: number;
export function betragPruefe(cent: number): string | null;
export function euro(cent: number): string;
export const ANBIETER: { id: AnbieterId; name: string }[];
export function anbieterName(id: string): string;
export function browserErkennen(ua: string): 'safari' | 'chrome' | 'andere';
export function verfuegbar(anbieter: string, umgebung: Umgebung): boolean;
export function anbieterFuer(umgebung: Umgebung): { id: AnbieterId; name: string }[];
export function paypalMaskieren(mail: string): string | null;
export function ablaufLesen(text: string): { monat: number; jahr: number } | null;
export function abgelaufen(monat: number, jahr: number, jetzt?: Date): boolean;
export function anzeigenamePruefe(name: string): string | null;
export function methodeBauen(
  anbieter: string,
  eingabe: MethodeEingabe,
  umgebung?: Umgebung | null,
  jetzt?: Date
): { zeile?: MethodeZeile; fehler?: string };
export function methodeText(m: Partial<Zahlungsmethode> | null | undefined): string;
export function grundText(grund: string, verbleibend?: number): string;
