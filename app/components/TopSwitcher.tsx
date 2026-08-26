import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Druck } from './Druck';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, sizes, spacing, themenStyles } from '../constants/design';
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
  const insets = useSafeAreaInsets();
  const subs = areaOf(area).subs;
  if (!subs.length) return null;

  return (
    // Die Leiste haelt sich den Platz unter der Statusleiste selbst frei,
    // damit der App-Hintergrund bis an den oberen Rand laeuft.
    <View style={[styles.bar, { height: sizes.topBar + insets.top, paddingTop: insets.top }]}>
      {subs.map((item) => {
        const isActive = item.key === active;
        return (
          <Druck
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
          </Druck>
        );
      })}
    </View>
  );
};

const styles = themenStyles((colors) => ({
  bar: {
    flexDirection: 'row',
    height: sizes.topBar,
    alignItems: 'center',
    gap: 0,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  /* Die aktive Pille ist schmaler als das Feld — sie soll um das Symbol
     sitzen, nicht das ganze Viertel füllen. Sonst wirkt die Leiste wie ein
     Baukasten aus vier Kacheln. */
  btn: {
    flex: 1,
    height: 36,
    marginHorizontal: 10,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: { backgroundColor: colors.brandSoft },
}));
