/** Typen zu gruppe.js — Gruppeninfo im Messenger (Kasten 28/7.9–7.10). */
import type { Anzeige, AnzeigeQuelle } from './kontaktbild';

export const TITEL: string;
export const DU: string;
export const MITGLIEDER: string;
export const VERLASSEN: string;
export const VERLASSEN_FRAGE: string;
export const VERLASSEN_OK: string;
export const VERLASSEN_FEHLER: string;
export const UNBEKANNT: string;

export function anzahlText(andere: readonly string[] | null | undefined): string;

export interface Mitglied {
  id: string;
  name: string;
  bild?: string;
  ich: boolean;
  eigenesBild: boolean;
  eigenerName: boolean;
}

export interface MitgliederEingabe {
  andere?: readonly string[] | null;
  ich?: { name?: string; bild?: string | null } | null;
  profil?: (id: string) => { name?: string; avatar?: string | null } | null | undefined;
  kontaktBilder?: Record<string, string> | null;
  spitznamen?: Record<string, string> | null;
  messenger?: boolean;
  kontaktbild?: { anzeigeFuer: (id: string, quelle?: AnzeigeQuelle | null) => Anzeige } | null;
}

export function mitglieder(eingabe: MitgliederEingabe): Mitglied[];

export function ziel(
  id: string | null | undefined,
  wo?: { ichId?: string | null; messenger?: boolean; istKontakt?: boolean } | null
): 'selbst' | 'kontakt' | 'oeffentlich';
