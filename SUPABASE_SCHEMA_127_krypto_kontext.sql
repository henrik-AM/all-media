-- Paket 6, Opus-Gegenprüfung 15.11.2026: Format 2 bindet Inhalt an
-- Nachricht, Chat, Absender, Antwort/Zitat und mitverschlossene Sendezeit.
-- Format 1 bleibt für Bestandsnachrichten lesbar. Neue Clients benötigen
-- dieses Schema VOR ihrer Veröffentlichung. Keine neue Funktion/Policy.
begin;
alter table public.messages add column if not exists krypto_gesendet_am timestamptz;
alter table public.messages drop constraint if exists messages_krypto_stimmig;
alter table public.messages add constraint messages_krypto_stimmig check (
  (krypto = 0 and chiffre is null and krypto_nonce is null)
  or
  (krypto in (1, 2) and chiffre is not null and krypto_nonce is not null
   and absender_schluessel is not null and coalesce(text, '') = ''
   and (krypto = 1 or krypto_gesendet_am is not null))
) not valid;
alter table public.messages validate constraint messages_krypto_stimmig;
commit;
