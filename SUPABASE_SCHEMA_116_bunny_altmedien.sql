-- 28.10.2026 — Nur Altmedienregistrierung auf dem live vorhandenen Schema 115.
-- Historische M4A-Dateien mit falschem JPEG-MIME dürfen bytegeprüft als audio/mp4 registriert werden.
-- Keine Voraussetzungen aus 107–114. Supabase-Dateien werden niemals gelöscht.
-- Ersetzt bunny_objekt_vorgaben und bunny_ursprung_frei aus 115.
-- Beispielmedien ohne Eigentümer bleiben gemeinsame, nicht löschbare Lesemedien.
-- Löschmarken verhindern, dass erhaltene Originale nach Bunny-DELETE wieder auftauchen.
begin;
alter table public.medien_objekte add column if not exists migriert_am timestamptz;
alter table public.medien_objekte add column if not exists geloescht_am timestamptz;
alter table public.medien_objekte alter column owner_id drop not null;
alter table public.medien_objekte drop constraint if exists medien_objekte_pfad_check;
alter table public.medien_objekte add constraint medien_objekte_pfad_check
  check (pfad !~ '\.\.' and pfad ~ '^(messages|stories|avatars|posts|insights|ptt|beispiel)/[A-Za-z0-9_-][A-Za-z0-9._-]*$');
alter table public.medien_objekte drop constraint if exists medien_objekte_owner_altbestand_check;
alter table public.medien_objekte add constraint medien_objekte_owner_altbestand_check
  check (owner_id is not null or (pfad like 'beispiel/%' and migriert_am is not null));

create or replace function public.bunny_objekt_vorgaben() returns trigger
language plpgsql security definer set search_path = public as $$
declare o storage.objects;
begin
  perform pg_advisory_xact_lock(hashtextextended(coalesce(new.owner_id::text,new.pfad),115));
  if new.migriert_am is not null then
    select * into o from storage.objects where bucket_id='media' and name=new.pfad for share;
    if not found or o.owner_id is distinct from new.owner_id::text or
       (new.owner_id is null and new.pfad not like 'beispiel/%') or
       (new.owner_id is not null and not public.profil_freigegeben(new.owner_id)) or
       (o.metadata->>'size')::bigint is distinct from new.bytes or
       (o.metadata->>'mimetype' is distinct from new.typ and not
         (new.pfad like 'ptt/%.m4a' and o.metadata->>'mimetype'='image/jpeg' and new.typ='audio/mp4')) then
      raise exception 'Kein passender Altbestand' using errcode='42501';
    end if;
    new.created_at := o.created_at;
    new.migriert_am := now();
    new.geloescht_am := null;
    return new;
  end if;
  if new.owner_id is null or not public.profil_freigegeben(new.owner_id) or
     new.pfad !~ ('^(messages|stories|avatars|posts|insights|ptt)/'||new.owner_id::text||'-') or
     (select count(*) from storage.objects where bucket_id='media' and owner_id=new.owner_id::text
       and created_at > now()-interval '1 day') +
     (select count(*) from public.medien_objekte where owner_id=new.owner_id
       and created_at > now()-interval '1 day') >= 300 then
    raise exception 'Upload derzeit nicht erlaubt' using errcode='42501';
  end if;
  new.created_at := now();
  new.geloescht_am := null;
  return new;
end $$;
revoke execute on function public.bunny_objekt_vorgaben() from public, anon, authenticated;

create or replace function public.medien_umzug_registrieren(p_pfad text,p_typ text,p_bytes bigint,p_sha256 text)
returns text language plpgsql security definer set search_path = public as $$
declare o storage.objects; e uuid; v public.medien_objekte;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_pfad,116));
  if p_pfad is null or p_pfad ~ '\.\.' or
     p_pfad !~ '^(messages|stories|avatars|posts|insights|ptt|beispiel)/[A-Za-z0-9_-][A-Za-z0-9._-]*$' or
     p_typ is null or p_typ not in ('image/jpeg','image/png','image/webp','video/mp4','audio/mp4') or
     p_bytes is null or p_bytes<=0 or p_bytes>52428800 or
     p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    return 'ausgelassen: ungültige Metadaten';
  end if;
  select * into v from public.medien_objekte where pfad=p_pfad;
  if found then
    return case when v.geloescht_am is not null then 'ausgelassen: bereits gelöscht'
      when v.sha256=p_sha256 and v.typ=p_typ and v.bytes=p_bytes then 'bunny'
      else 'ausgelassen: bereits mit anderem Inhalt registriert' end;
  end if;
  select * into o from storage.objects where bucket_id='media' and name=p_pfad for share;
  if not found then return 'ausgelassen: Quelle fehlt';end if;
  if (o.metadata->>'size')::bigint is distinct from p_bytes or
     (o.metadata->>'mimetype' is distinct from p_typ and not
       (p_pfad like 'ptt/%.m4a' and o.metadata->>'mimetype'='image/jpeg' and p_typ='audio/mp4')) then
    return 'ausgelassen: Quelle weicht ab';end if;
  if o.owner_id is not null then
    select id into e from public.profiles where id::text=o.owner_id;
    if e is null then return 'ausgelassen: kein eindeutiger Eigentümer';end if;
    if not public.profil_freigegeben(e) then return 'ausgelassen: Profil nicht freigegeben';end if;
  elsif p_pfad not like 'beispiel/%' then
    return 'ausgelassen: kein eindeutiger Eigentümer';
  end if;
  insert into public.medien_objekte(pfad,owner_id,typ,bytes,sha256,migriert_am)
    values(p_pfad,e,p_typ,p_bytes,p_sha256,now());
  return 'bunny';
end $$;
revoke execute on function public.medien_umzug_registrieren(text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.medien_umzug_registrieren(text,text,bigint,text) to service_role;

create or replace function public.bunny_ursprung_frei(p_pfad text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare o public.medien_objekte;
begin
  if auth.uid() is null then return false; end if;
  select * into o from public.medien_objekte where pfad=p_pfad;
  if not found then return true; end if;
  if o.geloescht_am is not null then return false; end if;
  if o.owner_id is null and o.pfad like 'beispiel/%' then return true; end if;
  return o.owner_id=auth.uid() or (public.profil_freigegeben(o.owner_id) and not public.blockiert_zwischen(o.owner_id,auth.uid()));
end $$;
revoke execute on function public.bunny_ursprung_frei(text) from public, anon;
grant execute on function public.bunny_ursprung_frei(text) to authenticated;

create or replace function public.bunny_umzug_loeschmarke() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.migriert_am is not null then
    update public.medien_objekte set geloescht_am=coalesce(geloescht_am,now()) where pfad=old.pfad;
    return null;
  end if;
  return old;
end $$;
revoke execute on function public.bunny_umzug_loeschmarke() from public, anon, authenticated;
drop trigger if exists bunny_umzug_loeschmarke on public.medien_objekte;
create trigger bunny_umzug_loeschmarke before delete on public.medien_objekte
  for each row execute function public.bunny_umzug_loeschmarke();
notify pgrst, 'reload schema';
commit;
