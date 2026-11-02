-- =====================================================================
-- SUPABASE_SCHEMA_102_melden_moderation.sql — 22.10.2026
--
-- Auftrag Recht/Sicherheit vom 21.10.2026, Kasten RS 3 (Melden und
-- Moderation). Maßstab laut Henrik: veröffentlichte App mit vielen Nutzern.
--
-- WORUM ES GEHT
--
-- Bis hierher konnte man Beiträge und Profile melden (Tabelle `reports`,
-- Schema 2), aber niemand bekam die Meldung zu sehen, niemand konnte
-- entscheiden, und weder der Meldende noch der Betroffene erfuhr etwas.
-- Der Digital Services Act verlangt für Hosting-Dienste und Plattformen:
--
--   Art. 16  Melde- und Abhilfeverfahren: leicht zugänglich, Begründung,
--            genaue Fundstelle, Erklärung „in gutem Glauben", Eingangs-
--            bestätigung, Mitteilung der Entscheidung an den Meldenden.
--   Art. 17  Begründung jeder Einschränkung an den Betroffenen: welche
--            Maßnahme, wie lange, welche Tatsachen, ob automatisiert,
--            Rechtsgrundlage bzw. Regel, welche Rechtsbehelfe.
--   Art. 20  Internes Beschwerdemanagement: sechs Monate lang, kostenlos,
--            elektronisch, nicht allein automatisiert; ist die Beschwerde
--            begründet, wird die Entscheidung rückgängig gemacht.
--   Art. 18  Verdacht auf Straftaten mit Gefahr für Leib oder Leben →
--            unverzüglich das BKA informieren (u-entrance). Der Moderator
--            vermerkt das mit art18_vermerken() im Protokoll. Suizid-
--            ankündigungen sind KEIN Pflichtfall (BKA): Hilfsangebot, bei
--            akuter Gefahr 110.
--
-- WAS DIESE DATEI ANLEGT
--
--   reports            bekommt Kategorie, Begründung, Status, Beleg
--                      (Momentaufnahme des gemeldeten Inhalts), Entscheidung.
--                      reported_by wird bei Kontolöschung NULL statt mit-
--                      gelöscht: die Meldung ist Beleg (Art. 17 Abs. 3 e DSGVO).
--   moderatoren        Wer moderiert. Nur per SQL vom Betreiber eingetragen,
--                      nie vom Client. Keine Leseregel auf fremde Zeilen.
--   beschwerden        Widerspruch gegen eine Entscheidung (Art. 20).
--   moderation_protokoll  Jede Entscheidung, nur anhängend.
--
--   inhalt_melden()               Meldung abgeben (alle Arten, auch „Problem")
--   meine_meldungen()             Stand eigener Meldungen
--   mich_betreffende_entscheidungen()  Begründungen an mich (Kontostatus)
--   entscheidung_widersprechen()  Beschwerde einlegen
--   ist_moderator()
--   meldungen_liste(), meldung_entscheiden(),
--   beschwerden_liste(), beschwerde_entscheiden(), moderation_zahlen()
--                                 nur für Moderatoren
--
-- FERNMELDEGEHEIMNIS (TDDDG § 3, StGB § 206)
--
-- Moderatoren bekommen KEINEN Lesezugriff auf messages, chats oder
-- community_channel_messages. Sie sehen nur, was ein Beteiligter selbst mit
-- seiner Meldung freigegeben hat: den Klartext der einen gemeldeten Nachricht
-- und — bei Ende-zu-Ende-Verschlüsselung — den Schlüssel genau dieser einen
-- Nachricht (gemeinsam/krypto.js, meldebeleg/belegPruefen). Damit lässt sich
-- prüfen, dass der Text wirklich so verschickt wurde; kein anderer Inhalt des
-- Chats wird offengelegt. Melden darf eine Nachricht nur, wer im Chat ist.
--
-- KATEGORIE „kindesmissbrauch"
--
-- Der Beleg (Text, Medienadresse) wird gespeichert, aber meldungen_liste()
-- gibt ihn für diese Kategorie NICHT heraus: Moderatoren sollen solches
-- Material nicht ansehen (StGB § 184b). Sie entfernen den Inhalt vorläufig
-- und melden ihn dem BKA (Art. 18). Gesperrt wird das Konto erst, wenn eine
-- volljährige Person oder eine Meldestelle den Verdacht bestätigt hat —
-- sonst ließe sich die Kategorie als Waffe gegen Unschuldige benutzen
-- (Gate 2, Fund 5). Diese Meldungen stehen oben in der Liste.
--
-- ENTFERNEN UND WIEDERHERSTELLEN
--
-- „entfernen" löscht die Zeile, legt sie aber vorher vollständig im Beleg ab
-- (reports.entfernte_zeile). Hebt eine Beschwerde die Entscheidung auf, wird
-- die Zeile wieder eingefügt (Art. 20 Abs. 4). Was per cascade daran hing
-- (Likes, Kommentare), kommt nicht zurück — das steht in der Begründung.
-- Nachrichten werden nicht gelöscht, sondern wie „für alle löschen" geleert
-- (deleted_at) und beim Aufheben zurückgeschrieben.
--
-- VERHÄLTNIS ZU ALTEN CLIENTS
--
-- Der direkte Insert in reports (App/Website bis heute) bleibt erlaubt, aber
-- von dort kommen nur Art, Ziel und Grund: Beleg, Kategorie, betroffenes
-- Konto setzt der Auslöser selbst (Gate 2, Fund 1 — sonst ließe sich ein
-- Beleg fälschen und ein Unschuldiger sperren). Lesen können Clients
-- reports nicht mehr direkt, nur über meine_meldungen() (Fund 14). Neue
-- Clients rufen inhalt_melden() und fallen bei fehlender Funktion auf den
-- alten Weg zurück.
--
-- SPERREN WIRKEN
--
-- Ein Bann 'alles' (profile_bans, Schema 11) verhindert Beiträge, Kommentare,
-- Storys, Nachrichten, Communitys und Uploads (Regel nicht_gesperrt). Lesen,
-- Kontostatus und Widerspruch bleiben möglich (Gate 2, Fund 2).
--
-- GATE 2 (25.10.2026)
--
-- Gutachten: 02 Projekte/All Media/Recht/All-Media-Gutachten-RS3-25-10-2026.md.
-- Behoben: 1–8, 10–17, 19, 20, 24–26, 29, 31, 33. Offen (Kästen-Blatt):
-- 9 teilweise (Bündeln je Ziel), 18 (Community weich sperren), 21 (Melden
-- ohne Konto), 22 (Löschfristen), 34 (Rolle leitung).
--
-- Feature-Schema: erst beim Abschluss der Supabase-Sperre einspielen (nach
-- 100, 101). Probe: app/test/_probe102.js (verworfene Transaktion).
--
-- Einspielen:
--   SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs SUPABASE_SCHEMA_102_melden_moderation.sql
-- Danach: npm run test:rechte, test:schema, test:minderjaehrig, test:angriffe
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. reports erweitern
-- ---------------------------------------------------------------------

alter table public.reports alter column reported_by drop not null;
alter table public.reports alter column target_id drop not null;
alter table public.reports drop constraint if exists reports_reported_by_fkey;
alter table public.reports
  add constraint reports_reported_by_fkey
  foreign key (reported_by) references public.profiles (id) on delete set null;

alter table public.reports add column if not exists kategorie text not null default 'regelverstoss';
alter table public.reports add column if not exists status text not null default 'eingegangen';
alter table public.reports add column if not exists ziel_profil uuid references public.profiles (id) on delete set null;
alter table public.reports add column if not exists beleg jsonb not null default '{}'::jsonb;
alter table public.reports add column if not exists gutglaeubig boolean not null default false;
alter table public.reports add column if not exists massnahme text;
alter table public.reports add column if not exists begruendung text;
alter table public.reports add column if not exists grundlage text;
alter table public.reports add column if not exists sperre_bis timestamptz;
alter table public.reports add column if not exists entschieden_von uuid references public.profiles (id) on delete set null;
alter table public.reports add column if not exists entschieden_am timestamptz;
alter table public.reports add column if not exists entfernte_zeile jsonb;
-- Begründung an den Betroffenen zurückgestellt (Ermittlungen, Gate 2 Fund 17):
-- der fertige Text wartet hier, bis begruendung_nachsenden() ihn verschickt.
alter table public.reports add column if not exists mitteilung_zurueck text;

-- Moderativ entfernte Nachricht (Codex-Fund F2, 31.10.2026). Nachrichten
-- werden nicht gelöscht, nur geleert (Antworten behalten ihren Bezug) —
-- ohne Marke holte der Absender per UPDATE den alten Text zurück. Setzen
-- und zurücknehmen nur meldung_entscheiden() / beschwerde_entscheiden();
-- der Auslöser nachricht_moderiert (Abschnitt 6) verbietet Clients jede
-- Änderung solcher Zeilen und das Setzen der Spalte.
alter table public.messages add column if not exists moderiert_am timestamptz;

-- Moderativ entfernte Community (Codex-Fund F5, 31.10.2026): ausblenden
-- statt löschen. `delete from communities` riss per cascade Unterthemen,
-- deren Nachrichten, Sprachnachrichten und Mitgliedschaften mit; ein
-- erfolgreicher Widerspruch brachte nur die Community-Zeile zurück. Jetzt
-- bleibt alles stehen und ist für Clients unsichtbar und unbeschreibbar
-- (Abschnitt 6, community_ausgeblendet). Endgültig löschen erst nach der
-- Widerspruchsfrist über community_entfernte_loeschen() — ohne Cron.
alter table public.communities add column if not exists moderiert_am timestamptz;

-- Moderativ entfernte Beiträge und Kommentare (Codex-Fund F11, 02.11.2026):
-- ebenfalls ausblenden statt löschen. `delete from posts` riss per cascade
-- alle Kommentare (auch fremde), Likes, Sammlungen und Markierungen mit,
-- `delete from comments` alle fremden Antworten (comments.reply_to, Schema
-- 92) samt Likes; der Widerspruch brachte nur die Zielzeile zurück. Jetzt
-- bleibt alles stehen, ist für Clients unsichtbar und unbeschreibbar
-- (Abschnitt 6, beitrag_ausgeblendet/kommentar_ausgeblendet), und der
-- Widerspruch nimmt nur die Marke weg. Endgültig löschen nach der Frist:
-- beitraege_entfernte_loeschen(), ohne Cron.
alter table public.posts add column if not exists moderiert_am timestamptz;
alter table public.comments add column if not exists moderiert_am timestamptz;

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'comment', 'story', 'user', 'message', 'community',
                         'kanal_nachricht', 'problem'));

alter table public.reports drop constraint if exists reports_kategorie_check;
alter table public.reports add constraint reports_kategorie_check
  check (kategorie in ('kindesmissbrauch', 'gewalt_drohung', 'hass', 'mobbing', 'sexuell',
                       'selbstverletzung', 'betrug_spam', 'urheberrecht', 'privatsphaere',
                       'jugendgefaehrdend', 'falschinfo', 'sonstiges_recht', 'regelverstoss',
                       'problem'));

alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check
  check (status in ('eingegangen', 'entschieden', 'erledigt'));

alter table public.reports drop constraint if exists reports_massnahme_check;
alter table public.reports add constraint reports_massnahme_check
  check (massnahme is null or massnahme in ('keine', 'entfernen', 'sperren', 'entfernen_sperren', 'warnen'));

alter table public.reports drop constraint if exists reports_grundlage_check;
alter table public.reports add constraint reports_grundlage_check
  check (grundlage is null or grundlage in ('gesetz', 'regeln'));

create index if not exists reports_offen on public.reports (status, created_at) where status = 'eingegangen';
create index if not exists reports_ziel_profil on public.reports (ziel_profil);

-- Der direkte Insert (App/Website vor RS 3) darf nur Art, Ziel und Grund
-- bestimmen. Alles andere setzt dieser Auslöser — Beleg leer, Kategorie aus
-- dem Präfix „[schluessel]" des Grundes (neue Clients ohne Schema 102),
-- betroffenes Konto aus der Datenbank, nie vom Client (Gate 2, Fund 1).
-- inhalt_melden() setzt vor seinem Insert den Schalter `allmedia.melden`;
-- Clients können ihn über PostgREST nicht setzen.
create or replace function public.meldung_vorbelegen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
begin
  new.status := 'eingegangen';
  new.massnahme := null; new.begruendung := null; new.grundlage := null; new.sperre_bis := null;
  new.entschieden_von := null; new.entschieden_am := null; new.entfernte_zeile := null;
  if current_setting('allmedia.melden', true) = 'an' then
    return new;
  end if;

  if new.target_type is null or new.target_type not in ('post', 'comment', 'story', 'user', 'message')
     or new.target_id is null then
    raise exception 'Diese Meldung geht nur über inhalt_melden()' using errcode = '22023';
  end if;
  new.reported_by := auth.uid();
  new.gutglaeubig := false;
  new.beleg := jsonb_build_object('weg', 'alt');
  k := substring(coalesce(new.reason, '') from '^\[([a-z_]+)\]');
  new.kategorie := case when k in ('kindesmissbrauch', 'gewalt_drohung', 'hass', 'mobbing', 'sexuell',
      'selbstverletzung', 'betrug_spam', 'urheberrecht', 'privatsphaere', 'jugendgefaehrdend',
      'falschinfo', 'sonstiges_recht', 'regelverstoss') then k else 'regelverstoss' end;
  new.ziel_profil := case new.target_type
    when 'post' then (select user_id from public.posts where id = new.target_id)
    when 'comment' then (select user_id from public.comments where id = new.target_id)
    when 'story' then (select user_id from public.stories where id = new.target_id)
    when 'user' then (select id from public.profiles where id = new.target_id)
    when 'message' then (select sender_id from public.messages
                          where id = new.target_id and public.is_chat_member(chat_id))
    end;
  -- Keine Selbstmeldung, wie in inhalt_melden() (Codex-Fund F8, 31.10.2026):
  -- Sonst erführe man als Meldender die Begründung einer Entscheidung über
  -- sich selbst, auch wenn sie den Betroffenen gegenüber zurückgestellt ist.
  if new.ziel_profil is not null and new.ziel_profil = auth.uid() then
    raise exception 'Eigene Inhalte kannst du nicht melden' using errcode = '22023';
  end if;
  -- Dieselbe Meldung noch einmal: still übergehen, der alte Client sagt trotzdem „Danke".
  if exists (select 1 from public.reports where reported_by = new.reported_by and status = 'eingegangen'
              and target_type = new.target_type and target_id = new.target_id and kategorie = new.kategorie) then
    return null;
  end if;
  -- Bremse wie in inhalt_melden().
  if (select count(*) from public.reports
       where reported_by = new.reported_by and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Zu viele Meldungen in kurzer Zeit' using errcode = '54000';
  end if;
  return new;
end $$;
revoke execute on function public.meldung_vorbelegen() from public, anon, authenticated;

drop trigger if exists meldung_vorbelegen on public.reports;
create trigger meldung_vorbelegen before insert on public.reports
  for each row execute function public.meldung_vorbelegen();

-- Clients dürfen nur einfügen — nie lesen, ändern oder löschen. Lesen der
-- eigenen Meldungen nur über meine_meldungen(): Die ganze Zeile gab den
-- Moderator (entschieden_von) und die entfernte Zeile preis (Gate 2, Fund 14).
-- Alte Clients fügen ohne Rücklesen ein (return=minimal).
drop policy if exists "Eigene Meldungen lesen" on public.reports;
revoke select, update, delete, truncate, references, trigger on public.reports from anon, authenticated;
revoke all on public.reports from anon;


-- ---------------------------------------------------------------------
-- 2. Moderatoren, Beschwerden, Protokoll
-- ---------------------------------------------------------------------

create table if not exists public.moderatoren (
  user_id uuid primary key references auth.users (id) on delete cascade,
  rolle text not null default 'moderation' check (rolle in ('moderation', 'leitung')),
  seit timestamptz not null default now()
);
alter table public.moderatoren enable row level security;
revoke all on public.moderatoren from anon, authenticated;
grant select on public.moderatoren to authenticated;
drop policy if exists "Eigene Rolle lesen" on public.moderatoren;
create policy "Eigene Rolle lesen" on public.moderatoren
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists nur_freigegebene on public.moderatoren;
create policy nur_freigegebene on public.moderatoren
  as restrictive for all to authenticated
  using ((select public.konto_freigegeben())) with check ((select public.konto_freigegeben()));

create table if not exists public.beschwerden (
  id uuid primary key default gen_random_uuid(),
  meldung_id uuid not null references public.reports (id) on delete cascade,
  von uuid references public.profiles (id) on delete set null,
  rolle text not null check (rolle in ('betroffen', 'meldend')),
  text text not null default '',
  status text not null default 'offen' check (status in ('offen', 'bestaetigt', 'aufgehoben')),
  begruendung text,
  entschieden_von uuid references public.profiles (id) on delete set null,
  entschieden_am timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists beschwerden_offen on public.beschwerden (status, created_at) where status = 'offen';
create unique index if not exists beschwerden_einmal on public.beschwerden (meldung_id, von);
alter table public.beschwerden enable row level security;
revoke all on public.beschwerden from anon, authenticated;
grant select on public.beschwerden to authenticated;
drop policy if exists "Eigene Beschwerden lesen" on public.beschwerden;
create policy "Eigene Beschwerden lesen" on public.beschwerden
  for select to authenticated using (von = (select auth.uid()));
drop policy if exists nur_freigegebene on public.beschwerden;
create policy nur_freigegebene on public.beschwerden
  as restrictive for all to authenticated
  using ((select public.konto_freigegeben())) with check ((select public.konto_freigegeben()));

create table if not exists public.moderation_protokoll (
  nr bigserial primary key,
  wer uuid references public.profiles (id) on delete set null,
  was text not null,
  meldung_id uuid references public.reports (id) on delete set null,
  beschwerde_id uuid references public.beschwerden (id) on delete set null,
  daten jsonb not null default '{}'::jsonb,
  zeit timestamptz not null default now()
);
alter table public.moderation_protokoll enable row level security;
revoke all on public.moderation_protokoll from anon, authenticated;
drop policy if exists nur_freigegebene on public.moderation_protokoll;
create policy nur_freigegebene on public.moderation_protokoll
  as restrictive for all to authenticated
  using ((select public.konto_freigegeben())) with check ((select public.konto_freigegeben()));


-- ---------------------------------------------------------------------
-- 3. Hilfsfunktionen
-- ---------------------------------------------------------------------

create or replace function public.ist_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Nur Volljährige mit bekanntem Geburtsdatum (Gate 2, Fund 20): Moderatoren
  -- sehen Belege zu Gewalt, Sexuellem, Selbstverletzung.
  select auth.uid() is not null
     and public.konto_freigegeben()
     and exists (select 1 from public.moderatoren where user_id = auth.uid())
     and coalesce(
           (select public.alter_in_jahren(ka.geburtsdatum) from public.konto_alter ka
             where ka.user_id = auth.uid() and ka.geburtsdatum is not null),
           (select public.alter_in_jahren(p.geburtsdatum) from public.profiles p
             where p.id = auth.uid() and p.geburtsdatum is not null),
           0) >= 18;
$$;
revoke execute on function public.ist_moderator() from public, anon;
grant execute on function public.ist_moderator() to authenticated;

-- Eine Mitteilung ohne Absender (Art 'system'): Eingangsbestätigung,
-- Entscheidung, Begründung. Nicht stummschaltbar — es sind Rechtsmitteilungen.
create or replace function public.rechtsmitteilung(p_an uuid, p_text text, p_meldung uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_an is null then return; end if;
  insert into public.notifications (user_id, actor_id, art, bereich, target_type, target_id, text)
  values (p_an, null, 'system', 'system', null, p_meldung, left(p_text, 2000));
end $$;
revoke execute on function public.rechtsmitteilung(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.massnahme_text(p_massnahme text, p_bis timestamptz)
returns text
language sql
stable
set search_path = public
as $$
  select case p_massnahme
    when 'keine' then 'Wir haben nichts entfernt und nichts gesperrt'
    when 'warnen' then 'Du bekommst eine Verwarnung; bei weiteren Verstößen kann dein Konto gesperrt werden'
    when 'entfernen' then 'Der Inhalt wurde entfernt'
    when 'sperren' then 'Das Konto wurde gesperrt' || coalesce(' bis ' || to_char(p_bis at time zone 'Europe/Berlin', 'DD.MM.YYYY'), ' ohne Enddatum')
    when 'entfernen_sperren' then 'Der Inhalt wurde entfernt und das Konto gesperrt'
         || coalesce(' bis ' || to_char(p_bis at time zone 'Europe/Berlin', 'DD.MM.YYYY'), ' ohne Enddatum')
    else '' end;
$$;
revoke execute on function public.massnahme_text(text, timestamptz) from public, anon, authenticated;

-- Dieselbe Entscheidung, aus Sicht der meldenden Person (Gate 2, Fund 10):
-- „Du bekommst eine Verwarnung" las sonst der Meldende.
create or replace function public.massnahme_text_meldend(p_massnahme text)
returns text
language sql
stable
set search_path = public
as $$
  select case p_massnahme
    when 'keine' then 'Wir haben nichts entfernt und nichts gesperrt'
    when 'warnen' then 'Die Person wurde verwarnt'
    when 'entfernen' then 'Der Inhalt wurde entfernt'
    when 'sperren' then 'Das Konto wurde gesperrt'
    when 'entfernen_sperren' then 'Der Inhalt wurde entfernt und das Konto gesperrt'
    else '' end;
$$;
revoke execute on function public.massnahme_text_meldend(text) from public, anon, authenticated;

-- Was der Gesperrte in profile_bans liest, solange die Begründung
-- zurückgestellt ist (Codex-Fund F3). Kein Wort über Anlass oder Behörden.
create or replace function public.sperrgrund_zurueckgestellt()
returns text
language sql
immutable
set search_path = public
as $$
  select 'Dein Konto ist nach einer Meldung gesperrt. Die Begründung bekommst du gesondert.'::text;
$$;
revoke execute on function public.sperrgrund_zurueckgestellt() from public, anon, authenticated;

-- Hilfsangebot bei Selbstverletzung — an die betroffene Person, egal wie
-- entschieden wird (Gate 2, Fund 16). Kein Art.-18-Pflichtfall.
create or replace function public.hilfe_text()
returns text
language sql
immutable
set search_path = public
as $$
  select 'Jemand macht sich Sorgen um dich. Wenn es dir nicht gut geht: TelefonSeelsorge '
      || '0800 111 0 111 oder 116 123 (rund um die Uhr, kostenlos), Nummer gegen Kummer 116 111. '
      || 'In akuter Gefahr: 110 oder 112.';
$$;
revoke execute on function public.hilfe_text() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. Melden
-- ---------------------------------------------------------------------

create or replace function public.inhalt_melden(
  p_art text,
  p_ziel uuid,
  p_kategorie text,
  p_begruendung text,
  p_gutglaeubig boolean default false,
  p_beleg jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ich      uuid := auth.uid();
  eigner   uuid;
  beleg    jsonb := '{}'::jsonb;
  zeile    jsonb;
  neu      public.reports%rowtype;
  begr     text := btrim(coalesce(p_begruendung, ''));
begin
  if ich is null or not public.konto_freigegeben() then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  if p_art is null or p_art not in ('post', 'comment', 'story', 'user', 'message', 'community',
                                     'kanal_nachricht', 'problem') then
    return jsonb_build_object('ok', false, 'grund', 'art');
  end if;
  if p_art = 'problem' then
    p_kategorie := 'problem';
  elsif p_kategorie is null or p_kategorie not in ('kindesmissbrauch', 'gewalt_drohung', 'hass', 'mobbing',
        'sexuell', 'selbstverletzung', 'betrug_spam', 'urheberrecht', 'privatsphaere',
        'jugendgefaehrdend', 'falschinfo', 'sonstiges_recht', 'regelverstoss') then
    return jsonb_build_object('ok', false, 'grund', 'kategorie');
  end if;
  -- Art. 16 Abs. 2 a/d DSA: hinreichend begründet und in gutem Glauben.
  -- Bei Kindesmissbrauch reicht die Kategorie — niemand soll das Material
  -- beschreiben müssen.
  if p_kategorie <> 'kindesmissbrauch' and length(begr) < 10 then
    return jsonb_build_object('ok', false, 'grund', 'begruendung');
  end if;
  if p_art <> 'problem' and not coalesce(p_gutglaeubig, false) then
    return jsonb_build_object('ok', false, 'grund', 'gutglaeubig');
  end if;
  if p_art <> 'problem' and p_ziel is null then
    return jsonb_build_object('ok', false, 'grund', 'ziel');
  end if;
  -- Bremse: zwanzig Meldungen je Stunde reichen jedem Menschen.
  if (select count(*) from public.reports
       where reported_by = ich and created_at > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('ok', false, 'grund', 'zu_viele');
  end if;
  -- Dasselbe Ziel mit derselben Kategorie noch offen gemeldet: dieselbe
  -- Meldung zurückgeben, keine zweite Zeile (Gate 2, Fund 9). Eine andere
  -- Kategorie (z. B. erst Hass, dann Kindesmissbrauch) ist eine neue Meldung.
  if p_art <> 'problem' then
    select id into neu.id from public.reports
     where reported_by = ich and status = 'eingegangen' and target_type = p_art and target_id = p_ziel
       and kategorie = p_kategorie
     limit 1;
    if neu.id is not null then
      return jsonb_build_object('ok', true, 'id', neu.id, 'schon', true);
    end if;
  end if;

  -- Ziel nachschlagen, Beleg sichern. Wer etwas nicht sehen kann, kann es
  -- auch nicht melden (gleiche Antwort wie „gibt es nicht").
  if p_art = 'post' then
    select user_id, jsonb_build_object('beschreibung', description, 'titel', title, 'medien', media_url,
                                       'art', kind, 'erstellt', created_at)
      into eigner, beleg from public.posts where id = p_ziel and public.beitrag_sichtbar(user_id, demo);
  elsif p_art = 'comment' then
    select c.user_id, jsonb_build_object('text', c.text, 'beitrag', c.post_id, 'erstellt', c.created_at)
      into eigner, beleg from public.comments c join public.posts p on p.id = c.post_id
     where c.id = p_ziel and public.beitrag_sichtbar(p.user_id, p.demo);
  elsif p_art = 'story' then
    -- Dieselbe Bedingung wie die Leseregel „Aktuelle Storys lesen" (Schema 68), Gate 2, Fund 15.
    select user_id, jsonb_build_object('medien', media_url, 'text', caption, 'erstellt', created_at)
      into eigner, beleg from public.stories s
     where s.id = p_ziel and s.expires_at > now()
       and public.sichtbar_fuer(s.user_id, 'story', ich)
       and (s.in_videos or (s.in_messenger and public.ist_messenger_kontakt(s.user_id, ich))
            or public.ist_story_markiert(s.id, ich));
  elsif p_art = 'user' then
    -- Wartende Kinderkonten sind für niemanden da (Schema 52/101).
    select id, jsonb_build_object('name', name, 'handle', handle, 'info', about)
      into eigner, beleg from public.profiles where id = p_ziel and public.konto_stand(id) = 'frei';
  elsif p_art = 'community' then
    select created_by, jsonb_build_object('name', name, 'thema', topic, 'bio', bio, 'link', link)
      into eigner, beleg from public.communities where id = p_ziel and public.community_sichtbar(id);
  elsif p_art = 'kanal_nachricht' then
    select sender_id, jsonb_build_object('text', text, 'medien', media_url, 'datei', file_name,
                                         'kanal', channel_id, 'erstellt', created_at)
      into eigner, beleg from public.community_channel_messages
     where id = p_ziel and public.kanal_sichtbar(channel_id);
  elsif p_art = 'message' then
    -- Nur Beteiligte. Gespeichert wird, was der Server ohnehin hat (Chiffre,
    -- Medienadresse), dazu der Klartext, den der Meldende freigibt, und bei
    -- E2E der Schlüssel GENAU DIESER Nachricht (p_beleg.sitzung).
    select sender_id, jsonb_build_object('chat', chat_id, 'medien', media_url, 'datei', file_name,
                                         'krypto', krypto, 'chiffre', chiffre, 'nonce', krypto_nonce,
                                         'klartext_server', case when krypto is null or krypto = 0 then text end,
                                         'erstellt', created_at)
      into eigner, beleg from public.messages m
     where m.id = p_ziel and m.deleted_at is null and public.is_chat_member(m.chat_id);
    if found then
      -- Der Sitzungsschlüssel ist 32 Byte, Base64 genau 44 Zeichen — alles
      -- andere ist kein Schlüssel (Gate 2, Fund 29).
      beleg := beleg || jsonb_build_object(
        'klartext_gemeldet', left(coalesce(p_beleg ->> 'text', ''), 5000),
        'sitzung', case when coalesce(p_beleg ->> 'sitzung', '') ~ '^[A-Za-z0-9+/]{43}=$'
                        then p_beleg ->> 'sitzung' end);
    end if;
  end if;

  -- select … into setzt beleg auf NULL, wenn es das Ziel nicht gibt.
  if p_art <> 'problem' and (beleg is null or beleg = '{}'::jsonb) then
    return jsonb_build_object('ok', false, 'grund', 'ziel');
  end if;
  if eigner = ich then
    return jsonb_build_object('ok', false, 'grund', 'selbst');
  end if;

  beleg := coalesce(beleg, '{}'::jsonb);
  -- Nur auf diesem Weg darf der Auslöser Beleg und Kategorie stehen lassen.
  perform set_config('allmedia.melden', 'an', true);
  insert into public.reports (reported_by, target_type, target_id, reason, kategorie, ziel_profil,
                              beleg, gutglaeubig)
  values (ich, p_art, p_ziel, left(begr, 4000), p_kategorie, eigner, beleg, coalesce(p_gutglaeubig, false))
  returning * into neu;
  perform set_config('allmedia.melden', '', true);

  -- Art. 16 Abs. 4 DSA: Eingangsbestätigung.
  perform public.rechtsmitteilung(ich,
    case when p_art = 'problem'
         then 'Danke, deine Nachricht ist angekommen. Wir melden uns, sobald wir sie bearbeitet haben.'
         else 'Danke, deine Meldung ist angekommen. Wir prüfen sie und sagen dir, was wir entschieden haben.' end,
    neu.id);

  return jsonb_build_object('ok', true, 'id', neu.id);
end $$;
revoke execute on function public.inhalt_melden(text, uuid, text, text, boolean, jsonb) from public, anon;
grant execute on function public.inhalt_melden(text, uuid, text, text, boolean, jsonb) to authenticated;

-- Meine Meldungen mit Stand. Auch Meldende dürfen widersprechen (Art. 20, auch
-- gegen „Nichts tun“): widerspruch_bis und beschwerde_status wie im Kontostatus,
-- sonst bliebe „Widersprechen“ nach dem Widerspruch stehen.
-- Neue Spalten ändern den Rückgabetyp; create or replace allein lehnt das ab.
drop function if exists public.meine_meldungen();
create function public.meine_meldungen()
returns table (id uuid, art text, kategorie text, status text, massnahme text, begruendung text,
               erstellt timestamptz, entschieden timestamptz, widerspruch_bis timestamptz,
               beschwerde_status text)
language sql
stable
security definer
set search_path = public
as $$
  -- Selbst gemeldet und zurückgestellt (Altbestand vor F8): Begründung erst
  -- nach dem Nachsenden, wie in mich_betreffende_entscheidungen().
  select r.id, r.target_type, r.kategorie, r.status, r.massnahme,
         case when r.ziel_profil = r.reported_by and r.mitteilung_zurueck is not null then null
              else r.begruendung end,
         r.created_at, r.entschieden_am,
         case when r.status = 'entschieden' then r.entschieden_am + interval '6 months' end,
         (select b.status from public.beschwerden b where b.meldung_id = r.id and b.von = auth.uid())
    from public.reports r
   where r.reported_by = auth.uid() and public.konto_freigegeben()
   order by r.created_at desc
   limit 200;
$$;
revoke execute on function public.meine_meldungen() from public, anon;
grant execute on function public.meine_meldungen() to authenticated;

-- Kontostatus: Entscheidungen, die mich betreffen (Art. 17), mit dem
-- Hinweis, ob ich noch widersprechen kann (sechs Monate, Art. 20).
-- Bewusst ohne konto_freigegeben() (Gate 2, Fund 26): Wer von einer
-- Entscheidung betroffen ist, muss sie lesen und ihr widersprechen können.
create or replace function public.mich_betreffende_entscheidungen()
returns table (id uuid, art text, kategorie text, massnahme text, begruendung text, grundlage text,
               sperre_bis timestamptz, entschieden timestamptz, widerspruch_bis timestamptz,
               beschwerde_status text)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.target_type, r.kategorie, r.massnahme, r.begruendung, r.grundlage, r.sperre_bis,
         r.entschieden_am, r.entschieden_am + interval '6 months',
         (select b.status from public.beschwerden b where b.meldung_id = r.id and b.von = auth.uid())
    from public.reports r
   where r.ziel_profil = auth.uid()
     and r.status = 'entschieden'
     and r.massnahme is not null and r.massnahme <> 'keine'
     and r.mitteilung_zurueck is null
   order by r.entschieden_am desc
   limit 200;
$$;
revoke execute on function public.mich_betreffende_entscheidungen() from public, anon;
grant execute on function public.mich_betreffende_entscheidungen() to authenticated;

create or replace function public.entscheidung_widersprechen(p_meldung uuid, p_text text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ich uuid := auth.uid();
  r   public.reports%rowtype;
  rolle text;
  neu uuid;
begin
  if ich is null then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  -- for update: gegen community_entfernte_loeschen() (Codex-Fund F10).
  select * into r from public.reports where id = p_meldung for update;
  if r.id is null or r.status <> 'entschieden' then
    return jsonb_build_object('ok', false, 'grund', 'meldung');
  end if;
  -- Zurückgestellt (Codex-Fund F3): Für den Betroffenen gibt es die
  -- Entscheidung erst mit der Mitteilung — auch nicht über eine geratene ID.
  if r.ziel_profil = ich and r.mitteilung_zurueck is not null then
    return jsonb_build_object('ok', false, 'grund', 'meldung');
  end if;
  if r.ziel_profil = ich then rolle := 'betroffen';
  elsif r.reported_by = ich then rolle := 'meldend';
  else return jsonb_build_object('ok', false, 'grund', 'meldung');
  end if;
  if r.entschieden_am < now() - interval '6 months' then
    return jsonb_build_object('ok', false, 'grund', 'frist');
  end if;
  if exists (select 1 from public.beschwerden where meldung_id = p_meldung and von = ich) then
    return jsonb_build_object('ok', false, 'grund', 'schon');
  end if;
  insert into public.beschwerden (meldung_id, von, rolle, text)
  values (p_meldung, ich, rolle, left(btrim(coalesce(p_text, '')), 4000))
  returning id into neu;
  perform public.rechtsmitteilung(ich,
    'Dein Widerspruch ist angekommen. Ein Mensch prüft die Entscheidung noch einmal. Den Stand siehst du unter '
    || case rolle when 'betroffen' then 'Einstellungen → Kontostatus.' else 'Einstellungen → Meine Meldungen.' end,
    p_meldung);
  return jsonb_build_object('ok', true, 'id', neu);
end $$;
revoke execute on function public.entscheidung_widersprechen(uuid, text) from public, anon;
grant execute on function public.entscheidung_widersprechen(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 5. Moderation (nur Moderatoren)
-- ---------------------------------------------------------------------

-- Ohne die Fälle, in denen der Moderator selbst gemeldet hat oder betroffen
-- ist (Gate 2, Fund 13). art18 = im Protokoll steht, dass das BKA informiert ist.
drop function if exists public.meldungen_liste(text);
create or replace function public.meldungen_liste(p_status text default 'eingegangen')
returns table (id uuid, art text, ziel uuid, kategorie text, begruendung_meldung text, status text,
               ziel_profil uuid, ziel_name text, ziel_handle text, meldende uuid, beleg jsonb,
               beleg_verborgen boolean, gleiches_ziel bigint, erstellt timestamptz,
               massnahme text, begruendung text, entschieden timestamptz, art18 boolean,
               zurueckgestellt boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.ist_moderator() then
    raise exception 'nicht erlaubt' using errcode = '42501';
  end if;
  return query
    select r.id, r.target_type, r.target_id, r.kategorie, r.reason, r.status,
           r.ziel_profil, p.name, p.handle, r.reported_by,
           case when r.kategorie = 'kindesmissbrauch' then null else r.beleg end,
           r.kategorie = 'kindesmissbrauch',
           (select count(*) from public.reports x where x.target_id = r.target_id and x.target_type = r.target_type),
           r.created_at, r.massnahme, r.begruendung, r.entschieden_am,
           exists (select 1 from public.moderation_protokoll m where m.meldung_id = r.id and m.was = 'art18_gemeldet'),
           r.mitteilung_zurueck is not null
      from public.reports r
      left join public.profiles p on p.id = r.ziel_profil
     where (p_status = 'alle' or r.status = p_status)
       and r.ziel_profil is distinct from auth.uid() and r.reported_by is distinct from auth.uid()
     order by case r.kategorie when 'kindesmissbrauch' then 0
                               when 'gewalt_drohung' then 1 when 'selbstverletzung' then 1 else 2 end,
              r.created_at
     limit 500;
end $$;
revoke execute on function public.meldungen_liste(text) from public, anon;
grant execute on function public.meldungen_liste(text) to authenticated;

-- p_bestaetigt: nur bei Kindesmissbrauch und Kontosperre — wer den Verdacht
-- bestätigt hat (volljährige Person, Meldestelle, BKA), Gate 2, Fund 5.
-- p_zurueckstellen: Begründung an den Betroffenen erst später schicken, weil
-- sie Ermittlungen gefährden würde (Kindesmissbrauch, Drohung; Gate 2,
-- Fund 17). Der Text wartet in reports.mitteilung_zurueck.
drop function if exists public.meldung_entscheiden(uuid, text, text, text, integer, text);
create or replace function public.meldung_entscheiden(
  p_id uuid,
  p_massnahme text,
  p_begruendung text,
  p_grundlage text,
  p_sperre_tage integer default null,
  p_bestaetigt text default null,
  p_zurueckstellen boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ich   uuid := auth.uid();
  r     public.reports%rowtype;
  zeile jsonb;
  bis   timestamptz;
  begr  text := btrim(coalesce(p_begruendung, ''));
  anlass text;
  text_betroffen text;
  sperrt boolean := p_massnahme in ('sperren', 'entfernen_sperren');
  rechtsbehelf constant text :=
    ' Du kannst innerhalb von sechs Monaten in der App widersprechen (Einstellungen → Kontostatus). '
    || 'Außerdem kannst du dich an eine zertifizierte außergerichtliche Streitbeilegungsstelle '
    || 'oder an ein Gericht wenden. Diese Entscheidung hat ein Mensch getroffen, nicht ein Automat.';
begin
  if not public.ist_moderator() then
    raise exception 'nicht erlaubt' using errcode = '42501';
  end if;
  select * into r from public.reports where id = p_id for update;
  if r.id is null then return jsonb_build_object('ok', false, 'grund', 'meldung'); end if;
  if r.status <> 'eingegangen' then return jsonb_build_object('ok', false, 'grund', 'schon_entschieden'); end if;
  if r.ziel_profil = ich or r.reported_by = ich then
    return jsonb_build_object('ok', false, 'grund', 'befangen');
  end if;
  if p_massnahme is null or p_massnahme not in ('keine', 'entfernen', 'sperren', 'entfernen_sperren', 'warnen') then
    return jsonb_build_object('ok', false, 'grund', 'massnahme');
  end if;
  if r.target_type = 'problem' then
    update public.reports set status = 'erledigt', massnahme = 'keine', begruendung = nullif(begr, ''),
           entschieden_von = ich, entschieden_am = now() where id = p_id;
    insert into public.moderation_protokoll (wer, was, meldung_id) values (ich, 'problem_erledigt', p_id);
    perform public.rechtsmitteilung(r.reported_by,
      coalesce('Zu deiner Nachricht: ' || nullif(begr, ''), 'Deine Nachricht ist bearbeitet.'), p_id);
    return jsonb_build_object('ok', true);
  end if;
  -- Art. 17 Abs. 3: Tatsachen und Grundlage gehören in jede Begründung.
  if length(begr) < 20 then return jsonb_build_object('ok', false, 'grund', 'begruendung'); end if;
  if p_massnahme <> 'keine' and (p_grundlage is null or p_grundlage not in ('gesetz', 'regeln')) then
    return jsonb_build_object('ok', false, 'grund', 'grundlage');
  end if;
  -- Art. 17 Abs. 3 d: bei Rechtsverstoß die Vorschrift nennen.
  if p_massnahme <> 'keine' and p_grundlage = 'gesetz' and begr !~ '(§|Art\.)' then
    return jsonb_build_object('ok', false, 'grund', 'norm');
  end if;
  if sperrt and r.ziel_profil is null then
    return jsonb_build_object('ok', false, 'grund', 'kein_konto');
  end if;
  -- Kindesmissbrauch: Inhalt sofort weg ja, Konto erst nach Bestätigung (Fund 5).
  if r.kategorie = 'kindesmissbrauch' and p_massnahme <> 'keine' and p_grundlage <> 'gesetz' then
    return jsonb_build_object('ok', false, 'grund', 'grundlage');
  end if;
  if r.kategorie = 'kindesmissbrauch' and sperrt and length(btrim(coalesce(p_bestaetigt, ''))) < 10 then
    return jsonb_build_object('ok', false, 'grund', 'bestaetigung');
  end if;
  -- Ohne Enddatum nur in schweren Fällen; sonst befristet (BGH III ZR 179/20, DSA Art. 23; Fund 19).
  if sperrt and coalesce(p_sperre_tage, 0) <= 0 and r.kategorie not in ('kindesmissbrauch', 'gewalt_drohung') then
    return jsonb_build_object('ok', false, 'grund', 'sperre_dauer');
  end if;
  if p_massnahme in ('entfernen', 'entfernen_sperren') and r.target_type = 'user' then
    return jsonb_build_object('ok', false, 'grund', 'massnahme');
  end if;
  if coalesce(p_zurueckstellen, false)
     and (r.kategorie not in ('kindesmissbrauch', 'gewalt_drohung') or p_massnahme = 'keine') then
    return jsonb_build_object('ok', false, 'grund', 'zurueckstellen');
  end if;
  if p_sperre_tage is not null and p_sperre_tage > 0 then
    bis := now() + make_interval(days => least(p_sperre_tage, 3650));
  end if;

  -- Entfernen: vollständige Zeile sichern, dann löschen bzw. leeren. Ist der
  -- Inhalt schon weg (frühere Entscheidung, selbst gelöscht), wird nichts
  -- behauptet (Fund 9).
  if p_massnahme in ('entfernen', 'entfernen_sperren') then
    -- Beitrag und Kommentar: ausblenden statt löschen (Codex-Fund F11).
    if r.target_type = 'post' then
      select to_jsonb(x) into zeile from public.posts x where id = r.target_id and moderiert_am is null;
      update public.posts set moderiert_am = now() where id = r.target_id and moderiert_am is null;
    elsif r.target_type = 'comment' then
      select to_jsonb(x) into zeile from public.comments x where id = r.target_id and moderiert_am is null;
      update public.comments set moderiert_am = now() where id = r.target_id and moderiert_am is null;
    elsif r.target_type = 'story' then
      select to_jsonb(x) into zeile from public.stories x where id = r.target_id;
      delete from public.stories where id = r.target_id;
    elsif r.target_type = 'kanal_nachricht' then
      select to_jsonb(x) into zeile from public.community_channel_messages x where id = r.target_id;
      delete from public.community_channel_messages where id = r.target_id;
    elsif r.target_type = 'community' then
      select to_jsonb(x) into zeile from public.communities x where id = r.target_id and moderiert_am is null;
      update public.communities set moderiert_am = now() where id = r.target_id;
    elsif r.target_type = 'message' then
      select to_jsonb(x) into zeile from public.messages x where id = r.target_id and deleted_at is null;
      update public.messages
         set deleted_at = now(), text = '',
             -- Gültiger unverschlüsselter Leerzustand (Codex-Fund F7): krypto = 1
             -- ohne Chiffre verletzt messages_krypto_stimmig (Schema 31) und
             -- rollte die ganze Entscheidung samt Sperre zurück.
             krypto = 0, chiffre = null, krypto_nonce = null, absender_schluessel = null,
             media_url = null, media_type = null, file_name = null, file_size = null,
             moderiert_am = now()
       where id = r.target_id;
    end if;
    if zeile is null then
      return jsonb_build_object('ok', false, 'grund', 'ziel_weg');
    end if;
  end if;

  -- Der Gesperrte liest seine Sperre (Schema 11, „Eigene Banne lesen“).
  -- Bei zurückgestellter Begründung steht dort darum nur ein neutraler Satz;
  -- begruendung_nachsenden() trägt die Begründung nach (Codex-Fund F3).
  if sperrt then
    insert into public.profile_bans (user_id, bereich, grund, ausloeser, bis_at)
    values (r.ziel_profil, 'alles',
            case when coalesce(p_zurueckstellen, false) then public.sperrgrund_zurueckgestellt()
                 else left(begr, 500) end,
            'meldung:' || p_id::text, bis);
  end if;

  update public.reports
     set status = 'entschieden', massnahme = p_massnahme, begruendung = begr, grundlage = p_grundlage,
         sperre_bis = bis, entschieden_von = ich, entschieden_am = now(), entfernte_zeile = zeile
   where id = p_id;
  insert into public.moderation_protokoll (wer, was, meldung_id, daten)
  values (ich, 'entschieden', p_id, jsonb_build_object('massnahme', p_massnahme, 'grundlage', p_grundlage,
                                                       'bis', bis, 'bestaetigt', nullif(btrim(coalesce(p_bestaetigt, '')), ''),
                                                       'zurueckgestellt', coalesce(p_zurueckstellen, false)));

  -- Art. 16 Abs. 5: Meldenden informieren — aus seiner Sicht, mit allen Rechtsbehelfen (Fund 10, 12).
  -- Ist der Meldende selbst betroffen (Altbestand vor F8), gilt für ihn die
  -- Zurückstellung: keine Mitteilung jetzt, begruendung_nachsenden() schickt
  -- sie ihm als Betroffenem (Codex-Fund F8).
  if not (coalesce(p_zurueckstellen, false) and r.reported_by is not distinct from r.ziel_profil) then
  perform public.rechtsmitteilung(r.reported_by,
    'Wir haben deine Meldung geprüft. ' || public.massnahme_text_meldend(p_massnahme) || '. '
    || 'Begründung: ' || begr
    || ' Du kannst innerhalb von sechs Monaten widersprechen (Einstellungen → Meine Meldungen). '
    || 'Außerdem kannst du dich an eine zertifizierte außergerichtliche Streitbeilegungsstelle '
    || 'oder an ein Gericht wenden.', p_id);
  end if;
  -- Art. 17: Betroffenen informieren (nur, wenn etwas passiert ist) — mit
  -- Anlass und Fundstelle (Abs. 3 b, Abs. 4; Fund 11). Bei Kindesmissbrauch
  -- kein Auszug und kein Wort über Behörden (Fund 17).
  anlass := 'Anlass war eine Meldung zu ' || case r.target_type
      when 'post' then 'deinem Beitrag' when 'comment' then 'deinem Kommentar'
      when 'story' then 'deiner Story' when 'user' then 'deinem Profil'
      when 'message' then 'deiner Nachricht' when 'community' then 'deiner Community'
      when 'kanal_nachricht' then 'deiner Nachricht in einem Unterthema' else 'deinem Inhalt' end
    || case when r.target_type = 'user' then ''
            else ' vom ' || to_char(coalesce((coalesce(zeile, r.beleg) ->> 'created_at')::timestamptz,
                                             (r.beleg ->> 'erstellt')::timestamptz, r.created_at)
                                    at time zone 'Europe/Berlin', 'DD.MM.YYYY') end
    || case when r.kategorie = 'kindesmissbrauch' then ''
            else coalesce(': „' || left(nullif(btrim(coalesce(coalesce(zeile, r.beleg) ->> 'title', '')
                   || ' ' || coalesce(coalesce(zeile, r.beleg) ->> 'description',
                                      coalesce(zeile, r.beleg) ->> 'beschreibung',
                                      coalesce(zeile, r.beleg) ->> 'text',
                                      coalesce(zeile, r.beleg) ->> 'caption',
                                      coalesce(zeile, r.beleg) ->> 'name', '')), ''), 80) || '“', '') end
    || '.';
  if p_massnahme <> 'keine' then
    text_betroffen := public.massnahme_text(p_massnahme, bis) || '. ' || anlass || ' '
      || 'Grund: ' || case p_grundlage when 'gesetz' then 'Verstoß gegen geltendes Recht'
                                      else 'Verstoß gegen die Community-Richtlinien' end
      || '. Begründung: ' || begr || '.' || rechtsbehelf
      || case when r.kategorie = 'selbstverletzung' then ' ' || public.hilfe_text() else '' end;
    if coalesce(p_zurueckstellen, false) then
      update public.reports set mitteilung_zurueck = text_betroffen where id = p_id;
    else
      perform public.rechtsmitteilung(r.ziel_profil, text_betroffen, p_id);
    end if;
  elsif r.kategorie = 'selbstverletzung' then
    perform public.rechtsmitteilung(r.ziel_profil, public.hilfe_text(), p_id);
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.meldung_entscheiden(uuid, text, text, text, integer, text, boolean) from public, anon;
grant execute on function public.meldung_entscheiden(uuid, text, text, text, integer, text, boolean) to authenticated;

-- Die zurückgestellte Begründung jetzt verschicken (Ermittlungen erlauben es).
-- Erst danach sieht der Betroffene die Entscheidung im Kontostatus.
create or replace function public.begruendung_nachsenden(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ich uuid := auth.uid();
  r   public.reports%rowtype;
begin
  if not public.ist_moderator() then
    raise exception 'nicht erlaubt' using errcode = '42501';
  end if;
  select * into r from public.reports where id = p_id for update;
  if r.id is null then return jsonb_build_object('ok', false, 'grund', 'meldung'); end if;
  if r.ziel_profil = ich or r.reported_by = ich then
    return jsonb_build_object('ok', false, 'grund', 'befangen');
  end if;
  if r.mitteilung_zurueck is null then return jsonb_build_object('ok', true, 'schon', true); end if;
  perform public.rechtsmitteilung(r.ziel_profil, r.mitteilung_zurueck, p_id);
  -- Die Widerspruchsfrist (sechs Monate ab Entscheidung) beginnt mit der Mitteilung.
  update public.reports set mitteilung_zurueck = null, entschieden_am = now() where id = p_id;
  update public.profile_bans set grund = left(r.begruendung, 500)
   where ausloeser = 'meldung:' || p_id::text and grund = public.sperrgrund_zurueckgestellt();
  insert into public.moderation_protokoll (wer, was, meldung_id) values (ich, 'begruendung_nachgesandt', p_id);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.begruendung_nachsenden(uuid) from public, anon;
grant execute on function public.begruendung_nachsenden(uuid) to authenticated;

-- Kindesmissbrauch, zweite Stufe (Gate 2, Fund 5): Der Inhalt ist schon
-- entfernt, die Kontosperre folgt erst, wenn der Verdacht bestätigt ist.
create or replace function public.sperre_nachtragen(
  p_id uuid, p_sperre_tage integer, p_bestaetigt text, p_begruendung text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ich  uuid := auth.uid();
  r    public.reports%rowtype;
  bis  timestamptz;
  begr text := btrim(coalesce(p_begruendung, ''));
begin
  if not public.ist_moderator() then
    raise exception 'nicht erlaubt' using errcode = '42501';
  end if;
  select * into r from public.reports where id = p_id for update;
  if r.id is null then return jsonb_build_object('ok', false, 'grund', 'meldung'); end if;
  if r.ziel_profil = ich or r.reported_by = ich then
    return jsonb_build_object('ok', false, 'grund', 'befangen');
  end if;
  if r.kategorie <> 'kindesmissbrauch' or r.status <> 'entschieden' or r.massnahme is distinct from 'entfernen' then
    return jsonb_build_object('ok', false, 'grund', 'massnahme');
  end if;
  if r.ziel_profil is null then return jsonb_build_object('ok', false, 'grund', 'kein_konto'); end if;
  if length(btrim(coalesce(p_bestaetigt, ''))) < 10 then
    return jsonb_build_object('ok', false, 'grund', 'bestaetigung');
  end if;
  if length(begr) < 20 then return jsonb_build_object('ok', false, 'grund', 'begruendung'); end if;
  if begr !~ '(§|Art\.)' then return jsonb_build_object('ok', false, 'grund', 'norm'); end if;
  if p_sperre_tage is not null and p_sperre_tage > 0 then
    bis := now() + make_interval(days => least(p_sperre_tage, 3650));
  end if;
  insert into public.profile_bans (user_id, bereich, grund, ausloeser, bis_at)
  values (r.ziel_profil, 'alles',
          case when r.mitteilung_zurueck is not null then public.sperrgrund_zurueckgestellt()
               else left(begr, 500) end,
          'meldung:' || p_id::text, bis);
  update public.reports set massnahme = 'entfernen_sperren', sperre_bis = bis,
         begruendung = r.begruendung || ' ' || begr where id = p_id;
  insert into public.moderation_protokoll (wer, was, meldung_id, daten)
  values (ich, 'sperre_nachgetragen', p_id, jsonb_build_object('bis', bis, 'bestaetigt', btrim(p_bestaetigt)));
  -- Wurde die Begründung zurückgestellt, kommt die Sperre in denselben Text.
  if r.mitteilung_zurueck is not null then
    update public.reports
       set mitteilung_zurueck = public.massnahme_text('sperren', bis) || '. ' || mitteilung_zurueck
     where id = p_id;
  else
    perform public.rechtsmitteilung(r.ziel_profil,
      public.massnahme_text('sperren', bis) || '. Grund: Verstoß gegen geltendes Recht. Begründung: ' || begr
      || '. Du kannst innerhalb von sechs Monaten in der App widersprechen (Einstellungen → Kontostatus). '
      || 'Außerdem kannst du dich an eine zertifizierte außergerichtliche Streitbeilegungsstelle '
      || 'oder an ein Gericht wenden. Diese Entscheidung hat ein Mensch getroffen, nicht ein Automat.', p_id);
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.sperre_nachtragen(uuid, integer, text, text) from public, anon;
grant execute on function public.sperre_nachtragen(uuid, integer, text, text) to authenticated;

-- Gate 2, Fund 7: wer ein gemeldetes Medium ansieht, steht im Protokoll.
-- Der Server ruft das vor dem Unterschreiben; ohne Eintrag keine Adresse.
create or replace function public.medium_abruf_vermerken(p_meldung uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ich uuid := auth.uid();
  r   public.reports%rowtype;
begin
  if not public.ist_moderator() then
    raise exception 'nicht erlaubt' using errcode = '42501';
  end if;
  select * into r from public.reports where id = p_meldung;
  if r.id is null or r.kategorie = 'kindesmissbrauch' or r.status <> 'eingegangen'
     or r.ziel_profil = ich or r.reported_by = ich then
    return jsonb_build_object('ok', false, 'grund', 'medium');
  end if;
  insert into public.moderation_protokoll (wer, was, meldung_id) values (ich, 'medium_angesehen', p_meldung);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.medium_abruf_vermerken(uuid) from public, anon;
grant execute on function public.medium_abruf_vermerken(uuid) to authenticated;

-- Art. 18 DSA: Das BKA ist informiert (u-entrance) — Aktenzeichen oder Datum
-- ins Protokoll. Ohne Vermerk lässt sich die Pflicht nicht nachweisen (Fund 6).
create or replace function public.art18_vermerken(p_meldung uuid, p_vermerk text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ich uuid := auth.uid();
  v   text := btrim(coalesce(p_vermerk, ''));
begin
  if not public.ist_moderator() then
    raise exception 'nicht erlaubt' using errcode = '42501';
  end if;
  if not exists (select 1 from public.reports where id = p_meldung) then
    return jsonb_build_object('ok', false, 'grund', 'meldung');
  end if;
  if length(v) < 5 then return jsonb_build_object('ok', false, 'grund', 'vermerk'); end if;
  insert into public.moderation_protokoll (wer, was, meldung_id, daten)
  values (ich, 'art18_gemeldet', p_meldung, jsonb_build_object('vermerk', left(v, 500)));
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.art18_vermerken(uuid, text) from public, anon;
grant execute on function public.art18_vermerken(uuid, text) to authenticated;

create or replace function public.beschwerden_liste(p_status text default 'offen')
returns table (id uuid, meldung_id uuid, rolle text, text text, status text, erstellt timestamptz,
               art text, kategorie text, massnahme text, begruendung_entscheidung text,
               entschieden_von_mir boolean, beleg jsonb, beleg_verborgen boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.ist_moderator() then
    raise exception 'nicht erlaubt' using errcode = '42501';
  end if;
  return query
    select b.id, b.meldung_id, b.rolle, b.text, b.status, b.created_at,
           r.target_type, r.kategorie, r.massnahme, r.begruendung, r.entschieden_von = auth.uid(),
           case when r.kategorie = 'kindesmissbrauch' then null else r.beleg end,
           r.kategorie = 'kindesmissbrauch'
      from public.beschwerden b join public.reports r on r.id = b.meldung_id
     where (p_status = 'alle' or b.status = p_status)
       and r.ziel_profil is distinct from auth.uid() and r.reported_by is distinct from auth.uid()
     order by b.created_at
     limit 500;
end $$;
revoke execute on function public.beschwerden_liste(text) from public, anon;
grant execute on function public.beschwerden_liste(text) to authenticated;

-- Art. 20 Abs. 4: Ist die Beschwerde begründet, wird die Entscheidung
-- rückgängig gemacht — Inhalt zurück, Sperre aufgehoben.
create or replace function public.beschwerde_entscheiden(p_id uuid, p_ergebnis text, p_begruendung text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ich uuid := auth.uid();
  b   public.beschwerden%rowtype;
  r   public.reports%rowtype;
  begr text := btrim(coalesce(p_begruendung, ''));
begin
  if not public.ist_moderator() then
    raise exception 'nicht erlaubt' using errcode = '42501';
  end if;
  select * into b from public.beschwerden where id = p_id for update;
  if b.id is null or b.status <> 'offen' then return jsonb_build_object('ok', false, 'grund', 'beschwerde'); end if;
  if p_ergebnis is null or p_ergebnis not in ('bestaetigt', 'aufgehoben') then
    return jsonb_build_object('ok', false, 'grund', 'ergebnis');
  end if;
  if length(begr) < 20 then return jsonb_build_object('ok', false, 'grund', 'begruendung'); end if;
  select * into r from public.reports where id = b.meldung_id for update;
  if r.ziel_profil = ich or r.reported_by = ich then
    return jsonb_build_object('ok', false, 'grund', 'befangen');
  end if;
  -- Zweitprüfung durch eine andere Person, sobald es mehr als einen Moderator gibt (Fund 13).
  if r.entschieden_von = ich and (select count(*) from public.moderatoren) > 1 then
    return jsonb_build_object('ok', false, 'grund', 'zweitpruefung');
  end if;

  -- Meldende Person hat recht: die Meldung wird wieder geöffnet und neu
  -- entschieden (Art. 20 Abs. 4 — Fund 3). Bisher stand sie „entschieden",
  -- und eine neue Entscheidung war gesperrt.
  if p_ergebnis = 'aufgehoben' and b.rolle = 'meldend' then
    update public.reports
       set status = 'eingegangen', massnahme = null, begruendung = null, grundlage = null,
           sperre_bis = null, entschieden_von = null, entschieden_am = null
     where id = r.id;
  end if;

  if p_ergebnis = 'aufgehoben' and b.rolle = 'betroffen' then
    -- Wiederherstellen im Namen der betroffenen Person: der Wächter aus
    -- Schema 66 (nur_eigene_aktion) lässt das nur mit diesem Schalter zu (Fund 4).
    perform set_config('allmedia.wiederherstellen', 'an', true);
    if r.entfernte_zeile is not null then
      -- Beitrag/Kommentar ausgeblendet, nicht gelöscht (F11): Marke weg,
      -- Kommentare, Antworten und Likes sind wieder da. Ältere Entscheidungen
      -- (vor F11) haben gelöscht: dann wenigstens die Zielzeile zurück.
      if r.target_type = 'post' then
        update public.posts set moderiert_am = null where id = r.target_id;
        if not found then
          insert into public.posts
            select * from jsonb_populate_record(null::public.posts, r.entfernte_zeile - 'moderiert_am')
            on conflict (id) do nothing;
        end if;
      elsif r.target_type = 'comment' then
        update public.comments set moderiert_am = null where id = r.target_id;
        if not found then
          insert into public.comments
            select * from jsonb_populate_record(null::public.comments, r.entfernte_zeile - 'moderiert_am')
            on conflict (id) do nothing;
        end if;
      elsif r.target_type = 'story' then
        insert into public.stories select * from jsonb_populate_record(null::public.stories, r.entfernte_zeile)
          on conflict (id) do nothing;
      elsif r.target_type = 'kanal_nachricht' then
        insert into public.community_channel_messages
          select * from jsonb_populate_record(null::public.community_channel_messages, r.entfernte_zeile)
          on conflict (id) do nothing;
      elsif r.target_type = 'community' then
        -- Ausgeblendet, nicht gelöscht (F5): Marke weg, alles ist wieder da.
        -- Ältere Entscheidungen (vor F5) haben die Zeile gelöscht: dann
        -- wenigstens die Community-Zeile zurück.
        update public.communities set moderiert_am = null where id = r.target_id;
        if not found then
          insert into public.communities
            select * from jsonb_populate_record(null::public.communities, r.entfernte_zeile - 'moderiert_am')
            on conflict (id) do nothing;
        end if;
      elsif r.target_type = 'message' then
        update public.messages m
           set deleted_at = (r.entfernte_zeile ->> 'deleted_at')::timestamptz,
               text = r.entfernte_zeile ->> 'text',
               krypto = coalesce((r.entfernte_zeile ->> 'krypto')::smallint, 0),
               chiffre = r.entfernte_zeile ->> 'chiffre',
               krypto_nonce = r.entfernte_zeile ->> 'krypto_nonce',
               absender_schluessel = r.entfernte_zeile ->> 'absender_schluessel',
               media_url = r.entfernte_zeile ->> 'media_url',
               media_type = r.entfernte_zeile ->> 'media_type',
               file_name = r.entfernte_zeile ->> 'file_name',
               file_size = (r.entfernte_zeile ->> 'file_size')::bigint,
               moderiert_am = null
         where m.id = r.target_id;
      end if;
    end if;
    perform set_config('allmedia.wiederherstellen', '', true);
    update public.profile_bans set aufgehoben = true where ausloeser = 'meldung:' || r.id::text;
  end if;

  update public.beschwerden set status = p_ergebnis, begruendung = begr, entschieden_von = ich,
         entschieden_am = now() where id = p_id;
  insert into public.moderation_protokoll (wer, was, meldung_id, beschwerde_id, daten)
  values (ich, 'beschwerde_' || p_ergebnis, r.id, p_id,
          jsonb_build_object('gleiche_person', r.entschieden_von = ich));
  perform public.rechtsmitteilung(b.von,
    case
      when p_ergebnis = 'aufgehoben' and b.rolle = 'meldend'
        then 'Wir haben deinen Widerspruch geprüft und deine Meldung wieder geöffnet. Ein Mensch entscheidet neu; '
             || 'die neue Entscheidung bekommst du als Mitteilung (Einstellungen → Meine Meldungen). '
      when p_ergebnis = 'aufgehoben'
        then 'Wir haben deinen Widerspruch geprüft und die Entscheidung aufgehoben (Einstellungen → Kontostatus). '
      when b.rolle = 'betroffen'
        then 'Wir haben deinen Widerspruch geprüft und bleiben bei der Entscheidung (Einstellungen → Kontostatus). '
      else 'Wir haben deinen Widerspruch geprüft und bleiben bei der Entscheidung (Einstellungen → Meine Meldungen). ' end
    || 'Begründung: ' || begr
    || case when p_ergebnis = 'aufgehoben' and b.rolle = 'betroffen'
                 and r.target_type in ('story', 'kanal_nachricht')
            then ' Likes und Kommentare, die am Inhalt hingen, kommen nicht zurück.'
            else '' end
    || ' Du kannst dich an eine zertifizierte außergerichtliche Streitbeilegungsstelle oder an ein Gericht wenden.',
    r.id);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.beschwerde_entscheiden(uuid, text, text) from public, anon;
grant execute on function public.beschwerde_entscheiden(uuid, text, text) to authenticated;

-- Zahlen für den Transparenzbericht (DSA Art. 15 und 24).
create or replace function public.moderation_zahlen(p_von timestamptz, p_bis timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.ist_moderator() then
    raise exception 'nicht erlaubt' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'meldungen', (select count(*) from public.reports where created_at >= p_von and created_at < p_bis),
    'je_kategorie', (select coalesce(jsonb_object_agg(kategorie, n), '{}'::jsonb) from
                      (select kategorie, count(*) n from public.reports
                        where created_at >= p_von and created_at < p_bis group by kategorie) k),
    'je_massnahme', (select coalesce(jsonb_object_agg(massnahme, n), '{}'::jsonb) from
                      (select massnahme, count(*) n from public.reports
                        where entschieden_am >= p_von and entschieden_am < p_bis and massnahme is not null
                        group by massnahme) m),
    'median_stunden', (select round(extract(epoch from percentile_cont(0.5) within group
                         (order by entschieden_am - created_at)) / 3600.0, 1)
                         from public.reports where entschieden_am >= p_von and entschieden_am < p_bis),
    'beschwerden', (select count(*) from public.beschwerden where created_at >= p_von and created_at < p_bis),
    'aufgehoben', (select count(*) from public.beschwerden
                    where status = 'aufgehoben' and entschieden_am >= p_von and entschieden_am < p_bis),
    'automatisiert', 0);
end $$;
revoke execute on function public.moderation_zahlen(timestamptz, timestamptz) from public, anon;
grant execute on function public.moderation_zahlen(timestamptz, timestamptz) to authenticated;


-- ---------------------------------------------------------------------
-- 6. Wiederherstellen, Sperren wirken, Medien für Moderatoren (Gate 2)
-- ---------------------------------------------------------------------

-- Gewinner 102, ersetzt Schema 66 — gleich bis auf den Schalter
-- `allmedia.wiederherstellen`. Ihn setzt nur beschwerde_entscheiden(), wenn
-- ein entfernter Kommentar seiner Verfasserin zurückgegeben wird (Fund 4).
-- Clients können ihn über PostgREST nicht setzen.
create or replace function public.nur_eigene_aktion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  spalte constant text := tg_argv[0];
  wer    uuid;
  ich    uuid := auth.uid();
begin
  if current_setting('allmedia.wiederherstellen', true) = 'an' then
    return new;
  end if;

  wer := nullif(to_jsonb(new) ->> spalte, '')::uuid;

  -- Kein Besitzer: das entscheidet die Spalte selbst (not null).
  if wer is null then
    return new;
  end if;

  -- Der Normalfall: man handelt für sich selbst.
  if ich is not null and wer = ich then
    return new;
  end if;

  -- Testbestand: Demoprofile und die beiden Testkonten dürfen befüllt werden.
  if public.ist_testkonto(wer)
     or exists (select 1 from public.profiles p where p.id = wer and p.demo) then
    return new;
  end if;

  if ich is not null then
    raise exception 'Nur im eigenen Namen: % in % für ein fremdes Konto abgelehnt (Schema 66).',
      spalte, tg_table_name
      using errcode = '42501';
  end if;

  raise warning 'Schema 66: % für ein echtes Konto ohne Anmeldung übersprungen (%).',
    tg_table_name, wer;
  return null;
end;
$$;
revoke all on function public.nur_eigene_aktion() from public, anon, authenticated;

-- Eine Sperre wirkt (Fund 2): Wer einen Bann 'alles' hat (Schema 11,
-- profile_bans), kann nichts veröffentlichen, kommentieren, schreiben oder
-- hochladen. Lesen, Kontostatus und Widerspruch bleiben.
create or replace function public.nicht_gesperrt()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not public.gesperrt(auth.uid(), 'alles');
$$;
revoke execute on function public.nicht_gesperrt() from public, anon;
grant execute on function public.nicht_gesperrt() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['posts', 'comments', 'stories', 'messages', 'community_channel_messages', 'communities'] loop
    execute format('drop policy if exists nicht_gesperrt on public.%I', t);
    execute format('create policy nicht_gesperrt on public.%I as restrictive for insert to authenticated '
                   'with check ((select public.nicht_gesperrt()))', t);
  end loop;
end $$;
drop policy if exists nicht_gesperrt on storage.objects;
create policy nicht_gesperrt on storage.objects
  as restrictive for insert to authenticated with check ((select public.nicht_gesperrt()));

-- Die Sperre wirkt auch aufs Ändern (Codex-Fund F2, 31.10.2026): Vorher
-- galt nicht_gesperrt nur für INSERT — ein Gesperrter schrieb per UPDATE
-- neue Beleidigungen in alte Beiträge, Kommentare und Nachrichten.
-- Zurücknehmen der eigenen Nachricht (leeren mit deleted_at) bleibt
-- erlaubt, Löschen (DELETE) ohnehin. Lesebestätigung und Anrufstatus
-- schreiben Definer-Funktionen bzw. INSERTs, sie sind nicht betroffen.
do $$
declare t text;
begin
  foreach t in array array['posts', 'comments', 'stories', 'community_channel_messages', 'communities'] loop
    execute format('drop policy if exists nicht_gesperrt_aendern on public.%I', t);
    execute format('create policy nicht_gesperrt_aendern on public.%I as restrictive for update to authenticated '
                   'using (true) with check ((select public.nicht_gesperrt()))', t);
  end loop;
end $$;
drop policy if exists nicht_gesperrt_aendern on public.messages;
create policy nicht_gesperrt_aendern on public.messages
  as restrictive for update to authenticated
  using (true)
  with check ((select public.nicht_gesperrt())
              or (deleted_at is not null and coalesce(text, '') = '' and chiffre is null
                  and media_url is null));

-- Moderativ entfernte Nachricht bleibt entfernt (Codex-Fund F2). Kein
-- security definer: so sieht der Auslöser, ob der Client (authenticated)
-- schreibt oder eine Definer-Funktion (Eigentümer). Deckt auch das
-- Einfügen ab — spalten_fest (Schema 95) prüft nur UPDATE, darum steht
-- moderiert_am hier statt in dessen Liste. Die Moderation bekommt dadurch
-- keinen Lesezugriff auf messages (Fernmeldegeheimnis, Selbstprüfung 7).
create or replace function public.nachricht_moderiert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.moderiert_am is not null then
      raise exception 'Die Angabe „moderiert_am" lässt sich nicht setzen' using errcode = '42501';
    end if;
    return new;
  end if;
  if old.moderiert_am is not null then
    raise exception 'Diese Nachricht wurde nach einer Meldung entfernt und lässt sich nicht ändern'
      using errcode = '42501';
  end if;
  if new.moderiert_am is not null then
    raise exception 'Die Angabe „moderiert_am" lässt sich nicht setzen' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.nachricht_moderiert() from public, anon;
grant execute on function public.nachricht_moderiert() to authenticated;
drop trigger if exists nachricht_moderiert on public.messages;
create trigger nachricht_moderiert before insert or update on public.messages
  for each row execute function public.nachricht_moderiert();

-- Moderatoren sehen gemeldete Fotos und Videos (Fund 7): Die Leseregel aus
-- Schema 95 gibt Dateien nur über eine lesbare Zeile frei, und die Zeile
-- eines privaten Kontos kann der Moderator nicht lesen. Diese zweite Regel
-- öffnet NUR Dateien, die in einer offenen Meldung als Beleg stehen — nie
-- bei Kindesmissbrauch — und wiederholt bucket_id (eine zweite Regel wird
-- verodert und hebt sonst alles der ersten auf).
create or replace function public.gemeldetes_medium(pfad text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.ist_moderator()
     and exists (select 1 from public.reports r
                  where r.status = 'eingegangen' and r.kategorie <> 'kindesmissbrauch'
                    and r.beleg ->> 'medien' = public.medien_adresse(pfad));
$$;
revoke execute on function public.gemeldetes_medium(text) from public, anon;
grant execute on function public.gemeldetes_medium(text) to authenticated;

drop policy if exists "Gemeldete Medien prüfen" on storage.objects;
create policy "Gemeldete Medien prüfen" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and public.gemeldetes_medium(name));


-- Moderativ entfernte Community (Codex-Fund F5): für Clients unsichtbar
-- und unbeschreibbar — die Community, ihre Unterthemen, deren Nachrichten,
-- Sprachnachrichten, Mitgliedschaften und Beitrittsanfragen. Auch für den
-- Ersteller: Er bekommt die Entscheidung als Rechtsmitteilung und sieht
-- sie im Kontostatus. RESTRICTIVE, also zusätzlich zu allen bestehenden
-- Regeln. Definer-Funktionen (Moderation, Widerspruch) sind nicht betroffen.
create or replace function public.community_ausgeblendet(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.communities where id = p_community and moderiert_am is not null);
$$;
revoke execute on function public.community_ausgeblendet(uuid) from public, anon;
grant execute on function public.community_ausgeblendet(uuid) to authenticated;

create or replace function public.kanal_ausgeblendet(p_kanal uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.community_channels k join public.communities c on c.id = k.community_id
                  where k.id = p_kanal and c.moderiert_am is not null);
$$;
revoke execute on function public.kanal_ausgeblendet(uuid) from public, anon;
grant execute on function public.kanal_ausgeblendet(uuid) to authenticated;

drop policy if exists nicht_ausgeblendet on public.communities;
create policy nicht_ausgeblendet on public.communities as restrictive for all to authenticated
  using (moderiert_am is null) with check (moderiert_am is null);
do $$
declare t text;
begin
  foreach t in array array['community_members', 'community_channels', 'community_beitrittsanfragen'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists nicht_ausgeblendet on public.%I', t);
    execute format('create policy nicht_ausgeblendet on public.%I as restrictive for all to authenticated '
                   'using (not public.community_ausgeblendet(community_id)) '
                   'with check (not public.community_ausgeblendet(community_id))', t);
  end loop;
end $$;
drop policy if exists nicht_ausgeblendet on public.community_channel_messages;
create policy nicht_ausgeblendet on public.community_channel_messages as restrictive for all to authenticated
  using (not public.kanal_ausgeblendet(channel_id)) with check (not public.kanal_ausgeblendet(channel_id));
-- Sprachnachrichten hängen an Community und/oder Unterthema (Schema 90).
drop policy if exists nicht_ausgeblendet on public.ptt_messages;
create policy nicht_ausgeblendet on public.ptt_messages as restrictive for all to authenticated
  using (not public.community_ausgeblendet(community_id) and not public.kanal_ausgeblendet(channel_id))
  with check (not public.community_ausgeblendet(community_id) and not public.kanal_ausgeblendet(channel_id));

-- Moderativ entfernter Beitrag oder Kommentar (Codex-Fund F11): für Clients
-- unsichtbar und unbeschreibbar, auch für die Verfasserin — samt allen
-- Kommentaren am Beitrag und allen Antworten am Kommentar. Neue Likes,
-- Merkliste, Reposts, Teilen und Sammlungen gehen auf ausgeblendete Inhalte
-- nicht. Löschen geht auch nicht (Beleg bis zum Ende der Widerspruchsfrist;
-- konto_loeschen() läuft als Eigentümer und löscht trotzdem alles).
-- Nur für angemeldete Konten: anon liest posts/comments gar nicht (keine
-- Leseregel), und eine für anon aufrufbare Hilfsfunktion verriete, welche
-- Beiträge moderiert wurden (test:rechte/test:angriffe, 02.11.2026).
create or replace function public.beitrag_ausgeblendet(p_post uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.posts where id = p_post and moderiert_am is not null);
$$;
revoke execute on function public.beitrag_ausgeblendet(uuid) from public, anon;
grant execute on function public.beitrag_ausgeblendet(uuid) to authenticated;

-- Ein Kommentar ist ausgeblendet, wenn er selbst, sein Beitrag oder der
-- Kommentar oben, an dem er als Antwort hängt (reply_to zeigt immer auf die
-- Wurzel, Schema 92), ausgeblendet ist.
--
-- Schema 92 (comments.reply_to) ist live noch nicht eingespielt (Stand
-- 02.11.2026). Darum entstehen Funktion und Regel hier je nach Spalte:
-- ohne reply_to ohne den Antwort-Teil. Wird 92 später eingespielt, diesen
-- Block danach erneut ausführen (SUPABASE_REIHENFOLGE.md, Nachtrag 02.11.).
do $$
declare
  mit_antwort boolean := exists (select 1 from information_schema.columns
                                  where table_schema = 'public' and table_name = 'comments'
                                    and column_name = 'reply_to');
begin
  execute format($f$
    create or replace function public.kommentar_ausgeblendet(p_kommentar uuid)
    returns boolean
    language sql
    stable
    security definer
    set search_path = public
    as $b$
      select exists (
        select 1 from public.comments c
          %s
          join public.posts p on p.id = c.post_id
         where c.id = p_kommentar
           and (c.moderiert_am is not null or p.moderiert_am is not null %s));
    $b$;$f$,
    case when mit_antwort then 'left join public.comments w on w.id = c.reply_to' else '' end,
    case when mit_antwort then 'or w.moderiert_am is not null' else '' end);

  -- Die eigene Zeile prüft die Regel direkt (sonst sähe die Hilfsfunktion
  -- beim Einfügen die neue Zeile noch nicht), Beitrag und Wurzel über die
  -- Hilfsfunktionen.
  execute 'drop policy if exists nicht_ausgeblendet on public.comments';
  execute format(
    'create policy nicht_ausgeblendet on public.comments as restrictive for all to authenticated '
    'using (%1$s) with check (%1$s)',
    'moderiert_am is null and not public.beitrag_ausgeblendet(post_id)'
    || case when mit_antwort then ' and (reply_to is null or not public.kommentar_ausgeblendet(reply_to))' else '' end);
end $$;
revoke execute on function public.kommentar_ausgeblendet(uuid) from public, anon;
grant execute on function public.kommentar_ausgeblendet(uuid) to authenticated;

drop policy if exists nicht_ausgeblendet on public.posts;
create policy nicht_ausgeblendet on public.posts as restrictive for all to authenticated
  using (moderiert_am is null) with check (moderiert_am is null);

do $$
declare t text;
begin
  foreach t in array array['post_likes', 'saves', 'reposts', 'shares', 'sammlung_inhalte',
                           'sammlung_beitraege', 'post_tags'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists nicht_ausgeblendet on public.%I', t);
    -- sammlung_inhalte.post_id darf null sein (andere Inhaltsarten).
    execute format('create policy nicht_ausgeblendet on public.%I as restrictive for insert to authenticated '
                   'with check (post_id is null or not public.beitrag_ausgeblendet(post_id))', t);
  end loop;
end $$;
drop policy if exists nicht_ausgeblendet on public.comment_likes;
create policy nicht_ausgeblendet on public.comment_likes as restrictive for insert to authenticated
  with check (not public.kommentar_ausgeblendet(comment_id));

-- Endgültig löschen nach Ablauf der Widerspruchsfrist (sechs Monate) und
-- ohne offenen Widerspruch. Nur Moderatoren, von Hand — kein Cron ohne
-- Henriks Ja. Gibt die Zahl der gelöschten Communitys zurück.
create or replace function public.community_entfernte_loeschen()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if not public.ist_moderator() then
    raise exception 'Nur für Moderatoren' using errcode = '42501';
  end if;
  -- Die Frist läuft ab der Mitteilung, nicht ab dem Ausblenden (Codex-
  -- Fund F10): begruendung_nachsenden() setzt entschieden_am neu, und
  -- solange die Begründung zurückgestellt ist, läuft gar keine Frist.
  -- Die Meldungszeilen werden gesperrt (for update), entscheidung_
  -- widersprechen() sperrt dieselbe Zeile: ein gleichzeitiger Widerspruch
  -- wartet und sieht danach keine Community mehr — oder die Löschung
  -- wartet und sieht den Widerspruch.
  perform 1 from public.reports r
    join public.communities c on c.id = r.target_id
   where r.target_type = 'community' and c.moderiert_am is not null
   for update of r;
  delete from public.communities c
   where c.moderiert_am is not null and c.moderiert_am < now() - interval '6 months'
     and exists (select 1 from public.reports r
                  where r.target_type = 'community' and r.target_id = c.id and r.status = 'entschieden'
                    and r.massnahme in ('entfernen', 'entfernen_sperren'))
     and not exists (select 1 from public.reports r
                      where r.target_type = 'community' and r.target_id = c.id and r.status = 'entschieden'
                        and (r.mitteilung_zurueck is not null or r.entschieden_am >= now() - interval '6 months'))
     and not exists (select 1 from public.reports r join public.beschwerden b on b.meldung_id = r.id
                      where r.target_type = 'community' and r.target_id = c.id and b.status = 'offen');
  get diagnostics n = row_count;
  insert into public.moderation_protokoll (wer, was, daten)
  values (auth.uid(), 'communitys_endgueltig_geloescht', jsonb_build_object('anzahl', n));
  return n;
end $$;
revoke execute on function public.community_entfernte_loeschen() from public, anon;
grant execute on function public.community_entfernte_loeschen() to authenticated;

-- Dasselbe für Beiträge und Kommentare (Codex-Fund F11), gleiche Frist-
-- regeln wie F10. Erst jetzt fallen Kommentare, Antworten und Likes per
-- cascade mit. Gibt die Zahl der gelöschten Beiträge plus Kommentare zurück.
create or replace function public.beitraege_entfernte_loeschen()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer; m integer;
begin
  if not public.ist_moderator() then
    raise exception 'Nur für Moderatoren' using errcode = '42501';
  end if;
  perform 1 from public.reports r
   where r.target_type in ('post', 'comment')
     and (exists (select 1 from public.posts p where p.id = r.target_id and p.moderiert_am is not null)
          or exists (select 1 from public.comments c where c.id = r.target_id and c.moderiert_am is not null))
   for update of r;
  delete from public.posts p
   where p.moderiert_am is not null and p.moderiert_am < now() - interval '6 months'
     and exists (select 1 from public.reports r
                  where r.target_type = 'post' and r.target_id = p.id and r.status = 'entschieden'
                    and r.massnahme in ('entfernen', 'entfernen_sperren'))
     and not exists (select 1 from public.reports r
                      where r.target_type = 'post' and r.target_id = p.id and r.status = 'entschieden'
                        and (r.mitteilung_zurueck is not null or r.entschieden_am >= now() - interval '6 months'))
     and not exists (select 1 from public.reports r join public.beschwerden b on b.meldung_id = r.id
                      where r.target_type = 'post' and r.target_id = p.id and b.status = 'offen');
  get diagnostics n = row_count;
  delete from public.comments c
   where c.moderiert_am is not null and c.moderiert_am < now() - interval '6 months'
     and exists (select 1 from public.reports r
                  where r.target_type = 'comment' and r.target_id = c.id and r.status = 'entschieden'
                    and r.massnahme in ('entfernen', 'entfernen_sperren'))
     and not exists (select 1 from public.reports r
                      where r.target_type = 'comment' and r.target_id = c.id and r.status = 'entschieden'
                        and (r.mitteilung_zurueck is not null or r.entschieden_am >= now() - interval '6 months'))
     and not exists (select 1 from public.reports r join public.beschwerden b on b.meldung_id = r.id
                      where r.target_type = 'comment' and r.target_id = c.id and b.status = 'offen');
  get diagnostics m = row_count;
  insert into public.moderation_protokoll (wer, was, daten)
  values (auth.uid(), 'beitraege_endgueltig_geloescht', jsonb_build_object('beitraege', n, 'kommentare', m));
  return n + m;
end $$;
revoke execute on function public.beitraege_entfernte_loeschen() from public, anon;
grant execute on function public.beitraege_entfernte_loeschen() to authenticated;


-- ---------------------------------------------------------------------
-- 7. Selbstprüfung
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['moderatoren', 'beschwerden', 'moderation_protokoll'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t
                    and policyname = 'nur_freigegebene' and permissive = 'RESTRICTIVE') then
      raise exception 'nur_freigegebene fehlt auf %', t;
    end if;
  end loop;
  if exists (select 1 from pg_policies where schemaname = 'public'
              and tablename in ('messages', 'chats', 'community_channel_messages')
              and (qual ilike '%moderator%' or with_check ilike '%moderator%')) then
    raise exception 'Moderatoren dürfen keine Leseregel auf Nachrichten haben (Fernmeldegeheimnis)';
  end if;
  if has_table_privilege('authenticated', 'public.moderatoren', 'insert')
     or has_table_privilege('authenticated', 'public.reports', 'update')
     or has_table_privilege('authenticated', 'public.reports', 'select') then
    raise exception 'Clients dürfen Moderatoren und Meldungen nicht ändern und Meldungen nicht direkt lesen';
  end if;
  foreach t in array array['posts', 'comments', 'stories', 'messages', 'community_channel_messages', 'communities'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t
                    and policyname = 'nicht_gesperrt' and permissive = 'RESTRICTIVE') then
      raise exception 'Sperre wirkt nicht auf %', t;
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t
                    and policyname = 'nicht_gesperrt_aendern' and permissive = 'RESTRICTIVE' and cmd = 'UPDATE') then
      raise exception 'Sperre wirkt nicht aufs Ändern in %', t;
    end if;
  end loop;
  if not exists (select 1 from pg_trigger where tgname = 'nachricht_moderiert'
                  and tgrelid = 'public.messages'::regclass) then
    raise exception 'Moderativ entfernte Nachrichten sind nicht geschützt';
  end if;
end $$;
