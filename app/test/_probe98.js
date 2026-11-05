#!/usr/bin/env node
/**
 * Schema 98 (Kasten 28/15.4, Befreunden) in einer VERWORFENEN Transaktion
 * proben — Vorlage _probe97.js.
 *
 *   begin;
 *     Schema 98 komplett
 *     Prüfkonto privat, Testkonto öffentlich (nur in dieser Transaktion)
 *     als Testkonto:  an das private Prüfkonto → Anfrage; Angriffe
 *     als Prüfkonto:  sieht die Anfrage, nimmt an
 *     als Testkonto:  beendet die Freundschaft
 *     als Prüfkonto:  an das öffentliche Testkonto → sofort befreundet
 *     Blockieren beendet sie; danach keine neue Anfrage
 *   Ergebnis per raise → alles zurückgerollt, nichts bleibt.
 *
 * Nur die eigenen Konten (Prüfkonto, Testkonto). Läuft auch bei gesperrtem
 * PostgREST (402), weil es über die Verwaltungs-API geht.
 *
 * Start:  SUPABASE_TOKEN=… SUPABASE_URL=https://….supabase.co node test/_probe98.js
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
  do $p$ declare n int; b boolean; begin
    ${rumpf}
  end $p$;
  reset role;`;
const eigner = (rumpf) => `
  do $p$ declare n int; b boolean; begin
    ${rumpf}
  end $p$;`;

const mitteilungen = (an, von, art) =>
  `select count(*) into n from public.notifications where user_id = '${an}' and actor_id = '${von}' and art = '${art}';`;

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
  const schema = fs.readFileSync(path.join(__dirname, '..', '..', 'SUPABASE_SCHEMA_98_freundschaften.sql'), 'utf8');

  const sql = `
begin;
select set_config('probe.erg', '', true);
${vorgaenger}
${schema}
${nachfolger}

-- Bestand für die Probe (als Eigentümer, verworfen am Ende)
update public.profiles set privat = true where id = '${PRUEFKONTO}';
update public.profiles set privat = false where id = '${TESTKONTO}';
${eigner(`
  select count(*) into n from public.blocks
   where (user_id = '${TESTKONTO}' and blocked_user_id = '${PRUEFKONTO}')
      or (user_id = '${PRUEFKONTO}' and blocked_user_id = '${TESTKONTO}');
  ${merke('blockiert_vorher', 'n')}
`)}

${als(TESTKONTO, `
  ${weg('anfrage_privat', `insert into public.freundschaften (von, an) values (auth.uid(), '${PRUEFKONTO}')`)}
  select angenommen into b from public.freundschaften where von = auth.uid() and an = '${PRUEFKONTO}'; ${merke('privat_gleich_angenommen', 'b')}
  ${versuch('fuer_andere', `insert into public.freundschaften (von, an) values ('${PRUEFKONTO}', auth.uid())`)}
  ${versuch('selbst', `insert into public.freundschaften (von, an) values (auth.uid(), auth.uid())`)}
  ${versuch('selbst_auf_angenommen', `update public.freundschaften set angenommen = true where von = auth.uid() and an = '${PRUEFKONTO}'`)}
  select angenommen into b from public.freundschaften where von = auth.uid() and an = '${PRUEFKONTO}'; ${merke('nach_update_angenommen', 'b')}
  ${versuch('eigene_anfrage_annehmen', `perform public.freundschaft_annehmen('${PRUEFKONTO}')`)}
`)}

${eigner(`${mitteilungen(PRUEFKONTO, TESTKONTO, 'freund_anfrage')} ${merke('mitteilung_anfrage', 'n')}`)}

${als(PRUEFKONTO, `
  select count(*) into n from public.freundschaften where an = auth.uid(); ${merke('empfaenger_sieht', 'n')}
  ${versuch('gegenrichtung_doppelt', `insert into public.freundschaften (von, an) values (auth.uid(), '${TESTKONTO}')`)}
  ${weg('annehmen', `perform public.freundschaft_annehmen('${TESTKONTO}')`)}
  select count(*) into n from public.freundschaften where an = auth.uid() and angenommen; ${merke('nach_annahme', 'n')}
  ${versuch('zweimal_annehmen', `perform public.freundschaft_annehmen('${TESTKONTO}')`)}
`)}

${eigner(`
  ${mitteilungen(PRUEFKONTO, TESTKONTO, 'freund_anfrage')} ${merke('anfrage_mitteilung_weg', 'n')}
  ${mitteilungen(TESTKONTO, PRUEFKONTO, 'freund_ok')} ${merke('mitteilung_ok', 'n')}
`)}

${als(TESTKONTO, `
  delete from public.freundschaften where von = auth.uid() and an = '${PRUEFKONTO}';
  get diagnostics n = row_count; ${merke('beenden_zeilen', 'n')}
`)}

${eigner(`${mitteilungen(TESTKONTO, PRUEFKONTO, 'freund_ok')} ${merke('ok_vorher', 'n')}`)}

${als(PRUEFKONTO, `
  ${weg('anfrage_oeffentlich', `insert into public.freundschaften (von, an) values (auth.uid(), '${TESTKONTO}')`)}
  select angenommen into b from public.freundschaften where von = auth.uid() and an = '${TESTKONTO}'; ${merke('oeffentlich_sofort', 'b')}
`)}

${eigner(`
  ${mitteilungen(TESTKONTO, PRUEFKONTO, 'freund_ok')} ${merke('mitteilung_ok_oeffentlich', 'n')}
  ${mitteilungen(TESTKONTO, PRUEFKONTO, 'freund_anfrage')} ${merke('keine_anfrage_oeffentlich', 'n')}
`)}

${als(TESTKONTO, `
  insert into public.blocks (user_id, blocked_user_id) values (auth.uid(), '${PRUEFKONTO}') on conflict do nothing;
`)}

${eigner(`
  select count(*) into n from public.freundschaften
   where (von = '${TESTKONTO}' and an = '${PRUEFKONTO}') or (von = '${PRUEFKONTO}' and an = '${TESTKONTO}');
  ${merke('nach_blockieren', 'n')}
`)}

${als(PRUEFKONTO, `
  ${versuch('anfrage_blockiert', `insert into public.freundschaften (von, an) values (auth.uid(), '${TESTKONTO}')`)}
`)}

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
  pruefe('Ausgangslage: keine Blockierung zwischen den Konten', w.blockiert_vorher === '0', w.blockiert_vorher);
  console.log('\nAn ein privates Profil (Testkonto → Prüfkonto)');
  pruefe('15.4 Anfrage stellen: ok', w.anfrage_privat === 'ok', w.anfrage_privat);
  pruefe('15.4 privat: erst Anfrage, nicht befreundet', w.privat_gleich_angenommen === 'false', w.privat_gleich_angenommen);
  pruefe('15.4 Anfrage im Namen anderer: zu', w.fuer_andere === 'zu', w.fuer_andere);
  pruefe('15.4 mit sich selbst: zu', w.selbst === 'zu', w.selbst);
  pruefe('15.4 eigene Anfrage per UPDATE annehmen: zu', w.selbst_auf_angenommen === 'zu' && w.nach_update_angenommen === 'false', `${w.selbst_auf_angenommen} ${w.nach_update_angenommen}`);
  pruefe('15.4 eigene Anfrage per Funktion annehmen: zu', w.eigene_anfrage_annehmen === 'zu', w.eigene_anfrage_annehmen);
  pruefe('15.4 Mitteilung „möchte mit dir befreundet sein“ beim Empfänger', w.mitteilung_anfrage === '1', w.mitteilung_anfrage);
  console.log('\nEmpfänger (Prüfkonto)');
  pruefe('15.4 Empfänger sieht die Anfrage', w.empfaenger_sieht === '1', w.empfaenger_sieht);
  pruefe('15.4 Gegenanfrage neben der offenen: zu (ein Paar, eine Zeile)', w.gegenrichtung_doppelt === 'zu', w.gegenrichtung_doppelt);
  pruefe('15.4 Annehmen: ok', w.annehmen === 'ok', w.annehmen);
  pruefe('15.4 danach befreundet', w.nach_annahme === '1', w.nach_annahme);
  pruefe('15.4 zweites Annehmen: zu', w.zweimal_annehmen === 'zu', w.zweimal_annehmen);
  pruefe('15.4 Anfrage-Mitteilung danach weg', w.anfrage_mitteilung_weg === '0', w.anfrage_mitteilung_weg);
  pruefe('15.4 Mitteilung „seid jetzt befreundet“ beim Fragenden', w.mitteilung_ok === '1', w.mitteilung_ok);
  pruefe('15.4 Freundschaft beenden (1 Zeile)', w.beenden_zeilen === '1', w.beenden_zeilen);
  console.log('\nAn ein öffentliches Profil (Prüfkonto → Testkonto)');
  pruefe('15.4 Anfrage stellen: ok', w.anfrage_oeffentlich === 'ok', w.anfrage_oeffentlich);
  pruefe('15.4 öffentlich: sofort befreundet', w.oeffentlich_sofort === 'true', w.oeffentlich_sofort);
  // Gezählt wird der Zuwachs: die Mitteilung aus der ersten Freundschaft steht noch.
  pruefe('15.4 eine neue Mitteilung „seid jetzt befreundet“, keine Anfrage',
    Number(w.mitteilung_ok_oeffentlich) - Number(w.ok_vorher) === 1 && w.keine_anfrage_oeffentlich === '0',
    `${w.ok_vorher} → ${w.mitteilung_ok_oeffentlich}, Anfragen ${w.keine_anfrage_oeffentlich}`);
  console.log('\nBlockieren');
  pruefe('15.4 Blockieren beendet die Freundschaft', w.nach_blockieren === '0', w.nach_blockieren);
  pruefe('15.4 danach keine neue Anfrage', w.anfrage_blockiert === 'zu', w.anfrage_blockiert);

  console.log(`\n${anzahl - fehler}/${anzahl} Prüfungen bestanden (alles verworfen)`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
