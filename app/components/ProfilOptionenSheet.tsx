import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SheetRahmen } from './SheetRahmen';
import { useProfil } from '../contexts/ProfilContext';
import { colors, radius, spacing, typography } from '../constants/design';
import { mockUsers } from '../mocks';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onNotice: (message: string) => void;
  /** Beim Blockieren: die Person aus den Kontakten nehmen. */
  onBlockiert?: (userId: string, blockiert: boolean) => void;
}

const GRUENDE = [
  'Spam oder Werbung',
  'Beleidigung oder Hass',
  'Gefälschtes Profil',
  'Nicht jugendfreie Inhalte',
  'Etwas anderes',
];

/**
 * Die drei Punkte im Profil einer anderen Person. Jede Option hat eine
 * Folge: Blockieren nimmt sie aus den Kontakten und sperrt den Chat,
 * Stummschalten und Melden merkt sich die App.
 */
export const ProfilOptionenSheet = ({ visible, userId, onClose, onNotice, onBlockiert }: Props) => {
  const { istStumm, istBlockiert, stummSchalten, blockieren, melden } = useProfil();
  const [meldeSchritt, setMeldeSchritt] = useState(false);

  const person = mockUsers[userId];
  if (!person) return null;

  const schliessen = () => {
    setMeldeSchritt(false);
    onClose();
  };

  const punkte: { key: string; label: string; icon: IconName; gefahr?: boolean }[] = [
    { key: 'link', label: 'Link kopieren', icon: 'link-outline' },
    {
      key: 'stumm',
      label: istStumm(userId) ? 'Stummschaltung aufheben' : 'Stummschalten',
      icon: 'volume-mute-outline',
    },
    {
      key: 'block',
      label: istBlockiert(userId) ? 'Blockierung aufheben' : 'Blockieren',
      icon: 'ban-outline',
      gefahr: true,
    },
    { key: 'melden', label: 'Profil melden', icon: 'shield-outline', gefahr: true },
  ];

  const waehlen = (key: string) => {
    if (key === 'link') {
      // Ohne Zwischenablage-Baustein wenigstens die Adresse zeigen.
      onNotice(`all-media.app/${person.handle.replace('@', '')}`);
      return schliessen();
    }
    if (key === 'stumm') {
      const jetzt = stummSchalten(userId);
      onNotice(jetzt ? `${person.name} stummgeschaltet` : 'Stummschaltung aufgehoben');
      return schliessen();
    }
    if (key === 'block') {
      const jetzt = blockieren(userId);
      onBlockiert?.(userId, jetzt);
      onNotice(jetzt ? `${person.name} blockiert` : 'Blockierung aufgehoben');
      return schliessen();
    }
    setMeldeSchritt(true);
  };

  return (
    <SheetRahmen
      visible={visible}
      title={meldeSchritt ? 'Profil melden' : person.name}
      onClose={schliessen}
    >
      {meldeSchritt ? (
        <ScrollView>
          {GRUENDE.map((grund) => (
            <Pressable
              key={grund}
              style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
              onPress={() => {
                melden(userId, grund);
                onNotice('Danke, wir sehen uns das an');
                schliessen();
              }}
            >
              <Text style={styles.label}>{grund}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text3} />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View>
          {punkte.map((p) => (
            <Pressable
              key={p.key}
              style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
              onPress={() => waehlen(p.key)}
            >
              <View style={styles.symbol}>
                <Ionicons name={p.icon} size={18} color={p.gefahr ? colors.danger : colors.text2} />
              </View>
              <Text style={[styles.label, p.gefahr && styles.gefahr]}>{p.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text3} />
            </Pressable>
          ))}
        </View>
      )}
    </SheetRahmen>
  );
};

const styles = StyleSheet.create({
  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  gedrueckt: { backgroundColor: colors.surface2 },
  symbol: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, ...typography.body, color: colors.text },
  gefahr: { color: colors.danger },
});
