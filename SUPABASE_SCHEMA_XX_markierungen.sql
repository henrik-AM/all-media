-- ===========================================================================
--  SUPABASE_SCHEMA_XX_markierungen.sql      (Kasten 25, Entwurf 09.10.2026)
--  @-Markierungen, All Media übergreifend
-- ===========================================================================
--
--  WARUM
--
--  Henrik am 06.10.2026: „Andere Personen sollen mit @ markiert werden
--  können (All Media übergreifend)."
--
--  Was es vorher gab:
--    - post_tags (Schema 20) mit Mitteilung (Schema 49) — gefüllt nur von
--      der App/Website beim ANLEGEN eines Beitrags (markierungenSetzen), nicht
--      beim Bearbeiten, und mit eigener Erkennung in zwei Abschriften.
--    - story_tags (Schema 68/75) für Namensschilder auf Storys.
--    - Die Regel „Wer darf mich markieren" (sichtbar_fuer 'markierung') — sie
--      sah weder Blockierungen noch Minderjährige noch Testkonten.
--    - In Kommentaren, Chats, Gruppen und Community-Unterthemen: nichts.
--
--  WAS DIESE DATEI TUT
--
--   1. markierung_handles(text) — die @-Namen eines Textes. DASSELBE Muster
--      wie gemeinsam/markierung.js (MUSTER_QUELLE); test:markierung-einheit
--      vergleicht beide wörtlich.
--   2. darf_markieren_person(wer, wen) — EINE Regel für jede Markierung:
--        - nicht sich selbst,
--        - beide freigegeben (Schema 52: wartende Konten weder als Markierte
--          noch als Markierende),
--        - keine Blockierung, in keiner Richtung,
--        - „Wer darf mich markieren" (sichtbar_fuer 'markierung'),
--        - Testkonten markieren keine echten Konten (Schema 62/73),
--        - Minderjährige nur von Personen, die sie selbst als Kontakt führen
--          (Schema 52/58: Kinder werden nur über die Telefonnummer gefunden,
--          also von Fremden auch nicht über @ erreicht).
--   3. Tabelle markierungen — wer in welchem Text (Beitrag, Kommentar,
--      Chatnachricht, Kanalnachricht) markiert wurde. Lesen: der Markierte und
--      der Markierende. Schreiben: nur die Auslöser und markierungen_melden().
--   4. Auslöser auf posts, comments, messages, community_channel_messages:
--      beim Anlegen UND Bearbeiten wird der Text aufgelöst. Beim Bearbeiten
--      bekommen nur NEU Markierte eine Mitteilung; wer aus dem Text
--      verschwindet, verliert Markierung und Mitteilung (wie Schema 61/75).
--      Beim Löschen des Inhalts verschwinden beide ebenfalls.
--   5. Mitteilung nur, wenn der Markierte den Inhalt sehen darf:
--        Beitrag/Kommentar  beitrag_sichtbar-Rechnung für den Markierten
--        Chatnachricht      der Markierte ist Mitglied des Chats
--        Kanalnachricht     Community öffentlich oder er ist Mitglied
--      Wer den Inhalt nicht sehen darf, wird gar nicht markiert.
--   6. Wohin die Mitteilung geht — über mitteilung_anlegen (Gewinner 78, also
--      mit Stummschaltung von Konto, Community und Chat):
--        Beitrag        post_tags  → vorhandener Auslöser Schema 49
--                       („hat dich in einem Beitrag markiert", Glocke Videos);
--                       damit füllt sich auch der Reiter „Markiert" im Profil
--        Kommentar      'mention', Videos, Ziel 'comment' — nicht an den
--                       Beitragsinhaber, der bekommt schon „hat deinen
--                       Beitrag kommentiert"
--        Chat Communitys 'mention', Communitys, Ziel 'chat'
--        Chat Messenger  KEINE Glocke: Messenger und Videos werden strikt
--                       getrennt (Henrik, Schema 75), und der Messenger hat
--                       keine Glocke. Stattdessen zeigt die Chatliste ein „@"
--                       am Chat (meine_chat_erwaehnungen()).
--        Kanal          'mention', Communitys, Ziel 'community'
--      Der Satz entsteht in drei Dateien: app/contexts/ProfilContext.tsx,
--      web/server/app.js (mitteilungText) und app/test/_markieren.js.
--   7. Verschlüsselte Zweierchats (25.6): Der Server sieht den Text nicht
--      (Schema 31, messages.chiffre). Der Absender schickt die markierten
--      Kennungen nach dem Senden mit markierungen_melden(nachricht, ids).
--      Erlaubt nur dem Absender, nur für eine verschlüsselte Nachricht, nur
--      für Mitglieder des Chats — im Zweierchat ist das genau der Partner.
--      Verraten wird dem Server damit nur „A hat B in einer Nachricht
--      markiert", was er über die Chatmitgliedschaft ohnehin weiß.
--   8. markierung_vorschlaege(suche, chat, kanal) — die Vorschlagsliste beim
--      Tippen von @: zuerst Mitglieder des Chats/der Community, dann
--      Gefolgte, Folgende und Kontakte, dann die Suche (ab zwei Zeichen).
--      Nur, wer nach Punkt 2 markiert werden darf — wer nicht darf, wird
--      nicht angeboten. Tippt man den Namen trotzdem, bleibt der Text stehen
--      und wird zum Link aufs (ohnehin öffentliche) Profil, aber es gibt
--      weder Markierung noch Mitteilung. Den Link wegzulassen würde selbst
--      verraten, dass die Person das Markieren gesperrt hat.
--   9. Neue Fassungen, die die Regel aus Punkt 2 übernehmen:
--        darf_markieren()          Gewinner XX, ersetzt Schema 20
--        darf_story_markieren()    Gewinner XX, ersetzt Schema 68
--        story_markierbar()        Gewinner XX, ersetzt Schema 68
--      Wortgleich bis auf den Aufruf von darf_markieren_person().
--  10. ist_minderjaehrig() kommt aus SUPABASE_SCHEMA_85_personen_vorschlaege.sql
--      (Kasten 23) und wird hier nur benutzt — Schema 85 muss vorher
--      eingespielt sein.
--
--  WAS SIE NICHT ÄNDERT
--
--    - Story-Markierungen bleiben Namensschilder über story_tags (Schema 68)
--      mit Hinweis im Chat (Schema 75). Ein @ im Story-TEXT (overlays.texte)
--      wird angezeigt und verlinkt, legt aber KEINE zweite Markierung an —
--      sonst käme dieselbe Markierung doppelt (Hinweis im Chat + Glocke).
--      Die Story-Eingabe bietet @ deshalb nur zum Verlinken an; wer markieren
--      will, nimmt das Namensschild.
--    - Ein „später posten"-Beitrag wird beim Anlegen markiert; die Mitteilung
--      kommt also vor dem Erscheinen. Ein Zeitgeber dafür fehlt im Projekt.
--
--  RECHTE
--
--  Alle neuen Funktionen: EXECUTE weg von public/anon (Schema 37). Nur
--  markierung_vorschlaege, markierungen_melden und meine_chat_erwaehnungen
--  bekommen authenticated. Danach npm run test:rechte, test:minderjaehrig
--  (neue Tabelle trägt nur_freigegebene), test:schema, test:markieren.
--
--  Idempotent: create or replace, if not exists, drop … if exists.
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  1. Die @-Namen eines Textes
-- ---------------------------------------------------------------------------

create or replace function public.markierung_handles(p_text text)
returns setof text
language sql
immutable
set search_path = public
as $$
  select distinct on (h) h
    from (
      select lower(m[2]) as h
        from regexp_matches(
               coalesce(p_text, ''),
               '(^|[^A-Za-z0-9_.@])@([A-Za-z0-9](?:[A-Za-z0-9._]{1,22})[A-Za-z0-9])(?![A-Za-z0-9_]|\.[A-Za-z0-9_])',
               'g'
             ) as t(m)
    ) roh
   where public.handle_gueltig(h)
   order by h
   limit 20;
$$;

revoke all on function public.markierung_handles(text) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
--  2. Die eine Regel: darf `wer` die Person `wen` markieren?
-- ---------------------------------------------------------------------------

create or replace function public.darf_markieren_person(wer uuid, wen uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select wer is not null and wen is not null and wer <> wen
     and exists (select 1 from public.profiles p where p.id = wen)
     and public.konto_stand(wer) = 'frei'
     and public.konto_stand(wen) = 'frei'
     and not exists (
           select 1 from public.blocks b
            where (b.user_id = wen and b.blocked_user_id = wer)
               or (b.user_id = wer and b.blocked_user_id = wen))
     and public.sichtbar_fuer(wen, 'markierung', wer)
     and not (public.ist_testkonto(wer) and not public.ist_testkonto(wen))
     and (not public.ist_minderjaehrig(wen)
          or exists (select 1 from public.contacts c
                      where c.user_id = wen and c.contact_id = wer and c.status = 'friend'));
$$;

revoke all on function public.darf_markieren_person(uuid, uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
--  3. Tabelle
-- ---------------------------------------------------------------------------

create table if not exists public.markierungen (
  id           uuid primary key default gen_random_uuid(),
  quelle_art   text not null check (quelle_art in ('post', 'comment', 'message', 'kanal')),
  quelle_id    uuid not null,
  markiert_id  uuid not null references public.profiles (id) on delete cascade,
  von_id       uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (quelle_art, quelle_id, markiert_id)
);

create index if not exists markierungen_markiert_idx
  on public.markierungen (markiert_id, created_at desc);

comment on table public.markierungen is
  'Kasten 25: @-Markierungen in Beitrag, Kommentar, Chat- und Kanalnachricht. '
  'Nur über Auslöser und markierungen_melden() beschreibbar (Schema XX).';

alter table public.markierungen enable row level security;

revoke all on public.markierungen from anon, authenticated;
grant select on public.markierungen to authenticated;

drop policy if exists "Eigene Markierungen lesen" on public.markierungen;
create policy "Eigene Markierungen lesen" on public.markierungen
  for select to authenticated
  using (markiert_id = auth.uid() or von_id = auth.uid());

-- Wie jede neue Tabelle seit Schema 52/74 (test:minderjaehrig zählt nach).
drop policy if exists nur_freigegebene on public.markierungen;
create policy nur_freigegebene on public.markierungen
  as restrictive for all to authenticated
  using ((select public.konto_freigegeben())) with check ((select public.konto_freigegeben()));


-- ---------------------------------------------------------------------------
--  5. Darf der Markierte den Inhalt sehen?
--     Rechnung wie beitrag_sichtbar() (Schema 7), aber für `wen` statt
--     auth.uid() — im Auslöser ist auth.uid() der Markierende.
-- ---------------------------------------------------------------------------

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
                          where m.community_id = c.id and m.user_id = wen)));
  end if;
  return false;
end $$;

revoke all on function public.markierung_sichtbar(text, uuid, uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
--  6. Mitteilung anlegen und zurücknehmen
-- ---------------------------------------------------------------------------

create or replace function public.markierung_mitteilung(p_art text, p_quelle uuid, p_wen uuid, p_von uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_ziel uuid;
  v_bereich text;
begin
  if p_art = 'post' then
    -- Der vorhandene Auslöser auf post_tags (Schema 49) schreibt die Mitteilung.
    insert into public.post_tags (post_id, user_id) values (p_quelle, p_wen)
    on conflict do nothing;

  elsif p_art = 'comment' then
    -- Der Beitragsinhaber hat schon „hat deinen Beitrag kommentiert".
    if exists (select 1 from public.comments c join public.posts b on b.id = c.post_id
                where c.id = p_quelle and b.user_id = p_wen) then
      return;
    end if;
    perform public.mitteilung_anlegen(p_wen, p_von, 'mention', 'videos', 'comment', p_quelle);

  elsif p_art = 'message' then
    select ch.id, ch.bereich into v_ziel, v_bereich
      from public.messages m join public.chats ch on ch.id = m.chat_id
     where m.id = p_quelle;
    -- Messenger: keine Glocke (strikte Trennung, Schema 75). Das „@" in der
    -- Chatliste kommt aus meine_chat_erwaehnungen().
    if coalesce(v_bereich, 'messenger') = 'community' then
      perform public.mitteilung_anlegen(p_wen, p_von, 'mention', 'communities', 'chat', v_ziel);
    end if;

  elsif p_art = 'kanal' then
    select ch.community_id into v_ziel
      from public.community_channel_messages k join public.community_channels ch on ch.id = k.channel_id
     where k.id = p_quelle;
    perform public.mitteilung_anlegen(p_wen, p_von, 'mention', 'communities', 'community', v_ziel);
  end if;
end $$;

revoke all on function public.markierung_mitteilung(text, uuid, uuid, uuid) from public, anon, authenticated;

/*
 * Zurücknehmen. Bei Chat und Kanal steht in der Mitteilung nur der Chat bzw.
 * die Community — es wird die jüngste passende Mitteilung dieses Absenders
 * entfernt (wie beim Kommentar in Schema 61).
 */
create or replace function public.markierung_mitteilung_weg(p_art text, p_quelle uuid, p_wen uuid, p_von uuid, p_ziel uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_art = 'post' then
    delete from public.post_tags where post_id = p_quelle and user_id = p_wen;
    delete from public.notifications
     where user_id = p_wen and art = 'mention' and target_type = 'post' and target_id = p_quelle;
  elsif p_art = 'comment' then
    delete from public.notifications
     where user_id = p_wen and actor_id = p_von and art = 'mention'
       and target_type = 'comment' and target_id = p_quelle;
  elsif p_ziel is not null then
    delete from public.notifications
     where id = (select n.id from public.notifications n
                  where n.user_id = p_wen and n.actor_id = p_von and n.art = 'mention'
                    and n.target_type in ('chat', 'community') and n.target_id = p_ziel
                  order by n.created_at desc limit 1);
  end if;
end $$;

revoke all on function public.markierung_mitteilung_weg(text, uuid, uuid, uuid, uuid) from public, anon, authenticated;

-- Chat bzw. Community einer Nachricht (für das Zurücknehmen nach dem Löschen
-- muss der Aufrufer sie vorher kennen).
create or replace function public.markierung_ziel(p_art text, p_quelle uuid)
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select case p_art
    when 'message' then (select m.chat_id from public.messages m where m.id = p_quelle)
    when 'kanal'   then (select ch.community_id from public.community_channel_messages k
                           join public.community_channels ch on ch.id = k.channel_id
                          where k.id = p_quelle)
  end;
$$;

revoke all on function public.markierung_ziel(text, uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
--  4. Abgleichen: aus einer Liste von Personen den neuen Stand machen
-- ---------------------------------------------------------------------------

create or replace function public.markierungen_abgleichen(p_art text, p_quelle uuid, p_von uuid, p_ids uuid[])
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_erlaubt uuid[];
  v_ziel uuid := public.markierung_ziel(p_art, p_quelle);
  r record;
begin
  select coalesce(array_agg(distinct k), '{}') into v_erlaubt
    from unnest(coalesce(p_ids, '{}')) as k
   where public.darf_markieren_person(p_von, k)
     and public.markierung_sichtbar(p_art, p_quelle, k);

  -- Aus dem Text verschwunden: Markierung und Mitteilung weg.
  for r in
    delete from public.markierungen
     where quelle_art = p_art and quelle_id = p_quelle
       and not (markiert_id = any (v_erlaubt))
    returning markiert_id, von_id
  loop
    perform public.markierung_mitteilung_weg(p_art, p_quelle, r.markiert_id, r.von_id, v_ziel);
  end loop;

  -- Neu dazugekommen: nur diese bekommen eine Mitteilung.
  for r in
    insert into public.markierungen (quelle_art, quelle_id, markiert_id, von_id)
    select p_art, p_quelle, k, p_von from unnest(v_erlaubt) as k
    on conflict (quelle_art, quelle_id, markiert_id) do nothing
    returning markiert_id
  loop
    perform public.markierung_mitteilung(p_art, p_quelle, r.markiert_id, p_von);
  end loop;
end $$;

revoke all on function public.markierungen_abgleichen(text, uuid, uuid, uuid[]) from public, anon, authenticated;

create or replace function public.markierungen_aus_text(p_art text, p_quelle uuid, p_von uuid, p_text text)
returns void
language sql
security definer set search_path = public
as $$
  select public.markierungen_abgleichen(
    p_art, p_quelle, p_von,
    coalesce((select array_agg(p.id)
                from public.markierung_handles(p_text) h
                join public.profiles p on p.handle = '@' || h), '{}'));
$$;

revoke all on function public.markierungen_aus_text(text, uuid, uuid, text) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
--  4. Die Auslöser
-- ---------------------------------------------------------------------------

create or replace function public.markierung_bei_text()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_table_name = 'posts' then
    perform public.markierungen_aus_text('post', new.id, new.user_id,
      coalesce(new.title, '') || ' ' || coalesce(new.description, ''));
  elsif tg_table_name = 'comments' then
    perform public.markierungen_aus_text('comment', new.id, new.user_id, new.text);
  elsif tg_table_name = 'messages' then
    -- Verschlüsselt: der Text steht nicht hier, die Kennungen kommen über
    -- markierungen_melden(). Hinweise (Schema 75) und Anrufe tragen keinen Text.
    if coalesce(new.krypto, 0) = 0 and new.hinweis is null then
      perform public.markierungen_aus_text('message', new.id, new.sender_id, new.text);
    end if;
  elsif tg_table_name = 'community_channel_messages' then
    perform public.markierungen_aus_text('kanal', new.id, new.sender_id, new.text);
  end if;
  return new;
end $$;

revoke all on function public.markierung_bei_text() from public, anon, authenticated;

drop trigger if exists markierung_text on public.posts;
create trigger markierung_text
  after insert or update of title, description on public.posts
  for each row execute function public.markierung_bei_text();

drop trigger if exists markierung_text on public.comments;
create trigger markierung_text
  after insert or update of text on public.comments
  for each row execute function public.markierung_bei_text();

drop trigger if exists markierung_text on public.messages;
create trigger markierung_text
  after insert or update of text on public.messages
  for each row execute function public.markierung_bei_text();

drop trigger if exists markierung_text on public.community_channel_messages;
create trigger markierung_text
  after insert or update of text on public.community_channel_messages
  for each row execute function public.markierung_bei_text();

/*
 * Inhalt gelöscht: Markierungen und Mitteilungen weg. BEFORE, damit Chat und
 * Community der Nachricht noch nachzuschlagen sind. post_tags fallen beim
 * Beitrag per cascade selbst.
 */
create or replace function public.markierung_weg_bei_loeschen()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_art text := case tg_table_name
    when 'posts' then 'post' when 'comments' then 'comment'
    when 'messages' then 'message' else 'kanal' end;
  v_ziel uuid := public.markierung_ziel(v_art, old.id);
  r record;
begin
  for r in
    delete from public.markierungen where quelle_art = v_art and quelle_id = old.id
    returning markiert_id, von_id
  loop
    perform public.markierung_mitteilung_weg(v_art, old.id, r.markiert_id, r.von_id, v_ziel);
  end loop;
  return old;
end $$;

revoke all on function public.markierung_weg_bei_loeschen() from public, anon, authenticated;

drop trigger if exists markierung_weg on public.posts;
create trigger markierung_weg before delete on public.posts
  for each row execute function public.markierung_weg_bei_loeschen();
drop trigger if exists markierung_weg on public.comments;
create trigger markierung_weg before delete on public.comments
  for each row execute function public.markierung_weg_bei_loeschen();
drop trigger if exists markierung_weg on public.messages;
create trigger markierung_weg before delete on public.messages
  for each row execute function public.markierung_weg_bei_loeschen();
drop trigger if exists markierung_weg on public.community_channel_messages;
create trigger markierung_weg before delete on public.community_channel_messages
  for each row execute function public.markierung_weg_bei_loeschen();


-- ---------------------------------------------------------------------------
--  7. Verschlüsselte Zweierchats (25.6)
-- ---------------------------------------------------------------------------

create or replace function public.markierungen_melden(p_nachricht uuid, p_ids uuid[])
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_msg public.messages%rowtype;
  v_ids uuid[];
begin
  select * into v_msg from public.messages where id = p_nachricht;
  if v_msg.id is null or v_msg.sender_id is distinct from auth.uid() then
    raise exception 'nicht erlaubt';
  end if;
  -- Klartext löst der Auslöser selbst auf; hier nur, was er nicht lesen kann.
  if coalesce(v_msg.krypto, 0) = 0 then
    return 0;
  end if;
  -- Nur Mitglieder dieses Chats.
  select coalesce(array_agg(k), '{}') into v_ids
    from (select distinct k from unnest(coalesce(p_ids, '{}')) as k
           where exists (select 1 from public.chat_members cm
                          where cm.chat_id = v_msg.chat_id and cm.user_id = k)
           limit 20) as erlaubt;
  perform public.markierungen_abgleichen('message', v_msg.id, v_msg.sender_id, v_ids);
  return (select count(*)::int from public.markierungen
           where quelle_art = 'message' and quelle_id = v_msg.id);
end $$;

revoke all on function public.markierungen_melden(uuid, uuid[]) from public, anon;
grant execute on function public.markierungen_melden(uuid, uuid[]) to authenticated;


-- ---------------------------------------------------------------------------
--  6. Das „@" in der Chatliste: Chats mit ungelesener Erwähnung
--     Ungelesen wie in Schema 81: chat_members.is_read / last_read_at.
-- ---------------------------------------------------------------------------

create or replace function public.meine_chat_erwaehnungen()
returns table (chat_id uuid)
language sql
stable
security definer set search_path = public
as $$
  select distinct m.chat_id
    from public.markierungen mk
    join public.messages m on m.id = mk.quelle_id
    join public.chat_members cm on cm.chat_id = m.chat_id and cm.user_id = auth.uid()
   where mk.quelle_art = 'message'
     and mk.markiert_id = auth.uid()
     and m.deleted_at is null
     and not coalesce(cm.is_read, true)
     and m.created_at > coalesce(cm.last_read_at, '-infinity'::timestamptz);
$$;

revoke all on function public.meine_chat_erwaehnungen() from public, anon;
grant execute on function public.meine_chat_erwaehnungen() to authenticated;


-- ---------------------------------------------------------------------------
--  8. Die Vorschlagsliste
-- ---------------------------------------------------------------------------

create or replace function public.markierung_vorschlaege(
  p_suche text default null,
  p_chat  uuid default null,
  p_kanal uuid default null
)
returns table (id uuid, name text, handle text, avatar_url text, color text, rang text)
language sql
stable
security definer set search_path = public
as $$
  with ich as (select auth.uid() as k),
  s as (select lower(trim(both from regexp_replace(coalesce(p_suche, ''), '^@+', ''))) as t),
  mitglied as (
    -- Mitglieder des Chats — nur, wenn ich selbst drin bin.
    select cm.user_id as k from public.chat_members cm, ich
     where p_chat is not null and cm.chat_id = p_chat
       and exists (select 1 from public.chat_members x where x.chat_id = p_chat and x.user_id = ich.k)
    union
    -- Mitglieder der Community eines Unterthemas — nur, wenn ich sie sehe.
    select m.user_id from public.community_channels ch
      join public.community_members m on m.community_id = ch.community_id
     where p_kanal is not null and ch.id = p_kanal
       and public.community_sichtbar(ch.community_id)
  ),
  nah as (
    select c.contact_id as k from public.contacts c, ich where c.user_id = ich.k and c.status = 'friend'
    union
    select f.followee_id from public.follows f, ich where f.follower_id = ich.k
    union
    select f.follower_id from public.follows f, ich where f.followee_id = ich.k
  ),
  kandidaten as (
    select p.id, 0 as stufe from public.profiles p join mitglied on mitglied.k = p.id
    union all
    select p.id, 1 from public.profiles p join nah on nah.k = p.id
    union all
    select p.id, 2 from public.profiles p, s
     where length(s.t) >= 2
       and (p.handle ilike '@' || s.t || '%' or p.name ilike '%' || s.t || '%')
  ),
  beste as (
    select k.id, min(k.stufe) as stufe from kandidaten k group by k.id
  )
  select p.id, p.name, p.handle, p.avatar_url, p.color,
         case b.stufe when 0 then 'mitglied' when 1 then 'nah' else 'suche' end
    from beste b
    join public.profiles p on p.id = b.id
    cross join ich
    cross join s
   where ich.k is not null
     and p.id <> ich.k
     and (s.t = '' or p.handle ilike '@%' || s.t || '%' or p.name ilike '%' || s.t || '%')
     and public.darf_markieren_person(ich.k, p.id)
   order by b.stufe, (p.handle ilike '@' || s.t || '%') desc, p.name
   limit 20;
$$;

revoke all on function public.markierung_vorschlaege(text, uuid, uuid) from public, anon;
grant execute on function public.markierung_vorschlaege(text, uuid, uuid) to authenticated;


-- ---------------------------------------------------------------------------
--  9. Vorhandene Markier-Regeln übernehmen die eine Regel
-- ---------------------------------------------------------------------------

-- Gewinner XX, ersetzt Schema 20 (dort nur sichtbar_fuer).
create or replace function public.darf_markieren(ziel_post uuid, wen uuid, wer uuid)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  eigner uuid;
begin
  select b.user_id into eigner from public.posts b where b.id = ziel_post;
  if eigner is null then
    return false;
  end if;
  -- Markieren darf nur, wer den Beitrag verfasst hat.
  if eigner <> wer then
    return false;
  end if;
  return public.darf_markieren_person(wer, wen);
end;
$$;

revoke all on function public.darf_markieren(uuid, uuid, uuid) from public, anon;
grant execute on function public.darf_markieren(uuid, uuid, uuid) to authenticated;

-- Gewinner XX, ersetzt Schema 68.
create or replace function public.darf_story_markieren(ziel_story uuid, wen uuid, wer uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  eigner uuid;
begin
  select s.user_id into eigner from public.stories s where s.id = ziel_story;
  if eigner is null or wer is null or eigner <> wer then
    return false;
  end if;
  if wen = wer then
    return false;
  end if;
  return public.darf_markieren_person(wer, wen);
end;
$$;

revoke all on function public.darf_story_markieren(uuid, uuid, uuid) from public, anon;
grant execute on function public.darf_story_markieren(uuid, uuid, uuid) to authenticated;

-- Gewinner XX, ersetzt Schema 68 (Rückgabe unverändert).
create or replace function public.story_markierbar(suche text default null)
returns table (id uuid, name text, handle text)
language sql
stable
security definer
set search_path = public
as $$
  with ich as (select auth.uid() as k),
  nah as (
    select c.contact_id as k from public.contacts c, ich
     where c.user_id = ich.k and c.status = 'friend'
    union
    select f.followee_id from public.follows f, ich where f.follower_id = ich.k
    union
    select f.follower_id from public.follows f, ich where f.followee_id = ich.k
  ),
  kandidaten as (
    select p.id, p.name, p.handle, 0 as rang
      from public.profiles p join nah on nah.k = p.id
     where coalesce(trim(suche), '') = ''
        or p.name ilike '%' || trim(suche) || '%'
        or p.handle ilike '%' || trim(suche) || '%'
    union
    select p.id, p.name, p.handle, 1 as rang
      from public.profiles p
     where length(coalesce(trim(suche), '')) >= 2
       and (p.name ilike '%' || trim(suche) || '%' or p.handle ilike '%' || trim(suche) || '%')
  )
  select distinct on (k.id) k.id, k.name, k.handle
    from kandidaten k, ich
   where ich.k is not null
     and k.id <> ich.k
     and public.darf_markieren_person(ich.k, k.id)
   order by k.id, k.rang
   limit 50;
$$;

revoke all on function public.story_markierbar(text) from public, anon;
grant execute on function public.story_markierbar(text) to authenticated;


-- ---------------------------------------------------------------------------
--  Nachweis
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.ist_minderjaehrig(uuid)') is null then
    raise exception 'ist_minderjaehrig fehlt — erst Schema 85 einspielen';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'markierung_text'
                  and tgrelid = 'public.comments'::regclass) then
    raise exception 'Auslöser markierung_text auf comments fehlt';
  end if;
  if pg_get_functiondef('public.darf_markieren'::regproc) not like '%darf_markieren_person%' then
    raise exception 'darf_markieren ist die alte Fassung';
  end if;
  if has_function_privilege('anon', 'public.markierung_vorschlaege(text, uuid, uuid)', 'execute') then
    raise exception 'markierung_vorschlaege steht anon offen';
  end if;
  if (select array_agg(h order by h) from public.markierung_handles('Hi @Anna, @ben. anna@web.de @an..na'))
     is distinct from array['anna', 'ben'] then
    raise exception 'markierung_handles erkennt falsch';
  end if;
end $$;
