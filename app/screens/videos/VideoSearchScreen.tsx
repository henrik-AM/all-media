import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { SearchBar } from '../../components/SearchBar';
import { colors, radius, spacing, typography } from '../../constants/design';
import {
  mockClips,
  mockHashtags,
  mockPlaces,
  mockPosts,
  mockSounds,
  mockUsers,
  mockVideos,
} from '../../mocks';

interface Props {
  onOpenProfile: (userId: string) => void;
  onNotice: (message: string) => void;
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',')}k` : String(n);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.section}>
    <Text style={styles.sectionHead}>{title} →</Text>
    {children}
  </View>
);

const Row = ({
  icon,
  title,
  sub,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  sub: string;
  onPress: () => void;
}) => (
  <Pressable style={styles.row} onPress={onPress}>
    <View style={styles.rowThumb}>
      <Ionicons name={icon} size={20} color={colors.text3} />
    </View>
    <View style={styles.rowText}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowSub}>{sub}</Text>
    </View>
  </Pressable>
);

/**
 * Prototyp-Frame "Video - Suche": Explorer mit den Abschnitten Reels,
 * Querformat, Beiträge, Profile, Hashtags, Standorte und Sounds.
 */
export const VideoSearchScreen = ({ onOpenProfile, onNotice }: Props) => {
  const [query, setQuery] = useState('');

  const result = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hit = (text: string) => !q || text.toLowerCase().includes(q);

    return {
      reels: mockVideos.filter((v) => hit(v.description) || hit(mockUsers[v.userId].name)),
      clips: mockClips.filter((c) => hit(c.title) || hit(mockUsers[c.userId].name)),
      posts: mockPosts.filter((p) => hit(p.description) || hit(mockUsers[p.userId].name)),
      people: Object.values(mockUsers).filter((u) => u.id !== 'me' && (hit(u.name) || hit(u.handle))),
      tags: mockHashtags.filter((h) => hit(h.tag)),
      places: mockPlaces.filter((p) => hit(p.name)),
      sounds: mockSounds.filter((s) => hit(s.title) || hit(s.artist)),
    };
  }, [query]);

  const total = Object.values(result).reduce((sum, list) => sum + list.length, 0);

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Suche nach Videos, Profilen, #Hashtags"
        />
      </View>

      {total === 0 ? (
        <EmptyState icon="search-outline" title="Nichts gefunden" text={`Für „${query}" gibt es keinen Treffer.`} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {result.reels.length > 0 && (
            <Section title="Reels">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reelRow}>
                {result.reels.map((v) => (
                  <Pressable key={v.id} style={styles.reel} onPress={() => onNotice('Reel öffnet im Hochformat')}>
                    <Ionicons name="phone-portrait-outline" size={28} color={colors.text3} />
                    <Text style={styles.reelName}>{mockUsers[v.userId].name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Section>
          )}

          {result.clips.length > 0 && (
            <Section title="Querformat">
              {result.clips.map((c) => (
                <Row
                  key={c.id}
                  icon="tv-outline"
                  title={c.title}
                  sub={`${mockUsers[c.userId].name} · ${c.duration}`}
                  onPress={() => onNotice('Video öffnet im Querformat')}
                />
              ))}
            </Section>
          )}

          {result.posts.length > 0 && (
            <Section title="Beiträge">
              <View style={styles.grid}>
                {result.posts.map((p) => (
                  <Pressable key={p.id} style={styles.gridItem} onPress={() => onNotice('Beitrag öffnet im Feed')}>
                    <Ionicons name="image-outline" size={26} color={colors.text3} />
                  </Pressable>
                ))}
              </View>
            </Section>
          )}

          {result.people.length > 0 && (
            <Section title="Profile">
              {result.people.map((u) => (
                <Pressable key={u.id} style={styles.row} onPress={() => onOpenProfile(u.id)}>
                  <Avatar id={u.id} name={u.name} size={44} />
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{u.name}</Text>
                    <Text style={styles.rowSub}>{u.handle}</Text>
                  </View>
                </Pressable>
              ))}
            </Section>
          )}

          {result.tags.length > 0 && (
            <Section title="# Hashtags">
              <View style={styles.tags}>
                {result.tags.map((h) => (
                  <Pressable key={h.tag} style={styles.tag} onPress={() => onNotice(`${h.tag} — Hashtag-Seite folgt`)}>
                    <Text style={styles.tagText}>
                      {h.tag} · {compact(h.posts)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Section>
          )}

          {result.places.length > 0 && (
            <Section title="Standorte">
              {result.places.map((p) => (
                <Row
                  key={p.id}
                  icon="location-outline"
                  title={p.name}
                  sub={`${compact(p.posts)} Beiträge`}
                  onPress={() => onNotice('Standort-Seite folgt')}
                />
              ))}
            </Section>
          )}

          {result.sounds.length > 0 && (
            <Section title="Sounds">
              {result.sounds.map((s) => (
                <Row
                  key={s.id}
                  icon="musical-notes-outline"
                  title={s.title}
                  sub={`${s.artist} · ${compact(s.uses)} Videos`}
                  onPress={() => onNotice('Sound-Seite folgt')}
                />
              ))}
            </Section>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  head: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  content: { paddingBottom: spacing.xl },
  section: { paddingBottom: spacing.sm },
  sectionHead: {
    ...typography.h3,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  reelRow: { gap: spacing.md, paddingHorizontal: spacing.lg },
  reel: {
    width: 116,
    height: 190,
    borderRadius: radius.md,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  reelName: { ...typography.small, color: colors.text2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
  },
  rowThumb: {
    width: 56,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { ...typography.message, fontWeight: '600', color: colors.text },
  rowSub: { ...typography.small, color: colors.text3, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingHorizontal: 2 },
  gridItem: {
    width: '33%',
    aspectRatio: 1,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
  },
  tagText: { ...typography.small, color: colors.brand, fontWeight: '600' },
});
