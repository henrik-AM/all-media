import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../constants/design';
import { mockUsers } from '../mocks';
import { Contact } from '../types';

interface Props {
  visible: boolean;
  contacts: Contact[];
  onClose: () => void;
  onAdd: (contact: Contact) => void;
  onNotice: (message: string) => void;
}

export const AddContactSheet = ({ visible, contacts, onClose, onAdd, onNotice }: Props) => {
  const [handle, setHandle] = useState('');

  const submit = () => {
    const query = handle.trim().replace(/^@/, '').toLowerCase();
    if (!query) return onNotice('Bitte einen Benutzernamen eingeben');

    const person = Object.values(mockUsers).find(
      (u) =>
        u.id !== 'me' &&
        (u.handle.replace('@', '').toLowerCase() === query || u.name.toLowerCase() === query)
    );

    if (!person) return onNotice('Niemand mit diesem Namen gefunden');
    if (contacts.some((c) => c.id === person.id)) {
      return onNotice(`${person.name} ist bereits in deinen Kontakten`);
    }

    onAdd({ id: person.id, name: person.name, status: 'pending', about: 'Anfrage gesendet' });
    setHandle('');
    onNotice(`Anfrage an ${person.name} gesendet`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.handle} />
        <Text style={styles.title}>Kontakt hinzufügen</Text>

        <View style={styles.field}>
          <TextInput
            style={styles.input}
            value={handle}
            onChangeText={setHandle}
            placeholder="Benutzername, z. B. @anna"
            placeholderTextColor={colors.text3}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={submit}
            returnKeyType="send"
          />
        </View>
        <Text style={styles.hint}>Verfügbar: @anna, @bob, @clara, @david, @elif, @finn</Text>

        <View style={styles.footer}>
          <Pressable style={styles.button} onPress={submit}>
            <Text style={styles.buttonText}>Anfrage senden</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: spacing.md },
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

  field: { padding: spacing.md, paddingHorizontal: spacing.lg },
  input: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface3,
    color: colors.text,
    ...typography.body,
  },
  hint: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, color: colors.text3, ...typography.small },

  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  button: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.white, ...typography.h3 },
});
