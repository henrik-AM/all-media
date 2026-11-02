/**
 * Testfall fürs App-Elternblatt im Simulator (F12): ein Kinderkonto entsteht
 * per SQL und fragt per Telefonnummer bei @test (Simulatorkonto) an.
 *
 *   SUPABASE_TOKEN=… node test/_sim_elternkind.js anlegen
 *   SUPABASE_TOKEN=… node test/_sim_elternkind.js stand      (Kontostand)
 *   SUPABASE_TOKEN=… node test/_sim_elternkind.js weg        (Kind löschen)
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { frage } = require('./_aufraeumen');

const UMG = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const wert = (n) => (UMG.match(new RegExp('^' + n + '=(.*)$', 'm')) || [])[1] || '';
const URL = wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const sql = (t) => `'${String(t).replace(/'/g, "''")}'`;
const MUSTER = 'pruef.kind.sim.%@example.com';

function geborenVor(jahre) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - jahre);
  d.setDate(d.getDate() - 10);
  return d.toISOString().slice(0, 10);
}

(async () => {
  const was = process.argv[2];
  if (was === 'anlegen') {
    const k = Date.now().toString(36);
    const mail = `pruef.kind.sim.${k}@example.com`;
    const pass = `Kp${require('crypto').randomBytes(12).toString('base64url')}7a`;
    const nummer = `+49 1${String(Date.now()).slice(-8)}3`;
    await frage(`
      insert into auth.users
        (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
         raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
         confirmation_token, email_change, email_change_token_new, recovery_token)
      values
        ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
         ${sql(mail)}, crypt(${sql(pass)}, gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         ${sql(JSON.stringify({ handle: 'pruefkindsim' + k, name: 'Prüfkind Sim', phone: nummer, geburtsdatum: geborenVor(12) }))}::jsonb,
         now(), now(), '', '', '', '')`);
    const [eltern] = await frage(`select phone from public.profiles where id =
      (select id from auth.users where email = 'test@all-media.app')`);
    const c = createClient(URL, KEY, { auth: { persistSession: false } });
    const an = await c.auth.signInWithPassword({ email: mail, password: pass });
    if (an.error) throw an.error;
    const { data, error } = await c.rpc('eltern_anfragen', { p_eltern: eltern.phone });
    console.log('angefragt:', JSON.stringify(error || data));
  }
  if (was === 'stand' || was === 'anlegen') {
    const z = await frage(`select u.email, public.konto_stand(u.id) as stand
      from auth.users u where u.email like ${sql(MUSTER)}`);
    console.log(JSON.stringify(z));
  }
  if (was === 'weg') {
    const z = await frage(`delete from auth.users where email like ${sql(MUSTER)} returning email`);
    console.log('gelöscht:', z.length);
  }
})().catch((e) => {
  console.error('FEHLER', e.message || e);
  process.exit(1);
});
