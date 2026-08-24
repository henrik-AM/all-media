import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, sizes, spacing } from '../constants/design';
import { AreaKey, SubKey, areaOf } from '../constants/navigation';

interface Props {
  area: AreaKey;
  active: SubKey;
  onChange: (sub: SubKey) => void;
}

/**
 * Obere Leiste: die Unterpunkte des offenen Bereichs. Sie wechselt mit dem
 * Bereich — genau wie im Prototyp. Bereiche ohne Unterpunkte (Einstellungen)
 * zeigen gar keine Leiste.
 */
export const TopSwitcher = ({ area, active, onChange }: Props) => {
  const subs = areaOf(area).subs;
  if (!subs.length) return null;

  return (
    <View style={styles.bar}>
      {subs.map((item) => {
        const isActive = item.key === active;
        return (
          <Pressable
            key={item.key}
            accessibilityLabel={item.label}
            style={[styles.btn, isActive && styles.btnActive]}
            onPress={() => onChange(item.key)}
          >
            <Ionicons
              name={isActive ? item.iconActive : item.icon}
              size={22}
              color={isActive ? colors.brand : colors.text2}
            />
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: sizes.topBar,
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  btn: { flex: 1, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  btnActive: { backgroundColor: colors.brandSoft },
});
