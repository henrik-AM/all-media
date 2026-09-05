-- =====================================================================
-- SUPABASE_SCHEMA_25_kanal_anhang.sql — 04.09.2026
--
-- Anhaenge und Sticker in Community-Kanaelen.
--
-- WORUM ES GEHT
--
-- Der Handbuch-Abgleich vom 01.09.2026 fuehrt "Sticker innerhalb von
-- Community-Kanaelen" als offenen Punkt. Beim Nachsehen war es mehr als
-- ein fehlender Sticker:
--
--   * `community_channel_messages` hat genau vier Spalten — id, channel_id,
--     sender_id, text. Ein Anhang hat dort keinen Platz.
--
--   * Die App schickt jeden Anhang ueber `nachrichtSenden()` nach
--     `messages`, auch im Kanal. `messages.chat_id` zeigt aber auf `chats`,
--     und eine Kanal-Kennung steht dort nicht: der Fremdschluessel weist den
--     Datensatz ab. Im Kanal endete jeder Anhang mit "Der Anhang ging nicht
--     raus".
--
--   * Die Website schickt im Kanal sogar den blossen Text an
--     `/api/messages/<Kanal-Id>` — denselben Weg, dieselbe Ablehnung.
--     `handleSendChannelMessage()` gab es im Servercode, nur hing keine
--     Route daran.
--
-- Diese Datei macht den Platz in der Datenbank. Der Rest steht im Code:
-- app/lib/aktionen.ts, app/lib/daten.ts, app/screens/messenger/
-- ChatDetailScreen.tsx, web/server/app.js, web/server/sync-handlers.js,
-- web/server/supabase-api.js, web/public/app.js.
--
-- WARUM DIESELBEN SPALTENNAMEN WIE IN `messages`
--
-- Beide Tabellen zeigen dieselbe Blase auf dem Bildschirm, und beide
-- Oberflaechen bauen sie mit derselben Funktion. Weichen die Namen ab,
-- braucht jede Anzeige eine Umschreibetabelle — und die vergisst irgendwann
-- jemand. Die Namen sind deshalb absichtlich gleich.
--
-- Start:
--   SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--     ../SUPABASE_SCHEMA_25_kanal_anhang.sql
-- =====================================================================

-- ------------------------------------------------------- Die Spalten --

alter table public.community_channel_messages
  add column if not exists media_url       text,
  add column if not exists media_type      text,
  add column if not exists file_name       text,
  add column if not exists file_size       bigint,
  add column if not exists place_id        uuid references public.places (id)   on delete set null,
  add column if not exists contact_user_id uuid references public.profiles (id) on delete set null;

-- Dieselbe Werteliste wie bei `messages` (SUPABASE_SCHEMA_11_handbuch.sql:277).
-- Ein Gif ist kein Bild und ein Sticker keine Blase: die Anzeige entscheidet
-- daran, ob ein Abspielknopf, ein Rahmen oder gar nichts drumherum kommt.
alter table public.community_channel_messages
  drop constraint if exists kanalnachricht_media_type_check;
alter table public.community_channel_messages
  add constraint kanalnachricht_media_type_check
  check (media_type is null or media_type in ('image', 'video', 'audio', 'gif', 'sticker', 'file'));

-- Der Text darf jetzt leer sein: ein Foto ohne Bildunterschrift ist eine
-- vollstaendige Nachricht. Vorher stand dort `not null` ohne Vorgabewert.
alter table public.community_channel_messages alter column text set default '';
alter table public.community_channel_messages alter column text drop not null;

-- Aber nicht beides leer. Eine Zeile ohne Text und ohne Anhang ist nichts,
-- was jemand geschrieben haette — sie stuende als leere Blase im Kanal.
alter table public.community_channel_messages
  drop constraint if exists kanalnachricht_nicht_leer;
alter table public.community_channel_messages
  add constraint kanalnachricht_nicht_leer
  check (
    coalesce(text, '') <> ''
    or media_url is not null
    or media_type is not null
    or place_id is not null
    or contact_user_id is not null
  );

create index if not exists kanalnachrichten_kanal_zeit_idx
  on public.community_channel_messages (channel_id, created_at);

-- Die Lese- und Schreibregeln von SUPABASE_SCHEMA_5.sql bleiben, wie sie
-- sind: sie haengen an `channel_id` und `sender_id`, nicht am Inhalt. Neue
-- Spalten aendern daran nichts, und Spaltenrechte sind auf dieser Tabelle
-- keine vergeben (anders als auf `profiles` seit Schema 23).

-- ----------------------------------------- Zuruecksetzen zieht mit nach --

/*
 * `zuruecksetzen(ziel)` raeumte die eigenen Kanalnachrichten nie weg.
 *
 * Bei einer selbst angelegten Community faellt das nicht auf — die Community
 * wird geloescht und nimmt Kanaele und Nachrichten ueber den Fremdschluessel
 * mit. Was in einer FREMDEN Community steht, blieb dagegen stehen: jeder
 * Prueflauf, der in einem Unterthema schreibt, haengt seine Zeile an den
 * Beispielbestand und nimmt sie nie wieder heraus.
 *
 * Ohne diese Zeile waere der neue Prueflauf test/_kanal.js selbst die
 * Quelle des Drecks, den er spaeter nicht mehr erklaeren kann.
 *
 * Die Funktion wird nicht neu geschrieben, sondern um eine Zeile ergaenzt:
 * der Rest steht unveraendert in SUPABASE_SCHEMA_23_sicherheit.sql und soll
 * dort auch bleiben. Deshalb wird sie hier aus dem Katalog gelesen, die
 * Zeile eingefuegt und zurueckgeschrieben — so kann diese Datei nicht
 * versehentlich eine aeltere Fassung wiederherstellen.
 */
do $$
declare
  quelle text;
  neu    text;
begin
  select pg_get_functiondef(p.oid) into quelle
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'zuruecksetzen';

  if quelle is null then
    raise exception 'zuruecksetzen() gibt es nicht — erst SUPABASE_SCHEMA_23_sicherheit.sql einspielen';
  end if;

  if position('community_channel_messages' in quelle) > 0 then
    raise notice 'zuruecksetzen(): Kanalnachrichten stehen schon drin';
    return;
  end if;

  -- Vor dem Austritt aus den Communitys einhaengen: danach waere die
  -- Sichtbarkeit weg, und die Funktion laeuft zwar als `security definer`,
  -- aber die Reihenfolge soll trotzdem stimmen.
  neu := replace(
    quelle,
    '  -- Selbst angelegte Communitys.',
    '  -- Eigene Zeilen in fremden Kanaelen (Schema 25).' || chr(10) ||
    '  delete from public.community_channel_messages where sender_id = ziel;' || chr(10) ||
    chr(10) ||
    '  -- Selbst angelegte Communitys.'
  );

  if neu = quelle then
    raise exception 'Ankerzeile in zuruecksetzen() nicht gefunden — bitte von Hand nachziehen';
  end if;

  execute neu;
end
$$;

-- Das Recht geht beim Neuschreiben verloren, weil `create or replace` die
-- Funktion neu anlegt und `revoke ... from public` aus Schema 23 greift.
revoke execute on function public.zuruecksetzen(uuid) from public, anon;
grant  execute on function public.zuruecksetzen(uuid) to authenticated;

-- ------------------------------------------------------------ Nachweis --

do $$
declare fehlend text;
begin
  select string_agg(s, ', ') into fehlend
    from unnest(array['media_url','media_type','file_name','file_size','place_id','contact_user_id']) s
   where not exists (
     select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'community_channel_messages'
        and column_name = s);

  if fehlend is not null then
    raise exception 'Spalten fehlen: %', fehlend;
  end if;

  raise notice 'Schema 25: Kanalnachrichten koennen Anhaenge tragen.';
end
$$;
