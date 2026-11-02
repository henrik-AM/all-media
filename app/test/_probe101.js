#!/usr/bin/env node
/**
 * Schema 101 (Auftrag Recht/Sicherheit 21.10.) in einer VERWORFENEN Transaktion
 * proben — Vorlage _probe100.js.
 *
 *   begin;
 *   Schema 101 komplett
 *   Testkonto wird in der Transaktion zum wartenden Kinderkonto (konto_alter)
 *   als Prüfkonto: Nummer des wartenden Kindes → kein Treffer, kein nummer_treffer
 *                  Spende an das wartende Kind → „empfaenger" (verrät nichts)
 *   als wartendes Testkonto: sucht selbst niemanden, spendet nicht („nicht_freigegeben")
 *   normaler Weg: Testkonto frei → Treffer per Nummer, Spende scheitert erst
 *                 an späteren Gründen (Zahlungsmethode/PIN), nicht an der Freigabe
 *   Ergebnis per raise → alles zurückgerollt, nichts bleibt.
 *
 * Nur die eigenen Konten. Läuft auch bei gesperrtem PostgREST (402).
 * Start: SUPABASE_TOKEN=… SUPABASE_URL=https://….supabase.co node test/_probe101.js
 */
const fs = require('fs');
const path = require('path');
const { frage } = require('./_aufraeumen');

const PRUEFKONTO = '62616c1d-82e2-4ee4-aab9-950e40e438a4'; // all.media.prueflauf@web.de
const TESTKONTO = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4'; // test@all-media.app

let fehler = 0;
let anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

const merke = (schluessel, ausdruck) =>
  `perform set_config('probe.erg', current_setting('probe.erg', true) || '${schluessel}=' || coalesce((${ausdruck})::text, 'null') || ' ', true);`;
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
  do $p$ declare n int; begin
    ${rumpf}
  end $p$;`;
const nummer = (konto) => `current_setting('probe.nr_${konto.slice(0, 4)}')`;

(async () => {
  if (!process.env.SUPABASE_TOKEN) {
    console.log('ÜBERSPRUNGEN  SUPABASE_TOKEN fehlt.');
    process.exit(2);
  }
  const schema = fs.readFileSync(
    path.join(__dirname, '..', '..', 'SUPABASE_SCHEMA_101_freigabe_nummer_spende.sql'),
    'utf8'
  );
  const spende = (an) => `public.spende_senden('${an}'::uuid, 500, '0000')`;

  const sql = `
begin;
select set_config('probe.erg', '', true);
${schema}

${eigner(`
  -- Nummern merken (nie ausgeben), Bremse der Probe leeren.
  perform set_config('probe.nr_${PRUEFKONTO.slice(0, 4)}', (select phone from public.profiles where id = '${PRUEFKONTO}'), true);
  perform set_config('probe.nr_${TESTKONTO.slice(0, 4)}', (select phone from public.profiles where id = '${TESTKONTO}'), true);
  delete from public.nummer_suche_takt where nutzer in ('${PRUEFKONTO}', '${TESTKONTO}');
  delete from public.nummer_treffer where nutzer = '${PRUEFKONTO}' and ziel = '${TESTKONTO}';
  -- Testkonto wird zum wartenden Kinderkonto (nur in dieser Transaktion).
  insert into public.konto_alter (user_id, geburtsdatum, land, mindestalter, status)
  values ('${TESTKONTO}', (now() - interval '12 years')::date, 'DE', 16, 'wartet')
  on conflict (user_id) do update set geburtsdatum = excluded.geburtsdatum, mindestalter = 16, status = 'wartet', eltern_id = null;
  ${merke('stand_kind', `public.konto_stand('${TESTKONTO}')`)}
`)}

${als(PRUEFKONTO, `
  ${merke('fremd_findet_kind', `public.finde_per_nummer(${nummer(TESTKONTO)}) is not null`)}
  ${merke('spende_an_kind', `${spende(TESTKONTO)} ->> 'grund'`)}
`)}
${eigner(`
  select count(*) into n from public.nummer_treffer where nutzer = '${PRUEFKONTO}' and ziel = '${TESTKONTO}';
  ${merke('treffer_eingetragen', 'n')}
`)}

${als(TESTKONTO, `
  ${merke('kind_sucht', `public.finde_per_nummer(${nummer(PRUEFKONTO)}) is not null`)}
  ${merke('kind_spendet', `${spende(PRUEFKONTO)} ->> 'grund'`)}
`)}

${eigner(`
  update public.konto_alter set status = 'frei' where user_id = '${TESTKONTO}';
  ${merke('stand_frei', `public.konto_stand('${TESTKONTO}')`)}
`)}
${als(PRUEFKONTO, `
  ${merke('normal_findet', `(public.finde_per_nummer(${nummer(TESTKONTO)}) ->> 'id') = '${TESTKONTO}'`)}
  ${merke('normal_spende', `${spende(TESTKONTO)} ->> 'grund'`)}
`)}
${als(TESTKONTO, `
  ${merke('normal_kind_sucht', `public.finde_per_nummer(${nummer(PRUEFKONTO)}) is not null`)}
`)}

${eigner(`
  ${merke('rechte_anon_finde', `has_function_privilege('anon', 'public.finde_per_nummer(text)', 'execute')`)}
  ${merke('rechte_anon_spende', `has_function_privilege('anon', 'public.spende_senden(uuid,integer,text,uuid,uuid,text)', 'execute')`)}
`)}

do $p$ begin raise exception 'ERG:%', current_setting('probe.erg', true); end $p$;
`;

  const antwort = await frage(sql);
  const text = JSON.stringify(antwort);
  const treffer = text.match(/ERG:([^"\\]*)/);
  if (!treffer) {
    console.log('Keine Ergebnisse — Antwort:', text.slice(0, 600));
    process.exit(1);
  }
  const e = {};
  for (const paar of treffer[1].trim().split(/\s+/)) {
    const [k, ...r] = paar.split('=');
    e[k] = r.join('=');
  }

  console.log('\n1. Wartendes Kinderkonto');
  pruefe('Testkonto wartet in der Probe', e.stand_kind === 'wartet', e.stand_kind);
  pruefe('Fremder findet das Kind NICHT per Nummer', e.fremd_findet_kind === 'false', e.fremd_findet_kind);
  pruefe('kein nummer_treffer eingetragen', e.treffer_eingetragen === '0', e.treffer_eingetragen);
  pruefe('Spende an das Kind → „empfaenger" (verrät nichts)', e.spende_an_kind === 'empfaenger', e.spende_an_kind);
  pruefe('wartendes Kind sucht niemanden', e.kind_sucht === 'false', e.kind_sucht);
  pruefe('wartendes Kind spendet nicht', e.kind_spendet === 'nicht_freigegeben', e.kind_spendet);

  console.log('\n2. Normaler Weg (freigegeben)');
  pruefe('Testkonto frei', e.stand_frei === 'frei', e.stand_frei);
  pruefe('Nummernsuche findet das freie Konto', e.normal_findet === 'true', e.normal_findet);
  pruefe('freies Konto sucht wieder', e.normal_kind_sucht === 'true', e.normal_kind_sucht);
  pruefe('Spende scheitert nicht an der Freigabe',
    !['empfaenger', 'nicht_freigegeben'].includes(e.normal_spende), e.normal_spende);

  console.log('\n3. Rechte');
  pruefe('anon darf finde_per_nummer nicht', e.rechte_anon_finde === 'false', e.rechte_anon_finde);
  pruefe('anon darf spende_senden nicht', e.rechte_anon_spende === 'false', e.rechte_anon_spende);

  console.log(`\n${anzahl - fehler}/${anzahl} bestanden — alles zurückgerollt.`);
  process.exit(fehler ? 1 : 0);
})();
