-- ===========================================================================
--  Die Chat-Anfrage — einmal schreiben, dann muss angenommen werden
-- ===========================================================================
--
--  Aus dem Handbuch, Abschnitt „Nachrichten":
--
--    „Neue Profile zum Chatten suchen/einladen (einmalige Nachricht, danach
--     muss das angeschriebene Profil die Chateinladung annehmen)"
--
--  Die beiden Spalten dafür stehen seit Schema 11:
--  `chats.anfrage_zustand` und `chats.anfrage_von`. Benutzt hat sie nie
--  jemand — weder die App noch die Website noch eine Regel.
--
--  Was es stattdessen gab, war schlimmer als nichts: die App sperrte das
--  Eingabefeld, wenn in `contacts` eine Zeile mit status='pending' stand,
--  und setzte darunter einen Knopf „Annahme simulieren". Der schrieb
--  `contacts.status = 'friend'` — in der EIGENEN Zeile des Absenders. Der
--  Absender nahm also seine eigene Anfrage an, und danach konnte er
--  schreiben, so viel er wollte. Die angeschriebene Person kam in dem
--  ganzen Vorgang nicht vor.
--
--  Drei Dinge müssen deshalb in der Datenbank stehen und nicht in der
--  Oberfläche — die App schreibt direkt nach Supabase und käme an jeder
--  Prüfung im Servercode vorbei:
--
--    1. Wann eine Anfrage entsteht.       (Auslöser auf chat_members)
--    2. Dass es bei EINER Nachricht bleibt. (Regel auf messages)
--    3. Wer entscheiden darf.             (Auslöser auf chats)
--
--  Einspielen:
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      SUPABASE_SCHEMA_21_chatanfrage.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  1. Wann eine Anfrage entsteht
--
--  Beim Anlegen des Chats geht das nicht: da gibt es die Mitglieder noch
--  nicht, und wer angeschrieben wird, steht noch gar nicht fest. Der richtige
--  Zeitpunkt ist der Moment, in dem die zweite Person dazukommt.
--
--  Absichtlich NICHT der Oberfläche überlassen. Beide Fassungen legen Chats
--  an; setzte jede den Zustand selbst, hätten wir zwei Stellen, an denen
--  jemand ihn vergessen kann — und ein vergessener Zustand heißt „offen",
--  also keine Anfrage. Der Auslöser hier kennt keine Fassung.
--
--  Keine Anfrage entsteht, wenn:
--    * es eine Gruppe ist — eine Einladung in eine Gruppe ist etwas anderes,
--    * die angeschriebene Person den Absender schon als Kontakt führt;
--      wer jemanden in den Kontakten hat, hat ihn bereits gewollt.
-- ---------------------------------------------------------------------------

/*
 * Hilfe für den Auslöser: führt `wer` die Person `wen` als Kontakt?
 *
 * Eine eigene Funktion mit `security definer`, weil die Regeln auf `contacts`
 * nur die eigenen Zeilen zeigen — der Auslöser fragt aber nach den Zeilen der
 * angeschriebenen Person. Ohne erhöhte Rechte fände er dort grundsätzlich
 * nichts und legte auch zwischen alten Bekannten eine Anfrage an.
 */
create or replace function public.fuehrt_als_kontakt(wer uuid, wen uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.contacts
     where user_id = wer and contact_id = wen and status = 'friend'
  );
$$;

grant execute on function public.fuehrt_als_kontakt(uuid, uuid) to authenticated;

/*
 * Ausdrücklich OHNE `security definer`.
 *
 * Der Auslöser muss unterscheiden können, ob die Zeile aus App und Website
 * kommt oder aus einer Routine der Datenbank — und dafür liest er
 * `current_user`. In einer Funktion mit `security definer` stünde dort immer
 * der Eigentümer, auch bei einem Zugriff aus dem Browser: die Unterscheidung
 * wäre keine. Genau daran ist der dritte Anlauf am 03.09.2026 gescheitert.
 *
 * Was erhöhte Rechte braucht, steht deshalb in `fuehrt_als_kontakt()`
 * daneben. Alles andere — den Chat lesen, die Mitglieder zählen, den Chat
 * ändern — darf ein Mitglied ohnehin.
 */
create or replace function public.chat_anfrage_setzen()
returns trigger
language plpgsql
as $$
declare
  der_chat public.chats%rowtype;
  anzahl integer;
begin
  select * into der_chat from public.chats where id = new.chat_id;
  if der_chat.id is null or der_chat.is_group then
    return new;
  end if;

  -- Erst beim zweiten Mitglied. Beim ersten ist noch niemand angeschrieben.
  select count(*) into anzahl from public.chat_members where chat_id = new.chat_id;
  if anzahl <> 2 then
    return new;
  end if;

  -- Wer den Chat angelegt hat, schreibt an; das andere Mitglied entscheidet.
  if der_chat.created_by is null or new.user_id = der_chat.created_by then
    return new;
  end if;

  -- Führt die angeschriebene Person den Absender schon als Kontakt, ist das
  -- kein „neues Profil" mehr.
  if public.fuehrt_als_kontakt(new.user_id, der_chat.created_by) then
    return new;
  end if;

  /*
   * Der Testbestand legt keine Anfragen an.
   *
   * `zuruecksetzen()` baut für jedes Konto die Demo-Chats auf — mit dem Konto
   * als `created_by`. Ohne Ausnahme wäre jeder davon eine offene Anfrage an
   * eine Figur, die nie antwortet: der ganze Messenger stünde nach einem
   * Zurücksetzen auf „genau eine Nachricht". Beim ersten Einspielen am
   * 03.09.2026 ist genau das passiert.
   *
   * Unterschieden wird nach der **Rolle**, nicht nach dem Gegenüber. Zwei
   * Anläufe davor haben am Gegenüber angesetzt — erst `vorlage_kontakte`,
   * dann `profiles.demo` — und beide waren falsch: sie nahmen den Figuren des
   * Testbestands die Anfrage auch dann weg, wenn ein Mensch sie im Browser
   * anschreibt. Genau das ist der Fall, den der Prüflauf `_feedback` durchgeht.
   *
   * `current_user` ist bei einem Zugriff aus App oder Website `authenticated`.
   * In einer Funktion mit `security definer` — und das sind `zuruecksetzen()`
   * und der Bestandsaufbau — steht dort der Eigentümer. Die Datenbank baut
   * ihre Kulisse also ohne Anfragen auf, ein Mensch bekommt seine.
   */
  if current_user <> 'authenticated' then
    return new;
  end if;

  update public.chats
     set anfrage_zustand = 'wartet',
         anfrage_von = der_chat.created_by
   where id = new.chat_id
     and anfrage_zustand = 'offen';

  return new;
end;
$$;

drop trigger if exists chat_anfrage_setzen on public.chat_members;
create trigger chat_anfrage_setzen
  after insert on public.chat_members
  for each row execute function public.chat_anfrage_setzen();


-- ---------------------------------------------------------------------------
--  2. Dass es bei einer Nachricht bleibt
--
--  `security definer` und die ausdrückliche Ablehnung, wenn der Chat nicht
--  gefunden wird. Beides mit Absicht: am 03.09.2026 ist schon einmal eine
--  Schutzregel daran gescheitert, dass eine Unterabfrage mit den Rechten des
--  Schreibenden lief, nichts fand, NULL zurückgab — und NULL in einer
--  `with check`-Bedingung wie „erlaubt" aussieht. Bei einer Schutzregel ist
--  „im Zweifel nein" die einzige vertretbare Richtung.
-- ---------------------------------------------------------------------------

create or replace function public.anfrage_erlaubt(ziel_chat uuid, absender uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  zustand text;
  von uuid;
begin
  select anfrage_zustand, anfrage_von into zustand, von
    from public.chats where id = ziel_chat;

  if zustand is null then
    return false;              -- Chat nicht gefunden: im Zweifel nein.
  end if;

  -- Die angeschriebene Person darf immer. Ihre Antwort IST die Annahme,
  -- darum kümmert sich der Auslöser weiter unten.
  if von is null or von <> absender then
    return true;
  end if;

  if zustand = 'wartet' then
    -- Genau eine. Die zweite erst nach der Annahme.
    return not exists (
      select 1 from public.messages
       where chat_id = ziel_chat and sender_id = absender
    );
  end if;

  -- Abgelehnt heißt abgelehnt. Kein zweiter Versuch über denselben Chat.
  if zustand = 'abgelehnt' then
    return false;
  end if;

  return true;
end;
$$;

grant execute on function public.anfrage_erlaubt(uuid, uuid) to authenticated;

-- Die Regel aus Schema 19, um die Anfrage ergänzt. Sie steht hier vollständig
-- und nicht als zweite Policy daneben: zwei Insert-Policies auf derselben
-- Tabelle verodern sich, und dann hebt die eine die andere auf.
drop policy if exists "Nachricht senden" on public.messages;
create policy "Nachricht senden" on public.messages
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and public.is_chat_member(chat_id)
    and public.darf_schreiben(chat_id, auth.uid())
    and public.anfrage_erlaubt(chat_id, auth.uid())
  );


-- ---------------------------------------------------------------------------
--  3. Wer entscheiden darf
--
--  „Eigene Chats ändern" erlaubt jedem Mitglied ein UPDATE auf den Chat —
--  für Name und Bild ist das richtig. Für den Anfragezustand wäre es falsch:
--  der Absender dürfte seine eigene Anfrage annehmen, und wir wären wieder
--  beim Knopf „Annahme simulieren".
--
--  Eine Policy kann das nicht: RLS entscheidet über Zeilen, nicht über
--  Spalten. Deshalb ein Auslöser, der den Übergang selbst prüft.
--
--  Eine Antwort ist eine Annahme: wer zurückschreibt, hat die Einladung
--  angenommen. Sonst stünde die Anfrage noch offen, während die beiden schon
--  reden.
-- ---------------------------------------------------------------------------

create or replace function public.chat_anfrage_pruefen()
returns trigger
language plpgsql
as $$
begin
  if new.anfrage_zustand is not distinct from old.anfrage_zustand then
    return new;
  end if;

  /*
   * Die Datenbank selbst darf. Aus App und Website ist `current_user` immer
   * `authenticated`; steht dort der Eigentümer, kommt der Schritt aus einer
   * eigenen Funktion mit `security definer` — dem Auslöser oben, der die
   * Anfrage anlegt, oder dem weiter unten, der eine Antwort als Annahme
   * wertet. Deren Bedingungen stehen dort, nicht hier.
   */
  if current_user <> 'authenticated' then
    return new;
  end if;

  /*
   * Der eine erlaubte Weg hinein: „offen" wird zu „wartet". Den geht der
   * Auslöser oben — und ohne diese Ausnahme stünde er sich selbst im Weg,
   * denn sein UPDATE läuft durch diesen Auslöser hier hindurch.
   *
   * Auch aus der Oberfläche wäre der Schritt harmlos: `anfrage_von` muss die
   * Person sein, die den Chat angelegt hat. Eine Anfrage lässt sich damit nur
   * sich selbst auferlegen, nie jemand anderem.
   */
  if old.anfrage_zustand = 'offen' and new.anfrage_zustand = 'wartet' then
    if new.anfrage_von is distinct from old.created_by then
      raise exception 'Eine Anfrage kommt von dem, der den Chat angelegt hat';
    end if;
    return new;
  end if;

  if old.anfrage_zustand <> 'wartet' then
    raise exception 'Über diese Anfrage ist schon entschieden';
  end if;

  if new.anfrage_zustand not in ('angenommen', 'abgelehnt') then
    raise exception 'Eine wartende Anfrage wird angenommen oder abgelehnt';
  end if;

  if auth.uid() = old.anfrage_von then
    raise exception 'Über die eigene Anfrage entscheidet die angeschriebene Person';
  end if;

  -- Wer nicht im Chat ist, kommt schon an der Leseregel nicht vorbei; hier
  -- steht es trotzdem, damit die Bedingung an einer Stelle vollständig ist.
  if not public.is_chat_member(new.id) then
    raise exception 'Nur Mitglieder entscheiden über eine Anfrage';
  end if;

  new.anfrage_von := old.anfrage_von;
  return new;
end;
$$;

drop trigger if exists chat_anfrage_pruefen on public.chats;
create trigger chat_anfrage_pruefen
  before update on public.chats
  for each row execute function public.chat_anfrage_pruefen();


/*
 * Auch hier ohne `security definer`, und aus demselben Grund: der
 * Prüf-Auslöser auf `chats` sieht dann, aus welchem Zusammenhang die
 * Änderung kommt. Nötig sind erhöhte Rechte nicht — wer schreibt, ist
 * Mitglied, und Mitglieder dürfen ihren Chat ändern.
 */
create or replace function public.chat_antwort_nimmt_an()
returns trigger
language plpgsql
as $$
begin
  update public.chats
     set anfrage_zustand = 'angenommen'
   where id = new.chat_id
     and anfrage_zustand = 'wartet'
     and anfrage_von is distinct from new.sender_id;
  return new;
end;
$$;

drop trigger if exists chat_antwort_nimmt_an on public.messages;
create trigger chat_antwort_nimmt_an
  after insert on public.messages
  for each row execute function public.chat_antwort_nimmt_an();


-- ---------------------------------------------------------------------------
--  Aufräumen nach dem ersten Anlauf
--
--  Beim ersten Einspielen fehlte die Ausnahme für den Testbestand. Der
--  Auslöser hat daraufhin jeden Demo-Chat zur Anfrage gemacht. Diese Zeilen
--  nehmen das zurück — sie stehen dauerhaft hier, weil die Datei auch auf
--  einer Datenbank laufen können muss, auf der der erste Anlauf schon lief.
-- ---------------------------------------------------------------------------

-- Der Prüf-Auslöser muss dafür kurz aus dem Weg: er lässt „wartet" nur nach
-- „angenommen" oder „abgelehnt" — und hier geht es zurück auf „offen".
alter table public.chats disable trigger chat_anfrage_pruefen;

update public.chats c
   set anfrage_zustand = 'offen', anfrage_von = null
 where c.anfrage_zustand <> 'offen'
   and exists (
     select 1 from public.chat_members m
      join public.profiles p on p.id = m.user_id
     where m.chat_id = c.id and p.demo
   );

alter table public.chats enable trigger chat_anfrage_pruefen;


-- ---------------------------------------------------------------------------
--  Was diese Datei NICHT tut
--
--  „Nachrichten senden deaktivieren" aus dem Handbuch — ein Profil, dem
--  niemand schreiben kann — ist damit nicht gebaut. Das ist der
--  Sichtbarkeitsbereich `dm` aus Schema 19; er entscheidet, ob der Chat
--  überhaupt zustande kommt. Die Anfrage hier regelt den Fall danach: der
--  Chat ist erlaubt, aber die erste Nachricht bleibt eine Bitte.
--
--  Der Prüflauf dazu: app/test/_chatanfrage.js
-- ---------------------------------------------------------------------------
