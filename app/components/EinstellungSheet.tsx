import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SheetRahmen } from './SheetRahmen';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';

export interface ListenZeile {
  text: string;
  neben?: string;
  /**
   * Zwischenüberschrift statt Eintrag.
   *
   * Die Profilstatistik hat zwölf Zeilen. Ohne Gliederung liest sie niemand:
   * „Profilaufrufe (7 Tage)" und „Follower gesamt" sehen dann gleich wichtig
   * aus, obwohl das eine eine Entwicklung ist und das andere ein Stand.
   */
  kopf?: boolean;
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
        <Druck style={styles.knopf} onPress={onKnopf}>
          <Text style={styles.knopfText}>{knopf}</Text>
        </Druck>
      ) : bestaetigen ? (
        <Druck style={[styles.knopf, styles.gefahr]} onPress={onBestaetigt}>
          <Text style={styles.knopfText}>Ja, Konto löschen</Text>
        </Druck>
      ) : undefined
    }
  >
    {wahl && (
      <ScrollView>
        {wahl.map((w) => (
          <Druck
            key={w}
            style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
            onPress={() => onWahl?.(w)}
          >
            <Text style={styles.label}>{w}</Text>
            {w === aktuell && <Ionicons name="checkmark" size={19} color={colors.brand} />}
          </Druck>
        ))}
      </ScrollView>
    )}

    {zeilen &&
      (zeilen.length === 0 ? (
        <Text style={styles.hinweis}>{leer}</Text>
      ) : (
        <ScrollView>
          {zeilen.map((z) =>
            z.kopf ? (
              <Text key={z.text} style={styles.gruppe}>
                {z.text}
              </Text>
            ) : (
              <View key={z.text} style={styles.zeile}>
                <Text style={styles.label}>{z.text}</Text>
                <Text style={styles.neben}>{z.neben}</Text>
              </View>
            )
          )}
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

const styles = themenStyles((colors) => ({
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
  /* Wie die Abschnittsüberschriften der Einstellungsseite selbst. */
  gruppe: {
    ...typography.tiny,
    color: colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
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
}));
