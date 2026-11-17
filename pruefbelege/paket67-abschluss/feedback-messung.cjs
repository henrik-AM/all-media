// Ergänzende Messung des unveränderten Originalprüflaufs; keine Antworten ersetzen.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../../app/node_modules/playwright-core');
const original=chromium.launch.bind(chromium);const ziel=path.join(__dirname,'feedback-messung.log');
const log=(art,d)=>fs.appendFileSync(ziel,JSON.stringify({at:new Date().toISOString(),art,...d})+'\n');
chromium.launch=async(...args)=>{
 const browser=await original(...args),neu=browser.newContext.bind(browser);
 browser.newContext=async(...a)=>{const ctx=await neu(...a);ctx.on('page',p=>{
  p.on('response',async r=>{const pfad=new URL(r.url()).pathname;if(pfad==='/api/contacts'||pfad==='/api/contacts/vorbereiten'){const d=await r.json().catch(()=>({}));log('kontaktantwort',{pfad,status:r.status(),ok:d.ok,error:d.error,contactId:d.contact?.id,contactStatus:d.contact?.status,chat:d.chat?{id:d.chat.id,requestState:d.chat.requestState,userId:d.chat.userId}:undefined});}});
  p.on('request',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))log('anfrage',{pfad:u.pathname});});
  p.on('requestfinished',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))log('beendet',{pfad:u.pathname,ms:r.timing().responseEnd});});
  const klicken=p.click.bind(p);p.click=async(sel,...rest)=>{log('klick',{sel});return klicken(sel,...rest);};
  const warten=p.waitForSelector.bind(p);p.waitForSelector=async(sel,...rest)=>{const ab=Date.now();try{const r=await warten(sel,...rest);log('sichtbar',{sel,ms:Date.now()-ab});return r;}catch(e){log('wartfehler',{sel,ms:Date.now()-ab});if(sel==='.anfrage'){log('anfragestand',await p.evaluate(()=>({titel:document.querySelector('.chathead__name')?.textContent,fehler:document.querySelector('.sheet__fehler')?.textContent,anfragen:document.querySelectorAll('.anfrage').length,chats:typeof state==='undefined'?[]:state.chats.filter(c=>c.name?.includes('Greta')).map(c=>({id:c.id,requestState:c.requestState,messengerAnfrage:c.messengerAnfrage,userId:c.userId}))})));await p.screenshot({path:path.join(__dirname,'feedback-anfrage-wartfehler.png')}).catch(()=>{});}throw e;}};
 });return ctx;};return browser;
};
