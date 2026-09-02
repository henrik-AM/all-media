/**
 * Einen empfangenen Insight ansehen.
 *
 * WAS HIER BESONDERS IST
 *
 * Ein Insight ist keine Story und keine Nachricht. Drei Dinge unterscheiden
 * ihn, und alle drei stehen im Handbuch:
 *
 *   Einmalansicht     Nach dem Schließen ist er weg. Deshalb wird „gesehen"
 *                     nicht beim Schließen vermerkt, sondern beim Öffnen —
 *                     wer die App im falschen Moment beendet, hätte ihn
 *                     sonst zweimal.
 *   Anzeigedauer      Eine Leiste läuft ab; bei „Unbegrenzt" läuft sie nicht.
 *   Selbstlöschend    Ist er abgelaufen, kommt er gar nicht erst in die
 *                     Liste (siehe ladeInsights in lib/daten.ts).
 *
 * Der Filter wird mit angezeigt, weil er am Insight gespeichert ist. Ohne
 * das sähe die Aufnahme beim Empfänger anders aus als beim Absender, und
 * niemand könnte sagen, welche Fassung die richtige ist.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Druck } from '../../components/Druck';
import { FilterBild } from '../../components/FilterBild';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';
import { useDaten } from '../../contexts/DatenContext';
import { useAktionen } from '../../lib/useAktionen';
import { Insight } from '../../types';

interface Props {
  /** Die Insights dieser Person, älteste zuerst. */
  insights: Insight[];
  onClose: () => void;
  onNotice: (text: string) => void;
}

export const InsightViewerScreen = ({ insights, onClose, onNotice }: Props) => {
  const insets = useSafeAreaInsets();
  const { users, insightStreaks, neuLaden } = useDaten();
  const aktionen = useAktionen(onNotice);

  const [nummer, setNummer] = useState(0);
  const fortschritt = useRef(new Animated.Value(0)).current;
  const insight = insights[nummer];

  /*
   * Gesehen wird beim Öffnen vermerkt, nicht beim Weiterblättern.
   *
   * Bei Einmalansicht ist das der Unterschied zwischen „einmal" und
   * „mindestens einmal": wer die App schließt, während der Insight offen
   * steht, bekäme ihn sonst beim nächsten Start noch einmal — und die
   * Zusage, dass er nur einmal zu sehen ist, wäre gebrochen.
   */
  useEffect(() => {
    if (insight && !insight.gesehen) aktionen.insightGesehen(insight.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insight?.id]);

  /* Die ablaufende Leiste. Bei „Unbegrenzt" (dauer = 0) läuft nichts. */
  useEffect(() => {
    if (!insight) return;
    fortschritt.setValue(0);
    if (!insight.dauer) return;

    const lauf = Animated.timing(fortschritt, {
      toValue: 1,
      duration: insight.dauer * 1000,
      useNativeDriver: false,
    });
    lauf.start(({ finished }) => {
      if (finished) weiter();
    });
    return () => lauf.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insight?.id]);

  const weiter = () => {
    if (nummer + 1 < insights.length) return setNummer((n) => n + 1);
    // Am Ende neu laden: die eben gesehenen Einmalansichten sollen aus der
    // Liste verschwinden, nicht bis zum nächsten App-Start stehen bleiben.
    void neuLaden();
    onClose();
  };

  /*
   * Nichts mehr da — der Insight ist abgelaufen oder war eine Einmalansicht,
   * die inzwischen verbraucht ist. Ein leerer schwarzer Bildschirm waere an
   * dieser Stelle ein Fehler; also steht es da.
   */
  if (!insight) {
    return (
      <Druck style={[styles.screen, styles.leer, { paddingTop: insets.top }]} onPress={onClose}>
        <Ionicons name="flash-off-outline" size={44} color="rgba(255,255,255,0.35)" />
        <Text style={styles.leerText}>Dieser Insight ist nicht mehr da.</Text>
        <Text style={styles.leerSub}>Tippen zum Schließen</Text>
      </Druck>
    );
  }

  const absender = users[insight.senderId];
  const streak = insightStreaks[insight.senderId];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Ein Balken je Insight dieser Person — wie bei Storys, damit man
          sieht, wie viele noch kommen. */}
      <View style={styles.balken}>
        {insights.map((_, i) => (
          <View key={i} style={styles.balkenSpur}>
            <Animated.View
              style={[
                styles.balkenFuellung,
                i < nummer && styles.balkenVoll,
                i === nummer && {
                  width: insight.dauer
                    ? fortschritt.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      })
                    : '100%',
                },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.kopf}>
        <View style={styles.kopfText}>
          <Text style={styles.name}>{absender?.name ?? 'Unbekannt'}</Text>
          <Text style={styles.zeit}>
            {insight.zeit}
            {/* Die Insight Time steht dabei — hier ist der Moment, in dem
                sie jemanden interessiert. */}
            {streak?.tage ? `  ·  📷 ${streak.tage}` : ''}
          </Text>
        </View>
        <Druck onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={26} color={colors.white} />
        </Druck>
      </View>

      <Druck style={styles.buehne} onPress={weiter}>
        <FilterBild
          uri={insight.mediaUrl}
          filter={insight.filter}
          style={styles.bild}
          passform="contain"
        />
      </Druck>

      <View style={[styles.fuss, { paddingBottom: insets.bottom + spacing.lg }]}>
        {/* Was mit diesem Insight passiert, muss dastehen. „Einmalansicht"
            nachträglich zu erfahren ist zu spät. */}
        <View style={styles.marke}>
          <Ionicons
            name={insight.einmal ? 'flash' : 'repeat'}
            size={13}
            color="rgba(255,255,255,0.85)"
          />
          <Text style={styles.markeText}>
            {insight.einmal ? 'Einmalansicht' : 'Mehrfach ansehbar'}
            {insight.dauer ? `  ·  ${insight.dauer} s` : '  ·  unbegrenzt'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = themenStyles((colors) => ({
  screen: { flex: 1, backgroundColor: '#0B0B0C' },
  leer: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  leerText: { ...typography.name, color: 'rgba(255,255,255,0.8)' },
  leerSub: { ...typography.small, color: 'rgba(255,255,255,0.4)' },
  balken: { flexDirection: 'row', gap: 4, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  balkenSpur: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  balkenFuellung: { height: 3, width: '0%', backgroundColor: colors.white },
  balkenVoll: { width: '100%' },
  kopf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  kopfText: { flex: 1 },
  name: { ...typography.name, color: colors.white },
  zeit: { ...typography.tiny, color: 'rgba(255,255,255,0.6)' },
  buehne: { flex: 1 },
  bild: { flex: 1, backgroundColor: '#0B0B0C' },
  fuss: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, alignItems: 'center' },
  marke: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  markeText: { ...typography.small, color: 'rgba(255,255,255,0.85)' },
}));
