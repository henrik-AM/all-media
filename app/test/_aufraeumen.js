#!/usr/bin/env node
/**
 * Hinter dem Pruefdurchgang aufraeumen: seine Mitteilungen wieder entfernen.
 *
 * WARUM ES DAS GIBT
 *
 * Jeder Lauf folgt, liked, kommentiert und tritt Communitys bei. Seit den
 * Mitteilungs-Ausloesern (Schema 44/49) entsteht dabei jedes Mal eine Zeile in
 * `notifications` — und die bleibt liegen. Am 21.09.2026 standen dort 80.533
 * Zeilen, 79.785 davon vom Pruefkonto. Henriks eigene Glocke zeigte 14.125
 * ungelesene Meldungen: unbenutzbar, obwohl kein einziger Fehler im Spiel war.
 * Die Tabelle belegte 19 MB, nach dem Aufraeumen 192 kB.
 *
 * `zuruecksetzen()` reicht dagegen nicht. Es raeumt nur das Konto auf, das
 * gerade zuruecksetzt — die Zeilen bei den *Empfaengern* bleiben stehen, und
 * genau das sind die vielen.
 *
 * WARUM UEBER DIE MANAGEMENT-API UND NICHT IN DER DATENBANK
 *
 * Eine Datenbankfunktion mit SECURITY DEFINER waere der naheliegende Weg,
 * bedeutet aber ein neues Objekt mit erhoehten Rechten, das Postgres per
 * EXECUTE erst einmal an PUBLIC gibt (siehe test/_rechte.js). Fuer reines
 * Aufraeumen nach einem Pruefdurchgang ist das zu viel Angriffsflaeche. Hier
 * passiert es darum von aussen, mit dem Token, den der Gesamtlauf ohnehin
 * braucht.
 *
 * WAS ES AUSDRUECKLICH NICHT ANFASST
 *
 * Nur `notifications`, und dort nur Zeilen mit dem Pruefkonto als Ausloeser
 * oder Empfaenger. Likes, Kommentare, Beitraege, Chats und alles an echten
 * Konten bleiben unberuehrt — ein Like muss am naechsten Morgen noch da sein.
 *
 * Start einzeln:  SUPABASE_TOKEN=… node test/_aufraeumen.js
 * Im Gesamtlauf:  automatisch am Ende von test/alles.js
 */

const fs = require('fs');
const path = require('path');

/** Zaehlt, wie viele Mitteilungen des Pruefkontos gerade herumliegen. */
async function zaehlen() {
  return frage('select count(*) as anzahl from notifications where actor_id in (select id from auth.users where email = $KONTO) or user_id in (select id from auth.users where email = $KONTO)');
}

/** Eine SQL-Abfrage ueber die Management-API stellen. */
async function frage(sql) {
  const { token, projekt, konto } = umgebung();
  if (!token || !projekt) return null;

  const antwort = await fetch(`https://api.supabase.com/v1/projects/${projekt}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql.replaceAll('$KONTO', `'${konto.replace(/'/g, "''")}'`) }),
    signal: AbortSignal.timeout(30000),
  });
  return antwort.json();
}

function umgebung() {
  const datei = path.join(__dirname, '..', '.env.local');
  const inhalt = fs.existsSync(datei) ? fs.readFileSync(datei, 'utf8') : '';
  const url =
    process.env.SUPABASE_URL || (inhalt.match(/^EXPO_PUBLIC_SUPABASE_URL=(.*)$/m) || [])[1] || '';
  return {
    token: process.env.SUPABASE_TOKEN,
    projekt: (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || '',
    konto: process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de',
  };
}

async function aufraeumen() {
  const { token, projekt } = umgebung();
  if (!token || !projekt) {
    console.log(
      '\n  Nicht aufgeraeumt — ohne SUPABASE_TOKEN bleiben die Mitteilungen dieses\n' +
        '  Laufs stehen. Sie sammeln sich und fluten die Glocke echter Konten.'
    );
    return null;
  }

  try {
    // Beide Richtungen: ausgeloest *vom* Pruefkonto und empfangen *von* ihm.
    const ergebnis = await frage(`
      with weg as (
        delete from notifications
         where actor_id in (select id from auth.users where email = $KONTO)
            or user_id  in (select id from auth.users where email = $KONTO)
        returning 1
      )
      select count(*) as geloescht from weg`);

    const anzahl = Array.isArray(ergebnis) ? ergebnis[0]?.geloescht : null;
    if (anzahl === null || anzahl === undefined) {
      console.log(`\n  Aufraeumen fehlgeschlagen: ${JSON.stringify(ergebnis).slice(0, 200)}`);
      return null;
    }
    console.log(`\n  Aufgeraeumt: ${anzahl} Mitteilungen dieses Laufs entfernt.`);
    return Number(anzahl);
  } catch (fehler) {
    console.log(`\n  Aufraeumen fehlgeschlagen: ${fehler.message}`);
    return null;
  }
}

module.exports = { aufraeumen, zaehlen, frage };

// Direkt aufgerufen: einmal aufraeumen und nachzaehlen, ob wirklich nichts
// mehr dasteht. Eine Erfolgsmeldung allein ist kein Nachweis.
if (require.main === module) {
  (async () => {
    const vorher = await zaehlen();
    console.log(`  Vorher liegen ${vorher?.[0]?.anzahl ?? '?'} Mitteilungen des Pruefkontos da.`);
    await aufraeumen();
    const nachher = await zaehlen();
    const rest = Number(nachher?.[0]?.anzahl ?? -1);
    console.log(`  Nachher: ${rest}`);
    console.log(rest === 0 ? '  OK   Nichts mehr uebrig.' : `  FEHL Es liegen noch ${rest} da.`);
    process.exit(rest === 0 ? 0 : 1);
  })();
}
