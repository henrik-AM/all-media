import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Druck } from './Druck';
import { RechtstextSheet } from './RechtstextSheet';
import { KontoLoeschenSheet } from './KontoLoeschenSheet';
import { AuthContext } from '../contexts/AuthContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';

const Einwilligung = require('../../gemeinsam/einwilligung') as typeof import('../../gemeinsam/einwilligung');

/**
 * Die zweite Tür hinter der Anmeldung: Zustimmung zur geltenden Fassung.
 *
 * Kasten RS 7 (Auftrag Recht/Sicherheit 21.10.2026, Schema 106). Konten von
 * vor dem 24.10.2026 haben keiner Fassung zugestimmt, und wenn sich die
 * Nutzungsbedingungen ändern, müssen alle neu zustimmen (Nutzungsbedingungen
 * „Änderungen": zustimmen oder Konto löschen). Darum lässt sich dieser
 * Bildschirm nicht wegwischen — nur zustimmen, Konto löschen oder abmelden.
 *
 * Fehlt Schema 106 oder ist das Netz weg, sperrt er niemanden aus
 * (Einwilligung.offen liefert dann eine leere Liste); es wird beim nächsten
 * Start wieder gefragt. Gleiche Tür auf der Website in web/public/app.js
 * (bedingungenPruefen).
 */
export const NeueBedingungen = ({ children }: { children: React.ReactNode }) => {
  const { supabase } = useSupabase();
  const { user } = useContext(AuthContext);
  const [liste, setListe] = useState<import('../../gemeinsam/einwilligung').OffeneFassung[] | null>(null);

  const pruefen = useCallback(async () => {
    if (!supabase || !user) return setListe([]);
    const r = await Einwilligung.offen(supabase);
    // Netzfehler sperrt niemanden aus — beim nächsten Start wird wieder gefragt.
    setListe(r.ok ? r.liste : []);
  }, [supabase, user?.id]);

  useEffect(() => {
    setListe(null);
    void pruefen();
  }, [pruefen]);

  if (supabase && liste === null) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;
  if (liste && liste.length > 0) return <Zustimmen liste={liste} fertig={() => setListe([])} />;
  return <>{children}</>;
};

const Zustimmen = ({
  liste,
  fertig,
}: {
  liste: import('../../gemeinsam/einwilligung').OffeneFassung[];
  fertig: () => void;
}) => {
  const { supabase } = useSupabase();
  const { user, logout } = useContext(AuthContext);
  const [lesen, setLesen] = useState<string | null>(null);
  const [loeschen, setLoeschen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [arbeitet, setArbeitet] = useState(false);
  // Doppeltippen: der Zustand ist erst nach dem nächsten Zeichnen gesetzt (Gate 2, Fund 23).
  const laeuft = useRef(false);

  const zustimmen = async () => {
    if (laeuft.current) return;
    laeuft.current = true;
    setArbeitet(true);
    setFehler(null);
    const r = await Einwilligung.zustimmen(supabase, liste);
    laeuft.current = false;
    setArbeitet(false);
    if (r.ok) return fertig();
    setFehler(r.text);
  };

  const zeilen = Einwilligung.zeilen(liste);

  return (
    <SafeAreaView style={styles.fill}>
      <ScrollView contentContainerStyle={styles.mitte} testID="neue-bedingungen">
        <View style={styles.zeichen}>
          <Ionicons name="document-text-outline" size={32} color={colors.brand} />
        </View>
        <Text style={styles.titel}>Unsere Bedingungen</Text>
        <Text style={styles.text}>{Einwilligung.blattText(liste)}</Text>

        <View style={styles.liste}>
          {zeilen.map((z) => (
            <Druck
              key={z.dokument}
              style={styles.zeile}
              onPress={() => setLesen(z.dokument)}
              accessibilityRole="link"
              testID={`neue-bedingungen-${z.dokument}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.zeileTitel}>{z.titel}</Text>
                <Text style={styles.zeileKlein}>
                  Fassung {z.version}
                  {z.neu ? ' · neu' : ''}
                  {z.kenntnis ? ` · ${Einwilligung.KENNTNIS_ZUSATZ}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.text3} />
            </Druck>
          ))}
        </View>

        {user && <Text style={styles.klein}>Angemeldet als {user.profile.handle}</Text>}
        {fehler ? (
          <Text style={styles.fehler} accessibilityRole="alert" testID="neue-bedingungen-fehler">
            {fehler}
          </Text>
        ) : null}

        <Druck
          style={[styles.knopf, arbeitet && { opacity: 0.6 }]}
          onPress={zustimmen}
          disabled={arbeitet}
          accessibilityRole="button"
          testID="neue-bedingungen-zustimmen"
        >
          <Text style={styles.knopfText}>{Einwilligung.KNOPF}</Text>
        </Druck>
        <Druck style={styles.leise} onPress={() => setLoeschen(true)} accessibilityRole="button">
          <Text style={[styles.leiseText, { color: colors.danger }]}>Konto löschen</Text>
        </Druck>
        <Druck style={styles.leise} onPress={logout} accessibilityRole="button">
          <Text style={[styles.leiseText, { color: colors.text2 }]}>Abmelden</Text>
        </Druck>
      </ScrollView>

      {lesen && <RechtstextSheet id={lesen} onClose={() => setLesen(null)} />}
      <KontoLoeschenSheet
        visible={loeschen}
        onClose={() => setLoeschen(false)}
        // Die Datenauskunft sitzt in den Einstellungen; hier geht es nur ums Löschen.
        onDatenauskunft={() => setLoeschen(false)}
        onGeloescht={() => setLoeschen(false)}
      />
    </SafeAreaView>
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
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titel: { textAlign: 'center', color: colors.text, ...typography.h2 },
  text: { textAlign: 'center', color: colors.text2, ...typography.body, lineHeight: 21 },
  klein: { textAlign: 'center', color: colors.text3, ...typography.small },
  liste: { borderRadius: radius.soft, backgroundColor: colors.surface2, overflow: 'hidden' },
  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  zeileTitel: { color: colors.text, ...typography.body, fontWeight: '600' },
  zeileKlein: { color: colors.text3, ...typography.small },
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
}));
