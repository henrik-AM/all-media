/**
 * Ort · Sound unter dem Profilnamen — beides antippbar.
 *
 * Henrik (Feedback 21.09., Kasten 8.2): „Ort und Sound/Song unter dem
 * Profilnamen sind nicht antippbar." Im Home-Feed und im Kurzformat waren sie
 * es schon, im Querformat-Player (und damit auch bei Live) standen sie gar
 * nicht da, obwohl jeder Clip `location` und `music` mitbringt. Im
 * Figma-Prototyp steht unter dem Namen „Standort • Musik" (Komponente
 * „B. Beitragsprofil").
 *
 * Tippen auf den Ort öffnet die Standortseite, auf den Sound die Soundseite —
 * dieselbe Regel wie im Home-Feed (lib/ziele.ts). Gibt es keine Seite
 * („Originalton"), sagt ein Hinweis das statt still nichts zu tun.
 * Gegenstück auf der Website: `.player__ziele` in web/public/app.js.
 */

import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Druck } from './Druck';
import { useZielOeffnen } from '../lib/ziele';
import type { ExplorerZiel } from '../screens/videos/ExplorerScreen';

interface Props {
  ort?: string | null;
  sound?: string | null;
  onOpenExplorer?: (ziel: ExplorerZiel) => void;
  onNotice: (message: string) => void;
  /** Schrift der Zeile, damit sie zur Umgebung passt. */
  stil?: StyleProp<TextStyle>;
  /** Farbe der kleinen Symbole. */
  farbe?: string;
}

export const OrtSoundZeile = ({ ort, sound, onOpenExplorer, onNotice, stil, farbe }: Props) => {
  const ziel = useZielOeffnen(onOpenExplorer, onNotice);
  if (!ort && !sound) return null;

  return (
    <View style={styles.zeile}>
      {!!ort && (
        <Druck
          style={styles.teil}
          onPress={() => ziel.ort(ort)}
          hitSlop={6}
          accessibilityRole="link"
          accessibilityLabel={`Standort ${ort}`}
        >
          <Ionicons name="location-outline" size={12} color={farbe} />
          <Text style={stil} numberOfLines={1}>
            {ort}
          </Text>
        </Druck>
      )}
      {!!ort && !!sound && <Text style={stil}> · </Text>}
      {!!sound && (
        <Druck
          style={[styles.teil, styles.sound]}
          onPress={() => ziel.sound(sound)}
          hitSlop={6}
          accessibilityRole="link"
          accessibilityLabel={`Sound ${sound}`}
        >
          <Ionicons name="musical-notes-outline" size={12} color={farbe} />
          <Text style={stil} numberOfLines={1}>
            {sound}
          </Text>
        </Druck>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  zeile: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  teil: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  sound: { flexShrink: 2 },
});
