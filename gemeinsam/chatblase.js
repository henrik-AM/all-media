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
   * Die zweite Zeile der Weg-Karte (Nachtrag 11.10., 7.6) — nur, wo sich der
   * Grund ehrlich unterscheiden lässt:
   *   gelöscht    Schema 93 hat beim Löschen den Merker `shared_post_weg`
   *               gesetzt — das ist eine Tatsache.
   *   unsichtbar  `shared_post_id` steht noch (der Beitrag existiert also),
   *               aber die Leseregel gibt ihn nicht heraus: privat,
   *               gesperrt, Minderjährigen-Freigabe. Welcher der Gründe, sagt
   *               die Datenbank nicht — darum kein genauerer Satz.
   */
  var GETEILT_GELOESCHT = 'Der Beitrag wurde gelöscht';
  var GETEILT_UNSICHTBAR = 'Für dich nicht sichtbar';

  /**
   * Spalten aus Schema 93. Getrennt geladen (geteiltWegLaden): stünden sie
   * in NACHRICHT_SPALTEN, fiele bis zum Einspielen jeder Chat mit 42703 um.
   */
  var GETEILT_WEG_SPALTEN = 'id, shared_post_weg, shared_post_konto';

  /** Ein Konto aus der Nachschlagetabelle von geteiltKonten — oder leer. */
  function kontoAus(konten, id) {
    return (id && konten && konten[id]) || {};
  }

  /**
   * Aus der Einbettung `posts` einer Nachricht die Karte machen.
   *
   * „Name des Beitrags" ist `posts.title`, die Beschreibung `posts.description`.
   * Viele Beiträge haben keinen Titel (Fotos, Reels) — dann steht nur die
   * Beschreibung da, und zwar einmal, nicht doppelt. Einen Titel zu erfinden
   * (etwa „Beitrag von …") wäre eine Anzeige, die es nicht gibt.
   *
   * `sharedPostId` gesetzt, aber `post` leer: die Leseregel gibt den Beitrag
   * nicht heraus (privat, gesperrt, Minderjährigen-Freigabe) — Weg-Karte,
   * Grund „unsichtbar".
   *
   * Ist der Beitrag gelöscht, setzt die Datenbank `shared_post_id` auf null
   * (on delete set null). Seit Schema 93 bleibt dabei der Merker
   * `shared_post_weg` mit dem Konto `shared_post_konto` stehen (`zeile`, aus
   * geteiltWegLaden) — Weg-Karte, Grund „gelöscht", mit Konto. Ohne Schema 93
   * (oder bei Nachrichten von davor) ist ein gelöschter Beitrag nicht mehr
   * erkennbar; die Nachricht zeigt dann ihren Vorschautext.
   *
   * `konten` (aus geteiltKonten): Name und echtes Profilbild des Kontos
   * (Nachtrag 11.10., 7.7) — `autorBild` ist die beständige Adresse, die
   * signiereMedien (App) bzw. res.json (Server) unterschreibt.
   */
  function geteiltAus(sharedPostId, post, zeile, konten) {
    if (!post) {
      if (sharedPostId) return { id: String(sharedPostId), weg: true, grund: 'unsichtbar' };
      if (zeile && zeile.shared_post_weg) {
        var kontoId = zeile.shared_post_konto ? String(zeile.shared_post_konto) : '';
        var k = kontoAus(konten, kontoId);
        return {
          id: '',
          weg: true,
          grund: 'geloescht',
          autorId: kontoId || undefined,
          autor: k.name || '',
          handle: k.handle || '',
          autorBild: k.bild || undefined,
        };
      }
      return undefined;
    }
    var titel = String(post.title || '').trim();
    var beschreibung = String(post.description || '').trim();
    if (titel && beschreibung === titel) beschreibung = '';
    var kind = post.kind === 'clip' ? 'clip' : post.kind === 'reel' ? 'reel' : 'post';
    var profil = post.profiles || {};
    var autorId = post.user_id ? String(post.user_id) : '';
    return {
      id: post.id,
      kind: kind,
      // `art` für die bisherigen Leser: Bild-Beitrag oder Video.
      art: kind === 'post' ? 'post' : 'video',
      // 7.7: die Kennung des Kontos — damit die Karte das echte Profilbild
      // (und im Messenger das eigene Kontaktbild, 7.8) zeigen kann.
      autorId: autorId || undefined,
      autor: profil.name || '',
      handle: profil.handle || '',
      autorBild: kontoAus(konten, autorId).bild || undefined,
      titel: titel,
      beschreibung: beschreibung,
      bild: post.thumbnail_url || post.media_url || undefined,
    };
  }

  /** Die zweite Zeile der Weg-Karte, oder '' (Grund unbekannt). */
  function geteiltWegGrund(g) {
    if (!g || !g.weg) return '';
    if (g.grund === 'geloescht') return GETEILT_GELOESCHT;
    if (g.grund === 'unsichtbar') return GETEILT_UNSICHTBAR;
    return '';
  }

  /** Die Zeile, die eine Karte für Bildschirmleser vorliest. */
  function geteiltBeschriftung(g) {
    if (!g) return '';
    if (g.weg) {
      var weg = [GETEILT_WEG];
      if (g.autor) weg.push('von ' + g.autor);
      var grund = geteiltWegGrund(g);
      if (grund) weg.push(grund);
      return weg.join(', ');
    }
    var was = g.kind === 'post' ? 'Geteilter Beitrag' : 'Geteiltes Video';
    var teile = [was];
    if (g.autor) teile.push('von ' + g.autor);
    if (g.titel) teile.push(g.titel);
    else if (g.beschreibung) teile.push(g.beschreibung);
    return teile.join(', ');
  }

  /* ---------------------------- Nachladen (App und Server, supabase-js) */

  /**
   * Die Merker aus Schema 93 für einen Chat oder ein Unterthema —
   * nachsichtig: fehlen die Spalten (42703) oder scheitert die Abfrage,
   * kommt eine leere Tabelle zurück, und alles bleibt beim alten Stand.
   * `tabelle`: 'messages' | 'community_channel_messages';
   * `spalte`: 'chat_id' | 'channel_id'. Ergebnis: Kennung → Zeile.
   */
  function geteiltWegLaden(client, tabelle, spalte, wert) {
    var leer = {};
    if (!client || !wert) return Promise.resolve(leer);
    try {
      return Promise.resolve(
        client
          .from(tabelle)
          .select(GETEILT_WEG_SPALTEN)
          .eq(spalte, wert)
          .not('shared_post_weg', 'is', null)
          .limit(500)
      )
        .then(function (antwort) {
          if (!antwort || antwort.error) return leer;
          var karte = {};
          (antwort.data || []).forEach(function (z) {
            karte[z.id] = z;
          });
          return karte;
        })
        .catch(function () {
          return leer;
        });
    } catch (e) {
      return Promise.resolve(leer);
    }
  }

  /** Die Konten, deren Bild und Name die Karten brauchen (7.7). */
  function geteiltKontoIds(zeilen, weg) {
    var ids = {};
    (zeilen || []).forEach(function (z) {
      if (z && z.posts && z.posts.user_id) ids[z.posts.user_id] = true;
      var w = weg && z && weg[z.id];
      if (w && w.shared_post_konto) ids[w.shared_post_konto] = true;
    });
    return Object.keys(ids);
  }

  /**
   * Name, Nutzername und Profilbild dieser Konten (7.7) — nachsichtig. Ohne
   * freigegebene Spalte `avatar_url` (Schema 69) noch einmal ohne Bild; was
   * die Leseregel auf `profiles` nicht herausgibt, fehlt (dann Initialen).
   * Ergebnis: Kennung → { name, handle, bild }.
   */
  function geteiltKonten(client, ids) {
    var leer = {};
    if (!client || !ids || !ids.length) return Promise.resolve(leer);
    var holen = function (spalten) {
      return Promise.resolve(client.from('profiles').select(spalten).in('id', ids));
    };
    var abbilden = function (antwort) {
      var karte = {};
      ((antwort && antwort.data) || []).forEach(function (p) {
        karte[p.id] = { name: p.name || '', handle: p.handle || '', bild: p.avatar_url || undefined };
      });
      return karte;
    };
    try {
      return holen('id, name, handle, avatar_url')
        .then(function (antwort) {
          if (antwort && antwort.error) {
            return holen('id, name, handle').then(function (ohne) {
              return ohne && ohne.error ? leer : abbilden(ohne);
            });
          }
          return abbilden(antwort);
        })
        .catch(function () {
          return leer;
        });
    } catch (e) {
      return Promise.resolve(leer);
    }
  }

  /**
   * Die Vorschauzeile der Chatliste (7.5): steht dort eine geteilte Karte,
   * deren Beitrag gelöscht (Merker, Schema 93) oder für mich nicht sichtbar
   * ist (`sichtbar` aus geteiltSichtbar enthält ihn nicht), heißt die Zeile
   * GETEILT_WEG statt „Beitrag geteilt". Sonst null = Vorschautext wie bisher.
   */
  function geteiltVorschau(zeile, sichtbar) {
    if (!zeile) return null;
    if (zeile.shared_post_id) {
      return sichtbar && !sichtbar.has(String(zeile.shared_post_id)) ? GETEILT_WEG : null;
    }
    return zeile.shared_post_weg ? GETEILT_WEG : null;
  }

  /**
   * Welche dieser Beiträge die Leseregel mir herausgibt (Chatliste, 7.5).
   * Scheitert die Abfrage: null — dann bleibt die Vorschau, wie sie war,
   * statt fälschlich „nicht mehr verfügbar" zu sagen.
   */
  function geteiltSichtbar(client, ids) {
    if (!client || !ids || !ids.length) return Promise.resolve(null);
    try {
      return Promise.resolve(client.from('posts').select('id').in('id', ids))
        .then(function (antwort) {
          if (!antwort || antwort.error) return null;
          var menge = new Set();
          (antwort.data || []).forEach(function (p) {
            menge.add(String(p.id));
          });
          return menge;
        })
        .catch(function () {
          return null;
        });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Profilbild an der Blase (Kasten 28/11.3, Nachtrag 12.10.2026)       */
  /* ------------------------------------------------------------------ */

  /*
   * Henrik: „Ich möchte, dass im Chat eines Unterthemas unter jeder Nachricht
   * einer Person, links unten von der Nachricht das Profilbild der Person vom
   * Community Profil angezeigt wird. Da soll man dann auch drauf drücken
   * können, so dass man auf das community Profile der Person kommt."
   *
   * Prototyp „CH + Kanalunterthema" (897-12186): fremde Blase → Bild unten
   * links, eigene (grüne) Blase → eigenes Bild unten rechts. „CC + Chat"
   * (926-12526, Community-Einzelchat): keine Bilder.
   *
   * Das Bild ist das Profilbild des Kontos (profiles.avatar_url, Schema 69) —
   * ein eigenes Community-Profilbild gibt es nicht. NIE das Messenger-
   * Kontaktbild (Schema 94): das gilt nur im Messenger.
   */

  /** Kantenlänge des Bildes an der Blase, in Punkten / CSS-Pixeln. */
  var PROFILBILD_GROESSE = 28;

  /**
   * Zeigt dieser Chat Profilbilder an den Blasen? Im Unterthema immer, im
   * Gruppenchat unter Communitys → Chats auch; im Community-Einzelchat und im
   * ganzen Messenger nicht.
   */
  function profilbilderImChat(o) {
    if (!o) return false;
    if (o.kanal) return true;
    return Boolean(o.gruppe && o.community);
  }

  /**
   * Wessen Bild eine Zeile tragen kann — oder null, wenn sie keine Blase ist
   * (Anrufzeile, „Push to Talk", Markierungskarte). Eine solche Zeile
   * unterbricht die Folge derselben Person.
   */
  function blasenAbsender(m, absender) {
    if (!m || m.anruf || m.pttSitzung || m.hinweis) return null;
    return absender || null;
  }

  /**
   * Steht an Zeile i das Bild? Nur an der LETZTEN Blase einer Folge derselben
   * Person (wie WhatsApp/iMessage): das Bild steht unten und gehört zur
   * ganzen Folge darüber; an jeder Blase wäre es bei schnellem Schreiben eine
   * Säule aus demselben Gesicht. Der Platz bleibt an den übrigen Blasen frei,
   * damit die Folge bündig steht.
   *
   * `absender`: Liste der Absender je Zeile, null für Zeilen ohne Blase
   * (blasenAbsender).
   */
  function profilbildAn(absender, i) {
    var a = absender && absender[i];
    if (!a) return false;
    return absender[i + 1] !== a;
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
    GETEILT_GELOESCHT: GETEILT_GELOESCHT,
    GETEILT_UNSICHTBAR: GETEILT_UNSICHTBAR,
    GETEILT_WEG_SPALTEN: GETEILT_WEG_SPALTEN,
    geteiltAus: geteiltAus,
    geteiltWegGrund: geteiltWegGrund,
    geteiltBeschriftung: geteiltBeschriftung,
    geteiltWegLaden: geteiltWegLaden,
    geteiltKontoIds: geteiltKontoIds,
    geteiltKonten: geteiltKonten,
    geteiltVorschau: geteiltVorschau,
    geteiltSichtbar: geteiltSichtbar,
    PROFILBILD_GROESSE: PROFILBILD_GROESSE,
    profilbilderImChat: profilbilderImChat,
    blasenAbsender: blasenAbsender,
    profilbildAn: profilbildAn,
  };
});
