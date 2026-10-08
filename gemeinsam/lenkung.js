/**
 * Den eigenen Feed selbst lenken — einmal für App und Website.
 *
 * WORUM ES GEHT
 *
 * Henrik am 06.10.2026 (Kasten 24): „Ein Nutzer soll die Möglichkeit haben,
 * seinen Algorithmus selbstständig in eine Richtung zu lenken
 * (Einstellungsbereich unter Einstellungen → Videos), durch Eingabe von
 * #/Sounds/Orten/Profilen/etc."
 *
 * Vorbilder: TikTok „Themen verwalten" und „Schlüsselwörter filtern",
 * Instagram „Dein Algorithmus" (Themen für mehr/weniger), YouTube „Kanal
 * nicht empfehlen". Jeder Eintrag ist ein Gegenstand (Hashtag, Sound, Ort,
 * Profil, Stichwort) plus eine Richtung (mehr davon / weniger davon).
 *
 * WO GERECHNET WIRD
 *
 * Gespeichert sind die Einträge in Supabase (`feed_lenkung`, nur eigene
 * Zeilen lesbar). Die Punkte rechnet weiter `feed_rang()` (Schema 51). Aus
 * den Einträgen wird HIER ein Faktor je Beitrag, und `gemeinsam/rang.js`
 * multipliziert ihn auf die Punkte, bevor sortiert und aufgefächert wird.
 *
 * Warum nicht in SQL: dieselbe Datei rechnet in der App (app/lib/daten.ts)
 * und auf der Website (web/server/supabase-api.js) — beide bekommen also
 * aus denselben Zeilen dieselbe Reihenfolge, und die Rechnung lässt sich
 * ohne Datenbank prüfen (app/test/_lenkung_einheit.js). Die Lenkung
 * betrifft nur den eigenen Feed; niemand anderes sieht oder spürt sie.
 *
 * WARUM DIE UMD-HÜLLE
 *
 * Wie bei rang.js: die Prüfläufe legen den übersetzten App-Code als
 * blob:-Modul in den Browser, dort gibt es kein `require`. Eingetragen in
 * UMD_BAUSTEINE (app/test/_modulquelle.js); im Browser als
 * /gemeinsam/lenkung.js eingebunden, setzt `window.Lenkung`.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.Lenkung = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // --------------------------------------------------------- Gewichte --

  /*
   * WARUM FAKTOREN UND KEINE SUMMANDEN
   *
   * In `feed_rang()` dämpft das Alter multiplikativ (0,25 + 0,75 · Frische).
   * Ein Faktor auf die fertige Punktzahl lässt das unangetastet: ein vier
   * Wochen alter Beitrag mit „mehr davon" steht weiter unter einem
   * taggleichen ohne Lenkung, statt den Feed in der Vergangenheit
   * einzufrieren. Ein Summand würde genau den Fehler wiederholen, den
   * Schema 51 beim Alter beschreibt (Resonanz zählte ewig weiter).
   */

  /**
   * „Mehr davon" — je Treffer mal 1,8.
   *
   * Größenordnung: Das gelernte Interesse trägt in `feed_rang()` höchstens
   * 2,5 Punkte bei einer typischen Summe um 4 bis 6. Eine ausdrückliche
   * Bitte soll mindestens so viel zählen wie ein voll getroffenes gelerntes
   * Interesse — also ungefähr eine Verdopplung. 1,8 statt 2, damit ein sehr
   * schwacher Beitrag nicht allein durch ein Hashtag über alles springt.
   */
  const MEHR_FAKTOR = 1.8;

  /**
   * Obergrenze für „mehr davon", egal wie viele Einträge treffen.
   *
   * Wer #laufen, #marathon und den Ort Rheinpark auf „mehr" setzt, soll
   * Laufbeiträge oben sehen — aber nicht so weit oben, dass Beiträge von
   * Gefolgten und frische Beiträge gar nicht mehr vorkommen. 3,0 erlaubt
   * zwei Treffer fast voll (1,8² = 3,24), alles darüber ist gedeckelt.
   */
  const MEHR_DECKEL = 3.0;

  /**
   * „Weniger davon" bei Hashtag, Sound, Ort, Stichwort — je Treffer mal 0,3.
   *
   * „Stark runter", aber nicht weg: ein Spitzenbeitrag mit 10 Punkten steht
   * danach bei 3, also im Mittelfeld; zwei Treffer (0,09) schieben ihn ans
   * Ende. Ausblenden wäre bei einem Hashtag zu grob — ein Beitrag trägt
   * oft fünf Schlagworte, und eines davon ist selten der Grund, warum man
   * ihn nicht sehen will.
   */
  const WENIGER_FAKTOR = 0.3;

  /**
   * „Weniger davon" bei einem Profil — mal 0,02, also fast ausblenden.
   *
   * Das ist YouTubes „Kanal nicht empfehlen": wer eine Person nicht mehr
   * vorgeschlagen bekommen will, meint jeden ihrer Beiträge. 0,02 drückt
   * selbst einen Beitrag mit 10 Punkten unter fast alles andere. Bewusst
   * nicht 0: auf dem Profil und in der Suche bleibt die Person ohnehin
   * erreichbar, und wenn der Feed sonst leer ist, darf sie am Ende stehen.
   * Wer sie gar nicht mehr sehen will, hat Stummschalten und Blockieren.
   */
  const PROFIL_WENIGER_FAKTOR = 0.02;

  /** Kleiner wird kein Faktor — damit die Reihenfolge unter ihnen erhalten bleibt. */
  const BODEN = 0.001;

  /**
   * Höchstens so viele Einträge je Konto. Steht auch als Auslöser in der
   * Datenbank (Schema XX) — hier, damit die Oberfläche vorher Bescheid gibt.
   */
  const HOECHSTZAHL = 200;

  /** Die Arten, in der Reihenfolge, in der die Oberflächen sie anbieten. */
  const ARTEN = [
    { key: 'hashtag', label: 'Hashtag', platzhalter: '#hashtag eingeben …' },
    { key: 'sound', label: 'Sound', platzhalter: 'Sound oder Interpret suchen …' },
    { key: 'ort', label: 'Ort', platzhalter: 'Ort suchen …' },
    { key: 'profil', label: 'Profil', platzhalter: 'Name oder @profil suchen …' },
    { key: 'wort', label: 'Stichwort', platzhalter: 'Wort aus Beschreibung oder Titel …' },
  ];
  const ART_SCHLUESSEL = ARTEN.map((a) => a.key);

  const RICHTUNGEN = ['mehr', 'weniger'];

  // ---------------------------------------------------------- Texte --
  // Einmal hier, damit App und Website wörtlich dasselbe sagen.

  const TITEL = 'Feed steuern';

  const HINWEIS =
    'Gilt für deinen Feed mit Fotos, Reels und Clips. „Mehr davon" hebt passende ' +
    'Beiträge deutlich nach oben, „Weniger davon" drückt sie stark nach unten. Ein ' +
    'Profil auf „Weniger davon" verschwindet fast ganz aus deinem Feed. Auf Profilen ' +
    'und in der Suche bleibt alles auffindbar.';

  const RESET_TITEL = 'Feed zurücksetzen';

  /*
   * Genau das, was `feed_zuruecksetzen()` (Schema XX) tut — nicht mehr und
   * nicht weniger. Ändert sich die Funktion, muss sich dieser Satz ändern.
   */
  const RESET_TEXT =
    'Dabei werden gelöscht: alle Einträge unter „Feed steuern" und alle Beiträge ' +
    'mit „Kein Interesse". Außerdem vergisst der Feed, was er bisher aus deinen ' +
    'Likes, Speicherungen, Reposts und deiner Verweildauer über deine Interessen ' +
    'gelernt hat, und lernt ab jetzt neu. Erhalten bleiben deine Likes, ' +
    'gespeicherten Beiträge, Reposts und wem du folgst; schon gesehene Beiträge ' +
    'rücken weiterhin nach hinten.';

  const KEIN_INTERESSE_TITEL = 'Kein Interesse';
  const KEIN_INTERESSE_LEER =
    'Du hast bei keinem Beitrag „Kein Interesse" gewählt. Das geht im Drei-Punkte-Menü eines Beitrags.';
  const LEER = 'Noch keine Einträge. Wähle oben eine Art und tippe los.';

  // ---------------------------------------------------- Normalisieren --

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function klein(text) {
    return String(text == null ? '' : text).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Aus einer Eingabe wird der Schlüssel, unter dem der Eintrag gespeichert
   * und verglichen wird. `null`, wenn die Eingabe für diese Art nicht taugt.
   *
   *   hashtag  „ Hafen" → „#hafen"  (posts.tags tragen das # mit)
   *   sound    die Kennung aus `sounds.id`
   *   ort      klein geschrieben, wie `posts.location` / `places.ort`
   *   profil   die Kennung aus `profiles.id`
   *   wort     klein geschrieben, mindestens zwei Zeichen
   */
  function normalisieren(art, wert) {
    const roh = String(wert == null ? '' : wert).trim();
    if (!roh) return null;
    if (art === 'hashtag') {
      // Kein # mitten im Wort (die Datenbank weist das ab) und keine Leerzeichen.
      const ohne = roh.replace(/[#\s]+/g, '').toLowerCase();
      if (!ohne || ohne.length > 60) return null;
      return '#' + ohne;
    }
    if (art === 'sound' || art === 'profil') {
      return UUID.test(roh) ? roh.toLowerCase() : null;
    }
    if (art === 'ort') {
      const k = klein(roh);
      return k.length >= 2 && k.length <= 80 ? k : null;
    }
    if (art === 'wort') {
      const k = klein(roh).replace(/^#+/, '');
      return k.length >= 2 && k.length <= 60 ? k : null;
    }
    return null;
  }

  // --------------------------------------------------------- Treffer --

  function verfasser(b) {
    return String((b && (b.user_id || b.userId)) || '').toLowerCase();
  }

  function schlagworte(b) {
    return ((b && b.tags) || []).map((t) => klein(t)).filter(Boolean);
  }

  /** Wörter aus Beschreibung, Titel und Schlagworten — ohne Satzzeichen. */
  function woerter(b) {
    const text = [b && b.description, b && b.title, ...((b && b.tags) || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return text.split(/[\s.,;:!?()[\]{}"'„“”«»‚‘’/\\|+*=<>~^…–—_#-]+/).filter(Boolean);
  }

  function ortTeile(b) {
    const ort = klein(b && b.location);
    if (!ort) return [];
    return [ort, ...ort.split(/\s*[,·/|]\s*/).filter(Boolean)];
  }

  /**
   * Trifft der Eintrag den Beitrag?
   *
   * Der Beitrag ist eine rohe Zeile aus `posts` (user_id, tags, location,
   * sound_id, music, description, title) — so, wie App und Website sie vor
   * dem Umformen in der Hand haben.
   */
  function treffer(b, eintrag) {
    if (!b || !eintrag) return false;
    const wert = String(eintrag.wert || '').toLowerCase();
    if (!wert) return false;
    switch (eintrag.art) {
      case 'hashtag':
        return schlagworte(b).indexOf(wert) !== -1;
      case 'profil':
        return verfasser(b) === wert;
      case 'sound': {
        const id = String(b.sound_id || b.soundId || '').toLowerCase();
        if (id) return id === wert;
        // Ältere Beiträge ohne sound_id: dann zählt der Liedname, wie er
        // beim Anlegen in `music` geschrieben wurde („Titel – Interpret").
        const name = klein(eintrag.anzeige);
        return !!name && klein(b.music) === name;
      }
      case 'ort':
        return ortTeile(b).indexOf(wert) !== -1;
      case 'wort': {
        if (wert.indexOf(' ') !== -1) {
          // Mehrere Wörter: als zusammenhängende Wendung im Text.
          return woerter(b).join(' ').indexOf(wert) !== -1;
        }
        // Ein Wort: Wortanfang genügt („lauf" trifft „laufen", nicht „Ablauf").
        return woerter(b).some((w) => w.indexOf(wert) === 0);
      }
      default:
        return false;
    }
  }

  /**
   * Der Faktor für einen Beitrag. 1 heißt: keine Lenkung greift.
   *
   * Trifft „mehr" und „weniger" zugleich, gilt beides — und „weniger"
   * gewinnt, weil 0,3 · 1,8 = 0,54 unter 1 liegt. Wer #laufen mag, aber
   * den Sound X nicht hören will, bekommt Laufvideos mit Sound X eben nicht
   * nach oben.
   */
  function faktor(b, eintraege) {
    let mehr = 1;
    let weniger = 1;
    for (const e of eintraege || []) {
      if (!e || !treffer(b, e)) continue;
      if (e.richtung === 'mehr') mehr *= MEHR_FAKTOR;
      else if (e.richtung === 'weniger') {
        weniger *= e.art === 'profil' ? PROFIL_WENIGER_FAKTOR : WENIGER_FAKTOR;
      }
    }
    return Math.max(BODEN, Math.min(mehr, MEHR_DECKEL) * weniger);
  }

  /**
   * Faktoren für viele Beiträge — eine Map, nur mit Beiträgen ≠ 1.
   * Genau das, was `rang.js` als `optionen.lenkung` erwartet.
   */
  function faktoren(beitraege, eintraege) {
    const karte = new Map();
    const liste = (eintraege || []).filter(
      (e) => e && ART_SCHLUESSEL.indexOf(e.art) !== -1 && RICHTUNGEN.indexOf(e.richtung) !== -1
    );
    if (liste.length === 0) return karte;
    for (const b of beitraege || []) {
      if (!b || !b.id) continue;
      const f = faktor(b, liste);
      if (f !== 1) karte.set(b.id, f);
    }
    return karte;
  }

  // ------------------------------------------------------ Vorschläge --

  /**
   * Vorschläge beim Tippen — nur aus echten Daten.
   *
   * `quellen` ist, was beide Oberflächen ohnehin geladen haben:
   *   hashtags  [{ tag, posts }]            (hashtags_mit_anzahl)
   *   sounds    [{ id, title, artist, uses }]
   *   places    [{ name, ort, posts }]
   *   users     { kennung: { id, name, handle } }
   *   beitraege [{ tags, location }]        (für Schlagworte/Orte ohne Eintrag)
   *   ich       eigene Kennung(en) — werden bei Profilen ausgelassen
   *
   * Bei Hashtag, Ort und Stichwort steht die eigene Eingabe als erster
   * Vorschlag da, auch wenn es sie noch nirgends gibt: wer #bouldern lenken
   * will, bevor jemand darüber postet, soll das dürfen. Sie ist als
   * „eigene Eingabe" gekennzeichnet, nicht als Fund.
   */
  function vorschlaege(art, eingabe, quellen, grenze) {
    const q = quellen || {};
    const max = typeof grenze === 'number' ? grenze : 8;
    const suche = klein(eingabe).replace(/^[#@]+/, '');
    const raus = [];
    const gesehen = new Set();
    const dazu = (v) => {
      if (!v || !v.wert || gesehen.has(v.wert)) return;
      gesehen.add(v.wert);
      raus.push(v);
    };

    if (art === 'hashtag') {
      const eigen = normalisieren('hashtag', eingabe);
      if (eigen) dazu({ art, wert: eigen, anzeige: eigen, zusatz: 'eigene Eingabe' });
      const zahl = new Map();
      for (const h of q.hashtags || []) {
        const w = normalisieren('hashtag', h && h.tag);
        if (w) zahl.set(w, Math.max(zahl.get(w) || 0, Number(h.posts) || 0));
      }
      for (const b of q.beitraege || []) {
        for (const t of (b && b.tags) || []) {
          const w = normalisieren('hashtag', t);
          if (w && !zahl.has(w)) zahl.set(w, 0);
        }
      }
      [...zahl.entries()]
        .filter(([w]) => !suche || w.indexOf(suche) !== -1)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .forEach(([w, n]) => {
          if (gesehen.has(w)) {
            // Die eigene Eingabe gibt es schon: dann zählt der Fund.
            const v = raus.find((x) => x.wert === w);
            if (v && n > 0) v.zusatz = beitragsZahl(n);
            return;
          }
          dazu({ art, wert: w, anzeige: w, zusatz: n > 0 ? beitragsZahl(n) : '' });
        });
    } else if (art === 'sound') {
      (q.sounds || [])
        .filter((s) => s && s.id && (!suche || klein(s.title).indexOf(suche) !== -1 || klein(s.artist).indexOf(suche) !== -1))
        .sort((a, b) => (Number(b.uses) || 0) - (Number(a.uses) || 0))
        .forEach((s) => {
          const w = normalisieren('sound', s.id);
          if (!w) return;
          dazu({
            art,
            wert: w,
            anzeige: s.artist ? `${s.title} – ${s.artist}` : String(s.title || ''),
            zusatz: Number(s.uses) > 0 ? `${Number(s.uses).toLocaleString('de-DE')} Verwendungen` : '',
          });
        });
    } else if (art === 'ort') {
      const eigen = normalisieren('ort', eingabe);
      if (eigen) dazu({ art, wert: eigen, anzeige: String(eingabe).trim(), zusatz: 'eigene Eingabe' });
      const orte = [];
      for (const p of q.places || []) {
        const w = normalisieren('ort', (p && (p.ort || p.name)) || '');
        if (!w) continue;
        const name = String(p.name || p.ort);
        const ort = String(p.ort || '');
        orte.push({
          wert: w,
          anzeige: ort && klein(ort) !== klein(name) ? ort : name,
          zusatz: ort && klein(ort) !== klein(name) ? name : '',
          zahl: Number(p.posts) || 0,
          text: klein(name + ' ' + ort),
        });
      }
      for (const b of q.beitraege || []) {
        const w = normalisieren('ort', b && b.location);
        if (w) orte.push({ wert: w, anzeige: String(b.location).trim(), zusatz: '', zahl: 0, text: w });
      }
      orte
        .filter((o) => !suche || o.text.indexOf(suche) !== -1)
        .sort((a, b) => b.zahl - a.zahl || a.anzeige.localeCompare(b.anzeige))
        .forEach((o) => {
          if (gesehen.has(o.wert)) return;
          dazu({ art, wert: o.wert, anzeige: o.anzeige, zusatz: o.zusatz });
        });
    } else if (art === 'profil') {
      const ich = new Set(
        [].concat(q.ich || []).concat(['me']).map((x) => String(x).toLowerCase())
      );
      Object.keys(q.users || {})
        .map((k) => q.users[k])
        .filter((u) => u && u.id && !ich.has(String(u.id).toLowerCase()))
        .filter((u) => !suche || klein(u.name).indexOf(suche) !== -1 || klein(u.handle).replace(/^@/, '').indexOf(suche) !== -1)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
        .forEach((u) => {
          const w = normalisieren('profil', u.id);
          if (!w) return;
          const handle = u.handle ? (String(u.handle).startsWith('@') ? u.handle : '@' + u.handle) : '';
          dazu({ art, wert: w, anzeige: handle || String(u.name || ''), zusatz: handle ? String(u.name || '') : '' });
        });
    } else if (art === 'wort') {
      const eigen = normalisieren('wort', eingabe);
      if (eigen) dazu({ art, wert: eigen, anzeige: eigen, zusatz: 'in Beschreibung, Titel oder Hashtags' });
    }

    return raus.slice(0, max);
  }

  function beitragsZahl(n) {
    return n === 1 ? '1 Beitrag' : `${Number(n).toLocaleString('de-DE')} Beiträge`;
  }

  // ---------------------------------------------------------- Anzeige --

  function artName(art) {
    const a = ARTEN.find((x) => x.key === art);
    return a ? a.label : art;
  }

  /** Eine Zeile in der Liste: „#hafen", „Sound: Golden Hour – Lys", … */
  function eintragText(e) {
    if (!e) return '';
    const name = e.anzeige || e.wert;
    if (e.art === 'hashtag' || e.art === 'profil') return String(name);
    if (e.art === 'wort') return `Stichwort: „${name}"`;
    return `${artName(e.art)}: ${name}`;
  }

  function richtungText(richtung) {
    return richtung === 'mehr' ? 'Mehr davon' : 'Weniger davon';
  }

  /** Neueste zuerst; „mehr" vor „weniger", damit die Liste zweigeteilt liest. */
  function sortiert(eintraege) {
    return (eintraege || []).slice().sort((a, b) => {
      if (a.richtung !== b.richtung) return a.richtung === 'mehr' ? -1 : 1;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
  }

  return {
    MEHR_FAKTOR: MEHR_FAKTOR,
    MEHR_DECKEL: MEHR_DECKEL,
    WENIGER_FAKTOR: WENIGER_FAKTOR,
    PROFIL_WENIGER_FAKTOR: PROFIL_WENIGER_FAKTOR,
    BODEN: BODEN,
    HOECHSTZAHL: HOECHSTZAHL,
    ARTEN: ARTEN,
    RICHTUNGEN: RICHTUNGEN,
    TITEL: TITEL,
    HINWEIS: HINWEIS,
    RESET_TITEL: RESET_TITEL,
    RESET_TEXT: RESET_TEXT,
    KEIN_INTERESSE_TITEL: KEIN_INTERESSE_TITEL,
    KEIN_INTERESSE_LEER: KEIN_INTERESSE_LEER,
    LEER: LEER,
    normalisieren: normalisieren,
    treffer: treffer,
    faktor: faktor,
    faktoren: faktoren,
    vorschlaege: vorschlaege,
    artName: artName,
    eintragText: eintragText,
    richtungText: richtungText,
    sortiert: sortiert,
  };
});
