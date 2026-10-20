#!/usr/bin/env node
/**
 * Feedback 28.09.2026, Kästen 9 und 15.1–15.3, 15.5 (bearbeitet 20.10.2026).
 *
 *  9.1 Name auf der Community-Homeseite antippen → Mitgliederliste.
 *  9.2 Öffentliche Community: die Liste ist sichtbar.
 *  9.3 Private Community: nur die Anzahl.
 *  9.4 Der Ersteller sieht die Liste immer, auch bei privat.
 *  9.5 Die Regel steht in der Datenbank (Schema 97, „Mitglieder lesen").
 * 15.1 Private Community: „Anfrage senden" statt Beitreten.
 * 15.2 Der Ersteller sieht die Anfrage und nimmt an oder lehnt ab.
 * 15.3 Die Regel steht in der Datenbank (Tabelle + Regeln + Annahmefunktion).
 * 15.5 Die Suche fragt die Datenbank, nicht nur die geladenen Listen.
 *
 * WAS DIESER LAUF ZEIGT
 *
 *   A  ohne Netz: Schema 97, der Baustein gemeinsam/beitritt.js, App und
 *      Website im Quelltext.
 *   B  Website im Prüfbrowser mit der Prüfattrappe (test/_attrappe.js):
 *      Aufbau, Knöpfe, Wege, welche Aufrufe die Seite schickt.
 *
 * WAS ER NICHT ZEIGT (Supabase gesperrt seit 10.10.2026)
 *
 *   Dass die Datenbank wirklich so entscheidet (Stufe 3/4): Schema 97 ist
 *   nicht eingespielt. Nach der Freigabe: Schema 97 einspielen, Zwei-Konten-
 *   Probe nachholen (siehe Kästen-Datei, „Nachholen bei Freigabe").
 *
 * Start:  BASE=http://localhost:3200 node test/k28-mitglieder.js
 *         OHNE_BROWSER=1 node test/k28-mitglieder.js     (nur A)
 *         WURZEL=~/allmedia-wt/k28-sammel node test/k28-mitglieder.js  (Gegenprobe, nur A)
 */

const fs = require('fs');
const path = require('path');

const WURZEL = process.env.WURZEL ? path.resolve(process.env.WURZEL) : path.join(__dirname, '..', '..');
const BASE = process.env.BASE || 'http://localhost:3000';
const lies = (rel) => {
  try {
    return fs.readFileSync(path.join(WURZEL, rel), 'utf8');
  } catch {
    return '';
  }
};

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK    ' : '  FEHL  ') + name + (zusatz && !wahr ? '  — ' + zusatz : ''));
};

/* ------------------------------------------------------------- A ohne Netz */
function teilA() {
  console.log('\nA  Schema, Baustein, Quelltext');
  const sql = lies('SUPABASE_SCHEMA_97_mitglieder_beitritt.sql');
  pruefe('9.5 Regel „Mitglieder lesen": eigene Zeile oder mitglieder_sichtbar',
    /create policy "Mitglieder lesen" on public\.community_members\s+for select to authenticated\s+using \(user_id = \(select auth\.uid\(\)\) or public\.mitglieder_sichtbar\(community_id\)\)/.test(sql));
  pruefe('9.5 mitglieder_sichtbar: öffentlich oder Ersteller — nicht „Mitglied"',
    /function public\.mitglieder_sichtbar[\s\S]{0,300}c\.visibility = 'public' or c\.created_by = auth\.uid\(\)/.test(sql) &&
      !/function public\.mitglieder_sichtbar[\s\S]{0,300}is_community_member/.test(sql));
  pruefe('9.5 alte Regel (jedes Mitglied liest alles) wird entfernt',
    /drop policy if exists "Mitglieder sichtbarer Communitys lesen" on public\.community_members/.test(sql));
  pruefe('9.3 Zahl als Spalte, gezählt vom Auslöser',
    /add column if not exists mitglieder_anzahl/.test(sql) && /after insert or delete on public\.community_members/.test(sql));
  pruefe('9.3 Zahl lässt sich beim Anlegen nicht fälschen', /new\.mitglieder_anzahl := 0;[\s\S]{0,80}new\.mitglieder_basis := 0;/.test(sql));
  pruefe('15.1 private Communitys auffindbar (Hülle lesbar)', /create policy "Communitys lesen" on public\.communities\s+for select to authenticated\s+using \(true\)/.test(sql));
  pruefe('15.3 Tabelle community_beitrittsanfragen mit RLS', /create table if not exists public\.community_beitrittsanfragen/.test(sql) && /alter table public\.community_beitrittsanfragen enable row level security/.test(sql));
  pruefe('15.3 anfragen nur bei privat, nicht als Ersteller, nicht als Mitglied, nicht blockiert',
    /"Beitrittsanfrage stellen"[\s\S]{0,500}c\.visibility = 'private'[\s\S]{0,120}c\.created_by is distinct from[\s\S]{0,120}blockiert_zwischen[\s\S]{0,120}not public\.is_community_member\(community_id\)/.test(sql));
  pruefe('15.3 nur_freigegebene einschränkend auf der neuen Tabelle', /create policy nur_freigegebene on public\.community_beitrittsanfragen\s+as restrictive/.test(sql));
  pruefe('15.3 Annehmen prüft den Ersteller', /beitrittsanfrage_annehmen[\s\S]{0,400}v_ersteller is distinct from auth\.uid\(\)/.test(sql));
  pruefe('15.3 Annahmefunktion für anon gesperrt', /revoke execute on function public\.beitrittsanfrage_annehmen\(uuid, uuid\) from public, anon/.test(sql));
  pruefe('15.3 Direktbeitritt bleibt zu (Regel aus 95 nicht angefasst)', !/create policy "Community beitreten"/.test(sql));
  const liste90 = (lies('SUPABASE_SCHEMA_90_push_to_talk.sql').match(/notifications_art_check\s+check \(art in \(([\s\S]*?)\)\);/) || [])[1] || '';
  const liste97 = (sql.match(/notifications_art_check\s+check \(art in \(([\s\S]*?)\)\);/) || [])[1] || '';
  const arten = (t) => (t.match(/'[a-z_]+'/g) || []).sort();
  pruefe('15.2 Mitteilungsarten: Liste aus 90 vollständig + 2 neue',
    arten(liste90).length > 0 && arten(liste90).every((a) => arten(liste97).includes(a)) &&
      arten(liste97).includes("'beitritt_anfrage'") && arten(liste97).includes("'beitritt_ok'"),
    `${arten(liste90).length} → ${arten(liste97).length}`);

  // Baustein
  let B = null;
  try {
    B = require(path.join(WURZEL, 'gemeinsam', 'beitritt.js'));
  } catch {}
  pruefe('Baustein gemeinsam/beitritt.js lädt', !!B);
  if (B) {
    pruefe('9.2 öffentlich: Liste sichtbar', B.listeSichtbar({ visibility: 'public' }) === true);
    pruefe('9.3 privat, Mitglied: nur Anzahl', B.listeSichtbar({ visibility: 'private', joined: true }) === false);
    pruefe('9.4 privat, Ersteller: Liste sichtbar', B.listeSichtbar({ visibility: 'private', eigen: true }) === true);
    pruefe('15.1 privat, fremd: „Anfrage senden"', B.knopfText({ visibility: 'private' }) === 'Anfrage senden');
    pruefe('15.1 privat, angefragt: „Angefragt"', B.knopfText({ visibility: 'private', angefragt: true }) === 'Angefragt');
    pruefe('15.1 öffentlich: „Beitreten"', B.knopfText({ visibility: 'public' }) === 'Beitreten');
    pruefe('15.1 Meldung nach der Anfrage nennt den Ersteller', /entscheidet/.test(B.meldung('anfragen', 'X')));
    pruefe('9.1 Ordnung: Ersteller, ich, dann Namen',
      B.ordnen([{ id: 'b', name: 'Zoe' }, { id: 'me', name: 'Ich' }, { id: 'a', name: 'Anna' }, { id: 'e', name: 'Ede' }], 'e', 'me').map((p) => p.id).join() === 'e,me,a,b');
    pruefe('15.5 Suchfilter in Anführungszeichen, Trenner entfernt',
      B.suchFilter(['name', 'handle'], ' @h.dikta,(x) ') === 'name.ilike."*h.dikta x*",handle.ilike."*h.dikta x*"', B.suchFilter(['name', 'handle'], ' @h.dikta,(x) '));
    pruefe('15.5 unter zwei Zeichen keine Datenbanksuche', B.suchFilter(['name'], 'a') === '');
    pruefe('Schema fehlt → nachsichtig', B.fehltSchema({ code: '42P01' }) && B.fehltSchema({ code: '42703', message: 'column communities.mitglieder_anzahl does not exist' }) && !B.fehltSchema({ code: '42501' }));
  }
  pruefe('UMD: beitritt in UMD_BAUSTEINE', /\['beitritt', 'Beitritt'\]/.test(lies('app/test/_modulquelle.js')));
  pruefe('UMD: Website lädt /gemeinsam/beitritt.js', /<script src="\/gemeinsam\/beitritt\.js"><\/script>/.test(lies('web/public/index.html')));

  // App
  const detail = lies('app/screens/communities/CommunityDetailScreen.tsx');
  const mitgl = lies('app/screens/communities/CommunityMitgliederScreen.tsx');
  const profil = lies('app/contexts/ProfilContext.tsx');
  const daten = lies('app/lib/daten.ts');
  const such = lies('app/screens/communities/CommunitySearchScreen.tsx');
  const shell = lies('app/App.tsx');
  pruefe('9.1 App: Name öffnet die Mitglieder', /accessibilityLabel="Mitglieder anzeigen"/.test(detail) && /onPress=\{\(\) => setMitgliederOffen\(true\)\}/.test(detail));
  pruefe('9.3 App: privat ohne Liste nur Anzahl', /const sichtbar = Beitritt\.listeSichtbar\(community\)/.test(mitgl) && /Beitritt\.PRIVAT_HINWEIS/.test(mitgl));
  pruefe('15.2 App: Annehmen/Ablehnen nur für den Ersteller', /community\.eigen && anfragen\.length > 0/.test(mitgl));
  pruefe('15.2 App: Fehler stehen auf der Seite', /\{!!fehler && <Text style=\{styles\.fehler\}>/.test(mitgl));
  pruefe('15.1 App: private Community → Anfrage, nie Mitgliedschaft', /zustand === 'anfragen'\s*\?\s*Aktion\.beitrittAnfragen/.test(profil));
  pruefe('15.1 App: Knopf aus dem Baustein', /Beitritt\.knopfText\(community\)/.test(detail) && !/'Anfrage' : 'Beitreten'/.test(detail));
  pruefe('9.3 App: Zahl aus mitglieder_anzahl, nachsichtig', /abfrage\(', mitglieder_anzahl'\)/.test(daten) && /Beitritt\.fehltSchema\(error\)/.test(daten));
  pruefe('15.5 App: Suche fragt die Datenbank', /suchen\(suchwort\)/.test(such) && /suchen=\{aktion\.communitySuche\}/.test(shell));
  pruefe('15.5 App: Suchtreffer wird vor dem Öffnen gemerkt', /profil\.communityMerken\(community\);\s*openCommunity\(community\)/.test(shell));
  pruefe('15.2 App: Satz für die neuen Mitteilungen', /case 'beitritt_anfrage':/.test(profil) && /case 'beitritt_ok':/.test(profil));

  // Website
  const web = lies('web/public/app.js');
  const server = lies('web/server/app.js');
  pruefe('9.1 Website: Name öffnet die Mitglieder', /\$\('#communityKopf'\)\.addEventListener\('click', \(\) => renderCommunityMitglieder\(daten\)\)/.test(web));
  pruefe('9.3 Website: Liste nur bei listeSichtbar geladen', /const sichtbar = Beitritt\.listeSichtbar\(daten\);[\s\S]{0,120}if \(sichtbar\)/.test(web));
  pruefe('15.1 Website-Server: privat → Anfrage statt Beitritt', /vorher === 'anfragen' \|\| vorher === 'angefragt'[\s\S]{0,80}handleBeitrittAnfrage/.test(server));
  pruefe('15.2 Website-Server: Annehmen/Ablehnen-Route', /app\.post\('\/api\/communities\/:id\/anfragen\/:userId'/.test(server));
  pruefe('15.5 Website-Server: Suchroute', /app\.get\('\/api\/community-suche'/.test(server));
  pruefe('15.2 Website: Satz für die neuen Mitteilungen', /beitritt_anfrage: `\$\{name\} möchte/.test(server) && /beitritt_ok: /.test(server));
}

/* --------------------------------------------------- B Website mit Attrappe */
async function teilB() {
  console.log(`\nB  Website mit Attrappe (${BASE})`);
  const { chromium } = require('playwright-core');
  const { attrappe, bestand, community, ICH } = require('./_attrappe');

  const daten = bestand({
    users: {
      [ICH]: { id: ICH, name: 'Test Konto', handle: '@test', initials: 'TK' },
      'u-anna': { id: 'u-anna', name: 'Anna Schmidt', handle: '@anna', initials: 'AS' },
      'u-ben': { id: 'u-ben', name: 'Ben Berg', handle: '@benno', initials: 'BB' },
    },
    communities: [
      community('c-oeff', 'Fotografie', { visibility: 'public', members: 3, erstellerId: 'u-anna' }),
      community('c-priv', 'Geheimclub', { visibility: 'private', members: 7, erstellerId: 'u-anna' }),
      community('c-eigen', 'Mein Kreis', { visibility: 'private', members: 2, eigen: true, erstellerId: ICH, offeneAnfragen: 1 }),
      community('c-zu', 'Gehobene Küche', { visibility: 'private', members: 5, joined: false, erstellerId: 'u-anna', channels: [] }),
    ],
  });

  const browser = await chromium.launch();
  try {
    const seite = await browser.newPage({ viewport: { width: 400, height: 860 } });
    const seitenfehler = [];
    seite.on('pageerror', (e) => seitenfehler.push(e.message));
    let anfrageGestellt = false;
    const aufrufe = await attrappe(seite, daten, {
      '/api/communities/c-oeff/mitglieder': {
        ok: true,
        mitglieder: [
          { id: 'u-ben', name: 'Ben Berg', handle: '@benno' },
          { id: ICH, name: 'Test Konto', handle: '@test' },
          { id: 'u-anna', name: 'Anna Schmidt', handle: '@anna' },
        ],
        anfragen: [],
      },
      '/api/communities/c-eigen/mitglieder': {
        ok: true,
        mitglieder: [{ id: ICH, name: 'Test Konto', handle: '@test' }, { id: 'u-anna', name: 'Anna Schmidt', handle: '@anna' }],
        anfragen: [{ id: 'u-ben', name: 'Ben Berg', handle: '@benno' }],
      },
      '/api/communities/c-eigen/anfragen/u-ben': (anfrage) =>
        JSON.parse(anfrage.postData() || '{}').annehmen === true
          ? { ok: true }
          : { ok: false, error: 'Diese Anfrage gibt es nicht mehr' },
      '/api/community-suche': {
        communities: [community('c-neu', 'Gehweg-Fotos', { visibility: 'private', members: 9, joined: false, channels: [] })],
        personen: [{ id: 'u-zoe', name: 'Zoe Gehrke', handle: '@zoe' }],
      },
      // Wie der echte Server: die Community frisch, mit dem Stand nach der Anfrage.
      '/api/communities/c-zu': () =>
        community('c-zu', 'Gehobene Küche', { visibility: 'private', members: 5, joined: false, angefragt: anfrageGestellt, erstellerId: 'u-anna', channels: [] }),
      '/api/communities/c-zu/join': () => {
        anfrageGestellt = true;
        return {
          ...community('c-zu', 'Gehobene Küche', { visibility: 'private', members: 5, joined: false, angefragt: true, channels: [] }),
          fehler: null,
          meldung: 'Anfrage an „Gehobene Küche“ gesendet – wer sie angelegt hat, entscheidet',
        };
      },
    });
    await seite.goto(BASE, { waitUntil: 'domcontentloaded' });
    await seite.waitForSelector('[data-area="communities"]', { timeout: 15000 });
    await seite.click('[data-area="communities"]');
    await seite.click('[data-sub="home"]').catch(() => {});
    await seite.waitForSelector('[data-community="c-oeff"]', { timeout: 10000 });

    // 9.1/9.2: öffentliche Community → Name → Liste
    await seite.click('[data-community="c-oeff"]');
    await seite.waitForSelector('#communityKopf', { timeout: 10000 });
    await seite.click('#communityKopf');
    await seite.waitForSelector('#mitgliederListe', { timeout: 5000 }).catch(() => {});
    const namen = await seite.$$eval('#mitgliederListe .row__name', (e) => e.map((n) => n.textContent.trim()));
    pruefe('9.1 Name öffnet die Seite „Mitglieder“', (await seite.textContent('.pagehead__title')).trim() === 'Mitglieder');
    pruefe('9.2 öffentlich: Liste sichtbar, Ersteller zuerst, dann „Du"', JSON.stringify(namen) === '["Anna Schmidt","Du","Ben Berg"]', JSON.stringify(namen));
    pruefe('9.2 Ersteller ist markiert', /Ersteller/.test(await seite.textContent('#mitgliederListe')));
    if (process.env.BILDER) await seite.waitForTimeout(700), await seite.screenshot({ path: path.join(process.env.BILDER, 'k28-9-oeffentlich.png') });
    await seite.click('#mitgliederBack');
    await seite.waitForSelector('#communityKopf', { timeout: 5000 });
    pruefe('9.1 Zurück führt auf die Homeseite', !!(await seite.$('[data-channel]')));
    pruefe('9.1 „…“ führt weiter in die Einstellungen', !!(await seite.$('#communityMehr')));

    // 9.3: private Community als Mitglied → nur Anzahl, keine Abfrage der Liste
    await seite.click('[data-area="communities"]');
    await seite.click('[data-sub="home"]').catch(() => {});
    await seite.waitForSelector('[data-community="c-priv"]', { timeout: 5000 });
    await seite.click('[data-community="c-priv"]');
    await seite.waitForSelector('#communityKopf', { timeout: 5000 });
    await seite.click('#communityKopf');
    await seite.waitForSelector('#mitgliederPrivat', { timeout: 5000 }).catch(() => {});
    const privat = (await seite.textContent('#main')).replace(/\s+/g, ' ');
    pruefe('9.3 privat: nur „7 Mitglieder“', !!(await seite.$('#mitgliederPrivat')) && /7 Mitglieder/.test(privat), privat.slice(0, 120));
    pruefe('9.3 privat: keine Namen', !(await seite.$('#mitgliederListe')) && !/Anna Schmidt/.test(privat));
    pruefe('9.3 privat: die Liste wird gar nicht erst abgefragt', !aufrufe.some((a) => a.pfad === '/api/communities/c-priv/mitglieder'));
    if (process.env.BILDER) await seite.waitForTimeout(700), await seite.screenshot({ path: path.join(process.env.BILDER, 'k28-9-privat.png') });

    // 9.4/15.2: eigene private Community → Anfragen + Liste
    await seite.click('[data-area="communities"]');
    await seite.click('[data-sub="home"]').catch(() => {});
    await seite.waitForSelector('[data-community="c-eigen"]', { timeout: 5000 });
    await seite.click('[data-community="c-eigen"]');
    await seite.waitForSelector('#communityKopf', { timeout: 5000 });
    pruefe('15.2 Homeseite zeigt „Beitrittsanfragen (1)“', /Beitrittsanfragen \(1\)/.test((await seite.textContent('#communityAnfragen').catch(() => '')) || ''));
    if (process.env.BILDER) await seite.waitForTimeout(700), await seite.screenshot({ path: path.join(process.env.BILDER, 'k28-15-home-anfragen.png') });
    await seite.click('#communityAnfragen');
    await seite.waitForSelector('#anfragenListe', { timeout: 5000 }).catch(() => {});
    pruefe('9.4 Ersteller sieht bei privat die Liste', !!(await seite.$('#mitgliederListe')) && /Anna Schmidt/.test(await seite.textContent('#mitgliederListe')));
    pruefe('15.2 Anfrage von Ben mit Annehmen/Ablehnen', /Ben Berg/.test(await seite.textContent('#anfragenListe')) &&
      (await seite.$$('[data-anfrage="u-ben"]')).length === 2);
    if (process.env.BILDER) await seite.waitForTimeout(700), await seite.screenshot({ path: path.join(process.env.BILDER, 'k28-15-anfragen.png') });
    await seite.click('[data-anfrage="u-ben"][data-annehmen="0"]');
    await seite.waitForSelector('#mitgliederFehler', { timeout: 5000 }).catch(() => {});
    pruefe('15.2 Ablehnen geht als POST {annehmen:false}', aufrufe.some((a) => a.pfad === '/api/communities/c-eigen/anfragen/u-ben' && a.methode === 'POST' && JSON.parse(a.body || '{}').annehmen === false));
    pruefe('15.2 Fehler steht auf der Seite, nicht im Toast dahinter', /Diese Anfrage gibt es nicht mehr/.test((await seite.textContent('#mitgliederFehler').catch(() => '')) || ''));
    await seite.click('[data-anfrage="u-ben"][data-annehmen="1"]');
    await seite.waitForTimeout(600);
    pruefe('15.2 Annehmen geht als POST {annehmen:true}', aufrufe.some((a) => a.pfad === '/api/communities/c-eigen/anfragen/u-ben' && JSON.parse(a.body || '{}').annehmen === true));
    pruefe('15.2 danach wird die Community frisch geholt', aufrufe.filter((a) => a.pfad === '/api/communities/c-eigen' && a.methode === 'GET').length >= 2);

    // 15.1/15.5: Suchen → private Community → Anfrage; Datenbanktreffer
    await seite.click('[data-area="communities"]');
    await seite.click('[data-sub="search"]');
    await seite.waitForSelector('#commSearch', { timeout: 5000 });
    await seite.fill('#commSearch', 'geh');
    await seite.waitForTimeout(900);
    const knopf = async (id) => ((await seite.textContent(`[data-join="${id}"]`).catch(() => '')) || '').trim();
    pruefe('15.1 private Community heißt „Anfrage senden“', (await knopf('c-zu')) === 'Anfrage senden', await knopf('c-zu'));
    pruefe('15.5 Suche fragt die Datenbank (/api/community-suche?q=geh)', aufrufe.some((a) => a.pfad === '/api/community-suche'));
    pruefe('15.5 Datenbanktreffer „Gehweg-Fotos“ steht in der Liste', !!(await seite.$('[data-community="c-neu"]')));
    pruefe('15.5 Datenbanktreffer „Zoe Gehrke“ steht unter Profile', /Zoe Gehrke/.test(await seite.textContent('#main')));
    pruefe('15.5 Eingabefeld behält den Text', (await seite.inputValue('#commSearch')) === 'geh');
    if (process.env.BILDER) await seite.waitForTimeout(500), await seite.screenshot({ path: path.join(process.env.BILDER, 'k28-15-suche.png') });
    await seite.click('[data-join="c-zu"]');
    await seite.waitForTimeout(700);
    pruefe('15.1 Antippen schickt POST …/join (Server macht daraus die Anfrage)', anfrageGestellt);
    pruefe('15.1 danach „Angefragt“', (await knopf('c-zu')) === 'Angefragt', await knopf('c-zu'));
    pruefe('15.1 Meldung sagt „Anfrage … gesendet“', /Anfrage an „Gehobene Küche“ gesendet/.test(await seite.textContent('body')));

    // 15.1: Homeseite einer fremden privaten Community — kein Inhalt, kein neues Unterthema
    await seite.click('[data-community="c-zu"]');
    await seite.waitForSelector('#communityKopf', { timeout: 5000 });
    pruefe('15.1 fremde private Community: Hinweis statt Inhalt', /Diese Community ist privat/.test(await seite.textContent('#main')));
    pruefe('15.1 kein „neues Unterthema erstellen“ ohne Mitgliedschaft', !(await seite.$('#neuesUnterthema')));
    pruefe('15.1 Knopf „Angefragt“ (leise)', /Angefragt/.test(await seite.textContent('[data-join="c-zu"]')) &&
      !(await seite.$eval('[data-join="c-zu"]', (b) => b.classList.contains('btn--primary'))));
    if (process.env.BILDER) await seite.waitForTimeout(700), await seite.screenshot({ path: path.join(process.env.BILDER, 'k28-15-privat-fremd.png') });
    await seite.click('#backBtn');
    await seite.waitForSelector('#commSearch', { timeout: 5000 }).catch(() => {});
    pruefe('15.1 Zurück führt wieder in die Suche', !!(await seite.$('#commSearch')));

    pruefe('keine Fehler in der Seite', seitenfehler.length === 0, seitenfehler.join(' | '));
  } finally {
    await browser.close();
  }
}

(async () => {
  teilA();
  if (!process.env.OHNE_BROWSER && !process.env.WURZEL) await teilB();
  console.log(`\n${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
