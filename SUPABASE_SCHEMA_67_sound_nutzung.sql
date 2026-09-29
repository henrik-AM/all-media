-- ===========================================================================
-- Schema 67: Wie ein Sound wirklich genutzt wird (29.09.2026)
-- ===========================================================================
--
-- WORUM ES GEHT
--
-- Kasten 7.4/7.5, Henrik am 29.09.2026: „Wichtig ist nur, dass es schon so
-- vorprogrammiert ist, dass wenn Nutzer in die App einsteigen und die ersten
-- Leute diesen Sound benutzen, dass es dann angezeigt wird."
--
-- Der Prototyp (Frame „VSSo + Sound") zeigt auf der Soundseite:
--   - eine Wellenform mit rotem Punkt an der gespielten Stelle,
--   - blau umrandete Kästen um die meist verwendeten Stellen,
--   - darunter die Legende „▢ : meist verwendete Song-/Soundstelle".
--
-- Bis hier wusste die Datenbank davon nichts:
--   - posts.music war nur ein Text („Golden Hour – Lys"), kein Verweis.
--   - Welche Stelle ein Beitrag nutzt, stand nirgends.
--   - Die Wellenform war in App und Website mit sin() gezeichnet.
--   - Ein offizielles Songbild ließ sich nicht von einem eigenen trennen.
--
-- NEU
--
--   posts.sound_id      Verweis auf den Sound. Setzt ein Auslöser aus
--                       posts.music, damit App und Website nichts zuordnen
--                       müssen und alte Beiträge mitzählen.
--   posts.sound_ab      Sekunde im Sound, ab der der Beitrag ihn nutzt
--                       („Ausschnitt ab" beim Erstellen). 0 = Anfang.
--   sounds.wellenform   Lautstärke der Hörprobe in gleich breiten Abschnitten,
--                       0..1, gerechnet aus der Tondatei
--                       (web/tools/wellenform.py). null = unbekannt, dann
--                       zeichnen App und Website gleich hohe Balken statt
--                       einer erfundenen Form.
--   sounds.hoerprobe_sek  Länge der Tondatei in Sekunden (ebenfalls aus dem
--                       Werkzeug). Die Auswahl „Ausschnitt ab" richtet sich
--                       danach.
--   sounds.cover_quelle 'apple', wenn cover_url das offizielle Songbild aus
--                       der iTunes-Suche ist (web/tools/cover-holen.mjs),
--                       sonst ''. Dann zeigen App und Website den
--                       vorgeschriebenen Hinweis mit Link.
--   sounds.cover_link   Link auf den Song bei Apple Music.
--
--   sound_stellen(sound) Wie oft jede Stelle genutzt wird, in
--                       5-Sekunden-Abschnitten. Zählt nur echte Beiträge:
--                       demo-Beiträge sind erfunden und würden eine
--                       Markierung zeigen, die kein Mensch erzeugt hat.
--                       Ohne echte Nutzung: keine Zeile, keine Markierung,
--                       keine Legende.
--
-- Rechte: sound_stellen ist security definer, weil sie auch Beiträge
-- privater Konten mitzählt. Sie gibt nur Abschnitt und Anzahl heraus, keine
-- Beitrags- oder Personenkennung. EXECUTE nur für angemeldete Nutzer —
-- Postgres gibt neuen Funktionen EXECUTE an PUBLIC, das wird unten entzogen.
-- Nach dem Einspielen: npm run test:rechte.
-- ===========================================================================

alter table public.posts  add column if not exists sound_id uuid references public.sounds(id) on delete set null;
alter table public.posts  add column if not exists sound_ab real not null default 0;
alter table public.sounds add column if not exists wellenform real[];
alter table public.sounds add column if not exists hoerprobe_sek real;
alter table public.sounds add column if not exists cover_quelle text not null default '';
alter table public.sounds add column if not exists cover_link text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'posts_sound_ab_nicht_negativ') then
    alter table public.posts add constraint posts_sound_ab_nicht_negativ check (sound_ab >= 0);
  end if;
end;
$$;

create index if not exists posts_sound_id_idx on public.posts (sound_id) where sound_id is not null;

-- 1. Zuordnung --------------------------------------------------------------
-- An einem Beitrag steht „Titel – Interpret" (so bieten App und Website die
-- Sounds zur Wahl an). Gleiche Regel wie /api/ziel für die Soundseite: der
-- Teil vor dem Gedankenstrich ist der Titel. „Originalton" hat keinen Sound.
create or replace function public.posts_sound_zuordnen()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  titel text := trim(split_part(regexp_replace(coalesce(new.music, ''), '\s+[–—-]\s+', ' – '), ' – ', 1));
begin
  if tg_op = 'UPDATE' and new.music is not distinct from old.music then
    return new;
  end if;
  if titel = '' or titel = 'Originalton' then
    new.sound_id := null;
  else
    select s.id into new.sound_id from public.sounds s where s.title = titel limit 1;
  end if;
  return new;
end;
$$;

revoke all on function public.posts_sound_zuordnen() from public, anon, authenticated;

drop trigger if exists posts_sound_zuordnen on public.posts;
create trigger posts_sound_zuordnen
  before insert or update of music on public.posts
  for each row execute function public.posts_sound_zuordnen();

-- Vorhandene Beiträge einmal zuordnen.
update public.posts p set sound_id = s.id
  from public.sounds s
  where p.sound_id is null
    and s.title = trim(split_part(regexp_replace(coalesce(p.music, ''), '\s+[–—-]\s+', ' – '), ' – ', 1));

-- 2. Meist verwendete Stellen -------------------------------------------------
create or replace function public.sound_stellen(p_sound uuid)
returns table (ab real, anzahl bigint)
language sql
stable
security definer
set search_path = public
as $$
  select (floor(p.sound_ab / 5) * 5)::real as ab, count(*) as anzahl
    from public.posts p
   where p.sound_id = p_sound
     and not coalesce(p.demo, false)
     and (p.publish_at is null or p.publish_at <= now())
   group by 1
   order by anzahl desc, ab asc;
$$;

revoke all on function public.sound_stellen(uuid) from public, anon;
grant execute on function public.sound_stellen(uuid) to authenticated;

-- 3. Gegenprobe ---------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'posts_sound_zuordnen') then
    raise exception 'Auslöser posts_sound_zuordnen fehlt';
  end if;
  if has_function_privilege('anon', 'public.sound_stellen(uuid)', 'execute') then
    raise exception 'anon darf sound_stellen() ausführen';
  end if;
  if has_function_privilege('authenticated', 'public.posts_sound_zuordnen()', 'execute') then
    raise exception 'authenticated darf posts_sound_zuordnen() ausführen';
  end if;
end;
$$;

-- 4. Wellenformen der fünf Test-Sounds ---------------------------------------
-- Ausgabe von web/tools/wellenform.py (29.09.2026). Nach neuen Hörproben neu
-- rechnen und diesen Block ersetzen.
update public.sounds set wellenform = '{0.07,0.176,0.259,0.274,0.278,0.3,0.275,0.281,0.32,0.367,0.4,0.366,0.365,0.365,0.371,0.399,0.368,0.412,0.478,0.51,0.55,0.503,0.503,0.501,0.51,0.55,0.529,0.594,0.637,0.65,0.7,0.642,0.638,0.638,0.649,0.706,0.711,0.766,0.776,0.788,0.849,0.779,0.774,0.775,0.789,0.892,0.891,0.913,0.912,0.927,1.0,0.915,0.909,0.913,0.913,0.849,0.689,0.684,0.683,0.696,0.75,0.686,0.684,0.679,0.613,0.525,0.458,0.455,0.456,0.464,0.45,0.314,0.227,0.143,0.058}', hoerprobe_sek = 30.0 where audio_url = '/sounds/ambient-sunrise.m4a';
update public.sounds set wellenform = '{0.093,0.234,0.347,0.365,0.371,0.4,0.366,0.376,0.435,0.504,0.55,0.503,0.502,0.502,0.51,0.55,0.506,0.647,0.842,0.928,1.0,0.916,0.912,0.912,0.928,1.0,0.899,0.85,0.822,0.835,0.9,0.824,0.821,0.821,0.835,0.883,0.618,0.44,0.411,0.418,0.45,0.412,0.41,0.411,0.417,0.491,0.528,0.547,0.547,0.557,0.6,0.55,0.547,0.547,0.584,0.844,0.913,0.913,0.912,0.928,1.0,0.916,0.912,0.907,0.829,0.73,0.641,0.638,0.639,0.649,0.63,0.44,0.319,0.2,0.082}', hoerprobe_sek = 30.0 where audio_url = '/sounds/golden-hour.m4a';
update public.sounds set wellenform = '{0.116,0.292,0.433,0.456,0.464,0.5,0.458,0.479,0.598,0.729,0.799,0.732,0.729,0.731,0.741,0.8,0.733,0.792,0.881,0.927,1.0,0.915,0.91,0.913,0.928,1.0,0.849,0.666,0.549,0.557,0.599,0.551,0.546,0.547,0.556,0.609,0.666,0.76,0.774,0.788,0.85,0.778,0.775,0.774,0.789,0.891,0.894,0.911,0.911,0.928,1.0,0.916,0.912,0.911,0.908,0.819,0.642,0.639,0.638,0.649,0.701,0.64,0.639,0.641,0.717,0.88,0.824,0.818,0.821,0.836,0.809,0.565,0.41,0.257,0.105}', hoerprobe_sek = 30.0 where audio_url = '/sounds/kitchen-groove.m4a';
update public.sounds set wellenform = '{0.187,0.469,0.691,0.729,0.741,0.798,0.732,0.717,0.668,0.622,0.665,0.61,0.607,0.607,0.617,0.666,0.609,0.692,0.809,0.864,0.932,0.852,0.85,0.849,0.866,0.931,0.821,0.726,0.669,0.679,0.733,0.67,0.666,0.667,0.68,0.737,0.734,0.779,0.79,0.802,0.865,0.792,0.79,0.789,0.803,0.812,0.638,0.607,0.608,0.617,0.665,0.609,0.607,0.606,0.641,0.868,0.913,0.91,0.911,0.926,1.0,0.914,0.908,0.907,0.86,0.818,0.732,0.727,0.73,0.74,0.718,0.502,0.363,0.228,0.093}', hoerprobe_sek = 30.0 where audio_url = '/sounds/lo-fi-focus.m4a';
update public.sounds set wellenform = '{0.082,0.205,0.303,0.319,0.325,0.35,0.32,0.33,0.39,0.457,0.5,0.457,0.455,0.456,0.464,0.5,0.458,0.52,0.606,0.65,0.699,0.641,0.638,0.638,0.649,0.7,0.692,0.826,0.91,0.927,1.0,0.914,0.912,0.911,0.928,1.0,0.917,0.911,0.911,0.927,1.0,0.915,0.912,0.911,0.928,0.945,0.763,0.73,0.728,0.742,0.8,0.731,0.73,0.729,0.755,0.921,0.915,0.911,0.912,0.928,1.0,0.915,0.913,0.909,0.895,0.909,0.824,0.82,0.822,0.835,0.809,0.565,0.41,0.257,0.105}', hoerprobe_sek = 30.0 where audio_url = '/sounds/runner-high.m4a';
