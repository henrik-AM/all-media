# Bunny-App-Prüfung 28.10.2026

Gerät: All-Media Test, 5453D173-7080-4986-8A0D-B0765EDC1841.
Basis 6d2ba60; Produktion https://all-media-website.onrender.com.
Testkonto test@all-media.app. Simulator/Testbestand/Metro 8081 belegt.

Vorbereitung: fehlende node_modules und .env.local auf vorhandenen Bunny-Live-Worktree verknüpft.
Installierte Expo-Fassung 57.0.22 (package.json ~57.0.16), React Native 0.86.2.
Metro --localhost bindet auf diesem Mac nur IPv6; Werkzeuge erwarten 127.0.0.1.
Deshalb --lan mit REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1.
Prüfstatus und Bildbeschreibungen folgen. Keine Tokens in Belegen.

Abnahme: 01/04 Altbild und Altvideo; 12 tatsächlicher Uploadfehler ohne neuen Datensatz;
13 Bild nach erfolgreicher Wiederholung; 17/18 MP4 mit echtem Fortschritt 0:00 → 0:03/0:04;
19/20 Altmedien im Profilraster. 08/11 sind frühe Versuche mit altem App-Code, keine Fix-Abnahme.
14 und 15 sind verworfene Diagnose-/MOV-Fehlversuche, kein Veröffentlichungserfolg.
api.jsonl enthält nur IDs, Pfade, Host, Status und Zählungen, keine Signaturen.
app-medien-host.txt enthält nur aus echten App-Props gelesene Hosts/Endungen und Playerwerte.

UI-Bedienung: mac:tippen sucht Beschriftungen. Bei fehlendem AXe-Baum oder nativer Fotoauswahl
half XCTest (Quellen unter bedienung/). Ausschließlich Zielgerät 5453D173-7080-4986-8A0D-B0765EDC1841.
Beispiel: xcodebuild test -project pruefbelege/bunny-app/bedienung/BunnyUI.xcodeproj -scheme BunnyUI
-destination 'platform=iOS Simulator,id=5453D173-7080-4986-8A0D-B0765EDC1841'
-derivedDataPath .scratch/bunny-ui -parallel-testing-enabled NO.
TEST_RUNNER_BUNNY_UI_LABEL wählt einen exakt beschrifteten Knopf, BUNNY_UI_TYP=image eine Aufnahme;
BUNNY_UI_ANZAHL/INDEX sichern mehrfache Treffer ab. BUNNY_UI_TEXT schreibt in das eindeutig geprüfte
Textfeld; BUNNY_UI_FELD=kurz für Videotitel. Systemdialoge nur mit BUNNY_UI_SYSTEM=1 (SpringBoard).
Diese Kennungen jeweils mit TEST_RUNNER_ voran an xcodebuild übergeben. Kein Tippen auf freie Koordinaten.

Löschprobe: Begleitprobe interaktiv starten, 'vorher' hält beide Signaturen ausschließlich im RAM;
zweiter Aufruf mit --loeschen entfernt genau zwei vollständige eigene datierte Prüfbeiträge;
'nachher' im ersten Prozess prüft dieselben URLs auf 404 und Bestand auf Ausgangswert.

Abschluss: 21 Feed ohne Testbild; 22 Profilzahl 5 und TN-Avatar; 23 fünf Bestandskacheln;
24 Querformat ohne Testvideo. Alle angesehen. 2/2 zuvor signierte Medienadressen nach Löschen 404,
Bestand wieder 5/5, datierte Prüfbeiträge 0. Letzter Offline-Regressionslauf 12/12, tsc und Website-Syntax grün.
14-diagnosefehler.png, 15-mov-abgelehnt.png und 16-fotorechte.png sind eindeutig benannte Zwischenbelege.
