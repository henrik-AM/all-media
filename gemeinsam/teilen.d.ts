/**
 * Typen zu teilen.js — wer im Teilen-Blatt steht, gemeinsam mit der Website.
 */
export type TeilenGruppe = 'kontakte' | 'community' | 'gefolgt';
export const GRUPPEN: Record<TeilenGruppe | 'communitys', string>;
export function passt(person: { name?: string; handle?: string } | null | undefined, suche: string): boolean;
export function gruppen(e: {
  ich?: string;
  kontakte: string[];
  community: string[];
  gefolgt: string[];
  person: (id: string) => { name?: string; handle?: string } | null | undefined;
  suche: string;
}): { art: TeilenGruppe; titel: string; ids: string[] }[];
/** Ganze Communitys: beigetreten, mit Unterthema; voreingestellt ist das erste, `kanaele` sind alle zur Wahl. */
export function communitys(
  liste: { id: string; name: string; joined?: boolean; unterthemen?: { id: string; name: string }[]; channels?: { id: string; name: string }[] }[] | null | undefined,
  suche: string
): { id: string; name: string; kanal: { id: string; name: string }; kanaele: { id: string; name: string }[] }[];
/** '@name', so wie in profiles.handle — oder null, wenn es keiner sein kann. */
export function nutzername(suche: string): string | null;
export function sperre(anfrage?: string): string | null;
export function knopf(anzahl: number, communityAnzahl?: number): string;
export function grund(fehler: unknown, anfrage?: string): string;
