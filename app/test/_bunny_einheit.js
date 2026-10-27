/**
 * Einheitstest für web/server/bunny.js und tools/medien-umzug-bunny.mjs —
 * ohne Netz, ohne Bunny-Konto, ohne Supabase.
 *
 * Ein lokaler http-Server spielt die Bunny-Storage-API nach (PUT/DELETE/GET
 * unter /<zone>/<pfad>, Kopfzeile AccessKey, Checksum) und eine Pull Zone,
 * die den Token wie Bunny prüft. Supabase wird für den Umzug durch ein
 * eingereichtes `abruf` ersetzt; es geht kein Byte nach draußen.
 *
 * Prüfwerte der Token-Rechnung: offizielles Repo
 * github.com/BunnyWay/BunnyCDN.TokenAuthentication, e2e/inputs.json und
 * e2e/vectors.json (abgerufen 26.10.2026; Schlüssel „SecurityKey",
 * expires 1598024587). Die Fälle mit IP-Bindung fehlen, weil bunny.js
 * bewusst ohne IP unterschreibt.
 *
 * Start:  node test/_bunny_einheit.js
 */

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const Bunny = require('../../web/server/bunny');

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

const ZONE = 'allmedia-test';
const SPEICHER_SCHLUESSEL = 'speicher-geheim-1234';
const TOKEN_SCHLUESSEL = 'token-geheim-5678';

/* ---------------- Testinhalte ---------------- */

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100, 2)]);
const mp4 = (laenge) => {
  const b = Buffer.alloc(laenge, 3);
  b.write('\0\0\0\x18ftypisom', 0, 'latin1');
  return b;
};
const MP4 = mp4(300);
const HTML = Buffer.from('<html><script>alert(1)</script></html>');

/* ---------------- Nachbau Bunny Storage + Pull Zone ---------------- */

const speicher = new Map(); // pfad → { inhalt, typ }
const steuerung = { verzoegerung: 0 };
const anfragen = []; // { methode, pfad, schluesselOk }

/** Prüft einen Token so, wie die Pull Zone es tut — unabhängig von tokenRechnen. */
function tokenGueltig(adresse, jetztS) {
  const u = new URL(adresse, 'http://x');
  const token = u.searchParams.get('token');
  const ablauf = Number(u.searchParams.get('expires'));
  if (!token || !Number.isFinite(ablauf) || ablauf < jetztS) return false;
  const rest = [...u.searchParams.entries()]
    .filter(([k]) => k !== 'token' && k !== 'expires')
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const soll = 'HS256-' + crypto.createHmac('sha256', TOKEN_SCHLUESSEL)
    .update(decodeURIComponent(u.pathname) + ablauf + rest).digest('base64url');
  return soll.length === token.length && crypto.timingSafeEqual(Buffer.from(soll), Buffer.from(token));
}

let pullJetztS = Math.floor(Date.now() / 1000);

const bearbeite = (istPull) => (req, res) => {
  const teile = [];
  req.on('data', (t) => teile.push(t));
  req.on('end', async () => {
    const inhalt = Buffer.concat(teile);
    const u = new URL(req.url, 'http://x');

    // Pull Zone (eigener Port): /<pfad>?token=…&expires=…
    if (istPull) {
      const pfad = u.pathname.slice(1);
      if (!tokenGueltig(req.url, pullJetztS)) {
        res.writeHead(403).end();
        return;
      }
      const datei = speicher.get(pfad);
      if (!datei) return res.writeHead(404).end();
      res.writeHead(200, { 'Content-Type': datei.typ }).end(datei.inhalt);
      return;
    }

    // Storage: /<zone>/<pfad>
    const [, zone, ...rest] = u.pathname.split('/');
    const pfad = rest.join('/');
    const schluesselOk = req.headers.accesskey === SPEICHER_SCHLUESSEL;
    anfragen.push({ methode: req.method, pfad, schluesselOk });
    if (zone !== ZONE || !schluesselOk) return res.writeHead(401).end('{"HttpCode":401,"Message":"Unauthorized"}');

    if (req.method === 'PUT') {
      const summe = crypto.createHash('sha256').update(inhalt).digest('hex').toUpperCase();
      if (req.headers.checksum && req.headers.checksum !== summe) return res.writeHead(400).end();
      speicher.set(pfad, { inhalt, typ: req.headers['content-type'] });
      if(steuerung.verzoegerung)await new Promise(r=>setTimeout(r,steuerung.verzoegerung));
      if(res.destroyed)return;
      return res.writeHead(201).end('{"HttpCode":201,"Message":"File uploaded."}');
    }
    if (req.method === 'DELETE') {
      if (pfad.endsWith('/') || pfad === '') {
        // Bunny löscht hier das ganze Verzeichnis — darf nie ankommen.
        for (const k of [...speicher.keys()]) if (k.startsWith(pfad)) speicher.delete(k);
        return res.writeHead(200).end();
      }
      if (!speicher.delete(pfad)) return res.writeHead(404).end();
      return res.writeHead(200).end();
    }
    if (req.method === 'GET' && pfad.endsWith('/')) {
      const liste = [...speicher.entries()]
        .filter(([k]) => k.startsWith(pfad) && !k.slice(pfad.length).includes('/'))
        .map(([k, d]) => ({ ObjectName: k.slice(pfad.length), Length: d.inhalt.length, IsDirectory: false }));
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(liste));
    }
    res.writeHead(404).end();
  });
};
const server = http.createServer(bearbeite(false));
const pullServer = http.createServer(bearbeite(true));

/* ---------------- Protokoll mitschneiden ---------------- */

const protokoll = [];
const echtesError = console.error;
if(require.main===module)console.error = (...teile) => protokoll.push(teile.join(' '));

async function nachbauStarten() {
  await new Promise(fertig=>server.listen(0,'127.0.0.1',fertig));
  await new Promise(fertig=>pullServer.listen(0,'127.0.0.1',fertig));
  return {umgebung:{BUNNY_STORAGE_ZONE:ZONE,BUNNY_STORAGE_KEY:SPEICHER_SCHLUESSEL,
    BUNNY_STORAGE_HOST:`http://127.0.0.1:${server.address().port}`,
    BUNNY_PULL_HOST:`http://127.0.0.1:${pullServer.address().port}`,BUNNY_TOKEN_KEY:TOKEN_SCHLUESSEL},
    speicher,anfragen,steuerung,stop:async()=>{server.closeAllConnections();pullServer.closeAllConnections();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>pullServer.close(r))]);}};
}
module.exports={nachbauStarten};
async function main() {
  const {umgebung}=await nachbauStarten();
  const basis=umgebung.BUNNY_STORAGE_HOST,pull=umgebung.BUNNY_PULL_HOST;
  console.log('\n1. Token-Rechnung gegen die offiziellen Prüfwerte');
  const VEKTOREN = [
    ['plain', '/300kb.jpg', {}, '', 'HS256-o10JRWlsAItyAsdKS6jJKjabHN4FrFsplDHPV1idcX4'],
    ['countries_only', '/300kb.jpg', { token_countries: 'CA,US' }, '', 'HS256-i5s3Uv7mnrFfN5nznwU2BxhILpnipYeE18TapV0WNFM'],
    ['blocked_only', '/300kb.jpg', { token_countries_blocked: 'RU,CN' }, '', 'HS256-JS8dSuBSjSH-W2-xhdkCPC36-2rlxfDCQJjlNMPqKZQ'],
    ['path_only', '/abc/300kb.jpg', {}, '/abc', 'HS256-uVZvT3SbEoVKYJyDJgbcsDmSFf73cv-uNUVaJiKWpbQ'],
    ['ignore_params', '/300kb.jpg', { token_ignore_params: 'true' }, '', 'HS256-1lwWBD_c1IAGSj1UKPoxreu8ePDQ-Z9FoWLcRn_RRH0'],
    ['limit_only', '/300kb.jpg', { limit: '1000' }, '', 'HS256-DAVapqNNED3Z7JkjRTYX0UOIHNtbHEuuhRNEc4A7mMQ'],
  ];
  for (const [name, pfad, parameter, tokenPfad, soll] of VEKTOREN) {
    const { token } = Bunny.tokenRechnen({ schluessel: 'SecurityKey', pfad, ablauf: 1598024587, parameter, tokenPfad });
    pruefe(`Prüfwert ${name}`, token === soll, token);
  }
  pruefe('Ganze Adresse wie im Prüfwert countries_only',
    Bunny.adresseBauen({ basis: 'https://token-tester.b-cdn.net', schluessel: 'SecurityKey', pfad: '/300kb.jpg', ablauf: 1598024587, parameter: { token_countries: 'CA,US' } })
      === 'https://token-tester.b-cdn.net/300kb.jpg?token=HS256-i5s3Uv7mnrFfN5nznwU2BxhILpnipYeE18TapV0WNFM&token_countries=CA%2CUS&expires=1598024587');
  pruefe('Verzeichnis-Token steht im Pfad',
    /^https:\/\/x\.b-cdn\.net\/bcdn_token=HS256-[\w-]+&expires=1598024587\/abc\/$/.test(
      Bunny.adresseBauen({ basis: 'https://x.b-cdn.net', schluessel: 'k', pfad: '/abc/', ablauf: 1598024587, verzeichnis: true })));

  console.log('\n2. Konfiguration');
  const leer = Bunny.konfigurationAus({});
  pruefe('Ohne Variablen: nicht bereit, nennt die Namen', !leer.ok && leer.fehlt.includes('BUNNY_STORAGE_KEY') && leer.fehlt.includes('BUNNY_PULL_HOST'), leer.fehlt.join(','));
  const fremd = Bunny.konfigurationAus({ ...umgebung, BUNNY_STORAGE_HOST: 'storage.boese.example' });
  pruefe('Fremder Speicher-Host wird abgelehnt', !fremd.ok && fremd.fehlt.includes('BUNNY_STORAGE_HOST'));
  const klartext = Bunny.konfigurationAus({ ...umgebung, BUNNY_STORAGE_HOST: 'http://storage.bunnycdn.com' });
  pruefe('http nur lokal', !klartext.ok && klartext.fehlt.includes('BUNNY_STORAGE_HOST'));
  pruefe('Echter Regions-Host geht', Bunny.konfigurationAus({ ...umgebung, BUNNY_STORAGE_HOST: 'uk.storage.bunnycdn.com' }).ok);
  const teilweise = Bunny.konfigurationAus({ ...umgebung, BUNNY_STORAGE_ZONE: '' });
  pruefe('Teilweise falsch: nennt nur Namen, keinen Schlüssel', !teilweise.ok && !JSON.stringify(teilweise).includes(SPEICHER_SCHLUESSEL) && !JSON.stringify(teilweise).includes(TOKEN_SCHLUESSEL));
  const nichtBereit = Bunny.erstelleBunny(leer);
  const nb = await nichtBereit.hochladen('posts/a.jpg', JPEG, 'image/jpeg');
  pruefe('Nicht eingerichtet: hochladen sagt es, ohne Anfrage', !nb.ok && nb.error === 'Der Medienspeicher ist nicht eingerichtet' && anfragen.length === 0);
  pruefe('Nicht eingerichtet: keine Adresse', nichtBereit.signierteAdresse('posts/a.jpg') === null);

  const konfig = Bunny.konfigurationAus(umgebung);
  pruefe('Lokale Konfiguration bereit', konfig.ok, konfig.ok ? '' : konfig.fehlt.join(','));
  let jetztMs = Date.parse('2026-10-26T12:20:00Z');
  const bunny = Bunny.erstelleBunny(konfig, { jetzt: () => jetztMs });

  console.log('\n3. Hochladen');
  const bild = await bunny.hochladen('posts/test-bild.jpg', JPEG, 'image/jpeg');
  pruefe('JPEG hochgeladen', bild.ok && speicher.has('posts/test-bild.jpg'), bild.error || '');
  pruefe('url ist die beständige Supabase-Form',
    bild.url === 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/posts/test-bild.jpg', bild.url);
  pruefe('pfad zurück', bild.pfad === 'posts/test-bild.jpg');
  pruefe('anzeige ist unterschriebene Pull-Adresse', /^http:\/\/127\.0\.0\.1:\d+\/posts\/test-bild\.jpg\?token=HS256-[\w-]+&expires=\d+$/.test(bild.anzeige || ''), bild.anzeige);
  pruefe('Inhalt kam unverändert an', speicher.get('posts/test-bild.jpg').inhalt.equals(JPEG));
  const video = await bunny.hochladen('stories/clip.mp4', MP4, 'video/mp4; codecs="avc1"');
  pruefe('MP4 (Typ mit Zusatz) hochgeladen', video.ok && speicher.get('stories/clip.mp4').typ === 'video/mp4', video.error || '');
  const ptt = await bunny.hochladen('ptt/ton.m4a', MP4, 'audio/mp4');
  pruefe('Push-to-Talk M4A geht in ptt', ptt.ok);
  const abgelegt = await bunny.ablegen('nutzer-1', 'avatars', 'image/png', PNG);
  pruefe('ablegen baut Pfad mit 32 Zufallszeichen', abgelegt.ok && /^avatars\/nutzer-1-\d+-[0-9a-f]{32}\.png$/.test(abgelegt.pfad), abgelegt.pfad);
  const zweites = await bunny.ablegen('nutzer-1', 'avatars', 'image/png', PNG);
  pruefe('ablegen zweimal → zwei Pfade (kein Überschreiben)', zweites.pfad !== abgelegt.pfad);

  console.log('\n4. Falscher Schlüssel');
  const falsch = Bunny.erstelleBunny(Bunny.konfigurationAus({ ...umgebung, BUNNY_STORAGE_KEY: 'falsch-9999' }));
  const vorher = speicher.size;
  protokoll.length = 0;
  const f1 = await falsch.hochladen('posts/x.jpg', JPEG, 'image/jpeg');
  pruefe('Hochladen abgelehnt', !f1.ok && f1.error === 'Die Aufnahme ließ sich nicht speichern' && speicher.size === vorher);
  const f2 = await falsch.loeschen('posts/test-bild.jpg');
  pruefe('Löschen abgelehnt, Datei bleibt', !f2.ok && speicher.has('posts/test-bild.jpg'));
  const f3 = await falsch.auflisten('posts');
  pruefe('Auflisten abgelehnt', !f3.ok);
  const alles = JSON.stringify([f1, f2, f3]) + protokoll.join('\n');
  pruefe('Kein Schlüssel und keine Speicheradresse in Rückgabe/Protokoll',
    !alles.includes('falsch-9999') && !alles.includes(SPEICHER_SCHLUESSEL) && !alles.includes(basis), protokoll.join(' | '));

  console.log('\n5. Zu große Dateien');
  const anzahl = anfragen.length;
  const grossBild = Buffer.concat([JPEG, Buffer.alloc(10 * 1024 * 1024)]);
  const g1 = await bunny.hochladen('posts/gross.jpg', grossBild, 'image/jpeg');
  pruefe('Bild über 10 MB abgelehnt', !g1.ok && /zu groß/.test(g1.error), g1.error);
  const g2 = await bunny.hochladen('posts/gross.mp4', mp4(50 * 1024 * 1024 + 1), 'video/mp4');
  pruefe('Video über 50 MB abgelehnt', !g2.ok && /zu groß \(51 MB, höchstens 50 MB\)/.test(g2.error), g2.error);
  const g3 = await bunny.hochladen('posts/genau.mp4', mp4(50 * 1024 * 1024), 'video/mp4');
  pruefe('Video mit genau 50 MB geht', g3.ok);
  speicher.delete('posts/genau.mp4');
  const g4 = await bunny.hochladen('posts/leer.jpg', Buffer.alloc(0), 'image/jpeg');
  pruefe('Leere Datei abgelehnt', !g4.ok && g4.error === 'Die Aufnahme ist leer');
  pruefe('Abgelehnte gingen nie zum Speicher', anfragen.length === anzahl + 1, `${anfragen.length - anzahl} Anfragen`);

  console.log('\n6. Falsche Typen');
  const t1 = await bunny.hochladen('posts/v.webm', mp4(100), 'video/webm');
  pruefe('WebM abgelehnt', !t1.ok && /JPEG, PNG, WebP und MP4/.test(t1.error));
  const t2 = await bunny.hochladen('posts/v.mov', mp4(100), 'video/quicktime');
  pruefe('MOV abgelehnt', !t2.ok);
  const t3 = await bunny.hochladen('posts/x.jpg', HTML, 'image/jpeg');
  pruefe('HTML als image/jpeg abgelehnt (Inhalt passt nicht)', !t3.ok && t3.error === 'Die Datei passt nicht zu ihrem Format');
  const t4 = await bunny.hochladen('avatars/a.mp4', MP4, 'video/mp4');
  pruefe('Video als Profilbild abgelehnt', !t4.ok && /Bildformat/.test(t4.error));
  const t5 = await bunny.hochladen('posts/a.m4a', MP4, 'audio/mp4');
  pruefe('M4A außerhalb ptt abgelehnt', !t5.ok);
  const t6 = await bunny.hochladen('posts/a.svg', Buffer.from('<svg/>'), 'image/svg+xml');
  pruefe('SVG abgelehnt', !t6.ok);
  const t7 = await bunny.hochladen('posts/a.jpg', 'kein buffer', 'image/jpeg');
  pruefe('Kein Buffer abgelehnt', !t7.ok);

  console.log('\n7. Pfadmanipulation');
  const vorPfad = anfragen.length;
  const boese = ['../geheim.jpg', 'posts/../avatars/x.jpg', 'posts/..', 'posts/', 'posts', '/posts/a.jpg', 'posts/a/b.jpg',
    'posts/.htaccess', 'posts/%2e%2e', 'posts\\..\\a.jpg', 'fremd/a.jpg', 'beispiel/a.jpg', '', null, 'POSTS/a.jpg', 'posts/a.jpg?x=1', 'posts/a b.jpg'];
  let alleAbgelehnt = true;
  for (const p of boese) {
    const r = await bunny.hochladen(p, JPEG, 'image/jpeg');
    if (r.ok) alleAbgelehnt = false;
  }
  pruefe(`Hochladen: ${boese.length} böse Pfade abgelehnt`, alleAbgelehnt);
  let loeschenAbgelehnt = true;
  for (const p of boese.filter((p) => p !== 'beispiel/a.jpg')) {
    const r = await bunny.loeschen(p);
    if (r.ok || r.error !== 'Unbekannte Ablage') loeschenAbgelehnt = false;
  }
  pruefe('Löschen: alle bösen Pfade abgelehnt (vor allem „posts/" = ganzes Verzeichnis)', loeschenAbgelehnt);
  pruefe('Keine davon kam beim Speicher an', anfragen.length === vorPfad, `${anfragen.length - vorPfad} Anfragen`);
  pruefe('Verzeichnis posts/ ist noch da', speicher.has('posts/test-bild.jpg'));
  pruefe('signierteAdresse lehnt ../ ab', bunny.signierteAdresse('posts/../avatars/x.jpg') === null && bunny.signierteAdresse('../x') === null);
  pruefe('pfadAus lehnt kodiertes ../ ab',
    Bunny.pfadAus('https://x.supabase.co/storage/v1/object/public/media/posts/%2E%2E%2Favatars%2Fa.jpg') === null);
  pruefe('pfadAus nimmt gültige Adresse', Bunny.pfadAus('https://x.supabase.co/storage/v1/object/public/media/posts/a.jpg?t=1') === 'posts/a.jpg');
  pruefe('auflisten lehnt fremden Ordner ab', !(await bunny.auflisten('../')).ok);
  pruefe('Umzug darf beispiel/ ablegen (pruefen:false)', (await bunny.hochladen('beispiel/a.jpg', JPEG, 'image/jpeg', { pruefen: false })).ok);

  console.log('\n8. Löschen und Auflisten');
  const liste = await bunny.auflisten('posts');
  pruefe('Auflisten nennt Name und Größe', liste.ok && liste.dateien.some((d) => d.name === 'test-bild.jpg' && d.bytes === JPEG.length));
  const l1 = await bunny.loeschen('posts/test-bild.jpg');
  pruefe('Löschen', l1.ok && !speicher.has('posts/test-bild.jpg'));
  const l2 = await bunny.loeschen('posts/test-bild.jpg');
  pruefe('Zweites Löschen: gibt es nicht', !l2.ok && l2.error === 'Die Datei gibt es nicht');

  console.log('\n9. Ablauf und Fenster');
  pruefe('ablaufFuer rundet auf Viertelstunde', Bunny.ablaufFuer(3600, Date.parse('2026-10-26T12:20:00Z')) === Date.parse('2026-10-26T13:30:00Z') / 1000);
  pruefe('ablaufFuer: genau auf der Stunde bleibt', Bunny.ablaufFuer(3600, Date.parse('2026-10-26T12:00:00Z')) === Date.parse('2026-10-26T13:00:00Z') / 1000);
  const a1 = bunny.signierteAdresse('stories/clip.mp4', 3600);
  jetztMs += 5 * 60 * 1000; // 12:25, gleiches Fenster
  const a2 = bunny.signierteAdresse('stories/clip.mp4', 3600);
  pruefe('Im selben Fenster dieselbe Adresse (Browser-Cache!)', a1 === a2);
  jetztMs += 30 * 60 * 1000; // 13:15
  pruefe('Im nächsten Fenster neue Adresse', bunny.signierteAdresse('stories/clip.mp4', 3600) !== a1);
  const ablauf = Number(new URL(a1).searchParams.get('expires'));
  const ausgestellt = Date.parse('2026-10-26T12:20:00Z') / 1000;
  pruefe('Gültig 45 bis höchstens 60 Minuten inklusive Rundung', ablauf - ausgestellt >= 2700 && ablauf - ausgestellt <= 3600, `${ablauf - ausgestellt} s`);
  const holen = async (adresse) => (await fetch(adresse)).status;
  pullJetztS = ausgestellt;
  pruefe('Pull Zone liefert mit gültigem Token', (await holen(a1)) === 200);
  pullJetztS = ablauf + 1;
  pruefe('Pull Zone lehnt abgelaufenen Token ab', (await holen(a1)) === 403);
  pullJetztS = ausgestellt;
  pruefe('Pull Zone lehnt fremden Pfad mit diesem Token ab', (await holen(a1.replace('stories/clip.mp4', 'ptt/ton.m4a'))) === 403);
  pruefe('Pull Zone lehnt verlängertes expires ab', (await holen(a1.replace(/expires=\d+/, `expires=${ablauf + 86400}`))) === 403);
  pruefe('Pull Zone lehnt fehlenden Token ab', (await holen(`${pull}/stories/clip.mp4`)) === 403);
  pruefe('Auch bei riesiger Wunschdauer höchstens eine Stunde', Number(new URL(bunny.signierteAdresse('stories/clip.mp4', 999999999)).searchParams.get('expires')) * 1000 - jetztMs <= 3600 * 1000);
  pruefe('Unsinnige Dauer → Standard 45 Minuten', bunny.signierteAdresse('stories/clip.mp4', -5) === bunny.signierteAdresse('stories/clip.mp4', 45 * 60));

  console.log('\n10. Zentraler Signierweg (Leserechte vor jeder Unterschrift)');
  pruefe('Adapter exportiert keinen zweiten Listen-Signierweg', !bunny.signiereMedien && !Bunny.signiereMedien);
  const dauer = (p) => `https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/${p}`;
  const daten = { posts: [{ media_url: dauer('stories/clip.mp4'), text: 'hallo' }, { media_url: dauer('ptt/ton.m4a') }], fremd: 'https://anderswo.de/x.jpg' };
  const Medien=require('../../web/server/medien');
  const altSignatur=Bunny.signierteAdresse,altZone=process.env.BUNNY_STORAGE_ZONE;
  Bunny.signierteAdresse=(...args)=>bunny.signierteAdresse(...args);process.env.BUNNY_STORAGE_ZONE=ZONE;
  try {
    let gefragt=[];
    const client={nutzerId:'nutzer-1',rpc:async(name,{p_pfade})=>{gefragt.push(...p_pfade);return {data:name==='medien_leseliste'?[{pfad:'stories/clip.mp4',anbieter:'bunny'}]:[]};}};
    const s1=await Medien.signiereMedien(client,daten,3600);
    pruefe('Erlaubter Pfad wird unterschrieben',s1.posts[0].media_url.startsWith(`${pull}/stories/clip.mp4?token=`));
    pruefe('Verbotener Pfad bleibt unverändert',s1.posts[1].media_url===dauer('ptt/ton.m4a'));
    pruefe('Fremde Adresse und Text unverändert',s1.fremd===daten.fremd&&s1.posts[0].text==='hallo');
    pruefe('Eingabe nicht verändert',daten.posts[0].media_url===dauer('stories/clip.mp4'));
    gefragt=[];await Medien.signiereMedien(client,daten,3600);
    pruefe('Jeder Abruf prüft beide Pfade erneut',gefragt.length===2);
    const s4=await Medien.signiereMedien({nutzerId:'nutzer-3',rpc:async()=>({error:Error('weg')})},daten,3600);
    pruefe('Prüfung fällt aus → nichts unterschrieben',JSON.stringify(s4)===JSON.stringify(daten));
    const s5=await Medien.signiereMedien({nutzerId:'nutzer-4',rpc:async name=>({data:name==='medien_leseliste'?[{pfad:'ptt/ton.m4a',anbieter:'bunny'}]:[]})},daten,3600);
    pruefe('Zentraler Batchweg berücksichtigt freigegebenen Pfad',s5.posts[1].media_url.startsWith(`${pull}/ptt/ton.m4a?token=`)&&s5.posts[0].media_url===dauer('stories/clip.mp4'));
  } finally {Bunny.signierteAdresse=altSignatur;if(altZone===undefined)delete process.env.BUNNY_STORAGE_ZONE;else process.env.BUNNY_STORAGE_ZONE=altZone;}

  console.log('\n11. Umzugsskript');
  const { umziehen } = await import('../../tools/medien-umzug-bunny.mjs');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bunny-umzug-'));
  const quelle = path.join(tmp, 'quelle');
  fs.mkdirSync(path.join(quelle, 'posts'), { recursive: true });
  fs.mkdirSync(path.join(quelle, 'stories'), { recursive: true });
  fs.writeFileSync(path.join(quelle, 'posts', 'u1.jpg'), JPEG);
  fs.writeFileSync(path.join(quelle, 'posts', 'u2.png'), PNG);
  fs.writeFileSync(path.join(quelle, 'stories', 'u3.webm'), mp4(120));
  fs.writeFileSync(path.join(quelle, 'posts', '..boese'), JPEG);
  const zustand = path.join(tmp, 'zustand.jsonl');
  const still = () => {};
  const ordnerQuelle = { art: 'ordner', wurzel: quelle };

  const vorTrocken = anfragen.length;
  const z0 = await umziehen({ quelle: ordnerQuelle, bunny, ordner: ['posts', 'stories'], melde: still });
  pruefe('Trockenlauf ist Vorgabe: zählt 3, lädt nichts', z0.status === 'trockenlauf' && z0.gelistet === 3 && z0.hochgeladen === 0 && anfragen.length === vorTrocken, JSON.stringify(z0));
  pruefe('Trockenlauf zählt WebM als nicht MP4', z0.nichtMp4 === 1);
  pruefe('Trockenlauf schreibt keine Zustandsdatei', !fs.existsSync(zustand));

  let geworfen = '';
  try { await umziehen({ quelle: ordnerQuelle, bunny, ausfuehren: true, melde: still }); } catch (f) { geworfen = f.message; }
  pruefe('Echt ohne --zustand verweigert', geworfen === '--zustand fehlt');

  const z1 = await umziehen({ quelle: ordnerQuelle, bunny, ordner: ['posts', 'stories'], ausfuehren: true, zustand, pruefen: true, melde: still });
  pruefe('Echter Lauf aus Ordner: 3/3 abgelegt, 0 Abweichungen', z1.hochgeladen === 3 && z1.fehler === 0 && z1.pruefAbweichungen === 0 && z1.status === 'fertig', JSON.stringify(z1));
  pruefe('Pfade gleich wie in der Quelle', speicher.get('posts/u1.jpg')?.inhalt.equals(JPEG) && speicher.has('stories/u3.webm'));
  const zeilen = fs.readFileSync(zustand, 'utf8').trim().split('\n').map((z) => JSON.parse(z));
  pruefe('Zustandsdatei: 3 Zeilen mit SHA256', zeilen.length === 3 && zeilen.every((z) => /^[0-9a-f]{64}$/.test(z.sha256)));

  fs.appendFileSync(zustand, '{"pfad":"posts/hal'); // Abbruch mitten im Schreiben
  fs.writeFileSync(path.join(quelle, 'posts', 'u4.jpg'), JPEG);
  const vorFortsetzen = anfragen.filter((a) => a.methode === 'PUT').length;
  const z2 = await umziehen({ quelle: ordnerQuelle, bunny, ordner: ['posts', 'stories'], ausfuehren: true, zustand, melde: still });
  pruefe('Fortsetzen: 3 schon fertig, nur die neue geladen', z2.schonFertig === 3 && z2.hochgeladen === 1 && anfragen.filter((a) => a.methode === 'PUT').length === vorFortsetzen + 1, JSON.stringify(z2));

  // Supabase-Quelle über eingereichtes abruf — kein Netz.
  const sbDateien = {
    'posts/s1.jpg': JPEG,
    'posts/s2.mp4': mp4(4000),
    'posts/s3.jpg': JPEG,
  };
  const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');
  let geholtVonSupabase = 0;
  const sbAbruf = (kaputt = {}) => async (adresse, opt) => {
    const u = new URL(adresse);
    if (u.pathname === '/storage/v1/object/list/media') {
      const { prefix } = JSON.parse(opt.body);
      const seite = Object.entries(sbDateien).filter(([p]) => p.startsWith(prefix + '/')).map(([p, b]) => ({
        id: p, name: p.split('/')[1], metadata: { size: b.length, mimetype: p.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg', eTag: `"${kaputt[p] ? '0'.repeat(32) : md5(b)}"` },
      }));
      return new Response(JSON.stringify(seite), { status: 200 });
    }
    const pfad = decodeURIComponent(u.pathname.replace('/storage/v1/object/media/', ''));
    geholtVonSupabase += sbDateien[pfad].length;
    return new Response(sbDateien[pfad], { status: 200 });
  };
  const sbQuelle = { art: 'supabase', basis: 'https://sb.invalid', schluessel: 'dienst-geheim' };
  const zustand2 = path.join(tmp, 'zustand2.jsonl');

  geworfen = '';
  try { await umziehen({ quelle: sbQuelle, bunny, ordner: ['posts'], ausfuehren: true, zustand: zustand2, abruf: sbAbruf(), melde: still }); } catch (f) { geworfen = f.message; }
  pruefe('Supabase echt ohne Budget verweigert', /budget-mb fehlt/.test(geworfen) && geholtVonSupabase === 0);

  const zt = await umziehen({ quelle: sbQuelle, bunny, ordner: ['posts'], abruf: sbAbruf(), melde: still });
  pruefe('Supabase-Trockenlauf holt keine Datei', zt.status === 'trockenlauf' && zt.gelistet === 3 && geholtVonSupabase === 0 && zt.listeBytes > 0);

  const budget = zt.listeBytes + JPEG.length + 100; // reicht für s1, nicht für s2 (4000 B)
  const zb = await umziehen({ quelle: sbQuelle, bunny, ordner: ['posts'], ausfuehren: true, budgetBytes: budget, zustand: zustand2, abruf: sbAbruf(), melde: still });
  pruefe('Budget: hält vor der Datei an, die es sprengen würde', zb.status === 'budget' && zb.hochgeladen === 1 && geholtVonSupabase === JPEG.length, JSON.stringify(zb));
  pruefe('Budget nie überschritten', zb.listeBytes + zb.geholtBytes <= budget);

  geholtVonSupabase = 0;
  const zk = await umziehen({ quelle: sbQuelle, bunny, ordner: ['posts'], ausfuehren: true, budgetBytes: 1e9, zustand: zustand2, abruf: sbAbruf({ 'posts/s3.jpg': true }), melde: still });
  pruefe('Fortsetzen nach Budget: s1 übersprungen', zk.schonFertig === 1 && geholtVonSupabase === 4000 + JPEG.length, JSON.stringify(zk));
  pruefe('MD5 passt nicht → Fehler, nicht als fertig vermerkt', zk.fehler === 1 && zk.status === 'fehler' && !fs.readFileSync(zustand2, 'utf8').includes('posts/s3.jpg'));
  pruefe('Schlüssel nicht im Zähler', !JSON.stringify([zb, zk]).includes('dienst-geheim'));

  fs.rmSync(tmp, { recursive: true, force: true });

  console.log('\n12. Anschluss: Instants und kurze Signaturen');
  const instantPfad='instants/ab260026-0000-4000-8000-000000000001/kamera.jpg';
  const instant=await bunny.hochladen(instantPfad,JPEG,'image/jpeg');
  pruefe('Instant-Pfad mit Nutzerordner hochladbar',instant.ok);
  pruefe('Instant-Pfad sicher lesbar',Bunny.pfadAus(instant.url)===instantPfad);
  pruefe('Instant ohne Nutzerordner unzulässig',Bunny.pfadPruefen('instants/kamera.jpg')===null);
  pruefe('Instant-Foto höchstens 250 KB',!Bunny.inhaltPruefen('instants','image/jpeg',JPEG)&&!!Bunny.inhaltPruefen('instants','image/jpeg',Buffer.alloc(256001)));
  pruefe('Instant-Video abgelehnt',!(await bunny.hochladen(instantPfad,MP4,'video/mp4')).ok);
  const mov=Buffer.from(MP4);mov.write('qt  ',8,'latin1');pruefe('QuickTime als MP4 umbenannt abgelehnt',!!Bunny.inhaltPruefen('posts','video/mp4',mov));
  const kurz=bunny.signierteAdresse(instantPfad,60);
  pruefe('Instant-Signatur exakt 60 Sekunden, keine Stundenrundung',Number(new URL(kurz).searchParams.get('expires'))===Math.floor(jetztMs/1000)+60);
  pruefe('Instant-Verzeichnis niemals löschbar',!(await bunny.loeschen('instants/ab260026-0000-4000-8000-000000000001/')).ok);
  pruefe('Instant-Datei einzeln löschbar',(await bunny.loeschen(instantPfad)).ok);

  console.log('\n12. Protokoll');
  const ganzesProtokoll = protokoll.join('\n');
  pruefe('Kein Schlüssel, kein Token im Protokoll',
    !ganzesProtokoll.includes(SPEICHER_SCHLUESSEL) && !ganzesProtokoll.includes(TOKEN_SCHLUESSEL) && !ganzesProtokoll.includes('HS256-'), `${protokoll.length} Zeilen`);
}

if(require.main===module)main()
  .catch((f) => {
    fehler++;
    console.log('  FEHL Abbruch: ' + (f && f.stack));
  })
  .finally(() => {
    console.error = echtesError;
    server.close();
    pullServer.close();
    console.log(`\n${geprueft - fehler} von ${geprueft} Pruefungen bestanden`);
    process.exit(fehler ? 1 : 0);
  });
