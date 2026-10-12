-- ============================================================================
--  SUPABASE_SCHEMA_92_kommentar_antworten.sql
--  (Nummer 92 vom Hauptagenten reserviert. ENTWURF — eingespielt wird erst
--  nach der Supabase-Sperre, nach 89 → 90 → 91.)
--
--  Feedback 28.09.2026, Nachtrag 11.10. zu Kasten 4.3 (Henrik): „Damit
--  meinte ich Community Chats in jeglicher Art und Weise + Kommentare etc.
--  bei Videos."
--
--  WAS FEHLTE
--
--  `comments` kannte keinen Bezug: auf einen Kommentar ließ sich nur mit einem
--  neuen Kommentar ganz unten „antworten", ohne Faden und ohne dass die
--  angesprochene Person davon erfuhr. Dasselbe in der Live-Spalte
--  (`stream_comments`).
--
--  MODELL (eine Ebene, wie Instagram/TikTok)
--
--    comments.reply_to   → die WURZEL (ein Kommentar oben, reply_to is null).
--                          Antwort auf eine Antwort hängt am selben Kommentar.
--                          ON DELETE CASCADE: verschwindet der Kommentar oben,
--                          verschwinden seine Antworten mit. Mit SET NULL
--                          stünden Antworten wie „@anna genau!" plötzlich als
--                          eigene Kommentare oben, ohne Anlass — das ist
--                          schlechter als weg. Instagram und TikTok machen es
--                          genauso. (Die Mitteilungen dazu fallen über den
--                          Löschauslöser mit, denn Kaskaden feuern Auslöser.)
--    comments.antwort_an → der Kommentar, an den sich die Antwort richtet
--                          (die Wurzel selbst oder eine Antwort darunter).
--                          Dessen Verfasser bekommt die Mitteilung.
--                          ON DELETE SET NULL: löscht die angesprochene
--                          Person ihre Antwort, bleibt die Antwort darauf im
--                          Faden stehen (sie hängt ja an der Wurzel).
--    stream_comments.reply_to → der Live-Kommentar, auf den geantwortet wird
--                          (Zitat wie im Chat, keine Fäden). ON DELETE SET
--                          NULL: die Antwort bleibt, das Zitat sagt dann
--                          „Kommentar nicht mehr verfügbar".
--
--  Zitattext liegt NIE in der Datenbank — nur Kennungen. Text wird beim Laden
--  aus dem Original gelesen und unterliegt dessen Leseregel.
--
--  REGELN
--
--  1. Restriktive INSERT-Regel „Antwort nur im selben Beitrag" auf comments
--     (UND-verknüpft mit „Kommentar schreiben" aus Schema 19 — eine zweite
--     PERMISSIVE Regel würde verodert und höbe darf_kommentieren() auf):
--       - reply_to zeigt auf einen Kommentar OBEN desselben Beitrags,
--       - antwort_an ist die Wurzel oder eine Antwort desselben Fadens,
--       - antwort_an ohne reply_to gibt es nicht,
--       - keine Blockierung zwischen Schreibendem und angesprochener Person
--         (in keiner Richtung). „Wer darf kommentieren" (Schema 19) gilt
--         unverändert, denn eine Antwort IST ein Kommentar am Beitrag.
--     Die Prüfung steht in einer security-definer-Funktion: `blocks` ist nur
--     für den eigenen Eintrag lesbar (Schema 2), eine Unterabfrage in der
--     Regel sähe fremde Sperren nicht — und würde damit erlauben (wie
--     darf_kommentieren in Schema 19 begründet).
--  2. Auslöser `kommentar_bezug_fest`: reply_to und antwort_an lassen sich
--     nach dem Anlegen nicht mehr ändern (die UPDATE-Regel „Eigenen Kommentar
--     aendern" aus Schema 19 erlaubt sonst jede Spalte).
--  3. Restriktive INSERT-Regel „Live-Antwort nur im selben Stream" auf
--     stream_comments (gleicher Beitrag, keine Blockierung).
--  4. Mitteilung „… hat auf deinen Kommentar geantwortet" (Auslöser wie
--     Schema 44/49): art 'comment', target_type 'comment', Ziel = die Antwort.
--     Beide Werte stehen schon in den Listen aus Schema 90 (Gewinner für
--     notifications_art_check / notifications_target_type_check) — diese
--     Datei fasst die Bedingungen NICHT an, Gewinner bleibt 90. Die Sätze
--     „gefällt dein Kommentar" (like/comment) und „hat dich in einem
--     Kommentar erwähnt" (mention/comment) sind andere Arten; der Satz kommt
--     aus gemeinsam/kommentar.js (App: ProfilContext, Website: server/app.js).
--     Keine Mitteilung, wenn:
--       - an sich selbst (mitteilung_anlegen),
--       - Person stummgeschaltet (mitteilung_anlegen → mitteilung_stumm, 78),
--       - Blockierung in irgendeiner Richtung,
--       - Empfängerkonto nicht freigegeben (konto_stand <> 'frei', Schema 52),
--       - Testkonto → echtes Konto (ist_testkonto, Schema 62),
--       - Empfänger sieht den Beitrag nicht (markierung_sichtbar, Gewinner 86).
--     Minderjährige: keine Sonderregel (Henrik 09.10.2026, Schema 87); für
--     wartende Konten greift `nur_freigegebene` (Schema 52/74) auf comments
--     und stream_comments unverändert — es sind keine neuen Tabellen.
--     Doppelte Glocke vermieden: das vorbelegte „@name" erzeugt über Schema
--     86 eine Erwähnung an dieselbe Person. Der Auslöser hier (läuft nach
--     `markierung_text`, Auslöser feuern alphabetisch) nimmt diese eine
--     Erwähnung zurück und setzt die genauere Mitteilung. Und der
--     Beitragsinhaber bekommt nicht zusätzlich „hat deinen Beitrag
--     kommentiert", wenn die Antwort sich ohnehin an ihn richtet.
--  5. Zurücknehmen: Antwort gelöscht → ihre Mitteilung weg (eigener
--     Auslöser, Schema 61 bleibt unverändert).
--
--  ERSETZT
--
--    public.mitteilung_bei_kommentar()   zuletzt SUPABASE_SCHEMA_44_mitteilungen.sql
--      — wortgleich übernommen, plus: bei einer Antwort an den Beitrags-
--        inhaber keine zweite Mitteilung „hat deinen Beitrag kommentiert".
--
--  NEU (EXECUTE von PUBLIC/anon entzogen)
--
--    kommentar_antwort_erlaubt(uuid, uuid, uuid)  — an authenticated (die
--        Regel läuft mit den Rechten des Schreibenden)
--    live_antwort_erlaubt(uuid, uuid)             — an authenticated (ebenso)
--    kommentar_bezug_fest()                       — Auslöser, niemandem
--    mitteilung_bei_kommentar_antwort()           — Auslöser, niemandem
--    mitteilung_weg_bei_kommentar_antwort()       — Auslöser, niemandem
--
--  CODE VOR DEM SCHEMA
--
--    App (daten.ts, aktionen.ts) und Server (supabase-api.js,
--    sync-handlers.js) lesen reply_to/antwort_an nachsichtig: fehlen die
--    Spalten (42703/PGRST204, Kommentar.fehltSpalte), laden die Kommentare
--    ohne Fäden und Antworten gehen als gewöhnlicher Kommentar raus — das
--    Blatt sagt es (Kommentar.OHNE_FADEN / LIVE_OHNE_BEZUG).
--
--  EINSPIELEN (Hauptagent, nach der Sperre)
--    SUPABASE_TOKEN=... node tools/sql-einspielen.mjs \
--      SUPABASE_SCHEMA_92_kommentar_antworten.sql
--  Danach: npm run test:rechte, test:schema, test:minderjaehrig,
--          test:k28-kommentare.
--
--  Idempotent: mehrfach ausführbar.
-- ============================================================================

do $$
begin
  if to_regprocedure('public.markierung_sichtbar(text, uuid, uuid)') is null then
    raise exception 'Schema 92 setzt Schema 86 voraus (markierung_sichtbar fehlt)';
  end if;
  if to_regprocedure('public.ist_testkonto(uuid)') is null then
    raise exception 'Schema 92 setzt Schema 62 voraus (ist_testkonto fehlt)';
  end if;
  if to_regprocedure('public.mitteilung_stumm(uuid, uuid, text, uuid)') is null then
    raise exception 'Schema 92 setzt Schema 78 voraus (mitteilung_stumm fehlt)';
  end if;
end $$;


-- ---------------------------------------------------------------------------
--  Spalten
-- ---------------------------------------------------------------------------

alter table public.comments
  add column if not exists reply_to uuid
    references public.comments (id) on delete cascade;
alter table public.comments
  add column if not exists antwort_an uuid
    references public.comments (id) on delete set null;

create index if not exists comments_reply_to_idx
  on public.comments (reply_to) where reply_to is not null;
create index if not exists comments_antwort_an_idx
  on public.comments (antwort_an) where antwort_an is not null;

comment on column public.comments.reply_to is
  'Antwort: der Kommentar OBEN, an dem der Faden haengt (Nachtrag 4.3b). Eine Ebene.';
comment on column public.comments.antwort_an is
  'Antwort: der angesprochene Kommentar (Wurzel oder Antwort im selben Faden); bekommt die Mitteilung.';

alter table public.stream_comments
  add column if not exists reply_to uuid
    references public.stream_comments (id) on delete set null;

create index if not exists stream_comments_reply_to_idx
  on public.stream_comments (reply_to) where reply_to is not null;

comment on column public.stream_comments.reply_to is
  'Antwort in der Live-Spalte mit Zitat (Nachtrag 4.3c). Nur die Kennung, nie der Text.';


-- ---------------------------------------------------------------------------
--  1. Darf diese Antwort so angelegt werden?
-- ---------------------------------------------------------------------------

create or replace function public.kommentar_antwort_erlaubt(
  p_post       uuid,
  p_reply_to   uuid,
  p_antwort_an uuid
)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_ich    uuid := auth.uid();
  v_wurzel public.comments%rowtype;
  v_an     uuid;
begin
  -- Kein Bezug: gewöhnlicher Kommentar. antwort_an allein gibt es nicht.
  if p_reply_to is null then
    return p_antwort_an is null;
  end if;

  select * into v_wurzel from public.comments where id = p_reply_to;
  -- Im Zweifel nein (wie darf_kommentieren, Schema 19).
  if v_wurzel.id is null or v_wurzel.post_id is distinct from p_post or v_wurzel.reply_to is not null then
    return false;
  end if;

  if p_antwort_an is null or p_antwort_an = p_reply_to then
    v_an := v_wurzel.user_id;
  else
    select c.user_id into v_an
      from public.comments c
     where c.id = p_antwort_an
       and c.reply_to = p_reply_to
       and c.post_id = p_post;
    if v_an is null then
      return false;
    end if;
  end if;

  return not exists (
    select 1 from public.blocks b
     where (b.user_id = v_an and b.blocked_user_id = v_ich)
        or (b.user_id = v_ich and b.blocked_user_id = v_an));
end $$;

revoke execute on function public.kommentar_antwort_erlaubt(uuid, uuid, uuid) from public, anon;
grant execute on function public.kommentar_antwort_erlaubt(uuid, uuid, uuid) to authenticated;

drop policy if exists "Antwort nur im selben Beitrag" on public.comments;
create policy "Antwort nur im selben Beitrag" on public.comments
  as restrictive
  for insert to authenticated
  with check (public.kommentar_antwort_erlaubt(post_id, reply_to, antwort_an));


-- ---------------------------------------------------------------------------
--  2. Der Bezug bleibt, wie er angelegt wurde
-- ---------------------------------------------------------------------------

create or replace function public.kommentar_bezug_fest()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.reply_to is distinct from old.reply_to
     or (new.antwort_an is distinct from old.antwort_an and new.antwort_an is not null) then
    -- antwort_an darf nur durch ON DELETE SET NULL leer werden.
    raise exception 'Der Bezug einer Antwort laesst sich nicht aendern'
      using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function public.kommentar_bezug_fest() from public, anon, authenticated;

drop trigger if exists kommentar_bezug_fest on public.comments;
create trigger kommentar_bezug_fest
  before update of reply_to, antwort_an on public.comments
  for each row execute function public.kommentar_bezug_fest();


-- ---------------------------------------------------------------------------
--  3. Live-Spalte: Antwort nur im selben Stream
-- ---------------------------------------------------------------------------

create or replace function public.live_antwort_erlaubt(p_post uuid, p_reply_to uuid)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_ich uuid := auth.uid();
  v_an  uuid;
begin
  if p_reply_to is null then
    return true;
  end if;
  select s.user_id into v_an
    from public.stream_comments s
   where s.id = p_reply_to and s.post_id = p_post;
  if v_an is null then
    return false;
  end if;
  return not exists (
    select 1 from public.blocks b
     where (b.user_id = v_an and b.blocked_user_id = v_ich)
        or (b.user_id = v_ich and b.blocked_user_id = v_an));
end $$;

revoke execute on function public.live_antwort_erlaubt(uuid, uuid) from public, anon;
grant execute on function public.live_antwort_erlaubt(uuid, uuid) to authenticated;

drop policy if exists "Live-Antwort nur im selben Stream" on public.stream_comments;
create policy "Live-Antwort nur im selben Stream" on public.stream_comments
  as restrictive
  for insert to authenticated
  with check (public.live_antwort_erlaubt(post_id, reply_to));
-- Für stream_comments gibt es keine UPDATE-Regel — reply_to ist damit fest.


-- ---------------------------------------------------------------------------
--  4. Mitteilung „… hat auf deinen Kommentar geantwortet"
-- ---------------------------------------------------------------------------

/*
 * Wer wird angesprochen? antwort_an, sonst die Wurzel. Eine Stelle, damit
 * Mitteilung und „kein zweites kommentiert" dieselbe Person meinen.
 */
create or replace function public.kommentar_angesprochen(p_kommentar uuid)
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select a.user_id
    from public.comments k
    join public.comments a on a.id = coalesce(k.antwort_an, k.reply_to)
   where k.id = p_kommentar
     and k.reply_to is not null;
$$;

revoke all on function public.kommentar_angesprochen(uuid) from public, anon, authenticated;

create or replace function public.mitteilung_bei_kommentar_antwort()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_an uuid;
begin
  if new.reply_to is null then
    return new;
  end if;

  v_an := public.kommentar_angesprochen(new.id);
  if v_an is null or v_an = new.user_id then
    return new;
  end if;

  if exists (select 1 from public.blocks b
              where (b.user_id = v_an and b.blocked_user_id = new.user_id)
                 or (b.user_id = new.user_id and b.blocked_user_id = v_an)) then
    return new;
  end if;
  if public.konto_stand(v_an) <> 'frei' then
    return new;
  end if;
  if public.ist_testkonto(new.user_id) and not public.ist_testkonto(v_an) then
    return new;
  end if;
  if not public.markierung_sichtbar('comment', new.id, v_an) then
    return new;
  end if;

  -- Das vorbelegte „@name" hat über Schema 86 schon eine Erwähnung an
  -- dieselbe Person gelegt — die genauere Mitteilung ersetzt sie.
  delete from public.notifications
   where user_id = v_an and actor_id = new.user_id
     and art = 'mention' and target_type = 'comment' and target_id = new.id;

  -- mitteilung_anlegen (Gewinner 78): nicht an sich selbst, nicht stumm.
  perform public.mitteilung_anlegen(v_an, new.user_id, 'comment', 'videos', 'comment', new.id);
  return new;
end $$;

revoke all on function public.mitteilung_bei_kommentar_antwort() from public, anon, authenticated;

drop trigger if exists mitteilung_kommentar_antwort on public.comments;
create trigger mitteilung_kommentar_antwort
  after insert on public.comments
  for each row execute function public.mitteilung_bei_kommentar_antwort();


-- Ersetzt Schema 44 (wortgleich bis auf die Abfrage nach `v_an`).
create or replace function public.mitteilung_bei_kommentar()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_besitzer uuid;
begin
  select user_id into v_besitzer from public.posts where id = new.post_id;

  -- Schema 92: richtet sich die Antwort ohnehin an den Beitragsinhaber,
  -- bekommt er „hat auf deinen Kommentar geantwortet" — nicht zusätzlich
  -- „hat deinen Beitrag kommentiert".
  if new.reply_to is not null and public.kommentar_angesprochen(new.id) = v_besitzer then
    return new;
  end if;

  perform public.mitteilung_anlegen(
    v_besitzer, new.user_id, 'comment', 'videos', 'post', new.post_id
  );
  return new;
end $$;

revoke all on function public.mitteilung_bei_kommentar() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
--  5. Antwort gelöscht → ihre Mitteilung weg
-- ---------------------------------------------------------------------------

create or replace function public.mitteilung_weg_bei_kommentar_antwort()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.reply_to is null then
    return old;
  end if;
  delete from public.notifications
   where actor_id = old.user_id
     and art = 'comment'
     and target_type = 'comment'
     and target_id = old.id;
  return old;
end $$;

revoke all on function public.mitteilung_weg_bei_kommentar_antwort() from public, anon, authenticated;

drop trigger if exists mitteilung_weg_kommentar_antwort on public.comments;
create trigger mitteilung_weg_kommentar_antwort
  after delete on public.comments
  for each row execute function public.mitteilung_weg_bei_kommentar_antwort();


-- ---------------------------------------------------------------------------
--  Gegenprobe im selben Lauf (die Verwaltungs-API meldet sonst auch dann
--  Erfolg, wenn nichts gegriffen hat).
-- ---------------------------------------------------------------------------

do $$
declare
  fehlt text := '';
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'comments' and column_name = 'reply_to') then
    fehlt := fehlt || ' comments.reply_to';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'comments' and column_name = 'antwort_an') then
    fehlt := fehlt || ' comments.antwort_an';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'stream_comments' and column_name = 'reply_to') then
    fehlt := fehlt || ' stream_comments.reply_to';
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'comments'
                    and policyname = 'Antwort nur im selben Beitrag' and permissive = 'RESTRICTIVE') then
    fehlt := fehlt || ' Regel(comments)';
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'stream_comments'
                    and policyname = 'Live-Antwort nur im selben Stream' and permissive = 'RESTRICTIVE') then
    fehlt := fehlt || ' Regel(stream_comments)';
  end if;
  if has_function_privilege('anon', 'public.kommentar_antwort_erlaubt(uuid, uuid, uuid)', 'execute')
     or has_function_privilege('anon', 'public.live_antwort_erlaubt(uuid, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.mitteilung_bei_kommentar_antwort()', 'execute')
     or has_function_privilege('authenticated', 'public.kommentar_angesprochen(uuid)', 'execute') then
    fehlt := fehlt || ' Rechte(EXECUTE zu offen)';
  end if;
  if fehlt <> '' then
    raise exception 'Schema 92 unvollstaendig:%', fehlt;
  end if;
  raise notice 'Schema 92 in Ordnung: Spalten, Regeln, Ausloeser, Rechte.';
end $$;

-- PostgREST soll die neuen Spalten sofort kennen.
notify pgrst, 'reload schema';
