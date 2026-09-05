-- =====================================================================
-- SUPABASE_SCHEMA_27_sichtbarkeitspruefer.sql — 05.09.2026
--
-- Behebt den Rest von Fund 11 der Sicherheitspruefung vom 03.09.2026
-- (2.Gehirn.md/02 Projekte/All-Media-Sicherheitspruefung-03-09-2026.md).
--
-- WORUM ES GEHT
--
-- `darf_herunterladen(inhaber, wer)` und `darf_angeschrieben_werden(
-- inhaber, wer)` sind `security definer` und bekommen den Betrachter als
-- Parameter uebergeben, statt ihn aus `auth.uid()` zu nehmen. Wer sie
-- direkt ueber /rest/v1/rpc/ aufruft, setzt `wer` frei.
--
-- Beide geben nur ein Ja oder Nein zurueck — das klingt harmlos, ist es
-- aber nicht. Schema 22 begruendet die dm-Sperre ausdruecklich damit, die
-- Sperrliste NICHT herauszugeben ("eine 'Alle bis auf'-Liste waere eine
-- Kraenkung mit Datenbankzugriff"). Genau diese Liste laesst sich mit
-- freiem `wer` Stueck fuer Stueck zurueckfragen: einmal je Kontopaar, und
-- man weiss, wer wen gesperrt hat. Dasselbe gilt fuer `download`.
--
-- WAS SICH AENDERT
--
-- Der Parameter bleibt — App, Website und die Pruefläufe uebergeben ihn,
-- und `darf_mitglied_werden()` in Schema 22 ruft intern mit `auth.uid()`
-- auf. Neu ist nur, dass er gegen den tatsaechlichen Aufrufer geprueft
-- wird. Gleiche Form wie bei `liker_namen()` in Schema 23.
--
-- Die Sprache wechselt von `sql` auf `plpgsql`, weil `raise exception` in
-- einer reinen SQL-Funktion nicht zur Verfuegung steht. `stable` bleibt.
--
-- Alles idempotent: die Datei laesst sich mehrfach einspielen.
-- Einspielen:
--   SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs SUPABASE_SCHEMA_27_sichtbarkeitspruefer.sql
-- =====================================================================

create or replace function public.darf_herunterladen(inhaber uuid, wer uuid)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'nicht angemeldet';
  end if;
  if wer is distinct from auth.uid() then
    raise exception 'nicht erlaubt';
  end if;

  return public.sichtbar_fuer(inhaber, 'download', wer);
end;
$$;

revoke execute on function public.darf_herunterladen(uuid, uuid) from public, anon;
grant execute on function public.darf_herunterladen(uuid, uuid) to authenticated;


create or replace function public.darf_angeschrieben_werden(inhaber uuid, wer uuid)
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'nicht angemeldet';
  end if;
  if wer is distinct from auth.uid() then
    raise exception 'nicht erlaubt';
  end if;

  return public.sichtbar_fuer(inhaber, 'dm', wer);
end;
$$;

revoke execute on function public.darf_angeschrieben_werden(uuid, uuid) from public, anon;
grant execute on function public.darf_angeschrieben_werden(uuid, uuid) to authenticated;
