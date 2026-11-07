#!/usr/bin/env node
/**
 * Schema 124 (Likes/Aufrufe/Story-Antworten nur auf Sichtbares) in einer
 * VERWORFENEN Transaktion proben.
 *
 *   begin;
 *     Schema 124 (ohne PROBE_LIVE=1)
 *     als Eigentümer: Beitrag von @prueflauf sichtbar + geplant (für @test
 *       unsichtbar), je ein Kommentar daran; Storys von @prueflauf aktuell +
 *       abgelaufen, eigene Story von @test; Gruppe nur mit @test
 *     als @test: Kommentar-Like, Story-Like, Story-Aufruf, Story-Antwort —
 *       je sichtbar (ok), unbekannte UUID, unsichtbar; Bezug per UPDATE umbiegen
 *     Erwartung mit 124: unbekannt und unsichtbar geben dieselbe Antwort (42501)
 *   rollback → nichts bleibt.
 *
 * PROBE_LIVE=1: zeigt den Live-Stand (unbekannt 23503, unsichtbar ok = Orakel).
 * Braucht die Belegung `schema`. Start: SUPABASE_TOKEN=… node test/_probe124.js
 */
const fs = require('fs');
const path = require('path');
require('./_ki_belegung').pruefeBelegung('schema');

const P = '62616c1d-82e2-4ee4-aab9-950e40e438a4'; // @prueflauf
const T = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4'; // @test
const ID = (x) => `12412412-0000-4000-8000-0000000000${x}`;
const SICHTBAR = ID('01'), GEPLANT = ID('02');
const K_OK = ID('c1'), K_GEPLANT = ID('c2');
const S_OK = ID('a1'), S_ALT = ID('a2'), S_T = ID('a3');
const GRUPPE = ID('d1');
const S_HL = ID('a4'), HL = ID('e1'); // abgelaufen, aber im Highlight von @prueflauf
const UNBEKANNT = ID('ff');
const LIVE = !!process.env.PROBE_LIVE;

const schema = LIVE ? '' :
  fs.readFileSync(path.join(__dirname, '..', '..', 'SUPABASE_SCHEMA_124_nur_sichtbare_kommentare_storys.sql'), 'utf8');

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
const wert = (name, sql) => `do $p$ begin insert into erg select '${name}', coalesce((${sql})::text, 'leer');
  exception when others then insert into erg values ('${name}', 'FEHLER ' || sqlstate); end $p$;`;
// UPDATE, das genau eine Zeile treffen muss — 0 Zeilen ohne Fehler zählt als 'still'
const u = (name, sql) => `do $p$ declare n int; begin ${sql}; get diagnostics n = row_count;
  insert into erg values ('${name}', case when n = 0 then 'still' else 'ok' end);
  exception when others then insert into erg values ('${name}', sqlstate); end $p$;`;
const nachricht = (story) => `insert into public.messages (chat_id, sender_id, text, reply_to_story)
  values ('${GRUPPE}', '${T}', 'Probe 124', '${story}')`;

const sql = `begin;
${schema}
create temp table erg(k text, v text) on commit drop; grant all on erg to authenticated;
insert into public.posts (id, user_id, description, demo, publish_at) values
  ('${SICHTBAR}', '${P}', 'Probe 124 sichtbar', false, null),
  ('${GEPLANT}', '${P}', 'Probe 124 geplant', false, now() + interval '1 day');
insert into public.comments (id, post_id, user_id, text) values
  ('${K_OK}', '${SICHTBAR}', '${P}', 'Probe 124'),
  ('${K_GEPLANT}', '${GEPLANT}', '${P}', 'Probe 124');
insert into public.stories (id, user_id, caption, created_at, expires_at, in_videos, in_messenger) values
  ('${S_OK}', '${P}', 'Probe 124', now(), now() + interval '1 day', true, true),
  ('${S_ALT}', '${P}', 'Probe 124', now() - interval '3 days', now() - interval '2 days', true, true),
  ('${S_T}', '${T}', 'Probe 124', now(), now() + interval '1 day', false, true),
  ('${S_HL}', '${P}', 'Probe 124', now() - interval '3 days', now() - interval '2 days', true, true);
insert into public.sammlungen (id, user_id, art, name) values ('${HL}', '${P}', 'highlight', 'Probe 124');
insert into public.sammlung_inhalte (sammlung_id, story_id, position) values ('${HL}', '${S_HL}', 0);
insert into public.chats (id, name, is_group, bereich, created_by)
  values ('${GRUPPE}', 'Probe 124', true, 'community', '${T}');
insert into public.chat_members (chat_id, user_id) values ('${GRUPPE}', '${T}');
${als(T)}
${wert('t_sieht_kommentare', `select string_agg(id::text, ',' order by id) from public.comments where id in ('${K_OK}','${K_GEPLANT}')`)}
${wert('t_sieht_storys', `select string_agg(id::text, ',' order by id) from public.stories where id in ('${S_OK}','${S_ALT}','${S_T}','${S_HL}')`)}
${v('klike_ok', `insert into public.comment_likes (comment_id, user_id) values ('${K_OK}', '${T}')`)}
${v('klike_unbekannt', `insert into public.comment_likes (comment_id, user_id) values ('${UNBEKANNT}', '${T}')`)}
${v('klike_unsichtbar', `insert into public.comment_likes (comment_id, user_id) values ('${K_GEPLANT}', '${T}')`)}
${u('klike_umbiegen_unbekannt', `update public.comment_likes set comment_id = '${UNBEKANNT}' where comment_id = '${K_OK}' and user_id = '${T}'`)}
${u('klike_umbiegen_unsichtbar', `update public.comment_likes set comment_id = '${K_GEPLANT}' where comment_id = '${K_OK}' and user_id = '${T}'`)}
${v('slike_ok', `insert into public.story_likes (story_id, user_id) values ('${S_OK}', '${T}')`)}
${v('slike_unbekannt', `insert into public.story_likes (story_id, user_id) values ('${UNBEKANNT}', '${T}')`)}
${v('slike_unsichtbar', `insert into public.story_likes (story_id, user_id) values ('${S_ALT}', '${T}')`)}
${u('slike_umbiegen_unbekannt', `update public.story_likes set story_id = '${UNBEKANNT}' where story_id = '${S_OK}' and user_id = '${T}'`)}
${v('slike_highlight', `insert into public.story_likes (story_id, user_id) values ('${S_HL}', '${T}')`)}
${v('sview_highlight', `insert into public.story_views (story_id, user_id) values ('${S_HL}', '${T}') on conflict do nothing`)}
${v('sview_ok', `insert into public.story_views (story_id, user_id) values ('${S_OK}', '${T}') on conflict do nothing`)}
${v('sview_eigen', `insert into public.story_views (story_id, user_id) values ('${S_T}', '${T}') on conflict do nothing`)}
${v('sview_unbekannt', `insert into public.story_views (story_id, user_id) values ('${UNBEKANNT}', '${T}')`)}
${v('sview_unsichtbar', `insert into public.story_views (story_id, user_id) values ('${S_ALT}', '${T}')`)}
${u('sview_umbiegen_unbekannt', `update public.story_views set story_id = '${UNBEKANNT}' where story_id = '${S_OK}' and user_id = '${T}'`)}
${v('antwort_ok', nachricht(S_OK))}
${v('antwort_unbekannt', nachricht(UNBEKANNT))}
${v('antwort_unsichtbar', nachricht(S_ALT))}
${v('nachricht_ohne_story', `insert into public.messages (chat_id, sender_id, text) values ('${GRUPPE}', '${T}', 'Probe 124')`)}
reset role;
${wert('klikes', `select string_agg(comment_id::text, ',' order by comment_id) from public.comment_likes where user_id = '${T}' and comment_id in ('${K_OK}','${K_GEPLANT}','${UNBEKANNT}')`)}
${wert('slikes', `select string_agg(story_id::text, ',' order by story_id) from public.story_likes where user_id = '${T}' and story_id::text like '12412412%'`)}
${wert('sviews', `select string_agg(story_id::text, ',' order by story_id) from public.story_views where user_id = '${T}' and story_id::text like '12412412%'`)}
${wert('antworten', `select string_agg(coalesce(reply_to_story::text, '-'), ',' order by reply_to_story nulls first) from public.messages where chat_id = '${GRUPPE}'`)}
${wert('neue_public_funktionen', `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname ~ 'sichtbar.*(kommentar|story)'`)}
select json_object_agg(k, v) as erg from erg;
rollback;`;

let fehler = 0, anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++; if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};
const zu = (x) => x === '42501';

(async () => {
  const r = await frage(sql);
  if (!Array.isArray(r)) { console.log('FEHLER', JSON.stringify(r).slice(0, 800)); process.exit(1); }
  const e = r[0]?.erg || {};
  console.log(JSON.stringify(e));
  if (LIVE) { console.log('\nPROBE_LIVE: nur Messung, keine Bewertung.'); process.exit(0); }
  pruefe('@test sieht nur den Kommentar am sichtbaren Beitrag', e.t_sieht_kommentare === K_OK, e.t_sieht_kommentare);
  pruefe('@test sieht aktuelle fremde, eigene und Highlight-Story, nicht die abgelaufene', e.t_sieht_storys === [S_OK, S_T, S_HL].sort().join(','), e.t_sieht_storys);
  // Kommentar-Likes
  pruefe('Kommentar-Like sichtbar: ok', e.klike_ok === 'ok', e.klike_ok);
  pruefe('Kommentar-Like unbekannt: 42501 (kein 23503)', zu(e.klike_unbekannt), e.klike_unbekannt);
  pruefe('Kommentar-Like unsichtbar: 42501', zu(e.klike_unsichtbar), e.klike_unsichtbar);
  pruefe('Kommentar-Like auf unbekannt umbiegen: 42501', zu(e.klike_umbiegen_unbekannt), e.klike_umbiegen_unbekannt);
  pruefe('Kommentar-Like auf unsichtbar umbiegen: 42501', zu(e.klike_umbiegen_unsichtbar), e.klike_umbiegen_unsichtbar);
  // Story-Likes
  pruefe('Story-Like sichtbar: ok', e.slike_ok === 'ok', e.slike_ok);
  pruefe('Story-Like unbekannt: 42501', zu(e.slike_unbekannt), e.slike_unbekannt);
  pruefe('Story-Like abgelaufen: 42501', zu(e.slike_unsichtbar), e.slike_unsichtbar);
  pruefe('Story-Like umbiegen: 42501', zu(e.slike_umbiegen_unbekannt), e.slike_umbiegen_unbekannt);
  pruefe('Story-Like auf Highlight-Story: ok', e.slike_highlight === 'ok', e.slike_highlight);
  pruefe('Story-Aufruf auf Highlight-Story: ok', e.sview_highlight === 'ok', e.sview_highlight);
  // Story-Aufrufe
  pruefe('Story-Aufruf sichtbar: ok', e.sview_ok === 'ok', e.sview_ok);
  pruefe('Story-Aufruf eigene Story: ok', e.sview_eigen === 'ok', e.sview_eigen);
  pruefe('Story-Aufruf unbekannt: 42501', zu(e.sview_unbekannt), e.sview_unbekannt);
  pruefe('Story-Aufruf abgelaufen: 42501', zu(e.sview_unsichtbar), e.sview_unsichtbar);
  // UPDATE ohne Regel auf story_views: 0 Zeilen still ist auch dicht
  pruefe('Story-Aufruf umbiegen: abgelehnt oder still', zu(e.sview_umbiegen_unbekannt) || e.sview_umbiegen_unbekannt === 'still', e.sview_umbiegen_unbekannt);
  // Story-Antworten
  pruefe('Nachricht ohne Story: ok', e.nachricht_ohne_story === 'ok', e.nachricht_ohne_story);
  pruefe('Antwort auf sichtbare Story: ok', e.antwort_ok === 'ok', e.antwort_ok);
  pruefe('Antwort auf unbekannte Story: 42501', zu(e.antwort_unbekannt), e.antwort_unbekannt);
  pruefe('Antwort auf abgelaufene Story: 42501', zu(e.antwort_unsichtbar), e.antwort_unsichtbar);
  // Gegenlesen als Eigentümer
  pruefe('Gegengelesen: Kommentar-Like nur am sichtbaren', e.klikes === K_OK, e.klikes);
  pruefe('Gegengelesen: Story-Likes nur an sichtbarer + Highlight', e.slikes === [S_OK, S_HL].sort().join(','), e.slikes);
  pruefe('Gegengelesen: Aufrufe nur sichtbar, eigen, Highlight', e.sviews === [S_OK, S_T, S_HL].sort().join(','), e.sviews);
  pruefe('Gegengelesen: Nachrichten ohne Story + Antwort auf sichtbare', e.antworten === `-,${S_OK}`, e.antworten);
  pruefe('Keine neue public-Hilfsfunktion (kein RPC-Orakel)', e.neue_public_funktionen === '0', e.neue_public_funktionen);
  const rest = await frage(`select (select count(*) from public.posts where id::text like '12412412%')
    + (select count(*) from public.stories where id::text like '12412412%')
    + (select count(*) from public.chats where id::text like '12412412%')
    + (select count(*) from public.sammlungen where id::text like '12412412%') as n`);
  pruefe('Nichts geblieben (Rollback)', Number(rest?.[0]?.n) === 0, JSON.stringify(rest));
  console.log(`\n${anzahl - fehler}/${anzahl} Prüfungen bestanden`);
  process.exit(fehler ? 1 : 0);
})();
