/**
 * Sichtbarkeitsstufen: Namen, Erklärtexte und welche Stufe wo erlaubt ist.
 *
 * WARUM ES DAS GIBT
 *
 * Henrik am 01.10.2026 (Kasten 19): „Der Besitzer des Beitrages darf immer
 * sehen, wer seinen Beitrag geliked hat. Die Regelung (mit deaktivierter
 * Likes-Sichtbarkeit) zählt nur für die Öffentlichkeit. Füge zu dieser
 * Einstellung noch die Option ‚nur Follower' hinzu."
 *
 * Die Namen der vier Stufen standen bis dahin an sechs Stellen von Hand:
 * SichtbarkeitSheet, Einstellungen, Messenger-Profil und Friend-Map in der
 * App, SICHT_STUFEN in der Website und die Liste erlaubter Stufen im Server.
 * Eine fünfte Stufe, die nur bei EINEM Bereich gilt, hätte an jeder dieser
 * Stellen dieselbe Ausnahme gebraucht — und irgendwo wäre sie vergessen
 * worden: dann stünde rechts neben „Likes-Sichtbarkeit" ein leerer Text oder
 * der Server wiese die Stufe ab, die das Blatt gerade angeboten hat.
 *
 * DIE REGEL
 *
 *   Alle Bereiche:  Niemand · Niemand bis auf … · Alle bis auf … · Alle
 *   Nur „likes":    zusätzlich „Nur Follower" (Schema 76) — zwischen
 *                   „Niemand bis auf …" und „Alle bis auf …", weil sie mehr
 *                   Leute freigibt als eine Handvoll Namen, aber weniger als
 *                   alle.
 *
 * Ob ein Betrachter das Like wirklich sieht, entscheidet die Datenbank
 * (sichtbar_fuer, like_sichtbar). Hier steht nur, was angeboten und wie es
 * benannt wird.
 *
 * WARUM DIE UMD-HÜLLE
 *
 * Wie bei story.js: der Server lädt die Datei mit `require`, der Browser als
 * <script> (setzt `window.Sichtbarkeit`), die Prüfläufe als blob:-Modul.
 * Eingetragen in UMD_BAUSTEINE (app/test/_modulquelle.js).
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.Sichtbarkeit = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Alle Stufen in der Reihenfolge, in der das Blatt sie zeigt. */
  const STUFEN = [
    { key: 'niemand', label: 'Niemand', hinweis: 'Niemand sieht es.' },
    {
      key: 'niemand_bis_auf',
      label: 'Niemand bis auf …',
      hinweis: 'Nur die Personen, die du unten einträgst.',
    },
    {
      key: 'nur_follower',
      label: 'Nur Follower',
      hinweis: 'Nur Personen, die dir folgen, sehen, was dir gefällt.',
      nurBereiche: ['likes'],
    },
    {
      key: 'alle_bis_auf',
      label: 'Alle bis auf …',
      hinweis: 'Alle außer den Personen, die du unten einträgst.',
    },
    { key: 'alle', label: 'Alle', hinweis: 'Jeder, der dich sehen darf.' },
  ];

  /** Alle Stufenschlüssel — die Liste, gegen die der Server prüft. */
  const STUFEN_SCHLUESSEL = STUFEN.map((s) => s.key);

  /**
   * Kasten 19.1: der Satz, der bei jeder Stufe der Likes-Einstellung dasteht.
   * Ohne ihn liest man „Niemand" als „auch der Ersteller nicht" — genau das
   * stimmt seit Schema 65 nicht (like_sichtbar: der Eigner sieht alles).
   */
  const LIKES_ERSTELLER_HINWEIS = 'Wer den Beitrag erstellt hat, sieht dein Like immer.';

  /** Die Stufen, die in einem Bereich angeboten werden. */
  function stufenFuer(bereich) {
    return STUFEN.filter((s) => !s.nurBereiche || s.nurBereiche.includes(bereich));
  }

  /** Darf diese Stufe in diesem Bereich gespeichert werden? */
  function stufeErlaubt(bereich, stufe) {
    return stufenFuer(bereich).some((s) => s.key === stufe);
  }

  /** Der Name einer Stufe; Unbekanntes fällt auf „Alle" zurück wie ohne Eintrag. */
  function stufeName(stufe) {
    const treffer = STUFEN.find((s) => s.key === stufe);
    return treffer ? treffer.label : 'Alle';
  }

  /** Braucht die Stufe eine Ausnahmeliste? */
  function brauchtListe(stufe) {
    return stufe === 'niemand_bis_auf' || stufe === 'alle_bis_auf';
  }

  /**
   * Was rechts neben dem Punkt steht. Bei den „bis auf"-Stufen die Zahl dazu —
   * ohne sie sieht eine leere Ausnahmeliste genauso aus wie eine mit zwölf
   * Namen.
   */
  function stufeText(stufe, ausnahmenZahl) {
    const name = stufeName(stufe);
    return ausnahmenZahl && brauchtListe(stufe) ? `${name} (${ausnahmenZahl})` : name;
  }

  return {
    STUFEN,
    STUFEN_SCHLUESSEL,
    LIKES_ERSTELLER_HINWEIS,
    stufenFuer,
    stufeErlaubt,
    stufeName,
    brauchtListe,
    stufeText,
  };
});
