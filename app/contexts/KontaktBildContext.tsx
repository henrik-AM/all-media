/**
 * Kasten 28/7.8 (Nachtrag 11.10.2026): Bin ich gerade im Messenger?
 *
 * Henrik: eigenes Kontaktbild „nur beim Messenger". Der Avatar steht in
 * dutzenden Bildschirmen, und derselbe Bildschirm (ChatDetailScreen,
 * TeilenSheet …) dient Messenger UND Communitys. Statt jeder Stelle eine
 * Eigenschaft durchzureichen, sagt App.tsx einmal, ob die offene Ansicht zum
 * Messenger gehört; Avatar.tsx fragt hier nach. Ohne Provider: false — also
 * nie das eigene Kontaktbild, sondern das Profilbild (Videos, Communitys).
 *
 * Die Regel, was dann gezeigt wird, steht in gemeinsam/kontaktbild.js
 * (anzeigeFuer), gleich mit der Website.
 */
import { createContext, useContext } from 'react';

export const KontaktBildBereich = createContext<boolean>(false);

export const useImMessenger = () => useContext(KontaktBildBereich);
