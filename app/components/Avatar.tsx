import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { avatarPair, colors, initialsOf, themenStyles } from '../constants/design';

interface Props {
  id: string;
  name: string;
  size?: number;
  group?: boolean;
  /** Grüner Punkt unten rechts. */
  online?: boolean;
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
export const Avatar = ({ id, name, size = 54, group = false, online = false, ecke, style }: Props) => {
  const base: ViewStyle = {
    width: size,
    height: size,
    borderRadius: ecke ?? size / 2,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const pair: [string, string] = group ? ['#7E93C4', '#4A6699'] : avatarPair(id);
  const dot = Math.max(9, Math.round(size * 0.24));

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
