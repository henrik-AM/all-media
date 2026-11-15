-- =====================================================================
-- All Media — Schema 100: Chat-Klingel (Allgemeines Feedback 21.10.2026, Kasten AF 1)
-- =====================================================================
--
-- Henrik: „Chats werden zwischen echten Nutzern nicht richtig synchronisiert."
--
-- Seit Kasten 27 (06.10.) fragen App und Website einen offenen Chat alle 4 s
-- und die Chatliste alle 10 s ab. Das kommt an, aber verzögert, und Reaktionen
-- änderten den abgefragten „Stand" gar nicht (siehe gemeinsam/chatabgleich.js).
--
-- WAS DIESES SCHEMA TUT
--
-- Ändert sich etwas an einem Chat, schickt die Datenbank eine KLINGEL über
-- Supabase Realtime (Broadcast, privater Kanal). Die Klingel trägt keinen
-- Inhalt — nur „in diesem Chat hat sich etwas geändert". Wer sie hört, holt
-- den Verlauf über den vorhandenen Weg (RLS, Entschlüsselung, Abgleich wie
-- bisher). Die Abfrage im Takt bleibt als Netz darunter, nur seltener.
--
--   Kanal `chat:<chat_id>`   — offener Zweier-/Gruppenchat: neue, bearbeitete,
--                              zurückgenommene, gelesene Nachricht, Reaktion
--   Kanal `kanal:<kanal_id>` — offenes Community-Unterthema: neue/geänderte Nachricht
--   Kanal `nutzer:<user_id>` — eigene Chatliste: neue/geänderte Nachricht in einem
--                              eigenen Chat, eigene Mitgliedszeile geändert
--
-- WARUM NICHT „postgres_changes"
--
-- Schema 95 (Abschnitt 10) hat die Realtime-Veröffentlichung bewusst geleert:
-- jede veröffentlichte Tabelle ist eine Tür mehr, die bei einer zu weiten
-- Leseregel aufgeht. Dabei bleibt es. Über die Klingel fließt keine Zeile,
-- kein Text, kein Kuvert — nur eine Kennung, die der Hörer ohnehin kennt.
--
-- WER HÖREN DARF
--
-- Private Kanäle prüft Realtime gegen RLS auf `realtime.messages`. Die Regel
-- unten lässt nur zu: den eigenen Nutzerkanal, Chats mit Mitgliedschaft
-- (`is_chat_member`, dieselbe Funktion wie „Nachrichten im eigenen Chat lesen")
-- und sichtbare Unterthemen (`kanal_sichtbar`, wie „Kanalnachrichten lesen").
-- Wartende Kinderkonten (`konto_freigegeben`, Schema 52) hören nichts.
-- Senden dürfen Nutzer gar nicht (keine INSERT-Regel) — nur die Auslöser hier,
-- über `realtime.send` (läuft als Eigentümer).
--
-- SICHER GEGEN AUSFALL
--
-- Scheitert `realtime.send`, darf das nie das Senden einer Nachricht
-- verhindern: jeder Aufruf steht in einem eigenen Ausnahmeblock.
--
-- Abhängigkeiten: `is_chat_member(uuid)`, `kanal_sichtbar(uuid)` (zuletzt 99,
-- Signatur unverändert), `konto_freigegeben()` (52), `realtime.send` (Supabase).
-- Ersetzt nichts. Idempotent.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Klingeln — eine Stelle, die nie wirft
-- ---------------------------------------------------------------------
create or replace function public.chat_klingeln(thema text, art text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(jsonb_build_object('art', art), 'klingel', thema, true);
exception when others then
  -- Ohne Klingel bleibt die Abfrage im Takt; das Senden der Nachricht geht vor.
  null;
end $$;

revoke execute on function public.chat_klingeln(text, text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. Auslöser — einmal je Befehl, nicht je Zeile
-- ---------------------------------------------------------------------
--
-- „Gelesen" (chat_gelesen, Schema 40) setzt read_at oft an hunderten
-- Nachrichten in einem Befehl. Je Zeile zu klingeln wären hunderte Klingeln
-- je Mitglied. Deshalb Auslöser je Befehl mit Übergangstabelle: jeder
-- betroffene Chat klingelt genau einmal. Postgres erlaubt Übergangstabellen
-- nur bei Auslösern für EIN Ereignis — daher je Tabelle drei Auslöser auf
-- dieselbe Funktion; sie liest `neu` (insert/update) oder `alt` (delete).

-- Nachrichten (Zweier- und Gruppenchats): offener Chat und Chatliste jedes Mitglieds.
create or replace function public.chat_klingel_nachricht()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chat uuid;
  mitglied uuid;
begin
  for chat in
    select distinct z.chat_id from neu z where tg_op <> 'DELETE'
  loop
    perform public.chat_klingeln('chat:' || chat, lower(tg_op));
    for mitglied in select cm.user_id from public.chat_members cm where cm.chat_id = chat loop
      perform public.chat_klingeln('nutzer:' || mitglied, 'liste');
    end loop;
  end loop;
  return null;
end $$;

create or replace function public.chat_klingel_nachricht_weg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chat uuid;
  mitglied uuid;
begin
  for chat in select distinct z.chat_id from alt z loop
    perform public.chat_klingeln('chat:' || chat, 'delete');
    for mitglied in select cm.user_id from public.chat_members cm where cm.chat_id = chat loop
      perform public.chat_klingeln('nutzer:' || mitglied, 'liste');
    end loop;
  end loop;
  return null;
end $$;

drop trigger if exists chat_klingel on public.messages;
drop trigger if exists chat_klingel_neu on public.messages;
drop trigger if exists chat_klingel_geaendert on public.messages;
drop trigger if exists chat_klingel_weg on public.messages;
create trigger chat_klingel_neu after insert on public.messages
  referencing new table as neu for each statement execute function public.chat_klingel_nachricht();
create trigger chat_klingel_geaendert after update on public.messages
  referencing new table as neu for each statement execute function public.chat_klingel_nachricht();
create trigger chat_klingel_weg after delete on public.messages
  referencing old table as alt for each statement execute function public.chat_klingel_nachricht_weg();


-- Reaktionen: nur der offene Chat (die Liste zeigt keine Reaktionen).
create or replace function public.chat_klingel_reaktion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chat uuid;
begin
  for chat in
    select distinct m.chat_id from neu z join public.messages m on m.id = z.message_id
  loop
    perform public.chat_klingeln('chat:' || chat, 'reaktion');
  end loop;
  return null;
end $$;

create or replace function public.chat_klingel_reaktion_weg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chat uuid;
begin
  -- Fällt die Reaktion mit ihrer Nachricht (cascade), ist die Nachricht schon
  -- weg; dann klingelt der Auslöser auf messages.
  for chat in
    select distinct m.chat_id from alt z join public.messages m on m.id = z.message_id
  loop
    perform public.chat_klingeln('chat:' || chat, 'reaktion');
  end loop;
  return null;
end $$;

drop trigger if exists chat_klingel on public.message_reactions;
drop trigger if exists chat_klingel_neu on public.message_reactions;
drop trigger if exists chat_klingel_geaendert on public.message_reactions;
drop trigger if exists chat_klingel_weg on public.message_reactions;
create trigger chat_klingel_neu after insert on public.message_reactions
  referencing new table as neu for each statement execute function public.chat_klingel_reaktion();
create trigger chat_klingel_geaendert after update on public.message_reactions
  referencing new table as neu for each statement execute function public.chat_klingel_reaktion();
create trigger chat_klingel_weg after delete on public.message_reactions
  referencing old table as alt for each statement execute function public.chat_klingel_reaktion_weg();


-- Eigene Mitgliedszeile (gelesen, archiviert, stumm, geleert): nur die eigene Liste.
create or replace function public.chat_klingel_mitglied()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wer uuid;
begin
  for wer in select distinct z.user_id from neu z loop
    perform public.chat_klingeln('nutzer:' || wer, 'liste');
  end loop;
  return null;
end $$;

create or replace function public.chat_klingel_mitglied_weg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wer uuid;
begin
  for wer in select distinct z.user_id from alt z loop
    perform public.chat_klingeln('nutzer:' || wer, 'liste');
  end loop;
  return null;
end $$;

drop trigger if exists chat_klingel on public.chat_members;
drop trigger if exists chat_klingel_neu on public.chat_members;
drop trigger if exists chat_klingel_geaendert on public.chat_members;
drop trigger if exists chat_klingel_weg on public.chat_members;
create trigger chat_klingel_neu after insert on public.chat_members
  referencing new table as neu for each statement execute function public.chat_klingel_mitglied();
create trigger chat_klingel_geaendert after update on public.chat_members
  referencing new table as neu for each statement execute function public.chat_klingel_mitglied();
create trigger chat_klingel_weg after delete on public.chat_members
  referencing old table as alt for each statement execute function public.chat_klingel_mitglied_weg();


-- Community-Unterthemen: der offene Kanal.
create or replace function public.chat_klingel_kanal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kanal uuid;
begin
  for kanal in select distinct z.channel_id from neu z loop
    perform public.chat_klingeln('kanal:' || kanal, lower(tg_op));
  end loop;
  return null;
end $$;

create or replace function public.chat_klingel_kanal_weg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kanal uuid;
begin
  for kanal in select distinct z.channel_id from alt z loop
    perform public.chat_klingeln('kanal:' || kanal, 'delete');
  end loop;
  return null;
end $$;

drop trigger if exists chat_klingel on public.community_channel_messages;
drop trigger if exists chat_klingel_neu on public.community_channel_messages;
drop trigger if exists chat_klingel_geaendert on public.community_channel_messages;
drop trigger if exists chat_klingel_weg on public.community_channel_messages;
create trigger chat_klingel_neu after insert on public.community_channel_messages
  referencing new table as neu for each statement execute function public.chat_klingel_kanal();
create trigger chat_klingel_geaendert after update on public.community_channel_messages
  referencing new table as neu for each statement execute function public.chat_klingel_kanal();
create trigger chat_klingel_weg after delete on public.community_channel_messages
  referencing old table as alt for each statement execute function public.chat_klingel_kanal_weg();

-- Auslöserfunktionen sind nicht aufrufbar (EXECUTE geht sonst an PUBLIC).
revoke execute on function public.chat_klingel_nachricht() from public, anon, authenticated;
revoke execute on function public.chat_klingel_nachricht_weg() from public, anon, authenticated;
revoke execute on function public.chat_klingel_reaktion() from public, anon, authenticated;
revoke execute on function public.chat_klingel_reaktion_weg() from public, anon, authenticated;
revoke execute on function public.chat_klingel_mitglied() from public, anon, authenticated;
revoke execute on function public.chat_klingel_mitglied_weg() from public, anon, authenticated;
revoke execute on function public.chat_klingel_kanal() from public, anon, authenticated;
revoke execute on function public.chat_klingel_kanal_weg() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 6. Wer welchen privaten Kanal hören darf
-- ---------------------------------------------------------------------
--
-- Die Kennung im Thema wird erst auf UUID-Form geprüft, dann umgewandelt —
-- ein unsinniges Thema ergibt „nein", keinen Fehler.
create or replace function public.klingel_hoeren_erlaubt(thema text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  art text := split_part(thema, ':', 1);
  kennung text := substr(thema, length(split_part(thema, ':', 1)) + 2);
begin
  if auth.uid() is null or not public.konto_freigegeben() then
    return false;
  end if;
  if kennung !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return false;
  end if;
  if art = 'nutzer' then
    return kennung::uuid = auth.uid();
  elsif art = 'chat' then
    return public.is_chat_member(kennung::uuid);
  elsif art = 'kanal' then
    return public.kanal_sichtbar(kennung::uuid);
  end if;
  return false;
end $$;

revoke execute on function public.klingel_hoeren_erlaubt(text) from public, anon;
grant execute on function public.klingel_hoeren_erlaubt(text) to authenticated;

drop policy if exists "Chat-Klingel hoeren" on realtime.messages;
create policy "Chat-Klingel hoeren" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and public.klingel_hoeren_erlaubt((select realtime.topic()))
  );

-- Bewusst KEINE insert-Regel: Nutzer können nicht selbst klingeln.

-- Paket 7, 15.11.2026: Kuverts werden nach der Nachricht geschrieben.
-- Ohne eigene Klingel kann die erste Nachricht bereits als unlesbar geladen
-- sein; mit gedrosseltem Takt würde sie dann bis zu 30 s unlesbar bleiben.
-- Nur ein Signal je Chat/Befehl und je betroffenem Nutzer, niemals Schlüssel.
create or replace function public.chat_klingel_kuvert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare ziel uuid;
begin
  for ziel in select distinct m.chat_id from neu z
    join public.messages m on m.id = z.message_id
  loop
    perform public.chat_klingeln('chat:' || ziel, 'kuvert');
  end loop;
  for ziel in select distinct k.user_id from neu z
    join public.krypto_schluessel k on k.id = z.schluessel_id
  loop
    perform public.chat_klingeln('nutzer:' || ziel, 'kuvert');
  end loop;
  return null;
end $$;
revoke execute on function public.chat_klingel_kuvert() from public, anon, authenticated;
drop trigger if exists chat_klingel_kuvert on public.message_keys;
create trigger chat_klingel_kuvert after insert on public.message_keys
  referencing new table as neu for each statement execute function public.chat_klingel_kuvert();
