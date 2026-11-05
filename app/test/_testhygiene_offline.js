// Regressionsprüfung ohne Konto, Server oder Netzwerk: node --test test/_testhygiene_offline.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const { bereiteFixturesVor } = require('./_fixtures');
const { laufMitteilungen } = require('./_lauf_mitteilungen');
const { laufProzess } = require('./_lauf_prozess');
const { stempel } = require('./alles');

function temp(t) {
  const p = fs.mkdtempSync(path.join(os.tmpdir(), 'allmedia-hygiene-'));
  t.after(() => fs.rmSync(p, { recursive: true, force: true }));
  return p;
}

// Bewusst keine Netzattrappe mit Fallback: Nur diese vier SQL-Wege sind zulässig.
function datenbank({ alt = 0, loeschfehler = false, rest = 0 } = {}) {
  const sql = [];
  let geloescht = false;
  return { sql, frage: async query => {
    sql.push(query);
    if (/clock_timestamp/.test(query)) return [{ seit: '2026-11-05T14:00:00.123456Z' }];
    if (/delete from notifications/.test(query)) {
      if (loeschfehler) throw new Error('Löschen gesperrt');
      geloescht = true;
      return [{ geloescht: '7' }];
    }
    if (/select count\(\*\) as anzahl/.test(query)) return [{ anzahl: geloescht ? rest : alt }];
    throw new Error('Unerwartetes SQL');
  } };
}

function lebenszyklus(datei, db) {
  return laufMitteilungen({ datei, projekt: 'projekt1', frage: db.frage, melden() {} });
}

test('Frischer Worktree: beide Fixtures vor dem Stempel; wiederholte Vorbereitung bytegleich', t => {
  const p = temp(t);
  bereiteFixturesVor(p);
  const vorher = stempel([p]);
  bereiteFixturesVor(p);
  assert.equal(stempel([p]), vorher);
  assert.deepEqual(fs.readdirSync(p).sort(), ['_testbild.png', '_teststory.png']);
  fs.writeFileSync(path.join(p, 'pruefer.js'), 'Änderung');
  assert.notEqual(stempel([p]), vorher, 'Der Quellwächter bleibt wirksam.');
});

test('Abweichende Fixture wird abgelehnt und nicht überschrieben', t => {
  const p = temp(t);
  fs.writeFileSync(path.join(p, '_teststory.png'), 'fremder Inhalt');
  assert.throws(() => bereiteFixturesVor(p), /unerwarteten Inhalt/);
  assert.equal(fs.readFileSync(path.join(p, '_teststory.png'), 'utf8'), 'fremder Inhalt');
});

test('Laufjournal enthält Kennung, Projekt und DB-Zeit; Löschen erfasst nur beide Testkonten seit Laufstart', async t => {
  const datei = path.join(temp(t), 'journal.json');
  const db = datenbank();
  const l = lebenszyklus(datei, db);
  const id = await l.beginnen();
  const journal = JSON.parse(fs.readFileSync(datei));
  assert.equal(journal.id, id);
  assert.equal(journal.seit, '2026-11-05T14:00:00.123456Z');
  assert.equal(journal.projekt, 'projekt1');
  await l.beenden();
  assert.equal(fs.existsSync(datei), false);
  const sql = db.sql.find(q => /delete/.test(q));
  assert.match(sql, /where \(actor_id in/);
  assert.match(sql, /or user_id in[\s\S]+\)\) and created_at >= '2026-11-05T14:00:00.123456Z'::timestamptz/);
  assert.match(sql, /test@all-media\.app/);
  assert.match(sql, /all\.media\.prueflauf@web\.de/);
  assert.equal(db.sql.filter(q => /select count/.test(q)).length, 3); // Vorprüfung, DELETE-CTE, Nachzählung
  assert.doesNotMatch(JSON.stringify(journal), /token|password/i);
});

test('Fehlgeschlagene Bereinigung bleibt wiederaufnehmbar; nächster Start räumt zuerst auf', async t => {
  const datei = path.join(temp(t), 'journal.json');
  const l = lebenszyklus(datei, datenbank({ loeschfehler: true }));
  const alt = await l.beginnen();
  await assert.rejects(l.beenden(), /Löschen gesperrt/);
  assert.equal(fs.existsSync(datei), true);
  const db = datenbank();
  const neu = lebenszyklus(datei, db);
  assert.notEqual(await neu.beginnen(), alt);
  assert.match(db.sql[0], /delete/);
  await neu.beenden();
});

test('Nichtnull-Rest zählt als Fehler und erhält das Journal', async t => {
  const datei = path.join(temp(t), 'journal.json');
  const l = lebenszyklus(datei, datenbank({ rest: 2 }));
  await l.beginnen();
  await assert.rejects(l.beenden(), /2 Testmitteilungen übrig/);
  assert.equal(fs.existsSync(datei), true);
});

test('Altbestand ohne Journal blockiert vor dem ersten Löschaufruf', async t => {
  const datei = path.join(temp(t), 'journal.json');
  const db = datenbank({ alt: 4 });
  await assert.rejects(lebenszyklus(datei, db).beginnen(), /4 alte Testmitteilungen/);
  assert.equal(fs.existsSync(datei), false);
  assert.equal(db.sql.length, 1);
});

test('Fremdes Projekt und manipulierte DB-Zeit werden ohne SQL abgelehnt', async t => {
  const datei = path.join(temp(t), 'journal.json');
  const l = lebenszyklus(datei, datenbank());
  await l.beginnen();
  const journal = JSON.parse(fs.readFileSync(datei));
  for (const kaputt of [{ ...journal, projekt: 'fremd' }, { ...journal, seit: "'; delete from profiles; --" }]) {
    fs.writeFileSync(datei, JSON.stringify(kaputt));
    const db = datenbank();
    await assert.rejects(lebenszyklus(datei, db).beginnen(), /passt nicht/);
    assert.equal(db.sql.length, 0);
  }
});

test('SIGKILL im Startfenster: unklarer Kindprozess verhindert automatische Löschung', async t => {
  const datei = path.join(temp(t), 'journal.json');
  const l = lebenszyklus(datei, datenbank());
  await l.beginnen();
  l.kindVorbereiten();
  const db = datenbank();
  await assert.rejects(lebenszyklus(datei, db).beginnen(), /Prüfprozess möglicherweise noch aktiv/);
  assert.equal(db.sql.length, 0);
});

test('Verwaister laufender Prüfprozess blockiert Bereinigung; nach seinem Ende ist Wiederaufnahme möglich', async t => {
  const datei = path.join(temp(t), 'journal.json');
  const kind = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    detached: process.platform !== 'win32', stdio: 'ignore',
  });
  t.after(() => { try { kind.kill('SIGKILL'); } catch {} });
  const l = lebenszyklus(datei, datenbank());
  await l.beginnen();
  l.kindVorbereiten();
  l.kindGestartet(kind.pid);
  const db = datenbank();
  await assert.rejects(lebenszyklus(datei, db).beginnen(), /Prüfprozess möglicherweise noch aktiv/);
  assert.equal(db.sql.length, 0);
  await new Promise(resolve => { kind.once('close', resolve); kind.kill('SIGKILL'); });
  const weiter = lebenszyklus(datei, db);
  await weiter.beginnen();
  assert.match(db.sql[0], /delete/);
  await weiter.beenden();
});

test('Management-API: HTTP-Fehler wird vor dem Auswerten einer scheinbaren Zählantwort verworfen', async () => {
  const mod = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '_aufraeumen.js'), 'utf8'), {
    module: mod, __dirname, AbortSignal,
    process: { env: { SUPABASE_TOKEN: 'attrappe', SUPABASE_URL: 'https://projekt1.supabase.co' } },
    require: name => name === './_ki_belegung' ? { pruefeBelegung() {} }
      : name === 'fs' ? { existsSync: () => false } : require(name),
    fetch: async () => ({ ok: false, status: 401,
      json() { throw new Error('Fehlerantwort darf keine Erfolgsdaten liefern.'); } }),
  });
  await assert.rejects(mod.exports.frage('select 1'), /HTTP 401/);
});

test('Fehlende oder falsch geformte Zählantwort ist kein leerer Bestand', async t => {
  const datei = path.join(temp(t), 'journal.json');
  for (const antwort of [null, [], [{ anzahl: null }], [{ anzahl: '' }], [{ anzahl: -1 }]]) {
    const l = laufMitteilungen({ datei, projekt: 'projekt1', frage: async () => antwort });
    await assert.rejects(l.beginnen(), /Ungültige Datenbankantwort/);
    assert.equal(fs.existsSync(datei), false);
  }
});

function runner(t, { token = 'attrappe', db = datenbank(), abbrechen = false, laufdauer = false } = {}) {
  const p = temp(t);
  const prozess = new EventEmitter();
  Object.assign(prozess, { pid: process.pid, env: {}, stdout: { write() {} }, exit() { throw new Error('exit'); } });
  const nachrichten = [];
  const mod = { exports: {} };
  const echt = require;
  const requireAttrappe = name => {
    if (name === './_ki_belegung') return { pruefeBelegung() {} };
    if (name === './_pruefserver') return { pruefeServer() {} };
    if (name === './_aufraeumen') return { umgebung: () => ({ token, projekt: 'projekt1' }), frage: db.frage };
    if (name === './_fixtures') return { bereiteFixturesVor: () => bereiteFixturesVor(p) };
    if (name === './_lauf_mitteilungen') return { laufMitteilungen: optionen =>
      laufMitteilungen({ ...optionen, melden() {} }) };
    if (name === './_lauf_prozess') return { laufProzess: async (datei, optionen) => {
      if (abbrechen) setTimeout(() => prozess.emit('SIGTERM'), 100);
      return laufProzess(datei, optionen);
    } };
    return echt(name);
  };
  const dateAttrappe = laufdauer ? class extends Date {
    static aufrufe = 0;
    static now() { return Date.now() + (this.aufrufe++ ? 7 * 3600000 : 0); }
  } : Date;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'alles.js'), 'utf8'), {
    require: requireAttrappe, module: mod, __dirname: p, process: prozess,
    console: { log: s => nachrichten.push(s), error: s => nachrichten.push(s) },
    AbortController, Date: dateAttrappe,
  });
  const { haupt, LAEUFE } = mod.exports;
  LAEUFE.splice(0, LAEUFE.length);
  t.after(() => prozess.emit('exit'));
  return { p, db, nachrichten, haupt, add(name, code) {
    fs.writeFileSync(path.join(p, name + '.js'), code);
    LAEUFE.push([name, name + '.js']);
  } };
}

test('Gesamtlauf: Fehlgeschlagene Suite stoppt weitere Suiten nicht; Bereinigung und Rohbelege vorhanden', async t => {
  const r = runner(t);
  r.add('rot', "console.log('FAIL rot'); process.exit(1);");
  r.add('gruen', "console.log('PASS gruen');");
  assert.equal(await r.haupt(), 1);
  const belege = path.join(r.p, '.gesamtlauf-belege');
  const stand = path.join(belege, fs.readdirSync(belege)[0]);
  const status = JSON.parse(fs.readFileSync(path.join(stand, 'status.json')));
  assert.equal(status.ergebnisse.length, 2);
  assert.equal(status.bereinigung, 'erfolgreich');
  assert.equal(status.code, 1);
  assert.match(fs.readFileSync(path.join(stand, 'rot.log'), 'utf8'), /FAIL/);
  assert.equal(fs.existsSync(path.join(r.p, '.gesamtlauf-bereinigung.json')), false);
});

test('Gesamtlauf: alle Suiten mit Zahlen, stabile Quellen und Rest null ergeben Exit 0', async t => {
  const r = runner(t);
  r.add('gruen', "console.log('PASS gruen');");
  assert.equal(await r.haupt(), 0);
});

test('Gesamtlauf: fehlendes Token blockiert vor SQL und vor Start eines Prüfers', async t => {
  const r = runner(t, { token: '' });
  r.add('verboten', "throw new Error('darf nie laufen');");
  await assert.rejects(r.haupt(), /SUPABASE_TOKEN/);
  assert.equal(r.db.sql.length, 0);
  assert.equal(fs.existsSync(path.join(r.p, '.gesamtlauf-belege')), false);
});

test('Gesamtlauf: Exit 0 ohne Prüfzahlen bleibt unvollständig', async t => {
  const r = runner(t);
  r.add('leer', "console.log('nichts geprüft');");
  assert.equal(await r.haupt(), 1);
});

test('Gesamtlauf: deutscher Summensatz und node:test werden gezählt, null Prüfungen nicht', async t => {
  for (const [name, ausgabe, code] of [
    ['deutsch', '2 von 2 Prüfungen bestanden', 0],
    ['node', 'ℹ tests 18\nℹ pass 18', 0],
    ['leer', '0 von 0 Prüfungen bestanden', 1],
    ['fehler', '1 von 2 Prüfungen bestanden', 1],
  ]) {
    const r = runner(t);
    r.add(name, `console.log(${JSON.stringify(ausgabe)});`);
    assert.equal(await r.haupt(), code, name);
  }
});

test('Gesamtlauf: Bereinigungsfehler verhindert Erfolg und bewahrt Journal', async t => {
  const r = runner(t, { db: datenbank({ loeschfehler: true }) });
  r.add('gruen', "console.log('PASS gruen');");
  await assert.rejects(r.haupt(), /Löschen gesperrt/);
  assert.equal(fs.existsSync(path.join(r.p, '.gesamtlauf-bereinigung.json')), true);
  const belege = path.join(r.p, '.gesamtlauf-belege');
  const status = JSON.parse(fs.readFileSync(path.join(belege, fs.readdirSync(belege)[0], 'status.json')));
  assert.equal(status.bereinigung, 'fehlgeschlagen');
  assert.equal(status.code, 1);
});

test('Gesamtlauf: SIGTERM beendet Kind, überspringt Rest und räumt vor Rückgabe 143 auf', async t => {
  const r = runner(t, { abbrechen: true });
  r.add('wartet', 'setInterval(() => {}, 1000);');
  r.add('verboten', "throw new Error('darf nicht starten');");
  assert.equal(await r.haupt(), 143);
  assert.equal(fs.existsSync(path.join(r.p, '.gesamtlauf-bereinigung.json')), false);
  const logs = fs.readdirSync(path.join(r.p, '.gesamtlauf-belege'));
  const stand = JSON.parse(fs.readFileSync(path.join(r.p, '.gesamtlauf-belege', logs[0], 'status.json')));
  assert.equal(stand.ergebnisse.length, 1);
  assert.equal(stand.signal, 'SIGTERM');
});

test('Gesamtlauf: geänderter Prüfcode macht einen sonst grünen Lauf ungültig', async t => {
  const r = runner(t);
  r.add('aendert', `require('fs').writeFileSync(__filename, '// verändert'); console.log('PASS gruen');`);
  assert.equal(await r.haupt(), 1);
  assert.ok(r.nachrichten.some(s => /Messung ungültig/.test(s)));
});

test('Gesamtlauf: sechs Stunden lösen genau eine Warnung aus', async t => {
  const r = runner(t, { laufdauer: true });
  r.add('eins', "console.log('PASS eins');");
  r.add('zwei', "console.log('PASS zwei');");
  assert.equal(await r.haupt(), 0);
  assert.equal(r.nachrichten.filter(s => /WARNUNG: Gesamtlauf/.test(s)).length, 1);
});

test('Kind mit geerbten Browser-Pipes: Prozessgruppe endet trotz frühem exit', async t => {
  const p = temp(t);
  const datei = path.join(p, 'verwaist.js');
  fs.writeFileSync(datei, `const {spawn}=require('node:child_process');
    spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});
    console.log('PASS vor exit'); process.exit(1);`);
  const fd = fs.openSync(path.join(p, 'log'), 'w');
  try {
    const r = await laufProzess(datei, { ausgabe: fd, zeitgrenze: 3000 });
    assert.equal(r.status, 1);
    assert.equal(r.error, undefined);
  } finally { fs.closeSync(fd); }
});

test('Zeitlimit beendet den Prüfprozess', async t => {
  const p = temp(t);
  const datei = path.join(p, 'haengt.js');
  fs.writeFileSync(datei, 'setInterval(() => {}, 1000);');
  const fd = fs.openSync(path.join(p, 'log'), 'w');
  try {
    const r = await laufProzess(datei, { ausgabe: fd, zeitgrenze: 100 });
    assert.equal(r.zeit, true);
    assert.equal(r.error, undefined);
  } finally { fs.closeSync(fd); }
});
