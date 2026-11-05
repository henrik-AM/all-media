#!/usr/bin/env node
/**
 * Feedback 28.09.2026, Nachtrag 12.10.2026 (3) — Agent „Gruppe".
 *
 *   7.9   Messenger-Gruppen bekommen eine echte Gruppeninfo (Frame 560-1471):
 *         Bild, Name, „N Mitglieder", Kacheln Audio/Video/Suchen,
 *         Mitgliederliste („Du", Antippen → Kontaktprofil/öffentliches Profil),
 *         „Gruppe verlassen".
 *   7.10  In der Gruppeninfo gilt mein Kontaktbild + Spitzname (nur Messenger).
 *   7.11  Website zieht beim Kontaktbild nach (Storys, Freundeskarte, Anruf …).
 *
 * WAS DIESER LAUF ZEIGT
 *
 *   A  Ohne Netz: der Baustein gemeinsam/gruppe.js (Reihenfolge, „Du",
 *      Kontaktbild/Spitzname nur im Messenger, Ziel beim Antippen, Zählung)
 *      und die Verdrahtung beider Seiten im Quelltext — App: GroupSettingsScreen,
 *      Overlay 'gruppe' statt Hinweis, Zurück aus dem Profil in die Gruppe,
 *      KontaktBildBereich; Website: openGruppenInfo, Gruppenkopf, Kontaktbild
 *      in Storyleiste/Betrachter/Karte/Anruf/Teilen/@-Vorschlag.
 *   B  Wirkung mit zwei Konten direkt an Supabase (kein neues Schema nötig):
 *      @prueflauf legt eine Gruppe mit @test an. @test liest die Mitglieder
 *      (Regel „Mitglieder lesen", Schema 53) und bekommt daraus mit
 *      gemeinsam/gruppe.js die Liste „Du + @prueflauf". @test kann @prueflauf
 *      NICHT hinauswerfen (RLS-DELETE meldet still Erfolg → gegenprüfen).
 *      @test verlässt die Gruppe (Schema 9): @prueflauf sieht danach nur noch
 *      sich selbst — das andere Konto merkt es wirklich. Mit Schema 94: das
 *      eigene Kontaktbild von @prueflauf für @test steht in DESSEN Liste,
 *      nicht in der von @test. Aufräumen am Ende.
 *
 * WAS ER NICHT ZEIGT: die Oberflächen. Im Simulator „All-Media Test" und im
 * Browser ansehen (siehe Bericht).
 *
 * UNGETESTET geschrieben am 12.10.2026 (Supabase gesperrt, 402). Teil A lief
 * ohne Netz (OHNE_NETZ=1); Gegenprobe auf altem Stand mit WURZEL=<Ordner>.
 *
 * Start:  node test/k28-gruppe.js   (npm run test:k28-gruppe)
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
    return undefined;
  }
};

/** Den Körper einer Funktion aus app.js schneiden (bis zur nächsten Funktion oben). */
const funktion = (quelle, name) => {
  const start = quelle.search(new RegExp('^(async )?function ' + name + '\\(', 'm'));
  if (start < 0) return '';
  const rest = quelle.slice(start + 10);
  const ende = rest.search(/^(async )?function \w+\(/m);
  return quelle.slice(start, ende < 0 ? undefined : start + 10 + ende);
};

/* ------------------------------------------------------------ A ohne Netz */
function teilA() {
  console.log('A  Baustein und Verdrahtung (ohne Netz)');
  const G = lade('gemeinsam/gruppe.js');
  const K = lade('gemeinsam/kontaktbild.js');

  // Baustein
  pruefe('gemeinsam/gruppe.js mit .d.ts', typeof G.mitglieder === 'function' && !!lies('gemeinsam/gruppe.d.ts'));
  const nutzer = { a: { name: 'Zoe', avatar: 'profil-a' }, b: { name: 'anna', avatar: 'profil-b' } };
  const liste = sicher(() =>
    G.mitglieder({
      andere: ['a', 'b', 'a'],
      ich: { name: 'Ich', bild: 'mein' },
      profil: (id) => nutzer[id],
      kontaktBilder: { a: 'eigenes-a' },
      spitznamen: { b: 'Bruder' },
      messenger: true,
      kontaktbild: K,
    })
  ) || [];
  pruefe('7.9 „Du" steht vorn, Kennung me', liste[0]?.ich === true && liste[0]?.id === 'me');
  pruefe('7.9 Doppelte Kennung nur einmal', liste.length === 3);
  pruefe('7.10 Messenger: Spitzname gilt (Bruder) und sortiert mit', liste[1]?.name === 'Bruder' && liste[1]?.eigenerName === true);
  pruefe('7.10 Messenger: mein Kontaktbild statt Profilbild', liste[2]?.bild === 'eigenes-a' && liste[2]?.eigenesBild === true);
  const comm = sicher(() =>
    G.mitglieder({
      andere: ['a', 'b'],
      profil: (id) => nutzer[id],
      kontaktBilder: { a: 'eigenes-a' },
      spitznamen: { b: 'Bruder' },
      messenger: false,
      kontaktbild: K,
    })
  ) || [];
  pruefe(
    '7.10 Community-Gruppe: Profilbild und Profilname, nie mein Kontaktbild',
    comm.some((m) => m.id === 'a' && m.bild === 'profil-a') && comm.some((m) => m.id === 'b' && m.name === 'anna')
  );
  pruefe('7.9 Unbekanntes Mitglied bekommt einen ehrlichen Namen', !!G.UNBEKANNT && sicher(() => G.mitglieder({ andere: ['x'], kontaktbild: K })[1].name) === G.UNBEKANNT);
  pruefe('7.9 Zählung wie im Chatkopf (andere + ich)', sicher(() => G.anzahlText(['a', 'b'])) === '3 Mitglieder' && sicher(() => G.anzahlText([])) === '1 Mitglied');
  pruefe(
    '7.9 Ziel: Kontakt → Kontaktprofil, sonst öffentlich, ich → nichts',
    sicher(() => G.ziel('a', { messenger: true, istKontakt: true })) === 'kontakt' &&
      sicher(() => G.ziel('a', { messenger: true, istKontakt: false })) === 'oeffentlich' &&
      sicher(() => G.ziel('a', { messenger: false, istKontakt: true })) === 'oeffentlich' &&
      sicher(() => G.ziel('me', {})) === 'selbst'
  );
  pruefe('Baustein in UMD_BAUSTEINE und index.html', /\['gruppe', 'Gruppe'\]/.test(lies('app/test/_modulquelle.js')) && /gemeinsam\/gruppe\.js/.test(lies('web/public/index.html')));

  // App
  const app = lies('app/App.tsx');
  const screen = lies('app/screens/messenger/GroupSettingsScreen.tsx');
  const detail = lies('app/screens/messenger/ChatDetailScreen.tsx');
  pruefe('7.9 App: kein Hinweis „Gruppeneinstellungen: X" mehr', !!app && !/Gruppeneinstellungen: \$\{/.test(app));
  pruefe('7.9 App: Overlay gruppe öffnet GroupSettingsScreen', /kind: 'gruppe'/.test(app) && /<GroupSettingsScreen/.test(app));
  pruefe('7.9 App: Chatoptionen „Einstellungen" bei Gruppen → Gruppeninfo', /chat\.isGroup\) return setOverlay\(\{ kind: 'gruppe'/.test(app));
  pruefe('7.9 App: Zurück aus dem Mitgliedsprofil führt in die Gruppe', (app.match(/setOverlay\(overlay\.zurueck \?\? null\)/g) || []).length >= 3);
  pruefe('7.10 App: Gruppeninfo zählt zum Messenger wie ihr Chat', /overlay\?\.kind === 'chat' \|\| overlay\?\.kind === 'gruppe'/.test(app));
  pruefe('7.9 App: Chatkopf antippen öffnet die Gruppeninfo (nicht im Unterthema)', /chat\.isGroup && !istKanal\) \{[\s\S]{0,200}onOpenGroupSettings/.test(detail));
  pruefe(
    '7.9 App: Kacheln Audio/Video/Suchen, Mitgliederliste, Gruppe verlassen',
    /Audioanruf/.test(screen) && /Videoanruf/.test(screen) && /Suchen/.test(screen) && /Gruppe\.mitglieder\(/.test(screen) && /Aktion\.chatVerlassen\(/.test(screen)
  );
  pruefe('7.10 App: Liste über Kontaktbild.anzeigeFuer mit Spitznamen und Kontext', /kontaktbild: Kontaktbild/.test(screen) && /spitznamen/.test(screen) && /useImMessenger\(\)/.test(screen));
  // Prüfung auf ein Fehlen: nur zusammen mit dem Bildschirm selbst (sonst grün aus falschem Grund).
  pruefe('7.9 App: keine Admin-Markierung erfunden', !!screen && !/Admin/.test(screen.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));

  // Website
  const web = lies('web/public/app.js');
  const gi = funktion(web, 'openGruppenInfo');
  pruefe('7.9 Website: openGruppenInfo vorhanden', !!gi);
  pruefe(
    '7.9 Website: Kacheln, Mitgliederliste, Gruppe verlassen über Route loeschen',
    /data-gi="audio"/.test(gi) && /data-gi="video"/.test(gi) && /data-gi="suche"/.test(gi) && /G\.mitglieder\(/.test(gi) && /\/loeschen`/.test(gi)
  );
  pruefe('7.10 Website: Liste mit Kontaktbild, Spitznamen und messenger', /kontaktbild: window\.Kontaktbild/.test(gi) && /spitznamen/.test(gi) && /avatarForUser\(m\.id, 40, messenger\)/.test(gi));
  pruefe('7.9 Website: Gruppenkopf im Chat öffnet die Gruppeninfo', /data-gruppeninfo/.test(web) && /\[data-gruppeninfo\]'\)\?\.addEventListener\('click', \(\) => openGruppenInfo/.test(web));
  pruefe('7.9 Website: Chatoptionen „Chat-Einstellungen" bei Gruppen → Gruppeninfo', /chat\.isGroup \? openGruppenInfo\(chatId\) : openChatSettings\(chatId\)/.test(web));
  pruefe('7.9 Website: Zurück aus Kontakt- und öffentlichem Profil in die Gruppe', /profilZurueckNehmen\(userId\)[\s\S]{0,200}#kpBack/.test(web) && /profilZurueckVon \? profilZurueckVon\(\)/.test(web));

  // 7.11 Website-Stellen
  const item = funktion(web, 'storyItem');
  pruefe('7.11 Website: Storyleiste zeigt Kontaktbild (nur Messenger-Leiste)', /Kontaktbild\.anzeigeFuer/.test(item) && /messenger: wo === 'messenger'/.test(item) && /storyItem\(g, wo\)/.test(web));
  const story = funktion(web, 'openStory');
  pruefe('7.11 Website: Story-Betrachter-Kopf mit Kontaktbild', /avatarForUser\(u\.id, 36, wo === 'messenger'\)/.test(story));
  const karte = funktion(web, 'renderFriendMap');
  pruefe('7.11 Website: Freundeskarte-Liste mit Kontaktbild', /avatarForUser\(f\.id, 44, true\)/.test(karte));
  pruefe('7.11 Website: Standort-Auswahl mit Kontaktbild', /avatarForUser\(f\.id, 44, true\)/.test(funktion(web, 'renderAusgewaehlteKontakte')));
  const anruf = funktion(web, 'openCall');
  pruefe('7.11 Website: Anrufbildschirm mit Kontaktbild', /anrufBild/.test(anruf) && /avatarForUser\(id, 52, state\.area === 'messenger'\)/.test(anruf));
  pruefe('7.11 Website: Teilen-Blatt mit Kontaktbild', /avatarForUser\(uid, 52, state\.area === 'messenger'\)/.test(funktion(web, 'openTeilen')));
  pruefe('7.11 Website: Story-Ansichten mit Kontaktbild', /avatarForUser\(v\.id, 36, state\.area === 'messenger'\)/.test(funktion(web, 'openStoryAnsichten')));
  pruefe('7.11 Website: @-Vorschläge im Messenger-Chat mit Kontaktbild', /istMessengerChat\(\{ id: ort\.chat \}\)/.test(funktion(web, 'markierungsEingabe')));
  pruefe('7.11 Website: Kontaktbild nie in Videos/Communitys fest verdrahtet', /Kontaktbild\.anzeigeFuer/.test(item) && !/messenger: true,\s*\}\)\.bild/.test(web));
}

/* ------------------------------------------------- B mit zwei Konten */
async function teilB() {
  const { createClient } = require('@supabase/supabase-js');
  const { TESTKONTO_PASS, PRUEFKONTO_PASS } = require('./_testpasswoerter');
  const { nurTestkonto } = require('./_nur_testkonten');
  const G = require('../../gemeinsam/gruppe');
  const K = require('../../gemeinsam/kontaktbild');

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

  console.log('\nB  Wirkung mit zwei Konten (Supabase, kein neues Schema; 7.10-Bild braucht Schema 94)');
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

  let gruppeId = null;
  try {
    await pruefeAsync('@prueflauf legt eine Gruppe mit @test an', async () => {
      const { data, error } = await pr.from('chats')
        .insert({ name: 'Prüflauf k28-gruppe ' + Date.now(), is_group: true, bereich: 'messenger', created_by: prId })
        .select('id').single();
      if (error) throw error;
      gruppeId = data.id;
      const { error: fM } = await pr.from('chat_members').insert([
        { chat_id: gruppeId, user_id: prId },
        { chat_id: gruppeId, user_id: teId },
      ]);
      if (fM) throw fM;
    });
    if (!gruppeId) return;

    let andere = [];
    await pruefeAsync('7.9 @test liest die Mitglieder (Regel „Mitglieder lesen", Schema 53)', async () => {
      const { data, error } = await te.from('chat_members').select('user_id').eq('chat_id', gruppeId);
      if (error) throw error;
      const ids = (data || []).map((z) => z.user_id).sort();
      if (ids.length !== 2 || !ids.includes(prId) || !ids.includes(teId)) throw new Error('liest ' + JSON.stringify(ids));
      andere = ids.filter((id) => id !== teId);
    });
    await pruefeAsync('7.9 Liste für @test: „Du" + @prueflauf mit echtem Namen', async () => {
      const { data: p } = await te.from('profiles').select('id, name, avatar_url').eq('id', prId).maybeSingle();
      const liste = G.mitglieder({ andere, ich: { name: 'Test' }, profil: () => ({ name: p?.name, avatar: p?.avatar_url }), kontaktbild: K, messenger: true });
      if (liste.length !== 2 || !liste[0].ich || liste[1].id !== prId) throw new Error(JSON.stringify(liste));
      if (!p?.name || liste[1].name !== p.name) throw new Error('Name ' + liste[1].name + ' statt ' + p?.name);
    });

    // 7.10 mit Schema 94: mein Kontaktbild steht nur in MEINER Liste.
    const bildUrl = URL.replace(/\/$/, '') + '/storage/v1/object/public/media/avatars/prueflauf-k28-gruppe-' + Date.now() + '.jpg';
    const { error: fBild } = await pr.from('kontakt_bilder')
      .upsert({ owner_id: prId, kontakt_id: teId, media_url: bildUrl }, { onConflict: 'owner_id,kontakt_id' });
    if (fBild) {
      pruefe('7.10 eigenes Kontaktbild in der Mitgliederliste', false, fBild.message + ' — Schema 94 eingespielt? Kontakt im Testbestand?');
    } else {
      await pruefeAsync('7.10 wirksam: @prueflauf sieht in der Gruppe sein Kontaktbild für @test', async () => {
        const { data } = await pr.from('kontakt_bilder').select('kontakt_id, media_url').eq('owner_id', prId);
        const liste = G.mitglieder({ andere: [teId], profil: () => ({ name: 'Test' }), kontaktBilder: K.ausZeilen(data), messenger: true, kontaktbild: K });
        if (liste[1].bild !== bildUrl) throw new Error('Bild ' + liste[1].bild);
      });
      await pruefeAsync('7.10 wirksam: @test sieht davon nichts', async () => {
        const { data } = await te.from('kontakt_bilder').select('kontakt_id, media_url').eq('owner_id', teId);
        const liste = G.mitglieder({ andere: [prId], profil: () => ({ name: 'P' }), kontaktBilder: K.ausZeilen(data), messenger: true, kontaktbild: K });
        if (liste[1].bild === bildUrl) throw new Error('@test sieht das fremde Kontaktbild');
      });
      await pr.from('kontakt_bilder').delete().eq('owner_id', prId).eq('kontakt_id', teId);
    }

    await pruefeAsync('7.9 Regel: @test kann @prueflauf nicht hinauswerfen', async () => {
      await te.from('chat_members').delete().eq('chat_id', gruppeId).eq('user_id', prId);
      // Abgelehntes DELETE meldet still Erfolg — darum gegenprüfen.
      const { data } = await pr.from('chat_members').select('user_id').eq('chat_id', gruppeId).eq('user_id', prId);
      if (!(data || []).length) throw new Error('@prueflauf wurde entfernt');
    });
    await pruefeAsync('7.9 „Gruppe verlassen": @test geht (Schema 9)', async () => {
      const { error } = await te.from('chat_members').delete().eq('chat_id', gruppeId).eq('user_id', teId);
      if (error) throw error;
      const { data } = await pr.from('chat_members').select('user_id').eq('chat_id', gruppeId).eq('user_id', teId);
      if ((data || []).length) throw new Error('@test steht noch in der Gruppe');
    });
    await pruefeAsync('7.9 wirksam: @prueflauf sieht danach nur noch sich selbst (1 Mitglied)', async () => {
      const { data } = await pr.from('chat_members').select('user_id').eq('chat_id', gruppeId);
      const andereNachher = (data || []).map((z) => z.user_id).filter((id) => id !== prId);
      if (andereNachher.length) throw new Error('noch ' + andereNachher.length + ' andere');
      if (G.anzahlText(andereNachher) !== '1 Mitglied') throw new Error(G.anzahlText(andereNachher));
    });
    await pruefeAsync('7.9 wirksam: @test sieht die Gruppe nicht mehr', async () => {
      const { data } = await te.from('chat_members').select('chat_id').eq('user_id', teId).eq('chat_id', gruppeId);
      if ((data || []).length) throw new Error('steht noch in der Liste von @test');
    });
  } finally {
    // Aufräumen: Gruppe wieder weg (Regel „Leeren Chat abraeumen", Schema 9).
    if (gruppeId) {
      await te.from('chat_members').delete().eq('chat_id', gruppeId).eq('user_id', teId);
      await pr.from('chat_members').delete().eq('chat_id', gruppeId).eq('user_id', prId);
      await pr.from('chats').delete().eq('id', gruppeId);
    }
  }
}

(async () => {
  teilA();
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
