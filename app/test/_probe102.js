#!/usr/bin/env node
/**
 * Schema 102 (Auftrag Recht/Sicherheit 21.10., Kasten RS 3: Melden und
 * Moderation nach DSA Art. 16/17/20) in einer VERWORFENEN Transaktion proben.
 * Vorlage _probe100.js.
 *
 *   begin;
 *   Schema 102 komplett
 *   Moderator M: ein Wegwerf-Konto, nur in dieser Transaktion (auth.users),
 *     freigegeben und in `moderatoren` eingetragen. Prüfkonto und Testkonto
 *     sind Meldender und Betroffener — ein Moderator darf über beides nicht
 *     entscheiden (befangen).
 *   Prüfkonto meldet Beitrag, Nachricht, Profil des Testkontos; Pflichtfelder
 *   (Begründung, guter Glaube) greifen; Eingangsbestätigung kommt.
 *   Angriffe: Nicht-Moderator liest Liste, ändert Meldung, trägt sich als
 *   Moderator ein, meldet Nachricht eines fremden Chats; Moderator liest
 *   Nachrichten direkt (Fernmeldegeheimnis).
 *   M entscheidet (entfernen, sperren) → Inhalt weg, Sperre da, beide
 *   bekommen eine Begründung; Testkonto widerspricht → M hebt auf → Beitrag
 *   zurück, Sperre aufgehoben.
 *   Kategorie kindesmissbrauch: Beleg wird nicht herausgegeben.
 *   Alter Client (direkter Insert) läuft weiter.
 *   Ergebnis per raise → alles zurückgerollt, nichts bleibt.
 *
 * Nur die eigenen Konten. Läuft auch bei gesperrtem PostgREST (402).
 * Start: SUPABASE_TOKEN=… SUPABASE_URL=https://….supabase.co node test/_probe102.js
 */
const fs = require('fs');
const path = require('path');
const { frage } = require('./_aufraeumen');

const PRUEFKONTO = '62616c1d-82e2-4ee4-aab9-950e40e438a4'; // all.media.prueflauf@web.de
const TESTKONTO = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4'; // test@all-media.app
const MOD = 'a1000000-0000-4000-8000-0000000001a2'; // nur in der Transaktion
const BEITRAG = 'a1000000-0000-4000-8000-0000000001b1';
const EIGENER = 'a1000000-0000-4000-8000-0000000001b2';
const CHAT = 'a1000000-0000-4000-8000-0000000001c1';
const FREMD_CHAT = 'a1000000-0000-4000-8000-0000000001c2';
const NACHRICHT = 'a1000000-0000-4000-8000-0000000001d1';
const FREMD_NACHRICHT = 'a1000000-0000-4000-8000-0000000001d2';
// Gate 2 (25.10.): ein echtes, kein Testkonto als Autor (nur in der Transaktion),
// ein zweiter Moderator, weitere Ziele.
const AUTOR = 'a1000000-0000-4000-8000-0000000001a3';
const MOD2 = 'a1000000-0000-4000-8000-0000000001a4';
const ALT_BEITRAG = 'a1000000-0000-4000-8000-0000000001b3';
const MEDIEN_BEITRAG = 'a1000000-0000-4000-8000-0000000001b4';
const KOMMENTAR = 'a1000000-0000-4000-8000-0000000001e1';
// 31.10.: zweite Stufe bei Kindesmissbrauch, zurückgestellte Begründung, Medienabruf im Protokoll.
const CSAM2 = 'a1000000-0000-4000-8000-0000000001b5';
const neuerBeitrag = (wer) => `insert into public.posts (id, user_id, kind, description) values (gen_random_uuid(), '${wer}', 'post', 'probe102 neu')`;

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
const melde = (art, ziel, kat, begr, gut = true, beleg = 'null') =>
  `public.inhalt_melden('${art}', ${ziel ? `'${ziel}'::uuid` : 'null'}, '${kat}', '${begr}', ${gut}, ${beleg}::jsonb)`;
const idVon = (schluessel) => `current_setting('probe.${schluessel}')::uuid`;
const halte = (schluessel, ausdruck) => `perform set_config('probe.${schluessel}', (${ausdruck})::text, true);`;
const BEGR = 'Der Beitrag beleidigt eine Gruppe von Menschen pauschal.';

(async () => {
  if (!process.env.SUPABASE_TOKEN) {
    console.log('ÜBERSPRUNGEN  SUPABASE_TOKEN fehlt.');
    process.exit(2);
  }
  const schema = fs.readFileSync(
    path.join(__dirname, '..', '..', 'SUPABASE_SCHEMA_102_melden_moderation.sql'),
    'utf8'
  );

  const sql = `
begin;
select set_config('probe.erg', '', true);
${schema}

${eigner(`
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values ('${MOD}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe102@prueflauf.invalid',
          '{"name":"Probe Moderator","phone":"+4915199990102","handle":"@prueflauf.probe102"}', now(), now());
  insert into public.konto_alter (user_id, geburtsdatum, land, mindestalter, status)
  values ('${MOD}', '1990-01-01', 'DE', 16, 'frei')
  on conflict (user_id) do update set status = 'frei', geburtsdatum = '1990-01-01';
  insert into public.moderatoren (user_id) values ('${MOD}');

  insert into public.posts (id, user_id, kind, description) values
    ('${BEITRAG}', '${TESTKONTO}', 'post', 'probe102 gemeldet'),
    ('${EIGENER}', '${PRUEFKONTO}', 'post', 'probe102 eigener');
  insert into public.chats (id, anfrage_zustand) values ('${CHAT}', 'angenommen'), ('${FREMD_CHAT}', 'angenommen');
  insert into public.chat_members (chat_id, user_id) values ('${CHAT}', '${PRUEFKONTO}'), ('${CHAT}', '${TESTKONTO}'),
    ('${FREMD_CHAT}', '${PRUEFKONTO}'), ('${FREMD_CHAT}', '${MOD}');
  insert into public.messages (id, chat_id, sender_id, text) values
    ('${NACHRICHT}', '${CHAT}', '${TESTKONTO}', 'probe102 drohung'),
    ('${FREMD_NACHRICHT}', '${FREMD_CHAT}', '${MOD}', 'probe102 privat');
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values ('${AUTOR}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe102-autor@prueflauf.invalid',
          '{"name":"Probe Autor","phone":"+4915199990103","handle":"@prueflauf.probe102a"}', now(), now());
  insert into public.konto_alter (user_id, geburtsdatum, land, mindestalter, status)
  values ('${AUTOR}', '1995-01-01', 'DE', 16, 'frei')
  on conflict (user_id) do update set status = 'frei', geburtsdatum = '1995-01-01';
  insert into public.posts (id, user_id, kind, description, media_url) values
    ('${ALT_BEITRAG}', '${TESTKONTO}', 'post', 'probe102 alt', null),
    ('${MEDIEN_BEITRAG}', '${TESTKONTO}', 'post', 'probe102 medien', public.medien_adresse('posts/probe102-bild.jpg'));
  -- Ohne Anmeldung ließe der Wächter (Schema 66) den Kommentar eines echten Kontos nicht zu.
  perform set_config('allmedia.wiederherstellen', 'an', true);
  insert into public.comments (id, post_id, user_id, text) values ('${KOMMENTAR}', '${ALT_BEITRAG}', '${AUTOR}', 'probe102 kommentar');
  perform set_config('allmedia.wiederherstellen', '', true);
  ${halte('mitteilungen_vorher', `(select count(*) from public.notifications where user_id = '${PRUEFKONTO}' and art = 'system')`)}
`)}

${als(PRUEFKONTO, `
  j := ${melde('post', BEITRAG, 'hass', BEGR)};
  ${merke('melden_ok', "j ->> 'ok'")}
  perform set_config('probe.m_beitrag', j ->> 'id', true);
  j := ${melde('post', BEITRAG, 'hass', BEGR)};
  ${merke('doppelt', `(j ->> 'schon') || ':' || ((j ->> 'id') = current_setting('probe.m_beitrag'))::text`)}
  ${merke('ohne_gutglaeubig', `${melde('post', BEITRAG, 'hass', BEGR, false)} ->> 'grund'`)}
  ${merke('kurze_begruendung', `${melde('post', BEITRAG, 'hass', 'doof')} ->> 'grund'`)}
  ${merke('unbekannte_kategorie', `${melde('post', BEITRAG, 'quatsch', BEGR)} ->> 'grund'`)}
  ${merke('selbst', `${melde('post', EIGENER, 'hass', BEGR)} ->> 'grund'`)}
  ${merke('gibt_es_nicht', `${melde('post', 'a1000000-0000-4000-8000-0000000001ff', 'hass', BEGR)} ->> 'grund'`)}
  j := ${melde('message', NACHRICHT, 'gewalt_drohung', 'Er droht mir in der Nachricht mit Gewalt.', true, `'{"text":"probe102 drohung"}'`)};
  ${merke('nachricht_ok', "j ->> 'ok'")}
  perform set_config('probe.m_nachricht', j ->> 'id', true);
  j := ${melde('story', BEITRAG, 'kindesmissbrauch', '')};
  ${merke('story_falsches_ziel', "j ->> 'grund'")}
  j := ${melde('post', BEITRAG, 'kindesmissbrauch', '')};
  ${merke('kindesmissbrauch_ohne_text', "j ->> 'ok'")}
  perform set_config('probe.m_csam', j ->> 'id', true);
  j := ${melde('user', TESTKONTO, 'mobbing', 'Das Profil beleidigt mich seit Tagen.')};
  perform set_config('probe.m_profil', j ->> 'id', true);
  j := ${melde('problem', null, '', 'Die App stürzt beim Hochladen ab.')};
  ${merke('problem_ok', "j ->> 'ok'")}
  j := ${melde('comment', KOMMENTAR, 'hass', 'Der Kommentar beleidigt eine Gruppe pauschal.')};
  perform set_config('probe.m_kommentar', j ->> 'id', true);
  j := ${melde('post', MEDIEN_BEITRAG, 'hass', 'Das Bild verhöhnt eine Gruppe von Menschen.')};
  perform set_config('probe.m_medien', j ->> 'id', true);
  j := ${melde('user', MOD, 'mobbing', 'Dieses Profil beleidigt mich andauernd.')};
  ${merke('gegen_mod_ok', "j ->> 'ok'")}
  j := ${melde('user', TESTKONTO, 'selbstverletzung', 'Sie schreibt, dass sie sich etwas antun will.')};
  perform set_config('probe.m_hilfe', j ->> 'id', true);
  j := ${melde('message', NACHRICHT, 'hass', 'Die Nachricht hetzt gegen meine Familie.', true, `'{"text":"probe102 hetze","sitzung":"quatsch"}'`)};
  perform set_config('probe.m_sitzung', j ->> 'id', true);
  j := ${melde('post', ALT_BEITRAG, 'betrug_spam', 'Der Beitrag wirbt für ein gefälschtes Gewinnspiel.')};
  perform set_config('probe.m_alt', j ->> 'id', true);
  select count(*) into n from public.meine_meldungen();
  ${merke('meine_meldungen', 'n')}

  ${versuch('liste_als_nutzer', 'perform * from public.meldungen_liste()')}
  ${versuch('meldung_aendern', `update public.reports set status = 'erledigt' where reported_by = '${PRUEFKONTO}'`)}
  ${versuch('selbst_moderator', `insert into public.moderatoren (user_id) values ('${PRUEFKONTO}')`)}
  ${versuch('entscheiden_als_nutzer', `perform public.meldung_entscheiden(current_setting('probe.m_beitrag')::uuid, 'keine', '${BEGR}', 'regeln')`)}
  ${merke('ist_moderator_nutzer', 'public.ist_moderator()')}
  -- Alter Client: direkter Insert
  insert into public.reports (reported_by, target_type, target_id, reason) values ('${PRUEFKONTO}', 'post', '${BEITRAG}', 'Spam');
  -- Gate 2, Fund 1: gefälschter Beleg und fremdes Opfer über den direkten Weg.
  insert into public.reports (reported_by, target_type, target_id, reason, kategorie, ziel_profil, beleg, gutglaeubig, sperre_bis)
  values ('${PRUEFKONTO}', 'message', '${NACHRICHT}', 'gefälscht', 'hass', '${MOD}',
          '{"krypto":1,"chiffre":"gefaelscht","klartext_gemeldet":"erfunden"}', true, now());
  ${versuch('direkt_community', `insert into public.reports (reported_by, target_type, target_id, reason) values ('${PRUEFKONTO}', 'community', '${BEITRAG}', 'x')`)}
  ${versuch('reports_lesen', 'perform count(*) from public.reports')}
  ${merke('medium_nutzer', "public.gemeldetes_medium('posts/probe102-bild.jpg')")}
`)}
${eigner(`
  ${merke('eingangsbestaetigung', `(select count(*) from public.notifications where user_id = '${PRUEFKONTO}' and art = 'system') - current_setting('probe.mitteilungen_vorher')::int`)}
  select count(*) into n from public.reports where reported_by = '${PRUEFKONTO}' and reason = 'Spam'
    and status = 'eingegangen' and ziel_profil = '${TESTKONTO}';
  ${merke('alter_client', 'n')}
`)}

${als(TESTKONTO, `
  ${merke('fremde_nachricht', `${melde('message', FREMD_NACHRICHT, 'hass', BEGR, true, `'{"text":"x"}'`)} ->> 'grund'`)}
  ${versuch('frei_posten', neuerBeitrag(TESTKONTO))}
  ${versuch('frei_schreiben', `insert into public.messages (id, chat_id, sender_id, text) values (gen_random_uuid(), '${CHAT}', '${TESTKONTO}', 'probe102 frei')`)}
`)}

${als(MOD, `
  ${merke('ist_moderator', 'public.ist_moderator()')}
  select count(*) into n from public.meldungen_liste();
  ${merke('liste_anzahl', 'n')}
  select (array_agg(l.kategorie))[1] into j from (select to_jsonb(kategorie) kategorie from public.meldungen_liste()) l;
  ${merke('erste_kategorie', "j #>> '{}'")}
  select count(*) into n from public.meldungen_liste() l where l.kategorie = 'kindesmissbrauch' and l.beleg is null and l.beleg_verborgen;
  ${merke('csam_verborgen', 'n')}
  select count(*) into n from public.meldungen_liste() l where l.art = 'message' and l.beleg ->> 'klartext_gemeldet' = 'probe102 drohung';
  ${merke('nachricht_beleg', 'n')}
  select count(*) into n from public.messages where chat_id = '${CHAT}';
  ${merke('mod_liest_chat', 'n')}

  ${merke('csam_ohne_bestaetigung', `public.meldung_entscheiden(${idVon('m_csam')}, 'entfernen_sperren', 'Darstellung nach § 184b StGB, vorläufig entfernt.', 'gesetz') ->> 'grund'`)}
  ${merke('csam_regeln', `public.meldung_entscheiden(${idVon('m_csam')}, 'entfernen', 'Darstellung nach § 184b StGB, vorläufig entfernt.', 'regeln') ->> 'grund'`)}
  ${merke('kurz_begruendet', `public.meldung_entscheiden(${idVon('m_beitrag')}, 'entfernen', 'zu kurz', 'regeln') ->> 'grund'`)}
  ${merke('ohne_grundlage', `public.meldung_entscheiden(${idVon('m_beitrag')}, 'entfernen', '${BEGR}', null) ->> 'grund'`)}
  ${merke('entfernen', `public.meldung_entscheiden(${idVon('m_beitrag')}, 'entfernen', '${BEGR}', 'regeln') ->> 'ok'`)}
  ${merke('zweimal', `public.meldung_entscheiden(${idVon('m_beitrag')}, 'keine', '${BEGR}', 'regeln') ->> 'grund'`)}
  ${merke('csam_ziel_weg', `public.meldung_entscheiden(${idVon('m_csam')}, 'entfernen', 'Darstellung nach § 184b StGB, vorläufig entfernt.', 'gesetz') ->> 'grund'`)}
  ${merke('norm_fehlt', `public.meldung_entscheiden(${idVon('m_nachricht')}, 'entfernen', 'Die Nachricht droht dem Empfänger mit Gewalt.', 'gesetz') ->> 'grund'`)}
  ${merke('nachricht_entfernen', `public.meldung_entscheiden(${idVon('m_nachricht')}, 'entfernen', 'Die Nachricht droht dem Empfänger mit Gewalt (§ 241 StGB).', 'gesetz') ->> 'ok'`)}
  ${merke('dauer_ohne_ende', `public.meldung_entscheiden(${idVon('m_profil')}, 'sperren', 'Wiederholte Beleidigungen gegen dieselbe Person.', 'regeln') ->> 'grund'`)}
  ${merke('sperren', `public.meldung_entscheiden(${idVon('m_profil')}, 'sperren', 'Wiederholte Beleidigungen gegen dieselbe Person.', 'regeln', 7) ->> 'ok'`)}
  ${merke('kommentar_entfernen', `public.meldung_entscheiden(${idVon('m_kommentar')}, 'entfernen', 'Der Kommentar beleidigt eine Gruppe pauschal.', 'regeln') ->> 'ok'`)}
  ${merke('hilfe_keine', `public.meldung_entscheiden(${idVon('m_hilfe')}, 'keine', 'Kein Verstoß, aber wir machen uns Sorgen um sie.', 'regeln') ->> 'ok'`)}
  ${merke('alt_keine', `public.meldung_entscheiden(${idVon('m_alt')}, 'keine', 'Wir konnten keinen Betrug erkennen.', 'regeln') ->> 'ok'`)}
  ${merke('art18', `public.art18_vermerken(${idVon('m_nachricht')}, 'BKA u-entrance, 25.10.2026') ->> 'ok'`)}
  select count(*) into n from public.meldungen_liste('alle') l where l.id = ${idVon('m_nachricht')} and l.art18;
  ${merke('art18_liste', 'n')}
  select count(*) into n from public.meldungen_liste('alle') l where l.ziel_profil = '${MOD}';
  ${merke('eigene_faelle', 'n')}
  ${merke('medium_mod', "public.gemeldetes_medium('posts/probe102-bild.jpg')")}
  ${merke('medium_fremd', "public.gemeldetes_medium('posts/probe102-anderes.jpg')")}
`)}
${eigner(`
  -- Seit F11 ausgeblendet statt gelöscht: zählt nur, was nicht markiert ist.
  select count(*) into n from public.posts where id = '${BEITRAG}' and moderiert_am is null;
  ${merke('beitrag_weg', 'n')}
  select count(*) into n from public.messages where id = '${NACHRICHT}' and deleted_at is not null and text = '';
  ${merke('nachricht_geleert', 'n')}
  select count(*) into n from public.profile_bans where user_id = '${TESTKONTO}' and not aufgehoben
    and ausloeser = 'meldung:' || current_setting('probe.m_profil') and bis_at > now() + interval '6 days';
  ${merke('sperre_da', 'n')}
  select count(*) into n from public.notifications where user_id = '${TESTKONTO}' and art = 'system'
    and text like '%Begründung%' and text like '%widersprechen%';
  ${merke('betroffen_begruendung', 'n')}
  select count(*) into n from public.notifications where user_id = '${PRUEFKONTO}' and art = 'system'
    and text like 'Wir haben deine Meldung geprüft%';
  ${merke('meldender_info', 'n')}
  select count(*) into n from public.moderation_protokoll where wer = '${MOD}';
  ${merke('protokoll', 'n')}
  select count(*) into n from public.reports where reported_by = '${PRUEFKONTO}' and reason = 'gefälscht'
    and beleg = '{"weg":"alt"}'::jsonb and ziel_profil = '${TESTKONTO}' and not gutglaeubig and sperre_bis is null
    and kategorie = 'regelverstoss';
  ${merke('k1_gehaertet', 'n')}
  select count(*) into n from public.reports where id = ${idVon('m_sitzung')} and beleg ? 'sitzung' and beleg ->> 'sitzung' is null;
  ${merke('sitzung_verworfen', 'n')}
  select count(*) into n from public.notifications where user_id = '${TESTKONTO}' and art = 'system' and text like '%TelefonSeelsorge%';
  ${merke('hilfe_mitteilung', 'n')}
  select count(*) into n from public.comments where id = '${KOMMENTAR}' and moderiert_am is null;
  ${merke('kommentar_weg', 'n')}
`)}

${als(TESTKONTO, `
  ${versuch('gesperrt_posten', neuerBeitrag(TESTKONTO))}
  ${versuch('gesperrt_schreiben', `insert into public.messages (id, chat_id, sender_id, text) values (gen_random_uuid(), '${CHAT}', '${TESTKONTO}', 'probe102 gesperrt')`)}
  select count(*) into n from public.mich_betreffende_entscheidungen();
  ${merke('kontostatus', 'n')}
  ${merke('widerspruch', `public.entscheidung_widersprechen(${idVon('m_beitrag')}, 'Das war Satire.') ->> 'ok'`)}
  ${merke('widerspruch_zweimal', `public.entscheidung_widersprechen(${idVon('m_beitrag')}, 'nochmal') ->> 'grund'`)}
  ${merke('widerspruch_sperre', `public.entscheidung_widersprechen(${idVon('m_profil')}, 'Stimmt nicht.') ->> 'ok'`)}
`)}
${als(PRUEFKONTO, `
  -- Meine Meldungen: Frist nur bei entschiedenen, Stand des eigenen Widerspruchs (25.10.).
  select count(*) into n from public.meine_meldungen() m
   where m.id = ${idVon('m_nachricht')} and m.widerspruch_bis > now() + interval '5 months' and m.beschwerde_status is null;
  ${merke('meine_frist', 'n')}
  select count(*) into n from public.meine_meldungen() m where m.status <> 'entschieden' and m.widerspruch_bis is not null;
  ${merke('meine_frist_unentschieden', 'n')}
  ${merke('meldend_widerspruch', `public.entscheidung_widersprechen(${idVon('m_nachricht')}, 'Prüfung der Probe 102.') ->> 'ok'`)}
  select count(*) into n from public.meine_meldungen() m where m.id = ${idVon('m_nachricht')} and m.beschwerde_status is not null;
  ${merke('meine_beschwerde', 'n')}
  ${merke('meldend_widerspruch_alt', `public.entscheidung_widersprechen(${idVon('m_alt')}, 'Das ist eindeutig Betrug, bitte noch einmal ansehen.') ->> 'ok'`)}
`)}
${als(AUTOR, `
  ${merke('autor_widerspruch', `public.entscheidung_widersprechen(${idVon('m_kommentar')}, 'Das war kein Angriff, sondern ein Zitat.') ->> 'ok'`)}
`)}
${als(MOD, `
  select to_jsonb(id::text) into j from public.beschwerden_liste() where meldung_id = ${idVon('m_beitrag')};
  perform set_config('probe.b1', j #>> '{}', true);
  select to_jsonb(id::text) into j from public.beschwerden_liste() where meldung_id = ${idVon('m_profil')};
  perform set_config('probe.b2', j #>> '{}', true);
  ${merke('aufheben', `public.beschwerde_entscheiden(${idVon('b1')}, 'aufgehoben', 'Bei zweitem Hinsehen ist es erkennbar Satire.') ->> 'ok'`)}
  ${merke('aufheben_sperre', `public.beschwerde_entscheiden(${idVon('b2')}, 'aufgehoben', 'Die Beleidigungen waren nicht von diesem Konto.') ->> 'ok'`)}
  select to_jsonb(id::text) into j from public.beschwerden_liste() where meldung_id = ${idVon('m_kommentar')};
  perform set_config('probe.b_kommentar', j #>> '{}', true);
  ${merke('kommentar_zurueck_ok', `public.beschwerde_entscheiden(${idVon('b_kommentar')}, 'aufgehoben', 'Im Zusammenhang ist es ein Zitat und kein Angriff.') ->> 'ok'`)}
  select to_jsonb(id::text) into j from public.beschwerden_liste() where meldung_id = ${idVon('m_alt')};
  perform set_config('probe.b_alt', j #>> '{}', true);
  ${merke('alt_wieder_offen', `public.beschwerde_entscheiden(${idVon('b_alt')}, 'aufgehoben', 'Bei zweitem Hinsehen ist das Gewinnspiel gefälscht.') ->> 'ok'`)}
  ${merke('alt_neu', `public.meldung_entscheiden(${idVon('m_alt')}, 'warnen', 'Betrugsversuch mit einem gefälschten Gewinnspiel.', 'regeln') ->> 'ok'`)}
  j := public.moderation_zahlen(now() - interval '1 day', now() + interval '1 day');
  ${merke('zahlen_meldungen', "j ->> 'meldungen'")}
`)}
${eigner(`
  select count(*) into n from public.posts where id = '${BEITRAG}' and description = 'probe102 gemeldet';
  ${merke('beitrag_zurueck', 'n')}
  select count(*) into n from public.profile_bans where user_id = '${TESTKONTO}'
    and ausloeser = 'meldung:' || current_setting('probe.m_profil') and aufgehoben;
  ${merke('sperre_aufgehoben', 'n')}
  ${merke('rechte_anon_melden', `has_function_privilege('anon', 'public.inhalt_melden(text,uuid,text,text,boolean,jsonb)', 'execute')`)}
  ${merke('rechte_anon_liste', `has_function_privilege('anon', 'public.meldungen_liste(text)', 'execute')`)}
  ${merke('rechte_mitteilung', `has_function_privilege('authenticated', 'public.rechtsmitteilung(uuid,text,uuid)', 'execute')`)}
  select count(*) into n from public.comments where id = '${KOMMENTAR}' and user_id = '${AUTOR}';
  ${merke('kommentar_zurueck', 'n')}
  select count(*) into n from public.reports where id = ${idVon('m_alt')} and status = 'entschieden' and massnahme = 'warnen';
  ${merke('alt_neu_entschieden', 'n')}
  update public.konto_alter set geburtsdatum = '2012-06-01' where user_id = '${MOD}';
`)}
${als(MOD, `
  ${merke('mod_minderjaehrig', 'public.ist_moderator()')}
`)}
${eigner(`
  update public.konto_alter set geburtsdatum = '1990-01-01' where user_id = '${MOD}';
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values ('${MOD2}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe102-mod2@prueflauf.invalid',
          '{"name":"Probe Moderator 2","phone":"+4915199990104","handle":"@prueflauf.probe102m"}', now(), now());
  insert into public.konto_alter (user_id, geburtsdatum, land, mindestalter, status)
  values ('${MOD2}', '1985-01-01', 'DE', 16, 'frei')
  on conflict (user_id) do update set status = 'frei', geburtsdatum = '1985-01-01';
  insert into public.moderatoren (user_id) values ('${MOD2}');
`)}
${als(TESTKONTO, `
  ${versuch('wieder_posten', neuerBeitrag(TESTKONTO))}
`)}
${als(MOD, `
  select to_jsonb(id::text) into j from public.beschwerden_liste() where meldung_id = ${idVon('m_nachricht')};
  perform set_config('probe.b3', j #>> '{}', true);
  ${merke('zweitpruefung', `public.beschwerde_entscheiden(${idVon('b3')}, 'bestaetigt', 'Die Drohung ist eindeutig und bleibt entfernt.') ->> 'grund'`)}
`)}

${eigner(`
  insert into public.posts (id, user_id, kind, description) values ('${CSAM2}', '${TESTKONTO}', 'post', 'probe102 csam2');
`)}
${als(PRUEFKONTO, `
  j := ${melde('post', CSAM2, 'kindesmissbrauch', '')};
  perform set_config('probe.m_csam2', j ->> 'id', true);
`)}
${als(MOD, `
  ${merke('zurueck_falsch', `public.meldung_entscheiden(p_id => ${idVon('m_medien')}, p_massnahme => 'entfernen', p_begruendung => 'Das Bild verhöhnt eine Gruppe von Menschen.', p_grundlage => 'regeln', p_zurueckstellen => true) ->> 'grund'`)}
  ${merke('medium_vermerk', `public.medium_abruf_vermerken(${idVon('m_medien')}) ->> 'ok'`)}
  ${merke('medium_vermerk_csam', `public.medium_abruf_vermerken(${idVon('m_csam2')}) ->> 'grund'`)}
  ${merke('csam2_entfernen', `public.meldung_entscheiden(p_id => ${idVon('m_csam2')}, p_massnahme => 'entfernen', p_begruendung => 'Darstellung nach § 184b StGB, entfernt.', p_grundlage => 'gesetz', p_zurueckstellen => true) ->> 'ok'`)}
  select count(*) into n from public.meldungen_liste('alle') l where l.id = ${idVon('m_csam2')} and l.zurueckgestellt;
  ${merke('liste_zurueck', 'n')}
  ${merke('nachtrag_ohne', `public.sperre_nachtragen(${idVon('m_csam2')}, null, '', 'Bestätigt nach § 184b StGB durch Sichtung.') ->> 'grund'`)}
  ${merke('nachtrag_falsch', `public.sperre_nachtragen(${idVon('m_medien')}, null, 'Sichtung 31.10.2026', 'Bestätigt nach § 184b StGB durch Sichtung.') ->> 'grund'`)}
  ${merke('nachtrag', `public.sperre_nachtragen(${idVon('m_csam2')}, null, 'Sichtung 31.10.2026', 'Bestätigt nach § 184b StGB durch Sichtung.') ->> 'ok'`)}
`)}
${als(TESTKONTO, `
  select count(*) into n from public.mich_betreffende_entscheidungen() m where m.id = ${idVon('m_csam2')};
  ${merke('zurueck_unsichtbar', 'n')}
`)}
${eigner(`
  select count(*) into n from public.notifications where user_id = '${TESTKONTO}' and target_id = ${idVon('m_csam2')};
  ${merke('zurueck_keine_mitteilung', 'n')}
  select count(*) into n from public.profile_bans where user_id = '${TESTKONTO}' and ausloeser = 'meldung:' || ${idVon('m_csam2')}::text and bis_at is null;
  ${merke('nachtrag_sperre', 'n')}
`)}
${als(MOD, `
  ${merke('nachsenden', `public.begruendung_nachsenden(${idVon('m_csam2')}) ->> 'ok'`)}
  ${merke('nachsenden_zweimal', `public.begruendung_nachsenden(${idVon('m_csam2')}) ->> 'schon'`)}
`)}
${als(TESTKONTO, `
  select count(*) into n from public.mich_betreffende_entscheidungen() m where m.id = ${idVon('m_csam2')} and m.massnahme = 'entfernen_sperren';
  ${merke('nachgesandt_sichtbar', 'n')}
`)}
${eigner(`
  select count(*) into n from public.notifications where user_id = '${TESTKONTO}' and target_id = ${idVon('m_csam2')}
     and text like '%gesperrt%' and text not ilike '%behörde%' and text not ilike '%BKA%';
  ${merke('nachgesandt_mitteilung', 'n')}
  select count(*) into n from public.moderation_protokoll where meldung_id in (${idVon('m_csam2')}, ${idVon('m_medien')})
     and was in ('medium_angesehen', 'sperre_nachgetragen', 'begruendung_nachgesandt');
  ${merke('protokoll_neu', 'n')}
  ${merke('rechte_neu', "has_function_privilege('anon', 'public.sperre_nachtragen(uuid,integer,text,text)', 'execute') or has_function_privilege('anon', 'public.begruendung_nachsenden(uuid)', 'execute') or has_function_privilege('anon', 'public.medium_abruf_vermerken(uuid)', 'execute')")}
`)}
${als(PRUEFKONTO, `
  ${versuch('nutzer_nachtrag', `perform public.sperre_nachtragen(${idVon('m_csam2')}, 1, 'xxxxxxxxxxxx', 'Bestätigt nach § 184b StGB durch Sichtung.')`)}
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

  console.log('\n1. Melden (Art. 16 DSA)');
  pruefe('Beitrag melden klappt', e.melden_ok === 'true', e.melden_ok);
  pruefe('ohne „guten Glauben" abgelehnt', e.ohne_gutglaeubig === 'gutglaeubig', e.ohne_gutglaeubig);
  pruefe('zu kurze Begründung abgelehnt', e.kurze_begruendung === 'begruendung', e.kurze_begruendung);
  pruefe('unbekannte Kategorie abgelehnt', e.unbekannte_kategorie === 'kategorie', e.unbekannte_kategorie);
  pruefe('eigenen Inhalt nicht meldbar', e.selbst === 'selbst', e.selbst);
  pruefe('unbekanntes Ziel → „ziel"', e.gibt_es_nicht === 'ziel', e.gibt_es_nicht);
  pruefe('falsche Art zum Ziel → „ziel"', e.story_falsches_ziel === 'ziel', e.story_falsches_ziel);
  pruefe('Kindesmissbrauch ohne Beschreibung meldbar', e.kindesmissbrauch_ohne_text === 'true', e.kindesmissbrauch_ohne_text);
  pruefe('Nachricht melden (Beteiligter) klappt', e.nachricht_ok === 'true', e.nachricht_ok);
  pruefe('Nachricht eines fremden Chats NICHT meldbar', e.fremde_nachricht === 'ziel', e.fremde_nachricht);
  pruefe('„Problem melden" wird gespeichert', e.problem_ok === 'true', e.problem_ok);
  pruefe('Eingangsbestätigung je Meldung', Number(e.eingangsbestaetigung) >= 5, e.eingangsbestaetigung);
  pruefe('meine_meldungen zeigt sie', Number(e.meine_meldungen) >= 5, e.meine_meldungen);
  pruefe('alter Client (direkter Insert) läuft weiter, Status und Ziel gefüllt', e.alter_client === '1', e.alter_client);
  pruefe('dieselbe Meldung zweimal: dieselbe Kennung, keine zweite Zeile (Fund 9)', e.doppelt === 'true:true', e.doppelt);
  pruefe('Meldung gegen ein freigegebenes Profil geht', e.gegen_mod_ok === 'true', e.gegen_mod_ok);

  console.log('\n2. Angriffe');
  pruefe('Nutzer ist kein Moderator', e.ist_moderator_nutzer === 'false', e.ist_moderator_nutzer);
  pruefe('Nutzer liest die Liste nicht', e.liste_als_nutzer === 'zu', e.liste_als_nutzer);
  pruefe('Nutzer entscheidet nicht', e.entscheiden_als_nutzer === 'zu', e.entscheiden_als_nutzer);
  pruefe('Nutzer ändert keine Meldung', e.meldung_aendern === 'zu', e.meldung_aendern);
  pruefe('Nutzer trägt sich nicht als Moderator ein', e.selbst_moderator === 'zu', e.selbst_moderator);
  pruefe('Moderator liest fremde Chats NICHT (Fernmeldegeheimnis)', e.mod_liest_chat === '0', e.mod_liest_chat);
  pruefe('direkter Insert: Beleg, Opfer, guter Glaube, Sperre vom Client verworfen (Fund 1)', e.k1_gehaertet === '1', e.k1_gehaertet);
  pruefe('direkter Insert nur für die alten fünf Arten', e.direkt_community === 'zu', e.direkt_community);
  pruefe('Meldungen nicht direkt lesbar, nur über meine_meldungen() (Fund 14)', e.reports_lesen === 'zu', e.reports_lesen);
  pruefe('Sitzungsschlüssel in falscher Form verworfen (Fund 29)', e.sitzung_verworfen === '1', e.sitzung_verworfen);
  pruefe('Nutzer bekommt gemeldete Medien nicht frei', e.medium_nutzer === 'false', e.medium_nutzer);

  console.log('\n3. Moderation');
  pruefe('Moderator erkannt', e.ist_moderator === 'true', e.ist_moderator);
  pruefe('Liste enthält die Meldungen', Number(e.liste_anzahl) >= 5, e.liste_anzahl);
  pruefe('Kindesmissbrauch steht ganz oben', e.erste_kategorie === 'kindesmissbrauch', e.erste_kategorie);
  pruefe('Kindesmissbrauch: Beleg nicht herausgegeben', e.csam_verborgen === '1', e.csam_verborgen);
  pruefe('Nachricht: nur der gemeldete Klartext im Beleg', e.nachricht_beleg === '1', e.nachricht_beleg);
  pruefe('Begründung < 20 Zeichen abgelehnt (Art. 17)', e.kurz_begruendet === 'begruendung', e.kurz_begruendet);
  pruefe('ohne Grundlage abgelehnt', e.ohne_grundlage === 'grundlage', e.ohne_grundlage);
  pruefe('entfernen klappt', e.entfernen === 'true', e.entfernen);
  pruefe('zweite Entscheidung abgelehnt', e.zweimal === 'schon_entschieden', e.zweimal);
  pruefe('Beitrag ist weg (ausgeblendet, F11)', e.beitrag_weg === '0', e.beitrag_weg);
  pruefe('Nachricht geleert (für alle gelöscht)', e.nachricht_entfernen === 'true' && e.nachricht_geleert === '1', `${e.nachricht_entfernen}/${e.nachricht_geleert}`);
  pruefe('Sperre 7 Tage angelegt', e.sperren === 'true' && e.sperre_da === '1', `${e.sperren}/${e.sperre_da}`);
  pruefe('Betroffener bekommt Begründung mit Rechtsbehelf', Number(e.betroffen_begruendung) >= 3, e.betroffen_begruendung);
  pruefe('Meldender erfährt die Entscheidung', Number(e.meldender_info) >= 3, e.meldender_info);
  pruefe('Protokoll geschrieben', Number(e.protokoll) >= 3, e.protokoll);
  pruefe('Kindesmissbrauch: Sperre ohne Bestätigung abgelehnt (Fund 5)', e.csam_ohne_bestaetigung === 'bestaetigung', e.csam_ohne_bestaetigung);
  pruefe('Kindesmissbrauch: nur Grundlage Gesetz', e.csam_regeln === 'grundlage', e.csam_regeln);
  pruefe('Inhalt schon weg: „ziel_weg“ statt „entfernt“ (Fund 9)', e.csam_ziel_weg === 'ziel_weg', e.csam_ziel_weg);
  pruefe('Rechtsverstoß ohne Vorschrift abgelehnt (Art. 17 Abs. 3 d)', e.norm_fehlt === 'norm', e.norm_fehlt);
  pruefe('Sperre ohne Enddatum nur in schweren Fällen (Fund 19)', e.dauer_ohne_ende === 'sperre_dauer', e.dauer_ohne_ende);
  pruefe('Kommentar eines echten Kontos entfernen', e.kommentar_entfernen === 'true' && e.kommentar_weg === '0', `${e.kommentar_entfernen}/${e.kommentar_weg}`);
  pruefe('Selbstverletzung: Hilfsangebot an die Person, auch bei „Nichts tun“ (Fund 16)', e.hilfe_keine === 'true' && Number(e.hilfe_mitteilung) >= 1, `${e.hilfe_keine}/${e.hilfe_mitteilung}`);
  pruefe('Art. 18: BKA-Vermerk im Protokoll und in der Liste (Fund 6)', e.art18 === 'true' && e.art18_liste === '1', `${e.art18}/${e.art18_liste}`);
  pruefe('eigene Fälle nicht in der Liste des Moderators (Fund 13)', e.eigene_faelle === '0', e.eigene_faelle);
  pruefe('gemeldetes Medium für Moderator frei, anderes nicht (Fund 7)', e.medium_mod === 'true' && e.medium_fremd === 'false', `${e.medium_mod}/${e.medium_fremd}`);
  pruefe('vor der Sperre darf das Konto posten und schreiben (Gegenprobe)', e.frei_posten === 'offen' && e.frei_schreiben === 'offen', `${e.frei_posten}/${e.frei_schreiben}`);
  pruefe('gesperrtes Konto postet und schreibt nicht (Fund 2)', e.gesperrt_posten === 'zu' && e.gesperrt_schreiben === 'zu', `${e.gesperrt_posten}/${e.gesperrt_schreiben}`);

  console.log('\n4. Widerspruch (Art. 20)');
  pruefe('Kontostatus zeigt Entscheidungen', Number(e.kontostatus) >= 3, e.kontostatus);
  pruefe('Widerspruch eingelegt', e.widerspruch === 'true', e.widerspruch);
  pruefe('kein zweiter Widerspruch', e.widerspruch_zweimal === 'schon', e.widerspruch_zweimal);
  pruefe('Meine Meldungen: Frist bei entschiedener Meldung, noch kein Widerspruch', e.meine_frist === '1', e.meine_frist);
  pruefe('Meine Meldungen: keine Frist bei offenen Meldungen', e.meine_frist_unentschieden === '0', e.meine_frist_unentschieden);
  pruefe('Meldender widerspricht', e.meldend_widerspruch === 'true', e.meldend_widerspruch);
  pruefe('Meine Meldungen zeigt den Widerspruch (Knopf verschwindet)', e.meine_beschwerde === '1', e.meine_beschwerde);
  pruefe('aufheben klappt', e.aufheben === 'true' && e.aufheben_sperre === 'true', `${e.aufheben}/${e.aufheben_sperre}`);
  pruefe('Beitrag wiederhergestellt', e.beitrag_zurueck === '1', e.beitrag_zurueck);
  pruefe('Sperre aufgehoben', e.sperre_aufgehoben === '1', e.sperre_aufgehoben);
  pruefe('nach Aufheben darf das Konto wieder posten', e.wieder_posten === 'offen', e.wieder_posten);
  pruefe('Kommentar eines echten Kontos wiederhergestellt (Fund 4)', e.kommentar_zurueck_ok === 'true' && e.kommentar_zurueck === '1', `${e.kommentar_zurueck_ok}/${e.kommentar_zurueck}`);
  pruefe('Widerspruch des Meldenden öffnet die Meldung, neue Entscheidung möglich (Fund 3)',
    e.meldend_widerspruch_alt === 'true' && e.alt_wieder_offen === 'true' && e.alt_neu === 'true' && e.alt_neu_entschieden === '1',
    `${e.meldend_widerspruch_alt}/${e.alt_wieder_offen}/${e.alt_neu}/${e.alt_neu_entschieden}`);
  pruefe('Minderjähriger Moderator ist keiner (Fund 20)', e.mod_minderjaehrig === 'false', e.mod_minderjaehrig);
  pruefe('Zweitprüfung: eigener Fall nicht selbst, sobald es zwei Moderatoren gibt (Fund 13)', e.zweitpruefung === 'zweitpruefung', e.zweitpruefung);
  pruefe('Transparenzzahlen', Number(e.zahlen_meldungen) >= 5, e.zahlen_meldungen);

  console.log('\n4b. Nachträge 31.10. (Fund 5, 7, 17)');
  pruefe('Zurückstellen nur bei Kindesmissbrauch/Drohung', e.zurueck_falsch === 'zurueckstellen', e.zurueck_falsch);
  pruefe('Medienabruf im Protokoll, nie bei Kindesmissbrauch', e.medium_vermerk === 'true' && e.medium_vermerk_csam === 'medium', `${e.medium_vermerk}/${e.medium_vermerk_csam}`);
  pruefe('Kindesmissbrauch entfernt, Begründung zurückgestellt', e.csam2_entfernen === 'true' && e.liste_zurueck === '1', `${e.csam2_entfernen}/${e.liste_zurueck}`);
  pruefe('Betroffener sieht nichts, solange zurückgestellt', e.zurueck_unsichtbar === '0' && e.zurueck_keine_mitteilung === '0', `${e.zurueck_unsichtbar}/${e.zurueck_keine_mitteilung}`);
  pruefe('Sperre nachtragen nur mit Bestätigung, nur nach Entfernen bei Kindesmissbrauch', e.nachtrag_ohne === 'bestaetigung' && e.nachtrag_falsch === 'massnahme', `${e.nachtrag_ohne}/${e.nachtrag_falsch}`);
  pruefe('Sperre nachgetragen (ohne Ende, schwerer Fall)', e.nachtrag === 'true' && e.nachtrag_sperre === '1', `${e.nachtrag}/${e.nachtrag_sperre}`);
  pruefe('Begründung nachgesandt, einmal', e.nachsenden === 'true' && e.nachsenden_zweimal === 'true', `${e.nachsenden}/${e.nachsenden_zweimal}`);
  pruefe('danach im Kontostatus, Mitteilung nennt Sperre, keine Behörde', e.nachgesandt_sichtbar === '1' && e.nachgesandt_mitteilung === '1', `${e.nachgesandt_sichtbar}/${e.nachgesandt_mitteilung}`);
  pruefe('Protokoll: Abruf, Sperre, Nachsenden', e.protokoll_neu === '3', e.protokoll_neu);
  pruefe('neue Funktionen nicht anonym, Nutzer darf nicht sperren', e.rechte_neu === 'false' && e.nutzer_nachtrag === 'zu', `${e.rechte_neu}/${e.nutzer_nachtrag}`);

  console.log('\n5. Rechte');
  pruefe('anon darf nicht melden', e.rechte_anon_melden === 'false', e.rechte_anon_melden);
  pruefe('anon darf die Liste nicht', e.rechte_anon_liste === 'false', e.rechte_anon_liste);
  pruefe('rechtsmitteilung nicht aufrufbar', e.rechte_mitteilung === 'false', e.rechte_mitteilung);

  console.log(`\n${anzahl - fehler}/${anzahl} bestanden — alles zurückgerollt.`);
  process.exit(fehler ? 1 : 0);
})();
