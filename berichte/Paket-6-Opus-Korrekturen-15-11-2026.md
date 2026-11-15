# Paket 6 – Behebung der Opus-Befunde

Auftrag 15.11.: vier Befunde aus Opus-Prüfung beheben. Zielbasis 627fa86, eigener Zweig `codex/paket6-claude-review-2026-11-15`.

F1: Gemeinsame Sicherheitsnummer bindet beide Konten und vollständige Geräteschlüsselmengen. Beide Kontaktinfos zeigen dieselbe Referenz; Text benennt den Vergleichsweg und Grenzen.
F3: App und Website-Server prüfen vor dem Bearbeiten einer Klartext-Altnachricht den aktuellen Sendeweg. Erfordert der Chat inzwischen Verschlüsselung, wird ohne Schreiben abgelehnt. Neue Nachricht senden bleibt möglich.
Prüfung: neue Offline-Gegenproben 3/3. Ursprünglicher Opus-Klartextnachweis scheitert nach der Korrektur wie erwartet am angenommenen Bearbeiten und am Klartext-Update.

Noch in Arbeit: F2 bestätigte Altschlüsselzuordnung und F4 Nachrichtenkontextbindung (neues Format, Schema 127 nach Prüfung sämtlicher Zweige frei). Testbestand/Schema weiterhin durch Paket 7 belegt: keine Liveprüfung, keine Veröffentlichung.

F2 umgesetzt: Altfach bleibt erhalten; Übernahme ausschließlich bei bereits registrierter Übereinstimmung von Konto und öffentlichem Schlüssel, mit Wiederverwendung der historischen Gerätekennung. Ein gerade abgemeldetes Konto wird bei späterer Anmeldung berücksichtigt. Bereits gelöschtes Altfach lässt sich aus erhaltenen Fächern gespeicherter Konten wiederherstellen, weiterhin nur bei bestätigter Kontozuordnung. Fehlt jede lokale Kopie, lässt sich ein geheimer Schlüssel nicht nachträglich rekonstruieren. Neue Konten erhalten eigene Paare. Neue Gegenproben jetzt 7/7, TypeScript Exit 0. Kein Livezugriff.

F4 implementiert: Format 2 verschließt Nachrichten-ID, Chat-ID, Absender-ID, Antwort-/Zitatbezug sowie Sendezeit gemeinsam mit dem Text. App und Browser erzeugen die ID vor dem Verschließen; sämtliche Website-Schreibwege reichen sie durch. Abweichende Identität/Bezug/Zeit oder ein Versions-Downgrade sind unlesbar. Bearbeiten erhält den Kontext und prüft die alte Chiffre. Format 1 bleibt lesbar mit Absenderwarnung, weil dessen Kontext nachträglich nicht belegbar ist. Meldebelege unterstützen beide Fassungen.
Schema 127 ergänzt die verschlossene Sendezeit und erweitert nur die bestehende Konsistenzbedingung. Bestandsclients verstehen Format 2 nicht; Schema muss vor neuer App/Website angewendet werden, alte Clients müssen aktualisiert werden. Code daher noch nicht veröffentlichen.
Offline jetzt 52/52 Testfälle aus fünf Gruppen; App18/18, Web16/16, Rechnung36/36, Server18/18, Meldebelege105/105; TypeScript Exit0; statischer Schematest grün. Browserprüfung und SQL-Probe noch in Arbeit.

Verifikation ergänzt: vollständiges Offline-Prüfskript10/10 Gruppen (einschließlich neuer Opus-Gegenproben und TypeScript/Syntax), zusätzliche Kuvert-/Chatgeneration-/Weiterleitungsgruppen zusammen52/52, Browser26/26. Browserbilder angesehen; sichtbare Absenderwarnung und Sendesperre. Lokale PGlite-PostgreSQL-Probe10/10: Migration wiederholbar, Rollback rückstandsfrei, bestehende Zeilen und ACL erhalten, Format2 zulässig, ungültige Formen und anonyme Leser abgewiesen. PGlite ausschließlich im Sitzungstemp installiert, keine Produktabhängigkeit. Grenzen: Minimalmodell der messages-Tabelle, keine behauptete Live-RLS-Abnahme. Opus-Nachprüfung läuft read-only in derselben Prüfersitzung, ausdrücklich Modell opus.
