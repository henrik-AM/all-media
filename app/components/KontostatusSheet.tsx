/**
 * „Meine Meldungen" und „Kontostatus" (Einstellungen → Hilfe).
 *
 * WARUM ES DAS GIBT
 *
 * Kasten RS 3 (Schema 102). Der Digital Services Act verlangt, dass der
 * Meldende die Entscheidung erfährt (Art. 16 Abs. 5), dass der Betroffene eine
 * Begründung bekommt (Art. 17) und dass beide sechs Monate lang kostenlos
 * widersprechen können (Art. 20). Die Mitteilungen kommen in die Glocke;
 * hier steht der Stand zum Nachlesen — und der Knopf „Widersprechen".
 *
 *   ansicht 'meine'        meine_meldungen(): was ich gemeldet habe, Stand,
 *                          Entscheidung, Begründung — Widerspruch, solange
 *                          die Frist läuft
 *   ansicht 'kontostatus'  mich_betreffende_entscheidungen(): was gegen
 *                          meine Inhalte/mein Konto entschieden wurde
 *
 * Nur echte Daten. Leer → Leertext. Fehlt Schema 102 → ehrlicher Hinweis
 * statt einer leeren Liste, die „nichts gemeldet" vortäuschen würde.
 *
 * Gegenstück auf der Website: openMeineMeldungen / openKontostatus in
 * web/public/app.js.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Druck } from './Druck';
import { SheetRahmen } from './SheetRahmen';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';
import { useSupabase } from '../contexts/SupabaseContext';
import * as Aktion from '../lib/aktionen';

const Meldung = require('../../gemeinsam/meldung') as typeof import('../../gemeinsam/meldung');

export type KontostatusAnsicht = 'meine' | 'kontostatus';

interface Props {
  ansicht: KontostatusAnsicht;
  onClose: () => void;
}

/** Eine Zeile, gleich für beide Listen. */
interface Zeile {
  id: string;
  kopf: string;
  stand: string;
  datum: string;
  massnahme?: string;
  begruendung?: string | null;
  grundlage?: string;
  /** Widerspruch möglich bis — nur bei entschiedenen. */
  bis?: string | null;
  beschwerde?: string | null;
}

export const KontostatusSheet = ({ ansicht, onClose }: Props) => {
  const { supabase } = useSupabase();
  const [zeilen, setZeilen] = useState<Zeile[] | null>(null);
  const [fehlt, setFehlt] = useState(false);
  const [fehler, setFehler] = useState('');
  const [widerspruch, setWiderspruch] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [meldung, setMeldung] = useState('');
  const [sendet, setSendet] = useState(false);
  // Doppeltipp-Sperre (Gate 2, Fund 23): die Ref gilt sofort, der Zustand erst nach dem Zeichnen.
  const laeuft = useRef(false);

  const laden = useCallback(async () => {
    if (!supabase) {
      setFehler(Meldung.grundText('nicht_angemeldet'));
      return;
    }
    setFehler('');
    try {
      if (ansicht === 'meine') {
        const r = await Aktion.meineMeldungen(supabase);
        if (r.fehlt) return setFehlt(true);
        setZeilen(
          r.zeilen.map((m) => ({
            id: m.id,
            kopf: `${Meldung.ART_NAME[m.art as keyof typeof Meldung.ART_NAME] ?? 'Inhalt'} · ${Meldung.kategorieName(m.kategorie)}`,
            stand: Meldung.statusText(m.status),
            datum: Meldung.datum(m.erstellt),
            massnahme: m.massnahme ? Meldung.massnahmeText(m.massnahme) : undefined,
            begruendung: m.begruendung,
            // Meldende können ebenfalls widersprechen (rolle 'meldend', Schema 102).
            bis: m.widerspruch_bis,
            beschwerde: m.beschwerde_status,
          }))
        );
      } else {
        const r = await Aktion.michBetreffendeEntscheidungen(supabase);
        if (r.fehlt) return setFehlt(true);
        setZeilen(
          r.zeilen.map((e) => ({
            id: e.id,
            kopf: `${Meldung.ART_NAME[e.art as keyof typeof Meldung.ART_NAME] ?? 'Inhalt'} · ${Meldung.kategorieName(e.kategorie)}`,
            stand: Meldung.massnahmeText(e.massnahme, e.sperre_bis),
            datum: Meldung.datum(e.entschieden),
            begruendung: e.begruendung,
            grundlage: Meldung.grundlageText(e.grundlage),
            bis: e.widerspruch_bis,
            beschwerde: e.beschwerde_status,
          }))
        );
      }
    } catch (e: any) {
      setFehler(e?.message ? `Laden hat nicht geklappt: ${e.message}` : Meldung.grundText('netz'));
    }
  }, [supabase, ansicht]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const widersprechen = async (id: string) => {
    if (!supabase || laeuft.current) return;
    laeuft.current = true;
    setSendet(true);
    setMeldung('');
    try {
      const r = await Aktion.entscheidungWidersprechen(supabase, id, text);
      if (!r.ok) {
        setMeldung(r.grund === 'update' ? Meldung.grundText('update') : Meldung.grundText(r.grund));
        return;
      }
      setWiderspruch(null);
      setText('');
      setMeldung(Meldung.WIDERSPRUCH.gesendet);
      await laden();
    } catch (e: any) {
      setMeldung(e?.message ? `Das hat nicht geklappt: ${e.message}` : Meldung.grundText('netz'));
    } finally {
      laeuft.current = false;
      setSendet(false);
    }
  };

  const titel = ansicht === 'meine' ? 'Meine Meldungen' : 'Kontostatus';

  return (
    <SheetRahmen visible title={titel} onClose={onClose} hoch>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.inhalt}>
        {!!meldung && (
          <Text style={styles.meldung} accessibilityLiveRegion="polite" testID="kontostatus-meldung">
            {meldung}
          </Text>
        )}
        {fehlt ? (
          <Text style={styles.leer} testID="kontostatus-ohne-schema">
            {ansicht === 'meine' ? Meldung.OHNE_SCHEMA.meine : Meldung.OHNE_SCHEMA.kontostatus}
          </Text>
        ) : fehler ? (
          <Text style={styles.fehler} accessibilityRole="alert">
            {fehler}
          </Text>
        ) : zeilen === null ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.text3} />
        ) : zeilen.length === 0 ? (
          <Text style={styles.leer} testID="kontostatus-leer">
            {ansicht === 'meine' ? Meldung.LEER.meine : Meldung.LEER.kontostatus}
          </Text>
        ) : (
          zeilen.map((z) => {
            const offen = Meldung.widerspruchOffen(z.bis) && !z.beschwerde;
            return (
              <View key={z.id} style={styles.karte} testID={`kontostatus-${z.id}`}>
                <View style={styles.kopfZeile}>
                  <Text style={styles.kopf}>{z.kopf}</Text>
                  <Text style={styles.datum}>{z.datum}</Text>
                </View>
                <Text style={styles.stand}>{z.stand}</Text>
                {!!z.massnahme && <Text style={styles.text}>{z.massnahme}.</Text>}
                {!!z.grundlage && <Text style={styles.text}>Grund: {z.grundlage}.</Text>}
                {!!z.begruendung && <Text style={styles.text}>Begründung: {z.begruendung}</Text>}
                {!!z.beschwerde && <Text style={styles.text}>{Meldung.beschwerdeText(z.beschwerde)}</Text>}
                {z.bis && !z.beschwerde ? (
                  <Text style={styles.leise}>
                    {offen ? Meldung.WIDERSPRUCH.fristText(z.bis) : Meldung.WIDERSPRUCH.abgelaufen}
                  </Text>
                ) : null}
                {offen && widerspruch !== z.id && (
                  <Druck
                    style={styles.knopfLeise}
                    onPress={() => {
                      setWiderspruch(z.id);
                      setText('');
                      setMeldung('');
                    }}
                    accessibilityRole="button"
                    testID={`widersprechen-${z.id}`}
                  >
                    <Text style={styles.knopfLeiseText}>{Meldung.WIDERSPRUCH.knopf}</Text>
                  </Druck>
                )}
                {widerspruch === z.id && (
                  <View style={styles.widerspruch}>
                    <TextInput
                      style={styles.eingabe}
                      value={text}
                      onChangeText={setText}
                      placeholder={Meldung.WIDERSPRUCH.platzhalter}
                      placeholderTextColor={colors.text3}
                      multiline
                      maxLength={Meldung.MAX_BEGRUENDUNG}
                      testID="widerspruch-text"
                    />
                    <View style={styles.knoepfe}>
                      <Druck style={styles.knopfLeise} onPress={() => setWiderspruch(null)}>
                        <Text style={styles.knopfLeiseText}>Abbrechen</Text>
                      </Druck>
                      <Druck
                        style={[styles.knopf, sendet && { opacity: 0.6 }]}
                        disabled={sendet}
                        onPress={() => void widersprechen(z.id)}
                        testID="widerspruch-senden"
                      >
                        <Text style={styles.knopfText}>{sendet ? 'Wird gesendet …' : 'Widerspruch senden'}</Text>
                      </Druck>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
        {/* Rechtsbehelfe auch für Meldende (Art. 16 Abs. 5, Art. 20, 21 DSA; Gate 2, Fund 12). */}
        {!fehlt && (
          <Text style={styles.leise} testID="kontostatus-weitere">
            {Meldung.WIDERSPRUCH.weitere}
          </Text>
        )}
      </ScrollView>
    </SheetRahmen>
  );
};

const styles = themenStyles((colors) => ({
  inhalt: { padding: spacing.lg, gap: spacing.md },
  leer: { ...typography.body, color: colors.text2, textAlign: 'center', marginTop: spacing.lg },
  fehler: { ...typography.small, fontWeight: '600', color: colors.danger },
  meldung: { ...typography.small, fontWeight: '600', color: colors.text },
  karte: {
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    padding: spacing.md,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  kopfZeile: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  kopf: { ...typography.name, color: colors.text, flex: 1 },
  datum: { ...typography.small, color: colors.text3 },
  stand: { ...typography.small, fontWeight: '700', color: colors.brand },
  text: { ...typography.preview, color: colors.text },
  leise: { ...typography.small, color: colors.text2 },
  widerspruch: { gap: spacing.sm, marginTop: spacing.sm },
  eingabe: {
    minHeight: 76,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    textAlignVertical: 'top',
    ...typography.body,
  },
  knoepfe: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  knopf: {
    height: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knopfText: { ...typography.small, fontWeight: '700', color: colors.white },
  knopfLeise: {
    alignSelf: 'flex-start',
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  knopfLeiseText: { ...typography.small, fontWeight: '700', color: colors.text },
}));
