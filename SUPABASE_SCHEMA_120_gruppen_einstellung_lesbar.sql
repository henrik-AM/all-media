-- ============================================================================
-- Schema 120 — „Gruppen: wer darf hinzufügen" wirkt wirklich (07.11.2026)
-- ============================================================================
--
-- Fund aus test:dmsperre (rote Läufe 07.11.2026, Zweig claude/rote-laeufe-2026-11-07):
--
-- `darf_mitglied_werden()` (17.10.2026) liest die Einstellung
-- `gruppenHinzufuegen` der Person, die in eine Gruppe geholt wird, aus
-- `user_settings`. Die Funktion läuft aber als Aufrufer (kein security
-- definer — absichtlich, sie prüft `current_user`), und die Regel „Eigene
-- Einstellungen" auf user_settings zeigt jedem nur die eigenen Zeilen.
-- Die fremde Wahl war also nie lesbar, es galt immer die Vorgabe
-- „Meine Kontakte":
--   * „Alle"     → trotzdem nur Kontakte durften hinzufügen (Prüflauf rot),
--   * „Niemand"  → Kontakte durften TROTZDEM hinzufügen (Datenschutz).
--
-- Jetzt: die Entscheidung trifft die Hilfe `darf_in_gruppe_holen(wer)` als
-- security definer. Sie gibt nur Ja/Nein für den Aufrufer zurück — dieselbe
-- Auskunft, die ein Hinzufügen-Versuch ohnehin liefert, nicht den Wert der
-- Einstellung. `darf_mitglied_werden` bleibt Aufrufer-Funktion
-- (current_user-Weiche für Testbestand/Datenbank) und ruft die Hilfe.
--
-- Ersetzt: darf_mitglied_werden (live seit 17.10., Gruppenteil).
-- Neu: darf_in_gruppe_holen(uuid).
-- ============================================================================

create or replace function public.darf_in_gruppe_holen(wer uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  wahl text;
begin
  if auth.uid() is null or wer is null then
    return false;
  end if;
  select s.wert into wahl from public.user_settings s
   where s.user_id = wer and s.schluessel = 'gruppenHinzufuegen';
  wahl := coalesce(wahl, 'Meine Kontakte');
  if wahl = 'Alle' then return true; end if;
  if wahl = 'Niemand' then return false; end if;
  return public.ist_messenger_kontakt(wer, auth.uid());
end;
$$;

create or replace function public.darf_mitglied_werden(ziel_chat uuid, wer uuid)
returns boolean
language plpgsql
stable
set search_path to 'public'
as $$
declare
  gruppe  boolean;
  bereich text;
  ersteller uuid;
  angelegt timestamptz;
begin
  -- Der Testbestand und alles, was die Datenbank selbst aufbaut.
  if current_user <> 'authenticated' then
    return true;
  end if;

  select c.is_group, c.bereich, c.created_by, c.created_at into gruppe, bereich, ersteller, angelegt
    from public.chats c where c.id = ziel_chat;
  if gruppe is null then
    return false;              -- Chat nicht gefunden: im Zweifel nein.
  end if;

  -- Sich selbst eintragen: nur in den Chat, den man GERADE selbst angelegt
  -- hat (App und Website tragen beim Anlegen sich und das Gegenüber in einem
  -- Zug ein).
  if wer = auth.uid() then
    return coalesce(ersteller = auth.uid() and angelegt > now() - interval '10 minutes', false);
  end if;

  if public.blockiert_zwischen(auth.uid(), wer) then
    return false;
  end if;

  if gruppe then
    -- „Gruppen: wer darf hinzufügen" (Einstellungen, App und Website).
    -- Seit Schema 120 über die Definer-Hilfe: die fremde Einstellung ist
    -- dem Aufrufer per RLS nicht lesbar.
    return public.darf_in_gruppe_holen(wer);
  end if;

  if coalesce(bereich, 'messenger') = 'messenger'
     and not public.messenger_erlaubt(auth.uid(), wer) then
    return false;
  end if;

  return public.darf_angeschrieben_werden(wer, auth.uid());
end;
$$;

revoke execute on function public.darf_in_gruppe_holen(uuid) from public, anon;
grant execute on function public.darf_in_gruppe_holen(uuid) to authenticated;
-- darf_mitglied_werden: Rechte wie bisher (create or replace behält sie);
-- trotzdem ausdrücklich, falls die Funktion neu angelegt wird.
revoke execute on function public.darf_mitglied_werden(uuid, uuid) from public, anon;
grant execute on function public.darf_mitglied_werden(uuid, uuid) to authenticated;
