import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView } from 'react-native';
import { colors, spacing, radius, typography, sizes } from '../../constants/design';

interface Message {
  id: string;
  text: string;
  sent: boolean;
  timestamp: Date;
}

export const ChatDetailScreenComponent = ({ chatName = 'Anna Schmidt' }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: 'Hey, wie gehts?', sent: false, timestamp: new Date(Date.now() - 3600000) },
    { id: '2', text: 'Mir gehts gut!', sent: true, timestamp: new Date(Date.now() - 3500000) },
    { id: '3', text: 'Treffen wir uns später?', sent: false, timestamp: new Date(Date.now() - 1800000) },
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim()) {
      const newMessage: Message = {
        id: String(messages.length + 1),
        text: input,
        sent: true,
        timestamp: new Date(),
      };
      setMessages([...messages, newMessage]);
      setInput('');

      // Simulate response
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: String(prev.length + 1),
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
