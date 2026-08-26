import React, { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { CommentSheet } from '../../components/CommentSheet';
import { Motiv } from '../../components/Motiv';
import { StoryRail } from '../../components/StoryRail';
import { useReposts } from '../../contexts/RepostContext';
import { colors, radius, sizes, spacing, typography } from '../../constants/design';
import { kommentarZeile } from '../../lib/kommentare';
import { mockPosts, mockUsers } from '../../mocks';
import { useProfil } from '../../contexts/ProfilContext';
import { Post, Story } from '../../types';

const compactNumber = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} Mio.`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')}k`;
  return String(n);
};

interface Props {
  stories: Story[];
  onOpenStory: (story: Story) => void;
  onOpenProfile: (userId: string) => void;
  /** Oeffnet das Teilen-Blatt mit dem Personen-Raster. */
  onShare: (post: Post) => void;
  onNotice: (message: string) => void;
}

export const HomeFeedScreen = ({ stories, onOpenStory, onOpenProfile, onShare, onNotice }: Props) => {
  const { istRepostet, umschalten } = useReposts();
  // Eigene Beitraege stehen oben - sie kommen aus dem gemeinsamen Zustand,
  // damit sie auch im Profilraster auftauchen.
  const { eigeneBeitraege, folgtPerson, folgenUmschalten } = useProfil();
  const [posts, setPosts] = useState<Post[]>(mockPosts);

  // Neue eigene Beitraege wandern in dieselbe Liste wie alle anderen. Sonst
  // wuerden Like, Speichern und Repost bei ihnen nichts tun - sie waeren
  // dann naemlich gar nicht im Zustand, den diese Knoepfe aendern.
  useEffect(() => {
    setPosts((prev) => {
      const neue = eigeneBeitraege.filter((p) => !prev.some((x) => x.id === p.id));
      return neue.length ? [...neue, ...prev] : prev;
    });
  }, [eigeneBeitraege]);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);

  const update = (id: string, change: (post: Post) => Post) =>
    setPosts((prev) => prev.map((p) => (p.id === id ? change(p) : p)));

  const toggleLike = (post: Post) =>
    update(post.id, (p) => ({ ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) }));

  const toggleSave = (post: Post) => {
    update(post.id, (p) => ({ ...p, saved: !p.saved }));
    onNotice(post.saved ? 'Nicht mehr gespeichert' : 'Gespeichert');
  };

  /*
   * Folgen haengt an der Person, nicht am Beitrag - siehe ProfilContext.
   * Vorher wurde nur dieser eine Beitrag geaendert; ein zweiter Beitrag
   * derselben Person zeigte weiter "Folgen".
   */
  const toggleFollow = (post: Post) => {
    const jetztAn = folgenUmschalten(post.userId);
    onNotice(jetztAn ? 'Du folgst jetzt' : 'Nicht mehr gefolgt');
  };

  const toggleRepost = (post: Post) => {
    const jetztAn = umschalten('post', post.id, post.description);
    update(post.id, (p) => ({
      ...p,
      reposted: jetztAn,
      reposts: p.reposts + (jetztAn ? 1 : -1),
    }));
    onNotice(jetztAn ? 'Repostet' : 'Repost zurückgenommen');
  };

  const toggleNotify = (post: Post) => {
    update(post.id, (p) => ({ ...p, notify: !p.notify }));
    onNotice(post.notify ? 'Benachrichtigungen aus' : 'Benachrichtigungen an');
  };

  const renderPost = ({ item }: { item: Post }) => {
    const author = mockUsers[item.userId];

    return (
      <View style={styles.post}>
        <View style={styles.head}>
          <Druck style={styles.ring} onPress={() => onOpenProfile(item.userId)}>
            <Avatar id={item.userId} name={author?.name ?? ''} size={36} />
          </Druck>
          <Druck style={styles.who} onPress={() => onOpenProfile(item.userId)}>
            <Text style={styles.name} numberOfLines={1}>
              {author?.name}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {item.location} · {item.music}
            </Text>
          </Druck>
          <Druck
            style={[styles.follow, folgtPerson(item.userId) && styles.followActive]}
            onPress={() => toggleFollow(item)}
          >
            <Text style={[styles.followText, folgtPerson(item.userId) && styles.followTextActive]}>
              {folgtPerson(item.userId) ? 'Gefolgt' : 'Folgen'}
            </Text>
          </Druck>
          <Druck style={styles.bell} onPress={() => toggleNotify(item)} hitSlop={6}>
            <Ionicons
              name={item.notify ? 'notifications' : 'notifications-outline'}
              size={19}
              color={item.notify ? colors.brand : colors.text2}
            />
          </Druck>
        </View>

        <View style={styles.media}>
          {item.mediaUri ? (
            <Image source={{ uri: item.mediaUri }} style={styles.mediaBild} />
          ) : (
            <Motiv id={item.id} icon="image-outline" iconSize={38} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
          )}
        </View>

        <View style={styles.actions}>
          <Druck onPress={() => toggleLike(item)} hitSlop={6}>
            <Ionicons
              name={item.liked ? 'heart' : 'heart-outline'}
              size={26}
              color={item.liked ? '#FF3040' : colors.text}
            />
          </Druck>
          <Druck onPress={() => setCommentsFor(item.id)} hitSlop={6}>
            <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
          </Druck>
          <Druck onPress={() => onShare(item)} hitSlop={6}>
            <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
          </Druck>
          <Druck style={styles.repost} onPress={() => toggleRepost(item)} hitSlop={6}>
            <Ionicons
              name="repeat"
              size={26}
              color={istRepostet('post', item.id) ? colors.success : colors.text}
            />
            {item.reposts > 0 && (
              <Text style={styles.repostZahl}>{compactNumber(item.reposts)}</Text>
            )}
          </Druck>
          <Druck style={styles.actionEnd} onPress={() => toggleSave(item)} hitSlop={6}>
            <Ionicons
              name={item.saved ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color={colors.text}
            />
          </Druck>
        </View>

        <Text style={styles.likes}>
          Gefällt <Text style={styles.bold}>{item.likedBy}</Text> und{' '}
          {compactNumber(Math.max(item.likes - 1, 0))} weiteren Personen
        </Text>
        <Text style={styles.description}>
          <Text style={styles.bold}>{author?.name}</Text> {item.description}
        </Text>
        <Druck onPress={() => setCommentsFor(item.id)}>
          <Text style={styles.commentsLink}>{kommentarZeile(item.comments)}</Text>
        </Druck>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<StoryRail stories={stories} onPress={onOpenStory} />}
      />

      <CommentSheet
        targetId={commentsFor}
        onClose={() => setCommentsFor(null)}
        onCountChange={(id, count) => update(id, (p) => ({ ...p, comments: count }))}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  repost: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  repostZahl: { color: colors.success, fontSize: 12.5, fontWeight: '600' },

  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: 14, paddingBottom: 10 },
  title: { color: colors.text, ...typography.title },

  post: { paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },

  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  ring: { padding: 2, borderRadius: 22, borderWidth: 2, borderColor: colors.brand },
  who: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontSize: 14, fontWeight: '700' },
  sub: { marginTop: 1, color: colors.text2, fontSize: 11.5 },
  follow: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.brand },
  followActive: { backgroundColor: colors.surface3 },
  followText: { color: colors.white, fontSize: 12.5, fontWeight: '600' },
  followTextActive: { color: colors.text2 },
  bell: { width: 30, alignItems: 'center' },

  media: { aspectRatio: 1, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mediaBild: { width: '100%', height: '100%' },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: spacing.lg, paddingTop: 10, paddingBottom: 6 },
  actionEnd: { marginLeft: 'auto' },

  likes: { paddingHorizontal: spacing.lg, color: colors.text, ...typography.preview },
  description: { paddingHorizontal: spacing.lg, paddingTop: 5, color: colors.text, ...typography.message, lineHeight: 20 },
  bold: { fontWeight: '700' },
  commentsLink: { paddingHorizontal: spacing.lg, paddingTop: 6, color: colors.text3, ...typography.preview },
});
