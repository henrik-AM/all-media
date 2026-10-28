/** Kontrollierter Altmedienlauf: persistentes Gesamtbudget, Pilot, Fortsetzen und SHA256. */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {frage,dienst,basis}=require('./bunny-umzug-helfer.cjs');
const Bunny=require('../web/server/bunny');
require('../app/test/_ki_belegung').pruefeBelegung();
const root=path.resolve(process.env.BUNNY_UMZUG_ZUSTAND||path.join(__dirname,'../../bunny-umzug-zustand'));
assert.ok(!root.startsWith(path.resolve(__dirname,'..')+path.sep),'Zustand darf nicht ins Repo');
fs.mkdirSync(root,{recursive:true});
const aus=path.resolve('pruefbelege/bunny-umzug');fs.mkdirSync(aus,{recursive:true});
const budgetDatei=path.join(root,'budget.json'),zustand=path.join(root,'zustand.jsonl'),hashDatei=path.join(root,'hash-belege.jsonl');
const budget=fs.existsSync(budgetDatei)?JSON.parse(fs.readFileSync(budgetDatei)): {grenze:150*1048576,verbraucht:0};
assert.equal(budget.grenze,150*1048576);
function speichern(){fs.writeFileSync(budgetDatei+'.neu',JSON.stringify(budget)+'\n',{mode:0o600});fs.renameSync(budgetDatei+'.neu',budgetDatei);}
async function gezaehlt(url,opt){
 const r=await fetch(url,opt);const reader=r.body?.getReader();
 const stream=new ReadableStream({async pull(controller){try{const d=await reader.read();if(d.done){controller.close();return;}budget.verbraucht+=d.value.length;speichern();if(budget.verbraucht>budget.grenze){await reader.cancel();controller.error(Error('Gesamtbudget überschritten'));return;}controller.enqueue(d.value);}catch(e){controller.error(e);}},cancel(){return reader?.cancel();}});
 return new Response(stream,{status:r.status,statusText:r.statusText,headers:r.headers});
}
(async()=>{
 const modus=process.argv[2];assert.ok(['trocken','pilot','rest','kontrolle','typen'].includes(modus),'Modus trocken|pilot|rest|kontrolle|typen');
 const key=await dienst();const adapter=Bunny.erstelleBunny(Bunny.konfigurationAus());assert.ok(adapter.bereit);
 const katalog=await frage("select name as pfad,owner_id,metadata->>'size' as bytes,metadata->>'mimetype' as typ,metadata->>'eTag' as md5,created_at from storage.objects where bucket_id='media' order by name");
 if(!fs.existsSync(path.join(root,'quelle-vorher.json')))fs.writeFileSync(path.join(root,'quelle-vorher.json'),JSON.stringify(katalog,null,2));
 if(modus==='typen'){
   const journal=new Map(fs.readFileSync(zustand,'utf8').trim().split('\n').map(JSON.parse).filter(e=>e.sha256).map(e=>[e.pfad,e]));
   const ergebnisse=[];
   for(const e of journal.values())if(e.pfad.startsWith('ptt/')&&e.typ==='audio/mp4'){
     // Gleiche Pfade wurden zuvor mit falschem MIME gecacht: nur diesen Pfad purgen.
     const purge=new URL('https://api.bunny.net/purge');purge.searchParams.set('url',Bunny.konfigurationAus().auslieferung+'/'+e.pfad+'*');purge.searchParams.set('async','false');
     const p=await fetch(purge,{method:'POST',headers:{AccessKey:process.env.BUNNY_API_KEY},redirect:'error',signal:AbortSignal.timeout(10000)});assert.equal(p.status,200);
     const r=await fetch(adapter.signierteAdresse(e.pfad),{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);const typ=r.headers.get('content-type').split(';')[0];assert.ok(['audio/mp4','audio/x-m4a'].includes(typ),'CDN liefert einen M4A-Audiotyp');
     const bytes=Buffer.from(await r.arrayBuffer());assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),e.sha256);
     const probe=require('child_process').spawnSync('ffprobe',['-v','error','-show_entries','stream=codec_name,codec_type','-of','json','pipe:0'],{input:bytes,encoding:'utf8'});assert.equal(probe.status,0);const streams=JSON.parse(probe.stdout).streams;assert.ok(streams.some(s=>s.codec_type==='audio'));
     ergebnisse.push({pfad:e.pfad,typ,registerTyp:e.typ,streams,bytes:bytes.length,sha256:e.sha256,status:r.status});
   }
   assert.equal(ergebnisse.length,4);fs.writeFileSync(path.join(aus,'06-m4a-typen.json'),JSON.stringify(ergebnisse,null,2)+'\n');console.log('4/4 historische M4A: CDN-Purge, Audiotyp, ffprobe, 200 und SHA256 identisch');return;
 }
 if(modus==='kontrolle'){
   const vorher=JSON.parse(fs.readFileSync(path.join(root,'quelle-vorher.json')));assert.deepEqual(katalog,vorher,'Supabase-Quellkatalog verändert');
   const fertig=new Map(fs.readFileSync(zustand,'utf8').trim().split('\n').map(l=>JSON.parse(l)).filter(e=>e.sha256).map(e=>[e.pfad,e]));
   const hashes=new Map(fs.readFileSync(hashDatei,'utf8').trim().split('\n').map(l=>JSON.parse(l)).map(e=>[e.pfad,e]));
   const db=await frage('select pfad,bytes,sha256,geloescht_am from public.medien_objekte where migriert_am is not null order by pfad');
   for(const e of katalog){assert.ok(fertig.has(e.pfad),'Kopie fehlt');assert.equal(hashes.get(e.pfad)?.sha256,fertig.get(e.pfad).sha256);const d=db.find(d=>d.pfad===e.pfad);assert.equal(d?.sha256,fertig.get(e.pfad).sha256);assert.equal(Number(d.bytes),Number(e.bytes));assert.equal(d.geloescht_am,null);}
   const report={gelistet:katalog.length,kopiert:fertig.size,sha256Identisch:hashes.size,registriert:db.length,quellkatalogIdentisch:true,quellBytes:katalog.reduce((s,e)=>s+Number(e.bytes),0),supabaseEgressBytes:budget.verbraucht,budgetBytes:budget.grenze,zustandsordner:root};
   fs.writeFileSync(path.join(aus,'06-vollstaendigkeit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));return;
 }
 const original=adapter.hochladen;
 adapter.hochladen=async(p,bytes,typ,opt)=>{
   const r=await original(p,bytes,typ,opt);if(!r.ok)return r;
   const response=await fetch(adapter.signierteAdresse(p),{signal:AbortSignal.timeout(60000)});assert.equal(response.status,200,'Bunny-GET nach Kopie');
   const ist=crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
   const soll=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(ist,soll,'Bunny SHA256 '+p);
   fs.appendFileSync(hashDatei,JSON.stringify({pfad:p,bytes:bytes.length,sha256:ist})+'\n');return r;
 };
 // Fortsetzung des ursprünglichen Laufes: bereits kopierte, wegen falschem
 // Quell-MIME ausgelassene M4A-Dateien aus Bunny korrigieren, ohne Supabase-Egress.
 if(modus!=='trocken'&&fs.existsSync(zustand)){
   const eintraege=new Map(fs.readFileSync(zustand,'utf8').trim().split('\n').map(JSON.parse).filter(e=>e.sha256).map(e=>[e.pfad,e]));
   for(const e of eintraege.values())if(e.pfad.startsWith('ptt/')&&e.pfad.endsWith('.m4a')&&e.typ==='image/jpeg'&&e.umschaltbar!==true){
     const r=await fetch(adapter.signierteAdresse(e.pfad),{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());
     assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),e.sha256);assert.equal(Bunny.inhaltPruefen('ptt','audio/mp4',bytes),null);
     assert.ok((await adapter.hochladen(e.pfad,bytes,'audio/mp4',{pruefen:false})).ok);
     fs.appendFileSync(zustand,JSON.stringify({...e,typ:'audio/mp4',umschaltbar:true})+'\n');console.log('M4A-Typ aus geprüften Bunny-Bytes korrigiert: '+e.pfad);
   }
 }
 const {umziehen}=await import('./medien-umzug-bunny.mjs');
 const umschalten=async e=>{
   const r=await fetch(basis+'/rest/v1/rpc/medien_umzug_registrieren',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_pfad:e.pfad,p_typ:e.typ,p_bytes:e.bytes,p_sha256:e.sha256}),signal:AbortSignal.timeout(30000)});
   assert.ok(r.ok,'Registrierung Status '+r.status);const wert=await r.json();return {ok:wert==='bunny',grund:wert};
 };
 const z=await umziehen({quelle:{art:'supabase',basis,schluessel:key},bunny:adapter,ausfuehren:modus!=='trocken',maxDateien:modus==='pilot'?3:Infinity,budgetBytes:budget.grenze-budget.verbraucht,zustand,pruefen:modus!=='trocken',umschalten:modus==='trocken'?null:umschalten,abruf:gezaehlt});
 const report={modus,...z,gesamtEgressBytes:budget.verbraucht,budgetBytes:budget.grenze};fs.writeFileSync(path.join(aus,'04-'+modus+'.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 assert.equal(z.fehler,0);assert.equal(z.pruefAbweichungen,0);assert.equal(z.umschaltAusgelassen,0);if(modus==='pilot'){assert.equal(z.hochgeladen,3);assert.equal(z.umgeschaltet,3);}if(modus==='rest')assert.equal(z.status,'fertig');
})().catch(e=>{console.error('FEHL '+e.message);process.exitCode=1;});
