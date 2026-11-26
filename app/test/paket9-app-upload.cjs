const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const MedienUpload = require('../../gemeinsam/upload');
const quelltext = ts.transpileModule(fs.readFileSync(require.resolve('../lib/supabaseStorage.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function appUpload(antworten) {
  let stand = null;
  const protokoll = [];
  let freigaben = 0;
  class File {
    size = 1000;
    open() {
      return { readBytes: async () => new Uint8Array(Buffer.from('0000ftypisom')), close() {} };
    }
    createUploadTask(url, opts) {
      assert.match(url, /\/api\/hochladen\/datei\?ordner=posts$/);
      assert.equal(opts.headers.Authorization, 'Bearer prueftoken');
      assert.equal(opts.headers['Content-Type'], 'video/mp4');
      let fortschritt;
      return {
        addListener: (_event, melden) => {
          fortschritt = melden;
          return { remove: () => { freigaben++; } };
        },
        uploadAsync: () => antworten.shift()(fortschritt, opts.signal),
        release: () => { freigaben++; },
      };
    }
  }
  const abhaengig = {
    'expo-file-system': { File },
    '../../gemeinsam/upload': MedienUpload,
    './medien': {
      medienServerBasis: () => 'https://app.invalid',
      uploadIstAktiv: () => Boolean(stand),
      uploadStandSetzen: (neu) => {
        stand = neu;
        protokoll.push(neu ? MedienUpload.text(neu) : null);
      },
    },
  };
  const exports = {};
  vm.runInNewContext(quelltext, {
    exports, navigator: { product: 'ReactNative' }, AbortController, console: { error() {} },
    fetch: () => { throw new Error('Der native Transport liest das Video direkt von der Datei'); },
    require: (id) => abhaengig[id],
  });
  const client = { auth: { getSession: async () => ({ data: { session: { access_token: 'prueftoken' } } }) } };
  return {
    upload: () => exports.ladeHoch(client, 'file:///reel.mp4', 'posts', 'reel.mp4'),
    abbrechen: () => stand.abbrechen(),
    protokoll,
    freigaben: () => freigaben,
  };
}
const erfolgreich = async (melden) => {
  melden({ bytesSent: 235n, totalBytes: 1000n });
  melden({ bytesSent: 680, totalBytes: 1000 });
  melden({ bytesSent: 1000n, totalBytes: 1000n });
  return { status: 200, body: '{"ok":true,"url":"bestaendig","sekunden":45}' };
};

test('Nativer Reel-Upload meldet echte Byteanteile und danach Verarbeitung', async () => {
  const app = appUpload([erfolgreich]);
  assert.equal((await app.upload()).url, 'bestaendig');
  assert.deepEqual(app.protokoll, [
    'Hochladen: 0 %', 'Hochladen: 23 %', 'Hochladen: 68 %',
    'Aufnahme wird geprüft und gespeichert …', null,
  ]);
  assert.equal(app.freigaben(), 2);
});

test('Abbruch und Fehler lassen den nächsten nativen Upload zu', async () => {
  const bereit = Promise.withResolvers();
  const app = appUpload([
    (melden, signal) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(Error('The operation was aborted.'), {name:'AbortError'})), {once:true});
      melden({ bytesSent: 310 });
      bereit.resolve();
    }),
    async () => ({ status: 503, body: '{"ok":false,"error":"Bitte erneut versuchen."}' }),
    erfolgreich,
  ]);
  const abbruch = app.upload();
  await bereit.promise;
  app.abbrechen();
  assert.equal((await abbruch).error, 'Hochladen abgebrochen.');
  assert.equal((await app.upload()).error, 'Bitte erneut versuchen.');
  assert.equal((await app.upload()).success, true);
  assert.equal(app.freigaben(), 6);
});
