#!/usr/bin/env node
/**
 * Paket 1 (Schemas 88–94, danach 117 erneut) in einer VERWORFENEN Transaktion proben.
 *
 * Auftrag „Sammelzweig Pakete 1–3“ (05.11.2026): 88–94 sind live nicht eingespielt;
 * diese Probe spielt sie in der Reihenfolge 88 → 89 → 90 → 91 → 92 → 93 → 94 ein,
 * danach Schema 117 erneut (Medienreferenz-Prüfung auch auf `kontakt_bilder`),
 * prüft Angriff und normalen Weg als Prüf- und Testkonto (`set local role
 * authenticated`) und rollt am Ende alles per raise zurück.
 *
 * Vorlage: test/_probe97.js. Nur die eigenen Konten.
 *
 * Start:  SUPABASE_TOKEN=… node test/_probe_paket1.js
 */

const fs = require('fs');
const path = require('path');
const { frage } = require('./_aufraeumen');

const WURZEL = path.join(__dirname, '..', '..');
const PRUEFKONTO = '62616c1d-82e2-4ee4-aab9-950e40e438a4'; // all.media.prueflauf@web.de
const TESTKONTO = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4'; // test@all-media.app
const FREMD = '00000000-0000-4000-8000-0000000000aa'; // gibt es nicht
const COMM = '88888888-0000-4000-8000-000000000001';
const K1 = '88888888-0000-4000-8000-000000000002';
const K2 = '88888888-0000-4000-8000-000000000003';
const N1 = '88888888-0000-4000-8000-000000000004';
const K3 = '88888888-0000-4000-8000-000000000005'; // überkreuzte Transaktionen (Codex Runde 2)
// Eigene, registrierte Datei des Prüfkontos (unten in medien_objekte) — 115/117 lassen sie durch.
const PTT_AUDIO = `https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/avatars/${PRUEFKONTO}-probe88-eigen.png`;

const DATEIEN = [
  'SUPABASE_SCHEMA_88_profilseite.sql',
  'SUPABASE_SCHEMA_89_anrufe_ueberall.sql',
  'SUPABASE_SCHEMA_90_push_to_talk.sql',
  'SUPABASE_SCHEMA_91_antworten_im_unterthema.sql',
  'SUPABASE_SCHEMA_92_kommentar_antworten.sql',
  'SUPABASE_SCHEMA_93_geteilt_weg.sql',
  'SUPABASE_SCHEMA_94_kontaktbild.sql',
  'SUPABASE_SCHEMA_117_medienreferenz_eigen.sql',
];

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
const weg = (name, anweisung) => `
  begin ${anweisung}; ${merke(name, "'ok'")}
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

// Alle Literale einer check (x in (...))-Bedingung als sortierte Liste.
const literale = `(select string_agg(m[1], ',' order by m[1]) from regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''', 'g') m)`;

(async () => {
  if (!process.env.SUPABASE_TOKEN) {
    console.log('ÜBERSPRUNGEN  SUPABASE_TOKEN fehlt.');
    process.exit(2);
  }
  // Gegenprobe: SCHEMAS=88,89 (oder leer) spielt nur diese Dateien ein.
  const auswahl = process.env.SCHEMAS === undefined ? DATEIEN
    : DATEIEN.filter((d) => process.env.SCHEMAS.split(',').includes(d.match(/_(\d+)_/)[1]));
  if (auswahl.length !== DATEIEN.length) console.log('GEGENPROBE nur mit: ' + (auswahl.join(', ') || 'keinem Schema'));
  const schemas = auswahl.map((d) => `-- ===== ${d}\n` + fs.readFileSync(path.join(WURZEL, d), 'utf8')).join('\n\n');

  const nachfolger = (process.env.NACHFOLGER || '').split(',').filter(Boolean)
    .map((f) => fs.readFileSync(path.resolve(f), 'utf8')).join('\n\n');

  const sql = `
begin;
select set_config('probe.erg', '', true);

-- Live-Stand VOR den Schemas merken (Rückdrehungs-Prüfung)
select set_config('probe.art_vorher', coalesce((select ${literale} from pg_constraint c where c.conname = 'notifications_art_check'), ''), true),
       set_config('probe.ziel_vorher', coalesce((select ${literale} from pg_constraint c where c.conname = 'notifications_target_type_check'), ''), true);

${schemas}
${nachfolger}

-- Bestand für die Probe (als Eigentümer, verworfen am Ende)
insert into public.communities (id, name, topic, visibility, created_by)
  values ('${COMM}', 'Probe Paket 1', 'x', 'public', '${TESTKONTO}');
insert into public.community_members (community_id, user_id)
  values ('${COMM}', '${TESTKONTO}'), ('${COMM}', '${PRUEFKONTO}') on conflict do nothing;
insert into public.community_channels (id, community_id, slug, name)
  values ('${K1}', '${COMM}', 'eins', 'Eins'), ('${K2}', '${COMM}', 'zwei', 'Zwei'),
         ('${K3}', '${COMM}', 'drei', 'Drei');
insert into public.community_channel_messages (id, channel_id, sender_id, text)
  values ('${N1}', '${K1}', '${TESTKONTO}', 'Original in Eins');
insert into public.contacts (user_id, contact_id)
  values ('${PRUEFKONTO}', '${TESTKONTO}') on conflict do nothing;
-- eine eigene (registrierte) Datei des Prüfkontos und eine fremde des Testkontos
insert into public.medien_objekte (pfad, owner_id, typ, bytes, sha256)
  values ('avatars/${PRUEFKONTO}-probe88-eigen.png', '${PRUEFKONTO}', 'image/png', 1, repeat('a', 64)),
         ('avatars/${TESTKONTO}-probe88-fremd.png', '${TESTKONTO}', 'image/png', 1, repeat('b', 64));

${eigner(`
  select ${literale} into t from pg_constraint c where c.conname = 'notifications_art_check';
  ${merke('art_nachher', 't')}
  select count(*) into n from unnest(string_to_array(current_setting('probe.art_vorher', true), ',')) a
   where a <> '' and not (a = any (string_to_array(t, ',')));
  ${merke('art_verloren', 'n')}
  select ${literale} into t from pg_constraint c where c.conname = 'notifications_target_type_check';
  select count(*) into n from unnest(string_to_array(current_setting('probe.ziel_vorher', true), ',')) a
   where a <> '' and not (a = any (string_to_array(t, ',')));
  ${merke('ziel_verloren', 'n')}
  select count(*) into n from pg_policies where tablename = 'kontakt_bilder' and policyname = 'nur_freigegebene';
  ${merke('kb_nur_freigegebene', 'n')}
  select count(*) into n from pg_class where relname = 'kontakt_bilder' and relrowsecurity;
  ${merke('kb_rls', 'n')}
  select count(*) into n from pg_trigger where tgrelid = 'public.kontakt_bilder'::regclass and not tgisinternal and tgname ilike '%medienreferenz%';
  ${merke('kb_117', 'n')}
  select count(*) into n from pg_proc where proname = 'kommentar_ausgeblendet' and prosrc ilike '%reply_to%';
  ${merke('f11_reply_to', 'n')}
  select count(*) into n from pg_policies where tablename = 'comments' and policyname = 'nicht_ausgeblendet';
  ${merke('f11_regel', 'n')}
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public'
     and p.proname in ('profil_links_gueltig','profil_links_abgleichen','ptt_mitteilen','ptt_sitzung_zuordnen',
       'kommentar_antwort_erlaubt','kommentar_bezug_fest','live_antwort_erlaubt','kommentar_angesprochen',
       'mitteilung_bei_kommentar_antwort','mitteilung_weg_bei_kommentar_antwort','geteilt_weg_merken',
       'geteilt_weg_schuetzen','ist_messenger_kontakt','kontakt_bild_zeit','kanal_antwort_erlaubt')
     and has_function_privilege('anon', p.oid, 'execute');
  ${merke('anon_execute', 'n')}
`)}

${als(PRUEFKONTO, `
  -- 88 Profilseite
  ${weg('pronomen_ok', `update public.profiles set pronomen = 'sie/ihr' where id = auth.uid()`)}
  ${versuch('pronomen_zu_lang', `update public.profiles set pronomen = repeat('x', 31) where id = auth.uid()`)}
  ${versuch('link_javascript', `update public.profiles set links = '[{"url":"javascript:alert(1)"}]'::jsonb where id = auth.uid()`)}
  ${weg('links_ok', `update public.profiles set links = '[{"url":"https://eins.de","titel":"Eins"},{"url":"https://zwei.de"}]'::jsonb where id = auth.uid()`)}
  select link into t from public.profiles where id = auth.uid(); ${merke('link_erster', 't')}
  ${versuch('pronomen_fremd', `update public.profiles set pronomen = 'x' where id = '${TESTKONTO}'; get diagnostics n = row_count; if n = 0 then raise exception 'keine Zeile'; end if`)}

  -- 89 Anruf im Unterthema
  ${weg('anruf_gestartet', `insert into public.community_channel_messages (channel_id, sender_id, anruf_art, anruf_status, anruf_dauer) values ('${K1}', auth.uid(), 'video', 'gestartet', 0)`)}
  ${versuch('anruf_gestartet_mit_dauer', `insert into public.community_channel_messages (channel_id, sender_id, anruf_art, anruf_status, anruf_dauer) values ('${K1}', auth.uid(), 'video', 'gestartet', 30)`)}

  -- 90 PTT: Sitzungszeile nur vom Auslöser
  ${versuch('ptt_sitzung_selbst', `insert into public.community_channel_messages (channel_id, sender_id, text, ptt_sitzung) values ('${K1}', auth.uid(), 'x', true)`)}
  ${weg('ptt_schalter', `update public.community_members set ptt_benachrichtigung = false where community_id = '${COMM}' and user_id = auth.uid()`)}

  -- 90 Codex-Fund: Zukunftszeitstempel darf die Sitzung nicht offen halten
  ${weg('ptt_zukunft', `insert into public.ptt_messages (community_id, channel_id, sender_id, audio_url, dauer, created_at) values ('${COMM}', '${K2}', auth.uid(), '${PTT_AUDIO}', 3, '2100-01-01')`)}
  ${weg('kanal_zukunft', `insert into public.community_channel_messages (channel_id, sender_id, text, created_at) values ('${K2}', auth.uid(), 'Zukunft', '2100-01-01')`)}
  ${versuch('ptt_zeit_aendern', `update public.ptt_messages set created_at = '2100-01-01' where channel_id = '${K2}' and sender_id = auth.uid(); get diagnostics n = row_count; if n = 0 then raise exception 'keine Zeile'; end if`)}
`)}

${eigner(`
  -- Was der Client geschickt hat, zählt nicht: gespeichert ist die Serverzeit
  -- (clock_timestamp() beim Einfügen, also zwischen now() und jetzt).
  select count(*) into n from public.ptt_messages where channel_id = '${K2}' and created_at > now() + interval '1 hour';
  ${merke('ptt_zukunft_gespeichert', 'n')}
  select count(*) into n from public.ptt_messages where channel_id = '${K2}' and sender_id = '${PRUEFKONTO}'
     and created_at between now() and clock_timestamp();
  ${merke('ptt_zeit_jetzt', 'n')}
  select count(*) into n from public.community_channel_messages where channel_id = '${K2}' and created_at > now() + interval '1 hour';
  ${merke('kanal_zukunft_gespeichert', 'n')}
  select count(*) into n from pg_proc where proname = 'zeitstempel_vom_server' and has_function_privilege('authenticated', oid, 'execute');
  ${merke('zeit_execute_auth', 'n')}

  -- Altbestand nachstellen: eine Wortmeldung, die VOR dem Fix mit Zukunftszeit
  -- gespeichert wurde (als Eigentümer — der Auslöser lässt das durch), und die
  -- erste Wortmeldung 11 Minuten zurückdatieren (Zeit vorspulen geht in einer
  -- Transaktion nicht; so ist die Sitzung abgelaufen).
  update public.ptt_messages set created_at = now() - interval '11 minutes'
   where channel_id = '${K2}' and sender_id = '${PRUEFKONTO}';
  insert into public.ptt_messages (community_id, channel_id, sender_id, audio_url, dauer, created_at)
    values ('${COMM}', '${K2}', '${PRUEFKONTO}', '${PTT_AUDIO}', 1, '2100-01-01');
  -- sitzung_id setzt der Auslöser neu (eigene Sitzung) — hinterher auf die
  -- erste Sitzung legen, wie es der Altbestand hätte, und die überzählige
  -- Sitzungszeile wieder entfernen.
  update public.ptt_messages z set sitzung_id = (select a.sitzung_id from public.ptt_messages a
          where a.channel_id = '${K2}' and a.created_at < now() order by a.created_at limit 1)
   where z.channel_id = '${K2}' and z.created_at > now() + interval '1 hour';
  delete from public.community_channel_messages c
   where c.channel_id = '${K2}' and c.ptt_sitzung
     and not exists (select 1 from public.ptt_messages p where p.sitzung_id = c.id);
  select count(*) into n from public.ptt_messages where channel_id = '${K2}' and created_at > now() + interval '1 hour' and sitzung_id is not null;
  ${merke('altbestand_zukunft', 'n')}
  select count(*) into n from public.community_channel_messages where channel_id = '${K2}' and ptt_sitzung;
  ${merke('sitzungen_vorher', 'n')}
  -- Einladung an das Testkonto möglich machen; erwartet nur, wenn es die
  -- Bedingungen aus ptt_mitteilen() erfüllt (Einstellung, Stummschaltung …).
  update public.community_members set ptt_benachrichtigung = true
   where community_id = '${COMM}' and user_id = '${TESTKONTO}';
  select count(*) into n from public.community_members m
   where m.community_id = '${COMM}' and m.user_id = '${TESTKONTO}'
     and not coalesce(m.is_muted, false)
     and public.konto_stand(m.user_id) = 'frei'
     and public.sichtbar_fuer(m.user_id, 'ptt', '${PRUEFKONTO}')
     and not public.mitteilung_stumm(m.user_id, '${PRUEFKONTO}', 'channel', '${K2}')
     and not exists (select 1 from public.blocks b
          where (b.user_id = m.user_id and b.blocked_user_id = '${PRUEFKONTO}')
             or (b.user_id = '${PRUEFKONTO}' and b.blocked_user_id = m.user_id));
  ${merke('einladung_erwartet', 'n')}
  select count(*) into n from public.notifications where user_id = '${TESTKONTO}' and art = 'ptt' and target_id = '${K2}';
  ${merke('einladungen_vorher', 'n')}
`)}

${als(PRUEFKONTO, `
  ${weg('ptt_normal', `insert into public.ptt_messages (community_id, channel_id, sender_id, audio_url, dauer) values ('${COMM}', '${K2}', auth.uid(), '${PTT_AUDIO}', 2)`)}
`)}

${eigner(`
  select count(*) into n from public.community_channel_messages where channel_id = '${K2}' and ptt_sitzung;
  ${merke('sitzungen_nachher', 'n')}
  select count(*) into n from public.ptt_messages p
   where p.channel_id = '${K2}' and p.dauer = 2
     and p.sitzung_id is not null
     and p.sitzung_id is distinct from (select q.sitzung_id from public.ptt_messages q where q.channel_id = '${K2}' and q.created_at > now() + interval '1 hour' limit 1);
  ${merke('ptt_neue_sitzung', 'n')}
  select count(*) into n from public.notifications where user_id = '${TESTKONTO}' and art = 'ptt' and target_id = '${K2}';
  ${merke('einladungen_nachher', 'n')}

  -- Codex-Fund Runde 2: überkreuzte Transaktionen nachstellen. Zwei echte
  -- Verbindungen gehen über die Management-API nicht (eine Anfrage = eine
  -- Transaktion). Darum: B „hat schon committet" — Wortmeldung als Eigentümer
  -- mit created_at = clock_timestamp(), also NACH dem now() dieser Transaktion
  -- (A hat zuerst begonnen). Danach schreibt A normal. Vor dem Fix galt Bs
  -- Zeile für A als Zukunft (created_at <= now()) → zweite Sitzung.
  insert into public.ptt_messages (community_id, channel_id, sender_id, audio_url, dauer, created_at)
    values ('${COMM}', '${K3}', '${TESTKONTO}', '${PTT_AUDIO}', 4, clock_timestamp());
  select count(*) into n from public.ptt_messages
   where channel_id = '${K3}' and created_at > now() and sitzung_id is not null;
  ${merke('kreuz_b_nach_now', 'n')}
`)}

${als(PRUEFKONTO, `
  ${weg('kreuz_a', `insert into public.ptt_messages (community_id, channel_id, sender_id, audio_url, dauer) values ('${COMM}', '${K3}', auth.uid(), '${PTT_AUDIO}', 5)`)}
`)}

${eigner(`
  select count(*) into n from public.ptt_messages where channel_id = '${K3}';
  ${merke('kreuz_zeilen', 'n')}
  select count(distinct sitzung_id) into n from public.ptt_messages where channel_id = '${K3}' and sitzung_id is not null;
  ${merke('kreuz_sitzungen_ids', 'n')}
  select count(*) into n from public.community_channel_messages where channel_id = '${K3}' and ptt_sitzung;
  ${merke('kreuz_sitzungszeilen', 'n')}
`)}

${als(PRUEFKONTO, `

  -- 91 Antwort im Unterthema
  ${weg('antwort_selbes_unterthema', `insert into public.community_channel_messages (channel_id, sender_id, text, reply_to) values ('${K1}', auth.uid(), 'Antwort', '${N1}')`)}
  ${versuch('antwort_anderes_unterthema', `insert into public.community_channel_messages (channel_id, sender_id, text, reply_to) values ('${K2}', auth.uid(), 'Antwort', '${N1}')`)}

  -- 93 Merker nicht vom Client
  ${versuch('weg_merker_selbst', `insert into public.community_channel_messages (channel_id, sender_id, text, shared_post_weg) values ('${K1}', auth.uid(), 'x', now())`)}
  select count(*) into n from public.community_channel_messages where channel_id = '${K1}' and sender_id = auth.uid() and shared_post_weg is not null; ${merke('weg_merker_gesetzt', 'n')}

  -- 94 + 117 Kontaktbild
  ${weg('kb_eigenes_bild', `insert into public.kontakt_bilder (owner_id, kontakt_id, media_url) values (auth.uid(), '${TESTKONTO}', 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/avatars/${PRUEFKONTO}-probe88-eigen.png')`)}
  ${versuch('kb_fremdes_bild', `update public.kontakt_bilder set media_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/avatars/${TESTKONTO}-probe88-fremd.png' where owner_id = auth.uid() and kontakt_id = '${TESTKONTO}'; get diagnostics n = row_count; if n = 0 then raise exception 'keine Zeile'; end if`)}
  ${versuch('kb_kein_kontakt', `insert into public.kontakt_bilder (owner_id, kontakt_id, media_url) values (auth.uid(), '${FREMD}', 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/avatars/${PRUEFKONTO}-probe88-eigen.png')`)}
  ${versuch('kb_fuer_andere', `insert into public.kontakt_bilder (owner_id, kontakt_id, media_url) values ('${TESTKONTO}', auth.uid(), 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/avatars/${PRUEFKONTO}-probe88-eigen.png')`)}
  ${versuch('kb_fremder_host', `insert into public.kontakt_bilder (owner_id, kontakt_id, media_url) values (auth.uid(), '${TESTKONTO}', 'https://boese.de/storage/v1/object/public/media/avatars/${TESTKONTO}-probe88-fremd.png') on conflict (owner_id, kontakt_id) do update set media_url = excluded.media_url`)}
  ${versuch('kb_fremder_eimer', `insert into public.kontakt_bilder (owner_id, kontakt_id, media_url) values (auth.uid(), '${TESTKONTO}', 'https://boese.de/x.png') on conflict (owner_id, kontakt_id) do update set media_url = excluded.media_url`)}
`)}

${als(TESTKONTO, `
  select count(*) into n from public.kontakt_bilder where kontakt_id = auth.uid(); ${merke('kb_kontakt_sieht', 'n')}
  select count(*) into n from public.kontakt_bilder; ${merke('kb_test_sieht_gesamt', 'n')}
  select pronomen into t from public.profiles where id = '${PRUEFKONTO}'; ${merke('pronomen_lesbar', 't')}
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
  console.log('\nAufbau (als Eigentümer)');
  pruefe('90: keine live erlaubte Mitteilungsart geht verloren', w.art_verloren === '0', w.art_verloren);
  pruefe('90: kein live erlaubter Zieltyp geht verloren', w.ziel_verloren === '0', w.ziel_verloren);
  pruefe('90: Liste kennt ptt', /(^|,)ptt(,|$)/.test(w.art_nachher || ''), w.art_nachher);
  pruefe('92: F11-Helfer kommentar_ausgeblendet kennt reply_to', w.f11_reply_to === '1', w.f11_reply_to);
  pruefe('92: Regel nicht_ausgeblendet auf comments vorhanden', w.f11_regel === '1', w.f11_regel);
  pruefe('94: RLS an kontakt_bilder', w.kb_rls === '1', w.kb_rls);
  pruefe('94: nur_freigegebene auf kontakt_bilder', w.kb_nur_freigegebene === '1', w.kb_nur_freigegebene);
  pruefe('117 erneut: Medienreferenz-Auslöser auf kontakt_bilder', w.kb_117 === '1', w.kb_117);
  pruefe('Neue Funktionen: kein EXECUTE für anon', w.anon_execute === '0', w.anon_execute);
  console.log('\nPrüfkonto');
  pruefe('88 Pronomen speichern: ok', w.pronomen_ok === 'ok', w.pronomen_ok);
  pruefe('88 Pronomen über 30 Zeichen: zu', w.pronomen_zu_lang === 'zu', w.pronomen_zu_lang);
  pruefe('88 Link javascript: zu', w.link_javascript === 'zu', w.link_javascript);
  pruefe('88 zwei Links speichern: ok', w.links_ok === 'ok', w.links_ok);
  pruefe('88 link = erster Link', w.link_erster === 'https://eins.de', w.link_erster);
  pruefe('88 fremdes Profil ändern: zu', w.pronomen_fremd === 'zu', w.pronomen_fremd);
  pruefe('89 Anruf „gestartet“ im Unterthema: ok', w.anruf_gestartet === 'ok', w.anruf_gestartet);
  pruefe('89 „gestartet“ mit Dauer: zu', w.anruf_gestartet_mit_dauer === 'zu', w.anruf_gestartet_mit_dauer);
  pruefe('90 PTT-Sitzungszeile vom Client: zu', w.ptt_sitzung_selbst === 'zu', w.ptt_sitzung_selbst);
  pruefe('90 PTT-Schalter speichern: ok', w.ptt_schalter === 'ok', w.ptt_schalter);
  pruefe('90 PTT mit created_at 2100 einfügen: angenommen', w.ptt_zukunft === 'ok', w.ptt_zukunft);
  pruefe('90 … gespeichert ist kein Zukunftszeitstempel', w.ptt_zukunft_gespeichert === '0', w.ptt_zukunft_gespeichert);
  pruefe('90 … sondern die Serverzeit', w.ptt_zeit_jetzt === '1', w.ptt_zeit_jetzt);
  pruefe('90 Unterthema-Nachricht mit created_at 2100: angenommen', w.kanal_zukunft === 'ok', w.kanal_zukunft);
  pruefe('90 … gespeichert ohne Zukunftszeitstempel', w.kanal_zukunft_gespeichert === '0', w.kanal_zukunft_gespeichert);
  pruefe('90 created_at nachträglich ändern: zu', w.ptt_zeit_aendern === 'zu', w.ptt_zeit_aendern);
  pruefe('90 zeitstempel_vom_server: kein EXECUTE für authenticated', w.zeit_execute_auth === '0', w.zeit_execute_auth);
  pruefe('90 Altbestand mit Zukunftszeile nachgestellt', w.altbestand_zukunft === '1', w.altbestand_zukunft);
  pruefe('90 normale Wortmeldung danach: ok', w.ptt_normal === 'ok', w.ptt_normal);
  pruefe('90 … neue Sitzungszeile trotz Zukunftszeile', Number(w.sitzungen_nachher) === Number(w.sitzungen_vorher) + 1, `${w.sitzungen_vorher} → ${w.sitzungen_nachher}`);
  pruefe('90 … Wortmeldung hängt an der neuen Sitzung', w.ptt_neue_sitzung === '1', w.ptt_neue_sitzung);
  pruefe('90 … Einladung „Push to Talk beitreten?“ wie erwartet',
    Number(w.einladungen_nachher) - Number(w.einladungen_vorher) === Number(w.einladung_erwartet),
    `erwartet ${w.einladung_erwartet}, ${w.einladungen_vorher} → ${w.einladungen_nachher}`);
  pruefe('90 überkreuzt: Bs Wortmeldung liegt nach As now()', w.kreuz_b_nach_now === '1', w.kreuz_b_nach_now);
  pruefe('90 überkreuzt: As Wortmeldung danach: ok', w.kreuz_a === 'ok', w.kreuz_a);
  pruefe('90 … beide Wortmeldungen gespeichert', w.kreuz_zeilen === '2', w.kreuz_zeilen);
  pruefe('90 … beide mit derselben sitzung_id', w.kreuz_sitzungen_ids === '1', w.kreuz_sitzungen_ids);
  pruefe('90 … nur eine Sitzungszeile', w.kreuz_sitzungszeilen === '1', w.kreuz_sitzungszeilen);
  pruefe('91 Antwort im selben Unterthema: ok', w.antwort_selbes_unterthema === 'ok', w.antwort_selbes_unterthema);
  pruefe('91 Antwort in anderes Unterthema: zu', w.antwort_anderes_unterthema === 'zu', w.antwort_anderes_unterthema);
  pruefe('93 Weg-Merker vom Client nicht setzbar', w.weg_merker_selbst === 'zu' || w.weg_merker_gesetzt === '0', `${w.weg_merker_selbst} ${w.weg_merker_gesetzt}`);
  pruefe('94 eigenes Kontaktbild mit eigener Datei: ok', w.kb_eigenes_bild === 'ok', w.kb_eigenes_bild);
  pruefe('94/117 fremde Datei als Kontaktbild: zu', w.kb_fremdes_bild === 'zu', w.kb_fremdes_bild);
  pruefe('94 Kontaktbild für Nicht-Kontakt: zu', w.kb_kein_kontakt === 'zu', w.kb_kein_kontakt);
  pruefe('94 Kontaktbild im Namen anderer: zu', w.kb_fuer_andere === 'zu', w.kb_fuer_andere);
  pruefe('94 Adresse mit fremdem Host (Pfad wie Eimer): zu', w.kb_fremder_host === 'zu', w.kb_fremder_host);
  pruefe('94 Adresse außerhalb des Eimers: zu', w.kb_fremder_eimer === 'zu', w.kb_fremder_eimer);
  console.log('\nTestkonto (der Kontakt)');
  pruefe('94 Kontakt sieht das Bild über sich nicht', w.kb_kontakt_sieht === '0', w.kb_kontakt_sieht);
  pruefe('88 Pronomen für andere lesbar', w.pronomen_lesbar === 'sie/ihr', w.pronomen_lesbar);

  console.log(`\n${anzahl - fehler}/${anzahl} Prüfungen bestanden (alles verworfen)`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
