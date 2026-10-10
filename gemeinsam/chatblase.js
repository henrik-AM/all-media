/**
 * Die Chatblase: Ziehen zum Antworten und die Karte eines geteilten Beitrags.
 * Regeln für App und Website.
 *
 * WARUM ES DAS GIBT
 *
 * Henrik am 28.09.2026 (Kasten 4): „Man kann durch nach rechts ziehen einer
 * Nachricht, egal ob unter Communitys → Chats oder Videos, nicht auf die
 * Nachricht antworten." Und (Kasten 7): „Wenn ich einer Person ein Video oder
 * einen Beitrag teile, soll das besser im Chat angezeigt werden — Thumbnail im
 * Großformat, darunter der Name des Beitrags und die Beschreibung."
 *
 * Beides gibt es in der App (ChatDetailScreen) und auf der Website (Chat und
 * Unterthema in web/public/app.js). Damit Schwelle, Weg und Karte überall
 * gleich sind, stehen die Zahlen und die Abbildung hier — einmal.
 *
 * WARUM DIE UMD-HÜLLE
 *
 * Wie bei story.js: die Prüfläufe legen den App-Code als blob:-Modul in den
 * Browser, dort gibt es kein `require`. Eingetragen in UMD_BAUSTEINE
 * (app/test/_modulquelle.js). Die Website lädt die Datei per <script> und
 * findet `window.Chatblase`.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.Chatblase = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Ziehen zum Antworten (Kasten 4)                                     */
  /* ------------------------------------------------------------------ */

  /** Ab so vielen Punkten nach rechts gilt das Ziehen als „Antworten". */
  var ZIEH_SCHWELLE = 56;
  /** Weiter folgt die Blase dem Finger nicht. */
  var ZIEH_MAX = 84;
  /** Erst ab diesem Weg wird überhaupt gezogen — darunter ist es ein Tipp. */
  var ZIEH_START = 10;

  /**
   * Ist die Bewegung ein Ziehen nach rechts — und nicht der Anfang eines
   * Bildlaufs? Waagrecht muss deutlich überwiegen, sonst stiehlt die Blase
   * dem Verlauf das Scrollen.
   */
  function istZug(dx, dy) {
    var x = Number(dx) || 0;
    var y = Math.abs(Number(dy) || 0);
    return x > ZIEH_START && x > y * 2;
  }

  /**
   * Wie weit die Blase dem Finger folgt: bis zur Schwelle eins zu eins,
   * danach gedämpft bis ZIEH_MAX. Nach links gar nicht.
   */
  function zugWeg(dx) {
    var x = Number(dx) || 0;
    if (x <= 0) return 0;
    if (x <= ZIEH_SCHWELLE) return x;
    var ueber = x - ZIEH_SCHWELLE;
    return Math.min(ZIEH_MAX, ZIEH_SCHWELLE + ueber * 0.35);
  }

  /** Löst das Loslassen bei diesem Weg das Antworten aus? */
  function ausgeloest(dx) {
    return (Number(dx) || 0) >= ZIEH_SCHWELLE;
  }

  /** Deckkraft des Antwortpfeils neben der Blase, 0 bis 1. */
  function pfeilSichtbar(dx) {
    var x = Number(dx) || 0;
    if (x <= ZIEH_START) return 0;
    return Math.min(1, (x - ZIEH_START) / (ZIEH_SCHWELLE - ZIEH_START));
  }

  /**
   * Der Bezugskopf über der Antwort: Autor und Text der Originalnachricht.
   * Ist das Original zurückgenommen oder nicht lesbar, steht das da — kein
   * erfundener Text.
   */
  var BEZUG_WEG = 'Nachricht nicht mehr verfügbar';

  /**
   * Bezüge im Unterthema (Schema XX, `community_channel_messages.reply_to`).
   *
   * `zeilen` sind die geladenen Kanalnachrichten, `namen` eine Zuordnung
   * Kennung → Name. Die Originalnachricht steht fast immer schon unter den
   * geladenen 500; fehlt sie (älter), bleibt der Kopf mit BEZUG_WEG stehen,
   * damit erkennbar ist, dass es eine Antwort war.
   */
  function kanalBezug(zeile, alle, ichId, namen) {
    if (!zeile || !zeile.reply_to) return undefined;
    var original = null;
    for (var i = 0; i < (alle || []).length; i++) {
      if (alle[i] && alle[i].id === zeile.reply_to) {
        original = alle[i];
        break;
      }
    }
    if (!original) return { id: zeile.reply_to, text: '', autor: '', fehlt: true };
    var autor =
      original.sender_id === ichId ? 'Du' : (namen && namen[original.sender_id]) || '';
    return {
      id: original.id,
      text: original.text || (original.media_type ? 'Anhang' : ''),
      autor: autor,
    };
  }

  /**
   * Kennt die Datenbank die Spalte noch nicht? `community_channel_messages.
   * reply_to` kommt erst mit Schema XX. Bis es eingespielt ist, laeuft das
   * Unterthema ohne Bezug weiter, statt leer dazustehen (Lesen: 42703,
   * Schreiben: PGRST204 „Could not find the 'reply_to' column").
   */
  function fehltSpalte(fehler, spalte) {
    if (!fehler) return false;
    var code = String(fehler.code || '');
    var text = String(fehler.message || '');
    if (code !== '42703' && code !== 'PGRST204') return false;
    return !spalte || text.indexOf(spalte) !== -1;
  }

  /** Steht da, wenn im Unterthema ohne Bezug gesendet werden musste. */
  var OHNE_BEZUG =
    'Gesendet — der Bezug fehlt, bis Antworten im Unterthema freigeschaltet ist';

  /* ------------------------------------------------------------------ */
  /* Geteilter Beitrag (Kasten 7)                                         */
  /* ------------------------------------------------------------------ */

  /** Steht da, wenn der Beitrag gelöscht oder nicht (mehr) sichtbar ist. */
  var GETEILT_WEG = 'Beitrag nicht mehr verfügbar';

  /**
   * Aus der Einbettung `posts` einer Nachricht die Karte machen.
   *
   * „Name des Beitrags" ist `posts.title`, die Beschreibung `posts.description`.
   * Viele Beiträge haben keinen Titel (Fotos, Reels) — dann steht nur die
   * Beschreibung da, und zwar einmal, nicht doppelt. Einen Titel zu erfinden
   * (etwa „Beitrag von …") wäre eine Anzeige, die es nicht gibt.
   *
   * `sharedPostId` gesetzt, aber `post` leer: die Leseregel gibt den Beitrag
   * nicht heraus (privat, gesperrt, Minderjährigen-Freigabe) — die Karte sagt
   * GETEILT_WEG. Ist der Beitrag gelöscht, setzt die Datenbank
   * `shared_post_id` auf null (on delete set null); das ist hier nicht mehr
   * erkennbar, die Nachricht zeigt dann ihren Vorschautext.
   */
  function geteiltAus(sharedPostId, post) {
    if (!post) {
      return sharedPostId ? { id: String(sharedPostId), weg: true } : undefined;
    }
    var titel = String(post.title || '').trim();
    var beschreibung = String(post.description || '').trim();
    if (titel && beschreibung === titel) beschreibung = '';
    var kind = post.kind === 'clip' ? 'clip' : post.kind === 'reel' ? 'reel' : 'post';
    var profil = post.profiles || {};
    return {
      id: post.id,
      kind: kind,
      // `art` für die bisherigen Leser: Bild-Beitrag oder Video.
      art: kind === 'post' ? 'post' : 'video',
      autor: profil.name || '',
      handle: profil.handle || '',
      titel: titel,
      beschreibung: beschreibung,
      bild: post.thumbnail_url || post.media_url || undefined,
    };
  }

  /** Die Zeile, die eine Karte für Bildschirmleser vorliest. */
  function geteiltBeschriftung(g) {
    if (!g) return '';
    if (g.weg) return GETEILT_WEG;
    var was = g.kind === 'post' ? 'Geteilter Beitrag' : 'Geteiltes Video';
    var teile = [was];
    if (g.autor) teile.push('von ' + g.autor);
    if (g.titel) teile.push(g.titel);
    else if (g.beschreibung) teile.push(g.beschreibung);
    return teile.join(', ');
  }

  return {
    ZIEH_SCHWELLE: ZIEH_SCHWELLE,
    ZIEH_MAX: ZIEH_MAX,
    ZIEH_START: ZIEH_START,
    istZug: istZug,
    zugWeg: zugWeg,
    ausgeloest: ausgeloest,
    pfeilSichtbar: pfeilSichtbar,
    BEZUG_WEG: BEZUG_WEG,
    kanalBezug: kanalBezug,
    fehltSpalte: fehltSpalte,
    OHNE_BEZUG: OHNE_BEZUG,
    GETEILT_WEG: GETEILT_WEG,
    geteiltAus: geteiltAus,
    geteiltBeschriftung: geteiltBeschriftung,
  };
});
