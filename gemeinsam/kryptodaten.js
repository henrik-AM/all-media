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


/** Nur tatsächlich fehlende Kuverts; Klartext und Absenderwarnungen zählen nicht. */
function offeneKuvertIds(nachrichten) {
  const ids = [];
  for (const n of nachrichten || []) {
    for (const z of [n, n?.antwortAuf, n?.zitat]) {
      if (z?.kuvertFehlt && z.id && !ids.includes(z.id)) ids.push(z.id);
    }
  }
  return ids;
}

/** Gerätebezogene Bereitschaft für höchstens 500 gerenderte IDs; ohne Geheimnisse. */
async function kuvertStandHolen(client, schluesselId, ids = []) {
  if (!Array.isArray(ids) || ids.length > 500 ||
      ids.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    throw new Error('Ungültige Kuvertliste (höchstens 500 UUIDs)');
  }
  const gesucht = [...new Set(ids)].sort();
  if (!gesucht.length) return '';
  if (!schluesselId) return '|kuverts:geraet-fehlt';
  const gefunden = new Set();
  for (let i = 0; i < gesucht.length; i += 100) {
    const teil = gesucht.slice(i, i + 100);
    const {data, error} = await client.from('message_keys').select('message_id')
      .eq('schluessel_id', schluesselId).in('message_id', teil);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Kuvertstand nicht ladbar');
    for (const k of data) {
      if (!teil.includes(k.message_id)) throw new Error('Widersprüchlicher Kuvertstand');
      gefunden.add(k.message_id);
    }
  }
  return '|kuverts:' + gesucht.map(id => id + ':' + (gefunden.has(id) ? 1 : 0)).join(',');
}

module.exports = { schluesselHolen, offeneKuvertIds, kuvertStandHolen };
