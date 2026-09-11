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

  /*
   * Die Supabase-Bibliothek liegt bei uns selbst unter public/lib/ und wird
   * von dort geladen — nicht mehr von einem fremden Auslieferdienst.
   *
   * Warum: Mit der Inhaltsrichtlinie (CSP) des Servers waere sonst eine
   * fremde Adresse fuer Skripte zu erlauben. Wer diese Adresse einmal unter
   * seine Kontrolle bringt, fuehrt Code auf jeder Seite aus, die angemeldet
   * ist — samt Zugriff auf die Sitzung. Lokal ausgeliefert entfaellt das
   * Zutrauen zu einem Dritten vollstaendig, und die Anmeldung funktioniert
   * auch dann, wenn der Dienst gerade nicht erreichbar ist.
   *
   * Fassung 2.47.10. Beim Aktualisieren die Datei neu holen:
   *   curl -o public/lib/supabase-<fassung>.js \
   *     https://cdn.jsdelivr.net/npm/@supabase/supabase-js@<fassung>/dist/umd/supabase.js
   * und den Pfad hier mitziehen.
   */
  const AUSGELIEFERT = '/lib/supabase-2.47.10.js';

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
   * Gehört diese Telefonnummer schon zu einem Konto? Dieselbe Bauart wie
   * `benutzernameFrei`: die Antwort ist ja/nein, wer dahintersteckt bleibt
   * drin. Nötig, weil `finde_per_nummer` eine Anmeldung verlangt und beim
   * Registrieren noch niemand angemeldet ist (Schema 34).
   */
  async function nummerFrei(nummer) {
    const c = await aufbauen();
    if (!c) return { frei: false, meldung: 'Anmeldung ist nicht eingerichtet.' };

    const { data, error } = await c.rpc('nummer_frei', { eingabe: nummer });
    if (error) {
      console.error('Telefonnummer prüfen:', error.message);
      return { frei: false, meldung: 'Die Nummer lässt sich gerade nicht prüfen.' };
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

    /*
     * Sicherheitspruefung 03./04.09.2026 (Fund 2): Anmelden mit `@name` geht
     * derzeit nicht.
     *
     * Hier stand ein Aufruf von `email_zu_handle()`. Diese Funktion schlaegt
     * in `auth.users` nach und gab jedem, der fragte, die E-Mail-Adresse zu
     * einem Benutzernamen heraus — erst ohne jede Anmeldung, nach der ersten
     * Reparatur immer noch jedem angemeldeten Konto. Da alle Benutzernamen
     * frei lesbar sind, liess sich damit der gesamte Bestand in eine
     * E-Mail-Liste uebersetzen. Nachgewiesen, nicht vermutet.
     *
     * Das Ausfuehrungsrecht ist deshalb vollstaendig entzogen
     * (SUPABASE_SCHEMA_23_audit.sql). Ein Weg, der beides kann — Anmelden
     * ueber den Benutzernamen, ohne die Adresse herauszugeben —, braucht
     * einen eigenen Endpunkt hinter dem Server. Bis dahin ist die
     * E-Mail-Adresse der einzige Weg, und das steht hier so, statt den Nutzer
     * an einer unverstaendlichen Fehlermeldung raten zu lassen.
     */
    if (!email.includes('@') || email.startsWith('@')) {
      return {
        ok: false,
        fehler: 'Bitte mit der E-Mail-Adresse anmelden — der Benutzername wird gerade umgebaut.',
      };
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
  async function registrieren({ benutzername, passwort, email, name, telefon }) {
    const c = await aufbauen();
    if (!c) return { ok: false, fehler: 'Anmeldung ist nicht eingerichtet.' };

    // Kurz vor dem Anlegen noch einmal prüfen: Zwischen Eingabe und Absenden
    // kann sich jemand anders denselben Namen genommen haben.
    const pruefung = await benutzernameFrei(benutzername);
    if (!pruefung.frei) return { ok: false, fehler: pruefung.meldung, feld: 'benutzername' };

    /*
     * Die Telefonnummer ist Pflicht (Henrik 07.09.2026).
     *
     * Nicht als Formsache: „Kontakt hinzufügen" läuft über die Nummer. Ein
     * Konto ohne sie ist für niemanden auffindbar. Die Form prüft
     * gemeinsam/telefon.js, die Doppelvergabe die Datenbank — hier, wo es sich
     * noch beheben lässt, und nicht erst am Eindeutigkeits-Index.
     *
     * Gleiche Regel in app/screens/LoginScreen.tsx (submit).
     */
    const grund = window.Telefon.pruefe(telefon);
    if (grund) return { ok: false, fehler: grund, feld: 'telefon' };

    const nummer = window.Telefon.speicherform(telefon);
    const nummerPruefung = await nummerFrei(nummer);
    if (!nummerPruefung.frei) return { ok: false, fehler: nummerPruefung.meldung, feld: 'telefon' };

    const { data, error } = await c.auth.signUp({
      email,
      password: passwort,
      options: {
        data: {
          handle: pruefung.handle,
          name: name || benutzername,
          // handle_new_user trägt sie in profiles.phone ein (Schema 34).
          phone: nummer,
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

  /*
   * Supabase antwortet auf Englisch. Die Uebersetzung stand vorher hier und
   * seit dem 07.09.2026 in `gemeinsam/passwort.js` — damit die App dieselben
   * Saetze zeigt. Die Fassung hier ist nur noch der Rueckfall fuer den Fall,
   * dass das Skript nicht geladen ist.
   */
  function uebersetze(meldung) {
    if (window.Passwort) return window.Passwort.uebersetze(meldung);
    return meldung || 'Es hat nicht geklappt.';
  }

  /**
   * Das eigene Passwort aendern.
   *
   * Bis zum 07.09.2026 gab es das nur als Formular: die Einstellungen
   * meldeten „Passwort geändert" und schickten nichts los. Das bisherige
   * Passwort wird gebraucht, weil Supabase seit der Sicherheitspruefung vom
   * 04.09.2026 eine frische Anmeldung verlangt, bevor es ein neues annimmt.
   */
  async function passwortAendern(bisher, neu) {
    const c = await aufbauen();
    if (!c) return { ok: false, fehler: 'Anmeldung ist nicht eingerichtet.' };

    const regel = window.Passwort ? window.Passwort.pruefe(neu) : null;
    if (regel) return { ok: false, fehler: regel };
    if (bisher === neu) return { ok: false, fehler: 'Das ist dein bisheriges Passwort.' };

    const mail = sitzung?.user?.email;
    if (!mail) return { ok: false, fehler: 'Bitte melde dich neu an.' };

    const { error: fehlerAnmeldung } = await c.auth.signInWithPassword({
      email: mail,
      password: bisher,
    });
    if (fehlerAnmeldung) return { ok: false, fehler: 'Das bisherige Passwort stimmt nicht.' };

    const { error } = await c.auth.updateUser({ password: neu });
    if (error) return { ok: false, fehler: uebersetze(error.message) };
    return { ok: true, fehler: null };
  }

  window.Anmeldung = {
    aufbauen,
    anmelden,
    registrieren,
    abmelden,
    passwortVergessen,
    passwortAendern,
    benutzernameFrei,
    nummerFrei,
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
