import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SheetRahmen } from './SheetRahmen';
import { EmptyState } from './EmptyState';
import { useProfil } from '../contexts/ProfilContext';
import { colors, spacing, typography } from '../constants/design';
import { MitteilungsBereich, MitteilungsZiel } from '../types';

interface Props {
  visible: boolean;
  bereich: MitteilungsBereich;
  onClose: () => void;
  /** Dorthin springen, wo die Mitteilung herkommt. */
  onOpen: (ziel: MitteilungsZiel) => void;
  onNotice: (message: string) => void;
}

/** Prototyp-Frames "VP + Mitteilung" und "CP + Mitteilungen". */
export const MitteilungenSheet = ({ visible, bereich, onClose, onOpen, onNotice }: Props) => {
  const { mitteilungen, alsGelesen, alleGelesen } = useProfil();
  const liste = mitteilungen(bereich);
  const offen = liste.some((m) => !m.gelesen);

  return (
    <SheetRahmen
      visible={visible}
      title="Mitteilungen"
      onClose={onClose}
      hoch
      fuss={
        offen ? (
          <Druck
            style={styles.alle}
            onPress={() => {
              alleGelesen(bereich);
              onClose();
              onNotice('Alle Mitteilungen gelesen');
            }}
          >
            <Text style={styles.alleText}>Alle als gelesen markieren</Text>
          </Druck>
        ) : undefined
      }
    >
      {liste.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="Keine Mitteilungen"
          text="Hier erscheint, was andere mit deinen Beiträgen machen."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.liste}>
          {liste.map((m) => (
            <Druck
              key={m.id}
              style={({ pressed }) => [styles.zeile, pressed && styles.zeileGedrueckt]}
              onPress={() => {
                alsGelesen(m.id);
                onClose();
                onOpen(m.ziel);
              }}
            >
              <View style={styles.symbol}>
                <Ionicons name="notifications-outline" size={22} color={colors.text2} />
                {!m.gelesen && <View style={styles.punkt} />}
              </View>
              <Text style={[styles.text, !m.gelesen && styles.textNeu]}>{m.text}</Text>
              <Text style={styles.zeit}>{m.zeit}</Text>
            </Druck>
          ))}
        </ScrollView>
      )}
    </SheetRahmen>
  );
};

const styles = StyleSheet.create({
  liste: { paddingBottom: spacing.md },
  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  zeileGedrueckt: { backgroundColor: colors.surface2 },
  symbol: { width: 24, alignItems: 'center' },
  punkt: {
    position: 'absolute',
    top: -1,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  text: { flex: 1, ...typography.message, color: colors.text, lineHeight: 19 },
  textNeu: { fontWeight: '600' },
  zeit: { ...typography.small, color: colors.text3 },
  alle: {
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alleText: { ...typography.name, color: colors.text },
});
