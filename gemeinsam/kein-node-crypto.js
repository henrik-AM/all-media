/**
 * Ein leerer Ersatz fuer Nodes `crypto` — nur fuer Metro.
 *
 * `gemeinsam/tweetnacl.js` sucht sich seine Zufallsquelle am Ende selbst:
 * im Browser `crypto.getRandomValues`, in Node `require('crypto')`. React
 * Native hat keine von beiden, und der Zweig fuer Node ist trotzdem ein
 * Problem: Metro loest jedes `require` schon beim Uebersetzen auf und bricht
 * das ganze Bundle mit „Unable to resolve module crypto" ab, lange bevor
 * irgendetwas laeuft.
 *
 * Diese Datei faengt das ab. Sie gibt ein leeres Objekt zurueck; tweetnacl
 * findet darin kein `randomBytes`, setzt also keine Zufallsquelle — und
 * genau das ist gewollt. Die App reicht sie ueber
 * `Krypto.zufallsquelleSetzen()` aus `expo-crypto` nach (app/lib/krypto.ts).
 *
 * Auf keinen Fall darf hier je ein selbstgebauter Zufall stehen. Ohne Quelle
 * wirft tweetnacl „no PRNG" und nichts wird verschluesselt; mit schlechtem
 * Zufall wird verschluesselt und ist wertlos. Der Fehler ist das bessere
 * Verhalten.
 */
module.exports = {};
