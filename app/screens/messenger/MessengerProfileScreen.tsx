import React, { useContext } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { AuthContext } from '../../contexts/AuthContext';
import { SwitchBar } from '../../components/SwitchBar';
import { colors, sizes, spacing, themenStyles, typography } from '../../constants/design';
import { AreaKey } from '../../constants/navigation';
import { useProfil } from '../../contexts/ProfilContext';

interface Props {
  onSwitchArea: (area: AreaKey) => void;
  /** Oeffnet die Kontoliste (anderes eigenes Konto). */
  onSwitchAccount: () => void;
  onOpenSettings: () => void;
  /** Fuehrt zum Formular, das Name, Info und Link aendert. */
  onBearbeiten: () => void;
  onAvatarPress?: () => void;
  onNotice: (message: string) => void;
}

const ITEMS = ['Standort-Sichtbarkeit', 'Story-Sichtbarkeit', 'Lesebestätigung'];

/**
 * Prototyp-Frame "Messenger - Profil": Leiste „Profil wechseln", Bild links
 * neben Name und Biografie, die beiden Profilverweise, dann der Abschnitt
 * Einstellungen.
 */
export const MessengerProfileScreen = ({ onSwitchArea, onSwitchAccount, onOpenSettings, onBearbeiten, onAvatarPress, onNotice }: Props) => {
  const { user } = useContext(AuthContext);
  /*
   * Name und Info kommen aus demselben Zustand wie im Videos- und
   * Community-Profil. Vorher stand hier "user.profile.about" - das ist der
   * Begruessungstext des Kontos ("Hey, ich nutze All Media!"), nicht die
   * Info, die "Profil bearbeiten" aendert. Auf diesem Bildschirm stand
   * deshalb etwas anderes als auf den beiden anderen.
   */
  const { eigenesProfil } = useProfil();

  return (
  <View style={styles.screen}>
    {/* Fuehrt zur Kontoliste - hier hat Henrik den Kontowechsel gesucht. */}
    <SwitchBar onPress={onSwitchAccount} />

    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <Druck disabled={!onAvatarPress} onPress={onAvatarPress}>
          <Avatar id={user?.profile.id ?? 'me'} name={eigenesProfil.name} size={sizes.avatarXl} />
        </Druck>
        <View style={styles.headText}>
          <Text style={styles.name}>{eigenesProfil.name}</Text>
          {!!eigenesProfil.bio && <Text style={styles.bio}>{eigenesProfil.bio}</Text>}
        </View>
      </View>

      {/* Punkt 19: "Profil bearbeiten" gab es nur im Videos-Profil. Die
          Website hat den Knopf laengst an allen dreien, hier fehlte er. */}
      <Druck style={styles.bearbeiten} onPress={onBearbeiten}>
        <Text style={styles.bearbeitenText}>Profil bearbeiten</Text>
      </Druck>

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

const styles = themenStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: spacing.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md },
  headText: { flex: 1 },
  name: { fontSize: 21, fontWeight: '700', color: colors.text },
  bio: { ...typography.message, color: colors.text2, marginTop: 4 },
  /* Derselbe Knopf wie in OwnProfileHead, damit die drei Profile nicht
     unterschiedlich aussehen. */
  bearbeiten: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  bearbeitenText: { fontSize: 14, fontWeight: '600', color: colors.text, letterSpacing: -0.1 },
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemLabel: { ...typography.body, color: colors.text },
}));
