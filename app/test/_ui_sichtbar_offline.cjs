const {test}=require('node:test'),assert=require('node:assert/strict');
const {baumAbflachen,schnitt}=require('../tools/ui-sichtbar');
const f=(x,y,width,height)=>({x,y,width,height});
const n=(type,label,frame,children=[])=>({type,AXLabel:label,frame,children});
test('Scroll-Inhalt oberhalb des Fensters darf keinen sichtbaren Knopf verdecken',()=>{
 const tree=[n('Application','App',f(0,0,402,874),[
  n('Button','Zweites Gerät',f(8,142,104,31)),
  n('ScrollArea','',f(0,431,402,443),[n('StaticText','Simuliertes Konto',f(0,134,402,32))])])];
 const r=baumAbflachen(tree);assert.ok(r.some(x=>x.text==='Zweites Gerät'));assert.ok(!r.some(x=>x.text==='Simuliertes Konto'));
});
test('Sichtbarer Anteil einer teilweise abgeschnittenen Zeile bestimmt sichere Tippmitte',()=>{
 const r=baumAbflachen([n('ScrollArea','',f(0,100,300,200),[n('Button','Ziel',f(20,80,100,50))])]);
 assert.deepEqual(r.find(x=>x.text==='Ziel').f,f(20,100,100,30));
});
test('Echte überlagernde Fläche bleibt erhalten und kann weiter blockieren',()=>{
 const r=baumAbflachen([n('Application','App',f(0,0,400,800),[n('Button','Senden',f(300,700,60,40)),n('Group','Modal',f(0,650,400,150))])]);
 assert.deepEqual(r.at(-1).f,f(0,650,400,150));assert.equal(r.at(-1).text,'Modal');
});
test('Verschachtelte Scroll-Fenster begrenzen gemeinsam',()=>{
 const r=baumAbflachen([n('ScrollArea','',f(0,100,300,300),[n('ScrollArea','',f(10,150,100,100),[n('Button','Ziel',f(0,200,300,200))])])]);
 assert.deepEqual(r.find(x=>x.text==='Ziel').f,f(10,200,100,50));
});
test('Ganz außerhalb liegendes Scroll-Fenster gibt keine Nachfahren frei',()=>{
 const r=baumAbflachen([n('Application','App',f(0,0,400,800),[n('ScrollArea','',f(0,900,400,100),[n('Button','Unsichtbar',f(10,20,50,30))])])]);
 assert.ok(!r.some(x=>x.text==='Unsichtbar'));
});
test('Element ohne Scroll-Vorfahren bleibt innerhalb der App unverändert',()=>{
 const z=n('Button','Ziel',f(30,40,100,20));assert.deepEqual(baumAbflachen([z])[0].f,z.frame);
});
test('AXScrollArea-Rolle begrenzt auch bei anderem Typnamen',()=>{
 const scroll={...n('Group','',f(0,200,300,200),[n('Button','Weg',f(0,100,100,20))]),role:'AXScrollArea'};
 assert.ok(!baumAbflachen([scroll]).some(x=>x.text==='Weg'));
});
test('Berührende Ränder sind keine sichtbare Fläche',()=>{assert.equal(schnitt(f(0,0,10,10),f(10,0,10,10)),null);});
