/** Typen zu konto-loeschen.js. */
export const WORT: string;
export const GRUENDE: Record<string, string>;
export const HINWEIS: string;
export function fehltFunktion(fehler: { code?: string; message?: string } | null | undefined): boolean;
export function grundText(grund: string): string;
export function paeckchen(medien: { bucket: string; name: string }[] | null | undefined): { bucket: string; namen: string[] }[];
export interface LoeschSchritte {
  /** 'captcha': Sicherheitsprüfung abgebrochen (Fahrplan C5/C6). */
  passwortPruefen(passwort: string): Promise<boolean | 'captcha'>;
  medien(): Promise<{ data: { bucket: string; name: string }[] | null; error: any }>;
  probe(): Promise<{ data: { ok: boolean; grund?: string } | null; error: any }>;
  dateienLoeschen(bucket: string, namen: string[]): Promise<{ error: any } | void>;
  loeschen(wort: string): Promise<{ data: { ok: boolean; grund?: string } | null; error: any }>;
  abmelden(): Promise<void>;
}
/** Die Schritte mit einem supabase-js-Client (App und Website). `abmelden` nimmt das Konto auch aus der Kontoliste. */
export function schritteFuer(
  client: any,
  email: string | null | undefined,
  abmelden: () => Promise<void>,
  /** Fahrplan C5/C6: Captcha-Token holen; undefined = keins eingerichtet, wirft bei Abbruch. */
  captchaHolen?: () => Promise<string | undefined>
): LoeschSchritte;
export function ablauf(
  passwort: string,
  schritte: LoeschSchritte
): Promise<{ ok: true } | { ok: false; grund: string; text: string }>;
