import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SheetRahmen } from './SheetRahmen';
import { colors, spacing } from '../constants/design';
import { MitteilungsBereich } from '../types';

export type ErstellenPunkt =
  | 'reels'
  | 'landscape'
  | 'post'
  | 'story'
  | 'highlight'
  | 'playlist'
  | 'livestream'
  | 'spende'
  | 'kanal';

interface Props {
  visible: boolean;
  bereich: MitteilungsBereich;
  onClose: () => void;
  onSelect: (punkt: ErstellenPunkt) => void;
}

// Genau die Punkte aus dem Prototyp-Frame "VP + erstellen", in dieser Reihenfolge.
const VIDEOS: { key: ErstellenPunkt; label: string }[] = [
  { key: 'reels', label: 'Reels' },
  { key: 'landscape', label: 'Querformat' },
  { key: 'post', label: 'Beitrag' },
  { key: 'story', label: 'Story' },
  { key: 'highlight', label: 'Highlight' },
  { key: 'playlist', label: 'Playlist' },
  { key: 'livestream', label: 'Livestream' },
  { key: 'spende', label: 'Spendenaktion' },
];

// "CP + erstellen" zeigt genau einen Punkt, mit blauem Plus davor.
const COMMUNITYS: { key: ErstellenPunkt; label: string; icon: true }[] = [
  { key: 'kanal', label: 'Neuen Kanal erstellen', icon: true },
];

export const ErstellenSheet = ({ visible, bereich, onClose, onSelect }: Props) => {
  const punkte = bereich === 'communities' ? COMMUNITYS : VIDEOS;

  return (
    <SheetRahmen visible={visible} title="Erstellen" onClose={onClose}>
      <View>
        {punkte.map((p, i) => (
          <Druck
            key={p.key}
            style={({ pressed }) => [
              styles.punkt,
              i === punkte.length - 1 && styles.letzter,
              pressed && styles.gedrueckt,
            ]}
            onPress={() => onSelect(p.key)}
          >
            {'icon' in p && <Ionicons name="add-circle" size={22} color={colors.brand} />}
            <Text style={styles.label}>{p.label}</Text>
          </Druck>
        ))}
      </View>
    </SheetRahmen>
  );
};

const styles = StyleSheet.create({
  punkt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl - 4,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  letzter: { borderBottomWidth: 0 },
  gedrueckt: { backgroundColor: colors.surface2 },
  label: { fontSize: 15.5, color: colors.text },
});
