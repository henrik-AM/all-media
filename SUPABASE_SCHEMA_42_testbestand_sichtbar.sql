-- ===========================================================================
--  Der Testbestand zeigte auf Beiträge, die niemand sehen darf
-- ===========================================================================
--
--  BEFUND (18.09.2026)
--
--  `starter_inhalte()` legt für jedes Konto eine Merkliste, einen Repost und
--  drei Likes an, „damit der Reiter Gespeichert nicht leer ist". Ausgewählt
--  wurden sie so:
--
--      where b.demo and b.user_id <> ziel
--
--  Also: Beispielbeiträge, die jemand anderem gehören. Genau die sind aber
--  unsichtbar. Die Leseregel auf `posts` lautet:
--
--      beitrag_sichtbar(besitzer, ist_test) =
--          not ist_test                                  -- kein Testbeitrag
--          or besitzer = auth.uid()                      -- meiner
--          or besitzer ist ein Demoprofil                -- Anna, Bob, …
--
--  `starter_inhalte()` läuft für JEDES echte Konto und legt ihm eigene
--  Testbeiträge an: `demo = true`, Besitzer aber ein echtes Profil, für das
--  `profiles.demo` false ist. Solche Beiträge sieht ausschließlich ihr
--  Besitzer. Nimmt die Merkliste nun „irgendeinen fremden Demobeitrag", greift
--  sie mit hoher Wahrscheinlichkeit in fremde Starterinhalte — und was dort
--  landet, kann das Konto hinterher nicht lesen.
--
--  GEMESSEN
--
--      saves:       2 Zeilen,  0 davon lesbar
--      reposts:     1 Zeile,   0 davon lesbar
--      post_likes:  3 Zeilen,  0 davon lesbar
--
--  Insgesamt: 25 Beiträge mit `demo = true` gehören einem Nicht-Demoprofil,
--  18 gehören einem Demoprofil.
--
--  WAS DAS BEDEUTET
--
--  Die Reiter „Gespeichert" und „Reposts" waren nicht leer, weil die Anzeige
--  fehlte — sie waren leer, weil die Datenbank dem Konto die Antwort
--  verweigerte, und zwar zu Recht. Henrik hat beide als „wird nicht
--  synchronisiert" gemeldet. Gespeichert WAR synchronisiert. Sichtbar war es
--  nie.
--
--  Das ist der unangenehmste Fehlertyp in diesem Projekt: die Einfügung
--  gelingt, die Abfrage gelingt, sie liefert nur nichts. Nirgends steht ein
--  Fehler.
--
--  DIE KORREKTUR
--
--  Die Auswahl greift nur noch zu Beiträgen, deren Besitzer ein Demoprofil
--  ist — Anna, Bob und die übrigen Beispielleute. Die sind für jeden sichtbar,
--  und genau dafür gibt es sie.
--
--  Einspielen:
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      SUPABASE_SCHEMA_42_testbestand_sichtbar.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  1. Die drei Auswahlen in starter_inhalte() berichtigen
--
--  Nicht die ganze Funktion neu schreiben: sie ist über 200 Zeilen lang, und
--  eine Kopie davon in dieser Datei wäre die zweite Stelle, an der sie steht.
--  Stattdessen werden hier nur die falsch ausgewählten Zeilen ERSETZT, und
--  zwar für jedes vorhandene Konto. Die Funktion selbst wird in
--  SUPABASE_SCHEMA_7_testkonto.sql berichtigt, wo sie hingehört.
-- ---------------------------------------------------------------------------

-- Merkliste: unlesbare Einträge weg …
delete from public.saves s
 where exists (
   select 1 from public.posts b
    where b.id = s.post_id
      and b.demo
      and b.user_id <> s.user_id
      and not exists (select 1 from public.profiles p where p.id = b.user_id and p.demo)
 );

-- … und durch zwei sichtbare ersetzen.
insert into public.saves (user_id, post_id)
select z.id, b.id
  from public.profiles z
  cross join lateral (
    select b.id
      from public.posts b
      join public.profiles p on p.id = b.user_id
     where b.demo and p.demo and b.user_id <> z.id
     order by b.created_at desc
     limit 2
  ) b
 where not z.demo
on conflict do nothing;


-- Repost: dasselbe, nur ein Reel.
delete from public.reposts r
 where exists (
   select 1 from public.posts b
    where b.id = r.post_id
      and b.demo
      and b.user_id <> r.user_id
      and not exists (select 1 from public.profiles p where p.id = b.user_id and p.demo)
 );

insert into public.reposts (user_id, post_id)
select z.id, b.id
  from public.profiles z
  cross join lateral (
    select b.id
      from public.posts b
      join public.profiles p on p.id = b.user_id
     where b.demo and p.demo and b.user_id <> z.id and b.kind = 'reel'
     order by b.created_at desc
     limit 1
  ) b
 where not z.demo
on conflict do nothing;


-- Likes: drei sichtbare.
delete from public.post_likes l
 where exists (
   select 1 from public.posts b
    where b.id = l.post_id
      and b.demo
      and b.user_id <> l.user_id
      and not exists (select 1 from public.profiles p where p.id = b.user_id and p.demo)
 );

insert into public.post_likes (user_id, post_id)
select z.id, b.id
  from public.profiles z
  cross join lateral (
    select b.id
      from public.posts b
      join public.profiles p on p.id = b.user_id
     where b.demo and p.demo and b.user_id <> z.id
     order by b.created_at desc
     limit 3
  ) b
 where not z.demo
on conflict do nothing;
