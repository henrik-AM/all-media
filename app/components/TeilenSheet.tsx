import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { SheetRahmen } from './SheetRahmen';
import { colors, radius, sizes, spacing, typography } from '../constants/design';
import { mockUsers } from '../mocks';
import { Contact } from '../types';

export interface TeilenZiel {
  art: 'post' | 'video';
  id: string;
  titel: string;
  autor: string;
}

interface Props {
  ziel: TeilenZiel | null;
  contacts: Contact[];
  onClose: () => void;
  /** Schickt den Beitrag in den Chat mit dieser Person. */
  onSend: (userId: string, ziel: TeilenZiel) => void;
}

/**
 * Prototyp-Frames "Nutzer B + Beitrag teilen" und "VQ + Video teilen": ein
 * Raster aus Personen. Wen man antippt, der bekommt es in den Chat.
 */
export const TeilenSheet = ({ ziel, contacts, onClose, onSend }: Props) => {
  const [gesendet, setGesendet] = useState<string[]>([]);

  if (!ziel) return null;

  const kontaktIds = contacts.map((c) => c.id).filter((id) => mockUsers[id]);
  const uebrige = Object.keys(mockUsers).filter((id) => id !== 'me' && !kontaktIds.includes(id));

  const raster = (ids: string[]) => (
    <View style={styles.raster}>
      {ids.map((id) => {
        const fertig = gesendet.includes(id);
        return (
          <Druck
            key={id}
            style={[styles.kachel, fertig && styles.kachelFertig]}
            disabled={fertig}
            onPress={() => {
              setGesendet((prev) => [...prev, id]);
              onSend(id, ziel);
            }}
          >
            <Avatar id={id} name={mockUsers[id].name} size={sizes.avatarLg} />
            {fertig && (
              <View style={styles.haken}>
                <Ionicons name="checkmark" size={13} color={colors.white} />
              </View>
            )}
            <Text style={styles.name} numberOfLines={1}>
              {mockUsers[id].name}
            </Text>
          </Druck>
        );
      })}
    </View>
  );

  return (
    <SheetRahmen
      visible
      title={ziel.art === 'video' ? 'Video teilen' : 'Beitrag teilen'}
      onClose={() => {
        setGesendet([]);
        onClose();
      }}
      hoch
    >
      <ScrollView contentContainerStyle={styles.inhalt}>
        {kontaktIds.length > 0 && <Text style={styles.kopf}>Deine Kontakte</Text>}
        {raster(kontaktIds)}
        {uebrige.length > 0 && <Text style={styles.kopf}>Weitere Vorschläge</Text>}
        {raster(uebrige)}
      </ScrollView>
    </SheetRahmen>
  );
};

const styles = StyleSheet.create({
  inhalt: { paddingBottom: spacing.lg },
  kopf: { ...typography.small, fontWeight: '600', color: colors.text2, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 6 },
  raster: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md },
  kachel: {
    width: '33.33%',
    alignItems: 'center',
    gap: 7,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  kachelFertig: { opacity: 0.55 },
  haken: {
    position: 'absolute',
    top: spacing.md,
    right: '50%',
    transform: [{ translateX: 28 }],
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...typography.small, color: colors.text, maxWidth: '92%' },
});
