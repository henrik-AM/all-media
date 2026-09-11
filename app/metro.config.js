/**
 * Metro-Einstellungen der App.
 *
 * WARUM ES DIESE DATEI GIBT
 *
 * Metro sieht sonst nur den Ordner `app/`. Alles darueber ist fuer den
 * Bundler nicht vorhanden — ein Import aus `../gemeinsam/` waere schlicht
 * „module not found", und zwar erst beim Start, nicht beim Uebersetzen.
 *
 * `watchFolders` nimmt den Ordner `gemeinsam/` dazu. Dort liegt das, was App
 * und Website beide brauchen (bisher: die Spaltenlisten der Datenbank), damit
 * es nicht laenger zweimal dasteht und auseinanderlaufen kann.
 *
 * `resolver.extraNodeModules` haengt einen leeren Ersatz fuer Nodes `crypto`
 * ein. Grund steht in `gemeinsam/kein-node-crypto.js`: tweetnacl fragt am
 * Ende danach, und ohne diesen Eintrag laesst sich die App gar nicht erst
 * uebersetzen — nicht etwa, weil die Verschluesselung Node braucht, sondern
 * weil Metro jedes `require` auch in einem Zweig aufloest, den es nie geht.
 *
 * Sonst ist hier bewusst nichts eingestellt: alles andere bleibt so, wie Expo
 * es vorgibt.
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projektWurzel = __dirname;
const gemeinsam = path.resolve(projektWurzel, '..', 'gemeinsam');

const config = getDefaultConfig(projektWurzel);

config.watchFolders = [gemeinsam];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  crypto: path.resolve(gemeinsam, 'kein-node-crypto.js'),
};

module.exports = config;
