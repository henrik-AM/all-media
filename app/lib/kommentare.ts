import { compactNumber } from './zahlen';

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

/*
 * Dasselbe fuer die Zeile ueber der Beschreibung. Sie stand fest als
 * "Gefaellt <Name> und N weiteren Personen" - bei einem frischen Beitrag las
 * sich das als "Gefaellt und 0 weiteren Personen": kein Name, eine Null, und
 * ein Satz, der nicht aufgeht.
 *
 * Ein leerer Rueckgabewert heisst: die Zeile faellt weg. Bei null Likes ist
 * das kein Mangel, sondern der uebliche Zustand eines gerade
 * veroeffentlichten Beitrags.
 *
 * Dieselbe Regel gilt in der Website (likeZeile in web/public/app.js).
 */
export function likeZeile(anzahl: number, ersterName?: string): string {
  if (!anzahl) return '';
  if (!ersterName) return anzahl === 1 ? '1 Like' : `${compactNumber(anzahl)} Likes`;
  if (anzahl === 1) return `Gefällt ${ersterName}`;
  if (anzahl === 2) return `Gefällt ${ersterName} und einer weiteren Person`;
  return `Gefällt ${ersterName} und ${compactNumber(anzahl - 1)} weiteren Personen`;
}

/*
 * Kasten 9.3 (Henrik, 21.09.2026): „Wer freigegeben ist, sieht unter einem
 * Video wie bei Instagram, dass die Person es geliked hat.“
 *
 * Unter einem Video steht die Zahl schon an der Seitenleiste. Die Zeile
 * darunter gibt es deshalb NUR mit Namen — ohne Namen fällt sie weg, statt
 * die Zahl ein zweites Mal zu zeigen. Der Name kommt aus `liker_namen()`
 * (Schema 65): nur jemand, dem ich folge, und nur, wenn dessen
 * Likes-Sichtbarkeit mich zulässt. Hier wird nichts erfunden.
 *
 * Zurückgegeben wird der Teil NACH dem Namen, damit der Name fett gesetzt
 * werden kann: „Gefällt <b>Anna</b>“ + „ und 14 weiteren Personen“.
 * Dieselbe Regel in der Website (gefaelltZeile in web/public/app.js).
 */
export function gefaelltRest(anzahl: number): string {
  if (anzahl <= 1) return '';
  if (anzahl === 2) return ' und einer weiteren Person';
  return ` und ${compactNumber(anzahl - 1)} weiteren Personen`;
}
