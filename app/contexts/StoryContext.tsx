/**
 * Eine Quelle für „hat diese Person eine Story?" — Kasten 11.1.
 *
 * WARUM ES DAS GIBT
 *
 * Henrik am 21.09.2026: „Unter Home wird kein Story-Ring angezeigt, obwohl
 * das Profil eine Story online hat. Weitere solche Fälle selbstständig suchen
 * und beheben."
 *
 * Bis dahin hatte nur die Storyleiste einen Ring. Beitragskopf, Kurzformat,
 * Querformat, Profil, Suche, Kommentare, Chatliste und Kontaktprofil zeigten
 * das Profilbild ohne Ring — egal ob eine Story da war. Dort, wo es doch einen
 * gab (Website), entschied jede Stelle selbst.
 *
 * Die Listen hält App.tsx (dort werden sie beim Posten, Löschen und Ansehen
 * geändert). Dieser Kontext reicht sie an jedes Profilbild weiter, ohne dass
 * vierzig Bildschirme neue Props bekommen. Die Regel steht in
 * gemeinsam/story.js (ringFuer, ringListe) — dieselbe nutzt die Website.
 */
import React, { createContext, useContext } from 'react';
import { Story } from '../types';

const StoryRegeln = require('../../gemeinsam/story') as typeof import('../../gemeinsam/story');

export type StoryBereich = 'messenger' | 'videos';

export interface StoryWert {
  messenger: Story[];
  videos: Story[];
  videosAlle: Story[];
  /** Die Storys einer Person öffnen — im Betrachter nur diese Person. */
  oeffnen: (userId: string, bereich: StoryBereich) => void;
}

const leer: StoryWert = { messenger: [], videos: [], videosAlle: [], oeffnen: () => {} };

export const StoryContext = createContext<StoryWert>(leer);

export const useStorys = () => useContext(StoryContext);

/** Ring einer Person im genannten Bereich. */
export function useStoryRing(userId: string | undefined, bereich: StoryBereich) {
  const wert = useContext(StoryContext);
  if (!userId) return { status: 'keiner' as const, start: null, anzahl: 0, oeffnen: () => {} };
  const ring = StoryRegeln.ringFuer(StoryRegeln.ringListe(wert, bereich), userId);
  return { ...ring, oeffnen: () => wert.oeffnen(userId, bereich) };
}
