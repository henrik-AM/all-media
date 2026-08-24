import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, sizes, typography } from '../constants/design';
import { AreaKey, NAV } from '../constants/navigation';

interface Props {
  active: AreaKey;
  onChange: (area: AreaKey) => void;
  unreadCount?: number;
}

/** Untere Leiste: die vier Bereiche aus dem Prototyp. */
export const TabBar = ({ active, onChange, unreadCount = 0 }: Props) => {
  const insets = useSafeAreaInsets();

  return (
  // Die Leiste haelt sich den Platz ueber der Home-Anzeige selbst frei, damit
  // der App-Hintergrund bis an den unteren Rand laeuft.
  <View style={[styles.bar, { height: sizes.tabBar + insets.bottom, paddingBottom: insets.bottom }]}>
    {NAV.map((area) => {
      const isActive = area.key === active;
      return (
        <Pressable key={area.key} style={styles.tab} onPress={() => onChange(area.key)}>
          <View>
            <Ionicons
              name={isActive ? area.iconActive : area.icon}
              size={23}
              color={isActive ? colors.brand : colors.text3}
            />
            {area.key === 'messenger' && unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
            {area.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
  );
};

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
