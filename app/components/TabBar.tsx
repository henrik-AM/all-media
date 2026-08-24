import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, sizes, typography } from '../constants/design';

export type TabKey = 'chats' | 'stories' | 'contacts' | 'settings';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { key: TabKey; label: string; icon: IconName; iconActive: IconName }[] = [
  { key: 'chats', label: 'Chats', icon: 'chatbubble-outline', iconActive: 'chatbubble' },
  { key: 'stories', label: 'Storys', icon: 'aperture-outline', iconActive: 'aperture' },
  { key: 'contacts', label: 'Kontakte', icon: 'people-outline', iconActive: 'people' },
  { key: 'settings', label: 'Einstellungen', icon: 'settings-outline', iconActive: 'settings' },
];

interface Props {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  unreadCount?: number;
}

export const TabBar = ({ active, onChange, unreadCount = 0 }: Props) => (
  <View style={styles.bar}>
    {TABS.map((tab) => {
      const isActive = tab.key === active;
      return (
        <Pressable key={tab.key} style={styles.tab} onPress={() => onChange(tab.key)}>
          <View>
            <Ionicons
              name={isActive ? tab.iconActive : tab.icon}
              size={23}
              color={isActive ? colors.brand : colors.text3}
            />
            {tab.key === 'chats' && unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
            {tab.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: sizes.tabBar,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { color: colors.text3, ...typography.tiny },
  labelActive: { color: colors.brand },
  badge: {
    position: 'absolute',
    top: -4,
    left: 14,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
});
