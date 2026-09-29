/**
 * Das Spendenziel im Profil — einmal für App und Website
 * (Feedback 21.09.2026, Kasten 12.3).
 *
 * BEFUND 29.09.2026
 *
 * Henrik: „Spendenziel lässt sich antippen, zeigt aber keine genaueren
 * Daten." Dazu kam beim Nachsehen:
 *
 *   - `gesammelt` wurde beim Anlegen auf 0 gesetzt und nie wieder
 *     angefasst. Wer spendete, landete in `donations` — die Karte zeigte
 *     trotzdem für immer „0 € von 500 €".
 *   - Die App verlangte ein Ziel, die Website nicht (Punkt 44: „das Ziel ist
 *     freiwillig"). Dieselbe Aktion, zwei Regeln.
 *   - Eine Frist gab es nicht.
 *
 * Hier steht deshalb dreierlei: wie aus dem Formular ein Spendenziel wird,
 * wie ein gespeichertes gelesen wird, und wie aus Ziel und Buchungen der
 * Stand wird, den die Karte und das Detailblatt zeigen.
 *
 * WAS „ERREICHT" HEISST
 *
 * Der Startwert `gesammelt` (alte Einträge, Testbestand) plus alle Spenden
 * an diese Person seit `seit` — dem Zeitpunkt, an dem das Ziel angelegt
 * wurde. Spenden vor dem Ziel gehören nicht dazu. Ein Ziel ohne `seit`
 * (vor dem 29.09.2026 angelegt) zählt alle Spenden.
 *
 * Summe und Zahl der Spender liefert die Datenbank: `spendenstand()` im
 * Schema 71, weil `donations` nur für die beiden
 * Beteiligten lesbar ist — ein Besucher des Profils sähe sonst nichts.
 *
 * UMD-Hülle wie in rang.js; Eintrag in UMD_BAUSTEINE
 * (app/test/_modulquelle.js).
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.Spende = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TAG_MS = 24 * 60 * 60 * 1000;

  /** „500" oder „2,50" → Zahl; leer → 0; Unsinn → NaN. */
  function euroAus(text) {
    const roh = String(text == null ? '' : text).replace(/\s|€/g, '').trim();
    if (!roh) return 0;
    // „1.234,50" → Tausenderpunkt; „2.50" (ohne Komma, zwei Stellen dahinter)
    // → Dezimalpunkt, so wie ihn eine englische Tastatur schreibt.
    if (roh.includes(',')) return Number(roh.replace(/\./g, '').replace(',', '.'));
    if (/^\d+\.\d{1,2}$/.test(roh)) return Number(roh);
    return Number(roh.replace(/\./g, ''));
  }

  /**
   * „31.12.2026" oder „2026-12-31" → „2026-12-31"; leer → null.
   * Wirft bei einem Datum, das es nicht gibt (31.02.) — sonst stünde eine
   * Frist da, die JavaScript still auf den 3. März schiebt.
   */
  function fristAus(text) {
    const roh = String(text == null ? '' : text).trim();
    if (!roh) return null;
    let j, m, t;
    let treffer = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(roh);
    if (treffer) {
      t = Number(treffer[1]);
      m = Number(treffer[2]);
      j = Number(treffer[3]);
    } else if ((treffer = /^(\d{4})-(\d{2})-(\d{2})$/.exec(roh))) {
      j = Number(treffer[1]);
      m = Number(treffer[2]);
      t = Number(treffer[3]);
    } else {
      throw new Error('Die Frist bitte als TT.MM.JJJJ eingeben');
    }
    const d = new Date(Date.UTC(j, m - 1, t));
    if (d.getUTCFullYear() !== j || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== t) {
      throw new Error('Dieses Datum gibt es nicht');
    }
    return `${j}-${String(m).padStart(2, '0')}-${String(t).padStart(2, '0')}`;
  }

  /**
   * Aus dem Formular „Spendenaktion" wird der Wert für `profiles.spende`.
   *
   * Gibt `{ ok: true, spende }` oder `{ ok: false, fehler }` zurück — kein
   * throw, weil beide Formulare die Meldung unter dem Feld anzeigen.
   * `jetzt` ist nur für die Prüfläufe da.
   */
  function ausFormular(werte, jetzt) {
    const w = werte || {};
    const titel = String(w.titel || '').trim();
    if (!titel) return { ok: false, fehler: 'Bitte einen Titel eingeben' };

    const ziel = euroAus(w.ziel);
    if (!Number.isFinite(ziel) || ziel < 0) {
      return { ok: false, fehler: 'Das Spendenziel muss eine Zahl über null sein' };
    }

    let frist = null;
    try {
      frist = fristAus(w.frist);
    } catch (e) {
      return { ok: false, fehler: e.message };
    }
    const heute = new Date(jetzt || Date.now()).toISOString().slice(0, 10);
    if (frist && frist < heute) return { ok: false, fehler: 'Die Frist liegt in der Vergangenheit' };

    return {
      ok: true,
      spende: {
        titel,
        ziel,
        gesammelt: 0,
        text: String(w.text || '').trim(),
        frist,
        seit: new Date(jetzt || Date.now()).toISOString(),
      },
    };
  }

  /** Ein gespeichertes Spendenziel lesen — JSON-Text, Objekt oder nichts. */
  function lesen(roh) {
    let s = roh;
    if (typeof s === 'string') {
      try {
        s = JSON.parse(s);
      } catch {
        return null;
      }
    }
    if (!s || typeof s !== 'object' || !s.titel) return null;
    return {
      titel: String(s.titel),
      ziel: Number(s.ziel) > 0 ? Number(s.ziel) : 0,
      gesammelt: Number(s.gesammelt) > 0 ? Number(s.gesammelt) : 0,
      text: String(s.text || ''),
      frist: s.frist ? String(s.frist) : null,
      seit: s.seit ? String(s.seit) : null,
    };
  }

  /** 1234.5 → „1.234,50 €", 500 → „500 €". */
  function euro(betrag) {
    const n = Number(betrag) || 0;
    const ganz = Math.abs(n - Math.round(n)) < 0.005;
    return (
      n.toLocaleString('de-DE', {
        minimumFractionDigits: ganz ? 0 : 2,
        maximumFractionDigits: ganz ? 0 : 2,
      }) + ' €'
    );
  }

  /**
   * Der Stand, den Karte und Detailblatt zeigen.
   *
   * `buchung` kommt aus `spendenstand()`: `{ summe_cent, spender }` — oder
   * null, solange nichts geladen ist. Dann steht nur der Startwert da und
   * `spender` ist null („wird geladen"), nicht 0 („niemand").
   */
  function stand(spendeRoh, buchung, jetzt) {
    const s = lesen(spendeRoh);
    if (!s) return null;
    const summe = buchung ? Number(buchung.summe_cent || 0) / 100 : 0;
    const erreicht = Math.round((s.gesammelt + summe) * 100) / 100;
    const prozent = s.ziel > 0 ? Math.min(100, Math.round((erreicht / s.ziel) * 100)) : null;

    let fristText = null;
    let abgelaufen = false;
    if (s.frist) {
      const [j, m, t] = s.frist.split('-').map(Number);
      const ende = Date.UTC(j, m - 1, t) + TAG_MS; // bis Ende des Tages
      const rest = Math.ceil((ende - (jetzt || Date.now())) / TAG_MS);
      const datum = `${String(t).padStart(2, '0')}.${String(m).padStart(2, '0')}.${j}`;
      abgelaufen = rest <= 0;
      fristText = abgelaufen
        ? `Beendet am ${datum}`
        : rest === 1
          ? `Endet heute (${datum})`
          : `Noch ${rest} Tage · bis ${datum}`;
    }

    return {
      ...s,
      erreicht,
      prozent,
      spender: buchung ? Number(buchung.spender || 0) : null,
      fristText,
      abgelaufen,
      zahlenText: s.ziel > 0 ? `${euro(erreicht)} von ${euro(s.ziel)} gesammelt` : `${euro(erreicht)} gesammelt`,
      spenderText: buchung
        ? Number(buchung.spender || 0) === 1
          ? '1 Person hat gespendet'
          : `${Number(buchung.spender || 0)} Personen haben gespendet`
        : 'Spender werden gezählt …',
    };
  }

  /**
   * Ein getippter Spendenbetrag in Cent — oder null. Dieselbe Grenze wie im
   * Spendenweg unter Videos (ClipPlayerScreen betragInCent, Website
   * openSpende): unter 50 Cent lohnt keine Buchung, über 1.000 € ist es fast
   * sicher ein Tippfehler.
   */
  function centAus(text) {
    const zahl = euroAus(text);
    if (!Number.isFinite(zahl) || zahl < 0.5 || zahl > 1000) return null;
    return Math.round(zahl * 100);
  }

  return { euroAus, fristAus, ausFormular, lesen, euro, stand, centAus };
});
