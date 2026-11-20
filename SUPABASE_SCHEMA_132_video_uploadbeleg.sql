-- Schema 132 — AF5 Reels bis 20 Minuten: Videodauer aus den Uploadbytes (Paket 9, 20.11.2026).
-- Entwurf 109 (+ Bunny-Teil aus 113) aus dem Sammelzweig, auf den Live-Stand
-- gebracht. Nach 115/117/131.
--
-- Der Server misst jedes Video für Beiträge mit ffprobe (web/server/videopruefung.js)
-- und hinterlegt die Sekunden als Dienstrolle:
--   Bunny (live seit 28.10.)  → public.medien_objekte.sekunden (Schema 115 + Spalte hier)
--   Supabase-Speicher (Rückweg) → public.video_upload_belege
-- Ein Video-Beitrag (reel/clip oder Videodatei) braucht einen solchen Beleg des
-- Verfassers; die Dauer kommt aus dem Beleg, nie vom Client. Grenze 1200 s.
-- Ohne Datei (media_url null), Beispielmedien und geschützte Demo-Vorlagen der
-- eigenen Testkonten sind kein Nutzerupload. Altbeiträge bleiben unberührt.

alter table public.medien_objekte add column if not exists sekunden double precision;
alter table public.medien_objekte drop constraint if exists medien_objekte_sekunden_check;
alter table public.medien_objekte add constraint medien_objekte_sekunden_check
  check (sekunden is null or (sekunden > 0 and sekunden <= 1200));

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

-- Belegte Supabase-Dateien weder überschreiben noch löschen-und-ersetzen.
create or replace function intern.video_belegt(p_pfad text) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.video_upload_belege where pfad=p_pfad);
$$;
revoke execute on function intern.video_belegt(text) from public,anon;
grant execute on function intern.video_belegt(text) to authenticated;
drop policy if exists video_upload_unveraenderlich on storage.objects;
create policy video_upload_unveraenderlich on storage.objects as restrictive for update to authenticated
using(not(bucket_id='media' and name like 'posts/%'))
with check(not(bucket_id='media' and name like 'posts/%'));
drop policy if exists post_upload_loeschsperre on storage.objects;
create policy post_upload_loeschsperre on storage.objects as restrictive for delete to authenticated
using(not(bucket_id='media' and name like 'posts/%' and intern.video_belegt(name)));

-- Auch privilegiertes Ersetzen entwertet einen früheren Beleg.
create or replace function public.video_beleg_entwerten() returns trigger
language plpgsql security definer set search_path=public as $$
begin delete from public.video_upload_belege where objekt_id=old.id;return new;end $$;
revoke execute on function public.video_beleg_entwerten() from public,anon,authenticated;
drop trigger if exists video_beleg_entwerten on storage.objects;
create trigger video_beleg_entwerten before update on storage.objects for each row execute function public.video_beleg_entwerten();

-- Typ und Eigenbeleg für Invoker-Auslöser (Karussell, Schema 133). Keine Metadatenzeilen.
create or replace function intern.medium_typ(p_pfad text) returns text
language sql stable security definer set search_path=public as $$
 select coalesce((select typ from public.medien_objekte where pfad=p_pfad),
   (select metadata->>'mimetype' from storage.objects where bucket_id='media' and name=p_pfad))
 where auth.uid() is not null;
$$;
revoke execute on function intern.medium_typ(text) from public,anon;
grant execute on function intern.medium_typ(text) to authenticated;

create or replace function intern.video_sekunden(p_pfad text, p_owner uuid) returns double precision
language sql stable security definer set search_path=public as $$
 select case when exists(select 1 from public.medien_objekte where pfad=p_pfad)
   then (select b.sekunden from public.medien_objekte b where b.pfad=p_pfad and b.owner_id=p_owner and b.typ like 'video/%')
   else (select b.sekunden from public.video_upload_belege b join storage.objects o on o.id=b.objekt_id
          where b.pfad=p_pfad and b.user_id=p_owner and o.owner_id=p_owner::text
            and b.bytes=(o.metadata->>'size')::bigint) end;
$$;
revoke execute on function intern.video_sekunden(text,uuid) from public,anon,authenticated;

create or replace function public.video_beleg_pruefen() returns trigger
language plpgsql security definer set search_path=public as $$
declare p text; video boolean; s double precision;
begin
 if tg_op='INSERT' and new.demo and public.ist_testkonto(new.user_id) then return new; end if;
 p := case when new.media_url like public.medien_adresse('')||'%'
           then substr(new.media_url, length(public.medien_adresse(''))+1) end;
 if tg_op='UPDATE' and new.media_url is not distinct from old.media_url and new.kind=old.kind then
   -- Andere Änderungen an Altbeiträgen bleiben möglich; belegte Dauer bleibt fest.
   if new.duration is distinct from old.duration and p is not null then
     s := intern.video_sekunden(p, new.user_id);
     if s is not null then new.duration := floor(s/60)::int::text||':'||lpad((floor(s)::int%60)::text,2,'0'); end if;
   end if;
   return new;
 end if;
 if new.media_url is null or p is null or split_part(p,'/',1)='beispiel' then return new; end if;
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
drop trigger if exists video_beleg_pruefen on public.posts;
create trigger video_beleg_pruefen before insert or update of media_url,kind,duration on public.posts
for each row execute function public.video_beleg_pruefen();

-- ------------------------------------------------------------ Nachweis --
do $$
begin
  if has_table_privilege('authenticated','public.video_upload_belege','select')
     or has_table_privilege('authenticated','public.video_upload_belege','insert') then
    raise exception 'Schema 132: Belege für Clients lesbar/schreibbar';
  end if;
  if has_function_privilege('authenticated','intern.video_sekunden(text,uuid)','execute')
     or has_function_privilege('authenticated','public.video_beleg_pruefen()','execute') then
    raise exception 'Schema 132: Belegfunktion direkt aufrufbar';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public'
                and table_name='medien_objekte' and column_name='sekunden') then
    raise exception 'Schema 132: medien_objekte.sekunden fehlt';
  end if;
end $$;
