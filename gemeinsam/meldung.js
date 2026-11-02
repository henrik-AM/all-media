/**
 * Melden und Moderation — einmal für App, Website und Server.
 *
 * WARUM ES DAS GIBT
 *
 * Kasten RS 3 (rechtliche Prüfung vom 21.10.2026, Maßstab: veröffentlichte
 * App mit vielen Nutzern). Der Digital Services Act verlangt ein Melde- und
 * Abhilfeverfahren (Art. 16), Begründungen (Art. 17) und Widerspruch
 * (Art. 20). Bis hierher gab es in App und Website je eine eigene Liste mit
 * Gründen, „Story melden" meldete das Profil, und niemand sah eine Meldung.
 *
 * Die Datenbankseite steht in SUPABASE_SCHEMA_102_melden_moderation.sql
 * (inhalt_melden, meldung_entscheiden, …). Diese Datei ist ihr Gegenstück:
 *
 *   - die Kategorien mit denselben Schlüsseln wie die SQL-Prüfung
 *     (reports_kategorie_check), mit Namen und Erklärung in einfacher Sprache;
 *   - die Prüfung der Eingabe, GLEICH wie in inhalt_melden() — damit der
 *     Fehler im Blatt steht, bevor überhaupt etwas losgeschickt wird;
 *   - die Sätze für jeden `grund`, den die Datenbank zurückgibt;
 *   - Eingangsbestätigung, Hinweise bei Kindesmissbrauch und
 *     Selbstverletzung, Vorlagen für Moderatoren.
 *
 * Zwei Fassungen derselben Liste laufen erfahrungsgemäß auseinander (Telefon-
 * regel, Passwortprüfung). Deshalb hier, mit UMD-Hülle wie kommentar.js:
 * Node/Metro über `module.exports`, Browser als `window.Meldung`.
 *
 * „CODE VOR DEM SCHEMA"
 *
 * Schema 102 ist bei Erstellung dieser Datei nicht eingespielt (Supabase
 * gesperrt). `fehltFunktion()` erkennt den Fehler „Funktion gibt es nicht"
 * (Postgres 42883, PostgREST PGRST202). Dann fallen Beitrag, Kommentar,
 * Story, Profil und Nachricht auf den alten direkten Eintrag in `reports`
 * zurück (`alterWeg`, nur diese fünf Arten kennt die alte Tabelle); alles
 * andere sagt ehrlich „kommt mit dem nächsten Update" — nie eine
 * vorgetäuschte Erfolgsmeldung.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.Meldung = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Arten und Kategorien — Schlüssel wie in Schema 102                  */
  /* ------------------------------------------------------------------ */

  /** Was sich melden lässt (reports_target_type_check, Schema 102). */
  var ARTEN = ['post', 'comment', 'story', 'user', 'message', 'community', 'kanal_nachricht', 'problem'];

  /** Was die alte Tabelle (Schema 2) kennt — der Weg ohne Schema 102. */
  var ALTE_ARTEN = ['post', 'comment', 'story', 'user', 'message'];

  /** Wie die Art im Satz heißt („Beitrag melden"). */
  var ART_NAME = {
    post: 'Beitrag',
    comment: 'Kommentar',
    story: 'Story',
    user: 'Profil',
    message: 'Nachricht',
    community: 'Community',
    kanal_nachricht: 'Nachricht',
    problem: 'Problem',
  };

  /*
   * Die Kategorien. Reihenfolge = Reihenfolge im Blatt: das Schwerste oben,
   * „Verstoß gegen die Regeln" als Sammelbecken unten.
   *
   * `grundlage` sagt, was naheliegt: 'gesetz' (geltendes Recht) oder
   * 'regeln' (Community-Richtlinien). Der Moderator entscheidet am Ende
   * selbst; das Feld ist nur seine Vorbelegung.
   *
   * Sprache: so, dass es ein Kind mit 13 versteht (All Media ab 13).
   */
  var KATEGORIEN = [
    {
      key: 'kindesmissbrauch',
      name: 'Missbrauch von Kindern',
      erklaerung: 'Bilder, Videos oder Texte, die Kinder sexuell zeigen oder ausnutzen.',
      grundlage: 'gesetz',
    },
    {
      key: 'gewalt_drohung',
      name: 'Gewalt oder Drohung',
      erklaerung: 'Jemand droht anderen, zeigt echte Gewalt oder ruft dazu auf.',
      grundlage: 'gesetz',
    },
    {
      key: 'selbstverletzung',
      name: 'Selbstverletzung oder Suizid',
      erklaerung: 'Jemand will sich selbst wehtun oder zeigt, wie man das tut.',
      grundlage: 'regeln',
    },
    {
      key: 'hass',
      name: 'Hass oder Hetze',
      erklaerung: 'Menschen werden wegen Herkunft, Religion, Geschlecht, Behinderung oder Ähnlichem angegriffen.',
      grundlage: 'gesetz',
    },
    {
      key: 'mobbing',
      name: 'Mobbing oder Beleidigung',
      erklaerung: 'Jemand wird fertiggemacht, bloßgestellt oder beleidigt.',
      grundlage: 'regeln',
    },
    {
      key: 'sexuell',
      name: 'Nacktheit oder Sex',
      erklaerung: 'Nackte Körper oder sexuelle Inhalte, die hier nicht hingehören.',
      grundlage: 'regeln',
    },
    {
      key: 'jugendgefaehrdend',
      name: 'Gefährlich für Kinder und Jugendliche',
      erklaerung: 'Zum Beispiel Drogen, gefährliche Mutproben oder Glücksspiel.',
      grundlage: 'gesetz',
    },
    {
      key: 'privatsphaere',
      name: 'Private Daten oder Fotos',
      erklaerung: 'Jemand zeigt Adressen, Nummern oder Fotos von anderen ohne Erlaubnis.',
      grundlage: 'gesetz',
    },
    {
      key: 'betrug_spam',
      name: 'Betrug oder Spam',
      erklaerung: 'Abzocke, falsche Gewinnspiele, gefälschte Konten oder massenhaft Werbung.',
      grundlage: 'gesetz',
    },
    {
      key: 'urheberrecht',
      name: 'Urheberrecht',
      erklaerung: 'Jemand nutzt Bilder, Musik oder Videos, die ihm nicht gehören.',
      grundlage: 'gesetz',
    },
    {
      key: 'falschinfo',
      name: 'Falsche Informationen',
      erklaerung: 'Absichtlich verbreitete Lügen, die anderen schaden können.',
      grundlage: 'regeln',
    },
    {
      key: 'sonstiges_recht',
      name: 'Anderer Gesetzesverstoß',
      erklaerung: 'Etwas anderes, das gegen ein Gesetz verstößt.',
      grundlage: 'gesetz',
    },
    {
      key: 'regelverstoss',
      name: 'Verstoß gegen die Regeln',
      erklaerung: 'Etwas, das gegen die Community-Richtlinien von All Media verstößt.',
      grundlage: 'regeln',
    },
  ];

  /** Nur die Schlüssel — für die Prüfung. */
  var KATEGORIE_KEYS = KATEGORIEN.map(function (k) {
    return k.key;
  });

  function kategorie(key) {
    for (var i = 0; i < KATEGORIEN.length; i++) if (KATEGORIEN[i].key === key) return KATEGORIEN[i];
    return null;
  }

  /** Der Name einer Kategorie — auch für 'problem' und unbekannte. */
  function kategorieName(key) {
    if (key === 'problem') return 'Problem';
    var k = kategorie(key);
    return k ? k.name : 'Sonstiges';
  }

  /* ------------------------------------------------------------------ */
  /* Prüfung der Eingabe — gleich wie inhalt_melden() in Schema 102      */
  /* ------------------------------------------------------------------ */

  /** Mindestlänge der Begründung (Art. 16 Abs. 2 a DSA). */
  var MIN_BEGRUENDUNG = 10;
  /** Mindestlänge der Begründung einer Entscheidung (Art. 17 Abs. 3). */
  var MIN_ENTSCHEIDUNG = 20;
  /** Was die Datenbank höchstens aufhebt (left(begr, 4000)). */
  var MAX_BEGRUENDUNG = 4000;

  /*
   * Postgres `btrim(x)` schneidet nur LEERZEICHEN ab, keine Zeilenumbrüche,
   * und `length()` zählt Zeichen, nicht UTF-16-Einheiten. JavaScripts
   * `trim()` und `.length` täten beides anders — ein Emoji zählte doppelt,
   * und ein Text, den die Datenbank annimmt, würde im Blatt abgelehnt.
   */
  function btrim(text) {
    return String(text == null ? '' : text).replace(/^ +| +$/g, '');
  }
  function zeichen(text) {
    return Array.from(String(text == null ? '' : text)).length;
  }

  /**
   * Prüft eine Meldung wie die SQL-Funktion. Gibt null zurück, wenn sie
   * durchgeht, sonst den `grund` — dieselben Werte, die inhalt_melden()
   * liefert (art, kategorie, begruendung, gutglaeubig, ziel).
   *
   * eingabe: { art, ziel, kategorie, begruendung, gutglaeubig }
   */
  function pruefen(eingabe) {
    var e = eingabe || {};
    var art = e.art;
    if (!art || ARTEN.indexOf(art) < 0) return 'art';
    var kat = art === 'problem' ? 'problem' : e.kategorie;
    if (art !== 'problem' && (!kat || KATEGORIE_KEYS.indexOf(kat) < 0)) return 'kategorie';
    if (kat !== 'kindesmissbrauch' && zeichen(btrim(e.begruendung)) < MIN_BEGRUENDUNG) return 'begruendung';
    if (art !== 'problem' && e.gutglaeubig !== true) return 'gutglaeubig';
    if (art !== 'problem' && !e.ziel) return 'ziel';
    return null;
  }

  /** Wie viele Zeichen noch fehlen — für die Zeile unter dem Textfeld. */
  function nochZeichen(begruendung, kat) {
    if (kat === 'kindesmissbrauch') return 0;
    return Math.max(0, MIN_BEGRUENDUNG - zeichen(btrim(begruendung)));
  }

  /** Was unter dem Textfeld steht. */
  function zaehlerText(begruendung, kat) {
    if (kat === 'kindesmissbrauch') return 'Freiwillig. Beschreib das Material bitte nicht.';
    var n = nochZeichen(begruendung, kat);
    if (n === 0) return 'Danke, das reicht.';
    return n === 1 ? 'Noch 1 Zeichen' : 'Noch ' + n + ' Zeichen';
  }

  /*
   * Die Begründung für den alten Weg (ohne Schema 102): die alte Tabelle hat
   * nur `reason`. Die Kategorie steht vorne, damit der Betreiber sie im
   * Dashboard sieht; der Beleg (Klartext einer gemeldeten Nachricht) hinten
   * — der Meldende gibt ihn mit der Meldung frei.
   */
  function alterGrund(eingabe) {
    var e = eingabe || {};
    var teile = ['[' + (e.art === 'problem' ? 'problem' : e.kategorie || 'regelverstoss') + ']', btrim(e.begruendung)];
    if (e.beleg && e.beleg.text) teile.push('| Gemeldeter Text: ' + String(e.beleg.text).slice(0, 2000));
    return teile.join(' ').slice(0, MAX_BEGRUENDUNG);
  }

  /** Geht diese Art den alten Weg, wenn Schema 102 fehlt? */
  function alterWegMoeglich(art) {
    return ALTE_ARTEN.indexOf(art) >= 0;
  }

  /**
   * Fehlt die Funktion in der Datenbank? (Schema 102 nicht eingespielt.)
   *
   * PGRST202 = PostgREST findet die GERUFENE Funktion nicht im Schema-Cache
   * — das betrifft immer die Funktion selbst. 42883 (undefined_function)
   * dagegen entsteht auch, wenn eine Hilfsfunktion IM RUMPF fehlt (etwa eine
   * geänderte Signatur von beitrag_sichtbar). Dann ist Schema 102 sehr wohl
   * da, und der stille alte Weg würde einen echten Fehler verschlucken
   * (Gate 2, Fund 28). Deshalb zählt 42883 nur, wenn der Fehlertext die
   * gerufene Funktion selbst nennt.
   *
   * funktion: Name der gerufenen Funktion (Vorgabe 'inhalt_melden').
   */
  function fehltFunktion(fehler, funktion) {
    if (!fehler) return false;
    var code = String(fehler.code || '');
    if (code === 'PGRST202') return true;
    var name = String(funktion || 'inhalt_melden').replace(/[^a-z0-9_]/gi, '');
    var text = String(fehler.message || '');
    var nennt = new RegExp('function\\s+(public\\.)?' + name + '(?![A-Za-z0-9_])', 'i').test(text);
    if (code === '42883') return nennt;
    if (code) return false;
    return nennt && /does not exist|Could not find the function/i.test(text);
  }

  /* ------------------------------------------------------------------ */
  /* Sätze                                                               */
  /* ------------------------------------------------------------------ */

  /** Ein Satz für jeden `grund` aus den Funktionen von Schema 102. */
  var GRUND = {
    // inhalt_melden
    nicht_angemeldet: 'Dafür musst du angemeldet sein.',
    art: 'Das lässt sich nicht melden.',
    kategorie: 'Bitte wähle aus, worum es geht.',
    begruendung: 'Bitte schreib in mindestens 10 Zeichen, was los ist.',
    gutglaeubig: 'Bitte bestätige, dass du nach bestem Wissen und Gewissen meldest.',
    ziel: 'Das gibt es nicht mehr, oder du kannst es nicht sehen.',
    selbst: 'Eigene Inhalte kannst du nicht melden.',
    zu_viele: 'Du hast in der letzten Stunde schon sehr viel gemeldet. Versuch es später noch einmal.',
    // entscheidung_widersprechen
    meldung: 'Diese Entscheidung gibt es nicht mehr.',
    frist: 'Die Frist von sechs Monaten ist abgelaufen.',
    schon: 'Du hast hier schon widersprochen.',
    // Moderation
    schon_entschieden: 'Über diese Meldung ist schon entschieden.',
    befangen: 'Du bist selbst beteiligt — das muss jemand anderes entscheiden.',
    massnahme: 'Diese Maßnahme passt hier nicht.',
    grundlage: 'Bitte wähle die passende Grundlage: Gesetz oder Community-Richtlinien. Bei Missbrauch von Kindern ist es immer das Gesetz.',
    // Art. 17 Abs. 3 d DSA: bei Rechtsverstoß die Vorschrift nennen (Fund 11).
    norm: 'Bitte nenne die Vorschrift, gegen die der Inhalt verstößt — mit „§" oder „Art.", z. B. „§ 130 StGB".',
    // Art. 17 Abs. 3 e DSA: die konkrete Klausel der Richtlinien (Fund 8).
    klausel: 'Bitte wähle den Abschnitt der Community-Richtlinien, gegen den der Inhalt verstößt.',
    // Kindesmissbrauch: Kontosperre erst nach Bestätigung (Fund 5).
    bestaetigung: 'Kontosperre erst nach Bestätigung: Bitte trag ein, wer den Verdacht bestätigt hat und wann (mindestens 10 Zeichen).',
    vorlage: 'Diese Vorlage passt nur, wenn der Inhalt entfernt wird. Bitte schreib eine eigene Begründung.',
    // Befristete Sperre (Fund 19).
    sperre_dauer: 'Ohne Enddatum nur bei Missbrauch von Kindern oder Gewalt und Drohung. Bitte wähle eine Dauer.',
    ziel_weg: 'Der Inhalt ist schon entfernt oder gelöscht — es gibt nichts mehr zu entfernen. Bitte wähle eine andere Maßnahme.',
    zurueckstellen: 'Zurückstellen geht nur bei Missbrauch von Kindern oder Gewalt und Drohung, und nur wenn etwas entfernt oder gesperrt wird.',
    // Art. 18 DSA (Fund 6).
    vermerk: 'Bitte trag das Aktenzeichen oder das Datum der Meldung an das BKA ein (mindestens 5 Zeichen).',
    art18: 'Vor der Kontosperre bitte zuerst vermerken, dass das BKA informiert ist (Art. 18 DSA).',
    // Zweitprüfung des Widerspruchs (Fund 13).
    zweitpruefung: 'Du hast die Entscheidung selbst getroffen — den Widerspruch muss jemand anderes prüfen.',
    // Medienvorschau (Fund 7).
    medium: 'Die Datei lässt sich nicht anzeigen — die Meldung ist schon entschieden, die Datei gelöscht oder nicht freigegeben.',
    verborgen: 'Bei Missbrauch von Kindern wird nichts angezeigt.',
    kein_konto: 'Zu dieser Meldung gibt es kein Konto, das sich sperren ließe.',
    beschwerde: 'Über diesen Widerspruch ist schon entschieden.',
    ergebnis: 'Bitte wähle: aufheben oder bestätigen.',
    begruendung_entscheidung: 'Die Begründung braucht mindestens 20 Zeichen: welche Tatsachen, welche Regel.',
    nicht_erlaubt: 'Das dürfen nur Moderatoren.',
    // Weg
    update: 'Das kommt mit dem nächsten Update.',
    netz: 'Keine Verbindung. Versuch es noch einmal.',
  };

  /** Der Satz zu einem `grund`, nie leer. */
  function grundText(grund) {
    return GRUND[grund] || 'Das hat nicht geklappt. Versuch es noch einmal.';
  }

  /** Was gesagt wird, wenn eine Art ohne Schema 102 noch nicht geht. */
  function updateText(art) {
    if (art === 'problem') return 'Problem melden kommt mit dem nächsten Update. Bis dahin wird hier nichts gespeichert.';
    return (ART_NAME[art] || 'Das') + ' melden kommt mit dem nächsten Update.';
  }

  /** Eingangsbestätigung im Blatt (Art. 16 Abs. 4 DSA). */
  var EINGANG = {
    meldung: 'Danke, deine Meldung ist angekommen. Wir prüfen sie und sagen dir, was wir entschieden haben. Den Stand siehst du unter Einstellungen → Meine Meldungen.',
    problem: 'Danke, deine Nachricht ist angekommen. Wir melden uns in der App, sobald wir sie bearbeitet haben.',
    // Ohne Schema 102: gespeichert ja, Stand noch nicht abrufbar.
    alterWeg: 'Danke, deine Meldung ist angekommen. Wir prüfen sie. Den Stand kannst du nach dem nächsten Update unter Einstellungen → Meine Meldungen sehen.',
  };

  function eingangText(art, alterWeg) {
    if (alterWeg) return EINGANG.alterWeg;
    return art === 'problem' ? EINGANG.problem : EINGANG.meldung;
  }

  /** Das Häkchen (Art. 16 Abs. 2 d DSA) — nie vorausgefüllt. */
  var GUTGLAEUBIG = 'Ich melde nach bestem Wissen und Gewissen.';

  /** Bei Nachrichten: was mit der Meldung mitgeht (Fernmeldegeheimnis). */
  var NACHRICHT_HINWEIS =
    'Mit der Meldung bekommen wir den Text genau dieser einen Nachricht. Andere Nachrichten aus dem Chat sehen wir nicht.';

  /*
   * Kindesmissbrauch. Wer so etwas sieht, soll es NICHT beschreiben, nicht
   * weiterleiten und nicht speichern (Besitz und Verbreitung sind strafbar,
   * § 184b StGB — auch „als Beweis"). Die Datenbank gibt den Beleg dieser
   * Kategorie an Moderatoren nicht heraus (meldungen_liste, Schema 102).
   */
  var BESCHWERDESTELLE = 'https://www.internet-beschwerdestelle.de';
  var HINWEIS_KINDESMISSBRAUCH = {
    titel: 'Wichtig',
    punkte: [
      'Beschreib den Inhalt nicht. Die Auswahl reicht uns.',
      'Leite ihn nicht weiter und speichere ihn nicht, auch nicht als Beweis — das ist selbst strafbar.',
      'Du kannst ihn zusätzlich bei der Internet-Beschwerdestelle melden: ' + BESCHWERDESTELLE,
      'Ist ein Kind gerade in Gefahr? Ruf sofort die Polizei: 110.',
    ],
    link: BESCHWERDESTELLE,
    notruf: '110',
  };

  /* Selbstverletzung: Hilfe zuerst, dann die Meldung. Beide kostenlos und anonym. */
  var HINWEIS_SELBSTVERLETZUNG = {
    titel: 'Du bist nicht allein',
    punkte: [
      'Telefonseelsorge, Tag und Nacht, kostenlos: 0800 111 0 111',
      'Nummer gegen Kummer für Kinder und Jugendliche: 116 111',
      'Ist jemand gerade in Gefahr? Ruf 112 oder 110.',
    ],
    telefonseelsorge: '0800 111 0 111',
    kummer: '116 111',
  };

  /** Der Hinweis, der zu einer Kategorie gehört — oder null. */
  function hinweisFuer(kat) {
    if (kat === 'kindesmissbrauch') return HINWEIS_KINDESMISSBRAUCH;
    if (kat === 'selbstverletzung') return HINWEIS_SELBSTVERLETZUNG;
    return null;
  }

  /** Überschrift des Blatts. */
  function titel(art) {
    if (art === 'problem') return 'Problem melden';
    return (ART_NAME[art] || 'Inhalt') + ' melden';
  }

  /** Platzhalter im Textfeld. */
  function platzhalter(art, kat) {
    if (art === 'problem') return 'Was ist passiert? Wo in der App?';
    if (kat === 'kindesmissbrauch') return 'Freiwillig — bitte nichts beschreiben';
    return 'Was ist daran nicht in Ordnung?';
  }

  /* ------------------------------------------------------------------ */
  /* Stand und Entscheidungen                                            */
  /* ------------------------------------------------------------------ */

  /** Maßnahmen (reports_massnahme_check) mit Namen für Moderatoren. */
  var MASSNAHMEN = [
    { key: 'keine', name: 'Nichts tun' },
    { key: 'warnen', name: 'Verwarnen' },
    { key: 'entfernen', name: 'Inhalt entfernen' },
    { key: 'sperren', name: 'Konto sperren' },
    { key: 'entfernen_sperren', name: 'Entfernen und sperren' },
  ];

  function massnahmeName(key) {
    for (var i = 0; i < MASSNAHMEN.length; i++) if (MASSNAHMEN[i].key === key) return MASSNAHMEN[i].name;
    return '';
  }

  /** Was eine Maßnahme für den Betroffenen heißt — wie massnahme_text() in SQL. */
  function massnahmeText(key, sperreBis) {
    var bis = sperreBis ? ' bis ' + datum(sperreBis) : ' ohne Enddatum';
    switch (key) {
      case 'keine':
        return 'Wir haben nichts entfernt und nichts gesperrt';
      case 'warnen':
        return 'Du bekommst eine Verwarnung; bei weiteren Verstößen kann dein Konto gesperrt werden';
      case 'entfernen':
        return 'Der Inhalt wurde entfernt';
      case 'sperren':
        return 'Das Konto wurde gesperrt' + bis;
      case 'entfernen_sperren':
        return 'Der Inhalt wurde entfernt und das Konto gesperrt' + bis;
      default:
        return '';
    }
  }

  /** Stand einer eigenen Meldung in einem Wort. */
  function statusText(status) {
    if (status === 'eingegangen') return 'In Prüfung';
    if (status === 'entschieden') return 'Entschieden';
    if (status === 'erledigt') return 'Erledigt';
    return 'Unbekannt';
  }

  function grundlageText(g) {
    if (g === 'gesetz') return 'Verstoß gegen geltendes Recht';
    if (g === 'regeln') return 'Verstoß gegen die Community-Richtlinien';
    return '';
  }

  /** TT.MM.JJJJ in deutscher Zeit — ohne Intl-Abhängigkeit (Hermes). */
  function datum(wert) {
    var d = wert instanceof Date ? wert : new Date(wert);
    if (isNaN(d.getTime())) return '';
    var t = String(d.getDate()).padStart(2, '0');
    var m = String(d.getMonth() + 1).padStart(2, '0');
    return t + '.' + m + '.' + d.getFullYear();
  }

  /** Kann man noch widersprechen? (sechs Monate, Art. 20) */
  function widerspruchOffen(widerspruchBis, jetzt) {
    if (!widerspruchBis) return false;
    var bis = new Date(widerspruchBis).getTime();
    var n = jetzt ? new Date(jetzt).getTime() : Date.now();
    return !isNaN(bis) && n < bis;
  }

  function beschwerdeText(status) {
    if (status === 'offen') return 'Dein Widerspruch wird geprüft.';
    if (status === 'aufgehoben') return 'Dein Widerspruch war erfolgreich: die Entscheidung ist aufgehoben.';
    if (status === 'bestaetigt') return 'Dein Widerspruch wurde geprüft: die Entscheidung bleibt.';
    return '';
  }

  /** Leertexte. */
  var LEER = {
    meine: 'Du hast noch nichts gemeldet.',
    kontostatus: 'Alles in Ordnung: Es gibt keine Entscheidung gegen deine Inhalte oder dein Konto.',
    moderation: 'Keine offenen Meldungen.',
    beschwerden: 'Keine offenen Widersprüche.',
  };

  /** Ohne Schema 102: was statt einer leeren Liste dasteht. */
  var OHNE_SCHEMA = {
    meine: 'Die Liste deiner Meldungen kommt mit dem nächsten Update. Deine Meldungen sind trotzdem bei uns angekommen.',
    kontostatus: 'Der Kontostatus kommt mit dem nächsten Update.',
    moderation: 'Der Moderationsbereich braucht das nächste Datenbank-Update (Schema 102).',
  };

  var WIDERSPRUCH = {
    knopf: 'Widersprechen',
    platzhalter: 'Warum ist die Entscheidung falsch? (freiwillig)',
    gesendet: 'Dein Widerspruch ist angekommen. Ein Mensch prüft die Entscheidung noch einmal.',
    fristText: function (bis) {
      return 'Widerspruch möglich bis ' + datum(bis);
    },
    abgelaufen: 'Die Frist für einen Widerspruch ist abgelaufen.',
    weitere:
      'Du kannst dich außerdem an eine zertifizierte außergerichtliche Streitbeilegungsstelle oder an ein Gericht wenden.',
  };

  /* ------------------------------------------------------------------ */
  /* Moderation                                                          */
  /* ------------------------------------------------------------------ */

  /*
   * Art. 18 DSA: Verdacht auf eine Straftat mit Gefahr für Leben oder
   * Sicherheit → unverzüglich die Strafverfolgung informieren, in Deutschland
   * das BKA (u-entrance). Eine Meldung an die Internet-Beschwerdestelle
   * erfüllt die Pflicht NICHT, sie kommt höchstens dazu (Gate 2, Fund 6).
   * Der Vermerk landet über art18_vermerken() im Moderationsprotokoll.
   * Selbstverletzung ist bewusst kein Pflichtfall.
   */
  var BKA = 'https://u-entrance.bka.de';
  var ART18_KATEGORIEN = ['kindesmissbrauch', 'gewalt_drohung'];
  function art18Pflicht(kat) {
    return ART18_KATEGORIEN.indexOf(kat) >= 0;
  }
  var ART18 = {
    titel: 'Art. 18 DSA: BKA informieren (Pflicht)',
    punkte: [
      'Besteht der Verdacht einer Straftat mit Gefahr für Leben oder Sicherheit, unverzüglich das BKA informieren: ' + BKA,
      'Zusätzlich kann die Internet-Beschwerdestelle informiert werden (' + BESCHWERDESTELLE + ') — das ersetzt die Meldung an das BKA nicht.',
      'Bei akuter Gefahr sofort die Polizei: 110.',
    ],
    link: BKA,
    label: 'BKA informiert (u-entrance) — Aktenzeichen oder Datum',
    platzhalter: 'z. B. „u-entrance, 31.10.2026, Vorgang 12345"',
    knopf: 'Vermerken',
    vermerkt: 'BKA-Meldung ist im Protokoll vermerkt (Art. 18 DSA).',
    offen: 'Art. 18 offen',
    gespeichert: 'Vermerkt. Das Protokoll hält fest, dass das BKA informiert ist.',
  };
  var MIN_VERMERK = 5;

  /*
   * Ablauf bei Kindesmissbrauch für Moderatoren (Gate 2, Fund 5 und 17).
   * Der Beleg ist verborgen (beleg_verborgen) — niemand soll das Material
   * öffnen. Deshalb zweistufig: Entfernen sofort, Kontosperre erst, wenn
   * jemand den Verdacht bestätigt hat (meldung_entscheiden prüft p_bestaetigt).
   */
  var ABLAUF_VERBORGEN = [
    'Den Beleg nicht öffnen, nicht herunterladen, nicht speichern.',
    'Verdacht noch nicht bestätigt: nur „Inhalt entfernen" (Grundlage Gesetz). Das Konto bleibt vorerst frei.',
    'Pflicht nach Art. 18 DSA: das BKA informieren (' + BKA + ') und Aktenzeichen oder Datum hier vermerken. Zusätzlich kann die Internet-Beschwerdestelle informiert werden (' + BESCHWERDESTELLE + ').',
    'Verdacht bestätigt (volljährige, geschulte Person, Meldestelle oder BKA): „Entfernen und sperren" und im Feld „Bestätigt durch" eintragen, wer bestätigt hat und wann.',
    'Nach „Inhalt entfernen" ist diese Meldung abgeschlossen; eine spätere Sperre braucht eine neue Meldung zum Profil.',
    'Bei Gefahr für ein Kind sofort die Polizei (110) informieren.',
  ];

  /** Das Feld „Bestätigt durch" (p_bestaetigt, mindestens 10 Zeichen wie in SQL). */
  var BESTAETIGUNG = {
    label: 'Verdacht bestätigt durch (Pflicht vor der Kontosperre)',
    platzhalter: 'Wer hat bestätigt und wann? z. B. „Sichtung durch geschulte Person, 31.10.2026"',
  };
  var MIN_BESTAETIGUNG = 10;

  /*
   * Begründung zurückstellen (Gate 2, Fund 17): würde die Mitteilung an den
   * Betroffenen Ermittlungen gefährden (das BKA bittet darum), bleibt sie
   * liegen, bis ein Moderator sie nachsendet. Bis dahin sieht der Betroffene
   * die Entscheidung auch nicht im Kontostatus (Schema 102).
   */
  var ZURUECK = {
    label: 'Begründung an die betroffene Person zurückstellen (Ermittlungen)',
    hinweis: 'Nur, wenn die Strafverfolgung darum bittet. Die Mitteilung wartet, bis du sie unter „Entschieden“ nachsendest; erst dann beginnt die Widerspruchsfrist.',
    liste: 'Begründung zurückgestellt',
    knopf: 'Begründung jetzt senden',
    gesendet: 'Begründung gesendet.',
  };

  /* Kindesmissbrauch, zweite Stufe: Inhalt ist entfernt, Sperre nach Bestätigung (Fund 5). */
  var NACHTRAG = {
    titel: 'Konto sperren, wenn der Verdacht bestätigt ist',
    begruendung: 'Begründung der Sperre (mit Vorschrift, mindestens 20 Zeichen)',
    knopf: 'Konto sperren',
    gesperrt: 'Konto gesperrt.',
  };

  /*
   * Vorlagen für die Begründung je Kategorie. Der Moderator ergänzt die
   * Tatsachen; die Vorlage nennt die Regel (Art. 17 Abs. 3 c/d DSA).
   */
  var VORLAGEN = {
    // Kein Wort über Behörden: der Satz geht an die verdächtige Person (Fund 17).
    kindesmissbrauch: 'Der Inhalt steht im Verdacht, sexuellen Missbrauch von Kindern darzustellen (§ 184b StGB). Er wurde deshalb entfernt.',
    gewalt_drohung: 'Der Inhalt droht anderen mit Gewalt bzw. ruft dazu auf (§§ 241, 111 StGB). Konkret: ',
    selbstverletzung: 'Der Inhalt zeigt oder fördert Selbstverletzung; das erlauben die Community-Richtlinien nicht. Konkret: ',
    hass: 'Der Inhalt greift Menschen wegen ihrer Herkunft, Religion oder einer anderen Gruppenzugehörigkeit an (§ 130 StGB bzw. Community-Richtlinien „Kein Hass"). Konkret: ',
    mobbing: 'Der Inhalt beleidigt oder stellt eine Person bloß; das verstößt gegen die Community-Richtlinien. Konkret: ',
    sexuell: 'Der Inhalt zeigt Nacktheit oder sexuelle Handlungen; das erlauben die Community-Richtlinien nicht. Konkret: ',
    jugendgefaehrdend: 'Der Inhalt kann Kinder und Jugendliche gefährden (Jugendschutz). Konkret: ',
    privatsphaere: 'Der Inhalt zeigt private Daten oder Bilder einer Person ohne ihre Einwilligung. Konkret: ',
    betrug_spam: 'Der Inhalt dient dem Betrug bzw. ist massenhafte Werbung. Konkret: ',
    urheberrecht: 'Der Inhalt verwendet fremdes, geschütztes Material ohne Erlaubnis (UrhG). Konkret: ',
    falschinfo: 'Der Inhalt verbreitet nachweislich falsche Behauptungen, die anderen schaden können. Konkret: ',
    sonstiges_recht: 'Der Inhalt verstößt gegen geltendes Recht, nämlich: ',
    regelverstoss: 'Der Inhalt verstößt gegen die Community-Richtlinien, nämlich: ',
    problem: 'Danke für deinen Hinweis. ',
  };

  function vorlage(kat) {
    return VORLAGEN[kat] || VORLAGEN.regelverstoss;
  }

  /** Entfernt diese Maßnahme den Inhalt? */
  function entfernt(massnahme) {
    return massnahme === 'entfernen' || massnahme === 'entfernen_sperren';
  }
  /** Sperrt diese Maßnahme das Konto? */
  function sperrt(massnahme) {
    return massnahme === 'sperren' || massnahme === 'entfernen_sperren';
  }

  /**
   * Die Vorlage für eine Kategorie UND eine Maßnahme. Bei Kindesmissbrauch
   * gibt es sie nur, wenn der Inhalt entfernt wird — sonst behauptete sie
   * eine Entfernung, die nicht stattfindet (Gate 2, Fund 17).
   */
  function vorlageFuer(kat, massnahme) {
    if (kat === 'kindesmissbrauch') return entfernt(massnahme) ? VORLAGEN.kindesmissbrauch : '';
    return vorlage(kat);
  }

  /* ------------------------------------------------------------------ */
  /* Rechtsgrundlage: Vorschrift und Klausel (Art. 17 Abs. 3 d/e DSA)    */
  /* ------------------------------------------------------------------ */

  /*
   * Die Abschnitte der Community-Richtlinien (gemeinsam/rechtstexte.js,
   * community_richtlinien) — Nummer = Stelle in der Liste. Der Einheitstest
   * vergleicht Nummer und Titel mit rechtstexte.js; wer dort einen Abschnitt
   * einschiebt, sieht es sofort.
   */
  var RICHTLINIEN_ABSCHNITTE = [
    { nr: 1, titel: 'Worum es geht' },
    { nr: 2, titel: 'Kinder schützen' },
    { nr: 3, titel: 'Gewalt und Drohungen' },
    { nr: 4, titel: 'Hass' },
    { nr: 5, titel: 'Mobbing und Belästigung' },
    { nr: 6, titel: 'Sexuelle Inhalte' },
    { nr: 7, titel: 'Selbstverletzung' },
    { nr: 8, titel: 'Betrug und Spam' },
    { nr: 9, titel: 'Rechte anderer' },
    { nr: 10, titel: 'Jugendgefährdende Inhalte' },
    { nr: 11, titel: 'Falschinformationen' },
    { nr: 12, titel: 'Was wir tun' },
    { nr: 13, titel: 'Hilfe' },
  ];
  /** Was als verletzte Regel taugt: die Verbots-Abschnitte 2–11. */
  var KLAUSELN = RICHTLINIEN_ABSCHNITTE.filter(function (a) {
    return a.nr >= 2 && a.nr <= 11;
  });
  /** Die Klausel je Kategorie; null = der Moderator wählt selbst. */
  var KLAUSEL_JE_KATEGORIE = {
    kindesmissbrauch: 2,
    gewalt_drohung: 3,
    hass: 4,
    mobbing: 5,
    sexuell: 6,
    selbstverletzung: 7,
    betrug_spam: 8,
    privatsphaere: 9,
    urheberrecht: 9,
    jugendgefaehrdend: 10,
    falschinfo: 11,
    sonstiges_recht: null,
    regelverstoss: null,
  };

  function klausel(nr) {
    var n = Number(nr);
    for (var i = 0; i < KLAUSELN.length; i++) if (KLAUSELN[i].nr === n) return KLAUSELN[i];
    return null;
  }
  function klauselFuer(kat) {
    return klausel(KLAUSEL_JE_KATEGORIE[kat]);
  }
  /** „Community-Richtlinien, Abschnitt 4 „Hass"" — so steht es in der Begründung. */
  function klauselText(nr) {
    var k = klausel(nr);
    return k ? 'Community-Richtlinien, Abschnitt ' + k.nr + ' „' + k.titel + '“' : '';
  }

  /** Vorschläge für das Feld „Vorschrift" — nur als Platzhalter, nie vorausgefüllt (außer Kindesmissbrauch). */
  var NORM_VORSCHLAG = {
    kindesmissbrauch: '§ 184b StGB',
    gewalt_drohung: '§ 241 StGB',
    hass: '§ 130 StGB',
    jugendgefaehrdend: '§ 4 JMStV',
    privatsphaere: '§ 201a StGB',
    betrug_spam: '§ 263 StGB',
    urheberrecht: '§ 97 UrhG',
  };
  var NORM = {
    label: 'Vorschrift (Pflicht bei Grundlage Gesetz)',
    platzhalter: function (kat) {
      return 'z. B. ' + (NORM_VORSCHLAG[kat] || '§ 130 StGB');
    },
  };
  /** Wie meldung_entscheiden() prüft: „§" oder „Art." muss drinstehen. */
  function normGueltig(norm) {
    return /(§|Art\.)/.test(String(norm || ''));
  }

  /**
   * Die Begründung, wie sie an beide Seiten geht: der Text des Moderators,
   * dahinter die Grundlage in Klammern — Vorschrift bei Gesetz, Abschnitt der
   * Richtlinien bei Regeln. Die Datenbank hängt den Schlusspunkt an.
   */
  function begruendungMitGrundlage(e) {
    var x = e || {};
    var begr = btrim(x.begruendung).replace(/[ .]+$/, '');
    if (x.massnahme === 'keine' || x.art === 'problem') return btrim(x.begruendung);
    var zusatz = '';
    if (x.grundlage === 'gesetz' && btrim(x.norm)) {
      if (begr.indexOf(btrim(x.norm)) < 0) zusatz = ' (Vorschrift: ' + btrim(x.norm) + ')';
    } else if (x.grundlage === 'regeln' && klausel(x.klausel)) {
      zusatz = ' (' + klauselText(x.klausel) + ')';
    }
    return (begr + zusatz).slice(0, MAX_BEGRUENDUNG);
  }

  /*
   * Prüft eine Entscheidung wie meldung_entscheiden() (Schema 102), in
   * derselben Reihenfolge: Maßnahme bekannt, Begründung ≥ 20 Zeichen (außer
   * bei „problem"), Grundlage, wenn etwas passiert, Vorschrift bei Gesetz,
   * Sperren nur mit Konto, Kindesmissbrauch nur Gesetz und Sperre nur nach
   * Bestätigung, Sperre ohne Enddatum nur in schweren Fällen, Entfernen
   * nicht bei einem Profil.
   *
   * Dazu zwei Regeln, die nur die Oberfläche kennt: bei Community-
   * Richtlinien die Klausel (Fund 8) und vor einer Kontosperre in den
   * Art.-18-Fällen der BKA-Vermerk (Fund 6).
   *
   * e: { art, kategorie, massnahme, begruendung, grundlage, norm, klausel,
   *      zielProfil, bestaetigt, sperreTage, art18 }
   *
   * Felder, die der Aufrufer gar nicht mitgibt (undefined), prüft sie nicht —
   * so bleibt sie für ältere Aufrufer gleich.
   */
  function entscheidungPruefen(e) {
    var x = e || {};
    if (x.art === 'problem') return null;
    var keys = MASSNAHMEN.map(function (m) {
      return m.key;
    });
    var m = x.massnahme;
    if (keys.indexOf(m) < 0) return 'massnahme';
    if (zeichen(btrim(x.begruendung)) < MIN_ENTSCHEIDUNG) return 'begruendung_entscheidung';
    if (m !== 'keine' && x.grundlage !== 'gesetz' && x.grundlage !== 'regeln') return 'grundlage';
    if (m !== 'keine' && x.grundlage === 'gesetz' && x.norm !== undefined && !normGueltig(x.norm)) return 'norm';
    if (m !== 'keine' && x.grundlage === 'regeln' && x.klausel !== undefined && !klausel(x.klausel)) return 'klausel';
    if (sperrt(m) && !x.zielProfil) return 'kein_konto';
    if (x.kategorie === 'kindesmissbrauch' && m !== 'keine' && x.grundlage !== 'gesetz') return 'grundlage';
    if (x.kategorie === 'kindesmissbrauch' && sperrt(m) && zeichen(btrim(x.bestaetigt)) < MIN_BESTAETIGUNG) return 'bestaetigung';
    if (x.kategorie === 'kindesmissbrauch' && !entfernt(m) && btrim(x.begruendung).indexOf(VORLAGEN.kindesmissbrauch) >= 0) return 'vorlage';
    if (sperrt(m) && x.kategorie !== undefined && !(Number(x.sperreTage) > 0) && !sperreOhneEndeErlaubt(x.kategorie)) return 'sperre_dauer';
    if (entfernt(m) && x.art === 'user') return 'massnahme';
    if (sperrt(m) && art18Pflicht(x.kategorie) && x.art18 !== undefined && !x.art18) return 'art18';
    return null;
  }

  /** Sperre ohne Enddatum nur in schweren Fällen (Schema 102, Fund 19). */
  function sperreOhneEndeErlaubt(kat) {
    return kat === 'kindesmissbrauch' || kat === 'gewalt_drohung';
  }

  /** Welche Maßnahmen zu einer Art passen (Profil: nichts zu entfernen). */
  function massnahmenFuer(art) {
    return MASSNAHMEN.filter(function (m) {
      return !(art === 'user' && (m.key === 'entfernen' || m.key === 'entfernen_sperren'));
    });
  }

  /** Dringend = oben in der Liste (wie die Sortierung in meldungen_liste). */
  function dringlichkeit(kat) {
    if (kat === 'kindesmissbrauch') return 0;
    if (kat === 'gewalt_drohung' || kat === 'selbstverletzung') return 1;
    return 2;
  }

  /** Sperrdauern zur Auswahl (Tage; null = ohne Enddatum). */
  var SPERRDAUERN = [
    { tage: 1, name: '1 Tag' },
    { tage: 7, name: '7 Tage' },
    { tage: 30, name: '30 Tage' },
    { tage: 365, name: '1 Jahr' },
    { tage: null, name: 'Ohne Enddatum' },
  ];

  /** Die Dauern, die zu einer Kategorie passen — „Ohne Enddatum" nur in schweren Fällen. */
  function sperrdauernFuer(kat) {
    return SPERRDAUERN.filter(function (s) {
      return s.tage !== null || sperreOhneEndeErlaubt(kat);
    });
  }

  /*
   * Medienvorschau für Moderatoren (Gate 2, Fund 7): nur hinter einem Klick,
   * nur für offene Meldungen, nie bei Kindesmissbrauch. Die Adresse gilt fünf
   * Minuten (web/server/app.js, /api/moderation/meldungen/:id/medium).
   */
  var MEDIUM = {
    knopf: 'Inhalt anzeigen',
    hinweis: 'Öffnet die gemeldete Datei für 5 Minuten. Nicht herunterladen, nicht weitergeben.',
    sekunden: 300,
  };
  function mediumZeigbar(m) {
    var x = m || {};
    return !x.beleg_verborgen && x.kategorie !== 'kindesmissbrauch' && x.status === 'eingegangen' && !!(x.beleg && x.beleg.medium);
  }

  var BELEG = {
    echt: 'Beleg echt: der gemeldete Text ist genau so verschickt worden.',
    // Neutral (Fund 30): auch eine später bearbeitete Nachricht passt nicht mehr.
    falsch: 'Beleg passt nicht zur gespeicherten Chiffre, z. B. weil die Nachricht später bearbeitet wurde. Das allein beweist keine Fälschung.',
    ohne: 'Unverschlüsselte Nachricht: der Text lag dem Server vor.',
    keinSchluessel: 'Ohne Schlüssel gemeldet: der Text lässt sich nicht prüfen.',
  };

  return {
    ARTEN: ARTEN,
    ALTE_ARTEN: ALTE_ARTEN,
    ART_NAME: ART_NAME,
    KATEGORIEN: KATEGORIEN,
    KATEGORIE_KEYS: KATEGORIE_KEYS,
    MIN_BEGRUENDUNG: MIN_BEGRUENDUNG,
    MIN_ENTSCHEIDUNG: MIN_ENTSCHEIDUNG,
    MAX_BEGRUENDUNG: MAX_BEGRUENDUNG,
    GRUND: GRUND,
    EINGANG: EINGANG,
    GUTGLAEUBIG: GUTGLAEUBIG,
    NACHRICHT_HINWEIS: NACHRICHT_HINWEIS,
    BESCHWERDESTELLE: BESCHWERDESTELLE,
    HINWEIS_KINDESMISSBRAUCH: HINWEIS_KINDESMISSBRAUCH,
    HINWEIS_SELBSTVERLETZUNG: HINWEIS_SELBSTVERLETZUNG,
    MASSNAHMEN: MASSNAHMEN,
    LEER: LEER,
    OHNE_SCHEMA: OHNE_SCHEMA,
    WIDERSPRUCH: WIDERSPRUCH,
    ABLAUF_VERBORGEN: ABLAUF_VERBORGEN,
    VORLAGEN: VORLAGEN,
    SPERRDAUERN: SPERRDAUERN,
    BELEG: BELEG,
    BKA: BKA,
    ART18: ART18,
    ART18_KATEGORIEN: ART18_KATEGORIEN,
    MIN_VERMERK: MIN_VERMERK,
    BESTAETIGUNG: BESTAETIGUNG,
    ZURUECK: ZURUECK,
    NACHTRAG: NACHTRAG,
    MIN_BESTAETIGUNG: MIN_BESTAETIGUNG,
    RICHTLINIEN_ABSCHNITTE: RICHTLINIEN_ABSCHNITTE,
    KLAUSELN: KLAUSELN,
    KLAUSEL_JE_KATEGORIE: KLAUSEL_JE_KATEGORIE,
    NORM: NORM,
    NORM_VORSCHLAG: NORM_VORSCHLAG,
    MEDIUM: MEDIUM,
    art18Pflicht: art18Pflicht,
    entfernt: entfernt,
    sperrt: sperrt,
    vorlageFuer: vorlageFuer,
    klausel: klausel,
    klauselFuer: klauselFuer,
    klauselText: klauselText,
    normGueltig: normGueltig,
    begruendungMitGrundlage: begruendungMitGrundlage,
    sperreOhneEndeErlaubt: sperreOhneEndeErlaubt,
    sperrdauernFuer: sperrdauernFuer,
    mediumZeigbar: mediumZeigbar,
    kategorie: kategorie,
    kategorieName: kategorieName,
    btrim: btrim,
    zeichen: zeichen,
    pruefen: pruefen,
    nochZeichen: nochZeichen,
    zaehlerText: zaehlerText,
    alterGrund: alterGrund,
    alterWegMoeglich: alterWegMoeglich,
    fehltFunktion: fehltFunktion,
    grundText: grundText,
    updateText: updateText,
    eingangText: eingangText,
    hinweisFuer: hinweisFuer,
    titel: titel,
    platzhalter: platzhalter,
    massnahmeName: massnahmeName,
    massnahmeText: massnahmeText,
    statusText: statusText,
    grundlageText: grundlageText,
    datum: datum,
    widerspruchOffen: widerspruchOffen,
    beschwerdeText: beschwerdeText,
    vorlage: vorlage,
    entscheidungPruefen: entscheidungPruefen,
    massnahmenFuer: massnahmenFuer,
    dringlichkeit: dringlichkeit,
  };
});
