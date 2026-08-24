// Startet die Website ohne Cloud auf diesem Rechner - nur zum Nachsehen,
// ob nach einer Aenderung noch alles stimmt.
//
// Start:  npm start   (im Ordner All-Media/web)

const app = require('./app.js');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`  All Media Website: http://localhost:${PORT}`));

// Wird auch von Render genutzt
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`  All Media Website laeuft auf Port ${port}`);
  });
}
