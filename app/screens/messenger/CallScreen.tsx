import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';
import { useDaten } from '../../contexts/DatenContext';

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
  /** Bei einem Gruppenanruf leer - dann zaehlen name und teilnehmer. */
  userId?: string;
  /** Name der Gruppe. */
  gruppenName?: string;
  /** Kennungen der Mitglieder. */
  teilnehmer?: string[];
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

export const CallScreen = ({ userId, gruppenName, teilnehmer = [], art, onClose, onNotice }: Props) => {
  const { users: alleNutzer } = useDaten();
  const insets = useSafeAreaInsets();
  const gruppe = !userId && !!gruppenName;
  const person = userId ? alleNutzer[userId] : undefined;
  const dabei = teilnehmer.filter((id) => alleNutzer[id]);

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
      <LinearGradient
        colors={['rgba(91,69,224,0.22)', 'transparent']}
        style={styles.schleier}
        pointerEvents="none"
      />

      {/* Bei einem Videoanruf steht hier spaeter das Bild der Gegenseite. */}
      {art === 'video' && zustand === 'verbunden' && (
        <View style={styles.videoFlaeche}>
          <Ionicons name="videocam-outline" size={44} color="rgba(255,255,255,0.35)" />
          <Text style={styles.videoHinweis}>Bildübertragung folgt mit dem Backend</Text>
        </View>
      )}

      <View style={styles.kopf}>
        {gruppe && dabei.length > 0 ? (
          // Bei einer Gruppe stehen alle Mitglieder oben statt eines
          // grossen Bildes. Bei einer Community sind die Mitglieder nicht
          // namentlich bekannt - dann bleibt es beim einen grossen Bild.
          <View style={styles.runde}>
            {dabei.map((id) => (
              <Avatar key={id} id={id} name={alleNutzer[id].name} size={52} />
            ))}
          </View>
        ) : gruppe ? (
          <Avatar id={gruppenName ?? 'gruppe'} name={gruppenName ?? 'Gruppe'} size={124} />
        ) : (
          <Animated.View style={{ transform: [{ scale: zustand === 'klingelt' ? puls : 1 }] }}>
            <Avatar id={userId ?? 'me'} name={person?.name ?? 'Unbekannt'} size={124} />
          </Animated.View>
        )}
        <Text style={styles.name}>{gruppe ? gruppenName : person?.name ?? 'Unbekannt'}</Text>
        {gruppe && <Text style={styles.dabei}>{dabei.map((id) => alleNutzer[id].name.split(' ')[0]).join(', ')}</Text>}
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
        <Druck
          style={[styles.knopf, stumm && styles.knopfAn]}
          onPress={() => {
            setStumm(!stumm);
            onNotice(stumm ? 'Mikrofon an' : 'Mikrofon stumm');
          }}
        >
          <Ionicons name={stumm ? 'mic-off' : 'mic'} size={24} color={stumm ? colors.text : colors.white} />
          <Text style={[styles.knopfText, stumm && styles.knopfTextAn]}>Stumm</Text>
        </Druck>

        <Druck
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
        </Druck>

        <Druck
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
        </Druck>
      </View>

      <View style={styles.unten}>
        {zustand === 'klingelt' && (
          // In der Demo nimmt die Gegenseite von selbst ab - der Knopf
          // ueberspringt das Warten.
          <Druck style={[styles.rund, styles.annehmen]} onPress={() => setZustand('verbunden')}>
            <Ionicons name="call" size={28} color={colors.white} />
          </Druck>
        )}
        <Druck style={[styles.rund, styles.auflegen]} onPress={auflegen}>
          <Ionicons name="call" size={28} color={colors.white} style={styles.aufgelegt} />
        </Druck>
      </View>
    </View>
  );
};

const styles = themenStyles((colors) => ({
  /*
   * Vorher verteilte space-between Kopf, Bedienleiste und Anrufknöpfe über die
   * ganze Höhe — die Bedienleiste hing frei in der Mitte, oben und unten
   * klaffte eine Lücke. Jetzt steht der Kopf oben, und die beiden Knopfreihen
   * rücken als eine Gruppe an den unteren Rand, wie in jeder Anruf-Oberfläche.
   *
   * Der Verlauf statt der flachen Fläche gibt dem Bildschirm Tiefe und nimmt
   * die Markenfarbe auf; React Native kann keinen Verlauf als Hintergrundfarbe,
   * deshalb liegt er als eigene Fläche darunter (siehe schleier).
   */
  container: { flex: 1, backgroundColor: '#0A0C10', justifyContent: 'flex-start' },
  schleier: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },

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

  runde: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 260, marginBottom: 6 },
  dabei: { marginTop: 4, ...typography.preview, color: 'rgba(255,255,255,0.65)', textAlign: 'center' },
  /*
   * Der Block aus Bild, Name und Dauer nimmt den ganzen freien Platz und
   * zentriert sich darin. Vorher klebte er direkt unter der Statusleiste,
   * waehrend die Knoepfe unten standen - dazwischen lag ein Loch ueber die
   * halbe Bildschirmhoehe. Ein Anruf ist der Bildschirm, auf den man am
   * laengsten schaut; da faellt so etwas sofort auf.
   */
  kopf: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
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

  leiste: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, marginBottom: 28 },
  knopf: {
    alignItems: 'center',
    gap: 6,
    width: 76,
    paddingVertical: spacing.md,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  /* Eingeschaltet ist hell — das ist die Erwartung aus iOS. Ein Hauch weniger
     als reines Weiß, damit die Fläche auf Schwarz nicht sticht. */
  knopfAn: { backgroundColor: '#F2F3F6', borderColor: 'transparent' },
  knopfText: { color: colors.white, ...typography.small },
  knopfTextAn: { color: colors.text },

  unten: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xxl },
  rund: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  annehmen: {
    backgroundColor: '#17A458',
    shadowColor: '#12A150',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  auflegen: {
    backgroundColor: '#DC474C',
    shadowColor: '#E5484D',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  aufgelegt: { transform: [{ rotate: '135deg' }] },
}));
