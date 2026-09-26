import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Modal, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Druck } from './Druck';
import { AuthContext } from '../contexts/AuthContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { useDaten } from '../contexts/DatenContext';
import {
  Einwilligung,
  Kontostand,
  datumTippen,
  einwilligungEntscheiden,
  einwilligungenLaden,
  elternAnfragen,
  geburtsdatumNachtragen,
  kontostandLaden,
} from '../lib/registrierung';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';

/** Wie oft nachgesehen wird, ob sich etwas getan hat. */
const WARTEN_MS = 15_000;
const ELTERN_MS = 60_000;

/**
 * Die Tür hinter der Anmeldung.
 *
 * Ein Konto unter der Altersgrenze seines Landes ist angelegt, aber gesperrt,
 * bis ein Elternteil von seinem eigenen All-Media-Konto aus zustimmt
 * (Henrik 22.09.2026). Die Sperre selbst sitzt in der Datenbank: jede Tabelle
 * hat seit Schema 52 die einschränkende Regel `nur_freigegebene`. Diese
 * Komponente sagt nur, warum die App leer bliebe — und was zu tun ist.
 *
 * Für freigegebene Konten zeichnet sie die App und fragt nebenher, ob ein Kind
 * auf die eigene Zustimmung wartet. Gleiche Tür auf der Website in
 * web/public/app.js (freigabePruefen).
 */
export const KontoFreigabe = ({ children }: { children: React.ReactNode }) => {
  const { supabase } = useSupabase();
  const { user } = useContext(AuthContext);
  const { neuLaden } = useDaten();
  const [stand, setStand] = useState<Kontostand | null>(null);
  const warFrei = useRef(true);

  const pruefen = useCallback(async () => {
    if (!supabase || !user) return;
    const neu = await kontostandLaden(supabase);
    // Ein Netzfehler sperrt niemanden aus; die Datenbank tut es ohnehin.
    setStand(neu ?? { stand: 'frei' });
  }, [supabase, user?.id]);

  useEffect(() => {
    setStand(null);
    void pruefen();
  }, [pruefen]);

  const frei = !supabase || stand?.stand === 'frei' || stand?.stand === 'abgemeldet';

  // Gerade freigegeben: alles, was während der Sperre leer geladen wurde, neu holen.
  useEffect(() => {
    if (stand && frei && !warFrei.current) void neuLaden();
    if (stand) warFrei.current = frei;
  }, [stand, frei]);

  useEffect(() => {
    if (frei) return;
    const uhr = setInterval(pruefen, WARTEN_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && pruefen());
    return () => {
      clearInterval(uhr);
      sub.remove();
    };
  }, [frei, pruefen]);

  if (supabase && !stand) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;
  if (!frei && stand) return <Wartebildschirm stand={stand} pruefen={pruefen} />;

  return (
    <>
      {children}
      {supabase && user && <Elternfrage />}
    </>
  );
};

// ------------------------------------------------------------ Kind wartet --

const Wartebildschirm = ({ stand, pruefen }: { stand: Kontostand; pruefen: () => Promise<void> }) => {
  const { supabase } = useSupabase();
  const { user, logout } = useContext(AuthContext);
  const [eingabe, setEingabe] = useState('');
  const [meldung, setMeldung] = useState<string | null>(null);
  const [arbeitet, setArbeitet] = useState(false);

  const ohneDatum = stand.stand === 'ohne_datum';
  const abgelehnt = stand.stand === 'abgelehnt';
  const ohneEltern = stand.stand === 'wartet' && !stand.eltern;

  const titel = ohneDatum
    ? 'Geburtsdatum fehlt'
    : abgelehnt
    ? 'Nicht bestätigt'
    : ohneEltern
    ? 'Zustimmung nötig'
    : 'Warte auf Zustimmung';

  const text = ohneDatum
    ? 'Seit dem 22.09.2026 braucht jedes neue Konto ein Geburtsdatum, weil jedes Land eine eigene Altersgrenze hat. Bitte trag deines nach.'
    : abgelehnt
    ? `${stand.eltern ?? 'Dein Elternteil'} hat dein Konto nicht bestätigt. Du kannst einen anderen Elternteil fragen.`
    : ohneEltern
    ? `In ${stand.land ?? 'deinem Land'} brauchst du unter ${stand.mindestalter} Jahren die Zustimmung eines Elternteils. Gib die Telefonnummer ein, mit der dein Elternteil bei All Media ist.`
    : `${stand.eltern} muss dein Konto bestätigen. Dafür öffnet dein Elternteil All Media im eigenen Konto — die Anfrage erscheint dort von selbst.`;

  const absenden = async () => {
    if (!supabase || !eingabe.trim()) return;
    setArbeitet(true);
    setMeldung(null);
    const antwort = ohneDatum
      ? await geburtsdatumNachtragen(supabase, eingabe)
      : await elternAnfragen(supabase, eingabe);
    setArbeitet(false);
    if (!antwort.ok) return setMeldung(antwort.meldung || 'Das hat nicht geklappt.');
    setEingabe('');
    await pruefen();
  };

  // Wer schon auf jemanden wartet, kann trotzdem umschwenken.
  const [anderer, setAnderer] = useState(false);
  const mitFeld = ohneDatum || abgelehnt || ohneEltern || anderer;

  return (
    <SafeAreaView style={styles.fill}>
      <ScrollView contentContainerStyle={styles.mitte} keyboardShouldPersistTaps="handled">
        <View style={styles.zeichen}>
          <Ionicons name={ohneDatum ? 'calendar-outline' : 'people-outline'} size={32} color={colors.brand} />
        </View>
        <Text style={styles.titel}>{titel}</Text>
        <Text style={styles.text}>{text}</Text>
        {user && <Text style={styles.klein}>Angemeldet als {user.profile.handle}</Text>}

        {mitFeld && (
          <View style={styles.feld}>
            <TextInput
              style={styles.input}
              value={eingabe}
              onChangeText={(t) => setEingabe(ohneDatum ? datumTippen(t) : t)}
              placeholder={ohneDatum ? 'Geburtsdatum (TT.MM.JJJJ)' : 'Telefonnummer deines Elternteils'}
              placeholderTextColor={colors.text3}
              keyboardType={ohneDatum ? 'number-pad' : 'phone-pad'}
              maxLength={ohneDatum ? 10 : 24}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!arbeitet}
              accessibilityLabel={ohneDatum ? 'Geburtsdatum' : 'Telefonnummer deines Elternteils'}
            />
          </View>
        )}
        {meldung ? <Text style={styles.fehler}>{meldung}</Text> : null}

        {mitFeld ? (
          <Druck style={[styles.knopf, arbeitet && { opacity: 0.6 }]} onPress={absenden} disabled={arbeitet}>
            <Text style={styles.knopfText}>{ohneDatum ? 'Speichern' : 'Anfrage senden'}</Text>
          </Druck>
        ) : (
          <>
            <Druck style={styles.knopf} onPress={pruefen}>
              <Text style={styles.knopfText}>Erneut prüfen</Text>
            </Druck>
            <Druck style={styles.leise} onPress={() => setAnderer(true)}>
              <Text style={styles.leiseText}>Anderen Elternteil fragen</Text>
            </Druck>
          </>
        )}

        <Druck style={styles.leise} onPress={logout}>
          <Text style={[styles.leiseText, { color: colors.text2 }]}>Abmelden</Text>
        </Druck>
      </ScrollView>
    </SafeAreaView>
  );
};

// ---------------------------------------------------- Elternteil stimmt zu --

const Elternfrage = () => {
  const { supabase } = useSupabase();
  const { user } = useContext(AuthContext);
  const [offen, setOffen] = useState<Einwilligung[]>([]);
  const [arbeitet, setArbeitet] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);

  const laden = useCallback(async () => {
    if (!supabase) return;
    setOffen(await einwilligungenLaden(supabase));
  }, [supabase, user?.id]);

  useEffect(() => {
    setOffen([]);
    void laden();
    const uhr = setInterval(laden, ELTERN_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && laden());
    return () => {
      clearInterval(uhr);
      sub.remove();
    };
  }, [laden]);

  const kind = offen[0];
  if (!kind) return null;

  const entscheiden = async (zustimmen: boolean) => {
    if (!supabase) return;
    setArbeitet(true);
    setMeldung(null);
    const antwort = await einwilligungEntscheiden(supabase, kind.kind, zustimmen);
    setArbeitet(false);
    if (!antwort.ok) return setMeldung(antwort.meldung || 'Das hat nicht geklappt.');
    setOffen((v) => v.slice(1));
  };

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.schleier}>
        <View style={styles.karte}>
          <View style={styles.zeichen}>
            <Ionicons name="shield-checkmark-outline" size={30} color={colors.brand} />
          </View>
          <Text style={styles.titel}>Zustimmung als Elternteil</Text>
          <Text style={styles.text}>
            {kind.name} ({kind.handle}, {kind.alter} Jahre) hat dich als Elternteil angegeben. In {kind.land} braucht
            ein Konto unter {kind.mindestalter} Jahren die Zustimmung eines Elternteils.
          </Text>
          {kind.telefon ? <Text style={styles.klein}>Telefonnummer des Kontos: {kind.telefon}</Text> : null}
          <Text style={styles.klein}>
            Stimmst du zu, kann {kind.handle} All Media nutzen. Lehnst du ab, bleibt das Konto gesperrt.
          </Text>
          {meldung ? <Text style={styles.fehler}>{meldung}</Text> : null}
          <Druck
            style={[styles.knopf, arbeitet && { opacity: 0.6 }]}
            onPress={() => entscheiden(true)}
            disabled={arbeitet}
          >
            <Text style={styles.knopfText}>Zustimmen</Text>
          </Druck>
          <Druck style={styles.leise} onPress={() => entscheiden(false)} disabled={arbeitet}>
            <Text style={[styles.leiseText, { color: colors.danger }]}>Ablehnen</Text>
          </Druck>
        </View>
      </View>
    </Modal>
  );
};

const styles = themenStyles((colors) => ({
  fill: { flex: 1, backgroundColor: colors.surface },
  mitte: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  zeichen: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  titel: { textAlign: 'center', color: colors.text, ...typography.h2 },
  text: { textAlign: 'center', color: colors.text2, ...typography.body, lineHeight: 21 },
  klein: { textAlign: 'center', color: colors.text3, ...typography.small },
  feld: {
    height: 52,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radius.soft,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  input: { color: colors.text, ...typography.body },
  fehler: { textAlign: 'center', color: colors.danger, ...typography.preview },
  knopf: {
    height: 50,
    borderRadius: radius.soft,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  knopfText: { color: colors.white, ...typography.h3 },
  leise: { alignItems: 'center', paddingVertical: spacing.sm },
  leiseText: { color: colors.brand, ...typography.body },

  schleier: {
    flex: 1,
    backgroundColor: 'rgba(6,8,12,0.52)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  karte: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
}));
