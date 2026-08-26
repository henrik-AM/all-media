import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { SearchBar } from '../../components/SearchBar';
import { StoryRail } from '../../components/StoryRail';
import { brandGradient, colors, radius, sizes, spacing, themenStyles, typography } from '../../constants/design';
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
  allChats: Chat[];
  stories: Story[];
  onOpenChat: (chat: Chat) => void;
  onOpenStory: (story: Story) => void;
  onNewChat: () => void;
}

export const ChatListScreen = ({ allChats, stories, onOpenChat, onOpenStory, onNewChat }: Props) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const chats = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allChats.filter((chat) => {
      if (filter === 'contacts' && chat.isGroup) return false;
      if (filter === 'groups' && !chat.isGroup) return false;
      if (!q) return true;
      return chat.name.toLowerCase().includes(q) || chat.preview.toLowerCase().includes(q);
    });
  }, [allChats, filter, query]);

  const renderChat = ({ item }: { item: Chat }) => {
    const unread = item.unreadCount > 0;
    const icon = mediaIcon(item.previewMedia);

    return (
      <Druck
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
              <LinearGradient
                colors={brandGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.badge}
              >
                <Text style={styles.badgeText}>{item.unreadCount}</Text>
              </LinearGradient>
            )}
          </View>
        </View>
      </Druck>
    );
  };

  return (
    <View style={styles.container}>
      {/* Reihenfolge wie im Prototyp: Story-Leiste, Suche, Filter, Liste. */}
      <StoryRail stories={stories} onPress={onOpenStory} />

      <View style={styles.header}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Suche hier nach deinen Chats ..."
          onAdd={onNewChat}
        />
      </View>

      <View style={styles.pills}>
        {FILTERS.map(({ key, label }) => {
          const on = filter === key;
          return (
            <Druck key={key} onPress={() => setFilter(key)}>
              {on ? (
                <LinearGradient
                  colors={brandGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.pill}
                >
                  <Text style={[styles.pillText, styles.pillTextActive]}>{label}</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.pill, styles.pillIdle]}>
                  <Text style={styles.pillText}>{label}</Text>
                </View>
              )}
            </Druck>
          );
        })}
      </View>

      <FlatList
        data={chats}
        renderItem={renderChat}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
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

const styles = themenStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: 14, paddingBottom: 10 },

  pills: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: 8 },
  /* Nicht gewählte Filter sind nur eine Linie, keine graue Fläche. Drei graue
     Kacheln nebeneinander erzeugen Unruhe direkt unter dem Suchfeld. */
  pill: {
    height: 33,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillIdle: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pillText: { color: colors.text2, fontSize: 13.5, fontWeight: '600', letterSpacing: -0.1 },
  pillTextActive: { color: colors.white },

  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: spacing.lg, paddingVertical: 11 },
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
}));
