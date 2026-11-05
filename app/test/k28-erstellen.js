#!/usr/bin/env node
/**
 * Kästen 28/10.2 und 16 (Feedback 28.09.2026): Community und Unterthema
 * erstellen nach dem Figma-Prototyp, Schema 99.
 *
 *   A  ohne Netz: Schema 99, der Baustein gemeinsam/erstellen.js, App und
 *      Website im Quelltext.
 *   B  Website mit Prüfattrappe (_attrappe.js): beide Erstellen-Seiten
 *      aufbauen, ausfüllen, absenden; Bild auf der Homeseite; Einladung per
 *      Link. Belegt nur Stufe 1–2 (Gegenstand, bedienbar) — gespeichert und
 *      wirksam erst nach der Freigabe (zwei Konten, siehe Kästen-Datei).
 *
 * Start:  BASE=http://localhost:3200 node test/k28-erstellen.js
 *         BILDER=<ordner>   legt Bilder ab
 *         WURZEL=<anderer Stand> OHNE_BROWSER=1   Gegenprobe nur Teil A
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
  console.log('\nA  Schema 99, Baustein, Quelltext');
  const sql = lies('SUPABASE_SCHEMA_99_erstellen_einladung.sql');
  pruefe('16 Spalte communities.bild_url, nur eigene Medienstelle (avatars)',
    /add column if not exists bild_url text/.test(sql) && /bild_url ~ '\/storage\/v1\/object\/public\/media\/avatars\//.test(sql));
  pruefe('10.2 Spalten bio, link, privat, erstellt_von an community_channels',
    /add column if not exists bio text[\s\S]{0,80}add column if not exists link text[\s\S]{0,80}add column if not exists privat boolean[\s\S]{0,80}add column if not exists erstellt_von uuid/.test(sql));
  pruefe('10.2 Ersteller setzt die Datenbank (unterthema_vorgaben)', /new\.erstellt_von := auth\.uid\(\);/.test(sql) && /before insert on public\.community_channels/.test(sql));
  pruefe('10.2 privat: Zugang = Ersteller Unterthema, Ersteller Community oder eingeladen',
    /function public\.unterthema_zugang[\s\S]{0,600}not k\.privat[\s\S]{0,80}k\.erstellt_von = p_wer[\s\S]{0,60}c\.created_by = p_wer[\s\S]{0,200}unterthema_mitglieder/.test(sql));
  pruefe('10.2 unterthema_zugang für niemanden ausführbar (sonst abfragbar, wer drin ist)',
    /revoke execute on function public\.unterthema_zugang\(uuid, uuid\) from public, anon, authenticated/.test(sql));
  pruefe('10.2 Nachrichten privater Unterthemen: kanal_sichtbar prüft den Zugang',
    /function public\.kanal_sichtbar[\s\S]{0,400}public\.unterthema_zugang\(k\.id, auth\.uid\(\)\)/.test(sql));
  pruefe('10.2 Unterthemen-Liste: Regel „Kanaele lesen“ blendet private aus',
    /create policy "Kanaele lesen" on public\.community_channels[\s\S]{0,160}not privat or public\.unterthema_offen\(id\)/.test(sql));
  pruefe('10.2 Push to Talk: einschränkende Regel + Mitteilung nur mit Zugang',
    /"PTT nur mit Unterthema-Zugang" on public\.ptt_messages\s+as restrictive/.test(sql) &&
      /function public\.ptt_mitteilen[\s\S]{0,900}public\.unterthema_zugang\(p_kanal, m\.user_id\)/.test(sql));
  pruefe('10.2 @-Markierung im privaten Unterthema nur mit Zugang', /elsif p_art = 'kanal'[\s\S]{0,600}public\.unterthema_zugang\(v_kanal, wen\)/.test(sql));
  pruefe('10.2 unterthema_mitglieder: RLS, nur_freigegebene, kein direktes INSERT',
    /alter table public\.unterthema_mitglieder enable row level security/.test(sql) &&
      /create policy nur_freigegebene on public\.unterthema_mitglieder\s+as restrictive/.test(sql) &&
      /revoke insert, update on public\.unterthema_mitglieder from authenticated/.test(sql));
  pruefe('10.2/16 einladungen: Code-Format, RLS, nur Ersteller liest/legt an, nur_freigegebene',
    /code\s+text primary key check \(code ~ '\^\[a-z2-9\]\{16,32\}\$'\)/.test(sql) &&
      /create policy "Einladung lesen"[\s\S]{0,120}erstellt_von = \(select auth\.uid\(\)\)/.test(sql) &&
      /create policy "Einladung anlegen"[\s\S]{0,700}c\.created_by = \(select auth\.uid\(\)\)/.test(sql) &&
      /create policy nur_freigegebene on public\.einladungen\s+as restrictive/.test(sql));
  pruefe('10.2/16 einladung_annehmen: angemeldet, freigegeben, nicht blockiert; anon gesperrt',
    /function public\.einladung_annehmen[\s\S]{0,1200}konto_freigegeben\(\)[\s\S]{0,2500}blockiert_zwischen\(v_ich, v_e\.erstellt_von\)/.test(sql) &&
      /revoke execute on function public\.einladung_annehmen\(text\) from public, anon/.test(sql));
  // Codex-Fund Paket 3 (05.11.2026): Unterthema-Einladung umging Schema 97.
  const annehmen = (sql.match(/create or replace function public\.einladung_annehmen[\s\S]*?end \$\$;/) || [''])[0];
  pruefe('Fund P3: einladung_annehmen prüft Blockierung auch gegenüber dem Community-Ersteller',
    /blockiert_zwischen\(v_ich, v_e\.erstellt_von\)\s+or \(v_c\.created_by is not null and public\.blockiert_zwischen\(v_ich, v_c\.created_by\)\)/.test(annehmen));
  pruefe('Fund P3: Unterthema-Einladung macht bei privater Community nicht zum Mitglied (vor dem INSERT)',
    /v_e\.channel_id is not null\s+and v_c\.visibility <> 'public'[\s\S]{0,300}raise exception 'Diese Einladung gilt nur für Mitglieder der Community – tritt ihr zuerst bei'[\s\S]{0,40}insert into public\.community_members/.test(annehmen));
  pruefe('Fund P3: ausgeblendete Community und ausgetretener Unterthema-Ersteller: Einladung ungültig',
    /v_c\.moderiert_am is not null/.test(annehmen) && /m\.user_id = v_e\.erstellt_von/.test(annehmen));
  pruefe('Fund P3: Blockier-/Mitglieder-Prüfung steht vor jedem Eintragen',
    annehmen.indexOf('blockiert_zwischen') > 0 && annehmen.indexOf('blockiert_zwischen') < annehmen.indexOf('insert into public.community_members'));
  pruefe('Fund P3: Regel „Einladung anlegen“: Unterthema-Ersteller nur, solange Mitglied',
    /create policy "Einladung anlegen"[\s\S]{0,900}k\.erstellt_von = \(select auth\.uid\(\)\)\s+and public\.is_community_member\(c\.id\)/.test(sql));
  pruefe('Fund P3: Bild-Check zusätzlich medien_adresse_gueltig (eigener Host)',
    /communities_bild_url_check\s+check \(bild_url is null[\s\S]{0,160}and public\.medien_adresse_gueltig\(bild_url\)/.test(sql));
  pruefe('99 Selbstprüfung am Ende', /raise exception 'unterthema_mitglieder ist direkt beschreibbar'/.test(sql));
  const reihenfolge = lies('SUPABASE_REIHENFOLGE.md');
  pruefe('99 in SUPABASE_REIHENFOLGE.md (nach 98)', /Schema 99/.test(reihenfolge) && /97 → 98 → 99/.test(reihenfolge));

  // Baustein
  let E = null;
  try {
    E = require(path.join(WURZEL, 'gemeinsam', 'erstellen.js'));
  } catch {}
  pruefe('Baustein gemeinsam/erstellen.js lädt', !!E);
  if (E) {
    pruefe('16.2 Community: Name Pflicht', /benennen/.test(E.pruefeCommunity({ bild: true }).fehler || ''));
    pruefe('16.2 Community: Bild Pflicht (Stern im Prototyp)', E.pruefeCommunity({ name: 'X' }).fehler === 'Bitte ein Bild einfügen');
    const ok = E.pruefeCommunity({ name: ' Nachtschicht ', bild: true, bio: 'Nach 22 Uhr', link: 'beispiel.de', unterthemen: ['Technik', 'technik', '', 'Allgemein', 'Treffen'], privat: true });
    pruefe('16.2 Community: Werte sauber (Link mit https, Unterthemen ohne doppelte/„Allgemein“)',
      !ok.fehler && ok.werte.name === 'Nachtschicht' && ok.werte.link === 'https://beispiel.de' &&
        JSON.stringify(ok.werte.unterthemen) === '["Technik","Treffen"]' && ok.werte.privat === true, JSON.stringify(ok));
    pruefe('10.2 Unterthema: falscher Link wird abgelehnt', !!E.pruefeUnterthema({ name: 'A', link: 'kein link' }).fehler);
    pruefe('10.2 Unterthema: kein Bild nötig', !E.pruefeUnterthema({ name: 'A' }).fehler);
    const bytes = Array.from({ length: 16 }, (_, i) => (i * 37 + 11) % 256);
    const code = E.neuerCode(bytes);
    pruefe('Code passt zur Datenbankregel ^[a-z2-9]{16,32}$', /^[a-z2-9]{16,32}$/.test(code) && E.istCode(code), code);
    let wirft = false;
    try { E.neuerCode([1, 2, 3]); } catch { wirft = true; }
    pruefe('Code nie aus zu wenig Zufall', wirft);
    pruefe('Link ↔ Code (Website, QR)', E.codeAus(E.link(code, 'https://x.de/')) === code && E.link(code, 'https://x.de/') === `https://x.de/?einladung=${code}`);
    pruefe('fremder QR-Code / Telefonnummer ist keine Einladung', E.codeAus('allmedia:+49 151 2345678') === null && E.codeAus('https://werbung.de/?a=1') === null);
    const eigen = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/avatars/a-1.jpg';
    pruefe('Fund P3: Bildvertrag — eigene avatars-Adresse ok, fremder Host mit Eimer-Pfad nein',
      typeof E.bildAdresseGueltig === 'function' && E.bildAdresseGueltig(eigen) && E.bildAdresseGueltig(eigen, 'https://ijztosbjfybdgotpdixw.supabase.co/') &&
        !E.bildAdresseGueltig('https://boese.example/storage/v1/object/public/media/avatars/a-1.jpg') &&
        !E.bildAdresseGueltig('https://ijztosbjfybdgotpdixw.supabase.co.boese.example/storage/v1/object/public/media/avatars/a-1.jpg') &&
        !E.bildAdresseGueltig(eigen + '?t=1') &&
        !E.bildAdresseGueltig(eigen.replace('/avatars/', '/posts/')) &&
        !E.bildAdresseGueltig(eigen.replace('a-1.jpg', 'x/a-1.jpg')) &&
        !E.bildAdresseGueltig(null));
    pruefe('Fund P3: Fehlersätze im Baustein = Sätze im Schema',
      !!E.FEHLER && [E.FEHLER.einladungWeg, E.FEHLER.einladungBlockiert, E.FEHLER.einladungNurMitglieder].every((t) => sql.includes(`'${t}'`)));
    pruefe('Fund P3: Standard-Host im Baustein = Host in medien_adresse_gueltig (live, Schema 23/95)',
      E.SUPABASE_STANDARD === 'https://ijztosbjfybdgotpdixw.supabase.co');
    pruefe('fehltSchema erkennt fehlende Spalte/Tabelle', E.fehltSchema({ code: '42703' }) && E.fehltSchema({ code: 'PGRST205' }) && !E.fehltSchema({ code: '42501' }));
  }
  pruefe('UMD: erstellen in UMD_BAUSTEINE', /\['erstellen', 'Erstellen'\]/.test(lies('app/test/_modulquelle.js')));
  pruefe('UMD: Website lädt /gemeinsam/erstellen.js', /<script src="\/gemeinsam\/erstellen\.js"><\/script>/.test(lies('web/public/index.html')));

  // App
  const seite = lies('app/screens/communities/ErstellenScreen.tsx');
  const app = lies('app/App.tsx');
  const profil = lies('app/contexts/ProfilContext.tsx');
  const aktionen = lies('app/lib/aktionen.ts');
  const daten = lies('app/lib/daten.ts');
  const detail = lies('app/screens/communities/CommunityDetailScreen.tsx');
  const scanner = lies('app/components/AddContactSheet.tsx');
  pruefe('App: Erstellen-Seite mit allen Feldern aus dem Prototyp',
    ['T.pflichtfeld', 'T.communityName', 'T.unterthemaName', 'T.bild', 'T.bio', 'T.link', 'T.unterthemen', 'T.privatUnterthema', 'T.einladen', 'T.qr', 'T.fertig'].every((t) => seite.includes(t)));
  pruefe('App: QR-Code und Teilen mit dem Einladungslink', /<QrCode text=\{einladung\}/.test(seite) && /Share\.share/.test(seite) && /ExpoCrypto\.getRandomBytes/.test(seite));
  pruefe('App: Fehler stehen auf der Seite', /testID="erstellen-meldung"/.test(seite));
  pruefe('10.1/10.2 App: Seite im eigenen Modal (vor jeder Vollbildansicht)', /<Modal\s+visible=\{!!erstellen\}/.test(app) && /<ErstellenScreen/.test(app));
  pruefe('App: Plus → Community und Homeseite → Unterthema öffnen die Seite',
    /return setErstellen\(\{ art: 'community' \}\)/.test(app) && /onNeuesUnterthema=\{\(\) => setErstellen\(\{ art: 'unterthema', communityId: community\.id \}\)\}/.test(app));
  pruefe('App: altes Formular „Name der Community“/„Name des Unterthemas“ weg', !/Name der Community|Name des Unterthemas/.test(app));
  pruefe('16.3 App: Community + „Allgemein“ + Unterthemen + Einladung in der Datenbank',
    /for \(const name of \['Allgemein', \.\.\.werte\.unterthemen\]\)/.test(profil) && /einladungSpeichern\(supabase, daten\.ichId, code, id\)/.test(profil) && /await daten\.neuLaden\(\)/.test(profil));
  pruefe('10.2 App: privates Unterthema nie still öffentlich anlegen', /if \(brauchtZusatz\) throw new Error\(Erstellen\.FEHLT_SCHEMA\)/.test(aktionen));
  pruefe('16.3 App: Bild aus der Datenbank, unterschrieben', /Erstellen\.zusatzLaden\(client/.test(daten) && /bild: zusatz\.bild\[c\.id\]/.test(daten));
  pruefe('16.3 App: Bild auf der Homeseite, Schloss bei privatem Unterthema', /community\.bild \?/.test(detail) && /ut\.privat &&/.test(detail));
  pruefe('App: gescannter Einladungscode wird angenommen', /Erstellen\.codeAus\(text\)/.test(scanner) && /profil\.einladungAnnehmen\(code\)/.test(app));

  // Website
  const web = lies('web/public/app.js');
  const server = lies('web/server/app.js');
  const handler = lies('web/server/sync-handlers.js');
  const api = lies('web/server/supabase-api.js');
  pruefe('Website: eine Erstellen-Seite für beide Wege', /function openErstellenSeite\(art, community\)/.test(web) &&
    /openErstellenSeite\('community'\)/.test(web) && /openErstellenSeite\('unterthema', daten\)/.test(web));
  pruefe('Website: Code aus crypto.getRandomValues, QR vom Server', /crypto\.getRandomValues\(new Uint8Array\(Erstellen\.CODE_LAENGE\)\)/.test(web) && /\/api\/einladung-qr\.svg\?code=/.test(web));
  pruefe('Website: ?einladung= wird nach dem Start angenommen', /einladungAusLink\(\);/.test(web) && /api\(`\/api\/einladung\/\$\{encodeURIComponent\(code\)\}`\)/.test(web));
  pruefe('Website: Bild auf Homeseite und in Listen', /id="communityBild"/.test(web) && /const foto = c\.bild/.test(web));
  pruefe('Fund P3: Server prüft Community-Bild mit dem Baustein (Host + Pfad), nicht nur das Pfadende',
    /app\.post\('\/api\/communities'[\s\S]{0,1200}Erstellen\.bildAdresseGueltig\(bildUrl, supabaseUrl\)/.test(server));
  pruefe('Fund P3: App prüft Community-Bild mit demselben Baustein',
    /function communityAnlegen[\s\S]{0,1200}Erstellen\.bildAdresseGueltig\(zusatz\.bildUrl, SUPABASE_CONFIG\.url\)/.test(aktionen));
  pruefe('Fund P3: Fehlersatz der Datenbank kommt unverändert an (App e.message, Website res.error)',
    /return \{ fehler: e\?\.message \?\? 'Diese Einladung gibt es nicht mehr' \}/.test(profil) &&
      /if \(!res\.ok\) return toast\(res\.error \|\| 'Diese Einladung gibt es nicht mehr'\)/.test(web));
  pruefe('Server: Prüfregel aus dem Baustein, Routen für Einladung',
    /Erstellen\.pruefeCommunity\(/.test(server) && /Erstellen\.pruefeUnterthema\(/.test(server) &&
      /app\.post\('\/api\/einladung\/:code'/.test(server) && /app\.get\('\/api\/einladung-qr\.svg'/.test(server));
  pruefe('Server: privates Unterthema nie still öffentlich anlegen', /if \(brauchtZusatz\) return \{ ok: false, fehler: Erstellen\.FEHLT_SCHEMA \}/.test(handler));
  pruefe('Server: Bild und Unterthema-Felder geladen', /Erstellen\.zusatzLaden\(client/.test(api) && /Erstellen\.kanalFelder\(zusatz, k\.id, nutzerId\)/.test(api));
}

/* --------------------------------------------------- B Website mit Attrappe */
async function teilB() {
  console.log(`\nB  Website mit Attrappe (${BASE})`);
  const { chromium } = require('playwright-core');
  const QRCode = require(path.join(WURZEL, 'web', 'node_modules', 'qrcode'));
  const E = require(path.join(WURZEL, 'gemeinsam', 'erstellen.js'));
  const { attrappe, bestand, community, ICH } = require('./_attrappe');

  const BILD = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/avatars/pruef-community.png';
  const pixel = fs.readFileSync(path.join(__dirname, '_testbild.png'));
  const daten = bestand({
    communities: [community('c-oeff', 'Fotografie', { visibility: 'public', members: 3, erstellerId: 'u-anna' })],
  });

  const browser = await chromium.launch();
  try {
    const kontext = await browser.newContext({ viewport: { width: 400, height: 860 } });
    await kontext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
    const seite = await kontext.newPage();
    const seitenfehler = [];
    seite.on('pageerror', (e) => seitenfehler.push(e.message));
    const aufrufe = await attrappe(seite, daten, {
      '/api/hochladen': { ok: true, url: BILD, anzeige: BILD },
      '/api/communities': (anfrage) => {
        if (anfrage.method() !== 'POST') return [];
        const k = JSON.parse(anfrage.postData() || '{}');
        const neu = community('c-neu', k.name, {
          visibility: k.sichtbarkeit, members: 1, eigen: true, erstellerId: ICH, bio: k.bio, link: k.link, bild: BILD,
          channels: ['Allgemein', ...(k.unterthemen || [])].map((n, i) => ({ id: `c-neu-k${i}`, slug: n, name: n, topics: [] })),
        });
        daten.communities.push(neu);
        return { ok: true, community: neu, hinweis: null };
      },
      '/api/communities/c-neu/channels': (anfrage) => {
        const k = JSON.parse(anfrage.postData() || '{}');
        const c = daten.communities.find((x) => x.id === 'c-neu');
        c.channels.push({ id: 'c-neu-geheim', slug: 'geheim', name: k.name, topics: [], bio: k.bio, link: k.link, privat: k.privat, eigen: true });
        return { ok: true, id: 'c-neu-geheim', name: k.name, hinweis: null };
      },
      '/api/einladung/abcdefghijkmnpqr': { ok: true, communityId: 'c-oeff', kanalId: null },
    });
    // Das Bild selbst und den QR-Code (die Attrappe antwortet sonst mit JSON).
    await seite.route('**/storage/v1/object/public/media/avatars/**', (r) => r.fulfill({ body: pixel, contentType: 'image/png' }));
    await seite.route('**/api/einladung-qr.svg**', async (r) => {
      const code = new URL(r.request().url()).searchParams.get('code');
      r.fulfill({ body: await QRCode.toString(E.link(code, BASE), { type: 'svg', margin: 2, width: 220 }), contentType: 'image/svg+xml' });
    });

    await seite.goto(BASE, { waitUntil: 'load' });
    await seite.waitForSelector('[data-area="communities"]', { timeout: 15000 });
    await seite.click('[data-area="communities"]');
    await seite.click('[data-sub="profile"]');
    await seite.waitForSelector('[data-oact="create"]', { timeout: 5000 });

    /* ---------- 16: Community erstellen */
    await seite.click('[data-oact="create"]');
    await seite.click('[data-erstellen="kanal"]');
    await seite.waitForSelector('[data-erstellseite="community"]', { timeout: 5000 });
    const obenAuf = (sel) => seite.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + 30));
    }, sel);
    pruefe('16 Seite „Community erstellen“ liegt sichtbar oben', await obenAuf('[data-erstellseite="community"]'));
    const text = await seite.textContent('[data-erstellseite="community"]');
    const platzhalter = await seite.$$eval('[data-erstellseite] [placeholder]', (els) => els.map((e) => e.placeholder));
    pruefe('16.1/16.2 Felder wie „CP + Kanal erstellen“: Pflichtfeld, Name*, Bild*, Biografie, Link, Unterthemen, Einladung, QR, fertig',
      ['Pflichtfeld', 'Bild einfügen', 'Unterthemen erstellen', 'Einladungslink senden', 'oder per QR-Code:', 'fertig'].every((t) => text.includes(t)) &&
        ['Community benennen', 'Biografie hinzufügen', 'Link hinzufügen'].every((p) => platzhalter.includes(p)), platzhalter.join(' | '));
    pruefe('16.2 ergänzt: Private Community (Beitritt nur mit Anfrage oder Einladung)', /Private Community/.test(text) && /Beitritt nur mit Anfrage oder Einladung/.test(text));
    const qrSrc = await seite.getAttribute('#esQr', 'src');
    const code = (qrSrc.match(/code=([a-z2-9]+)/) || [])[1] || '';
    await seite.waitForFunction(() => document.querySelector('#esQr')?.naturalWidth > 0, null, { timeout: 5000 }).catch(() => {});
    pruefe('16 QR-Code mit Einladungscode gezeichnet', E.istCode(code) && (await seite.$eval('#esQr', (i) => i.naturalWidth > 0)), qrSrc);

    await seite.click('#esFertig');
    pruefe('16.2 ohne Namen: Meldung auf der Seite', /benennen/.test(await seite.textContent('#esMeldung')));
    await seite.fill('#esName', 'Nachtschicht');
    await seite.click('#esFertig');
    pruefe('16.2 ohne Bild: „Bitte ein Bild einfügen“', (await seite.textContent('#esMeldung')).includes('Bitte ein Bild einfügen'));
    await seite.setInputFiles('#esBildDatei', path.join(__dirname, '_testbild.png'));
    await seite.waitForSelector('#esBildVorschau:not([hidden])', { timeout: 5000 }).catch(() => {});
    pruefe('16.2 Bild hochgeladen (vorhandene Medienstelle, Ordner avatars) und als Vorschau sichtbar',
      !!(await seite.$('#esBildVorschau:not([hidden])')) &&
        aufrufe.some((a) => a.pfad === '/api/hochladen' && JSON.parse(a.body || '{}').ordner === 'avatars'));
    await seite.fill('#esBio', 'Alles nach 22 Uhr');
    await seite.fill('#esLink', 'beispiel.de');
    await seite.click('#esUnterthemaNeu');
    await seite.fill('[data-esut="0"]', 'Technik');
    await seite.click('#esUnterthemaNeu');
    await seite.fill('[data-esut="1"]', 'Treffen');
    await seite.click('label.erstellseite__schalter');
    pruefe('16.2 zwei Unterthemen-Felder', (await seite.$$('[data-esut]')).length === 2);

    await seite.click('#esEinladen');
    await seite.waitForTimeout(300);
    const zwischenablage = await seite.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    pruefe('16 „Einladungslink senden“: Link mit demselben Code', zwischenablage === E.link(code, BASE), zwischenablage);
    if (process.env.BILDER) {
      await seite.$eval('.erstellseite__inhalt', (el) => el.scrollTo(0, 0));
      await seite.waitForTimeout(300);
      await seite.screenshot({ path: path.join(process.env.BILDER, 'k28-16-erstellen-oben.png') });
      await seite.$eval('.erstellseite__inhalt', (el) => el.scrollTo(0, el.scrollHeight));
      await seite.waitForTimeout(300);
      await seite.screenshot({ path: path.join(process.env.BILDER, 'k28-16-erstellen-unten.png') });
    }

    await seite.click('#esFertig');
    await seite.waitForSelector('[data-erstellseite]', { state: 'detached', timeout: 5000 }).catch(() => {});
    const post = aufrufe.find((a) => a.pfad === '/api/communities' && a.methode === 'POST');
    const k = post ? JSON.parse(post.body || '{}') : {};
    pruefe('16.3 POST /api/communities mit Name, Bild, Biografie, Link, Unterthemen, privat, Code',
      k.name === 'Nachtschicht' && k.bild === BILD && k.bio === 'Alles nach 22 Uhr' && k.link === 'https://beispiel.de' &&
        JSON.stringify(k.unterthemen) === '["Technik","Treffen"]' && k.sichtbarkeit === 'private' && k.code === code, JSON.stringify(k));
    pruefe('16 Seite geschlossen, Meldung „… erstellt“', !(await seite.$('[data-erstellseite]')) && /„Nachtschicht“ erstellt/.test(await seite.textContent('body')));

    /* ---------- 16.3: Homeseite */
    await seite.waitForSelector('[data-community="c-neu"]', { timeout: 8000 }).catch(() => {});
    pruefe('16.3 neue Community steht im Profil, mit Bild', !!(await seite.$('[data-community="c-neu"] img')));
    // Die Homeseite öffnet man aus der Liste unter Communitys → Home (im Profil führt die Zeile in den Chat).
    await seite.click('[data-sub="home"]');
    await seite.waitForSelector('[data-community="c-neu"]', { timeout: 5000 });
    pruefe('16.3 neue Community auch unter Home, mit Bild', !!(await seite.$('[data-community="c-neu"] img')));
    await seite.click('[data-community="c-neu"]');
    await seite.waitForSelector('#communityKopf', { timeout: 5000 });
    const home = await seite.textContent('#main');
    pruefe('16.3 Homeseite: Bild, Biografie, Link, Unterthemen',
      !!(await seite.$('#communityBild')) && home.includes('Alles nach 22 Uhr') && home.includes('beispiel.de') &&
        ['# Allgemein', '# Technik', '# Treffen'].every((t) => home.includes(t)), home.slice(0, 200));
    if (process.env.BILDER) await seite.waitForTimeout(500), await seite.screenshot({ path: path.join(process.env.BILDER, 'k28-16-homeseite.png') });

    /* ---------- 10.2: Unterthema erstellen */
    await seite.click('#neuesUnterthema');
    await seite.waitForSelector('[data-erstellseite="unterthema"]', { timeout: 5000 });
    pruefe('10.1 Seite „Unterthema erstellen“ liegt sichtbar vor der Homeseite', await obenAuf('[data-erstellseite="unterthema"]'));
    const ut = await seite.textContent('[data-erstellseite="unterthema"]');
    const utPlatz = await seite.$$eval('[data-erstellseite] [placeholder]', (els) => els.map((e) => e.placeholder));
    pruefe('10.2 Felder wie „CC + Unterthema erstellen“: Name*, Biografie, Link, Privates Unterthema, Einladung, QR, fertig',
      ['Pflichtfeld', 'Privates Unterthema', 'Beitritt nur mit Einladung', 'Einladungslink senden', 'oder per QR-Code:', 'fertig'].every((t) => ut.includes(t)) &&
        ['Unterthema benennen', 'Biografie hinzufügen', 'Link hinzufügen'].every((p) => utPlatz.includes(p)), utPlatz.join(' | '));
    pruefe('10.2 kein Bild, keine Unterthemen beim Unterthema', !(await seite.$('#esBild')) && !(await seite.$('#esUnterthemaNeu')));
    const utCode = ((await seite.getAttribute('#esQr', 'src')).match(/code=([a-z2-9]+)/) || [])[1] || '';
    pruefe('10.2 eigener Einladungscode fürs Unterthema', E.istCode(utCode) && utCode !== code);
    await seite.fill('#esName', 'Geheim');
    await seite.fill('#esBio', 'Nur für Eingeladene');
    await seite.click('label.erstellseite__schalter');
    if (process.env.BILDER) await seite.waitForTimeout(400), await seite.screenshot({ path: path.join(process.env.BILDER, 'k28-10-unterthema-erstellen.png') });
    await seite.click('#esFertig');
    await seite.waitForSelector('[data-erstellseite]', { state: 'detached', timeout: 5000 }).catch(() => {});
    const utPost = aufrufe.find((a) => a.pfad === '/api/communities/c-neu/channels' && a.methode === 'POST');
    const u = utPost ? JSON.parse(utPost.body || '{}') : {};
    pruefe('10.2 POST …/channels mit Name, Biografie, privat, Code',
      u.name === 'Geheim' && u.bio === 'Nur für Eingeladene' && u.privat === true && u.code === utCode, JSON.stringify(u));
    await seite.waitForSelector('[data-channel="c-neu-geheim"]', { timeout: 5000 }).catch(() => {});
    pruefe('10.2 neues Unterthema auf der Homeseite, mit Schloss und Biografie',
      !!(await seite.$('[data-channel="c-neu-geheim"] .kanal__schloss')) && /Nur für Eingeladene/.test(await seite.textContent('[data-channel="c-neu-geheim"]')));
    if (process.env.BILDER) await seite.waitForTimeout(400), await seite.screenshot({ path: path.join(process.env.BILDER, 'k28-10-homeseite-privat.png') });

    /* ---------- X schließt */
    await seite.click('#neuesUnterthema');
    await seite.waitForSelector('#esZu', { timeout: 5000 });
    await seite.click('#esZu');
    pruefe('X schließt die Seite ohne Anlegen', !(await seite.$('[data-erstellseite]')) &&
      aufrufe.filter((a) => a.pfad === '/api/communities/c-neu/channels' && a.methode === 'POST').length === 1);

    /* ---------- Einladungslink öffnen */
    await seite.goto(BASE + '/?einladung=abcdefghijkmnpqr', { waitUntil: 'load' });
    await seite.waitForSelector('#communityKopf', { timeout: 10000 }).catch(() => {});
    pruefe('Einladungslink: POST /api/einladung/<code> und Homeseite der Community',
      aufrufe.some((a) => a.pfad === '/api/einladung/abcdefghijkmnpqr' && a.methode === 'POST') &&
        /Fotografie/.test(await seite.textContent('#main')));
    pruefe('Einladungslink: Parameter danach aus der Adresse', !/einladung=/.test(seite.url()), seite.url());

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
