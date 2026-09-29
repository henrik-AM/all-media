-- ===========================================================================
-- Schema 71 (Entwurf): Stand eines Spendenziels (29.09.2026, Kasten 12.3)
-- ===========================================================================
--
-- WORUM ES GEHT
--
-- Henrik am 21.09.2026: „Spendenziel lässt sich antippen, zeigt aber keine
-- genaueren Daten."
--
-- Befund: Das Spendenziel (`profiles.spende`, JSON-Text) trägt `gesammelt`,
-- das beim Anlegen 0 ist und nie wieder angefasst wurde. Die echten
-- Spenden liegen in `donations` — und die sind (zu Recht) nur für Sender
-- und Empfänger lesbar. Ein Besucher des Profils kann den Stand also nicht
-- selbst ausrechnen.
--
-- NEU
--
--   spendenstand(p_empfaenger, p_seit) → (summe_cent, spender)
--
-- Liefert nur die Summe und die Zahl verschiedener Spender seit dem
-- Zeitpunkt, an dem das Ziel angelegt wurde — keine Namen, keine
-- Einzelbeträge, keine Nachrichten. Das ist genau das, was eine öffentliche
-- Spendenkarte zeigt (wie bei GoFundMe oder betterplace).
--
-- Die Rechnung „Startwert + Summe, Prozent, Frist" steht in
-- gemeinsam/spende.js (stand()), einmal für App und Website.
--
-- RECHTE
--
-- security definer, weil `donations` sonst nur für die Beteiligten lesbar
-- ist. Nur für angemeldete Nutzer; Postgres gibt EXECUTE an eine neue
-- Funktion automatisch an PUBLIC, darum das revoke.
--
-- Wer das Profil nicht sehen darf (privat, blockiert), sieht auch das
-- Spendenziel nicht — die Karte hängt an `profiles.spende`, das die
-- bestehenden Regeln schon filtern. Die Summe allein verrät darüber hinaus
-- nichts. Trotzdem gibt die Funktion für ein Konto OHNE Spendenziel nichts
-- heraus (null, 0), damit sie kein allgemeines „wie viel bekommt X"-Orakel
-- wird.
--
-- Alles idempotent.
-- ===========================================================================

create or replace function public.spendenstand(p_empfaenger uuid, p_seit timestamptz default null)
returns table (summe_cent bigint, spender integer)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(d.betrag_cent), 0)::bigint,
         count(distinct d.sender_id)::integer
    from public.donations d
   where d.empfaenger_id = p_empfaenger
     and (p_seit is null or d.created_at >= p_seit)
     and exists (
       select 1 from public.profiles p
        where p.id = p_empfaenger
          and p.spende is not null
          and p.spende <> ''
     );
$$;

revoke execute on function public.spendenstand(uuid, timestamptz) from public, anon;
grant execute on function public.spendenstand(uuid, timestamptz) to authenticated;
