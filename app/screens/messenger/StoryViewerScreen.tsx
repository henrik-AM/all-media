import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { colors, radius, sizes, spacing, typography } from '../../constants/design';
import { mockStories, mockUsers } from '../../mocks';
import { Story } from '../../types';

const DURATION = 6000;

interface Props {
  story: Story;
  onClose: () => void;
  /** Antwort auf die Story — landet im Chat mit dieser Person. */
  onReply: (story: Story, text: string) => void;
  onNotice: (message: string) => void;
}

/*
 * Der Viewer folgt Henriks Rueckmeldung:
 *  1. Das Herz bleibt rot, solange die Story geliked ist.
 *  2. Sobald im Antwortfeld etwas steht, laeuft die Zeit nicht weiter.
 *  3. Eine Antwort landet wirklich im Chat mit dieser Person.
 *  4. Tippen links/rechts blaettert zur vorigen/naechsten Story.
 */
export const StoryViewerScreen = ({ story, onClose, onReply, onNotice }: Props) => {
  const stories = mockStories.filter((s) => !s.own);
  const [index, setIndex] = useState(() => Math.max(stories.findIndex((s) => s.id === story.id), 0));
  const [liked, setLiked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(stories.map((s) => [s.id, !!s.liked]))
  );
  const [reply, setReply] = useState('');
  const [paused, setPaused] = useState(false);

  const current = stories[index];
  const person = mockUsers[current.userId];
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
  }, [index, progress]);

  useEffect(() => {
    if (paused) {
      progress.stopAnimation();
      return;
    }

    let remaining = DURATION;
    progress.stopAnimation((value: number) => {
      remaining = DURATION * (1 - value);
    });

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: remaining,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (!finished) return;
      if (index < stories.length - 1) setIndex(index + 1);
      else onClose();
    });
    return () => animation.stop();
  }, [index, paused, progress, stories.length, onClose]);

  // Solange etwas im Antwortfeld steht, steht auch die Zeit.
  useEffect(() => {
    setPaused(reply.trim().length > 0);
  }, [reply]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const go = (step: number) => {
    const next = index + step;
    if (next < 0 || next >= stories.length) return onClose();
    setReply('');
    setIndex(next);
  };

  const send = () => {
    const text = reply.trim();
    if (!text) return onNotice('Bitte etwas schreiben');
    setReply('');
    onReply(current, text);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bars}>
        {stories.map((s, i) => (
          <View key={s.id} style={styles.bar}>
            {i < index && <View style={styles.fillFull} />}
            {i === index && <Animated.View style={[styles.fill, { width }]} />}
          </View>
        ))}
      </View>

      <View style={styles.head}>
        <Avatar id={current.userId} name={person?.name ?? current.name} size={sizes.avatarSm} />
        <Text style={styles.name}>{person?.name ?? current.name}</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={24} color={colors.white} />
        </Pressable>
      </View>

      <View style={styles.stage}>
        <Ionicons name="image-outline" size={56} color="rgba(255,255,255,0.4)" />
        {current.caption ? <Text style={styles.caption}>{current.caption}</Text> : null}
        <Pressable
          accessibilityLabel="Vorherige Story"
          style={[styles.zone, styles.zoneLeft]}
          onPress={() => go(-1)}
        />
        <Pressable
          accessibilityLabel="Nächste Story"
          style={[styles.zone, styles.zoneRight]}
          onPress={() => go(1)}
        />
      </View>

      <View style={styles.foot}>
        <TextInput
          style={styles.reply}
          value={reply}
          onChangeText={setReply}
          placeholder="Auf Story antworten"
          placeholderTextColor="rgba(255,255,255,0.6)"
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(reply.trim().length > 0)}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable
          onPress={() => {
            const next = !liked[current.id];
            setLiked({ ...liked, [current.id]: next });
            current.liked = next;
            onNotice(next ? `Dir gefällt die Story von ${person?.name}` : 'Gefällt-mir entfernt');
          }}
          hitSlop={8}
        >
          <Ionicons
            name={liked[current.id] ? 'heart' : 'heart-outline'}
            size={24}
            color={liked[current.id] ? colors.danger : colors.white}
          />
        </Pressable>
        <Pressable onPress={send} hitSlop={8}>
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
  fillFull: { height: '100%', width: '100%', backgroundColor: colors.white },

  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  name: { flex: 1, color: colors.white, ...typography.name },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  caption: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    color: colors.white,
    textAlign: 'center',
    ...typography.message,
    fontWeight: '500',
  },
  zone: { position: 'absolute', top: 0, bottom: 0, width: '32%' },
  zoneLeft: { left: 0 },
  zoneRight: { right: 0 },

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
