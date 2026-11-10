// Alle im Gesamtlauf benötigten Bildfixtures vor dem Fingerabdruck vorbereiten.
const fs = require('node:fs');
const path = require('node:path');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAG0lEQVQIW2P8z8Dwn4EIwDiqkL4hRQAAAP//AwDPUAX3rN6iSwAAAABJRU5ErkJggg==',
  'base64'
);

function bereiteFixturesVor(ordner = __dirname) {
  for (const name of ['_teststory.png', '_testbild.png']) {
    const datei = path.join(ordner, name);
    if (!fs.existsSync(datei)) fs.writeFileSync(datei, PNG, { flag: 'wx' });
    if (!fs.readFileSync(datei).equals(PNG)) {
      throw new Error(`Fixture ${name} hat unerwarteten Inhalt; vor dem Lauf prüfen.`);
    }
  }
}

module.exports = { bereiteFixturesVor };
