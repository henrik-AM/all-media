-- ===========================================================================
--  SUPABASE_SCHEMA_40_lesebestaetigung.sql — Die Lesebestaetigung wirkt
--  18.09.2026
-- ===========================================================================
--
--  WORUM ES GEHT
--
--  „Lesebestaetigung" stand in beiden Einstellungslisten, wurde gespeichert —
--  und war an drei Stellen zugleich wirkungslos:
--
--    1. `read_at` wurde NIE gesetzt. `nachrichtGelesen()` in
--       app/lib/aktionen.ts hatte keinen einzigen Aufrufer,
--       `handleMarkMessageAsRead` in web/server/sync-handlers.js keine Route.
--    2. Haetten sie einen gehabt, waeren sie trotzdem verpufft: die Regel
--       „Eigene Nachricht aendern" aus Schema 23 laesst nur den ABSENDER
--       schreiben (`auth.uid() = sender_id`). Gelesen wird aber vom
--       EMPFAENGER. Das UPDATE haette null Zeilen getroffen und brav
--       „erfolgreich" gemeldet — dieselbe stille Falle wie beim verbotenen
--       DELETE.
--    3. App UND Website zeigten am eigenen Text trotzdem IMMER den doppelten
--       Haken — also „gelesen" fuer etwas, das nie jemand gelesen hat. Beide
--       Seiten fragen jetzt `read`, und ein einzelner Haken heisst
--       „zugestellt".
--
--  WARUM DIE REGEL IN DIE DATENBANK GEHOERT
--
--  Der Schalter muss in App UND Website gleich wirken (bindende Regel des
--  Projekts). Stuende die Pruefung „hat der Leser Lesebestaetigungen an?" im
--  Klienten, gaebe es sie zweimal — und zwei Kopien laufen frueher oder
--  spaeter auseinander; genau das war der Befund vom 17.09.2026. Hier
--  entscheidet die Datenbank, beide Seiten rufen nur noch auf.
--
--  Nebenwirkung, die niemanden ueberraschen darf: wer die Lesebestaetigung
--  ausschaltet, sendet keine mehr — sieht aber auch selbst keine. So kennen es
--  Nutzer von anderen Messengern, und alles andere waere einseitig.
--
--  SICHERHEIT
--
--  `security definer` umgeht die Zeilenregeln, deshalb prueft die Funktion
--  selbst und eng:
--    - nur Nachrichten des uebergebenen Chats,
--    - nur wenn der Aufrufer MITGLIED dieses Chats ist,
--    - nur FREMDE Nachrichten (`sender_id <> auth.uid()`),
--    - nur solche, die noch kein `read_at` haben (ein einmal gesetzter
--      Zeitpunkt wird nie ueberschrieben),
--    - `search_path` fest, damit nichts untergeschoben werden kann.
--  Damit kann der Aufruf nichts, was der Aufrufer nicht ohnehin darf: er
--  setzt einen Zeitstempel an Nachrichten, die er lesen darf.
--
--  Und nach Schema 37: EXECUTE gehoert nicht PUBLIC. Postgres vergibt es bei
--  jeder neuen Funktion automatisch — deshalb steht der Entzug unten.
-- ===========================================================================

create or replace function public.chat_gelesen(p_chat uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  ich uuid := auth.uid();
  bestaetigt integer := 0;
begin
  if ich is null then
    return 0;
  end if;

  -- Fremder Chat: nichts tun. Nicht fehlschlagen — das waere ein Hinweis
  -- darauf, dass es den Chat gibt.
  if not public.is_chat_member(p_chat) then
    return 0;
  end if;

  -- Der Schalter des LESERS. Fehlt die Zeile, gilt der Auslieferungszustand
  -- „an" (gleiche Tabelle SCHALTER_STANDARD in
  -- app/contexts/EinstellungenContext.tsx und web/public/app.js).
  if exists (
    select 1 from public.user_settings
     where user_id = ich
       and schluessel = 'lesebestaetigung'
       and wert = 'aus'
  ) then
    return 0;
  end if;

  update public.messages
     set read_at = now()
   where chat_id = p_chat
     and sender_id <> ich
     and read_at is null
     and deleted_at is null;

  get diagnostics bestaetigt = row_count;
  return bestaetigt;
end;
$$;

comment on function public.chat_gelesen(uuid) is
  'Setzt read_at an allen fremden, noch ungelesenen Nachrichten eines Chats — '
  'aber nur, wenn der Leser die Lesebestaetigung nicht abgeschaltet hat.';

revoke all on function public.chat_gelesen(uuid) from public, anon;
grant execute on function public.chat_gelesen(uuid) to authenticated;
