/*
 * Die Rechtstexte (Kasten RS 1, 24.10.2026): Nutzungsbedingungen,
 * Community-Richtlinien, Datenschutzerklärung, Elterninfo, Impressum.
 *
 * Der Text steht nur in gemeinsam/rechtstexte.js — die Website zeigt
 * dasselbe (openRechtstext in web/public/app.js, ohne Anmeldung unter
 * /recht/<id>). Hier wird nichts umformuliert.
 *
 * Erreichbar ohne Anmeldung (Anmeldebildschirm, Registrierung) und in den
 * Einstellungen. Ohne `id` zeigt das Blatt die Liste aller Dokumente.
 */
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Druck } from './Druck';
import { SheetRahmen } from './SheetRahmen';
import { colors, spacing, themenStyles, typography } from '../constants/design';

const Rechtstexte = require('../../gemeinsam/rechtstexte') as typeof import('../../gemeinsam/rechtstexte');

interface Props {
  /** Ein Dokument direkt öffnen; ohne: Liste aller Dokumente. */
  id?: string | null;
  onClose: () => void;
}

export const RechtstextSheet = ({ id, onClose }: Props) => {
  const [offen, setOffen] = useState<string | null>(id ?? null);
  const dok = offen ? Rechtstexte.dokument(offen) : null;

  // Aus der Liste geöffnet: Zurück führt zur Liste, nicht aus dem Blatt.
  const zurueck = () => (offen && !id ? setOffen(null) : onClose());

  return (
    <SheetRahmen visible hoch title={dok ? dok.titel : 'Rechtliches'} onClose={zurueck}>
      <ScrollView contentContainerStyle={styles.inhalt} testID={`rechtstext-${offen ?? 'liste'}`}>
        {dok ? (
          <>
            {dok.abschnitte.map((a) => (
              <View key={a.titel} style={styles.abschnitt}>
                <Text style={styles.kopf} accessibilityRole="header">{a.titel}</Text>
                {a.text.map((t, i) => (
                  <Text key={i} style={styles.text} selectable>{t}</Text>
                ))}
              </View>
            ))}
            <Text style={styles.stand}>Stand {Rechtstexte.STAND} · Fassung {dok.version}</Text>
          </>
        ) : (
          Rechtstexte.liste().map((d) => (
            <Druck
              key={d.id}
              style={styles.zeile}
              onPress={() => setOffen(d.id)}
              accessibilityRole="button"
              accessibilityLabel={d.titel}
            >
              <Text style={styles.zeileText}>{d.titel}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text3} />
            </Druck>
          ))
        )}
      </ScrollView>
    </SheetRahmen>
  );
};

const styles = themenStyles((colors) => ({
  inhalt: { paddingBottom: spacing.xxl },
  abschnitt: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.sm },
  kopf: { ...typography.body, fontWeight: '600', color: colors.text },
  text: { ...typography.small, color: colors.text2, lineHeight: 20 },
  stand: { ...typography.small, fontSize: 12, color: colors.text3, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    height: 54,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  zeileText: { flex: 1, ...typography.body, color: colors.text },
}));
