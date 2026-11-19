// Einheitentest für app/test/_anmelden.js (Fahrplan C8) — ohne Netz, ohne Supabase.
//
// Prüft die drei Regeln: Admin-Schlüssel nur im Token-Aufruf, Client mit
// anon-Schlüssel, Rolle `authenticated`. Und dass ein fehlender Admin-
// Schlüssel bei Captcha-Fehlern klar benannt wird.
//
// Start: node test/_anmelden_einheit.js

const assert = require('assert');

process.env.SUPABASE_URL = 'https://beispiel.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon-schluessel';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'admin-schluessel';

const { tokenHolen, pruefAnmelden, pruefKopf, rolleAus } = require('./_anmelden');

let gesamt = 0;
let fehler = 0;
async function pruefe(name, fn) {
  gesamt++;
  try {
    await fn();
    console.log('PASS  ' + name);
  } catch (e) {
    fehler++;
    console.log('FAIL  ' + name + '  — ' + e.message);
  }
}

const jwt = (rolle) =>
  'kopf.' + Buffer.from(JSON.stringify({ role: rolle, sub: 'u1' })).toString('base64url') + '.sig';

function abrufMit(antwort, status = 200) {
  const rufe = [];
  const abruf = async (adresse, einstellungen) => {
    rufe.push({ adresse, einstellungen });
    return { ok: status < 400, status, json: async () => antwort };
  };
  return { abruf, rufe };
}

(async () => {
  await pruefe('rolleAus liest die Rolle', () => {
    assert.strictEqual(rolleAus(jwt('authenticated')), 'authenticated');
    assert.strictEqual(rolleAus('kaputt'), '');
  });

  await pruefe('Admin-Schlüssel nur im Authorization-Kopf des Token-Aufrufs', async () => {
    const { abruf, rufe } = abrufMit({ access_token: jwt('authenticated'), refresh_token: 'r', user: { id: 'u1' } });
    await tokenHolen('a@test', 'pw', { abruf });
    assert.strictEqual(rufe.length, 1);
    assert.match(rufe[0].adresse, /\/auth\/v1\/token\?grant_type=password$/);
    assert.strictEqual(rufe[0].einstellungen.headers.Authorization, 'Bearer admin-schluessel');
    assert.strictEqual(rufe[0].einstellungen.headers.apikey, 'anon-schluessel');
  });

  await pruefe('Token mit Rolle service_role wird abgelehnt (Regel 3)', async () => {
    const { abruf } = abrufMit({ access_token: jwt('service_role'), refresh_token: 'r' });
    await assert.rejects(tokenHolen('a@test', 'pw', { abruf }), /Rolle im Token/);
  });

  await pruefe('Fehler von Supabase kommt mit Grund und Status zurück', async () => {
    const { abruf } = abrufMit({ error_description: 'Invalid login credentials' }, 400);
    await assert.rejects(tokenHolen('a@test', 'pw', { abruf }), (e) => e.status === 400 && /Invalid login/.test(e.message));
  });

  await pruefe('pruefAnmelden verweigert einen Client mit Admin-Schlüssel (Regel 2)', async () => {
    const client = { supabaseKey: 'admin-schluessel', auth: { setSession: async () => assert.fail('darf nicht rufen') } };
    const r = await pruefAnmelden(client, { email: 'a@test', password: 'pw' });
    assert.ok(r.error && /Admin-Schlüssel/.test(r.error.message));
  });

  await pruefe('pruefKopf: Admin-Schlüssel und anon zusammen', () => {
    const k = pruefKopf('anon-schluessel');
    assert.strictEqual(k.apikey, 'anon-schluessel');
    assert.strictEqual(k.Authorization, 'Bearer admin-schluessel');
  });

  // Ohne Admin-Schlüssel: nur nachstellbar, wenn keine .env.local ihn liefert.
  {
    const vorher = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = ' ';
    if (pruefKopf('x').Authorization) {
      console.log('UEBERSPRUNGEN  Captcha-Fehler ohne Admin-Schlüssel — .env.local liefert ihn (nicht gezählt)');
    } else {
      await pruefe('Ohne Admin-Schlüssel: Captcha-Fehler nennt die Ursache', async () => {
        const { abruf } = abrufMit({ error_description: 'captcha verification process failed' }, 400);
        await assert.rejects(tokenHolen('a@test', 'pw', { abruf }), /SUPABASE_SERVICE_ROLE_KEY fehlt/);
      });
    }
    process.env.SUPABASE_SERVICE_ROLE_KEY = vorher;
  }

  console.log(`\n${gesamt - fehler}/${gesamt} bestanden`);
  process.exit(fehler ? 1 : 0);
})();
