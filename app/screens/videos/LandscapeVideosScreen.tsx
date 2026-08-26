import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Motiv } from '../../components/Motiv';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { FilterPillen } from '../../components/FilterPillen';
import { SearchBar } from '../../components/SearchBar';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';
import { mockUsers } from '../../mocks';
import { useProfil } from '../../contexts/ProfilContext';

interface Props {
  /** Oeffnet den Querformat-Player. */
  onOpenClip: (clipId: string) => void;
  onNotice: (message: string) => void;
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',')}k` : String(n);

/*
 * Die vier Knoepfe der Filterleiste und was sie zeigen.
 *
 * Die Website hatte die Leiste, aber sie tat nichts: der gewaehlte Wert wurde
 * gelesen und nie angewandt, alle vier Knoepfe zeigten dieselben Videos. In
 * der App fehlte die Leiste ganz. Beides hat Henrik am 26.08.2026 gemeldet.
 * Jetzt entscheidet `art` am Video, wohin es gehoert — in App und Website
 * nach denselben Regeln.
 */
type ClipFilter = 'alle' | 'standard' | '360' | 'live';

const FILTER: { key: ClipFilter; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'standard', label: 'Standard' },
  { key: '360', label: '360°' },
  { key: 'live', label: 'Live' },
];

const passtZu = (filter: ClipFilter, art: string) => filter === 'alle' || art === filter;

/** Prototyp-Frame "Videos - Querformat": Suchleiste plus Videoliste. */
export const LandscapeVideosScreen = ({ onOpenClip, onNotice }: Props) => {
  // Eigene Aufnahmen und die Livestream-Aufzeichnung stehen im gemeinsamen
  // Zustand und sollen hier oben mit auftauchen.
  const { clips } = useProfil();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ClipFilter>('alle');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clips.filter((c) => {
      if (!passtZu(filter, c.art ?? 'standard')) return false;
      if (!q) return true;
      return c.title.toLowerCase().includes(q) || mockUsers[c.userId].name.toLowerCase().includes(q);
    });
  }, [clips, query, filter]);

  const filterLabel = FILTER.find((f) => f.key === filter)?.label ?? 'Alle';

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Querformat durchsuchen" />
      </View>

      <FilterPillen pillen={FILTER} aktiv={filter} onChange={setFilter} />

      {list.length === 0 ? (
        <EmptyState
          icon="tv-outline"
          title="Kein Video gefunden"
          text={
            query
              ? `Für „${query}" gibt es unter „${filterLabel}" keinen Treffer.`
              : `Unter „${filterLabel}" liegt gerade nichts.`
          }
        />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const person = mockUsers[item.userId];
            const art = item.art ?? 'standard';
            return (
              <Druck
                style={styles.clip}
                onPress={() => onOpenClip(item.id)}
              >
                <View style={styles.thumb}>
                  <Motiv id={item.id} icon="tv-outline" iconSize={32} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
                  {/* Abzeichen oben links. Ohne es waere am Ergebnis nicht zu
                      sehen, dass der Filter etwas getan hat — die Kacheln
                      saehen alle gleich aus. */}
                  {art === 'live' && <Text style={[styles.art, styles.artLive]}>LIVE</Text>}
                  {art === '360' && <Text style={[styles.art, styles.art360]}>360°</Text>}
                  <Text style={styles.duration}>{item.duration}</Text>
                </View>
                <View style={styles.meta}>
                  <Avatar id={item.userId} name={person.name} size={36} />
                  <View style={styles.metaText}>
                    <Text style={styles.clipTitle}>{item.title}</Text>
                    <Text style={styles.clipSub}>
                      {person.name} ·{' '}
                      {art === 'live'
                        ? `${compact(item.zuschauer ?? 0)} sehen zu`
                        : `${compact(item.views)} Aufrufe · ${item.age}`}
                    </Text>
                  </View>
                </View>
              </Druck>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = themenStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  head: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  clip: { paddingBottom: spacing.lg },
  thumb: {
    aspectRatio: 16 / 9,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  duration: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    color: colors.white,
    fontSize: 11.5,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    overflow: 'hidden',
  },
  art: {
    position: 'absolute',
    left: 8,
    top: 8,
    color: colors.white,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    overflow: 'hidden',
  },
  artLive: { backgroundColor: colors.danger },
  art360: { backgroundColor: 'rgba(0,0,0,0.72)' },
  meta: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: 11 },
  metaText: { flex: 1 },
  clipTitle: { ...typography.name, color: colors.text, lineHeight: 19 },
  clipSub: { ...typography.small, color: colors.text3, marginTop: 3 },
}));
