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

  /**
   * Ist dieser Benutzername noch frei? Beantwortet die Datenbank, ohne die
   * Profilliste preiszugeben — auch ohne Anmeldung, denn beim Registrieren
   * ist noch niemand angemeldet.
   */
  async function benutzernameFrei(name) {
    const c = await aufbauen();
    if (!c) return { frei: false, meldung: 'Anmeldung ist nicht eingerichtet.' };

    const { data, error } = await c.rpc('handle_frei', { eingabe: name });
    if (error) {
      console.error('Benutzername prüfen:', error.message);
      return { frei: false, meldung: 'Der Name lässt sich gerade nicht prüfen.' };
    }
    return data;
  }

  /**
   * Anmelden. Der Prototyp lässt „Benutzername, E-Mail, Telefonnummer" zu.
   * Supabase kennt aber nur E-Mail und Telefonnummer — ein Benutzername wird
   * deshalb vorher in die hinterlegte E-Mail übersetzt.
   */
  async function anmelden(kennung, passwort) {
    const c = await aufbauen();
    if (!c) return { ok: false, fehler: 'Anmeldung ist nicht eingerichtet.' };

    let email = (kennung || '').trim();

    if (!email.includes('@') || email.startsWith('@')) {
      const { data, error } = await c.rpc('email_zu_handle', { eingabe: email });
      if (error) {
        console.error('Benutzername auflösen:', error.message);
        return { ok: false, fehler: 'Die Anmeldung ist gerade nicht erreichbar.' };
      }
      if (!data) {
        // Bewusst dieselbe Meldung wie bei falschem Passwort: Sonst könnte man
        // durchprobieren, welche Benutzernamen es gibt.
        return { ok: false, fehler: 'Benutzername oder Passwort stimmt nicht.' };
      }
      email = data;
    }

    const { data, error } = await c.auth.signInWithPassword({ email, password: passwort });
    if (error) return { ok: false, fehler: uebersetze(error.message) };

    sitzung = data.session;
    melden();
    return { ok: true, nutzer: nutzer() };
  }

  /**
   * Registrieren. Der Benutzername kommt vom Nutzer und wird unverändert
   * übernommen — der Trigger in der Datenbank erzeugt ihn nicht mehr selbst.
   */
  async function registrieren({ benutzername, passwort, email, name }) {
    const c = await aufbauen();
    if (!c) return { ok: false, fehler: 'Anmeldung ist nicht eingerichtet.' };

    // Kurz vor dem Anlegen noch einmal prüfen: Zwischen Eingabe und Absenden
    // kann sich jemand anders denselben Namen genommen haben.
    const pruefung = await benutzernameFrei(benutzername);
    if (!pruefung.frei) return { ok: false, fehler: pruefung.meldung, feld: 'benutzername' };

    const { data, error } = await c.auth.signUp({
      email,
      password: passwort,
      options: {
        data: {
          handle: pruefung.handle,
          name: name || benutzername,
        },
      },
    });
    if (error) return { ok: false, fehler: uebersetze(error.message), feld: 'email' };

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

  /**
   * Benutzernamen nachträglich ändern.
   */
  async function benutzernameAendern(name) {
    const c = await aufbauen();
    if (!c) return { ok: false, meldung: 'Anmeldung ist nicht eingerichtet.' };

    const { data, error } = await c.rpc('handle_aendern', { eingabe: name });
    if (error) {
      console.error('Benutzername ändern:', error.message);
      return { ok: false, meldung: 'Die Änderung ist gerade nicht möglich.' };
    }
    return data;
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
    if (m.includes('invalid login credentials')) return 'Benutzername oder Passwort stimmt nicht.';
    if (m.includes('email not confirmed')) return 'Bestätige zuerst die E-Mail, die wir dir geschickt haben.';
    if (m.includes('already registered')) return 'Für diese E-Mail gibt es schon ein Konto.';
    if (m.includes('password should be at least')) return 'Das Passwort ist zu kurz.';
    if (m.includes('rate limit') || m.includes('too many')) return 'Zu viele Versuche. Bitte kurz warten.';
    if (m.includes('unable to validate email')) return 'Diese E-Mail-Adresse sieht nicht richtig aus.';
    if (m.includes('email address') && m.includes('invalid'))
      return 'Diese E-Mail-Adresse wird nicht akzeptiert. Bitte prüfe sie.';
    if (m.includes('weak password')) return 'Das Passwort ist zu einfach. Nimm eines mit mehr Zeichen.';
    if (m.includes('signups not allowed') || m.includes('signup is disabled'))
      return 'Neue Konten sind gerade nicht möglich.';
    return meldung || 'Es hat nicht geklappt.';
  }

  window.Anmeldung = {
    aufbauen,
    anmelden,
    registrieren,
    abmelden,
    passwortVergessen,
    benutzernameFrei,
    benutzernameAendern,
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
