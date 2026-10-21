/**
 * Community und Unterthema erstellen — eine Regel für App und Website
 * (Feedback 28.09.2026, Kästen 10.2 und 16, Schema 99).
 *
 * Henrik: „…halte dich, wenn ich auf Neues Unterthema erstellen drücke,
 * explizit an meinen Figma Prototypen." Und: „Wenn ich unter dem Plus auf
 * Community erstellen drücke, ist mir die Einstellungsseite zu kurz
 * gehalten. […] Profilbild, Unterthemen und so."
 *
 * Die Felder stehen in den Frames „CC + Unterthema erstellen" (928:13446)
 * und „CP + Kanal erstellen" (942:15097):
 *
 *   Unterthema:  Name*, Biografie, Link, „Privates Unterthema — Beitritt nur
 *                mit Einladung", Einladungslink + QR-Code, fertig
 *   Community:   Name*, Bild*, Biografie, Link, „Unterthemen erstellen",
 *                Einladungslink + QR-Code, fertig
 *
 * Ergänzt (16.2, „wenn dazu dort nichts sein sollte, schaue selbst"):
 * Öffentlich/Privat für die Community — seit Kasten 9/15 entscheidet das,
 * wer die Mitglieder sieht und ob man direkt beitritt.
 *
 * DER EINLADUNGSCODE entsteht im Gerät, damit Link und QR-Code schon auf der
 * Erstellen-Seite stehen, wie im Prototyp. Gültig wird er mit „fertig"
 * (Tabelle `einladungen`, Schema 99). Den Zufall reicht der Aufrufer herein
 * (App: expo-crypto, Browser: crypto.getRandomValues) — Math.random wäre
 * erratbar, und wer den Code errät, ist in einer privaten Community.
 *
 * UMD-Hülle wie beitritt.js; eingetragen in UMD_BAUSTEINE
 * (app/test/_modulquelle.js) und web/public/index.html (`window.Erstellen`).
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.Erstellen = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var WEBSITE = 'https://all-media-website.onrender.com';

  // Grenzen — die Datenbank prüft Biografie und Link noch einmal (Schema 99).
  var NAME_MAX = 40;
  var BIO_MAX = 300;
  var LINK_MAX = 200;
  var UNTERTHEMEN_MAX = 10;

  // Ohne l, o, 0, 1 — beim Abtippen eines Links verwechselt man sie.
  var ZEICHEN = 'abcdefghijkmnpqrstuvwxyz23456789';
  var CODE_LAENGE = 16;

  /** Texte aus dem Prototyp, wörtlich (außer „QR Qode" → „QR-Code"). */
  var TEXTE = {
    pflichtfeld: 'Pflichtfeld',
    communityName: 'Community benennen',
    unterthemaName: 'Unterthema benennen',
    bild: 'Bild einfügen',
    bildAendern: 'Bild ändern',
    bio: 'Biografie hinzufügen',
    link: 'Link hinzufügen',
    unterthemen: 'Unterthemen erstellen',
    unterthemaPlatzhalter: 'Name des Unterthemas',
    privatUnterthema: 'Privates Unterthema',
    privatUnterthemaSub: 'Beitritt nur mit Einladung',
    privatCommunity: 'Private Community',
    privatCommunitySub: 'Beitritt nur mit Anfrage oder Einladung',
    einladen: 'Einladungslink senden',
    qr: 'oder per QR-Code:',
    qrHinweis: 'Gilt, sobald du auf „fertig“ tippst.',
    fertig: 'fertig',
    schliessen: 'Schließen',
  };

  var FEHLT_SCHEMA =
    'Bild, Biografie, Link, privat und Einladung gehen erst, wenn das Datenbank-Update eingespielt ist';

  function text(wert) {
    return typeof wert === 'string' ? wert.trim() : '';
  }

  /**
   * Link wie in den Profilen: ohne Schema bekommt er https://. Gibt
   * { link } oder { fehler } zurück; leer ist erlaubt.
   */
  function linkSauber(eingabe) {
    var roh = text(eingabe);
    if (!roh) return { link: '' };
    var link = /^https?:\/\//i.test(roh) ? roh : 'https://' + roh;
    if (link.length > LINK_MAX) return { fehler: 'Der Link ist zu lang' };
    if (!/^https?:\/\/[^\s/]+\.[^\s/]{2,}(\/\S*)?$/i.test(link)) {
      return { fehler: 'Das sieht nicht wie ein Link aus' };
    }
    return { link: link };
  }

  function nameFehler(name, wort) {
    var n = text(name);
    if (!n) return 'Bitte ' + wort + ' benennen';
    if (n.length > NAME_MAX) return 'Der Name ist zu lang (höchstens ' + NAME_MAX + ' Zeichen)';
    return null;
  }

  function bioFehler(bio) {
    return text(bio).length > BIO_MAX ? 'Die Biografie ist zu lang (höchstens ' + BIO_MAX + ' Zeichen)' : null;
  }

  /** Die Namen der Unterthemen: ohne leere, ohne doppelte, ohne „Allgemein". */
  function unterthemenSauber(namen) {
    var gesehen = { allgemein: true };
    var aus = [];
    (namen || []).forEach(function (n) {
      var s = text(n);
      var k = s.toLowerCase();
      if (!s || gesehen[k]) return;
      gesehen[k] = true;
      aus.push(s);
    });
    return aus;
  }

  /**
   * Was in eine neue Community geht — oder der erste Fehler.
   * { name, bild (bool: gewählt), bio, link, unterthemen: [], privat }
   */
  function pruefeCommunity(eingabe) {
    var e = eingabe || {};
    var f = nameFehler(e.name, 'die Community');
    if (f) return { fehler: f };
    if (!e.bild) return { fehler: 'Bitte ein Bild einfügen' };
    f = bioFehler(e.bio);
    if (f) return { fehler: f };
    var l = linkSauber(e.link);
    if (l.fehler) return { fehler: l.fehler };
    var unterthemen = unterthemenSauber(e.unterthemen);
    if (unterthemen.length > UNTERTHEMEN_MAX) {
      return { fehler: 'Höchstens ' + UNTERTHEMEN_MAX + ' Unterthemen auf einmal' };
    }
    for (var i = 0; i < unterthemen.length; i++) {
      if (unterthemen[i].length > NAME_MAX) return { fehler: '„' + unterthemen[i] + '“ ist zu lang' };
    }
    return {
      fehler: null,
      werte: {
        name: text(e.name),
        bio: text(e.bio),
        link: l.link,
        unterthemen: unterthemen,
        privat: !!e.privat,
      },
    };
  }

  /** Was in ein neues Unterthema geht — oder der erste Fehler. */
  function pruefeUnterthema(eingabe) {
    var e = eingabe || {};
    var f = nameFehler(e.name, 'das Unterthema');
    if (f) return { fehler: f };
    f = bioFehler(e.bio);
    if (f) return { fehler: f };
    var l = linkSauber(e.link);
    if (l.fehler) return { fehler: l.fehler };
    return { fehler: null, werte: { name: text(e.name), bio: text(e.bio), link: l.link, privat: !!e.privat } };
  }

  /**
   * Ein neuer Einladungscode aus Zufallsbytes (mindestens 16). Jedes Byte
   * ergibt ein Zeichen; 32 Zeichen teilen 256 ohne Rest, also gleich
   * verteilt. 16 Zeichen = 80 Bit.
   */
  function neuerCode(bytes) {
    if (!bytes || bytes.length < CODE_LAENGE) throw new Error('Zu wenig Zufall für einen Einladungscode');
    var aus = '';
    for (var i = 0; i < CODE_LAENGE; i++) aus += ZEICHEN.charAt(bytes[i] % ZEICHEN.length);
    return aus;
  }

  function istCode(wert) {
    return typeof wert === 'string' && /^[a-z2-9]{16,32}$/.test(wert);
  }

  /** Der Link im QR-Code und zum Teilen. Öffnet die Website, die beitritt. */
  function link(code, basis) {
    var b = text(basis) || WEBSITE;
    return b.replace(/\/+$/, '') + '/?einladung=' + code;
  }

  /** Den Code aus einem gelesenen QR-Code oder eingefügten Link — sonst null. */
  function codeAus(eingabe) {
    var roh = text(eingabe);
    if (!roh) return null;
    var treffer = roh.match(/[?&]einladung=([a-z2-9]{16,32})(?:[&#]|$)/i);
    if (treffer) return treffer[1].toLowerCase();
    return istCode(roh.toLowerCase()) ? roh.toLowerCase() : null;
  }

  /** Teilen-Text für das Einladungsblatt. */
  function teilenText(art, name, code, basis) {
    var wo = art === 'unterthema' ? 'das Unterthema „' + name + '“' : 'die Community „' + name + '“';
    return 'Ich lade dich in ' + wo + ' auf All Media ein: ' + link(code, basis);
  }

  /** Fehlt Schema 99 (Spalte oder Tabelle)? Dann wie bisher anlegen. */
  function fehltSchema(fehler) {
    if (!fehler) return false;
    var code = fehler.code || '';
    var nachricht = String(fehler.message || '');
    if (code === '42703' || code === 'PGRST204' || code === '42P01' || code === 'PGRST205' || code === 'PGRST202') {
      return true;
    }
    return /bild_url|einladung|unterthema_mitglieder|privat|erstellt_von|column .*bio|column .*link/i.test(nachricht) &&
      /does not exist|could not find|schema cache/i.test(nachricht);
  }

  /**
   * Was Schema 99 an Communitys und Unterthemen hängt, zu den geladenen
   * nachholen: Bild, und je Unterthema Biografie, Link, privat, Ersteller.
   * Eigene Abfrage statt einer Spalte mehr in der Hauptabfrage — fehlt 99,
   * scheitert nur diese, und alles bleibt wie bisher. Gleicher Weg in
   * app/lib/daten.ts und web/server/supabase-api.js (ladeCommunities).
   */
  function zusatzLaden(client, ids) {
    var leer = { bild: {}, kanal: {} };
    if (!client || !ids || !ids.length) return Promise.resolve(leer);
    return Promise.all([
      client.from('communities').select('id, bild_url').in('id', ids),
      client.from('community_channels').select('id, bio, link, privat, erstellt_von').in('community_id', ids),
    ]).then(function (antworten) {
      var aus = { bild: {}, kanal: {} };
      if (!antworten[0].error) {
        (antworten[0].data || []).forEach(function (z) { aus.bild[z.id] = z.bild_url || null; });
      }
      if (!antworten[1].error) {
        (antworten[1].data || []).forEach(function (z) { aus.kanal[z.id] = z; });
      }
      return aus;
    }, function () { return leer; });
  }

  /** Die Felder eines Unterthemas aus zusatzLaden. */
  function kanalFelder(zusatz, kanalId, ichId) {
    var z = (zusatz && zusatz.kanal && zusatz.kanal[kanalId]) || null;
    if (!z) return {};
    return {
      bio: z.bio || '',
      link: z.link || '',
      privat: !!z.privat,
      eigen: !!ichId && z.erstellt_von === ichId,
    };
  }

  return {
    WEBSITE: WEBSITE,
    zusatzLaden: zusatzLaden,
    kanalFelder: kanalFelder,
    NAME_MAX: NAME_MAX,
    BIO_MAX: BIO_MAX,
    LINK_MAX: LINK_MAX,
    UNTERTHEMEN_MAX: UNTERTHEMEN_MAX,
    CODE_LAENGE: CODE_LAENGE,
    TEXTE: TEXTE,
    FEHLT_SCHEMA: FEHLT_SCHEMA,
    linkSauber: linkSauber,
    unterthemenSauber: unterthemenSauber,
    pruefeCommunity: pruefeCommunity,
    pruefeUnterthema: pruefeUnterthema,
    neuerCode: neuerCode,
    istCode: istCode,
    link: link,
    codeAus: codeAus,
    teilenText: teilenText,
    fehltSchema: fehltSchema,
  };
});
