-- ===========================================================================
-- ABGLEICH MIT MAIN (Paket 1, 05.11.2026, Stand origin/main ad7f221)
--   Live nur lesend geprüft (pg_get_constraintdef), keine main-Datei 101–117
--   (auch nicht 102/103/106) definiert eines dieser Objekte neu:
--   * notifications_art_check: Liste hier = Live-Liste (17 Arten, inkl.
--     'system' für Schema 102) + 'ptt'. Keine live erlaubte Art fehlt.
--   * notifications_target_type_check: Liste hier = Live-Liste (9 Ziele)
--     + 'channel'. Kein live erlaubtes Ziel fehlt.
--     Schema 92 fasst beide Bedingungen nicht an (Gewinner bleibt 90).
--     Die Entwürfe 97/98 (Paket 2, Sammelzweig) ersetzen notifications_art_check
--     erneut — dort nicht geprüft; sie müssen 'ptt'/'channel' mitnehmen.
--   * kanalnachricht_nicht_leer: Fassung aus 89 + ptt_sitzung.
--   * community_members.ptt_benachrichtigung, community_channel_messages.ptt_sitzung,
--     ptt_messages.sitzung_id, Regel „Sitzungszeile nur vom Ausloeser“
--     (restriktiv, verundet mit nicht_ausgeblendet aus 102),
--     ptt_mitteilen(), ptt_sitzung_zuordnen() + Auslöser: neu.
--   * zeitstempel_vom_server() + Auslöser auf ptt_messages und
--     community_channel_messages: neu (Codex-Fund 05.11., Zukunftszeitstempel).
--     Live geprüft: keine Zukunftszeilen, keine UPDATE-Regel auf beiden Tabellen.
--   * Schema 117 prüft ptt_messages.audio_url und community_channel_messages.
--     media_url; die Sitzungszeile hat keine Medienadresse → unberührt.
-- ===========================================================================
-- ===========================================================================
--  SUPABASE_SCHEMA_90_push_to_talk.sql            (Feedback 28.09.2026, Kasten 8)
--  Push to Talk: Sitzung im Unterthema, Schalter je Community, Mitteilung
--  ENTWURF, 10.10.2026 — NICHT EINGESPIELT (Supabase gesperrt, 402)
--  SETZT SCHEMA 89 VORAUS (anruf_art auf community_channel_messages).
-- ===========================================================================
--
--  WORUM ES GEHT (Henrik, 28.09.2026)
--
--  „Wenn jemand anfängt, auf den Button zu drücken, sollen die anderen
--  Mitglieder dieser Community, die für diese Community Push-to-Talk-
--  Benachrichtigung aktiviert haben, eine Nachricht bekommen, ob sie dem
--  Push to Talk beitreten möchten. Der Verlauf soll nicht einfach so im Chat
--  stehen, sondern im Chat eines Unterthemas soll eine Nachricht „Push to
--  Talk" mit Datum und Uhrzeit stehen, und wenn man draufdrückt, sieht man
--  den ganzen Verlauf."
--
--  BEFUND VORHER (live, nur lesend, 10.10.2026)
--
--    - `ptt_messages` (Schema 11): community_id, channel_id, sender_id,
--      audio_url, dauer, created_at. Kein Ausloeser.
--    - `community_members`: community_id, user_id, joined_at, is_muted.
--      Kein PTT-Schalter.
--    - notifications_art_check kennt kein 'ptt', target_type kein 'channel'.
--
--  BEGRIFF „SITZUNG"
--
--    Eine Push-to-Talk-Sitzung ist eine Folge von Wortmeldungen im SELBEN
--    Unterthema, zwischen denen jeweils hoechstens 10 Minuten liegen. Liegt
--    die letzte Wortmeldung dort mehr als 10 Minuten zurueck (oder gibt es
--    keine), beginnt mit der naechsten eine neue Sitzung. Die 10 Minuten
--    zaehlen ab der LETZTEN Wortmeldung, nicht ab dem Beginn.
--
--  WAS DIESE DATEI TUT
--
--  1. community_members.ptt_benachrichtigung (boolean, Vorgabe false) — der
--     Schalter „Push-to-Talk-Benachrichtigung" je Community (8.4). Vorgabe
--     AUS: Henrik spricht von Mitgliedern, „die … aktiviert haben".
--     Schreiben ueber die bestehende Regel „Selbst beitreten und verlassen"
--     (for all, auth.uid() = user_id) — nur die eigene Zeile.
--  2. community_channel_messages.ptt_sitzung (boolean) — die eine Zeile
--     „Push to Talk" je Sitzung (8.5). Text leer, die Anzeige schreibt
--     „Push to Talk · Datum, Uhrzeit". Clients duerfen sie NICHT selbst
--     anlegen (einschraenkende Regel unten) — nur der Ausloeser.
--  3. ptt_messages.sitzung_id → diese Zeile. Antippen zeigt alle
--     Wortmeldungen mit dieser sitzung_id (8.6).
--  4. Ausloeser `ptt_sitzung_zuordnen` (BEFORE INSERT auf ptt_messages):
--       - Unterthema muss zur Community gehoeren (sonst Fehler),
--       - Sitzung suchen (≤ 10 Min.), sonst Zeile „Push to Talk" anlegen,
--       - NUR bei neuer Sitzung: Mitteilung „Push to Talk beitreten?" (8.3)
--         an jedes Mitglied der Community mit
--            ptt_benachrichtigung = true
--            und nicht der Sprecher selbst
--            und Community nicht stummgeschaltet (is_muted)
--            und Sprecher nicht stummgeschaltet (mutes, ueber mitteilung_stumm)
--            und keine Blockierung in irgendeiner Richtung (blocks)
--            und sichtbar_fuer(empfaenger, 'ptt', sprecher) — die Einstellung
--                „Push-to-Talk Benachrichtigung" in den Einstellungen (Schema 20)
--            und Konto freigegeben (konto_stand = 'frei', Schema 52 —
--                wartende Minderjaehrigen-Konten bekommen nichts).
--       Ohne Unterthema (channel_id null, alter Weg) keine Sitzung und keine
--       Mitteilung.
--  5. notifications: art 'ptt', target_type 'channel' zulassen.
--
--  RECHTE
--
--  Neue Funktionen: EXECUTE fuer public, anon, authenticated entzogen
--  (Ausloeser laufen als Eigentuemer). Keine neue Tabelle → keine neue
--  `nur_freigegebene`-Regel noetig (die drei Tabellen haben sie, live
--  geprueft).
--
--  TESTBESTAND
--
--  zuruecksetzen() loescht ptt_messages und community_channel_messages des
--  Pruefkontos (sender_id) und dessen Mitteilungen — die Sitzungszeile hat
--  den Sprecher als sender_id und faellt damit mit. Der Schalter sitzt an der
--  Mitgliedschaft und geht mit ihr. Nichts nachzutragen (live geprueft).
--
--  ERSETZT
--
--    - Bedingung notifications_art_check         (zuletzt Schema 57)
--    - Bedingung notifications_target_type_check (zuletzt Schema 49)
--    - Bedingung kanalnachricht_nicht_leer       (zuletzt Schema 89)
--  Wer 49, 57 oder 89 neu einspielt, muss 90 nachziehen. ACHTUNG: Schema 88
--  (Profilseite, anderer Agent) — falls es notifications_art_check ebenfalls
--  aendert, die Listen zusammenfuehren.
--
--  Einspielen (nach 89, durch den Hauptagenten):
--    SUPABASE_TOKEN=... node tools/sql-einspielen.mjs \
--      ../SUPABASE_SCHEMA_90_push_to_talk.sql
--  Danach: npm run test:rechte, npm run test:k28-anruf-ptt.
-- ===========================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'community_channel_messages'
                    and column_name = 'anruf_art') then
    raise exception 'Schema 90 setzt Schema 89 voraus (community_channel_messages.anruf_art fehlt)';
  end if;
end $$;


-- ---------------------------------------------------------------------------
--  1.–3. Spalten
-- ---------------------------------------------------------------------------

alter table public.community_members
  add column if not exists ptt_benachrichtigung boolean not null default false;
comment on column public.community_members.ptt_benachrichtigung is
  'Kasten 8.4: „Push to Talk beitreten?" fuer diese Community bekommen. '
  'Gehoert zur Mitgliedschaft — jeder entscheidet fuer sich.';

alter table public.community_channel_messages
  add column if not exists ptt_sitzung boolean not null default false;
comment on column public.community_channel_messages.ptt_sitzung is
  'Kasten 8.5: Beginn einer Push-to-Talk-Sitzung. Legt nur der Ausloeser an.';

alter table public.ptt_messages
  add column if not exists sitzung_id uuid
    references public.community_channel_messages (id) on delete set null;
create index if not exists ptt_messages_sitzung_idx
  on public.ptt_messages (sitzung_id, created_at);
create index if not exists ptt_messages_kanal_idx
  on public.ptt_messages (channel_id, created_at desc);

-- Wortgleich mit Schema 89, plus die Sitzungszeile.
alter table public.community_channel_messages
  drop constraint if exists kanalnachricht_nicht_leer;
alter table public.community_channel_messages
  add constraint kanalnachricht_nicht_leer
  check (
    coalesce(text, '') <> ''
    or media_url is not null
    or media_type is not null
    or place_id is not null
    or contact_user_id is not null
    or shared_post_id is not null
    or anruf_art is not null
    or ptt_sitzung
  );

-- Eine Sitzungszeile schreibt nur der Ausloeser. Einschraenkend, damit sie
-- mit „Im Kanal schreiben" verundet wird (eine zweite permissive Regel
-- wuerde verodert und nichts verbieten).
drop policy if exists "Sitzungszeile nur vom Ausloeser" on public.community_channel_messages;
create policy "Sitzungszeile nur vom Ausloeser" on public.community_channel_messages
  as restrictive
  for insert to authenticated
  with check (not ptt_sitzung);

-- Ebenso: sitzung_id setzt nur der Ausloeser (er ueberschreibt sie ohnehin).


-- ---------------------------------------------------------------------------
--  5. Mitteilungsarten
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_art_check;
alter table public.notifications add constraint notifications_art_check
  check (art in ('like', 'comment', 'follow', 'mention', 'share', 'message', 'system',
                 'repost', 'story', 'kanal', 'beitritt', 'nachricht', 'einladung',
                 'anfrage', 'anfrage_ok', 'messenger_anfrage', 'messenger_ok',
                 'ptt'));

alter table public.notifications drop constraint if exists notifications_target_type_check;
alter table public.notifications add constraint notifications_target_type_check
  check (target_type in ('post', 'comment', 'story', 'user', 'message', 'community',
                         'profile', 'video', 'chat', 'channel'));


-- ---------------------------------------------------------------------------
--  8.3: wer die Mitteilung bekommt — eine Stelle
-- ---------------------------------------------------------------------------

create or replace function public.ptt_mitteilen(p_community uuid, p_kanal uuid, p_sprecher uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_an    uuid;
  v_zahl  integer := 0;
begin
  for v_an in
    select m.user_id
      from public.community_members m
     where m.community_id = p_community
       and m.ptt_benachrichtigung
       and not coalesce(m.is_muted, false)
       and m.user_id <> p_sprecher
       and public.konto_stand(m.user_id) = 'frei'
       and public.sichtbar_fuer(m.user_id, 'ptt', p_sprecher)
       and not exists (
         select 1 from public.blocks b
          where (b.user_id = m.user_id and b.blocked_user_id = p_sprecher)
             or (b.user_id = p_sprecher and b.blocked_user_id = m.user_id))
  loop
    -- mitteilung_anlegen (Gewinner 78) prueft zusaetzlich mutes.
    perform public.mitteilung_anlegen(v_an, p_sprecher, 'ptt', 'communities', 'channel', p_kanal);
    v_zahl := v_zahl + 1;
  end loop;
  return v_zahl;
end $$;

revoke execute on function public.ptt_mitteilen(uuid, uuid, uuid)
  from public, anon, authenticated;


-- ---------------------------------------------------------------------------
--  4. Sitzung zuordnen (BEFORE INSERT)
-- ---------------------------------------------------------------------------

create or replace function public.ptt_sitzung_zuordnen()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_community uuid;
  v_sitzung   uuid;
  v_jetzt     timestamptz;
begin
  -- Was der Client mitschickt, zaehlt nicht.
  new.sitzung_id := null;

  if new.channel_id is null then
    return new;
  end if;

  select k.community_id into v_community
    from public.community_channels k where k.id = new.channel_id;
  if v_community is null or v_community <> new.community_id then
    raise exception 'Das Unterthema gehört nicht zu dieser Community';
  end if;

  -- Zwei gleichzeitige erste Wortmeldungen sollen nicht zwei Sitzungen
  -- anlegen: je Unterthema nacheinander.
  perform pg_advisory_xact_lock(hashtext('ptt:' || new.channel_id::text));

  -- Uhrzeit NACH der Sperre, einmal erfasst (Codex-Fund Runde 2, 05.11.):
  -- now() ist der Transaktionsbeginn. Beginnt A vor B, bekommt die Sperre
  -- aber erst nach Bs Commit, laege Bs Wortmeldung fuer A „in der Zukunft"
  -- und A legte eine zweite Sitzung an (doppelte Einladung). Ab der Sperre
  -- ist jede schon committete Wortmeldung dieses Unterthemas aelter als
  -- clock_timestamp() — beide Grenzen kommen deshalb aus v_jetzt.
  v_jetzt := clock_timestamp();

  -- Zukunftsgrenze `v_jetzt + 5 Sekunden`: eine Zeile mit echter Zukunftszeit
  -- (Altbestand/Angriff von vor `zeitstempel_vom_server`, Codex-Fund 05.11.)
  -- haelt sonst die Sitzung fuer immer offen — keine neue Sitzungszeile,
  -- keine Einladung. 5 s statt 0: Client-Zeilen tragen seit dem Fix ihre
  -- clock_timestamp() unter derselben Sperre, liegen also nie nach v_jetzt;
  -- die Toleranz faengt nur Uhrkorrekturen (NTP-Schritt rueckwaerts) und
  -- Eigentuemer-Zeilen mit Sekundenbruchteilen Vorlauf ab.
  -- Schaden der Toleranz: eine Zeile hoechstens 5 s in der Zukunft haelt die
  -- Sitzung hoechstens 5 s laenger offen — unerheblich bei 10 Minuten.
  select p.sitzung_id into v_sitzung
    from public.ptt_messages p
   where p.channel_id = new.channel_id
     and p.sitzung_id is not null
     and p.created_at > v_jetzt - interval '10 minutes'
     and p.created_at <= v_jetzt + interval '5 seconds'
   order by p.created_at desc
   limit 1;

  if v_sitzung is null then
    insert into public.community_channel_messages (channel_id, sender_id, text, ptt_sitzung)
    values (new.channel_id, new.sender_id, '', true)
    returning id into v_sitzung;

    perform public.ptt_mitteilen(new.community_id, new.channel_id, new.sender_id);
  end if;

  new.sitzung_id := v_sitzung;
  return new;
end $$;

revoke execute on function public.ptt_sitzung_zuordnen()
  from public, anon, authenticated;

drop trigger if exists ptt_sitzung_zuordnen on public.ptt_messages;
create trigger ptt_sitzung_zuordnen
  before insert on public.ptt_messages
  for each row execute function public.ptt_sitzung_zuordnen();


-- ---------------------------------------------------------------------------
--  Zeitstempel vom Server (Codex-Fund [high], 05.11.2026)
--
--  Vorher durfte der Client `created_at` mitschicken (Spaltenrecht INSERT und
--  UPDATE fuer authenticated, live geprueft). Eine PTT-Wortmeldung mit
--  created_at = '2100-01-01' war fuer die Sitzungssuche oben dauerhaft „die
--  juengste" → nie wieder eine neue Sitzungszeile, nie wieder eine Einladung;
--  im Verlauf (aufsteigend, limit 200) und im Unterthema (neueste zuerst)
--  klebte die Zeile ausserdem fuer immer am Ende bzw. oben. Dasselbe ging mit
--  jeder Unterthema-Nachricht (community_channel_messages).
--
--  Jetzt: beim Einfuegen durch den Client (Rolle authenticated/anon) setzt
--  der Server created_at := clock_timestamp(); beim Aendern bleibt der alte Wert (heute
--  gibt es auf beiden Tabellen keine UPDATE-Regel, das ist Vorsorge).
--  Absichtlich SECURITY INVOKER: so ist current_user die Rolle der
--  Anweisung. Eigene Wege des Servers (starter_inhalte, Testbestand aus
--  Schema 6/7/23, die Sitzungszeile aus ptt_sitzung_zuordnen — alle als
--  Eigentuemer) behalten ihren Zeitstempel. Gleiches Muster wie
--  medienreferenz_pruefen (117) und bunny_referenz_pruefen (115).
--  Liest/aendert nur created_at — beruehrt geteilt_weg_schuetzen (93),
--  medienreferenz_pruefen (117), bunny_referenz_pruefen (115) und die
--  Regeln aus 102 nicht.
--
--  clock_timestamp() statt now() (Codex-Fund Runde 2, 05.11.): now() ist der
--  Transaktionsbeginn. Mit now() bekaeme eine Wortmeldung, deren Transaktion
--  frueher begann, aber spaeter committet, einen AELTEREN Zeitstempel als
--  eine schon committete fremde — Reihenfolge im Verlauf ungleich
--  Commit-Reihenfolge, und ein langer Transaktionsbeginn koennte die Zeile
--  ausserhalb des 10-Minuten-Fensters der Sitzungssuche ablegen.
--  Auf ptt_messages laufen BEFORE-Auslöser nach Namen sortiert:
--  ptt_sitzung_zuordnen (p) vor zeitstempel_vom_server (z). Der Zeitstempel
--  entsteht also erst NACH der Kanalsperre, die bis zum Commit gehalten
--  wird — je Unterthema ist created_at damit streng in Commit-Reihenfolge
--  und nie spaeter als das v_jetzt einer nachfolgenden Sitzungssuche.
--  Wer einen Auslöser umbenennt, muss diese Reihenfolge erhalten.
--  Auf community_channel_messages (ohne Sperre) ist clock_timestamp() immer
--  noch naeher am Commit als now() — nicht schlechter, meist besser.
-- ---------------------------------------------------------------------------

create or replace function public.zeitstempel_vom_server()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_at := clock_timestamp();
  else
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

revoke execute on function public.zeitstempel_vom_server()
  from public, anon, authenticated;

drop trigger if exists zeitstempel_vom_server on public.ptt_messages;
create trigger zeitstempel_vom_server
  before insert or update of created_at on public.ptt_messages
  for each row execute function public.zeitstempel_vom_server();

drop trigger if exists zeitstempel_vom_server on public.community_channel_messages;
create trigger zeitstempel_vom_server
  before insert or update of created_at on public.community_channel_messages
  for each row execute function public.zeitstempel_vom_server();


-- ---------------------------------------------------------------------------
--  Nachweis (liest nur)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.routine_privileges
     where routine_schema = 'public'
       and routine_name in ('ptt_mitteilen', 'ptt_sitzung_zuordnen', 'zeitstempel_vom_server')
       and grantee in ('PUBLIC', 'anon', 'authenticated')
       and privilege_type = 'EXECUTE'
  ) then
    raise exception 'Schema 90: EXECUTE ist noch offen';
  end if;
end $$;
