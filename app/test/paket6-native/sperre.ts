// Vor allen Produktimporten: App-Netz ausschließlich zum eigenen Metro erlauben.
const erlaubt=(url:unknown)=>/^https?:\/\/(127\.0\.0\.1|localhost):3301(?:\/|$)/.test(String(url));
export const netz={verweigert:0};
const original=globalThis.fetch;
globalThis.fetch=((url:any,options:any)=>{
  if(!erlaubt(typeof url==='string'?url:url?.url)){netz.verweigert++;return Promise.reject(new Error('OFFLINE: externes Netz gesperrt'));}
  return original(url,options);
}) as typeof fetch;
const open=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(this:XMLHttpRequest,method:string,url:string,...rest:any[]){
  if(!erlaubt(url)){netz.verweigert++;throw new Error('OFFLINE: externe XHR gesperrt');}
  return (open as any).call(this,method,url,...rest);
} as any;
