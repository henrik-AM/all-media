/**
 * Wächter für den Prüfserver auf Port 3000 (29.10.2026, Beratergremium).
 *
 * Alle Browser-Prüfläufe messen gegen http://localhost:3000. Zwei Fallen haben dort
 * wiederholt Zahlen erzeugt, die nach Codefehlern aussahen:
 *
 *   1. ALTER SERVER — web/server/lokal.js und die Expo-Weiche app/web-app.js lesen den
 *      Servercode einmal beim Start. Wer danach eine Route ergänzt, bekommt 404
 *      (03.09.: sechs rote Läufe bei 584/584; 04.09.: zwanzig Minuten 404).
 *   2. FREMDER ORDNER — Claude und Codex arbeiten in eigenen Worktrees. Läuft der Server
 *      aus einem anderen Worktree als der Prüflauf, misst der Lauf fremden Code.
 *
 * Der Wächter sieht nach, wer auf 3000 lauscht, aus welchem Ordner und seit wann, und
 * bricht mit Code 2 ab, bevor angemeldet wird, wenn
 *   - niemand lauscht,
 *   - der Server außerhalb dieses Arbeitsordners gestartet wurde,
 *   - eine Datei unter web/server/, gemeinsam/ oder app/web-app.js neuer ist als der Start.
 *
 * Er sitzt in alles.js und im goto-Einbau von _konto.js (erster Aufruf von localhost:3000),
 * gilt also für jeden Browserlauf — für Claude wie für Codex, gleich welche Variable
 * (ZIEL, AM_URL, BASIS) das Ziel setzt. Andere Ziele prüft er nicht.
 * Bewusst übergehen: PRUEFSERVER_EGAL=1.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const AUF_3000 = /^https?:\/\/(localhost|127\.0\.0\.1):3000(\/|$)/;
const WURZEL = path.resolve(__dirname, '..', '..');
const SERVERCODE = [
  path.join(WURZEL, 'web', 'server'),
  path.join(WURZEL, 'gemeinsam'),
  path.join(WURZEL, 'app', 'web-app.js'),
];

function befehl(argv) {
  // LC_ALL=C: ps schreibt sonst „Do. 29 Okt.“, das Date.parse nicht liest.
  const r = spawnSync(argv[0], argv.slice(1), {
    encoding: 'utf8', timeout: 10000, env: { ...process.env, LC_ALL: 'C' },
  });
  return r.status === 0 ? r.stdout.trim() : '';
}

/** Jüngste Datei unter den Pfaden, ohne node_modules und Punktdateien. */
function juengsteDatei(pfade) {
  let beste = { datei: null, zeit: 0 };
  const besuchen = p => {
    let st;
    try { st = fs.statSync(p); } catch { return; }
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(p)) {
        if (name === 'node_modules' || name.startsWith('.')) continue;
        besuchen(path.join(p, name));
      }
    } else if (st.mtimeMs > beste.zeit) {
      beste = { datei: p, zeit: st.mtimeMs };
    }
  };
  pfade.forEach(besuchen);
  return beste;
}

/** Wer auf 3000 lauscht: { pid, ordner, start } oder null. */
function serverAuf3000() {
  const pid = befehl(['lsof', '-nP', '-tiTCP:3000', '-sTCP:LISTEN']).split('\n')[0];
  if (!pid) return null;
  // lsof schreibt Nicht-ASCII-Bytes als \xHH („ö“ im OneDrive-Pfad als \xcc\x88).
  const roh = (befehl(['lsof', '-a', '-p', pid, '-d', 'cwd', '-Fn']).split('\n')
    .find(z => z.startsWith('n')) || '').slice(1);
  const ordner = Buffer.from(roh.replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1')
    .toString('utf8');
  const start = Date.parse(befehl(['ps', '-o', 'lstart=', '-p', pid]));
  return { pid, ordner, start };
}

/** Echter Pfad, Unicode-gleich (OneDrive-Ordner enthält „ö“). */
function echt(p) {
  try { return fs.realpathSync(p).normalize('NFC'); } catch { return p.normalize('NFC'); }
}

/** Gibt einen Grund zurück, warum der Server nicht taugt, oder null. */
function serverMangel(ziel = process.env.ZIEL || 'http://localhost:3000/') {
  if (!AUF_3000.test(ziel)) return null;

  const s = serverAuf3000();
  if (!s) {
    return 'Auf Port 3000 läuft kein Server.\n' +
      '          Starten: cd web && node server/lokal.js   (oder: cd app && node web-app.js)';
  }

  const wurzel = echt(WURZEL);
  if (s.ordner && !(echt(s.ordner) + path.sep).startsWith(wurzel + path.sep)) {
    return `Der Server auf 3000 (PID ${s.pid}) läuft aus\n          ${s.ordner}\n` +
      `          dieser Prüflauf misst aber\n          ${WURZEL}\n` +
      '          Fremden Server nur nach Rücksprache beenden (andere Sitzung?).';
  }

  const neu = juengsteDatei(SERVERCODE);
  if (!Number.isFinite(s.start)) {
    return `Startzeit des Servers auf 3000 (PID ${s.pid}) ließ sich nicht lesen.`;
  }
  if (neu.zeit > s.start + 1000) {
    const zeit = d => new Date(d).toLocaleString('de-DE');
    return `Servercode ist neuer als der Server (PID ${s.pid}, Start ${zeit(s.start)}):\n` +
      `          ${path.relative(WURZEL, neu.datei)} geändert ${zeit(neu.zeit)}\n` +
      `          Neu starten: kill ${s.pid}, dann wieder starten.`;
  }
  return null;
}

/** Läuft nur weiter, wenn der Server auf 3000 zu diesem Stand passt. Sonst Abbruch mit Code 2. */
function pruefeServer(ziel = process.env.ZIEL || 'http://localhost:3000/') {
  if (globalThis.__pruefserverGeprueft || process.env.PRUEFSERVER_EGAL === '1') return;
  if (!AUF_3000.test(ziel)) return;
  globalThis.__pruefserverGeprueft = true;

  const mangel = serverMangel(ziel);
  if (!mangel) return;
  console.error(
    `\nABBRUCH  ${mangel}\n` +
    '          Bewusst übergehen: PRUEFSERVER_EGAL=1\n'
  );
  process.exit(2);
}

module.exports = { pruefeServer, serverMangel };
