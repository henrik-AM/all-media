/**
 * Typen zu teilen.js — wer im Teilen-Blatt steht, gemeinsam mit der Website.
 */
export type TeilenGruppe = 'kontakte' | 'community' | 'gefolgt';
export const GRUPPEN: Record<TeilenGruppe, string>;
export function passt(person: { name?: string; handle?: string } | null | undefined, suche: string): boolean;
export function gruppen(e: {
  ich?: string;
  kontakte: string[];
  community: string[];
  gefolgt: string[];
  person: (id: string) => { name?: string; handle?: string } | null | undefined;
  suche: string;
}): { art: TeilenGruppe; titel: string; ids: string[] }[];
/** '@name', so wie in profiles.handle — oder null, wenn es keiner sein kann. */
export function nutzername(suche: string): string | null;
export function sperre(anfrage?: string): string | null;
export function knopf(anzahl: number): string;
export function grund(fehler: unknown, anfrage?: string): string;
