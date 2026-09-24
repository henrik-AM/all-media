import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Glocke } from '../../components/Glocke';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useReposts } from '../../contexts/RepostContext';
import { Avatar } from '../../components/Avatar';
import { CommentSheet } from '../../components/CommentSheet';
import { BeitragOptionenSheet, OptionenBeitrag } from '../../components/BeitragOptionenSheet';
import { colors, radius, sizes, spacing, themenStyles, typography } from '../../constants/design';
import { useDaten } from '../../contexts/DatenContext';
import { useProfil } from '../../contexts/ProfilContext';
import { useEinstellungen } from '../../contexts/EinstellungenContext';
import { Video } from '../../types';
import { compactNumber } from '../../lib/zahlen';
import { haptic } from '../../lib/haptics';
import { Videoflaeche, VideoSteuerung } from '../../components/Videoflaeche';
import { useAktionen } from '../../lib/useAktionen';
import { useImpressionen } from '../../lib/useImpressionen';
import { useZielOeffnen } from '../../lib/ziele';
import type { ExplorerZiel } from '../videos/ExplorerScreen';

interface Props {
  onOpenProfile: (userId: string) => void;
  /** Oeffnet das Teilen-Blatt mit dem Personen-Raster. */
  onShare: (video: Video) => void;
  /**
   * Kennung des Reels, bei dem der Feed aufgehen soll — der Weg aus dem
   * Profilraster hierher. Gleiche Regel wie in HomeFeedScreen.
   */
  startBei?: string | null;
  onStartErreicht?: () => void;
  onNotice: (message: string) => void;
  /** Ort und Sound am Beitrag fuehren auf ihre Seite (lib/ziele.ts). */
  onOpenExplorer?: (ziel: ExplorerZiel) => void;
}

export const VideoFeedScreen = ({
  onOpenProfile,
  onShare,
  startBei,
  onStartErreicht,
  onNotice,
  onOpenExplorer,
}: Props) => {
  const ziel = useZielOeffnen(onOpenExplorer, onNotice);
  const { users: alleNutzer, videos: alleVideos, keinInteresse } = useDaten();
  const { istRepostet, umschalten } = useReposts();
  // Schreibt wirklich in die Datenbank — siehe lib/useAktionen.ts.
  const aktion = useAktionen(onNotice);
  // Eigene Reels stehen oben im Feed.
  const { eigeneVideos, geteiltZaehler, folgtPerson, folgenUmschalten } = useProfil();
  const [videos, setVideos] = useState<Video[]>(alleVideos);

  // Nachziehen, sobald die Videos aus der Datenbank da sind — der
  // Anfangswert von useState gilt nur beim ersten Aufbau, und da ist die
  // Liste noch leer. Siehe HomeFeedScreen.
  useEffect(() => {
    setVideos(alleVideos);
  }, [alleVideos]);

  /*
   * An das Reel springen, das die Kachel im Profil gemeint hat. Siehe
   * HomeFeedScreen — dort steht, warum der Wunsch danach geloescht wird.
   */
  const liste = useRef<FlatList<Video>>(null);

  /*
   * "Kein Interesse" aus dem Drei-Punkte-Menue (Schema 55) faellt aus dem
   * Feed - ausser man kommt ueber genau diesen Beitrag aus dem Profil.
   */
  const sichtbareVideos = useMemo(
    () => videos.filter((v) => v.id === startBei || !keinInteresse.includes(v.id)),
    [videos, keinInteresse, startBei]
  );

  useEffect(() => {
    if (!startBei) return;
    const platz = sichtbareVideos.findIndex((v) => v.id === startBei);
    if (platz < 0) return;
    liste.current?.scrollToIndex({ index: platz, animated: false });
    onStartErreicht?.();
  }, [startBei, sichtbareVideos, onStartErreicht]);

  // Wie im Bild-Feed: eigene Reels kommen in dieselbe Liste, damit Like,
  // Speichern und Repost auch bei ihnen wirken.
  useEffect(() => {
    setVideos((prev) => {
      const neue = eigeneVideos.filter((v) => !prev.some((x) => x.id === v.id));
      return neue.length ? [...neue, ...prev] : prev;
    });
  }, [eigeneVideos]);
  const [slideHeight, setSlideHeight] = useState(0);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [optionenFuer, setOptionenFuer] = useState<OptionenBeitrag | null>(null);
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
   * „Datensparen" aus den Einstellungen. Der Schalter stand seit Anfang an in
   * der Liste und wurde gespeichert, ohne dass ihn jemals etwas gelesen hat
   * (Audit vom 17.09.2026, Befund 1). Ist er an, startet kein Video von
   * selbst: das naechste steht angehalten da, ein Tippen laesst es laufen.
   * Gleiche Regel in web/public/app.js (videoAutomatik).
   */
  const { an } = useEinstellungen();
  const datensparen = an('datensparen');

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
   * Ton. Einen eigenen Lautsprecherknopf gibt es nicht mehr - Henrik am
   * 21.09.2026: "Ton richtet sich immer und app-uebergreifend nach der
   * Lautstaerkeeinstellung des Handys." Leise stellt man mit den Tasten am
   * Telefon, wie in jeder anderen App auch.
   */

  const sichtbarkeit = useRef({ itemVisiblePercentThreshold: 60 });

  /*
   * Dieselbe Meldung, zwei Aufgaben: das sichtbare Reel laeuft an, und die
   * Sichtung wird mitgeschrieben. Die Schwelle ist bewusst dieselbe — was
   * anlaeuft, gilt als gesehen, sonst gaebe es zwei Wahrheiten darueber,
   * was "zu sehen" heisst. Siehe lib/impressionen.ts.
   */
  const { sichtbarWechsel: impressionWechsel } = useImpressionen('reels');
  const sichtbarWechsel = useCallback(
    (info: { viewableItems: ViewToken[] }) => {
      const erstes = info.viewableItems[0]?.item as Video | undefined;
      if (erstes) {
        setSichtbar(erstes.id);
        setPause(datensparen);
      }
      impressionWechsel(info);
    },
    [impressionWechsel, datensparen]
  );

  // Beim ersten Aufbau ist noch nichts gescrollt, also meldet die Liste auch
  // nichts — ohne diese Zeile bliebe das oberste Reel stehen.
  useEffect(() => {
    if (!sichtbar && sichtbareVideos.length) setSichtbar(sichtbareVideos[0].id);
  }, [sichtbar, sichtbareVideos]);

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
            stumm={false}
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

          {/* Drei-Punkte-Menue, Vorbild TikTok (components/BeitragOptionenSheet). */}
          <Druck
            style={styles.railBtn}
            onPress={() => setOptionenFuer({ id: item.id, userId: item.userId, mediaUri: item.mediaUri, video: true })}
            accessibilityLabel="Mehr"
          >
            <Ionicons name="ellipsis-horizontal" size={25} color={colors.white} />
          </Druck>
        </View>

        <View style={styles.meta}>
          <View style={styles.author}>
            <Druck style={styles.authorTap} onPress={() => onOpenProfile(item.userId)}>
              <Avatar id={item.userId} name={author?.name ?? ''} size={sizes.avatarSm} />
              <Text style={styles.authorName}>{author?.name}</Text>
            </Druck>
            {/* Am eigenen Video weder "Folgen" noch die Glocke - wie in Home
                (Punkt 62). Im Kurzformat stand beides bis zum 24.09.2026 noch
                am eigenen Reel. */}
            {item.userId !== 'me' && (
              <>
              {/* Folgen ging bis 24.09.2026 nur in einen lokalen Zustand: nichts
                  landete in `follows`, und wem man schon folgte, stand hier
                  trotzdem "Folgen". Jetzt dieselbe Stelle wie in Home -
                  folgenUmschalten schreibt selbst in die Datenbank. */}
              <Druck
                style={[styles.follow, folgtPerson(item.userId) && styles.followAn]}
                onPress={() => {
                  const jetzt = folgenUmschalten(item.userId);
                  onNotice(
                    jetzt ? `Du folgst ${author?.name}` : `${author?.name} nicht mehr gefolgt`
                  );
                }}
              >
                <Text style={styles.followText}>
                  {folgtPerson(item.userId) ? 'Gefolgt' : 'Folgen'}
                </Text>
              </Druck>
              <Druck
                style={styles.bell}
                onPress={() => toggleNotify(item)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={item.notify ? 'Benachrichtigungen aus' : 'Benachrichtigungen an'}
              >
                <Glocke an={!!item.notify} farbeAus={colors.white} />
              </Druck>
              </>
            )}
          </View>
          <Text style={styles.description}>{item.description}</Text>
          <View style={styles.subRow}>
            {item.location && (
              <Druck onPress={() => ziel.ort(item.location)} hitSlop={4}>
                <Text style={styles.sub}>{item.location}</Text>
              </Druck>
            )}
            {item.music && (
              <>
                {item.location && <Text style={styles.sub}> · </Text>}
                <Druck onPress={() => ziel.sound(item.music)} hitSlop={4}>
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
        ref={liste}
        data={sichtbareVideos}
        renderItem={renderVideo}
        keyExtractor={(item) => item.id}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => liste.current?.scrollToIndex({ index, animated: false }), 120);
        }}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        onViewableItemsChanged={sichtbarWechsel}
        viewabilityConfig={sichtbarkeit.current}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      />

      <BeitragOptionenSheet beitrag={optionenFuer} onClose={() => setOptionenFuer(null)} onNotice={onNotice} />

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

  container: { flex: 1, backgroundColor: colors.black },
  slide: { width: '100%', justifyContent: 'flex-end' },
  stageBild: { width: '100%', height: '100%' },
  pauseZeichen: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center', justifyContent: 'center',
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
