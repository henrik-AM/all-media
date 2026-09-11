-- ===========================================================================
--  Schema 30 — „Story auch in Videos teilen"
--
--  Der letzte kleine Punkt aus dem Handbuch-Abgleich vom 01.09.2026. Das
--  Handbuch führt ihn nicht als eigene Einstellung, sondern als Zusatz der
--  Story-Sichtbarkeit:
--
--      Story Sichtbarkeit (allgemein nur für Kontakte) (Niemand,
--      Niemand bis auf…, Jeder bis auf…, Jeder -> Story auch in
--      Videos teilen)
--
--  Der Klammerzusatz „allgemein nur für Kontakte" ist der Kern der Sache.
--  Eine Story gehört in den Messenger und wird dort den Kontakten gezeigt.
--  Im Videos-Bereich stehen laut Handbuch die „Storys der gefolgten
--  Profile" — und dorthin kommt eine Story nur, wenn ihr Urheber die
--  Sichtbarkeit auf „Jeder" gestellt und diesen Zusatz ausdrücklich
--  angeschaltet hat.
--
--  In der App standen bisher in beiden Bereichen dieselben Storys: eine
--  einzige Liste, einmal geladen, zweimal angezeigt. Damit war der Zusatz
--  nicht bloß nicht gebaut — es gab auch nichts, worauf er hätte wirken
--  können.
--
--  WARUM EINE SPALTE AUF `profiles` UND NICHT `user_settings`
--
--  `user_settings` ist privat (Schema 16): jede Zeile gehört ihrem Konto,
--  niemand sonst liest sie. Das ist dort richtig — ob jemand die
--  Lesebestätigung abgeschaltet hat, geht keinen an. Hier ist es das
--  Gegenteil: dieser Schalter muss von *fremden* Geräten gelesen werden
--  können, denn deren Videos-Bereich entscheidet damit, ob die Story
--  erscheint. Eine private Zeile hätte den Filter unmöglich gemacht.
--
--  WARUM DER TRIGGER UND NICHT NUR DIE OBERFLÄCHE
--
--  Der Schalter ist an die Stufe „Alle" gebunden. Wer von „Alle" auf
--  „Niemand bis auf …" zurückgeht, hat seine Story eingeschränkt — der
--  Zusatz darf dann nicht stillschweigend angeschaltet bleiben und beim
--  nächsten Wechsel zurück auf „Alle" wieder greifen, ohne dass jemand
--  ihn erneut gewollt hat. Die Oberfläche kann das nicht zusichern: sie
--  ist eine von zweien (App und Website), und beide lassen sich umgehen.
--  Deshalb steht die Regel in der Datenbank.
--
--  Einspielen:  node tools/sql-einspielen.mjs SUPABASE_SCHEMA_30_story_in_videos.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  Teil 1: der Schalter
--
--  Standard `false`. Eine Story ist eine Messenger-Sache; sie wandert nur
--  auf ausdrücklichen Wunsch in einen Bereich, in dem einem auch Fremde
--  folgen.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists story_in_videos boolean not null default false;

comment on column public.profiles.story_in_videos is
  'Handbuch: "Jeder -> Story auch in Videos teilen". Nur wirksam, solange '
  'die Story-Sichtbarkeit auf der Stufe "alle" steht; der Trigger '
  'story_in_videos_zuruecknehmen() setzt die Spalte sonst zurueck.';


-- ---------------------------------------------------------------------------
--  Teil 1b: die Spaltenberechtigung
--
--  Seit Schema 23 (`SUPABASE_SCHEMA_23_audit.sql`) ist `select` auf
--  `profiles` tabellenweit entzogen und wird spaltenweise vergeben. Eine neu
--  angelegte Spalte steht in keiner der beiden Listen und ist damit für
--  `authenticated` weder lesbar noch schreibbar — der erste Prüflauf endete
--  genau so: „permission denied for table profiles".
--
--  Beides wird gebraucht:
--    select — jedes fremde Gerät liest den Schalter, sonst kann sein
--             Videos-Bereich nicht filtern. Verraten wird damit nichts, was
--             nicht ohnehin an der angezeigten Story abzulesen wäre.
--    update — man ändert ihn an seinem eigenen Profil; dass es das eigene
--             ist, stellt die Policy sicher, nicht die Berechtigung.
-- ---------------------------------------------------------------------------

grant select (story_in_videos) on public.profiles to authenticated;
grant update (story_in_videos) on public.profiles to authenticated;


-- ---------------------------------------------------------------------------
--  Teil 2: die Bindung an die Stufe „Alle"
--
--  `visibility_settings` trägt eine Zeile je Bereich und Konto. Fällt die
--  Story-Zeile unter „alle", fällt der Zusatz mit.
--
--  Der Trigger fasst ausschließlich die Zeile des betroffenen Kontos an
--  (`new.user_id`) — er ist deshalb `security definer`, ohne dabei mehr zu
--  können, als der Aufrufer ohnehin darf: seine eigene Sichtbarkeit ändern.
--  Ohne `security definer` liefe er gegen die Schreibregel auf `profiles`,
--  die nur die eigene Zeile erlaubt — was hier zwar zutrifft, aber nur
--  solange, wie die Regel unverändert bleibt.
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
  end if;
  return new;
end;
$$;

comment on function public.story_in_videos_zuruecknehmen() is
  'Nimmt "Story auch in Videos teilen" zurueck, sobald die '
  'Story-Sichtbarkeit die Stufe "alle" verlaesst.';

drop trigger if exists story_in_videos_folgt_stufe on public.visibility_settings;
create trigger story_in_videos_folgt_stufe
  after insert or update on public.visibility_settings
  for each row
  execute function public.story_in_videos_zuruecknehmen();


-- ---------------------------------------------------------------------------
--  Teil 3: aufräumen, was vor dem Trigger schon dastand
--
--  Beim ersten Einspielen ist die Spalte überall `false`, hier passiert also
--  nichts. Die Anweisung steht trotzdem da, weil die Datei ein zweites Mal
--  eingespielt werden kann und dann den Bestand geradezieht — genau wie die
--  Schemata davor.
-- ---------------------------------------------------------------------------

update public.profiles p
   set story_in_videos = false
 where p.story_in_videos
   and coalesce(
         (select v.stufe from public.visibility_settings v
           where v.user_id = p.id and v.bereich = 'story'),
         'alle'
       ) <> 'alle';
