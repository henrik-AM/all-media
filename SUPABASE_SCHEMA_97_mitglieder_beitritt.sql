-- ===========================================================================
--  SUPABASE_SCHEMA_97_mitglieder_beitritt.sql — Mitgliederliste und
--  Beitrittsanfragen (Feedback 28.09.2026, Kästen 9 und 15.1–15.3)
--  20.10.2026
-- ===========================================================================
--
--  WORUM ES GEHT
--
--  Henrik am 28.09.2026:
--
--    „Bei öffentlichen Communities soll man, wenn man auf der Homeseite der
--    Community auf den Namen drückt, auch die jeweiligen Personen sehen
--    können, die beigetreten sind, bei privaten Communities darf man das
--    nicht sehen, da darf man nur die Anzahl sehen. (ausgeschlossen von dem
--    Ersteller der Community, der darf das immer sehen)."
--
--    „Bei privaten Communitys kann ich einfach auf Beitreten drücken, der
--    Community direkt beigetreten, obwohl sie privat ist. Achte darauf, dass
--    dort der Administrator erst mal meine Anfrage genehmigen muss."
--
--  WAS LIVE GILT (gemessen 20.10.2026, nur lesend)
--
--    - „Communitys lesen": öffentlich ODER Ersteller ODER Mitglied. Eine
--      private Community ist für alle anderen unsichtbar — man findet sie
--      nicht und kann also auch nicht anfragen.
--    - „Community beitreten" (Schema 95): nur öffentlich oder Ersteller. Der
--      Direktbeitritt ist damit in der Datenbank schon zu, aber es gibt
--      keinen Weg hinein außer über den Ersteller.
--    - „Mitglieder sichtbarer Communitys lesen" (Schema 95): in einer
--      privaten Community sieht JEDES Mitglied die ganze Liste.
--    - Die Mitgliederzahl kam aus `community_members(count)` — also aus
--      genau der Liste, die jetzt nicht mehr jeder lesen darf.
--
--  WAS JETZT GILT
--
--    1. Mitgliederzahl als Spalte `communities.mitglieder_anzahl`, gezählt
--       von einem Auslöser. Die Zahl sieht jeder, der die Community sieht —
--       auch dann, wenn die Liste dahinter verborgen ist.
--    2. Private Communitys sind auffindbar (Name, Thema, Biografie, Zahl),
--       wie ein privates Profil bei Instagram. Unterthemen und Nachrichten
--       bleiben Mitgliedern vorbehalten (community_sichtbar, unverändert).
--    3. Die Mitgliederliste liest: wer selbst Mitglied ist (nur die eigene
--       Zeile), bei öffentlichen Communitys jeder, bei privaten nur der
--       Ersteller.
--    4. Neue Tabelle `community_beitrittsanfragen`: anfragen nur bei
--       privaten Communitys, sehen nur Fragender und Ersteller, zurückziehen
--       bzw. ablehnen per DELETE, annehmen nur über
--       `beitrittsanfrage_annehmen()` (prüft, dass der Aufrufer der
--       Ersteller ist).
--    5. Mitteilungen: Anfrage → Ersteller („möchte beitreten"), Annahme →
--       Fragender („hat deine Anfrage angenommen"). Zurückgezogen →
--       Mitteilung weg (wie Schema 61).
--
--  ERSETZT
--
--    - Regel „Communitys lesen" auf public.communities (zuletzt 7/EINSPIELEN)
--    - Regel „Mitglieder sichtbarer Communitys lesen" auf
--      public.community_members (zuletzt 95) → heißt jetzt „Mitglieder lesen"
--    - Bedingung notifications_art_check (zuletzt 90) — die Liste aus 90
--      plus 'beitritt_anfrage', 'beitritt_ok'. 97 also NACH 90 einspielen.
--      Wer 90 neu einspielt, muss 97 nachziehen.
--
--  Code vor dem Schema: App (daten.ts) und Server (supabase-api.js) lesen
--  `mitglieder_anzahl` nachsichtig (fehlt sie → alte Zählung) und die
--  Anfragen nachsichtig (fehlt die Tabelle → keine). Anfragen und Annehmen
--  melden ohne Schema „… erst, wenn das Datenbank-Update eingespielt ist".
--
--  EINSPIELEN (nach 88 → … → 96, siehe SUPABASE_REIHENFOLGE.md)
--
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      ../SUPABASE_SCHEMA_97_mitglieder_beitritt.sql
--
--  Danach: npm run test:rechte, test:schema, test:minderjaehrig,
--  test:angriffe, test:k28-mitglieder. Mehrfach einspielbar.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Mitgliederzahl als Spalte
-- ---------------------------------------------------------------------------

alter table public.communities
  add column if not exists mitglieder_anzahl integer not null default 0;

comment on column public.communities.mitglieder_anzahl is
  'Echte Mitglieder, gezählt von mitglieder_zaehlen (Schema 97). Angezeigt wird mitglieder_basis + mitglieder_anzahl.';

-- Einmal nachzählen. Danach hält der Auslöser die Zahl.
update public.communities c
   set mitglieder_anzahl = coalesce(
         (select count(*) from public.community_members m where m.community_id = c.id), 0)
 where c.mitglieder_anzahl is distinct from coalesce(
         (select count(*) from public.community_members m where m.community_id = c.id), 0);

create or replace function public.mitglieder_zaehlen()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.communities set mitglieder_anzahl = mitglieder_anzahl + 1
     where id = new.community_id;
    return new;
  end if;
  -- Beim Löschen einer Community ist die Zeile schon weg; dann trifft das
  -- UPDATE nichts, und das ist richtig.
  update public.communities set mitglieder_anzahl = greatest(mitglieder_anzahl - 1, 0)
   where id = old.community_id;
  return old;
end $$;

drop trigger if exists mitglieder_zaehlen on public.community_members;
create trigger mitglieder_zaehlen
  after insert or delete on public.community_members
  for each row execute function public.mitglieder_zaehlen();

/*
 * Beim Anlegen setzt nur die Datenbank Zahl, Grundwert und Demo-Merker.
 * `communities` hat keine UPDATE-Regel, aber das INSERT nahm bisher jeden
 * Wert an: eine neue Community mit „mitglieder_basis = 50000" ging durch.
 * Der Testbestand legt über security-definer-Funktionen an (current_user
 * ist dann nicht authenticated) und bleibt unberührt.
 */
create or replace function public.community_vorgaben()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  new.mitglieder_anzahl := 0;
  new.mitglieder_basis := 0;
  new.demo := false;
  new.created_at := now();
  return new;
end $$;

drop trigger if exists community_vorgaben on public.communities;
create trigger community_vorgaben
  before insert on public.communities
  for each row execute function public.community_vorgaben();


-- ---------------------------------------------------------------------------
-- 2. Private Communitys sind auffindbar
-- ---------------------------------------------------------------------------
--
-- Gelesen wird nur die Hülle (Name, Thema, Biografie, Link, Zahl). Was
-- drinsteht, schützt weiter community_sichtbar(): Unterthemen und
-- Nachrichten nur bei öffentlich oder Mitglied.

drop policy if exists "Communitys lesen" on public.communities;
create policy "Communitys lesen" on public.communities
  for select to authenticated
  using (true);


-- ---------------------------------------------------------------------------
-- 3. Wer die Mitgliederliste sieht
-- ---------------------------------------------------------------------------

create or replace function public.mitglieder_sichtbar(ziel uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.communities c
     where c.id = ziel
       and (c.visibility = 'public' or c.created_by = auth.uid())
  );
$$;

revoke execute on function public.mitglieder_sichtbar(uuid) from public, anon;
grant execute on function public.mitglieder_sichtbar(uuid) to authenticated;

drop policy if exists "Mitglieder sichtbarer Communitys lesen" on public.community_members;
drop policy if exists "Mitglieder lesen" on public.community_members;
create policy "Mitglieder lesen" on public.community_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.mitglieder_sichtbar(community_id));


-- ---------------------------------------------------------------------------
-- 4. Beitrittsanfragen
-- ---------------------------------------------------------------------------

create table if not exists public.community_beitrittsanfragen (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (community_id, user_id)
);

comment on table public.community_beitrittsanfragen is
  'Anfrage, einer privaten Community beizutreten (Kasten 15, Schema 97). Sehen: Fragender und Ersteller.';

alter table public.community_beitrittsanfragen enable row level security;

drop policy if exists "Beitrittsanfrage lesen" on public.community_beitrittsanfragen;
create policy "Beitrittsanfrage lesen" on public.community_beitrittsanfragen
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.communities c
                where c.id = community_id and c.created_by = (select auth.uid()))
  );

/*
 * Anfragen darf nur, wer selbst fragt, bei einer PRIVATEN Community, die er
 * nicht selbst angelegt hat, in der er noch nicht Mitglied ist und deren
 * Ersteller ihn nicht blockiert hat (oder umgekehrt).
 */
drop policy if exists "Beitrittsanfrage stellen" on public.community_beitrittsanfragen;
create policy "Beitrittsanfrage stellen" on public.community_beitrittsanfragen
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.communities c
       where c.id = community_id
         and c.visibility = 'private'
         and c.created_by is distinct from (select auth.uid())
         and not public.blockiert_zwischen((select auth.uid()), c.created_by)
    )
    and not public.is_community_member(community_id)
  );

-- Zurückziehen (Fragender) oder Ablehnen (Ersteller).
drop policy if exists "Beitrittsanfrage entfernen" on public.community_beitrittsanfragen;
create policy "Beitrittsanfrage entfernen" on public.community_beitrittsanfragen
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.communities c
                where c.id = community_id and c.created_by = (select auth.uid()))
  );

-- Minderjährigen-Freigabe (Schema 52 Teil 4, Schema 74): einschränkend.
drop policy if exists nur_freigegebene on public.community_beitrittsanfragen;
create policy nur_freigegebene on public.community_beitrittsanfragen
  as restrictive for all to authenticated
  using ((select public.konto_freigegeben()))
  with check ((select public.konto_freigegeben()));

revoke all on public.community_beitrittsanfragen from anon;
grant select, insert, delete on public.community_beitrittsanfragen to authenticated;

/*
 * Annehmen. Nur der Ersteller, nur eine Anfrage, die es gibt. Die
 * Mitgliedschaft legt die Funktion selbst an — die Regel „Community
 * beitreten" (Schema 95) lässt bei privaten Communitys niemanden außer dem
 * Ersteller hinein, und so soll es auch bleiben.
 */
create or replace function public.beitrittsanfrage_annehmen(p_community uuid, p_user uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare v_ersteller uuid;
begin
  select created_by into v_ersteller from public.communities where id = p_community;
  if v_ersteller is null or v_ersteller is distinct from auth.uid() then
    raise exception 'Nur wer die Community angelegt hat, kann Anfragen annehmen'
      using errcode = '42501';
  end if;
  if not public.konto_freigegeben() then
    raise exception 'Dein Konto ist noch nicht freigegeben' using errcode = '42501';
  end if;

  delete from public.community_beitrittsanfragen
   where community_id = p_community and user_id = p_user;
  if not found then
    -- P0001 (Vorgabe): der Satz darf bis zum Browser durch (fuerMenschen).
    raise exception 'Diese Anfrage gibt es nicht mehr';
  end if;

  insert into public.community_members (community_id, user_id)
  values (p_community, p_user)
  on conflict do nothing;

  perform public.mitteilung_anlegen(
    p_user, v_ersteller, 'beitritt_ok', 'communities', 'community', p_community
  );
  return true;
end $$;

revoke execute on function public.beitrittsanfrage_annehmen(uuid, uuid) from public, anon;
grant execute on function public.beitrittsanfrage_annehmen(uuid, uuid) to authenticated;

-- Wer Mitglied wird (auf welchem Weg auch immer), hat keine offene Anfrage mehr.
create or replace function public.beitrittsanfrage_aufraeumen()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.community_beitrittsanfragen
   where community_id = new.community_id and user_id = new.user_id;
  return new;
end $$;

drop trigger if exists beitrittsanfrage_aufraeumen on public.community_members;
create trigger beitrittsanfrage_aufraeumen
  after insert on public.community_members
  for each row execute function public.beitrittsanfrage_aufraeumen();


-- ---------------------------------------------------------------------------
-- 5. Mitteilungen
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_art_check;
alter table public.notifications add constraint notifications_art_check
  check (art in ('like', 'comment', 'follow', 'mention', 'share', 'message', 'system',
                 'repost', 'story', 'kanal', 'beitritt', 'nachricht', 'einladung',
                 'anfrage', 'anfrage_ok', 'messenger_anfrage', 'messenger_ok',
                 'ptt', 'beitritt_anfrage', 'beitritt_ok'));

create or replace function public.mitteilung_bei_beitrittsanfrage()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare v_ersteller uuid;
begin
  select created_by into v_ersteller from public.communities where id = new.community_id;
  perform public.mitteilung_anlegen(
    v_ersteller, new.user_id, 'beitritt_anfrage', 'communities', 'community', new.community_id
  );
  return new;
end $$;

drop trigger if exists mitteilung_beitrittsanfrage on public.community_beitrittsanfragen;
create trigger mitteilung_beitrittsanfrage
  after insert on public.community_beitrittsanfragen
  for each row execute function public.mitteilung_bei_beitrittsanfrage();

-- Zurückgezogen, abgelehnt oder angenommen: die Frage beim Ersteller ist erledigt.
create or replace function public.mitteilung_weg_bei_beitrittsanfrage()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.notifications
   where actor_id = old.user_id
     and art = 'beitritt_anfrage'
     and target_type = 'community'
     and target_id = old.community_id;
  return old;
end $$;

drop trigger if exists mitteilung_weg_beitrittsanfrage on public.community_beitrittsanfragen;
create trigger mitteilung_weg_beitrittsanfrage
  after delete on public.community_beitrittsanfragen
  for each row execute function public.mitteilung_weg_bei_beitrittsanfrage();

-- Auslöserfunktionen: EXECUTE ginge sonst an PUBLIC (Schema 74). Wie in
-- Schema 95 (chat_spalten_schuetzen): weg von public/anon, an authenticated.
revoke execute on function public.mitglieder_zaehlen() from public, anon;
revoke execute on function public.beitrittsanfrage_aufraeumen() from public, anon;
revoke execute on function public.mitteilung_bei_beitrittsanfrage() from public, anon;
revoke execute on function public.mitteilung_weg_bei_beitrittsanfrage() from public, anon;
revoke execute on function public.community_vorgaben() from public, anon;
grant execute on function public.mitglieder_zaehlen() to authenticated;
grant execute on function public.beitrittsanfrage_aufraeumen() to authenticated;
grant execute on function public.mitteilung_bei_beitrittsanfrage() to authenticated;
grant execute on function public.mitteilung_weg_bei_beitrittsanfrage() to authenticated;
grant execute on function public.community_vorgaben() to authenticated;


-- ---------------------------------------------------------------------------
-- 6. Selbstprüfung
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'community_beitrittsanfragen'
                    and policyname = 'nur_freigegebene' and permissive = 'RESTRICTIVE') then
    raise exception 'nur_freigegebene fehlt auf community_beitrittsanfragen';
  end if;
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'community_members'
                and policyname = 'Mitglieder sichtbarer Communitys lesen') then
    raise exception 'alte Leseregel auf community_members steht noch';
  end if;
  if has_function_privilege('anon', 'public.beitrittsanfrage_annehmen(uuid, uuid)', 'execute') then
    raise exception 'beitrittsanfrage_annehmen ist für anon ausführbar';
  end if;
  if has_function_privilege('anon', 'public.mitglieder_sichtbar(uuid)', 'execute') then
    raise exception 'mitglieder_sichtbar ist für anon ausführbar';
  end if;
end $$;
