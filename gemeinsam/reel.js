(function(g,f){if(typeof module==='object'&&module.exports)module.exports=f();else g.Reel=f();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MAX_SEKUNDEN=1200;
  function pruefen(sekunden){
    if(typeof sekunden!=='number'||!Number.isFinite(sekunden)||sekunden<=0)return 'Die Videolänge konnte nicht bestimmt werden. Bitte ein anderes Video wählen.';
    return sekunden>MAX_SEKUNDEN ? 'Videos dürfen höchstens 20 Minuten lang sein.' : null;
  }
  function zeit(s){s=Number.isFinite(Number(s))?Math.max(0,Math.floor(Number(s))):0;return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
  function ziel(anteil,gesamt){return Math.max(0,Math.min(1,Number(anteil)||0))*(Number.isFinite(Number(gesamt))?Math.max(0,Number(gesamt)):0);}
  return {MAX_SEKUNDEN,pruefen,zeit,ziel};
});
