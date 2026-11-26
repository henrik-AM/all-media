/** Tatsächliche TSX-Komponenten, isolierte Hooks mit Abhängigkeiten; kein Simulator. */
const vm=require('node:vm'),ts=require('typescript'),{quelle}=require('./_af_fix_quelle');
function hooks(){let index=0;const werte=[],deps=[],effekte=[],cleanup=[];
 const react={createContext:()=>({Provider:'Provider'}),createElement:(type,props,...children)=>({type,props:props||{},children}),
 useState:v=>{const i=index++;if(!(i in werte))werte[i]=typeof v==='function'?v():v;return [werte[i],x=>{werte[i]=typeof x==='function'?x(werte[i]):x;}];},
 useRef:v=>react.useState({current:v})[0],useCallback:f=>f,useMemo:f=>f(),
 useEffect:(f,d)=>{const i=index++;if(!deps[i]||!d||d.some((x,k)=>x!==deps[i][k])){deps[i]=d;effekte.push(()=>{cleanup[i]?.();cleanup[i]=f();});}}};
 return {react,werte,render:f=>{index=0;return f();},flush:async()=>{effekte.splice(0).forEach(f=>f());await new Promise(setImmediate);},stop:()=>cleanup.forEach(f=>f?.())};}
function modul(file,require,extra={}){const ex={};const js=ts.transpileModule(quelle(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;vm.runInNewContext(js,{exports:ex,module:{exports:ex},require,console:{error(){}},setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,...extra});return ex;}
function texte(t){if(t==null||typeof t==='boolean')return '';if(typeof t!=='object')return String(t);if(Array.isArray(t))return t.map(texte).join('');return texte(t.children);}
function finde(t,p){if(!t||typeof t!=='object')return null;if(Array.isArray(t)){for(const c of t){const f=finde(c,p);if(f)return f;}return null;}if(p(t))return t;return finde(t.children,p);}
function instants(D={},ich='a'){const h=hooks(),supabase={};const ex=modul('app/components/InstantsBereich.tsx',name=>{
 if(name==='react')return h.react;if(name==='react-native')return {AppState:{currentState:'active',addEventListener:()=>({remove(){}})},Text:'Text',View:'View',ScrollView:'ScrollView'};
 if(name==='expo-camera')return {useCameraPermissions:()=>[null,()=>{}]};if(name.endsWith('SupabaseContext'))return {useSupabase:()=>({supabase})};if(name.endsWith('DatenContext'))return {useDaten:()=>({ichId:ich})};
 if(name.endsWith('/lib/instants'))return {D:{postfach:async()=>[],eigene:async()=>[],empfaengerzahl:async()=>2,stand:async()=>0,...D}};
 if(name.includes('gemeinsam/instants'))return require('../../gemeinsam/instants');if(name.endsWith('/design'))return {colors:{}};if(name==='./Druck')return {Druck:'Druck'};if(name==='./SheetRahmen')return {SheetRahmen:'Sheet'};throw Error(name);
 });return {h,ex};}
module.exports={hooks,modul,texte,finde,instants};
