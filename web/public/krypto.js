/*
 * Ende-zu-Ende-Verschlüsselung — die Browser-Seite.
 *
 * Gerechnet wird in `gemeinsam/krypto.js`, gemeinsam mit der App. Diese Datei
 * ist das Gegenstück zu `app/lib/krypto.ts`: sie entscheidet nur, wo der
 * geheime Schlüssel liegt und wie eine Nachricht auf ihrem Weg durch ihn
 * hindurchgeht.
 *
 * WARUM DIE KRYPTO IM BROWSER SITZT UND NICHT IM SERVER
 *
 * Die Website schickt ihre Nachrichten an den eigenen Node-Server, der sie
 * nach Supabase schreibt. Verschlüsselte der Server, hätte er den Klartext in
 * der Hand — und „Ende zu Ende" hieße dann „bis zu Render". Deshalb wird hier
 * verschlossen, bevor `fetch` losgeht, und hier geöffnet, nachdem die Antwort
 * da ist. Der Server sieht Chiffren und reicht sie durch.
 *
 * WO DER GEHEIME SCHLÜSSEL LIEGT — UND WAS DAS WERT IST
 *
 * In `localStorage`. Das ist ehrlicherweise schwächer als die Schlüsselkette
 * des Handys, die die App benutzt: jedes Skript, das es auf diese Seite
 * schafft, liest ihn mit. Dagegen steht die Inhaltsrichtlinie des Servers
 * (helmet in web/server/app.js) und dass keine fremden Skripte geladen
 * werden — die Supabase-Bibliothek liegt aus genau diesem Grund unter
 * public/lib/ statt bei einem Auslieferdienst.
 *
 * Besser ginge es im Browser nicht: es gibt keinen Ort, den JavaScript
 * beschreiben, aber nicht lesen kann. Wer das nicht will, benutzt die App.
 * Das steht hier, damit niemand später eine Sicherheit hineinliest, die es
 * an dieser Stelle nicht gibt.
 */

(function () {
  'use strict';

  /*
   * Die Fächer im localStorage — je KONTO (AR-08, 16.10.2026), wie in der
   * App (app/lib/krypto.ts). Bis dahin teilten sich alle Konten dieses
   * Browsers ein Paar: gleiche Sicherheitsnummer für Haupt- und Zweitkonto,
   * und wer nach dem Abmelden ein anderes Konto anmeldete, erbte es. Das alte
   * Fach ohne Kennung wird beim ersten Zugriff übernommen und gelöscht
   * (altbestandUebernehmen).
   */
  const ALT_SCHLUESSEL_FACH = 'allmedia.krypto.geheim';
  const ALT_GERAET_FACH = 'allmedia.krypto.geraet';

  function faecher(kontoId) {
    const id = String(kontoId);
    if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new Error('Ungültige Kontokennung');
    return { geheim: `${ALT_SCHLUESSEL_FACH}.${id}`, geraet: `${ALT_GERAET_FACH}.${id}` };
  }

  /**
   * Das alte, kontolose Paar übernehmen, damit bestehende Chats lesbar
   * bleiben: in das Fach des aktiven Kontos und — weil bisher JEDES Konto
   * dieses Browsers damit geschrieben hat — in die der übrigen hier
   * angemeldeten (Anmeldung.konten()), sofern sie noch keins haben. Erst
   * schreiben, dann löschen. Gleicher Weg in der App.
   */
  function altbestandUebernehmen(kontoId) {
    const altGeheim = localStorage.getItem(ALT_SCHLUESSEL_FACH);
    const altGeraet = localStorage.getItem(ALT_GERAET_FACH);
    // Die Kennung legte die alte Fassung erst beim Anmelden an; fehlt sie,
    // entsteht unten eine neue — der Schlüssel ist das, was zählt.
    if (!altGeheim) return;

    let konten = [kontoId];
    try {
      konten = [...new Set([kontoId, ...(window.Anmeldung?.konten?.() || []).map((k) => k.id)])];
    } catch {
      throw new Error('Gespeicherte Konten nicht ladbar; Altbestand bleibt erhalten');
    }
    for (const id of konten) {
      if (!id) continue;
      const f = faecher(id);
      const vorhanden = localStorage.getItem(f.geheim);
      if (vorhanden && vorhanden !== altGeheim) continue;
      if (!vorhanden) localStorage.setItem(f.geheim, altGeheim);
      // Nach einem Abbruch zwischen beiden Schreibvorgängen das Paar ergänzen.
      if (altGeraet && !localStorage.getItem(f.geraet)) {
        localStorage.setItem(f.geraet, altGeraet);
      }
    }
    localStorage.removeItem(ALT_SCHLUESSEL_FACH);
    localStorage.removeItem(ALT_GERAET_FACH);
  }

  /** Der Platzhalter, wenn das Kuvert für dieses Gerät fehlt. Wie in der App. */
  const NICHT_LESBAR = 'Auf diesem Gerät nicht lesbar';

  /*
   * Der eigene Schlüssel, einmal geholt und behalten.
   *
   * Ohne das Behalten ginge bei jeder Nachricht eine Anmeldung des Geräts an
   * den Server — dreißig Nachrichten, dreißig Rundläufe. Der geheime Teil
   * steht dabei nur im Speicher dieser Seite; er wandert nicht mit.
   */
  let meiner = null;
  const anmeldungen = new Map();
  let stand = 0;
  const kontoJetzt = () => window.Anmeldung?.nutzer?.()?.id || null;

  function geraeteKennung(f) {
    let kennung = localStorage.getItem(f.geraet);
    if (!kennung) {
      // `crypto.randomUUID` ist in jedem Browser da, der auch WebCrypto hat —
      // und ohne WebCrypto gäbe es hier ohnehin keinen brauchbaren Zufall.
      kennung = crypto.randomUUID();
      localStorage.setItem(f.geraet, kennung);
    }
    return kennung;
  }

  function oeffentlichAus(geheim) {
    const paar = nacl.box.keyPair.fromSecretKey(Krypto.ausBase64(geheim));
    return Krypto.zuBase64(paar.publicKey);
  }

  /**
   * Den Schlüssel dieses Browsers anlegen (falls nötig) und beim Server anmelden.
   *
   * Gibt bei Fehlern null zurück; verschliessen lehnt dann ab, wo der
   * Chat Verschlüsselung verlangt.
   */
  async function anmelden() {
    /*
     * Der behaltene Schlüssel gilt nur für das Konto, für das er geholt
     * wurde. Schaltet die Seite um, ohne `vergessen` zu rufen, wäre sonst
     * der des vorigen Kontos weiter im Spiel (AR-08).
     */
    const kontoId = kontoJetzt();
    const version = stand;
    if (meiner && meiner.kontoId === kontoId) return meiner;
    if (meiner) meiner = null;
    if (anmeldungen.has(kontoId)) return anmeldungen.get(kontoId);

    const lauf = (async () => {
      try {
        if (!kontoId) throw new Error('Kein Konto angemeldet');
        const f = faecher(kontoId);
        if (!localStorage.getItem(f.geheim) || !localStorage.getItem(f.geraet)) {
          altbestandUebernehmen(kontoId);
        }
        let geheim = localStorage.getItem(f.geheim);
        if (!geheim) {
          geheim = Krypto.schluesselpaarErzeugen().geheim;
          localStorage.setItem(f.geheim, geheim);
          // Neues Paar, neues Gerät: eine liegengebliebene Kennung gehörte
          // zu einem anderen Schlüssel.
          localStorage.removeItem(f.geraet);
        }
        const geraet = geraeteKennung(f);
        const oeffentlich = oeffentlichAus(geheim);

        const antwort = await fetch('/api/krypto/schluessel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ geraet, art: 'web', oeffentlich }),
        });
        if (!antwort.ok) throw new Error('Schlüssel nicht angemeldet');
        const { id } = await antwort.json();
        if (!id) throw new Error('Keine Schlüsselkennung');
        if (version !== stand || kontoJetzt() !== kontoId) return null;

        meiner = { id, geraet, oeffentlich, geheim, kontoId };
        return meiner;
      } catch (fehler) {
        console.warn('Gerätschlüssel nicht verfügbar:', fehler.message);
        return null;
      }
    })();

    anmeldungen.set(kontoId, lauf);
    lauf.finally(() => { if (anmeldungen.get(kontoId) === lauf) anmeldungen.delete(kontoId); });
    return lauf;
  }

  /** Den eigenen Schlüssel wegwerfen — beim Abmelden. */
  function vergessen() {
    stand++;
    meiner = null;
    anmeldungen.clear();
    verschluesselteChats.clear();
    pruefer = neuerPruefer();
  }

  /** Diesen Chat als verschlüsselt merken — für die Vorschau der Chatliste. */
  function merken(chatId) {
    if (chatId) verschluesselteChats.add(kontoJetzt() + '|' + chatId);
  }

  /*
   * Die Meldung, wenn verschlüsselt werden müsste und es nicht geht. Steht in
   * gemeinsam/krypto.js; der Rückgriff hier gilt nur für den Fall, dass der
   * Browser von dort noch eine alte Fassung im Zwischenspeicher hat — auch
   * dann soll der Satz stimmen und nichts offen hinausgehen.
   */
  const MELDUNG_NICHT_VERSCHLUESSELT =
    (typeof Krypto !== 'undefined' && Krypto.MELDUNG_NICHT_VERSCHLUESSELT) ||
    'Die Nachricht ließ sich gerade nicht verschlüsseln und wurde nicht gesendet. ' +
      'Bitte versuch es noch einmal.';

  /*
   * Chats, die dieser Browser in dieser Sitzung schon verschlüsselt erlebt
   * hat — beim Öffnen oder beim eigenen Senden. Zweite Sicherung neben der
   * Abfrage nach `krypto > 0`: liefert der Server später eine leere Antwort,
   * weiß die Seite trotzdem, dass hier verschlüsselt geschrieben wird.
   * Gleiche Liste in app/lib/krypto.ts (verschluesselteChats).
   */
  const verschluesselteChats = new Set();

  /**
   * Einen Text für einen Chat verschließen.
   *
   * Drei Ausgänge, entschieden von `Krypto.sendeweg` — derselben Regel wie in
   * der App (AR-05, 16.10.2026):
   *
   *   - `null`: Klartext ist hier richtig (Gruppe, Gegenüber ohne Gerät und
   *     noch nie verschlüsselt geschrieben). Der Aufrufer schickt `text`.
   *   - ein Paket: verschlossen, der Server bekommt nur die Chiffre.
   *   - ein Wurf mit dem Satz für den Nutzer: verschlüsselt werden MÜSSTE,
   *     geht aber nicht. Dann geht gar nichts hinaus.
   *
   * Bis zum 16.10.2026 hieß jeder Fehler hier `null` — und damit Klartext,
   * still, in einem Chat, den das Kontaktprofil „Ende-zu-Ende" nannte.
   */
  async function verschliessen(chatId, text) {
    const kontoId = kontoJetzt();
    let fakten;
    try {
      if (typeof Krypto.sendeweg !== 'function') throw new Error('Alte krypto.js im Zwischenspeicher');
      const ich = await anmelden();
      const antwort = await fetch(`/api/krypto/empfaenger/${chatId}`);
      if (!antwort.ok) throw new Error('Server antwortet mit ' + antwort.status);
      fakten = await antwort.json();
      if (kontoJetzt() !== kontoId || !kontoId || fakten?.ichId !== kontoId) throw new Error('Konto gewechselt');
      if (!fakten || fakten.ok === false) throw new Error(fakten?.error || 'Keine Fakten');
      fakten.meiner = ich;
      fakten.gemerkt = verschluesselteChats.has(kontoJetzt() + '|' + chatId);
    } catch (fehler) {
      console.warn('Verschlüsselung nicht prüfbar:', fehler.message);
      throw new Error(MELDUNG_NICHT_VERSCHLUESSELT);
    }

    if (Krypto.zuVieleMitglieder(fakten)) throw new Error(Krypto.MELDUNG_NUR_ZU_ZWEIT);
    if (!text) return null;
    const weg = Krypto.sendeweg(fakten);
    if (weg.art === 'offen') return null;
    if (weg.art === 'ablehnen') throw new Error(weg.meldung);

    let paket;
    try {
      paket = Krypto.verschluesseln(text, fakten.meiner.geheim, weg.empfaenger);
    } catch (fehler) {
      console.warn('Verschlüsseln fehlgeschlagen:', fehler.message);
      throw new Error(MELDUNG_NICHT_VERSCHLUESSELT);
    }
    verschluesselteChats.add(kontoJetzt() + '|' + chatId);
    return {
      krypto: paket.version,
      chiffre: paket.chiffre,
      kryptoNonce: paket.nonce,
      absenderSchluessel: paket.absender,
      kuverts: paket.kuverts,
    };
  }

  /**
   * Eine Nachricht öffnen, wie der Server sie geliefert hat.
   *
   * Ändert `text` an Ort und Stelle und gibt die Nachricht zurück. Alles
   * danach — Blase, Vorschau, Suche, Bezug — rechnet damit, als hätte es nie
   * eine Chiffre gegeben. Nur so bleibt die Verschlüsselung eine Schicht und
   * nicht ein Sonderfall an fünfzig Stellen in app.js.
   */
  function oeffnen(nachricht) {
    if (!nachricht || !Number(nachricht.krypto)) return nachricht;
    // Ab jetzt weiß diese Seite: in diesem Chat wird verschlüsselt geschrieben.
    if (nachricht.chatId) verschluesselteChats.add(kontoJetzt() + '|' + nachricht.chatId);
    nachricht._geoeffnet = false;
    if (!bereit() || !nachricht.kuvert) {
      nachricht.text = NICHT_LESBAR;
      return nachricht;
    }
    const klar = Krypto.entschluesseln(
      {
        version: nachricht.krypto,
        chiffre: nachricht.chiffre,
        nonce: nachricht.kryptoNonce,
        absender: nachricht.absenderSchluessel,
      },
      nachricht.kuvert,
      meiner.geheim
    );
    nachricht.text = klar === null ? NICHT_LESBAR : klar;
    if (klar !== null) nachricht._geoeffnet = true;
    return nachricht;
  }

  /*
   * Der Absender-Prüfer (AR-04) — eine Liste je Seite, gemerkt über das
   * Nachsehen im Takt hinweg. Die Rechnung steht in gemeinsam/krypto.js,
   * gleich wie in der App.
   */
  function neuerPruefer() { return typeof Krypto.absenderPruefer === 'function'
      ? Krypto.absenderPruefer(async (paare) => {
          const antwort = await fetch('/api/krypto/absender', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paare }),
          });
          if (!antwort.ok) throw new Error('Server antwortet mit ' + antwort.status);
          return (await antwort.json()).gefunden || [];
        })
      : null; }
  let pruefer = neuerPruefer();

  /**
   * Gehört der Absenderschlüssel jeder geöffneten Nachricht zu ihrem
   * Absender? (AR-04, 16.10.2026)
   *
   * Setzt `nichtPruefbar` an Nachrichten, deren Schlüssel der Absender nie
   * angemeldet hat — die Blase sagt dann „Absender nicht prüfbar". Sind die
   * Schlüssel gerade nicht ladbar, warnt die Blase ebenfalls; der Text bleibt lesbar.
   * Nur der Verlauf, nicht die Vorschau der Chatliste. Gleiche Regel in
   * app/lib/krypto.ts (aufschliessen, absenderPruefen).
   */
  async function absenderPruefen(nachrichten) {
    if (!pruefer) return nachrichten;
    const geoeffnet = (nachrichten || []).filter(
      (n) => n && n._geoeffnet && n.senderId && n.absenderSchluessel
    );
    if (!geoeffnet.length) return nachrichten;
    try {
      const urteile = await pruefer.pruefen(
        geoeffnet.map((n) => ({ userId: n.senderId, schluessel: n.absenderSchluessel }))
      );
      geoeffnet.forEach((n, i) => {
        n.nichtPruefbar = urteile[i] !== true;
      });
    } catch (fehler) {
      console.warn('Absender nicht geprüft:', fehler.message);
    }
    return nachrichten;
  }

  /**
   * Einen ganzen Stapel öffnen — samt der Bezüge daran.
   *
   * Der Bezug einer Antwort ist selbst eine Nachricht und selbst
   * verschlüsselt. Ohne diese Zeile stünde über einer geöffneten Antwort ein
   * leerer Bezugskopf — ein Fehler, den man erst im Bild sieht, nie im
   * Prüflauf.
   */
  function stapelOeffnen(nachrichten) {
    for (const n of nachrichten || []) {
      oeffnen(n);
      if (n.antwortAuf) oeffnen(n.antwortAuf);
      if (n.zitat) oeffnen(n.zitat);
    }
    return nachrichten;
  }

  /**
   * Eine verschlüsselte Nachricht mit neuem Text verschließen — fürs
   * Bearbeiten (Kasten 27). Der Sitzungsschlüssel kommt aus dem Kuvert
   * dieses Browsers; die Kuverts aller anderen passen danach weiter. Gibt
   * `{ krypto, chiffre, kryptoNonce }` für die Bearbeiten-Route zurück oder
   * null, wenn dieser Browser die Nachricht nicht öffnen kann. Gleicher Weg
   * in app/lib/krypto.ts (fuerBearbeitenUmschliessen).
   */
  function umschliessen(nachricht, text) {
    if (!meiner || !nachricht || !Number(nachricht.krypto) || !nachricht.kuvert) return null;
    const neu = Krypto.umschliessen(
      text,
      { version: nachricht.krypto, absender: nachricht.absenderSchluessel },
      nachricht.kuvert,
      meiner.geheim
    );
    return neu ? { krypto: Number(nachricht.krypto), chiffre: neu.chiffre, kryptoNonce: neu.nonce } : null;
  }

  /**
   * Der Beleg einer gemeldeten Nachricht (Kasten RS 3, Schema 102).
   *
   * Unverschlüsselt: `{ text }`. Verschlüsselt: `{ text, sitzung }` — der
   * Klartext und der Sitzungsschlüssel NUR dieser Nachricht
   * (gemeinsam/krypto.js, meldebeleg). Der Gerätschlüssel dieses Browsers
   * verlässt ihn nicht. null, wenn die Nachricht hier nicht aufgeht.
   * Gleicher Weg in app/lib/krypto.ts (meldebelegHolen).
   */
  function meldebeleg(nachricht) {
    if (!nachricht) return null;
    if (!Number(nachricht.krypto)) return { text: String(nachricht.text || '') };
    if (!meiner || !nachricht.kuvert || typeof Krypto.meldebeleg !== 'function') return null;
    return Krypto.meldebeleg(
      {
        version: nachricht.krypto,
        chiffre: nachricht.chiffre,
        nonce: nachricht.kryptoNonce,
        absender: nachricht.absenderSchluessel,
      },
      nachricht.kuvert,
      meiner.geheim
    );
  }

  /** Der Fingerabdruck zum Vergleichen von Hand — im Kontaktprofil sichtbar. */
  function fingerabdruck(oeffentlich) {
    return Krypto.fingerabdruck(oeffentlich);
  }

  /**
   * Die Sicherheitsnummer einer Person über ALLE ihre Geräte — im
   * Kontaktprofil sichtbar (AR-04, 16.10.2026). Dieselbe Rechnung wie in der
   * App (gemeinsam/krypto.js). `{ nummer, geraete }` oder null.
   */
  function sicherheitsnummer(oeffentliche) {
    return Krypto.sicherheitsnummer(oeffentliche);
  }

  /** Steht für diesen Browser überhaupt ein Schlüssel bereit? */
  function bereit() {
    return Boolean(meiner && meiner.kontoId === kontoJetzt());
  }

  window.KryptoWeb = {
    NICHT_LESBAR,
    anmelden,
    vergessen,
    merken,
    verschliessen,
    oeffnen,
    stapelOeffnen,
    absenderPruefen,
    umschliessen,
    meldebeleg,
    fingerabdruck,
    sicherheitsnummer,
    bereit,
    meinSchluessel: () => bereit() ? meiner : null,
  };
})();
