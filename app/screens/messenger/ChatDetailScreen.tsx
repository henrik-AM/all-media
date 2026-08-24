import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView } from 'react-native';
import { colors, spacing, radius, typography, sizes } from '../../constants/design';
import { useChatMessages } from '../../lib/useSupabaseSubscription';
import { useSupabase } from '../../contexts/SupabaseContext';

interface Message {
  id: string;
  text: string;
  sent: boolean;
  timestamp: Date;
}

interface ChatDetailScreenProps {
  chatId?: string;
  chatName?: string;
}

export const ChatDetailScreenComponent = ({ chatId = 'demo_chat', chatName = 'Anna Schmidt' }: ChatDetailScreenProps) => {
  // Try to use Supabase if available, fallback to local state
  const { supabase } = useSupabase();
  const { messages: supabaseMessages, isLoading } = useChatMessages(chatId);

  const [localMessages, setLocalMessages] = useState<Message[]>([
    { id: '1', text: 'Hey, wie gehts?', sent: false, timestamp: new Date(Date.now() - 3600000) },
    { id: '2', text: 'Mir gehts gut!', sent: true, timestamp: new Date(Date.now() - 3500000) },
    { id: '3', text: 'Treffen wir uns später?', sent: false, timestamp: new Date(Date.now() - 1800000) },
  ]);
  const [input, setInput] = useState('');

  // Use Supabase messages if available, otherwise use mock
  const displayMessages = supabaseMessages.length > 0
    ? supabaseMessages.map((msg: any) => ({
        id: msg.id,
        text: msg.content,
        sent: msg.user_id === 'current_user', // Will be updated when auth is integrated
        timestamp: new Date(msg.created_at),
      }))
    : localMessages;

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessage: Message = {
      id: String(Date.now()),
      text: input,
      sent: true,
      timestamp: new Date(),
    };

    // Try to save to Supabase
    if (supabase) {
      try {
        await supabase.from('messages').insert({
          chat_id: chatId,
          user_id: 'current_user', // Will be replaced with actual auth user
          content: input,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Failed to send to Supabase:', err);
        // Fall through to local storage
      }
    }

    // Local fallback
    setLocalMessages([...localMessages, newMessage]);
    setInput('');

    // Simulate response (if no Supabase)
    if (!supabase) {
      setTimeout(() => {
        setLocalMessages((prev) => [
          ...prev,
          {
            id: String(Date.now()),
            text: '👍 Erhalten!',
            sent: false,
            timestamp: new Date(),
          },
        ]);
      }, 1000);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.messageBubble, item.sent ? styles.sentBubble : styles.receivedBubble]}>
      <Text style={[styles.messageText, item.sent ? styles.sentText : styles.receivedText]}>
        {item.text}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.chatName}>{chatName}</Text>
      </View>

      {/* Messages */}
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Nachricht..."
          value={input}
          onChangeText={setInput}
          placeholderTextColor={colors.mediumGray}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  chatName: {
    fontSize: typography.h3.fontSize,
    fontWeight: '700',
    color: colors.darkGray,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: radius.large,
  },
  sentBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.brand,
  },
  receivedBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.lightGray,
  },
  messageText: {
    fontSize: typography.body.fontSize,
  },
  sentText: {
    color: colors.white,
  },
  receivedText: {
    color: colors.darkGray,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: radius.small,
    padding: spacing.sm,
    fontSize: typography.body.fontSize,
    maxHeight: 100,
    color: colors.darkGray,
  },
  sendButton: {
    backgroundColor: colors.brand,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: colors.white,
    fontSize: 20,
  },
});
