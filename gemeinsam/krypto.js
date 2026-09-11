/**
 * All Media — Ende-zu-Ende-Verschlüsselung, die Rechenschicht.
 *
 * WARUM ES DAS GIBT
 *
 * Im Anrufbildschirm und im Kontaktprofil stand „Ende-zu-Ende-verschlüsselt",
 * und verschlüsselt wurde nichts. Das ist der letzte offene Punkt aus dem
 * Handbuch-Abgleich und der mit dem größten rechtlichen Gewicht: ein Satz,
 * der dem Nutzer etwas zusichert, war schlicht unwahr.
 *
 * WARUM IN `gemeinsam/`
 *
 * Krypto darf es nicht zweimal geben. Zwei Fassungen laufen auseinander, und
 * beim Verschlüsseln heißt „auseinander" nicht „sieht anders aus", sondern
 * „die andere Seite kann es nicht mehr lesen". Diese Datei läuft unverändert
 * in Node (Prüfläufe, Server), in Metro (App) und im Browser (Website).
 *
 * WAS SIE NICHT TUT
 *
 * Sie kennt weder Supabase noch SecureStore noch localStorage. Sie rechnet
 * nur. Wo ein Schlüssel liegt, entscheidet jede Seite selbst — in der App
 * `app/lib/krypto.ts`, im Browser `web/public/krypto.js`.
 *
 * DAS VERFAHREN
 *
 * NaCl, also X25519 für den Schlüsseltausch und XSalsa20-Poly1305 für den
 * Inhalt (`tweetnacl.js` daneben, reines JavaScript, gemeinfrei). Kein
 * natives Modul — sonst liefe es in Expo Go nicht.
 *
 * Je Nachricht ein frischer Sitzungsschlüssel; der Text wird einmal damit
 * verschlossen. Dieser Sitzungsschlüssel wird dann für jedes Gerät, das
 * mitlesen darf, einzeln in ein Kuvert gelegt. Das ist der Grund, warum eine
 * Person zugleich App und Website benutzen kann und warum Gruppen ohne einen
 * zweiten Mechanismus funktionieren: mehr Geräte heißt mehr Kuverts, nicht
 * mehr Chiffren.
 *
 * WAS DAMIT AUSDRÜCKLICH NICHT ZUGESICHERT IST
 *
 * - Wer mit wem schreibt, wann und wie oft, steht weiter unverschlüsselt in
 *   der Datenbank. Verschlüsselt ist der Inhalt, nicht die Beziehung.
 * - Es gibt keine Vorwärtssicherheit. Wer den Gerätschlüssel bekommt, kann
 *   alle alten Nachrichten dieses Geräts lesen. Signal löst das mit Double
 *   Ratchet; das ist ein eigenes Vorhaben.
 * - Die öffentlichen Schlüssel kommen vom Server. Wer den Server beherrscht,
 *   kann einen eigenen Schlüssel unterschieben. Dagegen hilft nur ein
 *   Vergleich der Fingerabdrücke von Hand — `fingerabdruck()` liefert ihn,
 *   die Oberfläche zeigt ihn im Kontaktprofil.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory(require('./tweetnacl'));
  } else {
    // Browser: tweetnacl.js liegt als eigenes <script> davor.
    global.Krypto = factory(global.nacl);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (nacl) {
  'use strict';

  /**
   * Die Fassung des Verfahrens.
   *
   * Sie steht an jeder Nachricht. Wer später etwas ändert — anderes Verfahren,
   * andere Reihenfolge —, zählt hoch und lässt alte Nachrichten mit der alten
   * Zahl lesbar. Ohne diese Zahl wäre jede Änderung am Format ein stiller
   * Datenverlust.
   */
  var VERSION = 1;

  // ------------------------------------------------------------- Zufall --

  /**
   * Die Zufallsquelle setzen.
   *
   * tweetnacl findet sie im Browser (`crypto.getRandomValues`) und in Node
   * (`crypto.randomBytes`) allein. React Native hat keine von beiden — dort
   * reicht die App `expo-crypto` durch. Ohne Quelle wirft tweetnacl „no PRNG",
   * und das ist richtig so: lieber ein Fehler als ein vorhersagbarer
   * Schlüssel.
   */
  function zufallsquelleSetzen(fn) {
    nacl.setPRNG(fn);
  }

  /** Prüft, ob überhaupt eine Zufallsquelle da ist — vor dem ersten Schlüssel. */
  function zufallBereit() {
    try {
      nacl.randomBytes(1);
      return true;
    } catch (e) {
      return false;
    }
  }

  // -------------------------------------------------------------- Base64 --

  /*
   * Eigene Base64-Umrechnung, weil keine der vorhandenen überall da ist:
   * `Buffer` gibt es nur in Node, `atob`/`btoa` nur im Browser, und React
   * Native hat mal das eine und mal das andere. Dreißig Zeilen sind billiger
   * als eine Fallunterscheidung, die auf einer der drei Seiten schiefgeht.
   */
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  function zuBase64(bytes) {
    var aus = '';
    var i;
    for (i = 0; i + 2 < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      aus += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    }
    var rest = bytes.length - i;
    if (rest === 1) {
      var a = bytes[i] << 16;
      aus += B64[(a >> 18) & 63] + B64[(a >> 12) & 63] + '==';
    } else if (rest === 2) {
      var b = (bytes[i] << 16) | (bytes[i + 1] << 8);
      aus += B64[(b >> 18) & 63] + B64[(b >> 12) & 63] + B64[(b >> 6) & 63] + '=';
    }
    return aus;
  }

  function ausBase64(text) {
    var sauber = String(text || '').replace(/[^A-Za-z0-9+/]/g, '');
    var laenge = Math.floor((sauber.length * 3) / 4);
    var bytes = new Uint8Array(laenge);
    var p = 0;
    for (var i = 0; i < sauber.length; i += 4) {
      var n =
        (B64.indexOf(sauber[i]) << 18) |
        (B64.indexOf(sauber[i + 1]) << 12) |
        ((B64.indexOf(sauber[i + 2]) & 63) << 6) |
        (B64.indexOf(sauber[i + 3]) & 63);
      if (p < laenge) bytes[p++] = (n >> 16) & 255;
      if (p < laenge) bytes[p++] = (n >> 8) & 255;
      if (p < laenge) bytes[p++] = n & 255;
    }
    return bytes;
  }

  /*
   * UTF-8 von Hand, aus demselben Grund: `TextEncoder` fehlt in manchen
   * React-Native-Fassungen. Ein Umlaut oder ein Emoji darf beim Verschlüsseln
   * nicht kaputtgehen — genau das passiert bei einer byteweisen Umrechnung.
   */
  function zuBytes(text) {
    var s = unescape(encodeURIComponent(String(text == null ? '' : text)));
    var bytes = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes;
  }

  function ausBytes(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return decodeURIComponent(escape(s));
  }

  // ---------------------------------------------------------- Schlüssel --

  /**
   * Ein Schlüsselpaar für dieses Gerät erzeugen.
   *
   * Der geheime Teil verlässt das Gerät nie. Der öffentliche geht in die
   * Tabelle `krypto_schluessel`, damit andere an ihn heranschreiben können.
   */
  function schluesselpaarErzeugen() {
    var paar = nacl.box.keyPair();
    return {
      oeffentlich: zuBase64(paar.publicKey),
      geheim: zuBase64(paar.secretKey),
    };
  }

  /**
   * Der Fingerabdruck eines öffentlichen Schlüssels — acht Vierergruppen.
   *
   * Er ist die einzige Möglichkeit, den Schlüsseltausch zu prüfen, ohne dem
   * Server zu glauben. Deshalb steht er im Kontaktprofil und nicht in einem
   * Entwicklermenü.
   */
  function fingerabdruck(oeffentlich) {
    var summe = nacl.hash(ausBase64(oeffentlich));
    var ziffern = '';
    for (var i = 0; i < 16; i++) ziffern += ('0' + summe[i].toString(16)).slice(-2);
    return (ziffern.toUpperCase().match(/.{4}/g) || []).join(' ');
  }

  // -------------------------------------------------------- Verschließen --

  /**
   * Einen Text verschließen.
   *
   * `empfaenger` ist die Liste aller Geräte, die mitlesen dürfen — die des
   * Gegenübers **und** die eigenen. Die eigenen gehören zwingend dazu: sonst
   * kann man seine eigene Nachricht am zweiten Gerät nicht mehr lesen. Beim
   * Aufrufer liegt es, diese Liste vollständig zu füllen; hier wird sie nur
   * abgearbeitet.
   *
   * Rückgabe passt eins zu eins auf die Datenbankspalten:
   *   { version, chiffre, nonce, absender, kuverts: [{ schluesselId, nonce, chiffre }] }
   */
  function verschluesseln(text, meinGeheim, empfaenger) {
    var liste = empfaenger || [];
    if (!liste.length) throw new Error('Kein Empfängerschlüssel — nichts zu verschließen');

    var sitzung = nacl.randomBytes(nacl.secretbox.keyLength);
    var nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    var chiffre = nacl.secretbox(zuBytes(text), nonce, sitzung);

    var geheim = ausBase64(meinGeheim);
    var meinOeffentlich = zuBase64(nacl.box.keyPair.fromSecretKey(geheim).publicKey);

    var kuverts = [];
    for (var i = 0; i < liste.length; i++) {
      var kn = nacl.randomBytes(nacl.box.nonceLength);
      var kc = nacl.box(sitzung, kn, ausBase64(liste[i].oeffentlich), geheim);
      kuverts.push({
        schluesselId: liste[i].id,
        nonce: zuBase64(kn),
        chiffre: zuBase64(kc),
      });
    }

    return {
      version: VERSION,
      chiffre: zuBase64(chiffre),
      nonce: zuBase64(nonce),
      absender: meinOeffentlich,
      kuverts: kuverts,
    };
  }

  /**
   * Einen Text wieder öffnen.
   *
   * `kuvert` ist das Kuvert, das für **meinen** Gerätschlüssel bestimmt war;
   * welches das ist, entscheidet die Abfrage, nicht diese Funktion.
   *
   * Gibt `null` zurück, wenn es nicht aufgeht — kein Wurf. Eine Nachricht von
   * einem Gerät, dessen Schlüssel man nicht mehr hat, ist ein normaler
   * Zustand und darf die ganze Chatliste nicht zum Absturz bringen. Die
   * Oberfläche zeigt dann „Diese Nachricht lässt sich auf diesem Gerät nicht
   * lesen" statt eines leeren Bildschirms.
   */
  function entschluesseln(nachricht, kuvert, meinGeheim) {
    try {
      if (!nachricht || !kuvert || !meinGeheim) return null;
      if (Number(nachricht.version) !== VERSION) return null;

      var geheim = ausBase64(meinGeheim);
      var sitzung = nacl.box.open(
        ausBase64(kuvert.chiffre),
        ausBase64(kuvert.nonce),
        ausBase64(nachricht.absender),
        geheim
      );
      if (!sitzung) return null;

      var klar = nacl.secretbox.open(
        ausBase64(nachricht.chiffre),
        ausBase64(nachricht.nonce),
        sitzung
      );
      if (!klar) return null;

      return ausBytes(klar);
    } catch (e) {
      return null;
    }
  }

  return {
    VERSION: VERSION,
    zufallsquelleSetzen: zufallsquelleSetzen,
    zufallBereit: zufallBereit,
    schluesselpaarErzeugen: schluesselpaarErzeugen,
    fingerabdruck: fingerabdruck,
    verschluesseln: verschluesseln,
    entschluesseln: entschluesseln,
    zuBase64: zuBase64,
    ausBase64: ausBase64,
  };
});
