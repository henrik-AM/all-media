import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { colors, radius, sizes, spacing, typography } from '../../constants/design';
import { CURRENT_USER_ID, mockCommunityMessages, mockMessages, mockUsers } from '../../mocks';
import { Chat, Message } from '../../types';

const REPLIES = ['Alles klar!', 'Sehe ich genauso.', 'Melde mich gleich.', 'Danke dir!', 'Passt für mich.'];

const nowTime = () =>
  new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

interface Props {
  chat: Chat;
  onBack: () => void;
  onCall: (kind: 'audio' | 'video') => void;
  onCamera: () => void;
  onOpenProfile: (userId: string) => void;
}

export const ChatDetailScreen = ({ chat, onBack, onCall, onCamera, onOpenProfile }: Props) => {
  const [messages, setMessages] = useState<Message[]>(
    () => mockMessages[chat.id] ?? mockCommunityMessages[chat.id] ?? []
  );
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const send = () => {
    const text = draft.trim();
    if (!text) return;

    const message: Message = {
      id: `m${Date.now()}`,
      chatId: chat.id,
      senderId: CURRENT_USER_ID,
      text,
      time: nowTime(),
      read: false,
    };
    setMessages((prev) => [...prev, message]);
    setDraft('');
    scrollToEnd();

    if (chat.isGroup || !chat.userId) return;

    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `r${Date.now()}`,
          chatId: chat.id,
          senderId: chat.userId!,
          text: REPLIES[Math.floor(Math.random() * REPLIES.length)],
          time: nowTime(),
        },
      ]);
      scrollToEnd();
    }, 1400);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const out = item.senderId === CURRENT_USER_ID;
    const sender = mockUsers[item.senderId];

    return (
      <View style={[styles.bubble, out ? styles.bubbleOut : styles.bubbleIn]}>
        {!out && chat.isGroup && <Text style={styles.sender}>{sender?.name ?? 'Unbekannt'}</Text>}

        {item.media ? (
          <View style={styles.media}>
            <Ionicons
              name={item.media === 'image' ? 'image-outline' : 'mic-outline'}
              size={18}
              color={colors.text2}
            />
            <Text style={styles.mediaText}>
              {item.media === 'image' ? 'Foto' : 'Sprachnachricht · 0:14'}
            </Text>
          </View>
        ) : (
          <Text style={[styles.messageText, out && styles.messageTextOut]}>{item.text}</Text>
        )}

        <View style={styles.bubbleFoot}>
          <Text style={[styles.time, out && styles.timeOut]}>{item.time}</Text>
          {out && <Ionicons name="checkmark-done" size={14} color={colors.bubbleOutMeta} />}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.headerBack} onPress={onBack} hitSlop={6}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Avatar id={chat.userId ?? chat.id} name={chat.name} size={sizes.avatarSm} group={chat.isGroup} />
        <Pressable
          style={styles.headerBody}
          onPress={() => chat.userId && onOpenProfile(chat.userId)}
          disabled={!chat.userId}
        >
          <Text style={styles.headerName} numberOfLines={1}>
            {chat.name}
          </Text>
          <Text style={[styles.headerStatus, chat.isGroup && styles.headerStatusMuted]}>
            {chat.isGroup
              ? `${((chat.memberIds?.length ?? 0) + 1).toLocaleString('de-DE')} Mitglieder`
              : 'Online'}
          </Text>
        </Pressable>
        <Pressable style={styles.headerAction} onPress={() => onCall('video')} hitSlop={4}>
          <Ionicons name="videocam-outline" size={22} color={colors.text2} />
        </Pressable>
        <Pressable style={styles.headerAction} onPress={() => onCall('audio')} hitSlop={4}>
          <Ionicons name="call-outline" size={20} color={colors.text2} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={listRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          onContentSizeChange={scrollToEnd}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.dayDivider}>
              <Text style={styles.dayDividerText}>Heute</Text>
            </View>
          }
          ListFooterComponent={
            typing ? (
              <View style={[styles.bubble, styles.bubbleIn, styles.typing]}>
                <Text style={styles.typingText}>schreibt …</Text>
              </View>
            ) : null
          }
        />

        <View style={styles.composer}>
          <Pressable style={styles.composerIcon} onPress={onCamera} hitSlop={4}>
            <Ionicons name="add" size={24} color={colors.text2} />
          </Pressable>
          <View style={styles.composerField}>
            <TextInput
              style={styles.composerInput}
              value={draft}
              onChangeText={setDraft}
              placeholder="Nachricht"
              placeholderTextColor={colors.text3}
              multiline
            />
            <Pressable style={styles.composerIcon} onPress={onCamera} hitSlop={4}>
              <Ionicons name="camera-outline" size={21} color={colors.text2} />
            </Pressable>
          </View>
          <Pressable
            style={[styles.send, !draft.trim() && styles.sendDisabled]}
            onPress={send}
            disabled={!draft.trim()}
          >
            <Ionicons name="send" size={17} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerBack: { width: 30, alignItems: 'center' },
  headerBody: { flex: 1, minWidth: 0 },
  headerName: { color: colors.text, ...typography.name },
  headerStatus: { marginTop: 1, color: colors.success, ...typography.small },
  headerStatusMuted: { color: colors.text3 },
  headerAction: { width: 34, alignItems: 'center' },

  messages: { flex: 1, backgroundColor: colors.surface2 },
  messagesContent: { padding: 14, paddingBottom: spacing.sm, gap: 3 },

  dayDivider: { alignSelf: 'center', marginBottom: 10 },
  dayDividerText: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surface3,
    color: colors.text2,
    fontSize: 11.5,
    fontWeight: '600',
    overflow: 'hidden',
  },

  bubble: { maxWidth: '78%', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, borderRadius: radius.lg },
  bubbleIn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bubbleIn,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderBottomLeftRadius: 5,
  },
  bubbleOut: {
    alignSelf: 'flex-end',
    backgroundColor: colors.bubbleOut,
    borderBottomRightRadius: 5,
  },
  sender: { marginBottom: 2, color: colors.brand, fontSize: 12.5, fontWeight: '700' },
  messageText: { color: colors.text, ...typography.message, lineHeight: 20 },
  messageTextOut: { color: colors.bubbleOutText },
  media: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  mediaText: { color: colors.text2, ...typography.preview },
  bubbleFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 },
  time: { color: colors.text3, ...typography.tiny },
  timeOut: { color: colors.bubbleOutMeta },

  typing: { paddingVertical: 10 },
  typingText: { color: colors.text3, ...typography.preview, fontStyle: 'italic' },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  composerIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  composerField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    backgroundColor: colors.surface3,
    paddingLeft: 14,
    paddingRight: 2,
  },
  composerInput: {
    flex: 1,
    maxHeight: 108,
    paddingVertical: 10,
    color: colors.text,
    ...typography.body,
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
});
