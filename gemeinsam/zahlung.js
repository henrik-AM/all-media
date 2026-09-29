/**
 * All Media — Spendencode und Zahlungsmethoden, wie App und Website sie
 * beide prüfen (Feedback 21.09.2026, Kasten 13.2 und 13.3).
 *
 * WARUM ES DAS GIBT
 *
 * Henrik am 21.09.2026: „Zahlungsmethode für den Spenden-Code (PayPal, Apple
 * Pay, Google Pay, Kreditkarte o. ä.). Gespendet wird über einen
 * personalisierten Code, den der Nutzer selbst festlegt."
 *
 * Bis zum 29.09.2026 war „Spendencode" in beiden Oberflächen ein Formular,
 * das „gespeichert" meldete und nichts speicherte, und eine Spende war ein
 * INSERT in `donations`, das jeder angemeldete Nutzer ohne jede Bestätigung
 * absetzen konnte.
 *
 * WAS DER CODE IST
 *
 * Das Handbuch sagt nur „Geld senden/spenden → unter Einstellungen
 * (persönlicher Code)" und „Spendencode → Profil Verknüpfung mit Bankkarte
 * oder PayPal". Offen bleibt, ob der Code eine PIN ist oder ein öffentlicher
 * Name. Gebaut ist die PIN-Lesart: der Code bestätigt jede Spende, wird vor
 * jeder Spende eingegeben und liegt in der Datenbank nur als Hash
 * (bcrypt). Die Frage steht im Bericht an Henrik.
 *
 * WER DIESELBE REGEL KENNT
 *
 * `public.spendencode_normal`, `public.spendencode_gueltig` und die
 * Prüfungen der Tabelle `zahlungsmethoden` in
 * SUPABASE_SCHEMA_72_zahlung_spendencode.sql. Wer hier etwas ändert, ändert
 * es dort mit.
 *
 * WAS HIER BEWUSST NICHT STEHT
 *
 * Keine Kartennummer, keine Prüfziffer, kein CVC. Eine Karte wird nur mit
 * den letzten vier Ziffern und dem Ablaufdatum vermerkt; die ganze Nummer
 * gibt der Nutzer später beim Zahlungsdienst ein, nie bei uns.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory();
  } else {
    // Browser: als eigenes <script> eingebunden.
    global.Zahlung = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ------------------------------------------------------------ Spendencode --

  var CODE_MIN = 6;
  var CODE_MAX = 16;
  var CODE_REGEL_TEXT =
    'Sechs bis sechzehn Zeichen, nur Buchstaben A–Z und Ziffern. Groß- und Kleinschreibung zählt nicht.';

  /** Leerzeichen und Bindestriche fallen weg — wie in `spendencode_normal`. */
  function roh(eingabe) {
    return (typeof eingabe === 'string' ? eingabe : '').replace(/[\s-]/g, '');
  }

  /**
   * Die Form, in der der Code verglichen wird: ohne Leerzeichen und
   * Bindestriche, in Großbuchstaben. Nur ASCII — `'ß'.toUpperCase()` wäre in
   * JavaScript „SS", in Postgres „ß"; deshalb sind Umlaute gar nicht erst
   * erlaubt, dann rechnen beide Seiten gleich.
   */
  function codeNormal(eingabe) {
    return roh(eingabe).toUpperCase();
  }

  /** Gibt null zurück, wenn die Form passt, sonst den Grund auf Deutsch. */
  function codePruefe(eingabe) {
    var r = roh(eingabe);
    if (!r) return 'Bitte einen Spendencode eingeben';
    if (!/^[A-Za-z0-9]+$/.test(r)) return 'Nur Buchstaben A–Z und Ziffern, keine Umlaute oder Sonderzeichen';
    if (r.length < CODE_MIN) return 'Mindestens ' + CODE_MIN + ' Zeichen';
    if (r.length > CODE_MAX) return 'Höchstens ' + CODE_MAX + ' Zeichen';
    return null;
  }

  // --------------------------------------------------------------- Beträge --

  /** 0,50 € bis 1.000 € — dieselben Grenzen wie in `spende_senden`. */
  var MIN_CENT = 50;
  var MAX_CENT = 100000;

  function betragPruefe(cent) {
    if (!Number.isFinite(cent) || Math.round(cent) !== cent) return 'Bitte einen gültigen Betrag eingeben';
    if (cent < MIN_CENT || cent > MAX_CENT) return 'Bitte einen Betrag zwischen 0,50 € und 1.000 € eingeben';
    return null;
  }

  function euro(cent) {
    return (cent / 100).toFixed(2).replace('.', ',') + ' €';
  }

  // ----------------------------------------------------- Zahlungsmethoden --

  var ANBIETER = [
    { id: 'paypal', name: 'PayPal' },
    { id: 'apple_pay', name: 'Apple Pay' },
    { id: 'google_pay', name: 'Google Pay' },
    { id: 'karte', name: 'Kredit- oder Debitkarte' },
  ];

  function anbieterName(id) {
    for (var i = 0; i < ANBIETER.length; i++) if (ANBIETER[i].id === id) return ANBIETER[i].name;
    return 'Zahlungsmethode';
  }

  /**
   * Welcher Browser? Nur so weit, wie es für Apple Pay und Google Pay zählt.
   * Chrome auf dem iPhone meldet sich als „CriOS", Edge und Opera tragen
   * „Chrome" im Namen, sind es aber nicht.
   */
  function browserErkennen(ua) {
    var t = typeof ua === 'string' ? ua : '';
    if (/CriOS\//.test(t)) return 'chrome';
    if (/Edg\/|EdgiOS|OPR\/|SamsungBrowser|FxiOS|Firefox\//.test(t)) return 'andere';
    if (/Chrome\//.test(t)) return 'chrome';
    if (/Safari\//.test(t) && /Apple|Macintosh|iPhone|iPad/.test(t)) return 'safari';
    return 'andere';
  }

  /**
   * Ist diese Zahlungsart HIER nutzbar? (Vorbehalt 13.2, 24.09.2026)
   *
   *   umgebung.os       'ios' | 'android' | 'web'
   *   umgebung.browser  'safari' | 'chrome' | 'andere'  (nur auf der Website)
   *
   * Apple Pay nur in der iOS-App und in Safari, Google Pay nur in der
   * Android-App und in Chrome. PayPal und Karte gehen überall.
   */
  function verfuegbar(anbieter, umgebung) {
    var u = umgebung || {};
    if (anbieter === 'apple_pay') return u.os === 'ios' || (u.os === 'web' && u.browser === 'safari');
    if (anbieter === 'google_pay') return u.os === 'android' || (u.os === 'web' && u.browser === 'chrome');
    return anbieter === 'paypal' || anbieter === 'karte';
  }

  function anbieterFuer(umgebung) {
    return ANBIETER.filter(function (a) {
      return verfuegbar(a.id, umgebung);
    });
  }

  /**
   * Die PayPal-Adresse, wie sie gespeichert wird: zwei Zeichen, drei
   * Sternchen, die Domain. Aus „max.mustermann@web.de" wird
   * „ma***@web.de". Die volle Adresse verlässt das Gerät nicht.
   * Gibt null zurück, wenn es keine E-Mail-Adresse ist.
   */
  function paypalMaskieren(mail) {
    var m = (typeof mail === 'string' ? mail : '').trim().toLowerCase();
    if (!/^[^@\s*]+@[^@\s]+\.[^@\s]+$/.test(m)) return null;
    var teile = m.split('@');
    return teile[0].slice(0, 2) + '***@' + teile[1];
  }

  /** „MM/JJ" oder „MM/JJJJ" → { monat, jahr } oder null. */
  function ablaufLesen(text) {
    var t = (typeof text === 'string' ? text : '').replace(/\s/g, '');
    var m = /^(\d{1,2})\/(\d{2}|\d{4})$/.exec(t);
    if (!m) return null;
    var monat = Number(m[1]);
    var jahr = Number(m[2].length === 2 ? '20' + m[2] : m[2]);
    if (monat < 1 || monat > 12 || jahr < 2020 || jahr > 2100) return null;
    return { monat: monat, jahr: jahr };
  }

  /** Ist die Karte abgelaufen? Gilt bis zum Ende des Ablaufmonats. */
  function abgelaufen(monat, jahr, jetzt) {
    var d = jetzt || new Date();
    var j = d.getFullYear();
    var mo = d.getMonth() + 1;
    return jahr < j || (jahr === j && monat < mo);
  }

  /**
   * Ein frei gewählter Name für die Methode, etwa „Sparkasse privat".
   * Fünf Ziffern am Stück sind verboten — sonst ließe sich hier doch eine
   * Kartennummer ablegen. Dieselbe Prüfung steht als CHECK in der Tabelle.
   */
  function anzeigenamePruefe(name) {
    var n = typeof name === 'string' ? name.trim() : '';
    if (n.length > 40) return 'Höchstens 40 Zeichen';
    if (/[0-9]{5,}/.test(n.replace(/[\s-]/g, ''))) return 'Bitte keine Kartennummer eingeben — nur einen Namen';
    return null;
  }

  /**
   * Aus dem Formular die Zeile für `zahlungsmethoden` bauen.
   * Gibt { zeile } oder { fehler } zurück. Die Eingabe `nummer` gibt es
   * absichtlich nicht: gefragt wird nur nach den letzten vier Ziffern.
   */
  function methodeBauen(anbieter, eingabe, umgebung, jetzt) {
    var e = eingabe || {};
    if (!ANBIETER.some(function (a) { return a.id === anbieter; })) return { fehler: 'Bitte eine Zahlungsart wählen' };
    if (umgebung && !verfuegbar(anbieter, umgebung)) {
      return { fehler: anbieterName(anbieter) + ' ist auf diesem Gerät nicht verfügbar' };
    }
    var nameFehler = anzeigenamePruefe(e.anzeigename);
    if (nameFehler) return { fehler: nameFehler };
    var zeile = {
      anbieter: anbieter,
      anzeigename: (e.anzeigename || '').trim() || anbieterName(anbieter),
      letzte4: null,
      ablauf_monat: null,
      ablauf_jahr: null,
      paypal_maskiert: null,
    };
    if (anbieter === 'paypal') {
      var maske = paypalMaskieren(e.email);
      if (!maske) return { fehler: 'Bitte die E-Mail-Adresse deines PayPal-Kontos eingeben' };
      zeile.paypal_maskiert = maske;
    }
    if (anbieter === 'karte') {
      var l4 = (e.letzte4 || '').replace(/\s/g, '');
      if (!/^\d{4}$/.test(l4)) return { fehler: 'Bitte genau die letzten vier Ziffern der Karte eingeben' };
      var ab = ablaufLesen(e.ablauf);
      if (!ab) return { fehler: 'Bitte das Ablaufdatum als MM/JJ eingeben' };
      if (abgelaufen(ab.monat, ab.jahr, jetzt)) return { fehler: 'Diese Karte ist abgelaufen' };
      zeile.letzte4 = l4;
      zeile.ablauf_monat = ab.monat;
      zeile.ablauf_jahr = ab.jahr;
    }
    return { zeile: zeile };
  }

  /** Eine Zeile zum Anzeigen: „Visa privat · •••• 4242 · 08/28". */
  function methodeText(m) {
    if (!m) return '';
    var teile = [m.anzeigename || anbieterName(m.anbieter)];
    if (m.anbieter === 'karte' && m.letzte4) teile.push('•••• ' + m.letzte4);
    if (m.anbieter === 'karte' && m.ablauf_monat && m.ablauf_jahr) {
      teile.push(String(m.ablauf_monat).padStart(2, '0') + '/' + String(m.ablauf_jahr).slice(-2));
    }
    if (m.anbieter === 'paypal' && m.paypal_maskiert) teile.push(m.paypal_maskiert);
    if (m.anzeigename && m.anzeigename !== anbieterName(m.anbieter)) teile.splice(1, 0, anbieterName(m.anbieter));
    return teile.join(' · ');
  }

  // ------------------------------------------------ Antworten der Datenbank --

  /**
   * `spende_senden`, `spendencode_setzen` und `spendencode_entfernen`
   * antworten mit { ok, grund }. Hier steht, was der Nutzer davon liest.
   */
  var GRUENDE = {
    nicht_angemeldet: 'Dafür musst du angemeldet sein',
    kein_code: 'Du hast noch keinen Spendencode festgelegt',
    falscher_code: 'Der Spendencode stimmt nicht',
    gesperrt: 'Zu viele falsche Versuche — bitte in 15 Minuten erneut probieren',
    zu_viele_versuche: 'Zu viele Versuche — bitte in einer Stunde erneut probieren',
    ungueltig: CODE_REGEL_TEXT,
    vergeben: 'Diesen Spendencode hat schon jemand gewählt — bitte einen anderen',
    bisher_falsch: 'Der bisherige Spendencode stimmt nicht',
    neu_anmelden: 'Bitte bestätige zuerst dein Passwort',
    keine_zahlungsmethode: 'Bitte zuerst eine Zahlungsmethode hinterlegen',
    methode_unbekannt: 'Diese Zahlungsmethode gibt es nicht mehr',
    methode_abgelaufen: 'Die Karte ist abgelaufen — bitte eine andere Zahlungsmethode wählen',
    betrag: 'Bitte einen Betrag zwischen 0,50 € und 1.000 € eingeben',
    selbst: 'An dich selbst geht keine Spende',
    empfaenger: 'Dieses Profil gibt es nicht mehr',
  };

  function grundText(grund, verbleibend) {
    var text = GRUENDE[grund] || 'Das hat nicht geklappt';
    if (grund === 'falscher_code' && typeof verbleibend === 'number' && verbleibend > 0) {
      text += ' — noch ' + verbleibend + (verbleibend === 1 ? ' Versuch' : ' Versuche');
    }
    return text;
  }

  return {
    CODE_MIN: CODE_MIN,
    CODE_MAX: CODE_MAX,
    CODE_REGEL_TEXT: CODE_REGEL_TEXT,
    codeNormal: codeNormal,
    codePruefe: codePruefe,
    MIN_CENT: MIN_CENT,
    MAX_CENT: MAX_CENT,
    betragPruefe: betragPruefe,
    euro: euro,
    ANBIETER: ANBIETER,
    anbieterName: anbieterName,
    browserErkennen: browserErkennen,
    verfuegbar: verfuegbar,
    anbieterFuer: anbieterFuer,
    paypalMaskieren: paypalMaskieren,
    ablaufLesen: ablaufLesen,
    abgelaufen: abgelaufen,
    anzeigenamePruefe: anzeigenamePruefe,
    methodeBauen: methodeBauen,
    methodeText: methodeText,
    grundText: grundText,
  };
});
