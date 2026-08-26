import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EmptyState } from '../../components/EmptyState';
import { FilterPillen } from '../../components/FilterPillen';
import { SearchBar } from '../../components/SearchBar';
import { Avatar } from '../../components/Avatar';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';
import { useProfil } from '../../contexts/ProfilContext';
import { Community } from '../../types';

/*
 * Henrik: "Home zeigt nur Communitys, denen der Nutzer bereits beigetreten
 * ist. Noch nicht beigetretene Communitys unter 'Entdecken' o. Ae. anzeigen."
 *
 * Vorher standen alle in einer Liste, getrennt nur nach oeffentlich/privat -
 * beigetreten und nicht beigetreten waren nicht auseinanderzuhalten. Genauso
 * geloest wie in der Website (renderCommunities).
 */
type Filter = 'meine' | 'entdecken';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'meine', label: 'Meine' },
  { key: 'entdecken', label: 'Entdecken' },
];

interface Props {
  onOpenCommunity: (community: Community) => void;
  onNotice: (message: string) => void;
}

export const CommunitiesScreen = ({ onOpenCommunity, onNotice }: Props) => {
  // Die Liste liegt im gemeinsamen Zustand: ein selbst erstellter Kanal muss
  // hier genauso auftauchen wie im Community-Profil.
  const { communities, kanalBeitreten, kanalGelesen } = useProfil();
  const [filter, setFilter] = useState<Filter>('meine');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const passt = (c: Community) =>
      !q || c.name.toLowerCase().includes(q) || c.topic.toLowerCase().includes(q);

    const meine = communities.filter((c) => c.joined && passt(c));
    const entdecken = communities.filter((c) => !c.joined && passt(c));

    return filter === 'entdecken' ? entdecken : meine;
  }, [communities, filter, query]);

  const toggleJoin = (community: Community) => {
    kanalBeitreten(community.id);
    onNotice(community.joined ? `„${community.name}" verlassen` : `„${community.name}" beigetreten`);
  };

  const open = (community: Community) => {
    if (!community.joined) {
      onNotice('Tritt der Community zuerst bei');
      return;
    }
    kanalGelesen(community.id);
    onOpenCommunity(community);
  };

  const renderCommunity = ({ item }: { item: Community }) => (
    <Druck
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => open(item)}
    >
      {/*
        Frueher eine Flaeche in einer von acht Farben - als einzige Stelle der
        App, die den Wechsel auf Verlaeufe nicht mitgemacht hat. Neben der
        Community-Uebersicht im Profil, wo laengst Verlaeufe stehen, sah das
        aus wie zwei verschiedene Apps.
      */}
      <Avatar id={item.id} name={item.name} size={52} ecke={radius.lg} />

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          {item.visibility === 'private' && (
            <Ionicons name="lock-closed" size={13} color={colors.text3} />
          )}
        </View>
        <Text style={styles.topic} numberOfLines={1}>
          {item.topic}
        </Text>
        <Text style={styles.members}>{item.members.toLocaleString('de-DE')} Mitglieder</Text>
      </View>

      <View style={styles.actions}>
        {item.unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.unreadCount}</Text>
          </View>
        )}
        <Druck
          style={[styles.join, item.joined && styles.joinActive]}
          onPress={() => toggleJoin(item)}
        >
          <Text style={[styles.joinText, item.joined && styles.joinTextActive]}>
            {item.joined ? 'Mitglied' : 'Beitreten'}
          </Text>
        </Druck>
      </View>
    </Druck>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Suche hier nach deinen Communitys..."
        />
      </View>

      {/*
        Ohne Zahlen. Henrik am 26.08.2026: "Zahl bei Entdecken wird angezeigt.
        Nur Communitys, keine Zahl." Die Zahl an einem Filter liest sich wie
        ein Zaehler fuer Ungelesenes - hier zaehlte sie nur, wie lang die
        Liste dahinter ist, und das sieht man ohnehin sofort.
      */}
      <FilterPillen pillen={FILTERS} aktiv={filter} onChange={setFilter} />

      <FlatList
        data={visible}
        renderItem={renderCommunity}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title={
              query
                ? 'Keine Community gefunden'
                : filter === 'entdecken'
                  ? 'Du bist überall dabei'
                  : 'Noch keiner Community beigetreten'
            }
            text={
              query
                ? `Für „${query}" wurde nichts gefunden.`
                : filter === 'entdecken'
                  ? 'Es gibt gerade nichts Neues zu entdecken.'
                  : 'Unter „Entdecken" findest du Communitys zum Beitreten.'
            }
          />
        }
      />
    </View>
  );
};

const styles = themenStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: 14, paddingBottom: 10 },
  title: { marginBottom: spacing.md, color: colors.text, ...typography.title },


  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  rowPressed: { backgroundColor: colors.surface2 },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, color: colors.text, ...typography.name },
  topic: { marginTop: 2, color: colors.text2, ...typography.preview },
  members: { marginTop: 2, color: colors.text3, ...typography.small },

  actions: { alignItems: 'flex-end', gap: 6 },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 11.5, fontWeight: '700' },
  join: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.brand },
  joinActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  joinText: { color: colors.white, fontSize: 12.5, fontWeight: '600' },
  joinTextActive: { color: colors.text2 },
}));
