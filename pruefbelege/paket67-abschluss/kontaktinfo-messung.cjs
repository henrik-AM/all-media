// Ergänzende Messung des unveränderten Originalprüflaufs; keine Antworten ersetzen.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../../app/node_modules/playwright-core');
const original=chromium.launch.bind(chromium);const ziel=path.join(__dirname,'kontaktinfo-messung.log');
const log=(art,d)=>fs.appendFileSync(ziel,JSON.stringify({at:new Date().toISOString(),art,...d})+'\n');
chromium.launch=async(...args)=>{
 const browser=await original(...args),neu=browser.newContext.bind(browser);
 browser.newContext=async(...a)=>{const ctx=await neu(...a);ctx.on('page',p=>{
  p.on('request',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))log('anfrage',{pfad:u.pathname});});
  p.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))log('antwort',{pfad:u.pathname,status:r.status(),ms:r.request().timing().responseEnd});});
  const klicken=p.click.bind(p);p.click=async(sel,...rest)=>{log('klick',{sel});return klicken(sel,...rest);};
  const warten=p.waitForSelector.bind(p);p.waitForSelector=async(sel,...rest)=>{const ab=Date.now();try{const r=await warten(sel,...rest);log('sichtbar',{sel,ms:Date.now()-ab});return r;}catch(e){log('wartfehler',{sel,ms:Date.now()-ab});if(sel==='.kp__zeileText')await p.screenshot({path:path.join(__dirname,'kontaktinfo-wartfehler.png')}).catch(()=>{});throw e;}};
 });return ctx;};return browser;
};
