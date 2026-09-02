/**
 * Ein Bild mit einem Kamerafilter darüber.
 *
 * Steht an drei Stellen: in der Kamera als Vorschau, im Insight-Betrachter
 * beim Empfänger und in der Insight-Sammlung. Dass es dieselbe Komponente
 * ist, ist der Punkt — sonst sähe die Aufnahme beim Verschicken anders aus
 * als beim Ansehen, und niemand könnte sagen, welche Fassung die richtige
 * ist.
 *
 * Wie die Filter gebaut sind und warum es keine echten Bildfilter sind,
 * steht in constants/filter.ts.
 */

import React from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';
import { filterZu } from '../constants/filter';

interface Props {
  uri: string;
  /** Der gespeicherte Filtername, z. B. „warm". */
  filter?: string | null;
  style?: ViewStyle;
  /** Ein Video zeigt hier nur das erste Bild — bewegt wird es anderswo. */
  passform?: 'cover' | 'contain';
}

export const FilterBild = ({ uri, filter, style, passform = 'cover' }: Props) => {
  const f = filterZu(filter);

  return (
    <View style={[styles.rahmen, style]}>
      <Image source={{ uri }} style={styles.bild} resizeMode={passform} />

      {f.staerke > 0 && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill as any, { backgroundColor: f.ton, opacity: f.staerke }]}
        />
      )}

      {/*
       * Die Abdunkelung der Ecken. Vier schmale Streifen statt eines echten
       * Verlaufs: ein Verlauf bräuchte expo-linear-gradient, und die vier
       * Kanten reichen, um dem Bild Tiefe zu geben.
       */}
      {Boolean(f.ecken) && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill as any}>
          <View style={[styles.kante, styles.oben, { opacity: f.ecken }]} />
          <View style={[styles.kante, styles.unten, { opacity: f.ecken }]} />
          <View style={[styles.kante, styles.links, { opacity: f.ecken }]} />
          <View style={[styles.kante, styles.rechts, { opacity: f.ecken }]} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  rahmen: { overflow: 'hidden', backgroundColor: '#000' },
  bild: { width: '100%', height: '100%' },
  kante: { position: 'absolute', backgroundColor: '#000' },
  oben: { top: 0, left: 0, right: 0, height: '16%' },
  unten: { bottom: 0, left: 0, right: 0, height: '16%' },
  links: { top: 0, bottom: 0, left: 0, width: '10%' },
  rechts: { top: 0, bottom: 0, right: 0, width: '10%' },
});
