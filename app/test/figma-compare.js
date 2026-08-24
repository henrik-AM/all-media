// Referenzbilder aus dem Figma-Prototypen holen und die eigenen Screens
// danebenlegen.
//
// Voraussetzung: der Web-Server laeuft (npm run web-app) und der Figma-Token
// steht in der Umgebung:
//   export FIGMA_TOKEN=...   (im Vault: 04 Ressourcen/Zugangsdaten/Figma.md)
//
// Start:  node test/figma-compare.js [Zielordner]
//
// Danach liegen im Zielordner je Screen zwei Dateien: <name>.figma.png und
// <name>.app.png. Der Vergleich ist bewusst Handarbeit — die Bilder sind
// Wireframes ohne Farben, ein Pixelvergleich waere sinnlos.

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const FILE_KEY = 'URfbZmKwzfiHIPt5qtF95u';
const TOKEN = process.env.FIGMA_TOKEN;
const OUT = process.argv[2] || path.join(__dirname, '..', '..', '.compare');

// Prototyp-Frame  ->  Weg durch die App
const SCREENS = [
  { name: 'messenger-chats', node: '1:2', area: 'messenger', sub: 'chats' },
  { name: 'messenger-friendmap', node: '119:218', area: 'messenger', sub: 'friendmap' },
  { name: 'messenger-kamera', node: '105:208', area: 'messenger', sub: 'camera' },
  { name: 'messenger-profil', node: '77:198', area: 'messenger', sub: 'profile' },
  { name: 'videos-home', node: '156:228', area: 'videos', sub: 'home' },
  { name: 'videos-hochformat', node: '270:387', area: 'videos', sub: 'portrait' },
  { name: 'videos-querformat', node: '286:411', area: 'videos', sub: 'landscape' },
  { name: 'videos-suche', node: '339:621', area: 'videos', sub: 'search' },
  { name: 'videos-profil', node: '478:899', area: 'videos', sub: 'profile' },
  { name: 'communitys-home', node: '491:850', area: 'communities', sub: 'home' },
  { name: 'communitys-chats', node: '498:1080', area: 'communities', sub: 'chats' },
  { name: 'communitys-suchen', node: '501:1309', area: 'communities', sub: 'search' },
  { name: 'communitys-profil', node: '507:1221', area: 'communities', sub: 'profile' },
  { name: 'einstellungen', node: '514:1520', area: 'settings', sub: null },
];

async function figmaImages(nodes) {
  const url = `https://api.figma.com/v1/images/${FILE_KEY}?ids=${nodes.join(',')}&format=png&scale=1`;
  const res = await fetch(url, { headers: { 'X-Figma-Token': TOKEN } });
  const body = await res.json();
  if (body.err) throw new Error('Figma: ' + body.err);
  return body.images;
}

(async () => {
  if (!TOKEN) {
    console.error('FIGMA_TOKEN fehlt. Siehe 04 Ressourcen/Zugangsdaten/Figma.md');
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });

  const images = await figmaImages(SCREENS.map((s) => s.node));
  for (const screen of SCREENS) {
    const link = images[screen.node];
    if (!link) {
      console.log('kein Bild fuer', screen.name);
      continue;
    }
    const png = Buffer.from(await (await fetch(link)).arrayBuffer());
    fs.writeFileSync(path.join(OUT, `${screen.name}.figma.png`), png);
  }

  const browser = await chromium.launch({ channel: 'chromium-headless-shell' });
  const page = await browser.newPage({ viewport: { width: 400, height: 860 } });
  await page.request.post('http://localhost:3000/api/reset');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  for (const screen of SCREENS) {
    await page.click(`[data-area="${screen.area}"]`);
    await page.waitForTimeout(350);
    if (screen.sub) {
      await page.click(`[data-sub="${screen.sub}"]`);
      await page.waitForTimeout(450);
    }
    await page.screenshot({ path: path.join(OUT, `${screen.name}.app.png`) });
    console.log('ok', screen.name);
  }

  await browser.close();
  console.log('\nBilder liegen in ' + OUT);
})();
