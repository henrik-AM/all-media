import React, { useContext, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { AuthContext } from '../../contexts/AuthContext';
import { colors, radius, sizes, spacing, typography } from '../../constants/design';

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
    id: 'konto',
    title: 'Konto',
    items: [
      { label: 'Profil bearbeiten', icon: 'person-circle-outline' },
      { label: 'Telefonnummer ändern', icon: 'call-outline' },
      { label: 'Passwort ändern', icon: 'key-outline' },
      { label: 'Zwei-Faktor-Anmeldung', icon: 'shield-checkmark-outline' },
      { label: 'Konto löschen', icon: 'trash-outline' },
    ],
  },
  {
    id: 'datenschutz',
    title: 'Datenschutz',
    items: [
      { label: 'Zuletzt online', icon: 'time-outline' },
      { label: 'Profilbild sichtbar für', icon: 'image-outline' },
      { label: 'Info sichtbar für', icon: 'information-circle-outline' },
      { label: 'Blockierte Kontakte', icon: 'ban-outline' },
      { label: 'Gruppen: wer darf hinzufügen', icon: 'people-outline' },
      { label: 'Bildschirmsperre', icon: 'finger-print-outline', toggle: 'bildschirmsperre' },
    ],
  },
  {
    id: 'benachrichtigungen',
    title: 'Mitteilungen',
    items: [
      { label: 'Nachrichten-Töne', icon: 'notifications-outline', toggle: 'toene' },
      { label: 'Vibration', icon: 'phone-portrait-outline', toggle: 'vibration' },
      { label: 'Vorschau anzeigen', icon: 'eye-outline', toggle: 'vorschau' },
      { label: 'Gruppen-Mitteilungen', icon: 'people-circle-outline' },
      { label: 'Ruhezeiten', icon: 'moon-outline' },
    ],
  },
  {
    id: 'messenger',
    title: 'Chats',
    items: [
      { label: 'Lesebestätigung', icon: 'checkmark-done-outline', toggle: 'lesebestaetigung' },
      { label: 'Standort-Sichtbarkeit', icon: 'location-outline' },
      { label: 'Story-Sichtbarkeit', icon: 'eye-outline' },
      { label: 'Mit Enter senden', icon: 'return-down-back-outline', toggle: 'entersenden' },
      { label: 'Chat-Hintergrund', icon: 'color-palette-outline' },
      { label: 'Schriftgröße', icon: 'text-outline' },
      { label: 'Chat-Verlauf sichern', icon: 'cloud-upload-outline' },
      { label: 'Archivierte Chats', icon: 'archive-outline' },
    ],
  },
  {
    id: 'speicher',
    title: 'Speicher',
    items: [
      { label: 'Automatischer Download', icon: 'download-outline' },
      { label: 'Speicher verwalten', icon: 'pie-chart-outline' },
      { label: 'Datensparmodus', icon: 'cellular-outline', toggle: 'datensparen' },
      { label: 'Medienqualität', icon: 'options-outline' },
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
    id: 'hilfe',
    title: 'Hilfe',
    items: [
      { label: 'Hilfebereich', icon: 'help-circle-outline' },
      { label: 'Problem melden', icon: 'bug-outline' },
      { label: 'Nutzungsbedingungen', icon: 'document-text-outline' },
      { label: 'Datenschutzerklärung', icon: 'lock-closed-outline' },
      { label: 'Freunde einladen', icon: 'share-social-outline' },
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
  /** Oeffnet die Kontoliste zum Umschalten. */
  onSwitchAccount: () => void;
  /**
   * Abschnitt, bei dem die Seite aufgehen soll - kommt aus dem Menue im
   * eigenen Profil (Prototyp "VP + Einstellung" / "CP + Einstellung").
   */
  sprung?: string | null;
  onSprungFertig?: () => void;
}

export const SettingsScreen = ({ onNotice, onLogout, onSwitchAccount, sprung, onSprungFertig }: Props) => {
  const { user, konten } = useContext(AuthContext);
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  const [switches, setSwitches] = useState<Record<string, boolean>>({
    theme: false,
    videoPrivate: false,
    commPrivate: false,
    bildschirmsperre: false,
    toene: true,
    vibration: true,
    vorschau: true,
    lesebestaetigung: true,
    entersenden: false,
    datensparen: false,
  });

  // Die Abstaende stehen erst nach dem ersten Zeichnen fest, deshalb der
  // kurze Aufschub - vorher waere offsets.current noch leer.
  useEffect(() => {
    if (!sprung) return;
    const zeit = setTimeout(() => {
      scroll.current?.scrollTo({ y: offsets.current[sprung] ?? 0, animated: false });
      onSprungFertig?.();
    }, 80);
    return () => clearTimeout(zeit);
  }, [sprung, onSprungFertig]);

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
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
        {/*
          Der Kontowechsel gehoert nach ganz oben: Es ist die Einstellung, die
          das ganze uebrige Bild veraendert.
        */}
        <Pressable style={styles.konto} onPress={onSwitchAccount}>
          <Avatar
            id={user?.profile.id ?? 'me'}
            name={user?.profile.name ?? 'Konto'}
            size={sizes.avatarLg}
          />
          <View style={styles.kontoBody}>
            <Text style={styles.kontoName}>{user?.profile.name ?? 'Nicht angemeldet'}</Text>
            <Text style={styles.kontoSub}>
              {user?.email ?? '—'}
              {konten.length > 1 ? `  ·  ${konten.length} Konten` : ''}
            </Text>
          </View>
          <Ionicons name="swap-horizontal-outline" size={22} color={colors.brand} />
        </Pressable>

        <Pressable style={styles.wechselBtn} onPress={onSwitchAccount}>
          <Ionicons name="people-outline" size={18} color={colors.brand} />
          <Text style={styles.wechselText}>Konto wechseln oder hinzufügen</Text>
        </Pressable>

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
  pills: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface3 },
  pillText: { ...typography.small, fontWeight: '600', color: colors.text2 },
  content: { paddingBottom: spacing.xxl },
  sectionHead: {
    ...typography.overline,
    color: colors.text3,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  konto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  kontoBody: { flex: 1, minWidth: 0 },
  kontoName: { color: colors.text, ...typography.h3 },
  kontoSub: { color: colors.text3, marginTop: 2, ...typography.small },
  wechselBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
  },
  wechselText: { color: colors.brand, ...typography.name },

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
