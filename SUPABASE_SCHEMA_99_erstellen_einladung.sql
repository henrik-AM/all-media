-- ===========================================================================
--  SUPABASE_SCHEMA_99_erstellen_einladung.sql — Community und Unterthema
--  erstellen nach dem Figma-Prototyp (Feedback 28.09.2026, Kästen 10.2 und 16)
--  21.10.2026
-- ===========================================================================
--
--  WORUM ES GEHT
--
--  Henrik am 28.09.2026:
--
--    „…halte dich, wenn ich auf Neues Unterthema erstellen drücke, explizit
--    an meinen Figma Prototypen."
--
--    „Wenn ich unter dem Plus auf Community erstellen drücke, ist mir die
--    Einstellungsseite zu kurz gehalten. Ich möchte nicht nur Beschreibung
--    und Namen eingeben, ich möchte auch Profilbild, Unterthemen und so
--    eingeben können."
--
--  Die Frames „CC + Unterthema erstellen" (928:13446) und „CP + Kanal
--  erstellen" (942:15097) verlangen:
--
--    Unterthema:  Name*, Biografie, Link, Schalter „Privates Unterthema —
--                 Beitritt nur mit Einladung", Einladungslink + QR-Code, fertig
--    Community:   Name*, Bild*, Biografie, Link, „Unterthemen erstellen",
--                 Einladungslink + QR-Code
--
--  WAS LIVE GILT (gemessen 21.10.2026, nur lesend)
--
--    - communities: name, topic, visibility, bio, link — kein Bild.
--    - community_channels: name, slug, topics, position — keine Biografie,
--      kein Link, nicht privat, kein Ersteller.
--    - kanal_sichtbar() = community_sichtbar(): wer die Community sieht,
--      sieht jedes Unterthema.
--    - Keine UPDATE-Regel auf beiden Tabellen: was beim Anlegen gesetzt
--      wird, bleibt so (das gilt jetzt auch für „privat").
--
--  WAS JETZT GILT
--
--    1. communities.bild_url — das Community-Bild. Hochgeladen wird über die
--       vorhandene Medienstelle in den Ordner `avatars` (lesbar wie ein
--       Profilbild, medium_sichtbar() bleibt unverändert).
--    2. community_channels.bio, .link, .privat, .erstellt_von. Den Ersteller
--       setzt die Datenbank (unterthema_vorgaben).
--    3. Private Unterthemen: sehen nur, wer es angelegt hat, wer die
--       Community angelegt hat, und wer per Einladung eingetreten ist
--       (Tabelle unterthema_mitglieder). Gilt für die Unterthemen selbst,
--       ihre Nachrichten (kanal_sichtbar), Push to Talk (ptt_messages,
--       ptt_mitteilen) und @-Markierungen (markierung_sichtbar).
--    4. Einladungen: Tabelle `einladungen` (Code je Community bzw.
--       Unterthema, nur der Ersteller sieht ihn) und
--       einladung_annehmen(code). Eine COMMUNITY-Einladung (nur der
--       Ersteller legt sie an) IST die Freigabe — auch bei einer privaten
--       Community ohne Beitrittsanfrage. Eine UNTERTHEMA-Einladung macht bei
--       einer privaten Community nicht zum Mitglied, sie setzt die
--       Mitgliedschaft voraus (Codex-Fund Paket 3, Begründung bei
--       einladung_annehmen). Blockierung gegenüber Einladendem und
--       Community-Ersteller, beide Richtungen: nein.
--       Der Code entsteht im Gerät (zufällig, 16 Zeichen), damit er schon
--       auf der Erstellen-Seite als Link und QR-Code steht; gültig wird er
--       mit dem Speichern.
--
--  ERSETZT
--
--    - kanal_sichtbar(uuid), kanal_mitglied(uuid) (zuletzt EINSPIELEN/59)
--    - Regel „Kanaele lesen" auf community_channels
--    - ptt_mitteilen(uuid, uuid, uuid) (zuletzt 90) — 99 NACH 90 einspielen.
--      Wer 90 neu einspielt, muss 99 nachziehen.
--    - markierung_sichtbar(text, uuid, uuid) (zuletzt 86)
--
--  Code vor dem Schema: App (daten.ts, aktionen.ts) und Server
--  (supabase-api.js, sync-handlers.js) lesen die neuen Spalten nachsichtig
--  (Erstellen.fehltSchema) und legen ohne 99 so an wie bisher; Bild,
--  Biografie, Link, privat und Einladung melden dann „… erst, wenn das
--  Datenbank-Update eingespielt ist".
--
--  EINSPIELEN (nach 88 → … → 98, siehe SUPABASE_REIHENFOLGE.md)
--
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      ../SUPABASE_SCHEMA_99_erstellen_einladung.sql
--
--  Danach: npm run test:rechte, test:schema, test:minderjaehrig,
--  test:angriffe, test:k28-erstellen. Mehrfach einspielbar.
--
--  ABGLEICH MIT MAIN 101–117 UND LIVE (Paket 3, 05.11.2026, nur lesend)
--
--    kanal_sichtbar(uuid)        main 101–117: nicht neu definiert (102 ruft
--                                sie nur auf). Live = Fassung 5/59 — 99 ändert
--                                nur „+ unterthema_zugang“. Übernommen.
--    kanal_mitglied(uuid)        main: nicht neu definiert. Live = Fassung 59.
--    Regel „Kanaele lesen“       main: nicht neu definiert. Live
--                                community_sichtbar(community_id). Die
--                                restriktiven Regeln aus 102 (nicht_ausgeblendet
--                                auf community_channels/ptt_messages, Helfer
--                                kanal_ausgeblendet/community_ausgeblendet)
--                                heißen anders und bleiben unberührt; 99 dreht
--                                F5 nicht zurück.
--    ptt_mitteilen(...)          main: nicht definiert, live NICHT vorhanden
--                                (90 nicht eingespielt; live fehlt auch
--                                community_members.ptt_benachrichtigung). Ohne 90
--                                ist der Abschnitt nur eine unbenutzte Funktion
--                                — 99 erst nach 90 einspielen (Paket 1/Sammelzweig).
--    markierung_sichtbar(...)    main: nicht neu definiert. Live = Fassung 86.
--    communities.bild_url        115 (bunny_referenz_pruefen) und 117
--                                (medienreferenz_pruefen) kennen die Spalte
--                                schon, legen ihren Auslöser aber nur an, wenn
--                                sie existiert. NACH 99 die Auslöser-Blöcke von
--                                115 und 117 erneut ausführen, sonst prüft
--                                niemand, dass das Bild selbst hochgeladen ist.
--    einladungen                 103 (Auskunft) führt die Tabelle schon auf und
--                                überspringt sie, solange sie fehlt.
--                                unterthema_mitglieder fehlt in der Auskunft (103)
--                                — offen, gehört in 103.
--    zuruecksetzen(), notifications_*_check: von 99 nicht berührt.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Community-Bild
-- ---------------------------------------------------------------------------

alter table public.communities
  add column if not exists bild_url text;

-- Nur die eigene Medienstelle, Ordner avatars — dieselbe Form wie
-- /api/eigene/profilbild. Fremde Adressen wären Tracking-Pixel.
--
-- Codex-Fund Paket 3 (05.11.2026): Das Pfadende allein reicht nicht —
-- https://boese.example/storage/v1/object/public/media/avatars/x.jpg ging
-- durch, und die Auslöser aus 115/117 überspringen Adressen, die
-- medien_adresse_gueltig() nicht kennt. Scheitert dann die Signierung, lädt
-- jeder Betrachter das Bild vom fremden Host (IP, Zeitpunkt). Darum
-- zusätzlich medien_adresse_gueltig() (eigener Projekt-Host, Schema 23/95) —
-- dasselbe Muster wie kontakt_bilder_eimer in Schema 94. Denselben Vertrag
-- prüfen App und Server mit Erstellen.bildAdresseGueltig (gemeinsam/erstellen.js).
alter table public.communities drop constraint if exists communities_bild_url_check;
alter table public.communities add constraint communities_bild_url_check
  check (bild_url is null
         or (bild_url ~ '/storage/v1/object/public/media/avatars/[A-Za-z0-9._-]+$'
             and public.medien_adresse_gueltig(bild_url)))
  not valid;

alter table public.communities drop constraint if exists communities_texte_check;
alter table public.communities add constraint communities_texte_check
  check (char_length(coalesce(bio, '')) <= 500 and char_length(coalesce(link, '')) <= 200)
  not valid;

comment on column public.communities.bild_url is
  'Community-Bild (Schema 99), beständige Adresse aus dem Ordner avatars.';


-- ---------------------------------------------------------------------------
-- 2. Unterthema: Biografie, Link, privat, Ersteller
-- ---------------------------------------------------------------------------

alter table public.community_channels
  add column if not exists bio text not null default '',
  add column if not exists link text not null default '',
  add column if not exists privat boolean not null default false,
  add column if not exists erstellt_von uuid references public.profiles (id) on delete set null;

alter table public.community_channels drop constraint if exists community_channels_texte_check;
alter table public.community_channels add constraint community_channels_texte_check
  check (char_length(bio) <= 500 and char_length(link) <= 200)
  not valid;

-- Den Ersteller setzt die Datenbank, nicht der Client. Der Testbestand legt
-- über security-definer-Funktionen an und bleibt unberührt (wie
-- community_vorgaben in 97).
create or replace function public.unterthema_vorgaben()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  new.erstellt_von := auth.uid();
  new.created_at := now();
  return new;
end $$;

drop trigger if exists unterthema_vorgaben on public.community_channels;
create trigger unterthema_vorgaben
  before insert on public.community_channels
  for each row execute function public.unterthema_vorgaben();


-- ---------------------------------------------------------------------------
-- 3. Private Unterthemen
-- ---------------------------------------------------------------------------

create table if not exists public.unterthema_mitglieder (
  channel_id uuid not null references public.community_channels (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

comment on table public.unterthema_mitglieder is
  'Wer per Einladung in ein privates Unterthema eingetreten ist (Kasten 10.2, Schema 99).';

/*
 * Zugang für eine bestimmte Person — für Auslöser und Mitteilungen, in denen
 * auth.uid() der Absender ist. Nur intern: wer es aufrufen dürfte, könnte
 * abfragen, wer in welchem privaten Unterthema ist.
 */
create or replace function public.unterthema_zugang(p_kanal uuid, p_wer uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
      from public.community_channels k
      join public.communities c on c.id = k.community_id
     where k.id = p_kanal
       and (not k.privat
            or k.erstellt_von = p_wer
            or c.created_by = p_wer
            or exists (select 1 from public.unterthema_mitglieder u
                        where u.channel_id = k.id and u.user_id = p_wer))
  );
$$;

revoke execute on function public.unterthema_zugang(uuid, uuid) from public, anon, authenticated;

-- Dasselbe für den, der gerade fragt — für die Regeln.
create or replace function public.unterthema_offen(ziel uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.unterthema_zugang(ziel, auth.uid());
$$;

revoke execute on function public.unterthema_offen(uuid) from public, anon;
grant execute on function public.unterthema_offen(uuid) to authenticated;

create or replace function public.kanal_sichtbar(ziel uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.community_channels k
     where k.id = ziel
       and public.community_sichtbar(k.community_id)
       and public.unterthema_zugang(k.id, auth.uid())
  );
$$;

create or replace function public.kanal_mitglied(ziel uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
      from public.community_channels k
      join public.community_members m on m.community_id = k.community_id
     where k.id = ziel and m.user_id = auth.uid()
       and public.unterthema_zugang(k.id, auth.uid())
  );
$$;

drop policy if exists "Kanaele lesen" on public.community_channels;
create policy "Kanaele lesen" on public.community_channels
  for select to authenticated
  using (public.community_sichtbar(community_id) and (not privat or public.unterthema_offen(id)));

alter table public.unterthema_mitglieder enable row level security;

-- Lesen: die eigene Zeile, und wer das Unterthema oder die Community angelegt hat.
drop policy if exists "Unterthema-Mitglieder lesen" on public.unterthema_mitglieder;
create policy "Unterthema-Mitglieder lesen" on public.unterthema_mitglieder
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.community_channels k
                 join public.communities c on c.id = k.community_id
                where k.id = channel_id
                  and (k.erstellt_von = (select auth.uid()) or c.created_by = (select auth.uid())))
  );

-- Eintreten nur über einladung_annehmen(). Austreten selbst, Entfernen durch
-- den Ersteller.
drop policy if exists "Unterthema verlassen" on public.unterthema_mitglieder;
create policy "Unterthema verlassen" on public.unterthema_mitglieder
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.community_channels k
                 join public.communities c on c.id = k.community_id
                where k.id = channel_id
                  and (k.erstellt_von = (select auth.uid()) or c.created_by = (select auth.uid())))
  );

drop policy if exists nur_freigegebene on public.unterthema_mitglieder;
create policy nur_freigegebene on public.unterthema_mitglieder
  as restrictive for all to authenticated
  using ((select public.konto_freigegeben()))
  with check ((select public.konto_freigegeben()));

revoke all on public.unterthema_mitglieder from anon;
revoke insert, update on public.unterthema_mitglieder from authenticated;
grant select, delete on public.unterthema_mitglieder to authenticated;

-- Push to Talk (Schema 90) hängt am Unterthema: einschränkend dazu.
drop policy if exists "PTT nur mit Unterthema-Zugang" on public.ptt_messages;
create policy "PTT nur mit Unterthema-Zugang" on public.ptt_messages
  as restrictive for all to authenticated
  using (channel_id is null or public.unterthema_offen(channel_id))
  with check (channel_id is null or public.unterthema_offen(channel_id));

-- ptt_mitteilen wie in 90, plus: nur wer ins Unterthema darf.
create or replace function public.ptt_mitteilen(p_community uuid, p_kanal uuid, p_sprecher uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_an    uuid;
  v_zahl  integer := 0;
begin
  for v_an in
    select m.user_id
      from public.community_members m
     where m.community_id = p_community
       and m.ptt_benachrichtigung
       and not coalesce(m.is_muted, false)
       and m.user_id <> p_sprecher
       and public.konto_stand(m.user_id) = 'frei'
       and public.sichtbar_fuer(m.user_id, 'ptt', p_sprecher)
       and public.unterthema_zugang(p_kanal, m.user_id)
       and not exists (
         select 1 from public.blocks b
          where (b.user_id = m.user_id and b.blocked_user_id = p_sprecher)
             or (b.user_id = p_sprecher and b.blocked_user_id = m.user_id))
  loop
    -- mitteilung_anlegen (Gewinner 78) prueft zusaetzlich mutes.
    perform public.mitteilung_anlegen(v_an, p_sprecher, 'ptt', 'communities', 'channel', p_kanal);
    v_zahl := v_zahl + 1;
  end loop;
  return v_zahl;
end $$;

revoke execute on function public.ptt_mitteilen(uuid, uuid, uuid)
  from public, anon, authenticated;

-- markierung_sichtbar wie in 86, im Zweig 'kanal' plus Unterthema-Zugang.
create or replace function public.markierung_sichtbar(p_art text, p_quelle uuid, wen uuid)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_post uuid;
  v_chat uuid;
  v_kanal uuid;
begin
  if p_art in ('post', 'comment') then
    if p_art = 'post' then
      v_post := p_quelle;
    else
      select c.post_id into v_post from public.comments c where c.id = p_quelle;
    end if;
    return exists (
      select 1 from public.posts b
       where b.id = v_post
         and (not coalesce(b.demo, false)
              or b.user_id = wen
              or exists (select 1 from public.profiles p where p.id = b.user_id and p.demo)));
  elsif p_art = 'message' then
    select m.chat_id into v_chat from public.messages m where m.id = p_quelle;
    return exists (select 1 from public.chat_members cm where cm.chat_id = v_chat and cm.user_id = wen);
  elsif p_art = 'kanal' then
    select k.channel_id into v_kanal from public.community_channel_messages k where k.id = p_quelle;
    return exists (
      select 1 from public.community_channels ch
        join public.communities c on c.id = ch.community_id
       where ch.id = v_kanal
         and (c.visibility = 'public'
              or exists (select 1 from public.community_members m
                          where m.community_id = c.id and m.user_id = wen)))
      and public.unterthema_zugang(v_kanal, wen);
  end if;
  return false;
end $$;

revoke all on function public.markierung_sichtbar(text, uuid, uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 4. Einladungen
-- ---------------------------------------------------------------------------

create table if not exists public.einladungen (
  code         text primary key check (code ~ '^[a-z2-9]{16,32}$'),
  community_id uuid not null references public.communities (id) on delete cascade,
  channel_id   uuid references public.community_channels (id) on delete cascade,
  erstellt_von uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- Eine Einladung je Community bzw. je Unterthema.
create unique index if not exists einladungen_ziel_idx
  on public.einladungen (community_id, coalesce(channel_id, '00000000-0000-0000-0000-000000000000'::uuid));

comment on table public.einladungen is
  'Einladungslink/QR-Code für eine Community oder ein Unterthema (Kästen 10.2/16, Schema 99). Sehen: nur der Ersteller.';

alter table public.einladungen enable row level security;

drop policy if exists "Einladung lesen" on public.einladungen;
create policy "Einladung lesen" on public.einladungen
  for select to authenticated
  using (erstellt_von = (select auth.uid()));

/*
 * Anlegen darf nur, wer das Ziel angelegt hat: die Community selbst, oder
 * das Unterthema (bzw. die Community, zu der es gehört). Wer ein Unterthema
 * angelegt hat, die Community aber verlassen hat, lädt nicht mehr ein
 * (Codex-Fund Paket 3) — einladung_annehmen() prüft dasselbe noch einmal
 * beim Annehmen, für Einladungen, die schon vor dem Austritt bestanden.
 */
drop policy if exists "Einladung anlegen" on public.einladungen;
create policy "Einladung anlegen" on public.einladungen
  for insert to authenticated
  with check (
    erstellt_von = (select auth.uid())
    and (
      (channel_id is null and exists (
         select 1 from public.communities c
          where c.id = community_id and c.created_by = (select auth.uid())))
      or
      (channel_id is not null and exists (
         select 1 from public.community_channels k
           join public.communities c on c.id = k.community_id
          where k.id = channel_id and k.community_id = einladungen.community_id
            and (c.created_by = (select auth.uid())
                 or (k.erstellt_von = (select auth.uid())
                     and public.is_community_member(c.id)))))
    )
  );

drop policy if exists "Einladung entfernen" on public.einladungen;
create policy "Einladung entfernen" on public.einladungen
  for delete to authenticated
  using (erstellt_von = (select auth.uid()));

drop policy if exists nur_freigegebene on public.einladungen;
create policy nur_freigegebene on public.einladungen
  as restrictive for all to authenticated
  using ((select public.konto_freigegeben()))
  with check ((select public.konto_freigegeben()));

revoke all on public.einladungen from anon;
revoke update on public.einladungen from authenticated;
grant select, insert, delete on public.einladungen to authenticated;

/*
 * Eine Einladung annehmen.
 *
 * Community-Einladung (channel_id null): nur der Community-Ersteller kann
 * sie anlegen (Regel „Einladung anlegen"). Sie IST seine Freigabe — wer den
 * Code hat, wird Mitglied, auch einer privaten Community ohne Anfrage.
 *
 * Unterthema-Einladung: anlegen kann sie auch ein gewöhnliches Mitglied,
 * das das Unterthema angelegt hat. Codex-Fund Paket 3 (05.11.2026): Bis
 * hierher trug diese Funktion den Annehmenden an RLS vorbei auch in die
 * COMMUNITY ein und prüfte nur die Blockierung gegenüber dem Einladenden.
 * Eine vom Ersteller blockierte Person kam so über ein anderes Mitglied in
 * eine private Community — an der Beitrittsfreigabe aus Schema 97 vorbei.
 *
 * GEWÄHLTE REGEL (die engere der beiden möglichen):
 *
 *   Eine Unterthema-Einladung öffnet NIE die Tür zu einer privaten
 *   Community — auch nicht, wenn sie vom Ersteller selbst stammt. Wer noch
 *   nicht Mitglied ist, tritt zuerst bei (Community-Einladung des
 *   Erstellers oder angenommene Beitrittsanfrage), dann gilt der
 *   Unterthema-Code.
 *
 *   Begründung: In eine private Community führen damit genau zwei Türen,
 *   und beide hält der Ersteller (Schema 97: Anfrage annehmen; hier:
 *   Community-Einladung). Ein Unterthema-Code wird herumgereicht wie ein
 *   Link in einem Gruppenchat; ob er vom Ersteller oder einem Mitglied
 *   stammt, sieht der Empfänger nicht, und „Ersteller-Code öffnet, anderer
 *   nicht" wäre eine Regel, die niemand nachvollziehen kann. Der Ersteller
 *   verliert nichts: er hat die Community-Einladung.
 *
 *   Bei einer ÖFFENTLICHEN Community macht die Unterthema-Einladung weiter
 *   gleich zum Mitglied — beitreten darf dort ohnehin jeder.
 *
 * Für beide Arten zusätzlich:
 *   - Blockierung in beide Richtungen gegenüber dem Einladenden UND dem
 *     Community-Ersteller → nein.
 *   - Community ausgeblendet (Moderation, Schema 102) → „gibt es nicht
 *     mehr". Diese Funktion schreibt an der Regel nicht_ausgeblendet vorbei,
 *     darum hier ausdrücklich.
 *   - Unterthema-Einladung eines Mitglieds, das die Community inzwischen
 *     verlassen hat (oder nicht mehr Ersteller des Unterthemas ist): gilt
 *     nicht mehr.
 *
 * Fehlersätze (P0001, gehen bis zur Oberfläche durch; App und Website
 * zeigen error.message bzw. res.error unverändert):
 *   'Diese Einladung gibt es nicht mehr'
 *   'Diese Einladung kannst du nicht annehmen'
 *   'Diese Einladung gilt nur für Mitglieder der Community – tritt ihr zuerst bei'
 */
create or replace function public.einladung_annehmen(p_code text)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_ich       uuid := auth.uid();
  v_e         public.einladungen%rowtype;
  v_c         public.communities%rowtype;
  v_kanal_von uuid;
begin
  if v_ich is null then
    raise exception 'Dafür musst du angemeldet sein' using errcode = '42501';
  end if;
  if not public.konto_freigegeben() then
    raise exception 'Dein Konto ist noch nicht freigegeben' using errcode = '42501';
  end if;

  select * into v_e from public.einladungen where code = lower(trim(p_code));
  if not found then
    -- P0001 (Vorgabe): der Satz darf bis zum Browser durch (fuerMenschen).
    raise exception 'Diese Einladung gibt es nicht mehr';
  end if;

  select * into v_c from public.communities where id = v_e.community_id;
  if not found or v_c.moderiert_am is not null then
    raise exception 'Diese Einladung gibt es nicht mehr';
  end if;

  -- Gilt die Einladung noch? Community-Einladung: nur vom Ersteller.
  -- Unterthema-Einladung: vom Community-Ersteller, oder vom Ersteller des
  -- Unterthemas, solange er noch Mitglied ist.
  if v_e.channel_id is null then
    if v_e.erstellt_von is distinct from v_c.created_by then
      raise exception 'Diese Einladung gibt es nicht mehr';
    end if;
  else
    select k.erstellt_von into v_kanal_von
      from public.community_channels k
     where k.id = v_e.channel_id and k.community_id = v_e.community_id;
    if not found then
      raise exception 'Diese Einladung gibt es nicht mehr';
    end if;
    if v_e.erstellt_von is distinct from v_c.created_by
       and not (v_e.erstellt_von = v_kanal_von
                and exists (select 1 from public.community_members m
                             where m.community_id = v_c.id and m.user_id = v_e.erstellt_von)) then
      raise exception 'Diese Einladung gibt es nicht mehr';
    end if;
  end if;

  -- Blockierung: beide Richtungen, gegenüber Einladendem und Ersteller.
  if public.blockiert_zwischen(v_ich, v_e.erstellt_von)
     or (v_c.created_by is not null and public.blockiert_zwischen(v_ich, v_c.created_by)) then
    raise exception 'Diese Einladung kannst du nicht annehmen';
  end if;

  -- Private Community: ein Unterthema-Code macht nicht zum Mitglied.
  if v_e.channel_id is not null
     and v_c.visibility <> 'public'
     and v_c.created_by is distinct from v_ich
     and not exists (select 1 from public.community_members m
                      where m.community_id = v_c.id and m.user_id = v_ich) then
    raise exception 'Diese Einladung gilt nur für Mitglieder der Community – tritt ihr zuerst bei';
  end if;

  insert into public.community_members (community_id, user_id)
  values (v_e.community_id, v_ich)
  on conflict do nothing;

  if v_e.channel_id is not null then
    insert into public.unterthema_mitglieder (channel_id, user_id)
    values (v_e.channel_id, v_ich)
    on conflict do nothing;
  end if;

  return json_build_object('community_id', v_e.community_id, 'channel_id', v_e.channel_id);
end $$;

revoke execute on function public.einladung_annehmen(text) from public, anon;
grant execute on function public.einladung_annehmen(text) to authenticated;

-- Auslöserfunktion: EXECUTE ginge sonst an PUBLIC (Schema 74).
revoke execute on function public.unterthema_vorgaben() from public, anon;
grant execute on function public.unterthema_vorgaben() to authenticated;
revoke execute on function public.kanal_sichtbar(uuid) from public, anon;
grant execute on function public.kanal_sichtbar(uuid) to authenticated;
revoke execute on function public.kanal_mitglied(uuid) from public, anon;
grant execute on function public.kanal_mitglied(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 5. Selbstprüfung
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'unterthema_mitglieder'
                    and policyname = 'nur_freigegebene' and permissive = 'RESTRICTIVE') then
    raise exception 'nur_freigegebene fehlt auf unterthema_mitglieder';
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'einladungen'
                    and policyname = 'nur_freigegebene' and permissive = 'RESTRICTIVE') then
    raise exception 'nur_freigegebene fehlt auf einladungen';
  end if;
  if has_function_privilege('anon', 'public.einladung_annehmen(text)', 'execute') then
    raise exception 'einladung_annehmen ist für anon ausführbar';
  end if;
  if has_function_privilege('authenticated', 'public.unterthema_zugang(uuid, uuid)', 'execute') then
    raise exception 'unterthema_zugang ist für authenticated ausführbar';
  end if;
  if has_table_privilege('authenticated', 'public.unterthema_mitglieder', 'insert') then
    raise exception 'unterthema_mitglieder ist direkt beschreibbar';
  end if;
end $$;
