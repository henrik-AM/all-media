/** Für rein lokale Einheitsläufe: kein versehentlicher Netz-/Supabase-Zugriff. */
const verweigern = () => { throw new Error('OFFLINE: Netzwerkzugriff verweigert'); };
require('net').Socket.prototype.connect = verweigern;
require('tls').connect = verweigern;
require('http').request = require('http').get = verweigern;
require('https').request = require('https').get = verweigern;
globalThis.fetch = verweigern;
