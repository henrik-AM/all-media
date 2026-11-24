import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SheetRahmen } from './SheetRahmen';
import { AuswahlZeile, Karte } from './EinstellungBausteine';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';

export interface ListenZeile {
  text: string;
  neben?: string;
  /**
   * Zwischenüberschrift statt Eintrag.
   *
   * Die Profilstatistik hat zwölf Zeilen. Ohne Gliederung liest sie niemand:
   * „Profilaufrufe (7 Tage)" und „Follower gesamt" sehen dann gleich wichtig
   * aus, obwohl das eine eine Entwicklung ist und das andere ein Stand.
   */
  kopf?: boolean;
  /**
   * Antippen führt zum Beitrag.
   *
   * Seit „Mein Verlauf" (Kasten 10.1): eine Zeile, die sagt „Gespeichert ·
   * Sonnenuntergang", ohne dass man den Sonnenuntergang öffnen kann, ist ein
   * Protokoll, kein Verlauf. Zeilen ohne onPress bleiben, wie sie waren.
   */
  onPress?: () => void;
  /** Eindeutiger Schlüssel, wenn `text` sich wiederholen kann. */
  schluessel?: string;
}

interface Props {
  titel: string;
  /** Eine aus mehreren Möglichkeiten. */
  wahl?: string[];
  aktuell?: string;
  onWahl?: (wert: string) => void;
  /** Was gerade eingetragen ist. */
  zeilen?: ListenZeile[];
  leer?: string;
  knopf?: string;
  onKnopf?: () => void;
  /** Erklärtext. */
  info?: string;
  /** Langer Erklärtext bleibt innerhalb eines blätterbaren Blatts. */
  infoScroll?: boolean;
  /** Nachfrage vor etwas Endgültigem. */
  bestaetigen?: string;
  onBestaetigt?: () => void;
  /** Fehler beim Speichern einer Auswahl — steht im Blatt, nicht dahinter. */
  fehler?: string | null;
  onClose: () => void;
}

/**
 * Blatt hinter einem Einstellungspunkt. Vier Ausprägungen, damit kein
 * Punkt in den Einstellungen nur ein Hinweis bleibt.
 */
export const EinstellungSheet = ({
  titel,
  wahl,
  aktuell,
  onWahl,
  zeilen,
  leer,
  knopf,
  onKnopf,
  info,
  infoScroll,
  bestaetigen,
  onBestaetigt,
  fehler,
  onClose,
}: Props) => (
  <SheetRahmen
    visible
    title={titel}
    onClose={onClose}
    hoch={infoScroll || (!!zeilen && zeilen.length > 4)}
    fuss={
      knopf ? (
        <Druck style={styles.knopf} onPress={onKnopf}>
          <Text style={styles.knopfText}>{knopf}</Text>
        </Druck>
      ) : bestaetigen ? (
        <Druck style={[styles.knopf, styles.gefahr]} onPress={onBestaetigt}>
          <Text style={styles.knopfText}>Ja, Konto löschen</Text>
        </Druck>
      ) : undefined
    }
  >
    {/*
      Kasten E16-1.1/1.5: Auswahl und Liste als Karte im selben Muster wie die
      Einstellungsseite und das Sichtbarkeitsblatt (EinstellungBausteine).
    */}
    {wahl && (
      <ScrollView contentContainerStyle={styles.inhalt}>
        {!!fehler && (
          <Text style={styles.fehler} accessibilityRole="alert">
            {fehler}
          </Text>
        )}
        <Karte>
          {wahl.map((w, i) => (
            <AuswahlZeile key={w} label={w} gewaehlt={w === aktuell} onPress={() => onWahl?.(w)} letzte={i === wahl.length - 1} />
          ))}
        </Karte>
      </ScrollView>
    )}

    {zeilen &&
      (zeilen.length === 0 ? (
        <View style={styles.leerBox} accessibilityLiveRegion="polite">
          <Ionicons name="file-tray-outline" size={30} color={colors.text3} />
          <Text style={styles.hinweis}>{leer}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.inhalt}>
          {zeilen.map((z, i) => {
            const letzte = i === zeilen.length - 1 || !!zeilen[i + 1]?.kopf;
            const erste = i === 0 || !!zeilen[i - 1]?.kopf;
            if (z.kopf) {
              return (
                <Text key={`${i}-${z.text}`} style={styles.gruppe} accessibilityRole="header">
                  {z.text}
                </Text>
              );
            }
            const ecken = [erste && styles.oben, letzte && styles.unten];
            return z.onPress ? (
              <Druck
                key={`${i}-${z.schluessel ?? z.text}`}
                style={({ pressed }) => [styles.zeile, ...ecken, pressed && styles.gedrueckt]}
                onPress={z.onPress}
                accessibilityRole="button"
                accessibilityLabel={z.neben ? `${z.text}, ${z.neben}` : z.text}
              >
                <View style={[styles.zeileInnen, !letzte && styles.trenner]}>
                  <Text style={styles.label}>{z.text}</Text>
                  {!!z.neben && <Text style={styles.neben} numberOfLines={1}>{z.neben}</Text>}
                  <Ionicons name="chevron-forward" size={16} color={colors.text3} />
                </View>
              </Druck>
            ) : (
              <View key={`${i}-${z.schluessel ?? z.text}`} style={[styles.zeile, ...ecken]}>
                <View style={[styles.zeileInnen, !letzte && styles.trenner]}>
                  <Text style={styles.label}>{z.text}</Text>
                  {!!z.neben && <Text style={styles.neben} numberOfLines={1}>{z.neben}</Text>}
                </View>
              </View>
            );
          })}
        </ScrollView>
      ))}

    {info && (infoScroll ? <ScrollView><Text style={styles.text}>{info}</Text></ScrollView> : <Text style={styles.text}>{info}</Text>)}

    {bestaetigen && (
      <Text style={styles.text}>
        {bestaetigen} Alle Beiträge, Nachrichten und Communitys gehen dabei unwiderruflich verloren.
      </Text>
    )}
  </SheetRahmen>
);

const styles = themenStyles((colors) => ({
  inhalt: { paddingTop: spacing.sm, paddingBottom: spacing.lg },
  zeile: { marginHorizontal: spacing.lg, paddingLeft: spacing.lg, backgroundColor: colors.surface2 },
  oben: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  unten: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, marginBottom: spacing.sm },
  zeileInnen: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 50, paddingVertical: 10, paddingRight: spacing.lg },
  trenner: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  gedrueckt: { backgroundColor: colors.surface3 },
  label: { flex: 1, ...typography.body, color: colors.text },
  neben: { ...typography.preview, color: colors.text3, maxWidth: '50%', textAlign: 'right' },
  /* Wie die Abschnittsüberschriften der Einstellungsseite selbst. */
  gruppe: {
    ...typography.overline,
    color: colors.text3,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.lg + spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  leerBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  hinweis: { ...typography.message, color: colors.text2, textAlign: 'center' },
  text: { ...typography.message, color: colors.text, padding: spacing.lg, lineHeight: 22 },
  knopf: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gefahr: { backgroundColor: colors.danger },
  fehler: {
    ...typography.small,
    fontWeight: '600',
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  knopfText: { ...typography.name, color: colors.white },
}));
