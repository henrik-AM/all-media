import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useDaten } from '../../contexts/DatenContext';
import { useAktionen } from '../../lib/useAktionen';
import { ladeSpendenSumme, ladeStreamKommentare } from '../../lib/daten';
import * as Aktion from '../../lib/aktionen';

interface Props {
  /** Bekommt Dauer in Sekunden und die erreichte Zuschauerzahl. */
  onEnd: (sekunden: number, zuschauer: number) => void;
  /** Einmal beim Aufmachen — damit im eigenen Profil steht, dass gesendet wird. */
  onStart?: () => void;
  onNotice?: (text: string) => void;
}

interface Kommentar {
  id: string;
  name: string;
  text: string;
  zeit: string;
}

const zweistellig = (n: number) => String(n).padStart(2, '0');

/**
 * Prototyp-Frame "VP + erstellen" -> Livestream.
 *
 * Ohne Streaming-Server gibt es kein echtes Bild. Was hier steht, ist alles
 * echt: die Zeit laeuft mit, die Zuschauerzahl waechst, und beim Beenden
 * bleibt die Aufzeichnung im Querformat-Bereich stehen.
 */
export const LivestreamScreen = ({ onEnd, onStart, onNotice }: Props) => {
  const insets = useSafeAreaInsets();
  const { supabase } = useSupabase();
  const { ichId } = useDaten();
  const aktionen = useAktionen(onNotice);
  const [sekunden, setSekunden] = useState(0);
  const [zuschauer, setZuschauer] = useState(0);

  /*
   * Die Live-Kommentarspalte aus dem Handbuch.
   *
   * Damit Kommentare und Spenden irgendwo hingehoeren koennen, wird der
   * Stream beim Start als Beitrag angelegt und nicht erst am Ende. Vorher
   * gab es waehrend der Sendung nichts, worauf sich etwas beziehen konnte —
   * und deshalb auch keine Kommentare und keine Spenden, obwohl der
   * Spendencode in den Einstellungen genau dafuer da ist.
   *
   * Am Ende bleibt derselbe Beitrag als Aufzeichnung stehen. Ein zweiter
   * waere ein Duplikat, und die Kommentare haetten am falschen geklebt.
   */
  const [postId, setPostId] = useState<string | null>(null);
  const [kommentare, setKommentare] = useState<Kommentar[]>([]);
  const [spenden, setSpenden] = useState(0);
  const [entwurf, setEntwurf] = useState('');

  // Einmal beim Aufmachen: ab jetzt steht im eigenen Profil, dass gesendet
  // wird. Vorher wusste das nur dieser Bildschirm.
  useEffect(() => {
    onStart?.();

    if (!supabase || !ichId) return;
    let abgebrochen = false;
    Aktion.beitragAnlegen(supabase, ichId, {
      art: 'clip',
      titel: 'Livestream',
      beschreibung: 'Läuft gerade',
    })
      .then((id) => {
        if (!abgebrochen) setPostId(id);
      })
      .catch((e: any) => {
        // Nicht am Senden hindern. Ohne Beitrag gibt es nur keine
        // Kommentarspalte — das ist schlechter, aber kein Grund, den Stream
        // gar nicht erst anzufangen.
        console.error('Livestream-Beitrag anlegen fehlgeschlagen:', e?.message ?? e);
        onNotice?.('Die Kommentarspalte konnte nicht geöffnet werden');
      });

    return () => {
      abgebrochen = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Die Spalte alle vier Sekunden nachladen.
   *
   * Ein Live-Abo ueber Supabase Realtime waere schoener, braeuchte aber eine
   * eigene Verbindung, die beim Abbruch wieder sauber zugehen muss. Vier
   * Sekunden sind bei einer Kommentarspalte nicht zu bemerken; die
   * Zuschauerzahl daneben laeuft ohnehin im Sekundentakt.
   */
  const holen = useCallback(async () => {
    if (!supabase || !postId) return;
    try {
      const [neue, summe] = await Promise.all([
        ladeStreamKommentare(supabase, postId),
        ladeSpendenSumme(supabase, postId),
      ]);
      setKommentare(neue);
      setSpenden(summe);
    } catch (e: any) {
      console.error('Streamkommentare laden fehlgeschlagen:', e?.message ?? e);
    }
  }, [supabase, postId]);

  useEffect(() => {
    if (!postId) return;
    holen();
    const uhr = setInterval(holen, 4000);
    return () => clearInterval(uhr);
  }, [postId, holen]);

  const senden = async () => {
    const text = entwurf.trim();
    if (!text || !postId) return;
    setEntwurf('');
    const id = await aktionen.streamKommentar(postId, text);
    if (id) holen();
  };

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

      {/*
        * Die Live-Kommentarspalte. Sie steht ueber der Leiste und nicht in
        * einem Blatt: waehrend einer Sendung ist sie das Gegenueber, und
        * etwas, das man erst aufklappen muss, liest niemand.
        */}
      <View style={styles.spalte}>
        <FlatList
          data={kommentare}
          keyExtractor={(k) => k.id}
          inverted
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.kommentar}>
              <Text style={styles.kommentarName}>{item.name}</Text>
              <Text style={styles.kommentarText}>{item.text}</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.spalteLeer}>
              {postId ? 'Noch keine Kommentare.' : 'Kommentarspalte wird geöffnet …'}
            </Text>
          }
        />
      </View>

      <View style={styles.eingabe}>
        <TextInput
          style={styles.feld}
          value={entwurf}
          onChangeText={setEntwurf}
          placeholder="Etwas sagen …"
          placeholderTextColor="#6B7280"
          editable={!!postId}
          onSubmitEditing={senden}
          returnKeyType="send"
        />
        <Druck style={styles.senden} onPress={senden} disabled={!entwurf.trim() || !postId}>
          <Ionicons name="send" size={16} color={colors.white} />
        </Druck>
      </View>

      <View style={[styles.leiste, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.zahlen}>
          <Text style={styles.zuschauer}>
            {zuschauer} {zuschauer === 1 ? 'Zuschauer' : 'Zuschauer'}
          </Text>
          {/* Spenden waehrend des Streams — das Handbuch nennt sie
              ausdruecklich ("Geld senden/spenden -> bei Spendenlinks und
              Livestreams"). Der Betrag steht in Euro, gerechnet wird in Cent. */}
          {spenden > 0 && (
            <Text style={styles.spenden}>
              {(spenden / 100).toFixed(2).replace('.', ',')} € gespendet
            </Text>
          )}
        </View>
        <Druck
          style={styles.stop}
          onPress={() => onEnd(Math.max(1, stand.current.sekunden), stand.current.zuschauer)}
        >
          <Text style={styles.stopText}>Livestream beenden</Text>
        </Druck>
      </View>
    </View>
  );
};

const styles = themenStyles((colors) => ({
  spalte: { maxHeight: 190, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  spalteLeer: { ...typography.small, color: '#6B7280', paddingVertical: spacing.sm },
  kommentar: { flexDirection: 'row', gap: 6, paddingVertical: 3 },
  kommentarName: { ...typography.small, color: colors.brand2, fontWeight: '700' },
  kommentarText: { flex: 1, ...typography.small, color: '#D6D9E0' },
  eingabe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  feld: {
    flex: 1,
    height: 38,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: colors.white,
  },
  senden: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zahlen: { alignItems: 'center', gap: 3 },
  spenden: { ...typography.small, color: '#7CE38B' },

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
}));
