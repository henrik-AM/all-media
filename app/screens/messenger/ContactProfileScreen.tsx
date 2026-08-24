import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { colors, radius, spacing, typography } from '../../constants/design';
import { mockUsers } from '../../mocks';

interface Props {
  userId: string;
  onBack: () => void;
  onMessage: (userId: string) => void;
  onCall: (userId: string, art: 'audio' | 'video') => void;
  onNotice: (message: string) => void;
}

const AKTIONEN = [
  { key: 'message', label: 'Nachricht', icon: 'chatbubble-outline' as const },
  { key: 'audio', label: 'Anrufen', icon: 'call-outline' as const },
  { key: 'video', label: 'Video', icon: 'videocam-outline' as const },
  { key: 'search', label: 'Suchen', icon: 'search-outline' as const },
];

const EINTRAEGE = [
  { key: 'media', label: 'Medien, Links und Dokumente', icon: 'images-outline' as const, wert: '128' },
  { key: 'starred', label: 'Markierte Nachrichten', icon: 'star-outline' as const, wert: '3' },
  { key: 'mute', label: 'Stummschalten', icon: 'notifications-off-outline' as const },
  { key: 'disappearing', label: 'Selbstlöschende Nachrichten', icon: 'timer-outline' as const, wert: 'Aus' },
  { key: 'encryption', label: 'Verschlüsselung', icon: 'lock-closed-outline' as const, wert: 'Ende-zu-Ende' },
];

const GEFAHR = [
  { key: 'block', label: 'Kontakt blockieren', icon: 'ban-outline' as const },
  { key: 'report', label: 'Kontakt melden', icon: 'flag-outline' as const },
];

/**
 * Das Profil einer Person aus Sicht des Messengers - an WhatsApp angelehnt.
 *
 * Bewusst getrennt vom Profil im Bereich Videos: Aus einem Chat heraus will
 * man Nummer, Medien und Stummschalten sehen, keine Beitragsstatistik.
 */
export const ContactProfileScreen = ({ userId, onBack, onMessage, onCall, onNotice }: Props) => {
  const insets = useSafeAreaInsets();
  const person = mockUsers[userId];

  if (!person) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onBack} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        </View>
        <Text style={styles.leer}>Diese Person gibt es nicht.</Text>
      </View>
    );
  }

  const statusText =
    person.status === 'online' ? 'Online' : person.status === 'away' ? 'Abwesend' : 'Zuletzt online: heute';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitel}>Kontaktinfo</Text>
        <Pressable onPress={() => onNotice('Kontakt bearbeiten folgt')} hitSlop={8}>
          <Ionicons name="create-outline" size={21} color={colors.text2} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl + insets.bottom }}>
        <View style={styles.kopf}>
          <Avatar id={person.id} name={person.name} size={104} />
          <Text style={styles.name}>{person.name}</Text>
          <Text style={styles.handle}>{person.handle}</Text>
          {!!person.phone && <Text style={styles.nummer}>{person.phone}</Text>}
          <Text style={styles.status}>{statusText}</Text>
        </View>

        <View style={styles.aktionen}>
          {AKTIONEN.map((a) => (
            <Pressable
              key={a.key}
              style={styles.aktion}
              onPress={() => {
                if (a.key === 'message') return onMessage(person.id);
                if (a.key === 'audio') return onCall(person.id, 'audio');
                if (a.key === 'video') return onCall(person.id, 'video');
                onNotice(`${a.label} folgt`);
              }}
            >
              <Ionicons name={a.icon} size={21} color={colors.brand} />
              <Text style={styles.aktionText}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {!!person.about && (
          <View style={styles.block}>
            <Text style={styles.blockTitel}>Info</Text>
            <Text style={styles.blockText}>{person.about}</Text>
          </View>
        )}

        <View style={styles.liste}>
          {EINTRAEGE.map((e) => (
            <Pressable key={e.key} style={styles.zeile} onPress={() => onNotice(`${e.label} folgt`)}>
              <Ionicons name={e.icon} size={21} color={colors.text2} />
              <Text style={styles.zeileText}>{e.label}</Text>
              {!!e.wert && <Text style={styles.zeileWert}>{e.wert}</Text>}
              <Ionicons name="chevron-forward" size={17} color={colors.text3} />
            </Pressable>
          ))}
        </View>

        <View style={styles.liste}>
          {GEFAHR.map((e) => (
            <Pressable key={e.key} style={styles.zeile} onPress={() => onNotice(`${e.label} folgt`)}>
              <Ionicons name={e.icon} size={21} color={colors.danger} />
              <Text style={[styles.zeileText, styles.gefahrText]}>{e.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitel: { flex: 1, color: colors.text, ...typography.h3 },
  leer: { padding: spacing.lg, color: colors.text2, ...typography.body },

  kopf: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
    gap: 4,
  },
  name: { marginTop: spacing.md, color: colors.text, ...typography.h2 },
  handle: { color: colors.text3, ...typography.body },
  nummer: { marginTop: 2, color: colors.text2, ...typography.body },
  status: { marginTop: 2, color: colors.text3, ...typography.small },

  aktionen: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  aktion: { flex: 1, alignItems: 'center', gap: 5 },
  aktionText: { color: colors.brand, ...typography.small },

  block: { backgroundColor: colors.surface, padding: spacing.lg, marginBottom: spacing.sm },
  blockTitel: { color: colors.text3, marginBottom: 4, ...typography.small },
  blockText: { color: colors.text, ...typography.body },

  liste: { backgroundColor: colors.surface, marginBottom: spacing.sm },
  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  zeileText: { flex: 1, color: colors.text, ...typography.body },
  zeileWert: { color: colors.text3, ...typography.small },
  gefahrText: { color: colors.danger },
});
