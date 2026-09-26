/**
 * Geburtsdatum, Altersgrenze und die Zustimmung der Eltern (Schema 52).
 *
 * WARUM ES DAS GIBT
 *
 * Henrik am 22.09.2026: Wer unter der Altersgrenze seines Landes liegt, darf
 * ein Konto haben, wenn ein Elternteil mit eigenem All-Media-Konto es von dort
 * aus bestätigt. Bis dahin darf das Konto nichts sehen und nichts schreiben.
 *
 * Geprüft wird ohne Oberfläche und mit echten Konten: die App schreibt direkt
 * nach Supabase und käme an jeder Prüfung in der Oberfläche vorbei. Was hier
 * nicht die Datenbank abweist, weist niemand ab.
 *
 * WARUM DIE KINDERKONTEN PER SQL ENTSTEHEN
 *
 * Eine Registrierung über signUp verschickt eine Bestätigungsmail, und ohne
 * eigenen Mailversand stellt Supabase die nur an Henrik zu (siehe
 * „Registrierung blockiert"). Ein Eintrag direkt in `auth.users` löst
 * dieselben Auslöser aus wie eine echte Registrierung — genau die sollen hier
 * geprüft werden. Am Ende werden die Konten wieder gelöscht.
 *
 * NACHGEZÄHLT WIRD IMMER
 *
 * Ein abgewiesenes Lesen unter RLS ist kein Fehler, sondern eine leere Liste.
 * „Das Kind sieht keine Beiträge" wäre also auch wahr, wenn es schlicht keine
 * gäbe. Deshalb liest dasselbe Kind nach der Zustimmung noch einmal — erst
 * dann ist die leere Liste vorher ein Beweis.
 *
 * DER ELTERNTEIL KOMMT ÜBER DIE NUMMER
 *
 * Seit Schema 58 (Henrik 26.09.2026): nie über den @-Namen, immer über die
 * Telefonnummer. Geprüft wird deshalb auch, dass der @-Name nicht mehr reicht.
 *
 * Start:  SUPABASE_TOKEN=… node test/_minderjaehrig.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { frage } = require('./_aufraeumen');
const Alter = require('../../gemeinsam/alter');
const Telefon = require('../../gemeinsam/telefon');

const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
  ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';

const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');

// Der ELTERNTEIL ist das Testkonto, der FREMDE das Prüfkonto.
const ELTERN = { email: 'test@all-media.app', passwort: 'AllMedia2026!' };
const FREMDER = {
  email: process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de',
  passwort: process.env.AM_TEST_PASS || 'PruefLauf2026!',
};

const KENNUNG = Date.now().toString(36);
const MAIL = (was) => `pruef.kind.${was}.${KENNUNG}@example.com`;
const PASSWORT = 'KindPruef2026!';

let fehler = 0;
const pruefe = (name, wahr, zusatz = '') => {
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

async function anmelden(zugang) {
  const client = createClient(URL, KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({
    email: zugang.email,
    password: zugang.passwort,
  });
  if (error) throw new Error(`${zugang.email}: ${error.message}`);
  return { client, id: data.user.id };
}

const sql = (text) => `'${String(text).replace(/'/g, "''")}'`;

/** Ein Konto so anlegen, wie signUp es täte — mit denselben Metadaten. */
async function kontoAnlegen(was, metadaten) {
  const antwort = await frage(`
    insert into auth.users
      (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
       raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
       confirmation_token, email_change, email_change_token_new, recovery_token)
    values
      ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       ${sql(MAIL(was))}, crypt(${sql(PASSWORT)}, gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, ${sql(JSON.stringify(metadaten))}::jsonb,
       now(), now(), '', '', '', '')
    returning id`);
  if (!Array.isArray(antwort)) return { fehler: JSON.stringify(antwort) };
  return { id: antwort[0].id };
}

/** Eine Nummer, die es sonst nirgends gibt. */
const nummer = (vorwahl, i) => `+${vorwahl} 1${String(Date.now()).slice(-8)}${i}`;

/** Ein Geburtsdatum, das heute genau `jahre` alt ist. */
function geborenVor(jahre) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - jahre);
  d.setDate(d.getDate() - 10);
  return d.toISOString().slice(0, 10);
}

(async () => {
  if (!URL || !KEY) {
    console.error('FEHLER  SUPABASE_URL/SUPABASE_ANON_KEY fehlen.');
    process.exit(1);
  }
  if (!process.env.SUPABASE_TOKEN) {
    console.error('FEHLER  SUPABASE_TOKEN fehlt — die Kinderkonten entstehen per SQL.');
    process.exit(1);
  }

  try {
    console.log('\nDie Tabelle der Altersgrenzen');

    const inDb = await frage('select land, vorwahl, mindestalter, untergrenze, name from public.altersgrenzen order by land');
    const gemeinsam = [...Alter.GRENZEN, Alter.UNBEKANNT]
      .map(([land, vorwahl, mindestalter, untergrenze, name]) => ({ land, vorwahl, mindestalter, untergrenze, name }))
      .sort((a, b) => a.land.localeCompare(b.land));
    const abweichend = gemeinsam.filter((z) => {
      const d = (inDb || []).find((x) => x.land === z.land);
      return !d || JSON.stringify(d) !== JSON.stringify(z);
    });
    pruefe(
      `gemeinsam/alter.js und public.altersgrenzen sind gleich (${gemeinsam.length} Länder)`,
      Array.isArray(inDb) && inDb.length === gemeinsam.length && abweichend.length === 0,
      abweichend.map((z) => z.land).join(', ')
    );

    for (const [telefon, land] of [['+423 1234567', 'LI'], ['0151 2345678', 'DE'], ['+81 90 12345678', 'XX'], ['+1 555 1234567', 'US']]) {
      const r = await frage(`select (public.altersgrenze_fuer(${sql(telefon)})).land as land`);
      pruefe(`${telefon} → ${land} in der Datenbank und in alter.js`, r?.[0]?.land === land && Alter.grenzeFuer(telefon).land === land, `DB ${r?.[0]?.land}, JS ${Alter.grenzeFuer(telefon).land}`);
    }

    console.log('\nDie Sperre steht auf jeder Tabelle');

    const ohne = await frage(`
      select c.relname
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
         and c.relname not in ('konto_alter', 'altersgrenzen', 'anon_takt', 'nummer_suche_takt')
         and not exists (select 1 from pg_policies p
                          where p.schemaname = 'public' and p.tablename = c.relname
                            and p.policyname = 'nur_freigegebene' and p.permissive = 'RESTRICTIVE')`);
    pruefe(
      'jede Tabelle trägt die einschränkende Regel nur_freigegebene',
      Array.isArray(ohne) && ohne.length === 0,
      Array.isArray(ohne) ? ohne.map((z) => z.relname).join(', ') + (ohne.length ? ' — Schema 52, Teil 4 nachziehen' : '') : JSON.stringify(ohne)
    );

    const eltern = await anmelden(ELTERN);
    const fremder = await anmelden(FREMDER);
    const [{ handle: elternHandle, phone: elternNummer }] = await frage(`select handle, phone from public.profiles where id = ${sql(eltern.id)}`);
    // Dieselbe Nummer, wie man sie zu Hause eintippt: „0151 …" statt „+49 151 …".
    const elternNational = '0' + Telefon.vergleichsform(elternNummer).replace(/^49/, '');

    console.log('\nEin Kind aus Deutschland, zwölf Jahre, mit der Nummer seines Elternteils ' + elternHandle);

    const kindHandle = 'pruefkind' + KENNUNG;
    const kindNummer = nummer('49', 1);
    const kind = await kontoAnlegen('de', {
      handle: kindHandle,
      name: 'Prüfkind',
      phone: kindNummer,
      geburtsdatum: geborenVor(12),
      eltern: elternNational,
    });
    pruefe('das Konto entsteht', Boolean(kind.id), kind.fehler);

    const k = await anmelden({ email: MAIL('de'), passwort: PASSWORT });

    const { data: stand } = await k.client.rpc('mein_kontostand');
    pruefe('mein_kontostand sagt „wartet"', stand?.stand === 'wartet', JSON.stringify(stand));
    pruefe('… mit dem richtigen Elternteil', stand?.eltern === elternHandle, stand?.eltern);
    pruefe('… und Deutschland ab 16', stand?.land === 'Deutschland' && stand?.mindestalter === 16);

    const { data: eigenesProfil } = await k.client.from('profiles').select('id, handle').eq('id', k.id);
    pruefe('das eigene Profil bleibt lesbar', eigenesProfil?.length === 1 && eigenesProfil[0].handle === '@' + kindHandle);

    const { data: vorherBeitraege } = await k.client.from('posts').select('id').limit(5);
    const { data: vorherProfile } = await k.client.from('profiles').select('id').neq('id', k.id).limit(5);
    pruefe('das wartende Kind sieht keine Beiträge', (vorherBeitraege || []).length === 0);
    pruefe('… und keine fremden Profile', (vorherProfile || []).length === 0);

    // Nur user_id: jede weitere Spalte kann aus einem anderen Grund scheitern
    // (PGRST204, Spalte unbekannt) und machte die Prüfung grün, ohne dass die
    // Sperre überhaupt gefragt wurde. Deshalb muss der Fehler 42501 sein.
    const { error: schreibFehler } = await k.client.from('posts').insert({ user_id: k.id });
    const [{ anzahl: kindBeitraege }] = await frage(`select count(*)::int as anzahl from public.posts where user_id = ${sql(k.id)}`);
    pruefe(
      'das wartende Kind kann nichts veröffentlichen',
      kindBeitraege === 0 && schreibFehler?.code === '42501',
      schreibFehler ? 'abgewiesen: ' + schreibFehler.code : 'kein Fehler'
    );

    const { data: sichtbarFuerFremde } = await fremder.client.from('profiles').select('id').eq('id', k.id);
    pruefe('fremde Konten finden das wartende Kind nicht', (sichtbarFuerFremde || []).length === 0);

    const { data: frechesSetzen } = await k.client.rpc('einwilligung_entscheiden', { p_kind: k.id, p_zustimmen: true });
    pruefe('das Kind kann sich nicht selbst freigeben', frechesSetzen?.ok === false, JSON.stringify(frechesSetzen));

    const { error: direktSchreiben } = await k.client.from('konto_alter').update({ status: 'frei' }).eq('user_id', k.id);
    const { data: nachDirekt } = await k.client.rpc('mein_kontostand');
    pruefe('… auch nicht an den Funktionen vorbei', nachDirekt?.stand === 'wartet', direktSchreiben?.code || '');

    const { data: fremdEntscheidet } = await fremder.client.rpc('einwilligung_entscheiden', { p_kind: k.id, p_zustimmen: true });
    pruefe('ein fremdes Konto kann nicht zustimmen', fremdEntscheidet?.ok === false, JSON.stringify(fremdEntscheidet));

    const { data: offen } = await eltern.client.rpc('einwilligungen_offen');
    const anfrage = (offen || []).find((a) => a.kind === k.id);
    pruefe('der Elternteil sieht die Anfrage', Boolean(anfrage), JSON.stringify(offen));
    pruefe('… mit Benutzername und Alter', anfrage?.handle === '@' + kindHandle && anfrage?.alter === 12);
    pruefe('… und der Nummer des Kindes', anfrage?.telefon === kindNummer, anfrage?.telefon);

    const { data: ja } = await eltern.client.rpc('einwilligung_entscheiden', { p_kind: k.id, p_zustimmen: true });
    pruefe('der Elternteil stimmt zu', ja?.ok === true && ja?.stand === 'frei', JSON.stringify(ja));

    const { data: danach } = await k.client.rpc('mein_kontostand');
    pruefe('danach ist das Kind frei', danach?.stand === 'frei');

    const { data: nachherProfile } = await k.client.from('profiles').select('id').neq('id', k.id).limit(5);
    pruefe('… und sieht fremde Profile — die leere Liste vorher war also die Sperre', (nachherProfile || []).length > 0);

    const { data: offenDanach } = await eltern.client.rpc('einwilligungen_offen');
    pruefe('die Anfrage ist beim Elternteil erledigt', !(offenDanach || []).some((a) => a.kind === k.id));

    console.log('\nAbgelehnt, dann ein anderer Elternteil');

    const kind2Nummer = nummer('43', 2);
    const kind2 = await kontoAnlegen('at', {
      handle: 'pruefkindat' + KENNUNG,
      name: 'Prüfkind AT',
      phone: kind2Nummer,
      geburtsdatum: geborenVor(13),
      eltern: elternNummer,
    });
    const k2 = await anmelden({ email: MAIL('at'), passwort: PASSWORT });
    const { data: nein } = await eltern.client.rpc('einwilligung_entscheiden', { p_kind: kind2.id, p_zustimmen: false });
    const { data: stand2 } = await k2.client.rpc('mein_kontostand');
    pruefe('abgelehnt bleibt gesperrt', nein?.ok === true && stand2?.stand === 'abgelehnt', JSON.stringify(stand2));

    const { data: sichSelbst } = await k2.client.rpc('eltern_anfragen', { p_eltern: kind2Nummer });
    pruefe('sich selbst als Elternteil eintragen geht nicht', sichSelbst?.ok === false, sichSelbst?.meldung);

    const { data: minderjaehrigerElternteil } = await k2.client.rpc('eltern_anfragen', { p_eltern: kindNummer });
    pruefe(
      'ein zwölfjähriges Konto kann nicht zustimmen, auch wenn es freigegeben ist',
      minderjaehrigerElternteil?.ok === false,
      JSON.stringify(minderjaehrigerElternteil)
    );

    const [{ handle: fremderHandle, phone: fremderNummer }] = await frage(`select handle, phone from public.profiles where id = ${sql(fremder.id)}`);
    const { data: perName } = await k2.client.rpc('eltern_anfragen', { p_eltern: fremderHandle });
    const { data: standPerName } = await k2.client.rpc('mein_kontostand');
    pruefe(
      'über den @-Namen lässt sich kein Elternteil anfragen',
      perName?.ok === false && /Telefonnummer/.test(perName?.meldung || '') && standPerName?.stand === 'abgelehnt',
      JSON.stringify(perName)
    );
    const { data: unbekannt } = await k2.client.rpc('eltern_anfragen', { p_eltern: '+49 1' + String(Date.now()).slice(-9) });
    pruefe('eine Nummer ohne Konto wird genannt', unbekannt?.meldung === 'Zu dieser Nummer gibt es bei All Media kein Konto.', unbekannt?.meldung);

    const { data: neuAngefragt } = await k2.client.rpc('eltern_anfragen', { p_eltern: fremderNummer });
    const { data: stand2b } = await k2.client.rpc('mein_kontostand');
    pruefe('ein anderer Elternteil lässt sich anfragen', neuAngefragt?.ok === true && stand2b?.stand === 'wartet' && stand2b?.eltern === fremderHandle, JSON.stringify(stand2b));

    const { data: alterElternteil } = await eltern.client.rpc('einwilligung_entscheiden', { p_kind: kind2.id, p_zustimmen: true });
    pruefe('der frühere Elternteil entscheidet nicht mehr mit', alterElternteil?.ok === false);

    console.log('\nUnter der Untergrenze, ohne Datum, volljährig');

    const australien = await kontoAnlegen('au', {
      handle: 'pruefkindau' + KENNUNG,
      phone: nummer('61', 3),
      geburtsdatum: geborenVor(14),
      eltern: elternNummer,
    });
    pruefe('Australien unter 16: das Konto entsteht gar nicht', !australien.id, (australien.fehler || '').slice(0, 90));

    await kontoAnlegen('ohne', { handle: 'pruefohne' + KENNUNG, phone: nummer('49', 4) });
    const o = await anmelden({ email: MAIL('ohne'), passwort: PASSWORT });
    const { data: standOhne } = await o.client.rpc('mein_kontostand');
    pruefe('ohne Geburtsdatum ist das Konto gesperrt', standOhne?.stand === 'ohne_datum');
    const { data: nachgetragen } = await o.client.rpc('geburtsdatum_nachtragen', { p_datum: geborenVor(30) });
    pruefe('nachgetragen mit 30 Jahren ist es frei', nachgetragen?.ok === true && nachgetragen?.stand === 'frei', JSON.stringify(nachgetragen));
    const { data: zweitesMal } = await o.client.rpc('geburtsdatum_nachtragen', { p_datum: geborenVor(10) });
    pruefe('ein zweites Nachtragen geht nicht', zweitesMal?.ok === false);

    await kontoAnlegen('gross', { handle: 'pruefgross' + KENNUNG, phone: nummer('49', 5), geburtsdatum: geborenVor(20) });
    const g = await anmelden({ email: MAIL('gross'), passwort: PASSWORT });
    const { data: standGross } = await g.client.rpc('mein_kontostand');
    pruefe('zwanzig Jahre: sofort frei', standGross?.stand === 'frei');

    const { data: bestand } = await fremder.client.rpc('mein_kontostand');
    pruefe('Konten von vor Schema 52 bleiben frei', bestand?.stand === 'frei');

    console.log('\nDer Benutzername');

    const anon = createClient(URL, KEY, { auth: { persistSession: false } });
    const { data: belegt } = await anon.rpc('handle_frei', { eingabe: kindHandle });
    pruefe('ein vergebener Name meldet „vergeben"', belegt?.frei === false && belegt?.grund === 'vergeben', JSON.stringify(belegt));
    const { data: frei } = await anon.rpc('handle_frei', { eingabe: 'frei' + KENNUNG });
    pruefe('ein freier Name meldet frei', frei?.frei === true, JSON.stringify(frei));
    const [{ handle: gewaehlt }] = await frage(`select handle from public.profiles where id = ${sql(k.id)}`);
    pruefe('das Konto heißt, wie es gewählt wurde', gewaehlt === '@' + kindHandle, gewaehlt);
  } catch (e) {
    fehler++;
    console.log('  FEHL ' + e.message);
  } finally {
    const weg = await frage(`delete from auth.users where email like ${sql(`pruef.kind.%.${KENNUNG}@example.com`)} returning id`);
    console.log(`\n  (${Array.isArray(weg) ? weg.length : 0} Prüfkonten wieder gelöscht)`);
  }

  console.log(fehler ? `\n${fehler} Prüfung(en) FEHLGESCHLAGEN` : '\nAlle Prüfungen bestanden');
  process.exit(fehler ? 1 : 0);
})();
