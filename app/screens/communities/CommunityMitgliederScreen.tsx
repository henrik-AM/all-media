import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Druck } from '../../components/Druck';
import { Avatar } from '../../components/Avatar';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';
import { Community } from '../../types';
import type { MitgliedZeile } from '../../lib/aktionen';

const Beitritt = require('../../../gemeinsam/beitritt') as typeof import('../../../gemeinsam/beitritt');

interface Props {
  community: Community;
  onBack: () => void;
  onOpenProfile: (userId: string) => void;
  laden: (communityId: string) => Promise<{ mitglieder: MitgliedZeile[]; anfragen: MitgliedZeile[]; fehler?: string }>;
  entscheiden: (communityId: string, userId: string, annehmen: boolean) => Promise<string | null>;
  /** Nach Annehmen/Ablehnen: Zahl und offene Anfragen neu laden. */
  onGeaendert: () => void;
}

/**
 * Kasten 28/9: die Mitglieder einer Community — Name auf der Homeseite
 * antippen (Prototyp-Frame „CC + Kanal": „Name · Mitglieder").
 *
 * Öffentlich: alle sehen die Liste. Privat: nur die Anzahl, außer für den
 * Ersteller (Beitritt.listeSichtbar, Regel „Mitglieder lesen" in Schema 97).
 * Der Ersteller sieht hier außerdem die offenen Beitrittsanfragen und
 * entscheidet über sie (Kasten 15.2). Gleiche Seite auf der Website:
 * renderCommunityMitglieder.
 */
export const CommunityMitgliederScreen = ({ community, onBack, onOpenProfile, laden, entscheiden, onGeaendert }: Props) => {
  const insets = useSafeAreaInsets();
  const sichtbar = Beitritt.listeSichtbar(community);
  const [mitglieder, setMitglieder] = useState<MitgliedZeile[] | null>(sichtbar ? null : []);
  const [anfragen, setAnfragen] = useState<MitgliedZeile[]>([]);
  // Fehler stehen auf der Seite, nicht im Toast dahinter.
  const [fehler, setFehler] = useState<string | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState<string | null>(null);

  const neuLaden = useCallback(async () => {
    if (!sichtbar) return;
    const ergebnis = await laden(community.id);
    setFehler(ergebnis.fehler ?? null);
    setMitglieder(Beitritt.ordnen(ergebnis.mitglieder, community.erstellerId, 'me'));
    setAnfragen(ergebnis.anfragen);
  }, [sichtbar, laden, community.id, community.erstellerId]);

  useEffect(() => {
    void neuLaden();
  }, [neuLaden]);

  const antworten = async (person: MitgliedZeile, annehmen: boolean) => {
    setBeschaeftigt(person.id);
    const grund = await entscheiden(community.id, person.id, annehmen);
    setBeschaeftigt(null);
    if (grund) return setFehler(grund);
    setFehler(null);
    await neuLaden();
    onGeaendert();
  };

  const personZeile = (p: MitgliedZeile, zusatz?: React.ReactNode) => (
    <View key={p.id} style={styles.row}>
      <Druck
        style={styles.person}
        disabled={p.id === 'me'}
        onPress={() => onOpenProfile(p.id)}
        accessibilityLabel={`${p.name} öffnen`}
      >
        <Avatar id={p.id} name={p.name} size={44} />
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {p.id === 'me' ? Beitritt.DU : p.name}
          </Text>
          {!!p.handle && <Text style={styles.sub}>{p.handle}</Text>}
        </View>
      </Druck>
      {zusatz}
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Druck onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Zurück zur Community">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Druck>
        <View style={styles.barText}>
          <Text style={styles.barTitel} numberOfLines={1} accessibilityRole="header">
            {Beitritt.TITEL}
          </Text>
          <Text style={styles.barSub} numberOfLines={1}>
            {community.name} · {Beitritt.anzahlText(community.members)}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        {!!fehler && <Text style={styles.fehler}>{fehler}</Text>}

        {!sichtbar ? (
          <View style={styles.privat}>
            <Ionicons name="lock-closed" size={30} color={colors.text3} />
            <Text style={styles.privatZahl}>{Beitritt.anzahlText(community.members)}</Text>
            <Text style={styles.privatText}>{Beitritt.PRIVAT_HINWEIS}</Text>
          </View>
        ) : mitglieder === null ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.brand} />
        ) : (
          <>
            {community.eigen && anfragen.length > 0 && (
              <>
                <Text style={styles.abschnitt}>
                  {Beitritt.ANFRAGEN} ({anfragen.length})
                </Text>
                {anfragen.map((p) =>
                  personZeile(
                    p,
                    <View style={styles.knoepfe}>
                      <Druck
                        style={[styles.knopf, styles.knopfLeise]}
                        disabled={beschaeftigt === p.id}
                        onPress={() => antworten(p, false)}
                        accessibilityLabel={`${p.name} ablehnen`}
                      >
                        <Text style={styles.knopfLeiseText}>{Beitritt.ABLEHNEN}</Text>
                      </Druck>
                      <Druck
                        style={styles.knopf}
                        disabled={beschaeftigt === p.id}
                        onPress={() => antworten(p, true)}
                        accessibilityLabel={`${p.name} annehmen`}
                      >
                        <Text style={styles.knopfText}>{Beitritt.ANNEHMEN}</Text>
                      </Druck>
                    </View>
                  )
                )}
              </>
            )}

            {community.visibility === 'private' && (
              <Text style={styles.hinweis}>{Beitritt.PRIVAT_HINWEIS}</Text>
            )}
            <Text style={styles.abschnitt}>{Beitritt.anzahlText(community.members)}</Text>
            {mitglieder.length === 0 && <Text style={styles.leer}>{Beitritt.LEER}</Text>}
            {mitglieder.map((p) =>
              personZeile(
                p,
                p.id === community.erstellerId ? (
                  <View style={styles.marke}>
                    <Text style={styles.markeText}>{Beitritt.ERSTELLER}</Text>
                  </View>
                ) : null
              )
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = themenStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  bar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  barText: { flex: 1, minWidth: 0 },
  barTitel: { ...typography.h3, fontSize: 17, color: colors.text },
  barSub: { ...typography.small, color: colors.text3 },
  fehler: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface3,
    color: colors.danger,
    fontSize: 14,
  },
  privat: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.xl * 2 },
  privatZahl: { ...typography.h2, color: colors.text },
  privatText: { ...typography.small, color: colors.text3, textAlign: 'center' },
  hinweis: { ...typography.small, color: colors.text3, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  abschnitt: {
    ...typography.h3,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  leer: { ...typography.small, color: colors.text3, paddingHorizontal: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minWidth: 0 },
  body: { flex: 1, minWidth: 0 },
  name: { ...typography.name, color: colors.text },
  sub: { ...typography.preview, color: colors.text2, marginTop: 2 },
  knoepfe: { flexDirection: 'row', gap: spacing.sm },
  knopf: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  knopfText: { ...typography.small, fontWeight: '600', color: colors.white },
  knopfLeise: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  knopfLeiseText: { ...typography.small, fontWeight: '600', color: colors.text2 },
  marke: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.brandSoft },
  markeText: { color: colors.brand, fontSize: 12, fontWeight: '600' },
}));
