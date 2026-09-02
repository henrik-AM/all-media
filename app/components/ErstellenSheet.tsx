import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SheetRahmen } from './SheetRahmen';
import { colors, spacing, themenStyles } from '../constants/design';
import { MitteilungsBereich } from '../types';

export type ErstellenPunkt =
  | 'reels'
  | 'landscape'
  | 'post'
  | 'umfrage'
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

type Symbol = React.ComponentProps<typeof Ionicons>['name'];

/*
 * Genau die Punkte aus dem Prototyp-Frame "VP + erstellen", in dieser
 * Reihenfolge.
 *
 * Die Symbole kamen später dazu. Vorher standen hier acht nackte Textzeilen
 * untereinander — das liest sich wie eine unfertige Liste, nicht wie das
 * Menü, über das in dieser App alles entsteht. Wo es die Art des Inhalts
 * schon anderswo gibt, ist es dasselbe Symbol wie in der oberen Leiste
 * (Hochformat, Querformat), damit beide Stellen zusammenpassen.
 */
const VIDEOS: { key: ErstellenPunkt; label: string; symbol: Symbol }[] = [
  { key: 'reels', label: 'Reels', symbol: 'phone-portrait-outline' },
  { key: 'landscape', label: 'Querformat', symbol: 'tv-outline' },
  { key: 'post', label: 'Beitrag', symbol: 'image-outline' },
  { key: 'story', label: 'Story', symbol: 'camera-outline' },
  // Livestream steht direkt unter Story: beides ist im Augenblick
  // aufgenommen und nach kurzer Zeit wieder weg. Highlight und Playlist
  // sortieren dagegen vorhandene Beiträge und gehören darum weiter nach unten.
  //
  // Die Umfrage stand am 01.09.2026 kurz zwischen Story und Livestream und
  // hat damit genau diese Nachbarschaft zerrissen. Sie gehoert hinter den
  // Livestream: eine Umfrage ist nichts Fluechtiges.
  { key: 'livestream', label: 'Livestream', symbol: 'videocam-outline' },
  /* Umfrage — im Handbuch bei Beitraegen, Storys und Kanaelen genannt. */
  { key: 'umfrage', label: 'Umfrage', symbol: 'bar-chart-outline' },
  { key: 'highlight', label: 'Highlight', symbol: 'folder-outline' },
  { key: 'playlist', label: 'Playlist', symbol: 'layers-outline' },
  { key: 'spende', label: 'Spendenaktion', symbol: 'heart-outline' },
];

// "CP + erstellen" zeigt genau einen Punkt.
const COMMUNITYS: { key: ErstellenPunkt; label: string; symbol: Symbol }[] = [
  { key: 'kanal', label: 'Neuen Kanal erstellen', symbol: 'add-outline' },
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
            <View style={styles.symbolFeld}>
              <Ionicons name={p.symbol} size={19} color={colors.brand} />
            </View>
            <Text style={styles.label}>{p.label}</Text>
          </Druck>
        ))}
      </View>
    </SheetRahmen>
  );
};

const styles = themenStyles((colors) => ({
  punkt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl - 4,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  // Getönte Fläche statt eines freistehenden Symbols: acht freistehende
  // Symbole in einer Spalte wirken zerfasert, acht gleich große Flächen geben
  // der Liste eine Kante, an der das Auge herunterläuft.
  symbolFeld: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letzter: { borderBottomWidth: 0 },
  gedrueckt: { backgroundColor: colors.surface2 },
  label: { fontSize: 15.5, color: colors.text },
}));
