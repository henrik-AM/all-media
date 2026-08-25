import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../constants/design';

interface Props {
  /** Bekommt Dauer in Sekunden und die erreichte Zuschauerzahl. */
  onEnd: (sekunden: number, zuschauer: number) => void;
}

const zweistellig = (n: number) => String(n).padStart(2, '0');

/**
 * Prototyp-Frame "VP + erstellen" -> Livestream.
 *
 * Ohne Streaming-Server gibt es kein echtes Bild. Was hier steht, ist alles
 * echt: die Zeit laeuft mit, die Zuschauerzahl waechst, und beim Beenden
 * bleibt die Aufzeichnung im Querformat-Bereich stehen.
 */
export const LivestreamScreen = ({ onEnd }: Props) => {
  const insets = useSafeAreaInsets();
  const [sekunden, setSekunden] = useState(0);
  const [zuschauer, setZuschauer] = useState(0);

  // Der Endstand muss auch dann stimmen, wenn der Knopf gedrueckt wird,
  // bevor React den letzten Zustand durchgereicht hat.
  const stand = useRef({ sekunden: 0, zuschauer: 0 });

  useEffect(() => {
    const uhr = setInterval(() => {
      stand.current.sekunden += 1;
      if (stand.current.sekunden % 3 === 0) stand.current.zuschauer += 1;
      setSekunden(stand.current.sekunden);
      setZuschauer(stand.current.zuschauer);
    }, 1000);
    return () => clearInterval(uhr);
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.stage}>
        <Ionicons name="videocam-outline" size={84} color="#3A3A44" />

        <View style={styles.marke}>
          <View style={styles.punkt} />
          <Text style={styles.markeText}>LIVE</Text>
        </View>

        <View style={styles.zeitFeld}>
          <Text style={styles.zeit}>
            {zweistellig(Math.floor(sekunden / 60))}:{zweistellig(sekunden % 60)}
          </Text>
        </View>
      </View>

      <View style={[styles.leiste, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.zuschauer}>
          {zuschauer} {zuschauer === 1 ? 'Zuschauer' : 'Zuschauer'}
        </Text>
        <Pressable
          style={styles.stop}
          onPress={() => onEnd(Math.max(1, stand.current.sekunden), stand.current.zuschauer)}
        >
          <Text style={styles.stopText}>Livestream beenden</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101014' },
  marke: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
  },
  punkt: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.white },
  markeText: { ...typography.small, color: colors.white, fontWeight: '700', letterSpacing: 0.6 },
  zeitFeld: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  zeit: { ...typography.preview, color: colors.white, fontVariant: ['tabular-nums'] },
  leiste: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  zuschauer: { ...typography.message, color: '#B9BDC6', textAlign: 'center' },
  stop: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopText: { ...typography.name, color: colors.white },
});
