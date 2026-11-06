#!/usr/bin/env node
/**
 * Feedback 28.09.2026, Nachtrag 11.10.2026 (2) — Agent „Karte".
 *
 *   7.5  Gelöschter geteilter Beitrag → „Beitrag nicht mehr verfügbar" statt
 *        „Beitrag geteilt" (Chat, Unterthema, Chatlisten-Vorschau), Schema 93
 *   7.6  Weg-Karte hochwertig; „gelöscht" vs. „für dich nicht sichtbar"
 *   7.7  Karte zeigt das echte Profilbild des Kontos
 *   7.8  Eigenes Kontaktbild nur im Messenger, nur ich sehe es (Schema 94)
 *
 * WAS DIESER LAUF ZEIGT
 *
 *   A  Ohne Netz: die Bausteine gemeinsam/chatblase.js (Weg-Merker, Gründe,
 *      Konten, Vorschau, nachsichtiges Laden mit gefälschtem Client) und
 *      gemeinsam/kontaktbild.js (anzeigeFuer: eigenes Bild/Spitzname nur im
 *      Messenger), die Verdrahtung beider Seiten im Quelltext und die beiden
 *      Schema-Entwürfe.
 *   B  Wirkung mit zwei Konten direkt an Supabase (braucht Schema 93 + 94):
 *      7.5  @test legt einen Beitrag an, teilt ihn in den Messenger-Chat mit
 *           @prueflauf und löscht ihn. @prueflauf liest die Nachricht:
 *           shared_post_id null, shared_post_weg gesetzt, Konto = @test.
 *           Ein Client kann den Merker selbst nicht setzen.
 *      7.8  @prueflauf setzt ein eigenes Kontaktbild für @test (gespeichert),
 *           liest es zurück; @test sieht die Zeile NICHT, sein avatar_url
 *           ist unverändert (das andere Konto merkt nichts); @test kann keine
 *           Zeile im Namen von @prueflauf anlegen; ein Nicht-Kontakt wird
 *           abgewiesen. Entfernen löscht wirklich (Gegenprüfung, RLS-DELETE
 *           meldet sonst still Erfolg).
 *
 * WAS ER NICHT ZEIGT: die Oberflächen. Im Simulator „All-Media Test" und im
 * Browser ansehen (siehe Bericht): Weg-Karte, Profilbild über der Karte,
 * „Foto bearbeiten" im Kontaktprofil, eigenes Bild in Chatliste/Chatkopf —
 * und NICHT unter Videos/Communitys.
 *
 * UNGETESTET geschrieben am 11./12.10.2026 (Supabase gesperrt, 402). Teil A
 * lief ohne Netz (OHNE_NETZ=1); Gegenprobe auf altem Stand mit
 * WURZEL=<Ordner mit altem Stand>.
 *
 * Start:  node test/k28-karte.js   (npm run test:k28-karte)
 *         OHNE_NETZ=1 nur Teil A.  WURZEL=… prüft einen anderen Stand.
 */

const fs = require('fs');
const path = require('path');

const WURZEL = process.env.WURZEL ? path.resolve(process.env.WURZEL) : path.join(__dirname, '..', '..');
const lies = (rel) => {
  try {
    return fs.readFileSync(path.join(WURZEL, rel), 'utf8');
  } catch {
    return '';
  }
};
const lade = (rel) => {
  try {
    return require(path.join(WURZEL, rel));
  } catch {
    return {};
  }
};

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz && !wahr ? '  — ' + zusatz : ''));
};
const pruefeAsync = async (name, fn) => {
  try {
    await fn();
    pruefe(name, true);
  } catch (e) {
    pruefe(name, false, e.message || String(e));
  }
};
const sicher = (fn) => {
  try {
    return fn();
  } catch {
    return false;
  }
};

/** Ein Supabase-Client, der nur antwortet, was man ihm sagt (Teil A). */
function falscherClient(antworten) {
  const aufrufe = [];
  const kette = (tabelle) => {
    const k = {
      _spalten: '',
      select(s) {
        k._spalten = s;
        return k;
      },
      eq() { return k; },
      not() { return k; },
      in() { return k; },
      limit() { return k; },
      then(ok, nein) {
        aufrufe.push(tabelle + ':' + k._spalten);
        const a = antworten(tabelle, k._spalten);
        return Promise.resolve(a).then(ok, nein);
      },
    };
    return k;
  };
  return { from: (t) => kette(t), aufrufe };
}

/* ------------------------------------------------------------- A ohne Netz */
async function teilA() {
  console.log('\nA  Bausteine und Verdrahtung (ohne Netz)' + (process.env.WURZEL ? '  [Stand: ' + WURZEL + ']' : ''));
  const C = lade('gemeinsam/chatblase.js');
  const K = lade('gemeinsam/kontaktbild.js');

  // 7.5 / 7.6 — Karte aus Merker
  const geloescht = sicher(() =>
    C.geteiltAus(null, null, { id: 'm1', shared_post_weg: '2026-10-11T10:00:00Z', shared_post_konto: 'u9' }, {
      u9: { name: 'Anna', handle: '@anna', bild: 'https://x/storage/v1/object/public/media/avatars/a.jpg' },
    })
  );
  pruefe('7.5 Gelöscht (Merker) → Weg-Karte statt Vorschautext',
    !!geloescht && geloescht.weg === true && geloescht.grund === 'geloescht');
  pruefe('7.6 Gelöscht: Konto mit Name und Bild', !!geloescht && geloescht.autorId === 'u9' && geloescht.autor === 'Anna' && /avatars/.test(geloescht.autorBild || ''));
  const unsichtbar = sicher(() => C.geteiltAus('p3', null));
  pruefe('7.6 Nicht sichtbar → eigener Grund, kein Konto erfunden',
    !!unsichtbar && unsichtbar.weg === true && unsichtbar.grund === 'unsichtbar' && !unsichtbar.autorId);
  pruefe('7.6 Zwei ehrliche Sätze, verschieden',
    sicher(() => C.geteiltWegGrund(geloescht) === C.GETEILT_GELOESCHT && C.geteiltWegGrund(unsichtbar) === C.GETEILT_UNSICHTBAR && C.GETEILT_GELOESCHT !== C.GETEILT_UNSICHTBAR));
  pruefe('7.6 Bildschirmleser: „nicht mehr verfügbar, von Anna, gelöscht"',
    sicher(() => C.geteiltBeschriftung(geloescht) === 'Beitrag nicht mehr verfügbar, von Anna, Der Beitrag wurde gelöscht'));
  pruefe('Ohne Merker und ohne Kennung: keine Karte (alte Nachricht)', sicher(() => C.geteiltAus(null, null, { id: 'm2' }) === undefined));

  // 7.7 — Profilbild
  const g = sicher(() =>
    C.geteiltAus('p1', { id: 'p1', user_id: 'u1', kind: 'reel', title: 'T', description: 'B', profiles: { name: 'Ben', handle: '@ben' } }, null, {
      u1: { name: 'Ben', handle: '@ben', bild: 'https://x/storage/v1/object/public/media/avatars/b.jpg' },
    })
  );
  pruefe('7.7 Karte trägt Konto-Kennung und echtes Profilbild', !!g && g.autorId === 'u1' && /avatars\/b\.jpg$/.test(g.autorBild || ''));

  // 7.5 — Vorschau der Chatliste
  pruefe('7.5 Vorschau: gelöscht → „Beitrag nicht mehr verfügbar"',
    sicher(() => C.geteiltVorschau({ shared_post_id: null, shared_post_weg: 'x', text: 'Beitrag geteilt' }, null) === C.GETEILT_WEG));
  pruefe('7.5 Vorschau: nicht sichtbar → „Beitrag nicht mehr verfügbar"',
    sicher(() => C.geteiltVorschau({ shared_post_id: 'p1' }, new Set(['p2'])) === C.GETEILT_WEG));
  pruefe('7.5 Vorschau: sichtbar oder Abfrage gescheitert → Text wie bisher',
    sicher(() => C.geteiltVorschau({ shared_post_id: 'p1' }, new Set(['p1'])) === null && C.geteiltVorschau({ shared_post_id: 'p1' }, null) === null));

  // Nachsichtig vor dem Schema
  const ohneSchema = falscherClient(() => ({ data: null, error: { code: '42703', message: 'column messages.shared_post_weg does not exist' } }));
  const weg = await sicher(() => C.geteiltWegLaden(ohneSchema, 'messages', 'chat_id', 'c1'));
  pruefe('Vor Schema 93: Merker-Abfrage scheitert still → leere Tabelle, Chat lädt weiter',
    !!weg && typeof weg === 'object' && Object.keys(weg).length === 0);
  const ohneBild = falscherClient((t, sp) =>
    /avatar_url/.test(sp) ? { data: null, error: { code: '42501', message: 'permission denied' } } : { data: [{ id: 'u1', name: 'Ben', handle: '@ben' }], error: null });
  const konten = await sicher(() => C.geteiltKonten(ohneBild, ['u1']));
  pruefe('Ohne avatar_url-Recht: Konten ohne Bild statt leer', !!konten && konten.u1 && konten.u1.name === 'Ben' && !konten.u1.bild);
  const sichtbar = await sicher(() => C.geteiltSichtbar(falscherClient(() => ({ data: null, error: { message: 'Netz' } })), ['p1']));
  pruefe('Sichtbarkeit unbekannt → null (keine falsche Weg-Vorschau)', sichtbar === null);

  // 7.8 — Kontaktbild-Regel
  const q = { profil: { name: 'Anna', avatar: 'profil.jpg' }, kontaktBilder: { u9: 'eigen.jpg' }, spitznamen: { u9: 'Mama' } };
  const im = sicher(() => K.anzeigeFuer('u9', { ...q, messenger: true }));
  const aus = sicher(() => K.anzeigeFuer('u9', { ...q, messenger: false }));
  pruefe('7.8 Messenger: eigenes Bild und Spitzname', !!im && im.bild === 'eigen.jpg' && im.name === 'Mama' && im.eigenesBild);
  pruefe('7.8 Videos/Communitys: Profilbild und Profilname', !!aus && aus.bild === 'profil.jpg' && aus.name === 'Anna' && !aus.eigenesBild);
  pruefe('7.8 Ohne eigenes Bild: Profilbild', sicher(() => K.anzeigeFuer('u1', { ...q, messenger: true }).bild === 'profil.jpg'));
  pruefe('7.8 Eigenes Konto nie überschrieben', sicher(() => K.anzeigeFuer('me', { ...q, kontaktBilder: { me: 'x' }, messenger: true }).bild === 'profil.jpg'));
  pruefe('7.8 Nur Adressen aus dem eigenen Eimer',
    sicher(() => K.adresseGueltig('https://a.supabase.co/storage/v1/object/public/media/avatars/x-1.jpg') && !K.adresseGueltig('https://boese.de/pixel.gif')));

  // Verdrahtung
  const spalten = lies('gemeinsam/spalten.js');
  const daten = lies('app/lib/daten.ts');
  const api = lies('web/server/supabase-api.js');
  const serverApp = lies('web/server/app.js');
  const web = lies('web/public/app.js');
  const css = lies('web/public/styles.css');
  const chat = lies('app/screens/messenger/ChatDetailScreen.tsx');
  const avatar = lies('app/components/Avatar.tsx');
  const appTsx = lies('app/App.tsx');
  const kp = lies('app/screens/messenger/ContactProfileScreen.tsx');
  const aktionen = lies('app/lib/aktionen.ts');

  pruefe('7.7 Einbettung lädt posts.user_id (Chat + Unterthema, App + Server)',
    /posts\(id, user_id,/.test(spalten) && /posts!shared_post_id\(id, user_id,/.test(daten) && /posts!shared_post_id\(id, user_id,/.test(api));
  pruefe('7.5 App + Server: Merker in Chat UND Unterthema geladen',
    (daten.match(/geteiltWegLaden\(client, '(messages|community_channel_messages)'/g) || []).length === 2 &&
      (api.match(/geteiltWegLaden\(client, '(messages|community_channel_messages)'/g) || []).length === 2);
  pruefe('7.5 App + Server: Chatlisten-Vorschau nutzt geteiltVorschau',
    /Chatblase\.geteiltVorschau\(vorschau, geteiltSichtbar\)/.test(daten) && /Chatblase\.geteiltVorschau\(vorschau, geteiltSichtbar\)/.test(api));
  pruefe('7.6 App: Weg-Karte mit Symbol, Satz und Grund',
    /geteiltWegFlaeche/.test(chat) && /trash-outline/.test(chat) && /Chatblase\.geteiltWegGrund\(/.test(chat));
  pruefe('7.6 Website: Weg-Karte mit Symbol, Satz und Grund',
    /msg__geteiltWegFlaeche/.test(web) && /C\.geteiltWegGrund\(g\)/.test(web) && /\.msg__geteiltWegFlaeche/.test(css));
  pruefe('7.7 App: Karte nutzt autorId + autorBild statt Beitragskennung',
    /id=\{item\.geteilt\.autorId \?\? item\.geteilt\.id\}/.test(chat) && /bild=\{item\.geteilt\.autorBild\}/.test(chat));
  pruefe('7.7 Website: Karte nutzt Profilbild statt fester Initialen',
    /avatarForUser\(g\.autorId, 22, messenger, g\.autorBild\)/.test(web) && !/msg__geteiltAvatar">\$\{esc\(u\)\}/.test(web));
  pruefe('7.8 App: Avatar fragt KontaktBildBereich und anzeigeFuer',
    /useImMessenger\(\)/.test(avatar) && /Kontaktbild\.anzeigeFuer\(/.test(avatar));
  pruefe('7.8 App: App.tsx setzt den Bereich (Kontaktprofil ja, öffentliches Profil nein)',
    /<KontaktBildBereich\.Provider value=\{imMessenger\}>/.test(appTsx) && /overlay\.variant === 'kontakt'/.test(appTsx));
  pruefe('7.8 App: „Foto bearbeiten" mit Mediathek, Kamera, Entfernen',
    /Kontaktbild\.FOTO_BEARBEITEN/.test(kp) && /Kontaktbild\.ENTFERNEN/.test(kp) && /fotoHochladen\(supabase, quelle, 'avatars'/.test(kp));
  pruefe('7.8 App: Speichern prüft Entfernen nach (RLS-DELETE still)',
    /export async function kontaktBildSetzen/.test(aktionen) && /if \(rest\?\.length\)/.test(aktionen));
  pruefe('7.8 Server: Route /api/kontaktbild + kontaktBilder im Bootstrap',
    /app\.post\('\/api\/kontaktbild'/.test(serverApp) && /ladeKontaktBilder\(client, nutzerId\)/.test(api));
  pruefe('7.8 Website: Messenger-Stellen mit eigenem Bild, Kanal ohne',
    /avatarForUser\(userId, 104, true\)/.test(web) && /geteiltKarte\(m\.geteilt, istMessengerChat\(/.test(web) && /\? geteiltKarte\(m\.geteilt\) : anhangInhalt/.test(web));
  pruefe('7.8 Website: „Foto bearbeiten" im Kontaktprofil', /id="kpFoto"/.test(web) && /api\('\/api\/kontaktbild'/.test(web));
  pruefe('Medien nur über vorhandene Stellen (keine neue storage.from)',
    !/storage\.from\(/.test(kp) && !/storage\.from\(/.test(lies('gemeinsam/kontaktbild.js')) && !/storage\.from\(/.test(lies('gemeinsam/chatblase.js')));
  pruefe('Baustein kontaktbild in UMD_BAUSTEINE, index.html, mit .d.ts',
    /\['kontaktbild', 'Kontaktbild'\]/.test(lies('app/test/_modulquelle.js')) &&
      /<script src="\/gemeinsam\/kontaktbild\.js"><\/script>/.test(lies('web/public/index.html')) &&
      fs.existsSync(path.join(WURZEL, 'gemeinsam/kontaktbild.d.ts')));

  const s93 = lies('SUPABASE_SCHEMA_93_geteilt_weg.sql');
  pruefe('Schema 93: Spalten, BEFORE-DELETE-Auslöser, Schutz, EXECUTE entzogen',
    /add column if not exists shared_post_weg/.test(s93) && /before delete on public\.posts/.test(s93) &&
      /geteilt_weg_schuetzen/.test(s93) && /revoke all on function public\.geteilt_weg_merken\(\) from public, anon, authenticated/.test(s93));
  const s94 = lies('SUPABASE_SCHEMA_94_kontaktbild.sql');
  pruefe('Schema 94: Tabelle, RLS nur Eigentümer, nur_freigegebene, Anker in zuruecksetzen',
    /create table if not exists public\.kontakt_bilder/.test(s94) && /enable row level security/.test(s94) &&
      /using \(owner_id = auth\.uid\(\)\)/.test(s94) && /create policy nur_freigegebene on public\.kontakt_bilder/.test(s94) &&
      /delete from public\.kontakt_bilder where owner_id = ziel/.test(s94) &&
      /revoke execute on function public\.ist_messenger_kontakt\(uuid\) from public, anon/.test(s94));
}

/* ------------------------------------------------- B mit zwei Konten */
async function teilB() {
  const { createClient } = require('@supabase/supabase-js');
  const { TESTKONTO_PASS, PRUEFKONTO_PASS } = require('./_testpasswoerter');
  const { nurTestkonto } = require('./_nur_testkonten');

  const UMG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
    ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
    : '';
  const wert = (n) => (UMG.match(new RegExp('^' + n + '=(.*)$', 'm')) || [])[1] || '';
  const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
  const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!URL || !KEY) {
    pruefe('Supabase-Zugang aus app/.env.local', false, 'EXPO_PUBLIC_SUPABASE_URL/ANON_KEY fehlen');
    return;
  }

  console.log('\nB  Wirkung mit zwei Konten (Supabase, braucht Schema 93 + 94)');
  const pr = createClient(URL, KEY);
  const te = createClient(URL, KEY);
  const a1 = await pr.auth.signInWithPassword({
    email: nurTestkonto(process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de'),
    password: process.env.AM_TEST_PASS || PRUEFKONTO_PASS,
  });
  const a2 = await te.auth.signInWithPassword({ email: nurTestkonto('test@all-media.app'), password: TESTKONTO_PASS });
  pruefe('Beide Testkonten melden sich an', !a1.error && !a2.error, (a1.error || a2.error)?.message);
  if (a1.error || a2.error) return;
  const prId = a1.data.user.id;
  const teId = a2.data.user.id;

  // Kontakt + Zweierchat des Testpaars sichern (fehlten am 06.11.2026 im
  // Testbestand; Management-API, nur die zwei Testkonten).
  const Testpaar = require('./_testpaar');
  try {
    await Testpaar.testpaarSichern();
  } catch (e) {
    pruefe('Testpaar @test ↔ @prueflauf (Kontakt + Zweierchat) sichern', false, e.message);
    return;
  }

  /* ---- 7.5: teilen, löschen, Merker lesen ---- */
  let chatId = null;
  let beitragId = null;
  let nachrichtId = null;
  await pruefeAsync('Messenger-Zweierchat @test ↔ @prueflauf vorhanden', async () => {
    const { data: meine } = await te.from('chat_members').select('chat_id, chats!chat_id(is_group, bereich)').eq('user_id', teId);
    const ids = (meine || []).filter((m) => m.chats && !m.chats.is_group && (m.chats.bereich || 'messenger') === 'messenger').map((m) => m.chat_id);
    if (!ids.length) throw new Error('@test hat keinen Messenger-Zweierchat');
    const { data: mit } = await te.from('chat_members').select('chat_id').in('chat_id', ids).eq('user_id', prId);
    chatId = (mit || [])[0]?.chat_id || null;
    if (!chatId) throw new Error('kein Messenger-Zweierchat mit @prueflauf im Testbestand');
  });
  if (chatId) {
    await pruefeAsync('@test legt einen Prüfbeitrag an', async () => {
      const { data, error } = await te.from('posts')
        .insert({ user_id: teId, kind: 'post', description: 'Prüflauf k28-karte ' + Date.now() })
        .select('id').single();
      if (error) throw error;
      beitragId = data.id;
    });
  }
  if (beitragId) {
    await pruefeAsync('@test teilt ihn in den Chat (Merker von außen nicht setzbar)', async () => {
      const { data, error } = await te.from('messages')
        .insert({ chat_id: chatId, sender_id: teId, text: 'Beitrag geteilt', shared_post_id: beitragId, shared_post_weg: new Date().toISOString() })
        .select('id').single();
      if (error) throw error;
      nachrichtId = data.id;
      const { data: z } = await pr.from('messages').select('shared_post_weg').eq('id', nachrichtId).single();
      if (z?.shared_post_weg) throw new Error('Client konnte shared_post_weg setzen — geteilt_weg_schuetzen fehlt');
    });
    await pruefeAsync('@test löscht den Beitrag', async () => {
      const { error } = await te.from('posts').delete().eq('id', beitragId);
      if (error) throw error;
      const { data } = await te.from('posts').select('id').eq('id', beitragId);
      if (data?.length) throw new Error('Beitrag steht noch da');
    });
    await pruefeAsync('7.5 Wirkung: @prueflauf liest Merker und Konto der gelöschten Karte', async () => {
      const { data, error } = await pr.from('messages').select('shared_post_id, shared_post_weg, shared_post_konto').eq('id', nachrichtId).single();
      if (error) throw error;
      if (data.shared_post_id !== null) throw new Error('shared_post_id nicht null');
      if (!data.shared_post_weg) throw new Error('Merker fehlt — Schema 93 eingespielt?');
      if (data.shared_post_konto !== teId) throw new Error('Konto = ' + data.shared_post_konto);
    });
    const C = require('../../gemeinsam/chatblase');
    await pruefeAsync('7.5 Baustein macht daraus „gelöscht" (wie App und Website)', async () => {
      const weg = await C.geteiltWegLaden(pr, 'messages', 'chat_id', chatId);
      const g = C.geteiltAus(null, null, weg[nachrichtId], {});
      if (!g || g.grund !== 'geloescht') throw new Error(JSON.stringify(g));
    });
    // Aufräumen: die Prüfnachricht wieder weg.
    await te.from('messages').delete().eq('id', nachrichtId);
  }

  /* ---- 7.8: eigenes Kontaktbild ---- */
  // Seit Schema 117: nur ein eigener Upload (medien_objekte) darf hinein.
  const medium = await Testpaar.eigenesMedium(URL, prId, 'avatars', 'k28-karte-' + Date.now() + '.jpg');
  const url = medium.url;
  const { data: teVorher } = await pr.from('profiles').select('avatar_url').eq('id', teId).maybeSingle();
  await pruefeAsync('7.8 gespeichert: @prueflauf setzt ein eigenes Bild für @test', async () => {
    const { data, error } = await pr.from('kontakt_bilder')
      .upsert({ owner_id: prId, kontakt_id: teId, media_url: url }, { onConflict: 'owner_id,kontakt_id' })
      .select('kontakt_id');
    if (error) throw new Error(error.message + ' — Schema 94 eingespielt? Kontakt im Testbestand?');
    if (!data?.length) throw new Error('keine Zeile geschrieben');
    const { data: zurueck } = await pr.from('kontakt_bilder').select('media_url').eq('owner_id', prId).eq('kontakt_id', teId).single();
    if (zurueck?.media_url !== url) throw new Error('liest anderes Bild zurück');
  });
  await pruefeAsync('7.8 wirksam: @test sieht die Zeile nicht (merkt nichts)', async () => {
    const { data } = await te.from('kontakt_bilder').select('owner_id').eq('kontakt_id', teId);
    if ((data || []).length) throw new Error('@test sieht ' + data.length + ' fremde Zeile(n)');
  });
  await pruefeAsync('7.8 wirksam: Profilbild von @test unverändert', async () => {
    const { data } = await pr.from('profiles').select('avatar_url').eq('id', teId).maybeSingle();
    if ((data?.avatar_url || null) !== (teVorher?.avatar_url || null)) throw new Error('avatar_url hat sich geändert');
  });
  await pruefeAsync('7.8 Regel: @test kann nicht im Namen von @prueflauf schreiben', async () => {
    const { error } = await te.from('kontakt_bilder').insert({ owner_id: prId, kontakt_id: teId, media_url: url });
    if (!error) throw new Error('wurde angenommen');
  });
  await pruefeAsync('7.8 Regel: fremde Adresse (Tracking-Pixel) abgewiesen', async () => {
    const { error } = await pr.from('kontakt_bilder')
      .upsert({ owner_id: prId, kontakt_id: teId, media_url: 'https://boese.de/pixel.gif' }, { onConflict: 'owner_id,kontakt_id' });
    if (!error) throw new Error('wurde angenommen');
  });
  await pruefeAsync('7.8 Regel: für einen Nicht-Kontakt abgewiesen', async () => {
    const { data: fremd } = await pr.from('profiles').select('id').neq('id', prId).neq('id', teId).limit(50);
    const { data: kontakte } = await pr.from('contacts').select('contact_id').eq('user_id', prId);
    const bekannt = new Set((kontakte || []).map((k) => k.contact_id));
    const ziel = (fremd || []).find((p) => !bekannt.has(p.id));
    if (!ziel) throw new Error('kein Nicht-Kontakt zum Prüfen gefunden');
    const { error } = await pr.from('kontakt_bilder').insert({ owner_id: prId, kontakt_id: ziel.id, media_url: url });
    if (!error) {
      await pr.from('kontakt_bilder').delete().eq('owner_id', prId).eq('kontakt_id', ziel.id);
      throw new Error('wurde angenommen (Kontakt über gemeinsamen Messenger-Chat?)');
    }
  });
  await pruefeAsync('7.8 „Eigenes Foto entfernen" löscht wirklich', async () => {
    await pr.from('kontakt_bilder').delete().eq('owner_id', prId).eq('kontakt_id', teId);
    const { data } = await pr.from('kontakt_bilder').select('kontakt_id').eq('owner_id', prId).eq('kontakt_id', teId);
    if ((data || []).length) throw new Error('Zeile steht noch da');
  });
  await Testpaar.eigenesMediumWeg(medium.pfad).catch(() => {});
}

(async () => {
  await teilA();
  if (!process.env.OHNE_NETZ) {
    try {
      await teilB();
    } catch (e) {
      pruefe('Teil B lief durch', false, e.message || String(e));
    }
  }
  console.log(`\n${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
  process.exit(fehler ? 1 : 0);
})();
