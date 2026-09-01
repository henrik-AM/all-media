import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, LayoutChangeEvent, StyleSheet, Text, View, RefreshControl, ViewToken } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useReposts } from '../../contexts/RepostContext';
import { Avatar } from '../../components/Avatar';
import { CommentSheet } from '../../components/CommentSheet';
import { colors, radius, sizes, spacing, themenStyles, typography } from '../../constants/design';
import { useDaten } from '../../contexts/DatenContext';
import { useProfil } from '../../contexts/ProfilContext';
import { Video } from '../../types';
import { compactNumber } from '../../lib/zahlen';
import { haptic } from '../../lib/haptics';
import { Videoflaeche } from '../../components/Videoflaeche';

interface Props {
  onOpenProfile: (userId: string) => void;
  /** Oeffnet das Teilen-Blatt mit dem Personen-Raster. */
  onShare: (video: Video) => void;
  onNotice: (message: string) => void;
}

export const VideoFeedScreen = ({ onOpenProfile, onShare, onNotice }: Props) => {
  const { users: alleNutzer, videos: alleVideos } = useDaten();
  const { istRepostet, umschalten } = useReposts();
  // Eigene Reels stehen oben im Feed.
  const { eigeneVideos, geteiltZaehler } = useProfil();
  const [videos, setVideos] = useState<Video[]>(alleVideos);

  // Nachziehen, sobald die Videos aus der Datenbank da sind — der
  // Anfangswert von useState gilt nur beim ersten Aufbau, und da ist die
  // Liste noch leer. Siehe HomeFeedScreen.
  useEffect(() => {
    setVideos(alleVideos);
  }, [alleVideos]);

  // Wie im Bild-Feed: eigene Reels kommen in dieselbe Liste, damit Like,
  // Speichern und Repost auch bei ihnen wirken.
  useEffect(() => {
    setVideos((prev) => {
      const neue = eigeneVideos.filter((v) => !prev.some((x) => x.id === v.id));
      return neue.length ? [...neue, ...prev] : prev;
    });
  }, [eigeneVideos]);
  // Wem man folgt - nach Personen-Kennung, damit es beim Blaettern bleibt.
  const [gefolgt, setGefolgt] = useState<Record<string, boolean>>({});
  const [slideHeight, setSlideHeight] = useState(0);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  /*
   * Welches Reel gerade zu sehen ist — nur dieses eine laeuft. Wuerden alle
   * gleichzeitig spielen, laedt das Geraet ein Dutzend Videos auf einmal und
   * man hoert sie uebereinander.
   */
  const [sichtbar, setSichtbar] = useState<string | null>(null);
  /* Angehalten durch Antippen. Beim Weiterwischen faengt das naechste an. */
  const [pause, setPause] = useState(false);
  /*
   * Ton. Ein Kanal, der beim Oeffnen der App losplaerrt, ist unhoeflich —
   * deshalb faengt er stumm an, wie in jeder anderen App auch, und der
   * Lautsprecherknopf ueber der Leiste schaltet ihn an.
   */
  const [stumm, setStumm] = useState(true);

  const sichtbarkeit = useRef({ itemVisiblePercentThreshold: 60 });
  const sichtbarWechsel = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const erstes = viewableItems[0]?.item as Video | undefined;
    if (erstes) {
      setSichtbar(erstes.id);
      setPause(false);
    }
  }, []);

  // Beim ersten Aufbau ist noch nichts gescrollt, also meldet die Liste auch
  // nichts — ohne diese Zeile bliebe das oberste Reel stehen.
  useEffect(() => {
    if (!sichtbar && videos.length) setSichtbar(videos[0].id);
  }, [sichtbar, videos]);

  const measure = (event: LayoutChangeEvent) => setSlideHeight(event.nativeEvent.layout.height);

  const onRefresh = async () => {
    setIsRefreshing(true);
    haptic.light();
    await new Promise((resolve) => setTimeout(resolve, 800));
    setVideos((prev) => [...alleVideos, ...prev]);
    setIsRefreshing(false);
  };

  const update = (id: string, change: (video: Video) => Video) =>
    setVideos((prev) => prev.map((v) => (v.id === id ? change(v) : v)));

  const toggleLike = async (video: Video) => {
    haptic.impact('medium');
    update(video.id, (v) => ({ ...v, liked: !v.liked, likes: v.likes + (v.liked ? -1 : 1) }));
  };

  const toggleSave = async (video: Video) => {
    haptic.light();
    update(video.id, (v) => ({ ...v, saved: !v.saved }));
    onNotice(video.saved ? 'Nicht mehr gespeichert' : 'Gespeichert');
  };

  const toggleNotify = (video: Video) => {
    haptic.light();
    update(video.id, (v) => ({ ...v, notify: !v.notify }));
    onNotice(video.notify ? 'Benachrichtigungen aus' : 'Benachrichtigungen an');
  };

  const toggleRepost = async (video: Video) => {
    haptic.selection();
    const jetztAn = umschalten('video', video.id, video.description);
    update(video.id, (v) => ({
      ...v,
      reposted: jetztAn,
      shares: v.shares + (jetztAn ? 1 : -1),
    }));
    onNotice(jetztAn ? 'Repostet' : 'Repost zurückgenommen');
  };

  const share = (video: Video) => {
    // Zaehlt erst hoch, wenn wirklich jemand ausgewaehlt wurde - das
    // uebernimmt der Aufrufer nach dem Senden.
    onShare(video);
  };

  const renderVideo = ({ item }: { item: Video }) => {
    const author = alleNutzer[item.userId];

    return (
      <View style={[styles.slide, slideHeight > 0 && { height: slideHeight }]}>
        <Druck style={styles.stage} onPress={() => setPause((p) => !p)}>
          <Videoflaeche
            id={item.id}
            quelle={item.mediaUri}
            standbild={item.standbild}
            laeuft={sichtbar === item.id && !pause}
            stumm={stumm}
            /* Reels laufen in Schleife — wie im Prototyp und ueberall sonst. */
            schleife
            fuellen="cover"
            icon="play-outline"
            iconSize={72}
            dunkel
            style={styles.stageBild}
          />
          {pause && sichtbar === item.id && (
            <View style={styles.pauseZeichen} pointerEvents="none">
              <Ionicons name="play" size={64} color="rgba(255,255,255,0.85)" />
            </View>
          )}
        </Druck>

        <Druck
          style={styles.tonKnopf}
          onPress={() => setStumm((t) => !t)}
          hitSlop={10}
          accessibilityLabel={stumm ? 'Ton an' : 'Ton aus'}
        >
          <Ionicons name={stumm ? 'volume-mute' : 'volume-high'} size={20} color={colors.white} />
        </Druck>

        <View style={styles.rail}>
          <Druck style={styles.railBtn} onPress={() => toggleLike(item)}>
            <Ionicons
              name={item.liked ? 'heart' : 'heart-outline'}
              size={28}
              color={item.liked ? '#FF4D6D' : colors.white}
            />
            <Text style={styles.railLabel} numberOfLines={1}>{compactNumber(item.likes)}</Text>
          </Druck>

          <Druck style={styles.railBtn} onPress={() => { haptic.light(); setCommentsFor(item.id); }}>
            <Ionicons name="chatbubble-outline" size={26} color={colors.white} />
            <Text style={styles.railLabel} numberOfLines={1}>{compactNumber(item.comments)}</Text>
          </Druck>

          <Druck style={styles.railBtn} onPress={() => share(item)}>
            <Ionicons name="paper-plane-outline" size={26} color={colors.white} />
            <Text style={styles.railLabel} numberOfLines={1}>{compactNumber(item.shares + (geteiltZaehler[item.id] ?? 0))}</Text>
          </Druck>

          <Druck style={styles.railBtn} onPress={() => toggleRepost(item)}>
            <Ionicons
              name="repeat"
              size={28}
              color={istRepostet('video', item.id) ? colors.success : colors.white}
            />
            <Text style={styles.railLabel} numberOfLines={1}>
              {istRepostet('video', item.id) ? 'Repostet' : 'Repost'}
            </Text>
          </Druck>

          <Druck style={styles.railBtn} onPress={() => toggleSave(item)}>
            <Ionicons
              name={item.saved ? 'bookmark' : 'bookmark-outline'}
              size={25}
              color={colors.white}
            />
            <Text style={styles.railLabel} numberOfLines={1}>{item.saved ? 'Gespeichert' : 'Speichern'}</Text>
          </Druck>
        </View>

        <View style={styles.meta}>
          <View style={styles.author}>
            <Druck style={styles.authorTap} onPress={() => onOpenProfile(item.userId)}>
              <Avatar id={item.userId} name={author?.name ?? ''} size={sizes.avatarSm} />
              <Text style={styles.authorName}>{author?.name}</Text>
            </Druck>
            <Druck
              style={[styles.follow, gefolgt[item.userId] && styles.followAn]}
              onPress={() => {
                const jetzt = !gefolgt[item.userId];
                setGefolgt((prev) => ({ ...prev, [item.userId]: jetzt }));
                onNotice(
                  jetzt ? `Du folgst ${author?.name}` : `${author?.name} nicht mehr gefolgt`
                );
              }}
            >
              <Text style={styles.followText}>
                {gefolgt[item.userId] ? 'Gefolgt' : 'Folgen'}
              </Text>
            </Druck>
            <Druck style={styles.bell} onPress={() => toggleNotify(item)} hitSlop={6}>
              <View style={{ position: 'relative' }}>
                <Ionicons
                  name="notifications"
                  size={19}
                  color={item.notify ? colors.brand : colors.text2}
                />
                {!item.notify && <View style={styles.bellStrike} />}
              </View>
            </Druck>
          </View>
          <Text style={styles.description}>{item.description}</Text>
          <View style={styles.subRow}>
            {item.location && (
              <Druck onPress={() => onNotice(`Standort: ${item.location}`)} hitSlop={4}>
                <Text style={styles.sub}>{item.location}</Text>
              </Druck>
            )}
            {item.music && (
              <>
                {item.location && <Text style={styles.sub}> · </Text>}
                <Druck onPress={() => onNotice(`Music: ${item.music}`)} hitSlop={4}>
                  <Text style={styles.sub}>{item.music}</Text>
                </Druck>
              </>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container} onLayout={measure}>
      <FlatList
        data={videos}
        renderItem={renderVideo}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        onViewableItemsChanged={sichtbarWechsel}
        viewabilityConfig={sichtbarkeit.current}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      />

      <CommentSheet
        targetId={commentsFor}
        onClose={() => setCommentsFor(null)}
        onCountChange={(id, count) => update(id, (v) => ({ ...v, comments: count }))}
      />
    </View>
  );
};

const styles = themenStyles((colors) => ({
  followAn: { backgroundColor: 'rgba(255,255,255,0.22)', borderColor: 'transparent' },
  bell: { width: 30, alignItems: 'center' },
  bellStrike: { position: 'absolute', top: '50%', left: '50%', width: 22, height: 2, backgroundColor: colors.text2, transform: [{ translateX: -11 }, { translateY: -1 }, { rotate: '-20deg' }] },

  container: { flex: 1, backgroundColor: colors.black },
  slide: { width: '100%', justifyContent: 'flex-end' },
  stageBild: { width: '100%', height: '100%' },
  pauseZeichen: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  tonKnopf: {
    position: 'absolute', top: spacing.xl + 12, right: spacing.md,
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  stage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#12161B',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /*
   * Feste Breite. Henrik am 26.08.2026: "Like speichern → Spalte mit
   * Like/Kommentar/Teilen/Repost/Speichern verschiebt sich nach links."
   *
   * Der Grund war die Breite der Beschriftungen: aus "Repost" wird
   * "Repostet", aus "Speichern" wird "Gespeichert", aus "999" wird "1k". Ohne
   * feste Breite war die Spalte nur so breit wie ihr breitester Eintrag und
   * rechts verankert - wurde ein Wort laenger, wuchs sie nach links und alle
   * fuenf Symbole sprangen mit. Dieselbe Aenderung steht in der Website unter
   * .slide__rail.
   */
  rail: { position: 'absolute', right: 10, bottom: 96, width: 62, alignItems: 'center', gap: 18 },
  railBtn: { width: '100%', alignItems: 'center', gap: 4 },
  railLabel: { color: colors.white, fontSize: 11, fontWeight: '600' },

  meta: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, paddingRight: 78 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: spacing.sm },
  authorTap: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  authorName: { color: colors.white, fontSize: 14.5, fontWeight: '700' },
  follow: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  followText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  description: { color: colors.white, ...typography.message, lineHeight: 20 },
  subRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  sub: { marginTop: 6, color: 'rgba(255,255,255,0.75)', ...typography.small },
}));
