import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useDaten } from '../../contexts/DatenContext';
import { useEinstellungen } from '../../contexts/EinstellungenContext';
import { useAktionen } from '../../lib/useAktionen';
import { ladeSpendenSumme, ladeStreamKommentare } from '../../lib/daten';
import * as Aktion from '../../lib/aktionen';

interface Props {
  /** Nach dem Ende — ob die Aufzeichnung veroeffentlicht oder geloescht wurde. */
  onEnd: (veroeffentlicht: boolean) => void;
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
 * echt: die Zeit laeuft mit, die Zuschauerzahl waechst, und nach dem Ende
 * entscheidet der Host, ob die Aufzeichnung als Querformat-Video erscheint.
 */
export const LivestreamScreen = ({ onEnd, onStart, onNotice }: Props) => {
  const insets = useSafeAreaInsets();
  const { supabase } = useSupabase();
  const { ichId } = useDaten();
  const aktionen = useAktionen(onNotice);
  const einstellungen = useEinstellungen();
  const [sekunden, setSekunden] = useState(0);
  const [zuschauer, setZuschauer] = useState(0);
  /** Gesendet ist, jetzt steht die Wahl: veroeffentlichen oder loeschen. */
  const [vorbei, setVorbei] = useState(false);
  const [schliesst, setSchliesst] = useState(false);

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
      format: 'live',
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
  const fehlschlaege = useRef(0);
  const holen = useCallback(async () => {
    if (!supabase || !postId) return;
    try {
      const [neue, summe] = await Promise.all([
        ladeStreamKommentare(supabase, postId),
        ladeSpendenSumme(supabase, postId),
      ]);
      setKommentare(neue);
      setSpenden(summe);
      fehlschlaege.current = 0;
    } catch (e: any) {
      /* Ein Aussetzer im Vier-Sekunden-Takt holt die naechste Runde nach -
         als Fehler gemeldet, deckte die LogBox die Spalte zu (28.09.2026).
         Erst drei hintereinander sind eine Stoerung. Gleiche Regel im
         ClipPlayerScreen und in web/public/app.js. */
      fehlschlaege.current += 1;
      if (fehlschlaege.current === 3) console.warn('Streamkommentare laden fehlgeschlagen:', e?.message ?? e);
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
  const stand = useRef({ sekunden: 0, zuschauer: 0, vorbei: false });

  useEffect(() => {
    const uhr = setInterval(() => {
      if (stand.current.vorbei) return;
      stand.current.sekunden += 1;
      if (stand.current.sekunden % 3 === 0) stand.current.zuschauer += 1;
      setSekunden(stand.current.sekunden);
      setZuschauer(stand.current.zuschauer);
    }, 1000);
    return () => clearInterval(uhr);
  }, []);

  /*
   * Henrik am 28.09.2026: erst nach dem Ende entscheidet der Host, ob die
   * Aufzeichnung als normales Querformat-Video erscheint — oder er stellt
   * vorher ein, dass das ohne Rueckfrage geschieht. Gleicher Ablauf auf der
   * Website (openLivestream).
   */
  const auto = einstellungen.an('liveAutoVeroeffentlichen');

  const abschliessen = async (veroeffentlichen: boolean) => {
    if (schliesst) return;
    setSchliesst(true);
    try {
      if (supabase && ichId && postId) {
        await Aktion.liveBeenden(supabase, ichId, postId, {
          veroeffentlichen,
          sekunden: stand.current.sekunden,
          zuschauer: stand.current.zuschauer,
        });
      } else if (supabase && ichId) {
        // Ohne Beitrag gibt es nichts zu entscheiden, nur das Profil zu leeren.
        await Aktion.livestreamSetzen(supabase, ichId, null);
      }
      onEnd(veroeffentlichen && !!postId);
    } catch (e: any) {
      setSchliesst(false);
      onNotice?.(e?.message ?? 'Das ging nicht durch');
    }
  };

  const beenden = () => {
    stand.current.vorbei = true;
    stand.current.sekunden = Math.max(1, stand.current.sekunden);
    if (auto) return void abschliessen(true);
    setVorbei(true);
  };

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

      {!vorbei && (
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
      )}

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
        {vorbei ? (
          <>
            <Text style={styles.endeText}>
              Livestream beendet · {zweistellig(Math.floor(sekunden / 60))}:{zweistellig(sekunden % 60)} · {zuschauer} Zuschauer
            </Text>
            <Druck style={styles.stop} onPress={() => abschliessen(true)} disabled={schliesst}>
              <Text style={styles.stopText}>Als Video veröffentlichen</Text>
            </Druck>
            <Druck style={styles.zweit} onPress={() => abschliessen(false)} disabled={schliesst}>
              <Text style={styles.stopText}>Aufzeichnung löschen</Text>
            </Druck>
          </>
        ) : (
          <>
            <View style={styles.auto}>
              <Text style={styles.autoText}>Aufzeichnung automatisch veröffentlichen</Text>
              <Switch
                value={auto}
                onValueChange={(an) => void einstellungen.setzen('liveAutoVeroeffentlichen', an ? 'an' : 'aus')}
                accessibilityLabel="Aufzeichnung automatisch veröffentlichen"
              />
            </View>
            <Druck style={styles.stop} onPress={beenden} disabled={schliesst}>
              <Text style={styles.stopText}>Livestream beenden</Text>
            </Druck>
          </>
        )}
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
  zweit: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endeText: { ...typography.message, color: colors.white, textAlign: 'center' },
  auto: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  autoText: { flex: 1, ...typography.small, color: '#B9BDC6' },
}));
