-- AF7 / Schema 110 — ENTWURF, nicht eingespielt. Nach 108.
-- Keine Rückrechnung historischer Follower-/Vorwahlmerkmale. Neue Messung ab Einspielung.
-- post_impressions bleibt privat; der Verfasser erhält ausschließlich Aggregate.
create table if not exists public.konto_analysen_start (
  id boolean primary key default true check(id), seit timestamptz not null default now()
);
insert into public.konto_analysen_start(id) values(true) on conflict do nothing;
alter table public.konto_analysen_start enable row level security;
revoke all on public.konto_analysen_start from public,anon,authenticated;
drop policy if exists nur_freigegebene on public.konto_analysen_start;
create policy nur_freigegebene on public.konto_analysen_start as restrictive for all to authenticated
using((select public.konto_freigegeben())) with check((select public.konto_freigegeben()));

create table if not exists public.konto_sichtungen (
  impression_id uuid primary key references public.post_impressions(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  zuschauer uuid not null references public.profiles(id) on delete cascade,
  tag date not null,
  folgt boolean not null,
  land text,
  sichtungen bigint not null check(sichtungen>=0),
  dauer_ms bigint not null check(dauer_ms>=0)
);
create index if not exists konto_sichtungen_post_tag on public.konto_sichtungen(post_id,tag);
alter table public.konto_sichtungen enable row level security;
revoke all on public.konto_sichtungen from public,anon,authenticated;
-- Keine permissive Leseregel: auch Eigentümer dürfen keine Zuschauerlisten lesen.
drop policy if exists nur_freigegebene on public.konto_sichtungen;
create policy nur_freigegebene on public.konto_sichtungen as restrictive for all to authenticated
using((select public.konto_freigegeben())) with check((select public.konto_freigegeben()));

-- Nur explizite internationale Vorwahlen; keine Annahme 0... = Deutschland.
-- Quelle: ITU https://www.itu.int/oth/t0202/es . +1/+7 und unbekannte bleiben NULL.
create or replace function public.analyse_vorwahlland(nummer text) returns text
language sql immutable set search_path=public as $$
 select case
 when nummer !~ '^\s*(\+|00)' then null
 else (select land from (values
 ('49','Deutschland'),('43','Österreich'),('41','Schweiz'),('34','Spanien'),
 ('33','Frankreich'),('31','Niederlande'),('32','Belgien'),('45','Dänemark'),
 ('46','Schweden'),('47','Norwegen'),('48','Polen'),('351','Portugal'),
 ('353','Irland'),('352','Luxemburg'),('420','Tschechien'),('421','Slowakei')
 ) as l(vorwahl,land)
 where regexp_replace(regexp_replace(nummer,'^\s*(\+|00)','','g'),'[^0-9]','','g') like vorwahl||'%'
 order by length(vorwahl) desc limit 1) end;
$$;
revoke execute on function public.analyse_vorwahlland(text) from public,anon,authenticated;

create or replace function public.konto_sichtung_messen() returns trigger
language plpgsql security definer set search_path=public as $$
declare autor uuid; delta_s bigint; delta_d bigint;
begin
 select user_id into autor from public.posts where id=new.post_id;
 if autor=new.user_id or not public.konto_freigegeben() then return new; end if;
 delta_s := greatest(0,new.sichtungen-case when tg_op='UPDATE' then old.sichtungen else 0 end);
 delta_d := greatest(0,new.dauer_ms-case when tg_op='UPDATE' then old.dauer_ms else 0 end);
 insert into public.konto_sichtungen(impression_id,post_id,zuschauer,tag,folgt,land,sichtungen,dauer_ms)
 values(new.id,new.post_id,new.user_id,(now() at time zone 'utc')::date,
   exists(select 1 from public.follows where follower_id=new.user_id and followee_id=autor),
   (select public.analyse_vorwahlland(phone) from public.profiles where id=new.user_id),delta_s,delta_d)
 on conflict(impression_id) do update set sichtungen=public.konto_sichtungen.sichtungen+delta_s,
   dauer_ms=public.konto_sichtungen.dauer_ms+delta_d;
 return new;
end $$;
revoke execute on function public.konto_sichtung_messen() from public,anon,authenticated;
drop trigger if exists konto_sichtung_messen on public.post_impressions;
create trigger konto_sichtung_messen after insert or update on public.post_impressions
for each row execute function public.konto_sichtung_messen();
-- Zähler/Bezüge ausschließlich vom Trigger; direkte DML zusätzlich zu RLS widerrufen.
drop trigger if exists spalten_fest on public.konto_sichtungen;
create trigger spalten_fest before update on public.konto_sichtungen for each row
execute function public.spalten_fest('impression_id','post_id','zuschauer','tag','folgt','land','sichtungen','dauer_ms');

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
    coalesce(sum(b.sichtungen),0) as aufrufe,count(distinct b.zuschauer) as reichweite
    from eigen e left join basis b on b.post_id=e.id group by e.id,e.title,e.description),
  interaktionen as (
    select l.user_id from public.post_likes l join eigen e on e.id=l.post_id where l.created_at>=ab::timestamptz and l.user_id<>ich
    union all select c.user_id from public.comments c join eigen e on e.id=c.post_id where c.created_at>=ab::timestamptz and c.user_id<>ich
    union all select s.user_id from public.saves s join eigen e on e.id=s.post_id where s.created_at>=ab::timestamptz and s.user_id<>ich
    union all select r.user_id from public.reposts r join eigen e on e.id=r.post_id where r.created_at>=ab::timestamptz and r.user_id<>ich
  )
  select jsonb_build_object('tage',tage,
    'reichweite',(select count(distinct zuschauer) from basis),
    'aufrufe',(select coalesce(sum(sichtungen),0) from basis),
    'followerAufrufe',(select coalesce(sum(sichtungen),0) from basis where folgt),
    'nichtFollowerAufrufe',(select coalesce(sum(sichtungen),0) from basis where not folgt),
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
