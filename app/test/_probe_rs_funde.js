#!/usr/bin/env node
/**
 * Codex-Funde F1–F3 zu kasten/rs-recht (Adversarial Review gpt-6.1-sol,
 * 31.10.2026) in einer VERWORFENEN Transaktion proben. Vorlage _probe102.js.
 *
 *   begin;
 *   Schema 102, 103, 106 komplett (in dieser Reihenfolge)
 *   Wegwerf-Konten nur in der Transaktion (auth.users, @prueflauf.invalid):
 *     MOD, MOD2  Moderatoren
 *     S          echtes (kein Test-)Konto, schreibt die gemeldete Nachricht
 *     R          meldet, schreibt selbst eine Nachricht
 *     E, K       Elternteil und Kind (Eltern-Einwilligung mit durch = E)
 *     X          Konto, dessen Löschung ein Probe-Auslöser scheitern lässt
 *
 *   F1  E löscht sein Konto, obwohl K Einwilligungen mit durch = E hat →
 *       gelingt, Zeilen bleiben mit durch = null. Einwilligungen bleiben
 *       sonst unveränderlich, auch durch direktes durch = null. Trockenlauf
 *       konto_loeschen_probe(): ok bei E, Fehler bei X — und bei X ist
 *       danach nichts gelöscht.
 *   F2  Nachricht von S wird moderativ entfernt + S gesperrt. S versucht
 *       per UPDATE den alten Text zurückzuholen, die Marke zu löschen,
 *       als Gesperrter Beitrag, Kommentar, Community und andere Nachricht
 *       zu ändern → alles verboten. Zurücknehmen der eigenen Nachricht
 *       bleibt erlaubt. R bearbeitet seine Nachricht normal. Nach erfolg-
 *       reichem Widerspruch ist die Nachricht wieder da und S darf sie
 *       wieder bearbeiten.
 *   F3  Entscheidung mit zurückgestellter Begründung → meine_daten() von S
 *       nennt sie nicht, die Sperre in profile_bans verrät die Begründung
 *       nicht; Widerspruch per geratener ID abgewiesen. Nach
 *       begruendung_nachsenden() steht beides da. meine_daten() enthält
 *       die Einwilligungen.
 *   F7  verschlüsselte Nachricht entfernen (krypto=0) und per Widerspruch
 *       samt Chiffre und Schlüssel wiederherstellen
 *   F8  Selbstmeldung über direkten INSERT abgewiesen, fremde geht
 *   F9  gesperrt: Mediennachricht mit leerem Anhang zurücknehmen
 *   F5  Community entfernen blendet aus (alles bleibt, niemand sieht oder
 *       schreibt), Widerspruch bringt Unterthema, Nachricht, Mitglieder zurück
 *   Ergebnis per raise → alles zurückgerollt, nichts bleibt.
 *
 * Start: SUPABASE_TOKEN=… SUPABASE_URL=https://….supabase.co node test/_probe_rs_funde.js
 */
const fs = require('fs');
const path = require('path');
const { frage } = require('./_aufraeumen');
// Wie App und Website beim Registrieren, mit Prüfsummen (Codex-Fund F6).
const ZUSTIMMUNG = require('../../gemeinsam/rechtstexte').zustimmungsDaten(new Date('2026-10-31T12:00:00Z'));

const id = (n) => `a1000000-0000-4000-8000-00000000f${n}`;
const MOD = id('0a1'), MOD2 = id('0a2'), S = id('0a3'), R = id('0a4'), E = id('0a5'), K = id('0a6'), X = id('0a7');
const CHAT = id('0c1');
const N1 = id('0d1'), N2 = id('0d2'), N3 = id('0d3'), N4 = id('0d4'), N5 = id('0d5');
// F11: Beitrag P2 von R mit Kommentar von E und Antwort von S; Beitrag P3 von R mit Kommentar K3 (R) und Antwort K4 (E).
const P2 = id('0b2'), P3 = id('0b3'), K2 = id('0e2'), K2A = id('0e3'), K3 = id('0e4'), K4 = id('0e5');
const POST = id('0b1'), KOMM = id('0e1'), COMM = id('0f1'), COMM2 = id('0f2'), KANAL = id('0f3'), KN = id('0f4'), COMM3 = id('0f5');
const BEGR = 'Die Nachricht droht dem Empfänger mit Gewalt (§ 241 StGB).';

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
  begin ${anweisung}; get diagnostics n = row_count; ${merke(name, "'offen:' || n")}
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
const konto = (kid, nr) => `
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values ('${kid}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probefunde-${nr}@prueflauf.invalid',
          '${JSON.stringify(Object.assign({ name: 'Probe Funde ' + nr, phone: '+49151999907' + nr, handle: '@prueflauf.pf' + nr }, ZUSTIMMUNG))}', now(), now());`;
const alter = (kid, geb, extra = '') => `
  insert into public.konto_alter (user_id, geburtsdatum, land, mindestalter, status${extra ? ', eltern_id, angefragt_am' : ''})
  values ('${kid}', '${geb}', 'DE', 16, '${extra ? 'wartet' : 'frei'}'${extra ? `, '${extra}', now()` : ''})
  on conflict (user_id) do update set status = excluded.status, geburtsdatum = excluded.geburtsdatum, eltern_id = excluded.eltern_id;`;
const idVon = (s) => `current_setting('probe.${s}')::uuid`;
const halte = (s, ausdruck) => `perform set_config('probe.${s}', (${ausdruck})::text, true)`;

(async () => {
  if (!process.env.SUPABASE_TOKEN) {
    console.log('ÜBERSPRUNGEN  SUPABASE_TOKEN fehlt.');
    process.exit(2);
  }
  const lies = (d) => fs.readFileSync(path.join(__dirname, '..', '..', d), 'utf8');
  const sql = `
begin;
select set_config('probe.erg', '', true);
-- F11 prüft auch Antworten: comments.reply_to wie Schema 92 (live noch nicht
-- eingespielt), nur in dieser Transaktion.
alter table public.comments add column if not exists reply_to uuid references public.comments (id) on delete cascade;
${lies('SUPABASE_SCHEMA_102_melden_moderation.sql')}
${lies('SUPABASE_SCHEMA_103_konto_loeschen_auskunft.sql')}
${lies('SUPABASE_SCHEMA_106_einwilligung_fassung.sql')}

${eigner(`
  ${konto(MOD, 1)} ${konto(MOD2, 2)} ${konto(S, 3)} ${konto(R, 4)} ${konto(E, 5)} ${konto(K, 6)} ${konto(X, 7)}
  ${alter(MOD, '1990-01-01')} ${alter(MOD2, '1991-01-01')} ${alter(S, '1995-01-01')} ${alter(R, '1996-01-01')}
  ${alter(E, '1980-01-01')} ${alter(X, '1985-01-01')} ${alter(K, '2014-01-01', E)}
  insert into public.moderatoren (user_id) values ('${MOD}'), ('${MOD2}');
  -- Ohne Anmeldung ließe der Wächter (Schema 66) Zeilen echter Konten nicht zu.
  perform set_config('allmedia.wiederherstellen', 'an', true);
  insert into public.chats (id, anfrage_zustand) values ('${CHAT}', 'angenommen');
  insert into public.chat_members (chat_id, user_id) values ('${CHAT}', '${S}'), ('${CHAT}', '${R}');
  insert into public.messages (id, chat_id, sender_id, text) values
    ('${N1}', '${CHAT}', '${S}', 'probefunde drohung'),
    ('${N2}', '${CHAT}', '${S}', 'probefunde harmlos'),
    ('${N3}', '${CHAT}', '${R}', 'probefunde von R');
  insert into public.messages (id, chat_id, sender_id, text, krypto, chiffre, krypto_nonce, absender_schluessel) values
    ('${N4}', '${CHAT}', '${S}', '', 1, 'probefunde-chiffre', 'probefunde-nonce', 'probefunde-schluessel');
  insert into public.messages (id, chat_id, sender_id, text, media_url, media_type, file_name, file_size) values
    ('${N5}', '${CHAT}', '${S}', '', public.medien_adresse('messages/${S}-probefunde.jpg'), 'image', 'foto.jpg', 1000);
  insert into public.posts (id, user_id, kind, description) values ('${POST}', '${S}', 'post', 'probefunde beitrag');
  insert into public.comments (id, post_id, user_id, text) values ('${KOMM}', '${POST}', '${S}', 'probefunde kommentar');
  insert into public.communities (id, name, topic, visibility, created_by) values ('${COMM}', 'Probefunde', 'probe', 'public', '${S}');
  -- F5: Community von R mit Unterthema, Nachricht und Mitgliedern.
  insert into public.communities (id, name, topic, visibility, created_by) values ('${COMM2}', 'Probefunde Zwei', 'probe', 'public', '${R}');
  insert into public.community_members (community_id, user_id) values ('${COMM2}', '${R}'), ('${COMM2}', '${E}') on conflict do nothing;
  insert into public.community_channels (id, community_id, slug, name) values ('${KANAL}', '${COMM2}', 'probefunde', 'Probefunde');
  insert into public.communities (id, name, topic, visibility, created_by) values ('${COMM3}', 'Probefunde Drei F10', 'probe', 'public', '${R}');
  insert into public.community_channel_messages (id, channel_id, sender_id, text) values ('${KN}', '${KANAL}', '${R}', 'probefunde kanal');
  -- F11: fremde Kommentare, Antworten und Likes an R's Beiträgen.
  insert into public.posts (id, user_id, kind, description) values
    ('${P2}', '${R}', 'post', 'probefunde f11 beitrag'), ('${P3}', '${R}', 'post', 'probefunde f11 zweiter');
  insert into public.comments (id, post_id, user_id, text) values ('${K2}', '${P2}', '${E}', 'probefunde f11 von E');
  insert into public.comments (id, post_id, user_id, text, reply_to) values ('${K2A}', '${P2}', '${S}', 'probefunde f11 antwort S', '${K2}');
  insert into public.comments (id, post_id, user_id, text) values ('${K3}', '${P3}', '${R}', 'probefunde f11 wurzel R');
  insert into public.comments (id, post_id, user_id, text, reply_to) values ('${K4}', '${P3}', '${E}', 'probefunde f11 antwort E', '${K3}');
  insert into public.post_likes (post_id, user_id) values ('${P2}', '${E}');
  insert into public.comment_likes (comment_id, user_id) values ('${K2}', '${S}'), ('${K4}', '${S}');
  perform set_config('allmedia.wiederherstellen', '', true);
`)}

${als(E, `
  -- Eltern-Einwilligung wie App und Website: mit Fassung der gezeigten Texte (F12).
  ${merke('k_freigabe', `public.einwilligung_entscheiden('${K}', true, '${JSON.stringify(require('../../gemeinsam/einwilligung').elternFassungen())}'::jsonb) ->> 'ok'`)}
`)}
${eigner(`
  ${merke('k_eltern', `(select count(*) from public.einwilligungen where user_id = '${K}' and art = 'eltern' and durch = '${E}')`)}
`)}
${als(R, `
  j := public.inhalt_melden('message', '${N1}'::uuid, 'gewalt_drohung', 'Er droht mir in der Nachricht mit Gewalt.', true, '{"text":"probefunde drohung"}'::jsonb);
  ${merke('melden_ok', "j ->> 'ok'")}
  perform set_config('probe.m1', j ->> 'id', true);
`)}
${als(MOD, `
  ${merke('entscheiden', `public.meldung_entscheiden(${idVon('m1')}, 'entfernen_sperren', '${BEGR}', 'gesetz', 7, null, true) ->> 'ok'`)}
`)}
${eigner(`
  ${merke('n1_geleert', `(select count(*) from public.messages where id = '${N1}' and deleted_at is not null and text = '')`)}
  ${merke('s_gesperrt', `public.gesperrt('${S}', 'alles')`)}
`)}

${als(S, `
  -- F3: Auskunft und Sperre verraten die zurückgestellte Begründung nicht.
  j := public.meine_daten();
  ${merke('daten_entsch_vorher', "jsonb_array_length(coalesce(j -> 'entscheidungen_ueber_mich', '[]'::jsonb))")}
  ${merke('daten_begr_vorher', "(j::text like '%241 StGB%')")}
  ${merke('daten_einwilligungen', "jsonb_array_length(coalesce(j -> 'einwilligungen', '[]'::jsonb))")}
  ${merke('bann_begr_vorher', "(select count(*) from public.profile_bans where grund like '%241%' or grund like '%Drohung%')")}
  ${merke('bann_sichtbar', "(select count(*) from public.profile_bans where not aufgehoben)")}
  ${merke('bann_neutral', "(select count(*) from public.profile_bans where grund like '%Begründung bekommst du gesondert%')")}
  ${merke('mich_vorher', '(select count(*) from public.mich_betreffende_entscheidungen())')}
  ${merke('widerspruch_vorher', `public.entscheidung_widersprechen(${idVon('m1')}, 'Ich habe niemandem gedroht, das ist ein Missverständnis.') ->> 'grund'`)}

  -- F2: moderativ entfernte Nachricht zurückholen.
  ${versuch('n1_zurueck', `update public.messages set deleted_at = null, text = 'probefunde drohung' where id = '${N1}'`)}
  ${versuch('n1_nur_text', `update public.messages set text = 'probefunde drohung' where id = '${N1}'`)}
  ${versuch('n1_marke', `update public.messages set moderiert_am = null where id = '${N1}'`)}
  -- Gesperrt: eigene Inhalte ändern.
  ${versuch('n2_bearbeiten', `update public.messages set text = 'probefunde neu beleidigend', edited_at = now() where id = '${N2}'`)}
  ${versuch('post_bearbeiten', `update public.posts set description = 'probefunde beleidigend' where id = '${POST}'`)}
  ${versuch('komm_bearbeiten', `update public.comments set text = 'probefunde beleidigend' where id = '${KOMM}'`)}
  ${versuch('comm_bearbeiten', `update public.communities set bio = 'probefunde beleidigend' where id = '${COMM}'`)}
  ${versuch('neu_einfuegen', `insert into public.messages (id, chat_id, sender_id, text, moderiert_am) values (gen_random_uuid(), '${CHAT}', '${S}', 'x', now())`)}
`)}
${eigner(`
  ${merke('n1_text_danach', `(select text = '' and deleted_at is not null from public.messages where id = '${N1}')`)}
  ${merke('n2_text_danach', `(select text from public.messages where id = '${N2}')`)}
  ${merke('post_danach', `(select description from public.posts where id = '${POST}')`)}
  ${merke('komm_danach', `(select text from public.comments where id = '${KOMM}')`)}
  ${merke('comm_danach', `(select coalesce(bio, '') from public.communities where id = '${COMM}')`)}
`)}
${als(R, `
  -- Normaler Weg: nicht gesperrt, eigene Nachricht bearbeiten; als Empfänger gelesen markieren.
  ${versuch('r_bearbeiten', `update public.messages set text = 'probefunde von R bearbeitet', edited_at = now() where id = '${N3}' and sender_id = '${R}'`)}
  ${versuch('r_gelesen', `perform public.chat_gelesen('${CHAT}')`)}
`)}
${eigner(`
  ${merke('r_text', `(select text from public.messages where id = '${N3}')`)}
  ${merke('n1_gelesen', `(select (read_at is not null) from public.messages where id = '${N2}')`)}
`)}

${als(MOD2, `
  ${merke('nachsenden', `public.begruendung_nachsenden(${idVon('m1')}) ->> 'ok'`)}
`)}
${als(S, `
  j := public.meine_daten();
  ${merke('daten_entsch_nachher', "jsonb_array_length(coalesce(j -> 'entscheidungen_ueber_mich', '[]'::jsonb))")}
  ${merke('daten_begr_nachher', "(j -> 'entscheidungen_ueber_mich')::text like '%241 StGB%'")}
  ${merke('bann_begr_nachher', "(select count(*) from public.profile_bans where grund like '%241%')")}
  ${merke('mich_nachher', '(select count(*) from public.mich_betreffende_entscheidungen())')}
  j := public.entscheidung_widersprechen(${idVon('m1')}, 'Ich habe niemandem gedroht, das ist ein Missverständnis.');
  ${merke('widerspruch_nachher', "j ->> 'ok'")}
  perform set_config('probe.b1', j ->> 'id', true);
  -- Zurücknehmen der eigenen Nachricht bleibt auch gesperrt erlaubt.
  ${versuch('n5_zuruecknehmen', `update public.messages set deleted_at = now(), text = '', krypto = 0, chiffre = null, krypto_nonce = null, absender_schluessel = null, media_url = null, media_type = null, file_name = null, file_size = null where id = '${N5}'`)}
  ${versuch('n5_nur_alt', `update public.messages set deleted_at = now(), text = '' where id = '${N5}' and media_url is not null`)}
  -- F8: Selbstmeldung über den direkten INSERT (alter Client).
  ${versuch('selbst_direkt', `insert into public.reports (reported_by, target_type, target_id, reason) values ('${S}', 'post', '${POST}', '[gewalt_drohung] probe')`)}
  ${versuch('n2_zuruecknehmen', `update public.messages set deleted_at = now(), text = '', krypto = 0, chiffre = null, krypto_nonce = null, absender_schluessel = null where id = '${N2}'`)}
`)}
${eigner(`
  ${halte('b1', `(select id from public.beschwerden where meldung_id = ${idVon('m1')} and von = '${S}')`)};
`)}
${als(MOD2, `
  ${merke('aufheben', `public.beschwerde_entscheiden(${idVon('b1')}, 'aufgehoben', 'Die Nachricht war ein Zitat aus einem Film, keine Drohung.') ->> 'ok'`)}
`)}
${eigner(`
  ${merke('n1_wieder', `(select text from public.messages where id = '${N1}')`)}
  ${merke('n1_marke_weg', `(select (to_jsonb(m) ->> 'moderiert_am') is null from public.messages m where m.id = '${N1}')`)}
  ${merke('s_frei', `not public.gesperrt('${S}', 'alles')`)}
`)}
${als(S, `
  ${versuch('n1_bearbeiten_wieder', `update public.messages set text = 'probefunde zitat', edited_at = now() where id = '${N1}'`)}
`)}

-- F7: verschlüsselte Nachricht moderativ entfernen und wiederherstellen.
${als(R, `
  j := public.inhalt_melden('message', '${N4}'::uuid, 'gewalt_drohung', 'Auch diese Nachricht droht mir.', true, '{"text":"probefunde verschluesselt"}'::jsonb);
  ${merke('f7_melden', "j ->> 'ok'")}
  perform set_config('probe.m4', j ->> 'id', true);
  -- F8 normal: fremden Beitrag per direktem INSERT melden geht weiter.
  ${versuch('r_direkt', `insert into public.reports (reported_by, target_type, target_id, reason) values ('${R}', 'post', '${POST}', '[betrug_spam] probe')`)}
`)}
${als(MOD, `
  ${merke('f7_entscheiden', `public.meldung_entscheiden(${idVon('m4')}, 'entfernen', 'Drohung (§ 241 StGB).', 'gesetz', null, null, false) ->> 'ok'`)}
`)}
${eigner(`
  ${merke('f7_leer', `(select krypto = 0 and chiffre is null and text = '' and deleted_at is not null from public.messages where id = '${N4}')`)}
`)}
${als(S, `
  j := public.entscheidung_widersprechen(${idVon('m4')}, 'Das war ein Zitat, keine Drohung, bitte prüfen.');
  ${merke('f7_widerspruch', "j ->> 'ok'")}
`)}
${eigner(`
  ${halte('b4', `(select id from public.beschwerden where meldung_id = ${idVon('m4')} and von = '${S}')`)};
`)}
${als(MOD2, `
  ${merke('f7_aufheben', `public.beschwerde_entscheiden(${idVon('b4')}, 'aufgehoben', 'Zitat, keine Drohung.') ->> 'ok'`)}
`)}
${eigner(`
  ${merke('f7_wieder', `(select krypto = 1 and chiffre = 'probefunde-chiffre' and absender_schluessel = 'probefunde-schluessel' and deleted_at is null from public.messages where id = '${N4}')`)}
`)}

-- F5: Community entfernen blendet aus, Widerspruch bringt alles zurück.
${als(S, `
  j := public.inhalt_melden('community', '${COMM2}'::uuid, 'hass', 'Diese Community hetzt gegen eine Gruppe.', true, '{"name":"Probefunde Zwei"}'::jsonb);
  ${merke('f5_melden', "coalesce(j ->> 'grund', j ->> 'ok')")}
  perform set_config('probe.m5', j ->> 'id', true);
`)}
${als(MOD, `
  j := public.meldung_entscheiden(${idVon('m5')}, 'entfernen', 'Hetze gegen eine Gruppe (Richtlinie 3).', 'regeln', null, null, false); ${merke('f5_entscheiden', "coalesce(j ->> 'grund', j ->> 'ok')")}
`)}
${eigner(`
  ${merke('f5_bestand', `(select count(*) from public.communities where id = '${COMM2}' and moderiert_am is not null) || '/' || (select count(*) from public.community_channels where community_id = '${COMM2}') || '/' || (select count(*) from public.community_channel_messages where id = '${KN}') || '/' || (select count(*) from public.community_members where community_id = '${COMM2}')`)}
`)}
${als(E, `
  ${merke('f5_mitglied_sieht', `(select count(*) from public.communities where id = '${COMM2}') || '/' || (select count(*) from public.community_channels where community_id = '${COMM2}') || '/' || (select count(*) from public.community_channel_messages where id = '${KN}') || '/' || (select count(*) from public.community_members where community_id = '${COMM2}')`)}
  ${versuch('f5_mitglied_schreibt', `insert into public.community_channel_messages (channel_id, sender_id, text) values ('${KANAL}', '${E}', 'probefunde trotzdem')`)}
`)}
${als(R, `
  ${merke('f5_ersteller_sieht', `(select count(*) from public.communities where id = '${COMM2}')`)}
  ${versuch('f5_marke_weg', `update public.communities set moderiert_am = null where id = '${COMM2}'`)}
  ${versuch('f5_neu_mit_marke', `insert into public.communities (name, topic, visibility, created_by, moderiert_am) values ('Probefunde Drei', 'probe', 'public', '${R}', now())`)}
  ${merke('f5_liste', `(select count(*) from public.communities where created_by = '${R}')`)}
  j := public.entscheidung_widersprechen(${idVon('m5')}, 'Wir hetzen nicht, das war eine Diskussion.');
  ${merke('f5_widerspruch', "coalesce(j ->> 'grund', j ->> 'ok')")}
`)}
${eigner(`
  ${halte('b5', `(select id from public.beschwerden where meldung_id = ${idVon('m5')} and von = '${R}')`)};
`)}
${als(MOD, `
  ${versuch('f5_frist_loeschen', `perform public.community_entfernte_loeschen()`)}
`)}
${eigner(`
  ${merke('f5_noch_da', `(select count(*) from public.communities where id = '${COMM2}')`)}
`)}
${als(MOD2, `
  if current_setting('probe.b5', true) <> '' then
  ${merke('f5_aufheben', `public.beschwerde_entscheiden(${idVon('b5')}, 'aufgehoben', 'Kontroverse Diskussion, keine Hetze.') ->> 'ok'`)}
  end if;
`)}
${als(E, `
  ${merke('f5_wieder', `(select count(*) from public.communities where id = '${COMM2}') || '/' || (select count(*) from public.community_channels where community_id = '${COMM2}') || '/' || (select count(*) from public.community_channel_messages where id = '${KN}') || '/' || (select count(*) from public.community_members where community_id = '${COMM2}')`)}
  ${versuch('f5_wieder_schreiben', `insert into public.community_channel_messages (channel_id, sender_id, text) values ('${KANAL}', '${E}', 'probefunde wieder')`)}
`)}

-- F10: Endgültiges Löschen erst nach voller Frist ab Mitteilung.
${als(S, `
  j := public.inhalt_melden('community', '${COMM3}'::uuid, 'gewalt_drohung', 'Hier wird mit Gewalt gedroht.', true, '{"name":"Probefunde Drei F10"}'::jsonb);
  perform set_config('probe.m6', j ->> 'id', true);
`)}
${als(MOD, `
  j := public.meldung_entscheiden(${idVon('m6')}, 'entfernen', 'Drohung (§ 241 StGB).', 'gesetz', null, null, true);
  ${merke('f10_entscheiden', "coalesce(j ->> 'grund', j ->> 'ok')")}
`)}
${eigner(`
  -- Sieben Monate später, Begründung noch zurückgestellt.
  update public.communities set moderiert_am = now() - interval '7 months' where id = '${COMM3}';
  update public.reports set entschieden_am = now() - interval '7 months' where id = ${idVon('m6')};
`)}
${als(MOD, `
  perform public.community_entfernte_loeschen();
`)}
${eigner(`
  ${merke('f10_zurueckgestellt_da', `(select count(*) from public.communities where id = '${COMM3}')`)}
`)}
${als(MOD2, `
  ${merke('f10_nachsenden', `public.begruendung_nachsenden(${idVon('m6')}) ->> 'ok'`)}
`)}
${als(MOD, `
  perform public.community_entfernte_loeschen();
`)}
${eigner(`
  ${merke('f10_nach_mitteilung_da', `(select count(*) from public.communities where id = '${COMM3}')`)}
  update public.reports set entschieden_am = now() - interval '7 months' where id = ${idVon('m6')};
`)}
${als(MOD, `
  ${merke('f10_frist_um', 'public.community_entfernte_loeschen()')}
`)}
${eigner(`
  ${merke('f10_weg', `(select count(*) from public.communities where id = '${COMM3}')`)}
`)}

-- F11: Beitrag und Kommentar ausblenden statt löschen.
${als(E, `
  ${merke('f11_e_vorher', `(select count(*) from public.posts where id = '${P2}') || '/' || (select count(*) from public.comments where post_id = '${P2}') || '/' || (select count(*) from public.comments where post_id = '${P3}')`)}
`)}
${als(S, `
  j := public.inhalt_melden('post', '${P2}'::uuid, 'hass', 'Der Beitrag hetzt gegen eine Gruppe.', true, '{"text":"probefunde f11 beitrag"}'::jsonb);
  ${merke('f11_melden', "coalesce(j ->> 'grund', j ->> 'ok')")}
  perform set_config('probe.m7', j ->> 'id', true);
  j := public.inhalt_melden('comment', '${K3}'::uuid, 'hass', 'Der Kommentar hetzt gegen eine Gruppe.', true, '{"text":"probefunde f11 wurzel R"}'::jsonb);
  ${merke('f11k_melden', "coalesce(j ->> 'grund', j ->> 'ok')")}
  perform set_config('probe.m8', j ->> 'id', true);
`)}
${als(MOD, `
  j := public.meldung_entscheiden(${idVon('m7')}, 'entfernen', 'Hetze gegen eine Gruppe (Richtlinie 3).', 'regeln', null, null, false);
  ${merke('f11_entscheiden', "coalesce(j ->> 'grund', j ->> 'ok')")}
  j := public.meldung_entscheiden(${idVon('m8')}, 'entfernen', 'Hetze gegen eine Gruppe (Richtlinie 3).', 'regeln', null, null, false);
  ${merke('f11k_entscheiden', "coalesce(j ->> 'grund', j ->> 'ok')")}
`)}
${eigner(`
  ${merke('f11_bestand', `(select count(*) from public.posts where id = '${P2}' and moderiert_am is not null) || '/' || (select count(*) from public.comments where post_id = '${P2}') || '/' || (select count(*) from public.post_likes where post_id = '${P2}') || '/' || (select count(*) from public.comment_likes where comment_id = '${K2}')`)}
  ${merke('f11k_bestand', `(select count(*) from public.comments where id = '${K3}' and moderiert_am is not null) || '/' || (select count(*) from public.comments where post_id = '${P3}') || '/' || (select count(*) from public.comment_likes where comment_id = '${K4}')`)}
`)}
${als(E, `
  ${merke('f11_e_sieht', `(select count(*) from public.posts where id = '${P2}') || '/' || (select count(*) from public.comments where post_id = '${P2}') || '/' || (select count(*) from public.posts where id = '${P3}') || '/' || (select count(*) from public.comments where post_id = '${P3}')`)}
  ${versuch('f11_e_kommentiert', `insert into public.comments (post_id, user_id, text) values ('${P2}', '${E}', 'probefunde trotzdem')`)}
  ${versuch('f11_e_liked', `insert into public.post_likes (post_id, user_id) values ('${P2}', '${E}') on conflict do nothing`)}
  ${versuch('f11_e_merkt', `insert into public.saves (post_id, user_id) values ('${P2}', '${E}')`)}
  ${versuch('f11k_e_antwortet', `insert into public.comments (post_id, user_id, text, reply_to) values ('${P3}', '${E}', 'probefunde antwort trotzdem', '${K3}')`)}
  ${versuch('f11k_e_liked', `insert into public.comment_likes (comment_id, user_id) values ('${K3}', '${E}')`)}
  ${versuch('f11_e_eigenen_aendern', `update public.comments set text = 'probefunde geändert' where id = '${K2}'`)}
  -- Normal: am anderen Beitrag weiter kommentieren.
  ${versuch('f11_e_normal', `insert into public.comments (post_id, user_id, text) values ('${P3}', '${E}', 'probefunde f11 normal')`)}
`)}
${als(R, `
  ${merke('f11_r_sieht', `(select count(*) from public.posts where id = '${P2}') || '/' || (select count(*) from public.comments where id = '${K3}')`)}
  ${versuch('f11_r_marke_weg', `update public.posts set moderiert_am = null where id = '${P2}'`)}
  ${versuch('f11_r_loescht', `delete from public.posts where id = '${P2}'`)}
  ${versuch('f11k_r_marke_weg', `update public.comments set moderiert_am = null where id = '${K3}'`)}
  ${versuch('f11k_r_loescht', `delete from public.comments where id = '${K3}'`)}
  ${versuch('f11_r_neu_mit_marke', `insert into public.posts (user_id, kind, description, moderiert_am) values ('${R}', 'post', 'probefunde marke', now())`)}
  j := public.entscheidung_widersprechen(${idVon('m7')}, 'Das war keine Hetze, sondern ein Zitat.');
  ${merke('f11_widerspruch', "coalesce(j ->> 'grund', j ->> 'ok')")}
  j := public.entscheidung_widersprechen(${idVon('m8')}, 'Das war keine Hetze, sondern ein Zitat.');
  ${merke('f11k_widerspruch', "coalesce(j ->> 'grund', j ->> 'ok')")}
`)}
${eigner(`
  ${merke('f11_noch_da', `(select count(*) from public.posts where id = '${P2}') || '/' || (select count(*) from public.comments where id = '${K3}')`)}
  ${halte('b7', `(select id from public.beschwerden where meldung_id = ${idVon('m7')} and von = '${R}')`)};
  ${halte('b8', `(select id from public.beschwerden where meldung_id = ${idVon('m8')} and von = '${R}')`)};
`)}
${als(MOD, `
  ${versuch('f11_frist_loeschen', `perform public.beitraege_entfernte_loeschen()`)}
`)}
${eigner(`
  ${merke('f11_frist_da', `(select count(*) from public.posts where id = '${P2}') || '/' || (select count(*) from public.comments where id = '${K3}')`)}
`)}
${als(MOD2, `
  if current_setting('probe.b7', true) <> '' then
  ${merke('f11_aufheben', `public.beschwerde_entscheiden(${idVon('b7')}, 'aufgehoben', 'Zitat in kritischem Zusammenhang, keine Hetze.') ->> 'ok'`)}
  end if;
  if current_setting('probe.b8', true) <> '' then
  ${merke('f11k_aufheben', `public.beschwerde_entscheiden(${idVon('b8')}, 'aufgehoben', 'Zitat in kritischem Zusammenhang, keine Hetze.') ->> 'ok'`)}
  end if;
`)}
${als(E, `
  ${merke('f11_e_wieder', `(select count(*) from public.posts where id = '${P2}') || '/' || (select count(*) from public.comments where post_id = '${P2}') || '/' || (select count(*) from public.post_likes where post_id = '${P2}') || '/' || (select count(*) from public.comment_likes where comment_id = '${K2}')`)}
  ${merke('f11k_e_wieder', `(select count(*) from public.comments where id in ('${K3}', '${K4}')) || '/' || (select count(*) from public.comment_likes where comment_id = '${K4}')`)}
  ${versuch('f11_e_wieder_kommentiert', `insert into public.comments (post_id, user_id, text) values ('${P2}', '${E}', 'probefunde wieder')`)}
`)}
${eigner(`
  ${merke('f11_mitteilung_cascade', `(select count(*) from public.notifications where user_id = '${R}' and coalesce(text, '') like '%kommen nicht zurück%')`)}
`)}
${eigner(`
  -- Fristlöschen nach sieben Monaten: P3-Kommentar erneut entfernen lassen.
  update public.comments set moderiert_am = now() - interval '7 months' where id = '${K2A}';
  -- meldung_vorbelegen setzt Stand und Kategorie beim Einfügen selbst; danach als entschieden markieren.
  insert into public.reports (id, reported_by, target_type, target_id, reason)
  values ('${id('0e9')}', '${E}', 'comment', '${K2A}', '[hass] probe');
  update public.reports set status = 'entschieden', massnahme = 'entfernen', entschieden_am = now() - interval '7 months'
   where id = '${id('0e9')}';
`)}
${als(MOD, `
  ${merke('f11_frist_um', 'public.beitraege_entfernte_loeschen()')}
`)}
${eigner(`
  ${merke('f11_frist_weg', `(select count(*) from public.comments where id = '${K2A}') || '/' || (select count(*) from public.comments where id = '${K2}')`)}
`)}

-- F1: Elternteil löscht sein Konto.
${eigner(`
  create function pg_temp.probe_loeschsperre() returns trigger language plpgsql as $t$
  begin
    if old.id = '${X}' then raise exception 'probe: Löschen scheitert' using errcode = 'P0001'; end if;
    return old;
  end $t$;
  create trigger probe_loeschsperre before delete on public.profiles
    for each row execute function pg_temp.probe_loeschsperre();
`)}
${als(X, `
  ${versuch('x_probe', `j := public.konto_loeschen_probe(); ${halte('x_probe_erg', "coalesce(j ->> 'grund', j ->> 'ok')")}`)}
`)}
${eigner(`
  ${merke('x_probe_erg', "current_setting('probe.x_probe_erg', true)")}
  ${merke('x_noch_da', `(select count(*) from auth.users where id = '${X}') + (select count(*) from public.profiles where id = '${X}')`)}
  drop trigger probe_loeschsperre on public.profiles;
`)}
${als(E, `
  ${versuch('e_probe', `j := public.konto_loeschen_probe(); ${halte('e_probe_erg', "j ->> 'ok'")}`)}
`)}
${eigner(`
  ${merke('e_probe_erg', "current_setting('probe.e_probe_erg', true)")}
  ${merke('e_nach_probe', `(select count(*) from auth.users where id = '${E}')`)}
`)}
${als(E, `
  ${versuch('e_loeschen', `j := public.konto_loeschen('LOESCHEN'); ${halte('e_loeschen_erg', "coalesce(j ->> 'grund', j ->> 'ok')")}`)}
`)}
${eigner(`
  ${merke('e_loeschen_erg', "current_setting('probe.e_loeschen_erg', true)")}
  ${merke('e_weg', `(select count(*) from auth.users where id = '${E}')`)}
  ${merke('k_eltern_null', `(select count(*) from public.einwilligungen where user_id = '${K}' and art = 'eltern' and durch is null)`)}
  ${versuch('durch_direkt', `update public.einwilligungen set durch = null where user_id = '${K}' and art <> 'eltern'`)}
  ${versuch('am_aendern', `update public.einwilligungen set am = now() where user_id = '${K}' and art = 'eltern'`)}
  ${versuch('beides', `update public.einwilligungen set durch = null, version = version where user_id = '${K}' and art <> 'eltern'`)}
`)}
${als(K, `
  ${versuch('k_loeschen', `j := public.konto_loeschen('LOESCHEN'); ${halte('k_loeschen_erg', "coalesce(j ->> 'grund', j ->> 'ok')")}`)}
`)}
${eigner(`
  ${merke('k_loeschen_erg', "current_setting('probe.k_loeschen_erg', true)")}
  ${merke('k_weg', `(select count(*) from auth.users where id = '${K}') + (select count(*) from public.einwilligungen where user_id = '${K}')`)}
  ${merke('anon_probe', "case when to_regprocedure('public.konto_loeschen_probe()') is null then 'fehlt' else has_function_privilege('anon', 'public.konto_loeschen_probe()', 'execute')::text end")}
  ${merke('spalte_marke_fest', "exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'moderiert_am')")}
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

  console.log('\n0. Aufbau');
  pruefe('Eltern-Einwilligung des Kindes mit durch = E', e.k_eltern === '3', e.k_eltern);
  pruefe('gemeldet', e.melden_ok === 'true', e.melden_ok);
  pruefe('entfernt + gesperrt, Begründung zurückgestellt', e.entscheiden === 'true' && e.n1_geleert === '1' && e.s_gesperrt === 'true', `${e.entscheiden}/${e.n1_geleert}/${e.s_gesperrt}`);

  console.log('\nF3. Zurückgestellte Begründung');
  pruefe('meine_daten(): Entscheidung fehlt noch', e.daten_entsch_vorher === '0', e.daten_entsch_vorher);
  pruefe('meine_daten(): Begründung nirgends', e.daten_begr_vorher === 'false', e.daten_begr_vorher);
  pruefe('Sperre sichtbar, Grund nur neutral', e.bann_sichtbar === '1' && e.bann_begr_vorher === '0' && e.bann_neutral === '1', `${e.bann_sichtbar}/${e.bann_begr_vorher}/${e.bann_neutral}`);
  pruefe('Kontostatus nennt sie nicht', e.mich_vorher === '0', e.mich_vorher);
  pruefe('Widerspruch mit geratener ID abgewiesen', e.widerspruch_vorher === 'meldung', e.widerspruch_vorher);
  pruefe('meine_daten() enthält die Einwilligungen', Number(e.daten_einwilligungen) >= 3, e.daten_einwilligungen);
  pruefe('nachgesandt', e.nachsenden === 'true', e.nachsenden);
  pruefe('danach in meine_daten() mit Begründung', e.daten_entsch_nachher === '1' && e.daten_begr_nachher === 'true', `${e.daten_entsch_nachher}/${e.daten_begr_nachher}`);
  pruefe('danach Begründung an der Sperre', e.bann_begr_nachher === '1', e.bann_begr_nachher);
  pruefe('danach im Kontostatus, Widerspruch möglich', e.mich_nachher === '1' && e.widerspruch_nachher === 'true', `${e.mich_nachher}/${e.widerspruch_nachher}`);

  console.log('\nF2. Moderativ entfernt bleibt entfernt, Sperre wirkt aufs Ändern');
  pruefe('Absender holt Text + deleted_at nicht zurück', zu('n1_zurueck'), e.n1_zurueck);
  pruefe('Absender setzt nur den Text nicht', zu('n1_nur_text'), e.n1_nur_text);
  pruefe('Absender löscht die Marke nicht', zu('n1_marke'), e.n1_marke);
  pruefe('Nachricht danach weiter leer', e.n1_text_danach === 'true', e.n1_text_danach);
  pruefe('Marke beim Einfügen nicht setzbar', zu('neu_einfuegen'), e.neu_einfuegen);
  pruefe('gesperrt: andere Nachricht nicht bearbeitbar', zu('n2_bearbeiten') && e.n2_text_danach === 'probefunde_harmlos', `${e.n2_bearbeiten}/${e.n2_text_danach}`);
  pruefe('gesperrt: Beitrag nicht bearbeitbar', zu('post_bearbeiten') && e.post_danach === 'probefunde_beitrag', `${e.post_bearbeiten}/${e.post_danach}`);
  pruefe('gesperrt: Kommentar nicht bearbeitbar', zu('komm_bearbeiten') && e.komm_danach === 'probefunde_kommentar', `${e.komm_bearbeiten}/${e.komm_danach}`);
  pruefe('gesperrt: Community nicht bearbeitbar', zu('comm_bearbeiten') && e.comm_danach === '', `${e.comm_bearbeiten}/${e.comm_danach}`);
  pruefe('gesperrt: eigene Nachricht zurücknehmen geht', e.n2_zuruecknehmen === 'offen:1', e.n2_zuruecknehmen);
  pruefe('normal: R bearbeitet seine Nachricht', e.r_bearbeiten === 'offen:1' && e.r_text === 'probefunde_von_R_bearbeitet', `${e.r_bearbeiten}/${e.r_text}`);
  pruefe('normal: Empfänger markiert gelesen (Definer-Weg, trotz Sperre des Absenders)', e.r_gelesen && e.r_gelesen.startsWith('offen') && e.n1_gelesen === 'true', `${e.r_gelesen}/${e.n1_gelesen}`);
  pruefe('Widerspruch erfolgreich: Nachricht wieder da, Marke weg, Sperre aufgehoben', e.aufheben === 'true' && e.n1_wieder === 'probefunde_drohung' && e.n1_marke_weg === 'true' && e.s_frei === 'true', `${e.aufheben}/${e.n1_wieder}/${e.n1_marke_weg}/${e.s_frei}`);
  pruefe('danach bearbeitet S sie wieder', e.n1_bearbeiten_wieder === 'offen:1', e.n1_bearbeiten_wieder);

  console.log('\nF7–F9. Codex-Review 1, Runde 2');
  pruefe('F7 verschlüsselte Nachricht: Entfernen gelingt', e.f7_melden === 'true' && e.f7_entscheiden === 'true' && e.f7_leer === 'true', `${e.f7_melden}/${e.f7_entscheiden}/${e.f7_leer}`);
  pruefe('F7 nach Widerspruch: krypto, Chiffre, Schlüssel wieder da', e.f7_widerspruch === 'true' && e.f7_aufheben === 'true' && e.f7_wieder === 'true', `${e.f7_widerspruch}/${e.f7_aufheben}/${e.f7_wieder}`);
  pruefe('F8 Selbstmeldung per direktem INSERT abgewiesen', e.selbst_direkt === 'zu', e.selbst_direkt);
  pruefe('F8 normal: fremden Beitrag direkt melden geht', e.r_direkt === 'offen:1', e.r_direkt);
  pruefe('F9 gesperrt: Mediennachricht zurücknehmen geht', e.n5_zuruecknehmen === 'offen:1', e.n5_zuruecknehmen);
  pruefe('F9 gesperrt: Anhang stehen lassen geht nicht', e.n5_nur_alt === 'zu' || e.n5_nur_alt === 'offen:0', e.n5_nur_alt);

  console.log('\nF5. Community ausblenden statt löschen');
  pruefe('gemeldet und entfernt', e.f5_melden === 'true' && e.f5_entscheiden === 'true', `${e.f5_melden}/${e.f5_entscheiden}`);
  pruefe('alles bleibt in der Datenbank (Community markiert/Unterthema/Nachricht/Mitglieder)', e.f5_bestand === '1/1/1/2', e.f5_bestand);
  pruefe('Mitglied sieht nichts mehr', e.f5_mitglied_sieht === '0/0/0/0', e.f5_mitglied_sieht);
  pruefe('Mitglied schreibt nicht mehr ins Unterthema', zu('f5_mitglied_schreibt'), e.f5_mitglied_schreibt);
  pruefe('Ersteller sieht sie auch nicht', e.f5_ersteller_sieht === '0', e.f5_ersteller_sieht);
  pruefe('Ersteller nimmt die Marke nicht weg', zu('f5_marke_weg'), e.f5_marke_weg);
  pruefe('Marke beim Anlegen nicht setzbar', zu('f5_neu_mit_marke'), e.f5_neu_mit_marke);
  pruefe('Fristlöschen lässt sie innerhalb der Frist stehen', String(e.f5_frist_loeschen).startsWith('offen') && e.f5_noch_da === '1', `${e.f5_frist_loeschen}/${e.f5_noch_da}`);
  pruefe('Widerspruch erfolgreich: Community, Unterthema, Nachricht, Mitglieder wieder da', e.f5_widerspruch === 'true' && e.f5_aufheben === 'true' && e.f5_wieder === '1/1/1/2', `${e.f5_widerspruch}/${e.f5_aufheben}/${e.f5_wieder}`);
  pruefe('danach schreibt das Mitglied wieder', e.f5_wieder_schreiben === 'offen:1', e.f5_wieder_schreiben);

  console.log('\nF10. Endgültig löschen erst nach voller Frist ab Mitteilung');
  pruefe('entfernt mit zurückgestellter Begründung', e.f10_entscheiden === 'true', e.f10_entscheiden);
  pruefe('7 Monate ausgeblendet, Begründung zurückgestellt → bleibt', e.f10_zurueckgestellt_da === '1', e.f10_zurueckgestellt_da);
  pruefe('Begründung gerade nachgesandt → bleibt (Frist beginnt jetzt)', e.f10_nachsenden === 'true' && e.f10_nach_mitteilung_da === '1', `${e.f10_nachsenden}/${e.f10_nach_mitteilung_da}`);
  pruefe('Frist ab Mitteilung abgelaufen, kein Widerspruch → endgültig gelöscht', e.f10_frist_um >= '1' && e.f10_weg === '0', `${e.f10_frist_um}/${e.f10_weg}`);

  console.log('\nF11. Beitrag/Kommentar ausblenden statt löschen');
  pruefe('vorher sieht E Beitrag und alle Kommentare', e.f11_e_vorher === '1/2/2', e.f11_e_vorher);
  pruefe('Beitrag und Kommentar gemeldet und entfernt', e.f11_melden === 'true' && e.f11_entscheiden === 'true' && e.f11k_melden === 'true' && e.f11k_entscheiden === 'true', `${e.f11_melden}/${e.f11_entscheiden}/${e.f11k_melden}/${e.f11k_entscheiden}`);
  pruefe('Beitrag: alles bleibt (markiert/Kommentare/Like/Kommentar-Like)', e.f11_bestand === '1/2/1/1', e.f11_bestand);
  pruefe('Kommentar: alles bleibt (markiert/Kommentare am Beitrag/Antwort-Like)', e.f11k_bestand === '1/2/1', e.f11k_bestand);
  pruefe('E sieht Beitrag, Kommentare, ausgeblendete Wurzel und Antwort nicht mehr', e.f11_e_sieht === '0/0/1/0', e.f11_e_sieht);
  pruefe('E kommentiert, liked, merkt den ausgeblendeten Beitrag nicht', zu('f11_e_kommentiert') && zu('f11_e_liked') && zu('f11_e_merkt'), `${e.f11_e_kommentiert}/${e.f11_e_liked}/${e.f11_e_merkt}`);
  pruefe('E antwortet auf / liked den ausgeblendeten Kommentar nicht', zu('f11k_e_antwortet') && zu('f11k_e_liked'), `${e.f11k_e_antwortet}/${e.f11k_e_liked}`);
  pruefe('E ändert eigenen Kommentar am ausgeblendeten Beitrag nicht', zu('f11_e_eigenen_aendern'), e.f11_e_eigenen_aendern);
  pruefe('normal: E kommentiert anderen Beitrag', e.f11_e_normal === 'offen:1', e.f11_e_normal);
  pruefe('Verfasser sieht beides nicht', e.f11_r_sieht === '0/0', e.f11_r_sieht);
  pruefe('Verfasser nimmt Marke nicht weg, löscht nicht', zu('f11_r_marke_weg') && zu('f11_r_loescht') && zu('f11k_r_marke_weg') && zu('f11k_r_loescht') && e.f11_noch_da === '1/1', `${e.f11_r_marke_weg}/${e.f11_r_loescht}/${e.f11k_r_marke_weg}/${e.f11k_r_loescht}/${e.f11_noch_da}`);
  pruefe('Marke beim Anlegen nicht setzbar', zu('f11_r_neu_mit_marke'), e.f11_r_neu_mit_marke);
  pruefe('Fristlöschen lässt beides innerhalb der Frist stehen', String(e.f11_frist_loeschen).startsWith('offen') && e.f11_frist_da === '1/1', `${e.f11_frist_loeschen}/${e.f11_frist_da}`);
  pruefe('Widerspruch Beitrag: Beitrag, Kommentare, Likes wieder da', e.f11_widerspruch === 'true' && e.f11_aufheben === 'true' && e.f11_e_wieder === '1/2/1/1', `${e.f11_widerspruch}/${e.f11_aufheben}/${e.f11_e_wieder}`);
  pruefe('Widerspruch Kommentar: Wurzel, fremde Antwort, Like wieder da', e.f11k_widerspruch === 'true' && e.f11k_aufheben === 'true' && e.f11k_e_wieder === '2/1', `${e.f11k_widerspruch}/${e.f11k_aufheben}/${e.f11k_e_wieder}`);
  pruefe('danach kommentiert E wieder', e.f11_e_wieder_kommentiert === 'offen:1', e.f11_e_wieder_kommentiert);
  pruefe('Mitteilung behauptet keinen Verlust mehr', e.f11_mitteilung_cascade === '0', e.f11_mitteilung_cascade);
  pruefe('nach Frist: nur der entfernte Kommentar endgültig weg, Wurzel bleibt', Number(e.f11_frist_um) >= 1 && e.f11_frist_weg === '0/1', `${e.f11_frist_um}/${e.f11_frist_weg}`);

  console.log('\nF1. Eltern-Löschung');
  pruefe('Trockenlauf meldet den Fehler', String(e.x_probe).startsWith('offen') && e.x_probe_erg === 'datenbank', `${e.x_probe}/${e.x_probe_erg}`);
  pruefe('Trockenlauf löscht nichts', e.x_noch_da === '2', e.x_noch_da);
  pruefe('Trockenlauf beim Elternteil: ok, Konto bleibt', e.e_probe_erg === 'true' && e.e_nach_probe === '1', `${e.e_probe}/${e.e_probe_erg}/${e.e_nach_probe}`);
  pruefe('Elternteil löscht sein Konto', e.e_loeschen_erg === 'true' && e.e_weg === '0', `${e.e_loeschen}/${e.e_loeschen_erg}/${e.e_weg}`);
  pruefe('Eltern-Einwilligung bleibt, durch = null', e.k_eltern_null === '3', e.k_eltern_null);
  pruefe('durch direkt auf null: verboten', e.durch_direkt === 'zu', e.durch_direkt);
  pruefe('andere Spalte ändern: verboten', e.am_aendern === 'zu', e.am_aendern);
  pruefe('durch + andere Spalte: verboten', e.beides === 'zu', e.beides);
  pruefe('Kind löscht danach sein eigenes Konto', e.k_loeschen_erg === 'true' && e.k_weg === '0', `${e.k_loeschen}/${e.k_loeschen_erg}/${e.k_weg}`);
  pruefe('Trockenlauf nicht anonym', e.anon_probe === 'false', e.anon_probe);
  pruefe('Spalte messages.moderiert_am angelegt (nur in der Transaktion)', e.spalte_marke_fest === 'true', e.spalte_marke_fest);

  console.log(`\n${anzahl - fehler}/${anzahl} bestanden — alles zurückgerollt.`);
  process.exit(fehler ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
