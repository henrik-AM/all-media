/**
 * Die Regeln der Verschlüsselung — ohne Netz, ohne Datenbank.
 *
 * WARUM ES DAS GIBT
 *
 * Sicherheitsprüfung 16.10.2026 (AR-04, AR-05). Die Rechnung selbst prüft
 * `test/_krypto.js`; der braucht aber zwei echte Konten und Supabase. Was
 * hier steht, ist die Logik dazwischen, die App und Website gemeinsam
 * benutzen (gemeinsam/krypto.js) und die sich ohne Netz vollständig prüfen
 * lässt:
 *
 *   1. `sendeweg` — wann verschlossen, wann offen, wann abgelehnt wird.
 *      Geprüft wird vor allem, dass es NIE still auf Klartext fällt, wo
 *      Verschlüsselung vorgesehen ist.
 *   2. Nur zu zweit — ein Zweierchat mit drittem Mitglied nimmt nichts an.
 *   3. `sicherheitsnummer` — über alle Geräte, unabhängig von der Reihenfolge.
 *   4. `absenderPruefer` — erkennt eine Nachricht mit fremdem Absenderschlüssel,
 *      merkt sich Antworten und urteilt nicht, wenn nichts ladbar ist.
 *
 * Start:  node test/_krypto_einheit.js
 */

const crypto = require('crypto');
const Krypto = require('../../gemeinsam/krypto');

Krypto.zufallsquelleSetzen((x, n) => {
  const bytes = crypto.randomBytes(n);
  for (let i = 0; i < n; i++) x[i] = bytes[i];
});

let gut = 0;
let schlecht = 0;
function pruefe(name, ok, info) {
  if (ok) gut++;
  else schlecht++;
  console.log((ok ? '  OK    ' : '  FEHL  ') + name + (info ? '  (' + info + ')' : ''));
}

const ICH = 'konto-ich';
const DU = 'konto-du';
const meinPaar = Krypto.schluesselpaarErzeugen();
const deinPaar = Krypto.schluesselpaarErzeugen();
const MEINER = { id: 'k-ich', oeffentlich: meinPaar.oeffentlich };
const S_ICH = { id: 'k-ich', user_id: ICH, oeffentlich: meinPaar.oeffentlich };
const S_DU = { id: 'k-du', user_id: DU, oeffentlich: deinPaar.oeffentlich };

function fakten(zusatz) {
  return Object.assign(
    {
      istGruppe: false,
      mitglieder: [ICH, DU],
      ichId: ICH,
      schluessel: [S_ICH, S_DU],
      schonVerschluesselt: false,
      gemerkt: false,
      meiner: MEINER,
    },
    zusatz
  );
}

console.log('\nSendeweg (AR-05)');

let w = Krypto.sendeweg(fakten());
pruefe('Beide mit Schlüssel: verschließen', w.art === 'verschliessen', w.art);
pruefe(
  '… für beide Geräte, je einmal',
  w.art === 'verschliessen' && w.empfaenger.length === 2,
  w.empfaenger && w.empfaenger.map((e) => e.id).join(',')
);

w = Krypto.sendeweg(fakten({ istGruppe: true, meiner: null }));
pruefe('Gruppe: offen, auch ohne eigenen Schlüssel', w.art === 'offen', w.art);

w = Krypto.sendeweg(fakten({ schluessel: [S_ICH] }));
pruefe('Gegenüber ohne Gerät, nie verschlüsselt: offen', w.art === 'offen', w.art);

w = Krypto.sendeweg(fakten({ schluessel: [], meiner: null }));
pruefe('Niemand mit Gerät, kein eigener Schlüssel: offen', w.art === 'offen', w.art);

w = Krypto.sendeweg(fakten({ meiner: null }));
pruefe('Eigener Schlüssel fehlt, Gegenüber hat einen: ABLEHNEN', w.art === 'ablehnen', w.art);
pruefe(
  '… mit dem Satz für den Nutzer',
  w.meldung === Krypto.MELDUNG_NICHT_VERSCHLUESSELT &&
    /ließ sich gerade nicht verschlüsseln und wurde nicht gesendet/.test(w.meldung),
  w.meldung
);

w = Krypto.sendeweg(fakten({ schluessel: [], schonVerschluesselt: true }));
pruefe('Leere Schlüsselliste in verschlüsseltem Chat (Downgrade): ABLEHNEN', w.art === 'ablehnen', w.art);

w = Krypto.sendeweg(fakten({ schluessel: [S_ICH], gemerkt: true }));
pruefe('Gemerkt verschlüsselt, Server liefert nichts vom Gegenüber: ABLEHNEN', w.art === 'ablehnen', w.art);

w = Krypto.sendeweg(fakten({ schluessel: [S_DU] }));
pruefe(
  'Eigenes Gerät fehlt in der Liste: kommt trotzdem dazu',
  w.art === 'verschliessen' && w.empfaenger.some((e) => e.id === MEINER.id),
  w.empfaenger && w.empfaenger.map((e) => e.id).join(',')
);

w = Krypto.sendeweg(
  fakten({ schluessel: [S_ICH, S_DU, { id: 'k-fremd', user_id: 'konto-fremd', oeffentlich: deinPaar.oeffentlich }] })
);
pruefe(
  'Schlüssel eines Nicht-Mitglieds bekommt kein Kuvert',
  w.art === 'verschliessen' && !w.empfaenger.some((e) => e.id === 'k-fremd'),
  w.empfaenger && w.empfaenger.map((e) => e.id).join(',')
);

// Server-Wächter: er hat keinen Schlüssel (meiner: null).
w = Krypto.sendeweg(fakten({ meiner: null, schluessel: [S_DU] }));
pruefe('Server-Wächter: Klartext in verschlüsselbarem Chat abgelehnt', w.art === 'ablehnen', w.art);

console.log('\nNur zu zweit (Schlüssel-Unterschiebung über die Mitgliedschaft)');

const DRITTER = 'konto-dritter';
const S_DRITTER = { id: 'k-dritter', user_id: DRITTER, oeffentlich: Krypto.schluesselpaarErzeugen().oeffentlich };
w = Krypto.sendeweg(fakten({ mitglieder: [ICH, DU, DRITTER], schluessel: [S_ICH, S_DU, S_DRITTER] }));
pruefe('Zweierchat mit drittem Mitglied: ABLEHNEN statt für ihn verschließen', w.art === 'ablehnen', w.art);
pruefe('… mit eigenem Satz', w.meldung === Krypto.MELDUNG_NUR_ZU_ZWEIT, w.meldung);
w = Krypto.sendeweg(fakten({ mitglieder: [ICH, DU, DRITTER], schluessel: [] }));
pruefe('… auch ohne Schlüssel kein Klartext an den Dritten', w.art === 'ablehnen', w.art);
pruefe('zuVieleMitglieder: drei in Nicht-Gruppe', Krypto.zuVieleMitglieder({ istGruppe: false, mitglieder: [1, 2, 3] }));
pruefe('zuVieleMitglieder: Gruppe ist frei', !Krypto.zuVieleMitglieder({ istGruppe: true, mitglieder: [1, 2, 3] }));
pruefe('zuVieleMitglieder: zwei sind richtig', !Krypto.zuVieleMitglieder({ istGruppe: false, mitglieder: [1, 2] }));

console.log('\nSicherheitsnummer über alle Geräte (AR-04)');

const g1 = Krypto.schluesselpaarErzeugen().oeffentlich;
const g2 = Krypto.schluesselpaarErzeugen().oeffentlich;
const g3 = Krypto.schluesselpaarErzeugen().oeffentlich;
const nr12 = Krypto.sicherheitsnummer([g1, g2]);
pruefe('Format wie der Fingerabdruck', /^([0-9A-F]{4} ){7}[0-9A-F]{4}$/.test(nr12.nummer), nr12.nummer);
pruefe('Zählt die Geräte', nr12.geraete === 2, String(nr12.geraete));
pruefe('Reihenfolge egal (App und Website gleich)', Krypto.sicherheitsnummer([g2, g1]).nummer === nr12.nummer);
pruefe('Doppelte zählen einmal', Krypto.sicherheitsnummer([g1, g2, g1]).nummer === nr12.nummer &&
  Krypto.sicherheitsnummer([g1, g2, g1]).geraete === 2);
const nr123 = Krypto.sicherheitsnummer([g1, g2, g3]);
pruefe('Untergeschobenes drittes Gerät ändert die Nummer', nr123.nummer !== nr12.nummer && nr123.geraete === 3);
pruefe('… auch wenn es das älteste ist (Reihenfolge der Abfrage)', Krypto.sicherheitsnummer([g3, g1, g2]).nummer === nr123.nummer);
pruefe('Ein Gerät: dieselbe Nummer wie bisher (fingerabdruck)', Krypto.sicherheitsnummer([g1]).nummer === Krypto.fingerabdruck(g1));
pruefe('Kein Schlüssel: null', Krypto.sicherheitsnummer([]) === null && Krypto.sicherheitsnummer(null) === null);

// Rundweg: was sendeweg liefert, öffnet das Gegenüber.
w = Krypto.sendeweg(fakten());
const paket = Krypto.verschluesseln('Hallo', meinPaar.geheim, w.empfaenger);
const kuvertDu = paket.kuverts.find((k) => k.schluesselId === 'k-du');
pruefe('Gegenüber öffnet, was nach sendeweg verschlossen wurde', Krypto.entschluesseln(paket, kuvertDu, deinPaar.geheim) === 'Hallo');

(async () => {
  console.log('\nAbsender prüfen (AR-04)');

  // Eine gefälschte Nachricht „von DU": jemand mit Schreibzugriff legt sich
  // ein eigenes Paar an und setzt dessen öffentlichen Teil als Absender.
  const faelscher = Krypto.schluesselpaarErzeugen();
  const echt = Krypto.verschluesseln('echt', deinPaar.geheim, [{ id: 'k-ich', oeffentlich: meinPaar.oeffentlich }]);
  const falsch = Krypto.verschluesseln('gefälscht', faelscher.geheim, [{ id: 'k-ich', oeffentlich: meinPaar.oeffentlich }]);
  pruefe('Die Fälschung geht beim Empfänger auf — ohne Prüfung fiele sie nicht auf',
    Krypto.entschluesseln(falsch, falsch.kuverts[0], meinPaar.geheim) === 'gefälscht');

  const angemeldet = [{ user_id: DU, oeffentlich: deinPaar.oeffentlich }, { user_id: ICH, oeffentlich: meinPaar.oeffentlich }];
  let abfragen = 0;
  let netzWeg = false;
  const pr = Krypto.absenderPruefer(async (paare) => {
    abfragen++;
    if (netzWeg) throw new Error('kein Netz');
    return angemeldet.filter((a) => paare.some((p) => p.userId === a.user_id && p.schluessel === a.oeffentlich));
  }, { nachladenMs: 50 });

  let u = await pr.pruefen([
    { userId: DU, schluessel: echt.absender },
    { userId: DU, schluessel: falsch.absender },
    { userId: DU, schluessel: meinPaar.oeffentlich }, // fremder, aber echter Schlüssel
  ]);
  pruefe('Echter Absenderschlüssel: bekannt', u[0] === true, String(u[0]));
  pruefe('Fälschung: nicht prüfbar', u[1] === false, String(u[1]));
  pruefe('Schlüssel eines anderen Kontos zählt nicht', u[2] === false, String(u[2]));
  pruefe('Eine Abfrage für alle drei', abfragen === 1, String(abfragen));

  u = await pr.pruefen([{ userId: DU, schluessel: echt.absender }, { userId: DU, schluessel: falsch.absender }]);
  pruefe('Nachsehen im Takt: gemerkt, keine neue Abfrage', abfragen === 1 && u[0] === true && u[1] === false, String(abfragen));

  await new Promise((r) => setTimeout(r, 70));
  angemeldet.push({ user_id: DU, oeffentlich: falsch.absender }); // „neues Gerät" doch angemeldet
  u = await pr.pruefen([{ userId: DU, schluessel: falsch.absender }]);
  pruefe('Unbekanntes wird nach der Frist neu gefragt', abfragen === 2 && u[0] === true, String(u[0]));

  netzWeg = true;
  const neu = Krypto.schluesselpaarErzeugen().oeffentlich;
  u = await pr.pruefen([{ userId: DU, schluessel: echt.absender }, { userId: DU, schluessel: neu }]);
  pruefe('Nicht ladbar: kein Urteil (null), nichts blockiert', u[1] === null, String(u[1]));
  pruefe('… abgelaufene Bestätigung wird ohne Netz nicht weiter vertraut', u[0] === null, String(u[0]));

  console.log(`\n${gut} von ${gut + schlecht} Pruefungen bestanden.`);
  process.exit(schlecht ? 1 : 0);
})();
