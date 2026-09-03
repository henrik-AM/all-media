-- ===========================================================================
--  Die Sichtbarkeit war eine Einstellung ohne Wirkung
-- ===========================================================================
--
--  Seit dem 01.09.2026 gibt es zehn Sichtbarkeitsbereiche in vier Stufen,
--  jeder mit Ausnahmeliste, jeder gespeichert in `visibility_settings`. Es
--  gibt sogar die Funktion, die sie auswertet:
--
--      public.sichtbar_fuer(eigner, feld, betrachter) -> boolean
--
--  Sie wird an keiner einzigen Stelle aufgerufen. Nicht im Servercode, nicht
--  in der App, nicht in einer Regel.
--
--  Das heißt: „Story-Sichtbarkeit → Niemand" ließ sich einstellen, wurde
--  gespeichert, in beiden Oberflächen richtig angezeigt — und jeder sah die
--  Story trotzdem. Dieselbe Sorte Fehler wie die erfundenen Zahlen vom
--  02.09.2026, nur mit Folgen: hier verlässt sich jemand darauf.
--
--  WARUM ALS REGEL UND NICHT IM CODE
--
--  Eine Prüfung im Servercode schützt die Website. Die App schreibt direkt in
--  die Datenbank und käme daran vorbei — und wer die Adresse der Datenbank
--  kennt, ohnehin. Eine Sichtbarkeit, die sich mit einem eigenen Aufruf
--  umgehen lässt, ist keine. Also gehört sie in die Row Level Security, wo
--  App, Website und jeder dritte Weg gleich behandelt werden.
--
--  WELCHE VIER
--
--  Vier Bereiche lassen sich sauber als Regel ausdrücken und decken das ab,
--  was wirklich schützt:
--
--    story       — wer meine Story sehen darf
--    standort    — wer meine Nadel auf der Karte sieht
--    dm          — wer mir schreiben darf
--    kommentare  — wer unter meinen Beiträgen kommentieren darf
--
--  Die übrigen (Likes, Repost, Download, Push-to-Talk, Onlinestatus,
--  Markierung) sind Anzeigefragen oder betreffen einzelne Spalten. Sie
--  bleiben vorerst ohne Regel — das ist bewusst und steht so in der
--  Projektnotiz, damit niemand sie für erledigt hält.
--
--  Einspielen:
--    node tools/sql-einspielen.mjs SUPABASE_SCHEMA_19_sichtbarkeit_wirkt.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  Vorbemerkung: sichtbar_fuer() muss `security definer` bleiben
--
--  Die Funktion liest `visibility_settings` und `visibility_exceptions` —
--  beides Tabellen, die nur der Eigentümer lesen darf. Als Regel für einen
--  Betrachter aufgerufen, käme sie ohne erhöhte Rechte an nichts heran und
--  gäbe immer `true` zurück. Das ist in Schema 11 schon richtig gesetzt;
--  hier steht es nur, damit es beim nächsten Anfassen nicht verloren geht.
-- ---------------------------------------------------------------------------


-- ------------------------------------------------------------------ Storys --
--
--  Bisher: `expires_at > now()` — jede laufende Story für jeden.
--  Jetzt zusätzlich die Sichtbarkeit ihres Urhebers.

drop policy if exists "Aktuelle Storys lesen" on public.stories;
create policy "Aktuelle Storys lesen" on public.stories
  for select to authenticated
  using (
    expires_at > now()
    and public.sichtbar_fuer(user_id, 'story', auth.uid())
  );


-- --------------------------------------------------------------- Kartenpins --
--
--  Bisher: `using (true)` — jede Nadel für jeden.
--
--  Die eigene Nadel bleibt sichtbar, auch wenn die Stufe „Niemand" ist:
--  sichtbar_fuer() gibt für `eigner = betrachter` immer true. Sonst sähe man
--  sich selbst nicht mehr auf der Karte und hielte das für einen Fehler.

drop policy if exists "Pins lesen" on public.friend_pins;
create policy "Pins lesen" on public.friend_pins
  for select to authenticated
  using (public.sichtbar_fuer(user_id, 'standort', auth.uid()));


-- ------------------------------------------------------------ Kommentare --
--
--  Gelesen werden dürfen Kommentare weiterhin von allen — sie stehen unter
--  einem Beitrag, der ohnehin sichtbar ist. Geschrieben nur, wenn der
--  Beitragsinhaber es erlaubt.
--
--  `for all` in der alten Regel deckte insert, update und delete zugleich ab.
--  Das wird hier getrennt: die Erlaubnis gilt fürs Schreiben, das Ändern und
--  Löschen des eigenen Kommentars bleibt davon unberührt. Sonst könnte ein
--  nachträglich gesperrter Mensch seinen eigenen Kommentar nicht mehr
--  zurücknehmen — das wäre das Gegenteil von Schutz.

drop policy if exists "Eigenen Kommentar verwalten" on public.comments;

/*
 * Die Prüfung steht in einer eigenen Funktion mit `security definer`, und
 * das ist der springende Punkt.
 *
 * Der erste Entwurf hatte die Unterabfrage direkt in der Regel:
 *
 *     public.sichtbar_fuer(
 *       (select b.user_id from public.posts b where b.id = comments.post_id),
 *       'kommentare', auth.uid())
 *
 * Sie lief mit den Rechten des Kommentierenden. Darf der den Beitrag nicht
 * lesen, kommt aus der Unterabfrage NULL — und `sichtbar_fuer(NULL, …)`
 * antwortet `true`, weil ein fehlender Eintrag als „alle" gilt. Die Regel
 * erlaubte damit genau in dem Fall, in dem sie schützen sollte.
 *
 * Die Funktion hier liest den Eigentümer mit erhöhten Rechten und lehnt ab,
 * wenn sie ihn nicht findet. Im Zweifel nein — bei einer Schutzregel ist das
 * die einzige vertretbare Richtung.
 */
create or replace function public.darf_kommentieren(ziel_post uuid, wer uuid)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  eigner uuid;
begin
  select b.user_id into eigner from public.posts b where b.id = ziel_post;
  if eigner is null then
    return false;
  end if;
  return public.sichtbar_fuer(eigner, 'kommentare', wer);
end;
$$;

grant execute on function public.darf_kommentieren(uuid, uuid) to authenticated;

drop policy if exists "Kommentar schreiben" on public.comments;
create policy "Kommentar schreiben" on public.comments
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and public.darf_kommentieren(post_id, auth.uid())
  );

drop policy if exists "Eigenen Kommentar aendern" on public.comments;
create policy "Eigenen Kommentar aendern" on public.comments
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Eigenen Kommentar loeschen" on public.comments;
create policy "Eigenen Kommentar loeschen" on public.comments
  for delete to authenticated
  using (auth.uid() = user_id);


-- ---------------------------------------------------------- Direktnachrichten --
--
--  „Nachrichten erlaubt von" gilt für Zweiergespräche, nicht für Gruppen: in
--  einer Gruppe, der man beigetreten ist, hat man dem Mitlesen und Mitreden
--  zugestimmt. Sonst könnte ein einzelnes Mitglied die ganze Gruppe
--  stilllegen.
--
--  Geprüft wird gegen die andere Person im Chat. Gibt es sie nicht (ein Chat
--  mit sich selbst, ein Rest aus einem Austritt), bleibt es beim Alten.

create or replace function public.darf_schreiben(ziel_chat uuid, absender uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select case
    -- Gruppen und Kanäle: keine Einzelfallprüfung.
    when (select coalesce(c.is_group, false) from public.chats c where c.id = ziel_chat)
      then true
    else coalesce((
      select bool_and(public.sichtbar_fuer(m.user_id, 'dm', absender))
        from public.chat_members m
       where m.chat_id = ziel_chat and m.user_id <> absender
    ), true)
  end;
$$;

grant execute on function public.darf_schreiben(uuid, uuid) to authenticated;

drop policy if exists "Nachricht senden" on public.messages;
create policy "Nachricht senden" on public.messages
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and public.is_chat_member(chat_id)
    and public.darf_schreiben(chat_id, auth.uid())
  );


-- ---------------------------------------------------------------------------
--  Gegenprobe
--
--  Kein Prüflauf, sondern eine Notiz an die nächste Sitzung: die vier Regeln
--  hängen an `sichtbar_fuer()`. Wer die Funktion ändert, ändert damit, wer
--  Storys sieht und wer schreiben darf. Der Prüflauf dazu steht in
--  app/test/_sichtbarkeit.js.
-- ---------------------------------------------------------------------------
