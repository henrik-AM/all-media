#!/usr/bin/env node
/**
 * Schema 119 (nur sichtbare Beiträge) in einer VERWORFENEN Transaktion proben.
 *
 *   begin;
 *     Schema 119 komplett (ohne PROBE_LIVE=1)
 *     drei Probe-Beiträge von @prueflauf: sichtbar, demo (unsichtbar), geplant
 *     als @prueflauf: eigener demo-Beitrag kommentierbar (Besitzer)
 *     als @test:     sichtbar → Kommentar/Like/Merken ok;
 *                    demo/geplant → Kommentar, Live-Kommentar, Like, Repost,
 *                    Merken, Teilen werden abgewiesen;
 *                    Kommentare des demo-Beitrags nicht lesbar
 *   rollback → nichts bleibt.
 *
 * Nur die eigenen Konten. PROBE_LIVE=1: Schema nicht mitspielen (prüft live).
 * Start: SUPABASE_TOKEN=… node test/_probe119.js
 */
const fs = require('fs');
const path = require('path');
const { frage } = require('./_aufraeumen');

const P = '62616c1d-82e2-4ee4-aab9-950e40e438a4'; // @prueflauf
const T = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4'; // @test
const SICHTBAR = '11911911-0000-4000-8000-000000000001';
const DEMO = '11911911-0000-4000-8000-000000000002';
const GEPLANT = '11911911-0000-4000-8000-000000000003';

const schema = process.env.PROBE_LIVE ? '' :
  fs.readFileSync(path.join(__dirname, '..', '..', 'SUPABASE_SCHEMA_119_nur_sichtbare_beitraege.sql'), 'utf8');

const als = (k) => `reset role;
select set_config('request.jwt.claims', '{"sub":"${k}","role":"authenticated"}', true),
       set_config('request.jwt.claim.sub', '${k}', true);
set local role authenticated;`;
// Versuch in eigenem Unterblock; Ergebnis 'ok' oder SQLSTATE in die Tabelle erg.
const v = (name, sql) => `do $p$ begin ${sql}; insert into erg values ('${name}', 'ok');
  exception when others then insert into erg values ('${name}', sqlstate); end $p$;`;
const zahl = (name, sql) => `insert into erg select '${name}', (${sql})::text;`;

const sql = `begin;
${schema}
create temp table erg(k text, v text) on commit drop; grant all on erg to authenticated;
insert into public.posts (id, user_id, description, demo) values
  ('${SICHTBAR}', '${P}', 'Probe 119 sichtbar', false),
  ('${DEMO}', '${P}', 'Probe 119 demo', true);
insert into public.posts (id, user_id, description, demo, publish_at) values
  ('${GEPLANT}', '${P}', 'Probe 119 geplant', false, now() + interval '1 day');
${als(P)}
${v('p_kommentiert_eigenen_demo', `insert into public.comments (post_id, user_id, text) values ('${DEMO}', '${P}', 'eigen')`)}
${als(T)}
${zahl('t_sieht_demo', `select count(*) from public.posts where id = '${DEMO}'`)}
${zahl('t_sieht_sichtbar', `select count(*) from public.posts where id = '${SICHTBAR}'`)}
${v('t_kommentar_sichtbar', `insert into public.comments (post_id, user_id, text) values ('${SICHTBAR}', '${T}', 'ok')`)}
${v('t_like_sichtbar', `insert into public.post_likes (post_id, user_id) values ('${SICHTBAR}', '${T}')`)}
${v('t_merken_sichtbar', `insert into public.saves (post_id, user_id) values ('${SICHTBAR}', '${T}')`)}
${v('t_kommentar_demo', `insert into public.comments (post_id, user_id, text) values ('${DEMO}', '${T}', 'x')`)}
${v('t_kommentar_geplant', `insert into public.comments (post_id, user_id, text) values ('${GEPLANT}', '${T}', 'x')`)}
${v('t_live_demo', `insert into public.stream_comments (post_id, user_id, text) values ('${DEMO}', '${T}', 'x')`)}
${v('t_like_demo', `insert into public.post_likes (post_id, user_id) values ('${DEMO}', '${T}')`)}
${v('t_repost_demo', `insert into public.reposts (post_id, user_id) values ('${DEMO}', '${T}')`)}
${v('t_merken_demo', `insert into public.saves (post_id, user_id) values ('${DEMO}', '${T}')`)}
${v('t_teilen_demo', `insert into public.shares (post_id, shared_by) values ('${DEMO}', '${T}')`)}
${zahl('t_liest_kommentare_demo', `select count(*) from public.comments where post_id = '${DEMO}'`)}
${zahl('t_liest_kommentare_sichtbar', `select count(*) from public.comments where post_id = '${SICHTBAR}'`)}
reset role;
select json_object_agg(k, v) as erg from erg;
rollback;`;

let fehler = 0, anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++; if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

(async () => {
  const r = await frage(sql);
  if (!Array.isArray(r)) { console.log('FEHLER', JSON.stringify(r).slice(0, 400)); process.exit(1); }
  const e = r[0]?.erg || {};
  console.log(JSON.stringify(e));
  const zu = (k) => e[k] && e[k] !== 'ok';
  pruefe('Ausgang: @test sieht den demo-Beitrag nicht, den sichtbaren schon', e.t_sieht_demo === '0' && e.t_sieht_sichtbar === '1');
  pruefe('Besitzer kommentiert eigenen demo-Beitrag', e.p_kommentiert_eigenen_demo === 'ok', e.p_kommentiert_eigenen_demo);
  pruefe('Normaler Weg: Kommentar/Like/Merken auf sichtbaren Beitrag',
    e.t_kommentar_sichtbar === 'ok' && e.t_like_sichtbar === 'ok' && e.t_merken_sichtbar === 'ok',
    [e.t_kommentar_sichtbar, e.t_like_sichtbar, e.t_merken_sichtbar].join(','));
  for (const k of ['t_kommentar_demo', 't_kommentar_geplant', 't_live_demo', 't_like_demo', 't_repost_demo', 't_merken_demo', 't_teilen_demo']) {
    pruefe('Angriff abgewiesen: ' + k, zu(k), e[k]);
  }
  pruefe('Kommentare zum demo-Beitrag für @test unlesbar', e.t_liest_kommentare_demo === '0', e.t_liest_kommentare_demo);
  pruefe('Kommentare zum sichtbaren Beitrag lesbar', Number(e.t_liest_kommentare_sichtbar) >= 1, e.t_liest_kommentare_sichtbar);
  const rest = await frage(`select count(*)::int n from public.posts where id in ('${SICHTBAR}','${DEMO}','${GEPLANT}')`);
  pruefe('Nichts geblieben (Rollback)', rest?.[0]?.n === 0);
  console.log(`\n${anzahl - fehler}/${anzahl} Prüfungen bestanden`);
  process.exit(fehler ? 1 : 0);
})();
