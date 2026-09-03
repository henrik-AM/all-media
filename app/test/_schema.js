// Prueft, ob der Server-Code nur Tabellen und Spalten anspricht, die es im
// Datenbankschema wirklich gibt.
//
// Warum es diesen Test gibt: Die Sync-Schicht der Website schrieb monatelang
// in erfundene Tabellen ("videos", "likes", "saves") und erfundene Spalten
// ("content_id", "is_archived", "creator_id"). Jeder Zugriff schlug fehl, der
// Fehler wurde abgefangen, die Website fiel still auf Beispieldaten zurueck —
// von aussen sah alles normal aus. Genau das faengt dieser Test ab.
//
// Start:  node test/_schema.js     (kein Server noetig)

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..', '..');
/*
 * Alle Schemadateien, und zwar von selbst gefunden.
 *
 * Hier stand bis zum 03.09.2026 eine Liste von Hand. Sie endete bei Schema
 * 11, waehrend die Datenbank bei 18 stand — die Dateien 6, 8, 9, 10 und 12
 * bis 18 waren dem Lauf unbekannt. Das faellt in beide Richtungen aus: eine
 * Tabelle aus Schema 15 galt als "gibt es nicht", und umgekehrt haette eine
 * dort geloeschte Spalte niemandem gefehlt.
 *
 * Eine handgepflegte Liste neben einer wachsenden Menge von Dateien wird
 * immer hinterherhinken. Also lieber lesen, was da ist.
 *
 * `SUPABASE_EINSPIELEN.sql` und die Reparaturdateien sind Sammlungen aus
 * denselben Anweisungen; doppelt gelesen schadet nicht, weil am Ende nur
 * eine Menge von Tabellen und Spalten herauskommt.
 */
const SQL_DATEIEN = fs
  .readdirSync(WURZEL)
  .filter((n) => n.startsWith('SUPABASE_') && n.endsWith('.sql'))
  .sort();/*
 * Beide Seiten, nicht nur eine.
 *
 * Die Website liest ueber web/server/, die App ueber app/lib/daten.ts und ein
 * paar Bildschirme, die selbst schreiben. Wuerde hier nur die Website stehen,
 * kaeme ein Tippfehler im App-Code erst im Betrieb heraus - und zwar still,
 * weil eine fehlgeschlagene Abfrage wie "es gibt nichts" aussieht.
 */
const QUELLEN = [
  'web/server/supabase-api.js',
  'web/server/sync-handlers.js',
  'app/lib/daten.ts',
  'app/components/CommentSheet.tsx',
  'app/screens/messenger/ChatDetailScreen.tsx',
];

let fehler = 0;
const pruefe = (name, bedingung, zusatz = '') => {
  if (!bedingung) fehler++;
  console.log((bedingung ? 'PASS  ' : 'FAIL  ') + name + (zusatz ? '  — ' + zusatz : ''));
};

// --------------------------------------------------- Schema einlesen -----

/** Liest aus den SQL-Dateien, welche Tabelle welche Spalten hat. */
function schemaLesen() {
  const tabellen = new Map();
  let sql = '';
  for (const datei of SQL_DATEIEN) {
    sql += fs.readFileSync(path.join(WURZEL, datei), 'utf8') + '\n';
  }

  // create table [if not exists] public.name ( ... );
  const anlegen = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)\s*\(([\s\S]*?)\n\)\s*;/gi;
  let treffer;
  while ((treffer = anlegen.exec(sql))) {
    const [, name, koerper] = treffer;
    const spalten = new Set();
    for (const zeile of koerper.split('\n')) {
      const sauber = zeile.trim();
      // Zeilen wie "primary key (...)", "unique (...)", "constraint ..." sind
      // keine Spalten.
      if (!sauber || sauber.startsWith('--')) continue;
      if (/^(primary|unique|constraint|foreign|check)\b/i.test(sauber)) continue;
      const spalte = sauber.match(/^(\w+)\s/);
      if (spalte) spalten.add(spalte[1]);
    }
    tabellen.set(name, spalten);
  }

  // alter table public.name add column if not exists spalte typ, ...
  const erweitern = /alter\s+table\s+public\.(\w+)\s*([\s\S]*?);/gi;
  while ((treffer = erweitern.exec(sql))) {
    const [, name, rest] = treffer;
    if (!tabellen.has(name)) continue;
    const spalten = tabellen.get(name);
    const hinzu = /add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)/gi;
    let s;
    while ((s = hinzu.exec(rest))) spalten.add(s[1]);
  }

  /*
   * Sichten (views) zaehlen genauso: aus PostgREST-Sicht ist
   * `hashtags_mit_anzahl` etwas, aus dem man mit .from() liest.
   *
   * Ihre Spalten werden hier nicht geprueft, sondern mit `null` als "alles
   * erlaubt" hinterlegt. Grund: die Spalten einer Sicht ergeben sich aus
   * ihrer Abfrage, und die zu zerlegen hiesse, ein Stueck SQL-Parser
   * nachzubauen. Geprueft wird das an anderer Stelle wirksamer - die Sicht
   * wird beim Einspielen von Postgres selbst uebersetzt, und der Prueflauf
   * gegen ein echtes Postgres (scratchpad/pgtest) faellt um, wenn sie nicht
   * uebersetzt.
   */
  const sicht = /create\s+or\s+replace\s+view\s+public\.(\w+)\s+as/gi;
  while ((treffer = sicht.exec(sql))) tabellen.set(treffer[1], null);

  return tabellen;
}

const schema = schemaLesen();

pruefe('Schema eingelesen', schema.size >= 20, schema.size + ' Tabellen');

// --------------------------------------------- Quellcode durchsehen -----

/**
 * Findet je Vorkommen von .from('tabelle') den zugehoerigen Abfrage-Abschnitt
 * und darin die verwendeten Spaltennamen.
 */
function verwendungen(quelltext) {
  const gefunden = [];
  const muster = /\.from\('(\w+)'\)/g;
  let treffer;

  while ((treffer = muster.exec(quelltext))) {
    const tabelle = treffer[1];
    // Der Abschnitt bis zum naechsten .from(...) oder 400 Zeichen — lang genug
    // fuer die Kette aus select/insert/eq, kurz genug, um nicht in die
    // naechste Abfrage zu rutschen.
    const ab = treffer.index + treffer[0].length;
    const naechstes = quelltext.indexOf(".from('", ab);
    const bis = naechstes === -1 ? Math.min(ab + 400, quelltext.length) : Math.min(naechstes, ab + 400);
    const abschnitt = quelltext.slice(ab, bis);

    const spalten = new Set();

    // .eq('spalte', ...) / .is(...) / .in(...) / .order('spalte'
    for (const m of abschnitt.matchAll(/\.(?:eq|neq|is|in|gt|lt|gte|lte|order)\('(\w+)'/g)) {
      spalten.add(m[1]);
    }

    // .insert({ spalte: ..., }) und .update({ ... }) und .upsert({ ... })
    for (const m of abschnitt.matchAll(/\.(?:insert|update|upsert)\(\{([\s\S]*?)\}/g)) {
      for (const f of m[1].matchAll(/(\w+)\s*:/g)) spalten.add(f[1]);
    }

    // .select('a, b, c') — verschachtelte Beziehungen wie "chats(...)" und
    // Zaehler wie "post_likes(count)" gehoeren nicht zu dieser Tabelle.
    const auswahl = abschnitt.match(/\.select\(\s*'([^']*)'/);
    if (auswahl) {
      const ohneBeziehungen = auswahl[1].replace(/\w+\s*\([^)]*\)/g, '');
      for (const teil of ohneBeziehungen.split(',')) {
        const name = teil.trim();
        if (name && name !== '*' && /^\w+$/.test(name)) spalten.add(name);
      }
    }

    gefunden.push({ tabelle, spalten, stelle: quelltext.slice(0, treffer.index).split('\n').length });
  }

  return gefunden;
}

const unbekannteTabellen = new Map();
const unbekannteSpalten = [];

for (const datei of QUELLEN) {
  const quelltext = fs.readFileSync(path.join(WURZEL, datei), 'utf8');

  for (const { tabelle, spalten, stelle } of verwendungen(quelltext)) {
    if (!schema.has(tabelle)) {
      if (!unbekannteTabellen.has(tabelle)) unbekannteTabellen.set(tabelle, []);
      unbekannteTabellen.get(tabelle).push(`${datei}:${stelle}`);
      continue;
    }

    const vorhanden = schema.get(tabelle);
    // null = eine Sicht, deren Spalten hier nicht geprueft werden.
    if (vorhanden === null) continue;
    for (const spalte of spalten) {
      if (!vorhanden.has(spalte)) {
        unbekannteSpalten.push(`${datei}:${stelle}  ${tabelle}.${spalte}`);
      }
    }
  }
}

pruefe(
  'Alle angesprochenen Tabellen gibt es im Schema',
  unbekannteTabellen.size === 0,
  [...unbekannteTabellen.entries()].map(([t, o]) => `${t} (${o.join(', ')})`).join('; ')
);

pruefe(
  'Alle angesprochenen Spalten gibt es im Schema',
  unbekannteSpalten.length === 0,
  unbekannteSpalten.slice(0, 8).join(' | ')
);

// Ein paar Namen, die es bewusst NICHT geben soll — sie waren die Erfindungen
// von damals und sollen nicht zurueckkommen.
for (const erfindung of ['videos', 'likes', 'favorites']) {
  pruefe(`Tabelle "${erfindung}" wird nicht mehr verwendet`, !unbekannteTabellen.has(erfindung));
}

console.log(fehler === 0 ? '\nSchema und Code passen zusammen.' : `\n${fehler} Pruefung(en) fehlgeschlagen.`);
process.exit(fehler === 0 ? 0 : 1);
