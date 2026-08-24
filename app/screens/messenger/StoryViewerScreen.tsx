import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { colors, radius, sizes, spacing, typography } from '../../constants/design';
import { mockUsers } from '../../mocks';
import { Story } from '../../types';

const DURATION = 5000;

interface Props {
  story: Story;
  onClose: () => void;
  onNotice: (message: string) => void;
}

export const StoryViewerScreen = ({ story, onClose, onNotice }: Props) => {
  const progress = useRef(new Animated.Value(0)).current;
  const [reply, setReply] = useState('');
  const user = mockUsers[story.userId];

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) onClose();
    });
    return () => animation.stop();
  }, [progress, onClose]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bars}>
        <View style={styles.bar}>
          <Animated.View style={[styles.fill, { width }]} />
        </View>
      </View>

      <View style={styles.head}>
        <Avatar id={story.userId} name={user?.name ?? story.name} size={sizes.avatarSm} />
        <Text style={styles.name}>{user?.name ?? story.name}</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={24} color={colors.white} />
        </Pressable>
      </View>

      <View style={styles.stage}>
        <Ionicons name="image-outline" size={56} color="rgba(255,255,255,0.4)" />
      </View>

      <View style={styles.foot}>
        <TextInput
          style={styles.reply}
          value={reply}
          onChangeText={setReply}
          placeholder="Auf Story antworten"
          placeholderTextColor="rgba(255,255,255,0.6)"
        />
        <Pressable onPress={() => onNotice('Story gefällt dir')} hitSlop={8}>
          <Ionicons name="heart-outline" size={24} color={colors.white} />
        </Pressable>
        <Pressable
          onPress={() => {
            if (!reply.trim()) return;
            setReply('');
            onNotice('Antwort gesendet');
          }}
          hitSlop={8}
        >
          <Ionicons name="send" size={22} color={colors.white} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  bars: { flexDirection: 'row', gap: 4, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  bar: { flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.white },

  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  name: { flex: 1, color: colors.white, ...typography.name },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  foot: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  reply: {
    flex: 1,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: spacing.lg,
    color: colors.white,
  },
});
