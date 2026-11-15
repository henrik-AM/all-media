// Reproduktion F-Wiedereinspielen: Chiffre/Kuvert sind nicht an Nachricht,
// Chat, Zeit oder Bezug gebunden. Eine von A echt verschlossene Nachricht,
// unverändert als NEUE Zeile in einen anderen Chat kopiert, öffnet sich und
// besteht die Absenderprüfung (AR-04). Lokal, kein Netz.
'use strict';
const path = require('path'), nodeCrypto = require('crypto');
const W = process.argv[2];
const Krypto = require(path.join(W, 'gemeinsam/krypto'));
Krypto.zufallsquelleSetzen((x, n) => { const b = nodeCrypto.randomBytes(n); for (let i = 0; i < n; i++) x[i] = b[i]; });
let ok = 0, fehl = 0;
const pruefe = (n, b) => { b ? ok++ : fehl++; console.log((b ? 'BELEGT ' : 'NICHT  ') + n); };

const A = Krypto.schluesselpaarErzeugen(), B = Krypto.schluesselpaarErzeugen();
const echt = Krypto.verschluesseln('Ja, mach das.', A.geheim, [{ id: 'kB', oeffentlich: B.oeffentlich }, { id: 'kA', oeffentlich: A.oeffentlich }]);
const zeile1 = { id: 'm1', chat_id: 'chat-messenger', sender_id: 'uA', created_at: '2026-11-01', krypto: 1, chiffre: echt.chiffre, krypto_nonce: echt.nonce, absender_schluessel: echt.absender };
// Datenbankschreiber kopiert Zeile + B-Kuvert in einen anderen Chat, neue Zeit, neuer Bezug.
const zeile2 = { ...zeile1, id: 'm-neu', chat_id: 'chat-community', created_at: '2026-11-15', reply_to: 'frage-x' };
const kuvertB = echt.kuverts.find((k) => k.schluesselId === 'kB');
const offen = (z) => Krypto.entschluesseln({ version: z.krypto, chiffre: z.chiffre, nonce: z.krypto_nonce, absender: z.absender_schluessel }, kuvertB, B.geheim);
pruefe('Original öffnet sich bei B', offen(zeile1) === 'Ja, mach das.');
pruefe('Kopie in anderem Chat/Zeit/Bezug öffnet sich identisch', offen(zeile2) === 'Ja, mach das.');
const pruefer = Krypto.absenderPruefer(async () => [{ user_id: 'uA', oeffentlich: A.oeffentlich }]);
pruefer.pruefen([{ userId: zeile2.sender_id, schluessel: zeile2.absender_schluessel }]).then(([u]) => {
  pruefe('Absenderprüfung bestätigt die Kopie (keine Warnung)', u === true);
  console.log(`\nErgebnis: ${ok}/${ok + fehl} Aussagen belegt`);
  process.exit(fehl ? 1 : 0);
});
