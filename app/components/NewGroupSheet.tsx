import React, { useState } from 'react';
import {
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { colors, radius, sizes, spacing, themenStyles, typography } from '../constants/design';
import { findePerson, nichtGefundenText } from '../lib/personSuche';
import { useDaten } from '../contexts/DatenContext';
import { Contact } from '../types';

/** Jemand, der noch nicht in den Kontakten steht und ueber die Nummer dazukam. */
export interface Eingeladener {
  id: string;
  name: string;
  phone?: string;
  /** true, wenn es zu der Nummer noch kein Konto gibt - wird eingeladen. */
  extern?: boolean;
}

interface Props {
  visible: boolean;
  contacts: Contact[];
  onClose: () => void;
  onCreate: (name: string, memberIds: string[], info?: string) => void;
  onNotice: (message: string) => void;
}

/**
 * Zwei Schritte, wie bei WhatsApp: erst die Personen, dann Name und Infos.
 * Vorher musste der Gruppenname vor der Auswahl feststehen - das war
 * verdreht.
 */
export const NewGroupSheet = ({ visible, contacts, onClose, onCreate, onNotice }: Props) => {
  const { users } = useDaten();
  const insets = useSafeAreaInsets();
  const [schritt, setSchritt] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [extern, setExtern] = useState<Eingeladener[]>([]);
  const [nummer, setNummer] = useState('');
  const [name, setName] = useState('');
  const [info, setInfo] = useState('');
  const [bild, setBild] = useState<string | null>(null);

  const friends = contacts.filter((c) => c.status === 'friend');
  const anzahl = selected.length + extern.length;

  const schliessen = () => {
    setSchritt(1);
    setSelected([]);
    setExtern([]);
    setNummer('');
    setName('');
    setInfo('');
    setBild(null);
    onClose();
  };

  /** Gruppenbild aus der Galerie waehlen. */
  const bildWaehlen = async () => {
    try {
      const ergebnis = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (ergebnis.canceled || !ergebnis.assets.length) return;
      setBild(ergebnis.assets[0].uri);
      onNotice('Gruppenbild ausgewählt');
    } catch {
      onNotice('Auf die Galerie kann nicht zugegriffen werden');
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /** Jemanden ueber die Telefonnummer dazunehmen, auch ohne Kontakt zu sein. */
  const nummerHinzufuegen = () => {
    const roh = nummer.trim();
    if (!roh) return onNotice('Bitte eine Telefonnummer eingeben');

    const person = findePerson(roh, users);

    if (person) {
      if (selected.includes(person.id) || extern.some((e) => e.id === person.id)) {
        return onNotice(`${person.name} ist schon dabei`);
      }
      setExtern((prev) => [...prev, { id: person.id, name: person.name, phone: person.phone }]);
      setNummer('');
      return onNotice(`${person.name} hinzugefügt`);
    }

    // Kein Konto zu der Nummer: trotzdem aufnehmen und einladen.
    if (extern.some((e) => e.phone === roh)) return onNotice('Diese Nummer ist schon dabei');
    setExtern((prev) => [...prev, { id: `ext${Date.now()}`, name: roh, phone: roh, extern: true }]);
    setNummer('');
    onNotice(`${roh} wird eingeladen`);
  };

  const weiter = () => {
    if (anzahl === 0) return onNotice('Bitte mindestens eine Person auswählen');
    setSchritt(2);
  };

  const erstellen = () => {
    if (!name.trim()) return onNotice('Bitte einen Gruppennamen eingeben');
    onCreate(name.trim(), [...selected, ...extern.map((e) => e.id)], info.trim() || undefined);
    setSchritt(1);
    setBild(null);
    setSelected([]);
    setExtern([]);
    setNummer('');
    setName('');
    setInfo('');
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
            {schritt === 2 && (
              <Druck onPress={() => setSchritt(1)} hitSlop={8} style={styles.back}>
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </Druck>
            )}
            <Text style={styles.title}>
              {schritt === 1
                ? `Personen auswählen${anzahl > 0 ? ` · ${anzahl}` : ''}`
                : 'Gruppe einrichten'}
            </Text>
          </View>

          {schritt === 1 ? (
            <>
              <View style={styles.field}>
                <View style={styles.nummerZeile}>
                  <TextInput
                    style={[styles.input, styles.nummerFeld]}
                    value={nummer}
                    onChangeText={setNummer}
                    placeholder="Telefonnummer hinzufügen"
                    placeholderTextColor={colors.text3}
                    keyboardType="phone-pad"
                    onSubmitEditing={nummerHinzufuegen}
                    returnKeyType="done"
                  />
                  <Druck style={styles.nummerBtn} onPress={nummerHinzufuegen}>
                    <Ionicons name="add" size={22} color={colors.white} />
                  </Druck>
                </View>
                <Text style={styles.hint}>
                  Auch Personen, die noch nicht in deinen Kontakten stehen.
                </Text>
              </View>

              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {extern.map((person) => (
                  <View key={person.id} style={styles.row}>
                    <Avatar id={person.id} name={person.name} size={sizes.avatarMd} />
                    <View style={styles.rowBody}>
                      <Text style={styles.rowName}>{person.name}</Text>
                      <Text style={styles.rowSub}>
                        {person.extern ? 'Wird eingeladen' : person.phone}
                      </Text>
                    </View>
                    <Druck
                      hitSlop={8}
                      onPress={() => setExtern((prev) => prev.filter((e) => e.id !== person.id))}
                    >
                      <Ionicons name="close" size={20} color={colors.text3} />
                    </Druck>
                  </View>
                ))}

                {friends.map((contact) => {
                  const isOn = selected.includes(contact.id);
                  return (
                    <Druck key={contact.id} style={styles.row} onPress={() => toggle(contact.id)}>
                      <Avatar id={contact.id} name={contact.name} size={sizes.avatarMd} />
                      <View style={styles.rowBody}>
                        <Text style={styles.rowName}>{contact.name}</Text>
                        <Text style={styles.rowSub}>{contact.about}</Text>
                      </View>
                      <View style={[styles.check, isOn && styles.checkOn]}>
                        {isOn && <Ionicons name="checkmark" size={15} color={colors.white} />}
                      </View>
                    </Druck>
                  );
                })}
              </ScrollView>

              <View style={styles.footer}>
                <Druck style={styles.button} onPress={weiter}>
                  <Text style={styles.buttonText}>Weiter</Text>
                </Druck>
              </View>
            </>
          ) : (
            <>
              <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
                <View style={styles.bildZeile}>
                  <Druck style={styles.bild} onPress={bildWaehlen}>
                    {bild ? (
                      <Image source={{ uri: bild }} style={styles.bildVorschau} />
                    ) : (
                      <Ionicons name="camera-outline" size={24} color={colors.text2} />
                    )}
                  </Druck>
                  <Text style={styles.bildText}>
                    {bild ? 'Gruppenbild ändern' : 'Gruppenbild hinzufügen'}
                  </Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Gruppenname</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="z. B. Wochenend-Crew"
                    placeholderTextColor={colors.text3}
                    maxLength={40}
                    autoFocus
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Gruppen-Info (freiwillig)</Text>
                  <TextInput
                    style={[styles.input, styles.inputMulti]}
                    value={info}
                    onChangeText={setInfo}
                    placeholder="Worum geht es in der Gruppe?"
                    placeholderTextColor={colors.text3}
                    multiline
                    maxLength={200}
                  />
                </View>

                <Text style={styles.mitglieder}>
                  {anzahl} {anzahl === 1 ? 'Person' : 'Personen'} ausgewählt
                </Text>
              </ScrollView>

              <View style={styles.footer}>
                <Druck style={styles.button} onPress={erstellen}>
                  <Text style={styles.buttonText}>Gruppe erstellen</Text>
                </Druck>
              </View>
            </>
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
    maxHeight: '88%',
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

  field: { paddingTop: spacing.md, paddingHorizontal: spacing.lg },
  label: { color: colors.text2, marginBottom: 6, ...typography.small },
  input: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface3,
    color: colors.text,
    ...typography.body,
  },
  inputMulti: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  hint: { paddingTop: 6, color: colors.text3, ...typography.small },

  nummerZeile: { flexDirection: 'row', gap: spacing.sm },
  nummerFeld: { flex: 1 },
  nummerBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },

  list: { marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { color: colors.text, ...typography.name },
  rowSub: { color: colors.text3, marginTop: 2, ...typography.small },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.brand, borderColor: colors.brand },

  bildZeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  bild: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bildVorschau: { width: 56, height: 56, borderRadius: 28 },
  bildText: { color: colors.text2, ...typography.body },

  mitglieder: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    color: colors.text3,
    ...typography.small,
  },

  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  button: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.white, ...typography.h3 },
}));
