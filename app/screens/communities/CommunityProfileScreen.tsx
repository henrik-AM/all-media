import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { OwnProfileHead } from '../../components/OwnProfileHead';
import { colors, spacing, typography } from '../../constants/design';
import { AreaKey } from '../../constants/navigation';
import { mockCommunities, mockUsers } from '../../mocks';
import { Community } from '../../types';

interface Props {
  onSwitchArea: (area: AreaKey) => void;
  onOpenCommunity: (community: Community) => void;
  onNotice: (message: string) => void;
}

/** Prototyp-Frame "Community - Profil": Erstellt und Beigetreten. */
export const CommunityProfileScreen = ({ onSwitchArea, onOpenCommunity, onNotice }: Props) => {
  const created = mockCommunities.filter((c) => c.visibility === 'private' && c.joined);
  const joined = mockCommunities.filter((c) => c.joined && !created.includes(c));

  const list = (items: Community[]) =>
    items.map((c) => (
      <Pressable key={c.id} style={styles.row} onPress={() => onOpenCommunity(c)}>
        <Avatar id={c.id} name={c.name} size={44} />
        <View style={styles.body}>
          <Text style={styles.name}>{c.name}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {c.topic} · {c.members.toLocaleString('de-DE')} Mitglieder
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text3} />
      </Pressable>
    ));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <OwnProfileHead handle={mockUsers.me.handle} onSwitch={() => onSwitchArea('messenger')} />

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{created.length}</Text>
          <Text style={styles.statLabel}>Erstellte Communitys</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{joined.length}</Text>
          <Text style={styles.statLabel}>Beigetretene Communitys</Text>
        </View>
      </View>

      <View style={styles.about}>
        <Text style={styles.aboutName}>Henrik</Text>
        <Text style={styles.bio}>Baue gerade All Media.</Text>
        <Pressable onPress={() => onNotice('all-media.app')}>
          <Text style={styles.link}>all-media.app</Text>
        </Pressable>
      </View>

      {created.length > 0 && <Text style={styles.sectionHead}>Erstellt →</Text>}
      {list(created)}
      {joined.length > 0 && <Text style={styles.sectionHead}>Beigetreten →</Text>}
      {list(joined)}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: spacing.xl },
  stats: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: spacing.md },
  stat: { alignItems: 'center', gap: 2, maxWidth: 160 },
  statNum: { fontSize: 17, fontWeight: '700', color: colors.text },
  statLabel: { ...typography.small, color: colors.text2, textAlign: 'center' },
  about: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  aboutName: { ...typography.h3, color: colors.text },
  bio: { ...typography.message, color: colors.text, marginTop: 3 },
  link: { ...typography.message, color: colors.brand, marginTop: 4 },
  sectionHead: {
    ...typography.h3,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  body: { flex: 1 },
  name: { ...typography.name, color: colors.text },
  sub: { ...typography.preview, color: colors.text2, marginTop: 2 },
});
