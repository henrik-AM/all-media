/**
 * All Media — die Felder der Seite „Profil bearbeiten“, wie App und Website
 * sie beide prüfen und anzeigen (Kasten 1.3, Nachtrag 10.10.2026).
 *
 * WARUM ES DAS GIBT
 *
 * Henrik am 10.10.2026: „deutlich mehr Freiraum“ beim Bearbeiten, „orientiere
 * dich an Instagram“. Die Seite hat jetzt Name, Benutzername, Pronomen,
 * Biografie und bis zu fünf Links. Grenzen, Texte und die Link-Regel stehen
 * hier einmal — sonst sagt die App „höchstens 30 Zeichen“ und die Website 40.
 *
 * WER DIESELBE REGEL KENNT
 *
 * SUPABASE_SCHEMA_88_profilseite.sql prüft dieselben Grenzen in der Datenbank
 * (`profil_links_gueltig`, Check auf `pronomen`). Wer hier etwas ändert,
 * ändert es dort mit.
 *
 * ALTE LESER
 *
 * `profiles.link` bleibt bestehen und ist immer die Adresse des ersten Links
 * (Schema 88 hält beide Spalten per Trigger gleich). `linksAus` liest darum
 * zuerst `links` und fällt auf `link` zurück — so zeigt ein Profil seinen Link
 * auch, solange Schema 88 noch nicht eingespielt ist.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory();
  } else {
    // Browser: als eigenes <script> eingebunden.
    global.Profilfelder = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var GRENZEN = {
    name: 40,
    pronomen: 30,
    bio: 150,
    links: 5,
    titel: 40,
    adresse: 300,
  };

  /** Alle sichtbaren Texte der Seite — App und Website sagen dasselbe. */
  var TEXTE = {
    seite: 'Profil bearbeiten',
    bildBearbeiten: 'Bild bearbeiten',
    bildWaehlen: 'Neues Bild wählen',
    bildAufnehmen: 'Foto aufnehmen',
    bildEntfernen: 'Bild entfernen',
    name: 'Name',
    benutzername: 'Benutzername',
    pronomen: 'Pronomen',
    bio: 'Biografie',
    links: 'Links',
    fertig: 'Fertig',
    abbrechen: 'Abbrechen',
    zurueck: 'Zurück',
    linkHinzufuegen: 'Link hinzufügen',
    linkLoeschen: 'Link löschen',
    adresse: 'Adresse',
    titel: 'Titel (optional)',
    adresseBeispiel: 'https://deine-seite.de',
    leer: {
      name: 'Name hinzufügen',
      benutzername: 'Benutzernamen wählen',
      pronomen: 'Pronomen hinzufügen',
      bio: 'Biografie hinzufügen',
      links: 'Links hinzufügen',
    },
    erklaerung: {
      name: 'So erscheinst du in allen drei Profilen, in Chats und in der Suche.',
      benutzername: 'Dein @-Name. Er muss frei sein; andere finden dich darüber in Videos und Communitys.',
      pronomen: 'Steht klein neben deinem Namen. Freiwillig, höchstens 30 Zeichen.',
      bio: 'Höchstens 150 Zeichen.',
      links: 'Bis zu fünf Links. Im Profil steht der erste, die übrigen hinter „und … weitere“.',
    },
    keineLinks: 'Noch keine Links.',
    linksVoll: 'Mehr als fünf Links gehen nicht.',
    linksTitel: 'Links',
    gespeichert: 'Profil gespeichert',
    eigenerName: 'Das ist dein aktueller Benutzername',
    nochNichtDa: 'Pronomen und mehrere Links gehen erst, wenn das Datenbank-Update eingespielt ist',
  };

  function text(wert) {
    return typeof wert === 'string' ? wert : wert == null ? '' : String(wert);
  }

  /** Gibt null zurück, wenn der Name passt, sonst den Grund. */
  function namePruefen(eingabe) {
    var n = text(eingabe).trim();
    if (!n) return 'Der Name darf nicht leer sein';
    if (n.length > GRENZEN.name) return 'Der Name ist zu lang (höchstens ' + GRENZEN.name + ' Zeichen)';
    return null;
  }

  function pronomenPruefen(eingabe) {
    var n = text(eingabe).trim();
    if (n.length > GRENZEN.pronomen) return 'Höchstens ' + GRENZEN.pronomen + ' Zeichen';
    if (/[\r\n]/.test(n)) return 'Pronomen stehen in einer Zeile';
    return null;
  }

  function bioPruefen(eingabe) {
    var n = text(eingabe).trim();
    if (n.length > GRENZEN.bio) return 'Die Biografie ist zu lang (höchstens ' + GRENZEN.bio + ' Zeichen)';
    return null;
  }

  /** „noch 12“ / „150/150“ — der Zähler unter dem Biografie-Feld. */
  function zaehler(eingabe, grenze) {
    return text(eingabe).length + '/' + grenze;
  }

  /**
   * Eine Adresse in ihre gespeicherte Form bringen.
   *
   * „deine-seite.de“ wird zu „https://deine-seite.de“. Was ein anderes
   * Schema trägt (javascript:, mailto:, ftp:), wird abgelehnt — ein Link im
   * Profil wird bei jedem Betrachter geöffnet.
   *
   * Gibt { url } oder { fehler } zurück.
   */
  function adresse(eingabe) {
    var roh = text(eingabe).trim();
    if (!roh) return { fehler: 'Bitte eine Adresse eingeben' };
    if (/\s/.test(roh)) return { fehler: 'Eine Adresse enthält keine Leerzeichen' };
    var mitSchema = /^[a-z][a-z0-9+.-]*:/i.test(roh);
    if (mitSchema && !/^https?:\/\//i.test(roh)) {
      return { fehler: 'Nur Adressen mit http:// oder https://' };
    }
    var url = mitSchema ? roh.replace(/^https?/i, function (s) { return s.toLowerCase(); }) : 'https://' + roh;
    if (url.length > GRENZEN.adresse) return { fehler: 'Die Adresse ist zu lang' };
    // Ein Rechnername mit mindestens einem Punkt: „https://hallo“ ist keine Seite.
    if (!/^https?:\/\/[^\s\/?#@]+\.[^\s\/?#@]+/i.test(url)) return { fehler: 'Das sieht nicht nach einer Webadresse aus' };
    return { url: url };
  }

  /**
   * Die Linkliste prüfen, wie sie gespeichert wird.
   * Gibt { links } (bereinigt) oder { fehler } zurück.
   */
  function linksPruefen(liste) {
    if (!Array.isArray(liste)) return { fehler: 'Die Links sind keine Liste' };
    var sauber = [];
    for (var i = 0; i < liste.length; i++) {
      var l = liste[i] || {};
      var titel = text(l.titel).trim();
      // Eine ganz leere Zeile (weder Adresse noch Titel) fällt still weg.
      if (!text(l.url).trim() && !titel) continue;
      var a = adresse(l.url);
      if (a.fehler) return { fehler: 'Link ' + (sauber.length + 1) + ': ' + a.fehler };
      if (titel.length > GRENZEN.titel) {
        return { fehler: 'Link ' + (sauber.length + 1) + ': Titel höchstens ' + GRENZEN.titel + ' Zeichen' };
      }
      sauber.push({ url: a.url, titel: titel });
    }
    if (sauber.length > GRENZEN.links) return { fehler: TEXTE.linksVoll };
    return { links: sauber };
  }

  /**
   * Die Links eines Profils aus einer Datenbankzeile.
   *
   * Zuerst `links` (Schema 88); fehlt die Spalte oder ist sie leer, der alte
   * Einzellink aus `link`. Nie mehr als fünf, nie eine Zeile ohne Adresse.
   */
  function linksAus(zeile) {
    var z = zeile || {};
    var roh = z.links;
    if (typeof roh === 'string') {
      try {
        roh = JSON.parse(roh);
      } catch (e) {
        roh = null;
      }
    }
    var liste = [];
    if (Array.isArray(roh)) {
      for (var i = 0; i < roh.length && liste.length < GRENZEN.links; i++) {
        var l = roh[i] || {};
        var url = text(l.url).trim();
        if (url) liste.push({ url: url, titel: text(l.titel).trim() });
      }
    }
    if (!liste.length && text(z.link).trim()) liste.push({ url: text(z.link).trim(), titel: '' });
    return liste;
  }

  /** „deine-seite.de/abc“ — die Adresse ohne Protokoll, www. und Schrägstrich am Ende. */
  function ohneProtokoll(url) {
    return text(url).replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  }

  /** Was im Profil für einen Link steht: der Titel, sonst die kurze Adresse. */
  function linkText(link) {
    var l = link || {};
    return text(l.titel).trim() || ohneProtokoll(l.url);
  }

  /** Wohin ein Link führt — mit https://, wo es fehlt (alte Einträge in `link`). */
  function linkZiel(link) {
    var url = text((link || {}).url).trim();
    if (!url) return '';
    return /^https?:\/\//i.test(url) ? url : 'https://' + url;
  }

  /** „und 1 weiterer“ / „und 3 weitere“ — leer, wenn es nur einen gibt. */
  function weitereText(anzahl) {
    var n = Math.max(0, (anzahl || 0) - 1);
    if (!n) return '';
    return n === 1 ? 'und 1 weiterer' : 'und ' + n + ' weitere';
  }

  /** Der Wert rechts in der Zeile „Links“ auf der Bearbeiten-Seite. */
  function linksZeile(links) {
    var l = Array.isArray(links) ? links : [];
    if (!l.length) return '';
    return l.length === 1 ? linkText(l[0]) : l.length + ' Links';
  }

  return {
    GRENZEN: GRENZEN,
    TEXTE: TEXTE,
    namePruefen: namePruefen,
    pronomenPruefen: pronomenPruefen,
    bioPruefen: bioPruefen,
    zaehler: zaehler,
    adresse: adresse,
    linksPruefen: linksPruefen,
    linksAus: linksAus,
    ohneProtokoll: ohneProtokoll,
    linkText: linkText,
    linkZiel: linkZiel,
    weitereText: weitereText,
    linksZeile: linksZeile,
  };
});
