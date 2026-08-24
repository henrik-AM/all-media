import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { colors, sizes, spacing, typography } from '../../constants/design';
import { mockStories, mockUsers } from '../../mocks';
import { Story } from '../../types';

interface Props {
  onOpenStory: (story: Story) => void;
  onCreateStory: () => void;
}

export const StoriesScreen = ({ onOpenStory, onCreateStory }: Props) => {
  const own = mockStories.find((s) => s.own)!;
  const unseen = mockStories.filter((s) => !s.own && !s.viewed);
  const seen = mockStories.filter((s) => !s.own && s.viewed);

  const renderStory = (story: Story) => {
    const user = mockUsers[story.userId];
    return (
      <Pressable
        key={story.id}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => onOpenStory(story)}
      >
        <View style={[styles.ring, story.viewed && styles.ringViewed]}>
          <Avatar id={story.userId} name={user?.name ?? story.name} size={sizes.avatarMd} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowName}>{user?.name ?? story.name}</Text>
          <Text style={styles.rowSub}>{story.viewed ? 'Bereits angesehen' : 'Neue Story'}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Storys</Text>
      </View>

      <ScrollView>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={onCreateStory}
        >
          <View style={[styles.ring, styles.ringViewed]}>
            <Avatar id={own.userId} name="Henrik" size={sizes.avatarMd} />
            <View style={styles.addBadge}>
              <Ionicons name="add" size={12} color={colors.white} />
            </View>
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowName}>Deine Story</Text>
            <Text style={styles.rowSub}>Tippe, um etwas zu teilen</Text>
          </View>
        </Pressable>

        {unseen.length > 0 && (
          <>
            <Text style={styles.sectionHead}>Neu</Text>
            {unseen.map(renderStory)}
          </>
        )}
        {seen.length > 0 && (
          <>
            <Text style={styles.sectionHead}>Angesehen</Text>
            {seen.map(renderStory)}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: 14, paddingBottom: 10 },
  title: { color: colors.text, ...typography.title },

  sectionHead: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 6,
    color: colors.text3,
    textTransform: 'uppercase',
    ...typography.overline,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  rowPressed: { backgroundColor: colors.surface2 },
  ring: {
    padding: 2.5,
    borderRadius: 30,
    borderWidth: 2.5,
    borderColor: colors.brand,
  },
  ringViewed: { borderColor: colors.border },
  addBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { color: colors.text, ...typography.name },
  rowSub: { marginTop: 3, color: colors.text2, ...typography.preview },
});
