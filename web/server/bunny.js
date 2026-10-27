/**
 * Medien bei Bunny.net ablegen und unterschreiben.
 *
 * Festgelegt 26.10.2026 (Henrik): Bunny Storage + Pull Zone mit Token,
 * Videos als MP4, Supabase Free bleibt für die Datenbank. Hintergrund:
 * Supabase hat am 10.10.2026 wegen 7,98 GB Cached Egress gesperrt — die
 * Datenbank war winzig, teuer war allein das Ausliefern der Dateien.
 *
 * medien.js aktiviert diesen Adapter bei gesetzten BUNNY_*-Variablen. Kein Konto, keine Schlüssel in der App.
 * Rückweg für Uploads: Supabase; BUNNY_BESTAND_LESEN=an hält bestehende Bunny-Dateien lesbar.
 *
 * GLEICHE FORM WIE medien.js
 *
 * Zurück kommt `{ ok, error }` oder `{ ok: true, url, anzeige, pfad }`:
 *   url      die beständige Form für die DATENBANK — bewusst weiter die
 *            Supabase-Form `…/storage/v1/object/public/media/<pfad>`, die
 *            `medien_adresse()` (Schema 95) baut. So bleiben die Zeilen,
 *            `medien_adresse_gueltig`, `pfadAus` und die Prüfauslöser aus
 *            Schema 107 unverändert; der Pfad ist der Schlüssel, nicht der
 *            Anbieter. Keine Datenwanderung.
 *   anzeige  die von Bunny unterschriebene Adresse zum sofortigen Anzeigen.
 *
 * DIE ZWEI SCHLÜSSEL
 *
 * BUNNY_STORAGE_KEY ist das Passwort der Speicherzone (Kopfzeile
 * `AccessKey`), BUNNY_TOKEN_KEY der Token-Schlüssel der Pull Zone. Beide
 * bleiben auf dem Server. Sie stehen nie in einer Meldung, nie im
 * Protokoll und nie in einer Rückgabe — auch eine unterschriebene Adresse
 * wird nicht protokolliert, denn sie ist bis zum Ablauf ein Schlüssel.
 *
 * Quellen (abgerufen 26.10.2026):
 *   https://bunny.net/docs/storage/http.md
 *   https://bunny.net/docs/cdn/security/token-authentication/advanced.md
 *   Prüfwerte: github.com/BunnyWay/BunnyCDN.TokenAuthentication, e2e/vectors.json
 */

const crypto = require('crypto');

// Videogrenze — dieselbe Zahl wie in App und Browser (Kasten 15).
const StoryRegeln = require('../../gemeinsam/story');

/*
 * Die Ablagen. Dieselbe Liste wie ORDNER in medien.js und Ordner in
 * app/lib/supabaseStorage.ts; `beispiel` sind die festen Testmedien
 * (Schema 43/45), die nur der Umzug kopiert und jeder sehen darf.
 */
const ORDNER = ['messages', 'stories', 'avatars', 'posts', 'insights', 'ptt', 'instants'];
const ORDNER_LESEN = [...ORDNER, 'beispiel', '_probe'];

/*
 * Was hochgeladen werden darf: Bilder und MP4. Kein WebM, kein MOV mehr —
 * Henriks Festlegung, damit jedes Video ohne Umwandlung auf iOS, Android
 * und im Browser abspielt.
 *
 * Ausnahme `ptt`: Push-to-Talk nimmt in der App `.m4a` auf
 * (app/lib/useAktionen.ts). Das ist ebenfalls ein MP4-Behälter (Ton ohne
 * Bild); ohne ihn wäre Push-to-Talk nach dem Umstieg stumm. Darum dort
 * `audio/mp4`, sonst nirgends. (Offene Frage im Bericht.)
 */
const BILDTYPEN = ['image/jpeg', 'image/png', 'image/webp'];
const TYPEN_JE_ORDNER = {
  messages: [...BILDTYPEN, 'video/mp4'],
  stories: [...BILDTYPEN, 'video/mp4'],
  posts: [...BILDTYPEN, 'video/mp4'],
  insights: [...BILDTYPEN, 'video/mp4'],
  avatars: BILDTYPEN,
  ptt: ['audio/mp4'],
  instants: ['image/jpeg'],
};

/*
 * Grenzen. Video: VIDEO_BYTES_HOECHSTENS (50 MB, die Grenze des alten
 * Eimers, Schema 23). Bild: 10 MB — die Website schickt Bilder nach
 * `bildVerkleinern` ohnehin unter 2 MB (express.json), die App liefert
 * Kamerafotos; mehr braucht kein Profilbild.
 */
const BILD_BYTES_HOECHSTENS = 10 * 1024 * 1024;
const GRENZE_JE_TYP = (typ) => (typ.startsWith('image/') ? BILD_BYTES_HOECHSTENS : StoryRegeln.VIDEO_BYTES_HOECHSTENS);

/*
 * Zeitgrenzen. Ein hängender Speicher darf keine Anfrage der Website
 * festhalten. Hochladen bekommt mehr Zeit, weil 50 MB bei schwacher
 * Leitung dauern.
 */
const ZEIT_HOCHLADEN_MS = 120 * 1000;
const ZEIT_SONST_MS = 15 * 1000;

/*
 * Ablauf in festen Fenstern.
 *
 * Der Ablauf wird auf die nächste volle Stunde AUFGERUNDET. Ohne das bekäme
 * jede Anfrage einen neuen `expires`-Wert, also eine neue Adresse — für den
 * Browser jedes Mal eine „neue" Datei. Genau das war im September das
 * Signier-Leck (44 MB Speicher, 7,2 GB Egress, siehe medien.js). Mit Fenster
 * ist die Adresse für denselben Pfad eine Stunde lang dieselbe; gültig ist
 * sie mindestens `sekunden`, höchstens `sekunden` + eine Stunde.
 */
const FENSTER_S = 60 * 60;
const STANDARD_SEKUNDEN = 4 * 60 * 60;

const OEFFENTLICH = '/storage/v1/object/public/media/';
const STANDARD_SUPABASE = 'https://ijztosbjfybdgotpdixw.supabase.co';

/*
 * Die Speicher-Hosts laut Doku (Region der Speicherzone). Ein Tippfehler im
 * Host schickte den AccessKey an eine fremde Adresse — darum nur diese,
 * und `http` nur für den lokalen Nachbau im Test.
 */
const SPEICHER_HOSTS = [
  'storage.bunnycdn.com',
  'uk.storage.bunnycdn.com',
  'ny.storage.bunnycdn.com',
  'la.storage.bunnycdn.com',
  'sg.storage.bunnycdn.com',
  'se.storage.bunnycdn.com',
  'br.storage.bunnycdn.com',
  'jh.storage.bunnycdn.com',
  'syd.storage.bunnycdn.com',
];

function istLokal(host) {
  return /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host);
}

/** `storage.bunnycdn.com` oder `https://…` → Basisadresse ohne Schrägstrich am Ende, oder null. */
function basisAus(wert, erlaubt) {
  let adresse;
  try {
    adresse = new URL(/^https?:\/\//.test(wert) ? wert : `https://${wert}`);
  } catch {
    return null;
  }
  if (adresse.pathname !== '/' || adresse.search || adresse.hash || adresse.username || adresse.password) return null;
  if (adresse.protocol === 'http:' && !istLokal(adresse.host)) return null;
  if (adresse.protocol !== 'https:' && adresse.protocol !== 'http:') return null;
  if (erlaubt && !istLokal(adresse.host) && !erlaubt.includes(adresse.hostname)) return null;
  return `${adresse.protocol}//${adresse.host}`;
}

/**
 * Konfiguration aus den Umgebungsvariablen. Gibt `{ ok: false, fehlt }` mit
 * den NAMEN der fehlenden oder ungültigen Variablen zurück — nie ihre Werte.
 */
function konfigurationAus(umgebung = process.env) {
  const fehlt = [];
  const zone = String(umgebung.BUNNY_STORAGE_ZONE || '').trim();
  if (!/^[A-Za-z0-9-]{1,64}$/.test(zone)) fehlt.push('BUNNY_STORAGE_ZONE');
  const speicherSchluessel = String(umgebung.BUNNY_STORAGE_KEY || '').trim();
  if (!speicherSchluessel) fehlt.push('BUNNY_STORAGE_KEY');
  const speicher = basisAus(String(umgebung.BUNNY_STORAGE_HOST || 'storage.bunnycdn.com').trim(), SPEICHER_HOSTS);
  if (!speicher) fehlt.push('BUNNY_STORAGE_HOST');
  const auslieferung = basisAus(String(umgebung.BUNNY_PULL_HOST || '').trim(), null);
  if (!umgebung.BUNNY_PULL_HOST || !auslieferung) fehlt.push('BUNNY_PULL_HOST');
  const tokenSchluessel = String(umgebung.BUNNY_TOKEN_KEY || '').trim();
  if (!tokenSchluessel) fehlt.push('BUNNY_TOKEN_KEY');
  const dauerBasis = basisAus(String(umgebung.SUPABASE_URL || STANDARD_SUPABASE).trim(), null);
  if (!dauerBasis) fehlt.push('SUPABASE_URL');
  if (fehlt.length) return { ok: false, fehlt };
  return { ok: true, zone, speicherSchluessel, speicher, auslieferung, tokenSchluessel, dauerBasis };
}

/*
 * Pfade. Dieselbe Regel wie `pfadAus` in medien.js: genau `ordner/datei`,
 * Datei nur aus [A-Za-z0-9._-], kein `..`. Wichtig vor allem beim Löschen:
 * Bunny löscht ein VERZEICHNIS samt Inhalt. `loeschen('posts/')` darf nie
 * beim Speicher ankommen.
 */
function pfadPruefen(pfad, ordnerListe = ORDNER) {
  if (typeof pfad !== 'string') return null;
  if (pfad.startsWith('instants/')) return ordnerListe.includes('instants') && /^instants\/[0-9a-f-]{36}\/[A-Za-z0-9_-]+\.jpg$/.test(pfad) ? pfad : null;
  if (!/^(?:[a-z]+|_probe)\/[A-Za-z0-9._-]+$/.test(pfad) || pfad.includes('..')) return null;
  const [ordner, datei] = pfad.split('/');
  if (!ordnerListe.includes(ordner)) return null;
  if (datei.startsWith('.')) return null;
  return pfad;
}

/** Inhaltstyp ohne Zusatz („video/mp4;codecs=…" → „video/mp4"), klein. */
function reinerTyp(typ) {
  return String(typ || '').split(';')[0].trim().toLowerCase();
}

/*
 * Die ersten Bytes müssen zum angegebenen Typ passen. Der Typ kommt vom
 * Gerät; ohne diese Prüfung ginge eine HTML-Datei als „image/jpeg" durch
 * und läge danach unter einer Adresse unserer Pull Zone.
 */
function inhaltPasst(typ, inhalt) {
  const b = inhalt;
  if (typ === 'image/jpeg') return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (typ === 'image/png') return b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (typ === 'image/webp') return b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP';
  // MP4-Behälter (auch .m4a): ab Byte 4 steht „ftyp".
  if (typ === 'video/mp4' || typ === 'audio/mp4') return b.length > 12 && b.toString('latin1', 4, 8) === 'ftyp' && /^(isom|iso[2-9]|mp4[12]|avc1|M4[AV] |dash|MSNV)$/.test(b.toString('latin1',8,12));
  return false;
}

/**
 * Typ- und Größenprüfung. Gibt den Grund als Satz zurück, sonst null.
 * Die Sätze sind die, die der Nutzer sieht.
 */
function inhaltPruefen(ordner, typ, inhalt) {
  if (!Buffer.isBuffer(inhalt)) return 'Das ist keine lesbare Aufnahme';
  if (!inhalt.length) return 'Die Aufnahme ist leer';
  const erlaubt = TYPEN_JE_ORDNER[ordner] || [];
  if (!erlaubt.includes(typ)) {
    return ordner === 'ptt'
      ? 'Diese Sprachaufnahme geht nicht. Erlaubt ist M4A.'
      : ordner === 'avatars'
        ? 'Dieses Bildformat geht nicht. Erlaubt sind JPEG, PNG und WebP.'
        : 'Dieses Format geht nicht. Erlaubt sind JPEG, PNG, WebP und MP4.';
  }
  const grenze = ordner === 'instants' ? 250 * 1024 : GRENZE_JE_TYP(typ);
  if (inhalt.length > grenze) {
    return `Die Datei ist zu groß (${Math.ceil(inhalt.length / 1048576)} MB, höchstens ${Math.round(grenze / 1048576)} MB).`;
  }
  if (!inhaltPasst(typ, inhalt)) return 'Die Datei passt nicht zu ihrem Format';
  return null;
}

/* ------------------------------------------------------------------ */
/* Token-Rechnung (Advanced Token Authentication, HMAC-SHA256)         */
/* ------------------------------------------------------------------ */

/*
 * Nach der offiziellen Doku:
 *
 *   token = "HS256-" + Base64URL(HMAC-SHA256(token_schluessel,
 *             signatur_pfad + expires + signierdaten))
 *
 * signatur_pfad  der Pfad der Adresse, oder token_path, wenn gesetzt
 * signierdaten   alle weiteren Parameter alphabetisch, `k=v` mit `&`,
 *                ohne `token` und `expires`, Werte ROH (in der Adresse
 *                stehen sie URL-kodiert)
 *
 * Keine IP-Bindung: mobile Netze wechseln die Adresse, die Doku warnt
 * selbst davor, und die Pull Zone müsste dafür auf eine Adressfamilie
 * festgelegt werden. Darum fehlt hier der Teil `user_ip` und das Kennzeichen
 * `1-`.
 *
 * Eigene Umsetzung, geprüft gegen die Prüfwerte des offiziellen
 * Bunny-Repos (app/test/_bunny_einheit.js).
 */
function tokenRechnen({ schluessel, pfad, ablauf, parameter = {}, tokenPfad = '' }) {
  const alle = { ...parameter };
  if (tokenPfad) alle.token_path = tokenPfad;
  const sortiert = Object.entries(alle).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const signierdaten = sortiert.map(([k, v]) => `${k}=${v}`).join('&');
  const hmac = crypto.createHmac('sha256', schluessel);
  hmac.update(tokenPfad || pfad);
  hmac.update(String(ablauf));
  hmac.update(signierdaten);
  const token = 'HS256-' + hmac.digest('base64url');
  const angehaengt = sortiert.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return { token, angehaengt };
}

/**
 * Die ganze unterschriebene Adresse.
 *
 * `verzeichnis: true` legt den Token in den Pfad (`/bcdn_token=…/pfad`).
 * Den braucht nur HLS (Bunny Stream, der Rückfall aus Henriks Festlegung):
 * der Spieler löst die Segmente relativ zur Liste auf und trägt den Token
 * so automatisch mit. Für eine MP4-Datei genügt die Query-Form.
 */
function adresseBauen({ basis, schluessel, pfad, ablauf, parameter = {}, tokenPfad = '', verzeichnis = false }) {
  const { token, angehaengt } = tokenRechnen({ schluessel, pfad, ablauf, parameter, tokenPfad });
  const rest = angehaengt ? `&${angehaengt}` : '';
  return verzeichnis
    ? `${basis}/bcdn_token=${token}${rest}&expires=${ablauf}${pfad}`
    : `${basis}${pfad}?token=${token}${rest}&expires=${ablauf}`;
}

/** Ablauf auf das nächste volle Fenster aufgerundet (siehe FENSTER_S). */
function ablaufFuer(sekunden, jetztMs = Date.now()) {
  const ziel = Math.floor(jetztMs / 1000) + sekunden;
  return Math.ceil(ziel / FENSTER_S) * FENSTER_S;
}

/* ------------------------------------------------------------------ */
/* Adressen aus der Datenbank (Supabase-Form) erkennen                  */
/* ------------------------------------------------------------------ */

/** Wie in medien.js: der GANZE Wert muss eine Adresse aus unserem Eimer sein. */
function istMedienAdresse(wert) {
  return typeof wert === 'string' && /^https?:\/\/\S+$/.test(wert) && wert.includes(OEFFENTLICH);
}

/** Aus der beständigen Adresse den Pfad holen — oder null. */
function pfadAus(adresse) {
  const stelle = adresse.indexOf(OEFFENTLICH);
  if (stelle === -1) return null;
  let pfad;
  try {
    pfad = decodeURIComponent(adresse.slice(stelle + OEFFENTLICH.length).split(/[?#]/)[0]);
  } catch {
    return null;
  }
  return pfadPruefen(pfad, ORDNER_LESEN);
}

/* ------------------------------------------------------------------ */
/* Der Adapter                                                          */
/* ------------------------------------------------------------------ */

/**
 * Einen Adapter für eine Konfiguration bauen. Die Tests reichen hier den
 * lokalen Nachbau herein; der Server nimmt `konfigurationAus(process.env)`.
 */
function erstelleBunny(konfig, { abruf = fetch, jetzt = () => Date.now() } = {}) {
  const bereit = Boolean(konfig && konfig.ok);
  const NICHT_BEREIT = { ok: false, error: 'Der Medienspeicher ist nicht eingerichtet' };

  function speicherAdresse(pfad) {
    return `${konfig.speicher}/${encodeURIComponent(konfig.zone)}/${pfad}`;
  }

  /*
   * Eine Anfrage an den Speicher. Fehler werden auf feste Sätze abgebildet:
   * die Antwort des Speichers, die Adresse und die Kopfzeilen tauchen in
   * keiner Meldung auf.
   */
  async function anfrage(methode, pfad, { inhalt, kopf = {}, zeit = ZEIT_SONST_MS, signal } = {}) {
    try {
      const antwort = await abruf(speicherAdresse(pfad), {
        method: methode,
        headers: { AccessKey: konfig.speicherSchluessel, ...kopf },
        body: inhalt,
        signal: signal ? AbortSignal.any([signal,AbortSignal.timeout(zeit)]) : AbortSignal.timeout(zeit),
        redirect: 'error',
      });
      return { status: antwort.status, antwort };
    } catch (fehler) {
      const zeitUm = fehler && (fehler.name === 'TimeoutError' || fehler.name === 'AbortError');
      return { status: 0, grund: zeitUm ? 'Zeitüberschreitung' : 'nicht erreichbar' };
    }
  }

  function dauerAdresse(pfad) {
    return `${konfig.dauerBasis}${OEFFENTLICH}${pfad}`;
  }

  /** Unterschriebene Adresse für einen Pfad, gültig mindestens `sekunden`. */
  function signierteAdresse(pfad, sekunden = STANDARD_SEKUNDEN) {
    if (!bereit) return null;
    const geprueft = pfadPruefen(pfad, ORDNER_LESEN);
    if (!geprueft) return null;
    const dauer = Number.isFinite(sekunden) && sekunden > 0 ? Math.min(Math.floor(sekunden), 7 * 24 * 60 * 60) : STANDARD_SEKUNDEN;
    return adresseBauen({
      basis: konfig.auslieferung,
      schluessel: konfig.tokenSchluessel,
      pfad: `/${geprueft}`,
      ablauf: dauer <= 60 ? Math.floor(jetzt() / 1000) + dauer : ablaufFuer(dauer, jetzt()),
    });
  }

  /**
   * Eine Datei unter genau diesem Pfad ablegen.
   *
   * Bunny überschreibt eine vorhandene Datei ohne Rückfrage (ein `upsert:
   * false` wie bei Supabase gibt es nicht). Wer hier aufruft, braucht darum
   * einen unratbaren Namen — `ablegen` unten baut ihn.
   *
   * Die Prüfsumme geht als Kopfzeile `Checksum` mit; Bunny weist die Datei
   * ab, wenn sie unterwegs verändert wurde.
   */
  async function hochladen(pfad, inhalt, typ, { pruefen = true, signal } = {}) {
    if (!bereit) return NICHT_BEREIT;
    const geprueft = pfadPruefen(pfad, pruefen ? ORDNER : ORDNER_LESEN);
    if (!geprueft) return { ok: false, error: 'Unbekannte Ablage' };
    const rein = reinerTyp(typ);
    if (pruefen) {
      const grund = inhaltPruefen(geprueft.split('/')[0], rein, inhalt);
      if (grund) return { ok: false, error: grund };
    } else if (!Buffer.isBuffer(inhalt) || !inhalt.length) {
      return { ok: false, error: 'Die Aufnahme ist leer' };
    }
    const pruefsumme = crypto.createHash('sha256').update(inhalt).digest('hex').toUpperCase();
    const { status, grund } = await anfrage('PUT', geprueft, {
      inhalt,
      kopf: { 'Content-Type': rein || 'application/octet-stream', Checksum: pruefsumme },
      zeit: ZEIT_HOCHLADEN_MS, signal,
    });
    if (status !== 201) {
      // Sichtbar machen, nicht verschlucken — aber ohne Adresse und Schlüssel.
      console.error('Bunny: Hochladen fehlgeschlagen:', grund || `Status ${status}`);
      return { ok: false, error: 'Die Aufnahme ließ sich nicht speichern' };
    }
    return { ok: true, url: dauerAdresse(geprueft), anzeige: signierteAdresse(geprueft), pfad: geprueft };
  }

  /**
   * Wie `ablegen` in medien.js: Pfad mit Zufallsteil bauen, ablegen, zwei
   * Adressen zurück. 16 Zufallsbytes statt Math.random — hier schützt der
   * Name zusätzlich vor dem stillen Überschreiben (siehe `hochladen`).
   */
  async function ablegen(nutzerId, ordner, typ, inhalt, {signal}={}) {
    if (!ORDNER.includes(ordner)) return { ok: false, error: 'Unbekannte Ablage' };
    if (!/^[A-Za-z0-9-]{1,64}$/.test(String(nutzerId || ''))) return { ok: false, error: 'Nicht angemeldet' };
    const rein = reinerTyp(typ);
    const endung = { 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'audio/mp4': 'm4a' }[rein] || 'jpg';
    const zufall = crypto.randomBytes(16).toString('hex');
    const pfad = ordner === 'instants' ? `instants/${nutzerId}/${jetzt()}-${zufall}.jpg` : `${ordner}/${nutzerId}-${jetzt()}-${zufall}.${endung}`;
    const ergebnis=await hochladen(pfad, inhalt, rein,{signal});
    if(signal?.aborted){await loeschen(pfad);return {ok:false,error:'Hochladen abgebrochen.'};}
    return ergebnis;
  }

  /** Eine Datei löschen. Nie ein Verzeichnis (siehe pfadPruefen). */
  async function loeschen(pfad) {
    if (!bereit) return NICHT_BEREIT;
    const geprueft = pfadPruefen(pfad, ORDNER_LESEN);
    if (!geprueft) return { ok: false, error: 'Unbekannte Ablage' };
    const { status, grund } = await anfrage('DELETE', geprueft);
    if (status === 200) return { ok: true };
    if (status === 404) return { ok: false, fehlt:true, error: 'Die Datei gibt es nicht' };
    console.error('Bunny: Löschen fehlgeschlagen:', grund || `Status ${status}`);
    return { ok: false, error: 'Die Datei ließ sich nicht löschen' };
  }

  /**
   * Ein Verzeichnis auflisten (für den Umzug: Größe nachprüfen). Nur eine
   * Ebene, wie bei Bunny; Unterordner fragt der Umzug einzeln ab.
   * Gibt `{ ok, dateien: [{ name, bytes }] }` zurück.
   */
  async function auflisten(ordner) {
    if (!bereit) return NICHT_BEREIT;
    // Auch der Instant-Nutzerordner (instants/<uuid>), sonst prüft der Umzug Instants nie nach.
    if (!ORDNER_LESEN.includes(ordner) && !/^instants\/[0-9a-f-]{36}$/.test(ordner)) return { ok: false, error: 'Unbekannte Ablage' };
    const { status, antwort, grund } = await anfrage('GET', `${ordner}/`, { kopf: { Accept: 'application/json' } });
    if (status !== 200) {
      console.error('Bunny: Auflisten fehlgeschlagen:', grund || `Status ${status}`);
      return { ok: false, error: 'Die Ablage ließ sich nicht lesen' };
    }
    try {
      const liste = await antwort.json();
      const dateien = (Array.isArray(liste) ? liste : [])
        .filter((e) => e && !e.IsDirectory && typeof e.ObjectName === 'string')
        .map((e) => ({ name: e.ObjectName, bytes: Number(e.Length) || 0 }));
      return { ok: true, dateien };
    } catch {
      return { ok: false, error: 'Die Ablage ließ sich nicht lesen' };
    }
  }

  // Rechteprüfung und Listenunterschrift ausschließlich in medien.js.
  return { bereit, hochladen, ablegen, loeschen, auflisten, signierteAdresse };
}

/*
 * Der Adapter des Servers, beim ersten Gebrauch aus process.env gebaut.
 * Fehlt etwas, nennt das Protokoll einmal die NAMEN der Variablen.
 */
let standard = null;
function adapter() {
  if (!standard) {
    const konfig = konfigurationAus(process.env);
    if (!konfig.ok) console.error('Bunny: nicht eingerichtet, es fehlen:', konfig.fehlt.join(', '));
    standard = erstelleBunny(konfig);
  }
  return standard;
}

module.exports = {
  // Für den Server (Konfiguration aus der Umgebung)
  hochladen: (pfad, inhalt, typ) => adapter().hochladen(pfad, inhalt, typ),
  ablegen: (nutzerId, ordner, typ, inhalt, optionen) => adapter().ablegen(nutzerId, ordner, typ, inhalt, optionen),
  loeschen: (pfad) => adapter().loeschen(pfad),
  signierteAdresse: (pfad, sekunden) => adapter().signierteAdresse(pfad, sekunden),
  // Für Tests und das Umzugsskript
  erstelleBunny,
  konfigurationAus,
  tokenRechnen,
  adresseBauen,
  ablaufFuer,
  pfadPruefen,
  inhaltPruefen,
  istMedienAdresse,
  pfadAus,
  ORDNER,
  ORDNER_LESEN,
  FENSTER_S,
};
