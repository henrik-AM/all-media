-- ===========================================================================
--  Schema 31 — Ende-zu-Ende-Verschlüsselung für Privatchats
--
--  Punkt 11 des Handbuch-Abgleichs vom 01.09.2026, der letzte offene, und
--  der einzige, bei dem die Oberfläche dem Nutzer bisher etwas zusicherte,
--  was nicht stimmte: „Ende-zu-Ende-verschlüsselt" stand im Anrufbildschirm
--  und im Kontaktprofil, verschlüsselt wurde nichts.
--
--  WAS AB HIER GILT
--
--  Der Text einer Nachricht in einem Chat zu zweit liegt nicht mehr in
--  `messages.text`, sondern als Chiffre in `messages.chiffre`. Wer die
--  Datenbank liest — Supabase, Render, der Website-Server, ich selbst mit
--  dem Dienstschlüssel — sieht ihn nicht mehr.
--
--  WAS AUSDRÜCKLICH NICHT GILT
--
--  * Wer mit wem schreibt, wann und wie oft, steht weiterhin offen da.
--    Verschlüsselt ist der Inhalt, nicht die Beziehung.
--  * Anhänge (Bilder, Ton, Standort, Kontakt) sind es noch nicht. Sie
--    liegen im Speicher-Bucket, das ist ein eigener Weg. Die Oberfläche
--    sagt das jetzt auch so — sie behauptet nichts mehr über Anhänge.
--  * Gruppen und Community-Kanäle bleiben Klartext. Das Verfahren unten
--    trüge sie (ein Kuvert je Gerät), aber der Beitritt eines neuen
--    Mitglieds mitten im Verlauf ist eine eigene Entscheidung: bekommt es
--    die alten Nachrichten oder nicht? Solange die nicht getroffen ist,
--    wird nichts halb verschlüsselt.
--  * Keine Vorwärtssicherheit. Wer einen Gerätschlüssel bekommt, liest
--    alles, was dieses Gerät je bekommen hat.
--
--  DAS VERFAHREN
--
--  NaCl (X25519 + XSalsa20-Poly1305), gerechnet in `gemeinsam/krypto.js`,
--  das App, Website und Prüflauf gemeinsam benutzen.
--
--  Je Nachricht ein frischer Sitzungsschlüssel. Der Text wird einmal damit
--  verschlossen (`messages.chiffre`). Der Sitzungsschlüssel wandert dann
--  für jedes mitlesende Gerät einzeln in ein Kuvert (`message_keys`).
--
--  WARUM KUVERTS UND NICHT EIN SCHLÜSSELPAAR JE KONTO
--
--  Weil eine Person hier immer mindestens zwei Geräte hat: die App und die
--  Website. Das ist keine Randerscheinung, sondern der Normalfall dieses
--  Projekts — `instruction_expo_web_sync` verlangt beide auf demselben
--  Stand. Mit einem Schlüssel je Konto müsste das zweite Gerät den geheimen
--  Schlüssel des ersten bekommen, also über den Server. Damit wäre das
--  „Ende zu Ende" wieder eine Behauptung.
--
--  Mit Kuverts hat jedes Gerät sein eigenes Paar, der geheime Teil verlässt
--  es nie, und eine Nachricht bekommt so viele Kuverts wie es Geräte gibt.
--
--  WAS DAS KOSTET — EHRLICH
--
--  Ein neues Gerät kann alte Nachrichten nicht lesen. Es hat den Schlüssel
--  nicht, für den die Kuverts von damals bestimmt waren, und niemand kann
--  ihn ihm nachreichen. Das ist keine Lücke, sondern die Folge davon, dass
--  es echt ist. Die Oberfläche zeigt dort „Auf diesem Gerät nicht lesbar"
--  statt einer leeren Zeile.
--
--  Einspielen:  node tools/sql-einspielen.mjs SUPABASE_SCHEMA_31_verschluesselung.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  Teil 1: die öffentlichen Gerätschlüssel
--
--  Eine Zeile je Gerät, nicht je Konto. `geraet` ist eine Kennung, die das
--  Gerät sich beim ersten Start selbst würfelt und neben dem geheimen
--  Schlüssel ablegt; sie ist der Grund, warum ein zweiter Start desselben
--  Geräts keine zweite Zeile anlegt, sondern seine eigene wiederfindet.
--
--  `art` ist reine Anzeige („App" / „Website" im Kontaktprofil) und trägt
--  keine Entscheidung — sonst wäre sie eine Angabe, der man glauben müsste.
-- ---------------------------------------------------------------------------

create table if not exists public.krypto_schluessel (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  geraet       text not null,
  art          text not null default 'app' check (art in ('app', 'web')),
  oeffentlich  text not null,
  created_at   timestamptz not null default now(),
  unique (user_id, geraet)
);

comment on table public.krypto_schluessel is
  'Oeffentliche Geraetschluessel (X25519, base64). Der geheime Teil liegt '
  'ausschliesslich auf dem Geraet — App: expo-secure-store, Website: '
  'localStorage. Kommt er hier je an, ist die Verschluesselung wertlos.';

create index if not exists krypto_schluessel_user_idx
  on public.krypto_schluessel (user_id);

alter table public.krypto_schluessel enable row level security;


-- ---------------------------------------------------------------------------
--  Teil 1b: wer welchen Schlüssel sehen darf
--
--  Ein öffentlicher Schlüssel ist zum Herzeigen da — aber nicht jedem. Wer
--  alle Schlüssel abfragen darf, hat damit die Liste aller Konten, die die
--  App überhaupt benutzen, und nebenbei den Zeitpunkt jedes Gerätewechsels.
--  Gebraucht werden sie nur von zweien: von mir selbst und von jemandem, mit
--  dem ich einen Chat teile — denn nur der schreibt mir.
-- ---------------------------------------------------------------------------

create or replace function public.teilt_chat(anderer uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
      from public.chat_members meine
      join public.chat_members fremde on fremde.chat_id = meine.chat_id
     where meine.user_id = auth.uid()
       and fremde.user_id = anderer
  );
$$;

comment on function public.teilt_chat(uuid) is
  'Wahr, wenn der Aufrufer und das uebergebene Konto in mindestens einem '
  'gemeinsamen Chat stehen. Grundlage dafuer, wessen Geraetschluessel man '
  'lesen darf.';

revoke execute on function public.teilt_chat(uuid) from public, anon;
grant execute on function public.teilt_chat(uuid) to authenticated;

drop policy if exists "Schluessel lesen" on public.krypto_schluessel;
create policy "Schluessel lesen" on public.krypto_schluessel
  for select to authenticated
  using (user_id = auth.uid() or public.teilt_chat(user_id));

drop policy if exists "Eigenen Schluessel anlegen" on public.krypto_schluessel;
create policy "Eigenen Schluessel anlegen" on public.krypto_schluessel
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Eigenen Schluessel erneuern" on public.krypto_schluessel;
create policy "Eigenen Schluessel erneuern" on public.krypto_schluessel
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Eigenen Schluessel zuruecknehmen" on public.krypto_schluessel;
create policy "Eigenen Schluessel zuruecknehmen" on public.krypto_schluessel
  for delete to authenticated using (user_id = auth.uid());


-- ---------------------------------------------------------------------------
--  Teil 2: die Nachricht selbst
--
--  `krypto` ist die Fassung des Verfahrens und zugleich der Schalter:
--    0 — Klartext in `text`, wie bisher. Gruppen, Kanäle, Testbestand,
--        und jede Nachricht an jemanden, der noch kein Gerät angemeldet hat.
--    1 — Chiffre in `chiffre`, `text` ist leer.
--
--  Die Zahl steht an der Nachricht und nicht an der App, weil beide Sorten
--  nebeneinander in einem Chat stehen werden: die von gestern im Klartext,
--  die von heute verschlossen. Eine Umstellung „ab jetzt alles" gibt es
--  nicht, ohne Altes wegzuwerfen.
-- ---------------------------------------------------------------------------

alter table public.messages
  add column if not exists krypto      smallint not null default 0,
  add column if not exists chiffre     text,
  add column if not exists krypto_nonce text,
  add column if not exists absender_schluessel text;

comment on column public.messages.krypto is
  '0 = Klartext in text, 1 = Chiffre in chiffre (NaCl secretbox, Version 1 '
  'aus gemeinsam/krypto.js).';
comment on column public.messages.absender_schluessel is
  'Der oeffentliche Geraetschluessel des Absenders, base64. Steht an der '
  'Nachricht statt als Verweis, damit sie lesbar bleibt, wenn der Absender '
  'sein Geraet spaeter abmeldet.';


-- ---------------------------------------------------------------------------
--  Teil 2b: verschlüsselt heißt verschlüsselt
--
--  Ohne diese Regel wäre der Klartext irgendwann versehentlich doch dabei —
--  ein Aufrufer, der `text` „zur Sicherheit" mitschickt, fiele niemandem
--  auf, und die Verschlüsselung wäre eine Verzierung. Die Datenbank weist
--  das jetzt zurück, in beiden Richtungen:
--    krypto = 1  ->  text leer, chiffre und nonce da
--    krypto = 0  ->  keine Chiffre
--
--  `not valid`, damit die Regel nicht am Bestand von vorher scheitert;
--  danach wird sie geprüft und gilt für alles Neue.
-- ---------------------------------------------------------------------------

alter table public.messages drop constraint if exists messages_krypto_stimmig;
alter table public.messages
  add constraint messages_krypto_stimmig check (
    (krypto = 0 and chiffre is null and krypto_nonce is null)
    or
    (krypto = 1 and chiffre is not null and krypto_nonce is not null
     and absender_schluessel is not null and coalesce(text, '') = '')
  ) not valid;

alter table public.messages validate constraint messages_krypto_stimmig;


-- ---------------------------------------------------------------------------
--  Teil 3: die Kuverts
--
--  Je Nachricht und mitlesendem Gerät eine Zeile: der Sitzungsschlüssel der
--  Nachricht, verschlossen für genau dieses Gerät.
--
--  Löscht jemand sein Gerät aus `krypto_schluessel`, gehen seine Kuverts mit
--  (`on delete cascade`). Die Nachricht selbst bleibt — für die anderen ist
--  sie weiter lesbar.
-- ---------------------------------------------------------------------------

create table if not exists public.message_keys (
  message_id     uuid not null references public.messages (id) on delete cascade,
  schluessel_id  uuid not null references public.krypto_schluessel (id) on delete cascade,
  nonce          text not null,
  chiffre        text not null,
  primary key (message_id, schluessel_id)
);

comment on table public.message_keys is
  'Der Sitzungsschluessel einer Nachricht, je mitlesendem Geraet einmal '
  'verschlossen (NaCl box). Ohne passendes Kuvert ist die Nachricht auch '
  'fuer ein berechtigtes Konto nicht zu oeffnen — so soll es sein.';

create index if not exists message_keys_schluessel_idx
  on public.message_keys (schluessel_id);

alter table public.message_keys enable row level security;

/*
 * Lesen: nur die eigenen Kuverts.
 *
 * Die nächstliegende Regel wäre „alle Kuverts der Nachrichten meiner Chats".
 * Sie wäre bequemer und schlechter: sie gäbe mir die Kuverts, die für die
 * Geräte des Gegenübers bestimmt sind. Öffnen könnte ich sie nicht, aber
 * gebraucht werden sie auch nicht — und was nicht gebraucht wird, wird nicht
 * herausgegeben.
 */
drop policy if exists "Eigene Kuverts lesen" on public.message_keys;
create policy "Eigene Kuverts lesen" on public.message_keys
  for select to authenticated
  using (
    schluessel_id in (
      select id from public.krypto_schluessel where user_id = auth.uid()
    )
  );

/*
 * Schreiben: nur der Absender, nur zu seiner eigenen Nachricht, und nur an
 * Geräte, die in diesem Chat auch sitzen. Der letzte Teil ist der wichtige —
 * ohne ihn könnte ein Mitglied ein Kuvert an ein beliebiges fremdes Gerät
 * legen und ihm damit das Mitlesen eröffnen.
 */
drop policy if exists "Kuvert zur eigenen Nachricht legen" on public.message_keys;
create policy "Kuvert zur eigenen Nachricht legen" on public.message_keys
  for insert to authenticated
  with check (
    exists (
      select 1
        from public.messages m
        join public.krypto_schluessel k on k.id = schluessel_id
       where m.id = message_id
         and m.sender_id = auth.uid()
         and exists (
           select 1 from public.chat_members cm
            where cm.chat_id = m.chat_id and cm.user_id = k.user_id
         )
    )
  );

/*
 * Zurücknehmen einer Nachricht löscht ihre Kuverts nicht mit — die Nachricht
 * bleibt ja als Zeile stehen, damit Antworten und Zitate ihren Anker
 * behalten (Schema 11). Gelöscht wird nur mit der Nachricht selbst, über
 * `on delete cascade`. Eine eigene delete-Regel gibt es deshalb bewusst
 * nicht: nichts soll ein Kuvert einzeln entfernen können.
 */


-- ---------------------------------------------------------------------------
--  Teil 4: aufräumen beim Zurücksetzen des Testbestands
--
--  `zuruecksetzen(konto)` räumt den Prüfbestand ab. Nachrichten gehen dabei
--  weg, die Kuverts hängen daran und folgen. Was nicht folgt, sind die
--  Gerätschlüssel — die gehören zum Gerät, nicht zum Bestand, und ein
--  Prüflauf, der sie mitlöscht, nähme dem nächsten Lauf seine Grundlage.
--
--  Hier steht deshalb nur der Hinweis. Die Funktion selbst bleibt
--  unangetastet; `on delete cascade` erledigt den Rest.
-- ---------------------------------------------------------------------------
