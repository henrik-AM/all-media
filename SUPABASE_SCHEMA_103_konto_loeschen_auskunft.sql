-- =====================================================================
-- SUPABASE_SCHEMA_103_konto_loeschen_auskunft.sql — 22.10.2026
--
-- Auftrag Recht/Sicherheit vom 21.10.2026, Kasten RS 2 (Löschen und
-- Auskunft). Maßstab laut Henrik: veröffentlichte App mit vielen Nutzern.
--
-- WORUM ES GEHT
--
-- 1. „Konto löschen" zeigte in App und Website nur „Löschauftrag
--    vorgemerkt". Gelöscht wurde nichts. Das verletzt DSGVO Art. 17, und
--    Apple (App Review 5.1.1 v) wie Google Play verlangen, dass sich ein
--    Konto in der App selbst löschen lässt — sonst keine Freigabe.
-- 2. meine_daten() (Auskunft nach Art. 15/20, Schema 18) kannte keine
--    Tabelle, die nach Schema 18 dazukam: Geburtsdatum und Eltern,
--    Bildschirmzeit, Feed-Lenkung, Impressionen, Telefonbuch, Zahlungs-
--    methoden, Spenden, Storys-Likes, Sammlungen, Markierungen, Geräte-
--    schlüssel … Eine unvollständige Auskunft ist ein eigener Verstoß.
--
-- WIE GELÖSCHT WIRD
--
--   Client: Passwort erneut bestätigen (signInWithPassword), dann
--   meine_medien() holen und die Dateien über die Storage-API löschen
--   (Regel „Eigene Medien loeschen"; direktes SQL auf storage.objects
--   blockt Supabase mit protect_delete), dann konto_loeschen('LOESCHEN').
--
--   konto_loeschen():
--     - bricht ab, solange noch eigene Dateien im Speicher liegen
--       (sonst blieben Fotos ohne Eigentümer liegen);
--     - hat das Konto eine laufende Sperre (profile_bans), bleibt ein
--       gesalzener Hash der Telefonnummer bis zum Sperrende stehen
--       (gesperrte_nummern) — sonst wäre Löschen + neu anmelden der Weg um
--       jede Sperre (Art. 17 Abs. 3 e DSGVO, Art. 23 DSA). Keine Nummer im
--       Klartext, kein Name, nur Hash und Datum;
--     - beendet als Elternteil die Elternkontrolle über die Kinder und
--       sagt ihnen Bescheid (die erteilte Zustimmung bleibt gültig);
--     - löscht auth.users. Alles Weitere fällt per cascade (85 Fremd-
--       schlüssel, Stand 22.10.2026). Meldungen BLEIBEN als Beleg, ohne
--       Bezug auf das gelöschte Konto (Schema 102: on delete set null).
--
-- ENTSCHEIDUNGEN, DIE HENRIK NOCH TREFFEN KANN (E3, Entscheidungsvorlage)
--
--   - Sofort löschen (so gebaut) oder 30 Tage Frist mit Widerruf (wie
--     Instagram). Sofort ist rechtlich sicher; eine Frist braucht einen
--     geplanten Auftrag (pg_cron) und einen Dienstschlüssel für die Medien.
--   - Nachrichten an andere verschwinden auch bei ihnen (cascade, so
--     gebaut — datensparsam) oder bleiben als „gelöschtes Konto" stehen.
--   - Sperr-Hash bei Löschung (so gebaut) ja/nein.
--
-- Feature-Schema: erst beim Abschluss der Supabase-Sperre einspielen, NACH
-- 102 (nutzt rechtsmitteilung()). Probe: app/test/_probe103.js.
--
-- Einspielen:
--   SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs SUPABASE_SCHEMA_103_konto_loeschen_auskunft.sql
-- Danach: npm run test:rechte, test:schema, test:minderjaehrig, test:angriffe
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Gesperrte Nummern (nur Hash, nur bis Sperrende)
-- ---------------------------------------------------------------------

create table if not exists public.nummer_pfeffer (
  id smallint primary key check (id = 1),
  wert bytea not null default gen_random_bytes(32)
);
insert into public.nummer_pfeffer (id) values (1) on conflict (id) do nothing;
alter table public.nummer_pfeffer enable row level security;
revoke all on public.nummer_pfeffer from public, anon, authenticated;
drop policy if exists nur_freigegebene on public.nummer_pfeffer;
create policy nur_freigegebene on public.nummer_pfeffer
  as restrictive for all to authenticated
  using ((select public.konto_freigegeben())) with check ((select public.konto_freigegeben()));

create table if not exists public.gesperrte_nummern (
  hash text primary key,
  bis timestamptz,               -- null = unbefristete Sperre
  angelegt timestamptz not null default now()
);
alter table public.gesperrte_nummern enable row level security;
revoke all on public.gesperrte_nummern from public, anon, authenticated;
drop policy if exists nur_freigegebene on public.gesperrte_nummern;
create policy nur_freigegebene on public.gesperrte_nummern
  as restrictive for all to authenticated
  using ((select public.konto_freigegeben())) with check ((select public.konto_freigegeben()));

create or replace function public.nummer_hash(p_nummer text)
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  select encode(extensions.digest((select wert from public.nummer_pfeffer where id = 1)
                       || convert_to(public.nummer_vergleichsform(p_nummer), 'UTF8'), 'sha256'), 'hex');
$$;
revoke execute on function public.nummer_hash(text) from public, anon, authenticated;

-- Wer mit einer gesperrten Nummer ein neues Konto anlegt, wird abgewiesen.
--
-- Die Prüfung sitzt VOR dem Anlegen in auth.users, nicht erst am Profil:
-- handle_new_user() fängt jeden Fehler beim Profil-Insert ab — ein Auslöser
-- dort ließe das Konto ohne Profil stehen statt es abzuweisen (Probe 103).
-- Supabase meldet der App dann „Database error saving new user"; der Client
-- übersetzt das (gemeinsam/passwort.js, uebersetze). Auf profiles prüft derselbe
-- Auslöser nur das spätere Ändern der Nummer.
create or replace function public.gesperrte_nummer_pruefen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bis_zeit timestamptz;
  gefunden boolean;
  nummer   text;
begin
  if tg_table_schema = 'auth' then
    nummer := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', new.phone)), '');
  else
    nummer := nullif(trim(new.phone), '');
  end if;
  if nummer is null then return new; end if;
  delete from public.gesperrte_nummern where bis is not null and bis < now();
  select true, g.bis into gefunden, bis_zeit
    from public.gesperrte_nummern g where g.hash = public.nummer_hash(nummer);
  if gefunden then
    raise exception 'Diese Telefonnummer ist %',
      coalesce('bis ' || to_char(bis_zeit at time zone 'Europe/Berlin', 'DD.MM.YYYY') || ' gesperrt.',
               'gesperrt.')
      using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.gesperrte_nummer_pruefen() from public, anon, authenticated;
drop trigger if exists gesperrte_nummer_pruefen on public.profiles;
create trigger gesperrte_nummer_pruefen before update of phone on public.profiles
  for each row execute function public.gesperrte_nummer_pruefen();
drop trigger if exists gesperrte_nummer_pruefen on auth.users;
create trigger gesperrte_nummer_pruefen before insert on auth.users
  for each row execute function public.gesperrte_nummer_pruefen();


-- ---------------------------------------------------------------------
-- 2. Eigene Dateien auflisten (für das Löschen über die Storage-API)
-- ---------------------------------------------------------------------

create or replace function public.meine_medien()
returns table (bucket text, name text)
language sql
stable
security definer
set search_path = public, storage
as $$
  select o.bucket_id, o.name from storage.objects o
   where auth.uid() is not null and o.owner = auth.uid()
   order by o.name
   limit 10000;
$$;
revoke execute on function public.meine_medien() from public, anon;
grant execute on function public.meine_medien() to authenticated;


-- ---------------------------------------------------------------------
-- 3. Konto löschen
-- ---------------------------------------------------------------------

-- Der Datenbankteil, gemeinsam für konto_loeschen() und den Trockenlauf
-- konto_loeschen_probe(). Nur intern (kein EXECUTE für Clients).
create or replace function public.konto_loeschen_ausfuehren(ich uuid)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  nummer   text;
  sperre   record;
  kind     record;
begin
  select phone into nummer from public.profiles where id = ich;

  -- Laufende Sperre → Nummer bis Sperrende merken (nur Hash).
  select max(b.bis_at) as bis, bool_or(b.bis_at is null) as unbefristet
    into sperre
    from public.profile_bans b
   where b.user_id = ich and not b.aufgehoben and (b.bis_at is null or b.bis_at > now());
  if nummer is not null and nummer <> '' and (sperre.unbefristet or sperre.bis is not null) then
    insert into public.gesperrte_nummern (hash, bis)
    values (public.nummer_hash(nummer), case when sperre.unbefristet then null else sperre.bis end)
    on conflict (hash) do update set bis = excluded.bis;
  end if;

  -- Elternteil löscht: Kontrolle endet, Kinder erfahren es.
  for kind in
    select k.user_id from public.konto_alter k where k.eltern_id = ich
  loop
    delete from public.bildschirmzeit_regeln where user_id = kind.user_id;
    perform public.rechtsmitteilung(kind.user_id,
      'Dein Elternteil hat sein All-Media-Konto gelöscht. Die Elternkontrolle (Bildschirmzeit) ist damit beendet.',
      null);
  end loop;

  delete from auth.users where id = ich;
end $$;
revoke execute on function public.konto_loeschen_ausfuehren(uuid) from public, anon, authenticated;

create or replace function public.konto_loeschen(p_bestaetigung text)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  ich      uuid := auth.uid();
  medien   integer;
begin
  if ich is null then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  -- Zweite Sicherung neben der Passwortabfrage im Client: Ein versehentlicher
  -- oder fremder Aufruf ohne das Wort löscht nichts.
  if p_bestaetigung is distinct from 'LOESCHEN' then
    return jsonb_build_object('ok', false, 'grund', 'bestaetigung');
  end if;
  -- Prüf- und Testkonten werden nie gelöscht (Testbestand).
  if public.ist_testkonto(ich) then
    return jsonb_build_object('ok', false, 'grund', 'testkonto');
  end if;

  select count(*) into medien from storage.objects where owner = ich;
  if medien > 0 then
    return jsonb_build_object('ok', false, 'grund', 'medien', 'anzahl', medien);
  end if;

  perform public.konto_loeschen_ausfuehren(ich);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.konto_loeschen(text) from public, anon;
grant execute on function public.konto_loeschen(text) to authenticated;

-- Trockenlauf (Codex-Fund F1, 31.10.2026). Der Ablauf (gemeinsam/
-- konto-loeschen.js) löscht die Dateien VOR dem Datenbankteil — umgekehrt
-- geht es nicht: Nach `delete from auth.users` ist die Sitzung ungültig und
-- die Storage-API lehnt das Löschen ab, und SQL auf storage.objects lässt
-- die Datei verwaist im Speicher (Supabase-Doku „Delete Objects“). Damit
-- ein Fehler im Datenbankteil (wie F1) nicht ein Konto ohne Fotos
-- zurücklässt, probt der Client ihn vorher: alles löschen, dann per
-- Ausnahme zurückrollen. Ergebnis ok oder grund 'datenbank'.
create or replace function public.konto_loeschen_probe()
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  ich uuid := auth.uid();
begin
  if ich is null then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  if public.ist_testkonto(ich) then
    return jsonb_build_object('ok', false, 'grund', 'testkonto');
  end if;
  begin
    perform public.konto_loeschen_ausfuehren(ich);
    raise exception 'allmedia_probe_ok' using errcode = 'P0001';
  exception when others then
    if sqlerrm = 'allmedia_probe_ok' then
      return jsonb_build_object('ok', true);
    end if;
    raise warning 'konto_loeschen_probe: % (%)', sqlerrm, sqlstate;
    return jsonb_build_object('ok', false, 'grund', 'datenbank');
  end;
end $$;
revoke execute on function public.konto_loeschen_probe() from public, anon;
grant execute on function public.konto_loeschen_probe() to authenticated;


-- ---------------------------------------------------------------------
-- 4. Vollständige Auskunft (Art. 15 und 20 DSGVO)
-- ---------------------------------------------------------------------
--
-- Statt jede Tabelle von Hand: eine Liste (Tabelle, Spalte des Eigentümers,
-- Spalten, die NICHT herausgehen). Tabellen, die es (noch) nicht gibt,
-- werden übersprungen — so passt die Funktion vor und nach den Feature-
-- Schemas 88–100. Was fehlt, fällt in test:recht auf (Abgleich mit allen
-- Fremdschlüsseln auf profiles/auth.users).
--
-- Nicht enthalten, mit Grund:
--   - Nachrichten anderer Menschen (deren Daten), auch nicht aus gemeinsamen Chats
--   - Hashes und Geheimnisse: Spenden-PIN, Entsperrcode, Pfeffer, gesperrte_nummern
--   - Telefonbuch: die gehashten Nummern ANDERER — nur die Anzahl
--   - Wer mein Profil angesehen hat (Daten über andere) — nur die Anzahl
--   - Bremsen-Zähler (nummer_suche_takt, entsperrcode_versuche …) — nur Technik

create or replace function public.meine_daten()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ich      uuid := auth.uid();
  ergebnis jsonb;
  eintrag  record;
  teil     jsonb;
begin
  if ich is null then
    raise exception 'Nicht angemeldet';
  end if;

  ergebnis := jsonb_build_object(
    'erstellt_am', now(),
    'hinweis',
      'Auskunft nach Artikel 15 und 20 DSGVO. Enthalten ist, was zu diesem Konto gespeichert ist. '
      'Nachrichten anderer Menschen sind deren Daten und stehen deshalb nicht darin — auch nicht aus '
      'gemeinsamen Chats. Verschlüsselte Nachrichten stehen hier nur als Chiffre; lesbar sind sie '
      'nur auf deinen Geräten.',
    'konto', (select jsonb_build_object('email', u.email, 'angelegt', u.created_at,
                                        'letzte_anmeldung', u.last_sign_in_at)
                from auth.users u where u.id = ich),
    'profil', (select to_jsonb(p) - 'demo' from public.profiles p where p.id = ich),
    'alter_und_eltern', (select to_jsonb(k) from public.konto_alter k where k.user_id = ich),
    'meine_kinder', coalesce((select jsonb_agg(jsonb_build_object('konto', k.user_id, 'status', k.status))
                                from public.konto_alter k where k.eltern_id = ich), '[]'::jsonb),
    'telefonbuch_abgleich_anzahl', (select count(*) from public.telefonbuch t where t.user_id = ich),
    'profilaufrufe_gesamt', (select count(*) from public.profile_views pv where pv.profile_id = ich),
    'einstellungen', coalesce((select jsonb_object_agg(s.schluessel, s.wert)
                                 from public.user_settings s where s.user_id = ich), '{}'::jsonb)
  );

  for eintrag in
    select * from (values
      ('beitraege',            'posts',                   'user_id',     '{demo}'::text[]),
      ('storys',               'stories',                 'user_id',     '{demo}'),
      ('kommentare',           'comments',                'user_id',     '{}'),
      ('eigene_nachrichten',   'messages',                'sender_id',   '{demo}'),
      ('community_nachrichten','community_channel_messages','sender_id', '{}'),
      ('push_to_talk',         'ptt_messages',            'sender_id',   '{}'),
      ('chats',                'chat_members',            'user_id',     '{}'),
      ('kontakte',             'contacts',                'user_id',     '{}'),
      ('folge_ich',            'follows',                 'follower_id', '{}'),
      ('communitys',           'community_members',       'user_id',     '{}'),
      ('communitys_erstellt',  'communities',             'created_by',  '{demo}'),
      ('likes',                'post_likes',              'user_id',     '{}'),
      ('kommentar_likes',      'comment_likes',           'user_id',     '{}'),
      ('story_likes',          'story_likes',             'user_id',     '{}'),
      ('story_aufrufe',        'story_views',             'user_id',     '{}'),
      ('reposts',              'reposts',                 'user_id',     '{}'),
      ('gespeichert',          'saves',                   'user_id',     '{}'),
      ('sammlungen',           'sammlungen',              'user_id',     '{}'),
      ('sammlung_beitraege',   'sammlung_beitraege',      'user_id',     '{}'),
      ('geteilt',              'shares',                  'shared_by',   '{}'),
      ('an_mich_geteilt',      'shares',                  'shared_to',   '{}'),
      ('reaktionen',           'message_reactions',       'user_id',     '{}'),
      ('markierte_nachrichten','message_stars',           'user_id',     '{}'),
      ('umfragen',             'polls',                   'user_id',     '{}'),
      ('umfrage_stimmen',      'poll_votes',              'user_id',     '{}'),
      ('markierungen_von_mir', 'markierungen',            'von_id',      '{}'),
      ('markierungen_von_mir_in_beitraegen','post_tags',  'user_id',     '{}'),
      ('markierungen_in_storys','story_tags',             'user_id',     '{}'),
      ('blockiert',            'blocks',                  'user_id',     '{}'),
      ('stummgeschaltet',      'mutes',                   'user_id',     '{}'),
      ('kein_interesse',       'kein_interesse',          'user_id',     '{}'),
      ('vorschlag_entfernt',   'vorschlag_entfernt',      'user_id',     '{}'),
      ('feed_lenkung',         'feed_lenkung',            'user_id',     '{}'),
      ('feed_neustart',        'feed_neustart',           'user_id',     '{}'),
      ('impressionen',         'post_impressions',        'user_id',     '{}'),
      ('profile_angesehen',    'profile_views',           'viewer_id',   '{}'),
      ('sichtbarkeit',         'visibility_settings',     'user_id',     '{}'),
      ('sichtbarkeit_ausnahmen','visibility_exceptions',  'user_id',     '{}'),
      ('benachrichtigungen_profile','post_notify',        'user_id',     '{}'),
      ('mitteilungen',         'notifications',           'user_id',     '{}'),
      ('online_zuletzt',       'presence',                'user_id',     '{}'),
      ('geraeteschluessel',    'krypto_schluessel',       'user_id',     '{}'),
      ('bildschirmzeit_regeln','bildschirmzeit_regeln',   'user_id',     '{}'),
      ('bildschirmzeit_nutzung','bildschirmzeit_nutzung', 'user_id',     '{}'),
      ('bildschirmzeit_freigaben','bildschirmzeit_freigaben','user_id',  '{}'),
      ('zahlungsmethoden',     'zahlungsmethoden',        'user_id',     '{anbieter_token}'),
      ('spenden_gesendet',     'donations',               'sender_id',   '{}'),
      ('spenden_erhalten',     'donations',               'empfaenger_id','{}'),
      ('spendencode_protokoll','spendencode_protokoll',   'user_id',     '{}'),
      ('insights_gesendet',    'insights',                'sender_id',   '{}'),
      ('insights_erhalten',    'insight_recipients',      'user_id',     '{}'),
      ('insight_ziele',        'insight_targets',         'user_id',     '{}'),
      ('insight_serien_a',     'insight_streaks',         'user_a',      '{}'),
      ('insight_serien_b',     'insight_streaks',         'user_b',      '{}'),
      ('standortanfragen',     'location_requests',       'sender_id',   '{}'),
      ('standortanfragen_an_mich','location_requests',    'ziel_id',     '{}'),
      ('telefonbuch_abgleiche','telefonbuch_abgleiche',   'user_id',     '{}'),
      ('nummer_suchen',        'nummer_treffer',          'nutzer',      '{}'),
      ('angeheftete_freunde',  'friend_pins',             'user_id',     '{}'),
      ('stream_kommentare',    'stream_comments',         'user_id',     '{}'),
      ('meldungen_von_mir',    'reports',                 'reported_by', '{beleg,entfernte_zeile,entschieden_von,mitteilung_zurueck}'),
      ('sperren_gegen_mich',   'profile_bans',            'user_id',     '{}'),
      ('beschwerden',          'beschwerden',             'von',         '{entschieden_von}'),
      ('freundschaften',       'freundschaften',          'von',         '{}'),
      ('einladungen',          'einladungen',             'erstellt_von','{}'),
      -- Schema 106: welcher Fassung zugestimmt (auch durch die Eltern).
      ('einwilligungen',       'einwilligungen',          'user_id',     '{}')
    ) as t(schluessel, tabelle, spalte, ohne)
  loop
    if to_regclass('public.' || eintrag.tabelle) is null
       or not exists (select 1 from information_schema.columns c
                       where c.table_schema = 'public' and c.table_name = eintrag.tabelle
                         and c.column_name = eintrag.spalte) then
      continue;
    end if;
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(t) - $2), ''[]''::jsonb) from (select * from public.%I where %I = $1 limit 50000) t',
      eintrag.tabelle, eintrag.spalte)
      into teil using ich, eintrag.ohne;
    ergebnis := ergebnis || jsonb_build_object(eintrag.schluessel, teil);
  end loop;

  -- Entscheidungen über mich (Art. 17 DSA), ohne Beleg und ohne Moderator.
  -- Ohne zurückgestellte (Codex-Fund F3, 31.10.2026): Solange die Begründung
  -- wegen Ermittlungen wartet (reports.mitteilung_zurueck, Schema 102),
  -- steht die Entscheidung hier so wenig wie in
  -- mich_betreffende_entscheidungen() — sonst ließe sich die Zurückstellung
  -- (Art. 15 Abs. 4 DSGVO i. V. m. § 34 BDSG, Art. 18 DSA) per Auskunft umgehen.
  if to_regclass('public.reports') is not null
     and exists (select 1 from information_schema.columns where table_name = 'reports' and column_name = 'ziel_profil') then
    execute 'select coalesce(jsonb_agg(jsonb_build_object(''art'', target_type, ''massnahme'', massnahme,
               ''begruendung'', begruendung, ''grundlage'', grundlage, ''am'', entschieden_am)), ''[]''::jsonb)
               from public.reports where ziel_profil = $1 and massnahme is not null
                and (to_jsonb(reports) ->> ''mitteilung_zurueck'') is null'
      into teil using ich;
    ergebnis := ergebnis || jsonb_build_object('entscheidungen_ueber_mich', teil);
  end if;

  return ergebnis;
end $$;
revoke execute on function public.meine_daten() from public, anon;
grant execute on function public.meine_daten() to authenticated;


-- ---------------------------------------------------------------------
-- 5. Selbstprüfung
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'gesperrte_nummern'
                  and policyname = 'nur_freigegebene' and permissive = 'RESTRICTIVE') then
    raise exception 'nur_freigegebene fehlt auf gesperrte_nummern';
  end if;
  if has_function_privilege('anon', 'public.konto_loeschen(text)', 'execute')
     or has_function_privilege('authenticated', 'public.nummer_hash(text)', 'execute') then
    raise exception 'Schema 103: Rechte zu weit';
  end if;
end $$;
