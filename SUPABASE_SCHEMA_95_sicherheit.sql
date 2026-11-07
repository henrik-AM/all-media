-- =====================================================================
-- SUPABASE_SCHEMA_95_sicherheit.sql — 17.10.2026
--
-- Sicherheitsprüfung 16./17.10.2026 („Fehler, die KI-gebaute Apps
-- typischerweise haben", gegen All Media gehalten). Bericht im Vault:
-- 02 Projekte/All Media/Sicherheit/All-Media-Sicherheit-17-10-2026.md
--
-- Nummer 95, weil 88–94 im Sammelzweig `feedback-ohne-supabase` vergeben
-- und noch nicht eingespielt sind. Die Datei hängt von keiner davon ab.
--
-- Alles idempotent: die Datei lässt sich mehrfach einspielen.
-- Einspielen:
--   SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs SUPABASE_SCHEMA_95_sicherheit.sql
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. MEDIENSPEICHER: nur lesen, was man auch als Zeile sehen darf
-- ---------------------------------------------------------------------
--
-- Seit Schema 24 galt `for select to authenticated using (bucket_id =
-- 'media')`. Gegen Anonyme war das zu, gegen jeden Angemeldeten offen:
-- `storage.from('media').list('stories')` zählte den ganzen Ordner auf,
-- `createSignedUrls` machte jede Datei abrufbar — Storys privater Profile,
-- abgelaufene Storys, Insights an andere, Sprachnachrichten. Am 17.10.
-- als Prüfkonto nachgestellt: 58 fremde Dateien sichtbar, 7 davon Storys.
-- Der Zufallsteil im Dateinamen war wertlos, weil man nicht raten musste.
--
-- Jetzt sieht man eine Datei nur, wenn
--   * man sie selbst hochgeladen hat (owner), oder
--   * sie Profilbild bzw. Beispielbestand ist (avatars/, beispiel/), oder
--   * eine Zeile, die man nach den bestehenden Regeln lesen DARF, genau
--     auf diese Datei zeigt.
--
-- Der dritte Punkt ist der Kern, und er braucht keine eigene Sichtbarkeits-
-- logik: `medium_sichtbar` ist SECURITY INVOKER, die Abfragen darin laufen
-- also durch die RLS von posts, stories, messages, insights, … — dieselben
-- Regeln wie für die Zeile. Was die Datenbank an der Zeile verbirgt, bleibt
-- jetzt auch an der Datei verborgen.
--
-- Die Server (web/server/medien.js, app/lib/medien.ts) unterschreiben mit
-- dem Client des Nutzers; sie bekommen für fremde Dateien also keine
-- Unterschrift mehr. Der Zwischenspeicher in medien.js ist deshalb jetzt
-- je Nutzer geschlüsselt (sonst bekäme B die für A unterschriebene Adresse).

create or replace function public.medien_adresse(pfad text)
returns text
language sql
immutable
set search_path = public
as $$
  select 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/' || pfad;
$$;

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
  if ordner in ('avatars', 'beispiel') then
    return true;
  end if;
  return
       exists (select 1 from public.stories where media_url = adresse)
    or exists (select 1 from public.posts where media_url = adresse or thumbnail_url = adresse)
    or exists (select 1 from public.messages where media_url = adresse)
    or exists (select 1 from public.insights where media_url = adresse)
    or exists (select 1 from public.ptt_messages where audio_url = adresse)
    or exists (select 1 from public.community_channel_messages where media_url = adresse)
    or exists (select 1 from public.sammlungen where titelbild_url = adresse);
end;
$$;

-- Ohne Index wäre jede Unterschrift ein Durchlauf über die ganze Tabelle.
create index if not exists stories_media_url_idx  on public.stories (media_url) where media_url is not null;
create index if not exists posts_media_url_idx    on public.posts (media_url) where media_url is not null;
create index if not exists posts_thumbnail_url_idx on public.posts (thumbnail_url) where thumbnail_url is not null;
create index if not exists messages_media_url_idx on public.messages (media_url) where media_url is not null;
create index if not exists insights_media_url_idx on public.insights (media_url) where media_url is not null;
create index if not exists ptt_audio_url_idx      on public.ptt_messages (audio_url) where audio_url is not null;
create index if not exists ccm_media_url_idx      on public.community_channel_messages (media_url) where media_url is not null;

drop policy if exists "Medien lesen" on storage.objects;
create policy "Medien lesen" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and (owner_id = (select auth.uid())::text or public.medium_sichtbar(name))
  );

-- Hochladen: bisher `with check (bucket_id = 'media')` — jeder Ordner, auch
-- `beispiel/` (der jetzt für alle lesbar ist), und beliebig viele Dateien.
-- Jetzt nur die sechs Ordner, die App und Website benutzen, und höchstens
-- 300 Dateien je Konto und Tag: Speicher und Egress sind das, was am 10.10.
-- das ganze Projekt gesperrt hat, und ein einziges Konto mit einem Skript
-- hätte das absichtlich wiederholen können.
create or replace function public.upload_kontingent_frei()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) < 300
  from storage.objects
  where bucket_id = 'media'
    and owner_id = auth.uid()::text
    and created_at > now() - interval '1 day';
$$;

drop policy if exists "Eigene Medien hochladen" on storage.objects;
create policy "Eigene Medien hochladen" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and split_part(name, '/', 1) in ('messages', 'stories', 'avatars', 'posts', 'insights', 'ptt')
    and public.upload_kontingent_frei()
  );

revoke execute on function public.medien_adresse(text) from public, anon;
revoke execute on function public.medium_sichtbar(text) from public, anon;
revoke execute on function public.upload_kontingent_frei() from public, anon;
grant execute on function public.medien_adresse(text) to authenticated;
grant execute on function public.medium_sichtbar(text) to authenticated;
grant execute on function public.upload_kontingent_frei() to authenticated;


-- ---------------------------------------------------------------------
-- 2. MEDIENADRESSEN UND REAKTIONEN: nur, was wir selbst erzeugen
-- ---------------------------------------------------------------------
--
-- `stories.media_url`, `insights.media_url` & Co. nahmen jeden Text. Die
-- Website setzt sie in ein Stil-Attribut — `x);"><meta http-equiv=refresh
-- …>` leitete jeden, der die Storyleiste sah, auf eine fremde Seite um
-- (Prüfung 17.10., lokal mit der Live-CSP nachgestellt). Und eine fremde
-- Adresse (`https://angreifer.example/pixel.jpg`) hätte jedem Betrachter
-- die IP-Adresse abgenommen. Erlaubt ist jetzt nur noch die Form, die
-- `hochladen()` (web/server/medien.js) und `ladeHoch()` (app/lib/
-- supabaseStorage.ts) selbst bauen. Der ganze Bestand passt (geprüft).
--
-- Eine Funktion statt eines Musters in jeder Regel: zieht der Medienserver
-- um (Hetzner-Plan vom 10.10.), ändert sich genau diese eine Stelle.

create or replace function public.medien_adresse_gueltig(adresse text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select adresse is null
      or adresse ~ '^https://ijztosbjfybdgotpdixw\.supabase\.co/storage/v1/object/public/media/[a-z]+/[A-Za-z0-9._-]+$';
$$;
revoke execute on function public.medien_adresse_gueltig(text) from public, anon;
grant execute on function public.medien_adresse_gueltig(text) to authenticated;

do $$
declare
  ziel record;
begin
  for ziel in
    select * from (values
      ('stories', 'media_url'), ('insights', 'media_url'), ('posts', 'media_url'),
      ('posts', 'thumbnail_url'), ('messages', 'media_url'), ('ptt_messages', 'audio_url'),
      ('community_channel_messages', 'media_url')
    ) as t(tabelle, spalte)
  loop
    execute format('alter table public.%I drop constraint if exists %I',
                   ziel.tabelle, ziel.tabelle || '_' || ziel.spalte || '_eigener_eimer');
    execute format('alter table public.%I add constraint %I check (public.medien_adresse_gueltig(%I))',
                   ziel.tabelle, ziel.tabelle || '_' || ziel.spalte || '_eigener_eimer', ziel.spalte);
  end loop;
end $$;

-- Reaktionen: genau die sechs aus dem Menü (app/components/NachrichtSheet.tsx
-- REAKTIONEN, web/public/app.js REAKTIONEN). Vorher ging jeder Text durch,
-- und die Website gab ihn ungeprüft als HTML aus.
alter table public.message_reactions drop constraint if exists message_reactions_emoji_aus_menue;
alter table public.message_reactions add constraint message_reactions_emoji_aus_menue
  check (emoji in ('👍', '❤️', '😂', '😮', '😢', '🙏'));

-- Und nur an Nachrichten in Chats, in denen man selbst ist. Vorher genügte
-- `user_id = auth.uid()` — man konnte an jede Nachricht reagieren, deren ID
-- man kannte, und damit Mitteilungen in fremden Chats auslösen.
drop policy if exists "Eigene Reaktion setzen" on public.message_reactions;
create policy "Eigene Reaktion setzen" on public.message_reactions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.messages m where m.id = message_id and public.is_chat_member(m.chat_id))
  );


-- ---------------------------------------------------------------------
-- 3. starter_sammlungen: wieder zu (Drift seit Schema 47)
-- ---------------------------------------------------------------------
--
-- Schema 47 hatte `starter_sammlungen(ziel)` für alle entzogen; live war es
-- am 16.10. wieder für jeden Angemeldeten aufrufbar — vermutlich durch das
-- erneute Einspielen einer älteren Datei. Die Funktion prüft weder Aufrufer
-- noch Testkonto: jeder konnte in fremde Profile Playlists und Highlights
-- schreiben und dabei die aktuelle Story des Opfers in ein Highlight legen —
-- das sie über die Highlight-Regel dauerhaft für alle sichtbar machte, auch
-- eine Story nur für Messenger-Kontakte. Sie wird nur aus zuruecksetzen()
-- gerufen, und das läuft als Eigentümer.
revoke execute on function public.starter_sammlungen(uuid) from public, anon, authenticated;

-- Die Highlight-Regel selbst: eine Story im Highlight bleibt so sichtbar,
-- wie sie veröffentlicht wurde (Videos-Story für alle, Messenger-Story für
-- Kontakte), und nur das Highlight ihres eigenen Profils zählt.
drop policy if exists stories_im_highlight on public.stories;
create policy stories_im_highlight on public.stories
  for select to authenticated
  using (
    (
      user_id = (select auth.uid())
      or (
        public.sichtbar_fuer(user_id, 'story', (select auth.uid()))
        and (in_videos or (in_messenger and public.ist_messenger_kontakt(user_id, (select auth.uid()))))
      )
    )
    and exists (
      select 1 from public.sammlung_inhalte si
        join public.sammlungen s on s.id = si.sammlung_id
       where si.story_id = stories.id and s.art = 'highlight' and s.user_id = stories.user_id
    )
  );


-- ---------------------------------------------------------------------
-- 4. CHATS: kein Selbsteintrag, keine Gruppe als Hintertür, Blockieren wirkt
-- ---------------------------------------------------------------------
--
-- Nachgestellt am 17.10. als Prüfkonto (Transaktion, zurückgerollt):
--   * Gruppe anlegen, beliebige Person eintragen → erlaubt. Damit griffen
--     weder Chat-Anfrage noch DM-Sperre noch „Messenger nur mit Zustimmung"
--     noch die Einstellung „Gruppen: wer darf hinzufügen".
--   * `darf_mitglied_werden`: „Sich selbst einzutragen ist immer erlaubt" —
--     wer eine Chat-ID kennt (jedes ehemalige Mitglied), las mit, und die
--     App verschlüsselte künftige Nachrichten auch für ihn.
--   * `blocks` stand in keiner einzigen Schreibregel: wer blockiert wurde,
--     schrieb einfach weiter.

-- Beidseitig blockiert? Nur mit dem Aufrufer als einer der beiden — sonst
-- wäre die Funktion selbst ein Orakel über fremde Blocklisten.
create or replace function public.blockiert_zwischen(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (auth.uid() is null or auth.uid() in (a, b))
     and exists (
       select 1 from public.blocks
        where (user_id = a and blocked_user_id = b)
           or (user_id = b and blocked_user_id = a)
     );
$$;
revoke execute on function public.blockiert_zwischen(uuid, uuid) from public, anon;
grant execute on function public.blockiert_zwischen(uuid, uuid) to authenticated;

create or replace function public.darf_mitglied_werden(ziel_chat uuid, wer uuid)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  gruppe  boolean;
  bereich text;
  ersteller uuid;
  angelegt timestamptz;
  wahl    text;
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
  -- Zug ein). Bis 17.10. war das immer erlaubt; nachgestellt: das Prüfkonto
  -- kam in einen Chat zurück, den es vor sechs Wochen verlassen hatte. Das
  -- Anlegedatum setzt seit diesem Schema die Datenbank (chat_spalten_schuetzen).
  if wer = auth.uid() then
    return coalesce(ersteller = auth.uid() and angelegt > now() - interval '10 minutes', false);
  end if;

  if public.blockiert_zwischen(auth.uid(), wer) then
    return false;
  end if;

  if gruppe then
    -- „Gruppen: wer darf hinzufügen" (Einstellungen, App und Website).
    -- Stand bis 17.10. nur in der Oberfläche, die Datenbank kannte sie nicht.
    select s.wert into wahl from public.user_settings s
     where s.user_id = wer and s.schluessel = 'gruppenHinzufuegen';
    wahl := coalesce(wahl, 'Meine Kontakte');
    if wahl = 'Alle' then return true; end if;
    if wahl = 'Niemand' then return false; end if;
    return public.ist_messenger_kontakt(wer, auth.uid());
  end if;

  if coalesce(bereich, 'messenger') = 'messenger'
     and not public.messenger_erlaubt(auth.uid(), wer) then
    return false;
  end if;

  return public.darf_angeschrieben_werden(wer, auth.uid());
end;
$$;

-- Wer nicht blockiert ist, darf schreiben — die übrigen Regeln bleiben.
-- Gruppen sind jetzt nur noch bei der Blockierung eine Ausnahme: wer
-- jemanden blockiert, liest ihn auch in gemeinsamen Gruppen nicht mehr als
-- neuen Absender; darüber hinaus gilt „keine Einzelfallprüfung" wie bisher.
create or replace function public.darf_schreiben(ziel_chat uuid, absender uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when (select coalesce(c.is_group, false) from public.chats c where c.id = ziel_chat)
      then true
    else coalesce((
      select bool_and(
               public.sichtbar_fuer(m.user_id, 'dm', absender)
               and not exists (
                 select 1 from public.blocks b
                  where (b.user_id = m.user_id and b.blocked_user_id = absender)
                     or (b.user_id = absender and b.blocked_user_id = m.user_id)
               )
             )
        from public.chat_members m
       where m.chat_id = ziel_chat and m.user_id <> absender
    ), true)
  end;
$$;

-- Zweierchats bleiben zu zweit. Die App verschlüsselt für jeden Schlüssel
-- jedes Mitglieds; ein drittes Mitglied hätte still mitgelesen.
create or replace function public.zweierchat_zu_zweit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.chats c where c.id = new.chat_id and not c.is_group)
     and (select count(*) from public.chat_members m where m.chat_id = new.chat_id) >= 2 then
    raise exception 'Ein Einzelchat hat genau zwei Mitglieder' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists zweierchat_zu_zweit on public.chat_members;
create trigger zweierchat_zu_zweit before insert on public.chat_members
  for each row execute function public.zweierchat_zu_zweit();
revoke execute on function public.zweierchat_zu_zweit() from public, anon, authenticated;

-- Die Spalten, an denen Chat-Anfrage und Gruppenregel hängen, setzt nur die
-- Datenbank. Nachgestellt: `update chats set anfrage_von = null` hob eine
-- abgelehnte Anfrage auf, `is_group = true` machte aus einem Zweierchat eine
-- Gruppe ohne Prüfung, und ein Chat ließ sich gleich als „angenommen" anlegen.
create or replace function public.chat_spalten_schuetzen()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;                -- eigene Funktionen und Auslöser der Datenbank
  end if;
  if tg_op = 'INSERT' then
    new.anfrage_zustand := 'offen';
    new.anfrage_von := null;
    new.messenger_anfrage := 'keine';
    new.messenger_anfrage_von := null;
    new.created_at := now();
    return new;
  end if;
  -- Der eine erlaubte Wechsel von anfrage_von: chat_anfrage_setzen (kein
  -- security definer, läuft also als authenticated) legt beim zweiten
  -- Mitglied die Anfrage an — offen → wartet, von = Ersteller.
  if new.anfrage_von is distinct from old.anfrage_von
     and not (old.anfrage_zustand = 'offen' and new.anfrage_zustand = 'wartet'
              and new.anfrage_von = old.created_by) then
    raise exception 'Diese Angabe des Chats lässt sich nicht ändern' using errcode = '42501';
  end if;
  if new.is_group is distinct from old.is_group
     or new.created_by is distinct from old.created_by
     or new.bereich is distinct from old.bereich
     or new.created_at is distinct from old.created_at then
    raise exception 'Diese Angabe des Chats lässt sich nicht ändern' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists chat_spalten_schuetzen on public.chats;
create trigger chat_spalten_schuetzen before insert or update on public.chats
  for each row execute function public.chat_spalten_schuetzen();
revoke execute on function public.chat_spalten_schuetzen() from public, anon;
grant execute on function public.chat_spalten_schuetzen() to authenticated;


-- ---------------------------------------------------------------------
-- 5. COMMUNITYS: private bleiben privat
-- ---------------------------------------------------------------------
--
-- Nachgestellt am 17.10. als Prüfkonto: `community_members` war für jeden
-- komplett lesbar (14 private Communitys, deren IDs man so erfuhr), und
-- „Selbst beitreten" prüfte die Sichtbarkeit nicht. Nach dem Eintrag:
-- Community sichtbar, 2 Kanäle, 3 Kanalnachrichten.

drop policy if exists "Selbst beitreten und verlassen" on public.community_members;
drop policy if exists "Community-Mitglieder lesen" on public.community_members;
drop policy if exists "Community beitreten" on public.community_members;
drop policy if exists "Eigene Mitgliedschaft aendern" on public.community_members;
drop policy if exists "Community verlassen" on public.community_members;
drop policy if exists "Mitglieder sichtbarer Communitys lesen" on public.community_members;

create policy "Community beitreten" on public.community_members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.communities c
       where c.id = community_id
         and (c.visibility = 'public' or c.created_by = (select auth.uid()))
    )
  );
create policy "Eigene Mitgliedschaft aendern" on public.community_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Community verlassen" on public.community_members
  for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Mitglieder sichtbarer Communitys lesen" on public.community_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.community_sichtbar(community_id));


-- ---------------------------------------------------------------------
-- 6. INSIGHTS: nur an Menschen, mit denen man in Verbindung steht
-- ---------------------------------------------------------------------
--
-- „Empfaenger eintragen" prüfte nur, dass man der Absender ist — ein
-- Insight ließ sich an jede beliebige Profil-ID schicken, auch an Fremde
-- und an Leute, die einen blockiert haben. Jetzt: nicht blockiert, und
-- entweder Messenger-Kontakt oder ein gemeinsamer Chat.
drop policy if exists "Empfaenger eintragen" on public.insight_recipients;
create policy "Empfaenger eintragen" on public.insight_recipients
  for insert to authenticated
  with check (
    public.ist_insight_absender(insight_id)
    and not public.blockiert_zwischen((select auth.uid()), user_id)
    and (public.ist_messenger_kontakt(user_id, (select auth.uid())) or public.teilt_chat(user_id))
  );


-- ---------------------------------------------------------------------
-- 7. ORAKEL: Funktionen, die über fremde Beziehungen Auskunft gaben
-- ---------------------------------------------------------------------
--
-- `fuehrt_als_kontakt(wer, wen)` und `ist_messenger_kontakt(eigner,
-- betrachter)` nahmen beide Personen als Parameter und prüften den Aufrufer
-- nicht. Über alle Profil-IDs aufgerufen, ergab das die Kontaktliste jedes
-- Nutzers. Alle Aufrufer (Leseregel der Storys, Auslöser der Chat-Anfrage
-- und des Kontakts, Schema 95 oben) haben den Aufrufer selbst als eine der
-- beiden Personen — die Einschränkung ändert für sie nichts.
-- Gleiches Muster wie Fund 13 (Schema 23) für die Like-Funktionen.
create or replace function public.fuehrt_als_kontakt(wer uuid, wen uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (auth.uid() is null or auth.uid() in (wer, wen))
     and exists (
       select 1 from public.contacts
        where user_id = wer and contact_id = wen and status = 'friend'
     );
$$;

create or replace function public.ist_messenger_kontakt(eigner uuid, betrachter uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (auth.uid() is null or auth.uid() in (eigner, betrachter))
     and exists (
       select 1 from public.contacts c
        where c.status = 'friend'
          and ((c.user_id = betrachter and c.contact_id = eigner)
            or (c.user_id = eigner and c.contact_id = betrachter))
     );
$$;

-- Altlasten aus der Zeit vor Schema 52 (maßgeblich ist seit dort
-- `konto_alter`): beide lasen Alter und Eltern-Status BELIEBIGER Konten aus
-- `profiles.geburtsdatum`. Keine Regel und keine Funktion ruft sie noch.
revoke execute on function public.alter_jahre(uuid) from public, anon, authenticated;
revoke execute on function public.freigegeben(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 8. ANONYM: nichts außer der Altersgrenzen-Tabelle
-- ---------------------------------------------------------------------
--
-- `anon` hatte auf fast allen Tabellen noch Tabellen- und Spaltenrechte,
-- auch auf `profiles.phone` und `geburtsdatum`. Folgenlos nur, weil keine
-- Regel `to anon` existiert — eine einzige neu angelegte Regel ohne
-- `to authenticated` (das Muster aus „Schema 7 dreht Regeln zurück") hätte
-- sie offengelegt. Die Registrierung braucht nur `altersgrenzen` und die
-- zwei Funktionen `handle_frei`/`nummer_frei`.
revoke all on all tables in schema public from anon;
grant select on public.altersgrenzen to anon;
alter default privileges in schema public revoke all on tables from anon;


-- ---------------------------------------------------------------------
-- 9. WARTENDE KINDERKONTEN: auch der Medienspeicher
-- ---------------------------------------------------------------------
--
-- `nur_freigegebene` (Schema 52) sperrt Konten, die auf die Eltern warten,
-- aus allen Tabellen — `storage.objects` hatte die Regel nicht.
drop policy if exists nur_freigegebene on storage.objects;
create policy nur_freigegebene on storage.objects
  as restrictive
  for all to authenticated
  using ((select public.konto_freigegeben()))
  with check ((select public.konto_freigegeben()));


-- ---------------------------------------------------------------------
-- 10. REALTIME: ausgeschaltet, was niemand benutzt
-- ---------------------------------------------------------------------
--
-- Sechs Tabellen standen in der Realtime-Veröffentlichung, abonniert hat
-- sie weder App noch Website (test:stumm prüft sogar, dass es keine
-- Echtzeit-Horcher gibt). Jede veröffentlichte Tabelle ist eine Tür mehr,
-- die bei einer zu weiten Leseregel aufgeht.
do $$
declare
  t text;
begin
  foreach t in array array['chats', 'messages', 'stories', 'post_likes', 'comments', 'notifications'] loop
    if exists (select 1 from pg_publication_tables
                where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 11. SPALTEN, DIE NUR DIE DATENBANK SETZT
-- ---------------------------------------------------------------------
--
-- Die Regeln prüften bei UPDATE nur den Besitzer („auth.uid() = user_id"),
-- nicht, WAS geändert wird. Nachgestellt bzw. aus den Rechten abgeleitet:
--   * eigene Nachricht per `chat_id` in einen fremden Chat schieben — vorbei
--     an Mitgliedschaft, DM-Sperre und Chat-Anfrage;
--   * eigene Mitgliedszeile per `chat_id` auf einen fremden Chat umbiegen;
--   * eigene Empfängerzeile per `insight_id` auf ein fremdes Insight setzen;
--   * Kommentar per `post_id` unter einen Beitrag schieben, der keine erlaubt;
--   * `posts.created_at` in die Zukunft: dauerhaft Platz 1 im Feed aller;
--   * `likes_basis`, `followers_basis`, `views`, `demo`: gefälschte Zahlen.
--
-- WARUM AUSLÖSER STATT SPALTENRECHTEN: Spaltenrechte wären die
-- Lehrbuch-Lösung, aber jede neue Spalte (88, 90, 92 auf dem Sammelzweig
-- bringen schon drei) bräuchte dann ein eigenes `grant`, und wer es vergisst,
-- bricht ein Feature still. Hier steht umgekehrt die kurze Liste dessen, was
-- NICHT geht. Eigene Funktionen der Datenbank (security definer, Testbestand,
-- Zählerfunktionen) laufen nicht als `authenticated` und sind ausgenommen.

create or replace function public.spalten_fest()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  spalte text;
  alt jsonb := to_jsonb(old);
  neu jsonb := to_jsonb(new);
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  foreach spalte in array tg_argv loop
    if (alt -> spalte) is distinct from (neu -> spalte) then
      raise exception 'Die Angabe „%" lässt sich nicht ändern', spalte using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;
revoke execute on function public.spalten_fest() from public, anon;
grant execute on function public.spalten_fest() to authenticated;

do $$
declare
  z record;
begin
  for z in
    select * from (values
      ('profiles',           array['id', 'demo', 'followers_basis', 'following_basis', 'beitraege_basis', 'created_at']),
      ('posts',              array['id', 'user_id', 'created_at', 'demo', 'likes_basis', 'shares_basis', 'comments_basis', 'views']),
      ('messages',           array['id', 'chat_id', 'sender_id', 'created_at', 'demo', 'hinweis', 'read_at',
                                   'reply_to', 'quote_of', 'forwarded_from', 'shared_post_id', 'reply_to_story',
                                   'place_id', 'contact_user_id']),
      ('chat_members',       array['chat_id', 'user_id', 'joined_at']),
      ('comments',           array['id', 'post_id', 'user_id', 'created_at']),
      ('insight_recipients', array['insight_id', 'user_id']),
      ('community_members',  array['community_id', 'user_id', 'joined_at']),
      ('location_requests',  array['id', 'chat_id', 'sender_id', 'ziel_id']),
      ('krypto_schluessel',  array['id', 'user_id', 'created_at']),
      ('stories',            array['id', 'user_id', 'created_at', 'expires_at', 'demo', 'media_url']),
      ('insights',           array['id', 'sender_id', 'created_at', 'media_url'])
    ) as t(tabelle, spalten)
  loop
    execute format('drop trigger if exists spalten_fest on public.%I', z.tabelle);
    execute format(
      'create trigger spalten_fest before update on public.%I for each row execute function public.spalten_fest(%s)',
      z.tabelle,
      (select string_agg(quote_literal(s), ', ') from unnest(z.spalten) s)
    );
  end loop;
end $$;

-- Beim Anlegen: was die Datenbank vorgibt, gibt sie auch wirklich vor.
create or replace function public.anlegen_vorgaben()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_table_name = 'posts' then
    new.created_at := now();
    new.demo := false;
    new.likes_basis := 0;
    new.shares_basis := 0;
    new.comments_basis := 0;
    new.views := 0;
  elsif tg_table_name = 'messages' then
    new.created_at := now();
    new.demo := false;
    new.hinweis := null;
    new.read_at := null;
    new.edited_at := null;
    new.deleted_at := null;
  elsif tg_table_name = 'stories' then
    new.created_at := now();
    new.demo := false;
    -- Eine Story lebt höchstens einen Tag. Vorher ließ sich `expires_at`
    -- auf 2036 setzen — eine „Story", die nie verschwindet.
    if new.expires_at is null or new.expires_at > now() + interval '24 hours' then
      new.expires_at := now() + interval '24 hours';
    end if;
  elsif tg_table_name in ('comments', 'krypto_schluessel', 'insights') then
    new.created_at := now();
  end if;
  return new;
end;
$$;
revoke execute on function public.anlegen_vorgaben() from public, anon;
grant execute on function public.anlegen_vorgaben() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['posts', 'messages', 'stories', 'comments', 'krypto_schluessel', 'insights'] loop
    execute format('drop trigger if exists anlegen_vorgaben on public.%I', t);
    execute format('create trigger anlegen_vorgaben before insert on public.%I for each row execute function public.anlegen_vorgaben()', t);
  end loop;
end $$;

-- Benutzername: direkt gesetzt (profilAendern schreibt `handle` mit) nur in
-- der Form, die auch handle_aendern() verlangt. Vorher gingen Leerzeichen,
-- Großbuchstaben und Doppelgänger wie `@һenrik` (kyrillisches h) durch.
create or replace function public.handle_form_pruefen()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'authenticated'
     and new.handle is distinct from old.handle
     and (left(new.handle, 1) <> '@' or not public.handle_gueltig(substr(new.handle, 2))) then
    raise exception 'Drei bis vierundzwanzig Zeichen: Buchstaben, Ziffern, Punkt und Unterstrich.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists handle_form_pruefen on public.profiles;
create trigger handle_form_pruefen before update on public.profiles
  for each row execute function public.handle_form_pruefen();
revoke execute on function public.handle_form_pruefen() from public, anon;
grant execute on function public.handle_form_pruefen() to authenticated;

-- Telefonnummer: eindeutig in der Vergleichsform, nicht nur im Rohtext.
-- `0170 1234567` und `+49 170 1234567` sind dieselbe Nummer; vorher konnte
-- ein zweites Konto sie in anderer Schreibweise belegen und bei der Suche
-- nach der Nummer statt des echten Inhabers erscheinen. Bestand am 17.10.:
-- keine Dublette.
create unique index if not exists profiles_phone_vergleich_einmalig
  on public.profiles (public.nummer_vergleichsform(phone))
  where phone is not null and phone <> '';

-- Geplante Beiträge („später posten") filterte nur der Client. Die Regel
-- lieferte sie vorab an jeden, der direkt fragte.
drop policy if exists geplant_erst_spaeter on public.posts;
create policy geplant_erst_spaeter on public.posts
  as restrictive
  for select to authenticated
  using (publish_at is null or publish_at <= now() or user_id = (select auth.uid()));
