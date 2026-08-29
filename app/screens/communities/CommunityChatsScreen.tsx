import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { SearchBar } from '../../components/SearchBar';
import { colors, spacing, themenStyles, typography } from '../../constants/design';
import { useProfil } from '../../contexts/ProfilContext';
import { Community } from '../../types';

interface Props {
  onOpenCommunity: (community: Community) => void;
}

/** Prototyp-Frame "Community - Chats". */
export const CommunityChatsScreen = ({ onOpenCommunity }: Props) => {
  const { communities } = useProfil();
  const [query, setQuery] = useState('');
  const [hideCommunitys, setHideCommunitys] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = communities
      .filter((c) => c.joined)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.topic.toLowerCase().includes(q));

    if (hideCommunitys) {
      filtered = filtered.filter((c) => c.visibility === 'private');
    }
    return filtered;
  }, [communities, query, hideCommunitys]);

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Suche hier nach Kontakten/Gruppen..." />
      </View>

      {list.length === 0 ? (
        <EmptyState icon="chatbubble-outline" title="Kein Chat gefunden" text={`Für „${query}" gibt es keinen Treffer.`} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Druck style={styles.row} onPress={() => onOpenCommunity(item)}>
              <Avatar id={item.id} name={item.name} size={52} />
              <View style={styles.body}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {item.topic}
                </Text>
              </View>
              {item.unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unreadCount}</Text>
                </View>
              )}
            </Druck>
          )}
        />
      )}
    </View>
  );
};

const styles = themenStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  head: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.title, color: colors.text, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  body: { flex: 1 },
  name: { ...typography.name, color: colors.text },
  sub: { ...typography.preview, color: colors.text2, marginTop: 2 },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
}));
