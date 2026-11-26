/** Geordnete Medien ohne künstliche Stückgrenze; Altbeiträge behalten ihr einzelnes Medium. */
(function(g,f){if(typeof module==='object'&&module.exports)module.exports=f();else g.Karussell=f();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function liste(e){const m=e?.medien;if(Array.isArray(m)&&m.length)return m;const url=e?.mediaUrl||e?.mediaUri||e?.media_url;return url?[{url,typ:/\.(mp4|mov|m4v|webm)([?#]|$)/i.test(url)?'video':'image'}]:[];}
 function verschieben(m,von,nach){const neu=m.slice();if(!Number.isInteger(von)||!Number.isInteger(nach)||von<0||nach<0||von>=m.length||nach>=m.length)return neu;const [wert]=neu.splice(von,1);neu.splice(nach,0,wert);return neu;}
 function entfernen(m,bei){return m.filter((_,i)=>i!==bei);}
 function pruefen(m){if(!Array.isArray(m))return 'Die Medienliste ist ungültig.';for(const z of m){if(!z||typeof z.url!=='string'||!z.url||!['image','video'].includes(z.typ))return 'Eine Aufnahme ist ungültig.';}return null;}
 return {liste,verschieben,entfernen,pruefen};
});
