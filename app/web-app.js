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
