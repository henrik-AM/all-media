/**
 * Übersetzten App-Code zu EINER Datei ohne Importe zusammenlegen.
 *
 * WARUM ES DAS GIBT
 *
 * Drei Prüfläufe (_aktionen, _handbuch, _gleichstand) führen echten App-Code
 * im Browser aus: `aktionen.ts` bzw. `daten.ts` werden mit tsc übersetzt und
 * als `blob:`-Modul in die Seite geladen. Das ging nur, solange diese Dateien
 * ausschließlich Typen importierten — Typen verschwinden beim Übersetzen, und
 * übrig blieb eine Datei ohne jeden Import. Genau so stand es auch als
 * Annahme in _gleichstand.js.
 *
 * Mit der Sicherheitsprüfung vom 04.09.2026 stimmt das nicht mehr: beide
 * Dateien importieren jetzt `signiereMedien` aus `./medien` — einen echten
 * Wert, keinen Typ. Ein `blob:`-Modul hat keine Herkunft, an der ein
 * relativer Pfad hängen könnte, und der Browser meldet
 * „Failed to resolve module specifier './medien'".
 *
 * Hier wird deshalb aus zwei übersetzten Dateien eine gemacht: die Exporte
 * des Hilfsmoduls werden zu gewöhnlichen Deklarationen, die Importzeile im
 * Hauptteil fällt weg. Kein Bündler nötig, und die Annahme „eine Datei ohne
 * Importe" gilt wieder.
 */

const fs = require('fs');
const path = require('path');

/** Eine bestimmte übersetzte Datei im Bauordner finden. */
function finde(ordner, name) {
  for (const eintrag of fs.readdirSync(ordner, { withFileTypes: true })) {
    const voll = path.join(ordner, eintrag.name);
    if (eintrag.isDirectory()) {
      const treffer = finde(voll, name);
      if (treffer) return treffer;
    } else if (eintrag.name === name) {
      return voll;
    }
  }
  return null;
}

/**
 * Die gemeinsamen Spaltenlisten als Deklarationen ohne `module.exports`.
 *
 * `gemeinsam/spalten.js` benutzen App und Website zusammen. Die Datei ist
 * CommonJS, damit der Node-Server sie ohne Uebersetzungsschritt laden kann —
 * im blob:-Modul des Browsers gibt es aber weder `module` noch einen Pfad,
 * an dem `../../gemeinsam/spalten` haengen koennte. Uebrig bleiben soll nur
 * das, was die Datei ohnehin ist: ein paar `const`-Zeilen.
 *
 * Ohne das schlagen _gleichstand und _aktionen mit
 * „Failed to resolve module specifier" fehl — und zwar mitten im Lauf, nach
 * ein paar bestandenen Pruefungen. Genau so ist es beim Zusammenlegen der
 * Spaltenlisten passiert.
 */
function gemeinsameSpalten() {
  const datei = path.join(__dirname, '..', '..', 'gemeinsam', 'spalten.js');
  if (!fs.existsSync(datei)) return '';
  return fs
    .readFileSync(datei, 'utf8')
    // Der Exportblock am Ende faellt weg, die Deklarationen bleiben stehen.
    .replace(/module\.exports\s*=\s*\{[\s\S]*?\};?\s*$/m, '');
}

/**
 * Die uebrigen gemeinsamen Bausteine aus `gemeinsam/` beilegen.
 *
 * `telefon.js` und `passwort.js` sind — wie `krypto.js` — UMD: unter Node
 * setzen sie `module.exports`, im Browser `globalThis.<Name>`. Im blob:-Modul
 * gibt es kein `module`, also greift von selbst der Browser-Zweig; nur der
 * `require(...)`-Aufruf im uebersetzten App-Code muss noch auf das Ergebnis
 * zeigen.
 *
 * Nachgetragen am 07.09.2026, nachdem `aktionen.ts` und `personSuche.ts` die
 * Telefonregel aus `gemeinsam/telefon.js` holten. Drei Laeufe (_aktionen,
 * _handbuch, _kanal) kippten daraufhin mit „require is not defined" — und
 * zwar mitten im Lauf, nach ein paar bestandenen Pruefungen. Wer hier einen
 * neuen gemeinsamen Baustein einfuehrt, muss ihn in diese Liste eintragen.
 */
const UMD_BAUSTEINE = [
  ['telefon', 'Telefon'],
  ['passwort', 'Passwort'],
  // 21.09.2026: `kommentar.js` kam fuer „Meine Kommentare" dazu — und genau
  // dieselben drei Laeufe kippten wieder. Der Hinweis oben stand da, der
  // Eintrag fehlte trotzdem.
  ['kommentar', 'Kommentar'],
  // 21.09.2026: `rang.js` kam mit dem Feed-Algorithmus dazu (Schema 51).
  // Diesmal gleich mit dem Baustein eingetragen statt hinterher.
  ['rang', 'Rang'],
  // 22.09.2026: Benutzername und Geburtsdatum bei der Anmeldung (Schema 52).
  // `alter.js` liest global.Telefon — muss also nach `telefon` stehen.
  ['benutzername', 'Benutzername'],
  ['alter', 'Alter'],

  // 26.09.2026: `teilen.js` für das Teilen-Blatt (Feedback 21.09., Kasten 4).

  ['teilen', 'Teilen'],
  // 28.09.2026: `verlauf.js` für „Mein Verlauf" (Feedback 21.09., Kasten 10).
  ['verlauf', 'Verlauf'],
  // 29.09.2026: `story.js` — eine Story-Regel für Ring, Leiste und Bearbeitung
  // (Feedback 21.09., Kasten 11).
  ['story', 'StoryRegeln'],

  // 28.09.2026: `liedtext.js` fuer die gesungene Zeile auf der Sound-Seite
  // (Feedback 21.09., Kasten 7, Schema 63).
  ['liedtext', 'Liedtext'],
  // 28.09.2026: `naehe.js` fuer die Ortsliste in der Kartenansicht eines
  // Standorts (Feedback 21.09., Kasten 7.1).
  ['naehe', 'Naehe'],
  // 29.09.2026: `soundstellen.js` fuer Wellenform und meist verwendete
  // Stellen auf der Sound-Seite (Feedback 21.09., Kasten 7.5, Schema 67).
  ['soundstellen', 'SoundStellen'],
  // 29.09.2026: `sammlungen.js` fuer Ringfarben und Titelbild von Playlists
  // und Highlights (Feedback 21.09., Kasten 12.7-12.9).
  ['sammlungen', 'Sammlungen'],
  // 29.09.2026: `spende.js` fuer das Spendenziel im Profil (Kasten 12.3).
  ['spende', 'Spende'],
  // 29.09.2026: `zahlung.js` fuer Spendencode und Zahlungsmethoden
  // (Feedback 21.09., Kasten 13.2/13.3, Schema 72).
  ['zahlung', 'Zahlung'],
  // 01.10.2026: `sichtbarkeit.js` fuer Stufennamen und die Stufe
  // „Nur Follower" bei den Likes (Feedback, Kasten 19, Schema 76).
  ['sichtbarkeit', 'Sichtbarkeit'],
  // 06.10.2026: `chatabgleich.js` — Takt, Stand und Zusammenlegen offener
  // Chats und der Chatliste (Kasten 27, verfaelschte Chats).
  ['chatabgleich', 'ChatAbgleich'],
  // 06.10.2026: `lenkung.js` fuer „Feed steuern" (Kasten 24, Schema 82) —
  // daten.ts und lib/lenkung.ts holen ihn. Gleich mit dem Baustein eingetragen.
  ['lenkung', 'Lenkung'],
  // 06.10.2026: `farbfilter.js` fuer Einstellungen → Farbfilter (Kasten 21).
  // Heute nur von Komponenten gebraucht, nicht von aktionen.ts/daten.ts —
  // eingetragen, damit es nicht wieder erst beim ersten Kippen auffaellt.
  ['farbfilter', 'Farbfilter'],
  // 06.10.2026: `bildschirmzeit.js` fuer die eigene Bildschirmzeit —
  // Bereiche, Sperre, Restzeit, Uhr (Kasten 22).
  ['bildschirmzeit', 'Bildschirmzeit'],
  // 08.10.2026: `markierung.js` fuer @-Markierungen (Kasten 25) — aktionen.ts,
  // MarkierungsEingabe und MarkierterText holen ihn. Gleich mit eingetragen.
  ['markierung', 'Markierung'],
  // 22.10.2026: `konto-loeschen.js` — echtes Konto löschen (Auftrag Recht/
  // Sicherheit, Kasten RS 2, Schema 103). Einstellungen in App und Website.
  ['konto-loeschen', 'KontoLoeschen'],
  // 22.10.2026: `rechtstexte.js` — Nutzungsbedingungen, Datenschutz, Impressum
  // (Kasten RS 1). Liest global.Alter — muss nach `alter` stehen.
  ['rechtstexte', 'Rechtstexte'],

  // 25.10.2026: `meldung.js` — Melden nach DSA Art. 16 (Kasten RS 3, Schema 102).
  // aktionen.ts, MeldenSheet und die Website holen ihn.
  ['meldung', 'Meldung'],

  // 31.10.2026: `einwilligung.js` — Zustimmung mit Fassung und Eltern-Widerruf
  // (Kasten RS 7/5, Schema 106). Liest global.Rechtstexte — muss danach stehen.
  ['einwilligung', 'Einwilligung'],

  // 05.11.2026: `medienadresse.js` — Medienadressen nur vom eigenen Host
  // (Codex-Review, Schema 118). medien.ts und damit jeder Lauf mit
  // signiereMedien holt ihn. Gleich mit dem Baustein eingetragen.
  ['medienadresse', 'MedienAdresse'],
  // 10.10.2026: `profilfelder.js` fuer die Seite „Profil bearbeiten“ (Kasten
  // 1.3, Nachtrag) — aktionen.ts und daten.ts holen ihn. Gleich mit eingetragen.
  ['profilfelder', 'Profilfelder'],
  // 10.10.2026: `chatblase.js` fuer Ziehen zum Antworten und die Karte eines
  // geteilten Beitrags (Feedback 28.09., Kasten 4 und 7) — daten.ts holt ihn.
  ['chatblase', 'Chatblase'],
  // 10.10.2026: `ortsuche.js` fuer „Standort senden" mit Suche und Karte
  // (Feedback 28.09., Kasten 6.5). AnhangSheet und ChatDetailScreen holen ihn.
  ['ortsuche', 'OrtSuche'],
  // 10.10.2026: `anruf.js` fuer den Anrufeintrag im Chat (Feedback 28.09.,
  // Kasten 5, Schema 89) — ChatDetailScreen und CallScreen holen ihn.
  ['anruf', 'Anruf'],
  // 10.10.2026: `ptt.js` fuer die Zeile „Push to Talk" und den Verlauf
  // dahinter (Kasten 8.5/8.6, Schema 90).
  ['ptt', 'Ptt'],
  // 11.10.2026: `kontaktbild.js` — eigenes Kontaktbild und Anzeigename im
  // Messenger (Kasten 28/7.8, Schema 94). Avatar.tsx und daten.ts holen ihn.
  ['kontaktbild', 'Kontaktbild'],
  // 12.10.2026: `gruppe.js` — Gruppeninfo mit Mitgliederliste (Kasten 28/7.9,
  // 7.10). GroupSettingsScreen holt ihn.
  ['gruppe', 'Gruppe'],
