#!/usr/bin/env node
/**
 * Medien von Supabase Storage zu Bunny Storage umziehen.
 *
 * STAND 28.10.2026: Altmedienumzug freigegeben, Supabase-Originale bleiben erhalten.
 * Der echte Listen-Trockenlauf braucht einen nur serverseitigen Dienstschlüssel.
 *
 * WARUM SO VORSICHTIG
 *
 * Jedes Byte, das hier aus Supabase geholt wird, ist Egress — genau der
 * Zähler, der das Projekt am 10.10.2026 gesperrt hat (Free: 5 GB im Monat).
 * Darum:
 *   - Trockenlauf ist die Vorgabe. Er listet nur (kleine JSON-Antworten),
 *     lädt keine Datei und schreibt nichts zu Bunny.
 *   - Echt läuft es nur mit `--ausfuehren` UND einem ausdrücklichen
 *     Byte-Budget `--budget-mb`. Vor jeder Datei wird gegen ihre gelistete
 *     Größe geprüft; reicht das Budget nicht, hält das Skript an. Gezählt
 *     wird beim Empfang, Stück für Stück — auch bei Abbruch und auch die
 *     Liste. Die Datei wird per `Range` auf ihre gelistete Größe begrenzt.
 *     Überschreiten kann das Budget höchstens um das eine Stück, in dem die
 *     Grenze fällt; danach hält der Lauf an (Gegenprüfung 27.10., F2).
 *   - Mit `--quelle-ordner` kommen die Dateien aus einem lokalen Ordner
 *     (z. B. `.medien-cache/fertig/`) statt aus Supabase: null Egress für
 *     die Testmedien.
 *   - In Supabase Storage wird nichts gelöscht oder überschrieben.
 *     --umschalten schreibt nur den Anbieterbeleg in die Datenbank;
 *     die Quelldateien bleiben als Rückweg erhalten.
 *
 * FORTSETZEN
 *
 * Jede fertige Datei wird sofort als Zeile in die Zustandsdatei geschrieben
 * (`--zustand`, JSON je Zeile: pfad, bytes, sha256, typ, umschaltbar).
 * Bricht der Lauf ab, überspringt der nächste alles, was dort steht. Eine
 * halb geschriebene letzte Zeile wird vor dem Fortsetzen abgeschnitten,
 * sonst klebte der nächste Erfolg an ihr und ginge verloren (F3). Die
 * Zustandsdatei darf nicht im Repo liegen.
 *
 * KOPIE IST NICHT UMZUG (F1)
 *
 * Ohne `--umschalten` ist der Lauf nur eine KOPIE: Anzeige und Löschen
 * laufen weiter über Supabase, denn der Server schaltet einen Pfad erst
 * mit einem Eintrag in `medien_objekte` auf Bunny (`bunny_medium_anbieter`,
 * Schema 115/116). `--umschalten` (nur zusammen mit `--pruefen`) trägt jede in
 * diesem Lauf bei Bunny bestätigte Datei über die Dienst-RPC
 * `medien_umzug_registrieren` ein (SUPABASE_SCHEMA_116_bunny_altmedien.sql).
 * Die RPC übernimmt den Eigentümer aus Supabase; eigentümerlose gemeinsame
 * Beispielmedien bleiben ohne Eigentümer. Andere Dateien ohne Eigentümer und
 * ungültige Inhalte werden ausgelassen (WebM/MOV, zu groß).
 *
 * UNTERORDNER (F4)
 *
 * Beide Quellen werden rekursiv gelesen (`instants/<Nutzer>/<datei>.jpg`).
 * Was nicht zur Pfadregel passt, wird als `ausgelassen` gezählt und genannt.
 *
 * PRÜFSUMMEN
 *
 * - Supabase nennt für einfache Uploads die MD5 als eTag: stimmt die
 *   geladene Datei nicht damit (oder nicht mit der gelisteten Größe)
 *   überein, gilt sie als fehlerhaft und wird nicht als fertig vermerkt.
 * - Zu Bunny geht die SHA256 als Kopfzeile `Checksum` mit (bunny.js);
 *   Bunny weist eine veränderte Datei ab.
 * - `--pruefen` vergleicht danach die Größen in der Bunny-Liste.
 *   Der kontrollierte Live-Lauf in bunny-umzug-lauf.cjs prüft zusätzlich
 *   alle Bunny-Bytes per SHA256 und führt ein persistentes Gesamtbudget.
 *
 * DIE PFADE BLEIBEN GLEICH (`posts/<name>.mp4` hier wie dort). Darum muss in
 * der Datenbank keine Zeile umgeschrieben werden (siehe web/server/bunny.js).
 *
 * Aufruf:
 *   node tools/medien-umzug-bunny.mjs                         # Trockenlauf
 *   node tools/medien-umzug-bunny.mjs --ausfuehren --budget-mb 150 \
 *        --zustand ~/allmedia-umzug/zustand.jsonl [--pruefen] [--ordner posts,stories]
 *   node tools/medien-umzug-bunny.mjs --quelle-ordner .medien-cache/fertig ...
 *   ... --ausfuehren --pruefen --umschalten     # zusätzlich Anbieter umschalten
 *
 * Umgebung: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (nur lesen),
 *           BUNNY_STORAGE_ZONE, BUNNY_STORAGE_KEY, BUNNY_STORAGE_HOST,
 *           BUNNY_PULL_HOST, BUNNY_TOKEN_KEY.
 * Ausgang: 0 fertig/Trockenlauf, 1 Fehler, 2 falscher Aufruf, 3 Budget erreicht.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const Bunny = require('../web/server/bunny.js');

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEITE = 1000;
const ZEIT_LISTE_MS = 30 * 1000;
const ZEIT_DATEI_MS = 120 * 1000;

// Was nach dem Umstieg neu nicht mehr hochgeladen werden darf. Wird
// trotzdem kopiert (sonst verschwänden alte Beiträge), aber gezählt.
const NEU_ERLAUBT = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'audio/mp4'];

function leererZaehler() {
  return {
    gelistet: 0,
    gelistetBytes: 0,
    schonFertig: 0,
    offen: 0,
    offenBytes: 0,
    geholt: 0,
    geholtBytes: 0, // nur Dateien
    listeBytes: 0, // Antworten der Supabase-Liste, zählen auch als Egress
    hochgeladen: 0,
    fehler: 0,
    nichtMp4: 0,
    pruefAbweichungen: 0,
    ausgelassen: 0, // passt nicht zur Pfadregel, nicht kopiert
    umgeschaltet: 0, // in diesem Lauf auf Bunny umgeschaltet; 0 = nur Kopie
    umschaltAusgelassen: 0,
    status: 'trockenlauf',
  };
}

/* ---------------- Quellen ---------------- */

class BudgetErreicht extends Error {}

/*
 * Einen Antwortkörper lesen und jedes empfangene Stück sofort zählen —
 * auch wenn die Übertragung danach abbricht. Über `grenze` wird nicht
 * weitergelesen.
 */
async function leseGezaehlt(antwort, grenze, zaehle, grund) {
  const teile = [];
  let summe = 0;
  if (antwort.body) {
    const leser = antwort.body.getReader();
    for (;;) {
      const { done, value } = await leser.read();
      if (done) break;
      summe += value.length;
      zaehle(value.length);
      if (summe > grenze) {
        await leser.cancel().catch(() => {});
        throw grund(summe);
      }
      teile.push(value);
    }
  }
  return Buffer.concat(teile);
}

/** Supabase: Liste je Ordner, rekursiv und seitenweise. Gibt [{ pfad, bytes, typ, md5 }] zurück. */
async function listeSupabase({ basis, schluessel, ordner, abruf, zaehler, budgetBytes, melde }) {
  const eintraege = [];
  const offen = [...ordner];
  while (offen.length) {
    const o = offen.shift();
    for (let versatz = 0; ; versatz += SEITE) {
      const antwort = await abruf(`${basis}/storage/v1/object/list/media`, {
        method: 'POST',
        headers: { apikey: schluessel, Authorization: `Bearer ${schluessel}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: o, limit: SEITE, offset: versatz, sortBy: { column: 'name', order: 'asc' } }),
        signal: AbortSignal.timeout(ZEIT_LISTE_MS),
      });
      // Mit Budget zählt jede Liste mit; der Trockenlauf weist sie nur aus.
      const rest = budgetBytes > 0 ? budgetBytes - zaehler.listeBytes - zaehler.geholtBytes : Infinity;
      const text = (await leseGezaehlt(antwort, rest, (n) => (zaehler.listeBytes += n), () => new BudgetErreicht(`Liste ${o}`))).toString('utf8');
      if (!antwort.ok) throw new Error(`Supabase-Liste ${o}: Status ${antwort.status}`);
      const seite = JSON.parse(text);
      for (const e of seite) {
        if (!e || typeof e.name !== 'string') continue;
        if (!e.id) {
          // Unterordner (z. B. instants/<Nutzer>) — mitlesen, nicht verwerfen.
          if (/^[A-Za-z0-9._-]+$/.test(e.name) && e.name !== '.' && e.name !== '..') offen.push(`${o}/${e.name}`);
          else auslassen(zaehler, melde, `${o}/${e.name}`);
          continue;
        }
        const pfad = Bunny.pfadPruefen(`${o}/${e.name}`, Bunny.ORDNER_LESEN);
        if (!pfad) {
          auslassen(zaehler, melde, `${o}/${e.name}`);
          continue;
        }
        const md5 = String(e.metadata?.eTag || '').replace(/"/g, '');
        eintraege.push({
          pfad,
          bytes: Number(e.metadata?.size) || 0,
          typ: String(e.metadata?.mimetype || 'application/octet-stream'),
          md5: /^[0-9a-f]{32}$/.test(md5) ? md5 : null,
        });
      }
      if (seite.length < SEITE) break;
    }
  }
  return eintraege;
}

function auslassen(zaehler, melde, pfad) {
  zaehler.ausgelassen++;
  melde(`AUSGELASSEN ${pfad}: passt nicht zur Pfadregel, wird nicht kopiert.`);
}

const TYP_NACH_ENDUNG = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  m4a: 'audio/mp4', mp3: 'audio/mpeg', aac: 'audio/aac', wav: 'audio/wav',
};

/** Lokaler Ordner mit derselben Gliederung (`<ordner>/<datei>`, auch Unterordner). */
function listeOrdner({ wurzel, ordner, zaehler, melde }) {
  const eintraege = [];
  const gehe = (relativ) => {
    const verzeichnis = path.join(wurzel, relativ);
    for (const name of fs.readdirSync(verzeichnis).sort()) {
      const teil = `${relativ}/${name}`;
      const stat = fs.lstatSync(path.join(verzeichnis, name));
      if (stat.isDirectory()) {
        gehe(teil);
        continue;
      }
      const pfad = stat.isFile() ? Bunny.pfadPruefen(teil, Bunny.ORDNER_LESEN) : null;
      if (!pfad) {
        auslassen(zaehler, melde, teil);
        continue;
      }
      const endung = name.split('.').pop().toLowerCase();
      eintraege.push({ pfad, bytes: stat.size, typ: TYP_NACH_ENDUNG[endung] || 'application/octet-stream', md5: null });
    }
  };
  for (const o of ordner) if (fs.existsSync(path.join(wurzel, o))) gehe(o);
  return eintraege;
}

/*
 * Höchstens die gelistete Größe holen: `Range` begrenzt die Übertragung,
 * und ohne Range wird nach `bytes` abgebrochen. Jedes Stück zählt sofort.
 */
async function holeSupabase({ basis, schluessel, abruf }, e, zaehle) {
  const kopf = { apikey: schluessel, Authorization: `Bearer ${schluessel}` };
  if (e.bytes > 0) kopf.Range = `bytes=0-${e.bytes - 1}`;
  const antwort = await abruf(`${basis}/storage/v1/object/media/${e.pfad}`, { headers: kopf, signal: AbortSignal.timeout(ZEIT_DATEI_MS) });
  if (!antwort.ok) {
    await antwort.body?.cancel().catch(() => {});
    throw new Error(`Status ${antwort.status}`);
  }
  if (antwort.status === 206) {
    // Mit Range sähe eine gewachsene Datei sonst passend aus.
    const gesamt = Number(String(antwort.headers.get('content-range') || '').split('/')[1]);
    if (gesamt !== e.bytes) {
      await antwort.body?.cancel().catch(() => {});
      throw new Error(`Größe ${gesamt || '?'} statt gelistet ${e.bytes} Bytes`);
    }
  }
  return leseGezaehlt(antwort, e.bytes, zaehle, (n) => new Error(`mehr als gelistet (${n} statt ${e.bytes} Bytes)`));
}

/* ---------------- Zustand ---------------- */

/** Gibt { fertig: Map pfad → Eintrag, umgeschaltet: Set } zurück. */
function zustandLesen(datei) {
  const fertig = new Map();
  const umgeschaltet = new Set();
  if (!datei || !fs.existsSync(datei)) return { fertig, umgeschaltet };
  for (const zeile of fs.readFileSync(datei, 'utf8').split('\n')) {
    if (!zeile.trim()) continue;
    try {
      const e = JSON.parse(zeile);
      if (e && typeof e.pfad === 'string' && e.umgeschaltet === true) umgeschaltet.add(e.pfad);
      else if (e && typeof e.pfad === 'string' && /^[0-9a-f]{64}$/.test(e.sha256)) fertig.set(e.pfad, e);
    } catch {
      // Eine halb geschriebene letzte Zeile (Abbruch) zählt nicht als fertig.
    }
  }
  return { fertig, umgeschaltet };
}

/*
 * Vor dem ersten Anhängen: eine unvollständige letzte Zeile abschneiden.
 * Sonst landet der nächste Erfolg direkt dahinter und ist beim nächsten
 * Lesen ebenfalls kaputt (F3).
 */
function zustandReparieren(datei, melde) {
  if (!fs.existsSync(datei)) return;
  const inhalt = fs.readFileSync(datei);
  if (!inhalt.length || inhalt[inhalt.length - 1] === 0x0a) return;
  const ende = inhalt.lastIndexOf(0x0a) + 1;
  fs.truncateSync(datei, ende);
  melde(`Zustandsdatei: unvollständige letzte Zeile (${inhalt.length - ende} Bytes) entfernt.`);
}

/* ---------------- Der Umzug ---------------- */

/**
 * optionen:
 *   quelle      { art: 'supabase', basis, schluessel } | { art: 'ordner', wurzel }
 *   bunny       Adapter aus Bunny.erstelleBunny (nur für `ausfuehren` nötig)
 *   ordner      Liste der Ablagen (Vorgabe: alle samt `beispiel`)
 *   ausfuehren  false = Trockenlauf
 *   budgetBytes Obergrenze für Bytes aus Supabase (Liste + Dateien)
 *   zustand     Pfad der Zustandsdatei
 *   pruefen     nach dem Lauf Größen in Bunny vergleichen
 *   umschalten  async ({ pfad, typ, bytes, sha256 }) => { ok } | { ok: false, grund };
 *               nur mit `pruefen`; ohne ist der Lauf eine reine Kopie
 *   abruf, melde   für Tests
 */
export async function umziehen(optionen) {
  const {
    quelle,
    bunny,
    ordner = Bunny.ORDNER_LESEN,
    ausfuehren = false,
    maxDateien = Infinity,
    nurPfade = null, // optionaler Set: fester Altbestand, keine späteren Uploads
    budgetBytes = 0,
    zustand = null,
    pruefen = false,
    umschalten = null,
    abruf = fetch,
    melde = (t) => console.log(t),
  } = optionen;
  const zaehler = leererZaehler();
  const ausSupabase = quelle?.art === 'supabase';

  if (maxDateien !== Infinity && (!Number.isInteger(maxDateien) || maxDateien < 1)) throw new Error('--max-dateien muss eine positive ganze Zahl sein');

  if (ausfuehren) {
    if (!bunny || !bunny.bereit) throw new Error('Bunny ist nicht eingerichtet');
    if (!zustand) throw new Error('--zustand fehlt');
    if (ausSupabase && !(budgetBytes > 0)) throw new Error('--budget-mb fehlt (Egress!)');
    if (umschalten && !pruefen) throw new Error('--umschalten nur zusammen mit --pruefen');
    zustandReparieren(zustand, melde);
  }

  let liste;
  try {
    liste = ausSupabase
      ? await listeSupabase({ ...quelle, ordner, abruf, zaehler, budgetBytes: ausfuehren ? budgetBytes : 0, melde })
      : listeOrdner({ wurzel: quelle.wurzel, ordner, zaehler, melde });
  } catch (f) {
    if (!(f instanceof BudgetErreicht)) throw f;
    zaehler.status = 'budget';
    melde(`Budget erreicht beim Listen (${f.message}): ${mb(zaehler.listeBytes)} von ${mb(budgetBytes)} verbraucht. Nichts kopiert.`);
    return zaehler;
  }
  if (nurPfade) liste = liste.filter(e => nurPfade.has(e.pfad));
  const { fertig, umgeschaltet: schonUmgeschaltet } = zustandLesen(zustand);

  const offen = [];
  for (const e of liste) {
    zaehler.gelistet++;
    zaehler.gelistetBytes += e.bytes;
    if (!NEU_ERLAUBT.includes(e.typ)) zaehler.nichtMp4++;
    if (fertig.has(e.pfad)) zaehler.schonFertig++;
    else offen.push(e);
  }
  zaehler.offen = offen.length;
  zaehler.offenBytes = offen.reduce((s, e) => s + e.bytes, 0);

  if (!ausfuehren) {
    melde(`Trockenlauf: ${zaehler.gelistet} Dateien (${mb(zaehler.gelistetBytes)}), schon fertig ${zaehler.schonFertig}, offen ${zaehler.offen} (${mb(zaehler.offenBytes)}).`);
    if (ausSupabase) melde(`Ein echter Lauf holt bis zu ${mb(zaehler.offenBytes)} aus Supabase (Egress), Liste bisher ${mb(zaehler.listeBytes)}.`);
    if (zaehler.nichtMp4) melde(`${zaehler.nichtMp4} Dateien sind weder Bild noch MP4 (WebM/MOV/sonstiges) — werden kopiert, später umwandeln.`);
    return zaehler;
  }

  zaehler.status = 'fertig';
  const bestaetigtJetzt = new Map(); // pfad → Journaleintrag, unabhängig vom erneuten Lesen
  for (const e of offen.slice(0, maxDateien)) {
    let inhalt;
    if (ausSupabase) {
      // Budget VOR dem Laden, gegen die gelistete Größe.
      if (zaehler.listeBytes + zaehler.geholtBytes + e.bytes > budgetBytes) {
        zaehler.status = 'budget';
        melde(`Budget erreicht vor ${e.pfad}: ${mb(zaehler.listeBytes + zaehler.geholtBytes)} von ${mb(budgetBytes)} verbraucht.`);
        break;
      }
      try {
        inhalt = await holeSupabase({ ...quelle, abruf }, e, (n) => (zaehler.geholtBytes += n));
      } catch (f) {
        zaehler.fehler++;
        melde(`FEHLER holen ${e.pfad}: ${f.message}`);
        continue;
      }
    } else {
      inhalt = fs.readFileSync(path.join(quelle.wurzel, e.pfad));
    }
    zaehler.geholt++;

    if (inhalt.length !== e.bytes) {
      zaehler.fehler++;
      melde(`FEHLER ${e.pfad}: ${inhalt.length} statt ${e.bytes} Bytes`);
      continue;
    }
    if (e.md5 && crypto.createHash('md5').update(inhalt).digest('hex') !== e.md5) {
      zaehler.fehler++;
      melde(`FEHLER ${e.pfad}: MD5 passt nicht zum eTag`);
      continue;
    }
    const sha256 = crypto.createHash('sha256').update(inhalt).digest('hex');
    // Vier historische M4A-Uploads besitzen in Supabase irrtümlich image/jpeg.
    // Nur bei tatsächlich gültigen MP4-Audiobytes korrigieren, Quelle unverändert.
    const typ = e.pfad.startsWith('ptt/') && e.pfad.endsWith('.m4a') && e.typ === 'image/jpeg' &&
      !Bunny.inhaltPruefen('ptt', 'audio/mp4', inhalt) ? 'audio/mp4' : e.typ;
    const ergebnis = await bunny.hochladen(e.pfad, inhalt, typ, { pruefen: false });
    if (!ergebnis.ok) {
      zaehler.fehler++;
      melde(`FEHLER ablegen ${e.pfad}: ${ergebnis.error}`);
      continue;
    }
    zaehler.hochgeladen++;
    // Darf die Datei nach heutigen Regeln auf Bunny ausgeliefert werden?
    const ablage = e.pfad.split('/')[0];
    // Historische Ablagen dürfen gültige Altbilder enthalten (auch ptt).
    // Neue Uploadregeln bleiben im Server unverändert.
    const umschaltbar = Bunny.inhaltPruefen(ablage === 'beispiel' || (ablage === 'ptt' && typ.startsWith('image/')) ? 'posts' : ablage, typ, inhalt);
    const eintrag = { pfad: e.pfad, bytes: e.bytes, sha256, typ, umschaltbar: umschaltbar || true };
    fs.appendFileSync(zustand, JSON.stringify(eintrag) + '\n');
    bestaetigtJetzt.set(e.pfad, eintrag);
  }

  const bestaetigt = []; // bei Bunny mit richtiger Größe gefunden
  if (pruefen) {
    const soll = new Map(liste.map((e) => [e.pfad, e]));
    const alle = new Map([...zustandLesen(zustand).fertig, ...bestaetigtJetzt]);
    const zuPruefen = [...alle.values()].filter((e) => soll.has(e.pfad));
    // Je Verzeichnis eine Liste — auch instants/<Nutzer> (F4).
    const verzeichnisse = [...new Set(zuPruefen.map((e) => e.pfad.slice(0, e.pfad.lastIndexOf('/'))))];
    const groessen = new Map();
    for (const v of verzeichnisse) {
      const ist = await bunny.auflisten(v);
      for (const d of ist.ok ? ist.dateien : []) groessen.set(`${v}/${d.name}`, d.bytes);
    }
    for (const e of zuPruefen) {
      const quelleBytes = soll.get(e.pfad).bytes;
      if (groessen.get(e.pfad) !== quelleBytes) {
        zaehler.pruefAbweichungen++;
        melde(`ABWEICHUNG ${e.pfad}: Bunny ${groessen.get(e.pfad) ?? 'fehlt'}, Quelle ${quelleBytes} Bytes`);
      } else bestaetigt.push({ ...e, typ: e.typ || soll.get(e.pfad).typ });
    }
  }

  if (umschalten) {
    for (const e of bestaetigt) {
      if (schonUmgeschaltet.has(e.pfad)) continue;
      const grund = e.umschaltbar === true ? null : typeof e.umschaltbar === 'string' ? e.umschaltbar : 'ohne Inhaltsprüfung kopiert, neu kopieren';
      let ergebnis;
      try {
        ergebnis = grund ? { ok: false, grund } : await umschalten({ pfad: e.pfad, typ: e.typ, bytes: e.bytes, sha256: e.sha256 });
      } catch (f) {
        zaehler.fehler++;
        melde(`FEHLER umschalten ${e.pfad}: ${f.message}`);
        continue;
      }
      if (!ergebnis.ok) {
        zaehler.umschaltAusgelassen++;
        melde(`BLEIBT BEI SUPABASE ${e.pfad}: ${ergebnis.grund}`);
        continue;
      }
      zaehler.umgeschaltet++;
      fs.appendFileSync(zustand, JSON.stringify({ pfad: e.pfad, umgeschaltet: true }) + '\n');
    }
  } else if (zaehler.hochgeladen) {
    melde('NUR KOPIE: Anbieter bleibt Supabase — Anzeige und Löschen laufen weiter dort. Umschalten: --pruefen --umschalten.');
  }

  if (zaehler.fehler || zaehler.pruefAbweichungen) zaehler.status = zaehler.status === 'budget' ? 'budget' : 'fehler';
  melde(
    `Umzug: ${zaehler.hochgeladen}/${zaehler.offen} abgelegt, ${zaehler.fehler} Fehler, ${zaehler.schonFertig} schon fertig, ` +
      `aus Supabase ${mb(zaehler.listeBytes + zaehler.geholtBytes)}` +
      (pruefen ? `, Prüfung: ${zaehler.pruefAbweichungen} Abweichungen` : '') +
      (zaehler.ausgelassen ? `, ${zaehler.ausgelassen} ausgelassen (Pfadregel)` : '') +
      (umschalten ? `, umgeschaltet ${zaehler.umgeschaltet}, bleiben bei Supabase ${zaehler.umschaltAusgelassen}` : ', nur Kopie') +
      ` — ${zaehler.status}.`
  );
  return zaehler;
}

function mb(bytes) {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/* ---------------- Aufruf von der Kommandozeile ---------------- */

function argumente(liste) {
  const a = { ausfuehren: false, pruefen: false };
  for (let i = 0; i < liste.length; i++) {
    const w = liste[i];
    if (w === '--trockenlauf') a.ausfuehren = false;
    else if (w === '--ausfuehren') a.ausfuehren = true;
    else if (w === '--pruefen') a.pruefen = true;
    else if (w === '--umschalten') a.umschalten = true;
    else if (w === '--max-dateien') a.maxDateien = Number(liste[++i]);
    else if (w === '--budget-mb') a.budgetMb = Number(liste[++i]);
    else if (w === '--zustand') a.zustand = liste[++i];
    else if (w === '--quelle-ordner') a.quelleOrdner = liste[++i];
    else if (w === '--ordner') a.ordner = String(liste[++i] || '').split(',').filter(Boolean);
    else throw new Error(`Unbekannt: ${w}`);
  }
  return a;
}

async function main() {
  let a;
  try {
    a = argumente(process.argv.slice(2));
  } catch (f) {
    console.error(f.message);
    process.exit(2);
  }
  if (a.ordner && a.ordner.some((o) => !Bunny.ORDNER_LESEN.includes(o))) {
    console.error('Unbekannter Ordner. Erlaubt:', Bunny.ORDNER_LESEN.join(', '));
    process.exit(2);
  }
  if (a.zustand) {
    a.zustand = path.resolve(a.zustand.replace(/^~(?=\/)/, os.homedir()));
    if (a.zustand.startsWith(WURZEL + path.sep)) {
      console.error('Die Zustandsdatei gehört nicht ins Repo.');
      process.exit(2);
    }
  }

  const supabaseBasis = String(process.env.SUPABASE_URL || 'https://ijztosbjfybdgotpdixw.supabase.co').replace(/\/$/, '');
  const dienstSchluessel = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  let umschalten = null;
  if (a.umschalten) {
    if (!dienstSchluessel) {
      console.error('--umschalten braucht SUPABASE_SERVICE_ROLE_KEY.');
      process.exit(2);
    }
    // Dienst-RPC aus SUPABASE_SCHEMA_116_bunny_altmedien.sql; Antwort 'bunny' oder 'ausgelassen: <grund>'.
    umschalten = async (e) => {
      const antwort = await fetch(`${supabaseBasis}/rest/v1/rpc/medien_umzug_registrieren`, {
        method: 'POST',
        headers: { apikey: dienstSchluessel, Authorization: `Bearer ${dienstSchluessel}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_pfad: e.pfad, p_typ: e.typ, p_bytes: e.bytes, p_sha256: e.sha256 }),
        signal: AbortSignal.timeout(ZEIT_LISTE_MS),
      });
      if (!antwort.ok) throw new Error(`Registrierung: Status ${antwort.status}`);
      const wert = String(await antwort.json());
      return wert === 'bunny' ? { ok: true } : { ok: false, grund: wert.replace(/^ausgelassen:\s*/, '') };
    };
  }

  let quelle;
  if (a.quelleOrdner) {
    quelle = { art: 'ordner', wurzel: path.resolve(a.quelleOrdner) };
  } else {
    if (!dienstSchluessel) {
      console.error('SUPABASE_SERVICE_ROLE_KEY fehlt (oder --quelle-ordner angeben).');
      process.exit(2);
    }
    quelle = { art: 'supabase', basis: supabaseBasis, schluessel: dienstSchluessel };
  }

  const konfig = Bunny.konfigurationAus(process.env);
  if (a.ausfuehren && !konfig.ok) {
    console.error('Bunny nicht eingerichtet, es fehlen:', konfig.fehlt.join(', '));
    process.exit(2);
  }

  try {
    const z = await umziehen({
      quelle,
      bunny: konfig.ok ? Bunny.erstelleBunny(konfig) : null,
      ordner: a.ordner,
      ausfuehren: a.ausfuehren,
      maxDateien: a.maxDateien,
      budgetBytes: Number.isFinite(a.budgetMb) ? Math.floor(a.budgetMb * 1048576) : 0,
      zustand: a.zustand || null,
      pruefen: a.pruefen,
      umschalten,
    });
    console.log(JSON.stringify(z));
    process.exit(z.status === 'budget' ? 3 : z.status === 'fehler' ? 1 : 0);
  } catch (f) {
    console.error('Umzug abgebrochen:', f.message);
    process.exit(f.message.includes('fehlt') ? 2 : 1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
