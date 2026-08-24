import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { SearchBar } from '../../components/SearchBar';
import { colors, sizes, spacing, typography } from '../../constants/design';
import { Contact } from '../../types';

interface Props {
  contacts: Contact[];
  onOpenContact: (contact: Contact) => void;
  onAddContact: () => void;
}

export const ContactsScreen = ({ contacts, onOpenContact, onAddContact }: Props) => {
  const [query, setQuery] = useState('');

  const { friends, pending, total } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = contacts.filter((c) => !q || c.name.toLowerCase().includes(q));
    return {
      friends: list.filter((c) => c.status === 'friend'),
      pending: list.filter((c) => c.status === 'pending'),
      total: list.length,
    };
  }, [contacts, query]);

  const renderContact = (contact: Contact) => (
    <Pressable
      key={contact.id}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onOpenContact(contact)}
    >
      <Avatar id={contact.id} name={contact.name} size={sizes.avatarMd} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {contact.name}
        </Text>
        <Text style={styles.rowAbout} numberOfLines={1}>
          {contact.about}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.text3} />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kontakte</Text>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Kontakte durchsuchen"
          onAdd={onAddContact}
        />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled">
        {total === 0 ? (
          <EmptyState
            icon="person-outline"
            title="Keine Kontakte gefunden"
            text={`Für „${query}" wurde nichts gefunden.`}
          />
        ) : (
          <>
            {friends.length > 0 && (
              <>
                <Text style={styles.sectionHead}>Kontakte auf All Media</Text>
                {friends.map(renderContact)}
              </>
            )}
            {pending.length > 0 && (
              <>
                <Text style={styles.sectionHead}>Ausstehende Anfragen</Text>
                {pending.map(renderContact)}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: 14, paddingBottom: 10 },
  title: { marginBottom: spacing.md, color: colors.text, ...typography.title },

  sectionHead: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 6,
    color: colors.text3,
    textTransform: 'uppercase',
    ...typography.overline,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  rowPressed: { backgroundColor: colors.surface2 },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { color: colors.text, ...typography.name },
  rowAbout: { marginTop: 3, color: colors.text2, ...typography.preview },
});
