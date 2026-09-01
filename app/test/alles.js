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

const LAEUFE = [
  ['smoke', 'smoke.js'],
  ['feedback', '_feedback.js'],
  ['erstellen', '_erstellen.js'],
  ['teilen', '_teilen.js'],
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

const ergebnisse = [];

for (const [name, datei] of LAEUFE) {
  console.log(`\n${'='.repeat(70)}\n  ${name}\n${'='.repeat(70)}`);

  const lauf = spawnSync(process.execPath, [path.join(__dirname, datei)], {
    encoding: 'utf8',
    env: process.env,
  });

  const ausgabe = (lauf.stdout || '') + (lauf.stderr || '');
  process.stdout.write(ausgabe);

  ergebnisse.push({ name, code: lauf.status, zahlen: zaehlen(ausgabe) });
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
  const zeichen = e.code === 0 ? 'OK  ' : 'FEHL';
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

process.exit(gescheitert.length ? 1 : 0);
