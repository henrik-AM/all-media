import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { Druck } from '../../components/Druck';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Motiv } from '../../components/Motiv';
import { Avatar } from '../../components/Avatar';
import { colors, radius, shadow, sizes, spacing, themenStyles, typography } from '../../constants/design';
import { useDaten } from '../../contexts/DatenContext';
import { StoryAnsichtenSheet, StoryOptionenSheet } from '../../components/StoryOptionenSheet';
import { useZiehenZumSchliessen } from '../../lib/ziehen';
import { Contact, Story } from '../../types';

const DURATION = 6000;

interface Props {
  story: Story;
  /** Alle Storys - damit auch die eigene Aufnahme blaetterbar ist. */
  alle: Story[];
  /** Eigene Story wieder entfernen. */
  onDelete?: () => void;
  onClose: () => void;
  /** Antwort auf die Story — landet im Chat mit dieser Person. */
  onReply: (story: Story, text: string) => void;
  /** Fuer die Liste "wer hat sie gesehen". */
  contacts?: Contact[];
  onOpenProfile?: (userId: string) => void;
  onNotice: (message: string) => void;
  /** Wenn eine Story angesehen wird - zum Markieren als viewed. */
  onStoryViewed?: (storyId: string) => void;
}

/*
 * Der Viewer folgt Henriks Rueckmeldung:
 *  1. Das Herz bleibt rot, solange die Story geliked ist.
 *  2. Sobald im Antwortfeld etwas steht, laeuft die Zeit nicht weiter.
 *  3. Eine Antwort landet wirklich im Chat mit dieser Person.
 *  4. Tippen links/rechts blaettert zur vorigen/naechsten Story.
 */
export const StoryViewerScreen = ({
  story,
  alle,
  onClose,
  onReply,
  onNotice,
  onDelete,
  contacts = [],
  onOpenProfile,
  onStoryViewed,
}: Props) => {
  const { users: alleNutzer } = useDaten();
  const [ansichtenOffen, setAnsichtenOffen] = useState(false);
  const [optionenOffen, setOptionenOffen] = useState(false);
  const insets = useSafeAreaInsets();
  // Die eigene Story ist nur dabei, wenn wirklich etwas aufgenommen wurde.
  const stories = alle.filter((s) => !s.own || s.mediaUri);
  const [index, setIndex] = useState(() => Math.max(stories.findIndex((s) => s.id === story.id), 0));
  const [liked, setLiked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(stories.map((s) => [s.id, !!s.liked]))
  );
  const [reply, setReply] = useState('');
  const [paused, setPaused] = useState(false);

  const current = stories[index];
  const person = alleNutzer[current.userId];
  const istEigene = !!current.own;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    // Markiere die aktuelle Story als viewed
    if (!current.own) {
      onStoryViewed?.(current.id);
    }
  }, [index, progress, current, onStoryViewed]);

  useEffect(() => {
    if (paused) {
      progress.stopAnimation();
      return;
    }

    let remaining = DURATION;
    progress.stopAnimation((value: number) => {
      remaining = DURATION * (1 - value);
    });

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: remaining,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (!finished) return;
      if (index < stories.length - 1) setIndex(index + 1);
      else onClose();
    });
    return () => animation.stop();
  }, [index, paused, progress, stories.length, onClose]);

  // Solange etwas im Antwortfeld steht, steht auch die Zeit.
  useEffect(() => {
    setPaused(reply.trim().length > 0);
  }, [reply]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  /*
   * Punkt 5: nach unten wischen beendet den Betrachter.
   *
   * Vorher gab es nur den kleinen Pfeil oben links - und der liegt genau
   * dort, wo beim Halten des Handys die andere Hand ist. Die Schwelle liegt
   * hoeher als bei einem Blatt (140 statt 100): eine Vollbild-Ebene soll
   * nicht schon bei einem Verrutschen weggehen.
   *
   * Waehrend des Ziehens steht die Zeit still, sonst laeuft die Story im
   * Hintergrund weiter und springt beim Zurueckfedern zur naechsten.
   */
  const ziehen = useZiehenZumSchliessen(onClose, {
    schwelle: 140,
    onStart: () => setPaused(true),
    onAbbruch: () => setPaused(false),
  });

  const go = (step: number) => {
    const next = index + step;
    if (next < 0 || next >= stories.length) return onClose();
    setReply('');
    setIndex(next);
  };

  const send = () => {
    const text = reply.trim();
    if (!text) return onNotice('Bitte etwas schreiben');
    setReply('');
    onReply(current, text);
  };

  /** "vor 3 Min." aus dem Aufnahmezeitpunkt. */
  const alter = () => {
    if (!current.aufgenommen) return 'vor 2 Std.';
    const min = Math.floor((Date.now() - current.aufgenommen) / 60000);
    if (min < 1) return 'gerade eben';
    if (min < 60) return `vor ${min} Min.`;
    return `vor ${Math.floor(min / 60)} Std.`;
  };

  return (
    <Animated.View
      {...ziehen.griff}
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
        ziehen.ziehStil,
      ]}
    >
      {/* Ein Balken, Zurueck-Pfeil links, Mehr-Menue rechts — wie im Prototyp. */}
      <View style={styles.bars}>
        <View style={styles.bar}>
          <Animated.View style={[styles.fill, { width }]} />
        </View>
      </View>

      <View style={styles.head}>
        <Druck onPress={onClose} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </Druck>
        <Avatar id={current.userId} name={person?.name ?? current.name} size={sizes.avatarSm} />
        <View style={styles.who}>
          <Text style={styles.name}>{istEigene ? 'Deine Story' : person?.name ?? current.name}</Text>
          <Text style={styles.time}>{alter()}</Text>
        </View>
        <Druck
          onPress={() => {
            // Zeit anhalten, solange das Blatt offen ist - sonst laeuft die
            // Story im Hintergrund weiter.
            setPaused(true);
            setOptionenOffen(true);
          }}
          hitSlop={10}
        >
          <Ionicons name="ellipsis-horizontal-circle-outline" size={24} color={colors.white} />
        </Druck>
      </View>

      <View style={styles.stage}>
        {current.mediaUri ? (
          <Image source={{ uri: current.mediaUri }} style={styles.bild} resizeMode="contain" />
        ) : (
          <Motiv
            id={current.id}
            icon="image-outline"
            iconSize={40}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
        )}
        {/* Verlauf oben und unten: Name, Uhrzeit und Bildunterschrift lagen
            direkt auf dem Motiv. Solange dort Schwarz stand, ging das gut —
            sobald ein echtes Foto oder eine helle Fläche darunterliegt, ist
            weiße Schrift darauf nicht mehr lesbar. Jede Story-App löst das
            so. Die Verläufe liegen unter den Bedienelementen. */}
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'transparent']}
          style={styles.schleierOben}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)']}
          style={styles.schleierUnten}
          pointerEvents="none"
        />
        {current.caption ? <Text style={styles.caption}>{current.caption}</Text> : null}
        <Druck
          accessibilityLabel="Vorherige Story"
          style={[styles.zone, styles.zoneLeft]}
          onPress={() => go(-1)}
        />
        <Druck
          accessibilityLabel="Nächste Story"
          style={[styles.zone, styles.zoneRight]}
          onPress={() => go(1)}
        />
      </View>

      {istEigene ? (
        // Sich selbst antwortet man nicht - stattdessen der Blick darauf,
        // wer die Story gesehen hat.
        <View style={styles.foot}>
          <Druck
            style={styles.ansichten}
            onPress={() => {
              setPaused(true);
              setAnsichtenOffen(true);
            }}
          >
            <Ionicons name="eye-outline" size={20} color={colors.white} />
            <Text style={styles.ansichtenText}>Ansichten</Text>
          </Druck>
          <Druck
            onPress={() => {
              onDelete?.();
              onClose();
            }}
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={22} color={colors.white} />
          </Druck>
        </View>
      ) : (
      <View style={styles.foot}>
        <TextInput
          style={styles.reply}
          value={reply}
          onChangeText={setReply}
          placeholder="Antworten"
          placeholderTextColor="rgba(255,255,255,0.6)"
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(reply.trim().length > 0)}
          // Henrik: "Antworten auf Stories nicht per Enter absenden.
          // Stattdessen einen kleinen Senden-Button mit Pfeil verwenden."
          // Deshalb kein onSubmitEditing - der Pfeil daneben schickt ab.
          returnKeyType="default"
          blurOnSubmit={false}
        />
        <Druck
          style={[styles.senden, !reply.trim() && styles.sendenAus]}
          onPress={send}
          disabled={!reply.trim()}
          hitSlop={8}
          accessibilityLabel="Antwort senden"
        >
          <Ionicons name="send" size={17} color="#fff" />
        </Druck>
        <Druck
          onPress={() => {
            const next = !liked[current.id];
            setLiked({ ...liked, [current.id]: next });
            current.liked = next;
            onNotice(next ? `Dir gefällt die Story von ${person?.name}` : 'Gefällt-mir entfernt');
          }}
          hitSlop={8}
        >
          <Ionicons
            name={liked[current.id] ? 'heart' : 'heart-outline'}
            size={24}
            color={liked[current.id] ? colors.danger : colors.white}
          />
        </Druck>
      </View>
      )}

      {ansichtenOffen && (
        <StoryAnsichtenSheet
          story={current}
          contacts={contacts}
          onClose={() => {
            setAnsichtenOffen(false);
            setPaused(false);
          }}
          onOpenProfile={(userId) => {
            onClose();
            onOpenProfile?.(userId);
          }}
        />
      )}

      {optionenOffen && (
        <StoryOptionenSheet
          story={current}
          eigene={istEigene}
          onClose={() => {
            setOptionenOffen(false);
            setPaused(false);
          }}
          onDelete={() => {
            onDelete?.();
            onClose();
          }}
          onNotice={onNotice}
        />
      )}
    </Animated.View>
  );
};

const styles = themenStyles((colors) => ({
  bild: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' },
  ansichten: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ansichtenText: { color: colors.white, ...typography.body },

  container: { flex: 1, backgroundColor: colors.black },
  bars: { flexDirection: 'row', gap: 4, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  bar: { flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.white },

  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  who: { flex: 1 },
  name: { color: colors.white, ...typography.name },
  time: { color: 'rgba(255,255,255,0.75)', fontSize: 11.5 },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  schleierOben: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  schleierUnten: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160 },
  caption: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    color: colors.white,
    textAlign: 'center',
    ...typography.message,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  zone: { position: 'absolute', top: 0, bottom: 0, width: '32%' },
  zoneLeft: { left: 0 },
  zoneRight: { right: 0 },

  foot: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  /* Senden-Pfeil neben dem Antwortfeld. Ausgegraut, solange nichts dasteht -
     ein Pfeil, der eine leere Antwort schickt, waere schlimmer als keiner. */
  senden: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    ...shadow.brand,
  },
  sendenAus: { opacity: 0.35, transform: [{ scale: 0.92 }] },
  reply: {
    flex: 1,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: spacing.lg,
    color: colors.white,
  },
}));
