/**
 * Mitgliederliste und Beitritt einer Community — eine Regel für App und
 * Website (Feedback 28.09.2026, Kästen 9 und 15.1–15.3, Schema 97).
 *
 * Henrik: „Bei öffentlichen Communities soll man, wenn man auf der
 * Homeseite der Community auf den Namen drückt, auch die jeweiligen Personen
 * sehen können, die beigetreten sind, bei privaten Communities darf man das
 * nicht sehen, da darf man nur die Anzahl sehen. (ausgeschlossen von dem
 * Ersteller der Community, der darf das immer sehen)."
 *
 * „Bei privaten Communitys kann ich einfach auf Beitreten drücken […]
 * Achte darauf, dass dort der Administrator erst mal meine Anfrage
 * genehmigen muss."
 *
 * Entschieden wird in der Datenbank (Schema 97: Regel „Mitglieder lesen",
 * Tabelle community_beitrittsanfragen, beitrittsanfrage_annehmen). Hier
 * steht nur, was die Oberfläche daraus macht, damit App und Website
 * dasselbe zeigen und sagen.
 *
 * UMD-Hülle wie ptt.js; eingetragen in UMD_BAUSTEINE
 * (app/test/_modulquelle.js) und web/public/index.html (`window.Beitritt`).
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.Beitritt = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var TITEL = 'Mitglieder';
  var ANFRAGEN = 'Beitrittsanfragen';
  var ANNEHMEN = 'Annehmen';
  var ABLEHNEN = 'Ablehnen';
  var ERSTELLER = 'Ersteller';
  var DU = 'Du';
  var PRIVAT_HINWEIS = 'Private Community – die Mitglieder sieht nur, wer sie angelegt hat.';
  var PRIVAT_INHALT = 'Diese Community ist privat. Unterthemen und Nachrichten siehst du, sobald deine Anfrage angenommen ist.';
  var LEER = 'Noch keine Mitglieder.';
  var FEHLT_SCHEMA = 'Beitrittsanfragen gehen erst, wenn das Datenbank-Update eingespielt ist.';

  /** „1 Mitglied", „1.204 Mitglieder" */
  function anzahlText(n) {
    var zahl = Math.max(0, Math.round(Number(n) || 0));
    return zahl.toLocaleString('de-DE') + (zahl === 1 ? ' Mitglied' : ' Mitglieder');
  }

  /**
   * Darf ich die Liste sehen? Öffentlich: jeder. Privat: nur der Ersteller.
   * Dieselbe Bedingung wie mitglieder_sichtbar() in Schema 97 — die
   * Oberfläche fragt gar nicht erst, wo die Datenbank ohnehin nur die
   * eigene Zeile herausgäbe.
   */
  function listeSichtbar(c) {
    if (!c) return false;
    return c.visibility !== 'private' || Boolean(c.eigen);
  }

  /** Unterthemen und Nachrichten: öffentlich, Mitglied oder Ersteller (community_sichtbar). */
  function inhaltSichtbar(c) {
    if (!c) return false;
    return c.visibility !== 'private' || Boolean(c.joined) || Boolean(c.eigen);
  }

  /**
   * Was der Beitritts-Knopf ist.
   *
   *   eigen      die eigene Community — kein Knopf, nur ein Merker
   *   verlassen  Mitglied
   *   angefragt  private Community, Anfrage läuft — Antippen zieht zurück
   *   anfragen   private Community, noch nicht gefragt
   *   beitreten  öffentliche Community
   */
  function zustand(c) {
    if (!c) return 'beitreten';
    if (c.eigen) return 'eigen';
    if (c.joined) return 'verlassen';
    if (c.visibility === 'private') return c.angefragt ? 'angefragt' : 'anfragen';
    return 'beitreten';
  }

  var KNOPF = {
    eigen: 'Deine Community',
    verlassen: 'Verlassen',
    angefragt: 'Angefragt',
    anfragen: 'Anfrage senden',
    beitreten: 'Beitreten',
  };

  /** Beschriftung auf der Community-Seite. */
  function knopfText(c) {
    return KNOPF[zustand(c)];
  }

  /** Beschriftung in Suchlisten: Mitglied statt Verlassen. */
  function suchText(c) {
    var z = zustand(c);
    if (z === 'verlassen') return 'Mitglied';
    if (z === 'eigen') return 'Deine';
    return KNOPF[z];
  }

  /** Die Meldung nach dem Antippen — sagt, was wirklich passiert ist. */
  function meldung(vorher, name) {
    var n = '„' + (name || 'Community') + '“';
    switch (vorher) {
      case 'verlassen':
        return n + ' verlassen';
      case 'angefragt':
        return 'Anfrage an ' + n + ' zurückgezogen';
      case 'anfragen':
        return 'Anfrage an ' + n + ' gesendet – wer sie angelegt hat, entscheidet';
      default:
        return n + ' beigetreten';
    }
  }

  /**
   * Die Liste: Ersteller zuerst, dann ich, dann nach Namen. Eingabe sind
   * Zeilen { id, name, handle, ... }; `ichId` ist die Kennung, unter der
   * ich in der Liste stehe ('me' in beiden Oberflächen).
   */
  function ordnen(zeilen, erstellerId, ichId) {
    var rang = function (z) {
      if (erstellerId && z.id === erstellerId) return 0;
      if (ichId && z.id === ichId) return 1;
      return 2;
    };
    return (zeilen || []).slice().sort(function (a, b) {
      return (
        rang(a) - rang(b) ||
        String(a.name || '').localeCompare(String(b.name || ''), 'de', { sensitivity: 'base' })
      );
    });
  }

  /**
   * Suchmuster für die Datenbanksuche unter Communitys → Suchen
   * (Kasten 15.5): „*text*" für ilike in einem PostgREST-or()-Filter.
   *
   * Komma, Klammern, Anführungszeichen, Doppelpunkt und Backslash zerlegen
   * den or()-Ausdruck; * und % wären selbst Platzhalter. Sie fallen weg.
   * Unter zwei Zeichen wird nicht gesucht — dann reicht die geladene Liste.
   */
  function suchmuster(eingabe) {
    var rein = String(eingabe || '')
      .replace(/[,()"'\\:*%]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^@/, '')
      .slice(0, 50);
    return rein.length >= 2 ? '*' + rein + '*' : '';
  }

  /**
   * Der ganze or()-Filter: `name.ilike."*text*",topic.ilike."*text*"`.
   * In Anführungszeichen, weil Punkte im Text (@h.dikta) sonst als
   * Trenner gelesen würden. Leer, wenn nicht gesucht wird.
   */
  function suchFilter(spalten, eingabe) {
    var muster = suchmuster(eingabe);
    if (!muster) return '';
    return (spalten || [])
      .map(function (s) {
        return s + '.ilike."' + muster + '"';
      })
      .join(',');
  }

  /** Fehlt Tabelle, Spalte oder Funktion aus Schema 97? Dann nachsichtig weiter. */
  function fehltSchema(fehler) {
    if (!fehler) return false;
    var code = String(fehler.code || '');
    var text = String(fehler.message || '');
    if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || code === '42883') return true;
    if (code === '42703' || code === 'PGRST204') {
      return text.indexOf('mitglieder_anzahl') !== -1 || text.indexOf('beitrittsanfrage') !== -1;
    }
    return /community_beitrittsanfragen|beitrittsanfrage_annehmen/.test(text);
  }

  return {
    TITEL: TITEL,
    ANFRAGEN: ANFRAGEN,
    ANNEHMEN: ANNEHMEN,
    ABLEHNEN: ABLEHNEN,
    ERSTELLER: ERSTELLER,
    DU: DU,
    PRIVAT_HINWEIS: PRIVAT_HINWEIS,
    PRIVAT_INHALT: PRIVAT_INHALT,
    LEER: LEER,
    FEHLT_SCHEMA: FEHLT_SCHEMA,
    KNOPF: KNOPF,
    anzahlText: anzahlText,
    listeSichtbar: listeSichtbar,
    inhaltSichtbar: inhaltSichtbar,
    zustand: zustand,
    knopfText: knopfText,
    suchText: suchText,
    meldung: meldung,
    ordnen: ordnen,
    suchmuster: suchmuster,
    suchFilter: suchFilter,
    fehltSchema: fehltSchema,
  };
});
