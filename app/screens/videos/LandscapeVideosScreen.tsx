import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Motiv } from '../../components/Motiv';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { SearchBar } from '../../components/SearchBar';
import { colors, radius, spacing, typography } from '../../constants/design';
import { mockUsers } from '../../mocks';
import { useProfil } from '../../contexts/ProfilContext';

interface Props {
  /** Oeffnet den Querformat-Player. */
  onOpenClip: (clipId: string) => void;
  onNotice: (message: string) => void;
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',')}k` : String(n);

/** Prototyp-Frame "Videos - Querformat": Suchleiste plus Videoliste. */
export const LandscapeVideosScreen = ({ onOpenClip, onNotice }: Props) => {
  // Eigene Aufnahmen und die Livestream-Aufzeichnung stehen im gemeinsamen
  // Zustand und sollen hier oben mit auftauchen.
  const { clips } = useProfil();
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clips;
    return clips.filter(
      (c) => c.title.toLowerCase().includes(q) || mockUsers[c.userId].name.toLowerCase().includes(q)
    );
  }, [clips, query]);

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Querformat durchsuchen" />
      </View>

      {list.length === 0 ? (
        <EmptyState icon="tv-outline" title="Kein Video gefunden" text={`Für „${query}" gibt es keinen Treffer.`} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const person = mockUsers[item.userId];
            return (
              <Pressable
                style={styles.clip}
                onPress={() => onOpenClip(item.id)}
              >
                <View style={styles.thumb}>
                  <Motiv id={item.id} icon="tv-outline" iconSize={32} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
                  <Text style={styles.duration}>{item.duration}</Text>
                </View>
                <View style={styles.meta}>
                  <Avatar id={item.userId} name={person.name} size={36} />
                  <View style={styles.metaText}>
                    <Text style={styles.clipTitle}>{item.title}</Text>
                    <Text style={styles.clipSub}>
                      {person.name} · {compact(item.views)} Aufrufe · {item.age}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
  meta: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: 11 },
  metaText: { flex: 1 },
  clipTitle: { ...typography.name, color: colors.text, lineHeight: 19 },
  clipSub: { ...typography.small, color: colors.text3, marginTop: 3 },
});
