// Vercel API Route – wird direkt aufgerufen bei jeder Anfrage
const http = require('http');
const app = require('../server/app.js');

// Vercel ruft diese Funktion auf
module.exports = (req, res) => {
  app(req, res);
};
