import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SheetRahmen } from './SheetRahmen';
import { colors, radius, spacing, typography } from '../constants/design';

export interface FormularFeld {
  key: string;
  label: string;
  typ?: 'text' | 'mehrzeilig' | 'zahl';
  platzhalter?: string;
  pflicht?: boolean;
}

interface Props {
  visible: boolean;
  title: string;
  felder: FormularFeld[];
  knopf?: string;
  onClose: () => void;
  /** Gibt einen Fehlertext zurueck, dann bleibt das Blatt offen. */
  onSubmit: (werte: Record<string, string>) => string | null;
  onNotice: (message: string) => void;
}

/**
 * Ein Blatt mit Eingabefeldern - fuer Highlight, Playlist, Spendenaktion,
 * neuen Kanal und die Beschreibung zu einer Aufnahme.
 */
export const FormularSheet = ({ visible, title, felder, knopf = 'Fertig', onClose, onSubmit, onNotice }: Props) => {
  const [werte, setWerte] = useState<Record<string, string>>({});

  // Beim Oeffnen leeren, sonst steht die vorige Eingabe noch drin.
  useEffect(() => {
    if (visible) setWerte({});
  }, [visible, title]);

  const absenden = () => {
    const gefuellt: Record<string, string> = {};
    for (const f of felder) gefuellt[f.key] = (werte[f.key] ?? '').trim();

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
        <Pressable style={styles.knopf} onPress={absenden}>
          <Text style={styles.knopfText}>{knopf}</Text>
        </Pressable>
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
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SheetRahmen>
  );
};

const styles = StyleSheet.create({
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
  knopf: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knopfText: { ...typography.name, color: colors.white },
});
