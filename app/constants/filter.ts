/**
 * Die Kamerafilter.
 *
 * WARUM ES DAS GIBT
 *
 * Im Handbuch ist der Filter der Grund, warum Snapchat überhaupt in der
 * Liste der Plattformen steht („Snapchat zur Anwendung von Filtern"). In der
 * App gab es bis zum 01.09.2026 keinen einzigen: die Kamera nahm auf und
 * legte die Aufnahme ab, fertig.
 *
 * WIE SIE GEBAUT SIND — und was sie nicht sind
 *
 * React Native kennt keine Bildfilter wie der Browser. Ein echter Filter
 * bräuchte eine Bibliothek, die auf der Grafikeinheit rechnet, und die läuft
 * in Expo Go nicht ohne eigenen Entwicklungsbau — dieselbe Falle wie bei
 * react-native-maps.
 *
 * Deshalb sind die Filter hier Farbschichten über dem Bild: eine getönte
 * Fläche in einer bestimmten Deckkraft, bei manchen zusätzlich eine zweite
 * für die Ecken. Das ist weniger als eine Kurvenkorrektur, aber es ist
 * ehrlich sichtbar und auf beiden Seiten gleich — die Website legt dieselben
 * Werte als CSS-Verlauf darüber (siehe FILTER in web/public/app.js).
 *
 * Der gewählte Name wird am Insight gespeichert (`insights.filter`), damit
 * die Aufnahme beim Ansehen genauso aussieht wie beim Verschicken.
 */

export interface Filter {
  key: string;
  /** Was in der Leiste unter dem Sucher steht. */
  label: string;
  /** Farbschicht über dem ganzen Bild. Leer heißt: keine. */
  ton: string;
  /** Deckkraft der Farbschicht, 0 bis 1. */
  staerke: number;
  /**
   * Abdunkelung zu den Rändern hin. Ohne sie wirken warme Filter flach,
   * weil nur die Farbe kippt und die Bildtiefe gleich bleibt.
   */
  ecken?: number;
}

export const FILTER: Filter[] = [
  { key: 'keiner', label: 'Ohne', ton: '', staerke: 0 },
  { key: 'warm', label: 'Warm', ton: '#FF9A3C', staerke: 0.22, ecken: 0.18 },
  { key: 'kalt', label: 'Kühl', ton: '#3C7DFF', staerke: 0.2, ecken: 0.14 },
  { key: 'sw', label: 'S/W', ton: '#6E6E73', staerke: 0.55 },
  { key: 'sepia', label: 'Sepia', ton: '#A9743A', staerke: 0.35, ecken: 0.2 },
  { key: 'kino', label: 'Kino', ton: '#0E2B4A', staerke: 0.26, ecken: 0.34 },
  { key: 'sonne', label: 'Sonne', ton: '#FFD166', staerke: 0.24 },
  { key: 'nacht', label: 'Nacht', ton: '#101033', staerke: 0.4, ecken: 0.3 },
];

/** Den Filter zu einem gespeicherten Namen finden — unbekannt heißt „Ohne". */
export const filterZu = (key?: string | null): Filter =>
  FILTER.find((f) => f.key === key) ?? FILTER[0];
