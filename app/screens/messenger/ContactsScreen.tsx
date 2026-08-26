import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { SearchBar } from '../../components/SearchBar';
import { colors, sizes, spacing, themenStyles, typography } from '../../constants/design';
import { Contact } from '../../types';

interface Props {
  contacts: Contact[];
  /** Kontakte sind im Prototyp kein Navigationspunkt, sondern eine eigene Seite. */
  onBack?: () => void;
  onOpenContact: (contact: Contact) => void;
  onAddContact: () => void;
}

export const ContactsScreen = ({ contacts, onBack, onOpenContact, onAddContact }: Props) => {
  /*
   * Kontakte liegen als eigene Seite ueber allem - ohne die obere Leiste, die
   * sonst den Platz fuer Uhrzeit und Notch frei haelt. Ohne diesen Abstand
   * lief die Ueberschrift "Kontakte" hinter die Dynamic Island und war zur
   * Haelfte verdeckt.
   */
  const insets = useSafeAreaInsets();
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
    <Druck
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
    </Druck>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.titleRow}>
          {onBack && (
            <Druck onPress={onBack} hitSlop={10}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Druck>
          )}
          <Text style={styles.title}>Kontakte</Text>
        </View>
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

const styles = themenStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: 14, paddingBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  title: { color: colors.text, ...typography.title },

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
}));
