# Welche Schema-Datei gewinnt

**Diese Datei ist die Antwort auf die Frage: „Ich muss etwas aus einer alten
Schema-Datei nachziehen — was mache ich dabei kaputt?"**

## Warum es sie gibt

Am 18.09.2026 haben fünf Regressionen hintereinander dieselbe Ursache gehabt:
eine Schema-Datei wurde nachträglich noch einmal eingespielt, und
`create or replace` beziehungsweise `drop policy` + `create policy` hat still
die **neuere** Fassung aus einer **anderen** Datei überschrieben.

Betroffen waren unter anderem:

- `"Medien lesen"` — die Ablage war danach wieder **ohne Anmeldung lesbar**
- `"Mitglieder hinzufuegen"` — die DM-Sperre aus Schema 22 war weg
- `"Nachricht senden"` — die Ein-Nachricht-Regel der Chat-Anfrage war weg
- `starter_inhalte()` — die Korrektur an der Merkliste war weg
- `finde_per_nummer()` — die Telefonsuche verglich wieder rohe Ziffern

Keine dieser Doppelungen meldet etwas. Die Datei läuft durch, die Datenbank
ist danach älter als vorher, und auffällig wird es erst, wenn irgendein
Prüflauf an ganz anderer Stelle umfällt.

## Die Regel

**Nie eine ganze alte Schema-Datei nachträglich einspielen.** Nur den Block,
den man wirklich braucht. Geht das nicht, hinterher alle Dateien nachziehen,
die in der Tabelle unten **rechts von** der eingespielten stehen.

Gegenprobe nach jedem Eingriff: `npm run test:schema`, danach
`npm run test:alles`.

## Die Doppelungen

`SUPABASE_SCHEMA.sql` ist die Basisdatei — dort entsteht jedes Objekt zuerst.
Die Spalte „gilt" nennt die Datei, die zuletzt läuft und damit gewinnt.

| Objekt | definiert in (Reihenfolge) | gilt |
|---|---|---|
| Funktion public.alter_bei_anmeldung() | SUPABASE_SCHEMA_52_geburtsdatum.sql → SUPABASE_SCHEMA_58_eltern_per_nummer.sql | **SUPABASE_SCHEMA_58_eltern_per_nummer.sql** |
| Funktion public.eltern_anfragen() | SUPABASE_SCHEMA_52_geburtsdatum.sql → SUPABASE_SCHEMA_58_eltern_per_nummer.sql | **SUPABASE_SCHEMA_58_eltern_per_nummer.sql** |
| Funktion public.geburtsdatum_nachtragen() | SUPABASE_SCHEMA_52_geburtsdatum.sql → SUPABASE_SCHEMA_58_eltern_per_nummer.sql | **SUPABASE_SCHEMA_58_eltern_per_nummer.sql** |
| Funktion public.einwilligungen_offen() | SUPABASE_SCHEMA_52_geburtsdatum.sql → SUPABASE_SCHEMA_58_eltern_per_nummer.sql | **SUPABASE_SCHEMA_58_eltern_per_nummer.sql** |
| Funktion public.benachrichtige() | SUPABASE_SCHEMA_2.sql → SUPABASE_SCHEMA_23_audit.sql | **SUPABASE_SCHEMA_23_audit.sql** |
| Funktion public.community_sichtbar() | SUPABASE_SCHEMA_5.sql → SUPABASE_SCHEMA_7_testkonto.sql | **SUPABASE_SCHEMA_7_testkonto.sql** |
| Funktion public.darf_angeschrieben_werden() | SUPABASE_SCHEMA_22_dm_sperre.sql → SUPABASE_SCHEMA_27_sichtbarkeitspruefer.sql | **SUPABASE_SCHEMA_27_sichtbarkeitspruefer.sql** |
| Funktion public.darf_mitglied_werden() | SUPABASE_SCHEMA_22_dm_sperre.sql → SUPABASE_SCHEMA_57_messenger_nur_mit_zustimmung.sql | **SUPABASE_SCHEMA_57_messenger_nur_mit_zustimmung.sql** |
| Funktion public.darf_herunterladen() | SUPABASE_SCHEMA_20_sichtbarkeit_rest.sql → SUPABASE_SCHEMA_27_sichtbarkeitspruefer.sql | **SUPABASE_SCHEMA_27_sichtbarkeitspruefer.sql** |
| Funktion public.finde_per_nummer() | SUPABASE_SCHEMA_23_audit.sql → SUPABASE_SCHEMA_24_telefon.sql → SUPABASE_SCHEMA_38_nummer_bremse.sql → SUPABASE_SCHEMA_57_messenger_nur_mit_zustimmung.sql | **SUPABASE_SCHEMA_57_messenger_nur_mit_zustimmung.sql** |
| Funktion public.handle_frei() | SUPABASE_SCHEMA_4.sql → SUPABASE_SCHEMA_39_anonyme_bremse.sql | **SUPABASE_SCHEMA_39_anonyme_bremse.sql** |
| Funktion public.handle_new_user() | SUPABASE_SCHEMA.sql → SUPABASE_SCHEMA_3.sql → SUPABASE_SCHEMA_4.sql → SUPABASE_SCHEMA_34_telefon_pflicht.sql | **SUPABASE_SCHEMA_34_telefon_pflicht.sql** |
| Funktion public.liker_namen() | SUPABASE_SCHEMA_20_sichtbarkeit_rest.sql → SUPABASE_SCHEMA_23_audit.sql | **SUPABASE_SCHEMA_23_audit.sql** |
| Funktion public.meine_kontaktnummern() | SUPABASE_SCHEMA_23_audit.sql → SUPABASE_SCHEMA_57_messenger_nur_mit_zustimmung.sql | **SUPABASE_SCHEMA_57_messenger_nur_mit_zustimmung.sql** |
| Funktion public.nummer_frei() | SUPABASE_SCHEMA_34_telefon_pflicht.sql → SUPABASE_SCHEMA_39_anonyme_bremse.sql | **SUPABASE_SCHEMA_39_anonyme_bremse.sql** |
| Funktion public.on_contact() | SUPABASE_SCHEMA_2.sql → SUPABASE_SCHEMA_44_mitteilungen.sql → SUPABASE_SCHEMA_57_messenger_nur_mit_zustimmung.sql | **SUPABASE_SCHEMA_57_messenger_nur_mit_zustimmung.sql** |
| Funktion public.starter_inhalte() | SUPABASE_SCHEMA_5.sql → SUPABASE_SCHEMA_7_testkonto.sql → SUPABASE_SCHEMA_23_sicherheit.sql | **SUPABASE_SCHEMA_23_sicherheit.sql** |
| Funktion public.story_in_videos_zuruecknehmen() | SUPABASE_SCHEMA_30_story_in_videos.sql → SUPABASE_SCHEMA_36_story_getrennt.sql | **SUPABASE_SCHEMA_36_story_getrennt.sql** |
| Funktion public.testbestand_profilaufrufe() | SUPABASE_SCHEMA_17_testbestand_statistik.sql → SUPABASE_SCHEMA_23_sicherheit.sql | **SUPABASE_SCHEMA_23_sicherheit.sql** |
| Funktion public.zuruecksetzen() | SUPABASE_SCHEMA_5.sql → SUPABASE_SCHEMA_13_zuruecksetzen_handbuch.sql → SUPABASE_SCHEMA_14_chatstau.sql → SUPABASE_SCHEMA_23_sicherheit.sql → SUPABASE_SCHEMA_47_sammlungen_testbestand.sql | **SUPABASE_SCHEMA_47_sammlungen_testbestand.sql** |
| Funktion public.zuruecksetzen_einstellungen() | SUPABASE_SCHEMA_16_einstellungen.sql → SUPABASE_SCHEMA_23_sicherheit.sql | **SUPABASE_SCHEMA_23_sicherheit.sql** |
| Regel "stories_im_highlight" auf public.stories | SUPABASE_SCHEMA_46_sammlungen.sql → SUPABASE_SCHEMA_48_highlight_sichtbarkeit.sql | **SUPABASE_SCHEMA_48_highlight_sichtbarkeit.sql** |
| Regel "Aktuelle Storys lesen" auf public.stories | SUPABASE_SCHEMA.sql → SUPABASE_SCHEMA_7_testkonto.sql → SUPABASE_SCHEMA_19_sichtbarkeit_wirkt.sql | **SUPABASE_SCHEMA_19_sichtbarkeit_wirkt.sql** |
| Regel "Beitraege lesen" auf public.posts | SUPABASE_SCHEMA.sql → SUPABASE_SCHEMA_7_testkonto.sql | **SUPABASE_SCHEMA_7_testkonto.sql** |
| Regel "Communitys lesen" auf public.communities | SUPABASE_SCHEMA.sql → SUPABASE_SCHEMA_7_testkonto.sql | **SUPABASE_SCHEMA_7_testkonto.sql** |
| Regel "Eigene Chats aendern" auf public.chats | SUPABASE_SCHEMA.sql → SUPABASE_SCHEMA_23_sicherheit.sql | **SUPABASE_SCHEMA_23_sicherheit.sql** |
| Regel "Eigene Chats lesen" auf public.chats | SUPABASE_SCHEMA.sql → SUPABASE_SCHEMA_7_testkonto.sql | **SUPABASE_SCHEMA_7_testkonto.sql** |
| Regel "Eigene Nachricht aendern" auf public.messages | SUPABASE_SCHEMA_11_handbuch.sql → SUPABASE_SCHEMA_23_sicherheit.sql | **SUPABASE_SCHEMA_23_sicherheit.sql** |
| Regel "Eigene Streaks fortschreiben" auf public.insight_streaks | SUPABASE_SCHEMA_11_handbuch.sql → SUPABASE_SCHEMA_23_sicherheit.sql | **SUPABASE_SCHEMA_23_sicherheit.sql** |
| Regel "Eigene und empfangene Insights lesen" auf public.insights | SUPABASE_SCHEMA_11_handbuch.sql → SUPABASE_SCHEMA_12_insight_rekursion.sql | **SUPABASE_SCHEMA_12_insight_rekursion.sql** |
| Regel "Eigenen Insight aendern" auf public.insights | SUPABASE_SCHEMA_11_handbuch.sql → SUPABASE_SCHEMA_23_sicherheit.sql | **SUPABASE_SCHEMA_23_sicherheit.sql** |
| Regel "Eigenes Profil aendern" auf public.profiles | SUPABASE_SCHEMA.sql → SUPABASE_SCHEMA_23_sicherheit.sql | **SUPABASE_SCHEMA_23_sicherheit.sql** |
| Regel "Empfaenger eintragen" auf public.insight_recipients | SUPABASE_SCHEMA_11_handbuch.sql → SUPABASE_SCHEMA_12_insight_rekursion.sql | **SUPABASE_SCHEMA_12_insight_rekursion.sql** |
| Regel "Empfaengerzeilen lesen" auf public.insight_recipients | SUPABASE_SCHEMA_11_handbuch.sql → SUPABASE_SCHEMA_12_insight_rekursion.sql | **SUPABASE_SCHEMA_12_insight_rekursion.sql** |
| Regel "Insight als gesehen vermerken" auf public.insight_recipients | SUPABASE_SCHEMA_11_handbuch.sql → SUPABASE_SCHEMA_23_sicherheit.sql | **SUPABASE_SCHEMA_23_sicherheit.sql** |
| Regel "Kanal anlegen" auf public.community_channels | SUPABASE_SCHEMA_5.sql → SUPABASE_SCHEMA_7_testkonto.sql | **SUPABASE_SCHEMA_7_testkonto.sql** |
| Regel "Medien lesen" auf storage.objects | SUPABASE_SCHEMA_7_testkonto.sql → SUPABASE_SCHEMA_23_audit.sql → SUPABASE_SCHEMA_24_medien_auflisten.sql | **SUPABASE_SCHEMA_24_medien_auflisten.sql** |
| Regel "Mitglieder hinzufuegen" auf public.chat_members | SUPABASE_SCHEMA.sql → SUPABASE_SCHEMA_7_testkonto.sql → SUPABASE_SCHEMA_22_dm_sperre.sql | **SUPABASE_SCHEMA_22_dm_sperre.sql** |
| Regel "Mitglieder lesen" auf public.chat_members | SUPABASE_SCHEMA.sql → SUPABASE_SCHEMA_7_testkonto.sql → SUPABASE_SCHEMA_53_chat_schleife.sql | **SUPABASE_SCHEMA_53_chat_schleife.sql** |
| Regel "Nachricht senden" auf public.messages | SUPABASE_SCHEMA.sql → SUPABASE_SCHEMA_19_sichtbarkeit_wirkt.sql → SUPABASE_SCHEMA_21_chatanfrage.sql | **SUPABASE_SCHEMA_21_chatanfrage.sql** |
| Regel "PTT in eigenen Communitys lesen" auf public.ptt_messages | SUPABASE_SCHEMA_11_handbuch.sql → SUPABASE_SCHEMA_20_sichtbarkeit_rest.sql | **SUPABASE_SCHEMA_20_sichtbarkeit_rest.sql** |
| Regel "Pins lesen" auf public.friend_pins | SUPABASE_SCHEMA_5.sql → SUPABASE_SCHEMA_19_sichtbarkeit_wirkt.sql | **SUPABASE_SCHEMA_19_sichtbarkeit_wirkt.sql** |
| Regel "Reposts lesen" auf public.reposts | SUPABASE_SCHEMA_2.sql → SUPABASE_SCHEMA_20_sichtbarkeit_rest.sql | **SUPABASE_SCHEMA_20_sichtbarkeit_rest.sql** |
| Regel "Standortanfrage beantworten" auf public.location_requests | SUPABASE_SCHEMA_11_handbuch.sql → SUPABASE_SCHEMA_23_sicherheit.sql | **SUPABASE_SCHEMA_23_sicherheit.sql** || Bestand public.vorlage_chats | SUPABASE_SCHEMA_6_inhalte.sql → SUPABASE_SCHEMA_7_testkonto.sql | **SUPABASE_SCHEMA_7_testkonto.sql** |
| Bestand public.vorlage_eigene_beitraege | SUPABASE_SCHEMA_7_testkonto.sql → SUPABASE_SCHEMA_8_medien.sql → SUPABASE_SCHEMA_45_starter_medien.sql → SUPABASE_SCHEMA_56_querformat_kapitel.sql | **SUPABASE_SCHEMA_45_starter_medien.sql** (Medien), **SUPABASE_SCHEMA_56_querformat_kapitel.sql** (Laufzeit und Kapitel) |
| Bestand public.vorlage_eigene_storys | SUPABASE_SCHEMA_7_testkonto.sql → SUPABASE_SCHEMA_8_medien.sql → SUPABASE_SCHEMA_45_starter_medien.sql | **SUPABASE_SCHEMA_45_starter_medien.sql** |

## Nachtrag 20.09.2026: doppelt befüllte Tabellen

Die Liste enthielt zuerst nur Funktionen und Regeln — also das, was
*definiert* wird. Eine Tabelle, die in zwei Dateien unterschiedlich *befüllt*
wird, war unsichtbar.

Genau daran ist es ein weiteres Mal gescheitert: `SUPABASE_SCHEMA_8_medien.sql`
gab den Starterbeiträgen echte Videos, `SUPABASE_SCHEMA_7_testkonto.sql`
befüllt dieselbe Vorlagentabelle mit den Platzhalter-PNGs. Nach dem
vollständigen Neueinspielen von Schema 7 am 18.09.2026 zeigten **32 als Video
deklarierte Beiträge auf eine PNG-Datei** — kein Prüflauf schlug an.

`test:schema` zählt deshalb jetzt auch `insert into` und `update` auf
`vorlage_*` als Definition. Beschränkt auf diese Tabellen: sie sind die
Vorlagen des Testbestands, also die Klasse, bei der „die letzte Datei gewinnt"
über den *Inhalt* entscheidet. Bei `posts` oder `profiles` wäre das Nacheinander
gerade der Zweck.

Zweite, unabhängige Absicherung in `test:datenbank`: **kein Beitrag der Art
`clip` oder `reel` darf auf eine Bilddatei zeigen.** Die Prüfung interessiert
sich nicht dafür, welche Datei gewonnen hat, sondern nur für das Ergebnis.
