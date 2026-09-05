-- ===========================================================================
--  Die sechs übrigen Sichtbarkeitsbereiche
-- ===========================================================================
--
--  Schema 19 hat vier von zehn Bereichen wirksam gemacht: story, standort,
--  dm, kommentare. Sechs blieben ausdrücklich liegen — Likes, Repost,
--  Download, Push-to-Talk, Onlinestatus, Markierung. In der Projektnotiz vom
--  03.09.2026 stehen sie unter „offen und ausdrücklich nicht erledigt",
--  damit niemand sie für gebaut hält.
--
--  Diese Datei holt sie nach. Dabei kommt heraus, dass zwei von ihnen gar
--  keine Einstellung ohne Wirkung waren, sondern eine Einstellung ohne
--  Gegenstand:
--
--    * „Zuletzt online" — es gibt in der ganzen Datenbank keine Spalte, die
--      festhält, wann jemand zuletzt da war. Der grüne Punkt am Avatar ist
--      gemalt. Ohne Daten kann keine Regel etwas verbergen.
--
--    * „Wer darf mich markieren" — es gibt keine Markierung. Der Reiter
--      „Markiert" im Profil ist seit jeher leer, weil nichts ihn füllt.
--
--  Für beide entstehen hier erst die Daten, dann die Regel. Das ist mehr
--  Arbeit als eine Policy, aber die Alternative wäre gewesen, einen Schalter
--  scharfzustellen, der auf nichts zeigt.
--
--  Einspielen:
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      SUPABASE_SCHEMA_20_sichtbarkeit_rest.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  Der Bereich „markierung" fehlte in der Prüfliste
--
--  Schema 18 hat die erlaubten Werte auf zehn erweitert. Zur Sicherheit hier
--  noch einmal vollständig — eine Einstellung, die die Prüfliste ablehnt,
--  ließe sich in der Oberfläche wählen und käme nie an.
-- ---------------------------------------------------------------------------

alter table public.visibility_settings
  drop constraint if exists visibility_settings_bereich_check;
alter table public.visibility_settings
  add constraint visibility_settings_bereich_check
  check (bereich in ('standort', 'story', 'repost', 'onlinestatus', 'ptt',
                     'likes', 'download', 'dm', 'kommentare', 'markierung'));


-- ============================================================== Repost ====
--
--  „Repost-Sichtbarkeit" heißt: wer sieht, was ich weitergereicht habe. Die
--  Reposts einer Person stehen in ihrem Profil unter dem Pfeil-Reiter und im
--  Feed derer, die ihr folgen.
--
--  Der eigene Repost bleibt sichtbar — sichtbar_fuer() gibt für
--  `eigner = betrachter` immer true zurück. Sonst wäre der eigene Reiter bei
--  Stufe „Niemand" leer, und das läse sich als Fehler, nicht als Einstellung.

drop policy if exists "Reposts lesen" on public.reposts;
create policy "Reposts lesen" on public.reposts
  for select to authenticated
  using (public.sichtbar_fuer(user_id, 'repost', auth.uid()));


-- ========================================================= Push-to-Talk ===
--
--  Hier steht die Einstellung ausnahmsweise beim Empfänger, nicht beim
--  Urheber: „Push-to-Talk Benachrichtigung" heißt „wer darf mir ins Ohr
--  reden". Eine PTT-Nachricht geht an eine ganze Community, sie hat keinen
--  einzelnen Empfänger — als Schreibregel ließe sie sich also gar nicht
--  ausdrücken, ohne die halbe Community stillzulegen.
--
--  Deshalb als Leseregel: `sichtbar_fuer(ich, 'ptt', absender)`. Die vier
--  Stufen lesen sich damit von selbst — „Alle bis auf …" ist genau die
--  Liste der Leute, deren Sprachnachrichten mich nicht mehr erreichen.
--
--  Die eigene PTT-Nachricht bleibt sichtbar (eigner = betrachter).

drop policy if exists "PTT in eigenen Communitys lesen" on public.ptt_messages;
create policy "PTT in eigenen Communitys lesen" on public.ptt_messages
  for select to authenticated using (
    exists (
      select 1 from public.community_members m
      where m.community_id = ptt_messages.community_id and m.user_id = auth.uid()
    )
    and public.sichtbar_fuer(auth.uid(), 'ptt', sender_id)
  );


-- =============================================================== Likes ====
--
--  „Likes-Sichtbarkeit" heißt: steht mein Name unter einem fremden Beitrag,
--  wenn ich ihn geliked habe — „Gefällt Anna und 14 weiteren Personen".
--
--  WARUM DAS KEINE LESEREGEL AUF post_likes IST
--
--  Der naheliegende Weg wäre eine Regel auf `post_likes`. Er wäre falsch:
--  beide Oberflächen zählen die Likes über `post_likes(count)`, und PostgREST
--  zählt nur, was die Regel durchlässt. Wer seine Likes verbirgt, würde damit
--  fremde Zähler senken — ein Beitrag hätte für verschiedene Betrachter
--  verschiedene Like-Zahlen. Die Zahl ist eine Tatsache über den Beitrag, der
--  Name eine Angabe über den Menschen. Nur der Name gehört verborgen.
--
--  Also eine Funktion, die genau den Namen liefert — und nichts sonst.
--  `daten.ts` setzte `likedBy: ''` fest, im Browser stand die Zeile nur als
--  „14 Likes": den Namen gab es bis heute überhaupt nicht.

create or replace function public.liker_namen(beitraege uuid[], wer uuid)
returns table (post_id uuid, name text)
language sql
stable
security definer set search_path = public
as $$
  select l.post_id,
         (select p.name
            from public.post_likes x
            join public.profiles p on p.id = x.user_id
           where x.post_id = l.post_id
             and public.sichtbar_fuer(x.user_id, 'likes', wer)
           order by x.created_at desc
           limit 1)
    from public.post_likes l
   where l.post_id = any (beitraege)
   group by l.post_id;
$$;

grant execute on function public.liker_namen(uuid[], uuid) to authenticated;


-- ============================================================ Download ====
--
--  „Downloadeinstellungen" heißt: darf jemand meine Story, mein Foto, mein
--  Video auf sein Gerät holen.
--
--  EHRLICHE GRENZE, UND SIE GEHÖRT HIERHIN
--
--  Ein Bild, das jemand sehen darf, hat er bereits geladen. Ein Bildschirmfoto
--  kann keine Datenbank verhindern. Diese Einstellung entfernt den Knopf und
--  weist den Weg über die Oberfläche ab — mehr kann sie nicht, und sie soll
--  auch nicht mehr versprechen. Sie ist eine Bitte mit Nachdruck, keine
--  Sperre. Genau deshalb steht sie hier als Funktion und nicht als Regel:
--  eine RLS-Regel würde eine Härte behaupten, die es nicht gibt.

create or replace function public.darf_herunterladen(inhaber uuid, wer uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.sichtbar_fuer(inhaber, 'download', wer);
$$;

grant execute on function public.darf_herunterladen(uuid, uuid) to authenticated;


-- ========================================================= Onlinestatus ===
--
--  Es gab nichts zu verbergen: keine Spalte, kein Zeitstempel, nirgends.
--  Der grüne Punkt in `Avatar.tsx` ist ein Gestaltungsmittel und hängt an
--  keiner Tatsache.
--
--  WARUM EINE EIGENE TABELLE UND KEINE SPALTE IN profiles
--
--  Als `profiles.last_seen` wäre der Zeitstempel für jeden lesbar, der ein
--  Profil liest — und Profile liest jeder. Verbergen ließe er sich nur über
--  Rechte auf einzelne Spalten, und dann bräche `select *` in beiden
--  Oberflächen. Eine eigene Tabelle trägt ihre eigene Regel.
--
--  UND WARUM DAS VERBERGEN HIER RICHTIG HERUM IST
--
--  Wer den Status verbirgt, hat keine Zeile, die der andere sehen darf. Für
--  den Betrachter sieht das genauso aus wie „war noch nie da". Das ist
--  Absicht: ein „verborgen" in der Oberfläche wäre selbst eine Auskunft.

create table if not exists public.presence (
  user_id   uuid primary key references public.profiles (id) on delete cascade,
  last_seen timestamptz not null default now()
);

alter table public.presence enable row level security;

drop policy if exists "Zuletzt online lesen" on public.presence;
create policy "Zuletzt online lesen" on public.presence
  for select to authenticated
  using (public.sichtbar_fuer(user_id, 'onlinestatus', auth.uid()));

drop policy if exists "Eigene Anwesenheit setzen" on public.presence;
create policy "Eigene Anwesenheit setzen" on public.presence
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

--  Ein Aufruf statt eines upsert aus der Oberfläche: so steht an einer
--  Stelle, was „ich bin da" bedeutet, und der Zeitpunkt kommt von der
--  Datenbank. Eine Uhr auf dem Gerät kann falsch gehen.
create or replace function public.hier_bin_ich()
returns void
language sql
volatile
security definer set search_path = public
as $$
  insert into public.presence (user_id, last_seen)
  values (auth.uid(), now())
  on conflict (user_id) do update set last_seen = now();
$$;

grant execute on function public.hier_bin_ich() to authenticated;


-- =========================================================== Markierung ===
--
--  „Wer darf mich markieren" stand in den Einstellungen, und der Reiter
--  „Markiert" stand im Profil. Dazwischen war nichts: keine Tabelle, kein
--  Weg, jemanden zu markieren, und folglich ein Reiter, der bei jedem
--  Menschen leer ist. Zwei Anzeigen, die zusammen so aussahen, als gäbe es
--  die Funktion.

create table if not exists public.post_tags (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

create index if not exists post_tags_user_idx
  on public.post_tags (user_id, created_at desc);

alter table public.post_tags enable row level security;

--  Markierungen stehen sichtbar unter dem Beitrag — wer den Beitrag sieht,
--  sieht sie.
drop policy if exists "Markierungen lesen" on public.post_tags;
create policy "Markierungen lesen" on public.post_tags
  for select to authenticated using (true);

/*
 * Dieselbe Falle wie bei den Kommentaren in Schema 19, deshalb dieselbe
 * Bauart: eine Funktion mit `security definer`, die den Beitragsinhaber mit
 * erhöhten Rechten liest und ablehnt, wenn sie ihn nicht findet.
 *
 * Eine Unterabfrage in der Policy selbst liefe mit den Rechten des
 * Markierenden; findet sie den Beitrag nicht, käme NULL heraus, und
 * sichtbar_fuer(NULL, …) antwortet true. Die Regel erlaubte dann genau dort,
 * wo sie schützen soll.
 */
create or replace function public.darf_markieren(ziel_post uuid, wen uuid, wer uuid)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  eigner uuid;
begin
  select b.user_id into eigner from public.posts b where b.id = ziel_post;
  if eigner is null then
    return false;
  end if;
  -- Markieren darf nur, wer den Beitrag verfasst hat.
  if eigner <> wer then
    return false;
  end if;
  return public.sichtbar_fuer(wen, 'markierung', wer);
end;
$$;

grant execute on function public.darf_markieren(uuid, uuid, uuid) to authenticated;

drop policy if exists "Markierung setzen" on public.post_tags;
create policy "Markierung setzen" on public.post_tags
  for insert to authenticated
  with check (public.darf_markieren(post_id, user_id, auth.uid()));

/*
 * Entfernen darf beides: der Verfasser des Beitrags und die markierte Person
 * selbst. Das zweite ist der wichtigere Fall — wer sich nachträglich
 * ausgetragen wissen will, darf dafür nicht auf das Wohlwollen des
 * Verfassers angewiesen sein.
 */
create or replace function public.darf_markierung_loesen(ziel_post uuid, wen uuid, wer uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select wen = wer
      or wer = (select b.user_id from public.posts b where b.id = ziel_post);
$$;

grant execute on function public.darf_markierung_loesen(uuid, uuid, uuid) to authenticated;

drop policy if exists "Markierung entfernen" on public.post_tags;
create policy "Markierung entfernen" on public.post_tags
  for delete to authenticated
  using (public.darf_markierung_loesen(post_id, user_id, auth.uid()));


-- ---------------------------------------------------------------------------
--  Was danach immer noch offen ist — und das bleibt so stehen
--
--  Nichts aus der Liste der zehn Bereiche. Nach dieser Datei wirken alle
--  zehn. Offen bleibt die Ende-zu-Ende-Verschlüsselung; sie ist kein
--  Sichtbarkeitsbereich, sondern ein eigenes Vorhaben, und der Satz
--  „Ende-zu-Ende-verschlüsselt" im Anrufbildschirm ist bis dahin unzutreffend.
--
--  Geprüft wird das alles in app/test/_sichtbarkeit.js — mit zwei Konten,
--  denn aus einer Perspektive sieht eine wirkungslose Regel richtig aus.
-- ---------------------------------------------------------------------------
