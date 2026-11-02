/**
 * All Media — Zustimmung mit Fassung und Familienbereich, für App und Website.
 *
 * WARUM ES DAS GIBT
 *
 * Kasten RS 7 und RS 5 (Auftrag Recht/Sicherheit 21.10.2026). Bis Schema 106
 * stand die Zustimmung nur in den signUp-Metadaten, die der Nutzer selbst
 * überschreiben kann; Konten von vor dem 24.10.2026 haben gar keine, und
 * Eltern konnten ihre Einwilligung nicht zurücknehmen (Art. 7 Abs. 3 DSGVO).
 *
 * DER ABLAUF
 *
 *   Nach dem Anmelden fragt die Oberfläche offen(). Ist etwas offen, zeigt
 *   sie das Blatt „Neue Bedingungen" — es lässt sich nicht wegwischen, nur
 *   zustimmen, Konto löschen oder abmelden (Nutzungsbedingungen,
 *   „Änderungen"). zustimmen() schickt Version und Prüfsumme des Texts,
 *   den DIESER Client zeigt (Rechtstexte.fassung). Passt das nicht zur
 *   geltenden Fassung, lehnt der Server ab ('veraltet', Codex-Fund F6):
 *   eine alte App stimmt so nie einem Text zu, den sie nicht gezeigt hat.
 *
 *   Familienbereich: kinder() und widerrufen(). Eltern sehen Stand und
 *   Namen, nie Inhalte (Richtlinie 2.1).
 *
 * Fehlt Schema 106 (Funktion unbekannt), gilt „nichts offen" bzw. „noch
 * nicht verfügbar" — nie eine Sperre, nie ein vorgetäuschter Erfolg.
 *
 * WER DIESELBE REGEL KENNT
 *
 * `public.zustimmung_offen`, `public.zustimmen`, `public.meine_kinder`,
 * `public.elterneinwilligung_widerrufen` aus
 * SUPABASE_SCHEMA_106_einwilligung_fassung.sql. Neuer Grund dort → hier.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./rechtstexte'));
  } else {
    global.Einwilligung = factory(global.Rechtstexte);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Rechtstexte) {
  'use strict';

  var GRUENDE = {
    anmeldung: 'Bitte melde dich erneut an',
    dokument: 'Diesen Text gibt es nicht mehr. Bitte lade neu',
    fassung: 'Der Text wurde inzwischen geändert. Bitte lies die neue Fassung',
    veraltet: 'Die Bedingungen wurden geändert. Bitte aktualisiere die App bzw. lade die Seite neu, damit du die neue Fassung lesen kannst',
    kein_kind: 'Für dieses Konto kannst du nicht entscheiden',
    ohne_eltern: 'Das Konto hat das Mindestalter erreicht und braucht deine Zustimmung nicht mehr',
    nicht_offen: 'Diese Anfrage ist nicht mehr offen',
    noch_nicht: 'Das ist noch nicht freigeschaltet. Bitte versuche es nach dem nächsten Update',
    netz: 'Keine Verbindung. Bitte versuche es noch einmal',
  };

  function grundText(grund) {
    return GRUENDE[grund] || GRUENDE.netz;
  }

  /** Nur „die Funktion gibt es nicht" — nicht jeder andere Fehler (Gate 2, Fund 28). */
  function fehltFunktion(fehler, funktion) {
    if (!fehler) return false;
    var code = String(fehler.code || '');
    var text = String(fehler.message || '');
    var nennt = new RegExp('(public\\.)?' + funktion + '(?![A-Za-z0-9_])', 'i').test(text);
    if (code === 'PGRST202') return nennt || !text;
    if (code === '42883') return nennt;
    return false;
  }

  function titel(dokument) {
    try {
      var d = Rechtstexte && Rechtstexte.dokument(dokument);
      if (d && d.titel) return d.titel;
    } catch (e) { /* unbekanntes Dokument */ }
    return dokument;
  }

  /** Was dem Nutzer im Blatt gesagt wird, je nachdem ob neu oder geändert. */
  function blattText(liste) {
    var geaendert = (liste || []).some(function (e) { return e.bisher != null; });
    return geaendert
      ? 'Wir haben unsere Bedingungen geändert. Lies bitte, was neu ist, und stimme zu, um All Media weiter zu nutzen. Wenn du nicht zustimmen möchtest, kannst du dein Konto löschen.'
      : 'Bitte stimme unseren Nutzungsbedingungen und Community-Richtlinien zu, um All Media weiter zu nutzen. Wenn du nicht zustimmen möchtest, kannst du dein Konto löschen.';
  }

  /** Zeilen für das Blatt: Titel, ob Zustimmung oder nur Kenntnis. */
  function zeilen(liste) {
    return (liste || []).map(function (e) {
      return {
        dokument: e.dokument,
        version: e.version,
        titel: titel(e.dokument),
        kenntnis: e.art === 'kenntnis',
        neu: e.bisher != null,
      };
    });
  }

  var KNOPF = 'Zustimmen';
  var KENNTNIS_ZUSATZ = 'zur Kenntnis';

  /** Was ist offen? Fehlt Schema 106: nichts. */
  async function offen(client) {
    if (!client) return { ok: true, liste: [] };
    var r = await client.rpc('zustimmung_offen');
    if (r.error) {
      if (fehltFunktion(r.error, 'zustimmung_offen')) return { ok: true, liste: [], fehlt: true };
      return { ok: false, liste: [], text: grundText('netz') };
    }
    return { ok: true, liste: Array.isArray(r.data) ? r.data : [] };
  }

  /** Allen offenen Fassungen zustimmen (bzw. sie zur Kenntnis nehmen). */
  async function zustimmen(client, liste) {
    if (!client) return { ok: false, text: grundText('anmeldung') };
    for (var i = 0; i < (liste || []).length; i++) {
      var e = liste[i];
      // Zugestimmt wird dem Text, den dieser Client zeigt — nicht der
      // Version, die der Server nennt (Codex-Fund F6).
      var eigene = Rechtstexte && Rechtstexte.fassung ? Rechtstexte.fassung(e.dokument) : null;
      if (!eigene || !eigene.pruefsumme || eigene.version !== e.version) {
        return { ok: false, grund: 'veraltet', text: grundText('veraltet') };
      }
      var r = await client.rpc('zustimmen', {
        p_dokument: e.dokument, p_version: eigene.version, p_pruefsumme: eigene.pruefsumme,
      });
      if (r.error) {
        if (fehltFunktion(r.error, 'zustimmen')) return { ok: false, grund: 'noch_nicht', text: grundText('noch_nicht') };
        return { ok: false, grund: 'netz', text: grundText('netz') };
      }
      if (!r.data || !r.data.ok) {
        var g = (r.data && r.data.grund) || 'netz';
        return { ok: false, grund: g, text: grundText(g) };
      }
    }
    return { ok: true };
  }

  /* ------------------------------------------------------------------ */
  /* Familienbereich                                                     */
  /* ------------------------------------------------------------------ */

  function datum(iso) {
    if (!iso) return '';
    var t = String(iso).slice(0, 10).split('-');
    return t.length === 3 ? t[2] + '.' + t[1] + '.' + t[0] : '';
  }

  var STAND = {
    frei: 'Freigegeben',
    wartet: 'Wartet auf deine Zustimmung',
    abgelehnt: 'Abgelehnt',
    ohne_datum: 'Geburtsdatum fehlt',
  };

  function standText(kind) {
    return STAND[kind && kind.stand] || 'Unbekannt';
  }

  /** Was vor dem Widerruf gesagt wird — ehrlich, was passiert. */
  function widerrufHinweis(kind) {
    var name = (kind && kind.name) || 'dein Kind';
    var bis = kind && kind.grenze_am
      ? ' oder bis ' + name + ' am ' + datum(kind.grenze_am) + ' das Mindestalter erreicht'
      : '';
    return 'Wenn du deine Zustimmung zurücknimmst, ruht das Konto von ' + name + ': ' + name +
      ' kann sich anmelden, aber nichts sehen, posten oder schreiben, bis du wieder zustimmst' + bis +
      '. Beiträge und Nachrichten bleiben erhalten. ' + name + ' sieht beim Öffnen, dass die Zustimmung fehlt.';
  }

  var WIDERRUF_KNOPF = 'Zustimmung zurücknehmen';
  var WIDERRUF_FERTIG = 'Zustimmung zurückgenommen. Das Konto ruht.';
  var KEINE_KINDER = 'Mit deinem Konto ist kein Kinderkonto verknüpft.';

  async function kinder(client) {
    if (!client) return { ok: false, liste: [], text: grundText('anmeldung') };
    var r = await client.rpc('meine_kinder');
    if (r.error) {
      if (fehltFunktion(r.error, 'meine_kinder')) return { ok: false, liste: [], fehlt: true, text: grundText('noch_nicht') };
      return { ok: false, liste: [], text: grundText('netz') };
    }
    return { ok: true, liste: Array.isArray(r.data) ? r.data : [] };
  }

  async function widerrufen(client, kindId) {
    if (!client) return { ok: false, text: grundText('anmeldung') };
    var r = await client.rpc('elterneinwilligung_widerrufen', { p_kind: kindId });
    if (r.error) {
      if (fehltFunktion(r.error, 'elterneinwilligung_widerrufen')) return { ok: false, grund: 'noch_nicht', text: grundText('noch_nicht') };
      return { ok: false, grund: 'netz', text: grundText('netz') };
    }
    if (!r.data || !r.data.ok) {
      var g = (r.data && r.data.grund) || 'netz';
      return { ok: false, grund: g, text: grundText(g) };
    }
    return { ok: true, schon: !!r.data.schon, text: WIDERRUF_FERTIG };
  }

  /* ------------------------------------------------------------------ */
  /* Eltern-Einwilligung (Codex-Fund F12)                                */
  /* ------------------------------------------------------------------ */

  /*
   * Das Elternblatt zeigt dieselben Texte, denen beim Registrieren
   * zugestimmt bzw. die zur Kenntnis gegeben werden. Der Server vermerkt
   * nur, was hier mit Version und Prüfsumme mitgeht — und lehnt ab, wenn es
   * nicht die geltende Fassung ist ('veraltet').
   */
  function elternDokumente() {
    if (!Rechtstexte) return [];
    return (Rechtstexte.ZUSTIMMUNG_PFLICHT || []).concat(Rechtstexte.ZUR_KENNTNIS || []);
  }

  /** { dokument: { version, pruefsumme } } aller Texte im Elternblatt. */
  function elternFassungen() {
    var aus = {};
    elternDokumente().forEach(function (id) {
      var f = Rechtstexte.fassung ? Rechtstexte.fassung(id) : null;
      if (f && f.pruefsumme) aus[id] = { version: f.version, pruefsumme: f.pruefsumme };
    });
    return aus;
  }

  /** Zeilen fürs Elternblatt: Titel und Fassung, zum Antippen und Lesen. */
  function elternZeilen() {
    return elternDokumente().map(function (id) {
      var f = Rechtstexte.fassung ? Rechtstexte.fassung(id) : null;
      return {
        dokument: id,
        version: f ? f.version : null,
        titel: titel(id),
        kenntnis: (Rechtstexte.ZUR_KENNTNIS || []).indexOf(id) !== -1,
      };
    });
  }

  function elternHinweis(kind) {
    var name = (kind && kind.handle) || (kind && kind.name) || 'das Konto';
    return 'Mit „Zustimmen" willigst du als Elternteil ein, dass ' + name +
      ' All Media nach diesen Texten nutzt. Bitte lies sie vorher — tippe auf einen Titel, um ihn zu öffnen.';
  }

  /**
   * Zustimmen oder ablehnen. Beim Zustimmen gehen Version und Prüfsumme der
   * gezeigten Texte mit; ohne sie (alter Server) gibt es keinen Erfolg.
   */
  async function elternEntscheiden(client, kindId, zustimmen) {
    if (!client) return { ok: false, text: grundText('anmeldung') };
    var r = await client.rpc('einwilligung_entscheiden', {
      p_kind: kindId, p_zustimmen: !!zustimmen, p_fassungen: zustimmen ? elternFassungen() : null,
    });
    // Schema 106 noch nicht eingespielt: dann gibt es nur die Fassung aus
    // Schema 52, und es gibt auch keine Tabelle, in der ein Beleg für
    // ungezeigte Texte entstehen könnte. Mit 106 ist die alte Fassung
    // gelöscht — dieser Rückfall läuft dann ins Leere (PGRST202).
    if (r.error && fehltFunktion(r.error, 'einwilligung_entscheiden')) {
      r = await client.rpc('einwilligung_entscheiden', { p_kind: kindId, p_zustimmen: !!zustimmen });
    }
    if (r.error) {
      if (fehltFunktion(r.error, 'einwilligung_entscheiden')) return { ok: false, grund: 'noch_nicht', text: grundText('noch_nicht') };
      return { ok: false, grund: 'netz', text: grundText('netz') };
    }
    if (!r.data || !r.data.ok) {
      var g = (r.data && r.data.grund) || 'netz';
      return { ok: false, grund: g, text: GRUENDE[g] ? grundText(g) : (r.data && r.data.meldung) || grundText(g) };
    }
    return { ok: true, stand: r.data.stand };
  }

  return {
    elternDokumente: elternDokumente,
    elternFassungen: elternFassungen,
    elternZeilen: elternZeilen,
    elternHinweis: elternHinweis,
    elternEntscheiden: elternEntscheiden,
    GRUENDE: GRUENDE,
    KNOPF: KNOPF,
    KENNTNIS_ZUSATZ: KENNTNIS_ZUSATZ,
    WIDERRUF_KNOPF: WIDERRUF_KNOPF,
    WIDERRUF_FERTIG: WIDERRUF_FERTIG,
    KEINE_KINDER: KEINE_KINDER,
    grundText: grundText,
    fehltFunktion: fehltFunktion,
    blattText: blattText,
    zeilen: zeilen,
    offen: offen,
    zustimmen: zustimmen,
    datum: datum,
    standText: standText,
    widerrufHinweis: widerrufHinweis,
    kinder: kinder,
    widerrufen: widerrufen,
  };
});
