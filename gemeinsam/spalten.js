/**
 * All Media — die Spaltenlisten, die App und Website gemeinsam benutzen.
 *
 * WARUM ES DAS GIBT
 *
 * Diese Listen standen zweimal da: in app/lib/daten.ts und in
 * web/server/supabase-api.js, Zeichen fuer Zeichen gleich. Zweimal dasselbe
 * heisst: irgendwann ist es nicht mehr dasselbe. Genau so ist es passiert —
 * `ladeChats` las in der App `is_locked, notifications_off`, auf dem Server
 * fehlten beide Spalten, und `_gleichstand.js` musste das hinterher merken.
 *
 * Jetzt gibt es die Liste einmal. Wer eine Spalte ergaenzt, ergaenzt sie fuer
 * beide Seiten und kann es gar nicht mehr nur halb tun.
 *
 * WARUM ES EINE .js-DATEI IST
 *
 * Die Website laeuft als CommonJS in Node und kennt kein TypeScript; die App
 * geht durch Metro. Eine schlichte JS-Datei mit `module.exports` verstehen
 * beide, ohne dass ein Uebersetzungsschritt dazwischen muss — und ein
 * Uebersetzungsschritt waere genau die Stelle, an der ein Deployment bei
 * Render scheitert. Die Typen liefert spalten.d.ts daneben.
 *
 * KEINE LOGIK HIER
 *
 * Nur Zeichenketten. Alles, was etwas entscheidet, bleibt auf seiner Seite —
 * damit diese Datei nie ein Grund sein kann, warum sich App und Website
 * unterschiedlich verhalten.
 */

/**
 * Ein Profil, wie es beide Seiten laden.
 *
 * `phone` steht hier bewusst NICHT (Sicherheitspruefung 04.09.2026, Fund 1):
 * die Datenbank gibt die Spalte `authenticated` gar nicht mehr heraus, eine
 * Abfrage mit `phone` darin bricht komplett ab. Die eigene Nummer kommt aus
 * `mein_profil()`, die der Kontakte aus `meine_kontaktnummern()`.
 */
const PROFIL_SPALTEN =
  'id, name, handle, initials, color, privat, about, bio, link, status,' +
  ' highlights, playlists, spende, live, followers_basis, following_basis, beitraege_basis';

/**
 * Ein Beitrag samt der drei Zaehlungen.
 *
 * Es gibt keine Tabelle „videos": ein Video ist ein Beitrag mit
 * kind = 'reel' (Hochformat) oder 'clip' (Querformat). Likes stehen in
 * post_likes, nicht in „likes".
 */
const BEITRAG_SPALTEN =
  'id, user_id, kind, format, title, description, location, music, media_url,' +
  ' thumbnail_url, duration, tags, views, zuschauer, untertitel, kapitel,' +
  ' likes_basis, shares_basis, comments_basis, created_at,' +
  ' post_likes(count), comments(count), shares(count)';

/**
 * Die Mitgliedschaft an einem Chat — pro Person, nicht pro Chat.
 *
 * Archiviert, stumm, gelesen, Favorit, gesperrt und Mitteilungen haengen an
 * chat_members, sonst wuerde Annas Archivieren auch Bobs Liste veraendern.
 * Hier war die Drift: `is_locked` und `notifications_off` fehlten dem Server.
 */
const CHATMITGLIED_SPALTEN =
  'chat_id, is_archived, is_muted, is_read, is_favorite, is_locked,' +
  ' notifications_off, geleert_bis,' +
  ' chats(id, name, is_group, bereich, created_at, updated_at, anfrage_zustand, anfrage_von)';

/**
 * Was ein Profil zurueckgibt, nachdem es geaendert wurde.
 *
 * Hier stand einmal ein blankes `.select()`, also `select *`. Seit `phone`
 * und `geburtsdatum` spaltenweise gesperrt sind, antwortet das mit
 * „permission denied for table profiles" — und damit schlug das Aendern von
 * Name und Info vollstaendig fehl. Deshalb steht die Liste ausgeschrieben da.
 */
const PROFIL_RUECKGABE_SPALTEN =
  'id, name, handle, initials, color, privat, about, bio, link, status,' +
  ' highlights, playlists, spende, live';

/**
 * Eine Nachricht, wie App und Website sie laden.
 *
 * Diese Liste stand bis zum 07.09.2026 zweimal da — in `ladeNachrichten` der
 * App und in `ladeNachrichten` des Servers, Zeichen fuer Zeichen gleich. Beim
 * Einbau der Verschluesselung kamen vier Spalten dazu; genau an so einer
 * Stelle vergisst man die zweite Seite, und die Website haette Chiffren ohne
 * Nonce geladen, also nichts.
 *
 * Die vier neuen (Schema 31): `krypto` sagt, ob der Text in `text` oder als
 * Chiffre daliegt; `chiffre` und `krypto_nonce` sind der verschlossene Text;
 * `absender_schluessel` ist der oeffentliche Geraetschluessel, mit dem das
 * Kuvert aufgeht. Ohne alle vier ist eine verschluesselte Nachricht nicht zu
 * oeffnen — sie muessen zusammen geladen werden oder gar nicht.
 */
const NACHRICHT_SPALTEN =
  'id, chat_id, sender_id, text, media_url, media_type, created_at, read_at,' +
  ' reply_to, quote_of, forwarded_from, edited_at, deleted_at, file_name, file_size,' +
  ' krypto, chiffre, krypto_nonce, absender_schluessel,' +
  // Der Eintrag zu einem Anruf (Henrik 7.9., Schema 35). Gesetztes anruf_art
  // heisst: diese Zeile ist kein Text, sondern eine Anrufnotiz.
  ' anruf_art, anruf_status, anruf_dauer,' +
  // `media_url` und `thumbnail_url` des geteilten Beitrags: Henrik 7.9. —
  // ein geteilter Videos-Beitrag soll im Chat als Bild zu sehen und zu
  // oeffnen sein, nicht als graues Kaestchen mit Titel.
  ' shared_post_id, posts(id, kind, title, description, media_url, thumbnail_url,' +
  ' profiles!posts_user_id_fkey(name)),' +
  ' place_id, places(id, name, adresse, koordinaten, x, y),' +
  // Die Story, auf die sich die Nachricht bezieht — eine Antwort darauf oder
  // ein Herz (Henrik 18.09., Schema 41). Ueber den Spaltennamen eingebettet,
  // nicht ueber den Constraint-Namen: `messages` zeigt nur ueber diese eine
  // Spalte auf `stories`, damit ist es eindeutig.
  ' reply_to_story, stories(id, user_id, media_url, media_type),' +
  ' contact_user_id, profiles!messages_contact_user_id_fkey(id, name, handle)';

module.exports = {
  PROFIL_SPALTEN,
  BEITRAG_SPALTEN,
  CHATMITGLIED_SPALTEN,
  PROFIL_RUECKGABE_SPALTEN,
  NACHRICHT_SPALTEN,
};
