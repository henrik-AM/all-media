-- ===========================================================================
--  SUPABASE_SCHEMA_80_sammlung_nur_eigenes.sql                 (01.10.2026)
--  Kasten 17, eingespielt am 01.10.2026.
--
--  WARUM
--
--  Henrik am 01.10.2026 über Playlists: „Der Nutzer des Accounts muss dann
--  jedes Video selbst einordnen." Eine Playlist ist ein Ordner mit den
--  EIGENEN Beiträgen eines Profils — „nur Gaming-Videos von diesem Account".
--
--  Die Datenbank prüft bisher nur die halbe Regel:
--
--    sammlung_inhalte_anlegen (Schema 46)  — die SAMMLUNG muss einem gehören
--    sammlung_inhalt_pruefen  (Schema 46)  — Gattung passt (Playlist ↔
--                                            Beitrag, Highlight ↔ Story)
--
--  Dass auch der BEITRAG bzw. die STORY dem Besitzer der Sammlung gehört,
--  prüft niemand. Über die REST-Schnittstelle kann jeder Angemeldete einen
--  fremden Beitrag in seine eigene Playlist legen — der dann im eigenen
--  Profil unter fremdem Namen als Inhalt erscheint. App und Website bieten
--  das nicht an (Menüpunkt nur am eigenen Beitrag, Server prüft in
--  eigenesStueck()), aber das ist eine Anzeigeregel, keine Zugriffsregel —
--  genau der Fall aus „Schalter in die Datenbank".
--
--  WAS SICH ÄNDERT
--
--  Der Auslöser sammlung_inhalt_pruefen bekommt eine dritte Prüfung: der
--  Urheber des Stücks ist der Besitzer der Sammlung. SECURITY DEFINER, weil
--  er sonst unter den Leseregeln des Aufrufers liefe — ein eigener, noch
--  geplanter Beitrag (publish_at in der Zukunft) oder eine abgelaufene
--  eigene Story wäre für ihn evtl. unsichtbar und würde fälschlich
--  abgelehnt.
--
--  Bestand: der Testbestand (Schema 47, starter_sammlungen) legt nur eigene
--  Beiträge und Storys hinein; die Prüfläufe _sammlungen.js,
--  _sammlungenweb.js und _feinschliff.js ebenso. Der Nachweis unten zählt,
--  ob es schon fremde Zuordnungen gibt — er löscht sie NICHT, er meldet sie.
--
--  Idempotent: create or replace, drop trigger if exists.
--
--  Start (erst nach Freigabe):
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      SUPABASE_SCHEMA_80_sammlung_nur_eigenes.sql
--  Danach: npm run test:rechte (neue Funktion → EXECUTE an PUBLIC).
-- ===========================================================================

create or replace function public.sammlung_inhalt_pruefen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_art     text;
  v_besitz  uuid;
  v_urheber uuid;
begin
  select art, user_id into v_art, v_besitz from public.sammlungen where id = new.sammlung_id;
  if v_art is null then
    raise exception 'Sammlung % gibt es nicht', new.sammlung_id;
  end if;

  if v_art = 'playlist' and new.post_id is null then
    raise exception 'In eine Playlist gehoert ein Beitrag, keine Story';
  end if;
  if v_art = 'highlight' and new.story_id is null then
    raise exception 'In ein Highlight gehoert eine Story, kein Beitrag';
  end if;

  -- Neu (Kasten 17): nur Eigenes. Ein Ordner „Gaming" im Profil einer
  -- Person enthält IHRE Gaming-Videos, nicht die anderer Leute.
  if new.post_id is not null then
    select user_id into v_urheber from public.posts where id = new.post_id;
  else
    select user_id into v_urheber from public.stories where id = new.story_id;
  end if;
  if v_urheber is distinct from v_besitz then
    raise exception 'Einordnen kannst du nur Eigenes';
  end if;

  return new;
end;
$$;

drop trigger if exists sammlung_inhalt_pruefen on public.sammlung_inhalte;
create trigger sammlung_inhalt_pruefen
  before insert or update on public.sammlung_inhalte
  for each row execute function public.sammlung_inhalt_pruefen();

-- Postgres gibt EXECUTE an eine Funktion automatisch an PUBLIC. Ein
-- Auslöser braucht kein Aufrufrecht; als SECURITY DEFINER erst recht nicht.
revoke execute on function public.sammlung_inhalt_pruefen() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Nachweis — die Verwaltungs-API meldet auch dann Erfolg, wenn nichts passiert.
-- ---------------------------------------------------------------------------
do $$
declare
  v_text   text;
  v_fremde integer;
begin
  select pg_get_functiondef('public.sammlung_inhalt_pruefen()'::regprocedure) into v_text;
  if v_text not like '%Einordnen kannst du nur Eigenes%' then
    raise exception 'sammlung_inhalt_pruefen prueft den Urheber nicht';
  end if;

  select count(*) into v_fremde
    from public.sammlung_inhalte si
    join public.sammlungen s on s.id = si.sammlung_id
    left join public.posts p on p.id = si.post_id
    left join public.stories st on st.id = si.story_id
   where coalesce(p.user_id, st.user_id) is distinct from s.user_id;

  raise notice 'sammlung_inhalt_pruefen prueft jetzt auch den Urheber. Bestehende fremde Zuordnungen: %', v_fremde;
end $$;
