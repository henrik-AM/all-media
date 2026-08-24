import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../constants/design';
import { findePerson, istNummer, nichtGefundenText } from '../lib/personSuche';
import { Contact } from '../types';

interface Props {
  visible: boolean;
  contacts: Contact[];
  onClose: () => void;
  /** Die erste Nachricht darf schon vor der Annahme mitgehen. */
  onAdd: (contact: Contact, ersteNachricht?: string) => void;
  onNotice: (message: string) => void;
}

export const AddContactSheet = ({ visible, contacts, onClose, onAdd, onNotice }: Props) => {
  const insets = useSafeAreaInsets();
  const [eingabe, setEingabe] = useState('');
  const [nachricht, setNachricht] = useState('');

  const submit = () => {
    const roh = eingabe.trim();
    if (!roh) return onNotice('Bitte Benutzername oder Telefonnummer eingeben');

    const person = findePerson(roh);
    if (!person) return onNotice(nichtGefundenText(roh));
    if (contacts.some((c) => c.id === person.id)) {
      return onNotice(`${person.name} ist bereits in deinen Kontakten`);
    }

    const text = nachricht.trim();
    onAdd(
      { id: person.id, name: person.name, status: 'pending', about: 'Anfrage gesendet', phone: person.phone },
      text || undefined
    );
    setEingabe('');
    setNachricht('');
    onNotice(
      text
        ? `Anfrage mit Nachricht an ${person.name} gesendet`
        : `Anfrage an ${person.name} gesendet`
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/*
        Die Tastatur hat frueher das Eingabefeld verdeckt. Ursache: das
        KeyboardAvoidingView umschloss nur das Blatt selbst. Es muss den
        ganzen Bildschirm umfassen, damit es das Blatt anheben kann.
      */}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Kontakt hinzufügen</Text>

          <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
            <View style={styles.field}>
              <TextInput
                style={styles.input}
                value={eingabe}
                onChangeText={setEingabe}
                placeholder="Benutzername oder Telefonnummer"
                placeholderTextColor={colors.text3}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={istNummer(eingabe) ? 'phone-pad' : 'default'}
                returnKeyType="next"
              />
              <Text style={styles.hint}>
                Noch keine Kontakte: @greta, @hakan, @ida — oder deren Nummer,
                z. B. +49 174 8901234
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Nachricht (freiwillig)</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={nachricht}
                onChangeText={setNachricht}
                placeholder="Kurz schreiben, wer du bist …"
                placeholderTextColor={colors.text3}
                multiline
                onSubmitEditing={submit}
              />
              <Text style={styles.hint}>
                Diese eine Nachricht geht schon mit der Anfrage raus. Weitere
                erst, wenn die Anfrage angenommen wurde.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.button} onPress={submit}>
              <Text style={styles.buttonText}>Anfrage senden</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
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
  title: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    color: colors.text,
    ...typography.h3,
  },

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

  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  button: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.white, ...typography.h3 },
});
