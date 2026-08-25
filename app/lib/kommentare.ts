/*
 * Der Satz unter einem Beitrag richtet sich nach der Zahl der Kommentare.
 *
 * Henrik hatte gemeldet: "Kommentaranzahl korrigieren: Wenn nur 4 Kommentare
 * vorhanden sind, darf nicht 'Alle 28 Kommentare ansehen' stehen."
 *
 * Zwei Dinge waren daran falsch. Die Zahl kam aus einem eigenen Feld am
 * Beitrag, das mit der echten Liste auseinandergelaufen war - das ist in
 * der Datenquelle behoben. Und "Alle 3 ... ansehen" klingt auch dann falsch,
 * wenn die Zahl stimmt: bei drei Kommentaren gibt es kein "alle", die passen
 * ohnehin ins Bild.
 *
 * Dieselbe Regel gilt in der Website (kommentarZeile in web/public/app.js).
 */
export function kommentarZeile(anzahl: number): string {
  if (!anzahl) return 'Kommentar schreiben';
  if (anzahl === 1) return '1 Kommentar ansehen';
  if (anzahl <= 3) return `${anzahl} Kommentare ansehen`;
  return `Alle ${anzahl} Kommentare ansehen`;
}
