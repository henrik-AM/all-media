/**
 * Ein Tonmodus für die ganze App.
 *
 * WARUM ES DAS GIBT
 *
 * Henrik (Feedback 21.09., Kasten 8): „Ton richtet sich immer und
 * app-übergreifend nach der Lautstärkeeinstellung des Handys." Einen
 * Lautstärke-Knopf gibt es in keinem Beitrag mehr — also muss jeder Ton, den
 * die App macht, dieselbe Regel befolgen.
 *
 * Videos (expo-video) setzen die iOS-Audiositzung beim Abspielen selbst auf
 * „playback": sie laufen auch bei eingeschaltetem Stummschalter und folgen den
 * Lautstärketasten. expo-audio dagegen setzt beim Start gar nichts — iOS lässt
 * die Sitzung dann auf „soloAmbient", und die schaltet der Stummschalter stumm.
 * Die Song-Hörprobe im Explorer und der Nachrichtenton waren darum nur dann zu
 * hören, wenn vorher zufällig ein Video lief. Und Push-to-Talk ließ die Sitzung
 * nach der Aufnahme auf „Aufnehmen" stehen (leiser Hörer statt Lautsprecher).
 *
 * Diese Funktion stellt den einen Wiedergabemodus her: Stummschalter egal,
 * Lautstärke des Handys gilt, keine Aufnahme, andere Apps (Musik) laufen weiter.
 * Aufgerufen beim App-Start und nach jeder Push-to-Talk-Aufnahme.
 *
 * Folge, ehrlich benannt: auch der Nachrichtenton klingt bei eingeschaltetem
 * Stummschalter. Wer ihn nicht will, schaltet in den Einstellungen „Töne" aus.
 */

import { setAudioModeAsync } from 'expo-audio';

export const tonModusSetzen = async (): Promise<void> => {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
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
