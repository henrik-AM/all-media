/** Originale ProfilContext-Callbacks, kontrollierte React-Hooks und Schreibantworten. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const W=process.env.PAKET7_STUMM_QUELLE||path.resolve(__dirname,'../..');
const text=fs.readFileSync(path.join(W,'app/contexts/ProfilContext.tsx'),'utf8');
const anfang=text.indexOf('  type StummWunsch')>=0?text.indexOf('  type StummWunsch'):text.indexOf('  const [chatStummWunsch,');
const quelle=text.slice(anfang,text.indexOf('\n  const chatLeeren =',anfang));
const tick=()=>new Promise(setImmediate);
function aufbau(){let slots=[],cursor=0,effekte=[],dirty=false,server=false,calls=[],pending=[];
 const daten={ichId:'A',chats:[{id:'c',muted:false}],communityChats:[],chatsNeuLaden:async()=>{daten.chats=[{id:'c',muted:server}];dirty=true;}};
 const ctx={daten,supabase:{},chatStumm:[],setChatStumm(){},mitRueckweg:()=>()=>false,console:{error(){},warn(){}},useCallback:f=>f,
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;dirty=true;}];},
  useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
  useEffect(f,deps){const i=cursor++,alt=slots[i];if(!alt||deps.some((d,j)=>d!==alt[j])){slots[i]=deps;effekte.push(f);}},
  schreiben(_w,fn,back){Promise.resolve(fn(ctx.supabase,daten.ichId)).catch(back);},
  Aktion:{chatEinstellung(_c,k,id,_art,wert){calls.push({k,id,wert});return new Promise((resolve,reject)=>pending.push({resolve:()=>{server=wert;resolve();},reject}));}}};
 const js=ts.transpileModule('globalThis.render=()=>{'+quelle+';return {lesen:chatStummAnzeige,klick:chatStummUmschalten};};',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(js,ctx);let ui;
 function render(){do{dirty=false;cursor=0;effekte=[];ui=ctx.render();for(const f of effekte)f();}while(dirty);return ui;}
 render();return{daten,calls,pending,render,get ui(){return ui;},server(v){server=v;daten.chats=[{id:'c',muted:v}];return render();},async fertig(i=0){pending[i].resolve();await tick();render();await tick();render();},async fehler(i=0){pending[i].reject(Error('Ausfall'));await tick();render();await tick();render();}};
}
test('Bestätigter Wunsch wird bei späterer Änderung vom Zweitgerät nicht wiederbelebt',async()=>{const h=aufbau();h.ui.klick('c',false);h.render();await tick();assert.equal(h.ui.lesen('c',false),true);h.server(true);await h.fertig();assert.equal(h.ui.lesen('c',true),true);h.server(false);assert.equal(h.ui.lesen('c',false),false);});
test('Kontowechsel übernimmt keinen Stumm-Wunsch des anderen Kontos',async()=>{const h=aufbau();h.ui.klick('c',false);h.render();await tick();h.daten.ichId='B';h.render();assert.equal(h.ui.lesen('c',false),false);await h.fehler();assert.equal(h.ui.lesen('c',false),false);});
test('Zwei schnelle Tipps schreiben seriell an und aus; neuester Wunsch bleibt sichtbar',async()=>{const h=aufbau();h.ui.klick('c',false);h.ui.klick('c',false);h.render();await tick();assert.equal(h.calls.length,1);assert.equal(h.ui.lesen('c',false),false);await h.fertig(0);assert.equal(h.calls.length,2);h.server(true);assert.equal(h.ui.lesen('c',true),false);await h.fertig(1);assert.deepEqual(h.calls.map(c=>c.wert),[true,false]);assert.equal(h.ui.lesen('c',false),false);});
test('Verspäteter Fehler eines älteren Schreibens entfernt den neueren Wunsch nicht',async()=>{const h=aufbau();h.ui.klick('c',false);h.render();await tick();h.ui.klick('c',false);h.render();h.ui.klick('c',false);h.render();await h.fehler(0);assert.equal(h.ui.lesen('c',false),true);await h.fertig(1);await h.fertig(2);assert.equal(h.ui.lesen('c',true),true);});

test('Drei schnelle Tipps behalten letzten Wunsch auch bei Zwischenbestätigungen',async()=>{const h=aufbau();h.ui.klick('c',false);h.ui.klick('c',false);h.ui.klick('c',false);h.render();await tick();h.server(true);await h.fertig(0);h.server(false);assert.equal(h.ui.lesen('c',false),true,'zweite Serverantwort darf dritten Wunsch nicht entfernen');await h.fertig(1);await h.fertig(2);});

test('Kontorückkehr startet keine alten wartenden Schreibaufträge erneut',async()=>{const h=aufbau();h.ui.klick('c',false);h.ui.klick('c',false);h.render();await tick();h.daten.ichId='B';h.render();h.daten.ichId='A';h.render();await h.fertig(0);assert.equal(h.calls.length,1,'alter Auftrag darf nach A/B/A nicht starten');});
test('Fehlgeschlagener Listenabruf verwirft keine erfolgreich gespeicherte Auswahl',async()=>{const h=aufbau();h.daten.chatsNeuLaden=async()=>{throw Error('Lesefehler');};h.render();h.ui.klick('c',false);h.render();await tick();await h.fertig();assert.equal(h.ui.lesen('c',false),true);h.server(true);h.server(false);assert.equal(h.ui.lesen('c',false),false);});
