import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../constants/design';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface ActionSheetItem {
  key: string;
  label: string;
  icon: IconName;
}

interface Props {
  visible: boolean;
  title: string;
  items: ActionSheetItem[];
  onSelect: (key: string) => void;
  onClose: () => void;
}

export const ActionSheet = ({ visible, title, items, onSelect, onClose }: Props) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose} />
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <Text style={styles.title}>{title}</Text>
      {items.map((item) => (
        <Pressable
          key={item.key}
          style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          onPress={() => onSelect(item.key)}
        >
          <View style={styles.icon}>
            <Ionicons name={item.icon} size={18} color={colors.text2} />
          </View>
          <Text style={styles.label}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text3} />
        </Pressable>
      ))}
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(6,8,12,0.52)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.xl,
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
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemPressed: { backgroundColor: colors.surface2 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, color: colors.text, ...typography.body },
});
