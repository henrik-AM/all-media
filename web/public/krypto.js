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

  const SCHLUESSEL_FACH = 'allmedia.krypto.geheim';
  const GERAET_FACH = 'allmedia.krypto.geraet';

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
  let anmeldungLaeuft = null;

  function geraeteKennung() {
    let kennung = localStorage.getItem(GERAET_FACH);
    if (!kennung) {
      // `crypto.randomUUID` ist in jedem Browser da, der auch WebCrypto hat —
      // und ohne WebCrypto gäbe es hier ohnehin keinen brauchbaren Zufall.
      kennung = crypto.randomUUID();
      localStorage.setItem(GERAET_FACH, kennung);
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
   * Gibt `null` zurück, wenn irgendetwas davon nicht geht. Dann wird im
   * Klartext geschrieben wie vor Schema 31 — und die Oberfläche zeigt kein
   * Schloss, behauptet also auch nichts.
   */
  async function anmelden() {
    if (meiner) return meiner;
    if (anmeldungLaeuft) return anmeldungLaeuft;

    anmeldungLaeuft = (async () => {
      try {
        let geheim = localStorage.getItem(SCHLUESSEL_FACH);
        if (!geheim) {
          geheim = Krypto.schluesselpaarErzeugen().geheim;
          localStorage.setItem(SCHLUESSEL_FACH, geheim);
        }
        const geraet = geraeteKennung();
        const oeffentlich = oeffentlichAus(geheim);

        const antwort = await fetch('/api/krypto/schluessel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ geraet, art: 'web', oeffentlich }),
        });
        if (!antwort.ok) throw new Error('Schlüssel nicht angemeldet');
        const { id } = await antwort.json();

        meiner = { id, geraet, oeffentlich, geheim };
        return meiner;
      } catch (fehler) {
        console.warn('Gerätschlüssel nicht verfügbar:', fehler.message);
        return null;
      } finally {
        anmeldungLaeuft = null;
      }
    })();

    return anmeldungLaeuft;
  }

  /** Den eigenen Schlüssel wegwerfen — beim Abmelden. */
  function vergessen() {
    meiner = null;
  }

  /**
   * Einen Text für einen Chat verschließen.
   *
   * Gibt `null` zurück, wenn nicht verschlüsselt werden kann — kein
   * Schlüssel, Gruppe, Gegenüber ohne Gerät. Der Aufrufer schickt dann den
   * Klartext wie bisher. Das ist bewusst kein Fehler: eine Nachricht, die
   * nicht ankommt, wäre schlechter als eine, die unverschlüsselt ankommt und
   * dabei auch nichts anderes behauptet.
   */
  async function verschliessen(chatId, text) {
    if (!text) return null;
    try {
      const ich = await anmelden();
      if (!ich) return null;

      const antwort = await fetch(`/api/krypto/empfaenger/${chatId}`);
      if (!antwort.ok) return null;
      const { verschluesselbar, schluessel } = await antwort.json();
      if (!verschluesselbar || !schluessel?.length) return null;

      const paket = Krypto.verschluesseln(text, ich.geheim, schluessel);
      return {
        krypto: paket.version,
        chiffre: paket.chiffre,
        kryptoNonce: paket.nonce,
        absenderSchluessel: paket.absender,
        kuverts: paket.kuverts,
      };
    } catch (fehler) {
      console.warn('Verschlüsseln übersprungen:', fehler.message);
      return null;
    }
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
    if (!meiner || !nachricht.kuvert) {
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
    return nachricht;
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

  /** Der Fingerabdruck zum Vergleichen von Hand — im Kontaktprofil sichtbar. */
  function fingerabdruck(oeffentlich) {
    return Krypto.fingerabdruck(oeffentlich);
  }

  /** Steht für diesen Browser überhaupt ein Schlüssel bereit? */
  function bereit() {
    return Boolean(meiner);
  }

  window.KryptoWeb = {
    NICHT_LESBAR,
    anmelden,
    vergessen,
    verschliessen,
    oeffnen,
    stapelOeffnen,
    fingerabdruck,
    bereit,
    meinSchluessel: () => meiner,
  };
})();
