import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Druck } from './Druck';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';

/*
 * Einstellungen 16.11., Kasten 1.1 und 1.5 (Henrik): „Finde ein einheitliches
 * System, sodass meine Nutzer an eine Weise gewöhnt sein können und nicht
 * unter jedem Unterpunkt etwas anderes wartet, was das Gleiche bezweckt.“
 *
 * Die Bausteine der Einstellungsblätter:
 *   Karte           weiße Fläche mit runden Ecken, wie auf der Einstellungsseite
 *   Gruppentitel    kleine Überschrift über einer Karte
 *   AuswahlZeile    „eine aus mehreren“ — immer Kreis rechts, gewählt = gefüllt
 *   Hinweis         erklärender Satz unter einer Karte
 *
 * Wer „Profilbild sichtbar für“, „Zuletzt online“ oder „Medienqualität“ öffnet,
 * sieht dasselbe Muster. Gegenstück auf der Website: .einst-karte,
 * .einst-wahl, .einst-hinweis in web/public/styles.css.
 */

export const Karte = ({ children }: { children: React.ReactNode }) => <View style={styles.karte}>{children}</View>;

export const Gruppentitel = ({ children }: { children: React.ReactNode }) => (
  <Text style={styles.gruppentitel} accessibilityRole="header">
    {children}
  </Text>
);

export const Hinweis = ({ children }: { children: React.ReactNode }) => <Text style={styles.hinweis}>{children}</Text>;

interface AuswahlProps {
  label: string;
  hinweis?: string;
  gewaehlt: boolean;
  onPress: () => void;
  /** Letzte Zeile der Karte: ohne Trennlinie. */
  letzte?: boolean;
  testID?: string;
}

export const AuswahlZeile = ({ label, hinweis, gewaehlt, onPress, letzte, testID }: AuswahlProps) => (
  <Druck
    style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityState={{ checked: gewaehlt }}
    accessibilityLabel={hinweis ? `${label}. ${hinweis}` : label}
    testID={testID}
  >
    <View style={[styles.innen, !letzte && styles.trenner]}>
      <View style={styles.text}>
        <Text style={[styles.label, gewaehlt && styles.labelAn]}>{label}</Text>
        {!!hinweis && <Text style={styles.zeilenHinweis}>{hinweis}</Text>}
      </View>
      <Ionicons
        name={gewaehlt ? 'checkmark-circle' : 'ellipse-outline'}
        size={23}
        color={gewaehlt ? colors.brand : colors.text3}
      />
    </View>
  </Druck>
);

const styles = themenStyles((colors) => ({
  karte: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  gruppentitel: {
    ...typography.overline,
    color: colors.text3,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.lg + spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  hinweis: {
    ...typography.small,
    fontWeight: '400',
    lineHeight: 17,
    color: colors.text3,
    paddingHorizontal: spacing.lg + spacing.md,
    paddingTop: spacing.sm,
  },
  zeile: { paddingLeft: spacing.lg },
  gedrueckt: { backgroundColor: colors.surface3 },
  innen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 50,
    paddingVertical: 10,
    paddingRight: spacing.lg,
  },
  trenner: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  text: { flex: 1, minWidth: 0 },
  label: { ...typography.body, color: colors.text },
  labelAn: { fontWeight: '600' },
  zeilenHinweis: { ...typography.small, fontWeight: '400', color: colors.text3, marginTop: 2 },
}));
