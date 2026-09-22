// Nachweisen, dass der letzte Push wirklich auf Render live ist.
//
//   npm run deploy:pruefen
//
// Vergleicht `git rev-parse --short HEAD` mit dem Commit, den
// /api/version live meldet, und wartet, bis beide gleich sind. Vorher prüft
// es die Push-Falle: nicht committete Dateien und ungepushte Commits gehen
// nie live, egal wie lange man wartet.
//
// Zeitgrenze: AM_DEPLOY_MINUTEN (Standard 30). Ein Build auf der freien
// Stufe dauerte gemessen bis zu ~25 Minuten. Wechselt live nur `gestartet`
// und der Commit bleibt gleich, ist das ein Spin-up, kein Build.

const { execSync } = require('child_process');
const path = require('path');

const ADRESSE = process.env.AM_WEBSITE || 'https://all-media-website.onrender.com';
const MINUTEN = Number(process.env.AM_DEPLOY_MINUTEN || 30);
const TAKT = 20000;
const WURZEL = path.join(__dirname, '..', '..');

function git(befehl) {
  return execSync(`git ${befehl}`, { cwd: WURZEL, encoding: 'utf8' }).trim();
}

async function liveStand() {
  try {
    const antwort = await fetch(`${ADRESSE}/api/version`, { signal: AbortSignal.timeout(60000) });
    if (antwort.status !== 200) return { fehler: `HTTP ${antwort.status}` };
    return await antwort.json();
  } catch (e) {
    return { fehler: e.message };
  }
}

(async () => {
  git('fetch -q origin');
  const offen = git('status --porcelain').split('\n').filter(Boolean).length;
  const ungepusht = git('log --oneline origin/main..HEAD').split('\n').filter(Boolean).length;
  const ziel = git('rev-parse --short origin/main');

  console.log(`Nicht committet: ${offen}   Ungepusht: ${ungepusht}   origin/main: ${ziel}`);
  if (offen || ungepusht) {
    console.log('Achtung: Diese Änderungen gehen nicht live, bis sie committet und gepusht sind.');
  }

  const beginn = Date.now();
  let zuletzt = '';
  while (Date.now() - beginn < MINUTEN * 60000) {
    const live = await liveStand();
    const sekunden = Math.round((Date.now() - beginn) / 1000);
    const zeile = live.fehler ? `nicht erreichbar (${live.fehler})` : `live ${live.commit}, gestartet ${live.gestartet}`;
    if (zeile !== zuletzt || sekunden % 120 < TAKT / 1000) console.log(`[${sekunden} s] ${zeile}`);
    zuletzt = zeile;
    if (!live.fehler && ziel.startsWith(live.commit)) {
      console.log(`Live: ${live.commit} = origin/main (nach ${sekunden} s).`);
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, TAKT));
  }
  console.error(`Nach ${MINUTEN} Minuten noch nicht live. Auto-Deploy im Render-Dashboard prüfen:`);
  console.error('Dienst all-media-website → Settings → Build & Deploy → Auto-Deploy.');
  process.exit(1);
})();
