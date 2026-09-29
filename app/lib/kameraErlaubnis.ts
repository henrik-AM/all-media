/**
 * Kamera, Mikrofon und Galerie erfragen — ein Weg für die ganze App (Kasten 11.7).
 *
 * WARUM ES DAS GIBT
 *
 * Henrik am 21.09.2026: „Kamerazugriff schlägt fehl beim Aufnehmen einer
 * Story. App-übergreifend beheben." Jede Stelle fragte selbst und endete
 * anders: die Kamera der App meldete nach dem ersten Erlauben „Die Kamera ist
 * noch nicht bereit" (die Vorschau entstand erst in diesem Moment), ein
 * einmal abgelehnter Zugriff ließ sich nicht wieder einschalten (der Knopf
 * „Kamera erlauben" fragte ins Leere — iOS fragt kein zweites Mal), und die
 * Galerie hatte in app.json gar keinen Erklärungstext.
 *
 * Jetzt: fragen, wenn noch gefragt werden darf; sonst sagen, wo es sich
 * einschalten lässt, mit einem Knopf direkt in die Einstellungen des Geräts.
 */
import { Alert, Linking } from 'react-native';

export type Zugriff = 'kamera' | 'mikrofon' | 'galerie';

export interface ErlaubnisStand {
  granted: boolean;
  canAskAgain: boolean;
}

const WOFUER: Record<Zugriff, string> = {
  kamera: 'die Kamera',
  mikrofon: 'das Mikrofon',
  galerie: 'deine Fotos',
};

/** Der Hinweis mit dem Weg in die Einstellungen — sichtbar, nicht nur ein Toast. */
export function zuDenEinstellungen(zugriff: Zugriff, wozu = 'dafür') {
  Alert.alert(
    `Kein Zugriff auf ${WOFUER[zugriff]}`,
    `All Media braucht ${WOFUER[zugriff]} ${wozu}. Du hast den Zugriff abgelehnt — einschalten lässt er sich nur in den Einstellungen des Geräts.`,
    [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Einstellungen öffnen', onPress: () => void Linking.openSettings() },
    ]
  );
}

/**
 * Erlaubnis sicherstellen. Gibt true zurück, wenn der Zugriff da ist.
 *
 * `stand` ist der bekannte Stand (aus dem Hook), `fragen` die Frage des
 * Systems. Ist die Frage verbraucht (canAskAgain false), zeigt sich der
 * Hinweis mit dem Einstellungsknopf.
 */
export async function erlaubnisSichern(
  zugriff: Zugriff,
  stand: ErlaubnisStand | null | undefined,
  fragen: () => Promise<ErlaubnisStand>,
  wozu?: string
): Promise<boolean> {
  if (stand?.granted) return true;
  if (stand && !stand.canAskAgain) {
    zuDenEinstellungen(zugriff, wozu);
    return false;
  }
  try {
    const neu = await fragen();
    if (neu.granted) return true;
    zuDenEinstellungen(zugriff, wozu);
    return false;
  } catch {
    zuDenEinstellungen(zugriff, wozu);
    return false;
  }
}
