import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Motiv } from '../../components/Motiv';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { SearchBar } from '../../components/SearchBar';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';
import {
  mockHashtags,
  mockPlaces,
  mockPosts,
  mockSounds,
  mockUsers,
  mockVideos,
} from '../../mocks';
import { ExplorerZiel } from './ExplorerScreen';
import { useProfil } from '../../contexts/ProfilContext';
import { useKachelHoehe } from '../../lib/raster';

interface Props {
  onOpenProfile: (userId: string) => void;
  /** Oeffnet die Seite zu einem Hashtag, Standort oder Sound. */
  onOpenExplorer: (ziel: ExplorerZiel) => void;
  onNotice: (message: string) => void;
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',')}k` : String(n);

const Section = ({ title, children, onTitlePress }: { title: string; children: React.ReactNode; onTitlePress?: () => void }) => (
  <View style={styles.section}>
    <Druck style={styles.sectionHeadPress} onPress={onTitlePress} disabled={!onTitlePress}>
      <Text style={styles.sectionHead}>{title} →</Text>
    </Druck>
    {children}
  </View>
);

const Row = ({
  id,
  icon,
  title,
  sub,
  onPress,
}: {
  /*
   * Ohne id ist die Zeile eine Kategorie (Ort, Musik) und keine Aufnahme —
   * dann gibt es keine Motivfläche, sondern die gedämpfte Markenfarbe. Sonst
   * sähen Orte und Musik aus wie Vorschaubilder, die nicht geladen haben.
   */
  id?: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  sub: string;
  onPress: () => void;
}) => (
  <Druck style={styles.row} onPress={onPress}>
    <View style={[styles.rowThumb, !id && styles.rowThumbKategorie]}>
      {id ? (
        <Motiv id={id} icon={icon} iconSize={18} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
      ) : (
        <Ionicons name={icon} size={18} color={colors.brand} />
      )}
    </View>
    <View style={styles.rowText}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowSub}>{sub}</Text>
    </View>
  </Druck>
);

/**
 * Prototyp-Frame "Video - Suche": Explorer mit den Abschnitten Reels,
 * Querformat, Beiträge, Profile, Hashtags, Standorte und Sounds.
 */
export const VideoSearchScreen = ({ onOpenProfile, onOpenExplorer, onNotice }: Props) => {
  const kachelHoehe = useKachelHoehe();
  // Eigene Aufnahmen sollen auch ueber die Suche zu finden sein.
  const { clips, eigeneBeitraege, eigeneVideos } = useProfil();
  const [query, setQuery] = useState('');
  const [filterArt, setFilterArt] = useState<'alle' | 'reels' | 'clips' | 'posts' | 'people' | 'tags' | 'places' | 'sounds'>('alle');

  const allResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hit = (text: string) => !q || text.toLowerCase().includes(q);

    return {
      reels: [...eigeneVideos, ...mockVideos].filter((v) => hit(v.description) || hit(mockUsers[v.userId].name)),
      clips: clips.filter((c) => hit(c.title) || hit(mockUsers[c.userId].name)),
      posts: [...eigeneBeitraege, ...mockPosts].filter((p) => hit(p.description) || hit(mockUsers[p.userId].name)),
      people: Object.values(mockUsers).filter((u) => u.id !== 'me' && (hit(u.name) || hit(u.handle))),
      tags: mockHashtags.filter((h) => hit(h.tag)),
      places: mockPlaces.filter((p) => hit(p.name)),
      sounds: mockSounds.filter((s) => hit(s.title) || hit(s.artist)),
    };
  }, [query, clips, eigeneBeitraege, eigeneVideos]);

  const result = useMemo(() => {
    if (filterArt === 'alle') return allResults;
    return { [filterArt]: allResults[filterArt as keyof typeof allResults] };
  }, [allResults, filterArt]);

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
            <Section title="Reels" onTitlePress={() => onOpenExplorer({ art: 'reels', wert: '' })}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reelRow}>
                {result.reels.map((v) => (
                  <Druck key={v.id} style={styles.reel} onPress={() => onNotice('Reel öffnet im Hochformat')}>
                    <Motiv id={v.id} icon="phone-portrait-outline" iconSize={26} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
                    <Text style={styles.reelName}>{mockUsers[v.userId].name}</Text>
                  </Druck>
                ))}
              </ScrollView>
            </Section>
          )}

          {result.clips.length > 0 && (
            <Section title="Querformat" onTitlePress={() => onOpenExplorer({ art: 'querformat', wert: '' })}>
              {result.clips.map((c) => (
                <Row
                  key={c.id}
                  id={c.id}
                  icon="tv-outline"
                  title={c.title}
                  sub={`${mockUsers[c.userId].name} · ${c.duration}`}
                  onPress={() => onNotice('Video öffnet im Querformat')}
                />
              ))}
            </Section>
          )}

          {result.posts.length > 0 && (
            <Section title="Beiträge" onTitlePress={() => onOpenExplorer({ art: 'beitraege', wert: '' })}>
              <View style={styles.grid}>
                {result.posts.map((p) => (
                  <Druck key={p.id} style={[styles.gridItem, { height: kachelHoehe }]} onPress={() => onNotice('Beitrag öffnet im Feed')}>
                    <Motiv id={p.id} icon="image-outline" iconSize={20} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
                  </Druck>
                ))}
              </View>
            </Section>
          )}

          {result.people.length > 0 && (
            <Section title="Profile" onTitlePress={() => onOpenExplorer({ art: 'profile', wert: '' })}>
              {result.people.map((u) => (
                <Druck key={u.id} style={styles.row} onPress={() => onOpenProfile(u.id)}>
                  <Avatar id={u.id} name={u.name} size={44} />
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{u.name}</Text>
                    <Text style={styles.rowSub}>{u.handle}</Text>
                  </View>
                </Druck>
              ))}
            </Section>
          )}

          {result.tags.length > 0 && (
            <Section title="# Hashtags" onTitlePress={() => onOpenExplorer({ art: 'hashtag', wert: '#' })}>
              <View style={styles.tags}>
                {result.tags.map((h) => (
                  <Druck key={h.tag} style={styles.tag} onPress={() => onOpenExplorer({ art: 'hashtag', wert: h.tag })}>
                    <Text style={styles.tagText}>
                      {h.tag} · {compact(h.posts)}
                    </Text>
                  </Druck>
                ))}
              </View>
            </Section>
          )}

          {result.places.length > 0 && (
            <Section title="Standorte" onTitlePress={() => onOpenExplorer({ art: 'standort', wert: '' })}>
              {result.places.map((p) => (
                <Row
                  key={p.id}
                  icon="location-outline"
                  title={p.name}
                  sub={`${compact(p.posts)} Beiträge`}
                  onPress={() => onOpenExplorer({ art: 'standort', wert: p.id })}
                />
              ))}
            </Section>
          )}

          {result.sounds.length > 0 && (
            <Section title="Sounds" onTitlePress={() => onOpenExplorer({ art: 'sound', wert: '' })}>
              {result.sounds.map((s) => {
                const sound = s as any;
                return (
                  <Row
                    key={sound.id}
                    icon="musical-notes-outline"
                    title={sound.title}
                    sub={`${sound.artist} · ${compact(sound.uses)} Videos`}
                    onPress={() => onOpenExplorer({ art: 'sound', wert: sound.id })}
                  />
                );
              })}
            </Section>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = themenStyles((colors) => ({
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
  sectionHeadPress: {
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
    overflow: 'hidden',
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
    overflow: 'hidden',
  },
  rowThumbKategorie: { backgroundColor: colors.brandSoft },
  rowText: { flex: 1 },
  rowTitle: { ...typography.message, fontWeight: '600', color: colors.text },
  rowSub: { ...typography.small, color: colors.text3, marginTop: 2 },
  /* 3 × 33 % plus zwei Lücken von je 2px sind breiter als die Zeile - das
     dritte Feld rutscht um. Abstand deshalb über einen Rand in
     Hintergrundfarbe, dann bleibt die Breite exakt ein Drittel. */
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: {
    width: '33.333%',
    borderWidth: 1,
    borderColor: colors.surface,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
  },
  tagText: { ...typography.small, color: colors.brand, fontWeight: '600' },
}));
