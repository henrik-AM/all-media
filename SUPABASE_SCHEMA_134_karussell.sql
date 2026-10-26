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
  select auth.uid() is not null and case
    when exists(select 1 from public.medien_objekte b where b.pfad=$1)
    then exists(select 1 from public.medien_objekte b where b.pfad=$1 and b.owner_id=wer)
    else exists(select 1 from storage.objects o where o.bucket_id='media' and o.name=$1 and o.owner_id=wer::text)
  end;
$$;

revoke execute on function public.medium_besitzer_stimmt(text, uuid) from public, anon;
grant execute on function public.medium_besitzer_stimmt(text, uuid) to authenticated;


-- Bestehende Inhalts-RLS kann öffentliche Beiträge trotz Blockierung liefern.
-- Für neue Dateifreigaben zusätzlich den tatsächlichen Upload-Eigentümer prüfen.
create or replace function public.medium_ursprung_frei(p_pfad text) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare e uuid;alt text;
begin
 if auth.uid() is null then return false;end if;
 select owner_id into e from public.medien_objekte where pfad=p_pfad;
 if not found then
   select owner_id into alt from storage.objects where bucket_id='media' and name=p_pfad;
   if alt ~ '^[0-9a-f-]{36}$' then e:=alt::uuid;end if;
 end if;
 return e is null or e=auth.uid() or (public.profil_freigegeben(e) and not public.blockiert_zwischen(e,auth.uid()));
end $$;
revoke execute on function public.medium_ursprung_frei(text) from public,anon;
grant execute on function public.medium_ursprung_frei(text) to authenticated;
-- Keine Instant-Freigabe über andere Tabellen oder Eigentumsabkürzungen.
create or replace function public.medium_darf_lesen(p_pfad text) returns boolean
language sql stable security invoker set search_path=public as $$
 select auth.uid() is not null and public.konto_freigegeben() and p_pfad not like 'instants/%' and public.medium_ursprung_frei(p_pfad)
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
language sql stable security definer set search_path=public as $$
 select public.medium_anbieter(p_pfad) where auth.uid() is not null and public.konto_freigegeben()
 and public.medium_besitzer_stimmt(p_pfad,auth.uid())
 and not exists(select 1 from public.posts p where p.media_url=public.medien_adresse(p_pfad)
 or coalesce(to_jsonb(p)->'medien','[]'::jsonb) @> jsonb_build_array(jsonb_build_object('url',public.medien_adresse(p_pfad))));
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
   if found then new.duration:=floor(b.sekunden/60)::int::text||':'||lpad((floor(b.sekunden)::int%60)::text,2,'0');
   else select * into bm from public.medien_objekte where public.medien_adresse(pfad)=new.media_url;
   if bm.sekunden is not null then new.duration:=floor(bm.sekunden/60)::int::text||':'||lpad((floor(bm.sekunden)::int%60)::text,2,'0');end if;end if;
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

-- INVOKER-Trigger dürfen die privaten Belegtabellen nicht selbst lesen.
-- Helfer geben ausschließlich Typ bzw. booleschen Eigenbeleg zurück, keine Metadatenzeilen.
create or replace function public.medium_typ(p_pfad text) returns text
language sql stable security definer set search_path=public as $$
 select coalesce((select typ from public.medien_objekte where pfad=p_pfad),
 (select metadata->>'mimetype' from storage.objects where bucket_id='media' and name=p_pfad))
 where auth.uid() is not null;
$$;
revoke execute on function public.medium_typ(text) from public,anon;
grant execute on function public.medium_typ(text) to authenticated;
create or replace function public.medium_video_geprueft(p_pfad text,p_owner uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select auth.uid()=p_owner and case when exists(select 1 from public.medien_objekte where pfad=p_pfad)
 then exists(select 1 from public.medien_objekte b where b.pfad=p_pfad and b.owner_id=p_owner
   and b.typ='video/mp4' and b.sekunden is not null)
 else exists(select 1 from public.video_upload_belege b join storage.objects o on o.id=b.objekt_id
 where b.pfad=p_pfad and b.user_id=p_owner and o.owner_id=p_owner::text and b.bytes=(o.metadata->>'size')::bigint) end;
$$;
revoke execute on function public.medium_video_geprueft(text,uuid) from public,anon;
grant execute on function public.medium_video_geprueft(text,uuid) to authenticated;
-- JSON-Liste im selben INSERT wie der Beitrag: kein halbfertiges Karussell.
-- Keine feste Anzahl; HTTP-/Speichergrenzen gelten je Aufnahme weiterhin.
alter table public.posts add column if not exists medien jsonb not null default '[]'::jsonb;
create or replace function public.karussell_pruefen() returns trigger
language plpgsql security invoker set search_path=public as $$
declare m jsonb;p text;belegt boolean;dauer double precision;
begin
 if jsonb_typeof(new.medien)<>'array' then raise exception 'Ungültige Medienliste';end if;
 if jsonb_array_length(new.medien)=0 then return new;end if;
 if new.kind<>'post' then raise exception 'Eine Medienliste gehört zu einem Beitrag';end if;
 if tg_op='UPDATE' and new.medien=old.medien and new.user_id=old.user_id then
   new.media_url:=new.medien->0->>'url';return new;
 end if;
 for m in select value from jsonb_array_elements(new.medien) loop
   if jsonb_typeof(m)<>'object' or m->>'typ' not in ('image','video') or m->>'typ' is null
   or m->>'url' is null or not public.medien_adresse_gueltig(m->>'url')
   or exists(select 1 from jsonb_object_keys(m) k where k not in ('url','typ')) then
     raise exception 'Ungültiges Medium';end if;
   p:=substr(m->>'url',length(public.medien_adresse(''))+1);
   if p like 'instants/%' or (current_user='authenticated' and not public.medium_darf_lesen(p)) then
     raise exception 'Dieses Medium darfst du nicht verwenden' using errcode='42501';end if;
   -- Ein Video darf weder als Bild getarnt noch nur an zweiter Stelle versteckt sein.
   if m->>'typ'='video' or public.medium_typ(p) like 'video/%' or p ~* '\.(mp4|mov|m4v|webm)$' then
     if m->>'typ'<>'video' then raise exception 'Falscher Medientyp';end if;
     if not public.medium_video_geprueft(p,new.user_id) then
       raise exception 'Bitte das Video über die geprüfte Uploadstelle hochladen.' using errcode='42501';end if;
   elsif p !~* '\.(jpg|jpeg|png|webp)$' or public.medium_typ(p) not in ('image/jpeg','image/png','image/webp') then
     raise exception 'Falscher Medientyp';end if;
 end loop;
 new.media_url:=new.medien->0->>'url';return new;
end $$;
revoke execute on function public.karussell_pruefen() from public,anon,authenticated;
drop trigger if exists karussell_pruefen on public.posts;
create trigger karussell_pruefen before insert or update of medien,media_url,kind,user_id on public.posts
for each row execute function public.karussell_pruefen();
create or replace function public.medium_sichtbar(pfad text)
returns boolean
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  ordner text := split_part(pfad, '/', 1);
  adresse text := public.medien_adresse(pfad);
begin
  if ordner = 'beispiel' then
    return true;
  end if;
  if ordner = 'avatars' then
    return
      exists (select 1 from public.profiles p
              where p.avatar_url = adresse
                and public.medium_besitzer_stimmt(pfad, p.id))
      or exists (select 1 from public.communities c
                 where c.bild_url = adresse
                   and public.medium_besitzer_stimmt(pfad, c.created_by));
  end if;
  return
       exists (select 1 from public.stories where media_url = adresse)
    or exists (select 1 from public.posts where media_url = adresse or thumbnail_url = adresse
       or medien @> jsonb_build_array(jsonb_build_object('url',adresse)))
    or exists (select 1 from public.messages where media_url = adresse)
    or exists (select 1 from public.insights where media_url = adresse)
    or exists (select 1 from public.ptt_messages where audio_url = adresse)
    or exists (select 1 from public.community_channel_messages where media_url = adresse)
    or exists (select 1 from public.sammlungen where titelbild_url = adresse);
end;
$$;

revoke execute on function public.medium_sichtbar(text) from public, anon;
grant execute on function public.medium_sichtbar(text) to authenticated;


-- UPDATE nur der Liste ändert media_url im BEFORE-Trigger. UPDATE-OF-Trigger
-- richten sich nach der ursprünglichen SET-Liste, deshalb medien ausdrücklich aufnehmen.
drop trigger if exists video_beleg_pruefen on public.posts;
create trigger video_beleg_pruefen before insert or update of media_url,kind,duration,medien on public.posts
for each row execute function public.video_beleg_pruefen();
commit;
