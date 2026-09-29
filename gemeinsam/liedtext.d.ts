/**
 * Typen zu liedtext.js — welche Liedzeile gerade gesungen wird.
 */
type Lyrics = string[] | null | undefined;
type Zeiten = number[] | null | undefined;

/** Die Zeilen, die gesungen werden — ohne Strophenabstände. */
export function zeilen(lyrics: Lyrics): string[];
/** Eine Zahl je Zeile, nicht negativ, aufsteigend. */
export function zeitenGueltig(lyrics: Lyrics, zeiten: Zeiten): boolean;
/** Ab welcher Sekunde jede Zeile gilt. */
export function einsaetze(lyrics: Lyrics, zeiten: Zeiten, gesamt: number): number[];
/** Nummer der gesungenen Zeile, -1 im Vorspiel oder ohne Text. */
export function zeileBei(lyrics: Lyrics, zeiten: Zeiten, bei: number, gesamt: number): number;
export function stand(
  lyrics: Lyrics,
  zeiten: Zeiten,
  bei: number,
  gesamt: number
): { nr: number; jetzt: string; anzahl: number; getaktet: boolean };
/** Der ganze Text, Strophenabstände mit nr -1. */
export function eintraege(lyrics: Lyrics): { text: string; nr: number }[];
