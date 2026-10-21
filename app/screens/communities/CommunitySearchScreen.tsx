import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { SearchBar } from '../../components/SearchBar';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';
import { useDaten } from '../../contexts/DatenContext';
import { useProfil } from '../../contexts/ProfilContext';
import { Community } from '../../types';
import type { MitgliedZeile } from '../../lib/aktionen';
import type { FreundZustand } from '../../../gemeinsam/freundschaft';

// Kasten 28/15: Beitreten oder Anfrage, Suchmuster — dieselbe Regel wie die Website.
const Beitritt = require('../../../gemeinsam/beitritt') as typeof import('../../../gemeinsam/beitritt');
// Kasten 28/15.4: Befreunden — Zustände und Sätze gleich mit der Website.
const Freundschaft = require('../../../gemeinsam/freundschaft') as typeof import('../../../gemeinsam/freundschaft');

type Filter = 'all' | 'channels' | 'people';

type Person = { id: string; name: string; handle: string; privat?: boolean };

interface Props {
  onOpenCommunity: (community: Community) => void;
  onOpenProfile: (userId: string) => void;
  /** Kasten 28/15.4: der Stand aus `freundschaften` (Schema 98). */
  freundschaftenLaden: () => Promise<Record<string, FreundZustand>>;
  /** Kasten 28/15.4: anfragen, zurückziehen oder annehmen; zurück kommt der Zustand danach. */
  freundschaftSchritt: (userId: string, vorher: FreundZustand) => Promise<{ zustand: FreundZustand; fehler?: string }>;
  onNotice: (text: string) => void;
  /** Kasten 28/15.1: Beitreten (öffentlich) bzw. Anfrage senden/zurückziehen (privat). */
  onBeitreten: (community: Community) => void;
  /** Kasten 28/15.5: in der ganzen Datenbank suchen. */
  suchen: (eingabe: string) => Promise<{ communities: Community[]; personen: MitgliedZeile[] }>;
}

/** Prototyp-Frame "Community - Suchen": Filter, Kanäle, Profile. */
export const CommunitySearchScreen = ({
  onOpenCommunity,
  onOpenProfile,
  freundschaftenLaden,
  freundschaftSchritt,
  onNotice,
  onBeitreten,
  suchen,
}: Props) => {
  const { users: geladeneNutzer } = useDaten();
  // Aus ProfilContext, nicht aus useDaten(): dort steht „Angefragt" sofort nach dem Antippen.
  const { communities: geladeneCommunities, istBlockiert } = useProfil();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const q = query.trim().toLowerCase();

  /*
   * Kasten 28/15.5 (Henrik 28.09.2026): „Stelle sicher, dass ich in dem
   * Suchfeld auch Personen/Kontakte oder auch Communitys finde, die mir nicht
   * vorgeschlagen werden, so dass ich wirklich alle suchen kann."
   *
   * Geladen sind höchstens 500 Personen und 100 Communitys. Ab zwei Zeichen
   * fragt die Suche deshalb zusätzlich die Datenbank (ladeCommunities mit
   * Suchwort, personenSuchen) und legt die Treffer dazu. Wen man sehen darf,
   * entscheiden die Regeln dort — auch für Minderjährige (Schema 52/74).
   *
   * Paket 2 (05.11.2026): auf main gibt es die Unterseite hinter
   * „Kanäle →" (Kasten 3.1/3.2) noch nicht — gesucht wird nur oben.
   */
  const suchwort = query;
  const [treffer, setTreffer] = useState<{ wort: string; communities: Community[]; personen: MitgliedZeile[] }>({
    wort: '',
    communities: [],
    personen: [],
  });
  useEffect(() => {
    if (!Beitritt.suchmuster(suchwort)) return;
    let aktuell = true;
    const warten = setTimeout(() => {
      suchen(suchwort).then((r) => {
        if (aktuell) setTreffer({ wort: suchwort, ...r });
      });
    }, 300);
    return () => {
      aktuell = false;
      clearTimeout(warten);
    };
  }, [suchwort, suchen]);
  const trefferGelten = Boolean(Beitritt.suchmuster(suchwort)) && treffer.wort === suchwort;

  // Geladene zuerst (dort steht der aktuelle Beitrittsstand), Datenbanktreffer dahinter.
  const alleCommunities = useMemo(() => {
    if (!trefferGelten) return geladeneCommunities;
    const da = new Set(geladeneCommunities.map((c) => c.id));
    return [...geladeneCommunities, ...treffer.communities.filter((c) => !da.has(c.id))];
  }, [geladeneCommunities, treffer, trefferGelten]);
  const alleNutzer = useMemo(() => {
    const liste: Record<string, Person> = { ...geladeneNutzer };
    if (trefferGelten) for (const p of treffer.personen) if (!liste[p.id]) liste[p.id] = p;
    for (const id of Object.keys(liste)) if (istBlockiert(id)) delete liste[id];
    return liste;
  }, [geladeneNutzer, treffer, trefferGelten, istBlockiert]);

  const channels = useMemo(
    () =>
      filter === 'people'
        ? []
        : alleCommunities.filter((c) => !q || c.name.toLowerCase().includes(q) || c.topic.toLowerCase().includes(q)),
    [filter, q, alleCommunities]
  );

  const people = useMemo(
    () =>
      filter === 'channels'
        ? []
        : Object.values(alleNutzer).filter(
            (u) => u.id !== 'me' && (!q || u.name.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q))
          ),
    [filter, q, alleNutzer]
  );

  /*
   * Kasten 28/15.4 (Henrik 28.09.2026): „Ich denke mal, dass der Button
   * befreunden und angefragt und so nicht synchronisiert ist, denn ich hab
   * gerade eine Person eine Freundschaftsanfrage gesendet, mit der ich schon
   * geschrieben habe."
   *
   * Bis 21.10.2026 kam der Stand aus den Messenger-Kontakten, und
   * „+ Befreunden" schrieb nur in die Anzeige (nach dem Neustart weg). Jetzt
   * kommt er bei jedem Öffnen aus `freundschaften`, und nach dem Antippen
   * steht da, was die Datenbank zurückgab. Öffentlich gilt die Freundschaft
   * sofort, privat ist sie eine Anfrage (entscheidet der Auslöser).
   */
  const [freunde, setFreunde] = useState<Record<string, FreundZustand>>({});
  const [laeuft, setLaeuft] = useState<string | null>(null);
  useEffect(() => {
    let aktuell = true;
    freundschaftenLaden().then((stand) => {
      if (aktuell) setFreunde(stand);
    });
    return () => {
      aktuell = false;
    };
  }, [freundschaftenLaden]);

  const befreunden = async (u: Person) => {
    const vorher = Freundschaft.zustand(freunde, u.id);
    setLaeuft(u.id);
    const { zustand, fehler } = await freundschaftSchritt(u.id, vorher);
    setLaeuft(null);
    setFreunde((stand) => ({ ...stand, [u.id]: zustand }));
    onNotice(fehler ?? Freundschaft.meldung(vorher, zustand, u.name));
  };

  const empty = channels.length === 0 && people.length === 0;

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Suche hier nach Communitys/Kontakten..." />
        <View style={styles.pills}>
          {(
            [
              ['all', 'Alle'],
              ['channels', 'Communitys'],
              ['people', 'Kontakte'],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <Druck
              key={key}
              style={[styles.pill, filter === key && styles.pillActive]}
              onPress={() => setFilter(key)}
            >
              <Text style={[styles.pillText, filter === key && styles.pillTextActive]}>{label}</Text>
            </Druck>
          ))}
        </View>
      </View>

      {empty ? (
        <EmptyState icon="search-outline" title="Nichts gefunden" text={`Für „${query}" gibt es keinen Treffer.`} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {channels.length > 0 && (
            <Druck style={styles.sectionHeadPress} onPress={() => setFilter('channels')}>
              <Text style={styles.sectionHead}>Kanäle →</Text>
            </Druck>
          )}
          {channels.map((c) => (
            <Druck key={c.id} style={styles.row} onPress={() => onOpenCommunity(c)}>
              <Avatar id={c.id} name={c.name} size={44} />
              <View style={styles.body}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{c.name}</Text>
                  {c.visibility === 'private' && <Ionicons name="lock-closed" size={13} color={colors.text3} />}
                </View>
                <Text style={styles.sub} numberOfLines={1}>
                  {c.topic}
                </Text>
              </View>
              {/*
                Kasten 28/15.1: bei einer privaten Community „Anfrage senden" statt
                „Beitreten" — der Ersteller entscheidet. Mitglied/eigene Community:
                nur ein Merker; verlassen geht auf der Community-Seite.
              */}
              {(() => {
                const z = Beitritt.zustand(c);
                const leise = z !== 'beitreten' && z !== 'anfragen';
                const tippbar = z === 'beitreten' || z === 'anfragen' || z === 'angefragt';
                return (
                  <Druck
                    disabled={!tippbar}
                    style={[styles.action, leise && styles.actionDone]}
                    onPress={() => onBeitreten(c)}
                    accessibilityLabel={`${Beitritt.suchText(c)}: ${c.name}`}
                  >
                    <Text style={[styles.actionText, leise && styles.actionTextDone]}>{Beitritt.suchText(c)}</Text>
                  </Druck>
                );
              })()}
            </Druck>
          ))}

          {people.length > 0 && (
            <Druck style={styles.sectionHeadPress} onPress={() => setFilter('people')}>
              <Text style={styles.sectionHead}>Profile →</Text>
            </Druck>
          )}
          {people.map((u: Person) => {
            const z = Freundschaft.zustand(freunde, u.id);
            const leise = Freundschaft.leise(z);
            const label = Freundschaft.knopfText(z, u.privat);
            return (
              <View key={u.id} style={styles.row}>
                <Druck style={styles.person} onPress={() => onOpenProfile(u.id)}>
                  <Avatar id={u.id} name={u.name} size={44} />
                  <View style={styles.body}>
                    <Text style={styles.name}>{u.name}</Text>
                    <Text style={styles.sub}>{u.handle}</Text>
                  </View>
                </Druck>
                <Druck
                  disabled={!Freundschaft.tippbar(z) || laeuft === u.id}
                  style={[styles.action, leise && styles.actionDone]}
                  onPress={() => void befreunden(u)}
                  accessibilityLabel={`${label}: ${u.name}`}
                >
                  <Text style={[styles.actionText, leise && styles.actionTextDone]}>{label}</Text>
                </Druck>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = themenStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  head: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  pills: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface3 },
  pillActive: { backgroundColor: colors.brand },
  pillText: { ...typography.small, fontWeight: '600', color: colors.text2 },
  pillTextActive: { color: colors.white },
  content: { paddingBottom: spacing.xl },
  sectionHeadPress: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionHead: {
    ...typography.h3,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...typography.name, color: colors.text },
  sub: { ...typography.preview, color: colors.text2, marginTop: 2 },
  action: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  actionDone: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionText: { ...typography.small, fontWeight: '600', color: colors.white },
  actionTextDone: { color: colors.text2 },
}));
