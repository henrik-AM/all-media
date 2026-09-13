// Prueft die Auth-Einstellungen der Supabase-Instanz.
//
// WARUM ES DIESEN LAUF GIBT
//
// Die Anmeldung ist der einzige Teil von All Media, der **nicht** im Repo
// steht. Sie ist eine Handvoll Schalter in einem fremden Dashboard, und wer
// dort etwas umlegt, aendert die Sicherheit der App, ohne dass eine Zeile Code
// sich bewegt und ohne dass ein Prueflauf es merkt. Genau das prueft dieser
// Lauf nach: die Schalter, die niemand sonst beobachtet.
//
// DIE WICHTIGSTE REGEL HIER (13.09.2026)
//
// Solange kein eigener Mailversand eingerichtet ist, liefert Supabase
// Bestaetigungsmails **nur an Mitglieder der eigenen Organisation** aus —
// fremde Adressen weist es ab. Massenregistrierung ist damit unmoeglich, aber
// aus dem falschen Grund: es kann sich ueberhaupt niemand Fremdes anmelden.
//
// In dem Moment, in dem ein eigener SMTP eingetragen wird, faellt dieser
// Riegel weg. Dann — und erst dann — wird ein CAPTCHA gebraucht. Diese
// Bedingung steht deshalb nicht als Merkposten in einer Notiz, sondern als
// Pruefung 9 hier drin: SMTP ohne CAPTCHA schlaegt fehl.
//
// Start:  SUPABASE_TOKEN=… node test/_auth.js
//
// Ohne SUPABASE_TOKEN prueft der Lauf nichts und sagt das auch. Ein
// uebersprungener Lauf, der sich als bestanden ausgibt, waere schlimmer als
// keiner.

const fs = require('fs');
const path = require('path');

const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
  ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';

const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const PROJEKT = (URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || '';

// Die Stellen, an denen die beiden Oberflaechen sich anmelden. Wenn ein
// CAPTCHA aktiv ist, muss hier ein `captchaToken` mitgehen — sonst weist
// Supabase jede Registrierung und jede Anmeldung ab.
const CLIENTS = [
  ['Website', path.join(__dirname, '..', '..', 'web', 'public', 'anmeldung.js')],
  ['App', path.join(__dirname, '..', 'lib', 'supabaseAuth.ts')],
];

let fehler = 0;
let gesamt = 0;
const pruefe = (name, bedingung, zusatz = '') => {
  gesamt++;
  if (!bedingung) fehler++;
  console.log((bedingung ? 'PASS  ' : 'FAIL  ') + name + (zusatz ? '  — ' + zusatz : ''));
};

async function main() {
  const token = process.env.SUPABASE_TOKEN;
  if (!token || !PROJEKT) {
    console.log('UEBERSPRUNGEN — ohne SUPABASE_TOKEN sind die Auth-Schalter nicht lesbar.');
    console.log('Der Lauf hat nichts geprueft. Start: SUPABASE_TOKEN=… node test/_auth.js');
    process.exit(0);
  }

  const antwort = await fetch(`https://api.supabase.com/v1/projects/${PROJEKT}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!antwort.ok) {
    console.log(`FAIL  Auth-Einstellungen nicht lesbar — HTTP ${antwort.status}`);
    process.exit(1);
  }
  const k = await antwort.json();

  // ------------------------------------------------- Wege ins Konto hinein --
  //
  // Jeder eingeschaltete Anbieter ist eine eigene Tuer mit eigener Angriffs-
  // flaeche. All Media benutzt genau eine: E-Mail und Passwort.
  pruefe(
    'Anonyme Anmeldungen sind aus',
    k.external_anonymous_users_enabled === false,
    'sonst legt jeder beliebig viele Konten ohne Mail an'
  );

  const anbieter = Object.keys(k)
    .filter((n) => n.startsWith('external_') && n.endsWith('_enabled') && k[n])
    .filter((n) => n !== 'external_email_enabled');
  pruefe(
    'Nur der E-Mail-Anbieter ist eingeschaltet',
    anbieter.length === 0,
    anbieter.length ? `zusaetzlich offen: ${anbieter.join(', ')}` : 'keine ungenutzten Tueren'
  );

  pruefe(
    'Die E-Mail muss bestaetigt werden',
    k.mailer_autoconfirm === false,
    'ohne Bestaetigung ist jede erfundene Adresse ein Konto'
  );

  // -------------------------------------------------------- Weiterleitungen --
  //
  // Supabase haengt das Zugangstoken an die Rueckkehr-Adresse. Steht dort ein
  // Platzhalter, der fremde Ziele zulaesst, verschenkt die Anmeldung Sitzungen
  // an jeden, der einen Link unterschiebt.
  const ziele = String(k.uri_allow_list || '')
    .split(',')
    .map((z) => z.trim())
    .filter(Boolean);
  const offen = ziele.filter((z) => z === '*' || z === '**' || z === '*/**');
  pruefe(
    'Keine offene Weiterleitung',
    ziele.length > 0 && offen.length === 0,
    ziele.length ? `${ziele.length} Ziele, davon offen: ${offen.length}` : 'Liste ist leer'
  );

  // -------------------------------------------------------------- Sitzungen --
  pruefe(
    'Aktualisierungstoken rotieren',
    k.refresh_token_rotation_enabled === true,
    'sonst bleibt ein gestohlenes Token dauerhaft gueltig'
  );
  pruefe(
    'Passwortwechsel verlangt frische Anmeldung',
    k.security_update_password_require_reauthentication === true,
    'sonst uebernimmt ein fremder Bildschirm das Konto'
  );

  // --------------------------------------------------------------- Passwort --
  const zeichen = String(k.password_required_characters || '');
  pruefe(
    'Passwortregel greift',
    Number(k.password_min_length) >= 10 && zeichen.includes(':'),
    `mindestens ${k.password_min_length} Zeichen, ${zeichen.split(':').filter(Boolean).length} Gruppen`
  );

  // ------------------------------------------- CAPTCHA und Clients im Gleichtakt --
  //
  // Der Unfall, den diese Pruefung verhindert: jemand legt im Dashboard den
  // CAPTCHA-Schalter um, ohne dass die Clients einen Token schicken. Ab dann
  // kommt niemand mehr in die App — weder neu noch angemeldet. Der Schalter
  // sieht nach mehr Sicherheit aus und ist in Wahrheit ein Totalausfall.
  const captchaAn = k.security_captcha_enabled === true;
  const clientsMitToken = CLIENTS.filter(
    ([, datei]) => fs.existsSync(datei) && /captchaToken/.test(fs.readFileSync(datei, 'utf8'))
  ).map(([name]) => name);

  pruefe(
    'CAPTCHA und Clients passen zusammen',
    !captchaAn || clientsMitToken.length === CLIENTS.length,
    captchaAn
      ? `CAPTCHA ist AN, Token senden: ${clientsMitToken.join(', ') || 'keiner'} von ${CLIENTS.length}`
      : 'CAPTCHA ist aus, Clients brauchen keinen Token'
  );

  // ------------------------------- Die Kopplung: eigener Mailversand braucht CAPTCHA --
  //
  // Siehe Kopf dieser Datei. Ohne eigenen SMTP nimmt Supabase fremde Adressen
  // gar nicht erst an — das ist der Grund, warum es heute ohne CAPTCHA geht.
  // Wer den Mailversand einrichtet, zieht diesen Riegel weg und muss den
  // anderen vorschieben.
  const eigenerVersand = Boolean(k.smtp_host);
  pruefe(
    'Eigener Mailversand nur zusammen mit CAPTCHA',
    !eigenerVersand || captchaAn,
    eigenerVersand
      ? 'SMTP ist eingerichtet — ab jetzt kann sich jeder registrieren, CAPTCHA fehlt'
      : 'kein eigener SMTP, fremde Adressen werden ohnehin abgewiesen'
  );

  console.log(`\n${gesamt - fehler} von ${gesamt} Pruefungen bestanden`);

  if (!eigenerVersand) {
    console.log(
      '\nHINWEIS — kein eigener Mailversand eingerichtet.\n' +
        '  Supabase liefert Bestaetigungsmails dann nur an Mitglieder der eigenen\n' +
        '  Organisation aus. Fremde Adressen werden mit "Email address not authorized"\n' +
        '  abgewiesen: es kann sich derzeit niemand ausser Henrik registrieren.\n' +
        '  Das schuetzt vor Massenregistrierung und blockiert zugleich den Start.\n' +
        '  Wird ein SMTP eingetragen, verlangt Pruefung 9 oben ein CAPTCHA dazu.'
    );
  }

  process.exit(fehler ? 1 : 0);
}

main().catch((e) => {
  console.log('FAIL  Lauf abgebrochen — ' + (e?.message || e));
  process.exit(1);
});
