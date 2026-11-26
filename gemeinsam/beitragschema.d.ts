export function fehlt(fehler: {code?: string; message?: string} | null | undefined): boolean;
export function spalten(liste: string, mitMedien: boolean): string;
export function lesen(abfrage: (mitMedien: boolean) => PromiseLike<any>): Promise<any>;
export function schreiben(client: any, zeile: Record<string, any>, rueckgabe?: string): Promise<any>;
