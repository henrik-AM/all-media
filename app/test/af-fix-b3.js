const assert=require('node:assert/strict'),{instants,finde}=require('./_af_fix_ui');
(async()=>{let sprung=1,verbraucht=0;const props=()=>({sprung,onSprungFertig:()=>{verbraucht++;sprung=0;}});let x=instants();const render=()=>x.h.render(()=>x.ex.InstantsBereich(props()));
 render();await x.h.flush();assert.equal(finde(render(),t=>t.type==='Sheet'&&t.props.title==='Instants').props.visible,true);
 assert.equal(verbraucht,1);console.log('OK 1 Mitteilung öffnet und verbraucht den Sprung genau einmal');
 finde(render(),t=>t.type==='Sheet'&&t.props.title==='Instants').props.onClose();x.h.stop();x=instants();render();await x.h.flush();assert.equal(finde(render(),t=>t.type==='Sheet'&&t.props.title==='Instants').props.visible,false);console.log('OK 2 Rückkehr zur Chatliste öffnet kein altes Blatt');
 x.h.stop();x=instants({},'b');render();await x.h.flush();assert.equal(finde(render(),t=>t.type==='Sheet'&&t.props.title==='Instants').props.visible,false);console.log('OK 3 Kontowechsel übernimmt keinen verbrauchten Sprung');
 sprung=2;render();await x.h.flush();assert.equal(finde(render(),t=>t.type==='Sheet'&&t.props.title==='Instants').props.visible,true);assert.equal(verbraucht,2);x.h.stop();console.log('OK 4 Neue Mitteilung öffnet wieder genau einmal');console.log('4/4 Prüfungen bestanden');
})().catch(e=>{console.error(e);process.exitCode=1;});
