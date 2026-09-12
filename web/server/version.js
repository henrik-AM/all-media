/**
 * Welcher Stand läuft hier gerade?
 *
 * WARUM ES DAS GIBT
 *
 * Am 11.09.2026 lagen zwei Arbeitstage als nie committete Arbeitskopie im
 * Ordner. Die Website zeigte davon nichts — sie sah genauso aus wie eine
 * Website, die auf dem neuesten Stand ist. Um zu beweisen, dass der Deploy
 * wirklich durch war, musste eine gerade erst angelegte Datei abgerufen
 * werden (`krypto.js`): existiert sie live, ist der Stand neu. Das
 * funktioniert genau einmal und nur für den, der weiß, welche Datei neu ist.
 *
 * Diese Datei beantwortet die Frage dauerhaft: der Commit, aus dem der
 * laufende Server gebaut wurde, und wann er gestartet ist.
 *
 * WOHER DER COMMIT KOMMT
 *
 * Bei Render steht er in der Umgebungsvariablen RENDER_GIT_COMMIT — die setzt
 * Render selbst beim Bauen. Lokal gibt es die nicht, dort wird `git` gefragt.
 * Beides kann fehlen (fremder Ordner ohne .git, kein git installiert); dann
 * steht hier ehrlich "unbekannt" und nicht etwa ein erfundener Wert.
 *
 * Der Commit wird einmal beim Start ermittelt, nicht bei jeder Anfrage. Ein
 * laufender Prozess kann seinen eigenen Stand nicht wechseln — und wenn im
 * Ordner weitergearbeitet wird, wäre eine späte Abfrage sogar falsch: sie
 * meldete den Stand der Arbeitskopie, nicht den des laufenden Servers.
 */

const { execFileSync } = require('child_process');
const path = require('path');

/** Der Commit-Kurzname aus dem Ordner — oder null, wenn git nichts sagt. */
function ausGit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: path.join(__dirname, '..', '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch {
    // Kein git, kein .git-Ordner, kein Repository. Alles drei ist zulässig.
    return null;
  }
}

const renderCommit = process.env.RENDER_GIT_COMMIT;

const VERSION = {
  // Die Nummer aus app/app.json. Sie steht hier bewusst als Text und nicht
  // als Import: die Website soll nicht vom App-Ordner abhängen.
  version: '1.0.0',
  commit: renderCommit ? renderCommit.slice(0, 7) : ausGit() || 'unbekannt',
  quelle: renderCommit ? 'Render' : ausGit() ? 'git' : 'nicht ermittelbar',
  zweig: process.env.RENDER_GIT_BRANCH || null,
  gestartet: new Date().toISOString(),
};

module.exports = VERSION;
