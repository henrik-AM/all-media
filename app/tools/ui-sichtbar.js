/** AXe liefert auch abgeschnittene Scroll-Inhalte mit Bildschirmkoordinaten.
 * Nur der Schnitt mit allen übergeordneten Scroll-Fenstern ist bedienbar
 * und kann andere Elemente wirklich verdecken.
 */
function schnitt(a,b){
 if(!b)return {...a};
 const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),r=Math.min(a.x+a.width,b.x+b.width),u=Math.min(a.y+a.height,b.y+b.height);
 return r>x&&u>y?{x,y,width:r-x,height:u-y}:null;
}
function baumAbflachen(knoten){
 const flach=[];
 function laufen(xs,clip=null){
  for(const k of xs){
   const f=k.frame&&k.frame.width>0&&k.frame.height>0?k.frame:null;
   const sichtbar=f?schnitt(f,clip):null;
   if(sichtbar)flach.push({text:[k.AXLabel,k.title,k.AXValue].filter(Boolean).join(' | '),typ:k.type,f:sichtbar});
   const begrenzt=k.type==='Application'||k.type==='ScrollArea'||k.role==='AXScrollArea';
   const kindClip=begrenzt&&f?schnitt(f,clip):clip;
   if(begrenzt&&f&&!kindClip)continue;
   if(k.children)laufen(k.children,kindClip);
  }
 }
 laufen(knoten);return flach;
}
module.exports={schnitt,baumAbflachen};
