/**
 * Testpaar @test ↔ @prueflauf für die Zwei-Konten-Läufe (k28-gruppe, k28-karte,
 * k28-anruf-ptt) und eigene Medien für Prüfläufe.
 *
 * Warum: Seit den Schemas 95/115/117/118 (live) und der Chat-Anfrage gilt
 *  - Gruppe/Zweierchat nur unter Messenger-Kontakten (darf_mitglied_werden →
 *    ist_messenger_kontakt / messenger_erlaubt: contacts mit status 'friend'),
 *  - eine Medienadresse nur mit eigenem Upload (medium_selbst_hochgeladen:
 *    medien_objekte-Zeile des Kontos) oder aus dem Ordner beispiel/.
 * Der Testbestand hatte am 06.11.2026 weder Kontakt noch Zweierchat zwischen
 * den beiden Konten, und die Läufe schrieben Platzhalter wie
 * https://example.invalid/… — beides lehnt die Datenbank zu Recht ab.
 *
 * Alles hier läuft über die Management-API (frage, braucht SUPABASE_TOKEN)
 * und ist idempotent. Es berührt ausschließlich die zwei eigenen Testkonten;
 * ist_testkonto() wird vor jedem Schreiben geprüft.
 */
const { frage } = require('./_aufraeumen');

const TESTKONTO = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4'; // test@all-media.app
const PRUEFKONTO = '62616c1d-82e2-4ee4-aab9-950e40e438a4'; // all.media.prueflauf@web.de
const KONTEN = new Set([TESTKONTO, PRUEFKONTO]);

function pruefeKonto(id) {
  if (!KONTEN.has(id)) throw new Error('Testpaar: nur @test und @prueflauf, nicht ' + id);
}

async function abfrage(sql) {
  const r = await frage(sql);
  if (r === null) throw new Error('Testpaar: SUPABASE_TOKEN fehlt (Management-API)');
  if (!Array.isArray(r)) throw new Error('Testpaar: ' + JSON.stringify(r).slice(0, 300));
  return r;
}

/**
 * Stellt sicher: beide Konten sind gegenseitig Messenger-Kontakt (friend) und
 * haben einen Messenger-Zweierchat. Gibt die Chat-ID zurück.
 */
async function testpaarSichern() {
  const r = await abfrage(`
do $$
declare c uuid;
begin
  if not (public.ist_testkonto('${TESTKONTO}') and public.ist_testkonto('${PRUEFKONTO}')) then
    raise exception 'Testpaar: Konten sind keine Testkonten';
  end if;
  delete from public.blocks
   where (user_id = '${TESTKONTO}' and blocked_user_id = '${PRUEFKONTO}')
      or (user_id = '${PRUEFKONTO}' and blocked_user_id = '${TESTKONTO}');
  insert into public.contacts (user_id, contact_id, status)
    select a, b, 'friend' from (values ('${TESTKONTO}'::uuid, '${PRUEFKONTO}'::uuid),
                                       ('${PRUEFKONTO}'::uuid, '${TESTKONTO}'::uuid)) v(a, b)
     where not exists (select 1 from public.contacts k where k.user_id = v.a and k.contact_id = v.b);
  update public.contacts set status = 'friend'
   where status <> 'friend'
     and ((user_id = '${TESTKONTO}' and contact_id = '${PRUEFKONTO}')
       or (user_id = '${PRUEFKONTO}' and contact_id = '${TESTKONTO}'));
  select ch.id into c from public.chats ch
   where not ch.is_group and coalesce(ch.bereich, 'messenger') = 'messenger'
     and exists (select 1 from public.chat_members m where m.chat_id = ch.id and m.user_id = '${TESTKONTO}')
     and exists (select 1 from public.chat_members m where m.chat_id = ch.id and m.user_id = '${PRUEFKONTO}')
   limit 1;
  if c is null then
    insert into public.chats (name, is_group, bereich, created_by)
      values ('Testpaar', false, 'messenger', '${TESTKONTO}') returning id into c;
    insert into public.chat_members (chat_id, user_id)
      values (c, '${TESTKONTO}'), (c, '${PRUEFKONTO}');
  end if;
end $$;
select ch.id from public.chats ch
 where not ch.is_group and coalesce(ch.bereich, 'messenger') = 'messenger'
   and exists (select 1 from public.chat_members m where m.chat_id = ch.id and m.user_id = '${TESTKONTO}')
   and exists (select 1 from public.chat_members m where m.chat_id = ch.id and m.user_id = '${PRUEFKONTO}')
 limit 1;`);
  return r[0]?.id || null;
}

/**
 * Nimmt die Messenger-Kontakte zwischen den beiden Konten wieder heraus
 * (Grundstand des Testbestands: KEIN Kontakt). Sonst prüft test:angriffe
 * „Fremde Person in eine Gruppe ziehen" gegen ein Konto, das gar nicht mehr
 * fremd ist. Der Zweierchat bleibt (er schadet keinem Lauf).
 */
async function testpaarLoesen() {
  await abfrage(`
delete from public.contacts
 where ((user_id = '${TESTKONTO}' and contact_id = '${PRUEFKONTO}')
     or (user_id = '${PRUEFKONTO}' and contact_id = '${TESTKONTO}'))
   and public.ist_testkonto(user_id) and public.ist_testkonto(contact_id);
select 1 as ok;`);
}

/** Basis aller eigenen Medienadressen (wie public.medien_adresse('')). */
function medienBasis(supabaseUrl) {
  return supabaseUrl.replace(/\/$/, '') + '/storage/v1/object/public/media/';
}

/**
 * Registriert eine Datei als eigenen Upload des Kontos (medien_objekte) und
 * gibt ihre Adresse zurück. Pfad: <ordner>/<konto>-<name> (bunny_objekt_vorgaben).
 * Die Datei selbst existiert nicht — die Läufe prüfen Zeilen, nicht Bilder.
 */
async function eigenesMedium(supabaseUrl, konto, ordner, name, typ = 'image/jpeg') {
  pruefeKonto(konto);
  if (!/^[a-z]+$/.test(ordner) || !/^[A-Za-z0-9._-]+$/.test(name)) throw new Error('Testpaar: Pfad ungültig');
  const pfad = `${ordner}/${konto}-${name}`;
  await abfrage(`
insert into public.medien_objekte (pfad, owner_id, typ, bytes, sha256)
  select '${pfad}', '${konto}', '${typ}', 1, repeat('c', 64)
   where public.ist_testkonto('${konto}')
     and not exists (select 1 from public.medien_objekte where pfad = '${pfad}');
select 1 as ok;`);
  return { url: medienBasis(supabaseUrl) + pfad, pfad };
}

/** Räumt eine mit eigenesMedium registrierte Datei wieder ab. */
async function eigenesMediumWeg(pfad) {
  if (!/^[a-z]+\/[0-9a-f-]{36}-[A-Za-z0-9._-]+$/.test(pfad)) return;
  pruefeKonto(pfad.split('/')[1].slice(0, 36));
  await abfrage(`delete from public.medien_objekte where pfad = '${pfad}'; select 1 as ok;`);
}

module.exports = { TESTKONTO, PRUEFKONTO, testpaarSichern, testpaarLoesen, eigenesMedium, eigenesMediumWeg, medienBasis };
