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


/* ==========================================================================
 *  Dieselbe Regel, dieselbe Funktion — in zwei Dateien
 *
 *  WARUM ES DAS GIBT
 *
 *  Am 18.09.2026 wurden nacheinander fuenf Regressionen ausgeloest, alle mit
 *  derselben Ursache: eine Schema-Datei wurde nachtraeglich noch einmal
 *  eingespielt, und `create or replace` beziehungsweise
 *  `drop policy` + `create policy` hat still die neuere Fassung aus einer
 *  ANDEREN Datei ueberschrieben.
 *
 *    starter_inhalte()     stand in Schema 7 UND 23_sicherheit
 *    finde_per_nummer()    stand in 23_audit, 24_telefon, 38, 39
 *    "Nachricht senden"    stand in SCHEMA.sql, 19 UND 21
 *    "Mitglieder hinzufuegen"  stand in SCHEMA.sql, 7 UND 22
 *    "Medien lesen"        stand in 7, 23_audit UND 24
 *
 *  Keine dieser Doppelungen meldet etwas. Die Datei laeuft durch, die
 *  Datenbank ist danach aelter als vorher, und auffaellig wird es erst, wenn
 *  irgendein Pruflauf an einer ganz anderen Stelle umfaellt.
 *
 *  Diese Pruefung findet die Doppelungen, bevor sie jemanden kostet. Sie
 *  verbietet sie nicht — manche sind gewollt, etwa wenn SCHEMA.sql die erste
 *  Fassung anlegt und eine spaetere Datei sie verschaerft. Sie verlangt nur,
 *  dass die spaetere Datei es WEISS: steht im Kopf der frueheren Datei eine
 *  Warnung, gilt die Doppelung als bekannt.
 * ======================================================================== */

const NUMMER = (name) => {
  const treffer = name.match(/SUPABASE_SCHEMA_(\d+)/);
  return treffer ? Number(treffer[1]) : 0;
};

const definitionen = new Map(); // "art:name" -> [Dateien]
/*
 * Sammeldateien bleiben draussen. `SUPABASE_EINSPIELEN.sql` und die
 * Reparaturdateien sind absichtlich Zusammenfassungen derselben Anweisungen —
 * dort IST jede Definition doppelt, und das ist ihr Zweck.
 */
const EINZELDATEIEN = SQL_DATEIEN.filter((n) => /^SUPABASE_SCHEMA/.test(n));

for (const kurz of EINZELDATEIEN) {
  const text = fs.readFileSync(path.join(WURZEL, kurz), 'utf8');

  for (const treffer of text.matchAll(/create\s+or\s+replace\s+function\s+public\.(\w+)/gi)) {
    const schluessel = `Funktion public.${treffer[1]}()`;
    if (!definitionen.has(schluessel)) definitionen.set(schluessel, []);
    if (!definitionen.get(schluessel).includes(kurz)) definitionen.get(schluessel).push(kurz);
  }
  for (const treffer of text.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+([\w.]+)/gi)) {
    const schluessel = `Regel "${treffer[1]}" auf ${treffer[2]}`;
    if (!definitionen.has(schluessel)) definitionen.set(schluessel, []);
    if (!definitionen.get(schluessel).includes(kurz)) definitionen.get(schluessel).push(kurz);
  }
  /*
   * Die blinde Stelle, gefunden am 20.09.2026.
   *
   * Bis hierher zaehlte nur, was als Funktion oder Regel DEFINIERT wird. Eine
   * Tabelle, die in zwei Dateien unterschiedlich BEFUELLT wird, war unsichtbar
   * — und genau das ist mit `vorlage_eigene_beitraege` passiert: Schema 8 gab
   * den Starterbeitraegen echte Videos, Schema 7 setzte die Platzhalter-PNGs
   * zurueck. 32 als Video deklarierte Beitraege zeigten danach auf eine
   * PNG-Datei, ohne dass irgendeine Pruefung anschlug.
   *
   * Beschraenkt auf `vorlage_*`: das sind die Vorlagentabellen des
   * Testbestands, also genau die Klasse, bei der „die letzte Datei gewinnt"
   * ueber den Inhalt entscheidet. `posts` oder `profiles` mit aufzunehmen
   * waere sinnlos — dort ist das Nacheinander der Zweck.
   */
  for (const treffer of text.matchAll(/(?:insert\s+into|update)\s+public\.(vorlage_\w+)/gi)) {
    const schluessel = `Bestand public.${treffer[1]}`;
    if (!definitionen.has(schluessel)) definitionen.set(schluessel, []);
    if (!definitionen.get(schluessel).includes(kurz)) definitionen.get(schluessel).push(kurz);
  }
}

/*
 * Eine Doppelung gilt als bekannt, wenn die FRUEHERE Datei im Kopf eine
 * Warnung traegt. Der Kopf sind die ersten 40 Zeilen — weiter unten liest sie
 * niemand, bevor er die Datei einspielt.
 */
/*
 * Bekannt ist, was in SUPABASE_REIHENFOLGE.md steht.
 *
 * Erst stand hier die Forderung, jede frueher definierende Datei muesse im
 * Kopf eine Warnung tragen. Bei 37 Doppelungen in 14 Dateien waeren das 14
 * Warnungen gewesen, die niemand liest — und die Frage „welche gilt denn
 * nun?" haette keine von ihnen beantwortet.
 *
 * Eine Liste an einer Stelle ist besser: sie sagt fuer jedes Objekt, welche
 * Datei zuletzt laeuft und damit gewinnt. Diese Pruefung schlaegt an, sobald
 * eine Doppelung entsteht, die dort nicht steht.
 */
const REIHENFOLGE = path.join(WURZEL, 'SUPABASE_REIHENFOLGE.md');
const bekannt = fs.existsSync(REIHENFOLGE) ? fs.readFileSync(REIHENFOLGE, 'utf8') : '';

const unbekannteDoppelungen = [];
for (const [schluessel, dateien] of definitionen) {
  if (dateien.length < 2) continue;
  const sortiert = [...dateien].sort((a, b) => NUMMER(a) - NUMMER(b));
  // Steht das Objekt mit genau dieser Kette in der Liste?
  if (!bekannt.includes(`| ${schluessel} | ${sortiert.join(' \u2192 ')} |`)) {
    unbekannteDoppelungen.push(`${schluessel}: ${sortiert.join(' -> ')}`);
  }
}

pruefe(
  'Jede doppelt definierte Funktion, Regel und Vorlage steht in SUPABASE_REIHENFOLGE.md',
  unbekannteDoppelungen.length === 0,
  unbekannteDoppelungen.join('\n     ')
);

console.log(fehler === 0 ? '\nSchema und Code passen zusammen.' : `\n${fehler} Pruefung(en) fehlgeschlagen.`);
process.exit(fehler === 0 ? 0 : 1);
