import React from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../constants/design';

/*
 * Die Beitragsglocke: an in Markenfarbe, aus mit rotem Strich.
 *
 * Henrik am 21.09.2026 (zum dritten Mal): der Strich der abgeschalteten
 * Glocke „ist nicht zentriert, läuft schräg aus der Glocke heraus und hat
 * dieselbe Farbe wie die Glocke".
 *
 * Vorher stand in Home und Kurzformat je ein 22 px breiter grauer Balken mit
 * -20° über einem 19 px großen Symbol. Drei Fehler auf einmal:
 *  - Ionicons ist ein Text; seine Höhe ist die Zeilenhöhe, nicht 19 px. Der
 *    Balken saß bei 50 % dieser Zeilenhöhe und damit zu tief.
 *  - 22 px sind breiter als die Glocke, der Balken ragte an beiden Seiten
 *    heraus.
 *  - Er war text2, genau wie die Glocke.
 *
 * Jetzt: ein festes Quadrat, das Symbol genau darin, der Strich 45° durch
 * die Mitte, so lang wie die Glocke breit ist, und in `danger`. Auf hellem
 * Grund trägt er einen Rand in der Hintergrundfarbe, damit er sich von den
 * Glockenlinien löst - dieselbe Zeichnung wie `ICONS.bellOff` auf der Website.
 */
export function Glocke({
  an,
  groesse = 19,
  farbeAus,
  grund,
}: {
  an: boolean;
  groesse?: number;
  /** Farbe der abgeschalteten Glocke; ohne Angabe text2. */
  farbeAus?: string;
  /** Hintergrund hinter der Glocke. Ohne Angabe (z. B. über einem Video) kein Rand. */
  grund?: string;
}) {
  const laenge = Math.round(groesse * 0.8);
  const strich = (dicke: number, farbe: string) => (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: (groesse - laenge) / 2,
        top: (groesse - dicke) / 2,
        width: laenge,
        height: dicke,
        borderRadius: dicke / 2,
        backgroundColor: farbe,
        transform: [{ rotate: '45deg' }],
      }}
    />
  );

  return (
    <View style={{ width: groesse, height: groesse }}>
      <Ionicons
        name="notifications"
        size={groesse}
        color={an ? colors.brand : farbeAus ?? colors.text2}
        style={{ width: groesse, height: groesse, lineHeight: groesse, textAlign: 'center' }}
      />
      {!an && grund && strich(5, grund)}
      {!an && strich(2, colors.danger)}
    </View>
  );
}
