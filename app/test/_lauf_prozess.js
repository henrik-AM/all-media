// Ausgabe bleibt in einer Datei: offene Browser-Pipes dürfen den Lauf nicht blockieren.
'use strict';
const { spawn } = require('node:child_process');

function gruppeLebt(pid) {
  try { process.kill(process.platform === 'win32' ? pid : -pid, 0); return true; }
  catch (e) { if (e.code === 'ESRCH') return false; throw e; }
}

function laufProzess(datei, { ausgabe, zeitgrenze, signal, env = process.env, gestartet = () => {} }) {
  return new Promise(resolve => {
    if (signal?.aborted) return resolve({ status: null, abgebrochen: true, sicherBeendet: true });
    const gruppe = process.platform !== 'win32';
    const kind = spawn(process.execPath, [datei], {
      env, stdio: ['ignore', ausgabe, ausgabe], detached: gruppe,
    });
    let zeit = false;
    let fehler;
    const stoppen = () => {
      try {
        if (gruppe && kind.pid) process.kill(-kind.pid, 'SIGKILL');
        else kind.kill('SIGKILL');
      } catch (e) {
        if (e.code !== 'ESRCH') fehler = e;
      }
    };
    const timer = setTimeout(() => { zeit = true; stoppen(); }, zeitgrenze);
    signal?.addEventListener('abort', stoppen, { once: true });
    kind.once('error', e => { fehler = e; });
    try { gestartet(kind.pid); } catch (e) { fehler = e; stoppen(); }
    kind.once('close', async (status, endsignal) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', stoppen);
      // Auch beim frühen process.exit() dürfen keine Browser des Kindes weiter schreiben.
      stoppen();
      let sicherBeendet = false;
      try {
        const bis = Date.now() + 3000;
        while (kind.pid && gruppeLebt(kind.pid) && Date.now() < bis) {
          await new Promise(r => setTimeout(r, 20));
        }
        sicherBeendet = !kind.pid || !gruppeLebt(kind.pid);
        if (!sicherBeendet) fehler = new Error('Kindprozessgruppe noch aktiv; keine Bereinigung.');
      } catch (e) { fehler = e; }
      resolve({ status, signal: endsignal, error: fehler, zeit, abgebrochen: !!signal?.aborted, sicherBeendet });
    });
  });
}

module.exports = { laufProzess, gruppeLebt };
