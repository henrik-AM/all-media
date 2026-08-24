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
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { colors, radius, sizes, spacing, typography } from '../constants/design';
import { Contact } from '../types';

interface Props {
  visible: boolean;
  contacts: Contact[];
  onClose: () => void;
  onCreate: (name: string, memberIds: string[]) => void;
  onNotice: (message: string) => void;
}

export const NewGroupSheet = ({ visible, contacts, onClose, onCreate, onNotice }: Props) => {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const friends = contacts.filter((c) => c.status === 'friend');

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const create = () => {
    if (!name.trim()) return onNotice('Bitte einen Gruppennamen eingeben');
    if (selected.length === 0) return onNotice('Bitte mindestens einen Kontakt auswählen');

    onCreate(name.trim(), selected);
    setName('');
    setSelected([]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.handle} />
        <Text style={styles.title}>
          Neue Gruppe{selected.length > 0 ? ` · ${selected.length} ausgewählt` : ''}
        </Text>

        <View style={styles.field}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Gruppenname"
            placeholderTextColor={colors.text3}
            maxLength={40}
          />
        </View>

        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {friends.map((contact) => {
            const isOn = selected.includes(contact.id);
            return (
              <Pressable key={contact.id} style={styles.row} onPress={() => toggle(contact.id)}>
                <Avatar id={contact.id} name={contact.name} size={sizes.avatarMd} />
                <Text style={styles.rowName}>{contact.name}</Text>
                <View style={[styles.checkbox, isOn && styles.checkboxOn]}>
                  {isOn && <Ionicons name="checkmark" size={14} color={colors.white} />}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.button} onPress={create}>
            <Text style={styles.buttonText}>Gruppe erstellen</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { height: '74%', backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
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

  list: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  rowName: { flex: 1, color: colors.text, ...typography.name },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.brand, borderColor: colors.brand },

  footer: {
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  button: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.white, ...typography.h3 },
});
