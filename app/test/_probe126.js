#!/usr/bin/env node
/**
 * Schema 126 (Zweierchat atomar) proben — nichts bleibt.
 *
 * Teil 1, eine VERWORFENE Transaktion (Schema 126 vorweg, falls noch nicht
 * eingespielt):
 *   als Testkonto:  zweimal zweierchat_anlegen(Prüfkonto, community)
 *                   → dieselbe ID, genau zwei Mitglieder, Anfrage „wartet“
 *                   (Auslöser chat_anfrage_setzen läuft wie beim Client-Weg)
 *   als Prüfkonto:  Gegenrichtung findet denselben Chat
 *   Angriffe:       anon ruft auf, Chat mit sich selbst, ohne Ziel
 *   Ergebnis per raise → alles zurückgerollt.
 *
 * Teil 2 (nur mit SCHLOSS=1, Schema muss eingespielt sein): zwei Aufrufe
 * gleichzeitig über zwei Verbindungen. A hält die Transaktion 4 s offen und
 * verwirft sie; B startet 1 s später und muss auf das Schloss warten
 * (Wartezeit ≥ 2,5 s). Beide verwerfen — kein Chat bleibt.
 *
 * Nur die eigenen Konten (Prüfkonto, Testkonto). Braucht keinen Testbestand.
 * Start:  SUPABASE_TOKEN=… node test/_probe126.js   [SCHLOSS=1]
 */

const fs = require('fs');
const path = require('path');

const PROJEKT = process.env.SUPABASE_PROJEKT || 'ijztosbjfybdgotpdixw';
const PRUEFKONTO = '62616c1d-82e2-4ee4-aab9-950e40e438a4';
const TESTKONTO = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4';

let fehler = 0;
let anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

async function sql(text) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJEKT}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SUPABASE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: text }),
  });
  return { ok: r.ok, text: await r.text() };
}

const merke = (k, ausdruck) =>
  `perform set_config('probe.erg', current_setting('probe.erg', true) || '${k}=' || coalesce((${ausdruck})::text, 'null') || ' ', true);`;
const als = (konto, rumpf) => `
  reset role;
  select set_config('request.jwt.claims', '{"sub":"${konto}","role":"authenticated"}', true),
         set_config('request.jwt.claim.sub', '${konto}', true);
  set local role authenticated;
  do $p$ declare a uuid; b uuid; n int; begin
    ${rumpf}
  end $p$;
  reset role;`;
const ergebnis = (text) => {
  const m = /ERG ([^"\\]*)/.exec(text);
  const erg = {};
  if (m) for (const teil of m[1].trim().split(/\s+/)) {
    const [k, v] = teil.split('=');
    erg[k] = v;
  }
  return erg;
};

(async () => {
  if (!process.env.SUPABASE_TOKEN) {
    console.log('ÜBERSPRUNGEN  SUPABASE_TOKEN fehlt.');
    process.exit(2);
  }
  const schema = fs.readFileSync(path.join(__dirname, '..', '..', 'SUPABASE_SCHEMA_126_zweierchat_atomar.sql'), 'utf8');

  console.log('Teil 1: verworfene Transaktion');
  const r = await sql(`
begin;
select set_config('probe.erg', '', true);
${schema}
${als(TESTKONTO, `
    a := public.zweierchat_anlegen('${PRUEFKONTO}', 'community', 'Probe126');
    b := public.zweierchat_anlegen('${PRUEFKONTO}', 'community', 'Probe126');
    ${merke('gleich', 'a = b')}
    ${merke('mitglieder', '(select count(*) from public.chat_members where chat_id = a)')}
    ${merke('bereich', '(select bereich from public.chats where id = a)')}
    ${merke('zustand', '(select anfrage_zustand from public.chats where id = a)')}
    perform set_config('probe.chat', a::text, true);
    begin perform public.zweierchat_anlegen('${TESTKONTO}', 'community', null); ${merke('selbst', "'offen'")}
    exception when others then ${merke('selbst', "'zu'")} end;
    begin perform public.zweierchat_anlegen(null, 'community', null); ${merke('ohneziel', "'offen'")}
    exception when others then ${merke('ohneziel', "'zu'")} end;
`)}
${als(PRUEFKONTO, `
    a := public.zweierchat_anlegen('${TESTKONTO}', 'community', 'Gegenrichtung');
    ${merke('gegen', "a::text = current_setting('probe.chat')")}
`)}
reset role;
delete from public.chat_members where chat_id = current_setting('probe.chat')::uuid;
delete from public.chats where id = current_setting('probe.chat')::uuid;
insert into public.blocks (user_id, blocked_user_id) values ('${PRUEFKONTO}', '${TESTKONTO}');
${als(TESTKONTO, `
    begin perform public.zweierchat_anlegen('${PRUEFKONTO}', 'community', 'Probe126'); ${merke('blockiert', "'offen'")}
    exception when others then ${merke('blockiert', "'zu'")} end;
    ${merke('halber', "(select count(*) from public.chats where name = 'Probe126')")}
`)}
reset role;
set local role anon;
do $p$ begin
  begin perform public.zweierchat_anlegen('${PRUEFKONTO}', 'community', null); ${merke('anon', "'offen'")}
  exception when others then ${merke('anon', "'zu'")} end;
end $p$;
reset role;
do $p$ begin raise exception 'ERG %', current_setting('probe.erg'); end $p$;
`);
  const e = ergebnis(r.text);
  if (!Object.keys(e).length) console.log('  Antwort: ' + r.text.slice(0, 600));
  pruefe('Zweimal angelegt → derselbe Chat', e.gleich === 'true', e.gleich);
  pruefe('Genau zwei Mitglieder', e.mitglieder === '2', e.mitglieder);
  pruefe('Bereich community', e.bereich === 'community', e.bereich);
  pruefe('Chat-Anfrage wie beim Client-Weg (Auslöser lief als authenticated)', ['wartet', 'offen'].includes(e.zustand), e.zustand);
  pruefe('Gegenrichtung findet denselben Chat', e.gegen === 'true', e.gegen);
  pruefe('Chat mit sich selbst abgewiesen', e.selbst === 'zu', e.selbst);
  pruefe('Ohne Ziel abgewiesen', e.ohneziel === 'zu', e.ohneziel);
  pruefe('anon darf nicht aufrufen', e.anon === 'zu', e.anon);
  pruefe('Blockiert → abgewiesen (RLS gilt in der Funktion)', e.blockiert === 'zu', e.blockiert);
  pruefe('Abgewiesen → keine halbe Chatzeile', e.halber === '0', e.halber);

  if (process.env.SCHLOSS === '1') {
    console.log('\nTeil 2: zwei Verbindungen gleichzeitig (Schloss)');
    const lauf = (warteVorher, halte) => `
begin;
select set_config('probe.erg', '', true);
select pg_sleep(${warteVorher});
${als(TESTKONTO, `
    perform set_config('probe.t0', clock_timestamp()::text, true);
    a := public.zweierchat_anlegen('${PRUEFKONTO}', 'community', 'Probe126');
    ${merke('warte', "round(extract(epoch from clock_timestamp() - current_setting('probe.t0')::timestamptz)::numeric, 2)")}
    perform pg_sleep(${halte});
`)}
do $p$ begin raise exception 'ERG %', current_setting('probe.erg'); end $p$;`;
    const [ra, rb] = await Promise.all([sql(lauf(0, 4)), sql(lauf(1, 0))]);
    const ea = ergebnis(ra.text);
    const eb = ergebnis(rb.text);
    pruefe('A bekommt das Schloss sofort', Number(ea.warte) < 1, ea.warte + ' s');
    pruefe('B wartet auf A (≥ 2,5 s)', Number(eb.warte) >= 2.5, eb.warte + ' s');
  }

  // Gegenprobe: nichts blieb.
  const rest = await sql(`select count(*) n from public.chats where name in ('Probe126','Gegenrichtung')`);
  pruefe('Nichts blieb zurück', /"n":0/.test(rest.text), rest.text);

  console.log(`\n${anzahl - fehler}/${anzahl} Prüfungen bestanden`);
  process.exit(fehler ? 1 : 0);
})();
