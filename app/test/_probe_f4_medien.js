#!/usr/bin/env node
/**
 * Codex-Fund F4 (31.10.2026): fremde Medien über eine eigene Medienreferenz.
 * VERWORFENE Transaktion, Vorlage _probe_rs_funde.js.
 *
 * Ohne Argument: nur der LIVE-Stand (keine Schemadatei geladen).
 * Mit Schemadatei(en) als Argument: zusätzlich diese Dateien in der
 * Transaktion einspielen (z. B. die Behebung), dann dieselben Angriffe.
 *
 *   A   Eigentümer (öffentlich), B Angreifer, C Dritter, D Chatpartner von A
 *   A1  Story von A, für B lesbar (in_videos), Bunny-Datei
 *   A2  Story von A nur für Messenger-Kontakte (B ist keiner), Bunny-Datei
 *   A3  Chat-Anhang zwischen A und D, Bunny-Datei
 *   A4  Story von A nur für Kontakte, Datei NUR in Supabase (kein Bunny-Beleg)
 *
 *   Angriff 1  B legt Beitrag mit Adresse A2 an      → muss scheitern
 *   Angriff 2  B legt Beitrag mit Adresse A3 an      → muss scheitern
 *   Angriff 3  B legt Beitrag mit Adresse A4 an      → muss scheitern
 *   Angriff 4  B kopiert A1, solange lesbar; Story läuft ab → B darf die
 *              Datei danach nicht mehr lesen, C auch nicht über B
 *   Angriff 5  A löscht die Story und darf dann die Datei löschen
 *   Normal     B legt Beitrag mit EIGENER Datei an; D leitet A3 im selben
 *              Chat weiter (forwarded_from); A teilt eigene Story im Chat
 *
 * Ergebnis per raise → alles zurückgerollt, nichts bleibt.
 * Start: . ~/allmedia-wt/rs-probe-env.sh && node test/_probe_f4_medien.js [SCHEMA…]
 */
const fs = require('fs');
const path = require('path');
const { frage } = require('./_aufraeumen');

const id = (n) => `a1000000-0000-4000-8000-0000000f4${n}`;
const A = id('0a1'), B = id('0a2'), C = id('0a3'), D = id('0a4');
const CHAT = id('0c1'), CHAT_BD = id('0c2');
const ST1 = id('0b1'), ST2 = id('0b2'), ST4 = id('0b4');
const N3 = id('0d3');
const P = {
  a1: `stories/${A}-f4probe1.jpg`,
  a2: `stories/${A}-f4probe2.jpg`,
  a3: `messages/${A}-f4probe3.jpg`,
  a4: `stories/${A}-f4probe4.jpg`,
  b: `posts/${B}-f4probe5.jpg`,
};
const adr = (p) => `public.medien_adresse('${p}')`;

let fehler = 0;
let anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};
const merke = (k, ausdruck) =>
  `perform set_config('probe.erg', current_setting('probe.erg', true) || '${k}=' || replace(coalesce((${ausdruck})::text, 'null'), ' ', '_') || ' ', true);`;
const versuch = (k, anweisung) => `
  begin ${anweisung}; get diagnostics n = row_count; ${merke(k, "'offen:' || n")}
  exception when others then ${merke(k, "'zu'")}
  end;`;
const als = (konto, rumpf) => `
  reset role;
  select set_config('request.jwt.claims', '{"sub":"${konto}","role":"authenticated"}', true),
         set_config('request.jwt.claim.sub', '${konto}', true);
  set local role authenticated;
  do $p$ declare n int; j jsonb; begin
    ${rumpf}
  end $p$;
  reset role;`;
const eigner = (rumpf) => `
  do $p$ declare n int; j jsonb; begin
    ${rumpf}
  end $p$;`;
const konto = (kid, nr) => `
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values ('${kid}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probef4-${nr}@prueflauf.invalid',
          '${JSON.stringify({ name: 'Probe F4 ' + nr, phone: '+49151999914' + nr, handle: '@prueflauf.f4' + nr, zustimmung_am: '2026-10-31T12:00:00Z', zustimmung_nutzungsbedingungen: '1', zustimmung_community_richtlinien: '1', kenntnis_datenschutz: '1' })}', now(), now());
  insert into public.konto_alter (user_id, geburtsdatum, land, mindestalter, status)
  values ('${kid}', '199${nr}-01-01', 'DE', 16, 'frei')
  on conflict (user_id) do update set status = 'frei';`;
const datei = (p, owner, bunny = true) => `
  insert into storage.objects (bucket_id, name, owner_id, owner, metadata)
  values ('media', '${p}', '${owner}', '${owner}', '{"size":"1000","mimetype":"image/jpeg"}');
  ${bunny ? `insert into public.medien_objekte (pfad, owner_id, typ, bytes, sha256)
  values ('${p}', '${owner}', 'image/jpeg', 1000, repeat('a', 64));` : ''}`;

(async () => {
  if (!process.env.SUPABASE_TOKEN) {
    console.log('ÜBERSPRUNGEN  SUPABASE_TOKEN fehlt.');
    process.exit(2);
  }
  const dateien = process.argv.slice(2);
  const lies = (d) => fs.readFileSync(path.join(__dirname, '..', '..', d), 'utf8');
  const sql = `
begin;
select set_config('probe.erg', '', true);
${dateien.map(lies).join('\n')}

${eigner(`
  ${konto(A, 1)} ${konto(B, 2)} ${konto(C, 3)} ${konto(D, 4)}
  ${datei(P.a1, A)} ${datei(P.a2, A)} ${datei(P.a3, A)} ${datei(P.a4, A, false)} ${datei(P.b, B)}
  perform set_config('allmedia.wiederherstellen', 'an', true);
  insert into public.stories (id, user_id, media_url, in_videos, in_messenger) values
    ('${ST1}', '${A}', ${adr(P.a1)}, true, true),
    ('${ST2}', '${A}', ${adr(P.a2)}, false, true),
    ('${ST4}', '${A}', ${adr(P.a4)}, false, true);
  insert into public.chats (id, anfrage_zustand) values ('${CHAT}', 'angenommen'), ('${CHAT_BD}', 'angenommen');
  insert into public.chat_members (chat_id, user_id) values ('${CHAT}', '${A}'), ('${CHAT}', '${D}'), ('${CHAT_BD}', '${B}'), ('${CHAT_BD}', '${D}');
  insert into public.messages (id, chat_id, sender_id, text, media_url) values ('${N3}', '${CHAT}', '${A}', '', ${adr(P.a3)});
  perform set_config('allmedia.wiederherstellen', '', true);
`)}

${als(B, `
  ${merke('b_sieht_a1', `public.bunny_medium_lesbar('${P.a1}')`)}
  ${merke('b_sieht_a2', `public.bunny_medium_lesbar('${P.a2}')`)}
  ${merke('b_sieht_a3', `public.bunny_medium_lesbar('${P.a3}')`)}
  ${merke('b_sieht_a4', `public.bunny_medium_lesbar('${P.a4}')`)}
  ${versuch('ang1', `insert into public.posts (user_id, kind, description, media_url) values ('${B}', 'post', 'f4 a2', ${adr(P.a2)})`)}
  ${versuch('ang2', `insert into public.posts (user_id, kind, description, media_url) values ('${B}', 'post', 'f4 a3', ${adr(P.a3)})`)}
  ${versuch('ang3', `insert into public.posts (user_id, kind, description, media_url) values ('${B}', 'post', 'f4 a4', ${adr(P.a4)})`)}
  ${versuch('ang3_chat', `insert into public.messages (chat_id, sender_id, text, media_url) values ('${CHAT_BD}', '${B}', '', ${adr(P.a4)})`)}
  ${versuch('ang3_thumb', `insert into public.posts (user_id, kind, description, media_url, thumbnail_url) values ('${B}', 'post', 'f4 a4t', ${adr(P.b)}, ${adr(P.a4)})`)}
  ${merke('b_sieht_a2_danach', `public.bunny_medium_lesbar('${P.a2}')`)}
  ${merke('b_sieht_a3_danach', `public.bunny_medium_lesbar('${P.a3}')`)}
  ${merke('b_sieht_a4_danach', `public.bunny_medium_lesbar('${P.a4}')`)}
  ${versuch('ang4_kopie', `insert into public.posts (user_id, kind, description, media_url) values ('${B}', 'post', 'f4 a1', ${adr(P.a1)})`)}
  ${versuch('normal_eigen', `insert into public.posts (user_id, kind, description, media_url) values ('${B}', 'post', 'f4 eigen', ${adr(P.b)})`)}
`)}
${eigner(`
  update public.stories set expires_at = now() - interval '1 minute' where id = '${ST1}';
`)}
${als(B, `
  ${merke('b_sieht_a1_abgelaufen', `public.bunny_medium_lesbar('${P.a1}')`)}
  ${merke('b_sieht_eigen', `public.bunny_medium_lesbar('${P.b}')`)}
`)}
${als(C, `
  ${merke('c_sieht_a1_abgelaufen', `public.bunny_medium_lesbar('${P.a1}')`)}
  ${merke('c_leseliste_a1', `(select count(*) from public.medien_leseliste(array['${P.a1}']))`)}
`)}
${eigner(`
  -- Abgelaufene Storys sieht auch ihr Eigentümer nicht mehr (Regel
  -- „Aktuelle Storys lesen"), löschen kann sie also nur das Aufräumen.
  ${versuch('a_story_weg', `delete from public.stories where id = '${ST1}'`)}
`)}
${als(A, `
  ${merke('a_loeschrecht_a1', `public.medium_loeschrecht('${P.a1}')`)}
  ${versuch('a_teilt_eigene_datei', `insert into public.messages (chat_id, sender_id, text, media_url) values ('${CHAT}', '${A}', '', ${adr(P.a2)})`)}
`)}
${als(D, `
  ${merke('d_sieht_a3', `public.bunny_medium_lesbar('${P.a3}')`)}
  ${versuch('d_kontrolle', `insert into public.messages (chat_id, sender_id, text) values ('${CHAT_BD}', '${D}', 'f4 kontrolle')`)}
  ${versuch('d_falscher_absender', `insert into public.messages (chat_id, sender_id, text, media_url, forwarded_from) values ('${CHAT_BD}', '${D}', '', ${adr(P.a4)}, '${A}')`)}
  ${versuch('d_leitet_weiter', `insert into public.messages (chat_id, sender_id, text, media_url, forwarded_from) values ('${CHAT_BD}', '${D}', '', ${adr(P.a3)}, '${A}')`)}
`)}
${als(B, `
  ${merke('b_sieht_weitergeleitet', `public.bunny_medium_lesbar('${P.a3}')`)}
`)}

do $p$ begin raise exception 'ERG:%', current_setting('probe.erg', true); end $p$;
`;

  const antwort = await frage(sql);
  const text = JSON.stringify(antwort);
  const treffer = text.match(/ERG:([^"\\]*)/);
  if (!treffer) {
    console.log('Keine Ergebnisse — Antwort:', text.slice(0, 1500));
    process.exit(1);
  }
  const e = {};
  for (const paar of treffer[1].trim().split(/\s+/)) {
    const [k, ...r] = paar.split('=');
    e[k] = r.join('=');
  }
  const zu = (k) => e[k] === 'zu' || e[k] === 'offen:0';
  console.log(dateien.length ? `Stand: live + ${dateien.join(', ')}` : 'Stand: LIVE (keine Schemadatei)');

  console.log('\n0. Aufbau');
  pruefe('B sieht A1 (öffentliche Story)', e.b_sieht_a1 === 'true', e.b_sieht_a1);
  pruefe('B sieht A2/A3/A4 nicht', e.b_sieht_a2 === 'false' && e.b_sieht_a3 === 'false' && e.b_sieht_a4 === 'false', `${e.b_sieht_a2}/${e.b_sieht_a3}/${e.b_sieht_a4}`);

  console.log('\nAngriffe');
  pruefe('1 Beitrag mit fremder Kontakt-Story (Bunny) abgewiesen', zu('ang1'), e.ang1);
  pruefe('2 Beitrag mit fremdem Chat-Anhang (Bunny) abgewiesen', zu('ang2'), e.ang2);
  pruefe('3 Beitrag mit fremder Datei nur in Supabase abgewiesen', zu('ang3'), e.ang3);
  pruefe('3 dasselbe als eigene Chatnachricht abgewiesen', zu('ang3_chat'), e.ang3_chat);
  pruefe('3 dasselbe als Vorschaubild abgewiesen', zu('ang3_thumb'), e.ang3_thumb);
  pruefe('B sieht A2/A3/A4 auch danach nicht', e.b_sieht_a2_danach === 'false' && e.b_sieht_a3_danach === 'false' && e.b_sieht_a4_danach === 'false', `${e.b_sieht_a2_danach}/${e.b_sieht_a3_danach}/${e.b_sieht_a4_danach}`);
  pruefe('4 Kopie einer lesbaren fremden Story abgewiesen', zu('ang4_kopie'), e.ang4_kopie);
  pruefe('4 nach Ablauf sieht B die Story-Datei nicht mehr', e.b_sieht_a1_abgelaufen === 'false', e.b_sieht_a1_abgelaufen);
  pruefe('4 C sieht sie nicht über B', e.c_sieht_a1_abgelaufen === 'false' && e.c_leseliste_a1 === '0', `${e.c_sieht_a1_abgelaufen}/${e.c_leseliste_a1}`);
  pruefe('5 A löscht die Story, danach die Datei', e.a_story_weg === 'offen:1' && e.a_loeschrecht_a1 === 'bunny', `${e.a_story_weg}/${e.a_loeschrecht_a1}`);
  pruefe('Weiterleiten-Ausnahme nicht erschleichbar (forwarded_from ohne lesbare Vorlage)', zu('d_falscher_absender'), e.d_falscher_absender);

  console.log('\nNormaler Weg');
  pruefe('B: Beitrag mit eigener Datei', e.normal_eigen === 'offen:1' && e.b_sieht_eigen === 'true', `${e.normal_eigen}/${e.b_sieht_eigen}`);
  pruefe('A: eigene Datei im Chat senden', e.a_teilt_eigene_datei === 'offen:1', e.a_teilt_eigene_datei);
  pruefe('D: Textnachricht an B (Kontrolle des Aufbaus)', e.d_kontrolle === 'offen:1', e.d_kontrolle);
  pruefe('D: lesbaren Anhang weiterleiten (forwarded_from)', e.d_sieht_a3 === 'true' && e.d_leitet_weiter === 'offen:1', `${e.d_sieht_a3}/${e.d_leitet_weiter}`);
  pruefe('B sieht weitergeleiteten Anhang', e.b_sieht_weitergeleitet === 'true', e.b_sieht_weitergeleitet);

  console.log(`\n${anzahl - fehler}/${anzahl} bestanden — alles zurückgerollt.`);
  process.exit(fehler ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
