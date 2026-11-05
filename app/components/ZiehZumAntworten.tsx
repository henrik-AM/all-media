/**
 * Eine Nachricht nach rechts ziehen → darauf antworten.
 *
 * Henrik am 28.09.2026 (Kasten 4): „Man kann durch nach rechts ziehen einer
 * Nachricht, egal ob unter Communitys → Chats oder Videos, nicht auf die
 * Nachricht antworten." Bis dahin ging Antworten nur über langes Drücken
 * (NachrichtSheet → „Antworten") — das bleibt als zweiter Weg.
 *
 * WIE
 *
 * PanResponder und Animated aus React Native selbst — kein neues Paket,
 * läuft in Expo Go. Die Geste fängt erst, wenn waagrecht deutlich überwiegt
 * (Chatblase.istZug), sonst gehört die Bewegung dem Bildlauf des Verlaufs.
 * Über die Capture-Phase, weil die Blase selbst ein Druck (Pressable) ist
 * und den Finger sonst nicht hergibt; Pressable bricht dabei sein langes
 * Drücken ab, das Menü springt also nicht mitten im Ziehen auf.
 *
 * Ab Chatblase.ZIEH_SCHWELLE erscheint der Pfeil voll und es vibriert kurz;
 * Loslassen dort setzt den Bezug. Zahlen in gemeinsam/chatblase.js — die
 * Website zieht mit der Maus nach denselben (web/public/app.js, ziehBinden).
 */

import React, { useMemo, useRef } from 'react';
import { Animated, PanResponder, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themenStyles } from '../constants/design';
import { haptic } from '../lib/haptics';

const Chatblase = require('../../gemeinsam/chatblase') as typeof import('../../gemeinsam/chatblase');

interface Props {
  children: React.ReactNode;
  /** Ohne Wirkung, wenn false — etwa bei Anrufzeilen oder gesperrtem Chat. */
  aktiv: boolean;
  onAntworten: () => void;
  testID?: string;
}

export const ZiehZumAntworten = ({ children, aktiv, onAntworten, testID }: Props) => {
  const x = useRef(new Animated.Value(0)).current;
  const ueberSchwelle = useRef(false);
  // Immer der neueste Rueckruf, ohne den PanResponder neu zu bauen.
  const rueckruf = useRef(onAntworten);
  rueckruf.current = onAntworten;
  const aktivRef = useRef(aktiv);
  aktivRef.current = aktiv;

  const zurueck = () => {
    ueberSchwelle.current = false;
    Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6, speed: 18 }).start();
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) => aktivRef.current && Chatblase.istZug(g.dx, g.dy),
        onMoveShouldSetPanResponder: (_, g) => aktivRef.current && Chatblase.istZug(g.dx, g.dy),
        // Einmal gefangen, gibt die Blase den Finger nicht an die Liste ab.
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          x.setValue(Chatblase.zugWeg(g.dx));
          const jetzt = Chatblase.ausgeloest(g.dx);
          if (jetzt && !ueberSchwelle.current) void haptic.light();
          ueberSchwelle.current = jetzt;
        },
        onPanResponderRelease: (_, g) => {
          const los = Chatblase.ausgeloest(g.dx);
          zurueck();
          if (los) rueckruf.current();
        },
        onPanResponderTerminate: zurueck,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const pfeilDeckkraft = x.interpolate({
    inputRange: [Chatblase.ZIEH_START, Chatblase.ZIEH_SCHWELLE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const pfeilGroesse = x.interpolate({
    inputRange: [Chatblase.ZIEH_START, Chatblase.ZIEH_SCHWELLE],
    outputRange: [0.6, 1],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={styles.zeile}
      testID={testID}
      /*
       * Für VoiceOver (und als zweiter Weg zum Ziehen): die Aktion
       * „Antworten" an der Zeile selbst.
       */
      accessibilityActions={aktiv ? [{ name: 'antworten', label: 'Antworten' }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'antworten') rueckruf.current();
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.pfeil, { opacity: pfeilDeckkraft, transform: [{ scale: pfeilGroesse }] }]}
      >
        <Ionicons name="arrow-undo" size={16} color={colors.text2} />
      </Animated.View>
      <Animated.View style={[styles.zeile, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
};

const styles = themenStyles((colors) => ({
  // Volle Breite, damit die Blase darin weiter links oder rechts stehen kann
  // (alignSelf in bubbleIn/bubbleOut).
  zeile: { width: '100%' },
  pfeil: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface3,
  },
}));
