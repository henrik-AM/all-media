#!/usr/bin/env node
/**
 * Schema 100 (Allgemeines Feedback 21.10., Kasten AF 1, Chat-Klingel) in einer
 * VERWORFENEN Transaktion proben — Vorlage _probe98.js.
 *
 *   begin;
 *     Schema 100 komplett
 *     Probechat Prüfkonto ↔ Testkonto (nur in dieser Transaktion)
 *     neue Nachricht         → je eine Klingel chat:<id>, nutzer:<A>, nutzer:<B>
 *     drei Nachrichten auf einmal gelesen → genau EINE Klingel chat:<id>
 *     Reaktion, Bearbeiten, Löschen → Klingel chat:<id>
 *     als Prüfkonto: darf chat:<id> und nutzer:<selbst> hören,
 *                    nicht nutzer:<Testkonto>, keinen fremden Chat, kein Unsinnsthema;
 *                    sieht über die RLS-Regel nur die eigene Klingel;
 *                    kann nicht selbst klingeln (chat_klingeln, insert)
 *   Ergebnis per raise → alles zurückgerollt, nichts bleibt.
 *
 * Nur die eigenen Konten. Läuft auch bei gesperrtem PostgREST (402), weil es
 * über die Verwaltungs-API geht.
 *
 * Start:  SUPABASE_TOKEN=… SUPABASE_URL=https://….supabase.co node test/_probe100.js
 */

const fs = require('fs');
const path = require('path');
const { frage } = require('./_aufraeumen');

const PRUEFKONTO = '62616c1d-82e2-4ee4-aab9-950e40e438a4'; // all.media.prueflauf@web.de
const TESTKONTO = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4'; // test@all-media.app
const CHAT = 'a1000000-0000-4000-8000-000000000100'; // nur in der Transaktion
const FREMDER_CHAT = 'a1000000-0000-4000-8000-000000000101'; // Prüfkonto ist kein Mitglied

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
const eigner = (rumpf) => `
  do $p$ declare n int; b boolean; begin
    ${rumpf}
  end $p$;`;

// Der Realtime-Dienst legt die Tagesablagen von realtime.messages selbst an;
// während der Sperre läuft er nicht, und postgres darf dort nichts anlegen.
// Deshalb schreibt chat_klingeln in der Probe in eine Mitschrift (verworfen).
// Was das belegt: welche Auslöser wann wie oft an welches Thema klingeln.
// Was es NICHT belegt: dass realtime.send beim Hörer ankommt — das prüft
// test:chatklingel-live nach der Entsperrung.
const klingeln = (thema) =>
  `select count(*) into n from public.probe100_mitschrift where thema = '${thema}' and nr > current_setting('probe.marke')::int;`;
const marke = `perform set_config('probe.marke', (select coalesce(max(nr), 0) from public.probe100_mitschrift)::text, true);`;

(async () => {
  if (!process.env.SUPABASE_TOKEN) {
    console.log('ÜBERSPRUNGEN  SUPABASE_TOKEN fehlt.');
    process.exit(2);
  }
  const schema = fs.readFileSync(
    path.join(__dirname, '..', '..', 'SUPABASE_SCHEMA_100_chat_klingel.sql'),
    'utf8'
  );

  const sql = `
begin;
select set_config('probe.erg', '', true);
${schema}
create table public.probe100_mitschrift (nr serial, thema text, art text);
create or replace function public.chat_klingeln(thema text, art text)
returns void language plpgsql security definer set search_path = public as $f$
begin
  insert into public.probe100_mitschrift (thema, art) values (thema, art);
end $f$;
revoke execute on function public.chat_klingeln(text, text) from public, anon, authenticated;

${eigner(`
  insert into public.chats (id, anfrage_zustand) values ('${CHAT}', 'angenommen'), ('${FREMDER_CHAT}', 'angenommen');
  insert into public.chat_members (chat_id, user_id) values ('${CHAT}', '${PRUEFKONTO}'), ('${CHAT}', '${TESTKONTO}'),
    ('${FREMDER_CHAT}', '${TESTKONTO}');

  -- 1 neue Nachricht
  ${marke}
  insert into public.messages (chat_id, sender_id, text) values ('${CHAT}', '${TESTKONTO}', 'probe eins');
  ${klingeln(`chat:${CHAT}`)} ${merke('neu_chat', 'n')}
  ${klingeln(`nutzer:${PRUEFKONTO}`)} ${merke('neu_liste_a', 'n')}
  ${klingeln(`nutzer:${TESTKONTO}`)} ${merke('neu_liste_b', 'n')}

  -- 2 drei Nachrichten in einem Befehl gelesen → eine Klingel
  insert into public.messages (chat_id, sender_id, text)
    select '${CHAT}', '${TESTKONTO}', 'probe ' || g from generate_series(2, 3) g;
  ${marke}
  update public.messages set read_at = now() where chat_id = '${CHAT}';
  ${klingeln(`chat:${CHAT}`)} ${merke('gelesen_chat', 'n')}

  -- 3 Reaktion, Bearbeiten, Löschen
  ${marke}
  insert into public.message_reactions (message_id, user_id, emoji)
    select id, '${PRUEFKONTO}', '👍' from public.messages where chat_id = '${CHAT}' limit 1;
  ${klingeln(`chat:${CHAT}`)} ${merke('reaktion_chat', 'n')}
  ${klingeln(`nutzer:${PRUEFKONTO}`)} ${merke('reaktion_liste', 'n')}

  ${marke}
  update public.messages set text = 'probe bearbeitet', edited_at = now()
    where id = (select id from public.messages where chat_id = '${CHAT}' order by created_at limit 1);
  ${klingeln(`chat:${CHAT}`)} ${merke('bearbeitet_chat', 'n')}

  ${marke}
  delete from public.messages where id = (select id from public.messages where chat_id = '${CHAT}' order by created_at desc limit 1);
  ${klingeln(`chat:${CHAT}`)} ${merke('geloescht_chat', 'n')}

  -- Nachgeliefertes Kuvert: Chat und ausschließlich dessen Empfänger.
  insert into public.krypto_schluessel(id,user_id,geraet,art,oeffentlich)
    values ('a1000000-0000-4000-8000-000000000102','${PRUEFKONTO}','probe100-kuvert','app',encode(decode(repeat('ab',32),'hex'),'base64'));
  ${marke}
  insert into public.message_keys(message_id,schluessel_id,nonce,chiffre)
    select id,'a1000000-0000-4000-8000-000000000102','probe-nonce','probe-chiffre'
    from public.messages where chat_id='${CHAT}' limit 1;
  ${klingeln(`chat:${CHAT}`)} ${merke('kuvert_chat', 'n')}
  ${klingeln(`nutzer:${PRUEFKONTO}`)} ${merke('kuvert_eigen', 'n')}
  ${klingeln(`nutzer:${TESTKONTO}`)} ${merke('kuvert_fremd', 'n')}

  -- 4 Mitgliedszeile (gelesen) → eigene Liste
  ${marke}
  update public.chat_members set is_read = true where chat_id = '${CHAT}' and user_id = '${PRUEFKONTO}';
  ${klingeln(`nutzer:${PRUEFKONTO}`)} ${merke('mitglied_liste', 'n')}
  ${klingeln(`nutzer:${TESTKONTO}`)} ${merke('mitglied_fremd', 'n')}

  -- Die Klingel trägt keinen Inhalt: nur die Art, nie Text
  select count(*) into n from public.probe100_mitschrift where art not in ('insert', 'update', 'delete', 'reaktion', 'liste', 'kuvert');
  ${merke('ohne_inhalt', 'n')}
`)}

${als(PRUEFKONTO, `
  ${merke('hoeren_chat', `public.klingel_hoeren_erlaubt('chat:${CHAT}')`)}
  ${merke('hoeren_selbst', `public.klingel_hoeren_erlaubt('nutzer:${PRUEFKONTO}')`)}
  ${merke('hoeren_fremder_nutzer', `public.klingel_hoeren_erlaubt('nutzer:${TESTKONTO}')`)}
  ${merke('hoeren_fremder_chat', `public.klingel_hoeren_erlaubt('chat:${FREMDER_CHAT}')`)}
  ${merke('hoeren_unsinn', `public.klingel_hoeren_erlaubt('chat:x'' or 1=1')`)}

  ${versuch('selbst_klingeln_funktion', `perform public.chat_klingeln('chat:${CHAT}', 'x')`)}
  ${versuch('selbst_klingeln_insert', `insert into realtime.messages (topic, extension, event, payload, private) values ('chat:${CHAT}', 'broadcast', 'klingel', '{}', true)`)}
`)}

${eigner(`
  select count(*) into n from pg_policies where schemaname = 'realtime' and tablename = 'messages'
    and policyname = 'Chat-Klingel hoeren' and cmd = 'SELECT' and qual like '%klingel_hoeren_erlaubt%';
  ${merke('regel_da', 'n')}
  select count(*) into n from pg_policies where schemaname = 'realtime' and tablename = 'messages' and cmd in ('INSERT', 'ALL');
  ${merke('regel_insert', 'n')}
  ${merke('rechte_anon', `has_function_privilege('anon', 'public.klingel_hoeren_erlaubt(text)', 'execute')`)}
  ${merke('rechte_ausloeser', `has_function_privilege('authenticated', 'public.chat_klingel_nachricht()', 'execute')`)}
`)}

do $p$ begin raise exception 'ERG:%', current_setting('probe.erg', true); end $p$;
`;

  const antwort = await frage(sql, { erwarteterFehler: /P0001: ERG:/ });
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

  console.log('\n1. Neue Nachricht');
  pruefe('klingelt im Chat genau einmal', e.neu_chat === '1', e.neu_chat);
  // A ist Empfänger: Schema 81 (nachricht_macht_ungelesen) setzt dazu A's
  // chat_members.is_read — das klingelt ein zweites Mal. Die Seiten fassen
  // Klingeln binnen ChatAbgleich.KLINGEL_BUENDELN_MS zusammen.
  pruefe('klingelt in der Liste von A (Empfänger: Nachricht + Ungelesen)', ['1', '2'].includes(e.neu_liste_a), e.neu_liste_a);
  pruefe('klingelt in der Liste von B', e.neu_liste_b === '1', e.neu_liste_b);

  console.log('\n2. Viele Zeilen in einem Befehl');
  pruefe('drei gelesene Nachrichten → eine Klingel', e.gelesen_chat === '1', e.gelesen_chat);

  console.log('\n3. Reaktion, Bearbeiten, Löschen');
  pruefe('Reaktion klingelt im Chat', e.reaktion_chat === '1', e.reaktion_chat);
  pruefe('Reaktion klingelt nicht in der Liste', e.reaktion_liste === '0', e.reaktion_liste);
  pruefe('Bearbeiten klingelt', e.bearbeitet_chat === '1', e.bearbeitet_chat);
  pruefe('Löschen klingelt', e.geloescht_chat === '1', e.geloescht_chat);

  pruefe('Nachgeliefertes Kuvert klingelt im Chat', e.kuvert_chat === '1', e.kuvert_chat);
  pruefe('Kuvert klingelt in der Empfängerliste', e.kuvert_eigen === '1', e.kuvert_eigen);
  pruefe('Kuvert klingelt nicht in fremder Liste', e.kuvert_fremd === '0', e.kuvert_fremd);
  console.log('\n4. Mitgliedszeile');
  pruefe('eigene Zeile klingelt in der eigenen Liste', e.mitglied_liste === '1', e.mitglied_liste);
  pruefe('nicht in der Liste des anderen', e.mitglied_fremd === '0', e.mitglied_fremd);
  pruefe('Klingel trägt nur die Art, keinen Text', e.ohne_inhalt === '0', e.ohne_inhalt);

  console.log('\n5. Wer hören darf');
  pruefe('Mitglied hört den Chat', e.hoeren_chat === 'true', e.hoeren_chat);
  pruefe('hört die eigene Liste', e.hoeren_selbst === 'true', e.hoeren_selbst);
  pruefe('hört NICHT die Liste eines anderen', e.hoeren_fremder_nutzer === 'false', e.hoeren_fremder_nutzer);
  pruefe('hört NICHT einen fremden Chat', e.hoeren_fremder_chat === 'false', e.hoeren_fremder_chat);
  pruefe('Unsinnsthema → nein, kein Fehler', e.hoeren_unsinn === 'false', e.hoeren_unsinn);
  pruefe('Regel „Chat-Klingel hoeren" auf realtime.messages', e.regel_da === '1', e.regel_da);
  pruefe('keine Einfüge-Regel auf realtime.messages', e.regel_insert === '0', e.regel_insert);

  console.log('\n6. Niemand klingelt selbst');
  pruefe('chat_klingeln nicht aufrufbar', e.selbst_klingeln_funktion === 'zu', e.selbst_klingeln_funktion);
  pruefe('kein direktes Einfügen in realtime.messages', e.selbst_klingeln_insert === 'zu', e.selbst_klingeln_insert);
  pruefe('anon darf klingel_hoeren_erlaubt nicht', e.rechte_anon === 'false', e.rechte_anon);
  pruefe('Auslöserfunktion nicht aufrufbar', e.rechte_ausloeser === 'false', e.rechte_ausloeser);

  console.log(`\n${anzahl - fehler}/${anzahl} bestanden — alles zurückgerollt.`);
  process.exit(fehler ? 1 : 0);
})();
