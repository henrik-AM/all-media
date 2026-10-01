-- ===========================================================================
--  SUPABASE_SCHEMA_78_stumm_mitteilungen.sql            (Kasten 20.2, 01.10.2026)
--  Stummgeschaltete Konten, Communitys und Chats lösen keine Mitteilung aus
-- ===========================================================================
--
--  WARUM
--
--  Henrik am 01.10.2026: „Stummgeschaltete Konten lösen keine Nachrichten
--  aus."
--
--  Es gibt drei Stummschaltungen, alle je Person gespeichert:
--
--    1. Konto stumm      public.mutes (user_id, muted_user_id)       Schema 2
--    2. Community stumm  public.community_members.is_muted           Schema 15
--                        („Diese Community schickt mir keine Mitteilungen")
--    3. Chat stumm       public.chat_members.is_muted                Schema 2
--
--  Die Glocke füllt sich nur über zwei Funktionen, die Auslöser rufen:
--
--    - mitteilung_anlegen()  (Schema 44; gerufen von Schema 44, 49, 57, 68)
--    - benachrichtige()      (Schema 2/23_audit; heute nur noch das Folgen
--                             in on_contact, Schema 44/57)
--
--  Keine der beiden sah bisher in eine der drei Stummschaltungen. Wer ein
--  Konto stummgeschaltet hatte, bekam trotzdem „X gefällt dein Beitrag",
--  „X folgt dir jetzt", Markierungen, Story-Herzen; wer eine Community
--  stummgeschaltet hatte, trotzdem jeden Beitritt; wer einen Chat
--  stummgeschaltet hatte, trotzdem die Anfrage-Mitteilungen dazu.
--
--  WAS DIESE DATEI ÄNDERT
--
--  Beide Funktionen prüfen vor dem INSERT eine gemeinsame Regel
--  `mitteilung_stumm(an, von, zielart, ziel)`:
--
--    - hat der Empfänger den Auslöser stummgeschaltet → keine Mitteilung
--    - geht es um eine Community (zielart 'community'), die der Empfänger
--      stummgeschaltet hat → keine Mitteilung
--    - geht es um einen Chat (zielart 'chat'), den der Empfänger
--      stummgeschaltet hat → keine Mitteilung
--
--  Eine Regel an EINER Stelle in der Datenbank, nicht in App und Website —
--  sonst liefen beide auseinander (Merkregel „Schalter gehören in die
--  Datenbank").
--
--  WAS SIE NICHT ÄNDERT
--
--    - Schon vorhandene Mitteilungen bleiben stehen. Stummschalten wirkt ab
--      dem Zeitpunkt, an dem es gesetzt ist — wie auf jedem Handy.
--    - Blockieren ist etwas anderes und bleibt, wie es ist.
--    - Signaturen und Rückgabe beider Funktionen bleiben gleich, kein
--      Auslöser muss neu angelegt werden.
--
--  RECHTE
--
--  Die neue Hilfsfunktion und beide geänderten verlieren EXECUTE für
--  public, anon, authenticated (Postgres gibt es sonst automatisch an
--  PUBLIC, siehe Schema 37). Auslöser laufen als Eigentümer und brauchen es
--  nicht. Danach `npm run test:rechte`.
--
--  Idempotent: nur `create or replace` und `revoke`.
--
--  Einspielen:
--    SUPABASE_TOKEN=... node tools/sql-einspielen.mjs \
--      SUPABASE_SCHEMA_78_stumm_mitteilungen.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  Die gemeinsame Regel
-- ---------------------------------------------------------------------------

create or replace function public.mitteilung_stumm(
  p_an       uuid,
  p_von      uuid,
  p_zielart  text,
  p_ziel     uuid
)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select
    exists (select 1 from public.mutes m
             where m.user_id = p_an and m.muted_user_id = p_von)
    or (p_zielart = 'community' and p_ziel is not null and exists (
          select 1 from public.community_members cm
           where cm.community_id = p_ziel and cm.user_id = p_an and cm.is_muted))
    or (p_zielart = 'chat' and p_ziel is not null and exists (
          select 1 from public.chat_members ch
           where ch.chat_id = p_ziel and ch.user_id = p_an and coalesce(ch.is_muted, false)));
$$;

revoke execute on function public.mitteilung_stumm(uuid, uuid, text, uuid)
  from public, anon, authenticated;


-- ---------------------------------------------------------------------------
--  mitteilung_anlegen — wie Schema 44, plus die Regel
-- ---------------------------------------------------------------------------

create or replace function public.mitteilung_anlegen(
  p_an       uuid,
  p_von      uuid,
  p_art      text,
  p_bereich  text,
  p_zielart  text,
  p_ziel     uuid
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_an is null or p_von is null or p_an = p_von then
    return;
  end if;

  -- Kasten 20.2: stummgeschaltetes Konto, stumme Community, stummer Chat.
  if public.mitteilung_stumm(p_an, p_von, p_zielart, p_ziel) then
    return;
  end if;

  insert into public.notifications (user_id, actor_id, art, bereich, target_type, target_id)
  values (p_an, p_von, p_art, p_bereich, p_zielart, p_ziel);
end $$;

revoke execute on function public.mitteilung_anlegen(uuid, uuid, text, text, text, uuid)
  from public, anon, authenticated;


-- ---------------------------------------------------------------------------
--  benachrichtige — wie Schema 23_audit, plus die Regel
--
--  Heute nur noch vom Folgen-Auslöser gerufen (on_contact). Ohne diese
--  Änderung käme „X folgt dir jetzt" auch von einem stummgeschalteten Konto.
-- ---------------------------------------------------------------------------

create or replace function public.benachrichtige(
  empfaenger uuid, ausloeser uuid, art text, bereich text,
  ziel_typ text, ziel_id uuid, inhalt text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Wer angemeldet ist, darf nur in eigenem Namen auslösen. Trigger und
  -- Wartungsskripte laufen ohne Sitzung und sind davon nicht betroffen.
  if auth.uid() is not null and ausloeser is distinct from auth.uid() then
    raise exception 'nicht erlaubt';
  end if;

  -- Keine Benachrichtigung über die eigenen Handlungen.
  if empfaenger is null or empfaenger = ausloeser then
    return;
  end if;

  -- Kasten 20.2: stummgeschaltetes Konto, stumme Community, stummer Chat.
  if public.mitteilung_stumm(empfaenger, ausloeser, ziel_typ, ziel_id) then
    return;
  end if;

  insert into public.notifications (user_id, actor_id, art, bereich, target_type, target_id, text)
  values (empfaenger, ausloeser, art, bereich, ziel_typ, ziel_id, coalesce(inhalt, ''));
end;
$$;

revoke execute on function public.benachrichtige(uuid, uuid, text, text, text, uuid, text)
  from public, anon, authenticated;
