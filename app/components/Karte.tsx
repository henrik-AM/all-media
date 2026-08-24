import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { avatarColor, colors, radius, spacing, typography } from '../constants/design';

/**
 * Eine gezeichnete Stadtkarte zum Zoomen und Schieben.
 *
 * Warum selbst gezeichnet und nicht react-native-maps: Das Kartenmodul
 * braucht nativen Code und laeuft in Expo Go nicht mehr - es wuerde einen
 * eigenen Build voraussetzen. Diese Karte laeuft ueberall sofort und reicht
 * fuer den Prototypen. Fuer echte Kacheln spaeter Development Build plus
 * react-native-maps.
 */

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export interface Pin {
  id: string;
  name: string;
  /** Position in Prozent der Kartenflaeche. */
  x: number;
  y: number;
}

export interface KartenSteuerung {
  /** Auf einen Pin zoomen und ihn mittig setzen. */
  zoomAuf: (pinId: string) => void;
  /** Zurueck auf die Gesamtansicht. */
  zuruecksetzen: () => void;
}

interface Props {
  pins: Pin[];
  /** Welcher Pin gerade hervorgehoben ist. */
  aktiv?: string | null;
  onPinPress?: (pinId: string) => void;
  hoehe?: number;
}

/** Strassenraster und Blockflaechen - rein zur Optik. */
const STRASSEN_X = [12, 27, 44, 61, 78, 92];
const STRASSEN_Y = [15, 33, 52, 70, 87];

const BLOECKE = [
  { x: 4, y: 6, w: 16, h: 18 },
  { x: 32, y: 4, w: 20, h: 14 },
  { x: 66, y: 8, w: 22, h: 16 },
  { x: 6, y: 40, w: 14, h: 20 },
  { x: 34, y: 38, w: 18, h: 22 },
  { x: 70, y: 42, w: 18, h: 18 },
  { x: 14, y: 74, w: 22, h: 16 },
  { x: 52, y: 76, w: 26, h: 14 },
];

export const Karte = forwardRef<KartenSteuerung, Props>(
  ({ pins, aktiv, onPinPress, hoehe = 320 }, ref) => {
    const [zoom, setZoom] = useState(MIN_ZOOM);
    // Die Breite steht erst nach dem Layout fest - vorher ein Schaetzwert.
    const [breite, setBreite] = useState(340);
    const versatz = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const zoomWert = useRef(new Animated.Value(MIN_ZOOM)).current;
    const stand = useRef({ x: 0, y: 0, zoom: MIN_ZOOM });

    // Nadeln und der eigene Punkt sollen ihre Groesse behalten - sonst fuellt
    // eine Nadel beim Hineinzoomen den halben Bildschirm. Dazu gegen den
    // Kartenzoom skalieren.
    const gegenZoom = useRef(
      zoomWert.interpolate({
        inputRange: [MIN_ZOOM, MAX_ZOOM],
        outputRange: [1, 1 / MAX_ZOOM],
      })
    ).current;

    /** Wie weit darf man schieben, ohne dass die Karte den Rahmen verlaesst. */
    const grenze = (z: number) => ({
      x: ((z - 1) * breite) / 2,
      y: ((z - 1) * hoehe) / 2,
    });

    const begrenze = (wert: number, max: number) => Math.max(-max, Math.min(max, wert));

    const setzeZoom = (neu: number, ziel?: { x: number; y: number }) => {
      const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, neu));
      const g = grenze(z);
      const x = ziel ? begrenze(ziel.x, g.x) : begrenze(stand.current.x, g.x);
      const y = ziel ? begrenze(ziel.y, g.y) : begrenze(stand.current.y, g.y);

      stand.current = { x, y, zoom: z };
      setZoom(z);

      Animated.parallel([
        Animated.spring(zoomWert, { toValue: z, useNativeDriver: true, friction: 8 }),
        Animated.spring(versatz, { toValue: { x, y }, useNativeDriver: true, friction: 8 }),
      ]).start();
    };

    useImperativeHandle(ref, () => ({
      zoomAuf: (pinId: string) => {
        const pin = pins.find((p) => p.id === pinId);
        if (!pin) return;

        // Der Pin sitzt bei x/y Prozent. Beim Zoomen muss er in die Mitte -
        // dazu die Karte um die Abweichung von der Mitte verschieben. Je
        // weiter aussen die Person steht, desto weiter muss hineingezoomt
        // werden, damit die Verschiebung ueberhaupt erlaubt ist.
        const abstand = Math.max(Math.abs(50 - pin.x), Math.abs(50 - pin.y)) / 100;
        const z = Math.min(MAX_ZOOM, Math.max(2.4, 1 / Math.max(0.001, 0.52 - abstand)));
        const abweichungX = (50 - pin.x) / 100;
        const abweichungY = (50 - pin.y) / 100;
        setzeZoom(z, { x: abweichungX * breite * z, y: abweichungY * hoehe * z });
      },
      zuruecksetzen: () => setzeZoom(MIN_ZOOM, { x: 0, y: 0 }),
    }));

    // Schieben mit einem Finger, Zoomen mit zwei.
    const abstandStart = useRef(0);
    const zoomStart = useRef(MIN_ZOOM);

    const pan = useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
          onPanResponderGrant: () => {
            abstandStart.current = 0;
            zoomStart.current = stand.current.zoom;
          },
          onPanResponderMove: (e, g) => {
            const finger = e.nativeEvent.touches;

            if (finger.length >= 2) {
              const dx = finger[0].pageX - finger[1].pageX;
              const dy = finger[0].pageY - finger[1].pageY;
              const abstand = Math.sqrt(dx * dx + dy * dy);

              if (!abstandStart.current) {
                abstandStart.current = abstand;
                return;
              }
              const faktor = abstand / abstandStart.current;
              const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomStart.current * faktor));
              zoomWert.setValue(z);
              stand.current.zoom = z;
              setZoom(z);
              return;
            }

            const gr = grenze(stand.current.zoom);
            versatz.setValue({
              x: begrenze(stand.current.x + g.dx, gr.x),
              y: begrenze(stand.current.y + g.dy, gr.y),
            });
          },
          onPanResponderRelease: (_e, g) => {
            const gr = grenze(stand.current.zoom);
            stand.current = {
              ...stand.current,
              x: begrenze(stand.current.x + g.dx, gr.x),
              y: begrenze(stand.current.y + g.dy, gr.y),
            };
            versatz.setValue({ x: stand.current.x, y: stand.current.y });
          },
        }),
      [hoehe, breite]
    );

    return (
      <View
        style={[styles.rahmen, { height: hoehe }]}
        onLayout={(e) => setBreite(e.nativeEvent.layout.width)}
      >
        <Animated.View
          style={[
            styles.flaeche,
            {
              transform: [
                { translateX: versatz.x },
                { translateY: versatz.y },
                { scale: zoomWert },
              ],
            },
          ]}
          {...pan.panHandlers}
        >
          {/* Grünfläche und Wasser */}
          <View style={styles.park} />
          <View style={styles.fluss} />

          {/* Häuserblöcke */}
          {BLOECKE.map((b, i) => (
            <View
              key={`b${i}`}
              style={[
                styles.block,
                { left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%` },
              ]}
            />
          ))}

          {/* Straßenraster */}
          {STRASSEN_X.map((x) => (
            <View key={`sx${x}`} style={[styles.strasseV, { left: `${x}%` }]} />
          ))}
          {STRASSEN_Y.map((y) => (
            <View key={`sy${y}`} style={[styles.strasseH, { top: `${y}%` }]} />
          ))}

          {/* Eigener Standort */}
          <Animated.View style={[styles.ich, { transform: [{ scale: gegenZoom }] }]}>
            <View style={styles.ichPunkt} />
          </Animated.View>

          {/* Die Freunde */}
          {pins.map((pin) => {
            const istAktiv = aktiv === pin.id;
            return (
              <Animated.View
                key={pin.id}
                style={[
                  styles.pin,
                  { left: `${pin.x}%`, top: `${pin.y}%`, transform: [{ scale: gegenZoom }] },
                ]}
              >
              <Pressable onPress={() => onPinPress?.(pin.id)} hitSlop={6} style={styles.pinInhalt}>
                <View
                  style={[
                    styles.punkt,
                    { backgroundColor: avatarColor(pin.id) },
                    istAktiv && styles.punktAktiv,
                  ]}
                >
                  <Text style={styles.punktText}>{pin.name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <Text style={styles.pinName} numberOfLines={1}>
                  {pin.name.split(' ')[0]}
                </Text>
              </Pressable>
              </Animated.View>
            );
          })}
        </Animated.View>

        {/* Zoomknöpfe - verlässlicher als Zwei-Finger-Gesten auf kleinen Geräten */}
        <View style={styles.zoomLeiste}>
          <Pressable style={styles.zoomBtn} onPress={() => setzeZoom(stand.current.zoom + 0.6)}>
            <Ionicons name="add" size={20} color={colors.text} />
          </Pressable>
          <View style={styles.zoomTrenner} />
          <Pressable style={styles.zoomBtn} onPress={() => setzeZoom(stand.current.zoom - 0.6)}>
            <Ionicons name="remove" size={20} color={colors.text} />
          </Pressable>
        </View>

        {zoom > MIN_ZOOM + 0.05 && (
          <Pressable style={styles.zurueck} onPress={() => setzeZoom(MIN_ZOOM, { x: 0, y: 0 })}>
            <Ionicons name="scan-outline" size={15} color={colors.text} />
            <Text style={styles.zurueckText}>Ganze Karte</Text>
          </Pressable>
        )}
      </View>
    );
  }
);

Karte.displayName = 'Karte';

const styles = StyleSheet.create({
  rahmen: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: '#E8EDE4',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  flaeche: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },

  park: {
    position: 'absolute',
    left: '54%',
    top: '24%',
    width: '30%',
    height: '22%',
    borderRadius: 14,
    backgroundColor: '#CFE0C3',
  },
  fluss: {
    position: 'absolute',
    left: '-10%',
    top: '60%',
    width: '130%',
    height: 22,
    backgroundColor: '#BBD7E8',
    transform: [{ rotate: '-8deg' }],
  },
  block: { position: 'absolute', backgroundColor: '#DCDFD8', borderRadius: 3 },
  strasseV: { position: 'absolute', top: 0, bottom: 0, width: 5, backgroundColor: '#FAFAF8' },
  strasseH: { position: 'absolute', left: 0, right: 0, height: 5, backgroundColor: '#FAFAF8' },

  ich: {
    position: 'absolute',
    left: '50%',
    top: '46%',
    width: 26,
    height: 26,
    marginLeft: -13,
    marginTop: -13,
    borderRadius: 13,
    backgroundColor: 'rgba(10,102,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ichPunkt: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.white,
  },

  pin: { position: 'absolute', alignItems: 'center', marginLeft: -17, marginTop: -40, width: 34 },
  pinInhalt: { alignItems: 'center', gap: 2 },
  punkt: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: colors.surface,
  },
  punktAktiv: { borderColor: colors.brand, borderWidth: 3.5 },
  punktText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  pinName: {
    ...typography.small,
    fontSize: 10,
    color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 5,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },

  zoomLeiste: {
    position: 'absolute',
    right: 10,
    top: 10,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.94)',
    overflow: 'hidden',
  },
  zoomBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  zoomTrenner: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },

  zurueck: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  zurueckText: { ...typography.small, color: colors.text, fontWeight: '600' },
});
