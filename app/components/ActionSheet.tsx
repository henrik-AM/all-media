import React from 'react';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface ActionSheetItem {
  key: string;
  label: string;
  icon: IconName;
  /*
   * Loeschen steht abgesetzt und in Rot. Die Website macht es genauso
   * (chatOptionen in web/public/app.js): ein Loeschen, das aussieht wie
   * "Stummschalten", wird irgendwann versehentlich angetippt.
   */
  gefahr?: boolean;
}

interface Props {
  visible: boolean;
  title: string;
  /** Zweite Zeile unter dem Namen — "Im Archiv", "Stummgeschaltet", "8 Mitglieder". */
  untertitel?: string;
  items: ActionSheetItem[];
  /**
   * Bild, um das es in diesem Blatt geht — die eben gemachte Aufnahme. Ohne
   * sie wählt man blind zwischen den Zielen.
   */
  vorschauUri?: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}

export const ActionSheet = ({
  visible,
  title,
  untertitel,
  items,
  vorschauUri,
  onSelect,
  onClose,
}: Props) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Druck style={styles.backdrop} onPress={onClose} />
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <Text style={styles.title}>{title}</Text>
      {Boolean(untertitel) && <Text style={styles.untertitel}>{untertitel}</Text>}
      {vorschauUri && <Image source={{ uri: vorschauUri }} style={styles.vorschau} />}
      {items.map((item) => (
        <Druck
          key={item.key}
          style={({ pressed }) => [
            styles.item,
            item.gefahr && styles.itemGefahr,
            pressed && styles.itemPressed,
          ]}
          onPress={() => onSelect(item.key)}
        >
          <View style={styles.icon}>
            <Ionicons
              name={item.icon}
              size={18}
              color={item.gefahr ? colors.danger : colors.text2}
            />
          </View>
          <Text style={[styles.label, item.gefahr && styles.labelGefahr]}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text3} />
        </Druck>
      ))}
    </View>
  </Modal>
);

const styles = themenStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(6,8,12,0.52)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.xl,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  title: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    color: colors.text,
    ...typography.h3,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemPressed: { backgroundColor: colors.surface2 },
  vorschau: {
    height: 168,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, color: colors.text, ...typography.body },
  labelGefahr: { color: colors.danger },
  // Der abgesetzte Bereich: eine kraeftigere Linie darueber statt der duennen.
  itemGefahr: { borderTopWidth: 6, borderTopColor: colors.surface2 },
  untertitel: {
    paddingHorizontal: spacing.lg,
    paddingTop: 8,
    paddingBottom: 10,
    color: colors.text3,
    ...typography.small,
  },
}));
