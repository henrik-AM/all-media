import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { avatarPair, colors, initialsOf, themenStyles } from '../constants/design';
import { useDaten } from '../contexts/DatenContext';

interface Props {
  id: string;
  name: string;
  size?: number;
  group?: boolean;
  /** Grüner Punkt unten rechts. */
  online?: boolean;
  /**
   * Farbe aus der Datenbank. Normalerweise nicht nötig — der Avatar schlägt
   * sie selbst an der Kennung nach. Nur angeben, wo die Person nicht in der
   * geladenen Liste steht.
   */
  farbe?: string;
  /**
   * Eckenrundung. Ohne Angabe ein Kreis. Communitys werden als abgerundetes
   * Quadrat gezeichnet — das unterscheidet Gruppe von Person auf einen Blick.
   */
  ecke?: number;
  style?: ViewStyle;
}

/**
 * Avatar als Verlauf statt als Fläche. Zwei Töne derselben Farbfamilie,
 * diagonal — das ist der Unterschied zwischen „Platzhalter" und „gestaltet".
 * Die Initialen liegen mit leichtem Schatten darauf, damit sie auf dem
 * helleren Ende des Verlaufs nicht wegkippen.
 */
export const Avatar = ({ id, name, size = 54, group = false, online = false, ecke, style, farbe }: Props) => {
  const base: ViewStyle = {
    width: size,
    height: size,
    borderRadius: ecke ?? size / 2,
    alignItems: 'center',
    justifyContent: 'center',
  };

  /*
   * Die Farbe gehört zur Person und steht in der Datenbank (profiles.color).
   * Sie hier nachzuschlagen statt sie durch vierzig Aufrufe zu reichen, hält
   * die Regel an einer Stelle — und keine Stelle kann sie vergessen.
   *
   * Vorher würfelte die App sie aus der Kennung: Anna war im Browser rosa und
   * in der App blau. Für alles, was keine Person ist (eine Community, ein
   * Gruppenname), gibt es keinen Eintrag — dann wird wie bisher gewürfelt.
   */
  const { users: alleNutzer } = useDaten();
  const ausDatenbank = farbe ?? alleNutzer[id]?.color;
  const pair: [string, string] = group ? ['#7E93C4', '#4A6699'] : avatarPair(id, ausDatenbank);
  const dot = Math.max(11, Math.round(size * 0.32));

  return (
    <View style={[{ width: size, height: size }, style]}>
      <LinearGradient
        colors={pair}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={base}
      >
        {group ? (
          <Ionicons name="people" size={size * 0.44} color={colors.white} />
        ) : (
          <Text style={[styles.initials, { fontSize: size * 0.33 }]}>{initialsOf(name)}</Text>
        )}
      </LinearGradient>
      {online && (
        <View
          style={[
            styles.online,
            { width: dot, height: dot, borderRadius: dot / 2, borderWidth: Math.max(2, dot * 0.2) },
          ]}
        />
      )}
    </View>
  );
};

const styles = themenStyles((colors) => ({
  initials: {
    color: colors.white,
    fontWeight: '600',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  online: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: colors.online,
    borderColor: colors.surface,
  },
}));
