#!/usr/bin/env node
/**
 * Schema 128 (Paket 8, OWASP A01-002): private Kontaktfotos.
 * VERWORFENE Transaktion, Vorlage _probe_f4_medien.js.
 *
 * Ohne Argument: LIVE-Stand. Mit Schemadatei(en): diese zuerst in der
 * Transaktion einspielen, dann dieselben Fragen.
 *
 *   A  Eigentümer: Kontaktfoto (nur Supabase), Profilbild, Communitybild
 *   B  anderes Konto (freigegeben)
 *   K  wartendes Kinderkonto
 *   Dateien in avatars/: K1 Kontaktfoto A (Supabase), K2 Kontaktfoto A
 *   (Bunny-Beleg), PB Profilbild A, CB Communitybild A, BS beispiel/…
 *
 * Erwartet MIT Schema 128:
 *   B: K1/K2 weder signierbar (medium_sichtbar/bunny_medium_lesbar) noch
 *      auflistbar (storage.objects), auch nicht über medien_leseliste;
 *      B kann K1 nicht als eigenes Profilbild eintragen (Schema 117).
 *   B: PB, CB, beispiel sichtbar (normaler Weg).
 *   A: eigenes Kontaktfoto weiter lesbar (owner_id).
 *   K: nichts. anon: nichts.
 *
 * Start: SUPABASE_TOKEN=… node test/_probe128.js [SUPABASE_SCHEMA_128_….sql]
 */
const fs = require('fs');
const path = require('path');
const { frage } = require('./_aufraeumen');

const id = (n) => `a1000000-0000-4000-8000-000000128${n}`;
const A = id('0a1'), B = id('0a2'), K = id('0a3');
const COM = id('0c1');
const P = {
  k1: `avatars/${A}-p128-kontakt.jpg`,
  k2: `avatars/${A}-p128-kontakt2.jpg`,
  pb: `avatars/${A}-p128-profil.jpg`,
  cb: `avatars/${A}-p128-community.jpg`,
  bk: `avatars/${B}-p128-eigen.jpg`,
};
const BS = 'beispiel/p128-beispiel.jpg';
const adr = (p) => `public.medien_adresse('${p}')`;

let fehler = 0;
let anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};
const merke = (k, ausdruck) =>
  `perform set_config('probe.erg', current_setting('probe.erg', true) || '${k}=' || replace(coalesce((${ausdruck})::text, 'null'), ' ', '_') || ' ', true);`;
const versuch = (k, anweisung) => `
  begin ${anweisung}; get diagnostics n = row_count; ${merke(k, "'offen:' || n")}
  exception when others then ${merke(k, "'zu:' || sqlstate || ':' || left(sqlerrm, 60)")}
  end;`;
const als = (konto, rumpf, rolle = 'authenticated') => `
  reset role;
  select set_config('request.jwt.claims', '${konto ? `{"sub":"${konto}","role":"${rolle}"}` : `{"role":"${rolle}"}`}', true),
         set_config('request.jwt.claim.sub', '${konto || ''}', true);
  set local role ${rolle};
  do $p$ declare n int; j jsonb; begin
    ${rumpf}
  end $p$;
  reset role;`;
const eigner = (rumpf) => `
  do $p$ declare n int; j jsonb; begin
    ${rumpf}
  end $p$;`;
const konto = (kid, nr, status = 'frei') => `
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values ('${kid}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'probe128-${nr}@prueflauf.invalid',
          '${JSON.stringify({ name: 'Probe 128 ' + nr, phone: '+4915199912' + nr, handle: '@prueflauf.p128' + nr, zustimmung_am: '2026-11-20T12:00:00Z', zustimmung_nutzungsbedingungen: '1', zustimmung_community_richtlinien: '1', kenntnis_datenschutz: '1' })}', now(), now());
  insert into public.konto_alter (user_id, geburtsdatum, land, mindestalter, status)
  values ('${kid}', '199${nr}-01-01', 'DE', 16, '${status}')
  on conflict (user_id) do update set status = '${status}';`;
const datei = (p, owner, bunny = false) => `
  insert into storage.objects (bucket_id, name, owner_id, owner, metadata)
  values ('media', '${p}', ${owner ? `'${owner}'` : 'null'}, ${owner ? `'${owner}'` : 'null'}, '{"size":"1000","mimetype":"image/jpeg"}');
  ${bunny ? `insert into public.medien_objekte (pfad, owner_id, typ, bytes, sha256)
  values ('${p}', '${owner}', 'image/jpeg', 1000, repeat('a', 64));` : ''}`;
const liste = (k, p) => merke(k, `(select count(*) from storage.objects where bucket_id = 'media' and name = '${p}')`);

(async () => {
  if (!process.env.SUPABASE_TOKEN) {
    console.log('ÜBERSPRUNGEN  SUPABASE_TOKEN fehlt.');
    process.exit(2);
  }
  const dateien = process.argv.slice(2);
  const lies = (d) => fs.readFileSync(path.join(__dirname, '..', '..', d), 'utf8');
  const sql = `
begin;
select set_config('probe.erg', '', true);
${dateien.map(lies).join('\n')}

${eigner(`
  ${konto(A, 1)} ${konto(B, 2)} ${konto(K, 3, 'wartet')}
  ${datei(P.k1, A)} ${datei(P.k2, A, true)} ${datei(P.pb, A)} ${datei(P.cb, A)} ${datei(P.bk, B)}
  ${datei(BS, null)}
  update public.profiles set avatar_url = ${adr(P.pb)} where id = '${A}';
  insert into public.communities (id, name, created_by, visibility, bild_url)
    values ('${COM}', 'Probe 128', '${A}', 'public', ${adr(P.cb)});
  insert into public.kontakt_bilder (owner_id, kontakt_id, media_url) values ('${A}', '${B}', ${adr(P.k1)});
`)}

${als(B, `
  ${merke('b_k1', `public.medium_sichtbar('${P.k1}')`)}
  ${merke('b_k1_bunny', `public.bunny_medium_lesbar('${P.k1}')`)}
  ${merke('b_k2_bunny', `public.bunny_medium_lesbar('${P.k2}')`)}
  ${liste('b_k1_liste', P.k1)}
  ${liste('b_k2_liste', P.k2)}
  ${merke('b_k_leseliste', `(select count(*) from public.medien_leseliste(array['${P.k1}','${P.k2}']))`)}
  ${merke('b_avatars_alle', `(select count(*) from storage.objects where bucket_id = 'media' and name like 'avatars/${A}-p128-%')`)}
  ${versuch('b_klaut_als_profil', `update public.profiles set avatar_url = ${adr(P.k1)} where id = '${B}'`)}
  ${merke('b_k1_danach', `public.medium_sichtbar('${P.k1}')`)}
  ${merke('b_pb', `public.medium_sichtbar('${P.pb}')`)}
  ${merke('b_pb_bunny', `public.bunny_medium_lesbar('${P.pb}')`)}
  ${liste('b_pb_liste', P.pb)}
  ${merke('b_cb', `public.bunny_medium_lesbar('${P.cb}')`)}
  ${merke('b_bs', `public.medium_sichtbar('${BS}')`)}
  ${versuch('b_eigenes_profilbild', `update public.profiles set avatar_url = ${adr(P.bk)} where id = '${B}'`)}
  ${liste('b_eigen_liste', P.bk)}
`)}
${als(A, `
  ${liste('a_k1_liste', P.k1)}
  ${merke('a_k1_bunny', `public.bunny_medium_lesbar('${P.k1}')`)}
  ${merke('a_k2_bunny', `public.bunny_medium_lesbar('${P.k2}')`)}
`)}
${als(K, `
  ${liste('k_pb_liste', P.pb)}
  ${liste('k_k1_liste', P.k1)}
`)}
${als(null, `
  ${liste('anon_pb_liste', P.pb)}
  ${liste('anon_k1_liste', P.k1)}
`, 'anon')}

do $p$ begin raise exception 'ERG:%', current_setting('probe.erg', true); end $p$;
`;

  const antwort = await frage(sql, { erwarteterFehler: /ERG:/ });
  const text = JSON.stringify(antwort);
  const treffer = text.match(/ERG:([^"\\]*)/);
  if (!treffer) {
    console.log('Keine Ergebnisse — Antwort:', text.slice(0, 1500));
    process.exit(1);
  }
  const e = {};
  for (const paar of treffer[1].trim().split(/\s+/)) {
    const [k, ...r] = paar.split('=');
    e[k] = r.join('=');
  }
  const zu = (k) => String(e[k]).startsWith('zu') || e[k] === 'offen:0';
  console.log(dateien.length ? `Stand: live + ${dateien.join(', ')}` : 'Stand: LIVE (keine Schemadatei)');

  console.log('\nAngriff: fremdes Kontaktfoto');
  pruefe('B kann Kontaktfoto (Supabase) nicht unterschreiben', e.b_k1 === 'false' && e.b_k1_bunny === 'false', `${e.b_k1}/${e.b_k1_bunny}`);
  pruefe('B kann Kontaktfoto (Bunny) nicht unterschreiben', e.b_k2_bunny === 'false', e.b_k2_bunny);
  pruefe('B sieht Kontaktfotos nicht in storage.objects (Auflisten)', e.b_k1_liste === '0' && e.b_k2_liste === '0', `${e.b_k1_liste}/${e.b_k2_liste}`);
  pruefe('B bekommt Kontaktfotos nicht über medien_leseliste', e.b_k_leseliste === '0', e.b_k_leseliste);
  pruefe('B sieht von A in avatars/ nur Profil- und Communitybild', e.b_avatars_alle === '2', e.b_avatars_alle);
  pruefe('B kann Kontaktfoto nicht als eigenes Profilbild eintragen', zu('b_klaut_als_profil'), e.b_klaut_als_profil);
  pruefe('… und sieht es danach weiter nicht', e.b_k1_danach === 'false', e.b_k1_danach);

  console.log('\nNormaler Weg');
  pruefe('B sieht Profilbild von A', e.b_pb === 'true' && e.b_pb_bunny === 'true' && e.b_pb_liste === '1', `${e.b_pb}/${e.b_pb_bunny}/${e.b_pb_liste}`);
  pruefe('B sieht Communitybild von A', e.b_cb === 'true', e.b_cb);
  pruefe('B sieht Beispielmedien', e.b_bs === 'true', e.b_bs);
  pruefe('B setzt eigenes Profilbild und sieht es', e.b_eigenes_profilbild === 'offen:1' && e.b_eigen_liste === '1', `${e.b_eigenes_profilbild}/${e.b_eigen_liste}`);
  pruefe('A liest eigenes Kontaktfoto weiter', e.a_k1_liste === '1' && e.a_k1_bunny === 'true' && e.a_k2_bunny === 'true', `${e.a_k1_liste}/${e.a_k1_bunny}/${e.a_k2_bunny}`);

  console.log('\nGesperrt');
  pruefe('Wartendes Kinderkonto sieht nichts', e.k_pb_liste === '0' && e.k_k1_liste === '0', `${e.k_pb_liste}/${e.k_k1_liste}`);
  pruefe('Anonym sieht nichts', e.anon_pb_liste === '0' && e.anon_k1_liste === '0', `${e.anon_pb_liste}/${e.anon_k1_liste}`);

  console.log(`\n${anzahl - fehler}/${anzahl} bestanden — alles zurückgerollt.`);
  process.exit(fehler ? 1 : 0);
})().catch((f) => {
  console.error('ABBRUCH', f.message);
  process.exit(1);
});
