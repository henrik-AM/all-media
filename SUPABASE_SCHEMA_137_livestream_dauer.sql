-- Schema 137 — Livestream-Dauer vollständig und wiederholbar aus dem Startzeitpunkt berechnen. Nach 136.

create or replace function public.video_beleg_pruefen() returns trigger
language plpgsql security definer set search_path=public as $$
declare p text; video boolean; s double precision; live_sekunden bigint; live_minuten bigint;
begin
 if tg_op='INSERT' and new.demo and public.ist_testkonto(new.user_id) then return new; end if;
 p := case when new.media_url like public.medien_adresse('')||'%'
           then substr(new.media_url, length(public.medien_adresse(''))+1) end;
 -- Schema 135 (vor dem Update-Sonderfall): ohne Datei keine behauptete Dauer (Ausnahme Livestream-Platzhalter).
 if new.media_url is null then
   if tg_op='UPDATE' and old.format='live' and new.format='standard' and new.kind='clip' then
     live_sekunden := greatest(0, floor(extract(epoch from now()-old.created_at)))::bigint;
     live_minuten := live_sekunden / 60;
     new.duration := case when live_minuten < 10 then '0' else '' end
                     || live_minuten::text || ':' || lpad((live_sekunden % 60)::text, 2, '0');
   elsif new.kind in ('reel','clip') and coalesce(new.format,'')<>'live' then
     -- Eine einmal berechnete Livestream-Dauer bleibt bei Wiederholung erhalten.
     -- Neue Videos ohne Datei erhalten weiterhin keine Client-Dauer.
     if tg_op='UPDATE' and old.media_url is null
        and old.kind='clip' and new.kind='clip'
        and old.format='standard' and new.format='standard' then
       new.duration := old.duration;
     else
       new.duration := null;
     end if;
   end if;
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

drop trigger if exists video_beleg_pruefen on public.posts;
create trigger video_beleg_pruefen before insert or update of media_url,kind,duration,format on public.posts
for each row execute function public.video_beleg_pruefen();
