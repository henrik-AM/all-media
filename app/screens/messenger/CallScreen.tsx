import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { colors, spacing, themenStyles, typography } from '../../constants/design';
import { useDaten } from '../../contexts/DatenContext';
import { useAktionen } from '../../lib/useAktionen';

const Anruf = require('../../../gemeinsam/anruf') as typeof import('../../../gemeinsam/anruf');

/*
 * Die Oberflaeche eines Anrufs.
 *
 * Die Uebertragung selbst fehlt: dafuer braucht es WebRTC, einen
 * Signalweg (Supabase Realtime) und einen TURN-Server - und WebRTC laeuft
 * nicht in Expo Go, sondern erst in einem eigenen Build.
 *
 * Kasten 5.1 (Henrik 28.09.2026: „Ist das nur eine Vorschau, oder könnte
 * die andere Person wirklich in Echtzeit drangehen?"): Es ist eine Vorschau.
 * Bis zum 10.10.2026 tat der Bildschirm trotzdem so, als nehme die
 * Gegenseite nach 2,6 Sekunden ab, und zaehlte eine Gespraechsdauer hoch,
 * die dann als „Anruf · 02:14" im Chat stand. Das war eine erfundene
 * Anzeige. Jetzt:
 *
 *   gestartet -> beendet
 *
 * Beim Start steht der Anruf im Chat (Kasten 5.2, Schema 89), bei beiden
 * gleich (5.4). Es gibt kein „verbunden" und keine Dauer, solange niemand
 * verbunden sein kann. Gleiche Regel auf der Website (openCall).
 */

type Zustand = 'gestartet' | 'beendet';

interface Props {
  /** Bei einem Gruppenanruf leer - dann zaehlen name und teilnehmer. */
  userId?: string;
  /** Name der Gruppe. */
  gruppenName?: string;
  /** Kennungen der Mitglieder. */
  teilnehmer?: string[];
  /**
   * Der Chat, aus dem angerufen wird (Person, Gruppe, Community-Chat).
   * Fehlt er, geht der Eintrag in den Messenger-Zweierchat mit userId.
   */
  chatId?: string;
  /** Das Unterthema einer Community, wenn von dort angerufen wird. */
  kanalId?: string;
  art: 'audio' | 'video';
  onClose: () => void;
  onNotice: (message: string) => void;
}

/** Sekunden als mm:ss, ab einer Stunde als h:mm:ss — Rechnung in gemeinsam/anruf.js. */
export const dauerText = (sekunden: number) => Anruf.dauerText(sekunden);

export const CallScreen = ({ userId, gruppenName, teilnehmer = [], chatId, kanalId, art, onClose, onNotice }: Props) => {
  const { users: alleNutzer, neuLaden } = useDaten();
  const aktionen = useAktionen(onNotice);
  const insets = useSafeAreaInsets();
  const gruppe = !userId && !!gruppenName;
  const person = userId ? alleNutzer[userId] : undefined;
  const dabei = teilnehmer.filter((id) => alleNutzer[id]);

  const [zustand, setZustand] = useState<Zustand>('gestartet');
  const [stumm, setStumm] = useState(false);
  const [lautsprecher, setLautsprecher] = useState(art === 'video');
  const [kameraAn, setKameraAn] = useState(art === 'video');

  /*
   * Kasten 5.2: der Eintrag entsteht beim Start, einmal. Der Bildschirm
   * kann in der Entwicklung doppelt aufgebaut werden (StrictMode) — der
   * Riegel verhindert zwei Eintraege fuer einen Anruf.
   */
  const vermerkt = useRef(false);
  useEffect(() => {
    if (vermerkt.current) return;
    vermerkt.current = true;
    if (!chatId && !kanalId && !userId) return;
    void aktionen
      .anrufStarten({ chatId: chatId ?? null, kanalId: kanalId ?? null, zielId: userId ?? null }, art)
      // Danach neu laden, sonst steht der Eintrag zwar in der Datenbank,
      // aber nicht im Chat, in den man gleich zurueckkehrt.
      .then((id) => {
        if (id) neuLaden();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const auflegen = () => {
    setZustand('beendet');
    // Der Eintrag steht seit dem Start im Chat; beim Auflegen kommt nichts
    // dazu — es gab kein Gespraech, also auch keine Dauer.
    onNotice('Anruf beendet');
    setTimeout(onClose, 700);
  };

  const statusText = zustand === 'gestartet' ? `${Anruf.artName(art)} gestartet` : 'Beendet';

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
      <LinearGradient
        colors={['rgba(91,69,224,0.22)', 'transparent']}
        style={styles.schleier}
        pointerEvents="none"
      />

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
          <Avatar id={userId ?? 'me'} name={person?.name ?? 'Unbekannt'} size={124} />
        )}
        <Text style={styles.name}>{gruppe ? gruppenName : person?.name ?? 'Unbekannt'}</Text>
        {gruppe && <Text style={styles.dabei}>{dabei.map((id) => alleNutzer[id].name.split(' ')[0]).join(', ')}</Text>}
        <Text style={styles.status} accessibilityLabel="Anrufstatus">{statusText}</Text>
        {/*
          Kasten 5.1: offen sagen, was dieser Bildschirm ist. Ohne den Satz
          wartet man auf ein Abheben, das nicht kommen kann.
        */}
        <Text style={styles.vorschau}>
          Vorschau: Sprache und Bild werden noch nicht übertragen.{'\n'}
          {gruppe ? 'Die anderen sehen' : `${person?.name?.split(' ')[0] ?? 'Die andere Person'} sieht`} den
          Anruf im Chat, annehmen geht noch nicht.
        </Text>
        {/*
          Hier stand bis zum 07.09.2026 „Ende-zu-Ende-verschlüsselt".

          Das war unzutreffend, und zwar doppelt: verschlüsselt wurde damals
          nichts, und ein Anruf wird es auch jetzt nicht. Seit Schema 31 sind
          Textnachrichten in Chats zu zweit verschlüsselt — Sprache und Bild
          nicht. Sie laufen noch nicht einmal, die Übertragung fehlt (WebRTC
          braucht einen eigenen Build und läuft in Expo Go nicht).

          Ein Schloss an dieser Stelle wäre also weiterhin eine Zusage, die
          niemand einhält. Deshalb steht hier nichts, bis die Übertragung da
          und verschlüsselt ist. Lieber keine Angabe als eine falsche.
        */}
      </View>

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
        {/* Kein „Annehmen" mehr: wer anruft, nimmt nicht selbst ab, und eine
            Gegenseite, die abnehmen koennte, gibt es noch nicht (5.1). */}
        <Druck style={[styles.rund, styles.auflegen]} onPress={auflegen} accessibilityLabel="Auflegen">
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
  vorschau: {
    marginTop: spacing.sm,
    maxWidth: 280,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.45)',
    ...typography.small,
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
