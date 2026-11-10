-- =============================================================================
-- SCHEMA 126 — Zweierchat atomar anlegen (10.11.2026)
-- =============================================================================
--
-- Codex-Gegenprüfung Paket 5 Nachlauf (10.11.2026), Fund 1: „Chat mit …“
-- suchte erst nach dem vorhandenen Zweierchat und legte sonst einen an — in
-- mehreren getrennten Aufrufen. Tippen zwei Geräte (oder zwei Server-Instanzen)
-- gleichzeitig, finden beide noch keinen Chat und legen je einen an: zwei
-- Chats für dasselbe Paar, getrennte Verläufe. Die Zusammenführung im Client
-- (ba90b50) fängt nur Doppeltipps auf DEMSELBEN Gerät.
--
-- Behebung: public.zweierchat_anlegen(ziel, bereich, name)
--   * security INVOKER — läuft als `authenticated`, also gelten alle
--     bisherigen Regeln unverändert: RLS auf chats/chat_members
--     (nur_freigegebene, intern.darf_mitglied_werden mit Blockade,
--     messenger_erlaubt, darf_angeschrieben_werden) und die Auslöser
--     (chat_spalten_schuetzen, zweierchat_zu_zweit, chat_anfrage_setzen —
--     letzterer legt die Chat-Anfrage nur bei current_user = authenticated
--     an; ein security definer würde sie still verschlucken).
--   * pg_advisory_xact_lock je Paar (sortiert) und Bereich: der zweite
--     Aufruf wartet, bis der erste festgeschrieben ist, und findet dann
--     dessen Chat (READ COMMITTED, jede Anweisung neuer Schnappschuss).
--   * Suche und Anlage in EINER Transaktion: scheitert das Eintragen der
--     Mitglieder, verschwindet auch die Chatzeile — kein halber Chat mehr.
--
-- Benutzt von web/server/sync-handlers.js und app/lib/aktionen.ts (chatMit).
-- Die Prüfungen davor (messenger_erlaubt → Bereich community,
-- darf_angeschrieben_werden → verständliche Meldung) bleiben im Client.
--
-- Neue Funktion: EXECUTE von public/anon entzogen, nur authenticated.
-- Keine neue Tabelle, keine Doppelung älterer Objekte.
-- =============================================================================

create or replace function public.zweierchat_anlegen(
  p_ziel uuid,
  p_bereich text default 'messenger',
  p_name text default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  ich uuid := auth.uid();
  wo text := coalesce(nullif(p_bereich, ''), 'messenger');
  vorhanden uuid;
  neu uuid;
begin
  if ich is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  if p_ziel is null or p_ziel = ich then
    raise exception 'Ungültiges Gegenüber' using errcode = '22023';
  end if;

  -- Ein Schloss je Paar und Bereich, egal wer von beiden anlegt.
  perform pg_advisory_xact_lock(hashtextextended(
    'zweierchat|' || least(ich, p_ziel)::text || '|' || greatest(ich, p_ziel)::text || '|' || wo, 0));

  select c.id into vorhanden
    from public.chats c
    join public.chat_members a on a.chat_id = c.id and a.user_id = ich
    join public.chat_members b on b.chat_id = c.id and b.user_id = p_ziel
   where not c.is_group
     and coalesce(c.bereich, 'messenger') = wo
   order by c.created_at
   limit 1;
  if vorhanden is not null then
    return vorhanden;
  end if;

  insert into public.chats (name, is_group, bereich, created_by)
  values (coalesce(nullif(btrim(p_name), ''), 'Chat'), false, wo, ich)
  returning id into neu;

  insert into public.chat_members (chat_id, user_id)
  values (neu, ich), (neu, p_ziel);

  return neu;
end;
$$;

revoke execute on function public.zweierchat_anlegen(uuid, text, text) from public, anon;
grant execute on function public.zweierchat_anlegen(uuid, text, text) to authenticated;
