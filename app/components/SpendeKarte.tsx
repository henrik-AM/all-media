import React, { useCallback, useContext, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import { SheetRahmen } from './SheetRahmen';
import { ActionSheet } from './ActionSheet';
import { FormularSheet } from './FormularSheet';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';
import { useSupabase } from '../contexts/SupabaseContext';
import { AuthContext } from '../contexts/AuthContext';
import { useAktionen } from '../lib/useAktionen';
import * as Aktion from '../lib/aktionen';

// Formular, Stand und Frist — einmal für App und Website (gemeinsam/spende.js).
const Spende = require('../../gemeinsam/spende') as typeof import('../../gemeinsam/spende');

interface Props {
  /** `profiles.spende`, wie es geladen wurde (Objekt oder JSON-Text). */
  spende: unknown;
  /** Echte Kennung des Empfängers — nicht 'me'. */
  empfaengerId: string;
  /** Name des Empfängers, für die Überschrift beim Spenden. */
  name: string;
  onNotice: (text: string) => void;
}

/**
 * Das Spendenziel im Profil — Karte plus Detailblatt (Kasten 12.3).
 *
 * Henrik am 21.09.2026: „Spendenziel lässt sich antippen, zeigt aber keine
 * genaueren Daten." Die Karte war eine View ohne Druck; der Betrag darauf
 * war `gesammelt`, das nie jemand hochzählte.
 *
 * Jetzt: Antippen öffnet das Blatt mit Titel, Beschreibung, Ziel und
 * erreichtem Betrag, Fortschritt, Zahl der Spender und Frist. Der Knopf
 * „Spenden" nimmt denselben Weg wie unter einem Querformat-Video
 * (feste Stufen oder eigener Betrag → aktionen.spenden). Im eigenen Profil
 * ist er gesperrt — an sich selbst geht keine Spende, das sagt die
 * Datenbank ebenso.
 *
 * Zahlungsmethode und Spenden-Code gehören zu Kasten 13.
 *
 * Gegenstück auf der Website: spendeKarte() / openSpendenziel() in
 * web/public/app.js.
 */
export const SpendeKarte = ({ spende, empfaengerId, name, onNotice }: Props) => {
  const { supabase } = useSupabase();
  const { user } = useContext(AuthContext);
  const aktionen = useAktionen(onNotice);
  const eigen = Boolean(user?.id) && user?.id === empfaengerId;

  const [buchung, setBuchung] = useState<{ summe_cent: number; spender: number } | null>(null);
  const [offen, setOffen] = useState(false);
  const [stufen, setStufen] = useState(false);
  const [eigenerBetrag, setEigenerBetrag] = useState(false);

  const gespeichert = Spende.lesen(spende);

  const laden = useCallback(() => {
    if (!supabase || !user?.id || !empfaengerId || !gespeichert) return;
    Aktion.spendenstand(supabase, user.id, empfaengerId, gespeichert.seit)
      .then(setBuchung)
      .catch(() => setBuchung(null));
  }, [supabase, user?.id, empfaengerId, gespeichert?.seit, gespeichert?.titel]);

  useEffect(() => {
    laden();
  }, [laden]);

  const stand = Spende.stand(spende, buchung);
  if (!stand) return null;

  const gespendet = async (cent: number) => {
    const ok = await aktionen.spenden(empfaengerId, cent, null);
    if (ok) {
      onNotice(`${Spende.euro(cent / 100)} an ${name} gespendet`);
      laden();
    }
  };

  const balken = stand.prozent !== null && (
    <View style={styles.balken}>
      <View style={[styles.fuellung, { width: `${stand.prozent}%` }]} />
    </View>
  );

  return (
    <>
      <Druck
        style={styles.karte}
        onPress={() => {
          laden();
          setOffen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Spendenziel ${stand.titel}, Einzelheiten`}
        testID="spende-karte"
      >
        <Text style={styles.titel}>{stand.titel}</Text>
        {!!stand.text && (
          <Text style={styles.text} numberOfLines={2}>
            {stand.text}
          </Text>
        )}
        {balken}
        <Text style={styles.zahlen}>{stand.zahlenText}</Text>
      </Druck>

      <SheetRahmen visible={offen} title="Spendenziel" onClose={() => setOffen(false)}>
        <View style={styles.blatt} testID="spende-details">
          <Text style={styles.blattTitel}>{stand.titel}</Text>
          {!!stand.text && <Text style={styles.blattText}>{stand.text}</Text>}

          <View style={styles.zeilen}>
            <Zeile label="Erreicht" wert={Spende.euro(stand.erreicht)} />
            <Zeile label="Ziel" wert={stand.ziel > 0 ? Spende.euro(stand.ziel) : 'ohne festes Ziel'} />
            {stand.prozent !== null && <Zeile label="Fortschritt" wert={`${stand.prozent} %`} />}
            <Zeile
              label="Spender"
              wert={stand.spender === null ? (eigen ? '–' : 'nur für dich sichtbar') : String(stand.spender)}
            />
            <Zeile label="Frist" wert={stand.fristText ?? 'keine'} />
          </View>
          {balken}
          <Text style={styles.zahlen}>{stand.spender === null ? stand.zahlenText : `${stand.zahlenText} · ${stand.spenderText}`}</Text>

          <Druck
            style={[styles.knopf, (eigen || stand.abgelaufen) && styles.knopfAus]}
            disabled={eigen || stand.abgelaufen}
            onPress={() => {
              setOffen(false);
              setStufen(true);
            }}
            testID="spende-knopf"
          >
            <Text style={styles.knopfText}>Spenden</Text>
          </Druck>
          {eigen ? (
            <Text style={styles.hinweis}>An dich selbst geht keine Spende — so sehen andere dein Ziel.</Text>
          ) : stand.abgelaufen ? (
            <Text style={styles.hinweis}>Die Frist ist vorbei.</Text>
          ) : null}
        </View>
      </SheetRahmen>

      <ActionSheet
        visible={stufen}
        title={`An ${name} spenden`}
        items={[
          { key: '100', label: '1,00 €', icon: 'heart-outline' },
          { key: '300', label: '3,00 €', icon: 'heart-outline' },
          { key: '500', label: '5,00 €', icon: 'heart' },
          { key: '1000', label: '10,00 €', icon: 'heart' },
          { key: 'eigen', label: 'Eigener Betrag …', icon: 'create-outline' },
        ]}
        onSelect={(key) => {
          setStufen(false);
          if (key === 'eigen') return setEigenerBetrag(true);
          void gespendet(Number(key));
        }}
        onClose={() => setStufen(false)}
      />

      <FormularSheet
        visible={eigenerBetrag}
        title={`An ${name} spenden`}
        felder={[{ key: 'betrag', label: 'Betrag in Euro', typ: 'zahl', platzhalter: 'z. B. 2,50', pflicht: true }]}
        knopf="Spenden"
        onClose={() => setEigenerBetrag(false)}
        onSubmit={(werte) => {
          const cent = Spende.centAus(werte.betrag);
          if (cent === null) return 'Bitte einen Betrag zwischen 0,50 € und 1.000 € eingeben';
          setEigenerBetrag(false);
          void gespendet(cent);
          return null;
        }}
        onNotice={onNotice}
      />
    </>
  );
};

const Zeile = ({ label, wert }: { label: string; wert: string }) => (
  <View style={styles.zeile}>
    <Text style={styles.zeileLabel}>{label}</Text>
    <Text style={styles.zeileWert}>{wert}</Text>
  </View>
);

const styles = themenStyles((colors) => ({
  karte: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
  },
  titel: { ...typography.name, color: colors.text },
  text: { ...typography.preview, color: colors.text2, marginTop: 3 },
  balken: {
    marginTop: 9,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surface3,
    overflow: 'hidden',
  },
  fuellung: { height: '100%', backgroundColor: colors.brand },
  zahlen: { ...typography.small, color: colors.text3, marginTop: 6 },

  blatt: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  blattTitel: { ...typography.h2, color: colors.text },
  blattText: { ...typography.message, color: colors.text2, marginTop: 4 },
  zeilen: { marginTop: spacing.md, gap: 6 },
  zeile: { flexDirection: 'row', justifyContent: 'space-between' },
  zeileLabel: { ...typography.message, color: colors.text2 },
  zeileWert: { ...typography.message, color: colors.text, fontWeight: '600' },
  knopf: {
    marginTop: spacing.lg,
    paddingVertical: 12,
    borderRadius: 11,
    backgroundColor: colors.brand,
    alignItems: 'center',
  },
  knopfAus: { opacity: 0.4 },
  knopfText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  hinweis: { ...typography.small, color: colors.text3, marginTop: 6, textAlign: 'center' },
}));
