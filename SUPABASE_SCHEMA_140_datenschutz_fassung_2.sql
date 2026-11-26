-- =====================================================================
-- SUPABASE_SCHEMA_140_datenschutz_fassung_2.sql — 26.11.2026
--
-- Auftrag Henrik 26.11.2026: SMTP/Captcha lösen (Fahrplan Mail-Captcha,
-- Schritt C7). Die Datenschutzerklärung nennt jetzt Cloudflare Turnstile
-- (Sicherheitsprüfung bei Registrierung, Anmeldung, Passwort vergessen).
--
-- Neue Fassung = neue Zeile, nie überschreiben (Schema 106). Prüfsumme =
-- erste 16 Hex-Zeichen sha256(Rechtstexte.alsText('datenschutz')), wie
-- test:recht. Nach 106.
--
-- Wirkung: geltende_fassung('datenschutz') liefert ab Einspielen Fassung 2.
-- Bestehende Konten sehen sie über zustimmung_offen() zur Kenntnis.
-- Einspielen zusammen mit dem Ausliefern des neuen Texts (App + Website),
-- sonst passen Registrierungs-Metadaten und geltende Fassung nicht.
--
-- Legt keine Tabelle und keine Funktion an → keine Rechte, kein
-- nur_freigegebene nötig.
-- =====================================================================

insert into public.rechtstext_fassungen (dokument, version, pruefsumme, art, gilt_ab) values
  ('datenschutz',           2, 'a7db2a57546301dc', 'kenntnis',   '2026-11-26')
on conflict (dokument, version) do nothing;
