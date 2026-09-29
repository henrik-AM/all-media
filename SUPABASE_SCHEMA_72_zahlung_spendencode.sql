-- ===========================================================================
--  SUPABASE_SCHEMA_72_zahlung_spendencode.sql            (ENTWURF, Kasten 13)
--
--  Die Nummer XX vergibt der Hauptagent beim Einspielen. Die Datei ist
--  idempotent: zweimal eingespielt ändert sie nichts.
--
--  WARUM ES DAS GIBT
--
--  Henrik am 21.09.2026: „Zahlungsmethode für den Spenden-Code (PayPal,
--  Apple Pay, Google Pay, Kreditkarte o. ä.). Gespendet wird über einen
--  personalisierten Code, den der Nutzer selbst festlegt; spätestens beim
--  Spenden zu einem Spendenziel oder im Livestream."
--
--  Vorgefunden am 29.09.2026:
--
--  1. `donations` hatte eine INSERT-Regel „auth.uid() = sender_id“. Jede
--     angemeldete Sitzung konnte also beliebig viele Spenden eintragen —
--     ohne Code, ohne Zahlungsmethode, ohne dass irgendwer zustimmte.
--  2. „Spendencode“ war in App und Website ein Formular, das „gespeichert“
--     meldete und nichts speicherte.
--  3. Eine Zahlungsmethode gab es nirgends.
--
--  WAS HIER GESCHIEHT
--
--  - zahlungsmethoden: je Nutzer PayPal, Apple Pay, Google Pay oder Karte,
--    eine davon Standard. Gespeichert wird NUR, was zur Anzeige reicht:
--    Anbieter, frei gewählter Name, bei Karten die letzten vier Ziffern und
--    das Ablaufdatum, bei PayPal die maskierte Adresse („ma***@web.de“).
--    Keine Kartennummer, kein CVC (Vorbehalt 13.2 vom 24.09.2026).
--    `anbieter_token` ist für später vorgesehen (z. B. die PaymentMethod-ID
--    von Stripe) und vom Client aus weder les- noch schreibbar.
--  - spendencodes: der persönliche Code, nur als bcrypt-Hash, dazu ein
--    HMAC-Fingerabdruck für die Eindeutigkeit. Kein Client darf die Tabelle
--    lesen; alles läuft über die Funktionen unten.
--  - spende_senden(): der einzige Weg zu einer Spende. Prüft Betrag,
--    Empfänger, Zahlungsmethode und Code (fünf Fehlversuche → 15 Minuten
--    Sperre) und trägt erst dann ein. Die alte INSERT-Regel fällt weg.
--  - donations bekommt die gewählte Zahlungsmethode und einen Zahlungsstatus.
--    Solange kein Zahlungsdienst angeschlossen ist, steht dort „vorgemerkt“:
--    es ist KEIN Geld geflossen, und die Datenbank sagt das auch so.
--
--  Dieselben Regeln für Code, Karte und PayPal-Maske stehen in
--  gemeinsam/zahlung.js. Wer hier etwas ändert, ändert es dort mit.
--
--  TESTDATEN: keine. Die Prüfläufe legen Code und Methode selbst an, und nur
--  in den Testkonten (test:zahlung).
-- ===========================================================================

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------- Hilfen ------

-- Wie codeNormal() in gemeinsam/zahlung.js: ohne Leerzeichen und
-- Bindestriche, in Großbuchstaben. Nur ASCII — Umlaute lässt
-- spendencode_gueltig gar nicht erst zu, sonst rechneten JS und Postgres
-- bei „ß“ verschieden.
create or replace function public.spendencode_normal(eingabe text)
returns text
language sql
immutable
set search_path = public
as $$
  select upper(regexp_replace(coalesce(eingabe, ''), '[[:space:]-]', '', 'g'));
$$;

-- Wie codePruefe(): sechs bis sechzehn Zeichen, A–Z und 0–9.
create or replace function public.spendencode_gueltig(eingabe text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select regexp_replace(coalesce(eingabe, ''), '[[:space:]-]', '', 'g') ~ '^[A-Za-z0-9]{6,16}$';
$$;

revoke all on function public.spendencode_normal(text)  from public, anon, authenticated;
revoke all on function public.spendencode_gueltig(text) from public, anon, authenticated;

-- Der geheime Zusatz für den Fingerabdruck. Eine Zeile, von niemandem
-- außer den Funktionen hier lesbar.
create table if not exists public.spendencode_pfeffer (
  id   integer primary key default 1 check (id = 1),
  wert bytea not null default extensions.gen_random_bytes(32)
);
insert into public.spendencode_pfeffer (id) values (1) on conflict (id) do nothing;
alter table public.spendencode_pfeffer enable row level security;
revoke all on table public.spendencode_pfeffer from public, anon, authenticated;

/*
 * Warum ein Fingerabdruck neben dem Hash?
 *
 * Henrik will den Code eindeutig. bcrypt salzt jeden Hash anders — zwei
 * gleiche Codes haben verschiedene Hashes, ein Eindeutigkeits-Index greift
 * nicht. Der HMAC mit geheimem Pfeffer ist für denselben Code immer gleich
 * und lässt sich trotzdem nicht ohne den Pfeffer zurückrechnen.
 */
create or replace function public.spendencode_fingerabdruck(eingabe text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select encode(
    extensions.hmac(convert_to(public.spendencode_normal(eingabe), 'UTF8'),
                    (select wert from public.spendencode_pfeffer where id = 1),
                    'sha256'),
    'hex');
$$;
revoke all on function public.spendencode_fingerabdruck(text) from public, anon, authenticated;

-- -------------------------------------------------------- Zahlungsmethoden --

create table if not exists public.zahlungsmethoden (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  anbieter        text not null check (anbieter in ('paypal', 'apple_pay', 'google_pay', 'karte')),
  -- Frei gewählt, z. B. „Sparkasse privat“. Fünf Ziffern am Stück sind
  -- verboten, damit hier keine Kartennummer landet (anzeigenamePruefe).
  anzeigename     text not null default ''
                  check (char_length(anzeigename) <= 40
                         and regexp_replace(anzeigename, '[[:space:]-]', '', 'g') !~ '[0-9]{5,}'),
  letzte4         text check (letzte4 ~ '^[0-9]{4}$'),
  ablauf_monat    smallint check (ablauf_monat between 1 and 12),
  ablauf_jahr     smallint check (ablauf_jahr between 2020 and 2100),
  -- Wie paypalMaskieren(): zwei Zeichen, drei Sternchen, Domain.
  paypal_maskiert text check (paypal_maskiert ~ '^[^@[:space:]*]{1,2}\*\*\*@[^@[:space:]]+\.[^@[:space:]]+$'),
  -- Für später: die Kennung beim Zahlungsdienst (z. B. Stripe pm_…).
  -- Schreibt nur der Server mit der Service-Rolle.
  anbieter_token  text,
  standard        boolean not null default false,
  created_at      timestamptz not null default now(),
  -- Was zu welcher Art gehört — und was nicht.
  constraint zahlungsmethode_karte check (
    (anbieter = 'karte'  and letzte4 is not null and ablauf_monat is not null and ablauf_jahr is not null)
    or (anbieter <> 'karte' and letzte4 is null and ablauf_monat is null and ablauf_jahr is null)
  ),
  constraint zahlungsmethode_paypal check (
    (anbieter = 'paypal' and paypal_maskiert is not null)
    or (anbieter <> 'paypal' and paypal_maskiert is null)
  )
);

create index if not exists zahlungsmethoden_user_idx on public.zahlungsmethoden (user_id, created_at);
-- Höchstens eine Standardmethode je Nutzer.
create unique index if not exists zahlungsmethoden_ein_standard
  on public.zahlungsmethoden (user_id) where standard;

alter table public.zahlungsmethoden enable row level security;

drop policy if exists "Eigene Zahlungsmethoden lesen" on public.zahlungsmethoden;
create policy "Eigene Zahlungsmethoden lesen" on public.zahlungsmethoden
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Eigene Zahlungsmethode anlegen" on public.zahlungsmethoden;
create policy "Eigene Zahlungsmethode anlegen" on public.zahlungsmethoden
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Eigene Zahlungsmethode ändern" on public.zahlungsmethoden;
create policy "Eigene Zahlungsmethode ändern" on public.zahlungsmethoden
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Eigene Zahlungsmethode löschen" on public.zahlungsmethoden;
create policy "Eigene Zahlungsmethode löschen" on public.zahlungsmethoden
  for delete to authenticated using (user_id = auth.uid());

-- Spaltenrechte: user_id setzt der Standardwert, anbieter_token nur der
-- Server. Anbieter und Kartenangaben sind nach dem Anlegen fest — wer die
-- Karte wechselt, legt eine neue an.
revoke all on table public.zahlungsmethoden from public, anon, authenticated;
grant select (id, user_id, anbieter, anzeigename, letzte4, ablauf_monat, ablauf_jahr,
              paypal_maskiert, standard, created_at)
  on public.zahlungsmethoden to authenticated;
grant insert (anbieter, anzeigename, letzte4, ablauf_monat, ablauf_jahr, paypal_maskiert, standard)
  on public.zahlungsmethoden to authenticated;
grant update (anzeigename, standard) on public.zahlungsmethoden to authenticated;
grant delete on public.zahlungsmethoden to authenticated;

/*
 * Genau eine Standardmethode.
 *
 * - Die erste Methode eines Nutzers wird von selbst Standard.
 * - Wird eine Methode Standard, verlieren die anderen es.
 * - Die Standardmethode lässt sich nicht einfach „abwählen“ — nur, indem
 *   eine andere gewählt wird. Sonst stünde der Nutzer ohne da und wüsste es
 *   nicht.
 * - Höchstens zehn Methoden je Nutzer.
 *
 * pg_trigger_depth() > 1: das Umstellen der anderen Zeilen löst diesen
 * Auslöser selbst wieder aus; dort darf er nichts mehr tun.
 */
create or replace function public.zahlungsmethode_vorher()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if (select count(*) from public.zahlungsmethoden where user_id = new.user_id) >= 10 then
      raise exception 'Höchstens zehn Zahlungsmethoden' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.zahlungsmethoden where user_id = new.user_id) then
      new.standard := true;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.standard and not new.standard then
      new.standard := true;
    end if;
  end if;

  if new.standard then
    update public.zahlungsmethoden
       set standard = false
     where user_id = new.user_id and standard and id <> new.id;
  end if;
  return new;
end;
$$;

create or replace function public.zahlungsmethode_nachher()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  -- Die Standardmethode wurde gelöscht: die jüngste übrige übernimmt.
  if old.standard then
    update public.zahlungsmethoden
       set standard = true
     where id = (select id from public.zahlungsmethoden
                  where user_id = old.user_id
                  order by created_at desc
                  limit 1);
  end if;
  return old;
end;
$$;

revoke all on function public.zahlungsmethode_vorher()  from public, anon, authenticated;
revoke all on function public.zahlungsmethode_nachher() from public, anon, authenticated;

drop trigger if exists zahlungsmethode_vorher on public.zahlungsmethoden;
create trigger zahlungsmethode_vorher
  before insert or update of standard on public.zahlungsmethoden
  for each row execute function public.zahlungsmethode_vorher();

drop trigger if exists zahlungsmethode_nachher on public.zahlungsmethoden;
create trigger zahlungsmethode_nachher
  after delete on public.zahlungsmethoden
  for each row execute function public.zahlungsmethode_nachher();

-- ------------------------------------------------------------ Spendencode --

create table if not exists public.spendencodes (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  code_hash      text not null,
  fingerabdruck  text not null,
  geaendert_am   timestamptz not null default now()
);
create unique index if not exists spendencodes_fingerabdruck on public.spendencodes (fingerabdruck);

alter table public.spendencodes enable row level security;
-- Keine einzige Regel: kein Client liest oder schreibt hier direkt.
revoke all on table public.spendencodes from public, anon, authenticated;

-- Wer wann einen Code geprüft oder gesetzt hat — für Sperre und Bremse.
create table if not exists public.spendencode_protokoll (
  id          bigserial primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  art         text not null check (art in ('pruefen', 'setzen')),
  erfolg      boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists spendencode_protokoll_idx
  on public.spendencode_protokoll (user_id, art, created_at);
alter table public.spendencode_protokoll enable row level security;
revoke all on table public.spendencode_protokoll from public, anon, authenticated;

/*
 * Gesperrt? Fünf Fehlversuche in 15 Minuten, gezählt seit dem letzten
 * richtigen Code.
 */
create or replace function public.spendencode_gesperrt(k uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) >= 5
    from public.spendencode_protokoll p
   where p.user_id = k
     and p.art = 'pruefen'
     and not p.erfolg
     and p.created_at > now() - interval '15 minutes'
     and p.created_at > coalesce((select max(q.created_at)
                                   from public.spendencode_protokoll q
                                  where q.user_id = k and q.art = 'pruefen' and q.erfolg),
                                 '-infinity'::timestamptz);
$$;
revoke all on function public.spendencode_gesperrt(uuid) from public, anon, authenticated;

/*
 * Den Code eines Nutzers prüfen und das Ergebnis vermerken.
 * Wirft nie — ein Fehlversuch muss im Protokoll stehen bleiben.
 */
create or replace function public.spendencode_stimmt(k uuid, eingabe text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_ok   boolean;
begin
  select code_hash into v_hash from public.spendencodes where user_id = k;
  v_ok := v_hash is not null
          and v_hash = extensions.crypt(public.spendencode_normal(eingabe), v_hash);
  insert into public.spendencode_protokoll (user_id, art, erfolg) values (k, 'pruefen', v_ok);
  -- Das Protokoll wächst nicht ewig: älter als ein Tag braucht niemand.
  delete from public.spendencode_protokoll where user_id = k and created_at < now() - interval '1 day';
  return v_ok;
end;
$$;
revoke all on function public.spendencode_stimmt(uuid, text) from public, anon, authenticated;

/*
 * Hat sich der Nutzer in den letzten zehn Minuten mit Passwort angemeldet?
 *
 * Für „Code vergessen“: wer den alten Code nicht mehr weiß, bestätigt sein
 * Passwort (die Oberfläche meldet ihn dafür neu an) und darf dann einen
 * neuen setzen. Der Zeitpunkt steht im Zugangstoken unter `amr` und bleibt
 * beim Auffrischen erhalten — ein Token, das nur aufgefrischt wurde, gilt
 * also NICHT als frisch.
 */
create or replace function public.frisch_angemeldet()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select max((e ->> 'timestamp')::bigint)
       from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e
      where e ->> 'method' = 'password')
      > extract(epoch from now())::bigint - 600,
    false);
$$;
revoke all on function public.frisch_angemeldet() from public, anon, authenticated;

/*
 * Den eigenen Spendencode setzen oder ändern.
 *
 *   p_neu     der neue Code
 *   p_bisher  der bisherige — Pflicht, wenn schon einer gesetzt ist. Ohne
 *             ihn geht es nur nach frischer Anmeldung (frisch_angemeldet).
 *
 * Antwort: { ok: true } oder { ok: false, grund: '…' } — die Gründe stehen
 * in gemeinsam/zahlung.js (grundText).
 */
create or replace function public.spendencode_setzen(p_neu text, p_bisher text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ich  uuid := auth.uid();
  v_fp   text;
  v_hat  boolean;
begin
  if v_ich is null then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;

  -- Bremse: zehn Versuche in der Stunde. Sonst ließe sich über „vergeben“
  -- abklopfen, welche Codes es gibt.
  if (select count(*) from public.spendencode_protokoll
       where user_id = v_ich and art = 'setzen' and created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'grund', 'zu_viele_versuche');
  end if;
  insert into public.spendencode_protokoll (user_id, art, erfolg) values (v_ich, 'setzen', false);

  if not public.spendencode_gueltig(p_neu) then
    return jsonb_build_object('ok', false, 'grund', 'ungueltig');
  end if;

  v_hat := exists (select 1 from public.spendencodes where user_id = v_ich);
  if v_hat then
    if p_bisher is null or btrim(p_bisher) = '' then
      if not public.frisch_angemeldet() then
        return jsonb_build_object('ok', false, 'grund', 'neu_anmelden');
      end if;
    else
      if public.spendencode_gesperrt(v_ich) then
        return jsonb_build_object('ok', false, 'grund', 'gesperrt');
      end if;
      if not public.spendencode_stimmt(v_ich, p_bisher) then
        return jsonb_build_object('ok', false, 'grund', 'bisher_falsch');
      end if;
    end if;
  end if;

  v_fp := public.spendencode_fingerabdruck(p_neu);
  if exists (select 1 from public.spendencodes where fingerabdruck = v_fp and user_id <> v_ich) then
    return jsonb_build_object('ok', false, 'grund', 'vergeben');
  end if;

  insert into public.spendencodes (user_id, code_hash, fingerabdruck, geaendert_am)
  values (v_ich,
          extensions.crypt(public.spendencode_normal(p_neu), extensions.gen_salt('bf', 8)),
          v_fp,
          now())
  on conflict (user_id) do update
     set code_hash = excluded.code_hash,
         fingerabdruck = excluded.fingerabdruck,
         geaendert_am = now();

  update public.spendencode_protokoll
     set erfolg = true
   where id = (select max(id) from public.spendencode_protokoll where user_id = v_ich and art = 'setzen');

  return jsonb_build_object('ok', true);
exception
  -- Zwei gleichzeitige Anfragen mit demselben Code: der Index entscheidet.
  when unique_violation then
    return jsonb_build_object('ok', false, 'grund', 'vergeben');
end;
$$;

/*
 * Den eigenen Code entfernen — mit dem bisherigen Code oder nach frischer
 * Anmeldung. Danach fragt die nächste Spende wieder nach einem neuen.
 */
create or replace function public.spendencode_entfernen(p_bisher text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ich uuid := auth.uid();
begin
  if v_ich is null then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  if not exists (select 1 from public.spendencodes where user_id = v_ich) then
    return jsonb_build_object('ok', true);
  end if;
  if p_bisher is null or btrim(p_bisher) = '' then
    if not public.frisch_angemeldet() then
      return jsonb_build_object('ok', false, 'grund', 'neu_anmelden');
    end if;
  else
    if public.spendencode_gesperrt(v_ich) then
      return jsonb_build_object('ok', false, 'grund', 'gesperrt');
    end if;
    if not public.spendencode_stimmt(v_ich, p_bisher) then
      return jsonb_build_object('ok', false, 'grund', 'bisher_falsch');
    end if;
  end if;
  delete from public.spendencodes where user_id = v_ich;
  return jsonb_build_object('ok', true);
end;
$$;

/*
 * Was die Oberfläche vor einer Spende wissen muss — in einem Aufruf.
 * Gibt nie den Code heraus, nur ob es einen gibt.
 */
create or replace function public.spendencode_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ich uuid := auth.uid();
begin
  if v_ich is null then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  return jsonb_build_object(
    'ok', true,
    'gesetzt', exists (select 1 from public.spendencodes where user_id = v_ich),
    'geaendert_am', (select geaendert_am from public.spendencodes where user_id = v_ich),
    'gesperrt', public.spendencode_gesperrt(v_ich),
    'methoden', (select count(*) from public.zahlungsmethoden where user_id = v_ich),
    'standard', (select id from public.zahlungsmethoden where user_id = v_ich and standard limit 1)
  );
end;
$$;

-- ---------------------------------------------------------------- Spenden --

alter table public.donations
  add column if not exists zahlungsmethode_id uuid references public.zahlungsmethoden (id) on delete set null;
alter table public.donations
  add column if not exists zahlungsstatus text not null default 'vorgemerkt';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'donations_zahlungsstatus_check') then
    alter table public.donations
      add constraint donations_zahlungsstatus_check
      check (zahlungsstatus in ('vorgemerkt', 'bezahlt', 'fehlgeschlagen'));
  end if;
end;
$$;

-- Der direkte Weg ist zu. Eine Spende entsteht nur noch über spende_senden().
drop policy if exists "Spende senden" on public.donations;
revoke insert, update, delete on table public.donations from anon, authenticated;

/*
 * Eine Spende absenden — der einzige Weg.
 *
 * Reihenfolge der Prüfungen: erst was ohne Code feststeht (Betrag,
 * Empfänger, Zahlungsmethode), dann der Code. So verbraucht ein Tippfehler
 * beim Betrag keinen der fünf Versuche.
 *
 * Antwort: { ok: true, id, created_at, zahlungsstatus } oder
 *          { ok: false, grund, verbleibend? }
 */
create or replace function public.spende_senden(
  p_empfaenger  uuid,
  p_betrag_cent integer,
  p_code        text,
  p_methode     uuid default null,
  p_post        uuid default null,
  p_nachricht   text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ich     uuid := auth.uid();
  v_methode public.zahlungsmethoden%rowtype;
  v_zeile   public.donations%rowtype;
  v_fehl    integer;
begin
  if v_ich is null then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  if p_empfaenger is null or p_empfaenger = v_ich then
    return jsonb_build_object('ok', false, 'grund', 'selbst');
  end if;
  -- Dieselben Grenzen wie MIN_CENT/MAX_CENT in gemeinsam/zahlung.js.
  if p_betrag_cent is null or p_betrag_cent < 50 or p_betrag_cent > 100000 then
    return jsonb_build_object('ok', false, 'grund', 'betrag');
  end if;
  if not exists (select 1 from public.profiles where id = p_empfaenger) then
    return jsonb_build_object('ok', false, 'grund', 'empfaenger');
  end if;

  if p_methode is null then
    select * into v_methode from public.zahlungsmethoden where user_id = v_ich and standard limit 1;
    if not found then
      return jsonb_build_object('ok', false, 'grund', 'keine_zahlungsmethode');
    end if;
  else
    select * into v_methode from public.zahlungsmethoden where id = p_methode and user_id = v_ich;
    if not found then
      return jsonb_build_object('ok', false, 'grund', 'methode_unbekannt');
    end if;
  end if;
  if v_methode.anbieter = 'karte'
     and (v_methode.ablauf_jahr < extract(year from now())
          or (v_methode.ablauf_jahr = extract(year from now())
              and v_methode.ablauf_monat < extract(month from now()))) then
    return jsonb_build_object('ok', false, 'grund', 'methode_abgelaufen');
  end if;

  if not exists (select 1 from public.spendencodes where user_id = v_ich) then
    return jsonb_build_object('ok', false, 'grund', 'kein_code');
  end if;
  if public.spendencode_gesperrt(v_ich) then
    return jsonb_build_object('ok', false, 'grund', 'gesperrt');
  end if;
  if not public.spendencode_stimmt(v_ich, p_code) then
    select count(*) into v_fehl
      from public.spendencode_protokoll p
     where p.user_id = v_ich and p.art = 'pruefen' and not p.erfolg
       and p.created_at > now() - interval '15 minutes'
       and p.created_at > coalesce((select max(q.created_at) from public.spendencode_protokoll q
                                     where q.user_id = v_ich and q.art = 'pruefen' and q.erfolg),
                                    '-infinity'::timestamptz);
    return jsonb_build_object('ok', false, 'grund',
                              case when v_fehl >= 5 then 'gesperrt' else 'falscher_code' end,
                              'verbleibend', greatest(0, 5 - v_fehl));
  end if;

  insert into public.donations (post_id, empfaenger_id, sender_id, betrag_cent, nachricht,
                                zahlungsmethode_id, zahlungsstatus)
  values (p_post, p_empfaenger, v_ich, p_betrag_cent, left(coalesce(p_nachricht, ''), 500),
          v_methode.id, 'vorgemerkt')
  returning * into v_zeile;

  return jsonb_build_object('ok', true, 'id', v_zeile.id, 'created_at', v_zeile.created_at,
                            'zahlungsstatus', v_zeile.zahlungsstatus);
end;
$$;

-- --------------------------------------------------------------- Rechte ----

-- Postgres gibt EXECUTE an neuen Funktionen automatisch an PUBLIC
-- (test:rechte). Nur angemeldete Nutzer, und nur diese vier.
revoke all on function public.spendencode_setzen(text, text)                              from public, anon;
revoke all on function public.spendencode_entfernen(text)                                 from public, anon;
revoke all on function public.spendencode_status()                                        from public, anon;
revoke all on function public.spende_senden(uuid, integer, text, uuid, uuid, text)        from public, anon;
grant execute on function public.spendencode_setzen(text, text)                           to authenticated;
grant execute on function public.spendencode_entfernen(text)                              to authenticated;
grant execute on function public.spendencode_status()                                     to authenticated;
grant execute on function public.spende_senden(uuid, integer, text, uuid, uuid, text)     to authenticated;

-- PostgREST soll die neuen Tabellen und Funktionen sofort kennen.
notify pgrst, 'reload schema';
