-- ===========================================================================
--  SUPABASE_SCHEMA_85_personen_vorschlaege.sql        (ENTWURF, Kasten 23)
--
--  WORUM ES GEHT
--
--  Henrik am 06.10.2026: „Der Algorithmus soll dem Nutzer (wie z. B. bei
--  Instagram) andere Nutzer vorschlagen, die er/sie kennen könnte (nur unter
--  Videos und Communitys)."
--
--  Bis heute gab es keine einzige Stelle, die Personen vorschlug. Die
--  Berechnung steht hier in EINER Funktion, damit App und Website nicht zwei
--  verschiedene Antworten geben (Kasten 23.5):
--
--    personen_vorschlaege(p_bereich text, p_anzahl int)
--      p_bereich  'videos' oder 'communitys' — dieselben Signale, andere
--                 Gewichte (unter Communitys zählen gemeinsame Communitys
--                 stärker).
--      p_anzahl   1 bis 30, Vorgabe 12.
--
--    Antwort je Zeile: id, name, handle, color, avatar_url, punkte, grund,
--    signale. KEINE Telefonnummer, keine Kontaktnamen, kein Geburtsdatum.
--
--  DIE SIGNALE (23.1) — nur echte Zeilen, nichts erfunden
--
--    gefolgt_von    Personen, denen ich folge, folgen ihr   (Freunde von Freunden)
--    communitys     Communitys, in denen wir beide Mitglied sind
--    folgt_dir      sie folgt mir, ich ihr nicht
--    messenger      wir führen uns GEGENSEITIG als Kontakt (status 'friend').
--                   Einseitig reicht nicht: wer nur meine Nummer kennt, soll
--                   mir nicht über den Vorschlag sein Video-Profil verraten
--                   und ich ihm nicht meins. Keine Nummernsuche, kein Abgleich
--                   eines Telefonbuchs — nur, was beide schon bestätigt haben.
--    interaktionen  Likes und Kommentare zwischen uns, in beide Richtungen
--                   (der Besitzer sieht ohnehin, wer ihn geliked hat, 26.4).
--
--  Ohne irgendein Signal steht niemand in der Liste. Ist die Liste leer,
--  blenden beide Oberflächen den Abschnitt aus.
--
--  DIE BEGRÜNDUNG (23.2) — Text aus der Datenbank, damit er auf beiden
--  Plattformen wortgleich ist. Es gewinnt das Signal mit den meisten Punkten:
--
--    „Gefolgt von @anna" / „… und einer weiteren Person" / „… und 2 weiteren Personen"
--    „1 gemeinsame Community" / „3 gemeinsame Communitys"
--    „Folgt dir"
--    „Aus deinem Messenger"
--    „Interagiert mit deinen Beiträgen" / „Du hast Beiträge geliked oder kommentiert"
--
--  Genannt wird nur jemand, dem ich selbst folge — also niemand, den ich
--  nicht ohnehin kenne. `follows` ist für alle Angemeldeten lesbar
--  ("Folgen lesen" using true); die Begründung verrät nichts Neues.
--
--  AUSGESCHLOSSEN (23.3) — in der Funktion, nicht in der Oberfläche
--
--    - man selbst
--    - wem ich schon folge
--    - Blockieren in BEIDE Richtungen, und wen ich stumm geschaltet habe
--    - Einträge, die ich mit „Entfernen" weggeklickt habe (vorschlag_entfernt)
--    - Minderjährige (unter 18 laut konto_alter oder profiles.geburtsdatum):
--      sie sind nur per Telefonnummer auffindbar (Schema 52/58). Wer selbst
--      minderjährig ist, bekommt keine Vorschläge — Fremde vorzuschlagen
--      wäre der Weg, den Schema 58 für Kinder gerade verschlossen hat.
--    - Konten, die nicht freigegeben sind (konto_stand <> 'frei')
--    - gelöschte oder gesperrte Konten (auth.users.deleted_at/banned_until,
--      profile_bans über gesperrt() für den jeweiligen Bereich)
--    - Testkonten-Trennung: echte Konten bekommen weder Testkonten
--      (ist_testkonto, Schema 62) noch Beispielprofile (profiles.demo)
--      vorgeschlagen — und Testkonten/Beispielprofile nur ihresgleichen.
--      Dieselbe Trennung gilt für die Zwischenperson bei „Gefolgt von".
--      Ohne sie bekäme @test sechs echte Konten vorgeschlagen: alle teilen
--      mit ihm fünf Communitys (gemessen am 08.10.2026).
--
--  „ENTFERNEN" (23.4)
--
--    Tabelle vorschlag_entfernt, eine Zeile je weggeklickter Person. Gilt für
--    beide Bereiche und beide Plattformen, bis zum Löschen des Kontos. RLS:
--    nur die eigenen Zeilen lesen, anlegen, löschen. nur_freigegebene wie
--    jede neue Tabelle (Schema 74).
--
--  TESTBESTAND
--
--    Kein fester Bestand nötig. test:vorschlaege legt die Beziehungen selbst
--    an und räumt danach auf — nur zwischen @test, @prueflauf und den
--    Beispielprofilen @greta und @hakan:
--
--      @test     folgt  @prueflauf  (→ bei @prueflauf: „Folgt dir")
--      @test     folgt  @greta, @hakan
--      @prueflauf folgt @test       (→ @greta/@hakan: „Gefolgt von @test")
--      @prueflauf blockiert @hakan  (→ @hakan fällt heraus)
--      @test     blockiert @prueflauf (→ Gegenrichtung)
--      @prueflauf entfernt @greta   (→ bleibt weg, auch nach neuer Anmeldung)
--
--    Minderjährige, Messenger-Kontakte und die Sicht eines echten Kontos
--    prüft der Lauf in einer ZURÜCKGEROLLTEN Transaktion über die
--    Management-API (braucht SUPABASE_TOKEN) — dort entsteht nichts
--    Dauerhaftes, auch keine Mitteilung.
--
--    zuruecksetzen() leert vorschlag_entfernt des Testkontos (Anker unten,
--    wie Schema 62 — keine weitere Vollfassung der Funktion).
--
--  EINSPIELEN (nur der Hauptagent, mit Nummer)
--
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      SUPABASE_SCHEMA_85_personen_vorschlaege.sql
--
--  Danach: npm run test:rechte, test:minderjaehrig, test:schema,
--          test:vorschlaege.
--  Mehrfach einspielbar.
--  Voraussetzung: Schema 52 (konto_stand, konto_freigegeben, alter_in_jahren),
--  Schema 62 (ist_testkonto), Schema 11 (gesperrt, alter_jahre).
-- ===========================================================================

do $$
begin
  if to_regprocedure('public.ist_testkonto(uuid)') is null then
    raise exception 'ist_testkonto() fehlt — erst SUPABASE_SCHEMA_62_nur_eigene_testkonten.sql einspielen.';
  end if;
  if to_regprocedure('public.konto_stand(uuid)') is null then
    raise exception 'konto_stand() fehlt — erst SUPABASE_SCHEMA_52_geburtsdatum.sql einspielen.';
  end if;
  if to_regprocedure('public.gesperrt(uuid, text)') is null then
    raise exception 'gesperrt() fehlt — erst SUPABASE_SCHEMA_11_handbuch.sql einspielen.';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
--  1. „Entfernen" — dauerhaft
-- ---------------------------------------------------------------------------

create table if not exists public.vorschlag_entfernt (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  ziel_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, ziel_id),
  constraint vorschlag_entfernt_nicht_selbst check (user_id <> ziel_id)
);

comment on table public.vorschlag_entfernt is
  'Personen, die jemand unter „Personen, die du kennen könntest" entfernt hat (Kasten 23). Gilt dauerhaft, beide Bereiche.';

alter table public.vorschlag_entfernt enable row level security;

revoke all on public.vorschlag_entfernt from anon;
revoke all on public.vorschlag_entfernt from authenticated;
grant select, insert, delete on public.vorschlag_entfernt to authenticated;

drop policy if exists "Entfernte Vorschlaege lesen" on public.vorschlag_entfernt;
create policy "Entfernte Vorschlaege lesen" on public.vorschlag_entfernt
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Vorschlag entfernen" on public.vorschlag_entfernt;
create policy "Vorschlag entfernen" on public.vorschlag_entfernt
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Entfernen zuruecknehmen" on public.vorschlag_entfernt;
create policy "Entfernen zuruecknehmen" on public.vorschlag_entfernt
  for delete to authenticated using (auth.uid() = user_id);

-- Wie jede neue Tabelle seit Schema 52/74 (test:minderjaehrig zählt nach).
drop policy if exists nur_freigegebene on public.vorschlag_entfernt;
create policy nur_freigegebene on public.vorschlag_entfernt
  as restrictive for all to authenticated
  using ((select public.konto_freigegeben())) with check ((select public.konto_freigegeben()));


-- ---------------------------------------------------------------------------
--  2. Minderjährig?
--
--  Zuerst das Geburtsdatum aus konto_alter (Schema 52), sonst das ältere Feld
--  profiles.geburtsdatum (Schema 11). Ohne Datum: nicht minderjährig — wie
--  überall seit Schema 11, sonst fiele jedes Bestandskonto heraus.
--  18 wie VOLLJAEHRIG in gemeinsam/alter.js.
-- ---------------------------------------------------------------------------

create or replace function public.ist_minderjaehrig(k uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    coalesce(
      (select public.alter_in_jahren(ka.geburtsdatum)
         from public.konto_alter ka
        where ka.user_id = k and ka.geburtsdatum is not null),
      (select public.alter_in_jahren(p.geburtsdatum)
         from public.profiles p
        where p.id = k and p.geburtsdatum is not null)
    ) < 18,
    false);
$$;

-- Nur intern (aus personen_vorschlaege). Postgres gibt EXECUTE sonst an PUBLIC.
revoke all on function public.ist_minderjaehrig(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
--  3. Die Vorschläge
-- ---------------------------------------------------------------------------

drop function if exists public.personen_vorschlaege(text, integer);

create or replace function public.personen_vorschlaege(
  p_bereich text default 'videos',
  p_anzahl  integer default 12
)
returns table (
  id         uuid,
  name       text,
  handle     text,
  color      text,
  avatar_url text,
  punkte     numeric,
  grund      text,
  signale    jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_ich      uuid := auth.uid();
  v_test     boolean;
  v_anzahl   integer := least(greatest(coalesce(p_anzahl, 12), 1), 30);
  v_sperre   text;
  -- Gewichte je Signal. Unter Communitys zählen gemeinsame Communitys
  -- stärker, Freunde von Freunden schwächer.
  w_follow   numeric;
  w_komm     numeric;
  w_folgt    numeric;
  w_msg      numeric;
  w_inter    numeric;
begin
  if v_ich is null then
    return;
  end if;
  if p_bereich is null or p_bereich not in ('videos', 'communitys') then
    raise exception 'unbekannter Bereich: % (erlaubt: videos, communitys)', p_bereich;
  end if;

  -- Ein Konto, das auf die Eltern wartet, sieht nichts (Schema 52) — und
  -- Minderjährige bekommen keine Fremden vorgeschlagen (Schema 58).
  if not public.konto_freigegeben() or public.ist_minderjaehrig(v_ich) then
    return;
  end if;

  v_test := public.ist_testkonto(v_ich)
            or coalesce((select p.demo from public.profiles p where p.id = v_ich), false);

  if p_bereich = 'videos' then
    v_sperre := 'videos';
    w_follow := 10; w_komm := 4;  w_folgt := 30; w_msg := 25; w_inter := 3;
  else
    v_sperre := 'communitys';
    w_follow := 6;  w_komm := 12; w_folgt := 20; w_msg := 15; w_inter := 2;
  end if;

  return query
  with
  blockiert as (
    select b.blocked_user_id as k from public.blocks b where b.user_id = v_ich
    union
    select b.user_id from public.blocks b where b.blocked_user_id = v_ich
  ),
  gefolgt as (
    -- Zu welcher Welt gehört ein Konto? Test (Testkonten + Beispielprofile)
    -- oder echt. Genannt wird nur jemand aus der eigenen Welt.
    select f.followee_id as k, f.created_at
      from public.follows f
      join public.profiles gp on gp.id = f.followee_id
     where f.follower_id = v_ich
       and f.followee_id not in (select k from blockiert)
       and (public.ist_testkonto(gp.id) or coalesce(gp.demo, false)) = v_test
  ),
  -- Freunde von Freunden: wem folgen die, denen ich folge?
  fof as (
    select f.followee_id as k,
           count(*)::int as n,
           (array_agg(p.handle order by g.created_at desc, p.handle))[1] as erster
      from gefolgt g
      join public.follows f on f.follower_id = g.k
      join public.profiles p on p.id = g.k
     group by f.followee_id
  ),
  komm as (
    select m2.user_id as k, count(distinct m1.community_id)::int as n
      from public.community_members m1
      join public.community_members m2
        on m2.community_id = m1.community_id and m2.user_id <> v_ich
     where m1.user_id = v_ich
     group by m2.user_id
  ),
  folgt_mir as (
    select f.follower_id as k from public.follows f where f.followee_id = v_ich
  ),
  -- Nur gegenseitige, bestätigte Kontakte. Keine Nummer wird verglichen.
  messenger as (
    select c1.contact_id as k
      from public.contacts c1
      join public.contacts c2
        on c2.user_id = c1.contact_id and c2.contact_id = v_ich and c2.status = 'friend'
     where c1.user_id = v_ich and c1.status = 'friend'
  ),
  inter_roh as (
    select p.user_id as k, count(*)::int as n, false as von_ihm
      from public.post_likes l join public.posts p on p.id = l.post_id
     where l.user_id = v_ich and p.user_id <> v_ich
     group by p.user_id
    union all
    select p.user_id, count(*)::int, false
      from public.comments c join public.posts p on p.id = c.post_id
     where c.user_id = v_ich and p.user_id <> v_ich
     group by p.user_id
    union all
    select l.user_id, count(*)::int, true
      from public.post_likes l join public.posts p on p.id = l.post_id
     where p.user_id = v_ich and l.user_id <> v_ich
     group by l.user_id
    union all
    select c.user_id, count(*)::int, true
      from public.comments c join public.posts p on p.id = c.post_id
     where p.user_id = v_ich and c.user_id <> v_ich
     group by c.user_id
  ),
  inter as (
    select r.k, sum(r.n)::int as n, bool_or(r.von_ihm) as von_ihm
      from inter_roh r group by r.k
  ),
  kandidaten as (
    select k from fof
    union select k from komm
    union select k from folgt_mir
    union select k from messenger
    union select k from inter
  ),
  bewertet as (
    select kd.k,
           coalesce(fof.n, 0)        as n_follow,
           fof.erster,
           coalesce(komm.n, 0)       as n_komm,
           (fm.k is not null)        as folgt_dir,
           (ms.k is not null)        as messenger,
           coalesce(i.n, 0)          as n_inter,
           coalesce(i.von_ihm, false) as inter_von_ihm,
           least(coalesce(fof.n, 0), 5)   * w_follow as s_follow,
           least(coalesce(komm.n, 0), 5)  * w_komm   as s_komm,
           case when fm.k is not null then w_folgt else 0 end as s_folgt,
           case when ms.k is not null then w_msg   else 0 end as s_msg,
           least(coalesce(i.n, 0), 10)    * w_inter  as s_inter
      from kandidaten kd
      left join fof           on fof.k  = kd.k
      left join komm          on komm.k = kd.k
      left join folgt_mir fm  on fm.k   = kd.k
      left join messenger ms  on ms.k   = kd.k
      left join inter i       on i.k    = kd.k
  ),
  summe as (
    select b.*,
           (b.s_follow + b.s_komm + b.s_folgt + b.s_msg + b.s_inter) as gesamt,
           greatest(b.s_follow, b.s_komm, b.s_folgt, b.s_msg, b.s_inter) as bestes
      from bewertet b
  )
  select p.id,
         p.name,
         p.handle,
         p.color,
         p.avatar_url,
         s.gesamt::numeric,
         -- Bei Gleichstand: unter Communitys zuerst die Communitys, sonst
         -- Messenger vor „Folgt dir" vor Freunden von Freunden.
         case
           when p_bereich = 'communitys' and s.s_komm > 0 and s.s_komm = s.bestes then
             case when s.n_komm = 1 then '1 gemeinsame Community'
                  else s.n_komm || ' gemeinsame Communitys' end
           when s.s_msg > 0 and s.s_msg = s.bestes then 'Aus deinem Messenger'
           when s.s_folgt > 0 and s.s_folgt = s.bestes then 'Folgt dir'
           when s.s_follow > 0 and s.s_follow = s.bestes then
             'Gefolgt von '
             || case when left(s.erster, 1) = '@' then s.erster else '@' || s.erster end
             || case when s.n_follow = 1 then ''
                     when s.n_follow = 2 then ' und einer weiteren Person'
                     else ' und ' || (s.n_follow - 1) || ' weiteren Personen' end
           when s.s_komm > 0 and s.s_komm = s.bestes then
             case when s.n_komm = 1 then '1 gemeinsame Community'
                  else s.n_komm || ' gemeinsame Communitys' end
           when s.inter_von_ihm then 'Interagiert mit deinen Beiträgen'
           else 'Du hast Beiträge geliked oder kommentiert'
         end,
         jsonb_build_object(
           'gefolgt_von',   s.n_follow,
           'communitys',    s.n_komm,
           'folgt_dir',     s.folgt_dir,
           'messenger',     s.messenger,
           'interaktionen', s.n_inter
         )
    from summe s
    join public.profiles p on p.id = s.k
    join auth.users u      on u.id = p.id
   where p.id <> v_ich
     and s.gesamt > 0
     -- Vorgeschlagen wird nur die eigene Welt (Testkonten-Trennung).
     and (public.ist_testkonto(p.id) or coalesce(p.demo, false)) = v_test
     and not exists (select 1 from public.follows f
                      where f.follower_id = v_ich and f.followee_id = p.id)
     and p.id not in (select k from blockiert)
     and not exists (select 1 from public.mutes m
                      where m.user_id = v_ich and m.muted_user_id = p.id)
     and not exists (select 1 from public.vorschlag_entfernt e
                      where e.user_id = v_ich and e.ziel_id = p.id)
     and u.deleted_at is null
     and (u.banned_until is null or u.banned_until <= now())
     and not public.gesperrt(p.id, v_sperre)
     and public.konto_stand(p.id) = 'frei'
     and not public.ist_minderjaehrig(p.id)
   order by s.gesamt desc, p.handle
   limit v_anzahl;
end;
$$;

comment on function public.personen_vorschlaege(text, integer) is
  'Personen, die du kennen könntest (Kasten 23). Nur für Videos und Communitys; App und Website rufen dieselbe Funktion.';

revoke all on function public.personen_vorschlaege(text, integer) from public, anon;
grant execute on function public.personen_vorschlaege(text, integer) to authenticated;


-- ---------------------------------------------------------------------------
--  4. zuruecksetzen(): entfernte Vorschläge des Testkontos mit leeren
--     — am Anker umgeschrieben wie in Schema 62, keine neue Vollfassung.
-- ---------------------------------------------------------------------------

do $$
declare
  quelle text;
  anker  constant text := '  delete from public.follows       where follower_id = ziel;';
begin
  select pg_get_functiondef('public.zuruecksetzen'::regproc) into quelle;

  if quelle like '%vorschlag_entfernt%' then
    raise notice 'zuruecksetzen() leert vorschlag_entfernt schon.';
    return;
  end if;
  if position(anker in quelle) = 0 then
    raise exception 'Anker in zuruecksetzen() nicht gefunden — bitte von Hand anpassen.';
  end if;

  quelle := replace(quelle, anker, anker || chr(10) ||
    '  delete from public.vorschlag_entfernt where user_id = ziel;  -- Kasten 23');
  execute quelle;
end;
$$;


-- ---------------------------------------------------------------------------
--  5. Gegenprobe im selben Lauf
-- ---------------------------------------------------------------------------

do $$
begin
  if has_function_privilege('anon', 'public.personen_vorschlaege(text, integer)', 'execute') then
    raise exception 'personen_vorschlaege() ist für anon ausführbar.';
  end if;
  if not has_function_privilege('authenticated', 'public.personen_vorschlaege(text, integer)', 'execute') then
    raise exception 'personen_vorschlaege() ist für authenticated nicht ausführbar.';
  end if;
  if has_function_privilege('authenticated', 'public.ist_minderjaehrig(uuid)', 'execute') then
    raise exception 'ist_minderjaehrig() ist von außen aufrufbar.';
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'vorschlag_entfernt'
                    and policyname = 'nur_freigegebene') then
    raise exception 'vorschlag_entfernt ohne nur_freigegebene.';
  end if;
  if pg_get_functiondef('public.zuruecksetzen'::regproc) not like '%vorschlag_entfernt%' then
    raise exception 'zuruecksetzen() leert vorschlag_entfernt nicht.';
  end if;
end;
$$;
