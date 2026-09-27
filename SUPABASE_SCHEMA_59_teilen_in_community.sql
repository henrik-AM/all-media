-- ===========================================================================
--  SUPABASE_SCHEMA_59_teilen_in_community.sql — einen Beitrag in eine Community
--  26.09.2026
-- ===========================================================================
--
--  WORUM ES GEHT
--
--  Henrik am 26.09.2026 zum Teilen-Blatt: „man soll es einzelnen Personen
--  unter Community schicken können, aber auch natürlich in eine Community mit
--  mehreren Personen, das darf die sendende Person selber entscheiden."
--
--  Bis dahin ging ein geteilter Beitrag nur an Personen (messages.shared_post_id,
--  Schema 7). Eine Community hat keinen eigenen Chat, sondern Unterthemen
--  (community_channels) mit Nachrichten (community_channel_messages). Dort
--  landet der Beitrag jetzt als dieselbe Karte wie im Chat.
--
--  WAS SICH ÄNDERT
--
--  1. community_channel_messages.shared_post_id — wie bei messages.
--  2. Die Nachricht darf auch nur aus dem geteilten Beitrag bestehen
--     (kanalnachricht_nicht_leer, zuletzt Schema 25).
--  3. Einen Beitrag in ein Unterthema teilen darf nur ein Mitglied der
--     Community. Schreiben darf man in öffentliche Communitys auch ohne
--     Beitritt ("Im Kanal schreiben") — daran ändert sich nichts. Aber die
--     Karte eines Beitrags an hunderte Fremde zu schicken, ohne je beigetreten
--     zu sein, wäre der Umweg an der Regel „ein Beitrag bis zur Annahme"
--     (Schema 21) vorbei.
--
--  EINSPIELEN
--
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      SUPABASE_SCHEMA_59_teilen_in_community.sql
--
--  Danach: npm run test:rechte und npm run test:teilen in app/.
--  Mehrfach einspielbar.
-- ===========================================================================


alter table public.community_channel_messages
  add column if not exists shared_post_id uuid references public.posts (id) on delete set null;

create index if not exists kanalnachricht_shared_post_idx
  on public.community_channel_messages (shared_post_id);

comment on column public.community_channel_messages.shared_post_id is
  'Der geteilte Beitrag - dieselbe Karte wie messages.shared_post_id (Schema 59).';


-- Wortgleich mit Schema 25, nur der geteilte Beitrag ist dazugekommen.
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
    or shared_post_id is not null
  );


-- ---------------------------------------------------------------------------
--  Nur Mitglieder teilen Beiträge in ein Unterthema.
--
--  Eine zweite INSERT-Regel würde mit „Im Kanal schreiben" verodert und
--  nichts einschränken (siehe „Zweite RLS-Regel öffnet zu viel"). Deshalb
--  eine restriktive Regel: sie gilt zusätzlich und nur, wenn ein Beitrag
--  mitkommt.
-- ---------------------------------------------------------------------------

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
  );
$$;

revoke execute on function public.kanal_mitglied(uuid) from public, anon;
grant  execute on function public.kanal_mitglied(uuid) to authenticated;

drop policy if exists "Beitrag nur als Mitglied teilen" on public.community_channel_messages;
create policy "Beitrag nur als Mitglied teilen" on public.community_channel_messages
  as restrictive
  for insert to authenticated
  with check (shared_post_id is null or public.kanal_mitglied(channel_id));
