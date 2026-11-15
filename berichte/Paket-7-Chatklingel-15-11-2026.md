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
