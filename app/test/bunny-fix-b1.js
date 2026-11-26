/** Zählt echte Signierwege; keine externen Abrufe. */
const assert=require('node:assert/strict'),{laden}=require('./_bunny_fix_quelle');
let n=0;async function test(name,fn){await fn();console.log(`OK ${++n} ${name}`);}
(async()=>{
 process.env.MEDIEN_ANBIETER='bunny';process.env.EXPO_PUBLIC_MEDIEN_SERVER='1';
 const M=laden('web/server/medien.js');let signiert=0,lese=0,erlaubt=true;
 const client={nutzerId:'b1-a',rpc:async()=>{lese++;return {data:erlaubt?[{pfad:'posts/alt.jpg',anbieter:'supabase'}]:[]};},storage:{from:()=>({createSignedUrls:async pfade=>{signiert++;return {data:pfade.map(path=>({path,signedUrl:'https://alt.invalid/'+path+'?token='+signiert}))};}})}};
 const url='https://alt.invalid/storage/v1/object/public/media/posts/alt.jpg';
 await test('Bunny-Altbestand signiert zweimaligen Abruf nur einmal, Rechte zweimal',async()=>{const a=await M.signiereMedien(client,[url]),b=await M.signiereMedien(client,[url]);assert.equal(signiert,1);assert.deepEqual(a,b);assert.equal(lese,2);});
 await test('Anderer Nutzer bekommt eine eigene Signatur',async()=>{await M.signiereMedien({...client,nutzerId:'b1-b'},[url]);assert.equal(signiert,2);});
 await test('Entzogenes Leserecht erhält keinen Cache-Link',async()=>{erlaubt=false;assert.deepEqual(await M.signiereMedien(client,[url]),[url]);assert.equal(signiert,2);});
 const A=laden('app/lib/medien.ts');let anfragen=0,token='a';const appClient={auth:{getSession:async()=>({data:{session:{user:{id:token},access_token:token}}})}};
 global.fetch=async()=>{anfragen++;return {ok:true,json:async()=>({ok:true,dateien:[{pfad:'posts/alt.jpg',url:'https://alt.invalid/signed/'+anfragen,ablauf:Date.now()+4*3600000}]})};};
 await test('App-Servermodus behält gemeinsame Cache-Adresse für Liste und Einzelmedium',async()=>{const a=await A.signiereMedien(appClient,[url]),b=await A.signiereMedien(appClient,[url]);assert.deepEqual(a,b);assert.equal(await A.signiereEine(appClient,'posts/alt.jpg'),a[0]);assert.equal(anfragen,1);});
 await test('App-Kontowechsel verwirft alten Cache',async()=>{token='b';await A.signiereMedien(appClient,[url]);assert.equal(anfragen,2);});
 await test('App respektiert tatsächlichen Server-Ablauf',async()=>{const alt=Date.now;let jetzt=alt();Date.now=()=>jetzt;try{token='c';global.fetch=async()=>{anfragen++;return {ok:true,json:async()=>({ok:true,dateien:[{pfad:'posts/alt.jpg',url:'https://alt.invalid/kurz',ablauf:jetzt+11*60000}]})};};await A.signiereEine(appClient,'posts/alt.jpg');jetzt+=2*60000;await A.signiereEine(appClient,'posts/alt.jpg');assert.equal(anfragen,4);}finally{Date.now=alt;}});
 console.log(`${n}/${n} Prüfungen bestanden`);
})().catch(e=>{console.error(e);process.exitCode=1;});
