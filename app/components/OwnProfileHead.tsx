import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { colors, radius, sizes, spacing, typography } from '../constants/design';

interface Props {
  handle?: string;
  name?: string;
  onSwitch: () => void;
  children?: React.ReactNode;
}

/**
 * Kopf der drei eigenen Profile (Messenger, Videos, Communitys). Im Prototyp
 * steht über jedem davon „Profil wechseln".
 */
export const OwnProfileHead = ({ handle, name, onSwitch, children }: Props) => (
  <View style={styles.wrap}>
    <Pressable style={styles.switch} onPress={onSwitch}>
      <Text style={styles.switchText}>Profil wechseln</Text>
      <Ionicons name="chevron-down" size={15} color={colors.text2} />
    </Pressable>
    <Avatar id="me" name="Du" size={sizes.avatarXl} />
    {name ? <Text style={styles.name}>{name}</Text> : null}
    {handle ? <Text style={styles.handle}>{handle}</Text> : null}
    {children}
  </View>
);

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm, paddingTop: 46, paddingBottom: spacing.md },
  switch: {
    position: 'absolute',
    top: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surface3,
  },
  switchText: { ...typography.preview, fontWeight: '600', color: colors.text2 },
  name: { ...typography.h2, color: colors.text },
  handle: { ...typography.name, color: colors.text2 },
});
