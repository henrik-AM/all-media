const assert=require('node:assert/strict'),{hooks,modul}=require('./_af_fix_ui');
function profil(){const h=hooks(),weg=[],alerts=[];let uploads=0;const daten=new Proxy({ichId:'a',eigenesProfil:{name:'Probe'}},{get:(o,k)=>k in o?o[k]:[]});
 const ex=modul('app/contexts/ProfilContext.tsx',name=>{
  if(name==='react')return h.react;if(name==='react-native')return {Alert:{alert:(...s)=>alerts.push(s)}};if(name.endsWith('DatenContext'))return {useDaten:()=>daten};if(name.endsWith('SupabaseContext'))return {useSupabase:()=>({supabase:{}})};
  if(name.endsWith('/supabaseStorage'))return {ladeHoch:async()=>{uploads++;return {success:true,url:'https://lokal/storage/v1/object/public/media/posts/neu.mp4'};},ladeMedienlisteHoch:async(_c,_u,l)=>{uploads++;return l.map(m=>m.url.startsWith('https:')?m:{...m,url:'https://lokal/storage/v1/object/public/media/posts/neu.jpg'});},loesche:async(_c,p)=>{weg.push(p);return {success:true};}};
  if(name.endsWith('/aktionen'))return {beitragAnlegen:async()=>{throw Error('DB abgelehnt');}};
  if(name.startsWith('../../gemeinsam/'))return require(name);throw Error(name);
 });const wert=h.render(()=>ex.ProfilProvider({children:null})).props.value;return {wert,weg,alerts,get uploads(){return uploads;}};}
(async()=>{
 let p=profil();assert.equal(await p.wert.videoAnlegen({beschreibung:'Probe',ort:'',quer:false,mediaUri:'file:///neu.mp4',sekunden:10}),false);assert.deepEqual(p.weg,['posts/neu.mp4']);console.log('OK 1 App entfernt neuen Video-Upload nach abgelehntem Beitrag');
 p=profil();assert.equal(await p.wert.beitragAnlegen({beschreibung:'Probe',ort:'',medien:[{url:'file:///neu.jpg',typ:'image'},{url:'https://lokal/bestand.jpg',typ:'image'}]}),false);assert.deepEqual(p.weg,['posts/neu.jpg']);console.log('OK 2 App entfernt nur neue Karussellmedien, bewahrt bereits bestehende');
 p=profil();assert.equal(await p.wert.videoAnlegen({beschreibung:' ',ort:'',quer:false,mediaUri:'file:///neu.mp4',sekunden:10}),false);assert.equal(p.uploads,0);console.log('OK 3 App prüft Beschreibung vor dem Upload');console.log('3/3 Prüfungen bestanden');
})().catch(e=>{console.error(e);process.exitCode=1;});
