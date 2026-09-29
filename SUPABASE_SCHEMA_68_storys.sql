-- ===========================================================================
--  All Media — Schema 68 (ENTWURF, Kasten 11): Storys
--  Stand 29.09.2026
--
--  NUMMER: wird beim Zusammenführen vergeben. Nicht in SUPABASE_REIHENFOLGE.md
--  eingetragen — das macht der Hauptagent mit der Nummer.
--
--  WARUM ES DIESE DATEI GIBT (Feedback Henrik 21.09.2026, Kasten 11)
--
--  11.5  „Story-Ziel: aus Videos nur Videos oder Messenger und Videos, im
--        Messenger umgekehrt." Bisher gab es nur `in_videos`; „nur Videos"
--        war nicht darstellbar, jede Story stand immer im Messenger.
--        -> neue Spalte `in_messenger`, mindestens ein Ziel muss gesetzt sein.
--
--  11.6  „Story-Bearbeitung fehlt komplett: Text, Filter, Schrift, Personen
--        markieren." Die Bearbeitung wird als Daten gespeichert, nicht ins
--        Bild gebrannt — nur so sieht der Betrachter in App und Website
--        dasselbe (gemeinsam/story.js, overlaysPruefen).
--        -> `stories.overlays jsonb`
--        -> Tabelle `story_tags` nach dem Muster von `post_tags` (Schema 20),
--           Regel „Wer darf mich markieren" (sichtbar_fuer 'markierung'),
--           Mitteilung an die markierte Person (Schema 44/49),
--           `story_markierbar()` liefert, wen man wählen darf.
--
--  11.1/11.3  Wer eine Story sehen darf, entschied bisher halb die Datenbank
--        (Sichtbarkeitsstufe) und halb der Code (Kontakt? in_videos?). Eine
--        Messenger-Story war per API für jeden lesbar, nur die Leiste
--        filterte sie weg. Jetzt entscheidet die Regel:
--          eigene Story                          -> ja
--          in_videos                             -> ja (Stufe ist dann „alle")
--          in_messenger und Kontakt (friend)     -> ja
--          markiert                              -> ja
--        immer zusätzlich: nicht abgelaufen und sichtbar_fuer(...,'story',...).
--
--  11.3  Testbestand: die sechs Storys der Demoprofile hatten in_videos=false
--        und kamen deshalb in Home NIE vor. Hier nur Demoprofile
--        (profiles.demo) — keine echten Konten.
--
--  Idempotent: mehrfach einspielbar.
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  1. Spalten
-- ---------------------------------------------------------------------------

alter table public.stories add column if not exists in_messenger boolean not null default true;
alter table public.stories add column if not exists overlays jsonb;

comment on column public.stories.in_messenger is
  'Story steht im Messenger (Kontakte). Mit in_videos zusammen das Ziel der '
  'Story; mindestens eines von beiden ist gesetzt (Kasten 11.5).';
comment on column public.stories.overlays is
  'Bearbeitung der Story als Daten: {filter, texte[], markiert[]} — '
  'Form siehe gemeinsam/story.js overlaysPruefen().';

-- Alte Zeilen, die weder noch haetten, gibt es nicht (Standard true) — die
-- Anweisung steht fuer den Fall, dass jemand vorher von Hand gespielt hat.
update public.stories set in_messenger = true where not in_messenger and not in_videos;

alter table public.stories drop constraint if exists stories_ziel_check;
alter table public.stories add constraint stories_ziel_check
  check (in_messenger or in_videos);

-- Die Spalten sind durch den tabellenweiten grant schon dabei; die Zeile
-- macht die Absicht sichtbar (vgl. Schema 36).
grant select, insert (in_messenger, overlays), update (in_messenger, overlays)
  on public.stories to authenticated;


-- ---------------------------------------------------------------------------
--  2. Hilfsfunktionen fuer die Leseregel
--
--  Beide mit security definer: `contacts` und `story_tags` darf der
--  Betrachter nur teilweise lesen. Eine Unterabfrage in der Regel selbst
--  liefe mit seinen Rechten und saehe die Zeile des Urhebers nicht.
-- ---------------------------------------------------------------------------

create or replace function public.ist_messenger_kontakt(eigner uuid, betrachter uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.contacts c
     where c.status = 'friend'
       and ((c.user_id = betrachter and c.contact_id = eigner)
         or (c.user_id = eigner and c.contact_id = betrachter))
  );
$$;

revoke all on function public.ist_messenger_kontakt(uuid, uuid) from public, anon;
grant execute on function public.ist_messenger_kontakt(uuid, uuid) to authenticated;


-- ---------------------------------------------------------------------------
--  3. story_tags — Personen in einer Story markieren (11.6)
-- ---------------------------------------------------------------------------

create table if not exists public.story_tags (
  story_id   uuid not null references public.stories (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (story_id, user_id)
);

create index if not exists story_tags_user_idx
  on public.story_tags (user_id, created_at desc);

alter table public.story_tags enable row level security;

grant select, insert, delete on public.story_tags to authenticated;

create or replace function public.ist_story_markiert(ziel_story uuid, wer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.story_tags t where t.story_id = ziel_story and t.user_id = wer
  );
$$;

revoke all on function public.ist_story_markiert(uuid, uuid) from public, anon;
grant execute on function public.ist_story_markiert(uuid, uuid) to authenticated;

/*
 * Dieselbe Bauart wie darf_markieren() in Schema 20: der Verfasser wird mit
 * erhoehten Rechten gelesen, und ohne Treffer heisst es nein. Sonst kaeme
 * NULL heraus, und sichtbar_fuer(NULL, …) antwortet true.
 */
create or replace function public.darf_story_markieren(ziel_story uuid, wen uuid, wer uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  eigner uuid;
begin
  select s.user_id into eigner from public.stories s where s.id = ziel_story;
  if eigner is null or wer is null or eigner <> wer then
    return false;
  end if;
  if wen = wer then
    return false;
  end if;
  return public.sichtbar_fuer(wen, 'markierung', wer);
end;
$$;

revoke all on function public.darf_story_markieren(uuid, uuid, uuid) from public, anon;
grant execute on function public.darf_story_markieren(uuid, uuid, uuid) to authenticated;

create or replace function public.story_eigner(ziel_story uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.user_id from public.stories s where s.id = ziel_story;
$$;

revoke all on function public.story_eigner(uuid) from public, anon;
grant execute on function public.story_eigner(uuid) to authenticated;

-- Lesen: der Verfasser und die markierte Person selbst. Wer die Story sonst
-- sieht, bekommt die Namen ueber overlays.markiert (nur Lage und Anzeigename).
drop policy if exists "Story-Markierungen lesen" on public.story_tags;
create policy "Story-Markierungen lesen" on public.story_tags
  for select to authenticated
  using (user_id = auth.uid() or public.story_eigner(story_id) = auth.uid());

drop policy if exists "Story-Markierung setzen" on public.story_tags;
create policy "Story-Markierung setzen" on public.story_tags
  for insert to authenticated
  with check (public.darf_story_markieren(story_id, user_id, auth.uid()));

-- Entfernen: der Verfasser und die markierte Person (sich selbst austragen).
drop policy if exists "Story-Markierung entfernen" on public.story_tags;
create policy "Story-Markierung entfernen" on public.story_tags
  for delete to authenticated
  using (user_id = auth.uid() or public.story_eigner(story_id) = auth.uid());


-- Wen darf ich markieren? Kontakte, Gefolgte und Folgende — und wer mit
-- `suche` gefunden wird. Immer nur, wer die Markierung durch mich zulaesst.
-- Die Oberflaeche zeigt genau diese Liste; die Regel oben prueft es noch
-- einmal, falls jemand an der Oberflaeche vorbei schreibt.
create or replace function public.story_markierbar(suche text default null)
returns table (id uuid, name text, handle text)
language sql
stable
security definer
set search_path = public
as $$
  with ich as (select auth.uid() as k),
  nah as (
    select c.contact_id as k from public.contacts c, ich
     where c.user_id = ich.k and c.status = 'friend'
    union
    select f.followee_id from public.follows f, ich where f.follower_id = ich.k
    union
    select f.follower_id from public.follows f, ich where f.followee_id = ich.k
  ),
  kandidaten as (
    select p.id, p.name, p.handle, 0 as rang
      from public.profiles p join nah on nah.k = p.id
     where coalesce(trim(suche), '') = ''
        or p.name ilike '%' || trim(suche) || '%'
        or p.handle ilike '%' || trim(suche) || '%'
    union
    select p.id, p.name, p.handle, 1 as rang
      from public.profiles p
     where length(coalesce(trim(suche), '')) >= 2
       and (p.name ilike '%' || trim(suche) || '%' or p.handle ilike '%' || trim(suche) || '%')
  )
  select distinct on (k.id) k.id, k.name, k.handle
    from kandidaten k, ich
   where ich.k is not null
     and k.id <> ich.k
     and public.sichtbar_fuer(k.id, 'markierung', ich.k)
   order by k.id, k.rang
   limit 50;
$$;

revoke all on function public.story_markierbar(text) from public, anon;
grant execute on function public.story_markierbar(text) to authenticated;


-- Mitteilung an die markierte Person (Art 'mention', Ziel 'story').
-- Beide Werte sind in den Einschraenkungen aus Schema 49 schon erlaubt.
create or replace function public.mitteilung_bei_story_markierung()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_verfasser uuid;
  v_videos boolean;
begin
  select user_id, in_videos into v_verfasser, v_videos
    from public.stories where id = new.story_id;

  perform public.mitteilung_anlegen(
    new.user_id, coalesce(auth.uid(), v_verfasser), 'mention',
    case when v_videos then 'videos' else 'messenger' end,
    'story', new.story_id
  );
  return new;
end $$;

revoke all on function public.mitteilung_bei_story_markierung() from public, anon, authenticated;

drop trigger if exists mitteilung_story_markierung on public.story_tags;
create trigger mitteilung_story_markierung
  after insert on public.story_tags
  for each row execute function public.mitteilung_bei_story_markierung();


-- ---------------------------------------------------------------------------
--  4. Die Leseregel: das Ziel entscheidet in der Datenbank (11.1, 11.5)
--
--  Ersetzt die Fassung aus Schema 19. Die zweite Regel `stories_im_highlight`
--  (Schema 48) bleibt stehen und wird verodert — sie wiederholt selbst
--  sichtbar_fuer, oeffnet also nichts Neues.
-- ---------------------------------------------------------------------------

drop policy if exists "Aktuelle Storys lesen" on public.stories;
create policy "Aktuelle Storys lesen" on public.stories
  for select to authenticated
  using (
    expires_at > now()
    and (
      user_id = auth.uid()
      or (
        public.sichtbar_fuer(user_id, 'story', auth.uid())
        and (
          in_videos
          or (in_messenger and public.ist_messenger_kontakt(user_id, auth.uid()))
          or public.ist_story_markiert(id, auth.uid())
        )
      )
    )
  );


-- ---------------------------------------------------------------------------
--  5. Die Trigger aus Schema 36 halten den Check ein
--
--  Nimmt ein Trigger `in_videos` zurueck, muss die Story im Messenger
--  bleiben — sonst verletzte die Zeile stories_ziel_check, und das Umstellen
--  der Sichtbarkeit schlüge mit einer Fehlermeldung fehl.
-- ---------------------------------------------------------------------------

create or replace function public.story_in_videos_zuruecknehmen()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.bereich = 'story' and new.stufe is distinct from 'alle' then
    update public.profiles
       set story_in_videos = false
     where id = new.user_id
       and story_in_videos;

    update public.stories
       set in_videos = false,
           in_messenger = true
     where user_id = new.user_id
       and in_videos;
  end if;
  return new;
end;
$$;

create or replace function public.storys_aus_videos_nehmen()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.story_in_videos and not new.story_in_videos then
    update public.stories
       set in_videos = false,
           in_messenger = true
     where user_id = new.id
       and in_videos;
  end if;
  return new;
end;
$$;

revoke all on function public.story_in_videos_zuruecknehmen() from public, anon, authenticated;
revoke all on function public.storys_aus_videos_nehmen() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
--  6. Testbestand — NUR Demoprofile (profiles.demo)
--
--  a) Die sechs Beispielstorys stehen ab jetzt in beiden Bereichen. Vorher
--     in_videos=false: in Home kamen sie nie vor, auch nicht fuer Konten,
--     die Anna & Co. folgen.
--  b) Anna und Bob bekommen je eine zweite Story — damit der Betrachter mit
--     mehreren Balken je Person (11.4) im Bestand pruefbar ist.
--  c) Anna bekommt eine Bearbeitung (Text + Filter) an ihrer ersten Story —
--     damit man die Anzeige der Overlays (11.6) ohne eigenes Posten sieht.
-- ---------------------------------------------------------------------------

update public.stories s
   set in_videos = true, in_messenger = true
  from public.profiles p
 where p.id = s.user_id
   and p.demo
   and not s.in_videos;

do $$
declare
  v_basis text := 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/';
begin
  insert into public.stories (id, user_id, media_url, media_type, caption, created_at, expires_at, demo, in_videos, in_messenger)
  select v.id::uuid, p.id, v_basis || v.datei, 'image', v.caption, now() - interval '30 minutes',
         now() + interval '10 years', true, true, true
    from (values
      ('33333333-a11e-4d1a-8000-000000000011', '@anna', 'story-hafen.jpg', 'Zweiter Blick vom Gipfel'),
      ('33333333-a11e-4d1a-8000-000000000012', '@bob',  'story-schreibtisch.jpg', 'Build ist grün')
    ) as v(id, handle, datei, caption)
    join public.profiles p on p.handle = v.handle and p.demo
  on conflict (id) do update set
    expires_at = excluded.expires_at, in_videos = true, in_messenger = true;

  update public.stories s
     set overlays = jsonb_build_object(
           'filter', 'warm',
           'texte', jsonb_build_array(jsonb_build_object(
             'text', 'Guten Morgen!', 'schrift', 'hand', 'farbe', '#FFFFFF',
             'hintergrund', false, 'groesse', 34, 'x', 0.5, 'y', 0.3)),
           'markiert', jsonb_build_array())
    from public.profiles p
   where p.id = s.user_id and p.demo and p.handle = '@anna'
     and s.id = '33333333-a11e-4d1a-8000-000000000001'
     and s.overlays is null;
end $$;


-- ---------------------------------------------------------------------------
--  Nachweis
-- ---------------------------------------------------------------------------
do $$
declare v_n int;
begin
  select count(*) into v_n from public.stories s join public.profiles p on p.id = s.user_id
   where p.demo and s.in_videos and s.expires_at > now();
  raise notice 'Storys von Demoprofilen im Videos-Bereich: %', v_n;

  if not exists (select 1 from pg_constraint where conname = 'stories_ziel_check') then
    raise exception 'stories_ziel_check fehlt';
  end if;
end $$;
