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
  const { user, konten, wechsleZu, kontoHinzufuegen, kontoAbmelden } = useContext(AuthContext);

  const [ansicht, setAnsicht] = useState<Ansicht>('liste');
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [name, setName] = useState('');

  const schliessen = () => {
    setAnsicht('liste');
    setEmail('');
    setPasswort('');
    setName('');
    onClose();
  };

  const wechseln = (id: string) => {
    if (id === user?.id) return schliessen();
    const konto = konten.find((k) => k.id === id);
    wechsleZu(id);
    onNotice(`Gewechselt zu ${konto?.profile.name ?? 'Konto'}`);
    schliessen();
  };

  const anmelden = async () => {
    if (!email.trim()) return onNotice('Bitte E-Mail eingeben');
    if (!passwort.trim()) return onNotice('Bitte Passwort eingeben');
    try {
      await kontoHinzufuegen(email.trim(), passwort);
      onNotice(`Angemeldet als ${email.trim()}`);
      schliessen();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen';
      onNotice(msg);
    }
  };

  const neuErstellen = async () => {
    if (!name.trim()) return onNotice('Bitte einen Namen eingeben');
    if (!email.trim()) return onNotice('Bitte E-Mail eingeben');
    if (passwort.trim().length < 6) return onNotice('Passwort: mindestens 6 Zeichen');
    try {
      await kontoHinzufuegen(email.trim(), passwort, name.trim());
      onNotice(`Konto für ${name.trim()} erstellt`);
      schliessen();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Kontenerstellung fehlgeschlagen';
      onNotice(msg);
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
              <Druck onPress={() => setAnsicht('liste')} hitSlop={8} style={styles.back}>
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
              </View>

              <View style={styles.footer}>
                <Druck
                  style={styles.button}
                  onPress={ansicht === 'neu' ? neuErstellen : anmelden}
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
