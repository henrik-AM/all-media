-- ============================================================================
--  SCHEMA 57 — In den Messenger nur mit Zustimmung (Feedback 21.09., Kasten 3)
-- ============================================================================
--
--  Henrik, zum vierten Mal: „Lernt man jemanden unter Videos kennen, wird
--  zuerst unter Communitys → Chats geschrieben. Erst nach etwas Austausch
--  kann eine Anfrage gehen, ob man in den Messenger wechselt. Nimmt die
--  Person an, erscheint sie im Messenger — sonst bleibt alles unter
--  Communitys." Und als Release-Regel: kein neuer Nutzer taucht von selbst
--  in fremden Messenger-Listen auf. Zweiter Weg hinein: Plus → Telefonnummer.
--
--  WAS DAGEGEN IM BESTAND STAND (gemessen am 24.09.2026)
--
--  Das Konto @tanti hat am 20.09. um 18:27 ein Video an sieben Leute geteilt.
--  Jedes Teilen legte einen MESSENGER-Chat an — bei @h.dikta, @ralle,
--  @user.hugo, @jarno.riegel und drei weiteren stand danach eine fremde
--  Person im Messenger. Drei Lücken zusammen:
--
--    1. Außerhalb von Communitys fiel die Oberfläche auf 'messenger' zurück
--       (bereichFuer in App.tsx und app.js) — Videos gehörte dazu.
--    2. Die Datenbank prüfte beim Eintragen des zweiten Mitglieds nur die
--       DM-Sperre, nicht, ob die beiden überhaupt Kontakte sind.
--    3. `contacts` nahm jede Zeile an, die der Eigentümer schrieb — ohne die
--       Nummer zu kennen, reichte die Kennung aus einem Profil. Und die
--       Website trug beim Annehmen JEDER Chat-Anfrage das Gegenüber als
--       Kontakt ein, auch unter Communitys.
--
--  WAS JETZT GILT
--
--    A. Ein Kontakt entsteht nur über die Nummer (finde_per_nummer merkt sich
--       den Treffer), als Antwort auf jemanden, der mich schon führt, oder
--       über eine angenommene Messenger-Anfrage.
--    B. Ein Zweierchat im Messenger nimmt das zweite Mitglied nur auf, wenn
--       einer den anderen als Kontakt führt (messenger_erlaubt).
--    C. Aus einem Community-Chat heraus lässt sich fragen, ob man in den
--       Messenger wechselt — erst, wenn beide dort schon geschrieben haben.
--       Annehmen legt beide Kontakte und den Messenger-Chat an; ablehnen
--       ändert nichts, der Community-Chat bleibt, wie er ist.
--    D. Wer nur über eine Anfrage Kontakt ist, sieht die Nummer des anderen
--       nicht. Die Trennung „Community = ohne Telefonnummer" gilt weiter.
--
--  Einspielen: SUPABASE_TOKEN=… node tools/sql-einspielen.mjs \
--              SUPABASE_SCHEMA_57_messenger_nur_mit_zustimmung.sql
--  Mehrfach einspielbar.
-- ============================================================================


-- ---------------------------------------------------------------------------
--  1. Woher ein Kontakt kommt
-- ---------------------------------------------------------------------------

alter table public.contacts
  add column if not exists herkunft text not null default 'nummer';

do $$
begin
  alter table public.contacts
    add constraint contacts_herkunft_check check (herkunft in ('nummer', 'anfrage'));
exception when duplicate_object then null;
end $$;

-- Der Nachweis, dass jemand die Nummer kannte. Nur finde_per_nummer schreibt
-- hier hinein; lesen darf niemand von außen.
create table if not exists public.nummer_treffer (
  nutzer uuid not null references public.profiles (id) on delete cascade,
  ziel   uuid not null references public.profiles (id) on delete cascade,
  zeit   timestamptz not null default now(),
  primary key (nutzer, ziel)
);

alter table public.nummer_treffer enable row level security;
revoke all on public.nummer_treffer from anon, authenticated;

-- Wie jede Tabelle seit Schema 52, Teil 4 — auch wenn hier ohnehin niemand
-- von außen hinkommt: test:minderjaehrig zählt nach.
drop policy if exists nur_freigegebene on public.nummer_treffer;
create policy nur_freigegebene on public.nummer_treffer as restrictive for all to authenticated
  using ((select public.konto_freigegeben())) with check ((select public.konto_freigegeben()));


-- Unverändert bis auf den Eintrag des Treffers am Ende (Stand Schema 38).
create or replace function public.finde_per_nummer(nummer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ich     uuid := auth.uid();
  gesucht text := public.nummer_vergleichsform(nummer);
  bisher  integer;
  treffer jsonb;
  -- Vierzig Nachschlaege je Stunde und Konto. Wer Kontakte eintippt, merkt
  -- davon nichts; wer eine Vorwahl durchzaehlt, braucht Jahre.
  grenze  constant integer  := 40;
  fenster constant interval := interval '1 hour';
begin
  if ich is null then
    raise exception 'nicht angemeldet';
  end if;
  -- Zu kurze Eingaben wuerden auf halbe Nummern passen und die Suche in ein
  -- Rateverfahren verwandeln.
  if length(gesucht) < 6 then
    return null;
  end if;

  delete from public.nummer_suche_takt
   where nutzer = ich
     and zeit < now() - fenster;

  select count(*) into bisher
    from public.nummer_suche_takt
   where nutzer = ich;

  if bisher >= grenze then
    -- 54000 = program_limit_exceeded. Ein eigener Code, damit die Aufrufer
    -- die Bremse von einem echten Fehler unterscheiden koennen.
    raise exception 'Zu viele Nummernsuchen. Bitte versuche es spaeter noch einmal.'
      using errcode = '54000';
  end if;

  insert into public.nummer_suche_takt (nutzer) values (ich);

  select to_jsonb(t) into treffer
    from (select p.id, p.name, p.handle, p.initials, p.color, p.privat, p.about
            from public.profiles p
           where p.id <> ich
             and p.phone is not null
             and public.nummer_vergleichsform(p.phone) = gesucht
           limit 1) t;

  -- Schema 57: Wer die Nummer kannte, darf die Person als Kontakt anlegen.
  if treffer is not null then
    insert into public.nummer_treffer (nutzer, ziel)
    values (ich, (treffer ->> 'id')::uuid)
    on conflict (nutzer, ziel) do update set zeit = now();
  end if;

  return treffer;
end;
$$;

revoke execute on function public.finde_per_nummer(text) from public, anon;
grant execute on function public.finde_per_nummer(text) to authenticated;


/*
 * Wer darf eine Kontaktzeile schreiben?
 *
 * Ohne `security definer`, aus demselben Grund wie in Schema 21: der Auslöser
 * unterscheidet an `current_user`, ob die Zeile aus App und Website kommt
 * oder aus der Datenbank selbst (Testbestand, Messenger-Anfrage). Die Blicke
 * in fremde Zeilen gehen über Hilfsfunktionen mit erhöhten Rechten.
 */
create or replace function public.nummer_bekannt(wer uuid, wen uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Nur die eigene Suche: wer wessen Nummer kennt, geht niemanden sonst an.
  select (auth.uid() is null or wer = auth.uid())
     and exists (select 1 from public.nummer_treffer where nutzer = wer and ziel = wen);
$$;

revoke execute on function public.nummer_bekannt(uuid, uuid) from public, anon;
grant execute on function public.nummer_bekannt(uuid, uuid) to authenticated;

create or replace function public.kontakt_pruefen()
returns trigger
language plpgsql
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Die Herkunft legt die Datenbank fest, nicht die Oberfläche: sonst
    -- ließe sich aus „anfrage" „nummer" machen und damit die Nummer lesen.
    new.herkunft := old.herkunft;
    if new.contact_id is distinct from old.contact_id then
      raise exception 'Ein Kontakt lässt sich nicht auf eine andere Person umschreiben';
    end if;
    return new;
  end if;

  new.herkunft := 'nummer';

  if public.nummer_bekannt(new.user_id, new.contact_id) then
    return new;
  end if;

  -- Wer mich schon als Kontakt führt, hat meine Nummer eingegeben oder eine
  -- Anfrage angenommen. Ihn zurück einzutragen ist keine Überrumpelung.
  if public.fuehrt_als_kontakt(new.contact_id, new.user_id) then
    return new;
  end if;

  raise exception 'Kontakte kommen über die Telefonnummer oder eine angenommene Messenger-Anfrage';
end;
$$;

drop trigger if exists kontakt_pruefen on public.contacts;
create trigger kontakt_pruefen
  before insert or update on public.contacts
  for each row execute function public.kontakt_pruefen();


/*
 * Die Mitteilung beim neuen Kontakt (Schema 44) — nicht bei einer Anfrage.
 *
 * Nimmt jemand eine Messenger-Anfrage an, trägt die Datenbank beide
 * Richtungen ein, eine davon im Namen der anderen Person. `benachrichtige`
 * lässt aber nur Mitteilungen im eigenen Namen zu und brach das Annehmen mit
 * „nicht erlaubt" ab. Die Anfrage meldet sich ohnehin selbst (messenger_ok);
 * ein zusätzliches „hat dich hinzugefügt" wäre doppelt.
 */
create or replace function public.on_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.herkunft = 'anfrage' then
    return new;
  end if;
  -- 'videos' statt 'aktivitaet': siehe Nachtrag in Schema 44.
  perform public.benachrichtige(new.contact_id, new.user_id, 'follow', 'videos', 'user', new.user_id, '');
  return new;
end;
$$;

revoke execute on function public.on_contact() from public, anon, authenticated;


-- Die Nummer nur dort, wo sie eingegeben wurde (Punkt D). Sonst wie Schema 23.
create or replace function public.meine_kontaktnummern()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ich uuid := auth.uid();
begin
  if ich is null then
    raise exception 'nicht angemeldet';
  end if;

  return coalesce((
    select jsonb_object_agg(p.id::text, p.phone)
      from public.profiles p
     where p.phone is not null
       and exists (select 1 from public.contacts c
                    where c.user_id = p.id and c.contact_id = ich and c.status = 'friend'
                      and c.herkunft = 'nummer')
  ), '{}'::jsonb);
end;
$$;

revoke execute on function public.meine_kontaktnummern() from public, anon;
grant execute on function public.meine_kontaktnummern() to authenticated;


-- ---------------------------------------------------------------------------
--  2. Messenger nur unter Kontakten
-- ---------------------------------------------------------------------------

/*
 * Darf `ich` mit `ziel` einen Zweierchat im Messenger haben?
 *
 * Ja, wenn einer von beiden den anderen als Kontakt führt. Eine Richtung
 * reicht: wer meine Nummer eingegeben hat, darf mir schreiben — wie bei
 * WhatsApp. Die erste Nachricht ist dann trotzdem eine Anfrage (Schema 21).
 *
 * Dieselbe Frage stellen App und Website vor dem Anlegen (chatMit), damit
 * sie einen Fremden gleich in die Community-Chats schicken, statt an der
 * Regel unten zu scheitern.
 *
 * Nur für sich selbst: sonst verriete die Funktion jedem, wer mit wem
 * Kontakt ist. Ohne Anmeldung (auth.uid() leer) fragt die Datenbank selbst.
 */
create or replace function public.messenger_erlaubt(ich uuid, ziel uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (auth.uid() is null or ich = auth.uid()) and exists (
    select 1 from public.contacts
     where (user_id = ich and contact_id = ziel and status <> 'blocked')
        or (user_id = ziel and contact_id = ich and status = 'friend')
  );
$$;

revoke execute on function public.messenger_erlaubt(uuid, uuid) from public, anon;
grant execute on function public.messenger_erlaubt(uuid, uuid) to authenticated;


-- Wie Schema 22, ergänzt um Punkt B.
create or replace function public.darf_mitglied_werden(ziel_chat uuid, wer uuid)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  gruppe  boolean;
  bereich text;
begin
  -- Der Testbestand und alles, was die Datenbank selbst aufbaut.
  if current_user <> 'authenticated' then
    return true;
  end if;

  -- Sich selbst einzutragen ist immer erlaubt.
  if wer = auth.uid() then
    return true;
  end if;

  select c.is_group, c.bereich into gruppe, bereich from public.chats c where c.id = ziel_chat;

  if gruppe is null then
    return false;              -- Chat nicht gefunden: im Zweifel nein.
  end if;

  if gruppe then
    return true;               -- Gruppe oder Kanal: keine Einzelfallprüfung.
  end if;

  -- Schema 57: Fremde lernt man unter Communitys kennen, nicht im Messenger.
  if coalesce(bereich, 'messenger') = 'messenger'
     and not public.messenger_erlaubt(auth.uid(), wer) then
    return false;
  end if;

  return public.darf_angeschrieben_werden(wer, auth.uid());
end;
$$;


-- ---------------------------------------------------------------------------
--  3. Die Messenger-Anfrage im Community-Chat
-- ---------------------------------------------------------------------------

alter table public.chats
  add column if not exists messenger_anfrage text not null default 'keine',
  add column if not exists messenger_anfrage_von uuid references public.profiles (id) on delete set null;

do $$
begin
  alter table public.chats
    add constraint chats_messenger_anfrage_check
    check (messenger_anfrage in ('keine', 'wartet', 'angenommen', 'abgelehnt'));
exception when duplicate_object then null;
end $$;

/*
 * „Eigene Chats aendern" erlaubt jedem Mitglied ein UPDATE — auch auf diese
 * Spalten. Wie beim Anfragezustand in Schema 21 hilft da keine Policy, nur
 * ein Auslöser: aus der Oberfläche ändert sie niemand, nur die beiden
 * Funktionen unten.
 */
create or replace function public.messenger_anfrage_schuetzen()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'authenticated'
     and (new.messenger_anfrage is distinct from old.messenger_anfrage
          or new.messenger_anfrage_von is distinct from old.messenger_anfrage_von) then
    raise exception 'Die Messenger-Anfrage geht über messenger_anfragen und messenger_anfrage_beantworten';
  end if;
  return new;
end;
$$;

drop trigger if exists messenger_anfrage_schuetzen on public.chats;
create trigger messenger_anfrage_schuetzen
  before update on public.chats
  for each row execute function public.messenger_anfrage_schuetzen();


alter table public.notifications drop constraint if exists notifications_art_check;
alter table public.notifications add constraint notifications_art_check
  check (art in ('like', 'comment', 'follow', 'mention', 'share', 'message', 'system',
                 'repost', 'story', 'kanal', 'beitritt', 'nachricht', 'einladung',
                 'anfrage', 'anfrage_ok', 'messenger_anfrage', 'messenger_ok'));


/*
 * Fragen, ob man in den Messenger wechselt.
 *
 * Nur im Zweierchat unter Communitys, nur als Mitglied, und erst „nach etwas
 * Austausch": beide müssen dort schon geschrieben haben. Wer abgelehnt wurde,
 * fragt nicht noch einmal — die andere Person darf es später selbst.
 */
create or replace function public.messenger_anfragen(p_chat uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ich      uuid := auth.uid();
  der_chat public.chats%rowtype;
  anderer  uuid;
begin
  if ich is null then
    raise exception 'nicht angemeldet';
  end if;

  select * into der_chat from public.chats where id = p_chat;
  if der_chat.id is null or not exists (
    select 1 from public.chat_members where chat_id = p_chat and user_id = ich
  ) then
    raise exception 'Diesen Chat gibt es nicht';
  end if;

  if der_chat.is_group or der_chat.bereich <> 'community' then
    raise exception 'Fragen lässt sich nur aus einem Zweierchat unter Communitys';
  end if;

  select user_id into anderer
    from public.chat_members where chat_id = p_chat and user_id <> ich limit 1;
  if anderer is null then
    raise exception 'In diesem Chat ist niemand außer dir';
  end if;

  if public.messenger_erlaubt(ich, anderer) then
    raise exception 'Ihr seid schon im Messenger verbunden';
  end if;

  if der_chat.messenger_anfrage = 'wartet' then
    raise exception 'Die Anfrage läuft schon';
  end if;
  if der_chat.messenger_anfrage = 'abgelehnt' and der_chat.messenger_anfrage_von = ich then
    raise exception 'Die Anfrage wurde abgelehnt';
  end if;

  if (select count(distinct sender_id) from public.messages
       where chat_id = p_chat and sender_id in (ich, anderer)) < 2 then
    raise exception 'Schreibt euch erst hier ein wenig, dann kannst du fragen';
  end if;

  if not public.darf_angeschrieben_werden(anderer, ich) then
    raise exception 'Diese Person empfängt keine Nachrichten';
  end if;

  update public.chats
     set messenger_anfrage = 'wartet',
         messenger_anfrage_von = ich,
         updated_at = now()
   where id = p_chat;

  -- Oben in der Liste und mit Punkt — sonst sieht die andere Seite nichts.
  update public.chat_members set is_read = false
   where chat_id = p_chat and user_id = anderer;

  perform public.mitteilung_anlegen(anderer, ich, 'messenger_anfrage', 'communities', 'chat', p_chat);

  return jsonb_build_object('ok', true, 'zustand', 'wartet');
end;
$$;

revoke execute on function public.messenger_anfragen(uuid) from public, anon;
grant execute on function public.messenger_anfragen(uuid) to authenticated;


/*
 * Annehmen oder ablehnen — nur die gefragte Person.
 *
 * Annehmen trägt beide gegenseitig als Kontakt ein (Herkunft 'anfrage', also
 * ohne Nummer) und legt den Messenger-Chat an, falls es noch keinen gibt. Der
 * Chat ist sofort frei: angenommen ist angenommen, eine zweite Ein-Nachricht-
 * Hürde aus Schema 21 wäre hier eine Schikane.
 *
 * Der Community-Chat bleibt in beiden Fällen stehen; was dort geschrieben
 * wurde, gehört niemandem weggenommen.
 */
create or replace function public.messenger_anfrage_beantworten(p_chat uuid, p_annehmen boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ich      uuid := auth.uid();
  der_chat public.chats%rowtype;
  von      uuid;
  ziel     uuid;
begin
  if ich is null then
    raise exception 'nicht angemeldet';
  end if;

  select * into der_chat from public.chats where id = p_chat;
  if der_chat.id is null or not exists (
    select 1 from public.chat_members where chat_id = p_chat and user_id = ich
  ) then
    raise exception 'Diesen Chat gibt es nicht';
  end if;

  if der_chat.messenger_anfrage <> 'wartet' then
    raise exception 'Hier wartet keine Messenger-Anfrage';
  end if;

  von := der_chat.messenger_anfrage_von;
  if von = ich then
    raise exception 'Über die eigene Anfrage entscheidet die gefragte Person';
  end if;

  if not p_annehmen then
    update public.chats set messenger_anfrage = 'abgelehnt' where id = p_chat;
    return jsonb_build_object('ok', true, 'zustand', 'abgelehnt');
  end if;

  update public.chats set messenger_anfrage = 'angenommen' where id = p_chat;

  insert into public.contacts (user_id, contact_id, status, herkunft)
  values (ich, von, 'friend', 'anfrage'), (von, ich, 'friend', 'anfrage')
  on conflict (user_id, contact_id) do update
    set status = 'friend'
    where public.contacts.status = 'pending';

  select c.id into ziel
    from public.chats c
    join public.chat_members a on a.chat_id = c.id and a.user_id = ich
    join public.chat_members b on b.chat_id = c.id and b.user_id = von
   where not c.is_group and c.bereich = 'messenger'
   limit 1;

  if ziel is null then
    insert into public.chats (name, is_group, bereich, created_by, anfrage_zustand)
    values ((select name from public.profiles where id = ich), false, 'messenger', von, 'angenommen')
    returning id into ziel;

    insert into public.chat_members (chat_id, user_id)
    values (ziel, von), (ziel, ich)
    on conflict do nothing;
  end if;

  perform public.mitteilung_anlegen(von, ich, 'messenger_ok', 'communities', 'chat', ziel);

  return jsonb_build_object('ok', true, 'zustand', 'angenommen', 'messengerChat', ziel);
end;
$$;

revoke execute on function public.messenger_anfrage_beantworten(uuid, boolean) from public, anon;
grant execute on function public.messenger_anfrage_beantworten(uuid, boolean) to authenticated;


-- Hilfsfunktionen aus diesem Schema: kein geerbtes Ausführungsrecht
-- (Schema 23, Teil C). Auslöserfunktionen ruft niemand direkt auf.
revoke execute on function public.kontakt_pruefen() from public, anon, authenticated;
revoke execute on function public.messenger_anfrage_schuetzen() from public, anon, authenticated;
revoke execute on function public.darf_mitglied_werden(uuid, uuid) from public, anon;
grant execute on function public.darf_mitglied_werden(uuid, uuid) to authenticated;
