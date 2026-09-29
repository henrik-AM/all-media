import * as ImagePicker from 'expo-image-picker';
import { erlaubnisSichern } from './kameraErlaubnis';

/**
 * Kamera oeffnen und die Aufnahme zurueckgeben - oder null, wenn abgebrochen
 * wurde oder die Kamera nicht darf.
 *
 * `fehler` wird nur gerufen, wenn wirklich etwas schiefging. Ein Abbruch ist
 * kein Fehler und soll auch keine Meldung ausloesen.
 */
export async function aufnehmen(
  art: 'photo' | 'video',
  fehler?: (text: string) => void
): Promise<string | null> {
  try {
    // Kasten 11.7: abgelehnt heißt jetzt Hinweis mit Weg in die Einstellungen.
    const stand = await ImagePicker.getCameraPermissionsAsync();
    if (!(await erlaubnisSichern('kamera', stand, ImagePicker.requestCameraPermissionsAsync, 'für die Aufnahme'))) {
      fehler?.('Ohne Kamerazugriff geht das leider nicht');
      return null;
    }

    const ergebnis = await ImagePicker.launchCameraAsync({
      mediaTypes: art === 'photo' ? ['images'] : ['videos'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (ergebnis.canceled || !ergebnis.assets.length) return null;
    return ergebnis.assets[0].uri;
  } catch {
    fehler?.('Zugriff auf die Kamera nicht möglich');
    return null;
  }
}

/** Dasselbe aus der Galerie - fuer den Galerie-Knopf in der Kamera. */
export async function ausGalerie(
  art: 'photo' | 'video',
  fehler?: (text: string) => void
): Promise<string | null> {
  try {
    const stand = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!(await erlaubnisSichern('galerie', stand, () => ImagePicker.requestMediaLibraryPermissionsAsync(), 'für die Auswahl aus der Galerie'))) {
      fehler?.('Ohne Zugriff auf die Galerie geht das leider nicht');
      return null;
    }

    const ergebnis = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: art === 'photo' ? ['images'] : ['videos'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (ergebnis.canceled || !ergebnis.assets.length) return null;
    return ergebnis.assets[0].uri;
  } catch {
    fehler?.('Zugriff auf die Galerie nicht möglich');
    return null;
  }
}
