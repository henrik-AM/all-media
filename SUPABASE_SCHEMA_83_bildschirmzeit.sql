-- ===========================================================================
--  SUPABASE_SCHEMA_83_bildschirmzeit.sql — Eigene Bildschirmzeit (Kasten 22)
--  06.10.2026
-- ===========================================================================
--
--  WORUM ES GEHT
--
--  Henrik am 06.10.2026: „Nutzer sollen selbst Limits festlegen können. Sie
--  sollen auch zwischen Unterpunkten differenzieren können (z. B. Messenger
--  immer, Videos 20 min pro Tag)." Vorbilder: iOS-Bildschirmzeit, TikTok,
--  Instagram, YouTube.
--
--  DIE TEILE
--
--  1. bildschirmzeit_regeln   je Konto die Regeln (jsonb, geprüft), die
--                             Zeitzone, und wer als Elternteil sie gesetzt hat.
--  2. bildschirmzeit_nutzung  gemessene Sekunden je Konto, Tag und Bereich.
--                             App und Website zählen in dieselbe Zeile.
--  3. bildschirmzeit_freigaben „15 Min. mehr" und Freigaben mit Entsperrcode.
--  4. bildschirmzeit_takt     wann zuletzt gezählt wurde — die Obergrenze.
--  5. entsperrcodes           der Sicherheits-/Entsperrcode aus den
--                             Einstellungen, nur als bcrypt-Hash.
--  6. entsperrcode_versuche   Bremse gegen Durchprobieren.
--
--  WARUM EIGENE TABELLEN STATT user_settings (Schema 16)
--
--  user_settings darf jedes Konto für sich frei beschreiben (Regel „Eigene
--  Einstellungen", for all). Haben die Eltern Limits gesetzt, darf das Kind
--  sie aber nicht lockern — das lässt sich nur durchsetzen, wenn niemand
--  direkt schreibt, sondern nur bildschirmzeit_setzen(). Dazu kommt: die
--  Regeln sind ein zusammenhängendes Ganzes (Gesamtlimit, neun Bereiche,
--  Auszeit, Pause), das als Ganzes geprüft wird — als zwanzig lose Schlüssel
--  ließe sich das nicht in einem Schritt prüfen.
--
--  WARUM DER ENTSPERRCODE JETZT IN DER DATENBANK STEHT
--
--  „Sicherheits-/Entsperrcode" unter Einstellungen → Allgemein speicherte
--  bisher nichts Brauchbares: die App meldete „Code gesetzt" und schrieb
--  nichts, die Website legte die Ziffern im Klartext in user_settings und im
--  localStorage ab. Zum Entsperren einer Sperre muss er aber geprüft werden
--  können, ohne dass ihn jemand lesen kann — also bcrypt wie die Spenden-PIN
--  (Schema 72/77). Etwaige Klartext-Einträge werden unten übernommen und
--  gelöscht.
--
--  DER TAG
--
--  Ein Tag ist der Kalendertag in der Zeitzone des Kontos
--  (bildschirmzeit_regeln.zeitzone, Standard Europe/Berlin):
--  (now() at time zone zeitzone)::date. Den Tag schickt kein Client mit —
--  sonst ließe sich die Nutzung auf gestern buchen. gemeinsam/bildschirmzeit.js
--  rechnet mit derselben Zone (ortszeit()).
--
--  DIE OBERGRENZE BEIM ZÄHLEN
--
--  bildschirmzeit_zaehlen nimmt je Aufruf höchstens 120 s und nie mehr, als
--  seit dem letzten Aufruf dieses Kontos vergangen ist (+2 s Spiel). Zwei
--  Geräte gleichzeitig zählen damit nicht doppelt, und kein Client kann einen
--  Tag mit einem Aufruf vollschreiben. Je Bereich und Tag höchstens 86 400 s.
--
--  ELTERN (Schema 52/58)
--
--  Ein Kind unter der Altersgrenze mit bestätigtem Elternteil
--  (konto_alter.eltern_id, status 'frei', Alter < mindestalter) kann von
--  diesem Elternteil Limits bekommen. Dann gilt:
--    - das Kind darf sie nur strenger machen (bildschirmzeit_lockerer —
--      dieselbe Rechnung wie lockerer() in gemeinsam/bildschirmzeit.js),
--    - Entsperren geht nur mit dem Entsperrcode des Elternteils,
--    - der Elternteil sieht die Nutzung des Kindes.
--  Wird das Kind älter als die Grenze, endet die Kontrolle von selbst.
--
--  ERSETZT
--
--  public.zuruecksetzen_einstellungen(uuid) — zuletzt aus
--  SUPABASE_SCHEMA_23_sicherheit.sql (live identisch). Neu: bei Testkonten
--  (ist_testkonto, Schema 62) auch Bildschirmzeit und Entsperrcode leeren.
--  Bei echten Konten bleibt alles stehen — sonst hebelte ein Kind die
--  Elternlimits mit einem Aufruf aus.
--
--  EINSPIELEN
--
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs SUPABASE_SCHEMA_83_bildschirmzeit.sql
--
--  Danach: npm run test:rechte, node test/_minderjaehrig.js,
--          npm run test:bildschirmzeit (in app/).
--
--  Idempotent: mehrfach einspielbar.
-- ===========================================================================

create extension if not exists pgcrypto with schema extensions;


-- ---------------------------------------------------------------------------
--  1. Tabellen
-- ---------------------------------------------------------------------------

create table if not exists public.bildschirmzeit_regeln (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  regeln        jsonb not null default '{}'::jsonb,
  zeitzone      text  not null default 'Europe/Berlin',
  -- Gesetzt von einem Elternteil: das Kind darf nur strenger machen.
  eltern_id     uuid references public.profiles (id) on delete set null,
  geaendert_von uuid references public.profiles (id) on delete set null,
  updated_at    timestamptz not null default now(),
  check (length(regeln::text) < 4000)
);

comment on table public.bildschirmzeit_regeln is
  'Eigene Bildschirmzeit (Kasten 22). Nur ueber bildschirmzeit_setzen() beschreibbar; '
  'eltern_id gesetzt = das Kind darf nur strenger machen.';

create table if not exists public.bildschirmzeit_nutzung (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  tag         date not null,
  bereich     text not null check (bereich in
                ('chats', 'anrufe', 'storys', 'friendmap', 'videos', 'querformat', 'live', 'communitys', 'suche')),
  sekunden    int  not null default 0 check (sekunden between 0 and 86400),
  aktualisiert timestamptz not null default now(),
  primary key (user_id, tag, bereich)
);

comment on table public.bildschirmzeit_nutzung is
  'Gemessene Nutzung je Konto, Tag (Zeitzone des Kontos) und Bereich. Nur ueber bildschirmzeit_zaehlen().';

create table if not exists public.bildschirmzeit_freigaben (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  tag        date not null,
  ziel       text not null check (ziel in
               ('chats', 'anrufe', 'storys', 'friendmap', 'videos', 'querformat', 'live', 'communitys', 'suche',
                'gesamt', 'auszeit')),
  art        text not null check (art in ('mehr', 'code')),
  minuten    int check (minuten is null or minuten between 1 and 1440),  -- null = für heute
  basis      int not null default 0,  -- Nutzung des Ziels beim Freigeben (Sekunden)
  von        uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists bildschirmzeit_freigaben_tag on public.bildschirmzeit_freigaben (user_id, tag);

create table if not exists public.bildschirmzeit_takt (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  zuletzt timestamptz not null default now()
);

create table if not exists public.entsperrcodes (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  code_hash  text not null,
  updated_at timestamptz not null default now()
);

comment on table public.entsperrcodes is
  'Sicherheits-/Entsperrcode aus den Einstellungen, nur als bcrypt-Hash. Niemand liest ihn; '
  'geprueft wird in bildschirmzeit_entsperren().';

create table if not exists public.entsperrcode_versuche (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  art        text not null check (art in ('setzen', 'entsperren')),
  erfolg     boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists entsperrcode_versuche_zeit on public.entsperrcode_versuche (user_id, art, created_at desc);


-- ---------------------------------------------------------------------------
--  2. Hilfsfunktionen (nur intern)
-- ---------------------------------------------------------------------------

create or replace function public.bildschirmzeit_bereiche()
returns text[] language sql immutable as $$
  select array['chats', 'anrufe', 'storys', 'friendmap', 'videos', 'querformat', 'live', 'communitys', 'suche'];
$$;

-- Gleiche Namen wie BEREICHE in gemeinsam/bildschirmzeit.js.
create or replace function public.bildschirmzeit_name(p_bereich text)
returns text language sql immutable as $$
  select case p_bereich
    when 'chats' then 'Messenger-Chats'
    when 'anrufe' then 'Anrufe'
    when 'storys' then 'Storys & Insight Time'
    when 'friendmap' then 'Friend-Map'
    when 'videos' then 'Videos (Home & Hochformat)'
    when 'querformat' then 'Querformat-Videos'
    when 'live' then 'Livestreams'
    when 'communitys' then 'Communitys'
    when 'suche' then 'Suche & Explorer'
    else p_bereich end;
$$;

-- Eine ganze Zahl aus jsonb, sonst null. plpgsql statt sql: ein CASE schützt
-- in SQL nicht sicher vor dem Umwandeln eines Texts (Konstantenfaltung).
create or replace function public.bz_int(j jsonb)
returns int language plpgsql immutable as $$
declare
  d numeric;
begin
  if j is null or jsonb_typeof(j) <> 'number' then
    return null;
  end if;
  d := (j #>> '{}')::numeric;
  if d <> trunc(d) or abs(d) >= 100000 then
    return null;
  end if;
  return d::int;
end;
$$;

-- „22:00" → 1320; sonst null.
create or replace function public.bz_minute(t text)
returns int language plpgsql immutable as $$
declare
  h int;
  m int;
begin
  if t is null or t !~ '^\d{1,2}:\d{2}$' then
    return null;
  end if;
  h := split_part(t, ':', 1)::int;
  m := split_part(t, ':', 2)::int;
  if h > 23 or m > 59 then
    return null;
  end if;
  return h * 60 + m;
end;
$$;

create or replace function public.bz_im_fenster(m int, von int, bis int)
returns boolean language sql immutable as $$
  select case when von is null or bis is null or von = bis then false
              when von < bis then m >= von and m < bis
              else m >= von or m < bis end;
$$;

-- Das Limit, das heute gilt (heutigesLimit() in gemeinsam/bildschirmzeit.js).
create or replace function public.bz_limit(e jsonb, wochenende boolean)
returns int language sql immutable as $$
  select case when public.bz_int(e -> 'werktag') is null then null
              when wochenende and public.bz_int(e -> 'wochenende') is not null then public.bz_int(e -> 'wochenende')
              else public.bz_int(e -> 'werktag') end;
$$;

-- Der Modus eines Bereichs; ein Limit ohne Minuten gilt nicht (normalisieren()).
create or replace function public.bz_modus(r jsonb, b text)
returns text language sql immutable as $$
  select case
    when coalesce(r -> 'bereiche' -> b ->> 'modus', '') not in ('immer', 'limit', 'gesperrt') then 'standard'
    when r -> 'bereiche' -> b ->> 'modus' = 'limit' and public.bz_int(r -> 'bereiche' -> b -> 'werktag') is null then 'standard'
    else r -> 'bereiche' -> b ->> 'modus' end;
$$;

create or replace function public.bz_rang(modus text)
returns int language sql immutable as $$
  select case modus when 'gesperrt' then 0 when 'limit' then 1 when 'immer' then 3 else 2 end;
$$;

create or replace function public.bz_auszeit_an(r jsonb)
returns boolean language sql immutable as $$
  select coalesce(r -> 'auszeit' ->> 'an', '') = 'true'
     and public.bz_minute(r -> 'auszeit' ->> 'von') is not null
     and public.bz_minute(r -> 'auszeit' ->> 'bis') is not null
     and public.bz_minute(r -> 'auszeit' ->> 'von') <> public.bz_minute(r -> 'auszeit' ->> 'bis');
$$;

/*
 * Regeln prüfen — dieselben Prüfungen wie pruefen() in
 * gemeinsam/bildschirmzeit.js. null = in Ordnung, sonst der Grund.
 */
create or replace function public.bildschirmzeit_pruefen(r jsonb)
returns text language plpgsql immutable as $$
declare
  k text;
  e jsonb;
  w text;
  n int;
begin
  if r is null or jsonb_typeof(r) <> 'object' then
    return 'Die Regeln sind unvollständig.';
  end if;
  if length(r::text) >= 4000 then
    return 'Die Regeln sind zu lang.';
  end if;
  for k in select jsonb_object_keys(r) loop
    if k not in ('gesamt', 'bereiche', 'auszeit', 'pause') then
      return format('Unbekannte Angabe „%s".', k);
    end if;
  end loop;

  if r ? 'gesamt' and jsonb_typeof(r -> 'gesamt') not in ('object', 'null') then
    return 'Das Tageslimit ist ungültig.';
  end if;
  foreach w in array array['werktag', 'wochenende'] loop
    if coalesce(jsonb_typeof(r -> 'gesamt' -> w), 'null') <> 'null' then
      n := public.bz_int(r -> 'gesamt' -> w);
      if n is null or n < 1 or n > 1440 then
        return 'Das Tageslimit muss zwischen 1 und 1440 Minuten liegen.';
      end if;
    end if;
  end loop;

  if r ? 'bereiche' then
    if jsonb_typeof(r -> 'bereiche') <> 'object' then
      return 'Die Bereiche sind ungültig.';
    end if;
    for k, e in select key, value from jsonb_each(r -> 'bereiche') loop
      if not (k = any(public.bildschirmzeit_bereiche())) then
        return format('Unbekannter Bereich „%s".', k);
      end if;
      if jsonb_typeof(e) <> 'object' or coalesce(e ->> 'modus', '') not in ('standard', 'immer', 'limit', 'gesperrt') then
        return 'Unbekannte Einstellung für einen Bereich.';
      end if;
      foreach w in array array['werktag', 'wochenende'] loop
        if coalesce(jsonb_typeof(e -> w), 'null') <> 'null' then
          n := public.bz_int(e -> w);
          if n is null or n < 1 or n > 1440 then
            return 'Ein Limit muss zwischen 1 und 1440 Minuten liegen.';
          end if;
        end if;
      end loop;
      if e ->> 'modus' = 'limit' and public.bz_int(e -> 'werktag') is null then
        return 'Ein Limit braucht eine Minutenzahl.';
      end if;
    end loop;
  end if;

  if coalesce(r -> 'auszeit' ->> 'an', '') = 'true' then
    if public.bz_minute(r -> 'auszeit' ->> 'von') is null or public.bz_minute(r -> 'auszeit' ->> 'bis') is null then
      return 'Die Auszeit braucht Beginn und Ende.';
    end if;
    if public.bz_minute(r -> 'auszeit' ->> 'von') = public.bz_minute(r -> 'auszeit' ->> 'bis') then
      return 'Beginn und Ende der Auszeit sind gleich.';
    end if;
  end if;

  if coalesce(jsonb_typeof(r -> 'pause'), 'null') <> 'null' then
    n := public.bz_int(r -> 'pause');
    if n is null or n < 0 or n > 240 then
      return 'Die Pausen-Erinnerung muss zwischen 0 und 240 Minuten liegen.';
    end if;
  end if;
  return null;
end;
$$;

/*
 * Ist `neu` irgendwo lockerer als `alt`? null = nein (nur gleich oder
 * strenger), sonst der Grund. Dieselbe Rechnung wie lockerer() in
 * gemeinsam/bildschirmzeit.js; test:bildschirmzeit vergleicht beide.
 */
create or replace function public.bildschirmzeit_lockerer(alt jsonb, neu jsonb)
returns text language plpgsql immutable as $$
declare
  we boolean;
  b  text;
  a  int;
  n  int;
  ma text;
  mn text;
  m  int;
  ap int;
  np int;
begin
  alt := coalesce(alt, '{}'::jsonb);
  neu := coalesce(neu, '{}'::jsonb);

  foreach we in array array[false, true] loop
    a := public.bz_limit(alt -> 'gesamt', we);
    n := public.bz_limit(neu -> 'gesamt', we);
    if a is not null and (n is null or n > a) then
      return 'Das Tageslimit gesamt darf nur kleiner werden.';
    end if;
  end loop;

  foreach b in array public.bildschirmzeit_bereiche() loop
    ma := public.bz_modus(alt, b);
    mn := public.bz_modus(neu, b);
    if public.bz_rang(mn) > public.bz_rang(ma) then
      return public.bildschirmzeit_name(b) || ': nur strenger, nicht lockerer.';
    end if;
    if ma = 'limit' and mn = 'limit' then
      foreach we in array array[false, true] loop
        a := public.bz_limit(alt -> 'bereiche' -> b, we);
        n := public.bz_limit(neu -> 'bereiche' -> b, we);
        if n > a then
          return public.bildschirmzeit_name(b) || ': das Limit darf nur kleiner werden.';
        end if;
      end loop;
    end if;
  end loop;

  if public.bz_auszeit_an(alt) then
    if not public.bz_auszeit_an(neu) then
      return 'Die Auszeit darf nicht ausgeschaltet werden.';
    end if;
    for m in 0..1439 loop
      if public.bz_im_fenster(m, public.bz_minute(alt -> 'auszeit' ->> 'von'), public.bz_minute(alt -> 'auszeit' ->> 'bis'))
         and not public.bz_im_fenster(m, public.bz_minute(neu -> 'auszeit' ->> 'von'), public.bz_minute(neu -> 'auszeit' ->> 'bis')) then
        return 'Die Auszeit darf nur länger werden.';
      end if;
    end loop;
  end if;

  ap := coalesce(public.bz_int(alt -> 'pause'), 0);
  np := coalesce(public.bz_int(neu -> 'pause'), 0);
  if ap > 0 and (np = 0 or np > ap) then
    return 'Die Pausen-Erinnerung darf nur häufiger kommen.';
  end if;
  return null;
end;
$$;

/*
 * Der Elternteil, der die Bildschirmzeit dieses Kontos bestimmen darf —
 * oder null. Nur solange das Kind unter der Altersgrenze ist und der
 * Elternteil zugestimmt hat (Schema 52: status 'frei' mit eltern_id).
 */
create or replace function public.bildschirmzeit_eltern_von(p_kind uuid)
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select k.eltern_id
    from public.konto_alter k
   where k.user_id = p_kind
     and k.eltern_id is not null
     and k.status = 'frei'
     and k.geburtsdatum is not null
     and public.alter_in_jahren(k.geburtsdatum) < k.mindestalter
     and public.eltern_geeignet(k.eltern_id, p_kind);
$$;

-- Für die Leseregeln: bin ICH der Elternteil dieses Kontos? Verrät nur ja/nein.
create or replace function public.bildschirmzeit_bin_eltern_von(p_kind uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select auth.uid() is not null and public.bildschirmzeit_eltern_von(p_kind) = auth.uid();
$$;

-- Zeitzone und heutiger Tag eines Kontos.
create or replace function public.bildschirmzeit_heute(p_user uuid)
returns date
language sql
stable
security definer set search_path = public
as $$
  select (now() at time zone coalesce(
            (select r.zeitzone from public.bildschirmzeit_regeln r where r.user_id = p_user),
            'Europe/Berlin'))::date;
$$;

-- Ist am heutigen Tag des Kontos Wochenende?
create or replace function public.bildschirmzeit_wochenende(p_user uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select extract(isodow from public.bildschirmzeit_heute(p_user)) >= 6;
$$;

/*
 * Die Nutzung eines Ziels heute (Sekunden) — als `basis` einer Freigabe.
 * Für 'gesamt' ohne die „Immer erlaubt"-Bereiche (gesamtGenutzt()).
 */
create or replace function public.bildschirmzeit_basis(p_user uuid, p_ziel text)
returns int
language sql
stable
security definer set search_path = public
as $$
  select case
    when p_ziel = 'auszeit' then 0
    when p_ziel = 'gesamt' then coalesce((
      select sum(n.sekunden)::int
        from public.bildschirmzeit_nutzung n
       where n.user_id = p_user
         and n.tag = public.bildschirmzeit_heute(p_user)
         and public.bz_modus(coalesce((select r.regeln from public.bildschirmzeit_regeln r where r.user_id = p_user), '{}'::jsonb),
                             n.bereich) <> 'immer'), 0)
    else coalesce((
      select n.sekunden
        from public.bildschirmzeit_nutzung n
       where n.user_id = p_user
         and n.tag = public.bildschirmzeit_heute(p_user)
         and n.bereich = p_ziel), 0)
  end;
$$;

-- Wer die Regeln gerade bestimmt: der Elternteil (wenn gültig) oder niemand.
create or replace function public.bildschirmzeit_kontrolle(p_user uuid)
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select r.eltern_id
    from public.bildschirmzeit_regeln r
   where r.user_id = p_user
     and r.eltern_id is not null
     and r.eltern_id = public.bildschirmzeit_eltern_von(p_user);
$$;


-- ---------------------------------------------------------------------------
--  3. Was App und Website aufrufen
-- ---------------------------------------------------------------------------

/*
 * Alles, was die Einstellungen und die Sperre brauchen, in einem Aufruf.
 * p_ziel = ein eigenes Kind (Elternansicht); ohne = das eigene Konto.
 */
create or replace function public.bildschirmzeit_stand(p_ziel uuid default null)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_ich       uuid := auth.uid();
  v_ziel      uuid := coalesce(p_ziel, auth.uid());
  zeile     public.bildschirmzeit_regeln;
  heute     date;
  kontrolle uuid;
begin
  if v_ich is null or not public.konto_freigegeben() then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  if v_ziel <> v_ich and public.bildschirmzeit_eltern_von(v_ziel) is distinct from v_ich then
    return jsonb_build_object('ok', false, 'grund', 'nicht_erlaubt');
  end if;

  select * into zeile from public.bildschirmzeit_regeln where user_id = v_ziel;
  heute := public.bildschirmzeit_heute(v_ziel);
  kontrolle := public.bildschirmzeit_kontrolle(v_ziel);

  return jsonb_build_object(
    'ok', true,
    'ziel', v_ziel,
    'ich', v_ziel = v_ich,
    'regeln', coalesce(zeile.regeln, '{}'::jsonb),
    'zeitzone', coalesce(zeile.zeitzone, 'Europe/Berlin'),
    'tag', heute,
    'nutzung', coalesce((
      select jsonb_object_agg(n.bereich, n.sekunden)
        from public.bildschirmzeit_nutzung n
       where n.user_id = v_ziel and n.tag = heute), '{}'::jsonb),
    'woche', coalesce((
      select jsonb_agg(jsonb_build_object('tag', n.tag, 'bereich', n.bereich, 'sekunden', n.sekunden) order by n.tag)
        from public.bildschirmzeit_nutzung n
       where n.user_id = v_ziel and n.tag between heute - 6 and heute), '[]'::jsonb),
    'freigaben', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ziel', f.ziel, 'art', f.art, 'minuten', f.minuten, 'basis', f.basis,
               'tag', f.tag,
               -- Mit „Z" und Millisekunden: Date.parse in Hermes nimmt keine Mikrosekunden.
               'created_at', to_char(f.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
             order by f.created_at)
        from public.bildschirmzeit_freigaben f
       where f.user_id = v_ziel
         and (f.tag = heute or (f.ziel = 'auszeit' and f.created_at > now() - interval '24 hours'))), '[]'::jsonb),
    'eltern', (select jsonb_build_object('id', p.id, 'name', p.name, 'handle', p.handle)
                 from public.profiles p where p.id = kontrolle),
    -- Gilt für das Entsperren: der Code des Elternteils, sonst der eigene.
    'code_gesetzt', exists (select 1 from public.entsperrcodes c where c.user_id = coalesce(kontrolle, v_ziel)),
    'eigener_code', exists (select 1 from public.entsperrcodes c where c.user_id = v_ich),
    'kinder', case when v_ziel = v_ich then coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'handle', p.handle) order by p.name)
        from public.konto_alter k
        join public.profiles p on p.id = k.user_id
       where k.eltern_id = v_ich
         and public.bildschirmzeit_eltern_von(k.user_id) = v_ich), '[]'::jsonb)
      else '[]'::jsonb end
  );
end;
$$;

/*
 * Regeln speichern. p_ziel = ein eigenes Kind; ohne = das eigene Konto.
 * Haben die Eltern die Regeln gesetzt, darf das Kind nur strenger machen.
 */
create or replace function public.bildschirmzeit_setzen(
  p_regeln jsonb, p_zeitzone text default null, p_ziel uuid default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_ich       uuid := auth.uid();
  v_ziel      uuid := coalesce(p_ziel, auth.uid());
  alt       public.bildschirmzeit_regeln;
  kontrolle uuid;
  fehler    text;
  zone      text := p_zeitzone;
begin
  if v_ich is null or not public.konto_freigegeben() then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;

  fehler := public.bildschirmzeit_pruefen(p_regeln);
  if fehler is not null then
    return jsonb_build_object('ok', false, 'grund', 'ungueltig', 'meldung', fehler);
  end if;

  if zone is not null and not exists (select 1 from pg_timezone_names where name = zone) then
    zone := null;
  end if;

  select * into alt from public.bildschirmzeit_regeln where user_id = v_ziel for update;
  kontrolle := public.bildschirmzeit_kontrolle(v_ziel);

  if v_ziel = v_ich then
    if kontrolle is not null then
      fehler := public.bildschirmzeit_lockerer(alt.regeln, p_regeln);
      if fehler is not null then
        return jsonb_build_object('ok', false, 'grund', 'eltern', 'meldung', fehler);
      end if;
      -- Die Zeitzone bleibt, wie sie war: sonst ließe sich der Tag verschieben.
      zone := null;
    end if;
  else
    if public.bildschirmzeit_eltern_von(v_ziel) is distinct from v_ich then
      return jsonb_build_object('ok', false, 'grund', 'nicht_erlaubt',
                                'meldung', 'Du kannst die Bildschirmzeit dieses Kontos nicht festlegen.');
    end if;
    kontrolle := v_ich;
    -- Die Zone des Kindes bleibt; nur beim ersten Mal die des Elternteils.
    if alt.user_id is not null then zone := null; end if;
  end if;

  insert into public.bildschirmzeit_regeln as r (user_id, regeln, zeitzone, eltern_id, geaendert_von, updated_at)
  values (v_ziel, p_regeln, coalesce(zone, 'Europe/Berlin'), kontrolle, v_ich, now())
  on conflict (user_id) do update
     set regeln = excluded.regeln,
         zeitzone = coalesce(zone, r.zeitzone),
         eltern_id = kontrolle,
         geaendert_von = v_ich,
         updated_at = now();

  return jsonb_build_object('ok', true, 'eltern', kontrolle is not null);
end;
$$;

-- Der Elternteil gibt die Bildschirmzeit des Kindes wieder frei (Kind darf dann selbst).
create or replace function public.bildschirmzeit_elternkontrolle_beenden(p_kind uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.bildschirmzeit_eltern_von(p_kind) is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'grund', 'nicht_erlaubt');
  end if;
  update public.bildschirmzeit_regeln set eltern_id = null, geaendert_von = auth.uid(), updated_at = now()
   where user_id = p_kind;
  return jsonb_build_object('ok', true);
end;
$$;

/*
 * Gemessene Zeit hochzählen. p_stuecke = [{"bereich": "videos", "sekunden": 30}, …].
 * Zusammen höchstens 120 s je Aufruf und nie mehr, als seit dem letzten
 * Aufruf dieses Kontos vergangen ist (+2 s).
 */
create or replace function public.bildschirmzeit_zaehlen(p_stuecke jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  ich     uuid := auth.uid();
  heute   date;
  v_zuletzt timestamptz;
  budget  int := 120;
  stueck  jsonb;
  b       text;
  s       int;
  summe   int := 0;
begin
  if ich is null or not public.konto_freigegeben() then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  if p_stuecke is null or jsonb_typeof(p_stuecke) <> 'array' or jsonb_array_length(p_stuecke) > 20 then
    return jsonb_build_object('ok', false, 'grund', 'ungueltig');
  end if;

  select t.zuletzt into v_zuletzt from public.bildschirmzeit_takt t where t.user_id = ich for update;
  if v_zuletzt is not null then
    budget := least(budget, greatest(0, ceil(extract(epoch from now() - v_zuletzt))::int + 2));
  end if;
  insert into public.bildschirmzeit_takt (user_id, zuletzt) values (ich, now())
  on conflict (user_id) do update set zuletzt = now();

  heute := public.bildschirmzeit_heute(ich);

  for stueck in select value from jsonb_array_elements(p_stuecke) loop
    b := stueck ->> 'bereich';
    s := public.bz_int(stueck -> 'sekunden');
    continue when b is null or not (b = any(public.bildschirmzeit_bereiche())) or s is null or s < 1;
    s := least(s, budget);
    continue when s < 1;
    budget := budget - s;
    summe := summe + s;
    insert into public.bildschirmzeit_nutzung as n (user_id, tag, bereich, sekunden, aktualisiert)
    values (ich, heute, b, s, now())
    on conflict (user_id, tag, bereich) do update
       set sekunden = least(86400, n.sekunden + excluded.sekunden),
           aktualisiert = now();
  end loop;

  return jsonb_build_object(
    'ok', true,
    'gezaehlt', summe,
    'tag', heute,
    'nutzung', coalesce((
      select jsonb_object_agg(n.bereich, n.sekunden)
        from public.bildschirmzeit_nutzung n
       where n.user_id = ich and n.tag = heute), '{}'::jsonb));
end;
$$;

/*
 * „15 Min. mehr" — einmal je Bereich bzw. Tageslimit und Tag, für die Auszeit
 * einmal in 12 Stunden. Gesperrte Bereiche gehen nur mit Code.
 * Gleiche Regel wie mehrNochFrei() in gemeinsam/bildschirmzeit.js.
 */
create or replace function public.bildschirmzeit_mehr(p_ziel text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  ich   uuid := auth.uid();
  heute date;
  r     jsonb;
begin
  if ich is null or not public.konto_freigegeben() then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  if p_ziel is null or not (p_ziel = any(public.bildschirmzeit_bereiche() || array['gesamt', 'auszeit'])) then
    return jsonb_build_object('ok', false, 'grund', 'ungueltig');
  end if;

  heute := public.bildschirmzeit_heute(ich);
  r := coalesce((select x.regeln from public.bildschirmzeit_regeln x where x.user_id = ich), '{}'::jsonb);

  if p_ziel <> 'gesamt' and p_ziel <> 'auszeit' and public.bz_modus(r, p_ziel) = 'gesperrt' then
    return jsonb_build_object('ok', false, 'grund', 'nur_mit_code',
                              'meldung', 'Ein gesperrter Bereich lässt sich nur mit dem Entsperrcode öffnen.');
  end if;

  perform pg_advisory_xact_lock(hashtext('bildschirmzeit_mehr:' || ich::text));
  if exists (
    select 1 from public.bildschirmzeit_freigaben f
     where f.user_id = ich and f.ziel = p_ziel and f.art = 'mehr'
       and case when p_ziel = 'auszeit' then f.created_at > now() - interval '12 hours'
                else f.tag = heute end) then
    return jsonb_build_object('ok', false, 'grund', 'schon_genutzt',
                              'meldung', 'Die 15 Minuten mehr hast du heute schon genommen.');
  end if;

  insert into public.bildschirmzeit_freigaben (user_id, tag, ziel, art, minuten, basis, von)
  values (ich, heute, p_ziel, 'mehr', 15, public.bildschirmzeit_basis(ich, p_ziel), ich);
  return jsonb_build_object('ok', true, 'minuten', 15);
end;
$$;

/*
 * Mit dem Entsperrcode freigeben: 15 Min., 1 Std. oder für heute (null).
 * Bestimmen die Eltern die Regeln, gilt ihr Code, nicht der eigene.
 * Fünf falsche Versuche in 15 Minuten sperren für den Rest dieser Zeit.
 */
create or replace function public.bildschirmzeit_entsperren(p_ziel text, p_code text, p_minuten int default 15)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  ich       uuid := auth.uid();
  heute     date;
  kontrolle uuid;
  hash      text;
begin
  if ich is null or not public.konto_freigegeben() then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  if p_ziel is null or not (p_ziel = any(public.bildschirmzeit_bereiche() || array['gesamt', 'auszeit'])) then
    return jsonb_build_object('ok', false, 'grund', 'ungueltig');
  end if;
  if p_minuten is not null and p_minuten not in (15, 60) then
    return jsonb_build_object('ok', false, 'grund', 'ungueltig');
  end if;

  if (select count(*) from public.entsperrcode_versuche v
       where v.user_id = ich and v.art = 'entsperren' and not v.erfolg
         and v.created_at > now() - interval '15 minutes') >= 5 then
    return jsonb_build_object('ok', false, 'grund', 'zu_viele_versuche',
                              'meldung', 'Zu viele falsche Versuche. Versuch es in 15 Minuten noch einmal.');
  end if;

  kontrolle := public.bildschirmzeit_kontrolle(ich);
  select c.code_hash into hash from public.entsperrcodes c where c.user_id = coalesce(kontrolle, ich);
  if hash is null then
    return jsonb_build_object('ok', false, 'grund', 'kein_code', 'eltern', kontrolle is not null);
  end if;

  if p_code is null or extensions.crypt(p_code, hash) <> hash then
    insert into public.entsperrcode_versuche (user_id, art, erfolg) values (ich, 'entsperren', false);
    return jsonb_build_object('ok', false, 'grund', 'falsch', 'meldung', 'Der Code stimmt nicht.');
  end if;
  insert into public.entsperrcode_versuche (user_id, art, erfolg) values (ich, 'entsperren', true);

  heute := public.bildschirmzeit_heute(ich);
  insert into public.bildschirmzeit_freigaben (user_id, tag, ziel, art, minuten, basis, von)
  values (ich, heute, p_ziel, 'code', p_minuten, public.bildschirmzeit_basis(ich, p_ziel), coalesce(kontrolle, ich));
  return jsonb_build_object('ok', true, 'minuten', p_minuten);
end;
$$;

/*
 * Den Sicherheits-/Entsperrcode setzen (Einstellungen → Allgemein).
 * Steht schon einer, braucht es den bisherigen — oder eine frische Anmeldung
 * mit Passwort (frisch_angemeldet(), wie bei der Spenden-PIN), damit ein
 * vergessener Code nicht für immer gilt.
 */
create or replace function public.entsperrcode_setzen(p_neu text, p_bisher text default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  ich  uuid := auth.uid();
  hash text;
begin
  if ich is null or not public.konto_freigegeben() then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  if (select count(*) from public.entsperrcode_versuche v
       where v.user_id = ich and v.art = 'setzen' and v.created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'grund', 'zu_viele_versuche',
                              'meldung', 'Zu viele Versuche. Versuch es in einer Stunde noch einmal.');
  end if;
  insert into public.entsperrcode_versuche (user_id, art, erfolg) values (ich, 'setzen', false);

  if p_neu is null or p_neu !~ '^\d{4,8}$' then
    return jsonb_build_object('ok', false, 'grund', 'ungueltig', 'meldung', 'Der Code muss aus 4 bis 8 Ziffern bestehen');
  end if;

  select c.code_hash into hash from public.entsperrcodes c where c.user_id = ich;
  if hash is not null then
    if coalesce(btrim(p_bisher), '') = '' then
      if not public.frisch_angemeldet() then
        return jsonb_build_object('ok', false, 'grund', 'bisher_fehlt',
                                  'meldung', 'Gib deinen bisherigen Code ein — oder melde dich neu an, wenn du ihn vergessen hast.');
      end if;
    elsif extensions.crypt(btrim(p_bisher), hash) <> hash then
      return jsonb_build_object('ok', false, 'grund', 'bisher_falsch', 'meldung', 'Der bisherige Code stimmt nicht.');
    end if;
  end if;

  insert into public.entsperrcodes (user_id, code_hash, updated_at)
  values (ich, extensions.crypt(p_neu, extensions.gen_salt('bf', 8)), now())
  on conflict (user_id) do update set code_hash = excluded.code_hash, updated_at = now();

  update public.entsperrcode_versuche set erfolg = true
   where id = (select max(id) from public.entsperrcode_versuche where user_id = ich and art = 'setzen');
  return jsonb_build_object('ok', true);
end;
$$;


-- ---------------------------------------------------------------------------
--  4. Leseregeln — nur eigene Zeilen und die eigener Kinder; schreiben nur
--     über die Funktionen oben.
-- ---------------------------------------------------------------------------

alter table public.bildschirmzeit_regeln    enable row level security;
alter table public.bildschirmzeit_nutzung   enable row level security;
alter table public.bildschirmzeit_freigaben enable row level security;
alter table public.bildschirmzeit_takt      enable row level security;
alter table public.entsperrcodes            enable row level security;
alter table public.entsperrcode_versuche    enable row level security;

drop policy if exists bildschirmzeit_regeln_lesen on public.bildschirmzeit_regeln;
create policy bildschirmzeit_regeln_lesen on public.bildschirmzeit_regeln
  for select to authenticated
  using (user_id = auth.uid() or public.bildschirmzeit_bin_eltern_von(user_id));

drop policy if exists bildschirmzeit_nutzung_lesen on public.bildschirmzeit_nutzung;
create policy bildschirmzeit_nutzung_lesen on public.bildschirmzeit_nutzung
  for select to authenticated
  using (user_id = auth.uid() or public.bildschirmzeit_bin_eltern_von(user_id));

drop policy if exists bildschirmzeit_freigaben_lesen on public.bildschirmzeit_freigaben;
create policy bildschirmzeit_freigaben_lesen on public.bildschirmzeit_freigaben
  for select to authenticated
  using (user_id = auth.uid() or public.bildschirmzeit_bin_eltern_von(user_id));

-- takt, entsperrcodes, entsperrcode_versuche: keine Regel — niemand liest sie direkt.

revoke all on public.bildschirmzeit_regeln    from anon, authenticated;
revoke all on public.bildschirmzeit_nutzung   from anon, authenticated;
revoke all on public.bildschirmzeit_freigaben from anon, authenticated;
revoke all on public.bildschirmzeit_takt      from anon, authenticated;
revoke all on public.entsperrcodes            from anon, authenticated;
revoke all on public.entsperrcode_versuche    from anon, authenticated;
grant select on public.bildschirmzeit_regeln    to authenticated;
grant select on public.bildschirmzeit_nutzung   to authenticated;
grant select on public.bildschirmzeit_freigaben to authenticated;
revoke all on sequence public.entsperrcode_versuche_id_seq from anon, authenticated;

-- Minderjährigen-Freigabe (Schema 52 Teil 4 / Schema 74) auf jeder neuen Tabelle.
do $$
declare t text;
begin
  foreach t in array array['bildschirmzeit_regeln', 'bildschirmzeit_nutzung', 'bildschirmzeit_freigaben',
                           'bildschirmzeit_takt', 'entsperrcodes', 'entsperrcode_versuche'] loop
    execute format('drop policy if exists nur_freigegebene on public.%I', t);
    execute format(
      'create policy nur_freigegebene on public.%I as restrictive for all to authenticated '
      || 'using ((select public.konto_freigegeben())) with check ((select public.konto_freigegeben()))', t);
  end loop;
end $$;


-- ---------------------------------------------------------------------------
--  5. Klartext-Codes aus user_settings übernehmen und löschen
--
--  Die Website legte den Code bis heute unter dem Schlüssel
--  'Sicherheits-/Entsperrcode' im Klartext ab. Stand 06.10.2026 gab es live
--  keine solche Zeile; der Block bleibt für den Fall, dass bis zum Einspielen
--  jemand einen Code gesetzt hat.
-- ---------------------------------------------------------------------------

insert into public.entsperrcodes (user_id, code_hash, updated_at)
select s.user_id, extensions.crypt(s.wert, extensions.gen_salt('bf', 8)), now()
  from public.user_settings s
 where s.schluessel = 'Sicherheits-/Entsperrcode'
   and s.wert ~ '^\d{4,8}$'
on conflict (user_id) do nothing;

delete from public.user_settings where schluessel = 'Sicherheits-/Entsperrcode';


-- ---------------------------------------------------------------------------
--  6. Zurücksetzen (Testbestand)
--
--  Ersetzt zuruecksetzen_einstellungen() aus SUPABASE_SCHEMA_23_sicherheit.sql.
--  Neu ist nur der letzte Block: bei Testkonten auch Bildschirmzeit und
--  Entsperrcode leeren. Bei echten Konten nicht — die Funktion ist für jedes
--  angemeldete Konto aufrufbar, und ein Kind könnte sonst die Limits seiner
--  Eltern und die gezählte Zeit mit einem Aufruf löschen.
-- ---------------------------------------------------------------------------

create or replace function public.zuruecksetzen_einstellungen(ziel uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  /*
   * Sicherheitspruefung vom 03.09.2026 (Sicherheitspruefung Fund 4).
   *
   * `security definer` heisst: die Funktion laeuft mit den Rechten ihres
   * Eigentuemers und umgeht Row Level Security vollstaendig. Der Schutz, auf
   * den sich App und Website sonst verlassen, greift hier nicht — und die
   * Funktion nahm bis heute jede beliebige Kennung entgegen.
   *
   * Sie loescht `user_settings` und `profile_views` — bis heute zu
   * jeder beliebigen Kennung.
   *
   * Darum als allererstes: die Kennung muss dem Aufrufer gehoeren. Kein
   * `return jsonb ...`, sondern eine Ausnahme — ein solcher Aufruf ist kein
   * Sonderfall, den man freundlich beantwortet, sondern ein Uebergriff.
   */
  if ziel is distinct from auth.uid() then
    raise exception 'nicht erlaubt';
  end if;

  delete from public.user_settings where user_id = ziel;
  delete from public.profile_views where profile_id = ziel or viewer_id = ziel;

  -- Kasten 22: Bildschirmzeit nur bei Testkonten (Schema 62) leeren.
  if public.ist_testkonto(ziel) then
    delete from public.bildschirmzeit_regeln    where user_id = ziel;
    delete from public.bildschirmzeit_nutzung   where user_id = ziel;
    -- Qualifiziert: bildschirmzeit_freigaben hat selbst eine Spalte „ziel".
    delete from public.bildschirmzeit_freigaben f where f.user_id = zuruecksetzen_einstellungen.ziel;
    delete from public.bildschirmzeit_takt      where user_id = ziel;
    delete from public.entsperrcodes            where user_id = ziel;
    delete from public.entsperrcode_versuche    where user_id = ziel;
  end if;
end;
$function$;


-- ---------------------------------------------------------------------------
--  7. Rechte
--
--  Postgres gibt EXECUTE an PUBLIC (Schema 37). Intern bleibt intern; die
--  Oberflächen rufen nur die sieben Funktionen aus Teil 3.
-- ---------------------------------------------------------------------------

revoke execute on function public.bildschirmzeit_bereiche()              from public, anon, authenticated;
revoke execute on function public.bildschirmzeit_name(text)              from public, anon, authenticated;
revoke execute on function public.bz_int(jsonb)                          from public, anon, authenticated;
revoke execute on function public.bz_minute(text)                        from public, anon, authenticated;
revoke execute on function public.bz_im_fenster(int, int, int)           from public, anon, authenticated;
revoke execute on function public.bz_limit(jsonb, boolean)               from public, anon, authenticated;
revoke execute on function public.bz_modus(jsonb, text)                  from public, anon, authenticated;
revoke execute on function public.bz_rang(text)                          from public, anon, authenticated;
revoke execute on function public.bz_auszeit_an(jsonb)                   from public, anon, authenticated;
revoke execute on function public.bildschirmzeit_pruefen(jsonb)          from public, anon, authenticated;
revoke execute on function public.bildschirmzeit_lockerer(jsonb, jsonb)  from public, anon, authenticated;
revoke execute on function public.bildschirmzeit_eltern_von(uuid)        from public, anon, authenticated;
revoke execute on function public.bildschirmzeit_heute(uuid)             from public, anon, authenticated;
revoke execute on function public.bildschirmzeit_wochenende(uuid)        from public, anon, authenticated;
revoke execute on function public.bildschirmzeit_basis(uuid, text)       from public, anon, authenticated;
revoke execute on function public.bildschirmzeit_kontrolle(uuid)         from public, anon, authenticated;

-- Wird von den Leseregeln im Namen des angemeldeten Kontos gerufen.
revoke execute on function public.bildschirmzeit_bin_eltern_von(uuid)    from public, anon;
grant  execute on function public.bildschirmzeit_bin_eltern_von(uuid)    to authenticated;

revoke execute on function public.bildschirmzeit_stand(uuid)                       from public, anon;
revoke execute on function public.bildschirmzeit_setzen(jsonb, text, uuid)         from public, anon;
revoke execute on function public.bildschirmzeit_elternkontrolle_beenden(uuid)     from public, anon;
revoke execute on function public.bildschirmzeit_zaehlen(jsonb)                    from public, anon;
revoke execute on function public.bildschirmzeit_mehr(text)                        from public, anon;
revoke execute on function public.bildschirmzeit_entsperren(text, text, int)       from public, anon;
revoke execute on function public.entsperrcode_setzen(text, text)                  from public, anon;
grant  execute on function public.bildschirmzeit_stand(uuid)                       to authenticated;
grant  execute on function public.bildschirmzeit_setzen(jsonb, text, uuid)         to authenticated;
grant  execute on function public.bildschirmzeit_elternkontrolle_beenden(uuid)     to authenticated;
grant  execute on function public.bildschirmzeit_zaehlen(jsonb)                    to authenticated;
grant  execute on function public.bildschirmzeit_mehr(text)                        to authenticated;
grant  execute on function public.bildschirmzeit_entsperren(text, text, int)       to authenticated;
grant  execute on function public.entsperrcode_setzen(text, text)                  to authenticated;

-- zuruecksetzen_einstellungen behält seine Rechte (create or replace ändert sie nicht).


-- ---------------------------------------------------------------------------
--  Nachweis
-- ---------------------------------------------------------------------------
do $$
begin
  if public.bildschirmzeit_pruefen('{"bereiche":{"videos":{"modus":"limit","werktag":20}},"pause":15}'::jsonb) is not null then
    raise exception 'bildschirmzeit_pruefen lehnt gültige Regeln ab';
  end if;
  if public.bildschirmzeit_pruefen('{"bereiche":{"videos":{"modus":"limit"}}}'::jsonb) is null then
    raise exception 'bildschirmzeit_pruefen nimmt ein Limit ohne Minuten an';
  end if;
  if public.bildschirmzeit_lockerer('{"bereiche":{"videos":{"modus":"limit","werktag":20}}}'::jsonb,
                                    '{"bereiche":{"videos":{"modus":"limit","werktag":30}}}'::jsonb) is null then
    raise exception 'bildschirmzeit_lockerer erkennt ein größeres Limit nicht';
  end if;
  if public.bildschirmzeit_lockerer('{"bereiche":{"videos":{"modus":"limit","werktag":20}}}'::jsonb,
                                    '{"bereiche":{"videos":{"modus":"gesperrt"}}}'::jsonb) is not null then
    raise exception 'bildschirmzeit_lockerer hält Sperren für lockerer';
  end if;
  if has_function_privilege('anon', 'public.bildschirmzeit_zaehlen(jsonb)', 'execute') then
    raise exception 'anon darf bildschirmzeit_zaehlen ausführen';
  end if;
  if pg_get_functiondef('public.zuruecksetzen_einstellungen(uuid)'::regprocedure) not like '%ist_testkonto(ziel)%' then
    raise exception 'zuruecksetzen_einstellungen ohne Testkonto-Prüfung';
  end if;
end $$;
