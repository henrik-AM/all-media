-- ===========================================================================
--  All Media — Schema 77 (Kasten 18): Die Spenden-PIN darf doppelt sein
--  Stand 01.10.2026
--
--  WARUM ES DIESE DATEI GIBT
--
--  Schema 72 hat den Spendencode eindeutig gemacht: Ein HMAC-Fingerabdruck
--  mit geheimem Pfeffer und ein Eindeutigkeits-Index darauf. Wer einen Code
--  wählte, den jemand anderes schon hatte, bekam „vergeben" — und wusste
--  damit, dass es diesen Code gibt.
--
--  Henrik am 01.10.2026: „Es darf auch Spenden-PINs doppelt geben. Der
--  Spenden-PIN ist ein selbst festgelegter Code von jedem Nutzer individuell,
--  wie zum Beispiel ein Handy-Entsperrcode."
--
--  Eine PIN gehört also zum Konto, nicht zur Plattform. Damit fällt die
--  Eindeutigkeit weg — und mit ihr der Grund für den Fingerabdruck. Er war
--  zudem selbst ein Risiko: Ein gleichbleibender Hash einer kurzen PIN ist
--  mit dem Pfeffer in wenigen Sekunden durchprobiert. Geprüft wird die PIN
--  weiterhin nur über den bcrypt-Hash (code_hash, spendencode_stimmt).
--
--  WAS HIER GESCHIEHT
--  1. Index spendencodes_fingerabdruck weg, Spalte fingerabdruck weg.
--  2. spendencode_setzen() ohne den Grund 'vergeben'.
--  3. spendencode_fingerabdruck() und die Pfeffer-Tabelle weg.
--
--  Idempotent: mehrfach einspielbar.
-- ===========================================================================

create or replace function public.spendencode_setzen(p_neu text, p_bisher text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ich  uuid := auth.uid();
  v_hat  boolean;
begin
  if v_ich is null then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;

  -- Bremse: zehn Versuche in der Stunde. Seit Schema 77 gibt es kein
  -- „vergeben" mehr, das sich abklopfen ließe; die Bremse bleibt gegen
  -- Durchprobieren des bisherigen Codes (p_bisher).
  if (select count(*) from public.spendencode_protokoll
       where user_id = v_ich and art = 'setzen' and created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'grund', 'zu_viele_versuche');
  end if;
  insert into public.spendencode_protokoll (user_id, art, erfolg) values (v_ich, 'setzen', false);

  if not public.spendencode_gueltig(p_neu) then
    return jsonb_build_object('ok', false, 'grund', 'ungueltig');
  end if;

  v_hat := exists (select 1 from public.spendencodes where user_id = v_ich);
  if v_hat then
    if p_bisher is null or btrim(p_bisher) = '' then
      if not public.frisch_angemeldet() then
        return jsonb_build_object('ok', false, 'grund', 'neu_anmelden');
      end if;
    else
      if public.spendencode_gesperrt(v_ich) then
        return jsonb_build_object('ok', false, 'grund', 'gesperrt');
      end if;
      if not public.spendencode_stimmt(v_ich, p_bisher) then
        return jsonb_build_object('ok', false, 'grund', 'bisher_falsch');
      end if;
    end if;
  end if;

  insert into public.spendencodes (user_id, code_hash, geaendert_am)
  values (v_ich,
          extensions.crypt(public.spendencode_normal(p_neu), extensions.gen_salt('bf', 8)),
          now())
  on conflict (user_id) do update
     set code_hash = excluded.code_hash,
         geaendert_am = now();

  update public.spendencode_protokoll
     set erfolg = true
   where id = (select max(id) from public.spendencode_protokoll where user_id = v_ich and art = 'setzen');

  return jsonb_build_object('ok', true);
end;
$function$;


revoke all on function public.spendencode_setzen(text, text) from public, anon;
grant execute on function public.spendencode_setzen(text, text) to authenticated;

drop index if exists public.spendencodes_fingerabdruck;
alter table public.spendencodes drop column if exists fingerabdruck;
drop function if exists public.spendencode_fingerabdruck(text);
drop table if exists public.spendencode_pfeffer;


-- ---------------------------------------------------------------------------
--  Nachweis
-- ---------------------------------------------------------------------------
do $$
begin
  if pg_get_functiondef('public.spendencode_setzen(text,text)'::regprocedure) like '%''vergeben''%' then
    raise exception 'spendencode_setzen kennt noch vergeben';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'spendencodes'
                and column_name = 'fingerabdruck') then
    raise exception 'spendencodes.fingerabdruck steht noch';
  end if;
end $$;

