import React, { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { avatarColor, colors, radius, sizes, spacing, typography } from '../../constants/design';
import { mockProfiles, mockUsers } from '../../mocks';
import { useProfil } from '../../contexts/ProfilContext';
import { ProfilOptionenSheet } from '../../components/ProfilOptionenSheet';

type Tab = 'grid' | 'repost' | 'tagged';

const GRID_KINDS: ('image' | 'video')[] = [
  'image', 'video', 'image', 'video', 'image', 'image',
  'video', 'image', 'video', 'image', 'video', 'image',
];

const compactNumber = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} Mio.`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')}k`;
  return String(n);
};

interface Props {
  userId: string;
  onBack: () => void;
  onMessage: (userId: string) => void;
  /** Beim Blockieren: die Person aus den Kontakten nehmen. */
  onBlockiert?: (userId: string, blockiert: boolean) => void;
  onNotice: (message: string) => void;
}

export const UserProfileScreen = ({ userId, onBack, onMessage, onBlockiert, onNotice }: Props) => {
  const { istStumm, istBlockiert } = useProfil();
  const [optionenOffen, setOptionenOffen] = useState(false);
  const person = mockUsers[userId];
  const [profile, setProfile] = useState(mockProfiles[userId]);
  const [tab, setTab] = useState<Tab>('grid');

  if (!person || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState icon="person-outline" title="Profil nicht verfügbar" />
      </SafeAreaView>
    );
  }

  const toggleFollow = () => {
    setProfile((prev) => ({
      ...prev,
      isFollowing: !prev.isFollowing,
      followers: prev.followers + (prev.isFollowing ? -1 : 1),
    }));
    onNotice(profile.isFollowing ? `${person.name} nicht mehr gefolgt` : `Du folgst ${person.name}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={onBack} hitSlop={6}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.handle}>{person.handle}</Text>
        <Pressable onPress={() => setOptionenOffen(true)} hitSlop={6}>
          <Ionicons name="information-circle-outline" size={22} color={colors.text2} />
        </Pressable>
      </View>

      <ScrollView>
        <View style={styles.top}>
          <View style={styles.ring}>
            <Avatar id={userId} name={person.name} size={82} />
          </View>
          <View style={styles.stats}>
            {[
              { value: profile.posts, label: 'Beiträge' },
              { value: profile.followers, label: 'Follower' },
              { value: profile.following, label: 'Gefolgt' },
            ].map((stat) => (
              <View key={stat.label} style={styles.stat}>
                <Text style={styles.statValue}>{compactNumber(stat.value)}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.about}>
          <Text style={styles.name}>{person.name}</Text>
          <Text style={styles.bio}>{profile.bio}</Text>
          <Pressable onPress={() => onNotice(profile.link)}>
            <Text style={styles.link}>{profile.link}</Text>
          </Pressable>
        </View>

        {istBlockiert(userId) ? (
          <View style={styles.hinweis}>
            <Ionicons name="ban-outline" size={17} color={colors.text2} />
            <Text style={styles.hinweisText}>
              {person.name} ist blockiert. Ihr könnt euch keine Nachrichten schreiben.
            </Text>
          </View>
        ) : istStumm(userId) ? (
          <View style={styles.hinweis}>
            <Ionicons name="volume-mute-outline" size={17} color={colors.text2} />
            <Text style={styles.hinweisText}>{person.name} ist stummgeschaltet.</Text>
          </View>
        ) : null}

        <View style={styles.buttons}>
          <Pressable
            style={[styles.button, !profile.isFollowing && styles.buttonPrimary]}
            onPress={toggleFollow}
          >
            <Text style={[styles.buttonText, !profile.isFollowing && styles.buttonTextPrimary]}>
              {profile.isFollowing ? 'Gefolgt' : 'Folgen'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.button, istBlockiert(userId) && styles.buttonAus]}
            disabled={istBlockiert(userId)}
            onPress={() => onMessage(userId)}
          >
            <Text style={styles.buttonText}>Nachricht</Text>
          </Pressable>
        </View>

        {profile.highlights.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlights}>
            {profile.highlights.map((highlight) => (
              <View key={highlight} style={styles.highlight}>
                <View style={styles.highlightRing}>
                  <View style={[styles.highlightInner, { backgroundColor: avatarColor(userId) }]}>
                    <Text style={styles.highlightText}>{highlight.slice(0, 2).toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.highlightLabel} numberOfLines={1}>
                  {highlight}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.tabs}>
          {([
            { key: 'grid', icon: 'grid-outline' },
            { key: 'repost', icon: 'repeat' },
            { key: 'tagged', icon: 'person-outline' },
          ] as { key: Tab; icon: React.ComponentProps<typeof Ionicons>['name'] }[]).map((item) => (
            <Pressable
              key={item.key}
              style={[styles.tab, tab === item.key && styles.tabActive]}
              onPress={() => setTab(item.key)}
            >
              <Ionicons
                name={item.icon}
                size={22}
                color={tab === item.key ? colors.text : colors.text3}
              />
            </Pressable>
          ))}
        </View>

        {tab === 'grid' ? (
          <View style={styles.grid}>
            {GRID_KINDS.map((kind, index) => (
              <View key={index} style={styles.gridItem}>
                <Ionicons name="image-outline" size={26} color={colors.text3} />
                {kind === 'video' && (
                  <View style={styles.gridBadge}>
                    <Ionicons name="play" size={13} color={colors.white} />
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            icon={tab === 'repost' ? 'repeat' : 'person-outline'}
            title={tab === 'repost' ? 'Keine Reposts' : 'Keine Markierungen'}
            text="Hier ist noch nichts."
          />
        )}
      </ScrollView>

      <ProfilOptionenSheet
        visible={optionenOffen}
        userId={userId}
        onClose={() => setOptionenOffen(false)}
        onNotice={onNotice}
        onBlockiert={onBlockiert}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  back: { width: 30, alignItems: 'center' },
  handle: { flex: 1, color: colors.text, ...typography.h3 },

  top: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: spacing.lg, paddingTop: 18, paddingBottom: 12 },
  ring: { padding: 3, borderRadius: 47, borderWidth: 2.5, borderColor: colors.brand },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 2 },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '700' },
  statLabel: { color: colors.text2, ...typography.preview },

  about: { paddingHorizontal: spacing.lg, paddingBottom: 12 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  bio: { marginTop: 3, color: colors.text, ...typography.message, lineHeight: 20 },
  link: { marginTop: 4, color: colors.brand, ...typography.message },

  buttons: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: 14 },
  button: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: colors.brand },
  buttonText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  buttonTextPrimary: { color: colors.white },

  highlights: { gap: 14, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  highlight: { width: sizes.storyRing, alignItems: 'center' },
  highlightRing: {
    width: sizes.storyRing,
    height: sizes.storyRing,
    borderRadius: sizes.storyRing / 2,
    borderWidth: 2.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightInner: {
    width: sizes.storyRing - 11,
    height: sizes.storyRing - 11,
    borderRadius: (sizes.storyRing - 11) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  highlightLabel: { marginTop: 6, color: colors.text2, fontSize: 11.5 },

  hinweis: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  hinweisText: { flex: 1, ...typography.preview, color: colors.text2 },
  buttonAus: { opacity: 0.45 },

  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  tab: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.text },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: {
    width: '33.333%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: colors.surface,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridBadge: { position: 'absolute', top: 6, right: 6 },
});
