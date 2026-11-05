#!/usr/bin/env node
/**
 * Schema 97 (Kästen 28/9 und 15) in einer VERWORFENEN Transaktion proben.
 *
 * Der Ablauf während der Supabase-Sperre verlangt vor jedem Einspielen eine
 * Probe, die Angriff UND normalen Weg zeigt, als Prüfkonto mit
 * `set local role authenticated`. Diese Datei tut genau das:
 *
 *   begin;
 *     Schema 97 komplett
 *     Probe-Communitys anlegen (privat + öffentlich, Ersteller: Testkonto)
 *     als Prüfkonto:  fremd, nicht Mitglied — sehen, beitreten, anfragen
 *     als Testkonto:  Ersteller — Liste, Anfragen, annehmen
 *     als Prüfkonto:  jetzt Mitglied — sieht nur die eigene Zeile
 *     … Ablehnen, Mitteilungen
 *   Ergebnis per raise → alles zurückgerollt, nichts bleibt.
 *
 * Nur die eigenen Konten (Prüfkonto, Testkonto). Läuft auch bei gesperrtem
 * PostgREST (402), weil es über die Verwaltungs-API geht.
 *
 * Start:  SUPABASE_TOKEN=… SUPABASE_URL=https://….supabase.co node test/_probe97.js
 */

const fs = require('fs');
const path = require('path');
const { frage } = require('./_aufraeumen');

const PRUEFKONTO = '62616c1d-82e2-4ee4-aab9-950e40e438a4'; // all.media.prueflauf@web.de
const TESTKONTO = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4'; // test@all-media.app
const PRIV = '97979797-0000-4000-8000-000000000001';
const OEFF = '97979797-0000-4000-8000-000000000002';
const KANAL = '97979797-0000-4000-8000-000000000003';

let fehler = 0;
let anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

// Ergebnisse sammeln sich in einer Sitzungseinstellung, über Rollenwechsel hinweg.
const merke = (schluessel, ausdruck) =>
  `perform set_config('probe.erg', current_setting('probe.erg', true) || '${schluessel}=' || (${ausdruck})::text || ' ', true);`;
const versuch = (name, anweisung) => `
  begin ${anweisung}; ${merke(name, "'offen'")}
  exception when others then ${merke(name, "'zu'")}
  end;`;
const weg = (name, anweisung) => `
  begin ${anweisung}; ${merke(name, "'ok'")}
  exception when others then ${merke(name, "replace(sqlstate, ' ', '_')")}
  end;`;
const als = (konto, rumpf) => `
  reset role;
  select set_config('request.jwt.claims', '{"sub":"${konto}","role":"authenticated"}', true),
         set_config('request.jwt.claim.sub', '${konto}', true);
  set local role authenticated;
  do $p$ declare n int; begin
    ${rumpf}
  end $p$;
  reset role;`;

(async () => {
  if (!process.env.SUPABASE_TOKEN) {
    console.log('ÜBERSPRUNGEN  SUPABASE_TOKEN fehlt.');
    process.exit(2);
  }
  // Auftrag Pakete 1–3 (05.11.2026): Vorgänger, die live fehlen, in DERSELBEN
  // verworfenen Transaktion vorweg einspielen (VORGAENGER=pfad1,pfad2,…), danach
  // NACHFOLGER (z. B. Schema 117 erneut). Pfade absolut oder relativ zum Aufruf.
  const dateiListe = (v) => (process.env[v] || '').split(',').filter(Boolean)
    .map((f) => `-- ===== ${path.basename(f)}\n` + fs.readFileSync(path.resolve(f), 'utf8')).join('\n\n');
  const vorgaenger = dateiListe('VORGAENGER');
  const nachfolger = dateiListe('NACHFOLGER');
  if (!vorgaenger) console.log('HINWEIS  VORGAENGER leer — die Probe läuft nur gegen den Live-Stand.');
  const schema = fs.readFileSync(path.join(__dirname, '..', '..', 'SUPABASE_SCHEMA_97_mitglieder_beitritt.sql'), 'utf8');

  const sql = `
begin;
select set_config('probe.erg', '', true);
${vorgaenger}
${schema}
${nachfolger}

-- Bestand für die Probe (als Eigentümer, verworfen am Ende)
insert into public.communities (id, name, topic, visibility, created_by)
  values ('${PRIV}', 'Probe 97 privat', 'x', 'private', '${TESTKONTO}'),
         ('${OEFF}', 'Probe 97 offen', 'x', 'public', '${TESTKONTO}');
insert into public.community_members (community_id, user_id)
  values ('${PRIV}', '${TESTKONTO}'), ('${OEFF}', '${TESTKONTO}');
insert into public.community_channels (id, community_id, slug, name)
  values ('${KANAL}', '${PRIV}', 'allgemein', 'Allgemein');

${als(PRUEFKONTO, `
  select count(*) into n from public.communities where id = '${PRIV}'; ${merke('fremd_sieht_huelle', 'n')}
  select mitglieder_anzahl into n from public.communities where id = '${PRIV}'; ${merke('fremd_sieht_zahl', 'n')}
  select count(*) into n from public.community_members where community_id = '${PRIV}'; ${merke('fremd_liste_privat', 'n')}
  select count(*) into n from public.community_members where community_id = '${OEFF}'; ${merke('fremd_liste_offen', 'n')}
  select count(*) into n from public.community_channels where community_id = '${PRIV}'; ${merke('fremd_kanaele_privat', 'n')}
  ${versuch('direkt_beitreten_privat', `insert into public.community_members (community_id, user_id) values ('${PRIV}', auth.uid())`)}
  ${versuch('anfrage_offen', `insert into public.community_beitrittsanfragen (community_id, user_id) values ('${OEFF}', auth.uid())`)}
  ${versuch('anfrage_fuer_andere', `insert into public.community_beitrittsanfragen (community_id, user_id) values ('${PRIV}', '${TESTKONTO}')`)}
  ${weg('anfrage_stellen', `insert into public.community_beitrittsanfragen (community_id, user_id) values ('${PRIV}', auth.uid())`)}
  ${versuch('selbst_annehmen', `perform public.beitrittsanfrage_annehmen('${PRIV}', auth.uid())`)}
  ${versuch('zahl_faelschen', `insert into public.communities (name, visibility, created_by, mitglieder_basis, mitglieder_anzahl) values ('Probe 97 falsch', 'public', auth.uid(), 50000, 999)`)}
  select coalesce(max(mitglieder_basis + mitglieder_anzahl), -1) into n from public.communities where name = 'Probe 97 falsch'; ${merke('gefaelscht_zahl', 'n')}
`)}
`;
  // Ab hier wieder als Eigentümer: Mitteilungen liest nur der Empfänger, die Probe alle.
  const rest = `
do $p$ declare n int; begin
  select count(*) into n from public.notifications
   where user_id = '${TESTKONTO}' and actor_id = '${PRUEFKONTO}' and art = 'beitritt_anfrage' and target_id = '${PRIV}';
  ${merke('mitteilung_an_ersteller', 'n')}
end $p$;

${als(TESTKONTO, `
  select count(*) into n from public.community_members where community_id = '${PRIV}'; ${merke('ersteller_liste_privat', 'n')}
  select count(*) into n from public.community_beitrittsanfragen where community_id = '${PRIV}'; ${merke('ersteller_sieht_anfragen', 'n')}
  ${weg('annehmen', `perform public.beitrittsanfrage_annehmen('${PRIV}', '${PRUEFKONTO}')`)}
  select mitglieder_anzahl into n from public.communities where id = '${PRIV}'; ${merke('zahl_nach_annahme', 'n')}
  select count(*) into n from public.community_beitrittsanfragen where community_id = '${PRIV}'; ${merke('anfragen_nach_annahme', 'n')}
`)}

do $p$ declare n int; begin
  select count(*) into n from public.notifications
   where user_id = '${PRUEFKONTO}' and actor_id = '${TESTKONTO}' and art = 'beitritt_ok' and target_id = '${PRIV}';
  ${merke('mitteilung_angenommen', 'n')}
  select count(*) into n from public.notifications
   where user_id = '${TESTKONTO}' and art = 'beitritt_anfrage' and target_id = '${PRIV}';
  ${merke('anfrage_mitteilung_weg', 'n')}
end $p$;

${als(PRUEFKONTO, `
  select count(*) into n from public.community_members where community_id = '${PRIV}'; ${merke('mitglied_liste_privat', 'n')}
  select count(*) into n from public.community_channels where community_id = '${PRIV}'; ${merke('mitglied_kanaele_privat', 'n')}
  ${weg('verlassen', `delete from public.community_members where community_id = '${PRIV}' and user_id = auth.uid()`)}
  select mitglieder_anzahl into n from public.communities where id = '${PRIV}'; ${merke('zahl_nach_verlassen', 'n')}
  ${weg('neu_anfragen', `insert into public.community_beitrittsanfragen (community_id, user_id) values ('${PRIV}', auth.uid())`)}
`)}

${als(TESTKONTO, `
  delete from public.community_beitrittsanfragen where community_id = '${PRIV}' and user_id = '${PRUEFKONTO}';
  get diagnostics n = row_count; ${merke('ablehnen_zeilen', 'n')}
`)}

-- Codex-Fund 05.11.2026: Anfrage → Blockierung → Annahme muss scheitern.
-- Richtung 1: der Fragende blockiert den Ersteller.
${als(PRUEFKONTO, `
  ${weg('anfrage_vor_block', `insert into public.community_beitrittsanfragen (community_id, user_id) values ('${PRIV}', auth.uid())`)}
`)}
insert into public.blocks (user_id, blocked_user_id) values ('${PRUEFKONTO}', '${TESTKONTO}') on conflict do nothing;
do $p$ declare n int; begin
  select count(*) into n from public.community_beitrittsanfragen
   where community_id = '${PRIV}' and user_id = '${PRUEFKONTO}';
  ${merke('anfrage_nach_block', 'n')}
end $p$;
-- Anfrage als Eigentümer zurücklegen: prüft die Funktion selbst, nicht nur
-- den Aufräum-Auslöser.
insert into public.community_beitrittsanfragen (community_id, user_id) values ('${PRIV}', '${PRUEFKONTO}');
${als(TESTKONTO, `
  ${weg('annehmen_trotz_block_1', `perform public.beitrittsanfrage_annehmen('${PRIV}', '${PRUEFKONTO}')`)}
`)}
-- Richtung 2: der Ersteller blockiert den Fragenden.
delete from public.blocks where user_id = '${PRUEFKONTO}' and blocked_user_id = '${TESTKONTO}';
insert into public.blocks (user_id, blocked_user_id) values ('${TESTKONTO}', '${PRUEFKONTO}') on conflict do nothing;
insert into public.community_beitrittsanfragen (community_id, user_id) values ('${PRIV}', '${PRUEFKONTO}')
  on conflict do nothing;
${als(TESTKONTO, `
  ${weg('annehmen_trotz_block_2', `perform public.beitrittsanfrage_annehmen('${PRIV}', '${PRUEFKONTO}')`)}
`)}
do $p$ declare n int; begin
  select count(*) into n from public.community_members
   where community_id = '${PRIV}' and user_id = '${PRUEFKONTO}';
  ${merke('mitglied_trotz_block', 'n')}
end $p$;

do $p$ begin raise exception 'ERG:%', current_setting('probe.erg', true); end $p$;
`;

  const antwort = await frage(sql + rest);
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
  console.log('\nFremd (Prüfkonto, nicht Mitglied)');
  pruefe('15.1 private Community auffindbar (Hülle)', w.fremd_sieht_huelle === '1', w.fremd_sieht_huelle);
  pruefe('9.3 Zahl sichtbar (1 = Ersteller)', w.fremd_sieht_zahl === '1', w.fremd_sieht_zahl);
  pruefe('9.3/9.5 Liste einer privaten Community: nichts', w.fremd_liste_privat === '0', w.fremd_liste_privat);
  pruefe('9.2 Liste einer öffentlichen Community: sichtbar', w.fremd_liste_offen === '1', w.fremd_liste_offen);
  pruefe('15.1 Unterthemen einer privaten Community: unsichtbar', w.fremd_kanaele_privat === '0', w.fremd_kanaele_privat);
  pruefe('15.3 Direktbeitritt privat: zu', w.direkt_beitreten_privat === 'zu', w.direkt_beitreten_privat);
  pruefe('15.3 Anfrage an öffentliche Community: zu', w.anfrage_offen === 'zu', w.anfrage_offen);
  pruefe('15.3 Anfrage im Namen anderer: zu', w.anfrage_fuer_andere === 'zu', w.anfrage_fuer_andere);
  pruefe('15.1 Anfrage stellen: ok', w.anfrage_stellen === 'ok', w.anfrage_stellen);
  pruefe('15.3 sich selbst annehmen: zu', w.selbst_annehmen === 'zu', w.selbst_annehmen);
  pruefe('9.3 Zahl beim Anlegen nicht fälschbar', w.gefaelscht_zahl === '0' || w.zahl_faelschen === 'zu', `${w.zahl_faelschen} ${w.gefaelscht_zahl}`);
  pruefe('15.2 Mitteilung „möchte beitreten“ beim Ersteller', w.mitteilung_an_ersteller === '1', w.mitteilung_an_ersteller);
  console.log('\nErsteller (Testkonto)');
  pruefe('9.4 Ersteller sieht die Liste der privaten Community', w.ersteller_liste_privat === '1', w.ersteller_liste_privat);
  pruefe('15.2 Ersteller sieht die Anfrage', w.ersteller_sieht_anfragen === '1', w.ersteller_sieht_anfragen);
  pruefe('15.2 Annehmen: ok', w.annehmen === 'ok', w.annehmen);
  pruefe('9.3 Zahl zählt mit (2)', w.zahl_nach_annahme === '2', w.zahl_nach_annahme);
  pruefe('15.2 Anfrage danach weg', w.anfragen_nach_annahme === '0', w.anfragen_nach_annahme);
  pruefe('15.2 Mitteilung „angenommen“ beim Fragenden', w.mitteilung_angenommen === '1', w.mitteilung_angenommen);
  pruefe('15.2 Frage beim Ersteller erledigt', w.anfrage_mitteilung_weg === '0', w.anfrage_mitteilung_weg);
  console.log('\nJetzt Mitglied (Prüfkonto)');
  pruefe('9.3 Mitglied einer privaten Community sieht nur die eigene Zeile', w.mitglied_liste_privat === '1', w.mitglied_liste_privat);
  pruefe('15.2 Mitglied sieht die Unterthemen', w.mitglied_kanaele_privat === '1', w.mitglied_kanaele_privat);
  pruefe('Verlassen: ok, Zahl wieder 1', w.verlassen === 'ok' && w.zahl_nach_verlassen === '1', `${w.verlassen} ${w.zahl_nach_verlassen}`);
  pruefe('15.1 erneut anfragen: ok', w.neu_anfragen === 'ok', w.neu_anfragen);
  console.log('\nAblehnen');
  pruefe('15.2 Ersteller lehnt ab (1 Zeile gelöscht)', w.ablehnen_zeilen === '1', w.ablehnen_zeilen);
  console.log('\nAnfrage → Blockierung → Annahme (Codex-Fund 05.11.)');
  pruefe('Anfrage vor der Blockierung: ok', w.anfrage_vor_block === 'ok', w.anfrage_vor_block);
  pruefe('Blockierung räumt die offene Anfrage ab', w.anfrage_nach_block === '0', w.anfrage_nach_block);
  // P0001 = „Diese Anfrage gibt es nicht mehr“ — der Satz, den App und Website zeigen.
  pruefe('Fragender blockiert Ersteller → Annahme scheitert (P0001)', w.annehmen_trotz_block_1 === 'P0001', w.annehmen_trotz_block_1);
  pruefe('Ersteller blockiert Fragenden → Annahme scheitert (P0001)', w.annehmen_trotz_block_2 === 'P0001', w.annehmen_trotz_block_2);
  pruefe('keine Mitgliedschaft trotz Blockierung', w.mitglied_trotz_block === '0', w.mitglied_trotz_block);

  console.log(`\n${anzahl - fehler}/${anzahl} Prüfungen bestanden (alles verworfen)`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
