/** Dokumentabnahme: Ohne echte Zone kann ausschließlich die Einschaltanleitung geprüft werden. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const datei='/Users/henrik.dikta/Library/CloudStorage/OneDrive-Persönlich/Business/AI/Henrik/2.Gehirn.md/02 Projekte/All Media/Berichte/All-Media-Bunny-Anschluss-Codex-26-10-2026.md';
const s=fs.readFileSync(datei,'utf8'),start=s.indexOf('### Pflichtregel für Instants');assert.notEqual(start,-1,'Instant-Cache-Regel fehlt in Einschaltanleitung');const regel=s.slice(start,s.indexOf('### Rückweg',start));
for(const [name,muster] of [['Pfadbereich',/\/instants\/\*/],['Browser-Cache',/Cache-Control: no-store, private/],['CDN-Cache',/Edge-Cache deaktivieren/],['Echte Gegenprobe',/kalt und wiederholt/],['Abbruchkriterium',/nicht einschalten/]])assert.match(regel,muster,name);
console.log('1/1 Dokumentabnahme bestanden; tatsächliche Anbieter-/Cacheprobe ausdrücklich offen.');
