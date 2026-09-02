import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { colors, spacing, themenStyles, typography } from '../../constants/design';
import { useDaten } from '../../contexts/DatenContext';
import { useSupabase } from '../../contexts/SupabaseContext';
import { ladeFolgeListe } from '../../lib/daten';

interface Props {
  userId: string;
  onBack: () => void;
  onOpenProfile?: (userId: string) => void;
  onNotice: (message: string) => void;
}

export const FollowersScreen = ({ userId, onBack, onOpenProfile, onNotice }: Props) => {
  const { users: alleNutzer, ichId } = useDaten();
  const { supabase } = useSupabase();
  const insets = useSafeAreaInsets();
  const person = alleNutzer[userId];

  /*
   * Hier stand bis zum 02.09.2026 eine feste Liste: u1 bis u5, bei jeder
   * Person dieselbe. Sie sah nur deshalb plausibel aus, weil die Zahl
   * darüber aus `profile_zahlen` kommt und echt ist — die Namen darunter
   * hatten damit nie etwas zu tun. Jetzt kommen beide aus `follows`.
   */
  const [ids, setIds] = useState<string[] | null>(null);

  useEffect(() => {
    if (!supabase || !ichId) return;
    let gilt = true;
    ladeFolgeListe(supabase, ichId, userId, 'follower')
      .then((liste) => gilt && setIds(liste))
      .catch((e: any) => {
        console.error('Follower laden fehlgeschlagen:', e?.message ?? e);
        if (gilt) setIds([]);
        onNotice('Die Follower konnten nicht geladen werden.');
      });
    return () => {
      gilt = false;
    };
  }, [supabase, ichId, userId]);

  const followers = (ids ?? []).map((id) => alleNutzer[id]).filter(Boolean);

  if (!person) {
    return (
      <View style={styles.container}>
        <Text style={styles.leer}>Diese Person gibt es nicht.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Druck onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Druck>
        <Text style={styles.headerTitel}>Follower</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl + insets.bottom }}>
        {ids !== null && followers.length === 0 && (
          <Text style={styles.leer}>
            {userId === 'me' ? 'Dir folgt noch niemand.' : `Noch niemand folgt ${person.name}.`}
          </Text>
        )}
        {followers.map((follower) => (
          <Druck
            key={follower.id}
            style={styles.row}
            onPress={() => onOpenProfile?.(follower.id)}
          >
            <Avatar id={follower.id} name={follower.name} size={44} />
            <View style={styles.rowBody}>
              <Text style={styles.rowName}>{follower.name}</Text>
              <Text style={styles.rowHandle}>{follower.handle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text3} />
          </Druck>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = themenStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitel: { ...typography.name, color: colors.text },
  leer: { ...typography.body, color: colors.text2, textAlign: 'center', marginTop: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowBody: { flex: 1 },
  rowName: { ...typography.name, color: colors.text },
  rowHandle: { ...typography.small, color: colors.text2, marginTop: 2 },
}));
