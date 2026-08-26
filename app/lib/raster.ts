import { useWindowDimensions } from 'react-native';

/**
 * Höhe einer Kachel im Beitragsraster.
 *
 * An vier Stellen stand bisher `width: '33.333%'` zusammen mit
 * `aspectRatio: 1`. Gemeint waren quadratische Kacheln — herausgekommen sind
 * Kacheln im Verhältnis 2:1, also doppelt so breit wie hoch. Das galt für das
 * eigene Profil, das fremde Profil, den Explorer und die Videosuche, also für
 * jede Rasteransicht der App; auf der Website waren dieselben Kacheln
 * quadratisch.
 *
 * `aspectRatio` greift hier nicht zuverlässig, weil die Breite selbst erst aus
 * einem Prozentwert des Elternteils entsteht. Statt darauf zu bauen, wird die
 * Höhe aus der Fensterbreite gerechnet — ein Wert, der immer feststeht.
 *
 * Die Breite bleibt bei `33.333%`: so bleiben die drei Spalten exakt bündig,
 * auch wenn die Fensterbreite nicht durch drei teilbar ist.
 */
export function useKachelHoehe(spalten = 3): number {
  const { width } = useWindowDimensions();
  return Math.round(width / spalten);
}
