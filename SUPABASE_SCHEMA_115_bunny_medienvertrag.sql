-- 27.10.2026 — Isolierter Bunny-Vertrag, freigegeben im Auftrag bunny-live2.
-- Benötigt den bereits live vorhandenen Medienvertrag (medien_adresse,
-- medien_adresse_gueltig, medium_sichtbar) und Kontofreigabe aus Schema 52.
-- Keine Übernahme aus 107–114: kein Karussell, Instant, Video-Beleg oder Spende.
-- Supabase-Referenzen und ihre bestehenden Regeln bleiben unverändert.
begin;
create table if not exists public.medien_objekte (
  pfad text primary key,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  typ text not null check (typ in ('image/jpeg','image/png','image/webp','video/mp4','audio/mp4')),
  bytes bigint not null check (bytes > 0 and bytes <= 52428800),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  check (pfad !~ '\.\.' and pfad ~ '^(messages|stories|avatars|posts|insights|ptt)/[A-Za-z0-9_-][A-Za-z0-9._-]*$')
);
alter table public.medien_objekte enable row level security;
revoke all on public.medien_objekte from public, anon, authenticated;
grant select, insert, delete on public.medien_objekte to service_role;
drop policy if exists nur_freigegebene on public.medien_objekte;
create policy nur_freigegebene on public.medien_objekte as restrictive for all to authenticated
  using ((select public.konto_freigegeben())) with check ((select public.konto_freigegeben()));

create or replace function public.medium_upload_erlaubt() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.konto_freigegeben() and
    (select count(*) from storage.objects where bucket_id='media' and owner_id=auth.uid()::text
      and created_at > now()-interval '1 day') +
    (select count(*) from public.medien_objekte where owner_id=auth.uid()
      and created_at > now()-interval '1 day') < 300;
$$;
revoke execute on function public.medium_upload_erlaubt() from public, anon;
grant execute on function public.medium_upload_erlaubt() to authenticated;

-- Die Dienstrolle darf bestätigen, aber nur freigegebene Eigentümer und
-- zulässige Pfade. Kontingentprüfung auch nach parallelen Datei-Uploads.
create or replace function public.bunny_objekt_vorgaben() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text,115));
  if not public.profil_freigegeben(new.owner_id) or
     new.pfad !~ ('^(messages|stories|avatars|posts|insights|ptt)/'||new.owner_id::text||'-') or
     (select count(*) from storage.objects where bucket_id='media' and owner_id=new.owner_id::text
       and created_at > now()-interval '1 day') +
     (select count(*) from public.medien_objekte where owner_id=new.owner_id
       and created_at > now()-interval '1 day') >= 300 then
    raise exception 'Upload derzeit nicht erlaubt' using errcode='42501';
  end if;
  new.created_at := now();
  return new;
end $$;
revoke execute on function public.bunny_objekt_vorgaben() from public, anon, authenticated;
drop trigger if exists bunny_objekt_vorgaben on public.medien_objekte;
create trigger bunny_objekt_vorgaben before insert on public.medien_objekte
  for each row execute function public.bunny_objekt_vorgaben();

-- SECURITY INVOKER: Inhalts-RLS entscheidet bei jedem Signieraufruf erneut.
-- Der Definer-Helfer liefert nur Eigentümer/Anbieter, niemals Metadaten.
create or replace function public.bunny_eigenes_medium(p_pfad text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists(select 1 from public.medien_objekte where pfad=p_pfad and owner_id=auth.uid()) or
    (not exists(select 1 from public.medien_objekte where pfad=p_pfad) and
     exists(select 1 from storage.objects where bucket_id='media' and name=p_pfad and owner_id=auth.uid()::text)));
$$;
revoke execute on function public.bunny_eigenes_medium(text) from public, anon;
grant execute on function public.bunny_eigenes_medium(text) to authenticated;

create or replace function public.bunny_medium_anbieter(p_pfad text) returns text
language sql stable security definer set search_path = public as $$
  select case when exists(select 1 from public.medien_objekte where pfad=p_pfad) then 'bunny'
    when exists(select 1 from storage.objects where bucket_id='media' and name=p_pfad) then 'supabase' end
  where auth.uid() is not null;
$$;
revoke execute on function public.bunny_medium_anbieter(text) from public, anon;
grant execute on function public.bunny_medium_anbieter(text) to authenticated;

create or replace function public.bunny_ursprung_frei(p_pfad text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare e uuid;
begin
  if auth.uid() is null then return false; end if;
  select owner_id into e from public.medien_objekte where pfad=p_pfad;
  if not found then return true; end if;
  return e=auth.uid() or (public.profil_freigegeben(e) and not public.blockiert_zwischen(e,auth.uid()));
end $$;
revoke execute on function public.bunny_ursprung_frei(text) from public, anon;
grant execute on function public.bunny_ursprung_frei(text) to authenticated;

create or replace function public.bunny_medium_lesbar(p_pfad text) returns boolean
language sql stable security invoker set search_path = public as $$
  select auth.uid() is not null and public.konto_freigegeben()
    and p_pfad not like 'instants/%' and public.bunny_ursprung_frei(p_pfad)
    and (public.bunny_eigenes_medium(p_pfad) or
      case when p_pfad like 'avatars/%' and public.bunny_medium_anbieter(p_pfad)='bunny' then
        exists(select 1 from public.profiles where avatar_url=public.medien_adresse(p_pfad)) or
        exists(select 1 from public.communities c where to_jsonb(c)->>'bild_url'=public.medien_adresse(p_pfad))
      else public.medium_sichtbar(p_pfad) end);
$$;
revoke execute on function public.bunny_medium_lesbar(text) from public, anon;
grant execute on function public.bunny_medium_lesbar(text) to authenticated;

create or replace function public.medien_leseliste(p_pfade text[]) returns table(pfad text, anbieter text)
language sql stable security invoker set search_path = public as $$
  select distinct p, public.bunny_medium_anbieter(p) from unnest(p_pfade) p
  where cardinality(p_pfade)<=500 and public.bunny_medium_lesbar(p)
    and public.bunny_medium_anbieter(p) is not null;
$$;
revoke execute on function public.medien_leseliste(text[]) from public, anon;
grant execute on function public.medien_leseliste(text[]) to authenticated;

-- Auch unsichtbare Verwendungen schützen vor verwaisten Medienreferenzen.
create or replace function public.bunny_medium_referenziert(p_pfad text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.posts where media_url=public.medien_adresse(p_pfad) or thumbnail_url=public.medien_adresse(p_pfad))
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

create or replace function public.medium_loeschrecht(p_pfad text) returns text
language sql stable security definer set search_path = public as $$
  select public.bunny_medium_anbieter(p_pfad)
  where auth.uid() is not null and public.konto_freigegeben() and public.bunny_eigenes_medium(p_pfad)
    and not public.bunny_medium_referenziert(p_pfad);
$$;
revoke execute on function public.medium_loeschrecht(text) from public, anon;
grant execute on function public.medium_loeschrecht(text) to authenticated;

create or replace function public.bunny_referenz_pruefen() returns trigger
language plpgsql security invoker set search_path = public as $$
declare s text; adresse text; p text;
begin
  if current_user <> 'authenticated' then return new; end if;
  foreach s in array tg_argv loop
    adresse:=to_jsonb(new)->>s;
    if adresse is null then continue; end if;
    if tg_op='UPDATE' then
      if adresse is not distinct from (to_jsonb(old)->>s) then continue; end if;
    end if;
    if not public.medien_adresse_gueltig(adresse) then continue; end if;
    p:=substr(adresse,length(public.medien_adresse(''))+1);
    if public.bunny_medium_anbieter(p)='bunny' and not public.bunny_medium_lesbar(p) then
      raise exception 'Dieses Medium darfst du nicht verwenden' using errcode='42501';
    end if;
  end loop;
  return new;
end $$;
revoke execute on function public.bunny_referenz_pruefen() from public, anon, authenticated;
do $$
declare z record; spalten text; argumente text;
begin
  for z in select * from (values
    ('profiles',array['avatar_url']), ('communities',array['bild_url']),
    ('posts',array['media_url','thumbnail_url']), ('stories',array['media_url']),
    ('messages',array['media_url']), ('insights',array['media_url']),
    ('ptt_messages',array['audio_url']), ('community_channel_messages',array['media_url']),
    ('sammlungen',array['titelbild_url'])
  ) as t(tabelle,medien) loop
    select string_agg(quote_ident(s),', '),string_agg(quote_literal(s),', ') into spalten,argumente from unnest(z.medien) s
      where exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=z.tabelle and c.column_name=s);
    if spalten is null then continue; end if;
    execute format('drop trigger if exists bunny_referenz_pruefen on public.%I',z.tabelle);
    execute format('create trigger bunny_referenz_pruefen before insert or update of %s on public.%I for each row execute function public.bunny_referenz_pruefen(%s)',spalten,z.tabelle,argumente);
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
