import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EmptyState } from '../../components/EmptyState';
import { OwnProfileHead } from '../../components/OwnProfileHead';
import { SwitchBar } from '../../components/SwitchBar';
import { colors, spacing, typography } from '../../constants/design';
import { AreaKey } from '../../constants/navigation';
import { mockProfiles, mockUsers } from '../../mocks';
import { useReposts } from '../../contexts/RepostContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Tab = 'grid' | 'repost' | 'tagged' | 'saved';

interface Props {
  onSwitchArea: (area: AreaKey) => void;
  onNotice: (message: string) => void;
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',')}k` : String(n);

const TABS: { key: Tab; icon: IconName }[] = [
  { key: 'grid', icon: 'grid-outline' },
  { key: 'repost', icon: 'repeat-outline' },
  { key: 'tagged', icon: 'person-outline' },
  { key: 'saved', icon: 'bookmark-outline' },
];

const GRID = ['image', 'video', 'image', 'video', 'image', 'image', 'video', 'image', 'video', 'image', 'video', 'image'];

/** Prototyp-Frame "Videos - Profil". */
export const VideoProfileScreen = ({ onSwitchArea, onNotice }: Props) => {
  const { reposts } = useReposts();
  const [tab, setTab] = useState<Tab>('grid');
  const me = mockProfiles.me;

  return (
    <View style={styles.screen}>
      <SwitchBar onPress={() => onSwitchArea('messenger')} />

      <ScrollView contentContainerStyle={styles.content}>
        <OwnProfileHead
          handle={mockUsers.me.handle}
          stats={[
            { label: 'Beiträge', value: compact(me.posts) },
            { label: 'Follower', value: compact(me.followers) },
            { label: 'Gefolgt', value: compact(me.following) },
          ]}
          name="Henrik"
          bio={me.bio}
          link={me.link}
          onAction={(key) =>
            onNotice({ bell: 'Mitteilungen', create: 'Erstellen', menu: 'Menü' }[key] + ' folgt')
          }
          onLink={() => onNotice(me.link)}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlights}>
          {['Playlistname', 'Playlistname'].map((label, i) => (
            <Pressable key={`pl${i}`} style={styles.highlight} onPress={() => onNotice('Playlist folgt')}>
              <View style={[styles.ring, styles.ringPlaylist]}>
                <Ionicons name="play-outline" size={24} color="#E5484D" />
              </View>
              <Text style={styles.highlightLabel} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          ))}
          {me.highlights.map((label) => (
            <Pressable key={label} style={styles.highlight} onPress={() => onNotice(`„${label}" folgt`)}>
              <View style={[styles.ring, styles.ringHighlight]}>
                <Ionicons name="image-outline" size={24} color="#F5A524" />
              </View>
              <Text style={styles.highlightLabel} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.tabs}>
          {TABS.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.tab, tab === item.key && styles.tabActive]}
              onPress={() => setTab(item.key)}
            >
              <Ionicons name={item.icon} size={22} color={tab === item.key ? colors.text : colors.text3} />
            </Pressable>
          ))}
        </View>

        {tab === 'grid' ? (
          <View style={styles.grid}>
            {GRID.map((kind, i) => (
              <View key={i} style={styles.gridItem}>
                <Ionicons name={kind === 'video' ? 'play-outline' : 'image-outline'} size={26} color={colors.text3} />
              </View>
            ))}
          </View>
        ) : tab === 'repost' && reposts.length > 0 ? (
          // Der Reiter war immer leer. Jetzt stehen hier die Beitraege und
          // Videos, die man selbst repostet hat.
          <View style={styles.grid}>
            {reposts.map((r) => (
              <View key={`${r.art}-${r.id}`} style={styles.gridItem}>
                <Ionicons
                  name={r.art === 'video' ? 'play-outline' : 'image-outline'}
                  size={26}
                  color={colors.text3}
                />
                <View style={styles.repostMarke}>
                  <Ionicons name="repeat" size={12} color={colors.white} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            icon={TABS.find((t) => t.key === tab)!.icon}
            title={tab === 'repost' ? 'Noch nichts repostet' : 'Noch nichts hier'}
            text={
              tab === 'repost'
                ? 'Tippe im Feed auf den Repost-Knopf, dann erscheint es hier.'
                : 'Dieser Bereich füllt sich, sobald du ihn benutzt.'
            }
          />
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  repostMarke: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingBottom: spacing.xl },
  highlights: { gap: 14, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  highlight: { alignItems: 'center', gap: 6, width: 68 },
  ring: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  ringPlaylist: { borderColor: '#E5484D' },
  ringHighlight: { borderColor: '#F5A524' },
  highlightLabel: { ...typography.small, color: colors.text2 },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tab: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingHorizontal: 2, paddingTop: 2 },
  gridItem: {
    width: '33%',
    aspectRatio: 1,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
