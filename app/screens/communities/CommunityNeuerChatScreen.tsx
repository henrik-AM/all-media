import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Druck } from '../../components/Druck';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { SearchBar } from '../../components/SearchBar';
import { colors, spacing, themenStyles, typography } from '../../constants/design';
import { useDaten } from '../../contexts/DatenContext';

interface Props {
  onBack: () => void;
  /** Person gewählt: den Community-Chat mit ihr öffnen (openChatWith in App.tsx). */
  onChat: (userId: string) => void;
}

/*
 * Kasten 28/14 (Henrik 28.09.2026): „Wenn ich auf das blaue Plus rechts oben
 * drücke, möchte ich nicht auf das Suchprofil weitergeleitet werden, sondern
 * auf eine separate Seite, wo ich dann ein Community-Profil suchen kann.“
 *
 * Der Prototyp-Frame „CC + +“ zeigt dort noch „Neuer Kontakt“ mit
 * Mobilnummer. Das gilt nicht mehr: Unter Communitys schreibt man übers
 * Profil, die Nummer bleibt privat (Henrik 25.09.2026, Schema 57). Gesucht
 * wird deshalb nach Name und Benutzername, nie nach Nummer.
 *
 * Gleiche Seite auf der Website: openCommunityNeuerChat in web/public/app.js.
 */
export const CommunityNeuerChatScreen = ({ onBack, onChat }: Props) => {
  const insets = useSafeAreaInsets();
  const { users, communityChats } = useDaten();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const treffer = useMemo(
    () =>
      Object.values(users)
        .filter((u) => u.id !== 'me' && (!q || u.name.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q)))
        .sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [users, q]
  );

  const hatChat = (userId: string) => communityChats.some((c) => !c.isGroup && c.userId === userId);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Druck onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Zurück">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Druck>
        <Text style={styles.barTitel} numberOfLines={1} accessibilityRole="header">
          Neuer Chat
        </Text>
      </View>
      <View style={styles.head}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Community-Profil suchen..." />
      </View>
      <FlatList
        data={treffer}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: u }) => (
          <Druck
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => onChat(u.id)}
            accessibilityLabel={`Chat mit ${u.name}`}
          >
            <Avatar id={u.id} name={u.name} size={44} />
            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={1}>
                {u.name}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {u.handle}
              </Text>
            </View>
            <Text style={styles.hinweis}>{hatChat(u.id) ? 'Chat öffnen' : 'Schreiben'}</Text>
          </Druck>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="Nichts gefunden"
            text={q ? `Für „${query}" gibt es kein Profil.` : 'Es gibt gerade keine Profile.'}
          />
        }
      />
    </View>
  );
};

const styles = themenStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  // Kopf wie die Unterseiten der Suche (CommunitySearchScreen).
  bar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  barTitel: { flex: 1, ...typography.h3, fontSize: 17, color: colors.text },
  head: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 8 },
  rowPressed: { backgroundColor: colors.surface2 },
  body: { flex: 1, minWidth: 0 },
  name: { ...typography.name, color: colors.text },
  sub: { ...typography.preview, color: colors.text2, marginTop: 2 },
  hinweis: { ...typography.small, fontWeight: '600', color: colors.brand },
}));
