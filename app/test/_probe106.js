#!/usr/bin/env node
/**
 * Schema 106 (Auftrag Recht/Sicherheit 21.10., Kasten RS 7: Einwilligung mit
 * Version) in einer VERWORFENEN Transaktion proben. Vorlage _probe102.js.
 *
 *   begin;
 *   Schema 106 komplett
 *   Konto A registriert mit Zustimmung (Metadaten wie RS 1) → drei Zeilen.
 *   Konto B registriert ohne Zustimmung → nichts, zustimmung_offen() nennt drei.
 *   Konto C mit kaputter Fassung in den Metadaten → Anlegen klappt trotzdem.
 *   B stimmt zu: falsche Fassung abgelehnt, richtige gespeichert, zweimal = schon.
 *   Angriffe: direkt einfügen, ändern, fremde lesen, anonym aufrufen.
 *   Kind K wartet auf Elternteil E; Freigabe → Eltern-Einwilligung mit E als
 *   „durch“; E liest die Zeilen des Kindes.
 *   Neue Fassung 2 der Nutzungsbedingungen → A muss neu zustimmen.
 *   Ergebnis per raise → alles zurückgerollt, nichts bleibt.
 *
 * Nur Wegwerf-Konten in der Transaktion (@prueflauf.invalid).
 * Start: SUPABASE_TOKEN=… SUPABASE_URL=https://….supabase.co node test/_probe106.js
 */
const fs = require('fs');
const path = require('path');
const { frage } = require('./_aufraeumen');

const A = 'a1000000-0000-4000-8000-0000000006a1';
const B = 'a1000000-0000-4000-8000-0000000006a2';
const C = 'a1000000-0000-4000-8000-0000000006a3';
const E = 'a1000000-0000-4000-8000-0000000006a4';
const K = 'a1000000-0000-4000-8000-0000000006a5';
const F = 'a1000000-0000-4000-8000-0000000006a6';

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
const konto = (id, nr, meta) => `
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values ('${id}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe106-${nr}@prueflauf.invalid',
          '${JSON.stringify(Object.assign({ name: 'Probe 106 ' + nr, phone: '+491519999061' + nr, handle: '@prueflauf.p106' + nr }, meta))}', now(), now());`;
// Wie App und Website beim Registrieren: mit Prüfsummen des gezeigten Texts (F6).
const ZUSTIMMUNG = require('../../gemeinsam/rechtstexte').zustimmungsDaten(new Date('2026-10-31T12:00:00Z'));
// Alter Client: Versionen ohne Prüfsummen.
const ZUSTIMMUNG_ALT = { zustimmung_am: '2026-10-31T12:00:00Z', zustimmung_nutzungsbedingungen: '1', zustimmung_community_richtlinien: '1', kenntnis_datenschutz: '1' };
// Eltern-Einwilligung wie App und Website: Fassungen der Texte im Elternblatt (F12).
const FASSUNGEN = JSON.stringify(require('../../gemeinsam/einwilligung').elternFassungen());
const FASSUNGEN_FALSCH = JSON.stringify(Object.assign(JSON.parse(FASSUNGEN), { nutzungsbedingungen: { version: 1, pruefsumme: 'ffffffffffffffff' } }));
const FASSUNGEN_TEIL = JSON.stringify((({ nutzungsbedingungen, community_richtlinien }) => ({ nutzungsbedingungen, community_richtlinien }))(JSON.parse(FASSUNGEN)));
const entscheiden = (ja, fassungen) => `public.einwilligung_entscheiden('${K}', ${ja}, ${fassungen ? `'${fassungen}'::jsonb` : 'null'})`;
const halte = (n, ausdruck) => `perform set_config('probe.${n}', (${ausdruck})::text, true)`;
const zeilen = (wer, bedingung = 'true') => `(select count(*) from public.einwilligungen where user_id = '${wer}' and ${bedingung})`;

(async () => {
  if (!process.env.SUPABASE_TOKEN) {
    console.log('ÜBERSPRUNGEN  SUPABASE_TOKEN fehlt.');
    process.exit(2);
  }
  const schema = fs.readFileSync(
    path.join(__dirname, '..', '..', 'SUPABASE_SCHEMA_106_einwilligung_fassung.sql'),
    'utf8'
  );

  const sql = `
begin;
select set_config('probe.erg', '', true);
${schema}

${eigner(`
  ${konto(A, 1, ZUSTIMMUNG)}
  ${konto(B, 2, {})}
  ${merke('c_angelegt', "'nein'")}
  ${konto(C, 3, { zustimmung_nutzungsbedingungen: '99', kenntnis_datenschutz: 'x;drop' })}
  ${merke('c_angelegt', "'ja'")}
  ${konto(E, 4, ZUSTIMMUNG)}
  ${konto(K, 5, ZUSTIMMUNG)}
  ${konto(F, 6, ZUSTIMMUNG_ALT)}
  ${konto(F.slice(0, -1) + '7', 7, Object.assign({}, ZUSTIMMUNG, { pruefsumme_nutzungsbedingungen: 'ffffffffffffffff' }))}
  ${merke('f_alt_zeilen', zeilen(F))}
  ${merke('g_falsch_zeilen', zeilen(F.slice(0, -1) + '7', "dokument = 'nutzungsbedingungen'") + " || '/' || " + zeilen(F.slice(0, -1) + '7'))}
  insert into public.konto_alter (user_id, geburtsdatum, land, mindestalter, status)
  values ('${A}', '1990-01-01', 'CH', 16, 'frei')
  on conflict (user_id) do update set status = 'frei', geburtsdatum = '1990-01-01';
  insert into public.konto_alter (user_id, geburtsdatum, land, mindestalter, status)
  values ('${E}', '1980-01-01', 'CH', 16, 'frei')
  on conflict (user_id) do update set status = 'frei', geburtsdatum = '1980-01-01';
  insert into public.konto_alter (user_id, geburtsdatum, land, mindestalter, status, eltern_id, angefragt_am)
  values ('${K}', '2014-01-01', 'CH', 16, 'wartet', '${E}', now())
  on conflict (user_id) do update set status = 'wartet', eltern_id = '${E}', geburtsdatum = '2014-01-01';
  ${merke('a_zeilen', zeilen(A, "quelle = 'registrierung'"))}
  ${merke('a_pruefsumme', zeilen(A, "pruefsumme = (select pruefsumme from public.rechtstext_fassungen f where f.dokument = einwilligungen.dokument and f.version = einwilligungen.version)"))}
  ${merke('b_zeilen', zeilen(B))}
  ${merke('c_zeilen', zeilen(C))}
`)}
${als(A, `
  ${merke('a_offen', "jsonb_array_length(public.zustimmung_offen())")}
`)}
${als(B, `
  ${merke('b_offen', "jsonb_array_length(public.zustimmung_offen())")}
  ${merke('b_falsch', "public.zustimmen('nutzungsbedingungen', 7, '093abb7871ad3802') ->> 'grund'")}
  ${merke('b_unbekannt', "public.zustimmen('erfunden', 1, 'abcdefabcdefabcd') ->> 'grund'")}
  ${merke('b_falsche_summe', "public.zustimmen('nutzungsbedingungen', 1, 'ffffffffffffffff') ->> 'grund'")}
  ${merke('b_ohne_summe', "public.zustimmen('nutzungsbedingungen', 1, null) ->> 'grund'")}
  ${merke('b_richtig', "public.zustimmen('nutzungsbedingungen', 1, '093abb7871ad3802') ->> 'ok'")}
  ${merke('b_zweimal', "public.zustimmen('nutzungsbedingungen', 1, '093abb7871ad3802') ->> 'schon'")}
  ${merke('b_offen_danach', "jsonb_array_length(public.zustimmung_offen())")}
  ${merke('b_liest_eigene', "(select count(*) from public.einwilligungen)")}
  ${merke('b_liest_fremde', `(select count(*) from public.einwilligungen where user_id = '${A}')`)}
  ${versuch('b_direkt', `insert into public.einwilligungen (user_id, dokument, version, pruefsumme, art, durch, quelle) values ('${B}', 'community_richtlinien', 1, '78549dde77a7bbe0', 'zustimmung', '${B}', 'nachtrag')`)}
  ${versuch('b_aendern', `update public.einwilligungen set am = '2020-01-01' where user_id = '${B}'`)}
  get diagnostics n = row_count;
  ${versuch('b_fassung', `insert into public.rechtstext_fassungen (dokument, version, pruefsumme, art) values ('nutzungsbedingungen', 9, '0000000000000000', 'zustimmung')`)}
`)}
${eigner(`
  ${merke('b_geaendert', `(select count(*) from public.einwilligungen where user_id = '${B}' and am < '2021-01-01')`)}
  ${versuch('eigner_aendern', `update public.einwilligungen set am = now() where user_id = '${B}'`)}
  ${merke('k_vorher', zeilen(K, "art = 'eltern'"))}
  -- F12: Freigabe von Hand (Testbestand) erzeugt keinen Beleg mehr.
  update public.konto_alter set status = 'frei', entschieden_am = now() where user_id = '${K}';
  ${merke('k_hand', zeilen(K, "art = 'eltern'"))}
  update public.konto_alter set status = 'wartet' where user_id = '${K}';
`)}
${als(E, `
  ${merke('k_ohne', `${entscheiden(true, null)} ->> 'grund'`)}
  ${merke('k_falsch', `${entscheiden(true, FASSUNGEN_FALSCH)} ->> 'grund'`)}
  ${merke('k_teil', `${entscheiden(true, FASSUNGEN_TEIL)} ->> 'grund'`)}
  ${merke('k_alte_signatur', "case when to_regprocedure('public.einwilligung_entscheiden(uuid,boolean)') is null then 'weg' else 'da' end")}
  ${merke('k_ja', `${entscheiden(true, FASSUNGEN)} ->> 'ok'`)}
  ${merke('k_zweimal', `${entscheiden(true, FASSUNGEN)} ->> 'grund'`)}
`)}
${als(A, `
  ${merke('k_fremd', `${entscheiden(true, FASSUNGEN)} ->> 'ok'`)}
`)}
${eigner(`
  ${merke('k_eltern', zeilen(K, `art = 'eltern' and durch = '${E}' and quelle = 'eltern'`))}
  ${merke('k_summen', zeilen(K, "art = 'eltern' and pruefsumme = (select pruefsumme from public.rechtstext_fassungen f where f.dokument = einwilligungen.dokument and f.version = einwilligungen.version)"))}
  ${merke('k_frei', `public.konto_stand('${K}')`)}
  update public.konto_alter set status = 'frei' where user_id = '${K}';
  ${merke('k_eltern_einmal', zeilen(K, "art = 'eltern'"))}
  ${merke('ausloeser_weg', "not exists (select 1 from pg_trigger where tgname = 'eltern_einwilligung_vermerken')")}
`)}
${als(E, `
  ${merke('e_liest_kind', `(select count(*) from public.einwilligungen where user_id = '${K}')`)}
`)}
${als(E, `
  j := public.meine_kinder();
  ${merke('kinder_anzahl', "jsonb_array_length(j)")}
  ${merke('kinder_stand', "j -> 0 ->> 'stand'")}
  ${merke('kinder_widerrufbar', "j -> 0 ->> 'widerrufbar'")}
`)}
${als(A, `
  ${merke('fremd_widerruf', `public.elterneinwilligung_widerrufen('${K}') ->> 'grund'`)}
  ${merke('fremd_kinder', "jsonb_array_length(public.meine_kinder())")}
`)}
${als(K, `
  ${merke('kind_selbst', `public.elterneinwilligung_widerrufen('${K}') ->> 'grund'`)}
`)}
${als(E, `
  ${merke('widerruf_ok', `public.elterneinwilligung_widerrufen('${K}') ->> 'ok'`)}
  ${merke('widerruf_zweimal', `public.elterneinwilligung_widerrufen('${K}') ->> 'schon'`)}
`)}
${eigner(`
  ${merke('kind_ruht', `public.konto_stand('${K}')`)}
  ${merke('widerruf_zeilen', zeilen(K, `art = 'widerruf' and durch = '${E}'`))}
`)}
${als(E, `
  ${merke('neu_zustimmen', `${entscheiden(true, FASSUNGEN)} ->> 'ok'`)}
`)}
${eigner(`
  ${merke('neu_zugestimmt', zeilen(K, "art = 'eltern'"))}
  update public.konto_alter set geburtsdatum = '2000-01-01' where user_id = '${K}';
`)}
${als(E, `
  ${merke('gross_widerruf', `public.elterneinwilligung_widerrufen('${K}') ->> 'grund'`)}
  ${merke('gross_widerrufbar', "public.meine_kinder() -> 0 ->> 'widerrufbar'")}
`)}
${eigner(`
  insert into public.rechtstext_fassungen (dokument, version, pruefsumme, art, gilt_ab)
  values ('nutzungsbedingungen', 2, 'abcdefabcdefabcd', 'zustimmung', now() - interval '1 second');
  insert into public.rechtstext_fassungen (dokument, version, pruefsumme, art, gilt_ab)
  values ('community_richtlinien', 2, 'abcdefabcdefabce', 'zustimmung', now() + interval '30 days');
`)}
${eigner(`
  -- F12: Fassung wechselt, während das Elternblatt offen ist.
  update public.konto_alter set status = 'wartet', geburtsdatum = '2014-01-01' where user_id = '${K}';
  ${halte('k_vor_wechsel', zeilen(K, "art = 'eltern'"))};
`)}
${als(E, `
  ${merke('wechsel_alt', `${entscheiden(true, FASSUNGEN)} ->> 'grund'`)}
  ${merke('wechsel_nein', `${entscheiden(false, null)} ->> 'ok'`)}
`)}
${eigner(`
  ${merke('wechsel_beleg', `${zeilen(K, "art = 'eltern'")} - current_setting('probe.k_vor_wechsel')::int`)}
  ${merke('wechsel_stand', `public.konto_stand('${K}')`)}
`)}
${als(A, `
  j := public.zustimmung_offen();
  ${merke('a_neu_offen', "jsonb_array_length(j)")}
  ${merke('a_neu_dok', "j -> 0 ->> 'dokument'")}
  ${merke('a_neu_bisher', "j -> 0 ->> 'bisher'")}
  ${merke('a_alt_fassung', "public.zustimmen('nutzungsbedingungen', 1, '093abb7871ad3802') ->> 'grund'")}
  ${merke('a_alte_app', "public.zustimmen('nutzungsbedingungen', 2, '093abb7871ad3802') ->> 'grund'")}
  ${merke('a_zukunft', "public.zustimmen('community_richtlinien', 2, 'abcdefabcdefabce') ->> 'grund'")}
  ${merke('a_neu_ok', "public.zustimmen('nutzungsbedingungen', 2, 'abcdefabcdefabcd') ->> 'ok'")}
  ${merke('a_danach', "jsonb_array_length(public.zustimmung_offen())")}
`)}
${eigner(`
  ${merke('alte_signatur', "case when to_regprocedure('public.zustimmen(text,integer)') is null then 'weg' else 'da' end")}
  ${merke('anon_offen', "has_function_privilege('anon', 'public.zustimmung_offen()', 'execute')")}
  ${merke('anon_zustimmen', "has_function_privilege('anon', 'public.zustimmen(text,integer,text)', 'execute')")}
  ${merke('anon_kinder', "has_function_privilege('anon', 'public.meine_kinder()', 'execute') or has_function_privilege('anon', 'public.elterneinwilligung_widerrufen(uuid)', 'execute')")}
  ${merke('nutzer_fassung', "has_function_privilege('authenticated', 'public.geltende_fassung(text)', 'execute')")}
  ${merke('altbestand', "(select count(*) from public.einwilligungen where quelle = 'altbestand')")}
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

  console.log('\n1. Registrieren');
  pruefe('mit Zustimmung: drei Zeilen aus den Metadaten', e.a_zeilen === '3', e.a_zeilen);
  pruefe('Prüfsumme kommt vom Server', e.a_pruefsumme === '3', e.a_pruefsumme);
  pruefe('danach nichts offen', e.a_offen === '0', e.a_offen);
  pruefe('ohne Zustimmung: keine Zeile', e.b_zeilen === '0', e.b_zeilen);
  pruefe('F6: alter Client ohne Prüfsummen → keine Zeile, später nachfragen', e.f_alt_zeilen === '0', e.f_alt_zeilen);
  pruefe('F6: falsche Prüfsumme nur bei diesem Dokument → keine Zeile dafür', e.g_falsch_zeilen === '0/2', e.g_falsch_zeilen);
  pruefe('kaputte Fassung verhindert das Konto nicht', e.c_angelegt === 'ja', e.c_angelegt);
  pruefe('kaputte Fassung: keine Zeile', e.c_zeilen === '0', e.c_zeilen);

  console.log('\n2. Zustimmen');
  pruefe('ohne Zustimmung sind drei offen', e.b_offen === '3', e.b_offen);
  pruefe('falsche Fassung abgelehnt', e.b_falsch === 'fassung', e.b_falsch);
  pruefe('unbekanntes Dokument abgelehnt', e.b_unbekannt === 'dokument', e.b_unbekannt);
  pruefe('geltende Fassung gespeichert', e.b_richtig === 'true', e.b_richtig);
  pruefe('zweimal = schon', e.b_zweimal === 'true', e.b_zweimal);
  pruefe('danach zwei offen', e.b_offen_danach === '2', e.b_offen_danach);

  console.log('\n3. Angriffe');
  pruefe('liest die eigene Zeile', e.b_liest_eigene === '1', e.b_liest_eigene);
  pruefe('liest fremde nicht', e.b_liest_fremde === '0', e.b_liest_fremde);
  pruefe('direkt einfügen verboten', e.b_direkt === 'zu', e.b_direkt);
  pruefe('ändern ohne Wirkung', e.b_geaendert === '0', `${e.b_aendern}/${e.b_geaendert}`);
  pruefe('Fassungen nicht beschreibbar', e.b_fassung === 'zu', e.b_fassung);
  pruefe('auch der Eigentümer ändert keine Einwilligung', e.eigner_aendern === 'zu', e.eigner_aendern);
  pruefe('anonym: zustimmung_offen und zustimmen gesperrt', e.anon_offen === 'false' && e.anon_zustimmen === 'false', `${e.anon_offen}/${e.anon_zustimmen}`);
  pruefe('geltende_fassung nur intern', e.nutzer_fassung === 'false', e.nutzer_fassung);

  console.log('\n4. Eltern (Art. 8 DSGVO)');
  pruefe('vor der Freigabe keine Eltern-Einwilligung', e.k_vorher === '0', e.k_vorher);
  pruefe('Freigabe vermerkt drei Fassungen, durch den Elternteil', e.k_eltern === '3', e.k_eltern);
  pruefe('erneutes Setzen auf frei vermerkt nicht doppelt', e.k_eltern_einmal === '3', e.k_eltern_einmal);

  console.log('\nF12. Elternfreigabe nur zur gezeigten Fassung');
  pruefe('Freigabe von Hand erzeugt keinen Beleg (Auslöser weg)', e.k_hand === '0' && e.ausloeser_weg === 'true', `${e.k_hand}/${e.ausloeser_weg}`);
  pruefe('ohne Fassungen: abgelehnt', e.k_ohne === 'veraltet', e.k_ohne);
  pruefe('falsche Prüfsumme: abgelehnt', e.k_falsch === 'veraltet', e.k_falsch);
  pruefe('nur zwei von drei Texten: abgelehnt', e.k_teil === 'veraltet', e.k_teil);
  pruefe('alte Signatur (uuid, boolean) gelöscht', e.k_alte_signatur === 'weg', e.k_alte_signatur);
  pruefe('mit gezeigten Fassungen: frei', e.k_ja === 'true' && e.k_frei === 'frei', `${e.k_ja}/${e.k_frei}`);
  pruefe('Beleg trägt die Prüfsummen der Fassungen', e.k_summen === '3', e.k_summen);
  pruefe('zweimal: nicht mehr offen', e.k_zweimal === 'nicht_offen', e.k_zweimal);
  pruefe('fremdes Konto stimmt nicht zu', e.k_fremd === 'false', e.k_fremd);
  pruefe('Fassungswechsel bei offenem Blatt: abgelehnt, kein Beleg', e.wechsel_alt === 'veraltet' && e.wechsel_beleg === '0', `${e.wechsel_alt}/${e.wechsel_beleg}`);
  pruefe('Ablehnen geht ohne Fassungen', e.wechsel_nein === 'true' && e.wechsel_stand === 'abgelehnt', `${e.wechsel_nein}/${e.wechsel_stand}`);
  pruefe('Elternteil liest die Zeilen des Kindes', Number(e.e_liest_kind) >= 6, e.e_liest_kind);

  console.log('\n4b. Widerruf (Art. 7 Abs. 3 DSGVO, Richtlinie 1.6)');
  pruefe('Elternteil sieht sein Kind, freigegeben, widerrufbar', e.kinder_anzahl === '1' && e.kinder_stand === 'frei' && e.kinder_widerrufbar === 'true', `${e.kinder_anzahl}/${e.kinder_stand}/${e.kinder_widerrufbar}`);
  pruefe('fremdes Konto sieht keine Kinder und widerruft nicht', e.fremd_kinder === '0' && e.fremd_widerruf === 'kein_kind', `${e.fremd_kinder}/${e.fremd_widerruf}`);
  pruefe('Kind widerruft nicht für sich selbst', e.kind_selbst === 'kein_kind' || e.kind_selbst === 'anmeldung', e.kind_selbst);
  pruefe('Elternteil widerruft', e.widerruf_ok === 'true', e.widerruf_ok);
  pruefe('zweiter Widerruf = schon', e.widerruf_zweimal === 'true', e.widerruf_zweimal);
  pruefe('Konto des Kindes ruht danach', e.kind_ruht === 'wartet', e.kind_ruht);
  pruefe('Widerruf vermerkt (drei Fassungen, durch den Elternteil)', e.widerruf_zeilen === '3', e.widerruf_zeilen);
  pruefe('neue Zustimmung vermerkt erneut', e.neu_zustimmen === 'true' && e.neu_zugestimmt === '6', e.neu_zugestimmt);
  pruefe('über der Grenze nichts zu widerrufen', e.gross_widerruf === 'ohne_eltern' && e.gross_widerrufbar === 'false', `${e.gross_widerruf}/${e.gross_widerrufbar}`);
  pruefe('Familienfunktionen nicht anonym', e.anon_kinder === 'false', e.anon_kinder);

  console.log('\n5. Neue Fassung');
  pruefe('nur die geltende neue Fassung ist offen', e.a_neu_offen === '1' && e.a_neu_dok === 'nutzungsbedingungen', `${e.a_neu_offen}/${e.a_neu_dok}`);
  pruefe('„bisher“ nennt Fassung 1', e.a_neu_bisher === '1', e.a_neu_bisher);
  pruefe('alter Fassung kann man nicht mehr zustimmen', e.a_alt_fassung === 'fassung', e.a_alt_fassung);
  pruefe('F6: alte App (Text Fassung 1) stimmt Fassung 2 nicht zu', e.a_alte_app === 'veraltet', e.a_alte_app);
  pruefe('F6: falsche bzw. fehlende Prüfsumme abgewiesen', e.b_falsche_summe === 'veraltet' && e.b_ohne_summe === 'veraltet', `${e.b_falsche_summe}/${e.b_ohne_summe}`);
  pruefe('F6: alte Signatur ohne Prüfsumme gibt es nicht mehr', e.alte_signatur === 'weg', e.alte_signatur);
  pruefe('künftiger Fassung noch nicht', e.a_zukunft === 'fassung', e.a_zukunft);
  pruefe('neue Fassung zugestimmt, nichts mehr offen', e.a_neu_ok === 'true' && e.a_danach === '0', `${e.a_neu_ok}/${e.a_danach}`);
  console.log(`  INFO Altbestand übernommen (echte Konten, nur in der Transaktion): ${e.altbestand}`);

  console.log(`\n${anzahl - fehler}/${anzahl} Prüfungen bestanden, alles zurückgerollt.`);
  process.exit(fehler ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
