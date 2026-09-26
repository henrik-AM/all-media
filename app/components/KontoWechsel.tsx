import React, { useContext, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Druck } from './Druck';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { AuthContext } from '../contexts/AuthContext';
import { PASSWORT_REGEL, passwortPruefen } from '../lib/supabaseAuth';
import { useSupabase } from '../contexts/SupabaseContext';
import { NeuesKonto, neuesKontoPruefen } from '../lib/registrierung';
import { RegistrierFelder } from './RegistrierFelder';
import { colors, radius, sizes, spacing, themenStyles, typography } from '../constants/design';

interface Props {
  visible: boolean;
  onClose: () => void;
  onNotice: (message: string) => void;
}

type Ansicht = 'liste' | 'anmelden' | 'neu';

/**
 * Zwischen mehreren eigenen Konten umschalten - wie die Kontoliste bei
 * Instagram. Bereits angemeldete Konten brauchen kein Passwort mehr.
 */
export const KontoWechsel = ({ visible, onClose, onNotice }: Props) => {
  const insets = useSafeAreaInsets();
  const { user, konten, frueher, frueheresVergessen, wechsleZu, kontoHinzufuegen, kontoAbmelden } =
    useContext(AuthContext);

  const [ansicht, setAnsicht] = useState<Ansicht>('liste');
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [name, setName] = useState('');
  const leer: NeuesKonto = { handle: '', telefon: '', geburtsdatum: '', eltern: '' };
  const [neu, setNeu] = useState<NeuesKonto>(leer);
  const [arbeitet, setArbeitet] = useState(false);
  // Fehler stehen im Blatt: onNotice zeigt den Toast des Hauptscreens, und
  // der liegt hinter dem Modal (26.09.2026 im Simulator gesehen).
  const [meldung, setMeldung] = useState('');
  const { supabase } = useSupabase();

  const schliessen = () => {
    setAnsicht('liste');
    setEmail('');
    setPasswort('');
    setName('');
    setNeu(leer);
    setMeldung('');
    onClose();
  };

  /*
   * Erst wechseln, dann melden.
   *
   * Bis zum 07.09.2026 stand die Meldung vor dem Wechsel und wechsleZu() gab
   * nichts zurueck — „Gewechselt zu Anna" erschien also auch dann, wenn die
   * Sitzung von Anna laengst abgelaufen war. Jetzt sagt der Wechsel, ob er
   * geklappt hat, und das Blatt bleibt im Fehlerfall offen.
   */
  const wechseln = async (id: string) => {
    if (id === user?.id) return schliessen();
    const konto = konten.find((k) => k.id === id);
    const geklappt = await wechsleZu(id);
    if (!geklappt) {
      onNotice(`${konto?.profile.name ?? 'Das Konto'} ist abgemeldet. Bitte neu anmelden.`);
      return;
    }
    onNotice(`Gewechselt zu ${konto?.profile.name ?? 'Konto'}`);
    schliessen();
  };

  const anmelden = async () => {
    if (!email.trim()) return setMeldung('Bitte E-Mail eingeben');
    if (!passwort.trim()) return setMeldung('Bitte Passwort eingeben');
    setMeldung('');
    try {
      await kontoHinzufuegen(email.trim(), passwort);
      onNotice(`Angemeldet als ${email.trim()}`);
      schliessen();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen';
      setMeldung(msg);
    }
  };

  /*
   * Wer schon einmal hier angemeldet war, steht als Zeile da — ein Tipp legt
   * die E-Mail ins Feld, es fehlt nur noch das Passwort. Konten mit lebender
   * Sitzung stehen bereits oben, die blendet die Liste aus.
   */
  const offeneFrueher = frueher.filter((f) => !konten.some((k) => k.id === f.id));

  const frueherWaehlen = (mail: string) => {
    setEmail(mail);
    setPasswort('');
    setAnsicht('anmelden');
  };

  const neuErstellen = async () => {
    if (!name.trim()) return setMeldung('Bitte einen Namen eingeben');
    if (!email.trim()) return setMeldung('Bitte E-Mail eingeben');
    // Die Regel steht in gemeinsam/passwort.js — dieselbe, die Supabase
    // durchsetzt. Sechs Zeichen hier durchzulassen hiess bisher, den
    // englischen Fehler von Supabase als Systemmeldung zu bekommen.
    const schwach = passwortPruefen(passwort);
    if (schwach) return setMeldung(schwach);
    /*
     * Bis zum 22.09.2026 entstand hier ein Konto ohne Telefonnummer, mit
     * einem aus dem Namen geratenen Benutzernamen und ohne Alter. Jetzt
     * dieselben Pflichtfelder wie im Anmeldebildschirm — lib/registrierung.ts.
     */
    setMeldung('');
    const konto: NeuesKonto = { ...neu, name: name.trim() };
    setArbeitet(true);
    try {
      const grund = await neuesKontoPruefen(supabase, konto);
      if (grund) return setMeldung(grund);
      await kontoHinzufuegen(email.trim(), passwort, konto);
      onNotice(`Konto für ${name.trim()} erstellt`);
      schliessen();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Kontenerstellung fehlgeschlagen';
      setMeldung(msg);
    } finally {
      setArbeitet(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={schliessen}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Druck style={styles.backdrop} onPress={schliessen} />

        <View style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]}>
          <View style={styles.handle} />

          <View style={styles.head}>
            {ansicht !== 'liste' && (
              <Druck onPress={() => { setAnsicht('liste'); setMeldung(''); }} hitSlop={8} style={styles.back}>
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </Druck>
            )}
            <Text style={styles.title}>
              {ansicht === 'liste' ? 'Konto wechseln' : ansicht === 'anmelden' ? 'Konto anmelden' : 'Neues Konto'}
            </Text>
          </View>

          {ansicht === 'liste' ? (
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
              {konten.map((konto) => {
                const aktiv = konto.id === user?.id;
                return (
                  <Druck key={konto.id} style={styles.zeile} onPress={() => wechseln(konto.id)}>
                    <Avatar id={konto.profile.id} name={konto.profile.name} size={sizes.avatarMd} />
                    <View style={styles.zeileBody}>
                      <Text style={styles.zeileName}>{konto.profile.name}</Text>
                      <Text style={styles.zeileSub}>{konto.email}</Text>
                    </View>
                    {aktiv ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.brand} />
                    ) : (
                      <Druck
                        hitSlop={8}
                        onPress={async () => {
                          try {
                            await kontoAbmelden(konto.id);
                            onNotice(`${konto.profile.name} abgemeldet`);
                          } catch (e) {
                            onNotice('Fehler beim Abmelden');
                          }
                        }}
                      >
                        <Ionicons name="close" size={20} color={colors.text3} />
                      </Druck>
                    )}
                  </Druck>
                );
              })}

              {offeneFrueher.length > 0 && (
                <>
                  <Text style={styles.gruppe}>Zuletzt verwendet</Text>
                  {offeneFrueher.map((konto) => (
                    <Druck
                      key={konto.id}
                      style={styles.zeile}
                      onPress={() => frueherWaehlen(konto.email)}
                    >
                      <Avatar id={konto.id} name={konto.name} size={sizes.avatarMd} />
                      <View style={styles.zeileBody}>
                        <Text style={styles.zeileName}>{konto.name}</Text>
                        <Text style={styles.zeileSub}>{konto.email}</Text>
                      </View>
                      <Druck hitSlop={8} onPress={() => frueheresVergessen(konto.id)}>
                        <Ionicons name="close" size={20} color={colors.text3} />
                      </Druck>
                    </Druck>
                  ))}
                </>
              )}

              <Druck style={styles.zeile} onPress={() => setAnsicht('anmelden')}>
                <View style={styles.rund}>
                  <Ionicons name="person-add-outline" size={20} color={colors.brand} />
                </View>
                <Text style={styles.aktionText}>Bestehendes Konto hinzufügen</Text>
              </Druck>

              <Druck style={styles.zeile} onPress={() => setAnsicht('neu')}>
                <View style={styles.rund}>
                  <Ionicons name="add" size={22} color={colors.brand} />
                </View>
                <Text style={styles.aktionText}>Neues Konto erstellen</Text>
              </Druck>
            </ScrollView>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
              {ansicht === 'neu' && (
                <View style={styles.feld}>
                  <Text style={styles.label}>Name</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Wie sollen dich andere sehen?"
                    placeholderTextColor={colors.text3}
                    autoFocus
                  />
                </View>
              )}

              {ansicht === 'neu' && (
                <RegistrierFelder
                  variante="blatt"
                  konto={neu}
                  aendern={(teil) => setNeu((v) => ({ ...v, ...teil }))}
                  gesperrt={arbeitet}
                />
              )}

              <View style={styles.feld}>
                <Text style={styles.label}>E-Mail</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@beispiel.de"
                  placeholderTextColor={colors.text3}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoFocus={ansicht === 'anmelden'}
                />
              </View>

              <View style={styles.feld}>
                <Text style={styles.label}>Passwort</Text>
                <TextInput
                  style={styles.input}
                  value={passwort}
                  onChangeText={setPasswort}
                  placeholder="••••••••"
                  placeholderTextColor={colors.text3}
                  secureTextEntry
                  onSubmitEditing={ansicht === 'neu' ? neuErstellen : anmelden}
                />
                {ansicht === 'neu' && <Text style={styles.hinweis}>{PASSWORT_REGEL}.</Text>}
              </View>

              {meldung ? (
                <Text style={styles.fehler} accessibilityLiveRegion="polite">
                  {meldung}
                </Text>
              ) : null}

              <View style={styles.footer}>
                <Druck
                  style={[styles.button, arbeitet && { opacity: 0.6 }]}
                  onPress={ansicht === 'neu' ? neuErstellen : anmelden}
                  disabled={arbeitet}
                >
                  <Text style={styles.buttonText}>
                    {ansicht === 'neu' ? 'Konto erstellen' : 'Anmelden'}
                  </Text>
                </Druck>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = themenStyles((colors) => ({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(6,8,12,0.52)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  back: { width: 28 },
  title: { flex: 1, color: colors.text, ...typography.h3 },

  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
  },
  gruppe: {
    ...typography.overline,
    color: colors.text3,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  zeileBody: { flex: 1, minWidth: 0 },
  zeileName: { color: colors.text, ...typography.name },
  zeileSub: { color: colors.text3, marginTop: 2, ...typography.small },
  rund: {
    width: sizes.avatarMd,
    height: sizes.avatarMd,
    borderRadius: sizes.avatarMd / 2,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aktionText: { flex: 1, color: colors.brand, ...typography.name },

  feld: { paddingTop: spacing.md, paddingHorizontal: spacing.lg },
  label: { color: colors.text2, marginBottom: 6, ...typography.small },
  hinweis: { color: colors.text3, marginTop: 6, ...typography.small },
  fehler: { color: colors.danger, textAlign: 'center', marginTop: spacing.sm, ...typography.small },
  input: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface3,
    color: colors.text,
    ...typography.body,
  },

  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  button: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.white, ...typography.h3 },
}));
