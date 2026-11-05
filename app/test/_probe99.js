#!/usr/bin/env node
/**
 * Schema 99 (Kästen 28/10.2 und 16: Erstellen, private Unterthemen,
 * Einladungen) in einer VERWORFENEN Transaktion proben — Vorlage _probe98.js.
 *
 *   begin;
 *     Schema 89 → 90 (99 ersetzt ptt_mitteilen und braucht
 *     ptt_messages.channel_id), dann 99
 *     als Testkonto:  Community mit Bild anlegen, fremdes Bild abgelehnt,
 *                     privates + öffentliches Unterthema, Einladungen
 *     als Prüfkonto:  tritt der öffentlichen Community bei, sieht das private
 *                     Unterthema NICHT (Liste, Nachrichten, Schreiben);
 *                     Angriffe (direkt eintragen, fremde Einladung anlegen,
 *                     Einladungen lesen, falscher Code); dann per Code
 *                     hinein → sieht und schreibt
 *     private Community: Direktbeitritt zu, per Einladung offen
 *     Blockiert: Einladung zu
 *   Codex-Fund Paket 3 (05.11.2026):
 *     Wegwerf-Konto D (nur in der Transaktion, auth.users) ist Mitglied der
 *     privaten Community, legt dort ein Unterthema an und lädt ein.
 *     (a) vom ERSTELLER blockiertes Prüfkonto nimmt D's Unterthema-Einladung
 *         an → zu, keine Community-, keine Unterthema-Mitgliedschaft;
 *         ohne Blockierung, aber kein Mitglied → zu („nur für Mitglieder");
 *         als Mitglied → ok; Prüfkonto blockiert den Ersteller (umgekehrte
 *         Richtung) → zu.
 *     (b) Bild mit fremdem Host und Eimer-Pfad (avatars/…) → abgelehnt,
 *         obwohl der Pfad als eigener Upload registriert ist.
 *   Ergebnis per raise → alles zurückgerollt, nichts bleibt.
 *
 * Nur die eigenen Konten (Prüfkonto, Testkonto). Läuft auch bei gesperrtem
 * PostgREST (402), weil es über die Verwaltungs-API geht.
 *
 * Start:  SUPABASE_TOKEN=… SUPABASE_URL=https://….supabase.co node test/_probe99.js
 */

const fs = require('fs');
const path = require('path');
const { frage } = require('./_aufraeumen');

const PRUEFKONTO = '62616c1d-82e2-4ee4-aab9-950e40e438a4'; // all.media.prueflauf@web.de
const TESTKONTO = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4'; // test@all-media.app
const BILD = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/avatars/' + TESTKONTO + '-probe99.jpg';
const CODE_C = 'probeccccccccccc';
const CODE_K = 'probekkkkkkkkkkk';
const CODE_P = 'probepppppppppp2';
const CODE_D = 'probedddddddddd2';
const DRITT = 'a1000000-0000-4000-8000-000000000099'; // nur in der Transaktion
const FREMDHOST = 'https://boese.example/storage/v1/object/public/media/avatars/' + TESTKONTO + '-probe99.jpg';
const NUR_MITGLIEDER = 'Diese Einladung gilt nur für Mitglieder der Community – tritt ihr zuerst bei';
const BLOCKIERT_TEXT = 'Diese Einladung kannst du nicht annehmen';

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
const weg = (name, anweisung) => `
  begin ${anweisung}; ${merke(name, "'ok'")}
  exception when others then ${merke(name, "replace(sqlstate, ' ', '_')")}
  end;`;
// Wie versuch, merkt aber zusätzlich, ob genau dieser Fehlersatz kam.
const versuchText = (name, anweisung, satz) => `
  begin ${anweisung}; ${merke(name, "'offen'")}
  exception when others then
    ${merke(name, "'zu'")}
    ${merke(name + '_text', `(sqlerrm = '${satz}')`)}
  end;`;
const als = (konto, rumpf) => `
  reset role;
  select set_config('request.jwt.claims', '{"sub":"${konto}","role":"authenticated"}', true),
         set_config('request.jwt.claim.sub', '${konto}', true);
  set local role authenticated;
  do $p$ declare n int; b boolean; t text; begin
    ${rumpf}
  end $p$;
  reset role;`;
const eigner = (rumpf) => `
  do $p$ declare n int; b boolean; t text; begin
    ${rumpf}
  end $p$;`;

(async () => {
  if (!process.env.SUPABASE_TOKEN) {
    console.log('ÜBERSPRUNGEN  SUPABASE_TOKEN fehlt.');
    process.exit(2);
  }
  const datei = (n) => fs.readFileSync(path.join(__dirname, '..', '..', n), 'utf8');
  // Auftrag Pakete 1–3 (05.11.2026): Vorgänger, die live fehlen, in DERSELBEN
  // verworfenen Transaktion vorweg einspielen (VORGAENGER=pfad1,pfad2,…), danach
  // NACHFOLGER (z. B. Schema 117 erneut). Pfade absolut oder relativ zum Aufruf.
  const dateiListe = (v) => (process.env[v] || '').split(',').filter(Boolean)
    .map((f) => `-- ===== ${path.basename(f)}\n` + fs.readFileSync(path.resolve(f), 'utf8')).join('\n\n');
  const vorgaenger = dateiListe('VORGAENGER');
  const nachfolger = dateiListe('NACHFOLGER');
  if (!vorgaenger) console.log('HINWEIS  VORGAENGER leer — die Probe läuft nur gegen den Live-Stand.');
  const s99 = datei('SUPABASE_SCHEMA_99_erstellen_einladung.sql');

  const sql = `
begin;
select set_config('probe.erg', '', true);
${vorgaenger}
${s99}
${nachfolger}

-- Das Probebild gilt als eigener Upload des Testkontos (Schema 115/117: eine
-- Medienadresse darf nur setzen, wer die Datei selbst hochgeladen hat).
insert into public.medien_objekte (pfad, owner_id, typ, bytes, sha256)
  values ('avatars/${TESTKONTO}-probe99.jpg', '${TESTKONTO}', 'image/jpeg', 1, repeat('c', 64));

${eigner(`
  select count(*) into n from public.blocks
   where (user_id = '${TESTKONTO}' and blocked_user_id = '${PRUEFKONTO}')
      or (user_id = '${PRUEFKONTO}' and blocked_user_id = '${TESTKONTO}');
  ${merke('blockiert_vorher', 'n')}
`)}

${als(TESTKONTO, `
  ${versuch('fremdes_bild', `insert into public.communities (name, topic, visibility, created_by, bild_url)
     values ('Probe99 Fremd', '', 'public', auth.uid(), 'https://boese.example/pixel.png')`)}
  ${versuch('fremder_host_eimerpfad', `insert into public.communities (name, topic, visibility, created_by, bild_url)
     values ('Probe99 Fremdhost', '', 'public', auth.uid(), '${FREMDHOST}')`)}
  ${weg('community_anlegen', `insert into public.communities (name, topic, bio, link, visibility, created_by, bild_url)
     values ('Probe99 Offen', 'Nach 22 Uhr', 'Nach 22 Uhr', 'https://beispiel.de', 'public', auth.uid(), '${BILD}')`)}
  insert into public.community_members (community_id, user_id)
    select id, auth.uid() from public.communities where name = 'Probe99 Offen';
  ${weg('kanal_offen', `insert into public.community_channels (community_id, slug, name, position)
     select id, 'ch-allgemein', 'Allgemein', 0 from public.communities where name = 'Probe99 Offen'`)}
  ${weg('kanal_privat', `insert into public.community_channels (community_id, slug, name, position, bio, link, privat, erstellt_von)
     select id, 'ch-geheim', 'Geheim', 1, 'Nur Eingeladene', '', true, '${PRUEFKONTO}' from public.communities where name = 'Probe99 Offen'`)}
  select (erstellt_von = auth.uid()) into b from public.community_channels where slug = 'ch-geheim'
     and community_id = (select id from public.communities where name = 'Probe99 Offen');
  ${merke('ersteller_von_datenbank', 'b')}
  insert into public.community_channel_messages (channel_id, sender_id, text)
    select k.id, auth.uid(), 'geheim' from public.community_channels k join public.communities c on c.id = k.community_id
     where c.name = 'Probe99 Offen' and k.slug = 'ch-geheim';
  ${weg('einladung_community', `insert into public.einladungen (code, community_id, erstellt_von)
     select '${CODE_C}', id, auth.uid() from public.communities where name = 'Probe99 Offen'`)}
  ${weg('einladung_kanal', `insert into public.einladungen (code, community_id, channel_id, erstellt_von)
     select '${CODE_K}', k.community_id, k.id, auth.uid() from public.community_channels k join public.communities c on c.id = k.community_id
      where c.name = 'Probe99 Offen' and k.slug = 'ch-geheim'`)}
  ${versuch('einladung_falsches_format', `insert into public.einladungen (code, community_id, erstellt_von)
     select 'KURZ', id, auth.uid() from public.communities where name = 'Probe99 Offen'`)}
  ${weg('private_community', `insert into public.communities (name, topic, visibility, created_by, bild_url)
     values ('Probe99 Privat', '', 'private', auth.uid(), '${BILD}')`)}
  insert into public.community_members (community_id, user_id)
    select id, auth.uid() from public.communities where name = 'Probe99 Privat';
  ${weg('einladung_privat', `insert into public.einladungen (code, community_id, erstellt_von)
     select '${CODE_P}', id, auth.uid() from public.communities where name = 'Probe99 Privat'`)}
  select count(*) into n from public.community_channels k join public.communities c on c.id = k.community_id where c.name = 'Probe99 Offen';
  ${merke('ersteller_sieht', 'n')}
`)}

${eigner(`
  perform set_config('probe.kanal', (select k.id::text from public.community_channels k join public.communities c on c.id = k.community_id
     where c.name = 'Probe99 Offen' and k.slug = 'ch-geheim'), true);
  perform set_config('probe.privat', (select id::text from public.communities where name = 'Probe99 Privat'), true);
`)}

${als(PRUEFKONTO, `
  ${weg('beitritt_offen', `insert into public.community_members (community_id, user_id)
     select id, auth.uid() from public.communities where name = 'Probe99 Offen'`)}
  select count(*) into n from public.community_channels k join public.communities c on c.id = k.community_id where c.name = 'Probe99 Offen';
  ${merke('mitglied_sieht_vorher', 'n')}
  select count(*) into n from public.community_channel_messages m where m.text = 'geheim';
  ${merke('nachrichten_vorher', 'n')}
  select bild_url into t from public.communities where name = 'Probe99 Offen'; ${merke('bild_lesbar', `t = '${BILD}'`)}
  -- Ziel fest vorgegeben: ein select unter RLS fände das unsichtbare
  -- Unterthema nicht, schriebe 0 Zeilen und sähe wie „offen“ aus.
  ${versuch('schreiben_vorher', `insert into public.community_channel_messages (channel_id, sender_id, text)
     values (current_setting('probe.kanal')::uuid, auth.uid(), 'x')`)}
  select count(*) into n from public.einladungen; ${merke('einladungen_fremd_lesbar', 'n')}
  ${versuch('selbst_eintragen', `insert into public.unterthema_mitglieder (channel_id, user_id)
     values (current_setting('probe.kanal')::uuid, auth.uid())`)}
  ${versuch('fremde_einladung_anlegen', `insert into public.einladungen (code, community_id, erstellt_von)
     select 'probefffffffffff', id, auth.uid() from public.communities where name = 'Probe99 Offen'`)}
  ${versuch('falscher_code', `perform public.einladung_annehmen('probezzzzzzzzzzz')`)}
  ${versuch('zugang_abfragen', `perform public.unterthema_zugang(gen_random_uuid(), auth.uid())`)}
  ${weg('annehmen_kanal', `perform public.einladung_annehmen('${CODE_K}')`)}
  select count(*) into n from public.community_channels k join public.communities c on c.id = k.community_id where c.name = 'Probe99 Offen';
  ${merke('mitglied_sieht_nachher', 'n')}
  select count(*) into n from public.community_channel_messages m where m.text = 'geheim';
  ${merke('nachrichten_nachher', 'n')}
  ${weg('schreiben_nachher', `insert into public.community_channel_messages (channel_id, sender_id, text)
     select k.id, auth.uid(), 'drin' from public.community_channels k where k.slug = 'ch-geheim'
       and k.community_id = (select id from public.communities where name = 'Probe99 Offen')`)}
  ${versuch('privat_direkt', `insert into public.community_members (community_id, user_id)
     values (current_setting('probe.privat')::uuid, auth.uid())`)}
`)}

${eigner(`
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values ('${DRITT}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe99@prueflauf.invalid',
          '{"name":"Probe Mitglied","phone":"+4915199990099","handle":"@prueflauf.probe99"}', now(), now());
  insert into public.konto_alter (user_id, geburtsdatum, land, mindestalter, status)
  values ('${DRITT}', '1990-01-01', 'DE', 16, 'frei')
  on conflict (user_id) do update set status = 'frei', geburtsdatum = '1990-01-01';
  -- D ist schon Mitglied (wie nach angenommener Beitrittsanfrage).
  insert into public.community_members (community_id, user_id)
  values (current_setting('probe.privat')::uuid, '${DRITT}');
`)}

${als(DRITT, `
  ${weg('d_kanal', `insert into public.community_channels (community_id, slug, name, position)
     values (current_setting('probe.privat')::uuid, 'ch-dritt', 'Von D', 5)`)}
  ${weg('d_einladung', `insert into public.einladungen (code, community_id, channel_id, erstellt_von)
     select '${CODE_D}', k.community_id, k.id, auth.uid() from public.community_channels k
      where k.community_id = current_setting('probe.privat')::uuid and k.slug = 'ch-dritt'`)}
`)}

${eigner(`
  perform set_config('probe.kanal_d', (select k.id::text from public.community_channels k
     where k.community_id = current_setting('probe.privat')::uuid and k.slug = 'ch-dritt'), true);
`)}

${als(TESTKONTO, `
  insert into public.blocks (user_id, blocked_user_id) values (auth.uid(), '${PRUEFKONTO}') on conflict do nothing;
`)}
${als(PRUEFKONTO, `
  ${versuchText('a_ersteller_blockiert', `perform public.einladung_annehmen('${CODE_D}')`, BLOCKIERT_TEXT)}
`)}
${eigner(`
  select count(*) into n from public.community_members
   where community_id = current_setting('probe.privat')::uuid and user_id = '${PRUEFKONTO}';
  ${merke('a_mitglied_nach_block', 'n')}
  select count(*) into n from public.unterthema_mitglieder
   where channel_id = current_setting('probe.kanal_d')::uuid and user_id = '${PRUEFKONTO}';
  ${merke('a_unterthema_nach_block', 'n')}
`)}
${als(TESTKONTO, `
  delete from public.blocks where user_id = auth.uid() and blocked_user_id = '${PRUEFKONTO}';
`)}
${als(PRUEFKONTO, `
  ${versuchText('a_nicht_mitglied', `perform public.einladung_annehmen('${CODE_D}')`, NUR_MITGLIEDER)}
`)}
${eigner(`
  select count(*) into n from public.community_members
   where community_id = current_setting('probe.privat')::uuid and user_id = '${PRUEFKONTO}';
  ${merke('a_mitglied_ohne_beitritt', 'n')}
`)}

${als(TESTKONTO, `
  insert into public.blocks (user_id, blocked_user_id) values (auth.uid(), '${PRUEFKONTO}') on conflict do nothing;
`)}
${als(PRUEFKONTO, `
  ${versuch('annehmen_blockiert', `perform public.einladung_annehmen('${CODE_P}')`)}
`)}
${als(TESTKONTO, `
  delete from public.blocks where user_id = auth.uid() and blocked_user_id = '${PRUEFKONTO}';
`)}
${als(PRUEFKONTO, `
  ${weg('annehmen_privat', `perform public.einladung_annehmen('${CODE_P}')`)}
  select count(*) into n from public.community_members m
   where m.community_id = current_setting('probe.privat')::uuid and m.user_id = auth.uid();
  ${merke('privat_mitglied', 'n')}
  -- umgekehrte Richtung: das Prüfkonto blockiert den Ersteller
  insert into public.blocks (user_id, blocked_user_id) values (auth.uid(), '${TESTKONTO}') on conflict do nothing;
  ${versuchText('a_umgekehrt_blockiert', `perform public.einladung_annehmen('${CODE_D}')`, BLOCKIERT_TEXT)}
  delete from public.blocks where user_id = auth.uid() and blocked_user_id = '${TESTKONTO}';
  ${weg('a_als_mitglied', `perform public.einladung_annehmen('${CODE_D}')`)}
  select count(*) into n from public.unterthema_mitglieder
   where channel_id = current_setting('probe.kanal_d')::uuid and user_id = auth.uid();
  ${merke('a_unterthema_als_mitglied', 'n')}
`)}

${eigner(`
  select has_function_privilege('anon', 'public.einladung_annehmen(text)', 'execute') into b; ${merke('anon_annehmen', 'b')}
  select public.unterthema_zugang(k.id, '${PRUEFKONTO}') into b from public.community_channels k where k.slug = 'ch-geheim'
    and k.community_id = (select id from public.communities where name = 'Probe99 Offen');
  ${merke('zugang_intern', 'b')}
`)}

do $p$ begin raise exception 'ERG:%', current_setting('probe.erg', true); end $p$;
`;

  const antwort = await frage(sql);
  const text = JSON.stringify(antwort || '');
  const treffer = text.match(/ERG:(.*?)(\\n|")/);
  if (!treffer) {
    console.log('Keine Antwort aus der Probe: ' + text.slice(0, 800));
    process.exit(1);
  }
  const w = {};
  for (const paar of treffer[1].trim().split(/\s+/)) {
    const [k, ...r] = paar.split('=');
    if (k) w[k] = r.join('=');
  }
  pruefe('Ausgangslage: keine Blockierung zwischen den Konten', w.blockiert_vorher === '0', w.blockiert_vorher);
  console.log('\nAnlegen (Testkonto)');
  pruefe('16 fremde Bildadresse abgelehnt', w.fremdes_bild === 'zu', w.fremdes_bild);
  pruefe('(b) fremder Host mit Eimer-Pfad avatars/… abgelehnt (medien_adresse_gueltig)',
    w.fremder_host_eimerpfad === 'zu', w.fremder_host_eimerpfad);
  pruefe('16 Community mit Bild, Biografie, Link', w.community_anlegen === 'ok', w.community_anlegen);
  pruefe('10.2 Unterthemen anlegen (öffentlich, privat)', w.kanal_offen === 'ok' && w.kanal_privat === 'ok', `${w.kanal_offen} ${w.kanal_privat}`);
  pruefe('10.2 Ersteller setzt die Datenbank (mitgeschickter fremder Wert zählt nicht)', w.ersteller_von_datenbank === 'true', w.ersteller_von_datenbank);
  pruefe('10.2/16 Einladungen anlegen', w.einladung_community === 'ok' && w.einladung_kanal === 'ok' && w.einladung_privat === 'ok',
    `${w.einladung_community} ${w.einladung_kanal} ${w.einladung_privat}`);
  pruefe('Einladungscode im falschen Format: zu', w.einladung_falsches_format === 'zu', w.einladung_falsches_format);
  pruefe('Ersteller sieht beide Unterthemen', w.ersteller_sieht === '2', w.ersteller_sieht);
  console.log('\nMitglied ohne Einladung (Prüfkonto)');
  pruefe('öffentlicher Beitritt: ok', w.beitritt_offen === 'ok', w.beitritt_offen);
  pruefe('16.3 Community-Bild für andere lesbar', w.bild_lesbar === 'true', w.bild_lesbar);
  pruefe('10.2 privates Unterthema unsichtbar (1 von 2)', w.mitglied_sieht_vorher === '1', w.mitglied_sieht_vorher);
  pruefe('10.2 Nachrichten darin unsichtbar', w.nachrichten_vorher === '0', w.nachrichten_vorher);
  pruefe('10.2 darin schreiben: zu', w.schreiben_vorher === 'zu', w.schreiben_vorher);
  pruefe('fremde Einladungscodes nicht lesbar', w.einladungen_fremd_lesbar === '0', w.einladungen_fremd_lesbar);
  pruefe('sich selbst ins private Unterthema eintragen: zu', w.selbst_eintragen === 'zu', w.selbst_eintragen);
  pruefe('Einladung für fremde Community anlegen: zu', w.fremde_einladung_anlegen === 'zu', w.fremde_einladung_anlegen);
  pruefe('falscher Code: zu', w.falscher_code === 'zu', w.falscher_code);
  pruefe('unterthema_zugang direkt aufrufen: zu', w.zugang_abfragen === 'zu', w.zugang_abfragen);
  console.log('\nMit Einladung (Prüfkonto)');
  pruefe('10.2 Einladung ins private Unterthema annehmen: ok', w.annehmen_kanal === 'ok', w.annehmen_kanal);
  pruefe('10.2 danach sichtbar (2 von 2), Nachrichten lesbar, schreiben ok',
    w.mitglied_sieht_nachher === '2' && w.nachrichten_nachher === '1' && w.schreiben_nachher === 'ok',
    `${w.mitglied_sieht_nachher} ${w.nachrichten_nachher} ${w.schreiben_nachher}`);
  pruefe('10.2 Zugang auch für Auslöser (PTT, Markierung) sichtbar', w.zugang_intern === 'true', w.zugang_intern);
  pruefe('16 private Community: Direktbeitritt zu', w.privat_direkt === 'zu', w.privat_direkt);
  pruefe('16 blockiert: Einladung zu', w.annehmen_blockiert === 'zu', w.annehmen_blockiert);
  pruefe('16 private Community per Einladung: Mitglied', w.annehmen_privat === 'ok' && w.privat_mitglied === '1', `${w.annehmen_privat} ${w.privat_mitglied}`);
  console.log('\nCodex-Fund Paket 3: Unterthema-Einladung eines Mitglieds (private Community)');
  pruefe('Mitglied D legt Unterthema und Einladung an', w.d_kanal === 'ok' && w.d_einladung === 'ok', `${w.d_kanal} ${w.d_einladung}`);
  pruefe('(a) vom Ersteller blockiert: Einladung von D zu, Blockier-Satz',
    w.a_ersteller_blockiert === 'zu' && w.a_ersteller_blockiert_text === 'true',
    `${w.a_ersteller_blockiert} ${w.a_ersteller_blockiert_text}`);
  pruefe('(a) danach weder Community- noch Unterthema-Mitglied',
    w.a_mitglied_nach_block === '0' && w.a_unterthema_nach_block === '0',
    `${w.a_mitglied_nach_block} ${w.a_unterthema_nach_block}`);
  pruefe('ohne Blockierung, kein Mitglied: zu („nur für Mitglieder“), kein Beitritt',
    w.a_nicht_mitglied === 'zu' && w.a_nicht_mitglied_text === 'true' && w.a_mitglied_ohne_beitritt === '0',
    `${w.a_nicht_mitglied} ${w.a_nicht_mitglied_text} ${w.a_mitglied_ohne_beitritt}`);
  pruefe('umgekehrte Richtung (Prüfkonto blockiert Ersteller): zu',
    w.a_umgekehrt_blockiert === 'zu' && w.a_umgekehrt_blockiert_text === 'true',
    `${w.a_umgekehrt_blockiert} ${w.a_umgekehrt_blockiert_text}`);
  pruefe('als Mitglied: Einladung von D ok, im Unterthema',
    w.a_als_mitglied === 'ok' && w.a_unterthema_als_mitglied === '1',
    `${w.a_als_mitglied} ${w.a_unterthema_als_mitglied}`);
  pruefe('einladung_annehmen für anon gesperrt', w.anon_annehmen === 'false', w.anon_annehmen);

  console.log(`\n${anzahl - fehler}/${anzahl} Prüfungen bestanden (alles verworfen)`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
