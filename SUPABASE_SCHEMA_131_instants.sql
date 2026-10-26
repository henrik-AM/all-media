-- AF6 / Schema 111 — ENTWURF. Nach 110 und 107 (Medienbesitzerprüfung).
-- Kamera-Instants für festgeschriebene Enge Freunde; kein Jahresarchiv.
-- B2: Vorgabe bis Henriks Entscheidung. Zentral rückbaubar; nie nur Clientfilter.
-- Schema 52/58 entscheiden die Freigabe beider Konten; Schema 57 den Kontakt.
create or replace function public.instant_beziehung_erlaubt(p_freund uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and p_freund<>auth.uid()
 and public.konto_freigegeben() and public.profil_freigegeben(p_freund)
 and not public.blockiert_zwischen(auth.uid(),p_freund)
 and (public.messenger_erlaubt(auth.uid(),p_freund) or (
 exists(select 1 from public.follows where follower_id=auth.uid() and followee_id=p_freund)
 and exists(select 1 from public.follows where follower_id=p_freund and followee_id=auth.uid())));
$$;
revoke execute on function public.instant_beziehung_erlaubt(uuid) from public,anon;
grant execute on function public.instant_beziehung_erlaubt(uuid) to authenticated;
create table if not exists public.enge_freunde (
 user_id uuid not null references public.profiles(id) on delete cascade,
 freund_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,freund_id),check(user_id<>freund_id)
);
alter table public.enge_freunde enable row level security;
revoke all on public.enge_freunde from public,anon,authenticated;
grant select,insert,delete on public.enge_freunde to authenticated;
drop policy if exists eigene on public.enge_freunde;
create policy eigene on public.enge_freunde for all to authenticated using(user_id=auth.uid())
with check(user_id=auth.uid() and public.instant_beziehung_erlaubt(freund_id));

create table if not exists public.instants (
 id uuid primary key default gen_random_uuid(),
 absender uuid not null references public.profiles(id) on delete cascade,
 bild_pfad text not null unique, text text not null default '' check(length(text)<=100),
 created_at timestamptz not null default now(), expires_at timestamptz not null default(now()+interval '24 hours')
);
create table if not exists public.instant_empfaenger (
 instant_id uuid not null references public.instants(id) on delete cascade,
 empfaenger uuid not null references public.profiles(id) on delete cascade,
 geoeffnet_at timestamptz, primary key(instant_id,empfaenger)
);
create index if not exists instant_empfaenger_postfach on public.instant_empfaenger(empfaenger) where geoeffnet_at is null;
alter table public.instants enable row level security;
alter table public.instant_empfaenger enable row level security;
revoke all on public.instants,public.instant_empfaenger from public,anon,authenticated;
grant select on public.instants,public.instant_empfaenger to authenticated;
-- Keine direkten INSERT/UPDATE: IDs, Empfänger, Zeitstempel kommen nur aus RPCs.
create or replace function public.instant_zugang(p_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and public.konto_freigegeben() and exists(
 select 1 from public.instants i where i.id=p_id and i.expires_at>now()
 and public.profil_freigegeben(i.absender)
 and (i.absender=auth.uid() or exists(select 1 from public.instant_empfaenger e
 where e.instant_id=i.id and e.empfaenger=auth.uid() and e.geoeffnet_at is null
 and public.instant_beziehung_erlaubt(i.absender))));
$$;
revoke execute on function public.instant_zugang(uuid) from public,anon;
grant execute on function public.instant_zugang(uuid) to authenticated;
drop policy if exists sichtbar on public.instants;
create policy sichtbar on public.instants for select to authenticated using(public.instant_zugang(id));
drop policy if exists eigen on public.instant_empfaenger;
create policy eigen on public.instant_empfaenger for select to authenticated
using(empfaenger=auth.uid() and public.instant_zugang(instant_id));
do $$ declare t text;begin
 foreach t in array array['enge_freunde','instants','instant_empfaenger'] loop
 execute format('drop policy if exists nur_freigegebene on public.%I',t);
 execute format('create policy nur_freigegebene on public.%I as restrictive for all to authenticated using((select public.konto_freigegeben())) with check((select public.konto_freigegeben()))',t);
 end loop;
end $$;

create or replace function public.enge_freunde_vorgaben() returns trigger language plpgsql set search_path=public as $$
begin new.user_id:=auth.uid();new.created_at:=now();return new;end $$;
revoke execute on function public.enge_freunde_vorgaben() from public,anon,authenticated;
drop trigger if exists vorgaben on public.enge_freunde;
create trigger vorgaben before insert on public.enge_freunde for each row execute function public.enge_freunde_vorgaben();
drop trigger if exists spalten_fest on public.enge_freunde;
create trigger spalten_fest before update on public.enge_freunde for each row execute function public.spalten_fest('user_id','freund_id','created_at');
drop trigger if exists spalten_fest on public.instants;
create trigger spalten_fest before update on public.instants for each row execute function public.spalten_fest('id','absender','bild_pfad','text','created_at','expires_at');
drop trigger if exists spalten_fest on public.instant_empfaenger;
create trigger spalten_fest before update on public.instant_empfaenger for each row execute function public.spalten_fest('instant_id','empfaenger','geoeffnet_at');

-- CHECK-Listen erweitern, ohne Arten anderer Kästen zurückzudrehen.
do $$ declare c record;ausdruck text;spalte text;begin
 for c in select conname,pg_get_expr(conbin,conrelid) as expr from pg_constraint
 where conrelid='public.notifications'::regclass and contype='c'
 and conname in ('notifications_art_check','notifications_target_type_check') loop
  if position('instant' in c.expr)>0 then continue;end if;
  spalte:=case when c.conname='notifications_art_check' then 'art' else 'target_type' end;
  execute format('alter table public.notifications drop constraint %I',c.conname);
  execute format('alter table public.notifications add constraint %I check ((%s) or %I=''instant'')',c.conname,c.expr,spalte);
 end loop;
end $$;

create or replace function public.instant_empfaenger_liste() returns setof uuid
language sql stable security definer set search_path=public as $$
 select f.freund_id from public.enge_freunde f where f.user_id=auth.uid()
 and public.instant_beziehung_erlaubt(f.freund_id)
 and not exists(select 1 from public.user_settings s where s.user_id=f.freund_id
 and s.schluessel='instantsEmpfangen' and s.wert='aus');
$$;
revoke execute on function public.instant_empfaenger_liste() from public,anon,authenticated;
create or replace function public.instant_empfaengerzahl() returns integer
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.konto_freigegeben() then raise exception 'Konto nicht freigegeben';end if;
 return (select count(*)::integer from public.instant_empfaenger_liste());
end $$;
revoke execute on function public.instant_empfaengerzahl() from public,anon;
grant execute on function public.instant_empfaengerzahl() to authenticated;

create or replace function public.instant_senden(p_pfad text,p_text text default '') returns uuid
language plpgsql security definer set search_path=public as $$
declare ich uuid:=auth.uid(); neu uuid; an uuid; menge int:=0;
begin
 if ich is null or not public.konto_freigegeben() then raise exception 'Konto nicht freigegeben';end if;
 if p_pfad !~ ('^instants/'||ich::text||'/[A-Za-z0-9_-]+\.jpg$')
 or not public.medium_besitzer_stimmt(p_pfad,ich)
 or not exists(select 1 from storage.objects o where o.bucket_id='media' and o.name=p_pfad
     and (o.metadata->>'size')::bigint between 1 and 256000 and o.metadata->>'mimetype'='image/jpeg') then
 raise exception 'Nur ein eigenes Kamera-Foto bis 250 KB';end if;
 if length(coalesce(p_text,''))>100 then raise exception 'Höchstens 100 Zeichen';end if;
 insert into public.instants(absender,bild_pfad,text) values(ich,p_pfad,coalesce(p_text,'')) returning id into neu;
 for an in select public.instant_empfaenger_liste() loop
  insert into public.instant_empfaenger(instant_id,empfaenger) values(neu,an);
  perform public.mitteilung_anlegen(an,ich,'instant','videos','instant',neu);
  menge:=menge+1;
 end loop;
 if menge=0 then raise exception 'Keine berechtigten Empfänger. Prüfe deine Enge-Freunde-Liste.';end if;
 return neu;
end $$;
revoke execute on function public.instant_senden(text,text) from public,anon;
grant execute on function public.instant_senden(text,text) to authenticated;

drop function if exists public.instant_postfach();
create or replace function public.instant_postfach(p_ab integer default 0) returns table(id uuid,absender uuid,name text,text text,expires_at timestamptz)
language sql stable security invoker set search_path=public as $$
 select i.id,i.absender,p.name,i.text,i.expires_at from public.instants i
 join public.instant_empfaenger e on e.instant_id=i.id and e.empfaenger=auth.uid()
 join public.profiles p on p.id=i.absender where e.geoeffnet_at is null and i.expires_at>now() order by i.created_at,i.id limit 50 offset greatest(0,least(coalesce(p_ab,0),100000));
$$;
revoke execute on function public.instant_postfach(integer) from public,anon;
grant execute on function public.instant_postfach(integer) to authenticated;

-- Ein kleiner Standwert für das Badge, keine Namen oder Listen im Hintergrund.
create or replace function public.instant_stand() returns bigint
language sql stable security invoker set search_path=public as $$
 select count(*) from public.instants i join public.instant_empfaenger e on e.instant_id=i.id
 where e.empfaenger=auth.uid() and e.geoeffnet_at is null and i.expires_at>now();
$$;
revoke execute on function public.instant_stand() from public,anon;
grant execute on function public.instant_stand() to authenticated;

create or replace function public.instant_oeffnen(p_id uuid) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 if not public.instant_zugang(p_id) then raise exception 'Instant nicht mehr verfügbar';end if;
 update public.instant_empfaenger set geoeffnet_at=now() where instant_id=p_id and empfaenger=auth.uid() and geoeffnet_at is null;
 if not found then return false;end if;
 delete from public.notifications where user_id=auth.uid() and target_type='instant' and target_id=p_id;
 return true;
end $$;
revoke execute on function public.instant_oeffnen(uuid) from public,anon;
grant execute on function public.instant_oeffnen(uuid) to authenticated;

create or replace function public.instant_zurueckziehen(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.konto_freigegeben() then raise exception 'Konto nicht freigegeben';end if;
 update public.instants set expires_at=now() where id=p_id and absender=auth.uid();
 if not found then raise exception 'Nicht dein Instant';end if;
 delete from public.notifications where target_type='instant' and target_id=p_id;
end $$;
revoke execute on function public.instant_zurueckziehen(uuid) from public,anon;
grant execute on function public.instant_zurueckziehen(uuid) to authenticated;

-- Blockieren entfernt beide Listenrichtungen und vorhandene Empfängerrechte sofort.
create or replace function public.instants_bei_block() returns trigger language plpgsql security definer set search_path=public as $$
begin
 delete from public.enge_freunde where (user_id=new.user_id and freund_id=new.blocked_user_id) or (user_id=new.blocked_user_id and freund_id=new.user_id);
 delete from public.notifications n using public.instants i where n.target_type='instant' and n.target_id=i.id
 and ((i.absender=new.user_id and n.user_id=new.blocked_user_id) or (i.absender=new.blocked_user_id and n.user_id=new.user_id));
 delete from public.instant_empfaenger e using public.instants i where i.id=e.instant_id
 and ((i.absender=new.user_id and e.empfaenger=new.blocked_user_id) or (i.absender=new.blocked_user_id and e.empfaenger=new.user_id));
 return new;
end $$;
revoke execute on function public.instants_bei_block() from public,anon,authenticated;
drop trigger if exists instants_block on public.blocks;
create trigger instants_block after insert on public.blocks for each row execute function public.instants_bei_block();

-- Neue Speicherregel ergänzt 95; alle bisherigen Bedingungen bleiben erhalten.
drop policy if exists "Instant hochladen" on storage.objects;
create policy "Instant hochladen" on storage.objects for insert to authenticated with check(
 bucket_id='media' and name ~ ('^instants/'||auth.uid()::text||'/[A-Za-z0-9_-]+\.jpg$')
 and public.upload_kontingent_frei() and (metadata->>'size')::bigint between 1 and 256000
 and metadata->>'mimetype'='image/jpeg');
drop policy if exists "Instant lesen" on storage.objects;
create policy "Instant lesen" on storage.objects for select to authenticated using(
 bucket_id='media' and split_part(name,'/',1)='instants' and exists(
 select 1 from public.instants i where i.bild_pfad=name and public.instant_zugang(i.id)));
-- Andere Inhalte dürfen einen Instant-Pfad niemals erneut freigeben.
-- Zusätzliche RESTRICTIVE-Regel wirkt auch auf owner_id und medium_sichtbar aus 95/107.
drop policy if exists instant_nur_einmal on storage.objects;
create policy instant_nur_einmal on storage.objects as restrictive for select to authenticated using(
 bucket_id<>'media' or split_part(name,'/',1)<>'instants');
-- Direkte Downloads/Signaturen vollständig sperren: expiresIn ist clientseitig
-- frei wählbar. Nur der Server prüft die lesbare Instant-Zeile und signiert
-- anschließend als service_role mit festem TTL 60. Kein Schlüssel im Client.

-- Bereinigung: bytes zuerst über Storage-API löschen, erst dann Metadaten bestätigen.
-- Nur service_role (Server-Arbeiter); ohne konfigurierten Schlüssel keine automatische Löschzusage.
create or replace function public.instant_loeschkandidaten() returns table(id uuid,bild_pfad text)
language sql stable security definer set search_path=public as $$
 select * from (
 select i.id,i.bild_pfad from public.instants i where i.expires_at<=now()
 or not exists(select 1 from public.instant_empfaenger e where e.instant_id=i.id and e.geoeffnet_at is null)
 union all
 select null::uuid,o.name from storage.objects o where o.bucket_id='media'
 and o.name like 'instants/%' and o.created_at<now()-interval '24 hours'
 and not exists(select 1 from public.instants i where i.bild_pfad=o.name)
 ) q limit 100;
$$;
revoke execute on function public.instant_loeschkandidaten() from public,anon,authenticated;
grant execute on function public.instant_loeschkandidaten() to service_role;
create or replace function public.instant_loeschbestaetigen(p_ids uuid[]) returns void
language sql security definer set search_path=public as $$
 delete from public.notifications where target_type='instant' and target_id=any(p_ids);
 delete from public.instants where id=any(p_ids) and (expires_at<=now() or not exists(
 select 1 from public.instant_empfaenger e where e.instant_id=instants.id and e.geoeffnet_at is null));
$$;
revoke execute on function public.instant_loeschbestaetigen(uuid[]) from public,anon,authenticated;
grant execute on function public.instant_loeschbestaetigen(uuid[]) to service_role;

create or replace function public.enge_freunde_suche(p_suche text) returns table(id uuid,name text,handle text)
language sql stable security invoker set search_path=public as $$
 select p.id,p.name,p.handle from public.profiles p where length(trim(p_suche))>=2
 and p.name ilike '%'||replace(replace(left(trim(p_suche),80),'%','\%'),'_','\_')||'%'
 and public.instant_beziehung_erlaubt(p.id) order by p.name,p.id limit 20;
$$;
revoke execute on function public.enge_freunde_suche(text) from public,anon;
grant execute on function public.enge_freunde_suche(text) to authenticated;
