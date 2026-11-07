#!/usr/bin/env node
/**
 * Schema 123 (Regel-Helfer nach `intern`) in einer VERWORFENEN Transaktion proben.
 *
 *   begin;
 *     Schema 123 komplett (ohne PROBE_LIVE=1)
 *     Probe-Beiträge von @prueflauf: sichtbar, moderiert (für Clients unsichtbar)
 *     Kommentare am sichtbaren Beitrag: normal, moderiert
 *     Markierungen am sichtbaren Beitrag: @test, @prueflauf
 *     als @test:
 *       Orakel: public.beitrag_ausgeblendet / kommentar_ausgeblendet /
 *               darf_markierung_loesen dürfen nicht mehr aufrufbar sein
 *       normaler Weg: Like, Kommentar, Kommentar-Like auf Sichtbares ok;
 *                     auf Moderiertes abgelehnt; moderierter Kommentar unsichtbar
 *       Markierung: fremde (@prueflauf) nicht löschbar, eigene löschbar
 *     als @prueflauf (Verfasser): Markierung von @test löschbar
 *     als Eigentümer: Zeilen gegenlesen, Regeln zeigen auf intern.*, Rechte
 *   rollback → nichts bleibt.
 *
 * Braucht die Belegung `schema` (geprüft, sonst Abbruch 2).
 * PROBE_LIVE=1: Schema 123 nicht mitspielen (zeigt den Live-Stand — Orakel offen).
 * Start: SUPABASE_TOKEN=… node test/_probe123.js
 */
const fs = require('fs');
const path = require('path');
require('./_ki_belegung').pruefeBelegung('schema');

const P = '62616c1d-82e2-4ee4-aab9-950e40e438a4'; // @prueflauf
const T = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4'; // @test
const SICHTBAR = '12312312-0000-4000-8000-000000000001';
const MOD = '12312312-0000-4000-8000-000000000002';
const UNBEKANNT = '12312312-0000-4000-8000-0000000000ff';
const K_OK = '12312312-0000-4000-8000-0000000000c1';
const K_MOD = '12312312-0000-4000-8000-0000000000c2';
const K_NEU = '12312312-0000-4000-8000-0000000000c3';
const K_NEU_MOD = '12312312-0000-4000-8000-0000000000c4';

const schema = process.env.PROBE_LIVE ? '' :
  fs.readFileSync(path.join(__dirname, '..', '..', 'SUPABASE_SCHEMA_123_regelhelfer_intern.sql'), 'utf8');

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
const tagDa = (wen) => `select count(*) from public.post_tags where post_id = '${SICHTBAR}' and user_id = '${wen}'`;

const sql = `begin;
${schema}
create temp table erg(k text, v text) on commit drop; grant all on erg to authenticated;
insert into public.posts (id, user_id, description, demo, publish_at, moderiert_am) values
  ('${SICHTBAR}', '${P}', 'Probe 123 sichtbar', false, null, null),
  ('${MOD}', '${P}', 'Probe 123 moderiert', false, null, now());
insert into public.comments (id, post_id, user_id, text, moderiert_am) values
  ('${K_OK}', '${SICHTBAR}', '${P}', 'Probe 123 Kommentar', null),
  ('${K_MOD}', '${SICHTBAR}', '${P}', 'Probe 123 moderiert', now());
insert into public.post_tags (post_id, user_id) values ('${SICHTBAR}', '${T}'), ('${SICHTBAR}', '${P}');
${als(T)}
${wert('orakel_beitrag_mod', `select public.beitrag_ausgeblendet('${MOD}'::uuid)`)}
${wert('orakel_beitrag_unbekannt', `select public.beitrag_ausgeblendet('${UNBEKANNT}'::uuid)`)}
${wert('orakel_kommentar_mod', `select public.kommentar_ausgeblendet('${K_MOD}'::uuid)`)}
${wert('orakel_verfasser', `select public.darf_markierung_loesen('${MOD}'::uuid, '${T}'::uuid, '${P}'::uuid)`)}
${wert('t_sieht_beitraege', `select string_agg(id::text, ',' order by id) from public.posts where id in ('${SICHTBAR}','${MOD}')`)}
${wert('t_sieht_kommentare', `select string_agg(id::text, ',' order by id) from public.comments where id in ('${K_OK}','${K_MOD}')`)}
${v('like_sichtbar', `insert into public.post_likes (post_id, user_id) values ('${SICHTBAR}', '${T}')`)}
${v('like_mod', `insert into public.post_likes (post_id, user_id) values ('${MOD}', '${T}')`)}
${v('save_mod', `insert into public.saves (post_id, user_id) values ('${MOD}', '${T}')`)}
${v('kommentar_sichtbar', `insert into public.comments (id, post_id, user_id, text) values ('${K_NEU}', '${SICHTBAR}', '${T}', 'Probe 123 neu')`)}
${v('kommentar_mod', `insert into public.comments (id, post_id, user_id, text) values ('${K_NEU_MOD}', '${MOD}', '${T}', 'Probe 123 neu')`)}
${v('antwort_auf_mod', `insert into public.comments (post_id, user_id, text, reply_to) values ('${SICHTBAR}', '${T}', 'Probe 123 Antwort', '${K_MOD}')`)}
${v('klike_ok', `insert into public.comment_likes (comment_id, user_id) values ('${K_OK}', '${T}')`)}
${v('klike_mod', `insert into public.comment_likes (comment_id, user_id) values ('${K_MOD}', '${T}')`)}
${v('tag_fremd_loeschen', `delete from public.post_tags where post_id = '${SICHTBAR}' and user_id = '${P}'`)}
${v('tag_eigen_loeschen', `delete from public.post_tags where post_id = '${SICHTBAR}' and user_id = '${T}'`)}
reset role;
${wert('nach_t_tag_p', tagDa(P))}
${wert('nach_t_tag_t', tagDa(T))}
insert into public.post_tags (post_id, user_id) values ('${SICHTBAR}', '${T}');
${als(P)}
${v('verfasser_loescht', `delete from public.post_tags where post_id = '${SICHTBAR}' and user_id = '${T}'`)}
reset role;
${wert('nach_p_tag_t', tagDa(T))}
${wert('likes', `select string_agg(post_id::text, ',' order by post_id) from public.post_likes where user_id = '${T}' and post_id in ('${SICHTBAR}','${MOD}')`)}
${wert('saves', `select count(*) from public.saves where user_id = '${T}' and post_id = '${MOD}'`)}
${wert('kommentare_t', `select string_agg(post_id::text || ':' || coalesce(reply_to::text, '-'), ',' order by post_id) from public.comments where user_id = '${T}' and text like 'Probe 123%'`)}
${wert('klikes', `select string_agg(comment_id::text, ',' order by comment_id) from public.comment_likes where user_id = '${T}' and comment_id in ('${K_OK}','${K_MOD}')`)}
${wert('alte_helfer', `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('beitrag_ausgeblendet','kommentar_ausgeblendet','darf_markierung_loesen')`)}
${wert('regeln_public', `select count(*) from pg_policies where coalesce(qual,'') || coalesce(with_check,'') ~ '(^|[^.])(beitrag_ausgeblendet|kommentar_ausgeblendet|darf_markierung_loesen)' and coalesce(qual,'') || coalesce(with_check,'') !~ 'intern\\.'`)}
${wert('regeln_intern', `select count(*) from pg_policies where coalesce(qual,'') || coalesce(with_check,'') ~ 'intern\\.'`)}
${wert('anon_usage', `select has_schema_privilege('anon', 'intern', 'usage')`)}
${wert('auth_usage', `select has_schema_privilege('authenticated', 'intern', 'usage')`)}
${wert('anon_exec', `select bool_or(has_function_privilege('anon', p.oid, 'execute')) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'intern'`)}
${wert('public_exec', `select bool_or(has_function_privilege('public', p.oid, 'execute')) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'intern'`)}
select json_object_agg(k, v) as erg from erg;
rollback;`;

let fehler = 0, anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++; if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};
const weg = (x) => /^FEHLER 42883/.test(x || ''); // Funktion gibt es nicht

(async () => {
  const r = await frage(sql);
  if (!Array.isArray(r)) { console.log('FEHLER', JSON.stringify(r).slice(0, 800)); process.exit(1); }
  const e = r[0]?.erg || {};
  console.log(JSON.stringify(e));
  // Orakel
  pruefe('Orakel: beitrag_ausgeblendet(moderiert) nicht aufrufbar', weg(e.orakel_beitrag_mod), e.orakel_beitrag_mod);
  pruefe('Orakel: beitrag_ausgeblendet(unbekannt) nicht aufrufbar', weg(e.orakel_beitrag_unbekannt), e.orakel_beitrag_unbekannt);
  pruefe('Orakel: kommentar_ausgeblendet nicht aufrufbar', weg(e.orakel_kommentar_mod), e.orakel_kommentar_mod);
  pruefe('Orakel: darf_markierung_loesen(…, wer) nicht aufrufbar', weg(e.orakel_verfasser), e.orakel_verfasser);
  // Sichtbarkeit unverändert
  pruefe('@test sieht nur den sichtbaren Beitrag', e.t_sieht_beitraege === SICHTBAR, e.t_sieht_beitraege);
  pruefe('@test sieht nur den nicht moderierten Kommentar', e.t_sieht_kommentare === K_OK, e.t_sieht_kommentare);
  // Regeln wirken weiter (normaler Weg + Ablehnung)
  pruefe('Like auf sichtbaren Beitrag: ok', e.like_sichtbar === 'ok', e.like_sichtbar);
  pruefe('Like auf moderierten Beitrag: abgelehnt', e.like_mod === '42501', e.like_mod);
  pruefe('Merken auf moderierten Beitrag: abgelehnt', e.save_mod === '42501', e.save_mod);
  pruefe('Kommentar auf sichtbaren Beitrag: ok', e.kommentar_sichtbar === 'ok', e.kommentar_sichtbar);
  pruefe('Kommentar auf moderierten Beitrag: abgelehnt', e.kommentar_mod === '42501', e.kommentar_mod);
  pruefe('Antwort auf moderierten Kommentar: abgelehnt', e.antwort_auf_mod === '42501', e.antwort_auf_mod);
  pruefe('Kommentar-Like auf normalen Kommentar: ok', e.klike_ok === 'ok', e.klike_ok);
  pruefe('Kommentar-Like auf moderierten Kommentar: abgelehnt', e.klike_mod === '42501', e.klike_mod);
  pruefe('Gegengelesen: Like nur auf dem sichtbaren Beitrag', e.likes === SICHTBAR, e.likes);
  pruefe('Gegengelesen: nichts gemerkt', e.saves === '0', e.saves);
  pruefe('Gegengelesen: genau ein Kommentar von @test, am sichtbaren Beitrag', e.kommentare_t === `${SICHTBAR}:-`, e.kommentare_t);
  pruefe('Gegengelesen: Kommentar-Like nur am normalen Kommentar', e.klikes === K_OK, e.klikes);
  // Markierungen
  pruefe('Fremde Markierung (@prueflauf) kann @test nicht löschen — Zeile bleibt', e.nach_t_tag_p === '1', `${e.tag_fremd_loeschen}/${e.nach_t_tag_p}`);
  pruefe('Eigene Markierung kann @test löschen — Zeile weg', e.tag_eigen_loeschen === 'ok' && e.nach_t_tag_t === '0', `${e.tag_eigen_loeschen}/${e.nach_t_tag_t}`);
  pruefe('Verfasser löscht Markierung von @test — Zeile weg', e.verfasser_loescht === 'ok' && e.nach_p_tag_t === '0', `${e.verfasser_loescht}/${e.nach_p_tag_t}`);
  // Aufbau
  pruefe('Alte public-Helfer gelöscht', e.alte_helfer === '0', e.alte_helfer);
  pruefe('Keine Regel ruft mehr einen public-Helfer', e.regeln_public === '0', e.regeln_public);
  pruefe('10 Regeln zeigen auf intern.*', e.regeln_intern === '10', e.regeln_intern);
  pruefe('Rechte: anon hat keine USAGE auf intern', e.anon_usage === 'false', e.anon_usage);
  pruefe('Rechte: authenticated hat USAGE auf intern (Regeln)', e.auth_usage === 'true', e.auth_usage);
  pruefe('Rechte: anon darf keine intern-Funktion', e.anon_exec === 'false', e.anon_exec);
  pruefe('Rechte: PUBLIC darf keine intern-Funktion', e.public_exec === 'false', e.public_exec);
  const rest = await frage(`select (select count(*) from public.posts where id in ('${SICHTBAR}','${MOD}'))
    + (select count(*) from public.comments where text like 'Probe 123%')
    + (select count(*) from public.post_tags where post_id = '${SICHTBAR}') as n`);
  pruefe('Nichts geblieben (Rollback)', Number(rest?.[0]?.n) === 0, JSON.stringify(rest));
  console.log(`\n${anzahl - fehler}/${anzahl} Prüfungen bestanden`);
  process.exit(fehler ? 1 : 0);
})();
