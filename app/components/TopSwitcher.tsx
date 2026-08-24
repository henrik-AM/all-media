import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, sizes, spacing } from '../constants/design';

export type AreaKey = 'video' | 'messenger' | 'communities' | 'camera' | 'profile';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const AREAS: { key: AreaKey; icon: IconName }[] = [
  { key: 'video', icon: 'play-outline' },
  { key: 'messenger', icon: 'chatbubble-outline' },
  { key: 'communities', icon: 'people-outline' },
  { key: 'camera', icon: 'camera-outline' },
  { key: 'profile', icon: 'person-outline' },
];

interface Props {
  active: AreaKey;
  onChange: (area: AreaKey) => void;
}

export const TopSwitcher = ({ active, onChange }: Props) => (
  <View style={styles.bar}>
    {AREAS.map((area) => {
      const isActive = area.key === active;
      return (
        <Pressable
          key={area.key}
          style={[styles.btn, isActive && styles.btnActive]}
          onPress={() => onChange(area.key)}
        >
          <Ionicons name={area.icon} size={22} color={isActive ? colors.brand : colors.text2} />
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: sizes.topBar,
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  btn: { flex: 1, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  btnActive: { backgroundColor: colors.brandSoft },
});
