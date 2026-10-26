// Ausführung: node --test app/test/_egress_offline.js. Kein Konto, kein Netzwerk.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const { cloudMedium, medienEgressSchuetzen } = require('./_medien_egressschutz');
const wurzel = path.join(__dirname, '../..');

function web({ sparen = false } = {}) {
  const quelle = fs.readFileSync(path.join(wurzel, 'web/public/app.js'), 'utf8');
  const ast = ts.createSourceFile('app.js', quelle, ts.ScriptTarget.Latest, true);
  const funktionen = ast.statements.filter((s) => ts.isFunctionDeclaration(s) &&
    ['videoElement', 'reelsBeobachten'].includes(s.name?.text)).map((s) => s.getText(ast)).join('\n');
  const videos = Array.from({ length: 8 }, (_, i) => ({
    dataset: { quelle: `https://example.invalid/${i}.mp4` }, quelle: null,
    paused: true, geladen: 0, events: {},
    hasAttribute() { return this.quelle !== null; },
    set src(v) { this.quelle = v; },
    removeAttribute() { this.quelle = null; },
    load() { this.geladen++; },
    play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
    addEventListener(art, fn) { this.events[art] = fn; },
  }));
  let observer, mutation;
  const feed = { isConnected: true };
  const document = { hidden: false, events: {}, getElementById: () => feed,
    addEventListener(art, fn) { this.events[art] = fn; },
    removeEventListener(art) { delete this.events[art]; } };
  const kontext = vm.createContext({ document, tonAus: true,
    main: { querySelectorAll: () => videos }, schalterAn: () => sparen,
    esc: (s) => s,
    IntersectionObserver: class {
      constructor(fn, opts) { observer = this; this.fn = fn; this.opts = opts; }
      observe() {} unobserve() {} disconnect() { this.aus = true; }
    },
    MutationObserver: class {
      constructor(fn) { mutation = this; this.fn = fn; }
      observe() {} disconnect() { this.aus = true; }
    },
  });
  vm.runInContext(`let reelsStoppen = () => {};\n${funktionen}\nreelsBeobachten();`, kontext);
  const sichtbar = (index, an = true) => ({ target: videos[index], isIntersecting: an,
    intersectionRatio: an ? 1 : 0 });
  return { videos, observer, mutation, feed, document, kontext, sichtbar };
}

test('Website: Reel-HTML hat keine aktive Quelle, Einzelplayer weiterhin schon', () => {
  const { kontext } = web();
  const reel = vm.runInContext("videoElement('x', 'film.mp4', 'bild.jpg', 'loop muted', true)", kontext);
  assert.match(reel, /data-quelle="film.mp4"/);
  assert.doesNotMatch(reel, /\ssrc=/);
  assert.match(reel, /preload="none"/);
  assert.match(vm.runInContext("videoElement('x', 'film.mp4')", kontext), /\ssrc="film.mp4"/);
});
test('Website: acht Reels beim Aufbau ohne Quelle; nur sichtbares Reel lädt', () => {
  const w = web();
  assert.equal(w.videos.filter((v) => v.quelle).length, 0);
  w.observer.fn(w.videos.map((v, i) => w.sichtbar(i, i === 0)));
  assert.equal(w.videos.filter((v) => v.quelle).length, 1);
  assert.equal(w.videos[0].paused, false);
  assert.equal(w.observer.opts.root, w.feed);
});
test('Website: Wegwischen entfernt Quelle und stoppt Pufferung', () => {
  const w = web();
  w.observer.fn([w.sichtbar(0)]);
  w.observer.fn([w.sichtbar(1), w.sichtbar(0, false)]);
  assert.equal(w.videos[0].quelle, null);
  assert.equal(w.videos[0].geladen, 1);
  assert.equal(w.videos[0].paused, true);
  assert.equal(w.videos[1].paused, false);
});
test('Website: Datensparen lädt erst beim Tippen', () => {
  const w = web({ sparen: true });
  w.observer.fn([w.sichtbar(0)]);
  assert.equal(w.videos[0].quelle, null);
  w.videos[0].events.click();
  assert.ok(w.videos[0].quelle);
});
test('Website: Hintergrund und Seitenwechsel entladen Player und räumen Beobachter auf', () => {
  const w = web();
  w.observer.fn([w.sichtbar(0)]);
  w.document.hidden = true;
  w.document.events.visibilitychange();
  assert.equal(w.videos[0].quelle, null);
  w.observer.fn([w.sichtbar(1)]);
  assert.equal(w.videos[1].quelle, null);
  w.feed.isConnected = false;
  w.mutation.fn();
  assert.equal(w.observer.aus, true);
  assert.equal(w.mutation.aus, true);
  assert.equal(w.document.events.visibilitychange, undefined);
});

function appLaden(datei, optionen = {}) {
  const quellen = [];
  let zustand = 0;
  const universell = new Proxy(function () { return universell; }, { get: (_, key) => key === Symbol.toPrimitive ? () => 0 : universell });
  const react = { forwardRef: (fn) => fn, useEffect() {}, useId: () => 'probe',
    useImperativeHandle() {}, useCallback: (fn) => fn, useMemo: (fn) => fn(),
    useRef: (v) => ({ current: v }),
    useState: (v) => [Object.hasOwn(optionen.zustaende || {}, zustand)
      ? optionen.zustaende[zustand++] : (zustand++, v), () => {}],
    createElement: (typ, props, ...kinder) => ({ typ, props: { ...props, kinder } }),
  };
  const module = { exports: {} };
  const videos = Array.from({ length: 8 }, (_, i) => ({ id: String(i), userId: 'u', mediaUri: `${i}.mp4` }));
  const mocks = { ...react, __esModule: true, default: react,
    useVideoPlayer: (quelle) => { quellen.push(quelle); return {}; },
    useEventListener() {}, aktiveWiedergabe() {},
    AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
    themenStyles: () => ({}), StyleSheet: { create: (v) => v },
    useDaten: () => ({ users: {}, videos, keinInteresse: [] }),
    useReposts: () => ({ istRepostet: () => false }),
    useProfil: () => ({ eigeneVideos: [], geteiltZaehler: {}, folgtPerson: () => false }),
    useEinstellungen: () => ({ an: () => !!optionen.sparen }),
    useImpressionen: () => ({}),
  };
  const kontext = vm.createContext({ module, exports: module.exports,
    require: () => new Proxy(mocks, { get: (obj, key) => key in obj ? obj[key] : universell }),
  });
  const js = ts.transpileModule(fs.readFileSync(path.join(wurzel, datei), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  vm.runInContext(js, kontext);
  return { exports: module.exports, quellen, videos };
}
test('App: zurückgehaltenes Video erreicht weder Player noch Ersatzbild', () => {
  const a = appLaden('app/components/Videoflaeche.tsx');
  const aus = a.exports.Videoflaeche({ id: 'x', quelle: 'x.mp4', laden: false }, null);
  assert.equal(a.quellen[0], null);
  assert.equal(aus.props.bild, undefined);
  a.exports.Videoflaeche({ id: 'x', quelle: 'x.mp4', laden: true }, null);
  assert.equal(a.quellen[1], 'x.mp4');
});
function flaeche(element) {
  if (element?.props && Object.hasOwn(element.props, 'laden')) return element;
  for (const kind of element?.props?.kinder?.flat(Infinity) || []) {
    const gefunden = flaeche(kind);
    if (gefunden) return gefunden;
  }
}
for (const [name, optionen, props, erwartet] of [
  ['Start', {}, {}, 0],
  ['Wischen', { zustaende: { 5: '4' } }, {}, 4],
  ['Profilziel', { zustaende: { 5: '0' } }, { startBei: '6' }, 6],
  ['Datensparen', { sparen: true }, {}, -1],
]) test(`App-Feed: ${name}, höchstens eine Quelle bei acht Reels`, () => {
  const a = appLaden('app/screens/video/VideoFeedScreen.tsx', optionen);
  const baum = a.exports.VideoFeedScreen(props);
  const liste = baum.props.kinder[0];
  const geladen = a.videos.map((item, index) =>
    flaeche(liste.props.renderItem({ item, index })).props.laden);
  assert.deepEqual(geladen, a.videos.map((_, i) => i === erwartet));
});

test('Prüfbrowser: Storage-Downloads und Bildtransformationen in allen Buckets gesperrt', () => {
  for (const pfad of ['/storage/v1/object/sign/media/x.mp4?t=x',
    '/storage/v1/object/public/anderer/x', '/storage/v1/render/image/sign/media/x']) {
    assert.equal(cloudMedium(`https://projekt.supabase.co${pfad}`), true);
  }
  for (const host of ['localhost', '127.0.0.1', '127.0.0.2', '[::1]']) {
    assert.equal(cloudMedium(`http://${host}/storage/v1/object/public/media/x`), false);
  }
  assert.equal(cloudMedium('https://localhost.fremd.invalid/storage/v1/object/public/media/x'), true);
});
test('Prüfbrowser: Schutz wird nur einmal registriert', async () => {
  let anzahl = 0;
  const ziel = { route() { anzahl++; } };
  await medienEgressSchuetzen(ziel);
  await medienEgressSchuetzen(ziel);
  assert.equal(anzahl, 1);
});
test('Prüfbrowser: gesperrtes Medium erzwingt Fehlercode trotz process.exit(0)', () => {
  const datei = path.join(__dirname, '_medien_egressschutz.js');
  const kind = spawnSync(process.execPath, ['-e', `
    const {medienEgressSchuetzen} = require(${JSON.stringify(datei)});
    medienEgressSchuetzen({route: async (_, fn) => {
      await fn({abort: async (grund) => {if (grund !== 'blockedbyclient') throw Error(grund);}});
    }}).then(() => process.exit(0));
  `], { encoding: 'utf8' });
  assert.equal(kind.status, 2);
  assert.match(kind.stderr, /Cloud-Medium/);
});
