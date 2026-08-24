import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { SearchBar } from '../../components/SearchBar';
import { StoryRail } from '../../components/StoryRail';
import { colors, radius, sizes, spacing, typography } from '../../constants/design';
import { mockChats, mockStories } from '../../mocks';
import { Chat, Story } from '../../types';

type Filter = 'all' | 'contacts' | 'groups';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'contacts', label: 'Kontakte' },
  { key: 'groups', label: 'Gruppen' },
];

const mediaIcon = (media?: string) =>
  media === 'image' ? 'image-outline' : media === 'audio' ? 'mic-outline' : null;

interface Props {
  onOpenChat: (chat: Chat) => void;
  onOpenStory: (story: Story) => void;
  onNewChat: () => void;
}

export const ChatListScreen = ({ onOpenChat, onOpenStory, onNewChat }: Props) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const chats = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mockChats.filter((chat) => {
      if (filter === 'contacts' && chat.isGroup) return false;
      if (filter === 'groups' && !chat.isGroup) return false;
      if (!q) return true;
      return chat.name.toLowerCase().includes(q) || chat.preview.toLowerCase().includes(q);
    });
  }, [filter, query]);

  const renderChat = ({ item }: { item: Chat }) => {
    const unread = item.unreadCount > 0;
    const icon = mediaIcon(item.previewMedia);

    return (
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => onOpenChat(item)}
      >
        <Avatar id={item.userId ?? item.id} name={item.name} size={sizes.avatarLg} group={item.isGroup} />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.rowName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.rowTime, unread && styles.rowTimeUnread]}>{item.time}</Text>
          </View>
          <View style={styles.rowBottom}>
            {icon && <Ionicons name={icon} size={14} color={colors.text3} />}
            <Text style={[styles.rowPreview, unread && styles.rowPreviewUnread]} numberOfLines={1}>
              {item.preview}
            </Text>
            {item.muted && <Ionicons name="volume-mute-outline" size={15} color={colors.text3} />}
            {unread && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Suche nach Chats oder Namen"
          onAdd={onNewChat}
        />
      </View>

      <View style={styles.pills}>
        {FILTERS.map(({ key, label }) => (
          <Pressable
            key={key}
            style={[styles.pill, filter === key && styles.pillActive]}
            onPress={() => setFilter(key)}
          >
            <Text style={[styles.pillText, filter === key && styles.pillTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={chats}
        renderItem={renderChat}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          query.trim() ? null : <StoryRail stories={mockStories} onPress={onOpenStory} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="Keine Treffer"
            text={`Für „${query}" wurde nichts gefunden.`}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: 14, paddingBottom: 10 },
  title: { marginBottom: spacing.md, color: colors.text, ...typography.title },

  pills: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: 6 },
  pill: { paddingHorizontal: 15, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface3 },
  pillActive: { backgroundColor: colors.brand },
  pillText: { color: colors.text2, fontSize: 13.5, fontWeight: '600' },
  pillTextActive: { color: colors.white },

  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  rowPressed: { backgroundColor: colors.surface2 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowName: { flex: 1, color: colors.text, ...typography.name },
  rowTime: { color: colors.text3, ...typography.small },
  rowTimeUnread: { color: colors.brand, fontWeight: '600' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  rowPreview: { flex: 1, color: colors.text2, ...typography.preview },
  rowPreviewUnread: { color: colors.text, fontWeight: '500' },

  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 11.5, fontWeight: '700' },
});
