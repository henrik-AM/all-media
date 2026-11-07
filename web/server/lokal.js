// Startet die Website - lokal auf Henriks Mac und in der Cloud bei Render.
//
// Start:  npm start   (im Ordner All-Media/web)

// Lokale Schlüssel (nur auf dem Mac, nicht im Repo): web/.env.local trägt den
// Bunny-Zugang, damit der Prüfserver Medien wie Render unterschreibt — sonst
// bleiben die Beispielmedien (seit Schema 116 nur bei Bunny) tote Adressen.
// Render hat die Datei nicht und nimmt seine eigenen Umgebungsvariablen;
// gesetzte Variablen überschreibt loadEnvFile nie. Henrik, 07.11.2026.
const envDatei = require('path').join(__dirname, '..', '.env.local');
if (require('fs').existsSync(envDatei)) {
  process.loadEnvFile(envDatei);
  console.log('  web/.env.local geladen');
}

const app = require('./app.js');

const port = process.env.PORT || 3000;

// Auf allen Netzwerkschnittstellen, damit die Seite auch vom Handy im
// selben WLAN erreichbar ist.
app.listen(port, '0.0.0.0', () => {
  console.log(`  All Media Website: http://localhost:${port}`);
});
