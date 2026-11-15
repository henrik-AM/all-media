# Paket 7 — Chat-Klingel, 15.11.2026

Basis: main 627fa86. Auftrag Henrik: nächstes Paket des Aufräumplans.
Eigenzweig codex/paket-7-chatklingel-2026-11-15, kein main/Push/Deploy.

Aus 86814b5 und 2892690 ausschließlich Paket-7-Inhalt übertragen.
Konflikte gegen aktuelle Krypto-/Chatoptionen-Fassung zusammengeführt;
Kuvertstand und Generationenschutz bleiben erhalten. Reaktionen im Stand
werden bei Lesefehlern nicht als leer bestätigt.

Projektversionen package.json: Expo ~58.0.24 (Lock 58.0.25), RN 0.88.1,
Supabase JS App ^2.112.4, Website ^2.43.0. Context7 vor Code gelesen
(Supabase private Broadcast, realtime.messages, realtime.send).

Vorprüfung: TypeScript Exit 0, Chatklingel 24/24 offline.
Egress-Bestandstest 21/23: zwei App-Feed-Renderer-Proben rot
(Wischen/Hintergrund); vor Bewertung auf unverändertem main gegenprüfen.
Noch offen: Review/Live-Schema, Sicherheitsläufe, Zwei-Konten-Browser-/native
Abnahme, Egress-Messung, Bereinigung und Gesamtregression.

## Live-Schema und Review

Schema 100 am 15.11. eingespielt, nach verworfener Probe 22/22.
Gegengelesen: 12 Auslöser, 1 Empfangsregel, 0 Veröffentlichungstabellen,
5 Realtime-Tagespartitionen. Keine Altdatei erneut ausgeführt.
Rechte 299/299, Angriffe 60/60, Schema-Lauf grün.
Egress-Renderer-Bestand auf unverändertem main ebenfalls 21/23, identische
zwei Fehler; kein neu eingeführter Paket-7-Fehler behauptet.
Browserattrappe 8/8, Nachricht 266 ms nach Klingel; Screenshot angesehen.
Paket-6-Kuvert-/Generationsregression 17/17 nach Ergänzen der neuen
Klingelabhängigkeiten in den isolierten Prüfkontexten.

Reviewkorrekturen: Klingel-Bündelung kann bei Dauersignalen nicht mehr
endlos aufgeschoben werden; fehlerhafte Abo-Anlage räumt auf. Chatlisten
bestätigen den Stand erst nach erfolgreichem Nachladen, auch beim Erststart;
Website bündelt parallele Listenabrufe und prüft Konto/Generation.
Unterthema aktualisiert sich trotz Eingabe und erhält Text/Fokus/Auswahl.

## Echte Klingelprüfung und Browserfund

Direkte Zwei-Konten-Prüfung **39/39**: Zweier-/Gruppenchat, Insert,
Bearbeiten/Zurücknehmen/Delete, Reaktion hinzufügen/ändern/löschen,
Lesebestätigung, eigene Liste, Wiederverbinden, fremde/anonyme Kanäle,
Rechteentzug und unveröffentlichte Tabellen. Messung ab Schreibbeginn.
Kontakt-/Lesebestätigungs-Grundstand wiederhergestellt, eigene Chatfixtures Rest0.
Der alte Live-Test las erst nach Zurücknahme, sodass chat_gelesen rechtmäßig
nichts bestätigte. Neuer Test liest vorher und prüft den gespeicherten Wert.

Echte Website zeigte zuerst Polling statt Klingel: Browserbibliothek 2.47.10
trat trotz Anmeldung ohne wirksames Realtime-Token bei (eigene private
Nutzerkanäle „Unauthorized“). Vor Subscribe jetzt getSession + setAuth,
bei Tokenauffrischung ebenfalls setAuth. Danach Nutzer-/Chatkanäle
nachweislich SUBSCRIBED. Offline-Gegenproben inzwischen **8/8**;
Website-Rundreise, Egress-Ruhemessung und native Komponentenabnahme laufen.
Die bisherige Website-Gesamtzeit inklusive Krypto-Vorbereitung liegt bei
2,6–2,9 s für Chiffren, 1,6 s für Gruppen; Empfangszeit getrennt messen.

## Kuvert-Klingel und Drosselung

Schema 100 ergänzt nach neuer Probe **25/25** einen INSERT-Auslöser auf
message_keys. Live gegengelesen: **13 Auslöser**, Realtime-Veröffentlichung 0,
authenticated darf chat_klingel_kuvert nicht aufrufen. Kuvert-Signale gehen
an Chat und betroffene Empfängerlisten, ohne Schlüssel-/Nachrichteninhalt.
Fehlende Kuverts behalten den bisherigen 4-s-Rückweg; Listen laden beim
Kuvertsignal trotz identischer Message-ID neu. Hintergrundsignale bleiben
als unbestätigte Version bis zum erfolgreichen Abruf erhalten.

Zusätzliche Regressionen **9/9**, kombiniert mit Paket-6-Gegenproben zuvor
25/25 (vor der neunten Zusatzprobe); Unterthema mit Entwurf/Fokus/Auswahl
**4/4**, Screenshot vorhanden. AST-Graph aktualisiert (keine LLM-Abfrage).
Echte Website-Phase **10/10**: beide Richtungen, Chiffre/Gruppe, Liste,
65-s-Ruhemessung je Konto **2 Chatstand + 1 Listenstand** statt etwa16+6.
Empfang nun per DOM-Mutationszeit ab DB-Speicherung gemessen; Gesamtzeit
inklusive Vorbereitung ist separat und kein Ersatz für Klingellatenz.
Native Abschlussrunde mit absichtlich späterem Kuvert steht noch aus.

## Messgrenzen der nativen Runde

Original-ChatDetailScreen zweimal unter getrennten Konto-Kontexten montiert,
echte Supabase-Sitzungen und native SecureStore-Geräte. Die Sicht wechselt,
die jeweils andere Komponente bleibt aktiv. Das belegt App↔App auf zwei
nativen Komponenteninstanzen, nicht zwei getrennte physische Telefone.
Die Startseiten-/Profil-/Einstellungskontexte sind Test-Rahmen, kein Produktlogin.
Vor der nativen Geräteanmeldung versandte Website-Chiffren sind auf diesen
neuen Geräten absichtlich unlesbar; geprüft werden ausschließlich neue
Nachrichten nach Geräteanmeldung mit eindeutiger Rundenkennung.
Native→Website wird ab DB-created_at bis zur ersten DOM-Mutation gemessen;
AXe-Bedien- und Erkennungszeiten gehören nicht zur Datenbank-Klingellatenz.

## Native Abschlussabnahme

**14/14 native UI-Prüfungen**, **16/16 Plattform-/Backendprüfungen**,
beide Prozesse Exit0, eigene Chat-/Nachrichten-/Gerätefixtures **Rest0**.
App↔App, App↔Website und Website↔Website: Zweierchat verschlüsselt,
Gruppe Klartext; drei Sekunden absichtlich zurückgehaltenes Kuvert heilt
nach eigener Kuvert-Klingel; im Hintergrund gesendete Nachricht nach
Rückkehr ohne Chat-Neuöffnung sichtbar. Neue native Texte mit Rundenkennung
771917 geprüft; Bilder für Chiffre, Gruppe, Kuvert, Hintergrund angesehen.
Native→Website rund1,25–2,09s ab Datenbankspeicherung bis DOM-Anzeige.
Eigene native Instanzen beendet, Simulator ausgeschaltet, Metro beendet.

Vollständiger Bestandslauf jetzt auf festem Code; Ergebnis noch offen.

Erster Gesamtlauf nach3/100 kontrolliert beendet: smoke ist historisch
fest auf localhost3000 verdrahtet und konnte nur3300 nicht nutzen.
Keine Produktfehlermeldung; 32 eigene Testmitteilungen bereinigt, Rest0.
Port3000 exklusiv belegt, identischer eigener Worktree-Server zusätzlich
gestartet; vollständige Wiederholung ohne Änderung des Prüf- oder Produktcodes.
