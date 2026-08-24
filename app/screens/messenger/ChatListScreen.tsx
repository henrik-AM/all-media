import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Image } from 'react-native';
import { colors, spacing, radius, typography, sizes } from '../../constants/design';
import { mockChats, mockUsers } from '../../mocks';
import { Chat } from '../../types';

export const ChatListScreen = () => {
  const [filter, setFilter] = useState<'all' | 'contacts' | 'groups'>('all');

  const filteredChats = mockChats.filter((chat) => {
    if (filter === 'contacts') return !chat.isGroup;
    if (filter === 'groups') return chat.isGroup;
    return true;
  });

  const renderChatItem = ({ item }: { item: Chat }) => {
    const otherUserId = item.participantIds.find((id) => id !== 'current');
    const otherUser = otherUserId ? mockUsers[otherUserId as keyof typeof mockUsers] : null;
    const displayName = item.isGroup ? item.groupName : otherUser?.name || 'Unknown';

    return (
      <TouchableOpacity style={styles.chatItem}>
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>👤</Text>
        </View>

        {/* Chat Info */}
        <View style={styles.chatContent}>
          <Text style={styles.chatName}>{displayName}</Text>
          <Text style={styles.chatMessage} numberOfLines={1}>
            {item.lastMessage?.text || '(Kein Nachricht)'}
          </Text>
        </View>

        {/* Unread badge */}
        {item.unreadCount ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unreadCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Messenger</Text>
        <TextInput
          placeholder="Suche Chats..."
          style={styles.searchBox}
          placeholderTextColor={colors.mediumGray}
        />
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterButtons}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Alle
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'contacts' && styles.filterButtonActive]}
          onPress={() => setFilter('contacts')}
        >
          <Text style={[styles.filterText, filter === 'contacts' && styles.filterTextActive]}>
            Kontakte
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'groups' && styles.filterButtonActive]}
          onPress={() => setFilter('groups')}
        >
          <Text style={[styles.filterText, filter === 'groups' && styles.filterTextActive]}>
            Gruppen
          </Text>
        </TouchableOpacity>
      </View>

      {/* Chat List */}
      <FlatList
        data={filteredChats}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
        scrollEnabled={true}
      />
    </View>
  );
};

export const ChatDetailScreen = () => (
  <View style={styles.container}>
    <Text>Chat Detail (coming soon)</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: typography.h2.fontSize,
    fontWeight: '700',
    marginBottom: spacing.md,
    color: colors.darkGray,
  },
  searchBox: {
    backgroundColor: colors.lightGray,
    borderRadius: radius.small,
    padding: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.darkGray,
  },
  filterButtons: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.lightGray,
  },
  filterButtonActive: {
    backgroundColor: colors.brand,
  },
  filterText: {
    fontSize: typography.small.fontSize,
    color: colors.darkGray,
    fontWeight: '500',
  },
  filterTextActive: {
    color: colors.white,
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: sizes.avatar,
    height: sizes.avatar,
    borderRadius: radius.medium,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
  },
  chatContent: {
    flex: 1,
  },
  chatName: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.darkGray,
  },
  chatMessage: {
    fontSize: typography.small.fontSize,
    color: colors.mediumGray,
    marginTop: spacing.xs,
  },
  unreadBadge: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: colors.white,
    fontSize: typography.tiny.fontSize,
    fontWeight: '600',
  },
});
