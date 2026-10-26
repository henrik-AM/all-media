export interface Stand { geladen:number; gesamt:number; phase:'hochladen'|'pruefen' }
export function senden(optionen:{url:string;body:any;headers?:Record<string,string>;signal?:AbortSignal;fortschritt?:(s:Stand)=>void;xhrFabrik?:()=>XMLHttpRequest}):Promise<any>;
export function text(stand:Stand):string;
