/**
 * Die Tonmodi der App.
 *
 * WARUM ES DAS GIBT
 *
 * Henrik (Feedback 21.09., Kasten 8): „Ton richtet sich immer und
 * app-übergreifend nach der Lautstärkeeinstellung des Handys." Einen
 * Lautstärke-Knopf gibt es in keinem Beitrag mehr — also muss jeder Ton, den
 * die App macht, dieselbe Regel befolgen.
 *
 * Und Henrik am 01.10.2026 (Kasten 20.1): „Wenn das iPhone stumm geschaltet
 * ist, sollst du auch keine lauten Benachrichtigungen bekommen."
 *
 * Bis zum 01.10.2026 stellte diese Datei EINEN Modus für die ganze App her:
 * „Stummschalter egal". Folge: auch der Nachrichtenton klang bei
 * eingeschaltetem Stummschalter. Das war der Fehler aus Kasten 20.1.
 *
 * ZWEI MODI, JE NACHDEM WER SPIELT
 *
 *   tonModusSetzen()         Grundzustand. iOS-Kategorie „ambient": der
 *                            Stummschalter schaltet stumm, die Lautstärke des
 *                            Handys gilt, andere Apps (Musik) laufen weiter.
 *                            Gilt für den Nachrichtenton und jeden anderen
 *                            Hinweiston. Gesetzt beim App-Start, nach jeder
 *                            Push-to-Talk-Aufnahme und vor jedem Hinweiston.
 *
 *   wiedergabeModusSetzen()  Nur wenn jemand aktiv etwas abspielt, das er
 *                            hören WILL: die Song-Hörprobe im Explorer.
 *                            Kategorie „playback": klingt auch mit
 *                            Stummschalter — wie bei Instagram und TikTok, wo
 *                            ein angetipptes Video Ton hat.
 *
 * Videos (expo-video) brauchen keinen Aufruf: expo-video setzt die
 * Audiositzung bei jedem Start, Stopp und Stummschalten eines Spielers selbst
 * auf „playback" (VideoManager.setAudioSession in expo-video 57). Deshalb
 * reicht es NICHT, den Grundzustand einmal beim Start zu setzen — nach dem
 * ersten Video stünde die Sitzung wieder auf „playback". Darum setzt
 * `hinweistonModus()` den Grundzustand unmittelbar vor jedem Hinweiston neu.
 *
 * WAS, WENN GERADE EIN VIDEO MIT TON ODER DIE HÖRPROBE LÄUFT?
 *
 * Dann darf der Hinweiston die Sitzung nicht auf „ambient" umstellen — sonst
 * verstummte das laufende Video mitten im Ansehen, sobald der Stummschalter
 * an ist. Und in „playback" würde der Hinweiston den Stummschalter
 * übergehen. iOS verrät einer App nicht, ob der Stummschalter an ist. Also
 * schweigt der Hinweiston, solange etwas mit Ton läuft
 * (`aktiveWiedergabe`). Wer gerade ein Video mit Ton ansieht, hört den
 * kurzen Zweiklang ohnehin kaum.
 *
 * Eingehende Anrufe: die App spielt dabei keinen Klingelton (CallScreen
 * zeigt nur eine Animation). Gäbe es einen, gehörte er wie bei iOS zum
 * Grundzustand: auch ein Anruf klingelt bei Stummschalter nicht, er vibriert.
 *
 * WAS SICH NICHT IM SIMULATOR PRÜFEN LÄSST
 *
 * Der iOS-Simulator hat keinen Stummschalter. Ob der Nachrichtenton bei
 * eingeschaltetem Schalter wirklich schweigt und Video und Hörprobe trotzdem
 * klingen, zeigt nur ein echtes iPhone (Expo Go über `npm run wlan`). Im
 * Simulator prüfbar ist nur, dass alle drei überhaupt klingen.
 *
 * Auf der Website ändert sich nichts: Browser kennen keinen Stummschalter.
 */

import { setAudioModeAsync } from 'expo-audio';

/** Grundzustand: Stummschalter gilt (iOS „ambient"). */
export const tonModusSetzen = async (): Promise<void> => {
  try {
    await setAudioModeAsync({
      playsInSilentMode: false,
      allowsRecording: false,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'mixWithOthers',
    });
  } catch (e: any) {
    // Kein Ton ist ärgerlich, aber kein Grund, die App anzuhalten.
    console.warn('Tonmodus ließ sich nicht setzen:', e?.message ?? e);
  }
};

/**
 * Aktive Wiedergabe: klingt auch mit Stummschalter (iOS „playback").
 * Nur rufen, wenn der Nutzer selbst etwas zum Hören angetippt hat.
 * PushToTalk und die Kamera setzen allowsRecording; bleibt das stehen,
 * spielt iOS über die Hörmuschel, und es klingt wie „Play geht nicht" —
 * deshalb hier ausdrücklich false.
 */
export const wiedergabeModusSetzen = async (): Promise<void> => {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'mixWithOthers',
    });
  } catch (e: any) {
    console.warn('Wiedergabemodus ließ sich nicht setzen:', e?.message ?? e);
  }
};

/*
 * Was gerade mit Ton läuft — Videos mit Ton und die Hörprobe melden sich hier
 * an und ab. Ein Set statt eines Zählers: meldet sich derselbe Spieler
 * zweimal an, zählt er trotzdem einmal.
 */
const laufend = new Set<string>();

/** Ein Spieler meldet, ob er gerade hörbar spielt. */
export const aktiveWiedergabe = (schluessel: string, an: boolean) => {
  if (an) laufend.add(schluessel);
  else laufend.delete(schluessel);
};

/** Läuft gerade etwas mit Ton, das der Nutzer aktiv hört? */
export const wiedergabeLaeuft = () => laufend.size > 0;

/**
 * Vor jedem Hinweiston: Grundzustand neu setzen (ein Video kann die Sitzung
 * inzwischen auf „playback" gestellt haben). Gibt false zurück, wenn der Ton
 * schweigen soll, weil gerade etwas mit Ton läuft — siehe oben.
 */
export const hinweistonModus = async (): Promise<boolean> => {
  if (wiedergabeLaeuft()) return false;
  await tonModusSetzen();
  return true;
};
