/**
 * Profilbild mit Story-Ring — Kasten 11.1.
 *
 * Steht überall, wo das Profilbild einer Person steht, die eine Story haben
 * kann: Beitragskopf (Home), Kurzformat, Querformat, Profil, Suche,
 * Kommentare, Chatliste, Kontaktprofil. Vorher hatte die App den Ring nur in
 * der Storyleiste.
 *
 * Drei Zustände wie in der Leiste (Henrik 07.09.2026): bunt = neu, grau =
 * gesehen, ohne = keine Story. Der Ring liegt INNERHALB von `size` — das
 * Profilbild wird kleiner, der Platz bleibt gleich. So springt keine Zeile,
 * wenn eine Story dazukommt oder abläuft.
 *
 * Tippen: mit Story öffnet der Betrachter (nur diese Person), ohne Story
 * passiert, was die Stelle vorher tat (`onPressOhneStory`, z. B. Profil).
 */
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from './Avatar';
import { Druck } from './Druck';
import { storyGradient, themenStyles } from '../constants/design';
import { StoryBereich, useStoryRing } from '../contexts/StoryContext';

interface Props {
  id: string;
  name: string;
  size?: number;
  bereich: StoryBereich;
  online?: boolean;
  style?: ViewStyle;
  /** Tippen ohne Story. Fehlt es, ist das Bild ohne Story nicht tippbar. */
  onPressOhneStory?: () => void;
  /**
   * false: nur zeichnen, nicht tippbar — wenn die Stelle selbst schon ein
   * Tippfeld ist (z. B. ganze Zeile in der Suche) und der Ring nur anzeigen
   * soll.
   */
  tippbar?: boolean;
  accessibilityLabel?: string;
  /** Gruppenbild (Chatliste) — Gruppen haben keine Story, also nie ein Ring. */
  group?: boolean;
  /**
   * Kennung für die Story-Suche, falls sie von `id` abweicht: das eigene
   * Profil führt Storys unter 'me', das Bild aber unter der echten Kennung.
   */
  ringId?: string;
}

export const StoryAvatar = ({
  id,
  name,
  size = 36,
  bereich,
  online,
  style,
  onPressOhneStory,
  tippbar = true,
  accessibilityLabel,
  group,
  ringId,
}: Props) => {
  const ring = useStoryRing(group ? undefined : ringId ?? id, bereich);
  const mitRing = ring.status !== 'keiner';
  // Ring 2 px, Spalt 2 px — bei kleinen Bildern etwas weniger.
  const dicke = size >= 60 ? 3 : 2;
  const spalt = size >= 60 ? 3 : 2;
  const innen = mitRing ? size - 2 * (dicke + spalt) : size;

  const bild = <Avatar id={id} name={name} size={innen} online={online} group={group} />;

  const inhalt = mitRing ? (
    <View style={{ width: size, height: size }} testID={`storyring-${ring.status}`}>
      {ring.status === 'neu' ? (
        <LinearGradient
          colors={storyGradient}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <View style={[styles.ring, styles.grau, { width: size, height: size, borderRadius: size / 2 }]} />
      )}
      <View
        style={[
          styles.spalt,
          {
            top: dicke,
            left: dicke,
            width: size - 2 * dicke,
            height: size - 2 * dicke,
            borderRadius: (size - 2 * dicke) / 2,
          },
        ]}
      >
        {bild}
      </View>
    </View>
  ) : (
    bild
  );

  const tippen = mitRing ? ring.oeffnen : onPressOhneStory;
  if (!tippbar || !tippen) return <View style={style}>{inhalt}</View>;
  return (
    <Druck
      style={style}
      onPress={tippen}
      hitSlop={4}
      accessibilityLabel={
        accessibilityLabel ?? (mitRing ? `Story von ${name} ansehen` : `Profil von ${name}`)
      }
    >
      {inhalt}
    </Druck>
  );
};

const styles = themenStyles((colors) => ({
  ring: { position: 'absolute', top: 0, left: 0 },
  grau: { backgroundColor: colors.border },
  spalt: {
    position: 'absolute',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
