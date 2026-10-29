const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = process.argv[2] || path.resolve(__dirname, '../..');
const abhaengigkeiten = process.argv[3] || root;
const ts = require(abhaengigkeiten + '/app/node_modules/typescript');
const uuid = '00000000-0000-0000-0000-000000000001';
function laden(datei) {
  const s = fs.readFileSync(path.join(root, datei), 'utf8');
  const a = s.indexOf('async function ladeUmfragen(');
  const b = s.indexOf('\n}\n', a) + 2;
  const js = ts.transpile(s.slice(a, b), {target: ts.ScriptTarget.ES2020});
  return new Function(js + ';return ladeUmfragen')();
}
(async () => {
 let anzahl = 0;
 for (const datei of ['app/lib/daten.ts', 'web/server/supabase-api.js']) {
  const lade = laden(datei);
  for (const ids of [[], ['p_e1793224610360380'], [uuid, 'p_e1793224610360380', uuid], [uuid]]) {
   const aufrufe = [];
   const client = {from(tabelle) {
    assert.equal(tabelle, 'polls');
    return {select(){return this}, eq(){return this}, in(spalte, werte){
     aufrufe.push(werte);
     assert.equal(spalte, 'traeger_id');
     assert.deepEqual(werte, [uuid]);
     return Promise.resolve({data: [], error: null});
    }};
   }};
   assert.deepEqual(await lade(client, uuid, 'post', ids), {});
   assert.equal(aufrufe.length, ids.includes(uuid) ? 1 : 0);
   anzahl++;
  }
  const fehler = new Error('Datenbank nicht erreichbar');
  await assert.rejects(() => lade({from(){return {select(){return this},eq(){return this},in(){return {error:fehler}}}}},uuid,'post',[uuid]), fehler);
  anzahl++;
 }
 console.log(`${anzahl}/${anzahl} Regressionen bestanden (App und Website)`);
 if (process.env.LIVE === '1') {
  const {createClient}=require(abhaengigkeiten+'/app/node_modules/@supabase/supabase-js');
  require(abhaengigkeiten+'/app/test/_ki_belegung').pruefeBelegung('testbestand');
  const env=fs.readFileSync(abhaengigkeiten+'/app/.env.local','utf8');
  const v=n=>(env.match(new RegExp('^'+n+'=(.*)$','m'))||[])[1]?.trim();
  const c=createClient(v('EXPO_PUBLIC_SUPABASE_URL'),v('EXPO_PUBLIC_SUPABASE_ANON_KEY'),{auth:{persistSession:false}});
  const a=await c.auth.signInWithPassword({email:'test@all-media.app',password:v('AM_TESTKONTO_PASS')});
  if(a.error) throw a.error;
  const p=await c.from('posts').select('id').limit(20); if(p.error)throw p.error;
  assert.ok(p.data.length);
  const ids=p.data.map(p=>p.id);
  const alt=await c.from('polls').select('id').in('traeger_id',[...ids,'p_e1793224610360380']);
  assert.equal(alt.error?.code,'22P02');
  for(const datei of ['app/lib/daten.ts','web/server/supabase-api.js']) {
   const lade=laden(datei);
   const normal=await lade(c,a.data.user.id,'post',ids);
   const gemischt=await lade(c,a.data.user.id,'post',[...ids,'p_e1793224610360380']);
   assert.deepEqual(gemischt,normal);
  }
  console.log('3/3 Live-Gegenproben: alter Fehler 22P02 reproduziert, App und Website mit gemischten IDs erfolgreich; nur gelesen');
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
