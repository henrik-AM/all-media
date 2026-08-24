import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { OwnProfileHead } from '../../components/OwnProfileHead';
import { SwitchBar } from '../../components/SwitchBar';
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
    <View style={styles.screen}>
      <SwitchBar onPress={() => onSwitchArea('messenger')} />

      <ScrollView contentContainerStyle={styles.content}>
        <OwnProfileHead
          handle={mockUsers.me.handle}
          stats={[
            { label: 'Erstellte Communitys', value: created.length },
            { label: 'Beigetretene Communitys', value: joined.length },
          ]}
          name="Henrik"
          bio="Baue gerade All Media."
          link="all-media.app"
          onAction={(key) =>
            onNotice({ bell: 'Mitteilungen', create: 'Erstellen', menu: 'Menü' }[key] + ' folgt')
          }
          onLink={() => onNotice('all-media.app')}
        />

        {created.length > 0 && <Text style={styles.sectionHead}>Erstellt →</Text>}
        {list(created)}
        {joined.length > 0 && <Text style={styles.sectionHead}>Beigetreten →</Text>}
        {list(joined)}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: spacing.xl },
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
