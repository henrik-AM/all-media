-- =====================================================================
-- SUPABASE_SCHEMA_117_medienreferenz_eigen.sql — 31.10.2026
--
-- Codex-Fund F4 (Adversarial Review zu kasten/rs-recht, 31.10.2026):
-- Fremde private Medien über eine eigene Medienreferenz.
--
-- `medium_sichtbar` (Schema 95) gibt eine Datei frei, sobald irgendeine
-- lesbare Zeile ihre Adresse trägt. `medien_adresse_gueltig()` prüft nur
-- die Form. Wer also die Adresse einer fremden Datei kennt, legt einen
-- eigenen Beitrag damit an und bekommt neue unterschriebene Links — für
-- sich und für jeden, der den Beitrag sieht.
--
-- Live am 31.10. per Probe (app/test/_probe_f4_medien.js, verworfen):
--   * Bunny-Dateien: der Auslöser bunny_referenz_pruefen (Schema 115)
--     verlangt, dass der Schreibende die Datei JETZT lesen darf. Private
--     Story / fremder Chat-Anhang → abgewiesen.
--   * Dateien nur in Supabase (kein Bunny-Beleg): gar keine Prüfung →
--     offen. Live gab es am 31.10. vier solche Dateien.
--   * Kopie, solange lesbar: eine fremde öffentliche Story in einen
--     eigenen Beitrag kopiert, bleibt die Datei nach Ablauf der Story
--     dauerhaft sichtbar — für jeden, der den Beitrag sieht —, und der
--     Eigentümer kann sie nicht mehr löschen (medium_loeschrecht sieht
--     die fremde Referenz).
--   Bestand live am 31.10.: keine einzige fremde Referenz außer
--   Beispielmedien (beispiel/…). Die Lücke war offen, aber unbenutzt.
--
-- Regel jetzt: Wer eine Medienspalte setzt oder ändert, muss die Datei
-- selbst hochgeladen haben (Bunny-Beleg bzw. Speicher-Eigentümer, wie
-- bunny_eigenes_medium) — Ausnahmen:
--   * beispiel/… (Beispielbestand, ohnehin für alle lesbar),
--   * Weiterleiten (messages.forwarded_from): erlaubt, wenn der
--     Schreibende eine Nachricht mit genau dieser Adresse von genau
--     diesem Absender lesen darf. Das ist der Weg aus
--     nachrichtWeiterleiten() (App) und handleForward (Website): beide
--     setzen forwarded_from = Absender der Vorlage.
--   * Zeilen, die nicht über einen Client geschrieben werden
--     (current_user <> authenticated: Testbestand, zuruecksetzen(),
--     Definer-Funktionen) — wie in Schema 115.
-- Unveränderte Adressen beim UPDATE prüft der Auslöser nicht: alte
-- Zeilen bleiben bearbeitbar.
--
-- Geteilte Beiträge (shared_post_id), Story-Antworten (reply_to_story)
-- und Titelbilder aus Beitrag/Story (titel_post_id, titel_story_id)
-- kopieren keine Adresse, sondern verweisen auf die Zeile; sie bleiben
-- unberührt und folgen deren Sichtbarkeit.
--
-- Entwurf auf kasten/rs-recht, NICHT eingespielt. Ohne begin/commit.
-- Idempotent. Hängt ab von Schema 95 (medien_adresse, medien_adresse_
-- gueltig) und 115 (medien_objekte).
-- =====================================================================

create or replace function public.medium_selbst_hochgeladen(p_pfad text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Wie bunny_eigenes_medium (Schema 115), aber ohne Abhängigkeit davon,
  -- ob die Datei schon einen Bunny-Beleg hat: Beleg schlägt Speicher.
  select auth.uid() is not null and (
    exists (select 1 from public.medien_objekte where pfad = p_pfad and owner_id = auth.uid())
    or (not exists (select 1 from public.medien_objekte where pfad = p_pfad)
        and exists (select 1 from storage.objects
                     where bucket_id = 'media' and name = p_pfad and owner_id = auth.uid()::text)));
$$;
-- Der Auslöser läuft als Aufrufer und braucht das Recht; die Funktion
-- verrät nur, ob der Aufrufer selbst eine Datei hochgeladen hat.
revoke execute on function public.medium_selbst_hochgeladen(text) from public, anon;
grant execute on function public.medium_selbst_hochgeladen(text) to authenticated;

create or replace function public.medienreferenz_pruefen()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  s text;
  adresse text;
  p text;
  weiter uuid;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  foreach s in array tg_argv loop
    adresse := to_jsonb(new) ->> s;
    if adresse is null then continue; end if;
    if tg_op = 'UPDATE' and adresse is not distinct from (to_jsonb(old) ->> s) then
      continue;
    end if;
    -- Fremde Formen weist schon der CHECK aus Schema 95 ab.
    if not public.medien_adresse_gueltig(adresse) then continue; end if;
    p := substr(adresse, length(public.medien_adresse('')) + 1);
    if split_part(p, '/', 1) = 'beispiel' then continue; end if;
    if public.medium_selbst_hochgeladen(p) then continue; end if;

    -- Weiterleiten: die Vorlage muss für den Schreibenden lesbar sein
    -- (RLS auf messages greift, die Funktion läuft als Aufrufer).
    if tg_table_name = 'messages' and s = 'media_url' then
      weiter := (to_jsonb(new) ->> 'forwarded_from')::uuid;
      if weiter is not null and exists (
           select 1 from public.messages m
            where m.media_url = adresse and m.sender_id = weiter
              and m.deleted_at is null) then
        continue;
      end if;
    end if;

    raise exception 'Dieses Medium darfst du nicht verwenden' using errcode = '42501';
  end loop;
  return new;
end $$;
revoke execute on function public.medienreferenz_pruefen() from public, anon, authenticated;

-- Dieselbe Spaltenliste wie bunny_referenz_pruefen (Schema 115) plus
-- kontakt_bilder (Schema 94), deren Bild der Eigentümer selbst hochlädt.
do $$
declare
  z record;
  spalten text;
  argumente text;
begin
  for z in select * from (values
    ('profiles', array['avatar_url']), ('communities', array['bild_url']),
    ('posts', array['media_url', 'thumbnail_url']), ('stories', array['media_url']),
    ('messages', array['media_url']), ('insights', array['media_url']),
    ('ptt_messages', array['audio_url']), ('community_channel_messages', array['media_url']),
    ('sammlungen', array['titelbild_url']), ('kontakt_bilder', array['media_url'])
  ) as t(tabelle, medien) loop
    select string_agg(quote_ident(s), ', '), string_agg(quote_literal(s), ', ')
      into spalten, argumente
      from unnest(z.medien) s
     where exists (select 1 from information_schema.columns c
                    where c.table_schema = 'public' and c.table_name = z.tabelle and c.column_name = s);
    if spalten is null then continue; end if;
    execute format('drop trigger if exists medienreferenz_pruefen on public.%I', z.tabelle);
    execute format('create trigger medienreferenz_pruefen before insert or update of %s on public.%I'
                   || ' for each row execute function public.medienreferenz_pruefen(%s)',
                   spalten, z.tabelle, argumente);
  end loop;
end $$;

notify pgrst, 'reload schema';
