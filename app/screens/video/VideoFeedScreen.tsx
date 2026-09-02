import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  ViewToken,
} from 'react-native';
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
import { Videoflaeche, VideoSteuerung } from '../../components/Videoflaeche';
import { useAktionen } from '../../lib/useAktionen';

interface Props {
  onOpenProfile: (userId: string) => void;
  /** Oeffnet das Teilen-Blatt mit dem Personen-Raster. */
  onShare: (video: Video) => void;
  onNotice: (message: string) => void;
}

export const VideoFeedScreen = ({ onOpenProfile, onShare, onNotice }: Props) => {
  const { users: alleNutzer, videos: alleVideos } = useDaten();
  const { istRepostet, umschalten } = useReposts();
  // Schreibt wirklich in die Datenbank — siehe lib/useAktionen.ts.
  const aktion = useAktionen(onNotice);
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
   * Die beiden Gesten aus dem Handbuch, plus die von Henrik gewuenschte
   * dritte:
   *
   *   in die Mitte tippen        -> pausieren        (war schon da)
   *   rechte Haelfte halten      -> Geschwindigkeit x2
   *   doppelt tippen             -> Like
   *
   * Alle drei haengen an derselben Flaeche, deshalb steht die Unterscheidung
   * hier und nicht in drei uebereinandergelegten Schaltflaechen. Uebereinander
   * gelegt wuerde die oberste alle Beruehrungen schlucken, und die beiden
   * darunter waeren tot.
   */
  const spieler = useRef<Record<string, VideoSteuerung | null>>({});
  const letzterTipp = useRef(0);
  const tippZeitgeber = useRef<ReturnType<typeof setTimeout> | null>(null);
  const halten = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [schnell, setSchnell] = useState(false);
  /** Das Herz, das beim Doppeltipp kurz aufblitzt. */
  const herz = useRef(new Animated.Value(0)).current;

  const herzZeigen = useCallback(() => {
    herz.setValue(0);
    Animated.sequence([
      Animated.spring(herz, { toValue: 1, useNativeDriver: true, friction: 4 }),
      Animated.timing(herz, { toValue: 0, duration: 260, delay: 320, useNativeDriver: true }),
    ]).start();
  }, [herz]);
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

  /*
   * Wie im Bild-Feed: erst umschalten, dann schreiben, bei einem Fehler
   * zurueckstellen. Vorher blieb es beim Umschalten — das Herz war rot, die
   * Datenbank wusste nichts davon.
   */
  const toggleLike = async (video: Video) => {
    haptic.impact('medium');
    const zurueck = () =>
      update(video.id, (v) => ({ ...v, liked: video.liked, likes: video.likes }));
    update(video.id, (v) => ({ ...v, liked: !v.liked, likes: v.likes + (v.liked ? -1 : 1) }));
    aktion.like(video.id, zurueck);
  };

  const toggleSave = async (video: Video) => {
    haptic.light();
    const zurueck = () => update(video.id, (v) => ({ ...v, saved: video.saved }));
    update(video.id, (v) => ({ ...v, saved: !v.saved }));
    onNotice(video.saved ? 'Nicht mehr gespeichert' : 'Gespeichert');
    aktion.speichern(video.id, zurueck);
  };

  const toggleNotify = (video: Video) => {
    haptic.light();
    update(video.id, (v) => ({ ...v, notify: !v.notify }));
    onNotice(video.notify ? 'Benachrichtigungen aus' : 'Benachrichtigungen an');
    aktion.hinweis(video.id, () => update(video.id, (v) => ({ ...v, notify: video.notify })));
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
    aktion.repost(video.id, () => {
      umschalten('video', video.id, video.description);
      update(video.id, (v) => ({ ...v, reposted: video.reposted, shares: video.shares }));
    });
  };

  const share = (video: Video) => {
    // Zaehlt erst hoch, wenn wirklich jemand ausgewaehlt wurde - das
    // uebernimmt der Aufrufer nach dem Senden.
    onShare(video);
  };

  /**
   * Ein Tipp auf die Flaeche.
   *
   * Zwei Tipps kurz hintereinander sind ein Like, ein einzelner pausiert.
   * Deshalb wartet der einzelne Tipp 260 ms ab: kommt in der Zeit ein
   * zweiter, war es keiner. Ohne diese Wartezeit wuerde jeder Doppeltipp
   * nebenbei auch pausieren.
   */
  const flaecheGetippt = (item: Video) => {
    const jetzt = Date.now();
    if (jetzt - letzterTipp.current < 260) {
      letzterTipp.current = 0;
      if (tippZeitgeber.current) clearTimeout(tippZeitgeber.current);
      tippZeitgeber.current = null;

      // Doppeltipp likt, nimmt aber nie weg. Wer versehentlich zweimal
      // tippt, soll nicht sein Like verlieren — auf Instagram und TikTok
      // ist es genauso.
      herzZeigen();
      if (!item.liked) toggleLike(item);
      else haptic.impact('light');
      return;
    }

    letzterTipp.current = jetzt;
    tippZeitgeber.current = setTimeout(() => {
      setPause((p) => !p);
      tippZeitgeber.current = null;
    }, 260);
  };

  /**
   * Gedrueckt halten auf der rechten Haelfte: Geschwindigkeit x2.
   *
   * Die Grenze liegt bei der halben Bildschirmbreite. Sie am Bildschirm zu
   * messen statt an der Flaeche ist genau genug — das Reel fuellt die volle
   * Breite.
   */
  const gedruecktAb = (item: Video) => (e: GestureResponderEvent) => {
    const rechts = e.nativeEvent.pageX > Dimensions.get('window').width / 2;
    if (!rechts) return;

    halten.current = setTimeout(() => {
      setSchnell(true);
      haptic.impact('light');
      spieler.current[item.id]?.tempo(2);
    }, 250);
  };

  const losgelassen = (item: Video) => () => {
    if (halten.current) {
      clearTimeout(halten.current);
      halten.current = null;
    }
    if (schnell) {
      setSchnell(false);
      spieler.current[item.id]?.tempo(1);
    }
  };

  const renderVideo = ({ item }: { item: Video }) => {
    const author = alleNutzer[item.userId];

    return (
      <View style={[styles.slide, slideHeight > 0 && { height: slideHeight }]}>
        <Pressable
          style={styles.stage}
          onPress={() => flaecheGetippt(item)}
          onPressIn={gedruecktAb(item)}
          onPressOut={losgelassen(item)}
        >
          <Videoflaeche
            ref={(r) => {
              spieler.current[item.id] = r;
            }}
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

          {/* Das Herz beim Doppeltipp. Ohne diese Rueckmeldung waere nicht zu
              erkennen, ob der zweite Tipp angekommen ist — die Zahl an der
              Seite ist zu klein und zu weit weg. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.herz,
              { opacity: herz, transform: [{ scale: herz.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.15] }) }] },
            ]}
          >
            <Ionicons name="heart" size={96} color="rgba(255,77,109,0.92)" />
          </Animated.View>

          {/* Solange x2 laeuft, muss es dastehen. Sonst wirkt das Video
              kaputt: der Ton ist zu hoch und niemand weiss warum. */}
          {schnell && sichtbar === item.id && (
            <View style={styles.tempoMarke} pointerEvents="none">
              <Ionicons name="play-forward" size={14} color={colors.white} />
              <Text style={styles.tempoText}>2×</Text>
            </View>
          )}
        </Pressable>

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
        onNotice={onNotice}
        targetId={commentsFor}
        onClose={() => setCommentsFor(null)}
        onCountChange={(id, count) => update(id, (v) => ({ ...v, comments: count }))}
      />
    </View>
  );
};

const styles = themenStyles((colors) => ({
  herz: { position: 'absolute', alignSelf: 'center', top: '38%' },
  tempoMarke: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  tempoText: { ...typography.small, color: colors.white, fontWeight: '700' },

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
