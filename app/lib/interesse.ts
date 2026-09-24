/**
 * Reihenfolge fuer Vorschauen in der Suche.
 *
 * Henrik am 21.09.2026: "Vorschau kuerzen: je Kategorie etwa fuenf
 * Eintraege, ausgesucht nach Interesse. Die volle Auswahl kommt erst hinter
 * der Ueberschrift mit Pfeil." Vorher stand in der Vorschau alles, was die
 * Suche fand - die Seite war endlos und die Ueberschriften ueberfluessig.
 *
 * Interesse heisst hier: zuerst, was von Leuten kommt, denen man folgt, dann
 * was die meisten Reaktionen hat. Die Website rechnet in `nachInteresse`
 * (web/public/app.js) dasselbe.
 */
export const VORSCHAU = 5;

export const nachInteresse = <T>(
  liste: T[],
  beliebtheit: (e: T) => number,
  vonGefolgten: (e: T) => boolean = () => false
): T[] =>
  [...liste].sort(
    (a, b) =>
      Number(vonGefolgten(b)) - Number(vonGefolgten(a)) || (beliebtheit(b) || 0) - (beliebtheit(a) || 0)
  );
