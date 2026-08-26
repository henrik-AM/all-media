import { useMemo, useRef } from 'react';
import { Animated, PanResponder } from 'react-native';

/*
 * Ein Blatt oder eine Vollbild-Ebene nach unten wegziehen.
 *
 * Henrik am 26.08.2026:
 *   Punkt 5   "Keine Möglichkeit, den Story-Viewer durch Swipe zu beenden."
 *   Punkt 23  "Kommentar-Sheet schließt nicht durch Downswipe."
 *
 * Beides derselbe Griff, deshalb eine gemeinsame Stelle. Zwei Regeln halten
 * die Geste aus dem Weg des normalen Bedienens:
 *
 *   1. Sie greift erst ab 12px senkrechter Bewegung und nur, wenn die
 *      Bewegung deutlicher nach unten als zur Seite geht. Ohne das faengt sie
 *      jedes Tippen ab und Knoepfe im Blatt reagieren nicht mehr.
 *   2. Zugeschlagen wird ab `schwelle` Pixeln oder bei einem schnellen Zug.
 *      Ein kurzes Verrutschen federt zurueck.
 *
 * Dieselbe Geste gibt es in der Website unter ziehenZumSchliessen().
 */
interface Optionen {
  /** Ab wie vielen Pixeln es zugeht. Fuer eine Vollbild-Ebene mehr. */
  schwelle?: number;
  /** Laeuft, sobald die Geste beginnt - etwa um eine Story anzuhalten. */
  onStart?: () => void;
  /** Laeuft, wenn der Zug zurueckfedert. */
  onAbbruch?: () => void;
}

export function useZiehenZumSchliessen(schliessen: () => void, optionen: Optionen = {}) {
  const { schwelle = 100, onStart, onAbbruch } = optionen;
  const versatz = useRef(new Animated.Value(0)).current;

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Siehe Regel 1: erst ab einer deutlichen Bewegung nach unten.
        onMoveShouldSetPanResponder: (_e, geste) =>
          geste.dy > 12 && Math.abs(geste.dy) > Math.abs(geste.dx) * 1.5,

        onPanResponderGrant: () => onStart?.(),

        onPanResponderMove: (_e, geste) => {
          // Nach oben ziehen tut nichts - das Blatt sitzt am Anschlag.
          if (geste.dy > 0) versatz.setValue(geste.dy);
        },

        onPanResponderRelease: (_e, geste) => {
          const schnell = geste.vy > 0.6 && geste.dy > 40;
          if (geste.dy > schwelle || schnell) {
            Animated.timing(versatz, {
              toValue: 900,
              duration: 180,
              useNativeDriver: true,
            }).start(schliessen);
            return;
          }
          Animated.spring(versatz, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
          onAbbruch?.();
        },

        onPanResponderTerminate: () => {
          Animated.spring(versatz, { toValue: 0, useNativeDriver: true }).start();
          onAbbruch?.();
        },
      }),
    [versatz, schwelle, schliessen, onStart, onAbbruch]
  );

  return {
    /** An das zu ziehende View haengen: {...griff}. */
    griff: responder.panHandlers,
    /** In den style des Views: [stil, ziehStil]. */
    ziehStil: { transform: [{ translateY: versatz }] },
    /** Fuer Ebenen, die beim Ziehen durchsichtig werden sollen. */
    versatz,
  };
}
