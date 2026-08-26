import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Druck } from './Druck';
import { SheetRahmen } from './SheetRahmen';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';

export interface FormularFeld {
  key: string;
  label: string;
  typ?: 'text' | 'mehrzeilig' | 'zahl' | 'auswahl';
  platzhalter?: string;
  pflicht?: boolean;
  /**
   * Bei typ 'auswahl': die möglichen Werte. Musik tippt man nicht ab, man
   * sucht sie aus dem aus, was es gibt (Punkt 38).
   */
  auswahl?: string[];
}

interface Props {
  visible: boolean;
  title: string;
  felder: FormularFeld[];
  knopf?: string;
  /*
   * Was beim Oeffnen schon in den Feldern stehen soll. Beim Bearbeiten -
   * etwa des eigenen Profils - muss der jetzige Wert drinstehen: sonst
   * muesste man alles neu tippen, und ein leer gelassenes Feld wuerde den
   * bisherigen Wert loeschen.
   */
  vorbelegung?: Record<string, string>;
  onClose: () => void;
  /** Gibt einen Fehlertext zurueck, dann bleibt das Blatt offen. */
  onSubmit: (werte: Record<string, string>) => string | null;
  onNotice: (message: string) => void;
}

/**
 * Ein Blatt mit Eingabefeldern - fuer Highlight, Playlist, Spendenaktion,
 * neuen Kanal und die Beschreibung zu einer Aufnahme.
 */
export const FormularSheet = ({ visible, title, felder, knopf = 'Fertig', vorbelegung, onClose, onSubmit, onNotice }: Props) => {
  const [werte, setWerte] = useState<Record<string, string>>({});

  // Beim Oeffnen zuruecksetzen, sonst steht die vorige Eingabe noch drin -
  // auf die Vorbelegung, wo es eine gibt.
  useEffect(() => {
    if (visible) setWerte(vorbelegung ?? {});
    // vorbelegung bewusst nicht in der Liste: sie ist bei jedem Bildaufbau
    // ein neues Objekt und wuerde das Feld beim Tippen staendig zuruecksetzen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, title]);

  const absenden = () => {
    const gefuellt: Record<string, string> = {};
    for (const f of felder) {
      // Eine Auswahl steht schon auf dem ersten Wert, auch ohne Antippen —
      // sonst käme sie leer an, obwohl sichtbar etwas ausgewählt ist.
      const stand = werte[f.key] ?? (f.typ === 'auswahl' ? f.auswahl?.[0] ?? '' : '');
      gefuellt[f.key] = stand.trim();
    }

    const fehlt = felder.find((f) => f.pflicht && !gefuellt[f.key]);
    if (fehlt) return onNotice(`Bitte ${fehlt.label.toLowerCase()} ausfüllen`);

    const fehler = onSubmit(gefuellt);
    if (fehler) return onNotice(fehler);
    onClose();
  };

  return (
    <SheetRahmen
      visible={visible}
      title={title}
      onClose={onClose}
      fuss={
        <Druck style={styles.knopf} onPress={absenden}>
          <Text style={styles.knopfText}>{knopf}</Text>
        </Druck>
      }
    >
      {/*
        Das KeyboardAvoidingView muss die Felder umschliessen, sonst schiebt
        die Tastatur sie unter den Rand - derselbe Fehler wie frueher beim
        Kontakt-Blatt.
      */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.inhalt}>
          {felder.map((f, i) => (
            <View key={f.key} style={styles.feld}>
              <Text style={styles.label}>{f.label}</Text>
              {f.typ === 'auswahl' ? (
                // Waagerechte Reihe statt eines Aufklappmenüs: React Native
                // hat keins, und bei einer Handvoll Sounds sieht man so gleich
                // alles, was zur Wahl steht.
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wahlReihe}>
                  {(f.auswahl ?? []).map((w) => {
                    const an = (werte[f.key] ?? f.auswahl?.[0]) === w;
                    return (
                      <Druck
                        key={w}
                        style={[styles.wahl, an && styles.wahlAn]}
                        onPress={() => setWerte((prev) => ({ ...prev, [f.key]: w }))}
                      >
                        <Text style={[styles.wahlText, an && styles.wahlTextAn]}>{w}</Text>
                      </Druck>
                    );
                  })}
                </ScrollView>
              ) : (
              <TextInput
                style={[styles.eingabe, f.typ === 'mehrzeilig' && styles.mehrzeilig]}
                value={werte[f.key] ?? ''}
                onChangeText={(t) => setWerte((prev) => ({ ...prev, [f.key]: t }))}
                placeholder={f.platzhalter}
                placeholderTextColor={colors.text3}
                keyboardType={f.typ === 'zahl' ? 'number-pad' : 'default'}
                multiline={f.typ === 'mehrzeilig'}
                autoFocus={i === 0}
                returnKeyType={i === felder.length - 1 ? 'done' : 'next'}
                onSubmitEditing={i === felder.length - 1 ? absenden : undefined}
              />
              )}
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SheetRahmen>
  );
};

const styles = themenStyles((colors) => ({
  inhalt: { paddingVertical: spacing.sm },
  feld: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  label: { ...typography.small, color: colors.text2, marginBottom: 6 },
  eingabe: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    ...typography.body,
  },
  mehrzeilig: { minHeight: 76, textAlignVertical: 'top' },
  wahlReihe: { gap: spacing.sm, paddingRight: spacing.lg },
  wahl: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wahlAn: { backgroundColor: colors.brand, borderColor: colors.brand },
  wahlText: { ...typography.small, fontWeight: '600', color: colors.text2 },
  wahlTextAn: { color: colors.white },
  knopf: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knopfText: { ...typography.name, color: colors.white },
}));
