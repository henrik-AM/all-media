import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { colors, spacing, themenStyles, typography } from '../../constants/design';
import { useDaten } from '../../contexts/DatenContext';
import { Contact } from '../../types';

interface Props {
  onBack: () => void;
  onNotice: (message: string) => void;
}

export const EditSelectedContactsScreen = ({ onBack, onNotice }: Props) => {
  const { contacts: alleKontakte } = useDaten();
  const [selected, setSelected] = useState<Set<string>>(new Set(['u2', 'u3']));

  const toggleContact = (contactId: string) => {
    const next = new Set(selected);
    if (next.has(contactId)) {
      next.delete(contactId);
    } else {
      next.add(contactId);
    }
    setSelected(next);
    onNotice(next.has(contactId) ? `${contactId} ausgewählt` : `${contactId} nicht mehr ausgewählt`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Druck onPress={onBack} hitSlop={6}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Druck>
        <Text style={styles.title}>Ausgewählte Kontakte</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {alleKontakte.map((contact) => (
          <Druck
            key={contact.id}
            style={styles.row}
            onPress={() => toggleContact(contact.id)}
          >
            <Avatar id={contact.id} name={contact.name} size={44} />
            <Text style={styles.name}>{contact.name}</Text>
            {selected.has(contact.id) && (
              <Ionicons name="checkmark-circle" size={24} color={colors.brand} />
            )}
          </Druck>
        ))}
      </ScrollView>

      <Druck style={styles.button} onPress={onBack}>
        <Text style={styles.buttonText}>Fertig</Text>
      </Druck>
    </SafeAreaView>
  );
};

const styles = themenStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: { ...typography.name, color: colors.text, flex: 1 },
  button: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: 12,
    borderRadius: 11,
    backgroundColor: colors.brand,
    alignItems: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '600', color: colors.white },
}));
