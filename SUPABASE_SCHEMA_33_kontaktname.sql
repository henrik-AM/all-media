-- ===========================================================================
--  Schema 33 — der eigene Name für einen Kontakt
--
--  Henrik, 07.09.2026: "Kontaktinfo-Änderungen (z.B. Name) speichern/
--  synchronisieren nicht."
--
--  Das Blatt "Kontakt bearbeiten" gab es in App und Website, es hatte zwei
--  Felder, und es meldete nach dem Tippen auf "Speichern" auch brav "Kontakt
--  gespeichert". Geschrieben wurde nichts. Der neue Name lag in einem
--  Zustand im Bildschirm (`angezeigterName` in ContactProfileScreen.tsx) und
--  war beim nächsten Öffnen weg; die Notiz wurde gar nicht erst gelesen.
--
--  Wohin er gehört: an `contacts`, nicht an `profiles`. Wie jemand heißt,
--  entscheidet die Person selbst — wie ich sie in MEINER Kontaktliste nenne,
--  entscheide ich. `contacts` hat für jede Richtung eine eigene Zeile, damit
--  ist der Spitzname von Natur aus einseitig und für die andere Seite
--  unsichtbar. Die Regel "Eigene Kontakte" (SUPABASE_SCHEMA.sql) gibt jeder
--  Zeile schon den richtigen Eigentümer; sie muss nicht angefasst werden.
-- ===========================================================================

alter table public.contacts
  add column if not exists spitzname text,
  add column if not exists notiz     text;

comment on column public.contacts.spitzname is
  'Wie ICH diesen Kontakt nenne. Überschreibt profiles.name nur in meiner Ansicht.';
comment on column public.contacts.notiz is
  'Freie Notiz zum Kontakt — nur für mich, die andere Seite sieht sie nie.';
