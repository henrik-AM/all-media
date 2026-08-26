import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { SearchBar } from '../../components/SearchBar';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';
import { mockCommunities, mockUsers } from '../../mocks';
import { Community, Contact } from '../../types';

type Filter = 'all' | 'channels' | 'people';

interface Props {
  contacts: Contact[];
  onOpenCommunity: (community: Community) => void;
  onOpenProfile: (userId: string) => void;
  onBefriend: (userId: string) => void;
}

/** Prototyp-Frame "Community - Suchen": Filter, Kanäle, Profile. */
export const CommunitySearchScreen = ({ contacts, onOpenCommunity, onOpenProfile, onBefriend }: Props) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const q = query.trim().toLowerCase();

  const channels = useMemo(
    () =>
      filter === 'people'
        ? []
        : mockCommunities.filter((c) => !q || c.name.toLowerCase().includes(q) || c.topic.toLowerCase().includes(q)),
    [filter, q]
  );

  const people = useMemo(
    () =>
      filter === 'channels'
        ? []
        : Object.values(mockUsers).filter(
            (u) => u.id !== 'me' && (!q || u.name.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q))
          ),
    [filter, q]
  );

  const statusOf = (id: string) => {
    const contact = contacts.find((c) => c.id === id);
    if (!contact) return 'none';
    return contact.status === 'pending' ? 'pending' : 'friend';
  };

  const empty = channels.length === 0 && people.length === 0;

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Suche hier nach Communitys/Kontakten..." />
        <View style={styles.pills}>
          {(
            [
              ['all', 'Alle'],
              ['channels', 'Communitys'],
              ['people', 'Kontakte'],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <Druck
              key={key}
              style={[styles.pill, filter === key && styles.pillActive]}
              onPress={() => setFilter(key)}
            >
              <Text style={[styles.pillText, filter === key && styles.pillTextActive]}>{label}</Text>
            </Druck>
          ))}
        </View>
      </View>

      {empty ? (
        <EmptyState icon="search-outline" title="Nichts gefunden" text={`Für „${query}" gibt es keinen Treffer.`} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {channels.length > 0 && <Text style={styles.sectionHead}>Kanäle →</Text>}
          {channels.map((c) => (
            <Druck key={c.id} style={styles.row} onPress={() => onOpenCommunity(c)}>
              <Avatar id={c.id} name={c.name} size={44} />
              <View style={styles.body}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{c.name}</Text>
                  {c.visibility === 'private' && <Ionicons name="lock-closed" size={13} color={colors.text3} />}
                </View>
                <Text style={styles.sub} numberOfLines={1}>
                  {c.topic}
                </Text>
              </View>
              <View style={[styles.action, c.joined && styles.actionDone]}>
                <Text style={[styles.actionText, c.joined && styles.actionTextDone]}>
                  {c.joined ? 'Mitglied' : 'Beitreten'}
                </Text>
              </View>
            </Druck>
          ))}

          {people.length > 0 && <Text style={styles.sectionHead}>Profile →</Text>}
          {people.map((u) => {
            const status = statusOf(u.id);
            const label = status === 'friend' ? 'Befreundet' : status === 'pending' ? 'Angefragt' : '+ Befreunden';
            return (
              <View key={u.id} style={styles.row}>
                <Druck style={styles.person} onPress={() => onOpenProfile(u.id)}>
                  <Avatar id={u.id} name={u.name} size={44} />
                  <View style={styles.body}>
                    <Text style={styles.name}>{u.name}</Text>
                    <Text style={styles.sub}>{u.handle}</Text>
                  </View>
                </Druck>
                <Druck
                  disabled={status !== 'none'}
                  style={[styles.action, status !== 'none' && styles.actionDone]}
                  onPress={() => onBefriend(u.id)}
                >
                  <Text style={[styles.actionText, status !== 'none' && styles.actionTextDone]}>{label}</Text>
                </Druck>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = themenStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  head: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  pills: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface3 },
  pillActive: { backgroundColor: colors.brand },
  pillText: { ...typography.small, fontWeight: '600', color: colors.text2 },
  pillTextActive: { color: colors.white },
  content: { paddingBottom: spacing.xl },
  sectionHead: {
    ...typography.h3,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...typography.name, color: colors.text },
  sub: { ...typography.preview, color: colors.text2, marginTop: 2 },
  action: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  actionDone: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionText: { ...typography.small, fontWeight: '600', color: colors.white },
  actionTextDone: { color: colors.text2 },
}));
