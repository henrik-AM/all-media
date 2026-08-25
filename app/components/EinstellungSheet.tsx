import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SheetRahmen } from './SheetRahmen';
import { colors, radius, spacing, typography } from '../constants/design';

export interface ListenZeile {
  text: string;
  neben: string;
}

interface Props {
  titel: string;
  /** Eine aus mehreren Möglichkeiten. */
  wahl?: string[];
  aktuell?: string;
  onWahl?: (wert: string) => void;
  /** Was gerade eingetragen ist. */
  zeilen?: ListenZeile[];
  leer?: string;
  knopf?: string;
  onKnopf?: () => void;
  /** Erklärtext. */
  info?: string;
  /** Nachfrage vor etwas Endgültigem. */
  bestaetigen?: string;
  onBestaetigt?: () => void;
  onClose: () => void;
}

/**
 * Blatt hinter einem Einstellungspunkt. Vier Ausprägungen, damit kein
 * Punkt in den Einstellungen nur ein Hinweis bleibt.
 */
export const EinstellungSheet = ({
  titel,
  wahl,
  aktuell,
  onWahl,
  zeilen,
  leer,
  knopf,
  onKnopf,
  info,
  bestaetigen,
  onBestaetigt,
  onClose,
}: Props) => (
  <SheetRahmen
    visible
    title={titel}
    onClose={onClose}
    hoch={!!zeilen && zeilen.length > 4}
    fuss={
      knopf ? (
        <Pressable style={styles.knopf} onPress={onKnopf}>
          <Text style={styles.knopfText}>{knopf}</Text>
        </Pressable>
      ) : bestaetigen ? (
        <Pressable style={[styles.knopf, styles.gefahr]} onPress={onBestaetigt}>
          <Text style={styles.knopfText}>Ja, Konto löschen</Text>
        </Pressable>
      ) : undefined
    }
  >
    {wahl && (
      <ScrollView>
        {wahl.map((w) => (
          <Pressable
            key={w}
            style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
            onPress={() => onWahl?.(w)}
          >
            <Text style={styles.label}>{w}</Text>
            {w === aktuell && <Ionicons name="checkmark" size={19} color={colors.brand} />}
          </Pressable>
        ))}
      </ScrollView>
    )}

    {zeilen &&
      (zeilen.length === 0 ? (
        <Text style={styles.hinweis}>{leer}</Text>
      ) : (
        <ScrollView>
          {zeilen.map((z) => (
            <View key={z.text} style={styles.zeile}>
              <Text style={styles.label}>{z.text}</Text>
              <Text style={styles.neben}>{z.neben}</Text>
            </View>
          ))}
        </ScrollView>
      ))}

    {info && <Text style={styles.text}>{info}</Text>}

    {bestaetigen && (
      <Text style={styles.text}>
        {bestaetigen} Alle Beiträge, Nachrichten und Communitys gehen dabei unwiderruflich verloren.
      </Text>
    )}
  </SheetRahmen>
);

const styles = StyleSheet.create({
  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  gedrueckt: { backgroundColor: colors.surface2 },
  label: { flex: 1, ...typography.body, color: colors.text },
  neben: { ...typography.preview, color: colors.text3 },
  hinweis: { ...typography.message, color: colors.text2, padding: spacing.lg },
  text: { ...typography.message, color: colors.text, padding: spacing.lg, lineHeight: 21 },
  knopf: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gefahr: { backgroundColor: colors.danger },
  knopfText: { ...typography.name, color: colors.white },
});
