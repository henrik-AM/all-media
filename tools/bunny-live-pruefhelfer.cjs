/** Lesender Browsernachweis: echter App-Code über _modulquelle, Serverbasis 3300. */
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
require('../app/test/_ki_belegung').pruefeBelegung();
const ts=require('../app/node_modules/typescript');
const {zusammengelegt}=require('../app/test/_modulquelle');
const {chromium}=require('../app/node_modules/playwright-core');
const {supabase}=require('../web/server/supabase');
const {TESTKONTO_PASS}=require('../app/test/_testpasswoerter');
async function main(){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'bunny-pruefhelfer-'));
 let browser;let geprueft=0;
 const check=(name,wert)=>{assert.ok(wert,name);geprueft++;console.log('OK '+name);};
 try{
  const src=fs.readFileSync(path.join(root,'app/lib/medien.ts'),'utf8');
  const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  fs.writeFileSync(path.join(tmp,'medien.js'),js);
  fs.writeFileSync(path.join(tmp,'probe.js'),"import { medienServerBasis, signiereEine } from './medien';\nexport { medienServerBasis, signiereEine };\n");
  const code=zusammengelegt(tmp,'probe.js');
  check('Produktionsfallback im Prüfhilfsteil ersetzt',!code.includes('https://all-media-website.onrender.com'));
  const {data,error}=await supabase.auth.signInWithPassword({email:'test@all-media.app',password:TESTKONTO_PASS});
  if(error)throw Error('Prüfkonto-Anmeldung fehlgeschlagen');
  browser=await chromium.launch({channel:'chromium-headless-shell'});
  const p=await browser.newPage({bypassCSP:true});
  const anfragen=[];
  p.on('request',r=>{if(r.url().includes('/api/medien/unterschreiben'))anfragen.push(r.url());});
  await p.goto('http://127.0.0.1:3300',{waitUntil:'load'});
  const ergebnis=await p.evaluate(async({code,token,id})=>{
   const u=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
   try{
    const m=await import(u);
    const c={auth:{getSession:async()=>({data:{session:{access_token:token,user:{id}}}})},storage:{from:()=>{throw Error('Direkter Storagezugriff im App-Signierweg');}}};
    return {basis:m.medienServerBasis(),abgewiesen:await m.signiereEine(c,'posts/nicht-vorhandene-leseprobe.jpg')===null};
   }finally{URL.revokeObjectURL(u);}
  },{code,token:data.session.access_token,id:data.user.id});
  check('Browser-Blob benutzt lokale Basis',ergebnis.basis==='http://127.0.0.1:3300');
  check('App-Signierfunktion tatsächlich aufgerufen',anfragen.length===1);
  check('Signieranfrage ausschließlich auf 3300',anfragen.every(u=>new URL(u).origin==='http://127.0.0.1:3300'));
  check('Nicht vorhandene Datei bleibt ohne Signatur',ergebnis.abgewiesen);
  console.log(`${geprueft}/${geprueft} Prüfungen bestanden; keine Uploads, Nachrichten oder SQL-Abfragen.`);
 }finally{if(browser)await browser.close();fs.rmSync(tmp,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
