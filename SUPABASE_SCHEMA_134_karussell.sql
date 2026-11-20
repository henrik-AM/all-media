-- Schema 134 — AF4 gemischte Karussells (Paket 9, 20.11.2026).
-- Karussell-Teil des Entwurfs 113 aus dem Sammelzweig; dessen Bunny-Vertrag ist
-- seit Schema 115 live und wird hier NICHT erneut angelegt. Nach 128/132.
--
-- posts.medien: geordnete Liste {url, typ: image|video}, beliebig viele.
-- media_url = erstes Medium (Altclients, Raster, Vorschau laufen weiter).
-- Jedes Medium wie eine Medienspalte: eigene Adresse (Schema 95/118), selbst
-- hochgeladen (Schema 117), Videos mit Byte-Beleg (Schema 132), keine Instants.
-- medium_sichtbar (Fassung 128) kennt zusätzlich die Listen, damit Leser auch
-- das zweite bis n-te Medium signiert bekommen (Supabase und Bunny, 115).

alter table public.posts add column if not exists medien jsonb not null default '[]'::jsonb;
create index if not exists posts_medien_gin on public.posts using gin (medien jsonb_path_ops);

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
   if p like 'instants/%' then raise exception 'Dieses Medium darfst du nicht verwenden' using errcode='42501'; end if;
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

-- Nur boolesch und nur für das eigene Konto: kein Orakel über fremde Dateien.
create or replace function intern.video_geprueft(p_pfad text, p_owner uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select auth.uid()=p_owner and intern.video_sekunden(p_pfad,p_owner) is not null;
$$;
revoke execute on function intern.video_geprueft(text,uuid) from public,anon;
grant execute on function intern.video_geprueft(text,uuid) to authenticated;

drop trigger if exists karussell_pruefen on public.posts;
create trigger karussell_pruefen before insert or update of medien,media_url,kind,user_id on public.posts
for each row execute function public.karussell_pruefen();

-- UPDATE nur der Liste ändert media_url im BEFORE-Auslöser; UPDATE-OF-Auslöser
-- richten sich nach der SET-Liste, deshalb medien ausdrücklich aufnehmen.
drop trigger if exists video_beleg_pruefen on public.posts;
create trigger video_beleg_pruefen before insert or update of media_url,kind,duration,medien on public.posts
for each row execute function public.video_beleg_pruefen();
drop trigger if exists medienreferenz_pruefen on public.posts;
create trigger medienreferenz_pruefen before insert or update of media_url, thumbnail_url, medien on public.posts
for each row execute function public.medienreferenz_pruefen('media_url', 'thumbnail_url');

-- Fassung aus Schema 128, neu nur die Medienliste der Beiträge.
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
  -- Profil- und Communitybilder sind öffentlich, Kontaktfotos nicht.
  -- SECURITY INVOKER: die Tabellen-RLS des Lesers entscheidet mit.
  if ordner = 'avatars' then
    return
         exists (select 1 from public.profiles where avatar_url = adresse)
      or exists (select 1 from public.communities where bild_url = adresse);
  end if;
  return
       exists (select 1 from public.stories where media_url = adresse)
    or exists (select 1 from public.posts
                where media_url = adresse or thumbnail_url = adresse
                   or medien @> jsonb_build_array(jsonb_build_object('url', adresse)))
    or exists (select 1 from public.messages where media_url = adresse)
    or exists (select 1 from public.insights where media_url = adresse)
    or exists (select 1 from public.ptt_messages where audio_url = adresse)
    or exists (select 1 from public.community_channel_messages where media_url = adresse)
    or exists (select 1 from public.sammlungen where titelbild_url = adresse);
end;
$$;

revoke execute on function public.medium_sichtbar(text) from public, anon;
grant execute on function public.medium_sichtbar(text) to authenticated;

-- Fassung aus Schema 115, neu nur die Medienliste: ein Medium an zweiter
-- Stelle eines Karussells darf nicht als „unbenutzt" gelöscht werden.
create or replace function public.bunny_medium_referenziert(p_pfad text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.posts where media_url=public.medien_adresse(p_pfad) or thumbnail_url=public.medien_adresse(p_pfad)
                  or medien @> jsonb_build_array(jsonb_build_object('url',public.medien_adresse(p_pfad))))
    or exists(select 1 from public.stories where media_url=public.medien_adresse(p_pfad))
    or exists(select 1 from public.messages where media_url=public.medien_adresse(p_pfad))
    or exists(select 1 from public.insights where media_url=public.medien_adresse(p_pfad))
    or exists(select 1 from public.ptt_messages where audio_url=public.medien_adresse(p_pfad))
    or exists(select 1 from public.community_channel_messages where media_url=public.medien_adresse(p_pfad))
    or exists(select 1 from public.sammlungen where titelbild_url=public.medien_adresse(p_pfad))
    or exists(select 1 from public.profiles where avatar_url=public.medien_adresse(p_pfad))
    or exists(select 1 from public.communities c where to_jsonb(c)->>'bild_url'=public.medien_adresse(p_pfad));
$$;
revoke execute on function public.bunny_medium_referenziert(text) from public, anon;
grant execute on function public.bunny_medium_referenziert(text) to authenticated;


-- ------------------------------------------------------------ Nachweis --
do $$
begin
  if position('medien @>' in pg_get_functiondef('public.medium_sichtbar(text)'::regprocedure)) = 0 then
    raise exception 'Schema 134: medium_sichtbar ohne Medienliste';
  end if;
  if position('profiles' in pg_get_functiondef('public.medium_sichtbar(text)'::regprocedure)) = 0
     or position('avatar_url' in pg_get_functiondef('public.medium_sichtbar(text)'::regprocedure)) = 0 then
    raise exception 'Schema 134: Avatar-Regel aus 128 fehlt';
  end if;
  if has_function_privilege('anon','public.medium_sichtbar(text)','execute') then
    raise exception 'Schema 134: anon darf medium_sichtbar';
  end if;
  if not exists(select 1 from pg_trigger where tgname='karussell_pruefen' and tgrelid='public.posts'::regclass) then
    raise exception 'Schema 134: Karussellprüfung fehlt';
  end if;
  if position('medien @>' in pg_get_functiondef('public.bunny_medium_referenziert(text)'::regprocedure)) = 0 then
    raise exception 'Schema 134: Löschschutz ohne Medienliste';
  end if;
end $$;

notify pgrst, 'reload schema';
