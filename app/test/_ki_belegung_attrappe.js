/**
 * Attrappe für _ki_belegung_probe.sh: Jeder Weg nach draußen (Netz, Kindprozess außer
 * ki-abgleich.sh) hinterlässt eine Marke und wirft. So kann die Probe echte Einstiege
 * (alles.js, _aufraeumen.js) starten, ohne dass ein Fehler im Schutz einen echten Lauf
 * auslöst. Geladen über NODE_OPTIONS=--require, gilt also auch für Kindprozesse.
 */
const fs = require('fs');
const marke = (was) => {
  if (process.env.KI_PROBE_MARKE) fs.appendFileSync(process.env.KI_PROBE_MARKE, was + '\n');
  throw new Error('Probe-Attrappe: ' + was + ' gesperrt');
};
globalThis.fetch = async (url) => marke('fetch ' + url);
for (const m of ['http', 'https']) {
  const mod = require(m);
  mod.request = mod.get = () => marke(m);
}
const net = require('net');
net.connect = net.createConnection = () => marke('net');
const cp = require('child_process');
const erlaubt = (args) => Array.isArray(args) && args.some((a) => String(a).endsWith('ki-abgleich.sh'));
for (const name of ['spawn', 'spawnSync', 'execFile', 'execFileSync']) {
  const echt = cp[name];
  cp[name] = function (bef, args, ...rest) {
    if (erlaubt(args)) return echt.call(this, bef, args, ...rest);
    return marke(name + ' ' + bef);
  };
}
for (const name of ['exec', 'execSync', 'fork']) cp[name] = (bef) => marke(name + ' ' + bef);
