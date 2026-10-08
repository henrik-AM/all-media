/**
 * All Media — Chats auf dem Laufenden halten, einmal für App und Website.
 *
 * WARUM ES DAS GIBT (Kasten 27, 06.10.2026)
 *
 * Henrik: „Nutzer A schreibt ‚cxv', bei Nutzer B kommt ‚cwkdew' an." In der
 * Datenbank stand die richtige Nachricht — verfälscht wurde nichts. Was B
 * sah, war eine ÄLTERE Nachricht: der Stand von dem Augenblick, in dem B
 * die Seite oder den Chat zuletzt geladen hatte. Belegt an vier Stellen:
 *
 *   1. Ein offener Chat lud seinen Verlauf genau einmal (ChatDetailScreen,
 *      Effekt auf [chat.id]; Website: openChat → nachrichtenHolen). Weder
 *      App noch Website hatten ein Abo, eine Abfrage im Takt oder ein
 *      Neuladen beim Zurückkehren in die App. Was A danach schrieb, kam bei
 *      B nie an, solange B den Chat offen hatte.
 *   2. Die Chatliste der App übernahm beim Neuladen nur NEUE Chats
 *      (App.tsx, Effekt auf [daten.chats]). Vorschau, Uhrzeit und
 *      Ungelesen-Zahl eines vorhandenen Chats blieben auf dem Stand des
 *      App-Starts — auch nach dem Herunterziehen. B sah dort A's vorletzte
 *      Nachricht, A selbst übrigens auch.
 *   3. Die Chatliste der Website wurde nur beim Start und nach einzelnen
 *      eigenen Handlungen neu geholt.
 *   4. Ungelesen hing an chat_members.is_read, und das setzte bei einer
 *      neuen Nachricht niemand auf false. Schema XX (Kasten 27) macht das
 *      jetzt in der Datenbank.
 *
 * Hier steht, was beide Seiten dafür gleich rechnen müssen: wie oft gefragt
 * wird, woran man erkennt, dass sich etwas geändert hat, und wie ein frisch
 * geladener Stand mit dem zusammengeht, was schon auf dem Bildschirm steht.
 * Die Abfragen selbst macht jede Seite mit ihrem eigenen Client.
 *
 * WARUM KEIN REALTIME-ABO ALLEIN
 *
 * `messages` steht in der Publikation `supabase_realtime`, ein Abo wäre also
 * möglich. Es fällt aber still aus — Funkloch, App im Hintergrund, Expo Go
 * nach dem Neuladen — und dann ist B wieder genau da, wo Henrik ihn gefunden
 * hat. Die Abfrage im Takt kann nicht still ausfallen. Sie fragt erst einen
 * kleinen „Stand" (Kennungen und Zeitstempel, ein paar hundert Byte) und lädt
 * den Verlauf nur, wenn der sich geändert hat — das hält den Verbrauch klein
 * (Supabase-Egress, siehe Projektnotiz vom 13.09.2026).
 *
 * UMD-HÜLLE
 *
 * Wie die anderen Bausteine: Node und Metro über module.exports, Browser über
 * window.ChatAbgleich. Eingetragen in UMD_BAUSTEINE (app/test/_modulquelle.js).
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.ChatAbgleich = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Wie oft ein OFFENER Chat nachsieht. Vier Sekunden fühlen sich wie „sofort" an. */
  var INTERVALL_CHAT_MS = 4000;

  /** Wie oft die Chatliste nachsieht. Sie zeigt nur Vorschau und Zähler. */
  var INTERVALL_LISTE_MS = 10000;

  /**
   * Wie viele der jüngsten Nachrichten der Stand umfasst. Eine neue Nachricht
   * ist immer die jüngste; Bearbeiten, Zurücknehmen und Lesebestätigung
   * betreffen fast immer eine der letzten. Dreißig Zeilen à vier kurze
   * Spalten sind ein paar hundert Byte.
   */
  var STAND_ZEILEN = 30;

  /** Die Spalten der Standabfrage auf `messages` (Kanäle: nur id, created_at). */
  var STAND_SPALTEN = 'id, created_at, edited_at, deleted_at, read_at';
  var STAND_SPALTEN_KANAL = 'id, created_at';

  function wert(x) {
    return x === null || x === undefined ? '' : String(x);
  }

  /**
   * Der Stand eines Verlaufs — ein Text, der sich genau dann ändert, wenn
   * eine Nachricht dazukommt, bearbeitet, zurückgenommen oder gelesen wird.
   */
  function stand(zeilen) {
    return (zeilen || [])
      .map(function (z) {
        return [wert(z.id), wert(z.edited_at), wert(z.deleted_at), wert(z.read_at)].join('|');
      })
      .join(';');
  }

  /**
   * Der Stand einer Chatliste — Mitgliedschaften (gelesen, archiviert …) und
   * je Chat die jüngste Nachricht.
   */
  function listenStand(mitglieder, letzte) {
    var m = (mitglieder || [])
      .map(function (z) {
        return [
          wert(z.chat_id),
          z.is_read ? 1 : 0,
          z.is_archived ? 1 : 0,
          z.is_muted ? 1 : 0,
          wert(z.geleert_bis),
        ].join('|');
      })
      .sort()
      .join(';');
    var n = (letzte || [])
      .map(function (z) {
        return [wert(z.chat_id), wert(z.id), wert(z.edited_at), wert(z.deleted_at)].join('|');
      })
      .sort()
      .join(';');
    return m + '#' + n;
  }

  /**
   * Was an einer Nachricht sichtbar ist. Ändert sich davon etwas, muss neu
   * gezeichnet werden; sonst nicht (sonst springt die Liste alle vier
   * Sekunden und ein offenes Menü geht zu).
   */
  function fingerabdruck(m) {
    if (!m) return '';
    return JSON.stringify([
      m.id,
      m.text,
      Boolean(m.read),
      Boolean(m.bearbeitet),
      Boolean(m.zurueckgenommen),
      m.reaktionen || [],
      m.media || null,
      m.datei ? m.datei.name : null,
      m.anruf ? [m.anruf.status, m.anruf.dauer] : null,
    ]);
  }

  /**
   * Einen frisch geladenen Verlauf mit dem auf dem Bildschirm zusammenlegen.
   *
   * Die Datenbank ist die Wahrheit. Stehen bleibt nur, was die Datenbank
   * noch gar nicht kennen KANN: Nachrichten mit `lokal: true` — die eben
   * selbst gesendete, wenn die Abfrage schon vor dem Senden losging, und die
   * Einträge, die die App selbst beilegt (Teilen, Kameraaufnahme). Sie
   * bleiben in ihrer Reihenfolge hinten stehen, bis die Datenbank sie unter
   * derselben Kennung liefert.
   *
   * Gibt `lokal` UNVERÄNDERT zurück (dasselbe Objekt), wenn sich nichts
   * Sichtbares geändert hat — die Oberfläche kann daran erkennen, dass sie
   * nicht neu zeichnen muss.
   */
  function nachrichtenAbgleichen(lokal, frisch) {
    var alt = lokal || [];
    var neu = (frisch || []).slice();
    var bekannt = {};
    for (var i = 0; i < neu.length; i++) bekannt[neu[i].id] = true;
    for (var j = 0; j < alt.length; j++) {
      var m = alt[j];
      if (m && m.lokal && !bekannt[m.id]) neu.push(m);
    }
    if (neu.length !== alt.length) return neu;
    for (var k = 0; k < neu.length; k++) {
      if (fingerabdruck(neu[k]) !== fingerabdruck(alt[k])) return neu;
    }
    return alt;
  }

  /**
   * Welche Kennungen in `neu` fremde Nachrichten sind, die in `alt` fehlten.
   * Danach richtet sich, ob der offene Chat als gelesen vermerkt wird und ob
   * er nach unten rollt.
   */
  function neueFremde(alt, neu, istEigene) {
    var vorher = {};
    (alt || []).forEach(function (m) {
      vorher[m.id] = true;
    });
    return (neu || []).filter(function (m) {
      return !vorher[m.id] && !istEigene(m);
    });
  }

  /**
   * Die Felder einer Chatzeile, bei denen die Datenbank gewinnt.
   *
   * Bis zum 06.10.2026 gewann bei vorhandenen Chats immer der lokale Stand
   * (App.tsx) — damit blieb die Vorschau auf dem Stand des App-Starts. Die
   * eigenen Schalter (archiviert, stumm, Favorit, gesperrt, Mitteilungen)
   * bleiben weiter lokal: sie werden sofort umgelegt und dann geschrieben,
   * und eine Abfrage, die in dieses Fenster fällt, würde sie sonst kurz
   * zurückspringen lassen.
   */
  var INHALT = [
    'name',
    'preview',
    'previewMedia',
    'time',
    'unreadCount',
    'requestState',
    'messengerAnfrage',
    'verschluesselt',
    'memberIds',
    'userId',
  ];

  /**
   * Die Chatliste der App mit dem frisch geladenen Stand zusammenlegen.
   *
   * Reihenfolge: wie die Datenbank sie liefert (jüngste Nachricht oben).
   * Chats, die nur lokal stehen (vorweggenommen, noch ohne Datenbankzeile),
   * bleiben oben stehen — so wie bisher.
   */
  function chatlisteAbgleichen(lokal, frisch) {
    var alt = lokal || [];
    var nachId = {};
    alt.forEach(function (c) {
      nachId[c.id] = c;
    });
    var imFrischen = {};
    var zusammen = (frisch || []).map(function (f) {
      imFrischen[f.id] = true;
      var l = nachId[f.id];
      if (!l) return f;
      var ergebnis = {};
      var schluessel;
      for (schluessel in l) ergebnis[schluessel] = l[schluessel];
      for (var i = 0; i < INHALT.length; i++) {
        if (Object.prototype.hasOwnProperty.call(f, INHALT[i])) ergebnis[INHALT[i]] = f[INHALT[i]];
      }
      return ergebnis;
    });
    var nurLokal = alt.filter(function (c) {
      return !imFrischen[c.id];
    });
    var neu = nurLokal.concat(zusammen);

    // Unverändert: dasselbe Feld zurück, damit React nicht neu zeichnet.
    if (neu.length === alt.length) {
      var gleich = true;
      for (var k = 0; k < neu.length && gleich; k++) {
        if (neu[k].id !== alt[k].id) gleich = false;
        else {
          for (var j = 0; j < INHALT.length; j++) {
            if (JSON.stringify(neu[k][INHALT[j]]) !== JSON.stringify(alt[k][INHALT[j]])) {
              gleich = false;
              break;
            }
          }
        }
      }
      if (gleich) return alt;
    }
    return neu;
  }

  /**
   * Die jüngsten `grenze` Zeilen in zeitlicher Reihenfolge.
   *
   * Beide Seiten holten bis zum 06.10.2026 `order(created_at asc).limit(500)`
   * — also die ÄLTESTEN 500. Ab der 501. Nachricht kam in einem Chat nichts
   * Neues mehr an. Jetzt wird absteigend geholt und hier umgedreht.
   */
  function chronologisch(zeilenAbsteigend) {
    return (zeilenAbsteigend || []).slice().reverse();
  }

  return {
    INTERVALL_CHAT_MS: INTERVALL_CHAT_MS,
    INTERVALL_LISTE_MS: INTERVALL_LISTE_MS,
    STAND_ZEILEN: STAND_ZEILEN,
    STAND_SPALTEN: STAND_SPALTEN,
    STAND_SPALTEN_KANAL: STAND_SPALTEN_KANAL,
    stand: stand,
    listenStand: listenStand,
    fingerabdruck: fingerabdruck,
    nachrichtenAbgleichen: nachrichtenAbgleichen,
    neueFremde: neueFremde,
    chatlisteAbgleichen: chatlisteAbgleichen,
    chronologisch: chronologisch,
  };
});
