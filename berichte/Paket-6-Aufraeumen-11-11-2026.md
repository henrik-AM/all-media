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
