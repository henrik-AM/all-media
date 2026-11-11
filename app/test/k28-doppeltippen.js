#!/usr/bin/env node
/*
 * Codex-Prüfung 10.11.2026, ohne Datenbank:
 *
 *  1. Zweimal schnell „Chat mit …“ startete zwei Anlagen — zwei Chats für
 *     dasselbe Paar. Geprüft wird der Server-Weg (handleChatMit, Website) mit
 *     einem nachgebauten Client, der langsam antwortet und Anlagen zählt.
 *     Für die App wird chatMit aus lib/aktionen.ts übersetzt und genauso
 *     doppelt aufgerufen.
 *  2. Die Chat-Info (ContactProfileScreen) lädt eine unbekannte Person nach,
 *     statt sofort „Diese Person gibt es nicht.“ zu zeigen — Quelltextprobe.
 *  3. Website-Klick sperrt eine laufende Anlage je Person — Quelltextprobe.
 *
 * Aufruf: node test/k28-doppeltippen.js   (Gegenprobe: ALT=<git-ref>)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WURZEL = path.join(__dirname, '..', '..');
const ALT = process.env.ALT || '';
let ok = 0;
let fehl = 0;
const pruefe = async (name, fn) => {
  try {
    await fn();
    ok++;
    console.log('  OK   ' + name);
  } catch (e) {
    fehl++;
    console.log('  FEHL ' + name + ' — ' + e.message);
  }
};

function quelle(datei) {
  if (!ALT) return fs.readFileSync(path.join(WURZEL, datei), 'utf8');
  return execSync(`git show ${ALT}:${datei}`, { cwd: WURZEL, encoding: 'utf8', maxBuffer: 64 << 20 });
}

/* Ein Supabase-Client im Kleinen: kein Chat vorhanden, jede Antwort kommt
 * verzögert (sonst wäre der erste Aufruf fertig, bevor der zweite beginnt). */
function attrappe() {
  const zaehler = { chats: 0, mitglieder: 0 };
  const warte = (wert) => new Promise((r) => setTimeout(() => r(wert), 30));
  const kette = (tabelle) => {
    let art = 'select';
    let zeilen = null;
    const k = {
      select: () => k,
      eq: () => k,
      in: () => k,
      insert: (z) => {
        art = 'insert';
        zeilen = z;
        return k;
      },
      delete: () => {
        art = 'delete';
        return k;
      },
      maybeSingle: () => warte({ data: { name: 'Testperson' }, error: null }),
      single: () => {
        zaehler.chats++;
        return warte({ data: { id: 'chat-' + zaehler.chats }, error: null });
      },
      then: (los, weg) => {
        let antwort = { data: [], error: null };
        if (art === 'insert' && tabelle === 'chat_members') {
          zaehler.mitglieder += zeilen.length;
          antwort = { error: null };
        }
        return warte(antwort).then(los, weg);
      },
    };
    return k;
  };
  return {
    zaehler,
    from: kette,
    rpc: (name) => {
      // Seit Schema 126 legt zweierchat_anlegen Chat und Mitglieder an.
      if (name === 'zweierchat_anlegen') {
        zaehler.chats++;
        zaehler.mitglieder += 2;
        return warte({ data: 'chat-' + zaehler.chats, error: null });
      }
      return warte({ data: true, error: null });
    },
  };
}

(async () => {
  console.log('Website (Server): zweimal schnell „Chat mit …“');
  await pruefe('Zwei parallele Aufrufe legen genau einen Chat an', async () => {
    const datei = path.join(WURZEL, 'web/server/sync-handlers.js');
    let modul;
    if (ALT) {
      const tmp = path.join(WURZEL, 'web/server/.alt-sync-handlers.js');
      fs.writeFileSync(tmp, quelle('web/server/sync-handlers.js'));
      try {
        modul = require(tmp);
      } finally {
        fs.unlinkSync(tmp);
      }
    } else modul = require(datei);
    const c = attrappe();
    const [a, b] = await Promise.all([
      modul.handleChatMit(c, 'ich', 'du', 'community'),
      modul.handleChatMit(c, 'ich', 'du', 'community'),
    ]);
    if (!a?.ok || !b?.ok) throw new Error('Antwort: ' + JSON.stringify([a, b]));
    if (c.zaehler.chats !== 1) throw new Error(c.zaehler.chats + ' Chats angelegt');
    if (a.chatId !== b.chatId) throw new Error('verschiedene Chats: ' + a.chatId + ' / ' + b.chatId);
  });
  await pruefe('Danach legt ein neuer Aufruf wieder an (nichts hängt fest)', async () => {
    const modul = require(path.join(WURZEL, 'web/server/sync-handlers.js'));
    const c = attrappe();
    await modul.handleChatMit(c, 'ich', 'du', 'community');
    await modul.handleChatMit(c, 'ich', 'du', 'community');
    // Die Attrappe kennt keine Chats, also zwei getrennte Ermittlungen.
    if (c.zaehler.chats !== 2) throw new Error(c.zaehler.chats + ' statt 2 Anlagen nacheinander');
  });

  console.log('\nApp: chatMit aus lib/aktionen.ts');
  await pruefe('Zwei parallele Aufrufe legen genau einen Chat an', async () => {
    const ts = require(path.join(WURZEL, 'app/node_modules/typescript'));
    const code = ts.transpileModule(quelle('app/lib/aktionen.ts'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const modul = { exports: {} };
    const leer = new Proxy({}, { get: () => () => null });
    const fn = new Function('module', 'exports', 'require', code);
    fn(modul, modul.exports, () => leer);
    const c = attrappe();
    const [a, b] = await Promise.all([
      modul.exports.chatMit(c, 'ich', 'du', 'community'),
      modul.exports.chatMit(c, 'ich', 'du', 'community'),
    ]);
    if (c.zaehler.chats !== 1) throw new Error(c.zaehler.chats + ' Chats angelegt');
    if (a !== b) throw new Error('verschiedene Chats: ' + a + ' / ' + b);
  });
  await pruefe('openChatWith sperrt einen zweiten Tipp, solange einer läuft', async () => {
    const s = quelle('app/App.tsx');
    if (!/chatOeffnetGerade\.current\.has\(/.test(s)) throw new Error('keine Sperre in openChatWith');
  });

  console.log('\nZwei Geräte gleichzeitig: Anlage in der Datenbank (Schema 126)');
  await pruefe('Server und App legen nur noch über zweierchat_anlegen an', async () => {
    for (const datei of ['web/server/sync-handlers.js', 'app/lib/aktionen.ts']) {
      const s = quelle(datei);
      if (!/rpc\('zweierchat_anlegen'/.test(s)) throw new Error(datei + ': kein zweierchat_anlegen');
      const rumpf = s.slice(s.indexOf('function chatMitErmitteln'), s.indexOf('function chatMitErmitteln') + 4000);
      if (/from\('chats'\)\s*\.insert/.test(rumpf)) throw new Error(datei + ': legt Chat noch selbst an');
    }
  });

  console.log('\nApp: Chat-Info mit Person aus der Datenbanksuche');
  await pruefe('ContactProfileScreen lädt eine fehlende Person nach', async () => {
    const s = quelle('app/screens/messenger/ContactProfileScreen.tsx');
    if (!/personenNachladen\(\[userId\]\)/.test(s)) throw new Error('kein Nachladen');
    if (!/personStand === 'laedt'/.test(s)) throw new Error('kein Ladezustand vor „gibt es nicht“');
  });
  await pruefe('openChatWith lädt Treffer aus der Datenbanksuche nach', async () => {
    const s = quelle('app/App.tsx');
    if (!/daten\.personenNachladen\(\[userId\]\)/.test(s)) throw new Error('kein Nachladen beim Öffnen');
  });

  console.log('\nWebsite: Klick auf eine Zeile in „Neuer Chat“');
  await pruefe('Laufende Anlage je Person sperrt weitere Klicks', async () => {
    const s = quelle('web/public/app.js');
    if (!/commNeuerChatLaeuft\.has\(id\)/.test(s)) throw new Error('keine Sperre');
  });

  console.log(`\n${ok}/${ok + fehl} Prüfungen bestanden`);
  process.exit(fehl ? 1 : 0);
})();
