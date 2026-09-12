-- ===========================================================================
--  Schema 37 — Der Rechteentzug von Schema 23 gilt wieder für alles
--
--  Henrik am 13.09.2026: „Schaue mal nach, wo KI häufig Sicherheitslücken
--  hinterlässt, und versuche die zu verbessern."
--
--  WAS GEFUNDEN WURDE
--
--  Schema 23 (04.09.2026) hat jeder Funktion im Schema `public` das
--  Ausführungsrecht für `public` und `anon` entzogen und danach gezielt
--  zurückgegeben, was der Client wirklich aufruft. Das war richtig — aber es
--  gilt nur für die Funktionen, die es an dem Tag schon gab.
--
--  Jede Funktion, die Postgres neu anlegt, bekommt `EXECUTE` für PUBLIC
--  mitgeliefert. PUBLIC schließt `anon` ein, also jeden Aufrufer mit dem
--  öffentlichen Schlüssel — und der steckt im App-Bundle und im Quelltext der
--  Website. Die Standardrechte (`alter default privileges`) sollten das
--  verhindern, greifen aber nur für die Rolle, die sie gesetzt hat; die
--  Schemadateien laufen über die Management-API als eine andere.
--
--  Am 13.09.2026 nachgeprüft (pg_proc.proacl): vier Funktionen aus den
--  Schemata 29 bis 32 standen wieder auf PUBLIC.
--
--    testbestand_insight(uuid)        security definer, SCHREIBT
--    letzte_nachrichten(uuid[])       security invoker
--    story_in_videos_zuruecknehmen()  Trigger
--    storys_aus_videos_nehmen()       Trigger
--
--  NACHGEWIESEN, NICHT VERMUTET
--
--  Ohne jede Anmeldung, nur mit dem öffentlichen Schlüssel:
--
--    curl -X POST .../rest/v1/rpc/testbestand_insight \
--      -H "apikey: sb_publishable_..." -d '{"ziel":"00000000-..."}'
--    → HTTP 200  {"ok": false, "grund": "kein Beispielkontakt"}
--
--  Eine Antwort, keine Abweisung. Mit der Kennung eines echten Kontos hätte
--  derselbe Aufruf in dessen Bestand geschrieben: die Funktion ist
--  `security definer`, sie fragt also nicht, wer ruft, sondern tut es. Die
--  Kennung ist keine Hürde — sie steht in jeder Antwort der API, sobald man
--  ein einziges Konto hat.
--
--  `letzte_nachrichten` ist `security invoker`; die Regeln auf `messages`
--  haben gehalten. Die beiden Trigger-Funktionen sind über PostgREST nicht
--  aufrufbar. Gefährlich war also eine von vieren — das Recht gehört
--  trotzdem bei allen weg, denn die Frage ist nicht, ob es heute ausnutzbar
--  ist, sondern ob es morgen jemand zur Angriffsfläche macht.
--
--  WARUM DAS HIER NICHT NOCH EINMAL PASSIERT
--
--  Ein Schema, das das Recht ein zweites Mal entzieht, ist keine Lösung —
--  Schema 38 hätte dasselbe Loch. Deshalb gibt es ab heute `test/_rechte.js`:
--  der Prüflauf fragt die Datenbank, was `anon` ausführen darf, und meldet
--  jede Funktion, die nicht auf der kurzen erlaubten Liste steht.
--
--  Einspielen:  node tools/sql-einspielen.mjs SUPABASE_SCHEMA_37_rechte_nachziehen.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  TEIL A — allen entziehen
--
--  `authenticated` wird auch hier nicht angefasst. Nachgeprüft am 13.09.2026:
--  54 der 56 Funktionen haben eine ausdrückliche Gabe an `authenticated`, die
--  beiden übrigen (`benachrichtige`, `email_zu_handle`) ruft kein Client auf.
--  Auch die vier Trigger-Funktionen ohne `security definer`
--  (chat_anfrage_pruefen, chat_anfrage_setzen, chat_antwort_nimmt_an,
--  profil_vervollstaendigen) haben ihr eigenes Recht — sie laufen mit den
--  Rechten dessen, der die Zeile schreibt, und dürfen nicht mit entzogen
--  werden. Sonst schlägt jedes Anlegen eines Chats fehl.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;


-- ---------------------------------------------------------------------------
--  TEIL B — zurückgeben, was ohne Anmeldung gebraucht wird
--
--  Genau zwei. Beide beantworten beim Registrieren eine Ja/Nein-Frage, und
--  beim Registrieren ist noch niemand angemeldet:
--
--    handle_frei  — web/public/anmeldung.js:132
--    nummer_frei  — web/public/anmeldung.js:150, app/screens/LoginScreen.tsx:186
--
--  Beide geben nur „frei: true/false" heraus, nie eine Zeile aus `profiles`.
--  Dass man damit trotzdem durchprobieren kann, ob eine Telefonnummer zu
--  einem Konto gehört, bleibt bestehen — dagegen hilft keine Rechteregel,
--  sondern nur ein Captcha vor der Registrierung. Das ist notiert, aber
--  nicht Teil dieser Datei, weil es ein Konto bei einem Dritten braucht.
-- ---------------------------------------------------------------------------

grant execute on function public.handle_frei(text) to anon, authenticated;
grant execute on function public.nummer_frei(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
--  TEIL C — Kontrolle
--
--  Was hier herauskommt, ist die vollständige Liste dessen, was ein Aufrufer
--  ohne Anmeldung noch ausführen darf. Erwartet: handle_frei, nummer_frei.
--  Alles andere ist ein Fund.
-- ---------------------------------------------------------------------------

select p.proname as funktion,
       pg_get_function_identity_arguments(p.oid) as argumente,
       p.prosecdef as security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and has_function_privilege('anon', p.oid, 'execute')
 order by 1;
