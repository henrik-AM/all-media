#!/usr/bin/env node
/**
 * Schema 125 (restliche Regel-Helfer nach `intern`) in einer VERWORFENEN
 * Transaktion proben.
 *
 *   begin;
 *     als @test und @prueflauf: sichtbare Zeilen in den Tabellen zählen,
 *       deren Regeln die Helfer nutzen (VORHER)
 *     Schema 125 (ohne PROBE_LIVE=1)
 *     dieselben Zählungen (NACHHER) — müssen gleich sein
 *     als @test: Orakel per RPC-Weg (public.<f>) — weg (42883) oder verboten (42501)
 *       anfrage_erlaubt / darf_angeschrieben_werden nur fürs eigene Konto
 *       normaler Weg: Gruppe anlegen + selbst eintragen (darf_mitglied_werden),
 *       Nachricht senden (darf_schreiben, anfrage_erlaubt), Kommentar
 *       (darf_kommentieren), Markierung als Verfasser (darf_markieren)
 *     Aufbau: keine Regel ruft mehr eine gesperrte public-Fassung
 *   rollback.
 * Braucht die Belegung `schema`. Start: SUPABASE_TOKEN=… node test/_probe125.js
 */
const fs = require('fs');
const path = require('path');
require('./_ki_belegung').pruefeBelegung('schema');

const P = '62616c1d-82e2-4ee4-aab9-950e40e438a4'; // @prueflauf
const T = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4'; // @test
const ID = (x) => `12512512-0000-4000-8000-0000000000${x}`;
const POST_P = ID('01'), POST_T = ID('02'), STORY_P = ID('a1'), FREMDCHAT = ID('d1'), GRUPPE = ID('d2');
const LIVE = !!process.env.PROBE_LIVE;
const schema = LIVE ? '' :
  fs.readFileSync(path.join(__dirname, '..', '..', 'SUPABASE_SCHEMA_125_helfer_orakel_intern.sql'), 'utf8');

async function frage(sql) {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  const url = (env.match(/^EXPO_PUBLIC_SUPABASE_URL=(.*)$/m) || [])[1] || '';
  const projekt = process.env.SUPABASE_PROJEKT || url.replace(/^https:\/\//, '').split('.')[0];
  const a = await fetch(`https://api.supabase.com/v1/projects/${projekt}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SUPABASE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }), signal: AbortSignal.timeout(90000),
  });
  return a.json();
}
const als = (k) => `reset role;
select set_config('request.jwt.claims', '{"sub":"${k}","role":"authenticated"}', true),
       set_config('request.jwt.claim.sub', '${k}', true);
set local role authenticated;`;
const v = (name, sql) => `do $p$ begin ${sql}; insert into erg values ('${name}', 'ok');
  exception when others then insert into erg values ('${name}', sqlstate); end $p$;`;
const wert = (name, sql) => `do $p$ begin insert into erg select '${name}', coalesce((${sql})::text, 'leer');
  exception when others then insert into erg values ('${name}', 'FEHLER ' || sqlstate); end $p$;`;

const TABELLEN = ['posts', 'stories', 'comments', 'messages', 'communities', 'community_channel_messages',
  'presence', 'reposts', 'friend_pins', 'ptt_messages', 'profiles', 'insight_recipients', 'kontakt_bilder',
  'freundschaften', 'community_beitrittsanfragen', 'post_tags', 'story_tags', 'chat_members', 'stream_comments'];
const zaehlen = (wann, wer) => TABELLEN.map((t) =>
  wert(`${wann}_${wer}_${t}`, `select count(*) from public.${t}`)).join('\n');

const ORAKEL = [
  ['story_eigner', `public.story_eigner('${STORY_P}'::uuid)`],
  ['sichtbar_fuer', `public.sichtbar_fuer('${P}'::uuid, 'dm', '${P}'::uuid)`],
  ['blockiert_zwischen', `public.blockiert_zwischen('${T}'::uuid, '${P}'::uuid)`],
  ['ist_story_markiert', `public.ist_story_markiert('${STORY_P}'::uuid, '${P}'::uuid)`],
  ['ist_messenger_kontakt2', `public.ist_messenger_kontakt('${P}'::uuid, '${T}'::uuid)`],
  ['gesperrt', `public.gesperrt('${P}'::uuid, 'alles')`],
  ['profil_freigegeben', `public.profil_freigegeben('${P}'::uuid)`],
  ['darf_markieren', `public.darf_markieren('${POST_P}'::uuid, '${T}'::uuid, '${P}'::uuid)`],
  ['darf_story_markieren', `public.darf_story_markieren('${STORY_P}'::uuid, '${T}'::uuid, '${P}'::uuid)`],
  ['darf_kommentieren', `public.darf_kommentieren('${POST_P}'::uuid, '${P}'::uuid)`],
  ['darf_schreiben', `public.darf_schreiben('${FREMDCHAT}'::uuid, '${P}'::uuid)`],
  ['darf_mitglied_werden', `public.darf_mitglied_werden('${FREMDCHAT}'::uuid, '${P}'::uuid)`],
  ['darf_in_gruppe_holen', `public.darf_in_gruppe_holen('${P}'::uuid)`],
  ['community_ausgeblendet', `public.community_ausgeblendet('${FREMDCHAT}'::uuid)`],
  ['kanal_ausgeblendet', `public.kanal_ausgeblendet('${FREMDCHAT}'::uuid)`],
  ['kanal_antwort_erlaubt', `public.kanal_antwort_erlaubt('${FREMDCHAT}'::uuid, '${FREMDCHAT}'::uuid)`],
  ['kommentar_antwort_erlaubt', `public.kommentar_antwort_erlaubt('${POST_P}'::uuid, '${FREMDCHAT}'::uuid, null)`],
  ['live_antwort_erlaubt', `public.live_antwort_erlaubt('${POST_P}'::uuid, '${FREMDCHAT}'::uuid)`],
];

const sql = `begin;
create temp table erg(k text, v text) on commit drop; grant all on erg to authenticated;
insert into public.posts (id, user_id, description, demo) values
  ('${POST_P}', '${P}', 'Probe 125', false), ('${POST_T}', '${T}', 'Probe 125', false);
insert into public.stories (id, user_id, caption, expires_at, in_videos) values ('${STORY_P}', '${P}', 'Probe 125', now() + interval '1 day', true);
insert into public.chats (id, name, is_group, bereich, created_by) values ('${FREMDCHAT}', 'Probe 125', true, 'community', '${P}');
insert into public.chat_members (chat_id, user_id) values ('${FREMDCHAT}', '${P}');
${als(T)}
${zaehlen('vor', 't')}
${als(P)}
${zaehlen('vor', 'p')}
reset role;
${schema}
${als(P)}
${zaehlen('nach', 'p')}
${als(T)}
${zaehlen('nach', 't')}
${ORAKEL.map(([n, s]) => wert('orakel_' + n, 'select ' + s)).join('\n')}
${wert('anfrage_fremder_chat', `select public.anfrage_erlaubt('${FREMDCHAT}'::uuid, '${T}'::uuid)`)}
${wert('anfrage_fremder_absender', `select public.anfrage_erlaubt('${FREMDCHAT}'::uuid, '${P}'::uuid)`)}
${wert('dm_fremder_wer', `select public.darf_angeschrieben_werden('${T}'::uuid, '${P}'::uuid)`)}
${wert('dm_eigen', `select public.darf_angeschrieben_werden('${P}'::uuid, '${T}'::uuid)`)}
${v('gruppe_anlegen', `insert into public.chats (id, name, is_group, bereich, created_by) values ('${GRUPPE}', 'Probe 125 eigen', true, 'community', '${T}')`)}
${v('selbst_eintragen', `insert into public.chat_members (chat_id, user_id) values ('${GRUPPE}', '${T}')`)}
${wert('anfrage_eigen', `select public.anfrage_erlaubt('${GRUPPE}'::uuid, '${T}'::uuid)`)}
${v('nachricht_senden', `insert into public.messages (chat_id, sender_id, text) values ('${GRUPPE}', '${T}', 'Probe 125')`)}
${v('nachricht_fremder_chat', `insert into public.messages (chat_id, sender_id, text) values ('${FREMDCHAT}', '${T}', 'Probe 125')`)}
${v('kommentar', `insert into public.comments (post_id, user_id, text) values ('${POST_P}', '${T}', 'Probe 125')`)}
${v('markieren_eigen', `insert into public.post_tags (post_id, user_id) values ('${POST_T}', '${P}')`)}
${v('markieren_fremd', `insert into public.post_tags (post_id, user_id) values ('${POST_P}', '${T}')`)}
reset role;
${wert('regeln_public', `select count(*) from pg_policies where coalesce(qual,'') || ' ' || coalesce(with_check,'') ~ '(^|[^.[:alnum:]_])(sichtbar_fuer|blockiert_zwischen|ist_story_markiert|gesperrt|profil_freigegeben)\\('`)}
${wert('anon_intern', `select bool_or(has_function_privilege('anon', p.oid, 'execute')) from pg_proc p where p.pronamespace = 'intern'::regnamespace`)}
${wert('auth_public_gesperrt', `select bool_or(has_function_privilege('authenticated', p, 'execute')) from unnest(array['public.sichtbar_fuer(uuid,text,uuid)','public.blockiert_zwischen(uuid,uuid)','public.ist_story_markiert(uuid,uuid)','public.ist_messenger_kontakt(uuid,uuid)','public.gesperrt(uuid,text)','public.profil_freigegeben(uuid)']::regprocedure[]) p`)}
select json_object_agg(k, v) as erg from erg;
rollback;`;

let fehler = 0, anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++; if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};
(async () => {
  if (!process.env.SUPABASE_TOKEN) { console.log('SUPABASE_TOKEN fehlt'); process.exit(2); }
  const r = await frage(sql);
  if (!Array.isArray(r)) { console.log('FEHLER', JSON.stringify(r).slice(0, 1500)); process.exit(1); }
  const e = r[0]?.erg || {};
  if (LIVE) { console.log(JSON.stringify(e, null, 1)); process.exit(0); }
  for (const wer of ['t', 'p']) for (const t of TABELLEN) {
    const a = e[`vor_${wer}_${t}`], b = e[`nach_${wer}_${t}`];
    pruefe(`Sichtbarkeit unverändert: ${wer === 't' ? '@test' : '@prueflauf'} ${t}`, a === b && !/FEHLER/.test(a), `${a} → ${b}`);
  }
  for (const [n] of ORAKEL) pruefe(`Orakel ${n} per RPC nicht aufrufbar`, /^FEHLER (42883|42501)$/.test(e['orakel_' + n] || ''), e['orakel_' + n]);
  pruefe('anfrage_erlaubt: fremder Chat → false', e.anfrage_fremder_chat === 'false', e.anfrage_fremder_chat);
  pruefe('anfrage_erlaubt: fremder Absender → false', e.anfrage_fremder_absender === 'false', e.anfrage_fremder_absender);
  pruefe('darf_angeschrieben_werden: für Dritte → false', e.dm_fremder_wer === 'false', e.dm_fremder_wer);
  pruefe('darf_angeschrieben_werden: für sich selbst antwortet', ['true', 'false'].includes(e.dm_eigen), e.dm_eigen);
  pruefe('Gruppe anlegen: ok', e.gruppe_anlegen === 'ok', e.gruppe_anlegen);
  pruefe('Selbst eintragen (darf_mitglied_werden): ok', e.selbst_eintragen === 'ok', e.selbst_eintragen);
  pruefe('anfrage_erlaubt im eigenen Chat → true', e.anfrage_eigen === 'true', e.anfrage_eigen);
  pruefe('Nachricht senden (darf_schreiben): ok', e.nachricht_senden === 'ok', e.nachricht_senden);
  pruefe('Nachricht in fremden Chat: abgelehnt', e.nachricht_fremder_chat === '42501', e.nachricht_fremder_chat);
  pruefe('Kommentar (darf_kommentieren): ok', e.kommentar === 'ok', e.kommentar);
  pruefe('Markieren am eigenen Beitrag (darf_markieren): ok', e.markieren_eigen === 'ok', e.markieren_eigen);
  pruefe('Markieren am fremden Beitrag: abgelehnt', e.markieren_fremd === '42501', e.markieren_fremd);
  pruefe('Keine Regel ruft eine gesperrte public-Fassung', e.regeln_public === '0', e.regeln_public);
  pruefe('anon darf keine intern-Funktion', e.anon_intern === 'false', e.anon_intern);
  pruefe('authenticated darf die sechs public-Fassungen nicht', e.auth_public_gesperrt === 'false', e.auth_public_gesperrt);
  const rest = await frage(`select (select count(*) from public.posts where id::text like '12512512%')
    + (select count(*) from public.chats where id::text like '12512512%')
    + (select count(*) from pg_proc where pronamespace = 'intern'::regnamespace) as n`);
  pruefe('Nichts geblieben (Rollback; intern hat nur die 3 Funktionen aus 123)', Number(rest?.[0]?.n) === 3, JSON.stringify(rest));
  console.log(`\n${anzahl - fehler}/${anzahl} Prüfungen bestanden`);
  process.exit(fehler ? 1 : 0);
})();
