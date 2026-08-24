import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { colors, sizes, spacing, typography } from '../constants/design';
import { Story } from '../types';

interface Props {
  stories: Story[];
  onPress: (story: Story) => void;
}

export const StoryRail = ({ stories, onPress }: Props) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.rail}
    style={styles.railWrap}
  >
    {stories.map((story) => (
      <Pressable key={story.id} style={styles.item} onPress={() => onPress(story)}>
        <View style={[styles.ring, story.viewed && styles.ringViewed]}>
          <View style={styles.inner}>
            <Avatar id={story.userId} name={story.name} size={sizes.storyRing - 11} />
          </View>
          {story.own && (
            <View style={styles.addBadge}>
              <Ionicons name="add" size={13} color={colors.white} />
            </View>
          )}
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {story.name}
        </Text>
      </Pressable>
    ))}
  </ScrollView>
);

const styles = StyleSheet.create({
  railWrap: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rail: {
    gap: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  item: {
    width: sizes.storyRing,
    alignItems: 'center',
  },
  ring: {
    width: sizes.storyRing,
    height: sizes.storyRing,
    borderRadius: sizes.storyRing / 2,
    borderWidth: 2.5,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringViewed: {
    borderColor: colors.border,
  },
  inner: {
    borderWidth: 2,
    borderColor: colors.surface,
    borderRadius: sizes.storyRing / 2,
  },
  addBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand,
    borderWidth: 2.5,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    marginTop: 6,
    color: colors.text2,
    ...typography.small,
    fontSize: 11.5,
  },
});
