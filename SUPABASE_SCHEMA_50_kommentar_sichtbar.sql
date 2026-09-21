-- ===========================================================================
--  Schema 50 — der Testkommentar hing an einem unsichtbaren Beitrag
--  21.09.2026
-- ===========================================================================
--
--  BEFUND
--
--  Henrik am 18.09.2026: „Likes, Kommentare, Reposts, Gespeicherte Beiträge
--  werden nicht synchronisiert (unter Videos/Profil kann ich sie nicht
--  sehen)." Merkliste, Repost und Likes hat Schema 42 an diesem Tag
--  berichtigt — die Kommentare blieben liegen, weil es für sie damals noch
--  gar keine Ansicht gab.
--
--  `starter_inhalte()` wählte den Beitrag für den Testkommentar so:
--
--      where b.demo and b.user_id <> ziel
--
--  Das ist genau die Bedingung aus Befund 4 vom 18.09. `demo = true` haben
--  auch die Starterbeiträge jedes echten Kontos; deren Besitzer ist aber kein
--  Demoprofil, und `beitrag_sichtbar()` verbirgt sie vor allen außer ihrem
--  Besitzer. Der Kommentar lag also in der Tabelle und sein eigener Verfasser
--  bekam ihn nicht zu sehen.
--
--  Gemessen am 21.09.2026 für test@all-media.app, direkt über PostgREST:
--
--      eigene Kommentarzeilen: 1
--      dazugehöriger Beitrag lesbar: false
--
--  Eine Liste „Meine Kommentare" wäre damit leer gewesen, obwohl die Zeile
--  existiert — dieselbe Form von Fehler, die Henrik gemeldet hat, eine Ebene
--  tiefer.
--
--  WAS HIER GESCHIEHT
--
--  Nur die Bestandszeilen. Die Funktion selbst wird nicht kopiert — sie steht
--  schon doppelt (SUPABASE_SCHEMA_7_testkonto.sql und
--  SUPABASE_SCHEMA_23_sicherheit.sql, siehe SUPABASE_REIHENFOLGE.md). Beide
--  Stellen sind berichtigt; eine dritte Kopie hier wäre die nächste Quelle für
--  einen stillen Rückschritt.
-- ===========================================================================

-- 1. Kommentare an Beiträgen, die ihr eigener Verfasser nicht sehen darf, weg.
delete from public.comments k
 where exists (
   select 1 from public.posts b
    where b.id = k.post_id
      and b.demo
      and b.user_id <> k.user_id
      and not exists (select 1 from public.profiles p where p.id = b.user_id and p.demo)
 );

-- 2. Für jedes echte Konto einen Kommentar an einem sichtbaren Demo-Beitrag.
insert into public.comments (post_id, user_id, text, created_at)
select b.id, z.id,
       'Testkommentar — zum Prüfen von Antworten, Gefällt mir und Löschen.',
       now() - interval '30 minutes'
  from public.profiles z
  cross join lateral (
    select b.id
      from public.posts b
      join public.profiles p on p.id = b.user_id
     where b.demo and p.demo and b.user_id <> z.id
     order by b.created_at desc
     limit 1
  ) b
 where not z.demo
   and not exists (
     select 1 from public.comments k
      where k.user_id = z.id and k.post_id = b.id
   );

-- 3. Gegenprobe im selben Lauf.
--
--  Ohne sie meldet die Verwaltungs-API auch dann Erfolg, wenn die Anweisungen
--  null Zeilen getroffen haben — dieselbe stille Form wie beim verbotenen
--  DELETE. Schema 45 macht es an derselben Stelle genauso.
do $$
declare
  unsichtbar int;
  ohne       int;
begin
  select count(*) into unsichtbar
    from public.comments k
    join public.posts b on b.id = k.post_id
   where b.demo
     and b.user_id <> k.user_id
     and not exists (select 1 from public.profiles p where p.id = b.user_id and p.demo);

  select count(*) into ohne
    from public.profiles z
   where not z.demo
     and not exists (select 1 from public.comments k where k.user_id = z.id);

  if unsichtbar > 0 then
    raise exception 'Noch % Kommentar(e) an einem unsichtbaren Beitrag', unsichtbar;
  end if;
  if ohne > 0 then
    raise exception '% echte(s) Konto(en) ohne einen einzigen Kommentar', ohne;
  end if;

  raise notice 'Kommentare in Ordnung: keiner unsichtbar, jedes Konto hat einen.';
end $$;
