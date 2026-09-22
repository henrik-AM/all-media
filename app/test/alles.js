#!/usr/bin/env node
/**
 * Alle Prüfläufe — und zwar alle.
 *
 * WARUM ES DAS GIBT
 *
 * "test:alles" war bis zum 01.09.2026 eine Kette aus zwanzig npm-Aufrufen
 * mit && dazwischen. Zwei Dinge waren daran falsch:
 *
 *   1. Bricht ein Lauf ab, laufen die folgenden gar nicht. Am 01.09.2026
 *      scheiterte "teilen" an einer zu kurz bemessenen Wartezeit — und die
 *      vierzehn Prüfläufe danach wurden nie ausgeführt. Auf dem Bildschirm
 *      stand ein einzelner Fehler; in Wahrheit war der halbe Bestand
 *      ungeprüft.
 *
 *   2. Zwei Läufe standen gar nicht in der Kette: test:datenbank und der
 *      neue test:aktionen. Sie waren da, sie liefen nur nie.
 *
 * Dieses Skript führt jeden Lauf zu Ende, egal wie die vorherigen ausgingen,
 * und stellt am Schluss nebeneinander, was durchkam und was nicht — mit
 * Zahlen. Siehe dazu die Regel "grüne Tests beweisen nichts": entscheidend
 * ist nicht, dass kein Fehler kommt, sondern wie viele Prüfungen tatsächlich
 * gelaufen sind.
 *
 * Start:  npm run test:alles   (Server muss laufen)
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/*
 * ZWEI WÄCHTER, DIE ES BIS ZUM 07.09.2026 NICHT GAB
 *
 * Am 06.09.2026 wurden vier Gesamtläufe hintereinander verworfen, und keiner
 * davon scheiterte am Code. Zwei Claude-Sitzungen arbeiteten im selben Ordner
 * gegen denselben Testbestand: der eine Lauf räumte mit zuruecksetzen() ab,
 * was der andere gerade brauchte, und mitten im Lauf änderte sich zusätzlich
 * eine Prüfdatei. Herausgekommen sind Zahlen, die nach Fehlern im Code
 * aussahen — sieben rote Läufe, die einzeln alle grün durchliefen.
 *
 * Das Teure daran war nicht der Fehlschlag, sondern dass er nicht als solcher
 * zu erkennen war. Deshalb prüft dieser Lauf jetzt selbst nach:
 *
 *   1. SPERRE — läuft schon ein Gesamtlauf, bricht dieser sofort ab, statt
 *      ihm den Bestand unter den Füßen wegzuziehen.
 *   2. PRÜFSUMME — ändert sich während des Laufs eine Datei, an der er misst,
 *      sagt die Übersicht das und der Lauf endet mit Fehlercode. Eine Zahl,
 *      die auf wechselndem Grund entstanden ist, ist keine Messung.
 */

const SPERRE = path.join(__dirname, '.gesamtlauf-laeuft.json');

/** Läuft der Prozess mit dieser Kennung noch? */
function lebt(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (fehler) {
    return fehler.code === 'EPERM';
  }
}

function sperreSetzen() {
  if (fs.existsSync(SPERRE)) {
    let alt = null;
    try {
      alt = JSON.parse(fs.readFileSync(SPERRE, 'utf8'));
    } catch {
      alt = null;
    }
    if (alt && lebt(alt.pid)) {
      console.error(
        `\n  ABBRUCH — es läuft bereits ein Gesamtlauf (PID ${alt.pid}, seit ${alt.seit}).\n` +
          '  Beide würden denselben Testbestand zurücksetzen; die Zahlen beider Läufe\n' +
          '  wären wertlos. Diesen Lauf abwarten oder die Sitzung fragen, die ihn führt.\n'
      );
      process.exit(2);
    }
    console.log('  Hinweis: eine verwaiste Sperre lag noch da — sie wird ersetzt.');
  }
  fs.writeFileSync(SPERRE, JSON.stringify({ pid: process.pid, seit: new Date().toISOString() }));
  const weg = () => fs.rmSync(SPERRE, { force: true });
  process.on('exit', weg);
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      weg();
      process.exit(1);
    });
  }
}

/*
 * Ein Fingerabdruck über alles, woran dieser Lauf misst: die Prüfdateien
 * selbst, der Code der App und der der Website. Ändert sich davon etwas,
 * während gemessen wird, misst man zwei verschiedene Stände.
 */
const BEOBACHTET = [
  path.join(__dirname),
  path.join(__dirname, '..', 'lib'),
  path.join(__dirname, '..', 'tools', 'pruefgeraet.js'),
  path.join(__dirname, '..', '..', 'gemeinsam'),
  path.join(__dirname, '..', '..', 'web', 'server'),
  path.join(__dirname, '..', '..', 'web', 'public'),
];

function stempel() {
  const hash = crypto.createHash('sha256');
  const dateien = [];

  const sammle = (ort) => {
    if (!fs.existsSync(ort)) return;
    const eintrag = fs.statSync(ort);
    if (eintrag.isFile()) return dateien.push(ort);
    for (const kind of fs.readdirSync(ort, { withFileTypes: true })) {
      if (kind.name === 'node_modules' || kind.name.startsWith('.')) continue;
      sammle(path.join(ort, kind.name));
    }
  };

  for (const ort of BEOBACHTET) sammle(ort);

  for (const datei of dateien.sort()) {
    hash.update(datei);
    hash.update(fs.readFileSync(datei));
  }
  return hash.digest('hex');
}

sperreSetzen();
const stempelVorher = stempel();

const LAEUFE = [
  ['smoke', 'smoke.js'],
  ['feedback', '_feedback.js'],
  ['erstellen', '_erstellen.js'],
  ['teilen', '_teilen.js'],
  ['sync', '_sync.js'],
  // Henriks Frage vom 21.09.2026: "wenn ich etwas like und am naechsten
  // Morgen mich wieder anmelde, sehe ich diesen Like noch?" Meldet sich
  // ausdruecklich ab und neu an — ein Neuladen allein behaelt die Sitzung
  // und beweist nichts.
  ['uebernacht', '_uebernacht.js'],
  // Braucht keinen Server — prueft die Schemadateien gegen den Code.
  ['schema', '_schema.js'],
  // Braucht ebenfalls keinen Server: spricht direkt mit PostgREST.
  ['sammlungen', '_sammlungen.js'],
  ['sammlungenweb', '_sammlungenweb.js'],
  ['explorer', '_explorer.js'],
  ['anhang', '_anhang.js'],
  ['einstellungen', '_einstellungen.js'],
  ['kontaktinfo', '_kontaktinfo.js'],
  ['henrik', '_henrik.js'],
  ['henrik2', '_henrik2.js'],
  ['insel', '_insel.js'],
  ['suche', '_suche.js'],
  ['profil', '_profil.js'],
  ['community', '_community.js'],
  ['chatoptionen', '_chatoptionen.js'],
  ['player', '_player.js'],
  ['gesten', '_gesten.js'],
  ['feinschliff', '_feinschliff.js'],
  ['kamera', '_kamera.js'],
  ['eigenes', '_eigenes.js'],
  ['datenbank', '_datenbank.js'],
  ['aktionen', '_aktionen.js'],
  ['gleichstand', '_gleichstand.js'],
  ['handbuch', '_handbuch.js'],
  ['sichtbarkeit', '_sichtbarkeit.js'],
  ['fremdprofil', '_fremdprofil.js'],
  ['chatanfrage', '_chatanfrage.js'],
  ['mitteilungen', '_mitteilungen.js'],
  ['dmsperre', '_dmsperre.js'],
  ['lesebestaetigung', '_lesebestaetigung.js'],
  ['kanal', '_kanal.js'],
  ['impressionen', '_impressionen.js'],
  // Direkt hinter den Impressionen: das eine misst, ob mitgeschrieben wird,
  // das andere, ob aus dem Mitgeschriebenen eine Reihenfolge wird.
  ['rang', '_rang.js'],
  ['storyvideos', '_storyvideos.js'],
  ['krypto', '_krypto.js'],
  ['rechte', '_rechte.js'],
  // Geburtsdatum und Zustimmung der Eltern (Schema 52); braucht SUPABASE_TOKEN wie rechte.
  ['minderjaehrig', '_minderjaehrig.js'],
  ['bremse', '_bremse.js'],
  ['auth', '_auth.js'],
];

/** Aus der Ausgabe herauslesen, wie viele Prüfungen liefen. */
function zaehlen(ausgabe) {
  const summe = ausgabe.match(/(\d+)\s+von\s+(\d+)\s+Pruefungen bestanden/);
  if (summe) return { gut: Number(summe[1]), gesamt: Number(summe[2]) };

  // Läufe, die Zeile für Zeile melden statt am Schluss zu summieren.
  const gut = (ausgabe.match(/^\s*(OK|PASS)\b/gm) || []).length;
  const schlecht = (ausgabe.match(/^\s*(FEHL|FAIL)\b/gm) || []).length;
  return gut + schlecht > 0 ? { gut, gesamt: gut + schlecht } : null;
}

/*
 * Zeitgrenze je Lauf. Der laengste ehrliche Lauf (erstellen) braucht rund
 * acht Minuten; 15 Minuten lassen also reichlich Luft und fangen trotzdem
 * jeden echten Haenger ab.
 */
const ZEITGRENZE = 15 * 60 * 1000;

const ergebnisse = [];

for (const [name, datei] of LAEUFE) {
  console.log(`\n${'='.repeat(70)}\n  ${name}\n${'='.repeat(70)}`);

  /*
   * Die Ausgabe geht in eine Datei, nicht in eine Pipe.
   *
   * Der Grund ist unangenehm: `spawnSync` wartet nicht auf das Ende des
   * Prozesses, sondern auf das Ende seiner Pipes. Steigt ein Pruefskript
   * frueh mit `process.exit(1)` aus, ohne den Browser zu schliessen, laeuft
   * das `chrome-headless-shell` weiter und haelt die geerbte Pipe offen —
   * und `alles.js` wartet ewig auf ein Ende, das nie kommt. Genau so hat der
   * Lauf am 09.09.2026 eine Stunde lang stillgestanden. Mit einer Datei als
   * Ziel zaehlt nur noch, wann der Prozess selbst endet.
   */
  const protokoll = path.join(__dirname, `.lauf-${name}.log`);
  const ziel = fs.openSync(protokoll, 'w');
  let lauf;
  try {
    lauf = spawnSync(process.execPath, [path.join(__dirname, datei)], {
      env: process.env,
      stdio: ['ignore', ziel, ziel],
      timeout: ZEITGRENZE,
      killSignal: 'SIGKILL',
    });
  } finally {
    fs.closeSync(ziel);
  }

  const ausgabe = fs.readFileSync(protokoll, 'utf8');
  fs.unlinkSync(protokoll);
  process.stdout.write(ausgabe);

  /*
   * Am 09.09.2026 hing ein einzelner Lauf ueber eine Stunde in einem
   * `waitUntil: 'load'`. Ohne Zeitgrenze blockiert so einer den
   * gesamten Durchlauf, und am Ende steht ueberhaupt keine Zahl da. Lieber
   * einen Lauf als abgebrochen melden als gar kein Ergebnis.
   */
  const abgebrochen = lauf.error && lauf.error.code === 'ETIMEDOUT';
  if (abgebrochen) {
    console.log(
      `\n  ABBRUCH — ${name} lief laenger als ${Math.round(ZEITGRENZE / 60000)} Minuten ` +
        'und wurde beendet. Die Zahlen unten sind unvollstaendig.'
    );
  }

  ergebnisse.push({
    name,
    code: abgebrochen ? 'zeit' : lauf.status,
    zahlen: zaehlen(ausgabe),
  });
}

console.log(`\n${'='.repeat(70)}\n  Übersicht\n${'='.repeat(70)}`);

let gesamtGut = 0;
let gesamtAlle = 0;

for (const e of ergebnisse) {
  const zahl = e.zahlen ? `${e.zahlen.gut}/${e.zahlen.gesamt}` : '—';
  if (e.zahlen) {
    gesamtGut += e.zahlen.gut;
    gesamtAlle += e.zahlen.gesamt;
  }
  const zeichen = e.code === 0 ? 'OK  ' : e.code === 'zeit' ? 'ZEIT' : 'FEHL';
  console.log(`  ${zeichen}  ${e.name.padEnd(16)} ${zahl.padStart(9)}`);
}

const gescheitert = ergebnisse.filter((e) => e.code !== 0);
const ohneZahlen = ergebnisse.filter((e) => !e.zahlen);

console.log(`\n  ${gesamtGut} von ${gesamtAlle} Prüfungen bestanden, ${ergebnisse.length} Läufe.`);
if (ohneZahlen.length) {
  console.log(`  Ohne zählbare Prüfungen: ${ohneZahlen.map((e) => e.name).join(', ')}`);
}
if (gescheitert.length) {
  console.log(`  Nicht durchgekommen: ${gescheitert.map((e) => e.name).join(', ')}`);
}

const verwackelt = stempel() !== stempelVorher;
if (verwackelt) {
  console.log(
    '\n  ACHTUNG — während des Laufs hat sich Code oder eine Prüfdatei geändert.\n' +
      '  Die Zahlen oben stammen damit aus zwei verschiedenen Ständen und sagen nichts.\n' +
      '  Lauf wiederholen, sobald niemand sonst in diesem Ordner arbeitet.'
  );
}

require('./_aufraeumen').aufraeumen().finally(() => {
  process.exit(gescheitert.length || verwackelt ? 1 : 0);
});
