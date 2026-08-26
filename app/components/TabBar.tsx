import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { brandGradient, colors, sizes, typography } from '../constants/design';
import { AreaKey, NAV } from '../constants/navigation';

interface Props {
  active: AreaKey;
  onChange: (area: AreaKey) => void;
  unreadCount?: number;
}

/**
 * Untere Leiste: die vier Bereiche aus dem Prototyp.
 *
 * Der aktive Bereich bekommt zusätzlich zur Farbe einen kurzen Strich über
 * dem Symbol. Farbe allein trägt die Auswahl nicht — bei kleinen Symbolen
 * sieht man den Unterschied zwischen Grau und Violett kaum. Der Strich ist
 * sofort lesbar und ist zugleich die Stelle, an der der Markenverlauf unten
 * im Bild noch einmal auftaucht.
 */
export const TabBar = ({ active, onChange, unreadCount = 0 }: Props) => {
  const insets = useSafeAreaInsets();

  return (
    // Die Leiste hält sich den Platz über der Home-Anzeige selbst frei, damit
    // der App-Hintergrund bis an den unteren Rand läuft.
    <View style={[styles.bar, { height: sizes.tabBar + insets.bottom, paddingBottom: insets.bottom }]}>
      {NAV.map((area) => {
        const isActive = area.key === active;
        return (
          <Pressable key={area.key} style={styles.tab} onPress={() => onChange(area.key)}>
            {isActive ? (
              <LinearGradient
                colors={brandGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.marker}
              />
            ) : (
              <View style={styles.marker} />
            )}
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
  marker: {
    position: 'absolute',
    top: 0,
    width: 26,
    height: 2.5,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: 'transparent',
  },
  label: { color: colors.text3, ...typography.tiny },
  labelActive: { color: colors.brand },
  badge: {
    position: 'absolute',
    top: -5,
    left: 13,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4.5,
    borderRadius: 9,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
});
