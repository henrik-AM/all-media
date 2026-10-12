-- ============================================================================
-- SUPABASE_SCHEMA_94_kontaktbild.sql
-- (Nummer 94 reserviert vom Hauptagenten für Kasten 7.8.
-- Entwurf — eingespielt wird erst nach der Supabase-Sperre.)
--
-- Henrik, 11.10.2026: „Standardmäßig das Profilbild, jeder Nutzer soll aber
-- auch individuell für jeden seiner Kontakte das Profilbild ändern können, wie
-- bei der Apple Telefon/Nachrichten-App (nur beim Messenger)."
--
-- WAS DIESE DATEI TUT
--
-- 1. Tabelle `kontakt_bilder(owner_id, kontakt_id, media_url, …)`:
--    das Bild, das ICH für einen meiner Messenger-Kontakte festlege.
--    `media_url` statt `media_path`: dieselbe beständige Form wie
--    `profiles.avatar_url` (…/object/public/media/avatars/…), damit beim
--    Medienserver-Umzug genau dieselbe Umschreibung greift wie für alle
--    anderen Medienspalten und beide Seiten sie mit den vorhandenen Stellen
--    unterschreiben (app/lib/medien.ts, web/server/medien.js). Die Prüfung
--    erlaubt nur Adressen aus dem eigenen Eimer (kein Tracking-Pixel).
-- 2. RLS: lesen, anlegen, ändern, löschen NUR der Eigentümer. Die andere
--    Person sieht die Zeile nie — sie „merkt nichts".
--    Anlegen/Ändern zusätzlich nur für einen Messenger-Kontakt
--    (`ist_messenger_kontakt`: Eintrag in contacts ODER gemeinsamer
--    Messenger-Zweierchat), nie für sich selbst. Eine Regel je Befehl
--    (keine zweite permissive Regel, die die erste aufheben würde).
-- 3. nur_freigegebene (Schema 52/74) als einschränkende Regel.
-- 4. zuruecksetzen(): leert kontakt_bilder des Testkontos — am Anker aus
--    Schema 87 umgeschrieben (wie 85/87/88), keine neue Vollfassung.
--
-- HINWEIS ZUR DATEI SELBST: Der Eimer `media` ist für jedes angemeldete
-- Konto lesbar („Medien lesen", Schema 24). Geschützt ist, WER welches Bild
-- für WEN gesetzt hat (diese Tabelle); die Datei selbst liegt unter einem
-- unratbaren Pfad (Zufallsteil in ladeHoch/hochladen). Das ist dieselbe
-- Schutzstufe wie bei Anhängen im Chat.
--
-- Neu: ist_messenger_kontakt(uuid) — EXECUTE nur authenticated.
-- Ersetzt keine bestehende Funktion als Ganzes (zuruecksetzen nur am Anker).
--
-- Code vor dem Schema: App (daten.ts) und Server (supabase-api.js) laden die
-- Tabelle nachsichtig (fehlt sie → kein eigenes Bild, Profilbild wie bisher);
-- Speichern meldet „… erst, wenn das Datenbank-Update eingespielt ist".
--
-- Alles idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabelle
-- ---------------------------------------------------------------------------

create table if not exists public.kontakt_bilder (
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  kontakt_id uuid not null references public.profiles (id) on delete cascade,
  media_url  text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, kontakt_id),
  constraint kontakt_bilder_nicht_selbst check (owner_id <> kontakt_id),
  constraint kontakt_bilder_eimer check (
    media_url ~ '/storage/v1/object/public/media/avatars/[A-Za-z0-9._-]+$'
  )
);

comment on table public.kontakt_bilder is
  'Eigenes Kontaktbild (Kasten 7.8, Schema 94): nur der Eigentümer sieht es, nur im Messenger.';

alter table public.kontakt_bilder enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Wer ist mein Messenger-Kontakt?
-- ---------------------------------------------------------------------------

create or replace function public.ist_messenger_kontakt(k uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select k is not null and k <> auth.uid() and (
    exists (select 1 from public.contacts c
             where c.user_id = auth.uid() and c.contact_id = k and c.status <> 'blocked')
    or exists (
      select 1
        from public.chats ch
        join public.chat_members a on a.chat_id = ch.id and a.user_id = auth.uid()
        join public.chat_members b on b.chat_id = ch.id and b.user_id = k
       where coalesce(ch.bereich, 'messenger') = 'messenger'
         and not coalesce(ch.is_group, false)
    )
  );
$$;

revoke execute on function public.ist_messenger_kontakt(uuid) from public, anon;
grant execute on function public.ist_messenger_kontakt(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Regeln — eine je Befehl, alle an owner_id = auth.uid()
-- ---------------------------------------------------------------------------

drop policy if exists "Kontaktbild lesen" on public.kontakt_bilder;
create policy "Kontaktbild lesen" on public.kontakt_bilder
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "Kontaktbild anlegen" on public.kontakt_bilder;
create policy "Kontaktbild anlegen" on public.kontakt_bilder
  for insert to authenticated
  with check (owner_id = auth.uid() and public.ist_messenger_kontakt(kontakt_id));

drop policy if exists "Kontaktbild aendern" on public.kontakt_bilder;
create policy "Kontaktbild aendern" on public.kontakt_bilder
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and public.ist_messenger_kontakt(kontakt_id));

drop policy if exists "Kontaktbild loeschen" on public.kontakt_bilder;
create policy "Kontaktbild loeschen" on public.kontakt_bilder
  for delete to authenticated
  using (owner_id = auth.uid());

-- Minderjährigen-Freigabe (Schema 52 Teil 4, Schema 74): einschränkend.
drop policy if exists nur_freigegebene on public.kontakt_bilder;
create policy nur_freigegebene on public.kontakt_bilder
  as restrictive for all to authenticated
  using ((select public.konto_freigegeben()))
  with check ((select public.konto_freigegeben()));

revoke all on public.kontakt_bilder from anon;
grant select, insert, update, delete on public.kontakt_bilder to authenticated;

-- updated_at mitführen
create or replace function public.kontakt_bild_zeit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.kontakt_bild_zeit() from public, anon, authenticated;

drop trigger if exists kontakt_bild_zeit on public.kontakt_bilder;
create trigger kontakt_bild_zeit
  before update on public.kontakt_bilder
  for each row execute function public.kontakt_bild_zeit();

-- ---------------------------------------------------------------------------
-- 4. zuruecksetzen(): eigene Kontaktbilder des Testkontos leeren
-- ---------------------------------------------------------------------------
-- Am Anker aus Schema 87. zuruecksetzen() wirkt seit Schema 62 nur für
-- ist_testkonto() — echte Konten bleiben unberührt.

do $$
declare
  quelle text;
  anker  constant text := '  delete from public.telefonbuch where user_id = ziel;  -- Schema 87';
begin
  select pg_get_functiondef('public.zuruecksetzen'::regproc) into quelle;
  if quelle like '%public.kontakt_bilder%' then
    raise notice 'zuruecksetzen() leert kontakt_bilder schon.';
    return;
  end if;
  if position(anker in quelle) = 0 then
    raise exception 'Anker in zuruecksetzen() nicht gefunden — bitte von Hand anpassen.';
  end if;
  quelle := replace(quelle, anker, anker || chr(10) ||
    '  delete from public.kontakt_bilder where owner_id = ziel;  -- Schema 94');
  execute quelle;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Nachweis
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.kontakt_bilder') is null then
    raise exception 'Tabelle kontakt_bilder fehlt';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.kontakt_bilder'::regclass) then
    raise exception 'RLS auf kontakt_bilder ist aus';
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'kontakt_bilder'
                    and policyname = 'nur_freigegebene' and permissive = 'RESTRICTIVE') then
    raise exception 'nur_freigegebene fehlt auf kontakt_bilder';
  end if;
  if (select count(*) from pg_policies
       where schemaname = 'public' and tablename = 'kontakt_bilder' and permissive = 'PERMISSIVE') <> 4 then
    raise exception 'kontakt_bilder: erwartet genau vier permissive Regeln (eine je Befehl)';
  end if;
  if has_function_privilege('anon', 'public.ist_messenger_kontakt(uuid)', 'EXECUTE') then
    raise exception 'ist_messenger_kontakt() ist für anon ausführbar';
  end if;
  if pg_get_functiondef('public.zuruecksetzen'::regproc) not like '%public.kontakt_bilder%' then
    raise exception 'zuruecksetzen() leert kontakt_bilder nicht';
  end if;
end;
$$;
