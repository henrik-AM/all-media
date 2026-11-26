/**
 * Captcha-feste Anmeldung für Prüfläufe und Werkzeuge (Fahrplan C8, 19.11.2026).
 *
 * WARUM ES DAS GIBT
 *
 * Sobald in Supabase das Captcha eingeschaltet ist, verlangt jede Anmeldung
 * mit Passwort ein `captchaToken` von Cloudflare Turnstile. Ein Prüflauf hat
 * keines — er löst kein Rätsel. Ohne diesen Helfer stünden dann alle Läufe,
 * die sich in Node anmelden, mit „captcha verification process failed“.
 *
 * Supabase überspringt das Captcha, wenn der Aufruf Admin-Rechte trägt.
 * Seit dem Schlüsseltausch (25.11.2026) ist der Admin-Schlüssel ein
 * `sb_secret_…` und KEIN JWT: im Authorization-Kopf ignoriert ihn das
 * Gateway (Live-Probe 26.11.: /auth/v1/admin/users → 403). Er muss in den
 * `apikey`-Kopf; das Gateway setzt dann selbst das service_role-JWT
 * (Probe: 200). Gelesen im Quelltext von
 * supabase/auth (internal/api/middleware.go, verifyCaptcha) — LIVE NOCH
 * NICHT GEPROBT: das geht erst, wenn der Captcha-Schalter an ist (C11/C12).
 * Bis dahin verhält sich der Helfer genau wie eine normale Anmeldung.
 *
 * DREI REGELN GEGEN GRÜN AUS FALSCHEM GRUND
 *
 *  1. Der Admin-Schlüssel geht nur in den EINEN Aufruf
 *     POST /auth/v1/token?grant_type=password — nirgends sonst hin.
 *  2. Danach arbeitet der Lauf mit einem Client, der den ANON-Schlüssel
 *     trägt, und übernimmt die Sitzung per setSession. Ein Client mit
 *     Admin-Schlüssel würde bei fehlender Sitzung still an RLS vorbeilesen.
 *  3. Die Rolle im erhaltenen Zugangstoken muss `authenticated` sein.
 *
 * Der Schlüssel kommt nur aus der Umgebung oder den .env.local-Dateien
 * (beide in .gitignore), nie aus dem Code, nie in die App oder Website,
 * nie in eine Ausgabe.
 *
 * Nutzung:
 *   const { pruefAnmelden } = require('./_anmelden');
 *   const { data, error } = await pruefAnmelden(client, { email, password });
 *   // gleiche Form wie client.auth.signInWithPassword(...)
 *
 *   const { tokenHolen } = require('./_anmelden');
 *   const sitzung = await tokenHolen(email, passwort);  // rohe Token (fetch-Läufe)
 */

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..', '..');

function ausDatei(datei, name) {
  try {
    const text = fs.readFileSync(path.join(WURZEL, datei), 'utf8');
    return ((text.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '').trim();
  } catch {
    return '';
  }
}

function wert(name) {
  return (process.env[name] || '').trim() || ausDatei('app/.env.local', name) || ausDatei('web/.env.local', name);
}

const ADRESSE = () => wert('SUPABASE_URL') || wert('EXPO_PUBLIC_SUPABASE_URL');
const ANON = () => wert('SUPABASE_ANON_KEY') || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const ADMIN = () => wert('SUPABASE_SERVICE_ROLE_KEY');

/** Rolle aus dem Zugangstoken lesen, ohne es zu prüfen (das tut Supabase). */
function rolleAus(token) {
  try {
    const teil = String(token).split('.')[1];
    return JSON.parse(Buffer.from(teil.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).role || '';
  } catch {
    return '';
  }
}

/**
 * Die eigentliche Anmeldung. Gibt die rohe Antwort von Supabase zurück
 * (access_token, refresh_token, user, …) oder wirft mit klarer Meldung.
 * `abruf` ist nur für den Einheitentest austauschbar.
 */
async function tokenHolen(email, passwort, { abruf = fetch } = {}) {
  const adresse = ADRESSE();
  const anon = ANON();
  if (!adresse || !anon) throw new Error('Prüfanmeldung: Supabase-Adresse oder anon-Schlüssel fehlt (app/.env.local)');

  // Regel 1: der Admin-Schlüssel nur hier. Fehlt er, läuft die Anmeldung
  // wie bisher — solange das Captcha aus ist, ändert das nichts.
  const kopf = pruefKopf(anon);

  const antwort = await abruf(`${adresse}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: kopf,
    body: JSON.stringify({ email, password: passwort }),
  });
  const daten = await antwort.json().catch(() => ({}));
  if (!antwort.ok || !daten.access_token) {
    const grund = daten.error_description || daten.msg || daten.message || daten.error || `HTTP ${antwort.status}`;
    const hinweis = /captcha/i.test(grund) && !ADMIN()
      ? ' — SUPABASE_SERVICE_ROLE_KEY fehlt, ohne ihn kommt kein Prüflauf am Captcha vorbei'
      : '';
    const fehler = new Error(`Prüfanmeldung ${email}: ${grund}${hinweis}`);
    fehler.status = antwort.status;
    throw fehler;
  }

  // Regel 3: ein normales Konto, keine Sonderrolle.
  const rolle = rolleAus(daten.access_token);
  if (rolle !== 'authenticated') {
    throw new Error(`Prüfanmeldung ${email}: Rolle im Token ist „${rolle || 'leer'}“, erwartet „authenticated“`);
  }
  return daten;
}

/**
 * Ersatz für `client.auth.signInWithPassword({ email, password })`.
 * Der Client muss mit dem ANON-Schlüssel gebaut sein (Regel 2) — sonst
 * bricht der Helfer ab, statt still mit Admin-Rechten zu prüfen.
 */
async function pruefAnmelden(client, { email, password }) {
  try {
    const schluessel = client?.supabaseKey || client?.rest?.headers?.apikey || '';
    const admin = ADMIN();
    if (admin && schluessel && schluessel === admin) {
      throw new Error('Prüfanmeldung: Client trägt den Admin-Schlüssel — nur anon-Clients anmelden');
    }
    const t = await tokenHolen(email, password);
    const { data, error } = await client.auth.setSession({
      access_token: t.access_token,
      refresh_token: t.refresh_token,
    });
    if (error) return { data: { user: null, session: null }, error };
    return { data: { user: data.user || data.session?.user || t.user, session: data.session }, error: null };
  } catch (fehler) {
    return { data: { user: null, session: null }, error: { message: fehler.message, status: fehler.status } };
  }
}

/**
 * Kopfzeilen für Läufe, die den Token-Endpunkt selbst per fetch rufen.
 * NUR für POST /auth/v1/token?grant_type=password verwenden (Regel 1).
 */
function pruefKopf(anon) {
  const admin = ADMIN();
  // sb_secret_… gehört in apikey (kein JWT); ein altes JWT-Format ginge
  // auch dort, das Gateway reicht es durch.
  return { apikey: admin || anon, 'Content-Type': 'application/json' };
}

/**
 * Die Website im Prüfbrowser anmelden, ohne dass die Seite selbst ein
 * Captcha braucht: Token in Node holen (tokenHolen), in die Kontenliste der
 * Website legen und über `Anmeldung.wechseln` übernehmen — derselbe Weg wie
 * „Konto wechseln“, der per setSession arbeitet und kein Captcha verlangt.
 * Gibt `{ ok, fehler, id }` zurück; wirft nicht.
 */
async function seiteAnmelden(page, email, passwort) {
  let t;
  try {
    t = await tokenHolen(email, passwort);
  } catch (fehler) {
    return { ok: false, fehler: fehler.message, status: fehler.status };
  }
  const ergebnis = await page.evaluate(
    async ({ id, mail, access_token, refresh_token }) => {
      const FACH = 'all-media.web.konten.v1';
      let konten = {};
      try { konten = JSON.parse(localStorage.getItem(FACH) || '{}') || {}; } catch {}
      konten[id] = { ...(konten[id] || {}), id, email: mail, access_token, refresh_token, zuletzt: Date.now() };
      localStorage.setItem(FACH, JSON.stringify(konten));
      const w = await window.Anmeldung.wechseln(id);
      return w.ok ? { ok: true } : { ok: false, fehler: w.fehler };
    },
    { id: t.user?.id, mail: email, access_token: t.access_token, refresh_token: t.refresh_token }
  );
  return { ...ergebnis, id: t.user?.id };
}

module.exports = { tokenHolen, pruefAnmelden, pruefKopf, seiteAnmelden, rolleAus };
