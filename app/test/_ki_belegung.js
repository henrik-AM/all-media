/**
 * Belegung des Testbestands zwischen KI-Sitzungen (21.10.2026, verschärft 25.10.2026).
 *
 * Claude und ChatGPT (Codex) arbeiten im selben Ordner, oft mit mehreren Sitzungen.
 * Jeder Prüflauf gegen Supabase meldet sich am gemeinsamen Prüfkonto an und setzt
 * dessen Bestand zurück. Laufen zwei Sitzungen gleichzeitig, zerstören sie einander
 * die Zahlen, und das sieht aus wie ein Codefehler. Die PID-Sperre in alles.js
 * schützt nur gegen einen zweiten Gesamtlauf, nicht gegen einzelne Läufe.
 *
 * Deshalb wird der Testbestand vorher belegt:
 *   Henrik/Claude/Uebergabe/ki-abgleich.sh belegen <ki> testbestand "<zweck>"
 *
 * Der Lauf fragt `ki-abgleich.sh meine testbestand` und läuft NUR, wenn genau diese
 * Sitzung belegt hat. Bis 25.10. reichte derselbe KI-Name, und ohne Belegung gab es
 * nur einen Hinweis — so ließen zwei Claude- oder zwei Codex-Sitzungen einander
 * durch (Prüfung durch Codex). Wer die Sitzung ist, entscheidet das Skript
 * (Sitzungskennung, sonst Prozessnummer), nicht diese Datei: eine Regel, ein Ort.
 *
 * Abbruch mit Code 2, bevor angemeldet oder zurückgesetzt wird, wenn die Belegung
 * fehlt, einer anderen Sitzung gehört, unklar ist oder das Skript nicht erreichbar
 * ist. Kindprozesse von alles.js erben die Sitzungskennung und fragen selbst nach.
 *
 * Geladen von _testpasswoerter.js (darüber _konto.js), alles.js und _aufraeumen.js.
 * Reine Offline-Läufe (Attrappe, *_einheit) laden es nicht und laufen immer.
 */

const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SKRIPT = process.env.KI_ABGLEICH
  || path.join(os.homedir(), 'Library', 'CloudStorage', 'OneDrive-Persönlich', 'Business', 'AI',
    'Henrik', 'Claude', 'Uebergabe', 'ki-abgleich.sh');

const GRUND = {
  3: 'gehört einer anderen Sitzung',
  4: 'ist belegt, aber ohne lesbare Angaben (unklar)',
  5: 'ist nicht belegt',
  6: 'lässt sich keiner Sitzung zuordnen (keine Sitzungskennung, kein claude-/codex-Prozess)',
};

/** Läuft nur weiter, wenn diese Sitzung die Sache belegt hat. Sonst Abbruch mit Code 2. */
function pruefeBelegung(sache = 'testbestand') {
  if (globalThis.__kiBelegungGeprueft) return;
  globalThis.__kiBelegungGeprueft = true;

  const r = spawnSync('bash', [SKRIPT, 'meine', sache], { encoding: 'utf8', timeout: 20000 });
  if (r.status === 0) return;

  const grund = r.error || r.status === null
    ? `ließ sich nicht prüfen (${SKRIPT}: ${r.error ? r.error.message : 'Zeitgrenze'})`
    : r.status === 127 || /No such file/.test(r.stderr || '')
      ? `ließ sich nicht prüfen (${SKRIPT} fehlt)`
      : GRUND[r.status] || `ließ sich nicht prüfen (Ausgang ${r.status})`;
  console.error(
    `\nABBRUCH  ${sache} ${grund}.\n` +
    '          Dieser Lauf setzt gemeinsame Testdaten zurück und läuft nur mit eigener Belegung:\n' +
    `          ki-abgleich.sh belegen <ki> ${sache} "<zweck>"   (danach: freigeben <ki> ${sache})\n` +
    '          Gehört sie einer anderen Sitzung: warten oder Henrik fragen, nicht erzwingen.\n'
  );
  process.exit(2);
}

module.exports = { pruefeBelegung, SKRIPT };
