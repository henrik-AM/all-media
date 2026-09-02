/**
 * Eine Umfrage — an einem Beitrag, einer Story oder in einem Kanal.
 *
 * WARUM DIE BALKEN ERST NACH DER STIMME KOMMEN
 *
 * Vor der eigenen Stimme steht nur die Antwort da, ohne Zahl und ohne
 * Balken. Wer die Verteilung vorher sieht, stimmt nicht mehr für seine
 * eigene Antwort, sondern für die führende — das ist bei jeder Umfrage so
 * und der Grund, warum Instagram und Twitter es genauso halten.
 *
 * Nach der Stimme sind Balken und Prozent da, und die eigene Antwort ist
 * hervorgehoben.
 *
 * Bei einer beendeten Umfrage werden die Zahlen ohne Stimme gezeigt: dort
 * ist nichts mehr zu beeinflussen.
 */

import React from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Druck } from './Druck';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';
import { Umfrage } from '../types';

interface Props {
  umfrage: Umfrage;
  onStimme: (optionId: string) => void;
}

export const UmfrageKarte = ({ umfrage, onStimme }: Props) => {
  const hatGestimmt = umfrage.antworten.some((a) => a.gewaehlt);
  const zeigeZahlen = hatGestimmt || umfrage.beendet;

  return (
    <View style={styles.karte}>
      <Text style={styles.frage}>{umfrage.frage}</Text>

      {umfrage.antworten.map((a) => {
        const anteil = umfrage.gesamt ? Math.round((a.stimmen / umfrage.gesamt) * 100) : 0;
        return (
          <Druck
            key={a.id}
            style={[styles.antwort, a.gewaehlt && styles.antwortGewaehlt]}
            disabled={umfrage.beendet}
            onPress={() => onStimme(a.id)}
          >
            {/* Der Balken liegt hinter dem Text, nicht daneben — so bleibt
                die Antwort in voller Breite lesbar. */}
            {zeigeZahlen && <View style={[styles.balken, { width: `${anteil}%` }]} />}

            <Text style={[styles.antwortText, a.gewaehlt && styles.antwortTextGewaehlt]}>
              {a.text}
            </Text>

            {zeigeZahlen && <Text style={styles.anteil}>{anteil} %</Text>}
            {a.gewaehlt && <Ionicons name="checkmark" size={15} color={colors.brand} />}
          </Druck>
        );
      })}

      <Text style={styles.fuss}>
        {umfrage.gesamt} {umfrage.gesamt === 1 ? 'Stimme' : 'Stimmen'}
        {umfrage.beendet ? '  ·  beendet' : umfrage.mehrfach ? '  ·  Mehrfachauswahl' : ''}
        {!hatGestimmt && !umfrage.beendet ? '  ·  tippe zum Abstimmen' : ''}
      </Text>
    </View>
  );
};

const styles = themenStyles((colors) => ({
  karte: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    gap: 6,
  },
  frage: { ...typography.name, color: colors.text },
  antwort: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface3,
    overflow: 'hidden',
  },
  antwortGewaehlt: { backgroundColor: colors.brandSoft },
  balken: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.brandSoft,
  },
  antwortText: { flex: 1, ...typography.message, color: colors.text },
  antwortTextGewaehlt: { fontWeight: '600' },
  anteil: { ...typography.small, color: colors.text2, fontVariant: ['tabular-nums'] },
  fuss: { ...typography.tiny, color: colors.text3 },
}));
