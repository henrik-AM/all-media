-- ===========================================================================
--  All Media — Schema 12: die Insight-Regeln lasen sich gegenseitig
--  Stand 02.09.2026
--
--  WARUM ES DIESE DATEI GIBT
--
--  Schema 11 legt die Insight Time an. Zwei seiner Leseregeln greifen aber
--  über Kreuz auf die jeweils andere Tabelle zu:
--
--      insights            → liest insight_recipients ("bin ich Empfänger?")
--      insight_recipients  → liest insights            ("bin ich Absender?")
--
--  Jede der beiden Abfragen löst die Regel der anderen aus, und die wieder
--  die erste. Postgres bricht das ab:
--
--      HTTP 500  42P17
--      infinite recursion detected in policy for relation "insights"
--
--  Damit war nicht etwa eine Abfrage langsam — beide Tabellen waren für jeden
--  angemeldeten Nutzer vollständig unbenutzbar. Kein Insight ließ sich lesen,
--  keiner schicken. Aufgefallen ist es, weil test:datenbank die beiden
--  Tabellen als "fehlend" meldete: eine Tabelle, die bei jedem Zugriff 500
--  antwortet, ist von einer nicht vorhandenen nicht zu unterscheiden.
--
--  DIE LÖSUNG
--
--  Dieselbe wie an den Chats: eine Funktion mit `security definer`. Sie läuft
--  mit den Rechten ihres Eigentümers, umgeht damit die Regeln der Tabelle, die
--  sie liest — und bricht so den Kreis. Vorbild ist public.is_chat_member()
--  aus SUPABASE_SCHEMA.sql, das dort seit jeher genau dafür da ist.
--
--  `stable` und ein festes `search_path` gehören dazu: ohne search_path könnte
--  ein Aufrufer der Funktion eine eigene Tabelle unterschieben.
--
--  Einspielen:
--    SUPABASE_TOKEN=sbp_… node tools/sql-einspielen.mjs SUPABASE_SCHEMA_12_insight_rekursion.sql
-- ===========================================================================

-- Bin ich Empfänger dieses Insights? Liest insight_recipients an dessen
-- Regeln vorbei — sonst entstünde genau der Kreis, um den es hier geht.
create or replace function public.ist_insight_empfaenger(ziel_insight uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.insight_recipients
    where insight_id = ziel_insight and user_id = auth.uid()
  );
$$;

-- Bin ich Absender dieses Insights?
create or replace function public.ist_insight_absender(ziel_insight uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.insights
    where id = ziel_insight and sender_id = auth.uid()
  );
$$;

-- --------------------------------------------------------------- insights --
-- Einen Insight sieht, wer ihn geschickt hat oder wer ihn bekommen hat.
-- Inhaltlich unverändert gegenüber Schema 11 — nur ohne den Kreis.
drop policy if exists "Eigene und empfangene Insights lesen" on public.insights;
create policy "Eigene und empfangene Insights lesen" on public.insights
  for select to authenticated using (
    sender_id = auth.uid()
    or public.ist_insight_empfaenger(id)
  );

-- ----------------------------------------------------- insight_recipients --
-- Die Empfängerzeile sieht der Absender und der Empfänger selbst.
drop policy if exists "Empfaengerzeilen lesen" on public.insight_recipients;
create policy "Empfaengerzeilen lesen" on public.insight_recipients
  for select to authenticated using (
    user_id = auth.uid()
    or public.ist_insight_absender(insight_id)
  );

-- Eintragen darf nur, wem der Insight gehört.
drop policy if exists "Empfaenger eintragen" on public.insight_recipients;
create policy "Empfaenger eintragen" on public.insight_recipients
  for insert to authenticated with check (
    public.ist_insight_absender(insight_id)
  );
