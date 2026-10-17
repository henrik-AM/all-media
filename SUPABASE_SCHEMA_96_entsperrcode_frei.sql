-- =====================================================================
-- SUPABASE_SCHEMA_96_entsperrcode_frei.sql — 17.10.2026
--
-- Henriks Entscheidung (17.10.2026) zum eigenen Entsperrcode der
-- Bildschirmzeit: „Mindestanzahl sind 4 Stellen, jeder Nutzer darf ihn aber
-- selbst festlegen (Länge, Zahl, Buchstaben, Sonderzeichen …)". Bis dahin
-- verlangte entsperrcode_setzen() 4 bis 8 Ziffern.
--
-- Dazu, weil ein 4-stelliger Code jetzt ausdrücklich erlaubt bleibt: eine
-- Tagesbremse beim Entsperren (Sicherheitsprüfung 16./17.10., Fund DB-10).
-- Bestehende Codes bleiben gültig — sie waren Ziffern ohne Leerzeichen,
-- btrim ändert an ihnen nichts.
--
-- Beide Funktionen werden vollständig neu angelegt (Grundlage: Live-Stand
-- vom 16.10.2026, Schema 87). Rechte bleiben, weil create or replace sie
-- nicht anfasst.
--
-- Einspielen:
--   SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs SUPABASE_SCHEMA_96_entsperrcode_frei.sql
-- =====================================================================

CREATE OR REPLACE FUNCTION public.entsperrcode_setzen(p_neu text, p_bisher text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ich  uuid := auth.uid();
  hash text;
begin
  if ich is null or not public.konto_freigegeben() then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  if (select count(*) from public.entsperrcode_versuche v
       where v.user_id = ich and v.art = 'setzen' and v.created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'grund', 'zu_viele_versuche',
                              'meldung', 'Zu viele Versuche. Versuch es in einer Stunde noch einmal.');
  end if;
  insert into public.entsperrcode_versuche (user_id, art, erfolg) values (ich, 'setzen', false);

  -- Henrik, 17.10.2026: mindestens 4 Zeichen, sonst frei (Ziffern,
  -- Buchstaben, Sonderzeichen). Gleiche Regel wie entsperrcodePruefen() in
  -- gemeinsam/bildschirmzeit.js. 64 Zeichen halten bcrypt unter 72 Byte.
  p_neu := btrim(p_neu);
  if p_neu is null or char_length(p_neu) < 4 then
    return jsonb_build_object('ok', false, 'grund', 'ungueltig', 'meldung', 'Der Code braucht mindestens 4 Zeichen');
  end if;
  if char_length(p_neu) > 64 or octet_length(p_neu) > 72 then
    return jsonb_build_object('ok', false, 'grund', 'ungueltig', 'meldung', 'Der Code darf höchstens 64 Zeichen haben');
  end if;
  if p_neu ~ '[[:cntrl:]]' then
    return jsonb_build_object('ok', false, 'grund', 'ungueltig', 'meldung', 'Der Code enthält ein unzulässiges Zeichen');
  end if;

  select c.code_hash into hash from public.entsperrcodes c where c.user_id = ich;
  if hash is not null then
    if coalesce(btrim(p_bisher), '') = '' then
      if not public.frisch_angemeldet() then
        return jsonb_build_object('ok', false, 'grund', 'bisher_fehlt',
                                  'meldung', 'Gib deinen bisherigen Code ein — oder melde dich neu an, wenn du ihn vergessen hast.');
      end if;
    elsif extensions.crypt(btrim(p_bisher), hash) <> hash then
      return jsonb_build_object('ok', false, 'grund', 'bisher_falsch', 'meldung', 'Der bisherige Code stimmt nicht.');
    end if;
  end if;

  insert into public.entsperrcodes (user_id, code_hash, updated_at)
  values (ich, extensions.crypt(p_neu, extensions.gen_salt('bf', 8)), now())
  on conflict (user_id) do update set code_hash = excluded.code_hash, updated_at = now();

  update public.entsperrcode_versuche set erfolg = true
   where id = (select max(id) from public.entsperrcode_versuche where user_id = ich and art = 'setzen');
  return jsonb_build_object('ok', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.bildschirmzeit_entsperren(p_ziel text, p_code text, p_minuten integer DEFAULT 15)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ich       uuid := auth.uid();
  heute     date;
  kontrolle uuid;
  wessen    uuid;
  hash      text;
  stimmt    boolean;
begin
  if ich is null or not public.konto_freigegeben() then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  if p_ziel is null or not (p_ziel = any(public.bildschirmzeit_bereiche() || array['gesamt', 'auszeit'])) then
    return jsonb_build_object('ok', false, 'grund', 'ungueltig');
  end if;
  if p_minuten is not null and p_minuten not in (15, 60) then
    return jsonb_build_object('ok', false, 'grund', 'ungueltig');
  end if;

  if (select count(*) from public.entsperrcode_versuche v
       where v.user_id = ich and v.art = 'entsperren' and not v.erfolg
         and v.created_at > now() - interval '15 minutes') >= 5 then
    return jsonb_build_object('ok', false, 'grund', 'zu_viele_versuche',
                              'meldung', 'Zu viele falsche Versuche. Versuch es in 15 Minuten noch einmal.');
  end if;
  -- Zweite Bremse je Tag (17.10.2026). Mit nur der 15-Minuten-Bremse waren
  -- 480 Versuche am Tag möglich — ein 4-stelliger Code des Elternteils war
  -- in rund zehn Tagen durchprobiert. Mit 20 je Tag im Mittel 250 Tage.
  if (select count(*) from public.entsperrcode_versuche v
       where v.user_id = ich and v.art = 'entsperren' and not v.erfolg
         and v.created_at > now() - interval '24 hours') >= 20 then
    return jsonb_build_object('ok', false, 'grund', 'zu_viele_versuche',
                              'meldung', 'Zu viele falsche Versuche heute. Versuch es morgen noch einmal.');
  end if;

  kontrolle := public.bildschirmzeit_kontrolle(ich);
  wessen := coalesce(kontrolle, ich);

  select c.code_hash into hash from public.entsperrcodes c where c.user_id = wessen;
  if hash is not null then
    -- Gesetzt wird ohne äußere Leerzeichen (entsperrcode_setzen), also auch so prüfen.
    stimmt := p_code is not null and extensions.crypt(btrim(p_code), hash) = hash;
  else
    -- Kein eigener Code: die Spenden-PIN, in ihrer Schreibweise
    -- (spendencode_normal: ohne Leerzeichen/Bindestriche, groß).
    select s.code_hash into hash from public.spendencodes s where s.user_id = wessen;
    if hash is null then
      return jsonb_build_object('ok', false, 'grund', 'kein_code', 'eltern', kontrolle is not null);
    end if;
    stimmt := p_code is not null and extensions.crypt(public.spendencode_normal(p_code), hash) = hash;
  end if;

  if not stimmt then
    insert into public.entsperrcode_versuche (user_id, art, erfolg) values (ich, 'entsperren', false);
    return jsonb_build_object('ok', false, 'grund', 'falsch', 'meldung', 'Der Code stimmt nicht.');
  end if;
  insert into public.entsperrcode_versuche (user_id, art, erfolg) values (ich, 'entsperren', true);

  heute := public.bildschirmzeit_heute(ich);
  insert into public.bildschirmzeit_freigaben (user_id, tag, ziel, art, minuten, basis, von)
  values (ich, heute, p_ziel, 'code', p_minuten, public.bildschirmzeit_basis(ich, p_ziel), wessen);
  return jsonb_build_object('ok', true, 'minuten', p_minuten);
end;
$function$;


-- Prüfblock: die neue Regel ist wirklich drin.
do $$
begin
  if pg_get_functiondef('public.entsperrcode_setzen(text,text)'::regprocedure) like '%\d{4,8}%' then
    raise exception 'entsperrcode_setzen verlangt noch Ziffern';
  end if;
  if pg_get_functiondef('public.bildschirmzeit_entsperren(text,text,integer)'::regprocedure) not like '%24 hours%' then
    raise exception 'bildschirmzeit_entsperren ohne Tagesbremse';
  end if;
end $$;
