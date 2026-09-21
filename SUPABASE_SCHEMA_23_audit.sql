-- ⚠️  ACHTUNG: DIESE DATEI ENTHÄLT KOPIEN VON FUNKTIONEN, DIE ANDERSWO
--     WEITERENTWICKELT WURDEN.
--
--  Betroffen ist `finde_per_nummer()` — sie steht ausserdem in
--  SUPABASE_SCHEMA_24_telefon.sql, _38_nummer_bremse.sql und
--  _39_anonyme_bremse.sql. Die Kopie hier verglich bis zum 18.09.2026 rohe
--  Ziffern statt der Vergleichsform und hat beim Wiedereinspielen die
--  richtige Fassung verdraengt: „0176…" fand „+49176…" nicht mehr.
--
--  Gemerkt hat es `test:einstellungen` („Zwei Schreibweisen finden dieselbe
--  Person"). Wer eine dieser Funktionen aendert, muss ALLE Fundstellen
--  aendern:  grep -ln "function public.finde_per_nummer" SUPABASE_SCHEMA*.sql
--
/*
 * Reparatur der Funde aus dem Security Audit vom 03./04.09.2026.
 * Bericht: 2.Gehirn.md/02 Projekte/All-Media-Security-Audit-Skill-03-09-2026.md
 *
 * Die Prüfung vom Vormittag hatte die anonymen Zugriffe geschlossen. Was
 * blieb, war Preisgabe personenbezogener Daten gegenüber jedem *angemeldeten*
 * Konto — und ein Konto bekommt man in dieser App in zehn Sekunden.
 *
 * Diese Datei ist mehrfach einspielbar.
 */

-- ===========================================================================
-- Fund 1 — Telefonnummern aller Nutzer für jeden Angemeldeten
-- ===========================================================================
--
-- `profiles` wird mit `using (true)` gelesen. Das ist gewollt: Name, Handle
-- und Farbe braucht jeder, um überhaupt eine Nachrichtenliste zu zeichnen.
-- Nicht gewollt ist, dass dieselbe Regel `phone`, `geburtsdatum` und
-- `guardian_id` mitliefert.
--
-- Eine Policy kann in Postgres keine Spalten unterscheiden. Das Werkzeug
-- dafür ist die Spaltenberechtigung: `select` wird auf Tabellenebene
-- entzogen und spaltenweise neu vergeben. Was nicht in der Liste steht, ist
-- für `authenticated` nicht lesbar — auch nicht über `select *`.
--
-- Die eigene Nummer liest man weiterhin, aber über `mein_profil()` weiter
-- unten, nicht über die Tabelle.

revoke select on public.profiles from authenticated;

-- ACHTUNG: Diese Liste muss mitwachsen. Kommt eine Spalte dazu, die die
-- Oberflaeche liest, und steht sie hier nicht, dann faellt jeder `select`
-- auf `profiles` mit „permission denied for table profiles" um — nicht nur
-- der auf die neue Spalte.
--
-- Am 18.09.2026 genau so passiert: `story_in_videos` kam mit Schema 30 dazu
-- und wurde dort einzeln berechtigt. Als diese Datei hier erneut lief, hat
-- das `revoke` darueber die Einzelberechtigung mit weggenommen, und
-- `test:storyvideos` brach komplett ab.
grant select (
  id, handle, name, bio, link, status, created_at, updated_at,
  initials, color, privat, about, highlights, playlists, demo,
  followers_basis, following_basis, beitraege_basis, spende, live,
  guardian_status,
  -- aus Schema 30/36
  story_in_videos
) on public.profiles to authenticated;

-- `update` bleibt wie es war (Policy: nur das eigene Profil), aber die
-- Spaltenliste muss stehen, sonst schlägt ein `update` auf entzogene Spalten
-- fehl. Die eigene Nummer und das eigene Geburtsdatum darf man ändern — die
-- Policy stellt sicher, dass es das eigene Profil ist.
grant update (
  handle, name, bio, link, status, updated_at, initials, color,
  privat, about, highlights, playlists, spende, live,
  phone, geburtsdatum
) on public.profiles to authenticated;

/*
 * Das eigene Profil vollständig — mit Nummer und Geburtsdatum.
 *
 * `security definer`, weil die Spaltenberechtigung oben sonst auch hier
 * greifen würde. Die erste Zeile begrenzt das Ergebnis auf den Aufrufer;
 * einen Parameter gibt es bewusst nicht, damit man nichts anderes einsetzen
 * kann als sich selbst.
 */
create or replace function public.mein_profil()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ich uuid := auth.uid();
begin
  if ich is null then
    raise exception 'nicht angemeldet';
  end if;
  return (select to_jsonb(p) from public.profiles p where p.id = ich);
end;
$$;

revoke execute on function public.mein_profil() from public, anon;
grant execute on function public.mein_profil() to authenticated;

/*
 * Die Telefonnummern der eigenen Kontakte — auf einen Schlag.
 *
 * WELCHE REGEL HIER GILT UND WARUM NICHT DIE NAHELIEGENDE
 *
 * Naheliegend wäre: beide führen sich gegenseitig als Kontakt. Diese Regel
 * ist hier falsch. `contacts` ist einseitig — eine Zeile heißt „ich habe die
 * Person hinzugefügt", und beim Prüfen am 04.09.2026 gab es im ganzen
 * Bestand null gegenseitige Paare. Die Nummern wären damit überall
 * verschwunden, und zwar still.
 *
 * Es gilt deshalb: sichtbar ist die Nummer einer Person, die MICH als
 * Kontakt mit `status = 'friend'` führt. Genau diese Zeile entsteht, wenn
 * jemand eine Anfrage annimmt (web/server/sync-handlers.js:470) — also aus
 * einer bewussten Entscheidung dieser Person. Wen ich einseitig hinzufüge,
 * gibt seine Nummer nicht heraus; das ist der Unterschied zu vorher, wo
 * jedes angemeldete Konto jede Nummer bekam.
 *
 * Ergebnis ist ein Objekt {kennung: nummer}, damit App und Website es beim
 * Start in einem Aufruf holen können, so wie bisher die Profilliste.
 */
create or replace function public.meine_kontaktnummern()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ich uuid := auth.uid();
begin
  if ich is null then
    raise exception 'nicht angemeldet';
  end if;

  return coalesce((
    select jsonb_object_agg(p.id::text, p.phone)
      from public.profiles p
     where p.phone is not null
       and exists (select 1 from public.contacts c
                    where c.user_id = p.id and c.contact_id = ich and c.status = 'friend')
  ), '{}'::jsonb);
end;
$$;

revoke execute on function public.meine_kontaktnummern() from public, anon;
grant execute on function public.meine_kontaktnummern() to authenticated;

/*
 * Jemanden über seine Telefonnummer finden.
 *
 * Vorher las die Website dafür ALLE Profile mitsamt Nummer und suchte die
 * passende im Arbeitsspeicher (web/server/sync-handlers.js:380). Das war der
 * Massenabzug in Reinform: ein Aufruf, der ganze Bestand.
 *
 * Jetzt wandert der Vergleich in die Datenbank. Wer die Nummer schon kennt,
 * findet die Person — wer sie nicht kennt, bekommt nichts. Die Nummer selbst
 * steht nicht in der Antwort; der Aufrufer hat sie ja eingegeben.
 */
create or replace function public.finde_per_nummer(nummer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ich     uuid := auth.uid();
  -- Vergleichsform, nicht rohe Ziffern. Sonst findet „0176…" die gespeicherte
  -- Nummer „+49176…" nicht — dieselbe Person, zwei Schreibweisen. Siehe
  -- SUPABASE_SCHEMA_24_telefon.sql; die Kopie hier hinkte bis zum 18.09.2026
  -- hinterher und hat beim Wiedereinspielen die richtige Fassung verdraengt.
  gesucht text := public.nummer_vergleichsform(nummer);
begin
  if ich is null then
    raise exception 'nicht angemeldet';
  end if;
  -- Zu kurze Eingaben würden auf halbe Nummern passen und die Suche in ein
  -- Rateverfahren verwandeln.
  if length(gesucht) < 6 then
    return null;
  end if;

  return (
    select to_jsonb(t)
      from (select p.id, p.name, p.handle, p.initials, p.color, p.privat, p.about
              from public.profiles p
             where p.id <> ich
               and p.phone is not null
               and public.nummer_vergleichsform(p.phone) = gesucht
             limit 1) t
  );
end;
$$;

revoke execute on function public.finde_per_nummer(text) from public, anon;
grant execute on function public.finde_per_nummer(text) to authenticated;

-- ===========================================================================
-- Fund 2 — jeder Angemeldete übersetzt jeden Benutzernamen in eine E-Mail
-- ===========================================================================
--
-- Der Vormittag hat `anon` das Recht entzogen. `authenticated` hat es
-- behalten — und weil alle Handles frei lesbar sind, reicht ein einziges
-- Konto, um den gesamten Bestand in eine E-Mail-Liste zu übersetzen.
-- Nachgewiesen am 03.09.2026: email_zu_handle('prueflauf') gab die Adresse
-- heraus.
--
-- Nach der Anmeldung stellt niemand diese Frage. Die Funktion existiert nur
-- für den Anmeldeweg "@name statt E-Mail" — und der ist ohnehin schon seit
-- dem Vormittag außer Betrieb, weil `anon` sie nicht mehr rufen darf.

revoke execute on function public.email_zu_handle(text) from public, anon, authenticated;

-- ===========================================================================
-- Fund 3 — gefälschte Mitteilungen im Namen beliebiger Personen
-- ===========================================================================
--
-- `benachrichtige()` ist `security definer`, nimmt Empfänger UND Auslöser als
-- freie Parameter und schreibt ungeprüft in `notifications`. Nirgends steht
-- `auth.uid()`.
--
-- `notifications` hat bewusst keine INSERT-Policy — der direkte Schreibweg
-- ist zu. Genau diese Sperre hob die Funktion auf: jeder Angemeldete konnte
-- jedem beliebigen Konto Mitteilungen mit frei gewähltem Absender und Text
-- ins Postfach schreiben. Ein Phishing-Kanal innerhalb der App.
--
-- Gebraucht wird sie ausschließlich aus den Triggern `on_comment`,
-- `on_post_like` und `on_contact`. Trigger laufen als Eigentümer der Funktion
-- und brauchen dafür kein Ausführungsrecht. Im Code von App und Website wird
-- sie nirgends gerufen (geprüft).

revoke execute on function public.benachrichtige(uuid, uuid, text, text, text, uuid, text)
  from public, anon, authenticated;

-- Zusätzlich ein Riegel in der Funktion selbst — falls ihr später wieder ein
-- Recht gegeben wird, ohne dass jemand an diese Stelle denkt. Der Aufruf aus
-- einem Trigger hat kein `auth.uid()`-Problem: dort ist `ausloeser` immer der
-- Handelnde, und ausserhalb einer Sitzung ist `auth.uid()` null.
create or replace function public.benachrichtige(
  empfaenger uuid, ausloeser uuid, art text, bereich text,
  ziel_typ text, ziel_id uuid, inhalt text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Wer angemeldet ist, darf nur in eigenem Namen auslösen. Trigger und
  -- Wartungsskripte laufen ohne Sitzung und sind davon nicht betroffen.
  if auth.uid() is not null and ausloeser is distinct from auth.uid() then
    raise exception 'nicht erlaubt';
  end if;

  -- Keine Benachrichtigung über die eigenen Handlungen.
  if empfaenger is null or empfaenger = ausloeser then
    return;
  end if;

  insert into public.notifications (user_id, actor_id, art, bereich, target_type, target_id, text)
  values (empfaenger, ausloeser, art, bereich, ziel_typ, ziel_id, coalesce(inhalt, ''));
end;
$$;

revoke execute on function public.benachrichtige(uuid, uuid, text, text, text, uuid, text)
  from public, anon, authenticated;

-- ===========================================================================
-- Fund 11 — zwei Views zählen an Row Level Security vorbei
-- ===========================================================================
--
-- Ohne `security_invoker` läuft eine View mit den Rechten ihres Eigentümers
-- (`postgres`) und umgeht RLS vollständig. `profile_zahlen` zählt damit auch
-- die Beiträge, die `beitrag_sichtbar()` verbirgt: die Beitragszahl eines
-- privaten Profils war für jeden sichtbar, obwohl kein Beitrag angezeigt
-- wurde.
--
-- Das ist zugleich die Erklärung für die alte Beobachtung, dass Zahl und
-- Kachelraster nicht zusammenpassten.

alter view public.profile_zahlen set (security_invoker = true);
alter view public.hashtags_mit_anzahl set (security_invoker = true);

-- ===========================================================================
-- Fund 13 — Sichtbarkeitsprüfer nehmen den Betrachter als Parameter
-- ===========================================================================
--
-- `liker_namen(beitraege, wer)` ist `security definer` und bekommt den
-- Betrachter übergeben, statt ihn aus `auth.uid()` zu nehmen. In den Policies
-- wird korrekt `auth.uid()` eingesetzt — wer die Funktion aber direkt über
-- /rest/v1/rpc/ aufruft, setzt `wer` frei und liest an den
-- Sichtbarkeitseinstellungen vorbei.
--
-- Der Parameter bleibt erhalten (App, Website und die Prüfläufe übergeben
-- ihn), wird aber gegen den tatsächlichen Aufrufer geprüft.

create or replace function public.liker_namen(beitraege uuid[], wer uuid)
returns table (post_id uuid, name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'nicht angemeldet';
  end if;
  if wer is distinct from auth.uid() then
    raise exception 'nicht erlaubt';
  end if;

  return query
    select l.post_id,
           (select p.name
              from public.post_likes x
              join public.profiles p on p.id = x.user_id
             where x.post_id = l.post_id
               and public.sichtbar_fuer(x.user_id, 'likes', wer)
             order by x.created_at desc
             limit 1)
      from public.post_likes l
     where l.post_id = any (beitraege)
     group by l.post_id;
end;
$$;

revoke execute on function public.liker_namen(uuid[], uuid) from public, anon;
grant execute on function public.liker_namen(uuid[], uuid) to authenticated;

-- ===========================================================================
-- Fund 6 — Uploads ohne Größen- und Typbegrenzung
-- ===========================================================================
--
-- Der Eimer hatte weder `file_size_limit` noch `allowed_mime_types`. Zusammen
-- mit dem öffentlichen Leserecht wog der fehlende Typfilter am schwersten:
-- eine hochgeladene .html oder .svg wird von der Storage-Domain mit ihrem
-- eigenen Content-Type ausgeliefert und ist damit gespeichertes
-- Cross-Site-Scripting.
--
-- Zur Ordnerprüfung aus dem Bericht: sie passt zu diesem Aufbau NICHT. Die
-- Ordner sind Gattungen (`messages`, `stories`, `avatars`, `posts`,
-- `insights`, `ptt`), keine Nutzerordner — siehe app/lib/supabaseStorage.ts.
-- Ein "fremder Ordner" existiert hier also nicht. Überschreiben ist ohnehin
-- ausgeschlossen (keine UPDATE-Policy, `upsert: false`), Löschen ist auf
-- `owner = auth.uid()` begrenzt.

update storage.buckets
   set file_size_limit = 52428800,   -- 50 MB
       allowed_mime_types = array[
         'image/jpeg','image/png','image/webp','image/gif','image/heic',
         'video/mp4','video/quicktime','video/webm',
         'audio/mpeg','audio/mp4','audio/webm','audio/aac','audio/wav'
       ]
 where id = 'media';

-- ===========================================================================
-- Fund 4 — jede hochgeladene Datei war ohne Anmeldung abrufbar
-- ===========================================================================
--
-- Der Eimer `media` war `public = true`, und die Lesepolicy galt zusaetzlich
-- fuer die Rolle `public` — also fuer jeden im Internet, ohne Konto. Darin
-- liegen Chat-Anhaenge, Story-Medien und Profilbilder.
--
-- Die Sichtbarkeitslogik der Datenbank schuetzt die ZEILE. Die DATEI dahinter
-- hing an einer rohen Adresse, die keine dieser Regeln kannte: wer eine
-- Story-Adresse einmal gesehen hatte, konnte sie unbegrenzt weiterreichen,
-- und das Loeschen der Story aenderte daran nichts.
--
-- Ab jetzt ist der Eimer geschlossen. App und Website tauschen jede Adresse
-- beim Ausliefern gegen eine unterschriebene mit vier Stunden Laufzeit
-- (web/server/medien.js, app/lib/medien.ts). Die Zeilen bleiben unveraendert
-- — dort stehen weiterhin die alten Adressen, umgeschrieben wird erst beim
-- Anzeigen. Das erspart eine Wanderung ueber den ganzen Bestand.

update storage.buckets set public = false where id = 'media';

drop policy if exists "Medien lesen" on storage.objects;

/*
 * Wer unterschreiben darf, muss die Datei lesen duerfen. Angemeldet zu sein
 * ist dafuer die Bedingung — vorher war es gar keine.
 *
 * WAS DAMIT NOCH NICHT ERREICHT IST, und warum das so bleibt:
 * Ein angemeldeter Nutzer koennte eine Adresse unterschreiben lassen, deren
 * Pfad er kennt, ohne die zugehoerige Zeile lesen zu duerfen. Die Pfade sind
 * flache Gattungsordner (`stories/<name>`), es gibt also nichts, woran eine
 * Policy den Eigentuemer festmachen koennte. Dagegen hilft, dass die Namen
 * seit heute einen Zufallsteil tragen (app/lib/supabaseStorage.ts) — ein Pfad
 * laesst sich nicht mehr aus Kennung und Uhrzeit erraten.
 */
create policy "Medien lesen" on storage.objects
  for select to authenticated
  using (bucket_id = 'media');
