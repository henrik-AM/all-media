/**
 * Mitteilungen eines exklusiven Gesamtlaufs, einschließlich Wiederaufnahme nach SIGKILL.
 * Die Laufkennung und die DB-Zeitgrenze bleiben bis zur erfolgreichen Nachzählung liegen.
 * Alte Mitteilungen und Daten ohne Beteiligung eigener Testkonten bleiben erhalten.
 * Keine Zugangsdaten im Journal. Aufruf ausschließlich nach Prüfung der KI-Belegung.
 */
const fs = require('node:fs');
const crypto = require('node:crypto');
const { TESTKONTEN } = require('./_nur_testkonten');
const { gruppeLebt } = require('./_lauf_prozess');

const ZEIT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const KONTEN = TESTKONTEN.map(k => `'${k.replaceAll("'", "''")}'`).join(', ');
const BETEILIGT = `(actor_id in (select id from auth.users where email in (${KONTEN}))
  or user_id in (select id from auth.users where email in (${KONTEN})))`;

function zahl(antwort, feld) {
  const roh = Array.isArray(antwort) && antwort.length === 1 ? antwort[0][feld] : null;
  if (roh === null || roh === undefined || !/^\d+$/.test(String(roh))) {
    throw new Error(`Ungültige Datenbankantwort für ${feld}.`);
  }
  const n = Number(roh);
  if (!Number.isSafeInteger(n)) throw new Error(`Ungültige Anzahl für ${feld}.`);
  return n;
}

function pruefeJournal(journal, projekt) {
  if (journal?.version !== 1 || journal.projekt !== projekt || !UUID.test(journal.id)
    || !ZEIT.test(journal.seit) || JSON.stringify(journal.konten) !== JSON.stringify(TESTKONTEN)) {
    throw new Error('Bereinigungsjournal passt nicht zu Projekt/Testkonten; nicht automatisch löschen.');
  }
}

function laufMitteilungen({ datei, projekt, frage, melden = console.log }) {
  if (!/^[a-z0-9]+$/.test(projekt || '')) throw new Error('Supabase-Projekt fehlt.');
  let aktuell;

  async function bereinigen(journal) {
    pruefeJournal(journal, projekt);
    if (journal.kind !== null) {
      if (!Number.isSafeInteger(journal.kind) || journal.kind < 1 || gruppeLebt(journal.kind)) {
        throw new Error('Alter Prüfprozess möglicherweise noch aktiv; vor Bereinigung prüfen.');
      }
    }
    const filter = `${BETEILIGT} and created_at >= '${journal.seit}'::timestamptz`;
    const geloescht = zahl(await frage(`with weg as (
      delete from notifications where ${filter} returning 1
    ) select count(*) as geloescht from weg`), 'geloescht');
    const rest = zahl(await frage(`select count(*) as anzahl from notifications where ${BETEILIGT}`), 'anzahl');
    if (rest !== 0) throw new Error(`Lauf ${journal.id}: ${rest} Testmitteilungen übrig.`);
    melden(`  Lauf ${journal.id}: ${geloescht} Mitteilungen entfernt, Rest 0.`);
    fs.unlinkSync(datei);
  }

  return {
    async beginnen() {
      // Die globale KI-Belegung und die lokale PID-Sperre müssen bereits gehalten werden.
      if (fs.existsSync(datei)) {
        const alt = JSON.parse(fs.readFileSync(datei, 'utf8'));
        melden('  Unfertige Bereinigung des vorherigen Laufs wird nachgeholt.');
        await bereinigen(alt);
      }
      const altbestand = zahl(await frage(
        `select count(*) as anzahl from notifications where ${BETEILIGT}`
      ), 'anzahl');
      if (altbestand !== 0) {
        throw new Error(`${altbestand} alte Testmitteilungen ohne Laufjournal: gezielt bereinigen, dann erneut starten.`);
      }
      const antwort = await frage(`select to_char(clock_timestamp() at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as seit`);
      aktuell = { version: 1, id: crypto.randomUUID(), projekt,
        konten: [...TESTKONTEN], seit: antwort?.[0]?.seit, kind: null };
      pruefeJournal(aktuell, projekt);
      fs.writeFileSync(datei, JSON.stringify(aktuell, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      melden(`  Laufkennung: ${aktuell.id}`);
      return aktuell.id;
    },
    kindVorbereiten() {
      aktuell.kind = 'startet';
      fs.writeFileSync(datei, JSON.stringify(aktuell, null, 2) + '\n');
    },
    kindGestartet(pid) {
      if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('Prüfprozess konnte nicht starten.');
      aktuell.kind = pid;
      fs.writeFileSync(datei, JSON.stringify(aktuell, null, 2) + '\n');
    },
    kindBeendet() {
      aktuell.kind = null;
      fs.writeFileSync(datei, JSON.stringify(aktuell, null, 2) + '\n');
    },
    async beenden() {
      if (aktuell && fs.existsSync(datei)) await bereinigen(aktuell);
    },
  };
}

module.exports = { laufMitteilungen, zahl };
