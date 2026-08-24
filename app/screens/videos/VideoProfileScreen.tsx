import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { OwnProfileHead } from '../../components/OwnProfileHead';
import { colors, radius, spacing, typography } from '../../constants/design';
import { AreaKey } from '../../constants/navigation';
import { mockProfiles, mockUsers } from '../../mocks';

interface Props {
  onSwitchArea: (area: AreaKey) => void;
  onNotice: (message: string) => void;
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',')}k` : String(n);

const GRID = ['image', 'video', 'image', 'video', 'image', 'image', 'video', 'image', 'video', 'image', 'video', 'image'];

/** Prototyp-Frame "Videos - Profil". */
export const VideoProfileScreen = ({ onSwitchArea, onNotice }: Props) => {
  const me = mockProfiles.me;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <OwnProfileHead handle={mockUsers.me.handle} onSwitch={() => onSwitchArea('messenger')} />

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{compact(me.posts)}</Text>
          <Text style={styles.statLabel}>Beiträge</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{compact(me.followers)}</Text>
          <Text style={styles.statLabel}>Follower</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{compact(me.following)}</Text>
          <Text style={styles.statLabel}>Gefolgt</Text>
        </View>
      </View>

      <View style={styles.about}>
        <Text style={styles.name}>Henrik</Text>
        <Text style={styles.bio}>{me.bio}</Text>
        <Pressable onPress={() => onNotice(me.link)}>
          <Text style={styles.link}>{me.link}</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlights}>
        {['Playlist', 'Tutorials', ...me.highlights].map((label, i) => (
          <Pressable key={label} style={styles.highlight} onPress={() => onNotice(`„${label}" folgt`)}>
            <View style={styles.ring}>
              <Ionicons name={i < 2 ? 'folder-outline' : 'image-outline'} size={24} color={colors.text3} />
            </View>
            <Text style={styles.highlightLabel} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.grid}>
        {GRID.map((kind, i) => (
          <View key={i} style={styles.gridItem}>
            <Ionicons name={kind === 'video' ? 'play-outline' : 'image-outline'} size={26} color={colors.text3} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: spacing.xl },
  stats: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: spacing.md },
  stat: { alignItems: 'center', gap: 2 },
  statNum: { fontSize: 17, fontWeight: '700', color: colors.text },
  statLabel: { ...typography.small, color: colors.text2 },
  about: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  name: { ...typography.h3, color: colors.text },
  bio: { ...typography.message, color: colors.text, marginTop: 3 },
  link: { ...typography.message, color: colors.brand, marginTop: 4 },
  highlights: { gap: 14, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  highlight: { alignItems: 'center', gap: 6, width: 68 },
  ring: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.surface3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightLabel: { ...typography.small, color: colors.text2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingHorizontal: 2 },
  gridItem: {
    width: '33%',
    aspectRatio: 1,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
