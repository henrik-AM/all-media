/** Gezielte Profilöffnung erweitert keinen normalen Feed. */
(function(g,f){if(typeof module==='object'&&module.exports)module.exports=f();else g.Einzelbeitrag=f();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function imFeed(beitrag,ziel,keinInteresse=[]){return (!beitrag.nurEinzeln||beitrag.id===ziel)&&(beitrag.id===ziel||!keinInteresse.includes(beitrag.id));}
 return {imFeed};
});
