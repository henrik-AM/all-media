/**
 * All Media — Konto löschen, wie App und Website es beide ablaufen lassen.
 *
 * WARUM ES DAS GIBT
 *
 * Bis zum 22.10.2026 zeigte „Konto löschen" in beiden Oberflächen nur
 * „Löschauftrag vorgemerkt". Gelöscht wurde nichts. Das verletzt DSGVO
 * Art. 17, und Apple (App Review 5.1.1 v) wie Google Play lassen eine App
 * mit Konten nur zu, wenn sich das Konto in der App selbst löschen lässt
 * (Auftrag Recht/Sicherheit 21.10., Kasten RS 2).
 *
 * DER ABLAUF
 *
 *   1. Passwort erneut bestätigen (wer das Handy kurz unbeaufsichtigt
 *      liegen lässt, verliert nicht sein Konto).
 *   2. meine_medien() fragen. Fehlt die Funktion, ist Schema 103 noch nicht
 *      eingespielt → abbrechen, BEVOR irgendetwas gelöscht ist.
 *   3. konto_loeschen_probe() — Trockenlauf des Datenbankteils, danach
 *      zurückgerollt. Scheitert er, bricht der Ablauf ab, BEVOR eine Datei
 *      gelöscht ist (Codex-Fund F1, 31.10.2026: ein Elternteil mit Kind
 *      verlor sonst seine Fotos und behielt das Konto).
 *   4. Eigene Dateien über die Storage-API löschen. Direktes SQL auf
 *      storage.objects blockt Supabase (protect_delete).
 *   5. konto_loeschen('LOESCHEN') — löscht auth.users, alles Weitere fällt
 *      per cascade. Die Datenbank bricht ab, solange noch Dateien liegen.
 *   6. Abmelden.
 *
 * Warum nicht erst die Datenbank, dann die Dateien? Nach dem Löschen von
 * auth.users gilt die Sitzung nicht mehr, die Storage-API lehnt ab, und
 * die Dateien blieben verwaist liegen. Darum der Trockenlauf davor.
 *
 * Die Schritte baut schritteFuer() aus einem supabase-js-Client — App und
 * Website benutzen denselben Weg (Website: Anmeldung.aufbauen()). Das
 * Passwort geht dabei nur an Supabase, nie an den eigenen Server. Abmelden
 * reicht die Oberfläche herein: Sie muss das Konto auch aus ihrer Kontoliste
 * nehmen. Reihenfolge und Texte stehen nur hier.
 *
 * WER DIESELBE REGEL KENNT
 *
 * `public.konto_loeschen`, `public.meine_medien`, `public.gesperrte_nummer_pruefen`
 * aus SUPABASE_SCHEMA_103_konto_loeschen_auskunft.sql. Wer hier einen Grund
 * ergänzt, ergänzt ihn dort mit.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory();
  } else {
    // Browser: als eigenes <script> eingebunden.
    global.KontoLoeschen = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Das Wort, das konto_loeschen() als zweite Sicherung verlangt. */
  var WORT = 'LOESCHEN';

  /** Höchstens so viele Dateien je Aufruf der Storage-API. */
  var JE_AUFRUF = 100;

  var GRUENDE = {
    passwort: 'Das Passwort stimmt nicht',
    nicht_angemeldet: 'Bitte melde dich erneut an',
    bestaetigung: 'Bitte bestätige das Löschen',
    testkonto: 'Prüf- und Testkonten lassen sich nicht löschen',
    medien: 'Einige deiner Fotos und Videos ließen sich nicht entfernen. Bitte versuche es noch einmal',
    datenbank: 'Dein Konto lässt sich gerade nicht löschen. Es wurde nichts gelöscht. Schreib uns über „Problem melden"',
    noch_nicht: 'Konto löschen ist noch nicht freigeschaltet. Schreib uns über „Problem melden", dann löschen wir dein Konto von Hand',
    netz: 'Keine Verbindung — es wurde nichts gelöscht',
  };

  /** Hinweistext vor dem Löschen, für beide Oberflächen gleich. */
  var HINWEIS =
    'Dein Konto, dein Profil, deine Beiträge, Storys, Kommentare, Nachrichten, Fotos und ' +
    'Videos werden sofort und endgültig gelöscht. Das lässt sich nicht rückgängig machen. ' +
    'Meldungen, die du abgeschickt hast, bleiben ohne deinen Namen erhalten. Läuft gegen ' +
    'dein Konto eine Sperre, kann deine Telefonnummer bis zu ihrem Ende nicht für ein neues ' +
    'Konto genutzt werden. Wenn du vorher deine Daten haben möchtest: „Meine Daten herunterladen".';

  /** Fehlt die Funktion in der Datenbank (Schema noch nicht eingespielt)? */
  function fehltFunktion(fehler) {
    if (!fehler) return false;
    var code = fehler.code || '';
    return code === '42883' || code === 'PGRST202' || /could not find the function/i.test(fehler.message || '');
  }

  /** Text zu einem Grund aus konto_loeschen() oder aus dem Ablauf. */
  function grundText(grund) {
    return GRUENDE[grund] || 'Das Konto konnte nicht gelöscht werden. Bitte versuche es später noch einmal';
  }

  /** Dateien je Speicherbereich in Päckchen für die Storage-API teilen. */
  function paeckchen(medien) {
    var nachBereich = {};
    (medien || []).forEach(function (m) {
      if (!m || !m.bucket || !m.name) return;
      (nachBereich[m.bucket] = nachBereich[m.bucket] || []).push(m.name);
    });
    var liste = [];
    Object.keys(nachBereich).forEach(function (bucket) {
      var namen = nachBereich[bucket];
      for (var i = 0; i < namen.length; i += JE_AUFRUF) {
        liste.push({ bucket: bucket, namen: namen.slice(i, i + JE_AUFRUF) });
      }
    });
    return liste;
  }

  /**
   * Der ganze Ablauf. `schritte` liefert die Oberfläche:
   *   passwortPruefen(passwort) → Promise<boolean>
   *   medien()                  → Promise<{ data, error }>  (rpc meine_medien)
 *   probe()                   → Promise<{ data, error }>  (rpc konto_loeschen_probe)
   *   dateienLoeschen(bucket, namen) → Promise<{ error }>
   *   loeschen(wort)            → Promise<{ data, error }>  (rpc konto_loeschen)
   *   abmelden()                → Promise<void>
   * Ergebnis: { ok: true } oder { ok: false, grund, text }.
   */
  async function ablauf(passwort, schritte) {
    var nein = function (grund) { return { ok: false, grund: grund, text: grundText(grund) }; };
    try {
      if (!passwort || !(await schritte.passwortPruefen(passwort))) return nein('passwort');

      var liste = await schritte.medien();
      if (fehltFunktion(liste.error)) return nein('noch_nicht');
      if (liste.error) return nein('netz');

      var probe = await schritte.probe();
      if (fehltFunktion(probe.error)) return nein('noch_nicht');
      if (probe.error) return nein('netz');
      if (!(probe.data || {}).ok) return nein((probe.data || {}).grund || 'datenbank');

      var teile = paeckchen(liste.data);
      for (var i = 0; i < teile.length; i++) {
        var r = await schritte.dateienLoeschen(teile[i].bucket, teile[i].namen);
        if (r && r.error) return nein('medien');
      }

      var antwort = await schritte.loeschen(WORT);
      if (fehltFunktion(antwort.error)) return nein('noch_nicht');
      if (antwort.error) return nein('netz');
      var daten = antwort.data || {};
      if (!daten.ok) return nein(daten.grund || 'unbekannt');

      try { await schritte.abmelden(); } catch (e) { /* Konto ist weg, die Sitzung verfällt ohnehin */ }
      return { ok: true };
    } catch (e) {
      return nein('netz');
    }
  }

  /**
   * Die Schritte für ablauf() mit einem supabase-js-Client. Die erneute
   * Anmeldung prüft nur das Passwort — sie bleibt dasselbe Konto.
   */
  function schritteFuer(client, email, abmelden) {
    return {
      passwortPruefen: async function (passwort) {
        if (!email) return false;
        var r = await client.auth.signInWithPassword({ email: email, password: passwort });
        return !r.error;
      },
      medien: function () {
        return client.rpc('meine_medien');
      },
      probe: function () {
        return client.rpc('konto_loeschen_probe');
      },
      dateienLoeschen: function (bucket, namen) {
        return client.storage.from(bucket).remove(namen);
      },
      loeschen: function (wort) {
        return client.rpc('konto_loeschen', { p_bestaetigung: wort });
      },
      abmelden: abmelden,
    };
  }

  return {
    WORT: WORT,
    GRUENDE: GRUENDE,
    HINWEIS: HINWEIS,
    fehltFunktion: fehltFunktion,
    grundText: grundText,
    paeckchen: paeckchen,
    ablauf: ablauf,
    schritteFuer: schritteFuer,
  };
});
