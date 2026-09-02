/**
 * Push-to-Talk in einer Community.
 *
 * WARUM ES DAS GIBT
 *
 * Im Handbuch ist Push-to-Talk eine Funktion: „Push-to-Talk Nachricht an
 * Profile, die der Community beigetreten sind (bei Gruppenanrufen +
 * außergewöhnlich hoher Aktivität in der Community)". In App und Website gab
 * es bis zum 01.09.2026 nur einen Ein/Aus-Schalter in den Einstellungen —
 * geschickt wurde damit nie etwas.
 *
 * WARUM GEDRÜCKT HALTEN UND NICHT ZWEIMAL TIPPEN
 *
 * Push-to-Talk heißt gedrückt halten. Das ist nicht nur der Name: eine
 * Aufnahme, die nach dem ersten Tippen weiterläuft, läuft irgendwann in der
 * Hosentasche weiter. Loslassen beendet sie, und wer kürzer als eine Sekunde
 * hält, hat sich nur verdrückt — dann wird nichts geschickt.
 */

import React, { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
} from 'expo-audio';
import { Druck } from './Druck';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';
import { haptic } from '../lib/haptics';
import { useAktionen } from '../lib/useAktionen';

interface Props {
  communityId: string;
  /** Unterthema, falls die Nachricht nur dorthin gehen soll. */
  kanalId?: string | null;
  onNotice: (text: string) => void;
  /** Nach dem Senden, damit die Liste sich neu holt. */
  onGesendet?: () => void;
}

/** Kürzer als das ist ein Verdrücker, keine Nachricht. */
const MINDESTDAUER_MS = 800;

export const PushToTalk = ({ communityId, kanalId, onNotice, onGesendet }: Props) => {
  const aktionen = useAktionen(onNotice);
  const aufnahme = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [laeuft, setLaeuft] = useState(false);
  const [sekunden, setSekunden] = useState(0);
  const beginn = useRef(0);
  const uhr = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = async () => {
    try {
      const erlaubnis = await requestRecordingPermissionsAsync();
      if (!erlaubnis.granted) return onNotice('Ohne Mikrofonzugriff geht das nicht');

      // Ohne diesen Schritt nimmt iOS im Stummschaltmodus nichts auf — und
      // das fällt erst auf, wenn eine leere Datei ankommt.
      await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

      await aufnahme.prepareToRecordAsync();
      aufnahme.record();

      beginn.current = Date.now();
      setLaeuft(true);
      setSekunden(0);
      haptic.impact('medium');
      uhr.current = setInterval(
        () => setSekunden(Math.floor((Date.now() - beginn.current) / 1000)),
        250
      );
    } catch (e: any) {
      console.error('Push-to-Talk starten fehlgeschlagen:', e?.message ?? e);
      onNotice('Die Aufnahme ließ sich nicht starten');
    }
  };

  const stop = async () => {
    if (!laeuft) return;
    setLaeuft(false);
    if (uhr.current) clearInterval(uhr.current);

    const dauerMs = Date.now() - beginn.current;

    try {
      await aufnahme.stop();
      const uri = aufnahme.uri;

      if (dauerMs < MINDESTDAUER_MS) return onNotice('Zu kurz — halte den Knopf gedrückt');
      if (!uri) return onNotice('Die Aufnahme ist leer geblieben');

      const id = await aktionen.pttSenden(
        communityId,
        uri,
        Math.round(dauerMs / 1000),
        kanalId ?? null
      );
      if (id) {
        haptic.success();
        onNotice('Push-to-Talk gesendet');
        onGesendet?.();
      }
    } catch (e: any) {
      console.error('Push-to-Talk senden fehlgeschlagen:', e?.message ?? e);
      onNotice('Die Aufnahme ging nicht raus');
    }
  };

  return (
    <View style={styles.zeile}>
      <Druck
        style={[styles.knopf, laeuft && styles.knopfAn]}
        onPressIn={start}
        onPressOut={stop}
        // Der Knopf reagiert auf Drücken und Loslassen, nicht auf einen
        // abgeschlossenen Tipp — deshalb hier kein onPress.
        delayLongPress={100}
      >
        <Ionicons name="mic" size={19} color={colors.white} />
        <Text style={styles.knopfText}>
          {laeuft ? `Aufnahme … ${sekunden}s` : 'Push-to-Talk'}
        </Text>
      </Druck>
      {!laeuft && <Text style={styles.hinweis}>gedrückt halten</Text>}
    </View>
  );
};

const styles = themenStyles((colors) => ({
  zeile: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  knopf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  knopfAn: { backgroundColor: colors.danger },
  knopfText: { ...typography.name, color: colors.white },
  hinweis: { ...typography.tiny, color: colors.text3 },
}));
