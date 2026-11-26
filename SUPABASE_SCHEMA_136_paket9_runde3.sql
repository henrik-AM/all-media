-- Schema 136 — Paket 9, Befunde Runde 3 (Codex, 21.11.2026), selbst behoben, nicht gegengeprüft. Nach 135.
--   meine_kontoanalysen     Beitrag ohne Messwert zählt 0 statt 1 Aufruf (LEFT JOIN-Nulltupel)
--   video_beleg_pruefen     Livestream-Ende: Dauer aus created_at bis jetzt statt leer

-- Fassung 135 + Livestream-Ende.
create or replace function public.video_beleg_pruefen() returns trigger
language plpgsql security definer set search_path=public as $$
declare p text; video boolean; s double precision;
begin
 if tg_op='INSERT' and new.demo and public.ist_testkonto(new.user_id) then return new; end if;
 p := case when new.media_url like public.medien_adresse('')||'%'
           then substr(new.media_url, length(public.medien_adresse(''))+1) end;
 -- Schema 135 (vor dem Update-Sonderfall): ohne Datei keine behauptete Dauer (Ausnahme Livestream-Platzhalter).
 if new.media_url is null then
   -- Schema 136: Ende eines Livestreams. Die Aufzeichnungsdauer rechnet die
   -- Datenbank aus Start (created_at) und jetzt — kein Clientwert.
   if tg_op='UPDATE' and old.format='live' and coalesce(new.format,'')<>'live' then
     new.duration := lpad(floor(extract(epoch from now()-old.created_at)/60)::int::text,2,'0')||':'||
                     lpad((floor(extract(epoch from now()-old.created_at))::int%60)::text,2,'0');
     return new;
   end if;
   if new.kind in ('reel','clip') and coalesce(new.format,'')<>'live' then new.duration := null; end if;
   return new;
 end if;
 if tg_op='UPDATE' and new.media_url is not distinct from old.media_url and new.kind=old.kind then
   -- Andere Änderungen an Altbeiträgen bleiben möglich; belegte Dauer bleibt fest.
   if new.duration is distinct from old.duration and p is not null then
     s := intern.video_sekunden(p, new.user_id);
     if s is not null then new.duration := floor(s/60)::int::text||':'||lpad((floor(s)::int%60)::text,2,'0'); end if;
   end if;
   return new;
 end if;
 if p is null or split_part(p,'/',1)='beispiel' then return new; end if;
 video := new.kind in ('reel','clip') or coalesce(intern.medium_typ(p),'') like 'video/%'
          or p ~* '\.(mp4|mov|m4v|webm)$';
 if not video then return new; end if;
 s := intern.video_sekunden(p, new.user_id);
 if s is null then
   raise exception 'Bitte das Video über die geprüfte Uploadstelle hochladen.' using errcode='42501';
 end if;
 new.duration := floor(s/60)::int::text||':'||lpad((floor(s)::int%60)::text,2,'0');
 return new;
end $$;
revoke execute on function public.video_beleg_pruefen() from public,anon,authenticated;

-- Fassung 135 + Nulltupel ausgeschlossen.
create or replace function public.meine_kontoanalysen() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare ich uuid:=auth.uid(); tage int; ab date; fenster jsonb:='[]'; z jsonb;
begin
 if ich is null or not public.konto_freigegeben() then raise exception 'Konto nicht freigegeben'; end if;
 foreach tage in array array[7,30] loop
  ab := (now() at time zone 'utc')::date-(tage-1);
  with eigen as (select id,title,description from public.posts where user_id=ich),
  basis as (select s.* from public.konto_sichtungen s join eigen e on e.id=s.post_id where s.tag>=ab),
  laender as (select land, count(distinct zuschauer) as konten from basis where land is not null group by land having count(distinct zuschauer)>=10),
  pro_post as (select e.id,coalesce(nullif(e.title,''),nullif(e.description,''),'Beitrag') as titel,
    count(distinct (b.zuschauer,b.tag)) filter (where b.zuschauer is not null) as aufrufe,count(distinct b.zuschauer) as reichweite
    from eigen e left join basis b on b.post_id=e.id group by e.id,e.title,e.description),
  interaktionen as (
    select k.akteur from public.konto_interaktionen k join eigen e on e.id=k.post_id
    where k.zeitpunkt >= (ab::timestamp at time zone 'UTC')
  )
  select jsonb_build_object('tage',tage,
    'reichweite',(select count(distinct zuschauer) from basis),
    'aufrufe',(select count(distinct (post_id,zuschauer,tag)) from basis),
    'followerAufrufe',(select count(distinct (post_id,zuschauer,tag)) from basis where folgt),
    'nichtFollowerAufrufe',(select count(distinct (post_id,zuschauer,tag)) - count(distinct (post_id,zuschauer,tag)) filter (where folgt) from basis),
    'sichtzeitMs',(select coalesce(sum(dauer_ms),0) from basis),
    'interaktionen',(select count(*) from interaktionen),
    'laender',coalesce((select jsonb_agg(jsonb_build_object('land',land,'ab',floor(konten/10.0)*10)) from laender),'[]'),
    'beitraege',coalesce((select jsonb_agg(to_jsonb(t)) from (select * from pro_post order by aufrufe desc,id limit 100) t),'[]')
  ) into z;
  fenster:=fenster||jsonb_build_array(z);
 end loop;
 return jsonb_build_object('seit',(select seit from public.konto_analysen_start where id), 'mindestzahl',10,'zeitraeume',fenster);
end $$;
revoke execute on function public.meine_kontoanalysen() from public,anon;
grant execute on function public.meine_kontoanalysen() to authenticated;

-- ------------------------------------------------------------ Nachweis --
do $$
begin
  if position('b.zuschauer is not null' in pg_get_functiondef('public.meine_kontoanalysen()'::regprocedure)) = 0 then
    raise exception 'Schema 136: Nulltupel noch gezählt';
  end if;
end $$;
