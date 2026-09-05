/**
 * Wo die Anmeldung der App liegt.
 *
 * Sicherheitspruefung 04.09.2026 (Fund 12).
 *
 * Bis heute lag das Sitzungstoken in `AsyncStorage`. Das ist auf dem Geraet
 * eine gewoehnliche, unverschluesselte Datei im App-Verzeichnis: auf einem
 * Geraet mit Root oder Jailbreak und in einem unverschluesselten Backup steht
 * sie offen. Wer sie liest, ist angemeldet — und konnte, solange
 * `security_update_password_require_reauthentication` aus war, damit auch
 * gleich das Passwort neu setzen. Beides ist jetzt zu.
 *
 * Richtig ist `expo-secure-store`: iOS legt den Wert in den Schluesselbund,
 * Android in den Keystore.
 *
 * DIE ZWEITAUSEND-ZEICHEN-FALLE
 *
 * SecureStore nimmt je Schluessel hoechstens 2048 Byte. Eine Supabase-Sitzung
 * ist mit Zugangs- und Erneuerungstoken regelmaessig groesser. Ein naiver
 * Umstieg schreibt die Sitzung also scheinbar weg, bekommt eine Warnung, die
 * niemand liest, und der Nutzer ist beim naechsten Start abgemeldet.
 *
 * Deshalb wird der Wert in Stuecke zerlegt. Unter dem eigentlichen Schluessel
 * steht nur, aus wie vielen Stuecken er besteht; die Stuecke selbst liegen
 * daneben unter `<schluessel>.0`, `.1` und so fort.
 *
 * IM BROWSER
 *
 * Die Expo-Fassung laeuft auch im Web, und dort gibt es keinen Schluesselbund.
 * `SecureStore.isAvailableAsync()` sagt das, und dann uebernimmt localStorage
 * — dasselbe, was supabase-js im Browser von sich aus benutzt.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Groesse eines Stuecks. Unter der Grenze von 2048 Byte, mit Luft nach oben. */
const STUECK = 1800;

let sicherVerfuegbar: boolean | null = null;

async function verfuegbar(): Promise<boolean> {
  if (sicherVerfuegbar === null) {
    try {
      sicherVerfuegbar = await SecureStore.isAvailableAsync();
    } catch {
      sicherVerfuegbar = false;
    }
  }
  return sicherVerfuegbar;
}

/*
 * SecureStore erlaubt in Schluesselnamen nur Buchstaben, Ziffern, Punkt,
 * Bindestrich und Unterstrich. Die Schluessel von supabase-js enthalten
 * andere Zeichen (etwa `sb-<projekt>-auth-token`), deshalb werden sie
 * vereinheitlicht.
 */
function saeubere(schluessel: string): string {
  return schluessel.replace(/[^A-Za-z0-9._-]/g, '_');
}

async function alleStueckeLoeschen(basis: string, anzahl: number) {
  for (let i = 0; i < anzahl; i += 1) {
    try {
      await SecureStore.deleteItemAsync(`${basis}.${i}`);
    } catch {
      // Ein fehlendes Stueck ist kein Fehler — es soll ja weg.
    }
  }
}

/**
 * Was vor dem Umzug schon dalag, uebernehmen.
 *
 * Nachgetragen am 04.09.2026. Der Umzug in den Schluesselbund hatte eine
 * Folge, die niemand wollte: die Sitzung JEDER bestehenden Installation liegt
 * in AsyncStorage, und der Schluesselbund ist beim ersten Start danach leer.
 * Ohne diesen Schritt haette das Update alle Nutzer abgemeldet — und weil
 * "nicht angemeldet" wie ein normaler erster Start aussieht, waere es nur an
 * den Beschwerden aufgefallen.
 *
 * Der alte Wert wird nach dem Uebernehmen geloescht: er ist genau die
 * unverschluesselte Datei, wegen der der Umzug stattgefunden hat. Ihn stehen
 * zu lassen hiesse, die Luecke fuer alle Bestandsgeraete offen zu halten.
 *
 * Nebenbei arbeitet damit auch `tools/app-anmelden.js` wieder: es schreibt
 * die Sitzung von aussen in AsyncStorage, weil sich der Schluesselbund des
 * Simulators nicht von aussen beschreiben laesst.
 */
async function ausAltemSpeicher(schluessel: string, basis: string): Promise<string | null> {
  let alt: string | null = null;
  try {
    alt = await AsyncStorage.getItem(schluessel);
  } catch {
    return null;
  }
  if (alt === null) return null;

  // Erst sicher ablegen, dann die alte Fassung entfernen — in dieser
  // Reihenfolge. Scheitert das Schreiben, ist die Sitzung wenigstens nicht
  // verloren.
  try {
    const anzahl = Math.max(1, Math.ceil(alt.length / STUECK));
    for (let i = 0; i < anzahl; i += 1) {
      await SecureStore.setItemAsync(`${basis}.${i}`, alt.slice(i * STUECK, (i + 1) * STUECK));
    }
    await SecureStore.setItemAsync(basis, String(anzahl));
    await AsyncStorage.removeItem(schluessel);
  } catch (fehler: any) {
    console.error('Sitzung uebernehmen fehlgeschlagen:', fehler?.message ?? fehler);
  }
  return alt;
}

export const sitzungsspeicher = {
  async getItem(schluessel: string): Promise<string | null> {
    if (!(await verfuegbar())) return AsyncStorage.getItem(schluessel);

    const basis = saeubere(schluessel);
    try {
      const kopf = await SecureStore.getItemAsync(basis);
      if (kopf === null) return ausAltemSpeicher(schluessel, basis);

      const anzahl = Number(kopf);
      // Alte Eintraege ohne Stueckelung: der Wert steht direkt drin.
      if (!Number.isInteger(anzahl) || anzahl < 1) return kopf;

      const teile: string[] = [];
      for (let i = 0; i < anzahl; i += 1) {
        const teil = await SecureStore.getItemAsync(`${basis}.${i}`);
        // Ein fehlendes Stueck macht den ganzen Wert unbrauchbar. Dann lieber
        // "nicht angemeldet" melden als eine halbe Sitzung zurueckgeben.
        if (teil === null) return null;
        teile.push(teil);
      }
      return teile.join('');
    } catch (fehler: any) {
      console.error('Sitzung lesen fehlgeschlagen:', fehler?.message ?? fehler);
      return null;
    }
  },

  async setItem(schluessel: string, wert: string): Promise<void> {
    if (!(await verfuegbar())) return AsyncStorage.setItem(schluessel, wert);

    const basis = saeubere(schluessel);
    try {
      // Was vorher dalag, kann mehr Stuecke gehabt haben als das Neue.
      const vorher = Number((await SecureStore.getItemAsync(basis)) ?? 0);
      if (Number.isInteger(vorher) && vorher > 0) await alleStueckeLoeschen(basis, vorher);

      const anzahl = Math.max(1, Math.ceil(wert.length / STUECK));
      for (let i = 0; i < anzahl; i += 1) {
        await SecureStore.setItemAsync(`${basis}.${i}`, wert.slice(i * STUECK, (i + 1) * STUECK));
      }
      await SecureStore.setItemAsync(basis, String(anzahl));
    } catch (fehler: any) {
      // Sichtbar machen, nicht verschlucken: eine nicht gespeicherte Sitzung
      // heisst, dass der naechste Start wieder bei der Anmeldung steht.
      console.error('Sitzung speichern fehlgeschlagen:', fehler?.message ?? fehler);
    }
  },

  async removeItem(schluessel: string): Promise<void> {
    if (!(await verfuegbar())) return AsyncStorage.removeItem(schluessel);

    const basis = saeubere(schluessel);
    try {
      const anzahl = Number((await SecureStore.getItemAsync(basis)) ?? 0);
      if (Number.isInteger(anzahl) && anzahl > 0) await alleStueckeLoeschen(basis, anzahl);
      await SecureStore.deleteItemAsync(basis);
    } catch (fehler: any) {
      console.error('Sitzung loeschen fehlgeschlagen:', fehler?.message ?? fehler);
    }
  },
};
