import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/*
 * Video-Einstellungen im Querformat.
 *
 * Henrik am 26.08.2026, Punkt 31: "Keine Einstellungen (Untertitel,
 * Geschwindigkeit). Nach YouTube — Untertitel, Geschwindigkeit, Qualität."
 *
 * Sie gelten fuer alle Videos, nicht je Video — so haelt es YouTube auch. Und
 * sie ueberleben einen Neustart: eine Geschwindigkeit, die man bei jedem
 * Video neu einstellen muss, waere keine Einstellung, sondern ein Schalter.
 *
 * Dieselben Werte liegen in der Website im localStorage unter den Schluesseln
 * am-video-tempo, am-video-qualitaet und am-video-untertitel.
 */

export const TEMPO_STUFEN = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const QUALITAET_STUFEN = ['Automatisch', '1080p', '720p', '480p', '240p'] as const;

export interface VideoEinstellungen {
  tempo: number;
  qualitaet: string;
  untertitel: boolean;
}

const STANDARD: VideoEinstellungen = { tempo: 1, qualitaet: 'Automatisch', untertitel: false };
const SPEICHER = 'all-media.videoEinstellungen';

/** "Normal" statt "1×" — so steht es auch bei YouTube. */
export const tempoText = (t: number) => (t === 1 ? 'Normal' : `${String(t).replace('.', ',')}×`);

export function useVideoEinstellungen() {
  const [werte, setWerte] = useState<VideoEinstellungen>(STANDARD);

  useEffect(() => {
    AsyncStorage.getItem(SPEICHER)
      .then((roh) => {
        if (!roh) return;
        const gelesen = JSON.parse(roh);
        // Bewusst nachsichtig: ein kaputter Eintrag darf den Player nicht
        // aufhalten, deshalb wird nur ergaenzt, was auch da ist.
        setWerte({ ...STANDARD, ...gelesen });
      })
      .catch(() => {
        /* Nichts gespeichert oder nicht lesbar: es gelten die Standardwerte. */
      });
  }, []);

  const setzen = useCallback((teil: Partial<VideoEinstellungen>) => {
    setWerte((vorher) => {
      const neu = { ...vorher, ...teil };
      AsyncStorage.setItem(SPEICHER, JSON.stringify(neu)).catch(() => {
        /* Speicher voll oder gesperrt — die Wahl gilt dann nur diese Sitzung. */
      });
      return neu;
    });
  }, []);

  return { werte, setzen };
}
