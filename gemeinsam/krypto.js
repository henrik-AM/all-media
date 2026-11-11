/**
 * All Media — Ende-zu-Ende-Verschlüsselung, die Rechenschicht.
 *
 * WARUM ES DAS GIBT
 *
 * Im Anrufbildschirm und im Kontaktprofil stand „Ende-zu-Ende-verschlüsselt",
 * und verschlüsselt wurde nichts. Das ist der letzte offene Punkt aus dem
 * Handbuch-Abgleich und der mit dem größten rechtlichen Gewicht: ein Satz,
 * der dem Nutzer etwas zusichert, war schlicht unwahr.
 *
 * WARUM IN `gemeinsam/`
 *
 * Krypto darf es nicht zweimal geben. Zwei Fassungen laufen auseinander, und
 * beim Verschlüsseln heißt „auseinander" nicht „sieht anders aus", sondern
 * „die andere Seite kann es nicht mehr lesen". Diese Datei läuft unverändert
 * in Node (Prüfläufe, Server), in Metro (App) und im Browser (Website).
 *
 * WAS SIE NICHT TUT
 *
 * Sie kennt weder Supabase noch SecureStore noch localStorage. Sie rechnet
 * nur. Wo ein Schlüssel liegt, entscheidet jede Seite selbst — in der App
 * `app/lib/krypto.ts`, im Browser `web/public/krypto.js`.
 *
 * DAS VERFAHREN
 *
 * NaCl, also X25519 für den Schlüsseltausch und XSalsa20-Poly1305 für den
 * Inhalt (`tweetnacl.js` daneben, reines JavaScript, gemeinfrei). Kein
 * natives Modul — sonst liefe es in Expo Go nicht.
 *
 * Je Nachricht ein frischer Sitzungsschlüssel; der Text wird einmal damit
 * verschlossen. Dieser Sitzungsschlüssel wird dann für jedes Gerät, das
 * mitlesen darf, einzeln in ein Kuvert gelegt. Das ist der Grund, warum eine
 * Person zugleich App und Website benutzen kann und warum Gruppen ohne einen
 * zweiten Mechanismus funktionieren: mehr Geräte heißt mehr Kuverts, nicht
 * mehr Chiffren.
 *
 * WAS DAMIT AUSDRÜCKLICH NICHT ZUGESICHERT IST
 *
 * - Wer mit wem schreibt, wann und wie oft, steht weiter unverschlüsselt in
 *   der Datenbank. Verschlüsselt ist der Inhalt, nicht die Beziehung.
 * - Es gibt keine Vorwärtssicherheit. Wer den Gerätschlüssel bekommt, kann
 *   alle alten Nachrichten dieses Geräts lesen. Signal löst das mit Double
 *   Ratchet; das ist ein eigenes Vorhaben.
 * - Die öffentlichen Schlüssel kommen vom Server. Wer den Server beherrscht,
 *   kann einen eigenen Schlüssel unterschieben. Dagegen hilft nur ein
 *   Vergleich der Sicherheitsnummer von Hand — `sicherheitsnummer()` bildet
 *   sie über ALLE Geräte einer Person (seit 16.10.2026, AR-04), die
 *   Oberfläche zeigt sie samt Gerätezahl im Kontaktprofil.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory(require('./tweetnacl'));
  } else {
    // Browser: tweetnacl.js liegt als eigenes <script> davor.
    global.Krypto = factory(global.nacl);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (nacl) {
  'use strict';

  /**
   * Die Fassung des Verfahrens.
   *
   * Sie steht an jeder Nachricht. Wer später etwas ändert — anderes Verfahren,
   * andere Reihenfolge —, zählt hoch und lässt alte Nachrichten mit der alten
   * Zahl lesbar. Ohne diese Zahl wäre jede Änderung am Format ein stiller
   * Datenverlust.
   */
  var VERSION = 1;

  // ------------------------------------------------------------- Zufall --

  /**
   * Die Zufallsquelle setzen.
   *
   * tweetnacl findet sie im Browser (`crypto.getRandomValues`) und in Node
   * (`crypto.randomBytes`) allein. React Native hat keine von beiden — dort
   * reicht die App `expo-crypto` durch. Ohne Quelle wirft tweetnacl „no PRNG",
   * und das ist richtig so: lieber ein Fehler als ein vorhersagbarer
   * Schlüssel.
   */
  function zufallsquelleSetzen(fn) {
    nacl.setPRNG(fn);
  }

  /** Prüft, ob überhaupt eine Zufallsquelle da ist — vor dem ersten Schlüssel. */
  function zufallBereit() {
    try {
      nacl.randomBytes(1);
      return true;
    } catch (e) {
      return false;
    }
  }

  // -------------------------------------------------------------- Base64 --

  /*
   * Eigene Base64-Umrechnung, weil keine der vorhandenen überall da ist:
   * `Buffer` gibt es nur in Node, `atob`/`btoa` nur im Browser, und React
   * Native hat mal das eine und mal das andere. Dreißig Zeilen sind billiger
   * als eine Fallunterscheidung, die auf einer der drei Seiten schiefgeht.
   */
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  function zuBase64(bytes) {
    var aus = '';
    var i;
    for (i = 0; i + 2 < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      aus += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    }
    var rest = bytes.length - i;
    if (rest === 1) {
      var a = bytes[i] << 16;
      aus += B64[(a >> 18) & 63] + B64[(a >> 12) & 63] + '==';
    } else if (rest === 2) {
      var b = (bytes[i] << 16) | (bytes[i + 1] << 8);
      aus += B64[(b >> 18) & 63] + B64[(b >> 12) & 63] + B64[(b >> 6) & 63] + '=';
    }
    return aus;
  }

  function ausBase64(text) {
    var sauber = String(text || '').replace(/[^A-Za-z0-9+/]/g, '');
    var laenge = Math.floor((sauber.length * 3) / 4);
    var bytes = new Uint8Array(laenge);
    var p = 0;
    for (var i = 0; i < sauber.length; i += 4) {
      var n =
        (B64.indexOf(sauber[i]) << 18) |
        (B64.indexOf(sauber[i + 1]) << 12) |
        ((B64.indexOf(sauber[i + 2]) & 63) << 6) |
        (B64.indexOf(sauber[i + 3]) & 63);
      if (p < laenge) bytes[p++] = (n >> 16) & 255;
      if (p < laenge) bytes[p++] = (n >> 8) & 255;
      if (p < laenge) bytes[p++] = n & 255;
    }
    return bytes;
  }

  /*
   * UTF-8 von Hand, aus demselben Grund: `TextEncoder` fehlt in manchen
   * React-Native-Fassungen. Ein Umlaut oder ein Emoji darf beim Verschlüsseln
   * nicht kaputtgehen — genau das passiert bei einer byteweisen Umrechnung.
   */
  function zuBytes(text) {
    var s = unescape(encodeURIComponent(String(text == null ? '' : text)));
    var bytes = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes;
  }

  function ausBytes(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return decodeURIComponent(escape(s));
  }

  // ---------------------------------------------------------- Schlüssel --

  /**
   * Ein Schlüsselpaar für dieses Gerät erzeugen.
   *
   * Der geheime Teil verlässt das Gerät nie. Der öffentliche geht in die
   * Tabelle `krypto_schluessel`, damit andere an ihn heranschreiben können.
   */
  function schluesselpaarErzeugen() {
    var paar = nacl.box.keyPair();
    return {
      oeffentlich: zuBase64(paar.publicKey),
      geheim: zuBase64(paar.secretKey),
    };
  }

  /**
   * Der Fingerabdruck eines öffentlichen Schlüssels — acht Vierergruppen.
   *
   * Er ist die einzige Möglichkeit, den Schlüsseltausch zu prüfen, ohne dem
   * Server zu glauben. Deshalb steht er im Kontaktprofil und nicht in einem
   * Entwicklermenü.
   */
  function fingerabdruck(oeffentlich) {
    var summe = nacl.hash(ausBase64(oeffentlich));
    var ziffern = '';
    for (var i = 0; i < 16; i++) ziffern += ('0' + summe[i].toString(16)).slice(-2);
    return (ziffern.toUpperCase().match(/.{4}/g) || []).join(' ');
  }

  /**
   * Die Sicherheitsnummer einer PERSON — über alle ihre Geräte zugleich
   * (Sicherheitsprüfung 16.10.2026, AR-04).
   *
   * WARUM NICHT MEHR DER EINE SCHLÜSSEL
   *
   * Bis dahin zeigte das Kontaktprofil den Fingerabdruck des JÜNGSTEN
   * Schlüssels. Verschlossen wird aber für ALLE Geräte des Gegenübers. Wer
   * einen eigenen Schlüssel für das Konto unterbringt — mit einem
   * `created_at` in der Vergangenheit —, bekam ein Kuvert für jede Nachricht,
   * und die Nummer blieb dieselbe. Ein Vergleich von Hand fiel positiv aus
   * und bewies nichts.
   *
   * Jetzt gehen alle Schlüssel in eine Nummer ein: sortiert (die Reihenfolge
   * aus der Datenbank darf keine Rolle spielen, App und Website müssen
   * dieselbe Nummer zeigen), doppelte nur einmal, dann gemeinsam gehasht.
   * Kommt ein Gerät dazu oder fällt eins weg, ändert sich die Nummer — genau
   * das soll ein Vergleich sehen.
   *
   * Mit genau einem Schlüssel ist die Nummer dieselbe wie `fingerabdruck`
   * dieses Schlüssels: wer früher verglichen hat und nur ein Gerät benutzt,
   * sieht keine neue Nummer.
   *
   * Gibt `{ nummer, geraete }` zurück oder `null`, wenn es keinen Schlüssel gibt.
   */
  function sicherheitsnummer(oeffentliche) {
    var schon = {};
    var liste = [];
    (oeffentliche || []).forEach(function (k) {
      var text = String(k || '');
      if (!text || schon[text]) return;
      if (ausBase64(text).length !== 32 || zuBase64(ausBase64(text)) !== text) {
        throw new Error('Ungültiger Geräteschlüssel');
      }
      schon[text] = true;
      liste.push(text);
    });
    if (!liste.length) return null;
    liste.sort();

    var teile = liste.map(ausBase64);
    var laenge = teile.reduce(function (summe, t) {
      return summe + t.length;
    }, 0);
    var alles = new Uint8Array(laenge);
    var p = 0;
    teile.forEach(function (t) {
      alles.set(t, p);
      p += t.length;
    });

    var summe = nacl.hash(alles);
    var ziffern = '';
    for (var i = 0; i < 16; i++) ziffern += ('0' + summe[i].toString(16)).slice(-2);
    return {
      nummer: (ziffern.toUpperCase().match(/.{4}/g) || []).join(' '),
      geraete: liste.length,
    };
  }

  // -------------------------------------------------------- Verschließen --

  /**
   * Einen Text verschließen.
   *
   * `empfaenger` ist die Liste aller Geräte, die mitlesen dürfen — die des
   * Gegenübers **und** die eigenen. Die eigenen gehören zwingend dazu: sonst
   * kann man seine eigene Nachricht am zweiten Gerät nicht mehr lesen. Beim
   * Aufrufer liegt es, diese Liste vollständig zu füllen; hier wird sie nur
   * abgearbeitet.
   *
   * Rückgabe passt eins zu eins auf die Datenbankspalten:
   *   { version, chiffre, nonce, absender, kuverts: [{ schluesselId, nonce, chiffre }] }
   */
  function verschluesseln(text, meinGeheim, empfaenger) {
    var liste = empfaenger || [];
    if (!liste.length) throw new Error('Kein Empfängerschlüssel — nichts zu verschließen');

    var sitzung = nacl.randomBytes(nacl.secretbox.keyLength);
    var nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    var chiffre = nacl.secretbox(zuBytes(text), nonce, sitzung);

    var geheim = ausBase64(meinGeheim);
    var meinOeffentlich = zuBase64(nacl.box.keyPair.fromSecretKey(geheim).publicKey);

    var kuverts = [];
    for (var i = 0; i < liste.length; i++) {
      var kn = nacl.randomBytes(nacl.box.nonceLength);
      var kc = nacl.box(sitzung, kn, ausBase64(liste[i].oeffentlich), geheim);
      kuverts.push({
        schluesselId: liste[i].id,
        nonce: zuBase64(kn),
        chiffre: zuBase64(kc),
      });
    }

    return {
      version: VERSION,
      chiffre: zuBase64(chiffre),
      nonce: zuBase64(nonce),
      absender: meinOeffentlich,
      kuverts: kuverts,
    };
  }

  /**
   * Einen Text wieder öffnen.
   *
   * `kuvert` ist das Kuvert, das für **meinen** Gerätschlüssel bestimmt war;
   * welches das ist, entscheidet die Abfrage, nicht diese Funktion.
   *
   * Gibt `null` zurück, wenn es nicht aufgeht — kein Wurf. Eine Nachricht von
   * einem Gerät, dessen Schlüssel man nicht mehr hat, ist ein normaler
   * Zustand und darf die ganze Chatliste nicht zum Absturz bringen. Die
   * Oberfläche zeigt dann „Diese Nachricht lässt sich auf diesem Gerät nicht
   * lesen" statt eines leeren Bildschirms.
   */
  function entschluesseln(nachricht, kuvert, meinGeheim) {
    try {
      if (!nachricht || !kuvert || !meinGeheim) return null;
      if (Number(nachricht.version) !== VERSION) return null;

      var geheim = ausBase64(meinGeheim);
      var sitzung = nacl.box.open(
        ausBase64(kuvert.chiffre),
        ausBase64(kuvert.nonce),
        ausBase64(nachricht.absender),
        geheim
      );
      if (!sitzung) return null;

      var klar = nacl.secretbox.open(
        ausBase64(nachricht.chiffre),
        ausBase64(nachricht.nonce),
        sitzung
      );
      if (!klar) return null;

      return ausBytes(klar);
    } catch (e) {
      return null;
    }
  }

  /**
   * Eine verschlüsselte Nachricht mit neuem Text verschließen — fürs
   * Bearbeiten (Kasten 27, 06.10.2026).
   *
   * Der Sitzungsschlüssel der Nachricht wird aus MEINEM Kuvert geholt und
   * wiederverwendet, nur der Inhalt wird neu verschlossen (frische Nonce).
   * Damit passen alle vorhandenen Kuverts weiter, und es muss keins
   * ausgetauscht werden.
   *
   * Warum nicht neu verschlüsseln wie beim Senden: das ergäbe einen neuen
   * Sitzungsschlüssel und damit neue Kuverts. Die alten lassen sich aber
   * nicht entfernen — auf `message_keys` gibt es keine Löschregel (Schema
   * 31), das DELETE trifft still null Zeilen, und das Einfügen der neuen
   * scheitert dann am Primärschlüssel. Die App tat genau das: erst wurde
   * die neue Chiffre gespeichert, dann scheiterten die Kuverts — und die
   * bearbeitete Nachricht war für alle unlesbar.
   *
   * `absender` bleibt, wie er ist: die Kuverts sind mit ihm verschlossen.
   * Gibt `{ chiffre, nonce }` zurück oder `null`, wenn mein Kuvert nicht
   * aufgeht (dann kann dieses Gerät die Nachricht auch nicht lesen).
   */
  function umschliessen(text, nachricht, kuvert, meinGeheim) {
    try {
      if (!nachricht || !kuvert || !meinGeheim) return null;
      if (Number(nachricht.version) !== VERSION) return null;
      var sitzung = nacl.box.open(
        ausBase64(kuvert.chiffre),
        ausBase64(kuvert.nonce),
        ausBase64(nachricht.absender),
        ausBase64(meinGeheim)
      );
      if (!sitzung) return null;
      var nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
      var chiffre = nacl.secretbox(zuBytes(text), nonce, sitzung);
      return { chiffre: zuBase64(chiffre), nonce: zuBase64(nonce) };
    } catch (e) {
      return null;
    }
  }

  // ------------------------------------------------------ Meldebeleg --

  /*
   * Eine verschlüsselte Nachricht melden (Kasten RS 3, Schema 102).
   *
   * Der Betreiber darf Chats nicht lesen (Fernmeldegeheimnis, TDDDG § 3) —
   * und kann es bei Ende-zu-Ende-Verschlüsselung auch nicht. Wer eine
   * Nachricht meldet, gibt deshalb selbst frei: den Klartext GENAU DIESER
   * einen Nachricht und ihren Sitzungsschlüssel. Mit beiden kann ein
   * Moderator prüfen, dass der gemeldete Text wirklich so verschickt wurde
   * (die Chiffre liegt auf dem Server) — ohne dass irgendeine andere
   * Nachricht des Chats lesbar wird: jede Nachricht hat ihren eigenen
   * Sitzungsschlüssel (siehe `verschluesseln`).
   *
   * NIE der Gerätschlüssel: mit dem ließe sich jedes Kuvert dieses Geräts
   * öffnen, also der ganze Chatverlauf.
   */

  /**
   * Den Beleg einer Nachricht bilden, die dieses Gerät öffnen kann.
   *
   * `nachricht` = { version, chiffre, nonce, absender }, `kuvert` = mein
   * Kuvert dieser Nachricht, `meinGeheim` = mein Gerätschlüssel (bleibt hier).
   * Gibt `{ text, sitzung }` zurück (sitzung = Base64 des 32-Byte-
   * Sitzungsschlüssels) oder null, wenn die Nachricht nicht aufgeht.
   */
  function meldebeleg(nachricht, kuvert, meinGeheim) {
    try {
      if (!nachricht || !kuvert || !meinGeheim) return null;
      if (Number(nachricht.version) !== VERSION) return null;
      var sitzung = nacl.box.open(
        ausBase64(kuvert.chiffre),
        ausBase64(kuvert.nonce),
        ausBase64(nachricht.absender),
        ausBase64(meinGeheim)
      );
      if (!sitzung) return null;
      var klar = nacl.secretbox.open(ausBase64(nachricht.chiffre), ausBase64(nachricht.nonce), sitzung);
      if (!klar) return null;
      return { text: ausBytes(klar), sitzung: zuBase64(sitzung) };
    } catch (e) {
      return null;
    }
  }

  /**
   * Stimmt ein Beleg? `verschlossen` = { chiffre, nonce } wie auf dem Server
   * gespeichert (messages.chiffre, messages.krypto_nonce), `sitzung` aus dem
   * Beleg, `text` der gemeldete Klartext.
   *
   * true nur, wenn die Chiffre mit genau diesem Schlüssel aufgeht UND genau
   * diesen Text ergibt. Alles andere — falscher Schlüssel, veränderter Text,
   * kaputte Eingabe — ist false, nie ein Wurf.
   */
  function belegPruefen(verschlossen, sitzung, text) {
    try {
      if (!verschlossen || !verschlossen.chiffre || !verschlossen.nonce || !sitzung) return false;
      var schluessel = ausBase64(sitzung);
      if (schluessel.length !== nacl.secretbox.keyLength) return false;
      var nonce = ausBase64(verschlossen.nonce);
      if (nonce.length !== nacl.secretbox.nonceLength) return false;
      var klar = nacl.secretbox.open(ausBase64(verschlossen.chiffre), nonce, schluessel);
      if (!klar) return false;
      return ausBytes(klar) === String(text == null ? '' : text);
    } catch (e) {
      return false;
    }
  }

  // ------------------------------------------------------ Absender prüfen --

  /**
   * Prüft, ob der Absenderschlüssel einer Nachricht zu ihrem Absender gehört
   * (Sicherheitsprüfung 16.10.2026, AR-04).
   *
   * WARUM
   *
   * `entschluesseln` öffnet das Kuvert mit `absender_schluessel` — und der
   * steht an der Nachricht selbst. Wer in die Datenbank schreiben kann, legt
   * sich ein eigenes Paar an, verschließt damit eine Nachricht „von A" und
   * setzt seinen eigenen öffentlichen Schlüssel als Absender: sie geht auf,
   * und B sieht sie ohne jeden Hinweis als echt. Prüfbar ist das nur gegen
   * die Schlüssel, die A tatsächlich angemeldet hat (`krypto_schluessel`).
   *
   * WIE
   *
   * `holen(paare)` bekommt `[{ userId, schluessel }]` und liefert die Paare,
   * die es in `krypto_schluessel` gibt, als `[{ user_id, oeffentlich }]` —
   * jede Seite auf ihrem Weg (App direkt, Website über ihren Server). Gefragt
   * wird gezielt nach diesen Paaren statt nach allen Schlüsseln der Konten:
   * die Prüfkonten haben über tausend, und PostgREST gibt nicht mehr heraus.
   *
   * Das Ergebnis wird gemerkt, denn der Chat sieht alle vier Sekunden nach
   * (Kasten 27). Auch bekannte Paare werden frühestens
   * nach `nachladenMs` noch einmal gefragt — ein gerade erst angemeldetes
   * Gerät soll nicht dauerhaft als „nicht prüfbar" stehen bleiben, und eine
   * gefälschte Nachricht soll nicht bei jedem Nachsehen eine Abfrage kosten.
   *
   * `pruefen(paare)` gibt je Paar `true` (bekannt), `false` (nicht bekannt —
   * die Blase zeigt „nicht prüfbar") oder `null` (Schlüssel gerade nicht
   * ladbar — die Blase warnt, der Text bleibt lesbar).
   */
  function absenderPruefer(holen, optionen) {
    var nachladenMs = (optionen && optionen.nachladenMs) || 60000;
    var gemerkt = {};

    function kennung(p) {
      return String(p.userId) + '|' + String(p.schluessel);
    }

    function pruefen(paare) {
      var liste = paare || [];
      var jetzt = Date.now();
      var fragen = [];
      var schon = {};
      liste.forEach(function (p) {
        if (!p || !p.userId || !p.schluessel) return;
        var k = kennung(p);
        var e = gemerkt[k];
        var faellig = !e || jetzt - e.zeit > nachladenMs;
        if (faellig && !schon[k]) {
          schon[k] = true;
          fragen.push({ userId: p.userId, schluessel: p.schluessel });
        }
      });

      var weg = fragen.length
        ? Promise.resolve()
            .then(function () {
              // Die API nimmt höchstens 200 Paare an; auch lange Verläufe
              // vollständig prüfen, ohne lange URL-Filter zu erzeugen.
              var ergebnis = [];
              return fragen.reduce(function (weg, _, i) {
                if (i % 100) return weg;
                return weg.then(function () { return holen(fragen.slice(i, i + 100)); })
                  .then(function (teil) {
                    if (!Array.isArray(teil)) throw new Error('Absenderliste nicht ladbar');
                    ergebnis = ergebnis.concat(teil);
                  });
              }, Promise.resolve()).then(function () { return ergebnis; });
            })
            .then(function (gefunden) {
              var da = {};
              (gefunden || []).forEach(function (g) {
                da[String(g.user_id) + '|' + String(g.oeffentlich)] = true;
              });
              fragen.forEach(function (p) {
                var k = kennung(p);
                gemerkt[k] = { bekannt: Boolean(da[k]), zeit: jetzt };
              });
            })
            .catch(function () {
              // Eine fällige, nicht ladbare Bestätigung liefert kein Vertrauen.
              fragen.forEach(function (p) { delete gemerkt[kennung(p)]; });
            })
        : Promise.resolve();

      return weg.then(function () {
        return liste.map(function (p) {
          if (!p || !p.userId || !p.schluessel) return null;
          var e = gemerkt[kennung(p)];
          return e ? e.bekannt : null;
        });
      });
    }

    return { pruefen: pruefen };
  }

  // ------------------------------------------------------------ Sendeweg --

  /**
   * Die Meldung, wenn eine Nachricht verschlüsselt hinausgehen müsste und es
   * gerade nicht kann. Wortgleich in App und Website, deshalb hier.
   */
  var MELDUNG_NICHT_VERSCHLUESSELT =
    'Die Nachricht ließ sich gerade nicht verschlüsseln und wurde nicht gesendet. ' +
    'Bitte versuch es noch einmal.';

  /**
   * Die Meldung, wenn ein Chat, der keine Gruppe ist, mehr als zwei
   * Mitglieder hat. Wortgleich in App und Website, deshalb hier.
   */
  var MELDUNG_NUR_ZU_ZWEIT =
    'Dieser Chat ist keine Gruppe, hat aber mehr als zwei Mitglieder. ' +
    'Damit niemand unbemerkt mitliest, wurde die Nachricht nicht gesendet.';

  /**
   * Hat ein Chat, der keine Gruppe ist, mehr als zwei Mitglieder?
   *
   * WARUM DAS EINE SPERRE IST (Sicherheitsprüfung 16.10.2026,
   * „Schlüssel-Unterschiebung" im Datenbankbericht)
   *
   * Verschlossen wird für alle Geräte aller Mitglieder. Wer sich in einen
   * fremden Zweierchat einträgt — Selbsteintrag in `chat_members`, oder ein
   * UPDATE auf `chat_id` —, bekäme so jede künftige Nachricht mit eigenem
   * Kuvert geliefert, ohne dass einer der beiden es merkt. Ein Zweierchat
   * mit drei Mitgliedern ist also kein Altbestand, mit dem man leben kann,
   * sondern genau das Bild eines Mitlesers. Nicht für ihn verschlüsseln,
   * sondern gar nicht senden — auch keinen Klartext, denn den läse er
   * ebenso.
   */
  function zuVieleMitglieder(fakten) {
    var f = fakten || {};
    return !f.istGruppe && (f.mitglieder || []).length > 2;
  }

  /**
   * Wie eine Nachricht in diesem Chat hinausgeht — verschlossen, offen oder
   * gar nicht (Sicherheitsprüfung 16.10.2026, AR-05).
   *
   * WARUM ES DAS GIBT
   *
   * Bis dahin fiel jede Nachricht still auf Klartext zurück, sobald
   * irgendetwas auf dem Weg zur Chiffre fehlte: der eigene Schlüssel ließ sich
   * nicht lesen, die Schlüsselabfrage scheiterte an einer kurzen Netzstörung,
   * oder ein Server antwortete einfach mit einer leeren Liste. Das
   * Kontaktprofil sagte weiter „Ende-zu-Ende", und keiner der beiden sah einen
   * Unterschied. Wer den Server beherrscht, brauchte für ein Downgrade nur
   * die Schlüsselliste leer zu lassen.
   *
   * DIE REGEL
   *
   * Ein Chat, der keine Gruppe ist und mehr als zwei Mitglieder hat, nimmt
   * gar nichts an (`zuVieleMitglieder`).
   *
   * Klartext nur dort, wo Verschlüsselung gar nicht vorgesehen ist: in einer
   * Gruppe, und in einem Chat zu zweit, dessen Gegenüber nie ein Gerät
   * angemeldet hat UND in dem noch nie verschlüsselt geschrieben wurde. Ist
   * eins von beidem anders, MUSS verschlossen werden — und geht das nicht,
   * wird abgelehnt statt still offen gesendet. Lieber eine Nachricht, die
   * nicht ankommt und das sagt, als eine, die ankommt und dabei etwas
   * Falsches behauptet.
   *
   * WARUM HIER UND NICHT JE SEITE
   *
   * Die App fragt Supabase selbst, die Website fragt ihren Server — die
   * Fakten kommen also auf zwei Wegen. Die Entscheidung darüber darf es aber
   * nur einmal geben, sonst verschlüsselt die eine Seite, wo die andere schon
   * Klartext schickt.
   *
   * `fakten`:
   *   istGruppe           — chats.is_group
   *   mitglieder          — alle user_id aus chat_members
   *   ichId               — das eigene Konto
   *   schluessel          — [{ id, user_id, oeffentlich }] der Mitglieder
   *   schonVerschluesselt — gibt es im Chat eine Nachricht mit krypto > 0?
   *   gemerkt             — hat dieses Gerät den Chat schon verschlüsselt erlebt?
   *   meiner              — { id, oeffentlich } des eigenen Geräts oder null
   *
   * Rückgabe:
   *   { art: 'offen' }
   *   { art: 'verschliessen', empfaenger: [{ id, oeffentlich }] }
   *   { art: 'ablehnen', meldung }
   */
  function sendeweg(fakten) {
    var f = fakten || {};
    if (f.istGruppe === true) return { art: 'offen' };
    if (f.istGruppe !== false || !Array.isArray(f.mitglieder) ||
        !Array.isArray(f.schluessel) || typeof f.schonVerschluesselt !== 'boolean' ||
        !f.ichId || f.mitglieder.indexOf(f.ichId) === -1 || f.mitglieder.length < 2) {
      return { art: 'ablehnen', meldung: MELDUNG_NICHT_VERSCHLUESSELT };
    }
    if (zuVieleMitglieder(f)) return { art: 'ablehnen', meldung: MELDUNG_NUR_ZU_ZWEIT };

    var mitglieder = f.mitglieder || [];
    var ich = f.ichId;

    // Nur Schlüssel von Mitgliedern. Liefert eine Abfrage mehr — falscher
    // Filter, fremder Server —, bekommt dieser Fremde trotzdem kein Kuvert.
    var schluessel = (f.schluessel || []).filter(function (s) {
      return s && s.id && s.oeffentlich && mitglieder.indexOf(s.user_id) !== -1;
    });
    var fremde = schluessel.filter(function (s) {
      return s.user_id !== ich;
    });

    var vorgesehen = fremde.length > 0 || Boolean(f.schonVerschluesselt) || Boolean(f.gemerkt);
    if (!vorgesehen) return { art: 'offen' };

    /*
     * Vorgesehen, aber nicht machbar: kein eigener Schlüssel (Schlüsselkette
     * nicht lesbar, Anmeldung beim Server gescheitert) oder kein Gerät des
     * Gegenübers in der Antwort, obwohl der Chat schon verschlüsselt war.
     * Genau hier fiel es bis zum 16.10.2026 still auf Klartext.
     */
    if (!f.meiner || !f.meiner.id || !f.meiner.oeffentlich || !fremde.length) {
      return { art: 'ablehnen', meldung: MELDUNG_NICHT_VERSCHLUESSELT };
    }

    var empfaenger = [];
    var schon = {};
    function dazu(s) {
      if (schon[s.id]) return;
      schon[s.id] = true;
      empfaenger.push({ id: s.id, oeffentlich: s.oeffentlich });
    }
    schluessel.forEach(dazu);
    /*
     * Das eigene Gerät gehört immer dazu. Die Abfrage gibt höchstens 1000
     * Schlüssel heraus (PostgREST); bei einem Konto mit sehr vielen Geräten
     * fiel das eigene sonst hinten herunter, und man konnte die eigene
     * Nachricht nicht mehr lesen.
     */
    dazu({ id: f.meiner.id, oeffentlich: f.meiner.oeffentlich });

    return { art: 'verschliessen', empfaenger: empfaenger };
  }

  return {
    VERSION: VERSION,
    MELDUNG_NICHT_VERSCHLUESSELT: MELDUNG_NICHT_VERSCHLUESSELT,
    MELDUNG_NUR_ZU_ZWEIT: MELDUNG_NUR_ZU_ZWEIT,
    zuVieleMitglieder: zuVieleMitglieder,
    sendeweg: sendeweg,
    absenderPruefer: absenderPruefer,
    zufallsquelleSetzen: zufallsquelleSetzen,
    zufallBereit: zufallBereit,
    schluesselpaarErzeugen: schluesselpaarErzeugen,
    fingerabdruck: fingerabdruck,
    sicherheitsnummer: sicherheitsnummer,
    verschluesseln: verschluesseln,
    entschluesseln: entschluesseln,
    umschliessen: umschliessen,
    meldebeleg: meldebeleg,
    belegPruefen: belegPruefen,
    zuBase64: zuBase64,
    ausBase64: ausBase64,
  };
});
