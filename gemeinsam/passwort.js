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
   * Steht dieses Passwort in einem bekannten Datenleck?
   *
   * WARUM ES DAS GIBT (13.09.2026)
   *
   * Die Regel oben prüft die Form: zehn Zeichen, groß, klein, Ziffer.
   * `Passwort123` erfüllt sie vollständig — und steht in jeder Wortliste, die
   * für einen Angriff benutzt wird. Der häufigste Weg in ein fremdes Konto ist
   * nicht das Raten, sondern das Nachschlagen: Adresse und Passwort aus einem
   * fremden Leck durchprobieren, weil die meisten Menschen dasselbe Passwort
   * mehrfach benutzen.
   *
   * Supabase kann das selbst prüfen (Leaked Password Protection gegen
   * HaveIBeenPwned), aber nur im kostenpflichtigen Pro-Tarif — nachgeprüft am
   * 13.09.2026, die Einstellung antwortet mit HTTP 402. Dieselbe Prüfung über
   * dieselbe Datenbank kostet an dieser Stelle nichts.
   *
   * DAS PASSWORT VERLÄSST DAS GERÄT NICHT
   *
   * Verschickt werden die ersten FÜNF Zeichen des SHA-1-Werts. Zurück kommen
   * alle Endungen, die mit diesem Anfang beginnen — meist einige hundert. Ob
   * die eigene darunter ist, entscheidet das Gerät. Der Dienst erfährt weder
   * das Passwort noch seinen vollständigen Hash noch, wer gefragt hat
   * (k-Anonymität).
   *
   * IM ZWEIFEL DURCHLASSEN
   *
   * Antwortet der Dienst nicht, gibt die Funktion `false` zurück. Eine
   * Registrierung, die scheitert, weil ein fremder Server gerade langsam ist,
   * wäre der schlechtere Tausch — die Formregel und Supabase prüfen ohnehin
   * weiter.
   *
   * @param passwort Das zu prüfende Passwort.
   * @param sha1 Funktion, die daraus den SHA-1-Wert in Hex macht. Muss der
   *   Aufrufer stellen, weil Browser (crypto.subtle) und App (expo-crypto)
   *   verschiedene Wege haben und diese Datei beide bedient.
   * @returns true, wenn das Passwort in einem Leck steht.
   */
  function geleakt(passwort, sha1) {
    var p = typeof passwort === 'string' ? passwort : '';
    if (!p || typeof sha1 !== 'function') return Promise.resolve(false);

    return Promise.resolve()
      .then(function () {
        return sha1(p);
      })
      .then(function (hex) {
        var voll = String(hex || '').toUpperCase();
        if (voll.length !== 40) return false;

        var anfang = voll.slice(0, 5);
        var rest = voll.slice(5);

        // Eine Zeitgrenze, damit eine hängende Anfrage nicht die Anmeldung
        // anhält. Drei Sekunden reichen; danach gilt "nicht geleakt".
        var abbruch = typeof AbortController === 'function' ? new AbortController() : null;
        var uhr = setTimeout(function () {
          if (abbruch) abbruch.abort();
        }, 3000);

        return fetch('https://api.pwnedpasswords.com/range/' + anfang, {
          signal: abbruch ? abbruch.signal : undefined,
        })
          .then(function (antwort) {
            clearTimeout(uhr);
            if (!antwort.ok) return false;
            return antwort.text();
          })
          .then(function (text) {
            if (!text) return false;
            // Jede Zeile: "<Endung>:<Anzahl der Funde>".
            var zeilen = String(text).split('\n');
            for (var i = 0; i < zeilen.length; i++) {
              if (zeilen[i].slice(0, 35).toUpperCase() === rest) return true;
            }
            return false;
          });
      })
      .catch(function () {
        return false;
      });
  }

  /** Der Satz, den ein Nutzer sieht, wenn sein Passwort in einem Leck steht. */
  var GELEAKT_TEXT =
    'Dieses Passwort steht in einem bekannten Datenleck. Bitte nimm ein anderes — ' +
    'auch wenn es die Regel erfüllt, wird genau dieses durchprobiert.';

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
    GELEAKT_TEXT: GELEAKT_TEXT,
    pruefe: pruefe,
    geleakt: geleakt,
    uebersetze: uebersetze,
  };
});
