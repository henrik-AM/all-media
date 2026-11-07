#!/usr/bin/env node
/**
 * Schema 120 („Gruppen: wer darf hinzufügen" wirkt) in einer VERWORFENEN
 * Transaktion proben — Vorlage _probe97.js.
 *
 *   begin;
 *   Probe-Gruppe (Ersteller: Testkonto), Einstellung des Prüfkontos setzen
 *   VOR Schema 120:  Testkonto holt Prüfkonto bei „Niemand" / „Alle"
 *   Schema 120
 *   NACH Schema 120: dasselbe, plus Vorgabe (keine Zeile) = Kontaktregel
 *   Rechte: anon darf darf_in_gruppe_holen nicht ausführen
 *   Ergebnis per raise → alles zurückgerollt.
 *
 * Nur eigene Konten. Start: SUPABASE_TOKEN=… node test/_probe120.js
 */
const fs = require('fs');
const path = require('path');
const { frage } = require('./_aufraeumen');

const PRUEFKONTO = '62616c1d-82e2-4ee4-aab9-950e40e438a4'; // all.media.prueflauf@web.de
const TESTKONTO = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4'; // test@all-media.app
const GRUPPE = '12012012-0000-4000-8000-000000000001';

let fehler = 0;
let anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

const merke = (schluessel, ausdruck) =>
  `perform set_config('probe.erg', current_setting('probe.erg', true) || '${schluessel}=' || (${ausdruck})::text || ' ', true);`;
const versuch = (name, anweisung) => `
  begin ${anweisung}; ${merke(name, "'offen'")}
  exception when others then ${merke(name, "'zu'")}
  end;`;
const als = (konto, rumpf) => `
  reset role;
  select set_config('request.jwt.claims', '{"sub":"${konto}","role":"authenticated"}', true),
         set_config('request.jwt.claim.sub', '${konto}', true);
  set local role authenticated;
  do $p$ declare n int; b boolean; begin
    ${rumpf}
  end $p$;
  reset role;`;

const wahl = (wert) => wert === null
  ? `delete from public.user_settings where user_id = '${PRUEFKONTO}' and schluessel = 'gruppenHinzufuegen';`
  : `insert into public.user_settings (user_id, schluessel, wert) values ('${PRUEFKONTO}', 'gruppenHinzufuegen', '${wert}')
       on conflict (user_id, schluessel) do update set wert = excluded.wert;`;

// Testkonto versucht, das Prüfkonto in die Gruppe zu holen; danach wieder raus (als Eigentümer).
const holen = (name) => `
${als(TESTKONTO, versuch(name, `insert into public.chat_members (chat_id, user_id) values ('${GRUPPE}', '${PRUEFKONTO}')`))}
delete from public.chat_members where chat_id = '${GRUPPE}' and user_id = '${PRUEFKONTO}';`;

(async () => {
  if (!process.env.SUPABASE_TOKEN) {
    console.log('ÜBERSPRUNGEN  SUPABASE_TOKEN fehlt.');
    process.exit(2);
  }
  const schema = fs.readFileSync(path.join(__dirname, '..', '..', 'SUPABASE_SCHEMA_120_gruppen_einstellung_lesbar.sql'), 'utf8');

  const sql = `
begin;
select set_config('probe.erg', '', true);

insert into public.chats (id, name, is_group, bereich, created_by)
  values ('${GRUPPE}', 'Probe 120', true, 'community', '${TESTKONTO}');
insert into public.chat_members (chat_id, user_id) values ('${GRUPPE}', '${TESTKONTO}');

do $p$ begin ${merke('kontakt', `public.ist_messenger_kontakt('${PRUEFKONTO}'::uuid, '${TESTKONTO}'::uuid)`)} end $p$;

-- VOR Schema 120 (Live-Stand)
${wahl('Niemand')}
${holen('vor_niemand')}
${wahl('Alle')}
${holen('vor_alle')}

${schema}

-- NACH Schema 120
${wahl('Niemand')}
${holen('nach_niemand')}
${wahl('Alle')}
${holen('nach_alle')}
${wahl(null)}
${holen('nach_vorgabe')}

${als(PRUEFKONTO, `
  ${versuch('selbst_in_fremde_gruppe', `insert into public.chat_members (chat_id, user_id) values ('${GRUPPE}', auth.uid())`)}
`)}

do $p$ begin
  ${merke('anon_darf', `has_function_privilege('anon', 'public.darf_in_gruppe_holen(uuid)', 'execute')`)}
  ${merke('public_darf', `has_function_privilege('public', 'public.darf_in_gruppe_holen(uuid)', 'execute')`)}
  ${merke('auth_darf', `has_function_privilege('authenticated', 'public.darf_in_gruppe_holen(uuid)', 'execute')`)}
  ${merke('mw_anon', `has_function_privilege('anon', 'public.darf_mitglied_werden(uuid,uuid)', 'execute')`)}
end $p$;

do $p$ begin raise exception 'ERG:%', current_setting('probe.erg', true); end $p$;
`;

  const antwort = await frage(sql);
  const text = JSON.stringify(antwort || '');
  const treffer = text.match(/ERG:(.*?)(\\n|")/);
  if (!treffer) {
    console.log('Keine Antwort aus der Probe: ' + text.slice(0, 600));
    process.exit(1);
  }
  const w = {};
  for (const paar of treffer[1].trim().split(/\s+/)) {
    const [k, ...r] = paar.split('=');
    if (k) w[k] = r.join('=');
  }
  const kontakt = w.kontakt === 'true';
  console.log(`\nAusgang: Prüfkonto hat Testkonto ${kontakt ? '' : 'NICHT '}als Messenger-Kontakt`);

  console.log('\nVor Schema 120 (Live-Stand, belegt den Fehler)');
  console.log(`  INFO  „Niemand": ${w.vor_niemand}, „Alle": ${w.vor_alle} (beide = Vorgabe, Einstellung unlesbar)`);
  pruefe('Live ignoriert die Einstellung (Niemand und Alle gleich)', w.vor_niemand === w.vor_alle, `${w.vor_niemand}/${w.vor_alle}`);

  console.log('\nNach Schema 120');
  pruefe('„Niemand": niemand holt sie in eine Gruppe', w.nach_niemand === 'zu', w.nach_niemand);
  pruefe('„Alle": jeder darf sie hinzufügen', w.nach_alle === 'offen', w.nach_alle);
  pruefe('Ohne Einstellung gilt „Meine Kontakte"', w.nach_vorgabe === (kontakt ? 'offen' : 'zu'), w.nach_vorgabe);
  pruefe('Sich selbst in eine fremde Gruppe: zu', w.selbst_in_fremde_gruppe === 'zu', w.selbst_in_fremde_gruppe);

  console.log('\nRechte');
  pruefe('anon darf darf_in_gruppe_holen nicht', w.anon_darf === 'false', w.anon_darf);
  pruefe('PUBLIC darf darf_in_gruppe_holen nicht', w.public_darf === 'false', w.public_darf);
  pruefe('authenticated darf (RLS-Regel ruft sie)', w.auth_darf === 'true', w.auth_darf);
  pruefe('anon darf darf_mitglied_werden weiterhin nicht', w.mw_anon === 'false', w.mw_anon);

  console.log(`\n${anzahl - fehler}/${anzahl} Prüfungen bestanden (alles verworfen)`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
