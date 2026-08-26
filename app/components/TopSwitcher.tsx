import React from 'react';
import { Text, View } from 'react-native';
import { Druck } from './Druck';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { markenVerlauf, shadow, themenStyles } from '../constants/design';
import { AreaKey, SubKey, areaOf } from '../constants/navigation';

interface Props {
  area: AreaKey;
  active: SubKey;
  onChange: (sub: SubKey) => void;
  /** Zaehler je Unterpunkt, z. B. { chats: 3 }. Leere Werte zeigen nichts. */
  zaehler?: Partial<Record<SubKey, number>>;
}

/**
 * Die Dynamic Island: die Unterpunkte des offenen Bereichs.
 *
 * Frueher war das eine Leiste ueber die volle Breite mit Trennlinie darunter.
 * Henrik hat sie am 26.08.2026 als „stark hingeklatscht" zurueckgemeldet — zu
 * Recht: sie sass auf derselben Flaeche wie der Inhalt und hatte keine eigene
 * Gestalt.
 *
 * Jetzt schwebt sie wie beim iPhone: absolut gesetzt, nur so breit wie ihre
 * Knoepfe, rundum Luft, dunkler Grund mit weichem Schatten. Der dunkle Grund
 * bleibt in beiden Themen — beim iPhone ist die Insel ebenfalls immer
 * schwarz, egal ob die App hell oder dunkel laeuft. Eine helle Pille auf
 * hellem Grund waere wieder eine Leiste.
 *
 * Bereiche ohne Unterpunkte (Einstellungen) zeigen gar keine Insel.
 * `INSEL_HOEHE` sagt der Shell, wieviel Platz sie darunter frei lassen muss.
 */
export const INSEL_HOEHE = 44;
export const INSEL_ABSTAND = 10;

export const TopSwitcher = ({ area, active, onChange, zaehler }: Props) => {
  const insets = useSafeAreaInsets();
  const subs = areaOf(area).subs;
  if (!subs.length) return null;

  return (
    <View style={[styles.wrap, { top: insets.top + INSEL_ABSTAND }]} pointerEvents="box-none">
      <View style={styles.insel}>
        {subs.map((item) => {
          const isActive = item.key === active;
          const zahl = zaehler?.[item.key] ?? 0;
          return (
            <Druck
              key={item.key}
              accessibilityLabel={zahl ? `${item.label}, ${zahl} ungelesen` : item.label}
              style={styles.btn}
              onPress={() => onChange(item.key)}
            >
              {isActive && (
                <LinearGradient
                  colors={markenVerlauf()}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.aktiv}
                />
              )}
              <Ionicons
                name={isActive ? item.iconActive : item.icon}
                size={21}
                color={isActive ? '#FFFFFF' : 'rgba(255,255,255,0.62)'}
              />
              {zahl > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{zahl > 99 ? '99+' : zahl}</Text>
                </View>
              )}
            </Druck>
          );
        })}
      </View>
    </View>
  );
};

const styles = themenStyles(() => ({
  /* Volle Breite, damit die Insel darin mittig sitzt — aber ohne Klicks
     ausserhalb der Insel abzufangen (pointerEvents="box-none" oben). */
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 15,
    alignItems: 'center',
  },
  insel: {
    flexDirection: 'row',
    height: INSEL_HOEHE,
    paddingHorizontal: 5,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(22,24,29,0.94)',
    ...shadow.md,
  },
  btn: {
    width: 46,
    height: 34,
    marginHorizontal: 3,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Der Verlauf liegt hinter dem Symbol, nicht als Hintergrundfarbe am
     Knopf — React Native kennt keinen Verlauf als backgroundColor. */
  aktiv: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  badge: {
    position: 'absolute',
    top: -1,
    right: 3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: '#E5484D',
    borderWidth: 1.5,
    /* Fester Ton statt der halbdurchsichtigen Inselfarbe: sonst schiene der
       Inhalt durch den Ring und die rote Zahl saehe fleckig aus. */
    borderColor: '#16181D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '700' },
}));
