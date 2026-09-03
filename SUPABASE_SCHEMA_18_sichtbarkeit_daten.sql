-- ===========================================================================
--  Zwei fehlende Sichtbarkeiten und die Datenauskunft
-- ===========================================================================
--
--  TEIL 1 — wer darf kommentieren, wer darf mich markieren
--
--  Es gibt acht Sichtbarkeitsbereiche: Standort, Story, Repost, Onlinestatus,
--  Push-to-Talk, Likes, Download, Direktnachrichten. Zwei fehlen, und es sind
--  die beiden, wegen derer man so eine Einstellung überhaupt aufmacht:
--
--    - Wer darf unter meinen Beiträgen kommentieren?
--    - Wer darf mich in einem Beitrag markieren?
--
--  Beides ist der übliche Weg, auf dem Fremde an einem vorbeikommen. Ohne
--  diese zwei Stufen bleibt einem nur, das ganze Profil privat zu stellen —
--  dieselbe Lücke, die vor dem 01.09.2026 die dreistufige Sichtbarkeit hatte.
--
--  TEIL 2 — „Meine Daten herunterladen"
--
--  Die Einstellungen haben eine Datenschutzerklärung, aber keine Auskunft.
--  Artikel 15 und 20 DSGVO geben jedem das Recht, seine Daten zu sehen und
--  mitzunehmen, und zwar in einem gängigen, maschinenlesbaren Format. Für
--  eine App, die live gehen soll, ist das keine Zusatzfunktion.
--
--  Die Auskunft läuft über eine Datenbankfunktion und nicht über zwanzig
--  Abfragen im Server: so steht an einer Stelle, was „meine Daten" sind, und
--  eine neue Tabelle wird dort ergänzt statt in App und Website getrennt.
--
--  Einspielen:
--    node tools/sql-einspielen.mjs SUPABASE_SCHEMA_18_sichtbarkeit_daten.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  Teil 1: zwei Bereiche mehr
--
--  Die Prüfregel zählt die erlaubten Bereiche einzeln auf. Sie muss deshalb
--  ersetzt werden — ein `alter ... add` würde die alte nicht los, und dann
--  gälten beide.
-- ---------------------------------------------------------------------------

alter table public.visibility_settings
  drop constraint if exists visibility_settings_bereich_check;

alter table public.visibility_settings
  add constraint visibility_settings_bereich_check
  check (bereich in ('standort', 'story', 'repost', 'onlinestatus', 'ptt',
                     'likes', 'download', 'dm', 'kommentare', 'markierung'));

alter table public.visibility_exceptions
  drop constraint if exists visibility_exceptions_bereich_check;

alter table public.visibility_exceptions
  add constraint visibility_exceptions_bereich_check
  check (bereich in ('standort', 'story', 'repost', 'onlinestatus', 'ptt',
                     'likes', 'download', 'dm', 'kommentare', 'markierung'));


-- ---------------------------------------------------------------------------
--  Teil 2: die Datenauskunft
--
--  Gibt alles zurück, was zu diesem Konto gespeichert ist — als ein JSON.
--  `security definer` ist hier richtig und nicht bequem: die Funktion liest
--  ausschließlich Zeilen, die `auth.uid()` gehören, und die Prüfung steht
--  gleich in der ersten Zeile. Ohne sie käme man an die eigenen
--  Chatmitgliedschaften nicht heran, ohne die Leseregeln aller beteiligten
--  Tabellen aufzuweichen.
--
--  Nicht enthalten sind fremde Inhalte. Ein Chat gehört zwei Menschen; die
--  Nachrichten des Gegenübers sind dessen Daten, nicht die eigenen. Deshalb
--  stehen hier nur die selbst geschriebenen.
-- ---------------------------------------------------------------------------

create or replace function public.meine_daten()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  ich uuid := auth.uid();
begin
  if ich is null then
    raise exception 'Nicht angemeldet';
  end if;

  return jsonb_build_object(
    'erstellt_am', now(),
    'hinweis',
      'Auskunft nach Artikel 15 DSGVO. Enthalten ist, was zu diesem Konto '
      'gespeichert ist. Nachrichten anderer Menschen sind deren Daten und '
      'stehen deshalb nicht darin — auch nicht aus gemeinsamen Chats.',

    'profil', (
      select to_jsonb(p) - 'demo'
        from public.profiles p where p.id = ich
    ),

    'einstellungen', coalesce((
      select jsonb_object_agg(s.schluessel, s.wert)
        from public.user_settings s where s.user_id = ich
    ), '{}'::jsonb),

    'sichtbarkeit', coalesce((
      select jsonb_object_agg(v.bereich, jsonb_build_object(
               'stufe', v.stufe,
               'ausnahmen', coalesce((
                 select jsonb_agg(a.target_id)
                   from public.visibility_exceptions a
                  where a.user_id = ich and a.bereich = v.bereich
               ), '[]'::jsonb)))
        from public.visibility_settings v where v.user_id = ich
    ), '{}'::jsonb),

    'beitraege', coalesce((
      select jsonb_agg(to_jsonb(b))
        from public.posts b where b.user_id = ich
    ), '[]'::jsonb),

    'storys', coalesce((
      select jsonb_agg(to_jsonb(st))
        from public.stories st where st.user_id = ich
    ), '[]'::jsonb),

    'kommentare', coalesce((
      select jsonb_agg(to_jsonb(k))
        from public.comments k where k.user_id = ich
    ), '[]'::jsonb),

    'eigene_nachrichten', coalesce((
      select jsonb_agg(jsonb_build_object(
               'chat_id', m.chat_id, 'text', m.text, 'gesendet', m.created_at))
        from public.messages m where m.sender_id = ich
    ), '[]'::jsonb),

    'kontakte', coalesce((
      select jsonb_agg(jsonb_build_object('kontakt', k.contact_id, 'status', k.status))
        from public.contacts k where k.user_id = ich
    ), '[]'::jsonb),

    'folge_ich', coalesce((
      select jsonb_agg(f.followee_id) from public.follows f where f.follower_id = ich
    ), '[]'::jsonb),

    'communitys', coalesce((
      select jsonb_agg(jsonb_build_object('community', cm.community_id, 'seit', cm.joined_at))
        from public.community_members cm where cm.user_id = ich
    ), '[]'::jsonb),

    'likes', coalesce((
      select jsonb_agg(l.post_id) from public.post_likes l where l.user_id = ich
    ), '[]'::jsonb),

    'gespeichert', coalesce((
      select jsonb_agg(sv.post_id) from public.saves sv where sv.user_id = ich
    ), '[]'::jsonb),

    'blockiert', coalesce((
      select jsonb_agg(bl.blocked_user_id) from public.blocks bl where bl.user_id = ich
    ), '[]'::jsonb),

    'stummgeschaltet', coalesce((
      select jsonb_agg(mu.muted_user_id) from public.mutes mu where mu.user_id = ich
    ), '[]'::jsonb),

    /*
     * Die Aufrufe des eigenen Profils als Zahl, nicht als Liste. Wer wann
     * vorbeigeschaut hat, sind Daten über andere Menschen — die stehen
     * niemandem zu, auch nicht in der eigenen Auskunft.
     */
    'profilaufrufe_gesamt', (
      select count(*) from public.profile_views pv where pv.profile_id = ich
    ),

    'meldungen_von_mir', coalesce((
      select jsonb_agg(jsonb_build_object('ziel', r.target_type, 'grund', r.reason, 'am', r.created_at))
        from public.reports r where r.reported_by = ich
    ), '[]'::jsonb),

    'sperren_gegen_mich', coalesce((
      select jsonb_agg(to_jsonb(pb)) from public.profile_bans pb where pb.user_id = ich
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.meine_daten() to authenticated;

comment on function public.meine_daten() is
  'Auskunft nach Artikel 15 DSGVO fuer das angemeldete Konto. Gibt bewusst '
  'keine fremden Inhalte heraus — Nachrichten anderer aus gemeinsamen Chats '
  'sind deren Daten.';
