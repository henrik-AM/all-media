import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Druck } from './Druck';
import { LinearGradient } from 'expo-linear-gradient';
import { markenVerlauf, radius, spacing, themenStyles } from '../constants/design';

export interface FilterPille<K extends string> {
  key: K;
  label: string;
}

interface Props<K extends string> {
  pillen: FilterPille<K>[];
  aktiv: K;
  onChange: (key: K) => void;
}

/**
 * Eine Reihe Filter-Pillen — „Alle | Kontakte | Gruppen", „Alle | Standard |
 * 360° | Live" und so weiter.
 *
 * Warum als eigene Komponente: dasselbe Muster stand in der Chatliste, in den
 * Community-Chats und im Querformat jeweils neu geschrieben. Beim Querformat
 * fehlte die Leiste in der App ganz, obwohl die Website sie hatte — genau die
 * Art Auseinanderdriften, die Henrik am 26.08.2026 gemeldet hat.
 *
 * Die Reihe liegt in einem waagerechten Scrollfeld. Fuenf Pillen passen auf
 * einem schmalen Geraet nicht nebeneinander; ohne Scrollfeld wurde die letzte
 * abgeschnitten.
 */
export function FilterPillen<K extends string>({ pillen, aktiv, onChange }: Props<K>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      /* flexGrow: 0 — ohne das nimmt sich das Scrollfeld in einer Spalte den
         gesamten Rest der Hoehe und schiebt die Liste darunter aus dem Bild. */
      style={styles.feld}
      contentContainerStyle={styles.reihe}
      keyboardShouldPersistTaps="handled"
    >
      {pillen.map(({ key, label }) => {
        const on = key === aktiv;
        return (
          <Druck key={key} accessibilityLabel={label} onPress={() => onChange(key)}>
            {on ? (
              <LinearGradient
                colors={markenVerlauf()}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.pille}
              >
                <Text style={[styles.text, styles.textAktiv]}>{label}</Text>
              </LinearGradient>
            ) : (
              /* Nicht gewaehlte Filter sind nur eine Linie, keine graue
                 Flaeche. Mehrere graue Kacheln nebeneinander erzeugen Unruhe
                 direkt unter dem Suchfeld. */
              <View style={[styles.pille, styles.pilleAus]}>
                <Text style={styles.text}>{label}</Text>
              </View>
            )}
          </Druck>
        );
      })}
    </ScrollView>
  );
}

const styles = themenStyles((colors) => ({
  feld: { flexGrow: 0, flexShrink: 0 },
  reihe: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: 8 },
  pille: {
    height: 33,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pilleAus: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  text: { color: colors.text2, fontSize: 13.5, fontWeight: '600', letterSpacing: -0.1 },
  textAktiv: { color: colors.white },
}));
