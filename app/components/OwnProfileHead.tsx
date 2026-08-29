import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { colors, sizes, spacing, themenStyles, typography } from '../constants/design';

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
  onStat?: (label: string) => void;
  onBearbeiten?: () => void;
  onAvatarPress?: () => void;
  ungelesen?: number;
}

/**
 * Kopf von "Videos - Profil" und "Community - Profil": @Nutzername mit
 * Glocke/Plus/Menü, darunter Bild links neben den Zahlen, dann Name,
 * Biografie und Link linksbündig.
 */
export const OwnProfileHead = ({ handle, stats, name, bio, link, onAction, onLink, onStat, onBearbeiten, onAvatarPress, ungelesen = 0 }: Props) => (
  <View>
    <View style={styles.bar}>
      <Text style={styles.handle}>{handle}</Text>
      <View style={styles.actions}>
        <Druck
          onPress={() => onAction('bell')}
          hitSlop={8}
          accessibilityLabel={ungelesen ? `Mitteilungen, ${ungelesen} ungelesen` : 'Mitteilungen'}
        >
          <Ionicons name={ungelesen > 0 ? "notifications" : "notifications-off-outline"} size={21} color={ungelesen > 0 ? colors.text : colors.text3} />
          {ungelesen > 0 && <View style={styles.dot} />}
        </Druck>
        <Druck onPress={() => onAction('create')} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={21} color={colors.text} />
        </Druck>
        <Druck onPress={() => onAction('menu')} hitSlop={8}>
          <Ionicons name="settings-outline" size={21} color={colors.text} />
        </Druck>
      </View>
    </View>

    <View style={styles.top}>
      <Druck disabled={!onAvatarPress} onPress={onAvatarPress}>
        <View>
          {/* Der Name stand hier fest als "Du" - die Initiale im Kreis war
              deshalb "D", waehrend direkt darunter "Henrik" steht. Jetzt kommt
              der Name von aussen, wie ueberall sonst. */}
          <Avatar id="me" name={name} size={sizes.avatarXl} />
          <View style={styles.online} />
        </View>
      </Druck>
      <View style={styles.stats}>
        {stats.map((stat) => (
          <Druck
            key={stat.label}
            style={styles.stat}
            onPress={() => onStat?.(stat.label)}
          >
            <Text style={styles.statLabel}>{stat.label}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
          </Druck>
        ))}
      </View>
    </View>

    <View style={styles.about}>
      <Text style={styles.name}>{name}</Text>
      {!!bio && <Text style={styles.bio}>{bio}</Text>}
      {!!link && (
        <Druck onPress={onLink}>
          <Text style={styles.link}>{link}</Text>
        </Druck>
      )}
    </View>

    {onBearbeiten && (
      <Druck style={styles.bearbeiten} onPress={onBearbeiten}>
        <Text style={styles.bearbeitenText}>Profil bearbeiten</Text>
      </Druck>
    )}
  </View>
);

const styles = themenStyles((colors) => ({
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
    width: 18,
    height: 18,
    borderRadius: 9,
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
  /* Kante statt Graufüllung: eine graue Fläche über die volle Breite liest
     sich wie ein Platzhalter, eine Kante wie ein Knopf. */
  bearbeiten: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  bearbeitenText: { fontSize: 14, fontWeight: '600', color: colors.text, letterSpacing: -0.1 },
}));
