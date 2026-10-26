export const TEXT_MAX: number, BILD_MAX: number, SEITE_MAX: number, URL_SEKUNDEN: number;
export const HINWEIS: string;
export function pruefen(text: string, anzahl: number, bytes?: number): string | null;
export function masse(w: number, h: number): {
    breite: number;
    hoehe: number;
};
export function kameragroesse(groessen: string[]): string | null;
export function sichtbar(i: {
    geoeffnet_at?: string | null;
    blockiert?: boolean;
    expires_at: string;
}, jetzt?: number): boolean;
