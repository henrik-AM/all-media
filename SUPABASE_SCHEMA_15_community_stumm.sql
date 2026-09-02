-- ===========================================================================
--  „Gestummte Communitys" — eine Liste ohne Grundlage
-- ===========================================================================
--
--  In den Einstellungen steht der Punkt „Gestummte Communitys". Er stand dort
--  auf beiden Seiten, und auf beiden Seiten stand darunter etwas anderes:
--
--    App:      communities.filter(c => c.joined && c.unreadCount === 0
--                                      && c.visibility === 'private')
--    Website:  state.chats.filter(c => c.isGroup && c.muted)
--
--  Die App listete damit jede private Community, in der man Mitglied ist —
--  `unreadCount` steht in lib/daten.ts fest auf 0, die Bedingung war also
--  immer erfüllt. Die Website listete Gruppen*chats*, was etwas anderes ist.
--  Keine der beiden Listen hatte je mit Stummschalten zu tun, denn ein
--  Stummschalten von Communitys gab es nicht: keine Spalte, keine Aktion,
--  kein Schalter. Der Schalter „Benachrichtigungen" im Community-Blatt der
--  Website legte nur eine CSS-Klasse um und vergaß sie beim Schließen.
--
--  Diese Datei legt die fehlende Spalte an. Eine eigene Tabelle wäre falsch:
--  stumm ist eine Eigenschaft der Mitgliedschaft, nicht der Community — und
--  wer austritt, soll die Einstellung mit verlieren, was `on delete cascade`
--  auf community_members ohnehin erledigt.
--
--  Rechte: die vorhandene Regel „Selbst beitreten und verlassen" ist
--  `for all ... using (auth.uid() = user_id)` und deckt UPDATE damit schon
--  ab. Eine zusätzliche Regel wäre nicht nur überflüssig, sie würde die
--  Prüfung verdoppeln.
--
--  Einspielen:  node tools/sql-einspielen.mjs SUPABASE_SCHEMA_15_community_stumm.sql
-- ===========================================================================

alter table public.community_members
  add column if not exists is_muted boolean not null default false;

comment on column public.community_members.is_muted is
  'Diese Community schickt mir keine Mitteilungen. Gehört zur Mitgliedschaft, '
  'nicht zur Community — jeder entscheidet das für sich.';

-- ---------------------------------------------------------------------------
--  Zurücksetzen
--
--  `zuruecksetzen()` löscht die Mitgliedschaften des Prüfkontos ohnehin, und
--  die Spalte fällt damit mit. Es ist trotzdem der richtige Ort, das hier zu
--  vermerken: nach jedem Schema, das etwas anlegt, gehört nachgesehen, ob die
--  Funktion es kennt. Hier ist die Antwort ausnahmsweise „nichts zu tun" —
--  aber geprüft, nicht angenommen.
-- ---------------------------------------------------------------------------
