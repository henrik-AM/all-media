-- 26.10.2026 — ENTWURF, nicht eingespielt. Nach 107; vor 110/111.
-- AF5/Befund 3: geprüfte Uploadbytes statt unbeglaubigter Clientdauer.
-- Nur der Serverdienst darf einen Beleg für einen unveränderlichen Upload schreiben.
create table if not exists public.video_upload_belege (
 objekt_id uuid primary key references storage.objects(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 pfad text not null unique,
 sekunden double precision not null check(sekunden>0 and sekunden<=1200),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 bytes bigint not null check(bytes>0 and bytes<=52428800),
 created_at timestamptz not null default now()
);
alter table public.video_upload_belege enable row level security;
revoke all on public.video_upload_belege from public,anon,authenticated;
grant select,insert,delete on public.video_upload_belege to service_role;
drop policy if exists nur_freigegebene on public.video_upload_belege;
create policy nur_freigegebene on public.video_upload_belege as restrictive for all to authenticated
using((select public.konto_freigegeben())) with check((select public.konto_freigegeben()));
drop trigger if exists spalten_fest on public.video_upload_belege;
create trigger spalten_fest before update on public.video_upload_belege for each row
execute function public.spalten_fest('objekt_id','user_id','pfad','sekunden','sha256','bytes','created_at');
-- Bereits beim INSERT unveränderlich; verhindert Austausch zwischen Upload und Beleg.
drop policy if exists video_upload_unveraenderlich on storage.objects;
create policy video_upload_unveraenderlich on storage.objects as restrictive for update to authenticated
using(not(bucket_id='media' and name ~* '^posts/.*\.(mp4|mov|m4v|webm)$'))
with check(not(bucket_id='media' and name ~* '^posts/.*\.(mp4|mov|m4v|webm)$'));
-- Auch privilegiertes Ersetzen entwertet einen früheren Beleg.
create or replace function public.video_beleg_entwerten() returns trigger
language plpgsql security definer set search_path=public as $$
begin delete from public.video_upload_belege where objekt_id=old.id;return new;end $$;
revoke execute on function public.video_beleg_entwerten() from public,anon,authenticated;
drop trigger if exists video_beleg_entwerten on storage.objects;
create trigger video_beleg_entwerten before update on storage.objects for each row execute function public.video_beleg_entwerten();
create or replace function public.video_beleg_pruefen() returns trigger
language plpgsql security definer set search_path=public as $$
declare p text;b public.video_upload_belege; o storage.objects; video boolean;
begin
 -- Geschützte Demo-Vorlagen der eigenen Testkonten sind kein Nutzerupload.
 -- Schema 95 anlegen_vorgaben läuft alphabetisch vorher und erzwingt bei
 -- direktem authenticated-INSERT demo=false. Kein Client kann sich ausnehmen.
 if tg_op='INSERT' and new.demo and public.ist_testkonto(new.user_id) then return new;end if;
 if tg_op='UPDATE' and new.media_url is not distinct from old.media_url and new.kind=old.kind then
  -- Andere Altbeitragsänderungen bleiben möglich; keine rückwirkende Zertifizierung.
  if new.duration is distinct from old.duration then
   select * into b from public.video_upload_belege where public.medien_adresse(pfad)=new.media_url;
   if found then new.duration:=floor(b.sekunden/60)::int::text||':'||lpad((floor(b.sekunden)::int%60)::text,2,'0');end if;
  end if;
  return new;
 end if;
 -- Laufende Streams haben keine hochgeladene Videodatei. Ein dateiloser Stream
 -- liefert damit auch keinen Weg, eine ungeprüfte Videodatei zu referenzieren.
 if new.kind='clip' and new.format='live' and new.media_url is null then return new;end if;
 p:=case when new.media_url like public.medien_adresse('')||'%' then substr(new.media_url,length(public.medien_adresse(''))+1) end;
 select * into o from storage.objects where bucket_id='media' and name=p;
 video:=new.kind in ('reel','clip') or coalesce(o.metadata->>'mimetype','') like 'video/%' or coalesce(new.media_url,'') ~* '\.(mp4|mov|m4v|webm)([?#].*)?$';
 if not video then return new;end if;
 select * into b from public.video_upload_belege where objekt_id=o.id and pfad=p and user_id=new.user_id
 and o.owner_id=new.user_id::text and bytes=(o.metadata->>'size')::bigint;
 if b.objekt_id is null then raise exception 'Bitte das Video über die geprüfte Uploadstelle hochladen.' using errcode='42501';end if;
 new.duration:=floor(b.sekunden/60)::int::text||':'||lpad((floor(b.sekunden)::int%60)::text,2,'0');
 return new;
end $$;
revoke execute on function public.video_beleg_pruefen() from public,anon,authenticated;
drop trigger if exists video_beleg_pruefen on public.posts;
create trigger video_beleg_pruefen before insert or update of media_url,kind,duration on public.posts
for each row execute function public.video_beleg_pruefen();
