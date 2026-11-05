/**
 * Einheitstest für gemeinsam/medienadresse.js und signiereMedien in
 * web/server/medien.js — ohne Netz, ohne Supabase (Schema 118,
 * Codex-Review 05.11.2026).
 *
 * Der Supabase-Client ist eine Attrappe: createSignedUrls liefert entweder
 * Unterschriften oder einen Fehler. Geprüft wird, dass
 *   * nur eigene Adressen (eigener Host + Medienpfad) als Medien gelten,
 *   * fremde Hosts mit Medienpfad immer zu null werden — auch ohne Client
 *     und wenn das Unterschreiben scheitert,
 *   * eigene Adressen beim Scheitern unverändert bleiben (wie bisher),
 *   * Sätze, die eine Adresse nur erwähnen, unangetastet bleiben.
 *
 * Start:  node test/_medienadresse_einheit.js
 */

// Ohne Bunny-Variablen läuft signiereMedien den Supabase-Weg.
for (const k of ['BUNNY_STORAGE_ZONE', 'BUNNY_STORAGE_KEY', 'BUNNY_STORAGE_HOST', 'BUNNY_PULL_HOST', 'BUNNY_TOKEN_KEY']) delete process.env[k];
delete process.env.SUPABASE_URL;
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'nur-fuer-den-einheitstest';

const M = require('../../gemeinsam/medienadresse');

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr) => {
  geprueft++;
  if (wahr) console.log('  OK    ' + name);
  else {
    fehler++;
    console.log('  FEHLER ' + name);
  }
};

const EIGEN = 'https://ijztosbjfybdgotpdixw.supabase.co';
const P = '/storage/v1/object/public/media/';
const eigen = (pfad) => EIGEN + P + pfad;
const BOESE = 'https://boese.example' + P + 'avatars/x.png';

async function main() {
  console.log('Baustein medienadresse');
  pruefe('Standardbasis ist das Projekt', M.STANDARD_BASIS === EIGEN);
  pruefe('basisVon: Schrägstrich am Ende weg', M.basisVon(EIGEN + '/') === EIGEN);
  pruefe('basisVon: leer → Standard', M.basisVon('') === EIGEN && M.basisVon(null) === EIGEN);
  pruefe('basisVon: mit Pfad → Standard', M.basisVon('https://x.example/pfad') === EIGEN);

  pruefe('art: eigene Adresse', M.art(eigen('avatars/a.png')) === 'eigen');
  pruefe('art: eigene mit ?t=', M.art(eigen('avatars/a.png?t=1')) === 'eigen');
  pruefe('art: fremder Host', M.art(BOESE) === 'fremd');
  pruefe('art: Host als Präfix (…supabase.co.boese.example)', M.art('https://ijztosbjfybdgotpdixw.supabase.co.boese.example' + P + 'avatars/a.png') === 'fremd');
  pruefe('art: Benutzerteil (…supabase.co@boese.example)', M.art('https://ijztosbjfybdgotpdixw.supabase.co@boese.example' + P + 'avatars/a.png') === 'fremd');
  pruefe('art: eigener Host, Medienpfad nicht am Anfang', M.art(EIGEN + '/x' + P + 'avatars/a.png') === 'fremd');
  pruefe('art: anderes Supabase-Projekt', M.art('https://anderes.supabase.co' + P + 'posts/a.jpg') === 'fremd');
  pruefe('art: Satz mit Adresse ist keine', M.art('Schau mal ' + BOESE) === 'keine');
  pruefe('art: Adresse ohne Medienpfad ist keine', M.art('https://boese.example/bild.png') === 'keine');
  pruefe('art: Nicht-Text ist keine', M.art(null) === 'keine' && M.art(42) === 'keine' && M.art({}) === 'keine');
  pruefe('art: andere Basis gilt als eigen', M.art('http://localhost:54321' + P + 'posts/a.jpg', 'http://localhost:54321') === 'eigen');
  pruefe('art: Groß-/Kleinschreibung des Hosts egal', M.art('https://IJZTOSBJFYBDGOTPDIXW.supabase.co' + P + 'posts/a.jpg') === 'eigen');

  pruefe('pfad: eigene Adresse', M.pfad(eigen('posts/a.jpg')) === 'posts/a.jpg');
  pruefe('pfad: ?t= und #x fallen weg', M.pfad(eigen('posts/a.jpg?t=1#x')) === 'posts/a.jpg');
  pruefe('pfad: fremder Host → null', M.pfad(BOESE) === null);
  pruefe('pfad: kaputte Kodierung → null', M.pfad(eigen('posts/%zz.jpg')) === null);

  pruefe('gespeichert: Profilbild eigen', M.gespeichert(eigen('avatars/u-1-ab.jpg'), 'avatars'));
  pruefe('gespeichert: Profilbild fremder Host', !M.gespeichert(BOESE, 'avatars'));
  pruefe('gespeichert: falscher Ordner', !M.gespeichert(eigen('posts/a.jpg'), 'avatars'));
  pruefe('gespeichert: Titelbild stories', M.gespeichert(eigen('stories/a.jpg'), ['stories', 'posts']));
  pruefe('gespeichert: Titelbild avatars abgelehnt', !M.gespeichert(eigen('avatars/a.jpg'), ['stories', 'posts']));
  pruefe('gespeichert: ?t= abgelehnt', !M.gespeichert(eigen('avatars/a.jpg?t=1'), 'avatars'));
  pruefe('gespeichert: # abgelehnt', !M.gespeichert(eigen('avatars/a.jpg#x'), 'avatars'));
  pruefe('gespeichert: Unterordner abgelehnt', !M.gespeichert(eigen('avatars/x/a.jpg'), 'avatars'));
  pruefe('gespeichert: http abgelehnt', !M.gespeichert(eigen('avatars/a.jpg').replace('https', 'http'), 'avatars'));
  pruefe('gespeichert: Großschreibung im Host abgelehnt (wie DB)', !M.gespeichert('https://IJZTOSBJFYBDGOTPDIXW.supabase.co' + P + 'avatars/a.jpg', 'avatars'));
  pruefe('gespeichert: Zeilenumbruch am Ende abgelehnt', !M.gespeichert(eigen('avatars/a.jpg') + '\n', 'avatars'));
  pruefe('gespeichert: ohne Ordnerliste wie medien_adresse_gueltig', M.gespeichert(eigen('ptt/a.m4a')) && !M.gespeichert(eigen('Gross/a.jpg')));

  // Gleiche Form wie die Live-Funktion medien_adresse_gueltig() (05.11.2026 gelesen).
  const db = /^https:\/\/ijztosbjfybdgotpdixw\.supabase\.co\/storage\/v1\/object\/public\/media\/[a-z]+\/[A-Za-z0-9._-]+$/;
  const faelle = [eigen('avatars/a.png'), BOESE, eigen('avatars/a.png?x'), eigen('posts/a b.jpg'), eigen('a/b/c.jpg'), eigen('stories/.x')];
  pruefe('gespeichert(ohne Ordner) == medien_adresse_gueltig für Beispielfälle', faelle.every((f) => M.gespeichert(f) === db.test(f)));

  console.log('Server: signiereMedien');
  const Medien = require('../../web/server/medien');
  const attrappe = (scheitert) => ({
    storage: {
      from: () => ({
        createSignedUrls: async (pfade) => (scheitert
          ? { data: null, error: { message: 'Attrappe: aus' } }
          : { data: pfade.map((p) => ({ path: p, signedUrl: EIGEN + '/storage/v1/object/sign/media/' + p + '?token=t', error: null })), error: null }),
      }),
    },
  });

  const daten = () => ({
    avatar_url: BOESE,
    titel: 'Schau mal ' + BOESE,
    beitraege: [{ media_url: eigen('posts/a.jpg') }, { media_url: 'https://boese.example' + P + 'posts/b.jpg' }],
  });

  const gut = await Medien.signiereMedien(attrappe(false), daten());
  pruefe('Signiert: fremdes Profilbild → null', gut.avatar_url === null);
  pruefe('Signiert: eigenes Medium unterschrieben', /\/object\/sign\/media\/posts\/a\.jpg\?token=t$/.test(gut.beitraege[0].media_url));
  pruefe('Signiert: fremdes Medium im Beitrag → null', gut.beitraege[1].media_url === null);
  pruefe('Signiert: Satz bleibt unverändert', gut.titel === 'Schau mal ' + BOESE);

  // Zwischenspeicher leert sich nicht — anderer Pfad für den Fehlerfall.
  const kaputt = await Medien.signiereMedien(attrappe(true), { a: eigen('posts/neu.jpg'), b: BOESE });
  pruefe('Fehlschlag: eigene Adresse bleibt wie bisher', kaputt.a === eigen('posts/neu.jpg'));
  pruefe('Fehlschlag: fremde Adresse → null', kaputt.b === null);

  const ohne = await Medien.signiereMedien(null, { b: BOESE, c: eigen('posts/c.jpg') });
  pruefe('Ohne Client: fremd → null, eigen bleibt', ohne.b === null && ohne.c === eigen('posts/c.jpg'));

  const nurFremd = await Medien.signiereMedien(attrappe(false), { b: BOESE, n: 3, x: null });
  pruefe('Nichts zu unterschreiben: fremd trotzdem → null', nurFremd.b === null && nurFremd.n === 3 && nurFremd.x === null);

  pruefe('ohneFremdeMedien: Rückfall der Antwortschicht', Medien.ohneFremdeMedien({ b: BOESE }).b === null);
  pruefe('istMedienAdresse: nur eigene', Medien.istMedienAdresse(eigen('posts/a.jpg')) && !Medien.istMedienAdresse(BOESE));
  pruefe('pfadAus: fremd → null, eigen → Pfad', Medien.pfadAus(BOESE) === null && Medien.pfadAus(eigen('posts/a.jpg?t=2')) === 'posts/a.jpg');

  console.log(`\n${geprueft - fehler}/${geprueft} OK`);
  process.exit(fehler ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
