/**
 * Eigene Bildschirmzeit — eine Rechnung für App und Website (Kasten 22).
 *
 * WARUM ES DAS GIBT
 *
 * Henrik am 06.10.2026: „Nutzer sollen selbst Limits festlegen können. Sie
 * sollen auch zwischen Unterpunkten differenzieren können (z. B. Messenger
 * immer, Videos 20 min pro Tag), da die Unterpunkte verschiedenen Tätigkeiten
 * nachgehen."
 *
 * Vorbilder: iOS-Bildschirmzeit (App-Limits je Kategorie, „Immer erlaubt",
 * Auszeit, „Noch 15 Minuten", Code zum Verlängern), TikTok (Tageslimit,
 * Passcode, Pausen-Erinnerung, Familienkopplung), Instagram (Tageslimit,
 * „Pause machen"), YouTube (Pausen-Erinnerung).
 *
 * WAS HIER STEHT — UND WAS NICHT
 *
 * Hier steht, welcher Bildschirm zu welchem Bereich gehört, wie Regeln
 * aussehen, ob ein Bereich gerade gesperrt ist, wie viel Zeit bleibt, und ob
 * eine neue Regel lockerer ist als die alte. App und Website rechnen damit
 * dieselbe Sperre — eine zweite Rechnung liefe irgendwann auseinander.
 *
 * Gezählt wird in Supabase (bildschirmzeit_zaehlen, mit Obergrenze), damit
 * App und Website zusammen zählen. Ob ein Kind die Regeln seiner Eltern
 * lockern darf, entscheidet die Datenbank (bildschirmzeit_setzen ruft dort
 * bildschirmzeit_lockerer — dieselben Regeln wie `lockerer()` unten; der
 * Prüflauf test:bildschirmzeit vergleicht beide).
 *
 * MODI JE BEREICH
 *
 *   standard  kein eigenes Limit — zählt aber zum Tageslimit gesamt
 *   immer     immer erlaubt — auch in der Auszeit und wenn das Tageslimit
 *             gesamt erreicht ist; zählt nicht zum Tageslimit gesamt
 *   limit     eigenes Limit in Minuten je Tag (Werktag / Wochenende)
 *   gesperrt  zu, nur mit Entsperrcode für eine Weile offen
 *
 * UMD-Hülle wie story.js: der Server lädt die Datei mit `require`, der
 * Browser als <script> (setzt `window.Bildschirmzeit`), die Prüfläufe als
 * blob:-Modul. Eingetragen in UMD_BAUSTEINE (app/test/_modulquelle.js).
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.Bildschirmzeit = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /*
   * Die Bereiche — so, wie es sie in der Navigation wirklich gibt
   * (app/constants/navigation.ts, render() in web/public/app.js).
   * Reihenfolge = Reihenfolge im Blatt. Die Schlüssel stehen gleich in der
   * Datenbank (Prüfregel an bildschirmzeit_nutzung.bereich).
   */
  const BEREICHE = [
    { key: 'chats', label: 'Messenger-Chats', hinweis: 'Chats, Kontakte und dein Messenger-Profil' },
    { key: 'anrufe', label: 'Anrufe', hinweis: 'Sprach- und Videoanrufe' },
    { key: 'storys', label: 'Storys & Insight Time', hinweis: 'Storys ansehen und aufnehmen, Insight Time, Kamera im Messenger' },
    { key: 'friendmap', label: 'Friend-Map', hinweis: 'Die Karte im Messenger' },
    { key: 'videos', label: 'Videos (Home & Hochformat)', hinweis: 'Home-Feed, Hochformat-Videos und Video-Profile' },
    { key: 'querformat', label: 'Querformat-Videos', hinweis: 'Querformat-Übersicht und der Player' },
    { key: 'live', label: 'Livestreams', hinweis: 'Livestreams ansehen und senden' },
    { key: 'communitys', label: 'Communitys', hinweis: 'Communitys, ihre Chats und dein Community-Profil' },
    { key: 'suche', label: 'Suche & Explorer', hinweis: 'Suche in Videos und Communitys, Explorer-Seiten' },
  ];
  const BEREICH_SCHLUESSEL = BEREICHE.map((b) => b.key);

  /** Die Modi in der Reihenfolge, in der das Blatt sie anbietet. */
  const MODI = [
    { key: 'standard', label: 'Kein eigenes Limit', hinweis: 'Zählt zum Tageslimit gesamt.' },
    { key: 'immer', label: 'Immer erlaubt', hinweis: 'Bleibt offen — auch in der Auszeit und wenn das Tageslimit gesamt erreicht ist.' },
    { key: 'limit', label: 'Limit pro Tag', hinweis: 'Eigenes Limit in Minuten, werktags und am Wochenende.' },
    { key: 'gesperrt', label: 'Gesperrt', hinweis: 'Nur mit Entsperrcode für eine Weile offen.' },
  ];
  const MODUS_SCHLUESSEL = MODI.map((m) => m.key);

  /** Strenge eines Modus: kleiner = strenger. Für `lockerer()`. */
  const RANG = { gesperrt: 0, limit: 1, standard: 2, immer: 3 };

  /** Angebotene Minuten — gleich in App und Website. */
  const LIMIT_MINUTEN = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240];
  const GESAMT_MINUTEN = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360];
  const PAUSE_MINUTEN = [0, 10, 15, 20, 30, 45, 60, 90];
  /** Auszeit-Uhrzeiten in halben Stunden. */
  const UHRZEITEN = (function () {
    const liste = [];
    for (let m = 0; m < 1440; m += 30) liste.push(uhrzeit(m));
    return liste;
  })();

  /** „15 Min. mehr" — einmal je Ziel und Tag (Datenbank: bildschirmzeit_mehr). */
  const MEHR_MINUTEN = 15;
  /** Hinweis so viele Sekunden vor Ablauf. */
  const HINWEIS_SEKUNDEN = 5 * 60;
  /** Nach so langer Abwesenheit beginnt die Pausen-Uhr von vorn. */
  const PAUSE_RUHE_SEKUNDEN = 5 * 60;
  /** So oft schicken App und Website die gemessene Zeit (Sekunden). */
  const TAKT_SEKUNDEN = 30;
  /** Mehr nimmt bildschirmzeit_zaehlen je Aufruf nicht an. */
  const HOECHSTENS_JE_AUFRUF = 120;

  /** „15 Min. mehr" in der Auszeit: höchstens einmal in so vielen Stunden. */
  const AUSZEIT_MEHR_STUNDEN = 12;

  /** Freigaben mit Entsperrcode: 15 Min., 1 Std., für heute (null). */
  const CODE_MINUTEN = [15, 60, null];

  const TEXTE = {
    abschnitt: 'Bildschirmzeit',
    erklaerung:
      'Lege fest, wie lange du All Media am Tag nutzen willst — gesamt und je Bereich. ' +
      'Gezählt wird nur, solange der Bereich wirklich offen und im Vordergrund ist; App und Website zählen zusammen.',
    auszeitErklaerung:
      'In der Auszeit sind nur Bereiche mit „Immer erlaubt" offen. ' +
      'Das ist etwas anderes als die Ruhezeiten unter Mitteilungen: die schalten nur Töne und Mitteilungen stumm.',
    elternGesetzt: (name) =>
      `Diese Limits hat ${name} als Elternteil festgelegt. Du kannst sie nur strenger machen.`,
    keinCode:
      'Es ist noch kein Entsperrcode gesetzt. Lege ihn unter Einstellungen → Allgemein → Sicherheits-/Entsperrcode fest.',
    pauseTitel: 'Zeit für eine Pause?',
    pauseText: (min) => `Du bist seit ${dauerText(min * 60)} am Stück hier. Kurz aufstehen, etwas trinken, aus dem Fenster sehen.`,
  };

  // ---------------------------------------------------------------- Zeiten --

  function zwei(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /** 1320 → „22:00". */
  function uhrzeit(minute) {
    const m = ((Math.round(minute) % 1440) + 1440) % 1440;
    return zwei(Math.floor(m / 60)) + ':' + zwei(m % 60);
  }

  /** „22:00" → 1320; Unsinn → null. */
  function minuteAus(text) {
    const t = /^(\d{1,2}):(\d{2})$/.exec(String(text == null ? '' : text).trim());
    if (!t) return null;
    const h = Number(t[1]);
    const m = Number(t[2]);
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  }

  /** Liegt die Minute im Fenster? Fenster über Mitternacht (22–7) geht. */
  function imFenster(minute, von, bis) {
    if (von === bis) return false;
    return von < bis ? minute >= von && minute < bis : minute >= von || minute < bis;
  }

  /** Minuten bis zum nächsten Zeitpunkt `ziel` (0..1439), von `minute` aus. */
  function minutenBis(minute, ziel) {
    return (((ziel - minute) % 1440) + 1440) % 1440;
  }

  /**
   * Datum, Minute und Wochentag in der Zeitzone des Kontos.
   *
   * Der Tag ist der Kalendertag in der gespeicherten Zeitzone
   * (bildschirmzeit_regeln.zeitzone) — dieselbe Rechnung wie in der
   * Datenbank: `(now() at time zone zeitzone)::date`. Ohne Intl (oder bei
   * einer unbekannten Zone) gilt die Uhr des Geräts.
   */
  function ortszeit(jetzt, zeitzone) {
    const d = jetzt instanceof Date ? jetzt : new Date(jetzt == null ? Date.now() : jetzt);
    try {
      if (zeitzone && typeof Intl === 'object' && Intl.DateTimeFormat) {
        const teile = new Intl.DateTimeFormat('en-US', {
          timeZone: zeitzone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          weekday: 'short',
          hourCycle: 'h23',
        }).formatToParts(d);
        const w = {};
        for (const t of teile) w[t.type] = t.value;
        const stunde = Number(w.hour) % 24;
        const wochentag = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[w.weekday];
        if (w.year && w.month && w.day && wochentag && !Number.isNaN(stunde)) {
          return {
            tag: `${w.year}-${w.month}-${w.day}`,
            minute: stunde * 60 + Number(w.minute),
            wochentag,
            wochenende: wochentag >= 6,
          };
        }
      }
    } catch (e) {
      /* unbekannte Zone — dann die Uhr des Geräts */
    }
    const wochentag = d.getDay() === 0 ? 7 : d.getDay();
    return {
      tag: `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`,
      minute: d.getHours() * 60 + d.getMinutes(),
      wochentag,
      wochenende: wochentag >= 6,
    };
  }

  /** Die Zeitzone des Geräts, z. B. „Europe/Berlin"; ohne Intl null. */
  function geraetezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch (e) {
      return null;
    }
  }

  /** 4500 → „1 Std. 15 Min."; 40 → „1 Min."; 0 → „0 Min.". */
  function dauerText(sekunden) {
    const s = Math.max(0, Math.round(Number(sekunden) || 0));
    if (s > 0 && s < 60) return '1 Min.';
    const min = Math.round(s / 60);
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (!h) return `${m} Min.`;
    return m ? `${h} Std. ${m} Min.` : `${h} Std.`;
  }

  /** Minuten als Auswahltext: 90 → „1 Std. 30 Min."; null → „Aus". */
  function minutenText(minuten, leer) {
    if (minuten == null) return leer || 'Aus';
    return dauerText(minuten * 60);
  }

  // ---------------------------------------------------------------- Regeln --

  function ganzzahl(wert, min, max) {
    if (wert === null || wert === undefined || wert === '') return null;
    const n = Number(wert);
    if (!Number.isInteger(n) || n < min || n > max) return undefined; // undefined = ungültig
    return n;
  }

  /**
   * Regeln in die feste Form bringen. Unbekanntes fällt weg, Fehlendes
   * bekommt seinen Auslieferungszustand. Das Ergebnis besteht `pruefen()`.
   */
  function normalisieren(roh) {
    const r = roh && typeof roh === 'object' ? roh : {};
    const g = r.gesamt && typeof r.gesamt === 'object' ? r.gesamt : {};
    const zahl = (w) => {
      const n = ganzzahl(w, 1, 1440);
      return n === undefined ? null : n;
    };
    const bereiche = {};
    const quelle = r.bereiche && typeof r.bereiche === 'object' ? r.bereiche : {};
    for (const key of BEREICH_SCHLUESSEL) {
      const e = quelle[key];
      if (!e || typeof e !== 'object' || !MODUS_SCHLUESSEL.includes(e.modus) || e.modus === 'standard') continue;
      if (e.modus === 'limit') {
        const werktag = zahl(e.werktag);
        if (werktag == null) continue; // ein Limit ohne Minuten ist keins
        bereiche[key] = { modus: 'limit', werktag, wochenende: zahl(e.wochenende) };
      } else {
        bereiche[key] = { modus: e.modus };
      }
    }
    const a = r.auszeit && typeof r.auszeit === 'object' ? r.auszeit : {};
    const von = minuteAus(a.von);
    const bis = minuteAus(a.bis);
    const auszeit = {
      an: a.an === true && von != null && bis != null && von !== bis,
      von: von == null ? '22:00' : uhrzeit(von),
      bis: bis == null ? '07:00' : uhrzeit(bis),
    };
    const pause = ganzzahl(r.pause, 0, 240);
    return {
      gesamt: { werktag: zahl(g.werktag), wochenende: zahl(g.wochenende) },
      bereiche,
      auszeit,
      pause: pause == null || pause === undefined ? 0 : pause,
    };
  }

  /**
   * Prüft Regeln, wie sie gespeichert werden sollen. Gibt den Grund oder
   * null. Dieselben Prüfungen macht bildschirmzeit_pruefen() in der Datenbank.
   */
  function pruefen(r) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return 'Die Regeln sind unvollständig.';
    for (const k of Object.keys(r)) {
      if (!['gesamt', 'bereiche', 'auszeit', 'pause'].includes(k)) return `Unbekannte Angabe „${k}".`;
    }
    const g = r.gesamt || {};
    for (const w of ['werktag', 'wochenende']) {
      if (ganzzahl(g[w], 1, 1440) === undefined) return 'Das Tageslimit muss zwischen 1 und 1440 Minuten liegen.';
    }
    for (const [key, e] of Object.entries(r.bereiche || {})) {
      if (!BEREICH_SCHLUESSEL.includes(key)) return `Unbekannter Bereich „${key}".`;
      if (!e || !MODUS_SCHLUESSEL.includes(e.modus)) return 'Unbekannte Einstellung für einen Bereich.';
      for (const w of ['werktag', 'wochenende']) {
        if (ganzzahl(e[w], 1, 1440) === undefined) return 'Ein Limit muss zwischen 1 und 1440 Minuten liegen.';
      }
      if (e.modus === 'limit' && e.werktag == null) return 'Ein Limit braucht eine Minutenzahl.';
    }
    const a = r.auszeit || {};
    if (a.an) {
      const von = minuteAus(a.von);
      const bis = minuteAus(a.bis);
      if (von == null || bis == null) return 'Die Auszeit braucht Beginn und Ende.';
      if (von === bis) return 'Beginn und Ende der Auszeit sind gleich.';
    }
    if (ganzzahl(r.pause == null ? 0 : r.pause, 0, 240) === undefined) return 'Die Pausen-Erinnerung muss zwischen 0 und 240 Minuten liegen.';
    return null;
  }

  /** Das Limit, das heute gilt: am Wochenende der eigene Wert, sonst werktags. */
  function heutigesLimit(eintrag, wochenende) {
    if (!eintrag || eintrag.werktag == null) return null;
    return wochenende && eintrag.wochenende != null ? eintrag.wochenende : eintrag.werktag;
  }

  function modusVon(regeln, bereich) {
    const e = regeln && regeln.bereiche && regeln.bereiche[bereich];
    return e && MODUS_SCHLUESSEL.includes(e.modus) ? e.modus : 'standard';
  }

  /**
   * Ist `neu` irgendwo lockerer als `alt`? Gibt den ersten Grund oder null.
   *
   * Gebraucht, wenn die Eltern die Regeln gesetzt haben: dann darf das Kind
   * nur strenger werden. Dieselbe Rechnung steht in der Datenbank
   * (bildschirmzeit_lockerer) — entschieden wird dort.
   */
  function lockerer(altRoh, neuRoh) {
    const alt = normalisieren(altRoh);
    const neu = normalisieren(neuRoh);

    for (const wochenende of [false, true]) {
      const a = heutigesLimit(alt.gesamt, wochenende);
      const n = heutigesLimit(neu.gesamt, wochenende);
      if (a != null && (n == null || n > a)) return 'Das Tageslimit gesamt darf nur kleiner werden.';
    }

    for (const b of BEREICHE) {
      const ma = modusVon(alt, b.key);
      const mn = modusVon(neu, b.key);
      if (RANG[mn] > RANG[ma]) return `${b.label}: nur strenger, nicht lockerer.`;
      if (ma === 'limit' && mn === 'limit') {
        for (const wochenende of [false, true]) {
          const a = heutigesLimit(alt.bereiche[b.key], wochenende);
          const n = heutigesLimit(neu.bereiche[b.key], wochenende);
          if (n > a) return `${b.label}: das Limit darf nur kleiner werden.`;
        }
      }
    }

    if (alt.auszeit.an) {
      if (!neu.auszeit.an) return 'Die Auszeit darf nicht ausgeschaltet werden.';
      const av = minuteAus(alt.auszeit.von);
      const ab = minuteAus(alt.auszeit.bis);
      const nv = minuteAus(neu.auszeit.von);
      const nb = minuteAus(neu.auszeit.bis);
      for (let m = 0; m < 1440; m++) {
        if (imFenster(m, av, ab) && !imFenster(m, nv, nb)) return 'Die Auszeit darf nur länger werden.';
      }
    }

    if (alt.pause > 0 && (neu.pause === 0 || neu.pause > alt.pause)) {
      return 'Die Pausen-Erinnerung darf nur häufiger kommen.';
    }
    return null;
  }

  // ------------------------------------------------------------- Ansichten --

  /**
   * Zu welchem Bereich gehört der Bildschirm, der gerade offen ist?
   *
   * `area`/`sub` wie in der Navigation (messenger/chats, videos/landscape …),
   * `overlay` die offene Vollbildansicht (chat, call, story, storyEditor,
   * insights, camera, livestream, clip, explorer, community, profile,
   * contacts, followers, following …) oder null. `zusatz` unterscheidet bei
   * der Kamera: 'story' | 'chat' | 'beitrag'.
   *
   * null heißt: wird nicht gezählt und nie gesperrt — die Einstellungen
   * müssen immer erreichbar bleiben, sonst ließe sich ein Limit nie ändern.
   */
  function bereichFuer(area, sub, overlay, zusatz) {
    if (overlay) {
      switch (overlay) {
        case 'chat':
          return area === 'communities' ? 'communitys' : 'chats';
        case 'call':
          return 'anrufe';
        case 'story':
        case 'storyEditor':
        case 'insights':
          return 'storys';
        case 'camera':
          if (zusatz === 'chat') return area === 'communities' ? 'communitys' : 'chats';
          if (zusatz === 'beitrag') return 'videos';
          return 'storys';
        case 'livestream':
          return 'live';
        case 'clip':
          return 'querformat';
        case 'explorer':
          return 'suche';
        case 'community':
          return 'communitys';
        case 'contacts':
        case 'editSelectedContacts':
          return 'chats';
        case 'profile':
        case 'followers':
        case 'following':
        case 'avatarViewer':
          if (area === 'messenger') return 'chats';
          if (area === 'communities') return 'communitys';
          if (area === 'videos') return 'videos';
          return null;
        default:
          break;
      }
    }
    if (area === 'messenger') {
      if (sub === 'friendmap') return 'friendmap';
      if (sub === 'camera') return 'storys';
      return 'chats';
    }
    if (area === 'videos') {
      if (sub === 'landscape') return 'querformat';
      if (sub === 'search') return 'suche';
      return 'videos';
    }
    if (area === 'communities') {
      if (sub === 'search') return 'suche';
      return 'communitys';
    }
    return null;
  }

  function bereichName(key) {
    const b = BEREICHE.find((x) => x.key === key);
    return b ? b.label : key;
  }

  // ---------------------------------------------------------------- Status --

  /**
   * Bis zu welcher Nutzung (Sekunden) ein Ziel heute offen ist.
   *
   * `basis` ist die erlaubte Zeit ohne Freigabe (Limit · 60, bei „Gesperrt"
   * 0). Jede Freigabe gilt ab der Nutzung, die beim Freigeben gezählt war
   * (`f.basis`, rechnet die Datenbank) — sonst brächte „15 Min. mehr" nichts,
   * wenn das Limit am Nachmittag unter die schon genutzte Zeit gesenkt wurde.
   * Infinity = für heute offen.
   */
  function grenzeMit(freigaben, ziel, tag, basis) {
    const passend = (freigaben || [])
      .filter((f) => f.ziel === ziel && ziel !== 'auszeit' && (!tag || !f.tag || f.tag === tag))
      .slice()
      .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    let grenze = basis;
    for (const f of passend) {
      if (f.minuten == null) return Infinity;
      grenze = Math.max(grenze, Number(f.basis) || 0) + (Number(f.minuten) || 0) * 60;
    }
    return grenze;
  }

  /** Ist die Auszeit gerade durch eine Freigabe aufgehoben? */
  function auszeitFrei(freigaben, jetztMs) {
    for (const f of freigaben || []) {
      if (f.ziel !== 'auszeit') continue;
      const ab = Date.parse(f.created_at);
      if (Number.isNaN(ab)) continue;
      const min = f.minuten == null ? 1440 : Number(f.minuten);
      if (jetztMs >= ab && jetztMs < ab + min * 60000) return true;
    }
    return false;
  }

  /**
   * Ist „15 Min. mehr" für dieses Ziel noch frei? Einmal je Bereich bzw.
   * Tageslimit und Tag; für die Auszeit einmal in 12 Stunden (sie geht über
   * Mitternacht). Dieselbe Regel in bildschirmzeit_mehr().
   */
  function mehrNochFrei(freigaben, ziel, tag, jetztMs) {
    const t = jetztMs == null ? Date.now() : jetztMs;
    return !(freigaben || []).some((f) => {
      if (f.ziel !== ziel || f.art !== 'mehr') return false;
      if (ziel === 'auszeit') return t - Date.parse(f.created_at) < AUSZEIT_MEHR_STUNDEN * 3600000;
      return !tag || !f.tag || f.tag === tag;
    });
  }

  /** Gezählte Sekunden heute in allen Bereichen, die zum Tageslimit gesamt zählen. */
  function gesamtGenutzt(regeln, nutzung) {
    let s = 0;
    for (const key of BEREICH_SCHLUESSEL) {
      if (modusVon(regeln, key) === 'immer') continue;
      s += Number((nutzung || {})[key]) || 0;
    }
    return s;
  }

  /** Alle gezählten Sekunden heute — auch in „Immer erlaubt"-Bereichen. */
  function summe(nutzung) {
    let s = 0;
    for (const key of BEREICH_SCHLUESSEL) s += Number((nutzung || {})[key]) || 0;
    return s;
  }

  /**
   * Ist der Bereich gerade offen?
   *
   *   eingabe = { regeln, nutzung: { bereich: sekunden }, freigaben: [...],
   *               jetzt: Date|ms, zeitzone, tag? }
   *
   * Ergebnis:
   *   offen        false = Sperrseite zeigen
   *   grund        'auszeit' | 'gesperrt' | 'limit' | 'gesamt' | null
   *   ziel         wofür eine Freigabe gelten würde: Bereich, 'gesamt', 'auszeit'
   *   rest         Sekunden bis zur nächsten Sperre (null = keine in Sicht)
   *   restGrund    welche Grenze als nächste kommt
   *   hinweis      true, wenn rest ≤ 5 Minuten
   *   mehrMoeglich „15 Min. mehr" ist heute für dieses Ziel noch frei
   */
  function status(eingabe, bereich) {
    const regeln = normalisieren(eingabe && eingabe.regeln);
    const nutzung = (eingabe && eingabe.nutzung) || {};
    const freigaben = (eingabe && eingabe.freigaben) || [];
    const jetztMs =
      eingabe && eingabe.jetzt != null
        ? eingabe.jetzt instanceof Date
          ? eingabe.jetzt.getTime()
          : Number(eingabe.jetzt)
        : Date.now();
    const ort = ortszeit(jetztMs, eingabe && eingabe.zeitzone);
    const tag = (eingabe && eingabe.tag) || ort.tag;

    const offen = { offen: true, grund: null, ziel: null, rest: null, restGrund: null, hinweis: false, mehrMoeglich: false };
    if (!bereich || !BEREICH_SCHLUESSEL.includes(bereich)) return offen;
    const modus = modusVon(regeln, bereich);
    if (modus === 'immer') return offen;

    const mehrFrei = (ziel) => mehrNochFrei(freigaben, ziel, tag, jetztMs);
    const zu = (grund, ziel) => ({
      offen: false,
      grund,
      ziel,
      rest: 0,
      restGrund: grund,
      hinweis: false,
      mehrMoeglich: grund !== 'gesperrt' && mehrFrei(ziel),
    });

    // 1. Auszeit
    const a = regeln.auszeit;
    const av = minuteAus(a.von);
    const ab = minuteAus(a.bis);
    const frei = auszeitFrei(freigaben, jetztMs);
    if (a.an && imFenster(ort.minute, av, ab) && !frei) return zu('auszeit', 'auszeit');

    const grenzen = [];
    const genutzt = Number(nutzung[bereich]) || 0;

    // 2. Gesperrt / eigenes Limit
    if (modus === 'gesperrt' || modus === 'limit') {
      const basis = modus === 'limit' ? heutigesLimit(regeln.bereiche[bereich], ort.wochenende) * 60 : 0;
      const erlaubt = grenzeMit(freigaben, bereich, tag, basis);
      if (genutzt >= erlaubt) return zu(modus === 'gesperrt' ? 'gesperrt' : 'limit', bereich);
      if (erlaubt !== Infinity) grenzen.push([erlaubt - genutzt, modus === 'gesperrt' ? 'gesperrt' : 'limit']);
    }

    // 3. Tageslimit gesamt
    const gesamt = heutigesLimit(regeln.gesamt, ort.wochenende);
    if (gesamt != null) {
      const erlaubt = grenzeMit(freigaben, 'gesamt', tag, gesamt * 60);
      const g = gesamtGenutzt(regeln, nutzung);
      if (g >= erlaubt) return zu('gesamt', 'gesamt');
      if (erlaubt !== Infinity) grenzen.push([erlaubt - g, 'gesamt']);
    }

    // 4. Die nächste Auszeit kündigt sich an
    if (a.an && !imFenster(ort.minute, av, ab)) {
      grenzen.push([minutenBis(ort.minute, av) * 60, 'auszeit']);
    } else if (a.an && frei) {
      // Freigegeben: bis die Freigabe abläuft.
      let bisMs = 0;
      for (const f of freigaben) {
        if (f.ziel !== 'auszeit') continue;
        const abMs = Date.parse(f.created_at);
        const ende = abMs + (f.minuten == null ? 1440 : Number(f.minuten)) * 60000;
        if (jetztMs >= abMs && ende > bisMs) bisMs = ende;
      }
      const restAuszeit = minutenBis(ort.minute, ab) * 60;
      grenzen.push([Math.min(restAuszeit, Math.max(0, Math.round((bisMs - jetztMs) / 1000))), 'auszeit']);
    }

    if (!grenzen.length) return offen;
    grenzen.sort((x, y) => x[0] - y[0]);
    const [rest, restGrund] = grenzen[0];
    return {
      offen: true,
      grund: null,
      ziel: null,
      rest: Math.max(0, Math.round(rest)),
      restGrund,
      hinweis: rest <= HINWEIS_SEKUNDEN,
      mehrMoeglich: false,
    };
  }

  /** Überschrift und Satz für die Sperrseite. */
  function sperrText(st, bereich, elternName) {
    const name = bereichName(bereich);
    const titel =
      st.grund === 'auszeit'
        ? 'Auszeit'
        : st.grund === 'gesamt'
          ? 'Tageslimit erreicht'
          : st.grund === 'gesperrt'
            ? `${name} ist gesperrt`
            : `Limit für ${name} erreicht`;
    const satz =
      st.grund === 'auszeit'
        ? 'Gerade ist Auszeit. Offen sind nur Bereiche mit „Immer erlaubt".'
        : st.grund === 'gesamt'
          ? 'Dein Tageslimit für All Media ist für heute aufgebraucht. Bereiche mit „Immer erlaubt" bleiben offen.'
          : st.grund === 'gesperrt'
            ? 'Dieser Bereich ist in deiner Bildschirmzeit gesperrt.'
            : `Dein Limit für ${name} ist für heute aufgebraucht. Die anderen Bereiche bleiben offen.`;
    const code = elternName
      ? `Mit dem Entsperrcode von ${elternName} lässt sich der Bereich freigeben.`
      : 'Mit deinem Entsperrcode lässt sich der Bereich freigeben.';
    return { titel, satz, code };
  }

  /** Der Satz für den Hinweis kurz vor Ablauf. */
  function hinweisText(st, bereich) {
    const zeit = dauerText(st.rest);
    if (st.restGrund === 'auszeit') return `In ${zeit} beginnt deine Auszeit`;
    if (st.restGrund === 'gesamt') return `Noch ${zeit} bis zu deinem Tageslimit`;
    return `Noch ${zeit} für ${bereichName(bereich)} heute`;
  }

  /** Was in den Einstellungen rechts neben dem Punkt steht. */
  function wertText(punkt, regelnRoh, nutzung) {
    const r = normalisieren(regelnRoh);
    if (punkt === 'uebersicht') return nutzung ? dauerText(summe(nutzung)) : '';
    if (punkt === 'gesamt') {
      if (r.gesamt.werktag == null) return 'Aus';
      const w = minutenText(r.gesamt.werktag);
      return r.gesamt.wochenende != null && r.gesamt.wochenende !== r.gesamt.werktag
        ? `${w} · Wochenende ${minutenText(r.gesamt.wochenende)}`
        : w;
    }
    if (punkt === 'bereiche') {
      const n = Object.keys(r.bereiche).length;
      return n ? `${n} festgelegt` : 'Keine';
    }
    if (punkt === 'auszeit') return r.auszeit.an ? `${r.auszeit.von} – ${r.auszeit.bis}` : 'Aus';
    if (punkt === 'pause') return r.pause ? `alle ${minutenText(r.pause)}` : 'Aus';
    return '';
  }

  /** Was neben einem Bereich steht: „Immer erlaubt", „20 Min. · Wochenende 40 Min." … */
  function bereichWertText(regelnRoh, bereich) {
    const r = normalisieren(regelnRoh);
    const e = r.bereiche[bereich];
    const modus = modusVon(r, bereich);
    if (modus === 'limit') {
      const w = minutenText(e.werktag);
      return e.wochenende != null && e.wochenende !== e.werktag ? `${w} · Wochenende ${minutenText(e.wochenende)}` : `${w} pro Tag`;
    }
    return (MODI.find((m) => m.key === modus) || MODI[0]).label;
  }

  /**
   * Die letzten sieben Tage aus den gemessenen Zeilen. Nur was gezählt wurde
   * — ein Tag ohne Zeile steht mit 0 da, nicht mit einer Schätzung.
   *
   *   zeilen = [{ tag: 'YYYY-MM-DD', bereich, sekunden }]
   *   heute  = 'YYYY-MM-DD' (Tag in der Zeitzone des Kontos)
   *
   * Ergebnis: [{ tag, wochentag: 'Mo', gesamt, bereiche: {key: s} }], ältester zuerst.
   */
  function woche(zeilen, heute) {
    const NAMEN = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const [y, m, d] = String(heute).split('-').map(Number);
    const tage = [];
    for (let i = 6; i >= 0; i--) {
      const t = new Date(Date.UTC(y, m - 1, d - i));
      const key = `${t.getUTCFullYear()}-${zwei(t.getUTCMonth() + 1)}-${zwei(t.getUTCDate())}`;
      tage.push({ tag: key, wochentag: NAMEN[t.getUTCDay()], gesamt: 0, bereiche: {} });
    }
    for (const z of zeilen || []) {
      const eintrag = tage.find((t) => t.tag === String(z.tag).slice(0, 10));
      if (!eintrag || !BEREICH_SCHLUESSEL.includes(z.bereich)) continue;
      const s = Number(z.sekunden) || 0;
      eintrag.bereiche[z.bereich] = (eintrag.bereiche[z.bereich] || 0) + s;
      eintrag.gesamt += s;
    }
    return tage;
  }

  // ------------------------------------------------------------ Messung --

  /**
   * Die Uhr, die App und Website gleich führen: Sekunden je Bereich sammeln,
   * solange er offen UND sichtbar ist; abgeben, wenn der Bereich wechselt,
   * die Ansicht in den Hintergrund geht oder der Takt (30 s) voll ist.
   *
   *   const uhr = Bildschirmzeit.uhr();
   *   uhr.setzen('videos', true, Date.now());   // Bereich, sichtbar
   *   uhr.abgeben(Date.now())  → [{ bereich, sekunden }]  (zum Schicken)
   *   uhr.offen()              → { bereich: sekunden }    (noch nicht geschickt)
   *   uhr.amStueck(Date.now()) → Sekunden ohne längere Pause (Pausen-Erinnerung)
   */
  function uhr() {
    let bereich = null;
    let sichtbar = false;
    let seit = null; // ms, seit wann gezählt wird
    let offen = {}; // gesammelt, noch nicht abgegeben
    let stueckSeit = null; // Beginn der Nutzung am Stück
    let wegSeit = null; // seit wann nichts gezählt wird

    function sammeln(jetzt) {
      if (bereich && sichtbar && seit != null) {
        const s = Math.max(0, (jetzt - seit) / 1000);
        offen[bereich] = (offen[bereich] || 0) + s;
      }
      seit = bereich && sichtbar ? jetzt : null;
    }

    return {
      setzen(neuerBereich, neuSichtbar, jetzt) {
        const t = jetzt == null ? Date.now() : jetzt;
        sammeln(t);
        const zaehltJetzt = Boolean(neuerBereich) && Boolean(neuSichtbar);
        const zaehlteVorher = Boolean(bereich) && sichtbar;
        if (zaehltJetzt && !zaehlteVorher) {
          if (stueckSeit == null || (wegSeit != null && t - wegSeit >= PAUSE_RUHE_SEKUNDEN * 1000)) stueckSeit = t;
          wegSeit = null;
        } else if (!zaehltJetzt && zaehlteVorher) {
          wegSeit = t;
        }
        bereich = neuerBereich || null;
        sichtbar = Boolean(neuSichtbar);
        seit = zaehltJetzt ? t : null;
      },
      /** Gesammelte ganze Sekunden zum Schicken — höchstens 120 je Bereich. */
      abgeben(jetzt) {
        sammeln(jetzt == null ? Date.now() : jetzt);
        const liste = [];
        for (const key of Object.keys(offen)) {
          const ganz = Math.floor(offen[key]);
          if (ganz < 1) continue;
          const s = Math.min(ganz, HOECHSTENS_JE_AUFRUF);
          liste.push({ bereich: key, sekunden: s });
          offen[key] -= ganz; // was über 120 liegt, verfällt — die Datenbank nähme es nicht
          if (offen[key] < 1e-6) delete offen[key];
        }
        return liste;
      },
      /** Schicken ging schief: wieder dazulegen (gedeckelt). */
      zuruecklegen(liste) {
        for (const e of liste || []) {
          offen[e.bereich] = Math.min(HOECHSTENS_JE_AUFRUF, (offen[e.bereich] || 0) + e.sekunden);
        }
      },
      offen(jetzt) {
        const t = jetzt == null ? Date.now() : jetzt;
        const kopie = Object.assign({}, offen);
        if (bereich && sichtbar && seit != null) kopie[bereich] = (kopie[bereich] || 0) + Math.max(0, (t - seit) / 1000);
        return kopie;
      },
      /** Wie lange schon am Stück — für die Pausen-Erinnerung. */
      amStueck(jetzt) {
        const t = jetzt == null ? Date.now() : jetzt;
        if (stueckSeit == null) return 0;
        if (!(bereich && sichtbar) && wegSeit != null && t - wegSeit >= PAUSE_RUHE_SEKUNDEN * 1000) return 0;
        return Math.max(0, Math.round((t - stueckSeit) / 1000));
      },
      /** Pause genommen bzw. Erinnerung bestätigt: die Uhr fängt neu an. */
      stueckNeu(jetzt) {
        stueckSeit = jetzt == null ? Date.now() : jetzt;
      },
      get bereich() {
        return bereich;
      },
    };
  }

  /** Gezählte plus noch nicht geschickte Sekunden. */
  function zusammen(nutzung, offen) {
    const z = Object.assign({}, nutzung || {});
    for (const key of Object.keys(offen || {})) z[key] = (Number(z[key]) || 0) + offen[key];
    return z;
  }

  return {
    BEREICHE,
    BEREICH_SCHLUESSEL,
    MODI,
    MODUS_SCHLUESSEL,
    LIMIT_MINUTEN,
    GESAMT_MINUTEN,
    PAUSE_MINUTEN,
    UHRZEITEN,
    CODE_MINUTEN,
    MEHR_MINUTEN,
    AUSZEIT_MEHR_STUNDEN,
    HINWEIS_SEKUNDEN,
    PAUSE_RUHE_SEKUNDEN,
    TAKT_SEKUNDEN,
    HOECHSTENS_JE_AUFRUF,
    TEXTE,
    uhrzeit,
    minuteAus,
    imFenster,
    minutenBis,
    ortszeit,
    geraetezone,
    dauerText,
    minutenText,
    normalisieren,
    pruefen,
    heutigesLimit,
    modusVon,
    lockerer,
    bereichFuer,
    bereichName,
    grenzeMit,
    mehrNochFrei,
    auszeitFrei,
    gesamtGenutzt,
    summe,
    status,
    sperrText,
    hinweisText,
    wertText,
    bereichWertText,
    woche,
    uhr,
    zusammen,
  };
});
