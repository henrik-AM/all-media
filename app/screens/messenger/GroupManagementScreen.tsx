import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Modal } from 'react-native';
import { colors, spacing, radius, typography, sizes } from '../../constants/design';

interface Group {
  id: string;
  name: string;
  members: number;
  avatar: string;
}

const mockGroups: Group[] = [
  { id: '1', name: 'Projekt Team', members: 4, avatar: '👥' },
  { id: '2', name: 'Friends', members: 8, avatar: '👫' },
  { id: '3', name: 'Work Chat', members: 12, avatar: '💼' },
];

export const GroupManagementScreen = () => {
  const [groups, setGroups] = useState<Group[]>(mockGroups);
  const [modalVisible, setModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  const handleCreateGroup = () => {
    if (newGroupName.trim()) {
      const newGroup: Group = {
        id: String(groups.length + 1),
        name: newGroupName,
        members: 1,
        avatar: '👥',
      };
      setGroups([...groups, newGroup]);
      setNewGroupName('');
      setModalVisible(false);
    }
  };

  const renderGroupItem = ({ item }: { item: Group }) => (
    <TouchableOpacity
      style={styles.groupItem}
      onPress={() => setSelectedGroup(item)}
    >
      <View style={styles.groupAvatar}>
        <Text style={styles.avatarText}>{item.avatar}</Text>
      </View>
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.memberCount}>{item.members} Mitglieder</Text>
      </View>
      <TouchableOpacity style={styles.editButton}>
        <Text style={styles.editIcon}>✎</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gruppen</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.createButtonText}>+ Neu</Text>
        </TouchableOpacity>
      </View>

      {groups.length > 0 ? (
        <FlatList
          data={groups}
          renderItem={renderGroupItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={true}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>Keine Gruppen erstellt</Text>
          <Text style={styles.emptySubtext}>Erstelle eine neue Gruppe, um zu starten</Text>
        </View>
      )}

      {/* Create Group Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Neue Gruppe</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Gruppennamen eingeben..."
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholderTextColor={colors.mediumGray}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleCreateGroup}
              >
                <Text style={styles.confirmText}>Erstellen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Group Details Modal */}
      {selectedGroup && (
        <Modal visible={!!selectedGroup} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedGroup.name}</Text>
                <TouchableOpacity onPress={() => setSelectedGroup(null)}>
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.groupDetailsSection}>
                <Text style={styles.sectionLabel}>Mitglieder ({selectedGroup.members})</Text>
                <View style={styles.membersList}>
                  {[1, 2, 3, 4].map((i) => (
                    <View key={i} style={styles.memberItem}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>👤</Text>
                      </View>
                      <View>
                        <Text style={styles.memberName}>Mitglied {i}</Text>
                        <Text style={styles.memberRole}>Mitglied</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={styles.leaveButton}>
                <Text style={styles.leaveButtonText}>Gruppe verlassen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
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
  createButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.brand,
    borderRadius: radius.small,
  },
  createButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: typography.body.fontSize,
  },
  groupItem: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    alignItems: 'center',
    gap: spacing.md,
  },
  groupAvatar: {
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
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.darkGray,
  },
  memberCount: {
    fontSize: typography.small.fontSize,
    color: colors.mediumGray,
    marginTop: spacing.xs,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIcon: {
    fontSize: 18,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.h3.fontSize,
    fontWeight: '600',
    color: colors.darkGray,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    fontSize: typography.small.fontSize,
    color: colors.mediumGray,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.large,
    borderTopRightRadius: radius.large,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.h2.fontSize,
    fontWeight: '700',
    color: colors.darkGray,
  },
  closeIcon: {
    fontSize: 24,
    color: colors.darkGray,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: radius.small,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.body.fontSize,
    marginBottom: spacing.lg,
    color: colors.darkGray,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: colors.lightGray,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.darkGray,
    fontWeight: '600',
    fontSize: typography.body.fontSize,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.small,
    backgroundColor: colors.brand,
    alignItems: 'center',
  },
  confirmText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: typography.body.fontSize,
  },

  // Group details
  groupDetailsSection: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: typography.small.fontSize,
    fontWeight: '600',
    color: colors.mediumGray,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },
  membersList: {
    gap: spacing.md,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 18,
  },
  memberName: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.darkGray,
  },
  memberRole: {
    fontSize: typography.small.fontSize,
    color: colors.mediumGray,
    marginTop: spacing.xs,
  },
  leaveButton: {
    paddingVertical: spacing.md,
    borderRadius: radius.small,
    backgroundColor: colors.like,
    alignItems: 'center',
  },
  leaveButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: typography.body.fontSize,
  },
});
