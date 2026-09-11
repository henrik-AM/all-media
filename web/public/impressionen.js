/**
 * Wer hat welchen Beitrag wie lange gesehen — die Website-Fassung.
 *
 * WARUM ES DAS GIBT
 *
 * Der Feed sortiert heute nach Alter und sonst nichts. Ein Ranking braucht
 * mehr als Likes: ein Beitrag, den zweihundert Menschen gesehen und keiner
 * geliket hat, ist etwas anderes als einer, den niemand gesehen hat. An den
 * Likes allein sind die beiden nicht zu unterscheiden.
 *
 * Deshalb wird ab jetzt mitgeschrieben, lange bevor es das Ranking gibt —
 * die Ranking-Funktion laesst sich an einem Nachmittag schreiben, der
 * Datenbestand darunter braucht Wochen Vorlauf.
 *
 * DIESELBE RECHNUNG WIE IN DER APP
 *
 * `app/lib/impressionen.ts` macht Wort fuer Wort dasselbe mit denselben
 * Zahlen: 60 Prozent der Flaeche, mindestens eine Sekunde, Buendel von
 * zwanzig, spaetestens nach fuenfzehn Sekunden. Zwei verschiedene Schwellen
 * hiessen zwei verschiedene Bedeutungen von "gesehen" — und ein Ranking,
 * das App- und Website-Nutzer verschieden behandelt, ohne dass es jemandem
 * auffiele. Wer hier eine Zahl aendert, aendert sie dort mit.
 *
 * Sichtungen sind Nebensache. Nichts hier darf die Seite aufhalten, und ein
 * Fehler beim Senden ist kein Fehler, den jemand zu sehen bekommt.
 */

(function () {
  'use strict';

  /** Unter einer Sekunde zaehlt nicht als gesehen, sondern als vorbeigescrollt. */
  const MINDESTDAUER_MS = 1000;
  /** Ab so vielen gesammelten Sichtungen wird abgeschickt. */
  const BUENDEL = 20;
  /** Und spaetestens nach dieser Zeit, auch wenn das Buendel nicht voll ist. */
  const SPAETESTENS_MS = 15000;
  /** Mehr nimmt `impressionen_vermerken()` in einem Aufruf nicht an. */
  const HOECHSTENS = 100;
  /** Ab so viel sichtbarer Flaeche gilt ein Beitrag als zu sehen. */
  const SCHWELLE = 0.6;

  const laufend = new Map();  // id -> Zeitpunkt, seit wann sichtbar
  const fertig = new Map();   // id -> aufaddierte Dauer
  const herkunft = new Map(); // id -> 'feed' | 'reels'
  let uhr = null;
  let beobachter = null;

  function buchen(id, dauer) {
    if (!(dauer >= MINDESTDAUER_MS)) return;
    fertig.set(id, (fertig.get(id) || 0) + Math.round(dauer));
  }

  function uhrStellen() {
    if (fertig.size >= BUENDEL) return void abschicken();
    if (fertig.size === 0 || uhr) return;
    uhr = setTimeout(() => { uhr = null; abschicken(); }, SPAETESTENS_MS);
  }

  async function abschicken() {
    if (uhr) { clearTimeout(uhr); uhr = null; }
    if (fertig.size === 0) return;

    const eintraege = [...fertig].slice(0, HOECHSTENS).map(([beitrag, dauer]) => ({
      beitrag,
      dauer,
      herkunft: herkunft.get(beitrag) || 'feed',
    }));
    eintraege.forEach((e) => fertig.delete(e.beitrag));

    try {
      /*
       * `keepalive` ist hier der ganze Punkt: die laengste Sichtung endet
       * fast immer damit, dass jemand den Tab schliesst oder wegwechselt.
       * Ohne das bricht der Browser die Anfrage genau dann ab.
       *
       * Nicht `sendBeacon`: das ginge ohne den Authorization-Kopf, den der
       * Aufsatz in anmeldung.js an jeden /api-Aufruf haengt — und ohne den
       * ist die Anfrage nicht angemeldet und wird abgewiesen.
       */
      await fetch('/api/impressionen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eintraege }),
        keepalive: true,
      });
    } catch (e) {
      /*
       * Absichtlich still und absichtlich ohne zweiten Versuch. Eine
       * verlorene Sichtung ist ein fehlender Punkt unter vielen tausend;
       * sie zurueckzulegen hiesse, bei jedem Netzausfall einen wachsenden
       * Stapel mitzuschleppen und am Ende Zeiten zu buchen, die Stunden
       * zurueckliegen.
       */
    }

    if (fertig.size > 0) uhrStellen();
  }

  /** Alles Laufende abrechnen und abschicken. */
  function abgeben() {
    const jetzt = Date.now();
    for (const [id, seit] of laufend) {
      buchen(id, jetzt - seit);
      // Weiterlaufen lassen, aber ab jetzt neu messen: sonst wird dieselbe
      // Zeit beim naechsten Abgeben ein zweites Mal gebucht.
      laufend.set(id, jetzt);
    }
    abschicken();
  }

  /**
   * Alles beobachten, was gerade auf der Seite steht.
   *
   * Wird nach jedem Neuzeichnen aufgerufen. Der alte Beobachter wird dabei
   * abgeraeumt und das Laufende abgerechnet — die Elemente von eben gibt es
   * nach einem `innerHTML =` nicht mehr, ihre Sichtungen aber schon.
   */
  function beobachten() {
    if (typeof IntersectionObserver !== 'function') return;

    if (beobachter) {
      const jetzt = Date.now();
      for (const [id, seit] of laufend) buchen(id, jetzt - seit);
      laufend.clear();
      beobachter.disconnect();
      beobachter = null;
    }

    const flaechen = [...document.querySelectorAll('[data-impression]')];
    if (!flaechen.length) { uhrStellen(); return; }

    beobachter = new IntersectionObserver(
      (eintraege) => {
        const jetzt = Date.now();
        eintraege.forEach((e) => {
          const id = e.target.getAttribute('data-impression');
          if (!id) return;
          if (e.isIntersecting && e.intersectionRatio >= SCHWELLE) {
            if (!laufend.has(id)) laufend.set(id, jetzt);
          } else if (laufend.has(id)) {
            buchen(id, jetzt - laufend.get(id));
            laufend.delete(id);
          }
        });
        uhrStellen();
      },
      { threshold: [0, SCHWELLE, 1] }
    );

    flaechen.forEach((el) => {
      const id = el.getAttribute('data-impression');
      if (!id) return;
      herkunft.set(id, el.getAttribute('data-impressionsquelle') || 'feed');
      beobachter.observe(el);
    });
  }

  /*
   * Der Wechsel in einen anderen Tab und das Schliessen der Seite sind der
   * haeufigste Abschluss einer Sitzung — niemand verlaesst den Feed
   * ordentlich. Ohne diese beiden Zeilen ginge genau die laengste Sichtung
   * verloren: die, bei der jemand stehengeblieben und dann weggegangen ist.
   */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') abgeben();
  });
  window.addEventListener('pagehide', abgeben);

  window.Impressionen = { beobachten, abgeben };
})();
