/** Der bisher übersehene useAktionen-Erstellenweg, tatsächlicher Hook. */
const assert=require('node:assert/strict'),{laden}=require('./_bunny_fix_quelle');
function probe({ok=false,loeschfehler=false}={}){const weg=[],meldungen=[];const neu='https://lokal/storage/v1/object/public/media/posts/neu.jpg',bestand='https://lokal/storage/v1/object/public/media/posts/bestand.jpg';
 const ex=laden('app/lib/useAktionen.ts',{'react':{useCallback:f=>f,useMemo:f=>f(),useContext:()=>({})},'./aktionen':{beitragAnlegen:async()=>{if(!ok)throw Error('DB abgelehnt');return 'id';}},'./daten':{},'../contexts/SupabaseContext':{useSupabase:()=>({supabase:{}})},'../contexts/DatenContext':{useDaten:()=>({ichId:'a'})},'../contexts/SpendenwegContext':{},'expo-file-system':{},'expo-sharing':{},'./supabaseStorage':{ladeMedienlisteHoch:async(_c,_i,m)=>m.map(z=>({...z,url:z.url.startsWith('file:')?neu:z.url})),ladeHoch:async()=>({success:true,url:neu}),loesche:async(_c,p)=>{weg.push(p);return {success:!loeschfehler};}}});return {aktion:ex.useAktionen(t=>meldungen.push(t)),weg,meldungen,bestand};}
(async()=>{let n=0;async function test(s,f){await f();console.log(`OK ${++n} ${s}`);}
 await test('Karussell-DB-Fehler entfernt ausschließlich neu hochgeladene Medien',async()=>{const p=probe();assert.equal(await p.aktion.beitragMitId({medien:[{url:'file:///neu.jpg',typ:'image'},{url:p.bestand,typ:'image'}]}),null);assert.deepEqual(p.weg,['posts/neu.jpg']);});
 await test('Einzelvideo-DB-Fehler räumt den neuen Upload auf',async()=>{const p=probe();await p.aktion.beitragMitId({art:'reel',mediaUrl:'file:///neu.mp4'});assert.deepEqual(p.weg,['posts/neu.jpg']);});
 await test('Bestätigter Beitrag behält alle Dateien',async()=>{const p=probe({ok:true});assert.equal(await p.aktion.beitragMitId({mediaUrl:'file:///neu.jpg'}),'id');assert.equal(p.weg.length,0);});
 await test('Fehlgeschlagenes Aufräumen wird sichtbar gemeldet',async()=>{const p=probe({loeschfehler:true});await p.aktion.beitragMitId({mediaUrl:'file:///neu.jpg'});assert.match(p.meldungen[0],/nicht vollständig entfernt/);});
 console.log(`${n}/${n} Prüfungen bestanden`);
})().catch(e=>{console.error(e);process.exitCode=1;});
