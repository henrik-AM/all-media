import React from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';

/*
 * Fläche für Beiträge, für die noch kein echtes Bild vorliegt.
 *
 * Vorher stand überall dieselbe graue Fläche mit einem Bildsymbol darin. Das
 * liest sich wie ein Ladefehler — und ein Feed besteht nun einmal zur Hälfte
 * aus Bildfläche, deshalb war es der auffälligste Qualitätsbruch der App.
 *
 * Jetzt bekommt jeder Beitrag eine ruhige Farbfläche, stabil aus seiner
 * Kennung gewählt. Die Töne sind entsättigt und eng beieinander, damit die
 * Fläche als Hintergrund liest und nicht mit dem Text um Aufmerksamkeit
 * kämpft. Das Symbol liegt nur noch klein und blass darauf und sagt, um
 * welche Art Medium es geht.
 *
 * Dieselben acht Motive gibt es in der Website (styles.css, .motiv--0…7).
 */
const MOTIVE: [string, string][] = [
  ['#8E9BC9', '#5B6A9E'],
  ['#C9A28E', '#9E6F5B'],
  ['#8EC9B5', '#4F8F7D'],
  ['#B79ECB', '#7E5F96'],
  ['#C9BC8E', '#96863F'],
  ['#8EB4C9', '#4F7F96'],
  ['#C98E9E', '#96525F'],
  ['#9EB48E', '#63894F'],
];

interface Props {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  /*
   * Das echte Bild, wenn es eines gibt.
   *
   * Liegt es vor, tritt die Ersatzfläche zurück — sie war immer nur der
   * Platzhalter für den Fall ohne Bild. Weil alle Bildflächen der App über
   * diese eine Stelle laufen, genügt hier ein Feld, statt zwanzig Bildschirme
   * einzeln umzubauen.
   */
  bild?: string;
  /** Größe des Symbols. Klein halten — groß liest es sich wieder als Fehler. */
  iconSize?: number;
  /** Dunkle Fassung fürs Video-Vollbild: dort würde eine helle Fläche blenden. */
  dunkel?: boolean;
  style?: ViewStyle;
}

function motivVon(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return MOTIVE[h % MOTIVE.length];
}

export const Motiv = ({ id, icon, iconSize = 32, dunkel = false, style, bild }: Props) => {
  const [hell, tief] = motivVon(id);

  if (bild) {
    return <Image source={{ uri: bild }} style={[styles.flaeche, style as object]} resizeMode="cover" />;
  }

  return (
    <LinearGradient
      colors={dunkel ? ['#23262E', '#0C0D11'] : [hell, tief]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[styles.flaeche, style]}
    >
      {/* Ein sehr feiner Lichtabfall nach unten rechts. Ohne ihn wirkt eine
          große Fläche wie ein Farbfeld; mit ihm wie eine Aufnahme, deren
          Motiv man gerade nicht erkennt. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.16)', 'rgba(0,0,0,0.16)']}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 0.85, y: 0.95 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none">
        <Ionicons
          name={icon}
          size={iconSize}
          color={dunkel ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.5)'}
        />
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  flaeche: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
