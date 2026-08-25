// Startet die Website - lokal auf Henriks Mac und in der Cloud bei Render.
//
// Start:  npm start   (im Ordner All-Media/web)

const app = require('./app.js');

const port = process.env.PORT || 3000;

// Auf allen Netzwerkschnittstellen, damit die Seite auch vom Handy im
// selben WLAN erreichbar ist.
app.listen(port, '0.0.0.0', () => {
  console.log(`  All Media Website: http://localhost:${port}`);
});
