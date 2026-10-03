// Nachweisen, dass der letzte Push wirklich auf Render live ist.
//
//   npm run deploy:pruefen
//
// Vergleicht den letzten Commit auf origin/main, der die Website betrifft,
// mit dem Commit, den /api/version live meldet, und wartet, bis er live ist
// (oder ein späterer). Vorher prüft
// es die Push-Falle: nicht committete Dateien und ungepushte Commits gehen
// nie live, egal wie lange man wartet.
//
// Zeitgrenze: AM_DEPLOY_MINUTEN (Standard 30). Ein Build auf der freien
// Stufe dauerte gemessen bis zu ~25 Minuten. Wechselt live nur `gestartet`
// und der Commit bleibt gleich, ist das ein Spin-up, kein Build.
//
// Render baut nur, wenn ein Push etwas unter BAUPFADE ändert (Build-Filter
// des Dienstes, seit 03.10.2026 per API gesetzt). Ein Push nur in app/ oder
// SQL baut absichtlich nicht — bis zum 03.10. wartete dieses Skript dann
// 30 Minuten auf origin/main und meldete einen Ausfall, den es nicht gab.

const { execSync } = require('child_process');
const path = require('path');

const ADRESSE = process.env.AM_WEBSITE || 'https://all-media-website.onrender.com';
const MINUTEN = Number(process.env.AM_DEPLOY_MINUTEN || 30);
const TAKT = 20000;
const BAUPFADE = ['web', 'gemeinsam'];
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
  const kopf = git('rev-parse --short origin/main');
  const ziel = git(`log -1 --format=%h origin/main -- ${BAUPFADE.join(' ')}`);
  // Live darf auch ein späterer Commit sein, etwa nach einem Deploy von Hand.
  const erreicht = (live) => {
    try { git(`merge-base --is-ancestor ${ziel} ${live}`); return true; } catch { return false; }
  };

  console.log(`Nicht committet: ${offen}   Ungepusht: ${ungepusht}   origin/main: ${kopf}`);
  if (ziel !== kopf) {
    console.log(`Seit ${ziel} nichts unter ${BAUPFADE.join('/, ')}/ geändert — Render baut dafür nicht, Ziel ist ${ziel}.`);
  }
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
    if (!live.fehler && erreicht(live.commit)) {
      console.log(`Live: ${live.commit}, enthält ${ziel} (nach ${sekunden} s).`);
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, TAKT));
  }
  // Erst in der Deploy-Liste nachsehen, ob es überhaupt einen Versuch gab.
  console.error(`Nach ${MINUTEN} Minuten noch nicht live. In der Deploy-Liste des Dienstes all-media-website nachsehen:`);
  console.error('  kein Eintrag für den Commit → Build-Filter des Dienstes prüfen, Deploy manuell anstoßen');
  console.error('  Eintrag mit Fehler           → Build-Log lesen');
  console.error('Render-API-Schlüssel: Vault, 04 Ressourcen/Zugangsdaten/Render.md.md');
  process.exit(1);
})();
