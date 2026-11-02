#!/usr/bin/env node
/**
 * Schema 103 (Auftrag Recht/Sicherheit 21.10., Kasten RS 2: Konto löschen
 * und vollständige Auskunft) in einer VERWORFENEN Transaktion proben.
 * Vorlage _probe102.js.
 *
 *   begin;
 *   Schema 102 (liefert rechtsmitteilung) und Schema 103 komplett
 *   Wegwerf-Konten nur in dieser Transaktion (auth.users):
 *     L  Elternteil mit Beitrag, Nachricht an das Testkonto, laufender Sperre
 *     K  Kind von L
 *     D  Konto mit einer Datei im Speicher
 *   L holt seine Auskunft: alle Bereiche da, keine Geheimnisse.
 *   L löscht sich: falsches Wort → nichts; richtiges Wort → Konto, Profil,
 *   Beitrag, Nachricht weg; Nummer als Hash gesperrt; K behält sein Konto,
 *   Elternkontrolle endet, K bekommt Bescheid.
 *   Neu anmelden mit derselben Nummer → abgewiesen; andere Nummer → geht.
 *   D kann nicht löschen, solange die Datei liegt. Prüfkonto nie.
 *   Ergebnis per raise → alles zurückgerollt, nichts bleibt.
 *
 * Nur die eigenen Konten. Läuft auch bei gesperrtem PostgREST (402).
 * Start: SUPABASE_TOKEN=… SUPABASE_URL=https://….supabase.co node test/_probe103.js
 */
const fs = require('fs');
const path = require('path');
const { frage } = require('./_aufraeumen');

const PRUEFKONTO = '62616c1d-82e2-4ee4-aab9-950e40e438a4'; // all.media.prueflauf@web.de
const TESTKONTO = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4'; // test@all-media.app
const L = 'a1000000-0000-4000-8000-0000000103a1'; // nur in der Transaktion
const K = 'a1000000-0000-4000-8000-0000000103a2';
const D = 'a1000000-0000-4000-8000-0000000103a3';
const NEU = 'a1000000-0000-4000-8000-0000000103a4';
const NEU2 = 'a1000000-0000-4000-8000-0000000103a5';
const BEITRAG = 'a1000000-0000-4000-8000-0000000103b1';
const CHAT = 'a1000000-0000-4000-8000-0000000103c1';
const NACHRICHT = 'a1000000-0000-4000-8000-0000000103d1';
const NUMMER_L = '+4915199990103';

let fehler = 0;
let anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

const merke = (schluessel, ausdruck) =>
  `perform set_config('probe.erg', current_setting('probe.erg', true) || '${schluessel}=' || replace(coalesce((${ausdruck})::text, 'null'), ' ', '_') || ' ', true);`;
const versuch = (name, anweisung) => `
  begin ${anweisung}; ${merke(name, "'offen'")}
  exception when others then ${merke(name, "'zu'")}
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
const konto = (id, name, nummer) => `
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values ('${id}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          '${name}@prueflauf.invalid',
          '{"name":"Probe ${name}","phone":"${nummer}","handle":"@prueflauf.${name}"}', now(), now());`;
const frei = (id, geburt, eltern = null) => `
  insert into public.konto_alter (user_id, geburtsdatum, land, mindestalter, status, eltern_id)
  values ('${id}', '${geburt}', 'DE', 16, 'frei', ${eltern ? `'${eltern}'` : 'null'})
  on conflict (user_id) do update set status = 'frei', geburtsdatum = excluded.geburtsdatum, eltern_id = excluded.eltern_id;`;

(async () => {
  if (!process.env.SUPABASE_TOKEN) {
    console.log('ÜBERSPRUNGEN  SUPABASE_TOKEN fehlt.');
    process.exit(2);
  }
  const lies = (datei) => fs.readFileSync(path.join(__dirname, '..', '..', datei), 'utf8');
  const schema102 = lies('SUPABASE_SCHEMA_102_melden_moderation.sql');
  const schema103 = lies('SUPABASE_SCHEMA_103_konto_loeschen_auskunft.sql');

  const sql = `
begin;
select set_config('probe.erg', '', true);
${schema102}
${schema103}

${eigner(`
  ${konto(L, 'probe103l', NUMMER_L)}
  ${konto(K, 'probe103k', '+4915199991103')}
  ${konto(D, 'probe103d', '+4915199992103')}
  ${frei(L, '1980-01-01')}
  ${frei(K, '2012-01-01', L)}
  ${frei(D, '1990-01-01')}
  insert into public.posts (id, user_id, kind, description) values ('${BEITRAG}', '${L}', 'post', 'probe103 beitrag');
  insert into public.chats (id, anfrage_zustand) values ('${CHAT}', 'angenommen');
  insert into public.chat_members (chat_id, user_id) values ('${CHAT}', '${L}'), ('${CHAT}', '${TESTKONTO}');
  insert into public.messages (id, chat_id, sender_id, text) values ('${NACHRICHT}', '${CHAT}', '${L}', 'probe103 nachricht');
  insert into public.profile_bans (user_id, bereich, grund, ausloeser, bis_at)
  values ('${L}', 'alles', 'Probe 103', 'probe103', now() + interval '10 days');
  ${versuch('datei_anlegen', `insert into storage.objects (bucket_id, name, owner, owner_id) values ('media', 'probe103/${D}.jpg', '${D}', '${D}')`)}
`)}

${als(L, `
  j := public.meine_daten();
  ${merke('auskunft_konto', "j #>> '{konto,email}'")}
  ${merke('auskunft_alter', "j #>> '{alter_und_eltern,geburtsdatum}'")}
  ${merke('auskunft_kinder', "jsonb_array_length(j -> 'meine_kinder')")}
  ${merke('auskunft_beitraege', "jsonb_array_length(j -> 'beitraege')")}
  ${merke('auskunft_nachrichten', "jsonb_array_length(j -> 'eigene_nachrichten')")}
  ${merke('auskunft_chats', "jsonb_array_length(j -> 'chats')")}
  ${merke('auskunft_sperren', "jsonb_array_length(j -> 'sperren_gegen_mich')")}
  ${merke('auskunft_bereiche', "(select count(*) from jsonb_object_keys(j))")}
  ${merke('auskunft_geheimnis', "(j::text ~* '(code_hash|anbieter_token|nummer_pfeffer|gesperrte_nummern)')")}
  select count(*) into n from public.meine_medien();
  ${merke('medien_l', 'n')}
  ${merke('falsches_wort', "public.konto_loeschen('ja') ->> 'grund'")}
  ${merke('loeschen', "public.konto_loeschen('LOESCHEN') ->> 'ok'")}
`)}

${eigner(`
  select count(*) into n from auth.users where id = '${L}';
  ${merke('user_weg', 'n')}
  select count(*) into n from public.profiles where id = '${L}';
  ${merke('profil_weg', 'n')}
  select count(*) into n from public.posts where id = '${BEITRAG}';
  ${merke('beitrag_weg', 'n')}
  select count(*) into n from public.messages where id = '${NACHRICHT}';
  ${merke('nachricht_weg', 'n')}
  select count(*) into n from public.gesperrte_nummern where hash = public.nummer_hash('${NUMMER_L}')
    and bis > now() + interval '9 days';
  ${merke('nummer_gesperrt', 'n')}
  select count(*) into n from public.gesperrte_nummern where hash like '%${NUMMER_L.slice(1)}%';
  ${merke('nummer_klartext', 'n')}
  select count(*) into n from public.konto_alter where user_id = '${K}' and eltern_id is null and status = 'frei';
  ${merke('kind_bleibt', 'n')}
  select count(*) into n from public.notifications where user_id = '${K}' and text like 'Dein Elternteil hat sein All-Media-Konto gelöscht%';
  ${merke('kind_info', 'n')}
  ${versuch('neu_gleiche_nummer', konto(NEU, 'probe103neu', NUMMER_L).trim().replace(/;$/, ''))}
  ${versuch('neu_andere_nummer', konto(NEU2, 'probe103neu2', '+4915199993103').trim().replace(/;$/, ''))}
  ${versuch('nummer_aendern_gesperrt', `update public.profiles set phone = '${NUMMER_L}' where id = '${NEU2}'`)}
  select count(*) into n from public.profiles where id = '${NEU2}';
  ${merke('neu2_profil', 'n')}
`)}

${als(D, `
  select count(*) into n from public.meine_medien();
  ${merke('medien_d', 'n')}
  ${merke('loeschen_mit_datei', "public.konto_loeschen('LOESCHEN') ->> 'grund'")}
`)}
${als(PRUEFKONTO, `
  ${merke('pruefkonto', "public.konto_loeschen('LOESCHEN') ->> 'grund'")}
  ${versuch('pfeffer_lesen', 'perform * from public.nummer_pfeffer')}
  ${versuch('sperrliste_lesen', 'perform * from public.gesperrte_nummern')}
`)}
${eigner(`
  select count(*) into n from auth.users where id = '${D}';
  ${merke('d_bleibt', 'n')}
  ${merke('rechte_anon_loeschen', `has_function_privilege('anon', 'public.konto_loeschen(text)', 'execute')`)}
  ${merke('rechte_anon_daten', `has_function_privilege('anon', 'public.meine_daten()', 'execute')`)}
  ${merke('rechte_anon_medien', `has_function_privilege('anon', 'public.meine_medien()', 'execute')`)}
  ${merke('rechte_hash', `has_function_privilege('authenticated', 'public.nummer_hash(text)', 'execute')`)}
`)}

do $p$ begin raise exception 'ERG:%', current_setting('probe.erg', true); end $p$;
`;

  const antwort = await frage(sql);
  const text = JSON.stringify(antwort);
  const treffer = text.match(/ERG:([^"\\]*)/);
  if (!treffer) {
    console.log('Keine Ergebnisse — Antwort:', text.slice(0, 900));
    process.exit(1);
  }
  const e = {};
  for (const paar of treffer[1].trim().split(/\s+/)) {
    const [k, ...r] = paar.split('=');
    e[k] = r.join('=');
  }

  console.log('\n1. Auskunft (Art. 15/20 DSGVO)');
  pruefe('E-Mail und Anmeldedaten enthalten', e.auskunft_konto === 'probe103l@prueflauf.invalid', e.auskunft_konto);
  pruefe('Geburtsdatum enthalten (Schema 52)', e.auskunft_alter === '1980-01-01', e.auskunft_alter);
  pruefe('eigene Kinder enthalten', e.auskunft_kinder === '1', e.auskunft_kinder);
  pruefe('Beitrag, Nachricht, Chat, Sperre enthalten',
    [e.auskunft_beitraege, e.auskunft_nachrichten, e.auskunft_chats, e.auskunft_sperren].every((x) => x === '1'),
    `${e.auskunft_beitraege}/${e.auskunft_nachrichten}/${e.auskunft_chats}/${e.auskunft_sperren}`);
  pruefe('viele Bereiche (alt: 17)', Number(e.auskunft_bereiche) >= 50, e.auskunft_bereiche);
  pruefe('keine Geheimnisse (Hash, Token, Pfeffer)', e.auskunft_geheimnis === 'false', e.auskunft_geheimnis);

  console.log('\n2. Konto löschen (Art. 17 DSGVO, Apple 5.1.1 v)');
  pruefe('ohne Bestätigungswort nichts', e.falsches_wort === 'bestaetigung', e.falsches_wort);
  pruefe('löschen klappt', e.loeschen === 'true', e.loeschen);
  pruefe('Konto und Profil weg', e.user_weg === '0' && e.profil_weg === '0', `${e.user_weg}/${e.profil_weg}`);
  pruefe('Beitrag und Nachricht weg', e.beitrag_weg === '0' && e.nachricht_weg === '0', `${e.beitrag_weg}/${e.nachricht_weg}`);
  pruefe('Kind behält Konto, Elternkontrolle endet', e.kind_bleibt === '1', e.kind_bleibt);
  pruefe('Kind bekommt Bescheid', e.kind_info === '1', e.kind_info);

  console.log('\n3. Sperre nicht durch Löschen umgehbar');
  pruefe('Nummer bis Sperrende gesperrt', e.nummer_gesperrt === '1', e.nummer_gesperrt);
  pruefe('nur Hash, keine Nummer im Klartext', e.nummer_klartext === '0', e.nummer_klartext);
  pruefe('neu anmelden mit derselben Nummer abgewiesen', e.neu_gleiche_nummer === 'zu', e.neu_gleiche_nummer);
  pruefe('andere Nummer geht', e.neu_andere_nummer === 'offen', e.neu_andere_nummer);
  pruefe('neues Konto hat sein Profil', e.neu2_profil === '1', e.neu2_profil);
  pruefe('gesperrte Nummer nicht nachträglich eintragbar', e.nummer_aendern_gesperrt === 'zu', e.nummer_aendern_gesperrt);

  console.log('\n4. Schutz');
  pruefe('Datei im Speicher angelegt (Probe-Voraussetzung)', e.datei_anlegen === 'offen', e.datei_anlegen);
  pruefe('meine_medien zeigt die Datei', e.medien_d === '1' && e.medien_l === '0', `${e.medien_d}/${e.medien_l}`);
  pruefe('mit Datei kein Löschen', e.loeschen_mit_datei === 'medien' && e.d_bleibt === '1', `${e.loeschen_mit_datei}/${e.d_bleibt}`);
  pruefe('Prüfkonto wird nie gelöscht', e.pruefkonto === 'testkonto', e.pruefkonto);
  pruefe('Pfeffer und Sperrliste nicht lesbar', e.pfeffer_lesen === 'zu' && e.sperrliste_lesen === 'zu', `${e.pfeffer_lesen}/${e.sperrliste_lesen}`);

  console.log('\n5. Rechte');
  pruefe('anon darf nicht löschen', e.rechte_anon_loeschen === 'false', e.rechte_anon_loeschen);
  pruefe('anon bekommt keine Auskunft', e.rechte_anon_daten === 'false', e.rechte_anon_daten);
  pruefe('anon sieht keine Medien', e.rechte_anon_medien === 'false', e.rechte_anon_medien);
  pruefe('nummer_hash nicht aufrufbar', e.rechte_hash === 'false', e.rechte_hash);

  console.log(`\n${anzahl - fehler}/${anzahl} bestanden — alles zurückgerollt.`);
  process.exit(fehler ? 1 : 0);
})();
