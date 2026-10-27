/**
 * Prüflauf: die Angriffe aus der Sicherheitsprüfung vom 16./17.10.2026.
 *
 * Start:  SUPABASE_TOKEN=… node test/_angriffe.js     (npm run test:angriffe)
 *
 * WARUM ÜBER DIE VERWALTUNGS-API UND NICHT ÜBER POSTGREST
 *
 * Jeder Angriff läuft als das Prüfkonto in genau der Rolle, die App und
 * Website auch haben (`set local role authenticated` + JWT-Angaben), in einer
 * Transaktion, die am Ende IMMER verworfen wird: das Ergebnis kommt als
 * Ausnahme zurück. Nichts davon bleibt in der Datenbank — auch nicht der Chat,
 * die Gruppe oder die Mitgliedschaft, die ein Angriff anzulegen versucht.
 * Darum lässt sich der Lauf gefahrlos neben einem Gesamtlauf starten, und er
 * misst auch dann, wenn PostgREST gesperrt ist (so geschehen ab 10.10.2026).
 *
 * WAS ER PRÜFT
 *
 * Für jede Lücke zwei Seiten: der Angriff muss scheitern, UND der normale
 * Weg daneben muss weiter gehen. Eine Regel, die beides sperrt, sähe in der
 * ersten Hälfte grün aus und hätte die App kaputt gemacht.
 *
 * Und eine Drift-Prüfung: Schema 47 hatte `starter_sammlungen` entzogen —
 * am 16.10. war sie wieder offen, vermutlich durch erneutes Einspielen einer
 * alten Datei. Deshalb steht hier, welche Funktionen anonym gehen dürfen
 * (genau zwei) und dass die Realtime-Veröffentlichung leer bleibt.
 */

const { frage } = require('./_aufraeumen');

const PRUEFKONTO = '62616c1d-82e2-4ee4-aab9-950e40e438a4'; // all.media.prueflauf@web.de
const TESTKONTO = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4'; // test@all-media.app
// Ein Chat, den das Prüfkonto am 06.09. angelegt und danach verlassen hat.
// Genau so ein Chat war der Weg zurück hinein.
const VERLASSENER_CHAT = 'a21f820f-4d73-4cd6-acf6-1e1da9bdb73b';
const ANNA = '11111111-a11e-4d1a-8000-000000000001'; // Figur des Testbestands, Kontakt des Prüfkontos
const BOB = '11111111-a11e-4d1a-8000-000000000002';

let fehler = 0;
let anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

/**
 * Einen plpgsql-Rumpf als Prüfkonto ausführen und wieder verwerfen.
 * Der Rumpf hängt Ergebnisse als `schluessel=wert ` an `erg` an.
 */
async function alsPruefkonto(rumpf) {
  const antwort = await frage(`
    begin;
    select set_config('request.jwt.claims', '{"sub":"${PRUEFKONTO}","role":"authenticated"}', true),
           set_config('request.jwt.claim.sub', '${PRUEFKONTO}', true);
    set local role authenticated;
    do $x$
    declare erg text := ''; n int; v uuid; v2 uuid; t text;
    begin
      ${rumpf}
      raise exception 'ERG:%', erg;
    end $x$;
  `);
  const text = JSON.stringify(antwort || '');
  const treffer = text.match(/ERG:(.*?)(\\n|")/);
  if (!treffer) throw new Error('Keine Antwort aus der Probe: ' + text.slice(0, 300));
  const werte = {};
  for (const paar of treffer[1].trim().split(/\s+/)) {
    const [k, ...rest] = paar.split('=');
    if (k) werte[k] = rest.join('=');
  }
  return werte;
}

// Ein Versuch: 'offen', wenn die Anweisung durchging, sonst 'zu'.
const versuch = (name, anweisung) => `
  begin ${anweisung}; erg := erg || '${name}=offen ';
  exception when others then erg := erg || '${name}=zu ';
  end;`;

// Ein normaler Weg: 'ok', wenn er durchging, sonst der Grund.
const weg = (name, anweisung) => `
  begin ${anweisung}; erg := erg || '${name}=ok ';
  exception when others then erg := erg || '${name}=' || replace(sqlstate, ' ', '_') || ' ';
  end;`;

(async () => {
  if (!process.env.SUPABASE_TOKEN) {
    console.log('ÜBERSPRUNGEN  SUPABASE_TOKEN fehlt — ohne ihn misst dieser Lauf nichts.');
    process.exit(2);
  }

  console.log('\nChats');
  const chats = await alsPruefkonto(`
    insert into chats (name, is_group, bereich, created_by) values ('x', true, 'messenger', auth.uid()) returning id into v;
    insert into chat_members (chat_id, user_id) values (v, auth.uid());
    ${weg('gruppe_mit_kontakt', `insert into chat_members (chat_id, user_id) values (v, '${BOB}')`)}
    ${versuch('gruppe_mit_fremdem', `insert into chat_members (chat_id, user_id) values (v, '${TESTKONTO}')`)}
    ${versuch('gruppe_umschalten', `update chats set is_group = false where id = v`)}
    ${versuch('zurueck_in_verlassenen_chat', `insert into chat_members (chat_id, user_id) values ('${VERLASSENER_CHAT}', auth.uid())`)}
    insert into chats (name, is_group, bereich, created_by) values (null, false, 'messenger', auth.uid()) returning id into v;
    ${weg('zweierchat_anlegen', `insert into chat_members (chat_id, user_id) values (v, auth.uid()), (v, '${ANNA}')`)}
    select anfrage_zustand into t from chats where id = v; erg := erg || 'anfrage=' || coalesce(t, '-') || ' ';
    ${versuch('anfrage_von_leeren', `update chats set anfrage_von = null where id = v`)}
    ${versuch('dritter_im_zweierchat', `insert into chat_members (chat_id, user_id) values (v, '${BOB}')`)}
    -- Die erste Nachricht (bei wartender Anfrage ist es genau eine) versucht
    -- zugleich, Zeit und Systemhinweis selbst zu setzen.
    insert into messages (chat_id, sender_id, text, created_at, hinweis) values (v, auth.uid(), 'hallo', '2030-01-01', 'story_markierung')
      returning (created_at < now() + interval '1 minute')::text || '/' || coalesce(hinweis, 'leer') into t;
    erg := erg || 'senden=ok nachricht_vorgaben=' || t || ' ';
    ${weg('favorit', `update chat_members set is_favorite = true where chat_id = v and user_id = auth.uid()`)}
    select id into v2 from messages where chat_id = v limit 1;
    ${weg('reaktion', `insert into message_reactions (message_id, user_id, emoji) values (v2, auth.uid(), '👍')`)}
    ${versuch('reaktion_html', `update message_reactions set emoji = '<b>x</b>' where message_id = v2 and user_id = auth.uid()`)}
    ${versuch('nachricht_verschieben', `update messages set chat_id = '${VERLASSENER_CHAT}' where id = v2`)}
    ${versuch('mitglied_umbiegen', `update chat_members set chat_id = '${VERLASSENER_CHAT}' where chat_id = v and user_id = auth.uid()`)}
  `);
  pruefe('Gruppe mit einem eigenen Kontakt anlegen geht', chats.gruppe_mit_kontakt === 'ok', chats.gruppe_mit_kontakt);
  pruefe('Fremde Person in eine Gruppe ziehen geht nicht', chats.gruppe_mit_fremdem === 'zu');
  pruefe('Gruppe nachträglich zum Einzelchat machen geht nicht', chats.gruppe_umschalten === 'zu');
  pruefe('Zurück in einen verlassenen Chat geht nicht', chats.zurueck_in_verlassenen_chat === 'zu');
  pruefe('Einzelchat mit Kontakt anlegen geht', chats.zweierchat_anlegen === 'ok', chats.zweierchat_anlegen);
  pruefe('Neuer Einzelchat startet als Anfrage', chats.anfrage === 'wartet', chats.anfrage);
  pruefe('Anfrage durch Leeren von anfrage_von aufheben geht nicht', chats.anfrage_von_leeren === 'zu');
  pruefe('Drittes Mitglied im Einzelchat geht nicht', chats.dritter_im_zweierchat === 'zu');
  pruefe('Erste Nachricht senden geht', chats.senden === 'ok', chats.senden);
  pruefe('Chat als Favorit markieren geht', chats.favorit === 'ok', chats.favorit);
  pruefe('Mit 👍 reagieren geht', chats.reaktion === 'ok', chats.reaktion);
  pruefe('HTML als Reaktion geht nicht', chats.reaktion_html === 'zu');
  pruefe('Nachricht in fremden Chat verschieben geht nicht', chats.nachricht_verschieben === 'zu');
  pruefe('Mitgliedschaft auf fremden Chat umbiegen geht nicht', chats.mitglied_umbiegen === 'zu');
  pruefe('Zeit und Systemhinweis einer Nachricht setzt die Datenbank', chats.nachricht_vorgaben === 'true/leer', chats.nachricht_vorgaben);

  console.log('\nCommunitys');
  // Eine private Community, in der das Prüfkonto nicht ist — als Eigentümer
  // gesucht, denn als Nutzer sieht man sie (richtig) gar nicht.
  const privat = await frage(`select c.id from communities c where c.visibility = 'private'
     and c.created_by <> '${PRUEFKONTO}'
     and not exists (select 1 from community_members m where m.community_id = c.id and m.user_id = '${PRUEFKONTO}')
     limit 1`);
  const privatId = (Array.isArray(privat) && privat[0] && privat[0].id) || '00000000-0000-0000-0000-000000000000';
  const comm = await alsPruefkonto(`
    select count(distinct community_id) into n from community_members m
     where not exists (select 1 from communities c where c.id = m.community_id);
    erg := erg || 'fremde_private=' || n || ' ';
    select c.id into v from communities c where c.visibility = 'public'
       and not exists (select 1 from community_members m where m.community_id = c.id and m.user_id = auth.uid()) limit 1;
    ${weg('oeffentlich_beitreten', `insert into community_members (community_id, user_id) values (v, auth.uid())`)}
    ${weg('stumm_und_austreten', `update community_members set is_muted = true where community_id = v and user_id = auth.uid();
                                   delete from community_members where community_id = v and user_id = auth.uid()`)}
    v := '${privatId}';
    erg := erg || 'private_gefunden=' || (v <> '00000000-0000-0000-0000-000000000000')::text || ' ';
    ${versuch('privat_beitreten', `insert into community_members (community_id, user_id) values (v, auth.uid())`)}
  `);
  pruefe('Mitgliedschaften fremder privater Communitys sind unsichtbar', comm.fremde_private === '0', comm.fremde_private);
  pruefe('Öffentlicher Community beitreten geht', comm.oeffentlich_beitreten === 'ok', comm.oeffentlich_beitreten);
  pruefe('Stummschalten und Austreten geht', comm.stumm_und_austreten === 'ok', comm.stumm_und_austreten);
  // Ohne private Community wäre das „zu" nur ein NULL-Fehler (grün aus falschem Grund).
  pruefe('Privater Community selbst beitreten geht nicht', comm.private_gefunden === 'true' && comm.privat_beitreten === 'zu', comm.private_gefunden);

  console.log('\nMedien und Storys');
  const medien = await alsPruefkonto(`
    select count(*) into n from storage.objects
     where bucket_id = 'media' and owner_id is distinct from auth.uid()::text and split_part(name, '/', 1) in ('stories', 'insights', 'messages', 'ptt');
    erg := erg || 'fremde_private_dateien=' || n || ' ';
    ${weg('story_eigener_eimer', `insert into stories (user_id, media_url, media_type) values (auth.uid(),
      'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/stories/${PRUEFKONTO}-1-abc.jpg', 'image')`)}
    ${versuch('story_fremde_adresse', `insert into stories (user_id, media_url, media_type) values (auth.uid(), 'x);"><meta http-equiv=refresh>', 'image')`)}
    insert into stories (user_id, media_url, media_type, expires_at) values (auth.uid(), null, 'image', '2036-01-01')
      returning (expires_at <= now() + interval '24 hours')::text into t;
    erg := erg || 'story_hoechstens_ein_tag=' || t || ' ';
    ${weg('hochladen_in_stories', `insert into storage.objects (bucket_id, name, owner_id) values ('media', 'stories/${PRUEFKONTO}-probe.jpg', auth.uid()::text)`)}
    ${versuch('hochladen_in_beispiel', `insert into storage.objects (bucket_id, name, owner_id) values ('media', 'beispiel/x.jpg', auth.uid()::text)`)}
  `);
  pruefe('Fremde Storys, Insights, Anhänge im Speicher unsichtbar', medien.fremde_private_dateien === '0', medien.fremde_private_dateien);
  pruefe('Story mit eigener Medienadresse anlegen geht', medien.story_eigener_eimer === 'ok', medien.story_eigener_eimer);
  pruefe('Story mit fremder/HTML-Adresse geht nicht', medien.story_fremde_adresse === 'zu');
  pruefe('Eine Story lebt höchstens einen Tag', medien.story_hoechstens_ein_tag === 'true');
  // Gegenprobe zuerst: geht gar kein Hochladen, wäre das „zu" darunter wertlos.
  pruefe('In den eigenen Story-Ordner hochladen geht', medien.hochladen_in_stories === 'ok', medien.hochladen_in_stories);
  pruefe('In den Beispielordner hochladen geht nicht', medien.hochladen_in_beispiel === 'zu');

  console.log('\nProfil und Beiträge');
  const profil = await alsPruefkonto(`
    ${weg('profil_aendern', `update profiles set bio = bio, name = name, updated_at = now() where id = auth.uid()`)}
    ${versuch('follower_faelschen', `update profiles set followers_basis = 99999 where id = auth.uid()`)}
    ${versuch('handle_mit_leerzeichen', `update profiles set handle = '@Hen rik' where id = auth.uid()`)}
    insert into posts (user_id, kind, description, likes_basis, created_at) values (auth.uid(), 'post', 'x', 999999, '2030-01-01')
      returning id, likes_basis into v, n;
    erg := erg || 'neuer_beitrag_likes=' || n || ' ';
    ${weg('beitrag_bearbeiten', `update posts set description = 'neu' where id = v`)}
    ${versuch('beitrag_in_zukunft', `update posts set created_at = '2030-01-01' where id = v`)}
    erg := erg || 'fremdes_kontakt_orakel=' || public.fuehrt_als_kontakt('${ANNA}', '${BOB}')::text || ' ';
  `);
  pruefe('Eigenes Profil ändern geht', profil.profil_aendern === 'ok', profil.profil_aendern);
  pruefe('Follower-Zahl fälschen geht nicht', profil.follower_faelschen === 'zu');
  pruefe('Benutzername an handle_aendern vorbei geht nicht', profil.handle_mit_leerzeichen === 'zu');
  pruefe('Neuer Beitrag startet ohne geschenkte Likes', profil.neuer_beitrag_likes === '0', profil.neuer_beitrag_likes);
  pruefe('Eigenen Beitrag bearbeiten geht', profil.beitrag_bearbeiten === 'ok', profil.beitrag_bearbeiten);
  pruefe('Beitrag in die Zukunft datieren geht nicht', profil.beitrag_in_zukunft === 'zu');
  pruefe('Fremde Kontaktlisten nicht abfragbar', profil.fremdes_kontakt_orakel === 'false', profil.fremdes_kontakt_orakel);

  console.log('\nRechte (Drift)');
  const rechte = await frage(`
    select
      (select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
        where s.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')) as anon_funktionen,
      has_function_privilege('authenticated', 'public.starter_sammlungen(uuid)', 'execute') as starter_offen,
      (select count(*) from information_schema.table_privileges
        where grantee = 'anon' and table_schema = 'public' and table_name <> 'altersgrenzen') as anon_tabellen,
      (select count(*) from pg_publication_tables where pubname = 'supabase_realtime') as realtime
  `);
  const r = (Array.isArray(rechte) && rechte[0]) || {};
  pruefe('Anonym nur handle_frei und nummer_frei', r.anon_funktionen === 'handle_frei,nummer_frei', r.anon_funktionen);
  pruefe('starter_sammlungen nicht aufrufbar', r.starter_offen === false);
  pruefe('Anonym keine Tabelle außer altersgrenzen', Number(r.anon_tabellen) === 0, String(r.anon_tabellen));
  pruefe('Realtime-Veröffentlichung leer', Number(r.realtime) === 0, String(r.realtime));

  console.log(`\n${anzahl - fehler} von ${anzahl} bestanden`);
  console.log(fehler ? `${fehler} Prüfung(en) FEHLGESCHLAGEN` : 'Alle Prüfungen bestanden');
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error('ABBRUCH', e.message);
  process.exit(1);
});
