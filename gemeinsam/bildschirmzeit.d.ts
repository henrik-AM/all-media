/**
 * Typen zu bildschirmzeit.js — eigene Bildschirmzeit für App und Website (Kasten 22).
 */
export type BzBereich =
  | 'chats'
  | 'anrufe'
  | 'storys'
  | 'friendmap'
  | 'videos'
  | 'querformat'
  | 'live'
  | 'communitys'
  | 'suche';

export type BzModus = 'standard' | 'immer' | 'limit' | 'gesperrt';
export type BzZiel = BzBereich | 'gesamt' | 'auszeit';
export type BzGrund = 'auszeit' | 'gesperrt' | 'limit' | 'gesamt';

export interface BzLimit {
  werktag: number | null;
  wochenende: number | null;
}

export interface BzBereichRegel {
  modus: BzModus;
  werktag?: number | null;
  wochenende?: number | null;
}

export interface BzRegeln {
  gesamt: BzLimit;
  bereiche: Partial<Record<BzBereich, BzBereichRegel>>;
  auszeit: { an: boolean; von: string; bis: string };
  pause: number;
}

export interface BzFreigabe {
  ziel: BzZiel;
  art: 'mehr' | 'code';
  minuten: number | null;
  basis: number;
  tag: string;
  created_at: string;
}

export interface BzEingabe {
  regeln: unknown;
  nutzung: Partial<Record<string, number>>;
  freigaben?: BzFreigabe[];
  jetzt?: Date | number;
  zeitzone?: string | null;
  tag?: string;
}

export interface BzStatus {
  offen: boolean;
  grund: BzGrund | null;
  ziel: BzZiel | null;
  rest: number | null;
  restGrund: BzGrund | null;
  hinweis: boolean;
  mehrMoeglich: boolean;
}

export interface BzOrt {
  tag: string;
  minute: number;
  wochentag: number;
  wochenende: boolean;
}

export interface BzTag {
  tag: string;
  wochentag: string;
  gesamt: number;
  bereiche: Partial<Record<BzBereich, number>>;
}

export interface BzStueck {
  bereich: BzBereich;
  sekunden: number;
}

export interface BzUhr {
  setzen(bereich: BzBereich | null, sichtbar: boolean, jetzt?: number): void;
  abgeben(jetzt?: number): BzStueck[];
  zuruecklegen(liste: BzStueck[]): void;
  offen(jetzt?: number): Partial<Record<BzBereich, number>>;
  amStueck(jetzt?: number): number;
  stueckNeu(jetzt?: number): void;
  readonly bereich: BzBereich | null;
}

export const BEREICHE: { key: BzBereich; label: string; hinweis: string }[];
export const BEREICH_SCHLUESSEL: BzBereich[];
export const MODI: { key: BzModus; label: string; hinweis: string }[];
export const MODUS_SCHLUESSEL: BzModus[];
export const LIMIT_MINUTEN: number[];
export const GESAMT_MINUTEN: number[];
export const PAUSE_MINUTEN: number[];
export const UHRZEITEN: string[];
export const CODE_MINUTEN: (number | null)[];
export const MEHR_MINUTEN: number;
export const AUSZEIT_MEHR_STUNDEN: number;
export const HINWEIS_SEKUNDEN: number;
export const PAUSE_RUHE_SEKUNDEN: number;
export const TAKT_SEKUNDEN: number;
export const HOECHSTENS_JE_AUFRUF: number;
export const TEXTE: {
  abschnitt: string;
  erklaerung: string;
  auszeitErklaerung: string;
  elternGesetzt: (name: string) => string;
  keinCode: string;
  pauseTitel: string;
  pauseText: (minuten: number) => string;
};

export function uhrzeit(minute: number): string;
export function minuteAus(text: string): number | null;
export function imFenster(minute: number, von: number, bis: number): boolean;
export function minutenBis(minute: number, ziel: number): number;
export function ortszeit(jetzt?: Date | number, zeitzone?: string | null): BzOrt;
export function geraetezone(): string | null;
export function dauerText(sekunden: number): string;
export function minutenText(minuten: number | null, leer?: string): string;
export function normalisieren(roh: unknown): BzRegeln;
export function pruefen(regeln: unknown): string | null;
export function heutigesLimit(eintrag: { werktag?: number | null; wochenende?: number | null } | undefined, wochenende: boolean): number | null;
export function modusVon(regeln: unknown, bereich: BzBereich): BzModus;
export function lockerer(alt: unknown, neu: unknown): string | null;
export function bereichFuer(area: string, sub: string | null | undefined, overlay?: string | null, zusatz?: string | null): BzBereich | null;
export function bereichName(key: string): string;
export function grenzeMit(freigaben: BzFreigabe[], ziel: BzZiel, tag: string | null, basis: number): number;
export function mehrNochFrei(freigaben: BzFreigabe[], ziel: BzZiel, tag: string | null, jetztMs?: number): boolean;
export function auszeitFrei(freigaben: BzFreigabe[], jetztMs: number): boolean;
export function gesamtGenutzt(regeln: unknown, nutzung: Partial<Record<string, number>>): number;
export function summe(nutzung: Partial<Record<string, number>>): number;
export function status(eingabe: BzEingabe, bereich: BzBereich | null): BzStatus;
export function sperrText(status: BzStatus, bereich: BzBereich, elternName?: string | null): { titel: string; satz: string; code: string };
export function hinweisText(status: BzStatus, bereich: BzBereich): string;
export function wertText(punkt: 'uebersicht' | 'gesamt' | 'bereiche' | 'auszeit' | 'pause', regeln: unknown, nutzung?: Partial<Record<string, number>>): string;
export function bereichWertText(regeln: unknown, bereich: BzBereich): string;
export function woche(zeilen: { tag: string; bereich: string; sekunden: number }[], heute: string): BzTag[];
export function uhr(): BzUhr;
export function zusammen(nutzung: Partial<Record<string, number>>, offen: Partial<Record<string, number>>): Partial<Record<string, number>>;
