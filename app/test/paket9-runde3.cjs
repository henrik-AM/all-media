const { test } = require('node:test');
const assert = require('node:assert/strict');

const Medien = require('../../web/server/medien');
const { handleDeleteContent } = require('../../web/server/sync-handlers');
const { supabaseUrl } = require('../../web/server/supabase');
const Video = require('../../web/server/videopruefung');

test('Abbruch während der Supabase-Signatur löscht über den Dienst', async (t) => {
  for (const name of ['BUNNY_STORAGE_ZONE', 'BUNNY_STORAGE_KEY', 'BUNNY_STORAGE_HOST', 'BUNNY_PULL_HOST', 'BUNNY_TOKEN_KEY']) {
    const alt = process.env[name];
    delete process.env[name];
    t.after(() => { if (alt !== undefined) process.env[name] = alt; });
  }
  const steuerung = new AbortController();
  const signatur = Promise.withResolvers();
  const signiert = Promise.withResolvers();
  const entfernt = [];
  let pfad;
  t.mock.method(Video, 'dienstclient', () => ({
    storage: { from: () => ({ remove: async (liste) => { entfernt.push(...liste); return {}; } }) },
  }));
  const client = { storage: { from: () => ({
    upload: async (name) => { pfad = name; return { data: { id: 'upload' } }; },
    getPublicUrl: () => ({ data: { publicUrl: 'https://storage.invalid/datei' } }),
    createSignedUrl: () => { signiert.resolve(); return signatur.promise; },
  }) } };
  const upload = Medien.hochladenDatei(client, 'eigen', 'posts', 'image/jpeg', Buffer.from([255, 216, 255]), { signal: steuerung.signal });
  await signiert.promise;
  steuerung.abort();
  signatur.resolve({ data: { signedUrl: 'https://storage.invalid/signiert' } });
  assert.deepEqual(await upload, { ok: false, error: 'Hochladen abgebrochen.' });
  assert.deepEqual(entfernt, [pfad]);
});

for (const fehlerquelle of ['Dateilöschung', 'Freigabe-RPC']) {
  test(`Beitrag gelöscht und Karussell weiter bereinigt trotz Fehler bei ${fehlerquelle}`, async (t) => {
    const basis = supabaseUrl + '/storage/v1/object/public/media/';
    let geloescht = false;
    const versucht = [];
    const protokoll = t.mock.method(console, 'error', () => {});
    t.mock.method(Medien, 'loeschen', async (_client, _nutzer, pfad) => {
      assert.equal(geloescht, true);
      versucht.push(pfad);
      if (pfad === 'posts/kaputt.jpg') throw Error('Speicher nicht erreichbar');
      return { ok: true };
    });
    const client = {
      from: (tabelle) => {
        assert.equal(tabelle, 'posts');
        return {
          eq() { return this; },
          select() { return geloescht ? Promise.resolve({ data: [{ id: 'beitrag' }] }) : this; },
          maybeSingle: async () => ({ data: {
            media_url: basis + 'posts/kaputt.jpg',
            thumbnail_url: basis + 'posts/geteilt.jpg',
            medien: [{ url: basis + 'posts/kaputt.jpg' }, { url: basis + 'posts/zweites.jpg' }],
          } }),
          delete() { geloescht = true; return this; },
        };
      },
      rpc: async (_name, { p_pfad }) => {
        if (p_pfad === 'posts/kaputt.jpg' && fehlerquelle === 'Freigabe-RPC') throw Error('Keine Verbindung');
        return { data: p_pfad === 'posts/geteilt.jpg' ? null : 'supabase' };
      },
    };
    assert.deepEqual(await handleDeleteContent(client, 'eigen', 'beitrag'), { ok: true, medienLiegen: 1 });
    assert.deepEqual(versucht, fehlerquelle === 'Dateilöschung'
      ? ['posts/kaputt.jpg', 'posts/zweites.jpg'] : ['posts/zweites.jpg']);
    assert.equal(protokoll.mock.callCount(), 1);
  });
}
