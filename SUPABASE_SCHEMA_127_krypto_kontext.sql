-- Paket 6, Opus-Gegenprüfung 15.11.2026: Format 2 bindet Inhalt an
-- Nachricht, Chat, Absender, Antwort/Zitat und mitverschlossene Sendezeit.
-- Format 1 bleibt für Bestandsnachrichten lesbar. Neue Clients benötigen
-- dieses Schema VOR ihrer Veröffentlichung. Kein neuer Datenzugriff.
begin;
alter table public.messages add column if not exists krypto_gesendet_am timestamptz;
alter table public.messages drop constraint if exists messages_krypto_stimmig;
alter table public.messages add constraint messages_krypto_stimmig check (
  (krypto = 0 and chiffre is null and krypto_nonce is null)
  or
  (krypto in (1, 2) and chiffre is not null and krypto_nonce is not null
   and absender_schluessel is not null and coalesce(text, '') = ''
   and (krypto = 1 or (krypto_gesendet_am is not null and created_at is not null
        and krypto_gesendet_am between created_at - interval '5 minutes' and created_at + interval '5 minutes')))
) not valid;
alter table public.messages validate constraint messages_krypto_stimmig;
-- Bereits gespeicherte Sendezeiten sind unveränderlich, auch bei direktem REST.
create or replace function public.krypto_zeit_fest()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.krypto_gesendet_am is distinct from old.krypto_gesendet_am then
    raise exception 'Die Sendezeit einer gespeicherten Nachricht ist unveränderlich'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.krypto_zeit_fest() from public, anon, authenticated;
drop trigger if exists krypto_zeit_fest on public.messages;
create trigger krypto_zeit_fest before update of krypto_gesendet_am on public.messages
  for each row execute function public.krypto_zeit_fest();
commit;
