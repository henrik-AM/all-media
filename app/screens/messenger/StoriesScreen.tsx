import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { colors, spacing, radius, typography, sizes } from '../../constants/design';

interface Story {
  id: string;
  userName: string;
  avatar: string;
  timestamp: Date;
  viewed: boolean;
}

const mockStories: Story[] = [
  { id: '1', userName: 'Anna Schmidt', avatar: '👩', timestamp: new Date(Date.now() - 3600000), viewed: false },
  { id: '2', userName: 'Bob Müller', avatar: '👨', timestamp: new Date(Date.now() - 7200000), viewed: true },
  { id: '3', userName: 'Clara Weber', avatar: '👩‍🦰', timestamp: new Date(Date.now() - 86400000), viewed: true },
];

export const StoriesScreen = () => {
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);

  if (selectedStory) {
    return <StoryViewer story={selectedStory} onClose={() => setSelectedStory(null)} />;
  }

  const renderStoryItem = ({ item }: { item: Story }) => (
    <TouchableOpacity
      style={[styles.storyItem, !item.viewed && styles.storyItemUnread]}
      onPress={() => setSelectedStory(item)}
    >
      <View style={styles.storyAvatar}>
        <Text style={styles.avatarText}>{item.avatar}</Text>
      </View>
      <View style={styles.storyInfo}>
        <Text style={styles.storyName}>{item.userName}</Text>
        <Text style={styles.storyTime}>vor 1h</Text>
      </View>
      {!item.viewed && <View style={styles.unviewedDot} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Geschichten</Text>
        <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={mockStories}
        renderItem={renderStoryItem}
        keyExtractor={(item) => item.id}
        scrollEnabled={true}
      />
    </View>
  );
};

const StoryViewer = ({ story, onClose }: { story: Story; onClose: () => void }) => {
  const [progress, setProgress] = useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          onClose();
          return 0;
        }
        return p + 5;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [onClose]);

  return (
    <View style={styles.storyViewerContainer}>
      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>

      {/* Header */}
      <View style={styles.storyViewerHeader}>
        <View style={styles.storyViewerAvatar}>
          <Text style={styles.avatarText}>{story.avatar}</Text>
        </View>
        <Text style={styles.storyViewerName}>{story.userName}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.storyContent}>
        <Text style={styles.storyContentText}>📸 Story Content</Text>
        <Text style={styles.storyContentSubtext}>(Bild/Video würde hier sein)</Text>
      </View>

      {/* Actions */}
      <View style={styles.storyActions}>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>❤️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>💬</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  title: {
    fontSize: typography.h2.fontSize,
    fontWeight: '700',
    color: colors.darkGray,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '700',
  },
  storyItem: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    alignItems: 'center',
    gap: spacing.md,
  },
  storyItemUnread: {
    backgroundColor: colors.lightGray,
  },
  storyAvatar: {
    width: sizes.avatar,
    height: sizes.avatar,
    borderRadius: radius.medium,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.brand,
  },
  avatarText: {
    fontSize: 24,
  },
  storyInfo: {
    flex: 1,
  },
  storyName: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.darkGray,
  },
  storyTime: {
    fontSize: typography.small.fontSize,
    color: colors.mediumGray,
    marginTop: spacing.xs,
  },
  unviewedDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.brand,
  },

  // Story Viewer
  storyViewerContainer: {
    flex: 1,
    backgroundColor: colors.black,
    justifyContent: 'space-between',
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: colors.darkGray,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.brand,
  },
  storyViewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  storyViewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.darkGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyViewerName: {
    flex: 1,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.white,
  },
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: colors.white,
  },
  storyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyContentText: {
    fontSize: 36,
    marginBottom: spacing.md,
  },
  storyContentSubtext: {
    fontSize: typography.small.fontSize,
    color: colors.mediumGray,
  },
  storyActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.darkGray,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.darkGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 24,
  },
});
