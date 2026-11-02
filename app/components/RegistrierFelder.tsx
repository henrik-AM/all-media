import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSupabase } from '../contexts/SupabaseContext';
import { Druck } from './Druck';
import { RechtstextSheet } from './RechtstextSheet';
import { Alter, NeuesKonto, Telefon, datumTippen, namensZeile, useNamensStand } from '../lib/registrierung';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';

interface Props {
  konto: NeuesKonto;
  aendern: (teil: Partial<NeuesKonto>) => void;
  /** 'anmeldung': Felder mit Symbol wie im Anmeldebildschirm. 'blatt': mit Beschriftung wie im Kontowechsel. */
  variante: 'anmeldung' | 'blatt';
  gesperrt?: boolean;
  /** Im Anmeldebildschirm steht die Nummer schon oben, wenn man über „Telefon" kam. */
  ohneTelefon?: boolean;
}

/**
 * Die Felder, die jedes neue Konto braucht — an beiden Stellen, an denen die
 * App eines anlegt. Die Regeln dahinter stehen in lib/registrierung.ts.
 */
export const RegistrierFelder = ({ konto, aendern, variante, gesperrt, ohneTelefon }: Props) => {
  const { supabase } = useSupabase();
  const name = namensZeile(useNamensStand(supabase, konto.handle));
  const [lesen, setLesen] = useState<string | null>(null);

  const datumFehlt = Alter.pruefe(konto.geburtsdatum);
  const einordnung = datumFehlt ? null : Alter.einordnen(konto.geburtsdatum, konto.telefon);
  const hinweis = einordnung ? Alter.hinweis(einordnung) : '';

  const feld = (
    symbol: keyof typeof Ionicons.glyphMap,
    beschriftung: string,
    eingabe: React.ReactElement,
    zeile?: { text: string; gut: boolean }
  ) => (
    <View style={variante === 'blatt' ? styles.blattFeld : undefined}>
      {variante === 'blatt' && <Text style={styles.label}>{beschriftung}</Text>}
      {variante === 'anmeldung' ? (
        <View style={styles.anmeldeFeld}>
          <Ionicons name={symbol} size={19} color={colors.text3} />
          {eingabe}
        </View>
      ) : (
        eingabe
      )}
      {zeile?.text ? (
        <Text style={[styles.zeile, { color: zeile.gut ? colors.text3 : colors.danger }]}>{zeile.text}</Text>
      ) : null}
    </View>
  );

  const eingabeStil = variante === 'anmeldung' ? styles.anmeldeText : styles.blattText;

  return (
    <>
      {feld(
        'at-outline',
        'Benutzername',
        <TextInput
          style={eingabeStil}
          value={konto.handle}
          onChangeText={(handle) => aendern({ handle })}
          placeholder={variante === 'anmeldung' ? 'Benutzername' : '@wunschname'}
          placeholderTextColor={colors.text3}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!gesperrt}
          accessibilityLabel="Benutzername"
        />,
        name
      )}

      {!ohneTelefon &&
        feld(
          'call-outline',
          'Telefonnummer',
          <TextInput
            style={eingabeStil}
            value={konto.telefon}
            onChangeText={(telefon) => aendern({ telefon })}
            placeholder={variante === 'anmeldung' ? 'Telefonnummer' : Telefon.REGEL_TEXT.replace('Zum Beispiel ', '')}
            placeholderTextColor={colors.text3}
            keyboardType="phone-pad"
            editable={!gesperrt}
            accessibilityLabel="Telefonnummer"
          />
        )}

      {feld(
        'calendar-outline',
        'Geburtsdatum',
        <TextInput
          style={eingabeStil}
          value={konto.geburtsdatum}
          onChangeText={(t) => aendern({ geburtsdatum: datumTippen(t) })}
          placeholder={variante === 'anmeldung' ? 'Geburtsdatum (TT.MM.JJJJ)' : 'TT.MM.JJJJ'}
          placeholderTextColor={colors.text3}
          keyboardType="number-pad"
          maxLength={10}
          editable={!gesperrt}
          accessibilityLabel="Geburtsdatum"
        />,
        // Den Fehler erst zeigen, wenn das Datum vollständig getippt ist.
        konto.geburtsdatum.length === 10 && datumFehlt
          ? { text: datumFehlt, gut: false }
          : hinweis
          ? { text: hinweis, gut: einordnung?.stufe !== 'verboten' }
          : undefined
      )}

      {einordnung?.stufe === 'eltern' &&
        feld(
          'people-outline',
          'Telefonnummer deines Elternteils',
          // Nie über den @-Namen (Henrik 26.09.2026, Schema 58): Eltern und
          // Kinder haben ohnehin die Nummer des anderen.
          <TextInput
            style={eingabeStil}
            value={konto.eltern || ''}
            onChangeText={(eltern) => aendern({ eltern })}
            placeholder={variante === 'anmeldung' ? 'Telefonnummer deines Elternteils' : '0151 2345678'}
            placeholderTextColor={colors.text3}
            keyboardType="phone-pad"
            autoCorrect={false}
            editable={!gesperrt}
            accessibilityLabel="Telefonnummer deines Elternteils"
          />,
          { text: 'Bis dein Elternteil zustimmt, bleibt dein Konto gesperrt.', gut: true }
        )}

      {/*
        Kasten RS 1 (24.10.2026): Zustimmung zu Nutzungsbedingungen und
        Community-Richtlinien — nie vorbelegt. Ohne Häkchen lehnt
        neuesKontoPruefen ab; mit geht Dokument und Fassung in die
        signUp-Metadaten (Rechtstexte.zustimmungsDaten). Gleich auf der
        Website (registrieren in web/public/anmeldung.js).
      */}
      <View style={[styles.zustimmung, variante === 'blatt' && styles.zustimmungBlatt]}>
        <Druck
          onPress={() => !gesperrt && aendern({ zustimmung: !konto.zustimmung })}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!konto.zustimmung, disabled: gesperrt }}
          accessibilityLabel="Nutzungsbedingungen und Community-Richtlinien zustimmen"
          hitSlop={8}
          testID="zustimmung"
        >
          <Ionicons
            name={konto.zustimmung ? 'checkbox' : 'square-outline'}
            size={22}
            color={konto.zustimmung ? colors.brand : colors.text3}
          />
        </Druck>
        <Text style={styles.zustimmungText}>
          Ich stimme den{' '}
          <Text style={styles.link} onPress={() => setLesen('nutzungsbedingungen')} accessibilityRole="link">Nutzungsbedingungen</Text>
          {' '}und{' '}
          <Text style={styles.link} onPress={() => setLesen('community_richtlinien')} accessibilityRole="link">Community-Richtlinien</Text>
          {' '}zu. Wie wir deine Daten verarbeiten, steht in der{' '}
          <Text style={styles.link} onPress={() => setLesen('datenschutz')} accessibilityRole="link">Datenschutzerklärung</Text>.
        </Text>
      </View>
      {lesen && <RechtstextSheet id={lesen} onClose={() => setLesen(null)} />}
    </>
  );
};

const styles = themenStyles((colors) => ({
  anmeldeFeld: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.soft,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  anmeldeText: { flex: 1, color: colors.text, ...typography.body },

  blattFeld: { paddingTop: spacing.md, paddingHorizontal: spacing.lg },
  label: { color: colors.text2, marginBottom: 6, ...typography.small },
  blattText: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface3,
    color: colors.text,
    ...typography.body,
  },

  zeile: { marginTop: 6, ...typography.small },

  zustimmung: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingTop: spacing.sm },
  zustimmungBlatt: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  zustimmungText: { flex: 1, color: colors.text2, ...typography.small, lineHeight: 20 },
  link: { color: colors.brand, fontWeight: '600' },
}));
