/**
 * Wer etwas sehen darf — in den vier Stufen des Handbuchs.
 *
 * WARUM VIER UND NICHT DREI
 *
 * In App und Website stand bis zum 01.09.2026 überall dasselbe Trio: „Alle /
 * Meine Kontakte / Niemand". Das Handbuch nennt an jeder dieser Stellen aber
 * vier Stufen:
 *
 *     Niemand · Niemand bis auf … · Alle bis auf … · Alle
 *
 * Die beiden mittleren sind der eigentliche Punkt. „Alle bis auf meinen
 * Chef" und „Niemand außer meinen drei besten Freunden" sind die Fälle, für
 * die man eine Sichtbarkeitseinstellung überhaupt aufmacht — und beide
 * ließen sich vorher nicht ausdrücken. Wer sie brauchte, musste die
 * Einstellung auf „Niemand" stellen und damit auch alle anderen aussperren.
 *
 * WARUM DIE AUSNAHMELISTE HIER STEHT UND NICHT WOANDERS
 *
 * Eine Stufe „Alle bis auf …" ohne die Liste daneben ist eine Einstellung,
 * die nichts tut. Sie erscheint deshalb sofort unter der Wahl, sobald eine
 * der beiden „bis auf"-Stufen gewählt ist, und verschwindet wieder — die
 * Einträge bleiben aber erhalten, denn wer zwischen den Stufen hin und her
 * schaltet, will seine mühsam zusammengesuchten Namen wiederfinden.
 */

import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { Druck } from './Druck';
import { SearchBar } from './SearchBar';
import { SheetRahmen } from './SheetRahmen';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';
import { useDaten } from '../contexts/DatenContext';
import { SichtbarkeitStufe } from '../lib/aktionen';

const STUFEN: { key: SichtbarkeitStufe; label: string; hinweis: string }[] = [
  { key: 'niemand', label: 'Niemand', hinweis: 'Niemand sieht es.' },
  {
    key: 'niemand_bis_auf',
    label: 'Niemand bis auf …',
    hinweis: 'Nur die Personen, die du unten einträgst.',
  },
  {
    key: 'alle_bis_auf',
    label: 'Alle bis auf …',
    hinweis: 'Alle außer den Personen, die du unten einträgst.',
  },
  { key: 'alle', label: 'Alle', hinweis: 'Jeder, der dich sehen darf.' },
];

interface Props {
  visible: boolean;
  titel: string;
  stufe: SichtbarkeitStufe;
  ausnahmen: string[];
  onStufe: (stufe: SichtbarkeitStufe) => void;
  onAusnahme: (userId: string) => void;
  onClose: () => void;
  /*
   * Nur bei der Story-Sichtbarkeit gesetzt. Das Handbuch haengt den Zusatz
   * „Jeder -> Story auch in Videos teilen" ausdruecklich an die Stufe
   * „Jeder" — deshalb steht er hier unter der Wahl und nicht als eigene
   * Zeile in den Einstellungen: dort waere nicht zu sehen, wovon er abhaengt.
   */
  inVideos?: boolean;
  onInVideos?: (an: boolean) => void;
}

export const SichtbarkeitSheet = ({
  visible,
  titel,
  stufe,
  ausnahmen,
  onStufe,
  onAusnahme,
  onClose,
  inVideos,
  onInVideos,
}: Props) => {
  const { contacts, users } = useDaten();
  const [suche, setSuche] = useState('');

  const brauchtListe = stufe === 'niemand_bis_auf' || stufe === 'alle_bis_auf';

  /*
   * Wer schon auf der Liste steht, steht oben. Sonst müsste man in einer
   * Kontaktliste mit hundert Namen suchen, wen man vorhin eingetragen hat.
   *
   * Henrik, 07.09.2026: "Liste zeigt nicht alle Messenger-Kontakte."
   *
   * Hier stand `.filter((k) => users[k.id])`: wer im Kontaktbuch steht, aber
   * kein geladenes Profil hat, fiel lautlos heraus. Genau das passiert bei
   * jedem, dessen Profil die Sichtbarkeitsregeln nicht herausgeben — ein
   * Kontakt, den man vom Standort ausnehmen WILL, war deshalb der, den man
   * hier nicht fand. Jetzt bleibt jeder Kontakt in der Liste; fehlt das
   * Profil, traegt die Zeile den Namen aus dem Kontaktbuch.
   */
  const liste = contacts
    .map((k) => ({ id: k.id, name: users[k.id]?.name ?? k.name ?? 'Unbenannter Kontakt' }))
    .filter((k) => !suche || k.name.toLowerCase().includes(suche.toLowerCase()))
    .sort((a, b) => {
      const ad = ausnahmen.includes(a.id) ? 0 : 1;
      const bd = ausnahmen.includes(b.id) ? 0 : 1;
      return ad !== bd ? ad - bd : a.name.localeCompare(b.name);
    });

  return (
    <SheetRahmen visible={visible} title={titel} onClose={onClose} hoch={brauchtListe}>
      <ScrollView contentContainerStyle={styles.inhalt} keyboardShouldPersistTaps="handled">
        {STUFEN.map((st) => {
          const an = st.key === stufe;
          return (
            <Druck key={st.key} style={styles.stufe} onPress={() => onStufe(st.key)}>
              <View style={styles.stufeText}>
                <Text style={[styles.stufeLabel, an && styles.stufeLabelAn]}>{st.label}</Text>
                <Text style={styles.stufeHinweis}>{st.hinweis}</Text>
              </View>
              <Ionicons
                name={an ? 'radio-button-on' : 'radio-button-off'}
                size={21}
                color={an ? colors.brand : colors.border}
              />
            </Druck>
          );
        })}

        {/*
          * Der Zusatz zur Stufe „Jeder". Er steht auch dann da, wenn eine
          * andere Stufe gewaehlt ist — sonst wuesste niemand, dass es ihn
          * gibt —, ist dann aber abgeblendet und nicht bedienbar. Die
          * Datenbank nimmt ihn beim Stufenwechsel selbst zurueck (Schema 30).
          */}
        {onInVideos && (
          <Druck
            style={styles.zusatz}
            onPress={() => stufe === 'alle' && onInVideos(!inVideos)}
          >
            <View style={styles.stufeText}>
              <Text style={[styles.stufeLabel, stufe !== 'alle' && styles.zusatzAus]}>
                Story auch in Videos teilen
              </Text>
              <Text style={styles.stufeHinweis}>
                {stufe === 'alle'
                  ? 'Deine Story erscheint dann auch bei Profilen, die dir folgen.'
                  : 'Nur bei „Alle" möglich.'}
              </Text>
            </View>
            <Ionicons
              name={inVideos && stufe === 'alle' ? 'checkbox' : 'square-outline'}
              size={21}
              color={stufe === 'alle' ? (inVideos ? colors.brand : colors.border) : colors.border}
            />
          </Druck>
        )}

        {brauchtListe && (
          <>
            <Text style={styles.listeTitel}>
              {stufe === 'alle_bis_auf' ? 'Diese Personen nicht' : 'Nur diese Personen'}
              {ausnahmen.length ? `  ·  ${ausnahmen.length}` : ''}
            </Text>

            {/*
              * Henrik, 07.09.2026: "Bei „Alle bis auf"/„Niemand bis auf" fehlt
              * Suchleiste." Der Filter darunter gab es schon — `suche` wurde
              * gelesen und angewandt —, nur hatte niemand je ein Feld
              * bekommen, in das er etwas haette tippen koennen. Der Zustand
              * stand seit jeher auf dem leeren Text.
              */}
            <View style={styles.sucheFeld}>
              <SearchBar
                value={suche}
                onChangeText={setSuche}
                placeholder="Kontakt suchen …"
              />
            </View>

            {liste.length === 0 && (
              <Text style={styles.leer}>
                {suche
                  ? `Für „${suche}" ist kein Kontakt dabei.`
                  : 'Du hast noch keine Kontakte, die du hier eintragen könntest.'}
              </Text>
            )}

            {liste.map((p) => {
              const drauf = ausnahmen.includes(p.id);
              return (
                <Druck key={p.id} style={styles.person} onPress={() => onAusnahme(p.id)}>
                  <Avatar id={p.id} name={p.name} size={36} />
                  <Text style={styles.personName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Ionicons
                    name={drauf ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={drauf ? colors.brand : colors.border}
                  />
                </Druck>
              );
            })}
          </>
        )}
      </ScrollView>
    </SheetRahmen>
  );
};

const styles = themenStyles((colors) => ({
  inhalt: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  stufe: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 11 },
  stufeText: { flex: 1 },
  stufeLabel: { ...typography.body, color: colors.text },
  stufeLabelAn: { fontWeight: '600', color: colors.brand },
  stufeHinweis: { ...typography.tiny, color: colors.text3 },
  zusatz: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 11,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  zusatzAus: { color: colors.text3 },
  listeTitel: {
    ...typography.small,
    color: colors.text2,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  sucheFeld: { marginBottom: spacing.sm },
  leer: { ...typography.small, color: colors.text3 },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 8 },
  personName: { flex: 1, ...typography.name, color: colors.text },
}));
