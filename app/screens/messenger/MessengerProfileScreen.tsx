import React, { useContext } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { AuthContext } from '../../contexts/AuthContext';
import { SwitchBar } from '../../components/SwitchBar';
import { colors, sizes, spacing, typography } from '../../constants/design';
import { AreaKey } from '../../constants/navigation';

interface Props {
  onSwitchArea: (area: AreaKey) => void;
  /** Oeffnet die Kontoliste (anderes eigenes Konto). */
  onSwitchAccount: () => void;
  onOpenSettings: () => void;
  onNotice: (message: string) => void;
}

const ITEMS = ['Standort-Sichtbarkeit', 'Story-Sichtbarkeit', 'Lesebestätigung'];

/**
 * Prototyp-Frame "Messenger - Profil": Leiste „Profil wechseln", Bild links
 * neben Name und Biografie, die beiden Profilverweise, dann der Abschnitt
 * Einstellungen.
 */
export const MessengerProfileScreen = ({ onSwitchArea, onSwitchAccount, onOpenSettings, onNotice }: Props) => {
  const { user } = useContext(AuthContext);

  return (
  <View style={styles.screen}>
    {/* Fuehrt zur Kontoliste - hier hat Henrik den Kontowechsel gesucht. */}
    <SwitchBar onPress={onSwitchAccount} />

    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <Avatar id={user?.profile.id ?? 'me'} name={user?.profile.name ?? 'Du'} size={sizes.avatarXl} />
        <View style={styles.headText}>
          <Text style={styles.name}>{user?.profile.name ?? 'Henrik'}</Text>
          <Text style={styles.bio}>{user?.profile.about ?? 'Baue gerade All Media.'}</Text>
        </View>
      </View>

      <View style={styles.links}>
        <Druck onPress={() => onSwitchArea('videos')}>
          <Text style={styles.link}>@videoprofil</Text>
        </Druck>
        <Druck onPress={() => onSwitchArea('communities')}>
          <Text style={styles.link}>@communityprofil</Text>
        </Druck>
      </View>

      <Druck style={styles.sectionLink} onPress={onOpenSettings}>
        <Text style={styles.sectionLinkText}>Einstellungen</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.text} />
      </Druck>

      <View style={styles.group}>
        {ITEMS.map((label) => (
          <Druck key={label} style={styles.item} onPress={onOpenSettings}>
            <Text style={styles.itemLabel}>{label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.text3} />
          </Druck>
        ))}
      </View>
    </ScrollView>
  </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: spacing.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md },
  headText: { flex: 1 },
  name: { fontSize: 21, fontWeight: '700', color: colors.text },
  bio: { ...typography.message, color: colors.text2, marginTop: 4 },
  links: { flexDirection: 'row', gap: 26, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  link: { fontSize: 15, fontWeight: '700', color: colors.text },
  sectionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    paddingBottom: spacing.sm,
  },
  sectionLinkText: { fontSize: 15, fontWeight: '700', color: colors.text },
  group: { backgroundColor: colors.surface },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    height: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  itemLabel: { ...typography.body, color: colors.text },
});
