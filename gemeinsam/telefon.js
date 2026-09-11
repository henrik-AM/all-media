/**
 * All Media — die Telefonnummer, wie App und Website sie beide lesen.
 *
 * WARUM ES DAS GIBT
 *
 * Unter Einstellungen → Konto stand „Telefonnummer ändern". Man tippte eine
 * Nummer ein, es erschien „Wir haben dir einen Bestätigungscode geschickt" —
 * und es passierte nichts. Kein Code, keine SMS, kein Schreibvorgang. Die
 * Spalte `profiles.phone` gab es die ganze Zeit, samt Eindeutigkeits-Index
 * aus SUPABASE_SCHEMA_11_handbuch.sql, und im fremden Profil steht die Nummer
 * unter „Kontaktinfo".
 *
 * Ein Bestätigungscode ist nicht möglich: dafür bräuchte das Projekt einen
 * SMS-Versand bei Supabase (Twilio o. ä.), und der ist nicht eingerichtet.
 * Also verspricht die Oberfläche jetzt keinen — sie speichert die Nummer und
 * sagt das auch.
 *
 * WAS HIER GEPRÜFT WIRD
 *
 * Nur die Form, nicht die Existenz. Ob es die Nummer gibt, weiß ohne SMS
 * niemand; das gehört zum Bestätigungscode, den es nicht gibt.
 *
 * WARUM DIE NUMMER NICHT UMGESCHRIEBEN WIRD
 *
 * Gespeichert wird, was eingetippt wurde — nur außen beschnitten. Genau das
 * steht später in der Kontaktinfo, und „+49 151 2345678" liest sich besser
 * als „+491512345678". Der Eindeutigkeits-Index auf `profiles.phone` sieht
 * deshalb zwei Schreibweisen derselben Nummer nicht als dieselbe an; dafür
 * gibt es `vergleichsform()` und die Datenbankfunktion `finde_per_nummer`,
 * die beide dieselbe Rechnung machen. Die Dopplung wird also vor dem
 * Schreiben geprüft und nicht dem Index überlassen.
 *
 * WARUM ES EINE .js-DATEI IST
 *
 * Wie `spalten.js` und `passwort.js`: Node, Metro und der Browser lesen
 * dieselbe Datei ohne Übersetzungsschritt. Die Typen liefert telefon.d.ts.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory();
  } else {
    // Browser: als eigenes <script> eingebunden.
    global.Telefon = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Ein Anschluss hat mindestens so viele Ziffern — ohne Landesvorwahl. */
  var MINDESTZIFFERN = 6;
  /** E.164 lässt höchstens 15 zu; ein paar mehr, damit Durchwahlen passen. */
  var HOECHSTZIFFERN = 18;

  var REGEL_TEXT = 'Zum Beispiel +49 151 2345678';

  /**
   * Wie die Nummer gespeichert wird: so, wie sie eingetippt wurde, außen
   * beschnitten und ohne doppelte Leerzeichen. Mehr nicht — Gründe oben.
   */
  function speicherform(eingabe) {
    var roh = typeof eingabe === 'string' ? eingabe.trim() : '';
    return roh.replace(/\s+/g, ' ');
  }

  /**
   * Die Form, in der zwei Nummern verglichen werden.
   *
   * „+49 170 1234567", „0170 1234567" und „0049-170-1234567" ergeben
   * denselben Wert: 491701234567.
   *
   * WARUM DIE FÜHRENDE 0 ZU 49 WIRD
   *
   * Das ist eine Annahme — wer eine Nummer ohne Landesvorwahl eintippt, meint
   * die aus seinem eigenen Land, und dieses Projekt läuft auf Deutsch. Sie
   * stand vorher schon in `app/lib/personSuche.ts` und in
   * `web/server/sync-handlers.js`, damit die Personensuche „0170…" und
   * „+49 170…" als dieselbe Person findet. Sie hier zu wiederholen wäre die
   * vierte Fassung gewesen; stattdessen holen sich beide Seiten sie von hier.
   *
   * WER SIE SONST NOCH KENNEN MUSS
   *
   * `finde_per_nummer` in SUPABASE_SCHEMA_24_telefon.sql. Die Datenbank
   * vergleicht dieselben Nummern und muss deshalb dieselbe Regel rechnen —
   * vorher strich sie nur die Nicht-Ziffern weg, und „0152 3456789" ging als
   * neue Nummer durch, obwohl sie schon jemandem als „+49 152 3456789"
   * gehörte. Wer das hier ändert, ändert es dort mit.
   */
  function vergleichsform(eingabe) {
    var z = (typeof eingabe === 'string' ? eingabe : '').replace(/[^\d+]/g, '');
    z = z.replace(/^\+/, '00');
    if (z.indexOf('00') === 0) return z.slice(2);
    if (z.charAt(0) === '0') return '49' + z.slice(1);
    return z;
  }

  /** Gibt null zurück, wenn die Nummer passt, sonst den Grund auf Deutsch. */
  function pruefe(eingabe) {
    var roh = typeof eingabe === 'string' ? eingabe.trim() : '';
    if (!roh) return 'Bitte eine Telefonnummer eingeben';

    // Buchstaben sind keine Tippfehler, sondern eine andere Eingabe.
    if (/[a-zA-Z]/.test(roh)) return 'Eine Telefonnummer besteht aus Ziffern';

    var ziffern = roh.replace(/\D/g, '');
    if (ziffern.length < MINDESTZIFFERN) return 'Die Nummer ist zu kurz';
    if (ziffern.length > HOECHSTZIFFERN) return 'Die Nummer ist zu lang';

    // Ein + gehört an den Anfang oder gar nicht hin.
    if (roh.indexOf('+') > 0) return 'Das + gehört an den Anfang der Nummer';

    return null;
  }

  return {
    MINDESTZIFFERN: MINDESTZIFFERN,
    HOECHSTZIFFERN: HOECHSTZIFFERN,
    REGEL_TEXT: REGEL_TEXT,
    speicherform: speicherform,
    vergleichsform: vergleichsform,
    pruefe: pruefe,
  };
});
