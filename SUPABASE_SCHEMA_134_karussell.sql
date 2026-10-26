-- 26.10.2026 — Schema 113, ENTWURF, NICHT EINGESPIELT.
-- Nach 107/109/111. 109 ist vergeben; 113 laut Bunny-Auftrag reserviert.
-- Bunny-Metadaten statt Schreibzugriff auf storage.objects. Keine Bytewanderung.
-- Ersetzt Helfer aus 107, Video-Trigger aus 109 und Instant-Helfer aus 111.
begin;
create table if not exists public.medien_objekte (
 pfad text primary key, owner_id uuid not null references public.profiles(id) on delete cascade,
 typ text not null, bytes bigint not null check(bytes>0 and bytes<=52428800),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 sekunden double precision check(sekunden>0 and sekunden<=1200),
 created_at timestamptz not null default now(),
 check(pfad !~ '\.\.' and (pfad ~ '^(messages|stories|avatars|posts|insights|ptt)/[A-Za-z0-9_-][A-Za-z0-9._-]*$'
 or pfad ~ '^instants/[0-9a-f-]{36}/[A-Za-z0-9_-]+\.jpg$')),
 check(typ in ('image/jpeg','image/png','image/webp','video/mp4','audio/mp4')),
 check(pfad not like 'instants/%' or (typ='image/jpeg' and bytes<=256000))
);
alter table public.medien_objekte enable row level security;
revoke all on public.medien_objekte from public,anon,authenticated;
grant select,insert,delete on public.medien_objekte to service_role;
drop policy if exists nur_freigegebene on public.medien_objekte;
create policy nur_freigegebene on public.medien_objekte as restrictive for all to authenticated
using((select public.konto_freigegeben())) with check((select public.konto_freigegeben()));
drop trigger if exists spalten_fest on public.medien_objekte;
create trigger spalten_fest before update on public.medien_objekte for each row
execute function public.spalten_fest('pfad','owner_id','typ','bytes','sha256','sekunden','created_at');
-- Kontingent über beide Anbieter, auch parallele Bunny-Abschlüsse serialisieren.
create or replace function public.upload_kontingent_frei() returns boolean
language sql stable security definer set search_path=public as $$
 select (select count(*) from storage.objects where bucket_id='media' and owner_id=auth.uid()::text
 and created_at>now()-interval '1 day') +
 (select count(*) from public.medien_objekte where owner_id=auth.uid() and created_at>now()-interval '1 day') < 300;
$$;
revoke execute on function public.upload_kontingent_frei() from public,anon;
grant execute on function public.upload_kontingent_frei() to authenticated;
create or replace function public.medium_upload_erlaubt() returns boolean
language sql stable security invoker set search_path=public as $$
 select auth.uid() is not null and public.konto_freigegeben() and public.upload_kontingent_frei();
$$;
revoke execute on function public.medium_upload_erlaubt() from public,anon;
grant execute on function public.medium_upload_erlaubt() to authenticated;
create or replace function public.medien_objekt_vorgaben() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text,113));
 if not public.profil_freigegeben(new.owner_id) or
 (select count(*) from public.medien_objekte where owner_id=new.owner_id and created_at>now()-interval '1 day')+
 (select count(*) from storage.objects where bucket_id='media' and owner_id=new.owner_id::text and created_at>now()-interval '1 day')>=300
 then raise exception 'Upload derzeit nicht erlaubt' using errcode='42501';end if;
 new.created_at:=now();return new;
end $$;
revoke execute on function public.medien_objekt_vorgaben() from public,anon,authenticated;
drop trigger if exists vorgaben on public.medien_objekte;
create trigger vorgaben before insert on public.medien_objekte for each row execute function public.medien_objekt_vorgaben();
create or replace function public.medium_besitzer_stimmt(pfad text, wer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from storage.objects o
    where o.bucket_id = 'media' and o.name = pfad and o.owner_id = wer::text
  ) or (auth.uid() is not null and exists(select 1 from public.medien_objekte b where b.pfad=$1 and b.owner_id=wer));
$$;

revoke execute on function public.medium_besitzer_stimmt(text, uuid) from public, anon;
grant execute on function public.medium_besitzer_stimmt(text, uuid) to authenticated;


-- Keine Instant-Freigabe über andere Tabellen oder Eigentumsabkürzungen.
create or replace function public.medium_darf_lesen(p_pfad text) returns boolean
language sql stable security invoker set search_path=public as $$
 select auth.uid() is not null and public.konto_freigegeben() and p_pfad not like 'instants/%'
 and (public.medium_besitzer_stimmt(p_pfad,auth.uid()) or public.medium_sichtbar(p_pfad));
$$;
revoke execute on function public.medium_darf_lesen(text) from public,anon;
grant execute on function public.medium_darf_lesen(text) to authenticated;
-- Anbieterbestimmung unter DEFINER, Leserecht ausdrücklich im Invoker davor.
create or replace function public.medium_anbieter(p_pfad text) returns text
language sql stable security definer set search_path=public as $$
 select case when exists(select 1 from public.medien_objekte where pfad=p_pfad) then 'bunny' else 'supabase' end;
$$;
revoke execute on function public.medium_anbieter(text) from public,anon;
grant execute on function public.medium_anbieter(text) to authenticated;
create or replace function public.medien_leseliste(p_pfade text[]) returns table(pfad text,anbieter text)
language sql stable security invoker set search_path=public as $$
 select distinct p,public.medium_anbieter(p) from unnest(p_pfade) p
 where cardinality(p_pfade)<=500 and public.medium_darf_lesen(p);
$$;
revoke execute on function public.medien_leseliste(text[]) from public,anon;
grant execute on function public.medien_leseliste(text[]) to authenticated;
create or replace function public.medium_loeschrecht(p_pfad text) returns text
language sql stable security invoker set search_path=public as $$
 select public.medium_anbieter(p_pfad) where auth.uid() is not null and public.konto_freigegeben()
 and public.medium_besitzer_stimmt(p_pfad,auth.uid());
$$;
revoke execute on function public.medium_loeschrecht(text) from public,anon;
grant execute on function public.medium_loeschrecht(text) to authenticated;
create or replace function public.medium_referenz_pruefen()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  spalte text;
  adresse text;
  pfad text;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  foreach spalte in array tg_argv loop
    adresse := to_jsonb(new) ->> spalte;
    if adresse is null then
      continue;
    end if;
    if tg_op = 'UPDATE' then
      if adresse is not distinct from (to_jsonb(old) ->> spalte) then
        continue;
      end if;
    end if;
    if not public.medien_adresse_gueltig(adresse) then
      raise exception 'Dieses Medium darfst du nicht verwenden';
    end if;
    pfad := substring(adresse from length(public.medien_adresse('')) + 1);
    if not public.medium_darf_lesen(pfad) then
      raise exception 'Dieses Medium darfst du nicht verwenden';
    end if;
  end loop;
  return new;
end;
$$;

revoke execute on function public.medium_referenz_pruefen() from public, anon, authenticated;

create or replace function public.video_beleg_pruefen() returns trigger
language plpgsql security definer set search_path=public as $$
declare p text;b public.video_upload_belege; o storage.objects; video boolean; bm public.medien_objekte;
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
 select * into bm from public.medien_objekte where pfad=p;
 if found then
   if bm.typ='video/mp4' or new.kind in ('reel','clip') then
     if bm.owner_id<>new.user_id or bm.sekunden is null then
       raise exception 'Bitte das Video über die geprüfte Uploadstelle hochladen.' using errcode='42501';end if;
     new.duration:=floor(bm.sekunden/60)::int::text||':'||lpad((floor(bm.sekunden)::int%60)::text,2,'0');
   end if;
   return new;
 end if;
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
create or replace function public.instant_senden(p_pfad text,p_text text default '') returns uuid
language plpgsql security definer set search_path=public as $$
declare ich uuid:=auth.uid(); neu uuid; an uuid; menge int:=0;
begin
 if ich is null or not public.konto_freigegeben() then raise exception 'Konto nicht freigegeben';end if;
 if p_pfad !~ ('^instants/'||ich::text||'/[A-Za-z0-9_-]+\.jpg$')
 or not public.medium_besitzer_stimmt(p_pfad,ich)
 or (not exists(select 1 from storage.objects o where o.bucket_id='media' and o.name=p_pfad
     and (o.metadata->>'size')::bigint between 1 and 256000 and o.metadata->>'mimetype'='image/jpeg')
 and not exists(select 1 from public.medien_objekte b where b.pfad=p_pfad and b.owner_id=ich and b.typ='image/jpeg' and b.bytes<=256000)) then
 raise exception 'Nur ein eigenes Kamera-Foto bis 250 KB';end if;
 if length(coalesce(p_text,''))>100 then raise exception 'Höchstens 100 Zeichen';end if;
 insert into public.instants(absender,bild_pfad,text) values(ich,p_pfad,coalesce(p_text,'')) returning id into neu;
 for an in select public.instant_empfaenger_liste() loop
  insert into public.instant_empfaenger(instant_id,empfaenger) values(neu,an);
  perform public.mitteilung_anlegen(an,ich,'instant','videos','instant',neu);
  menge:=menge+1;
 end loop;
 if menge=0 then raise exception 'Lege zuerst Enge Freunde an (mit Empfangsfreigabe).';end if;
 return neu;
end $$;
revoke execute on function public.instant_senden(text,text) from public,anon;
grant execute on function public.instant_senden(text,text) to authenticated;

create or replace function public.instant_loeschkandidaten() returns table(id uuid,bild_pfad text)
language sql stable security definer set search_path=public as $$
 select * from (
 select i.id,i.bild_pfad from public.instants i where i.expires_at<=now()
 or not exists(select 1 from public.instant_empfaenger e where e.instant_id=i.id and e.geoeffnet_at is null)
 union all
 select null::uuid,o.name from storage.objects o where o.bucket_id='media'
 and o.name like 'instants/%' and o.created_at<now()-interval '24 hours'
 and not exists(select 1 from public.instants i where i.bild_pfad=o.name)
 union all
 select null::uuid,b.pfad from public.medien_objekte b where b.pfad like 'instants/%' and b.created_at<now()-interval '24 hours'
 and not exists(select 1 from public.instants i where i.bild_pfad=b.pfad)
 ) q limit 100;
$$;
revoke execute on function public.instant_loeschkandidaten() from public,anon,authenticated;
grant execute on function public.instant_loeschkandidaten() to service_role;

commit;
