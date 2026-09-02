/**
 * Was man mit einer einzelnen Nachricht machen kann.
 *
 * WARUM ES DAS GIBT
 *
 * Das Handbuch listet unter „Nachrichten/Chats → Features" sieben Punkte:
 * bearbeiten, antworten, zitieren, weiterleiten, Gifs,
 * Sprachnachricht-Geschwindigkeit und Kontakte teilen. Bis zum 01.09.2026
 * konnte der Chat davon keinen einzigen. Langes Drücken setzte einen Stern,
 * und das war alles.
 *
 * WARUM ANTWORTEN UND ZITIEREN GETRENNT SIND
 *
 * Eine Antwort zeigt nur den Bezug an — eine schmale Zeile über der Blase,
 * die sagt, worauf sie sich bezieht. Ein Zitat nimmt den Text mit in die
 * eigene Nachricht hinein und bleibt auch dann lesbar, wenn das Original
 * zurückgenommen wird. Auf einen Punkt zusammengelegt wären beide nicht mehr
 * unterscheidbar, und die Liste im Handbuch nennt sie ausdrücklich einzeln.
 *
 * WARUM DIE REAKTIONEN OBEN STEHEN
 *
 * Eine Reaktion ist der häufigste Griff und kostet einen Tipp. Stünde sie
 * als achter Listenpunkt unten, wäre sie langsamer als das Tippen von „ok".
 */

import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Druck } from './Druck';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/*
 * Sechs Emoji, nicht mehr. Eine volle Tastatur an dieser Stelle ist keine
 * schnelle Reaktion mehr, sondern eine Auswahlaufgabe.
 */
export const REAKTIONEN = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export type NachrichtAktion =
  | 'antworten'
  | 'zitieren'
  | 'weiterleiten'
  | 'bearbeiten'
  | 'markieren'
  | 'zuruecknehmen';

interface Props {
  visible: boolean;
  /** Ist es die eigene Nachricht? Nur dann gibt es Bearbeiten und Zurücknehmen. */
  eigene: boolean;
  /** Schon mit Stern markiert? Der Punkt heißt dann anders herum. */
  markiert: boolean;
  /** Die eigene Reaktion, damit sie hervorgehoben dasteht. */
  reaktion?: string | null;
  onAktion: (was: NachrichtAktion) => void;
  onReaktion: (emoji: string) => void;
  onClose: () => void;
}

export const NachrichtSheet = ({
  visible,
  eigene,
  markiert,
  reaktion,
  onAktion,
  onReaktion,
  onClose,
}: Props) => {
  const punkte: { key: NachrichtAktion; label: string; icon: IconName; gefahr?: boolean }[] = [
    { key: 'antworten', label: 'Antworten', icon: 'arrow-undo-outline' },
    { key: 'zitieren', label: 'Zitieren', icon: 'chatbox-ellipses-outline' },
    { key: 'weiterleiten', label: 'Weiterleiten', icon: 'arrow-redo-outline' },
    {
      key: 'markieren',
      label: markiert ? 'Markierung entfernen' : 'Mit Stern markieren',
      icon: markiert ? 'star' : 'star-outline',
    },
  ];

  // Bearbeiten und Zurücknehmen nur bei eigenen. Fremde Nachrichten zu
  // ändern wäre kein Werkzeug, sondern eine Fälschung.
  if (eigene) {
    punkte.splice(3, 0, { key: 'bearbeiten', label: 'Bearbeiten', icon: 'create-outline' });
    punkte.push({
      key: 'zuruecknehmen',
      label: 'Zurücknehmen',
      icon: 'trash-outline',
      gefahr: true,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Druck style={styles.hinter} onPress={onClose} />
      <View style={styles.blatt}>
        <View style={styles.griff} />

        <View style={styles.emojis}>
          {REAKTIONEN.map((e) => (
            <Druck
              key={e}
              style={[styles.emoji, reaktion === e && styles.emojiAktiv]}
              onPress={() => onReaktion(e)}
            >
              <Text style={styles.emojiText}>{e}</Text>
            </Druck>
          ))}
        </View>

        {punkte.map((p) => (
          <Druck
            key={p.key}
            style={({ pressed }) => [styles.punkt, pressed && styles.punktGedrueckt]}
            onPress={() => onAktion(p.key)}
          >
            <Ionicons name={p.icon} size={20} color={p.gefahr ? colors.danger : colors.text} />
            <Text style={[styles.punktText, p.gefahr && styles.punktTextGefahr]}>{p.label}</Text>
          </Druck>
        ))}
      </View>
    </Modal>
  );
};

const styles = themenStyles((colors) => ({
  hinter: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  blatt: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  griff: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  emojis: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  emoji: { padding: 6, borderRadius: radius.pill },
  emojiAktiv: { backgroundColor: colors.brandSoft },
  emojiText: { fontSize: 26 },
  punkt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
  },
  punktGedrueckt: { backgroundColor: colors.surface2 },
  punktText: { ...typography.body, color: colors.text },
  punktTextGefahr: { color: colors.danger },
}));
