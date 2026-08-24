import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { colors, sizes, spacing, typography } from '../constants/design';

interface Stat {
  label: string;
  value: string | number;
}

interface Props {
  handle: string;
  stats: Stat[];
  name: string;
  bio: string;
  link: string;
  onAction: (key: string) => void;
  onLink: () => void;
}

/**
 * Kopf von "Videos - Profil" und "Community - Profil": @Nutzername mit
 * Glocke/Plus/Menü, darunter Bild links neben den Zahlen, dann Name,
 * Biografie und Link linksbündig.
 */
export const OwnProfileHead = ({ handle, stats, name, bio, link, onAction, onLink }: Props) => (
  <View>
    <View style={styles.bar}>
      <Text style={styles.handle}>{handle}</Text>
      <View style={styles.actions}>
        <Pressable onPress={() => onAction('bell')} hitSlop={8}>
          <Ionicons name="notifications-outline" size={21} color={colors.text} />
          <View style={styles.dot} />
        </Pressable>
        <Pressable onPress={() => onAction('create')} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={21} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => onAction('menu')} hitSlop={8}>
          <Ionicons name="menu-outline" size={21} color={colors.text} />
        </Pressable>
      </View>
    </View>

    <View style={styles.top}>
      <View>
        <Avatar id="me" name="Du" size={sizes.avatarXl} />
        <View style={styles.online} />
      </View>
      <View style={styles.stats}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text style={styles.statLabel}>{stat.label}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
          </View>
        ))}
      </View>
    </View>

    <View style={styles.about}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.bio}>{bio}</Text>
      <Pressable onPress={onLink}>
        <Text style={styles.link}>{link}</Text>
      </Pressable>
    </View>
  </View>
);

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 2,
  },
  handle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  online: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#34C759',
    borderWidth: 2.5,
    borderColor: colors.surface,
  },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 4, maxWidth: 120 },
  statLabel: { ...typography.small, color: colors.text2, textAlign: 'center' },
  statValue: { fontSize: 17, fontWeight: '700', color: colors.text },
  about: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  name: { ...typography.h2, color: colors.text },
  bio: { ...typography.message, color: colors.text, marginTop: 3 },
  link: { ...typography.message, color: colors.brand, marginTop: 4 },
});
