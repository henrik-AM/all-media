import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { colors, radius, sizes, spacing, typography } from '../../constants/design';
import { mockUsers } from '../../mocks';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Item {
  label: string;
  icon: IconName;
  toggle?: string;
}

interface Section {
  id: string;
  title: string;
  items: Item[];
}

/*
 * Prototyp-Frame "Einstellungen": vier Abschnitte mit einer Sprungleiste
 * darüber. Die Einträge sind eins zu eins übernommen.
 */
const SECTIONS: Section[] = [
  {
    id: 'allgemein',
    title: 'Allgemein',
    items: [
      { label: 'Erziehungsberechtigte/r', icon: 'shield-outline' },
      { label: 'Spendencode', icon: 'bookmark-outline' },
      { label: 'Sicherheits-/Entsperrcode', icon: 'lock-closed-outline' },
      { label: 'Geräteverknüpfung', icon: 'phone-portrait-outline' },
      { label: 'Dunkles Design', icon: 'moon-outline', toggle: 'theme' },
    ],
  },
  {
    id: 'messenger',
    title: 'Messenger',
    items: [
      { label: 'Lesebestätigung', icon: 'checkmark-done-outline' },
      { label: 'Standort-Sichtbarkeit', icon: 'location-outline' },
      { label: 'Story-Sichtbarkeit', icon: 'eye-outline' },
    ],
  },
  {
    id: 'videos',
    title: 'Videos',
    items: [
      { label: 'Privates Profil', icon: 'lock-closed-outline', toggle: 'videoPrivate' },
      { label: 'Spendencode', icon: 'bookmark-outline' },
      { label: 'Insights', icon: 'compass-outline' },
      { label: 'Mit Glocke markierte Profile', icon: 'notifications-outline' },
      { label: 'Repost-Sichtbarkeit', icon: 'repeat-outline' },
      { label: 'Likes-Sichtbarkeit', icon: 'heart-outline' },
      { label: 'Downloadeinstellungen', icon: 'image-outline' },
      { label: 'Story-Sichtbarkeit', icon: 'eye-outline' },
      { label: 'Nutzerstatus', icon: 'person-outline' },
      { label: 'Profilbanner', icon: 'tv-outline' },
    ],
  },
  {
    id: 'communitys',
    title: 'Communitys',
    items: [
      { label: 'Spendencode', icon: 'bookmark-outline' },
      { label: 'Nutzerstatus', icon: 'person-outline' },
      { label: 'Privates Profil', icon: 'lock-closed-outline', toggle: 'commPrivate' },
      { label: 'Nachrichtenerlaubnis', icon: 'chatbubble-outline' },
      { label: 'Push-to-Talk Nachricht', icon: 'mic-outline' },
      { label: 'Gestummte Communitys', icon: 'volume-mute-outline' },
      { label: 'Gestummte Profile', icon: 'ban-outline' },
    ],
  },
];

interface Props {
  onNotice: (message: string) => void;
  onLogout: () => void;
}

export const SettingsScreen = ({ onNotice, onLogout }: Props) => {
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  const [switches, setSwitches] = useState<Record<string, boolean>>({
    theme: false,
    videoPrivate: false,
    commPrivate: false,
  });

  const me = mockUsers.me;

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <Text style={styles.title}>Einstellungen</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
          {SECTIONS.map((section) => (
            <Pressable
              key={section.id}
              style={styles.pill}
              onPress={() => scroll.current?.scrollTo({ y: offsets.current[section.id] ?? 0, animated: true })}
            >
              <Text style={styles.pillText}>{section.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        <View style={styles.profile}>
          <Avatar id="me" name={me.name} size={sizes.avatarXl} />
          <Text style={styles.profileName}>Henrik</Text>
          <Text style={styles.profileSub}>{me.handle} · Hey, ich nutze All Media!</Text>
        </View>

        {SECTIONS.map((section) => (
          <View
            key={section.id}
            onLayout={(e) => {
              offsets.current[section.id] = e.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.sectionHead}>{section.title} →</Text>
            <View style={styles.group}>
              {section.items.map((item) => (
                <View key={`${section.id}-${item.label}`} style={styles.item}>
                  <Ionicons name={item.icon} size={20} color={colors.text2} />
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  {item.toggle ? (
                    <Switch
                      value={switches[item.toggle]}
                      onValueChange={(next) => setSwitches({ ...switches, [item.toggle as string]: next })}
                      trackColor={{ true: colors.brand, false: colors.surface3 }}
                    />
                  ) : (
                    <Pressable onPress={() => onNotice(`${item.label} folgt mit dem Backend`)} hitSlop={10}>
                      <Ionicons name="chevron-forward" size={18} color={colors.text3} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.group}>
          <View style={styles.item}>
            <Ionicons name="information-circle-outline" size={20} color={colors.text2} />
            <Text style={styles.itemLabel}>Über All Media</Text>
            <Text style={styles.itemValue}>1.0.0</Text>
          </View>
          <Pressable style={styles.item} onPress={onLogout}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={[styles.itemLabel, styles.danger]}>Abmelden</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  head: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.title, color: colors.text, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  pills: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface3 },
  pillText: { ...typography.small, fontWeight: '600', color: colors.text2 },
  content: { paddingBottom: spacing.xxl },
  profile: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  profileName: { ...typography.h2, color: colors.text },
  profileSub: { ...typography.preview, color: colors.text2 },
  sectionHead: {
    ...typography.overline,
    color: colors.text3,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  group: { backgroundColor: colors.surface },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    height: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemLabel: { flex: 1, ...typography.body, color: colors.text },
  itemValue: { ...typography.preview, color: colors.text3 },
  danger: { color: colors.danger },
});
