-- ===========================================================================
--  Schema 36 — Storys sind Messenger-Sache, ausser man sagt beim Posten Ja
--
--  Henrik am 07.09.2026:
--
--      „Storys nicht mehr bereichsübergreifend (Messenger/Videos strikt
--       getrennt); beim Posten fragen ob übergreifend teilen; Videos ↔
--       Communities bleiben synchron."
--
--  WAS VORHER FALSCH WAR
--
--  Schema 30 hat die Trennung schon gebaut — aber nur fuer FREMDE Storys.
--  Die EIGENE Kachel haengte in beiden Leisten unbesehen vorne dran
--  (`storyleisteOrdnen` in web/server/supabase-api.js, `ordnen` in
--  app/lib/daten.ts). Wer im Messenger eine Story postete, sah sie sofort
--  auch unter Videos. Genau das hat Henrik gesehen: fuer ihn war die
--  Trennung nicht gebaut, weil die einzige Story, die er sicher zu Gesicht
--  bekam, seine eigene war.
--
--  WARUM EINE SPALTE AUF `stories` UND NICHT NUR DER SCHALTER AUF `profiles`
--
--  `profiles.story_in_videos` ist eine Dauereinstellung: sie gilt fuer alles,
--  was man je postet. Henrik will die Frage beim Posten — also eine
--  Entscheidung je Story. Beides ist noetig und beides hat eine andere
--  Aufgabe:
--
--    profiles.story_in_videos — DARF ueberhaupt geteilt werden, und was ist
--                               beim Fragen vorbelegt (Handbuch: haengt an
--                               der Sichtbarkeitsstufe „Alle")
--    stories.in_videos        — SOLL diese eine Story geteilt werden
--
--  Der Videos-Bereich filtert ab jetzt auf `stories.in_videos`. Die
--  Verbindung zur Sichtbarkeitsstufe bleibt trotzdem bestehen: Teil 2 nimmt
--  die schon geposteten Storys mit zurueck, sobald jemand die Stufe „Alle"
--  verlaesst. Ohne das haette eine Rücknahme der Sichtbarkeit nur die
--  Vorbelegung geaendert und die bereits sichtbaren Storys stehen lassen.
--
--  Einspielen:  node tools/sql-einspielen.mjs SUPABASE_SCHEMA_36_story_getrennt.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  Teil 1: die Spalte
--
--  Standard `false`. Eine Story gehoert in den Messenger; sie wandert nur
--  dorthin, wo einem auch Fremde folgen, wenn beim Posten Ja gesagt wurde.
--  Das gilt auch fuer alles, was vor dieser Datei entstanden ist — deshalb
--  ist der Standard hier zugleich der Rueckstand fuer den Altbestand.
-- ---------------------------------------------------------------------------

alter table public.stories
  add column if not exists in_videos boolean not null default false;

comment on column public.stories.in_videos is
  'Beim Posten gefragt: soll diese Story auch unter Videos stehen? '
  'Nur moeglich, solange profiles.story_in_videos gilt; der Trigger '
  'story_in_videos_zuruecknehmen() setzt sie sonst zurueck.';


-- ---------------------------------------------------------------------------
--  Teil 1b: die Spaltenberechtigung
--
--  Anders als `profiles` (Schema 23) hat `stories` keine spaltenweise
--  Vergabe — dort gilt `grant` auf der ganzen Tabelle, eine neue Spalte ist
--  also automatisch dabei. Die folgende Zeile schadet nicht und macht die
--  Absicht sichtbar, falls `stories` spaeter genauso eng gezogen wird wie
--  `profiles`.
-- ---------------------------------------------------------------------------

grant select, insert (in_videos), update (in_videos) on public.stories to authenticated;


-- ---------------------------------------------------------------------------
--  Teil 2: die Bindung an die Stufe „Alle"
--
--  Der Trigger aus Schema 30 raeumte bisher nur den Schalter am Profil ab.
--  Die schon geposteten Storys blieben stehen und damit sichtbar — die
--  Rücknahme der Sichtbarkeit wirkte also erst auf die naechste Story.
--
--  Er heisst weiterhin so wie in Schema 30; wer diese Datei liest, findet
--  dort die Begruendung fuer `security definer` und dafuer, dass die Regel
--  ueberhaupt in der Datenbank steht und nicht in einer der zwei
--  Oberflaechen.
-- ---------------------------------------------------------------------------

create or replace function public.story_in_videos_zuruecknehmen()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.bereich = 'story' and new.stufe is distinct from 'alle' then
    update public.profiles
       set story_in_videos = false
     where id = new.user_id
       and story_in_videos;

    update public.stories
       set in_videos = false
     where user_id = new.user_id
       and in_videos;
  end if;
  return new;
end;
$$;

comment on function public.story_in_videos_zuruecknehmen() is
  'Nimmt "Story auch in Videos teilen" zurueck — den Schalter am Profil und '
  'die schon geposteten Storys —, sobald die Story-Sichtbarkeit die Stufe '
  '"alle" verlaesst.';


-- ---------------------------------------------------------------------------
--  Teil 2b: der Schalter in den Einstellungen zieht die Storys mit
--
--  „Story auch in Videos teilen" ist die Dauereinstellung und zugleich die
--  Vorbelegung der Frage beim Posten. Wer sie ausschaltet, meint nicht „ab
--  der naechsten Story" — er meint, dass seine Story dort nicht mehr stehen
--  soll. Ohne diesen Trigger blieben genau die Storys sichtbar, wegen denen
--  man den Schalter umlegt.
--
--  Umgekehrt gilt das nicht: Einschalten holt keine alte Story nach vorn.
--  Bei der wurde beim Posten Nein gesagt, und diese Antwort steht.
-- ---------------------------------------------------------------------------

create or replace function public.storys_aus_videos_nehmen()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.story_in_videos and not new.story_in_videos then
    update public.stories
       set in_videos = false
     where user_id = new.id
       and in_videos;
  end if;
  return new;
end;
$$;

comment on function public.storys_aus_videos_nehmen() is
  'Nimmt die schon geposteten Storys aus dem Videos-Bereich, sobald der '
  'Schalter "Story auch in Videos teilen" ausgeschaltet wird.';

drop trigger if exists storys_folgen_dem_schalter on public.profiles;
create trigger storys_folgen_dem_schalter
  after update of story_in_videos on public.profiles
  for each row
  execute function public.storys_aus_videos_nehmen();


-- ---------------------------------------------------------------------------
--  Teil 3: aufraeumen, was vor dem Trigger schon dastand
--
--  Beim ersten Einspielen ist die Spalte ueberall `false`; hier passiert
--  also nichts. Die Anweisung steht trotzdem da, weil die Datei ein zweites
--  Mal eingespielt werden kann und dann den Bestand geradezieht — genau wie
--  die Schemata davor.
-- ---------------------------------------------------------------------------

update public.stories s
   set in_videos = false
 where s.in_videos
   and coalesce(
         (select v.stufe from public.visibility_settings v
           where v.user_id = s.user_id and v.bereich = 'story'),
         'alle'
       ) <> 'alle';
