#!/usr/bin/env node
/**
 * Schema 118 (Medienadresse mit eigenem Host) in einer VERWORFENEN
 * Transaktion proben.
 *
 * Codex-Review 05.11.2026: `profiles_avatar_url_eimer` und
 * `sammlungen_titelbild_eimer` prüften nur das Pfadende — eine Adresse wie
 * https://boese.example/storage/v1/object/public/media/avatars/x.png ging
 * durch, und die Auslöser aus 115/117 überspringen sie.
 *
 * Die Probe spielt SUPABASE_SCHEMA_118_medienadresse_host.sql ein, schreibt
 * als Prüfkonto (`set local role authenticated`) fremde und eigene Adressen
 * in Profilbild und Titelbild und rollt am Ende alles per raise zurück.
 * Nur das eigene Prüfkonto und das Testkonto (als Eigentümer einer fremden
 * Datei, nur in medien_objekte, verworfen).
 *
 * Gegenprobe: SCHEMAS= (leer) spielt 118 NICHT ein — dann müssen die
 * Fälle „fremder Host“ offen sein (die Lücke ist live).
 *
 * Vorlage: test/_probe_paket1.js (Paket 1).
 *
 * Start:  SUPABASE_TOKEN=… node test/_probe118.js
 */

const fs = require('fs');
const path = require('path');
const { frage } = require('./_aufraeumen');

const WURZEL = path.join(__dirname, '..', '..');
const PRUEFKONTO = '62616c1d-82e2-4ee4-aab9-950e40e438a4'; // all.media.prueflauf@web.de
const TESTKONTO = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4'; // test@all-media.app
const SAMMLUNG = '11811811-0000-4000-8000-000000000001';
const EIGEN = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/';
const BOESE = 'https://boese.example/storage/v1/object/public/media/';

const AVATAR_EIGEN = `avatars/${PRUEFKONTO}-probe118-eigen.png`;
const AVATAR_FREMD = `avatars/${TESTKONTO}-probe118-fremd.png`;
const TITEL_EIGEN = `stories/${PRUEFKONTO}-probe118-titel.jpg`;

const DATEIEN = ['SUPABASE_SCHEMA_118_medienadresse_host.sql'];

let fehler = 0;
let anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

const merke = (schluessel, ausdruck) =>
  `perform set_config('probe.erg', current_setting('probe.erg', true) || '${schluessel}=' || replace(coalesce((${ausdruck})::text, 'null'), ' ', '_') || ' ', true);`;
// Eine Änderung gilt nur als „offen“, wenn sie wirklich eine Zeile traf.
const versuch = (name, anweisung) => `
  begin ${anweisung}; get diagnostics n = row_count; if n = 0 then raise exception 'keine Zeile'; end if; ${merke(name, "'offen'")}
  exception when others then ${merke(name, "'zu'")}
  end;`;
const weg = (name, anweisung) => `
  begin ${anweisung}; get diagnostics n = row_count; if n = 0 then raise exception 'keine Zeile'; end if; ${merke(name, "'ok'")}
  exception when others then ${merke(name, "sqlstate")}
  end;`;
const als = (konto, rumpf) => `
  reset role;
  select set_config('request.jwt.claims', '{"sub":"${konto}","role":"authenticated"}', true),
         set_config('request.jwt.claim.sub', '${konto}', true);
  set local role authenticated;
  do $p$ declare n int; t text; begin
    ${rumpf}
  end $p$;
  reset role;`;
const eigner = (rumpf) => `
  do $p$ declare n int; t text; begin
    ${rumpf}
  end $p$;`;

(async () => {
  if (!process.env.SUPABASE_TOKEN) {
    console.log('ÜBERSPRUNGEN  SUPABASE_TOKEN fehlt.');
    process.exit(2);
  }
  const gegenprobe = process.env.SCHEMAS !== undefined && !process.env.SCHEMAS.split(',').includes('118');
  if (gegenprobe) console.log('GEGENPROBE ohne Schema 118 — fremder Host muss offen sein.');
  const schemas = gegenprobe ? '' : DATEIEN
    .map((d) => `-- ===== ${d}\n` + fs.readFileSync(path.join(WURZEL, d), 'utf8'))
    .join('\n\n');

  const sql = `
begin;
select set_config('probe.erg', '', true);

${schemas}

-- Bestand für die Probe (als Eigentümer, verworfen am Ende):
-- eigene registrierte Dateien des Prüfkontos, eine fremde des Testkontos,
-- ein eigenes Highlight.
insert into public.medien_objekte (pfad, owner_id, typ, bytes, sha256)
  values ('${AVATAR_EIGEN}', '${PRUEFKONTO}', 'image/png', 1, repeat('a', 64)),
         ('${TITEL_EIGEN}', '${PRUEFKONTO}', 'image/jpeg', 1, repeat('c', 64)),
         ('${AVATAR_FREMD}', '${TESTKONTO}', 'image/png', 1, repeat('b', 64));
insert into public.sammlungen (id, user_id, art, name)
  values ('${SAMMLUNG}', '${PRUEFKONTO}', 'highlight', 'Probe 118');

${eigner(`
  select count(*) into n from pg_constraint
   where conname in ('profiles_avatar_url_eimer', 'sammlungen_titelbild_eimer')
     and pg_get_constraintdef(oid) ilike '%medien_adresse_gueltig%';
  ${merke('checks_mit_host', 'n')}
  select count(*) into n from pg_constraint
   where conname in ('profiles_avatar_url_eimer', 'sammlungen_titelbild_eimer') and convalidated;
  ${merke('checks_validiert', 'n')}
  select count(*) into n from public.profiles
   where avatar_url is not null and not public.medien_adresse_gueltig(avatar_url);
  ${merke('alt_profile_verletzt', 'n')}
  select count(*) into n from public.sammlungen
   where titelbild_url is not null and not public.medien_adresse_gueltig(titelbild_url);
  ${merke('alt_sammlungen_verletzt', 'n')}
`)}

${als(PRUEFKONTO, `
  -- Profilbild
  ${versuch('pb_fremder_host', `update public.profiles set avatar_url = '${BOESE}${AVATAR_EIGEN}' where id = auth.uid()`)}
  ${versuch('pb_fremder_host_kurz', `update public.profiles set avatar_url = '${BOESE}avatars/x.png' where id = auth.uid()`)}
  ${versuch('pb_host_praefix', `update public.profiles set avatar_url = 'https://ijztosbjfybdgotpdixw.supabase.co.boese.example/storage/v1/object/public/media/${AVATAR_EIGEN}' where id = auth.uid()`)}
  ${versuch('pb_eigen_mit_query', `update public.profiles set avatar_url = '${EIGEN}${AVATAR_EIGEN}?t=1' where id = auth.uid()`)}
  ${versuch('pb_fremde_datei', `update public.profiles set avatar_url = '${EIGEN}${AVATAR_FREMD}' where id = auth.uid()`)}
  ${weg('pb_eigen', `update public.profiles set avatar_url = '${EIGEN}${AVATAR_EIGEN}' where id = auth.uid()`)}
  select avatar_url into t from public.profiles where id = auth.uid(); ${merke('pb_gespeichert', 't')}
  ${weg('pb_entfernen', `update public.profiles set avatar_url = null where id = auth.uid()`)}

  -- Titelbild (Highlight)
  ${versuch('tb_fremder_host', `update public.sammlungen set titelbild_url = '${BOESE}${TITEL_EIGEN}' where id = '${SAMMLUNG}'`)}
  ${versuch('tb_falscher_ordner', `update public.sammlungen set titelbild_url = '${EIGEN}${AVATAR_EIGEN}' where id = '${SAMMLUNG}'`)}
  ${weg('tb_eigen', `update public.sammlungen set titelbild_url = '${EIGEN}${TITEL_EIGEN}' where id = '${SAMMLUNG}'`)}
  select titelbild_url into t from public.sammlungen where id = '${SAMMLUNG}'; ${merke('tb_gespeichert', 't')}
  ${weg('tb_entfernen', `update public.sammlungen set titelbild_url = null where id = '${SAMMLUNG}'`)}
`)}

do $p$ begin raise exception 'ERG:%', current_setting('probe.erg', true); end $p$;
`;

  const antwort = await frage(sql);
  const text = JSON.stringify(antwort || '');
  const treffer = text.match(/ERG:(.*?)(\\n|")/);
  if (!treffer) {
    console.log('Keine Antwort aus der Probe: ' + text.slice(0, 900));
    process.exit(1);
  }
  const w = {};
  for (const paar of treffer[1].trim().split(/\s+/)) {
    const [k, ...r] = paar.split('=');
    if (k) w[k] = r.join('=');
  }

  const zu = gegenprobe ? 'offen' : 'zu';
  console.log('\nAufbau (als Eigentümer)');
  pruefe(`Altbestand: 0 Profilbilder verletzen die Regel`, w.alt_profile_verletzt === '0', w.alt_profile_verletzt);
  pruefe(`Altbestand: 0 Titelbilder verletzen die Regel`, w.alt_sammlungen_verletzt === '0', w.alt_sammlungen_verletzt);
  if (!gegenprobe) {
    pruefe('118: beide CHECKs mit medien_adresse_gueltig', w.checks_mit_host === '2', w.checks_mit_host);
    pruefe('118: beide CHECKs validiert', w.checks_validiert === '2', w.checks_validiert);
  } else {
    pruefe('Gegenprobe: live noch ohne Hostprüfung', w.checks_mit_host === '0', w.checks_mit_host);
  }

  console.log('\nPrüfkonto: Profilbild');
  pruefe(`fremder Host mit eigenem Pfad: ${zu}`, w.pb_fremder_host === zu, w.pb_fremder_host);
  pruefe(`fremder Host, beliebige Datei: ${zu}`, w.pb_fremder_host_kurz === zu, w.pb_fremder_host_kurz);
  pruefe(`Host als Präfix (…supabase.co.boese.example): ${zu}`, w.pb_host_praefix === zu, w.pb_host_praefix);
  pruefe('eigene Adresse mit ?t=: zu', w.pb_eigen_mit_query === 'zu', w.pb_eigen_mit_query);
  pruefe('eigener Host, fremde Datei (117): zu', w.pb_fremde_datei === 'zu', w.pb_fremde_datei);
  pruefe('eigene registrierte Datei: ok', w.pb_eigen === 'ok', w.pb_eigen);
  pruefe('… steht so in der Zeile', w.pb_gespeichert === EIGEN + AVATAR_EIGEN, w.pb_gespeichert);
  pruefe('Profilbild entfernen: ok', w.pb_entfernen === 'ok', w.pb_entfernen);

  console.log('\nPrüfkonto: Titelbild');
  pruefe(`fremder Host: ${zu}`, w.tb_fremder_host === zu, w.tb_fremder_host);
  pruefe('eigene Datei aus avatars/: zu', w.tb_falscher_ordner === 'zu', w.tb_falscher_ordner);
  pruefe('eigene registrierte Story-Datei: ok', w.tb_eigen === 'ok', w.tb_eigen);
  pruefe('… steht so in der Zeile', w.tb_gespeichert === EIGEN + TITEL_EIGEN, w.tb_gespeichert);
  pruefe('Titelbild entfernen: ok', w.tb_entfernen === 'ok', w.tb_entfernen);

  console.log(`\n${anzahl - fehler}/${anzahl} Prüfungen bestanden (alles verworfen)`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
