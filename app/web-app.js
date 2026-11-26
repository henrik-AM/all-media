// Der lokale Server auf Henriks Mac.
//
// Start:  npm run web-app       (nur die Website)
//         npm run up            (Website + Expo Go ueber die feste Adresse)
//
// Die Website selbst steckt in ../web/server/app.js - dieselbe Datei, die
// auch dauerhaft in der Cloud laeuft. Hier kommt nur dazu, was es nur
// oertlich gibt: die Weiterleitung an Metro fuer Expo Go.
//
// Warum die Weiterleitung: Das kostenlose ngrok-Konto erlaubt nur EINE
// oeffentliche Adresse. Damit Website und Expo Go trotzdem beide von
// unterwegs erreichbar sind, teilen sie sich diese Adresse - Anfragen von
// Expo Go erkennen wir und reichen sie an Metro auf Port 8081 weiter.

const http = require('http');
const os = require('os');
const app = require('../web/server/app.js');

const PORT = process.env.PORT || 3000;
const METRO_PORT = process.env.METRO_PORT || 8081;

// Pfade, die eindeutig zu Metro gehoeren und nicht zur Website.
const METRO_PFADE = [
  '/node_modules/', '/assets/', '/_expo/', '/.expo/',
  '/symbolicate', '/logs', '/inspector', '/hot', '/message',
  '/debugger-ui', '/open-debugger', '/status', '/openurl',
];

/*
 * Was NIE weitergereicht wird (Sicherheitsprüfung 17.10.2026): der
 * JS-Debugger von React Native. Über `/json/list` und
 * `/inspector/debug?device=…` führt jeder, der diesen Server erreicht,
 * beliebigen Code in der angemeldeten App aus — Sitzung und geheimer
 * Chatschlüssel inklusive. Metro selbst lässt das nur von localhost zu; weil
 * diese Weiche aber selbst von 127.0.0.1 aus weiterreicht, sah Metro jede
 * Anfrage als örtlich an. Im WLAN (und über ngrok im Internet) war der
 * Debugger damit offen. Debuggen geht weiter direkt am Mac über Port 8081.
 */
const GESPERRT = ['/inspector', '/json', '/open-debugger', '/debugger-ui', '/debugger-frontend', '/openurl', '/_expo/open', '/_expo/debugger', '/open-stack-frame'];

/*
 * Den Pfad so lesen, wie Metro ihn nach dem Normalisieren sieht (Codex-
 * Gegenprüfung Paket 8): %-Kodierung, doppelte Schrägstriche, `.`/`..`,
 * Groß-/Kleinschreibung. Sonst führte `//inspector`, `/%69nspector` oder
 * `/x/../json` an der Sperre vorbei. Unlesbare Pfade gelten als gesperrt.
 */
function normalerPfad(url, alsUrl = false) {
  let pfad = String(url || '/');
  if (alsUrl) {
    // Absolutes Anfrageziel (`GET http://host/inspector`) wie Metro über URL lesen.
    try { pfad = new URL(pfad, 'http://weiche.invalid').pathname; } catch { return null; }
  } else {
    pfad = pfad.split(/[?#]/)[0];
  }
  for (let i = 0; i < 3; i++) {
    let neu;
    try { neu = decodeURIComponent(pfad); } catch { return null; }
    if (neu === pfad) break;
    pfad = neu;
  }
  pfad = pfad.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const teile = [];
  for (const t of pfad.split('/')) {
    if (!t || t === '.') continue;
    if (t === '..') teile.pop(); else teile.push(t);
  }
  return ('/' + teile.join('/')).toLowerCase();
}

function istGesperrt(req) {
  // Beide Lesarten prüfen: Rohpfad (Connect-Routing) und URL.pathname (Metro-Upgrade).
  return [normalerPfad(req.url), normalerPfad(req.url, true)].some((pfad) =>
    pfad === null || // Connect trennt auch an „.“ (`/_expo/debugger.x`) — darum auch dort sperren.
    GESPERRT.some((p) => pfad === p || pfad.startsWith(p + '/') || pfad.startsWith(p + '.')));
}

function istExpoAnfrage(req) {
  // Expo Go schickt bei der ersten Anfrage immer diesen Kopfeintrag mit.
  if (req.headers['expo-platform']) return true;
  const pfad = req.url.split('?')[0];
  if (pfad.endsWith('.bundle') || pfad.endsWith('.map')) return true;
  return METRO_PFADE.some((p) => pfad.startsWith(p));
}

function weiterleiten(req, res) {
  const anfrage = http.request({
    host: '127.0.0.1',
    port: METRO_PORT,
    method: req.method,
    path: req.url,
    headers: { ...req.headers, host: `127.0.0.1:${METRO_PORT}` },
  }, (antwort) => {
    res.writeHead(antwort.statusCode, antwort.headers);
    antwort.pipe(res);
  });
  anfrage.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain' });
      res.end('Metro laeuft nicht.');
    }
  });
  req.pipe(anfrage);
}

const server = http.createServer((req, res) => {
  if (istGesperrt(req)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Der Debugger ist nur direkt am Mac erreichbar.');
  }
  if (istExpoAnfrage(req)) return weiterleiten(req, res);
  app(req, res);
});

// Auf allen Netzwerkschnittstellen lauschen, damit die Web-Version auch vom
// Handy im selben WLAN erreichbar ist.
function localAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

server.listen(PORT, '0.0.0.0', () => {
  const ip = localAddress();
  console.log('');
  console.log(`  All Media läuft.`);
  console.log(`  Auf diesem Rechner : http://localhost:${PORT}`);
  if (ip) console.log(`  Im selben WLAN     : http://${ip}:${PORT}`);
  console.log('');
});

// Expos automatisches Neuladen laeuft ueber eine dauerhafte Verbindung.
// Die muss ebenfalls an Metro weitergereicht werden.
server.on('upgrade', (req, socket, kopf) => {
  if (istGesperrt(req)) return socket.destroy();
  const anfrage = http.request({
    host: '127.0.0.1',
    port: METRO_PORT,
    path: req.url,
    headers: { ...req.headers, host: `127.0.0.1:${METRO_PORT}` },
  });
  anfrage.end();
  anfrage.on('upgrade', (antwort, metroSocket, metroKopf) => {
    const zeilen = Object.entries(antwort.headers)
      .map(([k, v]) => `${k}: ${v}`).join('\r\n');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${zeilen}\r\n\r\n`);
    if (metroKopf && metroKopf.length) socket.write(metroKopf);
    metroSocket.pipe(socket);
    socket.pipe(metroSocket);
  });
  anfrage.on('error', () => socket.destroy());
  socket.on('error', () => anfrage.destroy());
});
