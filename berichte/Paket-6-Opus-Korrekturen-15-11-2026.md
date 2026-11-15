# Paket 6 – Behebung der Opus-Befunde

Auftrag 15.11.: vier Befunde aus Opus-Prüfung beheben. Zielbasis 627fa86, eigener Zweig `codex/paket6-claude-review-2026-11-15`.

F1: Gemeinsame Sicherheitsnummer bindet beide Konten und vollständige Geräteschlüsselmengen. Beide Kontaktinfos zeigen dieselbe Referenz; Text benennt den Vergleichsweg und Grenzen.
F3: App und Website-Server prüfen vor dem Bearbeiten einer Klartext-Altnachricht den aktuellen Sendeweg. Erfordert der Chat inzwischen Verschlüsselung, wird ohne Schreiben abgelehnt. Neue Nachricht senden bleibt möglich.
Prüfung: neue Offline-Gegenproben 3/3. Ursprünglicher Opus-Klartextnachweis scheitert nach der Korrektur wie erwartet am angenommenen Bearbeiten und am Klartext-Update.

Noch in Arbeit: F2 bestätigte Altschlüsselzuordnung und F4 Nachrichtenkontextbindung (neues Format, Schema 127 nach Prüfung sämtlicher Zweige frei). Testbestand/Schema weiterhin durch Paket 7 belegt: keine Liveprüfung, keine Veröffentlichung.

F2 umgesetzt: Altfach bleibt erhalten; Übernahme ausschließlich bei bereits registrierter Übereinstimmung von Konto und öffentlichem Schlüssel, mit Wiederverwendung der historischen Gerätekennung. Ein gerade abgemeldetes Konto wird bei späterer Anmeldung berücksichtigt. Bereits gelöschtes Altfach lässt sich aus erhaltenen Fächern gespeicherter Konten wiederherstellen, weiterhin nur bei bestätigter Kontozuordnung. Fehlt jede lokale Kopie, lässt sich ein geheimer Schlüssel nicht nachträglich rekonstruieren. Neue Konten erhalten eigene Paare. Neue Gegenproben jetzt 7/7, TypeScript Exit 0. Kein Livezugriff.
