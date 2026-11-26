export interface Medium {url:string;typ:'image'|'video';mime?:string;sekunden?:number;}
export function liste(e:{medien?:Medium[];mediaUrl?:string|null;mediaUri?:string;media_url?:string}):Medium[];
export function verschieben(m:Medium[],von:number,nach:number):Medium[];
export function entfernen(m:Medium[],bei:number):Medium[];
export function pruefen(m:unknown):string|null;
