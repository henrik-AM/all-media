import * as ImagePicker from 'expo-image-picker';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ladeHoch, Ordner } from './supabaseStorage';

/**
 * Ein Foto für Profilbild oder Titelbild holen und hochladen
 * (Kasten 12.5 und 12.8).
 *
 * Eigener Helfer statt lib/aufnehmen.ts: dort wird frei zugeschnitten, ein
 * Profil- oder Titelbild ist aber ein Kreis — also quadratisch. Und
 * aufnehmen.ts gehört zur Kamera, an deren Berechtigungen Kasten 11.7
 * arbeitet; hier wird nur dieselbe Abfrage von expo-image-picker gestellt.
 *
 * Gibt die bestaendige Adresse (in die Datenbank) und die unterschriebene
 * (zum sofortigen Anzeigen) zurück — oder null bei Abbruch. Fehler gehen an
 * `fehler`, ein Abbruch ist keiner.
 */
export async function fotoHochladen(
  client: SupabaseClient | null,
  quelle: 'galerie' | 'kamera',
  ordner: Ordner,
  dateiname: string,
  fehler: (text: string) => void
): Promise<{ url: string; anzeige: string | null } | null> {
  let uri: string | null = null;
  try {
    const erlaubnis =
      quelle === 'kamera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!erlaubnis.granted) {
      fehler(quelle === 'kamera' ? 'Ohne Kamerazugriff geht das leider nicht' : 'Ohne Zugriff auf die Mediathek geht das leider nicht');
      return null;
    }
    const optionen: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    };
    const ergebnis =
      quelle === 'kamera'
        ? await ImagePicker.launchCameraAsync(optionen)
        : await ImagePicker.launchImageLibraryAsync(optionen);
    if (ergebnis.canceled || !ergebnis.assets.length) return null;
    uri = ergebnis.assets[0].uri;
  } catch {
    fehler(quelle === 'kamera' ? 'Zugriff auf die Kamera nicht möglich' : 'Zugriff auf die Mediathek nicht möglich');
    return null;
  }

  const hoch = await ladeHoch(client, uri, ordner, dateiname);
  if (!hoch.success || !hoch.url) {
    fehler(hoch.error ?? 'Das Bild ließ sich nicht hochladen');
    return null;
  }
  return { url: hoch.url, anzeige: hoch.anzeige };
}
