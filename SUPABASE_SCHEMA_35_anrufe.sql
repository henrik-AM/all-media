-- ===========================================================================
--  SUPABASE_SCHEMA_35_anrufe.sql — ein Anruf hinterlaesst eine Spur
--  07.09.2026
-- ===========================================================================
--
--  WORUM ES GEHT
--
--  Henrik am 07.09.2026: „Anrufe sollen als Chatnachricht protokolliert werden
--  (wie WhatsApp)."
--
--  Bisher war ein Anruf ein Bildschirm, der aufging und wieder zuging. Danach
--  war nicht mehr feststellbar, dass er stattgefunden hat — nicht im Chat,
--  nicht in einer Liste, nirgends.
--
--  WARUM ES KEINE EIGENE TABELLE IST
--
--  Weil Henrik es als Chatnachricht will, und weil es eine ist: Sie steht in
--  der Reihenfolge des Gespraechs, sie zaehlt fuer die Vorschau in der
--  Chatliste, und sie folgt denselben Leserechten wie jede andere Zeile im
--  Chat. Eine zweite Tabelle haette all das noch einmal gebraucht — und die
--  Vorschau in der Chatliste (letzte_nachrichten, Schema 32) haette sie nicht
--  gesehen.
--
--  DREI SPALTEN
--
--    anruf_art     'audio' oder 'video'
--    anruf_status  'beendet' | 'verpasst' | 'abgelehnt'
--    anruf_dauer   Sekunden; bei verpasst/abgelehnt 0
--
--  Der Text der Nachricht bleibt leer. Was dort steht — „Videoanruf · 02:14" —
--  ist Sache der Anzeige und darf sich aendern; ausserdem faellt der Text bei
--  einem verschluesselten Chat ohnehin in die Chiffre (Schema 31), und ein
--  Anrufeintrag soll auch dann lesbar bleiben. Er verraet nichts, was die
--  Gegenseite nicht ohnehin weiss: dass angerufen wurde.
--
--  WER SCHREIBT
--
--  Der Anrufer, nach dem Auflegen — in der App CallScreen.tsx, auf der Website
--  openCall(). Beide gehen ueber dieselbe Regel: eine Zeile in `messages` mit
--  gesetztem `anruf_art`. Die Bestandsregel „Nachricht senden" gilt
--  unveraendert, es braucht also keine neue Policy.
--
--  EINSPIELEN
--
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      ../SUPABASE_SCHEMA_35_anrufe.sql
-- ===========================================================================

alter table public.messages
  add column if not exists anruf_art    text,
  add column if not exists anruf_status text,
  add column if not exists anruf_dauer  integer;

alter table public.messages drop constraint if exists messages_anruf_art_check;
alter table public.messages
  add constraint messages_anruf_art_check
  check (anruf_art is null or anruf_art in ('audio', 'video'));

alter table public.messages drop constraint if exists messages_anruf_status_check;
alter table public.messages
  add constraint messages_anruf_status_check
  check (anruf_status is null or anruf_status in ('beendet', 'verpasst', 'abgelehnt'));

comment on column public.messages.anruf_art is
  'Gesetzt heisst: diese Zeile ist kein Text, sondern der Eintrag zu einem Anruf.';
comment on column public.messages.anruf_dauer is
  'Gespraechsdauer in Sekunden. 0 bei verpasst oder abgelehnt.';

/*
 * Die Verschluesselungs-Bedingung `messages_krypto_stimmig` aus Schema 31
 * bleibt unveraendert. Ein Anrufeintrag wird mit krypto = 0 und leerem Text
 * geschrieben und faellt damit in den erlaubten Fall — er braucht keine
 * Ausnahme, und die Regel bleibt so streng, wie sie ist.
 */

