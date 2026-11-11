# Paket 6 – Aufräumfortsetzung 11.11.2026 nachmittags

Aktueller main-Stand ee11974 im eigenen Zweig übernommen (Merge 368f338).
Drei unabhängige Unteragenten prüften Krypto, Nebenwege und Prüfharness.

## Korrigiert und nachgewiesen

- App und Browser: Abbruch zwischen Geheimschlüssel- und Gerätekennungsschreiben verlor die Altgerätekennung. Migration ergänzt jetzt nur bei gleichem Altgeheimnis das fehlende Gerät; unabhängige Schlüssel bleiben erhalten. Regression 4/4 Szenarien, jeweils alte Chiffre tatsächlich entschlüsselt.
- App-Weiterleitung: Ein ungültiges späteres Ziel erzeugte bereits Nachrichten an frühere Ziele. Jetzt alle Kryptopakete vor erstem INSERT planen. Regression 3/3, darunter zwei negative Gegenproben und entschlüsselbare unterschiedliche Chiffren für gültige Ziele. Mehrere Schreibrequests bleiben bei späterem Datenbankfehler nicht atomar.
- Offlineabnahme nach Korrekturen 9/9 Gruppen; Browser 26/26. Kein Livezugriff in diesem Abschnitt. AST-Graph lokal aktualisiert, kein LLM-Aufruf.

## Neue offene Befunde

- Kontakt mit optionaler Nachricht kann bei Sende-/Kryptofehler bereits gespeichert sein; Wiederholung wird als schon vorhanden abgelehnt (App und Server). Reproduziert offline; noch keine Kompensation implementiert.
- Prüfharness: Signalexit kann Erfolg melden; native Recovery liest falsches Journal; früher Abbruch ohne Chat-ID wird nicht bereinigt; Kontaktbaseline bisher nur im RAM. Korrekturen in Vorbereitung.
- Erweiterte Live-/native Abnahme, Nebenwege, Angriffe und vollständiger Gesamtlauf bleiben offen; siehe Paket-6-Fortsetzung-11-11-2026.md.

Kein Schema, main-Schreiben, Push oder Deploy. Sicherungszweig unverändert.

## Prüfharness korrigiert

Signalbeendigung zählt als Fehler; Live/native Journalwahl getrennt; Chat-ID darf vor Anlage fehlen. Kontakt-/Gerätebaseline vor erster Mutation persistent, Journaltausch atomar; fehlende Baseline verhindert Kontaktlöschung und Rest0. Nachricht-IDs vor Löschen persistiert; Kuverts explizit nachgezählt. Unbekannte Neugeräte bleiben unangetastet, verhindern aber Rest0. Fremde Konten verweigert. Regression 8/8 offline. Unregistrierte Absenderprobe zählt beliebige Insertfehler nicht mehr als Erfolg.

Restgrenzen: Chat-Anlage kann bei verlorener Antwort vor Journal ein nicht erfasstes Objekt erzeugen. Kein atomarer DB/Dateijournal-Vorgang. Kontakt+Nachricht braucht Vorgangskennung und atomaren RPC; AddContactSheet blockiert vorhandene Kontakte selbst und leert Entwurf bisher früh.

## Frisch live am 11.11.2026, 16:02–16:05 MEZ

- Zwei-Konten-Rundreise 29/29 mit echten Browsern/Supabase und App-Logik mit simuliertem Schlüsselbund. Vier Sende-/Leserichtungen, Chiffren/Kuverts, Klartextabwehr, A/B/A, Browser-Neuladen, Gerätenummern und reale Neuregistrierung/-entfernung nach zwei regulären Cachefristen bestanden. Geprüfter Rest 0 einschließlich Kuverts, Geräte und Kontakte. Journal live-fixtures.json. Keine vollständige native App-Abnahme.
- Angriffe 60/60, Prozess Exit0. Anschließend 167 Testmitteilungen entfernt, gegengeprüfter Rest0 für beide erlaubten Testkonten. Log live-_angriffe.log.
- Zweiter App-Migrationsfehler gefunden: kontenspeicher schluckte Lesefehler/kaputtes JSON und löschte Altpaare ohne weitere Konten zu migrieren. Migration liest jetzt streng; normale UI bleibt fehlertolerant. Vier echte Modulgegenproben bestanden, alte Chiffren beider Konten nach Wiederholung lesbar. Offlinegruppen erneut 9/9. Browseranalogie wird separat geprüft.
- Gesamtlaufinventar um Regressionen und Quellwächter für native UI ergänzt; noch nicht vollständig ausgeführt.

Browseranalog ebenfalls korrigiert: Anmeldung.konten({streng:true}) verweigert Speicher-/JSON-/Strukturfehler, bevor globale Altpaare gelöscht werden. Vier Gegenproben mit echtem anmeldung.js/krypto.js und tatsächlich gelesenen alten Chiffren bestanden. Migration/Weiterleitung/Harness/Kontenlisten zusammen 23/23 neue Gegenproben. Gesamtlaufinventar jetzt 94 Läufe.
