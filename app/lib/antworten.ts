// Antworten der Demo-Kontakte.
//
// Vorher kam auf jede Nachricht ein zufaelliger Satz aus einer festen Liste -
// das wirkte tot. Jetzt richtet sich die Antwort nach dem, was geschrieben
// wurde: Begruessung, Frage, Terminwunsch, Dank und so weiter.
//
// Das ist bewusst eine einfache Regelmaschine ohne Sprachmodell: sie laeuft
// sofort, braucht kein Netz und keinen Schluessel. Fuer eine Demo reicht das.

interface Regel {
  /** Woran die Regel erkannt wird. */
  passt: (text: string) => boolean;
  /** Moegliche Antworten - eine davon wird genommen. */
  antworten: (name: string) => string[];
}

const enthaelt = (text: string, ...woerter: string[]) =>
  woerter.some((w) => text.includes(w));

/** Vorname reicht fuer die Ansprache. */
const vorname = (name: string) => name.split(' ')[0];

// Reihenfolge ist Absicht: die erste passende Regel gewinnt, deshalb stehen
// die eindeutigen Faelle oben und die allgemeinen unten.
const REGELN: Regel[] = [
  {
    passt: (t) => enthaelt(t, 'guten morgen', 'moin'),
    antworten: () => ['Guten Morgen!', 'Morgen! Schon wach?', 'Moin!'],
  },
  {
    passt: (t) => enthaelt(t, 'guten abend', 'gute nacht', 'schlaf gut'),
    antworten: () => ['Dir auch einen schönen Abend!', 'Gute Nacht!', 'Schlaf gut!'],
  },
  {
    passt: (t) => enthaelt(t, 'hallo', 'hi ', 'hey', 'servus', 'grüß dich') || t === 'hi',
    antworten: () => ['Hey! Alles gut bei dir?', 'Hallo! Schön von dir zu hören.', 'Hi! Was gibt es?'],
  },
  {
    passt: (t) => enthaelt(t, 'wie geht', "wie gehts", 'wie läuft', 'alles gut', 'alles klar bei dir'),
    antworten: () => [
      'Ganz gut soweit, danke! Und bei dir?',
      'Alles bestens hier. Wie sieht es bei dir aus?',
      'Läuft! Bei dir auch alles gut?',
    ],
  },
  {
    passt: (t) => enthaelt(t, 'danke', 'dankeschön', 'merci'),
    antworten: () => ['Gerne!', 'Kein Ding.', 'Immer wieder gern.'],
  },
  {
    passt: (t) => enthaelt(t, 'sorry', 'entschuldig', 'tut mir leid'),
    antworten: () => ['Kein Problem!', 'Alles gut, wirklich.', 'Passt schon.'],
  },
  {
    passt: (t) => enthaelt(t, 'tschüss', 'ciao', 'bis später', 'bis dann', 'bis morgen', 'mach es gut'),
    antworten: () => ['Bis später!', 'Ciao, bis dann!', 'Mach es gut!'],
  },
  {
    passt: (t) => enthaelt(t, 'wann', 'uhrzeit', 'termin', 'treffen', 'zeit hast', 'zeit für'),
    antworten: () => [
      'Mir würde es ab 17 Uhr passen. Geht das bei dir?',
      'Morgen Nachmittag wäre gut. Was meinst du?',
      'Sag du, wann es dir passt - ich bin flexibel.',
    ],
  },
  {
    passt: (t) => enthaelt(t, 'wo ', 'wohin', 'adresse', 'treffpunkt') || t.startsWith('wo'),
    antworten: () => [
      'Am besten wie immer beim Café am Markt?',
      'Ich komme zu dir, das ist einfacher.',
      'Such du den Ort aus, mir ist es recht.',
    ],
  },
  {
    passt: (t) => enthaelt(t, 'foto', 'bild', 'video', 'schick mir', 'schickst du'),
    antworten: () => [
      'Klar, schicke ich dir gleich rüber.',
      'Moment, ich suche es raus.',
      'Habe ich - kommt sofort.',
    ],
  },
  {
    passt: (t) => enthaelt(t, 'kannst du', 'könntest du', 'machst du', 'würdest du'),
    antworten: () => [
      'Klar, mache ich.',
      'Ja, das kriege ich hin.',
      'Sollte gehen - ich melde mich, wenn es fertig ist.',
    ],
  },
  {
    passt: (t) => enthaelt(t, 'hilfe', 'problem', 'funktioniert nicht', 'geht nicht', 'kaputt'),
    antworten: () => [
      'Oh, was genau klappt denn nicht?',
      'Erzähl mal, vielleicht kann ich helfen.',
      'Ärgerlich! Schick mir mal einen Screenshot.',
    ],
  },
  {
    passt: (t) => enthaelt(t, 'glückwunsch', 'gratuliere', 'geburtstag'),
    antworten: () => ['Danke dir!', 'Oh, lieb von dir!', 'Das freut mich sehr!'],
  },
  {
    passt: (t) => ['ja', 'jo', 'jep', 'okay', 'ok', 'passt', 'gut', 'alles klar'].includes(t.trim()),
    antworten: () => ['Super!', 'Perfekt.', 'Dann machen wir das so.'],
  },
  {
    passt: (t) => ['nein', 'ne', 'nö', 'leider nicht'].includes(t.trim()),
    antworten: () => ['Schade, dann eben ein andermal.', 'Alles gut, kein Stress.', 'Okay, verstehe.'],
  },
  {
    // Jede uebrige Frage.
    passt: (t) => t.includes('?'),
    antworten: () => [
      'Gute Frage - lass mich kurz überlegen.',
      'Hm, da bin ich mir nicht ganz sicher. Was denkst du?',
      'Da muss ich nochmal drüber nachdenken.',
    ],
  },
];

const AUFFANG = (name: string) => [
  'Verstehe!',
  'Okay, danke für die Info.',
  'Alles klar, notiert.',
  `Sehe ich genauso, ${vorname(name)} hier meldet sich gleich nochmal.`,
];

/**
 * Passende Antwort auf eine Nachricht.
 *
 * @param nachricht Was der Nutzer geschrieben hat
 * @param name      Name des antwortenden Kontakts
 */
export const antwortAuf = (nachricht: string, name = ''): string => {
  const text = nachricht.toLowerCase().trim();

  const regel = REGELN.find((r) => r.passt(text));
  const moeglich = regel ? regel.antworten(name) : AUFFANG(name);

  return moeglich[Math.floor(Math.random() * moeglich.length)];
};
