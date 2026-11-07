/**
 * Eine echte, winzige Datei im eigenen Fach — statt einer erfundenen Adresse.
 *
 * Seit Schema 95/117 (live 06.11.2026) nimmt jede Medienspalte nur noch
 *   https://<projekt>.supabase.co/storage/v1/object/public/media/<ordner>/<datei>
 * (CHECK `<tabelle>_<spalte>_eigener_eimer`), und der Auslöser
 * `medienreferenz_pruefen` verlangt, dass der Schreibende die Datei selbst
 * hochgeladen hat. Prüfläufe, die `x/…` oder `https://example.invalid/…`
 * eintrugen, scheiterten deshalb am Anlegen — nicht an dem, was sie prüfen.
 *
 * Dieser Baustein lädt mit dem Client des Kontos ein 1×1-PNG (bzw. eine
 * kleinste M4A-Hülle für PTT) in einen der erlaubten Ordner und gibt die
 * Datenbankform der Adresse zurück. Hochladen ist kein Egress; gelesen wird
 * die Datei vom Lauf nicht. `weg()` räumt sie wieder ab.
 */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
// Kleinste MP4/M4A-Hülle: nur der ftyp-Kasten (reicht als Ton-Platzhalter).
const M4A = Buffer.concat([
  Buffer.from([0, 0, 0, 0x18]),
  Buffer.from('ftypM4A \0\0\0\0isomM4A ', 'latin1'),
]);

const ORDNER = ['messages', 'stories', 'avatars', 'posts', 'insights', 'ptt'];

/**
 * @param client  Supabase-Client des angemeldeten Kontos
 * @param uid     Kennung dieses Kontos (Teil des Dateinamens, wie in der App)
 * @param ordner  einer der erlaubten Ordner
 * @param basis   Projekt-Adresse (https://<projekt>.supabase.co)
 */
async function testmedium(client, uid, ordner, basis, { ton = false } = {}) {
  if (!ORDNER.includes(ordner)) throw new Error(`testmedium: Ordner ${ordner} ist nicht erlaubt`);
  const zufall = Math.random().toString(36).slice(2, 10);
  const pfad = `${ordner}/${uid}-pruef-${Date.now()}-${zufall}.${ton ? 'm4a' : 'png'}`;
  const { error } = await client.storage.from('media').upload(pfad, ton ? M4A : PNG, {
    contentType: ton ? 'audio/mp4' : 'image/png',
    upsert: false,
  });
  if (error) throw new Error(`testmedium: Hochladen nach ${ordner}/ gescheitert: ${error.message}`);
  return {
    pfad,
    url: `${String(basis).replace(/\/$/, '')}/storage/v1/object/public/media/${pfad}`,
    weg: async () => {
      const { data } = await client.storage.from('media').remove([pfad]);
      return (data || []).length === 1;
    },
  };
}

module.exports = { testmedium, PNG, M4A };
