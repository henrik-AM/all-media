/**
 * Die All-Media-Website.
 *
 * Statische Seite aus ../public und die dazugehörige API. Dieselbe Datei
 * bedient die Fassung in der Cloud bei Render und den lokalen Server auf
 * Henriks Mac — beide teilen sich diesen Code, damit es keine zwei Stände
 * gibt.
 *
 * WAS SICH GEÄNDERT HAT
 *
 * Bis zum 31.08.2026 standen hier rund fünfhundert Zeilen Beispieldaten:
 * Anna, Bob, Clara, ihre Chats, Beiträge und Communitys. Jeder Endpunkt hat
 * darin herumgeschrieben und das Ergebnis zurückgegeben — nebenbei ging
 * derselbe Vorgang noch an Supabase, aber was der Browser sah, kam aus dem
 * Arbeitsspeicher. Zwei Folgen davon:
 *
 *   1. Nach jedem Neustart war alles wieder auf Anfang.
 *   2. Die App (Expo) las aus ihrer eigenen Kopie derselben Beispieldaten.
 *      Beide Fassungen konnten gar nicht denselben Stand haben.
 *
 * Jetzt ist die Datenbank die einzige Quelle. Es gibt keine Beispieldaten
 * mehr, auf die zurückgefallen werden könnte: was hier nicht aus Supabase
 * kommt, kommt nicht. Die Inhalte selbst stehen als echte Zeilen in der
 * Datenbank (SUPABASE_SCHEMA_6_inhalte.sql).
 *
 * Ohne Anmeldung ist nichts sichtbar. Das ist keine Härte, sondern die Regel
 * der Datenbank: Row Level Security lässt anonyme Zugriffe nicht zu. Die
 * Oberfläche zeigt in dem Fall die Anmeldung.
 */

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const supabaseApi = require('./supabase-api');
const syncHandlers = require('./sync-handlers');
const { signiereMedien, hochladen } = require('./medien');
const { clientFuer, tokenAus, isConfigured, supabaseUrl, supabaseKey } = require('./supabase');
// Dieselbe Regel wie in der App — siehe gemeinsam/telefon.js.
const Telefon = require('../../gemeinsam/telefon');

// Wie ein eigener Kommentar in der Liste steht — gemeinsam mit der App.
const Kommentar = require('../../gemeinsam/kommentar');
// Welcher Stand läuft hier? Einmal beim Start ermittelt, siehe version.js.
const VERSION = require('./version');
// Die Schreibweise des Kontakt-QR-Codes — dieselbe Datei, die auch der
// Browser laedt (gemeinsam/qr.js).
const QrKontakt = require('../../gemeinsam/qr');
// Zeichnet den Code. Dasselbe Paket benutzt die App (components/QrCode.tsx);
// zwei verschiedene Rechnungen haetten zwei verschiedene Codes ergeben.
const QRCode = require('qrcode');

const app = express();

/*
 * Sicherheitspruefung 04.09.2026 (Fund 10).
 *
 * Die Seite ging bis heute ohne einen einzigen Sicherheits-Header online.
 * Nachgeprueft mit `curl -I`: keine Content-Security-Policy, kein
 * X-Content-Type-Options, kein HSTS, kein Schutz gegen Einbetten in einen
 * fremden Rahmen — dafuer `x-powered-by: Express`, das freundlich mitteilt,
 * womit man es zu tun hat.
 *
 * Das Escaping in public/app.js ist sauber (esc() an 311 Stellen), aber es
 * war die einzige Verteidigungslinie. Eine CSP ist die zweite: selbst wenn
 * irgendwo ein Zeichen durchrutscht, laedt der Browser kein fremdes Skript.
 *
 * ZUR CSP IM EINZELNEN
 *
 * `scriptSrc` erlaubt bewusst 'unsafe-inline' NICHT. Geprueft vor dem
 * Einschalten: index.html hat keinen einzigen Inline-Block und weder app.js
 * noch index.html ein onclick=/onload=-Attribut. Fremd geladen wird nur
 * Leaflet von cdnjs, und das steht namentlich in der Liste.
 *
 * `styleSrc` erlaubt 'unsafe-inline', weil die Oberflaeche Farben und
 * Hintergruende ueber style-Attribute setzt (Avatare, Verlaeufe). Das ist
 * vertretbar: farbe() in public/app.js laesst nur Hex, rgb() und Verlaeufe
 * durch und weist alles mit <>"'`;\ ab, bevor es in ein Attribut geht.
 *
 * `connectSrc` und `imgSrc` brauchen Supabase — dort liegen Datenbank und
 * Medien. `frameAncestors: none` verbietet das Einbetten.
 */
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        /*
         * Eine einzige fremde Quelle, namentlich statt pauschal:
         *   cdnjs — Leaflet fuer die Karte (index.html)
         *
         * jsdelivr stand hier bis zum 04.09.2026 fuer supabase-js. Die
         * Bibliothek liegt jetzt unter public/lib/ und wird von uns selbst
         * ausgeliefert (anmeldung.js), damit fuer die Anmeldung — und damit
         * fuer die Sitzung jedes angemeldeten Nutzers — kein Dritter mehr
         * Code beisteuern kann.
         */
        scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        // Kartenkacheln: OpenStreetMap und die Satellitenansicht (public/app.js).
        // Die drei Kartenansichten der Friend-Map: Standard (OpenStreetMap),
        // Satellit (ArcGIS) und Gelaende (OpenTopoMap). OpenTopoMap fehlte
        // hier bis zum 09.09.2026 — die Ansicht liess sich waehlen, blieb
        // aber leer, weil jede Kachel an der Richtlinie scheiterte.
        imgSrc: ["'self'", 'data:', 'blob:', supabaseUrl,
          'https://*.tile.openstreetmap.org', 'https://server.arcgisonline.com',
          'https://*.tile.opentopomap.org'],
        mediaSrc: ["'self'", 'data:', 'blob:', supabaseUrl],
        /*
         * `api.pwnedpasswords.com` kam am 13.09.2026 dazu: dort fragt
         * `gemeinsam/passwort.js` nach, ob ein gewähltes Passwort in einem
         * bekannten Datenleck steht. Verschickt werden nur die ersten fünf
         * Zeichen des SHA-1-Werts, nie das Passwort — die Begründung steht in
         * der Datei.
         */
        connectSrc: ["'self'", supabaseUrl, supabaseUrl.replace('https://', 'wss://'),
          'https://api.pwnedpasswords.com'],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    // Render terminiert TLS davor; ein Jahr HSTS ist dort der Normalfall.
    hsts: { maxAge: 31536000, includeSubDomains: true },
    // Bilder und Medien aus dem Supabase-Speicher liegen auf einer anderen
    // Herkunft. Mit der strengen Voreinstellung laedt der Browser sie nicht.
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

/*
 * `gemeinsam/` liegt eine Ebene ueber `web/` und faellt deshalb nicht unter
 * die Statik oben. Der Browser braucht von dort zwei Dateien: `tweetnacl.js`
 * und `krypto.js`, dieselben, die auch die App und die Pruefläufe benutzen.
 *
 * Warum nicht kopieren: eine Kopie der Kryptoschicht, die von der anderen
 * abweicht, heisst nicht „sieht anders aus", sondern „die andere Seite kann
 * es nicht mehr lesen". Deshalb wird derselbe Ordner ausgeliefert.
 *
 * Auf Render geht das auf, weil `render.yaml` kein `rootDir` setzt und das
 * ganze Verzeichnis geklont wird. Fiele das je weg, waere hier 404 — und die
 * Website koennte keine Nachricht mehr oeffnen.
 */
app.use('/gemeinsam', express.static(path.join(__dirname, '..', '..', 'gemeinsam')));

/*
 * Fund 10, zweiter Teil: ohne Bremse liefen Anmeldeversuche und teure
 * Endpunkte ungehindert. Supabase bremst seine eigenen Auth-Aufrufe, die
 * Express-Routen davor aber nicht.
 *
 * 300 Anfragen je Minute und Herkunft sind fuer eine Oberflaeche, die beim
 * Start ein Buendel Endpunkte zieht, reichlich bemessen — und fuer das
 * Durchprobieren von Nummern oder Kennungen zu wenig.
 *
 * Dass die Bremse gegriffen hat, wird protokolliert. Ohne diese Zeile ist ein
 * 429 von aussen nicht von einem langsamen Server zu unterscheiden: die
 * Oberflaeche bleibt einfach leer, und ein Prueflauf meldet daraufhin
 * "waiting for locator" — also an einer Stelle, an der gar nichts kaputt ist.
 */
app.set('trust proxy', 1);
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'Zu viele Anfragen. Bitte kurz warten.' },
    handler: (req, res, _next, optionen) => {
      console.warn(
        `[Bremse] ${new Date().toISOString()} — ${req.ip} hat mehr als ` +
          `${optionen.max} Anfragen in einer Minute gestellt (${req.method} ${req.originalUrl})`
      );
      res.status(optionen.statusCode).json(optionen.message);
    },
  })
);

/*
 * Keine Antwort unter /api darf zwischengespeichert werden.
 *
 * Bis zum 21.09.2026 schickte der Server zu diesen Listen nur ein ETag und
 * kein Cache-Control. Ohne Cache-Control darf ein Browser eine Antwort nach
 * eigener Schätzung wiederverwenden — bei `/api/gespeichert` oder
 * `/api/gelikt` heißt das: ein frisch gesetzter Like taucht in der Liste
 * nicht auf, obwohl er in der Datenbank steht. Genau das Bild, das Henrik am
 * 18.09. gemeldet hat ("Likes ... unter Videos/Profil kann ich sie nicht
 * sehen") — und es wäre auch nach dem Beheben der eigentlichen Ursache
 * zeitweise zurückgekommen.
 *
 * Dazu kommt das Naheliegende: unter /api stehen persönliche Daten. Die
 * gehören in keinen Zwischenspeicher, weder im Browser noch in einem Proxy.
 * Dateien liefert keine dieser Routen aus, es geht also keine Bandbreite
 * verloren.
 */
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

/*
 * Anmeldung.
 *
 * Die Oberfläche reicht ihr Zugangstoken im Kopf "Authorization: Bearer ..."
 * mit; hier wird daraus ein Datenbank-Client im Namen dieses Nutzers. Ohne
 * Anmeldung bleibt req.db null.
 */
app.use('/api', async (req, _res, next) => {
  req.db = null;
  req.nutzerId = null;
  req.schluesselId = null;

  const token = tokenAus(req);
  if (!token) return next();

  const client = clientFuer(token);
  if (!client) return next();

  try {
    const { data, error } = await client.auth.getUser();
    if (!error && data?.user) {
      req.db = client;
      req.nutzerId = data.user.id;
      // Der Geraetschluessel dieses Browsers (public/anmeldung.js), fuer die
      // Kuverts in supabase-api.js. Nur eine UUID wird durchgelassen.
      const schluessel = String(req.headers['x-krypto-schluessel'] || '');
      req.schluesselId = /^[0-9a-f-]{36}$/i.test(schluessel) ? schluessel : null;
    }
  } catch {
    // Abgelaufenes oder falsches Token: weiter als nicht angemeldet.
  }
  next();
});

// ============================================================================
// Hilfsmittel
// ============================================================================

/**
 * Umschlag für jeden Endpunkt, der die Datenbank braucht.
 *
 * Nimmt drei Dinge ab, die sonst zweiundfünfzig Mal dastünden: die Prüfung
 * auf Anmeldung, das try/catch und das Protokollieren. Ein Fehler in der
 * Datenbank wird zu einer Antwort mit Grund — nicht zu einer stillen leeren
 * Liste. Genau dieses Verschlucken hat monatelang verborgen, dass gar nichts
 * ankam.
 */
function route(fn) {
  return async (req, res) => {
    if (!req.db || !req.nutzerId) {
      return res.status(401).json({ ok: false, angemeldet: false, error: 'Bitte anmelden' });
    }
    /*
     * Fund 4: der Medieneimer ist nicht mehr oeffentlich. Jede Adresse, die
     * diese API herausgibt, wird unterschrieben — an einer Stelle, statt in
     * jedem der rund fuenfzig Umformer einzeln. Was der Aufrufer nicht lesen
     * darf, steht gar nicht erst in der Antwort.
     *
     * Warum `res.json` ueberschrieben wird und nicht nur der Rueckgabewert
     * behandelt: ein Teil der Handler nimmt `res` entgegen und antwortet
     * selbst (die Community-Endpunkte etwa). Die waeren sonst uebersehen —
     * und ein uebersehener Endpunkt liefert tote Bilder.
     */
    const jsonOriginal = res.json.bind(res);
    /*
     * ACHTUNG, hier steckt eine Falle, in die diese Aenderung zuerst
     * hineingelaufen ist: das Unterschreiben ist ein Netzaufruf, `res.json`
     * antwortet also nicht mehr sofort. `res.headersSent` bleibt einen
     * Moment lang `false`, obwohl die Antwort schon unterwegs ist. Die
     * Pruefung unten haette danach ein ZWEITES Mal geantwortet — und weil
     * `res.json(...)` jetzt `res` zurueckgibt, waere das Objekt `res` selbst
     * als Antwortkoerper verschickt worden.
     *
     * Deshalb ein eigener Merker, der synchron gesetzt wird.
     */
    let schonGeantwortet = false;
    res.json = (koerper) => {
      if (schonGeantwortet) return res;
      schonGeantwortet = true;
      signiereMedien(req.db, koerper)
        .then(jsonOriginal)
        .catch((fehler) => {
          console.error('Antwort konnte nicht unterschrieben werden:', fehler.message);
          jsonOriginal(koerper);
        });
      return res;
    };

    try {
      const ergebnis = await fn(req, res);
      if (!schonGeantwortet && !res.headersSent && ergebnis !== undefined) res.json(ergebnis);
    } catch (fehler) {
      /*
       * Fund 14: hier stand `error: fehler.message`. Postgres nennt in seinen
       * Meldungen Tabellen-, Spalten- und Constraint-Namen — die gehoeren ins
       * Protokoll, nicht in die Antwort. Im Protokoll steht sie weiterhin
       * vollstaendig; das Verschlucken von Fehlern war ja der urspruengliche
       * Grund fuer diesen Umschlag und bleibt ausgeschlossen.
       */
      console.error(`${req.method} ${req.path} fehlgeschlagen:`, fehler.message);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: 'Das hat nicht geklappt. Bitte noch einmal versuchen.' });
      }
    }
  };
}

/** Aus dem Ergebnis eines Schreib-Handlers wird eine Antwort. */
function antwort(ergebnis, zusatz = {}) {
  if (!ergebnis) return { ok: false, error: 'Nicht angemeldet' };
  if (ergebnis.ok === false) return { ok: false, error: ergebnis.fehler || 'Hat nicht geklappt' };
  return { ok: true, ...ergebnis, ...zusatz };
}

/** Einen einzelnen Beitrag frisch aus der Datenbank holen. */
async function beitrag(req, id) {
  const alle = await supabaseApi.ladeBeitraege(req.db, req.nutzerId, { limit: 500 });
  return alle.find((b) => b.id === id) || null;
}

// ============================================================================
// Zustand und Zugangsdaten
// ============================================================================

/*
 * Zustand des Backends. Zeigt in einem Blick, ob die Website wirklich mit der
 * Datenbank spricht. Ohne diesen Endpunkt sieht "es läuft" genauso aus wie
 * "es kommt nichts an" — genau das hat lange verschleiert, dass nichts ankam.
 */
app.get('/api/zustand', async (req, res) => {
  const ergebnis = {
    zeit: new Date().toISOString(),
    supabase: {
      konfiguriert: isConfigured(),
      url: supabaseUrl,
      quelle: process.env.SUPABASE_URL ? 'Umgebungsvariable' : 'Standardwert im Code',
    },
    version: VERSION,
    anmeldung: { angemeldet: Boolean(req.nutzerId), nutzerId: req.nutzerId },
    // Es gibt keine zweite Möglichkeit mehr. Ohne Anmeldung ist die Antwort
    // leer, nicht ersatzweise gefüllt.
    daten: req.nutzerId ? 'Supabase' : 'keine (nicht angemeldet)',
    beispieldaten: false,
  };

  if (isConfigured() && req.db) {
    try {
      const { count, error } = await req.db
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      ergebnis.supabase.erreichbar = !error;
      ergebnis.supabase.profile = error ? null : count;
      if (error) ergebnis.supabase.fehler = error.message;

      const { count: beitraege } = await req.db
        .from('posts')
        .select('*', { count: 'exact', head: true });
      ergebnis.supabase.beitraege = beitraege ?? null;
    } catch (fehler) {
      ergebnis.supabase.erreichbar = false;
      ergebnis.supabase.fehler = fehler.message;
    }
  } else if (isConfigured()) {
    ergebnis.supabase.erreichbar = null;
    ergebnis.supabase.hinweis =
      'Ohne Anmeldung nicht prüfbar: die Regeln der Datenbank lassen anonyme Zugriffe nicht zu.';
  }

  res.json(ergebnis);
});

/*
 * Welcher Stand läuft hier gerade — ohne Anmeldung abrufbar.
 *
 * Bewusst ein eigener Endpunkt neben /api/zustand: die Frage "ist mein
 * Commit live?" muss sich beantworten lassen, bevor man sich anmeldet, und
 * ohne dass dafür die Datenbank befragt wird. Ein Aufruf von außen genügt:
 *
 *     curl https://all-media-website.onrender.com/api/version
 *
 * Steht dort ein anderer Commit als `git rev-parse --short HEAD` im Ordner,
 * hinkt der Deploy hinterher — oder es wurde nie committet.
 */
app.get('/api/version', (_req, res) => {
  res.json(VERSION);
});

/*
 * Die Zugangsdaten, mit denen sich die Oberfläche selbst bei Supabase
 * anmeldet. Der Schlüssel ist der öffentliche „publishable"-Schlüssel; er
 * steckt genauso im App-Bundle. Geschützt wird die Datenbank durch ihre
 * Regeln, nicht durch Geheimhaltung dieses Schlüssels.
 */
app.get('/api/konfiguration', (_req, res) => {
  res.json({ supabaseUrl, supabaseKey, konfiguriert: isConfigured() });
});

/*
 * Das eigene Konto auf den Startzustand zurücksetzen.
 *
 * Für die Prüfläufe: sie sollen wiederholbar sein und keine Testgruppen oder
 * Testkommentare hinterlassen. Vorher stellte dieser Endpunkt die Beispiel-
 * daten im Arbeitsspeicher wieder her — die gibt es nicht mehr, also räumt
 * jetzt die Datenbank auf.
 *
 * Angefasst wird ausschließlich das eigene Konto. Ein Prüflauf kann damit
 * nichts anfassen, was jemand anderem gehört.
 */
/*
 * Eine Aufnahme aus dem Browser speichern.
 *
 * Die Website hatte bis zum 09.09.2026 keinen Hochladeweg — jede Aufnahme
 * blieb im `localStorage` des einen Browsers. Begruendung und Ablauf stehen
 * bei `hochladen` in web/server/medien.js. Gegenstueck in der App:
 * app/lib/supabaseStorage.ts.
 *
 * Warum ueber den Server und nicht direkt aus dem Browser in den Eimer: der
 * Browser hat kein Supabase-SDK geladen, nur `fetch` gegen diese eigene API.
 * Hochgeladen wird trotzdem mit dem Client des angemeldeten Nutzers
 * (`req.db`) — die Regeln des Speichers gelten also unveraendert.
 */
app.post('/api/hochladen', route(async (req) => {
  const { ordner, aufnahme } = req.body || {};
  return hochladen(req.db, req.nutzerId, String(ordner || ''), aufnahme);
}));

app.post('/api/reset', route(async (req) => {
  const { data, error } = await req.db.rpc('zuruecksetzen', { ziel: req.nutzerId });
  if (error) throw error;
  // "Kein Interesse" (Schema 55) kennt zuruecksetzen() nicht. Ohne diese
  // Zeile bliebe ein einmal ausgeblendeter Beitrag fuer jeden spaeteren
  // Prueflauf aus dem Feed verschwunden.
  const { error: keinFehler } = await req.db.from('kein_interesse').delete().eq('user_id', req.nutzerId);
  if (keinFehler) throw keinFehler;
  return { ok: data?.ok !== false, ...(data || {}) };
}));

// ============================================================================
// Startdaten
// ============================================================================

/*
 * Alles, was die Oberfläche beim Start braucht.
 *
 * Nicht angemeldet ist kein Fehler: die Antwort sagt es und die Oberfläche
 * zeigt die Anmeldung. Deshalb 200 und nicht 401 — sonst protokollierte der
 * Browser bei jedem ersten Aufruf einen Ladefehler.
 */
app.get('/api/bootstrap', async (req, res) => {
  if (!req.db || !req.nutzerId) {
    return res.json({ angemeldet: false, quelle: 'keine', hinweis: 'Bitte anmelden' });
  }
  try {
    const daten = await supabaseApi.bootstrapData(req.db, req.nutzerId, req.schluesselId);
    // Fund 4: bootstrap geht an `route()` vorbei und braucht denselben Schritt.
    res.json(await signiereMedien(req.db, { angemeldet: true, ...daten }));
  } catch (fehler) {
    // Fund 14: Grund ins Protokoll, nicht in die Antwort.
    console.error('Startdaten fehlgeschlagen:', fehler.message);
    res.status(500).json({ angemeldet: true, error: 'Die Startdaten liessen sich nicht laden.' });
  }
});

// ============================================================================
// Chats
// ============================================================================

/*
 * Diese Route ist bewusst eng gefasst. `:was` würde sonst auch /accept, /read
 * und alles andere unter /api/chats/... abfangen — Express nimmt die erste
 * passende Route. Unbekanntes geht deshalb mit next() weiter.
 */
const CHAT_AKTIONEN = ['archiv', 'stumm', 'gelesen', 'loeschen', 'sperren', 'mitteilungen', 'blockieren', 'favorit'];

app.post('/api/chats/:chatId/:was', (req, res, next) => {
  if (!CHAT_AKTIONEN.includes(req.params.was)) return next();
  return route(async () => {
    const { chatId, was } = req.params;

    const { data: chat } = await req.db.from('chats').select('id, name').eq('id', chatId).maybeSingle();
    if (!chat) return { ok: false, error: 'Diesen Chat gibt es nicht' };

    if (was === 'loeschen') {
      const e = await syncHandlers.handleLeaveChat(req.db, req.nutzerId, chatId);
      return antwort(e, { meldung: `„${chat.name}" gelöscht` });
    }

    if (was === 'blockieren') {
      // Blockiert wird die Person, nicht der Chat. Ein Zweierchat hat genau
      // eine andere Person; in einer Gruppe ergibt der Knopf keinen Sinn.
      const { data: andere } = await req.db
        .from('chat_members')
        .select('user_id')
        .eq('chat_id', chatId)
        .neq('user_id', req.nutzerId);
      const ziel = (andere || [])[0]?.user_id;
      if (!ziel) return { ok: false, error: 'In einer Gruppe geht das nicht' };

      const e = await syncHandlers.handleBlockUser(req.db, req.nutzerId, ziel);
      return antwort(e, {
        blocked: e?.blockiert,
        meldung: e?.blockiert ? `„${chat.name}" blockiert` : `„${chat.name}" nicht mehr blockiert`,
      });
    }

    if (was === 'favorit') {
      return antwort(await syncHandlers.handleMarkChatFavorite(req.db, req.nutzerId, chatId));
    }

    const e = await syncHandlers.handleChatAction(req.db, req.nutzerId, chatId, was);
    const meldungen = {
      archiv: [`„${chat.name}" archiviert`, `„${chat.name}" ist wieder in der Liste`],
      stumm: [`„${chat.name}" stummgeschaltet`, `„${chat.name}" ist nicht mehr stumm`],
      gelesen: ['Als gelesen markiert', 'Als ungelesen markiert'],
      sperren: [`„${chat.name}" ist gesperrt`, `„${chat.name}" ist wieder offen`],
      mitteilungen: [`Keine Mitteilungen mehr aus „${chat.name}"`, `Mitteilungen aus „${chat.name}" wieder an`],
    };
    const an = Boolean(e?.wert);
    return antwort(e, {
      archiviert: was === 'archiv' ? an : undefined,
      muted: was === 'stumm' ? an : undefined,
      unread: was === 'gelesen' ? (an ? 0 : 1) : undefined,
      gesperrt: was === 'sperren' ? an : undefined,
      aus: was === 'mitteilungen' ? an : undefined,
      meldung: (meldungen[was] || [])[an ? 0 : 1],
    });
  })(req, res);
});

app.post('/api/chats/:chatId/melden', route(async (req) => {
  const grund = String(req.body?.grund || '').trim();
  if (!grund) return { ok: false, error: 'Bitte einen Grund angeben' };

  const { data: andere } = await req.db
    .from('chat_members')
    .select('user_id')
    .eq('chat_id', req.params.chatId)
    .neq('user_id', req.nutzerId);
  const ziel = (andere || [])[0]?.user_id;
  if (!ziel) return { ok: false, error: 'Diesen Chat gibt es nicht' };

  await syncHandlers.handleReportContent(req.db, req.nutzerId, ziel, grund, 'user');
  return { ok: true, grund, meldung: 'Danke, die Meldung ist bei uns angekommen' };
}));

app.post('/api/chats/:chatId/leeren', route(async (req) => {
  const e = await syncHandlers.handleClearChat(req.db, req.nutzerId, req.params.chatId);
  return antwort(e, { chats: await supabaseApi.ladeChats(req.db, req.nutzerId, 'messenger', req.schluesselId) });
}));

app.post('/api/chats/:chatId/read', route(async (req) =>
  antwort(await syncHandlers.handleChatAction(req.db, req.nutzerId, req.params.chatId, 'gelesen', true))
));

/*
 * Über eine eingegangene Chat-Anfrage entscheiden. Ohne Angabe: annehmen —
 * so hieß die Route vorher, und die App ruft sie weiterhin so auf.
 */
app.post('/api/chats/:chatId/accept', route(async (req) => {
  const annehmen = req.body?.annehmen !== false;
  const e = await syncHandlers.handleAcceptRequest(req.db, req.nutzerId, req.params.chatId, annehmen);
  return antwort(e, { chatId: req.params.chatId, zustand: e?.zustand });
}));

/*
 * Die Messenger-Anfrage aus einem Community-Chat (Feedback 21.09., Kasten 3).
 * Annehmen trägt beide als Kontakt ein und öffnet den Messenger-Chat;
 * ablehnen lässt alles unter Communitys.
 */
app.post('/api/chats/:chatId/messenger-anfrage', route(async (req) => {
  const e = await syncHandlers.handleMessengerAnfragen(req.db, req.nutzerId, req.params.chatId);
  return antwort(e, { chatId: req.params.chatId });
}));

app.post('/api/chats/:chatId/messenger-antwort', route(async (req) => {
  const annehmen = req.body?.annehmen === true;
  const e = await syncHandlers.handleMessengerAnfrageBeantworten(req.db, req.nutzerId, req.params.chatId, annehmen);
  return antwort(e, { chatId: req.params.chatId });
}));

/*
 * Die beiden Anfragezustaende eines Chats, frisch aus der Datenbank.
 *
 * Der Stand aus /api/bootstrap ist der vom letzten Laden. Hatte das
 * Gegenueber inzwischen geantwortet, war die Anfrage laengst angenommen
 * (Schema 21), das Eingabefeld aber noch gesperrt (24.09.2026). openChat in
 * public/app.js fragt deshalb beim Oeffnen hier nach. Gleiche Abfrage in
 * app/lib/daten.ts (ladeChatZustand).
 */
app.get('/api/chats/:chatId/zustand', route(async (req) => {
  const { data, error } = await req.db
    .from('chats')
    .select('anfrage_zustand, anfrage_von, messenger_anfrage, messenger_anfrage_von')
    .eq('id', req.params.chatId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false };
  return {
    ok: true,
    requestState: supabaseApi.anfrageZustand(data, req.nutzerId),
    messengerAnfrage: supabaseApi.messengerAnfrageZustand(data, req.nutzerId),
  };
}));

app.get('/api/messages/:chatId', route(async (req) =>
  supabaseApi.ladeNachrichten(req.db, req.params.chatId, req.nutzerId, req.schluesselId)
));

/*
 * Den Geraetschluessel dieses Browsers anmelden.
 *
 * Es kommt nur der oeffentliche Teil an. Kaeme hier je der geheime an, waere
 * die ganze Verschluesselung wertlos — deshalb steht es auch so in
 * `web/public/krypto.js` und in Schema 31.
 */
app.post('/api/krypto/schluessel', route(async (req) => {
  const oeffentlich = String(req.body?.oeffentlich || '').trim();
  const geraet = String(req.body?.geraet || '').trim();
  if (!oeffentlich || !geraet) return { ok: false, error: 'Schlüssel unvollständig' };

  const { data, error } = await req.db
    .from('krypto_schluessel')
    .upsert(
      { user_id: req.nutzerId, geraet, art: 'web', oeffentlich },
      { onConflict: 'user_id,geraet' }
    )
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id };
}));

/*
 * Die Geraete, fuer die in diesem Chat verschlossen werden darf.
 *
 * Die eigenen sind dabei und muessen es sein: ohne sie koennte man seine
 * eigene Nachricht am zweiten Geraet nicht mehr lesen.
 *
 * `verschluesselbar` sagt, ob es ueberhaupt geht — nur ein Chat zu zweit, und
 * nur wenn beide Seiten je ein Geraet angemeldet haben. Ist das Gegenueber
 * nie mit einem Geraet dagewesen, gibt es niemanden, fuer den man
 * verschliessen koennte; dann bleibt es Klartext und die Oberflaeche zeigt
 * kein Schloss.
 */
app.get('/api/krypto/empfaenger/:chatId', route(async (req) => {
  const chatId = req.params.chatId;

  const { data: chat } = await req.db
    .from('chats')
    .select('is_group')
    .eq('id', chatId)
    .maybeSingle();
  if (!chat || chat.is_group) return { verschluesselbar: false, schluessel: [] };

  const { data: mitglieder } = await req.db
    .from('chat_members')
    .select('user_id')
    .eq('chat_id', chatId);
  const ids = (mitglieder || []).map((m) => m.user_id);
  if (!ids.length) return { verschluesselbar: false, schluessel: [] };

  /*
   * Neueste zuerst. PostgREST gibt höchstens 1000 Zeilen heraus — ohne
   * Reihenfolge waren das die ältesten, und ein Konto mit mehr Geräten
   * (die Prüfkonten sammeln bei jedem Lauf eines) bekam für sein aktuelles
   * Gerät nichts mehr: „Auf diesem Gerät nicht lesbar" (24.09.2026).
   */
  const { data, error } = await req.db
    .from('krypto_schluessel')
    .select('id, user_id, oeffentlich')
    .in('user_id', ids)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const konten = new Set((data || []).map((k) => k.user_id));
  return {
    verschluesselbar: konten.size >= 2,
    schluessel: (data || []).map((k) => ({ id: k.id, oeffentlich: k.oeffentlich })),
  };
}));

/*
 * Der oeffentliche Schluessel eines Gegenuebers — fuer das Kontaktprofil.
 *
 * Die Zeile "Verschluesselung" dort soll nachsehen statt behaupten, genau wie
 * in der App. Dazu reicht die neueste angemeldete Kennung der anderen Person:
 * gibt es keine, kann niemand fuer sie verschliessen. Die Sicherheitsregel in
 * Schema 31 gibt fremde Schluessel ohnehin nur heraus, wenn man einen Chat
 * teilt — hier steht deshalb kein zweiter Filter im Code.
 */
app.get('/api/krypto/kontakt/:userId', route(async (req) => {
  const { data, error } = await req.db
    .from('krypto_schluessel')
    .select('oeffentlich')
    .eq('user_id', req.params.userId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return { oeffentlich: (data || [])[0]?.oeffentlich || null };
}));

app.post('/api/messages/:chatId', route(async (req) => {
  /*
   * Zwei Formen, je nachdem ob der Browser verschliessen konnte.
   *
   * Verschluesselt kommt hier gar kein Text mehr an — nur Chiffre, Nonce,
   * Absenderschluessel und die Kuverts. Das ist der Punkt der Sache: dieser
   * Server steht bei Render und soll nicht mitlesen koennen.
   */
  const krypto = Number(req.body?.krypto || 0);
  const text = String(req.body?.text || '').trim();
  if (!krypto && !text) return { ok: false, error: 'Text erforderlich' };
  if (krypto && !req.body?.chiffre) return { ok: false, error: 'Chiffre erforderlich' };

  const sperre = await chatGesperrt(req, req.params.chatId);
  if (sperre) return { ok: false, error: sperre };

  const e = await syncHandlers.handleSendMessage(req.db, req.nutzerId, req.params.chatId, text, {
    antwortAuf: req.body?.antwortAuf || null,
    zitatVon: req.body?.zitatVon || null,
    krypto,
    chiffre: req.body?.chiffre || null,
    kryptoNonce: req.body?.kryptoNonce || null,
    absenderSchluessel: req.body?.absenderSchluessel || null,
    kuverts: req.body?.kuverts || [],
  });
  if (!e || e.ok === false) return antwort(e);

  return {
    id: e.nachricht.id,
    from: 'me',
    // Bei einer verschluesselten Nachricht ist `text` hier leer; den Klartext
    // haelt der Browser ohnehin noch in der Hand und setzt ihn selbst ein.
    text,
    krypto,
    time: supabaseApi.chatZeit(e.nachricht.created_at),
    zeitpunkt: e.nachricht.created_at,
  };
}));

/**
 * Chat geöffnet — was drinsteht, gilt als gelesen.
 *
 * Ob daraus eine Lesebestätigung wird, entscheidet `chat_gelesen` in der
 * Datenbank anhand des Schalters des Lesers. Die App ruft dieselbe Funktion
 * auf; deshalb steht die Regel nirgends zweimal.
 */
app.post('/api/messages/:chatId/gelesen', route(async (req) => {
  const e = await syncHandlers.handleMarkChatAsRead(req.db, req.nutzerId, req.params.chatId);
  return antwort(e);
}));

/**
 * Darf in diesem Chat geschrieben werden?
 *
 * Zwei Gründe sprechen dagegen: die Kontaktanfrage läuft noch (bei einem
 * privaten Profil), oder die Person ist blockiert. Beides steht in der
 * Datenbank, nicht im Browser — eine Regel, die nur im Markup steht, ist
 * keine.
 */
async function chatGesperrt(req, chatId) {
  const { data: andere } = await req.db
    .from('chat_members')
    .select('user_id')
    .eq('chat_id', chatId)
    .neq('user_id', req.nutzerId);
  const ziel = (andere || [])[0]?.user_id;
  if (!ziel) return null;

  const [{ data: kontakt }, { count: blockiert }] = await Promise.all([
    req.db
      .from('contacts')
      .select('status')
      .eq('user_id', req.nutzerId)
      .eq('contact_id', ziel)
      .maybeSingle(),
    req.db
      .from('blocks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.nutzerId)
      .eq('blocked_user_id', ziel),
  ]);

  if (blockiert > 0) return 'Diese Person ist blockiert';
  if (kontakt?.status === 'pending') return 'Warte, bis die Anfrage angenommen wurde';
  return null;
}

/**
 * Aus „art" wird Text und Medienbezug.
 *
 * Stand bis zum 04.09.2026 ausgeschrieben in der Chat-Route. Seit die
 * Community-Kanaele dieselben Anhaenge annehmen (Schema 25), brauchen zwei
 * Routen dieselbe Uebersetzung — und zwei Abschriften davon liefen
 * garantiert irgendwann auseinander: der Kanal zeigte dann ein Gif mit
 * Abspielknopf, der Chat ohne.
 *
 * Gibt entweder { text, medien } zurueck oder { error }.
 */
async function anhangDeuten(req, art) {
  let text;
  let medien = {};

  if (art === 'foto') {
    text = 'Foto';
    medien = { typ: 'image' };
  } else if (art === 'standort') {
    const standorte = await supabaseApi.ladeStandorte(req.db);
    const platz = standorte.find((p) => p.id === req.body?.id) || standorte[0];
    if (!platz) return { ok: false, error: 'Diesen Standort gibt es nicht' };
    text = `Standort: ${platz.name}`;
    medien = { standortId: platz.id };
  } else if (art === 'kontakt') {
    const person = await supabaseApi.ladeProfil(req.db, req.body?.id);
    if (!person) return { ok: false, error: 'Diese Person gibt es nicht' };
    text = `Kontakt: ${person.name}`;
    medien = { kontaktId: person.id };
  } else if (art === 'gif') {
    // Gif und Sticker sind eigene Typen, keine Bilder: ein Gif darf nicht mit
    // Abspielknopf erscheinen, ein Sticker nicht in einer Blase.
    text = 'Gif';
    medien = { typ: 'gif' };
  } else if (art === 'sticker') {
    const zeichen = String(req.body?.zeichen || '').slice(0, 8);
    if (!zeichen) return { ok: false, error: 'Kein Sticker gewählt' };
    text = zeichen;
    medien = { typ: 'sticker' };
  } else if (art === 'datei') {
    // Ohne Name und Größe stünde im Chat nur ein graues Kästchen.
    const name = String(req.body?.name || '').slice(0, 200);
    if (!name) return { ok: false, error: 'Kein Dateiname' };
    text = name;
    medien = {
      typ: 'file',
      dateiName: name,
      dateiGroesse: Number(req.body?.groesse) || 0,
    };
  } else {
    return { error: 'Unbekannter Anhang' };
  }

  return { text, medien };
}

app.post('/api/messages/:chatId/anhang', route(async (req) => {
  const sperre = await chatGesperrt(req, req.params.chatId);
  if (sperre) return { ok: false, error: sperre };

  const gedeutet = await anhangDeuten(req, req.body?.art);
  if (gedeutet.error) return { ok: false, error: gedeutet.error };
  const { text, medien } = gedeutet;

  const e = await syncHandlers.handleSendMessage(req.db, req.nutzerId, req.params.chatId, text, medien);
  if (!e || e.ok === false) return antwort(e);

  /*
   * Der Chat wird sofort neu gezeichnet, ohne die Nachrichten noch einmal zu
   * holen. Die Karte muss deshalb schon hier fertig sein — sonst steht bis
   * zum naechsten Laden nur der Satz da.
   */
  const frisch = await supabaseApi.ladeNachrichten(req.db, req.params.chatId, req.nutzerId, req.schluesselId);
  const angelegt = (frisch || []).find((m) => m.id === e.nachricht.id);

  return {
    ok: true,
    message: angelegt || {
      id: e.nachricht.id,
      from: 'me',
      text,
      media: medien.typ,
      time: supabaseApi.chatZeit(e.nachricht.created_at),
    },
  };
}));

app.post('/api/messages/:chatId/:messageId/stern', route(async (req) => {
  const e = await syncHandlers.handleStarMessage(req.db, req.nutzerId, req.params.messageId);
  return antwort(e, { id: req.params.messageId });
}));

/** Alles, was in diesem Chat an Medien und Markiertem liegt. */
app.get('/api/chats/:chatId/medien', route(async (req) => {
  const alle = await supabaseApi.ladeNachrichten(req.db, req.params.chatId, req.nutzerId, req.schluesselId);
  const { data: sterne } = await req.db
    .from('message_stars')
    .select('message_id')
    .eq('user_id', req.nutzerId);
  const markiert = new Set((sterne || []).map((s) => s.message_id));

  return {
    medien: alle.filter((m) => m.media),
    markiert: alle.filter((m) => markiert.has(m.id)),
    gesamt: alle.length,
  };
}));

app.post('/api/groups', route(async (req) => {
  const name = String(req.body?.name || '').trim();
  const mitglieder = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];
  if (!name) return { ok: false, error: 'Name erforderlich' };
  if (mitglieder.length === 0) return { ok: false, error: 'Mindestens ein Mitglied erforderlich' };

  const e = await syncHandlers.handleCreateGroup(req.db, req.nutzerId, name, mitglieder, req.body?.bereich);
  if (!e || e.ok === false) return antwort(e);

  const info = String(req.body?.info || '').trim();
  if (info) await syncHandlers.handleSendMessage(req.db, req.nutzerId, e.chat.id, info);

  return {
    id: e.chat.id,
    name: e.chat.name,
    isGroup: true,
    members: mitglieder,
    preview: info || 'Gruppe erstellt',
    time: supabaseApi.chatZeit(e.chat.created_at),
    unread: 0,
    muted: false,
  };
}));

// ============================================================================
// Kontakte
// ============================================================================

app.post('/api/personen/suche', route(async (req) => {
  const e = await syncHandlers.handleFindPerson(req.db, req.nutzerId, req.body?.eingabe || '');
  return { person: e?.person || null };
}));

/*
 * Der eigene QR-Code als Bild.
 *
 * Henrik am 07.09.2026: „Kontakt hinzufügen nur über Telefonnummer/QR-Code,
 * nicht Username." Im Code steht die eigene Telefonnummer — was genau und
 * warum, steht in gemeinsam/qr.js.
 *
 * WARUM DER SERVER UND NICHT DER BROWSER
 *
 * Weil die Nummer sonst zweimal ueber die Leitung muesste: einmal, damit der
 * Browser sie kennt, und einmal in den Code. Sie kommt hier aus
 * `mein_profil()` — dieselbe Quelle, aus der auch die Kontaktinfo liest —
 * und verlaesst den Server nur als Bild. Ein Aufrufer ohne Anmeldung bekommt
 * gar nichts; `route()` prueft das vorher.
 *
 * Kein Zwischenspeicher: wer seine Nummer aendert, soll nicht noch eine
 * Stunde lang den alten Code zeigen.
 */
app.get('/api/qr.svg', route(async (req, res) => {
  const { data: ich } = await req.db.rpc('mein_profil');
  const nummer = (ich && ich.phone) || '';
  if (!nummer) return { ok: false, error: 'Für deinen Code brauchst du erst eine eigene Telefonnummer' };

  const svg = await QRCode.toString(QrKontakt.link(nummer), {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 220,
    color: { dark: '#000000', light: '#ffffff' },
  });
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  // `res.send` statt eines Rueckgabewerts: die Antwort ist ein Bild, kein
  // JSON. `route()` sieht an `headersSent`, dass hier schon geantwortet wurde.
  res.send(svg);
}));

/*
 * "Nicht gefunden" und "schon vorhanden" sind hier normale Ergebnisse einer
 * Suche, keine Fehler der Anfrage. Deshalb 200 mit ok-Feld statt 404/409 —
 * sonst protokolliert der Browser bei jeder Fehleingabe einen Ladefehler.
 */
app.post('/api/contacts', route(async (req) => {
  const eingabe = String(req.body?.handle || '').trim();
  if (!eingabe) return { ok: false, error: 'Bitte eine Telefonnummer eingeben' };

  /*
   * Henrik am 07.09.2026: „Kontakt hinzufügen nur über Telefonnummer/QR-Code,
   * nicht Username."
   *
   * Der Riegel steht hier und nicht nur im Eingabefeld. Ein ausgeblendetes
   * Feld ist keine Regel — die Anfrage laesst sich von Hand stellen, und
   * `handleFindPerson` nimmt einen Benutzernamen weiterhin an (die
   * Personensuche im Explorer braucht ihn). Wer ueber diesen Weg einen
   * Kontakt anlegen will, muss die Nummer kennen.
   *
   * Ein gescannter QR-Code landet ebenfalls hier: der Browser holt die Nummer
   * mit `QrKontakt.nummerAus` heraus und schickt genau sie.
   */
  const grund = Telefon.pruefe(eingabe);
  if (grund) return { ok: false, error: grund };

  const gefunden = await syncHandlers.handleFindPerson(req.db, req.nutzerId, eingabe);
  const person = gefunden?.person;
  if (!person) return { ok: false, error: 'Zu dieser Nummer gibt es noch kein Konto' };

  const privat = Boolean(person.privat);
  const e = await syncHandlers.handleAddContact(
    req.db, req.nutzerId, person.id, privat, String(req.body?.nachricht || '')
  );
  if (e?.fehler === 'schon-vorhanden') {
    return { ok: false, error: `${person.name} ist bereits in deinen Kontakten` };
  }
  if (!e || e.ok === false) return antwort(e);

  return {
    ok: true,
    privat,
    contact: {
      id: person.id,
      name: person.name,
      status: e.status,
      about: privat ? 'Anfrage gesendet' : 'Kontakt',
      // Fund 1: die Suche gibt keine Nummer mehr heraus. Wer ueber eine
      // Nummer gesucht hat, kennt sie ohnehin — die Oberflaeche setzt sie
      // aus der Eingabe. Sonst bleibt sie leer, bis beide Seiten Kontakt sind.
      phone: person.phone || '',
    },
    /*
     * Der Chat wird gleich geoeffnet, ohne dass die Seite die Chatliste neu
     * holt. "requestState" muss deshalb schon hier stehen — sonst bleibt das
     * Eingabefeld offen, obwohl die Anfrage noch laeuft, und der Nutzer kann
     * jemandem schreiben, der ihn noch gar nicht angenommen hat.
     *
     * Gefragt wird der Chat selbst, nicht `contacts.status`. Seit Schema 21
     * entscheidet ein Auslöser in der Datenbank, ob dieser Chat eine Anfrage
     * ist — und der sagt bei einer Figur aus dem Testbestand ausdrücklich
     * nein. Stünde hier weiterhin die Vermutung aus dem Kontaktstatus, sperrte
     * die Seite ein Eingabefeld, das die Datenbank längst freigegeben hat.
     */
    chat: {
      id: e.chatId,
      userId: person.id,
      name: person.name,
      isGroup: false,
      requestState: await anfrageZustandVon(req.db, e.chatId, req.nutzerId),
    },
  };
}));

/** Den Anfragezustand eines einzelnen Chats holen — siehe supabase-api.js. */
async function anfrageZustandVon(client, chatId, nutzerId) {
  const { data } = await client
    .from('chats')
    .select('anfrage_zustand, anfrage_von')
    .eq('id', chatId)
    .maybeSingle();
  return data ? supabaseApi.anfrageZustand(data, nutzerId) : 'accepted';
}

/*
 * Der Eintrag zu einem beendeten Anruf (Henrik 7.9.). In der App macht das
 * CallScreen.tsx beim Auflegen über dieselbe Regel.
 */
app.post('/api/kontakte/:userId/anruf', route(async (req) => {
  const e = await syncHandlers.handleAnrufNotieren(req.db, req.nutzerId, req.params.userId, req.body || {});
  return antwort(e);
}));

/*
 * Den Chat mit einer Person holen — und ihn anlegen, wenn es noch keinen gibt.
 * Für den Sprung „Nachricht" aus der Kontaktinfo (Henrik 7.9.). In der App
 * macht das onMessage in ContactProfileScreen.tsx über dieselbe chatMit-Regel.
 */
app.post('/api/kontakte/:userId/chat', route(async (req) => {
  /*
   * Hier stand 'messenger' fest im Code. Wer aus dem Bereich Communitys
   * heraus auf „Nachricht" ging, landete deshalb im Messenger — und der
   * Chat, der dabei entstand, gehoerte fuer immer in die falsche Liste.
   * Der Browser schickt den Bereich jetzt mit; alles ausser 'community'
   * gilt als Messenger.
   */
  const bereich = req.body?.bereich === 'community' ? 'community' : 'messenger';
  const e = await syncHandlers.handleChatMit(req.db, req.nutzerId, req.params.userId, bereich);
  return antwort(e, { bereich });
}));

/*
 * Selbst vergebener Name und Notiz zu einem Kontakt (Henrik 7.9.).
 * Der Name schlägt auf Chatliste, Chatkopf und Profil durch, deshalb lädt die
 * Oberfläche danach neu — siehe openContactProfile in web/public/app.js.
 */
app.post('/api/kontakte/:userId/bearbeiten', route(async (req) => {
  const e = await syncHandlers.handleContactEdit(req.db, req.nutzerId, req.params.userId, req.body || {});
  return antwort(e, { contacts: await supabaseApi.ladeKontakte(req.db, req.nutzerId) });
}));

app.post('/api/kontakte/:userId/favorit', route(async (req) => {
  const e = await syncHandlers.handleContactFavorite(req.db, req.nutzerId, req.params.userId);
  return antwort(e, { contacts: await supabaseApi.ladeKontakte(req.db, req.nutzerId) });
}));

// ============================================================================
// Profile
// ============================================================================

app.get('/api/profile/:userId', route(async (req, res) => {
  const id = req.params.userId === 'me' ? req.nutzerId : req.params.userId;
  const profil = await supabaseApi.ladeProfil(req.db, id);
  if (!profil) return res.status(404).json({ error: 'Nicht gefunden' });

  const [{ data: zahlen }, { count: folgeIch }, beitraege, { count: istStumm }, { count: istBlockiert }] =
    await Promise.all([
      req.db.from('profile_zahlen').select('*').eq('id', id).maybeSingle(),
      req.db
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', req.nutzerId)
        .eq('followee_id', id),
      supabaseApi.ladeBeitraege(req.db, req.nutzerId, { limit: 200 }),
      /*
       * Stumm und blockiert gehoeren auf die Profilseite: dort steht der Satz
       * "… ist stummgeschaltet", und der Nachricht-Knopf ist gesperrt.
       *
       * Beides fehlte in dieser Antwort. Das Umschalten funktionierte, die
       * Datenbank merkte es sich — nur sah man davon nichts, weil die
       * Profilseite gar nicht danach fragte.
       */
      req.db
        .from('mutes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.nutzerId)
        .eq('muted_user_id', id),
      req.db
        .from('blocks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.nutzerId)
        .eq('blocked_user_id', id),
    ]);

  const eigene = beitraege.filter((b) => b.userId === id || (id === req.nutzerId && b.userId === 'me'));

  res.json({
    ...profil,
    userId: id,
    followers: Number(zahlen?.followers || 0),
    following: Number(zahlen?.following || 0),
    posts: Number(zahlen?.beitraege || 0),
    isFollowing: folgeIch > 0,
    following_me: folgeIch > 0,
    muted: istStumm > 0,
    blocked: istBlockiert > 0,
    // Das Raster zeigt, was diese Person veröffentlicht hat — nicht mehr eine
    // erfundene Kachelfolge.
    grid: eigene.map((b) => ({
      id: b.id,
      kind: b.kind === 'post' ? 'image' : 'video',
      eigen: id === req.nutzerId,
      // Ohne die Adresse zeigt jede Kachel die Ersatzflaeche, auch wenn ein
      // Bild da ist. Bei einem Video steht in mediaUrl eine .mp4 — dann
      // braucht die Kachel das Standbild dazu.
      mediaUrl: b.mediaUrl,
      thumbnail: b.thumbnail,
    })),
  });
}));

app.post('/api/profile/:userId/:was', (req, res, next) => {
  if (!['stumm', 'block', 'melden'].includes(req.params.was)) return next();
  return route(async () => {
    const { userId, was } = req.params;

    if (was === 'stumm') {
      const e = await syncHandlers.handleMuteUser(req.db, req.nutzerId, userId);
      return antwort(e, { muted: e?.stumm });
    }
    if (was === 'melden') {
      const grund = String(req.body?.grund || '').trim();
      if (!grund) return { ok: false, error: 'Bitte einen Grund auswählen' };
      const e = await syncHandlers.handleReportContent(req.db, req.nutzerId, userId, grund, 'user');
      return antwort(e, { gemeldet: grund });
    }

    const e = await syncHandlers.handleBlockUser(req.db, req.nutzerId, userId);
    // Blockieren hat Folgen: die Person fliegt aus den Kontakten. Sonst wäre
    // der Knopf nur ein Hinweis mit anderem Text.
    if (e?.blockiert) {
      await req.db.from('contacts').delete().eq('user_id', req.nutzerId).eq('contact_id', userId);
      await req.db.from('follows').delete().eq('follower_id', req.nutzerId).eq('followee_id', userId);
    }
    return antwort(e, {
      blocked: e?.blockiert,
      contacts: await supabaseApi.ladeKontakte(req.db, req.nutzerId),
    });
  })(req, res);
});

const folgen = route(async (req) => {
  const e = await syncHandlers.handleFollowUser(req.db, req.nutzerId, req.params.userId);
  if (!e || e.ok === false) return antwort(e);

  const { data: zahlen } = await req.db
    .from('profile_zahlen')
    .select('followers')
    .eq('id', req.params.userId)
    .maybeSingle();

  return {
    ok: true,
    following: e.folgt,
    following_me: e.folgt,
    followers: Number(zahlen?.followers || 0),
  };
});

app.post('/api/autoren/:userId/follow', folgen);
app.post('/api/profile/:userId/follow', folgen);

/*
 * Die Namen hinter den Zahlen "Follower" und "Gefolgt". Die Zahlen kamen
 * schon immer aus `profile_zahlen`; die Listen darunter kamen aus dem
 * Nichts — auf der Website aus einer nie gesetzten Eigenschaft, in der App
 * aus fuenf fest eingetragenen Kennungen. Beide lesen jetzt `follows`.
 */
/*
 * Die Statistik hinter dem Einstellungspunkt "Insights". Bewusst nicht unter
 * /api/insights — dort liegt das Snapchat-Aequivalent, ein voellig anderes
 * Ding mit demselben Namen im Handbuch.
 */
app.get('/api/statistik', route(async (req) => ({
  ok: true,
  statistik: await supabaseApi.ladeStatistik(req.db, req.nutzerId),
})));

/*
 * Schalter und Auswahlen aus den Einstellungen. Bis zum 03.09.2026 lagen sie
 * im Browser bzw. im Bildschirmzustand der App und waren beim naechsten
 * Start wieder weg — darunter "Privates Profil".
 */
/*
 * Die Datenauskunft nach Artikel 15 DSGVO. Die Zusammenstellung macht die
 * Datenbank (`meine_daten()`), damit an einer Stelle steht, was „meine
 * Daten" sind — und nicht zweimal, hier und in der App.
 */
app.get('/api/meine-daten', route(async (req, res) => {
  const { data, error } = await req.db.rpc('meine_daten');
  if (error) throw error;
  // Als Anhang, nicht als Seite: der Browser soll sie sichern, nicht anzeigen.
  const name = `all-media-daten-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(JSON.stringify(data, null, 2));
}));

app.get('/api/einstellungen', route(async (req) => ({
  ok: true,
  einstellungen: await supabaseApi.ladeEinstellungen(req.db, req.nutzerId),
})));

app.post('/api/einstellungen/:schluessel', route(async (req) =>
  antwort(
    await syncHandlers.handleEinstellung(
      req.db, req.nutzerId, req.params.schluessel, req.body?.wert
    )
  )
));

/*
 * Ein Aufruf eines fremden Profils. Ohne das bleibt die Profilstatistik
 * dauerhaft bei null: sie kann nur zaehlen, was jemand aufschreibt.
 */
app.post('/api/profile/:userId/aufruf', route(async (req) =>
  antwort(await syncHandlers.handleProfilAufruf(req.db, req.nutzerId, req.params.userId))
));

/*
 * Anwesenheit — "zuletzt online".
 *
 * Bis zum 03.09.2026 stand im Chatkopf fest das Wort "Online", bei jedem
 * Menschen, zu jeder Zeit. Es gab keine Spalte, die das haette wissen
 * koennen. Jetzt gibt es `presence`, und wer den Status verbirgt, hat dort
 * keine fuer andere lesbare Zeile: die Antwort ist dann `null` — ununter-
 * scheidbar von "war noch nie da". Das ist Absicht, ein "verborgen" waere
 * selbst eine Auskunft.
 */
app.post('/api/praesenz', route(async (req) => {
  const { error } = await req.db.rpc('hier_bin_ich');
  return error ? { ok: false, error: error.message } : { ok: true };
}));

/*
 * Darf ich die Inhalte dieser Person auf mein Geraet holen?
 *
 * Die Einstellung "Downloadeinstellungen" gab es seit dem 01.09.2026 in den
 * Einstellungen; gefragt hat sie nie jemand — es gab ueberhaupt keinen Weg,
 * einen fremden Inhalt zu sichern. Beides ist jetzt da: der Weg und die
 * Frage davor.
 *
 * Was das nicht kann: ein Bildschirmfoto verhindern. Wer etwas sehen darf,
 * hat es geladen. Die Einstellung nimmt den Knopf weg — mehr verspricht sie
 * nicht.
 */
app.get('/api/download-erlaubt/:userId', route(async (req) => {
  const { data } = await req.db.rpc('darf_herunterladen', {
    inhaber: req.params.userId,
    wer: req.nutzerId,
  });
  return { ok: true, erlaubt: data !== false };
}));

/*
 * Das Drei-Punkte-Menue am Beitrag — Henrik am 21.09.2026: "Link kopieren,
 * herunterladen, zu Story hinzufügen, melden, kein Interesse ... Vorbild
 * TikTok." Dieselben Schreibwege wie in app/lib/aktionen.ts (beitragInStory,
 * keinInteresse, melden).
 */
app.post('/api/beitraege/:id/story', route(async (req) => {
  const { data: beitrag, error } = await req.db
    .from('posts')
    .select('media_url, kind')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) throw error;
  if (!beitrag?.media_url) return { ok: false, error: 'Dieser Beitrag hat kein Bild und kein Video' };
  // Die Adresse aus der Datenbank, nicht die unterschriebene aus der
  // Anzeige - die liefe nach einer Stunde ab.
  const video = beitrag.kind !== 'post' || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(beitrag.media_url);
  const e = await syncHandlers.handleCreateStory(req.db, req.nutzerId, {
    mediaUrl: beitrag.media_url,
    mediaTyp: video ? 'video' : 'image',
    text: '',
    inVideos: true,
  });
  if (!e || e.ok === false) return antwort(e);
  const listen = await supabaseApi.ladeStorys(req.db, req.nutzerId);
  return { ok: true, stories: listen.messenger, storiesVideos: listen.videos };
}));

app.post('/api/beitraege/:id/kein-interesse', route(async (req) => {
  const { error } = await req.db
    .from('kein_interesse')
    .upsert({ user_id: req.nutzerId, post_id: req.params.id }, { onConflict: 'user_id,post_id', ignoreDuplicates: true });
  if (error) throw error;
  return { ok: true };
}));

app.post('/api/beitraege/:id/melden', route(async (req) =>
  antwort(await syncHandlers.handleReportContent(req.db, req.nutzerId, req.params.id, String(req.body?.grund || ''), 'post'))
));

/**
 * Darf ich dieser Person schreiben? — "Nachrichten senden deaktivieren".
 *
 * Der Sichtbarkeitsbereich `dm`. Seit Schema 19 weist die Datenbank die
 * Nachricht ab, seit Schema 22 schon den Chat. Diese Auskunft steht davor,
 * damit der Knopf "Nachricht" gar nicht erst anklickbar ist.
 *
 * Gegenstueck in der App: Aktion.darfAngeschriebenWerden().
 */
app.get('/api/dm-erlaubt/:userId', route(async (req) => {
  const { data } = await req.db.rpc('darf_angeschrieben_werden', {
    inhaber: req.params.userId,
    wer: req.nutzerId,
  });
  return { ok: true, erlaubt: data !== false };
}));

app.get('/api/praesenz/:userId', route(async (req) => {
  const { data } = await req.db
    .from('presence')
    .select('last_seen')
    .eq('user_id', req.params.userId)
    .maybeSingle();
  return { ok: true, zuletzt: data?.last_seen || null };
}));

app.get('/api/profile/:userId/folge/:art', route(async (req) => ({
  ok: true,
  ids: await supabaseApi.ladeFolgeListe(
    req.db,
    req.nutzerId,
    req.params.userId,
    req.params.art === 'follower' ? 'follower' : 'gefolgt'
  ),
})));

// ============================================================================
// Eigenes Profil und eigene Inhalte
// ============================================================================

app.post('/api/eigene/profil', route(async (req) => {
  const { name, bio, link, color } = req.body || {};
  const aenderungen = {};

  if (name !== undefined) {
    const sauber = String(name).trim();
    if (!sauber) return { ok: false, error: 'Der Name darf nicht leer sein' };
    if (sauber.length > 40) return { ok: false, error: 'Der Name ist zu lang (höchstens 40 Zeichen)' };
    aenderungen.name = sauber;
    // Kürzel aus den Anfangsbuchstaben, höchstens zwei.
    aenderungen.initials = sauber.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  }

  if (bio !== undefined) {
    const sauber = String(bio).trim();
    if (sauber.length > 150) return { ok: false, error: 'Die Info ist zu lang (höchstens 150 Zeichen)' };
    aenderungen.bio = sauber;
  }

  if (link !== undefined) aenderungen.link = String(link).trim();

  /*
   * Erlaubt ist eine einzelne Farbe oder ein Zwei-Ton-Verlauf. Der Wert landet
   * ungefiltert in einem style-Attribut, deshalb wird er hier eng geprüft und
   * nicht nur auf Länge.
   */
  const istFarbe = /^#[0-9a-fA-F]{6}$/.test(String(color));
  const istVerlauf = /^linear-gradient\(135deg,#[0-9a-fA-F]{6},#[0-9a-fA-F]{6}\)$/.test(String(color));
  if (color !== undefined && (istFarbe || istVerlauf)) aenderungen.color = color;

  if (Object.keys(aenderungen).length === 0) return { ok: false, error: 'Nichts zu ändern' };

  const e = await syncHandlers.handleUpdateProfile(req.db, req.nutzerId, aenderungen);
  if (!e || e.ok === false) return antwort(e);

  const profil = await supabaseApi.ladeProfil(req.db, req.nutzerId);
  return { ok: true, profil };
}));

/*
 * Die eigene Telefonnummer.
 *
 * Gegenstueck zu telefonAendern() in app/lib/aktionen.ts. Bis zum 07.09.2026
 * meldete das Formular „Wir haben dir einen Bestätigungscode geschickt" und
 * tat nichts — kein Code, kein Schreibvorgang. Ein Code bleibt aus, solange
 * kein SMS-Versand eingerichtet ist; gespeichert wird die Nummer jetzt.
 *
 * Die Regel steht in gemeinsam/telefon.js, damit sie hier und in der App
 * dieselbe ist. Warum die Dopplung ueber `finde_per_nummer` geprueft wird und
 * nicht ueber den Eindeutigkeits-Index allein, steht bei telefonAendern() in
 * app/lib/aktionen.ts.
 */
app.post('/api/eigene/telefon', route(async (req) => {
  const grund = Telefon.pruefe(String(req.body?.nummer ?? ''));
  if (grund) return { ok: false, error: grund };

  const sauber = Telefon.speicherform(String(req.body.nummer));

  /*
   * Der Fehlerwert wird ausgewertet, nicht weggeworfen — Begruendung bei
   * telefonAendern() in app/lib/aktionen.ts: seit Schema 38 bremst
   * `finde_per_nummer`, und ein uebersehener Fehler haette die
   * Dopplungspruefung still uebersprungen.
   *
   * 54000 ist der Code der Bremse; deren Text ist fuer Menschen geschrieben
   * und darf raus. Jede andere Datenbankmeldung bleibt drin.
   */
  const { data: schonDa, error: pruefFehler } = await req.db.rpc('finde_per_nummer', {
    nummer: sauber,
  });
  if (pruefFehler) {
    return {
      ok: false,
      error:
        pruefFehler.code === '54000'
          ? pruefFehler.message
          : 'Die Nummer ließ sich gerade nicht prüfen',
    };
  }
  if (schonDa) return { ok: false, error: 'Diese Nummer gehört schon zu einem anderen Konto' };

  const { error } = await req.db
    .from('profiles')
    .update({ phone: sauber, updated_at: new Date().toISOString() })
    .eq('id', req.nutzerId);

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Diese Nummer gehört schon zu einem anderen Konto' };
    }
    return { ok: false, error: 'Die Nummer ließ sich nicht speichern' };
  }
  return { ok: true, nummer: sauber };
}));

app.post('/api/eigene/highlight', route(async (req) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return { ok: false, error: 'Bitte einen Namen eingeben' };
  return antwort(await syncHandlers.handleProfilListe(req.db, req.nutzerId, 'highlights', name));
}));

app.post('/api/eigene/playlist', route(async (req) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return { ok: false, error: 'Bitte einen Namen eingeben' };
  return antwort(await syncHandlers.handleProfilListe(req.db, req.nutzerId, 'playlists', name));
}));

/*
 * Gegenstueck zu den beiden Routen darueber. DELETE und nicht POST, weil es
 * genau das ist — und die Gattung steht im Pfad, nicht im Rumpf: ein DELETE
 * mit Rumpf wird von manchem Zwischenstueck stillschweigend abgeschnitten.
 */
app.delete('/api/eigene/sammlung/:art/:name', route(async (req) => {
  const name = String(req.params.name || '').trim();
  if (!name) return { ok: false, error: 'Bitte einen Namen angeben' };
  return antwort(
    await syncHandlers.handleSammlungLoeschen(req.db, req.nutzerId, req.params.art, name)
  );
}));

app.post('/api/eigene/spende', route(async (req) => {
  const titel = String(req.body?.titel || '').trim();
  if (!titel) return { ok: false, error: 'Bitte einen Titel eingeben' };

  /*
   * Das Ziel ist freiwillig — nicht jede Sammlung läuft auf einen Betrag zu,
   * manche laufen einfach. Freiwillig heißt aber nicht beliebig: Text oder
   * eine negative Zahl werden weiterhin abgelehnt.
   */
  const roh = String(req.body?.ziel ?? '').trim();
  let ziel = 0;
  if (roh) {
    ziel = Number(roh.replace(',', '.'));
    if (!Number.isFinite(ziel) || ziel <= 0) {
      return { ok: false, error: 'Das Spendenziel muss eine Zahl über null sein' };
    }
  }

  const spende = { titel, ziel, gesammelt: 0, text: String(req.body?.text || '').trim() };
  return antwort(await syncHandlers.handleSpende(req.db, req.nutzerId, spende));
}));

const musikAus = (body) => String(body?.music || '').trim() || 'Originalton';

app.post('/api/eigene/beitrag', route(async (req) => {
  const beschreibung = String(req.body?.beschreibung || '').trim();
  if (!beschreibung) return { ok: false, error: 'Bitte eine Beschreibung eingeben' };

  const e = await syncHandlers.handleCreatePost(req.db, req.nutzerId, {
    art: 'post',
    beschreibung,
    ort: String(req.body?.ort || '').trim(),
    musik: musikAus(req.body),
    geplantAb: req.body?.geplantAb || null,
  });
  if (!e || e.ok === false) return antwort(e);

  /*
   * Ein geplanter Beitrag ist noch nicht sichtbar — `beitrag()` fände ihn
   * nicht, weil ladeBeitraege ihn ausfiltert. Deshalb hier nur die Kennung.
   */
  if (req.body?.geplantAb) return { ok: true, beitrag: { id: e.beitrag.id }, geplant: true };

  return { ok: true, beitrag: await beitrag(req, e.beitrag.id) };
}));

app.post('/api/eigene/video', route(async (req) => {
  const beschreibung = String(req.body?.beschreibung || '').trim();
  if (!beschreibung) return { ok: false, error: 'Bitte eine Beschreibung eingeben' };
  const quer = req.body?.format === 'quer';

  const e = await syncHandlers.handleCreatePost(req.db, req.nutzerId, {
    // Querformat ist 'clip', Hochformat 'reel'. Eine eigene Tabelle für
    // Videos gibt es nicht.
    art: quer ? 'clip' : 'reel',
    titel: quer ? beschreibung : '',
    beschreibung,
    ort: String(req.body?.ort || '').trim(),
    musik: musikAus(req.body),
    dauer: quer ? String(req.body?.dauer || '00:15') : null,
    // „Später posten": ein Zeitpunkt in der Zukunft hält den Beitrag zurück.
    geplantAb: req.body?.geplantAb || null,
  });
  if (!e || e.ok === false) return antwort(e);

  const frisch = await beitrag(req, e.beitrag.id);
  return quer ? { ok: true, clip: frisch } : { ok: true, video: frisch };
}));

app.post('/api/eigene/livestream', route(async (req) => {
  if (req.body?.aktion === 'start') {
    const e = await syncHandlers.handleLivestream(req.db, req.nutzerId, {
      seit: Date.now(),
      zuschauer: 0,
    });
    return antwort(e, { live: true });
  }

  const { data: profil } = await req.db.from('profiles').select('live').eq('id', req.nutzerId).maybeSingle();
  const lief = profil?.live;
  await syncHandlers.handleLivestream(req.db, req.nutzerId, null);
  if (!lief) return { ok: true, live: false };

  // Die Aufzeichnung ist ein normales Video, kein laufender Stream — sie
  // gehört unter "Standard", nicht unter "Live".
  const sekunden = Math.max(1, Math.round((Date.now() - lief.seit) / 1000));
  const e = await syncHandlers.handleCreatePost(req.db, req.nutzerId, {
    art: 'clip',
    titel: String(req.body?.titel || '').trim() || 'Livestream-Aufzeichnung',
    dauer: `${String(Math.floor(sekunden / 60)).padStart(2, '0')}:${String(sekunden % 60).padStart(2, '0')}`,
  });
  if (!e || e.ok === false) return antwort(e);

  return { ok: true, live: false, clip: await beitrag(req, e.beitrag.id) };
}));

app.post('/api/eigene/:id/loeschen', route(async (req) => {
  const eigener = await beitrag(req, req.params.id);
  if (!eigener) return { ok: false, error: 'Das gibt es nicht mehr' };
  if (eigener.userId !== 'me') return { ok: false, error: 'Das ist nicht dein Beitrag' };

  const e = await syncHandlers.handleDeleteContent(req.db, req.nutzerId, req.params.id, 'post');
  return antwort(e, { meldung: 'Gelöscht' });
}));

app.post('/api/eigene/:id/sammlung', route(async (req) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return { ok: false, error: 'Bitte eine Sammlung wählen' };

  const eigener = await beitrag(req, req.params.id);
  if (!eigener) return { ok: false, error: 'Das gibt es nicht mehr' };

  /*
   * Bis zum 01.09.2026 gab dieser Endpunkt "Sammlungen sind noch nicht
   * angelegt" zurueck — ehrlich, aber eben auch: die Funktion gab es nicht.
   * Danach schrieb er nach public.sammlung_beitraege.
   *
   * Seit dem 20.09.2026 steht die Zuordnung in sammlungen /
   * sammlung_inhalte (Schema 46). Der Unterschied ist nicht kosmetisch:
   *
   *   - sammlung_beitraege kannte nur Beitraege, keine Storys — ein
   *     Highlight liess sich also gar nicht fuellen, obwohl das Blatt es
   *     anbot.
   *   - Die Sammlung stand dort als Text. Wurde sie umbenannt, waren ihre
   *     Beitraege verwaist, und niemand haette es gemerkt.
   *   - Die App kannte die Tabelle nicht. Website und App haetten dieselbe
   *     Playlist verschieden gefuellt.
   *
   * Die alte Tabelle war beim Umstellen leer — es ist nichts umgezogen und
   * nichts verloren gegangen.
   */
  /*
   * `art` gehoert in die Abfrage, nicht nur der Name. Eine Playlist und ein
   * Highlight duerfen denselben Namen tragen (Schema 46: unique ueber
   * user_id, art, name). Ohne `art` fand maybeSingle beide Zeilen und warf
   * "multiple rows returned" — die Seite bekam einen Fehler 500, und der
   * Pruefsatz "In ein Highlight kommt kein Beitrag" war trotzdem gruen,
   * weil auch ein Absturz keine Aufnahme ist.
   */
  const art = req.body?.art === 'highlight' ? 'highlight' : 'playlist';

  if (art !== 'playlist') {
    return { ok: false, error: `In „${name}" gehören Storys, keine Beiträge` };
  }

  const { data: sammlung, error: suchfehler } = await req.db
    .from('sammlungen')
    .select('id')
    .eq('user_id', req.nutzerId)
    .eq('name', name)
    .eq('art', art)
    .maybeSingle();
  if (suchfehler) throw suchfehler;
  if (!sammlung) return { ok: false, error: `„${name}" gibt es nicht mehr` };

  const { data: schon } = await req.db
    .from('sammlung_inhalte')
    .select('id')
    .eq('sammlung_id', sammlung.id)
    .eq('post_id', req.params.id)
    .maybeSingle();

  if (schon) return { ok: false, error: `„${name}" enthält das schon` };

  const { error } = await req.db
    .from('sammlung_inhalte')
    .insert({ sammlung_id: sammlung.id, post_id: req.params.id });
  if (error) throw error;

  return { ok: true, meldung: `Zu „${name}" hinzugefügt` };
}));

// ============================================================================
// Beiträge, Videos, Clips
// ============================================================================

/*
 * Ein Endpunkt für alle drei. Vorher gab es /posts, /videos und /clips mit je
 * eigener Fassung derselben Aktionen — bei /videos fehlte "save" in Supabase,
 * bei /clips fehlte alles. Jetzt laufen alle drei durch dieselbe Stelle und
 * können gar nicht mehr auseinander liegen.
 */
async function inhaltsAktion(req) {
  const { id, action } = req.params;
  const vorher = await beitrag(req, id);
  if (!vorher) return { fehlt: true };

  const handler = {
    like: () => syncHandlers.handleLikeContent(req.db, req.nutzerId, id),
    save: () => syncHandlers.handleSaveContent(req.db, req.nutzerId, id),
    repost: () => syncHandlers.handleRepostContent(req.db, req.nutzerId, id),
    notify: () => syncHandlers.handleNotifyPost(req.db, req.nutzerId, id),
    share: () => syncHandlers.handleShareContent(req.db, req.nutzerId, id, req.body?.empfaenger || []),
    follow: async () => {
      const autor = vorher.userId === 'me' ? req.nutzerId : vorher.userId;
      return syncHandlers.handleFollowUser(req.db, req.nutzerId, autor);
    },
  }[action];

  if (!handler) return { unbekannt: true };
  const e = await handler();
  if (e && e.ok === false) return { fehler: e.fehler };

  const nachher = await beitrag(req, id);
  // Bei "notify" und "follow" ändert sich am Beitrag selbst nichts — der
  // Zustand kommt aus dem Handler.
  if (action === 'notify') return { ...nachher, notify: e?.notify };
  if (action === 'follow') return { ...nachher, following: e?.folgt };
  return nachher;
}

for (const pfad of ['/api/posts/:id/:action', '/api/videos/:id/:action', '/api/clips/:id/:action']) {
  app.post(pfad, route(async (req, res) => {
    const ergebnis = await inhaltsAktion(req);
    if (ergebnis?.fehlt) return res.status(404).json({ error: 'Nicht gefunden' });
    if (ergebnis?.unbekannt) return res.status(400).json({ error: 'Unbekannte Aktion' });
    if (ergebnis?.fehler) return res.status(500).json({ error: ergebnis.fehler });
    res.json(ergebnis);
  }));
}

app.post('/api/teilen', route(async (req) => {
  const empfaenger = Array.isArray(req.body?.empfaenger) ? req.body.empfaenger : [];
  if (empfaenger.length === 0) return { ok: false, error: 'Bitte mindestens eine Person auswählen' };

  const eintrag = await beitrag(req, req.body?.id);
  if (!eintrag) return { ok: false, error: 'Diesen Beitrag gibt es nicht mehr' };

  const vorschau = eintrag.kind === 'post' ? 'Beitrag geteilt' : 'Video geteilt';

  /*
   * Aus welchem Bereich heraus geteilt wurde. Der Browser schickt ihn mit;
   * alles ausser 'community' gilt als Messenger, damit ein fremder Aufruf
   * keine dritte Liste erfinden kann.
   *
   * Ohne diesen Wert landete jeder geteilte Beitrag im Messenger — auch der
   * aus dem Bereich Communitys. Siehe handleShareToChats.
   */
  const bereich = req.body?.bereich === 'community' ? 'community' : 'messenger';
  const e = await syncHandlers.handleShareToChats(
    req.db,
    req.nutzerId,
    eintrag.id,
    empfaenger,
    vorschau,
    bereich
  );
  // Die Antwort muss die Liste zeigen, in die tatsaechlich geschrieben wurde —
  // sonst sucht der Browser den neuen Chat in der falschen.
  return antwort(e, { bereich, chats: await supabaseApi.ladeChats(req.db, req.nutzerId, bereich, req.schluesselId) });
}));

/*
 * Der Reiter "Reposts".
 *
 * Ohne `?user=` die eigenen. Mit `?user=` die einer anderen Person — der
 * Reiter im fremden Profil stand bis zum 03.09.2026 fest auf "Keine
 * Reposts", ganz gleich, wie viele es waren.
 *
 * Die Repost-Sichtbarkeit steht nicht hier, sondern als Leseregel auf
 * `reposts` (Schema 20): wer sie verbirgt, liefert keine Zeilen. Der Reiter
 * ist dann leer, und die Oberflaeche verraet nichts ueber die Einstellung.
 */
/*
 * Die gespeicherten Beitraege — der Reiter mit dem Lesezeichen.
 *
 * Henrik am 18.09.2026: „Gespeicherte Beitraege werden nicht synchronisiert
 * (unter Videos/Profil kann ich sie nicht sehen)." Der Reiter stand in
 * PROFILE_TABS und hatte nie eine Quelle; `saves` wurde einzig gelesen, um
 * das Lesezeichen im Feed auszufuellen.
 *
 * Absichtlich OHNE `?user=` — anders als Reposts und Markierungen. Was jemand
 * speichert, geht niemanden sonst etwas an. Gleiche Regel in
 * app/lib/aktionen.ts (gespeicherteVon).
 */
/*
 * Sammlungen — Playlists und Highlights (Schema 46).
 *
 * Bis zum 20.09.2026 standen die Namen in `profiles.playlists` und
 * `profiles.highlights`, also in zwei Textlisten. Ein Kreis im Profil hatte
 * deshalb nie ein Vorschaubild, und Antippen konnte nichts zeigen: es gab
 * keine Zuordnung, was darin liegt.
 *
 * Mit `?user=` auch fuer fremde Profile — eine Playlist im fremden Profil
 * ist Teil dieses Profils. Anders als /api/gespeichert und /api/gelikt, die
 * absichtlich nur das eigene Konto kennen.
 */
app.get('/api/sammlungen', route(async (req) => {
  const art = req.query.art === 'highlight' ? 'highlight' : 'playlist';
  const wessen = req.query.user || req.nutzerId;

  const { data, error } = await req.db
    .from('sammlungen')
    .select(`id, art, name, created_at,
             sammlung_inhalte ( created_at,
               posts!post_id (thumbnail_url, media_url),
               stories!story_id (media_url) )`)
    .eq('user_id', wessen)
    .eq('art', art)
    .order('created_at', { ascending: true });
  if (error) throw error;

  /*
   * Unterschreiben, bevor gerechnet wird. Der Eimer ist seit Schema 23
   * nicht mehr oeffentlich; eine rohe media_url fuehrt ins Leere, und zwar
   * ohne Fehlermeldung — der Kreis bliebe einfach grau, und niemand wuesste
   * warum.
   */
  const signiert = await signiereMedien(req.db, data || []);

  return signiert.map((s) => {
    const inhalte = s.sammlung_inhalte || [];
    // Das zuletzt Hinzugefuegte ist das Bild der Sammlung. Dieselbe Regel
    // wie in app/lib/aktionen.ts (sammlungenVon) — sonst zeigten App und
    // Website verschiedene Kreise fuer dieselbe Sammlung.
    const neueste = [...inhalte].sort((a, b) =>
      String(b.created_at).localeCompare(String(a.created_at)));
    const treffer = neueste.find((i) => i.posts || i.stories);
    return {
      id: s.id,
      art: s.art,
      name: s.name,
      anzahl: inhalte.length,
      // Leer ist ein gueltiger Zustand, keine Panne: eine gerade angelegte
      // Sammlung hat noch kein Bild.
      bild: treffer
        ? (treffer.posts?.thumbnail_url || treffer.posts?.media_url
           || treffer.stories?.media_url || null)
        : null,
    };
  });
}));

/*
 * Was in einer Sammlung liegt.
 *
 * Die Beitraege kommen bewusst durch `ladeBeitraege` und nicht direkt aus
 * der Tabelle: dort werden die Medienadressen unterschrieben und in
 * dieselben Feldnamen gebracht, die /api/gespeichert und /api/reposts schon
 * liefern (mediaUrl, thumbnail). Direkt gelesen hiessen sie media_url und
 * thumbnail_url — die Kacheln blieben dann leer, und zwar lautlos.
 */
app.get('/api/sammlung/:id', route(async (req) => {
  const { data, error } = await req.db
    .from('sammlung_inhalte')
    .select('post_id, story_id, position, created_at')
    .eq('sammlung_id', req.params.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;

  const zeilen = data || [];
  if (!zeilen.length) return [];

  const postIds = zeilen.filter((z) => z.post_id).map((z) => z.post_id);
  const storyIds = zeilen.filter((z) => z.story_id).map((z) => z.story_id);

  const beitraege = new Map();
  if (postIds.length) {
    const alle = await supabaseApi.ladeBeitraege(req.db, req.nutzerId, { limit: 500 });
    for (const b of alle) if (postIds.includes(b.id)) beitraege.set(b.id, b);
  }

  const storys = new Map();
  if (storyIds.length) {
    const { data: roh, error: storyFehler } = await req.db
      .from('stories')
      .select('id, media_url, created_at')
      .in('id', storyIds);
    if (storyFehler) throw storyFehler;
    for (const s of await signiereMedien(req.db, roh || [])) {
      storys.set(s.id, { id: s.id, mediaUrl: s.media_url, thumbnail: null, kind: 'story' });
    }
  }

  // Die Reihenfolge der Sammlung gewinnt, nicht die der Nachfrage.
  return zeilen
    .map((z) => {
      if (z.post_id) {
        const b = beitraege.get(z.post_id);
        return b
          ? { art: b.kind === 'post' ? 'post' : b.kind === 'clip' ? 'clip' : 'video', eintrag: b }
          : null;
      }
      const s = storys.get(z.story_id);
      return s ? { art: 'story', eintrag: s } : null;
    })
    .filter(Boolean);
}));

app.get('/api/gespeichert', route(async (req) => {
  const { data, error } = await req.db
    .from('saves')
    .select('post_id, created_at')
    .eq('user_id', req.nutzerId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const ids = new Set((data || []).map((z) => z.post_id));
  if (ids.size === 0) return [];

  const alle = await supabaseApi.ladeBeitraege(req.db, req.nutzerId, { limit: 500 });
  return alle
    .filter((b) => ids.has(b.id))
    .map((b) => ({ art: b.kind === 'post' ? 'post' : b.kind === 'clip' ? 'clip' : 'video', eintrag: b }));
}));

/*
 * Die gelikten Beitraege — die Liste in den Einstellungen unter „Videos".
 *
 * Henrik am 18.09.2026: „Likes ... werden nicht synchronisiert (unter
 * Videos/Profil kann ich sie nicht sehen)." Synchronisiert waren sie;
 * `post_likes` wurde nur gelesen, um das Herz im Feed rot zu faerben.
 *
 * KEIN fuenfter Profilreiter: der Prototyp zeigt dort genau vier. Deshalb
 * auch nur Text und kein Raster — der Einstellungsbereich kennt Zeilen.
 *
 * Wie bei /api/gespeichert absichtlich ohne `?user=`. Gleiche Regel in
 * app/lib/aktionen.ts (gelikteVon), gleiche Ersatztexte.
 */
app.get('/api/gelikt', route(async (req) => {
  const { data, error } = await req.db
    .from('post_likes')
    .select('post_id, created_at, posts!post_id(id, kind, title, description)')
    .eq('user_id', req.nutzerId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const ART = { post: 'Foto', reel: 'Video (Hochformat)', clip: 'Video' };
  return (data || [])
    .filter((z) => z.posts)
    .map((z) => {
      const b = z.posts;
      const text = (b.title || b.description || '').trim();
      return { id: b.id, kind: b.kind, titel: text || ART[b.kind] || 'Beitrag', wann: z.created_at };
    });
}));

/*
 * Die eigenen Kommentare — die Liste in den Einstellungen unter „Videos".
 *
 * Die vierte Gattung aus Henriks Meldung vom 18.09.2026 („Likes, Kommentare,
 * Reposts, Gespeicherte ... unter Videos/Profil kann ich sie nicht sehen").
 * Die anderen drei haben an dem Tag ihren Ort bekommen, diese hier erst am
 * 21.09.2026 — es gab für sie nirgends eine Ansicht.
 *
 * Der Zeilentext kommt aus gemeinsam/kommentar.js, damit die App daneben
 * nicht ihre eigene Fassung baut. Wie /api/gelikt absichtlich ohne `?user=`:
 * fremde Kommentarlisten gehen niemanden etwas an.
 */
app.get('/api/kommentiert', route(async (req) => {
  const { data, error } = await req.db
    .from('comments')
    .select('id, text, created_at, post_id, posts!post_id(id, kind, title, description)')
    .eq('user_id', req.nutzerId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data || [])
    .filter((z) => z.posts)
    .map((z) => {
      const k = {
        id: z.id,
        beitragId: z.posts.id,
        kind: z.posts.kind,
        text: (z.text || '').trim(),
        beitrag: Kommentar.beitragsName(z.posts),
        wann: z.created_at,
      };
      // Fertig gerechnet, damit der Browser die Regel nicht nachbaut.
      return { ...k, zeile: Kommentar.zeile(k) };
    });
}));

app.get('/api/reposts', route(async (req) => {
  const wessen = req.query.user ? String(req.query.user) : req.nutzerId;
  const { data, error } = await req.db.from('reposts').select('post_id').eq('user_id', wessen);
  if (error) throw error;

  const ids = new Set((data || []).map((r) => r.post_id));
  const alle = await supabaseApi.ladeBeitraege(req.db, req.nutzerId, { limit: 500 });
  return alle
    .filter((b) => ids.has(b.id))
    .map((b) => ({ art: b.kind === 'post' ? 'post' : b.kind === 'clip' ? 'clip' : 'video', eintrag: b }));
}));

/*
 * Der Reiter "Markiert" im Profil.
 *
 * Er war bei jedem Menschen leer — nicht, weil niemand markiert war, sondern
 * weil es Markierungen gar nicht gab. Seit dem 03.09.2026 gibt es
 * `post_tags`; markiert wird ueber die @-Namen in der Beschreibung.
 */
app.get('/api/markierungen', route(async (req) => {
  // Wie bei den Reposts: ohne `?user=` die eigenen Markierungen.
  const wessen = req.query.user ? String(req.query.user) : req.nutzerId;
  const { data, error } = await req.db
    .from('post_tags')
    .select('post_id, created_at')
    .eq('user_id', wessen)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const ids = new Set((data || []).map((z) => z.post_id));
  if (ids.size === 0) return [];

  const alle = await supabaseApi.ladeBeitraege(req.db, req.nutzerId, { limit: 500 });
  return alle
    .filter((b) => ids.has(b.id))
    .map((b) => ({ art: b.kind === 'post' ? 'post' : b.kind === 'clip' ? 'clip' : 'video', eintrag: b }));
}));

// ============================================================================
// Kommentare
// ============================================================================

app.get('/api/comments/:targetId', route(async (req) =>
  supabaseApi.ladeKommentare(req.db, req.nutzerId, req.params.targetId)
));

app.post('/api/comments/:targetId', route(async (req) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return { ok: false, error: 'Text erforderlich' };

  const e = await syncHandlers.handleCreateComment(req.db, req.nutzerId, req.params.targetId, text);
  if (!e || e.ok === false) return antwort(e);

  return {
    id: e.kommentar.id,
    userId: 'me',
    text,
    time: supabaseApi.chatZeit(e.kommentar.created_at),
    likes: 0,
    liked: false,
  };
}));

app.post('/api/comments/:targetId/:commentId/like', route(async (req) => {
  const e = await syncHandlers.handleLikeComment(req.db, req.nutzerId, req.params.commentId);
  if (!e || e.ok === false) return antwort(e);

  const alle = await supabaseApi.ladeKommentare(req.db, req.nutzerId, req.params.targetId);
  return alle.find((k) => k.id === req.params.commentId) || { ok: true };
}));

// ============================================================================
// Storys
// ============================================================================

/*
 * Eine eigene Story anlegen.
 *
 * Diese Route fehlte bis zum 09.09.2026 vollstaendig. `handleCreateStory`
 * stand seit Langem in sync-handlers.js, aber niemand rief ihn auf: die
 * Website legte die Aufnahme in den `localStorage` und meldete „Deine Story
 * ist online". Sie war es nie — kein anderes Geraet und kein anderes Konto
 * hat je eine Story von der Website gesehen.
 *
 * Aufgefallen beim Umbau der Story-Trennung (Henrik, 07.09.2026): die Frage
 * „auch unter Videos?" ist sinnlos, solange die Story nirgends ankommt.
 *
 * Zurueck geht die frisch geladene Leiste, damit die Oberflaeche nicht raten
 * muss, wie ihre eigene Kachel jetzt aussieht.
 */
app.post('/api/stories', route(async (req) => {
  const e = await syncHandlers.handleCreateStory(req.db, req.nutzerId, {
    mediaUrl: req.body?.mediaUrl || null,
    mediaTyp: req.body?.mediaTyp || 'image',
    text: req.body?.text || '',
    inVideos: Boolean(req.body?.inVideos),
  });
  if (!e || e.ok === false) return antwort(e);

  const listen = await supabaseApi.ladeStorys(req.db, req.nutzerId);
  return { ok: true, stories: listen.messenger, storiesVideos: listen.videos };
}));

/*
 * Story loeschen.
 *
 * Vorher strich die Website die eigene Story nur aus dem Browserspeicher —
 * in der Datenbank blieb sie stehen und war beim naechsten Laden wieder da.
 * Seit die Website ihre Storys wirklich anlegt (siehe oben), muss sie sie
 * auch wirklich loeschen koennen.
 *
 * Geprueft wird ueber die geloeschte Zeile: unter RLS meldet ein
 * abgelehntes DELETE keinen Fehler, es trifft nur nichts.
 */
app.post('/api/stories/:id/loeschen', route(async (req) => {
  const { data, error } = await req.db
    .from('stories')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.nutzerId)
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: 'Das ist nicht deine Story' };

  const listen = await supabaseApi.ladeStorys(req.db, req.nutzerId);
  return { ok: true, stories: listen.messenger, storiesVideos: listen.videos };
}));

/*
 * Wer hat meine Story gesehen?
 *
 * Vorher erfand die Oberflaeche die Liste: sie nahm die ersten n Kontakte,
 * n aus der Aufnahmezeit gerechnet. Die Zahl stimmte nie und die Namen
 * schon gar nicht. Die Wahrheit steht in public.story_views (Schema 2);
 * lesen darf sie laut RLS nur, wem die Story gehoert.
 */
app.get('/api/stories/:id/ansichten', route(async (req) => {
  const { data: eigene } = await req.db
    .from('stories')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.nutzerId)
    .maybeSingle();
  if (!eigene) return { ok: false, error: 'Das ist nicht deine Story' };

  const { data, error } = await req.db
    .from('story_views')
    .select('user_id, viewed_at')
    .eq('story_id', req.params.id)
    .order('viewed_at', { ascending: false });
  if (error) return { ok: false, error: error.message };

  const ids = (data || []).map((z) => z.user_id).filter((id) => id !== req.nutzerId);
  if (ids.length === 0) return { ok: true, seher: [] };

  const { data: profile } = await req.db
    .from('profiles')
    .select('id, name, handle, initials, color')
    .in('id', ids);
  const nach = new Map((profile || []).map((p) => [p.id, p]));

  return {
    ok: true,
    seher: ids
      .filter((id) => nach.has(id))
      .map((id) => {
        const p = nach.get(id);
        const zeile = (data || []).find((z) => z.user_id === id);
        return {
          id,
          name: p.name || '',
          handle: p.handle || '',
          initials: p.initials || '',
          color: p.color || '',
          zeit: zeile?.viewed_at || null,
        };
      }),
  };
}));

app.post('/api/stories/:id/like', route(async (req) => {
  const e = await syncHandlers.handleLikeStory(req.db, req.nutzerId, req.params.id);
  if (!e || e.ok === false) return antwort(e);
  /*
   * ladeStorys() liefert seit dem 07.09.2026 zwei Listen (Messenger und
   * Videos). Gesucht wird in beiden: geliked werden kann eine Story aus
   * jedem der beiden Bereiche.
   */
  const listen = await supabaseApi.ladeStorys(req.db, req.nutzerId);
  const alle = [...listen.messenger, ...listen.videos];
  return alle.find((s) => s.id === req.params.id) || { ok: true };
}));

app.post('/api/stories/:id/seen', route(async (req) =>
  antwort(await syncHandlers.handleViewStory(req.db, req.nutzerId, req.params.id))
));

app.post('/api/stories/:id/reply', route(async (req) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return { ok: false, error: 'Bitte etwas schreiben' };

  const e = await syncHandlers.handleStoryReply(req.db, req.nutzerId, req.params.id, text);
  if (!e || e.ok === false) return antwort(e);

  return {
    ok: true,
    chatId: e.chatId,
    message: {
      id: e.nachricht.id,
      from: 'me',
      text,
      time: supabaseApi.chatZeit(e.nachricht.created_at),
    },
  };
}));

// ============================================================================
// Communitys
// ============================================================================

app.get('/api/communities', route(async (req) => {
  const alle = await supabaseApi.ladeCommunities(req.db, req.nutzerId);
  const filter = req.query.filter || 'joined';
  return alle.filter((c) => (filter === 'discover' ? !c.joined : c.joined));
}));

app.get('/api/communities/:id', route(async (req, res) => {
  const alle = await supabaseApi.ladeCommunities(req.db, req.nutzerId);
  const community = alle.find((c) => c.id === req.params.id);
  if (!community) return res.status(404).json({ error: 'Nicht gefunden' });
  res.json(community);
}));

app.post('/api/communities', route(async (req) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return { ok: false, error: 'Bitte einen Namen eingeben' };

  const { count } = await req.db
    .from('communities')
    .select('*', { count: 'exact', head: true })
    .ilike('name', name);
  if (count > 0) return { ok: false, error: 'Diesen Kanal gibt es schon' };

  const privat = req.body?.sichtbarkeit !== 'public';
  const e = await syncHandlers.handleCreateCommunity(
    req.db, req.nutzerId, name, String(req.body?.thema || '').trim(), privat
  );
  if (!e || e.ok === false) return antwort(e);

  // Eine Community ohne Kanal hat keine Seite, auf der etwas stehen könnte.
  await syncHandlers.handleCreateChannel(req.db, req.nutzerId, e.community.id, 'Allgemein');

  const alle = await supabaseApi.ladeCommunities(req.db, req.nutzerId);
  return { ok: true, community: alle.find((c) => c.id === e.community.id) };
}));

app.post('/api/communities/:id/join', route(async (req, res) => {
  const alle = await supabaseApi.ladeCommunities(req.db, req.nutzerId);
  const community = alle.find((c) => c.id === req.params.id);
  if (!community) return res.status(404).json({ error: 'Nicht gefunden' });

  /*
   * Aus der eigenen Community kann man nicht austreten. Die Oberfläche zeigt
   * dort keinen Knopf — der Server sagt trotzdem nein, denn eine Regel, die
   * nur im Markup steht, ist keine.
   */
  if (community.eigen) {
    return res.status(409).json({ error: 'Die eigene Community lässt sich nicht verlassen' });
  }

  await syncHandlers.handleJoinCommunity(req.db, req.nutzerId, req.params.id);
  const frisch = await supabaseApi.ladeCommunities(req.db, req.nutzerId);
  res.json(frisch.find((c) => c.id === req.params.id));
}));

/*
 * Eine Community stummschalten. Der Schalter „Benachrichtigungen" im
 * Community-Blatt legte bis zum 02.09.2026 nur eine CSS-Klasse um.
 */
app.post('/api/communities/:id/stumm', route(async (req) =>
  antwort(await syncHandlers.handleCommunityStumm(req.db, req.nutzerId, req.params.id))
));

app.post('/api/communities/:id/channels', route(async (req) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return { ok: false, error: 'Bitte einen Namen eingeben' };
  const e = await syncHandlers.handleCreateChannel(req.db, req.nutzerId, req.params.id, name);
  if (!e || e.ok === false) return antwort(e);
  return { ok: true, id: e.kanal.id, name: e.kanal.name };
}));

app.get('/api/communities/:id/channels/:chId', route(async (req, res) => {
  const alle = await supabaseApi.ladeCommunities(req.db, req.nutzerId);
  const community = alle.find((c) => c.id === req.params.id);
  const kanal = community?.channels.find((k) => k.id === req.params.chId || k.slug === req.params.chId);
  if (!community || !kanal) return res.status(404).json({ error: 'Nicht gefunden' });

  res.json({
    community: community.name,
    channel: kanal.name,
    topics: kanal.topics,
    messages: await supabaseApi.ladeKanalNachrichten(req.db, req.nutzerId, kanal.id),
  });
}));

app.post('/api/communities/:id/channels/:chId/nachricht', route(async (req) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return { ok: false, error: 'Text erforderlich' };
  const e = await syncHandlers.handleSendChannelMessage(req.db, req.nutzerId, req.params.chId, text);
  if (!e || e.ok === false) return antwort(e);
  return {
    ok: true,
    message: {
      id: e.nachricht.id,
      from: 'me',
      text,
      time: supabaseApi.chatZeit(e.nachricht.created_at),
    },
  };
}));

/**
 * Ein Anhang im Unterthema — Handbuch-Abgleich 01.09.2026, letzter Punkt
 * („Sticker innerhalb von Community-Kanaelen"; im Privatchat gibt es sie).
 *
 * Dieselbe Uebersetzung wie im Chat (anhangDeuten), nur die Ablage ist eine
 * andere. Die Spalten dafuer stehen seit SUPABASE_SCHEMA_25_kanal_anhang.sql.
 *
 * „Standort anfragen" fehlt hier mit Absicht: die Anfrage richtet sich an
 * eine bestimmte Person, und ein Kanal hat kein Gegenueber. Im Handbuch
 * steht sie ausdruecklich unter „im Privatchat".
 */
app.post('/api/communities/:id/channels/:chId/anhang', route(async (req) => {
  const gedeutet = await anhangDeuten(req, req.body?.art);
  if (gedeutet.error) return { ok: false, error: gedeutet.error };
  const { text, medien } = gedeutet;

  const e = await syncHandlers.handleSendChannelMessage(
    req.db, req.nutzerId, req.params.chId, text, medien
  );
  if (!e || e.ok === false) return antwort(e);

  /*
   * Die fertige Karte zurueckgeben, nicht nur den Satz: die Seite zeichnet
   * sofort neu, ohne den Kanal noch einmal zu holen. Ohne diesen Schritt
   * stuende bis zum naechsten Laden „Standort: Zugspitze" statt der Karte.
   */
  const frisch = await supabaseApi.ladeKanalNachrichten(req.db, req.nutzerId, req.params.chId);
  const angelegt = (frisch || []).find((m) => m.id === e.nachricht.id);

  return {
    ok: true,
    message: angelegt || {
      id: e.nachricht.id,
      from: 'me',
      text,
      media: medien.typ,
      time: supabaseApi.chatZeit(e.nachricht.created_at),
    },
  };
}));

// ============================================================================
// Mitteilungen
// ============================================================================

/**
 * Woran ein Herz hängen kann. Seit Schema 49 gibt es auch Herzen an
 * Kommentaren — ohne diese Liste hieße es dort "gefällt dein Beitrag".
 */
const GEGENSTAND = { video: 'Video', comment: 'Kommentar', post: 'Beitrag' };

/**
 * Der Satz entsteht erst hier, gespeichert ist nur, was passiert ist. Sonst
 * müsste bei jeder Textänderung der ganze Bestand mitwandern.
 */
function mitteilungText(m, namen, communityNamen) {
  const name = namen.get(m.userId) || 'Jemand';
  const community = communityNamen.get(m.ziel?.id) || 'einer Community';
  return {
    like: `${name} gefällt dein ${GEGENSTAND[m.ziel?.art] || 'Beitrag'}.`,
    follow: `${name} folgt dir jetzt.`,
    comment: `${name} hat deinen Beitrag kommentiert.`,
    repost: `${name} hat dein Video repostet.`,
    mention: m.ziel?.art === 'post'
      ? `${name} hat dich in einem Beitrag markiert.`
      : `${name} hat dich in einem Kommentar erwähnt.`,
    anfrage: `${name} möchte mit dir schreiben.`,
    anfrage_ok: `${name} hat deine Anfrage angenommen.`,
    messenger_anfrage: `${name} möchte mit dir in den Messenger wechseln.`,
    messenger_ok: `${name} ist jetzt in deinem Messenger.`,
    story: `${name} hat auf deine Story geantwortet.`,
    kanal: `${name} hat einen neuen Kanal in „${community}" erstellt.`,
    beitritt: `${name} ist „${community}" beigetreten.`,
    nachricht: `Neue Nachrichten in „${community}".`,
    einladung: `${name} hat dich zu „${community}" eingeladen.`,
    share: `${name} hat etwas mit dir geteilt.`,
    message: `${name} hat dir geschrieben.`,
    system: m.text || 'Es gibt Neuigkeiten.',
  }[m.art] || m.text || '';
}

app.get('/api/mitteilungen/:bereich', route(async (req) => {
  const [eintraege, nutzer, communities] = await Promise.all([
    supabaseApi.ladeBenachrichtigungen(req.db, req.nutzerId, req.params.bereich),
    supabaseApi.ladeNutzer(req.db, req.nutzerId),
    supabaseApi.ladeCommunities(req.db, req.nutzerId),
  ]);

  const namen = new Map(Object.values(nutzer).map((u) => [u.id, u.name]));
  const communityNamen = new Map(communities.map((c) => [c.id, c.name]));

  const fertig = eintraege.map((m) => ({ ...m, text: m.text || mitteilungText(m, namen, communityNamen) }));
  return { eintraege: fertig, ungelesen: fertig.filter((m) => !m.gelesen).length };
}));

app.post('/api/mitteilungen/:id/gelesen', route(async (req) => {
  const e = await syncHandlers.handleMarkNotificationRead(req.db, req.nutzerId, req.params.id);
  if (!e || e.ok === false) return antwort(e);

  const { count } = await req.db
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', req.nutzerId)
    .is('read_at', null);
  return { ok: true, ungelesen: count ?? 0 };
}));

app.post('/api/mitteilungen/:bereich/alle-gelesen', route(async (req) =>
  antwort(
    await syncHandlers.handleMarkAllNotificationsRead(req.db, req.nutzerId, req.params.bereich),
    { ungelesen: 0 }
  )
));

// ============================================================================
// Explorer: was hinter einem Hashtag, Standort oder Sound steckt
// ============================================================================

app.get('/api/explorer/:art/:wert', route(async (req) => {
  const { art } = req.params;
  const wert = decodeURIComponent(req.params.wert);
  const beitraege = await supabaseApi.ladeBeitraege(req.db, req.nutzerId, { limit: 500 });

  let passt;
  let kopf;

  if (art === 'hashtag') {
    const tag = wert.startsWith('#') ? wert : `#${wert}`;
    const alle = await supabaseApi.ladeHashtags(req.db);
    passt = (e) => (e.tags || []).includes(tag);
    kopf = { art, titel: tag, anzahl: alle.find((h) => h.tag === tag)?.posts || 0 };
  } else if (art === 'standort') {
    /*
     * Auch nach `ort` suchen, nicht nur nach Kennung und Name: an einem
     * Beitrag steht "Hamburg", der Standort heißt aber "Hamburger Hafen" und
     * trägt "Hamburg" nur im Feld `ort`.
     */
    const standorte = await supabaseApi.ladeStandorte(req.db);
    const platz =
      standorte.find((p) => p.id === wert || p.name === wert) || standorte.find((p) => p.ort === wert);
    if (!platz) return { ok: false, error: 'Diesen Standort gibt es nicht' };
    passt = (e) => e.location === platz.ort;
    kopf = {
      art, id: platz.id, titel: platz.name, anzahl: platz.posts,
      adresse: platz.adresse, koordinaten: platz.koordinaten, x: platz.x, y: platz.y,
      // Fuer die grosse Karte: alle Orte, damit man von dort weiterspringen kann.
      orte: standorte.map((o) => ({ id: o.id, name: o.name, koordinaten: o.koordinaten })),
    };
  } else if (art === 'sound') {
    /*
     * An einem Beitrag steht "Golden Hour – Lys", der Sound heißt aber nur
     * "Golden Hour" — der Teil hinter dem Gedankenstrich ist der Interpret.
     * "Originalton" ist kein Eintrag und fällt bewusst in die Fehlermeldung:
     * dahinter steckt keine Seite.
     */
    const titelTeil = wert.split(/\s+[–—-]\s+/)[0].trim();
    const sounds = await supabaseApi.ladeSounds(req.db);
    const sound =
      sounds.find((s) => s.id === wert || s.title === wert) || sounds.find((s) => s.title === titelTeil);
    if (!sound) {
      return {
        ok: false,
        error: wert === 'Originalton' ? 'Originalton hat keine eigene Seite' : 'Diesen Sound gibt es nicht',
      };
    }
    passt = (e) => typeof e.music === 'string' && e.music.startsWith(sound.title);
    kopf = {
      art, titel: sound.title, produzent: sound.artist,
      anzahl: sound.uses, dauer: sound.dauer, lyrics: sound.lyrics,
      songwriter: sound.songwriter, cover: sound.cover, audio: sound.audio,
    };
  } else {
    return { ok: false, error: 'Unbekannter Bereich' };
  }

  return {
    ok: true,
    kopf,
    reels: beitraege.filter((b) => b.kind === 'reel' && passt(b)),
    clips: beitraege.filter((b) => b.kind === 'clip' && passt(b)),
    beitraege: beitraege.filter((b) => b.kind === 'post' && passt(b)),
  };
}));


// ============================================================================
// Was das Handbuch verlangt — nachgetragen am 01.09.2026
//
// Die Gegenstücke in der App stehen in app/lib/useAktionen.ts.
// ============================================================================

// ------------------------------------------------------------- Insights --
//
//  Ein *Insight* ist ein Foto oder Video an ausgewählte Personen — das
//  Snapchat-Äquivalent. Die *Insight Time* zählt die Tage in Folge, an denen
//  sich beide Seiten gegenseitig einen geschickt haben. Nicht zu verwechseln
//  mit den „Insights" im Einstellungsmenü: das ist Statistik zum Profil.

app.get('/api/insights', route(async (req) => ({
  ok: true,
  insights: await supabaseApi.ladeInsights(req.db, req.nutzerId),
  streaks: await supabaseApi.ladeInsightStreaks(req.db, req.nutzerId),
  ziele: await supabaseApi.ladeInsightZiele(req.db, req.nutzerId),
})));

app.post('/api/insights', route(async (req) => {
  const { empfaenger, ...felder } = req.body || {};
  return antwort(await syncHandlers.handleInsightSenden(req.db, req.nutzerId, empfaenger, felder));
}));

app.post('/api/insights/:id/gesehen', route(async (req) =>
  antwort(await syncHandlers.handleInsightGesehen(req.db, req.nutzerId, req.params.id))
));

app.post('/api/insights/:id/speichern', route(async (req) =>
  antwort(
    await syncHandlers.handleInsightSpeichern(
      req.db, req.nutzerId, req.params.id, req.body?.behalten
    )
  )
));

app.post('/api/insights/:id/wiederholen', route(async (req) =>
  antwort(
    await syncHandlers.handleInsightWiederholen(
      req.db, req.nutzerId, req.params.id, req.body?.empfaenger || []
    )
  )
));

app.post('/api/insights/ziele/:userId', route(async (req) =>
  antwort(await syncHandlers.handleInsightZiel(req.db, req.nutzerId, req.params.userId))
));

// ------------------------------------------------ Nachrichten-Werkzeuge --

app.post('/api/messages/:chatId/:messageId/bearbeiten', route(async (req) =>
  antwort(
    await syncHandlers.handleNachrichtBearbeiten(
      req.db, req.nutzerId, req.params.messageId, req.body?.text || ''
    )
  )
));

app.post('/api/messages/:chatId/:messageId/zuruecknehmen', route(async (req) =>
  antwort(
    await syncHandlers.handleNachrichtZuruecknehmen(req.db, req.nutzerId, req.params.messageId)
  )
));

app.post('/api/messages/:chatId/:messageId/weiterleiten', route(async (req) =>
  antwort(
    await syncHandlers.handleNachrichtWeiterleiten(
      req.db, req.nutzerId, req.params.messageId, req.body?.chatIds || []
    )
  )
));

app.post('/api/messages/:chatId/:messageId/reaktion', route(async (req) =>
  antwort(
    await syncHandlers.handleNachrichtReaktion(
      req.db, req.nutzerId, req.params.messageId, req.body?.emoji || '👍'
    )
  )
));

// -------------------------------------------------------------- Umfragen --

app.get('/api/umfragen/:art', route(async (req) => ({
  ok: true,
  umfragen: await supabaseApi.ladeUmfragen(
    req.db, req.nutzerId, req.params.art, (req.query.ids || '').split(',').filter(Boolean)
  ),
})));

app.post('/api/umfragen/:art/:traegerId', route(async (req) =>
  antwort(
    await syncHandlers.handleUmfrageAnlegen(
      req.db, req.nutzerId, req.params.art, req.params.traegerId, req.body || {}
    )
  )
));

app.post('/api/umfragen/:pollId/stimme/:optionId', route(async (req) =>
  antwort(
    await syncHandlers.handleUmfrageStimmen(
      req.db, req.nutzerId, req.params.pollId, req.params.optionId
    )
  )
));

// ---------------------------------------------------- Sichtbarkeit (4x) --
//
//  Vier Stufen mit Ausnahmelisten. Vorher standen hier drei, und „Alle bis
//  auf meinen Chef" ließ sich nicht ausdrücken.

app.get('/api/sichtbarkeit', route(async (req) => ({
  ok: true,
  sichtbarkeit: await supabaseApi.ladeSichtbarkeit(req.db, req.nutzerId),
})));

app.post('/api/sichtbarkeit/:bereich', route(async (req) =>
  antwort(
    await syncHandlers.handleSichtbarkeit(
      req.db, req.nutzerId, req.params.bereich, req.body?.stufe
    )
  )
));

/*
 * Der Zusatz „Story auch in Videos teilen". Eigene Route und kein Bereich
 * unter /api/sichtbarkeit/: er ist keine Stufe, sondern ein Ja/Nein, und die
 * Bereichsroute prueft gegen die Liste der zehn Bereiche.
 */
app.post('/api/story-in-videos', route(async (req) =>
  antwort(await syncHandlers.handleStoryInVideos(req.db, req.nutzerId, req.body?.an))
));

app.post('/api/sichtbarkeit/:bereich/ausnahme/:userId', route(async (req) =>
  antwort(
    await syncHandlers.handleSichtbarkeitAusnahme(
      req.db, req.nutzerId, req.params.bereich, req.params.userId
    )
  )
));

// ------------------------------------------------------- Altersschutz --

app.post('/api/alter', route(async (req) =>
  antwort(
    await syncHandlers.handleAltersangabe(
      req.db, req.nutzerId, req.body?.geburtsdatum, req.body?.guardian
    )
  )
));

app.post('/api/alter/freigabe/:kindId', route(async (req) =>
  antwort(
    await syncHandlers.handleFreigabe(
      req.db, req.nutzerId, req.params.kindId, req.body?.zustimmen !== false
    )
  )
));

// --------------------------------------------------------- Wortfilter --

app.post('/api/wortfilter', route(async (req) =>
  antwort(await syncHandlers.handleWortfilter(req.db, req.nutzerId, req.body?.text || ''))
));

app.get('/api/banne', route(async (req) => ({
  ok: true,
  banne: await supabaseApi.ladeBanne(req.db, req.nutzerId),
})));

// ------------------------------------------------------- Push-to-Talk --

app.get('/api/communities/:id/ptt', route(async (req) => ({
  ok: true,
  ptt: await supabaseApi.ladePtt(req.db, req.params.id),
})));

app.post('/api/communities/:id/ptt', route(async (req) =>
  antwort(
    await syncHandlers.handlePtt(
      req.db, req.nutzerId, req.params.id,
      req.body?.audioUrl, req.body?.dauer, req.body?.kanalId
    )
  )
));

// ------------------------------------------- Livestream: Kommentare, Spenden

/*
 * Einen laufenden Stream als Beitrag anlegen.
 *
 * Er entsteht beim Start und nicht erst am Ende, weil Kommentare und Spenden
 * etwas brauchen, worauf sie sich beziehen können. Am Ende bleibt derselbe
 * Beitrag als Aufzeichnung stehen — ein zweiter wäre ein Duplikat, und die
 * Kommentare klebten am falschen.
 */
app.post('/api/stream/start', route(async (req) => {
  const e = await syncHandlers.handleCreatePost(req.db, req.nutzerId, {
    art: 'clip',
    titel: 'Livestream',
    beschreibung: 'Läuft gerade',
  });
  if (!e || e.ok === false) return antwort(e);
  return { ok: true, id: e.beitrag.id };
}));

app.get('/api/stream/:postId/kommentare', route(async (req) => ({
  ok: true,
  kommentare: await supabaseApi.ladeStreamKommentare(req.db, req.params.postId),
})));

app.post('/api/stream/:postId/kommentare', route(async (req) =>
  antwort(
    await syncHandlers.handleStreamKommentar(
      req.db, req.nutzerId, req.params.postId, req.body?.text || ''
    )
  )
));

app.post('/api/spenden/:userId', route(async (req) =>
  antwort(
    await syncHandlers.handleSpende2(
      req.db, req.nutzerId, req.params.userId,
      req.body?.betragCent, req.body?.postId, req.body?.nachricht
    )
  )
));

// ------------------------------------------------------ Standortanfrage --

app.get('/api/chats/:chatId/standortanfragen', route(async (req) => ({
  ok: true,
  anfragen: await supabaseApi.ladeStandortanfragen(req.db, req.params.chatId),
})));

app.post('/api/chats/:chatId/standortanfrage', route(async (req) =>
  antwort(
    await syncHandlers.handleStandortAnfrage(
      req.db, req.nutzerId, req.params.chatId, req.body?.zielId
    )
  )
));

app.post('/api/standortanfragen/:id/antwort', route(async (req) =>
  antwort(
    await syncHandlers.handleStandortAntwort(
      req.db, req.nutzerId, req.params.id,
      req.body?.annehmen !== false, req.body?.stunden
    )
  )
));

/*
 * Gesehene Beitraege — gebuendelt, nicht einzeln.
 *
 * Wer zwei Minuten durch den Feed scrollt, hat zwanzig Sichtungen
 * gesammelt; zwanzig Anfragen dafuer waeren zwanzig Gelegenheiten zu
 * scheitern. Die Seite sammelt und schickt einmal — siehe
 * web/public/impressionen.js und, wortgleich, app/lib/impressionen.ts.
 */
app.post('/api/impressionen', route(async (req) =>
  antwort(await syncHandlers.handleImpressionen(req.db, req.nutzerId, req.body?.eintraege))
));


module.exports = app;
