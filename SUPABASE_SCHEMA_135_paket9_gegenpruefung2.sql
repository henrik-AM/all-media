-- Schema 135 — Paket 9, Befunde der Gegenprüfung Runde 2 (Codex, 21.11.2026). Nach 134.
--   video_beleg_pruefen (134)   Video ohne Datei: Dauer auch bei Updates leer
--   karussell_pruefen (133)     nur posts/- oder beispiel/-Medien (posts/ ist löschgesperrt)
--   meine_kontoanalysen (130)   Aufrufe = verschiedene Zuschauer-Tage je Beitrag, nicht Zählerstand
--                               (robust, wenn eine Impression samt Zeile gelöscht wird)

-- Fassung 134 + Datei-Prüfung vor dem Update-Sonderfall.
create or replace function public.video_beleg_pruefen() returns trigger
language plpgsql security definer set search_path=public as $$
declare p text; video boolean; s double precision;
begin
 if tg_op='INSERT' and new.demo and public.ist_testkonto(new.user_id) then return new; end if;
 p := case when new.media_url like public.medien_adresse('')||'%'
           then substr(new.media_url, length(public.medien_adresse(''))+1) end;
 -- Schema 135 (vor dem Update-Sonderfall): ohne Datei keine behauptete Dauer (Ausnahme Livestream-Platzhalter).
 if new.media_url is null then
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

-- Fassung 133 + nur posts/ und beispiel/.
create or replace function public.karussell_pruefen() returns trigger
language plpgsql security invoker set search_path=public as $$
declare m jsonb; p text; t text;
begin
 if jsonb_typeof(new.medien)<>'array' then raise exception 'Ungültige Medienliste'; end if;
 if jsonb_array_length(new.medien)=0 then return new; end if;
 if new.kind<>'post' then raise exception 'Eine Medienliste gehört zu einem Beitrag'; end if;
 if tg_op='UPDATE' and new.medien=old.medien and new.user_id=old.user_id then
   new.media_url:=new.medien->0->>'url'; return new;
 end if;
 for m in select value from jsonb_array_elements(new.medien) loop
   if jsonb_typeof(m)<>'object' or m->>'typ' is null or m->>'typ' not in ('image','video')
      or m->>'url' is null or not public.medien_adresse_gueltig(m->>'url')
      or exists(select 1 from jsonb_object_keys(m) k where k not in ('url','typ')) then
     raise exception 'Ungültiges Medium';
   end if;
   p:=substr(m->>'url',length(public.medien_adresse(''))+1);
   -- Schema 135: nur Beitragsdateien (posts/, löschgesperrt) oder Beispielmedien.
   if split_part(p,'/',1) not in ('posts','beispiel') then raise exception 'Dieses Medium darfst du nicht verwenden' using errcode='42501'; end if;
   -- Wie medienreferenz_pruefen (117): nur selbst Hochgeladenes oder Beispielmedien.
   if current_user='authenticated' and split_part(p,'/',1)<>'beispiel'
      and not public.medium_selbst_hochgeladen(p) then
     raise exception 'Dieses Medium darfst du nicht verwenden' using errcode='42501';
   end if;
   t := coalesce(intern.medium_typ(p),'');
   -- Ein Video darf weder als Bild getarnt noch nur an zweiter Stelle versteckt sein.
   if m->>'typ'='video' or t like 'video/%' or p ~* '\.(mp4|mov|m4v|webm)$' then
     if m->>'typ'<>'video' then raise exception 'Falscher Medientyp'; end if;
     if current_user='authenticated' and split_part(p,'/',1)<>'beispiel'
        and not intern.video_geprueft(p,new.user_id) then
       raise exception 'Bitte das Video über die geprüfte Uploadstelle hochladen.' using errcode='42501';
     end if;
   elsif p !~* '\.(jpg|jpeg|png|webp)$' or (t<>'' and t not in ('image/jpeg','image/png','image/webp')) then
     raise exception 'Falscher Medientyp';
   end if;
 end loop;
 new.media_url:=new.medien->0->>'url';
 return new;
end $$;
revoke execute on function public.karussell_pruefen() from public,anon,authenticated;

-- Fassung 130 + Aufrufe als verschiedene Zuschauer-Tage.
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
    count(distinct (b.zuschauer,b.tag)) as aufrufe,count(distinct b.zuschauer) as reichweite
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
  if position('posts'',''beispiel' in pg_get_functiondef('public.karussell_pruefen()'::regprocedure)) = 0 then
    raise exception 'Schema 135: Karussell ohne Ordnergrenze';
  end if;
  if has_function_privilege('anon','public.meine_kontoanalysen()','execute') then
    raise exception 'Schema 135: anon darf Analysen';
  end if;
end $$;
