/** Vollständige Geräteschlüssel statt eines still bei 1000 endenden Ausschnitts.
 * App und Website verwenden dieselbe Abfrage. Bei wechselnder/verkürzter
 * Liste gibt es einen Fehler statt einer falschen Sicherheitsnummer.
 */
async function schluesselHolen(client, konten, oeffentliche) {
  if (!konten.length) return [];
  const zeilen = [];
  const gesehen = new Set();
  let gesamt = null;
  const groesse = 200;
  for (let start = 0; ; start += groesse) {
    let q = client.from('krypto_schluessel')
      .select('id, user_id, oeffentlich', { count: 'exact' })
      .in('user_id', konten).order('id', { ascending: true });
    if (oeffentliche) q = q.in('oeffentlich', oeffentliche);
    const { data, count, error } = await q.range(start, start + groesse - 1);
    if (error) throw error;
    if (!Array.isArray(data) || !Number.isInteger(count) || count < 0 ||
        (gesamt !== null && gesamt !== count)) throw new Error('Geräteliste nicht vollständig ladbar');
    gesamt = count;
    for (const z of data) {
      if (!z.id || gesehen.has(z.id) || !konten.includes(z.user_id) || !z.oeffentlich) {
        throw new Error('Geräteliste widersprüchlich');
      }
      gesehen.add(z.id);
      zeilen.push(z);
    }
    if (zeilen.length === gesamt) return zeilen;
    if (data.length !== groesse || zeilen.length > gesamt) throw new Error('Geräteliste verkürzt');
  }
}

module.exports = { schluesselHolen };
