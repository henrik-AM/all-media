-- ===========================================================================
-- ABGLEICH MIT MAIN (Paket 1, 05.11.2026, Stand origin/main ad7f221)
--   Live nur lesend geprüft (pg_get_constraintdef), keine main-Datei 101–117
--   definiert eines dieser Objekte neu:
--   * messages_anruf_status_check: live ('beendet','verpasst','abgelehnt') →
--     hier + 'gestartet'. Nur Erweiterung, keine Rückdrehung.
--   * messages_anruf_gestartet_ohne_dauer, kanalnachricht_anruf_*: neu.
--   * kanalnachricht_nicht_leer: live wortgleich mit Schema 59 → hier + anruf_art.
--     Schema 90 erweitert dieselbe Bedingung danach noch um ptt_sitzung.
--   * community_channel_messages.anruf_*: neu, live nicht vorhanden.
-- ===========================================================================
-- ===========================================================================
--  SUPABASE_SCHEMA_89_anrufe_ueberall.sql        (Feedback 28.09.2026, Kasten 5)
--  Ein Anruf steht beim Start im Chat — Person, Gruppe, Community, Unterthema
--  ENTWURF, 10.10.2026 — NICHT EINGESPIELT (Supabase gesperrt, 402)
-- ===========================================================================
--
--  WORUM ES GEHT
--
--  Henrik am 28.09.2026: „Wenn ich eine Person oder eine Gruppe oder eine
--  Community, egal was, anrufe (egal ob Video oder Sprachanruf), soll das im
--  Chat wie eine Nachricht angezeigt werden, dass ich einen Anruf gestartet
--  habe. Andersherum bei eingehenden Anrufen genauso."
--
--  BEFUND VOR DIESEM SCHEMA (live nachgesehen 10.10.2026, nur lesend)
--
--    - `messages.anruf_art/anruf_status/anruf_dauer` gibt es (Schema 35).
--      Zustaende nur 'beendet' | 'verpasst' | 'abgelehnt'.
--    - Geschrieben wurde der Eintrag erst beim AUFLEGEN, nur im Zweierchat,
--      und mit der Dauer einer SIMULIERTEN Verbindung (der Anrufbildschirm
--      „nahm" nach 2,6 s von selbst ab). Gruppe, Community-Chat (der landete
--      im Messenger-Chat derselben Person) und Unterthema: kein Eintrag.
--    - `community_channel_messages` (Unterthema) hat keine Anruf-Spalten.
--
--  WAS DIESE DATEI TUT
--
--  1. Neuer Zustand 'gestartet' auf `messages`: so wird ein Anruf beim Start
--     vermerkt, mit Dauer 0. Solange es keine Uebertragung gibt (Kasten 5.1),
--     erfindet niemand ein „angenommen, 3 Min.". Die Bedingung erzwingt
--     Dauer 0 bei 'gestartet'.
--  2. Dieselben drei Spalten und Bedingungen auf `community_channel_messages`
--     — damit das Unterthema einen Anruf genauso tragen kann.
--  3. `kanalnachricht_nicht_leer` (zuletzt Schema 59) laesst eine Zeile mit
--     gesetztem `anruf_art` zu. Wortgleich mit 59, plus diese eine Zeile.
--
--  WAS SIE NICHT TUT
--
--    - Keine neue Regel. Wer einen Anruf vermerken darf, entscheiden die
--      bestehenden Regeln „Nachricht senden" (Schema 21: Mitglied, darf
--      schreiben, Anfrage-Regel) und „Im Kanal schreiben" (Schema 5) — ein
--      Anrufeintrag ist eine gewoehnliche Zeile. Die Gegenseite liest ihn
--      mit derselben Leseregel wie jede Nachricht: deshalb steht er bei
--      beiden gleich (5.4).
--    - Keine neue Funktion, also auch keine EXECUTE-Rechte.
--    - Testbestand: `zuruecksetzen()` loescht Nachrichten und
--      Kanalnachrichten des Pruefkontos schon (live geprueft 10.10.2026,
--      ptt/kanal/notifications kommen darin vor) — nichts zu tun.
--
--  ERSETZT
--
--    - Bedingung `messages_anruf_status_check`  (aus Schema 35)
--    - Bedingung `kanalnachricht_nicht_leer`     (zuletzt Schema 59)
--  Wer 35 oder 59 neu einspielt, muss 89 (und danach 90) nachziehen.
--
--  ACHTUNG Reihenfolge: Schema 90 (Push to Talk) setzt diese Datei voraus.
--
--  Gegenstuecke im Code: app/lib/aktionen.ts (anrufStarten),
--  web/server/sync-handlers.js (handleAnrufStarten), Anzeige in
--  gemeinsam/anruf.js. Pruefung: npm run test:k28-anruf-ptt.
--
--  Einspielen (erst nach der Sperre, durch den Hauptagenten):
--    SUPABASE_TOKEN=... node tools/sql-einspielen.mjs \
--      ../SUPABASE_SCHEMA_89_anrufe_ueberall.sql
--  Idempotent: `if not exists`, `drop constraint if exists`.
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  1. messages: Zustand 'gestartet'
-- ---------------------------------------------------------------------------

alter table public.messages drop constraint if exists messages_anruf_status_check;
alter table public.messages
  add constraint messages_anruf_status_check
  check (anruf_status is null or anruf_status in ('gestartet', 'beendet', 'verpasst', 'abgelehnt'));

-- Ein nur gestarteter Anruf hat keine Dauer — sonst liesse sich doch wieder
-- ein Gespraech behaupten, das es nicht gab.
alter table public.messages drop constraint if exists messages_anruf_gestartet_ohne_dauer;
alter table public.messages
  add constraint messages_anruf_gestartet_ohne_dauer
  check (anruf_status is distinct from 'gestartet' or coalesce(anruf_dauer, 0) = 0);


-- ---------------------------------------------------------------------------
--  2. community_channel_messages: dieselben Spalten
-- ---------------------------------------------------------------------------

alter table public.community_channel_messages
  add column if not exists anruf_art    text,
  add column if not exists anruf_status text,
  add column if not exists anruf_dauer  integer;

alter table public.community_channel_messages drop constraint if exists kanalnachricht_anruf_art_check;
alter table public.community_channel_messages
  add constraint kanalnachricht_anruf_art_check
  check (anruf_art is null or anruf_art in ('audio', 'video'));

alter table public.community_channel_messages drop constraint if exists kanalnachricht_anruf_status_check;
alter table public.community_channel_messages
  add constraint kanalnachricht_anruf_status_check
  check (anruf_status is null or anruf_status in ('gestartet', 'beendet', 'verpasst', 'abgelehnt'));

alter table public.community_channel_messages drop constraint if exists kanalnachricht_anruf_gestartet_ohne_dauer;
alter table public.community_channel_messages
  add constraint kanalnachricht_anruf_gestartet_ohne_dauer
  check (anruf_status is distinct from 'gestartet' or coalesce(anruf_dauer, 0) = 0);

comment on column public.community_channel_messages.anruf_art is
  'Gesetzt heisst: diese Zeile ist der Eintrag zu einem Anruf in diesem Unterthema (Schema 89).';


-- ---------------------------------------------------------------------------
--  3. Nicht leer — wortgleich mit Schema 59, plus der Anrufeintrag
-- ---------------------------------------------------------------------------

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
  );


-- ---------------------------------------------------------------------------
--  Nachweis (liest nur)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'community_channel_messages'
                    and column_name = 'anruf_art') then
    raise exception 'Schema 89: community_channel_messages.anruf_art fehlt';
  end if;
end $$;
