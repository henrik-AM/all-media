import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { SheetRahmen } from './SheetRahmen';
import { useProfil } from '../contexts/ProfilContext';
import { colors, radius, sizes, spacing, typography } from '../constants/design';
import { mockUsers } from '../mocks';
import { Contact, Story } from '../types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const GRUENDE = [
  'Spam oder Werbung',
  'Beleidigung oder Hass',
  'Gefälschtes Profil',
  'Nicht jugendfreie Inhalte',
  'Etwas anderes',
];

/* --------------------------------------------------- Wer sie gesehen hat */

interface AnsichtenProps {
  story: Story;
  contacts: Contact[];
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
}

/**
 * Prototyp: bei der eigenen Story steht unten „Ansichten" statt eines
 * Antwortfelds. Vorher kam dort nur ein Hinweis.
 *
 * Wer sie gesehen hat, hängt an der Aufnahmezeit — so bleibt die Liste beim
 * erneuten Öffnen gleich, statt bei jedem Mal zu wechseln.
 */
export const StoryAnsichtenSheet = ({ story, contacts, onClose, onOpenProfile }: AnsichtenProps) => {
  const bekannte = contacts.filter((c) => mockUsers[c.id]);
  const wieviele = bekannte.length
    ? 1 + (Math.floor((story.aufgenommen ?? 0) / 60000) % bekannte.length)
    : 0;
  const seher = bekannte.slice(0, wieviele);

  return (
    <SheetRahmen
      visible
      title={`${seher.length} ${seher.length === 1 ? 'Ansicht' : 'Ansichten'}`}
      onClose={onClose}
      hoch={seher.length > 5}
    >
      {seher.length === 0 ? (
        <Text style={styles.hinweis}>Noch hat niemand deine Story gesehen.</Text>
      ) : (
        <ScrollView>
          {seher.map((c) => {
            const person = mockUsers[c.id];
            return (
              <Druck
                key={c.id}
                style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
                onPress={() => {
                  onClose();
                  onOpenProfile(c.id);
                }}
              >
                <Avatar id={c.id} name={person.name} size={sizes.avatarSm} />
                <Text style={styles.label}>{person.name}</Text>
                <Text style={styles.neben}>{person.handle}</Text>
              </Druck>
            );
          })}
        </ScrollView>
      )}
    </SheetRahmen>
  );
};

/* ------------------------------------------------------------ Mehr-Menü */

interface OptionenProps {
  story: Story;
  eigene: boolean;
  onClose: () => void;
  onDelete: () => void;
  onNotice: (message: string) => void;
}

export const StoryOptionenSheet = ({ story, eigene, onClose, onDelete, onNotice }: OptionenProps) => {
  const { stummSchalten, melden } = useProfil();
  const [meldeSchritt, setMeldeSchritt] = useState(false);
  const person = mockUsers[story.userId];

  const punkte: { key: string; label: string; icon: IconName; gefahr?: boolean }[] = eigene
    ? [
        { key: 'sichtbar', label: 'Wer darf sie sehen', icon: 'eye-outline' },
        { key: 'sichern', label: 'Auf dem Gerät sichern', icon: 'bookmark-outline' },
        { key: 'loeschen', label: 'Story löschen', icon: 'trash-outline', gefahr: true },
      ]
    : [
        { key: 'link', label: 'Link kopieren', icon: 'link-outline' },
        { key: 'stumm', label: `${person?.name ?? 'Diese Person'} stummschalten`, icon: 'volume-mute-outline' },
        { key: 'melden', label: 'Story melden', icon: 'shield-outline', gefahr: true },
      ];

  const waehlen = (key: string) => {
    if (key === 'loeschen') {
      onDelete();
      return onClose();
    }
    if (key === 'sichern') {
      onNotice(story.mediaUri ? 'Story gesichert' : 'Diese Story hat noch kein Bild');
      return onClose();
    }
    if (key === 'sichtbar') {
      onNotice('Story-Sichtbarkeit steht in den Einstellungen unter „Chats“');
      return onClose();
    }
    if (key === 'link') {
      onNotice(`all-media.app/story/${story.id}`);
      return onClose();
    }
    if (key === 'stumm') {
      const jetzt = stummSchalten(story.userId);
      onNotice(jetzt ? `${person?.name} stummgeschaltet` : 'Stummschaltung aufgehoben');
      return onClose();
    }
    setMeldeSchritt(true);
  };

  return (
    <SheetRahmen
      visible
      title={meldeSchritt ? 'Story melden' : eigene ? 'Deine Story' : person?.name ?? 'Story'}
      onClose={onClose}
    >
      {meldeSchritt ? (
        <ScrollView>
          {GRUENDE.map((grund) => (
            <Druck
              key={grund}
              style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
              onPress={() => {
                melden(story.userId, grund);
                onNotice('Danke, wir sehen uns das an');
                onClose();
              }}
            >
              <Text style={styles.label}>{grund}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text3} />
            </Druck>
          ))}
        </ScrollView>
      ) : (
        <View>
          {punkte.map((p) => (
            <Druck
              key={p.key}
              style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
              onPress={() => waehlen(p.key)}
            >
              <View style={styles.symbol}>
                <Ionicons name={p.icon} size={18} color={p.gefahr ? colors.danger : colors.text2} />
              </View>
              <Text style={[styles.label, p.gefahr && styles.gefahr]}>{p.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text3} />
            </Druck>
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
  neben: { ...typography.small, color: colors.text3 },
  gefahr: { color: colors.danger },
  hinweis: { ...typography.message, color: colors.text2, padding: spacing.lg },
});
