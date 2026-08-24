import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '../constants/design';

/**
 * Leiste „Profil wechseln" über die volle Breite. Im Prototyp steht sie über
 * jedem der drei eigenen Profile (Messenger, Videos, Communitys).
 *
 * Sie fuehrt zur Kontoliste - also zum Wechsel auf ein anderes eigenes Konto,
 * nicht zum Wechsel zwischen den drei Profilen desselben Kontos.
 */
export const SwitchBar = ({ onPress, label = 'Profil wechseln' }: { onPress: () => void; label?: string }) => (
  <Pressable style={styles.bar} onPress={onPress}>
    <Text style={styles.text}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  bar: {
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  text: { ...typography.body, color: colors.text },
});
