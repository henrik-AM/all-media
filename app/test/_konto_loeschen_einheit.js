#!/usr/bin/env node
/**
 * gemeinsam/konto-loeschen.js ohne Netz prüfen (Auftrag Recht/Sicherheit
 * 21.10., Kasten RS 2). Vorlage _bildschirmzeit_einheit.js.
 *
 * Der wichtigste Fall: Fehlt Schema 103 noch, darf der Ablauf NICHTS
 * löschen — keine Datei, kein Konto — und muss ehrlich „noch nicht" sagen.
 *
 * Start: node test/_konto_loeschen_einheit.js
 */
const fs = require('fs');
const path = require('path');
const K = require('../../gemeinsam/konto-loeschen');

let fehler = 0;
let anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

/** Ein Satz Schritte, der mitschreibt, was passiert ist. */
function attrappe(ueber = {}) {
  const log = [];
  const s = {
    log,
    passwortPruefen: async (p) => { log.push('passwort'); return p === 'richtig'; },
    medien: async () => { log.push('medien'); return { data: [], error: null }; },
    probe: async () => { log.push('probe'); return { data: { ok: true }, error: null }; },
    dateienLoeschen: async (b, n) => { log.push(`dateien:${b}:${n.length}`); return { error: null }; },
    loeschen: async (w) => { log.push(`loeschen:${w}`); return { data: { ok: true }, error: null }; },
    abmelden: async () => { log.push('abmelden'); },
  };
  return Object.assign(s, ueber);
}

(async () => {
  console.log('\n1. Normaler Weg');
  let s = attrappe({
    medien: async () => ({
      data: [
        ...Array.from({ length: 150 }, (_, i) => ({ bucket: 'media', name: `u/${i}.jpg` })),
        { bucket: 'avatars', name: 'u/ich.jpg' },
      ],
      error: null,
    }),
  });
  let r = await K.ablauf('richtig', s);
  pruefe('ok', r.ok === true, JSON.stringify(r));
  pruefe('Dateien in Päckchen zu höchstens 100', s.log.filter((x) => x.startsWith('dateien:')).join(',') === 'dateien:media:100,dateien:media:50,dateien:avatars:1', s.log.join(','));
  pruefe('Konto erst NACH den Dateien gelöscht, mit dem Wort', s.log.indexOf('loeschen:LOESCHEN') > s.log.lastIndexOf('dateien:avatars:1'));
  pruefe('danach abgemeldet', s.log[s.log.length - 1] === 'abmelden');
  pruefe('Trockenlauf vor der ersten Datei', s.log.indexOf('probe') > s.log.indexOf('medien') && s.log.indexOf('probe') < s.log.findIndex((x) => x.startsWith('dateien')), s.log.slice(0, 3).join(','));

  console.log('\n1b. Trockenlauf (Codex-Fund F1)');
  s = attrappe({ medien: async () => ({ data: [{ bucket: 'media', name: 'a.jpg' }], error: null }),
                 probe: async () => ({ data: { ok: false, grund: 'datenbank' }, error: null }) });
  r = await K.ablauf('richtig', s);
  pruefe('Datenbankteil scheitert → keine Datei, kein Konto gelöscht', r.grund === 'datenbank' && !s.log.some((x) => x.startsWith('dateien') || x.startsWith('loeschen')), s.log.join());
  pruefe('„datenbank" sagt: nichts gelöscht', /nichts gelöscht/.test(r.text), r.text);
  s = attrappe({ probe: async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.konto_loeschen_probe' } }) });
  pruefe('Trockenlauf fehlt → „noch_nicht"', (await K.ablauf('richtig', s)).grund === 'noch_nicht');
  s = attrappe({ probe: async () => ({ data: null, error: { message: 'Failed to fetch' } }) });
  pruefe('Trockenlauf ohne Netz → „netz", nichts gelöscht', (await K.ablauf('richtig', s)).grund === 'netz' && !s.log.some((x) => x.startsWith('loeschen')));

  console.log('\n2. Abbrüche, bei denen nichts gelöscht wird');
  s = attrappe();
  r = await K.ablauf('falsch', s);
  pruefe('falsches Passwort → nichts', r.grund === 'passwort' && s.log.join() === 'passwort', s.log.join());
  r = await K.ablauf('', attrappe());
  pruefe('leeres Passwort → nichts', r.grund === 'passwort');

  s = attrappe({ medien: async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.meine_medien' } }) });
  r = await K.ablauf('richtig', s);
  pruefe('Schema 103 fehlt → „noch_nicht", keine Datei, kein Konto', r.grund === 'noch_nicht' && !s.log.some((x) => x.startsWith('dateien') || x.startsWith('loeschen')), s.log.join());
  pruefe('„noch_nicht" nennt den Ausweg', /Problem melden/.test(r.text), r.text);

  s = attrappe({ medien: async () => ({ data: null, error: { code: '42883' } }) });
  pruefe('42883 gilt auch als fehlend', (await K.ablauf('richtig', s)).grund === 'noch_nicht');

  s = attrappe({ medien: async () => ({ data: null, error: { message: 'Failed to fetch' } }) });
  pruefe('kein Netz → „netz"', (await K.ablauf('richtig', s)).grund === 'netz');

  s = attrappe({
    medien: async () => ({ data: [{ bucket: 'media', name: 'a.jpg' }], error: null }),
    dateienLoeschen: async () => ({ error: { message: 'denied' } }),
  });
  r = await K.ablauf('richtig', s);
  pruefe('Datei bleibt hängen → Konto NICHT gelöscht', r.grund === 'medien' && !s.log.some((x) => x.startsWith('loeschen')), s.log.join());

  console.log('\n3. Antworten der Datenbank');
  for (const grund of ['testkonto', 'medien', 'bestaetigung', 'nicht_angemeldet']) {
    s = attrappe({ loeschen: async () => ({ data: { ok: false, grund }, error: null }) });
    r = await K.ablauf('richtig', s);
    pruefe(`„${grund}" → eigener Text, nicht abgemeldet`, r.grund === grund && r.text === K.GRUENDE[grund] && !s.log.includes('abmelden'), r.text);
  }
  s = attrappe({ loeschen: async () => { throw new Error('weg'); } });
  pruefe('Ausnahme → „netz"', (await K.ablauf('richtig', s)).grund === 'netz');
  s = attrappe({ abmelden: async () => { throw new Error('sitzung weg'); } });
  pruefe('Abmelden scheitert → trotzdem ok (Konto ist weg)', (await K.ablauf('richtig', s)).ok === true);

  console.log('\n4. Texte und Regeln');
  pruefe('Wort gleich Schema 103', K.WORT === 'LOESCHEN' &&
    fs.readFileSync(path.join(__dirname, '..', '..', 'SUPABASE_SCHEMA_103_konto_loeschen_auskunft.sql'), 'utf8').includes("is distinct from 'LOESCHEN'"));
  pruefe('Hinweis nennt: endgültig, Meldungen bleiben, Sperre, Daten herunterladen',
    /endgültig/.test(K.HINWEIS) && /Meldungen/.test(K.HINWEIS) && /Sperre/.test(K.HINWEIS) && /Meine Daten/.test(K.HINWEIS));
  // Beide Oberflächen übersetzen Supabase-Fehler über passwort.js.
  const Passwort = require('../../gemeinsam/passwort');
  pruefe('Registrierung: Supabase-Fehler → Sperrtext', /gesperrt/.test(Passwort.uebersetze('Database error saving new user')));
  pruefe('Registrierung: anderer Fehler → kein Sperrtext', !/gesperrt/.test(Passwort.uebersetze('Password should be at least 6 characters')));
  pruefe('unbekannter Grund → allgemeiner Text', /später/.test(K.grundText('xyz')));
  pruefe('kaputte Einträge im Päckchen übersprungen', K.paeckchen([null, { bucket: 'm' }, { bucket: 'm', name: 'x' }]).length === 1);
  pruefe('UMD_BAUSTEINE kennt konto-loeschen', /\['konto-loeschen', 'KontoLoeschen'\]/.test(fs.readFileSync(path.join(__dirname, '_modulquelle.js'), 'utf8')));
  pruefe('Website lädt den Baustein', fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'public', 'index.html'), 'utf8').includes('/gemeinsam/konto-loeschen.js'));

  /*
   * schritteFuer(): derselbe supabase-js-Weg für App und Website. Nachgebauter
   * Client, der jeden Aufruf mitschreibt — das Passwort geht an auth, die
   * Löschung an konto_loeschen mit dem Wort, die Dateien an die Storage-API.
   */
  console.log('\n5. Schritte mit supabase-js (App und Website)');
  const rufe = [];
  const client = {
    auth: { signInWithPassword: async (a) => { rufe.push(`auth:${a.email}:${a.password}`); return { error: a.password === 'richtig' ? null : { message: 'Invalid login credentials' } }; } },
    rpc: async (f, arg) => { rufe.push(`rpc:${f}:${JSON.stringify(arg || {})}`); return f === 'meine_medien' ? { data: [{ bucket: 'media', name: 'ich/a.jpg' }], error: null } : { data: { ok: true }, error: null }; },
    storage: { from: (b) => ({ remove: async (n) => { rufe.push(`storage:${b}:${n.join(',')}`); return { error: null }; } }) },
  };
  let abgemeldet = 0;
  const schritte = K.schritteFuer(client, 'ich@test', async () => { abgemeldet++; });
  r = await K.ablauf('falsch', schritte);
  pruefe('falsches Passwort: nur die Anmeldung, nichts gelöscht', !r.ok && r.grund === 'passwort' && rufe.join('|') === 'auth:ich@test:falsch', rufe.join('|'));
  rufe.length = 0;
  r = await K.ablauf('richtig', schritte);
  pruefe('richtiger Weg: Anmeldung → meine_medien → Trockenlauf → Storage → konto_loeschen(LOESCHEN) → abmelden',
    r.ok && abgemeldet === 1 && rufe.join('|') === 'auth:ich@test:richtig|rpc:meine_medien:{}|rpc:konto_loeschen_probe:{}|storage:media:ich/a.jpg|rpc:konto_loeschen:{"p_bestaetigung":"LOESCHEN"}', rufe.join('|'));
  rufe.length = 0;
  r = await K.ablauf('richtig', K.schritteFuer(client, '', async () => {}));
  pruefe('ohne E-Mail: abgelehnt, nichts gefragt', !r.ok && r.grund === 'passwort' && rufe.length === 0, rufe.join('|'));

  console.log(`\n${anzahl - fehler}/${anzahl} bestanden.`);
  process.exit(fehler ? 1 : 0);
})();
