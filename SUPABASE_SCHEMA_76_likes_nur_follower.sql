-- ===========================================================================
--  All Media — Schema 76 (Kasten 19): Likes-Sichtbarkeit „Nur Follower"
--  Stand 01.10.2026
--
--  WARUM ES DIESE DATEI GIBT
--
--  Henrik am 01.10.2026: „Der Besitzer des Beitrages darf immer sehen, wer
--  seinen Beitrag geliked hat. Diese Regelung (mit deaktivierter
--  Likes-Sichtbarkeit) zählt nur für die Öffentlichkeit. Füge zu dieser
--  Einstellung noch die Option ‚nur Follower' hinzu."
--
--  Die Besitzer-Ausnahme steht seit Schema 65 in like_sichtbar() und bleibt.
--  Neu ist die fünfte Stufe 'nur_follower': sichtbar genau für Betrachter,
--  die dem Eigner folgen.
--
--  NUR FÜR DEN BEREICH likes. Die anderen Bereiche (Standort, Story, dm …)
--  bieten die Stufe in der Oberfläche nicht an; die Datenbank lehnt sie dort
--  auch ab, damit niemand an der Oberfläche vorbei eine Stufe setzt, deren
--  Bedeutung dort nie geprüft wurde.
--
--  Idempotent: mehrfach einspielbar.
-- ===========================================================================

alter table public.visibility_settings drop constraint if exists visibility_settings_stufe_check;
alter table public.visibility_settings
  add constraint visibility_settings_stufe_check
  check (stufe in ('niemand', 'niemand_bis_auf', 'alle_bis_auf', 'alle', 'nur_follower'));

alter table public.visibility_settings drop constraint if exists visibility_settings_nur_follower_check;
alter table public.visibility_settings
  add constraint visibility_settings_nur_follower_check
  check (stufe <> 'nur_follower' or bereich = 'likes');

-- Fassung aus Schema 11 plus die neue Stufe. Alles andere unverändert.
create or replace function public.sichtbar_fuer(eigner uuid, feld text, betrachter uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when eigner = betrachter then true
    else coalesce((
      select case s.stufe
        when 'alle'    then true
        when 'niemand' then false
        when 'alle_bis_auf' then not exists (
          select 1 from public.visibility_exceptions e
           where e.user_id = eigner and e.bereich = feld and e.target_id = betrachter)
        when 'niemand_bis_auf' then exists (
          select 1 from public.visibility_exceptions e
           where e.user_id = eigner and e.bereich = feld and e.target_id = betrachter)
        when 'nur_follower' then exists (
          select 1 from public.follows f
           where f.follower_id = betrachter and f.followee_id = eigner)
        else true
      end
      from public.visibility_settings s
      where s.user_id = eigner and s.bereich = feld
    ), true)
  end;
$$;

-- Rechte wie bisher; create or replace behält sie, die Zeile stellt es sicher.
revoke execute on function public.sichtbar_fuer(uuid, text, uuid) from public, anon;
grant execute on function public.sichtbar_fuer(uuid, text, uuid) to authenticated;


-- ---------------------------------------------------------------------------
--  Nachweis
-- ---------------------------------------------------------------------------
do $$
begin
  if pg_get_functiondef('public.sichtbar_fuer'::regproc) not like '%nur_follower%' then
    raise exception 'sichtbar_fuer kennt nur_follower nicht';
  end if;
end $$;
