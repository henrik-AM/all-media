import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../constants/design';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  /** Blatt auf volle Hoehe ziehen - fuer lange Listen. */
  hoch?: boolean;
  children: React.ReactNode;
  /** Fest stehende Zeile ganz unten, z. B. ein Knopf. */
  fuss?: React.ReactNode;
}

/**
 * Blatt von unten mit X links und mittigem Titel - so wie es die
 * Prototyp-Frames "VP + Mitteilung" und "VP + erstellen" zeigen.
 */
export const SheetRahmen = ({ visible, title, onClose, hoch, children, fuss }: Props) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, hoch && styles.sheetHoch, { paddingBottom: fuss ? 0 : insets.bottom + spacing.md }]}>
        <View style={styles.kopf}>
          <Pressable style={styles.x} onPress={onClose} hitSlop={8} accessibilityLabel="Schließen">
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.titel}>{title}</Text>
        </View>

        <View style={hoch ? styles.inhaltHoch : undefined}>{children}</View>

        {fuss ? <View style={[styles.fuss, { paddingBottom: insets.bottom + spacing.md }]}>{fuss}</View> : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  /* 40 Prozent waren zu hell - die Seite darunter blieb voll lesbar und das
     Blatt wirkte aufgeklebt statt darueber. */
  backdrop: { flex: 1, backgroundColor: 'rgba(6,8,12,0.52)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    /* Schatten nach oben: ohne ihn hat die Oberkante des Blattes keine Hoehe. */
    shadowColor: '#0C0E14',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  // 74 Prozent: genug fuer eine lange Liste, aber der Bildschirm dahinter
  // bleibt sichtbar - sonst wirkt es wie eine eigene Seite.
  sheetHoch: { height: '74%' },
  inhaltHoch: { flex: 1, minHeight: 0 },
  kopf: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  x: { position: 'absolute', left: spacing.md, top: 15 },
  titel: { fontSize: 17, fontWeight: '600', color: colors.text },
  fuss: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
