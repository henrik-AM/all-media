/**
 * Einen Insight verschicken.
 *
 * WAS EIN INSIGHT IST
 *
 * Ein Foto oder Video, das an ausgewählte Personen geht — das
 * Snapchat-Äquivalent aus dem Handbuch. Es ist weder eine Nachricht noch ein
 * Beitrag, sondern eine eigene Gattung: es kann nach einmaligem Ansehen
 * verschwinden, es kann sich selbst löschen, und es zählt für die
 * **Insight Time** — die Tage in Folge, an denen sich beide Seiten
 * gegenseitig einen geschickt haben.
 *
 * Nicht zu verwechseln mit den „Insights" im Einstellungsmenü. Das ist
 * Statistik zum eigenen Profil und hat damit nichts zu tun. Die Verwechslung
 * ist der Grund, warum diese Funktion bis zum 01.09.2026 fehlte: das Wort
 * stand im Code, aber in der anderen Bedeutung.
 *
 * WARUM DIE EMPFÄNGER VORGEWÄHLT SIND
 *
 * Das Handbuch nennt eine „Liste an Personen die Insights gesendet bekommen"
 * und daneben die Möglichkeit, sie manuell auszuwählen. Beides steht hier:
 * die feste Liste ist beim Öffnen angehakt, jeder Haken lässt sich ändern.
 * Ohne die Vorauswahl müsste man vor jedem Insight dieselben acht Namen neu
 * antippen — und schickt ihn dann irgendwann gar nicht mehr.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { Druck } from './Druck';
import { SheetRahmen } from './SheetRahmen';
import { FilterBild } from './FilterBild';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';
import { useDaten } from '../contexts/DatenContext';

/*
 * Die Ansichtsdauer. Null heißt: so lange ansehen, wie man mag — das
 * Handbuch nennt es „Unbegrenzte Ansicht". Die Stufen dazwischen sind
 * bewusst kurz; ein Insight ist ein Blick, keine Galerie.
 */
const DAUERN = [
  { wert: 3, text: '3 s' },
  { wert: 5, text: '5 s' },
  { wert: 10, text: '10 s' },
  { wert: 0, text: 'Unbegrenzt' },
];

/** Selbstlöschend: nach dieser Zeit ist die Aufnahme ganz weg. */
const LOESCHEN = [
  { wert: 0, text: 'Nie' },
  { wert: 24, text: 'Nach 24 h' },
  { wert: 168, text: 'Nach 7 Tagen' },
];

export interface InsightWahl {
  empfaenger: string[];
  dauer: number;
  einmal: boolean;
  loeschtNachStunden: number;
  gespeichert: boolean;
}

interface Props {
  visible: boolean;
  /** Die Aufnahme, um die es geht. */
  uri: string | null;
  filter: string;
  onClose: () => void;
  onSenden: (wahl: InsightWahl) => void;
}

export const InsightSheet = ({ visible, uri, filter, onClose, onSenden }: Props) => {
  const { contacts, users, insightZiele, insightStreaks } = useDaten();

  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  const [dauer, setDauer] = useState(5);
  const [einmal, setEinmal] = useState(true);
  const [loeschen, setLoeschen] = useState(24);
  const [behalten, setBehalten] = useState(false);

  // Beim Öffnen die feste Empfängerliste vorwählen.
  useEffect(() => {
    if (visible) setGewaehlt(insightZiele);
  }, [visible, insightZiele]);

  /*
   * Wer eine laufende Insight Time hat, steht oben. Eine Kette, die heute
   * noch nicht bedient wurde, reißt um Mitternacht — die Person deswegen
   * ganz unten in einer alphabetischen Liste suchen zu müssen, wäre genau
   * verkehrt herum.
   */
  const liste = useMemo(() => {
    const alle = contacts.map((k) => ({
      id: k.id,
      name: users[k.id]?.name ?? k.name,
      streak: insightStreaks[k.id],
    }));
    return alle.sort((a, b) => {
      const at = a.streak?.tage ?? 0;
      const bt = b.streak?.tage ?? 0;
      if (at !== bt) return bt - at;
      return a.name.localeCompare(b.name);
    });
  }, [contacts, users, insightStreaks]);

  const umschalten = (id: string) =>
    setGewaehlt((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  const wahlZeile = <T,>(
    titel: string,
    punkte: { wert: T; text: string }[],
    aktuell: T,
    setzen: (w: T) => void
  ) => (
    <View style={styles.block}>
      <Text style={styles.blockTitel}>{titel}</Text>
      <View style={styles.pillen}>
        {punkte.map((p) => (
          <Druck
            key={String(p.wert)}
            style={[styles.pille, aktuell === p.wert && styles.pilleAktiv]}
            onPress={() => setzen(p.wert)}
          >
            <Text style={[styles.pilleText, aktuell === p.wert && styles.pilleTextAktiv]}>
              {p.text}
            </Text>
          </Druck>
        ))}
      </View>
    </View>
  );

  return (
    <SheetRahmen
      visible={visible}
      title="Insight senden"
      onClose={onClose}
      hoch
      fuss={
        <Druck
          style={[styles.senden, !gewaehlt.length && styles.sendenAus]}
          disabled={!gewaehlt.length}
          onPress={() =>
            onSenden({
              empfaenger: gewaehlt,
              dauer,
              einmal,
              loeschtNachStunden: loeschen,
              gespeichert: behalten,
            })
          }
        >
          <Ionicons name="send" size={17} color={colors.white} />
          <Text style={styles.sendenText}>
            {gewaehlt.length
              ? `An ${gewaehlt.length} ${gewaehlt.length === 1 ? 'Person' : 'Personen'} senden`
              : 'Wähle mindestens eine Person'}
          </Text>
        </Druck>
      }
    >
      <ScrollView contentContainerStyle={styles.inhalt} keyboardShouldPersistTaps="handled">
        {uri ? (
          <FilterBild uri={uri} filter={filter} style={styles.vorschau} passform="cover" />
        ) : null}

        {wahlZeile('Wie lange sichtbar', DAUERN, dauer, setDauer)}

        <View style={styles.block}>
          <Text style={styles.blockTitel}>Ansicht</Text>
          <View style={styles.pillen}>
            <Druck
              style={[styles.pille, einmal && styles.pilleAktiv]}
              onPress={() => setEinmal(true)}
            >
              <Text style={[styles.pilleText, einmal && styles.pilleTextAktiv]}>Einmalansicht</Text>
            </Druck>
            <Druck
              style={[styles.pille, !einmal && styles.pilleAktiv]}
              onPress={() => setEinmal(false)}
            >
              <Text style={[styles.pilleText, !einmal && styles.pilleTextAktiv]}>
                Mehrfach ansehbar
              </Text>
            </Druck>
          </View>
          <Text style={styles.hinweis}>
            {einmal
              ? 'Nach dem Öffnen ist er weg — auch bei dir in der Übersicht.'
              : 'Bleibt offen, bis er sich selbst löscht.'}
          </Text>
        </View>

        {wahlZeile('Selbstlöschend', LOESCHEN, loeschen, setLoeschen)}

        <Druck style={styles.behalten} onPress={() => setBehalten((b) => !b)}>
          <Ionicons
            name={behalten ? 'checkbox' : 'square-outline'}
            size={20}
            color={behalten ? colors.brand : colors.text2}
          />
          <Text style={styles.behaltenText}>Bei mir behalten</Text>
        </Druck>

        <Text style={styles.blockTitel}>An wen</Text>
        {liste.length === 0 && (
          <Text style={styles.leer}>
            Du hast noch keine Kontakte. Insights gehen nur an Personen, die du gespeichert hast.
          </Text>
        )}
        {liste.map((p) => {
          const an = gewaehlt.includes(p.id);
          return (
            <Druck key={p.id} style={styles.person} onPress={() => umschalten(p.id)}>
              <Avatar id={p.id} name={p.name} size={38} />
              <View style={styles.personText}>
                <Text style={styles.personName}>{p.name}</Text>
                {/*
                 * Die Insight Time steht direkt hinter dem Namen, so wie es
                 * das Handbuch beschreibt: Kamera-Emoji plus Zahl. Grau,
                 * solange der Tag noch nicht vollständig ist — sonst sähe
                 * eine Kette, die heute Nacht reißt, aus wie eine sichere.
                 */}
                {p.streak?.tage ? (
                  <Text
                    style={[
                      styles.streak,
                      !(p.streak.heuteGesendet && p.streak.heuteEmpfangen) && styles.streakOffen,
                    ]}
                  >
                    📷 {p.streak.tage}
                    {p.streak.heuteGesendet && p.streak.heuteEmpfangen
                      ? ''
                      : ' · heute noch offen'}
                  </Text>
                ) : null}
              </View>
              <Ionicons
                name={an ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={an ? colors.brand : colors.border}
              />
            </Druck>
          );
        })}
      </ScrollView>
    </SheetRahmen>
  );
};

const styles = themenStyles((colors) => ({
  inhalt: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  vorschau: { height: 190, borderRadius: radius.lg },
  block: { gap: spacing.sm },
  blockTitel: { ...typography.name, color: colors.text2 },
  pillen: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pille: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface3,
  },
  pilleAktiv: { backgroundColor: colors.brand },
  pilleText: { ...typography.message, color: colors.text },
  pilleTextAktiv: { color: colors.white, fontWeight: '600' },
  hinweis: { ...typography.small, color: colors.text2 },
  behalten: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  behaltenText: { ...typography.message, color: colors.text },
  leer: { ...typography.small, color: colors.text2 },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 8 },
  personText: { flex: 1 },
  personName: { ...typography.name, color: colors.text },
  streak: { ...typography.small, color: colors.brand },
  streakOffen: { color: colors.text2 },
  senden: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brand,
    paddingVertical: 13,
    borderRadius: radius.pill,
  },
  sendenAus: { backgroundColor: colors.border },
  sendenText: { ...typography.name, color: colors.white },
}));
