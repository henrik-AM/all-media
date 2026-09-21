import { createAudioPlayer } from 'expo-audio';

/*
 * Der Schalter „Töne" aus den Einstellungen.
 *
 * Er stand seit Anfang an in der Liste und wurde gespeichert, ohne dass ihn
 * jemals etwas gelesen hat (Audit vom 17.09.2026, Befund 1) — es gab
 * überhaupt keinen Ton, den er hätte abschalten können.
 *
 * Jetzt gibt es einen: `assets/nachricht.wav`, ein kurzer Zweiklang, von
 * `web/tools/nachrichtenton.py` aus einer Sinuswelle erzeugt statt irgendwo
 * heruntergeladen — so gibt es keine Lizenzfrage. Dasselbe Werkzeug schreibt
 * `web/public/nachricht.wav`; beide Dateien sind byteweise gleich.
 *
 * Wie `lib/haptics.ts` ist das hier ein Modul und kann keinen Kontext lesen.
 * Der `EinstellungenProvider` hinterlegt den Wert. Bis dahin gilt der
 * Auslieferungszustand „an".
 */
let toeneAn = true;

/** Wird vom EinstellungenProvider gerufen, nicht von Bildschirmen. */
export const toeneSetzen = (an: boolean) => {
  toeneAn = an;
};

/** Nur fuer Pruefungen und Fehlersuche. */
export const toeneZustand = () => toeneAn;

/*
 * Der Spieler wird erst beim ersten Ton angelegt und dann behalten. Ihn beim
 * Start zu erzeugen würde die Tonausgabe auch dann belegen, wenn nie ein Ton
 * kommt — und bei ausgeschaltetem Schalter wäre das für nichts.
 */
let spieler: ReturnType<typeof createAudioPlayer> | null = null;

/** Der Ton beim Senden einer Nachricht. Schweigt, wenn der Schalter aus ist. */
export const nachrichtTon = () => {
  if (!toeneAn) return;
  try {
    if (!spieler) {
      spieler = createAudioPlayer(require('../assets/nachricht.wav'));
    }
    spieler.seekTo(0);
    spieler.play();
  } catch (e) {
    /* Kein Ton ist kein Fehler, der jemanden aufhalten darf. */
  }
};
