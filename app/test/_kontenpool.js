/**
 * Kontenpool für parallele Prüfläufe (Schema 138, 24.11.2026).
 *
 * Bis heute teilten sich alle Sitzungen ein Prüfkonto und ein Partnerkonto;
 * jeder Lauf setzt sein Konto zurück, also durfte immer nur eine Sitzung
 * testen. Jetzt gibt es vier Plätze mit je eigenem Paar:
 *
 *   Platz 1  all.media.prueflauf@web.de  + test@all-media.app   (wie bisher)
 *   Platz 2  prueflauf2@all-media.app    + test2@all-media.app
 *   Platz 3  prueflauf3@all-media.app    + test3@all-media.app
 *   Platz 4  prueflauf4@all-media.app    + test4@all-media.app
 *
 * Die Sitzung belegt einen Platz mit
 *   Henrik/Claude/Uebergabe/ki-abgleich.sh platz <ki> "<zweck>"
 * und jeder Prüflauf findet ihn selbst (ki-abgleich.sh meinplatz). Daraus
 * setzt platzSetzen() die Umgebung, die alle Läufe ohnehin lesen:
 *
 *   AM_PLATZ          1–4
 *   AM_TEST_MAIL      Prüfkonto des Platzes
 *   AM_PARTNER_MAIL   Partnerkonto des Platzes (bisher fest test@all-media.app)
 *
 * Kindprozesse erben die Umgebung. Die Passwörter liefert _testpasswoerter.js
 * (Platz 1: AM_PRUEFKONTO_PASS / AM_TESTKONTO_PASS, Platz 2–4: AM_POOL_PASS).
 *
 * Wer keinen Platz hält, bekommt Platz 1 als Vorgabe — die Belegungsprüfung
 * in _ki_belegung.js bricht dann ab, bevor etwas zurückgesetzt wird.
 */

const { spawnSync } = require('child_process');

const PLAETZE = {
  1: { pruef: 'all.media.prueflauf@web.de', pruefId: '62616c1d-82e2-4ee4-aab9-950e40e438a4',
       partner: 'test@all-media.app', partnerId: '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4',
       pruefHandle: '@prueflauf', partnerHandle: '@test', partnerName: 'Test Nutzer' },
  2: { pruef: 'prueflauf2@all-media.app', pruefId: '5102dc2b-760a-4eab-bfd6-52aad76a62e4',
       partner: 'test2@all-media.app', partnerId: 'cf188d34-1c06-4032-baaa-fddc1962f1e5',
       pruefHandle: '@prueflauf2', partnerHandle: '@test2', partnerName: 'Test Nutzer 2' },
  3: { pruef: 'prueflauf3@all-media.app', pruefId: '96b4bed8-ef40-4008-a234-9dd9980157cd',
       partner: 'test3@all-media.app', partnerId: '53f6c454-c64d-4c36-900f-199acf22cd71',
       pruefHandle: '@prueflauf3', partnerHandle: '@test3', partnerName: 'Test Nutzer 3' },
  4: { pruef: 'prueflauf4@all-media.app', pruefId: 'ccafa28b-a34c-458c-87e1-bc1867d15811',
       partner: 'test4@all-media.app', partnerId: 'a97dd738-9f60-4a17-83ae-348d1d187858',
       pruefHandle: '@prueflauf4', partnerHandle: '@test4', partnerName: 'Test Nutzer 4' },
};

/** Name der Belegung im Abgleich-Skript. */
const platzSache = (n) => (Number(n) === 1 ? 'testbestand' : `testbestand-${n}`);

/** Fragt das Abgleich-Skript nach dem Platz dieser Sitzung. null = keiner. */
function meinPlatz() {
  const { SKRIPT } = require('./_ki_belegung');
  const r = spawnSync('bash', [SKRIPT, 'meinplatz'], { encoding: 'utf8', timeout: 20000 });
  const n = Number(String(r.stdout || '').trim());
  return r.status === 0 && PLAETZE[n] ? n : null;
}

/**
 * Setzt AM_PLATZ, AM_TEST_MAIL und AM_PARTNER_MAIL. Bricht nie ab.
 * Ein schon gesetztes AM_PLATZ (vom Elternprozess oder von Hand) gilt.
 */
function platzSetzen() {
  if (globalThis.__kontenpoolGesetzt) return Number(process.env.AM_PLATZ) || 1;
  globalThis.__kontenpoolGesetzt = true;

  let n = Number(process.env.AM_PLATZ);
  if (!PLAETZE[n]) n = meinPlatz() || 1;
  process.env.AM_PLATZ = String(n);

  if (n === 1) {
    // Platz 1 wie bisher: eine von Hand gesetzte Adresse bleibt.
    process.env.AM_PARTNER_MAIL = process.env.AM_PARTNER_MAIL || PLAETZE[1].partner;
  } else {
    // Plätze 2–4: immer das eigene Paar, sonst setzte der Lauf Platz 1 zurück.
    process.env.AM_TEST_MAIL = PLAETZE[n].pruef;
    process.env.AM_PARTNER_MAIL = PLAETZE[n].partner;
    process.env.TEST_EMAIL = PLAETZE[n].partner;
  }
  return n;
}

/**
 * Prüf- und Partnerkonto des aktiven Platzes (Adresse und Kennung).
 * Die Kennungen gelten für das Paar des Platzes; wer auf Platz 1 eine andere
 * Adresse von Hand setzt, muss auch die Kennung selbst nachschlagen.
 */
function konten() {
  const n = platzSetzen();
  return {
    platz: n,
    pruef: process.env.AM_TEST_MAIL || PLAETZE[n].pruef,
    pruefId: PLAETZE[n].pruefId,
    partner: process.env.AM_PARTNER_MAIL || PLAETZE[n].partner,
    partnerId: PLAETZE[n].partnerId,
    pruefHandle: PLAETZE[n].pruefHandle,
    partnerHandle: PLAETZE[n].partnerHandle,
    partnerName: PLAETZE[n].partnerName,
  };
}

/** Alle Handles des Pools (Testwelt für Vorschläge und Suchen). */
const POOL_HANDLES = Object.values(PLAETZE).flatMap((p) => [p.pruefHandle, p.partnerHandle]);

module.exports = { PLAETZE, POOL_HANDLES, platzSache, meinPlatz, platzSetzen, konten };
