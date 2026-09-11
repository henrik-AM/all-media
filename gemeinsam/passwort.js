/**
 * All Media — die Passwortregel, die App und Website gemeinsam benutzen.
 *
 * WARUM ES DAS GIBT
 *
 * Die Regel stand an vier Stellen, und an keiner stimmte sie: die App
 * verlangte beim Anmelden und im Konto-Wechsel sechs Zeichen, beim Ändern des
 * Passworts acht, die Website sechs. Supabase verlangt zehn Zeichen mit
 * Klein-, Großbuchstabe und Ziffer.
 *
 * Sichtbar wurde das am 07.09.2026 beim Wechsel des Kontos: die App ließ ein
 * Passwort mit sechs Zeichen durch, Supabase lehnte es ab, und übrig blieb
 * ein englischer Zettel am unteren Bildrand
 * („Supabase signup error: AuthWeakPasswordError…") — während das Blatt
 * darüber „Konto erstellt" meldete. Ein Fehler, den die Oberfläche selbst
 * hätte abfangen können, kam als Systemmeldung zurück und wurde zugleich als
 * Erfolg ausgegeben.
 *
 * Jetzt steht die Regel einmal hier. Wer sie in Supabase ändert
 * (Authentication → Policies → Password Requirements), ändert sie auch hier —
 * und in beiden Fassungen zugleich, statt in einer.
 *
 * WARUM ES EINE .js-DATEI IST
 *
 * Aus demselben Grund wie `spalten.js`: Node, Metro und der Browser lesen
 * dieselbe Datei ohne Übersetzungsschritt. Die Typen liefert passwort.d.ts
 * daneben.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory();
  } else {
    // Browser: als eigenes <script> eingebunden.
    global.Passwort = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Muss mit Supabase → Authentication → Password Requirements übereinstimmen. */
  var MINDESTLAENGE = 10;

  /** Ein Satz, der die ganze Regel nennt — für Platzhalter und Hinweistexte. */
  var REGEL_TEXT =
    'Mindestens ' +
    MINDESTLAENGE +
    ' Zeichen, davon ein kleiner, ein großer Buchstabe und eine Ziffer';

  /**
   * Prüft ein Passwort gegen die Regel.
   *
   * Gibt `null` zurück, wenn es passt, sonst den Grund auf Deutsch. Absichtlich
   * ein Text und kein `false`: „stimmt nicht" ohne Begründung ist der Grund,
   * warum Leute es dreimal mit demselben Passwort probieren.
   */
  function pruefe(passwort) {
    var p = typeof passwort === 'string' ? passwort : '';
    if (!p) return 'Bitte ein Passwort eingeben';
    if (p.length < MINDESTLAENGE) {
      return 'Das Passwort braucht mindestens ' + MINDESTLAENGE + ' Zeichen';
    }

    var fehlt = [];
    if (!/[a-z]/.test(p)) fehlt.push('ein kleiner Buchstabe');
    if (!/[A-Z]/.test(p)) fehlt.push('ein großer Buchstabe');
    if (!/[0-9]/.test(p)) fehlt.push('eine Ziffer');
    if (fehlt.length === 0) return null;

    // „a, b und c" statt „a, b, c" — es wird vorgelesen, nicht abgehakt.
    var liste =
      fehlt.length === 1
        ? fehlt[0]
        : fehlt.slice(0, -1).join(', ') + ' und ' + fehlt[fehlt.length - 1];
    return 'Im Passwort fehlt noch ' + liste;
  }

  /**
   * Eine englische Meldung aus Supabase auf Deutsch.
   *
   * Nur die Fälle, die Nutzer wirklich zu sehen bekommen. Was nicht dabei ist,
   * kommt unverändert durch — eine unübersetzte Meldung ist immer noch besser
   * als eine erfundene.
   */
  function uebersetze(meldung) {
    var m = String(meldung || '').toLowerCase();
    if (!m) return 'Es hat nicht geklappt.';

    if (m.indexOf('invalid login credentials') >= 0)
      return 'E-Mail oder Passwort stimmt nicht.';
    if (m.indexOf('email not confirmed') >= 0)
      return 'Bestätige zuerst die E-Mail, die wir dir geschickt haben.';
    if (m.indexOf('already registered') >= 0 || m.indexOf('user already exists') >= 0)
      return 'Für diese E-Mail gibt es schon ein Konto.';
    /*
     * Der Fall aus dem Bild vom 07.09.2026. Supabase nennt hier zwar selbst,
     * was fehlt, aber auf Englisch und als Zeichenvorrat
     * („abcdefghijklmnopqrstuvwxyz"). Die eigene Regel steht schon oben —
     * also lieber die.
     */
    if (m.indexOf('weak password') >= 0 || m.indexOf('password should') >= 0)
      return 'Das Passwort ist zu einfach. ' + REGEL_TEXT + '.';
    if (m.indexOf('rate limit') >= 0 || m.indexOf('too many') >= 0)
      return 'Zu viele Versuche. Bitte kurz warten.';
    if (m.indexOf('unable to validate email') >= 0)
      return 'Diese E-Mail-Adresse sieht nicht richtig aus.';
    if (m.indexOf('email address') >= 0 && m.indexOf('invalid') >= 0)
      return 'Diese E-Mail-Adresse wird nicht akzeptiert. Bitte prüfe sie.';
    if (m.indexOf('signups not allowed') >= 0 || m.indexOf('signup is disabled') >= 0)
      return 'Neue Konten sind gerade nicht möglich.';
    if (m.indexOf('same password') >= 0)
      return 'Das ist dein bisheriges Passwort.';
    if (m.indexOf('session') >= 0 && m.indexOf('missing') >= 0)
      return 'Die Anmeldung ist abgelaufen. Bitte melde dich neu an.';
    if (m.indexOf('failed to fetch') >= 0 || m.indexOf('network') >= 0)
      return 'Keine Verbindung. Bitte prüfe dein Netz.';

    return meldung;
  }

  return {
    MINDESTLAENGE: MINDESTLAENGE,
    REGEL_TEXT: REGEL_TEXT,
    pruefe: pruefe,
    uebersetze: uebersetze,
  };
});
