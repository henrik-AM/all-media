-- ===========================================================================
--  All Media — Schema 11: was das Handbuch verlangt
--  Stand 01.09.2026
--
--  WARUM ES DIESE DATEI GIBT
--
--  Am 01.09.2026 wurde das Handbuch (All-Media Handbuch.pdf) Punkt für Punkt
--  gegen App und Website gehalten. Dabei kam heraus, dass ein gutes Dutzend
--  Funktionen beschrieben, aber nie gebaut war — und zwar auf beiden Seiten
--  gleichermaßen. Diese Datei legt die Tabellen an, die dafür fehlen.
--
--  Die größte Lücke war die Insight Time. Das Wort "Insight" kam im Code
--  genau zweimal vor, beide Male als Statistik-Liste in den Einstellungen.
--  Das ist aber die andere Bedeutung. Im Handbuch heißt "Insight" zweierlei:
--
--    Insight / Insight Time  — das Snapchat-Äquivalent. Ein Insight ist ein
--                              Foto oder Video, das man an ausgewählte
--                              Personen schickt. Die Insight Time zählt die
--                              Tage in Folge, an denen sich beide Seiten
--                              gegenseitig einen geschickt haben, und steht
--                              als Kamera-Emoji plus Zahl hinter dem Namen.
--    Insights                — Statistik zum eigenen Content.
--
--  Hier geht es um das Erste.
--
--  Einspielen:
--    SUPABASE_TOKEN=sbp_… node tools/sql-einspielen.mjs SUPABASE_SCHEMA_11_handbuch.sql
-- ===========================================================================


-- ========================================================== Insight Time ==
--
--  Ein Insight ist keine Nachricht und kein Beitrag, sondern eine eigene
--  Gattung. Er geht an mehrere Personen gleichzeitig, er kann nach einmaligem
--  Ansehen verschwinden, und er zählt für den Streak.
--
--  Deshalb zwei Tabellen: die Aufnahme selbst und je Empfänger eine Zeile.
--  Ohne die zweite ließe sich nicht sagen, wer ihn schon gesehen hat — und
--  genau daran hängt die Einmalansicht.

create table if not exists public.insights (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.profiles (id) on delete cascade,
  media_url   text not null,
  media_type  text not null default 'image' check (media_type in ('image', 'video')),
  -- Die Filterwahl aus der Kamera, damit ein gespeicherter Insight später
  -- noch aussieht wie beim Verschicken.
  filter      text default '',
  -- Wie lange er beim Empfänger sichtbar bleibt, in Sekunden. 0 heißt
  -- unbegrenzt ansehen.
  dauer       integer not null default 0 check (dauer >= 0 and dauer <= 60),
  -- Einmalansicht: nach dem ersten Öffnen ist Schluss.
  einmal      boolean not null default true,
  -- Selbstlöschend: die Aufnahme verschwindet nach ablauf_at ganz.
  ablauf_at   timestamptz,
  -- Bei sich selbst gespeicherte Insights bleiben in der eigenen Sammlung.
  gespeichert boolean not null default false,
  created_at  timestamptz default now()
);

create index if not exists insights_sender_idx on public.insights (sender_id, created_at desc);

create table if not exists public.insight_recipients (
  insight_id uuid not null references public.insights (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  gesehen_at timestamptz,
  primary key (insight_id, user_id)
);

create index if not exists insight_recipients_user_idx
  on public.insight_recipients (user_id, gesehen_at);

--  Die Empfängerliste: wer standardmäßig Insights bekommt.
--  Das Handbuch nennt sie ausdrücklich ("Liste an Personen die Insights
--  gesendet bekommen") und lässt sie manuell auswählen.
create table if not exists public.insight_targets (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  target_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, target_id)
);

--  Der Streak selbst.
--
--  Er ließe sich aus den Insights errechnen, aber nicht billig: dafür müsste
--  man für jedes Paar alle Sendungen beider Richtungen nach Tagen gruppieren
--  und die Kette rückwärts prüfen — bei jedem Öffnen der Chatliste. Deshalb
--  steht er als Zahl da und wird beim Senden fortgeschrieben.
--
--  Ein Paar wird immer gleich herum gespeichert: die kleinere uuid steht in
--  user_a. Sonst gäbe es die Kette zweimal und beide Seiten zählten anders.
create table if not exists public.insight_streaks (
  user_a       uuid not null references public.profiles (id) on delete cascade,
  user_b       uuid not null references public.profiles (id) on delete cascade,
  tage         integer not null default 0,
  -- Der Tag, an dem die Kette zuletzt vollständig war (beide haben gesendet).
  letzter_tag  date,
  -- Wer an letzter_tag schon gesendet hat. Beide gesetzt heißt: der Tag
  -- zählt, tage geht hoch.
  a_gesendet   date,
  b_gesendet   date,
  updated_at   timestamptz default now(),
  primary key (user_a, user_b),
  constraint insight_streaks_reihenfolge check (user_a < user_b)
);

alter table public.insights           enable row level security;
alter table public.insight_recipients enable row level security;
alter table public.insight_targets    enable row level security;
alter table public.insight_streaks    enable row level security;

-- Einen Insight sieht, wer ihn geschickt hat oder wer ihn bekommen hat.
drop policy if exists "Eigene und empfangene Insights lesen" on public.insights;
create policy "Eigene und empfangene Insights lesen" on public.insights
  for select to authenticated using (
    sender_id = auth.uid()
    or exists (
      select 1 from public.insight_recipients r
      where r.insight_id = insights.id and r.user_id = auth.uid()
    )
  );

drop policy if exists "Insight senden" on public.insights;
create policy "Insight senden" on public.insights
  for insert to authenticated with check (auth.uid() = sender_id);

drop policy if exists "Eigenen Insight aendern" on public.insights;
create policy "Eigenen Insight aendern" on public.insights
  for update to authenticated using (auth.uid() = sender_id);

drop policy if exists "Eigenen Insight loeschen" on public.insights;
create policy "Eigenen Insight loeschen" on public.insights
  for delete to authenticated using (auth.uid() = sender_id);

-- Die Empfängerzeile sieht der Absender und der Empfänger selbst.
drop policy if exists "Empfaengerzeilen lesen" on public.insight_recipients;
create policy "Empfaengerzeilen lesen" on public.insight_recipients
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.insights i
      where i.id = insight_recipients.insight_id and i.sender_id = auth.uid()
    )
  );

drop policy if exists "Empfaenger eintragen" on public.insight_recipients;
create policy "Empfaenger eintragen" on public.insight_recipients
  for insert to authenticated with check (
    exists (
      select 1 from public.insights i
      where i.id = insight_recipients.insight_id and i.sender_id = auth.uid()
    )
  );

-- "Gesehen" trägt nur der Empfänger selbst ein.
drop policy if exists "Insight als gesehen vermerken" on public.insight_recipients;
create policy "Insight als gesehen vermerken" on public.insight_recipients
  for update to authenticated using (user_id = auth.uid());

drop policy if exists "Eigene Empfaengerliste" on public.insight_targets;
create policy "Eigene Empfaengerliste" on public.insight_targets
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Den Streak sehen beide Beteiligten.
drop policy if exists "Eigene Streaks lesen" on public.insight_streaks;
create policy "Eigene Streaks lesen" on public.insight_streaks
  for select to authenticated using (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists "Eigene Streaks schreiben" on public.insight_streaks;
create policy "Eigene Streaks schreiben" on public.insight_streaks
  for insert to authenticated with check (user_a = auth.uid() or user_b = auth.uid());

drop policy if exists "Eigene Streaks fortschreiben" on public.insight_streaks;
create policy "Eigene Streaks fortschreiben" on public.insight_streaks
  for update to authenticated using (user_a = auth.uid() or user_b = auth.uid());


--  Die Kette fortschreiben.
--
--  Steckt in der Datenbank und nicht in App und Website, weil die Regel
--  sonst zweimal existieren müsste und beim ersten Zahlendreher
--  auseinanderliefe. Der Aufruf ist auf beiden Seiten derselbe:
--  rpc('insight_streak_fortschreiben', { partner: <uuid> }).
--
--  Die Regel aus dem Handbuch: gezählt werden Tage in Folge, an denen sich
--  BEIDE etwas geschickt haben. Reißt die Kette, beginnt sie von neuem.
create or replace function public.insight_streak_fortschreiben(partner uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  ich    uuid := auth.uid();
  a      uuid;
  b      uuid;
  heute  date := current_date;
  zeile  public.insight_streaks%rowtype;
  ich_ist_a boolean;
begin
  if ich is null or partner is null or ich = partner then
    return 0;
  end if;

  a := least(ich, partner);
  b := greatest(ich, partner);
  ich_ist_a := (ich = a);

  select * into zeile from public.insight_streaks
   where user_a = a and user_b = b;

  if not found then
    insert into public.insight_streaks (user_a, user_b, tage, a_gesendet, b_gesendet)
    values (a, b, 0,
            case when ich_ist_a then heute else null end,
            case when ich_ist_a then null else heute end);
    return 0;
  end if;

  -- Die Kette gilt nur weiter, wenn der letzte vollständige Tag heute oder
  -- gestern war. Alles davor heißt: ein Tag wurde ausgelassen.
  if zeile.letzter_tag is null or zeile.letzter_tag < heute - 1 then
    zeile.tage := 0;
    zeile.a_gesendet := null;
    zeile.b_gesendet := null;
  end if;

  if ich_ist_a then
    zeile.a_gesendet := heute;
  else
    zeile.b_gesendet := heute;
  end if;

  -- Beide haben heute gesendet und der Tag ist noch nicht gezählt.
  if zeile.a_gesendet = heute and zeile.b_gesendet = heute
     and (zeile.letzter_tag is null or zeile.letzter_tag < heute) then
    zeile.tage := zeile.tage + 1;
    zeile.letzter_tag := heute;
  end if;

  update public.insight_streaks
     set tage        = zeile.tage,
         letzter_tag = zeile.letzter_tag,
         a_gesendet  = zeile.a_gesendet,
         b_gesendet  = zeile.b_gesendet,
         updated_at  = now()
   where user_a = a and user_b = b;

  return zeile.tage;
end;
$$;


-- ================================================= Nachrichten-Werkzeuge ==
--
--  Antworten, Zitieren, Weiterleiten, Bearbeiten, Löschen. Alles fünf steht
--  im Handbuch, keines davon war gebaut.
--
--  Antworten und Zitieren sind absichtlich zwei Spalten und nicht eine:
--  eine Antwort zeigt nur den Bezug an, ein Zitat nimmt den Text mit in die
--  eigene Nachricht. Wer beides auf dieselbe Spalte legt, kann sie in der
--  Anzeige nicht mehr auseinanderhalten.

alter table public.messages
  add column if not exists reply_to       uuid references public.messages (id) on delete set null,
  add column if not exists quote_of       uuid references public.messages (id) on delete set null,
  add column if not exists forwarded_from uuid references public.profiles (id) on delete set null,
  add column if not exists edited_at      timestamptz,
  add column if not exists deleted_at     timestamptz;

-- Sticker sind ein eigener Typ, kein Bild: sie werden ohne Rahmen und ohne
-- Blase dargestellt. Gifs ebenso — sie laufen von allein und dürfen nicht
-- als Video mit Abspielknopf erscheinen.
alter table public.messages
  drop constraint if exists messages_media_type_check;
alter table public.messages
  add constraint messages_media_type_check
  check (media_type is null or media_type in ('image', 'video', 'audio', 'gif', 'sticker', 'file'));

-- Bei Dateien braucht die Anzeige den Namen und die Größe — ohne beides
-- steht dort nur ein graues Kästchen.
alter table public.messages
  add column if not exists file_name text,
  add column if not exists file_size bigint;

drop policy if exists "Eigene Nachricht aendern" on public.messages;
create policy "Eigene Nachricht aendern" on public.messages
  for update to authenticated using (auth.uid() = sender_id);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null,
  created_at timestamptz default now(),
  primary key (message_id, user_id)
);

alter table public.message_reactions enable row level security;

drop policy if exists "Reaktionen im eigenen Chat lesen" on public.message_reactions;
create policy "Reaktionen im eigenen Chat lesen" on public.message_reactions
  for select to authenticated using (
    exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id and public.is_chat_member(m.chat_id)
    )
  );

drop policy if exists "Eigene Reaktion setzen" on public.message_reactions;
create policy "Eigene Reaktion setzen" on public.message_reactions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ============================================================== Umfragen ==
--
--  Eine Umfrage hängt entweder an einem Beitrag, an einer Story oder an
--  einer Kanalnachricht. Statt drei fast gleicher Tabellen steht hier eine
--  mit einem Träger-Feld.

create table if not exists public.polls (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  traeger_art text not null check (traeger_art in ('post', 'story', 'channel')),
  traeger_id  uuid not null,
  frage       text not null,
  -- Mehrfachauswahl erlauben. Das Handbuch sagt dazu nichts, aber eine
  -- Umfrage ohne diese Wahl zwingt jede Frage in ein Ja/Nein-Schema.
  mehrfach    boolean not null default false,
  ende_at     timestamptz,
  created_at  timestamptz default now()
);

create index if not exists polls_traeger_idx on public.polls (traeger_art, traeger_id);

create table if not exists public.poll_options (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references public.polls (id) on delete cascade,
  text       text not null,
  position   integer not null default 0
);

create table if not exists public.poll_votes (
  poll_id    uuid not null references public.polls (id) on delete cascade,
  option_id  uuid not null references public.poll_options (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (poll_id, option_id, user_id)
);

alter table public.polls        enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes   enable row level security;

drop policy if exists "Umfragen lesen" on public.polls;
create policy "Umfragen lesen" on public.polls
  for select to authenticated using (true);

drop policy if exists "Eigene Umfrage anlegen" on public.polls;
create policy "Eigene Umfrage anlegen" on public.polls
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Eigene Umfrage loeschen" on public.polls;
create policy "Eigene Umfrage loeschen" on public.polls
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Antwortmoeglichkeiten lesen" on public.poll_options;
create policy "Antwortmoeglichkeiten lesen" on public.poll_options
  for select to authenticated using (true);

drop policy if exists "Antwortmoeglichkeiten anlegen" on public.poll_options;
create policy "Antwortmoeglichkeiten anlegen" on public.poll_options
  for insert to authenticated with check (
    exists (select 1 from public.polls p where p.id = poll_options.poll_id and p.user_id = auth.uid())
  );

drop policy if exists "Stimmen lesen" on public.poll_votes;
create policy "Stimmen lesen" on public.poll_votes
  for select to authenticated using (true);

drop policy if exists "Eigene Stimme" on public.poll_votes;
create policy "Eigene Stimme" on public.poll_votes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ===================================================== Sichtbarkeit (4x) ==
--
--  Das Handbuch kennt vier Stufen, nicht drei:
--
--      Niemand · Niemand bis auf … · Alle bis auf … · Alle
--
--  In App und Website standen überall nur drei ("Alle / Meine Kontakte /
--  Niemand"). Die beiden mittleren Stufen sind aber der eigentliche Punkt:
--  sie brauchen je eine Ausnahmeliste. "Alle bis auf meinen Chef" lässt sich
--  mit drei Stufen nicht ausdrücken.
--
--  bereich ist der Schalter, um den es geht — standort, story, repost,
--  onlinestatus, ptt. "onlinestatus" deckt auch "immer offline für …" ab:
--  Stufe 'alle_bis_auf' mit den Profilen in der Ausnahmeliste.

create table if not exists public.visibility_settings (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  bereich    text not null check (bereich in ('standort', 'story', 'repost', 'onlinestatus', 'ptt', 'likes', 'download', 'dm')),
  stufe      text not null default 'alle'
             check (stufe in ('niemand', 'niemand_bis_auf', 'alle_bis_auf', 'alle')),
  updated_at timestamptz default now(),
  primary key (user_id, bereich)
);

create table if not exists public.visibility_exceptions (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  bereich   text not null,
  target_id uuid not null references public.profiles (id) on delete cascade,
  primary key (user_id, bereich, target_id)
);

alter table public.visibility_settings   enable row level security;
alter table public.visibility_exceptions enable row level security;

-- Die eigene Einstellung darf jeder ändern. Lesen dürfen sie alle
-- Angemeldeten, denn die Gegenseite muss entscheiden können, ob sie den
-- Standort überhaupt anzeigt.
drop policy if exists "Sichtbarkeit lesen" on public.visibility_settings;
create policy "Sichtbarkeit lesen" on public.visibility_settings
  for select to authenticated using (true);

drop policy if exists "Eigene Sichtbarkeit setzen" on public.visibility_settings;
create policy "Eigene Sichtbarkeit setzen" on public.visibility_settings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Die Ausnahmeliste ist privat. Wer darauf steht, soll das nicht erfahren —
-- eine sichtbare "Alle bis auf"-Liste wäre eine Kränkung mit Datenbankzugriff.
drop policy if exists "Eigene Ausnahmen" on public.visibility_exceptions;
create policy "Eigene Ausnahmen" on public.visibility_exceptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());


--  Darf `betrachter` das sehen, was `eigner` unter `feld` eingestellt hat?
create or replace function public.sichtbar_fuer(eigner uuid, feld text, betrachter uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when eigner = betrachter then true
    else coalesce((
      select case s.stufe
        when 'alle'    then true
        when 'niemand' then false
        when 'alle_bis_auf' then not exists (
          select 1 from public.visibility_exceptions e
           where e.user_id = eigner and e.bereich = feld and e.target_id = betrachter)
        when 'niemand_bis_auf' then exists (
          select 1 from public.visibility_exceptions e
           where e.user_id = eigner and e.bereich = feld and e.target_id = betrachter)
        else true
      end
      from public.visibility_settings s
      where s.user_id = eigner and s.bereich = feld
    ), true)
  end;
$$;


-- ========================================================== Altersschutz ==
--
--  "Unter 16 → Zustimmung eines Erziehungsberechtigten, und der muss selbst
--  einen All-Media-Account besitzen." Das stand im Handbuch, in den
--  Einstellungen ließ sich ein Erziehungsberechtigter eintragen — und daran
--  hing nichts. Kein Geburtsdatum, keine Prüfung.

alter table public.profiles
  add column if not exists geburtsdatum date,
  add column if not exists guardian_id  uuid references public.profiles (id) on delete set null,
  add column if not exists guardian_status text not null default 'keiner'
    check (guardian_status in ('keiner', 'angefragt', 'bestaetigt', 'abgelehnt'));

--  Ein Konto pro Telefonnummer. Stand im Handbuch, war nie durchgesetzt.
--  Teilindex, weil das Feld bei alten Zeilen leer ist und leere Strings
--  sonst miteinander kollidieren würden.
create unique index if not exists profiles_phone_einmalig
  on public.profiles (phone) where phone is not null and phone <> '';

--  Alter in Jahren, aus dem Geburtsdatum. Steht als Funktion da, weil die
--  Antwort sich täglich ändert und eine gespeicherte Zahl irgendwann falsch
--  ist — am Geburtstag.
create or replace function public.alter_jahre(wer uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.geburtsdatum is null then null
    else extract(year from age(current_date, p.geburtsdatum))::integer
  end
  from public.profiles p where p.id = wer;
$$;

--  Darf diese Person All Media benutzen?
--  Erwachsen: ja. Unter 16: nur mit bestätigtem Erziehungsberechtigtem, der
--  selbst ein Profil hat. Ohne Geburtsdatum: ja, sonst sperrt die Prüfung
--  jedes Bestandskonto aus.
create or replace function public.freigegeben(wer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.geburtsdatum is null then true
    when extract(year from age(current_date, p.geburtsdatum)) >= 16 then true
    else p.guardian_status = 'bestaetigt'
         and exists (select 1 from public.profiles g where g.id = p.guardian_id)
  end
  from public.profiles p where p.id = wer;
$$;


-- ================================================ Wortfilter und Profilbann
--
--  "Inhalts-/Kommentarfilter, KI-geprüft. Bei Verstoß Profilbann oder
--  Video-Einschränkung." Bisher gab es weder Filter noch Bann-Verlauf.
--
--  Die Wortliste steht in der Datenbank und nicht im Code, damit sie sich
--  ändern lässt, ohne beide Fassungen neu auszurollen.

create table if not exists public.filter_words (
  wort       text primary key,
  schwere    text not null default 'mittel' check (schwere in ('mild', 'mittel', 'schwer')),
  created_at timestamptz default now()
);

alter table public.filter_words enable row level security;

drop policy if exists "Filterliste lesen" on public.filter_words;
create policy "Filterliste lesen" on public.filter_words
  for select to authenticated using (true);

--  Der Bann-Verlauf. Das Handbuch verlangt ausdrücklich "Verlauf der Banne
--  mit Grund" — ohne Begründung ist eine Sperre nicht nachvollziehbar und
--  nicht anfechtbar.
create table if not exists public.profile_bans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  bereich    text not null default 'videos' check (bereich in ('videos', 'communitys', 'messenger', 'alles')),
  grund      text not null,
  -- Was den Bann ausgelöst hat, im Klartext. Bei einem Filtertreffer das Wort.
  ausloeser  text default '',
  von_at     timestamptz not null default now(),
  bis_at     timestamptz,
  aufgehoben boolean not null default false
);

create index if not exists profile_bans_user_idx on public.profile_bans (user_id, von_at desc);

alter table public.profile_bans enable row level security;

--  Den eigenen Verlauf sieht man selbst. Fremde Sperren gehen niemanden an.
drop policy if exists "Eigene Banne lesen" on public.profile_bans;
create policy "Eigene Banne lesen" on public.profile_bans
  for select to authenticated using (user_id = auth.uid());

--  Gilt gerade eine Sperre?
create or replace function public.gesperrt(wer uuid, wo text default 'videos')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profile_bans b
     where b.user_id = wer
       and not b.aufgehoben
       and (b.bereich = wo or b.bereich = 'alles')
       and b.von_at <= now()
       and (b.bis_at is null or b.bis_at > now())
  );
$$;


-- ========================================================= Push-to-Talk ===
--
--  Im Code war das ein Ein/Aus-Schalter in den Einstellungen. Im Handbuch
--  ist es eine Funktion: eine Sprachnachricht an alle Mitglieder einer
--  Community, gedacht für Gruppenanrufe und für Momente außergewöhnlich
--  hoher Aktivität.

create table if not exists public.ptt_messages (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  channel_id   uuid references public.community_channels (id) on delete cascade,
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  audio_url    text not null,
  dauer        integer not null default 0,
  created_at   timestamptz default now()
);

create index if not exists ptt_messages_community_idx
  on public.ptt_messages (community_id, created_at desc);

alter table public.ptt_messages enable row level security;

drop policy if exists "PTT in eigenen Communitys lesen" on public.ptt_messages;
create policy "PTT in eigenen Communitys lesen" on public.ptt_messages
  for select to authenticated using (
    exists (
      select 1 from public.community_members m
      where m.community_id = ptt_messages.community_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "PTT senden" on public.ptt_messages;
create policy "PTT senden" on public.ptt_messages
  for insert to authenticated with check (
    auth.uid() = sender_id and exists (
      select 1 from public.community_members m
      where m.community_id = ptt_messages.community_id and m.user_id = auth.uid()
    )
  );


-- ========================================== Livestream: Kommentare, Spenden
--
--  Der Livestream zählte Zuschauer und Dauer. Die Live-Kommentarspalte aus
--  dem Handbuch fehlte, und Spenden auch — dabei ist der Spendencode in den
--  Einstellungen genau dafür da.

create table if not exists public.stream_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  text       text not null,
  created_at timestamptz default now()
);

create index if not exists stream_comments_post_idx
  on public.stream_comments (post_id, created_at);

create table if not exists public.donations (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid references public.posts (id) on delete set null,
  empfaenger_id uuid not null references public.profiles (id) on delete cascade,
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  -- In Cent, damit nichts gerundet wird.
  betrag_cent  integer not null check (betrag_cent > 0),
  nachricht    text default '',
  created_at   timestamptz default now()
);

alter table public.stream_comments enable row level security;
alter table public.donations       enable row level security;

drop policy if exists "Streamkommentare lesen" on public.stream_comments;
create policy "Streamkommentare lesen" on public.stream_comments
  for select to authenticated using (true);

drop policy if exists "Streamkommentar schreiben" on public.stream_comments;
create policy "Streamkommentar schreiben" on public.stream_comments
  for insert to authenticated with check (auth.uid() = user_id);

--  Eine Spende sehen nur die beiden Beteiligten.
drop policy if exists "Eigene Spenden lesen" on public.donations;
create policy "Eigene Spenden lesen" on public.donations
  for select to authenticated using (sender_id = auth.uid() or empfaenger_id = auth.uid());

drop policy if exists "Spende senden" on public.donations;
create policy "Spende senden" on public.donations
  for insert to authenticated with check (auth.uid() = sender_id);


-- ================================================ Später posten, Standort ==
--
--  "Später posten (vorab eingestellter Beitrag wird zum geplanten Zeitpunkt
--  hochgeladen)." Ein Beitrag mit publish_at in der Zukunft ist angelegt,
--  aber noch nicht sichtbar.

alter table public.posts
  add column if not exists publish_at timestamptz;

--  Standortanfrage. Die Freigabe gab es, die Anfrage nicht — dabei steht sie
--  im Handbuch ausdrücklich unter "Live-Standort Anfrage (im Privatchat)".
create table if not exists public.location_requests (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid not null references public.chats (id) on delete cascade,
  sender_id   uuid not null references public.profiles (id) on delete cascade,
  ziel_id     uuid not null references public.profiles (id) on delete cascade,
  zustand     text not null default 'offen' check (zustand in ('offen', 'angenommen', 'abgelehnt')),
  -- Bis wann der freigegebene Standort gilt. Leer heißt ohne Frist.
  bis_at      timestamptz,
  created_at  timestamptz default now()
);

alter table public.location_requests enable row level security;

drop policy if exists "Standortanfragen im eigenen Chat" on public.location_requests;
create policy "Standortanfragen im eigenen Chat" on public.location_requests
  for select to authenticated using (public.is_chat_member(chat_id));

drop policy if exists "Standort anfragen" on public.location_requests;
create policy "Standort anfragen" on public.location_requests
  for insert to authenticated
  with check (auth.uid() = sender_id and public.is_chat_member(chat_id));

--  Beantworten darf nur, wer gefragt wurde.
drop policy if exists "Standortanfrage beantworten" on public.location_requests;
create policy "Standortanfrage beantworten" on public.location_requests
  for update to authenticated using (auth.uid() = ziel_id);


-- ======================================= Chat-Anfrage unter Communitys ====
--
--  "Eine neue Person kann einmalig angeschrieben werden; danach muss sie die
--  Chateinladung annehmen." Ohne diesen Zustand ist ein Community-Chat
--  dasselbe wie ein Messenger-Chat, und die Trennung aus dem Handbuch
--  verschwindet.

alter table public.chats
  add column if not exists anfrage_zustand text not null default 'offen'
    check (anfrage_zustand in ('offen', 'wartet', 'angenommen', 'abgelehnt')),
  add column if not exists anfrage_von uuid references public.profiles (id) on delete set null;


-- ============================================================== Vorlagen ==
--
--  Eine kleine Startliste für den Wortfilter. Bewusst kurz und mild: der
--  Filter soll zeigen, dass er greift, und nicht bei der ersten Nachricht im
--  Weg stehen.
insert into public.filter_words (wort, schwere) values
  ('idiot',     'mild'),
  ('vollidiot', 'mittel'),
  ('hurensohn', 'schwer'),
  ('wichser',   'schwer'),
  ('spast',     'schwer')
on conflict (wort) do nothing;
