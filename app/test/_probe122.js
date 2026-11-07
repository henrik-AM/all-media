#!/usr/bin/env node
/**
 * Schema 122 (Definer-RPCs nur auf sichtbare Beiträge) in einer VERWORFENEN Transaktion proben.
 *
 *   begin;
 *     Schema 122 komplett (ohne PROBE_LIVE=1)
 *     Probe-Beiträge von @prueflauf: sichtbar, demo (für @test unsichtbar),
 *       geplant (publish_at in einer Stunde, für @test unsichtbar)
 *     Spendencode und Zahlungsmethode (apple_pay, ohne Anbieter-Token) für
 *       @test nur innerhalb der Transaktion — kein Zahlungsweg, keine echten Konten
 *     als @test: impression_vermerken / impressionen_vermerken, feed_rang,
 *                spende_senden auf sichtbar / demo / geplant / unbekannt
 *     als @prueflauf: eigener geplanter Beitrag bleibt bewertbar und sichtbar
 *     als Eigentümer (Management-API): Zeilen gegenlesen — eine stille
 *       Ablehnung darf nicht als „ok" durchgehen
 *   rollback → nichts bleibt.
 *
 * Fasst den Testbestand nicht an (alles in der Transaktion), braucht die
 * Belegung `schema` (geprüft, sonst Abbruch 2).
 * PROBE_LIVE=1: Schema 122 nicht mitspielen (prüft den Live-Stand).
 * Start: SUPABASE_TOKEN=… node test/_probe122.js
 */
const fs = require('fs');
const path = require('path');
require('./_ki_belegung').pruefeBelegung('schema');

const P = '62616c1d-82e2-4ee4-aab9-950e40e438a4'; // @prueflauf
const T = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4'; // @test
const SICHTBAR = '12212212-0000-4000-8000-000000000001';
const DEMO = '12212212-0000-4000-8000-000000000002';
const GEPLANT = '12212212-0000-4000-8000-000000000003';
const UNBEKANNT = '12212212-0000-4000-8000-0000000000ff';
const METHODE = '12212212-0000-4000-8000-0000000000e1';
const CODE = 'Probe122x';

const schema = process.env.PROBE_LIVE ? '' :
  fs.readFileSync(path.join(__dirname, '..', '..', 'SUPABASE_SCHEMA_122_rpc_nur_sichtbare_beitraege.sql'), 'utf8');

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
const impr = (b) => `perform public.impression_vermerken('${b}'::uuid, 4000, 'feed')`;
const spende = (b, code = CODE) =>
  `select public.spende_senden('${P}'::uuid, 500, '${code}', '${METHODE}'::uuid, ${b ? `'${b}'::uuid` : 'null'}, 'Probe 122') ->> 'grund'`;
const spendeOk = (b) =>
  `select public.spende_senden('${P}'::uuid, 500, '${CODE}', '${METHODE}'::uuid, ${b ? `'${b}'::uuid` : 'null'}, 'Probe 122') ->> 'ok'`;
const rang = (ids) => `select string_agg(post_id::text, ',' order by post_id) from public.feed_rang(array[${ids.map((i) => `'${i}'::uuid`).join(',')}], 'feed')`;

const sql = `begin;
${schema}
create temp table erg(k text, v text) on commit drop; grant all on erg to authenticated;
insert into public.posts (id, user_id, description, demo, publish_at) values
  ('${SICHTBAR}', '${P}', 'Probe 122 sichtbar', false, null),
  ('${DEMO}', '${P}', 'Probe 122 demo', true, null),
  ('${GEPLANT}', '${P}', 'Probe 122 geplant', false, now() + interval '1 hour');
delete from public.spendencodes where user_id = '${T}';
insert into public.zahlungsmethoden (id, user_id, anbieter, anzeigename, standard)
  values ('${METHODE}', '${T}', 'apple_pay', 'Probe 122', false);
${wert('lesbar_def', `select count(*) from pg_proc where proname in ('impression_vermerken','spende_senden','feed_rang') and prosrc like '%beitrag_lesbar(%'`)}
${als(T)}
${wert('t_sieht', `select string_agg(id::text, ',' order by id) from public.posts where id in ('${SICHTBAR}','${DEMO}','${GEPLANT}')`)}
${wert('code_setzen', `select public.spendencode_setzen('${CODE}') ->> 'ok'`)}
${v('impr_sichtbar', impr(SICHTBAR))}
${v('impr_demo', impr(DEMO))}
${v('impr_geplant', impr(GEPLANT))}
${v('impr_unbekannt', impr(UNBEKANNT))}
${wert('impr_sammel', `select public.impressionen_vermerken('[{"beitrag":"${SICHTBAR}","dauer":2000},{"beitrag":"${DEMO}","dauer":2000},{"beitrag":"${UNBEKANNT}"}]'::jsonb)`)}
${wert('t_eigene_impr', `select string_agg(post_id::text || ':' || sichtungen, ',' order by post_id) from public.post_impressions where user_id = '${T}' and post_id in ('${SICHTBAR}','${DEMO}','${GEPLANT}','${UNBEKANNT}')`)}
${wert('rang_t', rang([SICHTBAR, DEMO, GEPLANT, UNBEKANNT]))}
${wert('spende_demo', spende(DEMO))}
${wert('spende_geplant', spende(GEPLANT))}
${wert('spende_unbekannt', spende(UNBEKANNT))}
${wert('spende_demo_falscher_code', spende(DEMO, 'Falsch999'))}
${wert('spende_sichtbar', spendeOk(SICHTBAR))}
${wert('spende_ohne_beitrag', spendeOk(null))}
${als(P)}
${wert('rang_p', rang([SICHTBAR, DEMO, GEPLANT]))}
${v('impr_p_geplant', impr(GEPLANT))}
reset role;
${wert('impr_bestand', `select string_agg(post_id::text || ':' || sichtungen || ':' || dauer_ms, ',' order by post_id) from public.post_impressions where user_id = '${T}' and post_id in ('${SICHTBAR}','${DEMO}','${GEPLANT}','${UNBEKANNT}')`)}
${wert('impr_p_bestand', `select count(*) from public.post_impressions where user_id = '${P}' and post_id = '${GEPLANT}'`)}
${wert('spenden_bestand', `select string_agg(coalesce(post_id::text, 'ohne'), ',' order by post_id nulls last) from public.donations where sender_id = '${T}' and nachricht = 'Probe 122'`)}
${wert('fehlversuche', `select count(*) from public.spendencode_protokoll where user_id = '${T}' and art = 'pruefen' and not erfolg and created_at >= now()`)}
${wert('rechte_anon', `select bool_or(has_function_privilege('anon', p.oid, 'execute')) from pg_proc p where proname in ('impression_vermerken','spende_senden','feed_rang','impressionen_vermerken')`)}
${wert('rechte_public', `select bool_or(has_function_privilege('public', p.oid, 'execute')) from pg_proc p where proname in ('impression_vermerken','spende_senden','feed_rang')`)}
${wert('rechte_auth', `select bool_and(has_function_privilege('authenticated', p.oid, 'execute')) from pg_proc p where proname in ('impression_vermerken','spende_senden','feed_rang')`)}
select json_object_agg(k, v) as erg from erg;
rollback;`;

let fehler = 0, anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++; if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

(async () => {
  const r = await frage(sql);
  if (!Array.isArray(r)) { console.log('FEHLER', JSON.stringify(r).slice(0, 800)); process.exit(1); }
  const e = r[0]?.erg || {};
  console.log(JSON.stringify(e));
  pruefe('Alle drei Funktionen prüfen beitrag_lesbar()', e.lesbar_def === '3', e.lesbar_def);
  pruefe('Ausgang: @test sieht nur den sichtbaren Beitrag', e.t_sieht === SICHTBAR, e.t_sieht);
  pruefe('Spendencode für @test in der Transaktion gesetzt', e.code_setzen === 'true', e.code_setzen);
  // Impressionen: kein Fehler (App bricht nicht), aber keine Zeile auf Unsichtbarem.
  pruefe('Impression auf sichtbaren Beitrag: ok', e.impr_sichtbar === 'ok', e.impr_sichtbar);
  pruefe('Impression auf demo: kein Fehler (still)', e.impr_demo === 'ok', e.impr_demo);
  pruefe('Impression auf geplanten: kein Fehler (still)', e.impr_geplant === 'ok', e.impr_geplant);
  pruefe('Impression auf unbekannte ID: kein Fehler (verrät nichts)', e.impr_unbekannt === 'ok', e.impr_unbekannt);
  pruefe('impressionen_vermerken zählt alle 3 (verrät nichts)', e.impr_sammel === '3', e.impr_sammel);
  pruefe('Gegengelesen: nur der sichtbare Beitrag hat Sichtungen (2)',
    e.impr_bestand === `${SICHTBAR}:2:6000`, e.impr_bestand);
  pruefe('@test liest eigene Sichtungen: nur sichtbar', e.t_eigene_impr === `${SICHTBAR}:2`, e.t_eigene_impr);
  // feed_rang
  pruefe('feed_rang als @test: nur der sichtbare Beitrag', e.rang_t === SICHTBAR, e.rang_t);
  pruefe('feed_rang als Verfasser: alle drei eigenen (auch demo, geplant) bleiben',
    e.rang_p === [SICHTBAR, DEMO, GEPLANT].sort().join(','), e.rang_p);
  pruefe('Verfasser: Impression auf eigenen geplanten Beitrag wird vermerkt',
    e.impr_p_geplant === 'ok' && e.impr_p_bestand === '1', `${e.impr_p_geplant}/${e.impr_p_bestand}`);
  // Spende
  pruefe('Spende auf demo → „beitrag"', e.spende_demo === 'beitrag', e.spende_demo);
  pruefe('Spende auf geplanten → „beitrag"', e.spende_geplant === 'beitrag', e.spende_geplant);
  pruefe('Spende auf unbekannte ID → „beitrag" (gleich wie unsichtbar)', e.spende_unbekannt === 'beitrag', e.spende_unbekannt);
  pruefe('Spende auf demo mit falschem Code → „beitrag" vor Codeprüfung', e.spende_demo_falscher_code === 'beitrag', e.spende_demo_falscher_code);
  pruefe('Kein Fehlversuch protokolliert (Code nicht verbraucht)', e.fehlversuche === '0', e.fehlversuche);
  pruefe('Normaler Weg: Spende auf sichtbaren Beitrag ok', e.spende_sichtbar === 'true', e.spende_sichtbar);
  pruefe('Normaler Weg: Spende ohne Beitrag ok', e.spende_ohne_beitrag === 'true', e.spende_ohne_beitrag);
  pruefe('Gegengelesen: genau 2 Spenden (sichtbar, ohne), keine auf Unsichtbarem',
    e.spenden_bestand === `${SICHTBAR},ohne`, e.spenden_bestand);
  pruefe('Rechte: anon darf keine der Funktionen', e.rechte_anon === 'false', e.rechte_anon);
  pruefe('Rechte: PUBLIC darf keine der drei', e.rechte_public === 'false', e.rechte_public);
  pruefe('Rechte: authenticated darf alle drei', e.rechte_auth === 'true', e.rechte_auth);
  const rest = await frage(`select (select count(*) from public.posts where id in ('${SICHTBAR}','${DEMO}','${GEPLANT}'))
    + (select count(*) from public.zahlungsmethoden where id = '${METHODE}')
    + (select count(*) from public.donations where nachricht = 'Probe 122')
    + (select count(*) from public.post_impressions where post_id in ('${SICHTBAR}','${DEMO}','${GEPLANT}')) as n,
    (select count(*) from public.spendencodes where user_id = '${T}') as code`);
  pruefe('Nichts geblieben (Rollback), Spendencode von @test unverändert vorhanden',
    Number(rest?.[0]?.n) === 0 && Number(rest?.[0]?.code) === 1, JSON.stringify(rest));
  console.log(`\n${anzahl - fehler}/${anzahl} Prüfungen bestanden`);
  process.exit(fehler ? 1 : 0);
})();
