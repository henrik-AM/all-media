import { Linking } from 'react-native';

/*
 * Oeffnet einen Link aus einer Profilbeschreibung.
 *
 * Henrik: "Links in Profilbeschreibungen muessen anklickbar sein." Vorher
 * wurde die Adresse nur als Hinweis eingeblendet.
 *
 * Ohne Schema kann das Betriebssystem mit der Adresse nichts anfangen -
 * "all-media.app" ist fuer Linking keine gueltige URL. Deshalb wird https://
 * ergaenzt, wo es fehlt.
 *
 * Dieselbe Regel gilt in der Website (bioLink in web/public/app.js).
 */
export async function oeffneLink(adresse: string, onNotice: (text: string) => void) {
  const sauber = (adresse || '').trim();
  if (!sauber) return;

  const ziel = /^https?:\/\//i.test(sauber) ? sauber : `https://${sauber}`;

  try {
    const geht = await Linking.canOpenURL(ziel);
    if (!geht) return onNotice(`Diese Adresse lässt sich nicht öffnen: ${sauber}`);
    await Linking.openURL(ziel);
  } catch {
    onNotice(`Diese Adresse lässt sich nicht öffnen: ${sauber}`);
  }
}
