#!/usr/bin/env node
/**
 * Schema 121 (Beitragsbezug fest) in einer VERWORFENEN Transaktion proben.
 *
 *   begin;
 *     Schema 119 bleibt wie live; Schema 121 komplett (ohne PROBE_LIVE=1)
 *     Probe-Beiträge von @prueflauf: sichtbar, sichtbar2, demo (unsichtbar)
 *     Probe-Chat @test + @prueflauf
 *     als @test: Like/Repost/Merken/Hinweis/Sammlung/Kommentar auf „sichtbar"
 *                anlegen, Nachricht ohne geteilten Beitrag anlegen
 *                → UPDATE des Bezugs auf „demo" muss scheitern,
 *                → UPDATE auf „sichtbar2" ebenso (Regel: Bezug unveränderlich),
 *                → danach jede Zeile als Eigentümer gegenlesen (abgelehntes
 *                  UPDATE unter RLS kann still 0 Zeilen treffen);
 *                normaler Weg: Kommentar-/Nachrichtentext ändern, Sammlung
 *                umbenennen bleibt erlaubt
 *     als Eigentümer (Management-API): Bezug ändern bleibt möglich
 *   rollback → nichts bleibt.
 *
 * Läuft nur in einer Transaktion, die verworfen wird — fasst den Testbestand
 * nicht an, braucht daher nur die Belegung `schema`, nicht `testbestand`.
 * PROBE_LIVE=1: Schema 121 nicht mitspielen (prüft den Live-Stand).
 * Start: SUPABASE_TOKEN=… node test/_probe121.js
 */
const fs = require('fs');
const path = require('path');

const P = '62616c1d-82e2-4ee4-aab9-950e40e438a4'; // @prueflauf
const T = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4'; // @test
const SICHTBAR = '12112112-0000-4000-8000-000000000001';
const SICHTBAR2 = '12112112-0000-4000-8000-000000000002';
const DEMO = '12112112-0000-4000-8000-000000000003';
const CHAT = '12112112-0000-4000-8000-0000000000c1';
const NACHRICHT = '12112112-0000-4000-8000-0000000000a1';
const KOMMENTAR = '12112112-0000-4000-8000-0000000000b1';

const schema = process.env.PROBE_LIVE ? '' :
  fs.readFileSync(path.join(__dirname, '..', '..', 'SUPABASE_SCHEMA_121_beitragsbezug_fest.sql'), 'utf8');

async function frage(sql) {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  const url = (env.match(/^EXPO_PUBLIC_SUPABASE_URL=(.*)$/m) || [])[1] || '';
  const projekt = process.env.SUPABASE_PROJEKT || url.replace(/^https:\/\//, '').split('.')[0];
  if (!process.env.SUPABASE_TOKEN || !projekt) throw new Error('SUPABASE_TOKEN/Projekt fehlt');
  const a = await fetch(`https://api.supabase.com/v1/projects/${projekt}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SUPABASE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(60000),
  });
  return a.json();
}

const als = (k) => `reset role;
select set_config('request.jwt.claims', '{"sub":"${k}","role":"authenticated"}', true),
       set_config('request.jwt.claim.sub', '${k}', true);
set local role authenticated;`;
const v = (name, sql) => `do $p$ begin ${sql}; insert into erg values ('${name}', 'ok');
  exception when others then insert into erg values ('${name}', sqlstate); end $p$;`;
const wert = (name, sql) => `insert into erg select '${name}', coalesce((${sql})::text, 'leer');`;

// Tabellen mit Regel FOR ALL bzw. UPDATE-Regel für den Besitzer.
const BEZUG = [
  ['post_likes', `insert into public.post_likes (post_id, user_id) values ('${SICHTBAR}', '${T}')`],
  ['reposts', `insert into public.reposts (post_id, user_id) values ('${SICHTBAR}', '${T}')`],
  ['saves', `insert into public.saves (post_id, user_id) values ('${SICHTBAR}', '${T}')`],
  ['post_notify', `insert into public.post_notify (post_id, user_id) values ('${SICHTBAR}', '${T}')`],
  ['sammlung_beitraege', `insert into public.sammlung_beitraege (user_id, sammlung, post_id) values ('${T}', 'Probe121', '${SICHTBAR}')`],
  ['comments', `insert into public.comments (id, post_id, user_id, text) values ('${KOMMENTAR}', '${SICHTBAR}', '${T}', 'probe')`],
];

const sql = `begin;
${schema}
create temp table erg(k text, v text) on commit drop; grant all on erg to authenticated;
insert into public.posts (id, user_id, description, demo) values
  ('${SICHTBAR}', '${P}', 'Probe 121 sichtbar', false),
  ('${SICHTBAR2}', '${P}', 'Probe 121 sichtbar 2', false),
  ('${DEMO}', '${P}', 'Probe 121 demo', true);
insert into public.chats (id, anfrage_zustand) values ('${CHAT}', 'angenommen');
insert into public.chat_members (chat_id, user_id) values ('${CHAT}', '${T}'), ('${CHAT}', '${P}');
${wert('trigger_anzahl', `select count(*) from pg_trigger where tgname = 'beitrag_bezug_fest' and not tgisinternal`)}
${als(T)}
${wert('t_sieht_demo', `select count(*) from public.posts where id = '${DEMO}'`)}
${wert('t_sieht_sichtbar', `select count(*) from public.posts where id in ('${SICHTBAR}', '${SICHTBAR2}')`)}
${BEZUG.map(([t, ins]) => v(`${t}_anlegen`, ins)).join('\n')}
${v('messages_anlegen', `insert into public.messages (id, chat_id, sender_id, text) values ('${NACHRICHT}', '${CHAT}', '${T}', 'ohne Beitrag')`)}
${BEZUG.map(([t]) => v(`${t}_auf_demo`, `update public.${t} set post_id = '${DEMO}' where user_id = '${T}' and post_id = '${SICHTBAR}'`)).join('\n')}
${BEZUG.map(([t]) => v(`${t}_auf_sichtbar2`, `update public.${t} set post_id = '${SICHTBAR2}' where user_id = '${T}' and post_id = '${SICHTBAR}'`)).join('\n')}
${v('messages_auf_demo', `update public.messages set shared_post_id = '${DEMO}' where id = '${NACHRICHT}'`)}
${v('messages_auf_sichtbar2', `update public.messages set shared_post_id = '${SICHTBAR2}' where id = '${NACHRICHT}'`)}
${v('normal_kommentar_text', `update public.comments set text = 'geaendert' where id = '${KOMMENTAR}'`)}
${v('normal_nachricht_text', `update public.messages set text = 'geaendert', edited_at = now() where id = '${NACHRICHT}'`)}
${v('normal_sammlung_umbenennen', `update public.sammlung_beitraege set sammlung = 'Probe121b' where user_id = '${T}' and sammlung = 'Probe121'`)}
${v('normal_gleicher_wert', `update public.saves set post_id = '${SICHTBAR}' where user_id = '${T}' and post_id = '${SICHTBAR}'`)}
reset role;
${BEZUG.map(([t]) => wert(`${t}_bezug`, `select string_agg(post_id::text, ',') from public.${t} where user_id = '${T}' and post_id in ('${SICHTBAR}', '${SICHTBAR2}', '${DEMO}')`)).join('\n')}
${wert('messages_bezug', `select shared_post_id from public.messages where id = '${NACHRICHT}'`)}
${wert('kommentar_text', `select text from public.comments where id = '${KOMMENTAR}'`)}
${wert('nachricht_text', `select text from public.messages where id = '${NACHRICHT}'`)}
${wert('sammlung_name', `select sammlung from public.sammlung_beitraege where user_id = '${T}' and post_id = '${SICHTBAR}'`)}
${v('eigentuemer_darf', `update public.saves set post_id = '${SICHTBAR2}' where user_id = '${T}' and post_id = '${SICHTBAR}'`)}
${wert('eigentuemer_bezug', `select string_agg(post_id::text, ',') from public.saves where user_id = '${T}' and post_id in ('${SICHTBAR}', '${SICHTBAR2}')`)}
select json_object_agg(k, v) as erg from erg;
rollback;`;

let fehler = 0, anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++; if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

(async () => {
  const r = await frage(sql);
  if (!Array.isArray(r)) { console.log('FEHLER', JSON.stringify(r).slice(0, 600)); process.exit(1); }
  const e = r[0]?.erg || {};
  console.log(JSON.stringify(e));
  pruefe('Auslöser beitrag_bezug_fest auf allen 11 Tabellen', e.trigger_anzahl === '11', e.trigger_anzahl);
  pruefe('Ausgang: @test sieht demo nicht, beide sichtbaren schon', e.t_sieht_demo === '0' && e.t_sieht_sichtbar === '2');
  for (const [t] of BEZUG) {
    pruefe(`${t}: Anlegen auf sichtbaren Beitrag`, e[`${t}_anlegen`] === 'ok', e[`${t}_anlegen`]);
    pruefe(`${t}: UPDATE auf unsichtbaren Beitrag abgewiesen`, e[`${t}_auf_demo`] !== 'ok', e[`${t}_auf_demo`]);
    pruefe(`${t}: UPDATE auf anderen sichtbaren Beitrag abgewiesen`, e[`${t}_auf_sichtbar2`] !== 'ok', e[`${t}_auf_sichtbar2`]);
    pruefe(`${t}: Zeile gegengelesen — Bezug unverändert`, e[`${t}_bezug`] === SICHTBAR, e[`${t}_bezug`]);
  }
  pruefe('messages: Nachricht ohne Beitrag anlegen', e.messages_anlegen === 'ok', e.messages_anlegen);
  pruefe('messages: shared_post_id auf unsichtbaren Beitrag abgewiesen', e.messages_auf_demo !== 'ok', e.messages_auf_demo);
  pruefe('messages: shared_post_id auf sichtbaren Beitrag abgewiesen', e.messages_auf_sichtbar2 !== 'ok', e.messages_auf_sichtbar2);
  pruefe('messages: Zeile gegengelesen — kein geteilter Beitrag', e.messages_bezug === 'leer', e.messages_bezug);
  pruefe('Normaler Weg: Kommentar bearbeiten', e.normal_kommentar_text === 'ok' && e.kommentar_text === 'geaendert',
    `${e.normal_kommentar_text}/${e.kommentar_text}`);
  pruefe('Normaler Weg: Nachricht bearbeiten', e.normal_nachricht_text === 'ok' && e.nachricht_text === 'geaendert',
    `${e.normal_nachricht_text}/${e.nachricht_text}`);
  pruefe('Normaler Weg: Sammlung umbenennen', e.normal_sammlung_umbenennen === 'ok' && e.sammlung_name === 'Probe121b',
    `${e.normal_sammlung_umbenennen}/${e.sammlung_name}`);
  pruefe('Normaler Weg: Bezug mit gleichem Wert (upsert-artig)', e.normal_gleicher_wert === 'ok', e.normal_gleicher_wert);
  pruefe('Eigentümer (Management-API) darf den Bezug ändern', e.eigentuemer_darf === 'ok' && e.eigentuemer_bezug === SICHTBAR2,
    `${e.eigentuemer_darf}/${e.eigentuemer_bezug}`);
  const rest = await frage(`select (select count(*) from public.posts where id in ('${SICHTBAR}','${SICHTBAR2}','${DEMO}'))
    + (select count(*) from public.chats where id = '${CHAT}') as n`);
  pruefe('Nichts geblieben (Rollback)', Number(rest?.[0]?.n) === 0, JSON.stringify(rest));
  console.log(`\n${anzahl - fehler}/${anzahl} Prüfungen bestanden`);
  process.exit(fehler ? 1 : 0);
})();
