/**
 * Das Melden-Blatt — ein Weg für alles, was sich melden lässt.
 *
 * WARUM ES DAS GIBT
 *
 * Kasten RS 3 (rechtliche Prüfung 21.10.2026). Der Digital Services Act,
 * Art. 16, verlangt ein Meldeverfahren, das leicht zugänglich ist, eine
 * Begründung und die genaue Fundstelle aufnimmt, eine Erklärung „in gutem
 * Glauben" verlangt und den Eingang bestätigt. Bis hierher gab es drei
 * Grundlisten (Beitrag, Profil, Story) ohne Begründung, und „Story melden"
 * meldete in Wahrheit das Profil.
 *
 * ABLAUF
 *
 *   1. Kategorie wählen (gemeinsam/meldung.js, Schlüssel wie Schema 102)
 *   2. Begründung (Pflicht ab 10 Zeichen, außer bei Kindesmissbrauch) und
 *      das Häkchen „nach bestem Wissen und Gewissen" — nie vorausgefüllt
 *   3. Senden → Eingangsbestätigung im Blatt
 *
 * Fehler stehen IM Blatt, nicht als Hinweis dahinter (der läge unter dem
 * Modal, siehe CommentSheet 28.09.2026). „Problem melden" (Einstellungen)
 * nimmt denselben Weg ohne Kategorie und Häkchen.
 *
 * Gegenstück auf der Website: openMeldenBlatt in web/public/app.js.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Druck } from './Druck';
import { SheetRahmen } from './SheetRahmen';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';
import { useDaten } from '../contexts/DatenContext';
import { useSupabase } from '../contexts/SupabaseContext';
import * as Aktion from '../lib/aktionen';

const Meldung = require('../../gemeinsam/meldung') as typeof import('../../gemeinsam/meldung');
type MeldeArt = import('../../gemeinsam/meldung').MeldeArt;
type KategorieKey = import('../../gemeinsam/meldung').KategorieKey;

/** Was gemeldet wird. */
export interface MeldeZiel {
  art: MeldeArt;
  /** Die Kennung (Beitrag, Kommentar, Story, Profil, Nachricht …); bei 'problem' leer. */
  id?: string | null;
  /**
   * Nur bei Nachrichten: holt beim Senden den Beleg — Klartext und, bei
   * Ende-zu-Ende, den Sitzungsschlüssel NUR dieser Nachricht
   * (lib/krypto.ts, meldebelegHolen).
   */
  beleg?: () => Promise<{ text: string; sitzung?: string } | null>;
}

interface Props {
  ziel: MeldeZiel | null;
  onClose: () => void;
}

type Schritt = 'kategorie' | 'details' | 'fertig';

export const MeldenSheet = ({ ziel, onClose }: Props) => {
  const { supabase } = useSupabase();
  const { ichId } = useDaten();
  const art = ziel?.art ?? 'post';
  const [schritt, setSchritt] = useState<Schritt>(art === 'problem' ? 'details' : 'kategorie');
  const [kat, setKat] = useState<KategorieKey | null>(null);
  const [text, setText] = useState('');
  const [haken, setHaken] = useState(false);
  const [fehler, setFehler] = useState('');
  const [sendet, setSendet] = useState(false);
  const [alterWeg, setAlterWeg] = useState(false);
  /*
   * Doppeltipp-Sperre (Gate 2, Fund 23): `sendet` ist erst nach dem nächsten
   * Zeichnen gesetzt — zwei schnelle Tipps sahen beide `false` und schickten
   * zwei Meldungen. Die Ref gilt sofort.
   */
  const laeuft = useRef(false);

  /*
   * Jedes neue Ziel fängt von vorn an — nichts aus der letzten Meldung bleibt
   * stehen. Abhängig von Art und Kennung, nicht vom Objekt: die Aufrufer
   * bauen `ziel` bei jedem Zeichnen neu, und ein neu gezeichneter Kommentar-
   * bereich hätte sonst die halb getippte Begründung gelöscht.
   */
  useEffect(() => {
    setSchritt(ziel?.art === 'problem' ? 'details' : 'kategorie');
    setKat(null);
    setText('');
    setHaken(false);
    setFehler('');
    setSendet(false);
    setAlterWeg(false);
    laeuft.current = false;
  }, [ziel?.art, ziel?.id]);

  if (!ziel) return null;

  const hinweis = Meldung.hinweisFuer(kat);
  const istNachricht = art === 'message' || art === 'kanal_nachricht';

  const senden = async () => {
    if (laeuft.current) return;
    setFehler('');
    const eingabe = {
      art,
      ziel: ziel.id ?? null,
      kategorie: art === 'problem' ? ('problem' as const) : kat,
      begruendung: text,
      gutglaeubig: haken,
    };
    const grund = Meldung.pruefen(eingabe);
    if (grund) return setFehler(Meldung.grundText(grund));
    if (!supabase || !ichId) return setFehler(Meldung.grundText('nicht_angemeldet'));

    laeuft.current = true;
    setSendet(true);
    try {
      const beleg = ziel.beleg ? await ziel.beleg().catch(() => null) : null;
      const r = await Aktion.inhaltMelden(supabase, ichId, { ...eingabe, beleg });
      if (!r.ok) {
        setFehler(r.grund === 'update' ? Meldung.updateText(art) : Meldung.grundText(r.grund));
        return;
      }
      setAlterWeg(Boolean(r.alterWeg));
      setSchritt('fertig');
    } catch (e: any) {
      console.error('Melden fehlgeschlagen:', e?.message ?? e);
      setFehler(e?.message ? `Das Melden hat nicht geklappt: ${e.message}` : Meldung.grundText('netz'));
    } finally {
      laeuft.current = false;
      setSendet(false);
    }
  };

  const fuss =
    schritt === 'kategorie' ? undefined : schritt === 'fertig' ? (
      <Druck style={styles.knopf} onPress={onClose} testID="melden-fertig">
        <Text style={styles.knopfText}>Fertig</Text>
      </Druck>
    ) : (
      <Druck
        style={[styles.knopf, sendet && styles.knopfAus]}
        onPress={senden}
        disabled={sendet}
        testID="melden-senden"
        accessibilityRole="button"
      >
        <Text style={styles.knopfText}>{sendet ? 'Wird gesendet …' : 'Senden'}</Text>
      </Druck>
    );

  return (
    <SheetRahmen visible title={Meldung.titel(art)} onClose={onClose} hoch fuss={fuss}>
      {schritt === 'kategorie' ? (
        <ScrollView>
          <Text style={styles.einleitung}>Worum geht es? Wähle, was am besten passt.</Text>
          {Meldung.KATEGORIEN.map((k) => (
            <Druck
              key={k.key}
              style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
              onPress={() => {
                setKat(k.key);
                setFehler('');
                setSchritt('details');
              }}
              testID={`melden-kategorie-${k.key}`}
              accessibilityRole="button"
            >
              <View style={styles.zeileText}>
                <Text style={styles.name}>{k.name}</Text>
                <Text style={styles.erklaerung}>{k.erklaerung}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.text3} />
            </Druck>
          ))}
        </ScrollView>
      ) : schritt === 'fertig' ? (
        <View style={styles.fertig} testID="melden-bestaetigung">
          <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          <Text style={styles.fertigText}>{Meldung.eingangText(art, alterWeg)}</Text>
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.inhalt}>
          {art !== 'problem' && (
            <Druck style={styles.gewaehlt} onPress={() => setSchritt('kategorie')} accessibilityRole="button">
              <Text style={styles.gewaehltText}>
                Grund: <Text style={styles.fett}>{Meldung.kategorieName(kat)}</Text>
              </Text>
              <Text style={styles.aendern}>ändern</Text>
            </Druck>
          )}

          {hinweis && (
            <View style={styles.hinweis} testID={`melden-hinweis-${kat}`}>
              <Text style={styles.hinweisTitel}>{hinweis.titel}</Text>
              {hinweis.punkte.map((p) => (
                <Text key={p} style={styles.hinweisPunkt}>
                  • {p}
                </Text>
              ))}
              <View style={styles.hinweisKnoepfe}>
                {hinweis.link && (
                  <Druck style={styles.hinweisKnopf} onPress={() => Linking.openURL(hinweis.link!)}>
                    <Text style={styles.hinweisKnopfText}>Internet-Beschwerdestelle</Text>
                  </Druck>
                )}
                {hinweis.notruf && (
                  <Druck style={styles.hinweisKnopf} onPress={() => Linking.openURL(`tel:${hinweis.notruf}`)}>
                    <Text style={styles.hinweisKnopfText}>110 anrufen</Text>
                  </Druck>
                )}
                {hinweis.telefonseelsorge && (
                  <Druck
                    style={styles.hinweisKnopf}
                    onPress={() => Linking.openURL(`tel:${hinweis.telefonseelsorge!.replace(/\s/g, '')}`)}
                  >
                    <Text style={styles.hinweisKnopfText}>Telefonseelsorge</Text>
                  </Druck>
                )}
                {hinweis.kummer && (
                  <Druck style={styles.hinweisKnopf} onPress={() => Linking.openURL(`tel:${hinweis.kummer!.replace(/\s/g, '')}`)}>
                    <Text style={styles.hinweisKnopfText}>116 111</Text>
                  </Druck>
                )}
              </View>
            </View>
          )}

          {istNachricht && <Text style={styles.leise}>{Meldung.NACHRICHT_HINWEIS}</Text>}

          <Text style={styles.label}>{art === 'problem' ? 'Was ist passiert?' : 'Was ist daran nicht in Ordnung?'}</Text>
          <TextInput
            style={styles.eingabe}
            value={text}
            onChangeText={(t) => {
              setText(t);
              if (fehler) setFehler('');
            }}
            placeholder={Meldung.platzhalter(art, kat)}
            placeholderTextColor={colors.text3}
            multiline
            maxLength={Meldung.MAX_BEGRUENDUNG}
            testID="melden-text"
          />
          <Text style={styles.zaehler}>{Meldung.zaehlerText(text, art === 'problem' ? 'problem' : kat)}</Text>

          {art !== 'problem' && (
            <Druck
              style={styles.haken}
              onPress={() => {
                setHaken((h) => !h);
                if (fehler) setFehler('');
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: haken }}
              testID="melden-haken"
            >
              <Ionicons name={haken ? 'checkbox' : 'square-outline'} size={22} color={haken ? colors.brand : colors.text2} />
              <Text style={styles.hakenText}>{Meldung.GUTGLAEUBIG}</Text>
            </Druck>
          )}

          {!!fehler && (
            <Text style={styles.fehler} accessibilityRole="alert" testID="melden-fehler">
              {fehler}
            </Text>
          )}
        </ScrollView>
      )}
    </SheetRahmen>
  );
};

const styles = themenStyles((colors) => ({
  einleitung: { ...typography.body, color: colors.text2, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  gedrueckt: { backgroundColor: colors.surface2 },
  zeileText: { flex: 1 },
  name: { ...typography.name, color: colors.text },
  erklaerung: { ...typography.small, color: colors.text2, marginTop: 2 },
  inhalt: { paddingBottom: spacing.lg },
  gewaehlt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  gewaehltText: { ...typography.body, color: colors.text, flex: 1 },
  fett: { fontWeight: '700' },
  aendern: { ...typography.small, color: colors.brand, fontWeight: '700' },
  hinweis: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  hinweisTitel: { ...typography.name, color: colors.danger, marginBottom: 6 },
  hinweisPunkt: { ...typography.preview, color: colors.text, marginBottom: 4 },
  hinweisKnoepfe: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  hinweisKnopf: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hinweisKnopfText: { ...typography.small, fontWeight: '700', color: colors.danger },
  leise: { ...typography.small, color: colors.text2, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  label: { ...typography.small, color: colors.text2, paddingHorizontal: spacing.lg, marginBottom: 6 },
  eingabe: {
    marginHorizontal: spacing.lg,
    minHeight: 96,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    textAlignVertical: 'top',
    ...typography.body,
  },
  zaehler: { ...typography.small, color: colors.text3, paddingHorizontal: spacing.lg, marginTop: 4 },
  haken: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  hakenText: { ...typography.body, color: colors.text, flex: 1 },
  fehler: { ...typography.small, fontWeight: '600', color: colors.danger, paddingHorizontal: spacing.lg, paddingTop: 4 },
  fertig: { alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  fertigText: { ...typography.body, color: colors.text, textAlign: 'center' },
  knopf: {
    height: 44,
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knopfAus: { opacity: 0.6 },
  knopfText: { ...typography.name, color: colors.white },
}));
