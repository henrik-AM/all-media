import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { brandGradient, colors, sizes, spacing, storyGradient, themenStyles, typography } from '../constants/design';
import { useDaten } from '../contexts/DatenContext';
import { Story } from '../types';

interface Props {
  stories: Story[];
  onPress: (story: Story) => void;
}

const RING = sizes.storyRing;

/**
 * Story-Leiste. Der Ring ist ein Verlauf, kein einfarbiger Rand — das ist der
 * eine Punkt, an dem eine Story-Leiste hochwertig oder selbstgebaut aussieht.
 *
 * WAS DER RING SAGT
 *
 * Henrik, 07.09.2026: "Story-Kreis-Logik (grau=gesehen, farbig=neu, ohne=keine
 * Story) fehlerhaft." Drei Zustände, und zwei davon stimmten nicht:
 *
 *  * Die eigene Kachel trug auch dann den bunten Verlauf, wenn gar nichts
 *    aufgenommen war. Bunt heißt "neu" — dort war aber nichts. Jetzt trägt sie
 *    in diesem Fall gar keinen Ring, so wie es der dritte Zustand verlangt.
 *
 *  * Die Leiste zeigte eine Kachel je STORY, nicht je Person. Wer drei Storys
 *    hatte, stand dreimal in der Reihe, und jede Kachel färbte sich für sich.
 *    Man sah dann denselben Namen einmal grau und daneben zweimal bunt —
 *    genau das Bild, an dem die Logik als kaputt auffällt. Eine Person ist
 *    jetzt eine Kachel: bunt, solange auch nur eine ihrer Storys ungesehen
 *    ist, grau erst, wenn alle gesehen sind.
 *
 * Getippt wird auf die erste ungesehene Story dieser Person — der Betrachter
 * blättert von dort aus durch die restliche Liste weiter. Gleiche Regel in
 * web/public/app.js (renderStoryRail).
 */
export const StoryRail = ({ stories, onPress }: Props) => {
  const { users: alleNutzer } = useDaten();

  const gruppen = useMemo(() => {
    const nachPerson = new Map<string, Story[]>();
    for (const s of stories) {
      if (!nachPerson.has(s.userId)) nachPerson.set(s.userId, []);
      nachPerson.get(s.userId)!.push(s);
    }
    // Die Map behält die Reihenfolge des Eintragens — die eigene Kachel bleibt
    // also links, die Fremden dahinter in der Reihenfolge aus daten.ts.
    return [...nachPerson.values()].map((eigene) => {
      const ungesehen = eigene.find((s) => !s.viewed);
      return {
        story: ungesehen ?? eigene[eigene.length - 1],
        alleGesehen: !ungesehen,
        // Ein Vorschaubild hat die Kachel, sobald irgendeine der Storys eines
        // hat: eine Person mit Story soll nie wie eine ohne aussehen.
        bild: (ungesehen ?? eigene[eigene.length - 1]).mediaUri
          ?? eigene.find((s) => s.mediaUri)?.mediaUri,
      };
    });
  }, [stories]);

  return (
  <View style={styles.railWrap}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {gruppen.map(({ story, alleGesehen, bild }) => {
        const inner = RING - 7;
        // Der dritte Zustand: keine Story, kein Ring. Es gibt ihn nur bei der
        // eigenen Kachel — fremde stehen ohne Story gar nicht in der Leiste.
        const ohneStory = Boolean(story.own) && !bild;
        /*
         * story.name ist der kurze Name UNTER dem Ring ("Anna", "Deine
         * Story"). Die Initialen im Kreis gehören aber zur Person, sonst
         * stand dort "A" statt "AS" und bei der eigenen Story "DS" statt
         * "DU" — in der Chatliste direkt darunter steht es richtig, also
         * fiel der Unterschied sofort auf.
         */
        const person = alleNutzer[story.userId];
        const vollerName = person?.name ?? story.name;

        /*
         * Im Ring steht das Bild der Story, nicht die Initialen — so ist es
         * im Prototyp und so macht es die Website. Die App zeigte hier immer
         * den Avatar; die eigene Story mit Bild sah deshalb genauso aus wie
         * eine leere.
         *
         * Ohne Bild bleibt es beim Avatar: bei der eigenen Story ist das der
         * Zustand "noch nichts aufgenommen", bei fremden gab es noch nie ein
         * Vorschaubild.
         */
        const kern = bild ? (
          <Image
            source={{ uri: bild }}
            style={{ width: inner - 4, height: inner - 4, borderRadius: (inner - 4) / 2 }}
          />
        ) : (
          <Avatar id={story.userId} name={vollerName} size={inner - 4} />
        );

        return (
          <Druck
            key={story.id}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={() => onPress(story)}
          >
            {ohneStory || alleGesehen ? (
              <View style={[styles.ring, ohneStory ? styles.ringOhne : styles.ringViewed]}>
                <View style={styles.inner}>{kern}</View>
              </View>
            ) : (
              <LinearGradient
                colors={storyGradient}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.ring}
              >
                <View style={styles.inner}>{kern}</View>
              </LinearGradient>
            )}

            {/* Solange die eigene Story leer ist, lädt das Plus zur Aufnahme
                ein. Ist sie gefüllt, verhält sie sich wie jede andere. */}
            {ohneStory && (
              <LinearGradient
                colors={brandGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.addBadge}
              >
                <Ionicons name="add" size={14} color={colors.white} />
              </LinearGradient>
            )}

            <Text style={[styles.name, story.own && styles.nameOwn]} numberOfLines={1}>
              {story.name}
            </Text>
          </Druck>
        );
      })}
    </ScrollView>
  </View>
  );
};

const styles = themenStyles((colors) => ({
  railWrap: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  rail: {
    gap: 15,
    paddingHorizontal: spacing.lg,
    paddingTop: 13,
    paddingBottom: 12,
  },
  item: {
    width: RING,
    alignItems: 'center',
  },
  itemPressed: { opacity: 0.62 },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringViewed: {
    backgroundColor: colors.border,
  },
  /* Der dritte Zustand: kein Ring. Der Platz bleibt, damit die eigene Kachel
     nicht kleiner ist als die daneben und die Reihe nicht springt. */
  ringOhne: {
    backgroundColor: 'transparent',
  },
  /* Der weiße Spalt zwischen Ring und Bild — ohne ihn klebt der Verlauf am
     Gesicht und der Ring wirkt wie ein Rahmen statt wie ein Signal. */
  inner: {
    width: RING - 5,
    height: RING - 5,
    borderRadius: (RING - 5) / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBadge: {
    position: 'absolute',
    right: -1,
    top: RING - 21,
    width: 21,
    height: 21,
    borderRadius: 10.5,
    borderWidth: 2.5,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Breiter als der Ring — sonst wird „Deine Story" auf „Deine Sto…" gekürzt. */
  name: {
    width: 72,
    marginHorizontal: -4,
    textAlign: 'center',
    marginTop: 7,
    color: colors.text2,
    ...typography.small,
    fontSize: 11.5,
    letterSpacing: -0.1,
  },
  nameOwn: { color: colors.text, fontWeight: '600' },
}));
