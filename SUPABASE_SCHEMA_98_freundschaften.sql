-- ===========================================================================
--  SUPABASE_SCHEMA_98_freundschaften.sql — Befreunden unter Communitys
--  (Feedback 28.09.2026, Kasten 15.4)
--  21.10.2026
-- ===========================================================================
--
--  WORUM ES GEHT
--
--  Henrik am 28.09.2026:
--
--    „Ich denke mal, dass der Button befreunden und angefragt und so nicht
--    synchronisiert ist, denn ich hab gerade eine Person eine
--    Freundschaftsanfrage gesendet, mit der ich schon geschrieben habe."
--
--  Und am 29.08.2026: „Öffentlich = ‚Befreunden', Privat =
--  ‚Freundschaftsanfrage senden'."
--
--  WAS BIS JETZT GALT (gefunden 20.10.2026)
--
--    - App: „+ Befreunden" schrieb nichts in die Datenbank, nur in die
--      Anzeige — nach dem Neustart weg.
--    - Website: schickte den Benutzernamen an /api/contacts, das seit 07.09.
--      nur Telefonnummern annimmt — scheiterte immer.
--    - Beide lasen den Stand aus den Messenger-Kontakten. Eine Freundschaft
--      unter Communitys gab es gar nicht.
--
--  WAS JETZT GILT (Henrik 21.10.2026: „ja" zum Vorschlag)
--
--    Eine eigene Freundschaft nur unter Communitys — ohne Telefonnummer,
--    ohne Messenger (der bleibt bei Schema 57: nur mit Zustimmung).
--
--    1. Tabelle `freundschaften (von, an, angenommen)`, je Paar höchstens
--       eine Zeile (Index auf das ungeordnete Paar).
--    2. Öffentliches Profil: die Freundschaft gilt sofort. Privates Profil:
--       sie ist eine Anfrage, bis die andere Person annimmt. Das entscheidet
--       der Auslöser `freundschaft_vorgaben` aus profiles.privat — nicht der
--       Knopf.
--    3. Annehmen nur über `freundschaft_annehmen(p_von)`, nur als Empfänger.
--       Zurückziehen, Ablehnen und Beenden sind ein DELETE, das beide
--       Seiten dürfen.
--    4. Anfragen nur an Profile, die ich sehen darf (Regel auf profiles,
--       also auch Minderjährigen-Freigabe), nicht bei Blockierung. Wer
--       blockiert, beendet eine bestehende Freundschaft.
--    5. Mitteilungen: Anfrage → Empfänger („möchte mit dir befreundet sein"),
--       Freundschaft steht → die andere Seite („Du und X seid jetzt
--       befreundet."). Zurückgezogen → Anfrage-Mitteilung weg.
--
--  ABGLEICH MIT MAIN UND LIVE (Paket 2, 05.11.2026, nur lesend gemessen)
--
--    - Live fehlt `freundschaften`; keine Datei auf main (101–117) legt sie
--      an oder ändert eines der Objekte hier. 103 (live) nimmt
--      `freundschaften` in meine_daten() schon auf, wenn es sie gibt (Spalte
--      `von`), und löscht über on delete cascade mit.
--    - Gebraucht und live vorhanden: blockiert_zwischen (95),
--      mitteilung_anlegen(p_an, p_von, p_art, p_bereich, p_zielart, p_ziel)
--      (78), profiles.privat, blocks (user_id, blocked_user_id),
--      target_type 'profile' in notifications_target_type_check.
--    - notifications_art_check: die Liste aus 97 (= live gültige Liste aus
--      57 + 'ptt' + 'beitritt_anfrage', 'beitritt_ok'), dazu 'freund_anfrage',
--      'freund_ok'. 'system' (102) steht drin.
--    - Die Tabelle hängt an keiner Community; F5/F11 aus 102 betreffen sie
--      nicht. nicht_gesperrt (102) gilt hier nicht — wie bei
--      community_members.
--
--  ERSETZT
--
--    - Bedingung notifications_art_check (zuletzt 97) — die Liste aus 97
--      plus 'freund_anfrage', 'freund_ok'. 98 also NACH 97 einspielen. Wer
--      90 oder 97 neu einspielt, muss 98 nachziehen.
--
--  Code vor dem Schema: App (aktionen.ts) und Server (supabase-api.js) lesen
--  die Tabelle nachsichtig (fehlt sie → niemand befreundet). Befreunden
--  meldet ohne Schema „… erst, wenn das Datenbank-Update eingespielt ist".
--
--  EINSPIELEN (nach 97, siehe SUPABASE_REIHENFOLGE.md)
--
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      ../SUPABASE_SCHEMA_98_freundschaften.sql
--
--  Danach: npm run test:rechte, test:schema, test:minderjaehrig,
--  test:angriffe, test:k28-mitglieder. Mehrfach einspielbar.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Tabelle
-- ---------------------------------------------------------------------------

create table if not exists public.freundschaften (
  von        uuid not null references public.profiles (id) on delete cascade,
  an         uuid not null references public.profiles (id) on delete cascade,
  angenommen boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (von, an),
  constraint freundschaften_nicht_selbst check (von <> an)
);

comment on table public.freundschaften is
  'Freundschaft unter Communitys (Kasten 15.4, Schema 98). angenommen = false heißt: Anfrage an ein privates Profil läuft.';

-- Je Paar eine Zeile: fragt B zurück, während A schon gefragt hat, nimmt B an.
create unique index if not exists freundschaften_paar
  on public.freundschaften (least(von, an), greatest(von, an));

create index if not exists freundschaften_an on public.freundschaften (an);

alter table public.freundschaften enable row level security;

drop policy if exists "Freundschaft lesen" on public.freundschaften;
create policy "Freundschaft lesen" on public.freundschaften
  for select to authenticated
  using ((select auth.uid()) in (von, an));

/*
 * Fragen darf nur, wer selbst fragt, an ein Profil, das er sehen darf (die
 * Unterabfrage läuft unter der Regel auf profiles — Minderjährige ohne
 * Freigabe bleiben unerreichbar), und nicht bei Blockierung in einer der
 * beiden Richtungen. `angenommen` setzt der Auslöser, nicht der Aufrufer.
 */
drop policy if exists "Freundschaft anfragen" on public.freundschaften;
create policy "Freundschaft anfragen" on public.freundschaften
  for insert to authenticated
  with check (
    von = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = an)
    and not public.blockiert_zwischen((select auth.uid()), an)
  );

-- Zurückziehen, Ablehnen, Beenden: beide Seiten.
drop policy if exists "Freundschaft entfernen" on public.freundschaften;
create policy "Freundschaft entfernen" on public.freundschaften
  for delete to authenticated
  using ((select auth.uid()) in (von, an));

-- Minderjährigen-Freigabe (Schema 52 Teil 4, Schema 74): einschränkend.
drop policy if exists nur_freigegebene on public.freundschaften;
create policy nur_freigegebene on public.freundschaften
  as restrictive for all to authenticated
  using ((select public.konto_freigegeben()))
  with check ((select public.konto_freigegeben()));

-- Kein UPDATE: angenommen wird nur über freundschaft_annehmen().
revoke all on public.freundschaften from anon;
revoke update on public.freundschaften from authenticated;
grant select, insert, delete on public.freundschaften to authenticated;


-- ---------------------------------------------------------------------------
-- 2. Öffentlich sofort, privat als Anfrage
-- ---------------------------------------------------------------------------
--
-- Security definer, weil der Auslöser profiles.privat des Gegenübers lesen
-- muss. Er gilt für jedes INSERT — der Testbestand setzt `angenommen`
-- danach selbst, wenn er eine fertige Freundschaft braucht.

create or replace function public.freundschaft_vorgaben()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.angenommen := not coalesce((select p.privat from public.profiles p where p.id = new.an), false);
  new.created_at := now();
  return new;
end $$;

drop trigger if exists freundschaft_vorgaben on public.freundschaften;
create trigger freundschaft_vorgaben
  before insert on public.freundschaften
  for each row execute function public.freundschaft_vorgaben();


-- ---------------------------------------------------------------------------
-- 3. Annehmen
-- ---------------------------------------------------------------------------

create or replace function public.freundschaft_annehmen(p_von uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Dafür musst du angemeldet sein' using errcode = '42501';
  end if;
  if not public.konto_freigegeben() then
    raise exception 'Dein Konto ist noch nicht freigegeben' using errcode = '42501';
  end if;
  if public.blockiert_zwischen(auth.uid(), p_von) then
    raise exception 'Diese Anfrage gibt es nicht mehr';
  end if;

  update public.freundschaften
     set angenommen = true
   where von = p_von and an = auth.uid() and not angenommen;
  if not found then
    -- P0001 (Vorgabe): der Satz darf bis zum Browser durch (fuerMenschen).
    raise exception 'Diese Anfrage gibt es nicht mehr';
  end if;
  return true;
end $$;

revoke execute on function public.freundschaft_annehmen(uuid) from public, anon;
grant execute on function public.freundschaft_annehmen(uuid) to authenticated;

-- Wer blockiert, ist nicht mehr befreundet und hat keine offene Anfrage mehr.
create or replace function public.freundschaft_bei_blockierung()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.freundschaften
   where (von = new.user_id and an = new.blocked_user_id)
      or (von = new.blocked_user_id and an = new.user_id);
  return new;
end $$;

drop trigger if exists freundschaft_bei_blockierung on public.blocks;
create trigger freundschaft_bei_blockierung
  after insert on public.blocks
  for each row execute function public.freundschaft_bei_blockierung();


-- ---------------------------------------------------------------------------
-- 4. Mitteilungen
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_art_check;
alter table public.notifications add constraint notifications_art_check
  check (art in ('like', 'comment', 'follow', 'mention', 'share', 'message', 'system',
                 'repost', 'story', 'kanal', 'beitritt', 'nachricht', 'einladung',
                 'anfrage', 'anfrage_ok', 'messenger_anfrage', 'messenger_ok',
                 'ptt', 'beitritt_anfrage', 'beitritt_ok', 'freund_anfrage', 'freund_ok'));

-- Neue Zeile: privat → Anfrage an den Empfänger, öffentlich → steht schon.
create or replace function public.mitteilung_bei_freundschaft()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.mitteilung_anlegen(
    new.an, new.von,
    case when new.angenommen then 'freund_ok' else 'freund_anfrage' end,
    'communities', 'profile', new.von
  );
  return new;
end $$;

drop trigger if exists mitteilung_freundschaft on public.freundschaften;
create trigger mitteilung_freundschaft
  after insert on public.freundschaften
  for each row execute function public.mitteilung_bei_freundschaft();

-- Angenommen: die Frage beim Empfänger ist erledigt, der Fragende erfährt es.
create or replace function public.mitteilung_bei_freundschaft_angenommen()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.angenommen and not old.angenommen then
    delete from public.notifications
     where user_id = new.an and actor_id = new.von
       and art = 'freund_anfrage' and target_type = 'profile';
    perform public.mitteilung_anlegen(
      new.von, new.an, 'freund_ok', 'communities', 'profile', new.an
    );
  end if;
  return new;
end $$;

drop trigger if exists mitteilung_freundschaft_angenommen on public.freundschaften;
create trigger mitteilung_freundschaft_angenommen
  after update on public.freundschaften
  for each row execute function public.mitteilung_bei_freundschaft_angenommen();

-- Zurückgezogen oder abgelehnt: die offene Frage verschwindet.
create or replace function public.mitteilung_weg_bei_freundschaft()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.notifications
   where user_id = old.an and actor_id = old.von
     and art = 'freund_anfrage' and target_type = 'profile';
  return old;
end $$;

drop trigger if exists mitteilung_weg_freundschaft on public.freundschaften;
create trigger mitteilung_weg_freundschaft
  after delete on public.freundschaften
  for each row execute function public.mitteilung_weg_bei_freundschaft();

-- Auslöserfunktionen: EXECUTE ginge sonst an PUBLIC (Schema 74). Wie in
-- Schema 95/97: weg von public/anon, an authenticated.
revoke execute on function public.freundschaft_vorgaben() from public, anon;
revoke execute on function public.freundschaft_bei_blockierung() from public, anon;
revoke execute on function public.mitteilung_bei_freundschaft() from public, anon;
revoke execute on function public.mitteilung_bei_freundschaft_angenommen() from public, anon;
revoke execute on function public.mitteilung_weg_bei_freundschaft() from public, anon;
grant execute on function public.freundschaft_vorgaben() to authenticated;
grant execute on function public.freundschaft_bei_blockierung() to authenticated;
grant execute on function public.mitteilung_bei_freundschaft() to authenticated;
grant execute on function public.mitteilung_bei_freundschaft_angenommen() to authenticated;
grant execute on function public.mitteilung_weg_bei_freundschaft() to authenticated;


-- ---------------------------------------------------------------------------
-- 5. Selbstprüfung
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'freundschaften'
                    and policyname = 'nur_freigegebene' and permissive = 'RESTRICTIVE') then
    raise exception 'nur_freigegebene fehlt auf freundschaften';
  end if;
  if has_table_privilege('authenticated', 'public.freundschaften', 'update') then
    raise exception 'freundschaften ist für authenticated änderbar';
  end if;
  if has_function_privilege('anon', 'public.freundschaft_annehmen(uuid)', 'execute') then
    raise exception 'freundschaft_annehmen ist für anon ausführbar';
  end if;
end $$;
