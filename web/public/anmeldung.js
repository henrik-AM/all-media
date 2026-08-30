/*
 * Anmeldung der Website.
 *
 * Warum es das braucht: Die Datenbank ist durch Regeln geschuetzt, die fuer
 * angemeldete Nutzer gelten. Ohne Anmeldung darf die Seite dort weder lesen
 * noch schreiben — sie zeigt dann Beispieldaten. Erst mit einer Anmeldung
 * sieht man auf der Website dieselben Daten wie in der App.
 *
 * Der Ablauf:
 *   1. Zugangsdaten vom eigenen Server holen (/api/konfiguration)
 *   2. Supabase-Client im Browser aufbauen, der die Sitzung selbst speichert
 *   3. Bei jedem Aufruf an /api das Zugangstoken mitschicken
 *
 * Punkt 3 loest ein globaler Aufsatz auf fetch. Sonst muesste man alle
 * neunundsiebzig Aufrufe in app.js einzeln anfassen.
 */

(function () {
  'use strict';

  const AUSGELIEFERT = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.47.10/dist/umd/supabase.js';

  let client = null;
  let sitzung = null;
  const zuhoerer = new Set();

  // ------------------------------------------------------------- Aufbau --

  function skriptLaden(pfad) {
    return new Promise((fertig, fehler) => {
      if (window.supabase?.createClient) return fertig();
      const el = document.createElement('script');
      el.src = pfad;
      el.onload = fertig;
      el.onerror = () => fehler(new Error('Supabase-Bibliothek nicht erreichbar'));
      document.head.appendChild(el);
    });
  }

  async function aufbauen() {
    if (client) return client;

    const antwort = await fetch('/api/konfiguration');
    const konfig = await antwort.json();
    if (!konfig.konfiguriert) return null;

    await skriptLaden(AUSGELIEFERT);

    client = window.supabase.createClient(konfig.supabaseUrl, konfig.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'all-media-sitzung' },
    });

    const { data } = await client.auth.getSession();
    sitzung = data?.session || null;

    client.auth.onAuthStateChange((_ereignis, neue) => {
      sitzung = neue;
      melden();
    });

    return client;
  }

  function melden() {
    for (const fn of zuhoerer) {
      try {
        fn(nutzer());
      } catch (fehler) {
        console.error('Fehler beim Melden der Anmeldung:', fehler);
      }
    }
  }

  // ------------------------------------------- Token an jeden API-Aufruf --

  const echtesFetch = window.fetch.bind(window);

  window.fetch = function (ziel, einstellungen) {
    const adresse = typeof ziel === 'string' ? ziel : ziel?.url || '';
    const eigeneApi = adresse.startsWith('/api') || adresse.includes(location.host + '/api');

    if (!eigeneApi || !sitzung?.access_token) {
      return echtesFetch(ziel, einstellungen);
    }

    const mit = { ...(einstellungen || {}) };
    const kopf = new Headers(mit.headers || (typeof ziel === 'object' ? ziel.headers : undefined));
    kopf.set('Authorization', 'Bearer ' + sitzung.access_token);
    mit.headers = kopf;

    return echtesFetch(ziel, mit);
  };

  // ------------------------------------------------------------ Nach aussen --

  function nutzer() {
    if (!sitzung?.user) return null;
    const u = sitzung.user;
    return {
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || (u.email || '').split('@')[0],
      handle: u.user_metadata?.handle || '@' + (u.email || '').split('@')[0],
    };
  }

  async function anmelden(email, passwort) {
    const c = await aufbauen();
    if (!c) return { ok: false, fehler: 'Anmeldung ist nicht eingerichtet.' };

    const { data, error } = await c.auth.signInWithPassword({ email, password: passwort });
    if (error) return { ok: false, fehler: uebersetze(error.message) };

    sitzung = data.session;
    melden();
    return { ok: true, nutzer: nutzer() };
  }

  async function registrieren(email, passwort, name) {
    const c = await aufbauen();
    if (!c) return { ok: false, fehler: 'Anmeldung ist nicht eingerichtet.' };

    const { data, error } = await c.auth.signUp({
      email,
      password: passwort,
      options: {
        data: {
          name: name || (email || '').split('@')[0],
          handle: '@' + (email || '').split('@')[0].replace(/[^a-z0-9]/gi, ''),
        },
      },
    });
    if (error) return { ok: false, fehler: uebersetze(error.message) };

    // Ohne bestaetigte E-Mail gibt Supabase keine Sitzung heraus.
    if (!data.session) {
      return {
        ok: true,
        bestaetigen: true,
        fehler: null,
        hinweis: 'Wir haben dir eine E-Mail geschickt. Bestätige sie, dann kannst du dich anmelden.',
      };
    }

    sitzung = data.session;
    melden();
    return { ok: true, nutzer: nutzer() };
  }

  async function abmelden() {
    const c = await aufbauen();
    if (c) await c.auth.signOut();
    sitzung = null;
    melden();
    return { ok: true };
  }

  async function passwortVergessen(email) {
    const c = await aufbauen();
    if (!c) return { ok: false, fehler: 'Anmeldung ist nicht eingerichtet.' };

    const { error } = await c.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin,
    });
    if (error) return { ok: false, fehler: uebersetze(error.message) };
    return { ok: true };
  }

  // Supabase antwortet auf Englisch; hier stehen die Faelle, die Nutzer
  // wirklich zu sehen bekommen.
  function uebersetze(meldung) {
    const m = (meldung || '').toLowerCase();
    if (m.includes('invalid login credentials')) return 'E-Mail oder Passwort stimmt nicht.';
    if (m.includes('email not confirmed')) return 'Bestätige zuerst die E-Mail, die wir dir geschickt haben.';
    if (m.includes('already registered')) return 'Für diese E-Mail gibt es schon ein Konto.';
    if (m.includes('password should be at least')) return 'Das Passwort ist zu kurz.';
    if (m.includes('rate limit') || m.includes('too many')) return 'Zu viele Versuche. Bitte kurz warten.';
    if (m.includes('unable to validate email')) return 'Diese E-Mail-Adresse sieht nicht richtig aus.';
    return meldung || 'Es hat nicht geklappt.';
  }

  window.Anmeldung = {
    aufbauen,
    anmelden,
    registrieren,
    abmelden,
    passwortVergessen,
    nutzer,
    angemeldet: () => Boolean(sitzung?.access_token),
    beiAenderung: (fn) => {
      zuhoerer.add(fn);
      return () => zuhoerer.delete(fn);
    },
  };

  /*
   * `bereit` sagt app.js, ab wann feststeht, ob jemand angemeldet ist. Ohne
   * das wuerde die Seite Beispieldaten laden, obwohl eine Sitzung vorliegt.
   *
   * Wichtig ist aber, dass niemand darauf wartet, der es nicht muss: Der
   * Aufbau laedt die Supabase-Bibliothek von einem fremden Server. Wer nicht
   * angemeldet ist, soll dafuer keine Sekunde vor einer leeren Seite sitzen.
   * Ob eine Sitzung vorliegt, steht im localStorage und ist sofort da — also
   * wird nur in diesem Fall gewartet.
   */
  function sitzungGespeichert() {
    try {
      const roh = localStorage.getItem('all-media-sitzung');
      return Boolean(roh && JSON.parse(roh)?.access_token);
    } catch {
      return false;
    }
  }

  const fertig = aufbauen()
    .then(() => {
      if (sitzung) melden();
      return nutzer();
    })
    .catch((fehler) => {
      console.warn('Anmeldung nicht verfügbar:', fehler.message);
      return null;
    });

  window.Anmeldung.bereit = sitzungGespeichert() ? fertig : Promise.resolve(null);
})();
