-- =============================================================================
--  SCHEMA 125 — Restliche Regel-Helfer aus der öffentlichen API (09.11.2026)
-- =============================================================================
--
--  Fortsetzung von Schema 123. Gemessen 09.11.: Weitere security-definer-
--  Helfer, die RLS-Regeln brauchen, waren für jedes angemeldete Konto per
--  POST /rest/v1/rpc/<name> aufrufbar und beantworteten Fragen über FREMDE
--  Konten, Beiträge, Storys und Chats, z. B.:
--
--    story_eigner(story)                → Verfasser jeder Story
--    blockiert_zwischen(ich, x)         → ob x mich blockiert hat
--    sichtbar_fuer(x, feld, y)          → Sichtbarkeitsstufen/Ausnahmen Dritter
--    ist_story_markiert(story, x)       → wer in einer Story markiert ist
--    ist_messenger_kontakt(x, ich)      → Kontaktliste anderer
--    gesperrt(x, bereich)               → Moderationssperren anderer
--    profil_freigegeben(x)              → Kontostand anderer (z. B. wartendes Kinderkonto)
--    darf_markieren / darf_story_markieren / darf_kommentieren /
--    darf_schreiben / darf_mitglied_werden / darf_in_gruppe_holen
--                                       → Verfasser-, Einstellungs-, Blockier-Orakel
--    community_ausgeblendet / kanal_ausgeblendet → Moderationsorakel
--    kanal_antwort_erlaubt / kommentar_antwort_erlaubt / live_antwort_erlaubt
--                                       → Existenz fremder Nachrichten/Kommentare
--
--  Behebung (drei Wege):
--  A  Nur von Regeln genutzt, kein anderer Funktionsrumpf ruft sie:
--     ALTER FUNCTION … SET SCHEMA intern. Regeln hängen an der OID und folgen.
--     darf_mitglied_werden (security invoker) ruft danach intern.*.
--  B  Auch von anderen (security-definer-)Funktionen gerufen: Hülle
--     intern.<f> (definer) → public.<f>; Regeln auf die Hülle umstellen;
--     EXECUTE auf public.<f> für authenticated entziehen. Definer-Aufrufer
--     laufen als postgres und dürfen weiter.
--  C  Von App/Website per RPC gebraucht: im Rumpf auf das eigene Konto
--     beschränken (anfrage_erlaubt, darf_angeschrieben_werden).
--
--  Kein App-/Website-Code ruft A/B per RPC (geprüft 09.11.).
-- =============================================================================

create schema if not exists intern;
revoke all on schema intern from public, anon;
grant usage on schema intern to authenticated;

-- ---------------------------------------------------------------- A: verschieben

do $$
declare f text;
begin
  foreach f in array array[
    'story_eigner(uuid)', 'darf_story_markieren(uuid,uuid,uuid)', 'darf_markieren(uuid,uuid,uuid)',
    'darf_kommentieren(uuid,uuid)', 'darf_schreiben(uuid,uuid)', 'darf_mitglied_werden(uuid,uuid)',
    'darf_in_gruppe_holen(uuid)', 'community_ausgeblendet(uuid)', 'kanal_ausgeblendet(uuid)',
    'kanal_antwort_erlaubt(uuid,uuid)', 'kommentar_antwort_erlaubt(uuid,uuid,uuid)',
    'live_antwort_erlaubt(uuid,uuid)'] loop
    if to_regprocedure('public.' || f) is not null then
      execute format('alter function public.%s set schema intern', f);
    end if;
    execute format('revoke execute on function intern.%s from public, anon', f);
    execute format('grant execute on function intern.%s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------- B: Hüllen

create or replace function intern.sichtbar_fuer(eigner uuid, feld text, betrachter uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.sichtbar_fuer(eigner, feld, betrachter) $$;

create or replace function intern.blockiert_zwischen(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.blockiert_zwischen(a, b) $$;

create or replace function intern.ist_story_markiert(ziel_story uuid, wer uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.ist_story_markiert(ziel_story, wer) $$;

create or replace function intern.ist_messenger_kontakt(eigner uuid, betrachter uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.ist_messenger_kontakt(eigner, betrachter) $$;

-- Einstellige Fassung (nur eigenes Konto) bleibt öffentlich; die Hülle gibt es,
-- damit das Umschreiben der Regeln beide Fassungen findet.
create or replace function intern.ist_messenger_kontakt(k uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.ist_messenger_kontakt(k) $$;

create or replace function intern.gesperrt(wer uuid, wo text default 'videos')
returns boolean language sql stable security definer set search_path = public
as $$ select public.gesperrt(wer, wo) $$;

create or replace function intern.profil_freigegeben(p_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.profil_freigegeben(p_user) $$;

do $$
declare
  f text;
  r record;
  muster text := '(^|[^.[:alnum:]_])(sichtbar_fuer|blockiert_zwischen|ist_story_markiert|ist_messenger_kontakt|gesperrt|profil_freigegeben)\(';
  q text; w text; befehl text;
begin
  foreach f in array array[
    'sichtbar_fuer(uuid,text,uuid)', 'blockiert_zwischen(uuid,uuid)', 'ist_story_markiert(uuid,uuid)',
    'ist_messenger_kontakt(uuid,uuid)', 'ist_messenger_kontakt(uuid)', 'gesperrt(uuid,text)',
    'profil_freigegeben(uuid)'] loop
    execute format('revoke execute on function intern.%s from public, anon', f);
    execute format('grant execute on function intern.%s to authenticated', f);
  end loop;

  -- Regeln umstellen (ALTER POLICY behält Rollen, Befehl und Art).
  for r in
    select c.relnamespace::regnamespace::text as schema_name, c.relname, p.polname,
           pg_get_expr(p.polqual, p.polrelid) as q, pg_get_expr(p.polwithcheck, p.polrelid) as w
      from pg_policy p join pg_class c on c.oid = p.polrelid
     where coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ~ muster
  loop
    q := regexp_replace(r.q, muster, '\1intern.\2(', 'g');
    w := regexp_replace(r.w, muster, '\1intern.\2(', 'g');
    befehl := format('alter policy %I on %I.%I', r.polname, r.schema_name, r.relname);
    if q is not null then befehl := befehl || ' using (' || q || ')'; end if;
    if w is not null then befehl := befehl || ' with check (' || w || ')'; end if;
    execute befehl;
  end loop;

  -- Öffentliche Fassungen nur noch für Definer-Aufrufer (Eigentümer postgres).
  foreach f in array array[
    'sichtbar_fuer(uuid,text,uuid)', 'blockiert_zwischen(uuid,uuid)', 'ist_story_markiert(uuid,uuid)',
    'ist_messenger_kontakt(uuid,uuid)', 'gesperrt(uuid,text)', 'profil_freigegeben(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- darf_mitglied_werden ist security invoker (prüft current_user) und läuft
-- in der Regel als authenticated — es muss die intern-Fassungen rufen.
do $$
declare d text := pg_get_functiondef('intern.darf_mitglied_werden(uuid,uuid)'::regprocedure);
begin
  d := replace(d, 'public.blockiert_zwischen(', 'intern.blockiert_zwischen(');
  d := replace(d, 'public.darf_in_gruppe_holen(', 'intern.darf_in_gruppe_holen(');
  execute d;
end $$;

-- ---------------------------------------------------------------- C: aufs eigene Konto

-- App/Website fragen vor dem Senden (aktionen.ts, sync-handlers.js) — immer
-- für sich selbst in einem eigenen Chat. Für fremde Chats/Absender: false.
create or replace function public.anfrage_erlaubt(ziel_chat uuid, absender uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  zustand text;
  von uuid;
begin
  if absender is distinct from auth.uid() or not public.is_chat_member(ziel_chat) then
    return false;
  end if;

  select anfrage_zustand, anfrage_von into zustand, von
    from public.chats where id = ziel_chat;

  if zustand is null then
    return false;              -- Chat nicht gefunden: im Zweifel nein.
  end if;

  -- Die angeschriebene Person darf immer. Ihre Antwort IST die Annahme.
  if von is null or von <> absender then
    return true;
  end if;

  if zustand = 'wartet' then
    -- Genau eine. Die zweite erst nach der Annahme.
    return not exists (
      select 1 from public.messages
       where chat_id = ziel_chat and sender_id = absender
    );
  end if;

  -- Abgelehnt heißt abgelehnt.
  if zustand = 'abgelehnt' then
    return false;
  end if;

  return true;
end;
$$;

-- App/Website fragen „darf ich X anschreiben" — nur für sich selbst.
create or replace function public.darf_angeschrieben_werden(inhaber uuid, wer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is not null and wer is distinct from auth.uid() then false
              else public.sichtbar_fuer(inhaber, 'dm', wer) end;
$$;

revoke execute on function public.anfrage_erlaubt(uuid, uuid) from public, anon;
grant execute on function public.anfrage_erlaubt(uuid, uuid) to authenticated;
revoke execute on function public.darf_angeschrieben_werden(uuid, uuid) from public, anon;
grant execute on function public.darf_angeschrieben_werden(uuid, uuid) to authenticated;
