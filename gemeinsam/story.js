/**
 * Storys: Regeln für App und Website.
 *
 * WARUM ES DAS GIBT
 *
 * Henrik am 21.09.2026 (Kasten 11): „Unter Home wird kein Story-Ring
 * angezeigt, obwohl das Profil eine Story online hat. Henrik erwartet weitere
 * solche Fälle."
 *
 * Die Ursache war keine einzelne falsche Zeile. Jede Stelle entschied selbst,
 * ob eine Person „eine Story hat":
 *   - Home las die Videos-Leiste (nur Storys mit in_videos von Gefolgten),
 *   - das fremde Profil der Website las beide Leisten zusammen,
 *   - das eigene Profil der Website nur die Messenger-Leiste,
 *   - der Beitragskopf der Website zeichnete den Ring immer, auch ohne Story,
 *   - der Beitragskopf der App nie.
 * Fünf Stellen, fünf Regeln. Dieselbe Story hatte damit je nach Bildschirm
 * einen Ring oder keinen.
 *
 * DIE EINE REGEL (bereichstreu)
 *
 *   Videos-Bereich (Home, Kurzformat, Querformat, Profil, Suche, Kommentare):
 *     Ring, wenn die Person eine sichtbare Story mit `in_videos` hat.
 *   Messenger-Bereich (Chatliste, Kontaktprofil, Messenger-Profil):
 *     Ring, wenn die Person eine sichtbare Story mit `in_messenger` hat und
 *     Kontakt ist (oder man selbst ist).
 *
 * Die LEISTE ist enger als der Ring: dort stehen im Videos-Bereich nur
 * Gefolgte (Handbuch: „Storys der gefolgten Profile"), im Messenger nur
 * Kontakte. Der Ring steht dagegen an JEDEM Profilbild einer Person, deren
 * Story man sehen darf — so wie bei Instagram auch an Fremden.
 *
 * Ob man eine Story sehen DARF, entscheidet die Datenbank (Regel „Aktuelle
 * Storys lesen"). Hier wird nur noch sortiert und zugeordnet.
 *
 * WARUM DIE UMD-HÜLLE
 *
 * Wie bei verlauf.js: die Prüfläufe legen den App-Code als blob:-Modul in den
 * Browser, dort gibt es kein `require`. Eingetragen in UMD_BAUSTEINE
 * (app/test/_modulquelle.js).
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.StoryRegeln = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Wie lange eine Bild-Story im Betrachter steht (Millisekunden). */
  const DAUER_BILD = 6000;
  /** Obergrenze für eine Video-Story, falls das Video keine Länge meldet. */
  const DAUER_VIDEO_HOECHSTENS = 30000;

  /*
   * Die Schriften der Story-Bearbeitung (Kasten 11.6). Vorbild Instagram:
   * wenige, klar unterscheidbare Stile. `web` ist die CSS-Schriftfamilie,
   * `ios`/`android` der Name, den React Native kennt. Nur Schriften, die auf
   * dem Gerät ohnehin da sind, sonst sähe die App anders aus als die Website.
   */
  const SCHRIFTEN = [
    { key: 'klassisch', label: 'Klassisch', web: 'system-ui, -apple-system, sans-serif', ios: 'System', android: 'sans-serif', gewicht: '600', kursiv: false },
    { key: 'kraeftig', label: 'Kräftig', web: 'system-ui, -apple-system, sans-serif', ios: 'System', android: 'sans-serif', gewicht: '900', kursiv: false },
    { key: 'serif', label: 'Serif', web: 'Georgia, "Times New Roman", serif', ios: 'Georgia', android: 'serif', gewicht: '400', kursiv: false },
    { key: 'schreibmaschine', label: 'Schreibmaschine', web: '"Courier New", Courier, monospace', ios: 'Courier New', android: 'monospace', gewicht: '600', kursiv: false },
    { key: 'hand', label: 'Hand', web: '"Snell Roundhand", "Segoe Script", cursive', ios: 'Snell Roundhand', android: 'cursive', gewicht: '400', kursiv: true },
  ];

  /** Die Textfarben — dieselbe Reihe auf beiden Seiten. */
  const FARBEN = ['#FFFFFF', '#000000', '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#0A84FF', '#AF52DE', '#FF2D55'];

  /** Die Filterschlüssel. Die Werte stehen in app/constants/filter.ts und FILTER in web/public/app.js. */
  const FILTER_SCHLUESSEL = ['keiner', 'warm', 'kalt', 'sw', 'sepia', 'kino', 'sonne', 'nacht'];

  /** Höchstens so viele Texte je Story, jeder höchstens so lang. */
  const TEXTE_HOECHSTENS = 10;
  const TEXT_LAENGE = 200;
  /** Höchstens so viele Markierungen je Story. */
  const MARKIERUNGEN_HOECHSTENS = 20;

  const schriftZu = (key) => SCHRIFTEN.find((s) => s.key === key) || SCHRIFTEN[0];

  const zahl = (wert, min, max, ersatz) => {
    const n = Number(wert);
    if (!Number.isFinite(n)) return ersatz;
    return Math.min(max, Math.max(min, n));
  };

  /**
   * Bearbeitungen einer Story in eine feste Form bringen.
   *
   * Gespeichert werden sie als Daten (stories.overlays, jsonb), nicht ins
   * Bild gebrannt: nur so sieht der Betrachter in App und Website dasselbe,
   * und der Text bleibt scharf. Alles, was hier nicht durchgeht, fällt weg —
   * die Spalte wird von beiden Seiten und direkt aus der App beschrieben.
   *
   * Positionen sind relativ (0 bis 1) zur Bildfläche, damit sie auf jedem
   * Bildschirm an derselben Stelle stehen.
   */
  function overlaysPruefen(roh) {
    const quelle = roh && typeof roh === 'object' ? roh : {};
    const texte = Array.isArray(quelle.texte) ? quelle.texte : [];
    const filter = FILTER_SCHLUESSEL.includes(quelle.filter) ? quelle.filter : 'keiner';
    const markiert = Array.isArray(quelle.markiert) ? quelle.markiert : [];
    return {
      filter,
      texte: texte
        .filter((t) => t && typeof t.text === 'string' && t.text.trim())
        .slice(0, TEXTE_HOECHSTENS)
        .map((t) => ({
          text: t.text.trim().slice(0, TEXT_LAENGE),
          schrift: schriftZu(t.schrift).key,
          farbe: FARBEN.includes(t.farbe) ? t.farbe : FARBEN[0],
          hintergrund: Boolean(t.hintergrund),
          groesse: zahl(t.groesse, 14, 64, 28),
          x: zahl(t.x, 0.05, 0.95, 0.5),
          y: zahl(t.y, 0.05, 0.95, 0.5),
        })),
      // Die Namensschilder der Markierten: wo sie auf dem Bild stehen.
      // WER markiert ist, steht in story_tags — das hier ist nur die Lage.
      markiert: markiert
        .filter((m) => m && typeof m.userId === 'string' && m.userId)
        .slice(0, MARKIERUNGEN_HOECHSTENS)
        .map((m) => ({
          userId: m.userId,
          name: typeof m.name === 'string' ? m.name.slice(0, 60) : '',
          x: zahl(m.x, 0.05, 0.95, 0.5),
          y: zahl(m.y, 0.05, 0.95, 0.75),
        })),
    };
  }

  /** Hat die Story überhaupt eine Bearbeitung? */
  function hatOverlays(o) {
    const g = overlaysPruefen(o);
    return g.filter !== 'keiner' || g.texte.length > 0 || g.markiert.length > 0;
  }

  /**
   * Das Ziel einer Story aus der Wahl beim Posten (Kasten 11.5).
   *
   * Aus Videos:    „Nur Videos"     oder „Messenger und Videos"
   * Aus Messenger: „Nur Messenger"  oder „Messenger und Videos"
   *
   * `darfVideos` ist false, wenn die Story-Sichtbarkeit nicht „Alle" ist —
   * dann gibt es den Videos-Bereich für Storys nicht (Schema 30/36).
   */
  function zielWahl(bereich, darfVideos) {
    if (!darfVideos) {
      return [{ key: 'messenger', label: 'Nur Messenger', inMessenger: true, inVideos: false }];
    }
    const beide = { key: 'beide', label: 'Messenger und Videos', inMessenger: true, inVideos: true };
    return bereich === 'videos'
      ? [{ key: 'videos', label: 'Nur Videos', inMessenger: false, inVideos: true }, beide]
      : [{ key: 'messenger', label: 'Nur Messenger', inMessenger: true, inVideos: false }, beide];
  }

  /**
   * Rohzeilen aus `stories` in die Listen beider Bereiche verteilen.
   *
   * roh:       Zeilen mit id, user_id, media_url, media_type, caption,
   *            created_at, in_videos, in_messenger, overlays, profiles{name}
   * ichId:     die eigene Kennung (in der Liste steht dafür `ichKennung`)
   * kontakte:  Set der Kontakte (Status friend)
   * gefolgte:  Set der gefolgten Konten
   * gesehen / gemocht: Sets von Story-Kennungen
   * markierte: Map story_id -> [{userId, name}]
   * ichKennung: wie die eigene Person in der Oberfläche heißt ('me' / ICH)
   *
   * Ergebnis:
   *   messenger     — Leiste Messenger: eigene (in_messenger) + Kontakte
   *   videos        — Leiste Videos: eigene (in_videos) + Gefolgte
   *   videosAlle    — alle sichtbaren Videos-Storys, auch von Nichtgefolgten.
   *                   Daraus kommt der Ring an Beitragsköpfen und Profilen.
   *
   * Innerhalb einer Person stehen die Storys in Aufnahmereihenfolge (älteste
   * zuerst) — so spielt sie der Betrachter nacheinander ab (Kasten 11.4).
   * Personen: eigene zuerst, dann die mit ungesehenen, dann die neueste
   * Story zuerst.
   */
  function listenBilden({ roh, ichId, kontakte, gefolgte, gesehen, gemocht, markierte, ichKennung }) {
    const kennungIch = ichKennung || 'me';
    const hat = (menge, wert) => Boolean(menge && menge.has && menge.has(wert));
    const alle = (roh || []).map((s) => {
      const eigen = s.user_id === ichId;
      const inVideos = Boolean(s.in_videos);
      // Alte Zeilen ohne die Spalte (vor dem Schema) gelten als Messenger.
      const inMessenger = s.in_messenger === undefined || s.in_messenger === null ? true : Boolean(s.in_messenger);
      const name = eigen ? 'Deine Story' : String((s.profiles && s.profiles.name) || '').split(' ')[0];
      return {
        id: s.id,
        userId: eigen ? kennungIch : s.user_id,
        name,
        own: eigen,
        viewed: eigen ? true : hat(gesehen, s.id),
        liked: hat(gemocht, s.id),
        caption: s.caption || '',
        mediaUri: s.media_url || undefined,
        mediaType: s.media_type === 'video' ? 'video' : 'image',
        aufgenommen: s.created_at || undefined,
        inVideos,
        inMessenger,
        overlays: s.overlays ? overlaysPruefen(s.overlays) : null,
        markiert: (markierte && markierte.get && markierte.get(s.id)) || [],
        _urheber: s.user_id,
      };
    });

    const ohneHilf = (s) => {
      const kopie = Object.assign({}, s);
      delete kopie._urheber;
      return kopie;
    };

    const eigene = alle.filter((s) => s.own);
    const fremde = alle.filter((s) => !s.own);
    /*
     * Wer markiert ist, sieht die Story auch ohne Kontakt oder Folgen — sonst
     * führte die Mitteilung „hat dich in einer Story markiert" ins Leere. Die
     * Datenbank lässt sie ihn lesen (ist_story_markiert, Schema 68).
     */
    const markiertMich = (s) =>
      Boolean(s.overlays && s.overlays.markiert.some((m) => m.userId === ichId));

    const messenger = ordnen(
      [
        ...eigene.filter((s) => s.inMessenger),
        ...fremde.filter((s) => s.inMessenger && (hat(kontakte, s._urheber) || markiertMich(s))),
      ].map(ohneHilf),
      kennungIch
    );
    const videos = ordnen(
      [
        ...eigene.filter((s) => s.inVideos),
        ...fremde.filter((s) => s.inVideos && (hat(gefolgte, s._urheber) || markiertMich(s))),
      ].map(ohneHilf),
      kennungIch
    );
    const videosAlle = ordnen(
      [...eigene.filter((s) => s.inVideos), ...fremde.filter((s) => s.inVideos)].map(ohneHilf),
      kennungIch
    );
    return { messenger, videos, videosAlle };
  }

  /** Die Platzhalterkachel „Deine Story" mit Plus — der Weg zur Kamera. */
  function platzhalter(kennungIch) {
    return {
      id: 'eigene',
      userId: kennungIch || 'me',
      name: 'Deine Story',
      own: true,
      viewed: true,
      liked: false,
      caption: '',
      mediaUri: undefined,
      mediaType: 'image',
      aufgenommen: undefined,
      inVideos: false,
      inMessenger: false,
      overlays: null,
      markiert: [],
    };
  }

  const zeitVon = (s) => (s.aufgenommen ? Date.parse(s.aufgenommen) || 0 : 0);

  /**
   * Nach Person gruppieren und in Leistenreihenfolge flach zurückgeben.
   * Links immer die eigene Kachel — ohne eigene Story als Platzhalter.
   */
  function ordnen(liste, kennungIch) {
    const gruppen = new Map();
    for (const s of liste) {
      if (!gruppen.has(s.userId)) gruppen.set(s.userId, []);
      gruppen.get(s.userId).push(s);
    }
    const reihen = [...gruppen.values()].map((g) => g.slice().sort((a, b) => zeitVon(a) - zeitVon(b)));
    const neueste = (g) => Math.max(...g.map(zeitVon));
    const ungesehen = (g) => g.some((s) => !s.viewed);
    const eigen = reihen.find((g) => g[0].own);
    const fremd = reihen
      .filter((g) => !g[0].own)
      .sort((a, b) => Number(ungesehen(b)) - Number(ungesehen(a)) || neueste(b) - neueste(a));
    return [...(eigen || [platzhalter(kennungIch)]), ...fremd.flat()];
  }

  /** Die Storys einer Person, in Abspielreihenfolge. */
  function vonPerson(liste, userId) {
    return (liste || []).filter((s) => s.userId === userId && s.id !== 'eigene');
  }

  /**
   * Der Ring an einem Profilbild.
   *
   * 'neu'     — bunter Ring: mindestens eine Story ist ungesehen
   * 'gesehen' — grauer Ring: alle gesehen
   * 'keiner'  — kein Ring
   *
   * `start` ist die Story, mit der der Betrachter beginnt: die erste
   * ungesehene, sonst die erste.
   */
  function ringFuer(liste, userId) {
    const eigene = vonPerson(liste, userId);
    if (eigene.length === 0) return { status: 'keiner', start: null, anzahl: 0 };
    const offen = eigene.find((s) => !s.viewed);
    // Die eigene Story gilt nie als „ungesehen" — der Ring ist trotzdem bunt,
    // damit man sieht, dass sie online ist (wie bei Instagram).
    const bunt = Boolean(offen) || eigene[0].own;
    return { status: bunt ? 'neu' : 'gesehen', start: (offen || eigene[0]).id, anzahl: eigene.length };
  }

  /**
   * Welche Liste für den Ring in einem Bereich gilt.
   * Messenger: die Messenger-Liste. Videos: alle Videos-Storys.
   */
  function ringListe(listen, bereich) {
    if (!listen) return [];
    return bereich === 'messenger' ? listen.messenger || [] : listen.videosAlle || listen.videos || [];
  }

  return {
    DAUER_BILD,
    DAUER_VIDEO_HOECHSTENS,
    SCHRIFTEN,
    FARBEN,
    FILTER_SCHLUESSEL,
    TEXTE_HOECHSTENS,
    TEXT_LAENGE,
    MARKIERUNGEN_HOECHSTENS,
    schriftZu,
    overlaysPruefen,
    hatOverlays,
    zielWahl,
    listenBilden,
    ordnen,
    platzhalter,
    vonPerson,
    ringFuer,
    ringListe,
  };
});
