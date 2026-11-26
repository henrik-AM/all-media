import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { colors, themenStyles } from '../constants/design';

/*
 * Einstellungen 16.11., Kasten 1.2 (Henrik): „Alle an/aus Regler sind nicht
 * richtig zentriert … sollen von grau auf grün und wieder zurück springen,
 * nicht von grau auf lila.“
 *
 * Bis zum 24.11.2026 stand überall der native `Switch` mit
 * `trackColor.true = colors.brand` (lila). Unter iOS 26 ist der native Regler
 * größer, als Yoga ihn misst — in der 54-pt-Zeile ragte er nach oben in die
 * Nachbarzeile („Dunkles Design“ bis zu „Geräteverknüpfung“). Dieser Baustein
 * zeichnet den Regler selbst: feste Größe 51 × 31, sitzt dadurch immer mittig
 * in seiner Zeile, sieht auf iOS, Android und Website gleich aus (.switch in
 * web/public/styles.css), aus = grau, an = grün (colors.success).
 */
interface Props {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  /** Vorlesetext; ohne ihn liest der Bildschirmleser nur „Schalter“. */
  accessibilityLabel?: string;
  testID?: string;
}

const BREITE = 51;
const HOEHE = 31;
const KNOPF = 27;
const WEG = BREITE - KNOPF - 4;

export const Schalter = ({ value, onValueChange, disabled, accessibilityLabel, testID }: Props) => {
  const lage = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(lage, { toValue: value ? 1 : 0, duration: 160, useNativeDriver: false }).start();
  }, [value, lage]);

  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={styles.rahmen}
    >
      <Animated.View
        style={[
          styles.spur,
          {
            backgroundColor: lage.interpolate({ inputRange: [0, 1], outputRange: [colors.schalterAus, colors.success] }),
          },
          disabled && styles.aus,
        ]}
      >
        <Animated.View
          style={[styles.knopf, { transform: [{ translateX: lage.interpolate({ inputRange: [0, 1], outputRange: [0, WEG] }) }] }]}
        />
      </Animated.View>
    </Pressable>
  );
};

/** Leerer Platz in Schaltergröße — für Zeilen, die rechts bündig bleiben sollen. */
export const SchalterPlatz = () => <View style={{ width: BREITE, height: HOEHE }} />;

const styles = themenStyles((colors) => ({
  rahmen: { width: BREITE, height: HOEHE, alignSelf: 'center', flexShrink: 0 },
  spur: { width: BREITE, height: HOEHE, borderRadius: HOEHE / 2, padding: 2, justifyContent: 'center' },
  knopf: {
    width: KNOPF,
    height: KNOPF,
    borderRadius: KNOPF / 2,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  aus: { opacity: 0.45 },
}));
