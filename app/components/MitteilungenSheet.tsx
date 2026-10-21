import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SheetRahmen } from './SheetRahmen';
import { EmptyState } from './EmptyState';
import { useProfil } from '../contexts/ProfilContext';
import { useAktionen } from '../lib/useAktionen';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';
import { MitteilungsBereich, MitteilungsZiel } from '../types';

interface Props {
  visible: boolean;
  bereich: MitteilungsBereich;
  onClose: () => void;
  /** Dorthin springen, wo die Mitteilung herkommt. */
  /** `text` braucht nur die Rechtsmitteilung: er sagt, ob Kontostatus oder Meine Meldungen. */
  onOpen: (ziel: MitteilungsZiel, text: string) => void;
  onNotice: (message: string) => void;
}

/** Prototyp-Frames "VP + Mitteilung" und "CP + Mitteilungen". */
export const MitteilungenSheet = ({ visible, bereich, onClose, onOpen, onNotice }: Props) => {
  const { mitteilungen, alsGelesen, alleGelesen, mitteilungWeg } = useProfil();
  const aktion = useAktionen();
  const liste = mitteilungen(bereich);
  const offen = liste.some((m) => !m.gelesen);
  // Welche Freundschaftsanfrage gerade unterwegs ist — kein doppeltes Antippen.
  const [laeuft, setLaeuft] = useState<string | null>(null);

  /*
   * Kasten 28/15.4 (Schema 98): eine Freundschaftsanfrage wird dort
   * entschieden, wo sie ankommt — wie bei Instagram. Der Auslöser löscht die
   * Mitteilung danach in der Datenbank; hier verschwindet sie sofort. Gleich
   * auf der Website (renderMitteilungen, data-freund).
   */
  const entscheiden = async (id: string, userId: string, annehmen: boolean) => {
    setLaeuft(id);
    const fehler = annehmen
      ? (await aktion.freundschaftSchritt(userId, 'eingegangen')).fehler
      : await aktion.freundschaftAblehnen(userId);
    setLaeuft(null);
    if (fehler) return onNotice(fehler);
    mitteilungWeg(id);
    onNotice(annehmen ? 'Ihr seid jetzt befreundet' : 'Freundschaftsanfrage abgelehnt');
  };

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
                onOpen(m.ziel, m.text);
              }}
            >
              <View style={styles.symbol}>
                <Ionicons name="notifications-outline" size={22} color={colors.text2} />
                {!m.gelesen && <View style={styles.punkt} />}
              </View>
              <View style={styles.mitte}>
                <Text style={[styles.text, !m.gelesen && styles.textNeu]}>{m.text}</Text>
                {m.art === 'freund_anfrage' && (
                  <View style={styles.knoepfe}>
                    <Druck
                      style={[styles.knopf, styles.knopfJa]}
                      disabled={laeuft === m.id}
                      onPress={() => void entscheiden(m.id, m.userId, true)}
                      accessibilityLabel="Freundschaftsanfrage annehmen"
                    >
                      <Text style={[styles.knopfText, styles.knopfTextJa]}>Annehmen</Text>
                    </Druck>
                    <Druck
                      style={styles.knopf}
                      disabled={laeuft === m.id}
                      onPress={() => void entscheiden(m.id, m.userId, false)}
                      accessibilityLabel="Freundschaftsanfrage ablehnen"
                    >
                      <Text style={styles.knopfText}>Ablehnen</Text>
                    </Druck>
                  </View>
                )}
              </View>
              <Text style={styles.zeit}>{m.zeit}</Text>
            </Druck>
          ))}
        </ScrollView>
      )}
    </SheetRahmen>
  );
};

const styles = themenStyles((colors) => ({
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
  mitte: { flex: 1 },
  text: { ...typography.message, color: colors.text, lineHeight: 19 },
  knoepfe: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  knopf: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  knopfJa: { backgroundColor: colors.brand, borderColor: colors.brand },
  knopfText: { ...typography.small, fontWeight: '600', color: colors.text2 },
  knopfTextJa: { color: colors.white },
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
}));
