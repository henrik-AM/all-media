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

const { laufProzess } = require('./_lauf_prozess');
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
    if (!alt || !Number.isSafeInteger(alt.pid) || alt.pid < 1) {
      throw new Error('Gesamtlaufsperre ist unlesbar; nicht automatisch übernehmen.');
    }
    if (lebt(alt.pid)) {
      console.error(
        `\n  ABBRUCH — es läuft bereits ein Gesamtlauf (PID ${alt.pid}, seit ${alt.seit}).\n` +
          '  Beide würden denselben Testbestand zurücksetzen; die Zahlen beider Läufe\n' +
          '  wären wertlos. Diesen Lauf abwarten oder die Sitzung fragen, die ihn führt.\n'
      );
      process.exit(2);
    }
    console.log('  Hinweis: eine verwaiste Sperre lag noch da — sie wird ersetzt.');
    fs.unlinkSync(SPERRE);
  }
  fs.writeFileSync(SPERRE, JSON.stringify({ pid: process.pid, seit: new Date().toISOString() }), { flag: 'wx' });
  const weg = () => {
    try {
      const jetzt = JSON.parse(fs.readFileSync(SPERRE, 'utf8'));
      if (jetzt.pid === process.pid) fs.unlinkSync(SPERRE);
    } catch (e) { if (e.code !== 'ENOENT') console.error('Sperre nicht entfernt:', e.message); }
  };
  process.on('exit', weg);
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

function stempel(pfade = BEOBACHTET) {
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

  for (const ort of pfade) sammle(ort);

  for (const datei of dateien.sort()) {
    hash.update(datei);
    hash.update(fs.readFileSync(datei));
  }
  return hash.digest('hex');
}


const LAEUFE = [
  ['testhygiene', '_testhygiene_offline.js'],
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
  // Drei-Punkte-Menue und "Kein Interesse" (Henrik, 21.09.2026).
  ['optionen', '_optionen.js'],
  // Kasten 8: kein Tonknopf, Ort/Sound im Querformat antippbar.
  ['kasten8', '_kasten8.js'],
  // Kasten 12: Video-Profil. Braucht keinen Server — gemeinsame Regeln
  // nachrechnen und den Einbau auf beiden Seiten im Quelltext pruefen.
  ['kasten12', '_kasten12.js'],
  // Kasten 17: Playlists als Ordner, Highlights im Story-Betrachter,
  // selbst einordnen. Ebenfalls ohne Server (Quelltext + gemeinsame Regeln).
  ['kasten17', '_kasten17.js'],
  ['glocke', '_glocke.js'],
  // Jede Ueberschrift mit Pfeil fuehrt auf die volle Uebersicht (Kasten 2).
  ['pfeile', '_pfeile.js'],
  ['profil', '_profil.js'],
  ['community', '_community.js'],
  ['chatoptionen', '_chatoptionen.js'],
  ['player', '_player.js'],
  ['gesten', '_gesten.js'],
  ['kommentare', '_kommentare.js'],
  ['querformat', '_querformat.js'],
  ['feinschliff', '_feinschliff.js'],
  ['kamera', '_kamera.js'],
  ['eigenes', '_eigenes.js'],
  ['datenbank', '_datenbank.js'],
  ['aktionen', '_aktionen.js'],
  ['gleichstand', '_gleichstand.js'],
  ['handbuch', '_handbuch.js'],
  ['sichtbarkeit', '_sichtbarkeit.js'],
  ['likes', '_likes_sichtbarkeit.js'],
  ['fremdprofil', '_fremdprofil.js'],
  ['chatanfrage', '_chatanfrage.js'],
  ['messengeranfrage', '_messengeranfrage.js'],
  ['mitteilungen', '_mitteilungen.js'],
  ['dmsperre', '_dmsperre.js'],
  ['lesebestaetigung', '_lesebestaetigung.js'],
  ['kanal', '_kanal.js'],
  ['impressionen', '_impressionen.js'],
  // Direkt hinter den Impressionen: das eine misst, ob mitgeschrieben wird,
  // das andere, ob aus dem Mitgeschriebenen eine Reihenfolge wird.
  ['rang', '_rang.js'],
  // „Mein Verlauf" (Kasten 10): die fünf Aktionen im Verlauf, Schema 66.
  // Braucht keinen Server — spricht direkt mit PostgREST, ohne /api/reset.
  ['verlauf', '_verlauf.js'],
  ['storyvideos', '_storyvideos.js'],
  ['storys', '_storys.js'],
  ['krypto', '_krypto.js'],
  ['rechte', '_rechte.js'],
  // Geburtsdatum und Zustimmung der Eltern (Schema 52); braucht SUPABASE_TOKEN wie rechte.
  ['minderjaehrig', '_minderjaehrig.js'],
  // Dasselbe auf der Website: der Elternteil kommt über die Nummer (Schema 58).
  ['elternnummer', '_eltern_nummer.js'],
  ['bremse', '_bremse.js'],
  ['auth', '_auth.js'],
  ['zahlung', '_zahlung.js'],
  // Kasten 20: Stummschalter und stumme Konten — nur Quelltext, ohne Netz.
  ['stumm', '_stumm.js'],
  // Kasten 15: Regeln für Video-Storys (Länge, Größe, Format) — ohne Netz.
  ['storyvideoregeln', '_storyvideo_regeln.js'],
  // Kasten 16/19: Markierungs-Karte und „Nur Follower“ — Quelltext, ohne Netz.
  ['kasten16-19', '_kasten16_19.js'],
  // Kästen 21–27 (06.10.2026): Farbfilter, Bildschirmzeit, Personenvorschläge,
  // Feed steuern, @-Markierungen, Likes-Sichtbarkeit, Chat-Abgleich.
  ['farbfilterrechnung', '_farbfilter_rechnung.js'],
  ['farbfilter', '_farbfilter.js'],
  ['bildschirmzeit-einheit', '_bildschirmzeit_einheit.js'],
  ['recht', '_rechtstexte_einheit.js'],
  ['bildschirmzeit', '_bildschirmzeit.js'],
  ['vorschlaege', '_vorschlaege.js'],
  ['lenkung-einheit', '_lenkung_einheit.js'],
  ['lenken', '_lenken.js'],
  ['markierung-einheit', '_markierung_einheit.js'],
  ['markieren', '_markieren.js'],
  ['chatsync', '_chatsync.js'],
  // Kasten RS 3 (25.10.2026): Melden offline. Der Bildlauf test/rs3-melden.js
  // braucht einen eigenen Server mit Attrappe (Port 3201) und läuft für sich.
  ['melden-einheit', '_melden_einheit.js'],
  // Kasten RS 7/5 (31.10.2026): Zustimmung mit Fassung und Eltern-Widerruf offline.
  // Der Bildlauf test/rs7-einwilligung.js braucht einen Server (wie rs3-melden).
  ['einwilligung-einheit', '_einwilligung_einheit.js'],
  // Kasten 28 (Feedback 28.09.), eingehängt mit Paket 5 am 09.11.2026.
  // Ohne Supabase: Attrappe bzw. isolierte Renderer.
  ['k28-communitys', 'k28-communitys.js'],
  ['k28-kopf-offline', 'k28-kopf-offline.js'],
  ['k28-filter-offline', 'k28-filter-offline.js'],
  ['k28-doppeltippen', 'k28-doppeltippen.js'],
  ['k28-erstellen', 'k28-erstellen.js'],
  ['k28-mitglieder', 'k28-mitglieder.js'],
  // Mit Supabase (zwei Testkonten, eigene Prüfcommunity, räumt selbst auf).
  ['k28-commbild', 'k28-commbild.js'],
  ['k28-gruppe', 'k28-gruppe.js'],
  ['k28-karte', 'k28-karte.js'],
];

/** Aus der Ausgabe herauslesen, wie viele Prüfungen liefen. */
function zaehlen(ausgabe) {
  const summe = ausgabe.match(/(\d+)\s+von\s+(\d+)\s+Pr(?:ue|ü)fungen bestanden/);
  if (summe) return { gut: Number(summe[1]), gesamt: Number(summe[2]) };

  const nodeAlle = ausgabe.match(/^(?:ℹ|#) tests (\d+)\s*$/m);
  const nodeGut = ausgabe.match(/^(?:ℹ|#) pass (\d+)\s*$/m);
  if (nodeAlle && nodeGut) return { gut: Number(nodeGut[1]), gesamt: Number(nodeAlle[1]) };

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

async function haupt() {
  require('./_ki_belegung').pruefeBelegung('testbestand');
  require('./_pruefserver').pruefeServer();
  sperreSetzen();
  const { frage, umgebung } = require('./_aufraeumen');
  const { token, projekt } = umgebung();
  if (!token || !projekt) throw new Error('ABBRUCH: SUPABASE_TOKEN/Projekt fehlen; Bereinigung wäre unmöglich.');
  const mitteilungen = require('./_lauf_mitteilungen').laufMitteilungen({
    datei: path.join(__dirname, '.gesamtlauf-bereinigung.json'), projekt, frage,
  });
  const abbruch = new AbortController();
  let signal;
  const stoppen = name => { signal = name; abbruch.abort(); };
  const beiInt = () => stoppen('SIGINT');
  const beiTerm = () => stoppen('SIGTERM');
  process.on('SIGINT', beiInt);
  process.on('SIGTERM', beiTerm);
  let code = 1;
  let statusDatei;
  let stand;
  try {
    require('./_fixtures').bereiteFixturesVor();
    const laufId = await mitteilungen.beginnen();
    if (signal) throw new Error(`Abbruch durch ${signal} vor dem ersten Prüflauf.`);
    const stempelVorher = stempel();
    const belege = path.join(__dirname, '.gesamtlauf-belege', laufId);
    fs.mkdirSync(belege, { recursive: true });
    statusDatei = path.join(belege, 'status.json');
    stand = { laufId, erwartet: LAEUFE.length, phase: 'laeuft', bereinigung: 'offen',
      stempelVorher, ergebnisse: [] };
    fs.writeFileSync(statusDatei, JSON.stringify(stand, null, 2) + '\n');
    const gestartet = Date.now();
    let budgetGemeldet = false;
    const ergebnisse = [];

    for (const [name, datei] of LAEUFE) {
      if (signal) break;
      if (!budgetGemeldet && Date.now() - gestartet >= 6 * 60 * 60 * 1000) {
        budgetGemeldet = true;
        console.error('WARNUNG: Gesamtlauf seit sechs Stunden aktiv; Ergebnisse sichern und Pause einplanen.');
      }
      console.log(`\n${'='.repeat(70)}\n  ${name}\n${'='.repeat(70)}`);
      const protokoll = path.join(belege, `${name}.log`);
      const ziel = fs.openSync(protokoll, 'w');
      let lauf;
      try {
        mitteilungen.kindVorbereiten();
        lauf = await laufProzess(path.join(__dirname, datei), {
          ausgabe: ziel, zeitgrenze: ZEITGRENZE, signal: abbruch.signal,
          gestartet: pid => mitteilungen.kindGestartet(pid),
        });
        if (lauf.sicherBeendet) mitteilungen.kindBeendet();
      } finally {
        fs.closeSync(ziel);
      }
      const ausgabe = fs.readFileSync(protokoll, 'utf8');
      // Rohbelege bleiben auch bei Abbruch erhalten. Punktdateien verändern den Stempel nicht.
      process.stdout.write(ausgabe);
      if (lauf.zeit) console.error(`ABBRUCH: ${name} nach 15 Minuten; Zahlen unvollständig.`);
      if (lauf.error) console.error(`ABBRUCH: ${name}: ${lauf.error.message}`);
      ergebnisse.push({ name,
        code: lauf.zeit ? 'zeit' : lauf.abgebrochen ? 'abbruch' : lauf.error ? 'fehler' : lauf.status,
        zahlen: zaehlen(ausgabe) });
      Object.assign(stand, { ergebnisse, signal: signal || null });
      fs.writeFileSync(statusDatei, JSON.stringify(stand, null, 2) + '\n');
      if (lauf.error) throw lauf.error;
    }

    console.log(`\n${'='.repeat(70)}\n  Übersicht\n${'='.repeat(70)}`);
    let gesamtGut = 0;
    let gesamtAlle = 0;
    for (const e of ergebnisse) {
      const zahl = e.zahlen ? `${e.zahlen.gut}/${e.zahlen.gesamt}` : '—';
      if (e.zahlen) { gesamtGut += e.zahlen.gut; gesamtAlle += e.zahlen.gesamt; }
      const zeichen = e.code === 0 ? 'OK  ' : e.code === 'zeit' ? 'ZEIT' : 'FEHL';
      console.log(`  ${zeichen}  ${e.name.padEnd(16)} ${zahl.padStart(9)}`);
    }
    const gescheitert = ergebnisse.filter(e => e.code !== 0 || (e.zahlen && e.zahlen.gut !== e.zahlen.gesamt));
    const ohneZahlen = ergebnisse.filter(e => !e.zahlen || e.zahlen.gesamt === 0);
    console.log(`\n  ${gesamtGut} von ${gesamtAlle} Prüfungen bestanden, ${ergebnisse.length}/${LAEUFE.length} Läufe.`);
    if (ohneZahlen.length) console.log(`  Ohne zählbare Prüfungen: ${ohneZahlen.map(e => e.name).join(', ')}`);
    if (gescheitert.length) console.log(`  Nicht durchgekommen: ${gescheitert.map(e => e.name).join(', ')}`);
    const verwackelt = stempel() !== stempelVorher;
    stand.quellenUnveraendert = !verwackelt;
    if (verwackelt) console.error('ACHTUNG: Code oder Prüfdatei während des Laufs geändert; Messung ungültig.');
    code = gescheitert.length || ohneZahlen.length || verwackelt || ergebnisse.length !== LAEUFE.length ? 1 : 0;
  } catch (fehler) {
    if (stand) stand.fehler = fehler.message;
    throw fehler;
  } finally {
    try {
      await mitteilungen.beenden();
      if (stand) stand.bereinigung = 'erfolgreich';
    } catch (fehler) {
      if (stand) { stand.bereinigung = 'fehlgeschlagen'; stand.fehler = fehler.message; }
      throw fehler;
    } finally {
      process.removeListener('SIGINT', beiInt);
      process.removeListener('SIGTERM', beiTerm);
      if (stand) {
        stand.phase = 'beendet';
        stand.signal = signal || null;
        stand.code = stand.fehler ? 1 : signal ? signal === 'SIGINT' ? 130 : 143 : code;
        fs.writeFileSync(statusDatei, JSON.stringify(stand, null, 2) + '\n');
      }
    }
  }
  return signal ? signal === 'SIGINT' ? 130 : 143 : code;
}

if (require.main === module) {
  haupt().then(code => { process.exitCode = code; }).catch(fehler => {
    console.error(`ABBRUCH: ${fehler.message}`);
    process.exitCode = 1;
  });
}

module.exports = { haupt, stempel, LAEUFE };
