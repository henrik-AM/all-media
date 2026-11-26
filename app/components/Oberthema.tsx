import { createContext, useContext } from 'react';

/*
 * Einstellungen 16.11., Kasten 1.4 (Henrik, bestätigt 24.11.2026): jede
 * Unterseite zeigt über ihrem Titel klein, zu welchem Oberthema sie gehört
 * („Messenger“ über „Lesebestätigung“). Die Einstellungsseite setzt das
 * Oberthema beim Öffnen eines Punkts; SheetRahmen liest es. Blätter, die
 * anderswo aufgehen (Chat, Profil), bekommen keins und sehen aus wie bisher.
 */
export const OberthemaKontext = createContext<string | null>(null);
export const useOberthema = () => useContext(OberthemaKontext);
