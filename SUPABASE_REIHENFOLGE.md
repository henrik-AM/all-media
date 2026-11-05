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
| Funktion public.bunny_objekt_vorgaben() | SUPABASE_SCHEMA_115_bunny_medienvertrag.sql → SUPABASE_SCHEMA_116_bunny_altmedien.sql | **SUPABASE_SCHEMA_116_bunny_altmedien.sql** |
| Funktion public.bunny_ursprung_frei() | SUPABASE_SCHEMA_115_bunny_medienvertrag.sql → SUPABASE_SCHEMA_116_bunny_altmedien.sql | **SUPABASE_SCHEMA_116_bunny_altmedien.sql** |
| Funktion public.darf_markieren() | SUPABASE_SCHEMA_20_sichtbarkeit_rest.sql → SUPABASE_SCHEMA_86_markierungen.sql | **SUPABASE_SCHEMA_86_markierungen.sql** |
| Funktion public.darf_story_markieren() | SUPABASE_SCHEMA_68_storys.sql → SUPABASE_SCHEMA_86_markierungen.sql | **SUPABASE_SCHEMA_86_markierungen.sql** |
| Funktion public.story_markierbar() | SUPABASE_SCHEMA_68_storys.sql → SUPABASE_SCHEMA_86_markierungen.sql → SUPABASE_SCHEMA_87_entsperrcode_kontakte_minderjaehrige.sql | **SUPABASE_SCHEMA_87_entsperrcode_kontakte_minderjaehrige.sql** |
| Funktion public.darf_markieren_person() | SUPABASE_SCHEMA_86_markierungen.sql → SUPABASE_SCHEMA_87_entsperrcode_kontakte_minderjaehrige.sql | **SUPABASE_SCHEMA_87_entsperrcode_kontakte_minderjaehrige.sql** |
| Funktion public.markierung_vorschlaege() | SUPABASE_SCHEMA_86_markierungen.sql → SUPABASE_SCHEMA_87_entsperrcode_kontakte_minderjaehrige.sql | **SUPABASE_SCHEMA_87_entsperrcode_kontakte_minderjaehrige.sql** |
| Funktion public.personen_vorschlaege() | SUPABASE_SCHEMA_85_personen_vorschlaege.sql → SUPABASE_SCHEMA_87_entsperrcode_kontakte_minderjaehrige.sql | **SUPABASE_SCHEMA_87_entsperrcode_kontakte_minderjaehrige.sql** |
| Funktion public.bildschirmzeit_stand() | SUPABASE_SCHEMA_83_bildschirmzeit.sql → SUPABASE_SCHEMA_87_entsperrcode_kontakte_minderjaehrige.sql | **SUPABASE_SCHEMA_87_entsperrcode_kontakte_minderjaehrige.sql** |
| Funktion public.bildschirmzeit_entsperren() | SUPABASE_SCHEMA_83_bildschirmzeit.sql → SUPABASE_SCHEMA_87_entsperrcode_kontakte_minderjaehrige.sql | **SUPABASE_SCHEMA_87_entsperrcode_kontakte_minderjaehrige.sql** |
| Funktion public.alter_bei_anmeldung() | SUPABASE_SCHEMA_52_geburtsdatum.sql → SUPABASE_SCHEMA_58_eltern_per_nummer.sql | **SUPABASE_SCHEMA_58_eltern_per_nummer.sql** |
| Funktion public.eltern_anfragen() | SUPABASE_SCHEMA_52_geburtsdatum.sql → SUPABASE_SCHEMA_58_eltern_per_nummer.sql | **SUPABASE_SCHEMA_58_eltern_per_nummer.sql** |
| Funktion public.geburtsdatum_nachtragen() | SUPABASE_SCHEMA_52_geburtsdatum.sql → SUPABASE_SCHEMA_58_eltern_per_nummer.sql | **SUPABASE_SCHEMA_58_eltern_per_nummer.sql** |
| Funktion public.einwilligungen_offen() | SUPABASE_SCHEMA_52_geburtsdatum.sql → SUPABASE_SCHEMA_58_eltern_per_nummer.sql | **SUPABASE_SCHEMA_58_eltern_per_nummer.sql** |
| Funktion public.benachrichtige() | SUPABASE_SCHEMA_2.sql → SUPABASE_SCHEMA_23_audit.sql → SUPABASE_SCHEMA_78_stumm_mitteilungen.sql | **SUPABASE_SCHEMA_78_stumm_mitteilungen.sql** |
| Funktion public.mitteilung_anlegen() | SUPABASE_SCHEMA_44_mitteilungen.sql → SUPABASE_SCHEMA_78_stumm_mitteilungen.sql | **SUPABASE_SCHEMA_78_stumm_mitteilungen.sql** |
| Funktion public.sichtbar_fuer() | SUPABASE_SCHEMA_11_handbuch.sql → SUPABASE_SCHEMA_76_likes_nur_follower.sql | **SUPABASE_SCHEMA_76_likes_nur_follower.sql** |
| Funktion public.mitteilung_bei_story_markierung() | SUPABASE_SCHEMA_68_storys.sql → SUPABASE_SCHEMA_75_story_markierung_im_chat.sql | **SUPABASE_SCHEMA_75_story_markierung_im_chat.sql** |
| Funktion public.spendencode_setzen() | SUPABASE_SCHEMA_72_zahlung_spendencode.sql → SUPABASE_SCHEMA_77_spendenpin_doppelt.sql | **SUPABASE_SCHEMA_77_spendenpin_doppelt.sql** |
| Funktion public.sammlung_inhalt_pruefen() | SUPABASE_SCHEMA_46_sammlungen.sql → SUPABASE_SCHEMA_80_sammlung_nur_eigenes.sql | **SUPABASE_SCHEMA_80_sammlung_nur_eigenes.sql** |
| Funktion public.feed_rang() | SUPABASE_SCHEMA_51_feed_rang.sql → SUPABASE_SCHEMA_82_feed_lenkung.sql | **SUPABASE_SCHEMA_82_feed_lenkung.sql** (Kasten 24: Nähe-Likes erst ab „Feed zurücksetzen“) |
| Funktion public.interessenbild() | SUPABASE_SCHEMA_51_feed_rang.sql → SUPABASE_SCHEMA_82_feed_lenkung.sql | **SUPABASE_SCHEMA_82_feed_lenkung.sql** (Kasten 24: nur eigenes Bild, Signale erst ab Neustart) |
| Funktion public.community_sichtbar() | SUPABASE_SCHEMA_5.sql → SUPABASE_SCHEMA_7_testkonto.sql | **SUPABASE_SCHEMA_7_testkonto.sql** |
| Funktion public.darf_angeschrieben_werden() | SUPABASE_SCHEMA_22_dm_sperre.sql → SUPABASE_SCHEMA_27_sichtbarkeitspruefer.sql | **SUPABASE_SCHEMA_27_sichtbarkeitspruefer.sql** |
| Funktion public.darf_mitglied_werden() | SUPABASE_SCHEMA_22_dm_sperre.sql → SUPABASE_SCHEMA_57_messenger_nur_mit_zustimmung.sql | **SUPABASE_SCHEMA_57_messenger_nur_mit_zustimmung.sql** |
| Funktion public.darf_herunterladen() | SUPABASE_SCHEMA_20_sichtbarkeit_rest.sql → SUPABASE_SCHEMA_27_sichtbarkeitspruefer.sql | **SUPABASE_SCHEMA_27_sichtbarkeitspruefer.sql** |
| Funktion public.finde_per_nummer() | SUPABASE_SCHEMA_23_audit.sql → SUPABASE_SCHEMA_24_telefon.sql → SUPABASE_SCHEMA_38_nummer_bremse.sql → SUPABASE_SCHEMA_57_messenger_nur_mit_zustimmung.sql | **SUPABASE_SCHEMA_57_messenger_nur_mit_zustimmung.sql** |
| Funktion public.handle_frei() | SUPABASE_SCHEMA_4.sql → SUPABASE_SCHEMA_39_anonyme_bremse.sql | **SUPABASE_SCHEMA_39_anonyme_bremse.sql** |
| Funktion public.handle_new_user() | SUPABASE_SCHEMA.sql → SUPABASE_SCHEMA_3.sql → SUPABASE_SCHEMA_4.sql → SUPABASE_SCHEMA_34_telefon_pflicht.sql | **SUPABASE_SCHEMA_34_telefon_pflicht.sql** |
| Funktion public.liker_namen() | SUPABASE_SCHEMA_20_sichtbarkeit_rest.sql → SUPABASE_SCHEMA_23_audit.sql → SUPABASE_SCHEMA_65_likes_sichtbarkeit.sql | **SUPABASE_SCHEMA_65_likes_sichtbarkeit.sql** (nur noch Gefolgte, Besitzer sieht alle) |
| Funktion public.meine_kontaktnummern() | SUPABASE_SCHEMA_23_audit.sql → SUPABASE_SCHEMA_57_messenger_nur_mit_zustimmung.sql | **SUPABASE_SCHEMA_57_messenger_nur_mit_zustimmung.sql** |
| Funktion public.nummer_frei() | SUPABASE_SCHEMA_34_telefon_pflicht.sql → SUPABASE_SCHEMA_39_anonyme_bremse.sql | **SUPABASE_SCHEMA_39_anonyme_bremse.sql** |
| Funktion public.on_contact() | SUPABASE_SCHEMA_2.sql → SUPABASE_SCHEMA_44_mitteilungen.sql → SUPABASE_SCHEMA_57_messenger_nur_mit_zustimmung.sql | **SUPABASE_SCHEMA_57_messenger_nur_mit_zustimmung.sql** |
| Funktion public.starter_inhalte() | SUPABASE_SCHEMA_5.sql → SUPABASE_SCHEMA_7_testkonto.sql → SUPABASE_SCHEMA_23_sicherheit.sql | **SUPABASE_SCHEMA_23_sicherheit.sql** (Schema 17, 60 und 62 schreiben sie am Anker um; 62 sperrt echte Konten aus) |
| Funktion public.story_in_videos_zuruecknehmen() | SUPABASE_SCHEMA_30_story_in_videos.sql → SUPABASE_SCHEMA_36_story_getrennt.sql → SUPABASE_SCHEMA_68_storys.sql | **SUPABASE_SCHEMA_68_storys.sql** |
| Funktion public.storys_aus_videos_nehmen() | SUPABASE_SCHEMA_36_story_getrennt.sql → SUPABASE_SCHEMA_68_storys.sql | **SUPABASE_SCHEMA_68_storys.sql** |
| Funktion public.testbestand_profilaufrufe() | SUPABASE_SCHEMA_17_testbestand_statistik.sql → SUPABASE_SCHEMA_23_sicherheit.sql | **SUPABASE_SCHEMA_23_sicherheit.sql** |
| Funktion public.zuruecksetzen() | SUPABASE_SCHEMA_5.sql → SUPABASE_SCHEMA_13_zuruecksetzen_handbuch.sql → SUPABASE_SCHEMA_14_chatstau.sql → SUPABASE_SCHEMA_23_sicherheit.sql → SUPABASE_SCHEMA_47_sammlungen_testbestand.sql | **SUPABASE_SCHEMA_47_sammlungen_testbestand.sql** (Schema 62 schreibt sie am Anker um: nur Testkonten; SUPABASE_SCHEMA_85_personen_vorschlaege.sql hängt am Anker `delete from public.follows` das Leeren von vorschlag_entfernt an; SUPABASE_SCHEMA_87_entsperrcode_kontakte_minderjaehrige.sql hängt dahinter das Leeren von telefonbuch an; SUPABASE_SCHEMA_88_profilseite.sql — **Entwurf, noch nicht eingespielt (Supabase-Sperre)** — hängt am Anker `geburtsdatum = null` das Zurücksetzen von pronomen und links an) |
| Funktion public.zuruecksetzen_einstellungen() | SUPABASE_SCHEMA_16_einstellungen.sql → SUPABASE_SCHEMA_23_sicherheit.sql → SUPABASE_SCHEMA_83_bildschirmzeit.sql | **SUPABASE_SCHEMA_83_bildschirmzeit.sql** |
| Regel "stories_im_highlight" auf public.stories | SUPABASE_SCHEMA_46_sammlungen.sql → SUPABASE_SCHEMA_48_highlight_sichtbarkeit.sql | **SUPABASE_SCHEMA_48_highlight_sichtbarkeit.sql** |
| Regel "Aktuelle Storys lesen" auf public.stories | SUPABASE_SCHEMA.sql → SUPABASE_SCHEMA_7_testkonto.sql → SUPABASE_SCHEMA_19_sichtbarkeit_wirkt.sql → SUPABASE_SCHEMA_68_storys.sql | **SUPABASE_SCHEMA_68_storys.sql** (Ziel entscheidet: Videos für alle Sichtbaren, Messenger nur Kontakte, Markierte) |
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
| Regel "Likes lesen" auf public.post_likes | SUPABASE_SCHEMA.sql → SUPABASE_SCHEMA_65_likes_sichtbarkeit.sql | **SUPABASE_SCHEMA_65_likes_sichtbarkeit.sql** (vorher für alle offen; jetzt like_sichtbar()) |
| Regel "Kommentar-Likes lesen" auf public.comment_likes | SUPABASE_SCHEMA.sql → SUPABASE_SCHEMA_84_likes_wirkt.sql | **SUPABASE_SCHEMA_84_likes_wirkt.sql** (vorher für alle offen; jetzt kommentar_like_sichtbar()) |
| Regel "Story-Likes lesen" auf public.story_likes | SUPABASE_SCHEMA.sql → SUPABASE_SCHEMA_84_likes_wirkt.sql | **SUPABASE_SCHEMA_84_likes_wirkt.sql** (vorher für alle offen; jetzt story_like_sichtbar()) |
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
| Bestand public.sounds (Test-Sounds: Liedtext, Songbild/Hörprobe, Einsätze, Wellenform) | SUPABASE_SCHEMA_6_inhalte.sql → SUPABASE_SCHEMA_54_songs.sql → SUPABASE_SCHEMA_63_liedzeiten.sql → SUPABASE_SCHEMA_67_sound_nutzung.sql | **SUPABASE_SCHEMA_6_inhalte.sql** (Liedtext), **SUPABASE_SCHEMA_54_songs.sql** (Songwriter, Songbild, Hörprobe), **SUPABASE_SCHEMA_63_liedzeiten.sql** (`lyrics_zeiten`, eine Zahl je nicht-leerer Liedzeile — wer den Liedtext in Schema 6 ändert, muss die Einsätze in 63 nachziehen, sonst verteilt die Seite wieder gleichmäßig), **SUPABASE_SCHEMA_67_sound_nutzung.sql** (`wellenform`, `hoerprobe_sek` — Ausgabe von `web/tools/wellenform.py`; wer die Hörproben mit `web/tools/testsounds.py` neu erzeugt, muss den Block am Ende von 67 neu rechnen) |

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

## Nachtrag 28.09.2026: Schema 66 entschärft alte Testbestand-Dateien

`SUPABASE_SCHEMA_66_verlauf_nur_eigenes.sql` legt den Wächter
`public.nur_eigene_aktion()` auf `saves`, `post_likes`, `reposts`, `comments`
und `shares`. Er definiert nichts, was es schon gibt — deshalb keine Zeile in
der Tabelle oben —, verändert aber, was ältere Dateien beim Neueinspielen
bewirken:

| Datei | schreibt ohne Anmeldung in echte Konten | seit Schema 66 |
|---|---|---|
| SUPABASE_SCHEMA_7_testkonto.sql, SUPABASE_SCHEMA_23_sicherheit.sql, SUPABASE_EINSPIELEN.sql (starter_inhalte ohne ist_testkonto) | Merkliste, Repost, Likes, Kommentar | übersprungen (Warnung), Registrierung läuft weiter |
| SUPABASE_SCHEMA_42_testbestand_sichtbar.sql (Einfügen für `not z.demo`) | 2 Merkliste, 1 Repost, 3 Likes je Konto | übersprungen (Warnung) |
| SUPABASE_SCHEMA_50_kommentar_sichtbar.sql | Testkommentar | übersprungen (Warnung) |

Reihenfolge: **Schema 66 nach Schema 62** — der Wächter ruft
`ist_testkonto()`. Die Datei prüft das vorab und bricht sonst ab.

Die schon vorhandenen Seed-Einträge in echten Konten entfernt Schema 66
NICHT. Die Aufräum-Anweisung steht auskommentiert am Ende der Datei und
läuft nur nach Henriks Freigabe.

**Ausgeführt am 29.09.2026** nach Henriks Freigabe: 33 Zeilen in sechs
echten Konten gelöscht (9 Merkliste, 6 Reposts, 18 Likes, 0 Kommentare),
vorher vollständig gesichert im Vault
(`07 Anhänge/All-Media Seed-Sicherung 2026-09-29.json`). Schritt A fand 26;
7 weitere trugen denselben Zeitstempel auf die Mikrosekunde, aber nur in
einer *anderen* Tabelle bzw. nur bei einem Konto (`starter_inhalte()` bei
der ersten Anmeldung, nicht bei der Registrierung). Gegenprobe: kein
Eintrag eines echten Kontos mehr, dessen Zeitstempel bei mehreren Konten
oder in mehreren Tabellen vorkommt. Follows aus `starter_inhalte()` sind
nicht angefasst.

## Nachtrag 29.09.2026: Schema 67 — Sound je Beitrag

`SUPABASE_SCHEMA_67_sound_nutzung.sql` bringt `posts.sound_id`/`sound_ab`,
den Auslöser `posts_sound_zuordnen` (setzt `sound_id` aus `posts.music`),
`sound_stellen()` für die meist verwendeten Stellen (nur Nicht-Demo-Beiträge,
EXECUTE nur `authenticated`) und `sounds.wellenform`, `hoerprobe_sek`,
`cover_quelle`, `cover_link`. Neue Definitionen, keine Doppelung.
Reihenfolge: nach Schema 54 (Spalten der Sounds).

## Nachtrag 29.09.2026: Schemas 68–71 (Kästen 11 und 12)

- `SUPABASE_SCHEMA_68_storys.sql` — `stories.in_messenger`/`overlays`,
  `stories_ziel_check`, Tabelle `story_tags`, Markier-Funktionen, Mitteilung
  bei Markierung, neue Leseregel „Aktuelle Storys lesen“ und neue Fassung von
  `story_in_videos_zuruecknehmen()`/`storys_aus_videos_nehmen()` (beide halten
  den Check ein). **Wer Schema 19 oder 36 neu einspielt, muss 68 nachziehen**,
  sonst lesen wieder alle Konten Messenger-Storys.
- `SUPABASE_SCHEMA_69_profilbild.sql` — `profiles.avatar_url` mit
  Spaltenrecht. **Schema 23 erneut einspielen nimmt das Leserecht wieder weg.**
- `SUPABASE_SCHEMA_70_titelbild.sql` — Titelbild von Playlist/Highlight.
- `SUPABASE_SCHEMA_71_spendenziel.sql` — `spendenstand()`.

## Nachtrag 29.09.2026: Schemas 72–73 (Kasten 13)

- `SUPABASE_SCHEMA_72_zahlung_spendencode.sql` — Tabelle `zahlungsmethoden` (RLS, Anbieter-Token nicht lesbar), Spendencode als bcrypt-Hash mit HMAC-Fingerabdruck (`spendencodes`, `spendencode_pfeffer`, `spendencode_protokoll`), `spendencode_setzen/entfernen/status` und `spende_senden()` (EXECUTE nur `authenticated`). `donations` bekommt `zahlungsstatus`/`zahlungsmethode_id`. **Die Regel „Spende senden“ aus Schema 11 ist gelöscht und INSERT/UPDATE/DELETE auf `donations` entzogen** — Spenden laufen nur noch über `spende_senden()`. Wer Schema 11 neu einspielt, öffnet das direkte Eintragen wieder; danach 72 nachziehen.
- `SUPABASE_SCHEMA_73_testbestand_nur_testkonten.sql` — `testbestand_insight()` und `testbestand_profilaufrufe()` wirken nur noch für `ist_testkonto()`, EXECUTE entzogen. Neue Fassung derselben Funktionen, Gewinner 73.
- Gegenprobe (liest nur): `berichte/PRUEFUNG_echte_konten_seit_schema62.sql`; am 29.09. alle „test_an_echt“-Zeilen 0.
- `SUPABASE_SCHEMA_74_freigabe_neue_tabellen.sql` — einschränkende Regel `nur_freigegebene` (Schema 52, Teil 4) auf `story_tags`, `zahlungsmethoden`, `spendencodes`, `spendencode_protokoll`, `spendencode_pfeffer`. **Jede neue Tabelle mit RLS braucht diese Regel**, sonst schlägt `_minderjaehrig.js` an.

## Nachtrag 01.10.2026: Schemas 75–77 (Kästen 16, 19, 18)

- `SUPABASE_SCHEMA_75_story_markierung_im_chat.sql` — `messages.hinweis`
  ('story_markierung'), `zweierchat()`, neue Fassung von
  `mitteilung_bei_story_markierung()` (Gewinner 75, ersetzt 68): Hinweis in den
  Messenger-Zweierchat, sonst Community-Zweierchat, sonst neue Community-Anfrage;
  Glocke nur bei `in_videos`. Neu `mitteilung_weg_bei_story_markierung()`.
  **Wer Schema 68 neu einspielt, muss 75 nachziehen.**
- `SUPABASE_SCHEMA_76_likes_nur_follower.sql` — Stufe `nur_follower` (nur Bereich
  `likes`), neue Fassung von `sichtbar_fuer()`. **Gewinner 76, ersetzt Schema 11.**
  Wer Schema 11 neu einspielt, nimmt die Stufe weg; danach 76 nachziehen.
- `SUPABASE_SCHEMA_77_spendenpin_doppelt.sql` — `spendencode_setzen()` ohne
  „vergeben“ (Gewinner 77, ersetzt 72); Fingerabdruck-Spalte, -Funktion und
  `spendencode_pfeffer` gelöscht. **Schema 72 nicht neu einspielen**, es legte
  Pfeffer und Eindeutigkeit wieder an. Schema 74 überspringt die fehlende Tabelle.
- `SUPABASE_SCHEMA_78_stumm_mitteilungen.sql` (Kasten 20.2) — `mitteilung_stumm()`
  neu; neue Fassungen von `mitteilung_anlegen()` (**Gewinner 78**, ersetzt 44)
  und `benachrichtige()` (**Gewinner 78**, ersetzt 23_audit): keine Mitteilung
  von stummgeschalteten Konten, aus stummen Communitys und Chats. Wer 44 oder
  23_audit neu einspielt, muss 78 nachziehen.
- `SUPABASE_SCHEMA_79_hinweis_ist_kein_austausch.sql` (Kasten 16) —
  `messenger_anfragen()` zählt Hinweis-Nachrichten (Story-Markierung) nicht als
  Austausch. Am Anker umgeschrieben; **wer Schema 57 neu einspielt, muss 79
  nachziehen.**
- `SUPABASE_SCHEMA_80_sammlung_nur_eigenes.sql` (Kasten 17) — neue Fassung von
  `sammlung_inhalt_pruefen()` (**Gewinner 80**, ersetzt 46): in eine Sammlung
  kommt nur, was dem Besitzer gehört. `starter_sammlungen()` legt nur Eigenes
  ab und bleibt davon unberührt.

## Schema 115 — isolierter Bunny-Medienvertrag (27.10.2026)

`SUPABASE_SCHEMA_115_bunny_medienvertrag.sql` führt ausschließlich neue Objekte ein:
`medien_objekte`, `medium_upload_erlaubt`, `medien_leseliste`, `medium_loeschrecht`
und die `bunny_*`-Rechte-/Referenzhelfer und Trigger. Keine Überschreibung einer
älteren Funktion, keine Doppelungskette. Benötigt die live vorhandenen Helfer
`medien_adresse`, `medien_adresse_gueltig`, `medium_sichtbar` sowie Kontofreigabe
und Blockierprüfung. Die nicht auf diesem main-Stand enthaltenen Schemas 107–114
werden nicht vorausgesetzt oder eingespielt. Schema 115 ist kein Ersatz für 113
auf dem Sammelzweig; dessen spätere Integration muss die beiden Verträge abstimmen.

## Schema 116 — Altmedien registrieren (28.10.2026)

Auf 115: dienstseitige Registrierung ausschließlich aus storage.objects, historische
Pfade, gemeinsame Beispielmedien ohne Eigentümer, ursprüngliche Zeitstempel.
Bunny-Löschmarken erhalten die Supabase-Originale und verhindern Rückfälle.
Keine Funktionen aus 107–114 vorausgesetzt. Ersetzt nur die beiden oben genannten
115-Helfer; Uploadlimit und Eigentümerpräfix für neue Uploads bleiben wirksam.

## Nachtrag 31.10.2026: Schema 117 (Codex-Fund F4) — LIVE eingespielt

**Eingespielt am 31.10.2026 nach Henriks Ja** (vorgezogen, Sicherheitslücke). Nach 95 und 115/116. Entstanden auf `kasten/rs-recht`.

- `SUPABASE_SCHEMA_117_medienreferenz_eigen.sql` — Auslöser `medienreferenz_pruefen` auf allen Medienspalten (Liste wie `bunny_referenz_pruefen` aus 115, dazu `kontakt_bilder`): eine Medienadresse setzen darf nur, wer die Datei selbst hochgeladen hat (`medium_selbst_hochgeladen`), außer `beispiel/…` und Weiterleiten (`forwarded_from` = Absender einer lesbaren Nachricht mit derselben Adresse). Neue Objekte, keine Doppelung.
- Live fehlen `communities.bild_url` (99) und `kontakt_bilder` (94): Die Schleife überspringt fehlende Spalten. **Nach dem Einspielen von 94 bzw. 99 Schema 117 erneut einspielen** (idempotent).
- Probe `app/test/_probe_f4_medien.js`: live vorher 9/18, danach 18/18. `test:angriffe` lädt für „Story mit eigener Medienadresse" jetzt erst hoch.

## Nachtrag 22.10.2026: Schema 101 (Auftrag Recht/Sicherheit, eingespielt)

**Eingespielt am 22.10.2026** (Sicherheits-Schema ohne neuen Code, Regel 4 der Sperr-Notiz;
Probe `app/test/_probe101.js` 12/12 verworfen, Gegenprobe ohne 101 7/12, danach `test:angriffe` 36/36).

- `SUPABASE_SCHEMA_101_freigabe_nummer_spende.sql` — `finde_per_nummer()` findet kein wartendes/
  abgelehntes Kinderkonto mehr (und ein wartendes Konto sucht niemanden), `spende_senden()` nur
  zwischen freigegebenen Konten (Empfänger → „empfaenger", Absender → „nicht_freigegeben").
  **Ersetzt `finde_per_nummer` (zuletzt 57) und `spende_senden` (zuletzt 72).** Wer 57 oder 72 neu
  einspielt, muss 101 nachziehen.

| Objekt | Dateien (die letzte gewinnt) |
|---|---|
| Funktion public.finde_per_nummer() | SUPABASE_SCHEMA_23_audit.sql → SUPABASE_SCHEMA_24_telefon.sql → SUPABASE_SCHEMA_38_nummer_bremse.sql → SUPABASE_SCHEMA_57_messenger_nur_mit_zustimmung.sql → SUPABASE_SCHEMA_101_freigabe_nummer_spende.sql |
| Funktion public.spende_senden() | SUPABASE_SCHEMA_72_zahlung_spendencode.sql → SUPABASE_SCHEMA_101_freigabe_nummer_spende.sql |

Die offenen Entwürfe 88–100 berühren beide Funktionen nicht (geprüft 22.10.).

## Nachtrag 22.10.2026: Schemas 102 und 103 (Auftrag Recht/Sicherheit, Entwürfe)

**Nicht eingespielt** (Feature-Schemas mit neuem Code, erst beim Abschluss der Supabase-Sperre). Reihenfolge: **102 vor 103** — 103 ruft `rechtsmitteilung()` aus 102.

- `SUPABASE_SCHEMA_102_melden_moderation.sql` — Melden und Moderation nach DSA Art. 16/17/20 (Kategorien, Begründung, Beschwerde, Moderatoren ohne Lesezugriff auf `messages`). `reports.reported_by` wird `on delete set null` (Meldungen überleben das Löschen des Meldenden). Probe `app/test/_probe102.js` 45/45 verworfen. **Nach Gate 2 (25.–31.10.2026):** direkter Insert gehärtet, Sperre wirkt (`nicht_gesperrt`), `nur_eigene_aktion` (66) neu mit Wiederherstellungs-Schalter, dazu `art18_vermerken`, `gemeldetes_medium`, `begruendung_nachsenden`, `sperre_nachtragen`, `medium_abruf_vermerken`; `meldung_entscheiden` hat jetzt 7 Parameter (`p_zurueckstellen`), `meldungen_liste` liefert `art18` und `zurueckgestellt` (drop + create). Probe **83/83** verworfen, Probe 103 danach 27/27.
- `SUPABASE_SCHEMA_103_konto_loeschen_auskunft.sql` — echtes Konto löschen (`konto_loeschen`, `meine_medien`), Sperr-Hash der Telefonnummer bis Sperrende (Auslöser auf `auth.users` und `profiles`), vollständige Auskunft. **Ersetzt `meine_daten` (zuletzt 18).** Wer 18 neu einspielt, muss 103 nachziehen. Probe `app/test/_probe103.js` 27/27 verworfen.

| Objekt | Dateien (die letzte gewinnt) |
|---|---|
| Funktion public.meine_daten() | SUPABASE_SCHEMA_18_sichtbarkeit_daten.sql → SUPABASE_SCHEMA_103_konto_loeschen_auskunft.sql |
| Funktion public.nur_eigene_aktion() | SUPABASE_SCHEMA_66_verlauf_nur_eigenes.sql → SUPABASE_SCHEMA_102_melden_moderation.sql |

**Gesamtreihenfolge der offenen Entwürfe:** 88 → 89 → 90 → 91 → 92 → 93 → 94 → 97 → 98 → 99 → 100 → 102 → 103.

## Nachtrag 31.10.2026: Schema 106 (Auftrag Recht/Sicherheit, Kasten RS 7, Entwurf)

**Nicht eingespielt**, erst nach Henriks Ja. Nach 52, 58 und 103. Nummern 104 und 105 bleiben für RS reserviert.

- `SUPABASE_SCHEMA_106_einwilligung_fassung.sql` — `rechtstext_fassungen` (geltende Fassung je Rechtstext, Prüfsumme wie `test:recht`) und `einwilligungen` (nur anhängen). Auslöser `einwilligung_aus_registrierung` **after insert on auth.users** (neben `on_auth_user_created` aus 3/34 und `gesperrte_nummer_pruefen` aus 103; fängt eigene Fehler ab, blockiert kein Konto). ~~Auslöser `eltern_einwilligung_vermerken`~~ (seit Codex-Fund F12, 02.11.2026 gelöscht, siehe unten). `zustimmung_offen()`, `zustimmen(text,int,text)` (seit Codex-Fund F6 mit Prüfsumme des gezeigten Texts; alte Signatur wird gelöscht; Registrierung nur mit `pruefsumme_<dok>` in den Metadaten). Neue Objekte, keine Doppelung.
- Beide Tabellen sind bewusst ohne `nur_freigegebene` (das wartende Kind muss zustimmen und lesen können); `_minderjaehrig.js` nimmt sie aus.
- Beim Einspielen `meine_daten()` (103) um `einwilligungen` ergänzen (Nachtrag am Dateiende).
- Neue Fassung eines Rechtstextes = neue Zeile in `rechtstext_fassungen` per eigenem Schema, Prüfsumme aus `test:recht`.
- Dazu Familienbereich: `meine_kinder()`, `elterneinwilligung_widerrufen(uuid)` (Art. 7 Abs. 3, Richtlinie 1.6 — Konto ruht bis neue Zustimmung oder Landesgrenze).
- Probe `app/test/_probe106.js` **55/55** verworfen, keine Spuren (02.11.2026, nach F12; vorher 44/44 nach F6, 39/39).
- **Codex-Fund F12 (02.11.2026):** `einwilligung_entscheiden(uuid, boolean, jsonb)` ersetzt die Fassung aus 52 (alte Signatur `(uuid, boolean)` wird gelöscht). Zustimmen nur mit Version und Prüfsumme jedes geltenden Texts, den das Elternblatt zeigt; Beleg in derselben Transaktion. Der Auslöser `eltern_einwilligung_vermerken` ist gelöscht — Freigabe von Hand erzeugt keinen Beleg mehr. Clients (`gemeinsam/einwilligung.js` → `elternEntscheiden`) fallen ohne 106 auf die Fassung aus 52 zurück.

| Funktion public.einwilligung_entscheiden() | SUPABASE_SCHEMA_52_geburtsdatum.sql → SUPABASE_SCHEMA_106_einwilligung_fassung.sql |

**Gesamtreihenfolge der offenen Entwürfe:** 88 → 89 → 90 → 91 → 92 → 93 → 94 → 97 → 98 → 99 → 100 → 102 → 103 → 106.

## Nachtrag 01.11.2026: Codex-Funde F5, F7–F9 in Schema 102 (Entwurf)

- F5: `communities.moderiert_am`; moderatives Entfernen einer Community blendet aus statt zu löschen. Restriktive Regel `nicht_ausgeblendet` auf `communities`, `community_members`, `community_channels`, `community_beitrittsanfragen`, `community_channel_messages`, `ptt_messages`; Helfer `community_ausgeblendet(uuid)`, `kanal_ausgeblendet(uuid)`; `community_entfernte_loeschen()` (nur Moderatoren, nach 6 Monaten, kein Cron).
- F7: Entfernen einer Nachricht setzt `krypto = 0` (sonst `messages_krypto_stimmig`), Widerspruch stellt `krypto`, `absender_schluessel`, Anhang wieder her.
- F8: `meldung_vorbelegen` weist Selbstmeldungen ab; `meine_meldungen()` verbirgt zurückgestellte Begründungen bei Selbstbetroffenheit.
- F10 (02.11.): `community_entfernte_loeschen()` löscht erst 6 Monate nach der Mitteilung und nie bei zurückgestellter Begründung; `entscheidung_widersprechen` sperrt die Meldung (for update).
- F11 (02.11.): `posts.moderiert_am`, `comments.moderiert_am`; moderatives Entfernen von Beitrag/Kommentar blendet aus statt zu löschen (Kommentare, Antworten, Likes bleiben). Restriktive Regel `nicht_ausgeblendet` auf `posts`, `comments` (auch Kommentare am ausgeblendeten Beitrag und Antworten am ausgeblendeten Kommentar) und für INSERT auf `post_likes`, `comment_likes`, `saves`, `reposts`, `shares`, `sammlung_inhalte`, `sammlung_beitraege`, `post_tags`; Helfer `beitrag_ausgeblendet(uuid)`, `kommentar_ausgeblendet(uuid)`; `beitraege_entfernte_loeschen()` (Fristregeln wie F10). **Schema 92 ist live nicht eingespielt:** `kommentar_ausgeblendet` und die Regel auf `comments` entstehen ohne `reply_to`-Teil. **Nach dem Einspielen von 92 den F11-Block aus 102 erneut ausführen.**
- Probe `app/test/_probe_rs_funde.js` **76/76** (02.11., mit F11 und F12), `_probe102.js` 83/83, `_probe103.js` 27/27.

## Nachtrag 02.11.2026: 102 und 103 live eingespielt

`SUPABASE_SCHEMA_102_melden_moderation.sql` und `SUPABASE_SCHEMA_103_konto_loeschen_auskunft.sql` sind seit 02.11.2026 live (Henriks Ja). Danach zwei Korrekturen, in beiden Dateien nachgetragen und live eingespielt: F11-Helfer `beitrag_ausgeblendet`/`kommentar_ausgeblendet` und die Regeln `nicht_ausgeblendet` nur noch für `authenticated` (anon liest posts/comments nicht; test:rechte/test:angriffe schlugen an), `nummer_pfeffer` trägt `nur_freigegebene` (test:minderjaehrig). Danach test:rechte 281/281, test:angriffe 37/37, test:minderjaehrig grün, test:schema grün, Proben 102 83/83, 103 27/27, Funde 76/76.

**106 bewusst noch nicht live:** es löscht `einwilligung_entscheiden(uuid, boolean)`, das `main` (App `app/lib/registrierung.ts`, Website `web/public/anmeldung.js`) live aufruft — Elternfreigabe wäre bis zum Merge kaputt. 106 erst zusammen mit dem Merge von `kasten/rs-recht` nach `main` einspielen.

## Nachtrag 02.11.2026 (abends): Schema 106 live, Recht-Teile auf main

`SUPABASE_SCHEMA_106_einwilligung_fassung.sql` ist seit 02.11.2026 live — nach dem Push der Recht-Teile (`main` cce53c3, Render live), weil 106 die alte `einwilligung_entscheiden(uuid, boolean)` löscht. Prüfsumme `datenschutz` ist `73aa228acb1edf9d` (Bunny.net in der Datenschutzerklärung). `meine_daten()` (103) nimmt `einwilligungen` schon dynamisch auf — kein Nachtrag nötig. Probe 106 55/55, danach test:rechte 243/243, test:angriffe 37/37, test:minderjaehrig grün, test:schema grün, Funde 76/76, `_eltern_nummer` gegen die Live-Website 13/13.

**Folge:** Jedes Konto ohne Zustimmung (am 02.11. 15 Konten, alle von vor dem 24.10.) sieht beim nächsten Öffnen „Unsere Bedingungen“ und muss zustimmen. Prüf- und Testkonto (`all.media.prueflauf@web.de`, `test@all-media.app`) haben zugestimmt; neue Prüfkonten aus SQL ohne `pruefsumme_<dok>` in den Metadaten landen ebenfalls dort.

**Nicht auf main** (bleibt auf `kasten/rs-recht` bzw. im Sammelzweig): alle Kasten-28-Teile mit den Schemas 88–100. Wer 92 einspielt, muss danach den F11-Block aus 102 erneut ausführen.
## Nachtrag 10.10.2026: Schema 88 (Kasten 1.3, Seite „Profil bearbeiten“)

- `SUPABASE_SCHEMA_88_profilseite.sql` — **Entwurf, noch nicht eingespielt (Supabase-Sperre).**
  Neu `profiles.pronomen` (≤ 30 Zeichen, eine Zeile) und `profiles.links` (jsonb, ≤ 5 Einträge
  `{url, titel}`, url nur http/https), `profil_links_gueltig()` (Check), Trigger
  `profil_links_abgleichen` (hält `link` = erster Link; alte Schreiber von `link` ersetzen nur
  den ersten Eintrag), Spaltenrechte `select/update (pronomen, links)` an `authenticated`.
  `zuruecksetzen()` am Anker umgeschrieben (Testkonto: Pronomen und Links leer). Keine Funktion
  als Ganzes ersetzt. **Schema 23_audit erneut einspielen nimmt die Leserechte wieder weg —
  danach 88 nachziehen** (wie 30 und 69). App und Website laden die beiden Spalten getrennt und
  nachsichtig; ohne Schema 88 fehlen nur Pronomen und Zusatzlinks.

## Nachtrag 11.10.2026: Schemas 89–91 (Feedback 28.09., Kästen 4, 5, 8)

Alle drei sind **Entwürfe, noch nicht eingespielt (Supabase-Sperre).** Reihenfolge 89 → 90 → 91
(90 bricht ab, wenn 89 fehlt).

- `SUPABASE_SCHEMA_89_anrufe_ueberall.sql` — Anrufzustand `gestartet` (Dauer 0 erzwungen) auf
  `messages`; Anrufspalten auch auf `community_channel_messages`. Ersetzt die Bedingungen
  `messages_anruf_status_check` (aus 35) und `kanalnachricht_nicht_leer` (zuletzt 59).
- `SUPABASE_SCHEMA_90_push_to_talk.sql` — `community_members.ptt_benachrichtigung`,
  `community_channel_messages.ptt_sitzung`, `ptt_messages.sitzung_id`; Auslöser
  `ptt_sitzung_zuordnen` und `ptt_mitteilen` (EXECUTE entzogen); restriktive Regel
  „Sitzungszeile nur vom Ausloeser“. Ersetzt `notifications_art_check` (zuletzt 57),
  `notifications_target_type_check` (zuletzt 49) und `kanalnachricht_nicht_leer` (aus 89) —
  **gilt danach: 90.** Wer später eine Mitteilungsart ergänzt, übernimmt die Liste aus 90.
- `SUPABASE_SCHEMA_91_antworten_im_unterthema.sql` — `community_channel_messages.reply_to`
  (on delete set null) und restriktive Regel „Antwort nur im selben Unterthema“. Ersetzt nichts.

Code vor dem Schema: App (`daten.ts`) und Server (`supabase-api.js`) laden die Unterthema-
Zusatzspalten (`reply_to` | Anrufspalten | `ptt_sitzung`) gruppenweise nachsichtig — fehlt eine
Gruppe (42703), wird nur sie weggelassen.

## Nachtrag 12.10.2026: Schema 92 (Feedback 28.09., Nachtrag 4.3)

**Entwurf, noch nicht eingespielt (Supabase-Sperre).** Nach 89 → 90 → 91; setzt 62, 78, 86 voraus.

- `SUPABASE_SCHEMA_92_kommentar_antworten.sql` — `comments.reply_to` (Wurzel, on delete cascade),
  `comments.antwort_an` (angesprochener Kommentar, on delete set null), `stream_comments.reply_to`
  (on delete set null); restriktive Regeln „Antwort nur im selben Beitrag“ und „Live-Antwort nur im
  selben Stream“ (inkl. Blockieren); Auslöser `kommentar_bezug_fest`, `mitteilung_kommentar_antwort`,
  `mitteilung_weg_kommentar_antwort`. **Ersetzt `mitteilung_bei_kommentar()` (zuletzt 44) — gilt danach: 92.**
  Fasst `notifications_art_check`/`notifications_target_type_check` NICHT an (art 'comment' +
  target_type 'comment' stehen schon in der Liste aus 90) — Gewinner bleibt 90.

Code vor dem Schema: App (`daten.ts`, `aktionen.ts`) und Server (`supabase-api.js`, `sync-handlers.js`)
lesen/schreiben `reply_to`/`antwort_an` nachsichtig (`Kommentar.fehltSpalte`).

## Nachtrag 12.10.2026: Schemas 93–94 (Feedback 28.09., Kasten 7.5–7.8)

Beide **Entwürfe, noch nicht eingespielt.** Reihenfolge beliebig; 94 nach 87 (Anker).

- `SUPABASE_SCHEMA_93_geteilt_weg.sql` — `shared_post_weg`/`shared_post_konto` auf `messages` und
  `community_channel_messages`; Auslöser `geteilt_weg_merken` (BEFORE DELETE auf `posts`, security
  definer, EXECUTE entzogen) und `geteilt_weg_schuetzen` (Client kann den Merker nicht setzen).
  Ersetzt nichts. Block 5 (Nachtrag alter Nachrichten) auskommentiert, nur mit Henriks Freigabe.
- `SUPABASE_SCHEMA_94_kontaktbild.sql` — Tabelle `kontakt_bilder` (RLS nur Eigentümer, eine Regel je
  Befehl, `nur_freigegebene`, Check auf eigenen Eimer), `ist_messenger_kontakt(uuid)` (EXECUTE nur
  authenticated). `zuruecksetzen()` am Anker aus Schema 87 umgeschrieben (Testkonto: `kontakt_bilder`
  leeren). **Wer Schema 87 oder ältere zuruecksetzen-Fassungen neu einspielt, muss 94 nachziehen.**

Code vor dem Schema: App und Server laden Merker und Kontaktbilder getrennt und nachsichtig — ohne 93
keine Weg-Spur bei gelöschten Beiträgen, ohne 94 nur Profilbilder.

## Nachtrag 05.11.2026: Paket 1 (Kästen 28.09. 1–8) auf main-Stand ad7f221 übertragen

Abgleich der Schemas 88–94 gegen main (101–117) und den Live-Stand (nur lesend), Ergebnis je
Datei im Kopf. Wichtig beim Einspielen:

- **91:** liegt im Paket als `SUPABASE_SCHEMA_XX_antworten_im_unterthema.sql` — vor dem Einspielen
  in `SUPABASE_SCHEMA_91_antworten_im_unterthema.sql` umbenennen (Nummer seit 10.10. vergeben).
- **90:** `notifications_art_check`/`notifications_target_type_check` = Live-Liste + `ptt`/`channel`,
  keine Rückdrehung. Spätere Entwürfe (97/98, Paket 2) müssen `ptt`/`channel` mitnehmen.
- **92:** führt am Ende den F11-Block aus 102 (`kommentar_ausgeblendet`, Regel `nicht_ausgeblendet`
  auf `comments`) wortgleich erneut aus, jetzt mit `reply_to`; der Nachweis bricht ab, wenn der
  Antwort-Teil fehlt. Der Nachtrag „nach 92 den F11-Block aus 102 erneut ausführen“ ist damit erledigt.
- **94:** danach **Schema 117 erneut einspielen** (Medienreferenz-Prüfung auf `kontakt_bilder`).
  `ist_messenger_kontakt(uuid)` ist eine neue Überladung neben `ist_messenger_kontakt(uuid, uuid)` (68/102).

**Gesamtreihenfolge Paket 1:** 88 → 89 → 90 → 91 → 92 → 93 → 94 → 117 (erneut).
