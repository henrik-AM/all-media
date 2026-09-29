/**
 * Spendencode und Zahlungsmethode für Prüfläufe (Kasten 13, 29.09.2026).
 *
 * Seit Schema 72 geht eine Spende nur noch mit
 * persönlichem Code und hinterlegter Zahlungsmethode durch. Jeder Lauf, der
 * spendet (_handbuch, _querformat, _zahlung), braucht deshalb beides — und
 * zwar einen Code, den er kennt.
 *
 * WARUM DER CODE AUS DER KONTO-ID KOMMT
 *
 * Codes sind eindeutig über alle Konten („vergeben"). Ein fester Code für
 * beide Testkonten ginge also nur einmal. Aus den ersten Zeichen der ID wird
 * je Konto ein eigener, fester Code.
 *
 * WARUM NUR BEI BEDARF GESETZT WIRD
 *
 * `spendencode_setzen` bremst nach zehn Versuchen in der Stunde. Setzte
 * jeder Lauf den Code neu, stünde nach drei Gesamtläufen alles. Deshalb:
 * erst `spendencode_status` fragen, nur setzen, wenn keiner da ist oder
 * `erzwingen` verlangt ist (dann stimmte der vorhandene nicht). Setzen ohne
 * bisherigen Code verlangt eine frische Passwort-Anmeldung — die haben alle
 * Läufe, weil sie sich gerade eben angemeldet haben.
 *
 * Nur für die eigenen Testkonten (@test, @prueflauf). Echte Konten meldet
 * dieser Lauf nie an.
 */

/** Der feste Prüfcode eines Kontos: 16 Zeichen, nur A–Z und Ziffern. */
const pruefCode = (id) => ('AMPRUEF' + String(id).replace(/[^0-9a-f]/gi, '')).slice(0, 16).toUpperCase();

/**
 * Sorgt dafür, dass das angemeldete Konto eine Zahlungsmethode und den
 * Prüfcode hat. Läuft in Node UND im Browser (über fn.toString()) — deshalb
 * ohne jeden Bezug nach außen.
 *
 * Gibt { ok, gesperrt, angelegt: { methode, code } } oder { ok:false, fehler }.
 */
async function spendenwegBereit(client, ich, code, erzwingen) {
  const st = await client.rpc('spendencode_status');
  if (st.error) {
    return {
      ok: false,
      fehler: 'spendencode_status: ' + st.error.message + ' — ist SUPABASE_SCHEMA_72_zahlung_spendencode eingespielt?',
    };
  }
  if (!st.data || !st.data.ok) return { ok: false, fehler: 'spendencode_status: ' + JSON.stringify(st.data) };
  const angelegt = { methode: false, code: false };
  if (!st.data.methoden) {
    const { error } = await client
      .from('zahlungsmethoden')
      .insert({ anbieter: 'paypal', anzeigename: 'Prüflauf', paypal_maskiert: 'pr***@all-media.app' });
    if (error) return { ok: false, fehler: 'Zahlungsmethode anlegen: ' + error.message };
    angelegt.methode = true;
  }
  if (!st.data.gesetzt || erzwingen) {
    const r = await client.rpc('spendencode_setzen', { p_neu: code });
    if (r.error) return { ok: false, fehler: 'spendencode_setzen: ' + r.error.message };
    if (!r.data || !r.data.ok) return { ok: false, fehler: 'spendencode_setzen: ' + ((r.data && r.data.grund) || '?') };
    angelegt.code = true;
  }
  return { ok: true, gesperrt: Boolean(st.data.gesperrt), angelegt };
}

module.exports = { pruefCode, spendenwegBereit };
