/*
 * Die Sperrseite der eigenen Bildschirmzeit (Kasten 22).
 *
 * Sie steht statt GENAU des Bereichs, dessen Limit erreicht ist — die
 * Leisten oben und unten bleiben, alle anderen Bereiche sind erreichbar.
 * Bei einer Vollbildansicht (Chat, Story, Player …) ersetzt sie diese und
 * bietet „Schließen".
 *
 * Wie bei iOS und TikTok: „15 Min. mehr" (einmal am Tag, Datenbank zählt
 * mit) und „Mit Entsperrcode freigeben" (15 Min., 1 Std., für heute). Steht
 * das Konto unter Elternkontrolle, gilt der Code des Elternteils.
 *
 * Gleiche Seite auf der Website: bzSperreHtml() in web/public/app.js.
 */
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Druck } from './Druck';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';
import { useBildschirmzeit } from '../contexts/BildschirmzeitContext';
import { Bildschirmzeit, BzBereich, BzZiel, bzMeldung } from '../lib/bildschirmzeit';

interface Props {
  bereich: BzBereich;
  /** Bei einer Vollbildansicht: sie schließen. */
  onSchliessen?: () => void;
  /** Vollbild: eigenen Abstand oben halten (keine Insel darüber). */
  vollbild?: boolean;
  onNotice: (text: string) => void;
}

const CODE_WAHL: { minuten: number | null; text: string }[] = [
  { minuten: 15, text: '15 Min.' },
  { minuten: 60, text: '1 Std.' },
  { minuten: null, text: 'Für heute' },
];

export const BildschirmzeitSperre = ({ bereich, onSchliessen, vollbild, onNotice }: Props) => {
  const insets = useSafeAreaInsets();
  const { status, stand, mehr, entsperren, nutzungJetzt } = useBildschirmzeit();
  const [codeOffen, setCodeOffen] = useState(false);
  const [code, setCode] = useState('');
  const [minuten, setMinuten] = useState<number | null>(15);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const text = Bildschirmzeit.sperrText(status, bereich, stand?.eltern?.name ?? null);
  const ziel = (status.ziel ?? bereich) as BzZiel;
  const heute = nutzungJetzt()[bereich] ?? 0;

  const mehrNehmen = async () => {
    setLaeuft(true);
    const a = await mehr(ziel);
    setLaeuft(false);
    if (!a.ok) return setMeldung(bzMeldung(a));
    onNotice('15 Minuten mehr — danach ist wieder Schluss');
  };

  const freigeben = async () => {
    if (!/^\d{4,8}$/.test(code)) return setMeldung('Der Code hat 4 bis 8 Ziffern');
    setLaeuft(true);
    const a = await entsperren(ziel, code, minuten);
    setLaeuft(false);
    setCode('');
    if (!a.ok) return setMeldung(bzMeldung(a));
    onNotice(minuten == null ? 'Für heute freigegeben' : `Für ${minuten === 60 ? '1 Std.' : `${minuten} Min.`} freigegeben`);
  };

  return (
    <ScrollView
      style={styles.flaeche}
      contentContainerStyle={[styles.inhalt, vollbild && { paddingTop: insets.top + spacing.xl }]}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel="Bildschirmzeit-Sperre"
    >
      <View style={styles.symbol}>
        <Ionicons name={status.grund === 'auszeit' ? 'moon-outline' : 'hourglass-outline'} size={40} color={colors.brand} />
      </View>
      <Text style={styles.titel}>{text.titel}</Text>
      <Text style={styles.satz}>{text.satz}</Text>
      <Text style={styles.zahl}>
        Heute in {Bildschirmzeit.bereichName(bereich)}: {Bildschirmzeit.dauerText(heute)}
      </Text>

      {status.mehrMoeglich && (
        <Druck style={styles.knopf} onPress={mehrNehmen} disabled={laeuft}>
          <Text style={styles.knopfText}>{Bildschirmzeit.MEHR_MINUTEN} Min. mehr</Text>
        </Druck>
      )}

      {!codeOffen ? (
        <Druck style={styles.knopfZweit} onPress={() => setCodeOffen(true)}>
          <Text style={styles.knopfZweitText}>Mit Entsperrcode freigeben</Text>
        </Druck>
      ) : (
        <View style={styles.codeBox}>
          <Text style={styles.hinweis}>{text.code}</Text>
          <TextInput
            value={code}
            onChangeText={(t) => {
              setCode(t.replace(/\D/g, '').slice(0, 8));
              setMeldung(null);
            }}
            placeholder="Entsperrcode"
            placeholderTextColor={colors.text3}
            keyboardType="number-pad"
            secureTextEntry
            style={styles.eingabe}
            accessibilityLabel="Entsperrcode"
          />
          <View style={styles.reihe}>
            {CODE_WAHL.map((w) => (
              <Druck
                key={w.text}
                style={[styles.chip, minuten === w.minuten && styles.chipAn]}
                onPress={() => setMinuten(w.minuten)}
              >
                <Text style={[styles.chipText, minuten === w.minuten && styles.chipTextAn]}>{w.text}</Text>
              </Druck>
            ))}
          </View>
          <Druck style={styles.knopf} onPress={freigeben} disabled={laeuft}>
            <Text style={styles.knopfText}>Freigeben</Text>
          </Druck>
        </View>
      )}

      {!!meldung && <Text style={styles.meldung}>{meldung}</Text>}

      {onSchliessen && (
        <Druck style={styles.knopfZweit} onPress={onSchliessen}>
          <Text style={styles.knopfZweitText}>Schließen</Text>
        </Druck>
      )}
    </ScrollView>
  );
};

const styles = themenStyles((colors) => ({
  flaeche: { flex: 1, backgroundColor: colors.surface },
  inhalt: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  symbol: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  titel: { ...typography.h3, fontSize: 20, color: colors.text, textAlign: 'center' },
  satz: { ...typography.body, color: colors.text2, textAlign: 'center' },
  zahl: { ...typography.small, color: colors.text3 },
  knopf: { alignSelf: 'stretch', backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  knopfText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  knopfZweit: { alignSelf: 'stretch', backgroundColor: colors.brandSoft, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  knopfZweitText: { color: colors.brand, fontWeight: '600', fontSize: 15 },
  codeBox: { alignSelf: 'stretch', gap: spacing.sm },
  hinweis: { ...typography.small, color: colors.text2, textAlign: 'center' },
  eingabe: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center',
    color: colors.text,
  },
  reihe: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  chipAn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { ...typography.small, color: colors.text2, fontWeight: '600' },
  chipTextAn: { color: '#fff' },
  meldung: { ...typography.small, color: colors.danger, textAlign: 'center' },
}));
