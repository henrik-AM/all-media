import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { OwnProfileHead } from '../../components/OwnProfileHead';
import { colors, radius, spacing, typography } from '../../constants/design';
import { AreaKey } from '../../constants/navigation';
import { mockContacts } from '../../mocks';

interface Props {
  onSwitchArea: (area: AreaKey) => void;
  onOpenContacts: () => void;
  onOpenCamera: () => void;
  onNotice: (message: string) => void;
}

/** Prototyp-Frame "Messenger - Profil". */
export const MessengerProfileScreen = ({ onSwitchArea, onOpenContacts, onOpenCamera, onNotice }: Props) => (
  <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <OwnProfileHead
      name="Henrik"
      onSwitch={() => onNotice('Wähle unten „@videoprofil" oder „@communityprofil"')}
    >
      <Text style={styles.bio}>Baue gerade All Media. Erreichbar über Chat und Story.</Text>
      <View style={styles.chips}>
        <Pressable style={styles.chip} onPress={() => onSwitchArea('videos')}>
          <Text style={styles.chipText}>@videoprofil</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => onSwitchArea('communities')}>
          <Text style={styles.chipText}>@communityprofil</Text>
        </Pressable>
      </View>
    </OwnProfileHead>

    <View style={styles.group}>
      <Pressable style={styles.item} onPress={onOpenContacts}>
        <Ionicons name="person-outline" size={20} color={colors.text2} />
        <Text style={styles.itemLabel}>Kontakte</Text>
        <Text style={styles.itemValue}>{mockContacts.length}</Text>
      </Pressable>
      <Pressable style={styles.item} onPress={onOpenCamera}>
        <Ionicons name="image-outline" size={20} color={colors.text2} />
        <Text style={styles.itemLabel}>Deine Story</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.text3} />
      </Pressable>
      <Pressable style={styles.item} onPress={() => onNotice('Zu finden unter Einstellungen › Messenger')}>
        <Ionicons name="eye-outline" size={20} color={colors.text2} />
        <Text style={styles.itemLabel}>Story-Sichtbarkeit</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.text3} />
      </Pressable>
      <Pressable style={styles.item} onPress={() => onNotice('Zu finden unter Einstellungen › Messenger')}>
        <Ionicons name="location-outline" size={20} color={colors.text2} />
        <Text style={styles.itemLabel}>Standort-Sichtbarkeit</Text>
        <Text style={styles.itemValue}>Freunde</Text>
      </Pressable>
    </View>
  </ScrollView>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: spacing.xl },
  bio: { ...typography.message, color: colors.text2, textAlign: 'center', paddingHorizontal: spacing.xl },
  chips: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
  },
  chipText: { ...typography.small, fontWeight: '600', color: colors.brand },
  group: { marginTop: spacing.md, backgroundColor: colors.surface },
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
});
