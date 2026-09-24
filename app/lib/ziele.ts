/**
 * Ort und Sound am Beitrag antippbar machen.
 *
 * Henrik am 21.09.2026: "Ort und Sound/Song unter dem Profilnamen sind nicht
 * antippbar, obwohl angezeigt wird, dass etwas hinterlegt ist." Vorher kam
 * nur ein Hinweis "Standort: Hamburg". Die Seiten dahinter gab es schon
 * (ExplorerScreen), sie waren nur ueber die Suche erreichbar.
 *
 * Am Beitrag steht aber "Hamburg" statt "Hamburger Hafen" und "Golden Hour -
 * Lys" statt "Golden Hour". Dieselbe Regel wie /api/explorer in
 * web/server/app.js: zuerst Kennung und Name, dann das Feld `ort` bzw. der
 * Titel vor dem Strich.
 */
import { useCallback } from 'react';
import { useDaten } from '../contexts/DatenContext';
import type { ExplorerZiel } from '../screens/videos/ExplorerScreen';
import { Place, Sound } from '../types';

export const ortFinden = (orte: Place[], wert: string): Place | undefined =>
  orte.find((p) => p.id === wert || p.name === wert) ?? orte.find((p) => p.ort === wert);

export const soundFinden = (sounds: Sound[], wert: string): Sound | undefined => {
  const titelTeil = wert.split(/\s+[–—-]\s+/)[0].trim();
  return sounds.find((x) => x.id === wert || x.title === wert) ?? sounds.find((x) => x.title === titelTeil);
};

/**
 * Oeffnet die Seite zu Ort oder Sound. Gibt es keine - "Originalton" ist
 * kein Eintrag -, sagt ein Hinweis das, wie auf der Website.
 */
export const useZielOeffnen = (
  onOpenExplorer: ((ziel: ExplorerZiel) => void) | undefined,
  onNotice: (message: string) => void
) => {
  const { places, sounds } = useDaten();

  const ort = useCallback(
    (wert: string) => {
      const platz = ortFinden(places, wert);
      if (!platz || !onOpenExplorer) return onNotice('Diesen Standort gibt es nicht');
      onOpenExplorer({ art: 'standort', wert: platz.id });
    },
    [places, onOpenExplorer, onNotice]
  );

  const sound = useCallback(
    (wert: string) => {
      const treffer = soundFinden(sounds, wert);
      if (!treffer || !onOpenExplorer) {
        return onNotice(wert === 'Originalton' ? 'Originalton hat keine eigene Seite' : 'Diesen Sound gibt es nicht');
      }
      onOpenExplorer({ art: 'sound', wert: treffer.id });
    },
    [sounds, onOpenExplorer, onNotice]
  );

  return { ort, sound };
};
