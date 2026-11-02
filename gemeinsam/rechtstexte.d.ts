/** Typen zu rechtstexte.js. */
export interface Abschnitt { titel: string; text: string[]; }
export interface Dokument { titel: string; version: number; abschnitte: Abschnitt[]; }
export type DokumentId = 'kurz_erklaert' | 'nutzungsbedingungen' | 'community_richtlinien' | 'datenschutz' | 'eltern_info' | 'impressum';
export const STAND: string;
export const HILFE: string[];
export const REIHENFOLGE: DokumentId[];
/** Öffentliche Seiten für die Stores (nur /recht/<id>, nicht in den Einstellungen). */
export const SEITEN: ('kinderschutz' | 'konto_loeschen')[];
export const PLATZHALTER_MUSTER: RegExp;
export const ZUSTIMMUNG_PFLICHT: DokumentId[];
export const ZUR_KENNTNIS: DokumentId[];
export const ZUSTIMMUNG_FEHLT: string;
export function dokument(id: DokumentId | string): Dokument | null;
export function liste(): { id: DokumentId; titel: string; version: number }[];
export function alsText(id: DokumentId | string): string;
/** Fassung des mitgelieferten Texts (Codex-Fund F6). */
export function fassung(id: DokumentId | string): { version: number; pruefsumme: string | null } | null;
export const PRUEFSUMMEN: Record<string, string>;
export function platzhalter(id?: DokumentId | string): string[];
/** Flache signUp-Metadaten: zustimmung_am, zustimmung_<id>, kenntnis_<id>, pruefsumme_<id>. */
export function zustimmungsDaten(zeitpunkt?: Date): Record<string, string>;
