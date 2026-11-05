import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { SearchBar } from '../../components/SearchBar';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';
import { useDaten } from '../../contexts/DatenContext';
import { Community, Contact } from '../../types';

type Filter = 'all' | 'channels' | 'people';

interface Props {
  contacts: Contact[];
  onOpenCommunity: (community: Community) => void;
  onOpenProfile: (userId: string) => void;
  onBefriend: (userId: string) => void;
}

/*
 * Henrik am 28.09.2026 (Kasten 3.1/3.2, Register F-07): "Wenn ich auf die
 * dicke schwarze Schrift mit dem Pfeil nach rechts druecke, moechte ich auf
 * eine separate Seite weitergeleitet werden mit dann entweder nur
 * vorgeschlagenen Profilen, auf der ich ja auch Profile suchen kann oder halt
 * nur vorgeschlagenen Communitys, auf der ich dann auch Communitys suchen
 * kann." Bis dahin setzte der Pfeil nur den Filter oben um - man blieb auf
 * derselben Seite. Jetzt oeffnet er eine eigene Seite mit Zurueck-Pfeil,
 * eigener Suchleiste und nur dieser einen Liste.
 *
 * Gesucht wird auf beiden Seiten in derselben Quelle und mit derselben Regel
 * (passendeCommunitys / passendeProfile): die Hauptsuche filtert die
 * geladenen Communitys und Nutzer aus useDaten(), die Unterseite auch.
 */
type Seite = 'channels' | 'people';

const passendeCommunitys = (alle: Community[], q: string) =>
  alle.filter((c) => !q || c.name.toLowerCase().includes(q) || c.topic.toLowerCase().includes(q));

const passendeProfile = <U extends { id: string; name: string; handle: string }>(alle: U[], q: string) =>
  alle.filter((u) => u.id !== 'me' && (!q || u.name.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q)));

/** Prototyp-Frame "Community - Suchen": Filter, Communitys, Profile. */
export const CommunitySearchScreen = ({ contacts, onOpenCommunity, onOpenProfile, onBefriend }: Props) => {
  const { communities: alleCommunities, users: alleNutzer } = useDaten();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  // Die Seite hinter "Communitys →" bzw. "Profile →" (Kasten 3.1/3.2).
  const [seite, setSeite] = useState<Seite | null>(null);
  const [seitenQuery, setSeitenQuery] = useState('');

  const q = query.trim().toLowerCase();
  const sq = seitenQuery.trim().toLowerCase();

  const channels = useMemo(
    () => (filter === 'people' ? [] : passendeCommunitys(alleCommunities, q)),
    [filter, q, alleCommunities]
  );

  const people = useMemo(
    () => (filter === 'channels' ? [] : passendeProfile(Object.values(alleNutzer), q)),
    [filter, q, alleNutzer]
  );

  const statusOf = (id: string) => {
    const contact = contacts.find((c) => c.id === id);
    if (!contact) return 'none';
    return contact.status === 'pending' ? 'pending' : 'friend';
  };

  const communityZeile = (c: Community) => (
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
      <View style={[styles.action, c.joined && styles.actionDone]}>
        <Text style={[styles.actionText, c.joined && styles.actionTextDone]}>
          {c.joined ? 'Mitglied' : 'Beitreten'}
        </Text>
      </View>
    </Druck>
  );

  const profilZeile = (u: { id: string; name: string; handle: string }) => {
    const status = statusOf(u.id);
    const label = status === 'friend' ? 'Befreundet' : status === 'pending' ? 'Angefragt' : '+ Befreunden';
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
          disabled={status !== 'none'}
          style={[styles.action, status !== 'none' && styles.actionDone]}
          onPress={() => onBefriend(u.id)}
        >
          <Text style={[styles.actionText, status !== 'none' && styles.actionTextDone]}>{label}</Text>
        </Druck>
      </View>
    );
  };

  const oeffneSeite = (s: Seite) => {
    // Was oben schon getippt war, gilt auf der Unterseite weiter.
    setSeitenQuery(query);
    setSeite(s);
  };

  if (seite) {
    const istCommunitys = seite === 'channels';
    const liste = istCommunitys
      ? passendeCommunitys(alleCommunities, sq)
      : passendeProfile(Object.values(alleNutzer), sq);
    return (
      <View style={styles.screen}>
        <View style={styles.bar}>
          <Druck
            onPress={() => setSeite(null)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Zurück zur Suche"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Druck>
          <Text style={styles.barTitel} numberOfLines={1} accessibilityRole="header">
            {istCommunitys ? 'Communitys' : 'Profile'}
          </Text>
        </View>
        <View style={styles.head}>
          <SearchBar
            value={seitenQuery}
            onChangeText={setSeitenQuery}
            placeholder={istCommunitys ? 'Suche nach Communitys...' : 'Suche nach Profilen...'}
          />
        </View>
        {liste.length ? (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {istCommunitys
              ? (liste as Community[]).map(communityZeile)
              : (liste as { id: string; name: string; handle: string }[]).map(profilZeile)}
          </ScrollView>
        ) : (
          <EmptyState
            icon="search-outline"
            title="Nichts gefunden"
            text={
              sq
                ? `Für „${seitenQuery}" gibt es keinen Treffer.`
                : istCommunitys
                  ? 'Es gibt gerade keine Communitys.'
                  : 'Es gibt gerade keine Profile.'
            }
          />
        )}
      </View>
    );
  }

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
            /*
             * Punkt 55 (26.08.) und Kasten 2.1 (28.09.): hier stehen die
             * Communitys selbst. "Kanal" ist das Unterthema INNERHALB einer
             * Community - die Ueberschrift hiess faelschlich "Kanäle".
             */
            <Druck
              style={styles.sectionHeadPress}
              onPress={() => oeffneSeite('channels')}
              accessibilityRole="button"
              accessibilityLabel="Alle Communitys anzeigen"
            >
              <Text style={styles.sectionHead}>Communitys →</Text>
            </Druck>
          )}
          {channels.map(communityZeile)}

          {people.length > 0 && (
            <Druck
              style={styles.sectionHeadPress}
              onPress={() => oeffneSeite('people')}
              accessibilityRole="button"
              accessibilityLabel="Alle Profile anzeigen"
            >
              <Text style={styles.sectionHead}>Profile →</Text>
            </Druck>
          )}
          {people.map(profilZeile)}
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
  // Kopf der Unterseite - wie in CommunityProfileScreen (Erstellte/Beigetretene).
  bar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  barTitel: { flex: 1, ...typography.h3, fontSize: 17, color: colors.text },
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
