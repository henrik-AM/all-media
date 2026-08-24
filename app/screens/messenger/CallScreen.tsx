import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { colors, radius, spacing, typography } from '../../constants/design';
import { mockUsers } from '../../mocks';

/*
 * Die Oberflaeche eines Anrufs.
 *
 * Die Uebertragung selbst fehlt bewusst: dafuer braucht es WebRTC, einen
 * Signalweg (Supabase Realtime) und einen TURN-Server - und WebRTC laeuft
 * nicht in Expo Go, sondern erst in einem eigenen Build. Die Oberflaeche
 * steht damit schon vollstaendig, der Verlauf ist simuliert:
 * klingelt -> verbunden (Dauer laeuft) -> beendet.
 */

type Zustand = 'klingelt' | 'verbunden' | 'beendet';

interface Props {
  userId: string;
  art: 'audio' | 'video';
  onClose: () => void;
  onNotice: (message: string) => void;
}

const zweistellig = (n: number) => String(n).padStart(2, '0');

/** Sekunden als mm:ss, ab einer Stunde als h:mm:ss. */
export const dauerText = (sekunden: number) => {
  const st = Math.floor(sekunden / 3600);
  const min = Math.floor((sekunden % 3600) / 60);
  const sek = sekunden % 60;
  return st > 0 ? `${st}:${zweistellig(min)}:${zweistellig(sek)}` : `${zweistellig(min)}:${zweistellig(sek)}`;
};

export const CallScreen = ({ userId, art, onClose, onNotice }: Props) => {
  const insets = useSafeAreaInsets();
  const person = mockUsers[userId];

  const [zustand, setZustand] = useState<Zustand>('klingelt');
  const [dauer, setDauer] = useState(0);
  const [stumm, setStumm] = useState(false);
  const [lautsprecher, setLautsprecher] = useState(art === 'video');
  const [kameraAn, setKameraAn] = useState(art === 'video');

  const puls = useRef(new Animated.Value(1)).current;

  // Klingeln: der Ring pulsiert, bis abgenommen wird.
  useEffect(() => {
    if (zustand !== 'klingelt') return;
    const schleife = Animated.loop(
      Animated.sequence([
        Animated.timing(puls, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(puls, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    schleife.start();
    return () => schleife.stop();
  }, [zustand, puls]);

  // Nach kurzer Zeit wird abgenommen - in der Demo automatisch.
  useEffect(() => {
    if (zustand !== 'klingelt') return;
    const t = setTimeout(() => setZustand('verbunden'), 2600);
    return () => clearTimeout(t);
  }, [zustand]);

  // Gespraechsdauer
  useEffect(() => {
    if (zustand !== 'verbunden') return;
    const t = setInterval(() => setDauer((d) => d + 1), 1000);
    return () => clearInterval(t);
  }, [zustand]);

  const auflegen = () => {
    setZustand('beendet');
    onNotice(dauer > 0 ? `Anruf beendet · ${dauerText(dauer)}` : 'Anruf beendet');
    setTimeout(onClose, 700);
  };

  const statusText =
    zustand === 'klingelt'
      ? art === 'video'
        ? 'Videoanruf …'
        : 'Klingelt …'
      : zustand === 'verbunden'
      ? dauerText(dauer)
      : 'Beendet';

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
      {/* Bei einem Videoanruf steht hier spaeter das Bild der Gegenseite. */}
      {art === 'video' && zustand === 'verbunden' && (
        <View style={styles.videoFlaeche}>
          <Ionicons name="videocam-outline" size={44} color="rgba(255,255,255,0.35)" />
          <Text style={styles.videoHinweis}>Bildübertragung folgt mit dem Backend</Text>
        </View>
      )}

      <View style={styles.kopf}>
        <Animated.View style={{ transform: [{ scale: zustand === 'klingelt' ? puls : 1 }] }}>
          <Avatar id={userId} name={person?.name ?? 'Unbekannt'} size={124} />
        </Animated.View>
        <Text style={styles.name}>{person?.name ?? 'Unbekannt'}</Text>
        <Text style={styles.status}>{statusText}</Text>
        {zustand === 'verbunden' && (
          <View style={styles.verschluesselt}>
            <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.7)" />
            <Text style={styles.verschluesseltText}>Ende-zu-Ende-verschlüsselt</Text>
          </View>
        )}
      </View>

      {art === 'video' && kameraAn && zustand === 'verbunden' && (
        <View style={styles.eigenesBild}>
          <Ionicons name="person" size={26} color="rgba(255,255,255,0.5)" />
        </View>
      )}

      <View style={styles.leiste}>
        <Pressable
          style={[styles.knopf, stumm && styles.knopfAn]}
          onPress={() => {
            setStumm(!stumm);
            onNotice(stumm ? 'Mikrofon an' : 'Mikrofon stumm');
          }}
        >
          <Ionicons name={stumm ? 'mic-off' : 'mic'} size={24} color={stumm ? colors.text : colors.white} />
          <Text style={[styles.knopfText, stumm && styles.knopfTextAn]}>Stumm</Text>
        </Pressable>

        <Pressable
          style={[styles.knopf, lautsprecher && styles.knopfAn]}
          onPress={() => {
            setLautsprecher(!lautsprecher);
            onNotice(lautsprecher ? 'Lautsprecher aus' : 'Lautsprecher an');
          }}
        >
          <Ionicons
            name={lautsprecher ? 'volume-high' : 'volume-medium-outline'}
            size={24}
            color={lautsprecher ? colors.text : colors.white}
          />
          <Text style={[styles.knopfText, lautsprecher && styles.knopfTextAn]}>Laut</Text>
        </Pressable>

        <Pressable
          style={[styles.knopf, kameraAn && styles.knopfAn]}
          onPress={() => {
            setKameraAn(!kameraAn);
            onNotice(kameraAn ? 'Kamera aus' : 'Kamera an');
          }}
        >
          <Ionicons
            name={kameraAn ? 'videocam' : 'videocam-off-outline'}
            size={24}
            color={kameraAn ? colors.text : colors.white}
          />
          <Text style={[styles.knopfText, kameraAn && styles.knopfTextAn]}>Video</Text>
        </Pressable>
      </View>

      <View style={styles.unten}>
        {zustand === 'klingelt' && (
          // In der Demo nimmt die Gegenseite von selbst ab - der Knopf
          // ueberspringt das Warten.
          <Pressable style={[styles.rund, styles.annehmen]} onPress={() => setZustand('verbunden')}>
            <Ionicons name="call" size={28} color={colors.white} />
          </Pressable>
        )}
        <Pressable style={[styles.rund, styles.auflegen]} onPress={auflegen}>
          <Ionicons name="call" size={28} color={colors.white} style={styles.aufgelegt} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101418', justifyContent: 'space-between' },

  videoFlaeche: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#171C22',
  },
  videoHinweis: { color: 'rgba(255,255,255,0.4)', ...typography.small },

  kopf: { alignItems: 'center', gap: spacing.sm },
  name: { marginTop: spacing.lg, color: colors.white, ...typography.title },
  status: { color: 'rgba(255,255,255,0.65)', ...typography.body },
  verschluesselt: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.xs },
  verschluesseltText: { color: 'rgba(255,255,255,0.7)', ...typography.small },

  eigenesBild: {
    position: 'absolute',
    right: spacing.lg,
    top: 110,
    width: 92,
    height: 128,
    borderRadius: radius.md,
    backgroundColor: '#252B33',
    alignItems: 'center',
    justifyContent: 'center',
  },

  leiste: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl },
  knopf: {
    alignItems: 'center',
    gap: 6,
    width: 76,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  knopfAn: { backgroundColor: colors.white },
  knopfText: { color: colors.white, ...typography.small },
  knopfTextAn: { color: colors.text },

  unten: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xxl },
  rund: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  annehmen: { backgroundColor: colors.success },
  auflegen: { backgroundColor: colors.danger },
  aufgelegt: { transform: [{ rotate: '135deg' }] },
});
