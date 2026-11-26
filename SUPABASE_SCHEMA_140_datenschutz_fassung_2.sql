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
-- Prüfkonten (ist_testkonto, Schema 62) bekommen die Kenntnisnahme von
-- Fassung 2 nachgetragen, wenn sie Fassung 1 schon zur Kenntnis genommen
-- hatten — sonst stünde jeder Prüflauf und der Prüfsimulator nach dem
-- Einspielen vor dem Bildschirm „Neue Bedingungen" (NeueBedingungen.tsx,
-- bedingungenPruefen in app.js). Echte Konten bekommen NICHTS nachgetragen:
-- sie sehen die neue Fassung und nehmen sie selbst zur Kenntnis.
--
-- Legt keine Tabelle und keine Funktion an → keine Rechte, kein
-- nur_freigegebene nötig.
-- =====================================================================

insert into public.rechtstext_fassungen (dokument, version, pruefsumme, art, gilt_ab) values
  ('datenschutz',           2, 'a7db2a57546301dc', 'kenntnis',   '2026-11-26')
on conflict (dokument, version) do nothing;

insert into public.einwilligungen (user_id, dokument, version, pruefsumme, art, durch, quelle)
select e.user_id, f.dokument, f.version, f.pruefsumme, f.art, e.user_id, 'altbestand'
  from public.einwilligungen e
  join public.rechtstext_fassungen f on f.dokument = 'datenschutz' and f.version = 2
 where e.dokument = 'datenschutz' and e.version = 1 and e.art = 'kenntnis'
   and public.ist_testkonto(e.user_id)
   and not exists (select 1 from public.einwilligungen x
                    where x.user_id = e.user_id and x.dokument = 'datenschutz' and x.version = 2)
 group by e.user_id, f.dokument, f.version, f.pruefsumme, f.art;
