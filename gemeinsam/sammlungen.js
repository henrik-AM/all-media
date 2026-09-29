/**
 * Playlists und Highlights — wie ihr Kreis aussieht, einmal für App und
 * Website (Feedback 21.09.2026, Kasten 12.7–12.9).
 *
 * WARUM GEMEINSAM
 *
 * Henrik am 21.09.2026: „Die Ringfarben für Highlights und Playlists bleiben
 * je Gattung einheitlich und unterscheiden sich voneinander. Prototyp ist
 * bindend." Bis dahin stand die Farbe an vier Stellen und nirgends gleich:
 *
 *   App      VideoProfileScreen   Rand in colors.border, Abzeichen brand / #F0397E
 *   App      UserProfileScreen    Rand in colors.border
 *   Website  styles.css           Playlist var(--brand-grad), Highlight var(--story-grad)
 *
 * Die Playlist war dazu ein abgerundetes Quadrat — im Prototyp sind beide
 * Gattungen Kreise.
 *
 * Außerdem steht hier die Regel, WELCHES Bild im Kreis erscheint. Sie stand
 * zweimal (app/lib/aktionen.ts `sammlungenVon`, web/server/app.js
 * `/api/sammlungen`) und hat mit dem wählbaren Titelbild (Schema-Entwurf
 * Schema 70) eine zweite Stufe bekommen. Zwei Fassungen davon laufen
 * auseinander, sobald eine angefasst wird.
 *
 * WARUM DIE UMD-HÜLLE
 *
 * Die Prüfläufe legen den übersetzten App-Code als blob:-Modul in den
 * Browser (app/test/_modulquelle.js). Dort gibt es kein `require`. Ohne
 * diese Hülle und ohne Eintrag in UMD_BAUSTEINE kippen drei Läufe mittendrin
 * mit „require is not defined".
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory();
  } else {
    // Browser: als eigenes <script> eingebunden.
    global.Sammlungen = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Die Ringfarbe je Gattung — aus dem Figma-Prototyp, Frame „Videos -
   * Profil" (478:899): Playlist-Kreise mit Strich #FF0A0A, Highlight-Kreise
   * mit Strich #FF990A, beide rund, Strichstärke 4 bei 45 px Durchmesser.
   *
   * Der Story-Ring am Profilbild (#0DD1E6) gehört nicht hierher: er ist eine
   * dritte Gattung, und an ihm arbeitet Kasten 11.
   */
  const RINGFARBEN = Object.freeze({
    playlist: '#FF0A0A',
    highlight: '#FF990A',
  });

  /**
   * Strichstärke im Verhältnis zum Durchmesser — 4 von 45 im Prototyp.
   * Als Verhältnis, weil App (62 px) und Website (64 px) andere Kreise
   * zeichnen als der Prototyp.
   */
  const RINGSTAERKE_ANTEIL = 4 / 45;

  /** Farbe des Rings; alles Unbekannte zählt als Highlight. */
  function ringfarbe(art) {
    return art === 'playlist' ? RINGFARBEN.playlist : RINGFARBEN.highlight;
  }

  /** Strichstärke in Pixeln für einen Kreis dieses Durchmessers. */
  function ringstaerke(durchmesser) {
    return Math.max(2, Math.round(Number(durchmesser || 0) * RINGSTAERKE_ANTEIL));
  }

  /**
   * Welches Bild im Kreis steht.
   *
   *   1. das eigene Foto, das jemand als Titelbild hochgeladen hat
   *      (nur Highlights: „oder ein beliebiges Foto")
   *   2. das Bild des gewählten Beitrags beziehungsweise der gewählten Story
   *      — aber nur, solange es noch in der Sammlung liegt
   *   3. sonst wie bisher das zuletzt hinzugefügte Stück
   *   4. sonst null — eine leere Sammlung zeigt ihr Symbol
   *
   * `sammlung` ist die Zeile aus `sammlungen` (titelbild_url, titel_post_id,
   * titel_story_id — alle drei dürfen fehlen, solange der Schema-Entwurf
   * nicht eingespielt ist). `inhalte` sind die Zeilen aus
   * `sammlung_inhalte` mit eingebettetem `posts` / `stories`.
   */
  function vorschaubild(sammlung, inhalte) {
    const s = sammlung || {};
    const liste = Array.isArray(inhalte) ? inhalte : [];
    const bildVon = (i) =>
      (i && i.posts && (i.posts.thumbnail_url || i.posts.media_url)) ||
      (i && i.stories && i.stories.media_url) ||
      null;

    if (s.titelbild_url) return s.titelbild_url;

    if (s.titel_post_id || s.titel_story_id) {
      const gewaehlt = liste.find(
        (i) =>
          (s.titel_post_id && i.post_id === s.titel_post_id) ||
          (s.titel_story_id && i.story_id === s.titel_story_id)
      );
      const bild = bildVon(gewaehlt);
      if (bild) return bild;
    }

    const neueste = liste
      .slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const treffer = neueste.find((i) => bildVon(i));
    return treffer ? bildVon(treffer) : null;
  }

  return { RINGFARBEN, RINGSTAERKE_ANTEIL, ringfarbe, ringstaerke, vorschaubild };
});
