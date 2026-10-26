export interface Person {
    id: string;
    name: string;
    handle: string;
}
export interface Instant {
    id: string;
    absender: string;
    name: string;
    text: string;
    expires_at: string;
}
export function freunde(c: any, ich: string, suche?: string): Promise<{
    freunde: Person[];
    vorschlaege: Person[];
}>;
export function freund(c: any, ich: string, id: string, an: boolean): Promise<unknown>;
export function postfach(c: any): Promise<Instant[]>;
export function senden(c: any, pfad: string, text: string): Promise<string>;
export function datei(c: any, id: string): Promise<{
    bild_pfad: string;
    text: string;
}>;
export function oeffnen(c: any, id: string): Promise<boolean>;
export function zurueckziehen(c: any, id: string): Promise<void>;
export function eigene(c: any, ich: string): Promise<Instant[]>;
export function empfaengerzahl(c: any): Promise<number>;
