-- =====================================================================
-- SUPABASE_SCHEMA_101_freigabe_nummer_spende.sql — 22.10.2026
--
-- Auftrag Recht/Sicherheit vom 21.10.2026 (Richtlinie Jugendschutz, Regel 1):
-- Ein Kinderkonto, das noch auf die Zustimmung der Eltern wartet (oder
-- abgelehnt wurde), ist seit Schema 52 für andere unsichtbar — die Regel
-- `nur_freigegebene` liegt auf jeder Tabelle. Zwei security-definer-
-- Funktionen umgingen das, weil sie RLS nicht sehen:
--
--   1. finde_per_nummer(): fand das wartende Kind über seine Nummer und
--      trug den Treffer in nummer_treffer ein (Schema 57) — damit konnte ein
--      Fremder ein Kind als Kontakt anlegen, bevor die Eltern zugestimmt
--      hatten. Jetzt: Ziel muss `frei` sein; ein wartendes Konto sucht
--      selbst auch niemanden.
--   2. spende_senden(): nahm Spenden von und an wartende Konten an.
--      Jetzt: beide Seiten müssen `frei` sein. Der Empfänger bekommt die
--      Antwort „empfaenger" wie ein fehlendes Profil, damit die Funktion
--      den Zustand nicht verrät.
--
-- profil_zu_nummer() bleibt unverändert: Sie sucht den Elternteil, und
-- eltern_geeignet() prüft dort schon, dass er selbst frei und volljährig ist.
--
-- Grundlage: Live-Stand vom 22.10.2026 (pg_get_functiondef; zuletzt
-- definiert in Schema 57 bzw. 72). Kein neuer Code nötig: Die Clients
-- zeigen für unbekannte Gründe „Das hat nicht geklappt", gemeinsam/zahlung.js
-- kennt ab Zweig kasten/rs-recht den Text für „nicht_freigegeben".
-- Rechte bleiben, weil create or replace sie nicht anfasst.
--
-- Einspielen:
--   SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs SUPABASE_SCHEMA_101_freigabe_nummer_spende.sql
-- Danach: npm run test:angriffe (app/), Probe: node test/_probe101.js
-- =====================================================================

CREATE OR REPLACE FUNCTION public.finde_per_nummer(nummer text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ich     uuid := auth.uid();
  gesucht text := public.nummer_vergleichsform(nummer);
  bisher  integer;
  treffer jsonb;
  -- Vierzig Nachschlaege je Stunde und Konto. Wer Kontakte eintippt, merkt
  -- davon nichts; wer eine Vorwahl durchzaehlt, braucht Jahre.
  grenze  constant integer  := 40;
  fenster constant interval := interval '1 hour';
begin
  if ich is null then
    raise exception 'nicht angemeldet';
  end if;
  -- Zu kurze Eingaben wuerden auf halbe Nummern passen und die Suche in ein
  -- Rateverfahren verwandeln.
  if length(gesucht) < 6 then
    return null;
  end if;
  -- Schema 101: Ein Konto, das noch auf die Eltern wartet, sucht niemanden.
  if not public.konto_freigegeben() then
    return null;
  end if;

  delete from public.nummer_suche_takt
   where nutzer = ich
     and zeit < now() - fenster;

  select count(*) into bisher
    from public.nummer_suche_takt
   where nutzer = ich;

  if bisher >= grenze then
    -- 54000 = program_limit_exceeded. Ein eigener Code, damit die Aufrufer
    -- die Bremse von einem echten Fehler unterscheiden koennen.
    raise exception 'Zu viele Nummernsuchen. Bitte versuche es spaeter noch einmal.'
      using errcode = '54000';
  end if;

  insert into public.nummer_suche_takt (nutzer) values (ich);

  select to_jsonb(t) into treffer
    from (select p.id, p.name, p.handle, p.initials, p.color, p.privat, p.about
            from public.profiles p
           where p.id <> ich
             and p.phone is not null
             and public.nummer_vergleichsform(p.phone) = gesucht
             -- Schema 101: Ein wartendes oder abgelehntes Kinderkonto ist
             -- auch über die Nummer unsichtbar (wie überall sonst, Schema 52).
             and public.konto_stand(p.id) = 'frei'
           limit 1) t;

  -- Schema 57: Wer die Nummer kannte, darf die Person als Kontakt anlegen.
  if treffer is not null then
    insert into public.nummer_treffer (nutzer, ziel)
    values (ich, (treffer ->> 'id')::uuid)
    on conflict (nutzer, ziel) do update set zeit = now();
  end if;

  return treffer;
end;
$function$;

CREATE OR REPLACE FUNCTION public.spende_senden(p_empfaenger uuid, p_betrag_cent integer, p_code text, p_methode uuid DEFAULT NULL::uuid, p_post uuid DEFAULT NULL::uuid, p_nachricht text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ich     uuid := auth.uid();
  v_methode public.zahlungsmethoden%rowtype;
  v_zeile   public.donations%rowtype;
  v_fehl    integer;
begin
  if v_ich is null then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  if p_empfaenger is null or p_empfaenger = v_ich then
    return jsonb_build_object('ok', false, 'grund', 'selbst');
  end if;
  -- Dieselben Grenzen wie MIN_CENT/MAX_CENT in gemeinsam/zahlung.js.
  if p_betrag_cent is null or p_betrag_cent < 50 or p_betrag_cent > 100000 then
    return jsonb_build_object('ok', false, 'grund', 'betrag');
  end if;
  -- Schema 101: Spenden nur zwischen freigegebenen Konten. Der Empfänger
  -- bekommt dieselbe Antwort wie ein fehlendes Profil, damit die Funktion
  -- nicht verrät, dass es ein wartendes Kinderkonto gibt.
  if not public.konto_freigegeben() then
    return jsonb_build_object('ok', false, 'grund', 'nicht_freigegeben');
  end if;
  if not exists (select 1 from public.profiles where id = p_empfaenger)
     or public.konto_stand(p_empfaenger) <> 'frei' then
    return jsonb_build_object('ok', false, 'grund', 'empfaenger');
  end if;

  if p_methode is null then
    select * into v_methode from public.zahlungsmethoden where user_id = v_ich and standard limit 1;
    if not found then
      return jsonb_build_object('ok', false, 'grund', 'keine_zahlungsmethode');
    end if;
  else
    select * into v_methode from public.zahlungsmethoden where id = p_methode and user_id = v_ich;
    if not found then
      return jsonb_build_object('ok', false, 'grund', 'methode_unbekannt');
    end if;
  end if;
  if v_methode.anbieter = 'karte'
     and (v_methode.ablauf_jahr < extract(year from now())
          or (v_methode.ablauf_jahr = extract(year from now())
              and v_methode.ablauf_monat < extract(month from now()))) then
    return jsonb_build_object('ok', false, 'grund', 'methode_abgelaufen');
  end if;

  if not exists (select 1 from public.spendencodes where user_id = v_ich) then
    return jsonb_build_object('ok', false, 'grund', 'kein_code');
  end if;
  if public.spendencode_gesperrt(v_ich) then
    return jsonb_build_object('ok', false, 'grund', 'gesperrt');
  end if;
  if not public.spendencode_stimmt(v_ich, p_code) then
    select count(*) into v_fehl
      from public.spendencode_protokoll p
     where p.user_id = v_ich and p.art = 'pruefen' and not p.erfolg
       and p.created_at > now() - interval '15 minutes'
       and p.created_at > coalesce((select max(q.created_at) from public.spendencode_protokoll q
                                     where q.user_id = v_ich and q.art = 'pruefen' and q.erfolg),
                                    '-infinity'::timestamptz);
    return jsonb_build_object('ok', false, 'grund',
                              case when v_fehl >= 5 then 'gesperrt' else 'falscher_code' end,
                              'verbleibend', greatest(0, 5 - v_fehl));
  end if;

  insert into public.donations (post_id, empfaenger_id, sender_id, betrag_cent, nachricht,
                                zahlungsmethode_id, zahlungsstatus)
  values (p_post, p_empfaenger, v_ich, p_betrag_cent, left(coalesce(p_nachricht, ''), 500),
          v_methode.id, 'vorgemerkt')
  returning * into v_zeile;

  return jsonb_build_object('ok', true, 'id', v_zeile.id, 'created_at', v_zeile.created_at,
                            'zahlungsstatus', v_zeile.zahlungsstatus);
end;
$function$;

-- Selbstprüfung: die neuen Bedingungen sind wirklich angelegt.
do $$
begin
  if position('konto_stand(p.id)' in pg_get_functiondef('public.finde_per_nummer(text)'::regprocedure)) = 0 then
    raise exception 'Schema 101: finde_per_nummer ohne Freigabeprüfung';
  end if;
  if position('konto_stand(p_empfaenger)' in pg_get_functiondef('public.spende_senden(uuid,integer,text,uuid,uuid,text)'::regprocedure)) = 0 then
    raise exception 'Schema 101: spende_senden ohne Freigabeprüfung';
  end if;
end $$;
