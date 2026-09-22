/**
 * Aus Punkten wird eine Reihenfolge — einmal für App und Website.
 *
 * WARUM GEMEINSAM
 *
 * Die Punkte rechnet die Datenbank (`feed_rang()`, Schema 51). Aus Punkten
 * eine Reihenfolge zu machen ist aber keine reine Sortierung: dazwischen
 * steht das Auffächern, und das ist eine Entscheidung mit Gedächtnis —
 * „wer stand gerade schon da". Zwei Fassungen davon laufen auseinander,
 * sobald eine angefasst wird. Genau das ist bei der Telefonregel und bei
 * der Passwortprüfung passiert, bevor sie hierher gezogen wurden.
 *
 * Ein Feed, der in der App anders sortiert ist als auf der Website, ist
 * außerdem nicht als Fehler zu erkennen — beide sehen plausibel aus.
 *
 * WARUM DIE UMD-HUELLE
 *
 * Die Prüfläufe legen den übersetzten App-Code als blob:-Modul in den
 * Browser (app/test/_modulquelle.js). Dort gibt es kein `require`. Ohne
 * diese Hülle und ohne Eintrag in UMD_BAUSTEINE kippen drei Läufe mitten
 * drin mit „require is not defined".
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory();
  } else {
    // Browser: als eigenes <script> eingebunden.
    global.Rang = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Wie viele Plätze Abstand zwei Beiträge derselben Person haben sollen.
   *
   * Drei, nicht null: ohne Abstand kippt jeder Feed früher oder später in
   * einen Block. Wer an einem Nachmittag fünf Dinge postet, hat fünf
   * ähnlich bewertete Beiträge — und die stehen dann alle hintereinander,
   * obwohl jeder einzelne zu Recht oben steht. Drei ist genug, dass sich
   * etwas dazwischenschiebt, und wenig genug, dass niemand verschwindet.
   */
  const ABSTAND = 3;

  /**
   * Wie weit nach hinten gesucht wird, um den Abstand zu halten.
   *
   * Ohne Grenze würde das Auffächern bei einem Feed, in dem nur eine Person
   * gepostet hat, die ganze Liste durchgehen — für jeden Platz. Nach zehn
   * Kandidaten wird die Suche aufgegeben und genommen, was oben liegt:
   * lieber zwei nebeneinander als eine Reihenfolge, die nicht mehr nach
   * Punkten geht.
   */
  const SUCHTIEFE = 10;

  /**
   * Jeder wievielte Platz gehört einem Beitrag, der noch keine Chance hatte.
   *
   * WARUM ES DAS GEBEN MUSS
   *
   * Ein frisch gestellter Beitrag hat bei jedem Signal eine Null: keine
   * Verweildauer, keine Resonanz, kein Interessentreffer. Er steht deshalb
   * hinten, wird deshalb nicht gesehen, hat deshalb weiter keine Signale.
   * Am 21.09.2026 war das im Testbestand nachzumessen — der taggleiche
   * Beitrag stand mit 1,17 Punkten unter vier Wochen alten mit über 2.
   *
   * Ein größerer Bonus in der Formel löst das nicht, er verschiebt nur die
   * Grenze. Die großen Plattformen reservieren stattdessen Plätze: jedes
   * neue Video geht erst an eine kleine Gruppe, unabhängig von seiner
   * Bewertung. Genau das ist das hier — jeder vierte Platz wird dem besten
   * wartenden Neuling gegeben, der Rest geht nach Punkten.
   *
   * Vier, nicht zwei: ein Viertel des Feeds ist genug, damit jeder Beitrag
   * seine Sichtungen bekommt, und wenig genug, dass der Feed nicht
   * überwiegend aus Unerprobtem besteht.
   */
  const ERPROBUNG = 4;

  /**
   * Nach Punkten sortieren, das Beste zuerst.
   *
   * `punkte` ist eine Map oder ein einfaches Objekt von Beitragskennung auf
   * Zahl — was `feed_rang()` zurückgibt, in beiden Welten gleich benutzbar.
   *
   * Wer keine Punkte hat, behält seinen Platz aus der Eingabe und landet
   * hinter allen bewerteten. Das ist der Normalfall bei einem Beitrag, der
   * zwischen Abfrage und Ranking entstanden ist — und es ist besser, als
   * ihn wegzulassen.
   */
  function sortieren(beitraege, punkte) {
    const hole = holer(punkte);
    // Die Ausgangsreihenfolge wird als Gleichstandsregel gebraucht, damit
    // aus zwei gleichen Punktzahlen nicht bei jedem Aufruf eine andere
    // Reihenfolge wird. `sort` ist zwar stabil, aber nur innerhalb eines
    // Aufrufs — der Index hält es über Aufrufe hinweg fest.
    const platz = new Map();
    beitraege.forEach((b, i) => platz.set(b.id, i));

    return beitraege.slice().sort((a, b) => {
      const pa = hole(a.id);
      const pb = hole(b.id);
      if (pa === null && pb === null) return platz.get(a.id) - platz.get(b.id);
      if (pa === null) return 1;
      if (pb === null) return -1;
      if (pb !== pa) return pb - pa;
      return platz.get(a.id) - platz.get(b.id);
    });
  }

  /**
   * Auffächern: nicht zweimal dieselbe Person direkt hintereinander.
   *
   * Der Reihe nach wird der jeweils beste Beitrag genommen, dessen Verfasser
   * nicht gerade eben schon dran war. Findet sich keiner, wird der beste
   * genommen — der Abstand ist ein Wunsch, keine Bedingung.
   *
   * Das ist dieselbe Überlegung, die bei den großen Plattformen unter
   * „Diversity" läuft, nur ohne Modell: das Ranking allein erzeugt Blöcke,
   * weil sich die Signale einer Person ähneln.
   */
  function auffaechern(sortiert, abstand, neulinge, jederN) {
    const luecke = typeof abstand === 'number' ? abstand : ABSTAND;
    const erprobung = typeof jederN === 'number' ? jederN : ERPROBUNG;
    const warten = neulinge instanceof Set ? neulinge : null;
    if (luecke <= 0 && !warten) return sortiert.slice();

    const uebrig = sortiert.slice();
    const fertig = [];
    const zuletzt = [];  // Die Verfasser der letzten `luecke` Plätze.

    while (uebrig.length > 0) {
      const platz = fertig.length;
      let nehmen = -1;

      /*
       * Erprobungsplatz: jeder `erprobung`-te Platz gehört dem besten
       * wartenden Neuling — auch wenn er nach Punkten viel weiter hinten
       * stünde. Ohne das ist der Feed für neue Beiträge zu.
       *
       * Die Suche geht über die GANZE Restliste, nicht nur die SUCHTIEFE:
       * ein Neuling hat definitionsgemäß keine Punkte und liegt deshalb
       * fast immer ganz hinten. Genau darum geht es.
       */
      if (warten && warten.size > 0 && erprobung > 0 && platz > 0 && platz % erprobung === 0) {
        for (let i = 0; i < uebrig.length; i++) {
          if (warten.has(uebrig[i].id) && zuletzt.indexOf(verfasser(uebrig[i])) === -1) {
            nehmen = i;
            break;
          }
        }
      }

      // Sonst der Reihe nach der beste, dessen Verfasser gerade Pause hat.
      if (nehmen === -1) {
        nehmen = 0;
        const tiefe = Math.min(uebrig.length, SUCHTIEFE);
        for (let i = 0; i < tiefe; i++) {
          if (zuletzt.indexOf(verfasser(uebrig[i])) === -1) {
            nehmen = i;
            break;
          }
        }
      }

      const b = uebrig.splice(nehmen, 1)[0];
      fertig.push(b);
      zuletzt.push(verfasser(b));
      if (zuletzt.length > luecke) zuletzt.shift();
    }

    return fertig;
  }

  /**
   * Beides zusammen — das, was die Oberflächen aufrufen.
   *
   * Ohne Punkte bleibt die Reihenfolge, wie sie war. Das ist der Rückfall,
   * wenn das Ranking nicht antwortet, und er ist bewusst still: ein Feed in
   * zeitlicher Reihenfolge ist kein Fehler, den jemand zu sehen bekommen
   * müsste. Vorher gab es gar nichts anderes.
   */
  function ordnen(beitraege, punkte, optionen) {
    const liste = Array.isArray(beitraege) ? beitraege : [];
    if (liste.length === 0) return [];
    if (!punkte || leer(punkte)) return liste.slice();
    const o = optionen || {};
    const abstand = typeof o.abstand === 'number' ? o.abstand : ABSTAND;
    return auffaechern(sortieren(liste, punkte), abstand, o.neulinge, o.erprobung);
  }

  /**
   * Dasselbe, aber je Art getrennt aufgefächert.
   *
   * WARUM ES DAS BRAUCHT
   *
   * Ein Foto, ein Reel und ein Clip sind derselbe Tabelleneintrag, landen
   * aber auf drei verschiedenen Bildschirmen. Fächert man sie gemeinsam
   * auf, verschiebt ein Clip, den man im Feed nie zu sehen bekommt, die
   * Reihenfolge der Fotos — am 21.09.2026 stand deshalb ein Beitrag mit
   * 9,19 Punkten vor einem mit 10,45.
   *
   * Bewertet wird weiter alles zusammen (die Punkte einer Zeile hängen
   * ohnehin nicht von den anderen ab), aber der Abstand zwischen zwei
   * Beiträgen derselben Person wird dort gezählt, wo man sie nebeneinander
   * sieht: innerhalb einer Art.
   *
   * Heraus kommt wieder eine einzige Liste. Die Arten werden dabei in der
   * Reihenfolge der Punkte verschränkt, damit die flache Liste auch für
   * sich genommen sinnvoll ist — wer sie nach Art filtert, bekommt genau
   * die aufgefächerte Reihenfolge dieser Art.
   */
  function ordnenJeArt(beitraege, punkte, artVon, optionen) {
    const liste = Array.isArray(beitraege) ? beitraege : [];
    if (liste.length === 0) return [];
    const art = typeof artVon === 'function' ? artVon : (b) => b.kind;

    // Je Art eine eigene Warteschlange, jede für sich aufgefächert.
    const gruppen = new Map();
    for (const b of liste) {
      const schluessel = art(b) || '';
      if (!gruppen.has(schluessel)) gruppen.set(schluessel, []);
      gruppen.get(schluessel).push(b);
    }
    for (const [schluessel, teil] of gruppen) {
      gruppen.set(schluessel, ordnen(teil, punkte, optionen));
    }

    /*
     * Und wieder zusammen: die gemeinsame Punktreihenfolge gibt vor, WANN
     * eine Art an der Reihe ist, die Warteschlange der Art, WAS dann kommt.
     * So bleibt beides erhalten — das Verschränken und das Auffächern.
     */
    const zeiger = new Map();
    for (const schluessel of gruppen.keys()) zeiger.set(schluessel, 0);

    const fertig = [];
    for (const b of sortieren(liste, punkte || new Map())) {
      const schluessel = art(b) || '';
      const i = zeiger.get(schluessel);
      fertig.push(gruppen.get(schluessel)[i]);
      zeiger.set(schluessel, i + 1);
    }
    return fertig;
  }

  /**
   * Aus den Zeilen von `feed_rang()` wird eine Map.
   *
   * Eine Map und kein Objekt, weil Beitragskennungen UUIDs sind: als
   * Objektschlüssel wären sie zwar gültig, aber ein Objekt trägt geerbte
   * Namen mit sich („constructor"), und irgendwann trifft eine Kennung
   * einen davon.
   */
  function punktekarte(zeilen) {
    const karte = new Map();
    for (const z of zeilen || []) {
      if (!z || !z.post_id) continue;
      karte.set(z.post_id, Number(z.punkte) || 0);
    }
    return karte;
  }

  /**
   * Welche Beiträge noch keine Chance hatten — aus denselben Zeilen.
   *
   * Wer ein Neuling ist, entscheidet die Datenbank (`feed_rang()` gibt
   * `neuling` zurück, wahr unter zehn Sichtungen insgesamt). Hier wird es
   * nur eingesammelt, damit die Oberflächen die Zeilen nicht selbst
   * durchsehen müssen und die Grenze an genau einer Stelle steht.
   */
  function neulingsliste(zeilen) {
    const menge = new Set();
    for (const z of zeilen || []) {
      if (z && z.post_id && z.neuling) menge.add(z.post_id);
    }
    return menge;
  }

  // ---------------------------------------------------------- intern --

  function verfasser(b) {
    return (b && (b.userId || b.user_id)) || '';
  }

  function leer(punkte) {
    if (punkte instanceof Map) return punkte.size === 0;
    return Object.keys(punkte).length === 0;
  }

  /** Liest aus Map oder Objekt — und gibt null, wenn nichts dasteht. */
  function holer(punkte) {
    if (punkte instanceof Map) {
      return (id) => (punkte.has(id) ? punkte.get(id) : null);
    }
    return (id) =>
      Object.prototype.hasOwnProperty.call(punkte, id) ? punkte[id] : null;
  }

  return {
    ABSTAND: ABSTAND,
    ERPROBUNG: ERPROBUNG,
    ordnen: ordnen,
    ordnenJeArt: ordnenJeArt,
    sortieren: sortieren,
    auffaechern: auffaechern,
    punktekarte: punktekarte,
    neulingsliste: neulingsliste,
  };
});
