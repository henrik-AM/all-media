import React, { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { EmptyState } from './EmptyState';
import { colors, radius, sizes, spacing, themenStyles, typography } from '../constants/design';
import { CURRENT_USER_ID, mockComments, mockUsers } from '../mocks';
import { Comment } from '../types';

interface Props {
  targetId: string | null;
  onClose: () => void;
  onCountChange?: (targetId: string, count: number) => void;
}

export const CommentSheet = ({ targetId, onClose, onCountChange }: Props) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (targetId && loadedFor !== targetId) {
    setLoadedFor(targetId);
    setComments(mockComments[targetId] ?? []);
    setDraft('');
  }

  const toggleLike = (comment: Comment) =>
    setComments((prev) =>
      prev.map((c) =>
        c.id === comment.id ? { ...c, liked: !c.liked, likes: c.likes + (c.liked ? -1 : 1) } : c
      )
    );

  const send = () => {
    const text = draft.trim();
    if (!text || !targetId) return;

    const comment: Comment = {
      id: `cm${Date.now()}`,
      userId: CURRENT_USER_ID,
      text,
      time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      likes: 0,
      liked: false,
    };

    const next = [...comments, comment];
    setComments(next);
    setDraft('');
    onCountChange?.(targetId, next.length);
  };

  const renderComment = ({ item }: { item: Comment }) => {
    const author = mockUsers[item.userId];
    return (
      <View style={styles.comment}>
        <Avatar id={item.userId} name={author?.name ?? ''} size={sizes.avatarSm} />
        <View style={styles.commentBody}>
          <Text style={styles.commentText}>
            <Text style={styles.bold}>{author?.name}</Text> {item.text}
          </Text>
          <Text style={styles.commentMeta}>
            {item.time}
            {item.likes > 0 ? ` · ${item.likes} Gefällt mir` : ''}
          </Text>
        </View>
        <Druck onPress={() => toggleLike(item)} hitSlop={8}>
          <Ionicons
            name={item.liked ? 'heart' : 'heart-outline'}
            size={17}
            color={item.liked ? '#FF3040' : colors.text3}
          />
        </Druck>
      </View>
    );
  };

  return (
    <Modal visible={!!targetId} transparent animationType="slide" onRequestClose={onClose}>
      <Druck style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.handle} />
        <Text style={styles.title}>
          {comments.length} {comments.length === 1 ? 'Kommentar' : 'Kommentare'}
        </Text>

        <FlatList
          data={comments}
          renderItem={renderComment}
          keyExtractor={(item) => item.id}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              icon="chatbubble-outline"
              title="Noch keine Kommentare"
              text="Schreib den ersten."
            />
          }
        />

        <View style={styles.composer}>
          <Avatar id={CURRENT_USER_ID} name="Henrik" size={sizes.avatarSm} />
          <View style={styles.field}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Kommentar hinzufügen"
              placeholderTextColor={colors.text3}
              multiline
            />
          </View>
          <Druck
            style={[styles.send, !draft.trim() && styles.sendDisabled]}
            onPress={send}
            disabled={!draft.trim()}
          >
            <Ionicons name="send" size={17} color={colors.white} />
          </Druck>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = themenStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(6,8,12,0.52)' },
  sheet: {
    height: '74%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
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

  list: { flex: 1 },
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingHorizontal: spacing.lg, paddingVertical: 9 },
  commentBody: { flex: 1, minWidth: 0 },
  commentText: { color: colors.text, ...typography.message, lineHeight: 20 },
  commentMeta: { marginTop: 3, color: colors.text3, ...typography.small },
  bold: { fontWeight: '700' },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  field: {
    flex: 1,
    borderRadius: radius.xl,
    backgroundColor: colors.surface3,
    paddingHorizontal: 14,
  },
  input: { maxHeight: 108, paddingVertical: 10, color: colors.text, ...typography.body },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
}));
