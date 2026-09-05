-- ===========================================================================
--  „Nachrichten senden deaktivieren" — der letzte offene Punkt der Sichtbarkeit
-- ===========================================================================
--
--  Schema 19 hat den Sichtbarkeitsbereich `dm` mit einer Regel unterlegt:
--  `darf_schreiben()` hängt an der Insert-Regel auf `messages`. Wer „Niemand"
--  eingestellt hat, bekommt keine Nachricht mehr.
--
--  Was danach noch fehlte, steht als „Offen" in der Projektnotiz vom
--  03.09.2026 (All-Media-Chatanfrage): der Bereich `dm` entscheidet, ob der
--  **Chat überhaupt zustande kommt**. Bisher kam er zustande. Der Knopf
--  „Nachricht" auf dem fremden Profil legte einen Zweierchat an, trug beide
--  Mitglieder ein — und erst die Nachricht fiel durch die Regel.
--
--  Zurück blieb ein leerer Chat in der Liste **beider** Menschen. Wer
--  „Niemand darf mir schreiben" eingestellt hat, bekam also weiterhin von
--  jedem Fremden einen Eintrag in den Messenger. Nur eben ohne Text. Das ist
--  keine halbe Sperre, das ist eine umgangene.
--
--  Zwei Dinge stehen deshalb hier:
--
--    1. `darf_angeschrieben_werden(inhaber, wer)` — die Frage, die App und
--       Website **vorher** stellen können, damit der Knopf gar nicht erst
--       erscheint.
--    2. Eine Verschärfung der Insert-Regel auf `chat_members` — damit der
--       Chat auch dann nicht entsteht, wenn jemand die Oberfläche umgeht.
--
--  Erst beides zusammen trägt: die Funktion ist die Auskunft, die Regel ist
--  die Sperre. Eine Auskunft allein wäre wieder nur eine Anzeige (siehe
--  Schema 19, „Einstellung ohne Wirkung").
--
--  Einspielen:
--    node tools/sql-einspielen.mjs SUPABASE_SCHEMA_22_dm_sperre.sql
-- ===========================================================================


-- ------------------------------------------------------------ Die Auskunft --
--
--  Gebaut wie `darf_herunterladen()` aus Schema 20: eine schmale Funktion um
--  `sichtbar_fuer()` herum, damit die Oberfläche fragen kann, ohne
--  `visibility_settings` und `visibility_exceptions` selbst lesen zu müssen.
--
--  Die Ausnahmeliste ist absichtlich privat (Schema 11: „eine sichtbare
--  'Alle bis auf'-Liste wäre eine Kränkung mit Datenbankzugriff"). Deshalb
--  `security definer` und deshalb eine Funktion, die genau eine Ja/Nein-Frage
--  beantwortet — und nicht die Liste herausgibt.

create or replace function public.darf_angeschrieben_werden(inhaber uuid, wer uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.sichtbar_fuer(inhaber, 'dm', wer);
$$;

grant execute on function public.darf_angeschrieben_werden(uuid, uuid) to authenticated;


-- -------------------------------------------------------------- Die Sperre --
--
--  Ein Zweierchat entsteht dadurch, dass die zweite Person als Mitglied
--  eingetragen wird. Genau dort setzt die Prüfung an.
--
--  DREI FÄLLE BLEIBEN AUSGENOMMEN, UND JEDER AUS EINEM ANDEREN GRUND:
--
--  1. Die eigene Zeile (`wer = auth.uid()`). Sich selbst einzutragen ist ein
--     Beitritt, keine Anschrift — und es ist der erste Schritt jedes Chats.
--
--  2. Gruppen und Kanäle (`is_group`). Dasselbe Argument wie bei
--     `darf_schreiben()` in Schema 19: wer einer Gruppe beitritt, hat dem
--     Mitlesen zugestimmt. Sonst könnte ein einzelnes Mitglied verhindern,
--     dass irgendjemand sonst dazukommt.
--
--  3. Was die Datenbank selbst anlegt (`current_user <> 'authenticated'`).
--     Wortgleich zur Ausnahme im Anfrage-Auslöser aus Schema 21, und aus
--     demselben Grund: `zuruecksetzen()` baut die Demo-Chats des Testbestands
--     auf. Stünde bei einer der Figuren `dm = niemand`, bräche der Aufbau ab
--     — und zwar mit einer Meldung, die nach einem Rechtefehler aussieht.
--
--     Damit das trägt, darf `darf_mitglied_werden()` **kein**
--     `security definer` sein: dann stünde in `current_user` immer der
--     Eigentümer, und die Unterscheidung wäre keine. Genau daran ist der
--     Anfrage-Auslöser am 03.09.2026 im dritten Anlauf gescheitert.
--     Die erhöhten Rechte, die es trotzdem braucht (die Sichtbarkeit einer
--     fremden Person lesen), stecken in `sichtbar_fuer()` daneben — die ist
--     `security definer` und bleibt es.
--
--  IM ZWEIFEL NEIN
--
--  Findet die Funktion den Chat nicht, lehnt sie ab. Ein NULL aus einer
--  Unterabfrage sieht in einer `with check`-Bedingung wie „erlaubt" aus; das
--  hat am 03.09.2026 schon einmal eine Schutzregel wirkungslos gemacht
--  (Schema 19, `darf_kommentieren`).

create or replace function public.darf_mitglied_werden(ziel_chat uuid, wer uuid)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  gruppe boolean;
begin
  -- Der Testbestand und alles, was die Datenbank selbst aufbaut.
  if current_user <> 'authenticated' then
    return true;
  end if;

  -- Sich selbst einzutragen ist immer erlaubt.
  if wer = auth.uid() then
    return true;
  end if;

  select c.is_group into gruppe from public.chats c where c.id = ziel_chat;

  if gruppe is null then
    return false;              -- Chat nicht gefunden: im Zweifel nein.
  end if;

  if gruppe then
    return true;               -- Gruppe oder Kanal: keine Einzelfallprüfung.
  end if;

  return public.darf_angeschrieben_werden(wer, auth.uid());
end;
$$;

grant execute on function public.darf_mitglied_werden(uuid, uuid) to authenticated;


--  Die Regel selbst. Wortlaut aus Schema 7 (dort steht, warum es die drei
--  Alternativen braucht: beim Anlegen einer Gruppe ist der Ersteller im
--  Augenblick des Eintragens selbst noch kein Mitglied), ergänzt um die
--  Sperre.

drop policy if exists "Mitglieder hinzufuegen" on public.chat_members;
create policy "Mitglieder hinzufuegen" on public.chat_members
  for insert to authenticated
  with check (
    (
      auth.uid() = user_id
      or public.is_chat_member(chat_id)
      or exists (select 1 from public.chats c where c.id = chat_id and c.created_by = auth.uid())
    )
    and public.darf_mitglied_werden(chat_id, user_id)
  );


-- ---------------------------------------------------------------------------
--  Gegenprobe
--
--  `app/test/_dmsperre.js` — zwei Konten, ohne Oberfläche. Geprüft wird
--  ausdrücklich mit Nachzählen: nach dem abgewiesenen Versuch darf **kein**
--  Chat zwischen den beiden stehen. Ein abgelehntes INSERT unter RLS meldet
--  nicht immer einen Fehler; es schreibt nur nichts. Wer sich auf die
--  Fehlermeldung verlässt, prüft nichts.
-- ---------------------------------------------------------------------------
